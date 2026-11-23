import { cinema2AutoTargets } from './Cinema2AutoPerformanceAuthoring'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'
import { cinema2StableId as moodStableId, type Cinema2ParameterId as MoodParameterId } from '../contracts/Cinema2NativePresetManifest'
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
  type Cinema2EffectId,
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
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID } from '../effects/Cinema2VolumetricAtmosphereEffect'
import { CINEMA2_HYPNOTIZE_NATIVE_MODULE_TYPE_ID, CINEMA2_HYPNOTIZE_PATTERNS } from '../modules/Cinema2HypnotizeNativeModule'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'

export const CINEMA2_HYPNOTIZE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.hypnotize')
export const CINEMA2_HYPNOTIZE_MODULE_ID = cinema2StableId<Cinema2ModuleId>('hypnotize-system')
export const CINEMA2_HYPNOTIZE_CAMERA_ID = cinema2StableId<Cinema2CameraId>('hypnotize-camera')
const pid = (name: string) => cinema2StableId<Cinema2ParameterId>(`hypnotize-${name}`)
export const CINEMA2_HYPNOTIZE_INTENSITY_ID = pid('intensity')
export const CINEMA2_HYPNOTIZE_REACTIVITY_ID = pid('reactivity')
export const CINEMA2_HYPNOTIZE_AUTO_PERFORMANCE_ID = pid('auto-performance')
export const CINEMA2_HYPNOTIZE_BPM_SYNC_ID = pid('bpm-sync')
export const CINEMA2_HYPNOTIZE_MOTION_SAFETY_ID = pid('motion-safety')
export const CINEMA2_HYPNOTIZE_PATTERN_ID = pid('look')
export const CINEMA2_HYPNOTIZE_PATTERN_CHANGE_ID = pid('pattern-change')
export const CINEMA2_HYPNOTIZE_TRIGGER_ID = pid('trigger')
export const CINEMA2_HYPNOTIZE_SPECTRUM_ID = pid('spectrum')
export const CINEMA2_HYPNOTIZE_COUNTER_ROTATION_ID = pid('counter-rotation')
export const CINEMA2_HYPNOTIZE_TRAVEL_ID = pid('travel')
export const CINEMA2_HYPNOTIZE_FLASH_ACCENTS_ID = pid('flash-accents')
export const CINEMA2_HYPNOTIZE_DROP_STRENGTH_ID = pid('drop-strength')
export const CINEMA2_HYPNOTIZE_ATMOSPHERE_ID = pid('atmosphere')
export const CINEMA2_HYPNOTIZE_IMPACT_ONLY_LED_GATING_ID = pid('impact-only-led-gating')
export const CINEMA2_HYPNOTIZE_WIDTH_ID = pid('spread')
export const CINEMA2_HYPNOTIZE_SPIN_ID = pid('spin')
export const CINEMA2_HYPNOTIZE_PULSE_ID = pid('drift')
export const CINEMA2_HYPNOTIZE_LED_ID = pid('edge-glow')
export const CINEMA2_HYPNOTIZE_BLOOM_ID = pid('bloom')
export const CINEMA2_HYPNOTIZE_FINISH_ID = pid('finish')
export const CINEMA2_HYPNOTIZE_STRUCTURE_ID = pid('primary')
export const CINEMA2_HYPNOTIZE_LIGHT_A_ID = pid('secondary')
export const CINEMA2_HYPNOTIZE_CORE_ID = pid('highlight')
export const CINEMA2_HYPNOTIZE_BACKGROUND_ID = pid('background')

const ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('hypnotize-root')
const TUNNEL_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('hypnotize-tunnel-node')
const WORLD_LAYER_ID = cinema2StableId<Cinema2LayerId>('hypnotize-world-layer')
const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('hypnotize-ambient-light')
const HAZE_LIGHT_ID = cinema2StableId<Cinema2LightId>('hypnotize-haze-light')
const ATMOSPHERE_EFFECT_ID = cinema2StableId<Cinema2EffectId>('hypnotize-atmosphere')
const BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('hypnotize-bloom')
const FINISH_EFFECT_ID = cinema2StableId<Cinema2EffectId>('hypnotize-finish')

const targetId = (name: string) => cinema2StableId<Cinema2RenderTargetId>(`hypnotize-${name}-target`)
const passId = (name: string) => cinema2StableId<Cinema2RenderPassId>(`hypnotize-${name}-pass`)
const slotId = (name: string) => cinema2StableId<Cinema2RenderSlotId>(`hypnotize-${name}`)
const SCENE_TARGET_ID = targetId('scene')
const ATMOSPHERE_TARGET_ID = targetId('atmosphere')
const BLOOM_TARGET_ID = targetId('bloom')
const SCENE_PASS_ID = passId('scene')
const ATMOSPHERE_PASS_ID = passId('atmosphere')
const BLOOM_PASS_ID = passId('bloom')
const FINISH_PASS_ID = passId('finish')
const SCENE_COLOR_ID = slotId('scene-color')
const SCENE_DEPTH_ID = slotId('scene-depth')

const vec3 = (x: number, y: number, z: number): Cinema2Vector3 => Object.freeze([x, y, z])
const color = (r: number, g: number, b: number, a = 1): Cinema2Color => Object.freeze([r, g, b, a])
const BACKGROUND = color(0.0005, 0.0007, 0.001)
const STRUCTURE = color(0.05, 0.075, 0.11)
const LIGHT_A = color(0.1, 0.78, 1)
const LIGHT_B = color(0.55, 0.22, 1)
const CORE = color(0.9, 0.97, 1)

const PATTERN_LABELS = Object.freeze({
  mesmericOrbit: 'Mesmeric Orbit',
  blackIris: 'Black Iris',
  turbineBloom: 'Turbine Bloom',
  chromaticRelay: 'Chromatic Relay',
  infiniteDraw: 'Infinite Draw',
  radiantCollapse: 'Radiant Collapse',
} as const)

const parameterBase = Object.freeze({
  section: 'Design', exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
  modulatable: true, choreographable: true, automatable: false,
})
const floatParameter = (id: Cinema2ParameterId, label: string, description: string, defaultValue: number, min: number, max: number, step: number, parent: 'master-controls' | 'design' | 'effects', group: string, order: number) => Object.freeze({
  ...parameterBase, id, label, description, type: 'float' as const, defaultValue, min, max, step, designParentGroup: parent, group, order,
})
const colorParameter = (id: Cinema2ParameterId, label: string, description: string, defaultValue: Cinema2Color, order: number) => Object.freeze({
  ...parameterBase, id, label, description, type: 'color' as const, defaultValue, designParentGroup: 'palette' as const, group: 'Color', order,
})

const choreographyRuleId = (name: string) => cinema2StableId<Cinema2ChoreographyRuleId>(`hypnotize-${name}-rule`)
const choreographyActionId = (name: string) => cinema2StableId<Cinema2ChoreographyActionId>(`hypnotize-${name}-action`)
const moduleContinuousRule = (
  name: string,
  capability: 'audio.features' | 'audio.bands' | 'music.vocal-presence' | 'visual-director.significance',
  path: 'audio.features.overallEnergy' | 'audio.features.spectralFlux' | 'audio.features.vocalPresence' | 'audio.bands.bass' | 'audio.bands.lowMid' | 'audio.bands.mid' | 'audio.bands.high' | 'director.intensity' | 'director.momentum' | 'director.build' | 'director.impact',
  property: string,
  smoothingMs: number,
) => Object.freeze({
  id: choreographyRuleId(name),
  priority: 12,
  strengthParameter: cinema2Ref(CINEMA2_HYPNOTIZE_REACTIVITY_ID),
  source: Object.freeze({ signal: 'continuous' as const, capability, path, smoothingMs }),
  actions: Object.freeze([Object.freeze({
    id: choreographyActionId(name),
    target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_HYPNOTIZE_MODULE_ID), property }),
    operation: 'replace' as const,
    value: 1,
  })]),
})
const moduleEnvelopeRule = (
  name: string,
  signal: 'beat' | 'kick' | 'snare' | 'downbeat' | 'bar' | 'phrase' | 'section-change' | 'drop',
  capability: 'music.beat' | 'music.rhythm-events' | 'music.downbeat' | 'music.bar' | 'music.phrase' | 'music.section' | 'music.drop',
  property: string,
  hold: number,
  release: number,
) => Object.freeze({
  id: choreographyRuleId(name),
  priority: 30,
  strengthParameter: cinema2Ref(CINEMA2_HYPNOTIZE_REACTIVITY_ID),
  source: Object.freeze({ signal, capability }),
  conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
  actions: Object.freeze([Object.freeze({
    id: choreographyActionId(name),
    target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_HYPNOTIZE_MODULE_ID), property }),
    operation: 'envelope' as const,
    value: 1,
    composition: 'replace' as const,
    envelope: Object.freeze({ attack: 0.015, hold, release, unit: 'seconds' as const }),
    retrigger: 'restart' as const,
  })]),
})
const cameraContinuousAction = (name: string, property: 'transform.position' | 'target' | 'fovDegrees', value: number | readonly number[]) => Object.freeze({
  id: choreographyActionId(name),
  target: Object.freeze({ kind: 'camera' as const, ref: cinema2Ref(CINEMA2_HYPNOTIZE_CAMERA_ID), property }),
  operation: 'add' as const,
  value,
})
const cameraEnvelopeAction = (name: string, property: 'transform.position' | 'target' | 'fovDegrees', value: number | readonly number[], hold: number, release: number) => Object.freeze({
  ...cameraContinuousAction(name, property, value),
  operation: 'envelope' as const,
  composition: 'add' as const,
  envelope: Object.freeze({ attack: 0.04, hold, release, unit: 'seconds' as const }),
  retrigger: 'restart' as const,
})

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
function effectPass(id: Cinema2RenderPassId, after: Cinema2RenderPassId, afterOutput: Cinema2RenderSlotId, effect: Cinema2EffectId, name: string, output: Cinema2RenderTargetId | null, withDepth: boolean) {
  return Object.freeze({
    id,
    kind: 'fullscreen' as const,
    dependsOn: Object.freeze([cinema2Ref(after)]),
    effect: cinema2Ref(effect),
    inputs: Object.freeze([
      Object.freeze({ id: slotId(`${name}-color-input`), source: Object.freeze({ pass: cinema2Ref(after), output: afterOutput }), attachment: 'color' as const }),
      ...(withDepth ? [Object.freeze({ id: slotId(`${name}-depth-input`), source: Object.freeze({ pass: cinema2Ref(SCENE_PASS_ID), output: SCENE_DEPTH_ID }), attachment: 'depth' as const })] : []),
    ]),
    ...(output ? { outputs: Object.freeze([Object.freeze({ id: slotId(`${name}-output`), target: cinema2Ref(output), attachment: 'color' as const })]) } : {}),
  })
}

const AUTO_OFF_ON_EDIT = Object.freeze({ userEditSetParameters: Object.freeze({ [CINEMA2_HYPNOTIZE_AUTO_PERFORMANCE_ID]: false }) })

/**
 * HYPNOTIZE: a spiral ring tunnel. Round rings recede to a vanishing point, each turned a little more than the last, with neighbours turning against each other; light strips on
 * every ring, long light lines running to the corners of the frame, one hero ring at a time and a glow at the far end. The six patterns (the same programs the preset has always
 * had) drive which strips light and how, and the tunnel scrolls toward you at a pace that follows the tempo. Rebuilt on Depth's instanced WebGL renderer: matte structure, HDR
 * light, and a three-pass finish (haze, bloom, finish). See docs/hypnotize-redesign.md.
 */
const CINEMA2_HYPNOTIZE_AUTHORED_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_HYPNOTIZE_PRESET_ID,
  revision: 8,
  metadata: Object.freeze({
    name: 'Hypnotize',
    description: 'A spiral tunnel of black rings and HDR light strips receding to a vanishing point, turning against each other, with six musical light patterns.',
    tags: Object.freeze(['keeper', 'hypnotize', '3d', 'tunnel', 'rings', 'light', 'audio-reactive', 'choreography']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Instanced procedural ring-tunnel rendering.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Correct ring occlusion and depth-aware atmosphere.' }),
    Object.freeze({ id: 'render.hdr' as const, requirement: 'optional' as const, purpose: 'Preserves light-strip values above white for HDR bloom, with an 8-bit fallback.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'World-space tunnel geometry.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Perspective view down the tunnel.' }),
    Object.freeze({ id: 'lighting' as const, requirement: 'required' as const, purpose: 'Low ambient structure visibility and atmospheric scattering.' }),
    Object.freeze({ id: 'audio.transport' as const, requirement: 'optional' as const, purpose: 'Transport-safe timing when a track is present.' }),
    Object.freeze({ id: 'audio.features' as const, requirement: 'optional' as const, purpose: 'Energy and spectral flux brighten and speed the tunnel.' }),
    Object.freeze({ id: 'audio.bands' as const, requirement: 'optional' as const, purpose: 'Bass, mid and high bands shape the light patterns.' }),
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'Beats drive the pattern clock and a small pulse.' }),
    Object.freeze({ id: 'music.rhythm-events' as const, requirement: 'optional' as const, purpose: 'Kick and snare accents excite distinct strips.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Downbeats lift the hero ring and the far glow.' }),
    Object.freeze({ id: 'music.bar' as const, requirement: 'optional' as const, purpose: 'Bar boundaries advance manual and automatic patterns.' }),
    Object.freeze({ id: 'music.phrase' as const, requirement: 'optional' as const, purpose: 'Phrase boundaries add a restrained camera accent.' }),
    Object.freeze({ id: 'music.section' as const, requirement: 'optional' as const, purpose: 'Section context chooses pattern behavior.' }),
    Object.freeze({ id: 'music.vocal-presence' as const, requirement: 'optional' as const, purpose: 'Quiet vocal passages hold the tunnel back.' }),
    Object.freeze({ id: 'music.build' as const, requirement: 'optional' as const, purpose: 'Build progress quickens the tunnel.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'Drops discharge the strips, bounded by Flash Accents and Drop Strength.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'Build and impact scale motion and light without lifting dark structure.' }),
  ]),
  parameters: Object.freeze([
    CINEMA2_QUALITY_MODE_PARAMETER,
    floatParameter(CINEMA2_HYPNOTIZE_INTENSITY_ID, 'Master Intensity', 'Master brightness of the ring light strips and the far glow.', 1, 0, 2, 0.01, 'master-controls', 'Light', 1),
    floatParameter(CINEMA2_HYPNOTIZE_REACTIVITY_ID, 'Music Reactivity', 'Scales how strongly the shared Audio Intelligence and Visual Director move the tunnel.', 1, 0, 2, 0.01, 'master-controls', 'Playback', 2),
    Object.freeze({ ...parameterBase, id: CINEMA2_HYPNOTIZE_AUTO_PERFORMANCE_ID, label: 'Auto Performance', description: 'Lets the shared Audio Intelligence choose Pattern Change and the Trigger from the current musical context, and moves the tunnel around its authored values.', type: 'boolean' as const, defaultValue: false, designParentGroup: 'master-controls' as const, order: 3, group: 'Playback' }),
    Object.freeze({ ...parameterBase, id: CINEMA2_HYPNOTIZE_BPM_SYNC_ID, label: 'BPM Sync', description: 'Sync the tunnel scroll, ring rotation and light patterns to detected track tempo. Without a track they free-run deterministically.', type: 'boolean' as const, defaultValue: true, designParentGroup: 'master-controls' as const, order: 4, group: 'Playback' }),
    Object.freeze({
      ...parameterBase,
      id: CINEMA2_HYPNOTIZE_MOTION_SAFETY_ID,
      label: 'Motion Safety',
      description: 'Full uses the authored pace, Reduced moves more slowly, and Lock Off holds the opening composition.',
      type: 'enum' as const,
      defaultValue: 'full',
      designParentGroup: 'master-controls' as const,
      order: 5,
      group: 'Playback',
      options: Object.freeze([
        Object.freeze({ value: 'full', label: 'Full Motion' }),
        Object.freeze({ value: 'reduced', label: 'Reduced Motion' }),
        Object.freeze({ value: 'lockoff', label: 'Lock Off' }),
      ]),
    }),
    Object.freeze({
      ...parameterBase,
      id: CINEMA2_HYPNOTIZE_FLASH_ACCENTS_ID,
      label: 'Flash Accents',
      description: 'Hard authorization for the bright drop discharge. Off keeps only a quarter of it.',
      type: 'enum' as const,
      defaultValue: 'reduced',
      options: Object.freeze([Object.freeze({ value: 'off', label: 'Off' }), Object.freeze({ value: 'reduced', label: 'Reduced' }), Object.freeze({ value: 'full', label: 'Full' })]),
      designParentGroup: 'master-controls' as const,
      group: 'Playback',
      order: 6,
    }),
    Object.freeze({
      ...parameterBase,
      id: CINEMA2_HYPNOTIZE_PATTERN_ID,
      label: 'Pattern',
      description: 'Selects one of six authored light patterns for the ring strips, with a bounded crossfade. Choosing a pattern turns Auto Performance off.',
      type: 'enum' as const,
      defaultValue: 'mesmericOrbit',
      metadata: AUTO_OFF_ON_EDIT,
      designParentGroup: 'design' as const,
      order: 1,
      group: 'Pattern',
      options: Object.freeze(CINEMA2_HYPNOTIZE_PATTERNS.map(value => Object.freeze({ value, label: PATTERN_LABELS[value] }))),
    }),
    Object.freeze({
      ...parameterBase,
      id: CINEMA2_HYPNOTIZE_PATTERN_CHANGE_ID,
      label: 'Pattern Change',
      description: 'Advances through all six patterns when the selected Trigger occurs. Enabling it turns Auto Performance off.',
      type: 'boolean' as const,
      defaultValue: false,
      metadata: AUTO_OFF_ON_EDIT,
      designParentGroup: 'design' as const,
      order: 2,
      group: 'Pattern',
    }),
    Object.freeze({
      ...parameterBase,
      id: CINEMA2_HYPNOTIZE_TRIGGER_ID,
      label: 'Trigger',
      description: 'Chooses the musical event that advances the pattern while Pattern Change is enabled.',
      type: 'enum' as const,
      defaultValue: 'bar4',
      options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,
      visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: CINEMA2_HYPNOTIZE_PATTERN_CHANGE_ID, value: true })]),
      designParentGroup: 'design' as const,
      order: 3,
      group: 'Pattern',
    }),
    floatParameter(CINEMA2_HYPNOTIZE_WIDTH_ID, 'Tunnel Width', 'Widens or narrows the whole tunnel. Wider rings leave the frame sooner; narrower ones show more of the corners as dark.', 1, 0.7, 1.3, 0.01, 'design', 'Tunnel', 4),
    floatParameter(CINEMA2_HYPNOTIZE_SPIN_ID, 'Rotation Speed', 'Sets how fast the rings turn. Zero is a hard stop.', 0.52, 0, 2, 0.01, 'design', 'Motion', 5),
    floatParameter(CINEMA2_HYPNOTIZE_COUNTER_ROTATION_ID, 'Counter-Rotation', 'Sets how strongly neighbouring rings turn against each other.', 0.65, 0, 1, 0.01, 'design', 'Motion', 6),
    floatParameter(CINEMA2_HYPNOTIZE_TRAVEL_ID, 'Travel', 'Sets how fast the tunnel scrolls toward you, and the authority of the camera moves.', 0.45, 0, 1, 0.01, 'design', 'Motion', 7),
    floatParameter(CINEMA2_HYPNOTIZE_PULSE_ID, 'Pulse Depth', 'Sets the bounded bass and kick pulse in the light.', 0.55, 0, 2, 0.01, 'design', 'Light', 8),
    floatParameter(CINEMA2_HYPNOTIZE_LED_ID, 'LED Intensity', 'Brightness of the ring light strips.', 1, 0, 2, 0.01, 'design', 'Light', 9),
    floatParameter(CINEMA2_HYPNOTIZE_ATMOSPHERE_ID, 'Atmosphere', 'Subtle depth-aware air around the lit rings.', 0.006, 0, 0.12, 0.001, 'effects', 'Atmosphere', 1),
    floatParameter(CINEMA2_HYPNOTIZE_BLOOM_ID, 'Bloom', 'Contained HDR halo around bright strip cores.', 0.34, 0, 3, 0.01, 'effects', 'Post', 2),
    floatParameter(CINEMA2_HYPNOTIZE_FINISH_ID, 'Cinematic Finish', 'Tone curve, contrast, vignette and restrained grain.', 1, 0, 1, 0.01, 'effects', 'Post', 3),
    floatParameter(CINEMA2_HYPNOTIZE_DROP_STRENGTH_ID, 'Drop Strength', 'Caps the discharge and speed-up a drop adds.', 0.75, 0, 1, 0.01, 'effects', 'Performance', 4),
    Object.freeze({
      ...parameterBase,
      id: CINEMA2_HYPNOTIZE_IMPACT_ONLY_LED_GATING_ID,
      label: 'Drop / Impact LED Gating',
      description: 'When enabled, individual strip ON/OFF masks run only during a DROP section or a Major Impact. Strips stay continuously powered at all other times.',
      type: 'boolean' as const,
      defaultValue: false,
      designParentGroup: 'effects' as const,
      group: 'Performance',
      order: 5,
    }),
    colorParameter(CINEMA2_HYPNOTIZE_BACKGROUND_ID, 'Background', 'Near-black void behind the tunnel.', BACKGROUND, 1),
    colorParameter(CINEMA2_HYPNOTIZE_STRUCTURE_ID, 'Structure', 'Base colour of the black rings and vanes.', STRUCTURE, 2),
    colorParameter(CINEMA2_HYPNOTIZE_LIGHT_A_ID, 'Light', 'Colour of the main ring light strips.', LIGHT_A, 3),
    colorParameter(CINEMA2_HYPNOTIZE_SPECTRUM_ID, 'Accent Light', 'Colour of the second set of strips, on alternate sectors and rings.', LIGHT_B, 4),
    colorParameter(CINEMA2_HYPNOTIZE_CORE_ID, 'Core', 'The hot white of a fully driven strip, the hero ring and the far glow.', CORE, 5),
  ]),
  modules: Object.freeze([
    Object.freeze({
      id: CINEMA2_HYPNOTIZE_MODULE_ID,
      typeId: CINEMA2_HYPNOTIZE_NATIVE_MODULE_TYPE_ID,
      version: 1,
      enabled: true,
      parameters: Object.freeze({
        intensity: 1,
        look: 'mesmericOrbit',
        autoPerformance: true,
        patternChange: false,
        trigger: 'bar4',
        bpmSync: true,
        motionSafety: 'full',
        spread: 1,
        spin: 0.52,
        counterRotation: 0.65,
        travel: 0.45,
        drift: 0.55,
        edgeGlow: 1,
        flashAccents: 'reduced',
        dropStrength: 0.75,
        impactOnlyLedGating: false,
        primaryColor: STRUCTURE,
        secondaryColor: LIGHT_A,
        spectrumColor: LIGHT_B,
        highlightColor: CORE,
        overallEnergy: 0,
        bassPressure: 0,
        lowMidAmount: 0,
        midAmount: 0,
        highsAmount: 0,
        fluxAmount: 0,
        vocalPresence: 0,
        directorIntensity: 0,
        directorMomentum: 0,
        directorImpact: 0,
        buildAmount: 0,
        beatAccent: 0,
        kickAccent: 0,
        snareAccent: 0,
        downbeatAccent: 0,
        barAccent: 0,
        phraseAccent: 0,
        sectionAccent: 0,
        dropAccent: 0,
      }),
      parameterBindings: Object.freeze({
        intensity: cinema2Ref(CINEMA2_HYPNOTIZE_INTENSITY_ID),
        look: cinema2Ref(CINEMA2_HYPNOTIZE_PATTERN_ID),
        autoPerformance: cinema2Ref(CINEMA2_HYPNOTIZE_AUTO_PERFORMANCE_ID),
        patternChange: cinema2Ref(CINEMA2_HYPNOTIZE_PATTERN_CHANGE_ID),
        trigger: cinema2Ref(CINEMA2_HYPNOTIZE_TRIGGER_ID),
        bpmSync: cinema2Ref(CINEMA2_HYPNOTIZE_BPM_SYNC_ID),
        motionSafety: cinema2Ref(CINEMA2_HYPNOTIZE_MOTION_SAFETY_ID),
        spread: cinema2Ref(CINEMA2_HYPNOTIZE_WIDTH_ID),
        spin: cinema2Ref(CINEMA2_HYPNOTIZE_SPIN_ID),
        counterRotation: cinema2Ref(CINEMA2_HYPNOTIZE_COUNTER_ROTATION_ID),
        travel: cinema2Ref(CINEMA2_HYPNOTIZE_TRAVEL_ID),
        drift: cinema2Ref(CINEMA2_HYPNOTIZE_PULSE_ID),
        edgeGlow: cinema2Ref(CINEMA2_HYPNOTIZE_LED_ID),
        flashAccents: cinema2Ref(CINEMA2_HYPNOTIZE_FLASH_ACCENTS_ID),
        dropStrength: cinema2Ref(CINEMA2_HYPNOTIZE_DROP_STRENGTH_ID),
        impactOnlyLedGating: cinema2Ref(CINEMA2_HYPNOTIZE_IMPACT_ONLY_LED_GATING_ID),
        primaryColor: cinema2Ref(CINEMA2_HYPNOTIZE_STRUCTURE_ID),
        secondaryColor: cinema2Ref(CINEMA2_HYPNOTIZE_LIGHT_A_ID),
        spectrumColor: cinema2Ref(CINEMA2_HYPNOTIZE_SPECTRUM_ID),
        highlightColor: cinema2Ref(CINEMA2_HYPNOTIZE_CORE_ID),
      }),
    }),
  ]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
      Object.freeze({ id: TUNNEL_NODE_ID, kind: 'module' as const, parent: cinema2Ref(ROOT_NODE_ID), module: cinema2Ref(CINEMA2_HYPNOTIZE_MODULE_ID) }),
    ]),
    roots: Object.freeze([cinema2Ref(ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([
    Object.freeze({ id: WORLD_LAYER_ID, label: 'Hypnotize Tunnel', source: cinema2Ref(ROOT_NODE_ID), role: 'world', depthPolicy: 'read-write' as const, order: 0 }),
  ]),
  cameras: Object.freeze([Object.freeze({
    id: CINEMA2_HYPNOTIZE_CAMERA_ID,
    label: 'Hypnotize Tunnel Camera',
    projection: 'perspective' as const,
    fovDegrees: 66,
    minAspect: 0.72,
    near: 0.05,
    far: 150,
    transform: Object.freeze({ position: vec3(0, 0, 0.4) }),
    target: vec3(0, 0, -60),
    rig: Object.freeze({ kind: 'static' as const }),
    motion: Object.freeze({
      drift: Object.freeze({ position: 0.1, target: 0.5, rollDegrees: 0.9, fovDegrees: 0.4, speed: 0.03, seed: 6206 }),
      tempo: Object.freeze({ referenceBpm: 120, weave: 0.05, bob: 0.04, roll: 0.4, fov: 0.4, punch: 0.6 }),
      fovRateLimitDegreesPerSecond: 7,
    }),
    controls: Object.freeze({
      motionSafety: cinema2Ref(CINEMA2_HYPNOTIZE_MOTION_SAFETY_ID),
      tempoSync: cinema2Ref(CINEMA2_HYPNOTIZE_BPM_SYNC_ID),
      motionAmount: cinema2Ref(CINEMA2_HYPNOTIZE_TRAVEL_ID),
    }),
    smoothingMs: 160,
    safety: Object.freeze({
      minPosition: vec3(-0.8, -0.6, -0.4),
      maxPosition: vec3(0.8, 0.6, 1.6),
      maxPositionOffset: vec3(0.4, 0.3, 0.9),
      maxTargetOffset: vec3(1.6, 1.2, 2),
      minFovDegrees: 56,
      maxFovDegrees: 76,
      minNear: 0.03,
      maxFar: 170,
    }),
  })]),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_HYPNOTIZE_CAMERA_ID) }),
  choreography: Object.freeze({
    tempoSyncParameter: cinema2Ref(CINEMA2_HYPNOTIZE_BPM_SYNC_ID),
    rules: Object.freeze([
      moduleContinuousRule('energy', 'audio.features', 'audio.features.overallEnergy', 'overallEnergy', 130),
      moduleContinuousRule('bass', 'audio.bands', 'audio.bands.bass', 'bassPressure', 85),
      moduleContinuousRule('low-mid', 'audio.bands', 'audio.bands.lowMid', 'lowMidAmount', 110),
      moduleContinuousRule('mid', 'audio.bands', 'audio.bands.mid', 'midAmount', 95),
      moduleContinuousRule('highs', 'audio.bands', 'audio.bands.high', 'highsAmount', 75),
      moduleContinuousRule('flux', 'audio.features', 'audio.features.spectralFlux', 'fluxAmount', 55),
      moduleContinuousRule('vocal', 'music.vocal-presence', 'audio.features.vocalPresence', 'vocalPresence', 180),
      moduleContinuousRule('director-intensity', 'visual-director.significance', 'director.intensity', 'directorIntensity', 120),
      moduleContinuousRule('director-momentum', 'visual-director.significance', 'director.momentum', 'directorMomentum', 95),
      moduleContinuousRule('director-build', 'visual-director.significance', 'director.build', 'buildAmount', 140),
      moduleContinuousRule('director-impact', 'visual-director.significance', 'director.impact', 'directorImpact', 45),
      moduleEnvelopeRule('beat', 'beat', 'music.beat', 'beatAccent', 0.01, 0.16),
      moduleEnvelopeRule('kick', 'kick', 'music.rhythm-events', 'kickAccent', 0.02, 0.22),
      moduleEnvelopeRule('snare', 'snare', 'music.rhythm-events', 'snareAccent', 0.025, 0.3),
      moduleEnvelopeRule('downbeat', 'downbeat', 'music.downbeat', 'downbeatAccent', 0.04, 0.48),
      moduleEnvelopeRule('bar', 'bar', 'music.bar', 'barAccent', 0.04, 0.5),
      moduleEnvelopeRule('phrase', 'phrase', 'music.phrase', 'phraseAccent', 0.08, 0.85),
      moduleEnvelopeRule('section', 'section-change', 'music.section', 'sectionAccent', 0.1, 1),
      moduleEnvelopeRule('drop', 'drop', 'music.drop', 'dropAccent', 0.075, 1.4),
      Object.freeze({
        id: choreographyRuleId('auto-camera-build'), priority: 100,
        enabledParameter: cinema2Ref(CINEMA2_HYPNOTIZE_AUTO_PERFORMANCE_ID),
        strengthParameter: cinema2Ref(CINEMA2_HYPNOTIZE_TRAVEL_ID),
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 150 }),
        actions: Object.freeze([
          cameraContinuousAction('auto-camera-build-position', 'transform.position', Object.freeze([0, 0.04, -0.65] as const)),
          cameraContinuousAction('auto-camera-build-fov', 'fovDegrees', -1.2),
        ]),
      }),
      Object.freeze({
        id: choreographyRuleId('auto-camera-drop'), priority: 110,
        enabledParameter: cinema2Ref(CINEMA2_HYPNOTIZE_AUTO_PERFORMANCE_ID),
        strengthParameter: cinema2Ref(CINEMA2_HYPNOTIZE_DROP_STRENGTH_ID),
        source: Object.freeze({ signal: 'drop' as const, capability: 'music.drop' as const }),
        conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([
          cameraEnvelopeAction('auto-camera-drop-position', 'transform.position', Object.freeze([0, 0, -0.85] as const), 0.06, 0.8),
          cameraEnvelopeAction('auto-camera-drop-fov', 'fovDegrees', -1.6, 0.04, 0.62),
        ]),
      }),
      Object.freeze({
        id: choreographyRuleId('auto-camera-phrase'), priority: 105,
        enabledParameter: cinema2Ref(CINEMA2_HYPNOTIZE_AUTO_PERFORMANCE_ID),
        strengthParameter: cinema2Ref(CINEMA2_HYPNOTIZE_TRAVEL_ID),
        source: Object.freeze({ signal: 'phrase' as const, capability: 'music.phrase' as const }),
        conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([
          cameraEnvelopeAction('auto-camera-phrase-position', 'transform.position', Object.freeze([0.24, 0.08, -0.14] as const), 0.08, 0.75),
          cameraEnvelopeAction('auto-camera-phrase-target', 'target', Object.freeze([-0.4, 0.2, -0.2] as const), 0.08, 0.75),
        ]),
      }),
    ]),
  }),
  lighting: Object.freeze({
    lights: Object.freeze([
      Object.freeze({ id: AMBIENT_LIGHT_ID, type: 'ambient' as const, color: color(0.3, 0.32, 0.38), intensity: 0.03 }),
      Object.freeze({ id: HAZE_LIGHT_ID, type: 'point' as const, color: CORE, intensity: 0.14, transform: Object.freeze({ position: vec3(0, 0, -30) }), config: Object.freeze({ range: 38 }) }),
    ]),
  }),
  environment: Object.freeze({
    backgroundColor: BACKGROUND,
    exposure: 1,
    controls: Object.freeze({ backgroundColor: cinema2Ref(CINEMA2_HYPNOTIZE_BACKGROUND_ID) }),
  }),
  effects: Object.freeze([
    Object.freeze({
      id: ATMOSPHERE_EFFECT_ID,
      typeId: CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 0,
      scope: 'output' as const,
      parameters: Object.freeze({
        mix: 1, density: 0.006, beamIntensity: 0.065, mistAmount: 0, mistHeight: 0.5, mistFloor: -4.5, floorY: -4.5, floorReflection: 0,
        anisotropy: 0.4, occlusion: 0.82, ambientHaze: 0.004, noiseScale: 0.34, noiseStrength: 0.08, drift: 0.025, maxDistance: 70, reactivity: 0,
      }),
      parameterBindings: Object.freeze({ density: cinema2Ref(CINEMA2_HYPNOTIZE_ATMOSPHERE_ID) }),
    }),
    Object.freeze({
      id: BLOOM_EFFECT_ID,
      typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 1,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, threshold: 2.1, knee: 0.35, intensity: 0.34, spread: 0.3, levels: 4, clampMax: 12 }),
      parameterBindings: Object.freeze({ intensity: cinema2Ref(CINEMA2_HYPNOTIZE_BLOOM_ID) }),
    }),
    Object.freeze({
      id: FINISH_EFFECT_ID,
      typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 2,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, toneMap: 1, exposure: 0.95, contrast: 1.24, saturation: 0.9, vignette: 0.6, vignetteSoftness: 0.7, grain: 0.025, aberration: 0.01 }),
      parameterBindings: Object.freeze({ mix: cinema2Ref(CINEMA2_HYPNOTIZE_FINISH_ID) }),
    }),
  ]),
  render: Object.freeze({
    targets: Object.freeze([
      viewportTarget(SCENE_TARGET_ID, true),
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
      effectPass(ATMOSPHERE_PASS_ID, SCENE_PASS_ID, SCENE_COLOR_ID, ATMOSPHERE_EFFECT_ID, 'atmosphere', ATMOSPHERE_TARGET_ID, true),
      effectPass(BLOOM_PASS_ID, ATMOSPHERE_PASS_ID, slotId('atmosphere-output'), BLOOM_EFFECT_ID, 'bloom', BLOOM_TARGET_ID, false),
      effectPass(FINISH_PASS_ID, BLOOM_PASS_ID, slotId('bloom-output'), FINISH_EFFECT_ID, 'finish', null, false),
    ]),
    outputPass: cinema2Ref(FINISH_PASS_ID),
  }),
  output: Object.freeze({ renderPass: cinema2Ref(FINISH_PASS_ID), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
})

const moduleTarget = (property: string) => cinema2AutoTargets.module('hypnotize-system' as string, property)
const moodParameter = (id: string) => moodStableId<MoodParameterId>(id)
/**
 * HYPNOTIZE with the shared Mood Conductor and Auto Performance. With Auto Performance on, the passage's mood moves the tunnel around its authored values and the music
 * chooses Pattern Change and the Trigger for the Pattern: rotation, counter-rotation and the pulse follow how active it is, the tunnel widens a little and the strips
 * brighten on a peak, and the strips and rotation settle in a calm passage. There are deliberately no drop-time flashes of its own: Flash Accents and Drop / Impact LED
 * Gating limit flashing, and the mood must not bypass them. Travel, Tunnel Width limits, the flash controls and the palette stay the user's.
 */
export const CINEMA2_HYPNOTIZE_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = withCinema2MoodDrives(CINEMA2_HYPNOTIZE_AUTHORED_PRESET_MANIFEST, {
  idPrefix: 'hypnotize-auto',
  enabledParameter: moodParameter('hypnotize-auto-performance'),
  strengthParameter: moodParameter('hypnotize-reactivity'),
  patternControls: { patternChange: moodParameter('hypnotize-pattern-change'), trigger: moodParameter('hypnotize-trigger') },
  drives: [
    { id: 'intensity-activity', target: moduleTarget('intensity'), source: 'mood.activity', operation: 'add', value: 0.1 },
    { id: 'intensity-calm', target: moduleTarget('intensity'), source: 'mood.calm', operation: 'add', value: -0.1 },
    { id: 'width-peak', target: moduleTarget('spread'), source: 'mood.peak', operation: 'add', value: 0.08 },
    { id: 'pulse-activity', target: moduleTarget('drift'), source: 'mood.activity', operation: 'add', value: 0.3 },
    { id: 'rotation-activity', target: moduleTarget('spin'), source: 'mood.activity', operation: 'add', value: 0.3 },
    { id: 'rotation-calm', target: moduleTarget('spin'), source: 'mood.calm', operation: 'add', value: -0.12 },
    { id: 'counter-activity', target: moduleTarget('counterRotation'), source: 'mood.activity', operation: 'add', value: 0.15 },
    { id: 'led-peak', target: moduleTarget('edgeGlow'), source: 'mood.peak', operation: 'add', value: 0.2 },
    { id: 'led-calm', target: moduleTarget('edgeGlow'), source: 'mood.calm', operation: 'add', value: -0.1 },
    { id: 'atmosphere-tense', target: cinema2AutoTargets.effect('hypnotize-atmosphere', 'density'), source: 'mood.tense', operation: 'add', value: 0.01 },
    { id: 'bloom-peak', target: cinema2AutoTargets.effect('hypnotize-bloom', 'intensity'), source: 'mood.peak', operation: 'add', value: 0.15 },
  ],
})
