/**
 * The right-hand panel: the live table, or every round played so far.
 *
 * Standings stay the default because that is the question players actually
 * walk up and ask. Past rounds are one tap away without leaving the desk, and
 * correcting an old score happens there with the same interaction as a live one.
 */

import { useState } from 'react'

import type { Round, StandingRow } from '../../domain/types'
import { Button, cx } from '../../ui/primitives'
import { CourtCard } from './CourtCard'

type Tab = 'tabela' | 'rundy'

function positionLabel(rows: StandingRow[], index: number): string {
  const row = rows[index]
  const shared = rows.filter((r) => r.position === row.position).length > 1
  return shared ? `=${row.position}` : String(row.position)
}

function StandingsTable({ rows }: { rows: StandingRow[] }) {
  if (rows.length === 0) {
    return <p className="p-4 text-sm text-text-muted">Tabela pojawi się po pierwszej rundzie.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
            <th className="px-2 py-2 font-medium">#</th>
            <th className="px-2 py-2 font-medium">Gracz</th>
            <th className="px-2 py-2 text-right font-medium">Pkt</th>
            <th className="px-2 py-2 text-right font-medium">Różn.</th>
            <th className="px-2 py-2 text-right font-medium">Z-R-P</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.participantId}
              className={cx(
                'border-b border-border/50 last:border-0',
                index === 0 && 'bg-accent/10',
              )}
            >
              <td className="px-2 py-2 tabular-nums text-text-muted">
                {positionLabel(rows, index)}
              </td>
              <td className="px-2 py-2 text-text">
                {row.name}
                {row.retired ? (
                  <span className="ml-2 text-xs text-text-muted" title="Wycofany">
                    RET
                  </span>
                ) : null}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-text">{row.points}</td>
              <td className="px-2 py-2 text-right tabular-nums text-text-muted">
                {row.difference > 0 ? `+${row.difference}` : row.difference}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-text-muted">
                {row.wins}-{row.draws}-{row.losses}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RoundsList({
  rounds,
  courtName,
  nameOf,
  onScore,
}: {
  rounds: Round[]
  courtName: (courtId: string) => string
  nameOf: (participantId: string) => string
  onScore: (roundNumber: number, courtId: string, side: 'a' | 'b') => void
}) {
  if (rounds.length === 0) {
    return <p className="p-4 text-sm text-text-muted">Jeszcze nie rozegrano żadnej rundy.</p>
  }

  return (
    <div className="space-y-5 p-3">
      {[...rounds]
        .sort((a, b) => b.number - a.number)
        .map((round) => (
          <section key={round.number} className="space-y-2">
            <h3 className="text-sm font-medium text-text">
              Runda {round.number}
              {round.isFinal ? <span className="ml-2 text-xs text-accent">ostatnia</span> : null}
            </h3>

            {round.matches.map((match) => (
              <CourtCard
                key={match.courtId}
                courtName={courtName(match.courtId)}
                match={match}
                nameOf={nameOf}
                onScore={(side) => onScore(round.number, match.courtId, side)}
              />
            ))}

            {round.resting.length ? (
              <p className="text-xs text-text-muted">
                Pauza: {round.resting.map(nameOf).join(', ')}
              </p>
            ) : null}
          </section>
        ))}
    </div>
  )
}

export function StandingsPanel({
  standings,
  rounds,
  courtName,
  nameOf,
  onScore,
}: {
  standings: StandingRow[]
  rounds: Round[]
  courtName: (courtId: string) => string
  nameOf: (participantId: string) => string
  onScore: (roundNumber: number, courtId: string, side: 'a' | 'b') => void
}) {
  const [tab, setTab] = useState<Tab>('tabela')

  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="flex gap-1 border-b border-border p-2">
        {(['tabela', 'rundy'] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={tab === value ? 'primary' : 'ghost'}
            onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className="capitalize"
          >
            {value === 'tabela' ? 'Tabela' : 'Rundy'}
          </Button>
        ))}
      </div>

      {tab === 'tabela' ? (
        <StandingsTable rows={standings} />
      ) : (
        <RoundsList
          rounds={rounds}
          courtName={courtName}
          nameOf={nameOf}
          onScore={onScore}
        />
      )}
    </section>
  )
}
