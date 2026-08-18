/**
 * Everything that is not scoring, behind one gear.
 *
 * Off the main surface so nothing destructive is a stray tap during play, but
 * one gesture away when someone twists an ankle. Locked settings are shown
 * rather than hidden — an organiser who wonders why they cannot change the
 * target deserves an answer.
 */

import { useState } from 'react'

import type { TournamentBundle, TournamentPhase } from '../../data/mapping'
import type { TournamentState } from '../../domain/types'
import { defaultCourtName } from '../../domain/validation'
import { Sheet } from '../../ui/Sheet'
import { Button, Notice, TextInput, cx } from '../../ui/primitives'

export interface SettingsActions {
  addParticipant: (name: string, creditMissedRounds: boolean) => void
  retireParticipant: (participantId: string, afterRound: number) => void
  unretireParticipant: (participantId: string) => void
  addCourt: (name: string, position: number) => void
  renameCourt: (courtId: string, name: string) => void
  removeCourt: (courtId: string, fromRound: number) => void
  restoreCourt: (courtId: string) => void
  renameTournament: (name: string) => void
  undoLastRound: () => void
  finish: () => void
  reopen: () => void
  deleteTournament: () => void
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium uppercase tracking-wide text-text-muted">{children}</h3>
}

function AddParticipant({
  roundsPlayed,
  restPoints,
  onAdd,
}: {
  roundsPlayed: number
  restPoints: number
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
            {missed * restPoints} pkt).
            <span className="block text-text-muted">
              Bez tego nowa osoba startuje z zera i nie ma szans w klasyfikacji.
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

export function SettingsSheet({
  open,
  onClose,
  bundle,
  state,
  phase,
  actions,
}: {
  open: boolean
  onClose: () => void
  bundle: TournamentBundle
  state: TournamentState
  phase: TournamentPhase
  actions: SettingsActions
}) {
  const [name, setName] = useState(bundle.tournament.name)
  const [confirmUndo, setConfirmUndo] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState('')

  if (!open) return null

  const roundsPlayed = state.rounds.length
  const lastRound = roundsPlayed ? Math.max(...state.rounds.map((r) => r.number)) : 0
  const nextRound = lastRound + 1

  /**
   * A finished tournament is a record, not a work in progress. Adding a player
   * or a court to one changes nothing that can be played and only makes the
   * standings harder to trust — a name with no rounds against it, or a court
   * that hosted nothing. Reopen it first if something genuinely needs changing.
   */
  const locked = phase === 'finished'

  return (
    <Sheet open onClose={onClose} title="Ustawienia" size="lg">
      <div className="space-y-7">
        <section className="space-y-3">
          <SectionTitle>Nazwa</SectionTitle>
          <div className="flex gap-2">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} />
            <Button
              variant="secondary"
              disabled={!name.trim() || name === bundle.tournament.name}
              onClick={() => actions.renameTournament(name.trim())}
            >
              Zapisz
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle>Punktacja</SectionTitle>
          {phase === 'setup' ? (
            <p className="text-sm text-text-muted">
              Mecz do {state.config.gamePoints} pkt · pauza {state.config.restPoints} pkt. Można
              jeszcze zmienić na ekranie startowym.
            </p>
          ) : (
            <p className="text-sm text-text-muted">
              🔒 Mecz do {state.config.gamePoints} pkt · pauza {state.config.restPoints} pkt.
              <span className="block">
                Zablokowane od pierwszej rundy — zmiana unieważniłaby już zapisane wyniki.
              </span>
            </p>
          )}
        </section>

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
                    <span className="ml-2 text-xs">
                      RET po rundzie {participant.retiredAfterRound}
                    </span>
                  ) : null}
                  {participant.joinedRound > 1 ? (
                    <span className="ml-2 text-xs text-text-muted">
                      dołączył od rundy {participant.joinedRound}
                    </span>
                  ) : null}
                </span>

                {locked ? null : participant.retiredAfterRound !== null ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => actions.unretireParticipant(participant.id)}
                  >
                    Przywróć
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => actions.retireParticipant(participant.id, lastRound)}
                  >
                    Wycofaj
                  </Button>
                )}
              </li>
            ))}
          </ul>

          {locked ? null : (
            <AddParticipant
              roundsPlayed={roundsPlayed}
              restPoints={state.config.restPoints}
              onAdd={actions.addParticipant}
            />
          )}
        </section>

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
                    className={cx(
                      'flex-1 py-1.5 text-sm',
                      (removed || locked) && 'opacity-50',
                    )}
                    onBlur={(event) => {
                      const next = event.target.value.trim()
                      if (next && next !== court.name) actions.renameCourt(court.id, next)
                    }}
                  />
                  {locked ? null : removed ? (
                    <Button size="sm" variant="ghost" onClick={() => actions.restoreCourt(court.id)}>
                      Przywróć
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

          <p className="text-sm text-text-muted">
            {locked
              ? '🔒 Turniej zakończony — kortów nie da się już zmienić.'
              : 'Zmiany kortów obowiązują od następnej rundy. Rozegrane rundy zostają bez zmian.'}
          </p>

          {locked ? null : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                actions.addCourt(defaultCourtName(state.courts.length), state.courts.length + 1)
              }
            >
              + Dodaj {defaultCourtName(state.courts.length)}
            </Button>
          )}
        </section>

        <section className="space-y-3">
          <SectionTitle>Runda</SectionTitle>

          {roundsPlayed === 0 ? (
            <p className="text-sm text-text-muted">Nie rozegrano jeszcze żadnej rundy.</p>
          ) : confirmUndo ? (
            <div className="space-y-3">
              <Notice tone="danger">
                Cofnięcie rundy {lastRound} usunie jej pary i wyniki. Nie da się tego odwrócić.
              </Notice>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setConfirmUndo(false)}>
                  Anuluj
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    actions.undoLastRound()
                    setConfirmUndo(false)
                  }}
                >
                  Tak, cofnij rundę {lastRound}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setConfirmUndo(true)}>
              Cofnij rundę {lastRound}
            </Button>
          )}
        </section>

        <section className="space-y-3">
          <SectionTitle>Turniej</SectionTitle>
          {phase === 'finished' ? (
            <Button variant="secondary" onClick={actions.reopen}>
              Otwórz ponownie
            </Button>
          ) : (
            <Button variant="secondary" disabled={roundsPlayed === 0} onClick={actions.finish}>
              Zakończ turniej
            </Button>
          )}
        </section>

        <section className="space-y-3 border-t border-border pt-6">
          <SectionTitle>Usuń turniej</SectionTitle>
          <Notice tone="danger">
            Usunięcie jest nieodwracalne. Zniknie cała historia: rundy, wyniki i tabela. Link
            publiczny przestanie działać.
          </Notice>

          {/*
            Typing the name is deliberate friction. Every other destructive
            action here can be undone or redone; this one cannot, and it sits in
            the same sheet as buttons the organiser taps routinely mid-match.
          */}
          <label className="block text-sm text-text">
            Wpisz nazwę turnieju, żeby potwierdzić:
            <TextInput
              value={confirmDelete}
              onChange={(event) => setConfirmDelete(event.target.value)}
              placeholder={bundle.tournament.name}
              className="mt-2"
            />
          </label>

          <Button
            variant="danger"
            disabled={confirmDelete.trim() !== bundle.tournament.name}
            onClick={actions.deleteTournament}
          >
            Usuń „{bundle.tournament.name}” na zawsze
          </Button>
        </section>
      </div>
    </Sheet>
  )
}
