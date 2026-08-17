/**
 * Form state -> the create_tournament payload.
 *
 * Pulled out of the component because the interesting part is a mapping with
 * real rules in it: which fields survive, and how a pin becomes a court
 * *index* rather than an id, since the courts do not exist yet.
 */

import type { CreateTournamentPayload } from '../lib/database.types'
import type { DraftTournament } from '../domain/validation'
import type { Seeds } from '../ui/SeedingEditor'

export function buildCreatePayload(
  draft: DraftTournament,
  seeds: Seeds = {},
): CreateTournamentPayload {
  const courts = draft.courts.map((court) => court.trim()).filter(Boolean)

  return {
    name: draft.name.trim(),
    format: draft.format,
    team_format: draft.teamFormat,
    game_points: draft.gamePoints,
    rest_points: draft.restPoints,
    // The formula only means something when four individuals share a court.
    pairing_formula:
      draft.format === 'mexicano' && draft.teamFormat === 'individual'
        ? draft.pairingFormula
        : null,
    courts,
    participants: draft.participants
      .map((participant) => participant.trim())
      .filter(Boolean)
      .map((name) => {
        // Pins are Mexicano-only, and one naming a court that has since been
        // removed is dropped rather than sent as a dangling index.
        const seed = draft.format === 'mexicano' ? seeds[name] : undefined
        const pinned = seed && seed.courtIndex < courts.length

        return {
          name,
          ...(pinned ? { seed_court_index: seed.courtIndex } : {}),
          ...(pinned && seed.side ? { seed_side: seed.side } : {}),
        }
      }),
  }
}
