import { isRetiredLaserDmxPreset } from './ReactTypes'
import type { ReactEngineId, ReactPreset } from './ReactTypes'

export type ReactPresetLibraryView = 'current' | 'favorites' | 'all'

const FAVORITES_STORAGE_KEY = 'drmvyz.reactPresetFavorites.v1'

function getLocalStorage(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' && 'localStorage' in globalThis
      ? globalThis.localStorage
      : null
  } catch {
    return null
  }
}

export function readReactPresetFavorites(storage: Storage | null = getLocalStorage()): string[] {
  if (!storage) return []
  try {
    const parsed = JSON.parse(storage.getItem(FAVORITES_STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : []
  } catch {
    return []
  }
}

export function writeReactPresetFavorites(
  favorites: Iterable<string>,
  storage: Storage | null = getLocalStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...new Set(favorites)]))
  } catch {
    // Preset browsing remains functional when storage is unavailable or full.
  }
}

/**
 * Removes stale or retired preset IDs while preserving the user's remaining
 * favorite order. The cleaned value is written back only when it differs from
 * the stored value so hydration does not churn localStorage unnecessarily.
 */
export function sanitizeReactPresetFavorites(
  validPresetIds: Iterable<string>,
  storage: Storage | null = getLocalStorage(),
): string[] {
  if (!storage) return []
  const valid = new Set(validPresetIds)
  const existing = readReactPresetFavorites(storage)
  const seen = new Set<string>()
  const cleaned = existing.filter((presetId) => {
    if (!valid.has(presetId) || seen.has(presetId)) return false
    seen.add(presetId)
    return true
  })
  if (cleaned.length !== existing.length || cleaned.some((value, index) => value !== existing[index])) {
    writeReactPresetFavorites(cleaned, storage)
  }
  return cleaned
}

export function isReactPresetVisibleForLockedLaserDmx(preset: ReactPreset): boolean {
  return !isRetiredLaserDmxPreset(preset)
}

export function filterReactPresetLibrary(
  presets: ReactPreset[],
  activeEngineId: ReactEngineId,
  view: ReactPresetLibraryView,
  favoriteIds: ReadonlySet<string>,
): ReactPreset[] {
  const visiblePresets = presets.filter(isReactPresetVisibleForLockedLaserDmx)
  if (view === 'current') {
    return visiblePresets.filter(preset => preset.engine === activeEngineId)
  }
  if (view === 'favorites') return visiblePresets.filter(preset => favoriteIds.has(preset.id))
  return visiblePresets
}
