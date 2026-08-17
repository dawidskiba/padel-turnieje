/**
 * React bindings over the data layer. Components use these rather than calling
 * `tournaments.ts` directly, so cache invalidation lives in one place.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useSyncExternalStore } from 'react'

import type { CreateTournamentPayload } from '../lib/database.types'
import type { ProposedRound } from '../domain/types'
import { applyPendingScores, phaseOf, toTournamentState } from './mapping'
import type { TournamentBundle } from './mapping'
import * as api from './tournaments'
import {
  configureWriter,
  getPending,
  startWriteQueue,
  subscribe as subscribeToQueue,
} from './writeQueue'

/** How often the public view asks for fresh data (ADR-0002: polling, not realtime). */
export const PUBLIC_POLL_MS = 5000

export const keys = {
  tournaments: ['tournaments'] as const,
  tournament: (id: string) => ['tournament', id] as const,
  publicTournament: (slug: string) => ['public-tournament', slug] as const,
}

export function useTournaments() {
  return useQuery({ queryKey: keys.tournaments, queryFn: api.listTournaments })
}

export function useTournament(id: string | undefined) {
  return useQuery({
    queryKey: keys.tournament(id ?? ''),
    queryFn: () => api.loadTournament(id!),
    enabled: Boolean(id),
  })
}

/**
 * Bundle plus the derived views the desk needs, with any queued scores already
 * applied so everything downstream reflects what the organiser just typed.
 */
export function useTournamentView(id: string | undefined) {
  const query = useTournament(id)
  const pending = usePendingScores()

  const derived = useMemo(() => {
    if (!query.data) return null
    const bundle = applyPendingScores(query.data, pending)
    return {
      bundle,
      state: toTournamentState(bundle),
      phase: phaseOf(bundle),
    }
  }, [query.data, pending])

  return { ...query, view: derived }
}

export function usePublicTournament(slug: string | undefined) {
  return useQuery({
    queryKey: keys.publicTournament(slug ?? ''),
    queryFn: () => api.fetchPublicTournament(slug!),
    enabled: Boolean(slug),
    // Paused automatically while the tab is hidden, which is most of an evening
    // for a phone in someone's pocket.
    refetchInterval: PUBLIC_POLL_MS,
  })
}

/**
 * Returns the refetch promise rather than firing and forgetting.
 *
 * TanStack waits for whatever onSuccess returns before a mutation settles, so
 * returning the promise means callers see fresh data the moment their await
 * resolves. Discarding it made `confirmProposal` clear the proposal while the
 * cache still held the *previous* round — a visible flash of the old round, or
 * of the setup screen when confirming round 1.
 */
function useInvalidate(id: string | undefined) {
  const client = useQueryClient()
  return () =>
    Promise.all([
      id ? client.invalidateQueries({ queryKey: keys.tournament(id) }) : Promise.resolve(),
      client.invalidateQueries({ queryKey: keys.tournaments }),
    ])
}

export function useCreateTournament() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateTournamentPayload) => api.createTournament(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.tournaments }),
  })
}

export function useCreateRound(tournamentId: string | undefined) {
  const invalidate = useInvalidate(tournamentId)
  return useMutation({
    mutationFn: (proposal: ProposedRound) => api.createRound(tournamentId!, proposal),
    onSuccess: invalidate,
  })
}

export function useUndoRound(tournamentId: string | undefined) {
  const invalidate = useInvalidate(tournamentId)
  return useMutation({
    mutationFn: (roundId: string) => api.deleteRound(roundId),
    onSuccess: invalidate,
  })
}

export function useAddParticipant(tournamentId: string | undefined) {
  const invalidate = useInvalidate(tournamentId)
  return useMutation({
    mutationFn: (input: { name: string; creditMissedRounds: boolean }) =>
      api.addParticipant(tournamentId!, input.name, input.creditMissedRounds),
    onSuccess: invalidate,
  })
}

export function useRetireParticipant(tournamentId: string | undefined) {
  const invalidate = useInvalidate(tournamentId)
  return useMutation({
    mutationFn: (input: { participantId: string; afterRound: number }) =>
      api.retireParticipant(input.participantId, input.afterRound),
    onSuccess: invalidate,
  })
}

export function useUnretireParticipant(tournamentId: string | undefined) {
  const invalidate = useInvalidate(tournamentId)
  return useMutation({
    mutationFn: (participantId: string) => api.unretireParticipant(participantId),
    onSuccess: invalidate,
  })
}

export function useUpdateSeed(tournamentId: string | undefined) {
  const invalidate = useInvalidate(tournamentId)
  return useMutation({
    mutationFn: (input: {
      participantId: string
      seedCourtId: string | null
      seedSide: 'a' | 'b' | null
    }) => api.updateSeed(input.participantId, input.seedCourtId, input.seedSide),
    onSuccess: invalidate,
  })
}

export function useCourtMutations(tournamentId: string | undefined) {
  const invalidate = useInvalidate(tournamentId)

  const add = useMutation({
    mutationFn: (input: { name: string; position: number }) =>
      api.addCourt(tournamentId!, input.name, input.position),
    onSuccess: invalidate,
  })
  const rename = useMutation({
    mutationFn: (input: { courtId: string; name: string }) =>
      api.renameCourt(input.courtId, input.name),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (input: { courtId: string; fromRound: number }) =>
      api.removeCourt(input.courtId, input.fromRound),
    onSuccess: invalidate,
  })
  const restore = useMutation({
    mutationFn: (courtId: string) => api.restoreCourt(courtId),
    onSuccess: invalidate,
  })

  return { add, rename, remove, restore }
}

export function useTournamentSettings(tournamentId: string | undefined) {
  const invalidate = useInvalidate(tournamentId)

  const rename = useMutation({
    mutationFn: (name: string) => api.renameTournament(tournamentId!, name),
    onSuccess: invalidate,
  })
  const scoring = useMutation({
    mutationFn: (input: { gamePoints: number; restPoints: number }) =>
      api.updateScoring(tournamentId!, input),
    onSuccess: invalidate,
  })
  const finish = useMutation({
    mutationFn: () => api.finishTournament(tournamentId!),
    onSuccess: invalidate,
  })
  const reopen = useMutation({
    mutationFn: () => api.reopenTournament(tournamentId!),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: () => api.deleteTournament(tournamentId!),
    onSuccess: invalidate,
  })

  return { rename, scoring, finish, reopen, remove }
}

/**
 * Wire the offline score queue to the database and to the query cache. Mounted
 * once, high in the tree.
 */
export function useWriteQueue() {
  const client = useQueryClient()

  useEffect(() => {
    configureWriter(async (score) => {
      await api.writeScore(score.matchId, score.scoreA, score.scoreB)

      // Patch the one match rather than invalidating the tournament. A full
      // refetch is six round trips to replace a single number, and it is the
      // reason entering a score felt slow. The value on screen already came
      // from the write queue, so there is nothing to reconcile.
      client.setQueryData<TournamentBundle>(keys.tournament(score.tournamentId), (current) =>
        current
          ? {
              ...current,
              matches: current.matches.map((match) =>
                match.id === score.matchId
                  ? { ...match, score_a: score.scoreA, score_b: score.scoreB }
                  : match,
              ),
            }
          : current,
      )
    })
    startWriteQueue()
  }, [client])
}

export function usePendingScores() {
  return useSyncExternalStore(subscribeToQueue, getPending, getPending)
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (listener) => {
      window.addEventListener('online', listener)
      window.addEventListener('offline', listener)
      return () => {
        window.removeEventListener('online', listener)
        window.removeEventListener('offline', listener)
      }
    },
    () => navigator.onLine,
    () => true,
  )
}

export { saveScore } from './tournaments'
