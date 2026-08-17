/**
 * Score entry. The organiser taps a *side*, not a court, and picks that side's
 * score; the opponent's follows, because the two always sum to Game Points.
 *
 * One tap saves and closes. Correcting a score is supported everywhere anyway,
 * so a confirmation step would guard something already trivially reversible —
 * and this is done dozens of times an evening.
 */

import { useState } from 'react'

import { SCORE_GRID_LIMIT } from '../../domain/validation'
import { Sheet } from '../../ui/Sheet'
import { Button, cx } from '../../ui/primitives'

export interface ScoreTarget {
  matchId: string
  courtName: string
  /** The side being scored. */
  sideLabel: string
  opponentLabel: string
  current: number | null
}

function NumberGrid({
  gamePoints,
  current,
  onPick,
}: {
  gamePoints: number
  current: number | null
  onPick: (value: number) => void
}) {
  const values = Array.from({ length: gamePoints + 1 }, (_, i) => i)

  return (
    <div className="grid grid-cols-7 gap-2">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onPick(value)}
          className={cx(
            'rounded-lg border py-3 text-lg tabular-nums transition-colors',
            value === current
              ? 'border-accent bg-accent text-on-accent'
              : 'border-border bg-surface text-text hover:border-accent',
          )}
        >
          {value}
        </button>
      ))}
    </div>
  )
}

/**
 * Above ~30 points a grid becomes a hundred fingertip-sized buttons, which is
 * slower and less accurate than typing two digits.
 */
function Keypad({
  gamePoints,
  onPick,
}: {
  gamePoints: number
  onPick: (value: number) => void
}) {
  const [draft, setDraft] = useState('')
  const value = Number(draft)
  const valid = draft !== '' && Number.isInteger(value) && value >= 0 && value <= gamePoints

  return (
    <div className="space-y-4">
      <p className="text-center text-4xl tabular-nums text-text">{draft || '—'}</p>

      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => setDraft((d) => (d + digit).replace(/^0+(?=\d)/, ''))}
            className="rounded-lg border border-border bg-surface py-4 text-xl text-text hover:border-accent"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setDraft((d) => d.slice(0, -1))}
          className="rounded-lg border border-border bg-surface py-4 text-xl text-text hover:border-accent"
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={() => setDraft((d) => (d + '0').replace(/^0+(?=\d)/, ''))}
          className="rounded-lg border border-border bg-surface py-4 text-xl text-text hover:border-accent"
        >
          0
        </button>
        <Button
          variant="primary"
          disabled={!valid}
          onClick={() => onPick(value)}
          className="py-4"
        >
          Zapisz
        </Button>
      </div>

      {draft !== '' && !valid ? (
        <p className="text-center text-sm text-warning">Podaj liczbę od 0 do {gamePoints}.</p>
      ) : null}
    </div>
  )
}

export function ScoreSheet({
  target,
  gamePoints,
  onClose,
  onSave,
}: {
  target: ScoreTarget | null
  gamePoints: number
  onClose: () => void
  onSave: (value: number) => void
}) {
  if (!target) return null

  const pick = (value: number) => {
    onSave(value)
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={`${target.courtName} — ${target.sideLabel}`} size="lg">
      <div className="mb-5 space-y-1 text-sm text-text-muted">
        <p>
          Ile punktów zdobyli <strong className="text-text">{target.sideLabel}</strong>?
        </p>
        <p>
          {target.opponentLabel} dostaną resztę do {gamePoints}.
        </p>
      </div>

      {gamePoints <= SCORE_GRID_LIMIT ? (
        <NumberGrid gamePoints={gamePoints} current={target.current} onPick={pick} />
      ) : (
        <Keypad gamePoints={gamePoints} onPick={pick} />
      )}
    </Sheet>
  )
}
