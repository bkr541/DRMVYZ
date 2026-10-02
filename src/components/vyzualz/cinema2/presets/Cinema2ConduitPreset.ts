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
export const CINEMA2_CONDUIT_ZOOM_ON_KICK_ID = cinema2StableId<Cinema2ParameterId>('conduit-zoom-on-kick')
export const CINEMA2_CONDUIT_PATTERN_ID = cinema2StableId<Cinema2ParameterId>('conduit-pattern')
export const CINEMA2_CONDUIT_FLICKER_ID = cinema2StableId<Cinema2ParameterId>('conduit-flicker')
export const CINEMA2_CONDUIT_ENERGY_COLOR_ID = cinema2StableId<Cinema2ParameterId>('conduit-energy-color')

const CHAMBER_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('conduit-chamber-node')
const TUBES_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('conduit-tubes-node')
const WORDMARK_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('conduit-wordmark-node')
const ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('conduit-root')
const LOGO_TARGET_ID = cinema2StableId<Cinema2SceneNodeId>('conduit-logo-target')
const WALL_CENTRE_TARGET_ID = cinema2StableId<Cinema2SceneNodeId>('conduit-wall-centre-target')
const WALL_LEFT_TARGET_ID = cinema2StableId<Cinema2SceneNodeId>('conduit-wall-left-target')
const WALL_RIGHT_TARGET_ID = cinema2StableId<Cinema2SceneNodeId>('conduit-wall-right-target')
const WORLD_LAYER_ID = cinema2StableId<Cinema2LayerId>('conduit-world-layer')

const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('conduit-ambient')
const KEY_LIGHT_ID = cinema2StableId<Cinema2LightId>('conduit-key')
const WALL_LOW_LIGHT_ID = cinema2StableId<Cinema2LightId>('conduit-wall-low-fill')
const WALL_LEFT_LIGHT_ID = cinema2StableId<Cinema2LightId>('conduit-wall-wash-left')
const WALL_RIGHT_LIGHT_ID = cinema2StableId<Cinema2LightId>('conduit-wall-wash-right')
const SPILL_LEFT_ID = cinema2StableId<Cinema2LightId>('conduit-spill-left')
const SPILL_RIGHT_ID = cinema2StableId<Cinema2LightId>('conduit-spill-right')
const FLOOR_POOL_ID = cinema2StableId<Cinema2LightId>('conduit-floor-pool')
const ENERGY_GROUP_ID = cinema2StableId<Cinema2LightGroupId>('conduit-energy-lights')
const WALL_GROUP_ID = cinema2StableId<Cinema2LightGroupId>('conduit-wall-lights')

const THREE_SCENE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('three-scene')
const FLOOR_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('reflective-floor')
const VOLUMETRIC_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('volumetric-atmosphere')
const BLOOM_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('hdr-bloom')
const FINISH_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('cinematic-finish')
const FLOOR_EFFECT_ID = cinema2StableId<Cinema2EffectId>('conduit-floor')
const VOLUMETRIC_EFFECT_ID = cinema2StableId<Cinema2EffectId>('conduit-haze')
const BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('conduit-bloom')
const FINISH_EFFECT_ID = cinema2StableId<Cinema2EffectId>('conduit-finish')

const vec3 = (x: number, y: number, z: number): Cinema2Vector3 => Object.freeze([x, y, z])
const color = (r: number, g: number, b: number, a = 1): Cinema2Color => Object.freeze([r, g, b, a])

/**
 * One warm orange for the tube windows, the complete wordmark perimeter and the chamber LEDs. Their individual intensities differ, but the
 * shared Energy Color keeps the illuminated structure visually connected.
 */
export const CINEMA2_CONDUIT_DEFAULT_ENERGY_COLOR = color(1, 0.38, 0.08)
const BACKGROUND = color(0.02, 0.02, 0.022)
/** Chamber floor height (the assets' world frame). */
const FLOOR_Y = 0
/**
 * Segment brightness. The scene renders HDR, so a lit LED is many times brighter than the white letters: the finish's filmic curve turns its
 * core warm white, the HDR bloom wraps it in an orange halo, and the floor reflects it as light.
 */
const SEGMENT_STRENGTH = 10
/** How much each LED's light gathers into a hot centre line where its rounded diffuser faces the camera. */
const SEGMENT_CORE = 0.7
const ENERGY_LIGHT_REST = 0.22

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
    // Full reaction by default: anything less blends in some of the steady glow, and dark segments (a breakdown, the unlit half of a Split)
    // then read as dimly lit rather than off.
    defaultValue: 1,
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
    description: 'How much the camera sways with the music: a slow drift, a side-to-side weave over two bars and a lens breath every bar. At 0 the camera holds still (Zoom on Kick works on its own).',
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
    id: CINEMA2_CONDUIT_ZOOM_ON_KICK_ID,
    label: 'Zoom on Kick',
    description: 'On: the camera punches in on every kick drum hit in the loaded track, then eases back out (on the beat when no kicks are detected). Works whatever Camera Movement is set to.',
    type: 'boolean' as const,
    defaultValue: true,
    designParentGroup: 'master-controls' as const,
    order: 5,
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
  ...cinema2LightRigHit({ id: 'conduit-energy', group: ENERGY_GROUP_ID, signal: 'downbeat', peak: 0.3, attack: 0, hold: 0.05, release: 0.9, priority: 40, strengthParameter: master }),
  ...cinema2LightRigRamp({ id: 'conduit-energy', groups: [ENERGY_GROUP_ID], source: 'director.build', lift: 0.35, priority: 30, strengthParameter: master }),
  ...cinema2LightRigHit({ id: 'conduit-energy-drop', group: ENERGY_GROUP_ID, signal: 'drop', peak: 0.7, attack: 0, hold: 1, release: 1.5, priority: 60, strengthParameter: master }),
  // The room itself follows the music: the wall washes rest dimmer and rise with the song's intensity, so a breakdown sits darker than a drop.
  ...cinema2LightRigRamp({ id: 'conduit-wall', groups: [WALL_GROUP_ID], source: 'director.intensity', lift: 0.16, priority: 20, strengthParameter: master }),
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
function energyPoint(id: Cinema2LightId, position: Cinema2Vector3, range: number, intensity = ENERGY_LIGHT_REST) {
  return Object.freeze({
    id,
    type: 'point' as const,
    color: CINEMA2_CONDUIT_DEFAULT_ENERGY_COLOR,
    intensity,
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

// Float targets carry the LEDs' light above white through the floor, haze and bloom to the finish's tone curve. A GPU that cannot render to
// float textures gets 8-bit targets (the segment light then rolls off toward white in the shader instead).
const viewportTarget = (id: Cinema2RenderTargetId, depth = false) => Object.freeze({
  id,
  descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba16f' as const, fallbackColorFormat: 'rgba8' as const, ...(depth ? { depthFormat: 'depth24' as const } : {}) }),
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
 * The LED diffusers, when a segment is dark: near-black smoked glass, like the owner's mockups. Lighter diffusers catch the room's (and the warm
 * energy lights') light, so an off segment looked dimly lit and the pattern only tinted them.
 */
const LED_OFF = color(0.05, 0.05, 0.055)
/** Midtone brushed silver: brighter than the recessed tracks, but below the pearl letters and emissive LEDs. */
const SHELL = color(0.47, 0.46, 0.45)

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
      // Wordmark: bright white glossy letter faces on polished bronze-chrome walls, a chrome frame on a darker stepped lip, near-black gaps.
      // A soft white, not paper white: with the glossy coat the highlights stand out against it (at 0.92 every face sat in one band of near-white).
      'letters.color': color(0.74, 0.74, 0.74),
      'letters.roughness': 0.2,
      'letters.metalness': 0.05,
      'letters.clearcoat': 1,
      'letters.clearcoatRoughness': 0.06,
      // Less of the even studio room on the letters, so the key light shapes them.
      'letters.environmentIntensity': 0.6,
      // Darker bronze-grey side walls and a darker chrome frame, so the white letter faces stand out against them, as in the mockup.
      'walls.color': color(0.3, 0.27, 0.25),
      'walls.roughness': 0.22,
      'walls.metalness': 1,
      'outline.color': color(0.28, 0.26, 0.23),
      'outline.roughness': 0.22,
      'outline.metalness': 1,
      'base.color': color(0.23, 0.21, 0.19),
      'base.roughness': 0.24,
      'plate.roughness': 0.35,
      // Tubes remain reflective, but the housing must not be a continuous pale stripe brighter than its LED windows.
      'pipe.color': color(0.6, 0.58, 0.56),
      'pipe.roughness': 0.18,
      'pipe.environmentIntensity': 1.05,
      'coupler.color': color(0.48, 0.46, 0.44),
      'coupler.roughness': 0.22,
      'coupler.environmentIntensity': 0.9,
      'flange.color': color(0.45, 0.43, 0.41),
      'flange.roughness': 0.24,
      'flange.environmentIntensity': 0.85,
      // Raised chamber metal is midtone silver; recessed panel floors and the iris step down progressively.
      'shell.color': SHELL,
      'shell.roughness': 0.36,
      'shell.metalness': 0.9,
      'shell.environmentIntensity': 0.48,
      'hull.color': color(0.5, 0.49, 0.47),
      'hull.roughness': 0.42,
      'hull.metalness': 0.85,
      'hull.environmentIntensity': 0.75,
      'steel.color': color(0.36, 0.35, 0.34),
      'steel.roughness': 0.46,
      'steel.environmentIntensity': 0.65,
      'iris.color': color(0.27, 0.26, 0.25),
      'iris.roughness': 0.38,
      'iris.metalness': 0.85,
      'iris.environmentIntensity': 0.55,
      'trim.color': color(0.035, 0.035, 0.038),
      'trim.roughness': 0.4,
      // LED diffusers, as seen when a segment is dark.
      'segments.color': LED_OFF,
      'segments.metalness': 0,
      'energy.color': LED_OFF,
      'energy.metalness': 0,
      environmentIntensity: 0.38,
      segmentPattern: 'energyFlow',
      segmentAuto: true,
      segmentSync: true,
      segmentFlicker: 0.15,
      segmentReactivity: 1,
      segmentStrength: SEGMENT_STRENGTH,
      segmentCore: SEGMENT_CORE,
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
      // Rendered into float targets and tone-mapped by the finish, so the LEDs emit their full light.
      hdr: true,
      parts: Object.freeze(['letters', 'walls', 'outline', 'base', 'plate', 'pipe', 'channel', 'flange', 'coupler', 'shell', 'hull', 'steel', 'iris', 'trim', 'bolts', 'segments', 'energy']),
      // Every LED segment is lit by the pattern: the tubes feed the logo, the logo's glow (the rim in the gaps and the walls it climbs) is the
      // core, the wall is the field.
      // The letters' side walls do not glow (glowing, they washed the letters' edges cream); only the thin seams in the gaps do.
      segments: Object.freeze({ energy: 'feed', rim: 'core', segments: 'field' }),
      // The letters cast shadows onto the lower layer of the mark (its swashes and sweeps are part of 'letters'), the frame, its lip and the
      // dark gaps behind them; nothing else is in the key light's narrow cone.
      shadows: Object.freeze({ cast: Object.freeze(['letters', 'walls']), receive: Object.freeze(['letters', 'outline', 'base', 'plate', 'rim', 'walls']) }),
      environment: CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID,
      // Restrained front-side panels leave a narrow chrome highlight without flattening broad metal surfaces.
      panels: Object.freeze([
        Object.freeze({ position: vec3(-4, 5, 6), target: vec3(0, 2, 0), size: Object.freeze([2.4, 1.3]), color: Object.freeze([0.95, 0.96, 1]), intensity: 0.18 }),
        Object.freeze({ position: vec3(4, 5, 6), target: vec3(0, 2, 0), size: Object.freeze([2.4, 1.3]), color: Object.freeze([0.95, 0.96, 1]), intensity: 0.18 }),
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
      Object.freeze({ id: WALL_CENTRE_TARGET_ID, kind: 'group' as const, parent: cinema2Ref(ROOT_NODE_ID), transform: Object.freeze({ position: vec3(0, 3, -3.5) }) }),
      Object.freeze({ id: WALL_LEFT_TARGET_ID, kind: 'group' as const, parent: cinema2Ref(ROOT_NODE_ID), transform: Object.freeze({ position: vec3(-3.6, 3, -3.5) }) }),
      Object.freeze({ id: WALL_RIGHT_TARGET_ID, kind: 'group' as const, parent: cinema2Ref(ROOT_NODE_ID), transform: Object.freeze({ position: vec3(3.6, 3, -3.5) }) }),
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
    // Composed at 16:9; on a narrower Stage (the app's is nearly square) the view widens vertically instead of cropping the tube flanges.
    minAspect: 16 / 9,
    near: 0.1,
    far: 60,
    // The frame the assets were built for (docs/cinema2-conduit-plan.md): level with the chamber, the wordmark in the middle spanning about
    // half the width, the tube flanges at the corners, the floor in the lower quarter.
    transform: Object.freeze({ position: vec3(0, 1.92, 7) }),
    target: vec3(0, 1.92, 0),
    rig: Object.freeze({ kind: 'static' as const }),
    // Camera Movement scales the sway (0 = locked off): a slow drift, a weave over two bars, a small bob and a lens breath every bar. Zoom on
    // Kick owns the zoom punch on every kick (4 degrees of FOV, about 10% closer; on the beat when the track gives no kick events), at full
    // strength whatever Camera Movement is set to. BPM
    // Sync locks the sway to the track's beats; off, it free-runs at 120 BPM.
    motion: cinema2CinematicMotion('gentle', {
      overrides: Object.freeze({
        drift: Object.freeze({ position: 0.14, target: 0.05, rollDegrees: 0.3, fovDegrees: 0.6, speed: 0.07 }),
        tempo: Object.freeze({ referenceBpm: 120, flightSpeed: false, weave: 0.3, bob: 0.03, roll: 0.6, fov: 1.6, punch: 4 }),
      }),
    }),
    controls: Object.freeze({ motionAmount: cinema2Ref(CINEMA2_CONDUIT_CAMERA_MOVEMENT_ID), tempoSync: cinema2Ref(CINEMA2_CONDUIT_BPM_SYNC_ID), kickZoom: cinema2Ref(CINEMA2_CONDUIT_ZOOM_ON_KICK_ID) }),
  })]),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_CONDUIT_CAMERA_ID) }),
  lighting: Object.freeze({
    groups: Object.freeze([
      Object.freeze({ id: WALL_GROUP_ID, label: 'Wall Washes', lights: Object.freeze([cinema2Ref(WALL_LEFT_LIGHT_ID), cinema2Ref(WALL_RIGHT_LIGHT_ID)]) }),
      Object.freeze({ id: ENERGY_GROUP_ID, label: 'Energy Lights', lights: Object.freeze([cinema2Ref(SPILL_LEFT_ID), cinema2Ref(SPILL_RIGHT_ID), cinema2Ref(FLOOR_POOL_ID)]) }),
    ]),
    // Low quality keeps only the first two non-ambient lights: retain the logo key, then a soft centred wall fill for symmetry. Medium/high
    // add the two half-wall washes and energy spill. The centre fill is deliberately weaker/broader than the old wall washes: it must not make
    // a hot spot behind the logo or erase the raised/recessed metal contrast.
    lights: Object.freeze([
      // A real key from high in front: the letters' tops and bevels catch it and their undersides fall off to grey, as in the mockup (at 0.08 the
      // wordmark was lit only by the even studio reflections and read flat).
      // It also casts the letters' shadows onto the frame and its lip behind them (medium and high quality), the depth of the mockup's wordmark.
      Object.freeze({
        ...spot(KEY_LIGHT_ID, vec3(0.6, 8, 5), LOGO_TARGET_ID, 20, 1.05, color(1, 0.99, 0.97)),
        // A short range keeps the shadow map's depth precision on the wordmark.
        config: Object.freeze({ coneAngleDegrees: 20, penumbra: 0.6, range: 14, threeShadow: true }),
      }),
      spot(WALL_LOW_LIGHT_ID, vec3(0, 6.5, 6), WALL_CENTRE_TARGET_ID, 55, 0.12, color(1, 0.94, 0.87), 0.95),
      spot(WALL_LEFT_LIGHT_ID, vec3(-5.5, 7.5, 3.5), WALL_LEFT_TARGET_ID, 44, 0.2, color(1, 0.94, 0.87), 0.9),
      spot(WALL_RIGHT_LIGHT_ID, vec3(5.5, 7.5, 3.5), WALL_RIGHT_TARGET_ID, 44, 0.2, color(1, 0.94, 0.87), 0.9),
      energyPoint(SPILL_LEFT_ID, vec3(-3.3, 3.2, -1.4), 5),
      energyPoint(SPILL_RIGHT_ID, vec3(3.3, 3.2, -1.4), 5),
      energyPoint(FLOOR_POOL_ID, vec3(0, 0.5, 1.2), 4, 0.4),
      Object.freeze({ id: AMBIENT_LIGHT_ID, type: 'ambient' as const, color: color(1, 0.97, 0.94), intensity: 0.12 }),
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
      // Warm polished metal: fixed reflection samples remove low-tier shimmer, while restrained reflectivity keeps the mirrored wordmark from
      // competing with the real one. The remaining LEDs leave soft streaks, and a thicker hit test catches the thin wall details.
      parameters: Object.freeze({ mix: 1, floorY: FLOOR_Y, reflectivity: 0.2, roughness: 0.32, fresnel: 1.4, albedo: 0.82, poolIntensity: 0.5, specular: 1.1, fadeDistance: 30, maxReflection: 13, thickness: 4, skyColor: color(0.63, 0.59, 0.53), baseColor: color(0.63, 0.53, 0.43), streak: 0.45, samplingStability: 1, edgeFallback: 0.8, grit: 0, gritScale: 6 }),
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
      // Only what is brighter than white glows (the LEDs), so the letters and the lit walls stay crisp; the mip chain gives each lit segment a
      // hot halo that fades into a wide orange glow.
      parameters: Object.freeze({ mix: 1, threshold: 1.3, knee: 0.6, intensity: 1, spread: 0.8, levels: 7 }),
    }),
    Object.freeze({
      id: FINISH_EFFECT_ID,
      typeId: FINISH_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 3,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, toneMap: 1, exposure: 1, temperature: 0, vignette: 0.18, grain: 0.04, aberration: 0.04, contrast: 1.1, saturation: 1.1 }),
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
