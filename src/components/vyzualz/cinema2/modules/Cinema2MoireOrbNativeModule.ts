import type * as THREE from 'three'
import {cinema2StableId,type Cinema2ModuleTypeId,type Cinema2RenderQualityLevel} from '../contracts/Cinema2NativePresetManifest'
import type {Cinema2ModuleUpdateContext} from './Cinema2ModuleContracts'
import type {Cinema2ThreeLibrary} from './three/Cinema2ThreeLibrary'
import {createCinema2ThreeSceneModuleDefinition} from './Cinema2ThreeSceneModule'
import {Cinema2BeatClock} from './Cinema2BeatClock'
import {Cinema2PatternControlResolver} from '../conductor/Cinema2PatternControls'
import {Cinema2PatternAutoPerformance} from './mainframe/Cinema2PatternAutoPerformance'
import {Cinema2MainframePatternController} from './mainframe/Cinema2MainframePatternController'
import {resolveCinema2AfterhoursTriggerEventIdentity,type Cinema2AfterhoursTriggerId} from './Cinema2AfterhoursNativeModule'
import {MOIRE_ORB_PATTERN_IDS,type MoireOrbPattern} from './moireOrb/MoireOrbPatterns'
import {MoireOrbReactorScene,type ReactorControls} from './moireOrb/MoireOrbReactorScene'
export const CINEMA2_MOIRE_ORB_MODULE_TYPE_ID=cinema2StableId<Cinema2ModuleTypeId>('moire-orb-reactor-native')
export class Cinema2MoireOrbController {
 readonly afterVisibility=true
 private scene:MoireOrbReactorScene|null=null
 private context:Cinema2ModuleUpdateContext|null=null
 private clock=new Cinema2BeatClock()
 private selection=new Cinema2MainframePatternController<MoireOrbPattern>(MOIRE_ORB_PATTERN_IDS,'core-ignition')
 private policy=new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>()
 private performance=new Cinema2PatternAutoPerformance<MoireOrbPattern>({buildPattern:'pressure-lock',dropPattern:'radial-discharge',buildMaxBeats:32,dropBeats:8})
 private weights:number[]=[1,0,0,0,0,0]
 private from=[...this.weights]
 private pattern:MoireOrbPattern='core-ignition'
 private overrideReason:string|null=null
 private transitionStart:number|null=null
 private previousTime:number|null=null
 private identity:string|null=null
 private lastBeat:number|null=null
 private lastTimestamp:number|null=null
 private phase=0
 private fixturePhase=0
 private editRevision:number|null=null
 private autoWasEnabled=false
 private authored:MoireOrbPattern|null=null
 constructor(private readonly library:Cinema2ThreeLibrary){}
 attach(root:THREE.Object3D){this.scene=new MoireOrbReactorScene(this.library,root)}
 update(context:Cinema2ModuleUpdateContext){
  this.context=context;const {frame,parameters}=context,time=frame.transport?.timeSec??frame.elapsedTimeSec
  const identity=JSON.stringify([frame.contextGeneration,frame.transport?.trackId,frame.audio?.upstream.sourceId,frame.audio?.upstream.analysisRevision,frame.audio?.upstream.timelineRevision,frame.audio?.discontinuity.generation])
  const reset=identity!==this.identity||(this.previousTime!=null&&(time<this.previousTime-.01||time-this.previousTime>.75))
  if(reset){this.clock.reset();this.selection.reset();this.policy.reset();this.performance.reset();this.phase=this.fixturePhase=0;this.lastBeat=null;this.transitionStart=null}
  const dt=this.lastTimestamp==null?0:Math.min(.1,Math.max(0,(frame.timestampMs-this.lastTimestamp)/1000)),active=!frame.transport?.paused&&frame.transport?.animationActive!==false
  this.lastTimestamp=frame.timestampMs
  const timingFrame={...frame,elapsedTimeSec:frame.audio?.upstream.timeSec??frame.elapsedTimeSec,deltaTimeSec:active?dt:0,...(frame.transport?{transport:{...frame.transport,animationActive:active}}:{})}
  const beats=this.clock.update(timingFrame,parameters.get('bpmSync')!==false).beats,delta=this.lastBeat==null?0:Math.max(0,beats-this.lastBeat)
  if(active){this.phase+=delta*this.number('motionRate',1,0,2)*Math.PI/4;this.fixturePhase+=delta*this.number('fixtureSpeed',1,0,2)*Math.PI/4}
  const authored=MOIRE_ORB_PATTERN_IDS.includes(parameters.get('pattern') as MoireOrbPattern)?parameters.get('pattern') as MoireOrbPattern:'core-ignition',revision=parameters.getEditRevision?.('pattern')??0
  const edited=(this.editRevision!=null&&revision!==this.editRevision)||(this.authored!=null&&authored!==this.authored)
  const auto=parameters.get('autoPerformance')===true&&this.number('reactivity',.65,0,1)>0&&frame.transport?.sourcePresent===true&&(frame.transport.playing||frame.transport.paused)&&frame.mood!=null
  const authorityRestored=this.autoWasEnabled&&!auto;this.autoWasEnabled=auto
  const controls=this.policy.update({saved:{patternChange:parameters.get('patternChange')===true,trigger:(parameters.get('trigger')??'bar4') as Cinema2AfterhoursTriggerId},mood:frame.mood,autoPerformance:auto})
  const drop=resolveCinema2AfterhoursTriggerEventIdentity(frame,'drop',this.previousTime)
  const base=this.selection.update({authoredPattern:authored,patternChange:controls.patternChange,trigger:controls.trigger,triggerEventId:controls.trigger==='drop'?drop:resolveCinema2AfterhoursTriggerEventIdentity(frame,controls.trigger,this.previousTime),absoluteBeat:beats,reset:reset||edited})
  const performing=this.performance.update({enabled:auto,absoluteBeat:beats,buildCharge:frame.mood?.silence&&frame.mood.silence>.5?0:frame.director?.context.build.available?frame.director.context.build.value??0:0,dropEventId:drop,patternEdited:edited,reset,basePattern:base.activePattern,patternChange:controls.patternChange})
  const next=performing.pattern??base.activePattern
  if(next!==this.pattern){this.from=[...this.weights];this.transitionStart=edited||reset||authorityRestored?null:beats;this.pattern=next}
  if(reset||edited||authorityRestored)this.transitionStart=null
  const t=this.transitionStart==null?1:Math.min(1,Math.max(0,beats-this.transitionStart)),blend=t*t*(3-2*t),index=MOIRE_ORB_PATTERN_IDS.indexOf(this.pattern)
  this.weights=this.from.map((value,i)=>value*(1-blend)+(i===index?blend:0));if(t>=1)this.transitionStart=null
  this.overrideReason=performing.reason;this.lastBeat=beats;this.previousTime=time;this.identity=identity;this.editRevision=revision;this.authored=authored
 }
 private number(name:string,fallback:number,min:number,max:number){const value=this.context?.parameters.get(name);return typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback}
 beforeDraw(quality:Cinema2RenderQualityLevel='high'){
  if(!this.context||!this.scene)return
  const palette=(name:string,fallback:readonly number[])=>{const value=this.context!.parameters.get(name);return Array.isArray(value)&&value.length>=3?value.map(Number):fallback}
  const c:ReactorControls={fixtureMotion:this.number('fixtureSpeed',1,0,2)>0,intensity:this.number('intensity',1,0,2),coreScale:this.number('coreScale',1,.7,1.3),coreOpacity:this.number('coreOpacity',.75,0,1),coreGlow:this.number('coreGlow',.5,0,2),layerSeparation:this.number('layerSeparation',.72,0,1),ringTravel:this.number('ringTravel',.65,0,1),ringLighting:this.number('ringLighting',.45,0,1.5),fixtureLighting:this.number('fixtureLighting',.5,0,1.5),chamberLighting:this.number('chamberLighting',.45,0,1.5),coreDetailLighting:this.number('coreDetailLighting',.6,0,1.5),beamWidth:this.number('beamWidth',.65,.2,2),haze:this.number('haze',.18,0,1),coreColor:palette('coreColor',[.38,.423,.793]),ringColor:palette('ringColor',[.1,.8,1]),fixtureColor:palette('fixtureColor',[1,.56,.18]),chamberColor:palette('chamberColor',[.025,.04,.06]),detailColor:palette('detailColor',[.22,.28,.34])}
  this.scene.draw(c,this.phase,this.fixturePhase,this.weights,quality)
 }
 inspect(){return {...this.scene?.inspect(),...this.policy.inspect(),pattern:this.pattern,phase:this.phase,fixturePhase:this.fixturePhase,overrideReason:this.overrideReason,patternWeights:[...this.weights]}}
 dispose(){this.scene?.dispose();this.scene=null;this.context=null;this.clock.reset();this.selection.reset();this.policy.reset();this.performance.reset()}
}
export const cinema2MoireOrbModuleDefinition=createCinema2ThreeSceneModuleDefinition({typeId:CINEMA2_MOIRE_ORB_MODULE_TYPE_ID,resourceKey:'moire-orb-reactor:bridge',createModelController:library=>new Cinema2MoireOrbController(library)})
