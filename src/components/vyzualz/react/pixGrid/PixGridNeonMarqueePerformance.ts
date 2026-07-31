import type { ReactSectionType } from '../ReactTypes'
import { getPixGridBuiltInCalibration } from './PixGridPerceptualCalibration'
import { resolvePixGridMotionMultiplier } from './PixGridRuntimeControls'
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
export const PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION = 12 as const

const MARQUEE_CELL_X = 1 / 160
const MARQUEE_CELL_Y = 1 / 90

export const PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS = Object.freeze({
  introVerticalCells: 0.5,
  verseHorizontalCells: 2,
  verseVerticalCells: 0.5,
  buildHorizontalCells: 3,
  buildVerticalCells: 1.5,
  dropHorizontalCells: 1.5,
  dropVerticalCells: 2,
  breakdownVerticalCells: 1,
  outroVerticalCells: 0.75,
  introScaleDelta: 0.006,
  verseScaleDelta: 0.012,
  buildScaleDelta: 0.018,
  dropScaleDelta: 0.02,
  breakdownScaleDelta: 0.008,
  outroScaleDelta: 0.006,
  maximumAuthoredScale: 1.02,
  maximumComposedScale: 1.1,
} as const)

export const PIX_GRID_NEON_MARQUEE_SECTION_SUBDIVISIONS: Readonly<Record<ReactSectionType, string>> = Object.freeze({
  intro: 'one selected section-local bar in four; otherwise held',
  verse: 'two section-local beats',
  build: 'one section-local beat, accelerating to one half-beat at 75% section progress',
  preDrop: 'held; staged only by section progress',
  drop: 'one section-local beat',
  breakdown: 'one section-local bar',
  bridge: 'one section-local bar',
  outro: 'one section-local bar until the midpoint, then held on Base',
  unknown: 'held on Base',
})

export interface PixGridNeonMarqueeResolvedPerformance {
  frameIndex: 0 | 1 | 2 | 3
  positionOffsetX: number
  positionOffsetY: number
  scaleMultiplier: number
}

function clamp01(value: number | undefined): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value! : 0))
}

function absoluteBeat(frame: PixGridAudioFrame): number {
  const beatIndex = Number.isFinite(frame.beatIndex) ? Math.max(0, frame.beatIndex!) : 0
  return beatIndex + clamp01(frame.beatPhase)
}

function absoluteBar(frame: PixGridAudioFrame): number {
  if (Number.isFinite(frame.barIndex)) return Math.max(0, frame.barIndex!)
  return absoluteBeat(frame) / 4
}

function rawSectionBeat(frame: PixGridAudioFrame): number {
  return Number.isFinite(frame.beatsSinceSectionStart)
    ? Math.max(0, frame.beatsSinceSectionStart!)
    : absoluteBeat(frame)
}

function rawSectionBar(frame: PixGridAudioFrame): number {
  return Number.isFinite(frame.barsSinceSectionStart)
    ? Math.max(0, frame.barsSinceSectionStart!)
    : absoluteBar(frame)
}

function sectionMotionValue(
  integrated: number | undefined,
  raw: number,
  frame: PixGridAudioFrame,
  sceneMotionMultiplier: number,
): number {
  return integrated != null
    ? Math.max(0, integrated) * Math.max(0, Number.isFinite(sceneMotionMultiplier) ? sceneMotionMultiplier : 1)
    : raw * resolvePixGridMotionMultiplier(frame.motionMultiplier, sceneMotionMultiplier)
}

function sectionBeat(frame: PixGridAudioFrame, sceneMotionMultiplier: number): number {
  return sectionMotionValue(frame.motionClockSectionBeat, rawSectionBeat(frame), frame, sceneMotionMultiplier)
}

function sectionBar(frame: PixGridAudioFrame, sceneMotionMultiplier: number): number {
  return sectionMotionValue(frame.motionClockSectionBar, rawSectionBar(frame), frame, sceneMotionMultiplier)
}

function sectionProgress(frame: PixGridAudioFrame, sceneMotionMultiplier: number): number {
  return clamp01(sectionMotionValue(
    frame.motionClockSectionProgress,
    clamp01(frame.sectionProgress),
    frame,
    sceneMotionMultiplier,
  ))
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function fract(value: number): number {
  return value - Math.floor(value)
}

function wave(value: number, period: number): number {
  return Math.sin((value / Math.max(0.000001, period)) * Math.PI * 2)
}

function breath(value: number, period: number): number {
  return 0.5 - 0.5 * Math.cos((value / Math.max(0.000001, period)) * Math.PI * 2)
}

function smoothstep(value: number): number {
  const normalized = clamp01(value)
  return normalized * normalized * (3 - 2 * normalized)
}

function baseMovement(): Omit<PixGridNeonMarqueeResolvedPerformance, 'frameIndex'> {
  return { positionOffsetX: 0, positionOffsetY: 0, scaleMultiplier: 1 }
}

function movementForSection(
  frame: PixGridAudioFrame,
  sceneMotionMultiplier: number,
): Omit<PixGridNeonMarqueeResolvedPerformance, 'frameIndex'> {
  if (frame.transportState === 'stopped') return baseMovement()
  if (!frame.sectionType && !frame.isPlaying && frame.transportState !== 'paused') return baseMovement()

  const beat = sectionBeat(frame, sceneMotionMultiplier)
  const bar = sectionBar(frame, sceneMotionMultiplier)
  const progress = sectionProgress(frame, sceneMotionMultiplier)
  const sectionType = frame.motionClockSectionType !== undefined
    ? frame.motionClockSectionType
    : frame.sectionType

  switch (sectionType ?? 'unknown') {
    case 'intro':
      return {
        positionOffsetX: 0,
        positionOffsetY: wave(bar, 2) * MARQUEE_CELL_Y * PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.introVerticalCells,
        scaleMultiplier: 1 + breath(bar, 2) * PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.introScaleDelta,
      }
    case 'verse':
      return {
        positionOffsetX: wave(bar, 2) * MARQUEE_CELL_X * PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.verseHorizontalCells,
        positionOffsetY: -breath(bar, 1) * MARQUEE_CELL_Y * PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.verseVerticalCells,
        scaleMultiplier: 1 + breath(bar, 1) * PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.verseScaleDelta,
      }
    case 'build': {
      const ramp = smoothstep(progress)
      return {
        positionOffsetX: wave(bar, 1) * ramp * MARQUEE_CELL_X * PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.buildHorizontalCells,
        positionOffsetY: -breath(beat, 2) * ramp * MARQUEE_CELL_Y * PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.buildVerticalCells,
        scaleMultiplier: 1 + breath(beat, 2) * ramp * PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.buildScaleDelta,
      }
    }
    case 'preDrop':
      return baseMovement()
    case 'drop': {
      const beatPhase = fract(beat)
      const impact = Math.sin(beatPhase * Math.PI)
      const direction = positiveModulo(Math.floor(beat), 2) === 0 ? 1 : -1
      return {
        positionOffsetX: direction * impact * MARQUEE_CELL_X * PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.dropHorizontalCells,
        positionOffsetY: -impact * MARQUEE_CELL_Y * PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.dropVerticalCells,
        scaleMultiplier: 1 + impact * PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.dropScaleDelta,
      }
    }
    case 'breakdown':
    case 'bridge':
      return {
        positionOffsetX: 0,
        positionOffsetY: wave(bar, 2) * MARQUEE_CELL_Y * PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.breakdownVerticalCells,
        scaleMultiplier: 1 + breath(bar, 2) * PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.breakdownScaleDelta,
      }
    case 'outro': {
      const remaining = 1 - smoothstep(progress)
      return {
        positionOffsetX: 0,
        positionOffsetY: wave(bar, 2) * remaining * MARQUEE_CELL_Y * PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.outroVerticalCells,
        scaleMultiplier: 1 + breath(bar, 2) * remaining * PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.outroScaleDelta,
      }
    }
    case 'unknown':
    default:
      return baseMovement()
  }
}

function frameForSection(frame: PixGridAudioFrame, sceneMotionMultiplier: number): 0 | 1 | 2 | 3 {
  if (frame.transportState === 'stopped') return 0
  if (!frame.sectionType && !frame.isPlaying && frame.transportState !== 'paused') return 0

  const beat = sectionBeat(frame, sceneMotionMultiplier)
  const bar = sectionBar(frame, sceneMotionMultiplier)
  const progress = sectionProgress(frame, sceneMotionMultiplier)

  const sectionType = frame.motionClockSectionType !== undefined
    ? frame.motionClockSectionType
    : frame.sectionType

  switch (sectionType ?? 'unknown') {
    case 'intro':
      return positiveModulo(Math.floor(bar), 4) === 3 ? 1 : 0
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
      return positiveModulo(Math.floor(bar), 2) === 0 ? 0 : 3
    case 'outro':
      if (progress >= 0.5) return 0
      return positiveModulo(Math.floor(bar), 2) === 0 ? 3 : 0
    case 'unknown':
    default:
      return 0
  }
}

/**
 * Stateless, transport-position-based choreography for the four supplied native
 * frames. Section-local clocks keep every section entry intentional even when a
 * section starts on an odd absolute beat. Intensity and audio emphasis remain in
 * the existing presentation and output-assignment paths, so native geometry,
 * RGB values, and opaque alpha stay exact in the logical framebuffer.
 */
export function resolvePixGridNeonMarqueePerformance(
  frame: PixGridAudioFrame,
  sceneMotionMultiplier = 1,
): PixGridNeonMarqueeResolvedPerformance {
  const movement = movementForSection(frame, sceneMotionMultiplier)
  const positionOffsetX = Math.abs(movement.positionOffsetX) < 1e-10 ? 0 : movement.positionOffsetX
  const positionOffsetY = Math.abs(movement.positionOffsetY) < 1e-10 ? 0 : movement.positionOffsetY
  return {
    frameIndex: frameForSection(frame, sceneMotionMultiplier),
    positionOffsetX,
    positionOffsetY,
    scaleMultiplier: Math.max(1, Math.min(PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.maximumAuthoredScale, movement.scaleMultiplier)),
  }
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
    amount: overrides.amount ?? 1,
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

const inSections = (...includeSectionTypes: ReactSectionType[]): PixGridReactionConditions => ({
  includeSectionTypes,
  autoPerformanceOnly: true,
})

/**
 * Whole-artwork reactions stay subordinate to the deterministic frame resolver.
 * Transform peaks are deliberately budgeted together so simultaneous bass,
 * kick, downbeat, and drop events remain below a ten-percent scale increase.
 */
export const PIX_GRID_NEON_MARQUEE_AUDIO_ASSIGNMENTS: readonly PixGridReactionAssignment[] = Object.freeze([
  assignment('neon-marquee-bass-breath', 'Bass breathing', 'bass', 'scale', 'layer', [0, 0.015], {
    attack: 0.08,
    release: 0.32,
    smoothing: 0.08,
    minimumConfidence: 0.3,
    perceptualGain: 1,
    minimumEffectiveStrength: 0.006,
    capabilityFallback: 'energy',
    conditions: inSections('verse', 'build', 'drop', 'breakdown'),
    priority: -40,
  }),
  assignment('neon-marquee-build-lift', 'Build contrast lift', 'buildProgress', 'contrast', 'output', [0, 0.12], {
    attack: 0.08,
    release: 0.18,
    smoothing: 0.05,
    minimumConfidence: 0.4,
    perceptualGain: 1,
    minimumEffectiveStrength: 0.025,
    capabilityFallback: 'energy',
    conditions: inSections('build'),
    priority: -30,
  }),
  assignment('neon-marquee-kick-impact', 'Kick scale impact', 'kick', 'scale', 'layer', [0, 0.035], {
    attack: 0,
    hold: 0.055,
    release: 0.18,
    cooldown: 0.04,
    minimumConfidence: 0.38,
    perceptualGain: 1,
    minimumEffectiveStrength: 0.025,
    capabilityFallback: 'beat',
    conditions: inSections('verse', 'build', 'drop'),
    eventPriority: 120,
  }),
  assignment('neon-marquee-snare-edge', 'Snare contrast edge', 'snare', 'contrast', 'output', [0, 0.16], {
    attack: 0,
    hold: 0.04,
    release: 0.15,
    cooldown: 0.05,
    minimumConfidence: 0.4,
    perceptualGain: 1,
    minimumEffectiveStrength: 0.08,
    capabilityFallback: 'transient',
    conditions: inSections('verse', 'build', 'drop'),
    eventPriority: 130,
  }),
  assignment('neon-marquee-downbeat-structure', 'Downbeat structural scale', 'downbeat', 'scale', 'layer', [0, 0.02], {
    attack: 0,
    hold: 0.06,
    release: 0.22,
    cooldown: 0.06,
    minimumConfidence: 0.28,
    perceptualGain: 1,
    minimumEffectiveStrength: 0.015,
    capabilityFallback: 'beat',
    conditions: inSections('intro', 'build', 'drop'),
    eventPriority: 145,
  }),
  assignment('neon-marquee-downbeat-accent', 'Downbeat contrast accent', 'downbeat', 'contrast', 'output', [0, 0.1], {
    attack: 0,
    hold: 0.05,
    release: 0.2,
    cooldown: 0.06,
    minimumConfidence: 0.28,
    perceptualGain: 1,
    minimumEffectiveStrength: 0.05,
    capabilityFallback: 'beat',
    conditions: inSections('intro', 'build', 'drop'),
    eventPriority: 146,
  }),
  assignment('neon-marquee-drop-impact', 'Drop entry scale peak', 'dropImpact', 'scale', 'layer', [0, 0.025], {
    attack: 0,
    hold: 0.07,
    release: 0.32,
    cooldown: 0.14,
    minimumConfidence: 0.48,
    perceptualGain: 1,
    minimumEffectiveStrength: 0.02,
    capabilityFallback: 'transient',
    conditions: inSections('drop'),
    eventPriority: 180,
  }),
  assignment('neon-marquee-drop-accent', 'Drop contrast peak', 'dropImpact', 'contrast', 'output', [0, 0.18], {
    attack: 0,
    hold: 0.07,
    release: 0.32,
    cooldown: 0.14,
    minimumConfidence: 0.48,
    perceptualGain: 1,
    minimumEffectiveStrength: 0.09,
    capabilityFallback: 'transient',
    conditions: inSections('drop'),
    eventPriority: 181,
  }),
])
