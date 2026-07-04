/**
 * Configuration contract for the Cinematic Worlds renderer family.
 *
 * Numeric ranges are centralized in CINEMATIC_NUMERIC_RANGES and enforced by
 * normalizeCinematicWorldConfig() before renderer state is created.
 */

import {
  createDefaultCinematicWorldSettings,
  normalizeCinematicWorldSettings,
  type CinematicWorldSettingsByMode,
  type CinematicWorldSpecificConfig,
} from './CinematicWorldSettings'

export const CINEMATIC_WORLD_MODES = [
  'legacyPortal',
  'eventHorizon',
  'infiniteCorridor',
  'fractureRift',
  'monolithGate',
  'liquidMembrane',
  'celestialCathedral',
  'mirrorDimension',
  'ancientMachine',
  'stormGateway',
  'reactiveConstellation',
] as const

export type CinematicWorldMode = typeof CINEMATIC_WORLD_MODES[number]

export const CINEMATIC_PORTAL_SHAPES = [
  'rectangle',
  'circle',
  'arch',
  'triangle',
  'fracture',
  'organic',
  'customMask',
] as const

export type CinematicPortalShape = typeof CINEMATIC_PORTAL_SHAPES[number]

export const CINEMATIC_CAMERA_RIGS = [
  'locked',
  'dolly',
  'orbit',
  'flyThrough',
  'handheld',
  'autoDirector',
] as const

export type CinematicCameraRig = typeof CINEMATIC_CAMERA_RIGS[number]

export const CINEMATIC_CAMERA_EASINGS = ['linear', 'easeInOut', 'smoothstep'] as const
export type CinematicCameraEasing = typeof CINEMATIC_CAMERA_EASINGS[number]

export interface CinematicCameraVectorConfig {
  x: number
  y: number
  z: number
}

export interface CinematicCameraConfig {
  locked: {
    position: CinematicCameraVectorConfig
    rotation: CinematicCameraVectorConfig
    fieldOfView: number
    breathingStrength: number
    breathingFrequency: number
    beatPunch: number
  }
  dolly: {
    range: number
    speed: number
    direction: -1 | 1
    easing: CinematicCameraEasing
    beatAcceleration: number
    buildAcceleration: number
  }
  orbit: {
    radius: number
    elevation: number
    angularSpeed: number
    direction: -1 | 1
    sectionAware: boolean
    safeMargin: number
  }
  flyThrough: {
    speed: number
    speedModulation: number
    banking: number
    loop: boolean
  }
  handheld: {
    driftStrength: number
    impactShake: number
    damping: number
    strength: number
    frequency: number
    maxTranslation: number
    maxRotation: number
  }
  autoDirector: {
    /** 0–1 overall influence of directed camera choices. */
    strength: number
    /** 0–1 amount of motion retained within each shot. */
    cameraActivity: number
    /** 0–1 multiplier controlling how readily shots change at musical boundaries. */
    transitionFrequency: number
    /** 0–1 drop-specific camera impulse. */
    dropImpact: number
    /** 0–1 build-specific camera acceleration. */
    buildIntensity: number
    minimumShotDurationSec: number
    transitionDurationSec: number
    preferMusicalBoundaries: boolean
    repeatAvoidance: number
    manualOverrideRig: Exclude<CinematicCameraRig, 'autoDirector'> | null
    lockUntilNextSection: boolean
    /** Keeps the camera on a locked manual shot while Auto Director remains enabled. */
    manualCameraLock: boolean
  }
}

export function createDefaultCinematicCameraConfig(): CinematicCameraConfig {
  return {
    locked: {
      position: { x: 0, y: 0, z: 1.8 },
      rotation: { x: 0, y: 0, z: 0 },
      fieldOfView: 58,
      breathingStrength: 0.018,
      breathingFrequency: 0.16,
      beatPunch: 0.08,
    },
    dolly: {
      range: 1.15,
      speed: 0.12,
      direction: 1,
      easing: 'easeInOut',
      beatAcceleration: 0.22,
      buildAcceleration: 0.65,
    },
    orbit: {
      radius: 1.9,
      elevation: 0.18,
      angularSpeed: 0.10,
      direction: 1,
      sectionAware: true,
      safeMargin: 0.16,
    },
    flyThrough: {
      speed: 0.22,
      speedModulation: 0.65,
      banking: 0.12,
      loop: true,
    },
    handheld: {
      driftStrength: 0.06,
      impactShake: 0.12,
      damping: 9,
      strength: 0.55,
      frequency: 0.42,
      maxTranslation: 0.10,
      maxRotation: 0.055,
    },
    autoDirector: {
      strength: 0.82,
      cameraActivity: 0.68,
      transitionFrequency: 0.55,
      dropImpact: 0.9,
      buildIntensity: 0.72,
      minimumShotDurationSec: 4,
      transitionDurationSec: 0.85,
      preferMusicalBoundaries: true,
      repeatAvoidance: 2,
      manualOverrideRig: null,
      lockUntilNextSection: false,
      manualCameraLock: false,
    },
  }
}

export const CINEMATIC_QUALITY_TIERS = ['auto', 'low', 'medium', 'high', 'ultra'] as const
export type CinematicQualityTier = typeof CINEMATIC_QUALITY_TIERS[number]

export const CINEMATIC_TRANSITION_MODES = ['cut', 'crossfade', 'morph', 'portalWipe'] as const
export type CinematicTransitionMode = typeof CINEMATIC_TRANSITION_MODES[number]

export const CINEMATIC_TRANSITION_EASINGS = ['linear', 'easeIn', 'easeOut', 'easeInOut'] as const
export type CinematicTransitionEasing = typeof CINEMATIC_TRANSITION_EASINGS[number]

export const CINEMATIC_AUDIO_CONTINUOUS_SOURCES = [
  'overallEnergy',
  'subBass',
  'bass',
  'lowMid',
  'mid',
  'highMid',
  'highs',
  'transientIntensity',
  'kickStrength',
  'snareStrength',
  'beatPhase',
  'barPosition',
  'phraseProgress',
  'sectionProgress',
  'buildProgress',
  'dropState',
  'trackEnergy',
  'vocalEnergy',
  // Backward-compatible aliases retained for presets created before Patch 5.
  'volume',
  'high',
  'sectionEnergy',
] as const

export const CINEMATIC_AUDIO_EVENT_SOURCES = [
  'beat',
  'kick',
  'snare',
  'downbeat',
  'barStart',
  'sectionChange',
  'dropEntry',
] as const

export const CINEMATIC_AUDIO_SOURCES = [
  ...CINEMATIC_AUDIO_CONTINUOUS_SOURCES,
  ...CINEMATIC_AUDIO_EVENT_SOURCES,
] as const
export type CinematicAudioContinuousSource = typeof CINEMATIC_AUDIO_CONTINUOUS_SOURCES[number]
export type CinematicAudioEventSource = typeof CINEMATIC_AUDIO_EVENT_SOURCES[number]
export type CinematicAudioSource = typeof CINEMATIC_AUDIO_SOURCES[number]

export const CINEMATIC_AUDIO_TARGETS = [
  'portalAperture',
  'depth',
  'cameraPunch',
  'cameraTravel',
  'lensing',
  'distortion',
  'refraction',
  'geometryRotation',
  'fractureAmount',
  'fogDensity',
  'particleEmission',
  'lightning',
  'bloom',
  'chromaticAberration',
  'environmentBrightness',
  'feedback',
  'impact',
  'networkSpread',
  'nodeScale',
  'nodeSpin',
  'edgeBrightness',
  'edgeWidth',
  'trailLength',
  'topologyMorph',
  'collapseForce',
  'burstImpulse',
  'facetOpacity',
  // Backward-compatible target aliases. Renderers map these to canonical effects.
  'fog',
  'debris',
  'atmosphere',
  'glow',
  'cameraMotion',
  'portalPulse',
] as const
export type CinematicAudioTarget = typeof CINEMATIC_AUDIO_TARGETS[number]

export const CINEMATIC_RESPONSE_CURVES = [
  'linear',
  'smoothstep',
  'easeIn',
  'easeOut',
  'exponential',
] as const
export type CinematicResponseCurve = typeof CINEMATIC_RESPONSE_CURVES[number]

export const CINEMATIC_SECTION_SCALE_KEYS = [
  'intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'bridge', 'outro', 'unknown',
] as const
export type CinematicSectionScaleKey = typeof CINEMATIC_SECTION_SCALE_KEYS[number]

export interface NumericRange {
  min: number
  max: number
  default: number
  description: string
}

export const CINEMATIC_NUMERIC_RANGES = {
  environment: {
    depth:        { min: 0, max: 1, default: 0.55, description: 'Perceived world depth; 0 = flat, 1 = maximum depth.' },
    architecture: { min: 0, max: 1, default: 0.35, description: 'Amount of structural scenery surrounding the portal.' },
    fog:          { min: 0, max: 1, default: 0.50, description: 'Volumetric fog density.' },
    debris:       { min: 0, max: 1, default: 0.50, description: 'Environmental particle and debris density.' },
    stars:        { min: 0, max: 1, default: 0.30, description: 'Star-field density.' },
    atmosphere:   { min: 0, max: 1, default: 0.50, description: 'Overall atmospheric intensity.' },
  },
  material: {
    distortion:          { min: 0, max: 1, default: 0.10, description: 'Surface displacement strength.' },
    refraction:          { min: 0, max: 1, default: 0.10, description: 'Refractive bending strength.' },
    bloom:               { min: 0, max: 1, default: 0.65, description: 'Post-process bloom intensity.' },
    chromaticAberration: { min: 0, max: 1, default: 0.00, description: 'RGB channel separation.' },
    feedback:             { min: 0, max: 1, default: 0.00, description: 'Previous-frame feedback amount.' },
    glow:                 { min: 0, max: 1, default: 0.75, description: 'Portal and emissive material glow.' },
  },
  audioRoute: {
    amount:              { min: -2, max: 2, default: 1, description: 'Signed modulation depth.' },
    attackMs:            { min: 0, max: 2000, default: 40, description: 'Attack response in milliseconds.' },
    releaseMs:           { min: 0, max: 4000, default: 220, description: 'Release response in milliseconds.' },
    smoothingMs:         { min: 0, max: 2000, default: 0, description: 'Additional route smoothing in milliseconds.' },
    gain:                { min: 0, max: 4, default: 1, description: 'Source gain before the route envelope.' },
    bias:                { min: -1, max: 1, default: 0, description: 'Signed source bias.' },
    threshold:           { min: 0, max: 1, default: 0, description: 'Source gate threshold.' },
    clampMin:            { min: 0, max: 1, default: 0, description: 'Minimum transformed source value.' },
    clampMax:            { min: 0, max: 1, default: 1, description: 'Maximum transformed source value.' },
    beatHoldMs:          { min: 0, max: 2000, default: 0, description: 'Discrete-event hold time.' },
    decayMs:             { min: 0, max: 8000, default: 180, description: 'Discrete-event decay time.' },
    randomizationAmount: { min: 0, max: 1, default: 0, description: 'Deterministic seeded variation amount.' },
    sectionScale:        { min: 0, max: 4, default: 1, description: 'Per-section route scale.' },
  },
  audioSmoothingMs: { min: 0, max: 2000, default: 80, description: 'Global audio-map smoothing in milliseconds.' },
  transitionDurationMs: { min: 0, max: 10000, default: 600, description: 'World transition duration in milliseconds.' },
  seed: { min: 0, max: 0xffffffff, default: 1337, description: 'Unsigned 32-bit deterministic random seed.' },
} as const satisfies Record<string, NumericRange | Record<string, NumericRange>>

export interface CinematicEnvironmentControls {
  /** 0–1. Perceived world depth. */
  depth: number
  /** 0–1. Amount of surrounding architecture. */
  architecture: number
  /** 0–1. Volumetric fog density. */
  fog: number
  /** 0–1. Environmental particle/debris density. */
  debris: number
  /** 0–1. Star-field density. */
  stars: number
  /** 0–1. Overall atmospheric intensity. */
  atmosphere: number
}

export interface CinematicMaterialControls {
  /** 0–1. Surface displacement strength. */
  distortion: number
  /** 0–1. Refractive bending strength. */
  refraction: number
  /** 0–1. Bloom intensity. */
  bloom: number
  /** 0–1. RGB channel separation. */
  chromaticAberration: number
  /** 0–1. Previous-frame feedback amount. */
  feedback: number
  /** 0–1. Emissive glow intensity. */
  glow: number
}

export interface CinematicAudioRoute {
  id: string
  enabled: boolean
  source: CinematicAudioSource
  target: CinematicAudioTarget
  /** -2–2. Signed modulation depth retained for backward-compatible presets. */
  amount: number
  /** 0–2000 ms. */
  attackMs: number
  /** 0–4000 ms. */
  releaseMs: number
  /** 0–2000 ms. Additional smoothing after attack/release. */
  smoothingMs?: number
  /** 0–4. Source gain before bias, threshold, and response curve. */
  gain?: number
  /** -1–1. Signed source offset. */
  bias?: number
  /** 0–1. Values at or below this gate resolve to zero. */
  threshold?: number
  responseCurve?: CinematicResponseCurve
  clampMin?: number
  clampMax?: number
  invert?: boolean
  /** 0–2000 ms. Hold a discrete event at full value before decay. */
  beatHoldMs?: number
  /** 0–8000 ms. Exponential event decay after hold. */
  decayMs?: number
  /** 0–1. Deterministic seeded variation, never Math.random() jitter. */
  randomizationAmount?: number
  /** Optional route scale by analyzed/manual section type. */
  sectionScale?: Partial<Record<CinematicSectionScaleKey, number>>
}

export interface CinematicAudioMappingConfig {
  enabled: boolean
  /** 0–2000 ms. Global smoothing applied before route envelopes. */
  smoothingMs: number
  routes: CinematicAudioRoute[]
}

export interface CinematicTransitionConfig {
  mode: CinematicTransitionMode
  /** 0–10000 ms. */
  durationMs: number
  easing: CinematicTransitionEasing
  preserveCamera: boolean
}

export interface CinematicCompatibilityData {
  /** Values copied from the pre-Cinematic-Worlds portal contract. */
  legacyValues: Record<string, unknown>
  /** Unknown configuration fields retained for forward/backward compatibility. */
  extensions: Record<string, unknown>
}

export interface CinematicWorldConfig {
  schemaVersion: 1
  worldMode: CinematicWorldMode
  /** Focused controls for the selected world. */
  worldSettings: CinematicWorldSpecificConfig
  portalShape: CinematicPortalShape
  cameraRig: CinematicCameraRig
  camera: CinematicCameraConfig
  customMaskId: string | null
  environment: CinematicEnvironmentControls
  material: CinematicMaterialControls
  audioMapping: CinematicAudioMappingConfig
  /** Unsigned 32-bit integer, 0–4294967295. */
  seed: number
  qualityTier: CinematicQualityTier
  transition: CinematicTransitionConfig
  compatibility: CinematicCompatibilityData
}

const DEFAULT_ROUTE_BEHAVIOR: Omit<CinematicAudioRoute, 'id' | 'source' | 'target'> = {
  enabled: true,
  amount: 1,
  attackMs: CINEMATIC_NUMERIC_RANGES.audioRoute.attackMs.default,
  releaseMs: CINEMATIC_NUMERIC_RANGES.audioRoute.releaseMs.default,
  smoothingMs: CINEMATIC_NUMERIC_RANGES.audioRoute.smoothingMs.default,
  gain: CINEMATIC_NUMERIC_RANGES.audioRoute.gain.default,
  bias: CINEMATIC_NUMERIC_RANGES.audioRoute.bias.default,
  threshold: CINEMATIC_NUMERIC_RANGES.audioRoute.threshold.default,
  responseCurve: 'linear',
  clampMin: CINEMATIC_NUMERIC_RANGES.audioRoute.clampMin.default,
  clampMax: CINEMATIC_NUMERIC_RANGES.audioRoute.clampMax.default,
  invert: false,
  beatHoldMs: CINEMATIC_NUMERIC_RANGES.audioRoute.beatHoldMs.default,
  decayMs: CINEMATIC_NUMERIC_RANGES.audioRoute.decayMs.default,
  randomizationAmount: CINEMATIC_NUMERIC_RANGES.audioRoute.randomizationAmount.default,
  sectionScale: {},
}

function route(
  id: string,
  source: CinematicAudioSource,
  target: CinematicAudioTarget,
  overrides: Partial<Omit<CinematicAudioRoute, 'id' | 'source' | 'target'>> = {},
): CinematicAudioRoute {
  return {
    id,
    source,
    target,
    ...DEFAULT_ROUTE_BEHAVIOR,
    ...overrides,
    sectionScale: { ...DEFAULT_ROUTE_BEHAVIOR.sectionScale, ...overrides.sectionScale },
  }
}

const WORLD_DEFAULT_AUDIO_ROUTES: Readonly<Record<CinematicWorldMode, readonly CinematicAudioRoute[]>> = {
  legacyPortal: [
    route('legacy-bass-glow', 'bass', 'glow', { amount: 0.7, attackMs: 30, releaseMs: 180 }),
    route('legacy-beat-pulse', 'beat', 'portalPulse', { amount: 1, attackMs: 0, releaseMs: 180, decayMs: 180 }),
    route('legacy-energy-atmosphere', 'overallEnergy', 'atmosphere', { amount: 0.4, attackMs: 80, releaseMs: 300 }),
  ],
  eventHorizon: [
    route('event-horizon-sub-lensing', 'subBass', 'lensing', { amount: 0.9, attackMs: 20, releaseMs: 260, responseCurve: 'easeOut' }),
    route('event-horizon-sub-aperture', 'subBass', 'portalAperture', { amount: 0.55, attackMs: 28, releaseMs: 300 }),
    route('event-horizon-impact', 'kick', 'impact', { amount: 1, attackMs: 0, releaseMs: 180, beatHoldMs: 18, decayMs: 240 }),
    route('event-horizon-stars', 'highs', 'environmentBrightness', { amount: 0.42, attackMs: 18, releaseMs: 160 }),
    route('event-horizon-drop-entry', 'dropEntry', 'portalAperture', { amount: 0.8, attackMs: 0, releaseMs: 520, beatHoldMs: 120, decayMs: 620 }),
  ],
  infiniteCorridor: [
    route('corridor-phase-travel', 'beatPhase', 'cameraTravel', { amount: 0.72, attackMs: 0, releaseMs: 0 }),
    route('corridor-kick-punch', 'kick', 'cameraPunch', { amount: 0.9, attackMs: 0, releaseMs: 150, beatHoldMs: 12, decayMs: 180 }),
    route('corridor-light-cuts', 'snare', 'environmentBrightness', { amount: 0.85, attackMs: 0, releaseMs: 120, decayMs: 150 }),
    route('corridor-energy-depth', 'overallEnergy', 'depth', { amount: 0.35, attackMs: 90, releaseMs: 420 }),
  ],
  fractureRift: [
    route('rift-transient-fracture', 'transientIntensity', 'fractureAmount', { amount: 1, attackMs: 0, releaseMs: 160, threshold: 0.08 }),
    route('rift-bass-opening', 'bass', 'portalAperture', { amount: 0.72, attackMs: 28, releaseMs: 260 }),
    route('rift-high-shards', 'highs', 'particleEmission', { amount: 0.5, attackMs: 16, releaseMs: 180 }),
    route('rift-drop-impact', 'dropEntry', 'impact', { amount: 1, attackMs: 0, releaseMs: 420, beatHoldMs: 80, decayMs: 520 }),
  ],
  monolithGate: [
    route('monolith-downbeat-symbols', 'downbeat', 'environmentBrightness', { amount: 1, attackMs: 0, releaseMs: 260, beatHoldMs: 45, decayMs: 300 }),
    route('monolith-drop-open', 'dropState', 'portalAperture', { amount: 0.95, attackMs: 110, releaseMs: 560 }),
    route('monolith-phase-travel', 'barPosition', 'cameraTravel', { amount: 0.35, attackMs: 0, releaseMs: 0 }),
    route('monolith-bass-depth', 'subBass', 'depth', { amount: 0.32, attackMs: 80, releaseMs: 420 }),
  ],
  liquidMembrane: [
    route('membrane-bass-pressure', 'bass', 'portalAperture', { amount: 0.78, attackMs: 18, releaseMs: 240 }),
    route('membrane-mid-ripples', 'mid', 'distortion', { amount: 0.62, attackMs: 28, releaseMs: 200 }),
    route('membrane-high-refraction', 'highMid', 'refraction', { amount: 0.42, attackMs: 18, releaseMs: 180 }),
    route('membrane-transient-impact', 'transientIntensity', 'impact', { amount: 0.55, attackMs: 0, releaseMs: 150 }),
  ],
  celestialCathedral: [
    route('cathedral-mid-illumination', 'mid', 'environmentBrightness', { amount: 0.8, attackMs: 70, releaseMs: 360 }),
    route('cathedral-downbeat-shafts', 'downbeat', 'impact', { amount: 0.75, attackMs: 0, releaseMs: 320, beatHoldMs: 80, decayMs: 360 }),
    route('cathedral-high-stars', 'highs', 'particleEmission', { amount: 0.52, attackMs: 24, releaseMs: 220 }),
    route('cathedral-energy-bloom', 'overallEnergy', 'bloom', { amount: 0.4, attackMs: 110, releaseMs: 480 }),
  ],
  mirrorDimension: [
    route('mirror-beat-snap', 'beat', 'impact', { amount: 0.9, attackMs: 0, releaseMs: 170, decayMs: 210 }),
    route('mirror-phase-rotation', 'beatPhase', 'geometryRotation', { amount: 0.5, attackMs: 0, releaseMs: 0 }),
    route('mirror-energy-feedback', 'overallEnergy', 'feedback', { amount: 0.38, attackMs: 120, releaseMs: 520 }),
    route('mirror-high-chromatic', 'highs', 'chromaticAberration', { amount: 0.34, attackMs: 18, releaseMs: 140 }),
  ],
  ancientMachine: [
    route('machine-downbeat-unlock', 'downbeat', 'impact', { amount: 0.85, attackMs: 0, releaseMs: 260, beatHoldMs: 50, decayMs: 320 }),
    route('machine-phase-rotation', 'barPosition', 'geometryRotation', { amount: 0.48, attackMs: 0, releaseMs: 0 }),
    route('machine-drop-aperture', 'dropState', 'portalAperture', { amount: 0.8, attackMs: 120, releaseMs: 500 }),
    route('machine-high-glyphs', 'highs', 'environmentBrightness', { amount: 0.46, attackMs: 26, releaseMs: 210 }),
  ],
  reactiveConstellation: [
    route('constellation-sub-breath', 'subBass', 'networkSpread', { amount: 0.34, attackMs: 150, releaseMs: 440, smoothingMs: 90, responseCurve: 'smoothstep', sectionScale: { intro: 0.55, build: 1.2, preDrop: 0.45, drop: 1.15, breakdown: 0.55, outro: 0.35 } }),
    route('constellation-bass-scale', 'bass', 'nodeScale', { amount: 0.28, attackMs: 45, releaseMs: 260, smoothingMs: 35, threshold: 0.06, responseCurve: 'easeOut' }),
    route('constellation-bass-width', 'bass', 'edgeWidth', { amount: 0.32, attackMs: 55, releaseMs: 300, smoothingMs: 40, threshold: 0.08 }),
    route('constellation-kick-burst', 'kick', 'burstImpulse', { amount: 0.68, attackMs: 0, releaseMs: 210, beatHoldMs: 14, decayMs: 240, sectionScale: { intro: 0.35, verse: 0.65, build: 0.82, preDrop: 0.42, drop: 1, breakdown: 0.35, outro: 0.2 } }),
    route('constellation-snare-spin', 'snare', 'nodeSpin', { amount: 0.5, attackMs: 0, releaseMs: 170, beatHoldMs: 10, decayMs: 190 }),
    route('constellation-snare-facet', 'snare', 'facetOpacity', { amount: 0.32, attackMs: 0, releaseMs: 130, beatHoldMs: 8, decayMs: 160 }),
    route('constellation-high-spin', 'highs', 'nodeSpin', { amount: 0.22, attackMs: 35, releaseMs: 190, smoothingMs: 25, threshold: 0.05 }),
    route('constellation-high-sparkle', 'highs', 'edgeBrightness', { amount: 0.26, attackMs: 20, releaseMs: 160, smoothingMs: 20, threshold: 0.08 }),
    route('constellation-energy-beams', 'overallEnergy', 'edgeBrightness', { amount: 0.54, attackMs: 110, releaseMs: 480, smoothingMs: 80, responseCurve: 'easeOut' }),
    route('constellation-energy-density', 'overallEnergy', 'trailLength', { amount: 0.24, attackMs: 180, releaseMs: 620, smoothingMs: 120, responseCurve: 'easeOut' }),
    route('constellation-build-spread', 'buildProgress', 'networkSpread', { amount: 0.38, attackMs: 180, releaseMs: 520, smoothingMs: 100, sectionScale: { build: 1, preDrop: 0.15, drop: 0.4 } }),
    route('constellation-build-trails', 'buildProgress', 'trailLength', { amount: 0.72, attackMs: 220, releaseMs: 640, smoothingMs: 120, sectionScale: { build: 1, preDrop: 0.4, drop: 0.7 } }),
    route('constellation-build-morph', 'buildProgress', 'topologyMorph', { amount: 0.52, attackMs: 260, releaseMs: 720, smoothingMs: 140, sectionScale: { build: 1, preDrop: 0.55, drop: 0.3 } }),
    route('constellation-phase-breath', 'beatPhase', 'nodeScale', { amount: 0.08, attackMs: 45, releaseMs: 80, smoothingMs: 30, responseCurve: 'smoothstep' }),
    route('constellation-bar-pose', 'barStart', 'topologyMorph', { amount: 0.38, attackMs: 0, releaseMs: 520, beatHoldMs: 18, decayMs: 620, randomizationAmount: 0.28 }),
    route('constellation-phrase-evolution', 'phraseProgress', 'topologyMorph', { amount: 0.26, attackMs: 220, releaseMs: 420, smoothingMs: 120 }),
    route('constellation-drop-burst', 'dropEntry', 'burstImpulse', { amount: 1, attackMs: 0, releaseMs: 520, beatHoldMs: 90, decayMs: 620 }),
    route('constellation-drop-light', 'dropEntry', 'edgeBrightness', { amount: 0.9, attackMs: 0, releaseMs: 420, beatHoldMs: 70, decayMs: 520 }),
    route('constellation-drop-camera', 'dropEntry', 'cameraPunch', { amount: 0.9, attackMs: 0, releaseMs: 300, beatHoldMs: 45, decayMs: 360 }),
  ],
  stormGateway: [
    route('storm-snare-lightning', 'snare', 'lightning', { amount: 1, attackMs: 0, releaseMs: 160, beatHoldMs: 20, decayMs: 200 }),
    route('storm-transient-lightning', 'transientIntensity', 'lightning', { amount: 0.6, attackMs: 0, releaseMs: 130, threshold: 0.12 }),
    route('storm-energy-turbulence', 'overallEnergy', 'distortion', { amount: 0.72, attackMs: 60, releaseMs: 360 }),
    route('storm-bass-vortex', 'bass', 'portalAperture', { amount: 0.55, attackMs: 30, releaseMs: 280 }),
    route('storm-high-debris', 'highs', 'particleEmission', { amount: 0.5, attackMs: 24, releaseMs: 180 }),
  ],
}

export function createDefaultCinematicAudioRoutes(mode: CinematicWorldMode): CinematicAudioRoute[] {
  return (WORLD_DEFAULT_AUDIO_ROUTES[mode] ?? WORLD_DEFAULT_AUDIO_ROUTES.legacyPortal)
    .map(item => ({ ...item, sectionScale: { ...item.sectionScale } }))
}


export function createDefaultCinematicWorldConfig(): CinematicWorldConfig {
  return {
    schemaVersion: 1,
    worldMode: 'legacyPortal',
    worldSettings: createDefaultCinematicWorldSettings('legacyPortal'),
    portalShape: 'rectangle',
    cameraRig: 'locked',
    camera: createDefaultCinematicCameraConfig(),
    customMaskId: null,
    environment: {
      depth: CINEMATIC_NUMERIC_RANGES.environment.depth.default,
      architecture: CINEMATIC_NUMERIC_RANGES.environment.architecture.default,
      fog: CINEMATIC_NUMERIC_RANGES.environment.fog.default,
      debris: CINEMATIC_NUMERIC_RANGES.environment.debris.default,
      stars: CINEMATIC_NUMERIC_RANGES.environment.stars.default,
      atmosphere: CINEMATIC_NUMERIC_RANGES.environment.atmosphere.default,
    },
    material: {
      distortion: CINEMATIC_NUMERIC_RANGES.material.distortion.default,
      refraction: CINEMATIC_NUMERIC_RANGES.material.refraction.default,
      bloom: CINEMATIC_NUMERIC_RANGES.material.bloom.default,
      chromaticAberration: CINEMATIC_NUMERIC_RANGES.material.chromaticAberration.default,
      feedback: CINEMATIC_NUMERIC_RANGES.material.feedback.default,
      glow: CINEMATIC_NUMERIC_RANGES.material.glow.default,
    },
    audioMapping: {
      enabled: true,
      smoothingMs: CINEMATIC_NUMERIC_RANGES.audioSmoothingMs.default,
      routes: createDefaultCinematicAudioRoutes('legacyPortal'),
    },
    seed: CINEMATIC_NUMERIC_RANGES.seed.default,
    qualityTier: 'high',
    transition: {
      mode: 'crossfade',
      durationMs: CINEMATIC_NUMERIC_RANGES.transitionDurationMs.default,
      easing: 'easeInOut',
      preserveCamera: true,
    },
    compatibility: {
      legacyValues: {},
      extensions: {},
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clampRange(value: unknown, range: NumericRange): number {
  return Math.min(range.max, Math.max(range.min, finiteNumber(value, range.default)))
}

function enumValue<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? value as T[number]
    : fallback
}

function normalizedIdentifier(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[^a-z0-9]/gi, '').toLowerCase() : ''
}

const CINEMATIC_WORLD_MODE_ALIASES: Record<string, CinematicWorldMode> = {
  cinematicportal: 'legacyPortal',
  legacyportal: 'legacyPortal',
  eventhorizon: 'eventHorizon',
  infinitecorridor: 'infiniteCorridor',
  fracturerift: 'fractureRift',
  monolithgate: 'monolithGate',
  liquidmembrane: 'liquidMembrane',
  celestialcathedral: 'celestialCathedral',
  mirrordimension: 'mirrorDimension',
  ancientmachine: 'ancientMachine',
  stormgateway: 'stormGateway',
  reactiveconstellation: 'reactiveConstellation',
  constellation: 'reactiveConstellation',
  // Media Portal projects are no longer supported as a selectable world;
  // route older saved configs to the stable legacy renderer instead.
  mediaportal: 'legacyPortal',
}

const CINEMATIC_CAMERA_RIG_ALIASES: Record<string, CinematicCameraRig> = {
  static: 'locked',
  fixed: 'locked',
  push: 'dolly',
  pushin: 'dolly',
  rotate: 'orbit',
  fly: 'flyThrough',
  flythrough: 'flyThrough',
  shake: 'handheld',
  director: 'autoDirector',
  autodirector: 'autoDirector',
}

function normalizeWorldMode(value: unknown, fallback: CinematicWorldMode): CinematicWorldMode {
  const exact = enumValue(value, CINEMATIC_WORLD_MODES, fallback)
  if (exact !== fallback || value === fallback) return exact
  return CINEMATIC_WORLD_MODE_ALIASES[normalizedIdentifier(value)] ?? fallback
}

function normalizeCameraRig(value: unknown, fallback: CinematicCameraRig): CinematicCameraRig {
  const exact = enumValue(value, CINEMATIC_CAMERA_RIGS, fallback)
  if (exact !== fallback || value === fallback) return exact
  return CINEMATIC_CAMERA_RIG_ALIASES[normalizedIdentifier(value)] ?? fallback
}

function durableReference(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const reference = value.trim()
  return reference && !/^(blob:|data:)/i.test(reference) ? reference : null
}

function collectUnknown(
  source: Record<string, unknown>,
  knownKeys: readonly string[],
  prefix = '',
): Record<string, unknown> {
  const known = new Set(knownKeys)
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => !known.has(key))
      .map(([key, value]) => [`${prefix}${key}`, value]),
  )
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, finiteNumber(value, fallback)))
}

function normalizeCameraDirection(value: unknown, fallback: -1 | 1): -1 | 1 {
  return value === -1 ? -1 : value === 1 ? 1 : fallback
}

function normalizeCameraVector(
  value: unknown,
  fallback: CinematicCameraVectorConfig,
  min: number,
  max: number,
): CinematicCameraVectorConfig {
  const source = isRecord(value) ? value : {}
  return {
    x: clampNumber(source.x, fallback.x, min, max),
    y: clampNumber(source.y, fallback.y, min, max),
    z: clampNumber(source.z, fallback.z, min, max),
  }
}

export function normalizeCinematicCameraConfig(value: unknown): CinematicCameraConfig {
  const defaults = createDefaultCinematicCameraConfig()
  const source = isRecord(value) ? value : {}
  const locked = isRecord(source.locked) ? source.locked : {}
  const dolly = isRecord(source.dolly) ? source.dolly : {}
  const orbit = isRecord(source.orbit) ? source.orbit : {}
  const flyThrough = isRecord(source.flyThrough) ? source.flyThrough : {}
  const handheld = isRecord(source.handheld) ? source.handheld : {}
  const autoDirector = isRecord(source.autoDirector) ? source.autoDirector : {}
  const overrideRig = autoDirector.manualOverrideRig

  return {
    locked: {
      position: normalizeCameraVector(locked.position, defaults.locked.position, -8, 8),
      rotation: normalizeCameraVector(locked.rotation, defaults.locked.rotation, -Math.PI, Math.PI),
      fieldOfView: clampNumber(locked.fieldOfView, defaults.locked.fieldOfView, 20, 110),
      breathingStrength: clampNumber(locked.breathingStrength, defaults.locked.breathingStrength, 0, 0.18),
      breathingFrequency: clampNumber(locked.breathingFrequency, defaults.locked.breathingFrequency, 0, 2),
      beatPunch: clampNumber(locked.beatPunch, defaults.locked.beatPunch, 0, 0.6),
    },
    dolly: {
      range: clampNumber(dolly.range, defaults.dolly.range, 0, 6),
      speed: clampNumber(dolly.speed, defaults.dolly.speed, 0, 3),
      direction: normalizeCameraDirection(dolly.direction, defaults.dolly.direction),
      easing: enumValue(dolly.easing, CINEMATIC_CAMERA_EASINGS, defaults.dolly.easing),
      beatAcceleration: clampNumber(dolly.beatAcceleration, defaults.dolly.beatAcceleration, 0, 2),
      buildAcceleration: clampNumber(dolly.buildAcceleration, defaults.dolly.buildAcceleration, 0, 3),
    },
    orbit: {
      radius: clampNumber(orbit.radius, defaults.orbit.radius, 0.2, 8),
      elevation: clampNumber(orbit.elevation, defaults.orbit.elevation, -2, 2),
      angularSpeed: clampNumber(orbit.angularSpeed, defaults.orbit.angularSpeed, 0, 3),
      direction: normalizeCameraDirection(orbit.direction, defaults.orbit.direction),
      sectionAware: typeof orbit.sectionAware === 'boolean' ? orbit.sectionAware : defaults.orbit.sectionAware,
      safeMargin: clampNumber(orbit.safeMargin, defaults.orbit.safeMargin, 0, 1),
    },
    flyThrough: {
      speed: clampNumber(flyThrough.speed, defaults.flyThrough.speed, 0, 4),
      speedModulation: clampNumber(flyThrough.speedModulation, defaults.flyThrough.speedModulation, 0, 3),
      banking: clampNumber(flyThrough.banking, defaults.flyThrough.banking, 0, 0.8),
      loop: typeof flyThrough.loop === 'boolean' ? flyThrough.loop : defaults.flyThrough.loop,
    },
    handheld: {
      driftStrength: clampNumber(handheld.driftStrength, defaults.handheld.driftStrength, 0, 0.25),
      impactShake: clampNumber(handheld.impactShake, defaults.handheld.impactShake, 0, 0.4),
      damping: clampNumber(handheld.damping, defaults.handheld.damping, 0.5, 30),
      strength: clampNumber(handheld.strength, defaults.handheld.strength, 0, 1),
      frequency: clampNumber(handheld.frequency, defaults.handheld.frequency, 0.05, 3),
      maxTranslation: clampNumber(handheld.maxTranslation, defaults.handheld.maxTranslation, 0, 0.25),
      maxRotation: clampNumber(handheld.maxRotation, defaults.handheld.maxRotation, 0, 0.12),
    },
    autoDirector: {
      strength: clampNumber(autoDirector.strength, defaults.autoDirector.strength, 0, 1),
      cameraActivity: clampNumber(autoDirector.cameraActivity, defaults.autoDirector.cameraActivity, 0, 1),
      transitionFrequency: clampNumber(autoDirector.transitionFrequency, defaults.autoDirector.transitionFrequency, 0, 1),
      dropImpact: clampNumber(autoDirector.dropImpact, defaults.autoDirector.dropImpact, 0, 1),
      buildIntensity: clampNumber(autoDirector.buildIntensity, defaults.autoDirector.buildIntensity, 0, 1),
      minimumShotDurationSec: clampNumber(
        autoDirector.minimumShotDurationSec,
        defaults.autoDirector.minimumShotDurationSec,
        1,
        32,
      ),
      transitionDurationSec: clampNumber(
        autoDirector.transitionDurationSec,
        defaults.autoDirector.transitionDurationSec,
        0,
        8,
      ),
      preferMusicalBoundaries: typeof autoDirector.preferMusicalBoundaries === 'boolean'
        ? autoDirector.preferMusicalBoundaries
        : defaults.autoDirector.preferMusicalBoundaries,
      repeatAvoidance: Math.round(clampNumber(
        autoDirector.repeatAvoidance,
        defaults.autoDirector.repeatAvoidance,
        0,
        8,
      )),
      manualOverrideRig: typeof overrideRig === 'string'
        && overrideRig !== 'autoDirector'
        && (CINEMATIC_CAMERA_RIGS as readonly string[]).includes(overrideRig)
          ? overrideRig as Exclude<CinematicCameraRig, 'autoDirector'>
          : null,
      lockUntilNextSection: typeof autoDirector.lockUntilNextSection === 'boolean'
        ? autoDirector.lockUntilNextSection
        : defaults.autoDirector.lockUntilNextSection,
      manualCameraLock: typeof autoDirector.manualCameraLock === 'boolean'
        ? autoDirector.manualCameraLock
        : defaults.autoDirector.manualCameraLock,
    },
  }
}

function normalizeSectionScale(value: unknown): Partial<Record<CinematicSectionScaleKey, number>> {
  if (!isRecord(value)) return {}
  const result: Partial<Record<CinematicSectionScaleKey, number>> = {}
  for (const key of CINEMATIC_SECTION_SCALE_KEYS) {
    if (value[key] !== undefined) {
      result[key] = clampRange(value[key], CINEMATIC_NUMERIC_RANGES.audioRoute.sectionScale)
    }
  }
  return result
}

function normalizeAudioRoutes(
  value: unknown,
  extensions: Record<string, unknown>,
  mode: CinematicWorldMode,
): CinematicAudioRoute[] {
  if (!Array.isArray(value)) return createDefaultCinematicAudioRoutes(mode)

  return value.flatMap((raw, index) => {
    if (!isRecord(raw)) {
      extensions[`audioMapping.routes.${index}`] = raw
      return []
    }
    Object.assign(extensions, collectUnknown(
      raw,
      [
        'id', 'enabled', 'source', 'target', 'amount', 'attackMs', 'releaseMs',
        'smoothingMs', 'gain', 'bias', 'threshold', 'responseCurve', 'clampMin',
        'clampMax', 'invert', 'beatHoldMs', 'decayMs', 'randomizationAmount',
        'sectionScale',
      ],
      `audioMapping.routes.${index}.`,
    ))
    if (isRecord(raw.sectionScale)) {
      Object.assign(extensions, collectUnknown(
        raw.sectionScale,
        CINEMATIC_SECTION_SCALE_KEYS,
        `audioMapping.routes.${index}.sectionScale.`,
      ))
    }
    const clampMin = clampRange(raw.clampMin, CINEMATIC_NUMERIC_RANGES.audioRoute.clampMin)
    const clampMax = Math.max(
      clampMin,
      clampRange(raw.clampMax, CINEMATIC_NUMERIC_RANGES.audioRoute.clampMax),
    )
    return [{
      id: typeof raw.id === 'string' && raw.id ? raw.id : `cinematic-route-${index + 1}`,
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
      source: enumValue(raw.source, CINEMATIC_AUDIO_SOURCES, 'bass'),
      target: enumValue(raw.target, CINEMATIC_AUDIO_TARGETS, 'glow'),
      amount: clampRange(raw.amount, CINEMATIC_NUMERIC_RANGES.audioRoute.amount),
      attackMs: clampRange(raw.attackMs, CINEMATIC_NUMERIC_RANGES.audioRoute.attackMs),
      releaseMs: clampRange(raw.releaseMs, CINEMATIC_NUMERIC_RANGES.audioRoute.releaseMs),
      smoothingMs: clampRange(raw.smoothingMs, CINEMATIC_NUMERIC_RANGES.audioRoute.smoothingMs),
      gain: clampRange(raw.gain, CINEMATIC_NUMERIC_RANGES.audioRoute.gain),
      bias: clampRange(raw.bias, CINEMATIC_NUMERIC_RANGES.audioRoute.bias),
      threshold: clampRange(raw.threshold, CINEMATIC_NUMERIC_RANGES.audioRoute.threshold),
      responseCurve: enumValue(raw.responseCurve, CINEMATIC_RESPONSE_CURVES, 'linear'),
      clampMin,
      clampMax,
      invert: typeof raw.invert === 'boolean' ? raw.invert : false,
      beatHoldMs: clampRange(raw.beatHoldMs, CINEMATIC_NUMERIC_RANGES.audioRoute.beatHoldMs),
      decayMs: clampRange(raw.decayMs, CINEMATIC_NUMERIC_RANGES.audioRoute.decayMs),
      randomizationAmount: clampRange(
        raw.randomizationAmount,
        CINEMATIC_NUMERIC_RANGES.audioRoute.randomizationAmount,
      ),
      sectionScale: normalizeSectionScale(raw.sectionScale),
    }]
  })
}


/**
 * Converts legacy/partial/untrusted portal configuration into the current
 * strongly typed contract. Unknown fields are retained under compatibility.
 */
export function normalizeCinematicWorldConfig(
  value: unknown,
  legacyValues: Record<string, unknown> = {},
): CinematicWorldConfig {
  const defaults = createDefaultCinematicWorldConfig()
  const source = isRecord(value) ? value : {}
  const environment = isRecord(source.environment) ? source.environment : {}
  const material = isRecord(source.material) ? source.material : {}
  const audioMapping = isRecord(source.audioMapping) ? source.audioMapping : {}
  const camera = isRecord(source.camera) ? source.camera : {}
  const transition = isRecord(source.transition) ? source.transition : {}
  const fogControls = isRecord(source.fogControls) ? source.fogControls : {}
  const particleControls = isRecord(source.particleControls) ? source.particleControls : {}
  const compatibility = isRecord(source.compatibility) ? source.compatibility : {}
  const priorLegacy = isRecord(compatibility.legacyValues) ? compatibility.legacyValues : {}
  const priorExtensions = isRecord(compatibility.extensions) ? compatibility.extensions : {}

  const extensions: Record<string, unknown> = {
    ...priorExtensions,
    ...collectUnknown(source, [
      'schemaVersion', 'worldMode', 'worldSettings', 'portalShape', 'cameraRig', 'camera', 'customMaskId',
      'environment', 'material', 'audioMapping', 'seed', 'qualityTier',
      'transition', 'compatibility',
    ]),
    ...collectUnknown(environment, ['depth', 'architecture', 'fog', 'debris', 'stars', 'atmosphere'], 'environment.'),
    ...collectUnknown(material, ['distortion', 'refraction', 'bloom', 'chromaticAberration', 'feedback', 'glow'], 'material.'),
    ...collectUnknown(audioMapping, ['enabled', 'smoothingMs', 'routes'], 'audioMapping.'),
    ...collectUnknown(camera, ['locked', 'dolly', 'orbit', 'flyThrough', 'handheld', 'autoDirector'], 'camera.'),
    ...collectUnknown(transition, ['mode', 'durationMs', 'easing', 'preserveCamera'], 'transition.'),
    ...collectUnknown(compatibility, ['legacyValues', 'extensions'], 'compatibility.'),
  }

  const rawSeed = clampRange(source.seed ?? source.randomSeed, CINEMATIC_NUMERIC_RANGES.seed)
  const worldMode = normalizeWorldMode(source.worldMode ?? source.world ?? source.mode ?? source.displayName, defaults.worldMode)
  const worldSettings = source.worldSettings ?? source.settings

  return {
    schemaVersion: 1,
    worldMode,
    worldSettings: normalizeCinematicWorldSettings(worldMode, worldSettings),
    portalShape: enumValue(source.portalShape ?? source.shape, CINEMATIC_PORTAL_SHAPES, defaults.portalShape),
    cameraRig: normalizeCameraRig(source.cameraRig ?? source.cameraMode, defaults.cameraRig),
    camera: normalizeCinematicCameraConfig(source.camera),
    customMaskId: durableReference(source.customMaskId ?? source.maskId),
    environment: {
      depth: clampRange(environment.depth, CINEMATIC_NUMERIC_RANGES.environment.depth),
      architecture: clampRange(environment.architecture, CINEMATIC_NUMERIC_RANGES.environment.architecture),
      fog: clampRange(environment.fog ?? source.fogDensity ?? fogControls.density ?? fogControls.amount, CINEMATIC_NUMERIC_RANGES.environment.fog),
      debris: clampRange(environment.debris ?? source.particleDensity ?? particleControls.density ?? particleControls.amount, CINEMATIC_NUMERIC_RANGES.environment.debris),
      stars: clampRange(environment.stars, CINEMATIC_NUMERIC_RANGES.environment.stars),
      atmosphere: clampRange(environment.atmosphere, CINEMATIC_NUMERIC_RANGES.environment.atmosphere),
    },
    material: {
      distortion: clampRange(material.distortion, CINEMATIC_NUMERIC_RANGES.material.distortion),
      refraction: clampRange(material.refraction, CINEMATIC_NUMERIC_RANGES.material.refraction),
      bloom: clampRange(material.bloom, CINEMATIC_NUMERIC_RANGES.material.bloom),
      chromaticAberration: clampRange(material.chromaticAberration, CINEMATIC_NUMERIC_RANGES.material.chromaticAberration),
      feedback: clampRange(material.feedback, CINEMATIC_NUMERIC_RANGES.material.feedback),
      glow: clampRange(material.glow, CINEMATIC_NUMERIC_RANGES.material.glow),
    },
    audioMapping: {
      enabled: typeof audioMapping.enabled === 'boolean' ? audioMapping.enabled : defaults.audioMapping.enabled,
      smoothingMs: clampRange(audioMapping.smoothingMs, CINEMATIC_NUMERIC_RANGES.audioSmoothingMs),
      routes: normalizeAudioRoutes(audioMapping.routes, extensions, worldMode),
    },
    seed: Math.trunc(rawSeed) >>> 0,
    qualityTier: enumValue(source.qualityTier ?? source.quality, CINEMATIC_QUALITY_TIERS, defaults.qualityTier),
    transition: {
      mode: enumValue(transition.mode ?? source.transitionMode, CINEMATIC_TRANSITION_MODES, defaults.transition.mode),
      durationMs: clampRange(transition.durationMs ?? source.transitionDurationMs, CINEMATIC_NUMERIC_RANGES.transitionDurationMs),
      easing: enumValue(transition.easing, CINEMATIC_TRANSITION_EASINGS, defaults.transition.easing),
      preserveCamera: typeof transition.preserveCamera === 'boolean'
        ? transition.preserveCamera
        : defaults.transition.preserveCamera,
    },
    compatibility: {
      legacyValues: { ...priorLegacy, ...legacyValues },
      extensions,
    },
  }
}

export interface CinematicWorldConfigOverrides {
  portalShape?: CinematicPortalShape
  cameraRig?: CinematicCameraRig
  camera?: Partial<CinematicCameraConfig>
  customMaskId?: string | null
  environment?: Partial<CinematicEnvironmentControls>
  material?: Partial<CinematicMaterialControls>
  audioMapping?: Partial<CinematicAudioMappingConfig>
  seed?: number
  qualityTier?: CinematicQualityTier
  transition?: Partial<CinematicTransitionConfig>
  compatibility?: Partial<CinematicCompatibilityData>
}

/**
 * Preset-facing constructor that keeps world-specific controls isolated from
 * shared environment/material controls while still returning one normalized
 * CinematicWorldConfig payload.
 */
export function createCinematicWorldConfig<Mode extends CinematicWorldMode>(
  mode: Mode,
  settings: Partial<CinematicWorldSettingsByMode[Mode]>,
  overrides: CinematicWorldConfigOverrides = {},
): CinematicWorldConfig {
  const defaults = createDefaultCinematicWorldConfig()
  return normalizeCinematicWorldConfig({
    ...defaults,
    ...overrides,
    worldMode: mode,
    worldSettings: {
      mode,
      settings,
    },
    camera: {
      ...defaults.camera,
      ...overrides.camera,
      locked: { ...defaults.camera.locked, ...overrides.camera?.locked },
      dolly: { ...defaults.camera.dolly, ...overrides.camera?.dolly },
      orbit: { ...defaults.camera.orbit, ...overrides.camera?.orbit },
      flyThrough: { ...defaults.camera.flyThrough, ...overrides.camera?.flyThrough },
      handheld: { ...defaults.camera.handheld, ...overrides.camera?.handheld },
      autoDirector: { ...defaults.camera.autoDirector, ...overrides.camera?.autoDirector },
    },
    environment: {
      ...defaults.environment,
      ...overrides.environment,
    },
    material: {
      ...defaults.material,
      ...overrides.material,
    },
    audioMapping: {
      ...defaults.audioMapping,
      ...overrides.audioMapping,
      routes: overrides.audioMapping?.routes ?? createDefaultCinematicAudioRoutes(mode),
    },
    transition: {
      ...defaults.transition,
      ...overrides.transition,
    },
    compatibility: {
      legacyValues: {
        ...defaults.compatibility.legacyValues,
        ...overrides.compatibility?.legacyValues,
      },
      extensions: {
        ...defaults.compatibility.extensions,
        ...overrides.compatibility?.extensions,
      },
    },
  })
}


export interface LegacyPortalConfigValues {
  intensity?: number
  motion?: number
  glow?: number
  bassReactivity?: number
  trailDecay?: number
  fogDensity?: number
  particleDensity?: number
}

/**
 * Maps the original Portal controls onto their closest Cinematic Worlds fields
 * while retaining the complete legacy payload under compatibility. The legacy
 * Canvas renderer continues to consume the original controls during Patch 1.
 */
export function createLegacyPortalCinematicConfig(
  values: LegacyPortalConfigValues,
  preservedValues: Record<string, unknown> = {},
): CinematicWorldConfig {
  const defaults = createDefaultCinematicWorldConfig()
  const bassRoute = defaults.audioMapping.routes.find(route => route.id === 'legacy-bass-glow')
  return normalizeCinematicWorldConfig({
    ...defaults,
    worldMode: 'legacyPortal',
    portalShape: 'rectangle',
    cameraRig: 'locked',
    environment: {
      ...defaults.environment,
      fog: values.fogDensity ?? defaults.environment.fog,
      debris: values.particleDensity ?? defaults.environment.debris,
      atmosphere: values.intensity ?? defaults.environment.atmosphere,
    },
    material: {
      ...defaults.material,
      glow: values.glow ?? defaults.material.glow,
    },
    audioMapping: {
      ...defaults.audioMapping,
      routes: defaults.audioMapping.routes.map(route => route.id === bassRoute?.id
        ? { ...route, amount: values.bassReactivity ?? route.amount }
        : route),
    },
  }, {
    ...preservedValues,
    legacyPortalControls: { ...values },
  })
}

/** A tiny deterministic PRNG suitable for repeatable visual simulation. */
export function createCinematicSeededRandom(seed: number): () => number {
  let state = (Math.trunc(seed) >>> 0) || 0x6d2b79f5
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
