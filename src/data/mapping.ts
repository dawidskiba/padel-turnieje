/**
 * Database rows -> the domain's TournamentState.
 *
 * The domain knows nothing about Supabase (ADR-0003), so this is the only place
 * the two vocabularies meet: snake_case rows in, camelCase domain out.
 */

import type {
  CourtRow,
  MatchParticipantRow,
  MatchRow,
  ParticipantRow,
  RoundParticipantRow,
  RoundRow,
  TournamentRow,
} from '../lib/database.types'
import type { Court, Match, Participant, Round, TournamentState } from '../domain/types'

export interface TournamentBundle {
  tournament: TournamentRow
  courts: CourtRow[]
  participants: ParticipantRow[]
  rounds: RoundRow[]
  matches: MatchRow[]
  matchParticipants: MatchParticipantRow[]
  roundParticipants: RoundParticipantRow[]
}

export function toCourt(row: CourtRow): Court {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    removedFromRound: row.removed_from_round,
  }
}

export function toParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id,
    name: row.name,
    entryOrder: row.entry_order,
    joinedRound: row.joined_round,
    retiredAfterRound: row.retired_after_round,
    seedCourtId: row.seed_court_id,
    seedSide: row.seed_side,
  }
}

export function toTournamentState(bundle: TournamentBundle): TournamentState {
  const sidesByMatch = new Map<string, { a: string[]; b: string[] }>()
  for (const row of bundle.matchParticipants) {
    let sides = sidesByMatch.get(row.match_id)
    if (!sides) {
      sides = { a: [], b: [] }
      sidesByMatch.set(row.match_id, sides)
    }
    sides[row.side].push(row.participant_id)
  }

  // Sides are ordered by entry order so a match reads the same way every time
  // it is rendered, rather than following row order out of the database.
  const entryOrder = new Map(bundle.participants.map((p) => [p.id, p.entry_order]))
  const byEntryOrder = (a: string, b: string) =>
    (entryOrder.get(a) ?? 0) - (entryOrder.get(b) ?? 0)

  const matchesByRound = new Map<string, Match[]>()
  const courtPosition = new Map(bundle.courts.map((c) => [c.id, c.position]))
  for (const row of bundle.matches) {
    const sides = sidesByMatch.get(row.id) ?? { a: [], b: [] }
    const list = matchesByRound.get(row.round_id) ?? []
    list.push({
      courtId: row.court_id,
      sideA: [...sides.a].sort(byEntryOrder),
      sideB: [...sides.b].sort(byEntryOrder),
      scoreA: row.score_a,
      scoreB: row.score_b,
    })
    matchesByRound.set(row.round_id, list)
  }
  for (const list of matchesByRound.values()) {
    list.sort((x, y) => (courtPosition.get(x.courtId) ?? 0) - (courtPosition.get(y.courtId) ?? 0))
  }

  const restingByRound = new Map<string, string[]>()
  const creditedByRound = new Map<string, string[]>()
  for (const row of bundle.roundParticipants) {
    if (row.status === 'playing') continue
    const target = row.status === 'resting' ? restingByRound : creditedByRound
    target.set(row.round_id, [...(target.get(row.round_id) ?? []), row.participant_id])
  }
  // Entry order here too, for the same reason as the sides: row order is
  // arbitrary, and a list that reshuffles itself between renders reads as a bug.
  for (const map of [restingByRound, creditedByRound]) {
    for (const [roundId, ids] of map) map.set(roundId, [...ids].sort(byEntryOrder))
  }

  const rounds: Round[] = [...bundle.rounds]
    .sort((a, b) => a.number - b.number)
    .map((row) => ({
      number: row.number,
      isFinal: row.is_final,
      matches: matchesByRound.get(row.id) ?? [],
      resting: restingByRound.get(row.id) ?? [],
      credited: creditedByRound.get(row.id) ?? [],
    }))

  return {
    config: {
      format: bundle.tournament.format,
      teamFormat: bundle.tournament.team_format,
      gamePoints: bundle.tournament.game_points,
      restPoints: bundle.tournament.rest_points,
      pairingFormula: bundle.tournament.pairing_formula,
      scoring: bundle.tournament.scoring,
      neutralRounds: bundle.tournament.neutral_rounds,
    },
    participants: bundle.participants.map(toParticipant).sort((a, b) => a.entryOrder - b.entryOrder),
    courts: bundle.courts.map(toCourt).sort((a, b) => a.position - b.position),
    rounds,
  }
}

/** Round row ids by round number, for score edits and undo. */
export function roundIdsByNumber(bundle: TournamentBundle): Map<number, string> {
  return new Map(bundle.rounds.map((r) => [r.number, r.id]))
}

/** Match row id for a given round number and court, for score edits. */
export function matchIdFor(
  bundle: TournamentBundle,
  roundNumber: number,
  courtId: string,
): string | undefined {
  const round = bundle.rounds.find((r) => r.number === roundNumber)
  if (!round) return undefined
  return bundle.matches.find((m) => m.round_id === round.id && m.court_id === courtId)?.id
}

/**
 * Overlay scores that are typed but not yet saved.
 *
 * Applied before anything is derived, so the court card, the standings and the
 * rounds list all show the organiser's input immediately. Without it a score
 * sits blank until the write and a refetch complete — around a second at the
 * desk, which reads as the tap not having registered.
 *
 * The queued value is the truth here: it is what the organiser typed, and it
 * will be written. The pending marker on the card says it is not saved yet.
 */
export function applyPendingScores(
  bundle: TournamentBundle,
  pending: Array<{ matchId: string; scoreA: number; scoreB: number }>,
): TournamentBundle {
  if (pending.length === 0) return bundle

  const byMatch = new Map(pending.map((p) => [p.matchId, p]))
  let changed = false

  const matches = bundle.matches.map((match) => {
    const queued = byMatch.get(match.id)
    if (!queued) return match
    if (match.score_a === queued.scoreA && match.score_b === queued.scoreB) return match
    changed = true
    return { ...match, score_a: queued.scoreA, score_b: queued.scoreB }
  })

  return changed ? { ...bundle, matches } : bundle
}

export type TournamentPhase = 'setup' | 'running' | 'finished'

/** Derived, never stored — see docs/schema.md. */
export function phaseOf(bundle: TournamentBundle): TournamentPhase {
  if (bundle.tournament.finished_at) return 'finished'
  return bundle.rounds.length === 0 ? 'setup' : 'running'
}
