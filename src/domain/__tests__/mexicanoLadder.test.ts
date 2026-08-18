import { describe, expect, it } from 'vitest'

import { generateRound } from '../round'
import { computeStandings } from '../standings'
import { commit, courts, makeState, participant, seededRng } from './factory'
import type { TournamentState } from '../types'

/**
 * The court ladder is the point of Mexicano, not a side effect.
 *
 * Ranks 1–4 play Kort 1, 5–8 Kort 2, 9–12 Kort 3, every round. Staying on Kort 1
 * while you stay in the top four is the *intended* behaviour — the exact
 * opposite of Americano, which deliberately spreads players across courts. These
 * tests exist so an improvement to one never leaks into the other.
 */
function twelveOnThree(): TournamentState {
  return makeState({
    participants: Array.from({ length: 12 }, (_, i) => participant(`P${i + 1}`, i + 1)),
    courts: courts(3),
    format: 'mexicano',
    pairingFormula: '1+4v2+3',
  })
}

const ranking = (state: TournamentState) =>
  computeStandings(state).map((row) => row.participantId)

describe('the Mexicano court ladder', () => {
  it('maps every rank band to its own court, in order', () => {
    let state = twelveOnThree()
    state = commit(state, generateRound(state, { rng: seededRng(9) }), (m) => [21, 13, 8][m])

    for (let round = 0; round < 6; round++) {
      const ranked = ranking(state)
      const proposal = generateRound(state)

      const bands = [
        { court: 'kort1', ranks: ranked.slice(0, 4) },
        { court: 'kort2', ranks: ranked.slice(4, 8) },
        { court: 'kort3', ranks: ranked.slice(8, 12) },
      ]

      for (const band of bands) {
        const match = proposal.matches.find((m) => m.courtId === band.court)!
        expect([...match.sideA, ...match.sideB].sort()).toEqual([...band.ranks].sort())
      }

      state = commit(state, proposal, (m) => [21, 13, 8][m])
    }
  })

  it('keeps a dominant player on Kort 1 for the whole tournament', () => {
    // Court spread must never pull the leader off the top court.
    let state = twelveOnThree()
    state = commit(state, generateRound(state, { rng: seededRng(4) }), (m) => [21, 13, 8][m])

    const leader = ranking(state)[0]
    let roundsOnKort1 = 0

    for (let round = 0; round < 6; round++) {
      const proposal = generateRound(state)
      const kort1 = proposal.matches.find((m) => m.courtId === 'kort1')!
      const onKort1 = [...kort1.sideA, ...kort1.sideB].includes(leader)

      // Hand the leader's side a whitewash so they stay top.
      const leaderOnA = kort1.sideA.includes(leader)
      state = commit(state, proposal, (m) =>
        m === 0 ? (leaderOnA ? 21 : 0) : [13, 8][m - 1],
      )

      if (onKort1) roundsOnKort1++
      expect(ranking(state)[0]).toBe(leader)
    }

    expect(roundsOnKort1).toBe(6)
  })

  it('fills courts from the top when some participants rest', () => {
    // 14 players on 3 courts: 12 play, 2 rest. The ladder still runs 1-4, 5-8,
    // 9-12 over whoever is playing.
    let state = makeState({
      participants: Array.from({ length: 14 }, (_, i) => participant(`P${i + 1}`, i + 1)),
      courts: courts(3),
      format: 'mexicano',
      pairingFormula: '1+4v2+3',
    })
    state = commit(state, generateRound(state, { rng: seededRng(2) }), (m) => [21, 13, 8][m])

    const proposal = generateRound(state)
    const resting = new Set(proposal.resting)
    expect(resting.size).toBe(2)

    const playingRanked = ranking(state).filter((id) => !resting.has(id))
    const bands = ['kort1', 'kort2', 'kort3'].map((court, index) => ({
      court,
      ranks: playingRanked.slice(index * 4, index * 4 + 4),
    }))

    for (const band of bands) {
      const match = proposal.matches.find((m) => m.courtId === band.court)!
      expect([...match.sideA, ...match.sideB].sort()).toEqual([...band.ranks].sort())
    }
  })

  it('shifts the ladder onto the remaining courts when one is removed', () => {
    let state = twelveOnThree()
    state = commit(state, generateRound(state, { rng: seededRng(7) }), (m) => [21, 13, 8][m])

    // Kort 2 rained out from round 2; 8 play on Kort 1 and Kort 3, 4 rest.
    state = {
      ...state,
      courts: state.courts.map((c) => (c.id === 'kort2' ? { ...c, removedFromRound: 2 } : c)),
    }

    const proposal = generateRound(state)
    expect(proposal.matches.map((m) => m.courtId)).toEqual(['kort1', 'kort3'])

    const playing = ranking(state).filter((id) => !proposal.resting.includes(id))
    const kort1 = proposal.matches.find((m) => m.courtId === 'kort1')!
    expect([...kort1.sideA, ...kort1.sideB].sort()).toEqual([...playing.slice(0, 4)].sort())
  })
})
