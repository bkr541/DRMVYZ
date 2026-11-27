import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import { cinema2StableId, type Cinema2Color, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import { Cinema2MediaSlotRuntime } from '../media/Cinema2MediaSlotRuntime'
import { Cinema2EverywherePool, EVERYWHERE_POOL_SLOTS, everywherePoolTrigger } from './everywhere/Cinema2EverywherePool'
import type { Cinema2TextureHandle } from '../assets/Cinema2AssetTextureService'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import type { Cinema2ModuleCreateContext, Cinema2ModuleDiagnostic, Cinema2ModuleTypeDefinition, Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import { Cinema2EverywhereWall, EVERYWHERE_COLORS, EVERYWHERE_PATTERNS, type EverywhereLook, type EverywherePattern } from './everywhere/Cinema2EverywhereWall'
import { Cinema2MainframePatternController, createCinema2MainframePatternCycle } from './mainframe/Cinema2MainframePatternController'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { Cinema2ThreeSceneBridge, CINEMA2_THREE_DEFAULT_OVERRIDES } from './three/Cinema2ThreeSceneBridge'
import { describeCinema2LoadedModel } from './three/Cinema2ThreeAssetMetadata'

export const CINEMA2_EVERYWHERE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('everywhere-native')
export const EVERYWHERE_EYE_ASSET = 'cinema2-everywhere-eye'
const overrides = { ...CINEMA2_THREE_DEFAULT_OVERRIDES, environmentIntensity:.26 }
const DEFAULT_LOOK: Readonly<EverywhereLook> = {
  pattern:'all-eyes',phase:.22,brightness:1.06,coverage:.96,angle:.84,motion:.72,scan:.20,glare:.65,layout:'repeat',
  colors:EVERYWHERE_COLORS, energy:0,bass:0,high:0,vocal:0,kick:0,snare:0,build:0,drop:0,
}
type Merge = typeof import('three/examples/jsm/utils/BufferGeometryUtils.js')['mergeGeometries']

/** Runtime-only musical state. Authored values are owned by Cinema2ParameterState. */
export class Cinema2EverywherePerformance {
  private readonly clock = new Cinema2BeatClock()
  private readonly policy = new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>()
  private readonly controller: Cinema2MainframePatternController<EverywherePattern>
  private identity = ''
  private lastTime: number | null = null
  private lastBeat: number | null = null
  private lastMediaTrigger: Cinema2AfterhoursTriggerId | null = null
  private lastPattern: EverywherePattern = 'all-eyes'
  private phase = DEFAULT_LOOK.phase
  look = DEFAULT_LOOK
  poolFrame = { identity: '', reset: false, event: null as string | null, paused: false, patternChanged: false }

  constructor(sample: (index: number) => number) {
    this.controller = new Cinema2MainframePatternController(createCinema2MainframePatternCycle(
      sample, EVERYWHERE_PATTERNS.map(pattern=>pattern.value),
    ),'all-eyes')
  }

  update({frame,parameters}: Cinema2ModuleUpdateContext) {
    const time = frame.transport?.timeSec ?? frame.audio?.upstream.timeSec ?? frame.elapsedTimeSec
    const identity = JSON.stringify([frame.contextGeneration,frame.transport?.trackId,frame.audio?.upstream.sourceId,
      frame.audio?.upstream.publisherId,frame.audio?.discontinuity.generation,frame.audio?.upstream.analysisRevision,
      frame.audio?.upstream.timelineRevision])
    const reset = identity!==this.identity || (this.lastTime!=null && (time<this.lastTime-.035 || time-this.lastTime>Math.max(1,frame.deltaTimeSec*6)))
    if (reset) {
      this.clock.reset(); this.policy.reset(); this.controller.reset()
      this.lastBeat=null;this.phase=DEFAULT_LOOK.phase
    }
    const n = (name: string, fallback: number, min = 0, max = 1) => {
      const value=parameters.get(name)
      return typeof value==='number' && Number.isFinite(value) ? Math.max(min,Math.min(max,value)) : fallback
    }
    const rgba = (key: keyof typeof EVERYWHERE_COLORS): Cinema2Color => {
      const value=parameters.get(key)
      return Array.isArray(value) && value.length===4 && value.every(c=>typeof c==='number' && Number.isFinite(c))
        ? [value[0],value[1],value[2],value[3]] : EVERYWHERE_COLORS[key]
    }
    const beat = this.clock.update(frame,parameters.get('bpmSync')!==false && frame.transport?.bpmSync!==false).beats
    const active = frame.transport?.playing===true && frame.transport.animationActive && !frame.transport.paused
    const paused = frame.transport?.paused===true && !reset
    const auto = parameters.get('autoPerformance')===true && frame.transport?.sourcePresent===true
    const motion = n('motion',.72)
    const pattern = EVERYWHERE_PATTERNS.find(value=>value.value===parameters.get('pattern'))?.value ?? 'all-eyes'
    const trigger = CINEMA2_AFTERHOURS_TRIGGER_IDS.find(value=>value===parameters.get('trigger')) ?? 'bar4'
    const controls=this.policy.update({
      saved:{patternChange:parameters.get('patternChange')===true,trigger},
      mood:frame.mood,autoPerformance:auto && (active||paused),
    })
    const silentHold = !reset && pattern===this.lastPattern && auto && controls.automatic
      && !controls.patternChange && (frame.mood?.silence ?? 0)>.5
    const base = silentHold ? null : this.controller.update({
      authoredPattern:pattern,patternChange:controls.patternChange,trigger:controls.trigger,absoluteBeat:beat,reset,
      triggerEventId:active ? resolveCinema2AfterhoursTriggerEventIdentity(frame,controls.trigger,reset ? null : this.lastTime) : null,
    })
    if (base?.changed) this.phase=DEFAULT_LOOK.phase
    if (active && this.lastBeat!=null) this.phase+=Math.max(0,Math.min(1,beat-this.lastBeat))*motion
    const signal = (key: 'energy'|'bass'|'high'|'vocal'|'kick'|'snare'|'build'|'drop') =>
      !auto || motion===0 ? 0 : paused ? this.look[key] : active ? n(key,0)*motion : 0
    this.look={
      pattern:base?.activePattern ?? this.look.pattern,phase:this.phase,motion,
      brightness:n('brightness',1.06,0,1.8),coverage:n('coverage',.96,.18),angle:n('angle',.84,0,1.25),
      scan:n('scan',.20),glare:n('glare',.65),layout:parameters.get('mediaLayout')==='wall' ? 'wall' : parameters.get('mediaLayout')==='repeat' ? 'repeat' : 'choreographed',
      mediaFit:parameters.get('mediaFit')==='cover' ? 'cover' : parameters.get('mediaFit')==='stretch' ? 'stretch' : 'contain',
      contentMotion:n('contentMotion',.75),scaleVariation:n('scaleVariation',.6),screenPower:parameters.get('screenPower')!==false,heroReadability:parameters.get('heroReadability')!==false,
      colors:{background:rgba('background'),cabinet:rgba('cabinet'),cool:rgba('cool'),warm:rgba('warm'),screen:rgba('screen')},
      energy:signal('energy'),bass:signal('bass'),high:signal('high'),vocal:signal('vocal'),
      kick:signal('kick'),snare:signal('snare'),build:signal('build'),drop:signal('drop'),
    }
    const poolTrigger = parameters.get('poolTrigger')
    const mediaTrigger = CINEMA2_AFTERHOURS_TRIGGER_IDS.find(value => value === poolTrigger) ?? everywherePoolTrigger(this.look.pattern)
    this.poolFrame = { identity, reset, paused: !active, patternChanged: base?.changed === true || pattern !== this.lastPattern || mediaTrigger !== this.lastMediaTrigger,
      event: active && motion > 0 && !(auto && (frame.mood?.silence ?? 0) > .5)
        ? resolveCinema2AfterhoursTriggerEventIdentity(frame, mediaTrigger, reset ? null : this.lastTime) : null }
    this.lastMediaTrigger=mediaTrigger
    this.identity=identity
    this.lastTime=time
    this.lastBeat=beat
    this.lastPattern=pattern
  }

  inspect() { return {...this.policy.inspect(),activePattern:this.look.pattern,phase:this.look.phase,drop:this.look.drop,coverage:this.look.coverage} }
}

export const cinema2EverywhereNativeModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = {
  typeId:CINEMA2_EVERYWHERE_MODULE_TYPE_ID,version:1,
  create(context: Cinema2ModuleCreateContext) {
    const performance=new Cinema2EverywherePerformance(index=>context.randomness.sample('everywhere-pattern-order',index))
    const pool = context.mediaPoolSource ? context.resources.acquire('everywhere:pool', 'EverywhereMediaPool', gl =>
      new Cinema2EverywherePool(context.mediaPoolSource!, new Cinema2MediaSlotRuntime(gl, EVERYWHERE_POOL_SLOTS)), value => value.dispose()) : null
    let setup: {library:Cinema2ThreeLibrary;merge:Merge} | null = null
    let eye: Cinema2TextureHandle | null = null
    let wall: Cinema2EverywhereWall | null = null
    let bridge: Cinema2ThreeSceneBridge | null = null
    let starting=false, disposed=false, measured=false, wallGpuBytes=0, reportedBytes=-1
    const sourceMode=()=> {
      const selection = context.mediaPoolSource?.getSelection()
      if (selection) return selection.mediaIds.length ? 'pool' as const : 'eyes' as const
      return context.media.get('screenMedia') ? 'single' as const : 'eyes' as const
    }
    let aspectRatio=16/9
    const diagnostics: Cinema2ModuleDiagnostic[]=[]
    const report=(error:unknown)=>diagnostics.push({
      code:'CINEMA2_EVERYWHERE_WALL_FAILED',message:error instanceof Error ? error.message : String(error),path:'$.modules',
    })
    return {
      lifecycle:{
        update:(update:Cinema2ModuleUpdateContext)=>{
          performance.update(update)
          const { identity, event, reset, paused, patternChanged } = performance.poolFrame
          pool?.update(identity, event, reset, paused, patternChanged)
        },
        dispose() { disposed=true;eye?.release();eye=null },
      },
      render:{providers:[{
        id:`${context.module.id}:crt-wall`,moduleId:context.module.id,intent:'world' as const,
        execute(execution) {
          if (disposed || diagnostics.length) return
          aspectRatio=execution.camera?.aspect ?? execution.width/Math.max(1,execution.height)
          if (!starting) {
            starting=true
            eye=context.textures?.acquire(EVERYWHERE_EYE_ASSET,execution.lightingEnvironment?.quality ?? 'high') ?? null
            void Promise.all([loadCinema2ThreeLibrary(),import('three/examples/jsm/utils/BufferGeometryUtils.js')])
              .then(([library,{mergeGeometries}])=>{if(!disposed)setup={library,merge:mergeGeometries}}).catch(error=>{if(!disposed)report(error)})
          }
          if (setup && !bridge) {
            const {library,merge}=setup
            const scene=new library.THREE.Group()
            try {
              bridge=context.resources.acquire('everywhere:wall','EverywhereThreeWall',gl=>new Cinema2ThreeSceneBridge(gl,library,[{asset:{
                id:'everywhere-geometry',scene,animations:[],triangleCount:0,gpuBytes:0,metadata:describeCinema2LoadedModel(scene),
              },node:null,preserveMaterials:true}],{
                hdr:true,modelController:{
                  attach:root=>{wall=new Cinema2EverywhereWall(library,merge,root)},
                  beforeDraw:()=>wall?.apply(performance.look,eye?.status==='ready' ? eye.texture : null,context.media.get('screenMedia'),pool?.getResources(),pool?.step,aspectRatio,sourceMode()),
                  dispose:()=>wall?.dispose(),
                },
              }),value=>value.dispose())
            } catch(error) { wall?.dispose();wall=null;report(error);return }
          }
          if (bridge) {
            bridge.draw(execution,overrides)
            if (!measured) {
              wallGpuBytes=bridge.estimateGpuBytes()
              measured=bridge.ready
            }
            const bytes=wallGpuBytes+(pool?.getResources().reduce((total, feed)=>total+(feed ? feed.width*feed.height*4 : 0),0) ?? 0)
            if (bytes!==reportedBytes) { context.resources.reportGpuBytes(bytes);reportedBytes=bytes }
          }
        },
      }]},
      getDiagnostics:()=>diagnostics,
      inspect:()=>({...performance.inspect(),screens:wall?.count ?? 0,renderReady:bridge?.ready===true,eyeReady:eye?.status==='ready',sourceMode:sourceMode(),userMedia:sourceMode()==='single'&&context.media.get('screenMedia')!=null,poolMediaCount:pool?.count ?? 0,poolStep:pool?.step ?? 0,poolReadyChannels:pool?.getResources().filter(Boolean).length ?? 0}),
    }
  },
}
