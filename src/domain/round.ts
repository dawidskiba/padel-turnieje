/**
 * Round generation — the entry point the desk view calls.
 *
 * Pure: current state in, a proposed round out. Nothing here writes anything.
 * The organiser adjusts who rests, confirms, and only then is the proposal
 * handed to the `create_round` RPC (ADR-0003).
 */

import { pairAmericano } from './americano'
import { historyOf } from './history'
import type { History } from './history'
import { pairMexicano } from './mexicano'
import { chooseResting, playingParticipants } from './rota'
import { rankedParticipantIds } from './standings'
import {
  DEFAULT_PAIRING_FORMULA,
  activeParticipants,
  availableCourts,
  matchCount,
  participantsPerSide,
} from './types'
import type {
  Court,
  PairingFormula,
  Participant,
  ProposedMatch,
  ProposedRound,
  TournamentState,
} from './types'

export type Rng = () => number

export interface GenerateOptions {
  /** Closes the tournament once its results are in. */
  isFinal?: boolean
  /** Override the rota. Defaults to the balanced selection. */
  resting?: string[]
  /** Injectable for deterministic tests; only Mexicano round 1 uses it. */
  rng?: Rng
  /**
   * Which of several equally good arrangements to produce.
   *
   * Generation is deterministic, so regenerating the same state returns the
   * identical round — which made "discard and try again" look broken. Bumping
   * the variant reshuffles how *ties* are resolved; the pairing priorities
   * themselves are unaffected, so every variant is equally valid.
   */
  variant?: number
}

/** Small deterministic generator, so a variant is reproducible. */
function makeRng(seed: number): Rng {
  let value = (seed + 1) * 2654435761
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

/**
 * Tie-break order for a given variant. Variant 0 is entry order, which keeps
 * the first proposal stable and predictable; later variants permute it.
 */
function tieBreakOrder(players: Participant[], variant: number): Map<string, number> | undefined {
  if (variant === 0) return undefined

  const shuffled = shuffle(
    players.map((p) => p.id),
    makeRng(variant),
  )
  return new Map(shuffled.map((id, index) => [id, index]))
}

export function nextRoundNumber(state: TournamentState): number {
  return state.rounds.reduce((max, r) => Math.max(max, r.number), 0) + 1
}

/** Fisher-Yates, driven by an injectable source so tests are deterministic. */
function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Mexicano round 1: there is no Standing to rank by, so pairings are drawn at
 * random — honouring any pins the organiser set at setup.
 *
 * A pin naming only a court leaves the side to the draw, which is why pinning a
 * side exists at all: without it two pinned players can come out as partners.
 */
export function seedFirstMexicanoRound(
  players: Participant[],
  courts: Court[],
  teamFormat: 'individual' | 'teams',
  rng: Rng,
): ProposedMatch[] {
  const perSide = participantsPerSide(teamFormat)
  const usableCourts = new Set(courts.map((c) => c.id))
  const slots = courts.map(() => ({ a: [] as string[], b: [] as string[] }))
  const placed = new Set<string>()

  const room = (courtIndex: number, side: 'a' | 'b') =>
    slots[courtIndex][side].length < perSide

  // Pinned first, in entry order so the result never depends on array order.
  for (const player of [...players].sort((x, y) => x.entryOrder - y.entryOrder)) {
    if (!player.seedCourtId || !usableCourts.has(player.seedCourtId)) continue
    const courtIndex = courts.findIndex((c) => c.id === player.seedCourtId)

    const preferred: Array<'a' | 'b'> = player.seedSide
      ? [player.seedSide, player.seedSide === 'a' ? 'b' : 'a']
      : ['a', 'b']

    // A pin to a court that is already full falls back to the open draw rather
    // than failing: the roster can change between setup and the first round.
    const side = preferred.find((s) => room(courtIndex, s))
    if (!side) continue

    slots[courtIndex][side].push(player.id)
    placed.add(player.id)
  }

  const rest = shuffle(
    players.filter((p) => !placed.has(p.id)).map((p) => p.id),
    rng,
  )

  let cursor = 0
  for (let courtIndex = 0; courtIndex < courts.length; courtIndex++) {
    for (const side of ['a', 'b'] as const) {
      while (room(courtIndex, side) && cursor < rest.length) {
        slots[courtIndex][side].push(rest[cursor++])
      }
    }
  }

  return courts.map((court, index) => ({
    courtId: court.id,
    sideA: slots[index].a,
    sideB: slots[index].b,
  }))
}

/**
 * Group by the Standing and split each group by formula. Used for every
 * Mexicano round after the first, and for the final round of both formats.
 */
function generateSeeded(
  state: TournamentState,
  roundNumber: number,
  players: Participant[],
  courts: Court[],
  history: History,
  formula: PairingFormula,
  avoidRepeats: boolean,
): ProposedMatch[] {
  const eligible = new Set(players.map((p) => p.id))
  const ranked = rankedParticipantIds(state, eligible)
  return pairMexicano(
    ranked,
    courts,
    state.config.teamFormat,
    formula,
    history,
    roundNumber,
    avoidRepeats,
  )
}

export function generateRound(
  state: TournamentState,
  options: GenerateOptions = {},
): ProposedRound {
  const { isFinal = false, variant = 0 } = options
  // A fresh Mexicano draw each time it is regenerated, unless a test pins it.
  const rng = options.rng ?? (variant === 0 ? Math.random : makeRng(variant))

  const roundNumber = nextRoundNumber(state)
  const history = historyOf(state)
  const courts = availableCourts(state, roundNumber).slice(0, matchCount(state, roundNumber))

  const isMexicanoFirstRound = state.config.format === 'mexicano' && state.rounds.length === 0
  const pinned = isMexicanoFirstRound
    ? new Set(state.participants.filter((p) => p.seedCourtId !== null).map((p) => p.id))
    : new Set<string>()

  // The final round is seeded from the standing, so its rest comes off the
  // bottom of the standing too — otherwise a contender can be rested out of the
  // decider. Ranked over everyone active, before anyone is set aside.
  const standingOrder = isFinal
    ? rankedParticipantIds(
        state,
        new Set(activeParticipants(state, roundNumber).map((p) => p.id)),
      )
    : undefined

  const resting =
    options.resting ?? chooseResting(state, roundNumber, history, pinned, standingOrder)
  const players = playingParticipants(state, roundNumber, resting)

  const formula = state.config.pairingFormula ?? DEFAULT_PAIRING_FORMULA

  let matches: ProposedMatch[]

  if (isFinal) {
    // Seeded by the standings in both formats, so a tournament always ends with
    // its contenders facing each other on Kort 1. In Americano this is the one
    // round where partner variety gives way to ranking, and the formula applies
    // literally — no repeat avoidance.
    matches = generateSeeded(
      state,
      roundNumber,
      players,
      courts,
      history,
      formula,
      state.config.format === 'mexicano',
    )
  } else if (isMexicanoFirstRound) {
    matches = seedFirstMexicanoRound(players, courts, state.config.teamFormat, rng)
  } else if (state.config.format === 'mexicano') {
    matches = generateSeeded(state, roundNumber, players, courts, history, formula, true)
  } else {
    matches = pairAmericano(
      players,
      courts,
      state.config.teamFormat,
      history,
      tieBreakOrder(players, variant),
    )
  }

  return normaliseOrder({ number: roundNumber, isFinal, matches, resting }, state)
}

/**
 * Put every side and the rest list into entry order.
 *
 * The algorithms emit their own orders — the Mexicano formula produces
 * `[rank 1, rank 4]`, greedy pairing produces whatever it picked first — while
 * reading a round back from the database sorts by entry order for stable
 * rendering. The result was a proposal that visibly reshuffled the moment it was
 * confirmed, which undermines the whole point of showing it first.
 *
 * Only the display order changes. A side is defined by who is in it.
 */
function normaliseOrder(round: ProposedRound, state: TournamentState): ProposedRound {
  const entryOrder = new Map(state.participants.map((p) => [p.id, p.entryOrder]))
  const byEntryOrder = (a: string, b: string) =>
    (entryOrder.get(a) ?? 0) - (entryOrder.get(b) ?? 0)

  return {
    ...round,
    matches: round.matches.map((match) => ({
      ...match,
      sideA: [...match.sideA].sort(byEntryOrder),
      sideB: [...match.sideB].sort(byEntryOrder),
    })),
    resting: [...round.resting].sort(byEntryOrder),
  }
}
