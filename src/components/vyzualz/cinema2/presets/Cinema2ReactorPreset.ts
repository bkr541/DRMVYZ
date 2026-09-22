import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleId,
  type Cinema2EffectId,
  type Cinema2MediaSlotId,
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2RenderPassId,
  type Cinema2RenderSlotId,
  type Cinema2RenderTargetId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
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
export const CINEMA2_REACTOR_TRAILS_PERSISTENCE_ID = cinema2StableId<Cinema2ParameterId>('reactor-trails-persistence')
export const CINEMA2_REACTOR_BLOOM_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('reactor-bloom-intensity')
export const CINEMA2_REACTOR_RESET_TRAILS_ID = cinema2StableId<Cinema2ParameterId>('reactor-reset-trails')
export const CINEMA2_REACTOR_REACTIVITY_ID = cinema2StableId<Cinema2ParameterId>('reactor-reactivity')
export const CINEMA2_REACTOR_ROTATION_SPEED_ID = cinema2StableId<Cinema2ParameterId>('reactor-rotation-speed')
export const CINEMA2_REACTOR_BUILD_CONTRACTION_ID = cinema2StableId<Cinema2ParameterId>('reactor-build-contraction')
export const CINEMA2_REACTOR_SHOCKWAVE_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('reactor-shockwave-intensity')
export const CINEMA2_REACTOR_PRIMARY_COLOR_ID = cinema2StableId<Cinema2ParameterId>('reactor-primary-color')
export const CINEMA2_REACTOR_SECONDARY_COLOR_ID = cinema2StableId<Cinema2ParameterId>('reactor-secondary-color')
export const CINEMA2_REACTOR_ACCENT_COLOR_ID = cinema2StableId<Cinema2ParameterId>('reactor-accent-color')
export const CINEMA2_REACTOR_BACKGROUND_COLOR_ID = cinema2StableId<Cinema2ParameterId>('reactor-background-color')

export const CINEMA2_REACTOR_USER_MEDIA_SLOT_ID = cinema2StableId<Cinema2MediaSlotId>('reactor-user-media')
export const CINEMA2_REACTOR_ALBUM_ARTWORK_SLOT_ID = cinema2StableId<Cinema2MediaSlotId>('reactor-album-artwork')
export const CINEMA2_REACTOR_MEDIA_OUTPUT_SLOT_ID = cinema2StableId<Cinema2MediaSlotId>('reactor-media-output')

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
const REACTOR_COMPOSITE_HISTORY_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('reactor-composite-history')
const REACTOR_COMPOSITE_FRESH_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('reactor-composite-fresh')
const REACTOR_COMPOSITE_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('reactor-composite-color')
const REACTOR_BLOOM_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('reactor-bloom-source')

const REACTOR_INTENSITY_RULE_ID = cinema2StableId<Cinema2ChoreographyRuleId>('reactor-intensity-response')
const REACTOR_BASS_RULE_ID = cinema2StableId<Cinema2ChoreographyRuleId>('reactor-bass-response')
const REACTOR_IMPACT_RULE_ID = cinema2StableId<Cinema2ChoreographyRuleId>('reactor-impact-response')
const REACTOR_BUILD_RULE_ID = cinema2StableId<Cinema2ChoreographyRuleId>('reactor-build-response')
const REACTOR_DOWNBEAT_RULE_ID = cinema2StableId<Cinema2ChoreographyRuleId>('reactor-downbeat-refraction')
const REACTOR_DROP_RULE_ID = cinema2StableId<Cinema2ChoreographyRuleId>('reactor-drop-impact')

const REACTOR_INTENSITY_ACTION_ID = cinema2StableId<Cinema2ChoreographyActionId>('reactor-intensity-map')
const REACTOR_BASS_ACTION_ID = cinema2StableId<Cinema2ChoreographyActionId>('reactor-bass-map')
const REACTOR_IMPACT_ACTION_ID = cinema2StableId<Cinema2ChoreographyActionId>('reactor-impact-map')
const REACTOR_BUILD_ACTION_ID = cinema2StableId<Cinema2ChoreographyActionId>('reactor-build-map')
const REACTOR_DOWNBEAT_ACTION_ID = cinema2StableId<Cinema2ChoreographyActionId>('reactor-downbeat-refraction-envelope')
const REACTOR_DROP_BURST_ACTION_ID = cinema2StableId<Cinema2ChoreographyActionId>('reactor-drop-burst-envelope')
const REACTOR_DROP_BLOOM_ACTION_ID = cinema2StableId<Cinema2ChoreographyActionId>('reactor-drop-bloom-envelope')
const REACTOR_DROP_HISTORY_ACTION_ID = cinema2StableId<Cinema2ChoreographyActionId>('reactor-drop-history-reset')
const REACTOR_DROP_SHOCKWAVE_ACTION_ID = cinema2StableId<Cinema2ChoreographyActionId>('reactor-drop-shockwave-envelope')
const REACTOR_IMPACT_GENERATOR_ACTION_ID = cinema2StableId<Cinema2ChoreographyActionId>('reactor-impact-generator-map')

/**
 * Native Cinema 2.0 Reactor rendering slice. Creative form/refraction stay in
 * local modules while media, musical response, temporal feedback and bloom use
 * engine-owned Cinema 2.0 services.
 */
export const CINEMA2_REACTOR_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_REACTOR_PRESET_ID,
  revision: 3,
  metadata: Object.freeze({
    name: 'Reactor 2.0',
    description: 'Production Cinema 2.0 Reactor with full-stage shrapnel, procedural core motion, impact shockwaves, media refraction, feedback trails, and bloom.',
    tags: Object.freeze(['reactor', 'native', 'multipass', 'keeper']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native multipass Reactor output.' }),
    Object.freeze({ id: 'render.history' as const, requirement: 'required' as const, purpose: 'Engine-owned feedback history.' }),
    Object.freeze({ id: 'audio.features' as const, requirement: 'optional' as const, purpose: 'Overall-energy response when authoritative analysis is available.' }),
    Object.freeze({ id: 'audio.bands' as const, requirement: 'optional' as const, purpose: 'Bass response when authoritative bands are available.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Shared transient refraction response.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'Shared impact envelope and feedback reset.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'Generic visual significance response.' }),
    Object.freeze({ id: 'media.image' as const, requirement: 'optional' as const, purpose: 'Engine-owned Reactor media slots.' }),
    Object.freeze({ id: 'media.video' as const, requirement: 'optional' as const, purpose: 'Engine-owned Reactor media slots.' }),
    Object.freeze({ id: 'media.svg' as const, requirement: 'optional' as const, purpose: 'Engine-owned Reactor media slots.' }),
  ]),
  parameters: Object.freeze([
    CINEMA2_QUALITY_MODE_PARAMETER,
    Object.freeze({
      id: CINEMA2_REACTOR_CORE_SIZE_ID,
      label: 'Core Size',
      type: 'float' as const,
      defaultValue: 0.46,
      min: 0.1, max: 1.1, step: 0.01,
      section: 'Design', group: 'Core', designParentGroup: 'design' as const, order: 10,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_CORE_INTENSITY_ID,
      label: 'Core Intensity',
      type: 'float' as const,
      defaultValue: 1.15,
      min: 0.3, max: 2.4, step: 0.05,
      section: 'Design', group: 'Core', designParentGroup: 'design' as const, order: 11,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_ROTATION_SPEED_ID,
      label: 'Rotation Speed',
      type: 'float' as const,
      defaultValue: 0.21,
      min: -2, max: 2, step: 0.01,
      section: 'Design', group: 'Core', designParentGroup: 'design' as const, order: 12,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_RAY_DENSITY_ID,
      label: 'Ray Density',
      type: 'float' as const,
      defaultValue: 0.62,
      min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Shrapnel', designParentGroup: 'design' as const, order: 20,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_REFRACTION_ID,
      label: 'Refraction',
      type: 'float' as const,
      defaultValue: 0.82,
      min: 0, max: 3, step: 0.01,
      section: 'Design', group: 'Composite', designParentGroup: 'design' as const, order: 30,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_SHOCKWAVE_INTENSITY_ID,
      label: 'Shockwave',
      type: 'float' as const,
      defaultValue: 1.2,
      min: 0, max: 3, step: 0.05,
      section: 'Design', group: 'Composite', designParentGroup: 'design' as const, order: 31,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_PRIMARY_COLOR_ID,
      label: 'Primary',
      type: 'color' as const,
      defaultValue: Object.freeze([0.08, 0.62, 1, 1] as const),
      section: 'Design', group: 'Palette', designParentGroup: 'palette' as const, order: 40,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_SECONDARY_COLOR_ID,
      label: 'Secondary',
      type: 'color' as const,
      defaultValue: Object.freeze([0.36, 0.18, 0.95, 1] as const),
      section: 'Design', group: 'Palette', designParentGroup: 'palette' as const, order: 41,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_ACCENT_COLOR_ID,
      label: 'Accent',
      type: 'color' as const,
      defaultValue: Object.freeze([1, 0.24, 0.58, 1] as const),
      section: 'Design', group: 'Palette', designParentGroup: 'palette' as const, order: 42,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_BACKGROUND_COLOR_ID,
      label: 'Background',
      type: 'color' as const,
      defaultValue: Object.freeze([0.006, 0.009, 0.016, 1] as const),
      section: 'Design', group: 'Palette', designParentGroup: 'palette' as const, order: 43,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_REACTIVITY_ID,
      label: 'Reactivity',
      description: 'Scales shared Cinema 2.0 musical mappings without changing authored design values.',
      type: 'float' as const,
      defaultValue: 0.82,
      min: 0, max: 1.5, step: 0.01,
      section: 'Design', group: 'Response', designParentGroup: 'master-controls' as const, order: 10,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
      modulatable: true,
      choreographable: true,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_BUILD_CONTRACTION_ID,
      label: 'Build Contraction',
      description: 'Controls how strongly generic build significance pulls the Reactor core inward before release.',
      type: 'float' as const,
      defaultValue: 0.66,
      min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Response', designParentGroup: 'master-controls' as const, order: 11,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_TRAILS_PERSISTENCE_ID,
      label: 'Persistence',
      type: 'float' as const,
      defaultValue: 0.9,
      min: 0, max: 0.985, step: 0.005,
      section: 'Effects', group: 'Feedback', designParentGroup: 'effects' as const, order: 41,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_RESET_TRAILS_ID,
      label: 'Reset Trails',
      type: 'trigger' as const,
      section: 'Effects', group: 'Feedback', designParentGroup: 'effects' as const, order: 42,
      exposure: 'primary' as const, persistence: 'runtime-only' as const, reset: 'none' as const,
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_BLOOM_INTENSITY_ID,
      label: 'Intensity',
      type: 'float' as const,
      defaultValue: 1.45,
      min: 0, max: 4, step: 0.05,
      section: 'Effects', group: 'Bloom', designParentGroup: 'effects' as const, order: 51,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
  ]),
  mediaSlots: Object.freeze([
    Object.freeze({
      id: CINEMA2_REACTOR_USER_MEDIA_SLOT_ID,
      label: 'User Media',
      accepts: Object.freeze(['image', 'video', 'svg'] as const),
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_ALBUM_ARTWORK_SLOT_ID,
      label: 'Album Artwork',
      accepts: Object.freeze(['image'] as const),
    }),
    Object.freeze({
      id: CINEMA2_REACTOR_MEDIA_OUTPUT_SLOT_ID,
      label: 'Media Output',
      accepts: Object.freeze(['image', 'video'] as const),
    }),
  ]),
  modules: Object.freeze([
    Object.freeze({
      id: REACTOR_GENERATOR_MODULE_ID,
      typeId: CINEMA2_REACTOR_NATIVE_MODULE_TYPE_ID,
      version: 3,
      enabled: true,
      parameters: Object.freeze({
        coreSize: 0.46,
        coreIntensity: 1.15,
        rotationSpeed: 0.21,
        rayDensity: 0.62,
        energyResponse: 0,
        buildResponse: 0,
        buildContraction: 0.66,
        bassResponse: 0,
        impactBurst: 0,
        mediaInfluence: 0.34,
        backgroundColor: Object.freeze([0.006, 0.009, 0.016, 1]),
        primaryColor: Object.freeze([0.08, 0.62, 1, 1]),
        secondaryColor: Object.freeze([0.36, 0.18, 0.95, 1]),
        accentColor: Object.freeze([1, 0.24, 0.58, 1]),
      }),
      parameterBindings: Object.freeze({
        coreSize: cinema2Ref(CINEMA2_REACTOR_CORE_SIZE_ID),
        coreIntensity: cinema2Ref(CINEMA2_REACTOR_CORE_INTENSITY_ID),
        rotationSpeed: cinema2Ref(CINEMA2_REACTOR_ROTATION_SPEED_ID),
        rayDensity: cinema2Ref(CINEMA2_REACTOR_RAY_DENSITY_ID),
        buildContraction: cinema2Ref(CINEMA2_REACTOR_BUILD_CONTRACTION_ID),
        backgroundColor: cinema2Ref(CINEMA2_REACTOR_BACKGROUND_COLOR_ID),
        primaryColor: cinema2Ref(CINEMA2_REACTOR_PRIMARY_COLOR_ID),
        secondaryColor: cinema2Ref(CINEMA2_REACTOR_SECONDARY_COLOR_ID),
        accentColor: cinema2Ref(CINEMA2_REACTOR_ACCENT_COLOR_ID),
      }),
      media: Object.freeze({
        userMedia: cinema2Ref(CINEMA2_REACTOR_USER_MEDIA_SLOT_ID),
        albumArtwork: cinema2Ref(CINEMA2_REACTOR_ALBUM_ARTWORK_SLOT_ID),
        mediaOutput: cinema2Ref(CINEMA2_REACTOR_MEDIA_OUTPUT_SLOT_ID),
      }),
      config: Object.freeze({ variant: 'generator' }),
    }),
    Object.freeze({
      id: REACTOR_COMPOSITE_MODULE_ID,
      typeId: CINEMA2_REACTOR_NATIVE_MODULE_TYPE_ID,
      version: 3,
      enabled: true,
      parameters: Object.freeze({
        refraction: 0.82,
        edgeGlow: 0.82,
        impactResponse: 0,
        refractionPulse: 0,
        shockwaveIntensity: 1.2,
        shockwavePulse: 0,
        accentColor: Object.freeze([1, 0.24, 0.58, 1]),
      }),
      parameterBindings: Object.freeze({
        refraction: cinema2Ref(CINEMA2_REACTOR_REFRACTION_ID),
        shockwaveIntensity: cinema2Ref(CINEMA2_REACTOR_SHOCKWAVE_INTENSITY_ID),
        accentColor: cinema2Ref(CINEMA2_REACTOR_ACCENT_COLOR_ID),
      }),
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
      parameters: Object.freeze({ mix: 1, persistence: 0.9 }),
      parameterBindings: Object.freeze({
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
      parameters: Object.freeze({ mix: 0.74, threshold: 0.28, radius: 6.5, intensity: 1.45 }),
      parameterBindings: Object.freeze({
        intensity: cinema2Ref(CINEMA2_REACTOR_BLOOM_INTENSITY_ID),
      }),
    }),
  ]),
  choreography: Object.freeze({
    rules: Object.freeze([
      Object.freeze({
        id: REACTOR_INTENSITY_RULE_ID,
        priority: 20,
        source: Object.freeze({
          signal: 'continuous' as const,
          capability: 'visual-director.significance' as const,
          path: 'director.intensity' as const,
          smoothingMs: 110,
        }),
        strengthParameter: cinema2Ref(CINEMA2_REACTOR_REACTIVITY_ID),
        actions: Object.freeze([Object.freeze({
          id: REACTOR_INTENSITY_ACTION_ID,
          target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(REACTOR_GENERATOR_MODULE_ID), property: 'energyResponse' }),
          operation: 'map' as const,
          map: Object.freeze({ inputMin: 0, inputMax: 1, outputMin: 0, outputMax: 1.2, clamp: true }),
        })]),
      }),
      Object.freeze({
        id: REACTOR_BASS_RULE_ID,
        priority: 21,
        source: Object.freeze({
          signal: 'continuous' as const,
          capability: 'audio.bands' as const,
          path: 'audio.bands.bass' as const,
          smoothingMs: 75,
        }),
        strengthParameter: cinema2Ref(CINEMA2_REACTOR_REACTIVITY_ID),
        actions: Object.freeze([Object.freeze({
          id: REACTOR_BASS_ACTION_ID,
          target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(REACTOR_GENERATOR_MODULE_ID), property: 'bassResponse' }),
          operation: 'map' as const,
          map: Object.freeze({ inputMin: 0, inputMax: 1, outputMin: 0, outputMax: 1.25, clamp: true }),
        })]),
      }),
      Object.freeze({
        id: REACTOR_BUILD_RULE_ID,
        priority: 14,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 120 }),
        strengthParameter: cinema2Ref(CINEMA2_REACTOR_REACTIVITY_ID),
        actions: Object.freeze([Object.freeze({
          id: REACTOR_BUILD_ACTION_ID,
          target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(REACTOR_GENERATOR_MODULE_ID), property: 'buildResponse' }),
          operation: 'map' as const,
          map: Object.freeze({ inputMin: 0, inputMax: 1, outputMin: 0, outputMax: 1, clamp: true }),
        })]),
      }),
      Object.freeze({
        id: REACTOR_IMPACT_RULE_ID,
        priority: 22,
        source: Object.freeze({
          signal: 'continuous' as const,
          capability: 'visual-director.significance' as const,
          path: 'director.impact' as const,
          smoothingMs: 55,
        }),
        strengthParameter: cinema2Ref(CINEMA2_REACTOR_REACTIVITY_ID),
        actions: Object.freeze([
          Object.freeze({
            id: REACTOR_IMPACT_ACTION_ID,
            target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(REACTOR_COMPOSITE_MODULE_ID), property: 'impactResponse' }),
            operation: 'map' as const,
            map: Object.freeze({ inputMin: 0, inputMax: 1, outputMin: 0, outputMax: 1.35, clamp: true }),
          }),
          Object.freeze({
            id: REACTOR_IMPACT_GENERATOR_ACTION_ID,
            target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(REACTOR_GENERATOR_MODULE_ID), property: 'impactBurst' }),
            operation: 'map' as const,
            map: Object.freeze({ inputMin: 0, inputMax: 1, outputMin: 0, outputMax: 0.72, clamp: true }),
          }),
        ]),
      }),
      Object.freeze({
        id: REACTOR_DOWNBEAT_RULE_ID,
        priority: 30,
        source: Object.freeze({ signal: 'downbeat' as const, capability: 'music.downbeat' as const }),
        strengthParameter: cinema2Ref(CINEMA2_REACTOR_REACTIVITY_ID),
        actions: Object.freeze([Object.freeze({
          id: REACTOR_DOWNBEAT_ACTION_ID,
          target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(REACTOR_COMPOSITE_MODULE_ID), property: 'refractionPulse' }),
          operation: 'envelope' as const,
          composition: 'add' as const,
          value: 0.34,
          envelope: Object.freeze({ attack: 0, hold: 0.04, release: 0.28, unit: 'seconds' as const }),
          retrigger: 'restart' as const,
        })]),
      }),
      Object.freeze({
        id: REACTOR_DROP_RULE_ID,
        priority: 40,
        source: Object.freeze({ signal: 'drop' as const, capability: 'music.drop' as const }),
        strengthParameter: cinema2Ref(CINEMA2_REACTOR_REACTIVITY_ID),
        actions: Object.freeze([
          Object.freeze({
            id: REACTOR_DROP_BURST_ACTION_ID,
            target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(REACTOR_GENERATOR_MODULE_ID), property: 'impactBurst' }),
            operation: 'envelope' as const,
            composition: 'add' as const,
            value: 1,
            envelope: Object.freeze({ attack: 0.015, hold: 0.08, release: 0.62, unit: 'seconds' as const }),
            retrigger: 'restart' as const,
          }),
          Object.freeze({
            id: REACTOR_DROP_BLOOM_ACTION_ID,
            target: Object.freeze({ kind: 'effect' as const, ref: cinema2Ref(REACTOR_BLOOM_EFFECT_ID), property: 'intensity' }),
            operation: 'envelope' as const,
            composition: 'add' as const,
            value: 1.15,
            envelope: Object.freeze({ attack: 0.01, hold: 0.06, release: 0.52, unit: 'seconds' as const }),
            retrigger: 'restart' as const,
          }),
          Object.freeze({
            id: REACTOR_DROP_SHOCKWAVE_ACTION_ID,
            target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(REACTOR_COMPOSITE_MODULE_ID), property: 'shockwavePulse' }),
            operation: 'envelope' as const,
            composition: 'add' as const,
            value: 1,
            envelope: Object.freeze({ attack: 0.005, hold: 0.05, release: 0.82, unit: 'seconds' as const }),
            retrigger: 'restart' as const,
          }),
          Object.freeze({
            id: REACTOR_DROP_HISTORY_ACTION_ID,
            target: Object.freeze({ kind: 'parameter' as const, ref: cinema2Ref(CINEMA2_REACTOR_RESET_TRAILS_ID) }),
            operation: 'trigger' as const,
          }),
        ]),
      }),
    ]),
  }),
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
        inputs: Object.freeze([
          Object.freeze({
            id: REACTOR_COMPOSITE_HISTORY_INPUT_ID,
            source: Object.freeze({ pass: cinema2Ref(REACTOR_FEEDBACK_PASS_ID), output: REACTOR_FEEDBACK_OUTPUT_ID }),
          }),
          Object.freeze({
            id: REACTOR_COMPOSITE_FRESH_INPUT_ID,
            source: Object.freeze({ pass: cinema2Ref(REACTOR_GENERATOR_PASS_ID), output: REACTOR_GENERATOR_OUTPUT_ID }),
          }),
        ]),
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
