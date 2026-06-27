/**
 * Minimal media shape required to decide whether an item is safe to expose in
 * reactive SVG selectors. Keep this module UI-agnostic so every SVG browser can
 * share the same authoritative eligibility rule.
 */
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

/**
 * Authoritative reactive-SVG eligibility predicate.
 *
 * A filename is deliberately ignored. Inspected validation metadata wins when
 * available. Older persisted libraries may fall back to their explicit SVG role
 * and SVG MIME type, but a raster/image-wrapped asset is never admitted merely
 * because its name ends in `.svg`.
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
