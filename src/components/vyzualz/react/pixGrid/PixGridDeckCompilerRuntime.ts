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
import { PIX_GRID_REGISTERED_SEQUENCE_DECKS } from './PixGridPresetRegistry'

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
let synchronizeRuntime: (() => void) | null = null
let runtimeResolution: Readonly<{ owner: object; width: number; height: number }> | null = null

function statusRecord<T>(statuses: ReadonlyMap<string, T>): Readonly<Record<string, T>> {
  return Object.freeze(Object.fromEntries(statuses))
}

function runtimeDecks(decks: readonly import('./PixGridDeckDomain').PixGridDeckDefinition[]) {
  const ids = new Set(decks.map(deck => deck.id))
  return [...decks, ...PIX_GRID_REGISTERED_SEQUENCE_DECKS.filter(deck => !ids.has(deck.id))]
}

export function startPixGridDeckCompilerRuntime(): () => void {
  if (stopRuntime) return stopRuntime
  coordinator = new PixGridDeckCompileCoordinator({ sourceResolver: resolvePixGridDeckMediaSource })
  transitionCoordinator = new PixGridDeckTransitionCoordinator()
  const syncTransitions = () => {
    if (!coordinator || !transitionCoordinator) return
    const state = useReactStore.getState()
    const frameSets = new Map<string, PixGridPreparedFrameSet>()
    const decks = runtimeDecks(state.pixGridDecks)
    for (const deck of decks) {
      const frameSet = coordinator.getPreparedFrameSet(deck.id)
      if (frameSet) frameSets.set(deck.id, frameSet)
    }
    transitionCoordinator.synchronize(decks, frameSets)
  }
  const sync = () => {
    if (!coordinator) return
    const state = useReactStore.getState()
    coordinator.synchronize(
      runtimeDecks(state.pixGridDecks),
      runtimeResolution?.width ?? state.pixGridState.matrixWidth,
      runtimeResolution?.height ?? state.pixGridState.matrixHeight,
    )
    syncTransitions()
  }
  let lastDecks = useReactStore.getState().pixGridDecks
  let lastMatrixWidth = useReactStore.getState().pixGridState.matrixWidth
  let lastMatrixHeight = useReactStore.getState().pixGridState.matrixHeight
  let lastMediaItems = useMediaStore.getState().items
  synchronizeRuntime = sync
  const unsubscribeStatus = coordinator.subscribe(statuses => {
    usePixGridDeckCompilerStore.getState().setStatuses(statusRecord(statuses))
    syncTransitions()
  })
  const unsubscribeTransitionStatus = transitionCoordinator.subscribe(statuses => {
    usePixGridDeckCompilerStore.getState().setTransitionStatuses(statusRecord(statuses))
  })
  const unsubscribeReact = useReactStore.subscribe(state => {
    const matrixChanged = !runtimeResolution
      && (state.pixGridState.matrixWidth !== lastMatrixWidth || state.pixGridState.matrixHeight !== lastMatrixHeight)
    if (state.pixGridDecks === lastDecks && !matrixChanged) return
    lastDecks = state.pixGridDecks
    lastMatrixWidth = state.pixGridState.matrixWidth
    lastMatrixHeight = state.pixGridState.matrixHeight
    sync()
  })
  const unsubscribeMedia = useMediaStore.subscribe(state => {
    if (state.items === lastMediaItems) return
    lastMediaItems = state.items
    coordinator?.notifyMediaSourcesChanged()
  })
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
    synchronizeRuntime = null
    runtimeResolution = null
    usePixGridDeckCompilerStore.getState().clear()
  }
  return stopRuntime
}


/**
 * The live surface owns the effective logical matrix when adaptive quality is
 * active. This runtime-only projection keeps the canonical compiler aligned
 * without writing quality changes into project state.
 */
export function setPixGridDeckRuntimeResolution(owner: object, width: number, height: number): void {
  const nextWidth = Math.max(1, Math.floor(width))
  const nextHeight = Math.max(1, Math.floor(height))
  if (
    runtimeResolution?.owner === owner
    && runtimeResolution.width === nextWidth
    && runtimeResolution.height === nextHeight
  ) return
  runtimeResolution = { owner, width: nextWidth, height: nextHeight }
  synchronizeRuntime?.()
}

export function clearPixGridDeckRuntimeResolution(owner: object): void {
  if (runtimeResolution?.owner !== owner) return
  runtimeResolution = null
  synchronizeRuntime?.()
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

export function prioritizePixGridDeckTransitionPairs(
  deckId: string,
  pairs: readonly (readonly [string, string])[],
): void {
  transitionCoordinator?.setPlaybackDemand(deckId, pairs)
}

export function retryPixGridDeckCompilation(deckId: string): void {
  coordinator?.retryDeck(deckId)
  transitionCoordinator?.retryDeck(deckId)
}

export function retryPixGridDeckTransitionPair(deckId: string, sourceItemId: string, targetItemId: string): void {
  transitionCoordinator?.retryPair(deckId, sourceItemId, targetItemId)
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
    completedJobCount: 0,
    totalCompilationMs: 0,
    averageCompilationMs: 0,
  }
}
