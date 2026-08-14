import { selectPerformanceDeterministicIndex, type SharedPerformanceContext } from '../../../../features/performanceCore'
import type { CanvasMediaItem } from '../ReactTypes'
import {
  MAX_CANVAS_AUTHORED_LAYERS,
  type CanvasAuthoredLayer,
  type CanvasOrchestrationSettings,
  type CanvasPoolAutomationTrigger,
} from './CanvasPerformanceTypes'

export interface CanvasPoolAutomationRuntimeState {
  scopeIdentity: string | null
  lastEventToken: string | null
  automaticMediaIds: string[]
}

export interface CanvasPoolAutomationResolution {
  state: CanvasPoolAutomationRuntimeState
  automaticLayers: CanvasAuthoredLayer[]
  advanced: boolean
  diagnostics: string[]
}

export const EMPTY_CANVAS_POOL_AUTOMATION_RUNTIME_STATE: CanvasPoolAutomationRuntimeState = Object.freeze({
  scopeIdentity: null,
  lastEventToken: null,
  automaticMediaIds: [],
})

function activePoolMediaIds(settings: CanvasOrchestrationSettings, mediaItems: readonly CanvasMediaItem[]): string[] {
  const activePool = settings.activeMediaPoolId
    ? settings.mediaPools.find(pool => pool.id === settings.activeMediaPoolId) ?? null
    : null
  if (!activePool) return []
  const availableIds = new Set(mediaItems.map(item => item.id))
  return activePool.mediaIds.filter(id => availableIds.has(id))
}

function automationScopeIdentity(context: SharedPerformanceContext, settings: CanvasOrchestrationSettings): string {
  const authoredIdentity = settings.authoredLayers
    .map(layer => `${layer.id}:${layer.order}:${layer.enabled ? 1 : 0}:${layer.pinned ? 1 : 0}`)
    .join('|')
  return [
    context.trackIdentity ?? 'track:none',
    context.analysisIdentity ?? 'analysis:none',
    context.timelineRevision,
    context.trackChangeIdentity,
    settings.activeMediaPoolId ?? 'pool:none',
    settings.poolRevision,
    authoredIdentity,
  ].join('::')
}

function supportsTrigger(context: SharedPerformanceContext, trigger: CanvasPoolAutomationTrigger): boolean {
  if (trigger === 'trackSections') return context.intelligence.supports('section')
  if (trigger === 'kickHit') return context.intelligence.supports('kickHit')
  if (trigger === 'snareHit') return context.intelligence.supports('snareHit')
  return context.intelligence.supports('beat')
}

function currentSelectionToken(context: SharedPerformanceContext, trigger: CanvasPoolAutomationTrigger): string {
  switch (trigger) {
    case 'beat': return `beat:${Math.max(0, context.beatIndex)}`
    case '4bars': return `4bars:${Math.max(0, Math.floor(context.barIndex / 4))}`
    case '6bars': return `6bars:${Math.max(0, Math.floor(context.barIndex / 6))}`
    case '8bars': return `8bars:${Math.max(0, Math.floor(context.barIndex / 8))}`
    case '16bars': return `16bars:${Math.max(0, Math.floor(context.barIndex / 16))}`
    case 'trackSections': return `section:${context.sectionId ?? 'none'}`
    case 'kickHit': return `kick-anchor:${Math.max(0, context.beatIndex)}`
    case 'snareHit': return `snare-anchor:${Math.max(0, context.beatIndex)}`
  }
}

export function resolveCanvasPoolAutomationTriggerToken(
  context: SharedPerformanceContext,
  trigger: CanvasPoolAutomationTrigger,
): string | null {
  if (!supportsTrigger(context, trigger) || context.boundaries.timingDiscontinuity) return null

  switch (trigger) {
    case 'beat':
      return context.boundaries.beatBoundary ? `beat:${context.beatIndex}` : null
    case '4bars':
      return context.boundaries.fourBarBoundary ? `4bars:${Math.floor(context.barIndex / 4)}` : null
    case '6bars': {
      const currentBar = Math.floor(context.barIndex)
      return context.boundaries.barBoundary && currentBar > 0 && currentBar % 6 === 0
        ? `6bars:${Math.floor(currentBar / 6)}`
        : null
    }
    case '8bars':
      return context.boundaries.eightBarBoundary ? `8bars:${Math.floor(context.barIndex / 8)}` : null
    case '16bars':
      return context.boundaries.sixteenBarBoundary ? `16bars:${Math.floor(context.barIndex / 16)}` : null
    case 'trackSections':
      return context.boundaries.sectionEntry && context.sectionId
        ? `section:${context.sectionId}`
        : null
    case 'kickHit':
      return context.kick
        ? `kick:${context.intelligence.frame.frameId}:${context.beatIndex}`
        : null
    case 'snareHit':
      return context.snare
        ? `snare:${context.intelligence.frame.frameId}:${context.beatIndex}`
        : null
  }
}

function selectAutomaticMediaIds(
  poolMediaIds: readonly string[],
  capacity: number,
  scopeIdentity: string,
  selectionToken: string,
): string[] {
  if (poolMediaIds.length === 0 || capacity <= 0) return []
  return Array.from({ length: capacity }, (_, slotIndex) => {
    const index = selectPerformanceDeterministicIndex(
      poolMediaIds.length,
      scopeIdentity,
      selectionToken,
      slotIndex,
      'canvas-pool-automation-slot',
    )
    return poolMediaIds[index] ?? poolMediaIds[0]
  })
}

function automaticLayers(mediaIds: readonly string[]): CanvasAuthoredLayer[] {
  return mediaIds.map((mediaId, index) => ({
    id: `canvas-pool-auto-slot-${index + 1}`,
    mediaId,
    order: index,
    enabled: true,
    solo: false,
    ownership: 'automatic',
    pinned: false,
  }))
}

export function resolveCanvasPoolAutomationRuntime({
  context,
  settings,
  mediaItems,
  previousState = EMPTY_CANVAS_POOL_AUTOMATION_RUNTIME_STATE,
}: {
  context: SharedPerformanceContext
  settings: CanvasOrchestrationSettings
  mediaItems: readonly CanvasMediaItem[]
  previousState?: CanvasPoolAutomationRuntimeState
}): CanvasPoolAutomationResolution {
  const manualCount = Math.min(MAX_CANVAS_AUTHORED_LAYERS, settings.authoredLayers.length)
  const capacity = Math.max(0, MAX_CANVAS_AUTHORED_LAYERS - manualCount)
  const poolMediaIds = activePoolMediaIds(settings, mediaItems)
  const scopeIdentity = automationScopeIdentity(context, settings)
  const scopeChanged = previousState.scopeIdentity !== scopeIdentity
  const transportReset = context.seekDetected || context.loopWrapDetected || context.trackReplacementDetected || context.boundaries.timingDiscontinuity
  const diagnostics: string[] = []

  if (!settings.poolAutomationEnabled) {
    return {
      state: { scopeIdentity, lastEventToken: null, automaticMediaIds: [] },
      automaticLayers: [],
      advanced: false,
      diagnostics,
    }
  }
  if (!settings.activeMediaPoolId) diagnostics.push('pool-automation-no-active-pool')
  if (settings.activeMediaPoolId && poolMediaIds.length === 0) diagnostics.push('pool-automation-empty-active-pool')
  if (capacity === 0) diagnostics.push('pool-automation-no-free-slots')
  if (!supportsTrigger(context, settings.poolAutomationTrigger)) diagnostics.push(`pool-automation-trigger-unavailable:${settings.poolAutomationTrigger}`)

  if (capacity === 0 || poolMediaIds.length === 0) {
    return {
      state: { scopeIdentity, lastEventToken: null, automaticMediaIds: [] },
      automaticLayers: [],
      advanced: false,
      diagnostics,
    }
  }

  if (scopeChanged || transportReset || previousState.automaticMediaIds.length !== capacity) {
    const mediaIds = selectAutomaticMediaIds(
      poolMediaIds,
      capacity,
      scopeIdentity,
      currentSelectionToken(context, settings.poolAutomationTrigger),
    )
    return {
      state: { scopeIdentity, lastEventToken: null, automaticMediaIds: mediaIds },
      automaticLayers: automaticLayers(mediaIds),
      advanced: false,
      diagnostics: transportReset ? [...diagnostics, 'pool-automation-trigger-reset'] : diagnostics,
    }
  }

  const eventToken = resolveCanvasPoolAutomationTriggerToken(context, settings.poolAutomationTrigger)
  if (!eventToken || eventToken === previousState.lastEventToken) {
    return {
      state: { ...previousState, scopeIdentity },
      automaticLayers: automaticLayers(previousState.automaticMediaIds),
      advanced: false,
      diagnostics,
    }
  }

  const mediaIds = selectAutomaticMediaIds(poolMediaIds, capacity, scopeIdentity, eventToken)
  return {
    state: { scopeIdentity, lastEventToken: eventToken, automaticMediaIds: mediaIds },
    automaticLayers: automaticLayers(mediaIds),
    advanced: true,
    diagnostics: [...diagnostics, `pool-automation-advance:${eventToken}`],
  }
}

export function getCanvasPoolAutomationPreloadCandidates(
  settings: CanvasOrchestrationSettings,
  mediaItems: readonly CanvasMediaItem[],
  activeMediaIds: readonly string[],
): string[] {
  if (!settings.poolAutomationEnabled) return []
  const active = new Set(activeMediaIds)
  return activePoolMediaIds(settings, mediaItems).filter(id => !active.has(id)).slice(0, MAX_CANVAS_AUTHORED_LAYERS)
}
