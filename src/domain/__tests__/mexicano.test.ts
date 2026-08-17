import { describe, expect, it } from 'vitest'

import { generateRound } from '../round'
import { computeStandings } from '../standings'
import { commit, courts, makeState, participant, roster, seededRng } from './factory'
import type { TournamentState } from '../types'

function eight(): TournamentState {
  return makeState({
    participants: roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'),
    courts: courts(2),
    format: 'mexicano',
    pairingFormula: '1+4v2+3',
  })
}

/** Rank order after the rounds played so far. */
function ranking(state: TournamentState): string[] {
  return computeStandings(state).map((r) => r.participantId)
}

describe('mexicano', () => {
  it('draws round 1 at random, since there is no standing to rank by', () => {
    const state = eight()
    const a = generateRound(state, { rng: seededRng(1) })
    const b = generateRound(state, { rng: seededRng(99) })

    expect(a.matches.flatMap((m) => [...m.sideA, ...m.sideB]).sort()).toEqual(
      b.matches.flatMap((m) => [...m.sideA, ...m.sideB]).sort(),
    )
    // Different seeds, different draw.
    expect(JSON.stringify(a.matches)).not.toEqual(JSON.stringify(b.matches))
  })

  it('honours a pin to a court and a side', () => {
    const participants = roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H')
    participants[0].seedCourtId = 'kort2'
    participants[0].seedSide = 'b'
    participants[1].seedCourtId = 'kort2'
    participants[1].seedSide = 'a'

    const state = makeState({
      participants,
      courts: courts(2),
      format: 'mexicano',
      pairingFormula: '1+4v2+3',
    })
    const proposal = generateRound(state, { rng: seededRng(7) })

    const kort2 = proposal.matches.find((m) => m.courtId === 'kort2')!
    expect(kort2.sideB).toContain('a')
    expect(kort2.sideA).toContain('b')
  })

  it('pins to a court only, leaving the side to the draw', () => {
    const participants = roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H')
    participants[0].seedCourtId = 'kort2'

    const state = makeState({
      participants,
      courts: courts(2),
      format: 'mexicano',
      pairingFormula: '1+4v2+3',
    })
    const kort2 = generateRound(state, { rng: seededRng(3) }).matches.find(
      (m) => m.courtId === 'kort2',
    )!
    expect([...kort2.sideA, ...kort2.sideB]).toContain('a')
  })

  it('puts the leaders on Kort 1 from round 2 on', () => {
    let state = eight()
    state = commit(state, generateRound(state, { rng: seededRng(5) }), (i) => (i === 0 ? 21 : 0))

    const proposal = generateRound(state)
    const top4 = ranking(state).slice(0, 4)
    const kort1 = proposal.matches.find((m) => m.courtId === 'kort1')!

    expect([...kort1.sideA, ...kort1.sideB].sort()).toEqual([...top4].sort())
  })

  it('applies the configured formula to each ranked group', () => {
    let state = eight()
    state = commit(state, generateRound(state, { rng: seededRng(5) }), (i) => (i === 0 ? 21 : 0))

    const ranked = ranking(state)
    const kort1 = generateRound(state).matches.find((m) => m.courtId === 'kort1')!

    // 1+4 v 2+3
    expect(kort1.sideA.sort()).toEqual([ranked[0], ranked[3]].sort())
    expect(kort1.sideB.sort()).toEqual([ranked[1], ranked[2]].sort())
  })

  it('respects a different formula', () => {
    let state = makeState({
      participants: roster('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'),
      courts: courts(2),
      format: 'mexicano',
      pairingFormula: '1+2v3+4',
    })
    state = commit(state, generateRound(state, { rng: seededRng(5) }), (i) => (i === 0 ? 21 : 0))

    const ranked = ranking(state)
    const kort1 = generateRound(state).matches.find((m) => m.courtId === 'kort1')!

    expect(kort1.sideA.sort()).toEqual([ranked[0], ranked[1]].sort())
    expect(kort1.sideB.sort()).toEqual([ranked[2], ranked[3]].sort())
  })

  it('avoids recreating the previous round’s partnership within a group', () => {
    // Draw every match so the ranking never moves, which makes the group of
    // four identical round after round — the case repeat avoidance exists for.
    let state = makeState({
      participants: roster('A', 'B', 'C', 'D'),
      courts: courts(1),
      format: 'mexicano',
      pairingFormula: '1+4v2+3',
      gamePoints: 20,
    })

    const arrangements: string[] = []
    for (let i = 0; i < 4; i++) {
      const proposal = generateRound(state, { rng: seededRng(1) })
      arrangements.push([...proposal.matches[0].sideA].sort().join('+'))
      state = commit(state, proposal, () => 10)
    }

    // Consecutive rounds must not repeat the same partnership.
    for (let i = 1; i < arrangements.length; i++) {
      expect(arrangements[i], `round ${i + 1} repeated round ${i}`).not.toEqual(arrangements[i - 1])
    }
  })

  it('falls back to the formula when every arrangement would repeat', () => {
    // Only three arrangements exist for a group of four; if the previous round
    // somehow used all of them the formula must still produce a valid round.
    const state = makeState({
      participants: roster('A', 'B', 'C', 'D'),
      courts: courts(1),
      format: 'mexicano',
      pairingFormula: '1+4v2+3',
      rounds: [
        {
          number: 1,
          isFinal: false,
          matches: [
            { courtId: 'kort1', sideA: ['a', 'b'], sideB: ['c', 'd'], scoreA: 10, scoreB: 10 },
            { courtId: 'kort1', sideA: ['a', 'c'], sideB: ['b', 'd'], scoreA: 10, scoreB: 10 },
            { courtId: 'kort1', sideA: ['a', 'd'], sideB: ['b', 'c'], scoreA: 10, scoreB: 10 },
          ],
          resting: [],
          credited: [],
        },
      ],
    })

    const proposal = generateRound(state)
    expect(proposal.matches).toHaveLength(1)
    expect([...proposal.matches[0].sideA, ...proposal.matches[0].sideB].sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })

  it('pairs adjacent ranks in teams format', () => {
    // Explicit round 1 in which no eventual neighbour in the table met, so
    // adjacency is tested without rematch avoidance interfering.
    const state = makeState({
      participants: roster('T1', 'T2', 'T3', 'T4', 'T5', 'T6'),
      courts: courts(3),
      format: 'mexicano',
      teamFormat: 'teams',
      rounds: [
        {
          number: 1,
          isFinal: false,
          matches: [
            { courtId: 'kort1', sideA: ['t1'], sideB: ['t4'], scoreA: 21, scoreB: 0 },
            { courtId: 'kort2', sideA: ['t2'], sideB: ['t5'], scoreA: 21, scoreB: 0 },
            { courtId: 'kort3', sideA: ['t3'], sideB: ['t6'], scoreA: 21, scoreB: 0 },
          ],
          resting: [],
          credited: [],
        },
      ],
    })

    const ranked = ranking(state)
    expect(ranked).toEqual(['t1', 't2', 't3', 't4', 't5', 't6'])

    const proposal = generateRound(state)
    expect(proposal.matches[0].sideA[0]).toBe(ranked[0])
    expect(proposal.matches[0].sideB[0]).toBe(ranked[1])
    expect(proposal.matches[1].sideA[0]).toBe(ranked[2])
    expect(proposal.matches[1].sideB[0]).toBe(ranked[3])
    expect(proposal.matches[2].sideA[0]).toBe(ranked[4])
    expect(proposal.matches[2].sideB[0]).toBe(ranked[5])
  })

  it('breaks adjacency to avoid an immediate rematch in teams format', () => {
    // T1 and T2 drew, so they sit next to each other in the table having just
    // played. The ladder pulls in the next team down rather than repeat it.
    const state = makeState({
      participants: roster('T1', 'T2', 'T3', 'T4', 'T5', 'T6'),
      courts: courts(3),
      format: 'mexicano',
      teamFormat: 'teams',
      gamePoints: 20,
      rounds: [
        {
          number: 1,
          isFinal: false,
          matches: [
            { courtId: 'kort1', sideA: ['t1'], sideB: ['t2'], scoreA: 10, scoreB: 10 },
            { courtId: 'kort2', sideA: ['t3'], sideB: ['t4'], scoreA: 0, scoreB: 20 },
            { courtId: 'kort3', sideA: ['t5'], sideB: ['t6'], scoreA: 0, scoreB: 20 },
          ],
          resting: [],
          credited: [],
        },
      ],
    })

    expect(ranking(state)).toEqual(['t4', 't6', 't1', 't2', 't3', 't5'])

    const proposal = generateRound(state)
    expect(proposal.matches[0].sideA[0]).toBe('t4')
    expect(proposal.matches[0].sideB[0]).toBe('t6')
    // strict adjacency would give t1 v t2 again; the next team down comes up
    expect(proposal.matches[1].sideA[0]).toBe('t1')
    expect(proposal.matches[1].sideB[0]).toBe('t3')
    expect(proposal.matches[2].sideA[0]).toBe('t2')
    expect(proposal.matches[2].sideB[0]).toBe('t5')
  })

  it('rests independently of position — a leader can sit out', () => {
    // 18 players, 4 courts: 2 rest each round, chosen by the rota not the table.
    const participants = Array.from({ length: 18 }, (_, i) => participant(`P${i + 1}`, i + 1))
    let state = makeState({
      participants,
      courts: courts(4),
      format: 'mexicano',
      pairingFormula: '1+4v2+3',
    })

    let leaderRested = false
    for (let round = 0; round < 9; round++) {
      const leader = state.rounds.length ? ranking(state)[0] : null
      const proposal = generateRound(state, { rng: seededRng(4) })
      if (leader && proposal.resting.includes(leader)) leaderRested = true
      state = commit(state, proposal, (i) => 21 - i * 3)
    }

    expect(leaderRested).toBe(true)
  })
})
