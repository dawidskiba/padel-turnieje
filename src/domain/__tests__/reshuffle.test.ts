import { describe, expect, it } from 'vitest'

import { historyOf } from '../history'
import { generateRound } from '../round'
import { commit, courts, makeState, participant, roster } from './factory'
import type { ProposedRound, TournamentState } from '../types'

function fingerprint(round: ProposedRound): string {
  return round.matches
    .map((m) => `${m.courtId}:${[...m.sideA].sort().join('')}v${[...m.sideB].sort().join('')}`)
    .join('|')
}

function eight(): TournamentState {
  return makeState({
    participants: roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'),
    courts: courts(2),
  })
}

describe('reshuffling a proposed round', () => {
  it('is repeatable without a variant, so the first proposal is stable', () => {
    const state = eight()
    expect(fingerprint(generateRound(state))).toEqual(fingerprint(generateRound(state)))
  })

  it('produces a different arrangement when the variant changes', () => {
    // The reported bug: discarding and regenerating gave the identical round,
    // because entry order broke every tie the same way each time.
    const state = eight()
    const first = fingerprint(generateRound(state, { variant: 0 }))

    const others = [1, 2, 3, 4, 5].map((variant) =>
      fingerprint(generateRound(state, { variant })),
    )

    expect(others.some((f) => f !== first)).toBe(true)
  })

  it('gives the same variant the same answer twice', () => {
    const state = eight()
    expect(fingerprint(generateRound(state, { variant: 3 }))).toEqual(
      fingerprint(generateRound(state, { variant: 3 })),
    )
  })

  it('keeps the pairing priorities intact across variants', () => {
    // Reshuffling must only move ties. After a round where everyone has
    // partnered once, no variant may recreate one of those partnerships while
    // fresh pairings remain.
    let state = eight()
    state = commit(state, generateRound(state), () => 13)

    const history = historyOf(state)
    for (const variant of [0, 1, 2, 3, 4, 5]) {
      const proposal = generateRound(state, { variant })
      for (const match of proposal.matches) {
        for (const side of [match.sideA, match.sideB]) {
          expect(
            history.partnerCount(side[0], side[1]),
            `variant ${variant} reused ${side.join('+')}`,
          ).toBe(0)
        }
      }
    }
  })

  it('respects an overridden rest list while reshuffling', () => {
    // 9 players, 2 courts: one rests. The organiser picked who; a reshuffle of
    // the pairings must not quietly put them back on court.
    const state = makeState({
      participants: Array.from({ length: 9 }, (_, i) =>
        participant(String.fromCharCode(65 + i), i + 1),
      ),
      courts: courts(2),
    })

    for (const variant of [1, 2, 3]) {
      const proposal = generateRound(state, { resting: ['e'], variant })
      expect(proposal.resting).toEqual(['e'])
      expect(proposal.matches.flatMap((m) => [...m.sideA, ...m.sideB])).not.toContain('e')
    }
  })

  it('redraws a Mexicano first round on reshuffle', () => {
    const state = makeState({
      participants: roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'),
      courts: courts(2),
      format: 'mexicano',
      pairingFormula: '1+4v2+3',
    })

    const draws = [1, 2, 3, 4].map((variant) => fingerprint(generateRound(state, { variant })))
    expect(new Set(draws).size).toBeGreaterThan(1)
  })
})
