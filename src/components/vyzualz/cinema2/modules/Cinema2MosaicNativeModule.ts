import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import { cinema2StableId, type Cinema2Color, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import { Cinema2MediaSlotRuntime } from '../media/Cinema2MediaSlotRuntime'
import { Cinema2EverywherePool, EVERYWHERE_POOL_SLOTS } from './everywhere/Cinema2EverywherePool'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import { Cinema2PatternAutoPerformance } from './mainframe/Cinema2PatternAutoPerformance'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import type { Cinema2ModuleCreateContext, Cinema2ModuleDiagnostic, Cinema2ModuleTypeDefinition, Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import { MOSAIC_COLORS, MOSAIC_PATTERNS, clamp, type MosaicPattern } from './mosaic/MosaicDomain'
import { MosaicScene, type MosaicLook } from './mosaic/MosaicScene'
import { Cinema2MainframePatternController, createCinema2MainframePatternCycle } from './mainframe/Cinema2MainframePatternController'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { Cinema2ThreeSceneBridge, CINEMA2_THREE_DEFAULT_OVERRIDES } from './three/Cinema2ThreeSceneBridge'
import { describeCinema2LoadedModel } from './three/Cinema2ThreeAssetMetadata'

export const CINEMA2_MOSAIC_MODULE_TYPE_ID=cinema2StableId<Cinema2ModuleTypeId>('mosaic-native')
export class MosaicPerformance {
  private readonly clock=new Cinema2BeatClock();private readonly policy=new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>()
  private readonly controller:Cinema2MainframePatternController<MosaicPattern>
  private readonly overrides=new Cinema2PatternAutoPerformance<MosaicPattern>({buildPattern:'extrusion',dropPattern:'fragmentation',dropBeats:4,mood:{options:{calm:['mosaic','pixel-relay'],driving:['wave','extrusion'],tense:['reconstruction','extrusion'],peak:['fragmentation','reconstruction']}}})
  private lastSection:string|null=null;private identity='';private lastTime:number|null=null;private lastBeat:number|null=null;private phase=0;private lastPoolTrigger='';private lastPoolEnabled=false;private lastActive=false;private lastAuthored:MosaicPattern='mosaic'
  look:MosaicLook|null=null
  poolFrame={identity:'',event:null as string|null,reset:false,paused:true,suppress:true}
  constructor(sample:(index:number)=>number){this.controller=new Cinema2MainframePatternController(createCinema2MainframePatternCycle(sample,MOSAIC_PATTERNS.map(p=>p.value)),'mosaic')}
  update({frame,parameters}:Cinema2ModuleUpdateContext){
    const n=(k:string,d:number,min=0,max=1)=>{const v=parameters.get(k);return typeof v==='number'&&Number.isFinite(v)?clamp(v,min,max):d}
    const str=(k:string,d:string)=>{const v=parameters.get(k);return typeof v==='string'?v:d}
    const color=(k:keyof typeof MOSAIC_COLORS):Cinema2Color=>{const v=parameters.get(k);return Array.isArray(v)&&v.length===4&&v.every(c=>typeof c==='number'&&Number.isFinite(c))?[v[0],v[1],v[2],v[3]]:MOSAIC_COLORS[k]}
    const time=frame.transport?.timeSec??frame.audio?.upstream.timeSec??frame.elapsedTimeSec,identity=JSON.stringify([frame.contextGeneration,frame.transport?.trackId,frame.audio?.upstream.sourceId,frame.audio?.upstream.publisherId,frame.audio?.discontinuity.generation,frame.audio?.upstream.analysisRevision,frame.audio?.upstream.timelineRevision])
    const reset=identity!==this.identity||(this.lastTime!=null&&(time<this.lastTime-.035||time-this.lastTime>Math.max(1,frame.deltaTimeSec*6)))
    if(reset){this.clock.reset();this.policy.reset();this.controller.reset();this.lastBeat=null;this.phase=0}
    const beat=this.clock.update(frame,parameters.get('bpm-sync')!==false&&frame.transport?.bpmSync!==false,120).beats
    const active=frame.transport?.playing===true&&frame.transport.animationActive&&!frame.transport.paused,paused=frame.transport?.paused===true,auto=parameters.get('auto-performance')===true&&frame.transport?.sourcePresent===true
    const silent=auto&&(frame.mood?.silence??0)>.5,authored=MOSAIC_PATTERNS.find(p=>p.value===parameters.get('pattern'))?.value??'mosaic',trigger=CINEMA2_AFTERHOURS_TRIGGER_IDS.find(v=>v===parameters.get('trigger'))??'bar4'
    const controls=this.policy.update({saved:{patternChange:parameters.get('pattern-change')===true,trigger},mood:frame.mood,autoPerformance:auto&&(active||paused)})
    const rawEvent=(trigger:Cinema2AfterhoursTriggerId)=>active&&!reset&&this.lastActive?resolveCinema2AfterhoursTriggerEventIdentity(frame,trigger,this.lastTime):null
    const event=(trigger:Cinema2AfterhoursTriggerId)=>!silent||trigger==='drop'?rawEvent(trigger):null
    const base=this.controller.update({authoredPattern:authored,patternChange:controls.patternChange,trigger:controls.trigger,absoluteBeat:beat,reset,triggerEventId:event(controls.trigger)})
    if(base.changed)this.phase=0
    if(active&&!silent&&this.lastBeat!=null)this.phase+=clamp(beat-this.lastBeat,0,1)*Math.PI/4*n('wave-rate',1,.25,2)
    const dt=clamp(frame.deltaTimeSec,0,.25),signal=(k:string)=>active?n(k,0):0,drop=signal('drop'),build=signal('build'),safety=str('motion-safety','reduced')
    const override=this.overrides.update({enabled:auto&&n('reactivity',.75)>0&&(active||paused),absoluteBeat:beat,buildCharge:build,dropEventId:rawEvent('drop'),patternEdited:authored!==this.lastAuthored,reset,mood:active&&!silent&&!controls.patternChange?frame.mood??null:null,deltaTimeSec:active?dt:0,basePattern:base.activePattern,patternChange:controls.patternChange,seed:identity})
    const pattern=override.pattern??base.activePattern
    if(this.look&&pattern!==this.look.pattern)this.phase=0
    this.look={pattern,phase:this.phase,extrusion:n('extrusion',.45),rotation:n('rotation',12,0,35),scatter:n('scatter',.35),intensity:n('intensity',.75),safe:safety!=='full',locked:safety==='lockoff',readability:parameters.get('readability')!==false,vocal:signal('vocal'),kick:signal('kick'),snare:signal('snare'),drop,bass:Math.max(signal('bass'),signal('sub')),mid:signal('mid'),build,downbeat:signal('downbeat'),phrase:signal('phrase'),impact:signal('impact'),high:Math.max(signal('high'),signal('air')),energy:signal('energy'),beat:signal('beat'),frameEmission:n('frame-emission',.35),columns:Math.round(n('columns',8,4,12)),rows:Math.round(n('rows',5,3,8)),gap:n('gap',.018,.005,.06),thickness:n('thickness',.1,.03,.2),frameWidth:n('frame-width',.025,.01,.1),waveRate:n('wave-rate',1,.25,2),mode:str('source-mode','auto'),visible:parameters.get('media-visible')!==false,fit:str('media-fit','contain'),layout:str('media-layout','continuous'),grouping:str('grouping','blocks'),scale:n('media-scale',1,.5,1.5),offsetX:n('media-x',0,-.5,.5),offsetY:n('media-y',0,-.5,.5),angle:n('media-rotation',0,-180,180),opacity:n('media-opacity',1),brightness:n('media-brightness',1,0,2),transition:n('transition',.35,0,1.5),reflection:n('reflection',.25),spill:n('spill',.3),colors:{background:color('background'),structural:color('structural'),primary:color('primary'),secondary:color('secondary'),accent:color('accent')},dt,paused}
    const poolEnabled=parameters.get('pool-automation')===true,mediaTrigger=str('pool-trigger','4bars')
    const section=frame.audio?.structure?.section?.value?.id??null
    let mediaEvent:string|null=null
    if(poolEnabled&&active&&this.lastActive&&!reset&&!silent){
      if(mediaTrigger==='beat')mediaEvent=event('beat')
      else if(mediaTrigger==='kickHit')mediaEvent=event('kick')
      else if(mediaTrigger==='snareHit')mediaEvent=event('snare')
      else if(mediaTrigger==='trackSections')mediaEvent=section&&section!==this.lastSection?`section:${section}`:null
      else {const divisor=Number.parseInt(mediaTrigger,10),bar=frame.audio?.rhythm.barIndex?.value,boundary=event('bar');if(boundary&&typeof bar==='number'&&bar>0&&[4,6,8,16].includes(divisor)&&bar%divisor===0)mediaEvent=`${boundary}:${divisor}`}
    }
    this.lastSection=section
    this.poolFrame={identity,reset,paused:!active,event:mediaEvent,suppress:poolEnabled!==this.lastPoolEnabled||mediaTrigger!==this.lastPoolTrigger}
    this.lastPoolEnabled=poolEnabled;this.lastPoolTrigger=mediaTrigger;this.identity=identity;this.lastTime=time;this.lastBeat=beat;this.lastActive=active;this.lastAuthored=authored
  }
  inspect(){return {...this.policy.inspect(),activePattern:this.look?.pattern,phase:this.phase}}
}
export const cinema2MosaicNativeModuleDefinition:Readonly<Cinema2ModuleTypeDefinition>={
  typeId:CINEMA2_MOSAIC_MODULE_TYPE_ID,version:1,
  create(context:Cinema2ModuleCreateContext){
    const performance=new MosaicPerformance(i=>context.randomness.sample('mosaic-pattern-order',i))
    const source=context.mediaPoolSource
    // Existing named-pool channels are runtime-local, not authored or persisted slots.
    const pool=source?context.resources.acquire('mosaic:pool','MosaicMediaPool',gl=>new Cinema2EverywherePool({getSelection:()=>{const l=performance.look;return l?.visible&&(l.mode==='auto'||l.mode==='pool')?source.getSelection():null},resolve:id=>source.resolve(id),subscribe:source.subscribe},new Cinema2MediaSlotRuntime(gl,EVERYWHERE_POOL_SLOTS)),p=>p.dispose()):null
    let library:Cinema2ThreeLibrary|null=null,scene:MosaicScene|null=null,bridge:Cinema2ThreeSceneBridge|null=null,starting=false,disposed=false,reported=-1
    const diagnostics:Cinema2ModuleDiagnostic[]=[]
    const report=(e:unknown)=>diagnostics.push({code:'CINEMA2_MOSAIC_FAILED',message:e instanceof Error?e.message:String(e),path:'$.modules'})
    return {lifecycle:{update(update:Cinema2ModuleUpdateContext){performance.update(update);const f=performance.poolFrame;pool?.update(f.identity,f.event,f.reset,f.paused,f.suppress)},dispose(){disposed=true}},render:{providers:[{id:`${context.module.id}:gallery`,moduleId:context.module.id,intent:'world' as const,execute(execution){
      if(disposed||diagnostics.length)return
      if(!starting){starting=true;void loadCinema2ThreeLibrary().then(value=>{if(!disposed)library=value}).catch(e=>{if(!disposed)report(e)})}
      if(library&&!bridge){const lib=library,root=new lib.THREE.Group();try{bridge=context.resources.acquire('mosaic:scene','MosaicGallery',gl=>new Cinema2ThreeSceneBridge(gl,lib,[{asset:{id:'mosaic-gallery',scene:root,animations:[],triangleCount:0,gpuBytes:0,metadata:describeCinema2LoadedModel(root)},node:null,preserveMaterials:true}],{hdr:true,modelController:{attach:r=>{scene=new MosaicScene(lib,r)},beforeDraw:()=>{const l=performance.look;if(!l)return;const usePool=l.mode==='pool'||(l.mode==='auto'&&source?.getSelection()!=null);const direct=l.mode==='procedural'||!l.visible?null:context.media.get('wallMedia');const resources=usePool&&l.visible?(pool?.getResources()??[]).slice(0,Math.min(3,pool?.count??0)):[direct];scene?.apply(l,resources,pool&&usePool?pool.step:0)},dispose:()=>scene?.dispose()}}),v=>v.dispose())}catch(e){scene?.dispose();scene=null;report(e);return}}
      if(bridge&&performance.look){bridge.draw(execution,{...CINEMA2_THREE_DEFAULT_OVERRIDES,environmentIntensity:performance.look.reflection});if(bridge.ready){const bytes=bridge.estimateGpuBytes()+(pool?.getResources().reduce((sum,r)=>sum+(r?r.width*r.height*4:0),0)??0);if(bytes!==reported){reported=bytes;context.resources.reportGpuBytes(bytes)}}}}
    }]},getDiagnostics:()=>diagnostics,inspect:()=>({...performance.inspect(),renderReady:bridge?.ready===true,poolReady:pool?.getResources().filter(Boolean).length??0,userMedia:context.media.get('wallMedia')!=null})}
  },
}
