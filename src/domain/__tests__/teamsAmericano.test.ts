import { describe, expect, it } from 'vitest'

import { historyOf } from '../history'
import { generateRound } from '../round'
import { commit, courts, makeState, roster } from './factory'
import type { TournamentState } from '../types'

/**
 * The shape that broke in a real 5-team Americano: an odd number of teams, so
 * one rests each round and the available set rotates.
 *
 * G&H met I&J in consecutive rounds while four of the ten possible fixtures
 * were unused — greedy matched sides off two at a time and the last two were
 * forced together after both alternatives had been taken.
 */
function fiveTeams(): TournamentState {
  return makeState({
    participants: roster('T1', 'T2', 'T3', 'T4', 'T5'),
    courts: courts(2),
    teamFormat: 'teams',
  })
}

function play(state: TournamentState, rounds: number, opts: { final?: boolean } = {}) {
  for (let i = 0; i < rounds; i++) {
    const isFinal = opts.final === true && i === rounds - 1
    state = commit(state, generateRound(state, { isFinal }), (m) => [13, 16, 11][m % 3])
  }
  return state
}

function fixtures(state: TournamentState): string[] {
  return state.rounds.flatMap((round) =>
    round.matches.map((m) => [...m.sideA, ...m.sideB].sort().join(' v ')),
  )
}

describe('teams Americano with an odd number of teams', () => {
  it('never repeats a fixture while fresh ones remain', () => {
    // 4 rounds x 2 matches = 8 fixtures, from 10 possible among 5 teams.
    const played = play(fiveTeams(), 4)
    const all = fixtures(played)
    expect(all).toHaveLength(8)
    expect(new Set(all).size).toBe(8)
  })

  it('keeps every team intact on its own side', () => {
    const played = play(fiveTeams(), 4)
    for (const round of played.rounds) {
      for (const match of round.matches) {
        expect(match.sideA).toHaveLength(1)
        expect(match.sideB).toHaveLength(1)
      }
    }
  })

  it('rests teams evenly', () => {
    const played = play(fiveTeams(), 5)
    const history = historyOf(played)
    const counts = played.participants.map((p) => history.restCount(p.id))
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })

  it('exhausts the fixture list before repeating anything', () => {
    // 5 rounds = 10 fixtures = exactly the full round robin.
    const played = play(fiveTeams(), 5)
    const all = fixtures(played)
    expect(all).toHaveLength(10)
    expect(new Set(all).size).toBe(10)
  })
})

describe('individual Americano opponent freshness', () => {
  it('does not repeat an opponent pairing of sides while alternatives exist', () => {
    // Same repair, one level up from partnerships: with 8 players on 2 courts
    // the four sides can be matched three ways each round.
    let state = makeState({
      participants: roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'),
      courts: courts(2),
    })
    state = play(state, 3)

    const history = historyOf(state)
    const ids = state.participants.map((p) => p.id)
    const counts: number[] = []
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) counts.push(history.opponentCount(ids[i], ids[j]))
    }
    expect(Math.max(...counts)).toBeLessThanOrEqual(2)
  })
})
