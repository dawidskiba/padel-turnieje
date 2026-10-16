import { describe, expect, it } from 'vitest'

import { isJoinCode, joinCodeIsLive, normaliseCode, parseScanned } from '../joinCode'

describe('normaliseCode', () => {
  it('keeps at most four digits and drops everything else', () => {
    expect(normaliseCode('48 27')).toBe('4827')
    expect(normaliseCode('482719')).toBe('4827')
    expect(normaliseCode('a4b8')).toBe('48')
  })
})

describe('isJoinCode', () => {
  it('accepts four digits without a leading zero', () => {
    expect(isJoinCode('4827')).toBe(true)
    expect(isJoinCode('1000')).toBe(true)
  })

  it.each(['0482', '482', '48271', ''])('refuses %s', (code) => {
    expect(isJoinCode(code)).toBe(false)
  })
})

describe('parseScanned', () => {
  it('takes the slug from the desk QR', () => {
    expect(parseScanned('https://gardenpadel.vercel.app/t/k7m2xq9p4v')).toEqual({
      kind: 'slug',
      slug: 'k7m2xq9p4v',
    })
  })

  it('accepts a link from another deployment of the app, but keeps only the slug', () => {
    expect(parseScanned('https://padel-preview.vercel.app/t/k7m2xq9p4v/')).toEqual({
      kind: 'slug',
      slug: 'k7m2xq9p4v',
    })
  })

  it('accepts a bare join code', () => {
    expect(parseScanned(' 4827 ')).toEqual({ kind: 'code', code: '4827' })
  })

  it.each([
    'https://example.com/',
    'https://gardenpadel.vercel.app/turnieje/k7m2xq9p4v',
    'https://gardenpadel.vercel.app/t/K7M2XQ9P4V',
    'https://gardenpadel.vercel.app/t/k7m2xq9p4v/extra',
    'WIFI:S:club;T:WPA;P:secret;;',
  ])('ignores %s', (text) => {
    expect(parseScanned(text)).toBeNull()
  })
})

describe('joinCodeIsLive', () => {
  const now = new Date('2026-10-16T12:00:00Z')

  it('is live while the tournament runs', () => {
    expect(joinCodeIsLive(null, now)).toBe(true)
  })

  it('stays live for a day after finishing, then not', () => {
    expect(joinCodeIsLive('2026-10-15T13:00:00Z', now)).toBe(true)
    expect(joinCodeIsLive('2026-10-15T11:00:00Z', now)).toBe(false)
  })
})
