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
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2RenderPassId,
  type Cinema2RenderSlotId,
  type Cinema2RenderTargetId,
  type Cinema2SceneNodeId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_BLOOM_EFFECT_TYPE_ID, CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID } from '../effects/Cinema2BuiltinEffects'
import {
  CINEMA2_ECHOFORM_NATIVE_MODULE_TYPE_ID,
  CINEMA2_ECHOFORM_NATIVE_MODULE_VERSION,
} from '../modules/Cinema2EchoformNativeModule'
import { CINEMA2_MAINFRAME_DEFAULT_PATTERN } from '../modules/mainframe/Cinema2MainframePatternEngine'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { CINEMA2_BACKSTREET_PATTERN_OPTIONS } from './Cinema2BackstreetPreset'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { cinema2CinematicMotion } from './Cinema2CameraMotionAuthoring'

export const CINEMA2_ECHOFORM_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.echoform')
export const CINEMA2_ECHOFORM_MODULE_ID = cinema2StableId<Cinema2ModuleId>('echoform-figure')

const ROOT_ID = cinema2StableId<Cinema2SceneNodeId>('echoform-root')
const NODE_ID = cinema2StableId<Cinema2SceneNodeId>('echoform-node')
const LAYER_ID = cinema2StableId<Cinema2LayerId>('echoform-layer')
const CAMERA_ID = cinema2StableId<Cinema2CameraId>('echoform-camera')
const SCENE_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('echoform-scene-target')
const TRAILS_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('echoform-trails-target')
const SCENE_PASS_ID = cinema2StableId<Cinema2RenderPassId>('echoform-scene-pass')
const TRAILS_PASS_ID = cinema2StableId<Cinema2RenderPassId>('echoform-trails-pass')
const BLOOM_PASS_ID = cinema2StableId<Cinema2RenderPassId>('echoform-bloom-pass')
const SCENE_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('echoform-scene-color')
const TRAILS_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('echoform-trails-color')
const TRAILS_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('echoform-trails-input')
const BLOOM_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('echoform-bloom-input')
const TRAILS_EFFECT_ID = cinema2StableId<Cinema2EffectId>('echoform-trails')
const BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('echoform-bloom')

export const CINEMA2_ECHOFORM_MASTER_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('echoform-master-intensity')
export const CINEMA2_ECHOFORM_BPM_SYNC_ID = cinema2StableId<Cinema2ParameterId>('echoform-bpm-sync')
export const CINEMA2_ECHOFORM_AUTO_PERFORMANCE_ID = cinema2StableId<Cinema2ParameterId>('echoform-auto-performance')
export const CINEMA2_ECHOFORM_SCALE_ID = cinema2StableId<Cinema2ParameterId>('echoform-figure-scale')
export const CINEMA2_ECHOFORM_MOTION_ID = cinema2StableId<Cinema2ParameterId>('echoform-motion-amount')
export const CINEMA2_ECHOFORM_RATE_ID = cinema2StableId<Cinema2ParameterId>('echoform-motion-rate')
export const CINEMA2_ECHOFORM_RECONSTRUCTION_ID = cinema2StableId<Cinema2ParameterId>('echoform-reconstruction')
export const CINEMA2_ECHOFORM_FRAGMENTATION_ID = cinema2StableId<Cinema2ParameterId>('echoform-fragmentation')
export const CINEMA2_ECHOFORM_ROTATION_ID = cinema2StableId<Cinema2ParameterId>('echoform-rotation-amount')
export const CINEMA2_ECHOFORM_POINT_DENSITY_ID = cinema2StableId<Cinema2ParameterId>('echoform-point-density')
export const CINEMA2_ECHOFORM_POINT_SIZE_ID = cinema2StableId<Cinema2ParameterId>('echoform-point-size')
export const CINEMA2_ECHOFORM_SHELL_COUNT_ID = cinema2StableId<Cinema2ParameterId>('echoform-shell-count')
export const CINEMA2_ECHOFORM_SHELL_SEPARATION_ID = cinema2StableId<Cinema2ParameterId>('echoform-shell-separation')
export const CINEMA2_ECHOFORM_BACKGROUND_ID = cinema2StableId<Cinema2ParameterId>('echoform-background')
export const CINEMA2_ECHOFORM_SHADOW_ID = cinema2StableId<Cinema2ParameterId>('echoform-shadow')
export const CINEMA2_ECHOFORM_METAL_ID = cinema2StableId<Cinema2ParameterId>('echoform-metal')
export const CINEMA2_ECHOFORM_HIGHLIGHT_ID = cinema2StableId<Cinema2ParameterId>('echoform-highlight')
export const CINEMA2_ECHOFORM_EYE_ID = cinema2StableId<Cinema2ParameterId>('echoform-eye')
export const CINEMA2_ECHOFORM_ACCENT_ID = cinema2StableId<Cinema2ParameterId>('echoform-accent')
export const CINEMA2_ECHOFORM_GLOW_ID = cinema2StableId<Cinema2ParameterId>('echoform-glow')
export const CINEMA2_ECHOFORM_TRAILS_ID = cinema2StableId<Cinema2ParameterId>('echoform-trails')
export const CINEMA2_ECHOFORM_PATTERN_ID = cinema2StableId<Cinema2ParameterId>('echoform-pattern')
export const CINEMA2_ECHOFORM_PATTERN_CHANGE_ID = cinema2StableId<Cinema2ParameterId>('echoform-pattern-change')
export const CINEMA2_ECHOFORM_TRIGGER_ID = cinema2StableId<Cinema2ParameterId>('echoform-trigger')
export const CINEMA2_ECHOFORM_IDLE_GLOW_ID = cinema2StableId<Cinema2ParameterId>('echoform-idle-glow')
/** Internal event-only parameter, never an Inspector control. */
export const CINEMA2_ECHOFORM_MUSICAL_CUE_ID = cinema2StableId<Cinema2ParameterId>('echoform-musical-cue')
const STRUCTURAL_EVENT_ID = cinema2StableId<Cinema2ParameterId>('echoform-structural-event')

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

const ruleId = (id: string) => cinema2StableId<Cinema2ChoreographyRuleId>(id)
const actionId = (id: string) => cinema2StableId<Cinema2ChoreographyActionId>(id)
const color = (r: number, g: number, b: number, a = 1): Cinema2Color => Object.freeze([r, g, b, a])

const parameterBase = {
  section: 'Design', exposure: 'primary' as const, modulatable: false, choreographable: false,
  automatable: false, persistence: 'preset' as const, reset: 'authored-default' as const,
}

function floatParameter(
  id: Cinema2ParameterId,
  label: string,
  description: string,
  defaultValue: number,
  min: number,
  max: number,
  step: number,
  designParentGroup: 'master-controls' | 'design' | 'effects',
  group: string,
  order: number,
) {
  return Object.freeze({ ...parameterBase, id, label, description, type: 'float' as const, defaultValue, min, max, step, designParentGroup, group, order })
}

function colorParameter(id: Cinema2ParameterId, label: string, description: string, defaultValue: Cinema2Color, order: number) {
  return Object.freeze({ ...parameterBase, id, label, description, type: 'color' as const, defaultValue, designParentGroup: 'palette' as const, group: 'Scan Palette', order })
}

function moduleContinuousAction(id: string, property: string) {
  return Object.freeze({
    id: actionId(id),
    target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_ECHOFORM_MODULE_ID), property }),
    operation: 'replace' as const,
    value: 1,
  })
}

function moduleEnvelopeAction(id: string, property: string, release: number, value = 1) {
  return Object.freeze({
    id: actionId(id),
    target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_ECHOFORM_MODULE_ID), property }),
    operation: 'envelope' as const,
    value,
    composition: 'replace' as const,
    envelope: Object.freeze({ attack: 0, hold: 0.04, release, unit: 'beats' as const }),
    retrigger: 'restart' as const,
  })
}

const PARAMETERS = Object.freeze([
  CINEMA2_QUALITY_MODE_PARAMETER,
  floatParameter(CINEMA2_ECHOFORM_MASTER_INTENSITY_ID, 'Master Intensity', 'Scales every music-driven reconstruction, shell pulse, sparkle, scatter and structural turn without overwriting the authored design values.', 0.8, 0, 1, 0.01, 'master-controls', 'Performance', 1),
  Object.freeze({ ...parameterBase, id: CINEMA2_ECHOFORM_BPM_SYNC_ID, label: 'BPM Sync', description: 'On: reconstruction, yaw and shell breathing follow the loaded track grid. Off: those motions continue smoothly at an authored 120 BPM while detected musical events remain active.', type: 'boolean' as const, defaultValue: true, designParentGroup: 'master-controls' as const, group: 'Performance', order: 2 }),
  Object.freeze({ ...parameterBase, id: CINEMA2_ECHOFORM_AUTO_PERFORMANCE_ID, label: 'Auto Performance', description: 'Allows phrase and section boundaries to reseed the point field and turn the flat layered figure to a new three-quarter orientation.', type: 'boolean' as const, defaultValue: true, designParentGroup: 'master-controls' as const, group: 'Performance', order: 3 }),

  floatParameter(CINEMA2_ECHOFORM_SCALE_ID, 'Figure Scale', 'Sizes the complete bulldog and headphone figure while keeping its authored center anchored.', 1, 0.55, 1.65, 0.01, 'design', 'Composition', 1),
  floatParameter(CINEMA2_ECHOFORM_MOTION_ID, 'Motion Amount', 'Blends from a stable authored reconstruction into the beat-timed dissolve cycle and shallow 3D turn.', 0.85, 0, 1, 0.01, 'design', 'Motion', 2),
  Object.freeze({ ...parameterBase, id: CINEMA2_ECHOFORM_RATE_ID, label: 'Motion Rate', description: 'Multiplies the reconstruction and turn clock.', type: 'enum' as const, defaultValue: '1x', options: Object.freeze([Object.freeze({ value: '1/2x', label: '1/2×' }), Object.freeze({ value: '1x', label: '1×' }), Object.freeze({ value: '2x', label: '2×' })]), designParentGroup: 'design' as const, group: 'Motion', order: 3 }),
  floatParameter(CINEMA2_ECHOFORM_RECONSTRUCTION_ID, 'Reconstruction', 'Sets the base amount of the figure that is present before the motion cycle and music add their response.', 0.62, 0, 1, 0.01, 'design', 'Formation', 4),
  floatParameter(CINEMA2_ECHOFORM_FRAGMENTATION_ID, 'Fragmentation', 'Breaks the SVG into sparse points and interrupted topology while preserving the bulldog silhouette.', 0.18, 0, 1, 0.01, 'design', 'Formation', 5),
  floatParameter(CINEMA2_ECHOFORM_ROTATION_ID, 'Turn Amount', 'Sets the maximum shallow 3D yaw of the otherwise flat layered SVG.', 26, 0, 55, 1, 'design', 'Motion', 6),
  Object.freeze({ ...parameterBase, id: CINEMA2_ECHOFORM_POINT_DENSITY_ID, label: 'Point Density', description: 'Sets the density of the sampled SVG point field.', type: 'enum' as const, defaultValue: 'Reference', options: Object.freeze([Object.freeze({ value: 'Sparse', label: 'Sparse' }), Object.freeze({ value: 'Reference', label: 'Reference' }), Object.freeze({ value: 'Dense', label: 'Dense' })]), designParentGroup: 'design' as const, group: 'Point Field', order: 7 }),
  floatParameter(CINEMA2_ECHOFORM_POINT_SIZE_ID, 'Point Size', 'Sets the size of individual reconstruction particles.', 0.24, 0.12, 0.62, 0.01, 'design', 'Point Field', 8),
  Object.freeze({ ...parameterBase, id: CINEMA2_ECHOFORM_SHELL_COUNT_ID, label: 'Shell Layers', description: 'Retained for compatibility; the figure now uses the artwork\u2019s own layers as depth.', type: 'enum' as const, defaultValue: 'Reference', options: Object.freeze([Object.freeze({ value: 'Single', label: 'Single' }), Object.freeze({ value: 'Reference', label: 'Reference' }), Object.freeze({ value: 'Deep', label: 'Deep' })]), designParentGroup: 'design' as const, group: 'Shells', order: 9 }),
  floatParameter(CINEMA2_ECHOFORM_SHELL_SEPARATION_ID, 'Shell Separation', 'Spreads the artwork\u2019s layers apart in depth, so a turn shows more parallax.', 0.8, 0, 1.2, 0.01, 'design', 'Shells', 10),

  colorParameter(CINEMA2_ECHOFORM_BACKGROUND_ID, 'Background', 'The negative-space field behind the figure.', color(0.002, 0.002, 0.002), 1),
  colorParameter(CINEMA2_ECHOFORM_SHADOW_ID, 'Shadow', 'The magenta stipple that fills the dark mass of the figure mid-cycle.', color(0.62, 0.1, 0.42), 2),
  colorParameter(CINEMA2_ECHOFORM_METAL_ID, 'Metal', 'The electric blue of the outline rings, wire mesh and most points.', color(0.1, 0.38, 0.95), 3),
  colorParameter(CINEMA2_ECHOFORM_HIGHLIGHT_ID, 'Highlight', 'The cyan-white of sparkling points, wire nodes and the brightest outline.', color(0.42, 0.9, 1), 4),
  colorParameter(CINEMA2_ECHOFORM_EYE_ID, 'Eye Cyan', 'The bright cyan of the focal features (the eyes) and the strongest glow.', color(0.05, 0.9, 1), 5),
  colorParameter(CINEMA2_ECHOFORM_ACCENT_ID, 'Topology Accent', 'The violet accent threaded through the wire mesh and outline.', color(0.55, 0.2, 0.85), 6),

  Object.freeze({ ...parameterBase, id: CINEMA2_ECHOFORM_PATTERN_ID, label: 'Pattern', description: 'Selects one of Mainframe\u2019s six lighting programs, laid over the figure\u2019s own geometry: Center Out and Edges In run between the middle of the figure and its edge, Marquee chases vertical bars across it, Quadrant Relay passes light round the head, Radar Sweep turns a beam round it, and Surge charges the figure and flashes it on a drop.', type: 'enum' as const, defaultValue: CINEMA2_MAINFRAME_DEFAULT_PATTERN, options: CINEMA2_BACKSTREET_PATTERN_OPTIONS, designParentGroup: 'effects' as const, group: 'Pattern', order: 1 }),
  Object.freeze({ ...parameterBase, id: CINEMA2_ECHOFORM_PATTERN_CHANGE_ID, label: 'Pattern Change', description: 'When enabled, each qualified Trigger advances through a deterministic shuffled cycle with no immediate repeat.', type: 'boolean' as const, defaultValue: false, designParentGroup: 'effects' as const, group: 'Pattern', order: 2 }),
  Object.freeze({ ...parameterBase, id: CINEMA2_ECHOFORM_TRIGGER_ID, label: 'Trigger', description: 'Chooses the musical event that advances to the next lighting program while Pattern Change is enabled.', type: 'enum' as const, defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: CINEMA2_ECHOFORM_PATTERN_CHANGE_ID, value: true })]), designParentGroup: 'effects' as const, group: 'Pattern', order: 3 }),
  floatParameter(CINEMA2_ECHOFORM_IDLE_GLOW_ID, 'Idle Glow', 'How much of the figure stays lit between hits. 1 keeps all of it present with the programs riding on top; 0 lets a program switch the parts it is not addressing right down.', 0.45, 0, 1, 0.01, 'effects', 'Pattern', 4),
  floatParameter(CINEMA2_ECHOFORM_GLOW_ID, 'Glow', 'Adds bloom to the silver highlights, eyes and reconstructed topology.', 0.38, 0, 1, 0.01, 'effects', 'Finish', 1),
  floatParameter(CINEMA2_ECHOFORM_TRAILS_ID, 'Trails', 'Retains restrained afterimages from real turns and shell movement.', 0.22, 0, 1, 0.01, 'effects', 'Finish', 2),
  Object.freeze({ id: CINEMA2_ECHOFORM_MUSICAL_CUE_ID, label: 'Musical Cue', type: 'trigger' as const, section: 'React', group: 'Runtime', order: 998, exposure: 'hidden' as const, persistence: 'runtime-only' as const, reset: 'none' as const }),
  Object.freeze({ id: STRUCTURAL_EVENT_ID, label: 'Structural Event', type: 'trigger' as const, section: 'React', group: 'Runtime', order: 999, exposure: 'hidden' as const, persistence: 'runtime-only' as const, reset: 'none' as const }),
])

export const CINEMA2_ECHOFORM_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_ECHOFORM_PRESET_ID,
  revision: 1,
  metadata: Object.freeze({
    name: 'Echoform',
    description: 'The GOONZ bulldog-with-headphones SVG rebuilt from its own vector outlines as a scanned point cloud: blue wire contours, a triangulated wire mesh with bright nodes, stippled tone and cyan eyes over black, with every layer of the artwork at its own depth. It assembles, holds, thins to its outline and evaporates on the musical clock while phrase and section changes turn the layered figure through shallow 3D space.',
    tags: Object.freeze(['echoform', 'goonz', 'native', 'svg', 'particles', 'topology', 'audio-reactive', 'keeper']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native SVG-texture reconstruction and point/topology shading.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Depth-tested separation between the flat SVG shell layers.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'The flat layered SVG turns within world space without being extruded.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Shared perspective camera frames the shallow three-dimensional turns.' }),
    Object.freeze({ id: 'audio.bands' as const, requirement: 'optional' as const, purpose: 'Bass expands shells and high frequencies scintillate points.' }),
    Object.freeze({ id: 'audio.features' as const, requirement: 'optional' as const, purpose: 'Overall energy reconstructs the figure and spectral flux fragments it.' }),
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'Beat events pulse the topology and shell stack.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Downbeats briefly pull the complete bulldog into focus.' }),
    Object.freeze({ id: 'music.rhythm-events' as const, requirement: 'optional' as const, purpose: 'Kicks scatter the point field.' }),
    Object.freeze({ id: 'music.phrase' as const, requirement: 'optional' as const, purpose: 'Phrase boundaries reseed and turn the layered figure.' }),
    Object.freeze({ id: 'music.section' as const, requirement: 'optional' as const, purpose: 'Section changes trigger stronger deterministic turns.' }),
    Object.freeze({ id: 'music.bar' as const, requirement: 'optional' as const, purpose: 'Canonical bar accents for the lighting programs.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'Drops produce the bounded full-figure surge.' }),
    Object.freeze({ id: 'music.build' as const, requirement: 'optional' as const, purpose: 'Build progress charges the Surge program.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'Shared intensity, momentum, build and impact authority.' }),
    Object.freeze({ id: 'render.history' as const, requirement: 'optional' as const, purpose: 'Transport-aware feedback trails retain real shell movement.' }),
  ]),
  parameters: PARAMETERS,
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_ECHOFORM_MODULE_ID,
    typeId: CINEMA2_ECHOFORM_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_ECHOFORM_NATIVE_MODULE_VERSION,
    enabled: true,
    parameters: Object.freeze({
      masterIntensity: 0.8, bpmSync: true, autoPerformance: true, figureScale: 1, motionAmount: 0.85, motionRate: '1x',
      reconstruction: 0.62, fragmentation: 0.18, rotationAmount: 26, pointDensity: 'Reference', pointSize: 0.24,
      shellCount: 'Reference', shellSeparation: 0.8,
      backgroundColor: color(0.002, 0.002, 0.002), shadowColor: color(0.62, 0.1, 0.42), metalColor: color(0.1, 0.38, 0.95),
      highlightColor: color(0.42, 0.9, 1), eyeColor: color(0.05, 0.9, 1), accentColor: color(0.55, 0.2, 0.85),
      pattern: CINEMA2_MAINFRAME_DEFAULT_PATTERN, patternChange: false, trigger: 'bar4', idleGlow: 0.45,
      overallEnergy: 0, bassEnergy: 0, highEnergy: 0, spectralFlux: 0, beatPulse: 0, downbeatReveal: 0, kickScatter: 0, sectionTurn: 0,
    }),
    parameterBindings: Object.freeze({
      masterIntensity: cinema2Ref(CINEMA2_ECHOFORM_MASTER_INTENSITY_ID), bpmSync: cinema2Ref(CINEMA2_ECHOFORM_BPM_SYNC_ID), autoPerformance: cinema2Ref(CINEMA2_ECHOFORM_AUTO_PERFORMANCE_ID),
      figureScale: cinema2Ref(CINEMA2_ECHOFORM_SCALE_ID), motionAmount: cinema2Ref(CINEMA2_ECHOFORM_MOTION_ID), motionRate: cinema2Ref(CINEMA2_ECHOFORM_RATE_ID),
      reconstruction: cinema2Ref(CINEMA2_ECHOFORM_RECONSTRUCTION_ID), fragmentation: cinema2Ref(CINEMA2_ECHOFORM_FRAGMENTATION_ID), rotationAmount: cinema2Ref(CINEMA2_ECHOFORM_ROTATION_ID),
      pointDensity: cinema2Ref(CINEMA2_ECHOFORM_POINT_DENSITY_ID), pointSize: cinema2Ref(CINEMA2_ECHOFORM_POINT_SIZE_ID), shellCount: cinema2Ref(CINEMA2_ECHOFORM_SHELL_COUNT_ID),
      shellSeparation: cinema2Ref(CINEMA2_ECHOFORM_SHELL_SEPARATION_ID), backgroundColor: cinema2Ref(CINEMA2_ECHOFORM_BACKGROUND_ID), shadowColor: cinema2Ref(CINEMA2_ECHOFORM_SHADOW_ID),
      metalColor: cinema2Ref(CINEMA2_ECHOFORM_METAL_ID), highlightColor: cinema2Ref(CINEMA2_ECHOFORM_HIGHLIGHT_ID), eyeColor: cinema2Ref(CINEMA2_ECHOFORM_EYE_ID), accentColor: cinema2Ref(CINEMA2_ECHOFORM_ACCENT_ID),
      pattern: cinema2Ref(CINEMA2_ECHOFORM_PATTERN_ID), patternChange: cinema2Ref(CINEMA2_ECHOFORM_PATTERN_CHANGE_ID), trigger: cinema2Ref(CINEMA2_ECHOFORM_TRIGGER_ID), idleGlow: cinema2Ref(CINEMA2_ECHOFORM_IDLE_GLOW_ID),
    }),
    actionBindings: Object.freeze({ structuralEvent: cinema2Ref(STRUCTURAL_EVENT_ID), musicalCue: cinema2Ref(CINEMA2_ECHOFORM_MUSICAL_CUE_ID) }),
    config: Object.freeze({ label: 'Echoform GOONZ SVG Figure' }),
  })]),
  choreography: Object.freeze({ rules: Object.freeze([
    // Mainframe's orchestration engine: the same musical cues, from the same shared choreography runtime.
    ...MUSIC_CUES.map(([kind, signal, capability], index) => Object.freeze({
      id: ruleId(`echoform-${kind === 'fourBeat' ? 'four-beat' : kind}-event`),
      priority: 40 + index,
      source: Object.freeze({ signal, capability }),
      actions: Object.freeze([Object.freeze({
        id: actionId(`echoform-${kind === 'fourBeat' ? 'four-beat' : kind}-cue`),
        target: Object.freeze({ kind: 'parameter' as const, ref: cinema2Ref(CINEMA2_ECHOFORM_MUSICAL_CUE_ID) }),
        operation: 'spawn' as const,
        value: Object.freeze({ kind }),
      })]),
    })),
    Object.freeze({ id: ruleId('echoform-energy'), priority: 10, strengthParameter: cinema2Ref(CINEMA2_ECHOFORM_MASTER_INTENSITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.features' as const, path: 'audio.features.overallEnergy' as const, smoothingMs: 170 }), actions: Object.freeze([moduleContinuousAction('echoform-energy-action', 'overallEnergy')]) }),
    Object.freeze({ id: ruleId('echoform-bass'), priority: 11, strengthParameter: cinema2Ref(CINEMA2_ECHOFORM_MASTER_INTENSITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.bands' as const, path: 'audio.bands.bass' as const, smoothingMs: 90 }), actions: Object.freeze([moduleContinuousAction('echoform-bass-action', 'bassEnergy')]) }),
    Object.freeze({ id: ruleId('echoform-high'), priority: 12, strengthParameter: cinema2Ref(CINEMA2_ECHOFORM_MASTER_INTENSITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.bands' as const, path: 'audio.bands.high' as const, smoothingMs: 120 }), actions: Object.freeze([moduleContinuousAction('echoform-high-action', 'highEnergy')]) }),
    Object.freeze({ id: ruleId('echoform-flux'), priority: 13, strengthParameter: cinema2Ref(CINEMA2_ECHOFORM_MASTER_INTENSITY_ID), source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.features' as const, path: 'audio.features.spectralFlux' as const, smoothingMs: 100 }), actions: Object.freeze([moduleContinuousAction('echoform-flux-action', 'spectralFlux')]) }),
    Object.freeze({ id: ruleId('echoform-beat'), priority: 20, source: Object.freeze({ signal: 'beat' as const, capability: 'music.beat' as const }), actions: Object.freeze([moduleEnvelopeAction('echoform-beat-action', 'beatPulse', 0.42)]) }),
    Object.freeze({ id: ruleId('echoform-downbeat'), priority: 21, source: Object.freeze({ signal: 'downbeat' as const, capability: 'music.downbeat' as const }), actions: Object.freeze([moduleEnvelopeAction('echoform-downbeat-action', 'downbeatReveal', 0.8)]) }),
    Object.freeze({ id: ruleId('echoform-kick'), priority: 22, source: Object.freeze({ signal: 'kick' as const, capability: 'music.rhythm-events' as const }), actions: Object.freeze([moduleEnvelopeAction('echoform-kick-action', 'kickScatter', 0.36)]) }),
    Object.freeze({ id: ruleId('echoform-phrase-turn'), priority: 30, enabledParameter: cinema2Ref(CINEMA2_ECHOFORM_AUTO_PERFORMANCE_ID), source: Object.freeze({ signal: 'phrase' as const, capability: 'music.phrase' as const }), actions: Object.freeze([
      Object.freeze({ id: actionId('echoform-phrase-event'), target: Object.freeze({ kind: 'parameter' as const, ref: cinema2Ref(STRUCTURAL_EVENT_ID) }), operation: 'spawn' as const, value: Object.freeze({ kind: 'phrase' }) }),
      moduleEnvelopeAction('echoform-phrase-turn-action', 'sectionTurn', 3, 0.72),
    ]) }),
    Object.freeze({ id: ruleId('echoform-section-turn'), priority: 31, enabledParameter: cinema2Ref(CINEMA2_ECHOFORM_AUTO_PERFORMANCE_ID), source: Object.freeze({ signal: 'section-change' as const, capability: 'music.section' as const }), actions: Object.freeze([
      Object.freeze({ id: actionId('echoform-section-event'), target: Object.freeze({ kind: 'parameter' as const, ref: cinema2Ref(STRUCTURAL_EVENT_ID) }), operation: 'spawn' as const, value: Object.freeze({ kind: 'section' }) }),
      moduleEnvelopeAction('echoform-section-turn-action', 'sectionTurn', 4),
    ]) }),
  ]) }),
  scene: Object.freeze({ nodes: Object.freeze([
    Object.freeze({ id: ROOT_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
    Object.freeze({ id: NODE_ID, kind: 'module' as const, parent: cinema2Ref(ROOT_ID), module: cinema2Ref(CINEMA2_ECHOFORM_MODULE_ID), transform: Object.freeze({ position: Object.freeze([0, 0, 0] as const) }) }),
  ]), roots: Object.freeze([cinema2Ref(ROOT_ID)]) }),
  layers: Object.freeze([Object.freeze({ id: LAYER_ID, label: 'Echoform Figure', source: cinema2Ref(ROOT_ID), role: 'world', visible: true, opacity: 1, blendMode: 'normal', depthPolicy: 'read-write', order: 0 })]),
  cameras: Object.freeze([Object.freeze({
    id: CAMERA_ID, label: 'Echoform Portrait', projection: 'perspective' as const, fovDegrees: 32, near: 0.05, far: 30,
    transform: Object.freeze({ position: Object.freeze([0, 0, 4.15] as const) }), target: Object.freeze([0, 0, 0] as const), rig: Object.freeze({ kind: 'static' as const }),
    motion: cinema2CinematicMotion('steady', { overrides: Object.freeze({ drift: Object.freeze({ position: 0.025, target: 0.012, rollDegrees: 0.25, fovDegrees: 0.35, speed: 0.05 }), tempo: Object.freeze({ referenceBpm: 120, flightSpeed: false, weave: 0.025, bob: 0.006, roll: 0.2, fov: 0.35, punch: 0.45 }) }) }),
    controls: Object.freeze({ motionAmount: cinema2Ref(CINEMA2_ECHOFORM_MOTION_ID), tempoSync: cinema2Ref(CINEMA2_ECHOFORM_BPM_SYNC_ID) }),
  })]),
  defaults: Object.freeze({ camera: cinema2Ref(CAMERA_ID) }),
  environment: Object.freeze({ backgroundColor: color(0.002, 0.002, 0.002), exposure: 1, controls: Object.freeze({ backgroundColor: cinema2Ref(CINEMA2_ECHOFORM_BACKGROUND_ID) }) }),
  effects: Object.freeze([
    Object.freeze({ id: TRAILS_EFFECT_ID, typeId: CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID, version: 1, enabled: true, order: 0, scope: 'output' as const, quality: Object.freeze({ min: 'low' as const }), parameters: Object.freeze({ mix: 0.22, persistence: 0.86, drift: 0, transportAware: true }), parameterBindings: Object.freeze({ mix: cinema2Ref(CINEMA2_ECHOFORM_TRAILS_ID) }) }),
    Object.freeze({ id: BLOOM_EFFECT_ID, typeId: CINEMA2_BLOOM_EFFECT_TYPE_ID, version: 1, enabled: true, order: 1, scope: 'output' as const, quality: Object.freeze({ min: 'low' as const }), parameters: Object.freeze({ mix: 0.38, threshold: 0.62, radius: 1.1, intensity: 1.35 }), parameterBindings: Object.freeze({ mix: cinema2Ref(CINEMA2_ECHOFORM_GLOW_ID) }) }),
  ]),
  render: Object.freeze({
    targets: Object.freeze([
      Object.freeze({ id: SCENE_TARGET_ID, descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba8' as const, depthFormat: 'depth24' as const }), ownership: 'transient' as const }),
      Object.freeze({ id: TRAILS_TARGET_ID, descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba8' as const, depthFormat: 'none' as const }), ownership: 'transient' as const }),
    ]),
    passes: Object.freeze([
      Object.freeze({ id: SCENE_PASS_ID, kind: 'scene' as const, layers: Object.freeze([cinema2Ref(LAYER_ID)]), outputs: Object.freeze([Object.freeze({ id: SCENE_OUTPUT_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'color' as const })]) }),
      Object.freeze({ id: TRAILS_PASS_ID, kind: 'fullscreen' as const, effect: cinema2Ref(TRAILS_EFFECT_ID), inputs: Object.freeze([Object.freeze({ id: TRAILS_INPUT_ID, source: Object.freeze({ pass: cinema2Ref(SCENE_PASS_ID), output: SCENE_OUTPUT_ID }) })]), outputs: Object.freeze([Object.freeze({ id: TRAILS_OUTPUT_ID, target: cinema2Ref(TRAILS_TARGET_ID), attachment: 'color' as const })]) }),
      Object.freeze({ id: BLOOM_PASS_ID, kind: 'fullscreen' as const, effect: cinema2Ref(BLOOM_EFFECT_ID), inputs: Object.freeze([Object.freeze({ id: BLOOM_INPUT_ID, source: Object.freeze({ pass: cinema2Ref(TRAILS_PASS_ID), output: TRAILS_OUTPUT_ID }) })]) }),
    ]),
    outputPass: cinema2Ref(BLOOM_PASS_ID),
  }),
  output: Object.freeze({ renderPass: cinema2Ref(BLOOM_PASS_ID), colorSpace: 'srgb' as const, alphaMode: 'premultiplied' as const }),
})
