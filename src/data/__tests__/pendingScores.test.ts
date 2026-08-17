import { describe, expect, it } from 'vitest'

import { applyPendingScores, toTournamentState } from '../mapping'
import type { TournamentBundle } from '../mapping'
import { computeStandings } from '../../domain/standings'

function bundle(): TournamentBundle {
  return {
    tournament: {
      id: 't1',
      owner_id: 'u1',
      slug: 'abc',
      name: 'Test',
      format: 'americano',
      team_format: 'individual',
      game_points: 21,
      rest_points: 11,
      pairing_formula: null,
      created_at: '2026-08-17T17:00:00Z',
      finished_at: null,
    },
    courts: [{ id: 'c1', tournament_id: 't1', name: 'Kort 1', position: 1, removed_from_round: null }],
    participants: [
      { id: 'p1', tournament_id: 't1', name: 'Ann', entry_order: 1, joined_round: 1, retired_after_round: null, seed_court_id: null, seed_side: null },
      { id: 'p2', tournament_id: 't1', name: 'Bob', entry_order: 2, joined_round: 1, retired_after_round: null, seed_court_id: null, seed_side: null },
      { id: 'p3', tournament_id: 't1', name: 'Cara', entry_order: 3, joined_round: 1, retired_after_round: null, seed_court_id: null, seed_side: null },
      { id: 'p4', tournament_id: 't1', name: 'Dan', entry_order: 4, joined_round: 1, retired_after_round: null, seed_court_id: null, seed_side: null },
    ],
    rounds: [{ id: 'r1', tournament_id: 't1', number: 1, is_final: false, created_at: '2026-08-17T17:05:00Z' }],
    matches: [{ id: 'm1', round_id: 'r1', court_id: 'c1', score_a: null, score_b: null }],
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
  }
}

const queued = (matchId: string, scoreA: number, scoreB: number) => ({ matchId, scoreA, scoreB })

describe('showing scores before they are saved', () => {
  it('shows a queued score straight away', () => {
    // Without this the number stays blank until the write and a refetch
    // complete — about a second, which reads as the tap not registering.
    const merged = applyPendingScores(bundle(), [queued('m1', 15, 6)])
    expect(merged.matches[0]).toMatchObject({ score_a: 15, score_b: 6 })
  })

  it('feeds through to the standings, not just the court card', () => {
    const merged = applyPendingScores(bundle(), [queued('m1', 15, 6)])
    const rows = computeStandings(toTournamentState(merged))
    expect(rows.map((r) => `${r.name}:${r.points}`)).toEqual([
      'Ann:15',
      'Bob:15',
      'Cara:6',
      'Dan:6',
    ])
  })

  it('leaves the bundle untouched when nothing is queued', () => {
    const original = bundle()
    // Same reference, so React skips the re-render entirely.
    expect(applyPendingScores(original, [])).toBe(original)
  })

  it('leaves the bundle untouched when the queued value already landed', () => {
    const saved = bundle()
    saved.matches[0].score_a = 15
    saved.matches[0].score_b = 6
    expect(applyPendingScores(saved, [queued('m1', 15, 6)])).toBe(saved)
  })

  it('ignores a queued score for a match that is not loaded', () => {
    const merged = applyPendingScores(bundle(), [queued('nope', 1, 2)])
    expect(merged.matches[0].score_a).toBeNull()
  })

  it('shows a correction typed over an already-saved score', () => {
    const saved = bundle()
    saved.matches[0].score_a = 15
    saved.matches[0].score_b = 6
    const merged = applyPendingScores(saved, [queued('m1', 12, 9)])
    expect(merged.matches[0]).toMatchObject({ score_a: 12, score_b: 9 })
  })
})
