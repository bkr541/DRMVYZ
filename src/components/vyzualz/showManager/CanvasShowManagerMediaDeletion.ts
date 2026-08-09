import type { MediaDeletionGuard, MediaDeletionWarning } from '../../../stores/mediaStore'
import { findCanvasShowManagerMediaReferences, type CanvasShowManagerShow } from './CanvasShowManagerDomain'

interface CanvasShowManagerMediaDeletionState {
  canvasShowManagerShows: CanvasShowManagerShow[]
}

/**
 * Stage 2 establishes safe refusal. A later deletion UX may offer an explicit,
 * undoable reference-removal transaction; until then canonical media cannot be
 * deleted while any persisted Canvas Show element references it.
 */
export function createCanvasShowManagerMediaDeletionGuard(
  getState: () => CanvasShowManagerMediaDeletionState,
): MediaDeletionGuard {
  return item => {
    const references = findCanvasShowManagerMediaReferences(getState().canvasShowManagerShows, item.id)
    if (references.length === 0) return { allowed: true }
    const names = references.map(reference => reference.showName).join(', ')
    const warning: MediaDeletionWarning = {
      itemId: item.id,
      affectedDecks: references.map(reference => ({
        id: reference.showId,
        name: reference.showName,
        remainingItemCount: reference.elementIds.length,
      })),
      action: 'confirm-reference-removal',
      message: `This media is referenced by ${references.length} Canvas Show${references.length === 1 ? '' : 's'} (${names}). Remove those Show elements before deleting the shared media.`,
      confirmationCopy: 'Canvas Show references must be removed before this media can be deleted.',
    }
    return { allowed: false, warning }
  }
}
