import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2ChoreographyActionId, type Cinema2ChoreographyContinuousSourcePath,
  type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest, type Cinema2DesignParentGroup,
  type Cinema2CameraId, type Cinema2EffectId, type Cinema2LayerId, type Cinema2MediaSlotId, type Cinema2ModuleId,
  type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest, type Cinema2PresetId,
  type Cinema2SceneNodeId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_EVERYWHERE_MODULE_TYPE_ID } from '../modules/Cinema2EverywhereNativeModule'
import { EVERYWHERE_COLORS, EVERYWHERE_PATTERNS } from '../modules/everywhere/Cinema2EverywhereWall'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { cinema2AutoTargets } from './Cinema2AutoPerformanceAuthoring'
import { everywhereCameraProfileRules } from '../modules/everywhere/Cinema2EverywhereCameraMotion'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'

export const CINEMA2_EVERYWHERE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.everywhere')
export const CINEMA2_EVERYWHERE_MEDIA_SLOT = cinema2StableId<Cinema2MediaSlotId>('everywhere-screen-media')
const id = (name: string) => cinema2StableId<Cinema2ParameterId>(`everywhere-${name}`)
const ref = (name: string) => cinema2Ref(id(name))
const auto = ref('auto-performance')
const bloom = cinema2StableId<Cinema2EffectId>('everywhere-bloom')

// All IDs are explicit to keep saved parameter values and scene bindings stable.
// The preset must not inherit Corridor's graph, capabilities or effect defaults.
const root = cinema2StableId<Cinema2SceneNodeId>('everywhere-root')
const wall = cinema2StableId<Cinema2SceneNodeId>('everywhere-passage')
const aim = cinema2StableId<Cinema2SceneNodeId>('everywhere-aim')
const layer = cinema2StableId<Cinema2LayerId>('everywhere-world')
const camera = cinema2StableId<Cinema2CameraId>('everywhere-camera')
const moduleId = cinema2StableId<Cinema2ModuleId>('everywhere-cassettes')
const finish = cinema2StableId<Cinema2EffectId>('everywhere-finish')

const base = (name: string,label: string,parent: Cinema2DesignParentGroup,group: string,order: number,description: string) => ({
  id:id(name),label,description,section:'Design' as const,designParentGroup:parent,group,order,
  exposure:'primary' as const,persistence:'preset' as const,reset:'authored-default' as const,
})
const slider = (name: string,label: string,parent: Cinema2DesignParentGroup,group: string,order: number,value: number,min: number,max: number,description: string):Cinema2ParameterManifest=>({
  ...base(name,label,parent,group,order,description),type:'float',defaultValue:value,min,max,step:.01,modulatable:true,choreographable:true,
})
const swatch = (name: keyof typeof EVERYWHERE_COLORS,label: string,order: number,description: string):Cinema2ParameterManifest=>({
  ...base(name,label,'palette','Wall Colors',order,description),type:'color',defaultValue:EVERYWHERE_COLORS[name],
})
const parameters: readonly Cinema2ParameterManifest[] = [
  CINEMA2_QUALITY_MODE_PARAMETER,
  slider('motion','Motion Amount','master-controls','Playback',1,.72,0,1,'Controls screen timing, wall movement and musical accents.'),
  {...base('bpm-sync','BPM Sync','master-controls','Playback',2,'Locks the screen program to the shared track tempo when Audio Dock sync is on.'),type:'boolean',defaultValue:true},
  {...base('auto-performance','Auto Performance','master-controls','Playback',3,'Lets the music drive the wall and follows System Settings on preset load.'),type:'boolean',defaultValue:false},
  slider('brightness','Screen Brightness','design','Cabinets',1,1.06,0,1.8,'Exposure of pictures on the CRT screens.'),
  slider('coverage','Screen Coverage','design','Cabinets',2,.86,.18,1,'Adjusts how many surrounding screens stay fully lit.'),
  slider('angle','Cabinet Angle','design','Cabinets',3,.84,0,1.25,'Sets how much the surrounding cabinets tilt and turn.'),
  {...base('pattern','Pattern','design','Pattern',20,'Choose a screen program for the whole wall.'),type:'enum',defaultValue:'all-eyes',options:EVERYWHERE_PATTERNS},
  {...base('pattern-change','Pattern Change','design','Pattern',21,'Advance the pattern on the selected shared musical event.'),type:'boolean',defaultValue:false},
  {...base('trigger','Trigger','design','Pattern',22,'Choose the musical event that advances the pattern.'),type:'enum',defaultValue:'bar4',
    options:CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,visibleWhen:[{kind:'parameter-equals',parameterId:id('pattern-change'),value:true}]},
  {...base('screen-media','Screen Media','design','Screen Media',30,'Select a feed in the Source tab’s Media Library.'),type:'media',defaultValue:null,mediaSlot:cinema2Ref(CINEMA2_EVERYWHERE_MEDIA_SLOT)},
  {...base('media-layout','Media Layout','design','Screen Media',31,'Repeat the same picture on each television or spread it across the whole wall.'),type:'enum',
    defaultValue:'choreographed',options:[{value:'choreographed',label:'Choreographed distribution'},{value:'repeat',label:'Repeat on each screen'},{value:'wall',label:'Span the wall'}]},
  {...base('pool-trigger','Pool Trigger','design','Screen Media',33,'Choose when the active media pool advances, independently of Pattern Change. Program uses the current pattern’s authored musical cadence.'),type:'enum',defaultValue:'program',options:[{value:'program',label:'Program cadence'},...CINEMA2_AFTERHOURS_TRIGGER_OPTIONS]},
  {...base('media-fit','Media Fit','design','Screen Media',32,'Contain preserves complete wordmarks; Cover crops; Fill stretches.'),type:'enum',defaultValue:'contain',options:[{value:'contain',label:'Contain'},{value:'cover',label:'Cover'},{value:'stretch',label:'Fill'}]},
  slider('content-motion','Content Motion','design','Screen Media',34,.75,0,1,'Strength of motion inside each CRT.'),
  slider('scale-variation','Scale Variation','design','Screen Media',35,.6,0,1,'Independent media scale variations.'),
  {...base('screen-power','Screen Power Choreography','design','Screen Media',36,'Allow individual screens to switch off in the pattern.'),type:'boolean',defaultValue:true},
  {...base('hero-readability','Preserve Hero Readability','design','Screen Media',37,'Keep the central screen lit and restrain its distortion.'),type:'boolean',defaultValue:true},
  {...base('camera-motion','Camera Motion','design','Camera',5,'Enable the shared cinematic camera.'),type:'boolean',defaultValue:true},
  {...base('camera-mode','Camera Mode','design','Camera',6,'Choose a cinematic movement profile.'),type:'enum',defaultValue:'cinematic',options:[{value:'cinematic',label:'Cinematic'},{value:'pattern',label:'Pattern Driven'},{value:'hero',label:'Hero Focus'},{value:'explore',label:'Wall Exploration'},{value:'gentle',label:'Gentle Sway'}],visibleWhen:[{kind:'parameter-equals',parameterId:id('camera-motion'),value:true}]},
  {...base('camera-distance','Camera Distance','design','Camera',7,'Distance from the CRT installation.'),type:'vec3',defaultValue:[0,0,0],min:-3,max:3,step:.1},
  {...slider('camera-sway','Camera Sway','design','Camera',8,.45,0,1,'Shared cinematic drift and beat sway.'),visibleWhen:[{kind:'parameter-equals',parameterId:id('camera-motion'),value:true}]},
  {...slider('camera-impact','Drop Impact','design','Camera',9,.7,0,1,'Strength of build, drop and phrase camera accents.'),visibleWhen:[{kind:'parameter-equals',parameterId:id('camera-motion'),value:true}]},
  {...slider('camera-roll','Camera Roll','design','Camera',10,.2,0,1,'Strength of musical banking.'),visibleWhen:[{kind:'parameter-equals',parameterId:id('camera-motion'),value:true}]},
  {...base('kick-zoom','Zoom on Kick','design','Camera',11,'Optional additional rhythmic lens punch.'),type:'boolean',defaultValue:false,visibleWhen:[{kind:'parameter-equals',parameterId:id('camera-motion'),value:true}]},
  {...base('camera-follow','Follow Screen Choreography','design','Camera',12,'Use the selected pattern to direct camera accents.'),type:'boolean',defaultValue:true,visibleWhen:[{kind:'parameter-equals',parameterId:id('camera-motion'),value:true}]},
  slider('bloom','Bloom','effects','CRT Finish',1,.34,0,1.2,'Optical glow around the brightest screen and cabinet highlights.'),
  slider('scan','Scanlines','effects','CRT Finish',2,.20,0,1,'Strength of the fine CRT raster.'),
  slider('glare','Glass Glare','effects','CRT Finish',3,.65,0,1,'Intensity of the glass reflection and recessed lip highlights.'),
  swatch('background','Background',1,'Shadow color visible only in narrow seams between cabinets.'),
  swatch('cabinet','Cabinet',2,'Base color of the molded television cases.'),
  swatch('cool','Cool Rim',3,'Color of the light along the left edges.'),
  swatch('warm','Warm Rim',4,'Color of the warm light along the opposite edges.'),
  swatch('screen','Screen Tint',5,'Color balance of the default and assigned screen feeds.'),
]
const bindings = {
  motion:ref('motion'), bpmSync:ref('bpm-sync'), autoPerformance:auto, brightness:ref('brightness'),
  coverage:ref('coverage'), angle:ref('angle'), pattern:ref('pattern'), patternChange:ref('pattern-change'),
  trigger:ref('trigger'), poolTrigger:ref('pool-trigger'), mediaLayout:ref('media-layout'),mediaFit:ref('media-fit'),contentMotion:ref('content-motion'),scaleVariation:ref('scale-variation'),screenPower:ref('screen-power'),heroReadability:ref('hero-readability'), scan:ref('scan'), glare:ref('glare'),
  background:ref('background'),cabinet:ref('cabinet'),cool:ref('cool'),warm:ref('warm'),screen:ref('screen'),
}
const defaults=Object.fromEntries(Object.entries(bindings).map(([key,binding])=>[key,parameters.find(parameter=>parameter.id===binding.$ref)!.defaultValue]))
const ruleId = (name: string) => cinema2StableId<Cinema2ChoreographyRuleId>(`everywhere-${name}`)
const actionId = (name: string) => cinema2StableId<Cinema2ChoreographyActionId>(`everywhere-${name}`)
const route = (name: string,path: Cinema2ChoreographyContinuousSourcePath,capability: 'audio.features'|'audio.bands'|'visual-director.significance',smoothingMs: number):Cinema2ChoreographyRuleManifest=>({
  id:ruleId(name),priority:15,enabledParameter:auto,source:{signal:'continuous',path,capability,clamp:[0,1],smoothingMs},
  conditions:[{kind:'not-silent'}],actions:[{id:actionId(`read-${name}`),target:{kind:'module',ref:cinema2Ref(moduleId),property:name},operation:'replace'}],
})
const event = (name: 'kick'|'snare'|'drop',hold: number,release: number):Cinema2ChoreographyRuleManifest=>({
  id:ruleId(name),priority:35,enabledParameter:auto,source:{signal:name,capability:name==='drop'?'music.drop':'music.rhythm-events'},
  conditions:[{kind:'once-per-event'},...(name==='drop'?[]:[{kind:'not-silent' as const}])],
  actions:[{id:actionId(`pulse-${name}`),target:{kind:'module',ref:cinema2Ref(moduleId),property:name},operation:'envelope',
    value:1,envelope:{attack:.016,hold,release,unit:'seconds'},retrigger:'restart'}],
})

const manifest: Cinema2NativePresetManifest = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_EVERYWHERE_PRESET_ID,
  revision: 1,
  metadata: {
    name: 'EVERYWHERE', author: 'STAGELESS', category: 'Architecture',
    description: 'An edge-to-edge wall of modeled CRTs with an eye feed, replaceable user media, named pools and twelve musical screen programs.',
    tags: ['3d', 'televisions', 'media-wall', 'screens', 'audio-reactive'],
  },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Instanced 3D television cabinets and per-screen CRT shaders.' },
    { id: 'render.depth', requirement: 'required', purpose: 'Correct occlusion between the staggered television cabinets.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Frontal perspective with depth and parallax across the CRT wall.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'Independent cabinets, screen surfaces and colored rim lights.' },
    { id: 'audio.bands', requirement: 'optional', purpose: 'Bass and highs drive screen displacement and interference.' },
    { id: 'audio.features', requirement: 'optional', purpose: 'Energy and vocal presence control exposure and hero focus.' },
    { id: 'music.beat', requirement: 'optional', purpose: 'Beat-synchronized channel patterns and screen motion.' },
    { id: 'music.rhythm-events', requirement: 'optional', purpose: 'Kick and snare accents on the television screens.' },
    { id: 'music.phrase', requirement: 'optional', purpose: 'Phrase-boundary camera reveals.' },
    { id: 'music.drop', requirement: 'optional', purpose: 'Drop events send a radial burst across the wall.' },
    { id: 'visual-director.significance', requirement: 'optional', purpose: 'Build sections pull attention toward the center screen.' },
    { id: 'media.image', requirement: 'optional', purpose: 'Images from the shared Media Library.' },
    { id: 'media.video', requirement: 'optional', purpose: 'Video from the shared Media Library.' },
    { id: 'media.svg', requirement: 'optional', purpose: 'SVG from the shared Media Library.' },
  ],
  parameters,
  mediaSlots: [{ id: CINEMA2_EVERYWHERE_MEDIA_SLOT, label: 'Screen Media', accepts: ['image', 'video', 'svg'] }],
  modules: [{
    id: moduleId, typeId: CINEMA2_EVERYWHERE_MODULE_TYPE_ID, version: 1,
    parameters: { ...defaults, energy: 0, bass: 0, high: 0, vocal: 0, build: 0, kick: 0, snare: 0, drop: 0 },
    parameterBindings: bindings, media: { screenMedia: cinema2Ref(CINEMA2_EVERYWHERE_MEDIA_SLOT) },
  }],
  scene: {
    nodes: [
      { id: root, kind: 'group', coordinateSpace: 'world' },
      { id: wall, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(moduleId) },
      { id: aim, kind: 'group', parent: cinema2Ref(root), transform: { position: [0, 0, 0] } },
    ],
    roots: [cinema2Ref(root)],
  },
  layers: [{ id: layer, label: 'CRT Wall', source: cinema2Ref(root), role: 'world', depthPolicy: 'read-write', order: 0 }],
  cameras: [{
    id: camera, label: 'Front Wall', projection: 'perspective', fovDegrees: 40,
    near: 0.2, far: 60, transform: { position: [0, 0, 14] },
    targetNode: cinema2Ref(aim), rig: { kind: 'static' },
    motion:{idleMotion:true,drift:{position:.85,target:.18,rollDegrees:.45,fovDegrees:.35,speed:.065,seed:4512},tempo:{referenceBpm:120,weave:.85,bob:.12,roll:.5,fov:.35,punch:0},fovRateLimitDegreesPerSecond:18},
    controls:{motionEnabled:ref('camera-motion'),motionAmount:ref('camera-sway'),masterMotionAmount:ref('motion'),tempoSync:ref('bpm-sync'),positionOffset:ref('camera-distance')},
    smoothingMs:140,safety:{minPosition:[-2,-1.3,9],maxPosition:[2,1.3,17],maxPositionOffset:[2,1.3,5],maxTargetOffset:[1.2,.65,.2],minFovDegrees:29,maxFovDegrees:41,minNear:.2,maxFar:60},
  }],
  environment: { backgroundColor: EVERYWHERE_COLORS.background, exposure: 1, controls: { backgroundColor: ref('background') } },
  effects: [
    { id: bloom, typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID, version: 1, enabled: true, order: 0, scope: 'output',
      parameters: { mix: 1, threshold: 1.25, knee: 0.29, intensity: 0.34, spread: 0.32, levels: 5, clampMax: 12, tint: [1, 0.91, 0.81, 1] },
      parameterBindings: { intensity: ref('bloom') } },
    { id: finish, typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID, version: 1, enabled: true, order: 1, scope: 'output',
      parameters: { mix: 0.46, exposure: 1.02, contrast: 1.08, saturation: 1.05, vignette: 0.08, grain: 0, aberration: 0 } },
  ],
  choreography: { tempoSyncParameter: ref('bpm-sync'), rules: [
    route('energy', 'audio.features.overallEnergy', 'audio.features', 145),
    route('bass', 'audio.bands.bass', 'audio.bands', 95),
    route('high', 'audio.bands.high', 'audio.bands', 70),
    route('vocal', 'audio.features.vocalPresence', 'audio.features', 207),
    route('build', 'director.build', 'visual-director.significance', 140),
    event('kick', 0.04, 0.24), event('snare', 0.018, 0.21), event('drop', 0.17, 1.02),
    ...everywhereCameraProfileRules(camera),
  ] },
}

export const CINEMA2_EVERYWHERE_PRESET_MANIFEST = withCinema2MoodDrives(manifest,{
  idPrefix:'everywhere-auto',enabledParameter:id('auto-performance'),strengthParameter:id('motion'),
  patternControls:{patternChange:id('pattern-change'),trigger:id('trigger')},
  drives:[
    {id:'coverage-activity',target:cinema2AutoTargets.module(moduleId,'coverage'),source:'mood.activity',operation:'add',value:.18},
    {id:'coverage-silence',target:cinema2AutoTargets.module(moduleId,'coverage'),source:'mood.silence',operation:'add',value:-.47},
    {id:'brightness-activity',target:cinema2AutoTargets.module(moduleId,'brightness'),source:'mood.activity',operation:'add',value:.20},
    {id:'bloom-peak',target:cinema2AutoTargets.effect(bloom,'intensity'),source:'mood.peak',operation:'add',value:.22},
    {id:'bloom-silence',target:cinema2AutoTargets.effect(bloom,'intensity'),source:'mood.silence',operation:'add',value:-.20},
  ],
})
