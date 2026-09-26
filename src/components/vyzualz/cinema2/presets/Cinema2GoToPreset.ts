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
  type Cinema2EffectTypeId,
  type Cinema2LayerId,
  type Cinema2LightGroupId,
  type Cinema2LightId,
  type Cinema2ModuleId,
  type Cinema2ModuleTypeId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2RenderPassId,
  type Cinema2RenderSlotId,
  type Cinema2RenderTargetId,
  type Cinema2SceneNodeId,
  type Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_DVYDRM_LOGO_ASSET_ID } from '../modules/three/Cinema2ThreeAssetManifest'
import { CINEMA2_STUDIO_ENVIRONMENT_ASSET_ID } from '../modules/three/Cinema2ThreeEnvironmentRegistry'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { cinema2CinematicMotion } from './Cinema2CameraMotionAuthoring'
import { cinema2LightRigAlternate, cinema2LightRigHit, cinema2LightRigRamp } from './Cinema2LightRigAuthoring'

/**
 * GO-TO: the DVYDRM logo as a real 3D object. The shared logo asset (`cinema2-dvydrm-logo`, built from the owner's master SVG) is a bevelled
 * metal extrusion that turns slowly about its vertical axis on a turntable, lit by three colored spot lights that rake through haze, two LED
 * panels and a studio environment, and reflected in a wet floor. This first version exists to prove the SVG-to-3D path and the lighting: the
 * spin and the metal are the whole show. Other logo presets reuse the same asset with different materials, colors and motion.
 */
export const CINEMA2_GO_TO_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.go-to')
export const CINEMA2_GO_TO_MODULE_ID = cinema2StableId<Cinema2ModuleId>('go-to-logo')
export const CINEMA2_GO_TO_LOGO_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('go-to-logo-node')
export const CINEMA2_GO_TO_CAMERA_ID = cinema2StableId<Cinema2CameraId>('go-to-camera')
export const CINEMA2_GO_TO_FLOOR_EFFECT_ID = cinema2StableId<Cinema2EffectId>('go-to-floor')
export const CINEMA2_GO_TO_VOLUMETRIC_EFFECT_ID = cinema2StableId<Cinema2EffectId>('go-to-volumetric')
export const CINEMA2_GO_TO_BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('go-to-bloom')
export const CINEMA2_GO_TO_FINISH_EFFECT_ID = cinema2StableId<Cinema2EffectId>('go-to-finish')

export const CINEMA2_GO_TO_MASTER_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('go-to-master-intensity')
export const CINEMA2_GO_TO_BPM_SYNC_ID = cinema2StableId<Cinema2ParameterId>('go-to-bpm-sync')
export const CINEMA2_GO_TO_SPIN_PERIOD_ID = cinema2StableId<Cinema2ParameterId>('go-to-spin-period')
export const CINEMA2_GO_TO_METALNESS_ID = cinema2StableId<Cinema2ParameterId>('go-to-metalness')
export const CINEMA2_GO_TO_ROUGHNESS_ID = cinema2StableId<Cinema2ParameterId>('go-to-roughness')
export const CINEMA2_GO_TO_CLEARCOAT_ID = cinema2StableId<Cinema2ParameterId>('go-to-clearcoat')
export const CINEMA2_GO_TO_REFLECTION_ID = cinema2StableId<Cinema2ParameterId>('go-to-environment-reflection')
export const CINEMA2_GO_TO_MOTION_AMOUNT_ID = cinema2StableId<Cinema2ParameterId>('go-to-motion-amount')
export const CINEMA2_GO_TO_HAZE_ID = cinema2StableId<Cinema2ParameterId>('go-to-haze-density')
export const CINEMA2_GO_TO_BEAM_ID = cinema2StableId<Cinema2ParameterId>('go-to-beam-intensity')
export const CINEMA2_GO_TO_MIST_ID = cinema2StableId<Cinema2ParameterId>('go-to-ground-mist')
export const CINEMA2_GO_TO_FLOOR_ID = cinema2StableId<Cinema2ParameterId>('go-to-floor-reflection')
export const CINEMA2_GO_TO_BLOOM_ID = cinema2StableId<Cinema2ParameterId>('go-to-bloom')
export const CINEMA2_GO_TO_FINISH_ID = cinema2StableId<Cinema2ParameterId>('go-to-cinematic-finish')
export const CINEMA2_GO_TO_BACKGROUND_ID = cinema2StableId<Cinema2ParameterId>('go-to-background')
export const CINEMA2_GO_TO_LOGO_TINT_ID = cinema2StableId<Cinema2ParameterId>('go-to-logo-tint')
export const CINEMA2_GO_TO_KEY_COLOR_ID = cinema2StableId<Cinema2ParameterId>('go-to-key-light')
export const CINEMA2_GO_TO_RIM_COLOR_ID = cinema2StableId<Cinema2ParameterId>('go-to-rim-light')
export const CINEMA2_GO_TO_ACCENT_COLOR_ID = cinema2StableId<Cinema2ParameterId>('go-to-accent-light')

export const CINEMA2_GO_TO_KEY_LIGHT_ID = cinema2StableId<Cinema2LightId>('go-to-key-spot')
export const CINEMA2_GO_TO_RIM_LIGHT_ID = cinema2StableId<Cinema2LightId>('go-to-rim-spot')
export const CINEMA2_GO_TO_ACCENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('go-to-accent-spot')
const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('go-to-ambient')
const KEY_GROUP_ID = cinema2StableId<Cinema2LightGroupId>('go-to-key')
const SIDES_GROUP_ID = cinema2StableId<Cinema2LightGroupId>('go-to-sides')

const ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('go-to-root')
const WORLD_LAYER_ID = cinema2StableId<Cinema2LayerId>('go-to-world-layer')
const THREE_SCENE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('three-scene')
const VOLUMETRIC_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('volumetric-atmosphere')
const BLOOM_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('bloom')
const FLOOR_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('reflective-floor')
const FINISH_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('cinematic-finish')

/** The virtual floor sits well under the turning logo; the mist and the floor reflection share this plane. */
const FLOOR_Y = -1.05
const LOGO_HEIGHT = 0.08
const RIG_BASE_INTENSITY = 1.1
const RIG_PEAK_INTENSITY = 3

const vec3 = (x: number, y: number, z: number): Cinema2Vector3 => Object.freeze([x, y, z])
const color = (r: number, g: number, b: number, a = 1): Cinema2Color => Object.freeze([r, g, b, a])

const DEFAULT_KEY = color(1, 0.93, 0.82)
const DEFAULT_RIM = color(0.3, 0.78, 1)
const DEFAULT_ACCENT = color(1, 0.3, 0.72)
const DEFAULT_BACKGROUND = color(0.006, 0.009, 0.016)

const baseParameter = {
  section: 'Design',
  exposure: 'primary' as const,
  modulatable: false,
  choreographable: false,
  automatable: false,
  persistence: 'preset' as const,
  reset: 'authored-default' as const,
}

function floatParameter(
  id: Cinema2ParameterId, label: string, description: string, defaultValue: number, min: number, max: number, step: number,
  parent: 'master-controls' | 'design' | 'effects', order: number, group?: string,
) {
  return Object.freeze({ ...baseParameter, id, label, description, type: 'float' as const, defaultValue, min, max, step, designParentGroup: parent, order, ...(group ? { group } : {}) })
}

function colorParameter(id: Cinema2ParameterId, label: string, description: string, defaultValue: Cinema2Color, order: number, group: string) {
  return Object.freeze({ ...baseParameter, id, label, description, type: 'color' as const, defaultValue, designParentGroup: 'palette' as const, order, group })
}

const PARAMETERS = Object.freeze([
  CINEMA2_QUALITY_MODE_PARAMETER,
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_GO_TO_MASTER_INTENSITY_ID,
    label: 'Master Intensity',
    description: 'One control for how strongly the light show reacts to the music: the spot lights trading the stage on the beat, the beam swell on every downbeat and the lift through a build. At 0 the lighting stays steady; at 1 it reacts fully.',
    type: 'float' as const,
    defaultValue: 0.75,
    min: 0,
    max: 1,
    step: 0.01,
    designParentGroup: 'master-controls' as const,
    order: 1,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_GO_TO_BPM_SYNC_ID,
    label: 'BPM Sync',
    description: 'On: the logo\'s turn and the camera\'s sway follow the track\'s tempo, so a faster track turns the logo faster (Spin Period is measured at 120 BPM). Off: they run at a steady 120 BPM whatever the track plays.',
    type: 'boolean' as const,
    defaultValue: true,
    designParentGroup: 'master-controls' as const,
    order: 2,
  }),
  floatParameter(CINEMA2_GO_TO_SPIN_PERIOD_ID, 'Spin Period', 'How long the logo takes to turn once all the way round, in seconds (at 120 BPM). Longer is slower.', 24, 6, 120, 1, 'design', 1, 'Turntable'),
  floatParameter(CINEMA2_GO_TO_METALNESS_ID, 'Metalness', 'How metallic the logo is: 1 reflects its surroundings like polished metal, 0 is a painted, glossy plastic.', 1, 0, 1, 0.01, 'design', 2, 'Material'),
  floatParameter(CINEMA2_GO_TO_ROUGHNESS_ID, 'Roughness', 'How sharp the reflections are: 0 is a mirror, 1 is a matte, brushed surface.', 0.18, 0, 1, 0.01, 'design', 3, 'Material'),
  floatParameter(CINEMA2_GO_TO_CLEARCOAT_ID, 'Clearcoat', 'A glossy lacquer layer over the metal (medium and high quality).', 0.5, 0, 1, 0.01, 'design', 4, 'Material'),
  floatParameter(CINEMA2_GO_TO_REFLECTION_ID, 'Environment Reflection', 'How strongly the studio environment (softboxes and light strips) reflects in the logo.', 1, 0, 2, 0.01, 'design', 5, 'Material'),
  floatParameter(CINEMA2_GO_TO_MOTION_AMOUNT_ID, 'Camera Motion', 'How much the camera drifts and sways around the logo (0 = locked off).', 0.4, 0, 1, 0.01, 'design', 6, 'Camera'),
  floatParameter(CINEMA2_GO_TO_HAZE_ID, 'Haze Density', 'How thick the haze is. Thicker haze makes the light beams brighter and softer.', 0.018, 0, 0.4, 0.005, 'effects', 1, 'Atmosphere'),
  floatParameter(CINEMA2_GO_TO_BEAM_ID, 'Beam Intensity', 'Brightness of the light scattering through the haze.', 1, 0, 6, 0.05, 'effects', 2, 'Atmosphere'),
  floatParameter(CINEMA2_GO_TO_MIST_ID, 'Ground Mist', 'Extra mist that pools near the floor.', 0.3, 0, 3, 0.05, 'effects', 3, 'Atmosphere'),
  floatParameter(CINEMA2_GO_TO_FLOOR_ID, 'Floor Reflection', 'How mirror-like the wet floor under the logo is.', 0.3, 0, 1, 0.05, 'effects', 4, 'Atmosphere'),
  floatParameter(CINEMA2_GO_TO_BLOOM_ID, 'Bloom', 'Glow added around the bright highlights and beams.', 0.55, 0, 3, 0.05, 'effects', 5, 'Post'),
  floatParameter(CINEMA2_GO_TO_FINISH_ID, 'Cinematic Finish', 'Amount of filmic tone curve, grade, vignette, fringing and grain.', 1, 0, 1, 0.05, 'effects', 6, 'Post'),
  colorParameter(CINEMA2_GO_TO_BACKGROUND_ID, 'Background', 'The stage color behind the logo.', DEFAULT_BACKGROUND, 1, 'Stage Colors'),
  colorParameter(CINEMA2_GO_TO_LOGO_TINT_ID, 'Logo Color', 'Tints the logo\'s metal. White leaves the polished silver of the model; any other color dyes it.', color(1, 1, 1), 2, 'Logo Colors'),
  colorParameter(CINEMA2_GO_TO_KEY_COLOR_ID, 'Key Light', 'The color of the main spot light in front of the logo.', DEFAULT_KEY, 3, 'Light Colors'),
  colorParameter(CINEMA2_GO_TO_RIM_COLOR_ID, 'Rim Light', 'The color of the spot light behind and to the right, which edges the logo.', DEFAULT_RIM, 4, 'Light Colors'),
  colorParameter(CINEMA2_GO_TO_ACCENT_COLOR_ID, 'Accent Light', 'The color of the spot light behind and to the left.', DEFAULT_ACCENT, 5, 'Light Colors'),
])

function spotLight(id: Cinema2LightId, lightColor: Cinema2Color, position: Cinema2Vector3, colorParameterId: Cinema2ParameterId, cone: number) {
  return Object.freeze({
    id,
    type: 'spot' as const,
    color: lightColor,
    intensity: RIG_BASE_INTENSITY,
    transform: Object.freeze({ position }),
    node: cinema2Ref(ROOT_NODE_ID),
    targetNode: cinema2Ref(CINEMA2_GO_TO_LOGO_NODE_ID),
    controls: Object.freeze({ color: cinema2Ref(colorParameterId) }),
    config: Object.freeze({ coneAngleDegrees: cone, penumbra: 0.5, range: 24 }),
  })
}

const targetId = (name: string) => cinema2StableId<Cinema2RenderTargetId>(`go-to-${name}-target`)
const passId = (name: string) => cinema2StableId<Cinema2RenderPassId>(`go-to-${name}-pass`)
const slotId = (name: string) => cinema2StableId<Cinema2RenderSlotId>(`go-to-${name}`)
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

const viewportTarget = (id: Cinema2RenderTargetId, depth = false) => Object.freeze({
  id,
  descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba8' as const, ...(depth ? { depthFormat: 'depth24' as const } : {}) }),
  ownership: 'transient' as const,
})

/** A fullscreen effect pass reading the previous pass's color (and optionally the scene depth) and writing one target. */
function effectPass(id: Cinema2RenderPassId, after: Cinema2RenderPassId, afterOutput: Cinema2RenderSlotId, effect: Cinema2EffectId, name: string, output: Cinema2RenderTargetId | null, withDepth: boolean) {
  const colorInput = slotId(`${name}-color-input`)
  const inputs = [
    Object.freeze({ id: colorInput, source: Object.freeze({ pass: cinema2Ref(after), output: afterOutput }), attachment: 'color' as const }),
    ...(withDepth ? [Object.freeze({ id: slotId(`${name}-depth-input`), source: Object.freeze({ pass: cinema2Ref(SCENE_PASS_ID), output: SCENE_DEPTH_ID }), attachment: 'depth' as const })] : []),
  ]
  return Object.freeze({
    id,
    kind: 'fullscreen' as const,
    dependsOn: Object.freeze([cinema2Ref(after)]),
    effect: cinema2Ref(effect),
    inputs: Object.freeze(inputs),
    ...(output ? { outputs: Object.freeze([Object.freeze({ id: slotId(`${name}-output`), target: cinema2Ref(output), attachment: 'color' as const })]) } : {}),
  })
}

const master = cinema2Ref(CINEMA2_GO_TO_MASTER_INTENSITY_ID)

export const CINEMA2_GO_TO_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_GO_TO_PRESET_ID,
  revision: 1,
  metadata: Object.freeze({
    name: 'GO-TO',
    description: 'The DVYDRM logo as a polished 3D metal object, slowly turning on a turntable. Colored spot lights rake through haze across its bevelled edges, a studio environment reflects in its surface, and a wet floor mirrors it.',
    tags: Object.freeze(['go-to', 'logo', 'native', '3d', 'metal', 'three', 'keeper']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native Cinema 2.0 Stage rendering and the 3D logo.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Depth-tested logo and depth-aware haze.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'The logo is a real 3D model placed in the Scene Graph.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Shared world camera: perspective, drift and tempo-locked sway around the logo.' }),
    Object.freeze({ id: 'lighting' as const, requirement: 'required' as const, purpose: 'Spot lights that scatter through the haze and glint off the logo.' }),
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'The key and side lights trade the stage every two beats.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Downbeat beam swell and side-light sweep.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'Light intensity lifts with the Visual Director build.' }),
  ]),
  parameters: PARAMETERS,
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_GO_TO_MODULE_ID,
    typeId: THREE_SCENE_TYPE_ID,
    version: 1,
    enabled: true,
    parameters: Object.freeze({
      color: color(1, 1, 1),
      metalness: 1,
      roughness: 0.18,
      clearcoat: 0.5,
      environmentIntensity: 1,
      spinTurnSeconds: 24,
      spinSync: true,
    }),
    parameterBindings: Object.freeze({
      color: cinema2Ref(CINEMA2_GO_TO_LOGO_TINT_ID),
      metalness: cinema2Ref(CINEMA2_GO_TO_METALNESS_ID),
      roughness: cinema2Ref(CINEMA2_GO_TO_ROUGHNESS_ID),
      clearcoat: cinema2Ref(CINEMA2_GO_TO_CLEARCOAT_ID),
      environmentIntensity: cinema2Ref(CINEMA2_GO_TO_REFLECTION_ID),
      spinTurnSeconds: cinema2Ref(CINEMA2_GO_TO_SPIN_PERIOD_ID),
      spinSync: cinema2Ref(CINEMA2_GO_TO_BPM_SYNC_ID),
    }),
    config: Object.freeze({
      instances: Object.freeze([Object.freeze({ asset: CINEMA2_DVYDRM_LOGO_ASSET_ID, node: CINEMA2_GO_TO_LOGO_NODE_ID, spin: true })]),
      environment: CINEMA2_STUDIO_ENVIRONMENT_ASSET_ID,
      // Two rectangular LED panels (high and medium quality): a broad key panel front-left and a magenta-cool strip behind-right, so the bevels catch clean bands of light.
      panels: Object.freeze([
        Object.freeze({ position: vec3(-3.4, 2.4, 3.6), target: vec3(0, 0, 0), size: Object.freeze([3.2, 2]), color: Object.freeze([0.88, 0.94, 1]), intensity: 6 }),
        Object.freeze({ position: vec3(3.6, 1.2, -3), target: vec3(0, 0, 0), size: Object.freeze([2.4, 2.2]), color: Object.freeze([1, 0.55, 0.9]), intensity: 5 }),
      ]),
    }),
  })]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
      Object.freeze({
        id: CINEMA2_GO_TO_LOGO_NODE_ID,
        kind: 'module' as const,
        parent: cinema2Ref(ROOT_NODE_ID),
        module: cinema2Ref(CINEMA2_GO_TO_MODULE_ID),
        transform: Object.freeze({ position: vec3(0, LOGO_HEIGHT, 0) }),
      }),
    ]),
    roots: Object.freeze([cinema2Ref(ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([Object.freeze({
    id: WORLD_LAYER_ID,
    label: 'GO-TO World',
    source: cinema2Ref(ROOT_NODE_ID),
    role: 'world' as const,
    depthPolicy: 'read-write' as const,
    order: 0,
  })]),
  cameras: Object.freeze([Object.freeze({
    id: CINEMA2_GO_TO_CAMERA_ID,
    label: 'GO-TO Front',
    projection: 'perspective' as const,
    fovDegrees: 32,
    near: 0.1,
    far: 40,
    transform: Object.freeze({ position: vec3(0, 0.42, 4.3) }),
    target: vec3(0, 0.02, 0),
    rig: Object.freeze({ kind: 'static' as const }),
    // Motion Amount scales this (0 = locked off): a slow handheld drift plus a small beat-locked sway (BPM Sync locks it to the track).
    motion: cinema2CinematicMotion('steady', {
      overrides: Object.freeze({
        drift: Object.freeze({ position: 0.08, target: 0.03, rollDegrees: 0.5, fovDegrees: 0.6, speed: 0.06 }),
        tempo: Object.freeze({ referenceBpm: 120, flightSpeed: false, weave: 0.06, bob: 0.01, roll: 0.6, fov: 0.8, punch: 0.6 }),
      }),
    }),
    controls: Object.freeze({ motionAmount: cinema2Ref(CINEMA2_GO_TO_MOTION_AMOUNT_ID), tempoSync: cinema2Ref(CINEMA2_GO_TO_BPM_SYNC_ID) }),
  })]),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_GO_TO_CAMERA_ID) }),
  lighting: Object.freeze({
    groups: Object.freeze([
      Object.freeze({ id: KEY_GROUP_ID, label: 'Key', lights: Object.freeze([cinema2Ref(CINEMA2_GO_TO_KEY_LIGHT_ID)]) }),
      Object.freeze({ id: SIDES_GROUP_ID, label: 'Sides', lights: Object.freeze([cinema2Ref(CINEMA2_GO_TO_RIM_LIGHT_ID), cinema2Ref(CINEMA2_GO_TO_ACCENT_LIGHT_ID)]) }),
    ]),
    lights: Object.freeze([
      spotLight(CINEMA2_GO_TO_KEY_LIGHT_ID, DEFAULT_KEY, vec3(-2.4, 4.4, 3.4), CINEMA2_GO_TO_KEY_COLOR_ID, 13),
      spotLight(CINEMA2_GO_TO_RIM_LIGHT_ID, DEFAULT_RIM, vec3(4.6, 4.2, -1.4), CINEMA2_GO_TO_RIM_COLOR_ID, 12),
      spotLight(CINEMA2_GO_TO_ACCENT_LIGHT_ID, DEFAULT_ACCENT, vec3(-4.8, 3.8, -1.2), CINEMA2_GO_TO_ACCENT_COLOR_ID, 12),
      Object.freeze({ id: AMBIENT_LIGHT_ID, type: 'ambient' as const, color: color(0.2, 0.25, 0.34), intensity: 0.3 }),
    ]),
  }),
  environment: Object.freeze({
    backgroundColor: DEFAULT_BACKGROUND,
    exposure: 1,
    fog: Object.freeze({ mode: 'exponential' as const, color: color(0.03, 0.045, 0.07), density: 0.01 }),
    controls: Object.freeze({ backgroundColor: cinema2Ref(CINEMA2_GO_TO_BACKGROUND_ID) }),
  }),
  effects: Object.freeze([
    Object.freeze({
      id: CINEMA2_GO_TO_FLOOR_EFFECT_ID,
      typeId: FLOOR_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 0,
      scope: 'output' as const,
      parameters: Object.freeze({
        mix: 1, floorY: FLOOR_Y, reflectivity: 0.3, roughness: 0.5, fresnel: 3, albedo: 0.1, poolIntensity: 2.2, specular: 1.4, fadeDistance: 40, maxReflection: 26,
      }),
      parameterBindings: Object.freeze({ reflectivity: cinema2Ref(CINEMA2_GO_TO_FLOOR_ID) }),
    }),
    Object.freeze({
      id: CINEMA2_GO_TO_VOLUMETRIC_EFFECT_ID,
      typeId: VOLUMETRIC_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 1,
      scope: 'output' as const,
      parameters: Object.freeze({
        mix: 1, density: 0.018, beamIntensity: 1, mistAmount: 0.3, mistHeight: 1.4, mistFloor: FLOOR_Y, floorY: FLOOR_Y, floorReflection: 0.3, anisotropy: 0.55,
        occlusion: 0.55, ambientHaze: 0.06, noiseScale: 0.32, noiseStrength: 0.65, drift: 0.12, maxDistance: 34, reactivity: 0.8,
      }),
      parameterBindings: Object.freeze({
        density: cinema2Ref(CINEMA2_GO_TO_HAZE_ID),
        beamIntensity: cinema2Ref(CINEMA2_GO_TO_BEAM_ID),
        mistAmount: cinema2Ref(CINEMA2_GO_TO_MIST_ID),
      }),
    }),
    Object.freeze({
      id: CINEMA2_GO_TO_BLOOM_EFFECT_ID,
      typeId: BLOOM_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 2,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 0.45, threshold: 0.55, radius: 2.4, intensity: 0.55 }),
      parameterBindings: Object.freeze({ intensity: cinema2Ref(CINEMA2_GO_TO_BLOOM_ID) }),
    }),
    Object.freeze({
      id: CINEMA2_GO_TO_FINISH_EFFECT_ID,
      typeId: FINISH_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 3,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, exposure: 1.25, vignette: 0.4, grain: 0.18, aberration: 0.2, contrast: 1.1, saturation: 1.08 }),
      parameterBindings: Object.freeze({ mix: cinema2Ref(CINEMA2_GO_TO_FINISH_ID) }),
    }),
  ]),
  choreography: Object.freeze({
    rules: Object.freeze([
      // The key and the two side lights trade the stage every two beats, the sides sweep on the downbeat and everything lifts with a build.
      ...cinema2LightRigAlternate({ id: 'go-to-rig', groups: [KEY_GROUP_ID, SIDES_GROUP_ID], everyBeats: 2, peak: RIG_PEAK_INTENSITY, priority: 40, strengthParameter: master }),
      ...cinema2LightRigHit({ id: 'go-to-rig-sides', group: SIDES_GROUP_ID, signal: 'downbeat', peak: 1.6, stagger: { beats: 0.25, order: 'forward' }, priority: 45, strengthParameter: master }),
      ...cinema2LightRigRamp({ id: 'go-to-rig', groups: [KEY_GROUP_ID, SIDES_GROUP_ID], source: 'director.build', lift: 0.9, priority: 30, strengthParameter: master }),
      Object.freeze({
        id: cinema2StableId<Cinema2ChoreographyRuleId>('go-to-downbeat-beam'),
        priority: 30,
        strengthParameter: master,
        source: Object.freeze({ signal: 'downbeat' as const, capability: 'music.downbeat' as const }),
        actions: Object.freeze([Object.freeze({
          id: cinema2StableId<Cinema2ChoreographyActionId>('go-to-downbeat-beam-swell'),
          target: Object.freeze({ kind: 'effect' as const, ref: cinema2Ref(CINEMA2_GO_TO_VOLUMETRIC_EFFECT_ID), property: 'beamIntensity' }),
          operation: 'envelope' as const,
          composition: 'add' as const,
          value: 2,
          envelope: Object.freeze({ attack: 0, hold: 0.1, release: 0.9, unit: 'beats' as const }),
          retrigger: 'restart' as const,
        })]),
      }),
    ]),
  }),
  render: Object.freeze({
    targets: Object.freeze([
      viewportTarget(SCENE_TARGET_ID, true),
      viewportTarget(FLOOR_TARGET_ID),
      viewportTarget(ATMOSPHERE_TARGET_ID),
      viewportTarget(BLOOM_TARGET_ID),
    ]),
    passes: Object.freeze([
      Object.freeze({
        id: SCENE_PASS_ID,
        kind: 'scene' as const,
        layers: Object.freeze([cinema2Ref(WORLD_LAYER_ID)]),
        outputs: Object.freeze([
          Object.freeze({ id: SCENE_COLOR_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'color' as const }),
          Object.freeze({ id: SCENE_DEPTH_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'depth' as const }),
        ]),
      }),
      effectPass(FLOOR_PASS_ID, SCENE_PASS_ID, SCENE_COLOR_ID, CINEMA2_GO_TO_FLOOR_EFFECT_ID, 'floor', FLOOR_TARGET_ID, true),
      effectPass(ATMOSPHERE_PASS_ID, FLOOR_PASS_ID, slotId('floor-output'), CINEMA2_GO_TO_VOLUMETRIC_EFFECT_ID, 'atmosphere', ATMOSPHERE_TARGET_ID, true),
      effectPass(BLOOM_PASS_ID, ATMOSPHERE_PASS_ID, slotId('atmosphere-output'), CINEMA2_GO_TO_BLOOM_EFFECT_ID, 'bloom', BLOOM_TARGET_ID, false),
      effectPass(FINISH_PASS_ID, BLOOM_PASS_ID, slotId('bloom-output'), CINEMA2_GO_TO_FINISH_EFFECT_ID, 'finish', null, false),
    ]),
    outputPass: cinema2Ref(FINISH_PASS_ID),
  }),
  output: Object.freeze({ renderPass: cinema2Ref(FINISH_PASS_ID), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
}) as Readonly<Cinema2NativePresetManifest>
