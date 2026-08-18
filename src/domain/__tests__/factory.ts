/** Builders for readable domain tests. */

import type {
  Court,
  Format,
  PairingFormula,
  Participant,
  ProposedRound,
  Round,
  Scoring,
  TeamFormat,
  TournamentState,
} from '../types'

export function participant(name: string, entryOrder: number, extra: Partial<Participant> = {}): Participant {
  return {
    id: name.toLowerCase(),
    name,
    entryOrder,
    joinedRound: 1,
    retiredAfterRound: null,
    seedCourtId: null,
    seedSide: null,
    ...extra,
  }
}

export function roster(...names: string[]): Participant[] {
  return names.map((name, index) => participant(name, index + 1))
}

export function court(name: string, position: number, extra: Partial<Court> = {}): Court {
  return { id: name.toLowerCase().replace(/\s+/g, ''), name, position, removedFromRound: null, ...extra }
}

export function courts(count: number): Court[] {
  return Array.from({ length: count }, (_, i) => court(`Kort ${i + 1}`, i + 1))
}

export function makeState(options: {
  participants: Participant[]
  courts: Court[]
  format?: Format
  teamFormat?: TeamFormat
  gamePoints?: number
  restPoints?: number
  pairingFormula?: PairingFormula | null
  scoring?: Scoring
  neutralRounds?: number
  rounds?: Round[]
}): TournamentState {
  return {
    config: {
      format: options.format ?? 'americano',
      teamFormat: options.teamFormat ?? 'individual',
      gamePoints: options.gamePoints ?? 21,
      restPoints: options.restPoints ?? 11,
      pairingFormula: options.pairingFormula ?? null,
      scoring: options.scoring ?? 'points',
      neutralRounds: options.neutralRounds ?? 1,
    },
    participants: options.participants,
    courts: options.courts,
    rounds: options.rounds ?? [],
  }
}

/**
 * Commit a proposed round, scoring every match with the given split. `scoreA`
 * is what side A takes; side B gets the remainder of the game points target.
 */
export function commit(
  state: TournamentState,
  proposal: ProposedRound,
  scoreA: (index: number) => number = () => Math.ceil(state.config.gamePoints / 2),
): TournamentState {
  const round: Round = {
    number: proposal.number,
    isFinal: proposal.isFinal,
    matches: proposal.matches.map((match, index) => ({
      ...match,
      scoreA: scoreA(index),
      scoreB: state.config.gamePoints - scoreA(index),
    })),
    resting: proposal.resting,
    credited: [],
  }
  return { ...state, rounds: [...state.rounds, round] }
}

/** Commit without entering any scores. */
export function commitUnscored(state: TournamentState, proposal: ProposedRound): TournamentState {
  return {
    ...state,
    rounds: [
      ...state.rounds,
      {
        number: proposal.number,
        isFinal: proposal.isFinal,
        matches: proposal.matches.map((m) => ({ ...m, scoreA: null, scoreB: null })),
        resting: proposal.resting,
        credited: [],
      },
    ],
  }
}

/** Deterministic stand-in for Math.random. */
export function seededRng(seed = 1): () => number {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

export function namesOf(state: TournamentState, ids: string[]): string[] {
  return ids.map((id) => state.participants.find((p) => p.id === id)?.name ?? id)
}
