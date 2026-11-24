import { cinema2AutoTargets } from './Cinema2AutoPerformanceAuthoring'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleId,
  type Cinema2Color,
  type Cinema2EffectId,
  type Cinema2LayerId,
  type Cinema2LightId,
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2RenderPassId,
  type Cinema2RenderSlotId,
  type Cinema2RenderTargetId,
  type Cinema2SceneNodeId,
  type Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID } from '../effects/Cinema2VolumetricAtmosphereEffect'
import { artifactModuleTypeId } from '../modules/Cinema2ArtifactNativeModule'
import { ARTIFACT_SPECS } from '../modules/artifactSculptures/ArtifactSpecs'
import { defaults, type ArtifactSpec } from '../modules/artifactSculptures/ArtifactDomain'
import type { Cinema2ParameterManifest } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ChoreographyContinuousSourcePath } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2MoodDrive } from './Cinema2MoodConductorAuthoring'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'

export const artifactPresetId=(id:string)=>cinema2NamespacedId<Cinema2PresetId>(`drmvyz.cinema2.${id}`)
export const artifactParameterId=(id:string,name:string)=>cinema2StableId<Cinema2ParameterId>(`${id}-${name.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)}`)
export function createArtifactPreset(spec:ArtifactSpec):Readonly<Cinema2NativePresetManifest>{
const key=spec.id, name=key.toUpperCase(), authoredDefaults=defaults(spec), MODULE_ID=cinema2StableId<Cinema2ModuleId>(`${key}-system`)
const CAMERA_ID=cinema2StableId<Cinema2CameraId>(`${key}-camera`)
const pid=(name:string)=>artifactParameterId(key,name),bind=(name:string)=>cinema2Ref(pid(name))
const ROOT_NODE_ID=cinema2StableId<Cinema2SceneNodeId>(`${key}-root`), MODEL_NODE_ID=cinema2StableId<Cinema2SceneNodeId>(`${key}-model`)
const WORLD_LAYER_ID=cinema2StableId<Cinema2LayerId>(`${key}-world`)
const lightId=(name:string)=>cinema2StableId<Cinema2LightId>(`${key}-${name}`)
const effectId=(name:string)=>cinema2StableId<Cinema2EffectId>(`${key}-${name}`)
const ATMOSPHERE_EFFECT_ID=effectId('atmosphere'),BLOOM_EFFECT_ID=effectId('bloom'),FINISH_EFFECT_ID=effectId('finish')
const targetId=(name:string)=>cinema2StableId<Cinema2RenderTargetId>(`${key}-${name}-target`)
const passId=(name:string)=>cinema2StableId<Cinema2RenderPassId>(`${key}-${name}-pass`)
const slotId=(name:string)=>cinema2StableId<Cinema2RenderSlotId>(`${key}-${name}`)
const SCENE_TARGET_ID=targetId('scene'),ATMOSPHERE_TARGET_ID=targetId('atmosphere'),BLOOM_TARGET_ID=targetId('bloom')
const SCENE_PASS_ID=passId('scene'),ATMOSPHERE_PASS_ID=passId('atmosphere'),BLOOM_PASS_ID=passId('bloom'),FINISH_PASS_ID=passId('finish')
const SCENE_COLOR_ID=slotId('scene-color'),SCENE_DEPTH_ID=slotId('scene-depth')
const vec3 = (x: number, y: number, z: number): Cinema2Vector3 => Object.freeze([x, y, z])
const color = (r: number, g: number, b: number, a = 1): Cinema2Color => Object.freeze([r, g, b, a])
const parameterBase = Object.freeze({
  section: 'Design', exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
  modulatable: true, choreographable: true, automatable: false,
})
const floatParameter = (id: Cinema2ParameterId, label: string, description: string, defaultValue: number, min: number, max: number, step: number, parent: 'master-controls' | 'design' | 'effects', group: string, order: number) => Object.freeze({
  ...parameterBase, id, label, description, type: 'float' as const, defaultValue, min, max, step, designParentGroup: parent, group, order,
})
const colorParameter = (id: Cinema2ParameterId, label: string, description: string, defaultValue: Cinema2Color, order: number) => Object.freeze({
  ...parameterBase, modulatable: false, choreographable: false, id, label, description, type: 'color' as const, defaultValue, designParentGroup: 'palette' as const, group: 'Color', order,
})

const choreographyRuleId = (name: string) => cinema2StableId<Cinema2ChoreographyRuleId>(`${key}-${name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}-rule`)
const choreographyActionId = (name: string) => cinema2StableId<Cinema2ChoreographyActionId>(`${key}-${name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}-action`)
const moduleContinuousRule = (
  name: string,
  capability: 'audio.features' | 'audio.bands' | 'music.vocal-presence' | 'visual-director.significance',
  path: Cinema2ChoreographyContinuousSourcePath,
  property: string,
  smoothingMs: number,
) => Object.freeze({
  id: choreographyRuleId(name),
  priority: 12,
  strengthParameter: cinema2Ref(pid('reactivity')),
  source: Object.freeze({ signal: 'continuous' as const, capability, path, smoothingMs }),
  conditions: Object.freeze([{kind:'not-silent' as const}]),
  actions: Object.freeze([Object.freeze({
    id: choreographyActionId(name),
    target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(MODULE_ID), property }),
    operation: 'replace' as const,
    value: 1,
  })]),
})
const moduleEnvelopeRule = (
  name: string,
  signal: 'beat' | 'kick' | 'snare' | 'downbeat' | 'bar' | 'phrase' | 'section-change' | 'drop',
  capability: 'music.beat' | 'music.rhythm-events' | 'music.downbeat' | 'music.bar' | 'music.phrase' | 'music.section' | 'music.drop',
  property: string,
  attack: number,
  hold: number,
  release: number,
) => Object.freeze({
  id: choreographyRuleId(name),
  priority: 30,
  strengthParameter: cinema2Ref(pid('reactivity')),
  source: Object.freeze({ signal, capability }),
  conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const }), ...(signal === 'drop' ? [] : [{ kind: 'not-silent' as const }])]),
  actions: Object.freeze([Object.freeze({
    id: choreographyActionId(name),
    target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(MODULE_ID), property }),
    operation: 'envelope' as const,
    value: 1,
    composition: 'replace' as const,
    envelope: Object.freeze({ attack, hold, release, unit: 'seconds' as const }),
    retrigger: 'restart' as const,
  })]),
})
const viewportTarget = (id: Cinema2RenderTargetId, depth = false) => Object.freeze({
  id,
  descriptor: Object.freeze({
    size: Object.freeze({ kind: 'viewport' as const }),
    colorFormat: 'rgba16f' as const,
    fallbackColorFormat: 'rgba8' as const,
    ...(depth ? { depthFormat: 'depth24' as const } : {}),
  }),
  ownership: 'transient' as const,
})
function effectPass(id: Cinema2RenderPassId, after: Cinema2RenderPassId, afterOutput: Cinema2RenderSlotId, effect: Cinema2EffectId, name: string, output: Cinema2RenderTargetId | null, withDepth: boolean) {
  return Object.freeze({
    id,
    kind: 'fullscreen' as const,
    dependsOn: Object.freeze([cinema2Ref(after)]),
    effect: cinema2Ref(effect),
    inputs: Object.freeze([
      Object.freeze({ id: slotId(`${name}-color-input`), source: Object.freeze({ pass: cinema2Ref(after), output: afterOutput }), attachment: 'color' as const }),
      ...(withDepth ? [Object.freeze({ id: slotId(`${name}-depth-input`), source: Object.freeze({ pass: cinema2Ref(SCENE_PASS_ID), output: SCENE_DEPTH_ID }), attachment: 'depth' as const })] : []),
    ]),
    ...(output ? { outputs: Object.freeze([Object.freeze({ id: slotId(`${name}-output`), target: cinema2Ref(output), attachment: 'color' as const })]) } : {}),
  })
}

const toggle=(name:string,label:string,description:string,value:boolean,parent:'master-controls'|'design',group:string,order:number):Cinema2ParameterManifest=>({...parameterBase,modulatable:false,choreographable:false,id:pid(name),label,description,type:'boolean',defaultValue:value,designParentGroup:parent,group,order})
const choice=(name:string,label:string,description:string,value:string,options:readonly {value:string;label:string}[],parent:'master-controls'|'design',group:string,order:number):Cinema2ParameterManifest=>({...parameterBase,modulatable:false,choreographable:false,id:pid(name),label,description,type:'enum',defaultValue:value,options,designParentGroup:parent,group,order})
const scalar=(name:string,label:string,description:string,value:number,min:number,max:number,step:number,parent:'master-controls'|'design'|'effects',group:string,order:number)=>floatParameter(pid(name),label,description,value,min,max,step,parent,group,order)
const parameters:readonly Cinema2ParameterManifest[]=[
  CINEMA2_QUALITY_MODE_PARAMETER,
  toggle('autoPerformance','Auto Performance','Let the shared Mood Conductor control the show.',false,'master-controls','Playback',1),
  toggle('bpmSync','BPM Sync','Lock mechanical phase when the Audio Dock permits it; camera uses the shared tempo control.',true,'master-controls','Playback',2),
  choice('motionSafety','Motion Safety','Limit or freeze spatial animation.','full',[{value:'full',label:'Full Motion'},{value:'reduced',label:'Reduced Motion'},{value:'lockoff',label:'Lock Off'}],'master-controls','Playback',3),
  choice('flashAccents','Flash Accents','Restrict direct transient illumination.','reduced',[{value:'off',label:'Off'},{value:'reduced',label:'Reduced'},{value:'full',label:'Full'}],'master-controls','Playback',4),
  scalar('reactivity','Music Reactivity','Shared audio envelopes and mood response.',1,0,1,.01,'master-controls','Playback',5),
  scalar('motionAmount','Motion Amount','Extent of breathing and camera movement.',.8,0,1,.01,'master-controls','Playback',6),
  scalar('intensity','Master Intensity','Core, luminous struts and projection light gain.',1,0,1.6,.01,'master-controls','Lighting',1),
  choice('pattern','Pattern','Select the authored pattern; automatic changes never save over it.',spec.patterns[0]!,spec.patterns.map(value=>({value,label:value[0]!.toUpperCase()+value.slice(1)})),'design','Pattern',1),
  toggle('patternChange','Pattern Change','Advance on new qualifying musical events.',false,'design','Pattern',2),
  {...choice('trigger','Trigger','Canonical shared event that advances the runtime pattern.','bar4',CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,'design','Pattern',3),visibleWhen:[{kind:'parameter-equals',parameterId:pid('patternChange'),value:true}]},
  ...spec.controls.map((c,i)=>scalar(c.key,c.label,c.description,c.value,c.min,c.max,c.step,'design',c.group,i+1)),
  ...(spec.extra?[toggle(spec.extra.key,spec.extra.label,spec.extra.description,true,'design','Structure',90)]:[]),
  scalar('density','Structural Density','Amount of secondary diagonal bracing.',.85,0,1,.05,'design','Structure',91),
  scalar('motionRate','Mechanical Motion Speed','Rate of the shared mechanical phase.',.7,0,1.5,.01,'design','Structure',92),
  scalar('strandThickness','Strut Thickness','Actual radius of solid lattice rods.',.045,.018,.075,.001,'design','Structure',93),
  scalar('coreScale','Core Scale','Scale of central cage and heart.',1,.7,1.3,.01,'design','Core',1),
  scalar('coreIntensity','Core Intensity','Emission gain of central heart.',1,0,1.6,.01,'design','Core',2),
  scalar('projectionIntensity','Projection Intensity','Light illuminating the walls through the lattice.',.85,0,1.6,.01,'design','Shadows',1),
  scalar('lightDistance','Projection Distance','Move the two light sources closer to enlarge the wall projections.',5.8,4.8,7.8,.05,'design','Shadows',2),
  scalar('projectionSpeed','Projection Speed','Speed of the shadow-casting fixtures around the sculpture.',.5,0,1.2,.01,'design','Shadows',3),
  scalar('shadowSoftness','Shadow Softness','Filter radius of the real geometry shadow maps.',1,0,3,.05,'design','Shadows',4),
  choice('cameraMode','Camera Mode','Select cinematic reveal, horizontal orbit, macro or locked composition.','director',[{value:'director',label:'Cinematic Reveal'},{value:'orbit',label:'Orbit'},{value:'macro',label:'Close Detail'},{value:'manual',label:'Wide Hold'}],'design','Camera',1),
  toggle('cameraMotion','Camera Motion','Hard permission for camera travel.',true,'design','Camera',2),
  scalar('cameraSpeed','Camera Speed','Rate of the shared cinematic path.',.72,0,1.4,.01,'design','Camera',3),
  scalar('cameraAmount','Camera Motion Intensity','Scale of the shared camera motion.',.9,0,1,.01,'design','Camera',4),
  scalar('fov','Field of View','Base perspective angle.',spec.camera.fov,42,74,1,'design','Camera',5),
  scalar('bloom','Bloom','Halo from luminous truss edges.',.55,0,1,.01,'effects','Illumination',1),
  scalar('atmosphereMix','Atmosphere Mix','Blend the shared atmospheric effect.',1,0,1,.01,'effects','Atmosphere',2),
  scalar('finishMix','Finish Mix','Blend the shared cinematic finish.',1,0,1,.01,'effects','Finish',3),
  scalar('haze','Atmosphere','Depth-aware atmospheric scattering.',.018,0,.06,.001,'effects','Atmosphere',1),
  scalar('contrast','Contrast','Shared cinematic contrast.',1.13,.8,1.4,.01,'effects','Finish',1),
  scalar('exposure','Exposure','Shared cinematic exposure multiplier.',1,.55,1.5,.01,'effects','Finish',3),
  scalar('vignette','Vignette','Peripheral darkening.',.25,0,.65,.01,'effects','Finish',2),
  ...(['background','metal','secondary','strand','core','hazeTint'] as const).map((k,i)=>colorParameter(pid(k),spec.paletteLabels[i]!,`Independent ${spec.paletteLabels[i]} color.`,spec.palette[k],i+1)),
]
const moduleKeys=['autoPerformance','bpmSync','motionSafety','flashAccents','pattern','patternChange','trigger',...(spec.extra?[spec.extra.key]:[]),...Object.keys(spec.palette).filter(k=>k!=='hazeTint'),...Object.keys(authoredDefaults).filter(k=>parameters.some(p=>p.id===pid(k)))]
const FOCUS=vec3(0,.05,0)
const shot=(p:readonly [number,number,number])=>({position:vec3(...p),target:FOCUS})
const path=spec.camera.path.map(shot),macro=spec.camera.macro.map(shot)
const authored:Readonly<Cinema2NativePresetManifest>={
 schemaId:CINEMA2_NATIVE_PRESET_SCHEMA_ID,schemaVersion:CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,id:artifactPresetId(key),revision:1,
 metadata:{name,description:spec.description,tags:['reference',key,'3d','shadow','audio-reactive']},
 capabilities:[{id:'render.webgl2',requirement:'required',purpose:'Solid procedural instanced trusses and shadow casting.'},{id:'render.depth',requirement:'required',purpose:'World depth and atmospheric occlusion.'},{id:'scene.3d',requirement:'required',purpose:'Complete 3D chamber.'},{id:'camera.world',requirement:'required',purpose:'Shared orbit and macro fly-through.'},{id:'lighting',requirement:'required',purpose:'Two near-field projection fixtures and architectural fill.'},{id:'render.hdr',requirement:'optional',purpose:'HDR emissive bloom.'},...(['audio.transport','audio.features','audio.bands','music.beat','music.rhythm-events','music.downbeat','music.bar','music.phrase','music.section','music.vocal-presence','music.build','music.drop','visual-director.significance'] as const).map(id=>({id,requirement:'optional' as const,purpose:'Shared music intelligence and event-driven choreography.'}))],
 parameters,
 modules:[{id:MODULE_ID,typeId:artifactModuleTypeId(key),version:1,enabled:true,
  parameters:{...authoredDefaults,...Object.fromEntries(moduleKeys.map(key=>[key,parameters.find(p=>p.id===pid(key))!.defaultValue!])),},
  parameterBindings:Object.fromEntries(moduleKeys.map(key=>[key,bind(key)]))}],
 scene:{nodes:[{id:ROOT_NODE_ID,kind:'group',coordinateSpace:'world'},{id:MODEL_NODE_ID,kind:'module',parent:cinema2Ref(ROOT_NODE_ID),module:cinema2Ref(MODULE_ID)}],roots:[cinema2Ref(ROOT_NODE_ID)]},
 layers:[{id:WORLD_LAYER_ID,label:`${name} Chamber`,source:cinema2Ref(ROOT_NODE_ID),role:'world',depthPolicy:'read-write',order:0}],
 cameras:[{id:CAMERA_ID,label:`${name} Cinematic Camera`,projection:'perspective',fovDegrees:spec.camera.fov,minAspect:16/9,minAspectAnchor:0,near:.12,far:60,transform:{position:vec3(...spec.camera.wide)},target:FOCUS,
  rig:{kind:'path',points:path,durationSeconds:58,loop:true},rigVariants:{director:{kind:'path',points:path,durationSeconds:58,loop:true},orbit:{kind:'orbit',radius:Math.hypot(...spec.camera.wide),azimuthDegrees:0,elevationDegrees:8,angularVelocityDegreesPerSecond:5},macro:{kind:'path',points:macro,durationSeconds:38,loop:true},manual:{kind:'static'}},
  motion:{idleMotion:true,interpolation:'spline',constantSpeed:true,tempo:{referenceBpm:100,flightSpeed:true,weave:.045,bob:.035,punch:.55}},
  controls:{rigMode:bind('cameraMode'),motionEnabled:bind('cameraMotion'),motionSpeed:bind('cameraSpeed'),motionAmount:bind('cameraAmount'),masterMotionAmount:bind('motionAmount'),motionSafety:bind('motionSafety'),tempoSync:bind('bpmSync'),fovDegrees:bind('fov')},
  smoothingMs:150,safety:{minPosition:vec3(-16,-4,-16),maxPosition:vec3(16,8,17),maxPositionOffset:vec3(.2,.2,.2),minFovDegrees:39,maxFovDegrees:89,minNear:.12,maxFar:60}}],
 defaults:{camera:cinema2Ref(CAMERA_ID)},
 choreography:{tempoSyncParameter:bind('bpmSync'),rules:[
    moduleContinuousRule('overallEnergy','audio.features','audio.features.overallEnergy','overallEnergy',200),
    moduleContinuousRule('subAmount','audio.bands','audio.bands.sub','subAmount',140),
    moduleContinuousRule('bassPressure','audio.bands','audio.bands.bass','bassPressure',90),
    moduleContinuousRule('lowMidAmount','audio.bands','audio.bands.lowMid','lowMidAmount',140),
    moduleContinuousRule('midAmount','audio.bands','audio.bands.mid','midAmount',110),
    moduleContinuousRule('highsAmount','audio.bands','audio.bands.high','highsAmount',65),
    moduleContinuousRule('airAmount','audio.bands','audio.bands.air','airAmount',120),
    moduleContinuousRule('fluxAmount','audio.features','audio.features.spectralFlux','fluxAmount',85),
    moduleContinuousRule('vocalPresence','music.vocal-presence','audio.features.vocalPresence','vocalPresence',220),
    moduleContinuousRule('directorIntensity','visual-director.significance','director.intensity','directorIntensity',120),
    moduleContinuousRule('directorMomentum','visual-director.significance','director.momentum','directorMomentum',95),
    moduleContinuousRule('buildAmount','visual-director.significance','director.build','buildAmount',140),
    moduleContinuousRule('directorImpact','visual-director.significance','director.impact','directorImpact',45),
    moduleContinuousRule('variation','visual-director.significance','director.variation','variation',120),
    moduleEnvelopeRule('beatAccent','beat','music.beat','beatAccent',.02,.025,.18),
    moduleEnvelopeRule('kickAccent','kick','music.rhythm-events','kickAccent',.015,.04,.32),
    moduleEnvelopeRule('snareAccent','snare','music.rhythm-events','snareAccent',.015,.03,.25),
    moduleEnvelopeRule('downbeatAccent','downbeat','music.downbeat','downbeatAccent',.025,.08,.35),
    moduleEnvelopeRule('barAccent','bar','music.bar','barAccent',.05,.1,.4),
    moduleEnvelopeRule('phraseAccent','phrase','music.phrase','phraseAccent',.08,.2,.65),
    moduleEnvelopeRule('sectionAccent','section-change','music.section','sectionAccent',.1,.1,.75),
    moduleEnvelopeRule('dropAccent','drop','music.drop','dropAccent',.03,.15,1.1),
    {id:choreographyRuleId('camera-impact'),priority:110,strengthParameter:bind('reactivity'),enabledParameter:bind('cameraMotion'),source:{signal:'drop',capability:'music.drop'},conditions:[{kind:'once-per-event'}],actions:[{id:choreographyActionId('camera-impact'),target:{kind:'camera',ref:cinema2Ref(CAMERA_ID),property:'fovDegrees'},operation:'envelope',composition:'add',value:-3,envelope:{attack:.08,hold:.1,release:.8,unit:'seconds'},retrigger:'restart'}]},
 ]},
 lighting:{lights:[{id:lightId('ambient'),type:'ambient',color:color(.72,.80,.93),intensity:.045},{id:lightId('overhead'),type:'point',color:color(.80,.88,1),intensity:.15,transform:{position:vec3(0,9,0)},config:{range:28}},{id:lightId('projection-a'),type:'spot',color:color(.9,.95,1),intensity:1,transform:{position:vec3(3.95,1.8,3.7)},targetNode:cinema2Ref(ROOT_NODE_ID),config:{range:38,coneAngleDegrees:72,penumbra:.29,threeShadow:true,scatter:false}},{id:lightId('projection-b'),type:'spot',color:color(.88,.94,1),intensity:1,transform:{position:vec3(-3.95,.7,-3.7)},targetNode:cinema2Ref(ROOT_NODE_ID),config:{range:38,coneAngleDegrees:72,penumbra:.29,threeShadow:true,scatter:false}}]},
 environment:{backgroundColor:spec.palette.background,exposure:1,controls:{backgroundColor:bind('background')}},
 effects:[
  {id:ATMOSPHERE_EFFECT_ID,typeId:CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID,version:1,enabled:true,order:0,scope:'output',parameters:{mix:1,density:.018,beamIntensity:.04,mistAmount:.035,mistHeight:.5,mistFloor:spec.room.floor,floorY:spec.room.floor,floorReflection:0,anisotropy:.35,occlusion:.82,ambientHaze:.025,noiseScale:.3,hazeColor:spec.palette.hazeTint,noiseStrength:.12,drift:.025,maxDistance:45,reactivity:0},parameterBindings:{mix:bind('atmosphereMix'),density:bind('haze'),hazeColor:bind('hazeTint')}},
  {id:BLOOM_EFFECT_ID,typeId:CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,version:1,enabled:true,order:1,scope:'output',parameters:{mix:1,threshold:1.15,knee:.35,intensity:.55,spread:.35,levels:4,clampMax:10},parameterBindings:{intensity:bind('bloom')}},
  {id:FINISH_EFFECT_ID,typeId:CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,version:1,enabled:true,order:2,scope:'output',parameters:{mix:1,toneMap:1,exposure:1,contrast:1.13,saturation:.95,vignette:.25,vignetteSoftness:.7,grain:.018,aberration:0},parameterBindings:{mix:bind('finishMix'),contrast:bind('contrast'),exposure:bind('exposure'),vignette:bind('vignette')}},
 ],
 render:{targets:[viewportTarget(SCENE_TARGET_ID,true),viewportTarget(ATMOSPHERE_TARGET_ID),viewportTarget(BLOOM_TARGET_ID)],passes:[{id:SCENE_PASS_ID,kind:'scene',layers:[cinema2Ref(WORLD_LAYER_ID)],outputs:[{id:SCENE_COLOR_ID,target:cinema2Ref(SCENE_TARGET_ID),attachment:'color'},{id:SCENE_DEPTH_ID,target:cinema2Ref(SCENE_TARGET_ID),attachment:'depth'}]},effectPass(ATMOSPHERE_PASS_ID,SCENE_PASS_ID,SCENE_COLOR_ID,ATMOSPHERE_EFFECT_ID,'atmosphere',ATMOSPHERE_TARGET_ID,true),effectPass(BLOOM_PASS_ID,ATMOSPHERE_PASS_ID,slotId('atmosphere-output'),BLOOM_EFFECT_ID,'bloom',BLOOM_TARGET_ID,false),effectPass(FINISH_PASS_ID,BLOOM_PASS_ID,slotId('bloom-output'),FINISH_EFFECT_ID,'finish',null,false)],outputPass:cinema2Ref(FINISH_PASS_ID)},
 output:{renderPass:cinema2Ref(FINISH_PASS_ID),colorSpace:'srgb',alphaMode:'opaque'},
}
const mod=(name:string)=>cinema2AutoTargets.module(`${key}-system`,name)
const drives:Cinema2MoodDrive[]=[
 ...spec.mood.map(d=>({id:`${d.key.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)}-mood`,target:mod(d.key),source:d.source,operation:d.operation,value:d.value})),
 {id:'rate-momentum',target:mod('motionRate'),source:'mood.momentum',operation:'multiply',value:1.4},
 {id:'rate-calm',target:mod('motionRate'),source:'mood.calm',operation:'multiply',value:.65},
 {id:'projection-peak',target:mod('projectionIntensity'),source:'mood.peak',operation:'multiply',value:1.25},
 {id:'intensity-silence',target:mod('intensity'),source:'mood.silence',operation:'multiply',value:.12},
 {id:'bloom-peak',target:cinema2AutoTargets.effect(`${key}-bloom`,'intensity'),source:'mood.peak',operation:'multiply',value:1.25},
 {id:'haze-tense',target:cinema2AutoTargets.effect(`${key}-atmosphere`,'density'),source:'mood.tense',operation:'multiply',value:1.35},
]
return withCinema2MoodDrives(authored,{idPrefix:`${key}-auto`,enabledParameter:pid('autoPerformance'),strengthParameter:pid('reactivity'),patternControls:{patternChange:pid('patternChange'),trigger:pid('trigger')},drives})
}
export const ARTIFACT_PRESET_MANIFESTS=ARTIFACT_SPECS.map(createArtifactPreset)
export const [CINEMA2_SERAPH_PRESET_MANIFEST,CINEMA2_PARADOX_PRESET_MANIFEST,CINEMA2_RELIC_PRESET_MANIFEST,CINEMA2_MONOLITH_PRESET_MANIFEST]=ARTIFACT_PRESET_MANIFESTS
