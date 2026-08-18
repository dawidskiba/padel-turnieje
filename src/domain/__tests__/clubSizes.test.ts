import { describe, expect, it } from 'vitest'

import { historyOf } from '../history'
import { generateRound } from '../round'
import { commit, courts, makeState, participant } from './factory'
import type { TeamFormat, TournamentState } from '../types'

/**
 * Two configurations a full club night actually uses, pinned because they are
 * larger than anything else in the suite and behave differently: with four
 * courts there is real freedom in court assignment, and with a big roster the
 * rest rota cycles rather than repeating.
 *
 * Expected values are measured, not aspirational.
 */
function build(n: number, courtCount: number, teamFormat: TeamFormat): TournamentState {
  return makeState({
    participants: Array.from({ length: n }, (_, i) => participant(`P${i + 1}`, i + 1)),
    courts: courts(courtCount),
    teamFormat,
  })
}

function play(state: TournamentState, rounds: number): TournamentState {
  for (let i = 0; i < rounds; i++) {
    state = commit(state, generateRound(state), (m) => [15, 11, 21, 13][m % 4])
  }
  return state
}

function allPairs(state: TournamentState): Array<[string, string]> {
  const ids = state.participants.map((p) => p.id)
  const pairs: Array<[string, string]> = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) pairs.push([ids[i], ids[j]])
  }
  return pairs
}

describe('teams Americano: 10 teams on 4 courts', () => {
  // 8 teams play, 2 rest. 45 possible fixtures, 4 per round.
  const setup = () => build(10, 4, 'teams')

  it('gets seven rounds in before any rematch', () => {
    let state = setup()
    for (let round = 1; round <= 7; round++) {
      const history = historyOf(state)
      const proposal = generateRound(state)
      for (const match of proposal.matches) {
        expect(
          history.opponentCount(match.sideA[0], match.sideB[0]),
          `round ${round} rematched ${match.sideA[0]} v ${match.sideB[0]}`,
        ).toBe(0)
      }
      state = commit(state, proposal, (m) => [15, 11, 21, 13][m % 4])
    }
  })

  it('rests every team equally, cycling exactly', () => {
    // 2 rest per round over 10 rounds is 20 slots across 10 teams: two each.
    const history = historyOf(play(setup(), 10))
    const counts = setup().participants.map((p) => history.restCount(p.id))
    expect(counts.every((c) => c === 2)).toBe(true)
  })

  it('never faces anyone a third time, and keeps courts even', () => {
    const state = play(setup(), 12)
    const history = historyOf(state)

    expect(Math.max(...allPairs(state).map(([a, b]) => history.opponentCount(a, b)))).toBeLessThanOrEqual(2)

    for (const p of state.participants) {
      const perCourt = state.courts.map((c) => history.courtCount(p.id, c.id))
      expect(Math.max(...perCourt) - Math.min(...perCourt)).toBeLessThanOrEqual(2)
      expect(perCourt.filter((n) => n > 0).length).toBeGreaterThan(1)
    }
  })
})

describe('individual Americano: 20 players on 4 courts', () => {
  // 16 play, 4 rest. 19 possible partners each.
  const setup = () => build(20, 4, 'individual')

  it('never repeats a partner over a very long evening', () => {
    // Twelve rounds is longer than any real tournament, and priority 1 still
    // holds without a single repeat.
    const state = play(setup(), 12)
    const history = historyOf(state)
    expect(Math.max(...allPairs(state).map(([a, b]) => history.partnerCount(a, b)))).toBe(1)
  })

  it('rests every player equally, cycling exactly', () => {
    // 4 rest per round over 10 rounds is 40 slots across 20 players: two each.
    const history = historyOf(play(setup(), 10))
    const counts = setup().participants.map((p) => history.restCount(p.id))
    expect(counts.every((c) => c === 2)).toBe(true)
  })

  it('spreads opponents as far as partner variety allows', () => {
    // Opponents are priority 2, and each match burns two opponent slots against
    // one partner slot — so repeats start earlier here than partners ever do.
    // The promise is bounded, and that everyone keeps meeting new people.
    const state = play(setup(), 12)
    const history = historyOf(state)
    const ids = state.participants.map((p) => p.id)

    expect(Math.max(...allPairs(state).map(([a, b]) => history.opponentCount(a, b)))).toBeLessThanOrEqual(3)

    const distinct = ids.map((id) => ids.filter((o) => o !== id && history.opponentCount(id, o) > 0).length)
    expect(Math.min(...distinct)).toBeGreaterThanOrEqual(12)
  })

  it('keeps nobody stuck on one court', () => {
    const state = play(setup(), 12)
    const history = historyOf(state)

    for (const p of state.participants) {
      const perCourt = state.courts.map((c) => history.courtCount(p.id, c.id))
      expect(Math.max(...perCourt) - Math.min(...perCourt)).toBeLessThanOrEqual(3)
      expect(perCourt.filter((n) => n > 0).length).toBeGreaterThan(1)
    }
  })
})
