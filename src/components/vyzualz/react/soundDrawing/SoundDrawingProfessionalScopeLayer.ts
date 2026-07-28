import {
  DEFAULT_SOUND_DRAWING_SCOPE_STATE,
  SCOPE_MEASUREMENT_SIGNAL_MODES,
  SCOPE_PRESETS_BY_ID,
  applyScopePreset,
  normalizeSoundDrawingScopeState,
  resolveScopeCaptureFrames,
  type SoundDrawingScopeState,
} from '../../../../audio/scope'
import type {
  SoundDrawingProfessionalScopeLayerSettings,
  SoundDrawingResolvedProfessionalScopeLayerSettings,
} from './SoundDrawingPerformanceTypes'

function freshScopeState(): SoundDrawingScopeState {
  return normalizeSoundDrawingScopeState({
    ...DEFAULT_SOUND_DRAWING_SCOPE_STATE,
    enabled: true,
  })
}

/** Resolves a show-authored patch without consulting or mutating manual scope state. */
export function resolveProfessionalScopeLayerSettings(
  authored?: SoundDrawingProfessionalScopeLayerSettings,
): SoundDrawingResolvedProfessionalScopeLayerSettings {
  const presetId = authored?.presetId
  const base =
    presetId && SCOPE_PRESETS_BY_ID.has(presetId)
      ? applyScopePreset(freshScopeState(), presetId)
      : freshScopeState()
  const state = normalizeSoundDrawingScopeState({
    ...base,
    enabled: true,
    signalMode: authored?.signalMode ?? base.signalMode,
    monoDelayMs: authored?.monoDelayMs ?? base.monoDelayMs,
    signalConditioner: { ...base.signalConditioner, ...authored?.signalConditioner },
    trigger: { ...base.trigger, ...authored?.trigger },
    timebase: { ...base.timebase, ...authored?.timebase },
    beam: { ...base.beam, ...authored?.beam },
    phosphor: { ...base.phosphor, ...authored?.phosphor },
    crt: { ...base.crt, ...authored?.crt },
    music: { ...base.music, ...authored?.music },
  })
  return {
    state,
    exposure: Math.max(0.1, Math.min(4, authored?.exposure ?? 1)),
    transitionSeconds: Math.max(0, Math.min(8, authored?.transitionSeconds ?? 0.35)),
    measurementSafe: SCOPE_MEASUREMENT_SIGNAL_MODES.includes(state.signalMode),
  }
}

export function professionalScopeCaptureFrames(
  scope: SoundDrawingScopeState,
  sampleRate: number,
): number {
  return resolveScopeCaptureFrames(
    Math.max(scope.timebase.secondsPerDisplay, scope.timebase.autoMaximumSeconds),
    scope.trigger.searchWindowSeconds,
    sampleRate,
  )
}

/** Stable reset boundary for phosphor history; excludes per-frame object identity. */
export function professionalScopeConfigurationIdentity(scope: SoundDrawingScopeState): string {
  // Continuous authored presentation automation (beam width, bloom, exposure,
  // persistence) must not clear the very history it is animating. Reset only
  // when signal meaning, preset identity, or phosphor colour changes.
  return JSON.stringify({
    presetId: scope.presetId,
    signal: professionalScopeSignalIdentity(scope),
    phosphorModel: scope.crt.phosphorModel,
    customPhosphorColor: scope.crt.customPhosphorColor,
  })
}

export function professionalScopeSignalIdentity(scope: SoundDrawingScopeState): string {
  return JSON.stringify({
    signalMode: scope.signalMode,
    signalConditioner: scope.signalConditioner,
    trigger: scope.trigger,
    timebase: scope.timebase,
    monoDelayMs: scope.monoDelayMs,
  })
}
