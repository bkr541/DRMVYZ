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
  type Cinema2LightGroupId,
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
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { cinema2LightRigHit, cinema2LightRigRamp } from './Cinema2LightRigAuthoring'
import {
  CINEMA2_BACKSTREET_MAX_SCALE,
  CINEMA2_BACKSTREET_MIN_SCALE,
  CINEMA2_BACKSTREET_NATIVE_MODULE_TYPE_ID,
  CINEMA2_BACKSTREET_NATIVE_MODULE_VERSION,
} from '../modules/Cinema2BackstreetNativeModule'
import {
  CINEMA2_MAINFRAME_DEFAULT_PATTERN,
  CINEMA2_MAINFRAME_PATTERN_IDS,
  type Cinema2MainframePatternId,
} from '../modules/mainframe/Cinema2MainframePatternEngine'
import { CINEMA2_BACKSTREET_ASSET_ID } from '../modules/three/Cinema2ThreeAssetManifest'
import { CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID } from '../modules/three/Cinema2ThreeEnvironmentRegistry'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'

/**
 * BACKSTREET: the DVYDRM wordmark as a white neon sign on a black painted brick wall. The sign is an outline (a glass tube round every contour of
 * the owner's wordmark master) and is driven by the very same audio intelligence and choreography engine as Mainframe: the same musical cues,
 * the same six lighting programs, the same Pattern / Pattern Change / Trigger behaviour.
 */
export const CINEMA2_BACKSTREET_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.backstreet')
export const CINEMA2_BACKSTREET_MODULE_ID = cinema2StableId<Cinema2ModuleId>('backstreet-scene')
export const CINEMA2_BACKSTREET_CAMERA_ID = cinema2StableId<Cinema2CameraId>('backstreet-camera')

export const CINEMA2_BACKSTREET_MASTER_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('backstreet-master-intensity')
export const CINEMA2_BACKSTREET_BPM_SYNC_ID = cinema2StableId<Cinema2ParameterId>('backstreet-bpm-sync')
export const CINEMA2_BACKSTREET_SCALE_ID = cinema2StableId<Cinema2ParameterId>('backstreet-scale')
export const CINEMA2_BACKSTREET_PATTERN_ID = cinema2StableId<Cinema2ParameterId>('backstreet-pattern')
export const CINEMA2_BACKSTREET_PATTERN_CHANGE_ID = cinema2StableId<Cinema2ParameterId>('backstreet-pattern-change')
export const CINEMA2_BACKSTREET_TRIGGER_ID = cinema2StableId<Cinema2ParameterId>('backstreet-trigger')
export const CINEMA2_BACKSTREET_IDLE_GLOW_ID = cinema2StableId<Cinema2ParameterId>('backstreet-idle-glow')
export const CINEMA2_BACKSTREET_TUBE_COLOR_ID = cinema2StableId<Cinema2ParameterId>('backstreet-tube-color')
/** Internal event-only parameter, never an Inspector control. */
export const CINEMA2_BACKSTREET_MUSICAL_CUE_ID = cinema2StableId<Cinema2ParameterId>('backstreet-musical-cue')

/** The same nine cues Mainframe feeds its engine, from the same shared choreography runtime. */
const MUSIC_CUES = Object.freeze([
  ['kick', 'kick', 'music.rhythm-events'],
  ['snare', 'snare', 'music.rhythm-events'],
  ['transient', 'transient', 'music.rhythm-events'],
  ['beat', 'beat', 'music.beat'],
  ['downbeat', 'downbeat', 'music.downbeat'],
  ['fourBeat', 'bar', 'music.bar'],
  ['phrase', 'phrase', 'music.phrase'],
  ['section', 'section-change', 'music.section'],
  ['drop', 'drop', 'music.drop'],
] as const satisfies readonly (readonly [string, Cinema2ChoreographySignal, Cinema2CapabilityId])[])

const ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('backstreet-root')
const MODEL_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('backstreet-model')
const WALL_TARGET_ID = cinema2StableId<Cinema2SceneNodeId>('backstreet-wall-target')
const WORLD_LAYER_ID = cinema2StableId<Cinema2LayerId>('backstreet-world-layer')

const KEY_LIGHT_ID = cinema2StableId<Cinema2LightId>('backstreet-key')
const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('backstreet-ambient')
const NEON_WASH_GROUP_ID = cinema2StableId<Cinema2LightGroupId>('backstreet-neon-wash')
/** Points of light just in front of the wall along the sign: the way the neon's glow reaches the bricks (an emissive tube lights nothing by itself). */
const NEON_WASH_POSITIONS: readonly Cinema2Vector3[] = Object.freeze([
  [-3.9, -0.5, 0.55], [-2.9, 0.9, 0.55], [-1.9, -0.7, 0.55], [-0.95, 0.5, 0.55], [0, -0.6, 0.55],
  [0.95, 0.7, 0.55], [1.9, -0.5, 0.55], [2.9, 0.8, 0.55], [3.9, -0.6, 0.55],
].map(([x, y, z]) => Object.freeze([x!, y!, z!] as const)))
const NEON_WASH_LIGHT_IDS = NEON_WASH_POSITIONS.map((_, index) => cinema2StableId<Cinema2LightId>(`backstreet-wash-${index + 1}`))
/** Wash intensity at rest; the kick, the downbeat and a build lift it. */
const WASH_BASE_INTENSITY = 0.8

const SCENE_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('backstreet-scene-target')
const BLOOM_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('backstreet-bloom-target')
const SCENE_PASS_ID = cinema2StableId<Cinema2RenderPassId>('backstreet-scene-pass')
const BLOOM_PASS_ID = cinema2StableId<Cinema2RenderPassId>('backstreet-bloom-pass')
const FINISH_PASS_ID = cinema2StableId<Cinema2RenderPassId>('backstreet-finish-pass')
const SCENE_COLOR_ID = cinema2StableId<Cinema2RenderSlotId>('backstreet-scene-color')
const SCENE_DEPTH_ID = cinema2StableId<Cinema2RenderSlotId>('backstreet-scene-depth')
const BLOOM_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('backstreet-bloom-output')
const BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('backstreet-bloom')
const FINISH_EFFECT_ID = cinema2StableId<Cinema2EffectId>('backstreet-finish')

const vec3 = (x: number, y: number, z: number): Cinema2Vector3 => Object.freeze([x, y, z])
const color = (r: number, g: number, b: number, a = 1): Cinema2Color => Object.freeze([r, g, b, a])

export const CINEMA2_BACKSTREET_DEFAULT_TUBE_COLOR = color(1, 1, 1)

/** Mainframe's six programs, named for a neon sign (their ids, and so their behaviour, are unchanged). */
export const CINEMA2_BACKSTREET_PATTERN_LABELS: Readonly<Record<Cinema2MainframePatternId, string>> = Object.freeze({
  'outward-bus': 'Center Out',
  'inward-boot': 'Edges In',
  'bank-alternator': 'Marquee',
  'quadrant-relay': 'Quadrant Relay',
  'radar-sweep': 'Radar Sweep',
  'system-surge': 'Surge',
})

export const CINEMA2_BACKSTREET_PATTERN_OPTIONS = Object.freeze(CINEMA2_MAINFRAME_PATTERN_IDS.map(value => Object.freeze({
  value,
  label: CINEMA2_BACKSTREET_PATTERN_LABELS[value],
})))

const baseParameter = Object.freeze({
  section: 'Design',
  exposure: 'primary' as const,
  modulatable: false,
  choreographable: false,
  automatable: false,
  persistence: 'preset' as const,
  reset: 'authored-default' as const,
})

const PARAMETERS = Object.freeze([
  CINEMA2_QUALITY_MODE_PARAMETER,
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_BACKSTREET_MASTER_INTENSITY_ID,
    label: 'Master Intensity',
    description: 'Scales the neon\'s light, both at rest and in every lighting program. At 0 the glass tubes stay visible on the wall but unlit.',
    type: 'float' as const,
    defaultValue: 1,
    min: 0,
    max: 1,
    step: 0.01,
    designParentGroup: 'master-controls' as const,
    group: 'Output',
    order: 1,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_BACKSTREET_BPM_SYNC_ID,
    label: 'BPM Sync',
    description: 'Uses the analyzed track beat grid when available. Off, or without a usable grid, the six lighting programs run from a stable 120 BPM clock.',
    type: 'boolean' as const,
    defaultValue: true,
    designParentGroup: 'master-controls' as const,
    group: 'Timing',
    order: 2,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_BACKSTREET_SCALE_ID,
    label: 'Scale',
    description: 'Zooms the sign about its centre. A Stage narrower than 16:9 already zooms out so the whole sign stays in view.',
    type: 'float' as const,
    defaultValue: 1,
    min: CINEMA2_BACKSTREET_MIN_SCALE,
    max: CINEMA2_BACKSTREET_MAX_SCALE,
    step: 0.01,
    designParentGroup: 'design' as const,
    group: 'Composition',
    order: 1,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_BACKSTREET_PATTERN_ID,
    label: 'Pattern',
    description: 'Selects one of the six lighting programs immediately and restarts it from a deterministic boundary. Center Out and Edges In run between the middle of the sign and its ends, Marquee chases bars of the sign on the beat, Quadrant Relay passes the light round the sign, Radar Sweep turns a beam round it, and Surge charges the top and bottom and flashes the whole sign on a drop.',
    type: 'enum' as const,
    defaultValue: CINEMA2_MAINFRAME_DEFAULT_PATTERN,
    options: CINEMA2_BACKSTREET_PATTERN_OPTIONS,
    designParentGroup: 'effects' as const,
    group: 'Pattern',
    order: 1,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_BACKSTREET_PATTERN_CHANGE_ID,
    label: 'Pattern Change',
    description: 'When enabled, each qualified Trigger advances through a deterministic shuffled cycle with no immediate repeat.',
    type: 'boolean' as const,
    defaultValue: false,
    designParentGroup: 'effects' as const,
    group: 'Pattern',
    order: 2,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_BACKSTREET_TRIGGER_ID,
    label: 'Trigger',
    description: 'Chooses the musical event that advances to the next lighting program while Pattern Change is enabled.',
    type: 'enum' as const,
    defaultValue: 'bar4',
    options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,
    visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: CINEMA2_BACKSTREET_PATTERN_CHANGE_ID, value: true })]),
    designParentGroup: 'effects' as const,
    group: 'Pattern',
    order: 3,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_BACKSTREET_IDLE_GLOW_ID,
    label: 'Idle Glow',
    description: 'How much of the sign stays lit between hits. 1 keeps it steadily lit with the programs riding on top; 0 lets a program switch the parts it is not addressing right down.',
    type: 'float' as const,
    defaultValue: 0.45,
    min: 0,
    max: 1,
    step: 0.01,
    designParentGroup: 'effects' as const,
    group: 'Pattern',
    order: 4,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_BACKSTREET_TUBE_COLOR_ID,
    label: 'Tube Color',
    description: 'The colour of the neon. The glow round it, and the light it throws on the wall, follow.',
    type: 'color' as const,
    defaultValue: CINEMA2_BACKSTREET_DEFAULT_TUBE_COLOR,
    designParentGroup: 'palette' as const,
    group: 'Light',
    order: 1,
  }),
])

const spotLight = (id: Cinema2LightId, position: Cinema2Vector3, intensity: number, lightColor: Cinema2Color, coneAngleDegrees: number) => Object.freeze({
  id,
  type: 'spot' as const,
  color: lightColor,
  intensity,
  transform: Object.freeze({ position }),
  targetNode: cinema2Ref(WALL_TARGET_ID),
  config: Object.freeze({ coneAngleDegrees, penumbra: 0.8, range: 24, threeShadow: true }),
})

const pointLight = (id: Cinema2LightId, position: Cinema2Vector3) => Object.freeze({
  id,
  type: 'point' as const,
  color: color(1, 0.97, 0.93),
  intensity: WASH_BASE_INTENSITY,
  transform: Object.freeze({ position }),
  config: Object.freeze({ range: 2.7 }),
})

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

/** A very slow, tiny loop round the front-on position, so the tubes and clips shift a little against the wall. */
function driftPath() {
  return Object.freeze([
    Object.freeze({ position: vec3(-0.34, 0.1, 9.1) }),
    Object.freeze({ position: vec3(0, 0.26, 8.98) }),
    Object.freeze({ position: vec3(0.34, 0.1, 9.1) }),
    Object.freeze({ position: vec3(0, -0.16, 9.22) }),
  ])
}

export const CINEMA2_BACKSTREET_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_BACKSTREET_PRESET_ID,
  revision: 1,
  metadata: Object.freeze({
    name: 'Backstreet',
    description: 'The DVYDRM wordmark as a white neon sign, an outline in glass tube, hung on a black painted brick wall and driven by the same audio intelligence and lighting programs as Mainframe.',
    tags: Object.freeze(['backstreet', 'logo', 'neon', 'brick', 'native', '3d', 'hdr', 'keeper']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native shared-context rendering of the production Backstreet model.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Depth-tested tubes, clips and brick relief, and the shadows they throw.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'The neon tubes, their clips and the wall are real geometry.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'A near-static perspective camera with a very slow parallax drift.' }),
    Object.freeze({ id: 'lighting' as const, requirement: 'required' as const, purpose: 'Points of light along the sign wash the wall, and one spot throws the tubes\' shadows.' }),
    Object.freeze({ id: 'audio.bands' as const, requirement: 'optional' as const, purpose: 'Sub, bass, mid and high energy shape the sign\'s light.' }),
    Object.freeze({ id: 'audio.features' as const, requirement: 'optional' as const, purpose: 'Spectral flux, vocal presence and build progress drive the lighting programs.' }),
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'Beat-grid timing; a deterministic 120 BPM clock is the fallback.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Downbeats resolve relay and surge accents and lift the wall light.' }),
    Object.freeze({ id: 'music.rhythm-events' as const, requirement: 'optional' as const, purpose: 'Kick and snare events pulse the sign; kicks also lift the wall light.' }),
    Object.freeze({ id: 'music.phrase' as const, requirement: 'optional' as const, purpose: 'Phrase boundaries launch full-sign chases.' }),
    Object.freeze({ id: 'music.build' as const, requirement: 'optional' as const, purpose: 'Build progress charges the Surge program.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'Drops produce the bounded full-sign surge.' }),
    Object.freeze({ id: 'music.bar' as const, requirement: 'optional' as const, purpose: 'Canonical bar accents from the shared choreography runtime.' }),
    Object.freeze({ id: 'music.section' as const, requirement: 'optional' as const, purpose: 'Shared director-authored section transitions.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'Shared intensity, momentum, build and impact authority; a build also lifts the wall light.' }),
  ]),
  parameters: Object.freeze([...PARAMETERS, Object.freeze({
    id: CINEMA2_BACKSTREET_MUSICAL_CUE_ID,
    label: 'Musical Cue', type: 'trigger' as const,
    section: 'React', group: 'Runtime', order: 999,
    exposure: 'hidden' as const, persistence: 'runtime-only' as const, reset: 'none' as const,
  })]),
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_BACKSTREET_MODULE_ID,
    typeId: CINEMA2_BACKSTREET_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_BACKSTREET_NATIVE_MODULE_VERSION,
    enabled: true,
    parameters: Object.freeze({
      masterIntensity: 1,
      bpmSync: true,
      pattern: CINEMA2_MAINFRAME_DEFAULT_PATTERN,
      patternChange: false,
      trigger: 'bar4',
      scale: 1,
      idleGlow: 0.45,
      tubeColor: CINEMA2_BACKSTREET_DEFAULT_TUBE_COLOR,
    }),
    parameterBindings: Object.freeze({
      masterIntensity: cinema2Ref(CINEMA2_BACKSTREET_MASTER_INTENSITY_ID),
      bpmSync: cinema2Ref(CINEMA2_BACKSTREET_BPM_SYNC_ID),
      pattern: cinema2Ref(CINEMA2_BACKSTREET_PATTERN_ID),
      patternChange: cinema2Ref(CINEMA2_BACKSTREET_PATTERN_CHANGE_ID),
      trigger: cinema2Ref(CINEMA2_BACKSTREET_TRIGGER_ID),
      scale: cinema2Ref(CINEMA2_BACKSTREET_SCALE_ID),
      idleGlow: cinema2Ref(CINEMA2_BACKSTREET_IDLE_GLOW_ID),
      tubeColor: cinema2Ref(CINEMA2_BACKSTREET_TUBE_COLOR_ID),
    }),
    actionBindings: Object.freeze({ musicalCue: cinema2Ref(CINEMA2_BACKSTREET_MUSICAL_CUE_ID) }),
    config: Object.freeze({ asset: CINEMA2_BACKSTREET_ASSET_ID, environment: CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID }),
  })]),
  choreography: Object.freeze({
    rules: Object.freeze([
      // Event selection, phrase/drop fallbacks, section changes and deduplication belong to the same shared choreography runtime Mainframe uses.
      ...MUSIC_CUES.map(([kind, signal, capability], index) => Object.freeze({
        id: cinema2StableId<Cinema2ChoreographyRuleId>(`backstreet-${kind === 'fourBeat' ? 'four-beat' : kind}-event`),
        priority: 30 + index,
        source: Object.freeze({ signal, capability }),
        actions: Object.freeze([Object.freeze({
          id: cinema2StableId<Cinema2ChoreographyActionId>(`backstreet-${kind === 'fourBeat' ? 'four-beat' : kind}-cue`),
          target: Object.freeze({ kind: 'parameter' as const, ref: cinema2Ref(CINEMA2_BACKSTREET_MUSICAL_CUE_ID) }),
          operation: 'spawn' as const,
          value: Object.freeze({ kind }),
        })]),
      })),
      // The wall's light follows the sign: it swells on the kick and the downbeat and lifts through a build.
      ...cinema2LightRigHit({ id: 'backstreet-wash-kick', group: NEON_WASH_GROUP_ID, signal: 'kick', peak: 0.28, attack: 0, hold: 0.05, release: 0.35, priority: 20 }),
      ...cinema2LightRigHit({ id: 'backstreet-wash-downbeat', group: NEON_WASH_GROUP_ID, signal: 'downbeat', peak: 0.5, attack: 0, hold: 0.1, release: 0.8, priority: 22 }),
      ...cinema2LightRigRamp({ id: 'backstreet-wash', groups: [NEON_WASH_GROUP_ID], source: 'director.build', lift: 0.55, priority: 18 }),
    ]),
  }),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
      Object.freeze({ id: MODEL_NODE_ID, kind: 'module' as const, parent: cinema2Ref(ROOT_NODE_ID), module: cinema2Ref(CINEMA2_BACKSTREET_MODULE_ID) }),
      Object.freeze({ id: WALL_TARGET_ID, kind: 'group' as const, parent: cinema2Ref(ROOT_NODE_ID), transform: Object.freeze({ position: vec3(0, 0, -0.3) }) }),
    ]),
    roots: Object.freeze([cinema2Ref(ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([Object.freeze({
    id: WORLD_LAYER_ID,
    label: 'Backstreet World',
    source: cinema2Ref(ROOT_NODE_ID),
    role: 'world' as const,
    depthPolicy: 'read-write' as const,
    order: 0,
  })]),
  cameras: Object.freeze([Object.freeze({
    id: CINEMA2_BACKSTREET_CAMERA_ID,
    label: 'Backstreet Front',
    projection: 'perspective' as const,
    fovDegrees: 35,
    near: 0.1,
    far: 40,
    target: vec3(0, 0, 0),
    rig: Object.freeze({ kind: 'fly' as const, points: driftPath(), durationSeconds: 70, loop: true }),
  })]),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_BACKSTREET_CAMERA_ID) }),
  lighting: Object.freeze({
    groups: Object.freeze([Object.freeze({ id: NEON_WASH_GROUP_ID, label: 'Neon Wash', lights: Object.freeze(NEON_WASH_LIGHT_IDS.map(id => cinema2Ref(id))) })]),
    lights: Object.freeze([
      ...NEON_WASH_POSITIONS.map((position, index) => pointLight(NEON_WASH_LIGHT_IDS[index]!, position)),
      spotLight(KEY_LIGHT_ID, vec3(-3.2, 3.4, 5), 0.16, color(1, 0.96, 0.9), 55),
      Object.freeze({ id: AMBIENT_LIGHT_ID, type: 'ambient' as const, color: color(0.9, 0.86, 0.82), intensity: 0.018 }),
    ]),
  }),
  environment: Object.freeze({ backgroundColor: color(0.002, 0.002, 0.003), exposure: 1 }),
  effects: Object.freeze([
    Object.freeze({
      id: BLOOM_EFFECT_ID,
      typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 0,
      scope: 'output' as const,
      // A low threshold: the neon's glow is a wide halo that reaches across the bricks, as in the production reference.
      parameters: Object.freeze({ mix: 1, threshold: 0.85, knee: 0.4, intensity: 0.95, spread: 0.62, levels: 7, clampMax: 24, tint: color(1, 1, 1) }),
    }),
    Object.freeze({
      id: FINISH_EFFECT_ID,
      typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 1,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, toneMap: 1, exposure: 0.92, temperature: 0.01, tint: 0, vignette: 0.32, vignetteSoftness: 0.7, grain: 0.03, grainSize: 1.3, aberration: 0.002, contrast: 1.1, saturation: 1 }),
    }),
  ]),
  render: Object.freeze({
    targets: Object.freeze([viewportTarget(SCENE_TARGET_ID, true), viewportTarget(BLOOM_TARGET_ID)]),
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
      Object.freeze({
        id: BLOOM_PASS_ID,
        kind: 'fullscreen' as const,
        dependsOn: Object.freeze([cinema2Ref(SCENE_PASS_ID)]),
        effect: cinema2Ref(BLOOM_EFFECT_ID),
        inputs: Object.freeze([Object.freeze({ id: cinema2StableId<Cinema2RenderSlotId>('backstreet-bloom-input'), source: Object.freeze({ pass: cinema2Ref(SCENE_PASS_ID), output: SCENE_COLOR_ID }), attachment: 'color' as const })]),
        outputs: Object.freeze([Object.freeze({ id: BLOOM_OUTPUT_ID, target: cinema2Ref(BLOOM_TARGET_ID), attachment: 'color' as const })]),
      }),
      Object.freeze({
        id: FINISH_PASS_ID,
        kind: 'fullscreen' as const,
        dependsOn: Object.freeze([cinema2Ref(BLOOM_PASS_ID)]),
        effect: cinema2Ref(FINISH_EFFECT_ID),
        inputs: Object.freeze([Object.freeze({ id: cinema2StableId<Cinema2RenderSlotId>('backstreet-finish-input'), source: Object.freeze({ pass: cinema2Ref(BLOOM_PASS_ID), output: BLOOM_OUTPUT_ID }), attachment: 'color' as const })]),
      }),
    ]),
    outputPass: cinema2Ref(FINISH_PASS_ID),
  }),
  output: Object.freeze({ renderPass: cinema2Ref(FINISH_PASS_ID), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
}) as Readonly<Cinema2NativePresetManifest>
