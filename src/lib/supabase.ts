import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * The Supabase dashboard shows both a Project URL and a REST endpoint, and it
 * is easy to copy the wrong one. The client appends `/rest/v1` itself, so a URL
 * that already ends in it produces `/rest/v1//rest/v1/…` and 404s every single
 * request — with nothing in the error to suggest why.
 *
 * Strip it and say so loudly, rather than letting an evening at the club be
 * lost to a doubled path.
 */
function normaliseUrl(value: string | undefined): string | undefined {
  if (!value) return value
  const trimmed = value.replace(/\/+$/, '')
  const withoutRest = trimmed.replace(/\/rest\/v1$/, '')

  if (withoutRest !== trimmed) {
    console.warn(
      `VITE_SUPABASE_URL kończy się na /rest/v1 — użyj samego adresu projektu (${withoutRest}). Poprawiam tymczasowo.`,
    )
  }
  return withoutRest
}

const url = normaliseUrl(rawUrl)

export const isConfigured = Boolean(url && anonKey)

if (!isConfigured) {
  console.warn(
    'Brak VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Skopiuj .env.example do .env i uzupełnij dane projektu Supabase.',
  )
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
