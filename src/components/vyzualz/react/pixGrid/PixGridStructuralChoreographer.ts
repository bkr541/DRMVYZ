/**
 * Bar-clocked structural choreography for PixGrid.
 *
 * The audio intelligence plumbing already delivers `barEntry`, `fourBarBoundary`,
 * `eightBarBoundary`, `sixteenBarBoundary`, `dropImpactHit` and section identity
 * on every frame, but nothing downstream converted those into visible magnitude:
 * the authored scene `motionMultiplier` capped the drop at 0.62 while `build`
 * sat at 0.65, so the energy arc read as inverted on screen.
 *
 * This module turns those structural signals into (a) a motion scalar the
 * compositor multiplies onto the scene motion and (b) an ordered post-composite
 * operator list. Events become decaying envelopes rather than single-frame
 * spikes, so a drop reads as an impact with a tail instead of one dropped frame.
 */

import type { ReactSectionType } from '../ReactTypes'
import type { PixGridAudioFrame } from './PixGridTypes'
import type { PixGridVisualEffectOp } from './PixGridVisualEffectStack'

export interface PixGridStructuralChoreography {
  /** Multiplied onto the scene motion multiplier by the compositor. */
  readonly motionScale: number
  /** Smoothed structural energy in 0..1, used for exposure and contrast. */
  readonly energy: number
  /** Combined transient impact in 0..1 from beat, bar and drop envelopes. */
  readonly impact: number
  readonly visualEffects: readonly PixGridVisualEffectOp[]
  readonly sectionType: ReactSectionType | null
  readonly barIndex: number
  readonly fourBarStage: number
  readonly eightBarStage: number
  readonly sixteenBarStage: number
}

interface SectionProfile {
  /** Baseline structural energy for the section. */
  readonly energy: number
  /** Baseline motion scalar applied on top of the authored scene motion. */
  readonly motion: number
}

/**
 * The authored scene values remain the artistic intent; this table restores the
 * *relative* arc so that drop > build > verse > breakdown > intro > outro > preDrop.
 * `preDrop` stays deliberately frozen because the suspended feel is intentional.
 */
const SECTION_PROFILES: Record<ReactSectionType, SectionProfile> = {
  intro: { energy: 0.3, motion: 0.85 },
  verse: { energy: 0.52, motion: 1.05 },
  build: { energy: 0.74, motion: 1.35 },
  preDrop: { energy: 0.16, motion: 0.4 },
  drop: { energy: 1, motion: 1.9 },
  breakdown: { energy: 0.42, motion: 0.9 },
  bridge: { energy: 0.46, motion: 0.95 },
  outro: { energy: 0.24, motion: 0.7 },
  unknown: { energy: 0.5, motion: 1 },
}

const DEFAULT_PROFILE: SectionProfile = { energy: 0.5, motion: 1 }

/** Envelope half-lives in seconds. */
const HALF_LIFE = {
  beat: 0.09,
  bar: 0.22,
  fourBar: 0.45,
  eightBar: 0.7,
  sixteenBar: 0.9,
  drop: 1.1,
} as const

const DEFAULT_DELTA_SECONDS = 1 / 60
const MAX_DELTA_SECONDS = 0.25

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function decay(value: number, deltaSeconds: number, halfLife: number): number {
  if (value <= 0.0005) return 0
  return value * Math.pow(0.5, deltaSeconds / halfLife)
}

export class PixGridStructuralChoreographer {
  private beatEnvelope = 0
  private barEnvelope = 0
  private fourBarEnvelope = 0
  private eightBarEnvelope = 0
  private sixteenBarEnvelope = 0
  private dropEnvelope = 0
  private smoothedEnergy = 0
  private lastTrackIdentity: string | null = null
  private eventCounter = 0
  private frameCounter = 0

  reset(): void {
    this.beatEnvelope = 0
    this.barEnvelope = 0
    this.fourBarEnvelope = 0
    this.eightBarEnvelope = 0
    this.sixteenBarEnvelope = 0
    this.dropEnvelope = 0
    this.smoothedEnergy = 0
    this.lastTrackIdentity = null
    this.eventCounter = 0
    this.frameCounter = 0
  }

  evaluate(frame: PixGridAudioFrame): PixGridStructuralChoreography {
    const trackIdentity = frame.trackIdentity ?? null
    if (frame.timingDiscontinuity === true || trackIdentity !== this.lastTrackIdentity) {
      this.reset()
      this.lastTrackIdentity = trackIdentity
    }

    const deltaSeconds = Math.min(
      MAX_DELTA_SECONDS,
      Math.max(0, Number.isFinite(frame.deltaTimeSec ?? NaN) ? frame.deltaTimeSec! : DEFAULT_DELTA_SECONDS),
    )

    this.beatEnvelope = decay(this.beatEnvelope, deltaSeconds, HALF_LIFE.beat)
    this.barEnvelope = decay(this.barEnvelope, deltaSeconds, HALF_LIFE.bar)
    this.fourBarEnvelope = decay(this.fourBarEnvelope, deltaSeconds, HALF_LIFE.fourBar)
    this.eightBarEnvelope = decay(this.eightBarEnvelope, deltaSeconds, HALF_LIFE.eightBar)
    this.sixteenBarEnvelope = decay(this.sixteenBarEnvelope, deltaSeconds, HALF_LIFE.sixteenBar)
    this.dropEnvelope = decay(this.dropEnvelope, deltaSeconds, HALF_LIFE.drop)

    if (frame.kickHit === true || frame.beatHit) this.beatEnvelope = 1
    if (frame.barEntry === true || frame.downbeatHit === true) this.barEnvelope = 1
    if (frame.fourBarBoundary === true) this.fourBarEnvelope = 1
    if (frame.eightBarBoundary === true) this.eightBarEnvelope = 1
    if (frame.sixteenBarBoundary === true) this.sixteenBarEnvelope = 1
    if (frame.dropImpactHit === true || frame.sectionEntry === true) {
      if (frame.dropImpactHit === true) this.dropEnvelope = 1
      else if (frame.sectionType === 'drop') this.dropEnvelope = Math.max(this.dropEnvelope, 0.85)
    }
    if (frame.barEntry === true || frame.fourBarBoundary === true || frame.dropImpactHit === true) {
      this.eventCounter += 1
    }

    this.frameCounter = (this.frameCounter + 1) % 1024

    const sectionType = frame.sectionType ?? null
    const profile = sectionType ? (SECTION_PROFILES[sectionType] ?? DEFAULT_PROFILE) : DEFAULT_PROFILE

    // A build should ramp within itself rather than sitting on a flat plateau.
    const buildRamp = sectionType === 'build' ? clamp01(frame.buildProgress ?? frame.sectionProgress ?? 0) : 0
    const targetEnergy = clamp01(
      profile.energy
        + buildRamp * 0.22
        + clamp01(frame.trackRelativeEnergy ?? frame.energy ?? 0) * 0.18,
    )

    // Energy follows quickly on the way up and releases slowly, matching how a
    // room reads a transition.
    const attack = targetEnergy > this.smoothedEnergy ? 0.35 : 0.06
    this.smoothedEnergy += (targetEnergy - this.smoothedEnergy) * attack
    const energy = clamp01(this.smoothedEnergy)

    const impact = clamp01(
      this.dropEnvelope * 0.75 + this.barEnvelope * 0.2 + this.beatEnvelope * 0.15,
    )

    const motionScale = Math.max(
      0.2,
      profile.motion
        * (1 + buildRamp * 0.45)
        * (1 + this.dropEnvelope * 0.75 + this.fourBarEnvelope * 0.15),
    )

    return {
      motionScale,
      energy,
      impact,
      visualEffects: this.buildEffects(sectionType, energy, impact),
      sectionType,
      barIndex: frame.barIndex ?? 0,
      fourBarStage: Math.floor((frame.barIndex ?? 0) / 4) % 4,
      eightBarStage: Math.floor((frame.barIndex ?? 0) / 8) % 2,
      sixteenBarStage: Math.floor((frame.barIndex ?? 0) / 16) % 2,
    }
  }

  private buildEffects(
    sectionType: ReactSectionType | null,
    energy: number,
    impact: number,
  ): readonly PixGridVisualEffectOp[] {
    const ops: PixGridVisualEffectOp[] = []

    // Baseline lift: this alone moves the authored presets off the floor.
    ops.push({
      id: 'structure-exposure',
      kind: 'exposure',
      amount: clamp01(0.24 + energy * 0.42 + impact * 0.2),
    })
    ops.push({
      id: 'structure-contrast',
      kind: 'contrast',
      amount: clamp01(0.16 + energy * 0.34),
    })

    if (sectionType === 'preDrop' || sectionType === 'breakdown') {
      ops.push({ id: 'structure-scanline', kind: 'scanline', amount: 0.35 })
    }

    if (energy > 0.35 || this.dropEnvelope > 0.1) {
      ops.push({
        id: 'structure-bloom',
        kind: 'bloom',
        amount: clamp01(0.3 + energy * 0.5 + this.dropEnvelope * 0.35),
        threshold: 0.16,
        radius: energy > 0.7 ? 3 : 2,
      })
    }

    if (this.fourBarEnvelope > 0.05) {
      ops.push({
        id: 'structure-chroma',
        kind: 'chromaShift',
        amount: clamp01(this.fourBarEnvelope * 0.55),
        axis: this.eventCounter % 2 === 0 ? 'x' : 'y',
      })
    }

    if (this.eightBarEnvelope > 0.05) {
      ops.push({
        id: 'structure-posterize',
        kind: 'posterize',
        amount: clamp01(this.eightBarEnvelope * 0.7),
      })
    }

    if (this.sixteenBarEnvelope > 0.35) {
      ops.push({
        id: 'structure-invert',
        kind: 'invert',
        amount: clamp01((this.sixteenBarEnvelope - 0.35) * 0.9),
      })
    }

    if (this.dropEnvelope > 0.02) {
      ops.push({
        id: 'structure-shake',
        kind: 'shake',
        amount: clamp01(this.dropEnvelope * 0.8),
        axis: this.frameCounter % 2 === 0 ? 'y' : 'x',
        // Seeded per frame so the offset alternates rather than holding steady
        // for the length of the envelope.
        seed: this.frameCounter,
      })
    }

    const flash = Math.max(this.dropEnvelope * 0.5, this.barEnvelope * 0.3, this.beatEnvelope * 0.34)
    if (flash > 0.03) {
      ops.push({ id: 'structure-strobe', kind: 'strobe', amount: clamp01(flash) })
    }

    return ops
  }
}

/** Neutral choreography, used when no runtime is driving the compositor. */
export function createNeutralPixGridChoreography(): PixGridStructuralChoreography {
  return {
    motionScale: 1,
    energy: 0,
    impact: 0,
    visualEffects: [],
    sectionType: null,
    barIndex: 0,
    fourBarStage: 0,
    eightBarStage: 0,
    sixteenBarStage: 0,
  }
}
