import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
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
import { CINEMA2_DEPTH_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2DepthNativeModule'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'

export const CINEMA2_DEPTH_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.depth')
export const CINEMA2_DEPTH_MODULE_ID = cinema2StableId<Cinema2ModuleId>('depth-tunnel')
export const CINEMA2_DEPTH_CAMERA_ID = cinema2StableId<Cinema2CameraId>('depth-camera')

const parameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`depth-${name}`)
export const CINEMA2_DEPTH_INTENSITY_ID = parameterId('intensity')
export const CINEMA2_DEPTH_PROGRAM_ID = parameterId('program')
export const CINEMA2_DEPTH_DIRECTION_ID = parameterId('direction')
export const CINEMA2_DEPTH_RATE_ID = parameterId('rate')
export const CINEMA2_DEPTH_ACTIVE_SPAN_ID = parameterId('active-span')
export const CINEMA2_DEPTH_SEED_ID = parameterId('seed')
export const CINEMA2_DEPTH_SPILL_ID = parameterId('spill')
export const CINEMA2_DEPTH_CENTER_ENABLED_ID = parameterId('center-enabled')
export const CINEMA2_DEPTH_CENTER_SCALE_ID = parameterId('center-scale')
export const CINEMA2_DEPTH_CENTER_INTENSITY_ID = parameterId('center-intensity')
export const CINEMA2_DEPTH_HAZE_ID = parameterId('haze')
export const CINEMA2_DEPTH_BLOOM_ID = parameterId('bloom')
export const CINEMA2_DEPTH_FINISH_ID = parameterId('finish')
export const CINEMA2_DEPTH_BACKGROUND_ID = parameterId('background')
export const CINEMA2_DEPTH_LIGHT_COLOR_ID = parameterId('light-color')
export const CINEMA2_DEPTH_BODY_COLOR_ID = parameterId('body-color')

const ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('depth-root')
const TUNNEL_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('depth-tunnel-node')
const WORLD_LAYER_ID = cinema2StableId<Cinema2LayerId>('depth-world-layer')
const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('depth-ambient')
const HAZE_LIGHT_ID = cinema2StableId<Cinema2LightId>('depth-haze-light')

const ATMOSPHERE_EFFECT_ID = cinema2StableId<Cinema2EffectId>('depth-atmosphere-effect')
const BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('depth-bloom-effect')
const FINISH_EFFECT_ID = cinema2StableId<Cinema2EffectId>('depth-finish-effect')

const targetId = (name: string) => cinema2StableId<Cinema2RenderTargetId>(`depth-${name}-target`)
const passId = (name: string) => cinema2StableId<Cinema2RenderPassId>(`depth-${name}-pass`)
const slotId = (name: string) => cinema2StableId<Cinema2RenderSlotId>(`depth-${name}`)
const SCENE_TARGET_ID = targetId('scene')
const ATMOSPHERE_TARGET_ID = targetId('atmosphere')
const BLOOM_TARGET_ID = targetId('bloom')
const SCENE_PASS_ID = passId('scene')
const ATMOSPHERE_PASS_ID = passId('atmosphere')
const BLOOM_PASS_ID = passId('bloom')
const FINISH_PASS_ID = passId('finish')
const SCENE_COLOR_ID = slotId('scene-color')
const SCENE_DEPTH_ID = slotId('scene-depth')

const vec3 = (x: number, y: number, z: number): Cinema2Vector3 => Object.freeze([x, y, z])
const color = (r: number, g: number, b: number, a = 1): Cinema2Color => Object.freeze([r, g, b, a])
const DEFAULT_BACKGROUND = color(0.0015, 0.002, 0.004)
const DEFAULT_LIGHT = color(0.86, 0.9, 1)
const DEFAULT_BODY = color(0.012, 0.014, 0.021)

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

/** Step-2 procedural light-program proof for the Depth tunnel. */
export const CINEMA2_DEPTH_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_DEPTH_PRESET_ID,
  revision: 2,
  metadata: Object.freeze({
    name: 'Depth',
    description: 'A deep procedural tunnel of dark square portals and cool-white HDR light strips.',
    tags: Object.freeze(['keeper', '3d', 'tunnel', 'depth', 'light']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Instanced procedural portal rendering.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Correct portal occlusion and depth-aware atmosphere.' }),
    Object.freeze({ id: 'render.hdr' as const, requirement: 'optional' as const, purpose: 'Preserves light-strip values above white for HDR bloom, with an 8-bit fallback.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'World-space tunnel geometry.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Perspective view through the portal sequence.' }),
    Object.freeze({ id: 'lighting' as const, requirement: 'required' as const, purpose: 'Low ambient structure visibility and atmospheric scattering.' }),
    Object.freeze({ id: 'audio.transport' as const, requirement: 'optional' as const, purpose: 'Transport-safe light-program timing when a track is present.' }),
  ]),
  parameters: Object.freeze([
    CINEMA2_QUALITY_MODE_PARAMETER,
    floatParameter(CINEMA2_DEPTH_INTENSITY_ID, 'Intensity', 'Master brightness of the portal lights and center object.', 1, 0, 2, 0.01, 'master-controls', 1, 'Light'),
    Object.freeze({
      ...parameterBase,
      id: CINEMA2_DEPTH_PROGRAM_ID,
      label: 'Light Program',
      description: 'Choose how portal faces illuminate across the depth of the tunnel.',
      type: 'enum' as const,
      defaultValue: 'depthChase',
      designParentGroup: 'design' as const,
      order: 1,
      group: 'Light Program',
      options: Object.freeze([
        Object.freeze({ value: 'depthChase', label: 'Depth Chase' }),
        Object.freeze({ value: 'sideOrbit', label: 'Side Orbit' }),
        Object.freeze({ value: 'gatePulse', label: 'Gate Pulse' }),
        Object.freeze({ value: 'alternatingFrames', label: 'Alternating Frames' }),
        Object.freeze({ value: 'fullPulse', label: 'Full Pulse' }),
      ]),
    }),
    Object.freeze({
      ...parameterBase,
      id: CINEMA2_DEPTH_DIRECTION_ID,
      label: 'Direction',
      description: 'Run directional light programs deeper into the tunnel or back toward the camera.',
      type: 'enum' as const,
      defaultValue: 'forward',
      designParentGroup: 'design' as const,
      order: 2,
      group: 'Light Program',
      options: Object.freeze([
        Object.freeze({ value: 'forward', label: 'Forward' }),
        Object.freeze({ value: 'reverse', label: 'Reverse' }),
      ]),
    }),
    floatParameter(CINEMA2_DEPTH_RATE_ID, 'Rate', 'Light-program travel or pulse rate. Zero freezes the selected state.', 1.1, 0, 4, 0.05, 'design', 3, 'Light Program'),
    Object.freeze({ ...parameterBase, id: CINEMA2_DEPTH_ACTIVE_SPAN_ID, label: 'Active Span', description: 'Approximate number of neighboring portals illuminated by depth-based programs.', type: 'integer' as const, defaultValue: 3, min: 1, max: 10, step: 1, designParentGroup: 'design' as const, order: 4, group: 'Light Program' }),
    Object.freeze({ ...parameterBase, id: CINEMA2_DEPTH_SEED_ID, label: 'Random Seed', description: 'Deterministic starting phase for every light program.', type: 'integer' as const, defaultValue: 7, min: 0, max: 9999, step: 1, designParentGroup: 'design' as const, order: 5, group: 'Light Program' }),
    floatParameter(CINEMA2_DEPTH_SPILL_ID, 'Light Spill', 'How strongly active strips reveal the nearby dark structure.', 0.72, 0, 2, 0.01, 'design', 6, 'Material'),
    Object.freeze({ ...parameterBase, id: CINEMA2_DEPTH_CENTER_ENABLED_ID, label: 'Center Object', description: 'Show the emissive object at the tunnel vanishing point.', type: 'boolean' as const, defaultValue: true, designParentGroup: 'design' as const, order: 7, group: 'Center Object' }),
    Object.freeze({ ...floatParameter(CINEMA2_DEPTH_CENTER_SCALE_ID, 'Center Size', 'Scale of the object at the tunnel vanishing point.', 1, 0.25, 4, 0.05, 'design', 8, 'Center Object'), visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: CINEMA2_DEPTH_CENTER_ENABLED_ID, value: true })]) }),
    Object.freeze({ ...floatParameter(CINEMA2_DEPTH_CENTER_INTENSITY_ID, 'Center Intensity', 'Emissive brightness of the object at the tunnel vanishing point.', 0.38, 0, 2, 0.01, 'design', 9, 'Center Object'), visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: CINEMA2_DEPTH_CENTER_ENABLED_ID, value: true })]) }),
    floatParameter(CINEMA2_DEPTH_HAZE_ID, 'Atmosphere', 'Depth-aware haze that separates the nested portals.', 0.014, 0, 0.12, 0.001, 'effects', 1, 'Atmosphere'),
    floatParameter(CINEMA2_DEPTH_BLOOM_ID, 'Bloom', 'Wide HDR glow around the light strips.', 0.82, 0, 3, 0.01, 'effects', 2, 'Post'),
    floatParameter(CINEMA2_DEPTH_FINISH_ID, 'Cinematic Finish', 'Tone curve, contrast, vignette and restrained grain.', 1, 0, 1, 0.01, 'effects', 3, 'Post'),
    colorParameter(CINEMA2_DEPTH_BACKGROUND_ID, 'Background', 'Near-black void behind the tunnel.', DEFAULT_BACKGROUND, 1),
    colorParameter(CINEMA2_DEPTH_LIGHT_COLOR_ID, 'Light Color', 'Color of the portal strips and their local spill.', DEFAULT_LIGHT, 2),
    colorParameter(CINEMA2_DEPTH_BODY_COLOR_ID, 'Structure Color', 'Base color of the dark portal bodies, nodes and rails.', DEFAULT_BODY, 3),
  ]),
  modules: Object.freeze([
    Object.freeze({
      id: CINEMA2_DEPTH_MODULE_ID,
      typeId: CINEMA2_DEPTH_NATIVE_MODULE_TYPE_ID,
      version: 1,
      enabled: true,
      config: Object.freeze({ portalCount: 10, aperture: 7.4, spacing: 4.2, frameThickness: 0.5 }),
      parameters: Object.freeze({
        intensity: 1,
        program: 'depthChase',
        direction: 'forward',
        rate: 1.1,
        activeSpan: 3,
        seed: 7,
        spill: 0.72,
        centerEnabled: true,
        centerScale: 1,
        centerIntensity: 0.38,
        lightColor: DEFAULT_LIGHT,
        bodyColor: DEFAULT_BODY,
      }),
      parameterBindings: Object.freeze({
        intensity: cinema2Ref(CINEMA2_DEPTH_INTENSITY_ID),
        program: cinema2Ref(CINEMA2_DEPTH_PROGRAM_ID),
        direction: cinema2Ref(CINEMA2_DEPTH_DIRECTION_ID),
        rate: cinema2Ref(CINEMA2_DEPTH_RATE_ID),
        activeSpan: cinema2Ref(CINEMA2_DEPTH_ACTIVE_SPAN_ID),
        seed: cinema2Ref(CINEMA2_DEPTH_SEED_ID),
        spill: cinema2Ref(CINEMA2_DEPTH_SPILL_ID),
        centerEnabled: cinema2Ref(CINEMA2_DEPTH_CENTER_ENABLED_ID),
        centerScale: cinema2Ref(CINEMA2_DEPTH_CENTER_SCALE_ID),
        centerIntensity: cinema2Ref(CINEMA2_DEPTH_CENTER_INTENSITY_ID),
        lightColor: cinema2Ref(CINEMA2_DEPTH_LIGHT_COLOR_ID),
        bodyColor: cinema2Ref(CINEMA2_DEPTH_BODY_COLOR_ID),
      }),
    }),
  ]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
      Object.freeze({ id: TUNNEL_NODE_ID, kind: 'module' as const, parent: cinema2Ref(ROOT_NODE_ID), module: cinema2Ref(CINEMA2_DEPTH_MODULE_ID) }),
    ]),
    roots: Object.freeze([cinema2Ref(ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([
    Object.freeze({ id: WORLD_LAYER_ID, label: 'Depth Tunnel', source: cinema2Ref(ROOT_NODE_ID), role: 'world', depthPolicy: 'read-write' as const, order: 0 }),
  ]),
  cameras: Object.freeze([
    Object.freeze({
      id: CINEMA2_DEPTH_CAMERA_ID,
      label: 'Depth Proof Camera',
      projection: 'perspective' as const,
      fovDegrees: 59,
      minAspect: 1,
      near: 0.25,
      far: 90,
      transform: Object.freeze({ position: vec3(1.05, 0.75, 8.4) }),
      target: vec3(0, 0, -24),
      rig: Object.freeze({ kind: 'static' as const }),
      motion: Object.freeze({ rollDegrees: -7 }),
    }),
  ]),
  lighting: Object.freeze({
    lights: Object.freeze([
      Object.freeze({ id: AMBIENT_LIGHT_ID, type: 'ambient' as const, color: color(0.3, 0.34, 0.44), intensity: 0.08 }),
      Object.freeze({ id: HAZE_LIGHT_ID, type: 'point' as const, color: DEFAULT_LIGHT, intensity: 0.5, transform: Object.freeze({ position: vec3(0, 0, -30) }), config: Object.freeze({ range: 42 }) }),
    ]),
  }),
  environment: Object.freeze({
    backgroundColor: DEFAULT_BACKGROUND,
    exposure: 1,
    controls: Object.freeze({ backgroundColor: cinema2Ref(CINEMA2_DEPTH_BACKGROUND_ID) }),
  }),
  effects: Object.freeze([
    Object.freeze({
      id: ATMOSPHERE_EFFECT_ID,
      typeId: CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 0,
      scope: 'output' as const,
      parameters: Object.freeze({
        mix: 1, density: 0.014, beamIntensity: 0.22, mistAmount: 0, mistHeight: 0.5, mistFloor: -4.5, floorY: -4.5, floorReflection: 0,
        anisotropy: 0.48, occlusion: 0.72, ambientHaze: 0.035, noiseScale: 0.34, noiseStrength: 0.22, drift: 0.04, maxDistance: 72, reactivity: 0,
      }),
      parameterBindings: Object.freeze({ density: cinema2Ref(CINEMA2_DEPTH_HAZE_ID) }),
    }),
    Object.freeze({
      id: BLOOM_EFFECT_ID,
      typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 1,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, threshold: 1.05, knee: 0.7, intensity: 0.82, spread: 0.78, levels: 7 }),
      parameterBindings: Object.freeze({ intensity: cinema2Ref(CINEMA2_DEPTH_BLOOM_ID) }),
    }),
    Object.freeze({
      id: FINISH_EFFECT_ID,
      typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 2,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, toneMap: 1, exposure: 1, contrast: 1.16, saturation: 0.82, vignette: 0.62, grain: 0.045, aberration: 0.025 }),
      parameterBindings: Object.freeze({ mix: cinema2Ref(CINEMA2_DEPTH_FINISH_ID) }),
    }),
  ]),
  render: Object.freeze({
    targets: Object.freeze([
      viewportTarget(SCENE_TARGET_ID, true),
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
      effectPass(ATMOSPHERE_PASS_ID, SCENE_PASS_ID, SCENE_COLOR_ID, ATMOSPHERE_EFFECT_ID, 'atmosphere', ATMOSPHERE_TARGET_ID, true),
      effectPass(BLOOM_PASS_ID, ATMOSPHERE_PASS_ID, slotId('atmosphere-output'), BLOOM_EFFECT_ID, 'bloom', BLOOM_TARGET_ID, false),
      effectPass(FINISH_PASS_ID, BLOOM_PASS_ID, slotId('bloom-output'), FINISH_EFFECT_ID, 'finish', null, false),
    ]),
    outputPass: cinema2Ref(FINISH_PASS_ID),
  }),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_DEPTH_CAMERA_ID) }),
  output: Object.freeze({ renderPass: cinema2Ref(FINISH_PASS_ID), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
})
