import { cinema2Ref, cinema2StableId, type Cinema2CapabilityId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyContinuousSourcePath, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest, type Cinema2ChoreographySignal, type Cinema2ModuleId, type Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import type { HoneyAudioChannels, HoneyCueKind } from '../modules/honey/Cinema2HoneyAudio'

export const HONEY_AUDIO_ROUTES = [
  ['sub', 'audio.bands.sub', 'audio.bands'], ['bass', 'audio.bands.bass', 'audio.bands'],
  ['lowMid', 'audio.bands.lowMid', 'audio.bands'], ['mid', 'audio.bands.mid', 'audio.bands'],
  ['high', 'audio.bands.high', 'audio.bands'], ['air', 'audio.bands.air', 'audio.bands'],
  ['flux', 'audio.features.spectralFlux', 'audio.features'], ['energy', 'audio.features.overallEnergy', 'audio.features'],
  ['vocal', 'audio.features.vocalPresence', 'music.vocal-presence'], ['tension', 'audio.features.buildProgress', 'music.build'],
] as const satisfies readonly (readonly [keyof HoneyAudioChannels, Cinema2ChoreographyContinuousSourcePath, Cinema2CapabilityId])[]
export const HONEY_CUE_ROUTES = [
  ['kick', 'kick', 'music.rhythm-events'], ['snare', 'snare', 'music.rhythm-events'], ['beat', 'beat', 'music.beat'],
  ['downbeat', 'downbeat', 'music.downbeat'], ['bar', 'bar', 'music.bar'], ['phrase', 'phrase', 'music.phrase'],
  ['section', 'section-change', 'music.section'], ['build', 'build', 'music.build'], ['drop', 'drop', 'music.drop'],
] as const satisfies readonly (readonly [HoneyCueKind, Cinema2ChoreographySignal, Cinema2CapabilityId])[]

export function honeyAudioRules(moduleId: Cinema2ModuleId, cueId: Cinema2ParameterId): readonly Cinema2ChoreographyRuleManifest[] {
  return [
    ...HONEY_AUDIO_ROUTES.map(([property,path,capability],i): Cinema2ChoreographyRuleManifest => ({
      id: cinema2StableId<Cinema2ChoreographyRuleId>(`honey-audio-${property.toLowerCase()}`), priority: 10+i,
      source: { signal:'continuous',path,capability },
      actions: [{ id:cinema2StableId<Cinema2ChoreographyActionId>(`honey-map-${property.toLowerCase()}`),target:{kind:'module',ref:cinema2Ref(moduleId),property},operation:'replace',value:1 }],
    })),
    ...HONEY_CUE_ROUTES.map(([kind,signal,capability],i): Cinema2ChoreographyRuleManifest => ({
      id:cinema2StableId<Cinema2ChoreographyRuleId>(`honey-event-${kind}`),priority:30+i,
      source:{signal,capability,...(kind==='build'?{threshold:.6}:{})},
      ...(['beat','downbeat','bar','phrase'].includes(kind)?{conditions:[{kind:'not-silent' as const}]}:{}),
      actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`honey-cue-${kind}`),target:{kind:'parameter',ref:cinema2Ref(cueId)},operation:'spawn',value:{kind}}],
    })),
  ]
}
