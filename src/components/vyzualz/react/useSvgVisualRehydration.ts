import { useEffect } from 'react'
import { useReactStore } from '../../../stores/reactStore'
import { useMediaStore } from '../../../stores/mediaStore'

/**
 * Rebuilds the unified SVG runtime caches after Zustand hydration.
 *
 * Persisted state contains sourceType === 'svg', selectedSvgId, svgRenderMode,
 * and serializable glyph assets. Decoded HTMLImageElement artwork and compiled
 * point caches are intentionally transient, so they are restored here without
 * changing the active source, selection, or render mode.
 *
 * This hook belongs in ReactView so it runs regardless of the active right-panel
 * tab. Cache loading is deduplicated by the store lifecycle helper.
 */
export function useSvgVisualRehydration(): void {
  const sourceType = useReactStore(state => state.oscillatorSettings.sourceType)
  const selectedSvgId = useReactStore(state => state.oscillatorSettings.selectedSvgId)
  const selectedMediaIdentity = useMediaStore(state => {
    if (!selectedSvgId) return null
    const item = state.items.find(candidate => candidate.id === selectedSvgId)
    return item ? `${item.id}::${item.url ?? ''}::${item.storagePath ?? ''}` : null
  })

  useEffect(() => {
    if (sourceType !== 'svg' || !selectedSvgId) return
    void useReactStore.getState().rehydrateSvgAsset(selectedSvgId)
  }, [sourceType, selectedSvgId, selectedMediaIdentity])
}
