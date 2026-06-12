import { svgPathProperties } from 'svg-path-properties'
import type { OscillatorGlyphPoint, OscillatorGlyphAsset } from '../ReactTypes'
import {
  normalizePointCloud,
  computePathNormals,
  generateBuiltinShapePoints,
} from './oscillatorPathUtils'

// ── Compiler version ──────────────────────────────────────────────────────────

/** Bump when the sampling algorithm changes to invalidate stale cache entries. */
export const SVG_GLYPH_COMPILER_VERSION = '2'

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

// ── 2D affine matrix [a, b, c, d, e, f] ──────────────────────────────────────
// Transforms a point:  x' = a·x + c·y + e,  y' = b·x + d·y + f

type M2D = [number, number, number, number, number, number]

function identity(): M2D { return [1, 0, 0, 1, 0, 0] }

/** Compose two matrices: A × B (A is outer/parent, B is inner/child). */
function composeM2D(a: M2D, b: M2D): M2D {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}

function applyM2D(m: M2D, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

function isIdentityM2D(m: M2D): boolean {
  return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0
}

/**
 * Parses an SVG transform attribute string into a single composed M2D matrix.
 * Handles translate, scale, rotate, matrix, skewX, skewY.
 * Multiple transform functions are composed left-to-right (SVG spec order).
 */
function parseTransformAttr(attr: string): M2D {
  let result: M2D = identity()
  const re = /(\w+)\s*\(([^)]*)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(attr)) !== null) {
    const fn = m[1].toLowerCase()
    const vals = m[2].trim().split(/[\s,]+/).map(Number).filter(v => !Number.isNaN(v))
    let t: M2D = identity()
    switch (fn) {
      case 'translate': {
        const tx = vals[0] ?? 0, ty = vals[1] ?? 0
        t = [1, 0, 0, 1, tx, ty]
        break
      }
      case 'scale': {
        const sx = vals[0] ?? 1, sy = vals[1] ?? sx
        t = [sx, 0, 0, sy, 0, 0]
        break
      }
      case 'rotate': {
        const ang = ((vals[0] ?? 0) * Math.PI) / 180
        const cos = Math.cos(ang), sin = Math.sin(ang)
        const cx = vals[1] ?? 0, cy = vals[2] ?? 0
        // rotate(a, cx, cy) = translate(cx,cy) · rotate(a) · translate(-cx,-cy)
        t = [
          cos, sin, -sin, cos,
          cx - cos * cx + sin * cy,
          cy - sin * cx - cos * cy,
        ]
        break
      }
      case 'matrix':
        if (vals.length >= 6) t = [vals[0], vals[1], vals[2], vals[3], vals[4], vals[5]]
        break
      case 'skewx': {
        const ta = Math.tan(((vals[0] ?? 0) * Math.PI) / 180)
        t = [1, 0, ta, 1, 0, 0]
        break
      }
      case 'skewy': {
        const ta = Math.tan(((vals[0] ?? 0) * Math.PI) / 180)
        t = [1, ta, 0, 1, 0, 0]
        break
      }
    }
    result = composeM2D(result, t)
  }
  return result
}

// ── Primitive element → path data ─────────────────────────────────────────────

interface RectAttrs { x: number; y: number; width: number; height: number; rx: number; ry: number }

function rectToPathData({ x, y, width: w, height: h, rx: rxR, ry: ryR }: RectAttrs): string | null {
  if (!w || !h || w <= 0 || h <= 0) return null
  const rx = Math.min(rxR, w / 2)
  const ry = Math.min(ryR, h / 2)
  if (rx === 0 && ry === 0) {
    return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`
  }
  return (
    `M ${x + rx} ${y} L ${x + w - rx} ${y} ` +
    `A ${rx} ${ry} 0 0 1 ${x + w} ${y + ry} ` +
    `L ${x + w} ${y + h - ry} ` +
    `A ${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h} ` +
    `L ${x + rx} ${y + h} ` +
    `A ${rx} ${ry} 0 0 1 ${x} ${y + h - ry} ` +
    `L ${x} ${y + ry} A ${rx} ${ry} 0 0 1 ${x + rx} ${y} Z`
  )
}

function circleToPathData(cx: number, cy: number, r: number): string | null {
  if (r <= 0) return null
  return (
    `M ${cx - r} ${cy} ` +
    `A ${r} ${r} 0 1 0 ${cx + r} ${cy} ` +
    `A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`
  )
}

function ellipseToPathData(cx: number, cy: number, rx: number, ry: number): string | null {
  if (rx <= 0 || ry <= 0) return null
  return (
    `M ${cx - rx} ${cy} ` +
    `A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} ` +
    `A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`
  )
}

function parsePointsAttr(s: string): Array<[number, number]> {
  const nums = s.trim().split(/[\s,]+/).map(Number).filter(v => !Number.isNaN(v))
  const pts: Array<[number, number]> = []
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]])
  return pts
}

function pointsToPathData(pts: Array<[number, number]>, close: boolean): string | null {
  if (pts.length < 2) return null
  const parts = [`M ${pts[0][0]} ${pts[0][1]}`]
  for (let i = 1; i < pts.length; i++) parts.push(`L ${pts[i][0]} ${pts[i][1]}`)
  if (close) parts.push('Z')
  return parts.join(' ')
}

// ── Compound path splitting ───────────────────────────────────────────────────

/**
 * Splits a compound path d-string (one with multiple M commands) into individual
 * subpath strings, each beginning with its own M command.
 * Single-subpath paths are returned as-is in a one-element array.
 */
function splitCompoundPath(d: string): string[] {
  const segments = d.match(/[Mm][^Mm]*/g) ?? []
  return segments.map(s => s.trim()).filter(s => s.length > 1)
}

// ── Internal raw-subpath extraction ──────────────────────────────────────────

interface RawSubpath {
  data: string  // single subpath d-string (starts with M)
  ctm: M2D      // composed transform from SVG root to this element
}

/** Helper used in the browser path to walk an element's ancestors. */
function getElementCTM(el: Element, svgRoot: Element): M2D {
  const stack: M2D[] = []
  let cur: Element | null = el
  while (cur && cur !== svgRoot) {
    const t = cur.getAttribute('transform')
    if (t) stack.push(parseTransformAttr(t))
    cur = cur.parentElement
  }
  // stack[0] = element's own transform, stack[last] = outermost child of SVG root
  // Compose outermost first: reverse and fold left
  return stack.reverse().reduce((acc, m) => composeM2D(acc, m), identity())
}

function pushSubpaths(result: RawSubpath[], pathData: string, ctm: M2D): void {
  for (const seg of splitCompoundPath(pathData)) result.push({ data: seg, ctm })
}

function compileSubpathsBrowser(rawSvg: string): RawSubpath[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(rawSvg, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return []
  doc.querySelectorAll('script, style').forEach(el => el.remove())

  const svgRoot = doc.querySelector('svg')
  if (!svgRoot) return []

  const result: RawSubpath[] = []
  const ctm = (el: Element) => getElementCTM(el, svgRoot)
  const f = parseFloat

  for (const el of Array.from(doc.querySelectorAll('path'))) {
    const d = el.getAttribute('d')?.trim()
    if (d) pushSubpaths(result, d, ctm(el))
  }
  for (const el of Array.from(doc.querySelectorAll('rect'))) {
    const d = rectToPathData({
      x: f(el.getAttribute('x') ?? '0'),
      y: f(el.getAttribute('y') ?? '0'),
      width: f(el.getAttribute('width') ?? '0'),
      height: f(el.getAttribute('height') ?? '0'),
      rx: f(el.getAttribute('rx') ?? '0'),
      ry: f(el.getAttribute('ry') ?? '0'),
    })
    if (d) pushSubpaths(result, d, ctm(el))
  }
  for (const el of Array.from(doc.querySelectorAll('circle'))) {
    const d = circleToPathData(
      f(el.getAttribute('cx') ?? '0'),
      f(el.getAttribute('cy') ?? '0'),
      f(el.getAttribute('r') ?? '0'),
    )
    if (d) pushSubpaths(result, d, ctm(el))
  }
  for (const el of Array.from(doc.querySelectorAll('ellipse'))) {
    const d = ellipseToPathData(
      f(el.getAttribute('cx') ?? '0'),
      f(el.getAttribute('cy') ?? '0'),
      f(el.getAttribute('rx') ?? '0'),
      f(el.getAttribute('ry') ?? '0'),
    )
    if (d) pushSubpaths(result, d, ctm(el))
  }
  for (const el of Array.from(doc.querySelectorAll('line'))) {
    const x1 = f(el.getAttribute('x1') ?? '0'), y1 = f(el.getAttribute('y1') ?? '0')
    const x2 = f(el.getAttribute('x2') ?? '0'), y2 = f(el.getAttribute('y2') ?? '0')
    if (x1 !== x2 || y1 !== y2) pushSubpaths(result, `M ${x1} ${y1} L ${x2} ${y2}`, ctm(el))
  }
  for (const el of Array.from(doc.querySelectorAll('polyline'))) {
    const ps = el.getAttribute('points')
    if (ps) { const d = pointsToPathData(parsePointsAttr(ps), false); if (d) pushSubpaths(result, d, ctm(el)) }
  }
  for (const el of Array.from(doc.querySelectorAll('polygon'))) {
    const ps = el.getAttribute('points')
    if (ps) { const d = pointsToPathData(parsePointsAttr(ps), true); if (d) pushSubpaths(result, d, ctm(el)) }
  }
  return result
}

function getAttrNum(tag: string, attr: string, fallback = 0): number {
  const m = new RegExp(`\\b${attr}=["']([^"']+)["']`, 'i').exec(tag)
  return m ? parseFloat(m[1]) : fallback
}

function getAttrStr(tag: string, attr: string): string | null {
  const m = new RegExp(`\\b${attr}=["']([^"']*?)["']`, 'i').exec(tag)
  return m ? m[1] : null
}

function compileSubpathsRegex(rawSvg: string): RawSubpath[] {
  const stripped = rawSvg.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  const idm = identity()
  const result: RawSubpath[] = []

  // <path>
  const pathTagRe = /<path\b[^>]*>/gi
  const dAttrRe   = /\bd=["']([^"']+)["']/i
  let m: RegExpExecArray | null
  while ((m = pathTagRe.exec(stripped)) !== null) {
    const da = dAttrRe.exec(m[0])
    if (da?.[1]?.trim()) pushSubpaths(result, da[1], idm)
  }

  // <rect>
  const rectRe = /<rect\b[^/>]*\/?>/gi
  while ((m = rectRe.exec(stripped)) !== null) {
    const tag = m[0]
    const d = rectToPathData({
      x:      getAttrNum(tag, 'x'),
      y:      getAttrNum(tag, 'y'),
      width:  getAttrNum(tag, 'width'),
      height: getAttrNum(tag, 'height'),
      rx:     getAttrNum(tag, 'rx'),
      ry:     getAttrNum(tag, 'ry'),
    })
    if (d) result.push({ data: d, ctm: idm })
  }

  // <circle>
  const circleRe = /<circle\b[^/>]*\/?>/gi
  while ((m = circleRe.exec(stripped)) !== null) {
    const tag = m[0]
    const d = circleToPathData(getAttrNum(tag, 'cx'), getAttrNum(tag, 'cy'), getAttrNum(tag, 'r'))
    if (d) result.push({ data: d, ctm: idm })
  }

  // <ellipse>
  const ellipseRe = /<ellipse\b[^/>]*\/?>/gi
  while ((m = ellipseRe.exec(stripped)) !== null) {
    const tag = m[0]
    const d = ellipseToPathData(
      getAttrNum(tag, 'cx'), getAttrNum(tag, 'cy'),
      getAttrNum(tag, 'rx'), getAttrNum(tag, 'ry'),
    )
    if (d) result.push({ data: d, ctm: idm })
  }

  // <line>
  const lineRe = /<line\b[^/>]*\/?>/gi
  while ((m = lineRe.exec(stripped)) !== null) {
    const tag = m[0]
    const x1 = getAttrNum(tag, 'x1'), y1 = getAttrNum(tag, 'y1')
    const x2 = getAttrNum(tag, 'x2'), y2 = getAttrNum(tag, 'y2')
    if (x1 !== x2 || y1 !== y2) result.push({ data: `M ${x1} ${y1} L ${x2} ${y2}`, ctm: idm })
  }

  // <polyline>
  const polylineRe = /<polyline\b[^/>]*\/?>/gi
  while ((m = polylineRe.exec(stripped)) !== null) {
    const ps = getAttrStr(m[0], 'points')
    if (ps) { const d = pointsToPathData(parsePointsAttr(ps), false); if (d) result.push({ data: d, ctm: idm }) }
  }

  // <polygon>
  const polygonRe = /<polygon\b[^/>]*\/?>/gi
  while ((m = polygonRe.exec(stripped)) !== null) {
    const ps = getAttrStr(m[0], 'points')
    if (ps) { const d = pointsToPathData(parsePointsAttr(ps), true); if (d) result.push({ data: d, ctm: idm }) }
  }

  return result
}

// ── Point-count allocation (largest-remainder method) ────────────────────────

function allocateCounts(lengths: number[], total: number): number[] {
  const sum = lengths.reduce((a, b) => a + b, 0)
  if (sum === 0) {
    const base = Math.max(1, Math.floor(total / lengths.length))
    return lengths.map(() => base)
  }
  const floats = lengths.map(l => Math.max(1, (l / sum) * total))
  const counts = floats.map(v => Math.floor(v))
  let remainder = total - counts.reduce((a, b) => a + b, 0)
  // Distribute remaining slots to paths with largest fractional parts
  const order = floats
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
  for (const { i } of order) {
    if (remainder <= 0) break
    counts[i]++
    remainder--
  }
  return counts
}

// ── SVG path extraction (backward-compatible — paths only) ───────────────────

/**
 * Regex fallback used in environments without DOMParser (Node / Vitest).
 * Handles well-formed SVGs with plain <path d="…"> elements.
 */
function extractSvgPathDataRegex(rawSvg: string): string[] {
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
 * NOTE: This function returns only <path> data for backward compatibility.
 * parseSvgToGlyphPoints uses a richer internal pipeline that also handles
 * primitive elements and compound path splitting.
 */
export function extractSvgPathData(rawSvg: string): string[] {
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(rawSvg, 'image/svg+xml')
      if (doc.querySelector('parsererror')) return extractSvgPathDataRegex(rawSvg)
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
 * non-empty d attribute.
 */
export function hasSvgPathData(rawSvg: string): boolean {
  return extractSvgPathData(rawSvg).length > 0
}

// ── Path sampling ─────────────────────────────────────────────────────────────

/**
 * Samples `resolution` evenly-spaced points along a single SVG path string.
 * Returns an empty array if pathData is empty, zero-length, or throws.
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
 * Improvements over the previous implementation:
 * - Compound paths (multiple M commands in one <path>) are split into separate
 *   subpaths, each with its own pathIndex, preventing connector lines.
 * - Primitive elements (<rect>, <circle>, <ellipse>, <line>, <polyline>,
 *   <polygon>) are converted to path data and compiled alongside <path> elements.
 * - Points are distributed proportionally to each subpath's arc length instead
 *   of evenly by path count.
 * - SVG transform attributes are composed and applied in the browser path
 *   (DOMParser only; transforms are ignored in the Node/regex fallback).
 * - Global normalization: the entire glyph is centered and scaled as a unit.
 *
 * Falls back to a unit circle when no compilable shapes are found or parsing fails.
 * Run once during import/selection — never inside the draw loop.
 */
export function parseSvgToGlyphPoints(
  rawSvg: string,
  resolution: number,
): OscillatorGlyphPoint[] {
  const n = Math.max(1, Math.round(resolution))

  try {
    // 1. Compile all subpaths (browser uses DOMParser + transforms; Node uses regex)
    let subpaths: RawSubpath[]
    if (typeof DOMParser !== 'undefined') {
      try {
        subpaths = compileSubpathsBrowser(rawSvg)
      } catch {
        subpaths = compileSubpathsRegex(rawSvg)
      }
      if (subpaths.length === 0) subpaths = compileSubpathsRegex(rawSvg)
    } else {
      subpaths = compileSubpathsRegex(rawSvg)
    }

    if (subpaths.length === 0) {
      console.warn('[DRMVYZ] parseSvgToGlyphPoints: No compilable shapes found. Falling back to circle.')
      return fallbackCircle(n)
    }

    // 2. Measure arc lengths; discard zero-length or degenerate subpaths
    const measured = subpaths.flatMap(sp => {
      try {
        const props = new svgPathProperties(sp.data)
        const length = props.getTotalLength()
        if (!Number.isFinite(length) || length <= 0) return []
        return [{ ...sp, props, length }]
      } catch {
        return []
      }
    })

    if (measured.length === 0) return fallbackCircle(n)

    // 3. Allocate points proportionally to arc length
    const counts = allocateCounts(measured.map(sp => sp.length), n)

    // 4. Sample each subpath and apply the element's CTM if non-trivial
    const raw: OscillatorGlyphPoint[] = []
    for (let j = 0; j < measured.length; j++) {
      const { props, ctm, length } = measured[j]
      const count = counts[j]
      const hasCTM = !isIdentityM2D(ctm)
      for (let k = 0; k < count; k++) {
        const progress = count > 1 ? k / (count - 1) : 0
        const pt = props.getPropertiesAtLength(progress * length)
        let x = pt.x, y = pt.y
        if (hasCTM) { const [tx, ty] = applyM2D(ctm, x, y); x = tx; y = ty }
        raw.push({ x, y, pathIndex: j, progress })
      }
    }

    if (raw.length === 0) return fallbackCircle(n)

    // 5. Global normalize (center + scale entire glyph as one unit)
    const normalized = normalizePointCloud(raw)

    // 6. Recompute normals via central differences
    return computePathNormals(normalized, false)

  } catch {
    return fallbackCircle(n)
  }
}

// ── Asset factory ─────────────────────────────────────────────────────────────

/**
 * Creates an OscillatorGlyphAsset from a raw SVG string.
 * The id is derived from the SVG content hash and is stable across sessions.
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
