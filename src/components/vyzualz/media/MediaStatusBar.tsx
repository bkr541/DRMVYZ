import { useShallow } from 'zustand/react/shallow'
import { useMediaStore } from '../../../stores/mediaStore'
import type { MediaMutationOperation } from '../../../stores/mediaStore'
import { useAudioStore } from '../../../stores/audioStore'
import { DrawerNotice } from '../shared/DrawerNotice'
import { IconChipButton } from '../react/controls/IconChipButton'

export function MediaStatusBar({ includeAudio = false }: { includeAudio?: boolean }) {
  const {
    loading,
    loadError,
    deleteError,
    authRequired,
    storageAvailable,
    clearLoadError,
    clearDeleteError,
    mutationStates = {},
    collectionOrderMutations = {},
    deletionStates = {},
    uploadCleanupStates = {},
    retryMediaMutation,
    reapplyMediaMutation,
    clearMediaMutation,
    retryCollectionReorder,
    clearCollectionReorderError,
    retryDeletion,
    retryUploadCleanup,
  } = useMediaStore(useShallow(state => ({
    loading: state.loading,
    loadError: state.loadError,
    deleteError: state.deleteError,
    authRequired: state.authRequired,
    storageAvailable: state.storageAvailable,
    clearLoadError: state.clearLoadError,
    clearDeleteError: state.clearDeleteError,
    mutationStates: state.mutationStates,
    collectionOrderMutations: state.collectionOrderMutations,
    deletionStates: state.deletionStates,
    uploadCleanupStates: state.uploadCleanupStates,
    retryMediaMutation: state.retryMediaMutation,
    reapplyMediaMutation: state.reapplyMediaMutation,
    clearMediaMutation: state.clearMediaMutation,
    retryCollectionReorder: state.retryCollectionReorder,
    clearCollectionReorderError: state.clearCollectionReorderError,
    retryDeletion: state.retryDeletion,
    retryUploadCleanup: state.retryUploadCleanup,
  })))
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
  const deletionState = Object.values(deletionStates)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const uploadCleanupState = Object.values(uploadCleanupStates)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]

  if (loading) return (
    <DrawerNotice tone="info" role="status" title="Media library refresh">
      Reloading media library…
    </DrawerNotice>
  )

  if (!storageAvailable) return (
    <DrawerNotice tone="warning" role="status" title="Cloud storage unavailable">
      Storage not configured — files are local only
    </DrawerNotice>
  )

  if (mutationFailure) return (
    <DrawerNotice
      tone={mutationFailure.status === 'conflict' ? 'warning' : 'error'}
      role="alert"
      title={`${operationLabels[mutationFailure.operation]} needs attention`}
      onDismiss={() => clearMediaMutation(mutationFailure.itemId, mutationFailure.operation)}
    >
      {operationLabels[mutationFailure.operation]}: {mutationFailure.message}{' '}
      <IconChipButton
        className="vz-media-status-action"
        onClick={() => { void (mutationFailure.status === 'conflict'
          ? reapplyMediaMutation(mutationFailure.itemId, mutationFailure.operation)
          : retryMediaMutation(mutationFailure.itemId, mutationFailure.operation)) }}
      >
        {mutationFailure.status === 'conflict' ? 'Reapply' : 'Retry'}
      </IconChipButton>
    </DrawerNotice>
  )

  if (reorderFailure) return (
    <DrawerNotice
      tone={reorderFailure.status === 'conflict' ? 'warning' : 'error'}
      role="alert"
      title="Collection order needs attention"
      onDismiss={() => clearCollectionReorderError(reorderFailure.collectionId)}
    >
      Collection order: {reorderFailure.message}{' '}
      <IconChipButton className="vz-media-status-action" onClick={() => { void retryCollectionReorder(reorderFailure.collectionId) }}>Retry</IconChipButton>
    </DrawerNotice>
  )

  if (uploadCleanupState) return (
    <DrawerNotice tone={uploadCleanupState.status === 'failed' ? 'error' : 'warning'} role="alert" title="Upload cleanup needs attention">
      Failed upload cleanup: {uploadCleanupState.message ?? `${uploadCleanupState.completedPaths.length}/${uploadCleanupState.storagePaths.length} objects removed.`}{' '}
      <IconChipButton className="vz-media-status-action" onClick={() => { void retryUploadCleanup(uploadCleanupState.jobId) }}>Retry cleanup</IconChipButton>
    </DrawerNotice>
  )

  if (deletionState) return (
    <DrawerNotice tone={deletionState.status === 'failed' ? 'error' : 'info'} role="status" title="Media deletion">
      {deletionState.status === 'failed'
        ? `Media deletion cleanup needs attention: ${deletionState.message ?? 'Retry the remaining storage objects.'}`
        : `Deleting media safely (${deletionState.completedPaths.length}/${deletionState.storagePaths.length} objects)…`}
      {deletionState.status === 'failed' && (
        <> <IconChipButton className="vz-media-status-action" onClick={() => { void retryDeletion(deletionState.itemId) }}>Retry</IconChipButton></>
      )}
    </DrawerNotice>
  )

  if (deleteError) return (
    <DrawerNotice tone="error" role="alert" title="Delete failed" onDismiss={clearDeleteError}>
      Delete failed: {deleteError}
    </DrawerNotice>
  )

  if (includeAudio && audioError) return (
    <DrawerNotice tone="error" role="alert" title="Audio library error" onDismiss={clearAudioError}>
      {audioError}
    </DrawerNotice>
  )

  if (loadError) return (
    <DrawerNotice tone="error" role="alert" title="Media library error" onDismiss={clearLoadError}>
      {loadError}
    </DrawerNotice>
  )

  if (authRequired) return (
    <DrawerNotice tone="info" role="status" title="Cloud sync unavailable">
      Sign in to sync media to cloud
    </DrawerNotice>
  )

  return null
}
