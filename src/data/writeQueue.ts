/**
 * The offline score queue.
 *
 * The app requires a connection, but typed input must never be lost — a wifi
 * blip at the desk should cost nothing. Scores are written optimistically to a
 * local queue, shown as pending, and retried until they land.
 *
 * Safe to replay because a score write is an update to a known match row with
 * known values: sending it twice writes the same thing (see docs/schema.md,
 * "Idempotency"). Nothing else goes through here — round creation is not
 * idempotent in the same way and needs the organiser watching.
 */

const STORAGE_KEY = 'padel.pendingScores.v1'
const RETRY_INTERVAL_MS = 5000

export interface PendingScore {
  matchId: string
  tournamentId: string
  scoreA: number
  scoreB: number
  /** Set when the last attempt failed for a reason other than being offline. */
  lastError?: string
}

type Writer = (score: PendingScore) => Promise<void>

let queue: PendingScore[] = load()
let writer: Writer | null = null
/** The in-flight pass, if any. Callers await this rather than starting a second. */
let flushing: Promise<void> | null = null
/** Set when a score is queued mid-flush, so the running pass takes another lap. */
let rerun = false
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function load(): PendingScore[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PendingScore[]) : []
  } catch {
    return []
  }
}

function persist() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // A full or unavailable localStorage must not break score entry; the queue
    // still works in memory for this session.
  }
}

function emit() {
  persist()
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Snapshot for useSyncExternalStore — stable identity while unchanged. */
export function getPending(): PendingScore[] {
  return queue
}

export function pendingFor(matchId: string): PendingScore | undefined {
  return queue.find((item) => item.matchId === matchId)
}

export function configureWriter(next: Writer) {
  writer = next
}

/**
 * Queue a score and try to send it immediately. Re-queuing the same match
 * replaces the earlier value: only the latest score for a match matters, so a
 * correction typed while offline supersedes rather than stacks.
 */
export function enqueueScore(score: PendingScore) {
  queue = [...queue.filter((item) => item.matchId !== score.matchId), score]
  emit()
  void flush()
}

/** One pass over the queue. Returns true if it gave up on a failed write. */
async function onePass(): Promise<boolean> {
  if (!writer) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true

  for (const item of [...queue]) {
    try {
      await writer(item)
      queue = queue.filter((q) => q.matchId !== item.matchId)
      emit()
    } catch (error) {
      // Keep it queued and stop this pass: if one write is failing because the
      // connection is gone, the rest will fail too. The timer and the `online`
      // event will bring us back.
      queue = queue.map((q) =>
        q.matchId === item.matchId
          ? { ...q, lastError: error instanceof Error ? error.message : String(error) }
          : q,
      )
      emit()
      return true
    }
  }
  return false
}

/**
 * Drain the queue, coalescing concurrent callers.
 *
 * A second call while a pass is running does not start a competing pass, nor
 * does it get dropped: it asks the running one for another lap and returns the
 * same promise. Without that, a score queued mid-flush would sit there until
 * the retry timer came round, even though the connection was fine.
 */
export function flush(): Promise<void> {
  if (flushing) {
    rerun = true
    return flushing
  }

  flushing = (async () => {
    for (;;) {
      rerun = false
      const gaveUp = await onePass()
      if (gaveUp || !rerun) return
    }
  })().finally(() => {
    flushing = null
  })

  return flushing
}

/** Retry on reconnect and on a slow timer, so recovery needs no user action. */
export function startWriteQueue() {
  if (timer !== null) return
  timer = setInterval(() => void flush(), RETRY_INTERVAL_MS)
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => void flush())
  }
  void flush()
}

export function stopWriteQueue() {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

/** Test seam. */
export function resetWriteQueue() {
  queue = []
  flushing = null
  rerun = false
  writer = null
  emit()
}
