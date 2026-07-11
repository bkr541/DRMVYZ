import { useEffect } from 'react'
import { useMediaStore } from '../../../stores/mediaStore'
import type { MediaMutationOperation } from '../../../stores/mediaStore'
import { useAudioStore } from '../../../stores/audioStore'

export function MediaStatusBar({ includeAudio = false }: { includeAudio?: boolean }) {
  const {
    loading, loadError, deleteError, authRequired,
    storageAvailable, lastRestored,
    clearLoadError, clearDeleteError, clearRestored,
    mutationStates = {}, collectionOrderMutations = {}, retryMediaMutation, reapplyMediaMutation, clearMediaMutation,
    retryCollectionReorder, clearCollectionReorderError,
  } = useMediaStore()
  const audioError = useAudioStore(state => state.loadError)
  const clearAudioError = useAudioStore(state => state.clearError)

  const operationLabels: Record<MediaMutationOperation, string> = {
    edit: 'Media edit',
    role: 'Role update',
    favorite: 'Favorite update',
    tags: 'Tag update',
    'add-to-collection': 'Add to collection',
    'remove-from-collection': 'Remove from collection',
    metadata: 'Metadata update',
  }
  const mutationFailure = Object.values(mutationStates)
    .filter(state => state.status !== 'pending')
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const reorderFailure = Object.values(collectionOrderMutations)
    .filter(state => state.status !== 'pending')
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]

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

  if (mutationFailure) return (
    <div className={`vz-media-status vz-media-status--${mutationFailure.status === 'conflict' ? 'warn' : 'error'}`}>
      <span className="vz-media-status-dot" />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {operationLabels[mutationFailure.operation]}: {mutationFailure.message}
      </span>
      <button
        type="button"
        className="vz-media-status-action"
        onClick={() => { void (mutationFailure.status === 'conflict'
          ? reapplyMediaMutation(mutationFailure.itemId, mutationFailure.operation)
          : retryMediaMutation(mutationFailure.itemId, mutationFailure.operation)) }}
      >
        {mutationFailure.status === 'conflict' ? 'Reapply' : 'Retry'}
      </button>
      <button className="vz-media-status-dismiss" onClick={() => clearMediaMutation(mutationFailure.itemId, mutationFailure.operation)} title="Dismiss">✕</button>
    </div>
  )

  if (reorderFailure) return (
    <div className={`vz-media-status vz-media-status--${reorderFailure.status === 'conflict' ? 'warn' : 'error'}`}>
      <span className="vz-media-status-dot" />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        Collection order: {reorderFailure.message}
      </span>
      <button type="button" className="vz-media-status-action" onClick={() => { void retryCollectionReorder(reorderFailure.collectionId) }}>Retry</button>
      <button className="vz-media-status-dismiss" onClick={() => clearCollectionReorderError(reorderFailure.collectionId)} title="Dismiss">✕</button>
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
