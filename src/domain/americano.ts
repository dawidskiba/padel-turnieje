/**
 * Americano pairing: the schedule is decided independently of results.
 *
 * Priority order, from requirements-americano.md §2.2:
 *   1. no repeated partner while an unused partner exists
 *   2. among valid options, prefer opponents faced least often
 *   3. spread participants across courts
 *   4. respect the rest rota  (already applied before this runs)
 *
 * Greedy rather than optimal. The search space is a full matching problem, but
 * a roster is at most a few dozen people and "least bad available" is what the
 * priority list actually asks for: take the freshest partnership still on the
 * table, repeat, and any unavoidable repeats land at the end.
 */

import type { History } from './history'
import type { Court, Participant, ProposedMatch } from './types'
import { participantsPerSide } from './types'
import type { TeamFormat } from './types'

/** Lexicographic comparison of numeric tuples, for deterministic greedy picks. */
function lexCompare(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}

/**
 * Build the sides that will play. In individual format each side is a pair
 * chosen for partner freshness; in teams format a side is the team itself and
 * there is nothing to choose.
 */
export function formSides(
  players: Participant[],
  teamFormat: TeamFormat,
  history: History,
): string[][] {
  if (teamFormat === 'teams') {
    return players.map((p) => [p.id])
  }

  const entryOrder = new Map(players.map((p) => [p.id, p.entryOrder]))
  const remaining = players.map((p) => p.id)
  const sides: string[][] = []

  while (remaining.length >= 2) {
    let best: [string, string] | null = null
    let bestKey: number[] | null = null

    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const a = remaining[i]
        const b = remaining[j]
        const key = [
          history.partnerCount(a, b),
          history.opponentCount(a, b),
          entryOrder.get(a)!,
          entryOrder.get(b)!,
        ]
        if (bestKey === null || lexCompare(key, bestKey) < 0) {
          bestKey = key
          best = [a, b]
        }
      }
    }

    const [a, b] = best!
    sides.push([a, b])
    remaining.splice(remaining.indexOf(b), 1)
    remaining.splice(remaining.indexOf(a), 1)
  }

  return sides
}

/** How often the members of two sides have already faced each other. */
function crossOpponentCount(sideA: string[], sideB: string[], history: History): number {
  let total = 0
  for (const a of sideA) {
    for (const b of sideB) total += history.opponentCount(a, b)
  }
  return total
}

/** Pair the sides off into matches, preferring opponents met least often. */
export function formMatches(
  sides: string[][],
  history: History,
  entryOrder: Map<string, number>,
): Array<{ sideA: string[]; sideB: string[] }> {
  const remaining = [...sides]
  const matches: Array<{ sideA: string[]; sideB: string[] }> = []

  const rank = (side: string[]) => Math.min(...side.map((id) => entryOrder.get(id) ?? 0))

  while (remaining.length >= 2) {
    let best: [number, number] | null = null
    let bestKey: number[] | null = null

    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const key = [
          crossOpponentCount(remaining[i], remaining[j], history),
          rank(remaining[i]),
          rank(remaining[j]),
        ]
        if (bestKey === null || lexCompare(key, bestKey) < 0) {
          bestKey = key
          best = [i, j]
        }
      }
    }

    const [i, j] = best!
    matches.push({ sideA: remaining[i], sideB: remaining[j] })
    remaining.splice(j, 1)
    remaining.splice(i, 1)
  }

  return matches
}

/**
 * Spread participants across courts, so nobody spends the whole tournament on
 * the same one. Each match takes the free court its players have used least.
 *
 * Mexicano deliberately does the opposite — see mexicano.ts.
 */
export function assignCourtsSpread(
  matches: Array<{ sideA: string[]; sideB: string[] }>,
  courts: Court[],
  history: History,
): ProposedMatch[] {
  const free = [...courts]
  const assigned: ProposedMatch[] = []

  for (const match of matches) {
    const members = [...match.sideA, ...match.sideB]
    let bestIndex = 0
    let bestKey: number[] | null = null

    free.forEach((court, index) => {
      const usage = members.reduce((sum, id) => sum + history.courtCount(id, court.id), 0)
      const key = [usage, court.position]
      if (bestKey === null || lexCompare(key, bestKey) < 0) {
        bestKey = key
        bestIndex = index
      }
    })

    const court = free.splice(bestIndex, 1)[0]
    assigned.push({ courtId: court.id, sideA: match.sideA, sideB: match.sideB })
  }

  return assigned.sort(
    (a, b) =>
      courts.findIndex((c) => c.id === a.courtId) - courts.findIndex((c) => c.id === b.courtId),
  )
}

export function pairAmericano(
  players: Participant[],
  courts: Court[],
  teamFormat: TeamFormat,
  history: History,
): ProposedMatch[] {
  const perSide = participantsPerSide(teamFormat)
  const capacity = courts.length * perSide * 2
  const playing = players.slice(0, capacity)

  const entryOrder = new Map(playing.map((p) => [p.id, p.entryOrder]))
  const sides = formSides(playing, teamFormat, history)
  const matches = formMatches(sides, history, entryOrder)
  return assignCourtsSpread(matches, courts, history)
}
