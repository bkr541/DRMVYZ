import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleId,
  type Cinema2LayerId,
  type Cinema2MediaSlotId,
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2SceneNodeId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_ELECTRIC_STORM_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2ElectricStormNativeModule'

export const CINEMA2_ELECTRIC_STORM_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.electric-storm')
export const CINEMA2_ELECTRIC_STORM_LIGHTNING_COLOR_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-lightning-color')
export const CINEMA2_ELECTRIC_STORM_MASTER_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-master-intensity')
export const CINEMA2_ELECTRIC_STORM_BPM_SYNC_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-bpm-sync')
export const CINEMA2_ELECTRIC_STORM_STRIKE_RATE_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-strike-rate')
export const CINEMA2_ELECTRIC_STORM_BRANCHING_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-branching')
export const CINEMA2_ELECTRIC_STORM_THICKNESS_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-thickness')
export const CINEMA2_ELECTRIC_STORM_GLOW_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-glow')
export const CINEMA2_ELECTRIC_STORM_BACKGROUND_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-background')
export const CINEMA2_ELECTRIC_STORM_HAZE_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-haze')
export const CINEMA2_ELECTRIC_STORM_MUSIC_REACTIVITY_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-music-reactivity')
export const CINEMA2_ELECTRIC_STORM_KICK_REACTION_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-kick-reaction')
export const CINEMA2_ELECTRIC_STORM_TRANSIENT_REACTION_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-transient-reaction')
export const CINEMA2_ELECTRIC_STORM_DROP_REACTION_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-drop-reaction')
export const CINEMA2_ELECTRIC_STORM_STRUCTURE_REACTION_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-structure-reaction')
export const CINEMA2_ELECTRIC_STORM_IMPACT_SHAKE_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-impact-shake')
export const CINEMA2_ELECTRIC_STORM_ZOOM_PUNCH_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-zoom-punch')
export const CINEMA2_ELECTRIC_STORM_FLASH_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-flash-intensity')
export const CINEMA2_ELECTRIC_STORM_FLASH_DURATION_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-flash-duration')
export const CINEMA2_ELECTRIC_STORM_FLASH_DECAY_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-flash-decay')
export const CINEMA2_ELECTRIC_STORM_STRIKE_INTENT_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-strike-intent')
export const CINEMA2_ELECTRIC_STORM_MEDIA_INFLUENCE_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-media-influence')

export const CINEMA2_ELECTRIC_STORM_USER_MEDIA_SLOT_ID = cinema2StableId<Cinema2MediaSlotId>('electric-storm-user-media')
export const CINEMA2_ELECTRIC_STORM_ALBUM_ARTWORK_SLOT_ID = cinema2StableId<Cinema2MediaSlotId>('electric-storm-album-artwork')
export const CINEMA2_ELECTRIC_STORM_MEDIA_OUTPUT_SLOT_ID = cinema2StableId<Cinema2MediaSlotId>('electric-storm-media-output')

export const CINEMA2_ELECTRIC_STORM_MODULE_ID = cinema2StableId<Cinema2ModuleId>('electric-storm-procedural-lightning')
const ELECTRIC_STORM_ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('electric-storm-root')
const ELECTRIC_STORM_MODULE_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('electric-storm-module-node')
const ELECTRIC_STORM_LAYER_ID = cinema2StableId<Cinema2LayerId>('electric-storm-layer')

const choreographyRuleId = (id: string) => cinema2StableId<Cinema2ChoreographyRuleId>(id)
const choreographyActionId = (id: string) => cinema2StableId<Cinema2ChoreographyActionId>(id)

const ELECTRIC_STORM_DIRECTOR_INTENSITY_RULE_ID = choreographyRuleId('electric-storm-director-intensity')
const ELECTRIC_STORM_BUILD_RULE_ID = choreographyRuleId('electric-storm-build-detail')
const ELECTRIC_STORM_IMPACT_ENVIRONMENT_RULE_ID = choreographyRuleId('electric-storm-impact-environment')
const ELECTRIC_STORM_KICK_RULE_ID = choreographyRuleId('electric-storm-kick-strike')
const ELECTRIC_STORM_DROP_RULE_ID = choreographyRuleId('electric-storm-drop-strike')
const ELECTRIC_STORM_TRANSIENT_RULE_ID = choreographyRuleId('electric-storm-transient-strike')
const ELECTRIC_STORM_DOWNBEAT_RULE_ID = choreographyRuleId('electric-storm-downbeat-strike')
const ELECTRIC_STORM_PHRASE_RULE_ID = choreographyRuleId('electric-storm-phrase-strike')
const ELECTRIC_STORM_SECTION_RULE_ID = choreographyRuleId('electric-storm-section-strike')

const strikeAction = (id: string, kind: string, tier: string, options: Readonly<Record<string, number>> = {}) => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'parameter' as const, ref: cinema2Ref(CINEMA2_ELECTRIC_STORM_STRIKE_INTENT_ID) }),
  operation: 'spawn' as const,
  value: Object.freeze({ kind, tier, ...options }),
})

/** Native Electric Storm 2.0 preset with shared Audio -> Director -> Choreography ownership. */
export const CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_ELECTRIC_STORM_PRESET_ID,
  revision: 2,
  metadata: Object.freeze({
    name: 'Electric Storm 2.0',
    description: 'Production Cinema 2.0 procedural lightning with deterministic topology, musical strike tiers, atmosphere, and shaped thunder illumination.',
    tags: Object.freeze(['electric-storm', 'native', 'procedural-lightning', 'keeper']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Procedural fullscreen lightning rendering.' }),
    Object.freeze({ id: 'audio.bands' as const, requirement: 'optional' as const, purpose: 'Storm-local strike styling and continuous spectral strike generation when canonical band energy is available.' }),
    Object.freeze({ id: 'audio.features' as const, requirement: 'optional' as const, purpose: 'Continuous music response when canonical feature energy is available.' }),
    Object.freeze({ id: 'music.rhythm-events' as const, requirement: 'optional' as const, purpose: 'Kick and transient strike events.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Downbeat strike accents.' }),
    Object.freeze({ id: 'music.phrase' as const, requirement: 'optional' as const, purpose: 'Phrase-boundary storm variation.' }),
    Object.freeze({ id: 'music.section' as const, requirement: 'optional' as const, purpose: 'Section-change storm variation.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'Drop-entry hero strikes.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'Preset-agnostic visual significance and transition authority.' }),
    Object.freeze({ id: 'media.image' as const, requirement: 'optional' as const, purpose: 'Engine-owned Electric Storm media slots.' }),
    Object.freeze({ id: 'media.video' as const, requirement: 'optional' as const, purpose: 'Engine-owned Electric Storm media slots.' }),
    Object.freeze({ id: 'media.svg' as const, requirement: 'optional' as const, purpose: 'Engine-owned Electric Storm media slots.' }),
  ]),
  parameters: Object.freeze([
    CINEMA2_QUALITY_MODE_PARAMETER,
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_LIGHTNING_COLOR_ID,
      label: 'Lightning Color',
      type: 'color' as const,
      defaultValue: Object.freeze([0.29, 0.65, 1, 1] as const),
      section: 'Design', group: 'Lightning', designParentGroup: 'palette' as const, order: 10,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_MASTER_INTENSITY_ID,
      label: 'Master Intensity',
      type: 'float' as const, defaultValue: 0.82, min: 0, max: 1.5, step: 0.01,
      section: 'Design', group: 'Lightning', designParentGroup: 'master-controls' as const, order: 11,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_BPM_SYNC_ID,
      label: 'BPM Sync',
      type: 'boolean' as const, defaultValue: true,
      description: 'Locks the storm\'s continuous motion (haze drift, impact shake) to the analyzed or global Audio Dock Sync tempo instead of raw elapsed time.',
      section: 'Design', group: 'Lightning', designParentGroup: 'master-controls' as const, order: 12,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_STRIKE_RATE_ID,
      label: 'Strike Rate',
      type: 'float' as const, defaultValue: 0.58, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Lightning', designParentGroup: 'design' as const, order: 12,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_BRANCHING_ID,
      label: 'Branching',
      type: 'float' as const, defaultValue: 0.68, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Lightning', designParentGroup: 'design' as const, order: 13,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_THICKNESS_ID,
      label: 'Thickness',
      type: 'float' as const, defaultValue: 0.52, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Lightning', designParentGroup: 'design' as const, order: 14,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_GLOW_ID,
      label: 'Glow',
      type: 'float' as const, defaultValue: 0.72, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Lightning', designParentGroup: 'effects' as const, order: 15,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_BACKGROUND_ID,
      label: 'Background',
      type: 'color' as const,
      defaultValue: Object.freeze([0.004, 0.007, 0.014, 1] as const),
      section: 'Design', group: 'Atmosphere', designParentGroup: 'palette' as const, order: 20,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_HAZE_ID,
      label: 'Haze',
      type: 'float' as const, defaultValue: 0.08, min: 0, max: 0.35, step: 0.005,
      section: 'Design', group: 'Atmosphere', designParentGroup: 'effects' as const, order: 21,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_FLASH_INTENSITY_ID,
      label: 'Flash Intensity',
      type: 'float' as const, defaultValue: 0.78, min: 0, max: 1.5, step: 0.01,
      section: 'Effects', group: 'Thunder', designParentGroup: 'effects' as const, order: 80,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_FLASH_DURATION_ID,
      label: 'Flash Duration',
      type: 'float' as const, defaultValue: 0.46, min: 0, max: 1, step: 0.01,
      section: 'Effects', group: 'Thunder', designParentGroup: 'effects' as const, order: 81,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_FLASH_DECAY_ID,
      label: 'Flash Decay',
      type: 'float' as const, defaultValue: 0.62, min: 0, max: 1, step: 0.01,
      section: 'Effects', group: 'Thunder', designParentGroup: 'effects' as const, order: 82,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_MUSIC_REACTIVITY_ID,
      label: 'Music Reactivity',
      type: 'float' as const, defaultValue: 0.8, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Music', designParentGroup: 'master-controls' as const, order: 100,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_KICK_REACTION_ID,
      label: 'Kick Reaction',
      type: 'float' as const, defaultValue: 0.72, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Music', designParentGroup: 'master-controls' as const, order: 101,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_TRANSIENT_REACTION_ID,
      label: 'Transient Reaction',
      type: 'float' as const, defaultValue: 0.58, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Music', designParentGroup: 'master-controls' as const, order: 102,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_DROP_REACTION_ID,
      label: 'Drop Reaction',
      type: 'float' as const, defaultValue: 0.92, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Music', designParentGroup: 'master-controls' as const, order: 103,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_STRUCTURE_REACTION_ID,
      label: 'Structure Reaction',
      type: 'float' as const, defaultValue: 0.7, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Music', designParentGroup: 'master-controls' as const, order: 104,
      exposure: 'advanced' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_IMPACT_SHAKE_ID,
      label: 'Impact Shake',
      type: 'float' as const, defaultValue: 0.42, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Impact', designParentGroup: 'effects' as const, order: 110,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_ZOOM_PUNCH_ID,
      label: 'Zoom Punch',
      type: 'float' as const, defaultValue: 0.28, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Impact', designParentGroup: 'effects' as const, order: 111,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_STRIKE_INTENT_ID,
      label: 'Strike Intent',
      type: 'trigger' as const,
      section: 'React', group: 'Runtime', order: 999,
      exposure: 'hidden' as const, persistence: 'runtime-only' as const, reset: 'none' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_MEDIA_INFLUENCE_ID,
      label: 'Media Influence',
      type: 'float' as const, defaultValue: 0.34, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Atmosphere', designParentGroup: 'design' as const, order: 22,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
  ]),
  mediaSlots: Object.freeze([
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_USER_MEDIA_SLOT_ID,
      label: 'User Media',
      accepts: Object.freeze(['image', 'video', 'svg'] as const),
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_ALBUM_ARTWORK_SLOT_ID,
      label: 'Album Artwork',
      accepts: Object.freeze(['image'] as const),
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_MEDIA_OUTPUT_SLOT_ID,
      label: 'Media Output',
      accepts: Object.freeze(['image', 'video'] as const),
    }),
  ]),
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_ELECTRIC_STORM_MODULE_ID,
    typeId: CINEMA2_ELECTRIC_STORM_NATIVE_MODULE_TYPE_ID,
    version: 2,
    enabled: true,
    parameters: Object.freeze({
      lightningColor: Object.freeze([0.29, 0.65, 1, 1] as const),
      masterIntensity: 0.82,
      strikeRate: 0.58,
      branching: 0.68,
      thickness: 0.52,
      glow: 0.72,
      impactShake: 0.42,
      zoomPunch: 0.28,
      musicReactivity: 0.8,
      kickReaction: 0.72,
      transientReaction: 0.58,
      dropReaction: 0.92,
      structureReaction: 0.7,
      flashIntensity: 0.78,
      flashDuration: 0.46,
      flashDecay: 0.62,
      mediaInfluence: 0.34,
      bpmSync: true,
    }),
    parameterBindings: Object.freeze({
      lightningColor: cinema2Ref(CINEMA2_ELECTRIC_STORM_LIGHTNING_COLOR_ID),
      masterIntensity: cinema2Ref(CINEMA2_ELECTRIC_STORM_MASTER_INTENSITY_ID),
      bpmSync: cinema2Ref(CINEMA2_ELECTRIC_STORM_BPM_SYNC_ID),
      strikeRate: cinema2Ref(CINEMA2_ELECTRIC_STORM_STRIKE_RATE_ID),
      branching: cinema2Ref(CINEMA2_ELECTRIC_STORM_BRANCHING_ID),
      thickness: cinema2Ref(CINEMA2_ELECTRIC_STORM_THICKNESS_ID),
      glow: cinema2Ref(CINEMA2_ELECTRIC_STORM_GLOW_ID),
      impactShake: cinema2Ref(CINEMA2_ELECTRIC_STORM_IMPACT_SHAKE_ID),
      zoomPunch: cinema2Ref(CINEMA2_ELECTRIC_STORM_ZOOM_PUNCH_ID),
      musicReactivity: cinema2Ref(CINEMA2_ELECTRIC_STORM_MUSIC_REACTIVITY_ID),
      kickReaction: cinema2Ref(CINEMA2_ELECTRIC_STORM_KICK_REACTION_ID),
      transientReaction: cinema2Ref(CINEMA2_ELECTRIC_STORM_TRANSIENT_REACTION_ID),
      dropReaction: cinema2Ref(CINEMA2_ELECTRIC_STORM_DROP_REACTION_ID),
      structureReaction: cinema2Ref(CINEMA2_ELECTRIC_STORM_STRUCTURE_REACTION_ID),
      flashIntensity: cinema2Ref(CINEMA2_ELECTRIC_STORM_FLASH_INTENSITY_ID),
      flashDuration: cinema2Ref(CINEMA2_ELECTRIC_STORM_FLASH_DURATION_ID),
      flashDecay: cinema2Ref(CINEMA2_ELECTRIC_STORM_FLASH_DECAY_ID),
      mediaInfluence: cinema2Ref(CINEMA2_ELECTRIC_STORM_MEDIA_INFLUENCE_ID),
    }),
    actionBindings: Object.freeze({
      spawnStrike: cinema2Ref(CINEMA2_ELECTRIC_STORM_STRIKE_INTENT_ID),
    }),
    media: Object.freeze({
      userMedia: cinema2Ref(CINEMA2_ELECTRIC_STORM_USER_MEDIA_SLOT_ID),
      albumArtwork: cinema2Ref(CINEMA2_ELECTRIC_STORM_ALBUM_ARTWORK_SLOT_ID),
      mediaOutput: cinema2Ref(CINEMA2_ELECTRIC_STORM_MEDIA_OUTPUT_SLOT_ID),
    }),
  })]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: ELECTRIC_STORM_ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'normalized-screen' as const, visible: true }),
      Object.freeze({ id: ELECTRIC_STORM_MODULE_NODE_ID, kind: 'module' as const, parent: cinema2Ref(ELECTRIC_STORM_ROOT_NODE_ID), module: cinema2Ref(CINEMA2_ELECTRIC_STORM_MODULE_ID), visible: true }),
    ]),
  }),
  layers: Object.freeze([Object.freeze({
    id: ELECTRIC_STORM_LAYER_ID,
    label: 'Electric Storm',
    source: cinema2Ref(ELECTRIC_STORM_ROOT_NODE_ID),
    visible: true,
    opacity: 1,
    blendMode: 'normal' as const,
    depthPolicy: 'disabled' as const,
    order: 0,
  })]),
  choreography: Object.freeze({
    rules: Object.freeze([
      Object.freeze({
        id: ELECTRIC_STORM_DIRECTOR_INTENSITY_RULE_ID,
        priority: 20,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.intensity' as const, smoothingMs: 90 }),
        strengthParameter: cinema2Ref(CINEMA2_ELECTRIC_STORM_MUSIC_REACTIVITY_ID),
        actions: Object.freeze([Object.freeze({
          id: choreographyActionId('electric-storm-intensity-rate'),
          target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_ELECTRIC_STORM_MODULE_ID), property: 'strikeRate' }),
          operation: 'multiply' as const,
          value: 1.35,
        })]),
      }),
      Object.freeze({
        id: ELECTRIC_STORM_BUILD_RULE_ID,
        priority: 21,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 120 }),
        strengthParameter: cinema2Ref(CINEMA2_ELECTRIC_STORM_MUSIC_REACTIVITY_ID),
        actions: Object.freeze([Object.freeze({
          id: choreographyActionId('electric-storm-build-branching'),
          target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_ELECTRIC_STORM_MODULE_ID), property: 'branching' }),
          operation: 'add' as const,
          value: 0.18,
        })]),
      }),
      Object.freeze({
        id: ELECTRIC_STORM_IMPACT_ENVIRONMENT_RULE_ID,
        priority: 22,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.impact' as const, smoothingMs: 45 }),
        strengthParameter: cinema2Ref(CINEMA2_ELECTRIC_STORM_MUSIC_REACTIVITY_ID),
        actions: Object.freeze([
          Object.freeze({
            id: choreographyActionId('electric-storm-impact-exposure'),
            target: Object.freeze({ kind: 'environment' as const, property: 'exposure' }),
            operation: 'add' as const,
            value: 0.42,
          }),
          Object.freeze({
            id: choreographyActionId('electric-storm-impact-haze'),
            target: Object.freeze({ kind: 'environment' as const, property: 'fog.density' }),
            operation: 'add' as const,
            value: 0.045,
          }),
        ]),
      }),
      Object.freeze({
        id: ELECTRIC_STORM_KICK_RULE_ID,
        priority: 30,
        source: Object.freeze({ signal: 'kick' as const, capability: 'music.rhythm-events' as const }),
        actions: Object.freeze([strikeAction('electric-storm-kick-spawn', 'kick', 'strong')]),
      }),
      Object.freeze({
        id: ELECTRIC_STORM_TRANSIENT_RULE_ID,
        priority: 31,
        source: Object.freeze({ signal: 'transient' as const, capability: 'music.rhythm-events' as const }),
        actions: Object.freeze([strikeAction('electric-storm-transient-spawn', 'transient', 'micro', { durationScale: 0.58 })]),
      }),
      Object.freeze({
        id: ELECTRIC_STORM_DOWNBEAT_RULE_ID,
        priority: 32,
        source: Object.freeze({ signal: 'downbeat' as const, capability: 'music.downbeat' as const }),
        actions: Object.freeze([Object.freeze({ ...strikeAction('electric-storm-downbeat-spawn', 'downbeat', 'medium'), quantizeBeats: 1, cooldownBeats: 2 })]),
      }),
      Object.freeze({
        id: ELECTRIC_STORM_PHRASE_RULE_ID,
        priority: 34,
        source: Object.freeze({ signal: 'phrase' as const, capability: 'music.phrase' as const }),
        actions: Object.freeze([strikeAction('electric-storm-phrase-spawn', 'phrase', 'strong', { count: 2 })]),
      }),
      Object.freeze({
        id: ELECTRIC_STORM_SECTION_RULE_ID,
        priority: 36,
        source: Object.freeze({ signal: 'section-change' as const, capability: 'music.section' as const }),
        conditions: Object.freeze([Object.freeze({ kind: 'section-type' as const, values: Object.freeze(['intro', 'verse', 'build', 'preDrop', 'breakdown', 'bridge', 'outro', 'unknown'] as const) })]),
        actions: Object.freeze([strikeAction('electric-storm-section-spawn', 'section', 'strong', { count: 2 })]),
      }),
      Object.freeze({
        id: ELECTRIC_STORM_DROP_RULE_ID,
        priority: 40,
        source: Object.freeze({ signal: 'drop' as const, capability: 'music.drop' as const }),
        actions: Object.freeze([
          strikeAction('electric-storm-drop-spawn', 'drop', 'hero', { count: 2 }),
          Object.freeze({
            id: choreographyActionId('electric-storm-drop-exposure-envelope'),
            target: Object.freeze({ kind: 'environment' as const, property: 'exposure' }),
            operation: 'envelope' as const,
            composition: 'add' as const,
            value: 0.18,
            envelope: Object.freeze({ attack: 0.015, hold: 0.06, release: 0.34, unit: 'seconds' as const }),
          }),
        ]),
      }),
    ]),
  }),
  environment: Object.freeze({
    backgroundColor: Object.freeze([0.004, 0.007, 0.014, 1] as const),
    exposure: 1,
    fog: Object.freeze({
      mode: 'exponential' as const,
      color: Object.freeze([0.045, 0.09, 0.16, 1] as const),
      density: 0.08,
      near: 0,
      far: 100,
    }),
    controls: Object.freeze({
      backgroundColor: cinema2Ref(CINEMA2_ELECTRIC_STORM_BACKGROUND_ID),
      fogDensity: cinema2Ref(CINEMA2_ELECTRIC_STORM_HAZE_ID),
    }),
  }),
})
