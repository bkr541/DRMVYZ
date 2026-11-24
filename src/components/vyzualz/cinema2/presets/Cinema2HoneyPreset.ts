import { CINEMA2_NATIVE_PRESET_SCHEMA_ID,CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,cinema2NamespacedId,cinema2StableId,cinema2Ref,type Cinema2PresetId,type Cinema2ModuleId,type Cinema2SceneNodeId,type Cinema2LayerId,type Cinema2CameraId,type Cinema2RenderTargetId,type Cinema2RenderPassId,type Cinema2RenderSlotId,type Cinema2ParameterId,type Cinema2LightId,type Cinema2ParameterManifest,type Cinema2NativePresetManifest } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_HONEY_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2HoneyNativeModule'
import { HONEY_CAMERA,HONEY_PALETTE,HONEY_PALETTE_KEYS } from '../modules/honey/Cinema2HoneyDomain'
import { finishHoney } from './Cinema2HoneyFinishing'
import { HONEY_LIGHT_DEFAULTS,HONEY_LIGHT_RANGES,type HoneyLightControls } from '../modules/honey/Cinema2HoneyLighting'
import { HONEY_AUDIO_DEFAULTS,HONEY_AUDIO_REACTIVITY } from '../modules/honey/Cinema2HoneyAudio'
import { honeyAudioRules } from './Cinema2HoneyChoreography'
import { HONEY_MOTION_DEFAULTS } from '../modules/honey/Cinema2HoneyMotion'
import { HONEY_PATTERNS } from '../modules/honey/Cinema2HoneyPatterns'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'
import { cinema2AutoTargets } from './Cinema2AutoPerformanceAuthoring'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'

export const CINEMA2_HONEY_PRESET_ID=cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.honey')
export const CINEMA2_HONEY_MODULE_ID=cinema2StableId<Cinema2ModuleId>('honey-wall')
const lightParameterNames:Record<string,string>={outerGain:'outer-intensity',innerGain:'inner-intensity',underGain:'under-intensity',lightSpill:'light-spill',motion:'motion-amount',rate:'motion-rate',elevation:'travel',rotation:'rotation-range',tilt:'tilt-range',transition:'transition-length','camera-sway':'camera-motion-intensity'}
export const honeyParameterId=(key:string)=>cinema2StableId<Cinema2ParameterId>(`honey-${lightParameterNames[key]??key}`)
const root=cinema2StableId<Cinema2SceneNodeId>('honey-root'),wall=cinema2StableId<Cinema2SceneNodeId>('honey-wall-node')
const layer=cinema2StableId<Cinema2LayerId>('honey-world'),camera=cinema2StableId<Cinema2CameraId>('honey-camera')
const target=cinema2StableId<Cinema2RenderTargetId>('honey-scene-target'),pass=cinema2StableId<Cinema2RenderPassId>('honey-scene-pass')
const color=cinema2StableId<Cinema2RenderSlotId>('honey-scene-color'),depth=cinema2StableId<Cinema2RenderSlotId>('honey-scene-depth')
const labels={face:'Face',edge:'Edge / Sleeve',cavity:'Cavity / Body',substrate:'Substrate / Background',outer:'Outer Channel',inner:'Inner Channel',under:'Under Channel'} as const
const paletteParameters:Cinema2ParameterManifest[]=HONEY_PALETTE_KEYS.map((key,index)=>({id:honeyParameterId(key),label:labels[key],type:'color',defaultValue:HONEY_PALETTE[key],section:'Design',designParentGroup:'palette',order:index+1,exposure:'primary',persistence:'preset',reset:'authored-default',modulatable:false,choreographable:false,automatable:false}))

const lightLabels={outerGain:'Outer Channel Intensity',innerGain:'Inner Channel Intensity',underGain:'Underlighting',lightSpill:'Light Spill',ambient:'Ambient Lighting',bloom:'Bloom',ao:'Ambient Occlusion'} as const
const lightingParameters:Cinema2ParameterManifest[]=(Object.keys(HONEY_LIGHT_DEFAULTS) as (keyof HoneyLightControls)[]).map((key,i)=>({id:honeyParameterId(key),label:lightLabels[key],type:'float',defaultValue:HONEY_LIGHT_DEFAULTS[key],min:0,max:HONEY_LIGHT_RANGES[key],step:.01,section:'Design',designParentGroup:key==='ambient'?'master-controls':key==='bloom'||key==='ao'||key==='lightSpill'?'effects':'design',...(key==='outerGain'||key==='innerGain'||key==='underGain'?{group:'Lighting'}:{}),order:i+10,exposure:'primary',persistence:'preset',reset:'authored-default',modulatable:true,choreographable:true,automatable:true}))
const moduleLightKeys=['outerGain','innerGain','underGain','lightSpill'] as const
const base=(key:string,label:string,parent:'master-controls'|'design',group:string,order:number)=>({id:honeyParameterId(key),label,section:'Design' as const,designParentGroup:parent,group,order,exposure:'primary' as const,persistence:'preset' as const,reset:'authored-default' as const})
const slider=(key:string,label:string,parent:'master-controls'|'design',group:string,order:number,value:number,min:number,max:number,step=.01):Cinema2ParameterManifest=>({...base(key,label,parent,group,order),type:'float',defaultValue:value,min,max,step,modulatable:true,choreographable:true,automatable:true})
const d=HONEY_MOTION_DEFAULTS
const motionParameters:Cinema2ParameterManifest[]=[
  slider('master-intensity','Master Intensity','master-controls','Lighting',0,1,0,2),
  slider('audio-reactivity','Audio Reactivity','master-controls','Motion',6,HONEY_AUDIO_REACTIVITY,0,1),
  slider('motion','Motion Amount','master-controls','Motion',1,d.motion,0,1),
  {...base('bpm-sync','BPM Sync','master-controls','Motion',2),type:'boolean',defaultValue:true},
  {...base('auto-performance','Auto Performance','master-controls','Motion',3),type:'boolean',defaultValue:false},
  {...base('camera-motion','Camera Motion','master-controls','Camera',4),type:'boolean',defaultValue:true},
  {...slider('camera-sway','Camera Motion Intensity','master-controls','Camera',5,.55,0,1),visibleWhen:[{kind:'parameter-equals',parameterId:honeyParameterId('camera-motion'),value:true}]},
  {...base('pattern','Pattern','design','Pattern',1),type:'enum',defaultValue:'cascade',options:HONEY_PATTERNS},
  {...base('pattern-change','Pattern Change','design','Pattern',2),type:'boolean',defaultValue:false},
  {...base('trigger','Trigger','design','Pattern',3),type:'enum',defaultValue:'bar4',options:CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,visibleWhen:[{kind:'parameter-equals',parameterId:honeyParameterId('pattern-change'),value:true}]},
  {...base('transition','Transition Length','design','Pattern',4),type:'enum',defaultValue:d.transition,options:['0.5','1','2','4'].map(value=>({value,label:`${value} beats`}))},
  slider('rate','Motion Rate','design','Mechanical Motion',20,d.rate,.25,2),
  slider('attack','Attack (seconds)','design','Mechanical Motion',21,d.attack,.04,.5),
  slider('release','Release (seconds)','design','Mechanical Motion',22,d.release,.15,1.2),
  slider('elevation','Elevation Range','design','Mechanical Motion',23,d.elevation,0,1),
  slider('rotation','Rotation Amount','design','Mechanical Motion',24,d.rotation,0,1),
  slider('tilt','Tilt Amount','design','Mechanical Motion',25,d.tilt,0,1),
  slider('separation','Separation Amount','design','Mechanical Motion',26,d.separation,0,1),
  slider('coverage','Active Coverage','design','Lighting',27,d.coverage,0,1),
  slider('width','Wave Width','design','Pattern',5,d.width,.5,1.5),
  slider('delay','Spread Delay (beats)','design','Pattern',6,d.delay,.0625,.25,.0125),
]
const motionKeys={...Object.fromEntries(Object.keys(d).map(key=>[key,key])),masterIntensity:'master-intensity',audioReactivity:'audio-reactivity',bpmSync:'bpm-sync',autoPerformance:'auto-performance',pattern:'pattern',patternChange:'pattern-change',trigger:'trigger'}
const motionBindings=Object.fromEntries(Object.entries(motionKeys).map(([key,id])=>[key,cinema2Ref(honeyParameterId(id))]))
const motionDefaults=Object.fromEntries(Object.entries(motionKeys).map(([key,id])=>[key,motionParameters.find(p=>p.id===honeyParameterId(id))!.defaultValue]))
/** P03 performance reference; keep the P02 material and effect graph. */
export const CINEMA2_HONEY_PRESET_MANIFEST:Readonly<Cinema2NativePresetManifest>=withCinema2MoodDrives(finishHoney({
  schemaId:CINEMA2_NATIVE_PRESET_SCHEMA_ID,schemaVersion:CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,id:CINEMA2_HONEY_PRESET_ID,revision:1,
  metadata:{name:'HONEY',description:'A close industrial honeycomb wall of solid beveled hex plates, recessed chambers, mixed industrial finishes and physical emissive channels. Eight mechanical and light programs.',author:'STAGELESS',tags:['cinematic','3d','audio-reactive']},
  capabilities:[{id:'render.webgl2',requirement:'required',purpose:'Instanced native hexagonal assemblies.'},{id:'render.depth',requirement:'required',purpose:'Resolve raised plates and stationary recessed chambers.'},{id:'scene.3d',requirement:'required',purpose:'World-space axial hex field.'},{id:'camera.world',requirement:'required',purpose:'Shared close perspective camera.'},{id:'render.hdr',requirement:'optional',purpose:'HDR emissive channels with rgba8 fallback.'},{id:'lighting',requirement:'required',purpose:'Shared directional and ambient light rig.'},{id:'audio.transport',requirement:'optional',purpose:'Playback lifecycle and discontinuities.'},{id:'audio.bands',requirement:'optional',purpose:'Six distinct native spatial and light routes.'},{id:'audio.features',requirement:'optional',purpose:'Energy, spectral flux and build progress.'},{id:'music.vocal-presence',requirement:'optional',purpose:'Restrain kinetic overlays during vocals.'},{id:'music.build',requirement:'optional',purpose:'Sustained tension and canonical build edge.'},{id:'music.section',requirement:'optional',purpose:'Canonical section variation cue.'},{id:'music.beat',requirement:'optional',purpose:'Shared beat timing and pattern switches.'},{id:'music.rhythm-events',requirement:'optional',purpose:'Canonical kick and snare switching.'},{id:'music.drop',requirement:'optional',purpose:'Canonical drop switching.'},{id:'music.downbeat',requirement:'optional',purpose:'Canonical downbeat switching.'},{id:'music.bar',requirement:'optional',purpose:'Canonical bar switching.'},{id:'music.phrase',requirement:'optional',purpose:'Canonical phrase switching.'}],
  parameters:[{id:honeyParameterId('musical-cue'),label:'Musical Cue',type:'trigger',exposure:'hidden',persistence:'runtime-only',reset:'none',section:'React',group:'Runtime',order:999},{...CINEMA2_QUALITY_MODE_PARAMETER,section:'Design',designParentGroup:'master-controls'},...paletteParameters,...lightingParameters,...motionParameters],
  modules:[{id:CINEMA2_HONEY_MODULE_ID,typeId:CINEMA2_HONEY_NATIVE_MODULE_TYPE_ID,version:1,actionBindings:{musicalCue:cinema2Ref(honeyParameterId('musical-cue'))},parameters:{...motionDefaults,...HONEY_AUDIO_DEFAULTS,...HONEY_PALETTE,...Object.fromEntries(moduleLightKeys.map(key=>[key,HONEY_LIGHT_DEFAULTS[key]]))},parameterBindings:{...motionBindings,...Object.fromEntries([...HONEY_PALETTE_KEYS,...moduleLightKeys].map(key=>[key,cinema2Ref(honeyParameterId(key))]))}}],
  choreography:{rules:honeyAudioRules(CINEMA2_HONEY_MODULE_ID,honeyParameterId('musical-cue'))},
  scene:{nodes:[{id:root,kind:'group',coordinateSpace:'world'},{id:wall,kind:'module',parent:cinema2Ref(root),module:cinema2Ref(CINEMA2_HONEY_MODULE_ID)}],roots:[cinema2Ref(root)]},
  layers:[{id:layer,label:'HONEY Wall',source:cinema2Ref(root),role:'world',depthPolicy:'read-write',order:0}],
  cameras:[{id:camera,label:'HONEY Close Wall',projection:'perspective',transform:{position:HONEY_CAMERA.position},target:HONEY_CAMERA.target,fovDegrees:HONEY_CAMERA.fov,near:.1,far:100,rig:{kind:'static'},motion:{tempo:{referenceBpm:120,flightSpeed:false,weave:.35,bob:0,roll:0,fov:0,punch:0}},controls:{motionEnabled:cinema2Ref(honeyParameterId('camera-motion')),motionAmount:cinema2Ref(honeyParameterId('camera-sway')),masterMotionAmount:cinema2Ref(honeyParameterId('motion'))},smoothingMs:120}],
  lighting:{lights:[{id:cinema2StableId<Cinema2LightId>('honey-ambient'),type:'ambient',color:[.76,.86,1,1],intensity:HONEY_LIGHT_DEFAULTS.ambient,controls:{intensity:cinema2Ref(honeyParameterId('ambient'))}},{id:cinema2StableId<Cinema2LightId>('honey-key'),type:'directional',color:[.83,.91,1,1],intensity:1.1,transform:{rotation:[-.55,.46,0]},config:{castShadow:true,shadowExtent:13,shadowDepth:45,shadowFocusAhead:13,shadowBias:.012,shadowSoftness:1}}]},
  environment:{backgroundColor:HONEY_PALETTE.substrate,controls:{backgroundColor:cinema2Ref(honeyParameterId('substrate'))}},
  render:{targets:[{id:target,ownership:'transient',descriptor:{size:{kind:'viewport'},colorFormat:'rgba8',depthFormat:'depth24'}}],passes:[{id:pass,kind:'scene',layers:[cinema2Ref(layer)],outputs:[{id:color,target:cinema2Ref(target),attachment:'color'},{id:depth,target:cinema2Ref(target),attachment:'depth'}]}],outputPass:cinema2Ref(pass)},
  defaults:{camera:cinema2Ref(camera)},output:{renderPass:cinema2Ref(pass),colorSpace:'srgb',alphaMode:'opaque'},
},honeyParameterId),{
  idPrefix:'honey-auto',enabledParameter:honeyParameterId('auto-performance'),strengthParameter:honeyParameterId('motion'),
  patternControls:{patternChange:honeyParameterId('pattern-change'),trigger:honeyParameterId('trigger')},
  drives:[
    {id:'motion-activity',target:cinema2AutoTargets.module(CINEMA2_HONEY_MODULE_ID,'motion'),source:'mood.activity',operation:'multiply',value:1.22},
    {id:'motion-calm',target:cinema2AutoTargets.module(CINEMA2_HONEY_MODULE_ID,'motion'),source:'mood.calm',operation:'multiply',value:.72},
    {id:'coverage-activity',target:cinema2AutoTargets.module(CINEMA2_HONEY_MODULE_ID,'coverage'),source:'mood.activity',operation:'multiply',value:1.18},
    {id:'coverage-silence',target:cinema2AutoTargets.module(CINEMA2_HONEY_MODULE_ID,'coverage'),source:'mood.silence',operation:'multiply',value:.6},
  ],
})
