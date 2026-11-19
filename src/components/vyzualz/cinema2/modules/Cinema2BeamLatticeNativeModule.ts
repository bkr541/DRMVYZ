import type * as THREE from 'three'
import {cinema2StableId,type Cinema2ModuleTypeId} from '../contracts/Cinema2NativePresetManifest'
import type {Cinema2ModuleUpdateContext} from './Cinema2ModuleContracts'
import type {Cinema2ThreeLibrary} from './three/Cinema2ThreeLibrary'
import {createCinema2ThreeSceneModuleDefinition} from './Cinema2ThreeSceneModule'
import {Cinema2BeatClock} from './Cinema2BeatClock'
import {Cinema2PatternControlResolver} from '../conductor/Cinema2PatternControls'
import {Cinema2PatternAutoPerformance} from './mainframe/Cinema2PatternAutoPerformance'
import {Cinema2MainframePatternController,resolveCinema2MainframeTriggerEventIdentity} from './mainframe/Cinema2MainframePatternController'
import {Cinema2MainframeBeatClockResolver} from './mainframe/Cinema2MainframePatternEngine'
import {resolveCinema2AfterhoursTriggerEventIdentity,type Cinema2AfterhoursTriggerId} from './Cinema2AfterhoursNativeModule'
import {BEAM_LATTICE_PATTERN_IDS,type BeamLatticePattern,beamLatticePattern} from './beamLattice/BeamLatticePatterns'
import {Cinema2ThreeAnimationController} from './three/Cinema2ThreeAnimation'
export const CINEMA2_BEAM_LATTICE_MODULE_TYPE_ID=cinema2StableId<Cinema2ModuleTypeId>('beam-lattice-original')
export class Cinema2BeamLatticeController {
 readonly afterVisibility=true
 private animation:Cinema2ThreeAnimationController|null=null
 private clips:readonly THREE.AnimationClip[]=[]
 private beams:{mesh:THREE.Mesh;position:THREE.Vector3;rotation:THREE.Quaternion;scale:THREE.Vector3;parentRotation:THREE.Quaternion;sampledRotation:THREE.Quaternion}[]=[]
 private thickness=2
 private triggerClock=new Cinema2MainframeBeatClockResolver()
 private previousTriggerBeat:number|null=null
 private context:Cinema2ModuleUpdateContext|null=null
 private clock=new Cinema2BeatClock()
 private selection=new Cinema2MainframePatternController<BeamLatticePattern>(BEAM_LATTICE_PATTERN_IDS,'reference-fan')
 private policy=new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>()
 private performance=new Cinema2PatternAutoPerformance<BeamLatticePattern>({buildPattern:'pressure-cage',dropPattern:'radial-release',buildMaxBeats:32,dropBeats:8,mood:{options:{calm:['reference-fan','iris-gate'],driving:['counter-sweep','bank-relay'],tense:['scissor-cross','pressure-cage'],peak:['radial-release','counter-sweep']}}})
 private weights:number[]=[1,0,0,0,0,0,0]
 private from=[...this.weights]
 private pattern:BeamLatticePattern='reference-fan'
 private overrideReason:string|null=null
 private transitionStart:number|null=null
 private previousTime:number|null=null
 private identity:string|null=null
 private lastBeat:number|null=null
 private lastTimestamp:number|null=null
 private phase=0
 private editRevision:number|null=null
 private autoWasEnabled=false
 private authored:BeamLatticePattern|null=null
 constructor(private readonly library:Cinema2ThreeLibrary){}
 attach(root:THREE.Object3D,_userModel?:boolean,clips:readonly THREE.AnimationClip[]=[]){
  this.animation?.dispose();this.clips=clips;this.beams=[]
  root.traverse(object=>{if((object as THREE.Mesh).isMesh){const mesh=object as THREE.Mesh;this.beams.push({mesh,position:mesh.position.clone(),rotation:mesh.quaternion.clone(),scale:mesh.scale.clone(),parentRotation:mesh.parent!.quaternion.clone(),sampledRotation:mesh.parent!.quaternion.clone()})}})
  this.animation=new Cinema2ThreeAnimationController(this.library.THREE,root,clips)
  if(clips[0]){this.animation.play(clips[0].name,{loop:'repeat'});this.animation.sync(0);this.beams.forEach(beam=>{beam.parentRotation.copy(beam.mesh.parent!.quaternion);beam.sampledRotation.copy(beam.mesh.parent!.quaternion)})}
 }
 update(context:Cinema2ModuleUpdateContext){
  this.context=context;const {frame,parameters}=context,time=frame.audio?.upstream.timeSec??frame.transport?.timeSec??frame.elapsedTimeSec
  const identity=JSON.stringify([frame.contextGeneration,frame.transport?.trackId,frame.audio?.upstream.sourceId,frame.audio?.upstream.analysisRevision,frame.audio?.upstream.timelineRevision,frame.audio?.discontinuity.generation])
  const reset=identity!==this.identity||(this.previousTime!=null&&time<this.previousTime-.01)
  if(reset){this.clock.reset();this.selection.reset();this.policy.reset();this.performance.reset();this.phase=Math.max(0,time);this.beams.forEach(({mesh})=>{delete mesh.userData.beamLatticePose});this.lastBeat=null;this.triggerClock.reset();this.previousTriggerBeat=null;this.transitionStart=null}
  const active=!frame.transport?.paused&&(!frame.transport?.sourcePresent||frame.transport.animationActive!==false)
  const idleDelta=this.lastTimestamp==null?0:Math.max(0,(frame.timestampMs-this.lastTimestamp)/1000)
  const dt=Math.min(.1,Math.max(0,frame.transport?.sourcePresent?frame.deltaTimeSec:idleDelta));this.lastTimestamp=frame.timestampMs
  const timingFrame={...frame,elapsedTimeSec:frame.audio?.upstream.timeSec??frame.elapsedTimeSec,deltaTimeSec:active?dt:0,...(frame.transport?{transport:{...frame.transport,animationActive:active}}:{})}
  const beats=this.clock.update(timingFrame,parameters.get('bpmSync')!==false).beats,delta=this.lastBeat==null?0:Math.max(0,beats-this.lastBeat)
  if(active)this.phase+=delta*this.number('motionRate',1,0,2)/2
  const authored=BEAM_LATTICE_PATTERN_IDS.includes(parameters.get('pattern') as BeamLatticePattern)?parameters.get('pattern') as BeamLatticePattern:'reference-fan',revision=parameters.getEditRevision?.('pattern')??0
  const edited=(this.editRevision!=null&&revision!==this.editRevision)||(this.authored!=null&&authored!==this.authored)
  const auto=parameters.get('autoPerformance')===true&&this.number('reactivity',.65,0,1)>0&&frame.transport?.sourcePresent===true&&(frame.transport.playing||frame.transport.paused)&&frame.mood!=null
  const authorityRestored=this.autoWasEnabled&&!auto;this.autoWasEnabled=auto
  const controls=this.policy.update({saved:{patternChange:parameters.get('patternChange')===true,trigger:(parameters.get('trigger')??'bar4') as Cinema2AfterhoursTriggerId},mood:frame.mood,autoPerformance:auto})
  const triggerTiming=this.triggerClock.resolve(timingFrame,true)
  const drop=resolveCinema2AfterhoursTriggerEventIdentity(frame,'drop',this.previousTime)
  const base=this.selection.update({authoredPattern:authored,patternChange:controls.patternChange,trigger:controls.trigger,triggerEventId:controls.trigger==='drop'?drop:resolveCinema2MainframeTriggerEventIdentity(frame,controls.trigger,this.previousTime,drop,{previousBeat:this.previousTriggerBeat,current:triggerTiming}),absoluteBeat:beats,reset:reset||edited})
  const performing=this.performance.update({enabled:auto,absoluteBeat:beats,buildCharge:frame.mood?.silence&&frame.mood.silence>.5?0:frame.director?.context.build.available?frame.director.context.build.value??0:0,dropEventId:drop,patternEdited:edited,reset,basePattern:base.activePattern,patternChange:controls.patternChange,mood:frame.mood,deltaTimeSec:active?dt:0,seed:identity})
  const next=performing.pattern??base.activePattern
  if(next!==this.pattern){this.from=[...this.weights];this.transitionStart=edited||reset||authorityRestored?null:beats;this.pattern=next}
  if(reset||edited||authorityRestored)this.transitionStart=null
  const t=this.transitionStart==null?1:Math.min(1,Math.max(0,beats-this.transitionStart)),blend=t*t*(3-2*t),index=BEAM_LATTICE_PATTERN_IDS.indexOf(this.pattern)
  if(active||reset||edited||authorityRestored)this.weights=this.from.map((value,i)=>value*(1-blend)+(i===index?blend:0));if(t>=1)this.transitionStart=null
  this.overrideReason=performing.reason;this.lastBeat=beats;this.previousTriggerBeat=triggerTiming.beats;this.previousTime=time;this.identity=identity;this.editRevision=revision;this.authored=authored
 }
 private number(name:string,fallback:number,min:number,max:number){const value=this.context?.parameters.get(name);return typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback}
 beforeDraw(){
  if(!this.context||!this.animation)return
  const T=this.library.THREE,p=this.context.parameters
  // Mixer bindings skip unchanged samples. Restore the unmodified clip pose before sampling,
  // otherwise Bank Travel compounds on every render of a held audio timestamp.
  this.beams.forEach(({mesh,sampledRotation})=>mesh.parent!.quaternion.copy(sampledRotation))
  this.animation.sync(this.phase)
  this.thickness=this.number('referenceBeamThickness',2,.25,4)
  const shape=(bank:number)=>{
   const result={x:0,y:0,z:0,width:0,length:0,light:0}
   BEAM_LATTICE_PATTERN_IDS.forEach((id,i)=>{const v=beamLatticePattern(id,this.phase,bank);for(const key of Object.keys(result) as (keyof typeof result)[])result[key]+=v[key]*(this.weights[i]??0)})
   return result
  }
  const shapes=this.beams.map((_,i)=>shape(i))
  this.beams.forEach(({mesh,position,rotation,scale,parentRotation,sampledRotation},i)=>{
   const v=shapes[i],light=shapes[i].light,travel=this.number('bankTravel',1,0,1.5),aperture=this.number('aperture',1,.65,1.35)
   const parent=mesh.parent!,sampled=parent.quaternion.clone();sampledRotation.copy(sampled)
   const difference=parentRotation.clone().invert().multiply(sampled),axis=new T.Vector3(difference.x,difference.y,difference.z)
   if(Math.abs(travel-1)>1e-9&&axis.lengthSq()>1e-12){axis.normalize();parent.quaternion.copy(parentRotation).multiply(new T.Quaternion().setFromAxisAngle(axis,Math.min(1.33,2*Math.acos(Math.max(-1,Math.min(1,difference.w)))*travel)))}
   // The source stretches the fan normal 20x on its parent. Compensate emitter tilt
   // so a small pattern angle cannot become a near-right-angle fold of the field.
   mesh.quaternion.copy(rotation).multiply(new T.Quaternion().setFromEuler(new T.Euler(v.x*travel/Math.max(1,Math.abs(parent.scale.y)),v.y*travel,v.z*travel)))
   mesh.scale.copy(scale);mesh.scale.x*=v.width*aperture;mesh.scale.y*=this.thickness;mesh.scale.z*=Math.max(4,v.length)
   // Keep the centre of the emitter bank fixed. Scaling about its leftmost ray opened artificial gaps.
   const centre=new T.Vector3(23.931602746248245,0,0),shift=centre.clone().multiply(mesh.scale).applyQuaternion(mesh.quaternion)
   mesh.position.copy(position).add(centre.clone().multiply(scale).applyQuaternion(rotation)).sub(shift)
   const role=['upper','lower','right','left'][i],value=p.get(role+'Color'),rgb=Array.isArray(value)&&value.length>=3?value:[1,1,0]
   const material=mesh.material as THREE.MeshStandardMaterial
   material.color.setRGB(0,0,0);material.emissive.setRGB(Number(rgb[0]),Number(rgb[1]),Number(rgb[2]),T.SRGBColorSpace)
   material.emissiveIntensity=6.019065962867696*this.number('intensity',1,0,2)*this.number(role+'Lighting',1,0,2)*light
  })
 }
 inspect(){return {source:'lasers_-_vj.glb',sourceMeshes:this.beams.length,addedGeometry:0,referenceBeamThickness:this.thickness,clipCount:this.clips.length,clipName:this.clips[0]?.name??null,clipDuration:this.clips[0]?.duration??0,clipTracks:this.clips[0]?.tracks.length??0,timeSec:this.phase,phase:this.phase,animation:this.animation?.getSnapshot()??null,...this.policy.inspect(),pattern:this.pattern,overrideReason:this.overrideReason,patternWeights:[...this.weights]}}
 dispose(){this.animation?.dispose();this.animation=null;this.beams=[];this.clips=[];this.context=null;this.clock.reset();this.selection.reset();this.policy.reset();this.performance.reset();this.triggerClock.reset()}
}
export const cinema2BeamLatticeModuleDefinition=createCinema2ThreeSceneModuleDefinition({typeId:CINEMA2_BEAM_LATTICE_MODULE_TYPE_ID,resourceKey:'beam-lattice-original:bridge',createModelController:library=>new Cinema2BeamLatticeController(library)})
