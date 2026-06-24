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
  /** Line-height multiplier for newline-separated multiline text. Default: 1.2. */
  lineHeight?:    number
  /** Horizontal alignment of lines relative to the widest line. Default: 'center'. */
  alignment?:     'left' | 'center' | 'right'
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Horizontal padding (px) applied inside each per-character canvas before the glyph is drawn.
 *  Exported so tests can build synthetic edge-pixel arrays in the correct coordinate space. */
export const CHAR_PAD = 8

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
 * Pure assembly step: given pre-scanned per-character edge pixels, builds the
 * merged OscillatorGlyphPoint array with full letter-identity metadata.
 *
 * Each character receives its own pathIndex and characterIndex.  Space characters
 * (or any character whose edge list is empty) advance the layout without emitting
 * points.  Resolution is distributed proportionally by raw edge-pixel count.
 *
 * The coordinate transform maps each character's local canvas pixel (lx, ly) —
 * where the character was drawn starting at x = CHAR_PAD — into the word-centred
 * space: gx = lx − CHAR_PAD + wordX[i] − totalWidth/2, gy = ly − canvasHeight/2.
 *
 * Exported for unit testing; not part of the public API.
 */
export function assembleCharacterPoints(
  chars: string[],
  charWidths: number[],
  gap: number,
  charEdgeLists: [number, number][][],
  canvasHeight: number,
  resolution: number,
): OscillatorGlyphPoint[] {
  // Layout: left-edge x of each character in word space (left-aligned).
  const totalWidth = charWidths.reduce((s, w) => s + w, 0) + gap * Math.max(0, chars.length - 1)
  const wordX: number[] = []
  let cursor = 0
  for (let i = 0; i < chars.length; i++) {
    wordX.push(cursor)
    cursor += charWidths[i] + gap
  }

  type ActiveChar = { charIdx: number; glyphIdx: number; wordXi: number; edges: [number, number][] }
  const active: ActiveChar[] = []
  for (let i = 0; i < chars.length; i++) {
    if (charEdgeLists[i].length > 0) {
      active.push({
        charIdx:  i,
        glyphIdx: chars[i].codePointAt(0) ?? 0,
        wordXi:   wordX[i],
        edges:    charEdgeLists[i],
      })
    }
  }
  if (active.length === 0) return []

  // Proportional resolution allocation across active characters.
  // The last character absorbs any rounding remainder so the total output
  // point count always equals exactly n.
  const n = Math.max(2, Math.round(resolution))
  const totalEdges = active.reduce((s, c) => s + c.edges.length, 0)
  const halfW = totalWidth / 2
  const halfH = canvasHeight / 2

  const allPoints: OscillatorGlyphPoint[] = []
  let nextPathIndex = 0
  let pointsEmitted = 0

  for (let idx = 0; idx < active.length; idx++) {
    const ac     = active[idx]
    const isLast = idx === active.length - 1
    const allocated = isLast
      ? Math.max(2, n - pointsEmitted)
      : Math.max(2, Math.round(n * ac.edges.length / totalEdges))
    const pi = nextPathIndex++
    const rawPts: OscillatorGlyphPoint[] = ac.edges.map(([lx, ly], i) => ({
      x:              lx - CHAR_PAD + ac.wordXi - halfW,
      y:              ly - halfH,
      pathIndex:      pi,
      progress:       ac.edges.length > 1 ? i / (ac.edges.length - 1) : 0,
      characterIndex: ac.charIdx,
      glyphIndex:     ac.glyphIdx,
    }))
    const resampled = resamplePoints(rawPts, allocated)
    for (const p of resampled) allPoints.push(p)
    pointsEmitted += resampled.length
  }

  if (allPoints.length === 0) return []

  // Whole-word height normalization: y-extent → [-1, 1]; aspect ratio preserved.
  let minY = Infinity, maxY = -Infinity
  for (const p of allPoints) {
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const heightRange = maxY - minY
  const normScale   = heightRange > 0 ? 2 / heightRange : 2 / canvasHeight
  const normalized  = allPoints.map(p => ({ ...p, x: p.x * normScale, y: p.y * normScale }))

  // Normals per pathIndex, re-flattened in insertion order.
  const seenPaths = new Set<number>()
  const pathOrder: number[] = []
  for (const p of normalized) {
    if (!seenPaths.has(p.pathIndex)) { seenPaths.add(p.pathIndex); pathOrder.push(p.pathIndex) }
  }
  const result: OscillatorGlyphPoint[] = []
  for (const pi of pathOrder) {
    const cpts = normalized.filter(p => p.pathIndex === pi)
    for (const p of computePathNormals(cpts, false)) result.push(p)
  }
  return result
}

// ── Per-line canvas rasterization (for multiline) ─────────────────────────────
// Returns raw (un-centered, un-normalized) pixel-space points for a single line.

interface CanvasLineRaw {
  points:      OscillatorGlyphPoint[]
  lineWidth:   number   // pixel advance width of the line
  nextCharIdx: number
  nextPathIdx: number
}

function rasterizeLineRaw(
  lineText:       string,
  charIdxOffset:  number,
  pathIdxOffset:  number,
  options:        TextGlyphOptions,
  canvasHeight:   number,
  resolution:     number,
  probeCtx:       CanvasRenderingContext2D,
  fontSize:       number,
): CanvasLineRaw | null {
  const fontFamily   = options.fontFamily    ?? 'Arial, sans-serif'
  const fontWeight   = options.fontWeight    ?? 'bold'
  const letterSpacing = options.letterSpacing ?? 0
  const sampleStep    = Math.max(1, Math.round(options.sampleStep ?? 1))
  const bandH         = Math.max(2, Math.ceil(canvasHeight / 20))

  probeCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  const chars      = Array.from(lineText)
  const charWidths = chars.map(c => probeCtx.measureText(c).width)
  const gap        = letterSpacing

  const totalWidth = charWidths.reduce((s, w) => s + w, 0) + gap * Math.max(0, chars.length - 1)
  const wordX: number[] = []
  let cursor = 0
  for (let i = 0; i < chars.length; i++) {
    wordX.push(cursor)
    cursor += charWidths[i] + gap
  }

  const points: OscillatorGlyphPoint[] = []
  let nextPathIdx = pathIdxOffset
  let totalEdges = 0
  const perCharEdges: [number, number][][] = []

  for (let i = 0; i < chars.length; i++) {
    const charCanvasWidth = Math.max(1, Math.ceil(charWidths[i]) + 2 * CHAR_PAD)
    const charCanvas = document.createElement('canvas')
    charCanvas.width  = charCanvasWidth
    charCanvas.height = canvasHeight
    const ctx = charCanvas.getContext('2d')
    if (!ctx) { perCharEdges.push([]); continue }

    ctx.font         = `${fontWeight} ${fontSize}px ${fontFamily}`
    ctx.textBaseline = 'middle'
    ctx.textAlign    = 'left'
    ctx.fillStyle    = '#ffffff'
    ctx.fillText(chars[i], CHAR_PAD, canvasHeight / 2)

    const imageData = ctx.getImageData(0, 0, charCanvasWidth, canvasHeight)
    const data      = imageData.data
    const edges: [number, number][] = []

    for (let py = 0; py < canvasHeight; py += sampleStep) {
      for (let px = 0; px < charCanvasWidth; px += sampleStep) {
        if (data[(py * charCanvasWidth + px) * 4 + 3] < 50) continue
        const hasNeighbour =
          (px > 0                   && data[(py * charCanvasWidth + (px - 1)) * 4 + 3] < 50) ||
          (px < charCanvasWidth - 1 && data[(py * charCanvasWidth + (px + 1)) * 4 + 3] < 50) ||
          (py > 0                   && data[((py - 1) * charCanvasWidth + px) * 4 + 3] < 50) ||
          (py < canvasHeight    - 1 && data[((py + 1) * charCanvasWidth + px) * 4 + 3] < 50)
        if (hasNeighbour) edges.push([px, py])
      }
    }

    edges.sort((a, b) => {
      const ba = Math.floor(a[1] / bandH)
      const bb = Math.floor(b[1] / bandH)
      if (ba !== bb) return ba - bb
      return ba % 2 === 0 ? a[0] - b[0] : b[0] - a[0]
    })

    perCharEdges.push(edges)
    totalEdges += edges.length
  }

  // Allocate proportional resolution to each active character
  const n = Math.max(2, Math.round(resolution))
  let pointsEmitted = 0

  const active = chars
    .map((c, i) => ({ ci: i, char: c, edges: perCharEdges[i] ?? [] }))
    .filter(ac => ac.edges.length > 0)

  for (let idx = 0; idx < active.length; idx++) {
    const ac      = active[idx]
    const isLast  = idx === active.length - 1
    const allocated = isLast
      ? Math.max(2, n - pointsEmitted)
      : Math.max(2, Math.round(n * ac.edges.length / (totalEdges || 1)))
    const pi      = nextPathIdx++
    const charIdx = charIdxOffset + ac.ci
    const xBase   = wordX[ac.ci]

    const rawPts: OscillatorGlyphPoint[] = ac.edges.map(([lx, ly], j) => ({
      x:              lx - CHAR_PAD + xBase,          // left-aligned in pixel space
      y:              ly,                               // raw canvas Y (top=0)
      pathIndex:      pi,
      progress:       ac.edges.length > 1 ? j / (ac.edges.length - 1) : 0,
      characterIndex: charIdx,
      glyphIndex:     chars[ac.ci].codePointAt(0) ?? 0,
    }))

    const resampled = resamplePoints(rawPts, allocated)
    for (const p of resampled) points.push(p)
    pointsEmitted += resampled.length
  }

  return {
    points,
    lineWidth:   totalWidth,
    nextCharIdx: charIdxOffset + chars.length,
    nextPathIdx,
  }
}

/**
 * Converts a text string into normalized OscillatorGlyphPoints suitable for
 * oscilloscope rendering.  This is the canvas-rasterization fallback path used
 * when an OpenType font file is not available.
 *
 * Algorithm:
 *  1. Probe-canvas: measure each character's advance width.
 *  2. Per-character canvas: rasterize each character independently on a small
 *     canvas (width = charWidth + 2×CHAR_PAD) so letter identity is preserved.
 *  3. Edge detection: flag pixels that are opaque (alpha ≥ 50) with at least one
 *     transparent 4-connected neighbour.
 *  4. Boustrophedon sort within each character for spatial coherence.
 *  5. assembleCharacterPoints: proportional resampling, metadata assignment,
 *     whole-word centering + height normalisation, per-character normals.
 *
 * Returns a circle fallback when:
 *  - `text` is empty / whitespace
 *  - `document` is unavailable (SSR, Node test environment)
 *  - The canvas API is unavailable
 *  - No edge pixels were found in any character
 *
 * Call during glyph import / selection — not inside the draw loop.
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
    canvasHeight  = 128,
    sampleStep    = 1,
    letterSpacing = 0,
    lineHeight    = 1.2,
    alignment     = 'center',
  } = options ?? {}

  if (typeof document === 'undefined') return fallback(n)

  // Split into non-empty lines; single line uses the original assembleCharacterPoints path.
  const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (rawLines.length === 0) return fallback(n)

  try {
    const fontSize = Math.max(8, Math.floor(canvasHeight * 0.72))

    // ── Single-line: original path (keeps assembleCharacterPoints behavior) ───
    if (rawLines.length === 1) {
      const probeCanvas = document.createElement('canvas')
      probeCanvas.width  = 1
      probeCanvas.height = 1
      const probeCtx = probeCanvas.getContext('2d')
      if (!probeCtx) return fallback(n)
      probeCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
      const chars      = Array.from(rawLines[0])
      const charWidths = chars.map(c => probeCtx.measureText(c).width)
      const step       = Math.max(1, Math.round(sampleStep))
      const bandH      = Math.max(2, Math.ceil(canvasHeight / 20))
      const charEdgeLists: [number, number][][] = []

      for (let i = 0; i < chars.length; i++) {
        const charCanvasWidth = Math.max(1, Math.ceil(charWidths[i]) + 2 * CHAR_PAD)
        const charCanvas = document.createElement('canvas')
        charCanvas.width  = charCanvasWidth
        charCanvas.height = canvasHeight
        const ctx = charCanvas.getContext('2d')
        if (!ctx) { charEdgeLists.push([]); continue }
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
        ctx.textBaseline = 'middle'
        ctx.textAlign    = 'left'
        ctx.fillStyle    = '#ffffff'
        ctx.fillText(chars[i], CHAR_PAD, canvasHeight / 2)

        const imageData = ctx.getImageData(0, 0, charCanvasWidth, canvasHeight)
        const data      = imageData.data
        const edges: [number, number][] = []
        for (let py = 0; py < canvasHeight; py += step) {
          for (let px = 0; px < charCanvasWidth; px += step) {
            if (data[(py * charCanvasWidth + px) * 4 + 3] < 50) continue
            const has =
              (px > 0                   && data[(py * charCanvasWidth + (px - 1)) * 4 + 3] < 50) ||
              (px < charCanvasWidth - 1 && data[(py * charCanvasWidth + (px + 1)) * 4 + 3] < 50) ||
              (py > 0                   && data[((py - 1) * charCanvasWidth + px) * 4 + 3] < 50) ||
              (py < canvasHeight    - 1 && data[((py + 1) * charCanvasWidth + px) * 4 + 3] < 50)
            if (has) edges.push([px, py])
          }
        }
        edges.sort((a, b) => {
          const ba = Math.floor(a[1] / bandH), bb = Math.floor(b[1] / bandH)
          if (ba !== bb) return ba - bb
          return ba % 2 === 0 ? a[0] - b[0] : b[0] - a[0]
        })
        charEdgeLists.push(edges)
      }

      const pts = assembleCharacterPoints(chars, charWidths, letterSpacing, charEdgeLists, canvasHeight, n)
      return pts.length > 0 ? pts : fallback(n)
    }

    // ── Multiline: rasterize each line, apply alignment + vertical offset ─────
    const probeCanvas = document.createElement('canvas')
    probeCanvas.width  = 1
    probeCanvas.height = 1
    const probeCtx = probeCanvas.getContext('2d')
    if (!probeCtx) return fallback(n)

    const lineResults: CanvasLineRaw[] = []
    let charIdxOffset = 0
    let pathIdxOffset = 0

    for (const lineText of rawLines) {
      const lr = rasterizeLineRaw(
        lineText, charIdxOffset, pathIdxOffset,
        { ...options, letterSpacing }, canvasHeight, n, probeCtx, fontSize,
      )
      if (lr) {
        lineResults.push(lr)
        charIdxOffset = lr.nextCharIdx
        pathIdxOffset = lr.nextPathIdx
      }
    }

    if (lineResults.length === 0 || lineResults.every(lr => lr.points.length === 0)) {
      return fallback(n)
    }

    // Alignment X offsets
    const maxLineWidth = Math.max(...lineResults.map(lr => lr.lineWidth))
    const lineXOffsets = lineResults.map(lr => {
      switch (alignment) {
        case 'left':   return 0
        case 'right':  return maxLineWidth - lr.lineWidth
        default:       return (maxLineWidth - lr.lineWidth) / 2  // center
      }
    })

    // Vertical step: canvasHeight * lineHeight per line
    const lineStep = canvasHeight * lineHeight

    // Build charToLine map, apply offsets
    const charToLine = new Map<number, number>()
    const mergedPoints: OscillatorGlyphPoint[] = []

    for (let li = 0; li < lineResults.length; li++) {
      const xOff = lineXOffsets[li]
      const yOff = li * lineStep
      for (const p of lineResults[li].points) {
        if (p.characterIndex != null) charToLine.set(p.characterIndex, li)
        mergedPoints.push({ ...p, x: p.x + xOff, y: p.y + yOff })
      }
    }

    if (mergedPoints.length === 0) return fallback(n)

    // Global centering
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of mergedPoints) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
    }
    const midX = (minX + maxX) / 2
    const midY = (minY + maxY) / 2
    const centered = mergedPoints.map(p => ({ ...p, x: p.x - midX, y: p.y - midY }))

    // Height normalization
    const heightRange = maxY - minY
    const normScale   = heightRange > 0 ? 2 / heightRange : 2 / canvasHeight
    const normalized  = centered.map(p => ({
      ...p,
      x:         p.x * normScale,
      y:         p.y * normScale,
      lineIndex: p.characterIndex != null ? (charToLine.get(p.characterIndex) ?? 0) : 0,
    }))

    // Normals per pathIndex
    const seenPaths = new Set<number>()
    const pathOrder: number[] = []
    for (const p of normalized) {
      if (!seenPaths.has(p.pathIndex)) { seenPaths.add(p.pathIndex); pathOrder.push(p.pathIndex) }
    }
    const result: OscillatorGlyphPoint[] = []
    for (const pi of pathOrder) {
      const cpts = normalized.filter(p => p.pathIndex === pi)
      for (const p of computePathNormals(cpts, false)) result.push(p)
    }

    return result.length > 0 ? result : fallback(n)

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
