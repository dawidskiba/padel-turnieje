import { describe, expect, it } from 'vitest'

import { describeAuthError } from '../auth'

/**
 * Every message here is a configuration problem rather than something the user
 * typed wrong, so the text has to point at the fix. Supabase's own wording is
 * English and cryptic — "Signups not allowed for otp" tells an organiser nothing.
 */
describe('sign-in error messages', () => {
  it('explains a closed sign-up rather than repeating the API wording', () => {
    const message = describeAuthError('Signups not allowed for otp')
    expect(message).toContain('nie ma dostępu')
    expect(message).not.toMatch(/signup/i)
  })

  it('explains the mailer rate limit', () => {
    expect(describeAuthError('email rate limit exceeded')).toContain('Za dużo prób')
    expect(describeAuthError('Too many requests')).toContain('Za dużo prób')
  })

  it('names the setting when the redirect is not allowlisted', () => {
    // The failure an organiser hits right after a first deploy.
    expect(describeAuthError('Invalid request: redirect_to is not allowed')).toContain(
      'URL Configuration',
    )
  })

  it('reports a malformed address plainly', () => {
    expect(describeAuthError('Unable to validate email address: invalid format')).toContain(
      'Nieprawidłowy adres',
    )
  })

  it('falls back to something actionable for anything unrecognised', () => {
    const message = describeAuthError('some new upstream failure nobody predicted')
    expect(message).toContain('Spróbuj ponownie')
    // Never leak the raw upstream text into a Polish interface.
    expect(message).not.toContain('upstream')
  })
})
