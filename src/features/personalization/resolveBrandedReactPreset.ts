import type { CinematicWorldConfig } from '../../components/vyzualz/react/CinematicWorldConfig'
import type { ReactPreset } from '../../components/vyzualz/react/ReactTypes'
import { resolveCinematicConfigForPreset } from '../../stores/reactStore'
import type { BrandKit } from './BrandKitTypes'
import { resolveEffectiveReactPreset } from './effectivePalette'

/**
 * The single React-view boundary for non-destructive personalization.
 * Cinematic overrides are resolved first, then only the palette is replaced.
 */
export function resolveBrandedReactPreset(
  preset: ReactPreset | null,
  cinematicConfigsByPresetId: Readonly<Record<string, CinematicWorldConfig>>,
  brandKit: Readonly<BrandKit> | null | undefined,
): ReactPreset | null {
  if (!preset) return null
  const withCinematicConfig = preset.engine === 'cinematicPortal'
    ? (() => {
        const cinematicConfig = resolveCinematicConfigForPreset(preset, cinematicConfigsByPresetId)
        return cinematicConfig ? { ...preset, cinematicConfig } : preset
      })()
    : preset
  return resolveEffectiveReactPreset(withCinematicConfig, brandKit)
}
