import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleDiagnostic, Cinema2ModuleInstance, Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import { defaults, clamp, type ArtifactSpec, type ArtifactState, type Color, type Palette } from './artifactSculptures/ArtifactDomain'
import { ARTIFACT_SPECS } from './artifactSculptures/ArtifactSpecs'
import { ArtifactSelection } from './artifactSculptures/ArtifactSelection'
import { ArtifactRenderer } from './artifactSculptures/ArtifactRenderer'
import { loadCinema2ThreeLibrary, getLoadedCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'

export const artifactModuleTypeId=(id:string)=>cinema2StableId<Cinema2ModuleTypeId>(`${id}-native`)
type Renderer=Pick<ArtifactRenderer,'draw'|'dispose'|'inspect'|'estimateGpuBytes'>
export interface ArtifactModuleInstance extends Cinema2ModuleInstance {inspect():Record<string,unknown>}
export function createArtifactNativeModuleDefinition(spec:ArtifactSpec,createRenderer:(gl:WebGL2RenderingContext,library:Cinema2ThreeLibrary)=>Renderer=(gl,lib)=>new ArtifactRenderer(gl,lib,spec),load=loadCinema2ThreeLibrary):Readonly<Cinema2ModuleTypeDefinition>{
  return Object.freeze<Cinema2ModuleTypeDefinition>({typeId:artifactModuleTypeId(spec.id),version:1,create(context):ArtifactModuleInstance{
    const clock=new Cinema2BeatClock(),selection=new ArtifactSelection(spec),controls=new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>()
    const seen=new Map<Cinema2AfterhoursTriggerId,string>(),diagnostics:Cinema2ModuleDiagnostic[]=[]
    const authoredDefaults=defaults(spec),values:Record<string,number>={...authoredDefaults}
    const state:ArtifactState={values,pattern:spec.patterns[0]!,previous:spec.patterns[0]!,transition:1,phase:0,motion:.8,flash:.28,silence:0,projectionPhase:0,extraEnabled:true,palette:{...spec.palette}}
    let selected={base:spec.patterns[0]!,performing:spec.patterns[0]!,previous:spec.patterns[0]!,transition:1,overridden:false}
    let renderer:Renderer|null=null,library=getLoadedCinema2ThreeLibrary(),loading=false,disposed=false,failed=false
    let priorTime:number|null=null,priorBeat=0,elapsed=0,identity='',priorPlaying=false,priorPublication:number|null=null,lastDrop:string|null=null,lastTimestamp:number|null=null
    const reset=()=>{clock.reset();selection.reset();controls.reset();seen.clear();priorBeat=elapsed=state.phase=state.projectionPhase=0;priorTime=null;priorPublication=null;lastDrop=null}
    const report=(error:unknown)=>{failed=true;diagnostics.push({code:'ARTIFACT_RENDER_FAILED',message:error instanceof Error?error.message:String(error),path:`$.modules.${spec.id}-system`})}
    return {lifecycle:{update({frame,parameters}){
      if(disposed)return
      const read=(k:string)=>parameters.get(k)
      const transport=frame.transport,audio=frame.audio,time=audio?.upstream.timeSec??transport?.timeSec??frame.elapsedTimeSec
      const playing=!!audio&&transport?.sourcePresent!==false&&transport?.playing!==false&&!transport?.paused&&transport?.animationActive!==false
      const idle=transport?.sourcePresent===false&&!transport.paused
      const animating=idle||(transport?.animationActive!==false&&!transport?.paused)
      const idleDt=lastTimestamp===null?0:clamp((frame.timestampMs-lastTimestamp)/1000,0,.1)
      lastTimestamp=frame.timestampMs
      const nextIdentity=JSON.stringify([frame.contextGeneration,transport?.sourcePresent,transport?.trackId,audio?.upstream.sourceId,audio?.upstream.publisherId,audio?.upstream.trackId,audio?.upstream.analysisRevision,audio?.upstream.timelineRevision,audio?.discontinuity.generation])
      const discontinuity=nextIdentity!==identity||(priorTime!=null&&(time<priorTime-.035||(playing&&time-priorTime>Math.max(1,frame.deltaTimeSec*6))))
      if(discontinuity){reset();identity=nextIdentity}
      for(const [key,fallback] of Object.entries(authoredDefaults)){
        const k=key,raw=read(k)
        // Shared signal targets have zero defaults; discard stale held signals at source boundaries.
        values[k]=fallback===0&&(!playing||discontinuity)?0:typeof raw==='number'&&Number.isFinite(raw)?raw:fallback
      }
      for(const key of Object.keys(spec.palette) as (keyof Palette)[]){
        const raw=read(key);state.palette[key]=Array.isArray(raw)&&raw.length===4&&raw.every(c=>typeof c==='number'&&Number.isFinite(c))?raw as unknown as Color:spec.palette[key]
      }
      const dt=animating&&!discontinuity?(idle?idleDt:clamp(frame.deltaTimeSec,0,.1)):0
      const beat=clock.update({...frame,elapsedTimeSec:0,deltaTimeSec:dt,...(transport?{transport:{...transport,animationActive:animating}}:{})},read('bpmSync')!==false&&transport?.bpmSync!==false&&!idle,100).beats
      const step=animating&&!discontinuity?clamp(beat-priorBeat,0,.8):0;priorBeat=beat
      elapsed+=dt
      const automatic=read('autoPerformance')===true&&transport?.sourcePresent!==false&&values.reactivity>0
      const triggerValue=read('trigger') as Cinema2AfterhoursTriggerId
      const trigger=CINEMA2_AFTERHOURS_TRIGGER_IDS.includes(triggerValue)?triggerValue:'bar4'
      const policy=controls.update({saved:{patternChange:read('patternChange')===true,trigger},mood:frame.mood,autoPerformance:automatic})
      const publication=audio?.upstream.publicationSequence??null,fresh=playing&&!discontinuity&&priorPlaying&&publication!==priorPublication
      const raw=playing?resolveCinema2AfterhoursTriggerEventIdentity(frame,policy.trigger,priorTime):null
      const rawDrop=playing?(frame.mood?.drop.occurred?frame.mood.drop.eventId:resolveCinema2AfterhoursTriggerEventIdentity(frame,'drop',priorTime)):null
      const drop=rawDrop&&rawDrop!==lastDrop?rawDrop:null;if(rawDrop)lastDrop=rawDrop
      const event=policy.trigger==='drop'?(rawDrop??raw):raw
      const newEvent=event&&event!==seen.get(policy.trigger)?event:null;if(event)seen.set(policy.trigger,event)
      const silent=(frame.mood?.silence??0)>=.5,section=audio?.structure.section
      const build=playing&&!silent&&section?.available&&section.value?.type==='build'?section.value.id:null
      const authored=read('pattern') as string
      selected=selection.update({authored:spec.patterns.includes(authored)?authored:spec.patterns[0]!,revision:parameters.getEditRevision?.('pattern')??0,patternChange:policy.patternChange,trigger:policy.trigger,event:fresh&&(!silent||policy.trigger==='drop')?newEvent:null,auto:automatic,buildEvent:build,dropEvent:fresh?drop:null,time:elapsed,beat,active:playing,reset:discontinuity})
      state.extraEnabled=!spec.extra||read(spec.extra.key)!==false;state.pattern=selected.performing;state.previous=selected.previous;state.transition=selected.transition
      state.motion=clamp(values.motionAmount)*(read('motionSafety')==='lockoff'?0:read('motionSafety')==='reduced'?.4:1)
      state.flash=read('flashAccents')==='full'?1:read('flashAccents')==='off'?0:.28
      state.silence=automatic?clamp(frame.mood?.silence??0)*clamp(values.reactivity):0
      const pace=step*state.motion*(playing?1:.42)*(1-.88*state.silence)
      state.phase+=pace*clamp(values.motionRate,0,1.5)*(1+.17*values.directorMomentum+.08*values.variation)
      state.projectionPhase+=pace*clamp(values.projectionSpeed,0,1.2)*(.14+.09*values.phraseAccent+.06*values.buildAmount)
      priorTime=time;priorPlaying=playing;priorPublication=publication
    },dispose(){disposed=true;reset();renderer=null}},render:{providers:[{id:`${context.module.id}:artifact-world`,moduleId:context.module.id,intent:'world',execute(exec){
      if(disposed||failed)return
      if(!library){if(!loading){loading=true;void load().then(lib=>{if(!disposed)library=lib},error=>{if(!disposed)report(error)})}return}
      if(!renderer)renderer=context.resources.acquire(`${spec.id}:world:v1`,'ArtifactRenderer',gl=>createRenderer(gl,library!),r=>r.dispose())
      renderer.draw(exec,state);context.resources.reportGpuBytes(renderer.estimateGpuBytes())
    }}]},getDiagnostics:()=>diagnostics,inspect:()=>({...controls.inspect(),basePattern:selected.base,performingPattern:selected.performing,previousPattern:selected.previous,transition:selected.transition,overridden:selected.overridden,phase:state.phase,projectionPhase:state.projectionPhase,beatLocked:clock.getState().locked,ready:!!renderer,...renderer?.inspect()})}
  }})
}
export const artifactNativeModuleDefinitions=ARTIFACT_SPECS.map(spec=>createArtifactNativeModuleDefinition(spec))
