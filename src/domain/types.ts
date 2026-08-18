/**
 * Domain types. Vocabulary follows CONTEXT.md — Participant, Round, Match,
 * Game Points, Rest Points, Standing — so the code and the requirements can be
 * read against each other.
 *
 * Nothing here touches the database or React. The whole domain is pure
 * functions over these shapes (ADR-0003).
 */

import type { Scoring } from './scoring'

export type { Scoring }

export type Format = 'americano' | 'mexicano'
export type TeamFormat = 'individual' | 'teams'
export type Side = 'a' | 'b'

/** How a Court's four players are split into two sides, by rank in their group. */
export type PairingFormula = '1+4v2+3' | '1+2v3+4' | '1+3v2+4'

export const PAIRING_FORMULAS: PairingFormula[] = ['1+4v2+3', '1+2v3+4', '1+3v2+4']

export const DEFAULT_PAIRING_FORMULA: PairingFormula = '1+4v2+3'

/**
 * `credited` earns Rest Points like `resting`, but is excluded from the rest
 * rota count — otherwise a late joiner looks like the most-rested participant
 * and gets scheduled to play every remaining round.
 */
export type RoundParticipantStatus = 'playing' | 'resting' | 'credited'

export interface Participant {
  id: string
  name: string
  /** Final tie-break, and what keeps the rota and the ladder deterministic. */
  entryOrder: number
  joinedRound: number
  retiredAfterRound: number | null
  /** Mexicano round-1 pinning. */
  seedCourtId: string | null
  seedSide: Side | null
}

export interface Court {
  id: string
  name: string
  position: number
  /** First round on which this court is no longer used. */
  removedFromRound: number | null
}

export interface TournamentConfig {
  format: Format
  teamFormat: TeamFormat
  gamePoints: number
  restPoints: number
  /** Mexicano + individual only; null otherwise. */
  pairingFormula: PairingFormula | null
  /**
   * How rounds are turned into points — raw match score, or weighted by the
   * court you played on. See domain/scoring.ts.
   */
  scoring: Scoring
  /**
   * Rounds at the start during which the court does not count, because the
   * Mexicano draw has not sorted itself yet. Only meaningful under `courts`.
   */
  neutralRounds: number
}

export interface Match {
  courtId: string
  sideA: string[]
  sideB: string[]
  scoreA: number | null
  scoreB: number | null
}

export interface Round {
  number: number
  isFinal: boolean
  matches: Match[]
  /** Participant ids that sat this round out. */
  resting: string[]
  /** Participant ids credited for a round they missed before joining. */
  credited: string[]
}

export interface TournamentState {
  config: TournamentConfig
  participants: Participant[]
  courts: Court[]
  /** Ascending by round number. */
  rounds: Round[]
}

export interface ProposedMatch {
  courtId: string
  sideA: string[]
  sideB: string[]
}

/** What round generation returns, and what the organiser confirms. */
export interface ProposedRound {
  number: number
  isFinal: boolean
  matches: ProposedMatch[]
  resting: string[]
}

export interface StandingRow {
  participantId: string
  name: string
  entryOrder: number
  retired: boolean
  /** The ranking currency — raw match points, or court-weighted points. */
  points: number
  /** Always the actual match points, whatever the scheme. */
  rawPoints: number
  difference: number
  wins: number
  draws: number
  losses: number
  /** Rounds rested. Excludes credited rounds. */
  rests: number
  /** Standard competition ranking: equal rows share a position, then it skips. */
  position: number
}

/** How many participants make up one match in each team format. */
export function participantsPerMatch(teamFormat: TeamFormat): number {
  return teamFormat === 'individual' ? 4 : 2
}

/** Participants per side of the net. */
export function participantsPerSide(teamFormat: TeamFormat): number {
  return teamFormat === 'individual' ? 2 : 1
}

/**
 * A round is complete when every court has a result. Until then the tournament
 * cannot advance — and a final round cannot close the tournament.
 */
export function isRoundComplete(round: Round): boolean {
  return (
    round.matches.length > 0 &&
    round.matches.every((match) => match.scoreA !== null && match.scoreB !== null)
  )
}

/**
 * The organiser picks one side's score; the other follows, because the two
 * always sum to Game Points. Returns the pair in (a, b) order whichever side
 * was tapped.
 */
export function splitScore(
  side: Side,
  value: number,
  gamePoints: number,
): { scoreA: number; scoreB: number } {
  const scoreA = side === 'a' ? value : gamePoints - value
  return { scoreA, scoreB: gamePoints - scoreA }
}

export function isActiveInRound(participant: Participant, roundNumber: number): boolean {
  if (participant.joinedRound > roundNumber) return false
  if (participant.retiredAfterRound !== null && roundNumber > participant.retiredAfterRound) {
    return false
  }
  return true
}

export function isCourtAvailableInRound(court: Court, roundNumber: number): boolean {
  return court.removedFromRound === null || roundNumber < court.removedFromRound
}

export function activeParticipants(state: TournamentState, roundNumber: number): Participant[] {
  return state.participants
    .filter((p) => isActiveInRound(p, roundNumber))
    .sort((a, b) => a.entryOrder - b.entryOrder)
}

export function availableCourts(state: TournamentState, roundNumber: number): Court[] {
  return state.courts
    .filter((c) => isCourtAvailableInRound(c, roundNumber))
    .sort((a, b) => a.position - b.position)
}

/**
 * How many matches a round can hold — limited by the roster and the courts,
 * whichever runs out first. Leftover participants rest; surplus courts idle.
 */
export function matchCount(state: TournamentState, roundNumber: number): number {
  const perMatch = participantsPerMatch(state.config.teamFormat)
  const byRoster = Math.floor(activeParticipants(state, roundNumber).length / perMatch)
  return Math.min(byRoster, availableCourts(state, roundNumber).length)
}
