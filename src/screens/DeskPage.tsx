/**
 * The desk. One page, three states, and the place the whole evening happens.
 *
 * Round generation runs here as a pure function and the result is held in
 * component state until the organiser confirms it, so the database never
 * contains an unconfirmed round (ADR-0003).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { historyOf } from '../domain/history'
import { generateRound } from '../domain/round'
import { computeStandings } from '../domain/standings'
import {
  activeParticipants,
  isRoundComplete,
  matchCount,
  participantsPerMatch,
  splitScore,
} from '../domain/types'
import type { ProposedRound } from '../domain/types'
import {
  saveScore,
  useAddParticipant,
  useCourtMutations,
  useCreateRound,
  usePendingScores,
  useRetireParticipant,
  useTournamentSettings,
  useTournamentView,
  useUndoRound,
  useUnretireParticipant,
  useUpdateSeed,
} from '../data/hooks'
import { matchIdFor } from '../data/mapping'
import { Sheet } from '../ui/Sheet'
import { ShareBlock } from '../ui/QrCode'
import { Notice, Spinner } from '../ui/primitives'
import { NotFoundPage } from './NotFoundPage'
import { FinishedState } from './desk/FinishedState'
import { RestPicker } from './desk/RestPicker'
import { RunningState } from './desk/RunningState'
import { ScoreSheet } from './desk/ScoreSheet'
import type { ScoreTarget } from './desk/ScoreSheet'
import { SettingsSheet } from './desk/SettingsSheet'
import { SetupState } from './desk/SetupState'

export function DeskPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { view, isLoading, error } = useTournamentView(id)

  const [proposal, setProposal] = useState<ProposedRound | null>(null)
  const [scoreTarget, setScoreTarget] = useState<(ScoreTarget & { side: 'a' | 'b' }) | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [restPickerOpen, setRestPickerOpen] = useState(false)

  const createRound = useCreateRound(id)
  const undoRound = useUndoRound(id)
  const addParticipant = useAddParticipant(id)
  const retire = useRetireParticipant(id)
  const unretire = useUnretireParticipant(id)
  const updateSeed = useUpdateSeed(id)
  const courtMutations = useCourtMutations(id)
  const settings = useTournamentSettings(id)
  const pending = usePendingScores()

  const state = view?.state ?? null
  const standings = useMemo(() => (state ? computeStandings(state) : []), [state])

  const nameOf = useMemo(() => {
    const names = new Map(state?.participants.map((p) => [p.id, p.name]) ?? [])
    return (participantId: string) => names.get(participantId) ?? '—'
  }, [state])

  const courtName = useMemo(() => {
    const names = new Map(state?.courts.map((c) => [c.id, c.name]) ?? [])
    return (courtId: string) => names.get(courtId) ?? '—'
  }, [state])

  const currentRound = useMemo(() => {
    if (!state?.rounds.length) return null
    return state.rounds.reduce((latest, round) =>
      round.number > latest.number ? round : latest,
    )
  }, [state])

  /**
   * The final round closes the tournament once its results are in. Deferred
   * until nothing is queued: finishing while a score is still pending would
   * publish a table that is about to change.
   */
  const finishing = useRef(false)
  const finishMutate = settings.finish.mutate
  useEffect(() => {
    if (!view || !currentRound) return
    if (view.phase !== 'running' || !currentRound.isFinal) return
    if (!isRoundComplete(currentRound)) return
    if (pending.length > 0) return
    if (finishing.current) return

    finishing.current = true
    finishMutate(undefined, { onSettled: () => (finishing.current = false) })
  }, [view, currentRound, pending.length, finishMutate])

  if (isLoading) return <Spinner label="Wczytuję turniej…" />
  // A tournament you do not own returns no rows, and "not found" is the honest
  // answer: "forbidden" would confirm it exists.
  if (error || !view || !state) return <NotFoundPage />

  const { bundle, phase } = view
  const nextNumber = (currentRound?.number ?? 0) + 1
  const history = historyOf(state)

  function propose(isFinal: boolean) {
    if (!state) return
    setProposal(generateRound(state, { isFinal }))
  }

  async function confirmProposal() {
    if (!proposal) return
    await createRound.mutateAsync(proposal)
    setProposal(null)
  }

  function openScoreSheet(roundNumber: number, courtId: string, side: 'a' | 'b') {
    if (!state) return
    const round = state.rounds.find((r) => r.number === roundNumber)
    const match = round?.matches.find((m) => m.courtId === courtId)
    const matchId = matchIdFor(bundle, roundNumber, courtId)
    if (!round || !match || !matchId) return

    const sideNames = (ids: string[]) => ids.map(nameOf).join(' + ')

    setScoreTarget({
      side,
      matchId,
      courtName: courtName(courtId),
      sideLabel: side === 'a' ? sideNames(match.sideA) : sideNames(match.sideB),
      opponentLabel: side === 'a' ? sideNames(match.sideB) : sideNames(match.sideA),
      current: side === 'a' ? match.scoreA : match.scoreB,
    })
  }

  function isPending(roundNumber: number, courtId: string): boolean {
    const matchId = matchIdFor(bundle, roundNumber, courtId)
    return matchId ? pending.some((p) => p.matchId === matchId) : false
  }

  const restRequired = proposal
    ? proposal.resting.length
    : state.participants.length - matchCount(state, nextNumber) * participantsPerMatch(state.config.teamFormat)

  return (
    <>
      {phase === 'setup' ? (
        <SetupState
          state={state}
          actions={{
            updateScoring: (scoring) => settings.scoring.mutate(scoring),
            updateSeed: (participantId, seedCourtId, seedSide) =>
              updateSeed.mutate({ participantId, seedCourtId, seedSide }),
            start: () => propose(false),
            openSettings: () => setSettingsOpen(true),
          }}
        />
      ) : null}

      {phase === 'finished' ? (
        <FinishedState
          name={bundle.tournament.name}
          standings={standings}
          onShare={() => setShareOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : null}

      {phase === 'running' || (phase === 'setup' && proposal) ? (
        <div className={phase === 'setup' ? 'mt-6' : ''}>
          <RunningState
            name={bundle.tournament.name}
            currentRound={currentRound}
            proposal={proposal}
            rounds={state.rounds}
            standings={standings}
            courtName={courtName}
            nameOf={nameOf}
            isPending={isPending}
            saving={createRound.isPending}
            actions={{
              score: openScoreSheet,
              nextRound: () => propose(false),
              finalRound: () => propose(true),
              confirmProposal: () => void confirmProposal(),
              discardProposal: () => setProposal(null),
              changeResting: () => setRestPickerOpen(true),
              openSettings: () => setSettingsOpen(true),
              share: () => setShareOpen(true),
            }}
          />
        </div>
      ) : null}

      {createRound.error ? (
        <Notice tone="danger">
          {createRound.error instanceof Error
            ? createRound.error.message
            : 'Nie udało się zapisać rundy.'}
        </Notice>
      ) : null}

      <ScoreSheet
        target={scoreTarget}
        gamePoints={state.config.gamePoints}
        onClose={() => setScoreTarget(null)}
        onSave={(value) => {
          if (!scoreTarget || !id) return
          const { scoreA, scoreB } = splitScore(scoreTarget.side, value, state.config.gamePoints)
          saveScore(id, scoreTarget.matchId, scoreA, scoreB)
        }}
      />

      {proposal ? (
        <RestPicker
          open={restPickerOpen}
          onClose={() => setRestPickerOpen(false)}
          participants={activeParticipants(state, proposal.number)}
          history={history}
          required={restRequired}
          initial={proposal.resting}
          onConfirm={(resting) => {
            // Regenerate with the override so pairings follow the new set of
            // players, rather than leaving the old pairs with a swapped rest list.
            setProposal(generateRound(state, { isFinal: proposal.isFinal, resting }))
          }}
        />
      ) : null}

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        bundle={bundle}
        state={state}
        phase={phase}
        actions={{
          addParticipant: (name, creditMissedRounds) =>
            addParticipant.mutate({ name, creditMissedRounds }),
          retireParticipant: (participantId, afterRound) =>
            retire.mutate({ participantId, afterRound }),
          unretireParticipant: (participantId) => unretire.mutate(participantId),
          addCourt: (name, position) => courtMutations.add.mutate({ name, position }),
          renameCourt: (courtId, name) => courtMutations.rename.mutate({ courtId, name }),
          removeCourt: (courtId, fromRound) =>
            courtMutations.remove.mutate({ courtId, fromRound }),
          restoreCourt: (courtId) => courtMutations.restore.mutate(courtId),
          renameTournament: (name) => settings.rename.mutate(name),
          undoLastRound: () => {
            const last = bundle.rounds.reduce<{ id: string; number: number } | null>(
              (latest, row) => (!latest || row.number > latest.number ? row : latest),
              null,
            )
            if (last) undoRound.mutate(last.id)
            setProposal(null)
            setSettingsOpen(false)
          },
          finish: () => {
            settings.finish.mutate()
            setSettingsOpen(false)
          },
          reopen: () => {
            settings.reopen.mutate()
            setSettingsOpen(false)
          },
          deleteTournament: () => {
            settings.remove.mutate(undefined, {
              // Leave the desk only once the delete has actually landed, so a
              // failure is visible here rather than looking like success.
              onSuccess: () => {
                setSettingsOpen(false)
                navigate('/turnieje', { replace: true })
              },
            })
          },
        }}
      />

      <Sheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Udostępnij turniej"
        size="md"
      >
        <ShareBlock url={`${window.location.origin}/t/${bundle.tournament.slug}`} />
        <p className="mt-4 text-center text-sm text-text-muted">
          Każdy z tym linkiem zobaczy tabelę i bieżącą rundę. Nie potrzebuje konta.
        </p>
      </Sheet>
    </>
  )
}
