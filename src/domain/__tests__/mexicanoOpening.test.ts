import { describe, expect, it } from 'vitest'

import { historyOf } from '../history'
import { generateRound } from '../round'
import { computeStandings } from '../standings'
import { commit, courts, makeState, roster, seededRng } from './factory'
import type { ProposedRound, TournamentState } from '../types'

/**
 * Mexicano opening rounds: mixed by Americano's rules before the ladder starts,
 * so the Standing the ladder reads has more than one lucky draw behind it.
 */
function eight(openingRounds: number): TournamentState {
  return makeState({
    participants: roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'),
    courts: courts(2),
    format: 'mexicano',
    pairingFormula: '1+4v2+3',
    openingRounds,
  })
}

/** Kort 1 wins big, Kort 2 is close — so the standing separates quickly. */
const lopsided = (index: number) => (index === 0 ? 18 : 11)

function play(state: TournamentState, rounds: number): TournamentState {
  for (let i = 0; i < rounds; i++) {
    state = commit(state, generateRound(state, { rng: seededRng(i + 1) }), lopsided)
  }
  return state
}

function topCourt(round: ProposedRound): string[] {
  const match = round.matches.find((m) => m.courtId === 'kort1')!
  return [...match.sideA, ...match.sideB].sort()
}

function leaders(state: TournamentState): string[] {
  return computeStandings(state)
    .slice(0, 4)
    .map((row) => row.participantId)
    .sort()
}

describe('mexicano opening rounds', () => {
  it('starts the ladder in round 2 by default, as classic Mexicano does', () => {
    const state = play(eight(1), 1)
    expect(topCourt(generateRound(state))).toEqual(leaders(state))
  })

  it('repeats no partnership during the opening rounds', () => {
    let state = eight(3)
    for (let round = 1; round <= 3; round++) {
      const history = historyOf(state)
      const proposal = generateRound(state, { rng: seededRng(round) })
      for (const match of proposal.matches) {
        for (const side of [match.sideA, match.sideB]) {
          expect(history.partnerCount(side[0], side[1])).toBe(0)
        }
      }
      state = commit(state, proposal, lopsided)
    }
  })

  it('does not follow the standing until the opening rounds are over', () => {
    const afterOne = play(eight(3), 1)
    // Round 1's Kort 1 winners lead; the ladder would put the leaders together.
    // An opening round mixes them instead, so they cannot all four meet again.
    expect(topCourt(generateRound(afterOne))).not.toEqual(leaders(afterOne))

    const afterThree = play(eight(3), 3)
    expect(topCourt(generateRound(afterThree))).toEqual(leaders(afterThree))
  })

  it('still seeds a final round from the standing, even inside the opening rounds', () => {
    const state = play(eight(3), 1)
    expect(topCourt(generateRound(state, { isFinal: true }))).toEqual(leaders(state))
  })
})
