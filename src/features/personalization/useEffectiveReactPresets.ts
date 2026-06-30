import { useMemo } from 'react'
import type { ReactPreset } from '../../components/vyzualz/react/ReactTypes'
import { useBrandKitStore } from './brandKitStore'
import { resolveEffectiveReactPreset, resolveEffectiveReactPresets } from './effectivePalette'

export function useEffectiveReactPresets(presets: readonly ReactPreset[]): ReactPreset[] {
  const activeKit = useBrandKitStore(state => state.activeKit)
  return useMemo(() => resolveEffectiveReactPresets(presets, activeKit), [presets, activeKit])
}

export function useEffectiveReactPreset(preset: ReactPreset | null): ReactPreset | null {
  const activeKit = useBrandKitStore(state => state.activeKit)
  return useMemo(
    () => preset ? resolveEffectiveReactPreset(preset, activeKit) : null,
    [preset, activeKit],
  )
}
