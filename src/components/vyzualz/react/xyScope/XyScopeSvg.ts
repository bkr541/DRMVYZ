import type { OscillatorGlyphPoint } from '../ReactTypes'
import { compileSvgToGlyphResult, getSvgContentHash } from '../renderers/svgGlyphUtils'
import { analyzeSvgCapabilities } from '../renderers/svgCapabilityAnalysis'
import { EMPTY_XY_SCOPE_LAYOUT, type XyScopeGlyphGeometry, type XyScopeLayout } from './XyScopeGeometry'
import type { XyScopeSvgProcessing } from './XyScopeSettings'

export interface XyScopeSvgSource { id: string; hash: string; points: readonly OscillatorGlyphPoint[] }
export const XY_SCOPE_SVG_POINT_BUDGET = 2048

/** Uses the shared vector compiler; never substitutes a circle for an unsupported upload. */
export function compileXyScopeSvg(id: string, raw: string): XyScopeSvgSource {
  if (raw.length > 2_000_000) throw new Error('This SVG is too complex. Simplify it to under 2 MB before uploading.')
  const capabilities = analyzeSvgCapabilities(raw)
  if (!capabilities.isValidSvg || !capabilities.hasVectorGeometry || capabilities.hasEmbeddedRaster || capabilities.hasExternalRaster) {
    throw new Error('Choose a vector SVG with drawable paths or shapes. Convert text to outlines and remove raster images first.')
  }
  if (capabilities.supportedVectorElementCount > 2048) throw new Error('This SVG has too many shapes. Simplify its paths before uploading.')
  const result = compileSvgToGlyphResult(raw, XY_SCOPE_SVG_POINT_BUDGET, { discardTinyPaths: false, duplicatePointEpsilon: 0 })
  if (result.status !== 'success' || result.points.length < 2) throw new Error(result.reason ?? 'This SVG has no drawable vector paths.')
  // The shared compiler preserves SVG coordinates relative to its authored origin.
  // Fit the complete artwork as one unit, so translated/viewBox-offset logos stay centered.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const point of result.points) { minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x); minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y) }
  const radius = Math.max(maxX - minX, maxY - minY) / 2
  if (!(radius > 0) || !Number.isFinite(radius)) throw new Error('The SVG has no finite drawable geometry.')
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const points = result.points.map(point => ({ ...point, x: (point.x - cx) / radius, y: (point.y - cy) / radius }))
  return { id, hash: getSvgContentHash(raw), points }
}

/** Independent subpaths remain independent beam strokes, including open polylines. */
export function buildXyScopeSvgLayout(source: XyScopeSvgSource | null, width: number, height: number, size: number, minPieceSize: number, processing: XyScopeSvgProcessing): XyScopeLayout {
  if (!source || width <= 0 || height <= 0) return EMPTY_XY_SCOPE_LAYOUT
  const scale = Math.min(width, height) * Math.min(1, Math.max(.1, size)) * .45
  const paths = new Map<number, OscillatorGlyphPoint[]>()
  for (const point of source.points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
    const path = paths.get(point.pathIndex) ?? []; path.push(point); paths.set(point.pathIndex, path)
  }
  const glyphs: XyScopeGlyphGeometry[] = []
  for (const [index, path] of paths) {
    if (path.length < 2) continue
    const closed = Math.hypot(path[0].x - path[path.length - 1].x, path[0].y - path[path.length - 1].y) < 1e-4
    const points = closed ? path.slice(0, -1) : path
    if (points.length < 2) continue
    let length = 0
    for (let i = 1; i < path.length; i++) length += Math.hypot(path[i].x-path[i-1].x, path[i].y-path[i-1].y)
    if (length < minPieceSize * 2) continue
    const count = points.length
    const x = new Float32Array(count), y = new Float32Array(count), nx = new Float32Array(count), ny = new Float32Array(count), s = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const p = points[i]; x[i] = p.x * scale; y[i] = p.y * scale
      nx[i] = p.normalX ?? 0; ny[i] = p.normalY ?? 1; s[i] = p.progress
    }
    glyphs.push({ character: `svg-${index}`, centerX: 0, heightPx: scale * 2, count, starts: [0, count], closed: [closed], drawMode: processing, x, y, nx, ny, s })
  }
  return { glyphs, totalPoints: glyphs.reduce((sum, glyph) => sum + glyph.count, 0), scale }
}
