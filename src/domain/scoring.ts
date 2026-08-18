/**
 * How a round is turned into points.
 *
 * Two schemes, chosen per tournament:
 *
 * **`points`** — the raw match score, as it always was. Correct for Americano,
 * where players are deliberately spread across courts and the court you are on
 * carries no meaning.
 *
 * **`courts`** — court-weighted, for Mexicano, where the court *is* a statement
 * about who you are playing. Raw points systematically favour the weaker courts:
 * every match hands out `gamePoints` between the two sides, and the pairing
 * formula balances the top court so it lands 11–10, while a wide-spread lower
 * court lands 18–3. Measured on a real tournament, the second court paid its
 * winner almost three points a round more than the first. A player who never
 * left the bottom court finished second.
 *
 * Under `courts` a round pays a fixed base for where you played and whether you
 * won, plus a small bonus for the margin.
 */

import type { Round, TournamentState } from './types'

export type Scoring = 'points' | 'courts'

/** Difference between winning and losing on the same court. */
const WIN_GAP = 6
/** Difference between one court and the next one down. */
const COURT_STEP = 4
/** Most the margin can add or subtract. */
export const MARGIN_CAP = 2

/**
 * `WIN_GAP > COURT_STEP` is the whole design, and it is why the numbers are what
 * they are.
 *
 * It makes a win one court down outrank a loss one court up, so a strong player
 * dealt a bad opening draw climbs by winning. Reverse the inequality and the
 * ladder becomes a caste system: whoever starts high stays high, and the fix for
 * one unfairness introduces another.
 *
 * The margin cap then has to stay below the court step, or a demolition on a weak
 * court catches a tight win on a strong one and the original problem returns.
 */
if (WIN_GAP <= COURT_STEP || MARGIN_CAP >= COURT_STEP) {
  throw new Error('court scoring constants violate their own invariants')
}

export interface RoundScale {
  /** Courts in play that round — taken from the round, not from today's courts. */
  courtCount: number
  /** True while the ladder is still meaningless, so every court pays alike. */
  neutral: boolean
}

/**
 * Points for a court, before the margin. `court` is 1-based from the top.
 *
 * While `neutral`, every court pays the middle of the scale: the first rounds of
 * a Mexicano are a blind draw, so the court says nothing about strength and
 * weighting it would bank the luck of that draw.
 */
export function courtBase(
  court: number,
  { courtCount, neutral }: RoundScale,
): { win: number; loss: number } {
  const loss = neutral
    ? 2 + ((courtCount - 1) * COURT_STEP) / 2
    : 2 + (courtCount - court) * COURT_STEP

  return { win: loss + WIN_GAP, loss }
}

/**
 * What the margin adds. Bounded, because unbounded margin is exactly what caused
 * the problem: scaling a whole score cannot separate courts, since a winner on
 * any court can score anywhere from just over half the target up to all of it.
 */
export function marginBonus(scored: number, conceded: number, gamePoints: number): number {
  if (gamePoints <= 0) return 0
  const exact = (MARGIN_CAP * (scored - conceded)) / gamePoints
  // Rounded away from zero, not upwards: Math.round(-0.5) is -0 while Postgres
  // round(-0.5) is -1, and the loser's margin is always negative. They diverge
  // whenever the deficit is exactly a quarter of the target — 6:10 on a 16-point
  // game — so the desk would show one standing and the database another.
  const rounded = Math.sign(exact) * Math.round(Math.abs(exact))
  return Math.max(-MARGIN_CAP, Math.min(MARGIN_CAP, rounded))
}

/** What a round in which somebody did not play is worth: the middle of the scale. */
export function restValue({ courtCount }: RoundScale): number {
  return 2 * courtCount + 3
}

/**
 * A round credited to somebody who joined later. One less than a rest, for the
 * same reason as under raw points: resting is turning up and finding no court
 * free, being credited is not having been there.
 */
export function creditValue(scale: RoundScale): number {
  return restValue(scale) - 1
}

export function scaleFor(round: Round, neutralRounds: number): RoundScale {
  return {
    // The round's own match count, so removing a court later never re-prices a
    // round that has already been played.
    courtCount: Math.max(1, round.matches.length),
    neutral: round.number <= neutralRounds,
  }
}

/**
 * Points a participant earns from one played match under court scoring.
 * `courtRank` is 1-based among the courts used in that round.
 */
export function playedValue(
  courtRank: number,
  scored: number,
  conceded: number,
  gamePoints: number,
  scale: RoundScale,
): number {
  const base = courtBase(courtRank, scale)
  const won = scored > conceded
  const drawn = scored === conceded
  // A draw sits between the two, which only an even target can produce.
  const start = drawn ? (base.win + base.loss) / 2 : won ? base.win : base.loss
  return start + marginBonus(scored, conceded, gamePoints)
}

/** Courts used in a round, ranked 1..n by position, ignoring any left idle. */
export function courtRanks(state: TournamentState, round: Round): Map<string, number> {
  const position = new Map(state.courts.map((c) => [c.id, c.position]))
  const used = round.matches
    .map((m) => m.courtId)
    .sort((a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0))
  return new Map(used.map((id, index) => [id, index + 1]))
}
