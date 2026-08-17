/**
 * Reports what is unsaved. The app needs a connection, but a wifi blip at the
 * desk must never lose typed input — so scores queue locally and this says so
 * rather than letting the organiser wonder.
 */

import { useOnline, usePendingScores } from '../data/hooks'

export function ConnectionBanner() {
  const online = useOnline()
  const pending = usePendingScores()

  if (online && pending.length === 0) return null

  return (
    <div
      role="status"
      className="border-b border-warning/40 bg-warning/10 px-4 py-2 text-center text-sm text-warning"
    >
      {online
        ? `Zapisuję ${pending.length} ${pending.length === 1 ? 'wynik' : 'wyniki'}…`
        : `Brak połączenia${pending.length ? ` — ${pending.length} do zapisania, wyślę gdy wróci` : ''}`}
    </div>
  )
}
