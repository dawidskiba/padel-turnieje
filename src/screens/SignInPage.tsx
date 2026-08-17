import { useState } from 'react'
import { Navigate } from 'react-router-dom'

import { sendMagicLink, useSession } from '../data/auth'
import { Logo } from '../ui/Logo'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Button, Field, Notice, Spinner, TextInput } from '../ui/primitives'

export function SignInPage() {
  const { session, loading } = useSession()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <Spinner label="Sprawdzam sesję…" />
      </div>
    )
  }

  if (session) return <Navigate to="/turnieje" replace />

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSending(true)
    try {
      await sendMagicLink(email.trim())
      setSent(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się wysłać linku.')
    } finally {
      setSending(false)
    }
  }

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
              Wysłałem link do logowania na <strong className="text-text">{email}</strong>. Otwórz go
              na tym urządzeniu.
            </p>
            <Button variant="ghost" size="sm" onClick={() => setSent(false)}>
              Wyślij ponownie
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field
              label="Adres e-mail"
              htmlFor="email"
              hint="Wyślemy link do logowania — bez hasła."
            >
              <TextInput
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="ty@klub.pl"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>

            {error ? <Notice tone="danger">{error}</Notice> : null}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={sending || email.trim().length === 0}
            >
              {sending ? 'Wysyłam…' : 'Wyślij link'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
