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
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import {
  CINEMA2_MAINFRAME_MAX_SCALE,
  CINEMA2_MAINFRAME_MIN_SCALE,
  CINEMA2_MAINFRAME_NATIVE_MODULE_TYPE_ID,
  CINEMA2_MAINFRAME_NATIVE_MODULE_VERSION,
} from '../modules/Cinema2MainframeNativeModule'
import {
  CINEMA2_MAINFRAME_DEFAULT_PATTERN,
  CINEMA2_MAINFRAME_PATTERN_IDS,
  type Cinema2MainframePatternId,
} from '../modules/mainframe/Cinema2MainframePatternEngine'
import { CINEMA2_MAINFRAME_ASSET_ID } from '../modules/three/Cinema2ThreeAssetManifest'
import { CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID } from '../modules/three/Cinema2ThreeEnvironmentRegistry'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'

export const CINEMA2_MAINFRAME_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.mainframe')
export const CINEMA2_MAINFRAME_MODULE_ID = cinema2StableId<Cinema2ModuleId>('mainframe-scene')
export const CINEMA2_MAINFRAME_CAMERA_ID = cinema2StableId<Cinema2CameraId>('mainframe-camera')

export const CINEMA2_MAINFRAME_MASTER_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('mainframe-master-intensity')
export const CINEMA2_MAINFRAME_BPM_SYNC_ID = cinema2StableId<Cinema2ParameterId>('mainframe-bpm-sync')
export const CINEMA2_MAINFRAME_PATTERN_ID = cinema2StableId<Cinema2ParameterId>('mainframe-pattern')
export const CINEMA2_MAINFRAME_PATTERN_CHANGE_ID = cinema2StableId<Cinema2ParameterId>('mainframe-pattern-change')
export const CINEMA2_MAINFRAME_TRIGGER_ID = cinema2StableId<Cinema2ParameterId>('mainframe-trigger')
export const CINEMA2_MAINFRAME_ENABLE_RADAR_ID = cinema2StableId<Cinema2ParameterId>('mainframe-enable-radar')
export const CINEMA2_MAINFRAME_ENABLE_CHIP_ID = cinema2StableId<Cinema2ParameterId>('mainframe-enable-chip')
export const CINEMA2_MAINFRAME_SCALE_ID = cinema2StableId<Cinema2ParameterId>('mainframe-scale')
export const CINEMA2_MAINFRAME_BACKGROUND_ID = cinema2StableId<Cinema2ParameterId>('mainframe-background')
export const CINEMA2_MAINFRAME_LOGO_COLOR_ID = cinema2StableId<Cinema2ParameterId>('mainframe-logo-color')
export const CINEMA2_MAINFRAME_CIRCUITS_COLOR_ID = cinema2StableId<Cinema2ParameterId>('mainframe-circuits-color')
export const CINEMA2_MAINFRAME_INDICATORS_COLOR_ID = cinema2StableId<Cinema2ParameterId>('mainframe-indicators-color')
/** Internal event-only parameter, never an Inspector control. */
export const CINEMA2_MAINFRAME_MUSICAL_CUE_ID = cinema2StableId<Cinema2ParameterId>('mainframe-musical-cue')

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

const ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('mainframe-root')
const MODEL_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('mainframe-model')
const CENTRE_TARGET_ID = cinema2StableId<Cinema2SceneNodeId>('mainframe-centre-target')
const WORLD_LAYER_ID = cinema2StableId<Cinema2LayerId>('mainframe-world-layer')

const KEY_LIGHT_ID = cinema2StableId<Cinema2LightId>('mainframe-key')
const RIM_LIGHT_ID = cinema2StableId<Cinema2LightId>('mainframe-rim')
const FILL_LIGHT_ID = cinema2StableId<Cinema2LightId>('mainframe-fill')
const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('mainframe-ambient')

const SCENE_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('mainframe-scene-target')
const BLOOM_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('mainframe-bloom-target')
const SCENE_PASS_ID = cinema2StableId<Cinema2RenderPassId>('mainframe-scene-pass')
const BLOOM_PASS_ID = cinema2StableId<Cinema2RenderPassId>('mainframe-bloom-pass')
const FINISH_PASS_ID = cinema2StableId<Cinema2RenderPassId>('mainframe-finish-pass')
const SCENE_COLOR_ID = cinema2StableId<Cinema2RenderSlotId>('mainframe-scene-color')
const SCENE_DEPTH_ID = cinema2StableId<Cinema2RenderSlotId>('mainframe-scene-depth')
const BLOOM_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('mainframe-bloom-output')
const BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('mainframe-bloom')
const FINISH_EFFECT_ID = cinema2StableId<Cinema2EffectId>('mainframe-finish')

const vec3 = (x: number, y: number, z: number): Cinema2Vector3 => Object.freeze([x, y, z])
const color = (r: number, g: number, b: number, a = 1): Cinema2Color => Object.freeze([r, g, b, a])

export const CINEMA2_MAINFRAME_DEFAULT_BACKGROUND = color(0.018, 0.028, 0.022)
export const CINEMA2_MAINFRAME_DEFAULT_LOGO = color(0.3, 1, 0.18)
export const CINEMA2_MAINFRAME_DEFAULT_CIRCUITS = color(0.24, 1, 0.12)
export const CINEMA2_MAINFRAME_DEFAULT_INDICATORS = color(0.4, 1, 0.22)

export const CINEMA2_MAINFRAME_PATTERN_LABELS: Readonly<Record<Cinema2MainframePatternId, string>> = Object.freeze({
  'outward-bus': 'Outward Bus',
  'inward-boot': 'Inward Boot',
  'bank-alternator': 'Bank Alternator',
  'quadrant-relay': 'Quadrant Relay',
  'radar-sweep': 'Radar Sweep',
  'system-surge': 'System Surge',
})

export const CINEMA2_MAINFRAME_PATTERN_OPTIONS = Object.freeze(CINEMA2_MAINFRAME_PATTERN_IDS.map(value => Object.freeze({
  value,
  label: CINEMA2_MAINFRAME_PATTERN_LABELS[value],
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
    id: CINEMA2_MAINFRAME_MASTER_INTENSITY_ID,
    label: 'Master Intensity',
    description: 'Scales the static HDR emission from the logo, circuit channels and indicators. At 0, the physical hardware remains visible under neutral studio light while emission is off.',
    type: 'float' as const,
    defaultValue: 0.8,
    min: 0,
    max: 1,
    step: 0.01,
    designParentGroup: 'master-controls' as const,
    group: 'Output',
    order: 1,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_MAINFRAME_BPM_SYNC_ID,
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
    id: CINEMA2_MAINFRAME_ENABLE_RADAR_ID,
    label: 'Enable Radar Circuit',
    description: 'Shows or hides all four complete circular radar assemblies, including their housings and illuminated rings.',
    type: 'boolean' as const,
    defaultValue: true,
    designParentGroup: 'design' as const,
    group: 'Hardware',
    order: 1,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_MAINFRAME_ENABLE_CHIP_ID,
    label: 'Enable Chip',
    description: 'Shows or hides both complete computer-chip assemblies, including sockets, dies, pins and indicators.',
    type: 'boolean' as const,
    defaultValue: true,
    designParentGroup: 'design' as const,
    group: 'Hardware',
    order: 2,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_MAINFRAME_SCALE_ID,
    label: 'Scale',
    description: 'Zooms the extended modeled Mainframe wall about the centre of the DVYDRM logo without changing glow width or timing.',
    type: 'float' as const,
    defaultValue: 1,
    min: CINEMA2_MAINFRAME_MIN_SCALE,
    max: CINEMA2_MAINFRAME_MAX_SCALE,
    step: 0.01,
    designParentGroup: 'design' as const,
    group: 'Composition',
    order: 3,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_MAINFRAME_PATTERN_ID,
    label: 'Pattern',
    description: 'Selects one of the six authored Mainframe lighting programs immediately and restarts it from a deterministic boundary.',
    type: 'enum' as const,
    defaultValue: CINEMA2_MAINFRAME_DEFAULT_PATTERN,
    options: CINEMA2_MAINFRAME_PATTERN_OPTIONS,
    designParentGroup: 'effects' as const,
    group: 'Pattern',
    order: 1,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_MAINFRAME_PATTERN_CHANGE_ID,
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
    id: CINEMA2_MAINFRAME_TRIGGER_ID,
    label: 'Trigger',
    description: 'Chooses the musical event that advances to the next lighting program while Pattern Change is enabled.',
    type: 'enum' as const,
    defaultValue: 'bar4',
    options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,
    visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: CINEMA2_MAINFRAME_PATTERN_CHANGE_ID, value: true })]),
    designParentGroup: 'effects' as const,
    group: 'Pattern',
    order: 3,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_MAINFRAME_BACKGROUND_ID,
    label: 'Background',
    description: 'Sets the physical circuit-board substrate and panel tint while preserving roughness, shadows and metal separation.',
    type: 'color' as const,
    defaultValue: CINEMA2_MAINFRAME_DEFAULT_BACKGROUND,
    designParentGroup: 'palette' as const,
    group: 'Materials',
    order: 1,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_MAINFRAME_LOGO_COLOR_ID,
    label: 'Logo',
    description: 'Sets the inset HDR light in the raised centre logo; its structural metal remains neutral and reflective.',
    type: 'color' as const,
    defaultValue: CINEMA2_MAINFRAME_DEFAULT_LOGO,
    designParentGroup: 'palette' as const,
    group: 'Light',
    order: 2,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_MAINFRAME_CIRCUITS_COLOR_ID,
    label: 'Circuits',
    description: 'Sets the HDR light running through all raised circuit channels.',
    type: 'color' as const,
    defaultValue: CINEMA2_MAINFRAME_DEFAULT_CIRCUITS,
    designParentGroup: 'palette' as const,
    group: 'Light',
    order: 3,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_MAINFRAME_INDICATORS_COLOR_ID,
    label: 'Indicators',
    description: 'Sets terminal, via, radar and chip indicator light independently from the circuit channels.',
    type: 'color' as const,
    defaultValue: CINEMA2_MAINFRAME_DEFAULT_INDICATORS,
    designParentGroup: 'palette' as const,
    group: 'Light',
    order: 4,
  }),
])

function spot(id: Cinema2LightId, position: Cinema2Vector3, intensity: number, lightColor: Cinema2Color, coneAngleDegrees: number, shadow = false) {
  return Object.freeze({
    id,
    type: 'spot' as const,
    color: lightColor,
    intensity,
    transform: Object.freeze({ position }),
    targetNode: cinema2Ref(CENTRE_TARGET_ID),
    config: Object.freeze({ coneAngleDegrees, penumbra: 0.72, range: 24, ...(shadow ? { threeShadow: true } : {}) }),
  })
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

export const CINEMA2_MAINFRAME_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_MAINFRAME_PRESET_ID,
  revision: 2,
  metadata: Object.freeze({
    name: 'Mainframe',
    description: 'The DVYDRM cloud embedded in a dark, physically modeled circuit-board wall with raised luminous traces, radar modules, chips and indicator hardware.',
    tags: Object.freeze(['mainframe', 'logo', 'circuit-board', 'hardware', 'native', '3d', 'hdr', 'keeper']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native shared-context rendering of the production Mainframe model.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Depth-tested relief, bevels, self-occlusion and cast shadows.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'The board, circuits, hardware and logo are real layered geometry.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'A static perspective camera preserves the frontal 16:9 composition and shallow depth.' }),
    Object.freeze({ id: 'lighting' as const, requirement: 'required' as const, purpose: 'Neutral environment, asymmetric key, rim and fill lighting reveal the hard-surface model.' }),
    Object.freeze({ id: 'audio.bands' as const, requirement: 'optional' as const, purpose: 'Sub, bass, mid and high energy texture the circuit, component and logo systems.' }),
    Object.freeze({ id: 'audio.features' as const, requirement: 'optional' as const, purpose: 'Spectral flux, vocal presence and build progress drive authored detail systems.' }),
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'Beat-grid timing and bank accents; a deterministic 120 BPM clock is the fallback.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Downbeats resolve relay and surge accents.' }),
    Object.freeze({ id: 'music.rhythm-events' as const, requirement: 'optional' as const, purpose: 'Kick and snare events pulse terminals and the logo contour.' }),
    Object.freeze({ id: 'music.phrase' as const, requirement: 'optional' as const, purpose: 'Phrase boundaries launch full-board chases and chip activation.' }),
    Object.freeze({ id: 'music.vocal-presence' as const, requirement: 'optional' as const, purpose: 'Vocal presence animates the logo body and spirals.' }),
    Object.freeze({ id: 'music.build' as const, requirement: 'optional' as const, purpose: 'Build progress charges the top and bottom centre feeds.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'Drops produce the bounded global surge with logo priority.' }),
    Object.freeze({ id: 'music.bar' as const, requirement: 'optional' as const, purpose: 'Canonical bar accents from the shared choreography runtime.' }),
    Object.freeze({ id: 'music.section' as const, requirement: 'optional' as const, purpose: 'Shared director-authored section transitions.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'Shared intensity, momentum, build and impact authority.' }),
  ]),
  parameters: Object.freeze([...PARAMETERS, Object.freeze({
    id: CINEMA2_MAINFRAME_MUSICAL_CUE_ID,
    label: 'Musical Cue', type: 'trigger' as const,
    section: 'React', group: 'Runtime', order: 999,
    exposure: 'hidden' as const, persistence: 'runtime-only' as const, reset: 'none' as const,
  })]),
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_MAINFRAME_MODULE_ID,
    typeId: CINEMA2_MAINFRAME_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_MAINFRAME_NATIVE_MODULE_VERSION,
    enabled: true,
    parameters: Object.freeze({
      masterIntensity: 0.8,
      bpmSync: true,
      pattern: CINEMA2_MAINFRAME_DEFAULT_PATTERN,
      patternChange: false,
      trigger: 'bar4',
      enableRadar: true,
      enableChip: true,
      scale: 1,
      background: CINEMA2_MAINFRAME_DEFAULT_BACKGROUND,
      logoColor: CINEMA2_MAINFRAME_DEFAULT_LOGO,
      circuitsColor: CINEMA2_MAINFRAME_DEFAULT_CIRCUITS,
      indicatorsColor: CINEMA2_MAINFRAME_DEFAULT_INDICATORS,
    }),
    parameterBindings: Object.freeze({
      masterIntensity: cinema2Ref(CINEMA2_MAINFRAME_MASTER_INTENSITY_ID),
      bpmSync: cinema2Ref(CINEMA2_MAINFRAME_BPM_SYNC_ID),
      pattern: cinema2Ref(CINEMA2_MAINFRAME_PATTERN_ID),
      patternChange: cinema2Ref(CINEMA2_MAINFRAME_PATTERN_CHANGE_ID),
      trigger: cinema2Ref(CINEMA2_MAINFRAME_TRIGGER_ID),
      enableRadar: cinema2Ref(CINEMA2_MAINFRAME_ENABLE_RADAR_ID),
      enableChip: cinema2Ref(CINEMA2_MAINFRAME_ENABLE_CHIP_ID),
      scale: cinema2Ref(CINEMA2_MAINFRAME_SCALE_ID),
      background: cinema2Ref(CINEMA2_MAINFRAME_BACKGROUND_ID),
      logoColor: cinema2Ref(CINEMA2_MAINFRAME_LOGO_COLOR_ID),
      circuitsColor: cinema2Ref(CINEMA2_MAINFRAME_CIRCUITS_COLOR_ID),
      indicatorsColor: cinema2Ref(CINEMA2_MAINFRAME_INDICATORS_COLOR_ID),
    }),
    actionBindings: Object.freeze({ musicalCue: cinema2Ref(CINEMA2_MAINFRAME_MUSICAL_CUE_ID) }),
    config: Object.freeze({ asset: CINEMA2_MAINFRAME_ASSET_ID, environment: CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID }),
  })]),
  // Event selection, phrase/drop fallbacks, section changes and deduplication
  // are all owned by the exact same choreography runtime used by Electric Storm.
  choreography: Object.freeze({ rules: Object.freeze(MUSIC_CUES.map(([kind, signal, capability], index) => Object.freeze({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`mainframe-${kind}-event`),
    priority: 30 + index,
    source: Object.freeze({ signal, capability }),
    actions: Object.freeze([Object.freeze({
      id: cinema2StableId<Cinema2ChoreographyActionId>(`mainframe-${kind}-cue`),
      target: Object.freeze({ kind: 'parameter' as const, ref: cinema2Ref(CINEMA2_MAINFRAME_MUSICAL_CUE_ID) }),
      operation: 'spawn' as const,
      value: Object.freeze({ kind }),
    })]),
  }))) }),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
      Object.freeze({ id: MODEL_NODE_ID, kind: 'module' as const, parent: cinema2Ref(ROOT_NODE_ID), module: cinema2Ref(CINEMA2_MAINFRAME_MODULE_ID) }),
      Object.freeze({ id: CENTRE_TARGET_ID, kind: 'group' as const, parent: cinema2Ref(ROOT_NODE_ID), transform: Object.freeze({ position: vec3(0, 0, 0.2) }) }),
    ]),
    roots: Object.freeze([cinema2Ref(ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([Object.freeze({
    id: WORLD_LAYER_ID,
    label: 'Mainframe World',
    source: cinema2Ref(ROOT_NODE_ID),
    role: 'world' as const,
    depthPolicy: 'read-write' as const,
    order: 0,
  })]),
  cameras: Object.freeze([Object.freeze({
    id: CINEMA2_MAINFRAME_CAMERA_ID,
    label: 'Mainframe Front',
    projection: 'perspective' as const,
    fovDegrees: 35,
    near: 0.1,
    far: 40,
    transform: Object.freeze({ position: vec3(0, 0, 12.2) }),
    target: vec3(0, 0, 0.12),
    rig: Object.freeze({ kind: 'static' as const }),
  })]),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_MAINFRAME_CAMERA_ID) }),
  lighting: Object.freeze({
    lights: Object.freeze([
      spot(KEY_LIGHT_ID, vec3(-5.5, 6.5, 8), 0.42, color(0.97, 1, 0.98), 44, true),
      spot(RIM_LIGHT_ID, vec3(6.5, 2.5, 7), 0.2, color(0.78, 0.88, 1), 50),
      spot(FILL_LIGHT_ID, vec3(-1, -5, 6), 0.09, color(0.84, 0.88, 0.85), 58),
      Object.freeze({ id: AMBIENT_LIGHT_ID, type: 'ambient' as const, color: color(0.72, 0.78, 0.74), intensity: 0.028 }),
    ]),
  }),
  environment: Object.freeze({ backgroundColor: color(0.002, 0.004, 0.003), exposure: 1 }),
  effects: Object.freeze([
    Object.freeze({
      id: BLOOM_EFFECT_ID,
      typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 0,
      scope: 'output' as const,
      // A high threshold keeps dormant green routes crisp; hot audio peaks carry the stronger-than-Conduit halo.
      parameters: Object.freeze({ mix: 1, threshold: 1.65, knee: 0.28, intensity: 0.92, spread: 0.58, levels: 7, clampMax: 32, tint: color(0.78, 1, 0.7) }),
    }),
    Object.freeze({
      id: FINISH_EFFECT_ID,
      typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 1,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, toneMap: 1, exposure: 0.74, temperature: -0.02, tint: 0, vignette: 0.2, vignetteSoftness: 0.72, grain: 0.018, grainSize: 1.3, aberration: 0.003, contrast: 1.14, saturation: 1.03 }),
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
        inputs: Object.freeze([Object.freeze({ id: cinema2StableId<Cinema2RenderSlotId>('mainframe-bloom-input'), source: Object.freeze({ pass: cinema2Ref(SCENE_PASS_ID), output: SCENE_COLOR_ID }), attachment: 'color' as const })]),
        outputs: Object.freeze([Object.freeze({ id: BLOOM_OUTPUT_ID, target: cinema2Ref(BLOOM_TARGET_ID), attachment: 'color' as const })]),
      }),
      Object.freeze({
        id: FINISH_PASS_ID,
        kind: 'fullscreen' as const,
        dependsOn: Object.freeze([cinema2Ref(BLOOM_PASS_ID)]),
        effect: cinema2Ref(FINISH_EFFECT_ID),
        inputs: Object.freeze([Object.freeze({ id: cinema2StableId<Cinema2RenderSlotId>('mainframe-finish-input'), source: Object.freeze({ pass: cinema2Ref(BLOOM_PASS_ID), output: BLOOM_OUTPUT_ID }), attachment: 'color' as const })]),
      }),
    ]),
    outputPass: cinema2Ref(FINISH_PASS_ID),
  }),
  output: Object.freeze({ renderPass: cinema2Ref(FINISH_PASS_ID), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
}) as Readonly<Cinema2NativePresetManifest>
