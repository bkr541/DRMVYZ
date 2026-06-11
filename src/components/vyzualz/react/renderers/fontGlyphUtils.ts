import * as opentype from 'opentype.js'
import type { OscillatorGlyphPoint, OscillatorFontAsset } from '../ReactTypes'
import {
  normalizePointCloud,
  computePathNormals,
  resamplePoints,
  generateBuiltinShapePoints,
} from './oscillatorPathUtils'

// ── Binary / Base64 conversion ────────────────────────────────────────────────

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer as ArrayBuffer
}

// ── Font asset creation ───────────────────────────────────────────────────────

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

export async function makeFontAssetFromFile(file: File): Promise<OscillatorFontAsset> {
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

  let fontFamilyName: string | undefined
  let displayName: string
  try {
    const font = opentype.parse(buffer)
    fontFamilyName = firstValue(font.names.fontFamily)
    const fullName = firstValue(font.names.fullName)
    displayName = fullName ?? fontFamilyName ?? file.name.replace(/\.(ttf|otf)$/i, '').trim()
    // Pre-populate the parsed font cache so the first prepare call is free
    parsedFontCache.set(id, font)
  } catch (e) {
    throw new Error(`Failed to parse font: ${(e as Error).message}`)
  }

  const rawFontDataBase64 = arrayBufferToBase64(buffer)

  return {
    id,
    name: displayName,
    fileName: file.name,
    fontFamilyName,
    rawFontDataBase64,
    createdAt: new Date().toISOString(),
    parseError: null,
  }
}

// ── Parsed font cache (module-level, not persisted) ───────────────────────────
// Avoids re-parsing base64 → ArrayBuffer → opentype.Font on every settings change.

const parsedFontCache = new Map<string, opentype.Font>()

export function parseOpenTypeFontFromAsset(asset: OscillatorFontAsset): opentype.Font {
  const cached = parsedFontCache.get(asset.id)
  if (cached) return cached
  const buffer = base64ToArrayBuffer(asset.rawFontDataBase64)
  const font = opentype.parse(buffer)
  parsedFontCache.set(asset.id, font)
  return font
}

export function evictFontFromCache(id: string): void {
  parsedFontCache.delete(id)
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
  fontSize?: number
  letterSpacing?: number
}

export function textToOpenTypeGlyphPoints(
  font: opentype.Font,
  text: string,
  resolution: number,
  options: TextGlyphOptions = {},
): OscillatorGlyphPoint[] {
  const fontSize      = options.fontSize      ?? 160
  const letterSpacing = options.letterSpacing ?? 0
  const n = Math.max(2, Math.round(resolution))
  const trimmed = text.trim()
  if (!trimmed) return generateBuiltinShapePoints('circle', n)

  try {
    const glyphPaths = font.getPaths(trimmed, 0, 0, fontSize, { letterSpacing })
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

    // Normalize to max-radius 1
    const normalized = normalizePointCloud(centered)

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
