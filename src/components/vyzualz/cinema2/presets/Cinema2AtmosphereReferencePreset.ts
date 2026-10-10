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
import { CINEMA2_ATMOSPHERE_MONOLITHS_ASSET_ID } from '../modules/three/Cinema2ThreeAssetManifest'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { cinema2CinematicMotion } from './Cinema2CameraMotionAuthoring'
import {
  cinema2LightRigAlternate,
  cinema2LightRigHit,
  cinema2LightRigPhraseArrangement,
  cinema2LightRigRamp,
} from './Cinema2LightRigAuthoring'

export const CINEMA2_ATMOSPHERE_REFERENCE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.atmosphere-reference')
const THREE_SCENE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('three-scene')
const VOLUMETRIC_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('volumetric-atmosphere')
const BLOOM_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('bloom')
const FLOOR_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('reflective-floor')
const FINISH_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('cinematic-finish')
/** World height of the virtual floor plane; the volumetric mist and beam reflections use the same plane. */
const FLOOR_Y = -1.2

export const CINEMA2_ATMOSPHERE_REFERENCE_DENSITY_ID = cinema2StableId<Cinema2ParameterId>('atmosphere-reference-density')
export const CINEMA2_ATMOSPHERE_REFERENCE_BEAM_ID = cinema2StableId<Cinema2ParameterId>('atmosphere-reference-beam')
export const CINEMA2_ATMOSPHERE_REFERENCE_MIST_ID = cinema2StableId<Cinema2ParameterId>('atmosphere-reference-mist')
export const CINEMA2_ATMOSPHERE_REFERENCE_REACTIVITY_ID = cinema2StableId<Cinema2ParameterId>('atmosphere-reference-reactivity')
export const CINEMA2_ATMOSPHERE_REFERENCE_BLOOM_ID = cinema2StableId<Cinema2ParameterId>('atmosphere-reference-bloom')
export const CINEMA2_ATMOSPHERE_REFERENCE_FLOOR_ID = cinema2StableId<Cinema2ParameterId>('atmosphere-reference-floor')
export const CINEMA2_ATMOSPHERE_REFERENCE_MOTION_ID = cinema2StableId<Cinema2ParameterId>('atmosphere-reference-camera-motion')
export const CINEMA2_ATMOSPHERE_REFERENCE_FINISH_ID = cinema2StableId<Cinema2ParameterId>('atmosphere-reference-finish')
export const CINEMA2_ATMOSPHERE_REFERENCE_CRACK_GLOW_ID = cinema2StableId<Cinema2ParameterId>('atmosphere-reference-crack-glow')
export const CINEMA2_ATMOSPHERE_REFERENCE_CRYSTAL_CLARITY_ID = cinema2StableId<Cinema2ParameterId>('atmosphere-reference-crystal-clarity')
export const CINEMA2_ATMOSPHERE_REFERENCE_CRYSTAL_SPARKLE_ID = cinema2StableId<Cinema2ParameterId>('atmosphere-reference-crystal-sparkle')
/** Accent colour of each monolith's cracks, keyed by the model's part name. */
export const CINEMA2_ATMOSPHERE_REFERENCE_ACCENT_IDS = Object.freeze({
  left: cinema2StableId<Cinema2ParameterId>('atmosphere-reference-accent-left'),
  violet: cinema2StableId<Cinema2ParameterId>('atmosphere-reference-accent-violet'),
  right: cinema2StableId<Cinema2ParameterId>('atmosphere-reference-accent-right'),
  back: cinema2StableId<Cinema2ParameterId>('atmosphere-reference-accent-back'),
})

export const CINEMA2_ATMOSPHERE_REFERENCE_CAMERA_ID = cinema2StableId<Cinema2CameraId>('atmosphere-reference-camera')
export const CINEMA2_ATMOSPHERE_REFERENCE_LEFT_LIGHT_ID = cinema2StableId<Cinema2LightId>('atmosphere-reference-left-spot')
export const CINEMA2_ATMOSPHERE_REFERENCE_CENTER_LIGHT_ID = cinema2StableId<Cinema2LightId>('atmosphere-reference-center-spot')
export const CINEMA2_ATMOSPHERE_REFERENCE_RIGHT_LIGHT_ID = cinema2StableId<Cinema2LightId>('atmosphere-reference-right-spot')
export const CINEMA2_ATMOSPHERE_REFERENCE_KEY_GROUP_ID = cinema2StableId<Cinema2LightGroupId>('atmosphere-reference-key')
export const CINEMA2_ATMOSPHERE_REFERENCE_SIDES_GROUP_ID = cinema2StableId<Cinema2LightGroupId>('atmosphere-reference-sides')
/** Idle spot intensity; the rig lifts groups above it on the beat. */
const RIG_BASE_INTENSITY = 0.9
const RIG_PEAK_INTENSITY = 2.6
const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('atmosphere-reference-ambient')

const WORLD_ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('atmosphere-reference-world-root')
/** Places the monoliths model at the world origin (the model is authored in world coordinates). */
const MONOLITHS_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('atmosphere-reference-monoliths')
const FOCUS_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('atmosphere-reference-focus')
export const CINEMA2_ATMOSPHERE_REFERENCE_OBJECT_NODE_NAMES = Object.freeze(['left', 'violet', 'right', 'back'] as const)
const OBJECT_NODE_IDS = CINEMA2_ATMOSPHERE_REFERENCE_OBJECT_NODE_NAMES.map(name => cinema2StableId<Cinema2SceneNodeId>(`atmosphere-reference-object-${name}`))
/**
 * The four stone monoliths around the centre crystal, in `OBJECT_NODE_IDS` order: where each stands (the spot lights aim at its middle), the accent
 * colour of its cracks, and the crack part inside the crystal that glows the same colour (and flares on the same beat).
 */
const MONOLITHS = Object.freeze([
  Object.freeze({ part: 'left' as const, crack: 'crackLeft' as const, centre: vec3(-2.6, -0.6, -0.2), accent: color(0.1, 0.75, 1) }),
  Object.freeze({ part: 'violet' as const, crack: 'crackViolet' as const, centre: vec3(3.1, -0.15, -3.6), accent: color(0.62, 0.28, 1) }),
  Object.freeze({ part: 'right' as const, crack: 'crackRight' as const, centre: vec3(2.75, -0.4, -0.65), accent: color(1, 0.2, 0.85) }),
  Object.freeze({ part: 'back' as const, crack: 'crackBack' as const, centre: vec3(-1.55, 0.4, -4.1), accent: color(1, 0.6, 0.15) }),
])
/** The crystal's own parts: glass body, gold edge frame, and one crack part per monolith colour. */
const CRYSTAL_PARTS = Object.freeze(['crystal', 'frame', ...MONOLITHS.map(monolith => monolith.crack)])
/** Crack glow at rest, and how far each monolith's turn on the beat lifts it. */
const CRACK_GLOW_REST = 3.2
/** Clear-glass recipe for the crystal (the same family as RELIQUARY's cut crystal). */
const CRYSTAL_CLARITY = 0.95
const CRYSTAL_SPARKLE = 4
const CRACK_GLOW_PULSE = 3

export const CINEMA2_ATMOSPHERE_REFERENCE_OBJECT_MODULE_ID = cinema2StableId<Cinema2ModuleId>('atmosphere-reference-object3d')
const WORLD_LAYER_ID = cinema2StableId<Cinema2LayerId>('atmosphere-reference-world-layer')
export const CINEMA2_ATMOSPHERE_REFERENCE_VOLUMETRIC_EFFECT_ID = cinema2StableId<Cinema2EffectId>('atmosphere-reference-volumetric')
const BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('atmosphere-reference-bloom')
export const CINEMA2_ATMOSPHERE_REFERENCE_FLOOR_EFFECT_ID = cinema2StableId<Cinema2EffectId>('atmosphere-reference-floor-effect')
export const CINEMA2_ATMOSPHERE_REFERENCE_FINISH_EFFECT_ID = cinema2StableId<Cinema2EffectId>('atmosphere-reference-finish-effect')
const SCENE_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('atmosphere-reference-scene-target')
const ATMOSPHERE_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('atmosphere-reference-atmosphere-target')
const FLOOR_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('atmosphere-reference-floor-target')
const BLOOM_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('atmosphere-reference-bloom-target')
const SCENE_PASS_ID = cinema2StableId<Cinema2RenderPassId>('atmosphere-reference-scene-pass')
const ATMOSPHERE_PASS_ID = cinema2StableId<Cinema2RenderPassId>('atmosphere-reference-atmosphere-pass')
const BLOOM_PASS_ID = cinema2StableId<Cinema2RenderPassId>('atmosphere-reference-bloom-pass')
const FLOOR_PASS_ID = cinema2StableId<Cinema2RenderPassId>('atmosphere-reference-floor-pass')
const FINISH_PASS_ID = cinema2StableId<Cinema2RenderPassId>('atmosphere-reference-finish-pass')
const SCENE_COLOR_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('atmosphere-reference-scene-color')
const SCENE_DEPTH_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('atmosphere-reference-scene-depth')
const ATMOSPHERE_COLOR_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('atmosphere-reference-atmosphere-color')
const ATMOSPHERE_DEPTH_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('atmosphere-reference-atmosphere-depth')
const ATMOSPHERE_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('atmosphere-reference-atmosphere-output')
const BLOOM_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('atmosphere-reference-bloom-input')
const FLOOR_COLOR_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('atmosphere-reference-floor-color')
const FLOOR_DEPTH_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('atmosphere-reference-floor-depth')
const FLOOR_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('atmosphere-reference-floor-output')
const BLOOM_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('atmosphere-reference-bloom-output')
const FINISH_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('atmosphere-reference-finish-input')
const DOWNBEAT_RULE_ID = cinema2StableId<Cinema2ChoreographyRuleId>('atmosphere-reference-downbeat-beam')
const DOWNBEAT_ROLL_ACTION_ID = cinema2StableId<Cinema2ChoreographyActionId>('atmosphere-reference-downbeat-camera-lean')
const DOWNBEAT_BEAM_ACTION_ID = cinema2StableId<Cinema2ChoreographyActionId>('atmosphere-reference-downbeat-beam-swell')

/**
 * A slow closed dolly loop around the stage. Radius and height vary point to point, so the spline has
 * real S-curves for the camera to bank through, and every point stays above the floor plane.
 */
function dollyLoop() {
  const centre = [0, -0.4, -1.2]
  const radii = [8, 6.2, 8.4, 6.6, 8.2, 6.4]
  const heights = [0.8, 1.6, 0.6, 1.8, 0.7, 1.5]
  return Object.freeze(radii.map((radius, index) => {
    const angle = (index / radii.length) * Math.PI * 2 - 0.4
    return Object.freeze({ position: vec3(centre[0] + Math.sin(angle) * radius, heights[index], centre[2] + Math.cos(angle) * radius) })
  }))
}

function vec3(x: number, y: number, z: number): Cinema2Vector3 { return Object.freeze([x, y, z]) }
function color(r: number, g: number, b: number, a = 1): Cinema2Color { return Object.freeze([r, g, b, a]) }

function spotLight(id: Cinema2LightId, lightColor: Cinema2Color, position: Cinema2Vector3, target: Cinema2SceneNodeId) {
  return Object.freeze({
    id,
    type: 'spot' as const,
    color: lightColor,
    intensity: RIG_BASE_INTENSITY,
    transform: Object.freeze({ position }),
    node: cinema2Ref(WORLD_ROOT_NODE_ID),
    targetNode: cinema2Ref(target),
    config: Object.freeze({ coneAngleDegrees: 11, penumbra: 0.45, range: 20 }),
  })
}

function objectNode(id: Cinema2SceneNodeId, position: Cinema2Vector3, scale: number, rotation: Cinema2Vector3) {
  return Object.freeze({
    id,
    kind: 'module' as const,
    parent: cinema2Ref(WORLD_ROOT_NODE_ID),
    module: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_OBJECT_MODULE_ID),
    transform: Object.freeze({ position, rotation, scale: vec3(scale, scale, scale) }),
  })
}

/** An empty marker at a monolith's middle: the spot lights aim at it. */
function monolithMarker(id: Cinema2SceneNodeId, position: Cinema2Vector3) {
  return Object.freeze({
    id,
    kind: 'primitive' as const,
    parent: cinema2Ref(WORLD_ROOT_NODE_ID),
    transform: Object.freeze({ position }),
  })
}

/**
 * The scene's original four pillar nodes (one `module` node per object, each placing a copy of the object module): the Three Model Reference
 * preset still places one shipped model per node, so it keeps this layout rather than the monoliths' single model.
 */
export const CINEMA2_ATMOSPHERE_REFERENCE_PILLAR_SCENE = Object.freeze({
  nodes: Object.freeze([
    Object.freeze({ id: WORLD_ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
    Object.freeze({
      id: FOCUS_NODE_ID,
      kind: 'primitive' as const,
      parent: cinema2Ref(WORLD_ROOT_NODE_ID),
      transform: Object.freeze({ position: vec3(0, -0.4, -1.2) }),
    }),
    objectNode(OBJECT_NODE_IDS[0], vec3(-2.1, -0.7, -0.4), 0.9, vec3(0.1, -0.35, 0.08)),
    objectNode(OBJECT_NODE_IDS[1], vec3(0, -0.2, -1.4), 1.25, vec3(-0.06, 0.2, 0.03)),
    objectNode(OBJECT_NODE_IDS[2], vec3(2.2, -0.6, -0.9), 1.05, vec3(0.14, 0.45, -0.1)),
    objectNode(OBJECT_NODE_IDS[3], vec3(0.6, 0.3, -4.2), 1.9, vec3(0, 0.1, 0)),
  ]),
  roots: Object.freeze([cinema2Ref(WORLD_ROOT_NODE_ID)]),
})
function floatParameter(
  id: Cinema2ParameterId,
  label: string,
  description: string,
  defaultValue: number,
  min: number,
  max: number,
  step: number,
  order: number,
  group: string,
) {
  return Object.freeze({
    id,
    label,
    description,
    type: 'float' as const,
    defaultValue,
    min,
    max,
    step,
    section: 'Design',
    group,
    order,
    exposure: 'primary' as const,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
    modulatable: true,
    choreographable: true,
  })
}

function accentParameter(id: Cinema2ParameterId, label: string, description: string, defaultValue: Cinema2Color, order: number) {
  return Object.freeze({
    id,
    label,
    description,
    type: 'color' as const,
    defaultValue,
    section: 'Design',
    designParentGroup: 'palette' as const,
    group: 'Monoliths',
    order,
    exposure: 'primary' as const,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
    modulatable: false,
    choreographable: false,
    automatable: false,
  })
}

/**
 * Neutral reference for the native Volumetric Atmosphere effect. Three colored
 * spot lights rake through haze around four cracked rock monoliths (one shipped model,
 * a glowing crack in a different accent colour on each); the volumetric pass
 * reads the scene depth so the beams end at the monoliths, then bloom lifts them.
 * The downbeat swells the beams (Musical Event -> Choreography -> Visual Action),
 * and the effect's own `reactivity` follows the Visual Director's gated impact.
 */
export const CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_ATMOSPHERE_REFERENCE_PRESET_ID,
  revision: 1,
  metadata: Object.freeze({
    name: 'Atmosphere Reference',
    description: 'A performance light rig: colored spot beams through haze and ground mist over a wet reflective floor, choreographed to the beat and finished with a filmic grade.',
    tags: Object.freeze(['reference', 'diagnostic', 'atmosphere', 'volumetric']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native Cinema 2.0 Stage rendering.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Depth-tested world composition and depth-aware atmosphere.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'World-space Scene Graph objects.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Shared final world camera used to reconstruct view rays.' }),
    Object.freeze({ id: 'lighting' as const, requirement: 'required' as const, purpose: 'Spot lights that scatter through the atmosphere.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Downbeat beam swell and side-light sweep when authoritative downbeat data is available.' }),
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'Key and side lights alternate every two beats.' }),
    Object.freeze({ id: 'music.phrase' as const, requirement: 'optional' as const, purpose: 'Key light drops out on alternate phrases.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'Light intensity ramps with the Visual Director build.' }),
  ]),
  parameters: Object.freeze([
    CINEMA2_QUALITY_MODE_PARAMETER,
    floatParameter(CINEMA2_ATMOSPHERE_REFERENCE_DENSITY_ID, 'Haze Density', 'How thick the haze is. Thicker haze makes beams brighter and shortens visibility.', 0.032, 0, 0.4, 0.005, 10, 'Atmosphere'),
    floatParameter(CINEMA2_ATMOSPHERE_REFERENCE_BEAM_ID, 'Beam Intensity', 'Brightness of light scattering through the haze.', 1.9, 0, 6, 0.05, 11, 'Atmosphere'),
    floatParameter(CINEMA2_ATMOSPHERE_REFERENCE_MIST_ID, 'Ground Mist', 'Extra mist that pools near the floor.', 0.35, 0, 3, 0.05, 12, 'Atmosphere'),
    floatParameter(CINEMA2_ATMOSPHERE_REFERENCE_REACTIVITY_ID, 'Reactivity', 'How strongly haze and beams swell with the Visual Director’s musical impact.', 0.8, 0, 2, 0.05, 20, 'React'),
    floatParameter(CINEMA2_ATMOSPHERE_REFERENCE_FLOOR_ID, 'Floor Reflection', 'How mirror-like the wet stage floor is.', 0.7, 0, 1, 0.05, 13, 'Atmosphere'),
    floatParameter(CINEMA2_ATMOSPHERE_REFERENCE_MOTION_ID, 'Camera Motion', 'Scales the handheld drift and banking of the dolly camera (0 = locked off).', 1, 0, 1.5, 0.05, 40, 'Camera'),
    floatParameter(CINEMA2_ATMOSPHERE_REFERENCE_BLOOM_ID, 'Bloom', 'Glow added around bright beams.', 0.9, 0, 3, 0.05, 30, 'Post'),
    floatParameter(CINEMA2_ATMOSPHERE_REFERENCE_FINISH_ID, 'Cinematic Finish', 'Amount of filmic tone curve, grade, vignette, fringing and grain.', 1, 0, 1, 0.05, 31, 'Post'),
    floatParameter(CINEMA2_ATMOSPHERE_REFERENCE_CRACK_GLOW_ID, 'Crack Glow', 'Brightness of the glowing cracks in the monoliths and in the crystal between beats. Each colour flares above this in turn on the beat.', CRACK_GLOW_REST, 0, 6, 0.05, 14, 'Monoliths'),
    floatParameter(CINEMA2_ATMOSPHERE_REFERENCE_CRYSTAL_CLARITY_ID, 'Crystal Clarity', 'How see-through the central crystal is (1 = clear glass; lower is milky). Quality settings below High draw it without refraction.', CRYSTAL_CLARITY, 0, 1, 0.05, 15, 'Monoliths'),
    floatParameter(CINEMA2_ATMOSPHERE_REFERENCE_CRYSTAL_SPARKLE_ID, 'Crystal Sparkle', 'How strongly the central crystal splits light into rainbow colours.', CRYSTAL_SPARKLE, 0, 10, 0.1, 16, 'Monoliths'),
    accentParameter(CINEMA2_ATMOSPHERE_REFERENCE_ACCENT_IDS.left, 'Left Monolith', 'Colour of the cracks in the left monolith. The crystal in the middle carries the same colour in its own cracks.', MONOLITHS[0].accent, 1),
    accentParameter(CINEMA2_ATMOSPHERE_REFERENCE_ACCENT_IDS.violet, 'Back-Right Monolith', 'Colour of the cracks in the back-right monolith.', MONOLITHS[1].accent, 2),
    accentParameter(CINEMA2_ATMOSPHERE_REFERENCE_ACCENT_IDS.right, 'Right Monolith', 'Colour of the cracks in the right monolith.', MONOLITHS[2].accent, 3),
    accentParameter(CINEMA2_ATMOSPHERE_REFERENCE_ACCENT_IDS.back, 'Back Monolith', 'Colour of the cracks in the tall monolith at the back.', MONOLITHS[3].accent, 4),
  ]),
  modules: Object.freeze([
    Object.freeze({
      id: CINEMA2_ATMOSPHERE_REFERENCE_OBJECT_MODULE_ID,
      typeId: THREE_SCENE_TYPE_ID,
      version: 1,
      enabled: true,
      // Dark stone lit by the spot rig, with only a faint studio reflection; every monolith's cracks glow in its own accent colour.
      parameters: Object.freeze({
        environmentIntensity: 0.18,
        // The centre crystal: clear iridescent glass in a polished gold frame. Its cracks glow in the monoliths' colours, so each crack part is
        // tinted by (and flares with) the monolith of the same colour.
        'crystal.color': color(1, 1, 1),
        'crystal.roughness': 0,
        'crystal.metalness': 0,
        'crystal.transmission': CRYSTAL_CLARITY,
        'crystal.ior': 2,
        'crystal.thickness': 0.6,
        'crystal.dispersion': CRYSTAL_SPARKLE,
        'crystal.iridescence': 0.9,
        'crystal.iridescenceThicknessMin': 250,
        'crystal.iridescenceThicknessMax': 650,
        'crystal.environmentIntensity': 6,
        // A faint cool inner light, so the glass keeps its brilliance between the spot lights' hits.
        'crystal.emissive': color(0.75, 0.85, 1),
        'crystal.emissiveIntensity': 0.1,
        'frame.environmentIntensity': 4,
        ...Object.fromEntries(MONOLITHS.flatMap(({ part, crack, accent }) => [
          [`${part}.emissive`, accent], [`${part}.emissiveIntensity`, CRACK_GLOW_REST],
          [`${crack}.emissive`, accent], [`${crack}.emissiveIntensity`, CRACK_GLOW_REST],
        ])),
      }),
      parameterBindings: Object.freeze({
        'crystal.transmission': cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_CRYSTAL_CLARITY_ID),
        'crystal.dispersion': cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_CRYSTAL_SPARKLE_ID),
        ...Object.fromEntries(MONOLITHS.flatMap(({ part, crack }) => [
          [`${part}.emissive`, cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_ACCENT_IDS[part])],
          [`${part}.emissiveIntensity`, cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_CRACK_GLOW_ID)],
          [`${crack}.emissive`, cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_ACCENT_IDS[part])],
          [`${crack}.emissiveIntensity`, cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_CRACK_GLOW_ID)],
        ])),
      }),
      config: Object.freeze({
        instances: Object.freeze([Object.freeze({ asset: CINEMA2_ATMOSPHERE_MONOLITHS_ASSET_ID, node: MONOLITHS_NODE_ID })]),
        parts: Object.freeze([...MONOLITHS.map(({ part }) => part), ...CRYSTAL_PARTS]),
      }),
    }),
  ]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: WORLD_ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
      Object.freeze({
        id: FOCUS_NODE_ID,
        kind: 'primitive' as const,
        parent: cinema2Ref(WORLD_ROOT_NODE_ID),
        transform: Object.freeze({ position: vec3(0, -0.4, -1.2) }),
      }),
      Object.freeze({
        id: MONOLITHS_NODE_ID,
        kind: 'module' as const,
        parent: cinema2Ref(WORLD_ROOT_NODE_ID),
        module: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_OBJECT_MODULE_ID),
      }),
      ...MONOLITHS.map((monolith, index) => monolithMarker(OBJECT_NODE_IDS[index], monolith.centre)),
    ]),
    roots: Object.freeze([cinema2Ref(WORLD_ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([
    Object.freeze({
      id: WORLD_LAYER_ID,
      label: 'Atmosphere World',
      source: cinema2Ref(WORLD_ROOT_NODE_ID),
      role: 'world',
      depthPolicy: 'read-write' as const,
      order: 0,
    }),
  ]),
  cameras: Object.freeze([
    Object.freeze({
      id: CINEMA2_ATMOSPHERE_REFERENCE_CAMERA_ID,
      label: 'Atmosphere Dolly',
      projection: 'perspective' as const,
      targetNode: cinema2Ref(FOCUS_NODE_ID),
      fovDegrees: 46,
      near: 0.1,
      far: 60,
      rig: Object.freeze({ kind: 'fly' as const, points: dollyLoop(), durationSeconds: 80, loop: true }),
      motion: cinema2CinematicMotion('gentle', { splinePath: true }),
      controls: Object.freeze({ motionAmount: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_MOTION_ID) }),
    }),
  ]),
  lighting: Object.freeze({
    groups: Object.freeze([
      Object.freeze({ id: CINEMA2_ATMOSPHERE_REFERENCE_KEY_GROUP_ID, label: 'Key', lights: Object.freeze([cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_CENTER_LIGHT_ID)]) }),
      Object.freeze({
        id: CINEMA2_ATMOSPHERE_REFERENCE_SIDES_GROUP_ID,
        label: 'Sides',
        lights: Object.freeze([cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_LEFT_LIGHT_ID), cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_RIGHT_LIGHT_ID)]),
      }),
    ]),
    lights: Object.freeze([
      spotLight(CINEMA2_ATMOSPHERE_REFERENCE_CENTER_LIGHT_ID, color(1, 0.72, 0.28), vec3(0.2, 6.2, -2.6), OBJECT_NODE_IDS[3]),
      spotLight(CINEMA2_ATMOSPHERE_REFERENCE_LEFT_LIGHT_ID, color(0.2, 0.85, 1), vec3(-3.4, 5.6, 1.2), OBJECT_NODE_IDS[0]),
      spotLight(CINEMA2_ATMOSPHERE_REFERENCE_RIGHT_LIGHT_ID, color(1, 0.25, 0.75), vec3(3.6, 5.6, 0.6), OBJECT_NODE_IDS[2]),
      Object.freeze({
        id: AMBIENT_LIGHT_ID,
        type: 'ambient' as const,
        color: color(0.28, 0.34, 0.46),
        intensity: 0.4,
      }),
    ]),
  }),
  environment: Object.freeze({
    backgroundColor: color(0.006, 0.008, 0.014),
    exposure: 1,
    fog: Object.freeze({ mode: 'exponential' as const, color: color(0.03, 0.045, 0.07), density: 0.012 }),
  }),
  effects: Object.freeze([
    Object.freeze({
      id: CINEMA2_ATMOSPHERE_REFERENCE_FLOOR_EFFECT_ID,
      typeId: FLOOR_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 0,
      scope: 'output' as const,
      parameters: Object.freeze({
        mix: 1,
        floorY: FLOOR_Y,
        reflectivity: 0.7,
        roughness: 0.22,
        fresnel: 3,
        albedo: 0.12,
        poolIntensity: 2.2,
        specular: 1.4,
        fadeDistance: 40,
        maxReflection: 26,
      }),
      parameterBindings: Object.freeze({ reflectivity: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_FLOOR_ID) }),
    }),
    Object.freeze({
      id: CINEMA2_ATMOSPHERE_REFERENCE_VOLUMETRIC_EFFECT_ID,
      typeId: VOLUMETRIC_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 1,
      scope: 'output' as const,
      parameters: Object.freeze({
        mix: 1,
        density: 0.032,
        beamIntensity: 1.9,
        mistAmount: 0.35,
        mistHeight: 1.6,
        mistFloor: FLOOR_Y,
        floorY: FLOOR_Y,
        floorReflection: 0.7,
        anisotropy: 0.55,
        occlusion: 0.55,
        ambientHaze: 0.06,
        noiseScale: 0.32,
        noiseStrength: 0.65,
        drift: 0.12,
        maxDistance: 34,
        reactivity: 0.8,
      }),
      parameterBindings: Object.freeze({
        density: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_DENSITY_ID),
        beamIntensity: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_BEAM_ID),
        mistAmount: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_MIST_ID),
        reactivity: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_REACTIVITY_ID),
      }),
    }),
    Object.freeze({
      id: BLOOM_EFFECT_ID,
      typeId: BLOOM_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 2,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 0.45, threshold: 0.5, radius: 2.4, intensity: 0.9 }),
      parameterBindings: Object.freeze({ intensity: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_BLOOM_ID) }),
    }),
    Object.freeze({
      id: CINEMA2_ATMOSPHERE_REFERENCE_FINISH_EFFECT_ID,
      typeId: FINISH_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 3,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, exposure: 1.35, vignette: 0.4, grain: 0.22, aberration: 0.25, contrast: 1.12, saturation: 1.1 }),
      parameterBindings: Object.freeze({ mix: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_FINISH_ID) }),
    }),
  ]),
  choreography: Object.freeze({
    rules: Object.freeze([
      // Performance light rig: key and sides trade the stage every two beats, the sides sweep on the
      // downbeat, the key drops out on alternate phrases, and everything lifts with the build.
      ...cinema2LightRigAlternate({
        id: 'atmosphere-rig',
        groups: [CINEMA2_ATMOSPHERE_REFERENCE_KEY_GROUP_ID, CINEMA2_ATMOSPHERE_REFERENCE_SIDES_GROUP_ID],
        everyBeats: 2,
        peak: RIG_PEAK_INTENSITY,
        priority: 40,
        strengthParameter: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_REACTIVITY_ID),
      }),
      ...cinema2LightRigHit({
        id: 'atmosphere-rig-sides',
        group: CINEMA2_ATMOSPHERE_REFERENCE_SIDES_GROUP_ID,
        signal: 'downbeat',
        peak: 1.4,
        stagger: { beats: 0.25, order: 'forward' },
        priority: 45,
        strengthParameter: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_REACTIVITY_ID),
      }),
      ...cinema2LightRigPhraseArrangement({
        id: 'atmosphere-rig',
        groups: [CINEMA2_ATMOSPHERE_REFERENCE_KEY_GROUP_ID],
        every: 2,
        phase: 1,
        priority: 60,
      }),
      ...cinema2LightRigRamp({
        id: 'atmosphere-rig',
        groups: [CINEMA2_ATMOSPHERE_REFERENCE_KEY_GROUP_ID, CINEMA2_ATMOSPHERE_REFERENCE_SIDES_GROUP_ID],
        source: 'director.build',
        lift: 0.8,
        priority: 30,
        strengthParameter: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_REACTIVITY_ID),
      }),
      // Cracks: one colour flares per beat, in turn round a four-beat cycle, in its monolith and in the matching cracks of the centre crystal,
      // then settles back to the Crack Glow level.
      ...MONOLITHS.map((monolith, index) => Object.freeze({
        id: cinema2StableId<Cinema2ChoreographyRuleId>(`atmosphere-reference-monolith-${monolith.part}`),
        priority: 35,
        source: Object.freeze({ signal: 'beat' as const, capability: 'music.beat' as const }),
        strengthParameter: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_REACTIVITY_ID),
        conditions: Object.freeze([Object.freeze({ kind: 'beat-interval' as const, every: 4, phase: index, unit: 'beat' as const })]),
        actions: Object.freeze([[monolith.part, 'slab'], [monolith.crack, 'crystal']].map(([target, where]) => Object.freeze({
          id: cinema2StableId<Cinema2ChoreographyActionId>(`atmosphere-reference-monolith-${monolith.part}-${where}-flare`),
          target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_OBJECT_MODULE_ID), property: `${target}.emissiveIntensity` }),
          operation: 'envelope' as const,
          composition: 'add' as const,
          value: CRACK_GLOW_PULSE,
          envelope: Object.freeze({ attack: 0, hold: 0.1, release: 1.6, unit: 'beats' as const }),
          retrigger: 'restart' as const,
        }))),
      })),
      Object.freeze({
        id: DOWNBEAT_RULE_ID,
        priority: 30,
        source: Object.freeze({ signal: 'downbeat' as const, capability: 'music.downbeat' as const }),
        actions: Object.freeze([
          Object.freeze({
            id: DOWNBEAT_BEAM_ACTION_ID,
            target: Object.freeze({ kind: 'effect' as const, ref: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_VOLUMETRIC_EFFECT_ID), property: 'beamIntensity' }),
            operation: 'envelope' as const,
            composition: 'add' as const,
            value: 2.2,
            envelope: Object.freeze({ attack: 0, hold: 0.1, release: 0.9, unit: 'beats' as const }),
            retrigger: 'restart' as const,
          }),
          // A small lean into the downbeat, on the writable camera roll target.
          Object.freeze({
            id: DOWNBEAT_ROLL_ACTION_ID,
            target: Object.freeze({ kind: 'camera' as const, ref: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_CAMERA_ID), property: 'roll' }),
            operation: 'envelope' as const,
            composition: 'add' as const,
            value: 1.2,
            envelope: Object.freeze({ attack: 0.3, hold: 0, release: 1.2, unit: 'beats' as const }),
            retrigger: 'restart' as const,
          }),
        ]),
      }),
    ]),
  }),
  render: Object.freeze({
    targets: Object.freeze([
      Object.freeze({
        id: SCENE_TARGET_ID,
        descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba8' as const, depthFormat: 'depth24' as const }),
        ownership: 'transient' as const,
      }),
      Object.freeze({
        id: FLOOR_TARGET_ID,
        descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba8' as const }),
        ownership: 'transient' as const,
      }),
      Object.freeze({
        id: ATMOSPHERE_TARGET_ID,
        descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba8' as const }),
        ownership: 'transient' as const,
      }),
      Object.freeze({
        id: BLOOM_TARGET_ID,
        descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba8' as const }),
        ownership: 'transient' as const,
      }),
    ]),
    passes: Object.freeze([
      Object.freeze({
        id: SCENE_PASS_ID,
        kind: 'scene' as const,
        layers: Object.freeze([cinema2Ref(WORLD_LAYER_ID)]),
        outputs: Object.freeze([
          Object.freeze({ id: SCENE_COLOR_OUTPUT_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'color' as const }),
          Object.freeze({ id: SCENE_DEPTH_OUTPUT_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'depth' as const }),
        ]),
      }),
      Object.freeze({
        id: FLOOR_PASS_ID,
        kind: 'fullscreen' as const,
        dependsOn: Object.freeze([cinema2Ref(SCENE_PASS_ID)]),
        effect: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_FLOOR_EFFECT_ID),
        inputs: Object.freeze([
          Object.freeze({
            id: FLOOR_COLOR_INPUT_ID,
            source: Object.freeze({ pass: cinema2Ref(SCENE_PASS_ID), output: SCENE_COLOR_OUTPUT_ID }),
            attachment: 'color' as const,
          }),
          Object.freeze({
            id: FLOOR_DEPTH_INPUT_ID,
            source: Object.freeze({ pass: cinema2Ref(SCENE_PASS_ID), output: SCENE_DEPTH_OUTPUT_ID }),
            attachment: 'depth' as const,
          }),
        ]),
        outputs: Object.freeze([Object.freeze({ id: FLOOR_OUTPUT_ID, target: cinema2Ref(FLOOR_TARGET_ID), attachment: 'color' as const })]),
      }),
      Object.freeze({
        id: ATMOSPHERE_PASS_ID,
        kind: 'fullscreen' as const,
        dependsOn: Object.freeze([cinema2Ref(FLOOR_PASS_ID)]),
        effect: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_VOLUMETRIC_EFFECT_ID),
        inputs: Object.freeze([
          Object.freeze({
            id: ATMOSPHERE_COLOR_INPUT_ID,
            source: Object.freeze({ pass: cinema2Ref(FLOOR_PASS_ID), output: FLOOR_OUTPUT_ID }),
            attachment: 'color' as const,
          }),
          Object.freeze({
            id: ATMOSPHERE_DEPTH_INPUT_ID,
            source: Object.freeze({ pass: cinema2Ref(SCENE_PASS_ID), output: SCENE_DEPTH_OUTPUT_ID }),
            attachment: 'depth' as const,
          }),
        ]),
        outputs: Object.freeze([Object.freeze({ id: ATMOSPHERE_OUTPUT_ID, target: cinema2Ref(ATMOSPHERE_TARGET_ID), attachment: 'color' as const })]),
      }),
      Object.freeze({
        id: BLOOM_PASS_ID,
        kind: 'fullscreen' as const,
        dependsOn: Object.freeze([cinema2Ref(ATMOSPHERE_PASS_ID)]),
        effect: cinema2Ref(BLOOM_EFFECT_ID),
        inputs: Object.freeze([
          Object.freeze({
            id: BLOOM_INPUT_ID,
            source: Object.freeze({ pass: cinema2Ref(ATMOSPHERE_PASS_ID), output: ATMOSPHERE_OUTPUT_ID }),
            attachment: 'color' as const,
          }),
        ]),
        outputs: Object.freeze([Object.freeze({ id: BLOOM_OUTPUT_ID, target: cinema2Ref(BLOOM_TARGET_ID), attachment: 'color' as const })]),
      }),
      Object.freeze({
        id: FINISH_PASS_ID,
        kind: 'fullscreen' as const,
        dependsOn: Object.freeze([cinema2Ref(BLOOM_PASS_ID)]),
        effect: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_FINISH_EFFECT_ID),
        inputs: Object.freeze([
          Object.freeze({
            id: FINISH_INPUT_ID,
            source: Object.freeze({ pass: cinema2Ref(BLOOM_PASS_ID), output: BLOOM_OUTPUT_ID }),
            attachment: 'color' as const,
          }),
        ]),
      }),
    ]),
    outputPass: cinema2Ref(FINISH_PASS_ID),
  }),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_CAMERA_ID) }),
  output: Object.freeze({ renderPass: cinema2Ref(FINISH_PASS_ID), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
})
