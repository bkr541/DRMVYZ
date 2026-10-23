import { cinema2Ref, cinema2StableId, type Cinema2CapabilityId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyContinuousSourcePath, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest, type Cinema2ChoreographySignal, type Cinema2ModuleId, type Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2BlockshiftAudioChannels, Cinema2BlockshiftCue } from '../modules/blockshift/Cinema2BlockshiftAudio'

export const CINEMA2_BLOCKSHIFT_AUDIO_ROUTES = [
  ['subPressure', 'audio.bands.sub', 'audio.bands'], ['bassPressure', 'audio.bands.bass', 'audio.bands'],
  ['midTilt', 'audio.bands.mid', 'audio.bands'], ['highGlint', 'audio.bands.high', 'audio.bands'],
  ['spectralGlint', 'audio.features.spectralFlux', 'audio.features'], ['audioEnergy', 'audio.features.overallEnergy', 'audio.features'],
  ['vocalRestraint', 'audio.features.vocalPresence', 'music.vocal-presence'], ['buildTension', 'audio.features.buildProgress', 'music.build'],
] as const satisfies readonly (readonly [keyof Cinema2BlockshiftAudioChannels, Cinema2ChoreographyContinuousSourcePath, Cinema2CapabilityId])[]
const directorRoutes = [['directorIntensity', 'director.intensity'], ['directorBuild', 'director.build'], ['directorImpact', 'director.impact']] as const
const cues = [
  ['kick', 'kick', 'music.rhythm-events'], ['snare', 'snare', 'music.rhythm-events'], ['beat', 'beat', 'music.beat'],
  ['downbeat', 'downbeat', 'music.downbeat'], ['bar', 'bar', 'music.bar'], ['phrase', 'phrase', 'music.phrase'],
  ['section', 'section-change', 'music.section'], ['drop', 'drop', 'music.drop'], ['build', 'build', 'music.build'],
] as const satisfies readonly (readonly [Cinema2BlockshiftCue | 'build', Cinema2ChoreographySignal, Cinema2CapabilityId])[]

export function blockshiftAudioRules(moduleId: Cinema2ModuleId, cueId: Cinema2ParameterId): readonly Cinema2ChoreographyRuleManifest[] {
  return [
    ...CINEMA2_BLOCKSHIFT_AUDIO_ROUTES.map(([property, path, capability], index): Cinema2ChoreographyRuleManifest => ({
      id: cinema2StableId<Cinema2ChoreographyRuleId>(`blockshift-audio-${index}`), priority: 10 + index,
      source: { signal: 'continuous', path, capability },
      actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`blockshift-map-${index}`), target: { kind: 'module', ref: cinema2Ref(moduleId), property }, operation: 'replace', value: 1 }],
    })),
    ...directorRoutes.map(([property, path], index): Cinema2ChoreographyRuleManifest => ({
      id: cinema2StableId<Cinema2ChoreographyRuleId>(`blockshift-director-${index}`), priority: 20 + index,
      source: { signal: 'continuous', path, capability: 'visual-director.significance' },
      actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`blockshift-director-map-${index}`), target: { kind: 'module', ref: cinema2Ref(moduleId), property }, operation: 'replace', value: 1 }],
    })),
    ...cues.map(([kind, signal, capability], index): Cinema2ChoreographyRuleManifest => ({
      id: cinema2StableId<Cinema2ChoreographyRuleId>(`blockshift-${kind}-event`), priority: 30 + index,
      source: { signal, capability, ...(kind === 'build' ? { threshold: 0.6 } : {}) },
      actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`blockshift-${kind}-cue`), target: { kind: 'parameter', ref: cinema2Ref(cueId) }, operation: 'spawn', value: { kind } }],
    })),
  ]
}
