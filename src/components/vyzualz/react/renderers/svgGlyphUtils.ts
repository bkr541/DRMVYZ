import { svgPathProperties } from 'svg-path-properties'
import type { OscillatorGlyphPoint, OscillatorGlyphAsset } from '../ReactTypes'
import {
  normalizePointCloud,
  computePathNormals,
  generateBuiltinShapePoints,
} from './oscillatorPathUtils'

// ── Hash ──────────────────────────────────────────────────────────────────────

/** FNV-1a 32-bit hash — deterministic, collision-resistant for short strings. */
export function hashString(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

// ── SVG content detection ─────────────────────────────────────────────────────

/**
 * Returns true when the value is a string that looks like an SVG document.
 * Accepts null/undefined/non-string without throwing. Case-insensitive.
 */
export function isSvgContent(rawSvg: unknown): rawSvg is string {
  return typeof rawSvg === 'string' && rawSvg.trim().toLowerCase().includes('<svg')
}

// ── SVG path extraction ───────────────────────────────────────────────────────

/**
 * Regex fallback used in environments without DOMParser (Node / Vitest).
 * Handles well-formed SVGs with plain <path d="…"> elements.
 */
function extractSvgPathDataRegex(rawSvg: string): string[] {
  // Strip script/style blocks before attribute scanning
  const stripped = rawSvg.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  const paths: string[] = []
  const pathTagRe = /<path\b[^>]*>/gi
  const dAttrRe   = /\bd=["']([^"']+)["']/i
  let m: RegExpExecArray | null
  while ((m = pathTagRe.exec(stripped)) !== null) {
    const da = dAttrRe.exec(m[0])
    if (da?.[1]?.trim()) paths.push(da[1])
  }
  return paths
}

/**
 * Extracts every <path d="…"> value from a raw SVG string.
 *
 * Uses DOMParser when available (browser); falls back to a regex scan in
 * environments that lack it (Node/Vitest).  Script and style elements are
 * removed before processing so no code can execute during extraction.
 *
 * TODO: before extraction, convert <rect>, <circle>, <polygon>, <polyline>,
 *       and <line> elements to equivalent <path> data so all SVG primitives
 *       contribute points to the glyph.
 */
export function extractSvgPathData(rawSvg: string): string[] {
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(rawSvg, 'image/svg+xml')
      // Abort on malformed XML
      if (doc.querySelector('parsererror')) return extractSvgPathDataRegex(rawSvg)
      // Remove any injected scripts/styles
      doc.querySelectorAll('script, style').forEach(el => el.remove())
      return Array.from(doc.querySelectorAll('path'))
        .map(el => el.getAttribute('d') ?? '')
        .filter(d => d.trim().length > 0)
    } catch {
      return extractSvgPathDataRegex(rawSvg)
    }
  }
  return extractSvgPathDataRegex(rawSvg)
}

/**
 * Returns true when the SVG string contains at least one <path> element with a
 * non-empty d attribute.  Use this before calling parseSvgToGlyphPoints when you
 * want to surface a warning to the caller rather than silently falling back.
 */
export function hasSvgPathData(rawSvg: string): boolean {
  return extractSvgPathData(rawSvg).length > 0
}

// ── Path sampling ─────────────────────────────────────────────────────────────

/**
 * Samples `resolution` evenly-spaced points along a single SVG path string.
 *
 * Each point includes a normal derived from the path tangent at that position:
 * right-perpendicular of the tangent gives an outward-pointing normal for
 * CCW-wound paths.
 *
 * Returns an empty array if pathData is empty, zero-length, or throws.
 * Call this from import/caching code — never from the draw loop.
 */
export function sampleSvgPathData(
  pathData: string,
  resolution: number,
  pathIndex: number,
): OscillatorGlyphPoint[] {
  if (resolution <= 0 || pathData.trim() === '') return []
  try {
    const props = new svgPathProperties(pathData)
    const totalLength = props.getTotalLength()
    if (totalLength <= 0 || !Number.isFinite(totalLength)) return []
    return Array.from({ length: resolution }, (_, i) => {
      const progress = resolution > 1 ? i / (resolution - 1) : 0
      const pt = props.getPropertiesAtLength(progress * totalLength)
      // Right-perpendicular of the unit tangent: (tY, -tX) → outward for CCW
      return {
        x:       pt.x,
        y:       pt.y,
        pathIndex,
        progress,
        normalX: pt.tangentY,
        normalY: -pt.tangentX,
      }
    })
  } catch {
    return []
  }
}

// ── Glyph assembly ────────────────────────────────────────────────────────────

function fallbackCircle(resolution: number): OscillatorGlyphPoint[] {
  return generateBuiltinShapePoints('circle', resolution)
}

/**
 * Parses a raw SVG string into a normalized, centered array of glyph points.
 *
 * - Resolution is distributed evenly across all discovered <path> elements.
 * - Points are translated to the centroid then scaled so max-radius ≤ 1.
 * - Normals are recomputed via central differences after normalization.
 * - Falls back to a unit circle if parsing fails or no paths are found.
 *
 * This is designed to run once when a glyph is imported or selected —
 * never inside the animation draw loop.
 */
export function parseSvgToGlyphPoints(
  rawSvg: string,
  resolution: number,
): OscillatorGlyphPoint[] {
  const n = Math.max(1, Math.round(resolution))
  try {
    const pathStrings = extractSvgPathData(rawSvg)
    if (pathStrings.length === 0) {
      console.warn('[DRMVYZ] parseSvgToGlyphPoints: This SVG contains no supported path data (<path d="…"> elements). Falling back to circle. Convert shapes to paths in your SVG editor.')
      return fallbackCircle(n)
    }

    const numPaths = pathStrings.length
    const base     = Math.floor(n / numPaths)
    const extra    = n % numPaths

    const raw: OscillatorGlyphPoint[] = []
    for (let i = 0; i < numPaths; i++) {
      const count = i < extra ? base + 1 : base
      const pts   = sampleSvgPathData(pathStrings[i], count, i)
      for (const p of pts) raw.push(p)
    }

    if (raw.length === 0) return fallbackCircle(n)

    // Translate to centroid so the glyph is centered at the origin
    let cx = 0, cy = 0
    for (const p of raw) { cx += p.x; cy += p.y }
    cx /= raw.length
    cy /= raw.length
    const centered = raw.map(p => ({ ...p, x: p.x - cx, y: p.y - cy }))

    // Scale to max-radius 1 and recompute normals via central differences
    const normalized = normalizePointCloud(centered)
    return computePathNormals(normalized, false)
  } catch {
    return fallbackCircle(n)
  }
}

// ── Asset factory ─────────────────────────────────────────────────────────────

/**
 * Creates an OscillatorGlyphAsset from a raw SVG string.
 *
 * The id is derived from the SVG content hash and is stable across sessions:
 * the same SVG always produces the same id regardless of when it is imported.
 *
 * Call this when importing or caching a glyph — not inside the draw loop.
 */
export function makeSvgGlyphAsset(
  name: string,
  rawSvg: string,
  resolution: number,
  idOverride?: string,
): OscillatorGlyphAsset {
  const points = parseSvgToGlyphPoints(rawSvg, resolution)
  return {
    id:         idOverride ?? `glyph-${hashString(rawSvg)}`,
    name,
    sourceType: 'svgGlyph',
    rawSvg,
    pointCount: points.length,
    createdAt:  new Date().toISOString(),
  }
}
