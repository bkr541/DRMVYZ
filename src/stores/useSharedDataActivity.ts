import { useAudioStore } from './audioStore'
import { useMediaStore } from './mediaStore'
import { usePageActivities } from './pageActivityStore'
import type { AppPageId } from './pageActivityStore'
import { useReactPersistenceStatusStore } from './reactPersistenceStatusStore'

export type SharedActivitySource = 'media' | 'audio' | 'persistence'

/**
 * Feeds a page's header spinner from the shared stores it actually uses: the media library
 * (fetches, uploads, pending edits), the saved-track library, and the React project's autosave.
 * Each page lists only its own sources so, e.g., a background media fetch never spins the
 * Lyric Manager's header.
 */
export function useSharedDataActivity(page: AppPageId, sources: readonly SharedActivitySource[]): void {
  const media = sources.includes('media')
  const audio = sources.includes('audio')
  const persistence = sources.includes('persistence')

  // A status indicator must never be able to take a page down, so every read tolerates a store that
  // is partially populated (early startup, or a test double) and coerces to a plain boolean.
  const libraryLoading = useMediaStore(state => media && Boolean(state.loading || state.refreshing || state.nextPageLoading || state.collectionsLoading))
  const uploading = useMediaStore(state => media && (state.items ?? []).some(item => item.uploading))
  const savingEdits = useMediaStore(state => media && Object.values(state.mutationStates ?? {}).some(entry => entry.status === 'pending'))
  const tracksLoading = useAudioStore(state => audio && Boolean(state.loading))
  const projectSaving = useReactPersistenceStatusStore(state => persistence && state.phase === 'saving')

  usePageActivities(page, 'shared', {
    'media-library': libraryLoading && 'Loading media',
    'media-upload': uploading && 'Uploading media',
    'media-edits': savingEdits && 'Saving media changes',
    'audio-library': tracksLoading && 'Loading tracks',
    'project-save': projectSaving && 'Saving project',
  })
}
