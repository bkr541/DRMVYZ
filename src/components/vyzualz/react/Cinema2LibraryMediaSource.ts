import type { UploadedMedia } from '../../../stores/mediaStore'
import type { Cinema2MediaKind } from '../cinema2/contracts/Cinema2NativePresetManifest'
import type { Cinema2MediaSource } from '../cinema2/media/Cinema2MediaSlotRuntime'
import { isUnifiedSvgMediaItem } from '../../../lib/svgMediaEligibility'

export function cinema2MediaSourceFromLibraryItem(media: UploadedMedia): Readonly<Cinema2MediaSource> | null {
  const url = (media.proxyUrl ?? media.url ?? '').trim()
  if (!url) return null
  const kind: Cinema2MediaKind = isUnifiedSvgMediaItem(media) ? 'svg' : media.type
  return Object.freeze({
    id: media.id,
    revision: media.revision ?? `${media.storagePath ?? media.id}:${media.urlExpiresAt ?? 0}`,
    label: media.title?.trim() || media.name,
    kind,
    url,
    mimeType: media.mimeType ?? media.metadata.detectedMimeType ?? null,
    ...(typeof media.metadata.width === 'number' ? { width: media.metadata.width } : {}),
    ...(typeof media.metadata.height === 'number' ? { height: media.metadata.height } : {}),
    ...(typeof media.metadata.duration === 'number' ? { durationSec: media.metadata.duration } : {}),
  })
}

export function getCinema2MediaDisabledReason(media: UploadedMedia, accepts: readonly Cinema2MediaKind[]): string | null {
  if (media.uploading) return 'This media is still uploading.'
  if (media.lifecycleStatus === 'deletion_pending') return 'This media is pending deletion.'
  const source = cinema2MediaSourceFromLibraryItem(media)
  if (!source) return 'This media does not currently have a loadable runtime source.'
  return accepts.includes(source.kind) ? null : `This slot accepts ${accepts.join(', ')} media.`
}
