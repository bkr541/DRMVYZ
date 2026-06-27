import type {
  OscillatorGlyphAsset,
  OscillatorGlyphPoint,
  OscillatorSettings,
  SvgRenderMode,
} from './ReactTypes'
import { getSvgGlyphCacheKey, findNearestSvgGlyphCacheEntry } from './renderers/svgGlyphUtils'
import type { SvgVisualCacheEntry } from './renderers/svgVisualCache'

export const SVG_MEDIA_GLYPH_PREFIX = 'glyph-media:'

export interface SvgMediaValidationSummary {
  isValidSvg: boolean
  hasVectorGeometry: boolean
  hasEmbeddedRaster: boolean
  hasExternalRaster: boolean
  reactivePathCompatible: boolean
}

export interface SvgMediaCandidate {
  id: string
  name: string
  title?: string | null
  mediaRole: string
  mimeType?: string | null
  createdAt?: string | null
  metadata?: {
    svgValidation?: SvgMediaValidationSummary
  } | null
}

export interface UnifiedSvgSource {
  mediaId: string | null
  renderMode: SvgRenderMode
  legacySource: 'svgGlyph' | 'svgVisual' | null
}

export interface UnifiedSvgStatus {
  mediaId: string | null
  assetName: string | null
  renderMode: SvgRenderMode
  renderModeLabel: string
  resolvedMode: 'reactivePath' | 'originalArtwork' | null
  pointCount: number
  loading: boolean
  loaded: boolean
  error: string | null
  uploadedAt: string | null
}

export const SVG_RENDER_MODE_LABELS: Record<SvgRenderMode, string> = {
  auto:            'Auto',
  reactivePath:    'Reactive Path',
  originalArtwork: 'Original Artwork',
}

export function getSvgGlyphAssetId(mediaId: string): string {
  return `${SVG_MEDIA_GLYPH_PREFIX}${mediaId}`
}

export function getMediaIdFromSvgGlyphId(glyphId: string | null | undefined): string | null {
  return glyphId?.startsWith(SVG_MEDIA_GLYPH_PREFIX)
    ? glyphId.slice(SVG_MEDIA_GLYPH_PREFIX.length)
    : null
}

/**
 * Compatibility boundary for old persisted/preset source settings. Runtime code
 * should consume the returned unified media ID/render mode instead of branching
 * on legacy source types.
 */
export function resolveUnifiedSvgSource(osc: OscillatorSettings): UnifiedSvgSource | null {
  if (osc.sourceType === 'svg') {
    return {
      mediaId: osc.selectedSvgId,
      renderMode: osc.svgRenderMode ?? 'auto',
      legacySource: null,
    }
  }

  if (osc.sourceType === 'svgGlyph') {
    return {
      // A standalone glyph-library ID must not inherit a stale selectedSvgId
      // from a previously active unified asset.
      mediaId: getMediaIdFromSvgGlyphId(osc.selectedGlyphId),
      renderMode: 'reactivePath',
      legacySource: 'svgGlyph',
    }
  }

  if (osc.sourceType === 'svgVisual') {
    return {
      mediaId: osc.selectedSvgVisualId ?? osc.selectedSvgId,
      renderMode: 'originalArtwork',
      legacySource: 'svgVisual',
    }
  }

  return null
}

/**
 * Converts media-backed legacy SVG selections to the unified source model.
 * Non-media legacy glyph assets are left intact so old custom glyph libraries
 * remain usable until they are explicitly imported into the media library.
 */
export function normalizeUnifiedSvgSettings(settings: OscillatorSettings): OscillatorSettings {
  if (settings.sourceType === 'svg') return settings

  const resolved = resolveUnifiedSvgSource(settings)
  if (!resolved?.mediaId) return settings

  return {
    ...settings,
    sourceType: 'svg',
    selectedSvgId: resolved.mediaId,
    svgRenderMode: resolved.renderMode,
  }
}

/**
 * Authoritative browser predicate. A filename is deliberately ignored. Newer
 * media carries inspected SVG metadata; older libraries fall back to the stored
 * SVG role and MIME type for backward compatibility.
 */
export function isUnifiedSvgMediaItem(item: SvgMediaCandidate): boolean {
  const validation = item.metadata?.svgValidation
  if (validation) {
    return validation.isValidSvg &&
      !validation.hasEmbeddedRaster &&
      !validation.hasExternalRaster
  }

  if (item.mediaRole !== 'svg') return false
  if (!item.mimeType) return true
  return item.mimeType.toLowerCase().split(';', 1)[0].trim() === 'image/svg+xml'
}

export function getUnifiedSvgPointCount(
  osc: OscillatorSettings,
  glyphAssets: OscillatorGlyphAsset[],
  glyphCache: Record<string, OscillatorGlyphPoint[]>,
): number {
  const source = resolveUnifiedSvgSource(osc)
  if (!source?.mediaId) return 0

  const assetId = getSvgGlyphAssetId(source.mediaId)
  const asset = glyphAssets.find(candidate => candidate.id === assetId)
  if (!asset) return 0

  const resolution = Math.max(64, Math.min(2048, Math.round(osc.pathResolution)))
  const exactKey = getSvgGlyphCacheKey(asset.id, resolution, asset.contentHash)
  const exact = glyphCache[exactKey]
  if (exact) return exact.length

  return findNearestSvgGlyphCacheEntry(
    glyphCache,
    asset.id,
    resolution,
    asset.contentHash,
  )?.length ?? asset.pointCount
}

export function buildUnifiedSvgStatus(
  osc: OscillatorSettings,
  glyphAssets: OscillatorGlyphAsset[],
  glyphCache: Record<string, OscillatorGlyphPoint[]>,
  mediaItems: SvgMediaCandidate[],
  visualEntry: SvgVisualCacheEntry | null,
): UnifiedSvgStatus | null {
  const source = resolveUnifiedSvgSource(osc)
  if (!source || (source.legacySource === 'svgGlyph' && !source.mediaId)) return null

  const item = source.mediaId
    ? mediaItems.find(candidate => candidate.id === source.mediaId)
    : undefined
  const glyphAsset = source.mediaId
    ? glyphAssets.find(candidate => candidate.id === getSvgGlyphAssetId(source.mediaId!))
    : undefined
  const pointCount = getUnifiedSvgPointCount(osc, glyphAssets, glyphCache)
  const resolvedMode = source.renderMode === 'auto'
    ? (pointCount > 0 ? 'reactivePath' : 'originalArtwork')
    : source.renderMode

  return {
    mediaId: source.mediaId,
    assetName: item ? (item.title ?? item.name) : (glyphAsset?.name ?? null),
    renderMode: source.renderMode,
    renderModeLabel: SVG_RENDER_MODE_LABELS[source.renderMode],
    resolvedMode,
    pointCount,
    loading: visualEntry?.loading ?? false,
    loaded: visualEntry?.loaded ?? false,
    error: visualEntry?.error ?? null,
    uploadedAt: item?.createdAt ?? glyphAsset?.createdAt ?? null,
  }
}
