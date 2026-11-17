import type { Cinema2CompiledParameterDefinition } from './Cinema2ParameterSchema'

/**
 * The user's own default for every preset's Auto Performance toggle (Settings > System Settings > Auto Performance).
 * It replaces the authored default of the toggle, so every preset starts, resets and loads with the same value the user chose.
 * Kept in this tiny module so the Cinema 2.0 runtime never imports an app store.
 */
let userDefault: boolean | null = null
const listeners = new Set<(value: boolean) => void>()

/** null until the user's setting is known (tests, and any host that never calls the setter): the authored default is used as-is. */
export function getCinema2AutoPerformanceUserDefault(): boolean | null {
  return userDefault
}

export function setCinema2AutoPerformanceUserDefault(value: boolean | null): void {
  if (userDefault === value) return
  userDefault = value
  if (value !== null) listeners.forEach(listener => listener(value))
}

/** Called when the setting changes while presets are running. */
export function subscribeCinema2AutoPerformanceUserDefault(listener: (value: boolean) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** The preset's Auto Performance toggle: the boolean parameter tagged `moodPolicy: 'autoPerformance'`. */
export function isCinema2AutoPerformanceToggle(definition: Readonly<Pick<Cinema2CompiledParameterDefinition, 'type' | 'metadata'>>): boolean {
  return definition.type === 'boolean' && definition.metadata?.moodPolicy === 'autoPerformance'
}
