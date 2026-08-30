import { generateCanvasFracturesPlan } from './CanvasFracturesPlan'
import { resolveCanvasFracturesTimeline, resolveCanvasFracturesPreviousTimeline } from './CanvasFracturesTimeline'
import { evaluateCanvasFracturesTransition, resolveCanvasFracturesTransitionDuration } from './CanvasFracturesTransition'
import type {
  CanvasFracturesPlan,
  CanvasFracturesPlanInput,
  CanvasFracturesRuntimeFrameInput,
  CanvasFracturesStructuralIdentityFrame,
  CanvasFracturesTimelinePoint,
} from './CanvasFracturesTypes'

function finitePosition(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export function deriveCanvasFracturesPlanIdentityKeys(
  timeline: CanvasFracturesTimelinePoint,
  topologyRevision: number,
  layoutRevision: number,
  structuralIdentity?: CanvasFracturesStructuralIdentityFrame | null,
): { topologyIdentityKey: string; layoutIdentityKey: string } {
  const topologySuffix = structuralIdentity?.topologyIdentity
    ? `|structural:${structuralIdentity.topologyIdentity}`
    : ''
  const layoutSuffix = structuralIdentity?.layoutIdentity
    ? `|structural:${structuralIdentity.layoutIdentity}`
    : ''
  return {
    topologyIdentityKey: `auto-topology:${timeline.topologyBucket}|manual:${Math.max(0, Math.floor(topologyRevision))}${topologySuffix}`,
    layoutIdentityKey: `auto-layout:${timeline.layoutBucket}|manual:${Math.max(0, Math.floor(layoutRevision))}${layoutSuffix}`,
  }
}

function planCacheKey(input: CanvasFracturesPlanInput): string {
  return [
    input.presetId,
    input.sourceIdentity,
    input.mediaType,
    input.mediaRevision ?? 0,
    input.trackIdentity ?? 'none',
    input.topologyIdentityKey ?? input.transportPositionSec ?? 0,
    input.layoutIdentityKey ?? input.transportPositionSec ?? 0,
    input.variationSeed,
    input.topologyRevision,
    input.layoutRevision,
    input.mode,
    input.intensity,
    input.focusProtection,
    input.focusX,
    input.focusY,
    input.composition,
    input.placementMode,
    input.quality,
    input.anchorMode,
    input.returnToAnchor === true ? 1 : 0,
    Object.entries(input.effectRoleWeights ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([role, weight]) => `${role}:${weight}`).join(','),
  ].join('|')
}

function previousManualRevisions(input: CanvasFracturesRuntimeFrameInput) {
  const settings = input.runtimeSettings
  switch (settings.lastManualAction) {
    case 'refracture':
      return {
        topologyRevision: Math.max(0, settings.topologyRevision - 1),
        layoutRevision: Math.max(0, settings.layoutRevision - 1),
        returnToAnchor: false,
      }
    case 'shuffleLayout':
    case 'returnToAnchor':
      return {
        topologyRevision: settings.topologyRevision,
        layoutRevision: Math.max(0, settings.layoutRevision - 1),
        returnToAnchor: false,
      }
    case 'releaseFreeze':
    case 'none':
      return {
        topologyRevision: settings.topologyRevision,
        layoutRevision: settings.layoutRevision,
        returnToAnchor: settings.returnToAnchor,
      }
  }
}

function latestAutomaticBoundary(
  timeline: CanvasFracturesTimelinePoint,
  structuralIdentity?: CanvasFracturesStructuralIdentityFrame | null,
): number {
  const structuralTopologyBoundary = structuralIdentity
    && structuralIdentity.topologyIdentity !== structuralIdentity.previousTopologyIdentity
    && structuralIdentity.topologyBoundarySec <= timeline.positionSec + 1e-6
    ? structuralIdentity.topologyBoundarySec
    : 0
  const structuralLayoutBoundary = structuralIdentity
    && structuralIdentity.layoutIdentity !== structuralIdentity.previousLayoutIdentity
    && structuralIdentity.layoutBoundarySec <= timeline.positionSec + 1e-6
    ? structuralIdentity.layoutBoundarySec
    : 0
  return Math.max(
    timeline.topologyBucket > 0 ? timeline.topologyBoundarySec : 0,
    timeline.layoutBucket > 0 ? timeline.layoutBoundarySec : 0,
    structuralTopologyBoundary,
    structuralLayoutBoundary,
  )
}

function previousStructuralIdentity(
  structuralIdentity: CanvasFracturesStructuralIdentityFrame | null | undefined,
  transitionStartSec: number,
): CanvasFracturesStructuralIdentityFrame | null | undefined {
  if (!structuralIdentity) return structuralIdentity
  const topologyAtBoundary = structuralIdentity.topologyIdentity !== structuralIdentity.previousTopologyIdentity
    && Math.abs(structuralIdentity.topologyBoundarySec - transitionStartSec) <= 1e-4
  const layoutAtBoundary = structuralIdentity.layoutIdentity !== structuralIdentity.previousLayoutIdentity
    && Math.abs(structuralIdentity.layoutBoundarySec - transitionStartSec) <= 1e-4
  if (!topologyAtBoundary && !layoutAtBoundary) return structuralIdentity
  return {
    ...structuralIdentity,
    topologyIdentity: topologyAtBoundary
      ? structuralIdentity.previousTopologyIdentity
      : structuralIdentity.topologyIdentity,
    layoutIdentity: layoutAtBoundary
      ? structuralIdentity.previousLayoutIdentity
      : structuralIdentity.layoutIdentity,
  }
}

export class CanvasFracturesRuntime {
  private readonly planCache = new Map<string, CanvasFracturesPlan>()

  resolveFrame(input: CanvasFracturesRuntimeFrameInput): CanvasFracturesPlan {
    const livePositionSec = finitePosition(input.timelineInput.positionSec)
    const timeline = resolveCanvasFracturesTimeline(input.timelineInput)
    const targetPlan = this.resolvePlan(input, timeline, {
      topologyRevision: input.runtimeSettings.topologyRevision,
      layoutRevision: input.runtimeSettings.layoutRevision,
      returnToAnchor: input.runtimeSettings.returnToAnchor,
    }, input.structuralIdentity)
    const automaticBoundarySec = latestAutomaticBoundary(timeline, input.structuralIdentity)
    const manualBoundarySec = input.runtimeSettings.lastManualAction !== 'none'
      && input.runtimeSettings.manualTransitionPositionSec <= livePositionSec + 1e-6
      ? finitePosition(input.runtimeSettings.manualTransitionPositionSec)
      : -1
    const manualWins = manualBoundarySec >= automaticBoundarySec && manualBoundarySec >= 0
    const transitionStartSec = manualWins ? manualBoundarySec : automaticBoundarySec

    if (transitionStartSec <= 0) return targetPlan

    let previousPlan: CanvasFracturesPlan | null = null
    let transitionSource: NonNullable<CanvasFracturesPlan['transition']>['source'] = 'automatic'

    if (manualWins) {
      const previous = previousManualRevisions(input)
      if (input.runtimeSettings.lastManualAction === 'releaseFreeze') {
        const frozenTimelineInput = {
          ...input.timelineInput,
          positionSec: input.runtimeSettings.freezePositionSec,
          freezeLayout: true,
          freezePositionSec: input.runtimeSettings.freezePositionSec,
        }
        const frozenTimeline = resolveCanvasFracturesTimeline(frozenTimelineInput)
        previousPlan = this.resolveAutomaticFrame(
          { ...input, timelineInput: frozenTimelineInput },
          frozenTimeline,
          previous,
          input.runtimeSettings.freezePositionSec,
        )
        transitionSource = 'freezeRelease'
      } else {
        const manualTimelineInput = {
          ...input.timelineInput,
          positionSec: manualBoundarySec,
        }
        const manualTimeline = resolveCanvasFracturesTimeline(manualTimelineInput)
        previousPlan = this.resolveAutomaticFrame(
          { ...input, timelineInput: manualTimelineInput },
          manualTimeline,
          previous,
          manualBoundarySec,
        )
        transitionSource = 'manual'
      }
    } else {
      const previousTimeline = resolveCanvasFracturesPreviousTimeline(input.timelineInput, transitionStartSec)
      previousPlan = this.resolvePlan(input, previousTimeline, {
        topologyRevision: input.runtimeSettings.topologyRevision,
        layoutRevision: input.runtimeSettings.layoutRevision,
        returnToAnchor: input.runtimeSettings.returnToAnchor,
      }, previousStructuralIdentity(input.structuralIdentity, transitionStartSec))
    }

    if (previousPlan.id === targetPlan.id) return targetPlan

    const progressPositionSec = input.runtimeSettings.freezeLayout && transitionSource === 'automatic'
      ? finitePosition(input.runtimeSettings.freezePositionSec)
      : livePositionSec
    const forceComplete = transitionSource !== 'automatic' && (input.isPaused || !input.isPlaying)
    return evaluateCanvasFracturesTransition({
      previousPlan,
      targetPlan,
      transitionIdentity: [
        previousPlan.layoutIdentity,
        targetPlan.layoutIdentity,
        transitionStartSec,
        input.runtimeSettings.transitionMode,
      ].join('|'),
      mode: input.runtimeSettings.transitionMode,
      source: transitionSource,
      startSec: transitionStartSec,
      positionSec: progressPositionSec,
      transitionSpeed: input.runtimeSettings.transitionSpeed,
      bpmSync: input.runtimeSettings.bpmSync,
      bpm: input.runtimeSettings.bpm,
      staggerAmount: input.runtimeSettings.staggerAmount,
      zoomAmount: input.runtimeSettings.zoomAmount,
      forceComplete,
    })
  }

  getTransitionEndSec(input: CanvasFracturesRuntimeFrameInput): number {
    const timeline = resolveCanvasFracturesTimeline(input.timelineInput)
    const automatic = latestAutomaticBoundary(timeline, input.structuralIdentity)
    const manual = input.runtimeSettings.lastManualAction !== 'none'
      ? finitePosition(input.runtimeSettings.manualTransitionPositionSec)
      : 0
    return Math.max(automatic, manual) + resolveCanvasFracturesTransitionDuration(
      input.runtimeSettings.transitionMode,
      input.runtimeSettings.transitionSpeed,
      { bpmSync: input.runtimeSettings.bpmSync, bpm: input.runtimeSettings.bpm },
    )
  }

  private resolveAutomaticFrame(
    input: CanvasFracturesRuntimeFrameInput,
    timeline: CanvasFracturesTimelinePoint,
    revisions: { topologyRevision: number; layoutRevision: number; returnToAnchor: boolean },
    positionSec: number,
  ): CanvasFracturesPlan {
    const targetPlan = this.resolvePlan(input, timeline, revisions)
    const transitionStartSec = latestAutomaticBoundary(timeline, input.structuralIdentity)
    if (transitionStartSec <= 0) return targetPlan
    const previousTimeline = resolveCanvasFracturesPreviousTimeline(input.timelineInput, transitionStartSec)
    const previousPlan = this.resolvePlan(
      input,
      previousTimeline,
      revisions,
      previousStructuralIdentity(input.structuralIdentity, transitionStartSec),
    )
    if (previousPlan.id === targetPlan.id) return targetPlan
    const progressPositionSec = input.timelineInput.freezeLayout
      ? finitePosition(input.timelineInput.freezePositionSec)
      : finitePosition(positionSec)
    return evaluateCanvasFracturesTransition({
      previousPlan,
      targetPlan,
      transitionIdentity: [
        previousPlan.layoutIdentity,
        targetPlan.layoutIdentity,
        transitionStartSec,
        input.runtimeSettings.transitionMode,
      ].join('|'),
      mode: input.runtimeSettings.transitionMode,
      source: 'automatic',
      startSec: transitionStartSec,
      positionSec: progressPositionSec,
      transitionSpeed: input.runtimeSettings.transitionSpeed,
      bpmSync: input.runtimeSettings.bpmSync,
      bpm: input.runtimeSettings.bpm,
      staggerAmount: input.runtimeSettings.staggerAmount,
      zoomAmount: input.runtimeSettings.zoomAmount,
    })
  }

  clear(): void {
    this.planCache.clear()
  }

  private resolvePlan(
    input: CanvasFracturesRuntimeFrameInput,
    timeline: CanvasFracturesTimelinePoint,
    revisions: { topologyRevision: number; layoutRevision: number; returnToAnchor: boolean },
    structuralIdentity: CanvasFracturesStructuralIdentityFrame | null | undefined = input.structuralIdentity,
  ): CanvasFracturesPlan {
    const keys = deriveCanvasFracturesPlanIdentityKeys(
      timeline,
      revisions.topologyRevision,
      revisions.layoutRevision,
      structuralIdentity,
    )
    const planInput: CanvasFracturesPlanInput = {
      ...input.planInput,
      topologyIdentityKey: keys.topologyIdentityKey,
      layoutIdentityKey: keys.layoutIdentityKey,
      topologyRevision: revisions.topologyRevision,
      layoutRevision: revisions.layoutRevision,
      returnToAnchor: revisions.returnToAnchor,
    }
    const key = planCacheKey(planInput)
    const cached = this.planCache.get(key)
    if (cached) return cached
    const plan = generateCanvasFracturesPlan(planInput)
    this.planCache.set(key, plan)
    if (this.planCache.size > 12) {
      const first = this.planCache.keys().next().value as string | undefined
      if (first) this.planCache.delete(first)
    }
    return plan
  }
}
