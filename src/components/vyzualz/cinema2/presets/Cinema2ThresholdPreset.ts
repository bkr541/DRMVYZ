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
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { cinema2CinematicMotion } from './Cinema2CameraMotionAuthoring'
import { THRESHOLD_PERIOD } from '../modules/threshold/Cinema2ThresholdLayout'

/**
 * THRESHOLD
 *
 * Hero visual: giant emissive LED monoliths standing in fog, reflected in a wet black floor, seen from a slow, low
 * forward flight. The flight passes through three scenes that repeat endlessly: a corridor of standing towers, a field
 * of hanging monoliths (the camera rises above the mist), and a ring of tilted panels (the camera passes through and
 * looks up). Inspiration: the reference renders of monolith corridors, hanging monoliths in cloud, and the ring hall.
 *
 * Mandatory look: high-contrast near-black scene; large white-blue LED faces; ground mist; wet floor reflections;
 * haze glowing around the screens. Inspirational only: cloud sculpting, floor texture, catwalk/truss detail.
 *
 * Music map (each signal drives a different dimension; see `Cinema2ThresholdReactiveState`):
 *   kick -> support screens pulse          snare -> alternate rows flash        beat -> rows alternate every 2 beats
 *   downbeat -> light sweep down the aisle, camera lean, shaft swell             phrase -> the leading side swaps
 *   build/energy -> how many screens are open, dark to full                      drop -> everything flashes and releases
 *   bass -> fog swell and support weight   highs -> LED shimmer                   vocals -> support screens step back
 * BPM Sync locks the idle breathing, the LED shimmer clock and the sweep speed to the track tempo.
 * Palette roles: Primary (main screens), Accent (support screens), Atmosphere (fog/haze tint), Void (background, floor, bodies).
 */
export const CINEMA2_THRESHOLD_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.threshold')
export const CINEMA2_THRESHOLD_MODULE_ID = cinema2StableId<Cinema2ModuleId>('threshold-monoliths')
const MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('threshold-native-render')
const FLOOR_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('reflective-floor')
const VOLUMETRIC_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('volumetric-atmosphere')
const BLOOM_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('bloom')
const FINISH_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('cinematic-finish')

const parameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`threshold-${name}`)
export const CINEMA2_THRESHOLD_INTENSITY_ID = parameterId('master-intensity')
export const CINEMA2_THRESHOLD_REACTIVITY_ID = parameterId('master-reactivity')
export const CINEMA2_THRESHOLD_BPM_SYNC_ID = parameterId('bpm-sync')
export const CINEMA2_THRESHOLD_CAMERA_MOTION_ID = parameterId('camera-motion')
export const CINEMA2_THRESHOLD_PANEL_BRIGHTNESS_ID = parameterId('panel-brightness')
export const CINEMA2_THRESHOLD_FOG_DENSITY_ID = parameterId('fog-density')
export const CINEMA2_THRESHOLD_CORRIDOR_WIDTH_ID = parameterId('corridor-width')
export const CINEMA2_THRESHOLD_FLOOR_REFLECTION_ID = parameterId('floor-reflection')
export const CINEMA2_THRESHOLD_BLOOM_ID = parameterId('bloom')
export const CINEMA2_THRESHOLD_FINISH_ID = parameterId('cinematic-finish')
export const CINEMA2_THRESHOLD_SHAFTS_ID = parameterId('light-shafts')
export const CINEMA2_THRESHOLD_PRIMARY_COLOR_ID = parameterId('primary-color')
export const CINEMA2_THRESHOLD_ACCENT_COLOR_ID = parameterId('accent-color')
export const CINEMA2_THRESHOLD_ATMOSPHERE_COLOR_ID = parameterId('atmosphere-color')
export const CINEMA2_THRESHOLD_VOID_COLOR_ID = parameterId('void-color')

export const CINEMA2_THRESHOLD_CAMERA_ID = cinema2StableId<Cinema2CameraId>('threshold-flight')
export const CINEMA2_THRESHOLD_FLOOR_EFFECT_ID = cinema2StableId<Cinema2EffectId>('threshold-floor')
export const CINEMA2_THRESHOLD_VOLUMETRIC_EFFECT_ID = cinema2StableId<Cinema2EffectId>('threshold-atmosphere')
export const CINEMA2_THRESHOLD_BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('threshold-bloom')
export const CINEMA2_THRESHOLD_FINISH_EFFECT_ID = cinema2StableId<Cinema2EffectId>('threshold-finish')

const ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('threshold-world-root')
const MODULE_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('threshold-monolith-node')
const WORLD_LAYER_ID = cinema2StableId<Cinema2LayerId>('threshold-world-layer')
const targetId = (name: string) => cinema2StableId<Cinema2RenderTargetId>(`threshold-${name}-target`)
const passId = (name: string) => cinema2StableId<Cinema2RenderPassId>(`threshold-${name}-pass`)
const slotId = (name: string) => cinema2StableId<Cinema2RenderSlotId>(`threshold-${name}`)
const ruleId = (name: string) => cinema2StableId<Cinema2ChoreographyRuleId>(`threshold-${name}`)
const actionId = (name: string) => cinema2StableId<Cinema2ChoreographyActionId>(`threshold-${name}`)

/** One lap of the flight is one repeat of the environment: the camera flies this far, then continues into the next copy. */
const LAP_LENGTH = THRESHOLD_PERIOD
/** About 2.25 world units per second: slow, low and forward. */
const LAP_SECONDS = 96

function vec3(x: number, y: number, z: number): Cinema2Vector3 { return Object.freeze([x, y, z]) }
function color(r: number, g: number, b: number, a = 1): Cinema2Color { return Object.freeze([r, g, b, a]) }

const DEFAULT_PRIMARY = color(0.97, 0.985, 1)
const DEFAULT_ACCENT = color(0.42, 0.68, 1)
const DEFAULT_ATMOSPHERE = color(0.44, 0.5, 0.6)
const DEFAULT_VOID = color(0.014, 0.016, 0.02)

function base(
  id: Cinema2ParameterId,
  label: string,
  description: string,
  parent: Cinema2DesignParentGroup,
  order: number,
  group?: string,
) {
  return {
    id,
    label,
    description,
    section: 'Design',
    ...(group ? { group } : {}),
    designParentGroup: parent,
    order,
    exposure: 'primary' as const,
    modulatable: false,
    choreographable: false,
    automatable: false,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  }
}

const floatParameter = (
  id: Cinema2ParameterId, label: string, description: string, parent: Cinema2DesignParentGroup, order: number,
  defaultValue: number, min: number, max: number, step: number, group?: string,
) => Object.freeze({ ...base(id, label, description, parent, order, group), type: 'float' as const, defaultValue, min, max, step })

const colorParameter = (
  id: Cinema2ParameterId, label: string, description: string, order: number, defaultValue: Cinema2Color,
) => Object.freeze({ ...base(id, label, description, 'palette', order), type: 'color' as const, defaultValue })

const effect = (
  id: Cinema2EffectId,
  typeId: Cinema2EffectTypeId,
  order: number,
  parameters: Record<string, unknown>,
  parameterBindings: Record<string, Cinema2ParameterId>,
) => Object.freeze({
  id,
  typeId,
  version: 1,
  enabled: true,
  order,
  scope: 'output' as const,
  parameters: Object.freeze(parameters) as Readonly<Record<string, never>>,
  parameterBindings: Object.freeze(Object.fromEntries(Object.entries(parameterBindings).map(([property, id]) => [property, cinema2Ref(id)]))),
})

const effectTarget = (id: Cinema2EffectId, property: string) => Object.freeze({ kind: 'effect' as const, ref: cinema2Ref(id), property })

const envelopeAction = (name: string, id: Cinema2EffectId, property: string, value: number, attack: number, hold: number, release: number) => Object.freeze({
  id: actionId(name),
  target: effectTarget(id, property),
  operation: 'envelope' as const,
  composition: 'add' as const,
  value,
  envelope: Object.freeze({ attack, hold, release, unit: 'beats' as const }),
  retrigger: 'restart' as const,
})

/**
 * The flight for one lap: dead centre and low down the corridor with a slight upward look, up over the mist through the
 * hanging field (the only place with any lateral sway), into the ring looking up, then back down into the corridor.
 * The lap is `THRESHOLD_PERIOD` long and `repeatOffset` continues it into the next copy of the environment.
 */
function flightPoints() {
  const point = (distance: number, x: number, y: number, targetY: number, fovDegrees?: number) => Object.freeze({
    position: vec3(x, y, -distance),
    target: vec3(0, targetY, -(distance + 40)),
    ...(fovDegrees ? { fovDegrees } : {}),
  })
  return Object.freeze([
    point(0, 0, 1.3, 4),
    point(40, 0, 1.3, 4),
    point(80, 0, 1.3, 4.5),
    point(104, 0, 2.2, 6, 70),
    point(122, -1, 5, 7, 72),
    point(138, 1, 6.5, 7, 72),
    point(154, 0, 4.5, 6, 70),
    point(170, 0, 2.5, 9, 70),
    point(188, 0, 1.8, 6, 68),
    point(204, 0, 1.4, 4, 68),
  ])
}

export const CINEMA2_THRESHOLD_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_THRESHOLD_PRESET_ID,
  revision: 1,
  metadata: Object.freeze({
    name: 'Threshold',
    description: 'Giant LED monoliths in fog over a wet black floor. A slow, low flight through a corridor, a field of hanging monoliths and a ring, reacting to the music.',
    tags: Object.freeze(['stage', 'monolith', 'led', 'atmosphere', 'volumetric']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native Cinema 2.0 Stage rendering.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Depth-tested monoliths, floor reflections and depth-aware fog.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'World-space monolith environment.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Shared final camera for the flight and for view-ray fog and reflections.' }),
    Object.freeze({ id: 'audio.bands' as const, requirement: 'optional' as const, purpose: 'Bass swells the fog.' }),
    Object.freeze({ id: 'audio.features' as const, requirement: 'optional' as const, purpose: 'Energy, build, highs and vocal presence drive the screens.' }),
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'Rows alternate every two beats.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Downbeat sweep, camera lean and shaft swell.' }),
    Object.freeze({ id: 'music.rhythm-events' as const, requirement: 'optional' as const, purpose: 'Kick pulses the support screens; snare flashes alternate rows.' }),
    Object.freeze({ id: 'music.phrase' as const, requirement: 'optional' as const, purpose: 'Phrases swap the leading side.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'Drops flash the whole set and bloom.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'Build lifts shafts; impact gates the downbeat sweep.' }),
  ]),
  parameters: Object.freeze([
    CINEMA2_QUALITY_MODE_PARAMETER,
    // Master Controls
    floatParameter(CINEMA2_THRESHOLD_INTENSITY_ID, 'Master Intensity', 'Overall strength of the screens, fog and glow, including every music response.', 'master-controls', 1, 1, 0, 1, 0.01),
    floatParameter(CINEMA2_THRESHOLD_REACTIVITY_ID, 'Master Reactivity', 'How strongly the set follows the music. At 0 the screens hold their idle look.', 'master-controls', 2, 0.8, 0, 1, 0.01),
    Object.freeze({
      ...base(CINEMA2_THRESHOLD_BPM_SYNC_ID, 'BPM Sync', 'Locks the idle breathing, LED shimmer and light-sweep speed to the track tempo.', 'master-controls', 3),
      type: 'boolean' as const,
      defaultValue: true,
    }),
    floatParameter(CINEMA2_THRESHOLD_CAMERA_MOTION_ID, 'Camera Motion', 'Handheld drift and banking of the flight camera (0 = locked off).', 'master-controls', 4, 1, 0, 1.5, 0.05),
    // Design
    floatParameter(CINEMA2_THRESHOLD_PANEL_BRIGHTNESS_ID, 'Panel Brightness', 'Resting brightness of the LED screens before the music adds to it.', 'design', 1, 0.7, 0, 1, 0.01, 'Screens'),
    floatParameter(CINEMA2_THRESHOLD_FOG_DENSITY_ID, 'Fog Density', 'How thick the haze is between you and the monoliths.', 'design', 2, 0.006, 0, 0.05, 0.001, 'Atmosphere'),
    floatParameter(CINEMA2_THRESHOLD_CORRIDOR_WIDTH_ID, 'Corridor Width', 'Distance between the two rows of monoliths in the corridor.', 'design', 3, 1, 0.6, 1.6, 0.01, 'Layout'),
    // Effects
    floatParameter(CINEMA2_THRESHOLD_FLOOR_REFLECTION_ID, 'Floor Reflection', 'How mirror-like the wet floor is.', 'effects', 1, 0.75, 0, 1, 0.01),
    floatParameter(CINEMA2_THRESHOLD_BLOOM_ID, 'Bloom', 'Glow around the bright screens.', 'effects', 2, 1, 0, 3, 0.05),
    floatParameter(CINEMA2_THRESHOLD_SHAFTS_ID, 'Light Shafts', 'Rays radiating from the screens through the haze.', 'effects', 3, 0.12, 0, 1, 0.01),
    floatParameter(CINEMA2_THRESHOLD_FINISH_ID, 'Cinematic Finish', 'Filmic tone curve, grade, vignette, fringing and grain.', 'effects', 4, 1, 0, 1, 0.01),
    // Palette
    colorParameter(CINEMA2_THRESHOLD_PRIMARY_COLOR_ID, 'Primary', 'Color of the main LED screens.', 1, DEFAULT_PRIMARY),
    colorParameter(CINEMA2_THRESHOLD_ACCENT_COLOR_ID, 'Accent', 'Color of the support LED screens.', 2, DEFAULT_ACCENT),
    colorParameter(CINEMA2_THRESHOLD_ATMOSPHERE_COLOR_ID, 'Atmosphere', 'Subtle color of the haze, fog and light shafts.', 3, DEFAULT_ATMOSPHERE),
    colorParameter(CINEMA2_THRESHOLD_VOID_COLOR_ID, 'Void', 'Background, floor and monolith body color.', 4, DEFAULT_VOID),
  ]),
  modules: Object.freeze([
    Object.freeze({
      id: CINEMA2_THRESHOLD_MODULE_ID,
      typeId: MODULE_TYPE_ID,
      version: 1,
      enabled: true,
      parameters: Object.freeze({
        intensity: 1,
        reactivity: 0.8,
        bpmSync: true,
        panelBrightness: 0.7,
        fogDensity: 0.006,
        corridorWidth: 1,
        primaryColor: DEFAULT_PRIMARY,
        accentColor: DEFAULT_ACCENT,
        atmosphereColor: DEFAULT_ATMOSPHERE,
        voidColor: DEFAULT_VOID,
      }),
      parameterBindings: Object.freeze({
        intensity: cinema2Ref(CINEMA2_THRESHOLD_INTENSITY_ID),
        reactivity: cinema2Ref(CINEMA2_THRESHOLD_REACTIVITY_ID),
        bpmSync: cinema2Ref(CINEMA2_THRESHOLD_BPM_SYNC_ID),
        panelBrightness: cinema2Ref(CINEMA2_THRESHOLD_PANEL_BRIGHTNESS_ID),
        fogDensity: cinema2Ref(CINEMA2_THRESHOLD_FOG_DENSITY_ID),
        corridorWidth: cinema2Ref(CINEMA2_THRESHOLD_CORRIDOR_WIDTH_ID),
        primaryColor: cinema2Ref(CINEMA2_THRESHOLD_PRIMARY_COLOR_ID),
        accentColor: cinema2Ref(CINEMA2_THRESHOLD_ACCENT_COLOR_ID),
        atmosphereColor: cinema2Ref(CINEMA2_THRESHOLD_ATMOSPHERE_COLOR_ID),
        voidColor: cinema2Ref(CINEMA2_THRESHOLD_VOID_COLOR_ID),
      }),
      config: Object.freeze({ seed: 1337 }),
    }),
  ]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
      Object.freeze({ id: MODULE_NODE_ID, kind: 'module' as const, parent: cinema2Ref(ROOT_NODE_ID), module: cinema2Ref(CINEMA2_THRESHOLD_MODULE_ID) }),
    ]),
    roots: Object.freeze([cinema2Ref(ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([
    Object.freeze({
      id: WORLD_LAYER_ID,
      label: 'Threshold World',
      source: cinema2Ref(ROOT_NODE_ID),
      role: 'world',
      depthPolicy: 'read-write' as const,
      order: 0,
    }),
  ]),
  cameras: Object.freeze([
    Object.freeze({
      id: CINEMA2_THRESHOLD_CAMERA_ID,
      label: 'Threshold Flight',
      projection: 'perspective' as const,
      fovDegrees: 68,
      near: 0.3,
      far: 380,
      target: vec3(0, 4, -40),
      rig: Object.freeze({
        kind: 'fly' as const,
        points: flightPoints(),
        durationSeconds: LAP_SECONDS,
        loop: true,
        repeatOffset: vec3(0, 0, -LAP_LENGTH),
      }),
      motion: cinema2CinematicMotion('steady', { splinePath: true }),
      controls: Object.freeze({ motionAmount: cinema2Ref(CINEMA2_THRESHOLD_CAMERA_MOTION_ID) }),
    }),
  ]),
  environment: Object.freeze({
    backgroundColor: DEFAULT_VOID,
    exposure: 1,
    controls: Object.freeze({ backgroundColor: cinema2Ref(CINEMA2_THRESHOLD_VOID_COLOR_ID) }),
  }),
  effects: Object.freeze([
    effect(CINEMA2_THRESHOLD_FLOOR_EFFECT_ID, FLOOR_EFFECT_TYPE_ID, 0, {
      mix: 1,
      floorY: 0,
      baseColor: DEFAULT_VOID,
      skyColor: DEFAULT_VOID,
      reflectivity: 0.75,
      roughness: 0.3,
      fresnel: 3,
      albedo: 0.05,
      poolIntensity: 0,
      specular: 0,
      fadeDistance: 160,
      maxReflection: 60,
      thickness: 2.5,
      // Wet, cracked concrete rather than a perfect mirror: damp patches, rippled reflections, dark cracks.
      grit: 0.8,
      gritScale: 5,
      baseLift: 3.5,
    }, {
      reflectivity: CINEMA2_THRESHOLD_FLOOR_REFLECTION_ID,
      baseColor: CINEMA2_THRESHOLD_VOID_COLOR_ID,
      skyColor: CINEMA2_THRESHOLD_VOID_COLOR_ID,
    }),
    effect(CINEMA2_THRESHOLD_VOLUMETRIC_EFFECT_ID, VOLUMETRIC_EFFECT_TYPE_ID, 1, {
      mix: 1,
      density: 0.006,
      beamIntensity: 1,
      mistAmount: 0.11,
      mistHeight: 3.6,
      mistFloor: 0,
      floorY: 0,
      floorReflection: 0,
      anisotropy: 0.3,
      occlusion: 0.5,
      ambientHaze: 1.1,
      ambientHeight: 7,
      hazeColor: DEFAULT_ATMOSPHERE,
      noiseScale: 0.07,
      noiseStrength: 0.9,
      drift: 0.08,
      maxDistance: 170,
      shafts: 0.26,
      shaftOriginX: 0.5,
      shaftOriginY: 0.44,
      shaftLength: 0.55,
      reactivity: 0,
    }, {
      mix: CINEMA2_THRESHOLD_INTENSITY_ID,
      density: CINEMA2_THRESHOLD_FOG_DENSITY_ID,
      hazeColor: CINEMA2_THRESHOLD_ATMOSPHERE_COLOR_ID,
      shafts: CINEMA2_THRESHOLD_SHAFTS_ID,
    }),
    effect(CINEMA2_THRESHOLD_BLOOM_EFFECT_ID, BLOOM_EFFECT_TYPE_ID, 2, {
      mix: 1, threshold: 0.55, radius: 2, intensity: 1,
    }, {
      mix: CINEMA2_THRESHOLD_INTENSITY_ID,
      intensity: CINEMA2_THRESHOLD_BLOOM_ID,
    }),
    effect(CINEMA2_THRESHOLD_FINISH_EFFECT_ID, FINISH_EFFECT_TYPE_ID, 3, {
      mix: 1,
      // No tone curve: a filmic curve compresses pure white to grey, and these screens are meant to be pure white.
      toneMap: 0,
      exposure: 1,
      contrast: 1.1,
      saturation: 0.55,
      vignette: 0.2,
      vignetteSoftness: 0.7,
      grain: 0.025,
      aberration: 0.04,
      tintAmount: 0.22,
      shadowTint: color(0.42, 0.48, 0.6),
      highlightTint: color(0.5, 0.5, 0.5),
    }, {
      mix: CINEMA2_THRESHOLD_FINISH_ID,
    }),
  ]),
  choreography: Object.freeze({
    rules: Object.freeze([
      Object.freeze({
        id: ruleId('downbeat'),
        priority: 40,
        strengthParameter: cinema2Ref(CINEMA2_THRESHOLD_REACTIVITY_ID),
        source: Object.freeze({ signal: 'downbeat' as const, capability: 'music.downbeat' as const }),
        conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([
          envelopeAction('downbeat-shafts', CINEMA2_THRESHOLD_VOLUMETRIC_EFFECT_ID, 'shafts', 0.45, 0, 0.1, 1.6),
          envelopeAction('downbeat-bloom', CINEMA2_THRESHOLD_BLOOM_EFFECT_ID, 'intensity', 0.5, 0, 0.1, 1.2),
          Object.freeze({
            id: actionId('downbeat-lean'),
            target: Object.freeze({ kind: 'camera' as const, ref: cinema2Ref(CINEMA2_THRESHOLD_CAMERA_ID), property: 'roll' }),
            operation: 'envelope' as const,
            composition: 'add' as const,
            value: 1,
            envelope: Object.freeze({ attack: 0.3, hold: 0, release: 1.4, unit: 'beats' as const }),
            retrigger: 'restart' as const,
          }),
        ]),
      }),
      Object.freeze({
        id: ruleId('kick'),
        priority: 35,
        strengthParameter: cinema2Ref(CINEMA2_THRESHOLD_REACTIVITY_ID),
        source: Object.freeze({ signal: 'kick' as const, capability: 'music.rhythm-events' as const }),
        conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([envelopeAction('kick-bloom', CINEMA2_THRESHOLD_BLOOM_EFFECT_ID, 'intensity', 0.25, 0, 0, 0.5)]),
      }),
      Object.freeze({
        id: ruleId('bass-fog'),
        priority: 20,
        strengthParameter: cinema2Ref(CINEMA2_THRESHOLD_REACTIVITY_ID),
        source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.bands' as const, path: 'audio.bands.bass' as const, smoothingMs: 220 }),
        actions: Object.freeze([Object.freeze({
          id: actionId('bass-fog-density'),
          target: effectTarget(CINEMA2_THRESHOLD_VOLUMETRIC_EFFECT_ID, 'density'),
          operation: 'add' as const,
          value: 0.012,
        })]),
      }),
      Object.freeze({
        id: ruleId('build-shafts'),
        priority: 20,
        strengthParameter: cinema2Ref(CINEMA2_THRESHOLD_REACTIVITY_ID),
        source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 400 }),
        actions: Object.freeze([Object.freeze({
          id: actionId('build-shafts-lift'),
          target: effectTarget(CINEMA2_THRESHOLD_VOLUMETRIC_EFFECT_ID, 'shafts'),
          operation: 'add' as const,
          value: 0.35,
        })]),
      }),
      Object.freeze({
        id: ruleId('drop'),
        priority: 50,
        strengthParameter: cinema2Ref(CINEMA2_THRESHOLD_REACTIVITY_ID),
        source: Object.freeze({ signal: 'drop' as const, capability: 'music.drop' as const }),
        conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]),
        actions: Object.freeze([
          envelopeAction('drop-bloom', CINEMA2_THRESHOLD_BLOOM_EFFECT_ID, 'intensity', 1.1, 0, 0.25, 2),
          envelopeAction('drop-shafts', CINEMA2_THRESHOLD_VOLUMETRIC_EFFECT_ID, 'shafts', 0.5, 0, 0.25, 2.5),
        ]),
      }),
    ]),
  }),
  render: Object.freeze({
    targets: Object.freeze([
      Object.freeze({
        id: targetId('scene'),
        descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba8' as const, depthFormat: 'depth24' as const }),
        ownership: 'transient' as const,
      }),
      ...['floor', 'atmosphere', 'bloom'].map(name => Object.freeze({
        id: targetId(name),
        descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba8' as const }),
        ownership: 'transient' as const,
      })),
    ]),
    passes: Object.freeze([
      Object.freeze({
        id: passId('scene'),
        kind: 'scene' as const,
        layers: Object.freeze([cinema2Ref(WORLD_LAYER_ID)]),
        outputs: Object.freeze([
          Object.freeze({ id: slotId('scene-color'), target: cinema2Ref(targetId('scene')), attachment: 'color' as const }),
          Object.freeze({ id: slotId('scene-depth'), target: cinema2Ref(targetId('scene')), attachment: 'depth' as const }),
        ]),
      }),
      Object.freeze({
        id: passId('floor'),
        kind: 'fullscreen' as const,
        dependsOn: Object.freeze([cinema2Ref(passId('scene'))]),
        effect: cinema2Ref(CINEMA2_THRESHOLD_FLOOR_EFFECT_ID),
        inputs: Object.freeze([
          Object.freeze({ id: slotId('floor-color'), source: Object.freeze({ pass: cinema2Ref(passId('scene')), output: slotId('scene-color') }), attachment: 'color' as const }),
          Object.freeze({ id: slotId('floor-depth'), source: Object.freeze({ pass: cinema2Ref(passId('scene')), output: slotId('scene-depth') }), attachment: 'depth' as const }),
        ]),
        outputs: Object.freeze([Object.freeze({ id: slotId('floor-output'), target: cinema2Ref(targetId('floor')), attachment: 'color' as const })]),
      }),
      Object.freeze({
        id: passId('atmosphere'),
        kind: 'fullscreen' as const,
        dependsOn: Object.freeze([cinema2Ref(passId('floor'))]),
        effect: cinema2Ref(CINEMA2_THRESHOLD_VOLUMETRIC_EFFECT_ID),
        inputs: Object.freeze([
          Object.freeze({ id: slotId('atmosphere-color'), source: Object.freeze({ pass: cinema2Ref(passId('floor')), output: slotId('floor-output') }), attachment: 'color' as const }),
          Object.freeze({ id: slotId('atmosphere-depth'), source: Object.freeze({ pass: cinema2Ref(passId('scene')), output: slotId('scene-depth') }), attachment: 'depth' as const }),
        ]),
        outputs: Object.freeze([Object.freeze({ id: slotId('atmosphere-output'), target: cinema2Ref(targetId('atmosphere')), attachment: 'color' as const })]),
      }),
      Object.freeze({
        id: passId('bloom'),
        kind: 'fullscreen' as const,
        dependsOn: Object.freeze([cinema2Ref(passId('atmosphere'))]),
        effect: cinema2Ref(CINEMA2_THRESHOLD_BLOOM_EFFECT_ID),
        inputs: Object.freeze([
          Object.freeze({ id: slotId('bloom-input'), source: Object.freeze({ pass: cinema2Ref(passId('atmosphere')), output: slotId('atmosphere-output') }), attachment: 'color' as const }),
        ]),
        outputs: Object.freeze([Object.freeze({ id: slotId('bloom-output'), target: cinema2Ref(targetId('bloom')), attachment: 'color' as const })]),
      }),
      Object.freeze({
        id: passId('finish'),
        kind: 'fullscreen' as const,
        dependsOn: Object.freeze([cinema2Ref(passId('bloom'))]),
        effect: cinema2Ref(CINEMA2_THRESHOLD_FINISH_EFFECT_ID),
        inputs: Object.freeze([
          Object.freeze({ id: slotId('finish-input'), source: Object.freeze({ pass: cinema2Ref(passId('bloom')), output: slotId('bloom-output') }), attachment: 'color' as const }),
        ]),
      }),
    ]),
    outputPass: cinema2Ref(passId('finish')),
  }),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_THRESHOLD_CAMERA_ID) }),
  output: Object.freeze({ renderPass: cinema2Ref(passId('finish')), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
})
