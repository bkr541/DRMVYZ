import { CINEMA2_NATIVE_PRESET_SCHEMA_ID,CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,cinema2NamespacedId,cinema2StableId,cinema2Ref,type Cinema2PresetId,type Cinema2ModuleId,type Cinema2SceneNodeId,type Cinema2LayerId,type Cinema2CameraId,type Cinema2RenderTargetId,type Cinema2RenderPassId,type Cinema2RenderSlotId,type Cinema2ParameterId,type Cinema2LightId,type Cinema2ParameterManifest,type Cinema2NativePresetManifest } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_HONEY_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2HoneyNativeModule'
import { HONEY_CAMERA,HONEY_PALETTE,HONEY_PALETTE_KEYS } from '../modules/honey/Cinema2HoneyDomain'
import { finishHoney } from './Cinema2HoneyFinishing'
import { HONEY_LIGHT_DEFAULTS,HONEY_LIGHT_RANGES,type HoneyLightControls } from '../modules/honey/Cinema2HoneyLighting'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'

export const CINEMA2_HONEY_PRESET_ID=cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.honey')
export const CINEMA2_HONEY_MODULE_ID=cinema2StableId<Cinema2ModuleId>('honey-wall')
const lightParameterNames:Record<string,string>={outerGain:'outer-intensity',innerGain:'inner-intensity',underGain:'under-intensity',lightSpill:'light-spill'}
export const honeyParameterId=(key:string)=>cinema2StableId<Cinema2ParameterId>(`honey-${lightParameterNames[key]??key}`)
const root=cinema2StableId<Cinema2SceneNodeId>('honey-root'),wall=cinema2StableId<Cinema2SceneNodeId>('honey-wall-node')
const layer=cinema2StableId<Cinema2LayerId>('honey-world'),camera=cinema2StableId<Cinema2CameraId>('honey-camera')
const target=cinema2StableId<Cinema2RenderTargetId>('honey-scene-target'),pass=cinema2StableId<Cinema2RenderPassId>('honey-scene-pass')
const color=cinema2StableId<Cinema2RenderSlotId>('honey-scene-color'),depth=cinema2StableId<Cinema2RenderSlotId>('honey-scene-depth')
const labels={face:'Face',edge:'Edge / Sleeve',cavity:'Cavity / Body',substrate:'Substrate / Background',outer:'Outer Channel',inner:'Inner Channel',under:'Under Channel'} as const
const paletteParameters:Cinema2ParameterManifest[]=HONEY_PALETTE_KEYS.map((key,index)=>({id:honeyParameterId(key),label:labels[key],type:'color',defaultValue:HONEY_PALETTE[key],section:'Design',designParentGroup:'palette',order:index+1,exposure:'primary',persistence:'preset',reset:'authored-default',modulatable:false,choreographable:false,automatable:false}))

const lightLabels={outerGain:'Outer Channel Intensity',innerGain:'Inner Channel Intensity',underGain:'Underlighting',lightSpill:'Light Spill',ambient:'Ambient Lighting',bloom:'Bloom',ao:'Ambient Occlusion'} as const
const lightingParameters:Cinema2ParameterManifest[]=(Object.keys(HONEY_LIGHT_DEFAULTS) as (keyof HoneyLightControls)[]).map((key,i)=>({id:honeyParameterId(key),label:lightLabels[key],type:'float',defaultValue:HONEY_LIGHT_DEFAULTS[key],min:0,max:HONEY_LIGHT_RANGES[key],step:.01,section:'Design',designParentGroup:key==='ambient'?'master-controls':key==='bloom'||key==='ao'||key==='lightSpill'?'effects':'design',order:i+10,exposure:'primary',persistence:'preset',reset:'authored-default',modulatable:false,choreographable:false,automatable:false}))
const moduleLightKeys=['outerGain','innerGain','underGain','lightSpill'] as const
/** P02 static native review. Do not promote to keeper or add placeholder performance controls. */
export const CINEMA2_HONEY_PRESET_MANIFEST:Readonly<Cinema2NativePresetManifest>=finishHoney({
  schemaId:CINEMA2_NATIVE_PRESET_SCHEMA_ID,schemaVersion:CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,id:CINEMA2_HONEY_PRESET_ID,revision:1,
  metadata:{name:'HONEY',description:'A close industrial honeycomb wall of solid beveled hex plates, recessed chambers, mixed industrial finishes and physical emissive channels. Static material and lighting review.',author:'STAGELESS',tags:['cinematic','3d','static']},
  capabilities:[{id:'render.webgl2',requirement:'required',purpose:'Instanced native hexagonal assemblies.'},{id:'render.depth',requirement:'required',purpose:'Resolve raised plates and stationary recessed chambers.'},{id:'scene.3d',requirement:'required',purpose:'World-space axial hex field.'},{id:'camera.world',requirement:'required',purpose:'Shared close perspective camera.'},{id:'render.hdr',requirement:'optional',purpose:'HDR emissive channels with rgba8 fallback.'},{id:'lighting',requirement:'required',purpose:'Shared directional and ambient light rig.'}],
  parameters:[{...CINEMA2_QUALITY_MODE_PARAMETER,section:'Design',designParentGroup:'master-controls'},...paletteParameters,...lightingParameters],
  modules:[{id:CINEMA2_HONEY_MODULE_ID,typeId:CINEMA2_HONEY_NATIVE_MODULE_TYPE_ID,version:1,parameters:{...HONEY_PALETTE,...Object.fromEntries(moduleLightKeys.map(key=>[key,HONEY_LIGHT_DEFAULTS[key]]))},parameterBindings:Object.fromEntries([...HONEY_PALETTE_KEYS,...moduleLightKeys].map(key=>[key,cinema2Ref(honeyParameterId(key))]))}],
  scene:{nodes:[{id:root,kind:'group',coordinateSpace:'world'},{id:wall,kind:'module',parent:cinema2Ref(root),module:cinema2Ref(CINEMA2_HONEY_MODULE_ID)}],roots:[cinema2Ref(root)]},
  layers:[{id:layer,label:'HONEY Wall',source:cinema2Ref(root),role:'world',depthPolicy:'read-write',order:0}],
  cameras:[{id:camera,label:'HONEY Close Wall',projection:'perspective',transform:{position:HONEY_CAMERA.position},target:HONEY_CAMERA.target,fovDegrees:HONEY_CAMERA.fov,near:.1,far:100,rig:{kind:'static'}}],
  lighting:{lights:[{id:cinema2StableId<Cinema2LightId>('honey-ambient'),type:'ambient',color:[.76,.86,1,1],intensity:HONEY_LIGHT_DEFAULTS.ambient,controls:{intensity:cinema2Ref(honeyParameterId('ambient'))}},{id:cinema2StableId<Cinema2LightId>('honey-key'),type:'directional',color:[.83,.91,1,1],intensity:1.1,transform:{rotation:[-.55,.46,0]},config:{castShadow:true,shadowExtent:13,shadowDepth:45,shadowFocusAhead:13,shadowBias:.012,shadowSoftness:1}}]},
  environment:{backgroundColor:HONEY_PALETTE.substrate,controls:{backgroundColor:cinema2Ref(honeyParameterId('substrate'))}},
  render:{targets:[{id:target,ownership:'transient',descriptor:{size:{kind:'viewport'},colorFormat:'rgba8',depthFormat:'depth24'}}],passes:[{id:pass,kind:'scene',layers:[cinema2Ref(layer)],outputs:[{id:color,target:cinema2Ref(target),attachment:'color'},{id:depth,target:cinema2Ref(target),attachment:'depth'}]}],outputPass:cinema2Ref(pass)},
  defaults:{camera:cinema2Ref(camera)},output:{renderPass:cinema2Ref(pass),colorSpace:'srgb',alphaMode:'opaque'},
},honeyParameterId)
