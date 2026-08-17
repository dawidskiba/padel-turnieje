import { describe, expect, it } from 'vitest'

import { historyOf } from '../history'
import { generateRound } from '../round'
import { commit, courts, makeState, participant, roster } from './factory'
import type { TournamentState } from '../types'

function partnershipsIn(state: TournamentState): string[][] {
  return state.rounds.flatMap((round) =>
    round.matches.flatMap((m) => [m.sideA, m.sideB]),
  )
}

describe('americano pairing', () => {
  it('gives everyone a different partner while unused partners remain', () => {
    // 8 players, 2 courts. Each player has 7 possible partners, so the first
    // seven rounds should contain no repeat at all.
    let state = makeState({ participants: roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'), courts: courts(2) })

    for (let i = 0; i < 7; i++) {
      state = commit(state, generateRound(state))
    }

    const seen = new Set<string>()
    for (const side of partnershipsIn(state)) {
      const key = [...side].sort().join('|')
      expect(seen.has(key), `repeated partnership ${key}`).toBe(false)
      seen.add(key)
    }
    expect(seen.size).toBe(7 * 2 * 2)
  })

  it('prefers opponents faced least often', () => {
    let state = makeState({ participants: roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'), courts: courts(2) })
    for (let i = 0; i < 7; i++) {
      state = commit(state, generateRound(state))
    }

    const history = historyOf(state)
    const ids = state.participants.map((p) => p.id)
    const counts: number[] = []
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) counts.push(history.opponentCount(ids[i], ids[j]))
    }

    // Nobody should have faced anyone dramatically more often than anyone else.
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2)
  })

  it('spreads players across courts instead of parking them on one', () => {
    const participants = Array.from({ length: 16 }, (_, i) => participant(`P${i + 1}`, i + 1))
    let state = makeState({ participants, courts: courts(4) })

    for (let i = 0; i < 8; i++) {
      state = commit(state, generateRound(state))
    }

    const history = historyOf(state)
    for (const p of participants) {
      const perCourt = state.courts.map((c) => history.courtCount(p.id, c.id))
      // 8 rounds over 4 courts: a fair spread is 2 each. Nobody should be stuck.
      expect(Math.max(...perCourt), `${p.name} stuck on one court`).toBeLessThanOrEqual(4)
    }
  })

  it('fills every court and places every playing participant exactly once', () => {
    const participants = Array.from({ length: 18 }, (_, i) => participant(`P${i + 1}`, i + 1))
    const state = makeState({ participants, courts: courts(4) })
    const proposal = generateRound(state)

    expect(proposal.matches).toHaveLength(4)

    const placed = proposal.matches.flatMap((m) => [...m.sideA, ...m.sideB])
    expect(placed).toHaveLength(16)
    expect(new Set(placed).size).toBe(16)
    expect(new Set([...placed, ...proposal.resting]).size).toBe(18)

    for (const match of proposal.matches) {
      expect(match.sideA).toHaveLength(2)
      expect(match.sideB).toHaveLength(2)
    }
  })

  it('is deterministic — the same state produces the same round', () => {
    const state = makeState({ participants: roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'), courts: courts(2) })
    expect(generateRound(state)).toEqual(generateRound(state))
  })

  it('puts one team per side in teams format, and never splits a team', () => {
    const state = makeState({
      participants: roster('Ann & Bob', 'Cara & Dan', 'Ewa & Fred', 'Gus & Hana'),
      courts: courts(2),
      teamFormat: 'teams',
    })
    const proposal = generateRound(state)

    expect(proposal.matches).toHaveLength(2)
    for (const match of proposal.matches) {
      expect(match.sideA).toHaveLength(1)
      expect(match.sideB).toHaveLength(1)
    }
  })

  it('rotates opponents in teams format', () => {
    let state = makeState({
      participants: roster('T1', 'T2', 'T3', 'T4'),
      courts: courts(2),
      teamFormat: 'teams',
    })
    for (let i = 0; i < 3; i++) state = commit(state, generateRound(state))

    const history = historyOf(state)
    // Four teams, three rounds: a full round robin, everyone meets everyone once.
    const ids = ['t1', 't2', 't3', 't4']
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        expect(history.opponentCount(ids[i], ids[j])).toBe(1)
      }
    }
  })
})
