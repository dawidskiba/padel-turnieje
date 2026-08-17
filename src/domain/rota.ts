/**
 * The Rest Rota: who sits out a round.
 *
 * Identical in both formats. In Mexicano this runs *before* ranking, so rest is
 * independent of position — a leader is as likely to sit out as anyone else.
 */

import type { History } from './history'
import { historyOf } from './history'
import { activeParticipants, matchCount, participantsPerMatch } from './types'
import type { Participant, TournamentState } from './types'

/**
 * Those who have rested fewest times so far; ties broken by who rested longest
 * ago, then by entry order. Rest counts never differ by more than one across
 * the roster.
 */
export function chooseResting(
  state: TournamentState,
  roundNumber: number,
  history: History = historyOf(state),
  /**
   * Participants to keep on court if the rota allows. Used for Mexicano round-1
   * pins: the organiser placed them deliberately, so resting them would throw
   * that away. They still rest if there are not enough other candidates.
   */
  protect: Set<string> = new Set(),
): string[] {
  const active = activeParticipants(state, roundNumber)
  const playing = matchCount(state, roundNumber) * participantsPerMatch(state.config.teamFormat)
  const restingCount = active.length - playing
  if (restingCount <= 0) return []

  const queue = [...active].sort(
    (a, b) =>
      Number(protect.has(a.id)) - Number(protect.has(b.id)) ||
      history.restCount(a.id) - history.restCount(b.id) ||
      history.lastRestedRound(a.id) - history.lastRestedRound(b.id) ||
      a.entryOrder - b.entryOrder,
  )

  return queue.slice(0, restingCount).map((p) => p.id)
}

export interface RestBalance {
  balanced: boolean
  /** Largest gap in rest counts once this round is applied. */
  spread: number
}

/**
 * Whether a given rest selection keeps counts within one of each other. The
 * organiser may override the rota, and the app warns — but does not block —
 * when the override unbalances it.
 */
export function checkRestBalance(
  state: TournamentState,
  roundNumber: number,
  resting: string[],
  history: History = historyOf(state),
): RestBalance {
  const active = activeParticipants(state, roundNumber)
  if (active.length === 0) return { balanced: true, spread: 0 }

  const restingSet = new Set(resting)
  const counts = active.map(
    (p) => history.restCount(p.id) + (restingSet.has(p.id) ? 1 : 0),
  )
  const spread = Math.max(...counts) - Math.min(...counts)
  return { balanced: spread <= 1, spread }
}

/** Participants eligible to play a round, i.e. active and not resting. */
export function playingParticipants(
  state: TournamentState,
  roundNumber: number,
  resting: string[],
): Participant[] {
  const restingSet = new Set(resting)
  return activeParticipants(state, roundNumber).filter((p) => !restingSet.has(p.id))
}
