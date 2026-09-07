import { AFTERHOURS_TRIGGERS, type AfterhoursTrigger } from '../../../CinematicWorldSettings'
import type { CinematicFrameContext } from '../../CinematicWorldRenderer'

/**
 * Afterhours Stage 4 — canonical music-reactivity owner.
 *
 * Runtime-only. Consumes the host-prepared `canonicalMusic` impulses/clocks and
 * `musicalAudio` from the Cinema frame; it never runs an FFT, a BPM detector, or
 * a second beat clock, and it never touches persisted settings. The single
 * selected Trigger drives one bounded reaction envelope that the world maps into
 * derived intensity / spread / motion / active-beam modifiers. Drop is weighted
 * harder but is still just one Trigger option — no separate hero subsystem.
 */

export type { AfterhoursTrigger }

export interface AfterhoursTriggerControllerInput {
  frame: Readonly<CinematicFrameContext>
  settings: Readonly<{
    trigger: AfterhoursTrigger
    bpmSync: boolean
    masterIntensity: number
    pulseAmount: number
    pulseDecay: number
    motionAmount: number
  }>
}

export interface AfterhoursReactionState {
  /** Raw 0..1 reaction envelope (pre Pulse Amount). */
  envelope: number
  /** True only on the frame a fresh canonical event was consumed. */
  fired: boolean
  /** 0..1 residual weighting from the most recent Drop-triggered hit. */
  dropWeight: number
  /** Final laser authority multiplier applied to the shader (bounded). */
  intensity: number
  /** Additive delta for the Spread setting; caller clamps the sum to 0..1. */
  spreadDelta: number
  /** Deterministic motion phase — musical when BPM Sync is on, else continuous. */
  motionPhase: number
  /** 0..1 authority scaling geometry sweep amplitude (0 when Motion Amount = 0). */
  motionAuthority: number
  /** 0..1 fraction of the user's Beam Count to show this frame. */
  beamUtilization: number
}

const CLOCK_TRIGGERS: Partial<Record<AfterhoursTrigger, 'beat' | 'beat2' | 'beat4' | 'bar' | 'bar4' | 'bar8' | 'phrase'>> = {
  beat: 'beat',
  beat2: 'beat2',
  beat4: 'beat4',
  bar: 'bar',
  bar4: 'bar4',
  bar8: 'bar8',
  phrase: 'phrase',
}

const IMPULSE_TRIGGERS: Partial<Record<AfterhoursTrigger, 'kick' | 'snare' | 'downbeat' | 'dropStart'>> = {
  kick: 'kick',
  snare: 'snare',
  downbeat: 'downbeat',
  drop: 'dropStart',
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Number.isFinite(value) ? value : lo))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function normalizeTrigger(value: AfterhoursTrigger): AfterhoursTrigger {
  return (AFTERHOURS_TRIGGERS as readonly string[]).includes(value) ? value : 'beat'
}

/**
 * Energy-onset fallback thresholds. Only used when the selected clock trigger has
 * no canonical beat grid at all — arm/rearm hysteresis makes it fire once per
 * swell rather than every frame. Not a user-selectable trigger.
 */
const ENERGY_FALLBACK_FIRE = 0.72
const ENERGY_FALLBACK_REARM = 0.56

export class AfterhoursTriggerController {
  private envelope = 0
  private dropWeight = 0
  private lastEventId: string | null = null
  private lastTrigger: AfterhoursTrigger | null = null
  private edgeActive = false
  private continuousPhase = 0
  private energyArmed = true

  reset(): void {
    this.envelope = 0
    this.dropWeight = 0
    this.lastEventId = null
    this.lastTrigger = null
    this.edgeActive = false
    this.continuousPhase = 0
    this.energyArmed = true
  }

  update(input: AfterhoursTriggerControllerInput): AfterhoursReactionState {
    const { frame } = input
    const trigger = normalizeTrigger(input.settings.trigger)
    const bpmSync = input.settings.bpmSync !== false
    const masterIntensity = clamp01(input.settings.masterIntensity)
    const pulseAmount = clamp01(input.settings.pulseAmount)
    const pulseDecay = clamp01(input.settings.pulseDecay)
    const motionAmount = clamp01(input.settings.motionAmount)

    const dt = clamp(frame.deltaTimeSec, 0, 0.1)
    const musicPlaying = frame.musicalAudio ? frame.musicalAudio.isPlaying !== false : true

    // A seek / long suspension invalidates consumed identities and any envelope.
    if (frame.timingDiscontinuity || this.lastTrigger !== trigger) {
      if (this.lastTrigger !== trigger) {
        this.lastEventId = null
        this.edgeActive = false
      }
      if (frame.timingDiscontinuity) {
        this.envelope = 0
        this.dropWeight = 0
        this.lastEventId = null
        this.edgeActive = false
        this.energyArmed = true
      }
      this.lastTrigger = trigger
    }

    const fired = musicPlaying && this.consume(frame, trigger)
    if (fired) {
      this.envelope = 1
      if (trigger === 'drop') this.dropWeight = 1
    }

    // Release: Pulse Decay maps monotonically from a fast snap-back to a long,
    // sustained tail. Only the initial hit is a hard discontinuity.
    const releaseRate = 0.6 + (1 - pulseDecay) * (1 - pulseDecay) * 7.4
    const decay = Math.exp(-releaseRate * dt)
    if (!fired) this.envelope *= decay
    this.dropWeight *= Math.exp(-(releaseRate * 0.7) * dt)
    if (!musicPlaying) {
      this.envelope *= Math.exp(-4 * dt)
      this.dropWeight *= Math.exp(-4 * dt)
    }
    this.envelope = clamp01(this.envelope)
    this.dropWeight = clamp01(this.dropWeight)

    // Deterministic motion phase. ON: canonical musical time (bar index + phase),
    // frame-rate independent. OFF: continuous transport time.
    const barClock = frame.canonicalMusic?.clocks.bar
    const beatBarIndex = frame.beat?.barIndex ?? -1
    const musicalPhase = barClock?.available
      ? (barClock.index ?? 0) + clamp01(barClock.phase)
      : (beatBarIndex >= 0 ? beatBarIndex + clamp01(frame.beat?.barProgress ?? 0) : frame.transportTimeSec * 0.5)
    this.continuousPhase += dt * 0.5
    const motionPhase = bpmSync ? musicalPhase : (Number.isFinite(frame.transportTimeSec) ? frame.transportTimeSec * 0.5 : this.continuousPhase)

    const envelopeEff = this.envelope * pulseAmount
    const dropEff = this.dropWeight * pulseAmount

    const intensity = clamp(
      (0.6 + masterIntensity * 0.55) * (1 + envelopeEff * 0.55 + dropEff * 0.65),
      0.32,
      2.3,
    )
    const spreadDelta = clamp(envelopeEff * 0.16 + dropEff * 0.24, 0, 0.42)
    const motionAuthority = motionAmount <= 0
      ? 0
      : clamp01(motionAmount * (0.28 + 0.72 * envelopeEff + 0.5 * dropEff))
    // Rest sits below the user's full Beam Count so an ordinary trigger has room
    // to grow and Drop can bias toward the full budget — never above it. At
    // Master Intensity 1 the resting field already fills the budget.
    const restUtilization = 0.5 + masterIntensity * 0.5
    const beamUtilization = clamp(restUtilization + envelopeEff * 0.3 + dropEff * 0.55, 0.34, 1)

    return {
      envelope: this.envelope,
      fired,
      dropWeight: this.dropWeight,
      intensity,
      spreadDelta,
      motionPhase,
      motionAuthority,
      beamUtilization,
    }
  }

  /**
   * Fire once per canonical event identity. Prefers the canonical `eventId`;
   * falls back to a rising-edge on `active`/`hit` only when no identity exists
   * (mirrors Electric Storm's fallback boundary). When a selected clock trigger
   * has no canonical beat grid at all, degrades to an energy-onset fallback so
   * the world still reacts to loud material instead of sitting inert.
   */
  private consume(frame: Readonly<CinematicFrameContext>, trigger: AfterhoursTrigger): boolean {
    const canonical = frame.canonicalMusic
    const clockKey = CLOCK_TRIGGERS[trigger]
    const impulseKey = IMPULSE_TRIGGERS[trigger]

    let active = false
    let eventId: string | null = null
    if (canonical && clockKey) {
      const clock = canonical.clocks[clockKey]
      if (!clock.available) return this.consumeEnergyOnset(frame)
      active = clock.hit
      eventId = clock.eventId
    } else if (canonical && impulseKey) {
      const impulse = canonical.impulses[impulseKey]
      active = impulse.active
      eventId = impulse.eventId
    } else {
      // No canonical context at all — degrade to the plain beat state.
      active = trigger === 'downbeat' ? (frame.beat?.downbeat ?? false) : (frame.beat?.hit ?? false)
    }

    if (eventId != null) {
      if (eventId === this.lastEventId) return false
      this.lastEventId = eventId
      this.edgeActive = active
      return active
    }
    // Identity-less: rising edge only.
    const rising = active && !this.edgeActive
    this.edgeActive = active
    return rising
  }

  /**
   * No canonical beat grid for the selected clock trigger: fire on a rising
   * swell of host `overallEnergy`, with arm/rearm hysteresis so it fires once
   * per swell rather than continuously. The hysteresis *is* the de-duplication
   * (energy onsets carry no event id).
   */
  private consumeEnergyOnset(frame: Readonly<CinematicFrameContext>): boolean {
    const energy = clamp01(
      frame.musicalAudio?.values.overallEnergy
      ?? frame.audio?.smoothed?.volume
      ?? 0,
    )
    if (energy <= ENERGY_FALLBACK_REARM) this.energyArmed = true
    if (!this.energyArmed || energy < ENERGY_FALLBACK_FIRE) return false
    this.energyArmed = false
    return true
  }
}
