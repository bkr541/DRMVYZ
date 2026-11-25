import { CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2NamespacedId, cinema2Ref, cinema2StableId, type Cinema2CameraId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyContinuousSourcePath, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest, type Cinema2DesignParentGroup, type Cinema2EffectId, type Cinema2LayerId, type Cinema2LightId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest, type Cinema2PresetId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId, type Cinema2SceneNodeId } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID } from '../effects/Cinema2VolumetricAtmosphereEffect'
import { createCinema2UserModelParameter } from '../model/Cinema2UserModelBaseEnvironment'
import { CINEMA2_MONUMENT_MODULE_TYPE_ID, MONUMENT_PALETTE, MONUMENT_PATTERNS } from '../modules/monument/MonumentGeometry'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { cinema2AutoTargets } from './Cinema2AutoPerformanceAuthoring'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'

export const CINEMA2_MONUMENT_PRESET_ID=cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.monument')
const id=(name:string)=>cinema2StableId<Cinema2ParameterId>(`monument-${name}`)
const bind=(name:string)=>cinema2Ref(id(name))
const moduleId=cinema2StableId<Cinema2ModuleId>('monument-hall')
const root=cinema2StableId<Cinema2SceneNodeId>('monument-root'), node=cinema2StableId<Cinema2SceneNodeId>('monument-stage')
const layer=cinema2StableId<Cinema2LayerId>('monument-world'), camera=cinema2StableId<Cinema2CameraId>('monument-camera')
const effectId=(name:string)=>cinema2StableId<Cinema2EffectId>(`monument-${name}`)
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
  choice('motion-safety','Motion Safety','master-controls','Playback',5,'reduced',[{value:'full',label:'Full Motion'},{value:'reduced',label:'Reduced Motion'},{value:'lockoff',label:'Lock Off'}],'Bounds or freezes hero and camera motion.'),
  choice('pattern','Pattern','design','Pattern',1,'reveal',MONUMENT_PATTERNS,'Select an authored architectural lighting program.'),
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
  slider('hero-motion','Hero Motion','design','Hero',10,.2,0,1,'Small bounded lean with floor-safe grounding.'),
  slider('hero-emission','Hero Emission','design','Hero',11,.2,0,1,'Hero-local rim lighting and emission.'),
  choice('content-type','Content Type','design','Hero Source',1,'text',[{value:'model',label:'Imported Model'},{value:'text',label:'Typed Text'}],'Switch hero sources without changing either saved input.'),
  ...['text','line-2','line-3'].map((key,i):Cinema2ParameterManifest=>({...base(key,i===0?'Text':`Line ${i+1}`,'design','Typography',i+1,'Editable extruded typography; 80 characters total, up to three lines.'),type:'string',defaultValue:i===0?'STAGELESS':'',modulatable:false,choreographable:false,visibleWhen:[{kind:'parameter-equals',parameterId:id('content-type'),value:'text'}]})),
  {...choice('font','Font','design','Typography',4,'anton',[{value:'anton',label:'Anton'},{value:'stageless',label:'STAGELESS Sans Bold'}],'Select local glyph outlines.'),visibleWhen:[{kind:'parameter-equals',parameterId:id('content-type'),value:'text'}]},
  ...[
    slider('text-depth','Text Depth','design','Typography',5,.12,.02,.30,'Actual glyph extrusion.',true),
    slider('bevel','Bevel','design','Typography',6,.015,0,.05,'Physical glyph edge bevel, safely clamped.',true,.005),
    slider('letter-spacing','Letter Spacing','design','Typography',7,.025,-.05,.20,'Glyph advance spacing in em.',true,.005),
    slider('line-spacing','Line Spacing','design','Typography',8,1.1,.8,1.5,'Baseline spacing between lines.',true),
    choice('alignment','Alignment','design','Typography',9,'center',[{value:'left',label:'Left'},{value:'center',label:'Center'},{value:'right',label:'Right'}],'Align the lines within the text block.'),
  ].map((parameter):Cinema2ParameterManifest=>({...parameter,visibleWhen:[{kind:'parameter-equals',parameterId:id('content-type'),value:'text'}]})),
  slider('pedestal-height','Pedestal Height','design','Architecture',1,.12,.05,.30,'Height of the stepped podium and grounded hero.',true),
  slider('hall-depth','Hall Depth','design','Architecture',2,1,.75,1.75,'Spacing of receding buttresses.',true),
  slider('trace-speed','Trace Speed','design','Lighting',1,1,.25,2,'Rate of actual raking light and relay sweeps.'),
  slider('reveal-extent','Reveal Extent','design','Lighting',2,.65,0,1,'Spread and intensity of the hero spotlight.'),
  slider('contour-strength','Contour Strength','design','Lighting',3,.4,0,1,'Physical rim illumination.'),
  slider('floor-relay','Floor Relay','design','Lighting',4,.45,0,1,'Recessed channel illumination.'),
  slider('bloom','Bloom','effects','Finish',1,.25,0,1,'HDR localized emission halo.'),
  slider('atmosphere','Atmosphere','effects','Finish',2,.1,0,1,'Depth-aware atmospheric mix.'),
  slider('reflection','Reflection Strength','effects','Lighting',1,.25,0,1,'PBR environment reflection.'),
  slider('shadow','Shadow Strength','effects','Lighting',2,.55,0,1,'Contrast of real shadow-casting spot.'),
  slider('spill','Light Spill','effects','Lighting',3,.3,0,1,'Localized colored point illumination.'),
  slider('finish','Cinematic Finish','effects','Finish',3,.2,0,1,'Cinematic grading mix.'),
  ...Object.entries({background:'Background',structural:'Structural',primary:'Primary Energy',secondary:'Secondary Energy',accent:'Accent','text-face':'Text Face','text-side':'Text Side'}).map(([key,label],i):Cinema2ParameterManifest=>({...base(key,label,'palette','Colors',i+1,`Independent ${label.toLowerCase()} color.`),type:'color',defaultValue:MONUMENT_PALETTE[key as keyof typeof MONUMENT_PALETTE],...(key.startsWith('text-')?{visibleWhen:[{kind:'parameter-equals' as const,parameterId:id('content-type'),value:'text'}]}:{})})),
]
const moduleKeys=['auto-performance','bpm-sync','intensity','reactivity','motion-safety','pattern','pattern-change','trigger','model-visible','model-scale','model-x','model-y','model-z','model-yaw','model-pitch','model-roll','material-mode','hero-motion','hero-emission','content-type','text','line-2','line-3','font','text-depth','bevel','letter-spacing','line-spacing','alignment','pedestal-height','hall-depth','trace-speed','reveal-extent','contour-strength','floor-relay','reflection','spill','structural','primary','secondary','accent','text-face','text-side']
const bindings={...Object.fromEntries(moduleKeys.map(key=>[key,bind(key)])),userModel:bind('model')}
const continuous=(name:string,path:Cinema2ChoreographyContinuousSourcePath,capability:'audio.features'|'audio.bands'|'visual-director.significance',smoothingMs:number):Cinema2ChoreographyRuleManifest=>({id:cinema2StableId<Cinema2ChoreographyRuleId>(`monument-${name}-rule`),priority:12,strengthParameter:bind('reactivity'),source:{signal:'continuous',path,capability,clamp:[0,1],smoothingMs},conditions:[{kind:'not-silent'}],actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`monument-${name}-read`),target:{kind:'module',ref:cinema2Ref(moduleId),property:name},operation:'replace',value:1}]})
const event=(name:'kick'|'snare'|'downbeat'|'drop'|'phrase',attack:number,hold:number,release:number):Cinema2ChoreographyRuleManifest=>({id:cinema2StableId<Cinema2ChoreographyRuleId>(`monument-${name}-rule`),priority:30,strengthParameter:bind('reactivity'),source:{signal:name,capability:name==='drop'?'music.drop':name==='phrase'?'music.phrase':name==='downbeat'?'music.downbeat':'music.rhythm-events'},conditions:[{kind:'once-per-event'},...(name==='drop'?[]:[{kind:'not-silent' as const}])],actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`monument-${name}-pulse`),target:{kind:'module',ref:cinema2Ref(moduleId),property:name},operation:'envelope',composition:'replace',value:1,envelope:{attack,hold,release,unit:'seconds'},retrigger:'restart'}]})
const rules=[continuous('sub','audio.bands.sub','audio.bands',160),continuous('bass','audio.bands.bass','audio.bands',120),continuous('mid','audio.bands.mid','audio.bands',150),continuous('high','audio.bands.high','audio.bands',100),continuous('air','audio.bands.air','audio.bands',125),continuous('energy','audio.features.overallEnergy','audio.features',180),continuous('vocal','audio.features.vocalPresence','audio.features',220),continuous('build','director.build','visual-director.significance',200),continuous('impact','director.impact','visual-director.significance',150),event('kick',.03,.025,.24),event('snare',.02,.02,.18),event('downbeat',.055,.05,.38),event('phrase',.15,.1,.8),event('drop',.17,.1,1.23)]
const targetId=(name:string)=>cinema2StableId<Cinema2RenderTargetId>(`monument-${name}-target`)
const passId=(name:string)=>cinema2StableId<Cinema2RenderPassId>(`monument-${name}-pass`)
const slotId=(name:string)=>cinema2StableId<Cinema2RenderSlotId>(`monument-${name}`)
const viewportTarget=(name:string,depth=false)=>({id:targetId(name),descriptor:{size:{kind:'viewport' as const},colorFormat:'rgba16f' as const,fallbackColorFormat:'rgba8' as const,...(depth?{depthFormat:'depth24' as const}:{})},ownership:'transient' as const})
const effectPass=(name:string,after:string,withDepth:boolean,output:boolean)=>({id:passId(name),kind:'fullscreen' as const,dependsOn:[cinema2Ref(passId(after))],effect:cinema2Ref(effectId(name)),inputs:[{id:slotId(`${name}-color-input`),source:{pass:cinema2Ref(passId(after)),output:slotId(`${after}-color`)},attachment:'color' as const},...(withDepth?[{id:slotId(`${name}-depth-input`),source:{pass:cinema2Ref(passId('scene')),output:slotId('scene-depth')},attachment:'depth' as const}]:[])],...(output?{outputs:[{id:slotId(`${name}-color`),target:cinema2Ref(targetId(name)),attachment:'color' as const}]}:{})})
const manifest:Cinema2NativePresetManifest={
 schemaId:CINEMA2_NATIVE_PRESET_SCHEMA_ID,schemaVersion:CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,id:CINEMA2_MONUMENT_PRESET_ID,revision:1,
 metadata:{name:'MONUMENT',author:'STAGELESS',category:'Architecture',description:'Colossal extruded typography or a private 3D model becomes the centerpiece of a brutalist exhibition hall.',tags:['reference','3d','typography','model','audio-reactive']},
 capabilities:[...(['render.webgl2','render.depth','scene.3d','camera.world','lighting'] as const).map(id=>({id,requirement:'required' as const,purpose:'Native world-space monumental architecture and shadow lighting.'})),...(['render.hdr','audio.transport','audio.features','audio.bands','music.beat','music.rhythm-events','music.downbeat','music.bar','music.phrase','music.section','music.drop','visual-director.significance'] as const).map(id=>({id,requirement:'optional' as const,purpose:'Shared visual, musical and transport services.'}))],
 parameters,
 modules:[{id:moduleId,typeId:CINEMA2_MONUMENT_MODULE_TYPE_ID,version:1,config:{userModel:{node:null,neutralFloor:false,spin:false}},parameters:{...Object.fromEntries(Object.entries(bindings).map(([key,ref])=>[key,parameters.find(p=>p.id===ref.$ref)!.defaultValue!])),...Object.fromEntries(['sub','bass','mid','high','air','energy','vocal','build','impact','kick','snare','downbeat','phrase','drop'].map(key=>[key,0]))},parameterBindings:bindings}],
 scene:{roots:[cinema2Ref(root)],nodes:[{id:root,kind:'group',coordinateSpace:'world'},{id:node,kind:'module',parent:cinema2Ref(root),module:cinema2Ref(moduleId)}]},
 layers:[{id:layer,label:'Monumental exhibition hall',source:cinema2Ref(root),role:'world',depthPolicy:'read-write',order:0}],
 cameras:[{id:camera,label:'Monument hero',projection:'perspective',fovDegrees:38,minAspect:16/9,near:.12,far:65,transform:{position:[.25,-1.25,9.4]},target:[0,-.55,0],rig:{kind:'static'},motion:{idleMotion:true,tempo:{referenceBpm:120,weave:.035,bob:.025},drift:{position:.7,target:.035,rollDegrees:0,fovDegrees:.3,speed:.10,seed:803}},controls:{motionEnabled:bind('camera-motion'),motionAmount:bind('camera-amount'),motionSafety:bind('motion-safety'),tempoSync:bind('bpm-sync')},safety:{minPosition:[-.8,-1.6,9.1],maxPosition:[1.0,-.8,10.0],maxTargetOffset:[.08,.08,.08],minFovDegrees:37,maxFovDegrees:39}}],
 defaults:{camera:cinema2Ref(camera)},environment:{backgroundColor:MONUMENT_PALETTE.background,exposure:1,controls:{backgroundColor:bind('background')}},
 lighting:{lights:[{id:cinema2StableId<Cinema2LightId>('monument-fill'),type:'ambient',color:[.65,.75,.9,1],intensity:.22},{id:cinema2StableId<Cinema2LightId>('monument-key'),type:'spot',color:[.85,.93,1,1],intensity:.55,controls:{intensity:bind('shadow')},transform:{position:[-3,5,5]},targetNode:cinema2Ref(root),config:{range:30,coneAngleDegrees:70,penumbra:.65,threeShadow:true,scatter:false}},{id:cinema2StableId<Cinema2LightId>('monument-rim'),type:'point',color:[.35,.8,1,1],intensity:.24,transform:{position:[3,2,-2]},config:{range:15}}]},
 effects:[{id:atmosphere,typeId:CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID,version:1,enabled:true,order:0,scope:'output',parameters:{mix:.1,density:.025,beamIntensity:.08,mistAmount:.06,mistHeight:.5,mistFloor:-2.53,floorY:-2.53,floorReflection:0,anisotropy:.35,occlusion:.82,ambientHaze:.02,noiseScale:.3,noiseStrength:.12,drift:.025,maxDistance:40,reactivity:0},parameterBindings:{mix:bind('atmosphere')}},{id:bloom,typeId:CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,version:1,enabled:true,order:1,scope:'output',parameters:{mix:1,threshold:1.25,knee:.3,intensity:.25,spread:.33,levels:4,clampMax:10},parameterBindings:{intensity:bind('bloom')}},{id:finish,typeId:CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,version:1,enabled:true,order:2,scope:'output',parameters:{mix:.2,exposure:1,contrast:1.1,saturation:1.03,vignette:.12,grain:0,aberration:0},parameterBindings:{mix:bind('finish')}}],
 choreography:{tempoSyncParameter:bind('bpm-sync'),rules},
 render:{targets:[viewportTarget('scene',true),viewportTarget('atmosphere'),viewportTarget('bloom')],passes:[{id:passId('scene'),kind:'scene',layers:[cinema2Ref(layer)],outputs:[{id:slotId('scene-color'),target:cinema2Ref(targetId('scene')),attachment:'color'},{id:slotId('scene-depth'),target:cinema2Ref(targetId('scene')),attachment:'depth'}]},effectPass('atmosphere','scene',true,true),effectPass('bloom','atmosphere',false,true),effectPass('finish','bloom',false,false)],outputPass:cinema2Ref(passId('finish'))},output:{renderPass:cinema2Ref(passId('finish')),colorSpace:'srgb',alphaMode:'opaque'},
}
const mod=(key:string)=>cinema2AutoTargets.module(moduleId,key)
export const CINEMA2_MONUMENT_PRESET_MANIFEST=withCinema2MoodDrives(manifest,{idPrefix:'monument-auto',enabledParameter:id('auto-performance'),strengthParameter:id('reactivity'),patternControls:{patternChange:id('pattern-change'),trigger:id('trigger')},drives:[
 {id:'reveal',target:mod('reveal-extent'),source:'mood.brightness',operation:'add',value:.15},
 {id:'floor',target:mod('floor-relay'),source:'mood.energy',operation:'add',value:.20},
 {id:'trace',target:mod('trace-speed'),source:'mood.momentum',operation:'multiply',value:1.30},
 {id:'contour',target:mod('contour-strength'),source:'mood.shock',operation:'add',value:.15},
 {id:'bloom',target:cinema2AutoTargets.effect(bloom,'intensity'),source:'mood.peak',operation:'add',value:.08},
 {id:'atmosphere',target:cinema2AutoTargets.effect(atmosphere,'mix'),source:'mood.tension',operation:'add',value:.08},
 {id:'silence',target:mod('intensity'),source:'mood.silence',operation:'add',value:-.35},
]})
