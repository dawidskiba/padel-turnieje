import { describe, expect, it } from 'vitest'

import {
  defaultCourtName,
  defaultRestPoints,
  errorsOf,
  isSubmittable,
  validateDraft,
} from '../validation'
import type { DraftTournament } from '../validation'

function draft(overrides: Partial<DraftTournament> = {}): DraftTournament {
  return {
    name: 'Środa Americano',
    format: 'americano',
    teamFormat: 'individual',
    gamePoints: 21,
    restPoints: 11,
    pairingFormula: null,
    participants: ['Ann', 'Bob', 'Cara', 'Dan'],
    courts: ['Kort 1'],
    ...overrides,
  }
}

const messages = (d: DraftTournament) => validateDraft(d).map((i) => i.message)

describe('rest points default', () => {
  it('is half the game points, rounded down', () => {
    // Rounded down, not up: with a 21-point target, 11 is the winning score, so
    // rounding up paid a rested player as though they had narrowly won.
    expect(defaultRestPoints(21)).toBe(10)
    expect(defaultRestPoints(16)).toBe(8)
    expect(defaultRestPoints(11)).toBe(5)
  })

  it('never pays a rest more than a losing score', () => {
    for (const gamePoints of [11, 16, 21, 31, 99]) {
      const rest = defaultRestPoints(gamePoints)
      expect(rest).toBeLessThan(gamePoints - rest + 1)
    }
  })
})

describe('court name default', () => {
  it('numbers from 1', () => {
    expect(defaultCourtName(0)).toBe('Kort 1')
    expect(defaultCourtName(3)).toBe('Kort 4')
  })
})

describe('validation — blocks the impossible', () => {
  it('accepts a minimal valid draft', () => {
    expect(isSubmittable(draft())).toBe(true)
  })

  it('rejects an empty name', () => {
    expect(errorsOf(validateDraft(draft({ name: '   ' })))).toHaveLength(1)
  })

  it('rejects fewer than four individuals', () => {
    expect(messages(draft({ participants: ['Ann', 'Bob', 'Cara'] }))).toContain(
      'Za mało uczestników — minimum 4.',
    )
  })

  it('rejects fewer than two teams', () => {
    expect(messages(draft({ teamFormat: 'teams', participants: ['Ann & Bob'] }))).toContain(
      'Za mało drużyn — minimum 2.',
    )
  })

  it('accepts two teams', () => {
    expect(
      isSubmittable(draft({ teamFormat: 'teams', participants: ['Ann & Bob', 'Cara & Dan'] })),
    ).toBe(true)
  })

  it('rejects duplicate participants regardless of case', () => {
    const issues = errorsOf(validateDraft(draft({ participants: ['Ann', 'Bob', 'Cara', 'ann'] })))
    expect(issues.some((i) => i.message.includes('ann'))).toBe(true)
  })

  it('rejects duplicate court names regardless of case', () => {
    const issues = errorsOf(validateDraft(draft({ courts: ['Kort 1', 'KORT 1'] })))
    expect(issues.some((i) => i.field === 'courts')).toBe(true)
  })

  it('rejects zero courts', () => {
    expect(messages(draft({ courts: [] }))).toContain('Dodaj przynajmniej jeden kort.')
  })

  it('rejects game points outside 1–99', () => {
    expect(isSubmittable(draft({ gamePoints: 0 }))).toBe(false)
    expect(isSubmittable(draft({ gamePoints: 100 }))).toBe(false)
    expect(isSubmittable(draft({ gamePoints: 99 }))).toBe(true)
  })
})

describe('validation — warns about the awkward', () => {
  it('warns once a whole match’s worth is idle, but allows it', () => {
    // 22 players on 4 courts: 16 play, 6 rest — enough for another court.
    const d = draft({
      participants: Array.from({ length: 22 }, (_, i) => `P${i + 1}`),
      courts: ['K1', 'K2', 'K3', 'K4'],
    })
    const warning = validateDraft(d).find(
      (i) => i.level === 'warning' && i.field === 'participants',
    )
    expect(warning?.message).toContain('6 z 22')
    expect(isSubmittable(d)).toBe(true)
  })

  it('stays quiet when fewer than a full match is idle', () => {
    // 18 players on 4 courts: only 2 rest, so another court would not help.
    const d = draft({
      participants: Array.from({ length: 18 }, (_, i) => `P${i + 1}`),
      courts: ['K1', 'K2', 'K3', 'K4'],
    })
    expect(validateDraft(d).some((i) => i.field === 'participants')).toBe(false)
  })

  it('warns about courts that can never be used', () => {
    const d = draft({ participants: ['Ann', 'Bob', 'Cara', 'Dan'], courts: ['K1', 'K2', 'K3'] })
    const warning = validateDraft(d).find((i) => i.level === 'warning' && i.field === 'courts')
    expect(warning?.message).toContain('2')
    expect(isSubmittable(d)).toBe(true)
  })

  it('warns when resting scores as much as a whitewash', () => {
    const d = draft({ gamePoints: 11, restPoints: 11 })
    expect(validateDraft(d).some((i) => i.level === 'warning' && i.field === 'restPoints')).toBe(
      true,
    )
    expect(isSubmittable(d)).toBe(true)
  })

  it('stays quiet on a well-proportioned tournament', () => {
    const d = draft({
      participants: Array.from({ length: 16 }, (_, i) => `P${i + 1}`),
      courts: ['K1', 'K2', 'K3', 'K4'],
    })
    expect(validateDraft(d)).toEqual([])
  })
})
