import { describe, expect, it } from 'vitest'

import { buildCreatePayload } from '../createPayload'
import type { DraftTournament } from '../../domain/validation'

function draft(overrides: Partial<DraftTournament> = {}): DraftTournament {
  return {
    name: '  Środa Mexicano  ',
    format: 'mexicano',
    teamFormat: 'individual',
    gamePoints: 21,
    restPoints: 11,
    pairingFormula: '1+4v2+3',
    participants: ['Ann', 'Bob', 'Cara', 'Dan'],
    courts: ['Kort 1', 'Kort 2'],
    ...overrides,
  }
}

describe('create payload', () => {
  it('trims the name, participants and courts', () => {
    const payload = buildCreatePayload(
      draft({ participants: [' Ann ', 'Bob'], courts: [' Kort 1 '] }),
    )
    expect(payload.name).toBe('Środa Mexicano')
    expect(payload.participants.map((p) => p.name)).toEqual(['Ann', 'Bob'])
    expect(payload.courts).toEqual(['Kort 1'])
  })

  it('drops blank entries rather than sending empty names', () => {
    const payload = buildCreatePayload(draft({ participants: ['Ann', '   ', 'Bob'] }))
    expect(payload.participants).toHaveLength(2)
  })

  it('sends a pin as a court index, because the courts do not exist yet', () => {
    const payload = buildCreatePayload(draft(), {
      Ann: { courtIndex: 1, side: 'b' },
    })
    expect(payload.participants[0]).toEqual({
      name: 'Ann',
      seed_court_index: 1,
      seed_side: 'b',
    })
  })

  it('omits the side when only a court was pinned', () => {
    const payload = buildCreatePayload(draft(), { Ann: { courtIndex: 0, side: null } })
    expect(payload.participants[0]).toEqual({ name: 'Ann', seed_court_index: 0 })
    expect(payload.participants[0]).not.toHaveProperty('seed_side')
  })

  it('leaves unpinned participants bare', () => {
    const payload = buildCreatePayload(draft(), { Ann: { courtIndex: 0, side: 'a' } })
    expect(payload.participants[1]).toEqual({ name: 'Bob' })
  })

  it('drops a pin whose court has since been removed', () => {
    // Ann was pinned to the third court, then the organiser deleted it.
    const payload = buildCreatePayload(draft({ courts: ['Kort 1'] }), {
      Ann: { courtIndex: 2, side: 'a' },
    })
    expect(payload.participants[0]).toEqual({ name: 'Ann' })
  })

  it('ignores pins entirely for an Americano', () => {
    const payload = buildCreatePayload(draft({ format: 'americano', pairingFormula: null }), {
      Ann: { courtIndex: 0, side: 'a' },
    })
    expect(payload.participants[0]).toEqual({ name: 'Ann' })
  })

  it('sends no pairing formula unless Mexicano and individual', () => {
    expect(buildCreatePayload(draft()).pairing_formula).toBe('1+4v2+3')
    expect(buildCreatePayload(draft({ format: 'americano' })).pairing_formula).toBeNull()
    expect(buildCreatePayload(draft({ teamFormat: 'teams' })).pairing_formula).toBeNull()
  })
})
