/**
 * One court in the current round. Each side is a button: tapping it opens the
 * score sheet for that side.
 */

import type { Match } from '../../domain/types'
import { formatSide } from '../../ui/format'
import { cx } from '../../ui/primitives'

export interface CourtCardProps {
  courtName: string
  match: Pick<Match, 'sideA' | 'sideB' | 'scoreA' | 'scoreB'>
  nameOf: (participantId: string) => string
  /** Null while a round is only proposed and cannot be scored yet. */
  onScore: ((side: 'a' | 'b') => void) | null
  pending?: boolean
  dimmed?: boolean
}

function sideLabel(ids: string[], nameOf: (id: string) => string): string {
  return formatSide(ids.map(nameOf))
}

function Side({
  label,
  score,
  onClick,
  winner,
}: {
  label: string
  score: number | null
  onClick: (() => void) | null
  winner: boolean
}) {
  const content = (
    <>
      <span className="flex-1 text-left">{label}</span>
      <span
        className={cx(
          'w-12 shrink-0 text-right text-2xl tabular-nums',
          score === null ? 'text-text-muted' : winner ? 'text-accent' : 'text-text',
        )}
      >
        {score ?? '—'}
      </span>
    </>
  )

  if (!onClick) {
    return <div className="flex items-center gap-3 px-3 py-3 text-text">{content}</div>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-text transition-colors hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      {content}
    </button>
  )
}

export function CourtCard({
  courtName,
  match,
  nameOf,
  onScore,
  pending = false,
  dimmed = false,
}: CourtCardProps) {
  const scored = match.scoreA !== null && match.scoreB !== null

  return (
    <article
      className={cx(
        'rounded-xl border bg-surface p-2 transition-opacity',
        scored ? 'border-accent/40' : 'border-border',
        dimmed && 'opacity-70',
      )}
    >
      <header className="flex items-center justify-between px-3 pb-1 pt-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-text-muted">
          {courtName}
        </h3>
        {pending ? (
          <span className="text-xs text-warning">⏳ oczekuje</span>
        ) : scored ? (
          <span className="text-xs text-accent">✓</span>
        ) : null}
      </header>

      <Side
        label={sideLabel(match.sideA, nameOf)}
        score={match.scoreA}
        onClick={onScore ? () => onScore('a') : null}
        winner={scored && match.scoreA! > match.scoreB!}
      />
      <div className="px-3 text-xs text-text-muted">vs</div>
      <Side
        label={sideLabel(match.sideB, nameOf)}
        score={match.scoreB}
        onClick={onScore ? () => onScore('b') : null}
        winner={scored && match.scoreB! > match.scoreA!}
      />
    </article>
  )
}
