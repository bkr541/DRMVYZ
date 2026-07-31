import type { ReactSectionType } from '../ReactTypes'
import { getPixGridBuiltInCalibration } from './PixGridPerceptualCalibration'
import type {
  PixGridAudioFrame,
  PixGridReactionAssignment,
  PixGridReactionConditions,
  PixGridReactionSource,
  PixGridReactionTarget,
  PixGridReactionTargetScope,
} from './PixGridTypes'

export const PIX_GRID_NEON_MARQUEE_PRESET_ID = 'pix-grid-neon-marquee-cycle' as const
export const PIX_GRID_NEON_MARQUEE_ASSET_ID = 'pix-neon-marquee-cycle' as const
export const PIX_GRID_NEON_MARQUEE_LAYER_ID = 'neon-marquee-frame' as const
export const PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION = 9 as const

export const PIX_GRID_NEON_MARQUEE_SECTION_SUBDIVISIONS: Readonly<Record<ReactSectionType, string>> = Object.freeze({
  intro: 'one selected bar in four; otherwise held',
  verse: 'two beats',
  build: 'one beat, accelerating to one half-beat at 75% section progress',
  preDrop: 'held; staged only by section progress',
  drop: 'one beat',
  breakdown: 'one bar',
  bridge: 'one bar',
  outro: 'one bar until the midpoint, then held on Base',
  unknown: 'held on Base',
})

export interface PixGridNeonMarqueeResolvedPerformance {
  frameIndex: 0 | 1 | 2 | 3
  scaleMultiplier: number
  opacityMultiplier: number
}

function clamp01(value: number | undefined): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value! : 0))
}

function absoluteBeat(frame: PixGridAudioFrame): number {
  const beatIndex = Number.isFinite(frame.beatIndex) ? Math.max(0, frame.beatIndex!) : 0
  return beatIndex + clamp01(frame.beatPhase)
}

function absoluteBar(frame: PixGridAudioFrame): number {
  if (Number.isFinite(frame.barIndex)) return Math.max(0, Math.floor(frame.barIndex!))
  return Math.floor(absoluteBeat(frame) / 4)
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function frameForSection(frame: PixGridAudioFrame): 0 | 1 | 2 | 3 {
  if (frame.transportState === 'stopped') return 0
  if (!frame.sectionType && !frame.isPlaying && frame.transportState !== 'paused') return 0

  const beat = absoluteBeat(frame)
  const bar = absoluteBar(frame)
  const progress = clamp01(frame.sectionProgress)

  switch (frame.sectionType ?? 'unknown') {
    case 'intro':
      return positiveModulo(bar, 4) === 3 ? 1 : 0
    case 'verse':
      return positiveModulo(Math.floor(beat / 2), 2) as 0 | 1
    case 'build': {
      const stepsPerBeat = progress >= 0.75 ? 2 : 1
      return positiveModulo(Math.floor(beat * stepsPerBeat), 4) as 0 | 1 | 2 | 3
    }
    case 'preDrop':
      if (progress >= 0.88) return 2
      if (progress >= 0.45) return 1
      return 0
    case 'drop':
      return positiveModulo(Math.floor(beat), 4) as 0 | 1 | 2 | 3
    case 'breakdown':
    case 'bridge':
      return positiveModulo(bar, 2) === 0 ? 0 : 3
    case 'outro':
      if (progress >= 0.5) return 0
      return positiveModulo(bar, 2) === 0 ? 3 : 0
    case 'unknown':
    default:
      return 0
  }
}

function beatPulse(frame: PixGridAudioFrame): number {
  const phase = clamp01(frame.beatPhase)
  return Math.max(0, 1 - phase * 4)
}

/**
 * Stateless, transport-position-based choreography for the four supplied native
 * frames. No elapsed render-frame state is retained, so seek, loop, pause, and
 * renderer fallback all resolve the same frame and transform.
 */
export function resolvePixGridNeonMarqueePerformance(
  frame: PixGridAudioFrame,
): PixGridNeonMarqueeResolvedPerformance {
  const frameIndex = frameForSection(frame)
  const pulse = beatPulse(frame)
  const progress = clamp01(frame.sectionProgress)
  let scaleMultiplier = 1
  let opacityMultiplier = 1

  switch (frame.sectionType ?? 'unknown') {
    case 'intro':
      opacityMultiplier = 0.84
      break
    case 'verse':
      scaleMultiplier = 1 + pulse * 0.018
      opacityMultiplier = 0.92
      break
    case 'build':
      scaleMultiplier = 1 + progress * 0.018 + pulse * 0.018
      opacityMultiplier = 0.92 + progress * 0.06
      break
    case 'preDrop':
      scaleMultiplier = progress >= 0.88 ? 1.025 : 1
      opacityMultiplier = 0.86
      break
    case 'drop':
      scaleMultiplier = 1 + pulse * 0.028 + (frameIndex === 2 ? 0.014 : 0)
      opacityMultiplier = frameIndex === 2 ? 1 : 0.96
      break
    case 'breakdown':
    case 'bridge':
      scaleMultiplier = 0.99
      opacityMultiplier = 0.78
      break
    case 'outro':
      scaleMultiplier = 0.99
      opacityMultiplier = 0.72 + (1 - progress) * 0.08
      break
    case 'unknown':
    default:
      break
  }

  if (frame.transportState === 'stopped') {
    return { frameIndex: 0, scaleMultiplier: 1, opacityMultiplier: 1 }
  }

  return { frameIndex, scaleMultiplier, opacityMultiplier }
}

const EVENT_SOURCES = new Set<PixGridReactionSource>([
  'beat', 'downbeat', 'kick', 'snare', 'hat', 'transient', 'barEntry',
  'fourBarBoundary', 'eightBarBoundary', 'sixteenBarBoundary', 'phraseEntry',
  'sectionEntry', 'sectionExit', 'dropImpact', 'dropOccurrenceChange',
  'semanticMoment', 'trackMapCueEvent',
])

function assignment(
  id: string,
  name: string,
  source: PixGridReactionSource,
  target: PixGridReactionTarget,
  targetScope: PixGridReactionTargetScope,
  outputRange: readonly [number, number],
  overrides: Partial<PixGridReactionAssignment> = {},
): PixGridReactionAssignment {
  const calibration = getPixGridBuiltInCalibration(source, target)
  const event = EVENT_SOURCES.has(source)
  return {
    id,
    name,
    enabled: true,
    source,
    target,
    targetScope,
    targetId: overrides.targetId ?? (targetScope === 'layer' ? PIX_GRID_NEON_MARQUEE_LAYER_ID : null),
    amount: overrides.amount ?? outputRange[1],
    polarity: overrides.polarity ?? 'positive',
    invert: overrides.invert ?? false,
    inputRange: overrides.inputRange ?? calibration.inputRange,
    outputRange,
    curve: overrides.curve ?? calibration.curve,
    threshold: overrides.threshold ?? calibration.threshold,
    hysteresis: overrides.hysteresis ?? calibration.hysteresis,
    attack: overrides.attack ?? calibration.attack,
    hold: Math.max(overrides.hold ?? 0, calibration.hold),
    release: Math.max(overrides.release ?? 0, calibration.release),
    cooldown: overrides.cooldown ?? calibration.cooldown,
    bassReactivityEnabled: overrides.bassReactivityEnabled !== false,
    perceptualGain: overrides.perceptualGain ?? 1,
    minimumEffectiveStrength: overrides.minimumEffectiveStrength ?? 0,
    maskSizeCompensation: overrides.maskSizeCompensation ?? 0,
    decayCurve: overrides.decayCurve ?? 'easeOut',
    smoothing: overrides.smoothing ?? (event ? 0 : 0.06),
    quantization: overrides.quantization ?? 'none',
    retrigger: overrides.retrigger ?? 'restart',
    maximumStacking: overrides.maximumStacking ?? 1,
    eventPriority: overrides.eventPriority ?? 0,
    minimumConfidence: overrides.minimumConfidence ?? 0,
    capabilityFallback: overrides.capabilityFallback ?? (event ? 'beat' : 'energy'),
    ...(overrides.conditions ? { conditions: overrides.conditions } : {}),
    priority: overrides.priority ?? 0,
    clamp: overrides.clamp ?? outputRange,
    blend: overrides.blend ?? 'add',
    paletteRole: overrides.paletteRole ?? 'highlight',
    color: overrides.color ?? '#ffffff',
    seedOffset: overrides.seedOffset ?? 0,
  }
}

const inSections = (...includeSectionTypes: ReactSectionType[]): PixGridReactionConditions => ({ includeSectionTypes })

/**
 * Conservative whole-artwork reactions. Frame identity remains owned solely by
 * the deterministic section resolver; these routes can only add bounded scale
 * or brightness and never advance, randomize, recolor, or displace a frame.
 */
export const PIX_GRID_NEON_MARQUEE_AUDIO_ASSIGNMENTS: readonly PixGridReactionAssignment[] = Object.freeze([
  assignment('neon-marquee-bass-breath', 'Bass breathing', 'bass', 'scale', 'layer', [0, 0.02], {
    attack: 0.08,
    release: 0.3,
    smoothing: 0.08,
    capabilityFallback: 'energy',
    conditions: inSections('verse', 'build', 'drop', 'breakdown'),
    priority: -40,
  }),
  assignment('neon-marquee-build-lift', 'Build brightness lift', 'buildProgress', 'brightness', 'output', [0, 0.06], {
    attack: 0.06,
    release: 0.14,
    smoothing: 0.05,
    capabilityFallback: 'energy',
    conditions: inSections('build'),
    priority: -30,
  }),
  assignment('neon-marquee-kick-impact', 'Kick scale impact', 'kick', 'scale', 'layer', [0, 0.03], {
    attack: 0,
    hold: 0.045,
    release: 0.16,
    cooldown: 0.04,
    capabilityFallback: 'beat',
    conditions: inSections('verse', 'build', 'drop'),
    eventPriority: 120,
  }),
  assignment('neon-marquee-snare-edge', 'Snare brightness edge', 'snare', 'brightness', 'output', [0, 0.08], {
    attack: 0,
    hold: 0.035,
    release: 0.14,
    cooldown: 0.05,
    capabilityFallback: 'transient',
    conditions: inSections('verse', 'build', 'drop'),
    eventPriority: 130,
  }),
  assignment('neon-marquee-downbeat-structure', 'Downbeat structural emphasis', 'downbeat', 'brightness', 'output', [0, 0.1], {
    attack: 0,
    hold: 0.045,
    release: 0.18,
    cooldown: 0.06,
    capabilityFallback: 'beat',
    conditions: inSections('intro', 'build', 'drop'),
    eventPriority: 145,
  }),
  assignment('neon-marquee-drop-impact', 'Drop entry peak', 'dropImpact', 'brightness', 'output', [0, 0.16], {
    attack: 0,
    hold: 0.07,
    release: 0.3,
    cooldown: 0.14,
    capabilityFallback: 'transient',
    conditions: inSections('drop'),
    eventPriority: 180,
  }),
])
