/**
 * Magic-link auth. The organiser signs in with an email and owns their
 * tournaments; players never authenticate at all (ADR-0001).
 */

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'

export interface AuthState {
  session: Session | null
  loading: boolean
}

export function useSession(): AuthState {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session, loading: false })
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ session, loading: false })
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  return state
}

/**
 * Supabase reports auth failures in English, which is no use in a Polish
 * interface — and the messages are cryptic even in English. These are the four
 * that actually happen, all of them configuration rather than user error, so the
 * text says what to do rather than what went wrong.
 */
export function describeAuthError(message: string): string {
  const lower = message.toLowerCase()

  // Raised when new sign-ups are disabled and the address is not yet a user.
  if (lower.includes('signups not allowed') || lower.includes('signup is disabled')) {
    return 'Ten adres nie ma dostępu. Logowanie jest ograniczone do zaproszonych organizatorów.'
  }
  // The built-in mailer allows only a couple of messages per hour.
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Za dużo prób. Poczekaj kilka minut i spróbuj ponownie.'
  }
  // The app's own origin is missing from the redirect allowlist.
  if (lower.includes('redirect') || lower.includes('invalid request')) {
    return 'Ten adres aplikacji nie jest dopuszczony w Supabase (Authentication → URL Configuration).'
  }
  if (lower.includes('invalid') && lower.includes('email')) {
    return 'Nieprawidłowy adres e-mail.'
  }
  return 'Nie udało się wysłać linku. Spróbuj ponownie.'
}

export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/turnieje`,
      // Never create an account as a side effect of typing an address. With
      // sign-ups open this changes nothing; with them closed it is what makes
      // an unknown address fail cleanly instead of quietly becoming a user.
      shouldCreateUser: false,
    },
  })
  if (error) throw new Error(describeAuthError(error.message))
}

/**
 * Password sign-in, for the case magic links handle badly: standing at the club
 * desk, logged out, tournament about to start, inbox not to hand. No email round
 * trip and no mailer rate limit.
 *
 * There is deliberately no sign-up here. Accounts are created and passwords set
 * from the Supabase dashboard, which keeps the roster of organisers a decision
 * rather than a side effect of typing an address.
 */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(describePasswordError(error.message))
}

export function describePasswordError(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('invalid login credentials')) {
    return 'Nieprawidłowy e-mail lub hasło.'
  }
  if (lower.includes('email not confirmed')) {
    return 'Ten adres nie został jeszcze potwierdzony.'
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Za dużo prób. Poczekaj kilka minut i spróbuj ponownie.'
  }
  return 'Nie udało się zalogować. Spróbuj ponownie.'
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
