import type { SharedPerformanceContext } from '../../../../../features/performanceCore'
import {
  resolveCanvasExplicitTransition,
  resolveCanvasTransitionVisualState,
  type CanvasTransitionVisualState,
} from '../../canvasPerformance/CanvasTransitions'
import { canvasMusicalDurationToSeconds } from '../../canvasPerformance/CanvasPlayback'
import type { CanvasMusicalDuration, CanvasResolvedTransition, CanvasTransitionId } from '../../canvasPerformance/CanvasPerformanceTypes'
import type { CutbankEnergyState } from './CutbankClock'
import { CUTBANK_FALLBACK_BPM } from './CutbankClock'
import { clamp01, cutbankUnit, lerp, shuffleDeterministic, cutbankSeed } from './CutbankRandom'
import type { CanvasCutbankSettings, CanvasCutbankTransitionStyle } from './CutbankSettings'

export type CutbankConcreteTransitionStyle = Exclude<CanvasCutbankTransitionStyle, 'auto'>

/** Extra, CUTBANK-only processing layered on top of an existing Canvas transition. */
export type CutbankWipe = 'none' | 'vertical' | 'horizontalBands' | 'collapse'

export interface CutbankTransitionSpec {
  style: CutbankConcreteTransitionStyle
  /** The reused Canvas transition that supplies timing, opacity, offsets, flash, slice, rgb, smear. */
  canvasId: CanvasTransitionId
  wipe: CutbankWipe
  /** Treatment spikes (0..1 peak) the renderer adds while the transition runs. */
  spikes: Partial<Record<'threshold' | 'noise' | 'exposure' | 'black' | 'white' | 'tear' | 'rgb' | 'smear' | 'zoom', number>>
  /** True for styles whose look depends on flashes / black frames (Flash Amount). */
  usesFlash: boolean
}

/**
 * CUTBANK style → existing CanvasTransitions id. Only Vertical Wipe, Horizontal
 * Slice, and Zoom Collapse add CUTBANK-specific compose processing (`wipe`);
 * every other style is a reused Canvas transition plus treatment spikes.
 */
export const CUTBANK_TRANSITION_MAP: Readonly<Record<CutbankConcreteTransitionStyle, Omit<CutbankTransitionSpec, 'style'>>> = {
  hardCut:           { canvasId: 'hardCut', wipe: 'none', spikes: {}, usesFlash: false },
  blackCut:          { canvasId: 'dipToBlack', wipe: 'none', spikes: { black: 1 }, usesFlash: true },
  whiteFlash:        { canvasId: 'dipToWhite', wipe: 'none', spikes: { white: 1 }, usesFlash: true },
  thresholdDissolve: { canvasId: 'lumaDissolve', wipe: 'none', spikes: { threshold: 1 }, usesFlash: false },
  signalTear:        { canvasId: 'frameTear', wipe: 'none', spikes: { tear: 1 }, usesFlash: false },
  frameShred:        { canvasId: 'sliceDisplacement', wipe: 'none', spikes: { tear: 1, rgb: 0.4 }, usesFlash: false },
  verticalWipe:      { canvasId: 'maskExpansion', wipe: 'vertical', spikes: {}, usesFlash: false },
  horizontalSlice:   { canvasId: 'sliceDisplacement', wipe: 'horizontalBands', spikes: { tear: 0.4 }, usesFlash: false },
  zoomCollapse:      { canvasId: 'zoomThrough', wipe: 'collapse', spikes: { zoom: 1 }, usesFlash: false },
  zoomBurst:         { canvasId: 'zoomThrough', wipe: 'none', spikes: { zoom: 1, white: 0.35 }, usesFlash: true },
  rgbCut:            { canvasId: 'rgbSplit', wipe: 'none', spikes: { rgb: 1 }, usesFlash: false },
  feedbackSmear:     { canvasId: 'feedbackSmear', wipe: 'none', spikes: { smear: 1 }, usesFlash: false },
  noiseDissolve:     { canvasId: 'alphaDissolve', wipe: 'none', spikes: { noise: 1 }, usesFlash: false },
  exposureBurn:      { canvasId: 'additiveDissolve', wipe: 'none', spikes: { exposure: 1 }, usesFlash: true },
}

const AUTO_TIERS: Record<'low' | 'medium' | 'high', readonly CutbankConcreteTransitionStyle[]> = {
  low: ['hardCut', 'thresholdDissolve', 'noiseDissolve', 'blackCut', 'verticalWipe'],
  medium: ['horizontalSlice', 'verticalWipe', 'feedbackSmear', 'rgbCut', 'zoomCollapse', 'whiteFlash', 'exposureBurn', 'thresholdDissolve'],
  high: ['signalTear', 'frameShred', 'zoomBurst', 'whiteFlash', 'rgbCut', 'feedbackSmear', 'hardCut', 'horizontalSlice'],
}

const DURATIONS: readonly CanvasMusicalDuration[] = ['1/8beat', '1/4beat', '1/2beat', '1beat', '2beats']

/**
 * Auto: the eligible vocabulary follows energy (tier) and Chaos (bumps the
 * tier), is trimmed by Transition Variety (a stable, seed-shuffled subset so
 * the "look" stays consistent), and drops flash styles when Flash Amount is 0.
 */
export function resolveCutbankTransitionStyle({
  settings,
  energy,
  seed,
  styleSeed,
}: {
  settings: CanvasCutbankSettings
  energy: CutbankEnergyState
  seed: number
  styleSeed: string
}): CutbankConcreteTransitionStyle {
  if (settings.transitionStyle !== 'auto') return settings.transitionStyle
  const tierOrder = ['low', 'medium', 'high'] as const
  let tierIndex = tierOrder.indexOf(settings.autoPerformance ? energy.tier : 'medium')
  if (settings.chaos > 0.7 && tierIndex < 2) tierIndex += 1
  if (settings.chaos < 0.15 && tierIndex > 0) tierIndex -= 1
  const flashOk = settings.flashAmount >= 0.05
  const vocabulary = AUTO_TIERS[tierOrder[tierIndex]].filter(style => flashOk || !CUTBANK_TRANSITION_MAP[style].usesFlash)
  const pool = vocabulary.length > 0 ? vocabulary : (['hardCut'] as const)
  const count = Math.max(1, Math.round(1 + clamp01(settings.transitionVariety) * (pool.length - 1)))
  const subset = shuffleDeterministic(pool, cutbankSeed('transition-look', styleSeed)).slice(0, count)
  return subset[Math.min(subset.length - 1, Math.floor(cutbankUnit('transition-pick', seed) * subset.length))]
}

export function cutbankTransitionDurationSec(
  settings: Pick<CanvasCutbankSettings, 'transitionDuration' | 'bpmSync'>,
  context: SharedPerformanceContext,
  canonicalBpm: boolean,
): number {
  const value = clamp01(settings.transitionDuration)
  if (settings.bpmSync) {
    const duration = DURATIONS[Math.min(DURATIONS.length - 1, Math.round(value * (DURATIONS.length - 1)))]
    if (canonicalBpm && context.bpm > 0) return Math.max(0.03, canvasMusicalDurationToSeconds(context, duration))
    const beat = 60 / CUTBANK_FALLBACK_BPM
    const beats = { '1/8beat': 0.125, '1/4beat': 0.25, '1/2beat': 0.5, '1beat': 1, '2beats': 2, '1bar': 4, '2bars': 8 }[duration]
    return Math.max(0.03, beats * beat)
  }
  return lerp(0.05, 1.0, value)
}

export interface CutbankActiveTransition {
  spec: CutbankTransitionSpec
  resolved: CanvasResolvedTransition
  startTimeSec: number
  durationSec: number
}

export function startCutbankTransition({
  style,
  context,
  durationSec,
  fromIdentity,
  toIdentity,
  flashAmount,
}: {
  style: CutbankConcreteTransitionStyle
  context: SharedPerformanceContext
  durationSec: number
  fromIdentity: string
  toIdentity: string
  flashAmount: number
}): CutbankActiveTransition | null {
  let mapping = CUTBANK_TRANSITION_MAP[style]
  // Flash Amount 0 removes black/white/exposure frames: those styles become a clean cut.
  if (mapping.usesFlash && flashAmount < 0.02) mapping = CUTBANK_TRANSITION_MAP.hardCut
  const resolved = resolveCanvasExplicitTransition({
    context,
    id: mapping.canvasId,
    fromFrameIdentity: fromIdentity,
    toFrameIdentity: toIdentity,
    start: true,
  })
  // Canvas returns null on seek/loop/track discontinuities: those cut hard by design.
  if (!resolved) return null
  return {
    spec: { style, ...mapping },
    resolved: { ...resolved, durationSec },
    startTimeSec: context.audioTimeSec,
    durationSec,
  }
}

export interface CutbankTransitionFrame {
  progress: number
  complete: boolean
  visual: CanvasTransitionVisualState
  spec: CutbankTransitionSpec
  /** 0..1 bell curve, peaking mid-transition; used to time treatment spikes. */
  bell: number
}

/**
 * Progress uses CUTBANK's own clock (transport-time aware) so idle preview and
 * canonical playback both advance; the visual state itself comes from
 * CanvasTransitions.resolveCanvasTransitionVisualState.
 */
export function evaluateCutbankTransition(active: CutbankActiveTransition, clockTimeSec: number, intensity: number): CutbankTransitionFrame {
  const raw = active.durationSec <= 0 ? 1 : (clockTimeSec - active.startTimeSec) / active.durationSec
  const progress = clamp01(raw)
  const complete = raw >= 1
  const base = resolveCanvasTransitionVisualState({ ...active.resolved, progress, complete })
  const k = clamp01(intensity)
  // Intensity scales the *deviation* from a plain crossfade, keeping opacity handoff intact.
  const scale = (value: number, neutral: number) => neutral + (value - neutral) * k
  const visual: CanvasTransitionVisualState = {
    ...base,
    incomingScale: scale(base.incomingScale, 1),
    outgoingScale: scale(base.outgoingScale, 1),
    incomingRotation: base.incomingRotation * k,
    outgoingRotation: base.outgoingRotation * k,
    incomingOffsetX: base.incomingOffsetX * k,
    incomingOffsetY: base.incomingOffsetY * k,
    outgoingOffsetX: base.outgoingOffsetX * k,
    outgoingOffsetY: base.outgoingOffsetY * k,
    flash: base.flash * k,
    slice: base.slice * k,
    rgbSplit: base.rgbSplit * k,
    smear: base.smear * k,
  }
  return { progress, complete, visual, spec: active.spec, bell: Math.sin(progress * Math.PI) }
}
