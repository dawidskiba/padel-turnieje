/**
 * The participant and court lists, shared by the setup screen and the settings
 * sheet. Before round 1 they are the main thing an organiser edits — the no-show
 * and the late arrival — so they sit on the setup screen itself; during play the
 * same lists live behind the gear.
 *
 * Which exit a row offers follows what is on record for it: nothing counted yet
 * means it can simply go; once a round has counted it, only retiring (a player)
 * or switching off (a court) keeps the past intact.
 */

import { useState } from 'react'

import type { TournamentPhase } from '../../data/mapping'
import type { TournamentState } from '../../domain/types'
import { hasRoundOnRecord } from '../../domain/types'
import { joinCreditPerRound, nextCourtName } from '../../domain/validation'
import { Button, Notice, TextInput, cx } from '../../ui/primitives'

export interface ParticipantActions {
  addParticipant: (name: string, creditMissedRounds: boolean) => void
  retireParticipant: (participantId: string, afterRound: number) => void
  unretireParticipant: (participantId: string) => void
  removeParticipant: (participantId: string) => void
}

export interface CourtActions {
  addCourt: (name: string, position: number) => void
  renameCourt: (courtId: string, name: string) => void
  removeCourt: (courtId: string, fromRound: number) => void
  restoreCourt: (courtId: string) => void
  deleteCourt: (courtId: string) => void
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium uppercase tracking-wide text-text-muted">{children}</h3>
}

function AddParticipant({
  roundsPlayed,
  creditPerRound,
  onAdd,
}: {
  roundsPlayed: number
  /** What one missed round pays — less than a rest, see joinCreditPerRound. */
  creditPerRound: number
  onAdd: (name: string, credit: boolean) => void
}) {
  const [name, setName] = useState('')
  const [credit, setCredit] = useState(true)

  const missed = roundsPlayed

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (!name.trim()) return
        onAdd(name.trim(), credit)
        setName('')
      }}
    >
      <TextInput
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Nowy uczestnik"
        aria-label="Nowy uczestnik"
      />

      {missed > 0 ? (
        <label className="flex items-start gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={credit}
            onChange={(event) => setCredit(event.target.checked)}
            className="mt-1"
          />
          <span>
            Dolicz punkty za {missed} {missed === 1 ? 'pominiętą rundę' : 'pominięte rundy'} (
            {missed * creditPerRound} pkt, po {creditPerRound} za rundę).
            <span className="block text-text-muted">
              Bez tego nowa osoba startuje z zera i nie ma szans w klasyfikacji. Za rundę,
              w której kogoś nie było, liczymy mniej niż za pauzę.
            </span>
          </span>
        </label>
      ) : null}

      <Button type="submit" variant="secondary" size="sm" disabled={!name.trim()}>
        Dodaj
      </Button>
    </form>
  )
}

export function ParticipantsSection({
  state,
  phase,
  error,
  actions,
}: {
  state: TournamentState
  phase: TournamentPhase
  error?: string | null
  actions: ParticipantActions
}) {
  const roundsPlayed = state.rounds.length
  const lastRound = roundsPlayed ? Math.max(...state.rounds.map((r) => r.number)) : 0

  /**
   * A finished tournament is a record, not a work in progress. Adding a player
   * to one changes nothing that can be played and only makes the standings
   * harder to trust — a name with no rounds against it. Reopen it first if
   * something genuinely needs changing.
   */
  const locked = phase === 'finished'

  return (
    <section className="space-y-3">
      <SectionTitle>Uczestnicy ({state.participants.length})</SectionTitle>

      {locked ? (
        <p className="text-sm text-text-muted">
          🔒 Turniej zakończony — składu nie da się już zmienić. Otwórz turniej ponownie,
          jeśli musisz coś poprawić.
        </p>
      ) : null}

      <ul className="divide-y divide-border rounded-lg border border-border">
        {state.participants.map((participant) => (
          <li key={participant.id} className="flex items-center gap-3 px-3 py-2">
            <span
              className={cx(
                'flex-1 text-sm',
                participant.retiredAfterRound !== null ? 'text-text-muted' : 'text-text',
              )}
            >
              {participant.name}
              {participant.retiredAfterRound !== null ? (
                <span className="ml-2 text-xs">RET po rundzie {participant.retiredAfterRound}</span>
              ) : null}
              {participant.joinedRound > 1 ? (
                <span className="ml-2 text-xs text-text-muted">
                  dołączył od rundy {participant.joinedRound}
                </span>
              ) : null}
            </span>

            {locked ? null : (
              <div className="flex items-center gap-1">
                {participant.retiredAfterRound !== null ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => actions.unretireParticipant(participant.id)}
                  >
                    Przywróć
                  </Button>
                ) : hasRoundOnRecord(state, participant.id) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => actions.retireParticipant(participant.id, lastRound)}
                  >
                    Wycofaj
                  </Button>
                ) : null}

                {/*
                  Nobody a round has counted can be deleted — retiring is the
                  only exit once there are points to preserve. Before the first
                  round that is everyone, which is the whole point: a no-show
                  should leave no trace, and "Wycofaj" here would leave a name in
                  the standings marked RET with nothing behind it.
                */}
                {hasRoundOnRecord(state, participant.id) ? null : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:text-danger hover:bg-danger/10"
                    onClick={() => actions.removeParticipant(participant.id)}
                  >
                    Usuń
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {locked ? null : (
        <AddParticipant
          roundsPlayed={roundsPlayed}
          creditPerRound={joinCreditPerRound(state.config.gamePoints, state.config.restPoints)}
          onAdd={actions.addParticipant}
        />
      )}
    </section>
  )
}

export function CourtsSection({
  state,
  phase,
  error,
  actions,
}: {
  state: TournamentState
  phase: TournamentPhase
  error?: string | null
  actions: CourtActions
}) {
  const roundsPlayed = state.rounds.length
  const lastRound = roundsPlayed ? Math.max(...state.rounds.map((r) => r.number)) : 0
  const nextRound = lastRound + 1
  const locked = phase === 'finished'
  const nextPosition = Math.max(0, ...state.courts.map((c) => c.position)) + 1
  const newCourtName = nextCourtName(state.courts.map((c) => c.name))

  return (
    <section className="space-y-3">
      <SectionTitle>Korty ({state.courts.filter((c) => c.removedFromRound === null).length})</SectionTitle>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {state.courts.map((court) => {
          const removed = court.removedFromRound !== null
          return (
            <li key={court.id} className="flex items-center gap-2 px-3 py-2">
              <TextInput
                defaultValue={court.name}
                aria-label={`Nazwa kortu ${court.name}`}
                disabled={locked}
                className={cx('flex-1 py-1.5 text-sm', (removed || locked) && 'opacity-50')}
                onBlur={(event) => {
                  const next = event.target.value.trim()
                  if (next && next !== court.name) actions.renameCourt(court.id, next)
                }}
              />
              {locked ? null : removed ? (
                <Button size="sm" variant="ghost" onClick={() => actions.restoreCourt(court.id)}>
                  Przywróć
                </Button>
              ) : roundsPlayed === 0 ? (
                // Nothing has been played on it, so there is nothing to keep.
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:text-danger hover:bg-danger/10"
                  onClick={() => actions.deleteCourt(court.id)}
                >
                  Usuń
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => actions.removeCourt(court.id, nextRound)}
                >
                  Wyłącz
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      {locked ? (
        <p className="text-sm text-text-muted">🔒 Turniej zakończony — kortów nie da się już zmienić.</p>
      ) : roundsPlayed > 0 ? (
        <p className="text-sm text-text-muted">
          Zmiany kortów obowiązują od następnej rundy. Rozegrane rundy zostają bez zmian.
        </p>
      ) : null}

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {locked ? null : (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => actions.addCourt(newCourtName, nextPosition)}
        >
          + Dodaj {newCourtName}
        </Button>
      )}
    </section>
  )
}
