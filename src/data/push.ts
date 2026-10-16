/**
 * Round notifications on the player's phone (ADR-0004).
 *
 * The device subscribes once, under the name the viewer picked; the database
 * does the rest when the organiser writes a round. Nothing here reads the
 * subscription back from the server — it is write-only by design — so whether
 * this device is subscribed is remembered locally, per tournament.
 */

import { supabase } from '../lib/supabase'

export type PushSupport = 'supported' | 'needs-home-screen' | 'unsupported'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
const PUSH_KEY_PREFIX = 'padel.push.'

interface SupportEnv {
  userAgent: string
  platform: string
  maxTouchPoints: number
  standalone: boolean
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
  vapidKey: string | undefined
}

function currentEnv(): SupportEnv {
  const nav = navigator as Navigator & { standalone?: boolean }
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    standalone:
      nav.standalone === true ||
      (typeof matchMedia === 'function' &&
        (matchMedia('(display-mode: standalone)').matches ||
          matchMedia('(display-mode: fullscreen)').matches)),
    hasServiceWorker: 'serviceWorker' in nav,
    hasPushManager: typeof window !== 'undefined' && 'PushManager' in window,
    hasNotification: typeof window !== 'undefined' && 'Notification' in window,
    vapidKey: VAPID_PUBLIC_KEY,
  }
}

/**
 * iPhone Safari has no PushManager at all outside a Home Screen app, so it has
 * to be recognised before the feature checks, or it reads as "unsupported" and
 * the player is never told the one step that would make it work.
 */
export function pushSupport(env: SupportEnv = currentEnv()): PushSupport {
  if (!env.vapidKey) return 'unsupported'

  // iPadOS reports itself as a Mac; the touch points give it away.
  const ios =
    /iPad|iPhone|iPod/.test(env.userAgent) || (env.platform === 'MacIntel' && env.maxTouchPoints > 1)
  if (ios && !env.standalone) return 'needs-home-screen'

  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return 'unsupported'
  return 'supported'
}

/** VAPID keys are distributed base64url-encoded; the Push API wants the bytes. */
export function urlBase64ToUint8Array(value: string): Uint8Array {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export function readPushName(slug: string): string | null {
  try {
    return localStorage.getItem(PUSH_KEY_PREFIX + slug)
  } catch {
    return null
  }
}

function writePushName(slug: string, name: string | null) {
  try {
    if (name === null) localStorage.removeItem(PUSH_KEY_PREFIX + slug)
    else localStorage.setItem(PUSH_KEY_PREFIX + slug, name)
  } catch {
    // Private browsing: the toggle shows "off" next visit, the subscription still works.
  }
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

export type SubscribeResult = 'subscribed' | 'denied'

/** Must be called from a tap: browsers refuse a permission prompt otherwise. */
export async function subscribeToRounds(slug: string, name: string): Promise<SubscribeResult> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  const reg = await registration()
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
    }))

  const { error } = await supabase.rpc('subscribe_push', {
    p_slug: slug,
    p_name: name,
    p_subscription: subscription.toJSON(),
  })
  if (error) throw new Error(error.message)

  writePushName(slug, name)
  return 'subscribed'
}

/**
 * Forgets this device for one tournament only. The browser subscription itself
 * is kept: the same endpoint may be following another tournament.
 */
export async function unsubscribeFromRounds(slug: string): Promise<void> {
  writePushName(slug, null)
  if (!('serviceWorker' in navigator)) return

  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  const subscription = await reg?.pushManager.getSubscription()
  if (!subscription) return

  const { error } = await supabase.rpc('unsubscribe_push', {
    p_slug: slug,
    p_endpoint: subscription.endpoint,
  })
  if (error) throw new Error(error.message)
}
