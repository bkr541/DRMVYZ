import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import { Cinema2AudioIntelligenceBridge } from '../../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2ChoreographyRuntime } from '../../choreography/Cinema2ChoreographyRuntime'
import { Cinema2VisualDirector } from '../../director/Cinema2VisualDirector'
import { CINEMA2_HUD_PRESET_MANIFEST as manifest,hudParameterId } from '../../presets/Cinema2HudPreset'
import { compileCinema2NativePreset } from '../../presets/Cinema2PresetCompiler'
import { withCinema2AutoCoverage } from '../../presets/Cinema2AutoCoverage'
import { Cinema2ParameterState } from '../../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../../parameters/Cinema2TargetRuntime'
import { createCinema2HudNativeModuleDefinition,type HudModuleInstance } from '../../modules/Cinema2HudNativeModule'
import { Cinema2ModuleResourceScope } from '../../modules/Cinema2ModuleResources'
import { Cinema2CameraRuntime } from '../../spatial/Cinema2CameraRuntime'
import { Cinema2SpatialRuntime } from '../../spatial/Cinema2SpatialRuntime'
import type { Cinema2ModuleCreateContext,Cinema2ModuleFrameReadContext } from '../../modules/Cinema2ModuleContracts'

import { Cinema2MoodConductor } from '../../conductor/Cinema2MoodConductor'
import type { Cinema2VisualDirectorFrame } from '../../director/Cinema2VisualDirector'

// Actual compiled targets, persistent state, bridge, Director, shared dispatch, native
// lifecycle and camera. Renderer injection captures native draw records, not pixels.
const compiled=compileCinema2NativePreset(withCinema2AutoCoverage(manifest));if(!compiled.ok)throw Error(JSON.stringify(compiled.diagnostics));const plan=compiled.plan
export function hudRuntimeFixture(useMood=false){
  const state=new Cinema2ParameterState(plan.parameters)
  let instance:HudModuleInstance,geometry:Float32Array=new Float32Array()
  const module=plan.manifest.modules![0]!
  let resources=new Cinema2ModuleResourceScope({} as WebGL2RenderingContext,()=>{})
  const resolver=new Cinema2FinalValueResolver(plan.targets,{resolveBaseValue:t=>t.parameterId==null?t.authoredBaseValue:state.getValue(t.parameterId),readEditRevision:t=>t.parameterId==null?0:state.getEditRevision(t.parameterId)})
  const target=(key:string)=>plan.targets.targets.find(t=>t.kind==='module'&&t.ownerId===module.id&&t.property===key)
  const parameters:Cinema2ModuleCreateContext['parameters']={getAuthored:key=>module.parameters?.[key],getEditRevision:key=>{const t=target(key);return t?resolver.getEditRevision(t.id):0},get:key=>{const t=target(key);return t?resolver.resolve(t.id).value:undefined},resolve:key=>{const t=target(key);return t?resolver.resolve(t.id):null}}
  const unused=()=>{throw Error('Unexpected test facet use')}
  const context:Cinema2ModuleCreateContext={module,resources,parameters,targets:{getTarget:()=>null,resolve:unused,dispatch:unused},media:{get:()=>null,getSlot:()=>null},randomness:{sample:unused,probability:unused,stream:unused,eventStream:unused}}
  const native=createCinema2HudNativeModuleDefinition(()=>({draw(_matrix,_eye,_palette,next){geometry=next},dispose(){},estimateGpuBytes:()=>0,inspect:()=>({drawCalls:1,triangles:0,primitiveCount:geometry.length/12,estimatedGpuBytes:0})}))
  instance=native.create(context) as HudModuleInstance
  const choreography=new Cinema2ChoreographyRuntime(plan,state,resolver),director=new Cinema2VisualDirector(),conductor=new Cinema2MoodConductor()
  const spatial=new Cinema2SpatialRuntime(plan.scene,plan.targets.targets,resolver),camera=new Cinema2CameraRuntime(plan,state,resolver,spatial)
  let source:MusicIntelligenceFrame={...DEFAULT_MI_FRAME,sourceId:'hud-fixture',trackId:'track',frameId:1,timeSec:1,capabilities:{...DEFAULT_MI_FRAME.capabilities!,liveBands:true,rhythmEvents:true,beatGrid:true,stemCurves:true,sections:true},rhythm:{...DEFAULT_MI_FRAME.rhythm,bpm:120,bpmConfidence:1,transientConfidence:1},confidence:{...DEFAULT_MI_FRAME.confidence,overall:1,rhythm:1,section:1}}
  let sequence=1,frameId=0,paused=false,sync=true,present=true,generation=1
  const bridge=new Cinema2AudioIntelligenceBridge({getFrame:()=>source,getPublicationMeta:()=>({sequence,publishedAtMs:source.timeSec*1000,publisherId:'hud-fixture',kind:'frame'})})
  function tick(patch:Partial<MusicIntelligenceFrame>={},hold=false,dt=1/30,adjustDirector?:(director:Readonly<Cinema2VisualDirectorFrame>)=>Readonly<Cinema2VisualDirectorFrame>){
    if(!hold){source={...source,frameId:source.frameId+1,timeSec:source.timeSec+dt,...patch};sequence++}
    const audio=present?bridge.capture(++frameId):null
    const canonical=audio?director.capture(audio):null
    const directorFrame=canonical&&adjustDirector?adjustDirector(canonical):canonical
    const mood=useMood?conductor.capture(audio,directorFrame,paused?0:dt):null
    const frame:Cinema2ModuleFrameReadContext={frameId,timestampMs:frameId*dt*1000,elapsedTimeSec:frameId*dt,deltaTimeSec:paused?0:dt,viewport:{width:960,height:540,dpr:1},contextGeneration:generation,audio,director:directorFrame,mood,transport:{sourcePresent:present,playing:present&&!paused,animationActive:present&&!paused,analysisActive:present,paused,trackId:present?source.trackId:null,timeSec:source.timeSec,bpm:source.rhythm.bpm,bpmSync:sync}}
    choreography.update(frame);instance.lifecycle.update({frame,parameters,targets:context.targets})
    instance.render!.providers[0]!.execute({frame,target:null,width:960,height:540,depthAvailable:true,camera:camera.update(frame)})
    return {geometry,frame,inspection:instance.inspect(),choreography:choreography.getSnapshot()}
  }
  const set=(key:string,v:unknown)=>{if(!state.setPersistentValue(hudParameterId(key),v).ok)throw Error(`Invalid fixture parameter ${key}`)}
  return {tick,set,state,parameters,plan,resolver,getSource:()=>source,pause:(v:boolean)=>{paused=v},sync:(v:boolean)=>{sync=v},present:(v:boolean)=>{present=v},reenter:()=>{instance.lifecycle.dispose();resources.disposeAll();resources=new Cinema2ModuleResourceScope({} as WebGL2RenderingContext,()=>{});instance=native.create({...context,resources}) as HudModuleInstance;generation++}}
}
