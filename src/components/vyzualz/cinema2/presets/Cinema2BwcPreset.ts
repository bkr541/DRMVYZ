import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
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
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_BWC_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2BwcNativeModule'
import { CINEMA2_BWC_DEFAULT_PATTERN, CINEMA2_BWC_PATTERN_IDS, CINEMA2_BWC_PATTERN_LABELS } from '../modules/bwc/Cinema2BwcPatternEngine'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'

/**
 * BWC: a dim industrial canning hall. Cans ride the left belt through the reactor's intake hood and come out the far side as creatures that
 * walk round the back and down the right-hand service walk. The reactor, its five energy pipes, the white LED panels on both side walls and
 * the fluorescent tubes across the ceiling are lit by six lighting programs (Flow, Core Burst, Alternate, Center Out, Ceiling Sweep, Surge)
 * that place light by where each element stands in the hall; bloom and a light finish complete the look.
 */
export const CINEMA2_BWC_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.bwc')
export const CINEMA2_BWC_MODULE_ID = cinema2StableId<Cinema2ModuleId>('bwc-scene')
const pid = (name: string) => cinema2StableId<Cinema2ParameterId>(`bwc-${name}`)
export const CINEMA2_BWC_PARAMETER_IDS = Object.freeze({
  intensity: pid('intensity'), bpmSync: pid('bpm-sync'), conveyorSpeed: pid('conveyor-speed'), lightReactivity: pid('light-reactivity'),
  pattern: pid('pattern'), patternChange: pid('pattern-change'), trigger: pid('trigger'),
  portalScale: pid('portal-scale'), ledStrength: pid('led-strength'), canScale: pid('can-scale'), conveyorWidth: pid('conveyor-width'),
  pulseWidth: pid('pulse-width'), dropIntensity: pid('drop-intensity'), flicker: pid('flicker'), bloom: pid('bloom'), finish: pid('finish'),
  reactorColor: pid('reactor-color'), pipeColor: pid('pipe-color'), wallColor: pid('wall-color'), ceilingColor: pid('ceiling-color'), structure: pid('structure'),
})
const P = CINEMA2_BWC_PARAMETER_IDS

const ROOT = cinema2StableId<Cinema2SceneNodeId>('bwc-root'), NODE = cinema2StableId<Cinema2SceneNodeId>('bwc-node'), LAYER = cinema2StableId<Cinema2LayerId>('bwc-layer')
const SCENE_PASS = cinema2StableId<Cinema2RenderPassId>('bwc-pass'), BLOOM_PASS = cinema2StableId<Cinema2RenderPassId>('bwc-bloom-pass'), FINISH_PASS = cinema2StableId<Cinema2RenderPassId>('bwc-finish-pass')
const SCENE_TARGET = cinema2StableId<Cinema2RenderTargetId>('bwc-scene-target'), BLOOM_TARGET = cinema2StableId<Cinema2RenderTargetId>('bwc-bloom-target')
const slot = (name: string) => cinema2StableId<Cinema2RenderSlotId>(`bwc-${name}`)
const SCENE_COLOR = slot('scene-color'), BLOOM_OUTPUT = slot('bloom-output')
const BLOOM = cinema2StableId<Cinema2EffectId>('bwc-bloom'), FINISH = cinema2StableId<Cinema2EffectId>('bwc-finish')

const color = (r: number, g: number, b: number): Cinema2Color => Object.freeze([r, g, b, 1])
const REACTOR = color(0.28, 0.62, 0.18), PIPES = color(0.28, 0.62, 0.18), WALL_LEDS = color(0.82, 0.94, 1), CEILING_LIGHTS = color(0.82, 0.94, 1), STRUCTURE = color(0.52, 0.59, 0.62)

const base = Object.freeze({ section: 'Design', exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const, modulatable: false, choreographable: false, automatable: false })
type Parent = 'master-controls' | 'design' | 'effects'
const float = (id: Cinema2ParameterId, label: string, description: string, defaultValue: number, min: number, max: number, step: number, parent: Parent, group: string, order: number) => Object.freeze({ ...base, id, label, description, type: 'float' as const, defaultValue, min, max, step, designParentGroup: parent, group, order })
const toggle = (id: Cinema2ParameterId, label: string, description: string, defaultValue: boolean, parent: Parent, group: string, order: number) => Object.freeze({ ...base, id, label, description, type: 'boolean' as const, defaultValue, designParentGroup: parent, group, order })
const palette = (id: Cinema2ParameterId, label: string, description: string, value: Cinema2Color, order: number) => Object.freeze({ ...base, id, label, description, type: 'color' as const, defaultValue: value, designParentGroup: 'palette' as const, group: 'Hall Palette', order })

const PATTERN_OPTIONS = Object.freeze(CINEMA2_BWC_PATTERN_IDS.map(value => Object.freeze({ value, label: CINEMA2_BWC_PATTERN_LABELS[value] })))

// Float targets carry the lit elements' light above white into the bloom; a GPU without float render targets falls back to 8-bit.
const viewportTarget = (id: Cinema2RenderTargetId) => Object.freeze({
  id,
  descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba16f' as const, fallbackColorFormat: 'rgba8' as const }),
  ownership: 'transient' as const,
})

export const CINEMA2_BWC_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, id: CINEMA2_BWC_PRESET_ID, revision: 4,
  metadata: Object.freeze({
    name: 'BWC',
    description: 'A dim industrial canning hall: cans ride a belt through a green-energy reactor and come out as creatures, while the reactor, its pipes, the wall LED panels and the ceiling lights play six lighting programs with the music.',
    tags: Object.freeze(['keeper', 'procedural', 'industrial', 'factory', 'portal', 'led']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Procedurally draws the BWC factory scene, its production line and its lighting.' }),
    Object.freeze({ id: 'audio.transport' as const, requirement: 'optional' as const, purpose: 'Play, pause, seek and track changes drive and reset the production line and the lighting programs.' }),
    Object.freeze({ id: 'audio.bands' as const, requirement: 'optional' as const, purpose: 'Bass and high energy lift the pipes and the ceiling lights.' }),
    Object.freeze({ id: 'audio.features' as const, requirement: 'optional' as const, purpose: 'Overall energy sets how bright the hall rests between hits.' }),
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'The analyzed tempo sets the line speed when BPM Sync is on and times every lighting program.' }),
    Object.freeze({ id: 'music.rhythm-events' as const, requirement: 'optional' as const, purpose: 'Kick and snare hits fire the reactor and its ring.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Downbeats flash the wall panels.' }),
    Object.freeze({ id: 'music.bar' as const, requirement: 'optional' as const, purpose: 'Bar boundaries can advance the lighting program.' }),
    Object.freeze({ id: 'music.phrase' as const, requirement: 'optional' as const, purpose: 'Phrase boundaries can advance the lighting program.' }),
    Object.freeze({ id: 'music.build' as const, requirement: 'optional' as const, purpose: 'A detected buildup charges the Surge program.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'A drop lights the whole hall.' }),
  ]),
  parameters: Object.freeze([
    CINEMA2_QUALITY_MODE_PARAMETER,
    float(P.intensity, 'Master Intensity', 'Sets the overall brightness of the hall and everything lit in it.', 1.1, 0, 2, 0.01, 'master-controls', 'Presentation', 1),
    toggle(P.bpmSync, 'BPM Sync', 'Locks the production line and the lighting programs to the music: with it on the line advances one slot every two beats at the analyzed (or Audio Dock) tempo, and the lighting follows the track\'s beat grid. The line also needs the Audio Dock Sync on. With it off both free-run at the 120 BPM rate.', true, 'master-controls', 'Timing', 2),
    float(P.conveyorSpeed, 'Conveyor Speed', 'Scales how fast the production line moves, with or without BPM Sync. 1 is one slot every two beats at the reference tempo; 0 stops the line.', 1, 0, 2, 0.01, 'master-controls', 'Timing', 3),
    float(P.lightReactivity, 'Light Reactivity', 'How far the lighting programs depart from the hall\'s authored look. At 1 the reactor, pipes, wall panels and ceiling lights follow the music fully; at 0 they hold their authored brightness.', 1, 0, 1, 0.01, 'master-controls', 'Timing', 4),
    Object.freeze({
      ...base, id: P.pattern, label: 'Pattern',
      description: 'Chooses the lighting program. Flow runs a wave of light through the hall the way the line travels; Core Burst fires the reactor on every beat and sends the light out through the pipes, walls and ceiling; Alternate swaps the two walls, the ceiling tubes and the pipes on the beat; Center Out launches rings of light from the reactor; Ceiling Sweep runs the ceiling tubes end to end; Surge fills the hall outward as a buildup charges and releases on a drop.',
      type: 'enum' as const, defaultValue: CINEMA2_BWC_DEFAULT_PATTERN, options: PATTERN_OPTIONS, designParentGroup: 'design' as const, group: 'Lighting', order: 1,
    }),
    Object.freeze({
      ...base, id: P.patternChange, label: 'Pattern Change',
      description: 'When enabled, each qualified Trigger moves to another of the six lighting programs, never repeating the one just shown.',
      type: 'boolean' as const, defaultValue: false, designParentGroup: 'design' as const, group: 'Lighting', order: 2,
    }),
    Object.freeze({
      ...base, id: P.trigger, label: 'Trigger',
      description: 'Chooses the musical event that advances the lighting program while Pattern Change is enabled.',
      type: 'enum' as const, defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,
      visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: P.patternChange, value: true })]),
      designParentGroup: 'design' as const, group: 'Lighting', order: 3,
    }),
    float(P.portalScale, 'Portal Scale', 'Sets the size of the circular reactor.', 1, 0.7, 1.35, 0.01, 'design', 'Reactor', 1),
    float(P.ledStrength, 'LED Strength', 'Sets the authored brightness of the reactor, the pipes and the hood LEDs.', 0.85, 0, 1.5, 0.01, 'design', 'Reactor', 2),
    float(P.canScale, 'Can Scale', 'Sets the size of the white cans on the conveyor.', 1, 0.7, 1.35, 0.01, 'design', 'Assembly Line', 1),
    float(P.conveyorWidth, 'Conveyor Width', 'Sets the width of the production conveyor and guide rails.', 1, 0.75, 1.35, 0.01, 'design', 'Assembly Line', 2),
    float(P.pulseWidth, 'Pulse Width', 'Sets the width of the light waves travelling the hall in Flow, Center Out and Ceiling Sweep, and the soft edge of Surge\'s fill.', 0.5, 0, 1, 0.01, 'effects', 'Light Response', 1),
    float(P.dropIntensity, 'Drop Intensity', 'Scales how hard a drop lights the reactor, pipes, wall panels and ceiling lights.', 1, 0, 1, 0.01, 'effects', 'Light Response', 2),
    float(P.flicker, 'Flicker', 'How often the wall panels and ceiling tubes cut out and stutter, each on its own. At 0 they stay steady.', 0.15, 0, 1, 0.01, 'effects', 'Light Response', 3),
    float(P.bloom, 'Bloom', 'The glow around the lit reactor, pipes, wall panels and ceiling lights. At 0 there is no glow.', 0.8, 0, 3, 0.01, 'effects', 'Post', 4),
    float(P.finish, 'Cinematic Finish', 'Contrast, saturation, vignette, grain and lens fringing over the whole picture. At 0 the picture is left as drawn.', 1, 0, 1, 0.01, 'effects', 'Post', 5),
    palette(P.reactorColor, 'Reactor', 'The colour of the reactor chamber, its ring and the hood LEDs.', REACTOR, 1),
    palette(P.pipeColor, 'Pipes', 'The colour of the five energy pipes.', PIPES, 2),
    palette(P.wallColor, 'Wall LEDs', 'The colour of the LED panels on both side walls.', WALL_LEDS, 3),
    palette(P.ceilingColor, 'Ceiling Lights', 'The colour of the fluorescent tubes across the ceiling.', CEILING_LIGHTS, 4),
    palette(P.structure, 'Machine Structure', 'The colour of the hall\'s steel structure, reactor armour and cans\' surroundings.', STRUCTURE, 5),
  ]),
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_BWC_MODULE_ID, typeId: CINEMA2_BWC_NATIVE_MODULE_TYPE_ID, version: 1, enabled: true,
    parameters: Object.freeze({
      intensity: 1.1, bpmSync: true, conveyorSpeed: 1, lightReactivity: 1, pattern: CINEMA2_BWC_DEFAULT_PATTERN, patternChange: false, trigger: 'bar4',
      portalScale: 1, ledStrength: 0.85, canScale: 1, conveyorWidth: 1, pulseWidth: 0.5, dropIntensity: 1, flicker: 0.15,
      reactorColor: REACTOR, pipeColor: PIPES, wallColor: WALL_LEDS, ceilingColor: CEILING_LIGHTS, structureColor: STRUCTURE,
    }),
    parameterBindings: Object.freeze({
      intensity: cinema2Ref(P.intensity), bpmSync: cinema2Ref(P.bpmSync), conveyorSpeed: cinema2Ref(P.conveyorSpeed), lightReactivity: cinema2Ref(P.lightReactivity),
      pattern: cinema2Ref(P.pattern), patternChange: cinema2Ref(P.patternChange), trigger: cinema2Ref(P.trigger),
      portalScale: cinema2Ref(P.portalScale), ledStrength: cinema2Ref(P.ledStrength), canScale: cinema2Ref(P.canScale), conveyorWidth: cinema2Ref(P.conveyorWidth),
      pulseWidth: cinema2Ref(P.pulseWidth), dropIntensity: cinema2Ref(P.dropIntensity), flicker: cinema2Ref(P.flicker),
      reactorColor: cinema2Ref(P.reactorColor), pipeColor: cinema2Ref(P.pipeColor), wallColor: cinema2Ref(P.wallColor), ceilingColor: cinema2Ref(P.ceilingColor), structureColor: cinema2Ref(P.structure),
    }),
  })]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: ROOT, kind: 'group' as const, coordinateSpace: 'normalized-screen' as const, visible: true }),
      Object.freeze({ id: NODE, kind: 'module' as const, parent: cinema2Ref(ROOT), module: cinema2Ref(CINEMA2_BWC_MODULE_ID), visible: true }),
    ]),
    roots: Object.freeze([cinema2Ref(ROOT)]),
  }),
  layers: Object.freeze([Object.freeze({ id: LAYER, label: 'BWC Factory', source: cinema2Ref(ROOT), visible: true, opacity: 1, blendMode: 'normal' as const, depthPolicy: 'disabled' as const, order: 0 })]),
  effects: Object.freeze([
    // The picture arrives already tone-mapped; the lit elements add light above white on top of it, so a threshold of 1 blooms only them.
    Object.freeze({
      id: BLOOM, typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID, version: 1, enabled: true, order: 0, scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, threshold: 1, knee: 0.45, intensity: 0.8, spread: 0.6, levels: 6, clampMax: 16 }),
      parameterBindings: Object.freeze({ intensity: cinema2Ref(P.bloom) }),
    }),
    // No tone curve here (the scene's own is kept); the finish adds contrast, saturation, vignette, grain and fringing.
    Object.freeze({
      id: FINISH, typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID, version: 1, enabled: true, order: 1, scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, toneMap: 0, exposure: 1, temperature: 0, vignette: 0.14, grain: 0.025, aberration: 0.02, contrast: 1.08, saturation: 1.04 }),
      parameterBindings: Object.freeze({ mix: cinema2Ref(P.finish) }),
    }),
  ]),
  render: Object.freeze({
    targets: Object.freeze([viewportTarget(SCENE_TARGET), viewportTarget(BLOOM_TARGET)]),
    passes: Object.freeze([
      Object.freeze({
        id: SCENE_PASS, kind: 'scene' as const, layers: Object.freeze([cinema2Ref(LAYER)]),
        outputs: Object.freeze([Object.freeze({ id: SCENE_COLOR, target: cinema2Ref(SCENE_TARGET), attachment: 'color' as const })]),
      }),
      Object.freeze({
        id: BLOOM_PASS, kind: 'fullscreen' as const, dependsOn: Object.freeze([cinema2Ref(SCENE_PASS)]), effect: cinema2Ref(BLOOM),
        inputs: Object.freeze([Object.freeze({ id: slot('bloom-color-input'), source: Object.freeze({ pass: cinema2Ref(SCENE_PASS), output: SCENE_COLOR }), attachment: 'color' as const })]),
        outputs: Object.freeze([Object.freeze({ id: BLOOM_OUTPUT, target: cinema2Ref(BLOOM_TARGET), attachment: 'color' as const })]),
      }),
      Object.freeze({
        id: FINISH_PASS, kind: 'fullscreen' as const, dependsOn: Object.freeze([cinema2Ref(BLOOM_PASS)]), effect: cinema2Ref(FINISH),
        inputs: Object.freeze([Object.freeze({ id: slot('finish-color-input'), source: Object.freeze({ pass: cinema2Ref(BLOOM_PASS), output: BLOOM_OUTPUT }), attachment: 'color' as const })]),
      }),
    ]),
    outputPass: cinema2Ref(FINISH_PASS),
  }),
  output: Object.freeze({ renderPass: cinema2Ref(FINISH_PASS), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
})
