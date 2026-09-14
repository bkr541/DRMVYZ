import type { Cinema2PresetId } from '../cinema2'

// Persists only the last-selected Cinema 2.0 preset id across full page
// reloads/app restarts (localStorage), distinct from cinema2WorkspaceSessionStore
// (runtime/Cinema2WorkspaceSession.ts), which is an explicit in-memory,
// session-lifetime owner of re-entry parameter/media state and deliberately
// never persists to disk. This module follows the same guarded-localStorage
// shape as reactWorkspacePreferences.ts.

const STORAGE_KEY = 'drmvyz:cinema2:last-preset:v1'

export function readCinema2LastPresetId(): Cinema2PresetId | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (raw as Cinema2PresetId) : null
  } catch {
    return null
  }
}

export function writeCinema2LastPresetId(presetId: Cinema2PresetId): void {
  try {
    localStorage.setItem(STORAGE_KEY, presetId)
  } catch (error) {
    console.warn('[ReactView] Cinema 2.0 last preset could not be saved', error)
  }
}
