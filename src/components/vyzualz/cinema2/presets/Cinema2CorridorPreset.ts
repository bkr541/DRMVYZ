import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2CameraId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyContinuousSourcePath, type Cinema2ChoreographyRuleId,
  type Cinema2ChoreographyRuleManifest, type Cinema2DesignParentGroup, type Cinema2EffectId, type Cinema2LayerId,
  type Cinema2MediaSlotId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest, type Cinema2PresetId,
  type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId, type Cinema2SceneNodeId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_CORRIDOR_MODULE_TYPE_ID, CORRIDOR_COLORS } from '../modules/Cinema2CorridorNativeModule'
import { CORRIDOR_PATTERNS } from '../modules/corridor/Cinema2CorridorRenderer'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { cinema2AutoTargets } from './Cinema2AutoPerformanceAuthoring'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'

export const CINEMA2_CORRIDOR_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.corridor')
export const CINEMA2_CORRIDOR_MEDIA_SLOT = cinema2StableId<Cinema2MediaSlotId>('corridor-panel-media')
const parameter = (name: string) => cinema2StableId<Cinema2ParameterId>(`corridor-${name}`)
const ref = (name: string) => cinema2Ref(parameter(name))
const root = cinema2StableId<Cinema2SceneNodeId>('corridor-root')
const passage = cinema2StableId<Cinema2SceneNodeId>('corridor-passage')
const aim = cinema2StableId<Cinema2SceneNodeId>('corridor-aim')
const layer = cinema2StableId<Cinema2LayerId>('corridor-world')
const camera = cinema2StableId<Cinema2CameraId>('corridor-camera')
const moduleId = cinema2StableId<Cinema2ModuleId>('corridor-cassettes')
const effect = (name: string) => cinema2StableId<Cinema2EffectId>(`corridor-${name}`)
const target = (name: string) => cinema2StableId<Cinema2RenderTargetId>(`corridor-${name}-target`)
const pass = (name: string) => cinema2StableId<Cinema2RenderPassId>(`corridor-${name}-pass`)
const slot = (name: string) => cinema2StableId<Cinema2RenderSlotId>(`corridor-${name}`)
const auto = ref('auto-performance')
const bloom = effect('bloom')
const finish = effect('finish')

const base = (name: string, label: string, parent: Cinema2DesignParentGroup, group: string, order: number, description: string) => ({
  id: parameter(name), label, section: 'Design' as const, designParentGroup: parent, group, order, description,
  exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
})
const slider = (name: string, label: string, parent: Cinema2DesignParentGroup, group: string, order: number, value: number, min: number, max: number, description: string): Cinema2ParameterManifest => ({
  ...base(name,label,parent,group,order,description), type: 'float', defaultValue: value, min, max, step: 0.01,
  modulatable: true, choreographable: true,
})
const swatch = (name: string, label: string, role: keyof typeof CORRIDOR_COLORS, order: number, description: string): Cinema2ParameterManifest => ({
  ...base(name,label,'palette','Corridor Colors',order,description), type: 'color', defaultValue: CORRIDOR_COLORS[role],
})
const parameterBindings = {
  motion: ref('motion'), bpmSync: ref('bpm-sync'), autoPerformance: auto, width: ref('width'),
  transit: ref('transit'), roll: ref('roll'), density: ref('density'), intensity: ref('intensity'), haze: ref('haze'),
  pattern: ref('pattern'), patternChange: ref('pattern-change'), trigger: ref('trigger'), poolTrigger: ref('pool-trigger'),
  voidColor: ref('void'), wall: ref('wall'), amber: ref('amber'), hot: ref('hot'), markings: ref('markings'),
}
const route = (name: string, path: Cinema2ChoreographyContinuousSourcePath, capability: 'audio.features' | 'audio.bands' | 'visual-director.significance', smoothingMs: number): Cinema2ChoreographyRuleManifest => ({
  id: cinema2StableId<Cinema2ChoreographyRuleId>(`corridor-${name}`), priority: 20, enabledParameter: auto,
  source: { signal: 'continuous', path, capability, smoothingMs, clamp: [0, 1] },
  conditions: [{ kind: 'not-silent' }],
  actions: [{
    id: cinema2StableId<Cinema2ChoreographyActionId>(`corridor-read-${name}`),
    target: { kind: 'module', ref: cinema2Ref(moduleId), property: name }, operation: 'replace',
  }],
})
const hit = (signal: 'kick' | 'drop', hold: number, release: number): Cinema2ChoreographyRuleManifest => ({
  id: cinema2StableId<Cinema2ChoreographyRuleId>(`corridor-${signal}`), priority: 40, enabledParameter: auto,
  source: { signal, capability: signal === 'drop' ? 'music.drop' : 'music.rhythm-events' },
  conditions: [{ kind: 'once-per-event' }, ...(signal === 'drop' ? [] : [{ kind: 'not-silent' as const }])],
  actions: [{
    id: cinema2StableId<Cinema2ChoreographyActionId>(`corridor-pulse-${signal}`),
    target: { kind: 'module', ref: cinema2Ref(moduleId), property: signal }, operation: 'envelope',
    value: 1, envelope: { attack: 0.02, hold, release, unit: 'seconds' }, retrigger: 'restart',
  }, ...(signal === 'drop' ? [{
    id: cinema2StableId<Cinema2ChoreographyActionId>('corridor-drop-bloom'),
    target: { kind: 'effect' as const, ref: cinema2Ref(bloom), property: 'intensity' },
    operation: 'envelope' as const, composition: 'add' as const, value: 0.21,
    envelope: { attack: 0.04, hold: 0.14, release: 0.70, unit: 'seconds' as const }, retrigger: 'restart' as const,
  }] : [])],
})

const parameters: readonly Cinema2ParameterManifest[] = [
    CINEMA2_QUALITY_MODE_PARAMETER,
    slider('motion','Motion Amount','master-controls','Playback',1,0.75,0,1,'Strength of camera-relative travel, roll, mechanical panel motion and visual musical accents.'),
    { ...base('bpm-sync','BPM Sync','master-controls','Playback',2,'Use the shared transport tempo for travel and panel chase.'), type: 'boolean', defaultValue: true },
    { ...base('auto-performance','Auto Performance','master-controls','Playback',3,'Use shared music analysis and the System Settings default.'), type: 'boolean', defaultValue: false },
    slider('width','Corridor Width','design','Structure',1,2.35,1.8,3.3,'Half-width of the square passage.'),
    slider('transit','Transit Rate','design','Structure',2,1,0.2,1.8,'Rate of forward travel during playback.'),
    slider('roll','Camera Roll','design','Structure',3,0.54,0,1,'Amount of gentle roll around the centered vanishing point.'),
    slider('density','Panel Density','design','Panels',1,0.38,0.05,0.85,'Fraction of tiles recruited by the active pattern.'),
    slider('intensity','Panel Intensity','design','Panels',2,0.86,0,1.45,'Brightness of the panel diffusers, recessed perimeter LEDs, markings and local spill. User pictures retain independent source exposure.'),
    { ...base('pattern','Pattern','design','Pattern',1,'Choose the arrangement of light across the cassette banks.'), type: 'enum', defaultValue: 'night-transit', options: CORRIDOR_PATTERNS },
    { ...base('pattern-change','Pattern Change','design','Pattern',2,'Advance the active pattern on a fresh event from the selected Trigger.'), type: 'boolean', defaultValue: false },
    { ...base('trigger','Trigger','design','Pattern',3,'Musical event that advances the active pattern.'), type: 'enum',
      defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, visibleWhen: [{ kind: 'parameter-equals', parameterId: parameter('pattern-change'), value: true }] },
    { ...base('panel-media','Panel Media','design','Panel Media',1,'Choose an image, SVG or video in the Source tab’s Media Library.'), type: 'media', defaultValue: null, mediaSlot: cinema2Ref(CINEMA2_CORRIDOR_MEDIA_SLOT) },
    { ...base('pool-trigger','Pool Trigger','design','Panel Media',2,'Advance the active pool independently of Pattern Change; Program follows the current corridor pattern.'), type: 'enum', defaultValue: 'program', options: [{ value: 'program', label: 'Program cadence' }, ...CINEMA2_AFTERHOURS_TRIGGER_OPTIONS] },
    slider('bloom','Bloom','effects','Atmosphere',1,0.36,0,1.2,'Restrained glow from bright panel cores.'),
    slider('haze','Depth Haze','effects','Atmosphere',2,0.23,0,1,'Falloff matching the distance through the dark passage.'),
    swatch('void','Void','voidColor',1,'Dark color at the end of the passage.'),
    swatch('wall','Wall Metal','wall',2,'Graphite panel housings and machined lips.'),
    swatch('amber','Panel Amber','amber',3,'Warm color of the main diffusers.'),
    swatch('hot','Panel Hot','hot',4,'Secondary color for the brighter tiles and the drop ring.'),
    swatch('markings','Markings','markings',5,'Color of diagnostic markings on inactive panels.'),
  ]
const moduleDefaults = Object.fromEntries(Object.entries(parameterBindings).map(([key, binding]) => [
  key, parameters.find(definition => definition.id === binding.$ref)!.defaultValue,
]))

const manifest: Cinema2NativePresetManifest = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_CORRIDOR_PRESET_ID, revision: 1,
  metadata: {
    name: 'Corridor', author: 'STAGELESS', category: 'Architecture',
    description: 'Travel down a dark graphite passage with extruded, mechanically reactive amber, ember and ivory lighting modules on all four surfaces, with optional user media on selected choreography panels.',
    tags: ['cinematic', '3d', 'architecture', 'tunnel', 'led', 'audio-reactive'],
  },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Depth-resolved native cassette geometry.' },
    { id: 'render.depth', requirement: 'required', purpose: 'Occlusion between wall backing, pistons, extruded housings and recessed LED channels.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Central perspective projection through a four-sided passage.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'Independent panel banks and repeating world-space bays.' },
    { id: 'audio.bands', requirement: 'optional', purpose: 'Bass extends grouped panel modules and pulses transit; highs reveal diagnostic markings.' },
    { id: 'audio.features', requirement: 'optional', purpose: 'Energy and vocals reshape panel coverage.' },
    { id: 'music.beat', requirement: 'optional', purpose: 'Shared BPM Sync for travel and panel chase.' },
    { id: 'music.rhythm-events', requirement: 'optional', purpose: 'Kicks punch the nearest bays and actuate grouped panel pistons.' },
    { id: 'music.drop', requirement: 'optional', purpose: 'Drops light a square frame across four banks.' },
    { id: 'visual-director.significance', requirement: 'optional', purpose: 'Builds recruit successively nearer bays and progressively extend panel pistons.' },
    { id: 'media.image', requirement: 'optional', purpose: 'Images on selected corridor panels.' },
    { id: 'media.video', requirement: 'optional', purpose: 'Video on selected corridor panels.' },
    { id: 'media.svg', requirement: 'optional', purpose: 'SVG artwork on selected corridor panels.' },
  ],
  parameters,
  mediaSlots: [{ id: CINEMA2_CORRIDOR_MEDIA_SLOT, label: 'Panel Media', accepts: ['image', 'video', 'svg'] }],
  modules: [{
    id: moduleId, typeId: CINEMA2_CORRIDOR_MODULE_TYPE_ID, version: 1,
    parameters: { ...moduleDefaults, energy: 0, bass: 0, transient: 0, vocal: 0, kick: 0, build: 0, drop: 0 },
    parameterBindings, media: { panelMedia: cinema2Ref(CINEMA2_CORRIDOR_MEDIA_SLOT) },
  }],
  scene: {
    nodes: [
      { id: root, kind: 'group', coordinateSpace: 'world' },
      { id: passage, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(moduleId) },
      { id: aim, kind: 'group', parent: cinema2Ref(root), transform: { position: [0, 0, -16] } },
    ], roots: [cinema2Ref(root)],
  },
  layers: [{ id: layer, label: 'Corridor World', source: cinema2Ref(root), role: 'world', depthPolicy: 'read-write', order: 0 }],
  cameras: [{
    id: camera, label: 'Corridor Camera', projection: 'perspective', fovDegrees: 56,
    near: 0.075, far: 46, transform: { position: [0, 0, 0] }, targetNode: cinema2Ref(aim), rig: { kind: 'static' },
  }],
  environment: { backgroundColor: CORRIDOR_COLORS.voidColor, controls: { backgroundColor: ref('void') } },
  effects: [
    { id: bloom, typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID, version: 1, enabled: true, order: 0, scope: 'output',
      parameters: { mix: 1, threshold: 1.45, knee: 0.29, intensity: 0.36, spread: 0.47, levels: 5, clampMax: 12, tint: [1, 0.83, 0.63, 1] },
      parameterBindings: { intensity: ref('bloom') } },
    { id: finish, typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID, version: 1, enabled: true, order: 1, scope: 'output',
      parameters: { mix: 0.72, exposure: 0.86, contrast: 1.06, saturation: 1.05, vignette: 0.33, grain: 0, aberration: 0 } },
  ],
  choreography: {
    tempoSyncParameter: ref('bpm-sync'),
    rules: [
      route('energy','audio.features.overallEnergy','audio.features',155),
      route('bass','audio.bands.bass','audio.bands',94),
      route('transient','audio.bands.high','audio.bands',61),
      route('vocal','audio.features.vocalPresence','audio.features',190),
      route('build','director.build','visual-director.significance',155),
      hit('kick',0.035,0.22), hit('drop',0.22,1.20),
    ],
  },
  render: {
    targets: [
      { id: target('scene'), descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba16f', fallbackColorFormat: 'rgba8', depthFormat: 'depth24' }, ownership: 'transient' },
      { id: target('bloom'), descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba16f', fallbackColorFormat: 'rgba8' }, ownership: 'transient' },
    ],
    passes: [
      { id: pass('scene'), kind: 'scene', layers: [cinema2Ref(layer)], outputs: [
        { id: slot('scene-color'), target: cinema2Ref(target('scene')), attachment: 'color' },
        { id: slot('scene-depth'), target: cinema2Ref(target('scene')), attachment: 'depth' },
      ] },
      { id: pass('bloom'), kind: 'fullscreen', dependsOn: [cinema2Ref(pass('scene'))], effect: cinema2Ref(bloom),
        inputs: [{ id: slot('bloom-in'), source: { pass: cinema2Ref(pass('scene')), output: slot('scene-color') }, attachment: 'color' }],
        outputs: [{ id: slot('bloom-out'), target: cinema2Ref(target('bloom')), attachment: 'color' }] },
      { id: pass('finish'), kind: 'fullscreen', dependsOn: [cinema2Ref(pass('bloom'))], effect: cinema2Ref(finish),
        inputs: [{ id: slot('finish-in'), source: { pass: cinema2Ref(pass('bloom')), output: slot('bloom-out') }, attachment: 'color' }] },
    ], outputPass: cinema2Ref(pass('finish')),
  },
  defaults: { camera: cinema2Ref(camera) },
  output: { renderPass: cinema2Ref(pass('finish')), colorSpace: 'srgb', alphaMode: 'opaque' },
}

export const CINEMA2_CORRIDOR_PRESET_MANIFEST = withCinema2MoodDrives(manifest, {
  idPrefix: 'corridor-auto', enabledParameter: parameter('auto-performance'), strengthParameter: parameter('motion'),
  patternControls: { patternChange: parameter('pattern-change'), trigger: parameter('trigger') },
  drives: [
    { id: 'transit-activity', target: cinema2AutoTargets.module(moduleId,'transit'), source: 'mood.activity', operation: 'add', value: 0.45 },
    { id: 'panels-activity', target: cinema2AutoTargets.module(moduleId,'density'), source: 'mood.activity', operation: 'add', value: 0.25 },
    { id: 'panels-silence', target: cinema2AutoTargets.module(moduleId,'density'), source: 'mood.silence', operation: 'add', value: -0.31 },
    { id: 'bloom-peak', target: cinema2AutoTargets.effect(bloom,'intensity'), source: 'mood.peak', operation: 'add', value: 0.25 },
    { id: 'bloom-silence', target: cinema2AutoTargets.effect(bloom,'intensity'), source: 'mood.silence', operation: 'add', value: -0.25 },
  ],
})
