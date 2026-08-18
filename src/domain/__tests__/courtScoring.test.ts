import { describe, expect, it } from 'vitest'

import { computeStandings } from '../standings'
import { courtBase, marginBonus, playedValue, restValue } from '../scoring'
import type { RoundScale } from '../scoring'
import { commit, courts, makeState, participant, roster } from './factory'
import { generateRound } from '../round'

const G = 21
const live: RoundScale = { courtCount: 2, neutral: false }
const opening: RoundScale = { courtCount: 2, neutral: true }

/** Every value a winner can earn on a court, across all legal scores. */
const winRange = (court: number, scale: RoundScale) =>
  Array.from({ length: 11 }, (_, i) => playedValue(court, 11 + i, G - (11 + i), G, scale))
const lossRange = (court: number, scale: RoundScale) =>
  Array.from({ length: 11 }, (_, i) => playedValue(court, G - (11 + i), 11 + i, G, scale))

describe('court-weighted scoring', () => {
  it('pays a demolition more than a squeaker, which raw tiers would not', () => {
    expect(playedValue(1, 21, 0, G, live)).toBe(14)
    expect(playedValue(1, 15, 6, G, live)).toBe(13)
    expect(playedValue(1, 11, 10, G, live)).toBe(12)
  })

  it('pays the losing side less the worse the beating', () => {
    expect(playedValue(1, 0, 21, G, live)).toBe(4)
    expect(playedValue(1, 10, 11, G, live)).toBe(6)
  })

  it('never lets a win on a weaker court beat a win on a stronger one', () => {
    // The whole reason the scheme exists: a player who never leaves the bottom
    // court must not out-earn one competing at the top.
    expect(Math.max(...winRange(2, live))).toBeLessThan(Math.min(...winRange(1, live)))
  })

  it('always lets a win one court down beat a loss one court up', () => {
    // Without this the ladder is a caste system and a bad opening draw is
    // unrecoverable — the fix for one unfairness creating another.
    expect(Math.min(...winRange(2, live))).toBeGreaterThan(Math.max(...lossRange(1, live)))
  })

  it('pays every court alike while the draw is still random', () => {
    expect(courtBase(1, opening)).toEqual(courtBase(2, opening))
    expect(playedValue(1, 15, 6, G, opening)).toBe(playedValue(2, 15, 6, G, opening))
  })

  it('still rewards the margin during those opening rounds', () => {
    expect(playedValue(2, 21, 0, G, opening)).toBeGreaterThan(playedValue(2, 11, 10, G, opening))
  })

  it('caps the margin, so a blowout cannot cross a court boundary', () => {
    expect(marginBonus(21, 0, G)).toBe(2)
    expect(marginBonus(0, 21, G)).toBe(-2)
    expect(marginBonus(11, 10, G)).toBe(0)
  })

  it('prices a rest in the middle of the scale', () => {
    const rest = restValue(live)
    expect(rest).toBe(7)
    expect(rest).toBeGreaterThan(Math.max(...lossRange(1, live)))
    expect(rest).toBeLessThan(Math.min(...winRange(2, live)))
  })

  it('holds its invariants at every court count', () => {
    for (const courtCount of [1, 2, 3, 4, 5, 6, 8]) {
      const scale = { courtCount, neutral: false }
      for (let court = 1; court < courtCount; court++) {
        expect(
          Math.max(...winRange(court + 1, scale)),
          `${courtCount} courts: a win on ${court + 1} beat a win on ${court}`,
        ).toBeLessThan(Math.min(...winRange(court, scale)))

        expect(
          Math.min(...winRange(court + 1, scale)),
          `${courtCount} courts: a win on ${court + 1} lost to a loss on ${court}`,
        ).toBeGreaterThan(Math.max(...lossRange(court, scale)))
      }
    }
  })

  it('never pays negative points, however many courts', () => {
    for (const courtCount of [1, 2, 4, 8]) {
      const scale = { courtCount, neutral: false }
      for (let court = 1; court <= courtCount; court++) {
        expect(Math.min(...lossRange(court, scale))).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('court scoring end to end', () => {
  /** The reported problem: a player who never leaves the weak court. */
  function twoTierTournament(scoring: 'points' | 'courts') {
    return makeState({
      participants: roster('Top1', 'Top2', 'Top3', 'Top4', 'Low1', 'Low2', 'Low3', 'Low4'),
      courts: courts(2),
      format: 'mexicano',
      pairingFormula: '1+4v2+3',
      scoring,
      neutralRounds: 0,
      rounds: [
        {
          number: 1,
          isFinal: false,
          // Kort 1 a one-point thriller; Kort 2 a demolition.
          matches: [
            { courtId: 'kort1', sideA: ['top1', 'top4'], sideB: ['top2', 'top3'], scoreA: 11, scoreB: 10 },
            { courtId: 'kort2', sideA: ['low1', 'low4'], sideB: ['low2', 'low3'], scoreA: 21, scoreB: 0 },
          ],
          resting: [],
          credited: [],
        },
      ],
    })
  }

  it('lets the weak-court winner top the table under raw points', () => {
    const rows = computeStandings(twoTierTournament('points'))
    expect(rows[0].name).toBe('Low1')
    expect(rows[0].points).toBe(21)
  })

  it('and stops them under court scoring', () => {
    const rows = computeStandings(twoTierTournament('courts'))
    const points = (n: string) => rows.find((r) => r.name === n)!.points

    // 21:0 on the weak court still pays less than 11:10 on the strong one.
    expect(points('Low1')).toBeLessThan(points('Top1'))
    expect(rows[0].name).toBe('Top1')
    // The blowout is still worth more than a narrow win on the same court.
    expect(points('Low1')).toBeGreaterThan(points('Low2'))
  })

  it('keeps raw points available for the tie-break', () => {
    const rows = computeStandings(twoTierTournament('courts'))
    const low1 = rows.find((r) => r.name === 'Low1')!
    expect(low1.rawPoints).toBe(21)
    expect(low1.points).not.toBe(21)
  })

  it('leaves raw-points tournaments completely untouched', () => {
    let state = makeState({
      participants: roster('A', 'B', 'C', 'D', 'E'),
      courts: courts(1),
      restPoints: 11,
    })
    state = commit(state, generateRound(state), () => 15)

    const rows = computeStandings(state)
    expect(rows.every((r) => r.points === r.rawPoints)).toBe(true)
    expect(rows[0].points).toBe(15)
  })

  it('prices a round by the courts that round used, not by today’s courts', () => {
    // Kort 3 removed after round 1. Round 1 must keep the three-court scale, or
    // removing a court would retroactively re-price a round already played.
    const state = makeState({
      participants: Array.from({ length: 12 }, (_, i) => participant(`P${i + 1}`, i + 1)),
      courts: courts(3),
      format: 'mexicano',
      pairingFormula: '1+4v2+3',
      scoring: 'courts',
      neutralRounds: 0,
      rounds: [
        {
          number: 1,
          isFinal: false,
          matches: [
            { courtId: 'kort1', sideA: ['p1', 'p4'], sideB: ['p2', 'p3'], scoreA: 11, scoreB: 10 },
            { courtId: 'kort2', sideA: ['p5', 'p8'], sideB: ['p6', 'p7'], scoreA: 11, scoreB: 10 },
            { courtId: 'kort3', sideA: ['p9', 'p12'], sideB: ['p10', 'p11'], scoreA: 11, scoreB: 10 },
          ],
          resting: [],
          credited: [],
        },
      ],
    })

    const rows = computeStandings(state)
    // Three courts: top-court win is 16, bottom-court win 8.
    expect(rows.find((r) => r.name === 'P1')!.points).toBe(16)
    expect(rows.find((r) => r.name === 'P9')!.points).toBe(8)
  })
})

/**
 * Court scoring exists twice — here and in the participant_round_points SQL view
 * — because Mexicano needs the ranking to build each round without a round trip,
 * while the public page reads the database. The numbers below are what the view
 * actually returned from Postgres 15 for these exact scenarios.
 */
describe('court scoring matches the SQL view', () => {
  function twoCourts(scoring: 'points' | 'courts', neutralRounds: number, rounds: number) {
    const round = (n: number) => ({
      number: n,
      isFinal: false,
      matches: [
        { courtId: 'kort1', sideA: ['a', 'd'], sideB: ['b', 'c'], scoreA: 11, scoreB: 10 },
        { courtId: 'kort2', sideA: ['e', 'h'], sideB: ['f', 'g'], scoreA: 21, scoreB: 0 },
      ],
      resting: [] as string[],
      credited: [] as string[],
    })

    return makeState({
      participants: roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'),
      courts: courts(2),
      format: 'mexicano',
      pairingFormula: '1+4v2+3',
      scoring,
      neutralRounds,
      rounds: Array.from({ length: rounds }, (_, i) => round(i + 1)),
    })
  }

  const points = (state: ReturnType<typeof twoCourts>) => {
    const rows = computeStandings(state)
    return (name: string) => rows.find((r) => r.name === name)!.points
  }

  it('prices one tiered round exactly as the view did', () => {
    // Kort 1 win 12, Kort 2 win 10, Kort 1 loss 6, Kort 2 loss 0.
    const p = points(twoCourts('courts', 0, 1))
    expect([p('A'), p('E'), p('B'), p('F')]).toEqual([12, 10, 6, 0])
  })

  it('prices a neutral first round then a tiered second, as the view did', () => {
    // A: neutral win 10, then Kort 1 win 12 = 22
    // E: neutral win 10 + margin 2 = 12, then Kort 2 win 10 = 22
    const p = points(twoCourts('courts', 1, 2))
    expect([p('A'), p('E'), p('B'), p('F')]).toEqual([22, 22, 10, 2])
  })

  it('leaves the points scheme identical to the raw score, as the view did', () => {
    const p = points(twoCourts('points', 1, 1))
    expect([p('A'), p('E')]).toEqual([11, 21])
  })

  it('separates them again once the tournament runs long enough', () => {
    // The two-round tie above is an artefact of length: the neutral round's
    // margin bonus offsets one round of court advantage. Over five it does not.
    const p = points(twoCourts('courts', 1, 5))
    expect(p('A')).toBe(10 + 4 * 12)
    expect(p('E')).toBe(12 + 4 * 10)
    expect(p('A')).toBeGreaterThan(p('E'))
  })
})
