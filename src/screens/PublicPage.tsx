/**
 * What a player sees on their phone. Read-only in the strongest sense:
 * anonymous clients have no write path at all, and no table access either —
 * everything here comes from one security-definer function (ADR-0002).
 *
 * The page polls while its tab is visible. Realtime was not available to us:
 * postgres_changes respects RLS, and a client with no table access receives no
 * events.
 */

import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { PUBLIC_POLL_MS, usePublicTournament } from '../data/hooks'
import { describeViewer, readViewerName, viewerCandidates, writeViewerName } from '../data/publicView'
import type { ViewerSituation } from '../data/publicView'
import type { PublicTournament } from '../lib/database.types'
import { formatSide } from '../ui/format'
import { Button, Notice, Panel, Spinner, cx } from '../ui/primitives'

function IdentityPicker({
  names,
  onPick,
  onSkip,
}: {
  names: string[]
  onPick: (name: string) => void
  onSkip: () => void
}) {
  return (
    <Panel className="space-y-4 p-5">
      <h2 className="font-medium text-text">Kto jesteś?</h2>
      <p className="text-sm text-text-muted">
        Zapamiętam na tym telefonie i od razu pokażę, gdzie grasz.
      </p>

      <ul className="flex flex-wrap gap-2">
        {names.map((name) => (
          <li key={name}>
            <Button variant="secondary" size="sm" onClick={() => onPick(name)}>
              {name}
            </Button>
          </li>
        ))}
      </ul>

      <Button variant="ghost" size="sm" onClick={onSkip}>
        Pomiń — tylko oglądam
      </Button>
    </Panel>
  )
}

function YourMatch({ situation, viewer }: { situation: ViewerSituation; viewer: string }) {
  if (situation.kind === 'playing') {
    const { court, partners, opponents, yourScore, theirScore } = situation
    return (
      <Panel className="border-accent bg-accent/10 p-4">
        <p className="text-xs uppercase tracking-wide text-accent">Ty — {viewer}</p>
        <p className="mt-1 text-lg text-text">
          <strong>{court}</strong>
          {partners.length ? <> , z {partners.join(' i ')}</> : null}
        </p>
        <p className="text-sm text-text-muted">przeciw {opponents.join(' i ')}</p>
        {yourScore !== null ? (
          <p className="mt-2 text-2xl tabular-nums text-text">
            {yourScore} : {theirScore}
          </p>
        ) : (
          <p className="mt-2 text-sm text-text-muted">— w trakcie —</p>
        )}
      </Panel>
    )
  }

  if (situation.kind === 'resting') {
    return (
      <Panel className="p-4">
        <p className="text-xs uppercase tracking-wide text-text-muted">Ty — {viewer}</p>
        <p className="mt-1 text-lg text-text">Pauzujesz w tej rundzie.</p>
        <p className="text-sm text-text-muted">Punkty za pauzę doliczą się automatycznie.</p>
      </Panel>
    )
  }

  return null
}

function CurrentRound({ payload }: { payload: PublicTournament }) {
  const round = payload.current_round
  if (!round) {
    return <Notice tone="info">Turniej jeszcze się nie zaczął.</Notice>
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
        Runda {round.number}
        {round.is_final ? <span className="ml-2 text-accent">ostatnia</span> : null}
      </h2>

      {round.matches.map((match) => {
        const scored = match.score_a !== null && match.score_b !== null
        return (
          <div
            key={match.court}
            className={cx(
              'rounded-xl border bg-surface p-3',
              scored ? 'border-accent/40' : 'border-border',
            )}
          >
            <p className="text-xs uppercase tracking-wide text-text-muted">{match.court}</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="text-text">{formatSide(match.side_a ?? [])}</span>
              <span className="shrink-0 tabular-nums text-text">
                {scored ? `${match.score_a} : ${match.score_b}` : '—'}
              </span>
              <span className="text-right text-text">{formatSide(match.side_b ?? [])}</span>
            </div>
          </div>
        )
      })}

      {round.resting.length ? (
        <p className="text-sm text-text-muted">Pauza: {round.resting.join(', ')}</p>
      ) : null}
    </section>
  )
}

function StandingsTable({
  payload,
  viewer,
}: {
  payload: PublicTournament
  viewer: string | null
}) {
  if (payload.standings.length === 0) return null

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">Tabela</h2>
      <Panel className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Gracz</th>
              <th className="px-3 py-2 text-right font-medium">Pkt</th>
              <th className="px-3 py-2 text-right font-medium">Różn.</th>
            </tr>
          </thead>
          <tbody>
            {payload.standings.map((row, index) => (
              <tr
                key={row.name}
                className={cx(
                  'border-b border-border/50 last:border-0',
                  row.name === viewer && 'bg-accent/10',
                )}
              >
                <td className="px-3 py-2 tabular-nums text-text-muted">{index + 1}</td>
                <td className="px-3 py-2 text-text">
                  {row.name}
                  {row.retired ? <span className="ml-2 text-xs text-text-muted">RET</span> : null}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-text">{row.points}</td>
                <td className="px-3 py-2 text-right tabular-nums text-text-muted">
                  {row.difference > 0 ? `+${row.difference}` : row.difference}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </section>
  )
}

export function PublicPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data, isLoading, error } = usePublicTournament(slug)

  const [viewer, setViewer] = useState<string | null>(() =>
    slug ? readViewerName(slug) : null,
  )
  const [skipped, setSkipped] = useState(false)

  if (isLoading) return <Spinner label="Wczytuję…" />

  if (error) {
    return (
      <Notice tone="danger">
        {error instanceof Error ? error.message : 'Nie udało się wczytać turnieju.'}
      </Notice>
    )
  }

  if (!data) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl text-text">Nie ma takiego turnieju.</h1>
        <p className="mt-2 text-text-muted">Sprawdź link albo poproś organizatora o nowy.</p>
      </div>
    )
  }

  const situation = describeViewer(data, viewer)
  const askWhoYouAre = !viewer && !skipped && data.standings.length > 0

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-medium text-text">{data.tournament.name}</h1>
        <p className="text-sm text-text-muted">
          {data.tournament.finished ? 'Turniej zakończony' : `Mecz do ${data.tournament.game_points} pkt`}
        </p>
      </header>

      {askWhoYouAre ? (
        <IdentityPicker
          names={viewerCandidates(data)}
          onPick={(name) => {
            setViewer(name)
            if (slug) writeViewerName(slug, name)
          }}
          onSkip={() => setSkipped(true)}
        />
      ) : null}

      {viewer && !data.tournament.finished ? (
        <YourMatch situation={situation} viewer={viewer} />
      ) : null}

      {!data.tournament.finished ? <CurrentRound payload={data} /> : null}

      <StandingsTable payload={data} viewer={viewer} />

      <footer className="flex items-center justify-between pt-2 text-xs text-text-muted">
        <span>Odświeżam co {Math.round(PUBLIC_POLL_MS / 1000)} s</span>
        {viewer ? (
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => {
              setViewer(null)
              setSkipped(false)
              if (slug) writeViewerName(slug, null)
            }}
          >
            To nie ja ({viewer})
          </button>
        ) : null}
      </footer>
    </div>
  )
}
