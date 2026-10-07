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

  const chipClass = 'rv-persistence-status vsm-settings-btn vz-header-status-chip vz-header-chip vz-header-chip--save-state'

  if (phase === 'error') {
    return (
      <div className={`${chipClass} rv-persistence-status--error`} data-save-tone="error" role="alert">
        <span className="vz-header-state-label" aria-hidden="true">Save</span>
        <span className="vz-header-state-value" title={error ?? undefined}>Changes not safely stored</span>
        <button type="button" onClick={() => { void retry() }} disabled={retryPending}>
          {retryPending ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    )
  }

  // Like the CPU chip: a dim label and a value in the state's colour. Saved reads "SAVED 7:38 AM".
  const label = phase === 'saved' ? 'Saved' : 'Save'
  const value = phase === 'dirty'
    ? 'Unsaved changes'
    : phase === 'saving'
      ? 'Saving…'
      : savedTime
  const tone = phase === 'dirty' ? 'unsaved' : phase === 'saving' ? 'saving' : 'saved'

  return (
    <div className={`${chipClass} rv-persistence-status--${phase}`} data-save-tone={tone} role="status" aria-live="polite">
      <span className="vz-header-state-label">{label}</span>
      {value && <span className="vz-header-state-value">{value}</span>}
    </div>
  )
}
