import { CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2NamespacedId, cinema2Ref, cinema2StableId, type Cinema2CameraId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyContinuousSourcePath, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest, type Cinema2DesignParentGroup, type Cinema2EffectId, type Cinema2LayerId, type Cinema2LightId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest, type Cinema2PresetId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId, type Cinema2SceneNodeId } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID } from '../effects/Cinema2VolumetricAtmosphereEffect'
import { createCinema2UserModelParameter } from '../model/Cinema2UserModelBaseEnvironment'
import { CINEMA2_EXOSKELETON_MODULE_TYPE_ID, EXOSKELETON_PALETTE, EXOSKELETON_PATTERNS } from '../modules/exoskeleton/ExoskeletonGeometry'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { cinema2AutoTargets } from './Cinema2AutoPerformanceAuthoring'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'

export const CINEMA2_EXOSKELETON_PRESET_ID=cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.exoskeleton')
const id=(name:string)=>cinema2StableId<Cinema2ParameterId>(`exoskeleton-${name}`)
const bind=(name:string)=>cinema2Ref(id(name))
const moduleId=cinema2StableId<Cinema2ModuleId>('exoskeleton-machine')
const root=cinema2StableId<Cinema2SceneNodeId>('exoskeleton-root'), node=cinema2StableId<Cinema2SceneNodeId>('exoskeleton-bay')
const layer=cinema2StableId<Cinema2LayerId>('exoskeleton-world'), camera=cinema2StableId<Cinema2CameraId>('exoskeleton-camera')
const effectId=(name:string)=>cinema2StableId<Cinema2EffectId>(`exoskeleton-${name}`)
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
  choice('motion-safety','Motion Safety','master-controls','Playback',5,'reduced',[{value:'full',label:'Full Motion'},{value:'reduced',label:'Reduced Motion'},{value:'lockoff',label:'Lock Off'}],'Bounds or freezes mechanical and camera motion.'),
  choice('pattern','Pattern','design','Pattern',1,'armor',EXOSKELETON_PATTERNS,'Select an authored mechanical program.'),
  toggle('pattern-change','Pattern Change','design','Pattern',2,false,'Advance on a fresh shared musical event.'),
  {...choice('trigger','Trigger','design','Pattern',3,'bar4',CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,'Select the event that advances patterns.'),visibleWhen:[{kind:'parameter-equals',parameterId:id('pattern-change'),value:true}]},
  toggle('camera-motion','Camera Motion','design','Camera',1,true,'Authorize bounded perspective drift.'),
  slider('camera-amount','Camera Amount','design','Camera',2,.25,0,1,'Amplitude of camera drift.'),
  {...createCinema2UserModelParameter(id('model')),exposure:'hidden'},
  toggle('model-visible','Model Visible','design','Hero',1,true,'Hard visibility permission for the hero.'),
  slider('model-scale','Model Scale','design','Hero',2,1,.5,1.2,'Uniform scale relative to the safe fit.',true),
  ...(['x','y','z'] as const).map((axis,i)=>slider(`model-${axis}`,`Model ${axis.toUpperCase()}`,'design','Hero',3+i,0,-.2,.2,'Offset as fraction of the safe hero volume.',true)),
  slider('model-yaw','Model Yaw','design','Hero',6,0,-180,180,'Authored yaw in degrees.',true,1),
  slider('model-pitch','Model Pitch','design','Hero',7,0,-25,25,'Authored pitch in degrees.',true,1),
  slider('model-roll','Model Roll','design','Hero',8,0,-20,20,'Authored roll in degrees.',true,1),
  choice('material-mode','Material Mode','design','Hero',9,'original',[{value:'original',label:'Original'},{value:'brushed',label:'Brushed Metal'},{value:'edge',label:'Emissive Edge'}],'Preserve textures or apply instance-local metal/emission treatment.'),
  slider('hero-motion','Hero Motion','design','Hero',10,.2,0,1,'Small bounded float and lean.'),
  slider('hero-emission','Hero Emission','design','Hero',11,.2,0,1,'Hero-local rim lighting and emission.'),
  choice('plate-count','Plate Count','design','Armor',1,'18',[12,18,24].map(n=>({value:String(n),label:String(n)})),'Number of independent armor plates.'),
  slider('shell-clearance','Shell Clearance','design','Armor',2,.20,.12,.40,'Fit-relative clearance outside the transformed model.',true),
  slider('plate-opening','Plate Opening','design','Armor',3,.55,0,1,'Hinge opening up to 65 degrees.'),
  slider('deployment-travel','Deployment Travel','design','Armor',4,.45,0,1,'Outward rail translation.'),
  slider('plate-thickness','Plate Thickness','design','Armor',5,.05,.02,.12,'Physical extrusion in fit units.',true),
  slider('seam-gap','Seam Gap','design','Armor',6,.035,.01,.10,'Spacing between neighboring plates.',true),
  slider('motion-rate','Motion Rate','design','Armor',7,1,.25,2,'Rate of hinge cycles.'),
  slider('front-aperture','Front Aperture','design','Armor',8,.72,.50,1,'Open viewing region, with the front bank omitted.',true),
  slider('interior-emission','Interior Emission','design','Energy',1,.55,0,1,'Emission of inner seams and housing lights.'),
  slider('relay-rate','Relay Rate','design','Energy',2,1,.25,2,'Rate of light packet routing.'),
  slider('bloom','Bloom','effects','Finish',1,.25,0,1,'HDR localized emission halo.'),
  slider('atmosphere','Atmosphere','effects','Finish',2,.1,0,1,'Depth-aware atmospheric mix.'),
  slider('reflection','Reflection Strength','effects','Lighting',1,.25,0,1,'PBR environment reflection.'),
  slider('shadow','Shadow Strength','effects','Lighting',2,.55,0,1,'Contrast of real shadow-casting spot.'),
  slider('spill','Light Spill','effects','Lighting',3,.3,0,1,'Localized colored point illumination.'),
  slider('finish','Cinematic Finish','effects','Finish',3,.2,0,1,'Cinematic grading mix.'),
  ...Object.entries({background:'Background',structural:'Structural',primary:'Primary Energy',secondary:'Secondary Energy',accent:'Accent'}).map(([key,label],i):Cinema2ParameterManifest=>({...base(key,label,'palette','Colors',i+1,`Independent ${label.toLowerCase()} color.`),type:'color',defaultValue:EXOSKELETON_PALETTE[key as keyof typeof EXOSKELETON_PALETTE]})),
]
const moduleKeys=['auto-performance','bpm-sync','intensity','reactivity','motion-safety','pattern','pattern-change','trigger','model-visible','model-scale','model-x','model-y','model-z','model-yaw','model-pitch','model-roll','material-mode','hero-motion','hero-emission','plate-count','shell-clearance','plate-opening','deployment-travel','plate-thickness','seam-gap','motion-rate','front-aperture','interior-emission','relay-rate','reflection','spill','structural','primary','secondary','accent']
const bindings={...Object.fromEntries(moduleKeys.map(key=>[key,bind(key)])),userModel:bind('model')}
const continuous=(name:string,path:Cinema2ChoreographyContinuousSourcePath,capability:'audio.features'|'audio.bands'|'visual-director.significance',smoothingMs:number):Cinema2ChoreographyRuleManifest=>({id:cinema2StableId<Cinema2ChoreographyRuleId>(`exoskeleton-${name}-rule`),priority:12,strengthParameter:bind('reactivity'),source:{signal:'continuous',path,capability,clamp:[0,1],smoothingMs},conditions:[{kind:'not-silent'}],actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`exoskeleton-${name}-read`),target:{kind:'module',ref:cinema2Ref(moduleId),property:name},operation:'replace',value:1}]})
const event=(name:'kick'|'snare'|'downbeat'|'drop'|'phrase',attack:number,hold:number,release:number):Cinema2ChoreographyRuleManifest=>({id:cinema2StableId<Cinema2ChoreographyRuleId>(`exoskeleton-${name}-rule`),priority:30,strengthParameter:bind('reactivity'),source:{signal:name,capability:name==='drop'?'music.drop':name==='phrase'?'music.phrase':name==='downbeat'?'music.downbeat':'music.rhythm-events'},conditions:[{kind:'once-per-event'},...(name==='drop'?[]:[{kind:'not-silent' as const}])],actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`exoskeleton-${name}-pulse`),target:{kind:'module',ref:cinema2Ref(moduleId),property:name},operation:'envelope',composition:'replace',value:1,envelope:{attack,hold,release,unit:'seconds'},retrigger:'restart'}]})
const rules=[continuous('sub','audio.bands.sub','audio.bands',160),continuous('bass','audio.bands.bass','audio.bands',120),continuous('mid','audio.bands.mid','audio.bands',150),continuous('high','audio.bands.high','audio.bands',100),continuous('air','audio.bands.air','audio.bands',125),continuous('energy','audio.features.overallEnergy','audio.features',180),continuous('vocal','audio.features.vocalPresence','audio.features',220),continuous('build','director.build','visual-director.significance',200),continuous('impact','director.impact','visual-director.significance',150),event('kick',.03,.025,.24),event('snare',.02,.02,.18),event('downbeat',.055,.05,.38),event('phrase',.15,.1,.8),event('drop',.17,.1,1.23)]
const targetId=(name:string)=>cinema2StableId<Cinema2RenderTargetId>(`exoskeleton-${name}-target`)
const passId=(name:string)=>cinema2StableId<Cinema2RenderPassId>(`exoskeleton-${name}-pass`)
const slotId=(name:string)=>cinema2StableId<Cinema2RenderSlotId>(`exoskeleton-${name}`)
const viewportTarget=(name:string,depth=false)=>({id:targetId(name),descriptor:{size:{kind:'viewport' as const},colorFormat:'rgba16f' as const,fallbackColorFormat:'rgba8' as const,...(depth?{depthFormat:'depth24' as const}:{})},ownership:'transient' as const})
const effectPass=(name:string,after:string,withDepth:boolean,output:boolean)=>({id:passId(name),kind:'fullscreen' as const,dependsOn:[cinema2Ref(passId(after))],effect:cinema2Ref(effectId(name)),inputs:[{id:slotId(`${name}-color-input`),source:{pass:cinema2Ref(passId(after)),output:slotId(`${after}-color`)},attachment:'color' as const},...(withDepth?[{id:slotId(`${name}-depth-input`),source:{pass:cinema2Ref(passId('scene')),output:slotId('scene-depth')},attachment:'depth' as const}]:[])],...(output?{outputs:[{id:slotId(`${name}-color`),target:cinema2Ref(targetId(name)),attachment:'color' as const}]}:{})})
const manifest:Cinema2NativePresetManifest={
 schemaId:CINEMA2_NATIVE_PRESET_SCHEMA_ID,schemaVersion:CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,id:CINEMA2_EXOSKELETON_PRESET_ID,revision:1,
 metadata:{name:'EXOSKELETON',author:'STAGELESS',category:'Architecture',description:'Adaptive hinged armor surrounds a private 3D model inside a vertical service chamber.',tags:['reference','3d','mechanical','model','audio-reactive']},
 capabilities:[...(['render.webgl2','render.depth','scene.3d','camera.world','lighting'] as const).map(id=>({id,requirement:'required' as const,purpose:'Native world-space mechanical scene and shadow lighting.'})),...(['render.hdr','audio.transport','audio.features','audio.bands','music.beat','music.rhythm-events','music.downbeat','music.bar','music.phrase','music.section','music.drop','visual-director.significance'] as const).map(id=>({id,requirement:'optional' as const,purpose:'Shared visual, musical and transport services.'}))],
 parameters,
 modules:[{id:moduleId,typeId:CINEMA2_EXOSKELETON_MODULE_TYPE_ID,version:1,config:{userModel:{node:null,neutralFloor:false,spin:false}},parameters:{...Object.fromEntries(Object.entries(bindings).map(([key,ref])=>[key,parameters.find(p=>p.id===ref.$ref)!.defaultValue!])),...Object.fromEntries(['sub','bass','mid','high','air','energy','vocal','build','impact','kick','snare','downbeat','phrase','drop'].map(key=>[key,0]))},parameterBindings:bindings}],
 scene:{roots:[cinema2Ref(root)],nodes:[{id:root,kind:'group',coordinateSpace:'world'},{id:node,kind:'module',parent:cinema2Ref(root),module:cinema2Ref(moduleId)}]},
 layers:[{id:layer,label:'Segmented armor chamber',source:cinema2Ref(root),role:'world',depthPolicy:'read-write',order:0}],
 cameras:[{id:camera,label:'Armor chamber',projection:'perspective',fovDegrees:42,minAspect:16/9,near:.12,far:65,transform:{position:[.7,.85,10.8]},target:[0,0,0],rig:{kind:'static'},motion:{idleMotion:true,tempo:{referenceBpm:120,weave:.035,bob:.025},drift:{position:.7,target:.035,rollDegrees:0,fovDegrees:.3,speed:.10,seed:803}},controls:{motionEnabled:bind('camera-motion'),motionAmount:bind('camera-amount'),motionSafety:bind('motion-safety'),tempoSync:bind('bpm-sync')},safety:{minPosition:[-.8,.1,10.0],maxPosition:[1.5,1.5,11.6],maxTargetOffset:[.08,.08,.08],minFovDegrees:41,maxFovDegrees:43}}],
 defaults:{camera:cinema2Ref(camera)},environment:{backgroundColor:EXOSKELETON_PALETTE.background,exposure:1,controls:{backgroundColor:bind('background')}},
 lighting:{lights:[{id:cinema2StableId<Cinema2LightId>('exoskeleton-fill'),type:'ambient',color:[.65,.75,.9,1],intensity:.16},{id:cinema2StableId<Cinema2LightId>('exoskeleton-key'),type:'spot',color:[.85,.93,1,1],intensity:.55,controls:{intensity:bind('shadow')},transform:{position:[-4,5,5]},targetNode:cinema2Ref(root),config:{range:30,coneAngleDegrees:70,penumbra:.65,threeShadow:true,scatter:false}},{id:cinema2StableId<Cinema2LightId>('exoskeleton-rim'),type:'point',color:[.35,.8,1,1],intensity:.24,transform:{position:[3,2,-2]},config:{range:15}}]},
 effects:[{id:atmosphere,typeId:CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID,version:1,enabled:true,order:0,scope:'output',parameters:{mix:.1,density:.025,beamIntensity:.08,mistAmount:.06,mistHeight:.5,mistFloor:-4.05,floorY:-4.05,floorReflection:0,anisotropy:.35,occlusion:.82,ambientHaze:.02,noiseScale:.3,noiseStrength:.12,drift:.025,maxDistance:40,reactivity:0},parameterBindings:{mix:bind('atmosphere')}},{id:bloom,typeId:CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,version:1,enabled:true,order:1,scope:'output',parameters:{mix:1,threshold:1.25,knee:.3,intensity:.25,spread:.33,levels:4,clampMax:10},parameterBindings:{intensity:bind('bloom')}},{id:finish,typeId:CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,version:1,enabled:true,order:2,scope:'output',parameters:{mix:.2,exposure:1,contrast:1.1,saturation:1.03,vignette:.12,grain:0,aberration:0},parameterBindings:{mix:bind('finish')}}],
 choreography:{tempoSyncParameter:bind('bpm-sync'),rules},
 render:{targets:[viewportTarget('scene',true),viewportTarget('atmosphere'),viewportTarget('bloom')],passes:[{id:passId('scene'),kind:'scene',layers:[cinema2Ref(layer)],outputs:[{id:slotId('scene-color'),target:cinema2Ref(targetId('scene')),attachment:'color'},{id:slotId('scene-depth'),target:cinema2Ref(targetId('scene')),attachment:'depth'}]},effectPass('atmosphere','scene',true,true),effectPass('bloom','atmosphere',false,true),effectPass('finish','bloom',false,false)],outputPass:cinema2Ref(passId('finish'))},output:{renderPass:cinema2Ref(passId('finish')),colorSpace:'srgb',alphaMode:'opaque'},
}
const mod=(key:string)=>cinema2AutoTargets.module(moduleId,key)
export const CINEMA2_EXOSKELETON_PRESET_MANIFEST=withCinema2MoodDrives(manifest,{idPrefix:'exoskeleton-auto',enabledParameter:id('auto-performance'),strengthParameter:id('reactivity'),patternControls:{patternChange:id('pattern-change'),trigger:id('trigger')},drives:[
 {id:'opening',target:mod('plate-opening'),source:'mood.energy',operation:'add',value:.15},
 {id:'deployment',target:mod('deployment-travel'),source:'mood.shock',operation:'add',value:.20},
 {id:'motion-rate',target:mod('motion-rate'),source:'mood.momentum',operation:'multiply',value:1.30},
 {id:'interior',target:mod('interior-emission'),source:'mood.build',operation:'add',value:.15},
 {id:'bloom',target:cinema2AutoTargets.effect(bloom,'intensity'),source:'mood.peak',operation:'multiply',value:1.4},
 {id:'spill',target:mod('spill'),source:'mood.brightness',operation:'multiply',value:1.4},
 {id:'silence',target:mod('intensity'),source:'mood.silence',operation:'add',value:-.35},
]})
