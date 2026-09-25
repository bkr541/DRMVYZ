import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleId,
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
  CINEMA2_HUMN_NATIVE_MODULE_TYPE_ID,
  CINEMA2_HUMN_NATIVE_MODULE_VERSION,
} from '../modules/Cinema2HumNNativeModule'
import { cinema2CinematicMotion } from './Cinema2CameraMotionAuthoring'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'

export const CINEMA2_HUMN_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.hum-n')
export const CINEMA2_HUMN_MODULE_ID = cinema2StableId<Cinema2ModuleId>('hum-n-emergence')
export const CINEMA2_HUMN_ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('hum-n-root')
export const CINEMA2_HUMN_MODULE_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('hum-n-emergence-node')
export const CINEMA2_HUMN_LAYER_ID = cinema2StableId<Cinema2LayerId>('hum-n-emergence-layer')
export const CINEMA2_HUMN_CAMERA_ID = cinema2StableId<Cinema2CameraId>('hum-n-camera')

export const CINEMA2_HUMN_LINE_PRESENCE_ID = cinema2StableId<Cinema2ParameterId>('hum-n-line-presence')
export const CINEMA2_HUMN_LINE_WEIGHT_ID = cinema2StableId<Cinema2ParameterId>('hum-n-line-weight')
export const CINEMA2_HUMN_FRAGMENTATION_ID = cinema2StableId<Cinema2ParameterId>('hum-n-fragmentation')
export const CINEMA2_HUMN_MESH_DETAIL_ID = cinema2StableId<Cinema2ParameterId>('hum-n-mesh-detail')
export const CINEMA2_HUMN_FACET_FILL_ID = cinema2StableId<Cinema2ParameterId>('hum-n-facet-fill')
export const CINEMA2_HUMN_FILL_STYLE_ID = cinema2StableId<Cinema2ParameterId>('hum-n-fill-style')
export const CINEMA2_HUMN_MASTER_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('hum-n-master-intensity')
export const CINEMA2_HUMN_BPM_SYNC_ID = cinema2StableId<Cinema2ParameterId>('hum-n-bpm-sync')
export const CINEMA2_HUMN_MOTION_AMOUNT_ID = cinema2StableId<Cinema2ParameterId>('hum-n-motion-amount')
export const CINEMA2_HUMN_MOTION_RATE_ID = cinema2StableId<Cinema2ParameterId>('hum-n-motion-rate')
export const CINEMA2_HUMN_FIGURE_SCALE_ID = cinema2StableId<Cinema2ParameterId>('hum-n-figure-scale')
export const CINEMA2_HUMN_BACKGROUND_ID = cinema2StableId<Cinema2ParameterId>('hum-n-background')
export const CINEMA2_HUMN_WIREFRAME_ID = cinema2StableId<Cinema2ParameterId>('hum-n-wireframe')
export const CINEMA2_HUMN_PATTERN_INK_ID = cinema2StableId<Cinema2ParameterId>('hum-n-pattern-ink')
export const CINEMA2_HUMN_SKIN_PRIMARY_ID = cinema2StableId<Cinema2ParameterId>('hum-n-skin-primary')
export const CINEMA2_HUMN_SKIN_SECONDARY_ID = cinema2StableId<Cinema2ParameterId>('hum-n-skin-secondary')
export const CINEMA2_HUMN_SKIN_ACCENT_ID = cinema2StableId<Cinema2ParameterId>('hum-n-skin-accent')
export const CINEMA2_HUMN_AUTO_COLOR_ID = cinema2StableId<Cinema2ParameterId>('hum-n-auto-color')
export const CINEMA2_HUMN_FLICKER_AMOUNT_ID = cinema2StableId<Cinema2ParameterId>('hum-n-flicker-amount')
export const CINEMA2_HUMN_FRAGMENT_JITTER_ID = cinema2StableId<Cinema2ParameterId>('hum-n-fragment-jitter')
export const CINEMA2_HUMN_AUTO_PERFORMANCE_ID = cinema2StableId<Cinema2ParameterId>('hum-n-auto-performance')
export const CINEMA2_HUMN_GLOW_ID = cinema2StableId<Cinema2ParameterId>('hum-n-glow')
export const CINEMA2_HUMN_TRAILS_ID = cinema2StableId<Cinema2ParameterId>('hum-n-trails')

/** Engine-owned finishing chain: HUM:N scene -> feedback trails -> bloom -> output. */
export const CINEMA2_HUMN_SCENE_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('hum-n-scene-target')
export const CINEMA2_HUMN_TRAILS_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('hum-n-trails-target')
export const CINEMA2_HUMN_SCENE_PASS_ID = cinema2StableId<Cinema2RenderPassId>('hum-n-scene-pass')
export const CINEMA2_HUMN_TRAILS_PASS_ID = cinema2StableId<Cinema2RenderPassId>('hum-n-trails-pass')
export const CINEMA2_HUMN_BLOOM_PASS_ID = cinema2StableId<Cinema2RenderPassId>('hum-n-bloom-pass')
export const CINEMA2_HUMN_SCENE_COLOR_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('hum-n-scene-color')
export const CINEMA2_HUMN_TRAILS_COLOR_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('hum-n-trails-color')
export const CINEMA2_HUMN_TRAILS_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('hum-n-trails-source')
export const CINEMA2_HUMN_BLOOM_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('hum-n-bloom-source')
export const CINEMA2_HUMN_TRAILS_EFFECT_ID = cinema2StableId<Cinema2EffectId>('hum-n-feedback-trails')
export const CINEMA2_HUMN_BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('hum-n-bloom')
/** Hidden, runtime-only trigger that carries stable drop/phrase/section identity to the native module. */
export const CINEMA2_HUMN_STRUCTURAL_EVENT_INTENT_ID = cinema2StableId<Cinema2ParameterId>('hum-n-structural-event-intent')
/** Hidden, runtime-only trigger that carries stable rhythm-event identity to the native module. */
export const CINEMA2_HUMN_FRAGMENT_EVENT_INTENT_ID = cinema2StableId<Cinema2ParameterId>('hum-n-fragment-event-intent')

const choreographyRuleId = (id: string) => cinema2StableId<Cinema2ChoreographyRuleId>(id)
const choreographyActionId = (id: string) => cinema2StableId<Cinema2ChoreographyActionId>(id)

const structuralEventSpawnAction = (id: string, kind: 'drop' | 'phrase' | 'section') => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'parameter' as const, ref: cinema2Ref(CINEMA2_HUMN_STRUCTURAL_EVENT_INTENT_ID) }),
  operation: 'spawn' as const,
  value: Object.freeze({ kind }),
})

/** Carries the event's own strength to the module for a half-beat; the module reads it once when it starts the move. */
const structuralStrengthAction = (id: string, property: string) => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_HUMN_MODULE_ID), property }),
  operation: 'set-for-duration' as const,
  value: 1,
  composition: 'replace' as const,
  durationBeats: 0.5,
})

const fragmentEventSpawnAction = (id: string, kind: 'beat' | 'downbeat' | 'kick' | 'snare') => Object.freeze({
  id: choreographyActionId(id),
  target: Object.freeze({ kind: 'parameter' as const, ref: cinema2Ref(CINEMA2_HUMN_FRAGMENT_EVENT_INTENT_ID) }),
  operation: 'spawn' as const,
  value: Object.freeze({ kind }),
})

const effectTarget = (effectId: Cinema2EffectId, property: string) => Object.freeze({ kind: 'effect' as const, ref: cinema2Ref(effectId), property })

const CINEMA2_HUMN_COMPOSITION_OUTPUT_PARAMETERS = Object.freeze([
  Object.freeze({
    id: CINEMA2_HUMN_MASTER_INTENSITY_ID,
    label: 'Master Intensity',
    description: 'One control for how strongly HUM:N reacts to the music. It scales every music-driven behavior: how much skin fills in, how much the body moves, how big the gestures are, and the glow and edge pulses. At 0 the figure keeps only the values you set; at 1 it reacts fully.',
    type: 'float' as const,
    defaultValue: 0.75,
    min: 0,
    max: 1,
    step: 0.01,
    section: 'Design',
    designParentGroup: 'master-controls' as const,
    order: 1,
    exposure: 'primary' as const,
    modulatable: false,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_BPM_SYNC_ID,
    label: 'BPM Sync',
    description: 'On: the figure moves on the track\'s beat grid. Body sway, the head nod on every beat, the turnover of filled triangles and the scrolling color gradients all lock to the detected tempo and follow the track when it changes. Off: they run free at a steady 120 BPM and only the detected kicks, snares and downbeats react. This switch is HUM:N\'s own; the Audio Dock Sync does not also gate it.',
    type: 'boolean' as const,
    defaultValue: true,
    section: 'Design',
    designParentGroup: 'master-controls' as const,
    order: 2,
    exposure: 'primary' as const,
    modulatable: false,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_AUTO_PERFORMANCE_ID,
    label: 'Auto Performance',
    description: 'Lets the shared Visual Director choose the figure\'s poses and gestures: reaching toward the camera on a drop, recoiling, grabbing its head, lunging, and turning or looking around at phrase and section changes. Off, the figure only sways and nods in place.',
    type: 'boolean' as const,
    defaultValue: true,
    section: 'Design',
    designParentGroup: 'master-controls' as const,
    order: 3,
    exposure: 'primary' as const,
    modulatable: false,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_FIGURE_SCALE_ID,
    label: 'Figure Scale',
    description: 'Scales the whole figure about its framing point, from a small full-bust view up to a close-up that fills the frame.',
    type: 'float' as const,
    defaultValue: 1,
    min: 0.6,
    max: 2.5,
    step: 0.01,
    section: 'Design',
    group: 'Composition',
    designParentGroup: 'design' as const,
    order: 1,
    exposure: 'primary' as const,
    modulatable: false,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
])

/** The manual colors are only shown while Auto Color is off. */
const MANUAL_COLOR_ONLY = Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: CINEMA2_HUMN_AUTO_COLOR_ID, value: false })])

const CINEMA2_HUMN_PALETTE_PARAMETERS = Object.freeze([
  Object.freeze({
    id: CINEMA2_HUMN_AUTO_COLOR_ID,
    label: 'Auto Color',
    description: 'On: HUM:N picks its colors from the music. The key sets where the palette sits, the brightness of the sound tilts it, energy sets how saturated and how far apart the three colors are, and section and chord changes step it around the color wheel. The manual color options below are hidden while this is on.',
    type: 'boolean' as const,
    defaultValue: true,
    section: 'Design',
    group: 'Color Mode',
    designParentGroup: 'palette' as const,
    order: 0,
    exposure: 'primary' as const,
    modulatable: false,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_BACKGROUND_ID,
    label: 'Background',
    description: 'Sets the stage color behind the figure and the color of the triangles that are not filled.',
    type: 'color' as const,
    defaultValue: Object.freeze([0, 0, 0, 1]),
    section: 'Design',
    group: 'Stage Colors',
    designParentGroup: 'palette' as const,
    order: 1,
    exposure: 'primary' as const,
    modulatable: false,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_WIREFRAME_ID,
    label: 'Wireframe',
    description: 'Sets the color of the triangle edges that make up the figure.',
    type: 'color' as const,
    defaultValue: Object.freeze([245 / 255, 247 / 255, 250 / 255, 1]),
    section: 'Design',
    group: 'Figure Colors',
    designParentGroup: 'palette' as const,
    order: 2,
    exposure: 'primary' as const,
    visibleWhen: MANUAL_COLOR_ONLY,
    modulatable: false,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_SKIN_PRIMARY_ID,
    label: 'Skin Primary',
    description: 'Sets the first of the three colors the filled triangles blend between.',
    type: 'color' as const,
    defaultValue: Object.freeze([72 / 255, 240 / 255, 221 / 255, 1]),
    section: 'Design',
    group: 'Skin Colors',
    designParentGroup: 'palette' as const,
    order: 3,
    exposure: 'primary' as const,
    visibleWhen: MANUAL_COLOR_ONLY,
    modulatable: false,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_SKIN_SECONDARY_ID,
    label: 'Skin Secondary',
    description: 'Sets the second of the three colors the filled triangles blend between.',
    type: 'color' as const,
    defaultValue: Object.freeze([1, 61 / 255, 200 / 255, 1]),
    section: 'Design',
    group: 'Skin Colors',
    designParentGroup: 'palette' as const,
    order: 4,
    exposure: 'primary' as const,
    visibleWhen: MANUAL_COLOR_ONLY,
    modulatable: false,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_SKIN_ACCENT_ID,
    label: 'Skin Accent',
    description: 'Sets the third of the three colors the filled triangles blend between.',
    type: 'color' as const,
    defaultValue: Object.freeze([200 / 255, 1, 74 / 255, 1]),
    section: 'Design',
    group: 'Skin Colors',
    designParentGroup: 'palette' as const,
    order: 5,
    exposure: 'primary' as const,
    visibleWhen: MANUAL_COLOR_ONLY,
    modulatable: false,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_PATTERN_INK_ID,
    label: 'Pattern Ink',
    description: 'Sets the bright ink used by the striped and dotted triangles and by the eyes.',
    type: 'color' as const,
    defaultValue: Object.freeze([1, 1, 1, 1]),
    section: 'Design',
    group: 'Pattern Colors',
    designParentGroup: 'palette' as const,
    order: 6,
    exposure: 'primary' as const,
    visibleWhen: MANUAL_COLOR_ONLY,
    modulatable: false,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
])

const CINEMA2_HUMN_FIGURE_PARAMETERS = Object.freeze([
  Object.freeze({
    id: CINEMA2_HUMN_MOTION_AMOUNT_ID,
    label: 'Motion Amount',
    description: 'How much the figure moves on its own: weight shift, spine and head sway, a dip and nod on every beat, and how much the camera drifts around it. At 0 the figure and the camera are still (gestures from Auto Performance still play).',
    type: 'float' as const,
    defaultValue: 0.6,
    min: 0,
    max: 1,
    step: 0.01,
    section: 'Design',
    group: 'Motion',
    designParentGroup: 'design' as const,
    order: 1,
    exposure: 'primary' as const,
    modulatable: true,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_MOTION_RATE_ID,
    label: 'Motion Rate',
    description: 'Multiplies the speed of the figure\'s sway and of the color gradients that scroll across it.',
    type: 'enum' as const,
    defaultValue: '1x',
    options: Object.freeze([
      Object.freeze({ value: '1/2x', label: '1/2x' }),
      Object.freeze({ value: '1x', label: '1x' }),
      Object.freeze({ value: '2x', label: '2x' }),
      Object.freeze({ value: '4x', label: '4x' }),
    ]),
    section: 'Design',
    group: 'Motion',
    designParentGroup: 'design' as const,
    order: 2,
    exposure: 'primary' as const,
    modulatable: false,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_LINE_PRESENCE_ID,
    label: 'Line Presence',
    description: 'Controls how visible the triangle edges are. Loud passages can only lower this a little, never hide the figure.',
    type: 'float' as const,
    defaultValue: 1,
    min: 0,
    max: 1,
    step: 0.01,
    section: 'Design',
    group: 'Figure Construction',
    designParentGroup: 'design' as const,
    order: 10,
    exposure: 'primary' as const,
    modulatable: true,
    choreographable: true,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_LINE_WEIGHT_ID,
    label: 'Line Weight',
    description: 'Changes the thickness of the triangle edges.',
    type: 'float' as const,
    defaultValue: 1,
    min: 0.5,
    max: 2,
    step: 0.05,
    section: 'Design',
    group: 'Figure Construction',
    designParentGroup: 'design' as const,
    order: 11,
    exposure: 'primary' as const,
    modulatable: false,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_FRAGMENTATION_ID,
    label: 'Fragmentation',
    description: 'Breaks the triangle edges into dashes with gaps. At 0 every edge is a continuous line; higher values open more of them. The same edges stay open from frame to frame.',
    type: 'float' as const,
    defaultValue: 0.12,
    min: 0,
    max: 1,
    step: 0.01,
    section: 'Design',
    group: 'Figure Construction',
    designParentGroup: 'design' as const,
    order: 12,
    exposure: 'primary' as const,
    modulatable: true,
    choreographable: true,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_MESH_DETAIL_ID,
    label: 'Mesh Detail',
    description: 'Sparse thins the line network to about 60% of the edges, Reference shows the full low-poly figure, Dense doubles the number of triangles for a finer, more crystalline body.',
    type: 'enum' as const,
    defaultValue: 'Reference',
    options: Object.freeze([
      Object.freeze({ value: 'Sparse', label: 'Sparse' }),
      Object.freeze({ value: 'Reference', label: 'Reference' }),
      Object.freeze({ value: 'Dense', label: 'Dense' }),
    ]),
    section: 'Design',
    group: 'Figure Construction',
    designParentGroup: 'design' as const,
    order: 13,
    exposure: 'primary' as const,
    modulatable: false,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_FACET_FILL_ID,
    label: 'Facet Fill',
    description: 'How many of the triangles are filled with color. The filled set slowly turns over, so different triangles light up as the track plays. All the way up, every triangle of the body is filled with no gaps.',
    type: 'float' as const,
    defaultValue: 0.35,
    min: 0,
    max: 1,
    step: 0.01,
    section: 'Design',
    group: 'Figure Construction',
    designParentGroup: 'design' as const,
    order: 14,
    exposure: 'primary' as const,
    modulatable: true,
    choreographable: true,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_FILL_STYLE_ID,
    label: 'Fill Style',
    description: 'Solid uses flat colors, Gradient scrolling color bands, Stripe black-and-white bars, and Mixed a blend of gradients, stripes, solids and halftone dots.',
    type: 'enum' as const,
    defaultValue: 'Mixed',
    options: Object.freeze([
      Object.freeze({ value: 'Solid', label: 'Solid' }),
      Object.freeze({ value: 'Gradient', label: 'Gradient' }),
      Object.freeze({ value: 'Stripe', label: 'Stripe' }),
      Object.freeze({ value: 'Mixed', label: 'Mixed' }),
    ]),
    section: 'Design',
    group: 'Figure Construction',
    designParentGroup: 'design' as const,
    order: 15,
    exposure: 'primary' as const,
    modulatable: false,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
])

const CINEMA2_HUMN_EFFECTS_PARAMETERS = Object.freeze([
  Object.freeze({
    id: CINEMA2_HUMN_FLICKER_AMOUNT_ID,
    label: 'Flicker Amount',
    description: 'On every beat a fresh handful of triangles flashes into color, and on every downbeat a much larger set does while the filled set re-rolls; snares flash the eyes. At 0 there is no rhythmic flashing.',
    type: 'float' as const,
    defaultValue: 0.5,
    min: 0,
    max: 1,
    step: 0.01,
    section: 'Design',
    group: 'Fragment Behavior',
    designParentGroup: 'effects' as const,
    order: 1,
    exposure: 'primary' as const,
    modulatable: false,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_FRAGMENT_JITTER_ID,
    label: 'Fragment Jitter',
    description: 'On every kick a third of the triangles is thrown outward off the body, and settles back. At 0 the figure stays intact on kicks.',
    type: 'float' as const,
    defaultValue: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    section: 'Design',
    group: 'Fragment Behavior',
    designParentGroup: 'effects' as const,
    order: 2,
    exposure: 'primary' as const,
    modulatable: false,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_GLOW_ID,
    label: 'Glow',
    description: 'Neon light treatment on the bright wireframe and filled triangles using the engine Bloom. At 0, Glow is completely off and the frame is unchanged.',
    type: 'float' as const,
    defaultValue: 0.35,
    min: 0,
    max: 1,
    step: 0.01,
    section: 'Design',
    group: 'Light Treatment',
    designParentGroup: 'effects' as const,
    order: 3,
    exposure: 'primary' as const,
    modulatable: true,
    choreographable: true,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_TRAILS_ID,
    label: 'Trails',
    description: 'Geometric afterimages of real figure movement using the engine feedback history. At 0, Trails is completely off and no history is kept.',
    type: 'float' as const,
    defaultValue: 0,
    min: 0,
    max: 1,
    step: 0.01,
    section: 'Design',
    group: 'Temporal',
    designParentGroup: 'effects' as const,
    order: 4,
    exposure: 'primary' as const,
    modulatable: true,
    choreographable: true,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }),
])

const CINEMA2_HUMN_RUNTIME_PARAMETERS = Object.freeze([
  Object.freeze({
    id: CINEMA2_HUMN_STRUCTURAL_EVENT_INTENT_ID,
    label: 'Structural Event Intent',
    type: 'trigger' as const,
    section: 'React',
    group: 'Runtime',
    order: 998,
    exposure: 'hidden' as const,
    persistence: 'runtime-only' as const,
    reset: 'none' as const,
  }),
  Object.freeze({
    id: CINEMA2_HUMN_FRAGMENT_EVENT_INTENT_ID,
    label: 'Fragment Event Intent',
    type: 'trigger' as const,
    section: 'React',
    group: 'Runtime',
    order: 999,
    exposure: 'hidden' as const,
    persistence: 'runtime-only' as const,
    reset: 'none' as const,
  }),
])

export const CINEMA2_HUMN_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_HUMN_PRESET_ID,
  revision: 22,
  metadata: Object.freeze({
    name: 'HUM:N',
    description: 'A low-poly humanoid built from hundreds of black triangles outlined in white. Its head, body and arms move on the beat, it reaches, recoils, grabs its head and lunges at the camera as the music demands, and colored gradient, striped and halftone fills switch on across its faceted body while the palette follows the key and energy of the track.',
    tags: Object.freeze(['hum-n', 'native', 'humanoid', 'low-poly', 'wireframe', '3d', 'keeper']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native 3D figure rendering.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Depth-tested figure so hidden triangles stay hidden.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'The figure is a real 3D mesh with a bone rig.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Shared final camera: perspective, drift and beat-locked sway around the figure.' }),
    Object.freeze({ id: 'audio.bands' as const, requirement: 'optional' as const, purpose: 'Auto Color reads the spectral balance.' }),
    Object.freeze({ id: 'audio.features' as const, requirement: 'optional' as const, purpose: 'Energy, complexity and tension drive skin fill, fragmentation and motion; Auto Color reads energy and brightness.' }),
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'Beat-locked sway and beat flicker.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Downbeat flash and re-roll of the filled triangles.' }),
    Object.freeze({ id: 'music.rhythm-events' as const, requirement: 'optional' as const, purpose: 'Kick jitter and snare eye flashes.' }),
    Object.freeze({ id: 'music.vocal-presence' as const, requirement: 'optional' as const, purpose: 'Vocal presence restraint of intelligence-added motion.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'Build choreography, edge emphasis, and Auto Performance.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'Drop gestures (reach, shock, head grab, lunge).' }),
    Object.freeze({ id: 'music.phrase' as const, requirement: 'optional' as const, purpose: 'Phrase-boundary look, turn, and scan body language.' }),
    Object.freeze({ id: 'music.section' as const, requirement: 'optional' as const, purpose: 'Section-change look, turn, scan, and recenter; Auto Color steps.' }),
    Object.freeze({ id: 'render.history' as const, requirement: 'optional' as const, purpose: 'Trails afterimages when render history is available.' }),
  ]),
  parameters: Object.freeze([
    CINEMA2_QUALITY_MODE_PARAMETER,
    ...CINEMA2_HUMN_COMPOSITION_OUTPUT_PARAMETERS,
    ...CINEMA2_HUMN_FIGURE_PARAMETERS,
    ...CINEMA2_HUMN_PALETTE_PARAMETERS,
    ...CINEMA2_HUMN_EFFECTS_PARAMETERS,
    ...CINEMA2_HUMN_RUNTIME_PARAMETERS,
  ]),
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_HUMN_MODULE_ID,
    typeId: CINEMA2_HUMN_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_HUMN_NATIVE_MODULE_VERSION,
    enabled: true,
    parameters: Object.freeze({
      masterIntensity: 0.75,
      bpmSync: true,
      motionAmount: 0.6,
      motionRate: '1x',
      figureScale: 1,
      linePresence: 1,
      lineWeight: 1,
      fragmentation: 0.12,
      meshDetail: 'Reference',
      facetFill: 0.35,
      fillStyle: 'Mixed',
      autoColor: true,
      backgroundColor: Object.freeze([0, 0, 0, 1]),
      wireframeColor: Object.freeze([245 / 255, 247 / 255, 250 / 255, 1]),
      patternInk: Object.freeze([1, 1, 1, 1]),
      skinPrimary: Object.freeze([72 / 255, 240 / 255, 221 / 255, 1]),
      skinSecondary: Object.freeze([1, 61 / 255, 200 / 255, 1]),
      skinAccent: Object.freeze([200 / 255, 1, 74 / 255, 1]),
      flickerAmount: 0.5,
      fragmentJitter: 0.4,
      tensionMotionLift: 0,
      vocalMotionRestraint: 0,
      ghostEdgeEmphasis: 0,
      linePresenceLowering: 0,
      autoLineSparse: 0,
      buildMotionLift: 0,
      dropStrength: 0,
      phraseStrength: 0,
      sectionStrength: 0,
      autoPerformance: true,
      beatFlicker: 0,
      downbeatReveal: 0,
      kickJitter: 0,
      snareEyeCheek: 0,
    }),
    parameterBindings: Object.freeze({
      masterIntensity: cinema2Ref(CINEMA2_HUMN_MASTER_INTENSITY_ID),
      bpmSync: cinema2Ref(CINEMA2_HUMN_BPM_SYNC_ID),
      motionAmount: cinema2Ref(CINEMA2_HUMN_MOTION_AMOUNT_ID),
      motionRate: cinema2Ref(CINEMA2_HUMN_MOTION_RATE_ID),
      figureScale: cinema2Ref(CINEMA2_HUMN_FIGURE_SCALE_ID),
      linePresence: cinema2Ref(CINEMA2_HUMN_LINE_PRESENCE_ID),
      lineWeight: cinema2Ref(CINEMA2_HUMN_LINE_WEIGHT_ID),
      fragmentation: cinema2Ref(CINEMA2_HUMN_FRAGMENTATION_ID),
      meshDetail: cinema2Ref(CINEMA2_HUMN_MESH_DETAIL_ID),
      facetFill: cinema2Ref(CINEMA2_HUMN_FACET_FILL_ID),
      fillStyle: cinema2Ref(CINEMA2_HUMN_FILL_STYLE_ID),
      autoColor: cinema2Ref(CINEMA2_HUMN_AUTO_COLOR_ID),
      backgroundColor: cinema2Ref(CINEMA2_HUMN_BACKGROUND_ID),
      wireframeColor: cinema2Ref(CINEMA2_HUMN_WIREFRAME_ID),
      patternInk: cinema2Ref(CINEMA2_HUMN_PATTERN_INK_ID),
      skinPrimary: cinema2Ref(CINEMA2_HUMN_SKIN_PRIMARY_ID),
      skinSecondary: cinema2Ref(CINEMA2_HUMN_SKIN_SECONDARY_ID),
      skinAccent: cinema2Ref(CINEMA2_HUMN_SKIN_ACCENT_ID),
      flickerAmount: cinema2Ref(CINEMA2_HUMN_FLICKER_AMOUNT_ID),
      fragmentJitter: cinema2Ref(CINEMA2_HUMN_FRAGMENT_JITTER_ID),
      autoPerformance: cinema2Ref(CINEMA2_HUMN_AUTO_PERFORMANCE_ID),
    }),
    actionBindings: Object.freeze({
      fragmentEvent: cinema2Ref(CINEMA2_HUMN_FRAGMENT_EVENT_INTENT_ID),
      structuralEvent: cinema2Ref(CINEMA2_HUMN_STRUCTURAL_EVENT_INTENT_ID),
    }),
    config: Object.freeze({ label: 'HUM:N 3D Figure' }),
  })]),
  choreography: Object.freeze({
    rules: Object.freeze([
      // Part B: Continuous appearance Audio Intelligence
      // Energy can only LOWER Line Presence (max 0.45, applied multiplicatively
      // by the module, so the floor is 0.55x the user's own value).
      Object.freeze({
        id: choreographyRuleId('hum-n-overall-energy-line-presence'),
        priority: 10,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.features' as const, path: 'audio.features.overallEnergy' as const, scale: -1, offset: 1, smoothingMs: 300 }),
        actions: Object.freeze([Object.freeze({
          id: choreographyActionId('hum-n-energy-lp-lowering'),
          target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_HUMN_MODULE_ID), property: 'linePresenceLowering' }),
          operation: 'replace' as const,
          value: 0.45,
        })]),
        strengthParameter: cinema2Ref(CINEMA2_HUMN_MASTER_INTENSITY_ID),
      }),
      Object.freeze({
        id: choreographyRuleId('hum-n-complexity-fragmentation'),
        priority: 11,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.features' as const, path: 'audio.features.complexity' as const, offset: -0.5, smoothingMs: 400 }),
        actions: Object.freeze([Object.freeze({
          id: choreographyActionId('hum-n-complexity-frag-add'),
          target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_HUMN_MODULE_ID), property: 'fragmentation' }),
          operation: 'add' as const,
          value: 0.36,
        })]),
        strengthParameter: cinema2Ref(CINEMA2_HUMN_MASTER_INTENSITY_ID),
      }),
      Object.freeze({
        id: choreographyRuleId('hum-n-track-energy-facet-fill'),
        priority: 12,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.features' as const, path: 'audio.features.trackEnergy' as const, smoothingMs: 200 }),
        actions: Object.freeze([Object.freeze({
          id: choreographyActionId('hum-n-energy-facet-add'),
          target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_HUMN_MODULE_ID), property: 'facetFill' }),
          operation: 'add' as const,
          value: 0.35,
        })]),
        strengthParameter: cinema2Ref(CINEMA2_HUMN_MASTER_INTENSITY_ID),
      }),
      // Part D: Tension motion lift + vocal restraint
      Object.freeze({
        id: choreographyRuleId('hum-n-tension-motion-lift'),
        priority: 15,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.features' as const, path: 'audio.features.tension' as const, smoothingMs: 250 }),
        actions: Object.freeze([Object.freeze({
          id: choreographyActionId('hum-n-tension-motion-replace'),
          target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_HUMN_MODULE_ID), property: 'tensionMotionLift' }),
          operation: 'replace' as const,
          value: 0.25,
        })]),
        strengthParameter: cinema2Ref(CINEMA2_HUMN_MASTER_INTENSITY_ID),
      }),
      Object.freeze({
        id: choreographyRuleId('hum-n-vocal-motion-restraint'),
        priority: 16,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'music.vocal-presence' as const, path: 'audio.features.vocalPresence' as const, smoothingMs: 300 }),
        actions: Object.freeze([Object.freeze({
          id: choreographyActionId('hum-n-vocal-restraint-replace'),
          target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_HUMN_MODULE_ID), property: 'vocalMotionRestraint' }),
          operation: 'replace' as const,
          value: 0.25,
        })]),
        strengthParameter: cinema2Ref(CINEMA2_HUMN_MASTER_INTENSITY_ID),
      }),
      // Part G: Build choreography
      Object.freeze({
        id: choreographyRuleId('hum-n-build-facet-fill'),
        priority: 20,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 500 }),
        actions: Object.freeze([Object.freeze({
          id: choreographyActionId('hum-n-build-facet-add'),
          target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_HUMN_MODULE_ID), property: 'facetFill' }),
          operation: 'add' as const,
          value: 0.25,
        })]),
        strengthParameter: cinema2Ref(CINEMA2_HUMN_MASTER_INTENSITY_ID),
      }),
      Object.freeze({
        id: choreographyRuleId('hum-n-build-fragmentation'),
        priority: 21,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 500 }),
        actions: Object.freeze([Object.freeze({
          id: choreographyActionId('hum-n-build-frag-add'),
          target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_HUMN_MODULE_ID), property: 'fragmentation' }),
          operation: 'add' as const,
          value: -0.12,
        })]),
        strengthParameter: cinema2Ref(CINEMA2_HUMN_MASTER_INTENSITY_ID),
      }),
      Object.freeze({
        id: choreographyRuleId('hum-n-build-motion-amount'),
        priority: 22,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 500 }),
        actions: Object.freeze([Object.freeze({
          id: choreographyActionId('hum-n-build-motion-lift'),
          target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_HUMN_MODULE_ID), property: 'buildMotionLift' }),
          operation: 'replace' as const,
          value: 0.15,
        })]),
        strengthParameter: cinema2Ref(CINEMA2_HUMN_MASTER_INTENSITY_ID),
      }),
      Object.freeze({
        id: choreographyRuleId('hum-n-build-ghost-edge'),
        priority: 24,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 500 }),
        actions: Object.freeze([Object.freeze({
          id: choreographyActionId('hum-n-build-ghost-replace'),
          target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_HUMN_MODULE_ID), property: 'ghostEdgeEmphasis' }),
          operation: 'replace' as const,
          value: 0.20,
        })]),
        strengthParameter: cinema2Ref(CINEMA2_HUMN_MASTER_INTENSITY_ID),
      }),
      // Structural events (Part C/D): Choreography owns detection, dedupe and
      // strength; the module owns timing and deterministic selection through
      // the hidden structural intent (event id) and per-kind strength targets.
      // They only run while Auto Performance is on: it owns every pose.
      Object.freeze({
        id: choreographyRuleId('hum-n-drop-gesture'),
        enabledParameter: cinema2Ref(CINEMA2_HUMN_AUTO_PERFORMANCE_ID),
        priority: 40,
        source: Object.freeze({ signal: 'drop' as const, capability: 'music.drop' as const }),
        conditions: Object.freeze([Object.freeze({ kind: 'drop' as const, min: 0.35 })]),
        actions: Object.freeze([
          structuralEventSpawnAction('hum-n-drop-event', 'drop'),
          structuralStrengthAction('hum-n-drop-strength', 'dropStrength'),
        ]),
      }),
      Object.freeze({
        id: choreographyRuleId('hum-n-phrase-look'),
        enabledParameter: cinema2Ref(CINEMA2_HUMN_AUTO_PERFORMANCE_ID),
        priority: 41,
        source: Object.freeze({ signal: 'phrase' as const, capability: 'music.phrase' as const }),
        actions: Object.freeze([
          structuralEventSpawnAction('hum-n-phrase-event', 'phrase'),
          structuralStrengthAction('hum-n-phrase-strength', 'phraseStrength'),
        ]),
      }),
      Object.freeze({
        id: choreographyRuleId('hum-n-section-look'),
        enabledParameter: cinema2Ref(CINEMA2_HUMN_AUTO_PERFORMANCE_ID),
        priority: 42,
        source: Object.freeze({ signal: 'section-change' as const, capability: 'music.section' as const }),
        actions: Object.freeze([
          structuralEventSpawnAction('hum-n-section-event', 'section'),
          structuralStrengthAction('hum-n-section-strength', 'sectionStrength'),
        ]),
      }),
      // Auto Performance (Part E): gated by the user's Auto Performance switch, which also owns every pose the figure strikes (the three
      // structural rules above are gated by it too). Every contribution is bounded by Master Intensity; nothing here writes a user value.
      Object.freeze({
        id: choreographyRuleId('hum-n-auto-skin-emphasis'),
        priority: 50,
        enabledParameter: cinema2Ref(CINEMA2_HUMN_AUTO_PERFORMANCE_ID),
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.intensity' as const, scale: 2, offset: -1, clamp: Object.freeze([0, 1] as const), smoothingMs: 250 }),
        actions: Object.freeze([Object.freeze({
          id: choreographyActionId('hum-n-auto-facet-emphasis'),
          target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_HUMN_MODULE_ID), property: 'facetFill' }),
          operation: 'add' as const,
          value: 0.2,
        })]),
        strengthParameter: cinema2Ref(CINEMA2_HUMN_MASTER_INTENSITY_ID),
      }),
      Object.freeze({
        id: choreographyRuleId('hum-n-auto-line-sparse'),
        priority: 51,
        enabledParameter: cinema2Ref(CINEMA2_HUMN_AUTO_PERFORMANCE_ID),
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.intensity' as const, scale: -1, offset: 1, clamp: Object.freeze([0, 1] as const), smoothingMs: 250 }),
        actions: Object.freeze([Object.freeze({
          id: choreographyActionId('hum-n-auto-line-sparse-lowering'),
          target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_HUMN_MODULE_ID), property: 'autoLineSparse' }),
          operation: 'replace' as const,
          value: 0.2,
        })]),
        strengthParameter: cinema2Ref(CINEMA2_HUMN_MASTER_INTENSITY_ID),
      }),
      // Part F: Rhythmic fragment events. Each rule carries (1) a beat-timed
      // envelope that the shared choreography runtime owns and (2) a spawn of
      // the hidden event intent, so the module receives the stable event id it
      // needs to choose the same fragment subset for the same event.
      Object.freeze({
        id: choreographyRuleId('hum-n-beat-flicker'),
        priority: 30,
        source: Object.freeze({ signal: 'beat' as const, capability: 'music.beat' as const }),
        actions: Object.freeze([
          fragmentEventSpawnAction('hum-n-beat-event', 'beat'),
          Object.freeze({
            id: choreographyActionId('hum-n-beat-flicker-envelope'),
            target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_HUMN_MODULE_ID), property: 'beatFlicker' }),
            operation: 'envelope' as const,
            value: 1,
            composition: 'replace' as const,
            envelope: Object.freeze({ attack: 0, hold: 0.02, release: 0.35, unit: 'beats' as const }),
            retrigger: 'restart' as const,
          }),
        ]),
      }),
      Object.freeze({
        id: choreographyRuleId('hum-n-downbeat-reveal'),
        priority: 31,
        source: Object.freeze({ signal: 'downbeat' as const, capability: 'music.downbeat' as const }),
        actions: Object.freeze([
          fragmentEventSpawnAction('hum-n-downbeat-event', 'downbeat'),
          Object.freeze({
            id: choreographyActionId('hum-n-downbeat-reveal-envelope'),
            target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_HUMN_MODULE_ID), property: 'downbeatReveal' }),
            operation: 'envelope' as const,
            value: 1,
            composition: 'replace' as const,
            envelope: Object.freeze({ attack: 0, hold: 0.05, release: 0.5, unit: 'beats' as const }),
            retrigger: 'restart' as const,
          }),
        ]),
      }),
      Object.freeze({
        id: choreographyRuleId('hum-n-kick-jitter'),
        priority: 32,
        source: Object.freeze({ signal: 'kick' as const, capability: 'music.rhythm-events' as const }),
        actions: Object.freeze([
          fragmentEventSpawnAction('hum-n-kick-event', 'kick'),
          Object.freeze({
            id: choreographyActionId('hum-n-kick-jitter-envelope'),
            target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_HUMN_MODULE_ID), property: 'kickJitter' }),
            operation: 'envelope' as const,
            value: 1,
            composition: 'replace' as const,
            envelope: Object.freeze({ attack: 0, hold: 0.02, release: 0.5, unit: 'beats' as const }),
            retrigger: 'restart' as const,
          }),
        ]),
      }),
      Object.freeze({
        id: choreographyRuleId('hum-n-snare-eye-cheek'),
        priority: 33,
        source: Object.freeze({ signal: 'snare' as const, capability: 'music.rhythm-events' as const }),
        actions: Object.freeze([
          fragmentEventSpawnAction('hum-n-snare-event', 'snare'),
          Object.freeze({
            id: choreographyActionId('hum-n-snare-eye-cheek-envelope'),
            target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_HUMN_MODULE_ID), property: 'snareEyeCheek' }),
            operation: 'envelope' as const,
            value: 1,
            composition: 'replace' as const,
            envelope: Object.freeze({ attack: 0, hold: 0.02, release: 0.25, unit: 'beats' as const }),
            retrigger: 'restart' as const,
          }),
        ]),
      }),
      // Finishing (Glow / Trails). One artistic control drives several engine
      // effect values through parameter-sourced routes, so the derived values are
      // transient targets and are never written back to the user's parameters.
      // Trails: mix = t * (1 - 0.25 t) (0.44 at 0.5, 0.75 at 1); persistence = 0.72 + 0.22 t (0.83, 0.94).
      Object.freeze({
        id: choreographyRuleId('hum-n-trails-mix-curve'),
        priority: 60,
        source: Object.freeze({ signal: 'parameter' as const, parameter: cinema2Ref(CINEMA2_HUMN_TRAILS_ID) }),
        actions: Object.freeze([Object.freeze({
          id: choreographyActionId('hum-n-trails-mix-shape'),
          target: effectTarget(CINEMA2_HUMN_TRAILS_EFFECT_ID, 'mix'),
          operation: 'multiply' as const,
          value: 0.75,
        })]),
      }),
      Object.freeze({
        id: choreographyRuleId('hum-n-trails-persistence-curve'),
        priority: 61,
        source: Object.freeze({ signal: 'parameter' as const, parameter: cinema2Ref(CINEMA2_HUMN_TRAILS_ID) }),
        actions: Object.freeze([Object.freeze({
          id: choreographyActionId('hum-n-trails-persistence-lift'),
          target: effectTarget(CINEMA2_HUMN_TRAILS_EFFECT_ID, 'persistence'),
          operation: 'add' as const,
          value: 0.22,
        })]),
      }),
      // Glow: the built-in Bloom uses a compact 13-tap kernel, so the halo is kept tight (radius 1.0-2.0 px,
      // threshold above saturated skin colors) and grows mostly in strength; a wider radius would comb into ghost lines.
      Object.freeze({
        id: choreographyRuleId('hum-n-glow-radius-curve'),
        priority: 62,
        source: Object.freeze({ signal: 'parameter' as const, parameter: cinema2Ref(CINEMA2_HUMN_GLOW_ID) }),
        actions: Object.freeze([
          Object.freeze({
            id: choreographyActionId('hum-n-glow-radius-lift'),
            target: effectTarget(CINEMA2_HUMN_BLOOM_EFFECT_ID, 'radius'),
            operation: 'add' as const,
            value: 1.0,
          }),
          Object.freeze({
            id: choreographyActionId('hum-n-glow-intensity-lift'),
            target: effectTarget(CINEMA2_HUMN_BLOOM_EFFECT_ID, 'intensity'),
            operation: 'add' as const,
            value: 1.6,
          }),
        ]),
      }),
      // Intelligence modulation is multiplicative, so a user value of 0 stays a hard off.
      Object.freeze({
        id: choreographyRuleId('hum-n-build-glow'),
        priority: 63,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 500 }),
        actions: Object.freeze([Object.freeze({
          id: choreographyActionId('hum-n-build-glow-lift'),
          target: effectTarget(CINEMA2_HUMN_BLOOM_EFFECT_ID, 'mix'),
          operation: 'multiply' as const,
          value: 1.35,
        })]),
        strengthParameter: cinema2Ref(CINEMA2_HUMN_MASTER_INTENSITY_ID),
      }),
      Object.freeze({
        id: choreographyRuleId('hum-n-impact-trails'),
        priority: 64,
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.impact' as const, smoothingMs: 120 }),
        actions: Object.freeze([Object.freeze({
          id: choreographyActionId('hum-n-impact-trails-lift'),
          target: effectTarget(CINEMA2_HUMN_TRAILS_EFFECT_ID, 'mix'),
          operation: 'multiply' as const,
          value: 1.25,
        })]),
        strengthParameter: cinema2Ref(CINEMA2_HUMN_MASTER_INTENSITY_ID),
      }),
    ]),
  }),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: CINEMA2_HUMN_ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const, visible: true }),
      Object.freeze({ id: CINEMA2_HUMN_MODULE_NODE_ID, kind: 'module' as const, parent: cinema2Ref(CINEMA2_HUMN_ROOT_NODE_ID), module: cinema2Ref(CINEMA2_HUMN_MODULE_ID), visible: true }),
    ]),
    roots: Object.freeze([cinema2Ref(CINEMA2_HUMN_ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([Object.freeze({
    id: CINEMA2_HUMN_LAYER_ID,
    label: 'HUM:N Figure',
    source: cinema2Ref(CINEMA2_HUMN_ROOT_NODE_ID),
    role: 'world' as const,
    visible: true,
    opacity: 1,
    blendMode: 'normal' as const,
    depthPolicy: 'read-write' as const,
    order: 0,
  })]),
  cameras: Object.freeze([
    Object.freeze({
      id: CINEMA2_HUMN_CAMERA_ID,
      label: 'HUM:N Bust',
      projection: 'perspective' as const,
      fovDegrees: 34,
      near: 0.05,
      far: 30,
      transform: Object.freeze({ position: Object.freeze([0, 0.72, 1.32] as const) }),
      target: Object.freeze([0, 0.68, 0] as const),
      rig: Object.freeze({ kind: 'static' as const }),
      // Motion Amount scales all of this (0 = locked off). A slow handheld drift plus a beat-locked sway: a weave over two bars, a bob every
      // beat, a lens breath every bar and a small zoom punch on every kick. BPM Sync locks it to the track's beats; off, it free-runs at 120 BPM.
      motion: cinema2CinematicMotion('steady', {
        overrides: Object.freeze({
          drift: Object.freeze({ position: 0.05, target: 0.02, rollDegrees: 0.6, fovDegrees: 0.8, speed: 0.07 }),
          tempo: Object.freeze({ referenceBpm: 120, flightSpeed: false, weave: 0.09, bob: 0.012, roll: 1, fov: 1.4, punch: 1.8 }),
        }),
      }),
      controls: Object.freeze({ motionAmount: cinema2Ref(CINEMA2_HUMN_MOTION_AMOUNT_ID), tempoSync: cinema2Ref(CINEMA2_HUMN_BPM_SYNC_ID) }),
    }),
  ]),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_HUMN_CAMERA_ID) }),
  environment: Object.freeze({
    backgroundColor: Object.freeze([0, 0, 0, 1] as const),
    exposure: 1,
    controls: Object.freeze({ backgroundColor: cinema2Ref(CINEMA2_HUMN_BACKGROUND_ID) }),
  }),
  effects: Object.freeze([
    Object.freeze({
      id: CINEMA2_HUMN_TRAILS_EFFECT_ID,
      typeId: CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 0,
      scope: 'output' as const,
      quality: Object.freeze({ min: 'low' as const }),
      parameters: Object.freeze({
        mix: 0,
        persistence: 0.72,
        // No spiral drift: echoes follow real HUM:N movement and a static figure leaves none.
        drift: 0,
        transportAware: true,
      }),
      parameterBindings: Object.freeze({
        mix: cinema2Ref(CINEMA2_HUMN_TRAILS_ID),
      }),
    }),
    Object.freeze({
      id: CINEMA2_HUMN_BLOOM_EFFECT_ID,
      typeId: CINEMA2_BLOOM_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 1,
      scope: 'output' as const,
      quality: Object.freeze({ min: 'low' as const }),
      parameters: Object.freeze({
        mix: 0,
        threshold: 0.68,
        radius: 1.0,
        intensity: 1.4,
      }),
      parameterBindings: Object.freeze({
        mix: cinema2Ref(CINEMA2_HUMN_GLOW_ID),
      }),
    }),
  ]),
  render: Object.freeze({
    targets: Object.freeze([
      Object.freeze({
        id: CINEMA2_HUMN_SCENE_TARGET_ID,
        descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba8' as const, depthFormat: 'depth24' as const }),
        ownership: 'transient' as const,
      }),
      Object.freeze({
        id: CINEMA2_HUMN_TRAILS_TARGET_ID,
        descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba8' as const, depthFormat: 'none' as const }),
        ownership: 'transient' as const,
      }),
    ]),
    passes: Object.freeze([
      Object.freeze({
        id: CINEMA2_HUMN_SCENE_PASS_ID,
        kind: 'scene' as const,
        layers: Object.freeze([cinema2Ref(CINEMA2_HUMN_LAYER_ID)]),
        outputs: Object.freeze([Object.freeze({
          id: CINEMA2_HUMN_SCENE_COLOR_OUTPUT_ID,
          target: cinema2Ref(CINEMA2_HUMN_SCENE_TARGET_ID),
          attachment: 'color' as const,
        })]),
      }),
      Object.freeze({
        id: CINEMA2_HUMN_TRAILS_PASS_ID,
        kind: 'fullscreen' as const,
        effect: cinema2Ref(CINEMA2_HUMN_TRAILS_EFFECT_ID),
        inputs: Object.freeze([Object.freeze({
          id: CINEMA2_HUMN_TRAILS_INPUT_ID,
          source: Object.freeze({ pass: cinema2Ref(CINEMA2_HUMN_SCENE_PASS_ID), output: CINEMA2_HUMN_SCENE_COLOR_OUTPUT_ID }),
        })]),
        outputs: Object.freeze([Object.freeze({
          id: CINEMA2_HUMN_TRAILS_COLOR_OUTPUT_ID,
          target: cinema2Ref(CINEMA2_HUMN_TRAILS_TARGET_ID),
          attachment: 'color' as const,
        })]),
      }),
      Object.freeze({
        id: CINEMA2_HUMN_BLOOM_PASS_ID,
        kind: 'fullscreen' as const,
        effect: cinema2Ref(CINEMA2_HUMN_BLOOM_EFFECT_ID),
        inputs: Object.freeze([Object.freeze({
          id: CINEMA2_HUMN_BLOOM_INPUT_ID,
          source: Object.freeze({ pass: cinema2Ref(CINEMA2_HUMN_TRAILS_PASS_ID), output: CINEMA2_HUMN_TRAILS_COLOR_OUTPUT_ID }),
        })]),
      }),
    ]),
    outputPass: cinema2Ref(CINEMA2_HUMN_BLOOM_PASS_ID),
  }),
  output: Object.freeze({
    renderPass: cinema2Ref(CINEMA2_HUMN_BLOOM_PASS_ID),
    colorSpace: 'srgb' as const,
    alphaMode: 'premultiplied' as const,
  }),
})
