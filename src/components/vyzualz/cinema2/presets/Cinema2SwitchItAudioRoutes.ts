import { cinema2StableId,cinema2Ref,type Cinema2ModuleId,type Cinema2ChoreographyRuleManifest } from '../contracts/Cinema2NativePresetManifest'
export const SWITCH_IT_AUDIO_CHANNELS={rawEnergy:0,rawBass:0,rawHigh:0,rawVocal:0,rawBuild:0,musicKick:0,musicSnare:0,musicTransient:0,musicDrop:0} as const
export const SWITCH_IT_AUDIO_ROUTES=[
 ['rawEnergy','audio.features.overallEnergy','audio.features',180],
 ['rawBass','audio.bands.bass','audio.bands',140],
 ['rawHigh','audio.bands.high','audio.bands',90],
 ['rawVocal','audio.features.vocalPresence','music.vocal-presence',260],
 ['rawBuild','audio.features.buildProgress','music.build',260],
] as const
export function switchItInitialAudioRules(module:Cinema2ModuleId):readonly Cinema2ChoreographyRuleManifest[]{
 return[
  ...SWITCH_IT_AUDIO_ROUTES.map(([property,path,capability,smoothingMs],i):Cinema2ChoreographyRuleManifest=>({
   id:cinema2StableId(`switch-it-${property.toLowerCase()}-route`),priority:10+i,
   source:{signal:'continuous',path,capability,smoothingMs,clamp:[0,1]},
   actions:[{id:cinema2StableId(`switch-it-${property.toLowerCase()}-map`),target:{kind:'module',ref:cinema2Ref(module),property},operation:'replace'}],
  })),
  ...(['kick','snare','transient','drop'] as const).map((signal):Cinema2ChoreographyRuleManifest=>({
   id:cinema2StableId(`switch-it-${signal}-initial-event`),priority:30,
   source:{signal,capability:signal==='drop'?'music.drop':'music.rhythm-events'},conditions:[{kind:'once-per-event'},{kind:'confidence',min:.45}],
   actions:[{id:cinema2StableId(`switch-it-${signal}-initial-accent`),target:{kind:'module',ref:cinema2Ref(module),property:`music${signal[0].toUpperCase()}${signal.slice(1)}`},operation:'envelope',composition:'add',value:1,retrigger:'restart',
    envelope:{attack:signal==='drop'?.02:.015,hold:signal==='drop'?.04:0,release:signal==='drop'?.55:signal==='snare'||signal==='transient'?.18:.14,unit:'seconds'}}],
  })),
 ]
}
