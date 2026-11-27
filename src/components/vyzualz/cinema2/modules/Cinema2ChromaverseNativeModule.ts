import type { Cinema2CameraFrame } from '../spatial/Cinema2CameraRuntime'
import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import type { Cinema2ModuleDiagnostic, Cinema2ModuleInstance, Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { Cinema2MainframePatternController } from './mainframe/Cinema2MainframePatternController'
import { PROFILES, patterns, controls as authoredControls, palette, defaults as makeDefaults, SIGNALS, clamp, blendedPose, type Profile, type ChromaverseState, type Palette, type Color } from './chromaverse/ChromaverseDomain'
import { ChromaverseChoreography } from './chromaverse/ChromaverseChoreography'
import { Cinema2ThreeSceneBridge, CINEMA2_THREE_DEFAULT_OVERRIDES } from './three/Cinema2ThreeSceneBridge'
import { Cinema2ThreeAssetCache, type Cinema2ThreeLoadedAsset } from './three/Cinema2ThreeAssetCache'
import { cinema2ThreeAssetRegistry } from './three/Cinema2ThreeAssetManifest'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { cloneCinema2AssetScene } from './three/Cinema2ThreeAnimation'

export const chromaverseModuleTypeId=(profile:Profile)=>cinema2StableId<Cinema2ModuleTypeId>(`chromaverse-${profile.key}-native`)
const cache=new Cinema2ThreeAssetCache(cinema2ThreeAssetRegistry,{idleLimit:0})
export interface ChromaverseModuleInstance extends Cinema2ModuleInstance { inspect():Record<string,unknown> }
export function createChromaverseModuleDefinition(profile:Profile):Readonly<Cinema2ModuleTypeDefinition>{
 const PULSE_PATTERNS=patterns(profile), first=PULSE_PATTERNS[0]!, PULSE_CONTROLS=authoredControls(profile), PALETTE=palette(profile), defaults=makeDefaults(profile), assetId=`cinema2-chromaverse-${profile.key}`
 return {typeId:chromaverseModuleTypeId(profile),version:1,create(context):ChromaverseModuleInstance{
  const clock=new Cinema2BeatClock(),controller=new Cinema2MainframePatternController<string>(PULSE_PATTERNS,first),controls=new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>()
  const state:ChromaverseState={values:{...defaults},palette:{...PALETTE},pattern:first,previous:first,transition:1,phase:0,clipTime:0,motion:1,flash:.2,silence:0,cameraMode:'float'}
  let library:Cinema2ThreeLibrary|null=null,asset:Cinema2ThreeLoadedAsset|null=null,root:Awaited<ReturnType<typeof cloneCinema2AssetScene>>|null=null,bridge:Cinema2ThreeSceneBridge|null=null,art:ChromaverseChoreography|null=null
  let drawCamera:Readonly<Cinema2CameraFrame>|null=null
  let reportedGpuBytes=false
  let disposed=false,loading=false,failed=false,bridgeOwnsLease=false,identity='',priorTime:number|null=null,priorBeat=0,priorTimestamp:number|null=null,priorPlaying=false,priorPublication:number|null=null,priorRevision:number|null=null,priorAuto:boolean|null=null,base:string=first,epoch=0
  let priorAuthored:string|null=null;const seen=new Map<Cinema2AfterhoursTriggerId,string>()
  let override:{kind:'build'|'drop';pattern:string;until:number}|null=null,lastBuild:string|null=null,lastDrop:string|null=null,transitionStart=0,transitionClock=0
  const diagnostics:Cinema2ModuleDiagnostic[]=[]
  const report=(error:unknown)=>{failed=true;diagnostics.push({code:'CHROMAVERSE_SCENE_FAILED',message:error instanceof Error?error.message:String(error),path:`$.modules.${profile.key}`,moduleId:context.module.id})}
  const release=()=>{if(asset)cache.release(asset);asset=null;root=null}
  const reset=()=>{clock.reset();controller.reset();controls.reset();seen.clear();priorBeat=state.phase=transitionClock=0;state.clipTime=0;priorTime=null;priorPublication=null;priorPlaying=false;override=null;lastBuild=lastDrop=null;state.transition=1;epoch++}
  return {lifecycle:{update({frame,parameters}){
   if(disposed)return
   const read=(k:string)=>parameters.get(k),v=state.values,transport=frame.transport,audio=frame.audio,time=audio?.upstream.timeSec??transport?.timeSec??frame.elapsedTimeSec
   const playing=!!audio&&transport?.sourcePresent!==false&&transport?.playing!==false&&!transport?.paused&&transport?.animationActive!==false
   const idle=transport?.sourcePresent===false&&!transport.paused,animating=idle||(!transport?.paused&&transport?.animationActive!==false)
   const idleDt=priorTimestamp===null?0:clamp((frame.timestampMs-priorTimestamp)/1000,0,.1);priorTimestamp=frame.timestampMs
   const nextIdentity=JSON.stringify([frame.contextGeneration,transport?.sourcePresent,transport?.trackId,audio?.upstream.sourceId,audio?.upstream.publisherId,audio?.upstream.trackId,audio?.upstream.analysisRevision,audio?.upstream.timelineRevision,audio?.discontinuity?.generation])
   const discontinuity=nextIdentity!==identity||(priorTime!=null&&(time<priorTime-.035||(playing&&time-priorTime>Math.max(1,frame.deltaTimeSec*6))))
   if(discontinuity){reset();identity=nextIdentity}
   for(const [k,,fallback,min,max] of PULSE_CONTROLS){const raw=read(k);v[k]=typeof raw==='number'&&Number.isFinite(raw)?clamp(raw,min,max):fallback}
   for(const k of SIGNALS){const raw=read(k);if(discontinuity||idle)v[k]=0;else if(playing)v[k]=typeof raw==='number'&&Number.isFinite(raw)?clamp(raw):0;else if(!transport?.paused)v[k]=0}
   for(const k of Object.keys(PALETTE) as (keyof Palette)[]){const raw=read(k);state.palette[k]=Array.isArray(raw)&&raw.length===4&&raw.every(c=>typeof c==='number'&&Number.isFinite(c))?raw as unknown as Color:PALETTE[k]}
   const safety=read('motionSafety');state.motion=v.motionAmount!*(safety==='lockoff'?0:safety==='reduced'?.28:1)
   state.flash=v.impactFlash!*(profile.key==='time-tunnel'?0:read('flashAccents')==='full'?1:read('flashAccents')==='off'?0:.4)
   const automatic=read('autoPerformance')===true&&transport?.sourcePresent!==false&&v.reactivity!>0
   state.silence=playing?clamp(frame.mood?.silence??0)*v.reactivity!:transport?.paused?state.silence:0
   const dt=animating&&!discontinuity?(idle?idleDt:clamp(frame.deltaTimeSec,0,.1)):0
   const sync=read('bpmSync')!==false&&transport?.bpmSync!==false&&!idle
   const beatState=clock.update({...frame,elapsedTimeSec:0,deltaTimeSec:dt,...(transport?{transport:{...transport,animationActive:animating}}:{})},sync,120)
   const beat=beatState.beats,step=animating&&!discontinuity?clamp(beat-priorBeat,0,.8):0;priorBeat=beat
   transitionClock+=step
   const triggerValue=read('trigger') as Cinema2AfterhoursTriggerId
   const policy=controls.update({saved:{patternChange:read('patternChange')===true,trigger:CINEMA2_AFTERHOURS_TRIGGER_IDS.includes(triggerValue)?triggerValue:'bar4'},mood:frame.mood,autoPerformance:automatic})
   const publication=audio?.upstream.publicationSequence??null,fresh=playing&&!discontinuity&&priorPlaying&&(publication===null||publication!==priorPublication)
   const rawDrop=playing?(frame.mood?.drop?.occurred?frame.mood.drop.eventId:resolveCinema2AfterhoursTriggerEventIdentity(frame,'drop',priorTime)):null
   const drop=rawDrop&&rawDrop!==lastDrop?rawDrop:null;if(rawDrop)lastDrop=rawDrop
   const raw=playing?(policy.trigger==='drop'?rawDrop:resolveCinema2AfterhoursTriggerEventIdentity(frame,policy.trigger,priorTime)):null
   const authored=read('pattern') as string,revision=parameters.getEditRevision?.('pattern')??0,authority=priorAuto!==automatic
   const selected=PULSE_PATTERNS.includes(authored)?authored:first
   const manual=priorRevision!==null&&(revision!==priorRevision||selected!==priorAuthored)
   const newEvent=raw&&raw!==seen.get(policy.trigger)?raw:null;if(raw)seen.set(policy.trigger,raw)
   const silent=state.silence>.5
   base=controller.update({authoredPattern:selected,patternChange:policy.patternChange,trigger:policy.trigger,triggerEventId:fresh&&(!silent||policy.trigger==='drop')?newEvent:null,absoluteBeat:beat,reset:discontinuity||authority,reselect:manual}).activePattern
   if(discontinuity||manual||authority||!automatic)override=null
   const section=audio?.structure?.section,build=playing&&!silent&&section?.available&&section.value?.type==='build'?section.value.id:null
   if(override&&(transitionClock>=override.until||(override.kind==='build'&&playing&&!build)))override=null
   if(automatic&&fresh&&!manual&&!authority){if(drop)override={kind:'drop',pattern:PULSE_PATTERNS[profile.drop]!,until:transitionClock+8};else if(build&&build!==lastBuild&&override?.kind!=='drop')override={kind:'build',pattern:PULSE_PATTERNS[profile.build]!,until:transitionClock+16}}
   if(playing&&(fresh||!build))lastBuild=build;priorAuto=automatic;priorRevision=revision;priorAuthored=selected
   const next=override?.pattern??base
   const duration=Number(read('transitionLength')??1),transitionBeats=Number.isFinite(duration)?clamp(duration,0,4):1
   if(next!==state.pattern||discontinuity||manual||authority){const immediate=discontinuity||manual||authority;state.previous=immediate?next:state.pattern;state.pattern=next;transitionStart=transitionClock-(immediate?transitionBeats:0)}
   state.transition=transitionBeats===0?1:clamp((transitionClock-transitionStart)/transitionBeats)
   const motion=state.motion*v.playbackSpeed!*(1-.72*state.silence)*(1-.45*v.vocalPresence!)
   const motionStep=(beatState.locked?step/4:dt*.5)*motion
   state.phase+=motionStep*v.flowSpeed!*(1+.25*v.directorMomentum!+.15*v.bassPressure!)
   const pose=blendedPose(profile,state,.5), clipDuration=asset?.animations[0]?.duration??1
   state.clipTime+= (beatState.locked?step*clipDuration/profile.cycles:dt)*motion*(pose.rate/profile.weights[5])*(.5+.5*v.flowSpeed!)
   priorTime=time;priorPlaying=playing;priorPublication=publication
  },dispose(){disposed=true;if(!bridgeOwnsLease){art?.dispose();art=null;release()}bridge=null}},render:{providers:[{id:`${context.module.id}:world`,moduleId:context.module.id,intent:'world',execute(exec){
   if(disposed||failed)return
   if(!asset||!root||!library){
    if(!loading){loading=true;void (async()=>{try{
     const lib=await loadCinema2ThreeLibrary();if(disposed)return
     const loaded=await cache.acquire(lib,assetId,exec.lightingEnvironment?.quality??'high')
     if(disposed){cache.release(loaded);return}
     let cloned:Awaited<ReturnType<typeof cloneCinema2AssetScene>>
     try{cloned=await cloneCinema2AssetScene(loaded.scene)}catch(error){cache.release(loaded);throw error}
     if(disposed){cache.release(loaded);return}
     asset=loaded;root=cloned;library=lib
    }catch(error){release();if(!disposed)report(error)}})()}
    return
   }
   try{
    if(!exec.target||!exec.camera||!exec.lightingEnvironment||!exec.depthAvailable)throw Error('Cinema 2.0 world pass requires target, depth, camera and lighting')
    if(!bridge){
     const owned=asset, prepared=new library.THREE.Group();prepared.add(root)
     bridge=context.resources.acquire(`chromaverse:${profile.key}:world:v2`,'ThreeSceneBridge',gl=>new Cinema2ThreeSceneBridge(gl,library!,[{asset:owned,node:null,preparedScene:prepared,preserveMaterials:true}],{
      hdr:true,strictShaderPreparation:true,modelController:{afterVisibility:true,
       attach(model){art=new ChromaverseChoreography(library!,owned,model,profile)},
       beforeDraw(quality){if(drawCamera)art?.pose(state,quality,epoch,drawCamera)},
       estimateAdditionalGpuBytes:()=>art?.estimateAdditionalGpuBytes()??0,
       dispose(){art?.dispose();art=null},
      },
     }),value=>{try{value.dispose()}finally{release()}})
     bridgeOwnsLease=true
    }
    drawCamera=exec.camera
    try{bridge.draw(exec,{...CINEMA2_THREE_DEFAULT_OVERRIDES,environmentIntensity:state.values.reflection!})}finally{drawCamera=null}
    if(!reportedGpuBytes&&bridge.ready){context.resources.reportGpuBytes(bridge.estimateGpuBytes());reportedGpuBytes=true}
   }catch(error){if(!bridgeOwnsLease){art?.dispose();art=null;release()}report(error)}
  }}]},getDiagnostics:()=>[...diagnostics,...(bridge?.getDiagnostics()??[]).map(d=>({...d,path:`$.modules.${profile.key}`,moduleId:context.module.id}))],inspect:()=>({...controls.inspect(),basePattern:base,performingPattern:state.pattern,previousPattern:state.previous,transition:state.transition,phase:state.phase,clipTime:state.clipTime,beatLocked:clock.getState().locked,overridden:override!==null,ready:bridge?.ready===true&&!failed,failed,...art?.inspect()})}
 }}
}
export const chromaverseModuleDefinitions=PROFILES.map(createChromaverseModuleDefinition)
