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

export const CINEMATIC_AUDIO_SOURCES = [
  'bass',
  'mid',
  'high',
  'volume',
  'beat',
  'kick',
  'snare',
  'sectionEnergy',
] as const
export type CinematicAudioSource = typeof CINEMATIC_AUDIO_SOURCES[number]

export const CINEMATIC_AUDIO_TARGETS = [
  'depth',
  'fog',
  'debris',
  'atmosphere',
  'distortion',
  'refraction',
  'bloom',
  'chromaticAberration',
  'feedback',
  'glow',
  'cameraMotion',
  'portalPulse',
] as const
export type CinematicAudioTarget = typeof CINEMATIC_AUDIO_TARGETS[number]

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
    amount:    { min: -2, max: 2, default: 0, description: 'Signed modulation depth.' },
    attackMs:  { min: 0, max: 2000, default: 40, description: 'Attack smoothing in milliseconds.' },
    releaseMs: { min: 0, max: 4000, default: 220, description: 'Release smoothing in milliseconds.' },
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
  /** -2–2. Signed modulation depth. */
  amount: number
  /** 0–2000 ms. */
  attackMs: number
  /** 0–4000 ms. */
  releaseMs: number
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

const DEFAULT_AUDIO_ROUTES: CinematicAudioRoute[] = [
  { id: 'legacy-bass-glow', enabled: true, source: 'bass', target: 'glow', amount: 0.7, attackMs: 30, releaseMs: 180 },
  { id: 'legacy-beat-pulse', enabled: true, source: 'beat', target: 'portalPulse', amount: 1, attackMs: 0, releaseMs: 180 },
  { id: 'legacy-volume-atmosphere', enabled: true, source: 'volume', target: 'atmosphere', amount: 0.4, attackMs: 80, releaseMs: 300 },
]

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
      routes: DEFAULT_AUDIO_ROUTES.map(route => ({ ...route })),
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

function normalizeAudioRoutes(value: unknown, extensions: Record<string, unknown>): CinematicAudioRoute[] {
  if (!Array.isArray(value)) return DEFAULT_AUDIO_ROUTES.map(route => ({ ...route }))

  return value.flatMap((raw, index) => {
    if (!isRecord(raw)) {
      extensions[`audioMapping.routes.${index}`] = raw
      return []
    }
    Object.assign(extensions, collectUnknown(
      raw,
      ['id', 'enabled', 'source', 'target', 'amount', 'attackMs', 'releaseMs'],
      `audioMapping.routes.${index}.`,
    ))
    return [{
      id: typeof raw.id === 'string' && raw.id ? raw.id : `cinematic-route-${index + 1}`,
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
      source: enumValue(raw.source, CINEMATIC_AUDIO_SOURCES, 'bass'),
      target: enumValue(raw.target, CINEMATIC_AUDIO_TARGETS, 'glow'),
      amount: clampRange(raw.amount, CINEMATIC_NUMERIC_RANGES.audioRoute.amount),
      attackMs: clampRange(raw.attackMs, CINEMATIC_NUMERIC_RANGES.audioRoute.attackMs),
      releaseMs: clampRange(raw.releaseMs, CINEMATIC_NUMERIC_RANGES.audioRoute.releaseMs),
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
      routes: normalizeAudioRoutes(audioMapping.routes, extensions),
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
      routes: overrides.audioMapping?.routes ?? defaults.audioMapping.routes,
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
