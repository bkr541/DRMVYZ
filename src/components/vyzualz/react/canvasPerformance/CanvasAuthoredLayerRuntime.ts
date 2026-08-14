import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import type { CanvasFitMode, CanvasMediaItem } from '../ReactTypes'
import { getCanvasCompositionTemplate } from './CanvasCompositionTemplates'
import { resolveCanvasPlayback } from './CanvasPlayback'
import {
  MAX_CANVAS_ACTIVE_VIDEO_DECODERS,
  MAX_CANVAS_AUTHORED_LAYERS,
  MAX_CANVAS_MEDIA_HANDLES,
  type CanvasOrchestrationSettings,
  type CanvasResolvedLayer,
  type CanvasResolvedPerformanceFrame,
} from './CanvasPerformanceTypes'

const FULL_CROP = Object.freeze({ x: 0, y: 0, width: 1, height: 1 })

/**
 * Adapts the canonical authored layer stack into the already-established CANVAS
 * compositor contract. Authored state remains the source of truth; this frame is
 * transient and is rebuilt whenever state, readiness, or performance time changes.
 */
export function resolveCanvasAuthoredLayerFrame({
  context,
  settings,
  mediaItems,
  fitMode,
  isMediaReady,
}: {
  context: SharedPerformanceContext
  settings: Pick<CanvasOrchestrationSettings, 'authoredLayers' | 'programId'>
  mediaItems: readonly CanvasMediaItem[]
  fitMode: CanvasFitMode
  isMediaReady?: (mediaId: string) => boolean
}): CanvasResolvedPerformanceFrame {
  const mediaById = new Map(mediaItems.map(item => [item.id, item]))
  const authoredLayers = [...settings.authoredLayers]
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .slice(0, MAX_CANVAS_AUTHORED_LAYERS)
  const soloLayer = authoredLayers.find(layer => layer.solo && layer.enabled) ?? null
  const activeVideoIds = new Set<string>()
  const diagnostics: string[] = []

  const layers: CanvasResolvedLayer[] = authoredLayers.map((authored, index) => {
    const source = mediaById.get(authored.mediaId) ?? null
    let enabled = authored.enabled && (!soloLayer || soloLayer.id === authored.id) && source != null

    if (enabled && source?.type === 'video' && !activeVideoIds.has(source.id)) {
      if (activeVideoIds.size >= MAX_CANVAS_ACTIVE_VIDEO_DECODERS) {
        enabled = false
        diagnostics.push(`video-decoder-limit:${authored.id}`)
      } else {
        activeVideoIds.add(source.id)
      }
    }

    return {
      id: authored.id,
      role: 'hero',
      sourceMediaId: source?.id ?? null,
      source,
      enabled,
      opacity: 1,
      blendMode: 'source-over',
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      crop: FULL_CROP,
      aspectBehavior: fitMode,
      // CanvasOrchestrationStage paints ascending z-index. Reverse canonical
      // order so row 0 is painted last and is therefore visually topmost.
      zIndex: MAX_CANVAS_AUTHORED_LAYERS - index,
      mirrorX: false,
      mirrorY: false,
      maskSourceMediaId: null,
      maskMode: null,
      // Duplicate authored instances may safely share one decoder/handle. Their
      // stable layer IDs remain independent while source playback stays coherent.
      playback: resolveCanvasPlayback(source, context, 'hero', `canvas-authored-source:${source?.id ?? authored.mediaId}`),
      effectChain: [],
      modulationRoutes: [],
      userLocked: authored.pinned || authored.ownership === 'manual',
    }
  })

  const activeLayers = layers.filter(layer => layer.enabled && layer.sourceMediaId)
  const activeMediaIds = [...new Set(activeLayers.map(layer => layer.sourceMediaId).filter((id): id is string => Boolean(id)))]
  const readyMediaIds = activeMediaIds.filter(id => !isMediaReady || isMediaReady(id))
  const pendingMediaIds = activeMediaIds.filter(id => isMediaReady && !isMediaReady(id))
  if (soloLayer) diagnostics.push(`solo:${soloLayer.id}`)
  if (authoredLayers.some(layer => !mediaById.has(layer.mediaId))) diagnostics.push('missing-authored-media')
  if (authoredLayers.length === 0) diagnostics.push('no-authored-layers')

  const frameIdentity = `canvas-authored|${authoredLayers
    .map(layer => `${layer.id}:${layer.mediaId}:${layer.order}:${layer.enabled ? 1 : 0}:${layer.solo ? 1 : 0}`)
    .join('|')}`

  return {
    programId: settings.programId,
    frameIdentity,
    sceneId: 'canvas-authored-layers',
    showLabel: 'Manual Layers',
    context,
    template: getCanvasCompositionTemplate('fullScreenHero'),
    layers,
    transition: null,
    effectRecipeId: 'none',
    fallbackUsed: false,
    readyMediaIds,
    pendingMediaIds,
    decoderCount: activeVideoIds.size,
    textureHandleCount: Math.min(MAX_CANVAS_MEDIA_HANDLES, activeMediaIds.length),
    feedbackPasses: 0,
    orchestrationActive: activeLayers.length > 0,
    nextSectionType: null,
    anticipatoryStage: 'none',
    diagnostics,
    runtimeMode: 'authored',
  }
}
