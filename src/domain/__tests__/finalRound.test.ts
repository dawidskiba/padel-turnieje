import { describe, expect, it } from 'vitest'

import { generateRound } from '../round'
import { computeStandings } from '../standings'
import { commit, courts, makeState, roster } from './factory'

describe('final round', () => {
  it('seeds an Americano final by the standings, putting the contenders on Kort 1', () => {
    let state = makeState({
      participants: roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'),
      courts: courts(2),
    })
    for (let i = 0; i < 3; i++) {
      state = commit(state, generateRound(state), (m) => 21 - m * 6)
    }

    const ranked = computeStandings(state).map((r) => r.participantId)
    const final = generateRound(state, { isFinal: true })

    expect(final.isFinal).toBe(true)

    const kort1 = final.matches.find((m) => m.courtId === 'kort1')!
    expect([...kort1.sideA, ...kort1.sideB].sort()).toEqual(ranked.slice(0, 4).sort())

    // Applied literally: 1+4 v 2+3, no repeat avoidance.
    expect(kort1.sideA.sort()).toEqual([ranked[0], ranked[3]].sort())
    expect(kort1.sideB.sort()).toEqual([ranked[1], ranked[2]].sort())
  })

  it('waives partner variety for that one round only', () => {
    // Drive the table so the top four have already partnered each other, then
    // check the final still groups them by rank rather than by freshness.
    let state = makeState({
      participants: roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'),
      courts: courts(2),
    })
    for (let i = 0; i < 5; i++) {
      state = commit(state, generateRound(state), (m) => 21 - m * 6)
    }

    const ranked = computeStandings(state).map((r) => r.participantId)
    const kort1 = generateRound(state, { isFinal: true }).matches.find(
      (m) => m.courtId === 'kort1',
    )!

    expect([...kort1.sideA, ...kort1.sideB].sort()).toEqual(ranked.slice(0, 4).sort())
  })

  it('pairs adjacent ranks for a teams final', () => {
    let state = makeState({
      participants: roster('T1', 'T2', 'T3', 'T4'),
      courts: courts(2),
      teamFormat: 'teams',
    })
    state = commit(state, generateRound(state), (m) => (m === 0 ? 21 : 12))

    const ranked = computeStandings(state).map((r) => r.participantId)
    const final = generateRound(state, { isFinal: true })

    expect(final.matches[0].sideA[0]).toBe(ranked[0])
    expect(final.matches[0].sideB[0]).toBe(ranked[1])
  })

  it('is a normal Mexicano round — the ladder already supplies the finale', () => {
    let state = makeState({
      participants: roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'),
      courts: courts(2),
      format: 'mexicano',
      pairingFormula: '1+4v2+3',
    })
    state = commit(state, generateRound(state), (m) => 21 - m * 6)
    state = commit(state, generateRound(state), (m) => 21 - m * 6)

    const normal = generateRound(state)
    const final = generateRound(state, { isFinal: true })

    expect(final.matches).toEqual(normal.matches)
    expect(final.isFinal).toBe(true)
  })
})
