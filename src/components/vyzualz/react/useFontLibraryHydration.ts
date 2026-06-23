import { useEffect } from 'react'
import { useReactStore } from '../../../stores/reactStore'

/**
 * Triggers `loadOscillatorFonts()` once when the React view mounts so cloud
 * font metadata is available regardless of which panel tab is active.
 *
 * Call this from ReactView — not from ReactEnginePanel — so hydration fires
 * even when the user is on a tab other than ENGINE.
 *
 * Duplicate calls within the same session are a no-op (the store's
 * fontsLoadState guard rejects 'loading' and 'loaded' re-entries).
 */
export function useFontLibraryHydration(): void {
  useEffect(() => {
    useReactStore.getState().loadOscillatorFonts()
  }, [])
}
