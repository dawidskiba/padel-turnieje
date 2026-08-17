/**
 * Create-form validation, per requirements-americano.md §1.1.
 *
 * Two severities, and the distinction matters: errors are configurations that
 * cannot produce a tournament, warnings are ones the organiser may well want.
 * Never block something merely unusual.
 */

import { participantsPerMatch } from './types'
import type { Format, PairingFormula, TeamFormat } from './types'

export type IssueLevel = 'error' | 'warning'

export interface Issue {
  level: IssueLevel
  field: 'name' | 'participants' | 'courts' | 'gamePoints' | 'restPoints'
  /** Polish, ready to show. */
  message: string
}

export interface DraftTournament {
  name: string
  format: Format
  teamFormat: TeamFormat
  gamePoints: number
  restPoints: number
  pairingFormula: PairingFormula | null
  participants: string[]
  courts: string[]
}

export const MIN_GAME_POINTS = 1
export const MAX_GAME_POINTS = 99

/** Above this, the score popup switches from a number grid to a keypad. */
export const SCORE_GRID_LIMIT = 30

/** Rest points track half the game points until the organiser sets them. */
export function defaultRestPoints(gamePoints: number): number {
  return Math.ceil(gamePoints / 2)
}

export function defaultCourtName(index: number): string {
  return `Kort ${index + 1}`
}

/** Names are unique case-insensitively, so "ann" cannot join "Ann". */
function duplicates(names: string[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const name of names) {
    const key = name.trim().toLowerCase()
    if (!key) continue
    if (seen.has(key)) dupes.add(name.trim())
    seen.add(key)
  }
  return [...dupes]
}

export function validateDraft(draft: DraftTournament): Issue[] {
  const issues: Issue[] = []
  const perMatch = participantsPerMatch(draft.teamFormat)
  const participants = draft.participants.map((n) => n.trim()).filter(Boolean)
  const courts = draft.courts.map((n) => n.trim()).filter(Boolean)

  if (!draft.name.trim()) {
    issues.push({ level: 'error', field: 'name', message: 'Podaj nazwę turnieju.' })
  }

  if (participants.length < perMatch) {
    issues.push({
      level: 'error',
      field: 'participants',
      message:
        draft.teamFormat === 'individual'
          ? 'Za mało uczestników — minimum 4.'
          : 'Za mało drużyn — minimum 2.',
    })
  }

  for (const name of duplicates(participants)) {
    issues.push({
      level: 'error',
      field: 'participants',
      message: `„${name}” już jest na liście.`,
    })
  }

  if (courts.length < 1) {
    issues.push({ level: 'error', field: 'courts', message: 'Dodaj przynajmniej jeden kort.' })
  }

  for (const name of duplicates(courts)) {
    issues.push({ level: 'error', field: 'courts', message: `Kort „${name}” już istnieje.` })
  }

  if (
    !Number.isInteger(draft.gamePoints) ||
    draft.gamePoints < MIN_GAME_POINTS ||
    draft.gamePoints > MAX_GAME_POINTS
  ) {
    issues.push({
      level: 'error',
      field: 'gamePoints',
      message: `Punkty w meczu: liczba od ${MIN_GAME_POINTS} do ${MAX_GAME_POINTS}.`,
    })
  }

  if (!Number.isInteger(draft.restPoints) || draft.restPoints < 0) {
    issues.push({
      level: 'error',
      field: 'restPoints',
      message: 'Punkty za pauzę nie mogą być ujemne.',
    })
  }

  // Warnings — everything below is allowed, and the organiser may mean it.
  if (participants.length >= perMatch && courts.length >= 1) {
    const playing = Math.min(Math.floor(participants.length / perMatch), courts.length) * perMatch
    const resting = participants.length - playing

    // Warn once a whole match's worth of people is idle, because that is
    // exactly when another court would put more of them on it. A percentage
    // threshold reads well but is not actionable: "27% are resting" does not
    // tell the organiser whether adding a court would change anything.
    if (resting >= perMatch) {
      const unit = draft.teamFormat === 'individual' ? 'osób' : 'drużyn'
      issues.push({
        level: 'warning',
        field: 'participants',
        message: `${resting} z ${participants.length} ${unit} pauzuje co rundę. Dodatkowy kort pozwoliłby grać ${perMatch} więcej.`,
      })
    }

    const usableCourts = Math.floor(participants.length / perMatch)
    if (usableCourts < courts.length) {
      const idle = courts.length - usableCourts
      issues.push({
        level: 'warning',
        field: 'courts',
        message: `${idle} ${idle === 1 ? 'kort pozostanie nieużywany' : 'korty pozostaną nieużywane'} przy tej liczbie uczestników.`,
      })
    }
  }

  if (draft.restPoints >= draft.gamePoints && draft.gamePoints > 0) {
    issues.push({
      level: 'warning',
      field: 'restPoints',
      message: 'Pauza daje tyle samo punktów co wygrana do zera — pauzowanie się opłaca.',
    })
  }

  return issues
}

export function errorsOf(issues: Issue[]): Issue[] {
  return issues.filter((i) => i.level === 'error')
}

export function isSubmittable(draft: DraftTournament): boolean {
  return errorsOf(validateDraft(draft)).length === 0
}
