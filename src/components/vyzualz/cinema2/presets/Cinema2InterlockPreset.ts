import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
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
  CINEMA2_INTERLOCK_NATIVE_DEFAULTS,
  CINEMA2_INTERLOCK_NATIVE_MODULE_TYPE_ID,
  CINEMA2_INTERLOCK_NATIVE_MODULE_VERSION,
} from '../modules/Cinema2InterlockNativeModule'
import {
  CINEMA2_INTERLOCK_FUTURE_PRESET_ID,
  CINEMA2_INTERLOCK_PATTERN_IDS,
} from '../modules/interlock/Cinema2InterlockDomain'
import { getCinema2InterlockPatternDefinition } from '../modules/interlock/Cinema2InterlockPatternCatalog'
import { CINEMA2_INTERLOCK_SEGMENT_PROGRAM_IDS } from '../modules/interlock/Cinema2InterlockSegments'

export const CINEMA2_INTERLOCK_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>(CINEMA2_INTERLOCK_FUTURE_PRESET_ID)

export const CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID = cinema2StableId<Cinema2ParameterId>('interlock-pattern')
export const CINEMA2_INTERLOCK_LED_COLOR_ID = cinema2StableId<Cinema2ParameterId>('interlock-led-color')
export const CINEMA2_INTERLOCK_LED_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('interlock-led-intensity')
export const CINEMA2_INTERLOCK_ROTATION_AMOUNT_ID = cinema2StableId<Cinema2ParameterId>('interlock-rotation-amount')
export const CINEMA2_INTERLOCK_MORPH_DURATION_ID = cinema2StableId<Cinema2ParameterId>('interlock-morph-duration')
export const CINEMA2_INTERLOCK_SYMMETRY_ID = cinema2StableId<Cinema2ParameterId>('interlock-symmetry')
export const CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID = cinema2StableId<Cinema2ParameterId>('interlock-segment-pattern')
export const CINEMA2_INTERLOCK_LIT_DENSITY_ID = cinema2StableId<Cinema2ParameterId>('interlock-lit-density')
export const CINEMA2_INTERLOCK_SEGMENT_SPEED_ID = cinema2StableId<Cinema2ParameterId>('interlock-segment-speed')
export const CINEMA2_INTERLOCK_SEGMENT_FADE_ID = cinema2StableId<Cinema2ParameterId>('interlock-segment-fade')
export const CINEMA2_INTERLOCK_SEGMENT_AFTERGLOW_ID = cinema2StableId<Cinema2ParameterId>('interlock-segment-afterglow')
export const CINEMA2_INTERLOCK_UNLIT_VISIBILITY_ID = cinema2StableId<Cinema2ParameterId>('interlock-unlit-visibility')
export const CINEMA2_INTERLOCK_MIRROR_SEGMENT_DIRECTION_ID = cinema2StableId<Cinema2ParameterId>('interlock-mirror-segment-direction')

export const CINEMA2_INTERLOCK_MODULE_ID = cinema2StableId<Cinema2ModuleId>('interlock-led-rig')
export const CINEMA2_INTERLOCK_LAYER_ID = cinema2StableId<Cinema2LayerId>('interlock-led-layer')
export const CINEMA2_INTERLOCK_ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('interlock-root')
export const CINEMA2_INTERLOCK_MODULE_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('interlock-led-node')
export const CINEMA2_INTERLOCK_RENDER_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('interlock-scene-target')
export const CINEMA2_INTERLOCK_RENDER_PASS_ID = cinema2StableId<Cinema2RenderPassId>('interlock-scene-pass')
export const CINEMA2_INTERLOCK_COLOR_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('interlock-scene-color')

const BACKGROUND_COLOR = Object.freeze([0.003, 0.005, 0.009, 1] as const)
const PATTERN_OPTIONS = Object.freeze(CINEMA2_INTERLOCK_PATTERN_IDS.map(value => Object.freeze({
  value,
  label: getCinema2InterlockPatternDefinition(value).label,
})))
const SEGMENT_PATTERN_LABELS: Readonly<Record<(typeof CINEMA2_INTERLOCK_SEGMENT_PROGRAM_IDS)[number], string>> = Object.freeze({
  solid: 'Solid',
  forwardChase: 'Forward Chase',
  reverseChase: 'Reverse Chase',
  centerOut: 'Center Out',
  edgeIn: 'Edge In',
  alternating: 'Alternating',
  audioMeterFill: 'Audio Meter Fill',
  bankRipple: 'Bank Ripple',
  impactBurst: 'Impact Burst',
})
const SEGMENT_PATTERN_OPTIONS = Object.freeze(CINEMA2_INTERLOCK_SEGMENT_PROGRAM_IDS.map(value => Object.freeze({
  value,
  label: SEGMENT_PATTERN_LABELS[value],
})))

/** Production keeper: native 28-fixture screen-space segmented LED installation. */
export const CINEMA2_INTERLOCK_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_INTERLOCK_PRESET_ID,
  revision: 1,
  metadata: Object.freeze({
    name: 'Interlock',
    description: 'Native Cinema 2.0 screen-space installation built from 28 rigid segmented LED fixtures, nine illumination programs, and five pivot-safe layouts.',
    tags: Object.freeze(['interlock', 'native', 'led', 'screen-space', 'keeper']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Instanced native LED-fixture rendering.' }),
    Object.freeze({ id: 'audio.transport' as const, requirement: 'optional' as const, purpose: 'Freeze manual morph progress while host animation transport is inactive or paused.' }),
  ]),
  parameters: Object.freeze([
    Object.freeze({
      id: CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID,
      label: 'Pattern',
      type: 'enum' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.pattern,
      options: PATTERN_OPTIONS,
      section: 'Scene', group: 'Layout', order: 10,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_SYMMETRY_ID,
      label: 'Symmetry',
      type: 'boolean' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.symmetry,
      description: 'Keeps paired fixture transition direction mirrored when enabled; disabling it releases paired transition direction while preserving the rigid rig.',
      section: 'Scene', group: 'Layout', order: 11,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_LED_COLOR_ID,
      label: 'LED Color',
      type: 'color' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.ledColor,
      section: 'Design', group: 'LED', order: 20,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_LED_INTENSITY_ID,
      label: 'LED Intensity',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.ledIntensity,
      min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'LED', order: 21,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID,
      label: 'Segment Pattern',
      type: 'enum' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentPattern,
      options: SEGMENT_PATTERN_OPTIONS,
      section: 'Design', group: 'Segments', order: 22,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_LIT_DENSITY_ID,
      label: 'Lit Density',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.litDensity,
      min: 0.05, max: 1, step: 0.01,
      section: 'Design', group: 'Segments', order: 23,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_ROTATION_AMOUNT_ID,
      label: 'Rotation Amount',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.rotationAmount,
      min: 0, max: 1, step: 0.01,
      description: 'Scales the additional legal-pivot angular excursion used while morphing between authored layouts.',
      section: 'Motion', group: 'Morph', order: 30,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_MORPH_DURATION_ID,
      label: 'Morph Duration',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.morphDuration,
      min: 0.25, max: 8, step: 0.05, unit: 's',
      section: 'Motion', group: 'Morph', order: 31,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_SEGMENT_SPEED_ID,
      label: 'Segment Speed',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentSpeed,
      min: 0, max: 1, step: 0.01,
      section: 'Motion', group: 'Segments', order: 32,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_SEGMENT_FADE_ID,
      label: 'Segment Fade',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentFade,
      min: 0, max: 1, step: 0.01,
      section: 'Motion', group: 'Segments', order: 33,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_MIRROR_SEGMENT_DIRECTION_ID,
      label: 'Mirror Segment Direction',
      type: 'boolean' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.mirrorSegmentDirection,
      section: 'Motion', group: 'Segments', order: 34,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_SEGMENT_AFTERGLOW_ID,
      label: 'Segment Afterglow',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentAfterglow,
      min: 0, max: 1, step: 0.01,
      section: 'Effects', group: 'Segments', order: 40,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_UNLIT_VISIBILITY_ID,
      label: 'Unlit Visibility',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.unlitVisibility,
      min: 0, max: 0.15, step: 0.005,
      section: 'Advanced', group: 'Segments', order: 50,
      exposure: 'advanced' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
  ]),
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_INTERLOCK_MODULE_ID,
    typeId: CINEMA2_INTERLOCK_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_INTERLOCK_NATIVE_MODULE_VERSION,
    enabled: true,
    capabilities: Object.freeze([
      Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Single shared WebGL2 LED renderer for all 28 fixtures.' }),
    ]),
    parameters: Object.freeze({
      pattern: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.pattern,
      ledColor: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.ledColor,
      ledIntensity: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.ledIntensity,
      rotationAmount: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.rotationAmount,
      morphDuration: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.morphDuration,
      symmetry: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.symmetry,
      segmentPattern: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentPattern,
      litDensity: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.litDensity,
      segmentSpeed: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentSpeed,
      segmentFade: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentFade,
      segmentAfterglow: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentAfterglow,
      unlitVisibility: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.unlitVisibility,
      mirrorSegmentDirection: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.mirrorSegmentDirection,
      segmentEnergy: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentEnergy,
      segmentImpact: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentImpact,
      segmentDirectionBias: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentDirectionBias,
      segmentBankPhase: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentBankPhase,
    }),
    parameterBindings: Object.freeze({
      pattern: cinema2Ref(CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID),
      ledColor: cinema2Ref(CINEMA2_INTERLOCK_LED_COLOR_ID),
      ledIntensity: cinema2Ref(CINEMA2_INTERLOCK_LED_INTENSITY_ID),
      rotationAmount: cinema2Ref(CINEMA2_INTERLOCK_ROTATION_AMOUNT_ID),
      morphDuration: cinema2Ref(CINEMA2_INTERLOCK_MORPH_DURATION_ID),
      symmetry: cinema2Ref(CINEMA2_INTERLOCK_SYMMETRY_ID),
      segmentPattern: cinema2Ref(CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID),
      litDensity: cinema2Ref(CINEMA2_INTERLOCK_LIT_DENSITY_ID),
      segmentSpeed: cinema2Ref(CINEMA2_INTERLOCK_SEGMENT_SPEED_ID),
      segmentFade: cinema2Ref(CINEMA2_INTERLOCK_SEGMENT_FADE_ID),
      segmentAfterglow: cinema2Ref(CINEMA2_INTERLOCK_SEGMENT_AFTERGLOW_ID),
      unlitVisibility: cinema2Ref(CINEMA2_INTERLOCK_UNLIT_VISIBILITY_ID),
      mirrorSegmentDirection: cinema2Ref(CINEMA2_INTERLOCK_MIRROR_SEGMENT_DIRECTION_ID),
    }),
  })]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({
        id: CINEMA2_INTERLOCK_ROOT_NODE_ID,
        kind: 'group' as const,
        coordinateSpace: 'normalized-screen' as const,
        visible: true,
      }),
      Object.freeze({
        id: CINEMA2_INTERLOCK_MODULE_NODE_ID,
        kind: 'module' as const,
        parent: cinema2Ref(CINEMA2_INTERLOCK_ROOT_NODE_ID),
        module: cinema2Ref(CINEMA2_INTERLOCK_MODULE_ID),
        visible: true,
      }),
    ]),
    roots: Object.freeze([cinema2Ref(CINEMA2_INTERLOCK_ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([Object.freeze({
    id: CINEMA2_INTERLOCK_LAYER_ID,
    label: 'Interlock LED Rig',
    source: cinema2Ref(CINEMA2_INTERLOCK_ROOT_NODE_ID),
    role: 'installation',
    visible: true,
    opacity: 1,
    blendMode: 'normal' as const,
    depthPolicy: 'disabled' as const,
    order: 0,
  })]),
  environment: Object.freeze({
    backgroundColor: BACKGROUND_COLOR,
    exposure: 1,
  }),
  render: Object.freeze({
    targets: Object.freeze([Object.freeze({
      id: CINEMA2_INTERLOCK_RENDER_TARGET_ID,
      descriptor: Object.freeze({
        size: Object.freeze({ kind: 'viewport' as const }),
        colorFormat: 'rgba8' as const,
        depthFormat: 'none' as const,
      }),
      ownership: 'transient' as const,
    })]),
    passes: Object.freeze([Object.freeze({
      id: CINEMA2_INTERLOCK_RENDER_PASS_ID,
      kind: 'scene' as const,
      layers: Object.freeze([cinema2Ref(CINEMA2_INTERLOCK_LAYER_ID)]),
      outputs: Object.freeze([Object.freeze({
        id: CINEMA2_INTERLOCK_COLOR_OUTPUT_ID,
        target: cinema2Ref(CINEMA2_INTERLOCK_RENDER_TARGET_ID),
        attachment: 'color' as const,
      })]),
    })]),
    outputPass: cinema2Ref(CINEMA2_INTERLOCK_RENDER_PASS_ID),
  }),
  output: Object.freeze({
    renderPass: cinema2Ref(CINEMA2_INTERLOCK_RENDER_PASS_ID),
    colorSpace: 'srgb' as const,
    alphaMode: 'premultiplied' as const,
  }),
})
