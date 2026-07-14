import {
  performanceDeterministicUnit,
  selectPerformanceDeterministicIndex,
} from '../../../../features/performanceCore'
import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import { canvasMusicalDurationToSeconds } from './CanvasPlayback'
import type {
  CanvasMusicalDuration,
  CanvasResolvedTransition,
  CanvasTransitionCategory,
  CanvasTransitionId,
  CanvasTransitionInterruptionPolicy,
} from './CanvasPerformanceTypes'

export interface CanvasTransitionDefinition {
  id: CanvasTransitionId
  label: string
  category: CanvasTransitionCategory
  duration: CanvasMusicalDuration
  interruptionPolicy: CanvasTransitionInterruptionPolicy
  fallbackId: CanvasTransitionId
  supportedByCanvas2d: boolean
}

function transition(
  id: CanvasTransitionId,
  label: string,
  category: CanvasTransitionCategory,
  duration: CanvasMusicalDuration,
  fallbackId: CanvasTransitionId = 'crossfade',
  interruptionPolicy: CanvasTransitionInterruptionPolicy = 'replaceAtQuantize',
  supportedByCanvas2d = true,
): CanvasTransitionDefinition {
  return { id, label, category, duration, interruptionPolicy, fallbackId, supportedByCanvas2d }
}

export const CANVAS_TRANSITIONS: Readonly<Record<CanvasTransitionId, CanvasTransitionDefinition>> = {
  hardCut: transition('hardCut', 'Hard Cut', 'clean', '1/8beat', 'hardCut', 'resolveImmediately'),
  crossfade: transition('crossfade', 'Crossfade', 'clean', '1beat'),
  dipToBlack: transition('dipToBlack', 'Dip to Black', 'clean', '1beat'),
  dipToWhite: transition('dipToWhite', 'Dip to White', 'clean', '1beat'),
  additiveDissolve: transition('additiveDissolve', 'Additive Dissolve', 'clean', '1beat'),
  lumaDissolve: transition('lumaDissolve', 'Luma Dissolve', 'clean', '2beats'),
  alphaDissolve: transition('alphaDissolve', 'Alpha Dissolve', 'clean', '1beat'),
  push: transition('push', 'Push', 'spatial', '1beat'),
  slide: transition('slide', 'Slide', 'spatial', '1beat'),
  zoomThrough: transition('zoomThrough', 'Zoom Through', 'spatial', '2beats'),
  spin: transition('spin', 'Spin', 'spatial', '1beat'),
  radialWipe: transition('radialWipe', 'Radial Wipe', 'spatial', '2beats'),
  tunnelWipe: transition('tunnelWipe', 'Tunnel Wipe', 'spatial', '2beats'),
  maskExpansion: transition('maskExpansion', 'Mask Expansion', 'spatial', '1beat'),
  shapeReveal: transition('shapeReveal', 'Shape Reveal', 'spatial', '1beat'),
  displacementBurst: transition('displacementBurst', 'Displacement Burst', 'bass', '1/2beat'),
  feedbackSmear: transition('feedbackSmear', 'Feedback Smear', 'bass', '1beat'),
  rgbSplit: transition('rgbSplit', 'RGB Split', 'bass', '1/2beat'),
  frameTear: transition('frameTear', 'Frame Tear', 'bass', '1/4beat'),
  sliceDisplacement: transition('sliceDisplacement', 'Slice Displacement', 'bass', '1/2beat'),
  frameHoldRelease: transition('frameHoldRelease', 'Frame Hold + Release', 'bass', '1beat'),
  strobeCut: transition('strobeCut', 'Strobe Cut', 'bass', '1/4beat'),
}

export const CANVAS_CLEAN_TRANSITIONS: readonly CanvasTransitionId[] = [
  'hardCut', 'crossfade', 'dipToBlack', 'dipToWhite', 'additiveDissolve', 'lumaDissolve', 'alphaDissolve',
]
export const CANVAS_SPATIAL_TRANSITIONS: readonly CanvasTransitionId[] = [
  'push', 'slide', 'zoomThrough', 'spin', 'radialWipe', 'tunnelWipe', 'maskExpansion', 'shapeReveal',
]
export const CANVAS_BASS_TRANSITIONS: readonly CanvasTransitionId[] = [
  'displacementBurst', 'feedbackSmear', 'rgbSplit', 'frameTear', 'sliceDisplacement', 'frameHoldRelease', 'strobeCut',
]

export function resolveCanvasContextualTransitionIds(
  context: SharedPerformanceContext,
  authoredIds: readonly CanvasTransitionId[],
): readonly CanvasTransitionId[] {
  const contextual: readonly CanvasTransitionId[] = context.sectionType === 'preDrop'
    ? ['feedbackSmear', 'maskExpansion', 'frameHoldRelease', 'hardCut']
    : context.sectionType === 'drop'
      ? ['hardCut', 'strobeCut', 'displacementBurst', 'sliceDisplacement', 'rgbSplit', 'zoomThrough', 'lumaDissolve', 'maskExpansion']
      : context.sectionType === 'build'
        ? ['lumaDissolve', 'additiveDissolve', 'push', 'slide', 'zoomThrough', 'maskExpansion', 'feedbackSmear']
        : context.sectionType === 'breakdown' || context.sectionType === 'bridge'
          ? ['lumaDissolve', 'additiveDissolve', 'crossfade', 'feedbackSmear', 'zoomThrough']
          : context.sectionType === 'outro'
            ? ['crossfade', 'lumaDissolve', 'alphaDissolve', 'dipToBlack']
            : ['crossfade', 'lumaDissolve', 'additiveDissolve', 'alphaDissolve', 'slide']
  const approved = authoredIds.filter(id => contextual.includes(id))
  return approved.length > 0 ? approved : contextual
}

function chooseTransitionPool(context: SharedPerformanceContext): readonly CanvasTransitionId[] {
  if (context.sectionType === 'drop' || context.sectionType === 'preDrop') return CANVAS_BASS_TRANSITIONS
  if (context.sectionType === 'build' || context.energy >= 0.68) return CANVAS_SPATIAL_TRANSITIONS
  return CANVAS_CLEAN_TRANSITIONS
}

function shouldStartTransition(context: SharedPerformanceContext, density: number): boolean {
  if (context.seekDetected || context.loopWrapDetected || context.trackReplacementDetected) return false
  if (context.boundaries.sectionEntry || context.boundaries.macroSectionEntry) return true
  if (!context.boundaries.performanceFourBarBoundary) return false
  const chance = Math.max(0, Math.min(1, density)) * 0.45
  return performanceDeterministicUnit(
    context.trackIdentity,
    context.sectionFamily,
    context.sectionOccurrence,
    context.performanceFourBarBlockIndex,
    'canvas-transition-density',
  ) < chance
}

export function resolveCanvasTransitionDefinition(id: CanvasTransitionId): CanvasTransitionDefinition {
  const requested = CANVAS_TRANSITIONS[id] ?? CANVAS_TRANSITIONS.crossfade
  return requested.supportedByCanvas2d ? requested : CANVAS_TRANSITIONS[requested.fallbackId]
}

export function resolveCanvasTransition({
  context,
  density,
  allowedIds,
  previous,
  fromFrameIdentity,
  toFrameIdentity,
}: {
  context: SharedPerformanceContext
  density: number
  allowedIds?: readonly CanvasTransitionId[]
  previous?: CanvasResolvedTransition | null
  fromFrameIdentity?: string | null
  toFrameIdentity: string
}): CanvasResolvedTransition | null {
  if (context.seekDetected || context.loopWrapDetected || context.trackReplacementDetected) return null

  if (previous && !previous.complete) {
    const elapsed = Math.max(0, context.audioTimeSec - previous.startAudioTimeSec)
    const progress = previous.durationSec <= 0 ? 1 : Math.min(1, elapsed / previous.durationSec)
    if (previous.toFrameIdentity === toFrameIdentity || previous.interruptionPolicy === 'finish') {
      return { ...previous, progress, complete: progress >= 1 }
    }
  }

  if (!shouldStartTransition(context, density)) return null
  const candidates = (allowedIds?.length ? allowedIds : chooseTransitionPool(context))
    .map(resolveCanvasTransitionDefinition)
    .filter((definition, index, list) => list.findIndex(item => item.id === definition.id) === index)
  const index = selectPerformanceDeterministicIndex(
    candidates.length,
    context.trackIdentity,
    context.sectionFamily,
    context.sectionOccurrence,
    context.performanceFourBarBlockIndex,
    context.sceneLocalVariationIndex,
    'canvas-transition',
  )
  const definition = candidates[index] ?? CANVAS_TRANSITIONS.crossfade
  const durationSec = Math.max(0.03, canvasMusicalDurationToSeconds(context, definition.duration))
  const deterministicVariation = performanceDeterministicUnit(
    context.trackIdentity,
    context.runtimeIdentity,
    definition.id,
    'canvas-transition-variation',
  )

  return {
    id: definition.id,
    category: definition.category,
    duration: definition.duration,
    startAudioTimeSec: context.audioTimeSec,
    durationSec,
    progress: 0,
    quantized: true,
    deterministicVariation,
    interruptionPolicy: definition.interruptionPolicy,
    fallbackId: definition.fallbackId,
    fromFrameIdentity: fromFrameIdentity ?? null,
    toFrameIdentity,
    complete: false,
  }
}

export interface CanvasTransitionVisualState {
  incomingOpacity: number
  outgoingOpacity: number
  incomingScale: number
  outgoingScale: number
  incomingRotation: number
  outgoingRotation: number
  incomingOffsetX: number
  incomingOffsetY: number
  outgoingOffsetX: number
  outgoingOffsetY: number
  flash: number
  slice: number
  rgbSplit: number
  smear: number
  clipProgress: number
}

export function resolveCanvasTransitionVisualState(transition: CanvasResolvedTransition | null): CanvasTransitionVisualState {
  if (!transition || transition.complete) {
    return {
      incomingOpacity: 1,
      outgoingOpacity: 0,
      incomingScale: 1,
      outgoingScale: 1,
      incomingRotation: 0,
      outgoingRotation: 0,
      incomingOffsetX: 0,
      incomingOffsetY: 0,
      outgoingOffsetX: 0,
      outgoingOffsetY: 0,
      flash: 0,
      slice: 0,
      rgbSplit: 0,
      smear: 0,
      clipProgress: 1,
    }
  }

  const p = Math.max(0, Math.min(1, transition.progress))
  const inv = 1 - p
  const direction = transition.deterministicVariation < 0.5 ? -1 : 1
  const base: CanvasTransitionVisualState = {
    incomingOpacity: p,
    outgoingOpacity: inv,
    incomingScale: 1,
    outgoingScale: 1,
    incomingRotation: 0,
    outgoingRotation: 0,
    incomingOffsetX: 0,
    incomingOffsetY: 0,
    outgoingOffsetX: 0,
    outgoingOffsetY: 0,
    flash: 0,
    slice: 0,
    rgbSplit: 0,
    smear: 0,
    clipProgress: p,
  }

  switch (transition.id) {
    case 'hardCut': return { ...base, incomingOpacity: p >= 0.5 ? 1 : 0, outgoingOpacity: p < 0.5 ? 1 : 0 }
    case 'dipToBlack': return { ...base, incomingOpacity: Math.max(0, (p - 0.5) * 2), outgoingOpacity: Math.max(0, 1 - p * 2) }
    case 'dipToWhite': return { ...base, flash: 1 - Math.abs(p - 0.5) * 2 }
    case 'additiveDissolve': return { ...base, incomingOpacity: Math.min(1, p * 1.35), outgoingOpacity: Math.min(1, inv * 1.35), flash: 0.16 * (1 - Math.abs(p - 0.5) * 2) }
    case 'push':
    case 'slide': return { ...base, incomingOffsetX: direction * inv, outgoingOffsetX: -direction * p }
    case 'zoomThrough': return { ...base, incomingScale: 0.72 + p * 0.28, outgoingScale: 1 + p * 0.8 }
    case 'spin': return { ...base, incomingRotation: direction * inv * 28, outgoingRotation: -direction * p * 28 }
    case 'radialWipe':
    case 'tunnelWipe':
    case 'maskExpansion':
    case 'shapeReveal':
    case 'lumaDissolve':
    case 'alphaDissolve': return { ...base, clipProgress: p }
    case 'displacementBurst': return { ...base, incomingScale: 0.94 + p * 0.06, outgoingScale: 1 + p * 0.18, smear: inv * 0.7 }
    case 'feedbackSmear': return { ...base, smear: Math.sin(p * Math.PI) }
    case 'rgbSplit': return { ...base, rgbSplit: Math.sin(p * Math.PI) }
    case 'frameTear':
    case 'sliceDisplacement': return { ...base, slice: Math.sin(p * Math.PI), incomingOffsetX: direction * inv * 0.08 }
    case 'frameHoldRelease': return { ...base, incomingOpacity: p > 0.72 ? 1 : 0, outgoingOpacity: p <= 0.72 ? 1 : inv }
    case 'strobeCut': return { ...base, incomingOpacity: Math.floor(p * 8) % 2 === 0 ? p : 1, outgoingOpacity: Math.floor(p * 8) % 2 === 0 ? inv : 0, flash: Math.floor(p * 8) % 2 === 0 ? 0.25 : 0 }
    default: return base
  }
}
