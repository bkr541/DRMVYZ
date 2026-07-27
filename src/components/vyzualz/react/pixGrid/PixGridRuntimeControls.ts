import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import type { PixGridAudioFrame, PixGridReactionSource } from './PixGridTypes'

const BASS_REACTIVITY_SOURCES = new Set<PixGridReactionSource>([
  'sub',
  'bass',
  'lowMid',
  'bassStemActivity',
  'kick',
])

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

export function isPixGridBassReactivitySource(source: PixGridReactionSource): boolean {
  return BASS_REACTIVITY_SOURCES.has(source)
}

export function applyPixGridRuntimeControls(
  frame: PixGridAudioFrame,
  controls: { bassReactivity: number; motion: number },
): PixGridAudioFrame {
  const bassReactivityGain = clamp01(controls.bassReactivity)
  const motionMultiplier = clamp01(controls.motion)
  const unscaledSourceValues = { ...(frame.unscaledSourceValues ?? frame.sourceValues) }
  unscaledSourceValues.sub = clamp01(unscaledSourceValues.sub ?? frame.sub ?? 0)
  unscaledSourceValues.bass = clamp01(unscaledSourceValues.bass ?? frame.bass)
  unscaledSourceValues.lowMid = clamp01(unscaledSourceValues.lowMid ?? frame.lowMid ?? 0)
  unscaledSourceValues.bassStemActivity = clamp01(unscaledSourceValues.bassStemActivity ?? frame.bassStemActivity ?? 0)
  unscaledSourceValues.kick = clamp01(unscaledSourceValues.kick ?? (frame.kickHit ? 1 : 0))
  const sourceValues = { ...unscaledSourceValues }
  for (const source of BASS_REACTIVITY_SOURCES) {
    const current = sourceValues[source]
    if (current != null) sourceValues[source] = clamp01(current) * bassReactivityGain
  }
  return {
    ...frame,
    sub: clamp01(frame.sub ?? 0) * bassReactivityGain,
    bass: clamp01(frame.bass) * bassReactivityGain,
    lowMid: clamp01(frame.lowMid ?? 0) * bassReactivityGain,
    bassStemActivity: clamp01(frame.bassStemActivity ?? 0) * bassReactivityGain,
    kickHit: (sourceValues.kick ?? 0) > 0.0001,
    sourceValues,
    unscaledSourceValues,
    bassReactivityGain,
    motionMultiplier,
  }
}

/**
 * PixGrid receives a local context copy. Shared Performance's authoritative
 * timeline and clock are untouched; only bass-sensitive values are scaled.
 */
export function applyPixGridBassGainToPerformanceContext(
  context: SharedPerformanceContext,
  bassReactivityGain: number,
): SharedPerformanceContext {
  const gain = clamp01(bassReactivityGain)
  return {
    ...context,
    bass: clamp01(context.bass) * gain,
    kickStrength: clamp01(context.kickStrength) * gain,
    kick: context.kick && gain > 0.0001,
  }
}

export function resolvePixGridMotionMultiplier(
  globalMotion: number | undefined,
  sceneMotion: number,
): number {
  return clamp01(globalMotion ?? 1) * Math.max(0, Number.isFinite(sceneMotion) ? sceneMotion : 1)
}

function absoluteBeatClock(frame: PixGridAudioFrame): number {
  return Math.max(0, frame.beatIndex ?? 0) + clamp01(frame.beatPhase)
}

function absoluteBarClock(frame: PixGridAudioFrame): number {
  if (frame.barProgress != null) return Math.max(0, frame.barIndex ?? 0) + clamp01(frame.barProgress)
  const beatInBar = ((frame.beatIndex ?? 0) % 4 + 4) % 4
  return Math.max(0, frame.barIndex ?? 0) + (beatInBar + clamp01(frame.beatPhase)) / 4
}

/**
 * Integrates the global Motion control instead of multiplying it by absolute
 * track time. Turning Motion down therefore slows or freezes the current
 * animation pose rather than snapping every layer to a different phase.
 * Seeks and track changes intentionally re-anchor from absolute musical time
 * so transport reconstruction remains deterministic.
 */
export class PixGridMotionClock {
  private trackIdentity: string | null = null
  private lastAudioTime: number | null = null
  private lastBeatClock: number | null = null
  private lastBarClock: number | null = null
  private motionTime = 0
  private motionBeat = 0
  private motionBar = 0

  reset(trackIdentity: string | null = null): void {
    this.trackIdentity = trackIdentity
    this.lastAudioTime = null
    this.lastBeatClock = null
    this.lastBarClock = null
    this.motionTime = 0
    this.motionBeat = 0
    this.motionBar = 0
  }

  apply(frame: PixGridAudioFrame): PixGridAudioFrame {
    const motion = clamp01(frame.motionMultiplier ?? 1)
    const audioTime = Math.max(0, Number.isFinite(frame.audioTime) ? frame.audioTime : 0)
    const beatClock = absoluteBeatClock(frame)
    const barClock = absoluteBarClock(frame)
    const identity = frame.trackIdentity ?? null
    const identityChanged = identity !== this.trackIdentity
    const movedBackward = this.lastAudioTime != null && audioTime + 1e-6 < this.lastAudioTime
    const discontinuity = frame.timingDiscontinuity === true || identityChanged || movedBackward

    if (this.lastAudioTime == null || discontinuity) {
      this.motionTime = audioTime * motion
      this.motionBeat = beatClock * motion
      this.motionBar = barClock * motion
    } else {
      this.motionTime += Math.max(0, audioTime - this.lastAudioTime) * motion
      this.motionBeat += Math.max(0, beatClock - (this.lastBeatClock ?? beatClock)) * motion
      this.motionBar += Math.max(0, barClock - (this.lastBarClock ?? barClock)) * motion
    }

    this.trackIdentity = identity
    this.lastAudioTime = audioTime
    this.lastBeatClock = beatClock
    this.lastBarClock = barClock
    return {
      ...frame,
      motionClockTime: this.motionTime,
      motionClockBeat: this.motionBeat,
      motionClockBar: this.motionBar,
    }
  }
}
