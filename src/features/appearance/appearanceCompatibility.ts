import {
  DEFAULT_APPEARANCE_THEME,
  isAppearanceTheme,
  type AppearanceTheme,
} from './appearanceTypes'

export const APPEARANCE_CONTRACT_SCHEMA_VERSION = 1 as const

export const APPEARANCE_FIELD_OWNERSHIP = Object.freeze({
  activeRuntime: [
    'features.appearance.theme',
    'localStorage:drmvyz:appearance:theme:v1',
    'localStorage:drmvyz:appearance:user:v1:<userId>',
    'database:user_settings.theme',
    'document.documentElement.dataset.theme',
  ],
  compatibilityOnly: [
    'WorkspacePreset.theme',
    'GlobalSettings.theme',
    'GlobalSettings.accentIntensity',
  ],
  reservedOrEngineLocal: [
    'GlobalSettings.showScanlines',
    'GlobalSettings.showGlow',
    'GlobalSettings.showGrid',
    'GlobalSettings.showLogo',
    'GlobalSettings.showModuleBorders',
    'GlobalSettings.transparentBg',
    'GlobalSettings.fontDensity',
    'visualStore.scanlines',
    'visualStore.logoScale',
    'ReferenceSlot.accent_color',
    'BrandKit.use_for_app_accent',
  ],
} as const)

export interface AppearanceCompatibilityInput {
  canonicalTheme?: unknown
  legacyWorkspaceTheme?: unknown
}

/**
 * Canonical theme wins. A legacy workspace value is translated only when it is
 * already one of the exact live theme IDs. Historical look names such as
 * `cyan-green` remain round-trippable metadata and never override the service.
 */
export function resolveCanonicalAppearanceTheme(
  input: AppearanceCompatibilityInput,
): AppearanceTheme {
  if (isAppearanceTheme(input.canonicalTheme)) return input.canonicalTheme
  if (input.canonicalTheme == null && isAppearanceTheme(input.legacyWorkspaceTheme)) {
    return input.legacyWorkspaceTheme
  }
  return DEFAULT_APPEARANCE_THEME
}
