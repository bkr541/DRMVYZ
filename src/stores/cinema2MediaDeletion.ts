import type { MediaDeletionGuard } from './mediaStore'
import { useReactStore } from './reactStore'
import { removeCinema2MediaReferences } from '../components/vyzualz/cinema2/runtime/Cinema2WorkspacePersistence'

const listeners = new Set<(mediaId: string) => void>()
export function subscribeCinema2MediaDeletion(listener: (mediaId: string) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Commit only after canonical deletion succeeds. A failed cloud deletion must
 * not erase an authored assignment; library paging is not deletion evidence. */
export const cinema2MediaDeletionGuard: MediaDeletionGuard = item => ({
  allowed: true,
  commit: () => {
    for (const listener of listeners) listener(item.id)
    useReactStore.setState(state => {
      const workspace = removeCinema2MediaReferences(state.cinema2Workspace, item.id)
      return workspace === state.cinema2Workspace ? state : { cinema2Workspace: workspace }
    })
  },
})
