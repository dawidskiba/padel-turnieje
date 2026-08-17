import { describe, expect, it } from 'vitest'

import { describeViewer, viewerCandidates } from '../publicView'
import type { PublicTournament } from '../../lib/database.types'

function payload(overrides: Partial<PublicTournament> = {}): PublicTournament {
  return {
    tournament: {
      name: 'Środa Americano',
      format: 'americano',
      team_format: 'individual',
      game_points: 21,
      rest_points: 11,
      finished: false,
    },
    standings: [
      { name: 'Ann', points: 88, difference: 12, wins: 3, draws: 0, losses: 1, retired: false },
      { name: 'Bob', points: 81, difference: 5, wins: 2, draws: 0, losses: 2, retired: false },
      { name: 'Cara', points: 74, difference: -3, wins: 2, draws: 0, losses: 2, retired: false },
      { name: 'Dan', points: 70, difference: -14, wins: 1, draws: 0, losses: 3, retired: false },
      { name: 'Iga', points: 66, difference: 0, wins: 0, draws: 0, losses: 0, retired: false },
    ],
    current_round: {
      number: 4,
      is_final: false,
      matches: [
        {
          court: 'Kort 1',
          side_a: ['Ann', 'Dan'],
          side_b: ['Bob', 'Cara'],
          score_a: 15,
          score_b: 6,
        },
      ],
      resting: ['Iga'],
    },
    ...overrides,
  }
}

describe('describing where the viewer is', () => {
  it('finds them on side A, with partner and opponents named', () => {
    const situation = describeViewer(payload(), 'Ann')
    expect(situation).toEqual({
      kind: 'playing',
      court: 'Kort 1',
      partners: ['Dan'],
      opponents: ['Bob', 'Cara'],
      yourScore: 15,
      theirScore: 6,
    })
  })

  it('reports the score from their side when they are on side B', () => {
    // The same match read from the other end: their score comes first.
    const situation = describeViewer(payload(), 'Bob')
    expect(situation).toMatchObject({
      partners: ['Cara'],
      opponents: ['Ann', 'Dan'],
      yourScore: 6,
      theirScore: 15,
    })
  })

  it('leaves the score null while the match is unplayed', () => {
    const unplayed = payload()
    unplayed.current_round!.matches[0].score_a = null
    unplayed.current_round!.matches[0].score_b = null

    expect(describeViewer(unplayed, 'Ann')).toMatchObject({
      yourScore: null,
      theirScore: null,
    })
  })

  it('knows when they are resting', () => {
    expect(describeViewer(payload(), 'Iga')).toEqual({ kind: 'resting' })
  })

  it('reports absent for someone in the table but not in this round', () => {
    // Retired, or joined after this round was generated.
    expect(describeViewer(payload(), 'Ewa')).toEqual({ kind: 'absent' })
  })

  it('reports unknown when nobody has claimed a name yet', () => {
    expect(describeViewer(payload(), null)).toEqual({ kind: 'unknown' })
  })

  it('reports absent before the first round exists', () => {
    expect(describeViewer(payload({ current_round: null }), 'Ann')).toEqual({ kind: 'absent' })
  })

  it('copes with a team match, where a side is a single name', () => {
    const teams = payload({
      current_round: {
        number: 2,
        is_final: false,
        matches: [
          { court: 'Kort 1', side_a: ['Ann & Bob'], side_b: ['Cara & Dan'], score_a: null, score_b: null },
        ],
        resting: [],
      },
    })

    expect(describeViewer(teams, 'Ann & Bob')).toMatchObject({
      partners: [],
      opponents: ['Cara & Dan'],
    })
  })

  it('tolerates null sides rather than throwing', () => {
    // json_agg returns null for an empty set, which the payload passes through.
    const odd = payload({
      current_round: {
        number: 1,
        is_final: false,
        matches: [{ court: 'Kort 1', side_a: null, side_b: null, score_a: null, score_b: null }],
        resting: [],
      },
    })
    expect(describeViewer(odd, 'Ann')).toEqual({ kind: 'absent' })
  })
})

describe('candidates offered to a viewer', () => {
  it('lists everyone in table order', () => {
    expect(viewerCandidates(payload())).toEqual(['Ann', 'Bob', 'Cara', 'Dan', 'Iga'])
  })
})
