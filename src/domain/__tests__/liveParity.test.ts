import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { computeStandings } from '../standings'
import { toTournamentState } from '../../data/mapping'


const raw = JSON.parse(readFileSync(new URL('./live-fixture.json', import.meta.url), 'utf8'))
const T1 = 'a33d9df7-d612-4f6e-b9dc-da5e892ef3a2'

const rounds = raw.rounds.filter((r: any) => r.tournament_id === T1)
const roundIds = new Set(rounds.map((r: any) => r.id))
const matches = raw.matches.filter((m: any) => roundIds.has(m.round_id))
const matchIds = new Set(matches.map((m: any) => m.id))

const bundle = {
  tournament: raw.tournaments.find((t: any) => t.id === T1),
  courts: raw.courts.filter((c: any) => c.tournament_id === T1),
  participants: raw.participants.filter((p: any) => p.tournament_id === T1),
  rounds,
  matches,
  matchParticipants: raw.match_participants.filter((mp: any) => matchIds.has(mp.match_id)),
  roundParticipants: raw.round_participants.filter((rp: any) => roundIds.has(rp.round_id)),
}

describe('domain vs the database, on real tournament data', () => {
  it('produces exactly what the standings view produced', () => {
    const rows = computeStandings(toTournamentState(bundle as any)).map(
      (r) => `${r.name}|${r.points}|${r.difference}|${r.wins}|${r.draws}|${r.losses}|${r.rests}`,
    )
    expect(rows).toEqual([
      'F|63|42|3|0|1|0',
      'C|55|25|2|0|1|1',
      'G|43|2|3|0|1|0',
      'B|42|-1|2|0|1|1',
      'I|39|-6|2|0|2|0',
      'D|37|-11|1|0|2|1',
      'A|36|-13|1|0|2|1',
      'H|33|-18|0|0|4|0',
      'E|32|-20|2|0|2|0',
    ])
  })
})
