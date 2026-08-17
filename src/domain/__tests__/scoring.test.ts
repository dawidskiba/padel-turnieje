import { describe, expect, it } from 'vitest'

import { isRoundComplete, splitScore } from '../types'
import type { Round } from '../types'

function round(scores: Array<[number, number] | null>): Round {
  return {
    number: 1,
    isFinal: false,
    matches: scores.map((score, index) => ({
      courtId: `c${index}`,
      sideA: ['p1', 'p2'],
      sideB: ['p3', 'p4'],
      scoreA: score?.[0] ?? null,
      scoreB: score?.[1] ?? null,
    })),
    resting: [],
    credited: [],
  }
}

describe('splitting a score across the two sides', () => {
  it('gives the tapped side the number picked', () => {
    expect(splitScore('a', 15, 21)).toEqual({ scoreA: 15, scoreB: 6 })
  })

  it('works the same when the other side is tapped', () => {
    // The organiser tapped side B and picked 15, so B has 15 and A takes the rest.
    expect(splitScore('b', 15, 21)).toEqual({ scoreA: 6, scoreB: 15 })
  })

  it('always sums to the game points target', () => {
    for (const gamePoints of [11, 16, 21, 99]) {
      for (const value of [0, 1, 7, gamePoints - 1, gamePoints]) {
        const { scoreA, scoreB } = splitScore('a', value, gamePoints)
        expect(scoreA + scoreB).toBe(gamePoints)
      }
    }
  })

  it('handles a whitewash from either side', () => {
    expect(splitScore('a', 21, 21)).toEqual({ scoreA: 21, scoreB: 0 })
    expect(splitScore('b', 21, 21)).toEqual({ scoreA: 0, scoreB: 21 })
  })

  it('produces a level score at the halfway point of an even target', () => {
    expect(splitScore('a', 8, 16)).toEqual({ scoreA: 8, scoreB: 8 })
  })
})

describe('round completeness', () => {
  it('is complete only when every court has a result', () => {
    expect(isRoundComplete(round([[15, 6], [11, 10]]))).toBe(true)
    expect(isRoundComplete(round([[15, 6], null]))).toBe(false)
  })

  it('counts a 0 as a result, not as missing', () => {
    expect(isRoundComplete(round([[21, 0]]))).toBe(true)
  })

  it('is not complete when there are no matches at all', () => {
    // Otherwise an empty round would let the tournament advance forever.
    expect(isRoundComplete(round([]))).toBe(false)
  })
})
