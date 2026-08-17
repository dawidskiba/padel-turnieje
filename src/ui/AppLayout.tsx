import { Link, Outlet } from 'react-router-dom'

import { signOut, useSession } from '../data/auth'
import { useWriteQueue } from '../data/hooks'
import { ConnectionBanner } from './ConnectionBanner'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { Button } from './primitives'

/**
 * The organiser's shell. Mounts the offline score queue once, high enough that
 * navigating between screens never interrupts a retry in flight.
 */
export function AppLayout() {
  const { session } = useSession()
  useWriteQueue()

  return (
    <div className="min-h-screen bg-bg text-text">
      <ConnectionBanner />

      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/turnieje" aria-label="Garden Padel — moje turnieje">
            <Logo className="h-8" />
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {session ? (
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>
                Wyloguj
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

/**
 * The viewer's shell — no account, no queue, nothing to sign out of. Kept
 * separate so the public page cannot accidentally acquire organiser chrome.
 */
export function PublicLayout() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Logo className="h-7" />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
