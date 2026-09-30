import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleId,
  type Cinema2ChoreographyRuleManifest,
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
import {
  CINEMA2_CONDUIT_CHAMBER_ASSET_ID,
  CINEMA2_CONDUIT_TUBES_ASSET_ID,
  CINEMA2_CONDUIT_WORDMARK_ASSET_ID,
} from '../modules/three/Cinema2ThreeAssetManifest'
import { CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID } from '../modules/three/Cinema2ThreeEnvironmentRegistry'
import { CINEMA2_THREE_SEGMENT_PATTERNS, type Cinema2ThreeSegmentPattern } from '../modules/three/Cinema2ThreeSegmentLighting'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { cinema2CinematicMotion } from './Cinema2CameraMotionAuthoring'
import { cinema2LightRigHit, cinema2LightRigRamp } from './Cinema2LightRigAuthoring'

/**
 * CONDUIT: the owner's DVYDRM wordmark - pearl letters in a chrome ring with amber light hugging every edge - held in the middle of a
 * brushed-silver sci-fi chamber by four chrome tubes that carry energy from the side walls into the logo. The back wall is a circular portal of
 * rings, ribs and panels set with LED segments. Every segment in the tubes, the wall and the logo's rim is lit on its own by the three-scene
 * segment lighting (see Cinema2ThreeSegmentLighting), following the loaded track through Cinema 2.0's audio intelligence:
 *
 * - Energy Flow: on each beat a pulse runs through the tubes into the logo, the rim flares, and light ripples outward across the wall rings.
 * - Ring Chase: comets chase round the rings, neighbouring rings in opposite directions, faster in loud sections.
 * - Split: the left and right halves trade on the beat or bar; a drop lights both.
 * - Pulse: the whole wall breathes with the music; quiet or vocal passages drop to the tubes and logo; a drop lights everything.
 *
 * Auto Performance lets the music choose the pattern. A few amber lights near the tubes and the floor swell with the downbeat and a build so
 * the energy spills warm light onto the metal; the reflective floor, a light haze, bloom and a filmic finish complete the look.
 *
 * Assets (generated in house; docs/cinema2-conduit-plan.md): `cinema2-conduit-wordmark`, `cinema2-conduit-tubes`, `cinema2-conduit-chamber`,
 * all in one world frame (floor y = 0, wordmark centred on (0, 2.09, 0)).
 */
export const CINEMA2_CONDUIT_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.conduit')
export const CINEMA2_CONDUIT_MODULE_ID = cinema2StableId<Cinema2ModuleId>('conduit-scene')
export const CINEMA2_CONDUIT_CAMERA_ID = cinema2StableId<Cinema2CameraId>('conduit-camera')

export const CINEMA2_CONDUIT_AUTO_PERFORMANCE_ID = cinema2StableId<Cinema2ParameterId>('conduit-auto-performance')
export const CINEMA2_CONDUIT_MASTER_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('conduit-master-intensity')
export const CINEMA2_CONDUIT_BPM_SYNC_ID = cinema2StableId<Cinema2ParameterId>('conduit-bpm-sync')
export const CINEMA2_CONDUIT_CAMERA_MOVEMENT_ID = cinema2StableId<Cinema2ParameterId>('conduit-camera-movement')
export const CINEMA2_CONDUIT_PATTERN_ID = cinema2StableId<Cinema2ParameterId>('conduit-pattern')
export const CINEMA2_CONDUIT_FLICKER_ID = cinema2StableId<Cinema2ParameterId>('conduit-flicker')
export const CINEMA2_CONDUIT_ENERGY_COLOR_ID = cinema2StableId<Cinema2ParameterId>('conduit-energy-color')

const CHAMBER_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('conduit-chamber-node')
const TUBES_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('conduit-tubes-node')
const WORDMARK_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('conduit-wordmark-node')
const ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('conduit-root')
const LOGO_TARGET_ID = cinema2StableId<Cinema2SceneNodeId>('conduit-logo-target')
const WALL_TARGET_ID = cinema2StableId<Cinema2SceneNodeId>('conduit-wall-target')
const WORLD_LAYER_ID = cinema2StableId<Cinema2LayerId>('conduit-world-layer')

const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('conduit-ambient')
const KEY_LIGHT_ID = cinema2StableId<Cinema2LightId>('conduit-key')
const WALL_LIGHT_ID = cinema2StableId<Cinema2LightId>('conduit-wall-wash')
const SPILL_LEFT_ID = cinema2StableId<Cinema2LightId>('conduit-spill-left')
const SPILL_RIGHT_ID = cinema2StableId<Cinema2LightId>('conduit-spill-right')
const FLOOR_POOL_ID = cinema2StableId<Cinema2LightId>('conduit-floor-pool')
const ENERGY_GROUP_ID = cinema2StableId<Cinema2LightGroupId>('conduit-energy-lights')

const THREE_SCENE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('three-scene')
const FLOOR_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('reflective-floor')
const VOLUMETRIC_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('volumetric-atmosphere')
const BLOOM_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('bloom')
const FINISH_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('cinematic-finish')
const FLOOR_EFFECT_ID = cinema2StableId<Cinema2EffectId>('conduit-floor')
const VOLUMETRIC_EFFECT_ID = cinema2StableId<Cinema2EffectId>('conduit-haze')
const BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('conduit-bloom')
const FINISH_EFFECT_ID = cinema2StableId<Cinema2EffectId>('conduit-finish')

const vec3 = (x: number, y: number, z: number): Cinema2Vector3 => Object.freeze([x, y, z])
const color = (r: number, g: number, b: number, a = 1): Cinema2Color => Object.freeze([r, g, b, a])

export const CINEMA2_CONDUIT_DEFAULT_ENERGY_COLOR = color(1, 0.46, 0.1)
const BACKGROUND = color(0.02, 0.02, 0.022)
/** Chamber floor height (the assets' world frame). */
const FLOOR_Y = 0
const SEGMENT_STRENGTH = 3.6
const ENERGY_LIGHT_REST = 0.35

const PATTERN_LABELS: Readonly<Record<Cinema2ThreeSegmentPattern, string>> = Object.freeze({
  energyFlow: 'Energy Flow',
  ringChase: 'Ring Chase',
  split: 'Split',
  pulse: 'Pulse',
})

const baseParameter = {
  section: 'Design',
  exposure: 'primary' as const,
  modulatable: false,
  choreographable: false,
  automatable: false,
  persistence: 'preset' as const,
  reset: 'authored-default' as const,
}

const PARAMETERS = Object.freeze([
  CINEMA2_QUALITY_MODE_PARAMETER,
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_CONDUIT_AUTO_PERFORMANCE_ID,
    label: 'Auto Performance',
    description: 'Lets the music choose the lighting pattern: Pulse on a drop and in quiet or vocal passages, Energy Flow through a build, and otherwise a rotation of Ring Chase, Split and Energy Flow every four bars. Choosing a Pattern turns it off.',
    type: 'boolean' as const,
    defaultValue: true,
    designParentGroup: 'master-controls' as const,
    order: 1,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_CONDUIT_MASTER_INTENSITY_ID,
    label: 'Master Intensity',
    description: 'How hard the whole show reacts to the music: the LED segments in the tubes, the wall and the logo rim, and the warm light they spill onto the metal. At 0 everything holds a soft steady glow; at 1 it reacts fully.',
    type: 'float' as const,
    defaultValue: 0.85,
    min: 0,
    max: 1,
    step: 0.01,
    designParentGroup: 'master-controls' as const,
    order: 2,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_CONDUIT_BPM_SYNC_ID,
    label: 'BPM Sync',
    description: 'On: the lighting patterns and the camera\'s sway lock to the track\'s beat grid. Off: they run at a steady 120 BPM.',
    type: 'boolean' as const,
    defaultValue: true,
    designParentGroup: 'master-controls' as const,
    order: 3,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_CONDUIT_CAMERA_MOVEMENT_ID,
    label: 'Camera Movement',
    description: 'How much the camera zooms and sways with the music: a slow drift, a side-to-side weave over two bars, a lens breath every bar and a small zoom punch on every kick. At 0 the camera holds still.',
    type: 'float' as const,
    defaultValue: 0.5,
    min: 0,
    max: 1,
    step: 0.01,
    designParentGroup: 'master-controls' as const,
    order: 4,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_CONDUIT_PATTERN_ID,
    label: 'Pattern',
    description: 'How the LED segments light up with the music. Energy Flow: a pulse runs through the tubes into the logo, then ripples out across the wall. Ring Chase: lights chase round the rings. Split: the left and right halves trade. Pulse: everything breathes with the beat; quiet passages leave just the tubes and logo. Choosing a Pattern turns Auto Performance off.',
    type: 'enum' as const,
    defaultValue: 'energyFlow',
    options: Object.freeze(CINEMA2_THREE_SEGMENT_PATTERNS.map(value => Object.freeze({ value, label: PATTERN_LABELS[value] }))),
    metadata: Object.freeze({ userEditSetParameters: Object.freeze({ [CINEMA2_CONDUIT_AUTO_PERFORMANCE_ID]: false }) }),
    designParentGroup: 'design' as const,
    group: 'Lighting',
    order: 1,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_CONDUIT_FLICKER_ID,
    label: 'Flicker',
    description: 'How often the LED segments in the tubes and the back wall cut out and stutter, each on its own. At 0 they stay steady.',
    type: 'float' as const,
    defaultValue: 0.15,
    min: 0,
    max: 1,
    step: 0.01,
    designParentGroup: 'effects' as const,
    group: 'LEDs',
    order: 1,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_CONDUIT_ENERGY_COLOR_ID,
    label: 'Energy Color',
    description: 'The color of the energy in the tubes, the logo rim and the wall segments, and of the warm light it spills onto the metal.',
    type: 'color' as const,
    defaultValue: CINEMA2_CONDUIT_DEFAULT_ENERGY_COLOR,
    designParentGroup: 'palette' as const,
    group: 'Energy',
    order: 1,
  }),
])

// ── Choreography: the warm spill lights follow the energy ─────────────────────────────────────────────────────────────────────────
const master = cinema2Ref(CINEMA2_CONDUIT_MASTER_INTENSITY_ID)
const ruleId = (value: string) => cinema2StableId<Cinema2ChoreographyRuleId>(value)
const actionId = (value: string) => cinema2StableId<Cinema2ChoreographyActionId>(value)

const choreographyRules: readonly Cinema2ChoreographyRuleManifest[] = Object.freeze([
  // A warm swell on every downbeat, a lift through a build, and a bright two-beat hit on a drop.
  ...cinema2LightRigHit({ id: 'conduit-energy', group: ENERGY_GROUP_ID, signal: 'downbeat', peak: 1.1, attack: 0, hold: 0.05, release: 0.9, priority: 40, strengthParameter: master }),
  ...cinema2LightRigRamp({ id: 'conduit-energy', groups: [ENERGY_GROUP_ID], source: 'director.build', lift: 1.2, priority: 30, strengthParameter: master }),
  ...cinema2LightRigHit({ id: 'conduit-energy-drop', group: ENERGY_GROUP_ID, signal: 'drop', peak: 2.6, attack: 0, hold: 1, release: 1.5, priority: 60, strengthParameter: master }),
  // The haze glows a little brighter on the downbeat with the lights.
  Object.freeze({
    id: ruleId('conduit-downbeat-beam'),
    priority: 30,
    strengthParameter: master,
    source: Object.freeze({ signal: 'downbeat' as const, capability: 'music.downbeat' as const }),
    actions: Object.freeze([Object.freeze({
      id: actionId('conduit-downbeat-beam-swell'),
      target: Object.freeze({ kind: 'effect' as const, ref: cinema2Ref(VOLUMETRIC_EFFECT_ID), property: 'beamIntensity' }),
      operation: 'envelope' as const,
      composition: 'add' as const,
      value: 0.4,
      envelope: Object.freeze({ attack: 0, hold: 0.05, release: 0.9, unit: 'beats' as const }),
      retrigger: 'restart' as const,
    })]),
  }),
])

function spot(id: Cinema2LightId, position: Cinema2Vector3, target: Cinema2SceneNodeId, cone: number, intensity: number, lightColor: Cinema2Color, penumbra = 0.6) {
  return Object.freeze({
    id,
    type: 'spot' as const,
    color: lightColor,
    intensity,
    transform: Object.freeze({ position }),
    node: cinema2Ref(ROOT_NODE_ID),
    targetNode: cinema2Ref(target),
    config: Object.freeze({ coneAngleDegrees: cone, penumbra, range: 30 }),
  })
}

/** A warm point light carrying the energy color. */
function energyPoint(id: Cinema2LightId, position: Cinema2Vector3, range: number) {
  return Object.freeze({
    id,
    type: 'point' as const,
    color: CINEMA2_CONDUIT_DEFAULT_ENERGY_COLOR,
    intensity: ENERGY_LIGHT_REST,
    transform: Object.freeze({ position }),
    node: cinema2Ref(ROOT_NODE_ID),
    controls: Object.freeze({ color: cinema2Ref(CINEMA2_CONDUIT_ENERGY_COLOR_ID) }),
    config: Object.freeze({ range }),
  })
}

// ── Render graph: scene -> floor -> haze -> bloom -> finish ───────────────────────────────────────────────────────────────────────
const targetId = (name: string) => cinema2StableId<Cinema2RenderTargetId>(`conduit-${name}-target`)
const passId = (name: string) => cinema2StableId<Cinema2RenderPassId>(`conduit-${name}-pass`)
const slotId = (name: string) => cinema2StableId<Cinema2RenderSlotId>(`conduit-${name}`)
const SCENE_TARGET_ID = targetId('scene')
const FLOOR_TARGET_ID = targetId('floor')
const ATMOSPHERE_TARGET_ID = targetId('haze')
const BLOOM_TARGET_ID = targetId('bloom')
const SCENE_PASS_ID = passId('scene')
const FLOOR_PASS_ID = passId('floor')
const ATMOSPHERE_PASS_ID = passId('haze')
const BLOOM_PASS_ID = passId('bloom')
const FINISH_PASS_ID = passId('finish')
const SCENE_COLOR_ID = slotId('scene-color')
const SCENE_DEPTH_ID = slotId('scene-depth')

const viewportTarget = (id: Cinema2RenderTargetId, depth = false) => Object.freeze({
  id,
  descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba8' as const, ...(depth ? { depthFormat: 'depth24' as const } : {}) }),
  ownership: 'transient' as const,
})

function effectPass(id: Cinema2RenderPassId, after: Cinema2RenderPassId, afterOutput: Cinema2RenderSlotId, effect: Cinema2EffectId, name: string, output: Cinema2RenderTargetId | null, withDepth: boolean) {
  const inputs = [
    Object.freeze({ id: slotId(`${name}-color-input`), source: Object.freeze({ pass: cinema2Ref(after), output: afterOutput }), attachment: 'color' as const }),
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

/**
 * The LED diffusers, when a segment is dark: a dim smoked grey. Lighter diffusers catch so much of the room's light that the pattern only tints
 * them pastel; this keeps an unlit strip reading as an off LED while a lit one glows in the full energy color.
 */
const LED_OFF = color(0.16, 0.16, 0.17)
/** Brushed silver, a little darker than the asset's bake so the chamber reads mid-grey like the owner's mockups rather than white. */
const SHELL = color(0.62, 0.62, 0.64)

export const CINEMA2_CONDUIT_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_CONDUIT_PRESET_ID,
  revision: 1,
  metadata: Object.freeze({
    name: 'CONDUIT',
    description: 'The DVYDRM wordmark held in a silver sci-fi chamber by four chrome tubes that carry energy into it. LED segments in the tubes, the back wall and the logo rim flow, chase, split and pulse with the music.',
    tags: Object.freeze(['conduit', 'logo', 'wordmark', 'native', '3d', 'sci-fi', 'led', 'three', 'keeper']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native Cinema 2.0 Stage rendering and the 3D scene.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Depth-tested models, the reflective floor and depth-aware haze.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'The wordmark, the tubes and the chamber are real 3D models placed in the Scene Graph.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Shared world camera framing the wordmark in the chamber.' }),
    Object.freeze({ id: 'lighting' as const, requirement: 'required' as const, purpose: 'Key light on the wordmark, a wash on the back wall, and warm energy lights near the tubes and the floor.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Downbeat swell of the energy lights and the haze.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'A bright hit of the energy lights on a drop.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'The energy lights lift through a build.' }),
  ]),
  parameters: PARAMETERS,
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_CONDUIT_MODULE_ID,
    typeId: THREE_SCENE_TYPE_ID,
    version: 1,
    enabled: true,
    parameters: Object.freeze({
      // Wordmark: glossy pearl letters, polished chrome ring, dark silver back plate.
      'letters.color': color(0.86, 0.85, 0.83),
      'letters.roughness': 0.22,
      'letters.metalness': 0.15,
      'letters.clearcoat': 0.8,
      'letters.clearcoatRoughness': 0.08,
      'outline.roughness': 0.1,
      'outline.metalness': 1,
      'plate.roughness': 0.3,
      // Tubes: chrome pipes, darker steel couplers, a near-black channel under the windows.
      'pipe.roughness': 0.12,
      'coupler.roughness': 0.25,
      // Chamber: brushed silver, dark recessed tracks.
      // Brushed, not mirror: a mirror-smooth wall facing the camera reflects the studio's front light as a white hot spot.
      'shell.color': SHELL,
      'shell.roughness': 0.46,
      'shell.metalness': 0.8,
      'shell.environmentIntensity': 0.6,
      'trim.roughness': 0.4,
      // LED diffusers, as seen when a segment is dark.
      'segments.color': LED_OFF,
      'segments.metalness': 0,
      'energy.color': LED_OFF,
      'energy.metalness': 0,
      environmentIntensity: 0.35,
      segmentPattern: 'energyFlow',
      segmentAuto: true,
      segmentSync: true,
      segmentFlicker: 0.15,
      segmentReactivity: 0.85,
      segmentStrength: SEGMENT_STRENGTH,
      segmentColor: CINEMA2_CONDUIT_DEFAULT_ENERGY_COLOR,
    }),
    parameterBindings: Object.freeze({
      segmentPattern: cinema2Ref(CINEMA2_CONDUIT_PATTERN_ID),
      segmentAuto: cinema2Ref(CINEMA2_CONDUIT_AUTO_PERFORMANCE_ID),
      segmentSync: cinema2Ref(CINEMA2_CONDUIT_BPM_SYNC_ID),
      segmentFlicker: cinema2Ref(CINEMA2_CONDUIT_FLICKER_ID),
      segmentReactivity: master,
      segmentColor: cinema2Ref(CINEMA2_CONDUIT_ENERGY_COLOR_ID),
    }),
    config: Object.freeze({
      instances: Object.freeze([
        Object.freeze({ asset: CINEMA2_CONDUIT_CHAMBER_ASSET_ID, node: CHAMBER_NODE_ID }),
        Object.freeze({ asset: CINEMA2_CONDUIT_TUBES_ASSET_ID, node: TUBES_NODE_ID }),
        Object.freeze({ asset: CINEMA2_CONDUIT_WORDMARK_ASSET_ID, node: WORDMARK_NODE_ID }),
      ]),
      parts: Object.freeze(['letters', 'outline', 'plate', 'pipe', 'coupler', 'shell', 'trim', 'segments', 'energy']),
      // Every LED segment is lit by the pattern: the tubes feed the logo, the rim is the core, the wall is the field.
      segments: Object.freeze({ energy: 'feed', rim: 'core', segments: 'field' }),
      environment: CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID,
      // Two soft panels front-left and front-right give the chrome and the pearl letters a clean highlight band.
      panels: Object.freeze([
        Object.freeze({ position: vec3(-4, 5, 6), target: vec3(0, 2, 0), size: Object.freeze([3, 1.6]), color: Object.freeze([0.95, 0.96, 1]), intensity: 0.5 }),
        Object.freeze({ position: vec3(4, 5, 6), target: vec3(0, 2, 0), size: Object.freeze([3, 1.6]), color: Object.freeze([0.95, 0.96, 1]), intensity: 0.5 }),
      ]),
    }),
  })]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
      // All three assets share one world frame, so their nodes sit at the origin.
      Object.freeze({ id: CHAMBER_NODE_ID, kind: 'module' as const, parent: cinema2Ref(ROOT_NODE_ID), module: cinema2Ref(CINEMA2_CONDUIT_MODULE_ID) }),
      Object.freeze({ id: TUBES_NODE_ID, kind: 'module' as const, parent: cinema2Ref(ROOT_NODE_ID), module: cinema2Ref(CINEMA2_CONDUIT_MODULE_ID) }),
      Object.freeze({ id: WORDMARK_NODE_ID, kind: 'module' as const, parent: cinema2Ref(ROOT_NODE_ID), module: cinema2Ref(CINEMA2_CONDUIT_MODULE_ID) }),
      Object.freeze({ id: LOGO_TARGET_ID, kind: 'group' as const, parent: cinema2Ref(ROOT_NODE_ID), transform: Object.freeze({ position: vec3(0, 2.09, 0) }) }),
      Object.freeze({ id: WALL_TARGET_ID, kind: 'group' as const, parent: cinema2Ref(ROOT_NODE_ID), transform: Object.freeze({ position: vec3(0, 3, -3.5) }) }),
    ]),
    roots: Object.freeze([cinema2Ref(ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([Object.freeze({
    id: WORLD_LAYER_ID,
    label: 'CONDUIT World',
    source: cinema2Ref(ROOT_NODE_ID),
    role: 'world' as const,
    depthPolicy: 'read-write' as const,
    order: 0,
  })]),
  cameras: Object.freeze([Object.freeze({
    id: CINEMA2_CONDUIT_CAMERA_ID,
    label: 'CONDUIT Front',
    projection: 'perspective' as const,
    fovDegrees: 42,
    near: 0.1,
    far: 60,
    // The frame the assets were built for (docs/cinema2-conduit-plan.md): level with the chamber, the wordmark in the middle spanning about
    // half the width, the tube flanges at the corners, the floor in the lower quarter.
    transform: Object.freeze({ position: vec3(0, 1.92, 7) }),
    target: vec3(0, 1.92, 0),
    rig: Object.freeze({ kind: 'static' as const }),
    // Camera Movement scales all of this (0 = locked off): a slow drift, a weave over two bars, a small bob, a lens breath every bar and a zoom
    // punch on every kick. BPM Sync locks it to the track's beats; off, it free-runs at 120 BPM.
    motion: cinema2CinematicMotion('gentle', {
      overrides: Object.freeze({
        drift: Object.freeze({ position: 0.14, target: 0.05, rollDegrees: 0.3, fovDegrees: 0.6, speed: 0.07 }),
        tempo: Object.freeze({ referenceBpm: 120, flightSpeed: false, weave: 0.3, bob: 0.03, roll: 0.6, fov: 1.6, punch: 2.2 }),
      }),
    }),
    controls: Object.freeze({ motionAmount: cinema2Ref(CINEMA2_CONDUIT_CAMERA_MOVEMENT_ID), tempoSync: cinema2Ref(CINEMA2_CONDUIT_BPM_SYNC_ID) }),
  })]),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_CONDUIT_CAMERA_ID) }),
  lighting: Object.freeze({
    groups: Object.freeze([
      Object.freeze({ id: ENERGY_GROUP_ID, label: 'Energy Lights', lights: Object.freeze([cinema2Ref(SPILL_LEFT_ID), cinema2Ref(SPILL_RIGHT_ID), cinema2Ref(FLOOR_POOL_ID)]) }),
    ]),
    // Most important first: low quality keeps the key and the wall wash; medium adds the two warm spill lights and the floor pool.
    lights: Object.freeze([
      spot(KEY_LIGHT_ID, vec3(0, 5.5, 7), LOGO_TARGET_ID, 30, 0.32, color(1, 0.98, 0.96)),
      spot(WALL_LIGHT_ID, vec3(0, 7.5, 5), WALL_TARGET_ID, 70, 0.22, color(0.96, 0.97, 1), 0.9),
      energyPoint(SPILL_LEFT_ID, vec3(-3.3, 3.2, -1.4), 9),
      energyPoint(SPILL_RIGHT_ID, vec3(3.3, 3.2, -1.4), 9),
      energyPoint(FLOOR_POOL_ID, vec3(0, 0.5, 1.2), 7),
      Object.freeze({ id: AMBIENT_LIGHT_ID, type: 'ambient' as const, color: color(0.9, 0.9, 0.92), intensity: 0.06 }),
    ]),
  }),
  environment: Object.freeze({
    backgroundColor: BACKGROUND,
    exposure: 1,
  }),
  effects: Object.freeze([
    Object.freeze({
      id: FLOOR_EFFECT_ID,
      typeId: FLOOR_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 0,
      scope: 'output' as const,
      // Polished metal: a glossy mirror of the wall, the tubes and the glowing segments. Where screen-space reflection finds nothing to reflect it
      // shows a dim silver (`skyColor`) instead of black, and a thicker hit test catches the thin wall details.
      parameters: Object.freeze({ mix: 1, floorY: FLOOR_Y, reflectivity: 0.55, roughness: 0.22, fresnel: 2.4, albedo: 0.32, poolIntensity: 0.5, specular: 1.1, fadeDistance: 30, maxReflection: 24, thickness: 0.8, skyColor: color(0.3, 0.3, 0.31), grit: 0.05, gritScale: 6 }),
    }),
    Object.freeze({
      id: VOLUMETRIC_EFFECT_ID,
      typeId: VOLUMETRIC_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 1,
      scope: 'output' as const,
      // A light haze only: enough to soften the depth and catch the warm light, never enough to wash out the wall.
      parameters: Object.freeze({
        mix: 1, density: 0.005, beamIntensity: 0.5, mistAmount: 0.2, mistHeight: 0.3, mistFloor: FLOOR_Y, floorY: FLOOR_Y, floorReflection: 0.3, anisotropy: 0.5,
        occlusion: 0.5, ambientHaze: 0.01, noiseScale: 0.3, noiseStrength: 0.4, drift: 0.08, maxDistance: 30, reactivity: 0.5,
      }),
    }),
    Object.freeze({
      id: BLOOM_EFFECT_ID,
      typeId: BLOOM_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 2,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 0.6, threshold: 0.78, radius: 2.4, intensity: 0.9 }),
    }),
    Object.freeze({
      id: FINISH_EFFECT_ID,
      typeId: FINISH_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 3,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, exposure: 0.92, vignette: 0.4, grain: 0.06, aberration: 0.08, contrast: 1.08, saturation: 1.05 }),
    }),
  ]),
  choreography: Object.freeze({ rules: choreographyRules }),
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
      effectPass(FLOOR_PASS_ID, SCENE_PASS_ID, SCENE_COLOR_ID, FLOOR_EFFECT_ID, 'floor', FLOOR_TARGET_ID, true),
      effectPass(ATMOSPHERE_PASS_ID, FLOOR_PASS_ID, slotId('floor-output'), VOLUMETRIC_EFFECT_ID, 'haze', ATMOSPHERE_TARGET_ID, true),
      effectPass(BLOOM_PASS_ID, ATMOSPHERE_PASS_ID, slotId('haze-output'), BLOOM_EFFECT_ID, 'bloom', BLOOM_TARGET_ID, false),
      effectPass(FINISH_PASS_ID, BLOOM_PASS_ID, slotId('bloom-output'), FINISH_EFFECT_ID, 'finish', null, false),
    ]),
    outputPass: cinema2Ref(FINISH_PASS_ID),
  }),
  output: Object.freeze({ renderPass: cinema2Ref(FINISH_PASS_ID), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
}) as Readonly<Cinema2NativePresetManifest>
