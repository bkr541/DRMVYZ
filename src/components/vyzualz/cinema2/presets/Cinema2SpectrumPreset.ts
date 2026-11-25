import { CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2NamespacedId, cinema2Ref, cinema2StableId, type Cinema2CameraId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyContinuousSourcePath, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest, type Cinema2DesignParentGroup, type Cinema2EffectId, type Cinema2LayerId, type Cinema2LightId, type Cinema2MediaSlotId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest, type Cinema2PresetId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId, type Cinema2SceneNodeId } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID } from '../effects/Cinema2VolumetricAtmosphereEffect'
import { CINEMA2_SPECTRUM_MODULE_TYPE_ID } from '../modules/Cinema2SpectrumNativeModule'
import { SPECTRUM_COLORS, SPECTRUM_PATTERNS } from '../modules/spectrum/SpectrumDomain'
import { CANVAS_POOL_AUTOMATION_TRIGGER_OPTIONS } from '../../react/canvasPerformance/CanvasPerformanceTypes'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { cinema2AutoTargets } from './Cinema2AutoPerformanceAuthoring'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'

export const CINEMA2_SPECTRUM_PRESET_ID=cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.spectrum')
const id=(name:string)=>cinema2StableId<Cinema2ParameterId>(`spectrum-${name}`)
const bind=(name:string)=>cinema2Ref(id(name))
const moduleId=cinema2StableId<Cinema2ModuleId>('spectrum-machine')
const root=cinema2StableId<Cinema2SceneNodeId>('spectrum-root'), node=cinema2StableId<Cinema2SceneNodeId>('spectrum-bay')
const layer=cinema2StableId<Cinema2LayerId>('spectrum-world'), camera=cinema2StableId<Cinema2CameraId>('spectrum-camera')
const effectId=(name:string)=>cinema2StableId<Cinema2EffectId>(`spectrum-${name}`)
const bloom=effectId('bloom'), atmosphere=effectId('atmosphere'), finish=effectId('finish')
const base=(name:string,label:string,parent:Cinema2DesignParentGroup,group:string,order:number,description:string)=>({id:id(name),label,description,section:'Design' as const,designParentGroup:parent,group,order,exposure:'primary' as const,persistence:'preset' as const,reset:'authored-default' as const})
const slider=(name:string,label:string,parent:Cinema2DesignParentGroup,group:string,order:number,defaultValue:number,min:number,max:number,description:string,manual=false,step=.01):Cinema2ParameterManifest=>({...base(name,label,parent,group,order,description),type:'float',defaultValue,min,max,step,modulatable:!manual,choreographable:!manual})
const toggle=(name:string,label:string,parent:Cinema2DesignParentGroup,group:string,order:number,defaultValue:boolean,description:string):Cinema2ParameterManifest=>({...base(name,label,parent,group,order,description),type:'boolean',defaultValue})
const choice=(name:string,label:string,parent:Cinema2DesignParentGroup,group:string,order:number,defaultValue:string,options:readonly {value:string;label:string}[],description:string):Cinema2ParameterManifest=>({...base(name,label,parent,group,order,description),type:'enum',defaultValue,options})
export const CINEMA2_SPECTRUM_MEDIA_SLOT=cinema2StableId<Cinema2MediaSlotId>('spectrum-arena-media')
const options=(values:readonly string[])=>values.map(value=>({value,label:value[0]!.toUpperCase()+value.slice(1)}))
const parameters:readonly Cinema2ParameterManifest[]=[
 CINEMA2_QUALITY_MODE_PARAMETER,
 toggle('auto-performance','Auto Performance','master-controls','Playback',1,false,'Enable shared mood modulation and pattern authority.'),
 toggle('bpm-sync','BPM Sync','master-controls','Playback',2,true,'Follow the shared beat clock.'),
 slider('intensity','Master Intensity','master-controls','Playback',3,0.75,0,1,'Scale physical motion and frame energy.',false,0.01),
 slider('reactivity','Music Reactivity','master-controls','Playback',4,0.75,0,1,'Scale musical contributions.',true,0.01),
 choice('motion-safety','Motion Safety','master-controls','Playback',5,'reduced',options(['full','reduced','lockoff']),'Limit movement or lock the camera and bays.'),
 choice('pattern','Pattern','design','Pattern',1,'orbit',SPECTRUM_PATTERNS,'Select a native arena program.'),
 toggle('pattern-change','Pattern Change','design','Pattern',2,false,'Advance on a shared musical event.'),
 {...choice('trigger','Trigger','design','Pattern',3,'bar4',CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,'Select the event that advances patterns.'),visibleWhen:[{kind:'parameter-equals',parameterId:id('pattern-change'),value:true}]},
 toggle('camera-motion','Camera Motion','design','Camera',1,true,'Authorize camera drift.'),
 slider('camera-amount','Camera Amount','design','Camera',2,0.25,0,1,'Amplitude of perspective drift.',false,0.01),
 {...slider('bay-count','Bay Count','design','Arena',1,12,8,16,'Number of physical curved display bays.',true,1),type:'integer'},
 slider('arena-radius','Arena Radius','design','Arena',2,1,.8,1.5,'Ring radius relative to seven world units.',true),
 slider('display-height','Display Height','design','Arena',3,1,.6,1.4,'Physical height of each screen.',true),
 slider('bay-gap','Bay Gap','design','Arena',4,.025,.005,.08,'Fraction of each bay reserved for physical seams.',true,.005),
 choice('coverage','Panorama Coverage','design','Arena',5,'wide-arc',[{value:'front-arc',label:'Front Arc'},{value:'wide-arc',label:'Wide Arc'},{value:'full-wrap',label:'Full Wrap'}],'Angular extent of the mapped panorama.'),
 slider('bay-opening','Bay Opening','design','Motion',1,.35,0,1,'Maximum radial extension of the bays.'),
 slider('bay-tilt','Bay Tilt','design','Motion',2,8,0,25,'Maximum tilt in degrees.',false,1),
 slider('orbit-rate','Orbit Rate','design','Motion',3,1,.25,2,'Rate of circumferential choreography.'),
 slider('floor-relay','Floor Relay','design','Energy',1,.55,0,1,'Concentric floor pulse intensity.'),
 slider('circumference-sweep','Circumference Sweep','design','Energy',2,.55,0,1,'Strength of moving bay light packets.'),
 slider('overhead-emission','Overhead Emission','design','Energy',3,.35,0,1,'Upper truss lighting strength.'),
 {...base('arena-media','Arena Media','design','Media Presentation',0,'Select media through the existing Source tab.'),type:'media',defaultValue:null,mediaSlot:cinema2Ref(CINEMA2_SPECTRUM_MEDIA_SLOT)},
 choice('source-mode','Source Mode','design','Media Presentation',1,'auto',options(['auto','procedural','single','pool']),'Select automatic active source, procedural, single media or pool.'),
 toggle('media-visible','Media Visible','design','Media Presentation',2,true,'Hard screen visibility permission.'),
 choice('media-fit','Media Fit','design','Media Presentation',3,'contain',options(['contain','cover','fill']),'Aspect-preserving fit or explicit fill.'),
 choice('media-layout','Media Layout','design','Media Presentation',4,'continuous',options(['continuous','grouped']),'Continuous panorama or logical media groups.'),
 {...choice('grouping','Grouping','design','Media Presentation',5,'left-center-right',[{value:'left-center-right',label:'Left / Center / Right'},{value:'quadrants',label:'Quadrants'}],'Group angular display bays.'),visibleWhen:[{kind:'parameter-equals',parameterId:id('media-layout'),value:'grouped'}]},
 slider('media-scale','Media Scale','design','Media Presentation',6,1,0.5,1.5,'Uniform UV scale.',true,0.01),
 slider('media-x','Media X Offset','design','Media Presentation',7,0,-0.5,0.5,'Horizontal source offset.',true,0.01),
 slider('media-y','Media Y Offset','design','Media Presentation',8,0,-0.5,0.5,'Vertical source offset.',true,0.01),
 slider('media-rotation','Media Rotation','design','Media Presentation',9,0,-180,180,'Source rotation in degrees.',true,1),
 slider('media-opacity','Media Opacity','design','Media Presentation',10,1,0,1,'Screen content blend.',true,0.01),
 slider('media-brightness','Media Brightness','design','Media Presentation',11,1,0,2,'Screen exposure.',true,0.01),
 slider('transition','Transition Duration','design','Media Presentation',12,0.35,0,1.5,'Fade in a newly resolved source.',true,0.05),
 toggle('readability','Media Readability','design','Media Presentation',13,true,'Restrain angular and lateral motion.'),
 toggle('pool-automation','Pool Automation','design','Media Presentation',14,false,'Permit transient pool advancement on fresh events.'),
 {...choice('pool-trigger','Pool Trigger','design','Media Presentation',15,'4bars',CANVAS_POOL_AUTOMATION_TRIGGER_OPTIONS,'Independent pool cadence.'),visibleWhen:[{kind:'parameter-equals',parameterId:id('pool-automation'),value:true}]},
 slider('bloom','Bloom','effects','Finish',1,0.25,0,1,'HDR emissive glow.',false,0.01),
 slider('atmosphere','Atmosphere','effects','Finish',2,0.1,0,1,'Depth-aware haze.',false,0.01),
 slider('reflection','Reflection Strength','effects','Finish',3,0.25,0,1,'Metal and floor environment response.',false,0.01),
 slider('shadow','Shadow Strength','effects','Finish',4,0.55,0,1,'Shadow-casting key contribution.',false,0.01),
 slider('spill','Light Spill','effects','Finish',5,0.3,0,1,'Localized frame lighting.',false,0.01),
 slider('finish','Cinematic Finish','effects','Finish',6,0.2,0,1,'Output tonal treatment.',false,0.01),
 ...Object.entries({background:'Background',structural:'Structural',primary:'Primary Energy',secondary:'Secondary Energy',accent:'Accent'}).map(([key,label],i):Cinema2ParameterManifest=>({...base(key,label,'palette','Arena Palette',i+1,`Color of ${label.toLowerCase()}.`),type:'color',defaultValue:SPECTRUM_COLORS[key as keyof typeof SPECTRUM_COLORS]})),
]
const bindings=Object.fromEntries(['auto-performance', 'bpm-sync', 'intensity', 'reactivity', 'motion-safety', 'pattern', 'pattern-change', 'trigger', 'bay-count','arena-radius','display-height','bay-gap','coverage','bay-opening','bay-tilt','orbit-rate','floor-relay','circumference-sweep','overhead-emission', 'source-mode', 'media-visible', 'media-fit', 'media-layout', 'grouping', 'media-scale', 'media-x', 'media-y', 'media-rotation', 'media-opacity', 'media-brightness', 'transition', 'readability', 'pool-automation', 'pool-trigger', 'reflection', 'spill', 'structural', 'primary', 'secondary', 'accent'].map(key=>[key,bind(key)]))
const continuous=(name:string,path:Cinema2ChoreographyContinuousSourcePath,capability:'audio.features'|'audio.bands'|'visual-director.significance',smoothingMs:number):Cinema2ChoreographyRuleManifest=>({id:cinema2StableId<Cinema2ChoreographyRuleId>(`spectrum-${name}-rule`),priority:12,strengthParameter:bind('reactivity'),source:{signal:'continuous',path,capability,clamp:[0,1],smoothingMs},conditions:[{kind:'not-silent'}],actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`spectrum-${name}-read`),target:{kind:'module',ref:cinema2Ref(moduleId),property:name},operation:'replace',value:1}]})
const event=(name:'kick'|'snare'|'beat'|'downbeat'|'drop'|'phrase',attack:number,hold:number,release:number):Cinema2ChoreographyRuleManifest=>({id:cinema2StableId<Cinema2ChoreographyRuleId>(`spectrum-${name}-rule`),priority:30,strengthParameter:bind('reactivity'),source:{signal:name,capability:name==='drop'?'music.drop':name==='phrase'?'music.phrase':name==='downbeat'?'music.downbeat':name==='beat'?'music.beat':'music.rhythm-events'},conditions:[{kind:'once-per-event'},...(name==='drop'?[]:[{kind:'not-silent' as const}])],actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`spectrum-${name}-pulse`),target:{kind:'module',ref:cinema2Ref(moduleId),property:name},operation:'envelope',composition:'replace',value:1,envelope:{attack,hold,release,unit:'seconds'},retrigger:'restart'}]})
const rules=[continuous('sub','audio.bands.sub','audio.bands',160),continuous('bass','audio.bands.bass','audio.bands',120),continuous('mid','audio.bands.mid','audio.bands',150),continuous('high','audio.bands.high','audio.bands',100),continuous('air','audio.bands.air','audio.bands',125),continuous('energy','audio.features.overallEnergy','audio.features',180),continuous('vocal','audio.features.vocalPresence','audio.features',220),continuous('build','director.build','visual-director.significance',200),continuous('impact','director.impact','visual-director.significance',150),event('kick',.03,.025,.24),event('snare',.02,.02,.18),event('beat',.03,.02,.20),event('downbeat',.055,.05,.38),event('phrase',.15,.1,.8),event('drop',.17,.1,1.5)]
const targetId=(name:string)=>cinema2StableId<Cinema2RenderTargetId>(`spectrum-${name}-target`)
const passId=(name:string)=>cinema2StableId<Cinema2RenderPassId>(`spectrum-${name}-pass`)
const slotId=(name:string)=>cinema2StableId<Cinema2RenderSlotId>(`spectrum-${name}`)
const viewportTarget=(name:string,depth=false)=>({id:targetId(name),descriptor:{size:{kind:'viewport' as const},colorFormat:'rgba16f' as const,fallbackColorFormat:'rgba8' as const,...(depth?{depthFormat:'depth24' as const}:{})},ownership:'transient' as const})
const effectPass=(name:string,after:string,withDepth:boolean,output:boolean)=>({id:passId(name),kind:'fullscreen' as const,dependsOn:[cinema2Ref(passId(after))],effect:cinema2Ref(effectId(name)),inputs:[{id:slotId(`${name}-color-input`),source:{pass:cinema2Ref(passId(after)),output:slotId(`${after}-color`)},attachment:'color' as const},...(withDepth?[{id:slotId(`${name}-depth-input`),source:{pass:cinema2Ref(passId('scene')),output:slotId('scene-depth')},attachment:'depth' as const}]:[])],...(output?{outputs:[{id:slotId(`${name}-color`),target:cinema2Ref(targetId(name)),attachment:'color' as const}]}:{})})
const manifest:Cinema2NativePresetManifest={
 schemaId:CINEMA2_NATIVE_PRESET_SCHEMA_ID,schemaVersion:CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,id:CINEMA2_SPECTRUM_PRESET_ID,revision:1,
 metadata:{name:'SPECTRUM',author:'STAGELESS',category:'Architecture',description:'A circular concert arena with curved panoramic LED bays, concentric light routes and six spatial programs.',tags:['reference','3d','media-arena','media','audio-reactive']},
 capabilities:[...(['render.webgl2','render.depth','scene.3d','camera.world','lighting'] as const).map(id=>({id,requirement:'required' as const,purpose:'Native circular arena and shadow lighting.'})),...(['render.hdr','audio.transport','audio.features','audio.bands','music.beat','music.rhythm-events','music.downbeat','music.bar','music.phrase','music.section','music.drop','visual-director.significance','media.image','media.video'] as const).map(id=>({id,requirement:'optional' as const,purpose:'Shared visual, musical and transport services.'}))],
 parameters,
 mediaSlots:[{id:CINEMA2_SPECTRUM_MEDIA_SLOT,label:'Arena Media',accepts:['image','video']}],
 modules:[{id:moduleId,typeId:CINEMA2_SPECTRUM_MODULE_TYPE_ID,version:1,parameters:{...Object.fromEntries(Object.entries(bindings).map(([key,ref])=>[key,parameters.find(p=>p.id===ref.$ref)!.defaultValue!])),...Object.fromEntries(['sub','bass','mid','high','air','energy','vocal','build','impact','kick','snare','beat','downbeat','phrase','drop'].map(key=>[key,0]))},parameterBindings:bindings,media:{arenaMedia:cinema2Ref(CINEMA2_SPECTRUM_MEDIA_SLOT)}}],
 scene:{roots:[cinema2Ref(root)],nodes:[{id:root,kind:'group',coordinateSpace:'world'},{id:node,kind:'module',parent:cinema2Ref(root),module:cinema2Ref(moduleId)}]},
 layers:[{id:layer,label:'Circular arena',source:cinema2Ref(root),role:'world',depthPolicy:'read-write',order:0}],
 cameras:[{id:camera,label:'Arena view',projection:'perspective',fovDegrees:52,minAspect:16/9,near:.12,far:65,transform:{position:[0,.65,3.6]},target:[0,-1.15,-4],rig:{kind:'static'},motion:{idleMotion:true,tempo:{referenceBpm:120,weave:.035,bob:.025},drift:{position:.45,target:.035,rollDegrees:0,fovDegrees:.3,speed:.10,seed:803}},controls:{motionEnabled:bind('camera-motion'),motionAmount:bind('camera-amount'),motionSafety:bind('motion-safety'),tempoSync:bind('bpm-sync')},safety:{minPosition:[-.8,.25,3.1],maxPosition:[.8,1.1,3.8],maxTargetOffset:[.08,.08,.08],minFovDegrees:50,maxFovDegrees:54}}],
 defaults:{camera:cinema2Ref(camera)},environment:{backgroundColor:SPECTRUM_COLORS.background,exposure:1,controls:{backgroundColor:bind('background')}},
 lighting:{lights:[{id:cinema2StableId<Cinema2LightId>('spectrum-fill'),type:'ambient',color:[.65,.75,.9,1],intensity:.16},{id:cinema2StableId<Cinema2LightId>('spectrum-key'),type:'spot',color:[.85,.93,1,1],intensity:.55,controls:{intensity:bind('shadow')},transform:{position:[-4,5,5]},targetNode:cinema2Ref(root),config:{range:30,coneAngleDegrees:70,penumbra:.65,threeShadow:true,scatter:false}},{id:cinema2StableId<Cinema2LightId>('spectrum-rim'),type:'point',color:[.35,.8,1,1],intensity:.24,transform:{position:[3,2,-2]},config:{range:15}}]},
 effects:[{id:atmosphere,typeId:CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID,version:1,enabled:true,order:0,scope:'output',parameters:{mix:.1,density:.025,beamIntensity:.08,mistAmount:.06,mistHeight:.5,mistFloor:-2.9,floorY:-2.9,floorReflection:0,anisotropy:.35,occlusion:.82,ambientHaze:.02,noiseScale:.3,noiseStrength:.12,drift:.025,maxDistance:40,reactivity:0},parameterBindings:{mix:bind('atmosphere')}},{id:bloom,typeId:CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,version:1,enabled:true,order:1,scope:'output',parameters:{mix:1,threshold:1.25,knee:.3,intensity:.25,spread:.33,levels:4,clampMax:10},parameterBindings:{intensity:bind('bloom')}},{id:finish,typeId:CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,version:1,enabled:true,order:2,scope:'output',parameters:{mix:.2,exposure:1,contrast:1.1,saturation:1.03,vignette:.12,grain:0,aberration:0},parameterBindings:{mix:bind('finish')}}],
 choreography:{tempoSyncParameter:bind('bpm-sync'),rules},
 render:{targets:[viewportTarget('scene',true),viewportTarget('atmosphere'),viewportTarget('bloom')],passes:[{id:passId('scene'),kind:'scene',layers:[cinema2Ref(layer)],outputs:[{id:slotId('scene-color'),target:cinema2Ref(targetId('scene')),attachment:'color'},{id:slotId('scene-depth'),target:cinema2Ref(targetId('scene')),attachment:'depth'}]},effectPass('atmosphere','scene',true,true),effectPass('bloom','atmosphere',false,true),effectPass('finish','bloom',false,false)],outputPass:cinema2Ref(passId('finish'))},output:{renderPass:cinema2Ref(passId('finish')),colorSpace:'srgb',alphaMode:'opaque'},
}
const mod=(key:string)=>cinema2AutoTargets.module(moduleId,key)
export const CINEMA2_SPECTRUM_PRESET_MANIFEST=withCinema2MoodDrives(manifest,{idPrefix:'spectrum-auto',enabledParameter:id('auto-performance'),strengthParameter:id('reactivity'),patternControls:{patternChange:id('pattern-change'),trigger:id('trigger')},drives:[
 {id:'opening',target:mod('bay-opening'),source:'mood.energy',operation:'add',value:.15},
 {id:'sweep',target:mod('circumference-sweep'),source:'mood.build',operation:'add',value:.20},
 {id:'rate',target:mod('orbit-rate'),source:'mood.momentum',operation:'multiply',value:1.30},
 {id:'floor',target:mod('floor-relay'),source:'mood.shock',operation:'add',value:.15},
 {id:'bloom',target:cinema2AutoTargets.effect(bloom,'intensity'),source:'mood.peak',operation:'add',value:.08},
 {id:'spill',target:mod('spill'),source:'mood.brightness',operation:'add',value:.12},
 {id:'silence-opening',target:mod('bay-opening'),source:'mood.silence',operation:'add',value:-.30},
 {id:'silence-floor',target:mod('floor-relay'),source:'mood.silence',operation:'add',value:-.40},
]})
