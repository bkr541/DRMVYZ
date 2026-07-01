import { useEffect } from 'react'
import { useMediaStore } from '../../../stores/mediaStore'
import { useAudioStore } from '../../../stores/audioStore'

export function MediaStatusBar({ includeAudio = false }: { includeAudio?: boolean }) {
  const {
    loading, loadError, deleteError, authRequired,
    storageAvailable, lastRestored,
    clearLoadError, clearDeleteError, clearRestored,
  } = useMediaStore()
  const audioError = useAudioStore(state => state.loadError)
  const clearAudioError = useAudioStore(state => state.clearError)

  useEffect(() => {
    if (lastRestored === null || lastRestored === 0) return
    const id = setTimeout(() => clearRestored(), 4000)
    return () => clearTimeout(id)
  }, [lastRestored, clearRestored])

  if (loading) return (
    <div className="vz-media-status vz-media-status--info">
      <span className="vz-media-status-dot vz-media-status-dot--pulse" />
      Reloading media library…
    </div>
  )

  if (!storageAvailable) return (
    <div className="vz-media-status vz-media-status--warn">
      <span className="vz-media-status-dot" />
      Storage not configured — files are local only
    </div>
  )

  if (deleteError) return (
    <div className="vz-media-status vz-media-status--error">
      <span className="vz-media-status-dot" />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Delete failed: {deleteError}</span>
      <button className="vz-media-status-dismiss" onClick={clearDeleteError} title="Dismiss">✕</button>
    </div>
  )

  if (includeAudio && audioError) return (
    <div className="vz-media-status vz-media-status--error">
      <span className="vz-media-status-dot" />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{audioError}</span>
      <button className="vz-media-status-dismiss" onClick={clearAudioError} title="Dismiss">✕</button>
    </div>
  )

  if (loadError) return (
    <div className="vz-media-status vz-media-status--error">
      <span className="vz-media-status-dot" />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loadError}</span>
      <button className="vz-media-status-dismiss" onClick={clearLoadError} title="Dismiss">✕</button>
    </div>
  )

  if (authRequired) return (
    <div className="vz-media-status vz-media-status--info">
      <span className="vz-media-status-dot" />
      Sign in to sync media to cloud
    </div>
  )

  if (lastRestored !== null && lastRestored > 0) return (
    <div className="vz-media-status vz-media-status--ok">
      <span className="vz-media-status-dot" />
      Restored {lastRestored} media item{lastRestored !== 1 ? 's' : ''}
    </div>
  )

  return null
}
