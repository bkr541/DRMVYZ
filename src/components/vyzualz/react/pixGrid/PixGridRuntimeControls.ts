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
  const sourceValues = { ...frame.sourceValues }
  sourceValues.sub = clamp01(sourceValues.sub ?? frame.sub ?? 0)
  sourceValues.bass = clamp01(sourceValues.bass ?? frame.bass)
  sourceValues.lowMid = clamp01(sourceValues.lowMid ?? frame.lowMid ?? 0)
  sourceValues.bassStemActivity = clamp01(sourceValues.bassStemActivity ?? frame.bassStemActivity ?? 0)
  sourceValues.kick = clamp01(sourceValues.kick ?? (frame.kickHit ? 1 : 0))
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
