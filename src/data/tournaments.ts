/**
 * Every read and write against a tournament the organiser owns.
 *
 * Multi-table writes go through the RPCs, because the Supabase client has no
 * transactions and a dropped connection mid-sequence would otherwise leave a
 * half-built tournament or round (ADR-0003).
 */

import { supabase } from '../lib/supabase'
import type {
  CourtRow,
  CreateRoundPayload,
  CreateTournamentPayload,
  MatchParticipantRow,
  MatchRow,
  ParticipantRow,
  PublicTournament,
  RoundParticipantRow,
  RoundRow,
  TournamentRow,
} from '../lib/database.types'
import type { ProposedRound } from '../domain/types'
import type { TournamentBundle } from './mapping'
import { enqueueScore } from './writeQueue'

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  if (result.data === null) throw new Error('Brak danych.')
  return result.data
}

/**
 * A list row carries its round count so the list can tell setup from running
 * without loading each tournament. PostgREST returns an embedded aggregate as a
 * one-element array.
 */
export interface TournamentListRow extends TournamentRow {
  rounds: Array<{ count: number }>
}

export async function listTournaments(): Promise<TournamentListRow[]> {
  return unwrap(
    await supabase
      .from('tournaments')
      .select('*, rounds(count)')
      .order('created_at', { ascending: false })
      .returns<TournamentListRow[]>(),
  )
}

export function roundCountOf(row: TournamentListRow): number {
  return row.rounds?.[0]?.count ?? 0
}

/**
 * Everything the desk needs, in one pass. Six small queries rather than a
 * nested select: the shapes stay flat and obvious, and a club tournament is a
 * few hundred rows in total.
 */
export async function loadTournament(id: string): Promise<TournamentBundle> {
  const tournament = unwrap(
    await supabase.from('tournaments').select('*').eq('id', id).single<TournamentRow>(),
  )

  const [courts, participants, rounds] = await Promise.all([
    supabase.from('courts').select('*').eq('tournament_id', id).returns<CourtRow[]>(),
    supabase.from('participants').select('*').eq('tournament_id', id).returns<ParticipantRow[]>(),
    supabase.from('rounds').select('*').eq('tournament_id', id).returns<RoundRow[]>(),
  ])

  const roundIds = unwrap(rounds).map((r) => r.id)

  if (roundIds.length === 0) {
    return {
      tournament,
      courts: unwrap(courts),
      participants: unwrap(participants),
      rounds: [],
      matches: [],
      matchParticipants: [],
      roundParticipants: [],
    }
  }

  const matches = unwrap(
    await supabase.from('matches').select('*').in('round_id', roundIds).returns<MatchRow[]>(),
  )
  const matchIds = matches.map((m) => m.id)

  const [matchParticipants, roundParticipants] = await Promise.all([
    matchIds.length
      ? supabase
          .from('match_participants')
          .select('*')
          .in('match_id', matchIds)
          .returns<MatchParticipantRow[]>()
      : Promise.resolve({ data: [] as MatchParticipantRow[], error: null }),
    supabase
      .from('round_participants')
      .select('*')
      .in('round_id', roundIds)
      .returns<RoundParticipantRow[]>(),
  ])

  return {
    tournament,
    courts: unwrap(courts),
    participants: unwrap(participants),
    rounds: unwrap(rounds),
    matches,
    matchParticipants: unwrap(matchParticipants),
    roundParticipants: unwrap(roundParticipants),
  }
}

export async function createTournament(
  payload: CreateTournamentPayload,
): Promise<{ id: string; slug: string }> {
  const { data, error } = await supabase.rpc('create_tournament', { p_tournament: payload })
  if (error) throw new Error(error.message)

  // The function returns TABLE(id, slug), so PostgREST sends back an array.
  const created = (data as Array<{ id: string; slug: string }> | null)?.[0]
  if (!created) throw new Error('Nie udało się utworzyć turnieju.')
  return created
}

export async function createRound(
  tournamentId: string,
  proposal: ProposedRound,
): Promise<string> {
  const payload: CreateRoundPayload = {
    number: proposal.number,
    is_final: proposal.isFinal,
    matches: proposal.matches.map((m) => ({
      court_id: m.courtId,
      side_a: m.sideA,
      side_b: m.sideB,
    })),
    resting: proposal.resting,
  }

  const { data, error } = await supabase.rpc('create_round', {
    p_tournament: tournamentId,
    p_round: payload,
  })

  if (error) {
    // A retry after a timeout that actually committed hits the unique
    // constraint on (tournament_id, number). That means the round already
    // exists, which is success, not failure.
    if (error.code === '23505') return ''
    throw new Error(error.message)
  }
  return (data as string) ?? ''
}

/**
 * Score entry goes through the offline queue rather than straight to the
 * database, so a wifi blip costs nothing. Callers get an immediate return and
 * watch the queue for pending state.
 */
export function saveScore(
  tournamentId: string,
  matchId: string,
  scoreA: number,
  scoreB: number,
): void {
  enqueueScore({ tournamentId, matchId, scoreA, scoreB })
}

export async function writeScore(matchId: string, scoreA: number, scoreB: number): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ score_a: scoreA, score_b: scoreB })
    .eq('id', matchId)
  if (error) throw new Error(error.message)
}

/** Only the most recent round is ever undoable; the cascade does the rest. */
export async function deleteRound(roundId: string): Promise<void> {
  const { error } = await supabase.from('rounds').delete().eq('id', roundId)
  if (error) throw new Error(error.message)
}

export async function addParticipant(
  tournamentId: string,
  name: string,
  creditMissedRounds: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('add_participant', {
    p_tournament: tournamentId,
    p_name: name,
    p_credit_missed_rounds: creditMissedRounds,
  })
  if (error) throw new Error(error.message)
}

/**
 * Retiring keeps every point earned and leaves the participant in the standings
 * marked RET; they are simply excluded from later rounds.
 */
export async function retireParticipant(
  participantId: string,
  afterRound: number,
): Promise<void> {
  const { error } = await supabase
    .from('participants')
    .update({ retired_after_round: afterRound })
    .eq('id', participantId)
  if (error) throw new Error(error.message)
}

export async function unretireParticipant(participantId: string): Promise<void> {
  const { error } = await supabase
    .from('participants')
    .update({ retired_after_round: null })
    .eq('id', participantId)
  if (error) throw new Error(error.message)
}

export async function addCourt(
  tournamentId: string,
  name: string,
  position: number,
): Promise<void> {
  const { error } = await supabase
    .from('courts')
    .insert({ tournament_id: tournamentId, name, position })
  if (error) throw new Error(error.message)
}

export async function renameCourt(courtId: string, name: string): Promise<void> {
  const { error } = await supabase.from('courts').update({ name }).eq('id', courtId)
  if (error) throw new Error(error.message)
}

/**
 * Soft removal: past matches keep a real foreign key to a real court, and a
 * rained-out court can come back.
 */
export async function removeCourt(courtId: string, fromRound: number): Promise<void> {
  const { error } = await supabase
    .from('courts')
    .update({ removed_from_round: fromRound })
    .eq('id', courtId)
  if (error) throw new Error(error.message)
}

export async function restoreCourt(courtId: string): Promise<void> {
  const { error } = await supabase
    .from('courts')
    .update({ removed_from_round: null })
    .eq('id', courtId)
  if (error) throw new Error(error.message)
}

export async function renameTournament(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('tournaments').update({ name }).eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Scoring settings freeze once the first round exists — the database enforces
 * it too, so this is only reachable while the tournament is in setup.
 */
export async function updateScoring(
  id: string,
  scoring: { gamePoints: number; restPoints: number },
): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ game_points: scoring.gamePoints, rest_points: scoring.restPoints })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function finishTournament(id: string): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ finished_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function reopenTournament(id: string): Promise<void> {
  const { error } = await supabase.from('tournaments').update({ finished_at: null }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteTournament(id: string): Promise<void> {
  const { error } = await supabase.from('tournaments').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * The whole anonymous read path. Anonymous clients have no table access at all,
 * so everything a viewer sees comes through this one function (ADR-0002).
 */
export async function fetchPublicTournament(slug: string): Promise<PublicTournament | null> {
  const { data, error } = await supabase.rpc('public_tournament', { p_slug: slug })
  if (error) throw new Error(error.message)
  return (data as PublicTournament | null) ?? null
}
