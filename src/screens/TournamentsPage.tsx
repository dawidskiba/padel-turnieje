import { Link } from 'react-router-dom'

import { useTournaments } from '../data/hooks'
import { roundCountOf } from '../data/tournaments'
import type { TournamentListRow } from '../data/tournaments'
import { Button, Card, EmptyState, Notice, Spinner, cx } from '../ui/primitives'

const dateFormat = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

type Phase = 'setup' | 'running' | 'finished'

function phaseOf(row: TournamentListRow): Phase {
  if (row.finished_at) return 'finished'
  return roundCountOf(row) === 0 ? 'setup' : 'running'
}

const PHASE_LABEL: Record<Phase, string> = {
  setup: 'przed startem',
  running: 'w trakcie',
  finished: 'zakończony',
}

const PHASE_STYLE: Record<Phase, string> = {
  setup: 'border-border text-text-muted',
  running: 'border-accent text-accent',
  finished: 'border-border text-text-muted',
}

const FORMAT_LABEL = { americano: 'Americano', mexicano: 'Mexicano' } as const
const TEAM_LABEL = { individual: 'indywidualnie', teams: 'drużynowo' } as const

function TournamentCard({ row }: { row: TournamentListRow }) {
  const phase = phaseOf(row)
  const rounds = roundCountOf(row)

  return (
    <li>
      <Link
        to={`/turnieje/${row.id}`}
        className="block rounded-xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Card className="hover:border-accent">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <h2 className="text-lg font-medium text-text">{row.name}</h2>
            <span
              className={cx(
                'rounded-full border px-2.5 py-0.5 text-xs',
                PHASE_STYLE[phase],
              )}
            >
              {PHASE_LABEL[phase]}
            </span>
          </div>

          <p className="mt-2 text-sm text-text-muted">
            {FORMAT_LABEL[row.format]} · {TEAM_LABEL[row.team_format]} · do {row.game_points} pkt
            {rounds > 0 ? ` · ${rounds} ${rounds === 1 ? 'runda' : 'rund'}` : ''}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {dateFormat.format(new Date(row.created_at))}
          </p>
        </Card>
      </Link>
    </li>
  )
}

export function TournamentsPage() {
  const { data, isLoading, error } = useTournaments()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-medium text-text">Moje turnieje</h1>
        <Link to="/turnieje/nowy">
          <Button variant="primary" size="md">
            Nowy turniej
          </Button>
        </Link>
      </div>

      {isLoading ? <Spinner /> : null}

      {error ? (
        <Notice tone="danger">
          {error instanceof Error ? error.message : 'Nie udało się wczytać turniejów.'}
        </Notice>
      ) : null}

      {data && data.length === 0 ? (
        <EmptyState title="Nie masz jeszcze żadnego turnieju.">
          <Link to="/turnieje/nowy">
            <Button variant="primary">Stwórz pierwszy</Button>
          </Link>
        </EmptyState>
      ) : null}

      {data && data.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.map((row) => (
            <TournamentCard key={row.id} row={row} />
          ))}
        </ul>
      ) : null}
    </div>
  )
}
