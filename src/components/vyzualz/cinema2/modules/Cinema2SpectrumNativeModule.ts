import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import { cinema2StableId, type Cinema2Color, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import { Cinema2MediaSlotRuntime } from '../media/Cinema2MediaSlotRuntime'
import { Cinema2EverywherePool, EVERYWHERE_POOL_SLOTS } from './everywhere/Cinema2EverywherePool'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import { Cinema2PatternAutoPerformance } from './mainframe/Cinema2PatternAutoPerformance'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import type { Cinema2ModuleCreateContext, Cinema2ModuleDiagnostic, Cinema2ModuleTypeDefinition, Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import { SPECTRUM_COLORS, SPECTRUM_PATTERNS, clamp, type SpectrumPattern } from './spectrum/SpectrumDomain'
import { SpectrumScene, type SpectrumLook } from './spectrum/SpectrumScene'
import { Cinema2MainframePatternController, createCinema2MainframePatternCycle } from './mainframe/Cinema2MainframePatternController'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { Cinema2ThreeSceneBridge, CINEMA2_THREE_DEFAULT_OVERRIDES } from './three/Cinema2ThreeSceneBridge'
import { describeCinema2LoadedModel } from './three/Cinema2ThreeAssetMetadata'

export const CINEMA2_SPECTRUM_MODULE_TYPE_ID=cinema2StableId<Cinema2ModuleTypeId>('spectrum-native')
export class SpectrumPerformance {
  private readonly clock=new Cinema2BeatClock();private readonly policy=new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>()
  private readonly controller:Cinema2MainframePatternController<SpectrumPattern>
  private readonly overrides=new Cinema2PatternAutoPerformance<SpectrumPattern>({buildPattern:'radial-sweep',dropPattern:'surround',dropBeats:4,mood:{options:{calm:['panorama','orbit'],driving:['circumference-relay','arena-pulse'],tense:['radial-sweep','orbit'],peak:['surround','arena-pulse']}}})
  private lastSection:string|null=null;private identity='';private lastTime:number|null=null;private lastBeat:number|null=null;private phase=0;private lastPoolTrigger='';private lastPoolEnabled=false;private lastActive=false;private lastAuthored:SpectrumPattern='orbit'
  look:SpectrumLook|null=null
  poolFrame={identity:'',event:null as string|null,reset:false,paused:true,suppress:true}
  constructor(sample:(index:number)=>number){this.controller=new Cinema2MainframePatternController(createCinema2MainframePatternCycle(sample,SPECTRUM_PATTERNS.map(p=>p.value)),'orbit')}
  update({frame,parameters}:Cinema2ModuleUpdateContext){
    const n=(k:string,d:number,min=0,max=1)=>{const v=parameters.get(k);return typeof v==='number'&&Number.isFinite(v)?clamp(v,min,max):d}
    const str=(k:string,d:string)=>{const v=parameters.get(k);return typeof v==='string'?v:d}
    const color=(k:keyof typeof SPECTRUM_COLORS):Cinema2Color=>{const v=parameters.get(k);return Array.isArray(v)&&v.length===4&&v.every(c=>typeof c==='number'&&Number.isFinite(c))?[v[0],v[1],v[2],v[3]]:SPECTRUM_COLORS[k]}
    const time=frame.transport?.timeSec??frame.audio?.upstream.timeSec??frame.elapsedTimeSec,identity=JSON.stringify([frame.contextGeneration,frame.transport?.trackId,frame.audio?.upstream.sourceId,frame.audio?.upstream.publisherId,frame.audio?.discontinuity.generation,frame.audio?.upstream.analysisRevision,frame.audio?.upstream.timelineRevision])
    const reset=identity!==this.identity||(this.lastTime!=null&&(time<this.lastTime-.035||time-this.lastTime>Math.max(1,frame.deltaTimeSec*6)))
    if(reset){this.clock.reset();this.policy.reset();this.controller.reset();this.lastBeat=null;this.phase=0}
    const sync=parameters.get('bpm-sync')!==false&&frame.transport?.bpmSync!==false
    const beat=this.clock.update(frame,sync,120).beats
    const active=frame.transport?.playing===true&&frame.transport.animationActive&&!frame.transport.paused,paused=frame.transport?.paused===true,auto=parameters.get('auto-performance')===true&&frame.transport?.sourcePresent===true
    const silent=(frame.mood?.silence??0)>.5,authored=SPECTRUM_PATTERNS.find(p=>p.value===parameters.get('pattern'))?.value??'orbit',trigger=CINEMA2_AFTERHOURS_TRIGGER_IDS.find(v=>v===parameters.get('trigger'))??'bar4'
    const controls=this.policy.update({saved:{patternChange:parameters.get('pattern-change')===true,trigger},mood:frame.mood,autoPerformance:auto&&n('reactivity',.75)>0&&(active||paused)})
    const rawEvent=(trigger:Cinema2AfterhoursTriggerId)=>active&&!reset&&this.lastActive?resolveCinema2AfterhoursTriggerEventIdentity(frame,trigger,this.lastTime):null
    const event=(trigger:Cinema2AfterhoursTriggerId)=>!silent||trigger==='drop'?rawEvent(trigger):null
    const base=this.controller.update({authoredPattern:authored,patternChange:controls.patternChange,trigger:controls.trigger,absoluteBeat:beat,reset,triggerEventId:event(controls.trigger)})
    if(base.changed)this.phase=0
    if(!paused&&!silent&&this.lastBeat!=null&&!base.changed)this.phase+=(active&&sync?clamp(beat-this.lastBeat,0,1)*Math.PI/4:clamp(frame.deltaTimeSec,0,.25)*Math.PI/4)*(active?1:.18)*n('orbit-rate',1,.25,2)
    const dt=clamp(frame.deltaTimeSec,0,.25),signal=(k:string)=>active&&n('reactivity',.75)>0?n(k,0):0,drop=signal('drop'),build=signal('build'),safety=str('motion-safety','reduced')
    const override=this.overrides.update({enabled:auto&&n('reactivity',.75)>0&&(active||paused),absoluteBeat:beat,buildCharge:build,dropEventId:rawEvent('drop'),patternEdited:authored!==this.lastAuthored,reset,mood:active&&!silent&&!controls.patternChange?frame.mood??null:null,deltaTimeSec:active?dt:0,basePattern:base.activePattern,patternChange:controls.patternChange,seed:identity})
    const pattern=override.pattern??base.activePattern
    if(this.look&&pattern!==this.look.pattern)this.phase=0
    this.look={pattern,phase:this.phase,opening:n('bay-opening',.35),tilt:n('bay-tilt',8,0,25),floorRelay:n('floor-relay',.55),sweep:n('circumference-sweep',.55),overhead:n('overhead-emission',.35),intensity:n('intensity',.75),safe:safety!=='full',locked:safety==='lockoff',readability:parameters.get('readability')!==false,vocal:signal('vocal'),kick:signal('kick'),snare:signal('snare'),drop,bass:Math.max(signal('bass'),signal('sub')),mid:signal('mid'),build,downbeat:signal('downbeat'),phrase:signal('phrase'),impact:signal('impact'),high:Math.max(signal('high'),signal('air')),energy:signal('energy'),beat:signal('beat'),count:Math.round(n('bay-count',12,8,16)),radius:n('arena-radius',1,.8,1.5)*7,height:n('display-height',1,.6,1.4)*3.65,gap:n('bay-gap',.025,.005,.08),coverage:str('coverage','wide-arc'),mode:str('source-mode','auto'),visible:parameters.get('media-visible')!==false,fit:str('media-fit','contain'),layout:str('media-layout','continuous'),grouping:str('grouping','left-center-right'),scale:n('media-scale',1,.5,1.5),offsetX:n('media-x',0,-.5,.5),offsetY:n('media-y',0,-.5,.5),angle:n('media-rotation',0,-180,180),opacity:n('media-opacity',1),brightness:n('media-brightness',1,0,2),transition:n('transition',.35,0,1.5),reflection:n('reflection',.25),spill:n('spill',.3),colors:{background:color('background'),structural:color('structural'),primary:color('primary'),secondary:color('secondary'),accent:color('accent')},dt,paused}
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
export const cinema2SpectrumNativeModuleDefinition:Readonly<Cinema2ModuleTypeDefinition>={
  typeId:CINEMA2_SPECTRUM_MODULE_TYPE_ID,version:1,
  create(context:Cinema2ModuleCreateContext){
    const performance=new SpectrumPerformance(i=>context.randomness.sample('spectrum-pattern-order',i))
    const source=context.mediaPoolSource
    // Existing named-pool channels are runtime-local, not authored or persisted slots.
    const pool=source?context.resources.acquire('spectrum:pool','SpectrumMediaPool',gl=>new Cinema2EverywherePool({getSelection:()=>{const l=performance.look;return l?.visible&&(l.mode==='auto'||l.mode==='pool')?source.getSelection():null},resolve:id=>source.resolve(id)},new Cinema2MediaSlotRuntime(gl,EVERYWHERE_POOL_SLOTS)),p=>p.dispose()):null
    type RenderState = 'idle'|'loading'|'warming'|'ready'|'recoverable-failure'|'fatal'|'disposed'
    let library:Cinema2ThreeLibrary|null=null,scene:SpectrumScene|null=null,bridge:Cinema2ThreeSceneBridge|null=null,reported=-1
    let renderState:RenderState='idle'
    const diagnostics:Cinema2ModuleDiagnostic[]=[]
    const report=(stage:string,e:unknown)=>diagnostics.push({code:'CINEMA2_SPECTRUM_FAILED',message:`Spectrum ${stage}: ${e instanceof Error?e.message:String(e)}`,path:'$.modules'})
    return {
      lifecycle:{
        update(update:Cinema2ModuleUpdateContext){performance.update(update);const f=performance.poolFrame;pool?.update(f.identity,f.event,f.reset,f.paused,f.suppress)},
        dispose(){renderState='disposed';library=null},
      },
      render:{providers:[{id:`${context.module.id}:arena`,moduleId:context.module.id,intent:'world' as const,execute(execution){
        if(renderState==='disposed'||renderState==='recoverable-failure'||renderState==='fatal')return
        if(renderState==='idle'){
          renderState='loading'
          // The shared loader clears rejected promises. Reactivation or context restoration
          // creates a fresh module; do not initiate a new download every animation frame.
          void loadCinema2ThreeLibrary().then(value=>{
            if(renderState!=='loading')return
            library=value;renderState='warming'
          }).catch(error=>{
            if(renderState!=='loading')return
            renderState='recoverable-failure';report('Three library load failed; reselect Spectrum to retry',error)
          })
        }
        try{
          if(library&&!bridge){
            const lib=library,root=new lib.THREE.Group()
            bridge=context.resources.acquire('spectrum:scene','SpectrumArena',gl=>new Cinema2ThreeSceneBridge(gl,lib,[{asset:{id:'spectrum-arena',scene:root,animations:[],triangleCount:0,gpuBytes:0,metadata:describeCinema2LoadedModel(root)},node:null,preserveMaterials:true}],{
              hdr:true,modelController:{
                attach:r=>{scene=new SpectrumScene(lib,r)},
                beforeDraw:quality=>{
                  const l=performance.look;if(!l)return
                  const usePool=l.mode==='pool'||(l.mode==='auto'&&source?.getSelection()!=null)
                  const direct=l.mode==='procedural'||!l.visible?null:context.media.get('arenaMedia')
                  const resources=usePool&&l.visible?(pool?.getResources()??[]).slice(0,Math.min(3,pool?.count??0)):[direct]
                  scene?.apply(l,resources,pool&&usePool?pool.step:0,quality)
                },
                dispose:()=>{scene?.dispose();scene=null},
              },
            }),v=>v.dispose())
          }
          if(bridge&&performance.look){
            bridge.draw(execution,{...CINEMA2_THREE_DEFAULT_OVERRIDES,environmentIntensity:performance.look.reflection})
            if(bridge.ready){
              renderState='ready'
              const bytes=bridge.estimateGpuBytes()+(pool?.getResources().reduce((sum,r)=>sum+(r?r.width*r.height*4:0),0)??0)
              if(bytes!==reported){reported=bytes;context.resources.reportGpuBytes(bytes)}
            }
          }
        }catch(error){
          renderState='fatal'
          const stage=bridge?'arena draw':'arena construction'
          report(stage,error)
          // A failed factory is not leased by the resource scope. The scene may already
          // have attached; release it here. For a leased bridge, the host retires the
          // module and disposes every resource when this original exception propagates.
          if(!bridge){scene?.dispose();scene=null}
          throw error
        }
      }}]},
      getDiagnostics:()=>[...diagnostics,...(bridge?.getDiagnostics().map(d=>({...d,path:'$.modules'}))??[])],
      inspect:()=>({...performance.inspect(),renderState,renderReady:renderState==='ready',poolReady:pool?.getResources().filter(Boolean).length??0,userMedia:context.media.get('arenaMedia')!=null}),
    }
  },
}
