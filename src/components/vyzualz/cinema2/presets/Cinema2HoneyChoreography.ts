import { cinema2Ref, cinema2StableId, type Cinema2CameraId, type Cinema2Vector3, type Cinema2CapabilityId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyContinuousSourcePath, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest, type Cinema2ChoreographySignal, type Cinema2ModuleId, type Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import type { HoneyAudioChannels, HoneyCueKind } from '../modules/honey/Cinema2HoneyAudio'

export const HONEY_AUDIO_ROUTES = [
  ['sub', 'audio.bands.sub', 'audio.bands'], ['bass', 'audio.bands.bass', 'audio.bands'],
  ['lowMid', 'audio.bands.lowMid', 'audio.bands'], ['mid', 'audio.bands.mid', 'audio.bands'],
  ['high', 'audio.bands.high', 'audio.bands'], ['air', 'audio.bands.air', 'audio.bands'],
  ['flux', 'audio.features.spectralFlux', 'audio.features'], ['energy', 'audio.features.overallEnergy', 'audio.features'],
  ['vocal', 'audio.features.vocalPresence', 'music.vocal-presence'], ['tension', 'audio.features.buildProgress', 'music.build'],
] as const satisfies readonly (readonly [keyof HoneyAudioChannels, Cinema2ChoreographyContinuousSourcePath, Cinema2CapabilityId])[]
export const HONEY_DIRECTOR_ROUTES=[
  ['directorIntensity','director.intensity'],['directorBuild','director.build'],['directorImpact','director.impact'],
] as const satisfies readonly (readonly [keyof import('../modules/honey/Cinema2HoneyPerformance').HoneyDirectorChannels,Cinema2ChoreographyContinuousSourcePath])[]
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
    ...HONEY_DIRECTOR_ROUTES.map(([property,path],i):Cinema2ChoreographyRuleManifest=>({
      id:cinema2StableId<Cinema2ChoreographyRuleId>(`honey-director-${i}`),priority:20+i,
      source:{signal:'continuous',path,capability:'visual-director.significance'},
      actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`honey-director-map-${i}`),target:{kind:'module',ref:cinema2Ref(moduleId),property},operation:'replace',value:1}],
    })),
    ...HONEY_CUE_ROUTES.map(([kind,signal,capability],i): Cinema2ChoreographyRuleManifest => ({
      id:cinema2StableId<Cinema2ChoreographyRuleId>(`honey-event-${kind}`),priority:30+i,
      source:{signal,capability,...(kind==='build'?{threshold:.6}:{})},
      ...(['beat','downbeat','bar','phrase','build'].includes(kind)?{conditions:[{kind:'not-silent' as const}]}:{}),
      actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`honey-cue-${kind}`),target:{kind:'parameter',ref:cinema2Ref(cueId)},operation:'spawn',value:{kind}}],
    })),
  ]
}

/** Shared Director/section/event routes. Strength is the saved normalized camera
 * amount; master motion, OFF and Reduced are enforced by the shared camera runtime.
 * No transport clock or local musical detector is introduced here. */
export function honeyCameraRules(cameraId:Cinema2CameraId,autoId:Cinema2ParameterId,amountId:Cinema2ParameterId): readonly Cinema2ChoreographyRuleManifest[] {
  const target={kind:'camera' as const,ref:cinema2Ref(cameraId),property:'transform.position'}
  const rule=(name:string,priority:number,source:Cinema2ChoreographyRuleManifest['source'],value:Cinema2Vector3,conditions:Cinema2ChoreographyRuleManifest['conditions']=[]):Cinema2ChoreographyRuleManifest=>({
    id:cinema2StableId<Cinema2ChoreographyRuleId>(`honey-camera-${name}`),priority,
    enabledParameter:cinema2Ref(autoId),strengthParameter:cinema2Ref(amountId),source,conditions,
    actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`honey-shot-${name}`),target,operation:'add',value}],
  })
  const drop=rule('drop',115,{signal:'drop',capability:'music.drop'},[.65,-.35,-2.9],[{kind:'once-per-event'}])
  return [
    rule('build',110,{signal:'continuous',path:'director.build',capability:'visual-director.significance',clamp:[0,1],smoothingMs:650},[.8,-.25,-2.1],[{kind:'not-silent'}]),
    rule('breakdown',111,{signal:'continuous',path:'director.intensity',capability:'visual-director.significance',scale:0,offset:1},[-.9,.6,2.7],[{kind:'capability',capability:'music.section'},{kind:'section-type',values:['breakdown']}]),
    {...drop,actions:[{...drop.actions[0]!,operation:'envelope',composition:'add',envelope:{attack:.45,hold:.65,release:2.6,unit:'seconds'},retrigger:'restart'}]},
  ]
}
