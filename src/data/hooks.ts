/**
 * React bindings over the data layer. Components use these rather than calling
 * `tournaments.ts` directly, so cache invalidation lives in one place.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useSyncExternalStore } from 'react'

import type { CreateTournamentPayload } from '../lib/database.types'
import type { ProposedRound } from '../domain/types'
import { phaseOf, toTournamentState } from './mapping'
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

/** Bundle plus the derived views the desk needs, memoised together. */
export function useTournamentView(id: string | undefined) {
  const query = useTournament(id)
  const derived = useMemo(() => {
    if (!query.data) return null
    return {
      bundle: query.data,
      state: toTournamentState(query.data),
      phase: phaseOf(query.data),
    }
  }, [query.data])

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

function useInvalidate(id: string | undefined) {
  const client = useQueryClient()
  return () => {
    if (id) void client.invalidateQueries({ queryKey: keys.tournament(id) })
    void client.invalidateQueries({ queryKey: keys.tournaments })
  }
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
      void client.invalidateQueries({ queryKey: keys.tournament(score.tournamentId) })
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
