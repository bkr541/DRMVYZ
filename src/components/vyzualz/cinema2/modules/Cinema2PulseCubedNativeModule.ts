import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import type { Cinema2ModuleDiagnostic, Cinema2ModuleInstance, Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { Cinema2MainframePatternController } from './mainframe/Cinema2MainframePatternController'
import { PULSE_PATTERNS, PULSE_CONTROLS, PALETTE, SIGNALS, defaults, clamp, blendedPose, type PulsePattern, type PulseState, type Palette, type Color } from './pulseCubed/PulseCubedDomain'
import { PulseCubedRenderer } from './pulseCubed/PulseCubedRenderer'
import { Cinema2ThreeAssetCache, type Cinema2ThreeLoadedAsset } from './three/Cinema2ThreeAssetCache'
import { cinema2ThreeAssetRegistry } from './three/Cinema2ThreeAssetManifest'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { cloneCinema2AssetScene } from './three/Cinema2ThreeAnimation'

export const CINEMA2_PULSE_CUBED_MODULE_TYPE_ID=cinema2StableId<Cinema2ModuleTypeId>('pulse-cubed-native')
export const PULSE_CUBED_ASSET_ID='cinema2-crate-nested-pulse'
const cache=new Cinema2ThreeAssetCache(cinema2ThreeAssetRegistry)
export interface PulseCubedModuleInstance extends Cinema2ModuleInstance { inspect():Record<string,unknown> }
export function createCinema2PulseCubedNativeModuleDefinition():Readonly<Cinema2ModuleTypeDefinition>{
 return {typeId:CINEMA2_PULSE_CUBED_MODULE_TYPE_ID,version:1,create(context):PulseCubedModuleInstance{
  const clock=new Cinema2BeatClock(),controller=new Cinema2MainframePatternController<PulsePattern>(PULSE_PATTERNS,'circulation'),controls=new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>()
  const state:PulseState={values:{...defaults},palette:{...PALETTE},pattern:'circulation',previous:'circulation',transition:1,phase:0,rotationPhases:[0,0,0,0],pulsePhases:[0,0,0,0],motion:1,flash:.3,silence:0,enclosure:true,particles:false,flow:'pattern',cameraMode:'float'}
  let library:Cinema2ThreeLibrary|null=null,asset:Cinema2ThreeLoadedAsset|null=null,root:Awaited<ReturnType<typeof cloneCinema2AssetScene>>|null=null,renderer:PulseCubedRenderer|null=null
  let disposed=false,loading=false,failed=false,rendererOwnsLease=false,identity='',priorTime:number|null=null,priorBeat=0,priorTimestamp:number|null=null,priorPlaying=false,priorPublication:number|null=null,priorRevision:number|null=null,priorAuto:boolean|null=null,base:PulsePattern='circulation',epoch=0
  let priorAuthored:PulsePattern|null=null;const seen=new Map<Cinema2AfterhoursTriggerId,string>()
  let override:{kind:'build'|'drop';pattern:PulsePattern;until:number}|null=null,lastBuild:string|null=null,lastDrop:string|null=null,transitionStart=0,transitionClock=0
  const diagnostics:Cinema2ModuleDiagnostic[]=[]
  const report=(error:unknown)=>{failed=true;diagnostics.push({code:'PULSE_CUBED_RENDER_FAILED',message:error instanceof Error?error.message:String(error),path:'$.modules.pulse-cubed-system',moduleId:context.module.id})}
  const release=()=>{if(asset)cache.release(asset);asset=null;root=null}
  const reset=()=>{clock.reset();controller.reset();controls.reset();seen.clear();priorBeat=state.phase=transitionClock=0;state.rotationPhases.fill(0);state.pulsePhases.fill(0);priorTime=null;priorPublication=null;priorPlaying=false;override=null;lastBuild=lastDrop=null;state.transition=1;epoch++}
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
   state.enclosure=read('enclosure')!==false;state.particles=read('particles')===true;state.flow=String(read('flow')??'pattern');state.cameraMode=String(read('cameraMode')??'float')
   const safety=read('motionSafety');state.motion=v.motionAmount!*(safety==='lockoff'?0:safety==='reduced'?.28:1)
   state.flash=v.impactFlash!*(read('flashAccents')==='full'?1:read('flashAccents')==='off'?0:.4)
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
   const authored=read('pattern') as PulsePattern,revision=parameters.getEditRevision?.('pattern')??0,authority=priorAuto!==automatic
   const selected=PULSE_PATTERNS.includes(authored)?authored:'circulation'
   const manual=priorRevision!==null&&(revision!==priorRevision||selected!==priorAuthored)
   const newEvent=raw&&raw!==seen.get(policy.trigger)?raw:null;if(raw)seen.set(policy.trigger,raw)
   const silent=state.silence>.5
   base=controller.update({authoredPattern:selected,patternChange:policy.patternChange,trigger:policy.trigger,triggerEventId:fresh&&(!silent||policy.trigger==='drop')?newEvent:null,absoluteBeat:beat,reset:discontinuity||authority,reselect:manual}).activePattern
   if(discontinuity||manual||authority||!automatic)override=null
   const section=audio?.structure?.section,build=playing&&!silent&&section?.available&&section.value?.type==='build'?section.value.id:null
   if(override&&(transitionClock>=override.until||(override.kind==='build'&&playing&&!build)))override=null
   if(automatic&&fresh&&!manual&&!authority){if(drop)override={kind:'drop',pattern:'supernova',until:transitionClock+8};else if(build&&build!==lastBuild&&override?.kind!=='drop')override={kind:'build',pattern:'inward-collapse',until:transitionClock+16}}
   if(playing&&(fresh||!build))lastBuild=build;priorAuto=automatic;priorRevision=revision;priorAuthored=selected
   const next=override?.pattern??base
   const duration=Number(read('transitionLength')??1),transitionBeats=Number.isFinite(duration)?clamp(duration,0,4):1
   if(next!==state.pattern||discontinuity||manual||authority){const immediate=discontinuity||manual||authority;state.previous=immediate?next:state.pattern;state.pattern=next;transitionStart=transitionClock-(immediate?transitionBeats:0)}
   state.transition=transitionBeats===0?1:clamp((transitionClock-transitionStart)/transitionBeats)
   // Integrate rate changes without resetting authored clip phases. With sync off a full 9.33s cycle is retained at rate 1.
   const motionStep=(beatState.locked?step/8:dt/9.333333)*state.motion*v.playbackSpeed!*(1-.72*state.silence)*(1-.55*v.vocalPresence!)
   state.phase+=motionStep
   for(let i=0;i<4;i++){
    const p=blendedPose(state,i),direction=state.flow==='forward'?1:state.flow==='reverse'?-1:state.flow==='alternating'?(i%2?-1:1):Math.sign(p[1]!)
    const rotationDirection=p[0]!<0?1-2*v.counterRotation!:1
    state.rotationPhases[i]!+=motionStep*Math.abs(p[0]!)*rotationDirection*v.rotationSpeed!/.65*(1+.3*v.midAmount!+.18*v.lowMidAmount!)
    state.pulsePhases[i]!+=motionStep*(beatState.locked?2:1)*Math.abs(p[1]!)*direction*v.pulseSpeed!*(1+.18*v.beatAccent!+.14*v.directorMomentum!+.1*v.highsAmount!)
   }
   priorTime=time;priorPlaying=playing;priorPublication=publication
  },dispose(){disposed=true;if(!rendererOwnsLease)release();renderer=null}},render:{providers:[{id:`${context.module.id}:world`,moduleId:context.module.id,intent:'world',execute(exec){
   if(disposed||failed)return
   if(!asset||!root||!library){
    if(!loading){loading=true;void (async()=>{try{
     const lib=await loadCinema2ThreeLibrary();if(disposed)return
     const loaded=await cache.acquire(lib,PULSE_CUBED_ASSET_ID,exec.lightingEnvironment?.quality??'high')
     if(disposed){cache.release(loaded);return}asset=loaded
     const cloned=await cloneCinema2AssetScene(loaded.scene);if(disposed)return
     root=cloned;library=lib
    }catch(error){release();if(!disposed)report(error)}})()}
    return
   }
   try{
    if(!renderer){const owned=asset;renderer=context.resources.acquire('pulse-cubed:world:v1','PulseCubedRenderer',gl=>new PulseCubedRenderer(gl,library!,owned,root!,i=>context.randomness.sample('pulse-motes',i)),r=>{try{r.dispose()}finally{release()}});rendererOwnsLease=true}
    renderer.draw(exec,state,epoch);context.resources.reportGpuBytes(renderer.estimateGpuBytes())
   }catch(error){if(!rendererOwnsLease)release();report(error)}
  }}]},getDiagnostics:()=>diagnostics,inspect:()=>({...controls.inspect(),basePattern:base,performingPattern:state.pattern,previousPattern:state.previous,transition:state.transition,phase:state.phase,rotationPhases:[...state.rotationPhases],pulsePhases:[...state.pulsePhases],beatLocked:clock.getState().locked,overridden:override!==null,ready:!!renderer,...renderer?.inspect()})}
 }}
}
export const cinema2PulseCubedNativeModuleDefinition=createCinema2PulseCubedNativeModuleDefinition()
