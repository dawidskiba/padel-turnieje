import { describe, expect, it } from 'vitest'

import { historyOf } from '../history'
import { generateRound } from '../round'
import { commit, courts, makeState, participant } from './factory'
import type { TournamentState } from '../types'

/**
 * The shape that broke in a real tournament: 9 players on 2 courts, so 8 play
 * and 1 rests, and the set of available players rotates every round.
 *
 * Greedy pairing coped fine with 8-on-2 (the earlier tests) because a clean
 * rotation exists there. With an odd player out it strands the last two
 * players together, and F+G and H+I each ended up partnered twice while
 * dozens of fresh pairings were still unused. Court assignment failed the same
 * way: two players spent every single round on Kort 1.
 */
function nineOnTwo(): TournamentState {
  return makeState({
    participants: Array.from({ length: 9 }, (_, i) =>
      participant(String.fromCharCode(65 + i), i + 1),
    ),
    courts: courts(2),
  })
}

function play(rounds: number): TournamentState {
  let state = nineOnTwo()
  for (let i = 0; i < rounds; i++) {
    state = commit(state, generateRound(state), (m) => [13, 15, 4, 10][m % 4])
  }
  return state
}

describe('9 players on 2 courts', () => {
  it('never repeats a partnership while fresh ones remain', () => {
    // 4 rounds x 4 pairs = 16 partnerships drawn from 36 possible.
    const state = play(4)
    const history = historyOf(state)
    const ids = state.participants.map((p) => p.id)

    const repeated: string[] = []
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const count = history.partnerCount(ids[i], ids[j])
        if (count > 1) repeated.push(`${ids[i]}+${ids[j]} x${count}`)
      }
    }

    expect(repeated).toEqual([])
  })

  it('holds up over a long evening too', () => {
    // 8 rounds = 32 pairings from 36 possible: repeats become unavoidable near
    // the end, but should stay at exactly one extra rather than piling up.
    const state = play(8)
    const history = historyOf(state)
    const ids = state.participants.map((p) => p.id)

    let worst = 0
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        worst = Math.max(worst, history.partnerCount(ids[i], ids[j]))
      }
    }

    expect(worst).toBeLessThanOrEqual(2)
  })

  it('does not park anyone on a single court', () => {
    // This is the guarantee the requirements actually make, and the one that
    // broke: a player spent every round of a real tournament on Kort 1, never
    // seeing the other court at all.
    const state = play(4)
    const history = historyOf(state)

    for (const p of state.participants) {
      const perCourt = state.courts.map((c) => history.courtCount(p.id, c.id))
      const played = perCourt.reduce((a, b) => a + b, 0)
      if (played < 2) continue

      const courtsSeen = perCourt.filter((n) => n > 0).length
      expect(courtsSeen, `${p.name} only ever on ${JSON.stringify(perCourt)}`).toBeGreaterThan(1)
    }
  })

  it('keeps court usage roughly even, without overriding pairing priorities', () => {
    // Court spread is priority 3, below partner variety and opponent freshness
    // (requirements-americano.md §2.2). Perfect balance is reachable only by
    // trading those away, so the honest promise is "bounded", not "equal" —
    // and it tightens as the evening goes on rather than drifting.
    const state = play(8)
    const history = historyOf(state)

    for (const p of state.participants) {
      const perCourt = state.courts.map((c) => history.courtCount(p.id, c.id))
      const imbalance = Math.max(...perCourt) - Math.min(...perCourt)
      expect(imbalance, `${p.name} on ${JSON.stringify(perCourt)}`).toBeLessThanOrEqual(2)
    }
  })

  it('still rests everyone evenly', () => {
    const state = play(9)
    const history = historyOf(state)
    const counts = state.participants.map((p) => history.restCount(p.id))
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })
})
