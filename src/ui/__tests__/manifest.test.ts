import { describe, expect, it } from 'vitest'

import { manifestFor } from '../manifest'

describe('manifestFor', () => {
  const base = {
    name: 'Garden Padel — Turnieje',
    start_url: '/',
    scope: '/',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
  }

  it('starts an installed app on the tournament page, not the sign-in', () => {
    const manifest = manifestFor(base, 'https://padel.example', '/t/k7m2p9qrst')
    expect(manifest.start_url).toBe('https://padel.example/t/k7m2p9qrst')
    expect(manifest.id).toBe('/t/k7m2p9qrst')
  })

  it('makes every URL absolute, because a blob manifest has no base to resolve against', () => {
    const manifest = manifestFor(base, 'https://padel.example', '/t/k7m2p9qrst')
    expect(manifest.scope).toBe('https://padel.example/')
    expect(manifest.icons).toEqual([
      { src: 'https://padel.example/icon-192.png', sizes: '192x192', type: 'image/png' },
    ])
  })
})
