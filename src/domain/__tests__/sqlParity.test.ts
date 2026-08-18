import { describe, expect, it } from 'vitest'

import { computeStandings } from '../standings'
import { commit, courts, makeState, roster } from './factory'
import { generateRound } from '../round'

/**
 * The standings exist twice: as the `standings` SQL view that feeds the public
 * page, and as computeStandings() which Mexicano reads to build each round.
 * They must not drift.
 *
 * The expected numbers below are not hand-derived — they are the actual output
 * of public_tournament() against Postgres 15 for exactly this scenario:
 *
 *   5 players, 1 court, 21 game points, 11 rest points
 *   round 1: Ann + Dan  15 : 6  Bob + Cara,  Iga resting
 *
 *   Ann   15 pts  +9   1-0-0
 *   Dan   15 pts  +9   1-0-0
 *   Iga   11 pts   0   0-0-0
 *   Bob    6 pts  -9   0-0-1
 *   Cara   6 pts  -9   0-0-1
 *
 * If this test fails, one of the two implementations has moved and the public
 * page is now telling players something the desk disagrees with.
 */
describe('domain standings match the SQL view', () => {
  it('reproduces the database output for a scored round with one rest', () => {
    const state = makeState({
      participants: roster('Ann', 'Bob', 'Cara', 'Dan', 'Iga'),
      courts: courts(1),
      gamePoints: 21,
      restPoints: 11,
      rounds: [
        {
          number: 1,
          isFinal: false,
          matches: [
            {
              courtId: 'kort1',
              sideA: ['ann', 'dan'],
              sideB: ['bob', 'cara'],
              scoreA: 15,
              scoreB: 6,
            },
          ],
          resting: ['iga'],
          credited: [],
        },
      ],
    })

    expect(
      computeStandings(state).map((row) => ({
        name: row.name,
        points: row.points,
        difference: row.difference,
        record: `${row.wins}-${row.draws}-${row.losses}`,
      })),
    ).toEqual([
      { name: 'Ann', points: 15, difference: 9, record: '1-0-0' },
      { name: 'Dan', points: 15, difference: 9, record: '1-0-0' },
      { name: 'Iga', points: 11, difference: 0, record: '0-0-0' },
      { name: 'Bob', points: 6, difference: -9, record: '0-0-1' },
      { name: 'Cara', points: 6, difference: -9, record: '0-0-1' },
    ])
  })

  it('keeps the total conserved across a whole tournament', () => {
    // A match splits gamePoints between the two *sides*, but standings are per
    // participant and both partners bank their side's score in full. So an
    // individual match of 21 distributes 42 participant-points, not 21 — the
    // pool is multiplied by the number of players on a side.
    const ROUNDS = 6
    const GAME_POINTS = 21
    const REST_POINTS = 11
    const PER_SIDE = 2

    let state = makeState({
      participants: roster('A', 'B', 'C', 'D', 'E', 'F'),
      courts: courts(1),
      gamePoints: GAME_POINTS,
      restPoints: REST_POINTS,
    })

    for (let i = 0; i < ROUNDS; i++) {
      state = commit(state, generateRound(state), () => 13)
    }

    const matches = state.rounds.reduce((n, round) => n + round.matches.length, 0)
    const rests = state.rounds.reduce((n, round) => n + round.resting.length, 0)
    const total = computeStandings(state).reduce((sum, row) => sum + row.points, 0)

    expect(total).toBe(matches * GAME_POINTS * PER_SIDE + rests * REST_POINTS)
  })
})

/**
 * A rest and a credited round pay different amounts, computed in two places: the
 * `participant_round_points` SQL view and computeStandings. The expected values
 * are the actual output of that view against Postgres 15 for this scenario:
 *
 *   5 players, 1 court, 21 game points, 11 rest points
 *   round 1: A + B  15 : 6  C + D,  Rester resting
 *   Joiner added afterwards, credited for round 1
 *
 *   Rester  11 pts   (turned up, no court)
 *   Joiner  10 pts   (was not there)
 */
describe('a rest and a missed round are priced differently', () => {
  it('reproduces the database on both', () => {
    const participants = [
      ...roster('A', 'B', 'C', 'D', 'Rester'),
      { ...roster('Joiner')[0], id: 'joiner', entryOrder: 6, joinedRound: 2 },
    ]

    const state = makeState({
      participants,
      courts: courts(1),
      gamePoints: 21,
      restPoints: 11,
      rounds: [
        {
          number: 1,
          isFinal: false,
          matches: [
            { courtId: 'kort1', sideA: ['a', 'b'], sideB: ['c', 'd'], scoreA: 15, scoreB: 6 },
          ],
          resting: ['rester'],
          credited: ['joiner'],
        },
      ],
    })

    const rows = computeStandings(state)
    const points = (name: string) => rows.find((r) => r.name === name)!.points

    expect(points('Rester')).toBe(11)
    expect(points('Joiner')).toBe(10)
    // Neither moves point difference: both land on scored and conceded alike.
    expect(rows.find((r) => r.name === 'Rester')!.difference).toBe(0)
    expect(rows.find((r) => r.name === 'Joiner')!.difference).toBe(0)
  })

  it('caps the credit at the rest value, as the view does with least()', () => {
    // rest_points 3 on a 21-point target: floor(21/2) is 10, but a missed round
    // must not beat turning up, so both pay 3.
    const state = makeState({
      participants: [
        ...roster('A', 'B', 'C', 'D', 'Rester'),
        { ...roster('Joiner')[0], id: 'joiner', entryOrder: 6, joinedRound: 2 },
      ],
      courts: courts(1),
      gamePoints: 21,
      restPoints: 3,
      rounds: [
        {
          number: 1,
          isFinal: false,
          matches: [
            { courtId: 'kort1', sideA: ['a', 'b'], sideB: ['c', 'd'], scoreA: 15, scoreB: 6 },
          ],
          resting: ['rester'],
          credited: ['joiner'],
        },
      ],
    })

    const rows = computeStandings(state)
    expect(rows.find((r) => r.name === 'Rester')!.points).toBe(3)
    expect(rows.find((r) => r.name === 'Joiner')!.points).toBe(3)
  })
})
