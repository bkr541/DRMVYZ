import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2Color,
  type Cinema2DesignParentGroup,
  type Cinema2EffectId,
  type Cinema2EffectTypeId,
  type Cinema2LayerId,
  type Cinema2LightId,
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
import { CINEMA2_SAY_IT_MODULE_TYPE_ID } from '../modules/Cinema2SayItNativeModule'
import {
  CINEMA2_SAY_IT_CAMERA_DISTANCE,
  CINEMA2_SAY_IT_CAMERA_FOV_DEGREES,
  CINEMA2_SAY_IT_COMPOSED_MIN_ASPECT,
} from '../modules/sayIt/Cinema2SayItQuality'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'

export const CINEMA2_SAY_IT_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.say-it')
export const CINEMA2_SAY_IT_MODULE_ID = cinema2StableId<Cinema2ModuleId>('say-it-glyphs')

const parameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`say-it-${name}`)
export const CINEMA2_SAY_IT_LINE_ONE_TEXT_ID = parameterId('text')
export const CINEMA2_SAY_IT_LINE_TWO_TEXT_ID = parameterId('line-2-text')
/** Backwards-compatible alias for the original first-line parameter ID. */
export const CINEMA2_SAY_IT_TEXT_ID = CINEMA2_SAY_IT_LINE_ONE_TEXT_ID
export const CINEMA2_SAY_IT_MOTION_ID = parameterId('motion')
export const CINEMA2_SAY_IT_BPM_SYNC_ID = parameterId('bpm-sync')
export const CINEMA2_SAY_IT_CYCLE_ID = parameterId('cycle-seconds')
export const CINEMA2_SAY_IT_SPREAD_ID = parameterId('spread')
export const CINEMA2_SAY_IT_LINE_MODE_ID = parameterId('line-mode')
export const CINEMA2_SAY_IT_ALIGNMENT_ID = parameterId('alignment')
export const CINEMA2_SAY_IT_TRACKING_ID = parameterId('tracking')
export const CINEMA2_SAY_IT_LINE_SPACING_ID = parameterId('line-spacing')
export const CINEMA2_SAY_IT_GLYPH_SCALE_ID = parameterId('glyph-scale')
export const CINEMA2_SAY_IT_ROUGHNESS_ID = parameterId('roughness')
export const CINEMA2_SAY_IT_REFLECTION_ID = parameterId('environment-reflection')
export const CINEMA2_SAY_IT_SWEEP_ID = parameterId('highlight-sweep')
export const CINEMA2_SAY_IT_BLOOM_ID = parameterId('bloom')
export const CINEMA2_SAY_IT_FINISH_ID = parameterId('finish')
export const CINEMA2_SAY_IT_BACKGROUND_ID = parameterId('background')
export const CINEMA2_SAY_IT_CHROME_ID = parameterId('chrome')

export const CINEMA2_SAY_IT_CAMERA_ID = cinema2StableId<Cinema2CameraId>('say-it-camera')
const ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('say-it-world-root')
const GLYPH_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('say-it-glyph-node')
const FOCUS_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('say-it-focus')
const WORLD_LAYER_ID = cinema2StableId<Cinema2LayerId>('say-it-world-layer')
const KEY_LIGHT_ID = cinema2StableId<Cinema2LightId>('say-it-key')
const RIM_LIGHT_ID = cinema2StableId<Cinema2LightId>('say-it-rim')
const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('say-it-ambient')

const BLOOM_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('bloom')
const FINISH_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('cinematic-finish')
const BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('say-it-bloom-effect')
const FINISH_EFFECT_ID = cinema2StableId<Cinema2EffectId>('say-it-finish-effect')

const SCENE_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('say-it-scene-target')
const BLOOM_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('say-it-bloom-target')
const SCENE_PASS_ID = cinema2StableId<Cinema2RenderPassId>('say-it-scene-pass')
const BLOOM_PASS_ID = cinema2StableId<Cinema2RenderPassId>('say-it-bloom-pass')
const FINISH_PASS_ID = cinema2StableId<Cinema2RenderPassId>('say-it-finish-pass')
const SCENE_COLOR_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('say-it-scene-color')
const SCENE_DEPTH_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('say-it-scene-depth')
const BLOOM_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('say-it-bloom-input')
const BLOOM_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('say-it-bloom-output')
const FINISH_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('say-it-finish-input')

function vec3(x: number, y: number, z: number): Cinema2Vector3 { return Object.freeze([x, y, z]) }
function color(r: number, g: number, b: number, a = 1): Cinema2Color { return Object.freeze([r, g, b, a]) }

const DEFAULT_BACKGROUND = color(0.002, 0.003, 0.005)
const DEFAULT_CHROME = color(0.82, 0.84, 0.88)

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

/**
 * Editable one/two-line kinetic 3D type backed by the versioned printable Basic
 * Latin glyph package. The preset name and authored default remain SAY IT.
 */
export const CINEMA2_SAY_IT_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_SAY_IT_PRESET_ID,
  revision: 4,
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
    floatParameter(CINEMA2_SAY_IT_CYCLE_ID, 'Cycle Length', 'Seconds per assemble-break-flip-resolve cycle at the reference tempo.', 'design', 6, 'Motion', 8, 2, 20, 0.25),
    floatParameter(CINEMA2_SAY_IT_SPREAD_ID, 'Spread', 'Distance the independent letters travel away from the exact typeset layout.', 'design', 7, 'Motion', 1, 0, 3, 0.05),
    floatParameter(CINEMA2_SAY_IT_ROUGHNESS_ID, 'Chrome Roughness', 'Surface finish from mirror-like to softly brushed chrome.', 'design', 8, 'Material', 0.16, 0.04, 1, 0.01),
    floatParameter(CINEMA2_SAY_IT_REFLECTION_ID, 'Environment Reflection', 'Strength of the studio environment reflected by the chrome.', 'design', 9, 'Material', 1.25, 0, 4, 0.05),
    floatParameter(CINEMA2_SAY_IT_SWEEP_ID, 'Highlight Sweep', 'Speed of the reflected studio light moving across the letter faces.', 'design', 10, 'Lighting', 0.65, 0, 2, 0.05),
    floatParameter(CINEMA2_SAY_IT_BLOOM_ID, 'Bloom', 'Glow around the brightest chrome highlights.', 'effects', 1, 'Post', 0.35, 0, 2, 0.05),
    floatParameter(CINEMA2_SAY_IT_FINISH_ID, 'Cinematic Finish', 'Filmic contrast, tone curve, vignette and subtle grain.', 'effects', 2, 'Post', 0.75, 0, 1, 0.05),
    Object.freeze({ ...base(CINEMA2_SAY_IT_BACKGROUND_ID, 'Background', 'The seamless void behind the letters.', 'palette', 1, 'Color'), type: 'color' as const, defaultValue: DEFAULT_BACKGROUND }),
    Object.freeze({ ...base(CINEMA2_SAY_IT_CHROME_ID, 'Chrome Tint', 'Base tint of the reflective metal letters.', 'palette', 2, 'Color'), type: 'color' as const, defaultValue: DEFAULT_CHROME }),
  ]),
  modules: Object.freeze([
    Object.freeze({
      id: CINEMA2_SAY_IT_MODULE_ID,
      typeId: CINEMA2_SAY_IT_MODULE_TYPE_ID,
      version: 1,
      enabled: true,
      parameters: Object.freeze({
        line1Text: 'SAY IT', line2Text: '', lineMode: 'two', alignment: 'center', tracking: 0.06, lineSpacing: 0.7, glyphScale: 1,
        motionAmount: 1, bpmSync: true, cycleSeconds: 8, spread: 1, roughness: 0.16,
        environmentIntensity: 1.25, highlightSweep: 0.65, color: DEFAULT_CHROME,
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
        bpmSync: cinema2Ref(CINEMA2_SAY_IT_BPM_SYNC_ID),
        cycleSeconds: cinema2Ref(CINEMA2_SAY_IT_CYCLE_ID),
        spread: cinema2Ref(CINEMA2_SAY_IT_SPREAD_ID),
        roughness: cinema2Ref(CINEMA2_SAY_IT_ROUGHNESS_ID),
        environmentIntensity: cinema2Ref(CINEMA2_SAY_IT_REFLECTION_ID),
        highlightSweep: cinema2Ref(CINEMA2_SAY_IT_SWEEP_ID),
        color: cinema2Ref(CINEMA2_SAY_IT_CHROME_ID),
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
    }),
  ]),
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
      id: BLOOM_EFFECT_ID,
      typeId: BLOOM_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 0,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 0.4, threshold: 0.62, radius: 1.8, intensity: 0.35 }),
      parameterBindings: Object.freeze({ intensity: cinema2Ref(CINEMA2_SAY_IT_BLOOM_ID) }),
    }),
    Object.freeze({
      id: FINISH_EFFECT_ID,
      typeId: FINISH_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 1,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 0.75, exposure: 1.08, contrast: 1.12, saturation: 0.92, vignette: 0.26, grain: 0.08, aberration: 0.04 }),
      parameterBindings: Object.freeze({ mix: cinema2Ref(CINEMA2_SAY_IT_FINISH_ID) }),
    }),
  ]),
  render: Object.freeze({
    targets: Object.freeze([
      Object.freeze({
        id: SCENE_TARGET_ID,
        descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba8' as const, depthFormat: 'depth24' as const }),
        ownership: 'transient' as const,
      }),
      Object.freeze({
        id: BLOOM_TARGET_ID,
        descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba8' as const }),
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
        id: BLOOM_PASS_ID,
        kind: 'fullscreen' as const,
        dependsOn: Object.freeze([cinema2Ref(SCENE_PASS_ID)]),
        effect: cinema2Ref(BLOOM_EFFECT_ID),
        inputs: Object.freeze([
          Object.freeze({ id: BLOOM_INPUT_ID, source: Object.freeze({ pass: cinema2Ref(SCENE_PASS_ID), output: SCENE_COLOR_OUTPUT_ID }), attachment: 'color' as const }),
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
