import type { Cinema2PresetId } from '../cinema2'

// Compatibility bootstrap for installs created before the versioned Cinema 2.0
// workspace document existed. The project-scoped workspace in reactStore is now
// authoritative; this guarded preference is used only when that document has no
// active preset yet.

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
