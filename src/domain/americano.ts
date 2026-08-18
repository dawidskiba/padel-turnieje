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
  /**
   * Tie-break order. Equal-cost options have to be resolved somehow, and doing
   * it by entry order makes generation perfectly repeatable — which is why
   * "discard and regenerate" produced the identical round every time. Vary this
   * and the ties fall differently while the priorities above them are untouched.
   */
  tieBreak?: Map<string, number>,
): string[][] {
  if (teamFormat === 'teams') {
    return players.map((p) => [p.id])
  }

  const entryOrder = tieBreak ?? new Map(players.map((p) => [p.id, p.entryOrder]))
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

  return improvePairs(sides, history)
}

/**
 * Greedy pairs players off two at a time, which means the last two left are
 * forced together no matter how often they have already partnered. Observed in
 * a real 9-player tournament: F+G and H+I each repeated while dozens of fresh
 * pairings were still available.
 *
 * So walk over every pair of pairs and try the two other ways to recombine
 * their four players, keeping any swap that lowers the total. Repeats until
 * nothing improves — a handful of passes over a few dozen players.
 */
function improvePairs(sides: string[][], history: History): string[][] {
  const cost = (x: string, y: string) => history.partnerCount(x, y)
  const pairs = sides.map((side) => [...side] as [string, string])

  let improved = true
  while (improved) {
    improved = false

    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        const [a, b] = pairs[i]
        const [c, d] = pairs[j]
        const current = cost(a, b) + cost(c, d)

        const swapC = cost(a, c) + cost(b, d)
        const swapD = cost(a, d) + cost(b, c)

        if (swapC < current && swapC <= swapD) {
          pairs[i] = [a, c]
          pairs[j] = [b, d]
          improved = true
        } else if (swapD < current) {
          pairs[i] = [a, d]
          pairs[j] = [b, c]
          improved = true
        }
      }
    }
  }

  return pairs.map((pair) => [...pair])
}

/** How often the members of two sides have already faced each other. */
function crossOpponentCount(sideA: string[], sideB: string[], history: History): number {
  let total = 0
  for (const a of sideA) {
    for (const b of sideB) total += history.opponentCount(a, b)
  }
  return total
}

/**
 * How lopsided a foursome would still be on its best available court. Used only
 * to break ties, so court balance never outranks partner variety or opponent
 * freshness — but among equally good matches, prefer one that can actually be
 * placed somewhere sensible.
 *
 * Without this, a round can be built entirely out of foursomes that all want
 * the same court, and no assignment can rescue them.
 */
function bestCourtImbalance(members: string[], courts: Court[], history: History): number {
  if (courts.length === 0) return 0

  let best = Infinity
  for (const court of courts) {
    let cost = 0
    for (const id of members) {
      const counts = courts.map(
        (c) => history.courtCount(id, c.id) + (c.id === court.id ? 1 : 0),
      )
      const imbalance = Math.max(...counts) - Math.min(...counts)
      cost += imbalance * imbalance
    }
    best = Math.min(best, cost)
  }
  return best
}

/** Pair the sides off into matches, preferring opponents met least often. */
export function formMatches(
  sides: string[][],
  history: History,
  entryOrder: Map<string, number>,
  courts: Court[] = [],
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
          bestCourtImbalance([...remaining[i], ...remaining[j]], courts, history),
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

  return improveMatches(matches, history, courts)
}

/**
 * The same repair `improvePairs` does, one level up.
 *
 * Greedy matches sides off two at a time, so the last two are forced together
 * however often they have already met. Observed in a real 5-team Americano:
 * G&H played I&J in consecutive rounds while four of the ten possible fixtures
 * were still unused, because both alternatives were consumed by earlier picks.
 *
 * Swapping opponents between two matches leaves the partnerships alone — those
 * were already chosen for variety — so this only ever trades opponent repeats
 * down.
 */
function improveMatches(
  matches: Array<{ sideA: string[]; sideB: string[] }>,
  history: History,
  courts: Court[],
): Array<{ sideA: string[]; sideB: string[] }> {
  const result = matches.map((m) => ({ ...m }))
  const opponents = (a: string[], c: string[]) => crossOpponentCount(a, c, history)
  const courtCost = (a: string[], c: string[]) =>
    bestCourtImbalance([...a, ...c], courts, history)

  /**
   * `strict` reduces opponent repeats, which is priority 2. The second pass runs
   * with strict off: it only takes swaps that leave opponent cost untouched and
   * improve court balance, recovering the priority-3 work that the first pass
   * necessarily disturbed. Court spread never overrides opponent freshness.
   */
  const pass = (strict: boolean) => {
    let improved = true
    while (improved) {
      improved = false

      for (let i = 0; i < result.length; i++) {
        for (let j = i + 1; j < result.length; j++) {
          const { sideA: a1, sideB: b1 } = result[i]
          const { sideA: a2, sideB: b2 } = result[j]

          const options = [
            { i: { sideA: a1, sideB: b2 }, j: { sideA: a2, sideB: b1 } },
            { i: { sideA: a1, sideB: a2 }, j: { sideA: b1, sideB: b2 } },
          ]

          const score = (m: { sideA: string[]; sideB: string[] }[]) => ({
            opponents: opponents(m[0].sideA, m[0].sideB) + opponents(m[1].sideA, m[1].sideB),
            courts: courtCost(m[0].sideA, m[0].sideB) + courtCost(m[1].sideA, m[1].sideB),
          })

          const currentScore = score([result[i], result[j]])

          for (const option of options) {
            const next = score([option.i, option.j])
            const better = strict
              ? next.opponents < currentScore.opponents
              : next.opponents === currentScore.opponents && next.courts < currentScore.courts

            if (better) {
              result[i] = option.i
              result[j] = option.j
              improved = true
              break
            }
          }
        }
      }
    }
  }

  pass(true)
  if (courts.length > 0) pass(false)

  return result
}

/**
 * Spread participants across courts, so nobody spends the whole tournament on
 * the same one. Each match takes the free court its players have used least.
 *
 * Mexicano deliberately does the opposite — see mexicano.ts.
 */
/** Every ordering of `items`, for exhaustively costing small assignments. */
function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  const out: T[][] = []
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)]
    for (const tail of permutations(rest)) out.push([item, ...tail])
  })
  return out
}

/** Above this many courts, enumerate-everything gets expensive; 7! = 5040. */
const EXHAUSTIVE_COURT_LIMIT = 7

export function assignCourtsSpread(
  matches: Array<{ sideA: string[]; sideB: string[] }>,
  courts: Court[],
  history: History,
): ProposedMatch[] {
  /**
   * Score an arrangement by the players it treats worst, as a list of individual
   * imbalances sorted worst-first and compared lexicographically.
   *
   * Summing will not do, and the reason is subtle. When the round's matches
   * cover everyone — eight players on two courts, the commonest setup of all —
   * swapping the courts is a global mirror: every player's counts invert and any
   * symmetric total, sum or sum-of-squares alike, comes out identical. The
   * positional tie-break then picks the same arrangement every single round. One
   * real 8-player tournament left a player on the same court for all seven
   * rounds while everyone else sat at 4/3, and no sum could see it.
   *
   * Comparing worst-off player first breaks that symmetry: 7-1-1-1 loses to
   * 5-3-1-1 even though both sum to 10.
   */
  const arrangementProfile = (order: Court[]): number[] => {
    const imbalances: number[] = []

    matches.forEach((match, index) => {
      const assigned = order[index]
      for (const id of [...match.sideA, ...match.sideB]) {
        const counts = courts.map(
          (court) => history.courtCount(id, court.id) + (court.id === assigned.id ? 1 : 0),
        )
        imbalances.push(Math.max(...counts) - Math.min(...counts))
      }
    })

    return imbalances.sort((a, b) => b - a)
  }

  const build = (order: Court[]): ProposedMatch[] =>
    matches.map((match, index) => ({
      courtId: order[index].id,
      sideA: match.sideA,
      sideB: match.sideB,
    }))

  let chosen: Court[]

  if (courts.length <= EXHAUSTIVE_COURT_LIMIT) {
    // Cost every arrangement rather than choosing court by court: a per-match
    // greedy cannot see the round as a whole, and with two courts there is only
    // one decision to make anyway.
    let bestProfile: number[] | null = null
    chosen = courts

    for (const order of permutations(courts)) {
      const profile = arrangementProfile(order)
      if (bestProfile === null || lexCompare(profile, bestProfile) < 0) {
        bestProfile = profile
        chosen = order
      }
    }
  } else {
    // Too many courts to enumerate; place each match on whichever free court
    // leaves its players least lopsided.
    const free = [...courts]
    chosen = matches.map((match) => {
      let bestIndex = 0
      let bestKey: number[] | null = null

      free.forEach((court, index) => {
        const imbalances = [...match.sideA, ...match.sideB]
          .map((id) => {
            const counts = courts.map(
              (c) => history.courtCount(id, c.id) + (c.id === court.id ? 1 : 0),
            )
            return Math.max(...counts) - Math.min(...counts)
          })
          .sort((a, b) => b - a)

        const key = [...imbalances, court.position]
        if (bestKey === null || lexCompare(key, bestKey) < 0) {
          bestKey = key
          bestIndex = index
        }
      })

      return free.splice(bestIndex, 1)[0]
    })
  }

  return build(chosen).sort(
    (a, b) =>
      courts.findIndex((c) => c.id === a.courtId) - courts.findIndex((c) => c.id === b.courtId),
  )
}

export function pairAmericano(
  players: Participant[],
  courts: Court[],
  teamFormat: TeamFormat,
  history: History,
  tieBreak?: Map<string, number>,
): ProposedMatch[] {
  const perSide = participantsPerSide(teamFormat)
  const capacity = courts.length * perSide * 2
  const playing = players.slice(0, capacity)

  const order = tieBreak ?? new Map(playing.map((p) => [p.id, p.entryOrder]))
  const sides = formSides(playing, teamFormat, history, order)
  const matches = formMatches(sides, history, order, courts)
  return assignCourtsSpread(matches, courts, history)
}
