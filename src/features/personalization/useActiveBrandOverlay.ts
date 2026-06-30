import { useEffect, useMemo, useState } from 'react'
import { useBrandKitStore } from './brandKitStore'
import { useMediaStore } from '../../stores/mediaStore'
import type { ActiveBrandOverlay } from './brandAssetCompositor'
import { preloadBrandAssets, resolveBrandAssetRuntime, type BrandAssetLoadStatus } from './brandAssetRuntime'

const DISPLAY_ROLES = new Set(['primaryLogo', 'secondaryLogo', 'wordmark', 'monogram', 'watermark', 'keyArt'])

export interface ActiveBrandOverlayState {
  overlay: ActiveBrandOverlay | null
  status: BrandAssetLoadStatus
  assetName: string | null
  error: string | null
}

export function useActiveBrandOverlay(): ActiveBrandOverlayState {
  const userId = useBrandKitStore(state => state.currentUserId)
  const kit = useBrandKitStore(state => state.activeKit)
  const assets = useBrandKitStore(state => state.activeAssets)
  const mediaItems = useMediaStore(state => state.items)
  const [runtime, setRuntime] = useState<ActiveBrandOverlayState>({ overlay: null, status: 'idle', assetName: null, error: null })

  const localUrls = useMemo(() => new Map(mediaItems.flatMap(item => {
    if (!item.dbId) return []
    const local = [item.url, item.localThumbnailObjectUrl].find(url => (
      typeof url === 'string' && (url.startsWith('blob:') || url.startsWith('data:'))
    ))
    return local ? [[item.dbId, local] as const] : []
  })), [mediaItems])
  const selected = useMemo(() => assets
    .filter(asset => DISPLAY_ROLES.has(asset.role) && asset.presentation?.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null, [assets])

  useEffect(() => {
    if (!userId || !kit || kit.autoApply === false) {
      setRuntime({ overlay: null, status: 'idle', assetName: null, error: null })
      return
    }
    preloadBrandAssets({ userId, assets: assets.filter(asset => DISPLAY_ROLES.has(asset.role)), localUrls })
    if (!selected?.presentation) {
      setRuntime({ overlay: null, status: 'idle', assetName: null, error: null })
      return
    }
    let cancelled = false
    setRuntime(previous => ({ ...previous, status: 'loading', assetName: selected.media?.name ?? null, error: null }))
    void resolveBrandAssetRuntime({
      userId,
      asset: selected,
      localUrl: localUrls.get(selected.mediaItemId) ?? null,
    }).then(entry => {
      if (cancelled) return
      const dimensions = entry.image as unknown as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number } | null
      setRuntime({
        overlay: entry.image ? {
          assetId: selected.id,
          mediaItemId: selected.mediaItemId,
          image: entry.image,
          naturalWidth: dimensions?.naturalWidth ?? dimensions?.width ?? 1,
          naturalHeight: dimensions?.naturalHeight ?? dimensions?.height ?? 1,
          presentation: selected.presentation!,
          palette: kit.palette,
        } : null,
        status: entry.status,
        assetName: selected.media?.name ?? null,
        error: entry.lastError,
      })
    })
    return () => { cancelled = true }
  }, [userId, kit, assets, localUrls, selected])

  return runtime
}
