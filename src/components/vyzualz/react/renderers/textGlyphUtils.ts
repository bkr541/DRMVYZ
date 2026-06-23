import type { OscillatorGlyphPoint, OscillatorGlyphAsset } from '../ReactTypes'
import {
  computePathNormals,
  generateBuiltinShapePoints,
  resamplePoints,
} from './oscillatorPathUtils'

// ── Public types ──────────────────────────────────────────────────────────────

export interface TextGlyphOptions {
  /** Font stack passed verbatim to ctx.font. Default: 'Arial, sans-serif'. */
  fontFamily?:   string
  /** Font weight token. Default: 'bold'. */
  fontWeight?:   string
  /** Width of the internal offscreen canvas in pixels. Default: 512. */
  canvasWidth?:  number
  /** Height of the internal offscreen canvas in pixels. Default: 128. */
  canvasHeight?: number
  /**
   * Pixel stride for the edge-scan loop.  1 = check every pixel (slowest,
   * most detail).  2 = check every other pixel, etc.  Default: 1.
   */
  sampleStep?:   number
  /**
   * Extra pixels to insert between each character.  Negative values tighten
   * the spacing.  Applied during canvas rasterisation so the generated points
   * reflect the spacing directly.  Default: 0.
   */
  letterSpacing?: number
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function fallback(n: number): OscillatorGlyphPoint[] {
  return generateBuiltinShapePoints('circle', n)
}

/** FNV-1a 32-bit hash → 8-char hex, used for stable asset ids. */
function hashText(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16).padStart(8, '0')
}

// ── Core implementation ───────────────────────────────────────────────────────

/**
 * Converts a text string into normalized OscillatorGlyphPoints suitable for
 * oscilloscope rendering.
 *
 * Algorithm:
 *  1. Render the text onto an offscreen canvas with a bold sans-serif font.
 *  2. Scan every pixel (or every sampleStep-th pixel).
 *  3. Flag a pixel as an "edge pixel" when it is opaque and has at least one
 *     transparent 4-connected neighbour — this traces the outer letterforms.
 *  4. Sort the edge pixels in a boustrophedon (snake) order by y-band then x
 *     so that adjacent array entries are spatially close.  This is O(n log n)
 *     and produces readable letter shapes without an expensive nearest-neighbour
 *     search.
 *     TODO: replace with nearest-neighbour path ordering for smoother traces.
 *  5. Resample to `resolution` points, centre, normalise to max-radius ≈ 1,
 *     and compute central-difference normals.
 *
 * Returns a circle fallback when:
 *  - `text` is empty / whitespace
 *  - `document` is unavailable (SSR, Node test environment)
 *  - The canvas API is unavailable
 *  - No edge pixels were found
 *
 * Call this during glyph import / selection — not inside the draw loop.
 */
export function textToGlyphPoints(
  text: string,
  resolution: number,
  options?: TextGlyphOptions,
): OscillatorGlyphPoint[] {
  const n = Math.max(2, Math.round(resolution))

  if (!text.trim()) return fallback(n)

  const {
    fontFamily    = 'Arial, sans-serif',
    fontWeight    = 'bold',
    canvasWidth   = 512,
    canvasHeight  = 128,
    sampleStep    = 1,
    letterSpacing = 0,
  } = options ?? {}

  if (typeof document === 'undefined') return fallback(n)

  try {
    // Probe canvas: measure character widths before creating the final canvas so
    // we can size it to fit the text without clipping at large letter spacings.
    const probeCanvas = document.createElement('canvas')
    probeCanvas.width  = 1
    probeCanvas.height = 1
    const probeCtx = probeCanvas.getContext('2d')
    if (!probeCtx) return fallback(n)
    const fontSize = Math.max(8, Math.floor(canvasHeight * 0.72))
    probeCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
    const chars = Array.from(text)
    const charWidths = chars.map(c => probeCtx.measureText(c).width)
    const gap = letterSpacing  // already validated by the UI slider range (-20..80)
    const totalWidth = charWidths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, chars.length - 1)

    // Size the canvas to the actual text width plus padding; never smaller than canvasWidth.
    const SIDE_PAD   = 16
    const actualWidth = Math.max(canvasWidth, Math.ceil(totalWidth) + 2 * SIDE_PAD)

    const canvas = document.createElement('canvas')
    canvas.width  = actualWidth
    canvas.height = canvasHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return fallback(n)

    // Draw white text on transparent canvas — background stays alpha=0 so that
    // simple alpha-based edge detection works correctly.
    // Re-apply font after canvas creation (resize resets context state).
    ctx.font         = `${fontWeight} ${fontSize}px ${fontFamily}`
    ctx.textBaseline = 'middle'
    ctx.fillStyle    = '#ffffff'

    // Draw character-by-character so letterSpacing is applied between glyphs.
    // Using Array.from ensures multi-byte Unicode characters are treated as
    // single units (emoji, accented chars, etc.).
    ctx.textAlign = 'left'
    let x = actualWidth / 2 - totalWidth / 2
    const y = canvasHeight / 2
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], x, y)
      x += charWidths[i] + gap
    }

    const imageData = ctx.getImageData(0, 0, actualWidth, canvasHeight)
    const data      = imageData.data

    // ── Edge detection ────────────────────────────────────────────────────────
    // An "edge pixel" is any sufficiently opaque pixel that has at least one
    // transparent 4-connected neighbour.  Alpha threshold 50 captures
    // anti-aliased sub-pixel fringe without including invisible specks.
    const step   = Math.max(1, Math.round(sampleStep))
    const stride = actualWidth
    const edgePixels: [number, number][] = []

    for (let y = 0; y < canvasHeight; y += step) {
      for (let x = 0; x < actualWidth; x += step) {
        if (data[(y * stride + x) * 4 + 3] < 50) continue

        const hasTransparentNeighbour =
          (x > 0                && data[(y * stride + (x - 1)) * 4 + 3] < 50) ||
          (x < actualWidth  - 1 && data[(y * stride + (x + 1)) * 4 + 3] < 50) ||
          (y > 0                && data[((y - 1) * stride + x) * 4 + 3] < 50) ||
          (y < canvasHeight - 1 && data[((y + 1) * stride + x) * 4 + 3] < 50)

        if (hasTransparentNeighbour) edgePixels.push([x, y])
      }
    }

    if (edgePixels.length === 0) return fallback(n)

    // ── Boustrophedon sort ────────────────────────────────────────────────────
    // Group into horizontal bands, alternate sweep direction on odd bands so the
    // path snakes left→right, right→left continuously rather than jumping.
    // Band count ≈ 20 gives a good spatial coherence / sorting cost tradeoff.
    const bandH = Math.max(2, Math.ceil(canvasHeight / 20))
    edgePixels.sort((a, b) => {
      const ba = Math.floor(a[1] / bandH)
      const bb = Math.floor(b[1] / bandH)
      if (ba !== bb) return ba - bb
      return ba % 2 === 0 ? a[0] - b[0] : b[0] - a[0]
    })

    // ── Convert to glyph points ───────────────────────────────────────────────
    const cx  = actualWidth  / 2
    const cy  = canvasHeight / 2
    const len = edgePixels.length
    const raw: OscillatorGlyphPoint[] = edgePixels.map(([px, py], i) => ({
      x:         px - cx,
      y:         py - cy,
      pathIndex: 0,
      progress:  len > 1 ? i / (len - 1) : 0,
    }))

    const resampled = resamplePoints(raw, n)

    // Height-based normalization: scale so y-extent ≈ [-1, 1].
    // Preserves natural letter aspect ratio (wide text stays wide).
    // textFontSize is applied as a render-time multiplier in SoundDrawingRenderer.
    let minYr = Infinity, maxYr = -Infinity
    for (const p of resampled) {
      if (p.y < minYr) minYr = p.y
      if (p.y > maxYr) maxYr = p.y
    }
    const heightRange = maxYr - minYr
    const normScale   = heightRange > 0 ? 2 / heightRange : 2 / canvasHeight
    const normalized  = resampled.map(p => ({ ...p, x: p.x * normScale, y: p.y * normScale }))

    return computePathNormals(normalized, false)

  } catch {
    return fallback(n)
  }
}

// ── Asset factory ─────────────────────────────────────────────────────────────

/**
 * Creates an OscillatorGlyphAsset from a text string.
 * The id is content-derived and stable across sessions.
 * Call during import / selection — never in the draw loop.
 */
export function makeTextGlyphAsset(
  text: string,
  resolution: number,
): OscillatorGlyphAsset {
  const points = textToGlyphPoints(text, resolution)
  return {
    id:         `text-${hashText(text)}`,
    name:       text,
    sourceType: 'text',
    text,
    pointCount: points.length,
    createdAt:  new Date().toISOString(),
  }
}
