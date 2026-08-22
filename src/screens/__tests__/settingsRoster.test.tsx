// @vitest-environment jsdom
/**
 * The roster section offers the right exit for each participant.
 *
 * Before the first round there is nothing to preserve, so the offer is removal.
 * Once a round has counted someone, retiring is the only honest exit — and the
 * button that used to be offered before round 1 wrote retired_after_round = 0,
 * which the database refuses outright, so the tap did nothing at all.
 */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

import { SettingsSheet } from '../desk/SettingsSheet'
import type { SettingsActions } from '../desk/SettingsSheet'
import type { TournamentBundle, TournamentPhase } from '../../data/mapping'
import { phaseOf, toTournamentState } from '../../data/mapping'

function participantRow(id: string, name: string, order: number, extra = {}) {
  return {
    id,
    tournament_id: 't1',
    name,
    entry_order: order,
    joined_round: 1,
    retired_after_round: null,
    seed_court_id: null,
    seed_side: null,
    ...extra,
  }
}

/** Four players on one court, with round 1 optionally already played. */
function bundle(played: boolean, overrides: Partial<TournamentBundle> = {}): TournamentBundle {
  const base: TournamentBundle = {
    tournament: {
      id: 't1',
      owner_id: 'u1',
      slug: 'k7m2xq9p4v',
      name: 'Środa Americano',
      format: 'americano',
      team_format: 'individual',
      game_points: 21,
      rest_points: 11,
      pairing_formula: null,
      scoring: 'points',
      neutral_rounds: 1,
      created_at: '2026-08-17T17:00:00Z',
      finished_at: null,
    },
    courts: [
      { id: 'c1', tournament_id: 't1', name: 'Kort 1', position: 1, removed_from_round: null },
    ],
    participants: [
      participantRow('p1', 'Ann', 1),
      participantRow('p2', 'Bob', 2),
      participantRow('p3', 'Cara', 3),
      participantRow('p4', 'Dan', 4),
    ],
    rounds: [],
    matches: [],
    matchParticipants: [],
    roundParticipants: [],
    ...overrides,
  }

  if (!played) return base

  return {
    ...base,
    rounds: [
      { id: 'r1', tournament_id: 't1', number: 1, is_final: false, created_at: '2026-08-17T17:05:00Z' },
    ],
    matches: [{ id: 'm1', round_id: 'r1', court_id: 'c1', score_a: 15, score_b: 6 }],
    matchParticipants: [
      { match_id: 'm1', participant_id: 'p1', side: 'a' },
      { match_id: 'm1', participant_id: 'p2', side: 'a' },
      { match_id: 'm1', participant_id: 'p3', side: 'b' },
      { match_id: 'm1', participant_id: 'p4', side: 'b' },
    ],
    roundParticipants: [
      { round_id: 'r1', participant_id: 'p1', status: 'playing' },
      { round_id: 'r1', participant_id: 'p2', status: 'playing' },
      { round_id: 'r1', participant_id: 'p3', status: 'playing' },
      { round_id: 'r1', participant_id: 'p4', status: 'playing' },
    ],
    ...overrides,
  }
}

function noopActions(): SettingsActions {
  return {
    addParticipant: vi.fn(),
    retireParticipant: vi.fn(),
    unretireParticipant: vi.fn(),
    removeParticipant: vi.fn(),
    addCourt: vi.fn(),
    renameCourt: vi.fn(),
    removeCourt: vi.fn(),
    restoreCourt: vi.fn(),
    renameTournament: vi.fn(),
    undoLastRound: vi.fn(),
    finish: vi.fn(),
    reopen: vi.fn(),
    deleteTournament: vi.fn(),
  }
}

async function mount(
  data: TournamentBundle,
  actions: SettingsActions,
  extra: { phase?: TournamentPhase; rosterError?: string } = {},
): Promise<HTMLElement> {
  const container = document.createElement('div')
  document.body.append(container)
  await act(async () => {
    createRoot(container).render(
      <SettingsSheet
        open
        onClose={vi.fn()}
        bundle={data}
        state={toTournamentState(data)}
        phase={extra.phase ?? phaseOf(data)}
        rosterError={extra.rosterError}
        actions={actions}
      />,
    )
  })
  return container
}

/** The buttons on the row for one participant, by their visible label. */
function rowButtons(container: HTMLElement, name: string): string[] {
  const row = [...container.querySelectorAll('li')].find((li) =>
    li.textContent?.includes(name),
  )
  if (!row) throw new Error(`no row for ${name}`)
  return [...row.querySelectorAll('button')].map((b) => b.textContent ?? '')
}

function clickIn(container: HTMLElement, name: string, label: string): void {
  const row = [...container.querySelectorAll('li')].find((li) =>
    li.textContent?.includes(name),
  )
  const button = [...(row?.querySelectorAll('button') ?? [])].find(
    (b) => b.textContent === label,
  )
  if (!button) throw new Error(`no "${label}" button for ${name}`)
  button.click()
}

describe('taking a participant off the roster', () => {
  it('offers removal, not retirement, before the first round', async () => {
    const actions = noopActions()
    const container = await mount(bundle(false), actions)

    expect(rowButtons(container, 'Ann')).toEqual(['Usuń'])
  })

  it('removes them outright, leaving nothing in the standings', async () => {
    const actions = noopActions()
    const container = await mount(bundle(false), actions)

    await act(async () => clickIn(container, 'Cara', 'Usuń'))

    expect(actions.removeParticipant).toHaveBeenCalledWith('p3')
    expect(actions.retireParticipant).not.toHaveBeenCalled()
  })

  it('offers retirement once a round has counted them', async () => {
    const actions = noopActions()
    const container = await mount(bundle(true), actions)

    expect(rowButtons(container, 'Ann')).toEqual(['Wycofaj'])
  })

  it('retires them after the last played round, never after round 0', async () => {
    const actions = noopActions()
    const container = await mount(bundle(true), actions)

    await act(async () => clickIn(container, 'Bob', 'Wycofaj'))

    expect(actions.retireParticipant).toHaveBeenCalledWith('p2', 1)
  })

  it('offers removal to somebody added mid-tournament who has not played yet', async () => {
    const withLateJoiner = bundle(true)
    const actions = noopActions()
    const container = await mount(
      {
        ...withLateJoiner,
        participants: [
          ...withLateJoiner.participants,
          participantRow('p5', 'Ewa', 5, { joined_round: 2 }),
        ],
      },
      actions,
    )

    expect(rowButtons(container, 'Ewa')).toEqual(['Usuń'])
    expect(rowButtons(container, 'Ann')).toEqual(['Wycofaj'])
  })

  it('lets a retired participant with no round on record be removed as well', async () => {
    const actions = noopActions()
    const container = await mount(
      {
        ...bundle(false),
        participants: [
          participantRow('p1', 'Ann', 1, { retired_after_round: 1 }),
          participantRow('p2', 'Bob', 2),
        ],
      },
      actions,
    )

    expect(rowButtons(container, 'Ann')).toEqual(['Przywróć', 'Usuń'])
  })

  it('offers nothing at all once the tournament is finished', async () => {
    const actions = noopActions()
    const container = await mount(bundle(true), actions, { phase: 'finished' })

    expect(rowButtons(container, 'Ann')).toEqual([])
  })

  it('says why a roster change was refused instead of leaving the tap silent', async () => {
    const actions = noopActions()
    const container = await mount(bundle(false), actions, {
      rosterError: 'tournament is finished — reopen it before changing the roster or courts',
    })

    expect(container.textContent).toContain('reopen it before changing the roster')
  })
})
