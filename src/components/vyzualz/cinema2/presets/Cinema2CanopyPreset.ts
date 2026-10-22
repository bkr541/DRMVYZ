import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2CapabilityId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleId,
  type Cinema2ChoreographySignal,
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
  type Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_CANOPY_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2CanopyNativeModule'
import { CANOPY_DEFAULT_PATTERN, CANOPY_DEFAULT_STRUCTURE, CANOPY_PATTERN_IDS, CANOPY_PATTERN_LABELS, CANOPY_STRUCTURE_LIMITS } from '../modules/canopy/Cinema2CanopyDomain'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { cinema2CinematicMotion } from './Cinema2CameraMotionAuthoring'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'

/**
 * CANOPY: a black concert-installation space with a field of suspended LED rods. Each rod hangs from a thin stem under a cap on an overhead
 * mounting grid and carries its own light. Six formations (Waterfall, Crosswave, Crown, Split Wings, Checker Lift, Downpour) move the rods
 * themselves, not only their light, and the music reaches the array as physical lift, depth and release as well as brightness.
 * The hero is world-space, drawn by one native module as two instanced batches; the engine owns camera, background, bloom and finish.
 */
export const CINEMA2_CANOPY_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.canopy')
export const CINEMA2_CANOPY_MODULE_ID = cinema2StableId<Cinema2ModuleId>('canopy-array')
export const CINEMA2_CANOPY_CAMERA_ID = cinema2StableId<Cinema2CameraId>('canopy-camera')
const pid = (name: string) => cinema2StableId<Cinema2ParameterId>(`canopy-${name}`)
export const CINEMA2_CANOPY_PARAMETER_IDS = Object.freeze({
  masterIntensity: pid('master-intensity'), bpmSync: pid('bpm-sync'), autoPerformance: pid('auto-performance'),
  pattern: pid('pattern'), patternChange: pid('pattern-change'), trigger: pid('trigger'),
  rows: pid('rows'), columns: pid('columns'), rowSpacing: pid('row-spacing'), columnSpacing: pid('column-spacing'), rodLength: pid('rod-length'), lengthVariation: pid('length-variation'),
  motionAmount: pid('motion-amount'), motionSpeed: pid('motion-speed'), heightRange: pid('height-range'), symmetry: pid('symmetry'),
  idleGlow: pid('idle-glow'), accentStrength: pid('accent-strength'), bloom: pid('bloom'), cameraMotion: pid('camera-motion'),
  background: pid('background'), primaryRods: pid('primary-rods'), secondaryRods: pid('secondary-rods'), accentHits: pid('accent-hits'), structure: pid('mounting-structure'),
})
const P = CINEMA2_CANOPY_PARAMETER_IDS
/** Internal event-only parameter, never an Inspector control: the shared choreography runtime delivers musical cues through it. */
export const CINEMA2_CANOPY_MUSICAL_CUE_ID = pid('musical-cue')

/**
 * The cues the array reacts to, selected (and deduplicated, with phrase, drop and section fallbacks) by the shared choreography runtime.
 * Each rule has the same shape: source = that musical event; target = the hidden Musical Cue parameter; operation = spawn a cue event; no
 * strength, attack or decay (the reactivity envelopes shape the response); no user-owned value is touched. The action id must be
 * `mainframe-<kind>-cue`: the shared music adapter recognises a delivery by that suffix.
 */
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
const cueName = (kind: string) => (kind === 'fourBeat' ? 'four-beat' : kind)

const ROOT = cinema2StableId<Cinema2SceneNodeId>('canopy-root'), NODE = cinema2StableId<Cinema2SceneNodeId>('canopy-node'), LAYER = cinema2StableId<Cinema2LayerId>('canopy-layer')
const SCENE_TARGET = cinema2StableId<Cinema2RenderTargetId>('canopy-scene-target'), BLOOM_TARGET = cinema2StableId<Cinema2RenderTargetId>('canopy-bloom-target')
const SCENE_PASS = cinema2StableId<Cinema2RenderPassId>('canopy-scene-pass'), BLOOM_PASS = cinema2StableId<Cinema2RenderPassId>('canopy-bloom-pass'), FINISH_PASS = cinema2StableId<Cinema2RenderPassId>('canopy-finish-pass')
const slot = (name: string) => cinema2StableId<Cinema2RenderSlotId>(`canopy-${name}`)
const SCENE_COLOR = slot('scene-color'), SCENE_DEPTH = slot('scene-depth'), BLOOM_OUTPUT = slot('bloom-output')
const BLOOM = cinema2StableId<Cinema2EffectId>('canopy-bloom'), FINISH = cinema2StableId<Cinema2EffectId>('canopy-finish')

const vec3 = (x: number, y: number, z: number): Cinema2Vector3 => Object.freeze([x, y, z])
const color = (r: number, g: number, b: number): Cinema2Color => Object.freeze([r, g, b, 1])
const BACKGROUND = color(0.012, 0.016, 0.025), PRIMARY = color(0.3, 0.91, 1), SECONDARY = color(0.55, 0.4, 1), ACCENT = color(1, 0.55, 0.12), STRUCTURE = color(0.11, 0.17, 0.21)

const base = Object.freeze({ section: 'Design', exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const, modulatable: false, choreographable: false, automatable: false })
type Parent = 'master-controls' | 'design' | 'effects'
const float = (id: Cinema2ParameterId, label: string, description: string, defaultValue: number, min: number, max: number, step: number, parent: Parent, group: string, order: number) => Object.freeze({ ...base, id, label, description, type: 'float' as const, defaultValue, min, max, step, designParentGroup: parent, group, order })
const integer = (id: Cinema2ParameterId, label: string, description: string, defaultValue: number, min: number, max: number, parent: Parent, group: string, order: number) => Object.freeze({ ...base, id, label, description, type: 'integer' as const, defaultValue, min, max, step: 1, designParentGroup: parent, group, order })
const toggle = (id: Cinema2ParameterId, label: string, description: string, defaultValue: boolean, parent: Parent, group: string, order: number) => Object.freeze({ ...base, id, label, description, type: 'boolean' as const, defaultValue, designParentGroup: parent, group, order })
const palette = (id: Cinema2ParameterId, label: string, description: string, value: Cinema2Color, order: number) => Object.freeze({ ...base, id, label, description, type: 'color' as const, defaultValue: value, designParentGroup: 'palette' as const, group: 'Roles', order })

const PATTERN_OPTIONS = Object.freeze(CANOPY_PATTERN_IDS.map(value => Object.freeze({ value, label: CANOPY_PATTERN_LABELS[value] })))
const L = CANOPY_STRUCTURE_LIMITS

// Float targets carry the lit rods' light above white into the bloom; a GPU without float render targets falls back to 8-bit.
const viewportTarget = (id: Cinema2RenderTargetId, depth = false) => Object.freeze({
  id,
  descriptor: Object.freeze({
    size: Object.freeze({ kind: 'viewport' as const }),
    colorFormat: 'rgba16f' as const,
    fallbackColorFormat: 'rgba8' as const,
    ...(depth ? { depthFormat: 'depth24' as const } : {}),
  }),
  ownership: 'transient' as const,
})

export const CINEMA2_CANOPY_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, id: CINEMA2_CANOPY_PRESET_ID, revision: 1,
  metadata: Object.freeze({
    name: 'CANOPY',
    description: 'A suspended field of luminous LED rods under an overhead grid. Six formations move the rods themselves, and the music lifts, lowers and lights them.',
    tags: Object.freeze(['keeper', '3d', 'installation', 'led', 'rods']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Instanced rendering of the suspended rod array.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Correct occlusion between front and rear rods.' }),
    Object.freeze({ id: 'render.hdr' as const, requirement: 'optional' as const, purpose: 'Keeps lit rods above white for the bloom, with an 8-bit fallback.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'World-space rod array and mounting grid.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Perspective view up into the canopy.' }),
    Object.freeze({ id: 'audio.transport' as const, requirement: 'optional' as const, purpose: 'Play, pause, seek and track changes drive and reset the formations.' }),
    Object.freeze({ id: 'audio.bands' as const, requirement: 'optional' as const, purpose: 'Sub and bass lower the crown and run a depth wave through the rows; mids tension alternate columns; highs shimmer the light.' }),
    Object.freeze({ id: 'audio.features' as const, requirement: 'optional' as const, purpose: 'Overall energy scales the movement; vocal presence calms the secondary bank; buildup compresses the height range.' }),
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'The analyzed tempo times every formation when BPM Sync is on.' }),
    Object.freeze({ id: 'music.rhythm-events' as const, requirement: 'optional' as const, purpose: 'Kicks lift alternate rows; snares lift the checker\'s other half.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Downbeats lift the front row and the outer ring.' }),
    Object.freeze({ id: 'music.bar' as const, requirement: 'optional' as const, purpose: 'Bar boundaries can advance the formation.' }),
    Object.freeze({ id: 'music.phrase' as const, requirement: 'optional' as const, purpose: 'Phrase boundaries lean the formation sideways and can advance it.' }),
    Object.freeze({ id: 'music.build' as const, requirement: 'optional' as const, purpose: 'A buildup compresses the height range.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'A drop releases the whole array downward and lifts its light.' }),
    Object.freeze({ id: 'music.section' as const, requirement: 'optional' as const, purpose: 'A section change settles the movement briefly.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'Scales hits by a little either way; Auto Performance lets a drop reach its full bound.' }),
  ]),
  parameters: Object.freeze([
    CINEMA2_QUALITY_MODE_PARAMETER,
    float(P.masterIntensity, 'Master Intensity', 'Sets how brightly every rod and the soft light on its cap burns. At 0 nothing emits light; the dark rods, caps and grid remain.', 0.78, 0, 1, 0.01, 'master-controls', 'Output', 1),
    toggle(P.bpmSync, 'BPM Sync', 'Times every formation to the music: with it on the rods move to the analyzed beat grid (or the tempo, or the Audio Dock tempo); with it off they free-run at the 120 BPM rate. Hits from the music still move and light the rods either way.', true, 'master-controls', 'Timing', 2),
    toggle(P.autoPerformance, 'Auto Performance', 'Lets the music press a little harder at its biggest moments: a buildup compresses the height range further and a drop releases the array more fully, with a brief lift in the bloom. It never changes your Pattern, Pattern Change, Trigger, colors, structure, or any control you have set to zero.', false, 'master-controls', 'Performance', 3),
    Object.freeze({
      ...base, id: P.pattern, label: 'Pattern',
      description: 'Chooses the formation. Waterfall runs a descending wave through the rows, front to back; Crosswave crosses two diagonal waves; Crown hangs the centre low and lifts the rim into a bowl; Split Wings lifts one half while the other drops, swapping each bar; Checker Lift raises alternate rods in two tiers; Downpour holds the whole array high, then lets it fall as one curtain.',
      type: 'enum' as const, defaultValue: CANOPY_DEFAULT_PATTERN, options: PATTERN_OPTIONS, designParentGroup: 'design' as const, group: 'Pattern', order: 1,
    }),
    Object.freeze({
      ...base, id: P.patternChange, label: 'Pattern Change',
      description: 'When enabled, each qualified Trigger moves on to another of the six formations, never repeating the one just shown. Choosing a Pattern yourself shows it at once and leaves this on.',
      type: 'boolean' as const, defaultValue: false, designParentGroup: 'design' as const, group: 'Pattern', order: 2,
    }),
    Object.freeze({
      ...base, id: P.trigger, label: 'Trigger',
      description: 'Chooses the musical event that advances the formation while Pattern Change is enabled.',
      type: 'enum' as const, defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,
      visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: P.patternChange, value: true })]),
      designParentGroup: 'design' as const, group: 'Pattern', order: 3,
    }),
    integer(P.rows, 'Rows', 'How many rows of rods hang front to back. More rows deepen the canopy.', CANOPY_DEFAULT_STRUCTURE.rows, L.rows.min, L.rows.max, 'design', 'Structure', 4),
    integer(P.columns, 'Columns', 'How many rods hang across each row. More columns widen the canopy.', CANOPY_DEFAULT_STRUCTURE.columns, L.columns.min, L.columns.max, 'design', 'Structure', 5),
    float(P.rowSpacing, 'Row Spacing', 'The distance between rows, front to back.', CANOPY_DEFAULT_STRUCTURE.rowSpacing, L.rowSpacing.min, L.rowSpacing.max, 0.01, 'design', 'Structure', 6),
    float(P.columnSpacing, 'Column Spacing', 'The distance between rods across a row.', CANOPY_DEFAULT_STRUCTURE.columnSpacing, L.columnSpacing.min, L.columnSpacing.max, 0.01, 'design', 'Structure', 7),
    float(P.rodLength, 'Rod Length', 'The physical length of each luminous rod.', CANOPY_DEFAULT_STRUCTURE.rodLength, L.rodLength.min, L.rodLength.max, 0.01, 'design', 'Structure', 8),
    float(P.lengthVariation, 'Length Variation', 'How much each rod\'s length differs from its neighbours, the same way every time.', CANOPY_DEFAULT_STRUCTURE.lengthVariation, L.lengthVariation.min, L.lengthVariation.max, 0.01, 'design', 'Structure', 9),
    float(P.motionAmount, 'Motion Amount', 'How far the formation moves. At 0 the rods stand in the formation\'s resting shape and nothing moves, whatever the music does.', 0.55, 0, 1, 0.01, 'design', 'Motion', 10),
    float(P.motionSpeed, 'Motion Speed', 'How quickly the formation cycles, as a multiple of the tempo.', 1, 0.3, 2, 0.01, 'design', 'Motion', 11),
    float(P.heightRange, 'Height Range', 'The furthest a rod can travel up or down from its resting height, in world units. This is travel, not brightness.', 0.6, 0, 0.8, 0.01, 'design', 'Motion', 12),
    toggle(P.symmetry, 'Symmetry', 'On mirrors each formation about the centre line of the canopy. Off lets the formation lean: waves tilt, the crown sits off-centre, the wings fall out of step.', true, 'design', 'Motion', 13),
    float(P.idleGlow, 'Idle Glow', 'The light every rod keeps with no music and between hits.', 0.28, 0, 0.6, 0.01, 'effects', 'Light', 1),
    float(P.accentStrength, 'Accent Strength', 'How hard kicks, snares, downbeats and drops lift and light the rods they land on. It is also the ceiling on those hits.', 0.55, 0, 1, 0.01, 'effects', 'Light', 2),
    float(P.bloom, 'Bloom Amount', 'The glow around lit rods. At 0 there is no glow.', 0.2, 0, 0.6, 0.01, 'effects', 'Light', 3),
    float(P.cameraMotion, 'Camera Motion', 'A slow drift of the camera around the canopy. At 0 the camera is locked off and never moves, whatever else is on.', 0, 0, 1, 0.01, 'effects', 'Camera', 4),
    palette(P.background, 'Background', 'The space behind and around the canopy.', BACKGROUND, 1),
    palette(P.primaryRods, 'Primary Rods', 'The colour of every other column of rods.', PRIMARY, 2),
    palette(P.secondaryRods, 'Secondary Rods', 'The colour of the columns between them.', SECONDARY, 3),
    palette(P.accentHits, 'Accent Hits', 'The colour rods flash when a kick, snare, downbeat or drop lands on them.', ACCENT, 4),
    palette(P.structure, 'Mounting Structure', 'The colour of the overhead grid, the stems, the caps and the dark body of each rod.', STRUCTURE, 5),
    Object.freeze({
      id: CINEMA2_CANOPY_MUSICAL_CUE_ID, label: 'Musical Cue', type: 'trigger' as const,
      section: 'React', group: 'Runtime', order: 999,
      exposure: 'hidden' as const, persistence: 'runtime-only' as const, reset: 'none' as const,
      modulatable: false, choreographable: false, automatable: false,
    }),
  ]),
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_CANOPY_MODULE_ID, typeId: CINEMA2_CANOPY_NATIVE_MODULE_TYPE_ID, version: 1, enabled: true,
    parameters: Object.freeze({
      masterIntensity: 0.78, bpmSync: true, autoPerformance: false, pattern: CANOPY_DEFAULT_PATTERN, patternChange: false, trigger: 'bar4',
      rows: CANOPY_DEFAULT_STRUCTURE.rows, columns: CANOPY_DEFAULT_STRUCTURE.columns, rowSpacing: CANOPY_DEFAULT_STRUCTURE.rowSpacing, columnSpacing: CANOPY_DEFAULT_STRUCTURE.columnSpacing,
      rodLength: CANOPY_DEFAULT_STRUCTURE.rodLength, lengthVariation: CANOPY_DEFAULT_STRUCTURE.lengthVariation,
      motionAmount: 0.55, motionSpeed: 1, heightRange: 0.6, symmetry: true, idleGlow: 0.28, accentStrength: 0.55,
      primaryColor: PRIMARY, secondaryColor: SECONDARY, accentColor: ACCENT, structureColor: STRUCTURE,
    }),
    parameterBindings: Object.freeze({
      masterIntensity: cinema2Ref(P.masterIntensity), bpmSync: cinema2Ref(P.bpmSync), autoPerformance: cinema2Ref(P.autoPerformance),
      pattern: cinema2Ref(P.pattern), patternChange: cinema2Ref(P.patternChange), trigger: cinema2Ref(P.trigger),
      rows: cinema2Ref(P.rows), columns: cinema2Ref(P.columns), rowSpacing: cinema2Ref(P.rowSpacing), columnSpacing: cinema2Ref(P.columnSpacing),
      rodLength: cinema2Ref(P.rodLength), lengthVariation: cinema2Ref(P.lengthVariation),
      motionAmount: cinema2Ref(P.motionAmount), motionSpeed: cinema2Ref(P.motionSpeed), heightRange: cinema2Ref(P.heightRange), symmetry: cinema2Ref(P.symmetry),
      idleGlow: cinema2Ref(P.idleGlow), accentStrength: cinema2Ref(P.accentStrength),
      primaryColor: cinema2Ref(P.primaryRods), secondaryColor: cinema2Ref(P.secondaryRods), accentColor: cinema2Ref(P.accentHits), structureColor: cinema2Ref(P.structure),
    }),
    actionBindings: Object.freeze({ musicalCue: cinema2Ref(CINEMA2_CANOPY_MUSICAL_CUE_ID) }),
  })]),
  choreography: Object.freeze({
    rules: Object.freeze([
      ...MUSIC_CUES.map(([kind, signal, capability], index) => Object.freeze({
        id: cinema2StableId<Cinema2ChoreographyRuleId>(`canopy-${cueName(kind)}-event`),
        priority: 30 + index,
        source: Object.freeze({ signal, capability }),
        actions: Object.freeze([Object.freeze({
          id: cinema2StableId<Cinema2ChoreographyActionId>(`mainframe-${cueName(kind)}-cue`),
          target: Object.freeze({ kind: 'parameter' as const, ref: cinema2Ref(CINEMA2_CANOPY_MUSICAL_CUE_ID) }),
          operation: 'spawn' as const,
          value: Object.freeze({ kind }),
        })]),
      })),
      // With Auto Performance a drop swells the bloom by up to 60%; multiplied, so a Bloom Amount of 0 stays off.
      Object.freeze({
        id: cinema2StableId<Cinema2ChoreographyRuleId>('canopy-drop-bloom'),
        priority: 60,
        enabledParameter: cinema2Ref(P.autoPerformance),
        source: Object.freeze({ signal: 'drop' as const, capability: 'music.drop' as const }),
        conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([Object.freeze({
          id: cinema2StableId<Cinema2ChoreographyActionId>('canopy-drop-bloom-action'),
          target: Object.freeze({ kind: 'effect' as const, ref: cinema2Ref(BLOOM), property: 'intensity' }),
          operation: 'envelope' as const,
          value: 1.6,
          composition: 'multiply' as const,
          envelope: Object.freeze({ attack: 0.05, hold: 0.1, release: 0.9, unit: 'seconds' as const }),
          retrigger: 'restart' as const,
        })]),
      }),
    ]),
  }),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: ROOT, kind: 'group' as const, coordinateSpace: 'world' as const }),
      Object.freeze({ id: NODE, kind: 'module' as const, parent: cinema2Ref(ROOT), module: cinema2Ref(CINEMA2_CANOPY_MODULE_ID) }),
    ]),
    roots: Object.freeze([cinema2Ref(ROOT)]),
  }),
  layers: Object.freeze([Object.freeze({ id: LAYER, label: 'CANOPY Array', source: cinema2Ref(ROOT), role: 'world', depthPolicy: 'read-write' as const, order: 0 })]),
  cameras: Object.freeze([Object.freeze({
    id: CINEMA2_CANOPY_CAMERA_ID,
    label: 'CANOPY Underside',
    projection: 'perspective' as const,
    fovDegrees: 46,
    // Composed at 16:9; on a narrower Stage the vertical view widens instead of the sides of the canopy being cropped.
    minAspect: 16 / 9,
    near: 0.1,
    far: 100,
    transform: Object.freeze({ position: vec3(3.1, 1.4, 9) }),
    target: vec3(0, 3.8, 0),
    rig: Object.freeze({ kind: 'static' as const }),
    // Camera Motion scales a slow drift and bank (0 = locked off). It is the only camera movement CANOPY has.
    motion: cinema2CinematicMotion('gentle', {
      overrides: Object.freeze({ drift: Object.freeze({ position: 0.5, target: 0.15, rollDegrees: 0.3, fovDegrees: 0.8, speed: 0.06 }) }),
    }),
    controls: Object.freeze({ motionAmount: cinema2Ref(P.cameraMotion) }),
    safety: Object.freeze({
      maxPositionOffset: vec3(0.8, 0.4, 0.8),
      maxTargetOffset: vec3(0.3, 0.2, 0.3),
      minFovDegrees: 42,
      maxFovDegrees: 52,
    }),
  })]),
  environment: Object.freeze({
    backgroundColor: BACKGROUND,
    exposure: 1,
    controls: Object.freeze({ backgroundColor: cinema2Ref(P.background) }),
  }),
  effects: Object.freeze([
    Object.freeze({
      id: BLOOM, typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID, version: 1, enabled: true, order: 0, scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, threshold: 0.55, knee: 0.4, intensity: 0.2, spread: 0.45, levels: 5, clampMax: 12 }),
      parameterBindings: Object.freeze({ intensity: cinema2Ref(P.bloom) }),
    }),
    // A light finish: tone curve for the HDR rods, a touch of contrast and vignette. It has no control of its own.
    Object.freeze({
      id: FINISH, typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID, version: 1, enabled: true, order: 1, scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, toneMap: 1, exposure: 1, contrast: 1.1, saturation: 1, vignette: 0.45, vignetteSoftness: 0.7, grain: 0.02, aberration: 0.006 }),
    }),
  ]),
  render: Object.freeze({
    targets: Object.freeze([viewportTarget(SCENE_TARGET, true), viewportTarget(BLOOM_TARGET)]),
    passes: Object.freeze([
      Object.freeze({
        id: SCENE_PASS, kind: 'scene' as const, layers: Object.freeze([cinema2Ref(LAYER)]),
        outputs: Object.freeze([
          Object.freeze({ id: SCENE_COLOR, target: cinema2Ref(SCENE_TARGET), attachment: 'color' as const }),
          Object.freeze({ id: SCENE_DEPTH, target: cinema2Ref(SCENE_TARGET), attachment: 'depth' as const }),
        ]),
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
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_CANOPY_CAMERA_ID) }),
  output: Object.freeze({ renderPass: cinema2Ref(FINISH_PASS), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
})
