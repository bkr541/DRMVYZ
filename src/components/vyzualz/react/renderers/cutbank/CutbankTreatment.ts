import type { CutbankClock, CutbankEnergyState } from './CutbankClock'
import { clamp01, cutbankUnit, lerp, shuffleDeterministic, cutbankSeed } from './CutbankRandom'
import type { CanvasCutbankSettings } from './CutbankSettings'
import type { CutbankTransitionFrame } from './CutbankTransitions'

/** Master Intensity scales every ceiling: 0 → 20%, 1 → 100%. Sliders stay the maximum. */
export function cutbankMasterScale(master: number): number {
  return 0.2 + 0.8 * clamp01(master)
}

/** Decaying audio impulses (0..1) tracked by the runtime from the shared context. */
export interface CutbankImpulses {
  kick: number
  snare: number
  hat: number
  downbeat: number
  bass: number
  high: number
  transient: number
}

export const EMPTY_CUTBANK_IMPULSES: CutbankImpulses = { kick: 0, snare: 0, hat: 0, downbeat: 0, bass: 0, high: 0, transient: 0 }

export type CutbankTreatmentFamily = 'print' | 'analog' | 'digital' | 'deform'
const FAMILIES: readonly CutbankTreatmentFamily[] = ['print', 'analog', 'digital', 'deform']

export interface CutbankTreatmentPlan {
  /** False when Effects Enabled is off or Treatment Mode is None. */
  active: boolean
  families: Record<CutbankTreatmentFamily, boolean>
  threshold: number
  thresholdLevel: number
  /** 0 hard threshold, 1 halftone, 2 ordered dither, 3 edge trace. */
  thresholdStyle: 0 | 1 | 2 | 3
  posterize: number
  grain: number
  scanlines: number
  lens: number
  signal: number
  jitter: number
  roll: number
  rgb: number
  distortion: number
  ripple: number
  smear: number
  smearAngle: number
  feedback: number
  flashWhite: number
  flashBlack: number
  exposureBurn: number
  zoomPunch: number
}

export interface CutbankTreatmentInput {
  settings: CanvasCutbankSettings
  energy: CutbankEnergyState
  impulses: CutbankImpulses
  transition: CutbankTransitionFrame | null
  /** Changes per composition so Auto can re-roll its treatment family. */
  seed: number
  /** Extra variation counter (Chaos re-rolls it more often). */
  epoch: number
  clock: CutbankClock
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export function resolveActiveTreatmentFamilies(settings: CanvasCutbankSettings, seed: number, epoch: number): Record<CutbankTreatmentFamily, boolean> {
  if (settings.treatmentMode === 'manual') return { print: true, analog: true, digital: true, deform: true }
  const count = Math.max(1, Math.round(1 + clamp01(settings.treatmentVariety) * (FAMILIES.length - 1)))
  const order = shuffleDeterministic(FAMILIES, cutbankSeed('families', seed, epoch))
  const active = new Set(order.slice(0, count))
  return { print: active.has('print'), analog: active.has('analog'), digital: active.has('digital'), deform: active.has('deform') }
}

const OFF: CutbankTreatmentPlan = {
  active: false,
  families: { print: false, analog: false, digital: false, deform: false },
  threshold: 0, thresholdLevel: 0.5, thresholdStyle: 0, posterize: 0, grain: 0, scanlines: 0, lens: 0,
  signal: 0, jitter: 0, roll: 0, rgb: 0, distortion: 0, ripple: 0, smear: 0, smearAngle: 0, feedback: 0,
  flashWhite: 0, flashBlack: 0, exposureBurn: 0, zoomPunch: 0,
}

/**
 * Every strength is `slider × Effect Amount × Master scale` (the ceiling) times a
 * gate and an audio/energy response that never exceeds 1 — so Auto Performance
 * decides *when* to be stronger, but can never pass the user's limits.
 */
export function resolveCutbankTreatment(input: CutbankTreatmentInput): CutbankTreatmentPlan {
  const { settings, energy, impulses, transition, seed, epoch } = input
  const master = cutbankMasterScale(settings.masterIntensity)
  const flashLevel = clamp01(settings.flashAmount) * master
  const tI = clamp01(settings.transitionIntensity) * master
  const bell = transition?.bell ?? 0

  // Flashes are a transition basic, so they survive "Effects Enabled: off" / "None".
  const flashWhiteFromTransition = transition ? clamp01(transition.visual.flash * (flashLevel > 0 ? 1 : 0)) * flashLevel : 0
  let flashWhite = flashWhiteFromTransition
  let flashBlack = 0
  if (settings.autoPerformance && energy.drop && flashLevel >= 0.05 && impulses.downbeat > 0.5) {
    const white = cutbankUnit('impact-flash', seed, epoch) < 0.6
    if (white) flashWhite = Math.max(flashWhite, flashLevel * 0.55 * impulses.downbeat)
    else flashBlack = flashLevel * 0.7 * impulses.downbeat
  }

  const effectsOn = settings.effectsEnabled && settings.treatmentMode !== 'none'
  if (!effectsOn) return { ...OFF, flashWhite: clamp01(flashWhite), flashBlack: clamp01(flashBlack) }

  const auto = settings.treatmentMode === 'auto'
  const families = resolveActiveTreatmentFamilies(settings, seed, epoch)
  const responseWeight = auto ? 0.6 : 0.15
  const curve = auto ? lerp(0.25, 1, energy.drop ? 1 : smoothstep(0.15, 0.9, energy.level)) : 1
  const ceil = (slider: number) => clamp01(slider) * clamp01(settings.effectAmount) * master
  const eff = (slider: number, family: CutbankTreatmentFamily | null, impulse: number, floor = 0) => {
    const gate = family == null || families[family] ? 1 : floor
    return ceil(slider) * gate * clamp01(curve * (1 - responseWeight) + impulse * responseWeight)
  }

  const chaos = clamp01(settings.chaos)
  const tearOpen = cutbankUnit('tear-gate', seed, epoch) < 0.25 + chaos * 0.75 ? 1 : 0.35
  const styleCount = 1 + Math.round(clamp01(settings.treatmentVariety) * 3)
  const thresholdStyle = (Math.floor(cutbankUnit('threshold-style', seed) * styleCount) % 4) as 0 | 1 | 2 | 3

  const tearTransition = (transition?.spec.spikes.tear ?? 0) * bell * tI
  const rgbTransition = ((transition?.spec.spikes.rgb ?? 0) * bell + (transition?.visual.rgbSplit ?? 0)) * tI
  const smearTransition = ((transition?.spec.spikes.smear ?? 0) * bell + (transition?.visual.smear ?? 0)) * tI
  const thresholdTransition = (transition?.spec.spikes.threshold ?? 0) * bell * tI
  const noiseTransition = (transition?.spec.spikes.noise ?? 0) * bell * tI
  const exposureTransition = (transition?.spec.spikes.exposure ?? 0) * bell * tI
  const zoomTransition = (transition?.spec.spikes.zoom ?? 0) * bell * tI

  const thresholdBase = eff(settings.threshold, 'print', impulses.bass)
  const threshold = clamp01(Math.max(thresholdBase, thresholdTransition))
  const thresholdLevel = clamp01(0.5 + (impulses.bass - 0.5) * 0.14 + (cutbankUnit('threshold-level', seed, epoch) - 0.5) * 0.12 * (0.3 + chaos))

  return {
    active: true,
    families,
    threshold,
    thresholdLevel,
    thresholdStyle,
    posterize: threshold * (families.print && settings.treatmentVariety > 0.3 ? 0.5 : 0),
    // Grain is the one always-on baseline (subtle even when its family is not selected).
    grain: clamp01(Math.max(eff(settings.grain, 'analog', Math.max(impulses.hat, impulses.high), 0.35), noiseTransition)),
    scanlines: eff(settings.grain, 'analog', impulses.high) * 0.7,
    lens: eff(settings.lensWarp, 'analog', impulses.bass * 0.5 + energy.level * 0.3),
    signal: clamp01(Math.max(eff(settings.signalDamage, 'digital', Math.max(impulses.snare, impulses.transient)) * tearOpen, tearTransition)),
    jitter: eff(settings.signalDamage, 'digital', impulses.transient) * (0.3 + chaos * 0.7),
    roll: eff(settings.signalDamage, 'digital', impulses.snare) * chaos * (energy.drop ? 1 : 0.4),
    rgb: clamp01(Math.max(eff(settings.rgbSplit, 'digital', Math.max(impulses.kick, impulses.snare)), rgbTransition)),
    distortion: eff(settings.distortion, 'deform', impulses.bass),
    ripple: eff(settings.distortion, 'deform', impulses.kick) * 0.8,
    smear: clamp01(Math.max(eff(settings.smear, 'deform', Math.max(impulses.bass, energy.build)), smearTransition)),
    smearAngle: cutbankUnit('smear-angle', seed, epoch) < 0.5 ? 0 : Math.PI / 2,
    feedback: eff(settings.feedback, 'deform', energy.level * 0.4) ,
    flashWhite: clamp01(flashWhite),
    flashBlack: clamp01(flashBlack),
    exposureBurn: clamp01(exposureTransition * (flashLevel > 0.02 ? 1 : 0)),
    zoomPunch: clamp01(zoomTransition),
  }
}

// ── Motion (compose-level movement) ─────────────────────────────────────────

export interface CutbankMotionPlan {
  /** Multiplicative scale pulse applied to every element. */
  scalePulse: number
  rotationKick: number
  /** Ambient drift amplitude in canvas fractions, before per-element weight. */
  driftAmp: number
  jitterAmp: number
  /** Continuous phase (radians) for drift; derived from the CUTBANK clock. */
  phase: number
  motionScale: number
}

export function resolveCutbankMotion({
  settings, energy, impulses, clock, transition,
}: {
  settings: CanvasCutbankSettings
  energy: CutbankEnergyState
  impulses: CutbankImpulses
  clock: CutbankClock
  transition: CutbankTransitionFrame | null
}): CutbankMotionPlan {
  const motionScale = clamp01(settings.motionAmount) * cutbankMasterScale(settings.masterIntensity)
  const drive = settings.autoPerformance ? lerp(0.6, 1.3, energy.drop ? 1 : energy.level) : 1
  const punch = Math.max(impulses.kick * 0.6, impulses.downbeat) * (energy.drop ? 1.4 : 1)
  return {
    scalePulse: 1 + (punch * 0.07 + (transition?.spec.spikes.zoom ?? 0) * (transition?.bell ?? 0) * 0.1) * motionScale * drive,
    rotationKick: impulses.downbeat * 0.035 * motionScale * drive,
    driftAmp: 0.03 * motionScale * drive,
    jitterAmp: impulses.transient * clamp01(settings.chaos) * 0.012 * motionScale,
    phase: clock.beat * 0.7,
    motionScale,
  }
}
