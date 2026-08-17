import { describe, expect, it } from 'vitest'

import { historyOf } from '../history'
import { checkRestBalance, chooseResting } from '../rota'
import { generateRound } from '../round'
import { matchCount } from '../types'
import { commit, court, courts, makeState, participant, roster } from './factory'

const EIGHTEEN = Array.from({ length: 18 }, (_, i) => participant(`P${i + 1}`, i + 1))

describe('rest rota', () => {
  it('rests exactly the leftover participants', () => {
    // 18 players, 4 courts: 16 play, 2 rest
    const state = makeState({ participants: EIGHTEEN, courts: courts(4) })
    expect(matchCount(state, 1)).toBe(4)
    expect(chooseResting(state, 1)).toHaveLength(2)
  })

  it('rests nobody when the roster fills the courts exactly', () => {
    const state = makeState({ participants: EIGHTEEN.slice(0, 16), courts: courts(4) })
    expect(chooseResting(state, 1)).toEqual([])
  })

  it('is limited by courts as well as by roster', () => {
    // 16 players but only 2 courts: 8 play, 8 rest
    const state = makeState({ participants: EIGHTEEN.slice(0, 16), courts: courts(2) })
    expect(matchCount(state, 1)).toBe(2)
    expect(chooseResting(state, 1)).toHaveLength(8)
  })

  it('gives everyone one rest before anyone gets a second', () => {
    let state = makeState({ participants: EIGHTEEN, courts: courts(4) })

    // 18 players resting 2 per round: 9 rounds to give everyone exactly one.
    for (let i = 0; i < 9; i++) {
      state = commit(state, generateRound(state))
    }

    const history = historyOf(state)
    const counts = EIGHTEEN.map((p) => history.restCount(p.id))
    expect(counts.every((c) => c === 1)).toBe(true)
  })

  it('never lets rest counts differ by more than one, over a long tournament', () => {
    // 22 players, 4 courts: 6 rest per round, which never divides evenly.
    const participants = Array.from({ length: 22 }, (_, i) => participant(`P${i + 1}`, i + 1))
    let state = makeState({ participants, courts: courts(4) })

    for (let i = 0; i < 15; i++) {
      state = commit(state, generateRound(state))
    }

    const history = historyOf(state)
    const counts = participants.map((p) => history.restCount(p.id))
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })

  it('flags an override that unbalances the counts, without blocking it', () => {
    let state = makeState({ participants: EIGHTEEN, courts: courts(4) })
    const first = generateRound(state)
    state = commit(state, first)

    // Resting the same two people again, when nobody else has rested at all.
    const unbalanced = checkRestBalance(state, 2, first.resting)
    expect(unbalanced.balanced).toBe(false)
    expect(unbalanced.spread).toBe(2)

    const balanced = checkRestBalance(state, 2, chooseResting(state, 2))
    expect(balanced.balanced).toBe(true)
  })

  it('excludes a retired participant from the rota', () => {
    const participants = EIGHTEEN.map((p, i) => (i === 0 ? { ...p, retiredAfterRound: 1 } : p))
    const state = makeState({ participants, courts: courts(4) })

    // 17 active, 4 courts -> only 4 matches' worth (16) can play, 1 rests
    expect(chooseResting(state, 2)).toHaveLength(1)
    expect(chooseResting(state, 2)).not.toContain(participants[0].id)
  })

  it('rests more people once a court is removed', () => {
    const state = makeState({
      participants: EIGHTEEN,
      courts: [court('Kort 1', 1), court('Kort 2', 2), court('Kort 3', 3, { removedFromRound: 4 })],
    })

    expect(chooseResting(state, 3)).toHaveLength(18 - 12)
    expect(chooseResting(state, 4)).toHaveLength(18 - 8)
  })

  it('keeps pinned participants on court when the rota allows', () => {
    const participants = roster('Ann', 'Bob', 'Cara', 'Dan', 'Ewa')
    // Ann is first in entry order, so the plain rota would rest her.
    participants[0].seedCourtId = 'kort1'

    const state = makeState({
      participants,
      courts: courts(1),
      format: 'mexicano',
      pairingFormula: '1+4v2+3',
    })

    const proposal = generateRound(state)
    expect(proposal.resting).not.toContain('ann')
  })
})
