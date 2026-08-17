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
