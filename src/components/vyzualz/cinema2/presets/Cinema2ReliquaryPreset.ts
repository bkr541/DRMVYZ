import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyGateManifest,
  type Cinema2ChoreographyRuleId,
  type Cinema2ChoreographyRuleManifest,
  type Cinema2Color,
  type Cinema2EffectId,
  type Cinema2EffectTypeId,
  type Cinema2LayerId,
  type Cinema2LightGroupId,
  type Cinema2LightId,
  type Cinema2ModuleId,
  type Cinema2ModuleTypeId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2RenderPassId,
  type Cinema2RenderSlotId,
  type Cinema2RenderTargetId,
  type Cinema2SceneNodeId,
  type Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_DVYDRM_LOGO_FACETED_ASSET_ID, CINEMA2_GOLDEN_ROOTS_ASSET_ID, CINEMA2_RELIQUARY_TREES_ASSET_ID } from '../modules/three/Cinema2ThreeAssetManifest'
import { CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID } from '../modules/three/Cinema2ThreeEnvironmentRegistry'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { cinema2LightRigHit, cinema2LightRigRamp } from './Cinema2LightRigAuthoring'

/**
 * RELIQUARY: the DVYDRM logo as clear, faceted crystal held by a golden tree, framed by a forest of dark trees wrapped in the same golden
 * vines - a pristine, cinematic stage for a DJ set. Two lighting systems run side by side on the same audio intelligence and the same BPM Sync:
 *
 * 1. Overhead rig: six narrow spots hang high above the stage, each aimed at a different part of the logo (the top lobe, the two lower
 *    lobes, the two swirls, the star). On every bar they fire a syncopated 16th-note pattern (two interlocking patterns alternating bar by
 *    bar), so the light jumps around the logo off the beat the way a club lighting desk chases, and each hit lights just that part of the
 *    crystal; the downbeat swells them all, and a build lifts the whole rig. Two wide strobe heads fire a full 16th-note white strobe for two
 *    bars on a drop and a one-beat burst on every downbeat at the top of a build (a strobe roll into the drop). Thin haze turns every hit
 *    into a visible beam.
 * 2. Glow: the golden tree under the logo and the vines round the trees emit light (three-scene audio glow): `Energy` sends a pulse up
 *    every tree from the root tips on each beat, `Breathing` swells and settles the whole glow with the bass, `Energy & Breathing` layers them.
 *
 * Assets: `cinema2-dvydrm-logo-faceted` (cut-crystal logo, rendered as transmissive glass with rainbow dispersion), `cinema2-golden-roots`
 * (the tree that wraps the logo's lower lobes) and `cinema2-reliquary-trees` (the flanking forest), all drawn by one three-scene module on a
 * dark wet floor with low mist, finished with bloom and a filmic grade.
 */
export const CINEMA2_RELIQUARY_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.reliquary')
export const CINEMA2_RELIQUARY_MODULE_ID = cinema2StableId<Cinema2ModuleId>('reliquary-scene')
export const CINEMA2_RELIQUARY_LOGO_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('reliquary-logo-node')
export const CINEMA2_RELIQUARY_ROOTS_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('reliquary-roots-node')
export const CINEMA2_RELIQUARY_TREES_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('reliquary-trees-node')
export const CINEMA2_RELIQUARY_CAMERA_ID = cinema2StableId<Cinema2CameraId>('reliquary-camera')

export const CINEMA2_RELIQUARY_MASTER_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('reliquary-master-intensity')
export const CINEMA2_RELIQUARY_BPM_SYNC_ID = cinema2StableId<Cinema2ParameterId>('reliquary-bpm-sync')
export const CINEMA2_RELIQUARY_GLOW_MODE_ID = cinema2StableId<Cinema2ParameterId>('reliquary-glow-mode')
export const CINEMA2_RELIQUARY_GLOW_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('reliquary-glow-intensity')
export const CINEMA2_RELIQUARY_CRYSTAL_CLARITY_ID = cinema2StableId<Cinema2ParameterId>('reliquary-crystal-clarity')
export const CINEMA2_RELIQUARY_CRYSTAL_SPARKLE_ID = cinema2StableId<Cinema2ParameterId>('reliquary-crystal-sparkle')
export const CINEMA2_RELIQUARY_CRYSTAL_ROUGHNESS_ID = cinema2StableId<Cinema2ParameterId>('reliquary-crystal-roughness')
export const CINEMA2_RELIQUARY_ROOT_ROUGHNESS_ID = cinema2StableId<Cinema2ParameterId>('reliquary-root-roughness')
export const CINEMA2_RELIQUARY_REFLECTION_ID = cinema2StableId<Cinema2ParameterId>('reliquary-environment-reflection')
export const CINEMA2_RELIQUARY_HAZE_ID = cinema2StableId<Cinema2ParameterId>('reliquary-haze-density')
export const CINEMA2_RELIQUARY_BEAM_ID = cinema2StableId<Cinema2ParameterId>('reliquary-beam-intensity')
export const CINEMA2_RELIQUARY_BLOOM_ID = cinema2StableId<Cinema2ParameterId>('reliquary-bloom')
export const CINEMA2_RELIQUARY_FINISH_ID = cinema2StableId<Cinema2ParameterId>('reliquary-cinematic-finish')
export const CINEMA2_RELIQUARY_BACKGROUND_ID = cinema2StableId<Cinema2ParameterId>('reliquary-background')
export const CINEMA2_RELIQUARY_CRYSTAL_TINT_ID = cinema2StableId<Cinema2ParameterId>('reliquary-crystal-tint')
export const CINEMA2_RELIQUARY_ROOT_TINT_ID = cinema2StableId<Cinema2ParameterId>('reliquary-root-tint')
export const CINEMA2_RELIQUARY_LEAF_TINT_ID = cinema2StableId<Cinema2ParameterId>('reliquary-leaf-tint')
export const CINEMA2_RELIQUARY_GLOW_COLOR_ID = cinema2StableId<Cinema2ParameterId>('reliquary-glow-color')
export const CINEMA2_RELIQUARY_CUE_COLOR_ID = cinema2StableId<Cinema2ParameterId>('reliquary-cue-color')
export const CINEMA2_RELIQUARY_STROBE_COLOR_ID = cinema2StableId<Cinema2ParameterId>('reliquary-strobe-color')

const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('reliquary-ambient')
const FILL_LIGHT_ID = cinema2StableId<Cinema2LightId>('reliquary-fill')
const BACK_LIGHT_ID = cinema2StableId<Cinema2LightId>('reliquary-back')
const RIM_LEFT_LIGHT_ID = cinema2StableId<Cinema2LightId>('reliquary-rim-left')
const RIM_RIGHT_LIGHT_ID = cinema2StableId<Cinema2LightId>('reliquary-rim-right')
const BACK_TARGET_ID = cinema2StableId<Cinema2SceneNodeId>('reliquary-back-target')
const RIM_LEFT_TARGET_ID = cinema2StableId<Cinema2SceneNodeId>('reliquary-rim-left-target')
const RIM_RIGHT_TARGET_ID = cinema2StableId<Cinema2SceneNodeId>('reliquary-rim-right-target')
const CUE_GROUP_ID = cinema2StableId<Cinema2LightGroupId>('reliquary-cues')
const STROBE_GROUP_ID = cinema2StableId<Cinema2LightGroupId>('reliquary-strobes')

const ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('reliquary-root')
const WORLD_LAYER_ID = cinema2StableId<Cinema2LayerId>('reliquary-world-layer')
const THREE_SCENE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('three-scene')
const VOLUMETRIC_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('volumetric-atmosphere')
const BLOOM_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('hdr-bloom')
const FLOOR_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('reflective-floor')
const FINISH_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('cinematic-finish')
const FLOOR_EFFECT_ID = cinema2StableId<Cinema2EffectId>('reliquary-ground')
const VOLUMETRIC_EFFECT_ID = cinema2StableId<Cinema2EffectId>('reliquary-haze')
const BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('reliquary-bloom-effect')
const FINISH_EFFECT_ID = cinema2StableId<Cinema2EffectId>('reliquary-finish')

/** The golden roots and the trees stand on this plane (see the generator scripts); the logo floats above the tree's trunk. */
const FLOOR_Y = -1.55
const LOGO_HEIGHT = 0.05

const vec3 = (x: number, y: number, z: number): Cinema2Vector3 => Object.freeze([x, y, z])
const color = (r: number, g: number, b: number, a = 1): Cinema2Color => Object.freeze([r, g, b, a])

const DEFAULT_BACKGROUND = color(0.01, 0.008, 0.007)
/**
 * Warm amber-gold, matched to the owner's mockup through the finish's filmic curve: a hot vine reads warm white, its glow amber-gold and the
 * glow's fading edge a deep orange (the mockup's glow ramp). A deeper, yellower gold turns lemon-yellow once the glow goes brighter than white.
 */
const DEFAULT_GLOW = color(1, 0.54, 0.28)
const DEFAULT_CUE = color(0.94, 0.96, 1)
const DEFAULT_STROBE = color(1, 1, 1)
const CRYSTAL_ROUGHNESS = 0.03
const ROOT_ROUGHNESS = 0.24
/**
 * Cut crystal, tuned against the owner's production mockup: mostly clear (fully clear glass refracts the dark stage and reads black), a bright
 * cool-white body (with the HDR chain it no longer clips flat under the spots, so the cut bands stay readable), a diamond-like index,
 * dispersion so the cuts split bright light into rainbows, and a faint iridescent film for spectral fringes on the cut edges.
 */
const CRYSTAL_BODY = color(0.9, 0.92, 0.95)
const CRYSTAL_IRIDESCENCE = 0.4
const CRYSTAL_CLARITY = 0.9
const CRYSTAL_IOR = 2.2
const CRYSTAL_THICKNESS = 0.14
const CRYSTAL_SPARKLE = 5
/** Overhead cue spots: dim at rest so the crystal never vanishes, hard and bright on a hit. */
const CUE_REST = 0.08
const CUE_PEAK = 9
const STROBE_PEAK = 6
/** The glow renders HDR (float targets), so a lit vine can be several times brighter than white before the filmic curve rolls it off. */
const GLOW_STRENGTH = 2.2
/**
 * Each material's share of the studio environment. Kept low for the crystal so it is not evenly lit all the time: the overhead spots do the
 * lighting, and a part they are not hitting falls into shadow (the owner's mockups). The gold a little so it reads as warm polished metal, and
 * the dark bark almost none (the shared studio environment otherwise lights it grey).
 */
const CRYSTAL_ENVIRONMENT = 1.8
const GOLD_ENVIRONMENT = 0.45
/**
 * The glowing gold (the tree vines and their buds) takes much less: mirroring the white studio environment it reads pale cream, and the glow,
 * not the room, should give it its colour, as in the mockup.
 */
const VINE_ENVIRONMENT = 0.12
const BARK_ENVIRONMENT = 0.15

const baseParameter = {
  section: 'Design',
  exposure: 'primary' as const,
  modulatable: false,
  choreographable: false,
  automatable: false,
  persistence: 'preset' as const,
  reset: 'authored-default' as const,
}

function floatParameter(
  id: Cinema2ParameterId, label: string, description: string, defaultValue: number, min: number, max: number, step: number,
  parent: 'master-controls' | 'design' | 'effects', order: number, group?: string,
) {
  return Object.freeze({ ...baseParameter, id, label, description, type: 'float' as const, defaultValue, min, max, step, designParentGroup: parent, order, ...(group ? { group } : {}) })
}

function colorParameter(id: Cinema2ParameterId, label: string, description: string, defaultValue: Cinema2Color, order: number, group: string) {
  return Object.freeze({ ...baseParameter, id, label, description, type: 'color' as const, defaultValue, designParentGroup: 'palette' as const, order, group })
}

const PARAMETERS = Object.freeze([
  CINEMA2_QUALITY_MODE_PARAMETER,
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_RELIQUARY_MASTER_INTENSITY_ID,
    label: 'Master Intensity',
    description: 'One control for how hard the whole show reacts to the music: the overhead cues, the strobe and the golden glow. At 0 the lights rest and the glow holds a soft steady level; at 1 everything reacts fully.',
    type: 'float' as const,
    defaultValue: 0.8,
    min: 0,
    max: 1,
    step: 0.01,
    designParentGroup: 'master-controls' as const,
    order: 1,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_RELIQUARY_BPM_SYNC_ID,
    label: 'BPM Sync',
    description: 'On: the overhead cues chase the logo on the track\'s beat grid and the glow pulses and breathes locked to it. Off: the overhead cues hold their resting level (the drop strobe still fires) and the glow keeps a steady 120 BPM.',
    type: 'boolean' as const,
    defaultValue: true,
    designParentGroup: 'master-controls' as const,
    order: 2,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_RELIQUARY_GLOW_MODE_ID,
    label: 'Glow Mode',
    description: 'How the golden roots, branches and tree vines glow with the music. Energy: a pulse of light climbs every tree from the root tips on each beat. Breathing: the whole glow swells and settles with the bass. Energy & Breathing: both.',
    type: 'enum' as const,
    defaultValue: 'both',
    options: Object.freeze([
      Object.freeze({ value: 'energy', label: 'Energy' }),
      Object.freeze({ value: 'breathing', label: 'Breathing' }),
      Object.freeze({ value: 'both', label: 'Energy & Breathing' }),
    ]),
    designParentGroup: 'design' as const,
    order: 1,
    group: 'Glow',
  }),
  floatParameter(CINEMA2_RELIQUARY_GLOW_INTENSITY_ID, 'Glow Intensity', 'How brightly the golden roots, branches and tree vines glow.', GLOW_STRENGTH, 0, 6, 0.05, 'design', 2, 'Glow'),
  floatParameter(CINEMA2_RELIQUARY_CRYSTAL_CLARITY_ID, 'Crystal Clarity', 'How see-through the crystal logo is: 1 is fully clear (it then shows the dark stage through it), 0 an opaque polished stone (medium and high quality; low is always opaque).', CRYSTAL_CLARITY, 0, 1, 0.01, 'design', 5, 'Material'),
  floatParameter(CINEMA2_RELIQUARY_CRYSTAL_SPARKLE_ID, 'Crystal Sparkle', 'How strongly the crystal\'s cut edges split the light into rainbows.', CRYSTAL_SPARKLE, 0, 12, 0.1, 'design', 6, 'Material'),
  floatParameter(CINEMA2_RELIQUARY_CRYSTAL_ROUGHNESS_ID, 'Crystal Roughness', 'How sharp the reflections on the crystal are: 0 is a flawless polish, higher frosts it.', CRYSTAL_ROUGHNESS, 0, 1, 0.01, 'design', 7, 'Material'),
  floatParameter(CINEMA2_RELIQUARY_ROOT_ROUGHNESS_ID, 'Root Roughness', 'How sharp the reflections on the golden roots and vines are.', ROOT_ROUGHNESS, 0, 1, 0.01, 'design', 8, 'Material'),
  floatParameter(CINEMA2_RELIQUARY_REFLECTION_ID, 'Environment Reflection', 'How strongly the studio environment reflects in the crystal and the gold.', 1, 0, 2, 0.01, 'design', 9, 'Material'),
  floatParameter(CINEMA2_RELIQUARY_HAZE_ID, 'Haze Density', 'How thick the haze in the air is. It is what turns the overhead lights and the strobe into visible beams and lets the forest show against the back light.', 0.03, 0, 0.2, 0.002, 'effects', 1, 'Atmosphere'),
  floatParameter(CINEMA2_RELIQUARY_BEAM_ID, 'Beam Intensity', 'Brightness of the light scattering through the haze.', 1.4, 0, 6, 0.05, 'effects', 2, 'Atmosphere'),
  floatParameter(CINEMA2_RELIQUARY_BLOOM_ID, 'Bloom', 'Soft light spilling around the glowing roots, the strobe and the crystal\'s highlights.', 0.9, 0, 3, 0.05, 'effects', 3, 'Post'),
  floatParameter(CINEMA2_RELIQUARY_FINISH_ID, 'Cinematic Finish', 'Amount of filmic tone curve, grade, vignette and grain.', 1, 0, 1, 0.05, 'effects', 4, 'Post'),
  colorParameter(CINEMA2_RELIQUARY_BACKGROUND_ID, 'Background', 'The color of the dark behind the forest.', DEFAULT_BACKGROUND, 1, 'Stage Colors'),
  colorParameter(CINEMA2_RELIQUARY_CRYSTAL_TINT_ID, 'Crystal Color', 'The crystal logo\'s body. The default bright cool white reads as clear cut glass under the lights; darker turns it smoky, and any hue colors it.', CRYSTAL_BODY, 2, 'Logo Colors'),
  colorParameter(CINEMA2_RELIQUARY_ROOT_TINT_ID, 'Root Gold', 'Tints the golden roots, branches and the vines round the trees.', color(1, 1, 1), 3, 'Tree Colors'),
  colorParameter(CINEMA2_RELIQUARY_LEAF_TINT_ID, 'Leaf Gold', 'Tints the golden leaves and the buds on the tree vines.', color(1, 1, 1), 4, 'Tree Colors'),
  colorParameter(CINEMA2_RELIQUARY_GLOW_COLOR_ID, 'Glow Color', 'The color of the light the roots, branches and vines glow with, and of the warm rim light on the forest.', DEFAULT_GLOW, 5, 'Tree Colors'),
  colorParameter(CINEMA2_RELIQUARY_CUE_COLOR_ID, 'Overhead Light Color', 'The color of the six overhead spots.', DEFAULT_CUE, 6, 'Light Colors'),
  colorParameter(CINEMA2_RELIQUARY_STROBE_COLOR_ID, 'Strobe Color', 'The color of the strobe.', DEFAULT_STROBE, 7, 'Light Colors'),
])

// ── The overhead rig ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The parts of the logo the six cue spots are aimed at (logo space: the logo is 2 units wide, centred on the origin), each with the spot's
 * position high overhead. Positions are spread round the stage so every part is lit from its own angle and every beam cuts its own line
 * through the haze.
 */
const CUE_SPOTS = Object.freeze([
  { name: 'top', aim: vec3(0, 0.5, 0.05), from: vec3(0.4, 5.4, 2.2) },
  { name: 'left-lobe', aim: vec3(-0.78, -0.22, 0.05), from: vec3(-2.6, 5, 1.6) },
  { name: 'right-lobe', aim: vec3(0.78, -0.22, 0.05), from: vec3(2.6, 5, 1.6) },
  { name: 'left-swirl', aim: vec3(-0.32, 0.06, 0.05), from: vec3(-1.2, 5.6, 2.8) },
  { name: 'right-swirl', aim: vec3(0.32, 0.06, 0.05), from: vec3(1.2, 5.6, 2.8) },
  { name: 'star', aim: vec3(0, -0.44, 0.05), from: vec3(0, 5.2, 1.2) },
] as const)
type CueName = typeof CUE_SPOTS[number]['name']

const cueLightId = (name: CueName) => cinema2StableId<Cinema2LightId>(`reliquary-cue-${name}`)
const cueTargetId = (name: CueName) => cinema2StableId<Cinema2SceneNodeId>(`reliquary-cue-target-${name}`)
const STROBE_LIGHT_IDS = Object.freeze([cinema2StableId<Cinema2LightId>('reliquary-strobe-left'), cinema2StableId<Cinema2LightId>('reliquary-strobe-right')])
const STROBE_TARGET_ID = cinema2StableId<Cinema2SceneNodeId>('reliquary-strobe-target')

/**
 * Two interlocking one-bar 16th-note patterns (16 steps, `x` = hit). Bar A leans on the tresillo (steps 0, 3, 6 and again 8, 11, 14) so the
 * hits land off the beat; bar B answers it from the other side. Two parts fire together on the strongest hits.
 */
const CUE_PATTERNS: Readonly<Record<'a' | 'b', Readonly<Record<CueName, string>>>> = Object.freeze({
  a: Object.freeze({
    'top': 'x...............',
    'star': 'x..........x....',
    'left-lobe': '...x..........x.',
    'right-lobe': '......x.......x.',
    'left-swirl': '........x.......',
    'right-swirl': '..........x.....',
  }),
  b: Object.freeze({
    'top': '........x......x',
    'star': '...........x....',
    'left-lobe': 'x.............x.',
    'right-lobe': 'x...........x...',
    'left-swirl': '......x.........',
    'right-swirl': '...x............',
  }),
})
const CUE_DUTY = 0.8

const master = cinema2Ref(CINEMA2_RELIQUARY_MASTER_INTENSITY_ID)
const bpmSync = cinema2Ref(CINEMA2_RELIQUARY_BPM_SYNC_ID)
const ruleId = (value: string) => cinema2StableId<Cinema2ChoreographyRuleId>(value)
const actionId = (value: string) => cinema2StableId<Cinema2ChoreographyActionId>(value)

/** On every other bar (`phase` 0 = bar A, 1 = bar B), each cue spot plays its pattern for the bar, at full brightness, dark between hits. */
function cueBarRules(bar: 'a' | 'b', phase: number): Cinema2ChoreographyRuleManifest[] {
  return CUE_SPOTS.map(({ name }) => Object.freeze({
    id: ruleId(`reliquary-cue-${bar}-${name}`),
    priority: 50,
    strengthParameter: master,
    enabledParameter: bpmSync,
    // Every bar starts on a downbeat (published by every analysis source); bar parity comes from the beat-interval condition.
    source: Object.freeze({ signal: 'downbeat' as const, capability: 'music.downbeat' as const }),
    conditions: Object.freeze([
      Object.freeze({ kind: 'once-per-event' as const }),
      Object.freeze({ kind: 'beat-interval' as const, every: 2, phase, unit: 'bar' as const }),
    ]),
    actions: Object.freeze([Object.freeze({
      id: actionId(`reliquary-cue-${bar}-${name}-hits`),
      target: Object.freeze({ kind: 'light' as const, ref: cinema2Ref(cueLightId(name)), property: 'intensity' }),
      operation: 'set-for-duration' as const,
      composition: 'replace' as const,
      value: CUE_PEAK,
      durationBeats: 4,
      gate: Object.freeze({ stepsPerBeat: 4, pattern: CUE_PATTERNS[bar][name], duty: CUE_DUTY }) satisfies Cinema2ChoreographyGateManifest,
    })]),
  }))
}

/** A full white 16th-note strobe on the strobe heads, `beats` long, on `signal` (subject to `conditions`). */
function strobeRule(id: string, signal: 'drop' | 'downbeat', beats: number, conditions: Cinema2ChoreographyRuleManifest['conditions']): Cinema2ChoreographyRuleManifest {
  return Object.freeze({
    id: ruleId(id),
    priority: 70,
    strengthParameter: master,
    source: Object.freeze({ signal, capability: signal === 'drop' ? 'music.drop' as const : 'music.downbeat' as const }),
    conditions,
    actions: Object.freeze([Object.freeze({
      id: actionId(`${id}-flash`),
      target: Object.freeze({ kind: 'light-group' as const, ref: cinema2Ref(STROBE_GROUP_ID), property: 'intensity' }),
      operation: 'set-for-duration' as const,
      composition: 'replace' as const,
      value: STROBE_PEAK,
      durationBeats: beats,
      gate: Object.freeze({ stepsPerBeat: 4, pattern: 'x', duty: 0.3 }),
    })]),
  })
}

const choreographyRules: readonly Cinema2ChoreographyRuleManifest[] = Object.freeze([
  ...cueBarRules('a', 0),
  ...cueBarRules('b', 1),
  // The downbeat swells every cue spot together, a beat-long wash under the chase; a build lifts the whole rig.
  ...cinema2LightRigHit({ id: 'reliquary-cues', group: CUE_GROUP_ID, signal: 'downbeat', peak: 0.6, attack: 0, hold: 0.05, release: 0.8, priority: 40, strengthParameter: master }),
  ...cinema2LightRigRamp({ id: 'reliquary-cues', groups: [CUE_GROUP_ID], source: 'director.build', lift: 1.4, priority: 30, strengthParameter: master }),
  // Strobe: two bars on a drop, and a roll at the top of a build. Not gated by BPM Sync: a drop is a drop.
  strobeRule('reliquary-strobe-drop', 'drop', 8, Object.freeze([Object.freeze({ kind: 'once-per-event' as const })])),
  // The strobe roll at the top of a build: a one-beat burst on every downbeat once the build is nearly complete, leading into the drop.
  // (Not "every downbeat of the peak phase": a drop section can sit at peak for minutes, and strobing through all of it is too much.)
  strobeRule('reliquary-strobe-build', 'downbeat', 1, Object.freeze([
    Object.freeze({ kind: 'once-per-event' as const }),
    Object.freeze({ kind: 'build' as const, min: 0.85 }),
  ])),
  // The haze beams swell on the downbeat with the lights.
  Object.freeze({
    id: ruleId('reliquary-downbeat-beam'),
    priority: 30,
    strengthParameter: master,
    source: Object.freeze({ signal: 'downbeat' as const, capability: 'music.downbeat' as const }),
    actions: Object.freeze([Object.freeze({
      id: actionId('reliquary-downbeat-beam-swell'),
      target: Object.freeze({ kind: 'effect' as const, ref: cinema2Ref(VOLUMETRIC_EFFECT_ID), property: 'beamIntensity' }),
      operation: 'envelope' as const,
      composition: 'add' as const,
      value: 0.6,
      envelope: Object.freeze({ attack: 0, hold: 0.05, release: 0.9, unit: 'beats' as const }),
      retrigger: 'restart' as const,
    })]),
  }),
])

/**
 * Cue spots that also cast shadows from the models (flagged `threeShadow`). Empty for now: with any Three shadow map active, the transmissive
 * crystal renders flat milky white (an interaction between Three's shadow pass and its transmission pass in the shared-renderer setup; verified
 * in real Chrome 2026-09-28, see docs/cinema2-reliquary-cinematic-plan.md step 8). The lower-lobe cues are the intended casters once that is
 * fixed: the golden tree's branches pass in front of those lobes.
 */
const SHADOW_CUES: readonly CueName[] = Object.freeze([])

/** A cue spot high overhead, aimed at its part of the logo, resting dim until the chase hits it. */
function cueSpot(name: CueName) {
  const cue = CUE_SPOTS.find(entry => entry.name === name)!
  const light = spot(cueLightId(name), cue.from, cueTargetId(name), 4.5, CUE_REST, CINEMA2_RELIQUARY_CUE_COLOR_ID, DEFAULT_CUE)
  return SHADOW_CUES.includes(name) ? Object.freeze({ ...light, config: Object.freeze({ ...light.config, threeShadow: true }) }) : light
}

function spot(id: Cinema2LightId, position: Cinema2Vector3, target: Cinema2SceneNodeId, cone: number, intensity: number, colorParameterId: Cinema2ParameterId, lightColor: Cinema2Color) {
  return Object.freeze({
    id,
    type: 'spot' as const,
    color: lightColor,
    intensity,
    transform: Object.freeze({ position }),
    node: cinema2Ref(ROOT_NODE_ID),
    targetNode: cinema2Ref(target),
    controls: Object.freeze({ color: cinema2Ref(colorParameterId) }),
    config: Object.freeze({ coneAngleDegrees: cone, penumbra: 0.35, range: 30 }),
  })
}

// ── Render graph: scene -> ground -> haze -> bloom -> finish ──────────────────────────────────────────────────────────────────────
const targetId = (name: string) => cinema2StableId<Cinema2RenderTargetId>(`reliquary-${name}-target`)
const passId = (name: string) => cinema2StableId<Cinema2RenderPassId>(`reliquary-${name}-pass`)
const slotId = (name: string) => cinema2StableId<Cinema2RenderSlotId>(`reliquary-${name}`)
const SCENE_TARGET_ID = targetId('scene')
const FLOOR_TARGET_ID = targetId('ground')
const ATMOSPHERE_TARGET_ID = targetId('haze')
const BLOOM_TARGET_ID = targetId('bloom')
const SCENE_PASS_ID = passId('scene')
const FLOOR_PASS_ID = passId('ground')
const ATMOSPHERE_PASS_ID = passId('haze')
const BLOOM_PASS_ID = passId('bloom')
const FINISH_PASS_ID = passId('finish')
const SCENE_COLOR_ID = slotId('scene-color')
const SCENE_DEPTH_ID = slotId('scene-depth')

// Float targets carry the glow's light above white through the floor, haze and bloom to the finish's tone curve. A GPU that cannot render to
// float textures gets 8-bit targets (the glow then rolls off toward white in the shader instead of clipping).
const viewportTarget = (id: Cinema2RenderTargetId, depth = false) => Object.freeze({
  id,
  descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba16f' as const, fallbackColorFormat: 'rgba8' as const, ...(depth ? { depthFormat: 'depth24' as const } : {}) }),
  ownership: 'transient' as const,
})

/** A fullscreen effect pass reading the previous pass's color (and optionally the scene depth) and writing one target. */
function effectPass(id: Cinema2RenderPassId, after: Cinema2RenderPassId, afterOutput: Cinema2RenderSlotId, effect: Cinema2EffectId, name: string, output: Cinema2RenderTargetId | null, withDepth: boolean) {
  const colorInput = slotId(`${name}-color-input`)
  const inputs = [
    Object.freeze({ id: colorInput, source: Object.freeze({ pass: cinema2Ref(after), output: afterOutput }), attachment: 'color' as const }),
    ...(withDepth ? [Object.freeze({ id: slotId(`${name}-depth-input`), source: Object.freeze({ pass: cinema2Ref(SCENE_PASS_ID), output: SCENE_DEPTH_ID }), attachment: 'depth' as const })] : []),
  ]
  return Object.freeze({
    id,
    kind: 'fullscreen' as const,
    dependsOn: Object.freeze([cinema2Ref(after)]),
    effect: cinema2Ref(effect),
    inputs: Object.freeze(inputs),
    ...(output ? { outputs: Object.freeze([Object.freeze({ id: slotId(`${name}-output`), target: cinema2Ref(output), attachment: 'color' as const })]) } : {}),
  })
}

export const CINEMA2_RELIQUARY_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_RELIQUARY_PRESET_ID,
  revision: 2,
  metadata: Object.freeze({
    name: 'RELIQUARY',
    description: 'The DVYDRM logo as clear cut crystal held by a golden tree, between dark trees wrapped in glowing gold vines. Six overhead spots chase across the crystal in syncopated patterns, a full strobe hits on the drop, and the roots and vines glow with the music.',
    tags: Object.freeze(['reliquary', 'logo', 'native', '3d', 'crystal', 'gold', 'forest', 'strobe', 'three', 'keeper']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native Cinema 2.0 Stage rendering and the 3D scene.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Depth-tested models, depth-aware haze and ground.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'The logo, the golden tree and the forest are real 3D models placed in the Scene Graph.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Shared world camera framing the logo between the trees.' }),
    Object.freeze({ id: 'lighting' as const, requirement: 'required' as const, purpose: 'Six overhead cue spots aimed at parts of the logo and two strobe heads.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'The overhead cue patterns restart on every bar\'s downbeat; downbeat swell of the rig and the haze beams; peak-phase strobe bursts.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'Two-bar full strobe on a drop.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'The rig lifts through a build; peak-phase strobe.' }),
  ]),
  parameters: PARAMETERS,
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_RELIQUARY_MODULE_ID,
    typeId: THREE_SCENE_TYPE_ID,
    version: 1,
    enabled: true,
    parameters: Object.freeze({
      // The crystal logo: one cut-glass ribbon (the faceted asset has no separate outline ring, like the owner's mockup).
      'crystal.color': CRYSTAL_BODY,
      'crystal.iridescence': CRYSTAL_IRIDESCENCE,
      'crystal.iridescenceThicknessMin': 300,
      'crystal.iridescenceThicknessMax': 600,
      'crystal.roughness': CRYSTAL_ROUGHNESS,
      'crystal.metalness': 0,
      'crystal.transmission': CRYSTAL_CLARITY,
      'crystal.ior': CRYSTAL_IOR,
      'crystal.thickness': CRYSTAL_THICKNESS,
      'crystal.dispersion': CRYSTAL_SPARKLE,
      'crystal.environmentIntensity': CRYSTAL_ENVIRONMENT,
      'roots.color': color(1, 1, 1),
      'roots.roughness': ROOT_ROUGHNESS,
      'roots.environmentIntensity': GOLD_ENVIRONMENT,
      'veins.environmentIntensity': GOLD_ENVIRONMENT,
      'vines.color': color(1, 1, 1),
      'vines.roughness': ROOT_ROUGHNESS,
      'vines.environmentIntensity': VINE_ENVIRONMENT,
      'leaves.color': color(1, 1, 1),
      'leaves.environmentIntensity': GOLD_ENVIRONMENT,
      'buds.color': color(1, 1, 1),
      'buds.environmentIntensity': VINE_ENVIRONMENT,
      'bark.environmentIntensity': BARK_ENVIRONMENT,
      environmentIntensity: 1,
      glowMode: 'both',
      glowSync: true,
      glowReactivity: 0.8,
      glowStrength: GLOW_STRENGTH,
      glowColor: DEFAULT_GLOW,
    }),
    parameterBindings: Object.freeze({
      'crystal.color': cinema2Ref(CINEMA2_RELIQUARY_CRYSTAL_TINT_ID),
      'crystal.roughness': cinema2Ref(CINEMA2_RELIQUARY_CRYSTAL_ROUGHNESS_ID),
      'crystal.transmission': cinema2Ref(CINEMA2_RELIQUARY_CRYSTAL_CLARITY_ID),
      'crystal.dispersion': cinema2Ref(CINEMA2_RELIQUARY_CRYSTAL_SPARKLE_ID),
      'roots.color': cinema2Ref(CINEMA2_RELIQUARY_ROOT_TINT_ID),
      'roots.roughness': cinema2Ref(CINEMA2_RELIQUARY_ROOT_ROUGHNESS_ID),
      'vines.color': cinema2Ref(CINEMA2_RELIQUARY_ROOT_TINT_ID),
      'vines.roughness': cinema2Ref(CINEMA2_RELIQUARY_ROOT_ROUGHNESS_ID),
      'leaves.color': cinema2Ref(CINEMA2_RELIQUARY_LEAF_TINT_ID),
      'buds.color': cinema2Ref(CINEMA2_RELIQUARY_LEAF_TINT_ID),
      environmentIntensity: cinema2Ref(CINEMA2_RELIQUARY_REFLECTION_ID),
      glowMode: cinema2Ref(CINEMA2_RELIQUARY_GLOW_MODE_ID),
      glowSync: bpmSync,
      glowReactivity: master,
      glowStrength: cinema2Ref(CINEMA2_RELIQUARY_GLOW_INTENSITY_ID),
      glowColor: cinema2Ref(CINEMA2_RELIQUARY_GLOW_COLOR_ID),
    }),
    config: Object.freeze({
      instances: Object.freeze([
        Object.freeze({ asset: CINEMA2_DVYDRM_LOGO_FACETED_ASSET_ID, node: CINEMA2_RELIQUARY_LOGO_NODE_ID }),
        Object.freeze({ asset: CINEMA2_GOLDEN_ROOTS_ASSET_ID, node: CINEMA2_RELIQUARY_ROOTS_NODE_ID }),
        Object.freeze({ asset: CINEMA2_RELIQUARY_TREES_ASSET_ID, node: CINEMA2_RELIQUARY_TREES_NODE_ID }),
      ]),
      parts: Object.freeze(['crystal', 'roots', 'veins', 'leaves', 'vines', 'buds', 'bark']),
      // What glows, and how much of the glow each part takes: the thin veins and the tree vines carry it, the leaves and buds catch it,
      // and the gold wood itself warms a little. The dark bark and the crystal do not glow.
      glow: Object.freeze({ veins: 1.2, vines: 2.2, buds: 1.5, leaves: 0.3, roots: 0.12 }),
      // Rendered into float targets and tone-mapped by the finish, so the glow emits its full light.
      hdr: true,
      // The golden tree's wood, veins and leaves cast shadows onto the crystal from the shadow-casting cue spots. The forest does not cast: it is
      // outside those cones, and as one merged mesh it would be drawn into every shadow map for nothing.
      shadows: Object.freeze({ cast: Object.freeze(['roots', 'veins', 'leaves']), receive: Object.freeze(['crystal', 'roots']) }),
      environment: CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID,
      // Two faint panels high front-left and back-right: just enough for the crystal's facets and the gold to catch a band between cues.
      panels: Object.freeze([
        Object.freeze({ position: vec3(-3, 3.8, 3.4), target: vec3(0, 0, 0), size: Object.freeze([2.6, 1.6]), color: Object.freeze([0.9, 0.94, 1]), intensity: 1.2 }),
        Object.freeze({ position: vec3(3.2, 3, -2.4), target: vec3(0, -0.2, 0), size: Object.freeze([2.2, 1.6]), color: Object.freeze([1, 0.88, 0.7]), intensity: 1.2 }),
      ]),
    }),
  })]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
      Object.freeze({
        id: CINEMA2_RELIQUARY_LOGO_NODE_ID,
        kind: 'module' as const,
        parent: cinema2Ref(ROOT_NODE_ID),
        module: cinema2Ref(CINEMA2_RELIQUARY_MODULE_ID),
        transform: Object.freeze({ position: vec3(0, LOGO_HEIGHT, 0) }),
      }),
      Object.freeze({ id: CINEMA2_RELIQUARY_ROOTS_NODE_ID, kind: 'module' as const, parent: cinema2Ref(ROOT_NODE_ID), module: cinema2Ref(CINEMA2_RELIQUARY_MODULE_ID) }),
      Object.freeze({ id: CINEMA2_RELIQUARY_TREES_NODE_ID, kind: 'module' as const, parent: cinema2Ref(ROOT_NODE_ID), module: cinema2Ref(CINEMA2_RELIQUARY_MODULE_ID) }),
      // Aim points for the cue spots (on the logo's parts) and the strobe heads (the middle of the logo).
      ...CUE_SPOTS.map(({ name, aim }) => Object.freeze({
        id: cueTargetId(name),
        kind: 'group' as const,
        parent: cinema2Ref(ROOT_NODE_ID),
        transform: Object.freeze({ position: vec3(aim[0], aim[1] + LOGO_HEIGHT, aim[2]) }),
      })),
      Object.freeze({ id: STROBE_TARGET_ID, kind: 'group' as const, parent: cinema2Ref(ROOT_NODE_ID), transform: Object.freeze({ position: vec3(0, -0.2, 0) }) }),
      Object.freeze({ id: BACK_TARGET_ID, kind: 'group' as const, parent: cinema2Ref(ROOT_NODE_ID), transform: Object.freeze({ position: vec3(0.2, -1.55, -2.6) }) }),
      Object.freeze({ id: RIM_LEFT_TARGET_ID, kind: 'group' as const, parent: cinema2Ref(ROOT_NODE_ID), transform: Object.freeze({ position: vec3(-2.8, 0.4, -1.1) }) }),
      Object.freeze({ id: RIM_RIGHT_TARGET_ID, kind: 'group' as const, parent: cinema2Ref(ROOT_NODE_ID), transform: Object.freeze({ position: vec3(2.8, 0.4, -1.1) }) }),
    ]),
    roots: Object.freeze([cinema2Ref(ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([Object.freeze({
    id: WORLD_LAYER_ID,
    label: 'RELIQUARY World',
    source: cinema2Ref(ROOT_NODE_ID),
    role: 'world' as const,
    depthPolicy: 'read-write' as const,
    order: 0,
  })]),
  cameras: Object.freeze([Object.freeze({
    id: CINEMA2_RELIQUARY_CAMERA_ID,
    label: 'RELIQUARY Front',
    projection: 'perspective' as const,
    fovDegrees: 34,
    // Composed at 16:9; on a narrower Stage (the app's is nearly square) the view widens vertically instead of cropping the framing trees.
    minAspect: 16 / 9,
    near: 0.1,
    far: 60,
    // Framed on the owner's mockup at 16:9: the logo about 40% of the frame width, a little above the middle; the golden tree and its root
    // flare on the wet floor under it; the foreground trees framing both edges and the forest behind.
    transform: Object.freeze({ position: vec3(0, -0.5, 4.9) }),
    target: vec3(0, -0.4, 0),
    rig: Object.freeze({ kind: 'static' as const }),
  })]),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_RELIQUARY_CAMERA_ID) }),
  lighting: Object.freeze({
    groups: Object.freeze([
      Object.freeze({ id: CUE_GROUP_ID, label: 'Overhead Cues', lights: Object.freeze(CUE_SPOTS.map(({ name }) => cinema2Ref(cueLightId(name)))) }),
      Object.freeze({ id: STROBE_GROUP_ID, label: 'Strobe', lights: Object.freeze(STROBE_LIGHT_IDS.map(id => cinema2Ref(id))) }),
    ]),
    // Most important first: the lighting runtime keeps only the first 2 non-ambient lights on low quality and 6 on medium (12 on high). Low
    // keeps the two lower-lobe cues (the chase still alternates across the logo); medium adds the top and star cues, one strobe head and the
    // light shaft; high adds the swirl cues, the second strobe head, the front fill and the two forest rim lights.
    lights: Object.freeze([
      cueSpot('left-lobe'),
      cueSpot('right-lobe'),
      cueSpot('top'),
      spot(STROBE_LIGHT_IDS[0]!, vec3(-2.2, 6, 3), STROBE_TARGET_ID, 34, 0, CINEMA2_RELIQUARY_STROBE_COLOR_ID, DEFAULT_STROBE),
      // The light shaft from the mockups: a narrow beam falling from high above, just behind the logo and off to one side, seen side-on
      // through the haze (a light aimed at the camera scatters its brightest forward glow straight into the lens and washes the frame out).
      spot(BACK_LIGHT_ID, vec3(1.6, 7.5, -4.5), BACK_TARGET_ID, 11, 1.4, CINEMA2_RELIQUARY_CUE_COLOR_ID, color(0.95, 0.93, 0.9)),
      cueSpot('star'),
      cueSpot('left-swirl'),
      cueSpot('right-swirl'),
      spot(STROBE_LIGHT_IDS[1]!, vec3(2.2, 6, 3), STROBE_TARGET_ID, 34, 0, CINEMA2_RELIQUARY_STROBE_COLOR_ID, DEFAULT_STROBE),
      // A very dim warm fill from the front so the crystal and the tree never vanish between cues (the unlit parts stay in shadow).
      Object.freeze({
        id: FILL_LIGHT_ID,
        type: 'spot' as const,
        color: color(1, 0.9, 0.78),
        intensity: 0.35,
        transform: Object.freeze({ position: vec3(0, 1.8, 6) }),
        node: cinema2Ref(ROOT_NODE_ID),
        targetNode: cinema2Ref(STROBE_TARGET_ID),
        // Kept out of the haze: aimed from the camera, its scattering glowed straight into the lens as a white veil behind the tree.
        config: Object.freeze({ coneAngleDegrees: 30, penumbra: 0.8, range: 30, scatter: false }),
      }),
      // Two low warm rim lights from behind just edge the foreground trees, so the dark trunks separate from the dark.
      spot(RIM_LEFT_LIGHT_ID, vec3(-6.5, 2.5, -7), RIM_LEFT_TARGET_ID, 24, 0.018, CINEMA2_RELIQUARY_GLOW_COLOR_ID, color(1, 0.7, 0.4)),
      spot(RIM_RIGHT_LIGHT_ID, vec3(6.5, 2.5, -7), RIM_RIGHT_TARGET_ID, 24, 0.018, CINEMA2_RELIQUARY_GLOW_COLOR_ID, color(1, 0.7, 0.4)),
      Object.freeze({ id: AMBIENT_LIGHT_ID, type: 'ambient' as const, color: color(0.2, 0.18, 0.16), intensity: 0.08 }),
    ]),
  }),
  environment: Object.freeze({
    backgroundColor: DEFAULT_BACKGROUND,
    exposure: 1,
    fog: Object.freeze({ mode: 'exponential' as const, color: color(0.02, 0.018, 0.016), density: 0.05 }),
    controls: Object.freeze({ backgroundColor: cinema2Ref(CINEMA2_RELIQUARY_BACKGROUND_ID) }),
  }),
  effects: Object.freeze([
    Object.freeze({
      id: FLOOR_EFFECT_ID,
      typeId: FLOOR_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 0,
      scope: 'output' as const,
      // A dark wet floor: a glossy mirror of the logo, the glowing roots and the lights, with a light ripple (grit) breaking it up.
      parameters: Object.freeze({ mix: 1, floorY: FLOOR_Y, reflectivity: 0.6, roughness: 0.12, fresnel: 3, albedo: 0.035, poolIntensity: 1.8, specular: 1.2, fadeDistance: 34, maxReflection: 26, grit: 0.22, gritScale: 4 }),
    }),
    Object.freeze({
      id: VOLUMETRIC_EFFECT_ID,
      typeId: VOLUMETRIC_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 1,
      scope: 'output' as const,
      // Haze in the air so the overhead beams, the strobe and the back light read as shafts of light and the forest has depth, plus low thin
      // ground mist round the roots and the tree bases (kept under the logo so it never washes out the crystal or the floor reflections).
      parameters: Object.freeze({
        mix: 1, density: 0.03, beamIntensity: 1.4, mistAmount: 0.7, mistHeight: 0.45, mistFloor: FLOOR_Y, floorY: FLOOR_Y, floorReflection: 0.4, anisotropy: 0.6,
        occlusion: 0.6, ambientHaze: 0.02, noiseScale: 0.3, noiseStrength: 0.55, drift: 0.1, maxDistance: 34, reactivity: 0.6,
      }),
      parameterBindings: Object.freeze({ density: cinema2Ref(CINEMA2_RELIQUARY_HAZE_ID), beamIntensity: cinema2Ref(CINEMA2_RELIQUARY_BEAM_ID) }),
    }),
    Object.freeze({
      id: BLOOM_EFFECT_ID,
      typeId: BLOOM_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 2,
      scope: 'output' as const,
      // HDR bloom: only what is brighter than white glows (the lit gold, the strobe, the crystal's hottest glints), so the crystal body and the
      // gold wood stay crisp; the mip chain gives each lit vine a hot halo that fades into a wide amber glow.
      parameters: Object.freeze({ mix: 1, threshold: 1.1, knee: 0.6, intensity: 0.9, spread: 0.72, levels: 7 }),
      parameterBindings: Object.freeze({ intensity: cinema2Ref(CINEMA2_RELIQUARY_BLOOM_ID) }),
    }),
    Object.freeze({
      id: FINISH_EFFECT_ID,
      typeId: FINISH_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 3,
      scope: 'output' as const,
      // Filmic tone curve: the HDR glow rolls to warm-white cores with amber edges while the dark bark keeps its depth. Light lens fringing and
      // grain only (stronger fringing split the trees' edges into red and cyan).
      parameters: Object.freeze({ mix: 1, toneMap: 1, exposure: 1.05, vignette: 0.55, grain: 0.05, aberration: 0.04, contrast: 1.12, saturation: 1.05 }),
      parameterBindings: Object.freeze({ mix: cinema2Ref(CINEMA2_RELIQUARY_FINISH_ID) }),
    }),
  ]),
  choreography: Object.freeze({ rules: choreographyRules }),
  render: Object.freeze({
    targets: Object.freeze([
      viewportTarget(SCENE_TARGET_ID, true),
      viewportTarget(FLOOR_TARGET_ID),
      viewportTarget(ATMOSPHERE_TARGET_ID),
      viewportTarget(BLOOM_TARGET_ID),
    ]),
    passes: Object.freeze([
      Object.freeze({
        id: SCENE_PASS_ID,
        kind: 'scene' as const,
        layers: Object.freeze([cinema2Ref(WORLD_LAYER_ID)]),
        outputs: Object.freeze([
          Object.freeze({ id: SCENE_COLOR_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'color' as const }),
          Object.freeze({ id: SCENE_DEPTH_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'depth' as const }),
        ]),
      }),
      effectPass(FLOOR_PASS_ID, SCENE_PASS_ID, SCENE_COLOR_ID, FLOOR_EFFECT_ID, 'ground', FLOOR_TARGET_ID, true),
      effectPass(ATMOSPHERE_PASS_ID, FLOOR_PASS_ID, slotId('ground-output'), VOLUMETRIC_EFFECT_ID, 'haze', ATMOSPHERE_TARGET_ID, true),
      effectPass(BLOOM_PASS_ID, ATMOSPHERE_PASS_ID, slotId('haze-output'), BLOOM_EFFECT_ID, 'bloom', BLOOM_TARGET_ID, false),
      effectPass(FINISH_PASS_ID, BLOOM_PASS_ID, slotId('bloom-output'), FINISH_EFFECT_ID, 'finish', null, false),
    ]),
    outputPass: cinema2Ref(FINISH_PASS_ID),
  }),
  output: Object.freeze({ renderPass: cinema2Ref(FINISH_PASS_ID), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
}) as Readonly<Cinema2NativePresetManifest>
