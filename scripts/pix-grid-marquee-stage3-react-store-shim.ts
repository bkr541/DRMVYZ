import { useSyncExternalStore } from 'react'
import type { PixGridState } from '../src/components/vyzualz/react/pixGrid/PixGridTypes'

interface PixGridStage3HarnessStore {
  pixGridState: PixGridState
  pixGridUndoStack: readonly PixGridState[]
  pixGridRedoStack: readonly PixGridState[]
  trackSceneId: string | null
  setPixGridState: (patch: Partial<PixGridState> | PixGridState) => void
  applyPixGridAuthoringState: (state: PixGridState) => void
  setPixGridRequestedQuality: (quality: PixGridState['quality']) => void
  setPixGridPresentation: (patch: Partial<Pick<PixGridState, 'cellGap' | 'cellRoundness' | 'cellBrightness' | 'glowAmount' | 'diffusion' | 'rgbSubpixelMode'>>) => void
  beginPixGridHistoryTransaction: () => void
  commitPixGridHistoryTransaction: () => void
  cancelPixGridHistoryTransaction: () => void
  undoPixGridEdit: () => void
  redoPixGridEdit: () => void
}

type Selector<T> = (state: PixGridStage3HarnessStore) => T

let current: PixGridStage3HarnessStore | null = null
const listeners = new Set<() => void>()

function publish(next: PixGridStage3HarnessStore): void {
  current = next
  for (const listener of listeners) listener()
}

function requireStore(): PixGridStage3HarnessStore {
  if (!current) throw new Error('PixGrid Stage 3 browser harness was not initialized.')
  return current
}

function updatePixGridState(nextState: PixGridState): void {
  publish({ ...requireStore(), pixGridState: nextState })
}

export function initializePixGridStage3Store(pixGridState: PixGridState, trackSceneId: string | null): void {
  const base: PixGridStage3HarnessStore = {
    pixGridState,
    pixGridUndoStack: [],
    pixGridRedoStack: [],
    trackSceneId,
    setPixGridState: patch => {
      const previous = requireStore().pixGridState
      updatePixGridState({ ...previous, ...patch } as PixGridState)
    },
    applyPixGridAuthoringState: updatePixGridState,
    setPixGridRequestedQuality: quality => updatePixGridState({ ...requireStore().pixGridState, quality }),
    setPixGridPresentation: patch => updatePixGridState({ ...requireStore().pixGridState, ...patch }),
    beginPixGridHistoryTransaction: () => {},
    commitPixGridHistoryTransaction: () => {},
    cancelPixGridHistoryTransaction: () => {},
    undoPixGridEdit: () => {},
    redoPixGridEdit: () => {},
  }
  publish(base)
}

export function setPixGridStage3TrackScene(trackSceneId: string | null): void {
  publish({ ...requireStore(), trackSceneId })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

interface PixGridStoreHook {
  <T>(selector: Selector<T>): T
  getState(): PixGridStage3HarnessStore
}

export const useReactStore = ((selector: Selector<unknown>) => (
  useSyncExternalStore(subscribe, () => selector(requireStore()), () => selector(requireStore()))
)) as PixGridStoreHook

useReactStore.getState = requireStore
