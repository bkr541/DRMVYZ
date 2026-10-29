import type { Cinema2ModuleUpdateContext } from '../Cinema2ModuleContracts'
import { selectNightshiftAudio,resolveNightshiftPatternEvent } from '../nightshift/Cinema2NightshiftAudio'
import { Cinema2SwitchItMotion,mixSwitchItPose,sampleSwitchItProgram,switchItNumber,type SwitchItPattern,type SwitchItPose,type SwitchItVisualControls } from './Cinema2SwitchItMotion'
import type { SwitchItAudioDrive } from './Cinema2SwitchItAudio'
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v))
/** Presentation-only macro interpretation. Pattern/Trigger state remains owned by the existing base controller. */
export class Cinema2SwitchItPerformance {
 private readonly seen=new Set<string>()
 private epoch=-1
 private source=''
 private patternRevision=-1
 private revealRevision=-1
 private auto=false
 private blockedBuild=false
 private override:'build'|'drop'|null=null
 private overrideStart=0
 private overrideEnd=0
 private acceptedImpact=false
 private macro={intensity:0,momentum:0,build:0,accent:0}
 private from=sampleSwitchItProgram('switch-cycle',0)
 private blend=1
 private token=''
 private allowPaused=false
 private previousTime:number|null=null
 private previousTimestamp:number|null=null
 pose=this.from
 state={basePattern:'switch-cycle' as SwitchItPattern,visiblePattern:'switch-cycle' as SwitchItPattern,override:null as 'build'|'drop'|null,directorAvailable:false}
 update(update:Cinema2ModuleUpdateContext,motion:Cinema2SwitchItMotion,drive:SwitchItAudioDrive,controls:SwitchItVisualControls):SwitchItVisualControls{
  const {frame,parameters:p}=update,audio=selectNightshiftAudio(frame),director=frame.director
  const source=audio?JSON.stringify([audio.upstream.sourceId,audio.upstream.publisherId,audio.upstream.analysisRevision,audio.upstream.timelineRevision]):this.source
  const reset=motion.state.epoch!==this.epoch||source!==this.source
  const active=!frame.transport||frame.transport.playing&&!frame.transport.paused,paused=frame.transport?.paused===true
  const valid=!!audio&&!!director&&director.visualFrameId===audio.visualFrameId&&director.discontinuityGeneration===audio.discontinuity.generation
  const response=switchItNumber(p,'response',.8),influence=switchItNumber(p,'directorStrength',.35)
  const read=(key:string,available:boolean)=>available?switchItNumber(p,key,0):0
  const build=audio?Math.max(drive.build,valid?read('directorBuild',director!.context.build.available):0):0
  const revision=p.getEditRevision?.('pattern')??0,reveal=p.getEditRevision?.('reveal')??0
  const manualPattern=this.patternRevision!==-1&&revision!==this.patternRevision,manualReveal=this.revealRevision!==-1&&reveal!==this.revealRevision
  const auto=p.get('autoPerformance')===true,autoChanged=auto!==this.auto
  if(reset){this.seen.clear();this.override=null;this.acceptedImpact=false;this.macro={intensity:0,momentum:0,build:0,accent:0};this.blockedBuild=build>.45;this.blend=1}
  if(build<.45)this.blockedBuild=false
  if(autoChanged&&auto&&!reset)this.blockedBuild=build>.45
  const impact=valid&&director!.authority.impact.available&&director!.authority.impact.occurred&&(director!.authority.impact.confidence??0)>=.45?director!.authority.impact.eventIds.join('|'):null
  const eventFrame={...frame,audio,director:null,transport:frame.transport?{...frame.transport,playing:true,paused:false}:undefined}
  const drop=resolveNightshiftPatternEvent(eventFrame,'drop',reset?null:this.previousTime)
  // Structural crossings require advancing time; still consume current held/reset identities.
  if((reset||!active)&&audio?.structure.semanticMoments.available)for(const moment of audio.structure.semanticMoments.value??[]){
   if((moment.type==='drop'||moment.type==='drop_impact')&&Math.abs(moment.timeSec-audio.upstream.timeSec)<.25)this.seen.add('drop:'+moment.id)
  }
  const freshImpact=!!impact&&!this.seen.has('impact:'+impact),freshDrop=!!drop&&!this.seen.has('drop:'+drop)
  if(impact)this.seen.add('impact:'+impact);if(drop)this.seen.add('drop:'+drop)
  while(this.seen.size>128)this.seen.delete(this.seen.values().next().value!)
  if(freshImpact)this.acceptedImpact=!reset&&active&&response>0&&influence>0
  if(response===0||influence===0)this.acceptedImpact=false
  if(valid&&active){this.macro={intensity:read('directorIntensity',director!.continuous.intensity.available),momentum:read('directorMomentum',director!.continuous.momentum.available),build:read('directorBuild',director!.context.build.available),accent:this.acceptedImpact?switchItNumber(p,'directorAccent',0):0}}
  else if(!paused||reset)this.macro={intensity:0,momentum:0,build:0,accent:0}
  if(manualPattern||manualReveal){this.override=null;this.blockedBuild=true}
  const enabled=auto&&response>0&&switchItNumber(p,'speed',1,0,2)>0
  if(!enabled||(!audio&&!paused))this.override=null
  if(this.override==='drop'&&motion.state.cycles>=this.overrideEnd)this.override=null
  if(this.override==='build'&&build<.45)this.override=null
  if(enabled&&audio&&active&&!reset&&!manualPattern&&!manualReveal){
   if(freshDrop||(freshImpact&&valid&&director!.context.section.value?.type==='drop')){
    if(this.override!=='drop')this.overrideStart=motion.state.cycles
    this.override='drop';this.overrideEnd=motion.state.cycles+1
   }else if(!this.override&&build>.65&&!this.blockedBuild){this.override='build';this.overrideStart=motion.state.cycles}
  }
  const visible=this.override==='drop'?'crown-surge':this.override==='build'?'facet-peel':motion.state.pattern
  const token=this.override?`override:${this.override}`:`base:${motion.state.pattern}`
  if(reset){this.pose=motion.pose;this.from=this.pose;this.token=token}
  else if(token!==this.token){this.from=this.pose;this.blend=0;this.allowPaused=manualPattern||manualReveal||autoChanged}
  const elapsed=this.previousTimestamp==null?0:clamp((frame.timestampMs-this.previousTimestamp)/1000,0,.25);this.previousTimestamp=frame.timestampMs
  this.blend=clamp(this.blend+((active||this.allowPaused)?Math.max(0,elapsed||(!active&&this.allowPaused?1/60:0))/.24:0))
  const target=this.override?sampleSwitchItProgram(visible,motion.state.cycles-this.overrideStart):motion.pose
  this.pose=mixSwitchItPose(this.from,target,this.blend)
  this.state={basePattern:motion.state.pattern,visiblePattern:visible,override:this.override,directorAvailable:valid}
  this.epoch=motion.state.epoch;this.source=source;this.patternRevision=revision;this.revealRevision=reveal;this.auto=auto;this.token=token;this.previousTime=frame.transport?.timeSec??audio?.upstream.timeSec??0
  const amount=response*influence,restraint=1-.5*drive.vocal,geometry=controls.reach>0&&controls.fragmentAmount>0?1:0
  return{...controls,
   audioLift:geometry*clamp(controls.audioLift*(1+amount*(this.macro.intensity*.15+this.macro.momentum*.1))+.08*this.macro.accent*amount*restraint),
   audioCrest:geometry*clamp(controls.audioCrest+.12*this.macro.build*amount*restraint+.15*this.macro.accent*amount*restraint),
   audioGlint:clamp(controls.audioGlint*(1+.15*this.macro.intensity*amount),0,.5),
   particlePhase:motion.state.cycles,flecks:switchItNumber(p,'flecks',0),
  }
 }
}
