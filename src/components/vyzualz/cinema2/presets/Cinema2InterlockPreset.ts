import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleId,
  type Cinema2EffectId,
  type Cinema2JsonValue,
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
  CINEMA2_INTERLOCK_BACKGROUND_PALETTE_MODES,
  CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS,
  CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_TYPE_ID,
  CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_VERSION,
} from '../modules/Cinema2InterlockLiquidLightModule'
import {
  CINEMA2_INTERLOCK_FUTURE_PRESET_ID,
  CINEMA2_INTERLOCK_PATTERN_IDS,
} from '../modules/interlock/Cinema2InterlockDomain'
import { getCinema2InterlockPatternDefinition } from '../modules/interlock/Cinema2InterlockPatternCatalog'
import { CINEMA2_INTERLOCK_SEGMENT_PROGRAM_IDS } from '../modules/interlock/Cinema2InterlockSegments'
import {
  CINEMA2_INTERLOCK_PATTERN_CHANGE_IDS,
  CINEMA2_INTERLOCK_TRIGGER_IDS,
} from '../modules/interlock/Cinema2InterlockShowPlanner'
import { CINEMA2_BLOOM_EFFECT_TYPE_ID, CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID } from '../effects/Cinema2BuiltinEffects'

export const CINEMA2_INTERLOCK_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>(CINEMA2_INTERLOCK_FUTURE_PRESET_ID)

export const CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID = cinema2StableId<Cinema2ParameterId>('interlock-pattern')
export const CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID = cinema2StableId<Cinema2ParameterId>('interlock-auto-performance')
export const CINEMA2_INTERLOCK_PATTERN_CHANGE_ID = cinema2StableId<Cinema2ParameterId>('interlock-pattern-change')
export const CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID = cinema2StableId<Cinema2ParameterId>('interlock-master-reactivity')
export const CINEMA2_INTERLOCK_BASS_ROTATION_ID = cinema2StableId<Cinema2ParameterId>('interlock-bass-rotation')
export const CINEMA2_INTERLOCK_SEGMENT_REACTIVITY_ID = cinema2StableId<Cinema2ParameterId>('interlock-segment-reactivity')
export const CINEMA2_INTERLOCK_TRANSIENT_PULSE_ID = cinema2StableId<Cinema2ParameterId>('interlock-transient-pulse')
export const CINEMA2_INTERLOCK_HIGH_SHIMMER_ID = cinema2StableId<Cinema2ParameterId>('interlock-high-shimmer')
export const CINEMA2_INTERLOCK_BUILD_TENSION_ID = cinema2StableId<Cinema2ParameterId>('interlock-build-tension')
export const CINEMA2_INTERLOCK_VOCAL_RESTRAINT_ID = cinema2StableId<Cinema2ParameterId>('interlock-vocal-restraint')
export const CINEMA2_INTERLOCK_TRIGGER_ID = cinema2StableId<Cinema2ParameterId>('interlock-trigger')
export const CINEMA2_INTERLOCK_LED_COLOR_ID = cinema2StableId<Cinema2ParameterId>('interlock-led-color')
export const CINEMA2_INTERLOCK_LED_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('interlock-led-intensity')
export const CINEMA2_INTERLOCK_ROTATION_AMOUNT_ID = cinema2StableId<Cinema2ParameterId>('interlock-rotation-amount')
export const CINEMA2_INTERLOCK_MORPH_DURATION_ID = cinema2StableId<Cinema2ParameterId>('interlock-morph-duration')
export const CINEMA2_INTERLOCK_SYMMETRY_ID = cinema2StableId<Cinema2ParameterId>('interlock-symmetry')
export const CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID = cinema2StableId<Cinema2ParameterId>('interlock-segment-pattern')
export const CINEMA2_INTERLOCK_LIT_DENSITY_ID = cinema2StableId<Cinema2ParameterId>('interlock-lit-density')
export const CINEMA2_INTERLOCK_SEGMENT_SPEED_ID = cinema2StableId<Cinema2ParameterId>('interlock-segment-speed')
export const CINEMA2_INTERLOCK_SEGMENT_FADE_ID = cinema2StableId<Cinema2ParameterId>('interlock-segment-fade')
export const CINEMA2_INTERLOCK_BANK_STAGGER_ID = cinema2StableId<Cinema2ParameterId>('interlock-bank-stagger')
export const CINEMA2_INTERLOCK_SEGMENT_AFTERGLOW_ID = cinema2StableId<Cinema2ParameterId>('interlock-segment-afterglow')
export const CINEMA2_INTERLOCK_UNLIT_VISIBILITY_ID = cinema2StableId<Cinema2ParameterId>('interlock-unlit-visibility')
export const CINEMA2_INTERLOCK_MIRROR_SEGMENT_DIRECTION_ID = cinema2StableId<Cinema2ParameterId>('interlock-mirror-segment-direction')
export const CINEMA2_INTERLOCK_BACKGROUND_PALETTE_MODE_ID = cinema2StableId<Cinema2ParameterId>('interlock-background-palette-mode')
export const CINEMA2_INTERLOCK_BACKGROUND_COLOR_ID = cinema2StableId<Cinema2ParameterId>('interlock-background-color')
export const CINEMA2_INTERLOCK_BACKGROUND_ACCENT_ID = cinema2StableId<Cinema2ParameterId>('interlock-background-accent')
export const CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID = cinema2StableId<Cinema2ParameterId>('interlock-background-atmosphere')
export const CINEMA2_INTERLOCK_BACKGROUND_FLOW_ID = cinema2StableId<Cinema2ParameterId>('interlock-background-flow')
export const CINEMA2_INTERLOCK_CENTER_GLOW_ID = cinema2StableId<Cinema2ParameterId>('interlock-center-glow')
export const CINEMA2_INTERLOCK_EDGE_DARKNESS_ID = cinema2StableId<Cinema2ParameterId>('interlock-edge-darkness')
export const CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('interlock-effects-intensity')
export const CINEMA2_INTERLOCK_RESET_TRAILS_ID = cinema2StableId<Cinema2ParameterId>('interlock-reset-trails')

export const CINEMA2_INTERLOCK_MODULE_ID = cinema2StableId<Cinema2ModuleId>('interlock-led-rig')
export const CINEMA2_INTERLOCK_BACKGROUND_MODULE_ID = cinema2StableId<Cinema2ModuleId>('interlock-liquid-light')
export const CINEMA2_INTERLOCK_LAYER_ID = cinema2StableId<Cinema2LayerId>('interlock-led-layer')
export const CINEMA2_INTERLOCK_BACKGROUND_LAYER_ID = cinema2StableId<Cinema2LayerId>('interlock-background-layer')
export const CINEMA2_INTERLOCK_ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('interlock-root')
export const CINEMA2_INTERLOCK_MODULE_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('interlock-led-node')
export const CINEMA2_INTERLOCK_BACKGROUND_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('interlock-background-node')
export const CINEMA2_INTERLOCK_RENDER_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('interlock-scene-target')
export const CINEMA2_INTERLOCK_TRAILS_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('interlock-trails-target')
export const CINEMA2_INTERLOCK_RENDER_PASS_ID = cinema2StableId<Cinema2RenderPassId>('interlock-scene-pass')
export const CINEMA2_INTERLOCK_TRAILS_PASS_ID = cinema2StableId<Cinema2RenderPassId>('interlock-trails-pass')
export const CINEMA2_INTERLOCK_BLOOM_PASS_ID = cinema2StableId<Cinema2RenderPassId>('interlock-bloom-pass')
export const CINEMA2_INTERLOCK_COLOR_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('interlock-scene-color')
export const CINEMA2_INTERLOCK_TRAILS_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('interlock-trails-color')
export const CINEMA2_INTERLOCK_TRAILS_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('interlock-trails-source')
export const CINEMA2_INTERLOCK_BLOOM_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('interlock-bloom-source')
export const CINEMA2_INTERLOCK_TRAILS_EFFECT_ID = cinema2StableId<Cinema2EffectId>('interlock-feedback-trails')
export const CINEMA2_INTERLOCK_BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('interlock-bloom')

const choreographyRuleId = (id: string) => cinema2StableId<Cinema2ChoreographyRuleId>(id)
const choreographyActionId = (id: string) => cinema2StableId<Cinema2ChoreographyActionId>(id)

const moduleContinuousAction = (id: string, property: string) => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_INTERLOCK_MODULE_ID), property }),
  operation: 'replace' as const,
  value: 1,
})

const backgroundContinuousAction = (id: string, property: string) => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_INTERLOCK_BACKGROUND_MODULE_ID), property }),
  operation: 'replace' as const,
  value: 1,
})

const moduleEnvelopeAction = (id: string, property: string, hold: number, release: number, value = 1) => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_INTERLOCK_MODULE_ID), property }),
  operation: 'envelope' as const,
  value,
  composition: 'replace' as const,
  envelope: Object.freeze({ attack: 0, hold, release, unit: 'beats' as const }),
  cooldownBeats: 0.05,
  retrigger: 'restart' as const,
})

const backgroundEnvelopeAction = (id: string, property: string, hold: number, release: number, value = 1) => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_INTERLOCK_BACKGROUND_MODULE_ID), property }),
  operation: 'envelope' as const,
  value,
  composition: 'replace' as const,
  envelope: Object.freeze({ attack: 0, hold, release, unit: 'beats' as const }),
  cooldownBeats: 0.05,
  retrigger: 'restart' as const,
})

const effectContinuousAddAction = (id: string, effectId: Cinema2EffectId, property: string, value: Cinema2JsonValue) => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'effect' as const, ref: cinema2Ref(effectId), property }),
  operation: 'add' as const,
  value,
})

const effectEnvelopeAddAction = (id: string, effectId: Cinema2EffectId, property: string, value: number, hold: number, release: number) => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'effect' as const, ref: cinema2Ref(effectId), property }),
  operation: 'envelope' as const,
  value,
  composition: 'add' as const,
  envelope: Object.freeze({ attack: 0.01, hold, release, unit: 'beats' as const }),
  cooldownBeats: 0.05,
  retrigger: 'restart' as const,
})

const resetTrailsAction = (id: string) => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'parameter' as const, ref: cinema2Ref(CINEMA2_INTERLOCK_RESET_TRAILS_ID) }),
  operation: 'trigger' as const,
})

const ENVIRONMENT_CLEAR = Object.freeze([0, 0, 0, 1] as const)
const PALETTE_MODE_OPTIONS = Object.freeze(CINEMA2_INTERLOCK_BACKGROUND_PALETTE_MODES.map(value => Object.freeze({
  value,
  label: value === 'auto' ? 'Auto from LED' : 'Manual',
})))
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
const PATTERN_CHANGE_LABELS: Readonly<Record<(typeof CINEMA2_INTERLOCK_PATTERN_CHANGE_IDS)[number], string>> = Object.freeze({
  off: 'Off',
  '8beats': '8 Beats',
  '16beats': '16 Beats',
  '32beats': '32 Beats',
  phrase: 'Phrase',
  section: 'Section',
})
const PATTERN_CHANGE_OPTIONS = Object.freeze(CINEMA2_INTERLOCK_PATTERN_CHANGE_IDS.map(value => Object.freeze({ value, label: PATTERN_CHANGE_LABELS[value] })))
const TRIGGER_LABELS: Readonly<Record<(typeof CINEMA2_INTERLOCK_TRIGGER_IDS)[number], string>> = Object.freeze({
  auto: 'Auto', beat: 'Beat', kick: 'Kick', snare: 'Snare', downbeat: 'Downbeat', bar: 'Bar', phrase: 'Phrase',
})
const TRIGGER_OPTIONS = Object.freeze(CINEMA2_INTERLOCK_TRIGGER_IDS.map(value => Object.freeze({ value, label: TRIGGER_LABELS[value] })))

/** Production keeper: native 28-fixture screen-space segmented LED installation with liquid-light atmosphere and engine-owned finishing. */
export const CINEMA2_INTERLOCK_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_INTERLOCK_PRESET_ID,
  revision: 3,
  metadata: Object.freeze({
    name: 'Interlock',
    description: 'Native Cinema 2.0 screen-space installation built from 28 rigid segmented LED fixtures over a restrained flowing liquid-light atmosphere with engine-owned trails and bloom.',
    tags: Object.freeze(['interlock', 'native', 'led', 'liquid-light', 'screen-space', 'keeper']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native liquid-light and instanced LED rendering.' }),
    Object.freeze({ id: 'audio.transport' as const, requirement: 'optional' as const, purpose: 'Canonical transport and synchronized timing state.' }),
    Object.freeze({ id: 'audio.bands' as const, requirement: 'optional' as const, purpose: 'Sub, bass, high, and air performance detail.' }),
    Object.freeze({ id: 'audio.features' as const, requirement: 'optional' as const, purpose: 'Energy and spectral-flow performance detail.' }),
    Object.freeze({ id: 'music.rhythm-events' as const, requirement: 'optional' as const, purpose: 'Kick and snare event accents.' }),
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'Beat identity and deterministic fallback cadence.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Broad alignment accents.' }),
    Object.freeze({ id: 'music.bar' as const, requirement: 'optional' as const, purpose: 'Small bank and segment variation boundaries.' }),
    Object.freeze({ id: 'music.phrase' as const, requirement: 'optional' as const, purpose: 'Preferred layout-transition boundaries.' }),
    Object.freeze({ id: 'music.section' as const, requirement: 'optional' as const, purpose: 'Major layout-family changes.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'Four-Way Vortex hero reveal and bounded impact.' }),
    Object.freeze({ id: 'music.vocal-presence' as const, requirement: 'optional' as const, purpose: 'Reduce clutter only when vocal presence is available.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'Phase-aware macro performance meaning.' }),
    Object.freeze({ id: 'render.history' as const, requirement: 'optional' as const, purpose: 'Feedback trails when render history is available.' }),
  ]),
  parameters: Object.freeze([
    Object.freeze({
      id: CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID,
      label: 'Pattern',
      type: 'enum' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.pattern,
      options: PATTERN_OPTIONS,
      description: 'Choosing a Pattern takes manual layout authority and turns Auto Performance off.',
      metadata: Object.freeze({ userEditSetParameters: Object.freeze({ [CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID]: false }) }),
      section: 'Scene', group: 'Layout', designParentGroup: 'design' as const, order: 10,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID,
      label: 'Auto Performance',
      type: 'boolean' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.autoPerformance,
      description: 'Lets Interlock choose deterministic layouts and segment programs from shared Audio Intelligence and Visual Director meaning.',
      section: 'Scene', group: 'Performance', designParentGroup: 'master-controls' as const, order: 11,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_PATTERN_CHANGE_ID,
      label: 'Pattern Change',
      type: 'enum' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.patternChange,
      options: PATTERN_CHANGE_OPTIONS,
      section: 'Scene', group: 'Layout', designParentGroup: 'design' as const, order: 12,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_SYMMETRY_ID,
      label: 'Symmetry',
      type: 'boolean' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.symmetry,
      description: 'Keeps paired fixture transition direction mirrored when enabled; disabling it releases paired transition direction while preserving the rigid rig.',
      section: 'Scene', group: 'Layout', designParentGroup: 'design' as const, order: 13,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_LED_COLOR_ID,
      label: 'LED Color',
      type: 'color' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.ledColor,
      section: 'Design', group: 'LED', designParentGroup: 'palette' as const, order: 20,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_LED_INTENSITY_ID,
      label: 'LED Intensity',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.ledIntensity,
      min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'LED', designParentGroup: 'master-controls' as const, order: 21,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID,
      label: 'Segment Pattern',
      type: 'enum' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentPattern,
      options: SEGMENT_PATTERN_OPTIONS,
      description: 'Choosing a Segment Pattern takes manual program authority and turns Auto Performance off.',
      metadata: Object.freeze({ userEditSetParameters: Object.freeze({ [CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID]: false }) }),
      section: 'Design', group: 'Segments', designParentGroup: 'design' as const, order: 22,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_LIT_DENSITY_ID,
      label: 'Lit Density',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.litDensity,
      min: 0.05, max: 1, step: 0.01,
      section: 'Design', group: 'Segments', designParentGroup: 'design' as const, order: 23,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_BACKGROUND_PALETTE_MODE_ID,
      label: 'Background Palette',
      type: 'enum' as const,
      defaultValue: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.paletteMode,
      options: PALETTE_MODE_OPTIONS,
      section: 'Design', group: 'Atmosphere', designParentGroup: 'palette' as const, order: 24,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_BACKGROUND_COLOR_ID,
      label: 'Background Color',
      type: 'color' as const,
      defaultValue: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.backgroundColor,
      visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: CINEMA2_INTERLOCK_BACKGROUND_PALETTE_MODE_ID, value: 'manual' })]),
      section: 'Design', group: 'Atmosphere', designParentGroup: 'palette' as const, order: 25,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_BACKGROUND_ACCENT_ID,
      label: 'Background Accent',
      type: 'color' as const,
      defaultValue: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.backgroundAccent,
      visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: CINEMA2_INTERLOCK_BACKGROUND_PALETTE_MODE_ID, value: 'manual' })]),
      section: 'Design', group: 'Atmosphere', designParentGroup: 'palette' as const, order: 26,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID,
      label: 'Background Atmosphere',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.atmosphere,
      min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Atmosphere', designParentGroup: 'effects' as const, order: 27,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_CENTER_GLOW_ID,
      label: 'Center Glow',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.centerGlow,
      min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Atmosphere', designParentGroup: 'effects' as const, order: 28,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_EDGE_DARKNESS_ID,
      label: 'Edge Darkness',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.edgeDarkness,
      min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Atmosphere', designParentGroup: 'effects' as const, order: 29,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_ROTATION_AMOUNT_ID,
      label: 'Rotation Amount',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.rotationAmount,
      min: 0, max: 1, step: 0.01,
      description: 'Scales the additional legal-pivot angular excursion used while morphing between authored layouts.',
      section: 'Motion', group: 'Motion', designParentGroup: 'design' as const, order: 30,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_MORPH_DURATION_ID,
      label: 'Morph Duration',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.morphDuration,
      min: 0.25, max: 8, step: 0.05, unit: 's',
      section: 'Motion', group: 'Motion', designParentGroup: 'design' as const, order: 31,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_SEGMENT_SPEED_ID,
      label: 'Segment Speed',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentSpeed,
      min: 0, max: 1, step: 0.01,
      section: 'Motion', group: 'Segments', designParentGroup: 'design' as const, order: 32,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_SEGMENT_FADE_ID,
      label: 'Segment Fade',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentFade,
      min: 0, max: 1, step: 0.01,
      section: 'Motion', group: 'Segments', designParentGroup: 'design' as const, order: 33,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_BANK_STAGGER_ID,
      label: 'Bank Stagger',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentBankPhase,
      min: 0, max: 1, step: 0.01,
      description: 'Scales deterministic inter-bank timing: 0 moves banks together and 1 uses the full authored bank-delay spacing for layout morphs and Bank Ripple.',
      section: 'Motion', group: 'Segments', designParentGroup: 'design' as const, order: 34,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_MIRROR_SEGMENT_DIRECTION_ID,
      label: 'Mirror Segment Direction',
      type: 'boolean' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.mirrorSegmentDirection,
      section: 'Motion', group: 'Segments', designParentGroup: 'design' as const, order: 35,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_BACKGROUND_FLOW_ID,
      label: 'Background Flow',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.flow,
      min: 0, max: 1, step: 0.01,
      section: 'Motion', group: 'Atmosphere', designParentGroup: 'effects' as const, order: 36,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID, label: 'Master Reactivity', type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.masterReactivity, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Performance', designParentGroup: 'master-controls' as const, order: 60, exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_BASS_ROTATION_ID, label: 'Bass Rotation', type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.bassRotation, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Motion', designParentGroup: 'master-controls' as const, order: 61, exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_SEGMENT_REACTIVITY_ID, label: 'Segment Reactivity', type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentReactivity, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Segments', designParentGroup: 'master-controls' as const, order: 62, exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_TRANSIENT_PULSE_ID, label: 'Transient Pulse', type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.transientPulse, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Events', designParentGroup: 'effects' as const, order: 63, exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_HIGH_SHIMMER_ID, label: 'High Shimmer', type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.highShimmer, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Segments', designParentGroup: 'effects' as const, order: 64, exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_BUILD_TENSION_ID, label: 'Build Tension', type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.buildTension, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Motion', designParentGroup: 'master-controls' as const, order: 65, exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_VOCAL_RESTRAINT_ID, label: 'Vocal Restraint', type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.vocalRestraint, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Space', designParentGroup: 'master-controls' as const, order: 66, exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_TRIGGER_ID, label: 'Trigger', type: 'enum' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.trigger, options: TRIGGER_OPTIONS,
      section: 'Design', group: 'Events', designParentGroup: 'effects' as const, order: 67, exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID,
      label: 'Effects Intensity',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.effectsIntensity,
      min: 0, max: 1, step: 0.01,
      description: 'Master finishing strength for feedback trails, bloom, LED afterglow, and bounded impact enhancement.',
      section: 'Effects', group: 'Master', designParentGroup: 'effects' as const, order: 40,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_SEGMENT_AFTERGLOW_ID,
      label: 'Segment Afterglow',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentAfterglow,
      min: 0, max: 1, step: 0.01,
      section: 'Effects', group: 'Segments', designParentGroup: 'effects' as const, order: 41,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_RESET_TRAILS_ID,
      label: 'Reset Trails',
      type: 'trigger' as const,
      section: 'Effects', group: 'Trails', designParentGroup: 'effects' as const, order: 49,
      exposure: 'hidden' as const, persistence: 'runtime-only' as const, reset: 'none' as const,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_UNLIT_VISIBILITY_ID,
      label: 'Unlit Visibility',
      type: 'float' as const,
      defaultValue: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.unlitVisibility,
      min: 0, max: 0.15, step: 0.005,
      section: 'Advanced', group: 'Segments', designParentGroup: 'design' as const, order: 50,
      exposure: 'advanced' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
  ]),
  modules: Object.freeze([
    Object.freeze({
      id: CINEMA2_INTERLOCK_BACKGROUND_MODULE_ID,
      typeId: CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_TYPE_ID,
      version: CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_VERSION,
      enabled: true,
      capabilities: Object.freeze([
        Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Dedicated fullscreen liquid-light atmosphere.' }),
      ]),
      parameters: Object.freeze({
        paletteMode: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.paletteMode,
        ledColor: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.ledColor,
        backgroundColor: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.backgroundColor,
        backgroundAccent: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.backgroundAccent,
        atmosphere: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.atmosphere,
        flow: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.flow,
        centerGlow: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.centerGlow,
        edgeDarkness: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.edgeDarkness,
        backgroundEnergy: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.backgroundEnergy,
        backgroundBassExpansion: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.backgroundBassExpansion,
        backgroundFlux: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.backgroundFlux,
        backgroundBuild: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.backgroundBuild,
        backgroundDropImpact: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.backgroundDropImpact,
        backgroundVocalRestraint: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.backgroundVocalRestraint,
      }),
      parameterBindings: Object.freeze({
        paletteMode: cinema2Ref(CINEMA2_INTERLOCK_BACKGROUND_PALETTE_MODE_ID),
        ledColor: cinema2Ref(CINEMA2_INTERLOCK_LED_COLOR_ID),
        backgroundColor: cinema2Ref(CINEMA2_INTERLOCK_BACKGROUND_COLOR_ID),
        backgroundAccent: cinema2Ref(CINEMA2_INTERLOCK_BACKGROUND_ACCENT_ID),
        atmosphere: cinema2Ref(CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID),
        flow: cinema2Ref(CINEMA2_INTERLOCK_BACKGROUND_FLOW_ID),
        centerGlow: cinema2Ref(CINEMA2_INTERLOCK_CENTER_GLOW_ID),
        edgeDarkness: cinema2Ref(CINEMA2_INTERLOCK_EDGE_DARKNESS_ID),
      }),
    }),
    Object.freeze({
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
        effectsIntensity: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.effectsIntensity,
        autoPerformance: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.autoPerformance,
        patternChange: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.patternChange,
        masterReactivity: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.masterReactivity,
        bassRotation: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.bassRotation,
        segmentReactivity: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentReactivity,
        transientPulse: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.transientPulse,
        highShimmer: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.highShimmer,
        buildTension: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.buildTension,
        vocalRestraint: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.vocalRestraint,
        trigger: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.trigger,
        directorIntensity: 0, directorMomentum: 0, directorBuild: 0, directorImpact: 0, directorVariation: 0,
        subEnergy: 0, bassEnergy: 0, overallEnergy: 0, spectralFlux: 0, highEnergy: 0, airEnergy: 0, vocalPresence: 0,
        kickAccent: 0, snareAccent: 0, downbeatAccent: 0, barAccent: 0, phraseAccent: 0, sectionAccent: 0, dropAccent: 0,
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
        segmentBankPhase: cinema2Ref(CINEMA2_INTERLOCK_BANK_STAGGER_ID),
        segmentAfterglow: cinema2Ref(CINEMA2_INTERLOCK_SEGMENT_AFTERGLOW_ID),
        unlitVisibility: cinema2Ref(CINEMA2_INTERLOCK_UNLIT_VISIBILITY_ID),
        mirrorSegmentDirection: cinema2Ref(CINEMA2_INTERLOCK_MIRROR_SEGMENT_DIRECTION_ID),
        effectsIntensity: cinema2Ref(CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID),
        autoPerformance: cinema2Ref(CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID),
        patternChange: cinema2Ref(CINEMA2_INTERLOCK_PATTERN_CHANGE_ID),
        masterReactivity: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID),
        bassRotation: cinema2Ref(CINEMA2_INTERLOCK_BASS_ROTATION_ID),
        segmentReactivity: cinema2Ref(CINEMA2_INTERLOCK_SEGMENT_REACTIVITY_ID),
        transientPulse: cinema2Ref(CINEMA2_INTERLOCK_TRANSIENT_PULSE_ID),
        highShimmer: cinema2Ref(CINEMA2_INTERLOCK_HIGH_SHIMMER_ID),
        buildTension: cinema2Ref(CINEMA2_INTERLOCK_BUILD_TENSION_ID),
        vocalRestraint: cinema2Ref(CINEMA2_INTERLOCK_VOCAL_RESTRAINT_ID),
        trigger: cinema2Ref(CINEMA2_INTERLOCK_TRIGGER_ID),
      }),
    }),
  ]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({
        id: CINEMA2_INTERLOCK_ROOT_NODE_ID,
        kind: 'group' as const,
        coordinateSpace: 'normalized-screen' as const,
        visible: true,
      }),
      Object.freeze({
        id: CINEMA2_INTERLOCK_BACKGROUND_NODE_ID,
        kind: 'module' as const,
        parent: cinema2Ref(CINEMA2_INTERLOCK_ROOT_NODE_ID),
        module: cinema2Ref(CINEMA2_INTERLOCK_BACKGROUND_MODULE_ID),
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
  layers: Object.freeze([
    Object.freeze({
      id: CINEMA2_INTERLOCK_BACKGROUND_LAYER_ID,
      label: 'Interlock Liquid Light',
      source: cinema2Ref(CINEMA2_INTERLOCK_BACKGROUND_NODE_ID),
      role: 'background',
      visible: true,
      opacity: 1,
      blendMode: 'normal' as const,
      depthPolicy: 'disabled' as const,
      order: 0,
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_LAYER_ID,
      label: 'Interlock LED Rig',
      source: cinema2Ref(CINEMA2_INTERLOCK_MODULE_NODE_ID),
      role: 'installation',
      visible: true,
      opacity: 1,
      blendMode: 'normal' as const,
      depthPolicy: 'disabled' as const,
      order: 1,
    }),
  ]),
  choreography: Object.freeze({
    rules: Object.freeze([
      Object.freeze({ id: choreographyRuleId('interlock-director-intensity'), priority: 20, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.intensity' as const, smoothingMs: 100 }), actions: Object.freeze([moduleContinuousAction('interlock-director-intensity-module', 'directorIntensity'), backgroundContinuousAction('interlock-director-intensity-background', 'backgroundEnergy'), effectContinuousAddAction('interlock-director-intensity-bloom', CINEMA2_INTERLOCK_BLOOM_EFFECT_ID, 'intensity', 0.12)]) }),
      Object.freeze({ id: choreographyRuleId('interlock-director-momentum'), priority: 21, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.momentum' as const, smoothingMs: 85 }), actions: Object.freeze([moduleContinuousAction('interlock-director-momentum-module', 'directorMomentum')]) }),
      Object.freeze({ id: choreographyRuleId('interlock-director-build'), priority: 22, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 115 }), actions: Object.freeze([moduleContinuousAction('interlock-director-build-module', 'directorBuild'), backgroundContinuousAction('interlock-director-build-background', 'backgroundBuild'), effectContinuousAddAction('interlock-build-trails-mix', CINEMA2_INTERLOCK_TRAILS_EFFECT_ID, 'mix', 0.10), effectContinuousAddAction('interlock-build-trails-persistence', CINEMA2_INTERLOCK_TRAILS_EFFECT_ID, 'persistence', 0.08)]) }),
      Object.freeze({ id: choreographyRuleId('interlock-director-impact'), priority: 23, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.impact' as const, smoothingMs: 38 }), actions: Object.freeze([moduleContinuousAction('interlock-director-impact-module', 'directorImpact')]) }),
      Object.freeze({ id: choreographyRuleId('interlock-director-variation'), priority: 24, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.variation' as const, smoothingMs: 140 }), actions: Object.freeze([moduleContinuousAction('interlock-director-variation-module', 'directorVariation')]) }),
      Object.freeze({ id: choreographyRuleId('interlock-sub'), priority: 25, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.bands' as const, path: 'audio.bands.sub' as const, smoothingMs: 80 }), actions: Object.freeze([moduleContinuousAction('interlock-sub-module', 'subEnergy'), backgroundContinuousAction('interlock-sub-background', 'backgroundBassExpansion')]) }),
      Object.freeze({ id: choreographyRuleId('interlock-bass'), priority: 26, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.bands' as const, path: 'audio.bands.bass' as const, smoothingMs: 85 }), actions: Object.freeze([moduleContinuousAction('interlock-bass-module', 'bassEnergy')]) }),
      Object.freeze({ id: choreographyRuleId('interlock-energy'), priority: 27, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.features' as const, path: 'audio.features.overallEnergy' as const, smoothingMs: 95 }), actions: Object.freeze([moduleContinuousAction('interlock-energy-module', 'overallEnergy')]) }),
      Object.freeze({ id: choreographyRuleId('interlock-flux'), priority: 28, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.features' as const, path: 'audio.features.spectralFlux' as const, smoothingMs: 105 }), actions: Object.freeze([moduleContinuousAction('interlock-flux-module', 'spectralFlux'), backgroundContinuousAction('interlock-flux-background', 'backgroundFlux')]) }),
      Object.freeze({ id: choreographyRuleId('interlock-high'), priority: 29, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.bands' as const, path: 'audio.bands.high' as const, smoothingMs: 150 }), actions: Object.freeze([moduleContinuousAction('interlock-high-module', 'highEnergy')]) }),
      Object.freeze({ id: choreographyRuleId('interlock-air'), priority: 30, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.bands' as const, path: 'audio.bands.air' as const, smoothingMs: 170 }), actions: Object.freeze([moduleContinuousAction('interlock-air-module', 'airEnergy')]) }),
      Object.freeze({ id: choreographyRuleId('interlock-vocal-restraint'), priority: 31, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'music.vocal-presence' as const, path: 'audio.features.vocalPresence' as const, smoothingMs: 150 }), actions: Object.freeze([moduleContinuousAction('interlock-vocal-module', 'vocalPresence'), backgroundContinuousAction('interlock-vocal-background', 'backgroundVocalRestraint'), effectContinuousAddAction('interlock-vocal-trails-mix', CINEMA2_INTERLOCK_TRAILS_EFFECT_ID, 'mix', -0.10), effectContinuousAddAction('interlock-vocal-trails-persistence', CINEMA2_INTERLOCK_TRAILS_EFFECT_ID, 'persistence', -0.06)]) }),
      Object.freeze({ id: choreographyRuleId('interlock-kick'), priority: 40, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'kick' as const, capability: 'music.rhythm-events' as const }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]), actions: Object.freeze([moduleEnvelopeAction('interlock-kick-envelope', 'kickAccent', 0.02, 0.30)]) }),
      Object.freeze({ id: choreographyRuleId('interlock-snare'), priority: 41, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'snare' as const, capability: 'music.rhythm-events' as const }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]), actions: Object.freeze([moduleEnvelopeAction('interlock-snare-envelope', 'snareAccent', 0.04, 0.42)]) }),
      Object.freeze({ id: choreographyRuleId('interlock-downbeat'), priority: 42, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'downbeat' as const, capability: 'music.downbeat' as const }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]), actions: Object.freeze([moduleEnvelopeAction('interlock-downbeat-envelope', 'downbeatAccent', 0.08, 0.45)]) }),
      Object.freeze({ id: choreographyRuleId('interlock-bar'), priority: 43, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'bar' as const, capability: 'music.bar' as const }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]), actions: Object.freeze([moduleEnvelopeAction('interlock-bar-envelope', 'barAccent', 0.02, 0.25, 0.45)]) }),
      Object.freeze({ id: choreographyRuleId('interlock-phrase'), priority: 50, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'phrase' as const, capability: 'music.phrase' as const }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]), actions: Object.freeze([moduleEnvelopeAction('interlock-phrase-envelope', 'phraseAccent', 0.12, 0.70, 0.70)]) }),
      Object.freeze({ id: choreographyRuleId('interlock-section'), priority: 60, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'section-change' as const, capability: 'music.section' as const }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]), actions: Object.freeze([moduleEnvelopeAction('interlock-section-envelope', 'sectionAccent', 0.15, 0.80), resetTrailsAction('interlock-section-reset-trails')]) }),
      Object.freeze({ id: choreographyRuleId('interlock-drop'), priority: 70, strengthParameter: cinema2Ref(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID), source: Object.freeze({ signal: 'drop' as const, capability: 'music.drop' as const }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]), actions: Object.freeze([moduleEnvelopeAction('interlock-drop-envelope', 'dropAccent', 0.10, 0.80), backgroundEnvelopeAction('interlock-drop-background-envelope', 'backgroundDropImpact', 0.08, 0.60), effectEnvelopeAddAction('interlock-drop-trails-envelope', CINEMA2_INTERLOCK_TRAILS_EFFECT_ID, 'mix', 0.16, 0.08, 0.50), effectEnvelopeAddAction('interlock-drop-bloom-envelope', CINEMA2_INTERLOCK_BLOOM_EFFECT_ID, 'intensity', 0.20, 0.08, 0.45), resetTrailsAction('interlock-drop-reset-trails')]) }),
    ]),
  }),
  environment: Object.freeze({
    backgroundColor: ENVIRONMENT_CLEAR,
    exposure: 1,
  }),
  effects: Object.freeze([
    Object.freeze({
      id: CINEMA2_INTERLOCK_TRAILS_EFFECT_ID,
      typeId: CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 0,
      scope: 'output' as const,
      quality: Object.freeze({ min: 'low' as const }),
      parameters: Object.freeze({
        mix: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.effectsIntensity,
        persistence: 0.76,
        transportAware: true,
      }),
      parameterBindings: Object.freeze({
        mix: cinema2Ref(CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID),
      }),
      actionBindings: Object.freeze({ reset: cinema2Ref(CINEMA2_INTERLOCK_RESET_TRAILS_ID) }),
    }),
    Object.freeze({
      id: CINEMA2_INTERLOCK_BLOOM_EFFECT_ID,
      typeId: CINEMA2_BLOOM_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 1,
      scope: 'output' as const,
      quality: Object.freeze({ min: 'low' as const }),
      parameters: Object.freeze({
        mix: 0.38,
        threshold: 0.64,
        radius: 2.2,
        intensity: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.effectsIntensity,
      }),
      parameterBindings: Object.freeze({
        intensity: cinema2Ref(CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID),
      }),
    }),
  ]),
  render: Object.freeze({
    targets: Object.freeze([
      Object.freeze({
        id: CINEMA2_INTERLOCK_RENDER_TARGET_ID,
        descriptor: Object.freeze({
          size: Object.freeze({ kind: 'viewport' as const }),
          colorFormat: 'rgba8' as const,
          depthFormat: 'none' as const,
        }),
        ownership: 'transient' as const,
      }),
      Object.freeze({
        id: CINEMA2_INTERLOCK_TRAILS_TARGET_ID,
        descriptor: Object.freeze({
          size: Object.freeze({ kind: 'viewport' as const }),
          colorFormat: 'rgba8' as const,
          depthFormat: 'none' as const,
        }),
        ownership: 'transient' as const,
      }),
    ]),
    passes: Object.freeze([
      Object.freeze({
        id: CINEMA2_INTERLOCK_RENDER_PASS_ID,
        kind: 'scene' as const,
        layers: Object.freeze([
          cinema2Ref(CINEMA2_INTERLOCK_BACKGROUND_LAYER_ID),
          cinema2Ref(CINEMA2_INTERLOCK_LAYER_ID),
        ]),
        outputs: Object.freeze([Object.freeze({
          id: CINEMA2_INTERLOCK_COLOR_OUTPUT_ID,
          target: cinema2Ref(CINEMA2_INTERLOCK_RENDER_TARGET_ID),
          attachment: 'color' as const,
        })]),
      }),
      Object.freeze({
        id: CINEMA2_INTERLOCK_TRAILS_PASS_ID,
        kind: 'fullscreen' as const,
        effect: cinema2Ref(CINEMA2_INTERLOCK_TRAILS_EFFECT_ID),
        inputs: Object.freeze([Object.freeze({
          id: CINEMA2_INTERLOCK_TRAILS_INPUT_ID,
          source: Object.freeze({ pass: cinema2Ref(CINEMA2_INTERLOCK_RENDER_PASS_ID), output: CINEMA2_INTERLOCK_COLOR_OUTPUT_ID }),
        })]),
        outputs: Object.freeze([Object.freeze({
          id: CINEMA2_INTERLOCK_TRAILS_OUTPUT_ID,
          target: cinema2Ref(CINEMA2_INTERLOCK_TRAILS_TARGET_ID),
          attachment: 'color' as const,
        })]),
      }),
      Object.freeze({
        id: CINEMA2_INTERLOCK_BLOOM_PASS_ID,
        kind: 'fullscreen' as const,
        effect: cinema2Ref(CINEMA2_INTERLOCK_BLOOM_EFFECT_ID),
        inputs: Object.freeze([Object.freeze({
          id: CINEMA2_INTERLOCK_BLOOM_INPUT_ID,
          source: Object.freeze({ pass: cinema2Ref(CINEMA2_INTERLOCK_TRAILS_PASS_ID), output: CINEMA2_INTERLOCK_TRAILS_OUTPUT_ID }),
        })]),
      }),
    ]),
    outputPass: cinema2Ref(CINEMA2_INTERLOCK_BLOOM_PASS_ID),
  }),
  output: Object.freeze({
    renderPass: cinema2Ref(CINEMA2_INTERLOCK_BLOOM_PASS_ID),
    colorSpace: 'srgb' as const,
    alphaMode: 'premultiplied' as const,
  }),
})
