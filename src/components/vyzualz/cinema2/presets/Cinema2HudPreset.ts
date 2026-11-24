import { CINEMA2_NATIVE_PRESET_SCHEMA_ID,CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,cinema2NamespacedId,cinema2StableId,cinema2Ref,type Cinema2PresetId,type Cinema2ModuleId,type Cinema2SceneNodeId,type Cinema2LayerId,type Cinema2CameraId,type Cinema2RenderTargetId,type Cinema2RenderPassId,type Cinema2RenderSlotId,type Cinema2ParameterId,type Cinema2ParameterManifest,type Cinema2NativePresetManifest,type Cinema2ChoreographyRuleManifest,type Cinema2CapabilityId,type Cinema2ChoreographyContinuousSourcePath,type Cinema2ChoreographySignal,type Cinema2EffectId,type Cinema2EffectManifest,type Cinema2RenderPassManifest,type Cinema2RenderTargetManifest } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_HUD_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2HudNativeModule'
import { HUD_COLOR_KEYS,HUD_DEFAULTS,HUD_PALETTE,HUD_PATTERNS,zeroHudSignals } from '../modules/hud/Cinema2HudGeometry'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { withCinema2MoodDrives,type Cinema2MoodDrive } from './Cinema2MoodConductorAuthoring'
import { cinema2AutoTargets } from './Cinema2AutoPerformanceAuthoring'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID } from '../effects/Cinema2VolumetricAtmosphereEffect'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_ANTI_ALIASING_EFFECT_TYPE_ID } from '../effects/Cinema2AntiAliasingEffect'

export const CINEMA2_HUD_PRESET_ID=cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.hud')
export const CINEMA2_HUD_MODULE_ID=cinema2StableId<Cinema2ModuleId>('hud-reactor')
export const hudParameterId=(key:string)=>cinema2StableId<Cinema2ParameterId>(`hud-${key.replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`)}`)
const root=cinema2StableId<Cinema2SceneNodeId>('hud-root'),node=cinema2StableId<Cinema2SceneNodeId>('hud-reactor-node')
const layer=cinema2StableId<Cinema2LayerId>('hud-world'),camera=cinema2StableId<Cinema2CameraId>('hud-camera')
const sceneTarget=cinema2StableId<Cinema2RenderTargetId>('hud-scene-target'),scenePass=cinema2StableId<Cinema2RenderPassId>('hud-scene-pass')
const sceneColor=cinema2StableId<Cinema2RenderSlotId>('hud-scene-color'),sceneDepth=cinema2StableId<Cinema2RenderSlotId>('hud-scene-depth')
const base=(key:string,label:string,parent:'master-controls'|'design'|'palette'|'effects',group:string,order:number)=>({id:hudParameterId(key),label,section:'Design' as const,designParentGroup:parent,group,order,exposure:'primary' as const,persistence:'preset' as const,reset:'authored-default' as const})
const slider=(key:string,label:string,parent:'master-controls'|'design'|'effects',group:string,order:number,defaultValue:number,min=0,max=1,step=.01):Cinema2ParameterManifest=>({...base(key,label,parent,group,order),type:'float',defaultValue,min,max,step,modulatable:true,choreographable:true,automatable:true})
const toggle=(key:string,label:string,parent:'master-controls'|'design',group:string,order:number,defaultValue:boolean):Cinema2ParameterManifest=>({...base(key,label,parent,group,order),type:'boolean',defaultValue})
const labels={primary:'Primary Arcs',meters:'Meter Bars',indicators:'Indicators',metal:'Machined Metal',satellites:'Satellite Modules',background:'Background'} as const
const controls:Cinema2ParameterManifest[]=[
  slider('intensity','Master Intensity','master-controls','Performance',0,HUD_DEFAULTS.intensity,0,2),
  slider('reactivity','Audio Reactivity','master-controls','Performance',1,HUD_DEFAULTS.reactivity),
  slider('motion','Motion Amount','master-controls','Performance',2,HUD_DEFAULTS.motion),
  toggle('bpmSync','BPM Sync','master-controls','Performance',3,true),
  toggle('autoPerformance','Auto Performance','master-controls','Performance',4,false),
  toggle('cameraMotion','Camera Motion','master-controls','Camera',5,true),
  {...slider('cameraSway','Camera Motion Intensity','master-controls','Camera',6,.35),visibleWhen:[{kind:'parameter-equals',parameterId:hudParameterId('cameraMotion'),value:true}]},
  {...base('pattern','Pattern','design','Pattern',1),type:'enum',defaultValue:'reactor',options:HUD_PATTERNS.map(value=>({value,label:value.toUpperCase().replace(/-/g,' ')}))},
  toggle('patternChange','Pattern Change','design','Pattern',2,false),
  {...base('trigger','Trigger','design','Pattern',3),type:'enum',defaultValue:'bar4',options:CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,visibleWhen:[{kind:'parameter-equals',parameterId:hudParameterId('patternChange'),value:true}]},
  slider('rate','Motion Rate','design','Motion',10,HUD_DEFAULTS.rate,.25,2),
  slider('separation','Ring Separation','design','Geometry',11,HUD_DEFAULTS.separation),
  slider('coverage','Light Coverage','design','Lighting',12,HUD_DEFAULTS.coverage),
  slider('satelliteAmount','Satellite Amount','design','Geometry',13,HUD_DEFAULTS.satelliteAmount),
  slider('shutter','Shutter Travel','design','Geometry',14,HUD_DEFAULTS.shutter),
  slider('meterTravel','Meter Travel','design','Lighting',15,HUD_DEFAULTS.meterTravel),
  ...HUD_COLOR_KEYS.map((key,index):Cinema2ParameterManifest=>({...base(key,labels[key],'palette','Colors',index),type:'color',defaultValue:HUD_PALETTE[key],modulatable:false,choreographable:false,automatable:false})),
  slider('bloom','Bloom','effects','Lighting',1,.48,0,1.5),
  slider('haze','Atmosphere Density','effects','Depth',2,.004,0,.025,.001),
  slider('vignette','Vignette','effects','Optics',3,.24),
]
const moduleDefaults={...HUD_DEFAULTS,...HUD_PALETTE,bpmSync:true,autoPerformance:false,pattern:'reactor',patternChange:false,trigger:'bar4'}
const moduleBindings=Object.fromEntries(Object.keys(moduleDefaults).map(key=>[key,cinema2Ref(hudParameterId(key))]))
const moduleTarget=(property:string)=>cinema2AutoTargets.module(CINEMA2_HUD_MODULE_ID,property)
const continuous=[
  ['sub','audio.bands.sub','audio.bands'],['bass','audio.bands.bass','audio.bands'],['mid','audio.bands.mid','audio.bands'],['high','audio.bands.high','audio.bands'],['air','audio.bands.air','audio.bands'],
  ['flux','audio.features.spectralFlux','audio.features'],['vocal','audio.features.vocalPresence','music.vocal-presence'],['build','audio.features.buildProgress','music.build'],
  ['directorIntensity','director.intensity','visual-director.significance'],['directorBuild','director.build','visual-director.significance'],['directorImpact','director.impact','visual-director.significance'],
] as const satisfies readonly (readonly [string,Cinema2ChoreographyContinuousSourcePath,Cinema2CapabilityId])[]
const events=[
  ['kick','kick','music.rhythm-events',.28],['snare','snare','music.rhythm-events',.25],['beat','beat','music.beat',.22],['downbeat','downbeat','music.downbeat',.55],
  ['bar','bar','music.bar',.65],['phrase','phrase','music.phrase',1.2],['section','section-change','music.section',1.4],['drop','drop','music.drop',1.6],
] as const satisfies readonly (readonly [string,Cinema2ChoreographySignal,Cinema2CapabilityId,number])[]
const rules:Cinema2ChoreographyRuleManifest[]=[
  ...continuous.map(([property,path,capability],i):Cinema2ChoreographyRuleManifest=>({id:cinema2StableId(`hud-signal-${i}`),priority:10+i,source:{signal:'continuous',path,capability,smoothingMs:85,clamp:[0,1]},actions:[{id:cinema2StableId(`hud-signal-map-${i}`),target:moduleTarget(property),operation:'replace',value:1}]})),
  ...events.map(([property,signal,capability,release],i):Cinema2ChoreographyRuleManifest=>({id:cinema2StableId(`hud-event-${property}`),priority:30+i,source:{signal,capability},conditions:[{kind:'once-per-event'},...(['beat','downbeat','bar','phrase'].includes(property)?[{kind:'not-silent' as const}]:[])],actions:[{id:cinema2StableId(`hud-event-map-${property}`),target:moduleTarget(property),operation:'envelope',composition:'replace',value:1,envelope:{attack:.015,hold:.035,release,unit:'seconds'},retrigger:'restart'}]})),
]
const effectId=(key:string)=>cinema2StableId<Cinema2EffectId>(`hud-${key}`)
const effects:Cinema2EffectManifest[]=[
  {id:effectId('atmosphere'),typeId:CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID,version:1,parameters:{mix:1,density:.004,beamIntensity:0,ambientHaze:.1,hazeColor:[.12,.15,.35,1],occlusion:.9,noiseStrength:.13,drift:0,maxDistance:24,reactivity:0,mistAmount:0,floorReflection:0},parameterBindings:{density:cinema2Ref(hudParameterId('haze'))}},
  {id:effectId('bloom'),typeId:CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,version:1,parameters:{mix:1,intensity:.48,threshold:.8,knee:.2,spread:.32,levels:4,clampMax:4},parameterBindings:{intensity:cinema2Ref(hudParameterId('bloom'))}},
  {id:effectId('grade'),typeId:CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,version:1,parameters:{mix:1,toneMap:2,exposure:1,contrast:1.05,saturation:1,vignette:.24,grain:0,aberration:0},parameterBindings:{vignette:cinema2Ref(hudParameterId('vignette'))}},
  {id:effectId('aa'),typeId:CINEMA2_ANTI_ALIASING_EFFECT_TYPE_ID,version:1,parameters:{mix:1,mode:'auto'}},
]
const targets:Cinema2RenderTargetManifest[]=[{id:sceneTarget,ownership:'transient',descriptor:{size:{kind:'viewport'},colorFormat:'rgba16f',fallbackColorFormat:'rgba8',depthFormat:'depth24'}}]
const passes:Cinema2RenderPassManifest[]=[{id:scenePass,kind:'scene',layers:[cinema2Ref(layer)],outputs:[{id:sceneColor,target:cinema2Ref(sceneTarget),attachment:'color'},{id:sceneDepth,target:cinema2Ref(sceneTarget),attachment:'depth'}]}]
let previous=scenePass,output=sceneColor
for(const effect of effects){
  const pass=cinema2StableId<Cinema2RenderPassId>(`${effect.id}-pass`),target=cinema2StableId<Cinema2RenderTargetId>(`${effect.id}-target`),slot=cinema2StableId<Cinema2RenderSlotId>(`${effect.id}-color`)
  const hdr=effect.id===effectId('atmosphere')||effect.id===effectId('bloom')
  targets.push({id:target,ownership:'transient',descriptor:{size:{kind:'viewport'},colorFormat:hdr?'rgba16f':'rgba8',...(hdr?{fallbackColorFormat:'rgba8' as const}:{})}})
  passes.push({id:pass,kind:'fullscreen',effect:cinema2Ref(effect.id),dependsOn:[cinema2Ref(previous)],inputs:[{id:cinema2StableId<Cinema2RenderSlotId>(`${effect.id}-input`),source:{pass:cinema2Ref(previous),output},attachment:'color'},...(effect.id===effectId('atmosphere')?[{id:cinema2StableId<Cinema2RenderSlotId>('hud-atmosphere-depth'),source:{pass:cinema2Ref(scenePass),output:sceneDepth},attachment:'depth' as const}]:[])],outputs:[{id:slot,target:cinema2Ref(target),attachment:'color'}]})
  previous=pass;output=slot
}
const drives:Cinema2MoodDrive[]=[]
function drive(name:string,target:Cinema2MoodDrive['target'],pairs:readonly (readonly [Cinema2MoodDrive['source'],number])[]){for(const [source,value] of pairs)drives.push({id:`${name}-${source.slice(5)}`,target,source,operation:'multiply',value})}
drive('intensity',moduleTarget('intensity'),[['mood.peak',1.22],['mood.calm',.68],['mood.silence',.18]])
drive('reactivity',moduleTarget('reactivity'),[['mood.activity',1.12],['mood.calm',.8]])
drive('motion',moduleTarget('motion'),[['mood.momentum',1.2],['mood.calm',.55],['mood.silence',.05]])
drive('rate',moduleTarget('rate'),[['mood.drive',1.32],['mood.calm',.68]])
drive('separation',moduleTarget('separation'),[['mood.complexity',1.28],['mood.calm',.75]])
drive('coverage',moduleTarget('coverage'),[['mood.brightness',1.3],['mood.calm',.6],['mood.silence',.22]])
drive('satellites',moduleTarget('satelliteAmount'),[['mood.complexity',1.2],['mood.calm',.56]])
drive('shutter',moduleTarget('shutter'),[['mood.build',1.28],['mood.calm',.7]])
drive('meter-travel',moduleTarget('meterTravel'),[['mood.energy',1.3],['mood.calm',.6]])
drive('camera',cinema2AutoTargets.camera(camera,'control.motionAmount'),[['mood.activity',1.2],['mood.calm',.6],['mood.silence',.15]])
drive('bloom',cinema2AutoTargets.effect(effectId('bloom'),'intensity'),[['mood.peak',1.32],['mood.calm',.65],['mood.silence',.1]])
drive('haze',cinema2AutoTargets.effect(effectId('atmosphere'),'density'),[['mood.build',1.3],['mood.calm',.6]])
drive('vignette',cinema2AutoTargets.effect(effectId('grade'),'vignette'),[['mood.calm',1.2],['mood.peak',.75]])
const capabilities=[...new Set<Cinema2CapabilityId>(['render.webgl2','render.depth','scene.3d','camera.world','render.hdr','audio.transport',...continuous.map(route=>route[2]),...events.map(route=>route[2])])].map(id=>({id,requirement:(['render.webgl2','render.depth','scene.3d','camera.world'].includes(id)?'required':'optional') as 'required'|'optional',purpose:`HUD shared ${id} support`}))
export const CINEMA2_HUD_PRESET_MANIFEST:Readonly<Cinema2NativePresetManifest>=withCinema2MoodDrives({
  schemaId:CINEMA2_NATIVE_PRESET_SCHEMA_ID,schemaVersion:CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,id:CINEMA2_HUD_PRESET_ID,revision:1,
  metadata:{name:'HUD',description:'A precision cybernetic reactor of beveled rings, recessed emissive tracks, orbital modules and nine independently choreographed programs.',author:'STAGELESS',tags:['cinematic','3d','audio-reactive']},
  capabilities,parameters:controls,
  modules:[{id:CINEMA2_HUD_MODULE_ID,typeId:CINEMA2_HUD_NATIVE_MODULE_TYPE_ID,version:1,parameters:{...moduleDefaults,...zeroHudSignals()},parameterBindings:moduleBindings}],
  choreography:{rules},scene:{nodes:[{id:root,kind:'group',coordinateSpace:'world'},{id:node,kind:'module',parent:cinema2Ref(root),module:cinema2Ref(CINEMA2_HUD_MODULE_ID)}],roots:[cinema2Ref(root)]},
  layers:[{id:layer,label:'HUD Reactor',source:cinema2Ref(root),role:'world',depthPolicy:'read-write',order:0}],
  cameras:[{id:camera,label:'HUD Front Perspective',projection:'perspective',transform:{position:[.12,.2,13]},target:[0,0,0],fovDegrees:38,minAspect:1.3,near:.1,far:60,rig:{kind:'static'},motion:{idleMotion:true,tempo:{referenceBpm:120,flightSpeed:false,weave:.18,bob:.08,roll:0,fov:0,punch:0}},controls:{motionEnabled:cinema2Ref(hudParameterId('cameraMotion')),tempoSync:cinema2Ref(hudParameterId('bpmSync')),motionAmount:cinema2Ref(hudParameterId('cameraSway')),masterMotionAmount:cinema2Ref(hudParameterId('motion'))},smoothingMs:120}],
  environment:{backgroundColor:HUD_PALETTE.background,controls:{backgroundColor:cinema2Ref(hudParameterId('background'))}},
  effects,render:{targets,passes,outputPass:cinema2Ref(previous)},defaults:{camera:cinema2Ref(camera)},output:{renderPass:cinema2Ref(previous),colorSpace:'srgb',alphaMode:'opaque'},
},{idPrefix:'hud-auto',enabledParameter:hudParameterId('autoPerformance'),strengthParameter:hudParameterId('reactivity'),patternControls:{patternChange:hudParameterId('patternChange'),trigger:hudParameterId('trigger')},drives})
