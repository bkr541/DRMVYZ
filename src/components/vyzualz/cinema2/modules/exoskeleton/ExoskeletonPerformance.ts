import { Cinema2PatternControlResolver } from '../../conductor/Cinema2PatternControls'
import { DEFAULT_MODEL_BINDING } from '../../model/Cinema2ModelBinding'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'
import { Cinema2BeatClock } from '../Cinema2BeatClock'
import { Cinema2MainframePatternController, createCinema2MainframePatternCycle } from '../mainframe/Cinema2MainframePatternController'
import { Cinema2PatternAutoPerformance } from '../mainframe/Cinema2PatternAutoPerformance'
import type { Cinema2ModuleParameterReadFacet, Cinema2ModuleUpdateContext } from '../Cinema2ModuleContracts'
import { EXOSKELETON_PALETTE, EXOSKELETON_PATTERNS, type ExoskeletonPattern } from './ExoskeletonGeometry'

export class ExoskeletonPerformance {
  private readonly clock=new Cinema2BeatClock()
  private readonly resolver=new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>()
  private readonly controller:Cinema2MainframePatternController<ExoskeletonPattern>
  private readonly auto=new Cinema2PatternAutoPerformance<ExoskeletonPattern>({buildPattern:'armor',dropPattern:'deployment',dropBeats:3,mood:{options:{calm:['retraction','exposure'],driving:['mechanical-relay','deployment'],tense:['armor','full-assembly'],peak:['deployment','full-assembly']}}})
  private identity='';private lastTime:number|null=null;private lastBeat:number|null=null;private lastPattern:ExoskeletonPattern|null=null;private wasPlaying=false
  private lastTimestamp:number|null=null;private lastRevision:number|null=null;private lastAuto=false;private suppressEvent:string|null=null;private lastSavedChange=false;private lastSavedTrigger:Cinema2AfterhoursTriggerId='bar4'
  previousPattern:ExoskeletonPattern='armor';patternBlend=1
  private params:Cinema2ModuleParameterReadFacet|null=null
  phase=0;routePhase=0;pattern:ExoskeletonPattern='armor';basePattern:ExoskeletonPattern='armor'
  constructor(sample:(i:number)=>number){this.controller=new Cinema2MainframePatternController(createCinema2MainframePatternCycle(sample,EXOSKELETON_PATTERNS.map(p=>p.value)),'armor')}
  n(key:string,fallback:number,min=0,max=1){const v=this.params?.get(key);return typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback}
  text(key:string,fallback:string){const v=this.params?.get(key);return typeof v==='string'?v:fallback}
  on(key:string){return this.params?.get(key)!==false}
  color(key:keyof typeof EXOSKELETON_PALETTE):readonly number[]{const v=this.params?.get(key);return Array.isArray(v)&&v.length===4&&v.every(c=>typeof c==='number'&&Number.isFinite(c))?v:EXOSKELETON_PALETTE[key]}
  get model(){return this.params?.get('userModel')??DEFAULT_MODEL_BINDING}
  get safety(){const value=this.text('motion-safety','reduced');return value==='lockoff'?0:value==='reduced'?.45:1}
  get inputs(){const intensity=this.n('intensity',.75);return {pattern:this.pattern,previousPattern:this.previousPattern,blend:this.patternBlend,opening:this.n('plate-opening',.55),travel:this.n('deployment-travel',.45),kick:this.n('kick',0)*intensity,snare:this.n('snare',0)*intensity,bass:(this.n('sub',0)+this.n('bass',0))*.5*intensity,mid:this.n('mid',0)*intensity,build:this.n('build',0)*intensity,drop:this.n('drop',0)*intensity*(.7+.3*this.n('impact',0)),vocal:this.n('vocal',0),safety:this.safety}}
  update({frame,parameters}:Cinema2ModuleUpdateContext){
    this.params=parameters
    const time=frame.transport?.timeSec??frame.audio?.upstream.timeSec??frame.elapsedTimeSec
    const identity=JSON.stringify([frame.contextGeneration,frame.transport?.trackId,frame.audio?.upstream.sourceId,frame.audio?.upstream.publisherId,frame.audio?.discontinuity.generation,frame.audio?.upstream.analysisRevision,frame.audio?.upstream.timelineRevision])
    const active=frame.transport?.playing===true&&frame.transport.animationActive&&!frame.transport.paused
    const idle=!frame.transport?.sourcePresent&&!frame.transport?.paused
    const delta=Math.min(.1,Math.max(0,idle&&this.lastTimestamp!==null?(frame.timestampMs-this.lastTimestamp)/1000:frame.deltaTimeSec))
    this.lastTimestamp=frame.timestampMs
    const reset=identity!==this.identity||(this.lastTime!=null&&(time<this.lastTime-.035||time-this.lastTime>Math.max(1,frame.deltaTimeSec*6)))
    if(reset){this.clock.reset();this.resolver.reset();this.controller.reset();this.auto.reset();this.lastBeat=null;this.phase=0;this.routePhase=0;this.suppressEvent=null;this.patternBlend=1}
    const timingFrame={...frame,deltaTimeSec:active||idle?delta:0,...(frame.transport?{transport:{...frame.transport,animationActive:active||idle}}:{})}
    const beat=this.clock.update(timingFrame,parameters.get('bpm-sync')!==false&&frame.transport?.bpmSync!==false,90).beats
    const authored=EXOSKELETON_PATTERNS.find(p=>p.value===parameters.get('pattern'))?.value??'armor'
    const revision=parameters.getEditRevision?.('pattern')??0
    const changed=this.lastPattern!==null&&(authored!==this.lastPattern||revision!==this.lastRevision)
    const trigger=CINEMA2_AFTERHOURS_TRIGGER_IDS.find(t=>t===parameters.get('trigger'))??'bar4'
    const savedChange=parameters.get('pattern-change')===true
    const automatic=parameters.get('auto-performance')===true&&this.n('reactivity',.75)>0&&frame.transport?.sourcePresent===true&&frame.mood!=null&&frame.audio?.rhythm.beatIndex?.available===true&&(active||frame.transport.paused)
    const controls=this.resolver.update({saved:{patternChange:savedChange,trigger},mood:frame.mood,autoPerformance:automatic})
    const silence=(frame.mood?.silence??0)>.5
    const resume=active&&!this.wasPlaying
    const rawEvent=active&&(!silence||controls.trigger==='drop')?resolveCinema2AfterhoursTriggerEventIdentity(frame,controls.trigger,reset||resume?null:this.lastTime):null
    if(resume||reset||changed||savedChange!==this.lastSavedChange||trigger!==this.lastSavedTrigger)this.suppressEvent=rawEvent
    if(rawEvent!==null&&rawEvent!==this.suppressEvent)this.suppressEvent=null
    const event=rawEvent===this.suppressEvent?null:rawEvent
    const drop=active&&!resume?resolveCinema2AfterhoursTriggerEventIdentity(frame,'drop',reset?null:this.lastTime):null
    const manual=changed||savedChange!==this.lastSavedChange||trigger!==this.lastSavedTrigger||automatic!==this.lastAuto
    // Keep the current effective pose through silence or pause, unless a user changes authority or a fresh drop arrives.
    const hold=(silence||frame.transport?.paused===true)&&!manual&&!reset&&!drop
    if(!hold){
      this.basePattern=this.controller.update({authoredPattern:authored,patternChange:controls.patternChange,trigger:controls.trigger,absoluteBeat:beat,reset:reset||changed,triggerEventId:manual||reset?null:event}).activePattern
      const override=this.auto.update({enabled:automatic,absoluteBeat:beat,buildCharge:silence?0:this.n('build',0),dropEventId:drop,patternEdited:changed,reset,mood:frame.mood,deltaTimeSec:delta,basePattern:this.basePattern,patternChange:controls.patternChange,seed:identity})
      const next=override.pattern??this.basePattern
      if(next!==this.pattern){this.previousPattern=this.pattern;this.pattern=next;this.patternBlend=manual||reset?1:0}
    }
    if(this.lastBeat!==null&&this.safety>0&&(active||idle)){
      const beatDelta=Math.max(0,Math.min(1,beat-this.lastBeat));this.phase+=beatDelta*this.n('motion-rate',1,.25,2)*(active?1:.67);this.routePhase=(this.routePhase+beatDelta*this.n('relay-rate',1,.25,2)*.25)%1
      this.patternBlend=Math.min(1,this.patternBlend+delta*2.5)
    }
    this.lastRevision=revision;this.lastAuto=automatic;this.lastSavedChange=savedChange;this.lastSavedTrigger=trigger
    this.identity=identity;this.lastTime=time;this.lastBeat=beat;this.lastPattern=authored;this.wasPlaying=active
  }
  inspect(){return {...this.resolver.inspect(),activePattern:this.pattern,basePattern:this.basePattern,patternBlend:this.patternBlend,phase:this.phase,routePhase:this.routePhase}}
}
