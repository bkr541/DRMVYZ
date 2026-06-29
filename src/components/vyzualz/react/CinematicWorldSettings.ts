import type { CinematicWorldMode } from './CinematicWorldConfig'

export const IMPLEMENTED_CINEMATIC_WORLD_MODES = [
  'eventHorizon',
  'infiniteCorridor',
  'fractureRift',
  'monolithGate',
] as const

export type ImplementedCinematicWorldMode = typeof IMPLEMENTED_CINEMATIC_WORLD_MODES[number]

export interface EventHorizonSettings {
  coreRadius: number
  ringRadius: number
  ringThickness: number
  accretionTilt: number
  lensingStrength: number
  depthLayers: number
  rotationSpeed: number
  shockwaveStrength: number
  dropExpansion: number
  bloomBoost: number
  chromaticAberrationBoost: number
}

export interface InfiniteCorridorSettings {
  corridorDensity: number
  travelSpeed: number
  tunnelWidth: number
  archThickness: number
  alternatingLights: number
  fogDensity: number
  cameraSway: number
  vanishingOffset: number
  structureStyle: number
}

export interface FractureRiftSettings {
  openingAmount: number
  edgeComplexity: number
  shardDensity: number
  crackPropagation: number
  fractureMotion: number
  innerDepth: number
  shardDrift: number
  openingShape: number
  innerSurface: number
}

export interface MonolithGateSettings {
  gateScale: number
  columnCount: number
  slabDepth: number
  ringCount: number
  lightShaftIntensity: number
  glyphDensity: number
  openingAmount: number
  lockStrength: number
  cameraTravel: number
  architectureStyle: number
}

export type EmptyCinematicWorldSettings = Record<string, never>

export interface CinematicWorldSettingsByMode {
  legacyPortal: EmptyCinematicWorldSettings
  eventHorizon: EventHorizonSettings
  infiniteCorridor: InfiniteCorridorSettings
  fractureRift: FractureRiftSettings
  monolithGate: MonolithGateSettings
  liquidMembrane: EmptyCinematicWorldSettings
  celestialCathedral: EmptyCinematicWorldSettings
  mirrorDimension: EmptyCinematicWorldSettings
  ancientMachine: EmptyCinematicWorldSettings
  stormGateway: EmptyCinematicWorldSettings
  mediaPortal: EmptyCinematicWorldSettings
}

export type CinematicWorldSpecificConfig = {
  [Mode in CinematicWorldMode]: {
    mode: Mode
    settings: CinematicWorldSettingsByMode[Mode]
  }
}[CinematicWorldMode]

export interface CinematicSeededVariation {
  phase: number
  skew: number
  density: number
  motion: number
}

type NumericBounds<T extends object> = {
  [Key in keyof T]: readonly [min: number, max: number]
}

export const EVENT_HORIZON_DEFAULTS: EventHorizonSettings = {
  coreRadius: 0.19,
  ringRadius: 0.34,
  ringThickness: 0.065,
  accretionTilt: 0.42,
  lensingStrength: 0.72,
  depthLayers: 4,
  rotationSpeed: 0.32,
  shockwaveStrength: 0.72,
  dropExpansion: 0.24,
  bloomBoost: 0.18,
  chromaticAberrationBoost: 0.08,
}

export const EVENT_HORIZON_BOUNDS: NumericBounds<EventHorizonSettings> = {
  coreRadius: [0.08, 0.34],
  ringRadius: [0.20, 0.62],
  ringThickness: [0.015, 0.18],
  accretionTilt: [-0.95, 0.95],
  lensingStrength: [0, 1.5],
  depthLayers: [1, 7],
  rotationSpeed: [-1.5, 1.5],
  shockwaveStrength: [0, 1.5],
  dropExpansion: [0, 0.55],
  bloomBoost: [0, 0.6],
  chromaticAberrationBoost: [0, 0.45],
}

export const INFINITE_CORRIDOR_DEFAULTS: InfiniteCorridorSettings = {
  corridorDensity: 0.58,
  travelSpeed: 0.48,
  tunnelWidth: 0.72,
  archThickness: 0.055,
  alternatingLights: 0.72,
  fogDensity: 0.46,
  cameraSway: 0.14,
  vanishingOffset: 0,
  structureStyle: 0,
}

export const INFINITE_CORRIDOR_BOUNDS: NumericBounds<InfiniteCorridorSettings> = {
  corridorDensity: [0.15, 1],
  travelSpeed: [0, 1.8],
  tunnelWidth: [0.38, 1.25],
  archThickness: [0.015, 0.16],
  alternatingLights: [0, 1.5],
  fogDensity: [0, 1],
  cameraSway: [0, 0.55],
  vanishingOffset: [-0.42, 0.42],
  structureStyle: [0, 2],
}

export const FRACTURE_RIFT_DEFAULTS: FractureRiftSettings = {
  openingAmount: 0.56,
  edgeComplexity: 0.62,
  shardDensity: 0.54,
  crackPropagation: 0.48,
  fractureMotion: 0.58,
  innerDepth: 0.70,
  shardDrift: 0.42,
  openingShape: 0,
  innerSurface: 0,
}

export const FRACTURE_RIFT_BOUNDS: NumericBounds<FractureRiftSettings> = {
  openingAmount: [0.12, 1],
  edgeComplexity: [0, 1.5],
  shardDensity: [0, 1],
  crackPropagation: [0, 1.5],
  fractureMotion: [0, 1.5],
  innerDepth: [0, 1.5],
  shardDrift: [0, 1.5],
  openingShape: [0, 2],
  innerSurface: [0, 2],
}

export const MONOLITH_GATE_DEFAULTS: MonolithGateSettings = {
  gateScale: 0.76,
  columnCount: 5,
  slabDepth: 0.62,
  ringCount: 3,
  lightShaftIntensity: 0.72,
  glyphDensity: 0.54,
  openingAmount: 0.42,
  lockStrength: 0.48,
  cameraTravel: 0.16,
  architectureStyle: 0,
}

export const MONOLITH_GATE_BOUNDS: NumericBounds<MonolithGateSettings> = {
  gateScale: [0.42, 1.15],
  columnCount: [2, 9],
  slabDepth: [0.1, 1.5],
  ringCount: [0, 6],
  lightShaftIntensity: [0, 1.5],
  glyphDensity: [0, 1],
  openingAmount: [0, 1],
  lockStrength: [0, 1],
  cameraTravel: [0, 0.75],
  architectureStyle: [0, 2],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clampNumber(value: unknown, fallback: number, bounds: readonly [number, number]): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(bounds[1], Math.max(bounds[0], number))
}

function normalizeNumericSettings<T extends object>(
  raw: unknown,
  defaults: T,
  bounds: NumericBounds<T>,
  integerKeys: readonly (keyof T)[] = [],
): T {
  const source = isRecord(raw) ? raw : {}
  const integers = new Set<keyof T>(integerKeys)
  const entries = Object.keys(defaults).map((key) => {
    const typedKey = key as keyof T
    const fallback = defaults[typedKey] as number
    const bounded = clampNumber(source[key], fallback, bounds[typedKey])
    return [key, integers.has(typedKey) ? Math.round(bounded) : bounded]
  })
  return Object.fromEntries(entries) as T
}

function settingsPayload(value: unknown, mode: CinematicWorldMode): unknown {
  if (!isRecord(value)) return value
  if ('mode' in value && value.mode !== mode) return undefined
  return 'settings' in value ? value.settings : value
}

export function createDefaultCinematicWorldSettings(mode: CinematicWorldMode): CinematicWorldSpecificConfig {
  switch (mode) {
    case 'eventHorizon': return { mode, settings: { ...EVENT_HORIZON_DEFAULTS } }
    case 'infiniteCorridor': return { mode, settings: { ...INFINITE_CORRIDOR_DEFAULTS } }
    case 'fractureRift': return { mode, settings: { ...FRACTURE_RIFT_DEFAULTS } }
    case 'monolithGate': return { mode, settings: { ...MONOLITH_GATE_DEFAULTS } }
    default: return { mode, settings: {} } as CinematicWorldSpecificConfig
  }
}

export function normalizeCinematicWorldSettings(
  mode: CinematicWorldMode,
  value: unknown,
): CinematicWorldSpecificConfig {
  const payload = settingsPayload(value, mode)
  switch (mode) {
    case 'eventHorizon':
      return {
        mode,
        settings: normalizeNumericSettings(payload, EVENT_HORIZON_DEFAULTS, EVENT_HORIZON_BOUNDS, ['depthLayers']),
      }
    case 'infiniteCorridor':
      return {
        mode,
        settings: normalizeNumericSettings(payload, INFINITE_CORRIDOR_DEFAULTS, INFINITE_CORRIDOR_BOUNDS, ['structureStyle']),
      }
    case 'fractureRift':
      return {
        mode,
        settings: normalizeNumericSettings(payload, FRACTURE_RIFT_DEFAULTS, FRACTURE_RIFT_BOUNDS, ['openingShape', 'innerSurface']),
      }
    case 'monolithGate':
      return {
        mode,
        settings: normalizeNumericSettings(payload, MONOLITH_GATE_DEFAULTS, MONOLITH_GATE_BOUNDS, [
          'columnCount', 'ringCount', 'architectureStyle',
        ]),
      }
    default:
      return { mode, settings: {} } as CinematicWorldSpecificConfig
  }
}

export function resolveEventHorizonSettings(value: CinematicWorldSpecificConfig): EventHorizonSettings {
  return normalizeCinematicWorldSettings('eventHorizon', value).settings as EventHorizonSettings
}

export function resolveInfiniteCorridorSettings(value: CinematicWorldSpecificConfig): InfiniteCorridorSettings {
  return normalizeCinematicWorldSettings('infiniteCorridor', value).settings as InfiniteCorridorSettings
}

export function resolveFractureRiftSettings(value: CinematicWorldSpecificConfig): FractureRiftSettings {
  return normalizeCinematicWorldSettings('fractureRift', value).settings as FractureRiftSettings
}

export function resolveMonolithGateSettings(value: CinematicWorldSpecificConfig): MonolithGateSettings {
  return normalizeCinematicWorldSettings('monolithGate', value).settings as MonolithGateSettings
}

function modeSalt(mode: CinematicWorldMode): number {
  let hash = 2166136261 >>> 0
  for (let index = 0; index < mode.length; index += 1) {
    hash ^= mode.charCodeAt(index)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function createCinematicSeededVariation(
  mode: CinematicWorldMode,
  seed: number,
): CinematicSeededVariation {
  const random = mulberry32((Math.trunc(seed) >>> 0) ^ modeSalt(mode))
  return {
    phase: random(),
    skew: random() * 2 - 1,
    density: 0.8 + random() * 0.4,
    motion: 0.8 + random() * 0.4,
  }
}

export function cinematicQualityLevel(quality: 'low' | 'medium' | 'high' | 'ultra'): number {
  switch (quality) {
    case 'low': return 0
    case 'medium': return 1
    case 'high': return 2
    case 'ultra': return 3
  }
}
