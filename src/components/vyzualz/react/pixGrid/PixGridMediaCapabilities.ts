import type { UploadedMedia } from '../../../../stores/mediaStore'

export type PixGridMediaKind = 'png' | 'jpeg' | 'webp' | 'svg'

export interface PixGridMediaCapabilityResult {
  supported: boolean
  kind: PixGridMediaKind | null
  reason: string | null
}

const EXTENSION_KIND: Readonly<Record<string, PixGridMediaKind>> = {
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  webp: 'webp',
  svg: 'svg',
}

function mediaExtension(media: Pick<UploadedMedia, 'name' | 'storagePath'>): string {
  const source = media.storagePath || media.name
  const match = source.toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/)
  return match?.[1] ?? ''
}

function metadataFlag(metadata: UploadedMedia['metadata'], key: string): unknown {
  return metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>)[key] : undefined
}

export function inspectPixGridMediaCapability(media: UploadedMedia): PixGridMediaCapabilityResult {
  if (media.uploading) return { supported: false, kind: null, reason: 'This item is still uploading or syncing.' }
  if (media.lifecycleStatus === 'deletion_pending' || media.lifecycleStatus === 'deletion_failed') {
    return { supported: false, kind: null, reason: 'This media item is being removed and is not available to PixGrid.' }
  }
  if (media.type === 'video') return { supported: false, kind: null, reason: 'PixGrid accepts still images and SVGs, not video.' }

  const mime = media.mimeType?.toLowerCase().split(';')[0].trim() ?? ''
  const extension = mediaExtension(media)
  const kind = mime === 'image/png' ? 'png'
    : mime === 'image/jpeg' || mime === 'image/jpg' ? 'jpeg'
      : mime === 'image/webp' ? 'webp'
        : mime === 'image/svg+xml' ? 'svg'
          : EXTENSION_KIND[extension] ?? null

  if (extension === 'gif' || mime === 'image/gif') {
    return { supported: false, kind: null, reason: 'Animated GIF import is deferred beyond the PixGrid MVP.' }
  }
  if (!kind) {
    return { supported: false, kind: null, reason: 'PixGrid supports PNG, JPEG/JPG, static WebP, and SVG media.' }
  }
  if (kind === 'webp') {
    const animated = metadataFlag(media.metadata, 'animated') === true
      || Number(metadataFlag(media.metadata, 'frameCount') ?? 1) > 1
      || Number(metadataFlag(media.metadata, 'durationSec') ?? 0) > 0
    if (animated) {
      return { supported: false, kind: null, reason: 'Animated WebP is not supported by PixGrid.' }
    }
  }
  if (!media.url && !media.proxyUrl && !media.storagePath) {
    return { supported: false, kind, reason: 'The original media asset is temporarily unavailable.' }
  }
  return { supported: true, kind, reason: null }
}

export function isPixGridCompatibleMedia(media: UploadedMedia): boolean {
  return inspectPixGridMediaCapability(media).supported
}

export function getPixGridMediaDisabledReason(media: UploadedMedia): string | null {
  return inspectPixGridMediaCapability(media).reason
}

export function resolvePixGridMediaSourceUrl(media: UploadedMedia): string | null {
  return media.proxyUrl || media.url || null
}

export function resolvePixGridMediaRevision(media: UploadedMedia): number {
  return Number.isFinite(media.revision) ? Math.max(0, Math.floor(media.revision!)) : 0
}
