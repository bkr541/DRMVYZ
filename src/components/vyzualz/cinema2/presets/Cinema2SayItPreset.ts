import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleId,
  type Cinema2Color,
  type Cinema2DesignParentGroup,
  type Cinema2EffectId,
  type Cinema2EffectTypeId,
  type Cinema2LayerId,
  type Cinema2LightId,
  type Cinema2JsonValue,
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
import { CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID } from '../effects/Cinema2BuiltinEffects'
import { CINEMA2_DEPTH_OF_FIELD_EFFECT_TYPE_ID } from '../effects/Cinema2DepthOfFieldEffect'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_SAY_IT_MODULE_TYPE_ID } from '../modules/Cinema2SayItNativeModule'
import {
  CINEMA2_SAY_IT_DEFAULT_PATTERN,
  CINEMA2_SAY_IT_PATTERN_IDS,
  type Cinema2SayItPatternId,
} from '../modules/sayIt/Cinema2SayItPatternController'
import {
  CINEMA2_SAY_IT_CAMERA_DISTANCE,
  CINEMA2_SAY_IT_CAMERA_FOV_DEGREES,
  CINEMA2_SAY_IT_COMPOSED_MIN_ASPECT,
} from '../modules/sayIt/Cinema2SayItQuality'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'

export const CINEMA2_SAY_IT_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.say-it')
export const CINEMA2_SAY_IT_MODULE_ID = cinema2StableId<Cinema2ModuleId>('say-it-glyphs')

const parameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`say-it-${name}`)
export const CINEMA2_SAY_IT_LINE_ONE_TEXT_ID = parameterId('text')
export const CINEMA2_SAY_IT_LINE_TWO_TEXT_ID = parameterId('line-2-text')
/** Backwards-compatible alias for the original first-line parameter ID. */
export const CINEMA2_SAY_IT_TEXT_ID = CINEMA2_SAY_IT_LINE_ONE_TEXT_ID
export const CINEMA2_SAY_IT_MOTION_ID = parameterId('motion')
export const CINEMA2_SAY_IT_MOTION_PROGRAM_ID = parameterId('motion-program')
export const CINEMA2_SAY_IT_MOTION_DIRECTION_ID = parameterId('motion-direction')
export const CINEMA2_SAY_IT_MOTION_SAFETY_ID = parameterId('motion-safety')
export const CINEMA2_SAY_IT_GLYPH_DELAY_ID = parameterId('glyph-delay')
export const CINEMA2_SAY_IT_AXIS_X_ID = parameterId('axis-x')
export const CINEMA2_SAY_IT_AXIS_Y_ID = parameterId('axis-y')
export const CINEMA2_SAY_IT_AXIS_Z_ID = parameterId('axis-z')
export const CINEMA2_SAY_IT_RANDOM_SEED_ID = parameterId('random-seed')
export const CINEMA2_SAY_IT_AUTO_PERFORMANCE_ID = parameterId('auto-performance')
export const CINEMA2_SAY_IT_BPM_SYNC_ID = parameterId('bpm-sync')
export const CINEMA2_SAY_IT_CYCLE_ID = parameterId('cycle-seconds')
export const CINEMA2_SAY_IT_SPREAD_ID = parameterId('spread')
export const CINEMA2_SAY_IT_LINE_MODE_ID = parameterId('line-mode')
export const CINEMA2_SAY_IT_ALIGNMENT_ID = parameterId('alignment')
export const CINEMA2_SAY_IT_TRACKING_ID = parameterId('tracking')
export const CINEMA2_SAY_IT_LINE_SPACING_ID = parameterId('line-spacing')
export const CINEMA2_SAY_IT_GLYPH_SCALE_ID = parameterId('glyph-scale')
export const CINEMA2_SAY_IT_ROUGHNESS_ID = parameterId('roughness')
export const CINEMA2_SAY_IT_MATERIAL_STYLE_ID = parameterId('material-style')
export const CINEMA2_SAY_IT_REFLECTION_ID = parameterId('environment-reflection')
export const CINEMA2_SAY_IT_SWEEP_ID = parameterId('highlight-sweep')
export const CINEMA2_SAY_IT_CAMERA_MOTION_ID = parameterId('camera-motion')
export const CINEMA2_SAY_IT_TRAILS_ID = parameterId('trails')
export const CINEMA2_SAY_IT_FOCUS_ID = parameterId('focus')
export const CINEMA2_SAY_IT_BLOOM_ID = parameterId('bloom')
export const CINEMA2_SAY_IT_FINISH_ID = parameterId('finish')
export const CINEMA2_SAY_IT_BACKGROUND_ID = parameterId('background')
export const CINEMA2_SAY_IT_CHROME_ID = parameterId('chrome')
export const CINEMA2_SAY_IT_LED_OUTLINE_ID = parameterId('led-outline')
export const CINEMA2_SAY_IT_OUTLINE_COLOR_ID = parameterId('outline-color')
export const CINEMA2_SAY_IT_PATTERN_ID = parameterId('pattern')
export const CINEMA2_SAY_IT_PATTERN_CHANGE_ID = parameterId('pattern-change')
export const CINEMA2_SAY_IT_TRIGGER_ID = parameterId('trigger')

export const CINEMA2_SAY_IT_CAMERA_ID = cinema2StableId<Cinema2CameraId>('say-it-camera')
const ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('say-it-world-root')
const GLYPH_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('say-it-glyph-node')
const FOCUS_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('say-it-focus')
const WORLD_LAYER_ID = cinema2StableId<Cinema2LayerId>('say-it-world-layer')
const KEY_LIGHT_ID = cinema2StableId<Cinema2LightId>('say-it-key')
const RIM_LIGHT_ID = cinema2StableId<Cinema2LightId>('say-it-rim')
const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('say-it-ambient')

const FINISH_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('cinematic-finish')
const TRAILS_EFFECT_ID = cinema2StableId<Cinema2EffectId>('say-it-trails-effect')
const FOCUS_EFFECT_ID = cinema2StableId<Cinema2EffectId>('say-it-focus-effect')
const BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('say-it-bloom-effect')
const FINISH_EFFECT_ID = cinema2StableId<Cinema2EffectId>('say-it-finish-effect')

const SCENE_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('say-it-scene-target')
const TRAILS_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('say-it-trails-target')
const FOCUS_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('say-it-focus-target')
const BLOOM_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('say-it-bloom-target')
const SCENE_PASS_ID = cinema2StableId<Cinema2RenderPassId>('say-it-scene-pass')
const TRAILS_PASS_ID = cinema2StableId<Cinema2RenderPassId>('say-it-trails-pass')
const FOCUS_PASS_ID = cinema2StableId<Cinema2RenderPassId>('say-it-focus-pass')
const BLOOM_PASS_ID = cinema2StableId<Cinema2RenderPassId>('say-it-bloom-pass')
const FINISH_PASS_ID = cinema2StableId<Cinema2RenderPassId>('say-it-finish-pass')
const SCENE_COLOR_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('say-it-scene-color')
const SCENE_DEPTH_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('say-it-scene-depth')
const TRAILS_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('say-it-trails-input')
const TRAILS_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('say-it-trails-output')
const FOCUS_COLOR_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('say-it-focus-color-input')
const FOCUS_DEPTH_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('say-it-focus-depth-input')
const FOCUS_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('say-it-focus-output')
const BLOOM_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('say-it-bloom-input')
const BLOOM_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('say-it-bloom-output')
const FINISH_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('say-it-finish-input')

function vec3(x: number, y: number, z: number): Cinema2Vector3 { return Object.freeze([x, y, z]) }
function color(r: number, g: number, b: number, a = 1): Cinema2Color { return Object.freeze([r, g, b, a]) }

const DEFAULT_BACKGROUND = color(0.002, 0.003, 0.005)
const DEFAULT_CHROME = color(0.82, 0.84, 0.88)
const DEFAULT_OUTLINE = color(0.16, 0.92, 1)

const PATTERN_LABELS: Readonly<Record<Cinema2SayItPatternId, string>> = Object.freeze({
  solid: 'Solid Glow',
  pulse: 'Pulse',
  'letter-chase': 'Letter Chase',
  alternate: 'Alternate',
  'center-wave': 'Center Wave',
  strobe: 'Strobe',
})
const PATTERN_OPTIONS = Object.freeze(CINEMA2_SAY_IT_PATTERN_IDS.map(value => Object.freeze({ value, label: PATTERN_LABELS[value] })))

function base(
  id: Cinema2ParameterId,
  label: string,
  description: string,
  parent: Cinema2DesignParentGroup,
  order: number,
  group: string,
) {
  return {
    id, label, description, section: 'Design', group, designParentGroup: parent, order,
    exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    modulatable: true, choreographable: true, automatable: false,
  }
}

function floatParameter(
  id: Cinema2ParameterId,
  label: string,
  description: string,
  parent: Cinema2DesignParentGroup,
  order: number,
  group: string,
  defaultValue: number,
  min: number,
  max: number,
  step: number,
) {
  return Object.freeze({ ...base(id, label, description, parent, order, group), type: 'float' as const, defaultValue, min, max, step })
}

const choreographyRuleId = (id: string) => cinema2StableId<Cinema2ChoreographyRuleId>(id)
const choreographyActionId = (id: string) => cinema2StableId<Cinema2ChoreographyActionId>(id)

const moduleEnvelopeAction = (id: string, property: string, hold: number, release: number) => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_SAY_IT_MODULE_ID), property }),
  operation: 'envelope' as const,
  value: 1,
  composition: 'replace' as const,
  envelope: Object.freeze({ attack: 0.02, hold, release, unit: 'seconds' as const }),
  retrigger: 'restart' as const,
})

const moduleContinuousAction = (id: string, property: string) => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_SAY_IT_MODULE_ID), property }),
  operation: 'replace' as const,
  value: 1,
})

const cameraContinuousAddAction = (id: string, property: string, value: Cinema2JsonValue) => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'camera' as const, ref: cinema2Ref(CINEMA2_SAY_IT_CAMERA_ID), property }),
  operation: 'add' as const,
  value,
})

const cameraEnvelopeAddAction = (id: string, property: string, value: Cinema2JsonValue, hold: number, release: number) => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'camera' as const, ref: cinema2Ref(CINEMA2_SAY_IT_CAMERA_ID), property }),
  operation: 'envelope' as const,
  value,
  composition: 'add' as const,
  envelope: Object.freeze({ attack: 0.04, hold, release, unit: 'seconds' as const }),
  retrigger: 'restart' as const,
})

const effectEnvelopeAddAction = (id: string, effect: Cinema2EffectId, property: string, value: number, hold: number, release: number) => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'effect' as const, ref: cinema2Ref(effect), property }),
  operation: 'envelope' as const,
  value,
  composition: 'add' as const,
  envelope: Object.freeze({ attack: 0.02, hold, release, unit: 'seconds' as const }),
  retrigger: 'restart' as const,
})

const effectContinuousAddAction = (id: string, effect: Cinema2EffectId, property: string, value: number) => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'effect' as const, ref: cinema2Ref(effect), property }),
  operation: 'add' as const,
  value,
})

/**
 * Editable one/two-line kinetic 3D type backed by the versioned printable Basic
 * Latin glyph package. The preset name and authored default remain SAY IT.
 */
export const CINEMA2_SAY_IT_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_SAY_IT_PRESET_ID,
  revision: 8,
  metadata: Object.freeze({
    name: 'SAY IT',
    description: 'Type one or two short lines of bevelled chrome text. Every character breaks apart through independent 3D rotations, then resolves precisely.',
    tags: Object.freeze(['keeper', 'kinetic-type', '3d', 'chrome', 'say-it']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native Cinema 2.0 3D rendering.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Correct depth ordering while independently rotating letters cross one another.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'World-space extruded glyph meshes and transforms.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'A shared perspective camera frames the complete wordmark.' }),
    Object.freeze({ id: 'lighting' as const, requirement: 'required' as const, purpose: 'PBR chrome needs authored key, rim and ambient lighting.' }),
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'BPM Sync can pace the deterministic motion cycle from the track beat grid.' }),
    Object.freeze({ id: 'music.rhythm-events' as const, requirement: 'optional' as const, purpose: 'Shared kick, snare and transient events drive short LED impacts.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Downbeats add a bounded motion accent.' }),
    Object.freeze({ id: 'music.phrase' as const, requirement: 'optional' as const, purpose: 'Phrase boundaries add a broader kinetic and camera accent.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'Drops add the strongest bounded motion, trail and camera accent.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'Build energy increases motion and restrained trails.' }),
    Object.freeze({ id: 'render.history' as const, requirement: 'optional' as const, purpose: 'Engine-owned feedback history provides optional trails.' }),
  ]),
  parameters: Object.freeze([
    CINEMA2_QUALITY_MODE_PARAMETER,
    Object.freeze({
      ...base(CINEMA2_SAY_IT_LINE_ONE_TEXT_ID, 'Line 1', 'First line of printable English letters, numbers and punctuation; limited to 12 characters.', 'master-controls', 1, 'Text'),
      type: 'string' as const,
      defaultValue: 'SAY IT',
      modulatable: false,
      choreographable: false,
    }),
    Object.freeze({
      ...base(CINEMA2_SAY_IT_LINE_TWO_TEXT_ID, 'Line 2', 'Second line of printable English letters, numbers and punctuation; limited to 12 characters and 20 total across both lines.', 'master-controls', 2, 'Text'),
      type: 'string' as const,
      defaultValue: '',
      modulatable: false,
      choreographable: false,
      visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: CINEMA2_SAY_IT_LINE_MODE_ID, value: 'two' })]),
    }),
    floatParameter(CINEMA2_SAY_IT_MOTION_ID, 'Motion Amount', 'How far the letters travel and how strongly they rotate. At 0 the phrase stays assembled.', 'master-controls', 3, 'Playback', 1, 0, 1, 0.01),
    Object.freeze({
      ...base(CINEMA2_SAY_IT_BPM_SYNC_ID, 'BPM Sync', 'Follow the detected track tempo. Off uses the reference rate of 120 BPM.', 'master-controls', 4, 'Playback'),
      type: 'boolean' as const,
      defaultValue: true,
    }),
    Object.freeze({
      ...base(CINEMA2_SAY_IT_AUTO_PERFORMANCE_ID, 'Auto Performance', 'Allow beat, downbeat, phrase, build and drop signals to add bounded motion and presentation accents.', 'master-controls', 5, 'Playback'),
      type: 'boolean' as const,
      defaultValue: true,
    }),
    Object.freeze({
      ...base(CINEMA2_SAY_IT_MOTION_SAFETY_ID, 'Motion Safety', 'Full uses complete rotations, Reduced limits travel and rotation, and Lock Off keeps every glyph exactly assembled.', 'master-controls', 6, 'Playback'),
      type: 'enum' as const,
      defaultValue: 'full',
      options: Object.freeze([
        Object.freeze({ value: 'full', label: 'Full Motion' }),
        Object.freeze({ value: 'reduced', label: 'Reduced Motion' }),
        Object.freeze({ value: 'lockoff', label: 'Lock Off' }),
      ]),
    }),
    Object.freeze({
      ...base(CINEMA2_SAY_IT_LINE_MODE_ID, 'Line Mode', 'Choose a single 12-character line or allow two lines with 20 characters total.', 'design', 1, 'Layout'),
      type: 'enum' as const,
      defaultValue: 'two',
      options: Object.freeze([
        Object.freeze({ value: 'one', label: 'One Line' }),
        Object.freeze({ value: 'two', label: 'Two Lines' }),
      ]),
    }),
    Object.freeze({
      ...base(CINEMA2_SAY_IT_ALIGNMENT_ID, 'Alignment', 'Align lines within the centered two-line text block.', 'design', 2, 'Layout'),
      type: 'enum' as const,
      defaultValue: 'center',
      options: Object.freeze([
        Object.freeze({ value: 'left', label: 'Left' }),
        Object.freeze({ value: 'center', label: 'Center' }),
        Object.freeze({ value: 'right', label: 'Right' }),
      ]),
    }),
    floatParameter(CINEMA2_SAY_IT_TRACKING_ID, 'Tracking', 'Additional space between characters.', 'design', 3, 'Layout', 0.06, -0.15, 0.5, 0.01),
    floatParameter(CINEMA2_SAY_IT_LINE_SPACING_ID, 'Line Spacing', 'Vertical distance between two lines.', 'design', 4, 'Layout', 0.7, 0.55, 1.2, 0.01),
    floatParameter(CINEMA2_SAY_IT_GLYPH_SCALE_ID, 'Glyph Scale', 'Overall size before automatic fit-to-frame scaling.', 'design', 5, 'Layout', 1, 0.35, 1.5, 0.01),
    Object.freeze({
      ...base(CINEMA2_SAY_IT_MOTION_PROGRAM_ID, 'Motion Program', 'Choose the independent glyph movement vocabulary.', 'design', 6, 'Motion'),
      type: 'enum' as const,
      defaultValue: 'tumble',
      options: Object.freeze([
        Object.freeze({ value: 'flip', label: 'Flip' }),
        Object.freeze({ value: 'tumble', label: 'Tumble' }),
        Object.freeze({ value: 'wave', label: 'Wave' }),
        Object.freeze({ value: 'scatter', label: 'Scatter' }),
        Object.freeze({ value: 'hinge', label: 'Hinge' }),
      ]),
    }),
    Object.freeze({
      ...base(CINEMA2_SAY_IT_MOTION_DIRECTION_ID, 'Direction', 'Controls release order and travel direction across the text.', 'design', 7, 'Motion'),
      type: 'enum' as const,
      defaultValue: 'alternate',
      options: Object.freeze([
        Object.freeze({ value: 'alternate', label: 'Alternate' }),
        Object.freeze({ value: 'forward', label: 'Forward' }),
        Object.freeze({ value: 'reverse', label: 'Reverse' }),
        Object.freeze({ value: 'center-out', label: 'Center Out' }),
        Object.freeze({ value: 'random', label: 'Random' }),
      ]),
    }),
    floatParameter(CINEMA2_SAY_IT_GLYPH_DELAY_ID, 'Glyph Delay', 'Normalized delay between neighboring glyph releases.', 'design', 8, 'Motion', 0.004, 0, 0.02, 0.001),
    floatParameter(CINEMA2_SAY_IT_AXIS_X_ID, 'X Rotation', 'Weight of rotation around the X axis.', 'design', 9, 'Motion', 1, 0, 1, 0.01),
    floatParameter(CINEMA2_SAY_IT_AXIS_Y_ID, 'Y Rotation', 'Weight of rotation around the Y axis.', 'design', 10, 'Motion', 1, 0, 1, 0.01),
    floatParameter(CINEMA2_SAY_IT_AXIS_Z_ID, 'Z Rotation', 'Weight of rotation around the Z axis.', 'design', 11, 'Motion', 1, 0, 1, 0.01),
    Object.freeze({ ...base(CINEMA2_SAY_IT_RANDOM_SEED_ID, 'Random Seed', 'Deterministic variation for scatter, random direction and per-glyph paths.', 'design', 12, 'Motion'), type: 'integer' as const, defaultValue: 7, min: 0, max: 9999, step: 1 }),
    floatParameter(CINEMA2_SAY_IT_CYCLE_ID, 'Cycle Length', 'Seconds per assemble-break-resolve cycle at the reference tempo.', 'design', 13, 'Motion', 8, 2, 20, 0.25),
    floatParameter(CINEMA2_SAY_IT_SPREAD_ID, 'Spread', 'Distance the independent letters travel away from the exact typeset layout.', 'design', 14, 'Motion', 1, 0, 3, 0.05),
    Object.freeze({
      ...base(CINEMA2_SAY_IT_MATERIAL_STYLE_ID, 'Material Style', 'Choose chrome, brushed metal, pearl or emissive neon shading.', 'design', 15, 'Material'),
      type: 'enum' as const,
      defaultValue: 'chrome',
      options: Object.freeze([
        Object.freeze({ value: 'chrome', label: 'Chrome' }),
        Object.freeze({ value: 'brushed', label: 'Brushed Metal' }),
        Object.freeze({ value: 'pearl', label: 'Pearl' }),
        Object.freeze({ value: 'neon', label: 'Neon' }),
      ]),
    }),
    floatParameter(CINEMA2_SAY_IT_ROUGHNESS_ID, 'Surface Roughness', 'Surface finish from mirror-like to softly diffused.', 'design', 16, 'Material', 0.16, 0.04, 1, 0.01),
    floatParameter(CINEMA2_SAY_IT_REFLECTION_ID, 'Environment Reflection', 'Strength of the studio environment reflected by the letters.', 'design', 17, 'Material', 1.25, 0, 4, 0.05),
    Object.freeze({
      ...base(CINEMA2_SAY_IT_LED_OUTLINE_ID, 'LED Outline', 'Turn the emissive LED tube around each letter on or off.', 'design', 18, 'Lighting'),
      type: 'boolean' as const,
      defaultValue: true,
    }),
    floatParameter(CINEMA2_SAY_IT_SWEEP_ID, 'Highlight Sweep', 'Speed of the reflected studio light moving across the letter faces.', 'design', 19, 'Lighting', 0.65, 0, 2, 0.05),
    floatParameter(CINEMA2_SAY_IT_CAMERA_MOTION_ID, 'Camera Motion', 'Maximum authority for build, phrase and drop camera accents.', 'design', 20, 'Camera', 0.35, 0, 1, 0.01),
    floatParameter(CINEMA2_SAY_IT_TRAILS_ID, 'Trails', 'Restrained temporal echoes behind moving letters.', 'effects', 1, 'Post', 0.08, 0, 1, 0.01),
    floatParameter(CINEMA2_SAY_IT_FOCUS_ID, 'Depth of Field', 'Depth-based focus blur; low quality automatically passes through.', 'effects', 2, 'Post', 0.12, 0, 1, 0.01),
    floatParameter(CINEMA2_SAY_IT_BLOOM_ID, 'Bloom', 'HDR glow produced by the illuminated LED tubes.', 'effects', 3, 'Post', 0.8, 0, 2, 0.05),
    floatParameter(CINEMA2_SAY_IT_FINISH_ID, 'Cinematic Finish', 'Filmic contrast, tone curve, vignette and subtle grain.', 'effects', 4, 'Post', 0.75, 0, 1, 0.05),
    Object.freeze({
      ...base(CINEMA2_SAY_IT_PATTERN_ID, 'Pattern', 'Selects the active LED outline animation and restarts it from a deterministic boundary.', 'effects', 1, 'Pattern'),
      type: 'enum' as const, defaultValue: CINEMA2_SAY_IT_DEFAULT_PATTERN, options: PATTERN_OPTIONS,
    }),
    Object.freeze({
      ...base(CINEMA2_SAY_IT_PATTERN_CHANGE_ID, 'Pattern Change', 'When enabled, each qualified Trigger advances through a deterministic shuffled cycle with no immediate repeat.', 'effects', 2, 'Pattern'),
      type: 'boolean' as const, defaultValue: false,
    }),
    Object.freeze({
      ...base(CINEMA2_SAY_IT_TRIGGER_ID, 'Trigger', 'Chooses the musical event that advances to the next LED pattern while Pattern Change is enabled.', 'effects', 3, 'Pattern'),
      type: 'enum' as const, defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,
      visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: CINEMA2_SAY_IT_PATTERN_CHANGE_ID, value: true })]),
    }),
    Object.freeze({ ...base(CINEMA2_SAY_IT_BACKGROUND_ID, 'Background', 'The seamless void behind the letters.', 'palette', 1, 'Color'), type: 'color' as const, defaultValue: DEFAULT_BACKGROUND }),
    Object.freeze({ ...base(CINEMA2_SAY_IT_CHROME_ID, 'Chrome Tint', 'Base tint of the reflective metal letters.', 'palette', 2, 'Color'), type: 'color' as const, defaultValue: DEFAULT_CHROME }),
    Object.freeze({ ...base(CINEMA2_SAY_IT_OUTLINE_COLOR_ID, 'Outline', 'Color of the emissive LED tube around each letter.', 'palette', 3, 'Color'), type: 'color' as const, defaultValue: DEFAULT_OUTLINE }),
  ]),
  modules: Object.freeze([
    Object.freeze({
      id: CINEMA2_SAY_IT_MODULE_ID,
      typeId: CINEMA2_SAY_IT_MODULE_TYPE_ID,
      version: 1,
      enabled: true,
      parameters: Object.freeze({
        line1Text: 'SAY IT', line2Text: '', lineMode: 'two', alignment: 'center', tracking: 0.06, lineSpacing: 0.7, glyphScale: 1,
        motionAmount: 1, motionProgram: 'tumble', motionDirection: 'alternate', motionSafety: 'full', glyphDelay: 0.004,
        axisX: 1, axisY: 1, axisZ: 1, randomSeed: 7, bpmSync: true, cycleSeconds: 8, spread: 1,
        beatAccent: 0, downbeatAccent: 0, phraseAccent: 0, buildAmount: 0, dropAccent: 0,
        ledKick: 0, ledSnare: 0, ledTransient: 0,
        materialStyle: 'chrome', roughness: 0.16, environmentIntensity: 1.25, highlightSweep: 0.65, color: DEFAULT_CHROME,
        ledOutline: true, outlineColor: DEFAULT_OUTLINE,
        pattern: CINEMA2_SAY_IT_DEFAULT_PATTERN, patternChange: false, trigger: 'bar4',
      }),
      parameterBindings: Object.freeze({
        line1Text: cinema2Ref(CINEMA2_SAY_IT_LINE_ONE_TEXT_ID),
        line2Text: cinema2Ref(CINEMA2_SAY_IT_LINE_TWO_TEXT_ID),
        lineMode: cinema2Ref(CINEMA2_SAY_IT_LINE_MODE_ID),
        alignment: cinema2Ref(CINEMA2_SAY_IT_ALIGNMENT_ID),
        tracking: cinema2Ref(CINEMA2_SAY_IT_TRACKING_ID),
        lineSpacing: cinema2Ref(CINEMA2_SAY_IT_LINE_SPACING_ID),
        glyphScale: cinema2Ref(CINEMA2_SAY_IT_GLYPH_SCALE_ID),
        motionAmount: cinema2Ref(CINEMA2_SAY_IT_MOTION_ID),
        motionProgram: cinema2Ref(CINEMA2_SAY_IT_MOTION_PROGRAM_ID),
        motionDirection: cinema2Ref(CINEMA2_SAY_IT_MOTION_DIRECTION_ID),
        motionSafety: cinema2Ref(CINEMA2_SAY_IT_MOTION_SAFETY_ID),
        glyphDelay: cinema2Ref(CINEMA2_SAY_IT_GLYPH_DELAY_ID),
        axisX: cinema2Ref(CINEMA2_SAY_IT_AXIS_X_ID),
        axisY: cinema2Ref(CINEMA2_SAY_IT_AXIS_Y_ID),
        axisZ: cinema2Ref(CINEMA2_SAY_IT_AXIS_Z_ID),
        randomSeed: cinema2Ref(CINEMA2_SAY_IT_RANDOM_SEED_ID),
        bpmSync: cinema2Ref(CINEMA2_SAY_IT_BPM_SYNC_ID),
        cycleSeconds: cinema2Ref(CINEMA2_SAY_IT_CYCLE_ID),
        spread: cinema2Ref(CINEMA2_SAY_IT_SPREAD_ID),
        materialStyle: cinema2Ref(CINEMA2_SAY_IT_MATERIAL_STYLE_ID),
        roughness: cinema2Ref(CINEMA2_SAY_IT_ROUGHNESS_ID),
        environmentIntensity: cinema2Ref(CINEMA2_SAY_IT_REFLECTION_ID),
        highlightSweep: cinema2Ref(CINEMA2_SAY_IT_SWEEP_ID),
        color: cinema2Ref(CINEMA2_SAY_IT_CHROME_ID),
        ledOutline: cinema2Ref(CINEMA2_SAY_IT_LED_OUTLINE_ID),
        outlineColor: cinema2Ref(CINEMA2_SAY_IT_OUTLINE_COLOR_ID),
        pattern: cinema2Ref(CINEMA2_SAY_IT_PATTERN_ID),
        patternChange: cinema2Ref(CINEMA2_SAY_IT_PATTERN_CHANGE_ID),
        trigger: cinema2Ref(CINEMA2_SAY_IT_TRIGGER_ID),
      }),
    }),
  ]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
      Object.freeze({ id: FOCUS_NODE_ID, kind: 'group' as const, parent: cinema2Ref(ROOT_NODE_ID), transform: Object.freeze({ position: vec3(0, 0, 0) }) }),
      Object.freeze({ id: GLYPH_NODE_ID, kind: 'module' as const, parent: cinema2Ref(ROOT_NODE_ID), module: cinema2Ref(CINEMA2_SAY_IT_MODULE_ID) }),
    ]),
    roots: Object.freeze([cinema2Ref(ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([
    Object.freeze({ id: WORLD_LAYER_ID, label: 'SAY IT World', source: cinema2Ref(ROOT_NODE_ID), role: 'world', depthPolicy: 'read-write' as const, order: 0 }),
  ]),
  cameras: Object.freeze([
    Object.freeze({
      id: CINEMA2_SAY_IT_CAMERA_ID,
      label: 'SAY IT Front',
      projection: 'perspective' as const,
      fovDegrees: CINEMA2_SAY_IT_CAMERA_FOV_DEGREES,
      minAspect: CINEMA2_SAY_IT_COMPOSED_MIN_ASPECT,
      near: 0.1,
      far: 40,
      transform: Object.freeze({ position: vec3(0, 0, CINEMA2_SAY_IT_CAMERA_DISTANCE) }),
      targetNode: cinema2Ref(FOCUS_NODE_ID),
      rig: Object.freeze({ kind: 'static' as const }),
      smoothingMs: 110,
      safety: Object.freeze({
        minPosition: vec3(-0.7, -0.45, 6.1),
        maxPosition: vec3(0.7, 0.45, 7.8),
        minFovDegrees: 30,
        maxFovDegrees: 42,
        minNear: 0.05,
        maxFar: 60,
        maxPositionOffset: vec3(0.55, 0.35, 0.75),
        maxTargetOffset: vec3(0.32, 0.24, 0.35),
      }),
    }),
  ]),
  choreography: Object.freeze({
    rules: Object.freeze([
      Object.freeze({
        id: choreographyRuleId('say-it-beat-motion'),
        priority: 20,
        enabledParameter: cinema2Ref(CINEMA2_SAY_IT_AUTO_PERFORMANCE_ID),
        source: Object.freeze({ signal: 'beat' as const, capability: 'music.beat' as const }),
        actions: Object.freeze([moduleEnvelopeAction('say-it-beat-accent', 'beatAccent', 0.02, 0.18)]),
      }),
      Object.freeze({
        id: choreographyRuleId('say-it-kick-led'),
        priority: 22,
        enabledParameter: cinema2Ref(CINEMA2_SAY_IT_AUTO_PERFORMANCE_ID),
        source: Object.freeze({ signal: 'kick' as const, capability: 'music.rhythm-events' as const }),
        actions: Object.freeze([moduleEnvelopeAction('say-it-kick-led-accent', 'ledKick', 0.025, 0.2)]),
      }),
      Object.freeze({
        id: choreographyRuleId('say-it-snare-led'),
        priority: 23,
        enabledParameter: cinema2Ref(CINEMA2_SAY_IT_AUTO_PERFORMANCE_ID),
        source: Object.freeze({ signal: 'snare' as const, capability: 'music.rhythm-events' as const }),
        actions: Object.freeze([moduleEnvelopeAction('say-it-snare-led-accent', 'ledSnare', 0.035, 0.28)]),
      }),
      Object.freeze({
        id: choreographyRuleId('say-it-transient-led'),
        priority: 21,
        enabledParameter: cinema2Ref(CINEMA2_SAY_IT_AUTO_PERFORMANCE_ID),
        source: Object.freeze({ signal: 'transient' as const, capability: 'music.rhythm-events' as const }),
        actions: Object.freeze([moduleEnvelopeAction('say-it-transient-led-accent', 'ledTransient', 0.01, 0.12)]),
      }),
      Object.freeze({
        id: choreographyRuleId('say-it-downbeat-motion'),
        priority: 30,
        enabledParameter: cinema2Ref(CINEMA2_SAY_IT_AUTO_PERFORMANCE_ID),
        source: Object.freeze({ signal: 'downbeat' as const, capability: 'music.downbeat' as const }),
        conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([
          moduleEnvelopeAction('say-it-downbeat-accent', 'downbeatAccent', 0.04, 0.34),
          effectEnvelopeAddAction('say-it-downbeat-bloom', BLOOM_EFFECT_ID, 'intensity', 0.12, 0.04, 0.3),
        ]),
      }),
      Object.freeze({
        id: choreographyRuleId('say-it-phrase-motion'),
        priority: 40,
        enabledParameter: cinema2Ref(CINEMA2_SAY_IT_AUTO_PERFORMANCE_ID),
        source: Object.freeze({ signal: 'phrase' as const, capability: 'music.phrase' as const }),
        conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([
          moduleEnvelopeAction('say-it-phrase-accent', 'phraseAccent', 0.1, 0.7),
          effectEnvelopeAddAction('say-it-phrase-trails', TRAILS_EFFECT_ID, 'mix', 0.08, 0.08, 0.62),
        ]),
      }),
      Object.freeze({
        id: choreographyRuleId('say-it-build-motion'),
        priority: 45,
        enabledParameter: cinema2Ref(CINEMA2_SAY_IT_AUTO_PERFORMANCE_ID),
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 120 }),
        actions: Object.freeze([
          moduleContinuousAction('say-it-build-amount', 'buildAmount'),
          effectContinuousAddAction('say-it-build-trails', TRAILS_EFFECT_ID, 'mix', 0.12),
        ]),
      }),
      Object.freeze({
        id: choreographyRuleId('say-it-drop-motion'),
        priority: 50,
        enabledParameter: cinema2Ref(CINEMA2_SAY_IT_AUTO_PERFORMANCE_ID),
        source: Object.freeze({ signal: 'drop' as const, capability: 'music.drop' as const }),
        conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([
          moduleEnvelopeAction('say-it-drop-accent', 'dropAccent', 0.1, 0.85),
          effectEnvelopeAddAction('say-it-drop-trails', TRAILS_EFFECT_ID, 'mix', 0.2, 0.08, 0.55),
          effectEnvelopeAddAction('say-it-drop-bloom', BLOOM_EFFECT_ID, 'intensity', 0.24, 0.08, 0.48),
        ]),
      }),
      Object.freeze({
        id: choreographyRuleId('say-it-camera-build'),
        priority: 120,
        enabledParameter: cinema2Ref(CINEMA2_SAY_IT_AUTO_PERFORMANCE_ID),
        strengthParameter: cinema2Ref(CINEMA2_SAY_IT_CAMERA_MOTION_ID),
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 120 }),
        actions: Object.freeze([
          cameraContinuousAddAction('say-it-camera-build-dolly', 'transform.position', vec3(0, 0.04, -0.42)),
          cameraContinuousAddAction('say-it-camera-build-fov', 'fovDegrees', -1.1),
        ]),
      }),
      Object.freeze({
        id: choreographyRuleId('say-it-camera-phrase'),
        priority: 130,
        enabledParameter: cinema2Ref(CINEMA2_SAY_IT_AUTO_PERFORMANCE_ID),
        strengthParameter: cinema2Ref(CINEMA2_SAY_IT_CAMERA_MOTION_ID),
        source: Object.freeze({ signal: 'phrase' as const, capability: 'music.phrase' as const }),
        conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([
          cameraEnvelopeAddAction('say-it-camera-phrase-position', 'transform.position', vec3(-0.28, 0.08, -0.12), 0.1, 0.72),
          cameraEnvelopeAddAction('say-it-camera-phrase-target', 'target', vec3(0.12, 0.03, 0), 0.1, 0.72),
        ]),
      }),
      Object.freeze({
        id: choreographyRuleId('say-it-camera-drop'),
        priority: 140,
        enabledParameter: cinema2Ref(CINEMA2_SAY_IT_AUTO_PERFORMANCE_ID),
        strengthParameter: cinema2Ref(CINEMA2_SAY_IT_CAMERA_MOTION_ID),
        source: Object.freeze({ signal: 'drop' as const, capability: 'music.drop' as const }),
        conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([
          cameraEnvelopeAddAction('say-it-camera-drop-push', 'transform.position', vec3(0, -0.04, -0.58), 0.12, 0.8),
          cameraEnvelopeAddAction('say-it-camera-drop-fov', 'fovDegrees', 1.2, 0.12, 0.8),
        ]),
      }),
    ]),
  }),
  lighting: Object.freeze({
    lights: Object.freeze([
      Object.freeze({
        id: KEY_LIGHT_ID,
        type: 'spot' as const,
        color: color(0.86, 0.92, 1),
        intensity: 1.8,
        transform: Object.freeze({ position: vec3(-3.8, 4.5, 5.8) }),
        node: cinema2Ref(ROOT_NODE_ID),
        targetNode: cinema2Ref(FOCUS_NODE_ID),
        config: Object.freeze({ coneAngleDegrees: 30, penumbra: 0.7, range: 20 }),
      }),
      Object.freeze({
        id: RIM_LIGHT_ID,
        type: 'spot' as const,
        color: color(0.55, 0.7, 1),
        intensity: 1.3,
        transform: Object.freeze({ position: vec3(4.5, 2.8, -3) }),
        node: cinema2Ref(ROOT_NODE_ID),
        targetNode: cinema2Ref(FOCUS_NODE_ID),
        config: Object.freeze({ coneAngleDegrees: 36, penumbra: 0.8, range: 20 }),
      }),
      Object.freeze({ id: AMBIENT_LIGHT_ID, type: 'ambient' as const, color: color(0.28, 0.32, 0.4), intensity: 0.13 }),
    ]),
  }),
  environment: Object.freeze({
    backgroundColor: DEFAULT_BACKGROUND,
    exposure: 1,
    controls: Object.freeze({ backgroundColor: cinema2Ref(CINEMA2_SAY_IT_BACKGROUND_ID) }),
  }),
  effects: Object.freeze([
    Object.freeze({
      id: TRAILS_EFFECT_ID,
      typeId: CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 0,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 0.08, persistence: 0.78, drift: 0.25, transportAware: true }),
      parameterBindings: Object.freeze({ mix: cinema2Ref(CINEMA2_SAY_IT_TRAILS_ID) }),
    }),
    Object.freeze({
      id: FOCUS_EFFECT_ID,
      typeId: CINEMA2_DEPTH_OF_FIELD_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 1,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 0.12, focusDistance: 7, focusRange: 1.7, falloff: 4.5, farBlur: 5, nearBlur: 2 }),
      parameterBindings: Object.freeze({ mix: cinema2Ref(CINEMA2_SAY_IT_FOCUS_ID) }),
    }),
    Object.freeze({
      id: BLOOM_EFFECT_ID,
      typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 2,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, threshold: 1.15, knee: 0.35, intensity: 0.8, spread: 0.62, levels: 7, clampMax: 24, tint: color(1, 1, 1) }),
      parameterBindings: Object.freeze({ intensity: cinema2Ref(CINEMA2_SAY_IT_BLOOM_ID) }),
    }),
    Object.freeze({
      id: FINISH_EFFECT_ID,
      typeId: FINISH_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 3,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 0.75, exposure: 1.08, contrast: 1.12, saturation: 0.92, vignette: 0.26, grain: 0.08, aberration: 0.04 }),
      parameterBindings: Object.freeze({ mix: cinema2Ref(CINEMA2_SAY_IT_FINISH_ID) }),
    }),
  ]),
  render: Object.freeze({
    targets: Object.freeze([
      Object.freeze({
        id: SCENE_TARGET_ID,
        descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba16f' as const, fallbackColorFormat: 'rgba8' as const, depthFormat: 'depth24' as const }),
        ownership: 'transient' as const,
      }),
      Object.freeze({
        id: TRAILS_TARGET_ID,
        descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba16f' as const, fallbackColorFormat: 'rgba8' as const }),
        ownership: 'transient' as const,
      }),
      Object.freeze({
        id: FOCUS_TARGET_ID,
        descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba16f' as const, fallbackColorFormat: 'rgba8' as const }),
        ownership: 'transient' as const,
      }),
      Object.freeze({
        id: BLOOM_TARGET_ID,
        descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba16f' as const, fallbackColorFormat: 'rgba8' as const }),
        ownership: 'transient' as const,
      }),
    ]),
    passes: Object.freeze([
      Object.freeze({
        id: SCENE_PASS_ID,
        kind: 'scene' as const,
        layers: Object.freeze([cinema2Ref(WORLD_LAYER_ID)]),
        outputs: Object.freeze([
          Object.freeze({ id: SCENE_COLOR_OUTPUT_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'color' as const }),
          Object.freeze({ id: SCENE_DEPTH_OUTPUT_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'depth' as const }),
        ]),
      }),
      Object.freeze({
        id: TRAILS_PASS_ID,
        kind: 'fullscreen' as const,
        dependsOn: Object.freeze([cinema2Ref(SCENE_PASS_ID)]),
        effect: cinema2Ref(TRAILS_EFFECT_ID),
        inputs: Object.freeze([
          Object.freeze({ id: TRAILS_INPUT_ID, source: Object.freeze({ pass: cinema2Ref(SCENE_PASS_ID), output: SCENE_COLOR_OUTPUT_ID }), attachment: 'color' as const }),
        ]),
        outputs: Object.freeze([Object.freeze({ id: TRAILS_OUTPUT_ID, target: cinema2Ref(TRAILS_TARGET_ID), attachment: 'color' as const })]),
      }),
      Object.freeze({
        id: FOCUS_PASS_ID,
        kind: 'fullscreen' as const,
        dependsOn: Object.freeze([cinema2Ref(TRAILS_PASS_ID), cinema2Ref(SCENE_PASS_ID)]),
        effect: cinema2Ref(FOCUS_EFFECT_ID),
        inputs: Object.freeze([
          Object.freeze({ id: FOCUS_COLOR_INPUT_ID, source: Object.freeze({ pass: cinema2Ref(TRAILS_PASS_ID), output: TRAILS_OUTPUT_ID }), attachment: 'color' as const }),
          Object.freeze({ id: FOCUS_DEPTH_INPUT_ID, source: Object.freeze({ pass: cinema2Ref(SCENE_PASS_ID), output: SCENE_DEPTH_OUTPUT_ID }), attachment: 'depth' as const }),
        ]),
        outputs: Object.freeze([Object.freeze({ id: FOCUS_OUTPUT_ID, target: cinema2Ref(FOCUS_TARGET_ID), attachment: 'color' as const })]),
      }),
      Object.freeze({
        id: BLOOM_PASS_ID,
        kind: 'fullscreen' as const,
        dependsOn: Object.freeze([cinema2Ref(FOCUS_PASS_ID)]),
        effect: cinema2Ref(BLOOM_EFFECT_ID),
        inputs: Object.freeze([
          Object.freeze({ id: BLOOM_INPUT_ID, source: Object.freeze({ pass: cinema2Ref(FOCUS_PASS_ID), output: FOCUS_OUTPUT_ID }), attachment: 'color' as const }),
        ]),
        outputs: Object.freeze([Object.freeze({ id: BLOOM_OUTPUT_ID, target: cinema2Ref(BLOOM_TARGET_ID), attachment: 'color' as const })]),
      }),
      Object.freeze({
        id: FINISH_PASS_ID,
        kind: 'fullscreen' as const,
        dependsOn: Object.freeze([cinema2Ref(BLOOM_PASS_ID)]),
        effect: cinema2Ref(FINISH_EFFECT_ID),
        inputs: Object.freeze([
          Object.freeze({ id: FINISH_INPUT_ID, source: Object.freeze({ pass: cinema2Ref(BLOOM_PASS_ID), output: BLOOM_OUTPUT_ID }), attachment: 'color' as const }),
        ]),
      }),
    ]),
    outputPass: cinema2Ref(FINISH_PASS_ID),
  }),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_SAY_IT_CAMERA_ID) }),
  output: Object.freeze({ renderPass: cinema2Ref(FINISH_PASS_ID), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
})
