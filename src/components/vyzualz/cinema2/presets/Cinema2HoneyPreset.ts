import { CINEMA2_NATIVE_PRESET_SCHEMA_ID,CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,cinema2NamespacedId,cinema2StableId,cinema2Ref,type Cinema2PresetId,type Cinema2ModuleId,type Cinema2SceneNodeId,type Cinema2LayerId,type Cinema2CameraId,type Cinema2RenderTargetId,type Cinema2RenderPassId,type Cinema2RenderSlotId,type Cinema2ParameterId,type Cinema2ParameterManifest,type Cinema2NativePresetManifest } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_HONEY_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2HoneyNativeModule'
import { HONEY_CAMERA,HONEY_PALETTE,HONEY_PALETTE_KEYS } from '../modules/honey/Cinema2HoneyDomain'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'

export const CINEMA2_HONEY_PRESET_ID=cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.honey')
export const CINEMA2_HONEY_MODULE_ID=cinema2StableId<Cinema2ModuleId>('honey-wall')
export const honeyParameterId=(key:string)=>cinema2StableId<Cinema2ParameterId>(`honey-${key}`)
const root=cinema2StableId<Cinema2SceneNodeId>('honey-root'),wall=cinema2StableId<Cinema2SceneNodeId>('honey-wall-node')
const layer=cinema2StableId<Cinema2LayerId>('honey-world'),camera=cinema2StableId<Cinema2CameraId>('honey-camera')
const target=cinema2StableId<Cinema2RenderTargetId>('honey-scene-target'),pass=cinema2StableId<Cinema2RenderPassId>('honey-scene-pass')
const color=cinema2StableId<Cinema2RenderSlotId>('honey-scene-color'),depth=cinema2StableId<Cinema2RenderSlotId>('honey-scene-depth')
const labels={face:'Face',edge:'Edge / Sleeve',cavity:'Cavity / Body',substrate:'Substrate / Background',outer:'Outer Channel Seat',inner:'Inner Channel Seat',under:'Lower Channel Seat'} as const
const paletteParameters:Cinema2ParameterManifest[]=HONEY_PALETTE_KEYS.map((key,index)=>({id:honeyParameterId(key),label:labels[key],type:'color',defaultValue:HONEY_PALETTE[key],section:'Design',designParentGroup:'palette',order:index+1,exposure:'primary',persistence:'preset',reset:'authored-default',modulatable:false,choreographable:false,automatable:false}))

/** P01 static native review. Do not promote to keeper or add placeholder performance controls. */
export const CINEMA2_HONEY_PRESET_MANIFEST:Readonly<Cinema2NativePresetManifest>={
  schemaId:CINEMA2_NATIVE_PRESET_SCHEMA_ID,schemaVersion:CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,id:CINEMA2_HONEY_PRESET_ID,revision:1,
  metadata:{name:'HONEY',description:'A close industrial honeycomb wall of solid beveled hex plates, recessed chambers and physical channel seats. Static native geometry review.',author:'STAGELESS',tags:['cinematic','3d','static']},
  capabilities:[{id:'render.webgl2',requirement:'required',purpose:'Instanced native hexagonal assemblies.'},{id:'render.depth',requirement:'required',purpose:'Resolve raised plates and stationary recessed chambers.'},{id:'scene.3d',requirement:'required',purpose:'World-space axial hex field.'},{id:'camera.world',requirement:'required',purpose:'Shared close perspective camera.'}],
  parameters:[{...CINEMA2_QUALITY_MODE_PARAMETER,section:'Design',designParentGroup:'master-controls'},...paletteParameters],
  modules:[{id:CINEMA2_HONEY_MODULE_ID,typeId:CINEMA2_HONEY_NATIVE_MODULE_TYPE_ID,version:1,parameters:{...HONEY_PALETTE},parameterBindings:Object.fromEntries(HONEY_PALETTE_KEYS.map(key=>[key,cinema2Ref(honeyParameterId(key))]))}],
  scene:{nodes:[{id:root,kind:'group',coordinateSpace:'world'},{id:wall,kind:'module',parent:cinema2Ref(root),module:cinema2Ref(CINEMA2_HONEY_MODULE_ID)}],roots:[cinema2Ref(root)]},
  layers:[{id:layer,label:'HONEY Wall',source:cinema2Ref(root),role:'world',depthPolicy:'read-write',order:0}],
  cameras:[{id:camera,label:'HONEY Close Wall',projection:'perspective',transform:{position:HONEY_CAMERA.position},target:HONEY_CAMERA.target,fovDegrees:HONEY_CAMERA.fov,near:.1,far:100,rig:{kind:'static'}}],
  environment:{backgroundColor:HONEY_PALETTE.substrate,controls:{backgroundColor:cinema2Ref(honeyParameterId('substrate'))}},
  render:{targets:[{id:target,ownership:'transient',descriptor:{size:{kind:'viewport'},colorFormat:'rgba8',depthFormat:'depth24'}}],passes:[{id:pass,kind:'scene',layers:[cinema2Ref(layer)],outputs:[{id:color,target:cinema2Ref(target),attachment:'color'},{id:depth,target:cinema2Ref(target),attachment:'depth'}]}],outputPass:cinema2Ref(pass)},
  defaults:{camera:cinema2Ref(camera)},output:{renderPass:cinema2Ref(pass),colorSpace:'srgb',alphaMode:'opaque'},
}
