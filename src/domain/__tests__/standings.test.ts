import { describe, expect, it } from 'vitest'

import { computeStandings } from '../standings'
import { commit, courts, makeState, roster } from './factory'
import { generateRound } from '../round'

describe('standings', () => {
  it('sums points scored, and a match always splits the game points target', () => {
    const state = makeState({ participants: roster('Ann', 'Bob', 'Cara', 'Dan'), courts: courts(1) })
    const played = commit(state, generateRound(state), () => 15)

    const rows = computeStandings(played)
    const total = rows.reduce((sum, r) => sum + r.points, 0)
    // two players on 15, two on 6
    expect(total).toBe(2 * 15 + 2 * 6)
    expect(rows[0].points).toBe(15)
    expect(rows[3].points).toBe(6)
  })

  it('leaves point difference untouched for a rested round', () => {
    // 5 players, 1 court: one rests every round.
    const state = makeState({
      participants: roster('Ann', 'Bob', 'Cara', 'Dan', 'Ewa'),
      courts: courts(1),
      gamePoints: 21,
      restPoints: 11,
    })
    const played = commit(state, generateRound(state), () => 15)

    const rested = computeStandings(played).find((r) => r.rests === 1)!
    expect(rested.points).toBe(11)
    // Rest points land on both scored and conceded, so difference stays neutral.
    // Crediting only "scored" would give every resting player +11 difference.
    expect(rested.difference).toBe(0)
  })

  it('does not count a rest as a win, a draw or a loss', () => {
    const state = makeState({
      participants: roster('Ann', 'Bob', 'Cara', 'Dan', 'Ewa'),
      courts: courts(1),
    })
    const played = commit(state, generateRound(state), () => 15)

    const rested = computeStandings(played).find((r) => r.rests === 1)!
    expect([rested.wins, rested.draws, rested.losses]).toEqual([0, 0, 0])
  })

  it('records a level score as a draw, not a win', () => {
    const state = makeState({
      participants: roster('Ann', 'Bob', 'Cara', 'Dan'),
      courts: courts(1),
      gamePoints: 16,
    })
    const played = commit(state, generateRound(state), () => 8)

    for (const row of computeStandings(played)) {
      expect(row.draws).toBe(1)
      expect(row.wins).toBe(0)
      expect(row.losses).toBe(0)
    }
  })

  it('credits a late joiner less than a rest, and not as a rest', () => {
    const state = makeState({
      participants: roster('Ann', 'Bob', 'Cara', 'Dan'),
      courts: courts(1),
      restPoints: 11,
    })
    const played = commit(state, generateRound(state), () => 15)

    const withJoiner = {
      ...played,
      participants: [
        ...played.participants,
        { ...roster('Ewa')[0], id: 'ewa', entryOrder: 5, joinedRound: 2 },
      ],
      rounds: played.rounds.map((r) => ({ ...r, credited: ['ewa'] })),
    }

    const ewa = computeStandings(withJoiner).find((r) => r.participantId === 'ewa')!
    // 10, not 11: a round somebody was not present for pays less than a rest.
    expect(ewa.points).toBe(10)
    // Not a rest: otherwise the rota would think Ewa is the most-rested player
    // in the tournament and schedule her to play every remaining round.
    expect(ewa.rests).toBe(0)
  })

  it('orders by points, then difference, then wins, then entry order', () => {
    const participants = roster('Ann', 'Bob', 'Cara', 'Dan')
    const state = makeState({
      participants,
      courts: courts(1),
      rounds: [
        {
          number: 1,
          isFinal: false,
          matches: [
            { courtId: 'kort1', sideA: ['ann', 'bob'], sideB: ['cara', 'dan'], scoreA: 21, scoreB: 0 },
          ],
          resting: [],
          credited: [],
        },
        {
          number: 2,
          isFinal: false,
          matches: [
            { courtId: 'kort1', sideA: ['ann', 'cara'], sideB: ['bob', 'dan'], scoreA: 0, scoreB: 21 },
          ],
          resting: [],
          credited: [],
        },
      ],
    })

    const rows = computeStandings(state)
    // Ann 21, Bob 42, Cara 0, Dan 21 -> Bob first
    expect(rows.map((r) => r.name)).toEqual(['Bob', 'Ann', 'Dan', 'Cara'])
    // Ann and Dan are level on points, difference and wins, so they share a rank
    expect(rows[1].position).toBe(2)
    expect(rows[2].position).toBe(2)
    // standard competition ranking skips after a tie
    expect(rows[3].position).toBe(4)
  })

  it('keeps a retired participant in the table with the points they earned', () => {
    const participants = roster('Ann', 'Bob', 'Cara', 'Dan', 'Ewa')
    participants[4].retiredAfterRound = 1

    const state = makeState({ participants, courts: courts(1) })
    const played = commit(state, generateRound(state), () => 15)

    const ewa = computeStandings(played).find((r) => r.name === 'Ewa')!
    expect(ewa.retired).toBe(true)
    expect(ewa.points).toBeGreaterThan(0)
  })
})
