import { cinema2Ref, cinema2StableId, type Cinema2ModuleId, type Cinema2ChoreographyRuleManifest } from '../contracts/Cinema2NativePresetManifest'

export const INERTIA_AUDIO_CHANNELS = {
  energyMotion: 0, bassPressure: 0, pointSparkle: 0, vocalRestraint: 0, buildCompression: 0,
  kickDisplacement: 0, shearAccent: 0, transientAccent: 0, dropRelease: 0,
  corePulse: 0, kickRecovery: 0, snareRecovery: 0, transientRecovery: 0, dropRecovery: 0,
  directorIntensity: 0, directorMomentum: 0, directorBuild: 0, directorImpact: 0,
} as const
export type InertiaAudioChannel = keyof typeof INERTIA_AUDIO_CHANNELS

/** All cue stages use the shared envelope runtime; no preset-local event clock. */
export const INERTIA_CUE_PROFILES = [
  { signal: 'kick', stages: [
    { property: 'kickDisplacement', attack: 0.015, hold: 0.025, release: 0.160 },
    { property: 'corePulse', attack: 0.015, hold: 0.010, release: 0.180 },
    { property: 'kickRecovery', attack: 0.200, hold: 0, release: 0.180 },
  ] },
  { signal: 'snare', stages: [
    { property: 'shearAccent', attack: 0.010, hold: 0.015, release: 0.180 },
    { property: 'snareRecovery', attack: 0.205, hold: 0, release: 0.160 },
  ] },
  { signal: 'transient', stages: [
    { property: 'transientAccent', attack: 0.010, hold: 0.015, release: 0.180 },
    { property: 'transientRecovery', attack: 0.205, hold: 0, release: 0.160 },
  ] },
  { signal: 'drop', stages: [
    { property: 'dropRelease', attack: 0.020, hold: 0.060, release: 0.420 },
    { property: 'dropRecovery', attack: 0.500, hold: 0, release: 0.350 },
  ] },
] as const

export const INERTIA_RESPONSE_LIMITS = {
  bass: 0.025, build: 0.035, kick: 0.035, core: 0.035, shear: 0.025, drop: 0.050,
  kickRecovery: 0.012, shearRecovery: 0.009, dropRecovery: 0.015, radialBudget: 0.060,
} as const

export function inertiaAudioRoutes(module: Cinema2ModuleId): readonly Cinema2ChoreographyRuleManifest[] {
  const continuous = [
    ['energyMotion', 'audio.features.overallEnergy', 'audio.features', 180],
    ['bassPressure', 'audio.bands.bass', 'audio.bands', 100],
    ['pointSparkle', 'audio.bands.high', 'audio.bands', 70],
    ['vocalRestraint', 'audio.features.vocalPresence', 'music.vocal-presence', 220],
    ['buildCompression', 'audio.features.buildProgress', 'music.build', 220],
    ['directorIntensity', 'director.intensity', 'visual-director.significance', 180],
    ['directorMomentum', 'director.momentum', 'visual-director.significance', 220],
    ['directorBuild', 'director.build', 'visual-director.significance', 200],
    ['directorImpact', 'director.impact', 'visual-director.significance', 90],
  ] as const
  return [
    ...continuous.map(([property, path, capability, smoothingMs], i): Cinema2ChoreographyRuleManifest => ({
      id: cinema2StableId(`inertia-${property.toLowerCase()}-route`), priority: 10 + i,
      source: { signal: 'continuous', path, capability, smoothingMs, clamp: [0, 1] },
      actions: [{ id: cinema2StableId(`inertia-${property.toLowerCase()}-value`), target: { kind: 'module', ref: cinema2Ref(module), property }, operation: 'replace' }],
    })),
    ...INERTIA_CUE_PROFILES.map(({ signal, stages }): Cinema2ChoreographyRuleManifest => ({
      id: cinema2StableId(`inertia-${signal}-delivery`), priority: 30,
      source: { signal, capability: signal === 'drop' ? 'music.drop' : 'music.rhythm-events' },
      conditions: [{ kind: 'once-per-event' }, { kind: 'confidence', min: 0.45 }],
      actions: stages.map(({ property, attack, hold, release }, i) => ({
        id: cinema2StableId(i === 0 ? `inertia-${signal}-initial-accent` : `inertia-${signal}-${property.toLowerCase()}`),
        target: { kind: 'module', ref: cinema2Ref(module), property },
        operation: 'envelope', composition: 'replace', value: 1, retrigger: 'restart', envelope: { attack, hold, release, unit: 'seconds' },
      })),
    })),
  ]
}
