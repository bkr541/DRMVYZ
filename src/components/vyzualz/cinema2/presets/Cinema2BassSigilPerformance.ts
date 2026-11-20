import { cinema2Ref, cinema2StableId, type Cinema2ChoreographyRuleManifest, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyActionId, type Cinema2ModuleId, type Cinema2ParameterId, type Cinema2ChoreographyContinuousSourcePath } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2MoodDrive } from './Cinema2MoodConductorAuthoring'

export const BASS_SIGIL_SCORE_CHANNELS = ['modelPulse','shellTwist','shellRelease'] as const
export function bassSigilPerformance(moduleId: Cinema2ModuleId, pid: (name:string)=>Cinema2ParameterId) {
  const target=(property:string)=>({kind:'module' as const,ref:cinema2Ref(moduleId),property})
  const nonzero=(name:string)=>({kind:'parameter-not-equals' as const,parameterId:pid(name),value:0})
  const cue=(signal:'kick'|'snare'|'drop',property:string,delay:number,release:number):Cinema2ChoreographyRuleManifest=>({
    id:cinema2StableId<Cinema2ChoreographyRuleId>(`bass-sigil-score-${signal}-${property.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)}`),priority:40,
    strengthParameter:cinema2Ref(pid('reactivity')),enabledWhen:[nonzero('scoreAmount')],
    source:{signal,capability:signal==='drop'?'music.drop':'music.rhythm-events'},
    conditions:[{kind:'once-per-event'},...(signal==='drop'?[]:[{kind:'not-silent' as const}])],
    actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`bass-sigil-score-${property.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)}-cue`),target:target(property),operation:'envelope',composition:'replace',value:1,delayBeats:delay,envelope:{attack:.015,hold:.035,release,unit:'seconds'},retrigger:'restart'}],
  })
  const director=(name:string,path:Cinema2ChoreographyContinuousSourcePath,property:string,factor:number):Cinema2ChoreographyRuleManifest=>({
    id:cinema2StableId<Cinema2ChoreographyRuleId>(`bass-sigil-director-${name}`),priority:55,enabledParameter:cinema2Ref(pid('autoPerformance')),strengthParameter:cinema2Ref(pid('reactivity')),
    enabledWhen:[nonzero(property)],source:{signal:'continuous',capability:'visual-director.significance',path,clamp:[0,1]},
    actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`bass-sigil-director-${name}-drive`),target:target(property),operation:'multiply',value:factor}],
  })
  const rules=[cue('kick','modelPulse',0,.24),cue('snare','shellTwist',0,.35),cue('drop','shellRelease',0,1.4),director('extent','director.intensity','geometryExtent',1.18),director('sway','director.momentum','logoSway',1.15)]
  const drives: Cinema2MoodDrive[]=[
    {id:'calm-rate',target:target('motionRate'),source:'mood.calm',operation:'multiply',value:.65},
    {id:'calm-travel',target:target('coreTravel'),source:'mood.calm',operation:'multiply',value:.55},
    {id:'calm-light',target:target('intensity'),source:'mood.calm',operation:'multiply',value:.8},
    {id:'rate',target:target('motionRate'),source:'mood.momentum',operation:'multiply',value:1.3},
    {id:'extent',target:target('geometryExtent'),source:'mood.energy',operation:'multiply',value:1.5},
    {id:'travel',target:target('coreTravel'),source:'mood.drive',operation:'multiply',value:1.4},
    {id:'depth',target:target('tunnelDepth'),source:'mood.build',operation:'multiply',value:.85},
    {id:'density',target:target('particleDensity'),source:'mood.activity',operation:'multiply',value:1.12},
    {id:'glow',target:target('glow'),source:'mood.peak',operation:'multiply',value:1.25},
    {id:'opacity',target:target('membraneOpacity'),source:'mood.tense',operation:'multiply',value:.8},
  ]
  for(const name of ['motionRate','coreTravel','particleDensity','intensity','glow'])drives.push({id:`silence-${name.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)}`,target:target(name),source:'mood.silence',operation:'multiply',value:.1})
  return {rules,drives}
}
