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
  'mediaPortal',
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

export const CINEMATIC_QUALITY_TIERS = ['low', 'medium', 'high', 'ultra'] as const
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
  stormGateway: [
    route('storm-snare-lightning', 'snare', 'lightning', { amount: 1, attackMs: 0, releaseMs: 160, beatHoldMs: 20, decayMs: 200 }),
    route('storm-transient-lightning', 'transientIntensity', 'lightning', { amount: 0.6, attackMs: 0, releaseMs: 130, threshold: 0.12 }),
    route('storm-energy-turbulence', 'overallEnergy', 'distortion', { amount: 0.72, attackMs: 60, releaseMs: 360 }),
    route('storm-bass-vortex', 'bass', 'portalAperture', { amount: 0.55, attackMs: 30, releaseMs: 280 }),
    route('storm-high-debris', 'highs', 'particleEmission', { amount: 0.5, attackMs: 24, releaseMs: 180 }),
  ],
  mediaPortal: [],
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
  const transition = isRecord(source.transition) ? source.transition : {}
  const compatibility = isRecord(source.compatibility) ? source.compatibility : {}
  const priorLegacy = isRecord(compatibility.legacyValues) ? compatibility.legacyValues : {}
  const priorExtensions = isRecord(compatibility.extensions) ? compatibility.extensions : {}

  const extensions: Record<string, unknown> = {
    ...priorExtensions,
    ...collectUnknown(source, [
      'schemaVersion', 'worldMode', 'worldSettings', 'portalShape', 'cameraRig', 'customMaskId',
      'environment', 'material', 'audioMapping', 'seed', 'qualityTier',
      'transition', 'compatibility',
    ]),
    ...collectUnknown(environment, ['depth', 'architecture', 'fog', 'debris', 'stars', 'atmosphere'], 'environment.'),
    ...collectUnknown(material, ['distortion', 'refraction', 'bloom', 'chromaticAberration', 'feedback', 'glow'], 'material.'),
    ...collectUnknown(audioMapping, ['enabled', 'smoothingMs', 'routes'], 'audioMapping.'),
    ...collectUnknown(transition, ['mode', 'durationMs', 'easing', 'preserveCamera'], 'transition.'),
    ...collectUnknown(compatibility, ['legacyValues', 'extensions'], 'compatibility.'),
  }

  const rawSeed = clampRange(source.seed, CINEMATIC_NUMERIC_RANGES.seed)
  const worldMode = enumValue(source.worldMode, CINEMATIC_WORLD_MODES, defaults.worldMode)

  return {
    schemaVersion: 1,
    worldMode,
    worldSettings: normalizeCinematicWorldSettings(worldMode, source.worldSettings),
    portalShape: enumValue(source.portalShape, CINEMATIC_PORTAL_SHAPES, defaults.portalShape),
    cameraRig: enumValue(source.cameraRig, CINEMATIC_CAMERA_RIGS, defaults.cameraRig),
    customMaskId: typeof source.customMaskId === 'string' && source.customMaskId
      ? source.customMaskId
      : null,
    environment: {
      depth: clampRange(environment.depth, CINEMATIC_NUMERIC_RANGES.environment.depth),
      architecture: clampRange(environment.architecture, CINEMATIC_NUMERIC_RANGES.environment.architecture),
      fog: clampRange(environment.fog, CINEMATIC_NUMERIC_RANGES.environment.fog),
      debris: clampRange(environment.debris, CINEMATIC_NUMERIC_RANGES.environment.debris),
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
    qualityTier: enumValue(source.qualityTier, CINEMATIC_QUALITY_TIERS, defaults.qualityTier),
    transition: {
      mode: enumValue(transition.mode, CINEMATIC_TRANSITION_MODES, defaults.transition.mode),
      durationMs: clampRange(transition.durationMs, CINEMATIC_NUMERIC_RANGES.transitionDurationMs),
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
