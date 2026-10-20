import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2CameraId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyRuleId, type Cinema2Color, type Cinema2EffectId,
  type Cinema2LayerId, type Cinema2LightId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId,
  type Cinema2PresetId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId, type Cinema2SceneNodeId, type Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID } from '../effects/Cinema2VolumetricAtmosphereEffect'
import { CINEMA2_ANCIENT_MACHINE_NATIVE_MODULE_TYPE_ID, CINEMA2_ANCIENT_MACHINE_LOOKS, type Cinema2AncientMachineLook } from '../modules/Cinema2AncientMachineNativeModule'
import { CINEMA2_ANCIENT_MACHINE_LAYOUT_CONFIG } from '../modules/ancientMachine/Cinema2AncientMachineLayout'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'

export const CINEMA2_ANCIENT_MACHINE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.ancient-machine')
export const CINEMA2_ANCIENT_MACHINE_MODULE_ID = cinema2StableId<Cinema2ModuleId>('ancient-machine-mechanism')
export const CINEMA2_ANCIENT_MACHINE_CAMERA_ID = cinema2StableId<Cinema2CameraId>('ancient-machine-camera')
const pid = (name: string) => cinema2StableId<Cinema2ParameterId>(`ancient-machine-${name}`)
export const CINEMA2_ANCIENT_MACHINE_INTENSITY_ID = pid('intensity')
export const CINEMA2_ANCIENT_MACHINE_REACTIVITY_ID = pid('reactivity')
export const CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID = pid('auto-performance')
export const CINEMA2_ANCIENT_MACHINE_BPM_SYNC_ID = pid('bpm-sync')
export const CINEMA2_ANCIENT_MACHINE_MOTION_SAFETY_ID = pid('motion-safety')
export const CINEMA2_ANCIENT_MACHINE_LOOK_ID = pid('look')
export const CINEMA2_ANCIENT_MACHINE_PATTERN_CHANGE_ID = pid('pattern-change')
export const CINEMA2_ANCIENT_MACHINE_TRIGGER_ID = pid('trigger')
export const CINEMA2_ANCIENT_MACHINE_ROTATION_SPEED_ID = pid('rotation-speed')
export const CINEMA2_ANCIENT_MACHINE_COUNTER_ROTATION_ID = pid('counter-rotation')
export const CINEMA2_ANCIENT_MACHINE_DEPTH_ID = pid('mechanical-depth')
export const CINEMA2_ANCIENT_MACHINE_LOCK_ID = pid('lock-progress')
export const CINEMA2_ANCIENT_MACHINE_APERTURE_ID = pid('aperture')
export const CINEMA2_ANCIENT_MACHINE_GLYPH_DENSITY_ID = pid('glyph-density')
export const CINEMA2_ANCIENT_MACHINE_HAZE_ID = pid('haze')
export const CINEMA2_ANCIENT_MACHINE_BLOOM_ID = pid('bloom')
export const CINEMA2_ANCIENT_MACHINE_FINISH_ID = pid('finish')
export const CINEMA2_ANCIENT_MACHINE_BACKGROUND_ID = pid('background')
export const CINEMA2_ANCIENT_MACHINE_METAL_COLOR_ID = pid('metal-color')
export const CINEMA2_ANCIENT_MACHINE_GLYPH_COLOR_ID = pid('glyph-color')
export const CINEMA2_ANCIENT_MACHINE_INTERNAL_COLOR_ID = pid('internal-color')

const ROOT = cinema2StableId<Cinema2SceneNodeId>('ancient-machine-root')
const NODE = cinema2StableId<Cinema2SceneNodeId>('ancient-machine-node')
const LAYER = cinema2StableId<Cinema2LayerId>('ancient-machine-layer')
const AMBIENT = cinema2StableId<Cinema2LightId>('ancient-machine-ambient')
const KEY = cinema2StableId<Cinema2LightId>('ancient-machine-key')
const ATMOSPHERE = cinema2StableId<Cinema2EffectId>('ancient-machine-atmosphere')
const BLOOM = cinema2StableId<Cinema2EffectId>('ancient-machine-bloom')
const FINISH = cinema2StableId<Cinema2EffectId>('ancient-machine-finish')
const tid = (name: string) => cinema2StableId<Cinema2RenderTargetId>(`ancient-machine-${name}-target`)
const passId = (name: string) => cinema2StableId<Cinema2RenderPassId>(`ancient-machine-${name}-pass`)
const slot = (name: string) => cinema2StableId<Cinema2RenderSlotId>(`ancient-machine-${name}`)
const SCENE_TARGET = tid('scene'); const ATMOSPHERE_TARGET = tid('atmosphere'); const BLOOM_TARGET = tid('bloom')
const SCENE_PASS = passId('scene'); const ATMOSPHERE_PASS = passId('atmosphere'); const BLOOM_PASS = passId('bloom'); const FINISH_PASS = passId('finish')
const SCENE_COLOR = slot('scene-color'); const SCENE_DEPTH = slot('scene-depth')

const vec3 = (x: number, y: number, z: number): Cinema2Vector3 => Object.freeze([x, y, z])
const color = (r: number, g: number, b: number, a = 1): Cinema2Color => Object.freeze([r, g, b, a])
const BACKGROUND = color(0.004, 0.006, 0.006); const METAL = color(0.19, 0.17, 0.12)
const GLYPH = color(0.84, 0.71, 0.38); const INTERNAL = color(0.22, 0.88, 0.82)
const LOOK_LABELS: Readonly<Record<Cinema2AncientMachineLook, string>> = Object.freeze({ oracleLock: 'Oracle Lock', gearSun: 'Gear Sun', epochEngine: 'Epoch Engine' })
const base = Object.freeze({ section: 'Design', exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const, modulatable: true, choreographable: true, automatable: false })
const floatParam = (id: Cinema2ParameterId, label: string, description: string, defaultValue: number, min: number, max: number, step: number, parent: 'master-controls' | 'design' | 'effects', order: number, group: string) => Object.freeze({ ...base, id, label, description, type: 'float' as const, defaultValue, min, max, step, designParentGroup: parent, order, group })
const colorParam = (id: Cinema2ParameterId, label: string, description: string, defaultValue: Cinema2Color, order: number) => Object.freeze({ ...base, id, label, description, type: 'color' as const, defaultValue, designParentGroup: 'palette' as const, order, group: 'Machine Palette' })
const ruleId = (name: string) => cinema2StableId<Cinema2ChoreographyRuleId>(`ancient-machine-${name}-rule`)
const actionId = (name: string) => cinema2StableId<Cinema2ChoreographyActionId>(`ancient-machine-${name}-action`)
const moduleEnvelope = (name: string, property: string, value: number, hold: number, release: number) => Object.freeze({ id: actionId(name), target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_ANCIENT_MACHINE_MODULE_ID), property }), operation: 'envelope' as const, value, composition: 'replace' as const, envelope: Object.freeze({ attack: 0.02, hold, release, unit: 'seconds' as const }), retrigger: 'restart' as const })
const moduleContinuous = (name: string, property: string) => Object.freeze({ id: actionId(name), target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_ANCIENT_MACHINE_MODULE_ID), property }), operation: 'replace' as const, value: 1 })
const effectEnvelope = (name: string, effect: Cinema2EffectId, property: string, value: number, hold: number, release: number) => Object.freeze({ id: actionId(name), target: Object.freeze({ kind: 'effect' as const, ref: cinema2Ref(effect), property }), operation: 'envelope' as const, value, composition: 'add' as const, envelope: Object.freeze({ attack: 0.02, hold, release, unit: 'seconds' as const }), retrigger: 'restart' as const })
const target = (id: Cinema2RenderTargetId, depth = false) => Object.freeze({ id, descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba16f' as const, fallbackColorFormat: 'rgba8' as const, ...(depth ? { depthFormat: 'depth24' as const } : {}) }), ownership: 'transient' as const })
function effectPass(id: Cinema2RenderPassId, after: Cinema2RenderPassId, input: Cinema2RenderSlotId, effect: Cinema2EffectId, name: string, output: Cinema2RenderTargetId | null, withDepth: boolean) {
  return Object.freeze({ id, kind: 'fullscreen' as const, dependsOn: Object.freeze([cinema2Ref(after)]), effect: cinema2Ref(effect), inputs: Object.freeze([
    Object.freeze({ id: slot(`${name}-color-input`), source: Object.freeze({ pass: cinema2Ref(after), output: input }), attachment: 'color' as const }),
    ...(withDepth ? [Object.freeze({ id: slot(`${name}-depth-input`), source: Object.freeze({ pass: cinema2Ref(SCENE_PASS), output: SCENE_DEPTH }), attachment: 'depth' as const })] : []),
  ]), ...(output ? { outputs: Object.freeze([Object.freeze({ id: slot(`${name}-output`), target: cinema2Ref(output), attachment: 'color' as const })]) } : {}) })
}

export const CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, id: CINEMA2_ANCIENT_MACHINE_PRESET_ID, revision: 1,
  metadata: Object.freeze({ name: 'Ancient Machine', description: 'A monumental concentric mechanism combining Oracle Lock, Gear Sun and Epoch Engine as native authored looks.', tags: Object.freeze(['keeper', '3d', 'mechanical', 'architecture', 'choreography']), metadata: Object.freeze({ legacySources: Object.freeze(['preset-oracle-lock', 'preset-gear-sun', 'preset-epoch-engine']) }) }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Instanced native mechanical geometry.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Mechanical layer occlusion and depth atmosphere.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'World-space rings, teeth, glyphs, pins and a spherical energy crystal.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Inspection orbit around the mechanism.' }),
    Object.freeze({ id: 'lighting' as const, requirement: 'required' as const, purpose: 'Material hierarchy and internal light.' }),
    ...(['audio.features', 'music.beat', 'music.rhythm-events', 'music.downbeat', 'music.bar', 'music.phrase', 'music.drop', 'visual-director.significance'] as const).map(id => Object.freeze({ id, requirement: 'optional' as const, purpose: 'Shared Audio Intelligence drives bounded mechanical choreography.' })),
  ]),
  parameters: Object.freeze([
    CINEMA2_QUALITY_MODE_PARAMETER,
    floatParam(CINEMA2_ANCIENT_MACHINE_INTENSITY_ID, 'Master Intensity', 'Brightness of glyph and internal emission.', 0.82, 0, 2, 0.01, 'master-controls', 1, 'Playback'),
    floatParam(CINEMA2_ANCIENT_MACHINE_REACTIVITY_ID, 'Music Reactivity', 'Scales music-driven mechanical and lighting behavior.', 1, 0, 1, 0.01, 'master-controls', 2, 'Playback'),
    Object.freeze({ ...base, id: CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID, label: 'Auto Performance', description: 'Lets Audio Intelligence select build and drop machine states.', type: 'boolean' as const, defaultValue: true, designParentGroup: 'master-controls' as const, order: 3, group: 'Playback' }),
    Object.freeze({ ...base, id: CINEMA2_ANCIENT_MACHINE_BPM_SYNC_ID, label: 'BPM Sync', description: 'Uses the analyzed beat grid for Trigger timing and camera tempo.', type: 'boolean' as const, defaultValue: true, designParentGroup: 'master-controls' as const, order: 4, group: 'Playback' }),
    Object.freeze({ ...base, id: CINEMA2_ANCIENT_MACHINE_MOTION_SAFETY_ID, label: 'Camera Motion', description: 'Full orbit, reduced motion, or lock-off.', type: 'enum' as const, defaultValue: 'full', designParentGroup: 'master-controls' as const, order: 5, group: 'Playback', options: Object.freeze([Object.freeze({ value: 'full', label: 'Full Motion' }), Object.freeze({ value: 'reduced', label: 'Reduced Motion' }), Object.freeze({ value: 'lockoff', label: 'Lock Off' })]) }),
    Object.freeze({ ...base, id: CINEMA2_ANCIENT_MACHINE_LOOK_ID, label: 'Machine Look', description: 'Selects Oracle Lock, Gear Sun, or Epoch Engine immediately.', type: 'enum' as const, defaultValue: 'oracleLock', metadata: Object.freeze({ userEditSetParameters: Object.freeze({ [CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID]: false }) }), options: Object.freeze(CINEMA2_ANCIENT_MACHINE_LOOKS.map(value => Object.freeze({ value, label: LOOK_LABELS[value] }))), designParentGroup: 'effects' as const, order: 1, group: 'Pattern' }),
    Object.freeze({ ...base, id: CINEMA2_ANCIENT_MACHINE_PATTERN_CHANGE_ID, label: 'Pattern Change', description: 'When enabled, each qualified Trigger advances through a deterministic shuffled cycle with no immediate repeat.', type: 'boolean' as const, defaultValue: false, designParentGroup: 'effects' as const, order: 2, group: 'Pattern' }),
    Object.freeze({ ...base, id: CINEMA2_ANCIENT_MACHINE_TRIGGER_ID, label: 'Trigger', description: 'Chooses the musical event that advances to the next Machine Look while Pattern Change is enabled.', type: 'enum' as const, defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: CINEMA2_ANCIENT_MACHINE_PATTERN_CHANGE_ID, value: true })]), designParentGroup: 'effects' as const, order: 3, group: 'Pattern' }),
    floatParam(CINEMA2_ANCIENT_MACHINE_ROTATION_SPEED_ID, 'Rotation Speed', 'Base ring rotation rate.', 0.35, -2, 2, 0.01, 'design', 1, 'Mechanics'),
    floatParam(CINEMA2_ANCIENT_MACHINE_COUNTER_ROTATION_ID, 'Counter-Rotation', 'Opposing rotation strength between neighboring rings.', 0.72, 0, 2, 0.01, 'design', 2, 'Mechanics'),
    floatParam(CINEMA2_ANCIENT_MACHINE_DEPTH_ID, 'Mechanical Depth', 'Separation between concentric mechanism layers.', 1, 0.25, 2, 0.01, 'design', 3, 'Mechanics'),
    floatParam(CINEMA2_ANCIENT_MACHINE_LOCK_ID, 'Lock Progress', 'Authored convergence of the Oracle lock.', 0.82, 0, 1, 0.01, 'design', 4, 'Mechanics'),
    floatParam(CINEMA2_ANCIENT_MACHINE_APERTURE_ID, 'Crystal Expansion', 'Base expansion of the spherical energy crystal.', 0.12, 0, 1, 0.01, 'design', 5, 'Mechanics'),
    floatParam(CINEMA2_ANCIENT_MACHINE_GLYPH_DENSITY_ID, 'Glyph Density', 'Visible population of glyph and internal-light segments.', 0.86, 0, 1, 0.01, 'design', 6, 'Mechanics'),
    floatParam(CINEMA2_ANCIENT_MACHINE_HAZE_ID, 'Internal Haze', 'Depth-aware haze inside the mechanism.', 0.018, 0, 0.12, 0.001, 'effects', 4, 'Atmosphere'),
    floatParam(CINEMA2_ANCIENT_MACHINE_BLOOM_ID, 'Bloom', 'HDR glow around glyphs and the energy crystal.', 0.46, 0, 3, 0.01, 'effects', 5, 'Post'),
    floatParam(CINEMA2_ANCIENT_MACHINE_FINISH_ID, 'Cinematic Finish', 'Filmic tone, contrast, vignette and grain.', 1, 0, 1, 0.01, 'effects', 6, 'Post'),
    colorParam(CINEMA2_ANCIENT_MACHINE_BACKGROUND_ID, 'Background', 'Void behind the mechanism.', BACKGROUND, 1), colorParam(CINEMA2_ANCIENT_MACHINE_METAL_COLOR_ID, 'Metal', 'Exterior mechanical material.', METAL, 2),
    colorParam(CINEMA2_ANCIENT_MACHINE_GLYPH_COLOR_ID, 'Glyphs', 'Oracle glyph emission.', GLYPH, 3), colorParam(CINEMA2_ANCIENT_MACHINE_INTERNAL_COLOR_ID, 'Internal Light', 'Energy-crystal color and internal light.', INTERNAL, 4),
  ]),
  modules: Object.freeze([Object.freeze({ id: CINEMA2_ANCIENT_MACHINE_MODULE_ID, typeId: CINEMA2_ANCIENT_MACHINE_NATIVE_MODULE_TYPE_ID, version: 1, enabled: true, config: CINEMA2_ANCIENT_MACHINE_LAYOUT_CONFIG,
    parameters: Object.freeze({ intensity: 0.82, autoPerformance: true, bpmSync: true, look: 'oracleLock', patternChange: false, trigger: 'bar4', rotationSpeed: 0.35, counterRotation: 0.72, mechanicalDepth: 1, lockProgress: 0.82, aperture: 0.12, glyphDensity: 0.86, metalColor: METAL, glyphColor: GLYPH, internalColor: INTERNAL, overallEnergy: 0, bassPressure: 0, beatAccent: 0, kickAccent: 0, snareAccent: 0, downbeatAccent: 0, phraseAccent: 0, buildAmount: 0, dropAccent: 0 }),
    parameterBindings: Object.freeze({ intensity: cinema2Ref(CINEMA2_ANCIENT_MACHINE_INTENSITY_ID), autoPerformance: cinema2Ref(CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID), bpmSync: cinema2Ref(CINEMA2_ANCIENT_MACHINE_BPM_SYNC_ID), look: cinema2Ref(CINEMA2_ANCIENT_MACHINE_LOOK_ID), patternChange: cinema2Ref(CINEMA2_ANCIENT_MACHINE_PATTERN_CHANGE_ID), trigger: cinema2Ref(CINEMA2_ANCIENT_MACHINE_TRIGGER_ID), rotationSpeed: cinema2Ref(CINEMA2_ANCIENT_MACHINE_ROTATION_SPEED_ID), counterRotation: cinema2Ref(CINEMA2_ANCIENT_MACHINE_COUNTER_ROTATION_ID), mechanicalDepth: cinema2Ref(CINEMA2_ANCIENT_MACHINE_DEPTH_ID), lockProgress: cinema2Ref(CINEMA2_ANCIENT_MACHINE_LOCK_ID), aperture: cinema2Ref(CINEMA2_ANCIENT_MACHINE_APERTURE_ID), glyphDensity: cinema2Ref(CINEMA2_ANCIENT_MACHINE_GLYPH_DENSITY_ID), metalColor: cinema2Ref(CINEMA2_ANCIENT_MACHINE_METAL_COLOR_ID), glyphColor: cinema2Ref(CINEMA2_ANCIENT_MACHINE_GLYPH_COLOR_ID), internalColor: cinema2Ref(CINEMA2_ANCIENT_MACHINE_INTERNAL_COLOR_ID) }),
  })]),
  scene: Object.freeze({ nodes: Object.freeze([Object.freeze({ id: ROOT, kind: 'group' as const, coordinateSpace: 'world' as const }), Object.freeze({ id: NODE, kind: 'module' as const, parent: cinema2Ref(ROOT), module: cinema2Ref(CINEMA2_ANCIENT_MACHINE_MODULE_ID) })]), roots: Object.freeze([cinema2Ref(ROOT)]) }),
  layers: Object.freeze([Object.freeze({ id: LAYER, label: 'Ancient Mechanism', source: cinema2Ref(ROOT), role: 'world', depthPolicy: 'read-write' as const, order: 0 })]),
  cameras: Object.freeze([Object.freeze({ id: CINEMA2_ANCIENT_MACHINE_CAMERA_ID, label: 'Machine Inspection Orbit', projection: 'perspective' as const, fovDegrees: 48, minAspect: 0.72, near: 0.2, far: 80, transform: Object.freeze({ position: vec3(0, 0.2, 12.6) }), target: vec3(0, 0, -0.4), rig: Object.freeze({ kind: 'orbit' as const, radius: 12.6, azimuthDegrees: 0, elevationDegrees: 1, angularVelocityDegreesPerSecond: 1.8 }), motion: Object.freeze({ drift: Object.freeze({ translation: vec3(0.04, 0.035, 0.08), rotationDegrees: vec3(0.12, 0.14, 0.08), frequencyHz: 0.055, seed: 44001 }), tempo: Object.freeze({ referenceBpm: 120, orbitSpeed: true, minRate: 0.65, maxRate: 1.25, weave: 0.01, bob: 0.012, roll: 0.008, fov: 0.6, punch: 0.012 }) }), controls: Object.freeze({ motionSafety: cinema2Ref(CINEMA2_ANCIENT_MACHINE_MOTION_SAFETY_ID), tempoSync: cinema2Ref(CINEMA2_ANCIENT_MACHINE_BPM_SYNC_ID) }), smoothingMs: 140, safety: Object.freeze({ minPosition: vec3(-13.5, -3, -13.5), maxPosition: vec3(13.5, 3, 13.5), maxPositionOffset: vec3(0.7, 0.5, 0.7), maxTargetOffset: vec3(0.4, 0.4, 0.4), minFovDegrees: 42, maxFovDegrees: 56, minNear: 0.1, maxFar: 90 }) })]),
  choreography: Object.freeze({ rules: Object.freeze([
    Object.freeze({ id: ruleId('energy'), priority: 10, enabledParameter: cinema2Ref(CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID), strengthParameter: cinema2Ref(CINEMA2_ANCIENT_MACHINE_REACTIVITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.features' as const, path: 'audio.features.overallEnergy' as const, smoothingMs: 150 }), actions: Object.freeze([moduleContinuous('energy', 'overallEnergy')]) }),
    Object.freeze({ id: ruleId('bass-pressure'), priority: 11, enabledParameter: cinema2Ref(CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID), strengthParameter: cinema2Ref(CINEMA2_ANCIENT_MACHINE_REACTIVITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.features' as const, path: 'audio.bands.bass' as const, smoothingMs: 90 }), actions: Object.freeze([moduleContinuous('bass-pressure', 'bassPressure')]) }),
    ...([['beat', 'beatAccent', 0.2], ['kick', 'kickAccent', 0.3], ['snare', 'snareAccent', 0.38], ['downbeat', 'downbeatAccent', 0.62], ['phrase', 'phraseAccent', 0.9]] as const).map(([signal, property, release], index) => Object.freeze({ id: ruleId(signal), priority: 20 + index, enabledParameter: cinema2Ref(CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID), strengthParameter: cinema2Ref(CINEMA2_ANCIENT_MACHINE_REACTIVITY_ID), source: Object.freeze({ signal, capability: signal === 'beat' ? 'music.beat' as const : signal === 'downbeat' ? 'music.downbeat' as const : signal === 'phrase' ? 'music.phrase' as const : 'music.rhythm-events' as const }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]), actions: Object.freeze([moduleEnvelope(`${signal}-machine`, property, 1, 0.04, release)]) })),
    Object.freeze({ id: ruleId('build'), priority: 40, enabledParameter: cinema2Ref(CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID), strengthParameter: cinema2Ref(CINEMA2_ANCIENT_MACHINE_REACTIVITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 160 }), actions: Object.freeze([moduleContinuous('build', 'buildAmount')]) }),
    Object.freeze({ id: ruleId('drop'), priority: 50, enabledParameter: cinema2Ref(CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID), strengthParameter: cinema2Ref(CINEMA2_ANCIENT_MACHINE_REACTIVITY_ID), source: Object.freeze({ signal: 'drop' as const, capability: 'music.drop' as const }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]), actions: Object.freeze([moduleEnvelope('drop-release', 'dropAccent', 1, 0.12, 1.4), effectEnvelope('drop-bloom', BLOOM, 'intensity', 0.28, 0.12, 1.5), effectEnvelope('drop-haze', ATMOSPHERE, 'density', 0.008, 0.18, 2.2)]) }),
  ]) }),
  lighting: Object.freeze({ lights: Object.freeze([Object.freeze({ id: AMBIENT, type: 'ambient' as const, color: color(0.2, 0.22, 0.24), intensity: 0.06 }), Object.freeze({ id: KEY, type: 'spot' as const, color: GLYPH, intensity: 0.72, transform: Object.freeze({ position: vec3(-2.8, 4.6, 8), rotation: vec3(-0.42, -0.22, 0) }), config: Object.freeze({ range: 34, innerConeDegrees: 14, outerConeDegrees: 32 }) })]) }),
  environment: Object.freeze({ backgroundColor: BACKGROUND, exposure: 1, controls: Object.freeze({ backgroundColor: cinema2Ref(CINEMA2_ANCIENT_MACHINE_BACKGROUND_ID) }) }),
  effects: Object.freeze([
    Object.freeze({ id: ATMOSPHERE, typeId: CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID, version: 1, enabled: true, order: 0, scope: 'output' as const, parameters: Object.freeze({ mix: 1, density: 0.018, beamIntensity: 0.12, mistAmount: 0.04, mistHeight: 1, mistFloor: -5, floorY: -5, floorReflection: 0, anisotropy: 0.42, occlusion: 0.86, ambientHaze: 0.004, noiseScale: 0.3, noiseStrength: 0.12, drift: 0.012, maxDistance: 32, reactivity: 0 }), parameterBindings: Object.freeze({ density: cinema2Ref(CINEMA2_ANCIENT_MACHINE_HAZE_ID) }) }),
    Object.freeze({ id: BLOOM, typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID, version: 1, enabled: true, order: 1, scope: 'output' as const, parameters: Object.freeze({ mix: 1, threshold: 1.45, knee: 0.38, intensity: 0.46, spread: 0.36, levels: 4, clampMax: 14 }), parameterBindings: Object.freeze({ intensity: cinema2Ref(CINEMA2_ANCIENT_MACHINE_BLOOM_ID) }) }),
    Object.freeze({ id: FINISH, typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID, version: 1, enabled: true, order: 2, scope: 'output' as const, parameters: Object.freeze({ mix: 1, toneMap: 1, exposure: 0.94, contrast: 1.2, saturation: 0.82, vignette: 0.48, vignetteSoftness: 0.7, grain: 0.018, aberration: 0.006 }), parameterBindings: Object.freeze({ mix: cinema2Ref(CINEMA2_ANCIENT_MACHINE_FINISH_ID) }) }),
  ]),
  render: Object.freeze({ targets: Object.freeze([target(SCENE_TARGET, true), target(ATMOSPHERE_TARGET), target(BLOOM_TARGET)]), passes: Object.freeze([
    Object.freeze({ id: SCENE_PASS, kind: 'scene' as const, layers: Object.freeze([cinema2Ref(LAYER)]), outputs: Object.freeze([Object.freeze({ id: SCENE_COLOR, target: cinema2Ref(SCENE_TARGET), attachment: 'color' as const }), Object.freeze({ id: SCENE_DEPTH, target: cinema2Ref(SCENE_TARGET), attachment: 'depth' as const })]) }),
    effectPass(ATMOSPHERE_PASS, SCENE_PASS, SCENE_COLOR, ATMOSPHERE, 'atmosphere', ATMOSPHERE_TARGET, true), effectPass(BLOOM_PASS, ATMOSPHERE_PASS, slot('atmosphere-output'), BLOOM, 'bloom', BLOOM_TARGET, false), effectPass(FINISH_PASS, BLOOM_PASS, slot('bloom-output'), FINISH, 'finish', null, false),
  ]), outputPass: cinema2Ref(FINISH_PASS) }),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_ANCIENT_MACHINE_CAMERA_ID) }), output: Object.freeze({ renderPass: cinema2Ref(FINISH_PASS), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
})
