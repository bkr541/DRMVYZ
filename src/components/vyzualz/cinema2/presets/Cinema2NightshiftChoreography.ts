import { cinema2Ref, cinema2StableId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest, type Cinema2ModuleId } from '../contracts/Cinema2NativePresetManifest'

/** Raw delivery targets are transient. User controls are applied downstream. */
export const NIGHTSHIFT_CHOREOGRAPHY_DEFAULTS = { audioEnergy: 1, bassPressure: 0, highGlint: 0, vocalRestraint: 0, buildPressure: 0,
  directorIntensity: 1, directorMomentum: 0, directorBuild: 0, directorImpact: 0 }
export type NightshiftAudioChannels = typeof NIGHTSHIFT_CHOREOGRAPHY_DEFAULTS
export const NIGHTSHIFT_AUDIO_ROUTES = [
  ['audioEnergy', 'audio.features.overallEnergy', 'audio.features', 180],
  ['bassPressure', 'audio.bands.bass', 'audio.bands', 160],
  ['highGlint', 'audio.bands.high', 'audio.bands', 120],
  ['vocalRestraint', 'audio.features.vocalPresence', 'music.vocal-presence', 300],
  ['buildPressure', 'audio.features.buildProgress', 'music.build', 300],
] as const
export const NIGHTSHIFT_DIRECTOR_ROUTES = [
  ['directorIntensity', 'director.intensity', 'visual-director.significance', 240],
  ['directorMomentum', 'director.momentum', 'visual-director.significance', 320],
  ['directorBuild', 'director.build', 'visual-director.significance', 300],
  // Event authority is sampled without smoothing; its fresh identity owns one
  // native 700 ms envelope, including when visual delta is zero at publication.
  ['directorImpact', 'director.impact', 'visual-director.significance', 0],
] as const
export const NIGHTSHIFT_CHOREOGRAPHY_ROUTES = [...NIGHTSHIFT_AUDIO_ROUTES, ...NIGHTSHIFT_DIRECTOR_ROUTES]

export function nightshiftAudioRules(moduleId: Cinema2ModuleId): readonly Cinema2ChoreographyRuleManifest[] {
  return NIGHTSHIFT_CHOREOGRAPHY_ROUTES.map(([property, path, capability, smoothingMs], index) => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`nightshift-${property.toLowerCase()}-route`), priority: 10 + index,
    source: { signal: 'continuous', path, capability, clamp: [0, 1], smoothingMs },
    actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`nightshift-${property.toLowerCase()}-map`),
      target: { kind: 'module', ref: cinema2Ref(moduleId), property }, operation: 'replace' }],
  }))
}
