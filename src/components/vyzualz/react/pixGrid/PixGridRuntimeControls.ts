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
