import type { Cinema2ModuleUpdateContext } from '../Cinema2ModuleContracts'
import { selectNightshiftAudio,resolveNightshiftPatternEvent } from '../nightshift/Cinema2NightshiftAudio'
import { switchItNumber,type SwitchItVisualControls } from './Cinema2SwitchItMotion'

export const SWITCH_IT_NEUTRAL_AUDIO={energy:0,bass:0,high:0,vocal:0,build:0,kick:0,snare:0,transient:0,drop:0} as const
export type SwitchItAudioDrive={-readonly [K in keyof typeof SWITCH_IT_NEUTRAL_AUDIO]:number}
const clamp=(v:number)=>Math.max(0,Math.min(1,v))
/** Delivery/permission gates only. Shared Choreography owns feature smoothing and event envelopes. */
export class Cinema2SwitchItAudio {
 private drive:SwitchItAudioDrive={...SWITCH_IT_NEUTRAL_AUDIO}
 private readonly seen=new Set<string>()
 private allowed={kick:false,snare:false,transient:false,drop:false}
 private track:string|null|undefined
 private source=''
 private generation=-1
 private audioGeneration=-1
 private lastTime:number|null=null
 private paused=false
 private resume=1
 private resumeFrom:SwitchItAudioDrive={...SWITCH_IT_NEUTRAL_AUDIO}
 update({frame,parameters:p}:Cinema2ModuleUpdateContext):SwitchItAudioDrive{
  const audio=selectNightshiftAudio(frame),track=frame.transport?.trackId??audio?.upstream.trackId
  const time=frame.transport?.timeSec??audio?.upstream.timeSec??0
  const source=audio?JSON.stringify([audio.upstream.sourceId,audio.upstream.publisherId,audio.upstream.analysisRevision,audio.upstream.timelineRevision]):this.source
  const reset=this.generation!==frame.contextGeneration||track!==this.track||(this.source!==''&&source!==this.source)||
   (this.lastTime!=null&&(time<this.lastTime-.05||time-this.lastTime>.75))||
   (audio?.discontinuity.occurred===true&&audio.discontinuity.reason!=='activation'&&audio.discontinuity.generation!==this.audioGeneration)
  if(reset){this.drive={...SWITCH_IT_NEUTRAL_AUDIO};this.seen.clear();this.allowed={kick:false,snare:false,transient:false,drop:false};this.resume=1}
  const paused=frame.transport?.paused===true,active=!frame.transport||frame.transport.playing&&!paused
  const response=switchItNumber(p,'response',.8)
  const eventFrame={...frame,audio,director:null,transport:frame.transport?{...frame.transport,playing:true,paused:false}:undefined}
  for(const kind of ['kick','snare','transient','drop'] as const){
   const transient=audio?.rhythm.transient
   const event=kind==='transient'?(transient&&audio&&transient.timeSec>=audio.upstream.timeSec-.25&&transient.timeSec<=audio.upstream.timeSec+.05?transient.id:null):resolveNightshiftPatternEvent(eventFrame,kind,reset?null:this.lastTime)
   if(event&&!this.seen.has(event)){this.seen.add(event);this.allowed[kind]=!reset&&active&&response>0}
  }
  while(this.seen.size>128)this.seen.delete(this.seen.values().next().value!)
  if(response===0){this.drive={...SWITCH_IT_NEUTRAL_AUDIO};this.allowed={kick:false,snare:false,transient:false,drop:false}}
  else if(paused&&frame.transport?.sourcePresent&&!reset){/* Hold facts when analysis stops publishing on pause. */}
  else if(!audio||!active){this.drive={...SWITCH_IT_NEUTRAL_AUDIO};this.allowed={kick:false,snare:false,transient:false,drop:false}}
  else{
   const value=(name:string,available:boolean)=>available?switchItNumber(p,name,0):0
   const target:SwitchItAudioDrive={
    energy:value('rawEnergy',audio.features.overallEnergy.available),bass:value('rawBass',audio.bands.bass.available),high:value('rawHigh',audio.bands.high.available),
    vocal:value('rawVocal',audio.features.vocalPresence.available),build:value('rawBuild',audio.features.buildProgress.available),
    kick:this.allowed.kick?value('musicKick',audio.capabilities.rhythmEvents):0,
    snare:this.allowed.snare?value('musicSnare',audio.capabilities.rhythmEvents):0,
    transient:this.allowed.transient?value('musicTransient',audio.capabilities.rhythmEvents):0,
    drop:this.allowed.drop?switchItNumber(p,'musicDrop',0):0,
   }
   if(this.paused&&!reset){this.resumeFrom={...this.drive};this.resume=0}
   this.resume=Math.min(1,this.resume+Math.max(0,frame.deltaTimeSec)/.08)
   for(const key of Object.keys(target) as (keyof SwitchItAudioDrive)[])this.drive[key]=this.resumeFrom[key]+(target[key]-this.resumeFrom[key])*this.resume
  }
  this.track=track;this.source=source;this.generation=frame.contextGeneration;this.lastTime=time;this.paused=paused
  if(audio)this.audioGeneration=audio.discontinuity.generation
  return{...this.drive}
 }
}
export function applySwitchItAudio(base:SwitchItVisualControls,drive:SwitchItAudioDrive,response:number):SwitchItVisualControls{
 const strength=clamp(response),vocal=drive.vocal*strength,restraint=1-.5*vocal
 const geometry=base.reach>0&&base.fragmentAmount>0?1:0
 return{...base,
  audioLift:geometry*strength*restraint*(.08*drive.energy+.22*drive.bass+.28*Math.max(drive.snare,drive.transient)),
  audioCrest:geometry*strength*restraint*(.18*drive.build+.45*drive.drop),
  audioGlint:.35*drive.high*strength,audioFlare:.25*drive.drop*strength,
  fragmentAmount:base.fragmentAmount*(1-.4*vocal),
  eyeIntensity:base.eyesEnabled?Math.min(2,base.eyeIntensity*(1+.35*drive.kick*strength)):0,
  columnIntensity:Math.min(2,base.columnIntensity*(1+strength*(.16*drive.energy+.2*drive.build+.2*drive.drop))),
 }
}
