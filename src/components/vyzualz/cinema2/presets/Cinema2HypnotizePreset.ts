import {
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleId,
  type Cinema2Color,
  type Cinema2LightId,
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2SceneNodeId,
  type Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_HYPNOTIZE_NATIVE_MODULE_TYPE_ID, CINEMA2_HYPNOTIZE_PATTERNS } from '../modules/Cinema2HypnotizeNativeModule'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { CINEMA2_CONSTELLATION_PRESET_ID, CINEMA2_CONSTELLATION_PRESET_MANIFEST } from './Cinema2ConstellationPreset'

export const CINEMA2_HYPNOTIZE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.hypnotize')
export const CINEMA2_HYPNOTIZE_MODULE_ID = cinema2StableId<Cinema2ModuleId>('hypnotize-system')
export const CINEMA2_HYPNOTIZE_CAMERA_ID = cinema2StableId<Cinema2CameraId>('hypnotize-camera')
const pid = (name: string) => cinema2StableId<Cinema2ParameterId>(`hypnotize-${name}`)
export const CINEMA2_HYPNOTIZE_INTENSITY_ID = pid('intensity')
export const CINEMA2_HYPNOTIZE_REACTIVITY_ID = pid('reactivity')
export const CINEMA2_HYPNOTIZE_AUTO_PERFORMANCE_ID = pid('auto-performance')
export const CINEMA2_HYPNOTIZE_BPM_SYNC_ID = pid('bpm-sync')
export const CINEMA2_HYPNOTIZE_PATTERN_ID = pid('look')
export const CINEMA2_HYPNOTIZE_PATTERN_CHANGE_ID = pid('pattern-change')
export const CINEMA2_HYPNOTIZE_TRIGGER_ID = pid('trigger')
export const CINEMA2_HYPNOTIZE_SPECTRUM_ID = pid('spectrum')
export const CINEMA2_HYPNOTIZE_COUNTER_ROTATION_ID = pid('counter-rotation')
export const CINEMA2_HYPNOTIZE_TRAVEL_ID = pid('travel')
export const CINEMA2_HYPNOTIZE_FLASH_ACCENTS_ID = pid('flash-accents')
export const CINEMA2_HYPNOTIZE_DROP_STRENGTH_ID = pid('drop-strength')
export const CINEMA2_HYPNOTIZE_ATMOSPHERE_ID = pid('atmosphere')
export const CINEMA2_HYPNOTIZE_CHROMATIC_SPLIT_ID = pid('chromatic-split')

const ROOT_ID = cinema2StableId<Cinema2SceneNodeId>('hypnotize-root')
const KEY_TARGET_ID = cinema2StableId<Cinema2SceneNodeId>('hypnotize-key-target')
const RIM_TARGET_ID = cinema2StableId<Cinema2SceneNodeId>('hypnotize-rim-target')
const KEY_LIGHT_ID = cinema2StableId<Cinema2LightId>('hypnotize-key-light')
const RIM_LIGHT_ID = cinema2StableId<Cinema2LightId>('hypnotize-rim-light')
const WARM_LIGHT_ID = cinema2StableId<Cinema2LightId>('hypnotize-warm-light')
const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('hypnotize-ambient-light')

const BACKGROUND = color(0.001, 0.002, 0.006)
const STRUCTURE = color(0.08, 0.12, 0.19)
const COOL = color(0.05, 0.74, 1)
const WARM = color(1, 0.29, 0.055)
const CORE = color(0.76, 0.96, 1)
const SPECTRUM = color(0.5, 0.16, 1)

const PATTERN_LABELS = Object.freeze({
  mesmericOrbit: 'Mesmeric Orbit',
  blackIris: 'Black Iris',
  turbineBloom: 'Turbine Bloom',
  chromaticRelay: 'Chromatic Relay',
  infiniteDraw: 'Infinite Draw',
  radiantCollapse: 'Radiant Collapse',
} as const)
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

function rewrite(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value === CINEMA2_CONSTELLATION_PRESET_ID) return CINEMA2_HYPNOTIZE_PRESET_ID
    if (value === 'constellation-native') return CINEMA2_HYPNOTIZE_NATIVE_MODULE_TYPE_ID
    if (value === 'constellation-system') return CINEMA2_HYPNOTIZE_MODULE_ID
    return value.split('constellation-').join('hypnotize-').split('Constellation').join('Hypnotize').split('constellation').join('hypnotize')
  }
  if (Array.isArray(value)) return Object.freeze(value.map(rewrite))
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, rewrite(entry)])))
  return value
}

const derived = rewrite(CINEMA2_CONSTELLATION_PRESET_MANIFEST) as Cinema2NativePresetManifest
const { choreography: _deferredChoreography, ...staticDerived } = derived
const labelOverrides: Readonly<Record<string, readonly [string, string]>> = Object.freeze({
  'hypnotize-intensity': ['Master Intensity', 'Scales the optical engine emission while preserving the black-metal architecture.'],
  'hypnotize-reactivity': ['Music Reactivity', 'Scales bounded shared Audio Intelligence and Visual Director modulation.'],
  'hypnotize-node-density': ['Ring Density', 'Controls how many nested depth collars are visible.'],
  'hypnotize-spread': ['Chamber Radius', 'Expands or compresses the complete radial architecture.'],
  'hypnotize-depth': ['Tunnel Depth', 'Controls the front-to-back spacing of the recursive chamber.'],
  'hypnotize-node-scale': ['Core Size', 'Controls the central faceted energy lens and optical cage.'],
  'hypnotize-variation': ['Perspective Reveal', 'Turns the engine off-axis to reveal its physical depth.'],
  'hypnotize-collapse': ['Vane Length', 'Controls the reach of the eighteen curved turbine vanes.'],
  'hypnotize-burst': ['Warp Amount', 'Controls the resting four-lobed tension of the filament membrane.'],
  'hypnotize-drift': ['Pulse Depth', 'Sets the bounded bass, kick and impact breathing range.'],
  'hypnotize-spin': ['Rotation Speed', 'Sets the authored rotation rate. Zero is a hard stop.'],
  'hypnotize-edge-glow': ['LED Intensity', 'Controls the output of the addressable collar, conductor and exterior LED banks.'],
  'hypnotize-internal-glow': ['Core Intensity', 'Controls the energy lens and inner optical cage.'],
  'hypnotize-stars': ['Spectral Detail', 'Controls sparse spectral glints surrounding the conductors.'],
  'hypnotize-trails': ['Trails', 'Controls engine-owned conductor and core persistence. Zero is a hard off.'],
  'hypnotize-bloom': ['LED Bloom', 'Controls the HDR halo generated by the addressable LED bars and light segments.'],
  'hypnotize-finish': ['Cinematic Finish', 'Controls the final tone curve, contrast, vignette and grain.'],
  'hypnotize-primary': ['Structure', 'Controls the black-nickel turbine, collars, ribs and membrane.'],
  'hypnotize-secondary': ['Cool Energy', 'Controls cyan and blue conductor banks and rail cores.'],
  'hypnotize-accent': ['Warm Energy', 'Controls amber and orange relay banks.'],
  'hypnotize-highlight': ['Core', 'Controls the central lens heart and optical cage.'],
  'hypnotize-background': ['Background', 'Controls the void behind the optical engine.'],
})

const paletteDefaults: Readonly<Record<string, Cinema2Color>> = Object.freeze({
  'hypnotize-primary': STRUCTURE,
  'hypnotize-secondary': COOL,
  'hypnotize-accent': WARM,
  'hypnotize-highlight': CORE,
  'hypnotize-background': BACKGROUND,
})
const motionDefaults: Readonly<Record<string, number>> = Object.freeze({
  'hypnotize-drift': 0.55,
  'hypnotize-spin': 0.52,
  'hypnotize-edge-glow': 2.1,
  'hypnotize-bloom': 1.45,
})
const spectrumTemplate = (derived.parameters ?? []).find(parameter => parameter.id === 'hypnotize-highlight')
if (!spectrumTemplate) throw new Error('Hypnotize requires the inherited palette parameter template.')
const authoredControlBase = Object.freeze({
  section: 'Design', exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
  modulatable: true, choreographable: true, automatable: false,
})
const floatControl = (id: Cinema2ParameterId, label: string, description: string, defaultValue: number, min: number, max: number, step: number, designParentGroup: 'master-controls' | 'design' | 'effects', group: string, order: number) => Object.freeze({
  ...authoredControlBase, id, label, description, type: 'float' as const, defaultValue, min, max, step, designParentGroup, group, order,
})

const parameters = Object.freeze([
  ...(derived.parameters ?? []).map(parameter => {
    if (parameter.id === CINEMA2_HYPNOTIZE_PATTERN_ID) {
      return Object.freeze({
        ...parameter,
        label: 'Pattern',
        description: 'Selects one of six authored Hypnotize geometry and lighting programs with a bounded crossfade.',
        defaultValue: 'mesmericOrbit',
        designParentGroup: 'design' as const,
        metadata: Object.freeze({ userEditSetParameters: Object.freeze({ [CINEMA2_HYPNOTIZE_AUTO_PERFORMANCE_ID]: false }) }),
        options: Object.freeze(CINEMA2_HYPNOTIZE_PATTERNS.map(value => Object.freeze({ value, label: PATTERN_LABELS[value] }))),
      })
    }
    if (parameter.id === CINEMA2_HYPNOTIZE_PATTERN_CHANGE_ID || parameter.id === CINEMA2_HYPNOTIZE_TRIGGER_ID) {
      return Object.freeze({
        ...parameter,
        designParentGroup: 'design' as const,
        ...(parameter.id === CINEMA2_HYPNOTIZE_PATTERN_CHANGE_ID ? { metadata: Object.freeze({ userEditSetParameters: Object.freeze({ [CINEMA2_HYPNOTIZE_AUTO_PERFORMANCE_ID]: false }) }) } : {}),
        ...(parameter.id === CINEMA2_HYPNOTIZE_TRIGGER_ID ? { options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } : {}),
      })
    }
    const override = labelOverrides[parameter.id]
    const defaultValue = paletteDefaults[parameter.id]
    const motionDefault = motionDefaults[parameter.id]
    return override || defaultValue || motionDefault != null
      ? Object.freeze({
          ...parameter,
          ...(override ? { label: override[0], description: override[1] } : {}),
          ...(defaultValue ? { defaultValue } : {}),
          ...(motionDefault != null ? { defaultValue: motionDefault } : {}),
          ...(parameter.type === 'color' ? { group: 'Hypnotize Palette' } : {}),
        })
      : parameter
  }),
  Object.freeze({
    ...spectrumTemplate,
    id: CINEMA2_HYPNOTIZE_SPECTRUM_ID,
    label: 'Spectrum Edge',
    description: 'Controls violet, red and cyan spectral edge accents and halo glints.',
    defaultValue: SPECTRUM,
    designParentGroup: 'palette' as const,
    order: 6,
    group: 'Hypnotize Palette',
  }),
  floatControl(CINEMA2_HYPNOTIZE_COUNTER_ROTATION_ID, 'Counter-Rotation', 'Sets the relative motion between turbine, conductor, depth and exterior families.', 0.65, 0, 1, 0.01, 'design', 'Motion', 10),
  floatControl(CINEMA2_HYPNOTIZE_TRAVEL_ID, 'Travel', 'Sets bounded shaft travel and camera motion authority.', 0.45, 0, 1, 0.01, 'design', 'Motion', 11),
  Object.freeze({
    ...authoredControlBase,
    id: CINEMA2_HYPNOTIZE_FLASH_ACCENTS_ID,
    label: 'Flash Accents',
    description: 'Hard authorization for Radiant Collapse discharge accents. Off prevents blackout flashes.',
    type: 'enum' as const,
    defaultValue: 'reduced',
    options: Object.freeze([Object.freeze({ value: 'off', label: 'Off' }), Object.freeze({ value: 'reduced', label: 'Reduced' }), Object.freeze({ value: 'full', label: 'Full' })]),
    designParentGroup: 'master-controls' as const,
    group: 'Playback',
    order: 6,
  }),
  floatControl(CINEMA2_HYPNOTIZE_DROP_STRENGTH_ID, 'Drop Strength', 'Caps collapse compression, discharge scale and afterglow.', 0.75, 0, 1, 0.01, 'effects', 'Performance', 1),
  floatControl(CINEMA2_HYPNOTIZE_ATMOSPHERE_ID, 'Atmosphere', 'Controls depth haze without lifting the black structure.', 0.28, 0, 1, 0.01, 'effects', 'Post', 2),
  floatControl(CINEMA2_HYPNOTIZE_CHROMATIC_SPLIT_ID, 'Chromatic Split', 'Controls bounded spectral separation at bright edges.', 0.006, 0, 0.025, 0.001, 'effects', 'Post', 3),
])

const modules = Object.freeze((derived.modules ?? []).map(module => Object.freeze({
  ...module,
  typeId: CINEMA2_HYPNOTIZE_NATIVE_MODULE_TYPE_ID,
  parameters: Object.freeze({
    ...module.parameters,
    intensity: 0.92,
    reactivity: 1,
    look: 'mesmericOrbit',
    nodeDensity: 1,
    spread: 1.58,
    depthSpread: 1.45,
    nodeScale: 0.92,
    scaleVariation: 0.5,
    collapse: 1.08,
    burst: 0.48,
    drift: 0.55,
    spin: 0.52,
    edgeGlow: 2.1,
    internalGlow: 1.4,
    starDensity: 0.72,
    exteriorEnergy: 0,
    exteriorBass: 0,
    counterRotation: 0.65,
    travel: 0.45,
    flashAccents: 'reduced',
    dropStrength: 0.75,
    overallEnergy: 0,
    bassPressure: 0,
    lowMidAmount: 0,
    midAmount: 0,
    highsAmount: 0,
    fluxAmount: 0,
    vocalPresence: 0,
    beatAccent: 0,
    kickAccent: 0,
    snareAccent: 0,
    downbeatAccent: 0,
    barAccent: 0,
    phraseAccent: 0,
    sectionAccent: 0,
    buildAmount: 0,
    dropAccent: 0,
    directorIntensity: 0,
    directorMomentum: 0,
    directorImpact: 0,
    primaryColor: STRUCTURE,
    secondaryColor: COOL,
    accentColor: WARM,
    highlightColor: CORE,
    spectrumColor: SPECTRUM,
  }),
  parameterBindings: Object.freeze({
    ...module.parameterBindings,
    reactivity: cinema2Ref(CINEMA2_HYPNOTIZE_REACTIVITY_ID),
    spectrumColor: cinema2Ref(CINEMA2_HYPNOTIZE_SPECTRUM_ID),
    counterRotation: cinema2Ref(CINEMA2_HYPNOTIZE_COUNTER_ROTATION_ID),
    travel: cinema2Ref(CINEMA2_HYPNOTIZE_TRAVEL_ID),
    flashAccents: cinema2Ref(CINEMA2_HYPNOTIZE_FLASH_ACCENTS_ID),
    dropStrength: cinema2Ref(CINEMA2_HYPNOTIZE_DROP_STRENGTH_ID),
  }),
})))

const effects = Object.freeze((derived.effects ?? []).map(effect => {
  if (effect.id === 'hypnotize-atmosphere') return Object.freeze({ ...effect, parameterBindings: Object.freeze({ ...(effect.parameterBindings ?? {}), mix: cinema2Ref(CINEMA2_HYPNOTIZE_ATMOSPHERE_ID) }) })
  if (effect.id === 'hypnotize-bloom') return Object.freeze({
    ...effect,
    parameters: Object.freeze({ ...(effect.parameters ?? {}), threshold: 0.58, knee: 0.55, spread: 0.58, levels: 5, clampMax: 24 }),
  })
  if (effect.id === 'hypnotize-finish') return Object.freeze({ ...effect, parameterBindings: Object.freeze({ ...(effect.parameterBindings ?? {}), aberration: cinema2Ref(CINEMA2_HYPNOTIZE_CHROMATIC_SPLIT_ID) }) })
  return effect
}))

const scene = derived.scene ? Object.freeze({
  ...derived.scene,
  nodes: Object.freeze([
    ...derived.scene.nodes,
    Object.freeze({ id: KEY_TARGET_ID, kind: 'group' as const, parent: cinema2Ref(ROOT_ID), transform: Object.freeze({ position: vec3(0, 0, -5.5) }) }),
    Object.freeze({ id: RIM_TARGET_ID, kind: 'group' as const, parent: cinema2Ref(ROOT_ID), transform: Object.freeze({ position: vec3(0, 0, -7.4) }) }),
  ]),
}) : undefined

const cameras = Object.freeze([Object.freeze({
  id: CINEMA2_HYPNOTIZE_CAMERA_ID,
  label: 'Hypnotize Optical Axis',
  projection: 'perspective' as const,
  fovDegrees: 50,
  minAspect: 0.72,
  near: 0.08,
  far: 90,
  transform: Object.freeze({ position: vec3(0, 0, 20) }),
  target: vec3(0, 0, -5.1),
  rig: Object.freeze({ kind: 'static' as const }),
  motion: Object.freeze({
    drift: Object.freeze({ position: 0.22, target: 0.1, rollDegrees: 0.42, fovDegrees: 0.35, speed: 0.035, seed: 6206 }),
    tempo: Object.freeze({ referenceBpm: 120, weave: 0.12, bob: 0.07, roll: 0.32, fov: 0.45, punch: 0.7 }),
    fovRateLimitDegreesPerSecond: 7,
  }),
  controls: Object.freeze({
    motionSafety: cinema2Ref(pid('motion-safety')),
    tempoSync: cinema2Ref(CINEMA2_HYPNOTIZE_BPM_SYNC_ID),
    motionAmount: cinema2Ref(CINEMA2_HYPNOTIZE_TRAVEL_ID),
  }),
  smoothingMs: 160,
  safety: Object.freeze({
    minPosition: vec3(-2.2, -1.4, 17.5),
    maxPosition: vec3(2.2, 1.4, 22),
    maxPositionOffset: vec3(0.65, 0.45, 0.9),
    maxTargetOffset: vec3(0.32, 0.28, 0.5),
    minFovDegrees: 42,
    maxFovDegrees: 58,
    minNear: 0.05,
    maxFar: 100,
  }),
})])

const lighting = Object.freeze({
  lights: Object.freeze([
    Object.freeze({
      id: KEY_LIGHT_ID,
      type: 'spot' as const,
      color: color(0.68, 0.87, 1),
      intensity: 0.78,
      transform: Object.freeze({ position: vec3(-8.4, 8.8, 8.6) }),
      targetNode: cinema2Ref(KEY_TARGET_ID),
      config: Object.freeze({ coneAngleDegrees: 40, penumbra: 0.68, range: 44, threeShadow: true }),
    }),
    Object.freeze({
      id: RIM_LIGHT_ID,
      type: 'spot' as const,
      color: color(0.3, 0.18, 1),
      intensity: 0.52,
      transform: Object.freeze({ position: vec3(8.6, 5.2, 5.4) }),
      targetNode: cinema2Ref(RIM_TARGET_ID),
      config: Object.freeze({ coneAngleDegrees: 46, penumbra: 0.72, range: 46, threeShadow: false }),
    }),
    Object.freeze({ id: WARM_LIGHT_ID, type: 'point' as const, color: WARM, intensity: 0.16, transform: Object.freeze({ position: vec3(3.6, -2.5, -3.2) }), config: Object.freeze({ range: 16 }) }),
    Object.freeze({ id: AMBIENT_LIGHT_ID, type: 'ambient' as const, color: color(0.26, 0.34, 0.48), intensity: 0.045 }),
  ]),
})

export const CINEMA2_HYPNOTIZE_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  ...staticDerived,
  id: CINEMA2_HYPNOTIZE_PRESET_ID,
  revision: 4,
  metadata: Object.freeze({
    name: 'Hypnotize',
    description: 'A black optical engine of curved turbine vanes, braided conductors, filament membranes and an illuminated recursive shaft.',
    tags: Object.freeze(['keeper', 'hypnotize', '3d', 'three-js', 'optical', 'turbine', 'tunnel', 'audio-reactive', 'choreography', 'phase-c', 'phase-d', 'cinematic-polish']),
  }),
  capabilities: Object.freeze([
    ...(derived.capabilities ?? []).filter(capability => !capability.id.startsWith('audio.') && !capability.id.startsWith('music.') && capability.id !== 'visual-director.significance'),
    ...(['audio.features', 'audio.bands', 'music.beat', 'music.rhythm-events', 'music.downbeat', 'music.bar', 'music.phrase', 'music.section', 'music.vocal-presence', 'music.build', 'music.drop', 'visual-director.significance'] as const).map(id => Object.freeze({ id, requirement: 'optional' as const, purpose: 'Shared musical intelligence drives bounded Hypnotize choreography.' })),
  ]),
  parameters,
  modules,
  scene,
  cameras,
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_HYPNOTIZE_CAMERA_ID) }),
  lighting,
  effects,
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
          cameraEnvelopeAction('auto-camera-phrase-target', 'target', Object.freeze([-0.08, 0.04, -0.08] as const), 0.08, 0.75),
        ]),
      }),
    ]),
  }),
  environment: Object.freeze({
    ...(derived.environment ?? {}),
    backgroundColor: BACKGROUND,
    exposure: 1.02,
    controls: Object.freeze({ backgroundColor: cinema2Ref(pid('background')) }),
  }),
})

function vec3(x: number, y: number, z: number): Cinema2Vector3 { return Object.freeze([x, y, z]) }
function color(r: number, g: number, b: number, a = 1): Cinema2Color { return Object.freeze([r, g, b, a]) }
