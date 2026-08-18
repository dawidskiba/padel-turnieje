/**
 * The desk during play. Courts take two thirds, the live table one third, so
 * the two questions players walk up and ask — what court am I on, where am I —
 * are both answerable without touching the tablet. Stacks on a phone.
 */

import type { ProposedRound, Round, StandingRow } from '../../domain/types'
import { isRoundComplete } from '../../domain/types'
import { Button, Notice, cx } from '../../ui/primitives'
import { CourtCard } from './CourtCard'
import { StandingsPanel } from './StandingsPanel'

export interface RunningActions {
  score: (roundNumber: number, courtId: string, side: 'a' | 'b') => void
  nextRound: () => void
  finalRound: () => void
  confirmProposal: () => void
  discardProposal: () => void
  reshuffleProposal: () => void
  changeResting: () => void
  openSettings: () => void
  share: () => void
}

export function RunningState({
  name,
  currentRound,
  proposal,
  rounds,
  standings,
  courtName,
  nameOf,
  isPending,
  actions,
  saving,
  staleNotice = false,
}: {
  name: string
  currentRound: Round | null
  proposal: ProposedRound | null
  rounds: Round[]
  standings: StandingRow[]
  courtName: (courtId: string) => string
  nameOf: (participantId: string) => string
  isPending: (roundNumber: number, courtId: string) => boolean
  actions: RunningActions
  saving: boolean
  /** The roster changed under this proposal, so it was recomputed. */
  staleNotice?: boolean
}) {
  const showing = proposal ?? currentRound
  const complete = currentRound !== null && isRoundComplete(currentRound)

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-text">{name}</h1>
          <p className="text-sm text-text-muted">
            {proposal
              ? `Propozycja rundy ${proposal.number}`
              : currentRound
                ? `Runda ${currentRound.number}${currentRound.isFinal ? ' — ostatnia' : ''}`
                : 'Przed startem'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={actions.share}>
            Udostępnij
          </Button>
          <Button variant="ghost" size="sm" onClick={actions.openSettings} aria-label="Ustawienia">
            ⚙
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          {showing?.matches.map((match) => (
            <CourtCard
              key={match.courtId}
              courtName={courtName(match.courtId)}
              match={proposal ? { ...match, scoreA: null, scoreB: null } : (match as Round['matches'][number])}
              nameOf={nameOf}
              // A proposal cannot be scored — it does not exist yet.
              onScore={
                proposal || !currentRound
                  ? null
                  : (side) => actions.score(currentRound.number, match.courtId, side)
              }
              pending={!proposal && currentRound ? isPending(currentRound.number, match.courtId) : false}
              dimmed={Boolean(proposal)}
            />
          ))}

          {showing && showing.resting.length > 0 ? (
            <p className="px-1 text-sm text-text-muted">
              Pauza: {showing.resting.map(nameOf).join(', ')}
            </p>
          ) : null}
        </section>

        <StandingsPanel
          standings={standings}
          rounds={rounds}
          courtName={courtName}
          nameOf={nameOf}
          onScore={actions.score}
        />
      </div>

      {proposal ? (
        // Rendered in place rather than in a dialog: what the organiser
        // approves is literally what they will see for the next twenty minutes.
        <div className="sticky bottom-4 rounded-xl border border-accent bg-surface-raised p-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text">
              {proposal.resting.length
                ? `Pauza: ${proposal.resting.map(nameOf).join(', ')}`
                : 'Nikt nie pauzuje.'}
              {proposal.resting.length ? (
                <button
                  type="button"
                  onClick={actions.changeResting}
                  className="ml-3 text-accent underline underline-offset-2"
                >
                  zmień
                </button>
              ) : null}
            </p>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={actions.discardProposal} disabled={saving}>
                Odrzuć
              </Button>
              <Button variant="secondary" onClick={actions.reshuffleProposal} disabled={saving}>
                Przetasuj
              </Button>
              <Button variant="primary" onClick={actions.confirmProposal} disabled={saving}>
                {saving ? 'Zapisuję…' : `Zatwierdź rundę ${proposal.number}`}
              </Button>
            </div>
          </div>

          {staleNotice ? (
            <p className="mt-2 text-xs text-warning">
              Skład albo korty się zmieniły — runda została przeliczona od nowa.
            </p>
          ) : null}

          <p className="mt-2 text-xs text-text-muted">
            Pary ustala algorytm i nie da się ich edytować pojedynczo — ręczna zmiana zepsułaby
            rotację partnerów. „Przetasuj” daje inny, równie dobry układ.
          </p>
        </div>
      ) : (
        <div
          className={cx(
            'sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4',
          )}
        >
          {!complete && currentRound ? (
            <p className="text-sm text-text-muted">Uzupełnij wszystkie wyniki, żeby grać dalej.</p>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <Button variant="secondary" disabled={!complete || saving} onClick={actions.nextRound}>
              Następna runda
            </Button>
            <Button variant="primary" disabled={!complete || saving} onClick={actions.finalRound}>
              Ostatnia runda
            </Button>
          </div>
        </div>
      )}

      {currentRound?.isFinal && complete ? (
        <Notice tone="info">
          Ostatnia runda rozegrana — kończę turniej i pokazuję wyniki.
        </Notice>
      ) : null}
    </div>
  )
}
