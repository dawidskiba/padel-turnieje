/**
 * What a viewer needs to know about themselves, derived from the public
 * payload. Kept out of the component because "which court am I on and who am I
 * with" is the entire point of the page and has more cases than it looks.
 *
 * Identity is a name: the public payload deliberately carries no ids
 * (ADR-0002), and names are unique within a tournament anyway.
 */

import type { PublicTournament } from '../lib/database.types'

export type ViewerSituation =
  | { kind: 'playing'; court: string; partners: string[]; opponents: string[]; yourScore: number | null; theirScore: number | null }
  | { kind: 'resting' }
  | { kind: 'absent' }
  | { kind: 'unknown' }

const VIEWER_KEY_PREFIX = 'padel.viewer.'

export function readViewerName(slug: string): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(VIEWER_KEY_PREFIX + slug)
  } catch {
    return null
  }
}

export function writeViewerName(slug: string, name: string | null) {
  if (typeof localStorage === 'undefined') return
  try {
    if (name === null) localStorage.removeItem(VIEWER_KEY_PREFIX + slug)
    else localStorage.setItem(VIEWER_KEY_PREFIX + slug, name)
  } catch {
    // Private browsing: the viewer simply picks their name again next visit.
  }
}

export function describeViewer(
  payload: PublicTournament,
  viewer: string | null,
): ViewerSituation {
  if (!viewer) return { kind: 'unknown' }

  const round = payload.current_round
  if (!round) return { kind: 'absent' }

  for (const match of round.matches) {
    const sideA = match.side_a ?? []
    const sideB = match.side_b ?? []

    const onA = sideA.includes(viewer)
    const onB = sideB.includes(viewer)
    if (!onA && !onB) continue

    const mine = onA ? sideA : sideB
    const theirs = onA ? sideB : sideA

    return {
      kind: 'playing',
      court: match.court,
      partners: mine.filter((name) => name !== viewer),
      opponents: theirs,
      yourScore: onA ? match.score_a : match.score_b,
      theirScore: onA ? match.score_b : match.score_a,
    }
  }

  if (round.resting.includes(viewer)) return { kind: 'resting' }

  // In the tournament but not in this round — retired, or joined later.
  return { kind: 'absent' }
}

/** Every name a viewer could claim, in table order. */
export function viewerCandidates(payload: PublicTournament): string[] {
  return payload.standings.map((row) => row.name)
}
