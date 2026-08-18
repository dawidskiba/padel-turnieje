/**
 * Before round 1. Shows what was configured, keeps the scoring settings
 * editable here and nowhere later, and surfaces the warnings that only become
 * visible once the roster and the courts are both known.
 *
 * Mexicano seeding lives here too, which is what lets an organiser pin the draw
 * and close the tab before play starts.
 */

import { useState } from 'react'

import type { TournamentState } from '../../domain/types'
import { matchCount, participantsPerMatch, participantsPerSide } from '../../domain/types'
import { defaultRestPoints, validateDraft } from '../../domain/validation'
import { SeedingEditor } from '../../ui/SeedingEditor'
import type { Seeds } from '../../ui/SeedingEditor'
import { Button, Notice, NumberInput, Panel, cx } from '../../ui/primitives'

const GAME_POINT_PRESETS = [11, 16, 21]

export interface SetupActions {
  updateScoring: (scoring: { gamePoints: number; restPoints: number }) => void
  updateSeed: (participantId: string, seedCourtId: string | null, seedSide: 'a' | 'b' | null) => void
  start: () => void
  openSettings: () => void
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span className="text-sm text-text-muted">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

export function SetupState({
  state,
  actions,
}: {
  state: TournamentState
  actions: SetupActions
}) {
  const [gamePoints, setGamePoints] = useState(state.config.gamePoints)
  const [restPoints, setRestPoints] = useState(state.config.restPoints)
  const [showSeeding, setShowSeeding] = useState(false)

  const perMatch = participantsPerMatch(state.config.teamFormat)
  const matches = matchCount(state, 1)
  const resting = state.participants.length - matches * perMatch
  const dirty =
    gamePoints !== state.config.gamePoints || restPoints !== state.config.restPoints

  const issues = validateDraft({
    name: 'x',
    format: state.config.format,
    teamFormat: state.config.teamFormat,
    gamePoints,
    restPoints,
    pairingFormula: state.config.pairingFormula,
    scoring: state.config.scoring,
    neutralRounds: state.config.neutralRounds,
    participants: state.participants.map((p) => p.name),
    courts: state.courts.map((c) => c.name),
  })
  const blocking = issues.filter((i) => i.level === 'error')

  // The seeding editor speaks in court indexes and participant names; the
  // database speaks in ids. Translate at the boundary.
  const seeds: Seeds = Object.fromEntries(
    state.participants
      .filter((p) => p.seedCourtId)
      .map((p) => [
        p.name,
        {
          courtIndex: state.courts.findIndex((c) => c.id === p.seedCourtId),
          side: p.seedSide,
        },
      ])
      .filter(([, seed]) => (seed as { courtIndex: number }).courtIndex >= 0),
  )

  function onSeedsChange(next: Seeds) {
    for (const participant of state.participants) {
      const before = seeds[participant.name]
      const after = next[participant.name]
      if (before?.courtIndex === after?.courtIndex && before?.side === after?.side) continue

      actions.updateSeed(
        participant.id,
        after ? (state.courts[after.courtIndex]?.id ?? null) : null,
        after?.side ?? null,
      )
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Panel className="divide-y divide-border px-5">
        <Row label="Uczestnicy">
          <span className="text-text">{state.participants.length}</span>
          <Button size="sm" variant="ghost" onClick={actions.openSettings}>
            Zarządzaj
          </Button>
        </Row>

        <Row label="Korty">
          <span className="text-text">{state.courts.length}</span>
          <Button size="sm" variant="ghost" onClick={actions.openSettings}>
            Zarządzaj
          </Button>
        </Row>

        <Row label="Punkty w meczu">
          <div className="flex flex-wrap items-center gap-2">
            {GAME_POINT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={gamePoints === preset}
                onClick={() => {
                  setGamePoints(preset)
                  if (restPoints === defaultRestPoints(gamePoints)) {
                    setRestPoints(defaultRestPoints(preset))
                  }
                }}
                className={cx(
                  'rounded-lg border px-3 py-2 text-sm transition-colors',
                  gamePoints === preset
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-border bg-surface text-text hover:border-accent',
                )}
              >
                {preset}
              </button>
            ))}
            <NumberInput
              min={1}
              max={99}
              value={gamePoints}
              onValue={setGamePoints}
              className="w-20 py-2"
              aria-label="Punkty w meczu"
            />
          </div>
        </Row>

        {state.config.format === 'mexicano' ? (
          <Row label="Liczenie punktów">
            <span className="text-text">
              {state.config.scoring === 'courts'
                ? `z wagą kortu, ${state.config.neutralRounds} ${
                    state.config.neutralRounds === 1 ? 'runda' : 'rundy'
                  } bez wagi`
                : 'zdobyte punkty'}
            </span>
          </Row>
        ) : null}

        <Row label="Punkty za pauzę">
          <NumberInput
            min={0}
            value={restPoints}
            onValue={setRestPoints}
            className="w-20 py-2"
            aria-label="Punkty za pauzę"
          />
        </Row>
      </Panel>

      {dirty ? (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setGamePoints(state.config.gamePoints)
              setRestPoints(state.config.restPoints)
            }}
          >
            Cofnij
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={blocking.length > 0}
            onClick={() => actions.updateScoring({ gamePoints, restPoints })}
          >
            Zapisz punktację
          </Button>
        </div>
      ) : null}

      {issues.map((issue, index) => (
        <Notice key={index} tone={issue.level === 'error' ? 'danger' : 'warning'}>
          {issue.message}
        </Notice>
      ))}

      {matches > 0 && resting > 0 ? (
        <p className="text-sm text-text-muted">
          {matches} {matches === 1 ? 'mecz' : 'mecze'} na rundę, {resting}{' '}
          {resting === 1 ? 'osoba pauzuje' : 'osób pauzuje'}.
        </p>
      ) : null}

      {state.config.format === 'mexicano' ? (
        <Panel className="space-y-4 p-5">
          <div>
            <h2 className="font-medium text-text">Rozstawienie pierwszej rundy</h2>
            <p className="mt-1 text-sm text-text-muted">
              Opcjonalne. Pierwsza runda Mexicano jest losowana — tu możesz przypiąć wybrane osoby
              do kortu i strony.
            </p>
          </div>

          {showSeeding ? (
            <SeedingEditor
              participants={state.participants.map((p) => p.name)}
              courts={state.courts.map((c) => c.name)}
              perSide={participantsPerSide(state.config.teamFormat)}
              seeds={seeds}
              onChange={onSeedsChange}
            />
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setShowSeeding(true)}>
              Ustaw rozstawienie
            </Button>
          )}
        </Panel>
      ) : null}

      <div className="flex justify-center pt-2">
        <Button
          variant="primary"
          size="lg"
          disabled={matches === 0 || blocking.length > 0 || dirty}
          onClick={actions.start}
        >
          Rozpocznij turniej
        </Button>
      </div>

      {dirty ? (
        <p className="text-center text-sm text-text-muted">
          Zapisz punktację, zanim zaczniesz.
        </p>
      ) : null}
    </div>
  )
}
