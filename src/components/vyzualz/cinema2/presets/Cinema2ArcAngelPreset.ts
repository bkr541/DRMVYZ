import { CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2NamespacedId, cinema2Ref, cinema2StableId, type Cinema2CameraId, type Cinema2CameraRigManifest, type Cinema2Vector3, type Cinema2ChoreographyActionId, type Cinema2ChoreographyContinuousSourcePath, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest, type Cinema2DesignParentGroup, type Cinema2EffectId, type Cinema2LayerId, type Cinema2LightId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest, type Cinema2PresetId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId, type Cinema2SceneNodeId } from '../contracts/Cinema2NativePresetManifest'
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
  choice('motion-safety','Motion Safety','master-controls','Playback',5,'full',[{value:'full',label:'Full Motion'},{value:'reduced',label:'Reduced Motion'},{value:'lockoff',label:'Lock Off'}],'Bounds character and camera motion.'),
  choice('pattern','Pattern','design','Pattern',1,'awakening',ARC_ANGEL_PATTERNS,'Choose a celestial performance program.'),
  toggle('pattern-change','Pattern Change','design','Pattern',2,false,'Advance on a fresh shared musical event.'),
  {...choice('trigger','Trigger','design','Pattern',3,'bar4',CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,'Select the shared event that advances patterns.'),visibleWhen:[{kind:'parameter-equals',parameterId:id('pattern-change'),value:true}]},
  choice('camera-mode','Camera Mode','design','Camera',0,'celestial-orbit',[{value:'celestial-orbit',label:'Celestial Orbit'},{value:'divine-approach',label:'Divine Approach'},{value:'ascension',label:'Ascension'},{value:'cathedral-flythrough',label:'Cathedral Flythrough'},{value:'cinematic-impact',label:'Cinematic Impact'},{value:'manual',label:'Fixed Perspective'}],'Choose an authored camera route.'),
  slider('camera-speed','Camera Speed','design','Camera',3,1,0,2,'Speed of shared camera travel.',true),
  toggle('camera-motion','Camera Motion','design','Camera',1,true,'Authorize orbital drift and musical push/release.'),
  slider('camera-amount','Camera Amount','design','Camera',2,.9,0,1,'Controls the shared camera motion gain.'),
  toggle('model-visible','Model Visible','design','Angel',1,true,'Visibility permission for the supplied animated Angel.'),
  slider('model-scale','Model Scale','design','Angel',2,1,.65,1.12,'Uniform scale within the authored framing envelope.',true),
  slider('movement','Movement Intensity','design','Angel',3,.95,0,1,'Controls character articulation and apparatus motion.'),
  slider('animation-rate','Animation Rate','design','Angel',4,1,.25,2,'Speed of the beat-synchronized authored performance.'),
  slider('arm-spread','Arm Spread','design','Angel',5,.75,0,1,'Independent arm animation phase separation.'),
  slider('animation-blend','Animation Blending','design','Angel',6,.95,0,1,'Excursion from the central expanded pose into authored clip segments.'),
  slider('levitation','Levitation','design','Angel',7,.65,0,1,'Vertical float amplitude.'),
  slider('articulation','Articulation','design','Angel',8,.9,0,1,'Range of authored skeletal poses.'),
  slider('secondary-motion','Secondary Motion','design','Angel',9,.65,0,1,'Subtle stagger and follow-through in the arms.'),
  slider('halo-scale','Halo Scale','design','Halo',1,1,.6,1.4,'Scale of the supplied red halo.'),
  slider('halo-rotation','Halo Rotation','design','Halo',2,.35,0,1,'Oscillation of the supplied halo.'),
  slider('ring-rotation','Ring Rotation','design','Celestial Apparatus',1,.65,0,1,'Angular travel of the seven armillary rings.'),
  slider('ring-intensity','Ring Intensity','design','Celestial Apparatus',2,.8,0,1,'Intensity of independently addressable ring segments.'),
  slider('environment-density','Environment Density','design','Celestial Apparatus',3,.88,0,1,'Number of visible ring layers and apparatus visibility.'),
  slider('spatial-depth','Spatial Depth','design','Celestial Apparatus',4,1,.6,1.5,'Separation of the three-dimensional ring layers.'),
  slider('platform-movement','Reactor Movement','design','Celestial Apparatus',5,.6,0,1,'Rotation of the overhead reactor.'),
  slider('crown-reactor','Crown Reactor','design','Celestial Apparatus',6,.8,0,1,'Overhead aperture and illumination.'),
  slider('fragment-formation','Celestial Fragments','design','Celestial Apparatus',7,.7,0,1,'Floating fragment visibility and light.'),
  slider('pillar-lighting','Pillar Lighting','effects','Lighting',4,.85,0,1,'Segmented architectural light choreography.'),
  slider('platform-lighting','Platform Lighting','effects','Lighting',5,.8,0,1,'Radial floor lighting.'),
  slider('fixture-lighting','Fixture Lighting','effects','Lighting',6,.8,0,1,'Moving spotlight intensity.'),
  slider('fixture-movement','Fixture Movement','effects','Lighting',7,.7,0,1,'Beam aiming travel.'),
  slider('beam-width','Beam Width','effects','Lighting',8,.55,0,1,'Spotlight cone width.'),
  slider('divine-conduits','Divine Conduits','effects','Energy',4,.65,0,1,'Wrist-to-architecture energy transfer.'),
  slider('bloom','Bloom','effects','Finish',1,.36,0,1,'HDR localized emission halo.'),
  slider('atmosphere','Atmospheric Fog','effects','Finish',2,.45,0,1,'Depth-aware mist and volumetric beams.'),
  slider('finish','Cinematic Finish','effects','Finish',3,.38,0,1,'Cinematic grading mix.'),
  slider('reflection','Reflection Strength','effects','Lighting',1,.26,0,1,'PBR environment reflection.'),
  slider('selective-light','Selective Illumination','effects','Lighting',2,.7,0,1,'Localized animated light on bronze and anatomical surfaces.'),
  slider('flash-accents','Flash Accents','effects','Lighting',3,.45,0,1,'Bounds rapid accent intensity; zero removes event-driven flashes.'),
  slider('impact-waves','Impact Waves','effects','Energy',1,.65,0,1,'Expanding radial energy waves.'),
  slider('energy-trails','Energy Trails','effects','Energy',2,.55,0,1,'Motion history following the ten wrists.'),
  slider('particles','Particles','effects','Energy',3,.65,0,1,'Density of suspended golden embers.'),
  ...Object.entries({background:'Background',structural:'Bronze Structure',primary:'Primary Energy',secondary:'Halo / Secondary',accent:'Accent',body:'Body Tint'}).map(([key,label],i):Cinema2ParameterManifest=>({...base(key,label,'palette','Colors',i+1,`Independent ${label.toLowerCase()} color.`),type:'color',defaultValue:ARC_ANGEL_PALETTE[key as keyof typeof ARC_ANGEL_PALETTE]})),
]
const moduleKeys=['auto-performance','bpm-sync','intensity','reactivity','motion-safety','pattern','pattern-change','trigger','model-visible','model-scale','movement','animation-rate','arm-spread','animation-blend','levitation','halo-scale','halo-rotation','ring-rotation','ring-intensity','environment-density','spatial-depth','reflection','selective-light','flash-accents','impact-waves','energy-trails','particles','articulation','secondary-motion','platform-movement','crown-reactor','fragment-formation','pillar-lighting','platform-lighting','fixture-lighting','fixture-movement','beam-width','divine-conduits','structural','primary','secondary','accent','body']
const bindings=Object.fromEntries(moduleKeys.map(key=>[key,bind(key)]))
const continuous=(name:string,path:Cinema2ChoreographyContinuousSourcePath,capability:'audio.features'|'audio.bands'|'visual-director.significance',smoothingMs:number):Cinema2ChoreographyRuleManifest=>({id:cinema2StableId<Cinema2ChoreographyRuleId>(`arc-angel-${name}-rule`),priority:12,strengthParameter:bind('reactivity'),source:{signal:'continuous',path,capability,clamp:[0,1],smoothingMs},conditions:[{kind:'not-silent'}],actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`arc-angel-${name}-read`),target:{kind:'module',ref:cinema2Ref(moduleId),property:name},operation:'replace',value:1}]})
const event=(name:'kick'|'snare'|'downbeat'|'drop'|'phrase'|'bar'|'section-change',attack:number,hold:number,release:number):Cinema2ChoreographyRuleManifest=>({id:cinema2StableId<Cinema2ChoreographyRuleId>(`arc-angel-${name}-rule`),priority:30,strengthParameter:bind('reactivity'),source:{signal:name,capability:name==='drop'?'music.drop':name==='phrase'?'music.phrase':name==='downbeat'?'music.downbeat':name==='bar'?'music.bar':name==='section-change'?'music.section':'music.rhythm-events'},conditions:[{kind:'once-per-event'},...(name==='drop'?[]:[{kind:'not-silent' as const}])],actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`arc-angel-${name}-pulse`),target:{kind:'module',ref:cinema2Ref(moduleId),property:name==='section-change'?'section':name},operation:'envelope',composition:'replace',value:1,envelope:{attack,hold,release,unit:'seconds'},retrigger:'restart'}]})
// The shared camera runtime owns permission, safety, BPM, smoothing and the final matrices.
// Strength comes from the existing camera amount; no native camera or local musical detector.
const cameraBuild:Cinema2ChoreographyRuleManifest={id:cinema2StableId<Cinema2ChoreographyRuleId>('arc-angel-camera-build'),priority:40,enabledParameter:bind('camera-motion'),strengthParameter:bind('camera-amount'),source:{signal:'continuous',path:'director.build',capability:'visual-director.significance',clamp:[0,1],smoothingMs:350},conditions:[{kind:'not-silent'}],actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>('arc-angel-camera-approach'),target:{kind:'camera',ref:cinema2Ref(camera),property:'transform.position'},operation:'add',value:[0,-.35,-1.15]}]}
const cameraDrop:Cinema2ChoreographyRuleManifest={id:cinema2StableId<Cinema2ChoreographyRuleId>('arc-angel-camera-drop'),priority:110,enabledParameter:bind('camera-motion'),strengthParameter:bind('camera-amount'),source:{signal:'drop',capability:'music.drop'},conditions:[{kind:'once-per-event'}],actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>('arc-angel-camera-dolly'),target:{kind:'camera',ref:cinema2Ref(camera),property:'transform.position'},operation:'envelope',composition:'add',value:[0,.25,.85],envelope:{attack:.35,hold:.35,release:2.1,unit:'seconds'},retrigger:'restart'},{id:cinema2StableId<Cinema2ChoreographyActionId>('arc-angel-camera-lens'),target:{kind:'camera',ref:cinema2Ref(camera),property:'fovDegrees'},operation:'envelope',composition:'add',value:5,envelope:{attack:.35,hold:.35,release:2.1,unit:'seconds'},retrigger:'restart'}]}
const rules=[cameraBuild,cameraDrop,continuous('sub','audio.bands.sub','audio.bands',160),continuous('bass','audio.bands.bass','audio.bands',120),continuous('mid','audio.bands.mid','audio.bands',150),continuous('high','audio.bands.high','audio.bands',100),continuous('air','audio.bands.air','audio.bands',125),continuous('energy','audio.features.overallEnergy','audio.features',180),continuous('vocal','audio.features.vocalPresence','audio.features',220),continuous('build','director.build','visual-director.significance',200),continuous('impact','director.impact','visual-director.significance',150),event('kick',.03,.025,.24),event('snare',.02,.02,.18),event('downbeat',.055,.05,.38),event('phrase',.15,.1,.8),event('drop',.17,.1,1.23),event('bar',.08,.06,.4),event('section-change',.2,.2,1.1)]
const targetId=(name:string)=>cinema2StableId<Cinema2RenderTargetId>(`arc-angel-${name}-target`)
const passId=(name:string)=>cinema2StableId<Cinema2RenderPassId>(`arc-angel-${name}-pass`)
const slotId=(name:string)=>cinema2StableId<Cinema2RenderSlotId>(`arc-angel-${name}`)
const viewportTarget=(name:string,depth=false)=>({id:targetId(name),descriptor:{size:{kind:'viewport' as const},colorFormat:'rgba16f' as const,fallbackColorFormat:'rgba8' as const,...(depth?{depthFormat:'depth24' as const}:{})},ownership:'transient' as const})
const effectPass=(name:string,after:string,withDepth:boolean,output:boolean)=>({id:passId(name),kind:'fullscreen' as const,dependsOn:[cinema2Ref(passId(after))],effect:cinema2Ref(effectId(name)),inputs:[{id:slotId(`${name}-color-input`),source:{pass:cinema2Ref(passId(after)),output:slotId(`${after}-color`)},attachment:'color' as const},...(withDepth?[{id:slotId(`${name}-depth-input`),source:{pass:cinema2Ref(passId('scene')),output:slotId('scene-depth')},attachment:'depth' as const}]:[])],...(output?{outputs:[{id:slotId(`${name}-color`),target:cinema2Ref(targetId(name)),attachment:'color' as const}]}:{})})
// All paths remain inside the chamber and outside the articulated rings. The shared runtime owns transport and camera safety.
const shot=(position:Cinema2Vector3,fovDegrees=48,target:Cinema2Vector3=[0,.35,0])=>({position,target,fovDegrees})
const path=(points:ReturnType<typeof shot>[],durationSeconds:number):Cinema2CameraRigManifest=>({kind:'path',points,durationSeconds,loop:true})
const cameraRigs:Record<string,Cinema2CameraRigManifest>={
 'celestial-orbit':path(Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return shot([Math.sin(a)*14.1,1.2+Math.sin(a*2)*2.2,Math.cos(a)*14.1],48+Math.sin(a)*3)}),32),
 'divine-approach':path([shot([0,1.6,15.5],55),shot([4,.2,12.8],46),shot([0,-.2,11.8],42),shot([-4,1.4,13],48)],20),
 'ascension':path([shot([0,-2,14],48),shot([4,2,13.7],49),shot([0,6.1,14.3],55,[0,1,0]),shot([-4,2,13.7],50)],24),
 'cathedral-flythrough':path([shot([0,4,15.4],60),shot([11,1,10],55),shot([15,-.5,0],53),shot([0,5,-15],60),shot([-15,0,0],55),shot([-10,2,11],53)],40),
 'cinematic-impact':path([shot([0,.7,15],58),shot([3,-.5,12.5],44),shot([0,0,12],42),shot([-3,1,14.5],54)],16),
 manual:{kind:'static'},
}
const manifest:Cinema2NativePresetManifest={
 schemaId:CINEMA2_NATIVE_PRESET_SCHEMA_ID,schemaVersion:CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,id:CINEMA2_ARC_ANGEL_PRESET_ID,revision:2,
 metadata:{name:'ARC ANGEL',author:'STAGELESS',category:'Architecture',description:'A suspended ten-armed celestial entity inside a monumental celestial sanctum, with articulated machinery, spatial lighting and cinematic travel.',tags:['reference','3d','celestial','model','audio-reactive']},
 capabilities:[...(['render.webgl2','render.depth','scene.3d','camera.world','lighting'] as const).map(id=>({id,requirement:'required' as const,purpose:'Native world-space animated sculpture and celestial apparatus.'})),...(['render.hdr','audio.transport','audio.features','audio.bands','music.beat','music.rhythm-events','music.downbeat','music.bar','music.phrase','music.section','music.drop','visual-director.significance'] as const).map(id=>({id,requirement:'optional' as const,purpose:'Shared visual, musical and transport services.'}))],
 parameters,
 modules:[{id:moduleId,typeId:CINEMA2_ARC_ANGEL_MODULE_TYPE_ID,version:1,config:{asset:'cinema2-arc-angel'},parameters:{...Object.fromEntries(Object.entries(bindings).map(([key,ref])=>[key,parameters.find(p=>p.id===ref.$ref)!.defaultValue!])),...Object.fromEntries(['sub','bass','mid','high','air','energy','vocal','build','impact','kick','snare','downbeat','phrase','drop','bar','section'].map(key=>[key,0]))},parameterBindings:bindings}],
 scene:{roots:[cinema2Ref(root)],nodes:[{id:root,kind:'group',coordinateSpace:'world'},{id:node,kind:'module',parent:cinema2Ref(root),module:cinema2Ref(moduleId)}]},
 layers:[{id:layer,label:'Celestial armillary',source:cinema2Ref(root),role:'world',depthPolicy:'read-write',order:0}],
 cameras:[{id:camera,label:'Celestial perspective',projection:'perspective',fovDegrees:ARC_ANGEL_CAMERA.fovDegrees,minAspect:16/9,near:.12,far:65,transform:{position:ARC_ANGEL_CAMERA.position},target:ARC_ANGEL_CAMERA.target,rig:cameraRigs['celestial-orbit']!,rigVariants:cameraRigs,motion:{idleMotion:true,interpolation:'spline',constantSpeed:true,tempo:{referenceBpm:120,flightSpeed:true,weave:.18,bob:.06,fov:.4},drift:{position:.2,target:.025,rollDegrees:.35,fovDegrees:.7,speed:.10,seed:803},fovRateLimitDegreesPerSecond:12},smoothingMs:180,controls:{rigMode:bind('camera-mode'),motionSpeed:bind('camera-speed'),motionEnabled:bind('camera-motion'),masterMotionAmount:bind('camera-amount'),motionAmount:bind('camera-amount'),motionSafety:bind('motion-safety'),tempoSync:bind('bpm-sync')},safety:{minPosition:ARC_ANGEL_CAMERA.minPosition,maxPosition:ARC_ANGEL_CAMERA.maxPosition,maxPositionOffset:[1.4,.8,1.4],maxTargetOffset:[.45,.45,.45],minFovDegrees:ARC_ANGEL_CAMERA.minFovDegrees,maxFovDegrees:ARC_ANGEL_CAMERA.maxFovDegrees}}],
 defaults:{camera:cinema2Ref(camera)},environment:{backgroundColor:ARC_ANGEL_PALETTE.background,exposure:1,controls:{backgroundColor:bind('background')}},
 lighting:{lights:[{id:cinema2StableId<Cinema2LightId>('arc-angel-fill'),type:'ambient',color:[.8,.75,.65,1],intensity:.16},{id:cinema2StableId<Cinema2LightId>('arc-angel-key'),type:'directional',color:[1,.87,.7,1],intensity:.72,transform:{position:[-3,4,5]},targetNode:cinema2Ref(root)},{id:cinema2StableId<Cinema2LightId>('arc-angel-rim'),type:'point',color:[1,.25,.05,1],intensity:.5,transform:{position:[0,2,-2]},config:{range:12}},{id:cinema2StableId<Cinema2LightId>('arc-angel-volumetric'),type:'spot',color:[1,.67,.35,1],intensity:1.4,transform:{position:[0,9.2,0]},targetNode:cinema2Ref(root),config:{range:18,coneAngleDegrees:48,penumbra:.7,scatter:true}}]},
 effects:[{id:atmosphere,typeId:CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID,version:1,enabled:true,order:0,scope:'output',parameters:{mix:.45,density:.035,beamIntensity:.52,mistAmount:.22,mistHeight:1.2,mistFloor:-4,floorY:-4,floorReflection:0,anisotropy:.4,occlusion:.78,ambientHaze:.055,noiseScale:.4,noiseStrength:.3,drift:.045,maxDistance:40,reactivity:0},parameterBindings:{mix:bind('atmosphere')}},{id:bloom,typeId:CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,version:1,enabled:true,order:1,scope:'output',parameters:{mix:1,threshold:1.05,knee:.3,intensity:.36,spread:.46,levels:4,clampMax:10},parameterBindings:{intensity:bind('bloom')}},{id:finish,typeId:CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,version:1,enabled:true,order:2,scope:'output',parameters:{mix:.38,exposure:1,contrast:1.16,saturation:1.07,vignette:.24,grain:.035,aberration:0},parameterBindings:{mix:bind('finish')}}],
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
