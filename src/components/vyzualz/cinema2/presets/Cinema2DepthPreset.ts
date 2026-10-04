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
  type Cinema2JsonValue,
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
import { cinema2CinematicMotion } from './Cinema2CameraMotionAuthoring'

export const CINEMA2_DEPTH_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.depth')
export const CINEMA2_DEPTH_MODULE_ID = cinema2StableId<Cinema2ModuleId>('depth-tunnel')
export const CINEMA2_DEPTH_CAMERA_ID = cinema2StableId<Cinema2CameraId>('depth-camera')

const parameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`depth-${name}`)
export const CINEMA2_DEPTH_INTENSITY_ID = parameterId('intensity')
export const CINEMA2_DEPTH_AUTO_PERFORMANCE_ID = parameterId('auto-performance')
export const CINEMA2_DEPTH_BPM_SYNC_ID = parameterId('bpm-sync')
export const CINEMA2_DEPTH_MOTION_SAFETY_ID = parameterId('motion-safety')
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
export const CINEMA2_DEPTH_LAP_DISTANCE = 42
export const CINEMA2_DEPTH_LAP_SECONDS = 14

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

const choreographyRuleId = (name: string) => cinema2StableId<Cinema2ChoreographyRuleId>(`depth-${name}-rule`)
const choreographyActionId = (name: string) => cinema2StableId<Cinema2ChoreographyActionId>(`depth-${name}-action`)

const moduleEnvelopeAction = (name: string, property: string, value: number, hold: number, release: number) => Object.freeze({
  id: choreographyActionId(name),
  target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_DEPTH_MODULE_ID), property }),
  operation: 'envelope' as const,
  value,
  composition: 'replace' as const,
  envelope: Object.freeze({ attack: 0.025, hold, release, unit: 'seconds' as const }),
  retrigger: 'restart' as const,
})

const moduleContinuousAction = (name: string, property: string) => Object.freeze({
  id: choreographyActionId(name),
  target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_DEPTH_MODULE_ID), property }),
  operation: 'replace' as const,
  value: 1,
})

const effectEnvelopeAction = (name: string, effect: Cinema2EffectId, property: string, value: number, hold: number, release: number) => Object.freeze({
  id: choreographyActionId(name),
  target: Object.freeze({ kind: 'effect' as const, ref: cinema2Ref(effect), property }),
  operation: 'envelope' as const,
  value,
  composition: 'add' as const,
  envelope: Object.freeze({ attack: 0.025, hold, release, unit: 'seconds' as const }),
  retrigger: 'restart' as const,
})

const effectContinuousAction = (name: string, effect: Cinema2EffectId, property: string, value: number) => Object.freeze({
  id: choreographyActionId(name),
  target: Object.freeze({ kind: 'effect' as const, ref: cinema2Ref(effect), property }),
  operation: 'add' as const,
  value,
})

const cameraEnvelopeAction = (name: string, property: string, value: Cinema2JsonValue, hold: number, release: number) => Object.freeze({
  id: choreographyActionId(name),
  target: Object.freeze({ kind: 'camera' as const, ref: cinema2Ref(CINEMA2_DEPTH_CAMERA_ID), property }),
  operation: 'envelope' as const,
  value,
  composition: 'add' as const,
  envelope: Object.freeze({ attack: 0.04, hold, release, unit: 'seconds' as const }),
  retrigger: 'restart' as const,
})

const cameraContinuousAction = (name: string, property: string, value: Cinema2JsonValue) => Object.freeze({
  id: choreographyActionId(name),
  target: Object.freeze({ kind: 'camera' as const, ref: cinema2Ref(CINEMA2_DEPTH_CAMERA_ID), property }),
  operation: 'add' as const,
  value,
})

function depthFlightPoints() {
  const point = (x: number, y: number, z: number, targetX: number, targetY: number, targetZ: number, fovDegrees: number) => Object.freeze({
    position: vec3(x, y, z),
    target: vec3(targetX, targetY, targetZ),
    fovDegrees,
  })
  return Object.freeze([
    point(1.05, 0.75, 8.4, 0, 0, -18, 59),
    point(0.35, 0.28, -1.5, -0.2, 0.08, -28, 58),
    point(-0.45, -0.08, -11.5, 0.15, -0.04, -38, 57.5),
    point(0.24, 0.14, -21.8, -0.12, 0.12, -49, 60.5),
    point(0.9, 0.55, -31.2, 0, 0.04, -59, 59),
  ])
}

/** Step-3 looping camera and music choreography for the procedural Depth tunnel. */
export const CINEMA2_DEPTH_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_DEPTH_PRESET_ID,
  revision: 3,
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
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'Beats add a restrained portal-light accent.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Downbeats illuminate the near gate and lift bloom.' }),
    Object.freeze({ id: 'music.phrase' as const, requirement: 'optional' as const, purpose: 'Phrase boundaries add side articulation and a bounded camera offset.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'Drops widen the active portal span and push light, bloom and camera energy.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'Build intensity increases light density, atmosphere and camera approach.' }),
  ]),
  parameters: Object.freeze([
    CINEMA2_QUALITY_MODE_PARAMETER,
    floatParameter(CINEMA2_DEPTH_INTENSITY_ID, 'Intensity', 'Master brightness of the portal lights and center object.', 1, 0, 2, 0.01, 'master-controls', 1, 'Light'),
    Object.freeze({ ...parameterBase, id: CINEMA2_DEPTH_AUTO_PERFORMANCE_ID, label: 'Auto Performance', description: 'Allow beat, downbeat, phrase, build and drop signals to add bounded light, camera and effect accents.', type: 'boolean' as const, defaultValue: true, designParentGroup: 'master-controls' as const, order: 2, group: 'Playback' }),
    Object.freeze({ ...parameterBase, id: CINEMA2_DEPTH_BPM_SYNC_ID, label: 'BPM Sync', description: 'Sync camera travel and sway to detected track tempo. Without a track, motion free-runs at the authored rate.', type: 'boolean' as const, defaultValue: true, designParentGroup: 'master-controls' as const, order: 3, group: 'Playback' }),
    Object.freeze({
      ...parameterBase,
      id: CINEMA2_DEPTH_MOTION_SAFETY_ID,
      label: 'Motion Safety',
      description: 'Full uses the complete fly-through, Reduced slows travel and limits sway, and Lock Off holds the opening composition.',
      type: 'enum' as const,
      defaultValue: 'full',
      designParentGroup: 'master-controls' as const,
      order: 4,
      group: 'Playback',
      options: Object.freeze([
        Object.freeze({ value: 'full', label: 'Full Motion' }),
        Object.freeze({ value: 'reduced', label: 'Reduced Motion' }),
        Object.freeze({ value: 'lockoff', label: 'Lock Off' }),
      ]),
    }),
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
      config: Object.freeze({ portalCount: 10, aperture: 7.4, spacing: 4.2, frameThickness: 0.5, lapCopies: 3 }),
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
        beatAccent: 0,
        downbeatAccent: 0,
        phraseAccent: 0,
        buildAmount: 0,
        dropAccent: 0,
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
      label: 'Depth Flight Camera',
      projection: 'perspective' as const,
      fovDegrees: 59,
      minAspect: 1,
      near: 0.25,
      far: 110,
      transform: Object.freeze({ position: vec3(1.05, 0.75, 8.4) }),
      target: vec3(0, 0, -18),
      rig: Object.freeze({
        kind: 'fly' as const,
        points: depthFlightPoints(),
        durationSeconds: CINEMA2_DEPTH_LAP_SECONDS,
        loop: true,
        repeatOffset: vec3(0, 0, -CINEMA2_DEPTH_LAP_DISTANCE),
      }),
      motion: cinema2CinematicMotion('gentle', {
        splinePath: true,
        overrides: Object.freeze({
          rollDegrees: -7,
          drift: Object.freeze({ position: 0.18, target: 0.11, rollDegrees: 1.1, fovDegrees: 0.9, speed: 0.075, seed: 17 }),
          bank: Object.freeze({ maxDegrees: 3.8, gain: 0.62, smoothingMs: 520 }),
          fovRateLimitDegreesPerSecond: 9,
          tempo: Object.freeze({ referenceBpm: 120, flightSpeed: true, minRate: 0.72, maxRate: 1.4, weave: 0.24, bob: 0.08, roll: 1.7, fov: 1, punch: 1.4 }),
        }),
      }),
      controls: Object.freeze({
        motionSafety: cinema2Ref(CINEMA2_DEPTH_MOTION_SAFETY_ID),
        tempoSync: cinema2Ref(CINEMA2_DEPTH_BPM_SYNC_ID),
      }),
      smoothingMs: 90,
      safety: Object.freeze({
        minPosition: vec3(-4, -4, -100_000),
        maxPosition: vec3(4, 4, 100_000),
        maxPositionOffset: vec3(0.9, 0.65, 1.2),
        maxTargetOffset: vec3(0.5, 0.4, 0.75),
        minFovDegrees: 48,
        maxFovDegrees: 68,
        minNear: 0.1,
        maxFar: 140,
      }),
    }),
  ]),
  choreography: Object.freeze({
    rules: Object.freeze([
      Object.freeze({
        id: choreographyRuleId('beat'),
        priority: 20,
        enabledParameter: cinema2Ref(CINEMA2_DEPTH_AUTO_PERFORMANCE_ID),
        source: Object.freeze({ signal: 'beat' as const, capability: 'music.beat' as const }),
        actions: Object.freeze([
          moduleEnvelopeAction('beat-light', 'beatAccent', 1, 0.025, 0.16),
          effectEnvelopeAction('beat-bloom', BLOOM_EFFECT_ID, 'intensity', 0.06, 0.02, 0.16),
        ]),
      }),
      Object.freeze({
        id: choreographyRuleId('downbeat'),
        priority: 30,
        enabledParameter: cinema2Ref(CINEMA2_DEPTH_AUTO_PERFORMANCE_ID),
        source: Object.freeze({ signal: 'downbeat' as const, capability: 'music.downbeat' as const }),
        conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([
          moduleEnvelopeAction('downbeat-light', 'downbeatAccent', 1, 0.04, 0.34),
          effectEnvelopeAction('downbeat-bloom', BLOOM_EFFECT_ID, 'intensity', 0.16, 0.04, 0.32),
          cameraEnvelopeAction('downbeat-roll', 'roll', 1.2, 0.035, 0.28),
        ]),
      }),
      Object.freeze({
        id: choreographyRuleId('phrase'),
        priority: 40,
        enabledParameter: cinema2Ref(CINEMA2_DEPTH_AUTO_PERFORMANCE_ID),
        source: Object.freeze({ signal: 'phrase' as const, capability: 'music.phrase' as const }),
        conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([
          moduleEnvelopeAction('phrase-light', 'phraseAccent', 1, 0.08, 0.7),
          effectEnvelopeAction('phrase-atmosphere', ATMOSPHERE_EFFECT_ID, 'density', 0.004, 0.08, 0.68),
          cameraEnvelopeAction('phrase-position', 'transform.position', vec3(-0.22, 0.09, -0.14), 0.08, 0.68),
          cameraEnvelopeAction('phrase-target', 'target', vec3(0.16, 0.04, -0.08), 0.08, 0.68),
        ]),
      }),
      Object.freeze({
        id: choreographyRuleId('build'),
        priority: 45,
        enabledParameter: cinema2Ref(CINEMA2_DEPTH_AUTO_PERFORMANCE_ID),
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 120 }),
        actions: Object.freeze([
          moduleContinuousAction('build-light', 'buildAmount'),
          effectContinuousAction('build-atmosphere', ATMOSPHERE_EFFECT_ID, 'density', 0.008),
          cameraContinuousAction('build-push', 'transform.position', vec3(0, 0.05, -0.38)),
          cameraContinuousAction('build-fov', 'fovDegrees', -1.2),
        ]),
      }),
      Object.freeze({
        id: choreographyRuleId('drop'),
        priority: 50,
        enabledParameter: cinema2Ref(CINEMA2_DEPTH_AUTO_PERFORMANCE_ID),
        source: Object.freeze({ signal: 'drop' as const, capability: 'music.drop' as const }),
        conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([
          moduleEnvelopeAction('drop-light', 'dropAccent', 1, 0.08, 0.62),
          effectEnvelopeAction('drop-bloom', BLOOM_EFFECT_ID, 'intensity', 0.34, 0.06, 0.56),
          effectEnvelopeAction('drop-contrast', FINISH_EFFECT_ID, 'contrast', 0.08, 0.06, 0.56),
          cameraEnvelopeAction('drop-push', 'transform.position', vec3(0, -0.04, -0.62), 0.08, 0.56),
          cameraEnvelopeAction('drop-fov', 'fovDegrees', 1.6, 0.08, 0.56),
        ]),
      }),
    ]),
  }),
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
