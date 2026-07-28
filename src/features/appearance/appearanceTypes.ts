export const APPEARANCE_THEMES = ['dark', 'light', 'cdj'] as const

export type AppearanceTheme = (typeof APPEARANCE_THEMES)[number]

export const DEFAULT_APPEARANCE_THEME: AppearanceTheme = 'dark'

export function isAppearanceTheme(value: unknown): value is AppearanceTheme {
  return typeof value === 'string' && APPEARANCE_THEMES.includes(value as AppearanceTheme)
}

/**
 * `system` was present in the original database constraint but never had an
 * implemented visual theme. Normalize it to the current Dark appearance so
 * old local caches and pre-migration rows remain deterministic.
 */
export function normalizeAppearanceTheme(value: unknown): AppearanceTheme {
  if (isAppearanceTheme(value)) return value
  return DEFAULT_APPEARANCE_THEME
}
