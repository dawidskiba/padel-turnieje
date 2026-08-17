/**
 * Everything the pairing rules need to know about what has already happened:
 * who has partnered whom, who has faced whom, who has rested and how recently,
 * and how often each participant has been put on each court.
 *
 * Built once per generation rather than queried repeatedly — the whole
 * tournament is a few hundred rows.
 */

import type { Round, TournamentState } from './types'

/** Order-independent key for a pair of participants. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export interface History {
  /** Times two participants have been on the same side. */
  partnerCount(a: string, b: string): number
  /** Times two participants have been on opposite sides. */
  opponentCount(a: string, b: string): number
  /** Rounds rested. Credited rounds do not count — see RoundParticipantStatus. */
  restCount(participantId: string): number
  /** Highest round number this participant rested, or 0 if never. */
  lastRestedRound(participantId: string): number
  /** Times this participant has played on this court. */
  courtCount(participantId: string, courtId: string): number
  /** True if these two were on the same side in the round immediately before `roundNumber`. */
  partneredInPreviousRound(a: string, b: string, roundNumber: number): boolean
  /** True if these two met in the round immediately before `roundNumber`. */
  facedInPreviousRound(a: string, b: string, roundNumber: number): boolean
}

export function buildHistory(rounds: Round[]): History {
  const partners = new Map<string, number>()
  const opponents = new Map<string, number>()
  const rests = new Map<string, number>()
  const lastRested = new Map<string, number>()
  const courts = new Map<string, number>()
  /** roundNumber -> pair keys that were partners / opponents in it. */
  const partnersByRound = new Map<number, Set<string>>()
  const opponentsByRound = new Map<number, Set<string>>()

  const bump = (map: Map<string, number>, key: string) => {
    map.set(key, (map.get(key) ?? 0) + 1)
  }

  for (const round of rounds) {
    const roundPartners = new Set<string>()
    const roundOpponents = new Set<string>()

    for (const match of round.matches) {
      for (const side of [match.sideA, match.sideB]) {
        for (let i = 0; i < side.length; i++) {
          bump(courts, `${side[i]}|${match.courtId}`)
          for (let j = i + 1; j < side.length; j++) {
            const key = pairKey(side[i], side[j])
            bump(partners, key)
            roundPartners.add(key)
          }
        }
      }
      for (const a of match.sideA) {
        for (const b of match.sideB) {
          const key = pairKey(a, b)
          bump(opponents, key)
          roundOpponents.add(key)
        }
      }
    }

    partnersByRound.set(round.number, roundPartners)
    opponentsByRound.set(round.number, roundOpponents)

    for (const participantId of round.resting) {
      bump(rests, participantId)
      lastRested.set(participantId, Math.max(lastRested.get(participantId) ?? 0, round.number))
    }
  }

  return {
    partnerCount: (a, b) => partners.get(pairKey(a, b)) ?? 0,
    opponentCount: (a, b) => opponents.get(pairKey(a, b)) ?? 0,
    restCount: (id) => rests.get(id) ?? 0,
    lastRestedRound: (id) => lastRested.get(id) ?? 0,
    courtCount: (id, courtId) => courts.get(`${id}|${courtId}`) ?? 0,
    partneredInPreviousRound: (a, b, roundNumber) =>
      partnersByRound.get(roundNumber - 1)?.has(pairKey(a, b)) ?? false,
    facedInPreviousRound: (a, b, roundNumber) =>
      opponentsByRound.get(roundNumber - 1)?.has(pairKey(a, b)) ?? false,
  }
}

export function historyOf(state: TournamentState): History {
  return buildHistory(state.rounds)
}
