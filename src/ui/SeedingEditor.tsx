/**
 * Mexicano round-1 pinning: place participants on a specific court and, if the
 * organiser wants, a specific side. Everything unpinned is drawn at random.
 *
 * Pinning a *side* is the point of the feature. Without it, two strong players
 * pinned to the same court can come out as partners, which is the opposite of
 * what the organiser was trying to arrange.
 */

import type { Side } from '../domain/types'
import { Notice, cx } from './primitives'

export interface Seed {
  courtIndex: number
  side: Side | null
}

/** Keyed by participant name, which is unique within a tournament. */
export type Seeds = Record<string, Seed>

const SIDE_LABEL: Record<string, string> = {
  '': 'losowo',
  a: 'strona A',
  b: 'strona B',
}

export function SeedingEditor({
  participants,
  courts,
  perSide,
  seeds,
  onChange,
}: {
  participants: string[]
  courts: string[]
  /** Participants per side of the net: 2 individual, 1 teams. */
  perSide: number
  seeds: Seeds
  onChange: (next: Seeds) => void
}) {
  if (courts.length === 0 || participants.length === 0) {
    return (
      <Notice tone="info">
        Dodaj uczestników i korty, żeby rozstawić pierwszą rundę.
      </Notice>
    )
  }

  function update(name: string, seed: Seed | null) {
    const next = { ...seeds }
    if (seed === null) delete next[name]
    else next[name] = seed
    onChange(next)
  }

  // Over-pinning is allowed but pointless: anyone who does not fit falls back
  // to the open draw, so say so rather than silently dropping the pin.
  const overfilled: string[] = []
  courts.forEach((court, courtIndex) => {
    for (const side of ['a', 'b'] as const) {
      const pinned = Object.values(seeds).filter(
        (s) => s.courtIndex === courtIndex && s.side === side,
      ).length
      if (pinned > perSide) overfilled.push(`${court}, ${SIDE_LABEL[side]}`)
    }
    const onCourt = Object.values(seeds).filter((s) => s.courtIndex === courtIndex).length
    if (onCourt > perSide * 2) overfilled.push(court)
  })

  const pinnedCount = Object.keys(seeds).length

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        {pinnedCount === 0
          ? 'Nikt nie jest rozstawiony — cała pierwsza runda zostanie wylosowana.'
          : `Rozstawionych: ${pinnedCount}. Reszta zostanie wylosowana.`}
      </p>

      {overfilled.length ? (
        <Notice tone="warning">
          Za dużo osób przypiętych do: {[...new Set(overfilled)].join('; ')}. Nadmiar trafi do
          losowania.
        </Notice>
      ) : null}

      <ul className="divide-y divide-border rounded-xl border border-border">
        {participants.map((name) => {
          const seed = seeds[name]
          return (
            <li key={name} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <span className={cx('flex-1 text-sm', seed ? 'text-text' : 'text-text-muted')}>
                {name}
              </span>

              <select
                aria-label={`Kort dla ${name}`}
                className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-text"
                value={seed ? String(seed.courtIndex) : ''}
                onChange={(event) => {
                  const value = event.target.value
                  update(name, value === '' ? null : { courtIndex: Number(value), side: seed?.side ?? null })
                }}
              >
                <option value="">losowo</option>
                {courts.map((court, index) => (
                  <option key={court} value={index}>
                    {court}
                  </option>
                ))}
              </select>

              <select
                aria-label={`Strona dla ${name}`}
                disabled={!seed}
                className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-text disabled:opacity-40"
                value={seed?.side ?? ''}
                onChange={(event) => {
                  if (!seed) return
                  const value = event.target.value
                  update(name, { ...seed, side: value === '' ? null : (value as Side) })
                }}
              >
                <option value="">{SIDE_LABEL['']}</option>
                <option value="a">{SIDE_LABEL.a}</option>
                <option value="b">{SIDE_LABEL.b}</option>
              </select>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
