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
import { CINEMA2_REFLECTIVE_FLOOR_EFFECT_TYPE_ID } from '../effects/Cinema2ReflectiveFloorEffect'
import { CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID } from '../effects/Cinema2VolumetricAtmosphereEffect'
import {
  CINEMA2_CATHEDRAL_NATIVE_MODULE_TYPE_ID,
  CINEMA2_CATHEDRAL_PROGRAMS,
  type Cinema2CathedralProgram,
} from '../modules/Cinema2CathedralNativeModule'
import { CINEMA2_CATHEDRAL_LAYOUT_CONFIG } from '../modules/cathedral/Cinema2CathedralLayout'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'

export const CINEMA2_CATHEDRAL_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.cathedral')
export const CINEMA2_CATHEDRAL_MODULE_ID = cinema2StableId<Cinema2ModuleId>('cathedral-aisle')
export const CINEMA2_CATHEDRAL_CAMERA_ID = cinema2StableId<Cinema2CameraId>('cathedral-flight-camera')

const parameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`cathedral-${name}`)
export const CINEMA2_CATHEDRAL_INTENSITY_ID = parameterId('intensity')
export const CINEMA2_CATHEDRAL_REACTIVITY_ID = parameterId('reactivity')
export const CINEMA2_CATHEDRAL_AUTO_PERFORMANCE_ID = parameterId('auto-performance')
export const CINEMA2_CATHEDRAL_BPM_SYNC_ID = parameterId('bpm-sync')
export const CINEMA2_CATHEDRAL_MOTION_SAFETY_ID = parameterId('motion-safety')
export const CINEMA2_CATHEDRAL_PROGRAM_ID = parameterId('program')
export const CINEMA2_CATHEDRAL_PATTERN_CHANGE_ID = parameterId('pattern-change')
export const CINEMA2_CATHEDRAL_TRIGGER_ID = parameterId('trigger')
export const CINEMA2_CATHEDRAL_ACTIVE_DENSITY_ID = parameterId('active-density')
export const CINEMA2_CATHEDRAL_EXPANSION_ID = parameterId('expansion')
export const CINEMA2_CATHEDRAL_SPARK_DENSITY_ID = parameterId('spark-density')
export const CINEMA2_CATHEDRAL_HAZE_ID = parameterId('haze')
export const CINEMA2_CATHEDRAL_SHAFTS_ID = parameterId('shafts')
export const CINEMA2_CATHEDRAL_FLOOR_ID = parameterId('floor-reflection')
export const CINEMA2_CATHEDRAL_BLOOM_ID = parameterId('bloom')
export const CINEMA2_CATHEDRAL_FINISH_ID = parameterId('finish')
export const CINEMA2_CATHEDRAL_BACKGROUND_ID = parameterId('background')
export const CINEMA2_CATHEDRAL_STRUCTURE_COLOR_ID = parameterId('structure-color')
export const CINEMA2_CATHEDRAL_PRIMARY_COLOR_ID = parameterId('primary-color')
export const CINEMA2_CATHEDRAL_ACCENT_COLOR_ID = parameterId('accent-color')

const ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('cathedral-root')
const AISLE_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('cathedral-aisle-node')
const WORLD_LAYER_ID = cinema2StableId<Cinema2LayerId>('cathedral-world-layer')
const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('cathedral-ambient')
const SHAFT_LIGHT_ID = cinema2StableId<Cinema2LightId>('cathedral-shaft-light')
const ATMOSPHERE_EFFECT_ID = cinema2StableId<Cinema2EffectId>('cathedral-atmosphere-effect')
const FLOOR_EFFECT_ID = cinema2StableId<Cinema2EffectId>('cathedral-floor-effect')
const BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('cathedral-bloom-effect')
const FINISH_EFFECT_ID = cinema2StableId<Cinema2EffectId>('cathedral-finish-effect')

const targetId = (name: string) => cinema2StableId<Cinema2RenderTargetId>(`cathedral-${name}-target`)
const passId = (name: string) => cinema2StableId<Cinema2RenderPassId>(`cathedral-${name}-pass`)
const slotId = (name: string) => cinema2StableId<Cinema2RenderSlotId>(`cathedral-${name}`)
const SCENE_TARGET_ID = targetId('scene')
const FLOOR_TARGET_ID = targetId('floor')
const ATMOSPHERE_TARGET_ID = targetId('atmosphere')
const BLOOM_TARGET_ID = targetId('bloom')
const SCENE_PASS_ID = passId('scene')
const FLOOR_PASS_ID = passId('floor')
const ATMOSPHERE_PASS_ID = passId('atmosphere')
const BLOOM_PASS_ID = passId('bloom')
const FINISH_PASS_ID = passId('finish')
const SCENE_COLOR_ID = slotId('scene-color')
const SCENE_DEPTH_ID = slotId('scene-depth')

const vec3 = (x: number, y: number, z: number): Cinema2Vector3 => Object.freeze([x, y, z])
const color = (r: number, g: number, b: number, a = 1): Cinema2Color => Object.freeze([r, g, b, a])
const DEFAULT_BACKGROUND = color(0.001, 0.004, 0.012)
const DEFAULT_STRUCTURE = color(0.018, 0.028, 0.052)
const DEFAULT_PRIMARY = color(0.03, 0.84, 1)
const DEFAULT_ACCENT = color(0.84, 0.58, 0.12)
const REPEAT_DISTANCE = CINEMA2_CATHEDRAL_LAYOUT_CONFIG.archCount * CINEMA2_CATHEDRAL_LAYOUT_CONFIG.spacing
  + CINEMA2_CATHEDRAL_LAYOUT_CONFIG.transitionRoomLength
const LAP_SECONDS = 52

const PROGRAM_LABELS: Readonly<Record<Cinema2CathedralProgram, string>> = Object.freeze({
  cathedralRun: 'Cathedral Run',
  aisleChase: 'Aisle Chase',
  alternatingRibs: 'Alternating Ribs',
  vaultReveal: 'Vault Reveal',
  rupture: 'Rupture',
})

const parameterBase = Object.freeze({
  section: 'Design',
  exposure: 'primary' as const,
  persistence: 'preset' as const,
  reset: 'authored-default' as const,
  modulatable: true,
  choreographable: true,
  automatable: false,
})

function floatParameter(
  id: Cinema2ParameterId,
  label: string,
  description: string,
  defaultValue: number,
  min: number,
  max: number,
  step: number,
  parent: 'master-controls' | 'design' | 'effects',
  order: number,
  group: string,
) {
  return Object.freeze({ ...parameterBase, id, label, description, type: 'float' as const, defaultValue, min, max, step, designParentGroup: parent, order, group })
}

function colorParameter(id: Cinema2ParameterId, label: string, description: string, defaultValue: Cinema2Color, order: number) {
  return Object.freeze({ ...parameterBase, id, label, description, type: 'color' as const, defaultValue, designParentGroup: 'palette' as const, order, group: 'Color' })
}

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

function effectPass(
  id: Cinema2RenderPassId,
  after: Cinema2RenderPassId,
  afterOutput: Cinema2RenderSlotId,
  effect: Cinema2EffectId,
  name: string,
  output: Cinema2RenderTargetId | null,
  withDepth: boolean,
) {
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

const ruleId = (name: string) => cinema2StableId<Cinema2ChoreographyRuleId>(`cathedral-${name}-rule`)
const actionId = (name: string) => cinema2StableId<Cinema2ChoreographyActionId>(`cathedral-${name}-action`)

const moduleEnvelopeAction = (name: string, property: string, value: number, hold: number, release: number) => Object.freeze({
  id: actionId(name),
  target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_CATHEDRAL_MODULE_ID), property }),
  operation: 'envelope' as const,
  value,
  composition: 'replace' as const,
  envelope: Object.freeze({ attack: 0.02, hold, release, unit: 'seconds' as const }),
  retrigger: 'restart' as const,
})

const moduleContinuousAction = (name: string, property: string) => Object.freeze({
  id: actionId(name),
  target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_CATHEDRAL_MODULE_ID), property }),
  operation: 'replace' as const,
  value: 1,
})

const effectEnvelopeAction = (name: string, effect: Cinema2EffectId, property: string, value: number, hold: number, release: number) => Object.freeze({
  id: actionId(name),
  target: Object.freeze({ kind: 'effect' as const, ref: cinema2Ref(effect), property }),
  operation: 'envelope' as const,
  value,
  composition: 'add' as const,
  envelope: Object.freeze({ attack: 0.025, hold, release, unit: 'seconds' as const }),
  retrigger: 'restart' as const,
})

const effectContinuousAction = (name: string, effect: Cinema2EffectId, property: string, value: number) => Object.freeze({
  id: actionId(name),
  target: Object.freeze({ kind: 'effect' as const, ref: cinema2Ref(effect), property }),
  operation: 'add' as const,
  value,
})

function flightPoints() {
  const point = (progress: number) => {
    const z = -REPEAT_DISTANCE * progress
    return Object.freeze({ position: vec3(0, 0.1, z), target: vec3(0, 0.45, z - 18), fovDegrees: 62, rollDegrees: 0 })
  }
  return Object.freeze([point(0), point(0.25), point(0.5), point(0.75)])
}

export const CINEMA2_CATHEDRAL_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_CATHEDRAL_PRESET_ID,
  revision: 1,
  metadata: Object.freeze({
    name: 'Cathedral 2.0',
    description: 'A monumental cyan-and-gold Gothic aisle of pointed arches, addressable ribs, volumetric shafts and music-driven structural rupture.',
    tags: Object.freeze(['keeper', '3d', 'architecture', 'gothic', 'cathedral', 'choreography']),
    metadata: Object.freeze({ legacySources: Object.freeze(['shader-bass-cathedral', 'preset-cathedral-run']) }),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Instanced native Gothic architecture.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Correct arch occlusion and depth-aware atmosphere.' }),
    Object.freeze({ id: 'render.hdr' as const, requirement: 'optional' as const, purpose: 'Preserves cyan and gold emission above display white for bloom.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'World-space columns, arches, ribs, rails and sparks.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Endless aisle travel through the architectural scene.' }),
    Object.freeze({ id: 'lighting' as const, requirement: 'required' as const, purpose: 'Atmospheric shafts, structure visibility and reflective-floor response.' }),
    Object.freeze({ id: 'audio.features' as const, requirement: 'optional' as const, purpose: 'Energy and vocal restraint shape the active architecture.' }),
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'Beat accents travel through addressable ribs.' }),
    Object.freeze({ id: 'music.rhythm-events' as const, requirement: 'optional' as const, purpose: 'Kick and snare drive rib weight, light impact and sparks.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Downbeats sweep the complete aisle.' }),
    Object.freeze({ id: 'music.bar' as const, requirement: 'optional' as const, purpose: 'Canonical bar boundaries can advance the selected light program.' }),
    Object.freeze({ id: 'music.phrase' as const, requirement: 'optional' as const, purpose: 'Phrase boundaries provide a restrained vault accent.' }),
    Object.freeze({ id: 'music.build' as const, requirement: 'optional' as const, purpose: 'Build pressure contracts and progressively reveals the vault.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'Drops trigger bounded structural rupture, sparks and atmosphere impact.' }),
    Object.freeze({ id: 'music.vocal-presence' as const, requirement: 'optional' as const, purpose: 'Vocal passages reduce visual density without changing authored settings.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'Shared build interpretation shapes the architectural reveal.' }),
  ]),
  parameters: Object.freeze([
    CINEMA2_QUALITY_MODE_PARAMETER,
    floatParameter(CINEMA2_CATHEDRAL_INTENSITY_ID, 'Master Intensity', 'Brightness of architectural emission and its local material response.', 1, 0, 2, 0.01, 'master-controls', 1, 'Playback'),
    floatParameter(CINEMA2_CATHEDRAL_REACTIVITY_ID, 'Music Reactivity', 'Scales all music-driven light, geometry, spark, atmosphere and drop behavior.', 1, 0, 1, 0.01, 'master-controls', 2, 'Playback'),
    Object.freeze({ ...parameterBase, id: CINEMA2_CATHEDRAL_AUTO_PERFORMANCE_ID, label: 'Auto Performance', description: 'Lets shared Audio Intelligence select the vault reveal and rupture behavior while retaining the selected Light Program as the resting look.', type: 'boolean' as const, defaultValue: true, designParentGroup: 'master-controls' as const, order: 3, group: 'Playback' }),
    Object.freeze({ ...parameterBase, id: CINEMA2_CATHEDRAL_BPM_SYNC_ID, label: 'BPM Sync', description: 'Locks aisle travel to the detected musical clock; without a track the camera continues at the authored pace.', type: 'boolean' as const, defaultValue: true, designParentGroup: 'master-controls' as const, order: 4, group: 'Playback' }),
    Object.freeze({
      ...parameterBase,
      id: CINEMA2_CATHEDRAL_MOTION_SAFETY_ID,
      label: 'Camera Motion',
      description: 'Full uses the authored aisle flight, Reduced slows it, and Lock Off holds the opening view.',
      type: 'enum' as const,
      defaultValue: 'full',
      designParentGroup: 'master-controls' as const,
      order: 5,
      group: 'Playback',
      options: Object.freeze([
        Object.freeze({ value: 'full', label: 'Full Motion' }),
        Object.freeze({ value: 'reduced', label: 'Reduced Motion' }),
        Object.freeze({ value: 'lockoff', label: 'Lock Off' }),
      ]),
    }),
    Object.freeze({
      ...parameterBase,
      id: CINEMA2_CATHEDRAL_PROGRAM_ID,
      label: 'Light Program',
      description: 'Chooses how cyan and gold light travels through the arch groups. A manual choice turns Auto Performance off.',
      type: 'enum' as const,
      defaultValue: 'cathedralRun',
      metadata: Object.freeze({ userEditSetParameters: Object.freeze({ [CINEMA2_CATHEDRAL_AUTO_PERFORMANCE_ID]: false }) }),
      designParentGroup: 'effects' as const,
      order: 1,
      group: 'Pattern',
      options: Object.freeze(CINEMA2_CATHEDRAL_PROGRAMS.map(value => Object.freeze({ value, label: PROGRAM_LABELS[value] }))),
    }),
    Object.freeze({
      ...parameterBase,
      id: CINEMA2_CATHEDRAL_PATTERN_CHANGE_ID,
      label: 'Pattern Change',
      description: 'When enabled, each qualified Trigger advances through a deterministic shuffled cycle with no immediate repeat.',
      type: 'boolean' as const,
      defaultValue: false,
      designParentGroup: 'effects' as const,
      order: 2,
      group: 'Pattern',
    }),
    Object.freeze({
      ...parameterBase,
      id: CINEMA2_CATHEDRAL_TRIGGER_ID,
      label: 'Trigger',
      description: 'Chooses the musical event that advances to the next light program while Pattern Change is enabled.',
      type: 'enum' as const,
      defaultValue: 'bar4',
      options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,
      visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: CINEMA2_CATHEDRAL_PATTERN_CHANGE_ID, value: true })]),
      designParentGroup: 'effects' as const,
      order: 3,
      group: 'Pattern',
    }),
    floatParameter(CINEMA2_CATHEDRAL_ACTIVE_DENSITY_ID, 'Active Architecture', 'How much of the aisle participates in the selected light program.', 0.72, 0.08, 1, 0.01, 'design', 1, 'Architecture'),
    floatParameter(CINEMA2_CATHEDRAL_EXPANSION_ID, 'Arch Expansion', 'Base outward separation of the arch structure before musical modulation.', 0.2, 0, 1.5, 0.01, 'design', 2, 'Architecture'),
    floatParameter(CINEMA2_CATHEDRAL_SPARK_DENSITY_ID, 'Spark Density', 'Maximum deterministic spark population available to snare and drop accents.', 0.45, 0, 1, 0.01, 'effects', 4, 'Geometry Choreography'),
    floatParameter(CINEMA2_CATHEDRAL_HAZE_ID, 'Atmosphere', 'Depth-aware haze that separates the repeating architecture.', 0.012, 0, 0.12, 0.001, 'effects', 5, 'Atmosphere'),
    floatParameter(CINEMA2_CATHEDRAL_SHAFTS_ID, 'Light Shafts', 'Strength of cyan and gold volumetric light through the aisle.', 0.18, 0, 1, 0.01, 'effects', 6, 'Atmosphere'),
    floatParameter(CINEMA2_CATHEDRAL_FLOOR_ID, 'Floor Reflection', 'Strength of the dark wet-floor reflection beneath the arches.', 0.42, 0, 1, 0.01, 'effects', 7, 'Atmosphere'),
    floatParameter(CINEMA2_CATHEDRAL_BLOOM_ID, 'Bloom', 'Contained HDR halo around illuminated ribs and sparks.', 0.38, 0, 3, 0.01, 'effects', 8, 'Post'),
    floatParameter(CINEMA2_CATHEDRAL_FINISH_ID, 'Cinematic Finish', 'Filmic tone, contrast, vignette and restrained grain.', 1, 0, 1, 0.01, 'effects', 9, 'Post'),
    colorParameter(CINEMA2_CATHEDRAL_BACKGROUND_ID, 'Background', 'Color of the deep space beyond the architecture.', DEFAULT_BACKGROUND, 1),
    colorParameter(CINEMA2_CATHEDRAL_STRUCTURE_COLOR_ID, 'Structure', 'Base material color of columns, arches, ribs and floor rails.', DEFAULT_STRUCTURE, 2),
    colorParameter(CINEMA2_CATHEDRAL_PRIMARY_COLOR_ID, 'Primary Light', 'Main architectural light color; cyan by default.', DEFAULT_PRIMARY, 3),
    colorParameter(CINEMA2_CATHEDRAL_ACCENT_COLOR_ID, 'Accent Light', 'Secondary apex, column and spark color; gold by default.', DEFAULT_ACCENT, 4),
  ]),
  modules: Object.freeze([
    Object.freeze({
      id: CINEMA2_CATHEDRAL_MODULE_ID,
      typeId: CINEMA2_CATHEDRAL_NATIVE_MODULE_TYPE_ID,
      version: 1,
      enabled: true,
      config: CINEMA2_CATHEDRAL_LAYOUT_CONFIG,
      parameters: Object.freeze({
        intensity: 1,
        autoPerformance: true,
        program: 'cathedralRun',
        patternChange: false,
        trigger: 'bar4',
        bpmSync: true,
        activeDensity: 0.72,
        expansion: 0.2,
        sparkDensity: 0.45,
        structureColor: DEFAULT_STRUCTURE,
        primaryColor: DEFAULT_PRIMARY,
        accentColor: DEFAULT_ACCENT,
        kickAccent: 0,
        snareAccent: 0,
        beatAccent: 0,
        downbeatAccent: 0,
        phraseAccent: 0,
        buildAmount: 0,
        dropAccent: 0,
        overallEnergy: 0,
        vocalRestraint: 0,
      }),
      parameterBindings: Object.freeze({
        intensity: cinema2Ref(CINEMA2_CATHEDRAL_INTENSITY_ID),
        autoPerformance: cinema2Ref(CINEMA2_CATHEDRAL_AUTO_PERFORMANCE_ID),
        program: cinema2Ref(CINEMA2_CATHEDRAL_PROGRAM_ID),
        patternChange: cinema2Ref(CINEMA2_CATHEDRAL_PATTERN_CHANGE_ID),
        trigger: cinema2Ref(CINEMA2_CATHEDRAL_TRIGGER_ID),
        bpmSync: cinema2Ref(CINEMA2_CATHEDRAL_BPM_SYNC_ID),
        activeDensity: cinema2Ref(CINEMA2_CATHEDRAL_ACTIVE_DENSITY_ID),
        expansion: cinema2Ref(CINEMA2_CATHEDRAL_EXPANSION_ID),
        sparkDensity: cinema2Ref(CINEMA2_CATHEDRAL_SPARK_DENSITY_ID),
        structureColor: cinema2Ref(CINEMA2_CATHEDRAL_STRUCTURE_COLOR_ID),
        primaryColor: cinema2Ref(CINEMA2_CATHEDRAL_PRIMARY_COLOR_ID),
        accentColor: cinema2Ref(CINEMA2_CATHEDRAL_ACCENT_COLOR_ID),
      }),
    }),
  ]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
      Object.freeze({ id: AISLE_NODE_ID, kind: 'module' as const, parent: cinema2Ref(ROOT_NODE_ID), module: cinema2Ref(CINEMA2_CATHEDRAL_MODULE_ID) }),
    ]),
    roots: Object.freeze([cinema2Ref(ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([
    Object.freeze({ id: WORLD_LAYER_ID, label: 'Cathedral Architecture', source: cinema2Ref(ROOT_NODE_ID), role: 'world', depthPolicy: 'read-write' as const, order: 0 }),
  ]),
  cameras: Object.freeze([
    Object.freeze({
      id: CINEMA2_CATHEDRAL_CAMERA_ID,
      label: 'Cathedral Aisle Flight',
      projection: 'perspective' as const,
      fovDegrees: 62,
      minAspect: 0.72,
      near: 0.2,
      far: 130,
      transform: Object.freeze({ position: vec3(0, 0.1, 0) }),
      target: vec3(0, 0.45, -18),
      rig: Object.freeze({
        kind: 'fly' as const,
        points: flightPoints(),
        durationSeconds: LAP_SECONDS,
        loop: true,
        repeatOffset: vec3(0, 0, -REPEAT_DISTANCE),
      }),
      motion: Object.freeze({
        interpolation: 'spline' as const,
        constantSpeed: true,
        drift: Object.freeze({ translation: vec3(0.055, 0.035, 0), rotationDegrees: vec3(0.18, 0.25, 0.12), frequencyHz: 0.07, seed: 218 }),
        bank: Object.freeze({ strength: 0.08, smoothingMs: 480, maxDegrees: 1.8 }),
        tempo: Object.freeze({ referenceBpm: 120, flightSpeed: true, minRate: 0.68, maxRate: 1.38, weave: 0.025, bob: 0.018, roll: 0.012, fov: 0.8, punch: 0.018 }),
      }),
      controls: Object.freeze({ motionSafety: cinema2Ref(CINEMA2_CATHEDRAL_MOTION_SAFETY_ID), tempoSync: cinema2Ref(CINEMA2_CATHEDRAL_BPM_SYNC_ID) }),
      smoothingMs: 110,
      safety: Object.freeze({
        minPosition: vec3(-1.2, -0.8, -100_000),
        maxPosition: vec3(1.2, 1.25, 100_000),
        maxPositionOffset: vec3(0.8, 0.6, 1.2),
        maxTargetOffset: vec3(0.65, 0.55, 0.8),
        minFovDegrees: 50,
        maxFovDegrees: 70,
        minNear: 0.1,
        maxFar: 150,
      }),
    }),
  ]),
  choreography: Object.freeze({
    rules: Object.freeze([
      Object.freeze({
        id: ruleId('energy'), priority: 10, enabledParameter: cinema2Ref(CINEMA2_CATHEDRAL_AUTO_PERFORMANCE_ID), strengthParameter: cinema2Ref(CINEMA2_CATHEDRAL_REACTIVITY_ID),
        source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.features' as const, path: 'audio.features.overallEnergy' as const, smoothingMs: 140 }),
        actions: Object.freeze([moduleContinuousAction('energy-module', 'overallEnergy')]),
      }),
      Object.freeze({
        id: ruleId('vocal'), priority: 15, enabledParameter: cinema2Ref(CINEMA2_CATHEDRAL_AUTO_PERFORMANCE_ID), strengthParameter: cinema2Ref(CINEMA2_CATHEDRAL_REACTIVITY_ID),
        source: Object.freeze({ signal: 'continuous' as const, capability: 'music.vocal-presence' as const, path: 'audio.features.vocalPresence' as const, smoothingMs: 180 }),
        actions: Object.freeze([moduleContinuousAction('vocal-module', 'vocalRestraint')]),
      }),
      Object.freeze({
        id: ruleId('beat'), priority: 28, enabledParameter: cinema2Ref(CINEMA2_CATHEDRAL_AUTO_PERFORMANCE_ID), strengthParameter: cinema2Ref(CINEMA2_CATHEDRAL_REACTIVITY_ID),
        source: Object.freeze({ signal: 'beat' as const, capability: 'music.beat' as const }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([moduleEnvelopeAction('beat-ribs', 'beatAccent', 1, 0.015, 0.18)]),
      }),
      Object.freeze({
        id: ruleId('kick'), priority: 30, enabledParameter: cinema2Ref(CINEMA2_CATHEDRAL_AUTO_PERFORMANCE_ID), strengthParameter: cinema2Ref(CINEMA2_CATHEDRAL_REACTIVITY_ID),
        source: Object.freeze({ signal: 'kick' as const, capability: 'music.rhythm-events' as const }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([moduleEnvelopeAction('kick-ribs', 'kickAccent', 1, 0.025, 0.24), effectEnvelopeAction('kick-floor', FLOOR_EFFECT_ID, 'reflectivity', 0.035, 0.02, 0.24)]),
      }),
      Object.freeze({
        id: ruleId('snare'), priority: 31, enabledParameter: cinema2Ref(CINEMA2_CATHEDRAL_AUTO_PERFORMANCE_ID), strengthParameter: cinema2Ref(CINEMA2_CATHEDRAL_REACTIVITY_ID),
        source: Object.freeze({ signal: 'snare' as const, capability: 'music.rhythm-events' as const }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([moduleEnvelopeAction('snare-sparks', 'snareAccent', 1, 0.035, 0.42), effectEnvelopeAction('snare-bloom', BLOOM_EFFECT_ID, 'intensity', 0.06, 0.02, 0.28)]),
      }),
      Object.freeze({
        id: ruleId('downbeat'), priority: 35, enabledParameter: cinema2Ref(CINEMA2_CATHEDRAL_AUTO_PERFORMANCE_ID), strengthParameter: cinema2Ref(CINEMA2_CATHEDRAL_REACTIVITY_ID),
        source: Object.freeze({ signal: 'downbeat' as const, capability: 'music.downbeat' as const }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([moduleEnvelopeAction('downbeat-aisle', 'downbeatAccent', 1, 0.05, 0.58), effectEnvelopeAction('downbeat-shafts', ATMOSPHERE_EFFECT_ID, 'beamIntensity', 0.08, 0.06, 0.62)]),
      }),
      Object.freeze({
        id: ruleId('phrase'), priority: 38, enabledParameter: cinema2Ref(CINEMA2_CATHEDRAL_AUTO_PERFORMANCE_ID), strengthParameter: cinema2Ref(CINEMA2_CATHEDRAL_REACTIVITY_ID),
        source: Object.freeze({ signal: 'phrase' as const, capability: 'music.phrase' as const }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([moduleEnvelopeAction('phrase-vault', 'phraseAccent', 1, 0.12, 0.88), effectEnvelopeAction('phrase-haze', ATMOSPHERE_EFFECT_ID, 'density', 0.0018, 0.08, 1.1)]),
      }),
      Object.freeze({
        id: ruleId('build'), priority: 42, enabledParameter: cinema2Ref(CINEMA2_CATHEDRAL_AUTO_PERFORMANCE_ID), strengthParameter: cinema2Ref(CINEMA2_CATHEDRAL_REACTIVITY_ID),
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 130 }),
        actions: Object.freeze([moduleContinuousAction('build-module', 'buildAmount'), effectContinuousAction('build-haze', ATMOSPHERE_EFFECT_ID, 'density', 0.003), effectContinuousAction('build-bloom', BLOOM_EFFECT_ID, 'intensity', 0.08)]),
      }),
      Object.freeze({
        id: ruleId('drop'), priority: 50, enabledParameter: cinema2Ref(CINEMA2_CATHEDRAL_AUTO_PERFORMANCE_ID), strengthParameter: cinema2Ref(CINEMA2_CATHEDRAL_REACTIVITY_ID),
        source: Object.freeze({ signal: 'drop' as const, capability: 'music.drop' as const }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([
          moduleEnvelopeAction('drop-rupture', 'dropAccent', 1, 0.12, 1.35),
          moduleEnvelopeAction('drop-sparks', 'snareAccent', 1, 0.08, 0.82),
          effectEnvelopeAction('drop-bloom', BLOOM_EFFECT_ID, 'intensity', 0.24, 0.1, 1.5),
          effectEnvelopeAction('drop-haze', ATMOSPHERE_EFFECT_ID, 'density', 0.006, 0.18, 2.6),
          effectEnvelopeAction('drop-contrast', FINISH_EFFECT_ID, 'contrast', 0.06, 0.08, 0.7),
        ]),
      }),
    ]),
  }),
  lighting: Object.freeze({
    lights: Object.freeze([
      Object.freeze({ id: AMBIENT_LIGHT_ID, type: 'ambient' as const, color: color(0.18, 0.24, 0.34), intensity: 0.035 }),
      Object.freeze({ id: SHAFT_LIGHT_ID, type: 'spot' as const, color: DEFAULT_PRIMARY, intensity: 0.48, transform: Object.freeze({ position: vec3(0, 5.8, 4.5), rotation: vec3(-0.72, 0, 0) }), config: Object.freeze({ range: 64, innerConeDegrees: 12, outerConeDegrees: 28 }) }),
    ]),
  }),
  environment: Object.freeze({ backgroundColor: DEFAULT_BACKGROUND, exposure: 1, controls: Object.freeze({ backgroundColor: cinema2Ref(CINEMA2_CATHEDRAL_BACKGROUND_ID) }) }),
  effects: Object.freeze([
    Object.freeze({
      id: FLOOR_EFFECT_ID, typeId: CINEMA2_REFLECTIVE_FLOOR_EFFECT_TYPE_ID, version: 1, enabled: true, order: 0, scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, floorY: -1.36, reflectivity: 0.42, roughness: 0.64, fresnel: 2.1, albedo: 0.045, poolIntensity: 0.9, specular: 1.1, fadeDistance: 54, maxReflection: 32, thickness: 2.2, baseColor: DEFAULT_STRUCTURE, skyColor: DEFAULT_BACKGROUND, streak: 0.18, samplingStability: 0.7, edgeFallback: 0.45 }),
      parameterBindings: Object.freeze({ reflectivity: cinema2Ref(CINEMA2_CATHEDRAL_FLOOR_ID), baseColor: cinema2Ref(CINEMA2_CATHEDRAL_STRUCTURE_COLOR_ID) }),
    }),
    Object.freeze({
      id: ATMOSPHERE_EFFECT_ID, typeId: CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID, version: 1, enabled: true, order: 1, scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, density: 0.012, beamIntensity: 0.18, mistAmount: 0.06, mistHeight: 0.8, mistFloor: -1.36, floorY: -1.36, floorReflection: 0.12, anisotropy: 0.48, occlusion: 0.84, ambientHaze: 0.004, noiseScale: 0.28, noiseStrength: 0.16, drift: 0.022, maxDistance: 72, reactivity: 0 }),
      parameterBindings: Object.freeze({ density: cinema2Ref(CINEMA2_CATHEDRAL_HAZE_ID), beamIntensity: cinema2Ref(CINEMA2_CATHEDRAL_SHAFTS_ID) }),
    }),
    Object.freeze({
      id: BLOOM_EFFECT_ID, typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID, version: 1, enabled: true, order: 2, scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, threshold: 1.7, knee: 0.42, intensity: 0.38, spread: 0.32, levels: 4, clampMax: 14 }),
      parameterBindings: Object.freeze({ intensity: cinema2Ref(CINEMA2_CATHEDRAL_BLOOM_ID) }),
    }),
    Object.freeze({
      id: FINISH_EFFECT_ID, typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID, version: 1, enabled: true, order: 3, scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, toneMap: 1, exposure: 0.96, contrast: 1.22, saturation: 0.86, vignette: 0.56, vignetteSoftness: 0.72, grain: 0.02, aberration: 0.008 }),
      parameterBindings: Object.freeze({ mix: cinema2Ref(CINEMA2_CATHEDRAL_FINISH_ID) }),
    }),
  ]),
  render: Object.freeze({
    targets: Object.freeze([viewportTarget(SCENE_TARGET_ID, true), viewportTarget(FLOOR_TARGET_ID), viewportTarget(ATMOSPHERE_TARGET_ID), viewportTarget(BLOOM_TARGET_ID)]),
    passes: Object.freeze([
      Object.freeze({
        id: SCENE_PASS_ID, kind: 'scene' as const, layers: Object.freeze([cinema2Ref(WORLD_LAYER_ID)]),
        outputs: Object.freeze([
          Object.freeze({ id: SCENE_COLOR_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'color' as const }),
          Object.freeze({ id: SCENE_DEPTH_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'depth' as const }),
        ]),
      }),
      effectPass(FLOOR_PASS_ID, SCENE_PASS_ID, SCENE_COLOR_ID, FLOOR_EFFECT_ID, 'floor', FLOOR_TARGET_ID, true),
      effectPass(ATMOSPHERE_PASS_ID, FLOOR_PASS_ID, slotId('floor-output'), ATMOSPHERE_EFFECT_ID, 'atmosphere', ATMOSPHERE_TARGET_ID, true),
      effectPass(BLOOM_PASS_ID, ATMOSPHERE_PASS_ID, slotId('atmosphere-output'), BLOOM_EFFECT_ID, 'bloom', BLOOM_TARGET_ID, false),
      effectPass(FINISH_PASS_ID, BLOOM_PASS_ID, slotId('bloom-output'), FINISH_EFFECT_ID, 'finish', null, false),
    ]),
    outputPass: cinema2Ref(FINISH_PASS_ID),
  }),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_CATHEDRAL_CAMERA_ID) }),
  output: Object.freeze({ renderPass: cinema2Ref(FINISH_PASS_ID), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
})
