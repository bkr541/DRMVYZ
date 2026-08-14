import type { MediaDeletionGuard, MediaDeletionWarning } from '../../../../stores/mediaStore'
import type { CanvasMediaPool, CanvasOrchestrationSettings } from './CanvasPerformanceTypes'

interface CanvasAuthoringMediaDeletionState {
  canvasOrchestrationSettings: Pick<CanvasOrchestrationSettings, 'authoredLayers' | 'mediaPools' | 'activeMediaPoolId'>
  setCanvasOrchestrationSettings?: (patch: Partial<CanvasOrchestrationSettings>) => void
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

function clonePools(pools: readonly CanvasMediaPool[]): CanvasMediaPool[] {
  return pools.map(pool => ({ ...pool, mediaIds: [...pool.mediaIds] }))
}

function removeMediaFromPools(pools: readonly CanvasMediaPool[], mediaId: string): CanvasMediaPool[] {
  return pools.map(pool => pool.mediaIds.includes(mediaId)
    ? { ...pool, mediaIds: pool.mediaIds.filter(candidate => candidate !== mediaId) }
    : pool)
}

function layerReferenceWarning(
  mediaId: string,
  references: CanvasAuthoringMediaReferences,
): MediaDeletionWarning {
  const layerCopy = references.layerIds.length === 1 ? '1 CANVAS layer' : `${references.layerIds.length} CANVAS layers`
  const poolCopy = references.pools.length === 1 ? '1 Media Pool' : `${references.pools.length} Media Pools`
  const parts = [
    references.layerIds.length > 0 ? layerCopy : null,
    references.pools.length > 0 ? poolCopy : null,
  ].filter((part): part is string => Boolean(part))
  return {
    itemId: mediaId,
    affectedDecks: [
      {
        id: 'canvas-authored-layers',
        name: 'CANVAS Layers',
        remainingItemCount: references.layerIds.length,
      },
      ...references.pools.map(pool => ({
        id: pool.id,
        name: `CANVAS Pool: ${pool.name}`,
        remainingItemCount: 1,
      })),
    ],
    action: 'confirm-reference-removal',
    message: `This media is referenced by ${parts.join(' and ')}. Remove its CANVAS layer instances before deleting the shared media. Media Pool memberships are cleaned automatically once layer references are clear.`,
    confirmationCopy: 'CANVAS layer references must be removed before this media can be deleted.',
  }
}

/**
 * Shared-library media cannot disappear while a persisted manual layer still
 * references it. Named Pool memberships are different: they are set-like
 * references that Stage 5 owns, so source deletion removes them transactionally
 * through the canonical orchestration setter and restores them if deletion fails.
 */
export function createCanvasAuthoringMediaDeletionGuard(
  getState: () => CanvasAuthoringMediaDeletionState,
): MediaDeletionGuard {
  return item => {
    const initial = getState()
    const references = findCanvasAuthoringMediaReferences(initial, item.id)
    if (references.layerIds.length > 0) {
      return { allowed: false, warning: layerReferenceWarning(item.id, references) }
    }
    if (references.pools.length === 0) return { allowed: true }
    if (!initial.setCanvasOrchestrationSettings) {
      return {
        allowed: false,
        warning: {
          itemId: item.id,
          affectedDecks: references.pools.map(pool => ({
            id: pool.id,
            name: `CANVAS Pool: ${pool.name}`,
            remainingItemCount: 1,
          })),
          action: 'confirm-reference-removal',
          message: 'This media is referenced by CANVAS Media Pools, but the canonical cleanup action is unavailable.',
          confirmationCopy: 'Remove the CANVAS Media Pool references before deleting this media.',
        },
      }
    }

    let appliedSnapshot: CanvasMediaPool[] | null = null
    return {
      allowed: true,
      apply: () => {
        const state = getState()
        const currentReferences = findCanvasAuthoringMediaReferences(state, item.id)
        if (currentReferences.layerIds.length > 0) return false
        if (currentReferences.pools.length === 0) return true
        if (!state.setCanvasOrchestrationSettings) return false

        appliedSnapshot = clonePools(state.canvasOrchestrationSettings.mediaPools)
        state.setCanvasOrchestrationSettings({
          mediaPools: removeMediaFromPools(state.canvasOrchestrationSettings.mediaPools, item.id),
        })
        return findCanvasAuthoringMediaReferences(getState(), item.id).pools.length === 0
      },
      commit: () => {
        appliedSnapshot = null
      },
      rollback: () => {
        if (!appliedSnapshot) return
        const state = getState()
        state.setCanvasOrchestrationSettings?.({ mediaPools: appliedSnapshot })
        appliedSnapshot = null
      },
    }
  }
}
