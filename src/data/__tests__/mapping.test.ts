import { describe, expect, it } from 'vitest'

import { matchIdFor, phaseOf, toTournamentState } from '../mapping'
import type { TournamentBundle } from '../mapping'

function bundle(overrides: Partial<TournamentBundle> = {}): TournamentBundle {
  return {
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
    // deliberately out of order, to prove sorting is not accidental
    courts: [
      { id: 'c2', tournament_id: 't1', name: 'Kort 2', position: 2, removed_from_round: null },
      { id: 'c1', tournament_id: 't1', name: 'Kort 1', position: 1, removed_from_round: null },
    ],
    participants: [
      { id: 'p3', tournament_id: 't1', name: 'Cara', entry_order: 3, joined_round: 1, retired_after_round: null, seed_court_id: null, seed_side: null },
      { id: 'p1', tournament_id: 't1', name: 'Ann', entry_order: 1, joined_round: 1, retired_after_round: null, seed_court_id: null, seed_side: null },
      { id: 'p4', tournament_id: 't1', name: 'Dan', entry_order: 4, joined_round: 1, retired_after_round: null, seed_court_id: null, seed_side: null },
      { id: 'p2', tournament_id: 't1', name: 'Bob', entry_order: 2, joined_round: 1, retired_after_round: null, seed_court_id: null, seed_side: null },
      { id: 'p5', tournament_id: 't1', name: 'Ewa', entry_order: 5, joined_round: 1, retired_after_round: null, seed_court_id: null, seed_side: null },
    ],
    rounds: [{ id: 'r1', tournament_id: 't1', number: 1, is_final: false, created_at: '2026-08-17T17:05:00Z' }],
    matches: [{ id: 'm1', round_id: 'r1', court_id: 'c1', score_a: 15, score_b: 6 }],
    matchParticipants: [
      { match_id: 'm1', participant_id: 'p4', side: 'a' },
      { match_id: 'm1', participant_id: 'p1', side: 'a' },
      { match_id: 'm1', participant_id: 'p3', side: 'b' },
      { match_id: 'm1', participant_id: 'p2', side: 'b' },
    ],
    roundParticipants: [
      { round_id: 'r1', participant_id: 'p1', status: 'playing' },
      { round_id: 'r1', participant_id: 'p2', status: 'playing' },
      { round_id: 'r1', participant_id: 'p3', status: 'playing' },
      { round_id: 'r1', participant_id: 'p4', status: 'playing' },
      { round_id: 'r1', participant_id: 'p5', status: 'resting' },
    ],
    ...overrides,
  }
}

describe('mapping rows to domain state', () => {
  it('carries the scoring configuration across', () => {
    const state = toTournamentState(bundle())
    expect(state.config).toEqual({
      format: 'americano',
      teamFormat: 'individual',
      gamePoints: 21,
      restPoints: 11,
      pairingFormula: null,
      scoring: 'points',
      neutralRounds: 1,
    })
  })

  it('sorts participants and courts regardless of row order', () => {
    const state = toTournamentState(bundle())
    expect(state.participants.map((p) => p.name)).toEqual(['Ann', 'Bob', 'Cara', 'Dan', 'Ewa'])
    expect(state.courts.map((c) => c.name)).toEqual(['Kort 1', 'Kort 2'])
  })

  it('orders each side by entry order, so a match reads the same way every time', () => {
    const state = toTournamentState(bundle())
    expect(state.rounds[0].matches[0].sideA).toEqual(['p1', 'p4'])
    expect(state.rounds[0].matches[0].sideB).toEqual(['p2', 'p3'])
  })

  it('separates resting from playing, and keeps credited apart from both', () => {
    const withCredit = bundle({
      roundParticipants: [
        ...bundle().roundParticipants,
        { round_id: 'r1', participant_id: 'p6', status: 'credited' },
      ],
    })
    const round = toTournamentState(withCredit).rounds[0]
    expect(round.resting).toEqual(['p5'])
    expect(round.credited).toEqual(['p6'])
  })

  it('keeps an unscored match as null rather than zero', () => {
    const state = toTournamentState(
      bundle({ matches: [{ id: 'm1', round_id: 'r1', court_id: 'c1', score_a: null, score_b: null }] }),
    )
    expect(state.rounds[0].matches[0].scoreA).toBeNull()
  })

  it('finds a match id by round number and court', () => {
    expect(matchIdFor(bundle(), 1, 'c1')).toBe('m1')
    expect(matchIdFor(bundle(), 1, 'c2')).toBeUndefined()
    expect(matchIdFor(bundle(), 9, 'c1')).toBeUndefined()
  })
})

describe('phase is derived, never stored', () => {
  it('is setup before any round exists', () => {
    expect(phaseOf(bundle({ rounds: [], matches: [], matchParticipants: [], roundParticipants: [] }))).toBe(
      'setup',
    )
  })

  it('is running once a round exists', () => {
    expect(phaseOf(bundle())).toBe('running')
  })

  it('is finished when finished_at is set, even mid-round', () => {
    const finished = bundle()
    finished.tournament.finished_at = '2026-08-17T19:30:00Z'
    expect(phaseOf(finished)).toBe('finished')
  })
})
