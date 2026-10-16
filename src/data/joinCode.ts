/**
 * Reaching a tournament by its four-digit code or by scanning its QR from
 * inside the app (ADR-0005).
 *
 * On iPhone a QR scanned with the Camera app always opens Safari, never the
 * Home Screen app, so a player who installed the app at their first tournament
 * reaches every later one from here instead.
 */

import { supabase } from '../lib/supabase'

/** Mirrors the check constraint on tournaments.join_code. */
const JOIN_CODE = /^[1-9][0-9]{3}$/

/** Mirrors the alphabet of public.generate_slug(). */
const SLUG = /^[23456789abcdefghjkmnpqrstuvwxyz]{10}$/

/** Keeps what a player types to at most four digits. */
export function normaliseCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, 4)
}

export function isJoinCode(value: string): boolean {
  return JOIN_CODE.test(value)
}

export type ScannedTarget = { kind: 'slug'; slug: string } | { kind: 'code'; code: string }

/**
 * What a scanned QR points at. The desk's QR holds the full tournament link;
 * only its slug is used, so a link from a preview deployment or a pasted
 * foreign URL can never navigate the app anywhere but one of its own pages.
 */
export function parseScanned(text: string): ScannedTarget | null {
  const trimmed = text.trim()
  if (isJoinCode(trimmed)) return { kind: 'code', code: trimmed }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  const match = /^\/t\/([^/]+)\/?$/.exec(url.pathname)
  if (!match || !SLUG.test(match[1])) return null
  return { kind: 'slug', slug: match[1] }
}

/** Whether the desk should still show the code: matches public.join_code_is_live(). */
export function joinCodeIsLive(finishedAt: string | null, now: Date = new Date()): boolean {
  if (!finishedAt) return true
  return now.getTime() - new Date(finishedAt).getTime() < 24 * 60 * 60 * 1000
}

export class TooManyAttemptsError extends Error {}

/** The tournament's slug, or null when no live tournament has this code. */
export async function resolveJoinCode(code: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolve_join_code', { p_code: code })
  if (error) {
    if (error.code === '54000') throw new TooManyAttemptsError(error.message)
    throw new Error(error.message)
  }
  return (data as string | null) ?? null
}
