import { hasPixGridBuiltInAsset } from './PixGridArtwork'
import type { PixGridBuiltInAssetId, PixGridLayer, PixGridLayerFrameSource } from './PixGridTypes'

const SAFE_FRAME_SOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

function safeId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return SAFE_FRAME_SOURCE_ID.test(trimmed) ? trimmed : null
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function normalizePixGridLayerFrameSource(
  value: unknown,
  fallbackAssetId: PixGridBuiltInAssetId,
  legacyMediaId: string | null,
): PixGridLayerFrameSource {
  const source = record(value)
  if (source?.kind === 'asset' && typeof source.assetId === 'string' && hasPixGridBuiltInAsset(source.assetId)) {
    return { kind: 'asset', assetId: source.assetId }
  }
  if (source?.kind === 'media') {
    const mediaId = safeId(source.mediaId)
    if (mediaId) return { kind: 'media', mediaId }
  }
  if (source?.kind === 'deck') {
    const deckId = safeId(source.deckId)
    if (deckId) return { kind: 'deck', deckId }
  }
  return legacyMediaId
    ? { kind: 'media', mediaId: legacyMediaId }
    : { kind: 'asset', assetId: fallbackAssetId }
}

export function resolvePixGridLayerFrameSource(
  layer: Pick<PixGridLayer, 'assetId' | 'mediaId' | 'frameSource'>,
): PixGridLayerFrameSource {
  return normalizePixGridLayerFrameSource(layer.frameSource, layer.assetId, layer.mediaId ?? null)
}
