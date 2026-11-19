import {cinema2Ref,cinema2StableId,type Cinema2ModuleId,type Cinema2ParameterId,type Cinema2ChoreographyRuleManifest,type Cinema2ChoreographyRuleId,type Cinema2ChoreographyActionId,type Cinema2ChoreographyContinuousSourcePath,type Cinema2CapabilityId} from '../contracts/Cinema2NativePresetManifest'
import type {Cinema2MoodDrive} from './Cinema2MoodConductorAuthoring'
export function moireOrbPerformance(module:Cinema2ModuleId,pid:(name:string)=>Cinema2ParameterId){
 const target=(property:string)=>({kind:'module' as const,ref:cinema2Ref(module),property})
 const continuous=(name:string,capability:Cinema2CapabilityId,path:Cinema2ChoreographyContinuousSourcePath,property:string,factor:number):Cinema2ChoreographyRuleManifest=>({
  id:cinema2StableId<Cinema2ChoreographyRuleId>(`moire-orb-${name}`),priority:20,strengthParameter:cinema2Ref(pid('reactivity')),
  source:{signal:'continuous',capability,path,clamp:[0,1],smoothingMs:150},actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`moire-orb-${name}-drive`),target:target(property),operation:'multiply',value:factor}],
 })
 const accent=(signal:'kick'|'snare'|'drop',property:string,factor:number,release:number):Cinema2ChoreographyRuleManifest=>({
  id:cinema2StableId<Cinema2ChoreographyRuleId>(`moire-orb-${signal}-${property.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)}`),priority:30,strengthParameter:cinema2Ref(pid('reactivity')),
  source:{signal,capability:signal==='drop'?'music.drop':'music.rhythm-events'},conditions:[{kind:'once-per-event'},...(signal==='drop'?[]:[{kind:'not-silent' as const}])],
  actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`moire-orb-${signal}-${property.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)}-accent`),target:target(property),operation:'envelope',composition:'multiply',value:factor,envelope:{attack:.015,hold:.035,release,unit:'seconds'},retrigger:'restart'}],
 })
 const rules: Cinema2ChoreographyRuleManifest[]=[
  continuous('bass-compression','audio.bands','audio.bands.bass','coreScale',.93),
  continuous('energy-motion','audio.features','audio.features.overallEnergy','motionRate',1.3),
  continuous('high-shimmer','audio.bands','audio.bands.high','ringLighting',1.2),
  continuous('vocal-restraint','music.vocal-presence','audio.features.vocalPresence','fixtureLighting',.6),
  accent('kick','ringLighting',1.45,.25),accent('snare','fixtureLighting',1.5,.22),accent('snare','chamberLighting',1.45,.3),accent('kick','coreDetailLighting',1.35,.24),accent('drop','ringTravel',1.4,1.5),accent('drop','coreScale',1.12,1.25),
  {...continuous('director-beams','visual-director.significance','director.intensity','beamWidth',1.18),enabledParameter:cinema2Ref(pid('autoPerformance'))},
 ]
 const drive=(id:string,property:string,source:Cinema2MoodDrive['source'],value:number):Cinema2MoodDrive=>({id,target:target(property),source,operation:'multiply',value})
 const drives: Cinema2MoodDrive[]=[drive('calm-rate','motionRate','mood.calm',.6),drive('calm-fixtures','fixtureSpeed','mood.calm',.6),drive('calm-light','fixtureLighting','mood.calm',.7),drive('momentum','motionRate','mood.momentum',1.25),drive('energy-rate','motionRate','mood.energy',1.18),drive('energy-travel','ringTravel','mood.energy',1.35),drive('drive-heads','fixtureSpeed','mood.drive',1.25),drive('build-layers','layerSeparation','mood.build',.65),drive('peak-core','coreGlow','mood.peak',1.3),drive('activity-cells','chamberLighting','mood.activity',1.3),drive('peak-electrodes','coreDetailLighting','mood.peak',1.3),drive('shock-rings','ringLighting','mood.shock',1.4)]
 for(const name of ['motionRate','fixtureSpeed','intensity','coreGlow','ringLighting','fixtureLighting','chamberLighting','coreDetailLighting','haze'])drives.push(drive(`silence-${name.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)}`,name,'mood.silence',.1))
 return {rules,drives}
}
