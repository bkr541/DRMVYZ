import { create } from 'zustand'
import { useMediaStore } from '../../../../stores/mediaStore'
import { useReactStore } from '../../../../stores/reactStore'
import {
  PixGridDeckCompileCoordinator,
  type PixGridDeckCompilerDiagnostics,
} from './PixGridDeckCompileCoordinator'
import { resolvePixGridDeckMediaSource } from './PixGridDeckMediaSourceResolver'
import { pixGridDeckPreparedFrameCache } from './PixGridDeckPreparedFrameCache'
import type {
  PixGridDeckCompileStatus,
  PixGridPreparedFrameSet,
} from './PixGridDeckCompilerContracts'

interface PixGridDeckCompilerRuntimeState {
  statuses: Readonly<Record<string, PixGridDeckCompileStatus>>
  setStatuses: (statuses: Readonly<Record<string, PixGridDeckCompileStatus>>) => void
  clear: () => void
}

/** Runtime-only projection. Compiled buffers stay in the coordinator cache. */
export const usePixGridDeckCompilerStore = create<PixGridDeckCompilerRuntimeState>(set => ({
  statuses: {},
  setStatuses: statuses => set({ statuses }),
  clear: () => set({ statuses: {} }),
}))

let coordinator: PixGridDeckCompileCoordinator | null = null
let stopRuntime: (() => void) | null = null

function statusRecord(statuses: ReadonlyMap<string, PixGridDeckCompileStatus>): Readonly<Record<string, PixGridDeckCompileStatus>> {
  return Object.freeze(Object.fromEntries(statuses))
}

export function startPixGridDeckCompilerRuntime(): () => void {
  if (stopRuntime) return stopRuntime
  coordinator = new PixGridDeckCompileCoordinator({ sourceResolver: resolvePixGridDeckMediaSource })
  const sync = () => {
    if (!coordinator) return
    const state = useReactStore.getState()
    coordinator.synchronize(
      state.pixGridDecks,
      state.pixGridState.matrixWidth,
      state.pixGridState.matrixHeight,
    )
  }
  const unsubscribeStatus = coordinator.subscribe(statuses => {
    usePixGridDeckCompilerStore.getState().setStatuses(statusRecord(statuses))
  })
  const unsubscribeReact = useReactStore.subscribe(sync)
  const unsubscribeMedia = useMediaStore.subscribe(() => coordinator?.notifyMediaSourcesChanged())
  sync()
  stopRuntime = () => {
    unsubscribeStatus()
    unsubscribeReact()
    unsubscribeMedia()
    coordinator?.dispose()
    coordinator = null
    pixGridDeckPreparedFrameCache.clear()
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

export function retryPixGridDeckCompilation(deckId: string): void {
  coordinator?.retryDeck(deckId)
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
