import { CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2NamespacedId, cinema2Ref, cinema2StableId, type Cinema2CameraId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyContinuousSourcePath, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest, type Cinema2DesignParentGroup, type Cinema2EffectId, type Cinema2LayerId, type Cinema2LightId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest, type Cinema2PresetId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId, type Cinema2SceneNodeId } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID } from '../effects/Cinema2VolumetricAtmosphereEffect'
import { CINEMA2_ARC_ANGEL_MODULE_TYPE_ID, ARC_ANGEL_CAMERA, ARC_ANGEL_PALETTE, ARC_ANGEL_PATTERNS } from '../modules/arcAngel/ArcAngelDomain'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { cinema2AutoTargets } from './Cinema2AutoPerformanceAuthoring'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'

export const CINEMA2_ARC_ANGEL_PRESET_ID=cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.arc-angel')
const id=(name:string)=>cinema2StableId<Cinema2ParameterId>(`arc-angel-${name}`)
const bind=(name:string)=>cinema2Ref(id(name))
const moduleId=cinema2StableId<Cinema2ModuleId>('arc-angel-system')
const root=cinema2StableId<Cinema2SceneNodeId>('arc-angel-root'), node=cinema2StableId<Cinema2SceneNodeId>('arc-angel-apparatus')
const layer=cinema2StableId<Cinema2LayerId>('arc-angel-world'), camera=cinema2StableId<Cinema2CameraId>('arc-angel-camera')
const effectId=(name:string)=>cinema2StableId<Cinema2EffectId>(`arc-angel-${name}`)
const bloom=effectId('bloom'), atmosphere=effectId('atmosphere'), finish=effectId('finish')
const base=(name:string,label:string,parent:Cinema2DesignParentGroup,group:string,order:number,description:string)=>({id:id(name),label,description,section:'Design' as const,designParentGroup:parent,group,order,exposure:'primary' as const,persistence:'preset' as const,reset:'authored-default' as const})
const slider=(name:string,label:string,parent:Cinema2DesignParentGroup,group:string,order:number,defaultValue:number,min:number,max:number,description:string,manual=false,step=.01):Cinema2ParameterManifest=>({...base(name,label,parent,group,order,description),type:'float',defaultValue,min,max,step,modulatable:!manual,choreographable:!manual})
const toggle=(name:string,label:string,parent:Cinema2DesignParentGroup,group:string,order:number,defaultValue:boolean,description:string):Cinema2ParameterManifest=>({...base(name,label,parent,group,order,description),type:'boolean',defaultValue})
const choice=(name:string,label:string,parent:Cinema2DesignParentGroup,group:string,order:number,defaultValue:string,options:readonly {value:string;label:string}[],description:string):Cinema2ParameterManifest=>({...base(name,label,parent,group,order,description),type:'enum',defaultValue,options})
const parameters:readonly Cinema2ParameterManifest[]=[
  CINEMA2_QUALITY_MODE_PARAMETER,
  toggle('auto-performance','Auto Performance','master-controls','Playback',1,false,'Use shared musical mood and pattern authority.'),
  toggle('bpm-sync','BPM Sync','master-controls','Playback',2,true,'Synchronize to the shared clock when enabled by the Audio Dock.'),
  slider('intensity','Master Intensity','master-controls','Playback',3,.75,0,1,'Scales routed energy and impact.'),
  slider('reactivity','Music Reactivity','master-controls','Playback',4,.75,0,1,'Strength of musical modulation.',true),
  choice('motion-safety','Motion Safety','master-controls','Playback',5,'reduced',[{value:'full',label:'Full Motion'},{value:'reduced',label:'Reduced Motion'},{value:'lockoff',label:'Lock Off'}],'Bounds character and camera motion.'),
  choice('pattern','Pattern','design','Pattern',1,'awakening',ARC_ANGEL_PATTERNS,'Choose a celestial performance program.'),
  toggle('pattern-change','Pattern Change','design','Pattern',2,false,'Advance on a fresh shared musical event.'),
  {...choice('trigger','Trigger','design','Pattern',3,'bar4',CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,'Select the shared event that advances patterns.'),visibleWhen:[{kind:'parameter-equals',parameterId:id('pattern-change'),value:true}]},
  toggle('camera-motion','Camera Motion','design','Camera',1,true,'Authorize orbital drift and musical push/release.'),
  slider('camera-amount','Camera Amount','design','Camera',2,.55,0,1,'Controls the shared camera motion gain.'),
  toggle('model-visible','Model Visible','design','Angel',1,true,'Visibility permission for the supplied animated Angel.'),
  slider('model-scale','Model Scale','design','Angel',2,1,.65,1.12,'Uniform scale within the authored framing envelope.',true),
  slider('movement','Movement Intensity','design','Angel',3,.75,0,1,'Controls character articulation and apparatus motion.'),
  slider('animation-rate','Animation Rate','design','Angel',4,1,.25,2,'Speed of the beat-synchronized authored performance.'),
  slider('arm-spread','Arm Spread','design','Angel',5,.75,0,1,'Independent arm animation phase separation.'),
  slider('animation-blend','Animation Blending','design','Angel',6,.8,0,1,'Excursion from the central expanded pose into authored clip segments.'),
  slider('levitation','Levitation','design','Angel',7,.65,0,1,'Vertical float amplitude.'),
  slider('halo-scale','Halo Scale','design','Halo',1,1,.6,1.4,'Scale of the supplied red halo.'),
  slider('halo-rotation','Halo Rotation','design','Halo',2,.35,0,1,'Oscillation of the supplied halo.'),
  slider('ring-rotation','Ring Rotation','design','Celestial Apparatus',1,.65,0,1,'Angular travel of the seven armillary rings.'),
  slider('ring-intensity','Ring Intensity','design','Celestial Apparatus',2,.8,0,1,'Intensity of independently addressable ring segments.'),
  slider('environment-density','Environment Density','design','Celestial Apparatus',3,.88,0,1,'Number of visible ring layers and apparatus visibility.'),
  slider('spatial-depth','Spatial Depth','design','Celestial Apparatus',4,1,.6,1.5,'Separation of the three-dimensional ring layers.'),
  slider('bloom','Bloom','effects','Finish',1,.36,0,1,'HDR localized emission halo.'),
  slider('atmosphere','Atmospheric Fog','effects','Finish',2,.25,0,1,'Depth-aware mist and volumetric beams.'),
  slider('finish','Cinematic Finish','effects','Finish',3,.38,0,1,'Cinematic grading mix.'),
  slider('reflection','Reflection Strength','effects','Lighting',1,.26,0,1,'PBR environment reflection.'),
  slider('selective-light','Selective Illumination','effects','Lighting',2,.7,0,1,'Localized animated light on bronze and anatomical surfaces.'),
  slider('flash-accents','Flash Accents','effects','Lighting',3,.45,0,1,'Bounds rapid accent intensity; zero removes event-driven flashes.'),
  slider('impact-waves','Impact Waves','effects','Energy',1,.65,0,1,'Expanding radial energy waves.'),
  slider('energy-trails','Energy Trails','effects','Energy',2,.55,0,1,'Motion history following the ten wrists.'),
  slider('particles','Particles','effects','Energy',3,.65,0,1,'Density of suspended golden embers.'),
  ...Object.entries({background:'Background',structural:'Bronze Structure',primary:'Primary Energy',secondary:'Halo / Secondary',accent:'Accent',body:'Body Tint'}).map(([key,label],i):Cinema2ParameterManifest=>({...base(key,label,'palette','Colors',i+1,`Independent ${label.toLowerCase()} color.`),type:'color',defaultValue:ARC_ANGEL_PALETTE[key as keyof typeof ARC_ANGEL_PALETTE]})),
]
const moduleKeys=['auto-performance','bpm-sync','intensity','reactivity','motion-safety','pattern','pattern-change','trigger','model-visible','model-scale','movement','animation-rate','arm-spread','animation-blend','levitation','halo-scale','halo-rotation','ring-rotation','ring-intensity','environment-density','spatial-depth','reflection','selective-light','flash-accents','impact-waves','energy-trails','particles','structural','primary','secondary','accent','body']
const bindings=Object.fromEntries(moduleKeys.map(key=>[key,bind(key)]))
const continuous=(name:string,path:Cinema2ChoreographyContinuousSourcePath,capability:'audio.features'|'audio.bands'|'visual-director.significance',smoothingMs:number):Cinema2ChoreographyRuleManifest=>({id:cinema2StableId<Cinema2ChoreographyRuleId>(`arc-angel-${name}-rule`),priority:12,strengthParameter:bind('reactivity'),source:{signal:'continuous',path,capability,clamp:[0,1],smoothingMs},conditions:[{kind:'not-silent'}],actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`arc-angel-${name}-read`),target:{kind:'module',ref:cinema2Ref(moduleId),property:name},operation:'replace',value:1}]})
const event=(name:'kick'|'snare'|'downbeat'|'drop'|'phrase'|'bar'|'section-change',attack:number,hold:number,release:number):Cinema2ChoreographyRuleManifest=>({id:cinema2StableId<Cinema2ChoreographyRuleId>(`arc-angel-${name}-rule`),priority:30,strengthParameter:bind('reactivity'),source:{signal:name,capability:name==='drop'?'music.drop':name==='phrase'?'music.phrase':name==='downbeat'?'music.downbeat':name==='bar'?'music.bar':name==='section-change'?'music.section':'music.rhythm-events'},conditions:[{kind:'once-per-event'},...(name==='drop'?[]:[{kind:'not-silent' as const}])],actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`arc-angel-${name}-pulse`),target:{kind:'module',ref:cinema2Ref(moduleId),property:name==='section-change'?'section':name},operation:'envelope',composition:'replace',value:1,envelope:{attack,hold,release,unit:'seconds'},retrigger:'restart'}]})
// The shared camera runtime owns permission, safety, BPM, smoothing and the final matrices.
// Strength comes from the existing camera amount; no native camera or local musical detector.
const cameraBuild:Cinema2ChoreographyRuleManifest={id:cinema2StableId<Cinema2ChoreographyRuleId>('arc-angel-camera-build'),priority:40,enabledParameter:bind('camera-motion'),strengthParameter:bind('camera-amount'),source:{signal:'continuous',path:'director.build',capability:'visual-director.significance',clamp:[0,1],smoothingMs:350},conditions:[{kind:'not-silent'}],actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>('arc-angel-camera-approach'),target:{kind:'camera',ref:cinema2Ref(camera),property:'transform.position'},operation:'add',value:[.45,-.15,-.45]}]}
const cameraDrop:Cinema2ChoreographyRuleManifest={id:cinema2StableId<Cinema2ChoreographyRuleId>('arc-angel-camera-drop'),priority:110,enabledParameter:bind('camera-motion'),strengthParameter:bind('camera-amount'),source:{signal:'drop',capability:'music.drop'},conditions:[{kind:'once-per-event'}],actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>('arc-angel-camera-dolly'),target:{kind:'camera',ref:cinema2Ref(camera),property:'transform.position'},operation:'envelope',composition:'add',value:[0,-.1,-.55],envelope:{attack:.35,hold:.35,release:2.1,unit:'seconds'},retrigger:'restart'},{id:cinema2StableId<Cinema2ChoreographyActionId>('arc-angel-camera-lens'),target:{kind:'camera',ref:cinema2Ref(camera),property:'fovDegrees'},operation:'envelope',composition:'add',value:-.75,envelope:{attack:.35,hold:.35,release:2.1,unit:'seconds'},retrigger:'restart'}]}
const rules=[cameraBuild,cameraDrop,continuous('sub','audio.bands.sub','audio.bands',160),continuous('bass','audio.bands.bass','audio.bands',120),continuous('mid','audio.bands.mid','audio.bands',150),continuous('high','audio.bands.high','audio.bands',100),continuous('air','audio.bands.air','audio.bands',125),continuous('energy','audio.features.overallEnergy','audio.features',180),continuous('vocal','audio.features.vocalPresence','audio.features',220),continuous('build','director.build','visual-director.significance',200),continuous('impact','director.impact','visual-director.significance',150),event('kick',.03,.025,.24),event('snare',.02,.02,.18),event('downbeat',.055,.05,.38),event('phrase',.15,.1,.8),event('drop',.17,.1,1.23),event('bar',.08,.06,.4),event('section-change',.2,.2,1.1)]
const targetId=(name:string)=>cinema2StableId<Cinema2RenderTargetId>(`arc-angel-${name}-target`)
const passId=(name:string)=>cinema2StableId<Cinema2RenderPassId>(`arc-angel-${name}-pass`)
const slotId=(name:string)=>cinema2StableId<Cinema2RenderSlotId>(`arc-angel-${name}`)
const viewportTarget=(name:string,depth=false)=>({id:targetId(name),descriptor:{size:{kind:'viewport' as const},colorFormat:'rgba16f' as const,fallbackColorFormat:'rgba8' as const,...(depth?{depthFormat:'depth24' as const}:{})},ownership:'transient' as const})
const effectPass=(name:string,after:string,withDepth:boolean,output:boolean)=>({id:passId(name),kind:'fullscreen' as const,dependsOn:[cinema2Ref(passId(after))],effect:cinema2Ref(effectId(name)),inputs:[{id:slotId(`${name}-color-input`),source:{pass:cinema2Ref(passId(after)),output:slotId(`${after}-color`)},attachment:'color' as const},...(withDepth?[{id:slotId(`${name}-depth-input`),source:{pass:cinema2Ref(passId('scene')),output:slotId('scene-depth')},attachment:'depth' as const}]:[])],...(output?{outputs:[{id:slotId(`${name}-color`),target:cinema2Ref(targetId(name)),attachment:'color' as const}]}:{})})
const manifest:Cinema2NativePresetManifest={
 schemaId:CINEMA2_NATIVE_PRESET_SCHEMA_ID,schemaVersion:CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,id:CINEMA2_ARC_ANGEL_PRESET_ID,revision:1,
 metadata:{name:'ARC ANGEL',author:'STAGELESS',category:'Architecture',description:'A suspended ten-armed celestial entity inside a layered bronze armillary, with radial light choreography and atmospheric depth.',tags:['reference','3d','celestial','model','audio-reactive']},
 capabilities:[...(['render.webgl2','render.depth','scene.3d','camera.world','lighting'] as const).map(id=>({id,requirement:'required' as const,purpose:'Native world-space animated sculpture and celestial apparatus.'})),...(['render.hdr','audio.transport','audio.features','audio.bands','music.beat','music.rhythm-events','music.downbeat','music.bar','music.phrase','music.section','music.drop','visual-director.significance'] as const).map(id=>({id,requirement:'optional' as const,purpose:'Shared visual, musical and transport services.'}))],
 parameters,
 modules:[{id:moduleId,typeId:CINEMA2_ARC_ANGEL_MODULE_TYPE_ID,version:1,config:{asset:'cinema2-arc-angel'},parameters:{...Object.fromEntries(Object.entries(bindings).map(([key,ref])=>[key,parameters.find(p=>p.id===ref.$ref)!.defaultValue!])),...Object.fromEntries(['sub','bass','mid','high','air','energy','vocal','build','impact','kick','snare','downbeat','phrase','drop','bar','section'].map(key=>[key,0]))},parameterBindings:bindings}],
 scene:{roots:[cinema2Ref(root)],nodes:[{id:root,kind:'group',coordinateSpace:'world'},{id:node,kind:'module',parent:cinema2Ref(root),module:cinema2Ref(moduleId)}]},
 layers:[{id:layer,label:'Celestial armillary',source:cinema2Ref(root),role:'world',depthPolicy:'read-write',order:0}],
 cameras:[{id:camera,label:'Celestial perspective',projection:'perspective',fovDegrees:ARC_ANGEL_CAMERA.fovDegrees,minAspect:16/9,near:.12,far:65,transform:{position:ARC_ANGEL_CAMERA.position},target:ARC_ANGEL_CAMERA.target,rig:{kind:'static'},motion:{idleMotion:true,tempo:{referenceBpm:120,weave:1.15,bob:.16,fov:.65},drift:{position:.65,target:.025,rollDegrees:0,fovDegrees:1.1,speed:.10,seed:803},fovRateLimitDegreesPerSecond:8},smoothingMs:180,controls:{motionEnabled:bind('camera-motion'),motionAmount:bind('camera-amount'),motionSafety:bind('motion-safety'),tempoSync:bind('bpm-sync')},safety:{minPosition:ARC_ANGEL_CAMERA.minPosition,maxPosition:ARC_ANGEL_CAMERA.maxPosition,maxTargetOffset:[.08,.08,.08],minFovDegrees:ARC_ANGEL_CAMERA.minFovDegrees,maxFovDegrees:ARC_ANGEL_CAMERA.maxFovDegrees}}],
 defaults:{camera:cinema2Ref(camera)},environment:{backgroundColor:ARC_ANGEL_PALETTE.background,exposure:1,controls:{backgroundColor:bind('background')}},
 lighting:{lights:[{id:cinema2StableId<Cinema2LightId>('arc-angel-fill'),type:'ambient',color:[.8,.75,.65,1],intensity:.16},{id:cinema2StableId<Cinema2LightId>('arc-angel-key'),type:'directional',color:[1,.87,.7,1],intensity:.72,transform:{position:[-3,4,5]},targetNode:cinema2Ref(root)},{id:cinema2StableId<Cinema2LightId>('arc-angel-rim'),type:'point',color:[1,.25,.05,1],intensity:.5,transform:{position:[0,2,-2]},config:{range:12}},{id:cinema2StableId<Cinema2LightId>('arc-angel-volumetric'),type:'spot',color:[1,.55,.19,1],intensity:.65,transform:{position:[0,-4,-3]},targetNode:cinema2Ref(root),config:{range:18,coneAngleDegrees:48,penumbra:.7,scatter:true}}]},
 effects:[{id:atmosphere,typeId:CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID,version:1,enabled:true,order:0,scope:'output',parameters:{mix:.25,density:.052,beamIntensity:.32,mistAmount:.22,mistHeight:1.2,mistFloor:-4,floorY:-4,floorReflection:0,anisotropy:.4,occlusion:.78,ambientHaze:.055,noiseScale:.4,noiseStrength:.3,drift:.045,maxDistance:40,reactivity:0},parameterBindings:{mix:bind('atmosphere')}},{id:bloom,typeId:CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,version:1,enabled:true,order:1,scope:'output',parameters:{mix:1,threshold:1.05,knee:.3,intensity:.36,spread:.46,levels:4,clampMax:10},parameterBindings:{intensity:bind('bloom')}},{id:finish,typeId:CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,version:1,enabled:true,order:2,scope:'output',parameters:{mix:.38,exposure:1,contrast:1.16,saturation:1.07,vignette:.24,grain:.035,aberration:0},parameterBindings:{mix:bind('finish')}}],
 choreography:{tempoSyncParameter:bind('bpm-sync'),rules},
 render:{targets:[viewportTarget('scene',true),viewportTarget('atmosphere'),viewportTarget('bloom')],passes:[{id:passId('scene'),kind:'scene',layers:[cinema2Ref(layer)],outputs:[{id:slotId('scene-color'),target:cinema2Ref(targetId('scene')),attachment:'color'},{id:slotId('scene-depth'),target:cinema2Ref(targetId('scene')),attachment:'depth'}]},effectPass('atmosphere','scene',true,true),effectPass('bloom','atmosphere',false,true),effectPass('finish','bloom',false,false)],outputPass:cinema2Ref(passId('finish'))},output:{renderPass:cinema2Ref(passId('finish')),colorSpace:'srgb',alphaMode:'opaque'},
}
const mod=(key:string)=>cinema2AutoTargets.module(moduleId,key)
export const CINEMA2_ARC_ANGEL_PRESET_MANIFEST=withCinema2MoodDrives(manifest,{idPrefix:'arc-angel-auto',enabledParameter:id('auto-performance'),strengthParameter:id('reactivity'),patternControls:{patternChange:id('pattern-change'),trigger:id('trigger')},drives:[
 {id:'spread',target:mod('arm-spread'),source:'mood.build',operation:'multiply',value:1.25},
 {id:'rotation',target:mod('ring-rotation'),source:'mood.momentum',operation:'multiply',value:1.35},
 {id:'bloom',target:cinema2AutoTargets.effect(bloom,'intensity'),source:'mood.peak',operation:'multiply',value:1.45},
 {id:'impact',target:mod('impact-waves'),source:'mood.shock',operation:'multiply',value:1.5},
 {id:'atmosphere',target:cinema2AutoTargets.effect(atmosphere,'mix'),source:'mood.tension',operation:'multiply',value:1.6},
 {id:'light',target:mod('selective-light'),source:'mood.energy',operation:'multiply',value:1.35},
 {id:'rings',target:mod('ring-intensity'),source:'mood.peak',operation:'multiply',value:1.4},
 {id:'trails',target:mod('energy-trails'),source:'mood.activity',operation:'multiply',value:1.3},
 {id:'movement',target:mod('movement'),source:'mood.momentum',operation:'multiply',value:1.25},
 {id:'silence',target:mod('intensity'),source:'mood.silence',operation:'multiply',value:.2},
]})
