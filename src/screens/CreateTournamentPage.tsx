/**
 * One scrolling page, no wizard: the whole configuration is visible at once and
 * any part of it can be revisited before creating. It is six fields.
 *
 * Mexicano-only sections appear when Mexicano is chosen and are absent
 * otherwise, rather than being shown disabled — a formula that cannot apply is
 * noise on a form the organiser fills in standing up.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { buildCreatePayload } from '../data/createPayload'
import { useCreateTournament } from '../data/hooks'
import {
  MAX_GAME_POINTS,
  MIN_GAME_POINTS,
  defaultCourtName,
  defaultRestPoints,
  errorsOf,
  validateDraft,
} from '../domain/validation'
import type { DraftTournament, Issue } from '../domain/validation'
import { PAIRING_FORMULAS, participantsPerSide } from '../domain/types'
import type { Format, PairingFormula, TeamFormat } from '../domain/types'
import { ChipInput } from '../ui/ChipInput'
import { SeedingEditor } from '../ui/SeedingEditor'
import type { Seeds } from '../ui/SeedingEditor'
import { Button, Field, Notice, Panel, TextInput, cx } from '../ui/primitives'

const GAME_POINT_PRESETS = [11, 16, 21]

const FORMULA_LABEL: Record<PairingFormula, string> = {
  '1+4v2+3': '#1+#4 v #2+#3 — zbalansowana',
  '1+2v3+4': '#1+#2 v #3+#4 — silni razem',
  '1+3v2+4': '#1+#3 v #2+#4',
}

function Section({
  title,
  children,
  description,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Panel className="space-y-4 p-5">
      <div>
        <h2 className="font-medium text-text">{title}</h2>
        {description ? <p className="mt-1 text-sm text-text-muted">{description}</p> : null}
      </div>
      {children}
    </Panel>
  )
}

function Choice<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string
  value: T
  onChange: (next: T) => void
  options: Array<{ value: T; label: string }>
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cx(
            'rounded-lg border px-4 py-2.5 text-sm transition-colors',
            value === option.value
              ? 'border-accent bg-accent text-on-accent'
              : 'border-border bg-surface text-text hover:border-accent',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function IssueList({ issues, field }: { issues: Issue[]; field: Issue['field'] }) {
  const relevant = issues.filter((issue) => issue.field === field)
  if (relevant.length === 0) return null
  return (
    <div className="space-y-2">
      {relevant.map((issue, index) => (
        <Notice key={index} tone={issue.level === 'error' ? 'danger' : 'warning'}>
          {issue.message}
        </Notice>
      ))}
    </div>
  )
}

export function CreateTournamentPage() {
  const navigate = useNavigate()
  const create = useCreateTournament()

  const [name, setName] = useState('')
  const [format, setFormat] = useState<Format>('americano')
  const [teamFormat, setTeamFormat] = useState<TeamFormat>('individual')
  const [gamePoints, setGamePoints] = useState(21)
  const [restPoints, setRestPoints] = useState(defaultRestPoints(21))
  // Rest points follow half the game points until the organiser types a value,
  // then stop tracking — otherwise their choice would be silently overwritten.
  const [restPointsTouched, setRestPointsTouched] = useState(false)
  const [pairingFormula, setPairingFormula] = useState<PairingFormula>('1+4v2+3')
  const [participants, setParticipants] = useState<string[]>([])
  const [courts, setCourts] = useState<string[]>([defaultCourtName(0), defaultCourtName(1)])
  const [seeds, setSeeds] = useState<Seeds>({})
  const [showSeeding, setShowSeeding] = useState(false)

  function changeGamePoints(next: number) {
    setGamePoints(next)
    if (!restPointsTouched) setRestPoints(defaultRestPoints(next))
  }

  const draft: DraftTournament = useMemo(
    () => ({
      name,
      format,
      teamFormat,
      gamePoints,
      restPoints,
      pairingFormula: format === 'mexicano' && teamFormat === 'individual' ? pairingFormula : null,
      participants,
      courts,
    }),
    [name, format, teamFormat, gamePoints, restPoints, pairingFormula, participants, courts],
  )

  const issues = useMemo(() => validateDraft(draft), [draft])
  const blocking = errorsOf(issues)
  const isCustomPoints = !GAME_POINT_PRESETS.includes(gamePoints)
  const showFormula = format === 'mexicano' && teamFormat === 'individual'
  const showSeedingSection = format === 'mexicano'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (blocking.length) return

    const created = await create.mutateAsync(buildCreatePayload(draft, seeds))
    navigate(`/turnieje/${created.id}`)
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5 pb-24">
      <h1 className="text-2xl font-medium text-text">Nowy turniej</h1>

      <Section title="Podstawy">
        <Field label="Nazwa turnieju" htmlFor="name">
          <TextInput
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Środa Americano"
            autoFocus
          />
        </Field>
        <IssueList issues={issues} field="name" />

        <Field label="Format">
          <Choice
            name="Format"
            value={format}
            onChange={setFormat}
            options={[
              { value: 'americano', label: 'Americano' },
              { value: 'mexicano', label: 'Mexicano' },
            ]}
          />
        </Field>

        <Field
          label="Skład"
          hint={
            teamFormat === 'teams'
              ? 'Drużyny grają w stałych parach. Wpisujesz jedną nazwę na drużynę.'
              : 'Partnerzy zmieniają się między rundami.'
          }
        >
          <Choice
            name="Skład"
            value={teamFormat}
            onChange={setTeamFormat}
            options={[
              { value: 'individual', label: 'Indywidualny' },
              { value: 'teams', label: 'Drużynowy' },
            ]}
          />
        </Field>
      </Section>

      <Section
        title="Punktacja"
        description="Po wygenerowaniu pierwszej rundy tych ustawień nie da się już zmienić."
      >
        <Field label="Punkty w meczu" hint="Wyniki zawsze sumują się do tej liczby.">
          <div className="flex flex-wrap items-center gap-2">
            {GAME_POINT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => changeGamePoints(preset)}
                aria-pressed={gamePoints === preset}
                className={cx(
                  'rounded-lg border px-4 py-2.5 text-sm transition-colors',
                  gamePoints === preset
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-border bg-surface text-text hover:border-accent',
                )}
              >
                {preset}
              </button>
            ))}
            <label className="flex items-center gap-2 text-sm text-text-muted">
              własne
              <input
                type="number"
                min={MIN_GAME_POINTS}
                max={MAX_GAME_POINTS}
                value={isCustomPoints ? gamePoints : ''}
                placeholder="—"
                onChange={(event) => changeGamePoints(Number(event.target.value))}
                className={cx(
                  'w-20 rounded-lg border bg-bg px-2 py-2 text-text',
                  isCustomPoints ? 'border-accent' : 'border-border',
                )}
              />
            </label>
          </div>
        </Field>
        <IssueList issues={issues} field="gamePoints" />

        <Field
          label="Punkty za pauzę"
          htmlFor="restPoints"
          hint={
            restPointsTouched
              ? undefined
              : `Domyślnie połowa punktów meczu (${defaultRestPoints(gamePoints)}).`
          }
        >
          <TextInput
            id="restPoints"
            type="number"
            min={0}
            value={restPoints}
            onChange={(event) => {
              setRestPointsTouched(true)
              setRestPoints(Number(event.target.value))
            }}
            className="w-28"
          />
        </Field>
        <IssueList issues={issues} field="restPoints" />

        {showFormula ? (
          <Field
            label="Formuła par"
            hint="Jak podzielić czwórkę na korcie, według miejsc w tabeli."
          >
            <div className="space-y-2">
              {PAIRING_FORMULAS.map((formula) => (
                <button
                  key={formula}
                  type="button"
                  role="radio"
                  aria-checked={pairingFormula === formula}
                  onClick={() => setPairingFormula(formula)}
                  className={cx(
                    'block w-full rounded-lg border px-4 py-2.5 text-left text-sm transition-colors',
                    pairingFormula === formula
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-border bg-surface text-text hover:border-accent',
                  )}
                >
                  {FORMULA_LABEL[formula]}
                </button>
              ))}
            </div>
          </Field>
        ) : null}
      </Section>

      <Section title={teamFormat === 'teams' ? `Drużyny (${participants.length})` : `Uczestnicy (${participants.length})`}>
        <ChipInput
          id="participants"
          values={participants}
          onChange={(next) => {
            setParticipants(next)
            // Drop pins for anyone no longer on the list.
            setSeeds((current) =>
              Object.fromEntries(Object.entries(current).filter(([key]) => next.includes(key))),
            )
          }}
          placeholder={teamFormat === 'teams' ? 'Ann & Bob' : 'Ann'}
          emptyHint="Wpisz imię i naciśnij Enter. Możesz też wkleić całą listę naraz."
        />
        <IssueList issues={issues} field="participants" />
      </Section>

      <Section title={`Korty (${courts.length})`}>
        <ChipInput
          id="courts"
          values={courts}
          onChange={setCourts}
          placeholder={defaultCourtName(courts.length)}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCourts([...courts, defaultCourtName(courts.length)])}
        >
          + Dodaj {defaultCourtName(courts.length)}
        </Button>
        <IssueList issues={issues} field="courts" />
      </Section>

      {showSeedingSection ? (
        <Section
          title="Rozstawienie pierwszej rundy"
          description="Opcjonalne. Pierwsza runda Mexicano jest losowana, bo nie ma jeszcze tabeli."
        >
          {showSeeding ? (
            <SeedingEditor
              participants={participants}
              courts={courts}
              perSide={participantsPerSide(teamFormat)}
              seeds={seeds}
              onChange={setSeeds}
            />
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setShowSeeding(true)}>
              Ustaw rozstawienie
            </Button>
          )}
        </Section>
      ) : null}

      {create.error ? (
        <Notice tone="danger">
          {create.error instanceof Error ? create.error.message : 'Nie udało się utworzyć turnieju.'}
        </Notice>
      ) : null}

      <div className="sticky bottom-4 flex justify-end">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={blocking.length > 0 || create.isPending}
        >
          {create.isPending ? 'Tworzę…' : 'Stwórz turniej'}
        </Button>
      </div>
    </form>
  )
}
