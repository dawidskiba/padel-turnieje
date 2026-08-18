import { useState } from 'react'
import { Navigate } from 'react-router-dom'

import { sendMagicLink, signInWithPassword, useSession } from '../data/auth'
import { Logo } from '../ui/Logo'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Button, Field, Notice, Spinner, TextInput, cx } from '../ui/primitives'

/**
 * Two ways in, password first.
 *
 * Magic links were the only option originally, and they are the wrong shape for
 * the moment that actually matters: at the club desk, logged out, tournament
 * starting, inbox not to hand — and the built-in mailer allows only a couple of
 * messages an hour. A password gets you in immediately; the link stays as the
 * route for when the password has been forgotten.
 *
 * Neither creates an account. Organisers are added from the Supabase dashboard.
 */
type Mode = 'password' | 'link'

export function SignInPage() {
  const { session, loading } = useSession()
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <Spinner label="Sprawdzam sesję…" />
      </div>
    )
  }

  if (session) return <Navigate to="/turnieje" replace />

  function switchTo(next: Mode) {
    setMode(next)
    setError(null)
    setSent(false)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'password') {
        await signInWithPassword(email.trim(), password)
        // No navigation needed: the session listener re-renders into the redirect.
      } else {
        await sendMagicLink(email.trim())
        setSent(true)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zalogować.')
    } finally {
      setBusy(false)
    }
  }

  const canSubmit =
    email.trim().length > 0 && (mode === 'link' || password.length > 0) && !busy

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-6">
          <Logo className="h-12" />
          <ThemeToggle />
        </div>

        {sent ? (
          <div className="space-y-3 text-center">
            <p className="text-text">Sprawdź skrzynkę.</p>
            <p className="text-sm text-text-muted">
              Wysłałem link do logowania na <strong className="text-text">{email}</strong>. Otwórz
              go na tym urządzeniu.
            </p>
            <Button variant="ghost" size="sm" onClick={() => switchTo('link')}>
              Wyślij ponownie
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div role="radiogroup" aria-label="Sposób logowania" className="flex gap-2">
              {(
                [
                  { value: 'password', label: 'Hasło' },
                  { value: 'link', label: 'Link e-mail' },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === option.value}
                  onClick={() => switchTo(option.value)}
                  className={cx(
                    'flex-1 rounded-lg border px-3 py-2 text-sm transition-colors',
                    mode === option.value
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-border bg-surface text-text hover:border-accent',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <Field label="Adres e-mail" htmlFor="email">
              <TextInput
                id="email"
                type="email"
                required
                autoComplete="username"
                placeholder="ty@klub.pl"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>

            {mode === 'password' ? (
              <Field label="Hasło" htmlFor="password">
                <TextInput
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
            ) : (
              <p className="text-sm text-text-muted">
                Wyślemy jednorazowy link. Przydaje się, gdy nie pamiętasz hasła.
              </p>
            )}

            {error ? <Notice tone="danger">{error}</Notice> : null}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!canSubmit}
            >
              {busy
                ? mode === 'password'
                  ? 'Loguję…'
                  : 'Wysyłam…'
                : mode === 'password'
                  ? 'Zaloguj się'
                  : 'Wyślij link'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
