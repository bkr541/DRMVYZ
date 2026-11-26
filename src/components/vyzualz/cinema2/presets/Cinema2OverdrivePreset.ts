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
import { CINEMA2_OVERDRIVE_MODULE_TYPE_ID } from '../modules/Cinema2OverdriveNativeModule'
import { OVERDRIVE_COLORS, OVERDRIVE_PATTERNS } from '../modules/overdrive/OverdriveScene'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { cinema2AutoTargets } from './Cinema2AutoPerformanceAuthoring'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'

export const CINEMA2_OVERDRIVE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.overdrive')
export const CINEMA2_OVERDRIVE_MEDIA_SLOT = cinema2StableId<Cinema2MediaSlotId>('overdrive-core-media')
const id = (name: string) => cinema2StableId<Cinema2ParameterId>(`overdrive-${name}`)
const ref = (name: string) => cinema2Ref(id(name))
const auto = ref('auto-performance')
const bloom = cinema2StableId<Cinema2EffectId>('overdrive-bloom')

// All IDs are explicit to keep saved parameter values and scene bindings stable.
// All mechanical scene and effect defaults are local to OVERDRIVE.
const root = cinema2StableId<Cinema2SceneNodeId>('overdrive-root')
const wall = cinema2StableId<Cinema2SceneNodeId>('overdrive-chamber')
const aim = cinema2StableId<Cinema2SceneNodeId>('overdrive-aim')
const layer = cinema2StableId<Cinema2LayerId>('overdrive-world')
const camera = cinema2StableId<Cinema2CameraId>('overdrive-camera')
const moduleId = cinema2StableId<Cinema2ModuleId>('overdrive-machine')
const finish = cinema2StableId<Cinema2EffectId>('overdrive-finish')

const base = (name: string,label: string,parent: Cinema2DesignParentGroup,group: string,order: number,description: string) => ({
  id:id(name),label,description,section:'Design' as const,designParentGroup:parent,group,order,
  exposure:'primary' as const,persistence:'preset' as const,reset:'authored-default' as const,
})
const slider = (name: string,label: string,parent: Cinema2DesignParentGroup,group: string,order: number,value: number,min: number,max: number,description: string):Cinema2ParameterManifest=>({
  ...base(name,label,parent,group,order,description),type:'float',defaultValue:value,min,max,step:.01,modulatable:true,choreographable:true,
})
const swatch = (name: keyof typeof OVERDRIVE_COLORS,label: string,order: number,description: string):Cinema2ParameterManifest=>({
  ...base(name,label,'palette','Machine Palette',order,description),type:'color',defaultValue:OVERDRIVE_COLORS[name],
})
const enumParam = (name:string,label:string,group:string,order:number,value:string,options:readonly {value:string;label:string}[],description:string):Cinema2ParameterManifest => ({...base(name,label,'design',group,order,description),type:'enum',defaultValue:value,options})
const parameters: readonly Cinema2ParameterManifest[] = [
  CINEMA2_QUALITY_MODE_PARAMETER,
  slider('intensity','Master Intensity','master-controls','Playback',1,.85,0,2,'Overall machine illumination.'),
  slider('reactivity','Reactivity','master-controls','Playback',2,.75,0,1,'Strength of shared musical modulation.'),
  slider('motion','Motion Amount','master-controls','Playback',3,.65,0,1,'Limits mechanical motion.'),
  {...base('bpm-sync','BPM Sync','master-controls','Playback',4,'Synchronizes motion to the shared beat clock.'),type:'boolean',defaultValue:true},
  {...base('auto-performance','Auto Performance','master-controls','Playback',5,'Uses the shared Mood Conductor and System Settings default.'),type:'boolean',defaultValue:false},
  enumParam('pattern','Pattern','Pattern',1,'core-lock',OVERDRIVE_PATTERNS,'Choose the mechanical program.'),
  {...base('pattern-change','Pattern Change','design','Pattern',2,'Advance on the selected shared musical event.'),type:'boolean',defaultValue:false},
  {...enumParam('trigger','Trigger','Pattern',3,'bar4',CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,'Musical event that advances the pattern.'),visibleWhen:[{kind:'parameter-equals',parameterId:id('pattern-change'),value:true}]},
  slider('size','Core Size','design','Core',1,1,.7,1.35,'Scale of the ribbed sphere.'),
  slider('separation','Segment Separation','design','Core',2,.02,0,1,'Distance between physical ribs.'),
  slider('rotation','Motion Rate','design','Mechanics',1,.35,0,1.5,'Angular speed of mechanical rings.'),
  slider('compression','Compression','design','Mechanics',2,.15,0,1,'Radial position of the machinery.'),
  slider('piston','Piston Travel','design','Mechanics',3,.35,0,1,'Telescoping shaft movement.'),
  slider('speaker','Speaker Displacement','design','Mechanics',4,.45,0,1,'Acoustic diaphragm excursion.'),
  slider('aperture','Aperture','design','Mechanics',5,.2,0,1,'Mechanical shutter opening.'),
  slider('relay','Energy Flow','design','Mechanics',6,.5,0,1,'Conduit illumination and traveling energy.'),
  enumParam('mode','Content Mode','Core Display',1,'auto',[{value:'auto',label:'Automatic source'},{value:'procedural',label:'Procedural'},{value:'waveform',label:'Waveform'},{value:'text',label:'Text'},{value:'media',label:'Media'},{value:'pool',label:'Pool'}],'Source for the spherical display.'),
  enumParam('style','Display Style','Core Display',2,'led',[{value:'led',label:'Micro LED'},{value:'raster',label:'Raster'},{value:'color',label:'Full Color'}],'Physical display sampling style.'),
  {...base('text','Display Text','design','Core Display',3,'Short custom lettering.'),type:'string',defaultValue:'OVERDRIVE',visibleWhen:[{kind:'parameter-equals',parameterId:id('mode'),value:'text'}]},
  {...base('core-media','Core Media','design','Core Display',4,'Choose an image, SVG or video in Source.'),type:'media',defaultValue:null,mediaSlot:cinema2Ref(CINEMA2_OVERDRIVE_MEDIA_SLOT)},
  enumParam('pool-trigger','Pool Trigger','Core Display',5,'bar4',CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,'Independent media pool cadence.'),
  slider('media-scale','Display Scale','design','Core Display',6,1,.5,1.5,'Scale content on the curved screen.'),
  slider('media-rotation','Display Rotation','design','Core Display',7,0,-180,180,'Rotate content on the screen.'),
  slider('camera-motion','Camera Motion','design','Camera',1,.25,0,1,'Subtle bounded camera drift.'),
  slider('camera-orbit','Orbit Angle','design','Camera',2,0,-8,8,'Rotate the viewpoint around the front of the core.'),
  slider('camera-distance','Camera Distance','design','Camera',3,10.1,9.4,10.9,'Dolly within the enclosed chamber.'),
  slider('brightness','LED Intensity','effects','Lighting',1,1.1,0,2,'Emission from the pixel matrix. In Full Color media mode this is source exposure (1 = original RGB), independent of reactive machine illumination except Blackout.'),
  slider('key','Key Lighting','effects','Lighting',2,.7,0,2,'Cool key and rim illumination.'),
  slider('spill','Core Light Spill','effects','Lighting',3,.65,0,1.5,'Local point lighting from the core.'),
  slider('roughness','Metal Roughness','effects','Materials',1,.32,.12,.9,'Changes the metallic specular lobe.'),
  slider('reflection','Reflection','effects','Materials',2,.65,0,1.5,'Environment reflection intensity.'),
  slider('detail','Carbon Detail','effects','Materials',3,1,0,1,'Carbon-fiber texture visibility.'),
  slider('bloom','Bloom','effects','Finish',1,.30,0,1.2,'HDR bloom around emissive components.'),
  slider('finish','Cinematic Finish','effects','Finish',2,.46,0,1,'Mix of cinematic grading.'),
  ...Object.entries({background:'Background',metal:'Primary Metal',titanium:'Titanium',carbon:'Carbon Fiber',core:'Core Emission',conduit:'Energy Conduits',rim:'Rim Light',accent:'Impact Accent'}).map(([key,label],i)=>swatch(key as keyof typeof OVERDRIVE_COLORS,label,i+1,`Color of ${label.toLowerCase()}.`)),
]
const bindings = {
  intensity:ref('intensity'),motion:ref('motion'),bpmSync:ref('bpm-sync'),autoPerformance:auto,
  pattern:ref('pattern'),patternChange:ref('pattern-change'),trigger:ref('trigger'),poolTrigger:ref('pool-trigger'),
  size:ref('size'),separation:ref('separation'),rotation:ref('rotation'),compression:ref('compression'),piston:ref('piston'),speaker:ref('speaker'),aperture:ref('aperture'),relay:ref('relay'),
  mode:ref('mode'),style:ref('style'),text:ref('text'),mediaScale:ref('media-scale'),mediaRotation:ref('media-rotation'),
  brightness:ref('brightness'),key:ref('key'),spill:ref('spill'),roughness:ref('roughness'),reflection:ref('reflection'),detail:ref('detail'),
  background:ref('background'),metal:ref('metal'),titanium:ref('titanium'),carbon:ref('carbon'),core:ref('core'),conduit:ref('conduit'),rim:ref('rim'),accent:ref('accent'),
}
const defaults=Object.fromEntries(Object.entries(bindings).map(([key,binding])=>[key,parameters.find(parameter=>parameter.id===binding.$ref)!.defaultValue]))
const ruleId = (name: string) => cinema2StableId<Cinema2ChoreographyRuleId>(`overdrive-${name}`)
const actionId = (name: string) => cinema2StableId<Cinema2ChoreographyActionId>(`overdrive-${name}`)
const route = (name: string,path: Cinema2ChoreographyContinuousSourcePath,capability: 'audio.features'|'audio.bands'|'visual-director.significance',smoothingMs: number):Cinema2ChoreographyRuleManifest=>({
  id:ruleId(name),priority:15,strengthParameter:ref('reactivity'),source:{signal:'continuous',path,capability,clamp:[0,1],smoothingMs},
  conditions:[{kind:'not-silent'}],actions:[{id:actionId(`read-${name}`),target:{kind:'module',ref:cinema2Ref(moduleId),property:name},operation:'replace'}],
})
const event = (name: 'kick'|'snare'|'drop'|'beat'|'phrase',hold: number,release: number):Cinema2ChoreographyRuleManifest=>({
  id:ruleId(name),priority:35,strengthParameter:ref('reactivity'),source:{signal:name,capability:name==='drop'?'music.drop':name==='beat'?'music.beat':name==='phrase'?'music.phrase':'music.rhythm-events'},
  conditions:[{kind:'once-per-event'},...(name==='drop'?[]:[{kind:'not-silent' as const}])],
  actions:[{id:actionId(`pulse-${name}`),target:{kind:'module',ref:cinema2Ref(moduleId),property:name},operation:'envelope',
    value:1,envelope:{attack:.016,hold,release,unit:'seconds'},retrigger:'restart'}],
})

const manifest: Cinema2NativePresetManifest = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_OVERDRIVE_PRESET_ID,
  revision: 1,
  metadata: {
    name: 'OVERDRIVE', author: 'STAGELESS', category: 'Architecture',
    description: 'A colossal radial cybernetic machine with a ribbed LED core, articulated pistons, acoustic drivers and twelve structural performance programs.',
    tags: ['3d','mechanical','industrial','media','audio-reactive'],
  },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Native mechanical geometry and spherical pixel shader.' },
    { id: 'render.depth', requirement: 'required', purpose: 'Depth between concentric mechanical assemblies.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Centered perspective into the mechanical chamber.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'Articulated mechanisms, spherical ribs and local lights.' },
    { id: 'audio.bands', requirement: 'optional', purpose: 'Frequency bands drive independent mechanical components.' },
    { id: 'audio.features', requirement: 'optional', purpose: 'Energy and vocal presence control core illumination.' },
    { id: 'music.beat', requirement: 'optional', purpose: 'Shared beat-synchronized mechanical motion.' },
    { id: 'music.rhythm-events', requirement: 'optional', purpose: 'Kick and snare accents on the acoustic drivers and conduits.' },
    { id: 'music.phrase', requirement: 'optional', purpose: 'Structural phrase accents.' },
    { id: 'music.drop', requirement: 'optional', purpose: 'Drop events release mechanical pressure.' },
    { id: 'visual-director.significance', requirement: 'optional', purpose: 'Build sections compress the machine.' },
    { id: 'media.image', requirement: 'optional', purpose: 'Images from the shared Media Library.' },
    { id: 'media.video', requirement: 'optional', purpose: 'Video from the shared Media Library.' },
    { id: 'media.svg', requirement: 'optional', purpose: 'SVG from the shared Media Library.' },
  ],
  parameters,
  mediaSlots: [{ id: CINEMA2_OVERDRIVE_MEDIA_SLOT, label: 'Core Media', accepts: ['image', 'video', 'svg'] }],
  modules: [{
    id: moduleId, typeId: CINEMA2_OVERDRIVE_MODULE_TYPE_ID, version: 1,
    parameters: { ...defaults, energy: 0, bass: 0, mid: 0, high: 0, vocal: 0, build: 0, kick: 0, snare: 0, drop: 0, beat:0, phrase:0 },
    parameterBindings: bindings, media: { coreMedia: cinema2Ref(CINEMA2_OVERDRIVE_MEDIA_SLOT) },
  }],
  scene: {
    nodes: [
      { id: root, kind: 'group', coordinateSpace: 'world' },
      { id: wall, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(moduleId) },
      { id: aim, kind: 'group', parent: cinema2Ref(root), transform: { position: [0, 0, 0] } },
    ],
    roots: [cinema2Ref(root)],
  },
  layers: [{ id: layer, label: 'Mechanical Chamber', source: cinema2Ref(root), role: 'world', depthPolicy: 'read-write', order: 0 }],
  cameras: [{
    id: camera, label: 'Core Perspective', projection: 'perspective', fovDegrees: 48,
    near: 0.2, far: 40, transform: { position: [0, 0, 10.1] },
    targetNode: cinema2Ref(aim), rig: { kind: 'orbit', radius:10.1, azimuthDegrees:0, elevationDegrees:0, angularVelocityDegreesPerSecond:0 },
    motion:{drift:{position:.12,target:.015,rollDegrees:1.2,fovDegrees:.3,speed:.10,seed:624}},
    controls:{motionAmount:ref('camera-motion'),masterMotionAmount:ref('motion'),orbitAzimuthDegrees:ref('camera-orbit'),orbitRadius:ref('camera-distance')},
    safety:{minPosition:[-2,-.5,9],maxPosition:[2,.5,11.2],maxTargetOffset:[.08,.08,.08],minFovDegrees:47,maxFovDegrees:49},
  }],
  environment: { backgroundColor: OVERDRIVE_COLORS.background, exposure: 1, controls: { backgroundColor: ref('background') } },
  effects: [
    { id: bloom, typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID, version: 1, enabled: true, order: 0, scope: 'output',
      parameters: { mix: 1, threshold: 1.25, knee: 0.29, intensity: 0.30, spread: 0.32, levels: 5, clampMax: 12, tint: [1, 1, 1, 1] },
      parameterBindings: { intensity: ref('bloom') } },
    { id: finish, typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID, version: 1, enabled: true, order: 1, scope: 'output',
      parameters: { mix: 0.46, exposure: 1.02, contrast: 1.08, saturation: 1.05, vignette: 0.08, grain: 0, aberration: 0 }, parameterBindings:{mix:ref('finish')} },
  ],
  choreography: { tempoSyncParameter: ref('bpm-sync'), rules: [
    route('energy', 'audio.features.overallEnergy', 'audio.features', 145),
    route('bass', 'audio.bands.bass', 'audio.bands', 95),
    route('mid', 'audio.bands.mid', 'audio.bands', 110),
    route('high', 'audio.bands.high', 'audio.bands', 70),
    route('vocal', 'audio.features.vocalPresence', 'audio.features', 207),
    route('build', 'director.build', 'visual-director.significance', 140),
    event('kick', 0.04, 0.24), event('snare', 0.018, 0.21), event('drop', 0.17, 1.4), event('beat',.03,.2), event('phrase',.1,.85),
  ] },
}

export const CINEMA2_OVERDRIVE_PRESET_MANIFEST = withCinema2MoodDrives(manifest,{
  idPrefix:'overdrive-auto',enabledParameter:id('auto-performance'),strengthParameter:id('reactivity'),
  patternControls:{patternChange:id('pattern-change'),trigger:id('trigger')},
  drives:[
    {id:'rotation-activity',target:cinema2AutoTargets.module(moduleId,'rotation'),source:'mood.activity',operation:'add',value:.40},
    {id:'rotation-calm',target:cinema2AutoTargets.module(moduleId,'rotation'),source:'mood.calm',operation:'add',value:-.20},
    {id:'compression-tense',target:cinema2AutoTargets.module(moduleId,'compression'),source:'mood.tense',operation:'add',value:.45},
    {id:'piston-drive',target:cinema2AutoTargets.module(moduleId,'piston'),source:'mood.activity',operation:'add',value:.25},
    {id:'separation-peak',target:cinema2AutoTargets.module(moduleId,'separation'),source:'mood.peak',operation:'add',value:.28},
    {id:'aperture-shock',target:cinema2AutoTargets.module(moduleId,'aperture'),source:'mood.shock',operation:'add',value:.38},
    {id:'intensity-silence',target:cinema2AutoTargets.module(moduleId,'intensity'),source:'mood.silence',operation:'add',value:-.55},
    {id:'bloom-peak',target:cinema2AutoTargets.effect(bloom,'intensity'),source:'mood.peak',operation:'add',value:.22},
  ],
})
