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
import { type Profile, PROFILES, controls, defaults as makeDefaults, palette as makePalette, paletteKeys, hex, slug, patterns } from '../modules/chromaverse/ChromaverseDomain'
import { chromaverseModuleTypeId } from '../modules/Cinema2ChromaverseNativeModule'
import type { Cinema2ParameterManifest } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ChoreographyContinuousSourcePath } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2MoodDrive } from './Cinema2MoodConductorAuthoring'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'

export function createChromaverseManifest(profile:Profile):Readonly<Cinema2NativePresetManifest>{
const key=`chromaverse-${profile.key}`,name=profile.name, MODULE_ID=cinema2StableId<Cinema2ModuleId>(`${key}-system`)
const id=cinema2NamespacedId<Cinema2PresetId>(`drmvyz.cinema2.${key}`)
const PALETTE=makePalette(profile),defaults=makeDefaults(profile),PULSE_CONTROLS=controls(profile),PULSE_PATTERN_OPTIONS=profile.patterns.map(label=>({value:slug(label),label}))
const CAMERA_ID=cinema2StableId<Cinema2CameraId>(`${key}-camera`)
const pulseParameterId=(name:string)=>cinema2StableId<Cinema2ParameterId>(`${key}-${name.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)}`)
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
  toggle('bpmSync','BPM Sync','Synchronize native and source clip timing with the shared beat clock.',true,'master-controls','Performance',2),
  choice('motionSafety','Motion Safety','Reduce motion or hold the sculpture and camera.', profile.key==='time-tunnel'?'reduced':'full',[{value:'full',label:'Full Motion'},{value:'reduced',label:'Reduced Motion'},{value:'lockoff',label:'Lock Off'}],'master-controls','Performance',3),
  choice('flashAccents','Flash Accents','Limit rapid illumination changes.',profile.key==='time-tunnel'?'off':'reduced',[{value:'off',label:'Off'},{value:'reduced',label:'Reduced'},{value:'full',label:'Full'}],'master-controls','Performance',4),
  choice('pattern','Pattern','Choose a native sculpture performance pattern.',patterns(profile)[0]!,PULSE_PATTERN_OPTIONS,'design','Pattern',1),
  toggle('patternChange','Pattern Change','Advance the runtime pattern on a fresh qualifying event.',false,'design','Pattern',2),
  {...choice('trigger','Trigger','Shared musical event that advances the pattern.','bar4',CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,'design','Pattern',3),visibleWhen:[{kind:'parameter-equals',parameterId:pid('patternChange'),value:true}]},
  choice('transitionLength','Transition Length','Length of the eased pattern crossfade, measured in beats.','1',[{value:'0',label:'Instant'},{value:'.5',label:'½ Beat'},{value:'1',label:'1 Beat'},{value:'2',label:'2 Beats'},{value:'4',label:'4 Beats'}],'design','Pattern',4),
  choice('cameraMode','Camera Motion','Select a cinematic camera path.','float',[{value:'static',label:'Static'},{value:'float',label:'Float'},{value:'orbit',label:'Orbit'},{value:'dolly',label:'Dolly'}],'design','Camera',1),
  ...PULSE_CONTROLS.map(([k,label,value,min,max,step,parent,group],i)=>scalar(k,label,`${label} of ${name}.`,value,min,max,step,parent,group,i+10)),
  ...paletteKeys.map((k,i)=>colorParameter(pid(k),profile.paletteLabels[i]??'Atmosphere',`Independent ${profile.paletteLabels[i]??'Atmosphere'} color.`,PALETTE[k],i+1)),
]
const effectKeys=new Set(['bloom','haze','aberration','hazeTint','background'])
const cameraKeys=new Set(['cameraSpeed','cameraAmount','fov'])
const moduleKeys=['autoPerformance','bpmSync','motionSafety','flashAccents','pattern','patternChange','trigger','transitionLength',...Object.keys(PALETTE).filter(k=>!effectKeys.has(k)),...Object.keys(defaults).filter(k=>parameters.some(p=>p.id===pid(k))&&!effectKeys.has(k)&&!cameraKeys.has(k))]
// Native variations preserve the seven editable color roles; they are never selected by mood.
const paletteRecipes = [
 ['Original DNA',profile.colors.join(' ')+' '+profile.colors[4]],
 ['Ultraviolet','5934DF A348FF F043D0 E0C2FF 09041C 2D0C46'],
 ['Cyber Acid','42FF12 CEFF35 16EBD8 E1FFCF 03110B 142C16'],
 ['Solar Flare','B91F41 FF572E FFBA36 FFF0BA 160408 42130B'],
 ['Cryogenic','174F9C 1DCBE8 9FE6FF E9FFFF 030D1B 0C203B'],
 ['Infrared','760C27 D92D55 FF326F FFA4B8 100206 391525'],
 ['Prismatic','ED3D82 9B45FA 29A7FF 26E0AC 080410 27153A'],
 ['Monochrome','E0E0E0 909090 B4B4B4 FFFFFF 050505 222222'],
] as const
const variations=paletteRecipes.map(([label,recipe])=>({id:cinema2StableId<Cinema2VariationId>(`${key}-${slug(label)}`),label,parameterValues:Object.fromEntries(paletteKeys.map((k,i)=>[pid(k),hex(recipe.split(' ')[i]!) ]))}))
const FOCUS=vec3(0,0,0),home=vec3(...profile.camera)
const shot=(p:readonly [number,number,number])=>({position:vec3(...p),target:FOCUS})
const [x,y,z]=home, sway=profile.key==='alter-ego'?.14:profile.interior?.22:.65
const path=[home,vec3(x+sway,y+sway*.45,z+.15),vec3(x-sway,y-sway*.25,z+.25),home].map(shot)
const dolly=[home,vec3(x*.95,y*.95,z*.94),vec3(x*1.06,y*1.06,z*1.08),home].map(shot)
const sweep=[home,vec3(x+sway*2,y+sway,z+.3),vec3(x-sway*2,y+sway*.5,z+.3),home].map(shot)
const authored:Readonly<Cinema2NativePresetManifest>={
 schemaId:CINEMA2_NATIVE_PRESET_SCHEMA_ID,schemaVersion:CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,id,revision:1,
 metadata:{name,description:profile.description+(profile.key==='time-tunnel'?' • Photosensitivity warning: optical patterns may affect susceptible viewers.':''),tags:['3d','chromaverse','kinetic','audio-reactive',profile.key]},
 capabilities:[{id:'render.webgl2',requirement:'required',purpose:'Supplied GLB geometry, source materials and native animation.'},{id:'render.depth',requirement:'required',purpose:'World depth and atmospheric occlusion.'},{id:'scene.3d',requirement:'required',purpose:'Source-specific spatial scene and semantic choreography.'},{id:'camera.world',requirement:'required',purpose:'Shared cinematic camera.'},{id:'lighting',requirement:'required',purpose:'Shared lighting and environment reflections.'},{id:'render.hdr',requirement:'optional',purpose:'HDR emissive bloom.'},...(['audio.transport','audio.features','audio.bands','music.beat','music.rhythm-events','music.downbeat','music.bar','music.phrase','music.section','music.vocal-presence','music.build','music.drop','visual-director.significance'] as const).map(id=>({id,requirement:'optional' as const,purpose:'Shared music intelligence and event-driven choreography.'}))],
 parameters,
 modules:[{id:MODULE_ID,typeId:chromaverseModuleTypeId(profile),version:1,enabled:true,
  parameters:{...Object.fromEntries(Object.entries(defaults).filter(([k])=>!effectKeys.has(k)&&!cameraKeys.has(k))),...Object.fromEntries(moduleKeys.map(key=>[key,parameters.find(p=>p.id===pid(key))!.defaultValue!])),},
  parameterBindings:Object.fromEntries(moduleKeys.map(key=>[key,bind(key)]))}],
 scene:{nodes:[{id:ROOT_NODE_ID,kind:'group',coordinateSpace:'world'},{id:MODEL_NODE_ID,kind:'module',parent:cinema2Ref(ROOT_NODE_ID),module:cinema2Ref(MODULE_ID)}],roots:[cinema2Ref(ROOT_NODE_ID)]},
 layers:[{id:WORLD_LAYER_ID,label:`${name} Sculpture`,source:cinema2Ref(ROOT_NODE_ID),role:'world',depthPolicy:'read-write',order:0}],
 cameras:[{id:CAMERA_ID,label:`${name} Cinematic Camera`,projection:'perspective',fovDegrees:42,minAspect:1,minAspectAnchor:0,near:.12,far:60,transform:{position:home},target:FOCUS,
  rig:{kind:'path',points:path,durationSeconds:24,loop:true},rigVariants:{static:{kind:'static'},float:{kind:'path',points:path,durationSeconds:24,loop:true},orbit:{kind:'path',points:sweep,durationSeconds:32,loop:true},dolly:{kind:'path',points:dolly,durationSeconds:20,loop:true}},
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
 {id:'flow-momentum',target:mod('flowSpeed'),source:'mood.momentum',operation:'multiply',value:profile.interior?1.8:1.6},
 {id:'spacing-tension',target:mod('separation'),source:'mood.tension',operation:'multiply',value:profile.key==='alter-ego'?1.4:.7},
 {id:'expansion-build',target:mod('expansion'),source:'mood.build',operation:'multiply',value:.65},
 {id:'bloom-brightness',target:cinema2AutoTargets.effect(`${key}-bloom`,'intensity'),source:'mood.brightness',operation:'add',value:.18},
 {id:'width-complexity',target:mod('width'),source:'mood.complexity',operation:'add',value:.22},
 {id:'motion-calm',target:mod('motionAmount'),source:'mood.calm',operation:'multiply',value:.5},
 {id:'impact-shock',target:mod('impactFlash'),source:'mood.shock',operation:'add',value:profile.key==='time-tunnel'?0:.12},
 {id:'expansion-peak',target:mod('expansion'),source:'mood.peak',operation:'add',value:.2},
 {id:'glow-silence',target:mod('glow'),source:'mood.silence',operation:'multiply',value:.15},
]
return withCinema2MoodDrives(authored,{idPrefix:`${key}-auto`,enabledParameter:pid('autoPerformance'),strengthParameter:pid('reactivity'),patternControls:{patternChange:pid('patternChange'),trigger:pid('trigger')},drives})
}
export const CHROMAVERSE_PRESET_MANIFESTS=PROFILES.map(createChromaverseManifest)
