import * as opentype from 'opentype.js'
import type { OscillatorGlyphPoint, OscillatorFontAsset } from '../ReactTypes'
import {
  computePathNormals,
  resamplePoints,
  generateBuiltinShapePoints,
} from './oscillatorPathUtils'

// ── Internal helpers ──────────────────────────────────────────────────────────

function firstValue(obj: opentype.LocalizedName | undefined): string | undefined {
  if (!obj) return undefined
  return obj['en'] ?? obj[Object.keys(obj)[0]]
}

function hashBuffer(bytes: Uint8Array): string {
  // FNV-1a 32-bit over first 256 bytes — fast, good enough for an ID
  let h = 0x811c9dc5
  const limit = Math.min(bytes.length, 256)
  for (let i = 0; i < limit; i++) {
    h ^= bytes[i]
    h = (h * 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

// ── Font inspection ───────────────────────────────────────────────────────────

/** Result returned by inspectFontFile before any cloud upload occurs. */
export interface FontInspectionResult {
  /** Deterministic ID derived from the font binary (FNV-1a of first 256 bytes). */
  id:              string
  /** Display name extracted from the font's fullName / fontFamily tables. */
  name:            string
  fileName:        string
  fontFamilyName?: string
  /** 'font/ttf' or 'font/otf' based on file extension. */
  mimeType:        string
  fileSize:        number
  /** Raw binary — pass to the storage upload helper, then discard. */
  buffer:          ArrayBuffer
  /** Parsed opentype.Font — already stored in the runtime cache. */
  font:            opentype.Font
}

/**
 * Validates a font file (extension + size), parses it with opentype.js, and
 * returns the extracted metadata together with the raw ArrayBuffer and parsed
 * font object.  Populates the runtime cache immediately so subsequent calls to
 * parseOpenTypeFontFromAsset() succeed without re-parsing.
 *
 * Does NOT produce an OscillatorFontAsset — the caller must upload to storage
 * first to obtain a storagePath, then construct the asset record.
 */
export async function inspectFontFile(file: File): Promise<FontInspectionResult> {
  const nameLower = file.name.toLowerCase()
  if (!nameLower.endsWith('.ttf') && !nameLower.endsWith('.otf')) {
    throw new Error('Only .ttf and .otf fonts are supported')
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Font file too large (max 2 MB)')
  }

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const id = `font-${hashBuffer(bytes)}`

  let font: opentype.Font
  let fontFamilyName: string | undefined
  let displayName: string
  try {
    font = opentype.parse(buffer)
    fontFamilyName = firstValue(font.names.fontFamily)
    const fullName = firstValue(font.names.fullName)
    displayName = fullName ?? fontFamilyName ?? file.name.replace(/\.(ttf|otf)$/i, '').trim()
  } catch (e) {
    throw new Error(`Failed to parse font: ${(e as Error).message}`)
  }

  const mimeType = nameLower.endsWith('.otf') ? 'font/otf' : 'font/ttf'

  // Pre-populate runtime caches so callers can use parseOpenTypeFontFromAsset immediately.
  storeFontRuntime(id, font, buffer)

  return {
    id,
    name:       displayName,
    fileName:   file.name,
    fontFamilyName,
    mimeType,
    fileSize:   file.size,
    buffer,
    font,
  }
}

// ── Runtime font caches (module-level, never persisted) ───────────────────────
// Font binary and parsed data live here only while the tab is open.
// Cloud storage is the source of truth; these caches are populated on upload
// or download and evicted on asset deletion.

const parsedFontCache = new Map<string, opentype.Font>()
const fontBufferCache = new Map<string, ArrayBuffer>()

/** Insert (or replace) runtime font data keyed by asset ID. */
export function storeFontRuntime(id: string, font: opentype.Font, buffer?: ArrayBuffer): void {
  parsedFontCache.set(id, font)
  if (buffer !== undefined) fontBufferCache.set(id, buffer)
}

/**
 * Store only the raw ArrayBuffer for preview purposes without parsing the font.
 * This allows FontFace CSS registration without the OpenType parse cost.
 * When the font is later selected for rendering, selectOscillatorFont will reuse
 * this buffer and only then parse with opentype.js.
 */
export function storePreviewBuffer(id: string, buffer: ArrayBuffer): void {
  fontBufferCache.set(id, buffer)
}

/** Returns true when the parsed font for this ID is in the runtime cache. */
export function hasFontRuntime(id: string): boolean {
  return parsedFontCache.has(id)
}

/** Returns the cached parsed font, or undefined if not yet loaded. */
export function getFontFromCache(id: string): opentype.Font | undefined {
  return parsedFontCache.get(id)
}

/** Returns the cached raw ArrayBuffer, or undefined if not available. */
export function getBufferFromCache(id: string): ArrayBuffer | undefined {
  return fontBufferCache.get(id)
}

/**
 * Removes all runtime data for the given asset ID from both caches.
 * Call this when an asset is deleted from the store or the cloud record is removed.
 */
export function evictFontFromCache(id: string): void {
  parsedFontCache.delete(id)
  fontBufferCache.delete(id)
}

// ── Font parsing from asset (cache-only) ─────────────────────────────────────

/**
 * Returns the opentype.Font for the given asset from the runtime cache.
 * Throws if the font has not been loaded — callers must ensure the font is
 * downloaded and stored via storeFontRuntime() before calling this.
 */
export function parseOpenTypeFontFromAsset(asset: OscillatorFontAsset): opentype.Font {
  const cached = parsedFontCache.get(asset.id)
  if (!cached) {
    throw new Error(
      `[fontGlyphUtils] font data is not loaded for "${asset.name}" (id: ${asset.id}) — call storeFontRuntime() after downloading the font binary`,
    )
  }
  return cached
}

// ── Vector text path sampling ─────────────────────────────────────────────────

const CUBIC_STEPS = 8
const QUAD_STEPS  = 6

function cubicBezierPt(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number, t: number,
): { x: number; y: number } {
  const u = 1 - t
  return {
    x: u*u*u*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3,
    y: u*u*u*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3,
  }
}

function quadBezierPt(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, t: number,
): { x: number; y: number } {
  const u = 1 - t
  return {
    x: u*u*x0 + 2*u*t*x1 + t*t*x2,
    y: u*u*y0 + 2*u*t*y1 + t*t*y2,
  }
}

interface RawContour {
  pts: Array<{ x: number; y: number }>
}

interface RawContourMeta extends RawContour {
  characterIndex: number
  glyphFontIndex: number  // glyph.index in the font table — same for all contours of one char
  pathIndex:      number  // globally unique contour ID across all characters
}

function sampleGlyphPaths(glyphPaths: opentype.Path[]): RawContour[] {
  const contours: RawContour[] = []

  for (const glyphPath of glyphPaths) {
    let current: Array<{ x: number; y: number }> | null = null
    let cx = 0, cy = 0

    for (const cmd of glyphPath.commands) {
      switch (cmd.type) {
        case 'M':
          if (current && current.length >= 2) contours.push({ pts: current })
          current = [{ x: cmd.x, y: cmd.y }]
          cx = cmd.x; cy = cmd.y
          break
        case 'L':
          current?.push({ x: cmd.x, y: cmd.y })
          cx = cmd.x; cy = cmd.y
          break
        case 'C': {
          if (current) {
            for (let s = 1; s <= CUBIC_STEPS; s++) {
              current.push(cubicBezierPt(cx, cy, cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y, s / CUBIC_STEPS))
            }
          }
          cx = cmd.x; cy = cmd.y
          break
        }
        case 'Q': {
          if (current) {
            for (let s = 1; s <= QUAD_STEPS; s++) {
              current.push(quadBezierPt(cx, cy, cmd.x1, cmd.y1, cmd.x, cmd.y, s / QUAD_STEPS))
            }
          }
          cx = cmd.x; cy = cmd.y
          break
        }
        case 'Z':
          if (current && current.length >= 2) contours.push({ pts: current })
          current = null
          break
      }
    }

    if (current && current.length >= 2) contours.push({ pts: current })
  }

  return contours
}

export interface TextGlyphOptions {
  letterSpacing?: number
  /** Line-height multiplier applied to font cap-height for multiline spacing. Default 1.2. */
  lineHeight?:    number
  /** Horizontal alignment of lines relative to the widest line. Default 'center'. */
  alignment?:     'left' | 'center' | 'right'
}

// ── Per-line contour sampling helper ─────────────────────────────────────────

interface LineContourResult {
  contours:   RawContourMeta[]
  lineWidth:  number   // cursor position at end of line (advance width in pixels)
  charCount:  number   // character count including spaces
  nextPathIdx: number
}

function sampleLineContours(
  font:          opentype.Font,
  lineText:      string,
  fontSize:      number,
  scale:         number,
  letterSpacing: number,
  charIdxOffset: number,
  pathIdxStart:  number,
): LineContourResult {
  const chars = Array.from(lineText)
  let cursorX       = 0
  let nextPathIndex = pathIdxStart
  const contours: RawContourMeta[] = []

  for (let ci = 0; ci < chars.length; ci++) {
    const charIdx = charIdxOffset + ci
    const glyph   = font.charToGlyph(chars[ci])
    const path    = glyph.getPath(cursorX, 0, fontSize)
    const raw     = sampleGlyphPaths([path])

    for (const contour of raw) {
      contours.push({
        pts:            contour.pts,
        characterIndex: charIdx,
        glyphFontIndex: glyph.index,
        pathIndex:      nextPathIndex++,
      })
    }

    const nextChar  = ci + 1 < chars.length ? chars[ci + 1] : null
    const nextGlyph = nextChar ? font.charToGlyph(nextChar) : null
    const kern      = nextGlyph ? font.getKerningValue(glyph, nextGlyph) * scale : 0
    cursorX += (glyph.advanceWidth ?? 0) * scale + kern + letterSpacing
  }

  return { contours, lineWidth: cursorX, charCount: chars.length, nextPathIdx: nextPathIndex }
}

// ── Shared point assembly (centering + normalization + normals) ───────────────

function finalizePoints(
  allPoints:     OscillatorGlyphPoint[],
  charToLine:    Map<number, number>,
  resolution:    number,
  totalContours: RawContourMeta[],
): OscillatorGlyphPoint[] {
  if (allPoints.length === 0) return []

  // Whole-block centering
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of allPoints) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
  }
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  const centered = allPoints.map(p => ({ ...p, x: p.x - midX, y: p.y - midY }))

  // Height-based normalization: y-extent → [-1, 1]; aspect ratio preserved
  const heightRange = maxY - minY
  const normScale   = heightRange > 0 ? 2 / heightRange : 1
  const normalized  = centered.map(p => ({
    ...p,
    x:         p.x * normScale,
    y:         p.y * normScale,
    lineIndex: p.characterIndex != null ? (charToLine.get(p.characterIndex) ?? 0) : 0,
  }))

  // Normals per contour, re-flattened in insertion order
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
  void resolution    // resolution is already applied during resampling
  void totalContours // kept for future use
  return result
}

export function textToOpenTypeGlyphPoints(
  font: opentype.Font,
  text: string,
  resolution: number,
  options: TextGlyphOptions = {},
): OscillatorGlyphPoint[] {
  const fontSize      = 160  // fixed internal scale; textFontSize is applied at render time only
  const letterSpacing = options.letterSpacing ?? 0
  const lineHeight    = options.lineHeight    ?? 1.2
  const alignment     = options.alignment     ?? 'center'
  const n = Math.max(2, Math.round(resolution))

  // Split into non-empty lines; single element = original single-line behavior
  const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (rawLines.length === 0) return generateBuiltinShapePoints('circle', n)

  try {
    const scale = fontSize / (font.unitsPerEm || 1000)

    // ── Per-line contour sampling ─────────────────────────────────────────────
    let charIdxOffset = 0
    let pathIdxOffset = 0
    const lineResults: LineContourResult[] = []

    for (const lineText of rawLines) {
      const lr = sampleLineContours(font, lineText, fontSize, scale, letterSpacing, charIdxOffset, pathIdxOffset)
      lineResults.push(lr)
      charIdxOffset += lr.charCount
      pathIdxOffset  = lr.nextPathIdx
    }

    const hasContours = lineResults.some(lr => lr.contours.length > 0)
    if (!hasContours) return generateBuiltinShapePoints('circle', n)

    // ── Alignment X offset per line ───────────────────────────────────────────
    const maxLineWidth = Math.max(...lineResults.map(lr => lr.lineWidth))
    const lineXOffsets = lineResults.map(lr => {
      switch (alignment) {
        case 'left':   return 0
        case 'right':  return maxLineWidth - lr.lineWidth
        default:       return (maxLineWidth - lr.lineWidth) / 2  // center
      }
    })

    // ── Vertical offset per line (using ascender as cap-height proxy) ─────────
    // Guard: real fonts always have ascender, but test stubs may not.
    const fontAscender = (typeof (font as unknown as { ascender?: unknown }).ascender === 'number')
      ? (font as unknown as { ascender: number }).ascender
      : (font.unitsPerEm ?? 1000)
    const lineStep = (fontAscender / (font.unitsPerEm || 1000)) * fontSize * lineHeight

    // ── Merge all contours with position offsets applied ──────────────────────
    const charToLine = new Map<number, number>()
    const allContours: (RawContourMeta & { li: number })[] = []

    for (let li = 0; li < lineResults.length; li++) {
      const xOff = lineXOffsets[li]
      const yOff = li * lineStep
      for (const rc of lineResults[li].contours) {
        // Track characterIndex → lineIndex for assignment after resample
        charToLine.set(rc.characterIndex, li)
        allContours.push({
          ...rc,
          pts: rc.pts.map(p => ({ x: p.x + xOff, y: p.y + yOff })),
          li,
        })
      }
    }

    if (allContours.length === 0) return generateBuiltinShapePoints('circle', n)

    // ── Proportional resolution allocation ────────────────────────────────────
    const totalRaw  = allContours.reduce((s, c) => s + c.pts.length, 0)
    const allPoints: OscillatorGlyphPoint[] = []

    for (const rc of allContours) {
      const allocated = Math.max(2, Math.round(n * rc.pts.length / totalRaw))
      const rawPts: OscillatorGlyphPoint[] = rc.pts.map((p, i) => ({
        x:              p.x,
        y:              p.y,
        pathIndex:      rc.pathIndex,
        progress:       rc.pts.length > 1 ? i / (rc.pts.length - 1) : 0,
        characterIndex: rc.characterIndex,
        glyphIndex:     rc.glyphFontIndex,
      }))
      const resampled = resamplePoints(rawPts, allocated)
      for (const p of resampled) allPoints.push(p)
    }

    if (allPoints.length === 0) return generateBuiltinShapePoints('circle', n)

    return finalizePoints(allPoints, charToLine, n, allContours)
  } catch {
    return generateBuiltinShapePoints('circle', n)
  }
}
