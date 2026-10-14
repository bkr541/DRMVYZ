import { cinema2NamespacedId, cinema2Ref, cinema2StableId, type Cinema2CameraId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyRuleId, type Cinema2LightId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2PresetId, type Cinema2SceneNodeId, type Cinema2Vector3 } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_SIXFOLD_NATIVE_MODULE_TYPE_ID, CINEMA2_SIXFOLD_PATTERNS } from '../modules/Cinema2SixfoldNativeModule'
import { CINEMA2_CONSTELLATION_PRESET_ID, CINEMA2_CONSTELLATION_PRESET_MANIFEST } from './Cinema2ConstellationPreset'

export const CINEMA2_SIXFOLD_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.sixfold')
export const CINEMA2_SIXFOLD_MODULE_ID = cinema2StableId<Cinema2ModuleId>('sixfold-system')
export const CINEMA2_SIXFOLD_PATTERN_ID = cinema2StableId<Cinema2ParameterId>('sixfold-look')
export const CINEMA2_SIXFOLD_PATTERN_CHANGE_ID = cinema2StableId<Cinema2ParameterId>('sixfold-pattern-change')
export const CINEMA2_SIXFOLD_TRIGGER_ID = cinema2StableId<Cinema2ParameterId>('sixfold-trigger')
export const CINEMA2_SIXFOLD_MASTER_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('sixfold-intensity')
export const CINEMA2_SIXFOLD_AUTO_PERFORMANCE_ID = cinema2StableId<Cinema2ParameterId>('sixfold-auto-performance')
export const CINEMA2_SIXFOLD_BPM_SYNC_ID = cinema2StableId<Cinema2ParameterId>('sixfold-bpm-sync')
export const CINEMA2_SIXFOLD_CAMERA_ID = cinema2StableId<Cinema2CameraId>('sixfold-camera')

const ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('sixfold-root')
const KEY_TARGET_ID = cinema2StableId<Cinema2SceneNodeId>('sixfold-key-target')
const RIM_TARGET_ID = cinema2StableId<Cinema2SceneNodeId>('sixfold-rim-target')
const KEY_LIGHT_ID = cinema2StableId<Cinema2LightId>('sixfold-key-light')
const RIM_LIGHT_ID = cinema2StableId<Cinema2LightId>('sixfold-rim-light')
const FILL_LIGHT_ID = cinema2StableId<Cinema2LightId>('sixfold-fill-light')
const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('sixfold-ambient-light')
const vec3 = (x: number, y: number, z: number): Cinema2Vector3 => Object.freeze([x, y, z])
const STRUCTURAL_METAL = Object.freeze([0.08, 0.16, 0.24, 1] as const)
const MIRROR_FACETS = Object.freeze([0.16, 0.2, 0.58, 1] as const)
const ILLUMINATION = Object.freeze([0.02, 0.62, 0.92, 1] as const)
const IRIS_CORE = Object.freeze([0.72, 0.94, 1, 1] as const)

const PATTERN_LABELS = Object.freeze({
  facetRelay: 'Phase Cascade',
  hexBloom: 'Harmonic Expansion',
  spiralDescent: 'Recursive Descent',
  splitPrism: 'Mirror Fold',
  coreImplosion: 'Singularity',
  chamberPulse: 'Lockstep',
} as const)

function rewrite(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value === CINEMA2_CONSTELLATION_PRESET_ID) return CINEMA2_SIXFOLD_PRESET_ID
    if (value === 'constellation-native') return CINEMA2_SIXFOLD_NATIVE_MODULE_TYPE_ID
    if (value === 'constellation-system') return CINEMA2_SIXFOLD_MODULE_ID
    return value.split('constellation-').join('sixfold-').split('Constellation').join('Sixfold').split('constellation').join('sixfold')
  }
  if (Array.isArray(value)) return Object.freeze(value.map(rewrite))
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, rewrite(entry)])))
  return value
}

const derived = rewrite(CINEMA2_CONSTELLATION_PRESET_MANIFEST) as Cinema2NativePresetManifest
const labelOverrides: Readonly<Record<string, readonly [string, string]>> = Object.freeze({
  'sixfold-node-density': ['Mechanical Detail', 'Controls quality-bounded rails, fasteners and chamber articulation.'],
  'sixfold-spread': ['Chamber Radius', 'Expands or compresses the overall six-way chamber architecture.'],
  'sixfold-depth': ['Chamber Depth', 'Controls the front-to-back separation of the five nested portals.'],
  'sixfold-node-scale': ['Mirror Facet Scale', 'Controls the size of the six articulated mirror assemblies.'],
  'sixfold-variation': ['Perspective Reveal', 'Turns the chamber slightly off-axis to reveal frame thickness and recursive depth.'],
  'sixfold-collapse': ['Resting Fold', 'Sets the resting articulation angle of the mirror and locking mechanisms.'],
  'sixfold-burst': ['Chamber Travel', 'Sets the available radial and depth travel for choreography.'],
  'sixfold-drift': ['Mechanical Drift', 'Sets the bounded idle movement of the chamber mechanisms.'],
  'sixfold-spin': ['Chamber Rotation', 'Controls the rotation of the sixfold mechanism.'],
  'sixfold-edge-glow': ['Light Rail Intensity', 'Controls embedded illumination around the recursive frames.'],
  'sixfold-internal-glow': ['Iris Intensity', 'Controls the central optical aperture illumination.'],
  'sixfold-stars': ['Fine Detail', 'Controls quality-bounded fasteners, gear teeth and cross braces.'],
  'sixfold-primary': ['Structural Metal', 'Controls the gunmetal chamber structure and support rails.'],
  'sixfold-secondary': ['Mirror Facets', 'Controls the six articulated optical panels.'],
  'sixfold-accent': ['Illumination', 'Controls recessed light rails and mechanical indicators.'],
  'sixfold-highlight': ['Iris / Core', 'Controls the central aperture, bearings and hardware highlights.'],
})

const parameters = Object.freeze((derived.parameters ?? []).map(parameter => {
  if (parameter.id === CINEMA2_SIXFOLD_PATTERN_ID) {
    return Object.freeze({
      ...parameter,
      label: 'Pattern',
      description: 'Selects one of six authored chamber choreographies. Choosing a pattern turns Auto Performance off.',
      defaultValue: 'facetRelay',
      metadata: Object.freeze({ userEditSetParameters: Object.freeze({ [CINEMA2_SIXFOLD_AUTO_PERFORMANCE_ID]: false }) }),
      options: Object.freeze(CINEMA2_SIXFOLD_PATTERNS.map(value => Object.freeze({ value, label: PATTERN_LABELS[value] }))),
    })
  }
  const override = labelOverrides[parameter.id]
  const paletteDefault = parameter.id === 'sixfold-primary' ? STRUCTURAL_METAL
    : parameter.id === 'sixfold-secondary' ? MIRROR_FACETS
      : parameter.id === 'sixfold-accent' ? ILLUMINATION
        : parameter.id === 'sixfold-highlight' ? IRIS_CORE
          : undefined
  return override || paletteDefault
    ? Object.freeze({ ...parameter, ...(override ? { label: override[0], description: override[1] } : {}), ...(paletteDefault ? { defaultValue: paletteDefault } : {}) })
    : parameter
}))

const modules = Object.freeze((derived.modules ?? []).map(module => Object.freeze({
  ...module,
  typeId: CINEMA2_SIXFOLD_NATIVE_MODULE_TYPE_ID,
  parameters: Object.freeze({
    ...module.parameters,
    look: 'facetRelay',
    primaryColor: STRUCTURAL_METAL,
    secondaryColor: MIRROR_FACETS,
    accentColor: ILLUMINATION,
    highlightColor: IRIS_CORE,
    midAmount: 0,
    vocalPresence: 0,
  }),
})))

// Auto Performance owns program selection, not whether the chamber hears the
// track. Manual pattern choice therefore keeps every continuous/event lane live.
const choreographyRuleId = (name: string) => cinema2StableId<Cinema2ChoreographyRuleId>(`sixfold-${name}-rule`)
const choreographyActionId = (name: string) => cinema2StableId<Cinema2ChoreographyActionId>(`sixfold-${name}-action`)
const semanticContinuousRule = (
  name: string,
  capability: 'audio.features' | 'music.vocal-presence',
  path: 'audio.bands.mid' | 'audio.features.vocalPresence',
  property: 'midAmount' | 'vocalPresence',
  smoothingMs: number,
) => Object.freeze({
  id: choreographyRuleId(name),
  priority: 14,
  source: Object.freeze({ signal: 'continuous' as const, capability, path, smoothingMs }),
  actions: Object.freeze([Object.freeze({
    id: choreographyActionId(name),
    target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_SIXFOLD_MODULE_ID), property }),
    operation: 'replace' as const,
    value: 1,
  })]),
})

const choreography = derived.choreography ? Object.freeze({
  ...derived.choreography,
  rules: Object.freeze([
    ...derived.choreography.rules.map(rule => {
      const { enabledParameter: _autoPerformanceGate, ...audioReactiveRule } = rule
      return Object.freeze(audioReactiveRule)
    }),
    semanticContinuousRule('mid-mechanisms', 'audio.features', 'audio.bands.mid', 'midAmount', 110),
    semanticContinuousRule('vocal-restraint', 'music.vocal-presence', 'audio.features.vocalPresence', 'vocalPresence', 180),
  ]),
}) : undefined

const scene = derived.scene ? Object.freeze({
  ...derived.scene,
  nodes: Object.freeze([
    ...derived.scene.nodes,
    Object.freeze({ id: KEY_TARGET_ID, kind: 'group' as const, parent: cinema2Ref(ROOT_NODE_ID), transform: Object.freeze({ position: vec3(0, 0, -2.1) }) }),
    Object.freeze({ id: RIM_TARGET_ID, kind: 'group' as const, parent: cinema2Ref(ROOT_NODE_ID), transform: Object.freeze({ position: vec3(0, 0, -3.6) }) }),
  ]),
}) : undefined

const cameras = Object.freeze([Object.freeze({
  id: CINEMA2_SIXFOLD_CAMERA_ID,
  label: 'Sixfold Honeycomb Hero',
  projection: 'perspective' as const,
  fovDegrees: 43,
  minAspect: 16 / 9,
  near: 0.08,
  far: 90,
  transform: Object.freeze({ position: vec3(0, 0.3, 27.3) }),
  target: vec3(0, 0, -2.15),
  rig: Object.freeze({ kind: 'static' as const }),
  motion: Object.freeze({
    drift: Object.freeze({ position: 0.08, target: 0.025, rollDegrees: 0.12, fovDegrees: 0.28, speed: 0.045, seed: 6106 }),
    tempo: Object.freeze({ referenceBpm: 120, weave: 0.05, bob: 0.008, roll: 0.003, fov: 0.22, punch: 0.012 }),
  }),
  controls: Object.freeze({
    motionSafety: cinema2Ref(cinema2StableId<Cinema2ParameterId>('sixfold-motion-safety')),
    tempoSync: cinema2Ref(CINEMA2_SIXFOLD_BPM_SYNC_ID),
  }),
  smoothingMs: 170,
  safety: Object.freeze({
    minPosition: vec3(-2.2, -1.4, 24), maxPosition: vec3(2.2, 1.8, 31),
    maxPositionOffset: vec3(0.7, 0.48, 0.9), maxTargetOffset: vec3(0.35, 0.3, 0.5),
    minFovDegrees: 39, maxFovDegrees: 48, minNear: 0.05, maxFar: 100,
  }),
})])

const lighting = Object.freeze({
  lights: Object.freeze([
    Object.freeze({
      id: KEY_LIGHT_ID, type: 'spot' as const, color: Object.freeze([0.84, 0.94, 1, 1] as const), intensity: 0.72,
      transform: Object.freeze({ position: vec3(-10.5, 11.2, 16.5) }), targetNode: cinema2Ref(KEY_TARGET_ID),
      config: Object.freeze({ coneAngleDegrees: 42, penumbra: 0.62, range: 48, threeShadow: true }),
    }),
    Object.freeze({
      id: RIM_LIGHT_ID, type: 'spot' as const, color: Object.freeze([0.38, 0.32, 1, 1] as const), intensity: 0.34,
      transform: Object.freeze({ position: vec3(11.8, 6.4, 10.5) }), targetNode: cinema2Ref(RIM_TARGET_ID),
      config: Object.freeze({ coneAngleDegrees: 48, penumbra: 0.72, range: 46, threeShadow: true }),
    }),
    Object.freeze({ id: FILL_LIGHT_ID, type: 'directional' as const, color: Object.freeze([0.24, 0.54, 0.72, 1] as const), intensity: 0.11, transform: Object.freeze({ rotation: vec3(-22, -28, 0) }) }),
    Object.freeze({ id: AMBIENT_LIGHT_ID, type: 'ambient' as const, color: Object.freeze([0.32, 0.39, 0.52, 1] as const), intensity: 0.055 }),
  ]),
})

/**
 * SIXFOLD: a native Cinema 2.0 successor to legacy Sixfold Chamber. It retains
 * six-way readability and five nested chambers, but replaces the locked mirror
 * shader with six independent Three.js architectural instruments and the full
 * shared Audio Intelligence vocabulary used by Mainframe and Conduit.
 */
export const CINEMA2_SIXFOLD_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  ...derived,
  revision: 2,
  metadata: Object.freeze({
    name: 'Sixfold',
    description: 'A seven-cell recursive mirror chamber built from an edge-sharing hexagonal field, a twelve-blade optical iris, six articulated mirror carriers, concentric mechanisms, segmented LED architecture and structural locking systems.',
    tags: Object.freeze(['keeper', 'sixfold', '3d', 'three-js', 'architecture', 'honeycomb', 'mirror', 'mechanical', 'audio-reactive', 'choreography']),
    metadata: Object.freeze({ legacySources: Object.freeze(['preset-sixfold-chamber']) }),
  }),
  parameters,
  capabilities: Object.freeze([
    ...(derived.capabilities ?? []),
    Object.freeze({ id: 'music.vocal-presence' as const, requirement: 'optional' as const, purpose: 'Vocal presence restrains mechanical travel so lyrical sections remain visually legible.' }),
  ]),
  modules,
  scene,
  cameras,
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_SIXFOLD_CAMERA_ID) }),
  lighting,
  choreography,
})
