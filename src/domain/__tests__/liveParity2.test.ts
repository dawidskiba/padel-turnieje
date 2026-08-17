import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

import { computeStandings } from '../standings'
import { toTournamentState } from '../../data/mapping'

/**
 * A second real tournament, pulled from the live database after the pairing
 * fixes: 11 players on 2 courts, 5 normal rounds plus a standings-seeded final.
 *
 * Expected values are the actual output of the `standings` SQL view for this
 * data. The domain reimplements that view so Mexicano can rank without a round
 * trip; if the two ever drift, the public page starts telling players something
 * the desk disagrees with.
 */
const raw = JSON.parse(
  readFileSync(new URL('./live-fixture-2.json', import.meta.url), 'utf8'),
) as Record<string, unknown[]>

const bundle = {
  tournament: raw.tournaments[0],
  courts: raw.courts,
  participants: raw.participants,
  rounds: raw.rounds,
  matches: raw.matches,
  matchParticipants: raw.match_participants,
  roundParticipants: raw.round_participants,
}

describe('domain vs the database, second real tournament', () => {
  it('reproduces the standings view exactly', () => {
    const rows = computeStandings(toTournamentState(bundle as never)).map(
      (r) => `${r.name}|${r.points}|${r.difference}|${r.wins}|${r.draws}|${r.losses}|${r.rests}`,
    )
    expect(rows).toEqual([
      'j|84|41|4|0|1|1',
      'e|80|32|4|0|0|2',
      'k|68|9|3|0|2|1',
      'c|67|6|3|0|1|2',
      'g|64|0|1|0|3|2',
      'h|63|-1|2|0|3|1',
      'd|62|-4|1|0|3|2',
      'f|58|-12|2|0|2|2',
      'b|57|-14|2|0|2|2',
      'a|52|-24|2|0|2|2',
      'i|47|-33|0|0|5|1',
    ])
  })
})
