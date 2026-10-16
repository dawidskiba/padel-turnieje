/**
 * What one subscribed participant is told when a round is written.
 *
 * Kept free of Deno and npm imports so vitest can run it alongside the app's
 * own tests: index.ts is the only part that needs the Edge runtime.
 */

/** One row of round_notifications(), as the RPC returns it. */
export interface RoundNotificationRow {
  subscription_id: string
  endpoint: string
  p256dh: string
  auth: string
  slug: string
  tournament: string
  team_format: 'individual' | 'teams'
  round_number: number
  is_final: boolean
  participant: string
  status: 'playing' | 'resting' | 'credited'
  court: string | null
  partners: string[]
  opponents: string[]
}

/** What the service worker receives and shows. */
export interface PushMessage {
  title: string
  body: string
  /**
   * Same for every push about the same round of the same tournament, so a round
   * that was undone and generated again replaces the earlier notification on
   * the phone instead of sitting beside it with the wrong court.
   */
  tag: string
  url: string
}

/** The browsers' own push services. Mirrors public.is_push_endpoint(). */
const PUSH_ENDPOINT =
  /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\//

export function isPushEndpoint(endpoint: string): boolean {
  return endpoint.length <= 1024 && PUSH_ENDPOINT.test(endpoint)
}

function roundLabel(row: RoundNotificationRow): string {
  return row.is_final ? 'Runda finałowa' : `Runda ${row.round_number}`
}

function names(list: string[]): string {
  return list.join(' i ')
}

/**
 * Null when there is nothing worth a push: a credited round is a latecomer's
 * history, never the round being played now.
 */
export function composeMessage(row: RoundNotificationRow): PushMessage | null {
  const tag = `${row.slug}-round-${row.round_number}`
  const url = `/t/${row.slug}`

  if (row.status === 'resting') {
    return {
      title: `${roundLabel(row)}: pauza`,
      body: 'Pauzujesz w tej rundzie. Punkty za pauzę doliczą się automatycznie.',
      tag,
      url,
    }
  }

  if (row.status !== 'playing' || !row.court) return null

  const body =
    row.team_format === 'teams' || row.partners.length === 0
      ? `Rywal: ${names(row.opponents)}`
      : `Partner: ${names(row.partners)} · Rywale: ${names(row.opponents)}`

  return { title: `${roundLabel(row)}: ${row.court}`, body, tag, url }
}
