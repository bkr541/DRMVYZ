import { create } from 'zustand'
import type { SplitPersistenceStatusEvent } from '../lib/splitPersistStorage'

export type ReactPersistencePhase = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

interface ReactPersistenceStatusState {
  phase: ReactPersistencePhase
  error: string | null
  lastSavedAt: number | null
  retryPending: boolean
  retry: () => Promise<void>
  reset: () => void
}

let retryOperation: (() => Promise<boolean>) | null = null

export const useReactPersistenceStatusStore = create<ReactPersistenceStatusState>((set) => ({
  phase: 'idle',
  error: null,
  lastSavedAt: null,
  retryPending: false,
  retry: async () => {
    if (!retryOperation) return
    set({ phase: 'saving', retryPending: true, error: null })
    const succeeded = await retryOperation()
    if (!succeeded) {
      set(state => state.phase === 'error'
        ? { retryPending: false }
        : { phase: 'error', retryPending: false, error: 'Retry failed. Recent edits may still be unsafe.' })
      return
    }
    set(state => state.phase === 'saved'
      ? { retryPending: false }
      : { phase: 'saved', retryPending: false, error: null, lastSavedAt: Date.now() })
  },
  reset: () => {
    retryOperation = null
    set({ phase: 'idle', error: null, lastSavedAt: null, retryPending: false })
  },
}))

export function handleReactPersistenceStatus(event: SplitPersistenceStatusEvent): void {
  if (event.retry) retryOperation = event.retry
  if (event.phase === 'saved') retryOperation = null

  useReactPersistenceStatusStore.setState({
    phase: event.phase,
    error: event.phase === 'error' ? (event.error ?? 'Recent edits could not be saved.') : null,
    lastSavedAt: event.lastSavedAt ?? useReactPersistenceStatusStore.getState().lastSavedAt,
    retryPending: false,
  })
}
