import type {
  PixGridContinuousAudioSource,
  PixGridDiscreteAudioSource,
  PixGridReactionAssignment,
  PixGridReactionCurve,
  PixGridReactionSource,
  PixGridReactionTarget,
} from './PixGridTypes'
import type { PixGridContinuousRoutePlan, PixGridEventRoutePlan } from './PixGridPerformanceTypes'

export interface PixGridRealisticLiveSourceProfile {
  readonly id: string
  readonly label: string
  readonly values: Readonly<Partial<Record<PixGridReactionSource, number>>>
  readonly confidence: number
  readonly capabilities: 'live-only' | 'advanced'
}

/**
 * Representative values from the live analyser path. These deliberately avoid
 * the synthetic 1.0-only inputs that previously let imperceptible routes pass.
 */
export const PIX_GRID_REALISTIC_LIVE_SOURCE_PROFILES: readonly PixGridRealisticLiveSourceProfile[] = Object.freeze([
  { id: 'silence', label: 'Silence', values: { volume: 0.01, energy: 0.02, bass: 0.01, high: 0.01 }, confidence: 0.9, capabilities: 'live-only' },
  { id: 'weak-transient', label: 'Weak transient', values: { transient: 0.38, spectralFlux: 0.16, energy: 0.2 }, confidence: 0.72, capabilities: 'live-only' },
  { id: 'partial-confidence', label: 'Partial source confidence', values: { kick: 0.58, beat: 1, bass: 0.32, energy: 0.42 }, confidence: 0.48, capabilities: 'live-only' },
  { id: 'live-analyser-only', label: 'Live analyser only', values: { kick: 0.6, snare: 0.62, bass: 0.4, energy: 0.52, beat: 1, downbeat: 1 }, confidence: 0.76, capabilities: 'live-only' },
  { id: 'normal-kick', label: 'Normal kick', values: { kick: 0.62, beat: 1, bass: 0.38, sub: 0.3, energy: 0.48 }, confidence: 0.82, capabilities: 'live-only' },
  { id: 'strong-kick', label: 'Strong kick', values: { kick: 0.84, beat: 1, downbeat: 1, bass: 0.58, sub: 0.52, energy: 0.67 }, confidence: 0.9, capabilities: 'live-only' },
  { id: 'normal-snare', label: 'Normal snare', values: { snare: 0.66, beat: 1, transient: 0.58, high: 0.38, energy: 0.46 }, confidence: 0.82, capabilities: 'live-only' },
  { id: 'strong-snare', label: 'Strong snare', values: { snare: 0.86, beat: 1, transient: 0.76, high: 0.55, energy: 0.62 }, confidence: 0.9, capabilities: 'live-only' },
  { id: 'low-bass', label: 'Low sustained bass', values: { bass: 0.18, sub: 0.14, bassStemActivity: 0.16, energy: 0.28 }, confidence: 0.75, capabilities: 'live-only' },
  { id: 'medium-bass', label: 'Medium sustained bass', values: { bass: 0.43, sub: 0.35, bassStemActivity: 0.42, energy: 0.5 }, confidence: 0.82, capabilities: 'live-only' },
  { id: 'strong-bass', label: 'Strong sustained bass', values: { bass: 0.72, sub: 0.64, bassStemActivity: 0.7, energy: 0.72 }, confidence: 0.9, capabilities: 'live-only' },
  { id: 'low-energy', label: 'Low overall energy', values: { energy: 0.18, trackRelativeEnergy: 0.2, volume: 0.16, bass: 0.12, high: 0.1 }, confidence: 0.76, capabilities: 'live-only' },
  { id: 'verse', label: 'Verse energy', values: { energy: 0.4, trackRelativeEnergy: 0.42, bass: 0.3, high: 0.24, beat: 1 }, confidence: 0.8, capabilities: 'live-only' },
  { id: 'build', label: 'Build energy', values: { energy: 0.62, trackRelativeEnergy: 0.67, buildProgress: 0.68, tension: 0.64, high: 0.42, beat: 1 }, confidence: 0.84, capabilities: 'advanced' },
  { id: 'drop', label: 'Drop energy', values: { energy: 0.82, trackRelativeEnergy: 0.88, bass: 0.68, sub: 0.58, kick: 0.78, beat: 1, downbeat: 1, dropImpact: 0.88 }, confidence: 0.9, capabilities: 'advanced' },
])

interface PixGridBuiltInCalibration {
  inputRange: readonly [number, number]
  curve: PixGridReactionCurve
  threshold: number
  hysteresis: number
  attack: number
  hold: number
  release: number
  cooldown: number
  perceptualGain: number
  minimumEffectiveStrength: number
  maskSizeCompensation: number
}

const BAND_SOURCES = new Set<PixGridReactionSource>(['sub', 'bass', 'lowMid', 'mid', 'high', 'air', 'volume', 'spectralFlux', 'spectralBrightness', 'vocalEnergy', 'vocalActivity', 'drumActivity', 'bassStemActivity', 'melodyActivity'])
const ENERGY_SOURCES = new Set<PixGridReactionSource>(['energy', 'trackRelativeEnergy', 'sectionRelativeEnergy', 'tension', 'complexity'])
const PROGRESS_SOURCES = new Set<PixGridReactionSource>(['buildProgress', 'sectionProgress', 'phraseProgress', 'barProgress', 'beatPhase'])
const EVENT_INPUTS: Partial<Record<PixGridDiscreteAudioSource, readonly [number, number]>> = {
  kick: [0.36, 0.9],
  snare: [0.38, 0.92],
  hat: [0.34, 0.86],
  transient: [0.3, 0.88],
}

function eventEnvelope(source: PixGridDiscreteAudioSource): Pick<PixGridBuiltInCalibration, 'hold' | 'release' | 'cooldown' | 'perceptualGain' | 'minimumEffectiveStrength'> {
  switch (source) {
    case 'kick': return { hold: 0.085, release: 0.24, cooldown: 0.065, perceptualGain: 1.85, minimumEffectiveStrength: 0.32 }
    case 'snare': return { hold: 0.095, release: 0.25, cooldown: 0.065, perceptualGain: 1.95, minimumEffectiveStrength: 0.34 }
    case 'hat': return { hold: 0.028, release: 0.095, cooldown: 0.025, perceptualGain: 1.18, minimumEffectiveStrength: 0.1 }
    case 'beat': return { hold: 0.055, release: 0.18, cooldown: 0.03, perceptualGain: 1.35, minimumEffectiveStrength: 0.18 }
    case 'downbeat': return { hold: 0.075, release: 0.3, cooldown: 0.075, perceptualGain: 1.5, minimumEffectiveStrength: 0.24 }
    case 'dropImpact': return { hold: 0.11, release: 0.48, cooldown: 0.16, perceptualGain: 1.65, minimumEffectiveStrength: 0.36 }
    case 'phraseEntry':
    case 'sectionEntry':
    case 'sectionExit': return { hold: 0.12, release: 0.48, cooldown: 0.1, perceptualGain: 1.25, minimumEffectiveStrength: 0.2 }
    default: return { hold: 0.07, release: 0.28, cooldown: 0.04, perceptualGain: 1.2, minimumEffectiveStrength: 0.14 }
  }
}

export function getPixGridBuiltInCalibration(
  source: PixGridReactionSource,
  target: PixGridReactionTarget,
): PixGridBuiltInCalibration {
  const discrete = !(BAND_SOURCES.has(source) || ENERGY_SOURCES.has(source) || PROGRESS_SOURCES.has(source)
    || source.endsWith('Confidence') || source === 'semanticMomentStrength')
  if (discrete) {
    const event = eventEnvelope(source as PixGridDiscreteAudioSource)
    return {
      inputRange: EVENT_INPUTS[source as PixGridDiscreteAudioSource] ?? [0, 1],
      curve: 'linear',
      threshold: 0,
      hysteresis: 0,
      attack: 0,
      ...event,
      maskSizeCompensation: target === 'brightness' || target === 'color' || target === 'paletteRole' || target === 'outlineFlash' || target === 'scale' ? 1 : 0.72,
    }
  }
  const isBand = BAND_SOURCES.has(source)
  const isEnergy = ENERGY_SOURCES.has(source)
  return {
    inputRange: isBand ? [0.055, 0.72] : isEnergy ? [0.1, 0.84] : [0, 1],
    curve: isBand ? 'logarithmic' : 'smoothstep',
    threshold: isBand ? 0.035 : isEnergy ? 0.04 : 0,
    hysteresis: isBand || isEnergy ? 0.025 : 0.01,
    attack: source === 'bass' || source === 'sub' || source === 'bassStemActivity' ? 0.075 : 0.05,
    hold: 0,
    release: source === 'bass' || source === 'sub' || source === 'bassStemActivity' ? 0.3 : 0.22,
    cooldown: 0,
    perceptualGain: isBand ? 1.48 : 1.22,
    minimumEffectiveStrength: isBand ? 0.14 : 0.08,
    maskSizeCompensation: target === 'brightness' || target === 'color' || target === 'paletteRole' || target === 'scale' || target === 'positionX' || target === 'positionY' ? 0.86 : 0.5,
  }
}

export function calibratePixGridBuiltInContinuousRoute(route: PixGridContinuousRoutePlan): PixGridContinuousRoutePlan {
  const calibration = getPixGridBuiltInCalibration(route.source, route.operation)
  return {
    ...route,
    inputRange: route.inputRange ?? calibration.inputRange,
    curve: route.curve ?? calibration.curve,
    threshold: route.threshold ?? calibration.threshold,
    hysteresis: route.hysteresis ?? calibration.hysteresis,
    attack: route.attack ?? calibration.attack,
    release: route.release ?? calibration.release,
    smoothing: route.smoothing ?? 0.035,
    perceptualGain: route.perceptualGain ?? calibration.perceptualGain,
    minimumEffectiveStrength: route.minimumEffectiveStrength ?? calibration.minimumEffectiveStrength,
    maskSizeCompensation: route.maskSizeCompensation ?? calibration.maskSizeCompensation,
  }
}

export function calibratePixGridBuiltInEventRoute(route: PixGridEventRoutePlan): PixGridEventRoutePlan {
  const calibration = getPixGridBuiltInCalibration(route.event, route.operation)
  return {
    ...route,
    inputRange: route.inputRange ?? calibration.inputRange,
    curve: route.curve ?? calibration.curve,
    threshold: route.threshold ?? calibration.threshold,
    hysteresis: route.hysteresis ?? calibration.hysteresis,
    cooldown: route.cooldown ?? calibration.cooldown,
    envelope: {
      ...route.envelope,
      attack: Math.min(route.envelope.attack, calibration.attack),
      hold: Math.max(route.envelope.hold, calibration.hold),
      release: Math.max(route.envelope.release, calibration.release),
    },
    perceptualGain: route.perceptualGain ?? calibration.perceptualGain,
    minimumEffectiveStrength: route.minimumEffectiveStrength ?? calibration.minimumEffectiveStrength,
    maskSizeCompensation: route.maskSizeCompensation ?? calibration.maskSizeCompensation,
  }
}

export function resolvePixGridPerceptualStrength(
  assignment: Pick<PixGridReactionAssignment, 'amount' | 'perceptualGain' | 'minimumEffectiveStrength' | 'maskSizeCompensation'>,
  resolvedValue: number,
  maskCellCount?: number,
  totalCellCount?: number,
): number {
  if (!Number.isFinite(resolvedValue) || Math.abs(resolvedValue) <= 1e-6) return 0
  let gain = Math.max(0, Math.min(4, assignment.perceptualGain ?? 1))
  if ((assignment.maskSizeCompensation ?? 0) > 0 && maskCellCount && totalCellCount) {
    const coverage = Math.max(0.002, Math.min(1, maskCellCount / totalCellCount))
    const compensation = Math.max(0.82, Math.min(2.15, Math.sqrt(0.16 / coverage)))
    const mix = Math.max(0, Math.min(1, assignment.maskSizeCompensation ?? 0))
    gain *= 1 + (compensation - 1) * mix
  }
  let strength = assignment.amount * resolvedValue * gain
  const minimum = Math.max(0, Math.min(2.5, assignment.minimumEffectiveStrength ?? 0))
  if (minimum > 0) {
    const activity = Math.max(0, Math.min(1, Math.abs(resolvedValue) / 0.34))
    const shapedActivity = activity * activity * (3 - 2 * activity)
    const floor = minimum * shapedActivity
    if (Math.abs(strength) < floor) strength = Math.sign(strength || assignment.amount || 1) * floor
  }
  return strength
}

export function liveProfile(id: string): PixGridRealisticLiveSourceProfile {
  return PIX_GRID_REALISTIC_LIVE_SOURCE_PROFILES.find(profile => profile.id === id) ?? PIX_GRID_REALISTIC_LIVE_SOURCE_PROFILES[0]
}
