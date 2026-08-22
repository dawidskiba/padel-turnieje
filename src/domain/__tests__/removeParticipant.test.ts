/**
 * The line between removing a participant and retiring one.
 *
 * Retiring preserves points, which is only meaningful once a round has counted
 * someone. Before that — a no-show before round 1, a name added between rounds
 * and taken off again — retiring would leave RET in the standings with nothing
 * behind it, so removal has to be the offer instead.
 */

import { describe, expect, it } from 'vitest'

import { generateRound } from '../round'
import { hasRoundOnRecord } from '../types'
import { commit, courts, makeState, roster } from './factory'

describe('a participant with no round on record', () => {
  it('is removable before the first round', () => {
    const state = makeState({ participants: roster('Ann', 'Bob', 'Cara', 'Dan'), courts: courts(1) })

    for (const participant of state.participants) {
      expect(hasRoundOnRecord(state, participant.id)).toBe(false)
    }
  })

  it('stops being removable once a round has played them', () => {
    const before = makeState({
      participants: roster('Ann', 'Bob', 'Cara', 'Dan'),
      courts: courts(1),
    })
    const after = commit(before, generateRound(before, { isFinal: false }))

    expect(hasRoundOnRecord(after, 'ann')).toBe(true)
  })

  it('stops being removable once a round has rested them', () => {
    // Five players, one court: somebody sits out and still earns rest points.
    const before = makeState({
      participants: roster('Ann', 'Bob', 'Cara', 'Dan', 'Eve'),
      courts: courts(1),
    })
    const proposal = generateRound(before, { isFinal: false })
    const after = commit(before, proposal)

    expect(proposal.resting).toHaveLength(1)
    expect(hasRoundOnRecord(after, proposal.resting[0])).toBe(true)
  })

  it('stops being removable once a round has credited them for missing it', () => {
    const played = makeState({
      participants: roster('Ann', 'Bob', 'Cara', 'Dan'),
      courts: courts(1),
    })
    const state = commit(played, generateRound(played, { isFinal: false }))

    // A late joiner credited for the round they missed: points already counted.
    const credited = {
      ...state,
      rounds: state.rounds.map((round) => ({ ...round, credited: ['eve'] })),
    }

    expect(hasRoundOnRecord(credited, 'eve')).toBe(true)
  })

  it('is still removable when they joined after a round but have not played yet', () => {
    const played = makeState({
      participants: roster('Ann', 'Bob', 'Cara', 'Dan'),
      courts: courts(1),
    })
    const state = commit(played, generateRound(played, { isFinal: false }))

    // Added with the credit unchecked, so no round mentions them at all.
    expect(hasRoundOnRecord(state, 'eve')).toBe(false)
  })
})
