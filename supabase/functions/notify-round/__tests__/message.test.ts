import { describe, expect, it } from 'vitest'

import { composeMessage, isPushEndpoint } from '../message'
import type { RoundNotificationRow } from '../message'

function row(overrides: Partial<RoundNotificationRow> = {}): RoundNotificationRow {
  return {
    subscription_id: 's1',
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    p256dh: 'key',
    auth: 'auth',
    slug: 'k7m2p9qrst',
    tournament: 'Środa Americano',
    team_format: 'individual',
    round_number: 3,
    is_final: false,
    participant: 'Ann',
    status: 'playing',
    court: 'Kort 2',
    partners: ['Dan'],
    opponents: ['Bob', 'Cara'],
    ...overrides,
  }
}

describe('composeMessage', () => {
  it('names the court, the partner and both opponents', () => {
    expect(composeMessage(row())).toEqual({
      title: 'Runda 3: Kort 2',
      body: 'Partner: Dan · Rywale: Bob i Cara',
      tag: 'k7m2p9qrst-round-3',
      url: '/t/k7m2p9qrst',
    })
  })

  it('names the single opposing team in teams format', () => {
    const message = composeMessage(
      row({ team_format: 'teams', participant: 'Smecz', partners: [], opponents: ['Lob'] }),
    )
    expect(message?.body).toBe('Rywal: Lob')
  })

  it('tells a resting participant they rest', () => {
    const message = composeMessage(row({ status: 'resting', court: null, partners: [], opponents: [] }))
    expect(message?.title).toBe('Runda 3: pauza')
  })

  it('calls the final round by name', () => {
    expect(composeMessage(row({ is_final: true }))?.title).toBe('Runda finałowa: Kort 2')
  })

  it('tags a regenerated round the same, so it replaces the earlier notification', () => {
    const first = composeMessage(row({ court: 'Kort 1' }))
    const again = composeMessage(row({ court: 'Kort 3' }))
    expect(again?.tag).toBe(first?.tag)
  })

  it('sends nothing for a credited round', () => {
    expect(composeMessage(row({ status: 'credited', court: null }))).toBeNull()
  })
})

describe('isPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/QGx',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ])('accepts the browser push service %s', (endpoint) => {
    expect(isPushEndpoint(endpoint)).toBe(true)
  })

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com.evil.example/x',
    'https://169.254.169.254/latest/meta-data',
    'https://example.com/fcm.googleapis.com/',
  ])('refuses %s', (endpoint) => {
    expect(isPushEndpoint(endpoint)).toBe(false)
  })
})
