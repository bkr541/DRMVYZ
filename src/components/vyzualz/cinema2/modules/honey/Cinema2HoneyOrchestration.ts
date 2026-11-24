import { Cinema2BeatClock } from '../Cinema2BeatClock'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS,resolveCinema2AfterhoursTriggerEventIdentity,type Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'
import { Cinema2MainframePatternController } from '../mainframe/Cinema2MainframePatternController'
import { Cinema2PatternControlResolver } from '../../conductor/Cinema2PatternControls'
import type { Cinema2ModuleUpdateContext } from '../Cinema2ModuleContracts'
import { HONEY_PATTERN_IDS } from './Cinema2HoneyDomain'
import { sampleHoneyPattern,type HoneyPattern } from './Cinema2HoneyPatterns'
import { advanceHoneyCell,blendHoneyCell,createHoneyCellState,HONEY_MOTION_DEFAULTS,targetHoneyCell,type HoneyMotionControls,type HoneyVisualCell } from './Cinema2HoneyMotion'
import type { HoneyCell } from './Cinema2HoneyLayout'

export class Cinema2HoneyOrchestration {
  private readonly clock=new Cinema2BeatClock()
  private readonly policy=new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>()
  private readonly controller=new Cinema2MainframePatternController<HoneyPattern>(HONEY_PATTERN_IDS,'cascade')
  private states
  private identity='';private lastTime:number|null=null;private lastBeat:number|null=null;private phase=0;private activePattern:HoneyPattern='cascade';private authored:HoneyPattern='cascade'
  private snapshot:readonly HoneyVisualCell[]|null=null;private transitionBeat=0;private transitionLength=1
  private observedEvents=new Map<Cinema2AfterhoursTriggerId,string>();private wasActive=false
  cells:readonly HoneyVisualCell[]
  constructor(private readonly layout:readonly HoneyCell[]){this.states=layout.map(createHoneyCellState);this.cells=this.states.map(s=>s.current)}
  update({frame,parameters}:Cinema2ModuleUpdateContext){
    const time=frame.transport?.timeSec??frame.audio?.upstream.timeSec??frame.elapsedTimeSec
    const identity=JSON.stringify([frame.contextGeneration,frame.transport?.sourcePresent,frame.transport?.trackId,frame.audio?.upstream.sourceId,frame.audio?.upstream.publisherId,frame.audio?.discontinuity.generation,frame.audio?.upstream.analysisRevision,frame.audio?.upstream.timelineRevision])
    const reset=identity!==this.identity||(this.lastTime!=null&&(time<this.lastTime-.035||time-this.lastTime>Math.max(1,frame.deltaTimeSec*6)))
    if(reset){this.clock.reset();this.policy.reset();this.controller.reset();this.lastBeat=null;this.phase=0;this.snapshot=null;this.observedEvents.clear();this.wasActive=false;this.states=this.layout.map(createHoneyCellState);this.cells=this.states.map(s=>s.current)}
    const active=frame.transport?frame.transport.sourcePresent&&frame.transport.playing&&frame.transport.animationActive&&!frame.transport.paused:!!frame.audio
    const present=frame.transport?.sourcePresent??!!frame.audio
    const authored=HONEY_PATTERN_IDS.find(p=>p===parameters.get('pattern'))??'cascade'
    const trigger=CINEMA2_AFTERHOURS_TRIGGER_IDS.find(t=>t===parameters.get('trigger'))??'bar4'
    const auto=parameters.get('autoPerformance')===true&&present
    const controls=this.policy.update({saved:{patternChange:parameters.get('patternChange')===true,trigger},mood:frame.mood,autoPerformance:auto})
    const clock=this.clock.update({...frame,elapsedTimeSec:reset?0:frame.elapsedTimeSec,deltaTimeSec:active?frame.deltaTimeSec:0},parameters.get('bpmSync')!==false&&frame.transport?.bpmSync!==false)
    const beat=clock.beats,dt=active?Math.max(0,Math.min(.25,frame.deltaTimeSec)):0
    const n=(key:keyof HoneyMotionControls,min:number,max:number)=>{const v=parameters.get(key),base=HONEY_MOTION_DEFAULTS[key];return typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):Number(base)}
    const k:HoneyMotionControls={motion:n('motion',0,1),rate:n('rate',.25,2),attack:n('attack',.04,.5),release:n('release',.15,1.2),rotation:n('rotation',0,1),tilt:n('tilt',0,1),separation:n('separation',0,1),elevation:n('elevation',0,1),coverage:n('coverage',0,1),width:n('width',.5,1.5),delay:n('delay',.0625,.25),transition:String(parameters.get('transition')??'1')}
    if(parameters.getAuthored('motion')===0)k.motion=0
    const event=active?resolveCinema2AfterhoursTriggerEventIdentity(frame,controls.trigger,reset||!this.wasActive?null:this.lastTime):null
    // Observe even muted/reset events so a held identity cannot replay after silence or resume.
    const fresh=event!==null&&event!==this.observedEvents.get(controls.trigger)
    if(event)this.observedEvents.set(controls.trigger,event)
    const silentHold=!reset&&authored===this.authored&&auto&&controls.automatic&&!controls.patternChange&&(frame.mood?.silence??0)>.5
    const selected=silentHold?null:this.controller.update({authoredPattern:authored,patternChange:controls.patternChange,trigger:controls.trigger,triggerEventId:fresh&&this.wasActive?event:null,absoluteBeat:beat,reset})
    if(selected&&selected.activePattern!==this.activePattern){this.snapshot=this.cells;this.transitionBeat=beat;this.transitionLength=[.5,1,2,4].includes(Number(k.transition))?Number(k.transition):1;this.phase=0;this.activePattern=selected.activePattern}
    if(active&&this.lastBeat!=null)this.phase+=Math.max(0,Math.min(1,beat-this.lastBeat))*k.rate
    if(active){
      const t=this.snapshot?Math.max(0,Math.min(1,(beat-this.transitionBeat)/this.transitionLength)):1
      const mix=t*t*(3-2*t),beatSeconds=60/(clock.locked&&clock.bpm?clock.bpm:120)
      this.states.forEach((state,i)=>{const c=this.layout[i]!,sample=sampleHoneyPattern(this.activePattern,c,this.phase,k.width,k.delay,beatSeconds);let target=targetHoneyCell(c,sample,k);if(this.snapshot)target=blendHoneyCell(this.snapshot[i]!,target,mix);advanceHoneyCell(state,target,dt,k)});this.cells=this.states.map(s=>s.current)
      if(t===1)this.snapshot=null
    }
    // Explicit selection is also a deterministic still preview while stopped/paused.
    // Default Cascade with no source preserves the P02 static composition.
    if(!active&&(authored!==this.authored||(reset&&!present&&authored!=='cascade'))){
      this.states=this.layout.map((cell,i)=>{
        const state=createHoneyCellState(cell)
        state.current=authored==='cascade'&&!present?state.current:targetHoneyCell(cell,sampleHoneyPattern(authored,cell,1.25,k.width,k.delay),k)
        if(k.motion===0){state.current.pose=this.cells[i]!.pose;state.current.elevation=state.current.pose.elevation}
        state.target=state.current;return state
      });this.cells=this.states.map(s=>s.current);this.snapshot=null
    }
    this.identity=identity;this.lastTime=time;this.lastBeat=beat;this.authored=authored;this.wasActive=active
  }
  inspect(){return {...this.policy.inspect(),activePattern:this.activePattern,phase:this.phase,locked:this.clock.getState().locked,transitioning:this.snapshot!==null}}
}
