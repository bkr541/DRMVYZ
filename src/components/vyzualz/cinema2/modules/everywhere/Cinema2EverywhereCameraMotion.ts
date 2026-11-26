import {cinema2Ref,cinema2StableId,type Cinema2CameraId,type Cinema2ParameterId,type Cinema2ChoreographyRuleId,type Cinema2ChoreographyActionId,type Cinema2ChoreographyRuleManifest,type Cinema2JsonValue,type Cinema2ParameterConditionManifest} from '../../contracts/Cinema2NativePresetManifest'
import type { EverywherePattern } from './Cinema2EverywhereWall'
const pid=(name:string)=>cinema2StableId<Cinema2ParameterId>(`everywhere-${name}`)
const ref=(name:string)=>cinema2Ref(pid(name))
const eq=(name:string,value:Cinema2JsonValue):Cinema2ParameterConditionManifest=>({kind:'parameter-equals',parameterId:pid(name),value})
const ne=(name:string,value:Cinema2JsonValue):Cinema2ParameterConditionManifest=>({kind:'parameter-not-equals',parameterId:pid(name),value})
const profiles:Record<EverywherePattern,readonly [number,number,number,number]>= {
  'all-eyes':[.35,.1,-.15,.2],'signal-sweep':[1.5,.05,-.3,.15],'outward-pulse':[0,.18,-1.1,.1],
  'cross-cut':[-1.2,.65,-.4,-.6],'channel-hold':[1.2,.2,-.45,.2],'ghost-feed':[-.6,.1,-.25,.8],
  'static-switch':[.1,.04,-.8,.35],'retro-broadcast':[.4,.12,-.2,.35],'tape-tracking':[.2,.65,-.35,-.6],
  'channel-mosaic':[-1.4,.3,.2,.25],'signal-relay':[1.3,-.3,-.35,.4],'midnight-replay':[0,.04,-1.3,.05],
}
export function everywhereCameraProfileRules(camera:Cinema2CameraId):Cinema2ChoreographyRuleManifest[] {
  const target=(property:string)=>({kind:'camera' as const,ref:cinema2Ref(camera),property})
  const action=(name:string,property:string,value:Cinema2JsonValue)=>({id:cinema2StableId<Cinema2ChoreographyActionId>(`everywhere-camera-${name}`),target:target(property),operation:'add' as const,value})
  const envelope=(name:string,property:string,value:Cinema2JsonValue,hold:number,release:number)=>({...action(name,property,value),operation:'envelope' as const,composition:'add' as const,envelope:{attack:.12,hold,release,unit:'seconds' as const},retrigger:'restart' as const})
  const base=(name:string,enabledWhen:readonly Cinema2ParameterConditionManifest[],strength='camera-impact')=>({id:cinema2StableId<Cinema2ChoreographyRuleId>(`everywhere-camera-${name}`),priority:100,enabledParameter:ref('camera-motion'),strengthParameter:ref(strength),enabledWhen})
  const music=[eq('auto-performance',true),ne('camera-mode','gentle')]
  const rules:Cinema2ChoreographyRuleManifest[]=[
    {...base('build',music),source:{signal:'continuous',path:'director.build',capability:'visual-director.significance',smoothingMs:250},actions:[action('build-dolly','transform.position',[0,.06,-1.6]),action('build-lens','fovDegrees',-2)]},
    {...base('drop',music),source:{signal:'drop',capability:'music.drop'},conditions:[{kind:'once-per-event'}],actions:[envelope('drop-dolly','transform.position',[0,.04,-4.2],.45,2.6),envelope('drop-lens','fovDegrees',-8,.45,2.6)]},
    {...base('vocal',music),source:{signal:'continuous',path:'audio.features.vocalPresence',capability:'audio.features',smoothingMs:240},actions:[action('vocal-wide','transform.position',[0,0,.35])]},
    {...base('reveal',[...music,ne('camera-mode','pattern')]),source:{signal:'phrase',capability:'music.phrase'},conditions:[{kind:'once-per-event'}],actions:[envelope('reveal-wide','transform.position',[0,0,.6],.3,1.4)]},
    {...base('hero',[eq('camera-mode','hero')]),source:{signal:'continuous',path:'audio.features.overallEnergy',capability:'audio.features',smoothingMs:240},actions:[action('hero-push','transform.position',[0,0,-1.4])]},
    {...base('explore',[eq('camera-mode','explore')]),source:{signal:'phrase',capability:'music.phrase'},conditions:[{kind:'once-per-event'}],actions:[envelope('explore-track','transform.position',[1.5,.3,-.35],.5,2.4)]},
    {...base('kick',[eq('kick-zoom',true),ne('camera-mode','gentle')]),source:{signal:'kick',capability:'music.rhythm-events'},conditions:[{kind:'once-per-event'},{kind:'not-silent'}],actions:[envelope('kick-lens','fovDegrees',-1.5,.025,.2)]},
    {...base('roll',[ne('camera-mode','gentle')],'camera-roll'),source:{signal:'snare',capability:'music.rhythm-events'},conditions:[{kind:'once-per-event'}],actions:[envelope('analog-roll','roll',1.5,.1,.65)]},
  ]
  for(const [pattern,[x,y,z,roll]] of Object.entries(profiles)) {
    const conditions=[eq('pattern',pattern),eq('camera-follow',true),ne('camera-mode','gentle'),ne('camera-mode','hero')]
    rules.push({...base(`track-${pattern}`,conditions),source:{signal:'phrase',capability:'music.phrase'},conditions:[{kind:'once-per-event'}],actions:[envelope(`track-${pattern}`,'transform.position',[x,y,z],.35,2),envelope(`focus-${pattern}`,'target',[x*.45,y*.3,0],.35,2)]})
    rules.push({...base(`roll-${pattern}`,conditions,'camera-roll'),source:{signal:'snare',capability:'music.rhythm-events'},conditions:[{kind:'once-per-event'}],actions:[envelope(`roll-${pattern}`,'roll',roll,.07,.5)]})
  }
  return rules
}
