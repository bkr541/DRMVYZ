import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactPersistenceStatusStore } from '../../../stores/reactPersistenceStatusStore'

function formatSavedTime(timestamp: number | null): string | null {
  if (!timestamp) return null
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function ReactPersistenceStatus() {
  const { phase, error, lastSavedAt, retryPending, retry } = useReactPersistenceStatusStore(useShallow(state => ({
    phase: state.phase,
    error: state.error,
    lastSavedAt: state.lastSavedAt,
    retryPending: state.retryPending,
    retry: state.retry,
  })))
  const savedTime = useMemo(() => formatSavedTime(lastSavedAt), [lastSavedAt])

  if (phase === 'idle') return null

  if (phase === 'error') {
    return (
      <div className="rv-persistence-status rv-persistence-status--error" role="alert">
        <span className="rv-persistence-status-dot" aria-hidden="true" />
        <span title={error ?? undefined}>Changes not safely stored</span>
        <button type="button" onClick={() => { void retry() }} disabled={retryPending}>
          {retryPending ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    )
  }

  const label = phase === 'dirty'
    ? 'Unsaved changes'
    : phase === 'saving'
      ? 'Saving…'
      : savedTime
        ? `Saved ${savedTime}`
        : 'Saved'

  return (
    <div className={`rv-persistence-status rv-persistence-status--${phase}`} role="status" aria-live="polite">
      <span className="rv-persistence-status-dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
