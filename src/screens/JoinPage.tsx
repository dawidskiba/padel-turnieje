/**
 * "Inny turniej": the way from one tournament to the next without leaving the
 * Home Screen app (ADR-0005). Type the four-digit code read out at the desk, or
 * scan the desk's QR with the camera from here rather than the Camera app,
 * which would open Safari instead.
 */

import { Suspense, lazy, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  TooManyAttemptsError,
  isJoinCode,
  normaliseCode,
  parseScanned,
  resolveJoinCode,
} from '../data/joinCode'
import { Button, Field, Notice, Panel, Spinner, TextInput } from '../ui/primitives'

const QrScanner = lazy(() => import('../ui/QrScanner'))

export function JoinPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  async function open(target: string) {
    setBusy(true)
    setProblem(null)
    try {
      const slug = await resolveJoinCode(target)
      if (slug) navigate(`/t/${slug}`)
      else setProblem(`Nie ma trwającego turnieju z kodem ${target}. Sprawdź cyfry.`)
    } catch (err) {
      setProblem(
        err instanceof TooManyAttemptsError
          ? 'Za dużo błędnych prób. Spróbuj ponownie za kilka minut.'
          : 'Nie udało się sprawdzić kodu. Sprawdź połączenie i spróbuj jeszcze raz.',
      )
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (isJoinCode(code)) void open(code)
  }

  function onScanned(text: string) {
    const target = parseScanned(text)
    setScanning(false)
    if (!target) {
      setProblem('To nie jest kod QR turnieju.')
      return
    }
    if (target.kind === 'slug') navigate(`/t/${target.slug}`)
    else {
      setCode(target.code)
      void open(target.code)
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-medium text-text">Dołącz do turnieju</h1>
        <p className="text-sm text-text-muted">Wpisz kod podany przez organizatora albo zeskanuj kod QR.</p>
      </header>

      <Panel className="space-y-4 p-5">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Kod turnieju" htmlFor="join-code">
            <TextInput
              id="join-code"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="np. 4827"
              value={code}
              onChange={(event) => setCode(normaliseCode(event.target.value))}
              className="text-center text-3xl tracking-[0.5em] tabular-nums"
            />
          </Field>
          <Button type="submit" variant="primary" className="w-full" disabled={busy || !isJoinCode(code)}>
            {busy ? 'Sprawdzam…' : 'Przejdź do turnieju'}
          </Button>
        </form>

        {problem ? <Notice tone="danger">{problem}</Notice> : null}
      </Panel>

      <Panel className="space-y-4 p-5">
        {scanning ? (
          <>
            <Suspense fallback={<Spinner label="Włączam aparat…" />}>
              <QrScanner onResult={onScanned} />
            </Suspense>
            <Button variant="ghost" className="w-full" onClick={() => setScanning(false)}>
              Anuluj
            </Button>
          </>
        ) : (
          <Button
            className="w-full"
            onClick={() => {
              setProblem(null)
              setScanning(true)
            }}
          >
            Skanuj kod QR
          </Button>
        )}
      </Panel>
    </div>
  )
}
