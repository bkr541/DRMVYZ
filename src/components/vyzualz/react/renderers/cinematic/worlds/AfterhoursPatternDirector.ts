import { AFTERHOURS_PATTERN_CHANGES, type AfterhoursPatternChange } from '../../../CinematicWorldSettings'
import type { CinematicFrameContext } from '../../CinematicWorldRenderer'
import {
  AFTERHOURS_MAX_BEAMS,
  intersectAfterhoursRayWithViewport,
  normalizeAfterhoursRayDirection,
  type AfterhoursBeamDescriptor,
  type AfterhoursEmitter,
  type AfterhoursRayDirection,
} from './AfterhoursBeamGeometry'

/**
 * Afterhours Stage 5 — pattern variation director and blackouts.
 *
 * Runtime-only. Owns the deterministic variation ordinal for the *currently
 * selected pattern family*, the previous/next rig state needed to morph between
 * variations, the consumed pattern-change event identity, and the blackout
 * envelope. It consumes the same host-prepared `canonicalMusic` clock/impulse
 * identities the trigger controller uses — it never fabricates a bar counter
 * from the frame rate, never runs analysis, and never writes persisted settings.
 *
 * The family itself is not owned here: the world passes `settings.pattern`
 * straight to the generator and this director only swaps the `variation` input,
 * so Fan stays Fan, Cross stays Cross, etc. by construction.
 */

export interface AfterhoursPatternDirectorInput {
  frame: Readonly<CinematicFrameContext>
  settings: Readonly<{
    patternChange: AfterhoursPatternChange
    blackoutAmount: number
    /** When on and a tempo is known, the morph interval is scaled to musical time. */
    bpmSync: boolean
  }>
}

export interface AfterhoursDirectorState {
  /** Deterministic ordinal to feed the beam generator this frame. */
  variation: number
  /** Ordinal the current morph is coming *from* (=== variation once settled). */
  previousVariation: number
  /** 0..1 morph progress. 1 means settled — the world can skip the blend. */
  transition: number
  /** 0..1 laser-authority reduction. 0 = full lasers, 1 = full blackout. */
  blackout: number
}

/** Which canonical clock a Pattern Change cadence schedules against. */
const SCHEDULE_CLOCK: Partial<Record<AfterhoursPatternChange, 'bar' | 'bar4' | 'bar8' | 'phrase'>> = {
  bar: 'bar',
  bar4: 'bar4',
  bar8: 'bar8',
  phrase: 'phrase',
}

/**
 * Morph length. BPM Sync OFF (or no tempo): a fixed short wall-clock ramp. BPM
 * Sync ON: the ramp is expressed in beats and clamped, so the re-aim tracks the
 * tempo instead of running a tempo-blind 0.5 s every time. Short and bounded
 * either way so a variation change reads as a deliberate re-aim, not a teleport.
 */
const MORPH_SEC = 0.5
const MORPH_BEATS = 2
const MIN_MORPH_SEC = 0.18
const MAX_MORPH_SEC = 1.2
/** Keeps the ordinal bounded; the generator hashes it, so the exact value is immaterial. */
const VARIATION_MODULO = 0x40000000

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Number.isFinite(value) ? value : lo))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smooth(t: number): number {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

function normalizePatternChange(value: AfterhoursPatternChange): AfterhoursPatternChange {
  return (AFTERHOURS_PATTERN_CHANGES as readonly string[]).includes(value) ? value : 'off'
}

export class AfterhoursPatternDirector {
  private variation = 0
  private previousVariation = 0
  /** 0..1 morph progress. 1 = settled. */
  private transition = 1
  private lastEventId: string | null = null
  private edgeActive = false
  private lastPatternChange: AfterhoursPatternChange | null = null
  private blackoutEnvelope = 0

  reset(): void {
    this.variation = 0
    this.previousVariation = 0
    this.transition = 1
    this.lastEventId = null
    this.edgeActive = false
    this.lastPatternChange = null
    this.blackoutEnvelope = 0
  }

  update(input: AfterhoursPatternDirectorInput): AfterhoursDirectorState {
    const { frame } = input
    const patternChange = normalizePatternChange(input.settings.patternChange)
    const blackoutAmount = clamp01(input.settings.blackoutAmount)
    const bpmSync = input.settings.bpmSync !== false
    const dt = clamp(frame.deltaTimeSec, 0, 0.1)
    const musicPlaying = frame.musicalAudio ? frame.musicalAudio.isPlaying !== false : true

    // BPM Sync ON + a known tempo -> the morph spans MORPH_BEATS beats, clamped;
    // otherwise the fixed wall-clock ramp. Musical-time quantisation of the
    // choreography cadence, without snapping the interpolation to beat edges.
    const bpm = bpmSync && Number.isFinite(frame.beat?.bpm) && (frame.beat?.bpm ?? 0) > 0 ? (frame.beat as { bpm: number }).bpm : 0
    const morphSec = bpm > 0 ? clamp((MORPH_BEATS * 60) / bpm, MIN_MORPH_SEC, MAX_MORPH_SEC) : MORPH_SEC

    // Switching the scheduler cadence invalidates the consumed identity so the
    // next boundary on the new cadence is honoured; the current variation stays.
    if (this.lastPatternChange !== patternChange) {
      this.lastEventId = null
      this.edgeActive = false
      this.lastPatternChange = patternChange
    }

    // Seek / long suspension: drop any in-flight morph and consumed id, and
    // release the blackout — no stale director state survives a discontinuity.
    if (frame.timingDiscontinuity) {
      this.previousVariation = this.variation
      this.transition = 1
      this.lastEventId = null
      this.edgeActive = false
      this.blackoutEnvelope = 0
    }

    if (musicPlaying && patternChange !== 'off' && this.consume(frame, patternChange)) {
      this.previousVariation = this.variation
      this.variation = (this.variation + 1) % VARIATION_MODULO
      this.transition = 0
    } else {
      // The boundary frame itself sits at transition 0; the morph advances from
      // the next frame on. Interval is musical when BPM Sync is on, else fixed.
      this.transition = Math.min(1, this.transition + dt / morphSec)
    }
    const transition = this.transition

    // Blackout: one short deterministic negative-space window at the tail of
    // every bar. It always keys on the bar clock — never on the Pattern Change
    // cadence — so Blackout Amount behaves predictably regardless of the
    // selected pattern-change interval. No bar clock -> no automatic blackout.
    const barClock = frame.canonicalMusic?.clocks.bar
    const blackoutClock = barClock?.available ? barClock : null
    let blackoutTarget = 0
    if (musicPlaying && !frame.timingDiscontinuity && blackoutAmount > 0 && blackoutClock) {
      const windowFraction = mix(0.04, 0.18, blackoutAmount)
      const phase = clamp01(blackoutClock.phase)
      if (phase >= 1 - windowFraction) {
        const into = (phase - (1 - windowFraction)) / Math.max(windowFraction, 1e-6)
        blackoutTarget = smooth(into) * mix(0.55, 1, blackoutAmount)
      }
    }
    // Follow the target quickly but not instantly, so a blackout reads as a
    // deliberate lighting cue rather than a 1-frame flicker. The release is a
    // touch faster than the fall so the room comes back promptly after the
    // boundary. The target returns to 0 every cycle, so this can never latch.
    const rate = blackoutTarget >= this.blackoutEnvelope ? 26 : 55
    const follow = clamp01(1 - Math.exp(-rate * dt))
    this.blackoutEnvelope += (blackoutTarget - this.blackoutEnvelope) * follow
    if (blackoutTarget <= 0 && this.blackoutEnvelope < 1e-4) this.blackoutEnvelope = 0
    const blackout = clamp01(this.blackoutEnvelope)

    return {
      variation: this.variation,
      previousVariation: this.previousVariation,
      transition,
      blackout,
    }
  }

  /**
   * Fire once per canonical boundary identity. Prefers the canonical `eventId`;
   * falls back to a rising edge on `hit`/`active` only when no identity exists.
   * Returns false when the required canonical clock is unavailable rather than
   * inventing a frame-rate bar counter.
   */
  private consume(frame: Readonly<CinematicFrameContext>, patternChange: AfterhoursPatternChange): boolean {
    const canonical = frame.canonicalMusic
    let active = false
    let eventId: string | null = null
    if (patternChange === 'drop') {
      const impulse = canonical?.impulses.dropStart
      active = impulse?.active ?? false
      eventId = impulse?.eventId ?? null
    } else {
      const clock = canonical?.clocks[SCHEDULE_CLOCK[patternChange] ?? 'bar']
      if (!clock?.available) return false
      active = clock.hit
      eventId = clock.eventId
    }

    if (eventId != null) {
      if (eventId === this.lastEventId) return false
      this.lastEventId = eventId
      this.edgeActive = active
      return active
    }
    const rising = active && !this.edgeActive
    this.edgeActive = active
    return rising
  }
}

export interface AfterhoursRenderBeam {
  active: boolean
  origin: AfterhoursEmitter
  direction: AfterhoursRayDirection
  endpoint: AfterhoursEmitter
  /** Compatibility alias; always identical to the derived viewport-exit endpoint. */
  target: AfterhoursEmitter
  accent: boolean
  /** 0..1 render weight — drives per-beam fade in/out across a variation morph. */
  weight: number
}

/**
 * Blend two generator frames for a pattern-variation morph. Emitter origins are
 * fixed and never interpolated. The director interpolates the intentional ray
 * direction and re-intersects it with the viewport, so an in-flight morph can
 * never turn the new ray model back into a floating finite segment. Slots active
 * in exactly one frame fade in / out by `weight`.
 */
export function blendAfterhoursBeamFrames(
  previous: readonly AfterhoursBeamDescriptor[],
  next: readonly AfterhoursBeamDescriptor[],
  transition: number,
  viewportAspectRatio = 16 / 9,
): readonly AfterhoursRenderBeam[] {
  const k = smooth(transition)
  const out: AfterhoursRenderBeam[] = []
  for (let index = 0; index < AFTERHOURS_MAX_BEAMS; index += 1) {
    const a = previous[index]
    const b = next[index]
    if (a.active && b.active) {
      const direction = normalizeAfterhoursRayDirection({
        x: mix(a.direction.x, b.direction.x, k),
        y: mix(a.direction.y, b.direction.y, k),
      }, b.direction)
      const endpoint = intersectAfterhoursRayWithViewport(b.origin, direction, viewportAspectRatio)
      out.push({
        active: true,
        origin: b.origin,
        direction,
        endpoint,
        target: endpoint,
        accent: b.accent,
        weight: 1,
      })
    } else if (b.active) {
      out.push({ active: true, origin: b.origin, direction: b.direction, endpoint: b.endpoint, target: b.endpoint, accent: b.accent, weight: k })
    } else if (a.active) {
      out.push({ active: true, origin: a.origin, direction: a.direction, endpoint: a.endpoint, target: a.endpoint, accent: a.accent, weight: 1 - k })
    } else {
      out.push({ active: false, origin: b.origin, direction: b.direction, endpoint: b.endpoint, target: b.endpoint, accent: false, weight: 0 })
    }
  }
  return out
}
