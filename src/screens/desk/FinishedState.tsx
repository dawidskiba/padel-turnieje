/**
 * The closing view. The evening gets an ending rather than merely stopping:
 * the top three called out, the full table beneath, and the link ready to share
 * with everyone who wants the result later.
 */

import type { StandingRow } from '../../domain/types'
import { Button, Panel, cx } from '../../ui/primitives'

const MEDALS = ['🥇', '🥈', '🥉']

function Podium({ rows }: { rows: StandingRow[] }) {
  const top = rows.slice(0, 3)
  if (top.length === 0) return null

  // Second, first, third — so the winner stands in the middle where a podium
  // puts them, rather than reading as a plain list.
  const order = top.length >= 3 ? [1, 0, 2] : top.map((_, i) => i)
  const heights = ['pt-8', 'pt-0', 'pt-12']

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6">
      {order.map((index) => {
        const row = top[index]
        if (!row) return null
        return (
          <div key={row.participantId} className={cx('text-center', heights[index])}>
            <div className="text-3xl sm:text-4xl">{MEDALS[index]}</div>
            <div className="mt-2 text-sm text-text-muted">{index + 1}</div>
            <div className="text-base font-medium text-text sm:text-lg">{row.name}</div>
            <div className="text-2xl tabular-nums text-accent">{row.points}</div>
          </div>
        )
      })}
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
