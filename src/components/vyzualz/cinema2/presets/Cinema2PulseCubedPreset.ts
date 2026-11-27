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
  type Cinema2VariationId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID } from '../effects/Cinema2VolumetricAtmosphereEffect'
import { CINEMA2_PULSE_CUBED_MODULE_TYPE_ID } from '../modules/Cinema2PulseCubedNativeModule'
import { PULSE_CONTROLS, PULSE_PATTERN_OPTIONS, PALETTE, PALETTE_LABELS, defaults } from '../modules/pulseCubed/PulseCubedDomain'
import type { Cinema2ParameterManifest } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ChoreographyContinuousSourcePath } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2MoodDrive } from './Cinema2MoodConductorAuthoring'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'

export const CINEMA2_PULSE_CUBED_PRESET_ID=cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.pulse-cubed')
const key='pulse-cubed', name='PULSE CUBED', MODULE_ID=cinema2StableId<Cinema2ModuleId>(`${key}-system`)
const CAMERA_ID=cinema2StableId<Cinema2CameraId>(`${key}-camera`)
export const pulseParameterId=(name:string)=>cinema2StableId<Cinema2ParameterId>(`${key}-${name.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)}`)
const pid=pulseParameterId,bind=(name:string)=>cinema2Ref(pid(name))
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
  toggle('autoPerformance','Auto Performance','Use the shared Mood Conductor and effective pattern policy.',false,'master-controls','Performance',1),
  toggle('bpmSync','BPM Sync','Synchronize authored clip and camera timing with the shared beat clock.',true,'master-controls','Performance',2),
  choice('motionSafety','Motion Safety','Reduce motion or hold the sculpture and camera.', 'full',[{value:'full',label:'Full Motion'},{value:'reduced',label:'Reduced Motion'},{value:'lockoff',label:'Lock Off'}],'master-controls','Performance',3),
  choice('flashAccents','Flash Accents','Limit rapid illumination changes.','reduced',[{value:'off',label:'Off'},{value:'reduced',label:'Reduced'},{value:'full',label:'Full'}],'master-controls','Performance',4),
  choice('pattern','Pattern','Choose a native sculpture performance pattern.','circulation',PULSE_PATTERN_OPTIONS,'design','Pattern',1),
  toggle('patternChange','Pattern Change','Advance the runtime pattern on a fresh qualifying event.',false,'design','Pattern',2),
  {...choice('trigger','Trigger','Shared musical event that advances the pattern.','bar4',CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,'design','Pattern',3),visibleWhen:[{kind:'parameter-equals',parameterId:pid('patternChange'),value:true}]},
  choice('transitionLength','Transition Length','Length of the eased pattern crossfade, measured in beats.','1',[{value:'0',label:'Instant'},{value:'.5',label:'½ Beat'},{value:'1',label:'1 Beat'},{value:'2',label:'2 Beats'},{value:'4',label:'4 Beats'}],'design','Pattern',4),
  toggle('enclosure','Enclosure','Show the supplied outer optical shell.',true,'design','Structure',1),
  choice('flow','Flow Direction','Override the direction of the energy tracks.','pattern',[{value:'pattern',label:'Pattern Controlled'},{value:'forward',label:'Forward'},{value:'reverse',label:'Reverse'},{value:'alternating',label:'Alternating'}],'design','Energy Circulation',1),
  choice('cameraMode','Camera Motion','Select a cinematic camera path.','float',[{value:'static',label:'Static'},{value:'float',label:'Float'},{value:'orbit',label:'Orbit'},{value:'dolly',label:'Dolly'},{value:'axis',label:'Axis Sweep'},{value:'pattern',label:'Pattern Controlled'}],'design','Camera',1),
  {...toggle('particles','Particles','Enable sparse energy motes.',false,'design','Structure',100),designParentGroup:'effects',group:'Atmosphere & Energy',order:1},
  ...PULSE_CONTROLS.map(([k,label,value,min,max,step,parent,group],i):Cinema2ParameterManifest=>({
    ...scalar(k,label,k==='cameraAmount'?'Relative camera sway and pattern-controlled orbit gain (0 locks the shared camera clock).':k==='cameraZoom'?'Scale the isolated composition within its aspect-safe framing.':`${label} of the kinetic optical sculpture.`,value,min,max,step,parent,group,i+10),
    ...(k==='visibleLayers'||k==='pulseCount'?{type:'integer' as const,modulatable:false,choreographable:false}:{}),
    ...(k==='enclosureOpacity'?{visibleWhen:[{kind:'parameter-equals' as const,parameterId:pid('enclosure'),value:true}]}:{}),
    ...(k==='particleAmount'?{visibleWhen:[{kind:'parameter-equals' as const,parameterId:pid('particles'),value:true}]}:{}),
  })),
  ...Object.entries(PALETTE).map(([k,v],i)=>colorParameter(pid(k),PALETTE_LABELS[i]!,`Independent ${PALETTE_LABELS[i]} color.`,v,i+1)),
]
const effectKeys=new Set(['bloom','haze','aberration','hazeTint','background'])
const cameraKeys=new Set(['cameraSpeed','fov'])
const moduleKeys=['autoPerformance','bpmSync','motionSafety','flashAccents','pattern','patternChange','trigger','transitionLength','enclosure','particles','flow','cameraMode',...Object.keys(PALETTE).filter(k=>!effectKeys.has(k)),...Object.keys(defaults).filter(k=>parameters.some(p=>p.id===pid(k))&&!effectKeys.has(k)&&!cameraKeys.has(k))]
// Native variations preserve the seven editable color roles; they are never selected by mood.
const paletteRecipes = [
 ['Original Reactor','FF5100 FFAA44 34312F FF009C FFE4CC 391525 050507'],
 ['Cryogenic','008BFF 5CFBFF 283D49 625CFF D5F7FF 0C203B 03070D'],
 ['Ultraviolet','8D35FF EA3BFF 30263D FF288A D9BAFF 2D0C46 08040D'],
 ['Toxic','A5FF00 36FFC0 253B2C 00E57B E4FFB2 142C16 030905'],
 ['Molten','FF2100 FFB000 453128 FF4720 FFF0BE 42130B 0B0403'],
 ['Monochrome','E0E0E0 909090 343434 B4B4B4 FFFFFF 222222 050505'],
 ['Event Horizon','FF205E 5379FF 242538 762AFF DDE5FF 1B1238 04040B'],
 ['Liquid Gold','FFB526 FFE19B 51432D E39025 FFF4D4 342611 080603'],
] as const
const variations=paletteRecipes.map(([label,hex])=>({id:cinema2StableId<Cinema2VariationId>(`${key}-${label.toLowerCase().replaceAll(' ','-')}`),label,parameterValues:Object.fromEntries(Object.keys(PALETTE).map((k,i)=>{const n=parseInt(hex.split(' ')[i]!,16);return [pid(k),color((n>>16)/255,((n>>8)&255)/255,(n&255)/255)]}))}))
const FOCUS=vec3(0,0,0)
const shot=(p:readonly [number,number,number])=>({position:vec3(...p),target:FOCUS})
const home=vec3(3.6,2.3,6.2)
const path=[home,vec3(2.6,1.7,6.9),vec3(3.9,2.7,5.9),home].map(shot)
const dolly=[home,vec3(3.1,1.98,5.4),vec3(4,2.55,6.9),home].map(shot)
const sweep=[home,vec3(0,3.3,7.0),vec3(-3.6,2.3,6.2),home].map(shot)
const authored:Readonly<Cinema2NativePresetManifest>={
 schemaId:CINEMA2_NATIVE_PRESET_SCHEMA_ID,schemaVersion:CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,id:CINEMA2_PULSE_CUBED_PRESET_ID,revision:1,
 metadata:{name,description:'Four rotating transmissive cubic frames and 48 circulating energy pulses inside an optical enclosure. Twelve music-driven kinetic sculpture patterns.',tags:['3d','geometric','glass','kinetic','audio-reactive',key]},
 capabilities:[{id:'render.webgl2',requirement:'required',purpose:'Original animated GLB meshes with physical materials.'},{id:'render.depth',requirement:'required',purpose:'World depth and atmospheric occlusion.'},{id:'scene.3d',requirement:'required',purpose:'Nested optical sculpture.'},{id:'camera.world',requirement:'required',purpose:'Shared cinematic camera.'},{id:'lighting',requirement:'required',purpose:'Shared lighting and environment reflections.'},{id:'render.hdr',requirement:'optional',purpose:'HDR emissive bloom.'},...(['audio.transport','audio.features','audio.bands','music.beat','music.rhythm-events','music.downbeat','music.bar','music.phrase','music.section','music.vocal-presence','music.build','music.drop','visual-director.significance'] as const).map(id=>({id,requirement:'optional' as const,purpose:'Shared music intelligence and event-driven choreography.'}))],
 parameters,
 modules:[{id:MODULE_ID,typeId:CINEMA2_PULSE_CUBED_MODULE_TYPE_ID,version:1,enabled:true,
  parameters:{...Object.fromEntries(Object.entries(defaults).filter(([k])=>!effectKeys.has(k)&&!cameraKeys.has(k))),...Object.fromEntries(moduleKeys.map(key=>[key,parameters.find(p=>p.id===pid(key))!.defaultValue!])),},
  parameterBindings:Object.fromEntries(moduleKeys.map(key=>[key,bind(key)]))}],
 scene:{nodes:[{id:ROOT_NODE_ID,kind:'group',coordinateSpace:'world'},{id:MODEL_NODE_ID,kind:'module',parent:cinema2Ref(ROOT_NODE_ID),module:cinema2Ref(MODULE_ID)}],roots:[cinema2Ref(ROOT_NODE_ID)]},
 layers:[{id:WORLD_LAYER_ID,label:`${name} Sculpture`,source:cinema2Ref(ROOT_NODE_ID),role:'world',depthPolicy:'read-write',order:0}],
 cameras:[{id:CAMERA_ID,label:`${name} Cinematic Camera`,projection:'perspective',fovDegrees:42,minAspect:1,minAspectAnchor:0,near:.12,far:60,transform:{position:home},target:FOCUS,
  rig:{kind:'path',points:path,durationSeconds:24,loop:true},rigVariants:{static:{kind:'static'},float:{kind:'path',points:path,durationSeconds:24,loop:true},orbit:{kind:'orbit',radius:7.5,azimuthDegrees:30,elevationDegrees:17,angularVelocityDegreesPerSecond:5},dolly:{kind:'path',points:dolly,durationSeconds:20,loop:true},axis:{kind:'path',points:sweep,durationSeconds:32,loop:true},pattern:{kind:'path',points:sweep,durationSeconds:32,loop:true}},
  motion:{idleMotion:true,interpolation:'spline',constantSpeed:true,tempo:{referenceBpm:120,flightSpeed:true}},
  controls:{rigMode:bind('cameraMode'),motionSpeed:bind('cameraSpeed'),motionAmount:bind('cameraAmount'),masterMotionAmount:bind('motionAmount'),motionSafety:bind('motionSafety'),tempoSync:bind('bpmSync'),fovDegrees:bind('fov')},
  smoothingMs:150,safety:{minPosition:vec3(-15,-10,-15),maxPosition:vec3(15,10,15),maxPositionOffset:vec3(.15,.15,.15),minFovDegrees:30,maxFovDegrees:85,minNear:.12,maxFar:60}}],
 variations,
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
 ]},
 lighting:{lights:[{id:lightId('ambient'),type:'ambient',color:color(.75,.78,.85),intensity:.15},{id:lightId('key'),type:'directional',color:color(1,.92,.85),intensity:.7,transform:{position:vec3(4,6,3)},targetNode:cinema2Ref(ROOT_NODE_ID)},{id:lightId('rim'),type:'directional',color:color(.6,.7,1),intensity:.45,transform:{position:vec3(-4,2,-4)},targetNode:cinema2Ref(ROOT_NODE_ID)}]},
 environment:{backgroundColor:PALETTE.background,exposure:1,controls:{backgroundColor:bind('background')}},
 effects:[
  {id:ATMOSPHERE_EFFECT_ID,typeId:CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID,version:1,enabled:true,order:0,scope:'output',parameters:{mix:.18,density:.024,beamIntensity:0,mistAmount:0,floorReflection:0,anisotropy:.2,occlusion:.8,ambientHaze:.025,noiseScale:.3,hazeColor:PALETTE.hazeTint,noiseStrength:.12,drift:.025,maxDistance:30,reactivity:0},parameterBindings:{mix:bind('haze'),hazeColor:bind('hazeTint')}},
  {id:BLOOM_EFFECT_ID,typeId:CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,version:1,enabled:true,order:1,scope:'output',parameters:{mix:1,threshold:1.05,knee:.35,intensity:.65,spread:.32,levels:4,clampMax:12},parameterBindings:{intensity:bind('bloom')}},
  {id:FINISH_EFFECT_ID,typeId:CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,version:1,enabled:true,order:2,scope:'output',parameters:{mix:1,toneMap:1,exposure:1,contrast:1.08,saturation:1,vignette:.17,vignetteSoftness:.7,grain:0,aberration:.05},parameterBindings:{aberration:bind('aberration')}},
 ],
 render:{targets:[viewportTarget(SCENE_TARGET_ID,true),viewportTarget(ATMOSPHERE_TARGET_ID),viewportTarget(BLOOM_TARGET_ID)],passes:[{id:SCENE_PASS_ID,kind:'scene',layers:[cinema2Ref(WORLD_LAYER_ID)],outputs:[{id:SCENE_COLOR_ID,target:cinema2Ref(SCENE_TARGET_ID),attachment:'color'},{id:SCENE_DEPTH_ID,target:cinema2Ref(SCENE_TARGET_ID),attachment:'depth'}]},effectPass(ATMOSPHERE_PASS_ID,SCENE_PASS_ID,SCENE_COLOR_ID,ATMOSPHERE_EFFECT_ID,'atmosphere',ATMOSPHERE_TARGET_ID,true),effectPass(BLOOM_PASS_ID,ATMOSPHERE_PASS_ID,slotId('atmosphere-output'),BLOOM_EFFECT_ID,'bloom',BLOOM_TARGET_ID,false),effectPass(FINISH_PASS_ID,BLOOM_PASS_ID,slotId('bloom-output'),FINISH_EFFECT_ID,'finish',null,false)],outputPass:cinema2Ref(FINISH_PASS_ID)},
 output:{renderPass:cinema2Ref(FINISH_PASS_ID),colorSpace:'srgb',alphaMode:'opaque'},
}
const mod=(name:string)=>cinema2AutoTargets.module(`${key}-system`,name)
const drives:Cinema2MoodDrive[]=[
 {id:'rotation-activity',target:mod('rotationSpeed'),source:'mood.activity',operation:'multiply',value:1.4},
 {id:'pulse-momentum',target:mod('pulseSpeed'),source:'mood.momentum',operation:'multiply',value:1.6},
 {id:'spacing-tension',target:mod('layerSeparation'),source:'mood.tension',operation:'multiply',value:.7},
 {id:'length-build',target:mod('pulseLength'),source:'mood.build',operation:'multiply',value:1.4},
 {id:'bloom-brightness',target:cinema2AutoTargets.effect(`${key}-bloom`,'intensity'),source:'mood.brightness',operation:'add',value:.25},
 {id:'axis-complexity',target:mod('axisVariation'),source:'mood.complexity',operation:'add',value:.25},
 {id:'motion-calm',target:mod('motionAmount'),source:'mood.calm',operation:'multiply',value:.5},
 {id:'impact-shock',target:mod('impactFlash'),source:'mood.shock',operation:'add',value:.35},
 {id:'expansion-peak',target:mod('expansionRange'),source:'mood.peak',operation:'add',value:.2},
 {id:'pulse-silence',target:mod('pulseIntensity'),source:'mood.silence',operation:'multiply',value:.1},
]
export const CINEMA2_PULSE_CUBED_PRESET_MANIFEST=withCinema2MoodDrives(authored,{idPrefix:`${key}-auto`,enabledParameter:pid('autoPerformance'),strengthParameter:pid('reactivity'),patternControls:{patternChange:pid('patternChange'),trigger:pid('trigger')},drives})
