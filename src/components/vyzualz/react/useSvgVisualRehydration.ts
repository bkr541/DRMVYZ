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
 * Retry behavior: if a previous load attempt errored, calling selectSvgVisual
 * again will clear the error entry and retry. This hook triggers that path.
 */
export function useSvgVisualRehydration(): void {
  const sourceType          = useReactStore(s => s.oscillatorSettings.sourceType)
  const selectedSvgVisualId = useReactStore(s => s.oscillatorSettings.selectedSvgVisualId)

  useEffect(() => {
    if (sourceType !== 'svgVisual' || !selectedSvgVisualId) return

    const entry = getSvgVisualEntry(selectedSvgVisualId)
    // Rehydrate when: no entry at all, or loading is not yet started and there's no error
    if (!entry || (!entry.loaded && !entry.error)) {
      useReactStore.getState().selectSvgVisual(selectedSvgVisualId)
    }
  }, [sourceType, selectedSvgVisualId])
}
