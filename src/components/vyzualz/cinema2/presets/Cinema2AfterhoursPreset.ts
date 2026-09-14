import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2LayerId,
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2RenderPassId,
  type Cinema2RenderSlotId,
  type Cinema2RenderTargetId,
  type Cinema2SceneNodeId,
} from '../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_AFTERHOURS_NATIVE_MODULE_TYPE_ID,
  CINEMA2_AFTERHOURS_NATIVE_MODULE_VERSION,
  CINEMA2_AFTERHOURS_PATTERN_CHANGE_IDS,
  CINEMA2_AFTERHOURS_TRIGGER_IDS,
} from '../modules/Cinema2AfterhoursNativeModule'
import { CINEMA2_AFTERHOURS_TOPOLOGY_IDS } from '../modules/afterhours/Cinema2AfterhoursDomain'

export const CINEMA2_AFTERHOURS_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.afterhours')

export const CINEMA2_AFTERHOURS_BACKGROUND_ID = cinema2StableId<Cinema2ParameterId>('afterhours-background')
export const CINEMA2_AFTERHOURS_COLOR_MODE_ID = cinema2StableId<Cinema2ParameterId>('afterhours-color-mode')
export const CINEMA2_AFTERHOURS_PRIMARY_COLOR_ID = cinema2StableId<Cinema2ParameterId>('afterhours-primary-color')
export const CINEMA2_AFTERHOURS_ACCENT_COLOR_ID = cinema2StableId<Cinema2ParameterId>('afterhours-accent-color')
export const CINEMA2_AFTERHOURS_ACCENT_MIX_ID = cinema2StableId<Cinema2ParameterId>('afterhours-accent-mix')
export const CINEMA2_AFTERHOURS_PATTERN_ID = cinema2StableId<Cinema2ParameterId>('afterhours-pattern')
export const CINEMA2_AFTERHOURS_AUTO_PERFORMANCE_ID = cinema2StableId<Cinema2ParameterId>('afterhours-auto-performance')
export const CINEMA2_AFTERHOURS_SYMMETRY_ID = cinema2StableId<Cinema2ParameterId>('afterhours-symmetry')
export const CINEMA2_AFTERHOURS_SIDE_LASERS_ID = cinema2StableId<Cinema2ParameterId>('afterhours-side-lasers')
export const CINEMA2_AFTERHOURS_TOP_LASERS_ID = cinema2StableId<Cinema2ParameterId>('afterhours-top-lasers')
export const CINEMA2_AFTERHOURS_BEAM_COUNT_ID = cinema2StableId<Cinema2ParameterId>('afterhours-beam-count')
export const CINEMA2_AFTERHOURS_SPREAD_ID = cinema2StableId<Cinema2ParameterId>('afterhours-spread')
export const CINEMA2_AFTERHOURS_ATMOSPHERE_ID = cinema2StableId<Cinema2ParameterId>('afterhours-atmosphere')
export const CINEMA2_AFTERHOURS_BPM_SYNC_ID = cinema2StableId<Cinema2ParameterId>('afterhours-bpm-sync')
export const CINEMA2_AFTERHOURS_MASTER_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('afterhours-master-intensity')
export const CINEMA2_AFTERHOURS_TRIGGER_ID = cinema2StableId<Cinema2ParameterId>('afterhours-trigger')
export const CINEMA2_AFTERHOURS_PULSE_AMOUNT_ID = cinema2StableId<Cinema2ParameterId>('afterhours-pulse-amount')
export const CINEMA2_AFTERHOURS_PULSE_DECAY_ID = cinema2StableId<Cinema2ParameterId>('afterhours-pulse-decay')
export const CINEMA2_AFTERHOURS_MOTION_AMOUNT_ID = cinema2StableId<Cinema2ParameterId>('afterhours-motion-amount')
export const CINEMA2_AFTERHOURS_PATTERN_CHANGE_ID = cinema2StableId<Cinema2ParameterId>('afterhours-pattern-change')
export const CINEMA2_AFTERHOURS_BLACKOUT_AMOUNT_ID = cinema2StableId<Cinema2ParameterId>('afterhours-blackout-amount')

export const CINEMA2_AFTERHOURS_MODULE_ID = cinema2StableId<Cinema2ModuleId>('afterhours-laser-field')
export const CINEMA2_AFTERHOURS_CAMERA_ID = cinema2StableId<Cinema2CameraId>('afterhours-stage-camera')
export const CINEMA2_AFTERHOURS_LAYER_ID = cinema2StableId<Cinema2LayerId>('afterhours-laser-field-layer')

const AFTERHOURS_ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('afterhours-world-root')
const AFTERHOURS_MODULE_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('afterhours-laser-field-node')
const AFTERHOURS_SCENE_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('afterhours-scene-target')
const AFTERHOURS_SCENE_PASS_ID = cinema2StableId<Cinema2RenderPassId>('afterhours-scene-pass')
const AFTERHOURS_COLOR_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('afterhours-scene-color')
const AFTERHOURS_DEPTH_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('afterhours-scene-depth')

const COLOR_MODE_OPTIONS = Object.freeze([
  Object.freeze({ value: 'manual', label: 'Manual' }),
  Object.freeze({ value: 'auto', label: 'Auto' }),
])

const PATTERN_LABELS: Readonly<Record<(typeof CINEMA2_AFTERHOURS_TOPOLOGY_IDS)[number], string>> = Object.freeze({
  wideFan: 'Wide Fan',
  splitWings: 'Split Wings',
  crossCanopy: 'Cross Canopy',
  diamondStar: 'Diamond / Star',
  chevronRoof: 'Chevron / Roof',
  radialCrown: 'Radial Burst / Crown',
  sparseArchitecture: 'Sparse Architecture',
  fullRig: 'Full Rig',
})

const TRIGGER_LABELS: Readonly<Record<(typeof CINEMA2_AFTERHOURS_TRIGGER_IDS)[number], string>> = Object.freeze({
  beat: 'Beat',
  kick: 'Kick',
  snare: 'Snare',
  downbeat: 'Downbeat',
  beat2: 'Every 2 Beats',
  beat4: 'Every 4 Beats',
  bar: 'Bar',
  bar4: 'Every 4 Bars',
  bar8: 'Every 8 Bars',
  phrase: 'Phrase',
  drop: 'Drop',
})

const PATTERN_CHANGE_LABELS: Readonly<Record<(typeof CINEMA2_AFTERHOURS_PATTERN_CHANGE_IDS)[number], string>> = Object.freeze({
  off: 'Off',
  bar: 'Bar',
  bar4: 'Every 4 Bars',
  bar8: 'Every 8 Bars',
  phrase: 'Phrase',
  drop: 'Drop',
})

const PATTERN_OPTIONS = Object.freeze(CINEMA2_AFTERHOURS_TOPOLOGY_IDS.map(value => Object.freeze({ value, label: PATTERN_LABELS[value] })))
const TRIGGER_OPTIONS = Object.freeze(CINEMA2_AFTERHOURS_TRIGGER_IDS.map(value => Object.freeze({ value, label: TRIGGER_LABELS[value] })))
const PATTERN_CHANGE_OPTIONS = Object.freeze(CINEMA2_AFTERHOURS_PATTERN_CHANGE_IDS.map(value => Object.freeze({ value, label: PATTERN_CHANGE_LABELS[value] })))

const PRIMARY_COLOR = Object.freeze([0.455, 0.961, 1, 1] as const)
const ACCENT_COLOR = Object.freeze([1, 1, 1, 1] as const)
const BACKGROUND_COLOR = Object.freeze([0, 0, 0, 1] as const)

/**
 * Stage 3 production manifest for the independent Cinema 2.0 Afterhours keeper.
 * Musical show planning, camera choreography and trails intentionally remain
 * outside this manifest until their assigned migration stages.
 */
export const CINEMA2_AFTERHOURS_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_AFTERHOURS_PRESET_ID,
  revision: 1,
  metadata: Object.freeze({
    name: 'Afterhours 2.0',
    description: 'Native Cinema 2.0 world-space DJ laser rig with fixed 3D fixtures, disciplined topology, real symmetry, and renderer-owned atmosphere.',
    tags: Object.freeze(['afterhours', 'native', 'laser', '3d', 'keeper']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native instanced laser-field rendering.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Depth-tested world-space laser geometry.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'World-space 32-fixture stage rig and laser field.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Shared final Cinema 2.0 perspective camera frame.' }),
  ]),
  parameters: Object.freeze([
    Object.freeze({
      id: CINEMA2_AFTERHOURS_BACKGROUND_ID,
      label: 'Background', type: 'color' as const, defaultValue: BACKGROUND_COLOR,
      section: 'Design', group: 'Color', order: 10,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_COLOR_MODE_ID,
      label: 'Color Mode', type: 'enum' as const, defaultValue: 'manual', options: COLOR_MODE_OPTIONS,
      section: 'Design', group: 'Color', order: 11,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_PRIMARY_COLOR_ID,
      label: 'Primary Color', type: 'color' as const, defaultValue: PRIMARY_COLOR,
      section: 'Design', group: 'Color', order: 12,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
      visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: CINEMA2_AFTERHOURS_COLOR_MODE_ID, value: 'manual' })]),
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_ACCENT_COLOR_ID,
      label: 'Accent Color', type: 'color' as const, defaultValue: ACCENT_COLOR,
      section: 'Design', group: 'Color', order: 13,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
      visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: CINEMA2_AFTERHOURS_COLOR_MODE_ID, value: 'manual' })]),
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_ACCENT_MIX_ID,
      label: 'Accent Mix', type: 'float' as const, defaultValue: 0.25, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Color', order: 14,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_SIDE_LASERS_ID,
      label: 'Side Lasers', type: 'boolean' as const, defaultValue: false,
      section: 'Design', group: 'Rig', order: 20,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_TOP_LASERS_ID,
      label: 'Top Lasers', type: 'boolean' as const, defaultValue: false,
      section: 'Design', group: 'Rig', order: 21,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_BEAM_COUNT_ID,
      label: 'Beam Count', type: 'integer' as const, defaultValue: 8, min: 2, max: 16, step: 1,
      description: 'Maximum simultaneously active beams. The installed rig remains 32 fixtures.',
      section: 'Design', group: 'Rig', order: 22,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_SYMMETRY_ID,
      label: 'Symmetry', type: 'boolean' as const, defaultValue: true,
      section: 'Design', group: 'Rig', order: 23,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_PATTERN_ID,
      label: 'Pattern', type: 'enum' as const, defaultValue: 'wideFan', options: PATTERN_OPTIONS,
      section: 'Design', group: 'Pattern', order: 30,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_AUTO_PERFORMANCE_ID,
      label: 'Auto Performance', type: 'boolean' as const, defaultValue: false,
      description: 'Grants broader topology and bank authority to the Stage 4 show planner. Stage 3 remains manually driven.',
      section: 'Design', group: 'Pattern', order: 31,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_PATTERN_CHANGE_ID,
      label: 'Pattern Change', type: 'enum' as const, defaultValue: 'off', options: PATTERN_CHANGE_OPTIONS,
      description: 'Authored cadence consumed by the Stage 4 show planner.',
      section: 'Design', group: 'Pattern', order: 32,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_SPREAD_ID,
      label: 'Spread', type: 'float' as const, defaultValue: 0.65, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Motion', order: 40,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_MOTION_AMOUNT_ID,
      label: 'Motion Amount', type: 'float' as const, defaultValue: 0.55, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Motion', order: 41,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_ATMOSPHERE_ID,
      label: 'Atmosphere', type: 'float' as const, defaultValue: 0.55, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Atmosphere', order: 50,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_MASTER_INTENSITY_ID,
      label: 'Master Intensity', type: 'float' as const, defaultValue: 0.75, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Atmosphere', order: 51,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_BPM_SYNC_ID,
      label: 'BPM Sync', type: 'boolean' as const, defaultValue: true,
      description: 'Selects the Stage 4/5 musical motion policy without fabricating timing in Stage 3.',
      section: 'React', group: 'Reactivity', order: 100,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_TRIGGER_ID,
      label: 'Trigger', type: 'enum' as const, defaultValue: 'beat', options: TRIGGER_OPTIONS,
      section: 'React', group: 'Reactivity', order: 101,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_PULSE_AMOUNT_ID,
      label: 'Pulse Amount', type: 'float' as const, defaultValue: 0.65, min: 0, max: 1, step: 0.01,
      section: 'React', group: 'Reactivity', order: 102,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_PULSE_DECAY_ID,
      label: 'Pulse Decay', type: 'float' as const, defaultValue: 0.45, min: 0, max: 1, step: 0.01,
      section: 'React', group: 'Reactivity', order: 103,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_BLACKOUT_AMOUNT_ID,
      label: 'Blackout Amount', type: 'float' as const, defaultValue: 0.25, min: 0, max: 1, step: 0.01,
      description: 'Ceiling for structural blackout authority used by later musical choreography.',
      section: 'React', group: 'Structure', order: 110,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
  ]),
  modules: Object.freeze([
    Object.freeze({
      id: CINEMA2_AFTERHOURS_MODULE_ID,
      typeId: CINEMA2_AFTERHOURS_NATIVE_MODULE_TYPE_ID,
      version: CINEMA2_AFTERHOURS_NATIVE_MODULE_VERSION,
      enabled: true,
      capabilities: Object.freeze([
        Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Instanced native beam rendering.' }),
        Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Depth-tested world beams.' }),
        Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Final shared camera matrices.' }),
      ]),
      parameters: Object.freeze({
        pattern: 'wideFan',
        autoPerformance: false,
        beamCount: 8,
        symmetry: true,
        sideLasers: false,
        topLasers: false,
        spread: 0.65,
        colorMode: 'manual',
        primaryColor: PRIMARY_COLOR,
        accentColor: ACCENT_COLOR,
        accentMix: 0.25,
        atmosphere: 0.55,
        bpmSync: true,
        masterIntensity: 0.75,
        trigger: 'beat',
        pulseAmount: 0.65,
        pulseDecay: 0.45,
        motionAmount: 0.55,
        patternChange: 'off',
        blackoutAmount: 0.25,
      }),
      parameterBindings: Object.freeze({
        pattern: cinema2Ref(CINEMA2_AFTERHOURS_PATTERN_ID),
        autoPerformance: cinema2Ref(CINEMA2_AFTERHOURS_AUTO_PERFORMANCE_ID),
        beamCount: cinema2Ref(CINEMA2_AFTERHOURS_BEAM_COUNT_ID),
        symmetry: cinema2Ref(CINEMA2_AFTERHOURS_SYMMETRY_ID),
        sideLasers: cinema2Ref(CINEMA2_AFTERHOURS_SIDE_LASERS_ID),
        topLasers: cinema2Ref(CINEMA2_AFTERHOURS_TOP_LASERS_ID),
        spread: cinema2Ref(CINEMA2_AFTERHOURS_SPREAD_ID),
        colorMode: cinema2Ref(CINEMA2_AFTERHOURS_COLOR_MODE_ID),
        primaryColor: cinema2Ref(CINEMA2_AFTERHOURS_PRIMARY_COLOR_ID),
        accentColor: cinema2Ref(CINEMA2_AFTERHOURS_ACCENT_COLOR_ID),
        accentMix: cinema2Ref(CINEMA2_AFTERHOURS_ACCENT_MIX_ID),
        atmosphere: cinema2Ref(CINEMA2_AFTERHOURS_ATMOSPHERE_ID),
        bpmSync: cinema2Ref(CINEMA2_AFTERHOURS_BPM_SYNC_ID),
        masterIntensity: cinema2Ref(CINEMA2_AFTERHOURS_MASTER_INTENSITY_ID),
        trigger: cinema2Ref(CINEMA2_AFTERHOURS_TRIGGER_ID),
        pulseAmount: cinema2Ref(CINEMA2_AFTERHOURS_PULSE_AMOUNT_ID),
        pulseDecay: cinema2Ref(CINEMA2_AFTERHOURS_PULSE_DECAY_ID),
        motionAmount: cinema2Ref(CINEMA2_AFTERHOURS_MOTION_AMOUNT_ID),
        patternChange: cinema2Ref(CINEMA2_AFTERHOURS_PATTERN_CHANGE_ID),
        blackoutAmount: cinema2Ref(CINEMA2_AFTERHOURS_BLACKOUT_AMOUNT_ID),
      }),
    }),
  ]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({
        id: AFTERHOURS_ROOT_NODE_ID,
        kind: 'group' as const,
        coordinateSpace: 'world' as const,
        visible: true,
      }),
      Object.freeze({
        id: AFTERHOURS_MODULE_NODE_ID,
        kind: 'module' as const,
        parent: cinema2Ref(AFTERHOURS_ROOT_NODE_ID),
        module: cinema2Ref(CINEMA2_AFTERHOURS_MODULE_ID),
        visible: true,
      }),
    ]),
    roots: Object.freeze([cinema2Ref(AFTERHOURS_ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([
    Object.freeze({
      id: CINEMA2_AFTERHOURS_LAYER_ID,
      label: 'Afterhours Laser Field',
      source: cinema2Ref(AFTERHOURS_ROOT_NODE_ID),
      role: 'world',
      visible: true,
      opacity: 1,
      blendMode: 'normal' as const,
      depthPolicy: 'read-write' as const,
      order: 0,
    }),
  ]),
  cameras: Object.freeze([
    Object.freeze({
      id: CINEMA2_AFTERHOURS_CAMERA_ID,
      label: 'Afterhours Stage Camera',
      projection: 'perspective' as const,
      transform: Object.freeze({ position: Object.freeze([0, 3.35, 19.5] as const) }),
      target: Object.freeze([0, 3.15, 5.6] as const),
      fovDegrees: 50,
      near: 0.1,
      far: 80,
      rig: Object.freeze({ kind: 'static' as const }),
      smoothingMs: 120,
      safety: Object.freeze({
        minFovDegrees: 32,
        maxFovDegrees: 72,
        minNear: 0.05,
        maxFar: 120,
        maxPositionOffset: Object.freeze([3, 2, 4] as const),
        maxTargetOffset: Object.freeze([2.5, 1.5, 2.5] as const),
      }),
    }),
  ]),
  environment: Object.freeze({
    backgroundColor: BACKGROUND_COLOR,
    exposure: 1,
    controls: Object.freeze({
      backgroundColor: cinema2Ref(CINEMA2_AFTERHOURS_BACKGROUND_ID),
    }),
  }),
  render: Object.freeze({
    targets: Object.freeze([
      Object.freeze({
        id: AFTERHOURS_SCENE_TARGET_ID,
        descriptor: Object.freeze({
          size: Object.freeze({ kind: 'viewport' as const }),
          colorFormat: 'rgba8' as const,
          depthFormat: 'depth24' as const,
        }),
        ownership: 'transient' as const,
      }),
    ]),
    passes: Object.freeze([
      Object.freeze({
        id: AFTERHOURS_SCENE_PASS_ID,
        kind: 'scene' as const,
        layers: Object.freeze([cinema2Ref(CINEMA2_AFTERHOURS_LAYER_ID)]),
        outputs: Object.freeze([
          Object.freeze({ id: AFTERHOURS_COLOR_OUTPUT_ID, target: cinema2Ref(AFTERHOURS_SCENE_TARGET_ID), attachment: 'color' as const }),
          Object.freeze({ id: AFTERHOURS_DEPTH_OUTPUT_ID, target: cinema2Ref(AFTERHOURS_SCENE_TARGET_ID), attachment: 'depth' as const }),
        ]),
      }),
    ]),
    outputPass: cinema2Ref(AFTERHOURS_SCENE_PASS_ID),
  }),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_AFTERHOURS_CAMERA_ID) }),
  output: Object.freeze({ renderPass: cinema2Ref(AFTERHOURS_SCENE_PASS_ID), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
})
