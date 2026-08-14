import type { MediaDeletionGuard, MediaDeletionWarning } from '../../../../stores/mediaStore'
import type { CanvasOrchestrationSettings } from './CanvasPerformanceTypes'

interface CanvasAuthoringMediaDeletionState {
  canvasOrchestrationSettings: Pick<CanvasOrchestrationSettings, 'authoredLayers' | 'mediaPools'>
}

export interface CanvasAuthoringMediaReferences {
  layerIds: string[]
  pools: Array<{ id: string; name: string }>
}

export function findCanvasAuthoringMediaReferences(
  state: CanvasAuthoringMediaDeletionState,
  mediaId: string,
): CanvasAuthoringMediaReferences {
  const layerIds = state.canvasOrchestrationSettings.authoredLayers
    .filter(layer => layer.mediaId === mediaId)
    .map(layer => layer.id)
  const pools = state.canvasOrchestrationSettings.mediaPools
    .filter(pool => pool.mediaIds.includes(mediaId))
    .map(pool => ({ id: pool.id, name: pool.name }))
  return { layerIds, pools }
}

/**
 * CANVAS authoring state is persisted project data. Follow the existing Canvas
 * Show Manager deletion contract and refuse shared-media deletion until authored
 * layer/pool references are explicitly removed instead of silently mutating them.
 */
export function createCanvasAuthoringMediaDeletionGuard(
  getState: () => CanvasAuthoringMediaDeletionState,
): MediaDeletionGuard {
  return item => {
    const references = findCanvasAuthoringMediaReferences(getState(), item.id)
    if (references.layerIds.length === 0 && references.pools.length === 0) return { allowed: true }

    const layerCopy = references.layerIds.length === 1 ? '1 CANVAS layer' : `${references.layerIds.length} CANVAS layers`
    const poolCopy = references.pools.length === 1 ? '1 Media Pool' : `${references.pools.length} Media Pools`
    const parts = [
      references.layerIds.length > 0 ? layerCopy : null,
      references.pools.length > 0 ? poolCopy : null,
    ].filter((part): part is string => Boolean(part))
    const warning: MediaDeletionWarning = {
      itemId: item.id,
      affectedDecks: [
        ...(references.layerIds.length > 0 ? [{
          id: 'canvas-authored-layers',
          name: 'CANVAS Layers',
          remainingItemCount: references.layerIds.length,
        }] : []),
        ...references.pools.map(pool => ({
          id: pool.id,
          name: `CANVAS Pool: ${pool.name}`,
          remainingItemCount: 1,
        })),
      ],
      action: 'confirm-reference-removal',
      message: `This media is referenced by ${parts.join(' and ')}. Remove those CANVAS authoring references before deleting the shared media.`,
      confirmationCopy: 'CANVAS layer and Media Pool references must be removed before this media can be deleted.',
    }
    return { allowed: false, warning }
  }
}
