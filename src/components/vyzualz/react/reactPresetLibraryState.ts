import type { ReactEngineId, ReactPreset } from './ReactTypes'

export type ReactPresetLibraryView = 'current' | 'favorites' | 'all'

const FAVORITES_STORAGE_KEY = 'drmvyz.reactPresetFavorites.v1'

function getLocalStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
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

export function filterReactPresetLibrary(
  presets: ReactPreset[],
  activeEngineId: ReactEngineId,
  view: ReactPresetLibraryView,
  favoriteIds: ReadonlySet<string>,
): ReactPreset[] {
  if (view === 'current') return presets.filter(preset => preset.engine === activeEngineId)
  if (view === 'favorites') return presets.filter(preset => favoriteIds.has(preset.id))
  return presets
}
