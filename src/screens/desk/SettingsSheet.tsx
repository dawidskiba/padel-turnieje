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
import { Sheet } from '../../ui/Sheet'
import { Button, Notice, TextInput } from '../../ui/primitives'
import { CourtsSection, ParticipantsSection, SectionTitle } from './RosterSections'
import type { CourtActions, ParticipantActions } from './RosterSections'

export interface SettingsActions extends ParticipantActions, CourtActions {
  renameTournament: (name: string) => void
  undoLastRound: () => void
  finish: () => void
  reopen: () => void
  deleteTournament: () => void
}

export function SettingsSheet({
  open,
  onClose,
  bundle,
  state,
  phase,
  actions,
  rosterError,
  courtError,
}: {
  open: boolean
  onClose: () => void
  bundle: TournamentBundle
  state: TournamentState
  phase: TournamentPhase
  actions: SettingsActions
  /**
   * Why the last roster or court change did not land, shown next to the buttons
   * that caused it. These writes used to fail in silence — the tap did nothing
   * and the organiser had no way to tell a rejected write from a slow one.
   */
  rosterError?: string | null
  courtError?: string | null
}) {
  const [name, setName] = useState(bundle.tournament.name)
  const [confirmUndo, setConfirmUndo] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState('')

  if (!open) return null

  const roundsPlayed = state.rounds.length
  const lastRound = roundsPlayed ? Math.max(...state.rounds.map((r) => r.number)) : 0

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
          {state.config.format === 'mexicano' && state.config.scoring === 'courts' ? (
            <p className="text-sm text-text-muted">
              Punkty z wagą kortu: wygrana na wyższym korcie warta więcej.{' '}
              {state.config.neutralRounds === 0
                ? 'Waga kortu liczy się od pierwszej rundy.'
                : `Pierwsze ${state.config.neutralRounds} ${
                    state.config.neutralRounds === 1 ? 'runda' : 'rundy'
                  } bez wagi kortu.`}
            </p>
          ) : null}

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

        <ParticipantsSection state={state} phase={phase} error={rosterError} actions={actions} />

        <CourtsSection state={state} phase={phase} error={courtError} actions={actions} />

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
