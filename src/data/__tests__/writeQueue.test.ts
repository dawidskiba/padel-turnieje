import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  configureWriter,
  enqueueScore,
  flush,
  getPending,
  pendingFor,
  resetWriteQueue,
} from '../writeQueue'

function score(matchId: string, scoreA: number, scoreB: number) {
  return { matchId, tournamentId: 't1', scoreA, scoreB }
}

afterEach(() => {
  resetWriteQueue()
  vi.unstubAllGlobals()
})

describe('offline score queue', () => {
  it('clears a score once it is written', async () => {
    const written: string[] = []
    configureWriter(async (s) => {
      written.push(`${s.matchId}:${s.scoreA}-${s.scoreB}`)
    })

    enqueueScore(score('m1', 15, 6))
    await flush()

    expect(written).toEqual(['m1:15-6'])
    expect(getPending()).toEqual([])
  })

  it('keeps a score queued when the write fails', async () => {
    configureWriter(async () => {
      throw new Error('Failed to fetch')
    })

    enqueueScore(score('m1', 15, 6))
    await flush()

    expect(getPending()).toHaveLength(1)
    expect(pendingFor('m1')?.lastError).toBe('Failed to fetch')
  })

  it('retries a failed score and clears it once the connection returns', async () => {
    let offline = true
    configureWriter(async () => {
      if (offline) throw new Error('Failed to fetch')
    })

    enqueueScore(score('m1', 15, 6))
    await flush()
    expect(getPending()).toHaveLength(1)

    offline = false
    await flush()
    expect(getPending()).toEqual([])
  })

  it('supersedes an earlier score for the same match rather than stacking', async () => {
    configureWriter(async () => {
      throw new Error('offline')
    })

    enqueueScore(score('m1', 15, 6))
    await flush()
    // organiser notices the typo and corrects it while still offline
    enqueueScore(score('m1', 12, 9))
    await flush()

    expect(getPending()).toHaveLength(1)
    expect(pendingFor('m1')).toMatchObject({ scoreA: 12, scoreB: 9 })
  })

  it('stops the pass at the first failure instead of hammering a dead connection', async () => {
    let attempts = 0
    configureWriter(async () => {
      attempts++
      throw new Error('offline')
    })

    enqueueScore(score('m1', 15, 6))
    enqueueScore(score('m2', 11, 10))
    enqueueScore(score('m3', 21, 0))
    await flush()

    // Three scores queued, but only one write attempted: the rest would fail
    // for the same reason, so they wait for the retry timer.
    expect(attempts).toBe(1)
    expect(getPending()).toHaveLength(3)
  })

  it('picks up a score queued while a flush is already running', async () => {
    const written: string[] = []
    let release: (() => void) | null = null
    configureWriter(async (s) => {
      if (s.matchId === 'm1') {
        await new Promise<void>((resolve) => {
          release = resolve
        })
      }
      written.push(s.matchId)
    })

    enqueueScore(score('m1', 15, 6))
    // Arrives mid-flight. Without coalescing this would sit in the queue until
    // the retry timer, despite the connection being perfectly fine.
    enqueueScore(score('m2', 11, 10))

    release!()
    await flush()

    expect(written).toEqual(['m1', 'm2'])
    expect(getPending()).toEqual([])
  })

  it('writes queued scores in the order they were entered', async () => {
    const written: string[] = []
    configureWriter(async (s) => {
      written.push(s.matchId)
    })

    enqueueScore(score('m1', 15, 6))
    enqueueScore(score('m2', 11, 10))
    await flush()

    expect(written).toEqual(['m1', 'm2'])
  })

  it('does not attempt anything while the browser reports itself offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    let attempts = 0
    configureWriter(async () => {
      attempts++
    })

    enqueueScore(score('m1', 15, 6))
    await flush()

    expect(attempts).toBe(0)
    expect(getPending()).toHaveLength(1)
  })
})
