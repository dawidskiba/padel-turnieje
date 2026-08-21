import { describe, expect, it } from 'vitest'

import { historyOf } from '../history'
import { generateRound } from '../round'
import { checkRestBalance } from '../rota'
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

  /**
   * The rota is rank-blind by design, which is right for every round but the
   * last. Seen in an 18-player Americano: the runner-up was rested for the
   * final and banked rest points while the leader played Kort 1 and won it.
   * Five on one court reproduces it in miniature — the plain rota rests the
   * leader out of the decider.
   */
  it('rests the lowest-placed of the equally-rested, not the rota order', () => {
    let state = makeState({
      participants: roster('A', 'B', 'C', 'D', 'E'),
      courts: courts(1),
    })
    for (let i = 0; i < 5; i++) {
      state = commit(state, generateRound(state), (m) => 21 - m * 6)
    }

    const history = historyOf(state)
    const ranked = computeStandings(state).map((r) => r.participantId)
    const fewest = Math.min(...ranked.map((id) => history.restCount(id)))
    const candidates = ranked.filter((id) => history.restCount(id) === fewest)

    const final = generateRound(state, { isFinal: true })

    expect(final.resting).toEqual([candidates[candidates.length - 1]])
    // The leader plays the decider — the whole point of the rule.
    expect(final.resting).not.toContain(ranked[0])
  })

  it('keeps rest counts within one while doing it', () => {
    let state = makeState({
      participants: roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'),
      courts: courts(2),
    })
    for (let i = 0; i < 6; i++) {
      state = commit(state, generateRound(state), (m) => 21 - m * 6)
    }

    const final = generateRound(state, { isFinal: true })
    expect(checkRestBalance(state, final.number, final.resting).balanced).toBe(true)
  })

  it('leaves the ordinary rota rank-blind', () => {
    let state = makeState({
      participants: roster('A', 'B', 'C', 'D', 'E'),
      courts: courts(1),
    })
    for (let i = 0; i < 5; i++) {
      state = commit(state, generateRound(state), (m) => 21 - m * 6)
    }

    const history = historyOf(state)
    const byRota = [...state.participants].sort(
      (a, b) =>
        history.restCount(a.id) - history.restCount(b.id) ||
        history.lastRestedRound(a.id) - history.lastRestedRound(b.id) ||
        a.entryOrder - b.entryOrder,
    )[0].id

    expect(generateRound(state).resting).toEqual([byRota])
    // And that rota pick is *not* what the final round would have chosen.
    expect(generateRound(state, { isFinal: true }).resting).not.toEqual([byRota])
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
