// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'

import { THEME_STORAGE_KEY, applyTheme, initTheme, setTheme } from '../theme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

/**
 * The tokens resolve in three layers (see docs/design.md): bare :root is light,
 * a media query overrides it for system-dark users who have not chosen light,
 * and [data-theme="dark"] overrides that. The attribute is the only lever, so
 * these tests are about setting and clearing it correctly.
 */
describe('theme preference', () => {
  it('leaves the attribute off for system, so the media query decides', () => {
    setTheme('dark')
    setTheme('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('stamps the attribute for an explicit choice, in both directions', () => {
    setTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    // Choosing light must be an explicit stamp too: a system-dark user picking
    // light needs to beat the media query, not merely fall back to it.
    setTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('persists an explicit choice and forgets system', () => {
    setTheme('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    setTheme('system')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('restores the stored choice at startup', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    initTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('ignores a junk value in storage rather than stamping it', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple')
    initTheme()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('applyTheme is idempotent', () => {
    applyTheme('dark')
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
