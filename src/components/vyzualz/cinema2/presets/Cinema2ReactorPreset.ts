import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2EffectId,
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2RenderPassId,
  type Cinema2RenderSlotId,
  type Cinema2RenderTargetId,
} from '../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_BLOOM_EFFECT_TYPE_ID,
  CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID,
} from '../effects/Cinema2BuiltinEffects'
import { CINEMA2_REACTOR_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2ReactorNativeModule'

export const CINEMA2_REACTOR_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.reactor')
export const CINEMA2_REACTOR_CORE_SIZE_ID = cinema2StableId<Cinema2ParameterId>('reactor-core-size')
export const CINEMA2_REACTOR_CORE_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('reactor-core-intensity')
export const CINEMA2_REACTOR_RAY_DENSITY_ID = cinema2StableId<Cinema2ParameterId>('reactor-ray-density')
export const CINEMA2_REACTOR_REFRACTION_ID = cinema2StableId<Cinema2ParameterId>('reactor-refraction')
export const CINEMA2_REACTOR_TRAILS_ENABLED_ID = cinema2StableId<Cinema2ParameterId>('reactor-trails-enabled')
export const CINEMA2_REACTOR_TRAILS_PERSISTENCE_ID = cinema2StableId<Cinema2ParameterId>('reactor-trails-persistence')
export const CINEMA2_REACTOR_BLOOM_ENABLED_ID = cinema2StableId<Cinema2ParameterId>('reactor-bloom-enabled')
export const CINEMA2_REACTOR_BLOOM_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('reactor-bloom-intensity')
export const CINEMA2_REACTOR_RESET_TRAILS_ID = cinema2StableId<Cinema2ParameterId>('reactor-reset-trails')

const REACTOR_GENERATOR_MODULE_ID = cinema2StableId<Cinema2ModuleId>('reactor-generator')
const REACTOR_COMPOSITE_MODULE_ID = cinema2StableId<Cinema2ModuleId>('reactor-composite')
const REACTOR_TRAILS_EFFECT_ID = cinema2StableId<Cinema2EffectId>('reactor-feedback')
const REACTOR_BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('reactor-bloom')

const REACTOR_GENERATOR_PASS_ID = cinema2StableId<Cinema2RenderPassId>('reactor-generator-pass')
const REACTOR_FEEDBACK_PASS_ID = cinema2StableId<Cinema2RenderPassId>('reactor-feedback-pass')
const REACTOR_COMPOSITE_PASS_ID = cinema2StableId<Cinema2RenderPassId>('reactor-composite-pass')
const REACTOR_BLOOM_PASS_ID = cinema2StableId<Cinema2RenderPassId>('reactor-bloom-pass')

const REACTOR_GENERATOR_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('reactor-generator-target')
const REACTOR_FEEDBACK_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('reactor-feedback-target')
const REACTOR_COMPOSITE_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('reactor-composite-target')

const REACTOR_GENERATOR_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('reactor-generator-color')
const REACTOR_FEEDBACK_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('reactor-feedback-source')
const REACTOR_FEEDBACK_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('reactor-feedback-color')
const REACTOR_COMPOSITE_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('reactor-composite-source')
const REACTOR_COMPOSITE_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('reactor-composite-color')
const REACTOR_BLOOM_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('reactor-bloom-source')

/**
 * Native Cinema 2.0 Reactor rendering slice. Creative form/refraction stay in
 * local modules while temporal feedback and bloom use engine-owned effects.
 * Choreography intentionally remains absent until Stage 11B.
 */
export const CINEMA2_REACTOR_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_REACTOR_PRESET_ID,
  revision: 1,
  metadata: Object.freeze({
    name: 'Reactor 2.0',
    description: 'Native Cinema 2.0 Reactor generator, shared feedback history, refraction composite, and bloom.',
    tags: Object.freeze(['reactor', 'native', 'multipass']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native multipass Reactor output.' }),
    Object.freeze({ id: 'render.history' as const, requirement: 'required' as const, purpose: 'Engine-owned feedback history.' }),
    Object.freeze({ id: 'audio.features' as const, requirement: 'optional' as const, purpose: 'Overall-energy response when authoritative analysis is available.' }),
    Object.freeze({ id: 'audio.bands' as const, requirement: 'optional' as const, purpose: 'Bass response when authoritative bands are available.' }),
  ]),
  parameters: Object.freeze([
    Object.freeze({
      id: CINEMA2_REACTOR_CORE_SIZE_ID,
      label: 'Core Size',
      type: 'float' as const,
      defaultValue: 0.42,
      min: 0.18, max: 0.72, step: 0.01,
      section: 'Design', group: 'Core', order: 10,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_CORE_INTENSITY_ID,
      label: 'Core Intensity',
      type: 'float' as const,
      defaultValue: 1.15,
      min: 0.3, max: 2.4, step: 0.05,
      section: 'Design', group: 'Core', order: 11,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_RAY_DENSITY_ID,
      label: 'Ray Density',
      type: 'float' as const,
      defaultValue: 0.62,
      min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Shrapnel', order: 20,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_REFRACTION_ID,
      label: 'Refraction',
      type: 'float' as const,
      defaultValue: 0.42,
      min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Composite', order: 30,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_TRAILS_ENABLED_ID,
      label: 'Trails',
      type: 'boolean' as const,
      defaultValue: true,
      section: 'Effects', group: 'Feedback', order: 40,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_TRAILS_PERSISTENCE_ID,
      label: 'Persistence',
      type: 'float' as const,
      defaultValue: 0.9,
      min: 0, max: 0.985, step: 0.005,
      section: 'Effects', group: 'Feedback', order: 41,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_RESET_TRAILS_ID,
      label: 'Reset Trails',
      type: 'trigger' as const,
      section: 'Effects', group: 'Feedback', order: 42,
      exposure: 'primary' as const, persistence: 'runtime-only' as const, reset: 'none' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_BLOOM_ENABLED_ID,
      label: 'Bloom',
      type: 'boolean' as const,
      defaultValue: true,
      section: 'Effects', group: 'Bloom', order: 50,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_BLOOM_INTENSITY_ID,
      label: 'Intensity',
      type: 'float' as const,
      defaultValue: 1.45,
      min: 0, max: 4, step: 0.05,
      section: 'Effects', group: 'Bloom', order: 51,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
  ]),
  modules: Object.freeze([
    Object.freeze({
      id: REACTOR_GENERATOR_MODULE_ID,
      typeId: CINEMA2_REACTOR_NATIVE_MODULE_TYPE_ID,
      version: 1,
      enabled: true,
      parameters: Object.freeze({
        coreSize: 0.42,
        coreIntensity: 1.15,
        rayDensity: 0.62,
        primaryColor: Object.freeze([0.08, 0.62, 1, 1]),
        secondaryColor: Object.freeze([0.36, 0.18, 0.95, 1]),
        accentColor: Object.freeze([1, 0.24, 0.58, 1]),
      }),
      parameterBindings: Object.freeze({
        coreSize: cinema2Ref(CINEMA2_REACTOR_CORE_SIZE_ID),
        coreIntensity: cinema2Ref(CINEMA2_REACTOR_CORE_INTENSITY_ID),
        rayDensity: cinema2Ref(CINEMA2_REACTOR_RAY_DENSITY_ID),
      }),
      config: Object.freeze({ variant: 'generator' }),
    }),
    Object.freeze({
      id: REACTOR_COMPOSITE_MODULE_ID,
      typeId: CINEMA2_REACTOR_NATIVE_MODULE_TYPE_ID,
      version: 1,
      enabled: true,
      parameters: Object.freeze({ refraction: 0.42, edgeGlow: 0.72 }),
      parameterBindings: Object.freeze({ refraction: cinema2Ref(CINEMA2_REACTOR_REFRACTION_ID) }),
      config: Object.freeze({ variant: 'composite' }),
    }),
  ]),
  effects: Object.freeze([
    Object.freeze({
      id: REACTOR_TRAILS_EFFECT_ID,
      typeId: CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 0,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 0.72, persistence: 0.9 }),
      parameterBindings: Object.freeze({
        enabled: cinema2Ref(CINEMA2_REACTOR_TRAILS_ENABLED_ID),
        persistence: cinema2Ref(CINEMA2_REACTOR_TRAILS_PERSISTENCE_ID),
      }),
      actionBindings: Object.freeze({ reset: cinema2Ref(CINEMA2_REACTOR_RESET_TRAILS_ID) }),
    }),
    Object.freeze({
      id: REACTOR_BLOOM_EFFECT_ID,
      typeId: CINEMA2_BLOOM_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 1,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 0.58, threshold: 0.36, radius: 2.2, intensity: 1.45 }),
      parameterBindings: Object.freeze({
        enabled: cinema2Ref(CINEMA2_REACTOR_BLOOM_ENABLED_ID),
        intensity: cinema2Ref(CINEMA2_REACTOR_BLOOM_INTENSITY_ID),
      }),
    }),
  ]),
  render: Object.freeze({
    targets: Object.freeze([
      Object.freeze({
        id: REACTOR_GENERATOR_TARGET_ID,
        descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba8' as const }),
        ownership: 'transient' as const,
      }),
      Object.freeze({
        id: REACTOR_FEEDBACK_TARGET_ID,
        descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba8' as const }),
        ownership: 'transient' as const,
      }),
      Object.freeze({
        id: REACTOR_COMPOSITE_TARGET_ID,
        descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba8' as const }),
        ownership: 'transient' as const,
      }),
    ]),
    passes: Object.freeze([
      Object.freeze({
        id: REACTOR_GENERATOR_PASS_ID,
        kind: 'module' as const,
        module: cinema2Ref(REACTOR_GENERATOR_MODULE_ID),
        outputs: Object.freeze([Object.freeze({ id: REACTOR_GENERATOR_OUTPUT_ID, target: cinema2Ref(REACTOR_GENERATOR_TARGET_ID) })]),
      }),
      Object.freeze({
        id: REACTOR_FEEDBACK_PASS_ID,
        kind: 'fullscreen' as const,
        effect: cinema2Ref(REACTOR_TRAILS_EFFECT_ID),
        inputs: Object.freeze([Object.freeze({
          id: REACTOR_FEEDBACK_INPUT_ID,
          source: Object.freeze({ pass: cinema2Ref(REACTOR_GENERATOR_PASS_ID), output: REACTOR_GENERATOR_OUTPUT_ID }),
        })]),
        outputs: Object.freeze([Object.freeze({ id: REACTOR_FEEDBACK_OUTPUT_ID, target: cinema2Ref(REACTOR_FEEDBACK_TARGET_ID) })]),
      }),
      Object.freeze({
        id: REACTOR_COMPOSITE_PASS_ID,
        kind: 'module' as const,
        module: cinema2Ref(REACTOR_COMPOSITE_MODULE_ID),
        inputs: Object.freeze([Object.freeze({
          id: REACTOR_COMPOSITE_INPUT_ID,
          source: Object.freeze({ pass: cinema2Ref(REACTOR_FEEDBACK_PASS_ID), output: REACTOR_FEEDBACK_OUTPUT_ID }),
        })]),
        outputs: Object.freeze([Object.freeze({ id: REACTOR_COMPOSITE_OUTPUT_ID, target: cinema2Ref(REACTOR_COMPOSITE_TARGET_ID) })]),
      }),
      Object.freeze({
        id: REACTOR_BLOOM_PASS_ID,
        kind: 'fullscreen' as const,
        effect: cinema2Ref(REACTOR_BLOOM_EFFECT_ID),
        inputs: Object.freeze([Object.freeze({
          id: REACTOR_BLOOM_INPUT_ID,
          source: Object.freeze({ pass: cinema2Ref(REACTOR_COMPOSITE_PASS_ID), output: REACTOR_COMPOSITE_OUTPUT_ID }),
        })]),
      }),
    ]),
    outputPass: cinema2Ref(REACTOR_BLOOM_PASS_ID),
  }),
})
