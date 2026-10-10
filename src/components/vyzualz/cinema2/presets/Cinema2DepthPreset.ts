import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleId,
  type Cinema2ChoreographySignal,
  type Cinema2CapabilityId,
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
import {
  CINEMA2_DEPTH_DEFAULT_CENTER_Z,
  CINEMA2_DEPTH_LAYOUT_CONFIG,
  CINEMA2_DEPTH_REPEAT_DISTANCE,
  CINEMA2_DEPTH_REPEAT_ORIGIN_Z,
} from '../modules/depth/Cinema2DepthLayout'
import { CINEMA2_DEPTH_LIGHT_PROGRAMS, type Cinema2DepthLightProgram } from '../modules/depth/Cinema2DepthLightPrograms'
import { CINEMA2_DEPTH_TRIGGER_IDS, type Cinema2DepthTriggerId } from '../modules/depth/Cinema2DepthOrchestration'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'

export const CINEMA2_DEPTH_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.depth')
export const CINEMA2_DEPTH_MODULE_ID = cinema2StableId<Cinema2ModuleId>('depth-tunnel')
export const CINEMA2_DEPTH_CAMERA_ID = cinema2StableId<Cinema2CameraId>('depth-camera')

const parameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`depth-${name}`)
export const CINEMA2_DEPTH_INTENSITY_ID = parameterId('intensity')
export const CINEMA2_DEPTH_AUTO_PERFORMANCE_ID = parameterId('auto-performance')
export const CINEMA2_DEPTH_BPM_SYNC_ID = parameterId('bpm-sync')
export const CINEMA2_DEPTH_MOTION_SAFETY_ID = parameterId('motion-safety')
export const CINEMA2_DEPTH_PROGRAM_ID = parameterId('program')
export const CINEMA2_DEPTH_PATTERN_CHANGE_ID = parameterId('pattern-change')
export const CINEMA2_DEPTH_TRIGGER_ID = parameterId('trigger')
export const CINEMA2_DEPTH_ROUTE_DENSITY_ID = parameterId('route-density')
export const CINEMA2_DEPTH_PULSE_WIDTH_ID = parameterId('pulse-width')
export const CINEMA2_DEPTH_DROP_INTENSITY_ID = parameterId('drop-intensity')
export const CINEMA2_DEPTH_MUSICAL_CUE_ID = parameterId('musical-cue')
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
export const CINEMA2_DEPTH_LAP_DISTANCE = CINEMA2_DEPTH_REPEAT_DISTANCE
export const CINEMA2_DEPTH_LAP_SECONDS = 48
const DEPTH_CENTER_DISTANCE = CINEMA2_DEPTH_REPEAT_ORIGIN_Z - CINEMA2_DEPTH_DEFAULT_CENTER_Z

const vec3 = (x: number, y: number, z: number): Cinema2Vector3 => Object.freeze([x, y, z])
const color = (r: number, g: number, b: number, a = 1): Cinema2Color => Object.freeze([r, g, b, a])
const DEFAULT_BACKGROUND = color(0.0005, 0.0007, 0.001)
const DEFAULT_LIGHT = color(0.96, 0.97, 1)
const DEFAULT_BODY = color(0.018, 0.019, 0.024)

const PATTERN_LABELS: Readonly<Record<Cinema2DepthLightProgram, string>> = Object.freeze({
  architecturalSparse: 'Sparse Architecture',
  depthChase: 'Depth Chase',
  sideOrbit: 'Side Orbit',
  gatePulse: 'Gate Pulse',
  alternatingFrames: 'Alternating Frames',
  fullPulse: 'Full Pulse',
  depthDischarge: 'Depth Discharge',
  portalRelay: 'Portal Relay',
})

const TRIGGER_LABELS: Readonly<Record<Cinema2DepthTriggerId, string>> = Object.freeze({
  beat: 'Every Beat',
  kick: 'Kick',
  snare: 'Snare',
  downbeat: 'Downbeat',
  beat2: 'Every 2 Beats',
  beat4: 'Every 4 Beats',
  bar: 'Every Bar',
  bar4: 'Every 4 Bars',
  bar8: 'Every 8 Bars',
  phrase: 'Phrase',
  drop: 'Drop',
})

const MUSIC_CUES = Object.freeze([
  ['kick', 'kick', 'music.rhythm-events'],
  ['snare', 'snare', 'music.rhythm-events'],
  ['transient', 'transient', 'music.rhythm-events'],
  ['beat', 'beat', 'music.beat'],
  ['downbeat', 'downbeat', 'music.downbeat'],
  ['bar', 'bar', 'music.bar'],
  ['phrase', 'phrase', 'music.phrase'],
  ['section', 'section-change', 'music.section'],
  ['drop', 'drop', 'music.drop'],
] as const satisfies readonly (readonly [string, Cinema2ChoreographySignal, Cinema2CapabilityId])[])

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

function depthFlightPoints() {
  const point = (progress: number) => {
    const z = CINEMA2_DEPTH_REPEAT_ORIGIN_Z - CINEMA2_DEPTH_LAP_DISTANCE * progress
    return Object.freeze({
      position: vec3(0, 0, z),
      target: vec3(0, 0, z - DEPTH_CENTER_DISTANCE),
      fovDegrees: 59,
      rollDegrees: 0,
    })
  }
  return Object.freeze([
    point(0),
    point(0.25),
    point(0.5),
    point(0.75),
  ])
}

/** Step-3 looping camera and music choreography for the procedural Depth tunnel. */
export const CINEMA2_DEPTH_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_DEPTH_PRESET_ID,
  revision: 12,
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
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'Beats brighten the currently active architectural bars.' }),
    Object.freeze({ id: 'music.rhythm-events' as const, requirement: 'optional' as const, purpose: 'Kick, snare and transient events excite distinct portal rings, lanes, pairs and helices.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Downbeats add one selected bar and lift bloom.' }),
    Object.freeze({ id: 'music.bar' as const, requirement: 'optional' as const, purpose: 'Bar boundaries advance manual and automatic tunnel patterns.' }),
    Object.freeze({ id: 'music.phrase' as const, requirement: 'optional' as const, purpose: 'Phrase boundaries add side articulation and a restrained atmosphere accent.' }),
    Object.freeze({ id: 'music.section' as const, requirement: 'optional' as const, purpose: 'Section context chooses sparse, relay, build and discharge behavior.' }),
    Object.freeze({ id: 'music.build' as const, requirement: 'optional' as const, purpose: 'Build progress recruits helical segments and stages the final four-beat portal countdown.' }),
    Object.freeze({ id: 'music.vocal-presence' as const, requirement: 'optional' as const, purpose: 'Quiet vocal passages preserve tunnel negative space.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'Drops accent selected bars, light and bloom without flooding the tunnel.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'Build intensity increases light travel and active-bar brightness without lifting dark strips.' }),
  ]),
  parameters: Object.freeze([
    CINEMA2_QUALITY_MODE_PARAMETER,
    floatParameter(CINEMA2_DEPTH_INTENSITY_ID, 'Intensity', 'Master brightness of the portal lights and their local structural response.', 1, 0, 2, 0.01, 'master-controls', 1, 'Light'),
    Object.freeze({ ...parameterBase, id: CINEMA2_DEPTH_AUTO_PERFORMANCE_ID, label: 'Auto Performance', description: 'Lets the shared Audio Intelligence choose sparse, chase, relay, build, countdown and discharge behavior from the current musical context.', type: 'boolean' as const, defaultValue: true, designParentGroup: 'master-controls' as const, order: 2, group: 'Playback' }),
    Object.freeze({ ...parameterBase, id: CINEMA2_DEPTH_BPM_SYNC_ID, label: 'BPM Sync', description: 'Sync the camera travel, geometry-aware light routes and musical rotation changes to detected track tempo. Without a track, they free-run deterministically.', type: 'boolean' as const, defaultValue: true, designParentGroup: 'master-controls' as const, order: 3, group: 'Playback' }),
    Object.freeze({
      ...parameterBase,
      id: CINEMA2_DEPTH_MOTION_SAFETY_ID,
      label: 'Motion Safety',
      description: 'Full uses the authored forward pace, Reduced moves more slowly, and Lock Off holds the opening composition.',
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
      description: 'Choose how portal rings, depth lanes, opposing pairs and helices respond to the music. Choosing a program turns Auto Performance off.',
      type: 'enum' as const,
      defaultValue: 'architecturalSparse',
      metadata: Object.freeze({ userEditSetParameters: Object.freeze({ [CINEMA2_DEPTH_AUTO_PERFORMANCE_ID]: false }) }),
      designParentGroup: 'design' as const,
      order: 1,
      group: 'Light Program',
      options: Object.freeze(CINEMA2_DEPTH_LIGHT_PROGRAMS.map(value => Object.freeze({ value, label: PATTERN_LABELS[value] }))),
    }),
    Object.freeze({
      ...parameterBase,
      id: CINEMA2_DEPTH_PATTERN_CHANGE_ID,
      label: 'Pattern Change',
      description: 'Advances through all eight geometry-aware programs when the selected Trigger occurs. Enabling it turns Auto Performance off.',
      type: 'boolean' as const,
      defaultValue: false,
      metadata: Object.freeze({ userEditSetParameters: Object.freeze({ [CINEMA2_DEPTH_AUTO_PERFORMANCE_ID]: false }) }),
      designParentGroup: 'design' as const,
      order: 2,
      group: 'Light Program',
    }),
    Object.freeze({
      ...parameterBase,
      id: CINEMA2_DEPTH_TRIGGER_ID,
      label: 'Trigger',
      description: 'Chooses the musical event that advances the lighting program while Pattern Change is enabled.',
      type: 'enum' as const,
      defaultValue: 'bar4',
      options: Object.freeze(CINEMA2_DEPTH_TRIGGER_IDS.map(value => Object.freeze({ value, label: TRIGGER_LABELS[value] }))),
      visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: CINEMA2_DEPTH_PATTERN_CHANGE_ID, value: true })]),
      designParentGroup: 'design' as const,
      order: 3,
      group: 'Light Program',
    }),
    Object.freeze({
      ...parameterBase,
      id: CINEMA2_DEPTH_DIRECTION_ID,
      label: 'Direction',
      description: 'Run directional light programs deeper into the tunnel or back toward the camera.',
      type: 'enum' as const,
      defaultValue: 'forward',
      designParentGroup: 'design' as const,
      order: 4,
      group: 'Light Program',
      options: Object.freeze([
        Object.freeze({ value: 'forward', label: 'Forward' }),
        Object.freeze({ value: 'reverse', label: 'Reverse' }),
      ]),
    }),
    floatParameter(CINEMA2_DEPTH_RATE_ID, 'Rate', 'Light-program travel or pulse rate. Zero freezes the selected state.', 1.1, 0, 4, 0.05, 'design', 5, 'Light Program'),
    Object.freeze({ ...parameterBase, id: CINEMA2_DEPTH_ACTIVE_SPAN_ID, label: 'Active Span', description: 'Approximate active-bar count for Sparse Architecture, or portal span for depth-based programs.', type: 'integer' as const, defaultValue: 4, min: 1, max: CINEMA2_DEPTH_LAYOUT_CONFIG.portalCount, step: 1, designParentGroup: 'design' as const, order: 6, group: 'Light Program' }),
    Object.freeze({ ...parameterBase, id: CINEMA2_DEPTH_SEED_ID, label: 'Random Seed', description: 'Deterministic starting phase for every light program.', type: 'integer' as const, defaultValue: 7, min: 0, max: 9999, step: 1, designParentGroup: 'design' as const, order: 7, group: 'Light Program' }),
    floatParameter(CINEMA2_DEPTH_ROUTE_DENSITY_ID, 'Route Density', 'How many neighboring portal lanes, ring families and helices join a routed musical cue.', 0.36, 0, 1, 0.01, 'effects', 1, 'Geometry Orchestration'),
    floatParameter(CINEMA2_DEPTH_PULSE_WIDTH_ID, 'Pulse Width', 'Physical width of traveling gate fronts, relay pulses and the drop discharge wave.', 0.42, 0, 1, 0.01, 'effects', 2, 'Geometry Orchestration'),
    floatParameter(CINEMA2_DEPTH_DROP_INTENSITY_ID, 'Drop Intensity', 'Strength of the post-countdown tunnel discharge and its structural afterglow.', 0.9, 0, 1, 0.01, 'effects', 3, 'Geometry Orchestration'),
    floatParameter(CINEMA2_DEPTH_SPILL_ID, 'Light Spill', 'How strongly each active strip reveals only its nearby structure.', 0.28, 0, 2, 0.01, 'design', 8, 'Material'),
    Object.freeze({ ...parameterBase, id: CINEMA2_DEPTH_CENTER_ENABLED_ID, label: 'Center Object', description: 'Show the static matte object at the tunnel vanishing point.', type: 'boolean' as const, defaultValue: true, designParentGroup: 'design' as const, order: 9, group: 'Center Object' }),
    Object.freeze({ ...floatParameter(CINEMA2_DEPTH_CENTER_SCALE_ID, 'Center Size', 'Scale of the object at the tunnel vanishing point.', 1, 0.25, 4, 0.05, 'design', 10, 'Center Object'), visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: CINEMA2_DEPTH_CENTER_ENABLED_ID, value: true })]) }),
    Object.freeze({ ...floatParameter(CINEMA2_DEPTH_CENTER_INTENSITY_ID, 'Center Tone', 'Matte gray visibility of the sphere at the tunnel vanishing point.', 0.7, 0, 2, 0.01, 'design', 11, 'Center Object'), visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: CINEMA2_DEPTH_CENTER_ENABLED_ID, value: true })]) }),
    floatParameter(CINEMA2_DEPTH_HAZE_ID, 'Atmosphere', 'Subtle depth-aware air around illuminated structure.', 0.004, 0, 0.12, 0.001, 'effects', 1, 'Atmosphere'),
    floatParameter(CINEMA2_DEPTH_BLOOM_ID, 'Bloom', 'Contained HDR halo around bright strip cores.', 0.28, 0, 3, 0.01, 'effects', 2, 'Post'),
    floatParameter(CINEMA2_DEPTH_FINISH_ID, 'Cinematic Finish', 'Tone curve, contrast, vignette and restrained grain.', 1, 0, 1, 0.01, 'effects', 3, 'Post'),
    colorParameter(CINEMA2_DEPTH_BACKGROUND_ID, 'Background', 'Near-black void behind the tunnel.', DEFAULT_BACKGROUND, 1),
    colorParameter(CINEMA2_DEPTH_LIGHT_COLOR_ID, 'Light Color', 'Color of the portal strips and their local spill.', DEFAULT_LIGHT, 2),
    colorParameter(CINEMA2_DEPTH_BODY_COLOR_ID, 'Structure Color', 'Base color of the dark portal bodies, nodes and rails.', DEFAULT_BODY, 3),
    Object.freeze({
      id: CINEMA2_DEPTH_MUSICAL_CUE_ID,
      label: 'Musical Cue',
      type: 'trigger' as const,
      section: 'React',
      group: 'Runtime',
      order: 999,
      exposure: 'hidden' as const,
      persistence: 'runtime-only' as const,
      reset: 'none' as const,
      modulatable: false,
      choreographable: false,
      automatable: false,
    }),
  ]),
  modules: Object.freeze([
    Object.freeze({
      id: CINEMA2_DEPTH_MODULE_ID,
      typeId: CINEMA2_DEPTH_NATIVE_MODULE_TYPE_ID,
      version: 1,
      enabled: true,
      config: CINEMA2_DEPTH_LAYOUT_CONFIG,
      parameters: Object.freeze({
        intensity: 1,
        program: 'architecturalSparse',
        autoPerformance: true,
        patternChange: false,
        trigger: 'bar4',
        sync: true,
        routeDensity: 0.36,
        pulseWidth: 0.42,
        dropIntensity: 0.9,
        direction: 'forward',
        rate: 1.1,
        activeSpan: 4,
        seed: 7,
        spill: 0.28,
        centerEnabled: true,
        centerScale: 1,
        centerIntensity: 0.7,
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
        autoPerformance: cinema2Ref(CINEMA2_DEPTH_AUTO_PERFORMANCE_ID),
        patternChange: cinema2Ref(CINEMA2_DEPTH_PATTERN_CHANGE_ID),
        trigger: cinema2Ref(CINEMA2_DEPTH_TRIGGER_ID),
        sync: cinema2Ref(CINEMA2_DEPTH_BPM_SYNC_ID),
        routeDensity: cinema2Ref(CINEMA2_DEPTH_ROUTE_DENSITY_ID),
        pulseWidth: cinema2Ref(CINEMA2_DEPTH_PULSE_WIDTH_ID),
        dropIntensity: cinema2Ref(CINEMA2_DEPTH_DROP_INTENSITY_ID),
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
      actionBindings: Object.freeze({ musicalCue: cinema2Ref(CINEMA2_DEPTH_MUSICAL_CUE_ID) }),
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
      transform: Object.freeze({ position: vec3(0, 0, CINEMA2_DEPTH_REPEAT_ORIGIN_Z) }),
      target: vec3(0, 0, CINEMA2_DEPTH_DEFAULT_CENTER_Z),
      rig: Object.freeze({
        kind: 'fly' as const,
        points: depthFlightPoints(),
        durationSeconds: CINEMA2_DEPTH_LAP_SECONDS,
        loop: true,
        repeatOffset: vec3(0, 0, -CINEMA2_DEPTH_LAP_DISTANCE),
      }),
      motion: Object.freeze({
        interpolation: 'spline' as const,
        constantSpeed: true,
        tempo: Object.freeze({
          referenceBpm: 120,
          flightSpeed: true,
          minRate: 0.72,
          maxRate: 1.4,
          weave: 0,
          bob: 0,
          roll: 0,
          fov: 0,
          punch: 0,
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
      ...MUSIC_CUES.map(([kind, signal, capability], index) => Object.freeze({
        id: choreographyRuleId(`${kind}-event`),
        priority: 70 + index,
        source: Object.freeze({ signal, capability }),
        actions: Object.freeze([Object.freeze({
          id: choreographyActionId(`${kind}-cue`),
          target: Object.freeze({ kind: 'parameter' as const, ref: cinema2Ref(CINEMA2_DEPTH_MUSICAL_CUE_ID) }),
          operation: 'spawn' as const,
          value: Object.freeze({ kind }),
        })]),
      })),
      Object.freeze({
        id: choreographyRuleId('beat'),
        priority: 20,
        enabledParameter: cinema2Ref(CINEMA2_DEPTH_AUTO_PERFORMANCE_ID),
        source: Object.freeze({ signal: 'beat' as const, capability: 'music.beat' as const }),
        actions: Object.freeze([
          moduleEnvelopeAction('beat-light', 'beatAccent', 1, 0.025, 0.16),
          effectEnvelopeAction('beat-bloom', BLOOM_EFFECT_ID, 'intensity', 0.025, 0.02, 0.16),
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
          effectEnvelopeAction('downbeat-bloom', BLOOM_EFFECT_ID, 'intensity', 0.05, 0.04, 0.32),
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
          effectEnvelopeAction('phrase-atmosphere', ATMOSPHERE_EFFECT_ID, 'density', 0.001, 0.08, 0.68),
        ]),
      }),
      Object.freeze({
        id: choreographyRuleId('build'),
        priority: 45,
        enabledParameter: cinema2Ref(CINEMA2_DEPTH_AUTO_PERFORMANCE_ID),
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 120 }),
        actions: Object.freeze([
          moduleContinuousAction('build-light', 'buildAmount'),
          effectContinuousAction('build-atmosphere', ATMOSPHERE_EFFECT_ID, 'density', 0.0015),
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
          effectEnvelopeAction('drop-bloom', BLOOM_EFFECT_ID, 'intensity', 0.08, 0.08, 1.4),
          effectEnvelopeAction('drop-haze', ATMOSPHERE_EFFECT_ID, 'density', 0.0035, 0.14, 2.8),
          effectEnvelopeAction('drop-contrast', FINISH_EFFECT_ID, 'contrast', 0.04, 0.06, 0.56),
        ]),
      }),
    ]),
  }),
  lighting: Object.freeze({
    lights: Object.freeze([
      Object.freeze({ id: AMBIENT_LIGHT_ID, type: 'ambient' as const, color: color(0.3, 0.32, 0.38), intensity: 0.025 }),
      Object.freeze({ id: HAZE_LIGHT_ID, type: 'point' as const, color: DEFAULT_LIGHT, intensity: 0.14, transform: Object.freeze({ position: vec3(0, 0, -30) }), config: Object.freeze({ range: 38 }) }),
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
        mix: 1, density: 0.004, beamIntensity: 0.065, mistAmount: 0, mistHeight: 0.5, mistFloor: -4.5, floorY: -4.5, floorReflection: 0,
        anisotropy: 0.4, occlusion: 0.82, ambientHaze: 0.004, noiseScale: 0.34, noiseStrength: 0.08, drift: 0.025, maxDistance: 60, reactivity: 0,
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
      parameters: Object.freeze({ mix: 1, threshold: 2.1, knee: 0.35, intensity: 0.28, spread: 0.28, levels: 4, clampMax: 12 }),
      parameterBindings: Object.freeze({ intensity: cinema2Ref(CINEMA2_DEPTH_BLOOM_ID) }),
    }),
    Object.freeze({
      id: FINISH_EFFECT_ID,
      typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 2,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, toneMap: 1, exposure: 0.92, contrast: 1.28, saturation: 0.78, vignette: 0.68, vignetteSoftness: 0.7, grain: 0.025, aberration: 0.012 }),
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
