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
}

export function textToOpenTypeGlyphPoints(
  font: opentype.Font,
  text: string,
  resolution: number,
  options: TextGlyphOptions = {},
): OscillatorGlyphPoint[] {
  const fontSize      = 160  // fixed internal scale; textFontSize is applied at render time only
  const letterSpacing = options.letterSpacing ?? 0
  const n = Math.max(2, Math.round(resolution))
  const trimmed = text.trim()
  if (!trimmed) return generateBuiltinShapePoints('circle', n)

  try {
    // opentype.js letterSpacing is in em units (multiplied by fontSize internally).
    // The UI value is in pixel-equivalent units (same convention as the canvas fallback),
    // so divide by fontSize to convert to em before passing to getPaths.
    const letterSpacingEm = letterSpacing / fontSize
    const glyphPaths = font.getPaths(trimmed, 0, 0, fontSize, { letterSpacing: letterSpacingEm })
    const contours = sampleGlyphPaths(glyphPaths)

    if (contours.length === 0) return generateBuiltinShapePoints('circle', n)

    // Distribute resolution proportionally by raw point count
    const totalRaw = contours.reduce((s, c) => s + c.pts.length, 0)

    // Convert all raw XY points to OscillatorGlyphPoint (with pathIndex), resample per contour
    const allPoints: OscillatorGlyphPoint[] = []

    for (let ci = 0; ci < contours.length; ci++) {
      const raw = contours[ci].pts
      const allocated = Math.max(2, Math.round(n * raw.length / totalRaw))

      const rawGlyphPts: OscillatorGlyphPoint[] = raw.map((p, i) => ({
        x: p.x, y: p.y,
        pathIndex: ci,
        progress: raw.length > 1 ? i / (raw.length - 1) : 0,
      }))

      const resampled = resamplePoints(rawGlyphPts, allocated)
      for (const p of resampled) allPoints.push({ ...p, pathIndex: ci })
    }

    if (allPoints.length === 0) return generateBuiltinShapePoints('circle', n)

    // Center on bounding box midpoint
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of allPoints) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    const cx2 = (minX + maxX) / 2
    const cy2 = (minY + maxY) / 2
    const centered = allPoints.map(p => ({ ...p, x: p.x - cx2, y: p.y - cy2 }))

    // Height-based normalization: scale so y-extent ≈ [-1, 1].
    // Preserves natural letter aspect ratio (wide text stays wide).
    // textFontSize is applied as a render-time multiplier in SoundDrawingRenderer.
    const heightRange = maxY - minY
    const normScale   = heightRange > 0 ? 2 / heightRange : 1
    const normalized  = centered.map(p => ({ ...p, x: p.x * normScale, y: p.y * normScale }))

    // Compute normals per contour and re-flatten
    const result: OscillatorGlyphPoint[] = []
    for (let ci = 0; ci < contours.length; ci++) {
      const contourPts = normalized.filter(p => p.pathIndex === ci)
      const withNormals = computePathNormals(contourPts, false)
      for (const p of withNormals) result.push(p)
    }

    return result
  } catch {
    return generateBuiltinShapePoints('circle', n)
  }
}
