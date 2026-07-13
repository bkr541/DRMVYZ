import {
  normalizeLaserDmxShowDirectorState,
  type LaserDmxShowDirectorState,
} from './ReactTypes'
import {
  LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY,
  LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_STATE_SCHEMA_VERSION,
  cloneLaserDmxShowDirectorPerformanceProgram,
  nextLaserDmxShowDirectorPerformanceInvalidationId,
  normalizeLaserDmxShowDirectorPerformanceProgram,
  normalizeLaserDmxShowDirectorPerformanceState,
  type LaserDmxShowDirectorPerformanceProgram,
  type LaserDmxShowDirectorPerformanceSectionType,
  type LaserDmxShowDirectorPerformanceState,
} from './LaserDmxShowDirectorPerformanceProgram'
import { LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS } from './LaserDmxShowDirectorPerformanceShowcasePresets'

export interface LaserDmxShowDirectorPerformancePresetDefinition {
  id: string
  name: string
  description: string
  genreTags: string[]
  behaviorTags: string[]
  supportedSectionRoles: LaserDmxShowDirectorPerformanceSectionType[]
  musicIntelligenceCapabilities: string[]
  fixtureCount: number
  approximatePeakBeamDemand: number
  createRig: (createId: () => string) => LaserDmxShowDirectorState
  createProgram: () => LaserDmxShowDirectorPerformanceProgram
}

export interface LaserDmxShowDirectorPerformancePresetLoadResult {
  rig: LaserDmxShowDirectorState
  performance: LaserDmxShowDirectorPerformanceState
}

/** Canonical full-song Show Director performance shows. */
export const LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS: readonly LaserDmxShowDirectorPerformancePresetDefinition[] = LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS

const FAVORITES_STORAGE_KEY = 'drmvyz.showDirector.performanceFavorites.v1'

function deterministicIdFactory(presetId: string): () => string {
  let index = 0
  return () => `${presetId}-fixture-${++index}`
}

function preserveCanvasPreferences(
  next: LaserDmxShowDirectorState,
  current: LaserDmxShowDirectorState,
): LaserDmxShowDirectorState {
  return {
    ...next,
    settings: {
      ...next.settings,
      snapEnabled: current.settings.snapEnabled,
      showLabels: current.settings.showLabels,
      showBeams: current.settings.showBeams,
      showGrid: current.settings.showGrid,
      highlightFixtures: current.settings.highlightFixtures,
      zoom: current.settings.zoom,
    },
  }
}

export function getLaserDmxShowDirectorPerformancePreset(
  presetId: string,
): LaserDmxShowDirectorPerformancePresetDefinition | null {
  return LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.find(preset => preset.id === presetId) ?? null
}

export function createLaserDmxShowDirectorPerformancePresetLoadResult(
  currentRig: LaserDmxShowDirectorState,
  currentPerformance: LaserDmxShowDirectorPerformanceState,
  preset: LaserDmxShowDirectorPerformancePresetDefinition,
): LaserDmxShowDirectorPerformancePresetLoadResult | null {
  const program = normalizeLaserDmxShowDirectorPerformanceProgram(preset.createProgram())
  if (!program) return null
  const createdRig = normalizeLaserDmxShowDirectorState(preset.createRig(deterministicIdFactory(preset.id)))
  const rig = normalizeLaserDmxShowDirectorState(preserveCanvasPreferences(createdRig, currentRig))
  const current = normalizeLaserDmxShowDirectorPerformanceState(currentPerformance)
  return {
    rig,
    performance: {
      schemaVersion: LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_STATE_SCHEMA_VERSION,
      activeProgramId: program.id,
      activeBuiltInProgramId: Object.prototype.hasOwnProperty.call(
        LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY,
        program.id,
      )
        ? program.id as keyof typeof LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY
        : null,
      activeProgramDefinition: cloneLaserDmxShowDirectorPerformanceProgram(program),
      enabled: true,
      tuning: { ...program.tuning },
      audioIntelligenceEnabled: current.audioIntelligenceEnabled,
      deterministicSeed: program.deterministicSeed,
      fallbackBehavior: current.fallbackBehavior,
      activePresetId: preset.id,
      presetDirty: false,
      runtimeInvalidationId: nextLaserDmxShowDirectorPerformanceInvalidationId(current.runtimeInvalidationId, program.id),
    },
  }
}

export function readLaserDmxShowDirectorPerformanceFavorites(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed)
      ? Array.from(new Set(parsed.filter((value): value is string => typeof value === 'string')))
      : []
  } catch {
    return []
  }
}

export function writeLaserDmxShowDirectorPerformanceFavorites(ids: readonly string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(new Set(ids))))
  } catch {
    // Favorite persistence is optional and must never block preset loading.
  }
}
