/**
 * The Standing — the ranking Mexicano reads to build every round, and the
 * result the tournament exists to produce.
 *
 * Mirrors the `standings` SQL view exactly (see supabase/migrations). The
 * database is authoritative for what the public sees; this recomputes the same
 * thing locally so round generation does not need a round trip.
 */

import type { StandingRow, TournamentState } from './types'
import { joinCreditPerRound } from './validation'
import { courtRanks, creditValue, playedValue, restValue, scaleFor } from './scoring'

interface Tally {
  /** The ranking currency: raw points, or court-weighted points. */
  points: number
  /** Always the actual match points, so the tie-break stays comparable. */
  scored: number
  conceded: number
  wins: number
  draws: number
  losses: number
  rests: number
}

function emptyTally(): Tally {
  return { points: 0, scored: 0, conceded: 0, wins: 0, draws: 0, losses: 0, rests: 0 }
}

export function computeStandings(state: TournamentState): StandingRow[] {
  const tallies = new Map<string, Tally>()
  const tally = (id: string): Tally => {
    let t = tallies.get(id)
    if (!t) {
      t = emptyTally()
      tallies.set(id, t)
    }
    return t
  }

  const byCourts = state.config.scoring === 'courts'

  for (const round of state.rounds) {
    const scale = scaleFor(round, state.config.neutralRounds)
    const ranks = byCourts ? courtRanks(state, round) : null

    for (const match of round.matches) {
      if (match.scoreA === null || match.scoreB === null) continue
      const sides = [
        { members: match.sideA, scored: match.scoreA, conceded: match.scoreB },
        { members: match.sideB, scored: match.scoreB, conceded: match.scoreA },
      ]
      for (const side of sides) {
        for (const id of side.members) {
          const t = tally(id)
          // scored/conceded stay raw whatever the scheme, so point difference
          // means the same thing in both and can serve as the tie-break.
          t.scored += side.scored
          t.conceded += side.conceded
          t.points += byCourts
            ? playedValue(
                ranks!.get(match.courtId) ?? 1,
                side.scored,
                side.conceded,
                state.config.gamePoints,
                scale,
              )
            : side.scored
          if (side.scored > side.conceded) t.wins++
          else if (side.scored === side.conceded) t.draws++
          else t.losses++
        }
      }
    }

    // A rested round contributes Rest Points to both scored and conceded, so it
    // moves the total but leaves point difference untouched. Crediting it to
    // scored alone would hand everyone who sat out a large positive difference
    // and corrupt the tie-break that difference exists to settle.
    for (const id of round.resting) {
      const t = tally(id)
      t.scored += state.config.restPoints
      t.conceded += state.config.restPoints
      t.points += byCourts ? restValue(scale) : state.config.restPoints
      t.rests++
    }
    // A credited round pays less than a rest, and is deliberately not counted as
    // one — see joinCreditPerRound and RoundParticipantStatus.
    const joinCredit = joinCreditPerRound(state.config.gamePoints, state.config.restPoints)
    for (const id of round.credited) {
      const t = tally(id)
      t.scored += joinCredit
      t.conceded += joinCredit
      t.points += byCourts ? creditValue(scale) : joinCredit
    }
  }

  const rows = state.participants.map((participant) => {
    const t = tallies.get(participant.id) ?? emptyTally()
    return {
      participantId: participant.id,
      name: participant.name,
      entryOrder: participant.entryOrder,
      retired: participant.retiredAfterRound !== null,
      points: t.points,
      rawPoints: t.scored,
      difference: t.scored - t.conceded,
      wins: t.wins,
      draws: t.draws,
      losses: t.losses,
      rests: t.rests,
      position: 0,
    } satisfies StandingRow
  })

  rows.sort(compareStandingRows)

  // Standard competition ranking: equal rows share a position, then it skips.
  let position = 0
  rows.forEach((row, index) => {
    if (index === 0 || !tiedForPosition(rows[index - 1], row)) {
      position = index + 1
    }
    row.position = position
  })

  return rows
}

/**
 * Points, then point difference, then matches won. Draws count towards neither
 * wins nor losses. Entry order is the final, purely deterministic tie-break —
 * without it the Mexicano ladder would depend on row order.
 */
export function compareStandingRows(a: StandingRow, b: StandingRow): number {
  return (
    b.points - a.points ||
    b.difference - a.difference ||
    b.wins - a.wins ||
    // Under court scoring the integers are small and ties are common, so raw
    // points earn their keep as a further tie-break before entry order.
    b.rawPoints - a.rawPoints ||
    a.entryOrder - b.entryOrder
  )
}

/** Equal on the three ranked criteria — entry order breaks order, not rank. */
export function tiedForPosition(a: StandingRow, b: StandingRow): boolean {
  return a.points === b.points && a.difference === b.difference && a.wins === b.wins
}

/** Participant ids best-first, for seeding a Mexicano round. */
export function rankedParticipantIds(state: TournamentState, eligible: Set<string>): string[] {
  return computeStandings(state)
    .filter((row) => eligible.has(row.participantId))
    .map((row) => row.participantId)
}
