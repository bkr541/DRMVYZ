import { useMediaStore } from '../../../stores/mediaStore'
import { useReactStore } from '../../../stores/reactStore'
import type { Cinema2MediaPoolSource } from '../cinema2/media/Cinema2MediaPoolSource'
import { cinema2MediaSourceFromLibraryItem, getCinema2MediaDisabledReason } from './Cinema2MediaSourcePanel'

const ACCEPTS = ['image', 'video', 'svg'] as const

/** The same named pool and activation state used by CANVAS and Media Manager.
 * Signing occurs only for selected feeds, not for every cabinet or frame. */
export function createCinema2WorkspaceMediaPoolSource(): Cinema2MediaPoolSource {
  let previousPool: unknown
  let previousItems: unknown
  let cached: ReturnType<Cinema2MediaPoolSource['getSelection']> = null
  return {
    getSelection() {
      const { mediaPools, activeMediaPoolId } = useReactStore.getState().canvasOrchestrationSettings
      const pool = mediaPools.find(candidate => candidate.id === activeMediaPoolId)
      const items = useMediaStore.getState().items
      if (pool === previousPool && items === previousItems) return cached
      previousPool = pool; previousItems = items
      if (!pool) return (cached = null)
      const byId = new Map(items.map(item => [item.id, item]))
      return (cached = { id: pool.id, mediaIds: pool.mediaIds.filter(id => {
        const item = byId.get(id)
        // A stored asset may not have its signed URL yet. Resolve it on demand.
        return !!item && !item.uploading && item.lifecycleStatus !== 'deletion_pending'
          && (item.type === 'image' || item.type === 'video')
      }) })
    },
    async resolve(mediaId) {
      await useMediaStore.getState().ensureMediaSigned([mediaId], 'visible')
      const item = useMediaStore.getState().items.find(candidate => candidate.id === mediaId)
      return item && !getCinema2MediaDisabledReason(item, ACCEPTS) ? cinema2MediaSourceFromLibraryItem(item) : null
    },
  }
}
