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
  type Cinema2ModuleTypeId,
  type Cinema2NativePresetManifest,
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
import { CINEMA2_ATL_HOE_ASSET_ID } from '../modules/three/Cinema2ThreeAssetManifest'
import { CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID } from '../modules/three/Cinema2ThreeEnvironmentRegistry'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'

export const CINEMA2_ATL_HOE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.atl-hoe')
export const CINEMA2_ATL_HOE_MODULE_ID = cinema2StableId<Cinema2ModuleId>('atl-hoe-scene')
export const CINEMA2_ATL_HOE_CAMERA_ID = cinema2StableId<Cinema2CameraId>('atl-hoe-camera')

const THREE_SCENE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('three-scene')
const ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('atl-hoe-root')
const MODEL_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('atl-hoe-model')
const SIGN_TARGET_ID = cinema2StableId<Cinema2SceneNodeId>('atl-hoe-sign-target')
const SKYLINE_TARGET_ID = cinema2StableId<Cinema2SceneNodeId>('atl-hoe-skyline-target')
const WORLD_LAYER_ID = cinema2StableId<Cinema2LayerId>('atl-hoe-world-layer')

const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('atl-hoe-ambient')
const MOON_LIGHT_ID = cinema2StableId<Cinema2LightId>('atl-hoe-moon-key')
const SIGN_LIGHT_ID = cinema2StableId<Cinema2LightId>('atl-hoe-sign-spill')
const CITY_LIGHT_ID = cinema2StableId<Cinema2LightId>('atl-hoe-city-spill')

const ATMOSPHERE_EFFECT_ID = cinema2StableId<Cinema2EffectId>('atl-hoe-atmosphere')
const BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('atl-hoe-bloom')
const FINISH_EFFECT_ID = cinema2StableId<Cinema2EffectId>('atl-hoe-finish')
const SCENE_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('atl-hoe-scene-target')
const ATMOSPHERE_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('atl-hoe-atmosphere-target')
const BLOOM_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('atl-hoe-bloom-target')
const SCENE_PASS_ID = cinema2StableId<Cinema2RenderPassId>('atl-hoe-scene-pass')
const ATMOSPHERE_PASS_ID = cinema2StableId<Cinema2RenderPassId>('atl-hoe-atmosphere-pass')
const BLOOM_PASS_ID = cinema2StableId<Cinema2RenderPassId>('atl-hoe-bloom-pass')
const FINISH_PASS_ID = cinema2StableId<Cinema2RenderPassId>('atl-hoe-finish-pass')
const SCENE_COLOR_ID = cinema2StableId<Cinema2RenderSlotId>('atl-hoe-scene-color')
const SCENE_DEPTH_ID = cinema2StableId<Cinema2RenderSlotId>('atl-hoe-scene-depth')
const ATMOSPHERE_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('atl-hoe-atmosphere-output')
const BLOOM_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('atl-hoe-bloom-output')

const vec3 = (x: number, y: number, z: number): Cinema2Vector3 => Object.freeze([x, y, z])
const color = (r: number, g: number, b: number, a = 1): Cinema2Color => Object.freeze([r, g, b, a])
const slotId = (name: string) => cinema2StableId<Cinema2RenderSlotId>(`atl-hoe-${name}`)

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
  label: string,
  output: Cinema2RenderTargetId | null,
  depth = false,
) {
  return Object.freeze({
    id,
    kind: 'fullscreen' as const,
    dependsOn: Object.freeze([cinema2Ref(after)]),
    effect: cinema2Ref(effect),
    inputs: Object.freeze([
      Object.freeze({ id: slotId(`${label}-color-input`), source: Object.freeze({ pass: cinema2Ref(after), output: afterOutput }), attachment: 'color' as const }),
      ...(depth ? [Object.freeze({ id: slotId(`${label}-depth-input`), source: Object.freeze({ pass: cinema2Ref(SCENE_PASS_ID), output: SCENE_DEPTH_ID }), attachment: 'depth' as const })] : []),
    ]),
    ...(output ? { outputs: Object.freeze([Object.freeze({ id: label === 'atmosphere' ? ATMOSPHERE_OUTPUT_ID : BLOOM_OUTPUT_ID, target: cinema2Ref(output), attachment: 'color' as const })]) } : {}),
  })
}

function spot(id: Cinema2LightId, at: Cinema2Vector3, target: Cinema2SceneNodeId, intensity: number, lightColor: Cinema2Color, coneAngleDegrees: number) {
  return Object.freeze({
    id,
    type: 'spot' as const,
    color: lightColor,
    intensity,
    transform: Object.freeze({ position: at }),
    targetNode: cinema2Ref(target),
    config: Object.freeze({ coneAngleDegrees, penumbra: 0.7, range: 52 }),
  })
}

/**
 * ATL HOE is deliberately static in its first milestone. The camera, geometry,
 * light rig and finish are production-native, while audio choreography remains
 * absent until the visual composition is approved.
 */
export const CINEMA2_ATL_HOE_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_ATL_HOE_PRESET_ID,
  revision: 1,
  metadata: Object.freeze({
    name: 'ATL HOE',
    description: 'A fully modeled Waffle House roadside sign against a deep-blue night sky and foreground canopy.',
    tags: Object.freeze(['atlanta', 'waffle-house', 'night', '3d', 'three', 'keeper']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native Cinema 2.0 HDR rendering of the complete night scene.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Depth-tested sign, skyline layers, foliage and depth-aware atmospheric haze.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'The sign, letterforms, towers, windows, freeway and trees are modeled geometry.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'A locked cinematic camera composes the foreground sign against the Atlanta landmarks.' }),
    Object.freeze({ id: 'lighting' as const, requirement: 'required' as const, purpose: 'Moonlight, sign spill and skyline fill shape the modeled scene.' }),
  ]),
  parameters: Object.freeze([CINEMA2_QUALITY_MODE_PARAMETER]),
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_ATL_HOE_MODULE_ID,
    typeId: THREE_SCENE_TYPE_ID,
    version: 1,
    enabled: true,
    parameters: Object.freeze({
      environmentIntensity: 0.38,
      'stars.emissive': color(0.58, 0.72, 0.92),
      'stars.emissiveIntensity': 3,
      'warmWindows.emissive': color(1, 0.6, 0.12),
      'warmWindows.emissiveIntensity': 1.45,
      'crown.emissive': color(1, 0.62, 0.16),
      'crown.emissiveIntensity': 2.2,
      'cyanWindows.emissive': color(0.1, 0.9, 0.85),
      'cyanWindows.emissiveIntensity': 1.8,
      'glassWindows.emissive': color(0.22, 0.33, 0.46),
      'glassWindows.emissiveIntensity': 0.9,
      'crownCool.emissive': color(0.6, 0.9, 1),
      'crownCool.emissiveIntensity': 1.6,
      'truistWindows.emissive': color(0.15, 0.9, 0.9),
      'truistWindows.emissiveIntensity': 1.4,
      'bofaCore.emissive': color(1, 0.5, 0.1),
      'bofaCore.emissiveIntensity': 0.3,
      'bofaGlow.emissive': color(1, 0.45, 0.12),
      'bofaGlow.emissiveIntensity': 1.6,
      'crownWhite.emissive': color(1, 0.92, 0.72),
      'crownWhite.emissiveIntensity': 2.4,
      'beacon.emissive': color(1, 0.05, 0.03),
      'beacon.emissiveIntensity': 3,
      // The sign: near-black painted steel (cabinet, frames, rail, legs) around flat, bright yellow faces and flat black letters.
      'signGlow.color': color(1, 0.78, 0),
      'signGlow.emissive': color(1, 0.65, 0.01),
      'signGlow.emissiveIntensity': 1.25,
      'signGlow.roughness': 0.5,
      'signBorder.color': color(0.006, 0.007, 0.009),
      'signBorder.emissive': color(0.001, 0.002, 0.004),
      'signBorder.emissiveIntensity': 1,
      'signBorder.roughness': 0.42,
      'signLetters.color': color(0.004, 0.004, 0.004),
      'signLetters.roughness': 0.82,
      'signMetal.roughness': 0.38,
      'signMetal.environmentIntensity': 0.55,
      'signTrim.roughness': 0.28,
      'signTrim.environmentIntensity': 0.7,
      'landmarkGlass.environmentIntensity': 0.48,
      'landmarkGlass.roughness': 0.26,
      'buildings.environmentIntensity': 0.3,
      'distantBuildings.environmentIntensity': 0.12,
      'midBuildings.environmentIntensity': 0.22,
      'nearBuildings.environmentIntensity': 0.34,
      'landmarkDark.environmentIntensity': 0.44,
      'road.environmentIntensity': 0,
      'roadGlow.emissive': color(1, 0.4, 0.06),
      'roadGlow.emissiveIntensity': 1.3,
      'foliageBack.environmentIntensity': 0.12,
      'foliage.environmentIntensity': 0.3,
      'foliageFaint.emissive': color(0.05, 0.14, 0.2),
      'foliageFaint.emissiveIntensity': 0.55,
      'foliageLit.emissive': color(1, 0.5, 0.1),
      'foliageLit.emissiveIntensity': 0.9,
    }),
    config: Object.freeze({
      instances: Object.freeze([Object.freeze({ asset: CINEMA2_ATL_HOE_ASSET_ID, node: MODEL_NODE_ID })]),
      hdr: true,
      parts: Object.freeze(['stars', 'road', 'roadPole', 'roadGlow', 'bofaGlass', 'bofaRib', 'bofaCore', 'bofaStone', 'bofaGlow', 'truistBody', 'truistCrown', 'truistWindows', 'warmWindows', 'glassWindows', 'cyanWindows', 'crownCool', 'crown', 'crownWhite', 'beacon', 'gpStone', 'gpStoneB', 'gpStoneC', 'gpLedge', 'gpSlot', 'landmarkDark', 'landmarkGlass', 'distantBuildings', 'midBuildings', 'nearBuildings', 'signMetal', 'signTrim', 'signGlow', 'signBorder', 'signLetters', 'foliageBack', 'foliage', 'foliageFaint', 'foliageLit']),
      environment: CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID,
      panels: Object.freeze([
        Object.freeze({ position: vec3(-9, 10.5, 11), target: vec3(-5, 6.6, 3), size: Object.freeze([7, 5]), color: Object.freeze([0.28, 0.42, 0.62]), intensity: 0.85 }),
        Object.freeze({ position: vec3(7, 14, 5), target: vec3(2.5, 7, -16), size: Object.freeze([8, 6]), color: Object.freeze([0.25, 0.38, 0.56]), intensity: 0.48 }),
      ]),
    }),
  })]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
      Object.freeze({ id: MODEL_NODE_ID, kind: 'module' as const, parent: cinema2Ref(ROOT_NODE_ID), module: cinema2Ref(CINEMA2_ATL_HOE_MODULE_ID) }),
      Object.freeze({ id: SIGN_TARGET_ID, kind: 'group' as const, parent: cinema2Ref(ROOT_NODE_ID), transform: Object.freeze({ position: vec3(-1.8, 6, 9) }) }),
      Object.freeze({ id: SKYLINE_TARGET_ID, kind: 'group' as const, parent: cinema2Ref(ROOT_NODE_ID), transform: Object.freeze({ position: vec3(8, 7, -17) }) }),
    ]),
    roots: Object.freeze([cinema2Ref(ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([Object.freeze({ id: WORLD_LAYER_ID, label: 'ATL HOE World', source: cinema2Ref(ROOT_NODE_ID), role: 'world' as const, depthPolicy: 'read-write' as const, order: 0 })]),
  cameras: Object.freeze([Object.freeze({
    id: CINEMA2_ATL_HOE_CAMERA_ID,
    label: 'Atlanta Night View',
    projection: 'perspective' as const,
    fovDegrees: 42,
    // The embedded Stage is close to square; this keeps the authored width
    // without opening the vertical frame so far that the skyline sinks.
    minAspect: 16 / 9,
    // On a taller Stage, half of the extra height goes above the composition so the sign and trees sit lower than dead centre.
    // 0 keeps the view centred; 1 pins the 16:9 composition to the bottom edge.
    minAspectAnchor: 0.5,
    near: 0.1,
    far: 90,
    transform: Object.freeze({ position: vec3(0, 5.9, 20) }),
    target: vec3(-0.4, 6.55, -8.4),
    rig: Object.freeze({ kind: 'static' as const }),
  })]),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_ATL_HOE_CAMERA_ID) }),
  lighting: Object.freeze({
    lights: Object.freeze([
      spot(MOON_LIGHT_ID, vec3(-10, 18, 12), SKYLINE_TARGET_ID, 0.95, color(0.34, 0.49, 0.72), 48),
      spot(SIGN_LIGHT_ID, vec3(3, 9, 19), SIGN_TARGET_ID, 0, color(1, 0.93, 0.78), 26),
      spot(CITY_LIGHT_ID, vec3(7, 4, -4), SKYLINE_TARGET_ID, 0.38, color(1, 0.45, 0.12), 52),
      Object.freeze({ id: AMBIENT_LIGHT_ID, type: 'ambient' as const, color: color(0.18, 0.29, 0.46), intensity: 0.62 }),
    ]),
  }),
  environment: Object.freeze({
    backgroundColor: color(0.025, 0.07, 0.14),
    exposure: 1.03,
    fog: Object.freeze({ mode: 'exponential' as const, color: color(0.028, 0.06, 0.105), density: 0.008 }),
  }),
  effects: Object.freeze([
    Object.freeze({
      id: ATMOSPHERE_EFFECT_ID,
      typeId: CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 0,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, density: 0.0035, beamIntensity: 0.075, mistAmount: 0.045, mistHeight: 2.2, mistFloor: -1.2, floorY: -1.2, floorReflection: 0, anisotropy: 0.46, occlusion: 0.72, ambientHaze: 0.008, noiseScale: 0.24, noiseStrength: 0.38, drift: 0.025, maxDistance: 62, reactivity: 0 }),
    }),
    Object.freeze({
      id: BLOOM_EFFECT_ID,
      typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 1,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, threshold: 1.18, knee: 0.32, intensity: 0.58, spread: 0.52, levels: 7 }),
    }),
    Object.freeze({
      id: FINISH_EFFECT_ID,
      typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 2,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, toneMap: 1, exposure: 0.9, temperature: -0.018, vignette: 0.27, grain: 0.035, aberration: 0.012, contrast: 1.12, saturation: 1.05 }),
    }),
  ]),
  render: Object.freeze({
    targets: Object.freeze([viewportTarget(SCENE_TARGET_ID, true), viewportTarget(ATMOSPHERE_TARGET_ID), viewportTarget(BLOOM_TARGET_ID)]),
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
      effectPass(BLOOM_PASS_ID, ATMOSPHERE_PASS_ID, ATMOSPHERE_OUTPUT_ID, BLOOM_EFFECT_ID, 'bloom', BLOOM_TARGET_ID),
      effectPass(FINISH_PASS_ID, BLOOM_PASS_ID, BLOOM_OUTPUT_ID, FINISH_EFFECT_ID, 'finish', null),
    ]),
    outputPass: cinema2Ref(FINISH_PASS_ID),
  }),
  output: Object.freeze({ renderPass: cinema2Ref(FINISH_PASS_ID), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
}) as Readonly<Cinema2NativePresetManifest>
