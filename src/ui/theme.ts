/**
 * Theme preference: light, dark, or follow the system.
 *
 * The tokens live in src/index.css and resolve in three layers — bare :root is
 * light, a media query overrides it for system-dark users who have not chosen
 * light, and [data-theme="dark"] overrides that. All this module does is set or
 * clear the attribute; the CSS decides what the attribute means.
 */

import { useSyncExternalStore } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

export const THEME_STORAGE_KEY = 'padel.theme'

const listeners = new Set<() => void>()

function read(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'system'
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

let preference: ThemePreference = read()

/**
 * `matchMedia` is missing in some embedded webviews and in test environments.
 * Losing the system-theme reading there is a cosmetic problem; throwing from a
 * hook that every screen renders is not, so treat absence as "not dark".
 */
function darkMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia('(prefers-color-scheme: dark)')
}

export function prefersDark(): boolean {
  return darkMediaQuery()?.matches ?? false
}

export function applyTheme(next: ThemePreference) {
  const root = document.documentElement
  if (next === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', next)
  }
}

export function setTheme(next: ThemePreference) {
  preference = next
  try {
    if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // Private browsing and full storage must not break the toggle; the choice
    // simply does not survive a reload.
  }
  applyTheme(next)
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  // A system-following user should track the OS switching at dusk.
  const media = darkMediaQuery()
  media?.addEventListener('change', listener)
  return () => {
    listeners.delete(listener)
    media?.removeEventListener('change', listener)
  }
}

export function useTheme(): {
  preference: ThemePreference
  resolved: 'light' | 'dark'
  setTheme: (next: ThemePreference) => void
} {
  const value = useSyncExternalStore(
    subscribe,
    () => preference,
    () => 'system' as ThemePreference,
  )

  const resolved = value === 'system' ? (prefersDark() ? 'dark' : 'light') : value

  return { preference: value, resolved, setTheme }
}

/** Called once at startup, before React renders. */
export function initTheme() {
  applyTheme(read())
}
