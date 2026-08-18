/**
 * The closing view. The evening gets an ending rather than merely stopping:
 * the top three called out, the full table beneath, and the link ready to share
 * with everyone who wants the result later.
 */

import type { StandingRow } from '../../domain/types'
import { Button, Panel } from '../../ui/primitives'

const MEDALS = ['🥇', '🥈', '🥉']

/**
 * The winner reads first, alone, and much larger than anyone else.
 *
 * This started as a literal podium — second, first, third across a row, with the
 * winner raised slightly. It looked like a podium and read like a row of three
 * equals: at a glance the eye lands on whoever is leftmost, and the offsets were
 * far too subtle to say otherwise. Reading order should simply be ranking order.
 *
 * Joint first place is possible: the standings share a position when points,
 * difference and matches won all tie, and a screen that crowns one of them is
 * wrong rather than merely unclear.
 */
function Podium({ rows }: { rows: StandingRow[] }) {
  if (rows.length === 0) return null

  const winners = rows.filter((row) => row.position === rows[0].position)
  const runnersUp = rows
    .filter((row) => row.position !== rows[0].position)
    .filter((row) => row.position <= 3)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-accent bg-accent/10 px-6 py-7 text-center">
        <div className="text-5xl leading-none">{MEDALS[0]}</div>
        <p className="mt-3 text-xs uppercase tracking-widest text-accent">
          {winners.length > 1 ? `Remis na 1. miejscu` : 'Zwycięzca'}
        </p>

        {winners.map((winner) => (
          <p
            key={winner.participantId}
            className="mt-1 text-3xl font-medium leading-tight text-text sm:text-4xl"
          >
            {winner.name}
          </p>
        ))}

        <p className="mt-2 text-2xl tabular-nums text-accent">{rows[0].points} pkt</p>
      </div>

      {runnersUp.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {runnersUp.map((row) => (
            <li
              key={row.participantId}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <span className="text-2xl leading-none">{MEDALS[row.position - 1] ?? ''}</span>
              <span className="text-sm text-text-muted">{row.position}.</span>
              <span className="flex-1 truncate text-text">{row.name}</span>
              <span className="tabular-nums text-text-muted">{row.points}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function FinishedState({
  name,
  standings,
  onShare,
  onOpenSettings,
}: {
  name: string
  standings: StandingRow[]
  onShare: () => void
  onOpenSettings: () => void
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-medium text-text">{name}</h1>
        <p className="mt-1 text-sm text-text-muted">Turniej zakończony</p>
      </div>

      <Podium rows={standings} />

      <Panel className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Gracz</th>
              <th className="px-3 py-2 text-right font-medium">Pkt</th>
              <th className="px-3 py-2 text-right font-medium">Różn.</th>
              <th className="px-3 py-2 text-right font-medium">Z-R-P</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr key={row.participantId} className="border-b border-border/50 last:border-0">
                <td className="px-3 py-2 tabular-nums text-text-muted">{row.position}</td>
                <td className="px-3 py-2 text-text">
                  {row.name}
                  {row.retired ? <span className="ml-2 text-xs text-text-muted">RET</span> : null}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-text">{row.points}</td>
                <td className="px-3 py-2 text-right tabular-nums text-text-muted">
                  {row.difference > 0 ? `+${row.difference}` : row.difference}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-text-muted">
                  {row.wins}-{row.draws}-{row.losses}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="flex justify-between">
        <Button variant="primary" onClick={onShare}>
          Udostępnij wyniki
        </Button>
        <Button variant="ghost" onClick={onOpenSettings} aria-label="Ustawienia">
          ⚙
        </Button>
      </div>
    </div>
  )
}
