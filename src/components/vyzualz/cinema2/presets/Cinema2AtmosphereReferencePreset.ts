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
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { cinema2CinematicMotion } from './Cinema2CameraMotionAuthoring'
import {
  cinema2LightRigAlternate,
  cinema2LightRigHit,
  cinema2LightRigPhraseArrangement,
  cinema2LightRigRamp,
} from './Cinema2LightRigAuthoring'

export const CINEMA2_ATMOSPHERE_REFERENCE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.atmosphere-reference')
const OBJECT3D_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('object3d')
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
const FOCUS_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('atmosphere-reference-focus')
const OBJECT_NODE_IDS = ['left', 'center', 'right', 'back'].map(name => cinema2StableId<Cinema2SceneNodeId>(`atmosphere-reference-object-${name}`))

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

// A plain rectangle: the current SVG extruder rejects the hexagon the Spatial Reference preset uses.
const PILLAR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="32" y="6" width="36" height="88"/></svg>'

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

/**
 * Neutral reference for the native Volumetric Atmosphere effect. Three colored
 * spot lights rake through haze around a few lit objects; the volumetric pass
 * reads the scene depth so the beams end at the objects, then bloom lifts them.
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
  ]),
  modules: Object.freeze([
    Object.freeze({
      id: CINEMA2_ATMOSPHERE_REFERENCE_OBJECT_MODULE_ID,
      typeId: OBJECT3D_TYPE_ID,
      version: 1,
      enabled: true,
      parameters: Object.freeze({ color: color(0.5, 0.56, 0.62), emissiveIntensity: 0.04 }),
      config: Object.freeze({
        source: Object.freeze({ kind: 'svg', sourceId: 'cinema2-atmosphere-reference-pillar', revision: 1, rawSvg: PILLAR_SVG }),
        material: Object.freeze({ color: color(0.5, 0.56, 0.62), emissiveIntensity: 0.04 }),
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
      objectNode(OBJECT_NODE_IDS[0], vec3(-2.1, -0.7, -0.4), 0.9, vec3(0.1, -0.35, 0.08)),
      objectNode(OBJECT_NODE_IDS[1], vec3(0, -0.2, -1.4), 1.25, vec3(-0.06, 0.2, 0.03)),
      objectNode(OBJECT_NODE_IDS[2], vec3(2.2, -0.6, -0.9), 1.05, vec3(0.14, 0.45, -0.1)),
      objectNode(OBJECT_NODE_IDS[3], vec3(0.6, 0.3, -4.2), 1.9, vec3(0, 0.1, 0)),
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
      spotLight(CINEMA2_ATMOSPHERE_REFERENCE_CENTER_LIGHT_ID, color(1, 0.72, 0.28), vec3(0.2, 6.2, -2.6), OBJECT_NODE_IDS[1]),
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
