import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import { cinema2StableId, type Cinema2Color, type Cinema2ModuleTypeId, type Cinema2MediaSlotId } from '../contracts/Cinema2NativePresetManifest'
import { Cinema2MediaSlotRuntime } from '../media/Cinema2MediaSlotRuntime'
import type { Cinema2MediaPoolSource } from '../media/Cinema2MediaPoolSource'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import type { Cinema2ModuleCreateContext, Cinema2ModuleDiagnostic, Cinema2ModuleTypeDefinition, Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import { DEFAULT_OVERDRIVE_LOOK, OVERDRIVE_COLORS, OVERDRIVE_PATTERNS, OVERDRIVE_POSES, OverdriveScene, type OverdriveLook, type OverdrivePattern, type OverdrivePose } from './overdrive/OverdriveScene'
import { Cinema2MainframePatternController, createCinema2MainframePatternCycle } from './mainframe/Cinema2MainframePatternController'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { Cinema2ThreeSceneBridge, CINEMA2_THREE_DEFAULT_OVERRIDES } from './three/Cinema2ThreeSceneBridge'
import { describeCinema2LoadedModel } from './three/Cinema2ThreeAssetMetadata'

export const CINEMA2_OVERDRIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('overdrive-native')
const poolSlot=cinema2StableId<Cinema2MediaSlotId>('overdrive-pool-channel')
const poolSlots=[{id:poolSlot,label:'Core Pool',accepts:['image','video','svg'] as const}]
type Merge=typeof import('three/examples/jsm/utils/BufferGeometryUtils.js')['mergeGeometries']

/** A single transient decoder. Keep the last ready picture until replacement completes. */
export class OverdrivePool {
  private scope='';private generation=0;private cursor=0;private lastEvent:string|null=null;private pending=false;private disposed=false
  constructor(private readonly source:Cinema2MediaPoolSource,private readonly slots:Cinema2MediaSlotRuntime){}
  update(identity:string,event:string|null,reset:boolean,paused:boolean,enabled:boolean){
    if(this.disposed)return
    const selection=enabled?this.source.getSelection():null
    const ids=[...new Set(selection?.mediaIds??[])]
    const scope=JSON.stringify([identity,selection?.id??null,ids])
    if(scope!==this.scope||reset){this.scope=scope;this.generation++;this.cursor=0;this.pending=false;this.lastEvent=event;this.slots.remove(poolSlot);if(ids.length)this.load(ids[0]!)}
    else if(event&&event!==this.lastEvent){this.lastEvent=event;if(ids.length&&!this.pending){this.cursor=(this.cursor+1)%ids.length;this.load(ids[this.cursor]!)}}
    this.slots.updateVideoTextures(paused)
  }
  private load(id:string){const generation=this.generation;this.pending=true;void Promise.resolve().then(()=>this.source.resolve(id)).then(source=>{if(!this.disposed&&generation===this.generation&&source?.id===id)return this.slots.replace(poolSlot,source,{fit:'contain'})}).catch(()=>{/* retry on next musical event */}).finally(()=>{if(generation===this.generation)this.pending=false})}
  get resource(){return this.slots.getManagedResource(poolSlot)}
  dispose(){this.disposed=true;this.generation++;this.slots.dispose()}
}
export class Cinema2OverdrivePerformance {
  private readonly clock=new Cinema2BeatClock()
  private readonly policy=new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>()
  private readonly controller:Cinema2MainframePatternController<OverdrivePattern>
  private identity='';private lastTime:number|null=null;private lastBeat:number|null=null;private lastPattern:OverdrivePattern='core-lock';private phase=0
  private basePattern:OverdrivePattern='core-lock';private pose:OverdrivePose=OVERDRIVE_POSES['core-lock']
  look:OverdriveLook=DEFAULT_OVERDRIVE_LOOK
  poolFrame={identity:'',event:null as string|null,reset:false,paused:true}
  constructor(sample:(index:number)=>number){this.controller=new Cinema2MainframePatternController(createCinema2MainframePatternCycle(sample,OVERDRIVE_PATTERNS.map(p=>p.value)),'core-lock')}
  update({frame,parameters}:Cinema2ModuleUpdateContext){
    const time=frame.transport?.timeSec??frame.audio?.upstream.timeSec??frame.elapsedTimeSec
    const identity=JSON.stringify([frame.contextGeneration,frame.transport?.trackId,frame.audio?.upstream.sourceId,frame.audio?.upstream.publisherId,frame.audio?.discontinuity.generation,frame.audio?.upstream.analysisRevision,frame.audio?.upstream.timelineRevision])
    const reset=identity!==this.identity||(this.lastTime!=null&&(time<this.lastTime-.035||time-this.lastTime>Math.max(1,frame.deltaTimeSec*6)))
    if(reset){this.clock.reset();this.policy.reset();this.controller.reset();this.lastBeat=null;this.phase=0}
    const n=(key:string,fallback:number,min=0,max=1)=>{const v=parameters.get(key);return typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback}
    const str=(key:string,fallback:string)=>{const v=parameters.get(key);return typeof v==='string'?v:fallback}
    const rgba=(key:keyof typeof OVERDRIVE_COLORS):Cinema2Color=>{const v=parameters.get(key);return Array.isArray(v)&&v.length===4&&v.every(c=>typeof c==='number'&&Number.isFinite(c))?[v[0],v[1],v[2],v[3]]:OVERDRIVE_COLORS[key]}
    const beat=this.clock.update(frame,parameters.get('bpmSync')!==false&&frame.transport?.bpmSync!==false).beats
    const active=frame.transport?.playing===true&&frame.transport.animationActive&&!frame.transport.paused
    const paused=frame.transport?.paused===true&&!reset
    const auto=parameters.get('autoPerformance')===true&&frame.transport?.sourcePresent===true
    const motion=n('motion',.65),reactivity=n('reactivity',.75)
    const authored=OVERDRIVE_PATTERNS.find(p=>p.value===parameters.get('pattern'))?.value??'core-lock'
    const trigger=CINEMA2_AFTERHOURS_TRIGGER_IDS.find(v=>v===parameters.get('trigger'))??'bar4'
    const controls=this.policy.update({saved:{patternChange:parameters.get('patternChange')===true,trigger},mood:frame.mood,autoPerformance:auto&&(active||paused)})
    const silence=auto&&(frame.mood?.silence??0)>.5
    const hold=!reset&&authored===this.lastPattern&&silence&&controls.automatic&&!controls.patternChange
    if(!hold){const next=this.controller.update({authoredPattern:authored,patternChange:controls.patternChange,trigger:controls.trigger,absoluteBeat:beat,reset,triggerEventId:active&&!silence?resolveCinema2AfterhoursTriggerEventIdentity(frame,controls.trigger,reset?null:this.lastTime):null});this.basePattern=next.activePattern}
    if(active&&!silence&&this.lastBeat!=null)this.phase+=Math.max(0,Math.min(1,beat-this.lastBeat))
    const signal=(key:'energy'|'bass'|'mid'|'high'|'vocal'|'kick'|'snare'|'beat'|'build'|'drop'|'phrase')=>paused?this.look[key]:active&&!silence?n(key,0):0
    const build=signal('build'),drop=signal('drop')
    const pattern=auto&&drop>.18?'overload':auto&&build>.52?'compression':this.basePattern
    const target=OVERDRIVE_POSES[pattern]
    const lerp=reset||authored!==this.lastPattern?1:paused?0:1-Math.exp(-Math.max(0,Math.min(.25,frame.deltaTimeSec))*7)
    this.pose=target.map((v,i)=>this.pose[i]!+(v-this.pose[i]!)*lerp) as unknown as OverdrivePose
    this.look={pattern,pose:this.pose,phase:this.phase,motion,intensity:n('intensity',.85,0,2),reactivity,size:n('size',1,.7,1.35),separation:n('separation',.02),rotation:n('rotation',.35,0,1.5),compression:n('compression',.15),piston:n('piston',.35),speaker:n('speaker',.45),aperture:n('aperture',.2),relay:n('relay',.5),brightness:n('brightness',1.1,0,2),roughness:n('roughness',.32,.12,.9),reflection:n('reflection',.65,0,1.5),spill:n('spill',.65,0,1.5),key:n('key',.7,0,2),detail:n('detail',1),mode:str('mode','auto'),style:str('style','led'),text:str('text','OVERDRIVE'),mediaScale:n('mediaScale',1,.5,1.5),mediaRotation:n('mediaRotation',0,-180,180),colors:{background:rgba('background'),metal:rgba('metal'),titanium:rgba('titanium'),carbon:rgba('carbon'),core:rgba('core'),conduit:rgba('conduit'),rim:rgba('rim'),accent:rgba('accent')},energy:signal('energy'),bass:signal('bass'),mid:signal('mid'),high:signal('high'),vocal:signal('vocal'),kick:signal('kick'),snare:signal('snare'),beat:signal('beat'),build,drop,phrase:signal('phrase')}
    const mediaTrigger=CINEMA2_AFTERHOURS_TRIGGER_IDS.find(v=>v===parameters.get('poolTrigger'))??'bar4'
    this.poolFrame={identity,reset,paused:!active,event:active&&!silence?resolveCinema2AfterhoursTriggerEventIdentity(frame,mediaTrigger,reset?null:this.lastTime):null}
    this.identity=identity;this.lastTime=time;this.lastBeat=beat;this.lastPattern=authored
  }
  inspect(){return {...this.policy.inspect(),activePattern:this.look.pattern,basePattern:this.basePattern,phase:this.phase,drop:this.look.drop}}
}
export const cinema2OverdriveNativeModuleDefinition:Readonly<Cinema2ModuleTypeDefinition>={
  typeId:CINEMA2_OVERDRIVE_MODULE_TYPE_ID,version:1,
  create(context:Cinema2ModuleCreateContext){
    const performance=new Cinema2OverdrivePerformance(i=>context.randomness.sample('overdrive-pattern-order',i))
    const pool=context.mediaPoolSource?context.resources.acquire('overdrive:pool','OverdriveMediaPool',gl=>new OverdrivePool(context.mediaPoolSource!,new Cinema2MediaSlotRuntime(gl,poolSlots)),p=>p.dispose()):null
    let setup:{library:Cinema2ThreeLibrary;merge:Merge}|null=null,scene:OverdriveScene|null=null,bridge:Cinema2ThreeSceneBridge|null=null
    let starting=false,disposed=false,aspect=16/9,reported=-1
    const diagnostics:Cinema2ModuleDiagnostic[]=[]
    const report=(error:unknown)=>diagnostics.push({code:'CINEMA2_OVERDRIVE_FAILED',message:error instanceof Error?error.message:String(error),path:'$.modules'})
    return {lifecycle:{update(update:Cinema2ModuleUpdateContext){performance.update(update);const f=performance.poolFrame;pool?.update(f.identity,f.event,f.reset,f.paused,(performance.look.mode==='pool'||performance.look.mode==='auto'))},dispose(){disposed=true}},render:{providers:[{
      id:`${context.module.id}:chamber`,moduleId:context.module.id,intent:'world' as const,
      execute(execution){if(disposed||diagnostics.length)return;aspect=execution.camera?.aspect??execution.width/Math.max(1,execution.height)
        if(!starting){starting=true;void Promise.all([loadCinema2ThreeLibrary(),import('three/examples/jsm/utils/BufferGeometryUtils.js')]).then(([library,{mergeGeometries}])=>{if(!disposed)setup={library,merge:mergeGeometries}}).catch(e=>{if(!disposed)report(e)})}
        if(setup&&!bridge){const {library,merge}=setup;const root=new library.THREE.Group();try{bridge=context.resources.acquire('overdrive:scene','OverdriveThreeChamber',gl=>new Cinema2ThreeSceneBridge(gl,library,[{asset:{id:'overdrive-geometry',scene:root,animations:[],triangleCount:0,gpuBytes:0,metadata:describeCinema2LoadedModel(root)},node:null,preserveMaterials:true}],{hdr:true,modelController:{attach:r=>{scene=new OverdriveScene(library,merge,r)},beforeDraw:quality=>{const look=performance.look;const direct=context.media.get('coreMedia');const usePool=look.mode==='pool'||(look.mode==='auto'&&context.mediaPoolSource?.getSelection()!=null);const media=usePool?pool?.resource??null:direct;scene?.apply({...look,mode:look.mode==='auto'?(media?'media':'procedural'):look.mode},media,quality,aspect)},dispose:()=>scene?.dispose()}}),v=>v.dispose())}catch(e){scene?.dispose();scene=null;report(e);return}}
        if(bridge){bridge.draw(execution,{...CINEMA2_THREE_DEFAULT_OVERRIDES,environmentIntensity:performance.look.reflection});if(bridge.ready){const bytes=bridge.estimateGpuBytes()+(pool?.resource?pool.resource.width*pool.resource.height*4:0);if(bytes!==reported){reported=bytes;context.resources.reportGpuBytes(bytes)}}}
      },
    }]},getDiagnostics:()=>diagnostics,inspect:()=>({...performance.inspect(),renderReady:bridge?.ready===true,userMedia:context.media.get('coreMedia')!=null,poolReady:pool?.resource!=null})}
  },
}
