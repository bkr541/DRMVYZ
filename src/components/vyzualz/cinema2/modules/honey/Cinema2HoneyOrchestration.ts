import { Cinema2BeatClock } from '../Cinema2BeatClock'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS,resolveCinema2AfterhoursTriggerEventIdentity,type Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'
import { Cinema2MainframePatternController } from '../mainframe/Cinema2MainframePatternController'
import { Cinema2PatternControlResolver } from '../../conductor/Cinema2PatternControls'
import type { Cinema2ModuleUpdateContext } from '../Cinema2ModuleContracts'
import { HONEY_PATTERN_IDS } from './Cinema2HoneyDomain'
import { sampleHoneyPattern,type HoneyPattern } from './Cinema2HoneyPatterns'
import { advanceHoneyCell,blendHoneyCell,createHoneyCellState,HONEY_MOTION_DEFAULTS,targetHoneyCell,type HoneyMotionControls,type HoneyVisualCell } from './Cinema2HoneyMotion'
import { Cinema2HoneyAudio,HONEY_AUDIO_DEFAULTS,HONEY_AUDIO_REACTIVITY,type HoneyAudioChannels,type HoneyCue } from './Cinema2HoneyAudio'
import { HONEY_DIRECTOR_DEFAULTS,type HoneyDirectorChannels } from './Cinema2HoneyPerformance'
import { Cinema2HoneyParticles,HONEY_PARTICLE_DEFAULTS } from './Cinema2HoneyParticles'
import type { HoneyCell } from './Cinema2HoneyLayout'

export class Cinema2HoneyOrchestration {
  private readonly clock=new Cinema2BeatClock()
  private readonly policy=new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>()
  private readonly controller=new Cinema2MainframePatternController<HoneyPattern>(HONEY_PATTERN_IDS,'cascade')
  private readonly audio=new Cinema2HoneyAudio()
  private priorCueControls:string|null=null
  private priorAuto=false
  private patternEditRevision:number|null=null
  private states
  private identity='';private lastTime:number|null=null;private lastBeat:number|null=null;private phase=0;private activePattern:HoneyPattern='cascade';private authored:HoneyPattern='cascade'
  private snapshot:readonly HoneyVisualCell[]|null=null;private transitionBeat=0;private transitionLength=1
  private observedEvents=new Map<Cinema2AfterhoursTriggerId,string>();private wasActive=false
  readonly particles:Cinema2HoneyParticles
  cells:readonly HoneyVisualCell[]
  constructor(private readonly layout:readonly HoneyCell[]){this.particles=new Cinema2HoneyParticles(layout);this.states=layout.map(createHoneyCellState);this.cells=this.states.map(s=>s.current)}
  update({frame,parameters}:Cinema2ModuleUpdateContext,cues:readonly HoneyCue[]=[]){
    const previousVisual=this.cells
    const time=frame.transport?.timeSec??frame.audio?.upstream.timeSec??frame.elapsedTimeSec
    const identity=JSON.stringify([frame.contextGeneration,frame.transport?.sourcePresent,frame.transport?.trackId,frame.audio?.upstream.sourceId,frame.audio?.upstream.publisherId,frame.audio?.discontinuity.generation,frame.audio?.upstream.analysisRevision,frame.audio?.upstream.timelineRevision])
    const reset=identity!==this.identity||!!(frame.audio?.discontinuity.occurred&&frame.audio.discontinuity.reason!=='activation')||(this.lastTime!=null&&(time<this.lastTime-.035||time-this.lastTime>Math.max(1,frame.deltaTimeSec*6)))
    if(reset){this.clock.reset();this.policy.reset();this.controller.reset();this.lastBeat=null;this.phase=0;this.snapshot=null;this.observedEvents.clear();this.wasActive=false;this.states=this.layout.map(createHoneyCellState);this.cells=this.states.map(s=>s.current)}
    const active=frame.transport?frame.transport.sourcePresent&&frame.transport.playing&&frame.transport.animationActive&&!frame.transport.paused:!!frame.audio
    const present=frame.transport?.sourcePresent??!!frame.audio
    const authored=HONEY_PATTERN_IDS.find(p=>p===parameters.get('pattern'))??'cascade'
    // A manual edit can select the already-saved base after an automatic advance.
    // Treat the shared revision as a controller boundary without resetting the beat clock.
    const revision=parameters.getEditRevision?.('pattern')??0
    const patternEdited=this.patternEditRevision!==null&&revision!==this.patternEditRevision
    this.patternEditRevision=revision
    const trigger=CINEMA2_AFTERHOURS_TRIGGER_IDS.find(t=>t===parameters.get('trigger'))??'bar4'
    const auto=parameters.get('autoPerformance')===true&&present
    const autoReleased=this.priorAuto&&!auto
    this.priorAuto=auto
    const controls=this.policy.update({saved:{patternChange:parameters.get('patternChange')===true,trigger},mood:frame.mood,autoPerformance:auto})
    const clock=this.clock.update({...frame,elapsedTimeSec:reset?0:frame.elapsedTimeSec,deltaTimeSec:active?frame.deltaTimeSec:0},parameters.get('bpmSync')!==false&&frame.transport?.bpmSync!==false)
    const beat=clock.beats,dt=active?Math.max(0,Math.min(.25,frame.deltaTimeSec)):0
    const n=(key:keyof HoneyMotionControls,min:number,max:number)=>{const v=parameters.get(key),base=HONEY_MOTION_DEFAULTS[key];return typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):Number(base)}
    const k:HoneyMotionControls={motion:n('motion',0,1),rate:n('rate',.25,2),attack:n('attack',.04,.5),release:n('release',.15,1.2),rotation:n('rotation',0,1),tilt:n('tilt',0,1),separation:n('separation',0,1),elevation:n('elevation',0,1),coverage:n('coverage',0,1),width:n('width',.5,1.5),delay:n('delay',.0625,.25),transition:String(parameters.get('transition')??'1')}
    // All P05 drives multiply the saved target; a zero remains zero in the resolver.
    const event=active?resolveCinema2AfterhoursTriggerEventIdentity(frame,controls.trigger,reset||!this.wasActive?null:this.lastTime):null
    // Observe even muted/reset events so a held identity cannot replay after silence or resume.
    const fresh=event!==null&&event!==this.observedEvents.get(controls.trigger)
    if(event)this.observedEvents.set(controls.trigger,event)
    const silentHold=!reset&&!patternEdited&&authored===this.authored&&auto&&controls.automatic&&!controls.patternChange&&(frame.mood?.silence??0)>=.5
    const selected=silentHold?null:this.controller.update({authoredPattern:authored,patternChange:controls.patternChange,trigger:controls.trigger,triggerEventId:fresh&&this.wasActive?event:null,absoluteBeat:beat,reset:reset||autoReleased||patternEdited})
    if(selected&&selected.activePattern!==this.activePattern){this.snapshot=this.states.map(s=>s.current);this.transitionBeat=beat;this.transitionLength=[.5,1,2,4].includes(Number(k.transition))?Number(k.transition):1;this.phase=0;this.activePattern=selected.activePattern}
    if(active&&this.lastBeat!=null)this.phase+=Math.max(0,Math.min(1,beat-this.lastBeat))*k.rate
    const raw=parameters.get('audioReactivity'),reactivity=typeof raw==='number'&&Number.isFinite(raw)?Math.max(0,Math.min(1,raw)):HONEY_AUDIO_REACTIVITY
    const cueControls=JSON.stringify([auto,authored,parameters.getEditRevision?.('pattern')??0,parameters.getEditRevision?.('audioReactivity')??parameters.getAuthored('audioReactivity'),parameters.getEditRevision?.('trigger')??trigger,parameters.getEditRevision?.('patternChange')??(parameters.get('patternChange')===true),trigger])
    const boundary=this.priorCueControls!==null&&cueControls!==this.priorCueControls
    this.priorCueControls=cueControls
    const channels=Object.fromEntries(Object.keys(HONEY_AUDIO_DEFAULTS).map(key=>{const v=parameters.get(key);return [key,typeof v==='number'&&Number.isFinite(v)?v:0]})) as HoneyAudioChannels
    const director=Object.fromEntries(Object.keys(HONEY_DIRECTOR_DEFAULTS).map(key=>{const v=parameters.get(key);return [key,typeof v==='number'&&Number.isFinite(v)?v:0]})) as HoneyDirectorChannels
    const audio=frame.audio
    // Availability is diagnostic only: values are read from shared resolved targets, never raw bands.
    const available=!!audio&&(Object.values(audio.bands??{}).some(v=>v.available)||[audio.features?.spectralFlux,audio.features?.overallEnergy,audio.features?.vocalPresence,audio.features?.buildProgress].some(v=>v?.available))
    this.audio.update({channels,director,cues,active:active&&!!audio,reset:reset||!audio||!present,boundary,deltaSeconds:dt,reactivity,available})
    const atmosphere=this.audio.inspect(),amount=parameters.get('particleAmount')
    this.particles.update({active,reset,deltaSeconds:dt,enabled:parameters.get('particles')!==false,amount:typeof amount==='number'?amount:HONEY_PARTICLE_DEFAULTS.particleAmount,reactivity,high:atmosphere.channels.high,air:atmosphere.channels.air,flux:atmosphere.channels.flux,drop:atmosphere.envelopes.reduce((v,e)=>e.kind==='drop'?Math.max(v,e.level*e.weight):v,0)})
    if(active){
      const t=this.snapshot?Math.max(0,Math.min(1,(beat-this.transitionBeat)/this.transitionLength)):1
      const mix=t*t*(3-2*t),beatSeconds=60/(clock.locked&&clock.bpm?clock.bpm:120)
      this.states.forEach((state,i)=>{const c=this.layout[i]!,sample=sampleHoneyPattern(this.activePattern,c,this.phase,k.width,k.delay,beatSeconds);let target=targetHoneyCell(c,sample,k);if(this.snapshot)target=blendHoneyCell(this.snapshot[i]!,target,mix);advanceHoneyCell(state,target,dt,k)});this.cells=this.states.map((s,i)=>{const output=this.audio.apply(s.current,k);if(k.motion===0&&!reset){const pose=previousVisual[i]!.pose;return {...output,pose,elevation:pose.elevation}}return output})
      if(t===1)this.snapshot=null
    }
    // Explicit selection is also a deterministic still preview while stopped/paused.
    // Default Cascade with no source preserves the P02 static composition.
    if(!active&&(patternEdited||authored!==this.authored||(reset&&!present&&authored!=='cascade'))){
      this.states=this.layout.map((cell,i)=>{
        const state=createHoneyCellState(cell)
        state.current=authored==='cascade'&&!present?state.current:targetHoneyCell(cell,sampleHoneyPattern(authored,cell,1.25,k.width,k.delay),k)
        if(k.motion===0){state.current.pose=this.cells[i]!.pose;state.current.elevation=state.current.pose.elevation}
        state.target=state.current;return state
      });this.cells=this.states.map(s=>s.current);this.snapshot=null
    }
    if(!active&&reactivity===0){this.cells=this.states.map((s,i)=>k.motion===0&&!reset?{...s.current,pose:previousVisual[i]!.pose,elevation:previousVisual[i]!.pose.elevation}:s.current)}
    this.identity=identity;this.lastTime=time;this.lastBeat=beat;this.authored=authored;this.wasActive=active
  }
  inspect(){return {...this.policy.inspect(),activePattern:this.activePattern,basePattern:this.authored,particles:this.particles.inspect(),phase:this.phase,locked:this.clock.getState().locked,transitioning:this.snapshot!==null,audio:this.audio.inspect()}}
}
