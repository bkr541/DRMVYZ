import { notify } from '../../stores/notificationStore'
import { getPresetAvailability } from './presetMetadataStore'
import { presetUnavailableMessage, type PresetAvailability } from './presetAvailability'

const recent = new Map<string, number>()

/** Tells the user, once in a while per preset, that a preset could not be used and why. */
export function reportUnavailablePreset(presetKey: string, name: string, availability: PresetAvailability): void {
  const now = Date.now()
  if (now - (recent.get(presetKey) ?? 0) < 10_000) return
  recent.set(presetKey, now)
  notify('react', { tone: 'warning', title: 'Preset unavailable', message: presetUnavailableMessage(name, availability) })
}

/**
 * True when the signed-in user may use this preset. Otherwise reports why and returns false; activation actions call it before anything changes, so a
 * click, a pad, a Show cue or automation never starts a preset an admin has not released, has archived or has switched off.
 */
export function presetUsableOrReport(appEngineId: string, presetKey: string, name: string = presetKey): boolean {
  const availability = getPresetAvailability(appEngineId, presetKey)
  if (availability.usable) return true
  reportUnavailablePreset(presetKey, name, availability)
  return false
}
