import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2Color,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleId,
  type Cinema2EffectId,
  type Cinema2EffectTypeId,
  type Cinema2LayerId,
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
  type Cinema2Vector2,
  type Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
export const CINEMA2_SPATIAL_REFERENCE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.spatial-reference')
const FULLSCREEN_SHADER_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('fullscreen-shader')
const OBJECT3D_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('object3d')
const BLOOM_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('bloom')

export const CINEMA2_SPATIAL_REFERENCE_OBJECT_COLOR_ID = cinema2StableId<Cinema2ParameterId>('spatial-reference-object-color')
export const CINEMA2_SPATIAL_REFERENCE_OBJECT_EMISSIVE_ID = cinema2StableId<Cinema2ParameterId>('spatial-reference-object-emissive')
export const CINEMA2_SPATIAL_REFERENCE_BLOOM_ENABLED_ID = cinema2StableId<Cinema2ParameterId>('spatial-reference-bloom-enabled')
export const CINEMA2_SPATIAL_REFERENCE_BLOOM_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('spatial-reference-bloom-intensity')
export const CINEMA2_SPATIAL_REFERENCE_REACTIVITY_ID = cinema2StableId<Cinema2ParameterId>('spatial-reference-reactivity')
export const CINEMA2_SPATIAL_REFERENCE_ORBIT_RADIUS_ID = cinema2StableId<Cinema2ParameterId>('spatial-reference-orbit-radius')
export const CINEMA2_SPATIAL_REFERENCE_ORBIT_AZIMUTH_ID = cinema2StableId<Cinema2ParameterId>('spatial-reference-orbit-azimuth')
export const CINEMA2_SPATIAL_REFERENCE_ORBIT_ELEVATION_ID = cinema2StableId<Cinema2ParameterId>('spatial-reference-orbit-elevation')
export const CINEMA2_SPATIAL_REFERENCE_FOV_ID = cinema2StableId<Cinema2ParameterId>('spatial-reference-fov')
export const CINEMA2_SPATIAL_REFERENCE_CAMERA_SMOOTHING_ID = cinema2StableId<Cinema2ParameterId>('spatial-reference-camera-smoothing')
export const CINEMA2_SPATIAL_REFERENCE_KEY_LIGHT_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('spatial-reference-key-light-intensity')
export const CINEMA2_SPATIAL_REFERENCE_BACKGROUND_ID = cinema2StableId<Cinema2ParameterId>('spatial-reference-background')
export const CINEMA2_SPATIAL_REFERENCE_EXPOSURE_ID = cinema2StableId<Cinema2ParameterId>('spatial-reference-exposure')
export const CINEMA2_SPATIAL_REFERENCE_FOG_DENSITY_ID = cinema2StableId<Cinema2ParameterId>('spatial-reference-fog-density')

export const CINEMA2_SPATIAL_REFERENCE_ORBIT_CAMERA_ID = cinema2StableId<Cinema2CameraId>('spatial-reference-orbit-camera')
export const CINEMA2_SPATIAL_REFERENCE_FLY_CAMERA_ID = cinema2StableId<Cinema2CameraId>('spatial-reference-fly-camera')
export const CINEMA2_SPATIAL_REFERENCE_KEY_LIGHT_ID = cinema2StableId<Cinema2LightId>('spatial-reference-key-light')
export const CINEMA2_SPATIAL_REFERENCE_FILL_LIGHT_ID = cinema2StableId<Cinema2LightId>('spatial-reference-fill-light')
export const CINEMA2_SPATIAL_REFERENCE_AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('spatial-reference-ambient-light')

const WORLD_ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('spatial-reference-world-root')
export const CINEMA2_SPATIAL_REFERENCE_FOCUS_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('spatial-reference-focus')
const LIGHT_RIG_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('spatial-reference-light-rig')
const OBJECT_LEFT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('spatial-reference-object-left')
export const CINEMA2_SPATIAL_REFERENCE_OBJECT_CENTER_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('spatial-reference-object-center')
const OBJECT_RIGHT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('spatial-reference-object-right')
const OVERLAY_ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('spatial-reference-overlay-root')
const OVERLAY_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('spatial-reference-overlay-node')

export const CINEMA2_SPATIAL_REFERENCE_OBJECT_MODULE_ID = cinema2StableId<Cinema2ModuleId>('spatial-reference-object3d')
const OVERLAY_MODULE_ID = cinema2StableId<Cinema2ModuleId>('spatial-reference-overlay')
const WORLD_LAYER_ID = cinema2StableId<Cinema2LayerId>('spatial-reference-world-layer')
const OVERLAY_LAYER_ID = cinema2StableId<Cinema2LayerId>('spatial-reference-overlay-layer')
const SCENE_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('spatial-reference-scene-target')
const SCENE_PASS_ID = cinema2StableId<Cinema2RenderPassId>('spatial-reference-scene-pass')
const BLOOM_PASS_ID = cinema2StableId<Cinema2RenderPassId>('spatial-reference-bloom-pass')
const SCENE_COLOR_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('spatial-reference-scene-color')
const SCENE_DEPTH_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('spatial-reference-scene-depth')
const BLOOM_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('spatial-reference-bloom-input')
const BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('spatial-reference-bloom')
const ENERGY_RULE_ID = cinema2StableId<Cinema2ChoreographyRuleId>('spatial-reference-energy-response')
const ENERGY_LIGHT_ACTION_ID = cinema2StableId<Cinema2ChoreographyActionId>('spatial-reference-energy-light')
const ENERGY_OBJECT_ACTION_ID = cinema2StableId<Cinema2ChoreographyActionId>('spatial-reference-energy-object')
const ENERGY_ROTATION_ACTION_ID = cinema2StableId<Cinema2ChoreographyActionId>('spatial-reference-energy-rotation')
const DOWNBEAT_RULE_ID = cinema2StableId<Cinema2ChoreographyRuleId>('spatial-reference-downbeat-camera')
const DOWNBEAT_CAMERA_ACTION_ID = cinema2StableId<Cinema2ChoreographyActionId>('spatial-reference-downbeat-camera-fov')

function vec2(x: number, y: number): Cinema2Vector2 { return Object.freeze([x, y]) }
function vec3(x: number, y: number, z: number): Cinema2Vector3 { return Object.freeze([x, y, z]) }
function color(r: number, g: number, b: number, a = 1): Cinema2Color { return Object.freeze([r, g, b, a]) }

const SPATIAL_REFERENCE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,7 87,28 87,72 50,93 13,72 13,28"/></svg>'

const SPATIAL_REFERENCE_OVERLAY_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
out vec4 outColor;

float line(float value, float width) {
  return 1.0 - smoothstep(width, width * 2.0, abs(value));
}

void main() {
  vec2 uv = v_uv;
  vec2 centered = uv * 2.0 - 1.0;
  centered.x *= u_resolution.x / max(u_resolution.y, 1.0);

  float frame = max(
    max(line(uv.x - 0.055, 0.0015), line(uv.x - 0.945, 0.0015)),
    max(line(uv.y - 0.07, 0.0015), line(uv.y - 0.93, 0.0015))
  );
  float crosshair = max(line(centered.x, 0.0017), line(centered.y, 0.0017));
  crosshair *= 1.0 - smoothstep(0.16, 0.22, length(centered));
  float orbitGuide = 1.0 - smoothstep(0.003, 0.008, abs(length(centered) - 0.42));
  float sweep = line(fract(u_time * 0.045) - uv.x, 0.0022) * step(0.84, uv.y);
  float ink = max(max(frame * 0.42, crosshair * 0.7), max(orbitGuide * 0.18, sweep * 0.46));
  if (ink < 0.01) discard;

  vec3 neutral = mix(vec3(0.38, 0.46, 0.50), vec3(0.72, 0.86, 0.88), clamp(ink, 0.0, 1.0));
  outColor = vec4(neutral, 1.0);
}
`

/**
 * Neutral Stage 13 architecture reference. It deliberately combines world-space
 * Object3D instances and a screen-space procedural overlay through the same
 * native preset/scene/render contracts used by the earlier reference presets.
 */
export const CINEMA2_SPATIAL_REFERENCE_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_SPATIAL_REFERENCE_PRESET_ID,
  revision: 1,
  metadata: Object.freeze({
    name: 'Spatial Reference',
    description: 'Neutral Cinema 2.0 3D, camera, lighting, overlay, effect and choreography reference.',
    tags: Object.freeze(['reference', 'diagnostic', 'spatial', 'internal']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native Cinema 2.0 Stage rendering.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Depth-tested world composition.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'World-space Scene Graph objects.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Shared final world camera.' }),
    Object.freeze({ id: 'lighting' as const, requirement: 'required' as const, purpose: 'Shared lighting/environment service.' }),
    Object.freeze({ id: 'audio.features' as const, requirement: 'optional' as const, purpose: 'Continuous overall-energy choreography when authoritative audio is available.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Downbeat camera impulse when authoritative downbeat data is available.' }),
  ]),
  parameters: Object.freeze([
    CINEMA2_QUALITY_MODE_PARAMETER,
    Object.freeze({
      id: CINEMA2_SPATIAL_REFERENCE_OBJECT_COLOR_ID,
      label: 'Object Color',
      type: 'color' as const,
      defaultValue: color(0.44, 0.62, 0.68),
      section: 'Scene', group: 'Objects', order: 10,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_SPATIAL_REFERENCE_OBJECT_EMISSIVE_ID,
      label: 'Object Emissive',
      type: 'float' as const,
      defaultValue: 0.08,
      min: 0, max: 2, step: 0.01,
      section: 'Scene', group: 'Objects', order: 11,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
      modulatable: true, choreographable: true,
    }),
    Object.freeze({
      id: CINEMA2_SPATIAL_REFERENCE_BLOOM_ENABLED_ID,
      label: 'Bloom',
      type: 'boolean' as const,
      defaultValue: true,
      section: 'Design', group: 'Post', order: 20,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_SPATIAL_REFERENCE_BLOOM_INTENSITY_ID,
      label: 'Bloom Intensity',
      type: 'float' as const,
      defaultValue: 0.8,
      min: 0, max: 3, step: 0.05,
      section: 'Design', group: 'Post', order: 21,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_SPATIAL_REFERENCE_REACTIVITY_ID,
      label: 'Reactivity',
      description: 'Scales the shared light/object response without changing authored Audio Intelligence values.',
      type: 'float' as const,
      defaultValue: 0.72,
      min: 0, max: 1.5, step: 0.01,
      section: 'React', group: 'Response', order: 30,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
      modulatable: true, choreographable: true,
    }),
    Object.freeze({
      id: CINEMA2_SPATIAL_REFERENCE_ORBIT_RADIUS_ID,
      label: 'Orbit Radius', type: 'float' as const, defaultValue: 6.4,
      min: 3.5, max: 12, step: 0.1,
      section: 'Camera', group: 'Orbit', order: 40,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_SPATIAL_REFERENCE_ORBIT_AZIMUTH_ID,
      label: 'Azimuth', type: 'float' as const, defaultValue: -18,
      min: -180, max: 180, step: 1, unit: '°',
      section: 'Camera', group: 'Orbit', order: 41,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_SPATIAL_REFERENCE_ORBIT_ELEVATION_ID,
      label: 'Elevation', type: 'float' as const, defaultValue: 20,
      min: -70, max: 70, step: 1, unit: '°',
      section: 'Camera', group: 'Orbit', order: 42,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_SPATIAL_REFERENCE_FOV_ID,
      label: 'Field of View', type: 'float' as const, defaultValue: 48,
      min: 28, max: 82, step: 1, unit: '°',
      section: 'Camera', group: 'Lens', order: 43,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
      choreographable: true,
    }),
    Object.freeze({
      id: CINEMA2_SPATIAL_REFERENCE_CAMERA_SMOOTHING_ID,
      label: 'Smoothing', type: 'float' as const, defaultValue: 85,
      min: 0, max: 500, step: 5, unit: 'ms',
      section: 'Camera', group: 'Motion', order: 44,
      exposure: 'advanced' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_SPATIAL_REFERENCE_KEY_LIGHT_INTENSITY_ID,
      label: 'Key Light', type: 'float' as const, defaultValue: 1.35,
      min: 0, max: 4, step: 0.05,
      section: 'Environment', group: 'Lighting', order: 50,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
      modulatable: true, choreographable: true,
    }),
    Object.freeze({
      id: CINEMA2_SPATIAL_REFERENCE_BACKGROUND_ID,
      label: 'Background', type: 'color' as const,
      defaultValue: color(0.025, 0.035, 0.045),
      section: 'Environment', group: 'Environment', order: 51,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_SPATIAL_REFERENCE_EXPOSURE_ID,
      label: 'Exposure', type: 'float' as const, defaultValue: 1.05,
      min: 0.25, max: 2.5, step: 0.05,
      section: 'Environment', group: 'Environment', order: 52,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_SPATIAL_REFERENCE_FOG_DENSITY_ID,
      label: 'Fog Density', type: 'float' as const, defaultValue: 0.035,
      min: 0, max: 0.18, step: 0.005,
      section: 'Environment', group: 'Environment', order: 53,
      exposure: 'advanced' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
  ]),
  modules: Object.freeze([
    Object.freeze({
      id: CINEMA2_SPATIAL_REFERENCE_OBJECT_MODULE_ID,
      typeId: OBJECT3D_TYPE_ID,
      version: 1,
      enabled: true,
      parameters: Object.freeze({ color: color(0.44, 0.62, 0.68), emissiveIntensity: 0.08 }),
      parameterBindings: Object.freeze({
        color: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_OBJECT_COLOR_ID),
        emissiveIntensity: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_OBJECT_EMISSIVE_ID),
      }),
      config: Object.freeze({
        source: Object.freeze({
          kind: 'svg',
          sourceId: 'cinema2-spatial-reference-hex',
          revision: 1,
          rawSvg: SPATIAL_REFERENCE_SVG,
        }),
        material: Object.freeze({ color: color(0.44, 0.62, 0.68), emissiveIntensity: 0.08 }),
      }),
    }),
    Object.freeze({
      id: OVERLAY_MODULE_ID,
      typeId: FULLSCREEN_SHADER_TYPE_ID,
      version: 1,
      enabled: true,
      config: Object.freeze({
        label: 'Cinema 2.0 Spatial Reference Overlay',
        fragmentSource: SPATIAL_REFERENCE_OVERLAY_FRAGMENT,
      }),
    }),
  ]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: WORLD_ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
      Object.freeze({
        id: CINEMA2_SPATIAL_REFERENCE_FOCUS_NODE_ID,
        kind: 'primitive' as const,
        parent: cinema2Ref(WORLD_ROOT_NODE_ID),
        transform: Object.freeze({ position: vec3(0, 0.15, -0.8) }),
      }),
      Object.freeze({
        id: LIGHT_RIG_NODE_ID,
        kind: 'group' as const,
        parent: cinema2Ref(WORLD_ROOT_NODE_ID),
        transform: Object.freeze({ position: vec3(0.3, 0.5, 0) }),
      }),
      Object.freeze({
        id: OBJECT_LEFT_NODE_ID,
        kind: 'module' as const,
        parent: cinema2Ref(WORLD_ROOT_NODE_ID),
        module: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_OBJECT_MODULE_ID),
        transform: Object.freeze({ position: vec3(-1.65, -0.45, 0.1), rotation: vec3(0.08, -0.32, 0.1), scale: vec3(0.82, 0.82, 0.82) }),
      }),
      Object.freeze({
        id: CINEMA2_SPATIAL_REFERENCE_OBJECT_CENTER_NODE_ID,
        kind: 'module' as const,
        parent: cinema2Ref(WORLD_ROOT_NODE_ID),
        module: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_OBJECT_MODULE_ID),
        transform: Object.freeze({ position: vec3(0, 0.5, -1.0), rotation: vec3(-0.08, 0.22, 0.04), scale: vec3(1.08, 1.08, 1.08) }),
      }),
      Object.freeze({
        id: OBJECT_RIGHT_NODE_ID,
        kind: 'module' as const,
        parent: cinema2Ref(WORLD_ROOT_NODE_ID),
        module: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_OBJECT_MODULE_ID),
        transform: Object.freeze({ position: vec3(1.7, -0.3, -2.15), rotation: vec3(0.18, 0.5, -0.12), scale: vec3(1.28, 1.28, 1.28) }),
      }),
      Object.freeze({ id: OVERLAY_ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'normalized-screen' as const }),
      Object.freeze({
        id: OVERLAY_NODE_ID,
        kind: 'module' as const,
        parent: cinema2Ref(OVERLAY_ROOT_NODE_ID),
        module: cinema2Ref(OVERLAY_MODULE_ID),
      }),
    ]),
    roots: Object.freeze([cinema2Ref(WORLD_ROOT_NODE_ID), cinema2Ref(OVERLAY_ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([
    Object.freeze({
      id: WORLD_LAYER_ID,
      label: 'World Reference',
      source: cinema2Ref(WORLD_ROOT_NODE_ID),
      role: 'world',
      depthPolicy: 'read-write' as const,
      order: 0,
    }),
    Object.freeze({
      id: OVERLAY_LAYER_ID,
      label: 'Screen Reference',
      source: cinema2Ref(OVERLAY_ROOT_NODE_ID),
      role: 'overlay',
      depthPolicy: 'disabled' as const,
      order: 1,
    }),
  ]),
  cameras: Object.freeze([
    Object.freeze({
      id: CINEMA2_SPATIAL_REFERENCE_ORBIT_CAMERA_ID,
      label: 'Reference Orbit',
      projection: 'perspective' as const,
      targetNode: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_FOCUS_NODE_ID),
      fovDegrees: 48,
      near: 0.1,
      far: 80,
      rig: Object.freeze({ kind: 'orbit' as const, radius: 6.4, azimuthDegrees: -18, elevationDegrees: 20, angularVelocityDegreesPerSecond: 3.5 }),
      transition: Object.freeze({
        durationSeconds: 0.9,
        easing: 'smoothstep' as const,
        fromPosition: vec3(0, 4.8, 8.5),
        fromTarget: vec3(0, 0, -0.8),
        fromFovDegrees: 54,
      }),
      controls: Object.freeze({
        orbitRadius: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_ORBIT_RADIUS_ID),
        orbitAzimuthDegrees: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_ORBIT_AZIMUTH_ID),
        orbitElevationDegrees: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_ORBIT_ELEVATION_ID),
        fovDegrees: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_FOV_ID),
        smoothingMs: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_CAMERA_SMOOTHING_ID),
      }),
      safety: Object.freeze({ minFovDegrees: 24, maxFovDegrees: 90, minNear: 0.02, maxFar: 160, maxPositionOffset: vec3(4, 4, 4), maxTargetOffset: vec3(2, 2, 2) }),
    }),
    Object.freeze({
      id: CINEMA2_SPATIAL_REFERENCE_FLY_CAMERA_ID,
      label: 'Reference Fly',
      projection: 'perspective' as const,
      fovDegrees: 50,
      near: 0.1,
      far: 80,
      rig: Object.freeze({
        kind: 'fly' as const,
        speed: 2.2,
        loop: true,
        points: Object.freeze([
          Object.freeze({ position: vec3(-4.5, 1.8, 5.8), target: vec3(0, 0, -0.8), fovDegrees: 52 }),
          Object.freeze({ position: vec3(0.4, 3.1, 4.6), target: vec3(0, 0.2, -1.0), fovDegrees: 46 }),
          Object.freeze({ position: vec3(4.4, 1.3, 3.5), target: vec3(0, 0, -1.2), fovDegrees: 50 }),
        ]),
      }),
    }),
  ]),
  lighting: Object.freeze({
    lights: Object.freeze([
      Object.freeze({
        id: CINEMA2_SPATIAL_REFERENCE_KEY_LIGHT_ID,
        type: 'directional' as const,
        color: color(0.76, 0.9, 0.94),
        intensity: 1.35,
        transform: Object.freeze({ position: vec3(3.2, 4.5, 5.6), rotation: vec3(-0.45, 0.4, 0) }),
        node: cinema2Ref(LIGHT_RIG_NODE_ID),
        targetNode: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_FOCUS_NODE_ID),
        controls: Object.freeze({ intensity: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_KEY_LIGHT_INTENSITY_ID) }),
      }),
      Object.freeze({
        id: CINEMA2_SPATIAL_REFERENCE_FILL_LIGHT_ID,
        type: 'point' as const,
        color: color(0.55, 0.62, 0.72),
        intensity: 0.6,
        transform: Object.freeze({ position: vec3(-3.6, 1, 3) }),
        node: cinema2Ref(WORLD_ROOT_NODE_ID),
      }),
      Object.freeze({
        id: CINEMA2_SPATIAL_REFERENCE_AMBIENT_LIGHT_ID,
        type: 'ambient' as const,
        color: color(0.34, 0.39, 0.44),
        intensity: 0.32,
      }),
    ]),
  }),
  environment: Object.freeze({
    backgroundColor: color(0.025, 0.035, 0.045),
    exposure: 1.05,
    fog: Object.freeze({ mode: 'exponential' as const, color: color(0.045, 0.06, 0.07), density: 0.035 }),
    controls: Object.freeze({
      backgroundColor: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_BACKGROUND_ID),
      exposure: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_EXPOSURE_ID),
      fogDensity: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_FOG_DENSITY_ID),
    }),
  }),
  effects: Object.freeze([
    Object.freeze({
      id: BLOOM_EFFECT_ID,
      typeId: BLOOM_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 0,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 0.35, threshold: 0.52, radius: 2.0, intensity: 0.8 }),
      parameterBindings: Object.freeze({
        enabled: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_BLOOM_ENABLED_ID),
        intensity: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_BLOOM_INTENSITY_ID),
      }),
    }),
  ]),
  choreography: Object.freeze({
    rules: Object.freeze([
      Object.freeze({
        id: ENERGY_RULE_ID,
        priority: 20,
        source: Object.freeze({
          signal: 'continuous' as const,
          capability: 'audio.features' as const,
          path: 'audio.features.overallEnergy' as const,
          clamp: vec2(0, 1),
          smoothingMs: 90,
        }),
        strengthParameter: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_REACTIVITY_ID),
        actions: Object.freeze([
          Object.freeze({
            id: ENERGY_LIGHT_ACTION_ID,
            target: Object.freeze({ kind: 'light' as const, ref: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_KEY_LIGHT_ID), property: 'intensity' }),
            operation: 'add' as const,
            value: 1.05,
          }),
          Object.freeze({
            id: ENERGY_OBJECT_ACTION_ID,
            target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_OBJECT_MODULE_ID), property: 'emissiveIntensity' }),
            operation: 'add' as const,
            value: 0.9,
          }),
          Object.freeze({
            id: ENERGY_ROTATION_ACTION_ID,
            target: Object.freeze({ kind: 'scene-node' as const, ref: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_OBJECT_CENTER_NODE_ID), property: 'transform.rotation' }),
            operation: 'add' as const,
            value: vec3(0.08, 0.22, 0.04),
          }),
        ]),
      }),
      Object.freeze({
        id: DOWNBEAT_RULE_ID,
        priority: 30,
        source: Object.freeze({ signal: 'downbeat' as const, capability: 'music.downbeat' as const }),
        actions: Object.freeze([
          Object.freeze({
            id: DOWNBEAT_CAMERA_ACTION_ID,
            target: Object.freeze({ kind: 'camera' as const, ref: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_ORBIT_CAMERA_ID), property: 'fovDegrees' }),
            operation: 'envelope' as const,
            composition: 'add' as const,
            value: -5,
            envelope: Object.freeze({ attack: 0, hold: 0.12, release: 0.88, unit: 'beats' as const }),
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
    ]),
    passes: Object.freeze([
      Object.freeze({
        id: SCENE_PASS_ID,
        kind: 'scene' as const,
        layers: Object.freeze([cinema2Ref(WORLD_LAYER_ID), cinema2Ref(OVERLAY_LAYER_ID)]),
        outputs: Object.freeze([
          Object.freeze({ id: SCENE_COLOR_OUTPUT_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'color' as const }),
          Object.freeze({ id: SCENE_DEPTH_OUTPUT_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'depth' as const }),
        ]),
      }),
      Object.freeze({
        id: BLOOM_PASS_ID,
        kind: 'fullscreen' as const,
        dependsOn: Object.freeze([cinema2Ref(SCENE_PASS_ID)]),
        inputs: Object.freeze([
          Object.freeze({
            id: BLOOM_INPUT_ID,
            source: Object.freeze({ pass: cinema2Ref(SCENE_PASS_ID), output: SCENE_COLOR_OUTPUT_ID }),
            attachment: 'color' as const,
          }),
        ]),
        effect: cinema2Ref(BLOOM_EFFECT_ID),
      }),
    ]),
    outputPass: cinema2Ref(BLOOM_PASS_ID),
  }),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_SPATIAL_REFERENCE_ORBIT_CAMERA_ID) }),
  output: Object.freeze({ renderPass: cinema2Ref(BLOOM_PASS_ID), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
})
