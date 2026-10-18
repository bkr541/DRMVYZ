import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2CapabilityId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleId,
  type Cinema2ChoreographySignal,
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
  CINEMA2_MARQUEE_NATIVE_MODULE_TYPE_ID,
  CINEMA2_MARQUEE_NATIVE_MODULE_VERSION,
} from '../modules/Cinema2MarqueeNativeModule'
import { CINEMA2_MARQUEE_DEFAULT_PATTERN, CINEMA2_MARQUEE_PATTERN_IDS, type Cinema2MarqueePatternId } from '../modules/marquee/Cinema2MarqueeDomain'
import { CINEMA2_MARQUEE_ASSET_ID } from '../modules/three/Cinema2ThreeAssetManifest'
import { CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID } from '../modules/three/Cinema2ThreeEnvironmentRegistry'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'

export const CINEMA2_MARQUEE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.marquee')
export const CINEMA2_MARQUEE_MODULE_ID = cinema2StableId<Cinema2ModuleId>('marquee-theater')
export const CINEMA2_MARQUEE_CAMERA_ID = cinema2StableId<Cinema2CameraId>('marquee-hero-camera')

const parameter = (id: string) => cinema2StableId<Cinema2ParameterId>(`marquee-${id}`)
export const CINEMA2_MARQUEE_PARAMETER_IDS = Object.freeze({
  masterIntensity: parameter('master-intensity'), bpmSync: parameter('bpm-sync'), autoPerformance: parameter('auto-performance'), cameraMotion: parameter('camera-motion'),
  pattern: parameter('pattern'), patternChange: parameter('pattern-change'), trigger: parameter('trigger'),
  frontText: parameter('front-text'), leftText: parameter('left-text'), rightText: parameter('right-text'), signIllumination: parameter('sign-illumination'),
  frontIntensity: parameter('front-intensity'), sideIntensity: parameter('side-intensity'), canopyIntensity: parameter('canopy-intensity'), towerIntensity: parameter('tower-intensity'), entranceIntensity: parameter('entrance-intensity'), neonIntensity: parameter('neon-intensity'),
  bloom: parameter('bloom'), haze: parameter('haze'), reflection: parameter('reflection'), cinematicFinish: parameter('cinematic-finish'),
  nightColor: parameter('night-color'), marqueeColor: parameter('marquee-color'), incandescentColor: parameter('incandescent-color'), blueColor: parameter('blue-color'), architectureColor: parameter('architecture-color'),
  musicalCue: parameter('musical-cue'),
})

const P = CINEMA2_MARQUEE_PARAMETER_IDS
const vec3 = (x: number, y: number, z: number): Cinema2Vector3 => Object.freeze([x, y, z])
const color = (r: number, g: number, b: number, a = 1): Cinema2Color => Object.freeze([r, g, b, a])
const NIGHT = color(0.012, 0.025, 0.034)
const RED = color(0.86, 0.035, 0.025)
const GOLD = color(1, 0.55, 0.14)
const BLUE = color(0.04, 0.38, 1)
const ARCHITECTURE = color(0.19, 0.11, 0.075)

export const CINEMA2_MARQUEE_PATTERN_LABELS: Readonly<Record<Cinema2MarqueePatternId, string>> = Object.freeze({
  'opening-night': 'Opening Night', 'canopy-cascade': 'Canopy Cascade', 'triple-face-relay': 'Triple-Face Relay',
  'tower-call-response': 'Tower Call & Response', 'neon-crown-rise': 'Neon Crown Rise',
  'velvet-intermission': 'Velvet Intermission', 'premiere-burst': 'Premiere Burst',
})
export const CINEMA2_MARQUEE_PATTERN_OPTIONS = Object.freeze(CINEMA2_MARQUEE_PATTERN_IDS.map(value => Object.freeze({ value, label: CINEMA2_MARQUEE_PATTERN_LABELS[value] })))

const baseParameter = Object.freeze({ section: 'Design', exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const })
const floatParameter = (id: Cinema2ParameterId, label: string, defaultValue: number, designParentGroup: 'master-controls' | 'design' | 'effects', group: string, order: number, max = 1) => Object.freeze({
  ...baseParameter, id, label, type: 'float' as const, defaultValue, min: 0, max, step: 0.01, designParentGroup, group, order,
})
const colorParameter = (id: Cinema2ParameterId, label: string, defaultValue: Cinema2Color, order: number) => Object.freeze({
  ...baseParameter, id, label, type: 'color' as const, defaultValue, designParentGroup: 'palette' as const, group: 'Theater Palette', order,
})
const textParameter = (id: Cinema2ParameterId, label: string, defaultValue: string, order: number) => Object.freeze({
  ...baseParameter, id, label, type: 'string' as const, defaultValue, designParentGroup: 'design' as const, group: 'Marquee Copy', order,
})

const PARAMETERS = Object.freeze([
  CINEMA2_QUALITY_MODE_PARAMETER,
  floatParameter(P.masterIntensity, 'Master Intensity', 0.9, 'master-controls', 'Performance', 1),
  Object.freeze({ ...baseParameter, id: P.bpmSync, label: 'BPM Sync', type: 'boolean' as const, defaultValue: true, designParentGroup: 'master-controls' as const, group: 'Performance', order: 2 }),
  Object.freeze({ ...baseParameter, id: P.autoPerformance, label: 'Auto Performance', description: 'Temporarily chooses build and drop looks without rewriting the authored Pattern or hard controls.', type: 'boolean' as const, defaultValue: true, designParentGroup: 'master-controls' as const, group: 'Performance', order: 3 }),
  floatParameter(P.cameraMotion, 'Camera Motion', 0.18, 'master-controls', 'Performance', 4),
  Object.freeze({ ...baseParameter, id: P.pattern, label: 'Pattern', type: 'enum' as const, defaultValue: CINEMA2_MARQUEE_DEFAULT_PATTERN, options: CINEMA2_MARQUEE_PATTERN_OPTIONS,
    description: 'Selects the authored bulb and neon program immediately; direct edits also turn Auto Performance off.', metadata: Object.freeze({ userEditSetParameters: Object.freeze({ [P.autoPerformance]: false }) }), designParentGroup: 'design' as const, group: 'Pattern', order: 1 }),
  Object.freeze({ ...baseParameter, id: P.patternChange, label: 'Pattern Change', type: 'boolean' as const, defaultValue: false, designParentGroup: 'design' as const, group: 'Pattern', order: 2 }),
  Object.freeze({ ...baseParameter, id: P.trigger, label: 'Trigger', type: 'enum' as const, defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,
    visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: P.patternChange, value: true })]), designParentGroup: 'design' as const, group: 'Pattern', order: 3 }),
  textParameter(P.frontText, 'Front Marquee Text', 'DVYDRM PRESENTS', 10),
  textParameter(P.leftText, 'Left Marquee Text', 'ONE NIGHT ONLY', 11),
  textParameter(P.rightText, 'Right Marquee Text', 'LIVE PREMIERE', 12),
  floatParameter(P.signIllumination, 'Sign Illumination', 0.78, 'design', 'Marquee Copy', 13),
  floatParameter(P.frontIntensity, 'Front Marquee', 1, 'design', 'Lighting Zones', 20),
  floatParameter(P.sideIntensity, 'Side Marquees', 0.86, 'design', 'Lighting Zones', 21),
  floatParameter(P.canopyIntensity, 'Canopy Underside', 0.72, 'design', 'Lighting Zones', 22),
  floatParameter(P.towerIntensity, 'Vertical Towers', 0.82, 'design', 'Lighting Zones', 23),
  floatParameter(P.entranceIntensity, 'Entrance LEDs', 0.68, 'design', 'Lighting Zones', 24),
  floatParameter(P.neonIntensity, 'Neon Crown', 0.92, 'design', 'Lighting Zones', 25),
  floatParameter(P.bloom, 'Bloom', 0.64, 'effects', 'Atmosphere', 1),
  Object.freeze({ ...floatParameter(P.haze, 'Haze', 0.008, 'effects', 'Atmosphere', 2, 0.03), step: 0.001 }),
  floatParameter(P.reflection, 'Wet Street Reflections', 0.72, 'effects', 'Atmosphere', 3),
  floatParameter(P.cinematicFinish, 'Cinematic Finish', 1, 'effects', 'Grade', 4),
  colorParameter(P.nightColor, 'Night Atmosphere', NIGHT, 1), colorParameter(P.marqueeColor, 'Marquee Red', RED, 2),
  colorParameter(P.incandescentColor, 'Incandescent Gold', GOLD, 3), colorParameter(P.blueColor, 'Neon Blue', BLUE, 4),
  colorParameter(P.architectureColor, 'Architectural Accent', ARCHITECTURE, 5),
])

const ROOT = cinema2StableId<Cinema2SceneNodeId>('marquee-root')
const MODEL = cinema2StableId<Cinema2SceneNodeId>('marquee-model')
const TARGET = cinema2StableId<Cinema2SceneNodeId>('marquee-camera-target')
const LAYER = cinema2StableId<Cinema2LayerId>('marquee-world-layer')
const AMBIENT = cinema2StableId<Cinema2LightId>('marquee-ambient')
const KEY = cinema2StableId<Cinema2LightId>('marquee-key')
const WARM = cinema2StableId<Cinema2LightId>('marquee-warm-fill')
const BLUE_RIM = cinema2StableId<Cinema2LightId>('marquee-blue-rim')
const FLOOR = cinema2StableId<Cinema2EffectId>('marquee-reflective-floor')
const HAZE = cinema2StableId<Cinema2EffectId>('marquee-haze')
const BLOOM = cinema2StableId<Cinema2EffectId>('marquee-bloom')
const FINISH = cinema2StableId<Cinema2EffectId>('marquee-finish')
const SCENE_TARGET = cinema2StableId<Cinema2RenderTargetId>('marquee-scene-target')
const FLOOR_TARGET = cinema2StableId<Cinema2RenderTargetId>('marquee-floor-target')
const HAZE_TARGET = cinema2StableId<Cinema2RenderTargetId>('marquee-haze-target')
const BLOOM_TARGET = cinema2StableId<Cinema2RenderTargetId>('marquee-bloom-target')
const SCENE_PASS = cinema2StableId<Cinema2RenderPassId>('marquee-scene-pass')
const FLOOR_PASS = cinema2StableId<Cinema2RenderPassId>('marquee-floor-pass')
const HAZE_PASS = cinema2StableId<Cinema2RenderPassId>('marquee-haze-pass')
const BLOOM_PASS = cinema2StableId<Cinema2RenderPassId>('marquee-bloom-pass')
const FINISH_PASS = cinema2StableId<Cinema2RenderPassId>('marquee-finish-pass')
const SCENE_COLOR = cinema2StableId<Cinema2RenderSlotId>('marquee-scene-color')
const SCENE_DEPTH = cinema2StableId<Cinema2RenderSlotId>('marquee-scene-depth')
const slot = (id: string) => cinema2StableId<Cinema2RenderSlotId>(`marquee-${id}`)

const viewportTarget = (id: Cinema2RenderTargetId, depth = false) => Object.freeze({ id, descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba16f' as const, fallbackColorFormat: 'rgba8' as const, ...(depth ? { depthFormat: 'depth24' as const } : {}) }), ownership: 'transient' as const })
const effectPass = (id: Cinema2RenderPassId, prior: Cinema2RenderPassId, priorOutput: Cinema2RenderSlotId, effect: Cinema2EffectId, name: string, target: Cinema2RenderTargetId | null, depth: boolean) => Object.freeze({
  id, kind: 'fullscreen' as const, dependsOn: Object.freeze([cinema2Ref(prior)]), effect: cinema2Ref(effect),
  inputs: Object.freeze([
    Object.freeze({ id: slot(`${name}-input`), source: Object.freeze({ pass: cinema2Ref(prior), output: priorOutput }), attachment: 'color' as const }),
    ...(depth ? [Object.freeze({ id: slot(`${name}-depth`), source: Object.freeze({ pass: cinema2Ref(SCENE_PASS), output: SCENE_DEPTH }), attachment: 'depth' as const })] : []),
  ]),
  ...(target ? { outputs: Object.freeze([Object.freeze({ id: slot(`${name}-output`), target: cinema2Ref(target), attachment: 'color' as const })]) } : {}),
})

const MUSIC_CUES = Object.freeze([
  ['beat', 'beat', 'music.beat'], ['kick', 'kick', 'music.rhythm-events'], ['snare', 'snare', 'music.rhythm-events'],
  ['transient', 'transient', 'music.rhythm-events'], ['downbeat', 'downbeat', 'music.downbeat'], ['phrase', 'phrase', 'music.phrase'],
  ['section', 'section-change', 'music.section'], ['drop', 'drop', 'music.drop'],
] as const satisfies readonly (readonly [string, Cinema2ChoreographySignal, Cinema2CapabilityId])[])

export const CINEMA2_MARQUEE_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_MARQUEE_PRESET_ID, revision: 1,
  metadata: Object.freeze({ name: 'MARQUEE', description: 'A richly modeled Art Deco theater facade with editable triple-face marquee copy, deep canopy bulbs, vertical light towers, crown neon and wet-street reflections.', tags: Object.freeze(['marquee', 'theater', 'art-deco', 'native', '3d', 'audio-reactive', 'keeper']) }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Shared-context HDR rendering of the production theater GLB.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Depth-aware facade, street reflection and haze.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'Real modeled theater architecture, signage and fixtures.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Hero street-level perspective with safe restrained motion.' }),
    Object.freeze({ id: 'lighting' as const, requirement: 'required' as const, purpose: 'Warm marquee keying and blue crown separation.' }),
    ...(['audio.bands', 'audio.features', 'music.beat', 'music.bar', 'music.rhythm-events', 'music.downbeat', 'music.phrase', 'music.section', 'music.build', 'music.drop', 'music.vocal-presence', 'visual-director.significance'] as const).map(id => Object.freeze({ id, requirement: 'optional' as const, purpose: 'Shared music intelligence and Visual Director choreography.' })),
  ]),
  parameters: Object.freeze([...PARAMETERS, Object.freeze({ id: P.musicalCue, label: 'Musical Cue', type: 'trigger' as const, section: 'React', group: 'Runtime', order: 999, exposure: 'hidden' as const, persistence: 'runtime-only' as const, reset: 'none' as const })]),
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_MARQUEE_MODULE_ID, typeId: CINEMA2_MARQUEE_NATIVE_MODULE_TYPE_ID, version: CINEMA2_MARQUEE_NATIVE_MODULE_VERSION, enabled: true,
    parameters: Object.freeze({ masterIntensity: 0.9, bpmSync: true, autoPerformance: true, pattern: CINEMA2_MARQUEE_DEFAULT_PATTERN, patternChange: false, trigger: 'bar4',
      frontText: 'DVYDRM PRESENTS', leftText: 'ONE NIGHT ONLY', rightText: 'LIVE PREMIERE', signIllumination: 0.78,
      frontIntensity: 1, sideIntensity: 0.86, canopyIntensity: 0.72, towerIntensity: 0.82, entranceIntensity: 0.68, neonIntensity: 0.92,
      reflection: 0.72, nightColor: NIGHT, marqueeColor: RED, incandescentColor: GOLD, blueColor: BLUE, architectureColor: ARCHITECTURE }),
    parameterBindings: Object.freeze({ masterIntensity: cinema2Ref(P.masterIntensity), bpmSync: cinema2Ref(P.bpmSync), autoPerformance: cinema2Ref(P.autoPerformance), pattern: cinema2Ref(P.pattern), patternChange: cinema2Ref(P.patternChange), trigger: cinema2Ref(P.trigger),
      frontText: cinema2Ref(P.frontText), leftText: cinema2Ref(P.leftText), rightText: cinema2Ref(P.rightText), signIllumination: cinema2Ref(P.signIllumination),
      frontIntensity: cinema2Ref(P.frontIntensity), sideIntensity: cinema2Ref(P.sideIntensity), canopyIntensity: cinema2Ref(P.canopyIntensity), towerIntensity: cinema2Ref(P.towerIntensity), entranceIntensity: cinema2Ref(P.entranceIntensity), neonIntensity: cinema2Ref(P.neonIntensity),
      reflection: cinema2Ref(P.reflection), nightColor: cinema2Ref(P.nightColor), marqueeColor: cinema2Ref(P.marqueeColor), incandescentColor: cinema2Ref(P.incandescentColor), blueColor: cinema2Ref(P.blueColor), architectureColor: cinema2Ref(P.architectureColor) }),
    actionBindings: Object.freeze({ musicalCue: cinema2Ref(P.musicalCue) }),
    config: Object.freeze({ asset: CINEMA2_MARQUEE_ASSET_ID, environment: CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID }),
  })]),
  choreography: Object.freeze({ rules: Object.freeze(MUSIC_CUES.map(([kind, signal, capability], index) => Object.freeze({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`marquee-${kind}-event`), priority: 30 + index,
    source: Object.freeze({ signal, capability }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
    actions: Object.freeze([Object.freeze({ id: cinema2StableId<Cinema2ChoreographyActionId>(`marquee-${kind}-cue`), target: Object.freeze({ kind: 'parameter' as const, ref: cinema2Ref(P.musicalCue) }), operation: 'spawn' as const, value: Object.freeze({ kind }) })]),
  }))) }),
  scene: Object.freeze({ nodes: Object.freeze([
    Object.freeze({ id: ROOT, kind: 'group' as const, coordinateSpace: 'world' as const }),
    Object.freeze({ id: MODEL, kind: 'module' as const, parent: cinema2Ref(ROOT), module: cinema2Ref(CINEMA2_MARQUEE_MODULE_ID) }),
    Object.freeze({ id: TARGET, kind: 'group' as const, parent: cinema2Ref(ROOT), transform: Object.freeze({ position: vec3(0, 4.65, 1.2) }) }),
  ]), roots: Object.freeze([cinema2Ref(ROOT)]) }),
  layers: Object.freeze([Object.freeze({ id: LAYER, label: 'MARQUEE Theater', source: cinema2Ref(ROOT), role: 'world' as const, depthPolicy: 'read-write' as const, order: 0 })]),
  cameras: Object.freeze([Object.freeze({
    id: CINEMA2_MARQUEE_CAMERA_ID, label: 'Hero Street', projection: 'perspective' as const, fovDegrees: 39, minAspect: 0.72, near: 0.1, far: 80,
    transform: Object.freeze({ position: vec3(0, 3.15, 20.5) }), target: vec3(0, 4.7, 1.2), rig: Object.freeze({ kind: 'static' as const }),
    motion: Object.freeze({ drift: Object.freeze({ translation: vec3(0.12, 0.07, 0.16), rotationDegrees: vec3(0.12, 0.2, 0.06), frequencyHz: 0.045, seed: 52021 }), tempo: Object.freeze({ referenceBpm: 120, orbitSpeed: false, minRate: 0.8, maxRate: 1.15, weave: 0.006, bob: 0.006, roll: 0.002, fov: 0.24, punch: 0.004 }) }),
    controls: Object.freeze({ motionAmount: cinema2Ref(P.cameraMotion), tempoSync: cinema2Ref(P.bpmSync) }), smoothingMs: 180,
    safety: Object.freeze({ minPosition: vec3(-1.3, 2.65, 18.5), maxPosition: vec3(1.3, 4.25, 22.5), maxPositionOffset: vec3(0.9, 0.55, 0.8), maxTargetOffset: vec3(0.5, 0.35, 0.4), minFovDegrees: 35, maxFovDegrees: 44, minNear: 0.08, maxFar: 90 }),
  })]),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_MARQUEE_CAMERA_ID) }),
  lighting: Object.freeze({ lights: Object.freeze([
    Object.freeze({ id: AMBIENT, type: 'ambient' as const, color: color(0.22, 0.29, 0.38), intensity: 0.055 }),
    Object.freeze({ id: KEY, type: 'spot' as const, color: color(1, 0.72, 0.39), intensity: 0.72, transform: Object.freeze({ position: vec3(-6, 8.8, 11) }), targetNode: cinema2Ref(TARGET), config: Object.freeze({ coneAngleDegrees: 54, penumbra: 0.76, range: 42, threeShadow: true }) }),
    Object.freeze({ id: WARM, type: 'spot' as const, color: GOLD, intensity: 0.36, transform: Object.freeze({ position: vec3(6.8, 3.2, 10) }), targetNode: cinema2Ref(TARGET), config: Object.freeze({ coneAngleDegrees: 62, penumbra: 0.82, range: 40 }) }),
    Object.freeze({ id: BLUE_RIM, type: 'spot' as const, color: BLUE, intensity: 0.28, transform: Object.freeze({ position: vec3(0, 11, -1) }), targetNode: cinema2Ref(TARGET), config: Object.freeze({ coneAngleDegrees: 48, penumbra: 0.7, range: 36 }) }),
  ]) }),
  environment: Object.freeze({ backgroundColor: NIGHT, exposure: 1, controls: Object.freeze({ backgroundColor: cinema2Ref(P.nightColor) }) }),
  effects: Object.freeze([
    Object.freeze({ id: FLOOR, typeId: CINEMA2_REFLECTIVE_FLOOR_EFFECT_TYPE_ID, version: 1, enabled: true, order: 0, scope: 'output' as const, parameters: Object.freeze({ mix: 1, floorY: -0.2, reflectivity: 0.72, roughness: 0.58, fresnel: 2.2, albedo: 0.035, poolIntensity: 0.92, specular: 1.18, fadeDistance: 46, maxReflection: 28, thickness: 2.1, baseColor: NIGHT, skyColor: NIGHT, streak: 0.32, samplingStability: 0.72, edgeFallback: 0.42 }), parameterBindings: Object.freeze({ reflectivity: cinema2Ref(P.reflection), baseColor: cinema2Ref(P.nightColor), skyColor: cinema2Ref(P.nightColor) }) }),
    Object.freeze({ id: HAZE, typeId: CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID, version: 1, enabled: true, order: 1, scope: 'output' as const, parameters: Object.freeze({ mix: 1, density: 0.008, beamIntensity: 0.08, mistAmount: 0.035, mistHeight: 0.7, mistFloor: -0.2, floorY: -0.2, floorReflection: 0.08, anisotropy: 0.42, occlusion: 0.88, ambientHaze: 0.002, noiseScale: 0.3, noiseStrength: 0.12, drift: 0.014, maxDistance: 58, reactivity: 0 }), parameterBindings: Object.freeze({ density: cinema2Ref(P.haze) }) }),
    Object.freeze({ id: BLOOM, typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID, version: 1, enabled: true, order: 2, scope: 'output' as const, parameters: Object.freeze({ mix: 1, threshold: 1.2, knee: 0.42, intensity: 0.64, spread: 0.46, levels: 6, clampMax: 20, tint: GOLD }), parameterBindings: Object.freeze({ intensity: cinema2Ref(P.bloom) }) }),
    Object.freeze({ id: FINISH, typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID, version: 1, enabled: true, order: 3, scope: 'output' as const, parameters: Object.freeze({ mix: 1, toneMap: 1, exposure: 0.94, temperature: 0.035, tint: -0.01, vignette: 0.3, vignetteSoftness: 0.76, grain: 0.018, grainSize: 1.2, aberration: 0.003, contrast: 1.16, saturation: 1.04 }), parameterBindings: Object.freeze({ mix: cinema2Ref(P.cinematicFinish) }) }),
  ]),
  render: Object.freeze({ targets: Object.freeze([viewportTarget(SCENE_TARGET, true), viewportTarget(FLOOR_TARGET), viewportTarget(HAZE_TARGET), viewportTarget(BLOOM_TARGET)]), passes: Object.freeze([
    Object.freeze({ id: SCENE_PASS, kind: 'scene' as const, layers: Object.freeze([cinema2Ref(LAYER)]), outputs: Object.freeze([Object.freeze({ id: SCENE_COLOR, target: cinema2Ref(SCENE_TARGET), attachment: 'color' as const }), Object.freeze({ id: SCENE_DEPTH, target: cinema2Ref(SCENE_TARGET), attachment: 'depth' as const })]) }),
    effectPass(FLOOR_PASS, SCENE_PASS, SCENE_COLOR, FLOOR, 'floor', FLOOR_TARGET, true),
    effectPass(HAZE_PASS, FLOOR_PASS, slot('floor-output'), HAZE, 'haze', HAZE_TARGET, true),
    effectPass(BLOOM_PASS, HAZE_PASS, slot('haze-output'), BLOOM, 'bloom', BLOOM_TARGET, false),
    effectPass(FINISH_PASS, BLOOM_PASS, slot('bloom-output'), FINISH, 'finish', null, false),
  ]), outputPass: cinema2Ref(FINISH_PASS) }),
  output: Object.freeze({ renderPass: cinema2Ref(FINISH_PASS), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
})
