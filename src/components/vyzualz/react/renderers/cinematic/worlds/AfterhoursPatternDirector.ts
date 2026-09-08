import {
  AFTERHOURS_PATTERN_CHANGES,
  AFTERHOURS_PATTERNS,
  type AfterhoursPattern,
  type AfterhoursPatternChange,
} from '../../../CinematicWorldSettings'
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
 * Afterhours runtime topology/blackout director.
 *
 * Runtime-only. Persisted settings remain the user-intent owner; this class
 * derives the active topology family, morph state, and event-aligned blackout
 * window from the host-prepared canonical music clocks/impulses.
 */

export interface AfterhoursPatternDirectorInput {
  frame: Readonly<CinematicFrameContext>
  settings: Readonly<{
    pattern: AfterhoursPattern
    patternChange: AfterhoursPatternChange
    blackoutAmount: number
    /** When on and a tempo is known, the morph interval is scaled to musical time. */
    bpmSync: boolean
  }>
}

export interface AfterhoursDirectorState {
  /** Topology family rendered this frame. */
  pattern: AfterhoursPattern
  /** Topology family the current morph is coming from. */
  previousPattern: AfterhoursPattern
  /** Deterministic ordinal to feed the beam generator this frame. */
  variation: number
  /** Ordinal the current morph is coming from (=== variation once settled). */
  previousVariation: number
  /** 0..1 morph progress. 1 means settled. */
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

const MORPH_SEC = 0.5
const MORPH_BEATS = 2
const MIN_MORPH_SEC = 0.18
const MAX_MORPH_SEC = 1.2
const VARIATION_MODULO = 0x40000000
const BLACKOUT_RELEASE_HZ = 8

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

function normalizePattern(value: AfterhoursPattern): AfterhoursPattern {
  const legacy: Readonly<Record<string, AfterhoursPattern>> = {
    random: 'radialCrown', xWall: 'chevronRoof', cross: 'crossCanopy', fan: 'wideFan', split: 'splitWings',
  }
  const candidate = legacy[String(value)] ?? value
  return (AFTERHOURS_PATTERNS as readonly string[]).includes(candidate) ? candidate : 'wideFan'
}

function normalizePatternChange(value: AfterhoursPatternChange): AfterhoursPatternChange {
  return (AFTERHOURS_PATTERN_CHANGES as readonly string[]).includes(value) ? value : 'off'
}

function nextPattern(pattern: AfterhoursPattern): AfterhoursPattern {
  const index = AFTERHOURS_PATTERNS.indexOf(pattern)
  return AFTERHOURS_PATTERNS[(Math.max(0, index) + 1) % AFTERHOURS_PATTERNS.length]
}

export class AfterhoursPatternDirector {
  private pattern: AfterhoursPattern = 'wideFan'
  private previousPattern: AfterhoursPattern = 'wideFan'
  private selectedPattern: AfterhoursPattern | null = null
  private variation = 0
  private previousVariation = 0
  private transition = 1
  private lastPatternEventId: string | null = null
  private patternEdgeActive = false
  private lastBlackoutEventId: string | null = null
  private blackoutEdgeActive = false
  private lastPatternChange: AfterhoursPatternChange | null = null
  private blackoutEnvelope = 0
  private blackoutHoldSec = 0

  reset(): void {
    this.pattern = this.selectedPattern ?? 'wideFan'
    this.previousPattern = this.pattern
    this.variation = 0
    this.previousVariation = 0
    this.transition = 1
    this.lastPatternEventId = null
    this.patternEdgeActive = false
    this.lastBlackoutEventId = null
    this.blackoutEdgeActive = false
    this.lastPatternChange = null
    this.blackoutEnvelope = 0
    this.blackoutHoldSec = 0
  }

  update(input: AfterhoursPatternDirectorInput): AfterhoursDirectorState {
    const { frame } = input
    const selectedPattern = normalizePattern(input.settings.pattern)
    const patternChange = normalizePatternChange(input.settings.patternChange)
    const blackoutAmount = clamp01(input.settings.blackoutAmount)
    const bpmSync = input.settings.bpmSync !== false
    const dt = clamp(frame.deltaTimeSec, 0, 0.1)
    const musicPlaying = frame.musicalAudio ? frame.musicalAudio.isPlaying !== false : true

    const bpm = bpmSync && Number.isFinite(frame.beat?.bpm) && (frame.beat?.bpm ?? 0) > 0
      ? (frame.beat as { bpm: number }).bpm
      : 0
    const morphSec = bpm > 0 ? clamp((MORPH_BEATS * 60) / bpm, MIN_MORPH_SEC, MAX_MORPH_SEC) : MORPH_SEC

    // A direct Pattern edit immediately becomes the baseline family. Pattern
    // Change can subsequently walk real topology families from that selection.
    if (this.selectedPattern !== selectedPattern) {
      this.selectedPattern = selectedPattern
      this.pattern = selectedPattern
      this.previousPattern = selectedPattern
      this.variation = 0
      this.previousVariation = 0
      this.transition = 1
      this.lastPatternEventId = null
      this.patternEdgeActive = false
    }

    if (this.lastPatternChange !== patternChange) {
      this.lastPatternEventId = null
      this.patternEdgeActive = false
      this.lastBlackoutEventId = null
      this.blackoutEdgeActive = false
      if (patternChange === 'off') {
        this.pattern = selectedPattern
        this.previousPattern = selectedPattern
        this.transition = 1
      }
      this.lastPatternChange = patternChange
    }

    if (frame.timingDiscontinuity) {
      this.previousPattern = this.pattern
      this.previousVariation = this.variation
      this.transition = 1
      this.lastPatternEventId = null
      this.patternEdgeActive = false
      this.lastBlackoutEventId = null
      this.blackoutEdgeActive = false
      this.blackoutEnvelope = 0
      this.blackoutHoldSec = 0
    }

    const topologyBoundary = musicPlaying && patternChange !== 'off'
      && this.consumeBoundary(frame, patternChange, 'pattern')
    if (topologyBoundary) {
      this.previousPattern = this.pattern
      this.pattern = nextPattern(this.pattern)
      this.previousVariation = this.variation
      this.variation = (this.variation + 1) % VARIATION_MODULO
      this.transition = 0
    } else {
      this.transition = Math.min(1, this.transition + dt / morphSec)
    }

    // Blackouts are attached to a real canonical event, not an arbitrary
    // end-of-bar tail. When Pattern Change is enabled they share that cadence;
    // otherwise a bar boundary is the conservative canonical fallback.
    const blackoutCadence: AfterhoursPatternChange = patternChange === 'off' ? 'bar' : patternChange
    const blackoutBoundary = musicPlaying && blackoutAmount > 0
      && this.consumeBoundary(frame, blackoutCadence, 'blackout')
    if (blackoutBoundary) {
      // Exact control authority: 100% reaches an exact full blackout on the cue.
      this.blackoutEnvelope = blackoutAmount
      this.blackoutHoldSec = 0.06 + blackoutAmount * 0.18
    } else if (this.blackoutHoldSec > 0) {
      this.blackoutHoldSec = Math.max(0, this.blackoutHoldSec - dt)
    } else if (this.blackoutEnvelope > 0) {
      this.blackoutEnvelope *= Math.exp(-BLACKOUT_RELEASE_HZ * dt)
      if (this.blackoutEnvelope < 1e-4) this.blackoutEnvelope = 0
    }
    if (blackoutAmount <= 0 || !musicPlaying) {
      this.blackoutEnvelope = 0
      this.blackoutHoldSec = 0
    }

    return {
      pattern: this.pattern,
      previousPattern: this.previousPattern,
      variation: this.variation,
      previousVariation: this.previousVariation,
      transition: this.transition,
      blackout: clamp01(this.blackoutEnvelope),
    }
  }

  private consumeBoundary(
    frame: Readonly<CinematicFrameContext>,
    cadence: AfterhoursPatternChange,
    channel: 'pattern' | 'blackout',
  ): boolean {
    const canonical = frame.canonicalMusic
    let active = false
    let eventId: string | null = null
    if (cadence === 'drop') {
      const impulse = canonical?.impulses.dropStart
      active = impulse?.active ?? false
      eventId = impulse?.eventId ?? null
    } else {
      const clock = canonical?.clocks[SCHEDULE_CLOCK[cadence] ?? 'bar']
      if (!clock?.available) return false
      active = clock.hit
      eventId = clock.eventId
    }

    if (channel === 'pattern') {
      if (eventId != null) {
        if (eventId === this.lastPatternEventId) return false
        this.lastPatternEventId = eventId
        this.patternEdgeActive = active
        return active
      }
      const rising = active && !this.patternEdgeActive
      this.patternEdgeActive = active
      return rising
    }

    if (eventId != null) {
      if (eventId === this.lastBlackoutEventId) return false
      this.lastBlackoutEventId = eventId
      this.blackoutEdgeActive = active
      return active
    }
    const rising = active && !this.blackoutEdgeActive
    this.blackoutEdgeActive = active
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
