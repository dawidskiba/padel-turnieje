/**
 * Mexicano pairing: the schedule is read off the Standing each round.
 *
 * Two things separate it from Americano. Court number is meaningful — the
 * leaders play Kort 1 and climbing courts is how a player reads their evening,
 * which is the exact opposite of Americano's even spread. And pairings follow
 * from rank rather than from history, so partnerships recur by design.
 */

import type { History } from './history'
import type { Court, PairingFormula, ProposedMatch } from './types'
import { PAIRING_FORMULAS } from './types'

/** Which ranks within a group of four end up on which side. */
const ARRANGEMENTS: Record<PairingFormula, [number[], number[]]> = {
  // Sides sum to the same rank total, so they are as evenly matched as the
  // group allows. This is why 1+4 is the default.
  '1+4v2+3': [
    [0, 3],
    [1, 2],
  ],
  '1+2v3+4': [
    [0, 1],
    [2, 3],
  ],
  '1+3v2+4': [
    [0, 2],
    [1, 3],
  ],
}

function arrangementRepeatsPartnership(
  group: string[],
  formula: PairingFormula,
  history: History,
  roundNumber: number,
): boolean {
  const [a, b] = ARRANGEMENTS[formula]
  return (
    history.partneredInPreviousRound(group[a[0]], group[a[1]], roundNumber) ||
    history.partneredInPreviousRound(group[b[0]], group[b[1]], roundNumber)
  )
}

/**
 * Split a ranked group of four into two sides.
 *
 * Strict rank grouping recreates partnerships, so the configured formula is
 * skipped when it would repeat one from the round immediately before. Only that
 * one round is considered: a group of four has exactly three arrangements, and
 * a longer memory exhausts them after three rounds and silently reverts to
 * strict formula for the rest of the tournament — which reads as a fault.
 *
 * If all three arrangements would repeat, the formula applies as written.
 */
export function splitGroup(
  group: string[],
  formula: PairingFormula,
  history: History,
  roundNumber: number,
  avoidRepeats: boolean,
): { sideA: string[]; sideB: string[] } {
  let chosen = formula

  if (avoidRepeats) {
    const order = [formula, ...PAIRING_FORMULAS.filter((f) => f !== formula)]
    const fresh = order.find(
      (candidate) => !arrangementRepeatsPartnership(group, candidate, history, roundNumber),
    )
    if (fresh) chosen = fresh
  }

  const [a, b] = ARRANGEMENTS[chosen]
  return {
    sideA: a.map((i) => group[i]),
    sideB: b.map((i) => group[i]),
  }
}

/**
 * Teams format: adjacent ranks meet, so the closest-matched teams always face
 * each other and the two leaders settle it on the top court. The pairing
 * formula has nothing to arrange here — there is no pair to balance.
 *
 * An immediate rematch is avoided by pulling in the next team down, where the
 * ladder allows it.
 */
export function pairTeamsByLadder(
  ranked: string[],
  matches: number,
  history: History,
  roundNumber: number,
  avoidRepeats: boolean,
): Array<{ sideA: string[]; sideB: string[] }> {
  const order = [...ranked]

  if (avoidRepeats) {
    for (let i = 0; i + 1 < matches * 2; i += 2) {
      if (!history.facedInPreviousRound(order[i], order[i + 1], roundNumber)) continue
      if (i + 2 >= order.length) continue
      ;[order[i + 1], order[i + 2]] = [order[i + 2], order[i + 1]]
    }
  }

  const result: Array<{ sideA: string[]; sideB: string[] }> = []
  for (let m = 0; m < matches; m++) {
    result.push({ sideA: [order[m * 2]], sideB: [order[m * 2 + 1]] })
  }
  return result
}

/**
 * Build a round from the ranking. `ranked` is best-first and already excludes
 * whoever is resting. Courts are filled from the top: ranks 1-4 on the first
 * court, 5-8 on the second, and so on.
 */
export function pairMexicano(
  ranked: string[],
  courts: Court[],
  teamFormat: 'individual' | 'teams',
  formula: PairingFormula,
  history: History,
  roundNumber: number,
  avoidRepeats: boolean,
): ProposedMatch[] {
  const matches = courts.length

  if (teamFormat === 'teams') {
    return pairTeamsByLadder(ranked, matches, history, roundNumber, avoidRepeats).map(
      (match, index) => ({ courtId: courts[index].id, ...match }),
    )
  }

  const result: ProposedMatch[] = []
  for (let m = 0; m < matches; m++) {
    const group = ranked.slice(m * 4, m * 4 + 4)
    const { sideA, sideB } = splitGroup(group, formula, history, roundNumber, avoidRepeats)
    result.push({ courtId: courts[m].id, sideA, sideB })
  }
  return result
}
