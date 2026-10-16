/**
 * Sends each subscribed participant their court for a freshly written round.
 *
 * Called by the rounds_notify trigger through pg_net, after create_round's
 * transaction commits (ADR-0004). pg_net carries no JWT, so the function is
 * deployed with verify_jwt = false and checks a shared secret instead.
 *
 * Secrets (supabase secrets set …):
 *   NOTIFY_ROUND_SECRET   same value as the vault secret notify_round_secret
 *   VAPID_PUBLIC_KEY      same value as the app's VITE_VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT         mailto: or https: contact for the push services
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the runtime.
 */

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import webpush from 'npm:web-push@3.6.7'

import { composeMessage, isPushEndpoint } from './message.ts'
import type { RoundNotificationRow } from './message.ts'

/** A round nobody reads within a quarter of an hour has been played already. */
const TTL_SECONDS = 15 * 60

function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`missing secret ${name}`)
  return value
}

webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))

const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
})

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('method not allowed', { status: 405 })

  if (request.headers.get('x-notify-secret') !== env('NOTIFY_ROUND_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }

  const { round_id: roundId } = (await request.json().catch(() => ({}))) as { round_id?: string }
  if (!roundId) return new Response('round_id required', { status: 400 })

  const { data, error } = await supabase.rpc('round_notifications', { p_round: roundId })
  if (error) return new Response(error.message, { status: 500 })

  const rows = (data ?? []) as RoundNotificationRow[]
  const gone: string[] = []
  let sent = 0

  await Promise.all(
    rows.map(async (row) => {
      const message = composeMessage(row)
      if (!message || !isPushEndpoint(row.endpoint)) return

      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(message),
          { TTL: TTL_SECONDS, urgency: 'high' },
        )
        sent += 1
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        // The browser dropped the subscription — permission revoked, site data
        // cleared, app uninstalled. Nothing will ever arrive there again.
        if (status === 404 || status === 410) gone.push(row.subscription_id)
        else console.error('push failed', status, (err as Error).message)
      }
    }),
  )

  if (gone.length) {
    await supabase.from('push_subscriptions').delete().in('id', gone)
  }

  return Response.json({ sent, gone: gone.length, skipped: rows.length - sent - gone.length })
})
