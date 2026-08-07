import type { UploadedMedia } from '../../../stores/mediaStore'
import type {
  CinemaAssetId,
  CinemaExternalAssetSnapshot,
} from '../cinema'

/** Stable, reversible-enough Cinema identity derived from the canonical media row ID. */
export function cinemaAssetIdFromMediaId(mediaId: string): CinemaAssetId {
  const normalized = mediaId.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `media-${normalized || 'unknown'}` as CinemaAssetId
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
