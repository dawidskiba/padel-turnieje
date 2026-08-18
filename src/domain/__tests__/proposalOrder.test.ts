import { describe, expect, it } from 'vitest'

import { generateRound } from '../round'
import { toTournamentState } from '../../data/mapping'
import type { TournamentBundle } from '../../data/mapping'
import type { ProposedRound, TournamentState } from '../types'
import { commit, courts, makeState, participant, roster, seededRng } from './factory'

/**
 * What the organiser approves must be what they then see.
 *
 * The proposal is rendered straight from the algorithm, while a confirmed round
 * is rendered after a round trip through the database. The two used to disagree:
 * the Mexicano formula emits `[rank 1, rank 4]`, greedy pairing emits whatever it
 * picked first, and reading back sorts by entry order. Confirming a round visibly
 * reshuffled the names, which defeats the point of previewing it.
 */
function persistThenRead(state: TournamentState, proposal: ProposedRound): ProposedRound {
  // Rows come back in arbitrary order, so deliberately reverse everything to
  // prove the display order does not depend on it.
  const bundle: TournamentBundle = {
    tournament: {
      id: 't', owner_id: 'u', slug: 's', name: 'n',
      format: state.config.format, team_format: state.config.teamFormat,
      game_points: state.config.gamePoints, rest_points: state.config.restPoints,
      pairing_formula: state.config.pairingFormula,
      created_at: '2026-08-18T00:00:00Z', finished_at: null,
    },
    courts: state.courts.map((c) => ({
      id: c.id, tournament_id: 't', name: c.name, position: c.position,
      removed_from_round: c.removedFromRound,
    })),
    participants: state.participants.map((p) => ({
      id: p.id, tournament_id: 't', name: p.name, entry_order: p.entryOrder,
      joined_round: p.joinedRound, retired_after_round: p.retiredAfterRound,
      seed_court_id: p.seedCourtId, seed_side: p.seedSide,
    })),
    rounds: [{ id: 'r', tournament_id: 't', number: proposal.number, is_final: proposal.isFinal, created_at: '2026-08-18T00:00:00Z' }],
    matches: proposal.matches.map((m, i) => ({ id: `m${i}`, round_id: 'r', court_id: m.courtId, score_a: null, score_b: null })),
    matchParticipants: proposal.matches.flatMap((m, i) => [
      ...[...m.sideA].reverse().map((pid) => ({ match_id: `m${i}`, participant_id: pid, side: 'a' as const })),
      ...[...m.sideB].reverse().map((pid) => ({ match_id: `m${i}`, participant_id: pid, side: 'b' as const })),
    ]),
    roundParticipants: [
      ...[...proposal.resting].reverse().map((pid) => ({ round_id: 'r', participant_id: pid, status: 'resting' as const })),
      ...proposal.matches.flatMap((m) => [...m.sideA, ...m.sideB]).map((pid) => ({ round_id: 'r', participant_id: pid, status: 'playing' as const })),
    ],
  }

  const round = toTournamentState(bundle).rounds[0]
  return {
    number: round.number,
    isFinal: round.isFinal,
    matches: round.matches.map((m) => ({ courtId: m.courtId, sideA: m.sideA, sideB: m.sideB })),
    resting: round.resting,
  }
}

function expectStableOrder(state: TournamentState, proposal: ProposedRound) {
  expect(persistThenRead(state, proposal)).toEqual(proposal)
}

describe('a confirmed round looks exactly like the proposal', () => {
  it('holds for Americano', () => {
    let state = makeState({
      participants: Array.from({ length: 9 }, (_, i) => participant(String.fromCharCode(65 + i), i + 1)),
      courts: courts(2),
    })
    for (let r = 0; r < 4; r++) {
      const proposal = generateRound(state)
      expectStableOrder(state, proposal)
      state = commit(state, proposal, () => 13)
    }
  })

  it('holds for Mexicano, where the formula emits rank order', () => {
    let state = makeState({
      participants: roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'),
      courts: courts(2),
      format: 'mexicano',
      pairingFormula: '1+4v2+3',
    })
    state = commit(state, generateRound(state, { rng: seededRng(3) }), (m) => [21, 13][m])

    for (let r = 0; r < 4; r++) {
      const proposal = generateRound(state)
      expectStableOrder(state, proposal)
      state = commit(state, proposal, (m) => [21, 13][m])
    }
  })

  it('holds for the standings-seeded final round', () => {
    let state = makeState({
      participants: roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'),
      courts: courts(2),
    })
    for (let r = 0; r < 3; r++) state = commit(state, generateRound(state), (m) => [15, 11][m])

    expectStableOrder(state, generateRound(state, { isFinal: true }))
  })

  it('holds for teams format', () => {
    let state = makeState({
      participants: roster('T1', 'T2', 'T3', 'T4', 'T5'),
      courts: courts(2),
      teamFormat: 'teams',
    })
    for (let r = 0; r < 3; r++) {
      const proposal = generateRound(state)
      expectStableOrder(state, proposal)
      state = commit(state, proposal, () => 13)
    }
  })

  it('holds after a reshuffle', () => {
    const state = makeState({
      participants: roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'),
      courts: courts(2),
    })
    for (const variant of [1, 2, 3]) {
      expectStableOrder(state, generateRound(state, { variant }))
    }
  })

  it('puts the rest list in entry order too', () => {
    const state = makeState({
      participants: Array.from({ length: 11 }, (_, i) => participant(String.fromCharCode(65 + i), i + 1)),
      courts: courts(2),
    })
    const proposal = generateRound(state)
    expect(proposal.resting).toEqual([...proposal.resting].sort())
  })
})
