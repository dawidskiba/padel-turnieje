/**
 * Database shapes, kept in step with supabase/migrations by hand.
 *
 * Not generated: generation needs a live project and credentials, and this
 * schema is small enough that drift is caught by the type-checker the moment a
 * query references something that no longer exists.
 */

export type TournamentFormatRow = 'americano' | 'mexicano'
export type TeamFormatRow = 'individual' | 'teams'
export type PairingFormulaRow = '1+4v2+3' | '1+2v3+4' | '1+3v2+4'
export type MatchSideRow = 'a' | 'b'
export type RoundParticipantStatusRow = 'playing' | 'resting' | 'credited'

export interface TournamentRow {
  id: string
  owner_id: string
  slug: string
  name: string
  format: TournamentFormatRow
  team_format: TeamFormatRow
  game_points: number
  rest_points: number
  pairing_formula: PairingFormulaRow | null
  created_at: string
  finished_at: string | null
}

export interface CourtRow {
  id: string
  tournament_id: string
  name: string
  position: number
  removed_from_round: number | null
}

export interface ParticipantRow {
  id: string
  tournament_id: string
  name: string
  entry_order: number
  joined_round: number
  retired_after_round: number | null
  seed_court_id: string | null
  seed_side: MatchSideRow | null
}

export interface RoundRow {
  id: string
  tournament_id: string
  number: number
  is_final: boolean
  created_at: string
}

export interface MatchRow {
  id: string
  round_id: string
  court_id: string
  score_a: number | null
  score_b: number | null
}

export interface MatchParticipantRow {
  match_id: string
  participant_id: string
  side: MatchSideRow
}

export interface RoundParticipantRow {
  round_id: string
  participant_id: string
  status: RoundParticipantStatusRow
}

/** Payload accepted by the create_round RPC. */
export interface CreateRoundPayload {
  number: number
  is_final: boolean
  matches: Array<{ court_id: string; side_a: string[]; side_b: string[] }>
  resting: string[]
}

/** Payload accepted by the create_tournament RPC. */
export interface CreateTournamentPayload {
  name: string
  format: TournamentFormatRow
  team_format: TeamFormatRow
  game_points: number
  rest_points: number
  pairing_formula: PairingFormulaRow | null
  courts: string[]
  participants: Array<{
    name: string
    /** Index into `courts`, not an id — the courts do not exist yet. */
    seed_court_index?: number
    seed_side?: MatchSideRow
  }>
}

/** One entry of the json returned by public_tournament. */
export interface PublicTournament {
  tournament: {
    name: string
    format: TournamentFormatRow
    team_format: TeamFormatRow
    game_points: number
    rest_points: number
    finished: boolean
  }
  standings: Array<{
    name: string
    points: number
    difference: number
    wins: number
    draws: number
    losses: number
    retired: boolean
  }>
  current_round: {
    number: number
    is_final: boolean
    matches: Array<{
      court: string
      side_a: string[] | null
      side_b: string[] | null
      score_a: number | null
      score_b: number | null
    }>
    resting: string[]
  } | null
}
