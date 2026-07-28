import { createLegacyPortalCinematicConfig, normalizeCinematicWorldConfig, type CinematicWorldConfig } from './CinematicWorldConfig'
import { resolveEnginePresetProvenance } from './ReactPresetProvenance'
import type { ReactPreset } from './ReactTypes'

export function resolveCinematicPresetBaseConfig(preset: ReactPreset): CinematicWorldConfig | null {
  if (preset.engine !== 'cinematicPortal') return null
  return normalizeCinematicWorldConfig(
    preset.cinematicConfig ?? createLegacyPortalCinematicConfig({ ...preset.params, ...preset.renderSettings }),
  )
}

export function resolveCinematicPresetProvenance(
  preset: ReactPreset | null | undefined,
  config: CinematicWorldConfig | null | undefined,
) {
  const expected = preset ? resolveCinematicPresetBaseConfig(preset) : null
  return resolveEnginePresetProvenance({
    presetId: preset?.id ?? null,
    presetName: preset?.name ?? null,
    expectedValues: expected,
    actualValues: config ? normalizeCinematicWorldConfig(config) : null,
  })
}
