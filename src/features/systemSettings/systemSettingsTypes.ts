import { isPresetTransitionChoice, type PresetTransitionChoice } from '../../lib/presetTransitions'

export const SYSTEM_QUALITY_LEVELS = ['Low', 'Medium', 'High'] as const
export type SystemQualityLevel = typeof SYSTEM_QUALITY_LEVELS[number]

/**
 * Every setting on Settings > System Settings that belongs to the user and survives a restart.
 * Not included on purpose: Reset Effects / Reset Modulation / Copy Diagnostics (actions), Keyboard Shortcuts (a fixed list),
 * Media Sync (status), and the tempo number beside BPM Sync (it follows the track).
 */
export interface SystemSettings {
  quality: SystemQualityLevel
  autoQualityEnabled: boolean
  autoQualityMin: SystemQualityLevel
  autoQualityMax: SystemQualityLevel
  autoPerformanceDefault: boolean
  bpmSync: boolean
  /** Settings > System Settings > Transitions in React: blend between presets (and engines) instead of cutting. */
  transitionsEnabled: boolean
  /** The style used for those transitions, or Random. A per-pad or per-cue override can replace it later (see lib/presetTransitions.ts). */
  transitionStyle: PresetTransitionChoice
}

export const SYSTEM_SETTING_KEYS = ['quality', 'autoQualityEnabled', 'autoQualityMin', 'autoQualityMax', 'autoPerformanceDefault', 'bpmSync', 'transitionsEnabled', 'transitionStyle'] as const satisfies readonly (keyof SystemSettings)[]

export function isSystemQualityLevel(value: unknown): value is SystemQualityLevel {
  return typeof value === 'string' && (SYSTEM_QUALITY_LEVELS as readonly string[]).includes(value)
}

const VALIDATORS: { [K in keyof SystemSettings]: (value: unknown) => value is SystemSettings[K] } = {
  quality: isSystemQualityLevel,
  autoQualityEnabled: (value): value is boolean => typeof value === 'boolean',
  autoQualityMin: isSystemQualityLevel,
  autoQualityMax: isSystemQualityLevel,
  autoPerformanceDefault: (value): value is boolean => typeof value === 'boolean',
  bpmSync: (value): value is boolean => typeof value === 'boolean',
  transitionsEnabled: (value): value is boolean => typeof value === 'boolean',
  transitionStyle: isPresetTransitionChoice,
}

/** Keeps only the recognised, valid settings of a stored object. A missing or invalid key simply means "not saved for this account". */
export function normalizeSystemSettings(raw: unknown): Partial<SystemSettings> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const source = raw as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const key of SYSTEM_SETTING_KEYS) if (VALIDATORS[key](source[key])) result[key] = source[key]
  return result as Partial<SystemSettings>
}
