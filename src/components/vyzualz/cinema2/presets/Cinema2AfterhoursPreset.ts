import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleId,
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


const choreographyRuleId = (id: string) => cinema2StableId<Cinema2ChoreographyRuleId>(id)
const choreographyActionId = (id: string) => cinema2StableId<Cinema2ChoreographyActionId>(id)

const AFTERHOURS_DIRECTOR_INTENSITY_RULE_ID = choreographyRuleId('afterhours-director-intensity')
const AFTERHOURS_DIRECTOR_BUILD_RULE_ID = choreographyRuleId('afterhours-director-build')
const AFTERHOURS_DIRECTOR_IMPACT_RULE_ID = choreographyRuleId('afterhours-director-impact')
const AFTERHOURS_VOCAL_RULE_ID = choreographyRuleId('afterhours-vocal-restraint')
const AFTERHOURS_KICK_RULE_ID = choreographyRuleId('afterhours-kick-bank-accent')
const AFTERHOURS_SNARE_RULE_ID = choreographyRuleId('afterhours-snare-bank-accent')
const AFTERHOURS_DOWNBEAT_RULE_ID = choreographyRuleId('afterhours-downbeat-accent')
const AFTERHOURS_PHRASE_RULE_ID = choreographyRuleId('afterhours-phrase-structure')
const AFTERHOURS_SECTION_RULE_ID = choreographyRuleId('afterhours-section-structure')
const AFTERHOURS_DROP_RULE_ID = choreographyRuleId('afterhours-drop-structure')

const moduleContinuousAction = (id: string, property: string) => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_AFTERHOURS_MODULE_ID), property }),
  operation: 'replace' as const,
  value: 1,
})

const moduleEnvelopeAction = (id: string, property: string, hold: number, release: number) => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_AFTERHOURS_MODULE_ID), property }),
  operation: 'envelope' as const,
  value: 1,
  composition: 'replace' as const,
  envelope: Object.freeze({ attack: 0, hold, release, unit: 'seconds' as const }),
  retrigger: 'restart' as const,
})

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
 * Stage 5 production manifest for the independent Cinema 2.0 Afterhours keeper.
 * Shared Audio Intelligence, Visual Director significance, and declarative
 * choreography drive the Show Planner. Camera choreography and engine trails
 * remain reserved for their later migration stages.
 */
export const CINEMA2_AFTERHOURS_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_AFTERHOURS_PRESET_ID,
  revision: 2,
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
    Object.freeze({ id: 'audio.transport' as const, requirement: 'optional' as const, purpose: 'Pause/source lifecycle and transport-safe non-musical motion.' }),
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'Beat, beat2/beat4 trigger routing and BPM-synced scanner phase.' }),
    Object.freeze({ id: 'music.bar' as const, requirement: 'optional' as const, purpose: 'Bar and true bar4/bar8 trigger routing.' }),
    Object.freeze({ id: 'music.rhythm-events' as const, requirement: 'optional' as const, purpose: 'Kick/snare fixture-family accents and Trigger routing.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Broader structural bank accents and Trigger routing.' }),
    Object.freeze({ id: 'music.phrase' as const, requirement: 'optional' as const, purpose: 'Phrase-level structural accents and Trigger routing.' }),
    Object.freeze({ id: 'music.section' as const, requirement: 'optional' as const, purpose: 'Section-transition structural accents.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'Drop structure, peak topology selection, and Trigger routing.' }),
    Object.freeze({ id: 'music.vocal-presence' as const, requirement: 'optional' as const, purpose: 'Vocal restraint and negative-space management.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'Generic intensity, build, impact, and transition significance.' }),
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
      description: 'Grants broader topology and bank authority to the Cinema 2.0 show planner; when off, the authored Pattern and bank authorizations remain authoritative.',
      section: 'Design', group: 'Pattern', order: 31,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_AFTERHOURS_PATTERN_CHANGE_ID,
      label: 'Pattern Change', type: 'enum' as const, defaultValue: 'off', options: PATTERN_CHANGE_OPTIONS,
      description: 'Authored cadence consumed by the deterministic Cinema 2.0 show planner.',
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
      description: 'Uses canonical Cinema 2.0 music timing for scanner motion when enabled; never fabricates a private beat clock.',
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
      description: 'Ceiling for sparse phrase/section/drop structural blackout authority.',
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
        // Internal Target Runtime / Choreography inputs. These are deliberately
        // not user-facing parameters or persistent preset state.
        directorIntensity: 0,
        directorBuild: 0,
        directorImpact: 0,
        vocalPresence: 0,
        kickAccent: 0,
        snareAccent: 0,
        downbeatAccent: 0,
        phraseAccent: 0,
        sectionAccent: 0,
        dropAccent: 0,
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
  choreography: Object.freeze({
    rules: Object.freeze([
      Object.freeze({
        id: AFTERHOURS_DIRECTOR_INTENSITY_RULE_ID,
        priority: 20,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.intensity' as const, smoothingMs: 90 }),
        actions: Object.freeze([moduleContinuousAction('afterhours-director-intensity-map', 'directorIntensity')]),
      }),
      Object.freeze({
        id: AFTERHOURS_DIRECTOR_BUILD_RULE_ID,
        priority: 21,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 110 }),
        actions: Object.freeze([moduleContinuousAction('afterhours-director-build-map', 'directorBuild')]),
      }),
      Object.freeze({
        id: AFTERHOURS_DIRECTOR_IMPACT_RULE_ID,
        priority: 22,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.impact' as const, smoothingMs: 35 }),
        actions: Object.freeze([moduleContinuousAction('afterhours-director-impact-map', 'directorImpact')]),
      }),
      Object.freeze({
        id: AFTERHOURS_VOCAL_RULE_ID,
        priority: 23,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'music.vocal-presence' as const, path: 'audio.features.vocalPresence' as const, smoothingMs: 130 }),
        actions: Object.freeze([moduleContinuousAction('afterhours-vocal-presence-map', 'vocalPresence')]),
      }),
      Object.freeze({
        id: AFTERHOURS_KICK_RULE_ID,
        priority: 30,
        source: Object.freeze({ signal: 'kick' as const, capability: 'music.rhythm-events' as const }),
        actions: Object.freeze([moduleEnvelopeAction('afterhours-kick-envelope', 'kickAccent', 0.025, 0.18)]),
      }),
      Object.freeze({
        id: AFTERHOURS_SNARE_RULE_ID,
        priority: 31,
        source: Object.freeze({ signal: 'snare' as const, capability: 'music.rhythm-events' as const }),
        actions: Object.freeze([moduleEnvelopeAction('afterhours-snare-envelope', 'snareAccent', 0.025, 0.22)]),
      }),
      Object.freeze({
        id: AFTERHOURS_DOWNBEAT_RULE_ID,
        priority: 32,
        source: Object.freeze({ signal: 'downbeat' as const, capability: 'music.downbeat' as const }),
        actions: Object.freeze([moduleEnvelopeAction('afterhours-downbeat-envelope', 'downbeatAccent', 0.04, 0.28)]),
      }),
      Object.freeze({
        id: AFTERHOURS_PHRASE_RULE_ID,
        priority: 40,
        source: Object.freeze({ signal: 'phrase' as const, capability: 'music.phrase' as const }),
        actions: Object.freeze([moduleEnvelopeAction('afterhours-phrase-envelope', 'phraseAccent', 0.06, 0.55)]),
      }),
      Object.freeze({
        id: AFTERHOURS_SECTION_RULE_ID,
        priority: 41,
        source: Object.freeze({ signal: 'section-change' as const, capability: 'music.section' as const }),
        actions: Object.freeze([moduleEnvelopeAction('afterhours-section-envelope', 'sectionAccent', 0.075, 0.65)]),
      }),
      Object.freeze({
        id: AFTERHOURS_DROP_RULE_ID,
        priority: 50,
        source: Object.freeze({ signal: 'drop' as const, capability: 'music.drop' as const }),
        actions: Object.freeze([moduleEnvelopeAction('afterhours-drop-envelope', 'dropAccent', 0.1, 0.8)]),
      }),
    ]),
  }),
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
