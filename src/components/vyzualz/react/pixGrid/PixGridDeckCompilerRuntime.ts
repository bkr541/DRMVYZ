import { create } from 'zustand'
import { useMediaStore } from '../../../../stores/mediaStore'
import { useReactStore } from '../../../../stores/reactStore'
import {
  PixGridDeckCompileCoordinator,
  type PixGridDeckCompilerDiagnostics,
} from './PixGridDeckCompileCoordinator'
import {
  PixGridDeckTransitionCoordinator,
  type PixGridDeckTransitionCoordinatorDiagnostics,
  type PixGridDeckTransitionStatus,
} from './PixGridDeckTransitionCoordinator'
import { resolvePixGridDeckMediaSource } from './PixGridDeckMediaSourceResolver'
import { pixGridDeckPreparedFrameCache } from './PixGridDeckPreparedFrameCache'
import { pixGridDeckTransitionPlanCache } from './PixGridDeckTransitionPlanCache'
import type {
  PixGridDeckCompileStatus,
  PixGridDeckTransitionPlan,
  PixGridPreparedFrameSet,
} from './PixGridDeckCompilerContracts'

interface PixGridDeckCompilerRuntimeState {
  statuses: Readonly<Record<string, PixGridDeckCompileStatus>>
  transitionStatuses: Readonly<Record<string, PixGridDeckTransitionStatus>>
  setStatuses: (statuses: Readonly<Record<string, PixGridDeckCompileStatus>>) => void
  setTransitionStatuses: (statuses: Readonly<Record<string, PixGridDeckTransitionStatus>>) => void
  clear: () => void
}

/** Runtime-only projection. Compiled buffers stay in the coordinator cache. */
export const usePixGridDeckCompilerStore = create<PixGridDeckCompilerRuntimeState>(set => ({
  statuses: {},
  transitionStatuses: {},
  setStatuses: statuses => set({ statuses }),
  setTransitionStatuses: transitionStatuses => set({ transitionStatuses }),
  clear: () => set({ statuses: {}, transitionStatuses: {} }),
}))

let coordinator: PixGridDeckCompileCoordinator | null = null
let transitionCoordinator: PixGridDeckTransitionCoordinator | null = null
let stopRuntime: (() => void) | null = null

function statusRecord<T>(statuses: ReadonlyMap<string, T>): Readonly<Record<string, T>> {
  return Object.freeze(Object.fromEntries(statuses))
}

export function startPixGridDeckCompilerRuntime(): () => void {
  if (stopRuntime) return stopRuntime
  coordinator = new PixGridDeckCompileCoordinator({ sourceResolver: resolvePixGridDeckMediaSource })
  transitionCoordinator = new PixGridDeckTransitionCoordinator()
  const syncTransitions = () => {
    if (!coordinator || !transitionCoordinator) return
    const state = useReactStore.getState()
    const frameSets = new Map<string, PixGridPreparedFrameSet>()
    for (const deck of state.pixGridDecks) {
      const frameSet = coordinator.getPreparedFrameSet(deck.id)
      if (frameSet) frameSets.set(deck.id, frameSet)
    }
    transitionCoordinator.synchronize(state.pixGridDecks, frameSets)
  }
  const sync = () => {
    if (!coordinator) return
    const state = useReactStore.getState()
    coordinator.synchronize(
      state.pixGridDecks,
      state.pixGridState.matrixWidth,
      state.pixGridState.matrixHeight,
    )
    syncTransitions()
  }
  const unsubscribeStatus = coordinator.subscribe(statuses => {
    usePixGridDeckCompilerStore.getState().setStatuses(statusRecord(statuses))
    syncTransitions()
  })
  const unsubscribeTransitionStatus = transitionCoordinator.subscribe(statuses => {
    usePixGridDeckCompilerStore.getState().setTransitionStatuses(statusRecord(statuses))
  })
  const unsubscribeReact = useReactStore.subscribe(sync)
  const unsubscribeMedia = useMediaStore.subscribe(() => coordinator?.notifyMediaSourcesChanged())
  sync()
  stopRuntime = () => {
    unsubscribeStatus()
    unsubscribeTransitionStatus()
    unsubscribeReact()
    unsubscribeMedia()
    coordinator?.dispose()
    transitionCoordinator?.dispose()
    coordinator = null
    transitionCoordinator = null
    pixGridDeckPreparedFrameCache.clear()
    pixGridDeckTransitionPlanCache.clear()
    stopRuntime = null
    usePixGridDeckCompilerStore.getState().clear()
  }
  return stopRuntime
}

export function getPixGridDeckCompileStatus(deckId: string): PixGridDeckCompileStatus | null {
  return usePixGridDeckCompilerStore.getState().statuses[deckId] ?? null
}

export function getPixGridPreparedFrameSet(deckId: string): PixGridPreparedFrameSet | null {
  return coordinator?.getPreparedFrameSet(deckId) ?? null
}

export function getPixGridDeckTransitionPlan(
  deckId: string,
  sourceItemId: string,
  targetItemId: string,
): PixGridDeckTransitionPlan | null {
  return transitionCoordinator?.getPlan(deckId, sourceItemId, targetItemId) ?? null
}

export function getPixGridDeckTransitionStatus(deckId: string): PixGridDeckTransitionStatus | null {
  return usePixGridDeckCompilerStore.getState().transitionStatuses[deckId] ?? null
}

export function retryPixGridDeckCompilation(deckId: string): void {
  coordinator?.retryDeck(deckId)
  transitionCoordinator?.retryDeck(deckId)
}

export function getPixGridDeckCompilerDiagnostics(): PixGridDeckCompilerDiagnostics {
  return coordinator?.getDiagnostics() ?? {
    queuedJobCount: 0,
    runningJobCount: 0,
    deduplicatedJobCount: 0,
    trackedDeckCount: 0,
    cacheEntryCount: 0,
    cacheBytes: 0,
  }
}


export function getPixGridDeckTransitionDiagnostics(): PixGridDeckTransitionCoordinatorDiagnostics {
  return transitionCoordinator?.getDiagnostics() ?? {
    queuedJobCount: 0,
    runningJobCount: 0,
    deduplicatedJobCount: 0,
    trackedDeckCount: 0,
    expectedPairCount: 0,
    cacheEntryCount: 0,
    cacheBytes: 0,
  }
}
