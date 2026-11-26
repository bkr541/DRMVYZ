import { cinema2StableId,type Cinema2Color,type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleInstance,Cinema2ModuleTypeDefinition,Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS,resolveCinema2AfterhoursTriggerEventIdentity,type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import { Cinema2MainframePatternController } from './mainframe/Cinema2MainframePatternController'
import { blendHud,HUD_COLOR_KEYS,HUD_DEFAULTS,HUD_PALETTE,HUD_PATTERNS,HUD_SIGNALS,sampleHud,zeroHudSignals,type HudControls,type HudPalette,type HudPattern,type HudSignals } from './hud/Cinema2HudGeometry'
import { Cinema2HudRenderer } from './hud/Cinema2HudRenderer'

export const CINEMA2_HUD_NATIVE_MODULE_TYPE_ID=cinema2StableId<Cinema2ModuleTypeId>('hud-native')
const clamp=(value:number,min=0,max=1)=>Math.max(min,Math.min(max,value))

/** Only resolves shared timing and pattern authority; the artwork consumes resolved choreography targets. */
export class Cinema2HudMotion {
  private readonly clock=new Cinema2BeatClock()
  private readonly policy=new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>()
  private readonly controller=new Cinema2MainframePatternController<HudPattern>(HUD_PATTERNS,'reactor')
  private identity=''
  private lastTime:number|null=null
  private lastBeat:number|null=null
  private wasActive=false
  private priorAuto=false
  private priorRevision:number|null=null
  private observed=new Map<Cinema2AfterhoursTriggerId,string>()
  private phase=0
  private signals:HudSignals=zeroHudSignals()
  private activePattern:HudPattern='reactor'
  private authored:HudPattern='reactor'
  private transitionFrom:Float32Array|null=null
  private transitionStart=0
  geometry=sampleHud('reactor',0,HUD_DEFAULTS,zeroHudSignals())
  reset(){
    this.clock.reset();this.policy.reset();this.controller.reset();this.identity='';this.lastTime=null;this.lastBeat=null;this.wasActive=false;this.priorAuto=false;this.priorRevision=null;this.observed.clear();this.phase=0;this.signals=zeroHudSignals();this.activePattern='reactor';this.authored='reactor';this.transitionFrom=null;this.transitionStart=0
    this.geometry=sampleHud('reactor',0,HUD_DEFAULTS,zeroHudSignals())
  }
  update({frame,parameters}:Cinema2ModuleUpdateContext){
    const time=frame.transport?.timeSec??frame.audio?.upstream.timeSec??frame.elapsedTimeSec
    const present=frame.transport?.sourcePresent??!!frame.audio
    const active=frame.transport?present&&frame.transport.playing&&!frame.transport.paused&&frame.transport.animationActive:!!frame.audio
    const identity=JSON.stringify([frame.contextGeneration,present,frame.transport?.trackId,frame.audio?.upstream.sourceId,frame.audio?.upstream.publisherId,frame.audio?.discontinuity.generation,frame.audio?.upstream.analysisRevision,frame.audio?.upstream.timelineRevision])
    const reset=identity!==this.identity||!!(frame.audio?.discontinuity.occurred&&frame.audio.discontinuity.reason!=='activation')||(this.lastTime!=null&&(time<this.lastTime-.035||(active&&time-this.lastTime>Math.max(1,frame.deltaTimeSec*6))))
    if(reset){this.reset();this.identity=identity}
    const authored=HUD_PATTERNS.find(v=>v===parameters.get('pattern'))??'reactor'
    const revision=parameters.getEditRevision?.('pattern')??0
    const edited=this.priorRevision!==null&&this.priorRevision!==revision
    this.priorRevision=revision
    const trigger=CINEMA2_AFTERHOURS_TRIGGER_IDS.find(t=>t===parameters.get('trigger'))??'bar4'
    const auto=parameters.get('autoPerformance')===true&&present
    const autoReleased=this.priorAuto&&!auto;this.priorAuto=auto
    const effective=this.policy.update({saved:{patternChange:parameters.get('patternChange')===true,trigger},mood:frame.mood,autoPerformance:auto})
    const animate=active||!present
    const clock=this.clock.update({...frame,elapsedTimeSec:reset?0:frame.elapsedTimeSec,deltaTimeSec:animate?frame.deltaTimeSec:0,...(!present?{transport:undefined}:{})},present&&parameters.get('bpmSync')!==false&&frame.transport?.bpmSync!==false)
    const beat=clock.beats
    const event=active?resolveCinema2AfterhoursTriggerEventIdentity(frame,effective.trigger,reset||!this.wasActive?null:this.lastTime):null
    const fresh=event!==null&&event!==this.observed.get(effective.trigger)
    if(event)this.observed.set(effective.trigger,event)
    const silentHold=!reset&&!edited&&authored===this.authored&&auto&&effective.automatic&&!effective.patternChange&&(frame.mood?.silence??0)>=.5
    const selection=silentHold?null:this.controller.update({authoredPattern:authored,patternChange:effective.patternChange,trigger:effective.trigger,triggerEventId:fresh&&this.wasActive?event:null,absoluteBeat:beat,reset:reset||autoReleased||edited})
    if(edited||authored!==this.authored)this.transitionFrom=null
    if(selection&&selection.activePattern!==this.activePattern){
      this.transitionFrom=animate&&active&&!edited&&authored===this.authored?this.geometry:null
      this.transitionStart=beat;this.activePattern=selection.activePattern
    }
    const controls=Object.fromEntries(Object.entries(HUD_DEFAULTS).map(([key,base])=>{
      const v=parameters.get(key),n=typeof v==='number'&&Number.isFinite(v)?v:base
      return [key,clamp(n,key==='rate'?.25:0,key==='rate'||key==='intensity'?2:1)]
    })) as HudControls
    if(animate&&this.lastBeat!=null)this.phase+=Math.max(0,Math.min(1,beat-this.lastBeat))*controls.rate*controls.motion
    if(!present||reset)this.signals=zeroHudSignals()
    if(active&&!reset&&frame.audio)for(const key of HUD_SIGNALS){const value=parameters.get(key);this.signals[key]=typeof value==='number'&&Number.isFinite(value)?clamp(value):0}
    const next=sampleHud(this.activePattern,this.phase,controls,this.signals,frame.viewport.width/Math.max(1,frame.viewport.height))
    const progress=clamp(beat-this.transitionStart)
    this.geometry=this.transitionFrom&&progress<1?blendHud(this.transitionFrom,next,progress):next
    if(progress>=1)this.transitionFrom=null
    this.lastTime=time;this.lastBeat=beat;this.wasActive=active;this.authored=authored
  }
  inspect(){return {...this.policy.inspect(),activePattern:this.activePattern,basePattern:this.activePattern,phase:this.phase,locked:this.clock.getState().locked,transitioning:this.transitionFrom!==null}}
}

export interface HudModuleInstance extends Cinema2ModuleInstance { inspect(): ReturnType<Cinema2HudMotion['inspect']> & Partial<ReturnType<Cinema2HudRenderer['inspect']>> }
type Renderer=Pick<Cinema2HudRenderer,'draw'|'dispose'|'estimateGpuBytes'|'inspect'>
export function createCinema2HudNativeModuleDefinition(createRenderer:(gl:WebGL2RenderingContext)=>Renderer=gl=>new Cinema2HudRenderer(gl)):Readonly<Cinema2ModuleTypeDefinition>{
  return Object.freeze<Cinema2ModuleTypeDefinition>({typeId:CINEMA2_HUD_NATIVE_MODULE_TYPE_ID,version:1,create(context):HudModuleInstance{
    const motion=new Cinema2HudMotion();let renderer:Renderer|null=null,disposed=false
    return {
      lifecycle:{update(update){if(!disposed)motion.update(update)},dispose(){disposed=true;motion.reset();renderer=null}},
      render:{providers:[{id:`${context.module.id}:hud-world`,moduleId:context.module.id,intent:'world',execute(execution){
        if(disposed)return
        if(!execution.depthAvailable||!execution.camera)throw Error('HUD requires the shared depth target and world camera')
        if(!renderer)renderer=context.resources.acquire('hud-renderer','Cinema2HudRenderer',createRenderer,value=>value.dispose())
        const palette={...HUD_PALETTE} as HudPalette
        for(const key of HUD_COLOR_KEYS){const value=context.parameters.get(key);if(Array.isArray(value)&&value.length===4&&value.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1))palette[key]=value as unknown as Cinema2Color}
        renderer.draw(execution.camera.viewProjectionMatrix,execution.camera.position,palette,motion.geometry);context.resources.reportGpuBytes(renderer.estimateGpuBytes())
      }}]},
      inspect:()=>({...motion.inspect(),...renderer?.inspect()}),
    }
  }})
}
export const cinema2HudNativeModuleDefinition=createCinema2HudNativeModuleDefinition()
