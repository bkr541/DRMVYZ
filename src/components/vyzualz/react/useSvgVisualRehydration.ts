import { useEffect } from 'react'
import { useReactStore } from '../../../stores/reactStore'
import { getSvgVisualEntry } from './renderers/svgVisualCache'

/**
 * Watches the active SVG Visual selection and rehydrates the module-level image
 * cache whenever it is missing or unloaded (e.g. after a page refresh or when
 * the user opens React View on a tab other than ENGINE).
 *
 * Call this from ReactView — not from ReactEnginePanel — so rehydration fires
 * regardless of which right-panel tab is currently visible.
 *
 * Retry behavior: errored entries are evicted and retried by selectSvgVisual.
 * In-progress fetches are deduplicated by the loading guard in selectSvgVisual.
 */
export function useSvgVisualRehydration(): void {
  const sourceType          = useReactStore(s => s.oscillatorSettings.sourceType)
  const selectedSvgVisualId = useReactStore(s => s.oscillatorSettings.selectedSvgVisualId)

  useEffect(() => {
    if (sourceType !== 'svgVisual' || !selectedSvgVisualId) return

    const entry = getSvgVisualEntry(selectedSvgVisualId)
    // Call selectSvgVisual unless already loaded or actively loading.
    // The store action handles: no-op if loaded, evict+retry if errored,
    // skip if loading (duplicate-fetch guard).
    if (!entry || !entry.loaded) {
      useReactStore.getState().selectSvgVisual(selectedSvgVisualId)
    }
  }, [sourceType, selectedSvgVisualId])
}
