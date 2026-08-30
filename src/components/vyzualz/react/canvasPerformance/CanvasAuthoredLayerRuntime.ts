import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import type { CanvasFitMode, CanvasMediaItem } from '../ReactTypes'
import { resolveCanvasAuthoredLayerLayout } from './CanvasAuthoredLayerLayout'
import { resolveCanvasEffectiveAuthoredLayers } from './CanvasAuthoringState'
import { getCanvasCompositionTemplate } from './CanvasCompositionTemplates'
import { resolveCanvasPlayback } from './CanvasPlayback'
import { resolveCanvasExplicitTransition } from './CanvasTransitions'
import {
  MAX_CANVAS_ACTIVE_VIDEO_DECODERS,
  MAX_CANVAS_AUTHORED_LAYERS,
  MAX_CANVAS_MEDIA_HANDLES,
  type CanvasAuthoredLayer,
  type CanvasOrchestrationSettings,
  type CanvasResolvedLayer,
  type CanvasTransitionId,
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
  getMediaError,
  automaticLayers = [],
  previousFrame = null,
  automationAdvanced = false,
  automationTransitionId = null,
  automationDiagnostics = [],
}: {
  context: SharedPerformanceContext
  settings: Pick<CanvasOrchestrationSettings, 'authoredLayers' | 'programId'>
  mediaItems: readonly CanvasMediaItem[]
  fitMode: CanvasFitMode
  isMediaReady?: (mediaId: string) => boolean
  getMediaError?: (mediaId: string) => string | null
  automaticLayers?: readonly CanvasAuthoredLayer[]
  previousFrame?: CanvasResolvedPerformanceFrame | null
  automationAdvanced?: boolean
  automationTransitionId?: CanvasTransitionId | null
  automationDiagnostics?: readonly string[]
}): CanvasResolvedPerformanceFrame {
  const mediaById = new Map(mediaItems.map(item => [item.id, item]))
  const manualLayers = [...settings.authoredLayers]
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
  const authoredLayers = [
    ...manualLayers,
    ...automaticLayers.map((layer, index) => ({ ...layer, order: manualLayers.length + index })),
  ]
  const effectiveLayers = resolveCanvasEffectiveAuthoredLayers(authoredLayers)
  const soloLayer = effectiveLayers.find(layer => layer.solo) ?? null
  const activeVideoIds = new Set<string>()
  const diagnostics: string[] = [...automationDiagnostics]
  let activeLayerCount = 0
  const renderableLayers = effectiveLayers.map(authored => {
    const source = mediaById.get(authored.mediaId) ?? null
    let enabled = source != null && activeLayerCount < MAX_CANVAS_AUTHORED_LAYERS

    if (enabled && source?.type === 'video' && !activeVideoIds.has(source.id)) {
      if (activeVideoIds.size >= MAX_CANVAS_ACTIVE_VIDEO_DECODERS) {
        enabled = false
        diagnostics.push(`video-decoder-limit:${authored.id}`)
      } else {
        activeVideoIds.add(source.id)
      }
    }
    if (enabled) activeLayerCount += 1

    return { authored, source, enabled }
  })
  const visibleLayerIds = renderableLayers
    .filter(candidate => candidate.enabled && candidate.source)
    .map(candidate => candidate.authored.id)
  const visibleLayerIndex = new Map(visibleLayerIds.map((id, index) => [id, index]))
  const visibleLayerCount = visibleLayerIds.length

  const layers: CanvasResolvedLayer[] = renderableLayers.map(({ authored, source, enabled }, index) => {
    const layoutIndex = visibleLayerIndex.get(authored.id)
    const layout = layoutIndex == null
      ? null
      : resolveCanvasAuthoredLayerLayout(visibleLayerCount, layoutIndex)

    return {
      id: authored.id,
      role: 'hero',
      sourceMediaId: source?.id ?? null,
      source,
      enabled,
      opacity: 1,
      blendMode: 'source-over',
      x: layout?.x ?? 0,
      y: layout?.y ?? 0,
      scaleX: layout?.scaleX ?? 1,
      scaleY: layout?.scaleY ?? 1,
      fitWithinTransformBounds: Boolean(layout && visibleLayerCount > 1),
      rotation: 0,
      crop: FULL_CROP,
      // Multi-layer authored layouts use contain so every source remains
      // proportionally intact inside its deterministic slot. A single layer
      // keeps the user's existing Canvas fit behavior unchanged.
      aspectBehavior: layout && visibleLayerCount > 1 ? 'contain' : fitMode,
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
      userEffects: authored.effects,
      modulationRoutes: [],
      userLocked: authored.pinned || authored.ownership === 'manual',
    }
  })

  const activeLayers = layers.filter(layer => layer.enabled && layer.sourceMediaId)
  const activeMediaIds = [...new Set(activeLayers.map(layer => layer.sourceMediaId).filter((id): id is string => Boolean(id)))]
  const mediaErrors = activeMediaIds.flatMap(mediaId => {
    const message = getMediaError?.(mediaId) ?? null
    return message ? [{ mediaId, message }] : []
  })
  const failedMediaIds = new Set(mediaErrors.map(item => item.mediaId))
  const readyMediaIds = activeMediaIds.filter(id => !isMediaReady || isMediaReady(id))
  const pendingMediaIds = activeMediaIds.filter(id => isMediaReady && !isMediaReady(id) && !failedMediaIds.has(id))
  mediaErrors.forEach(({ mediaId, message }) => diagnostics.push(`media-load-error:${mediaId}:${message}`))
  if (soloLayer) diagnostics.push(`solo:${soloLayer.id}`)
  if (effectiveLayers.some(layer => !mediaById.has(layer.mediaId))) diagnostics.push('missing-authored-media')
  if (effectiveLayers.length === 0) diagnostics.push('no-authored-layers')

  const frameIdentity = `canvas-authored|${effectiveLayers
    .map(layer => `${layer.id}:${layer.mediaId}:${layer.order}:${layer.enabled ? 1 : 0}:${layer.solo ? 1 : 0}:${layer.ownership}:${layer.effects.join(',')}`)
    .join('|')}`
  const transition = automationTransitionId
    ? resolveCanvasExplicitTransition({
        context,
        id: automationTransitionId,
        previous: previousFrame?.transition,
        fromFrameIdentity: previousFrame?.frameIdentity ?? null,
        toFrameIdentity: frameIdentity,
        start: automationAdvanced,
      })
    : null

  return {
    programId: settings.programId,
    frameIdentity,
    sceneId: 'canvas-authored-layers',
    showLabel: automaticLayers.length > 0 ? 'Hybrid Pool Layers' : 'Manual Layers',
    context,
    template: getCanvasCompositionTemplate('fullScreenHero'),
    layers,
    transition,
    transitionLayerIds: automaticLayers.map(layer => layer.id),
    effectRecipeId: 'none',
    fallbackUsed: false,
    readyMediaIds,
    pendingMediaIds,
    mediaErrors,
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
