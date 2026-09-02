import type { UploadedMedia } from '../../../stores/mediaStore'
import { downloadFontFile } from '../../../lib/fontDb'
import type {
  CinemaAssetId,
  CinemaExternalAssetSnapshot,
} from '../cinema'
import type { OscillatorFontAsset } from './ReactTypes'
import { getBufferFromCache } from './renderers/fontGlyphUtils'

/** Stable, reversible-enough Cinema identity derived from the canonical media row ID. */
export function cinemaAssetIdFromMediaId(mediaId: string): CinemaAssetId {
  const normalized = mediaId.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `media-${normalized || 'unknown'}` as CinemaAssetId
}

export function cinemaAssetIdFromFontId(fontId: string): CinemaAssetId {
  const normalized = fontId.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `font-${normalized || 'unknown'}` as CinemaAssetId
}

/**
 * Adapts the canonical media library into runtime-only Cinema snapshots. URLs,
 * File objects, media elements, and upload state are intentionally excluded
 * from Cinema persistence.
 */
export function createCinemaMediaLibrarySnapshot(
  items: readonly Readonly<UploadedMedia>[],
): readonly Readonly<CinemaExternalAssetSnapshot>[] {
  return Object.freeze(items.map(item => Object.freeze({
    assetId: cinemaAssetIdFromMediaId(item.dbId ?? item.id),
    revision: item.revision ?? `${item.storagePath ?? item.id}:${item.urlExpiresAt ?? 0}`,
    name: item.name,
    mimeType: item.mimeType ?? item.metadata.detectedMimeType ?? null,
    mediaKind: item.mimeType === 'image/svg+xml' || item.mediaRole === 'svg'
      ? 'svg'
      : item.type,
    runtimeUrl: item.proxyUrl ?? item.url ?? null,
    ...(typeof item.metadata.width === 'number' ? { width: item.metadata.width } : {}),
    ...(typeof item.metadata.height === 'number' ? { height: item.metadata.height } : {}),
    ...(typeof item.metadata.duration === 'number' ? { durationSec: item.metadata.duration } : {}),
    deleted: item.lifecycleStatus === 'deletion_pending',
  } satisfies CinemaExternalAssetSnapshot)))
}

/** Bridges the existing outline Font Library into Cinema without persisting binary font data. */
export function createCinemaFontLibrarySnapshot(
  assets: readonly Readonly<OscillatorFontAsset>[],
): readonly Readonly<CinemaExternalAssetSnapshot>[] {
  return Object.freeze(assets.map(asset => Object.freeze({
    assetId: cinemaAssetIdFromFontId(asset.id),
    revision: `${asset.storagePath}:${asset.fileSize}:${asset.createdAt}`,
    name: asset.name,
    mimeType: asset.mimeType || null,
    mediaKind: 'font' as const,
    runtimeUrl: null,
    loadRawData: async (signal?: AbortSignal) => {
      if (signal?.aborted) throw new DOMException('Cinema font loading was cancelled.', 'AbortError')
      const cached = getBufferFromCache(asset.id)
      if (cached) return cached
      const { data, error } = await downloadFontFile(asset.storagePath)
      if (signal?.aborted) throw new DOMException('Cinema font loading was cancelled.', 'AbortError')
      if (error || !data) throw new Error(error ?? 'Cinema font data is unavailable.')
      return data.arrayBuffer()
    },
  } satisfies CinemaExternalAssetSnapshot)))
}
