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

/** Canonical cache key for a compiled SVG glyph entry in oscillatorGlyphPointCache. */
export function getSvgGlyphCacheKey(
  assetId: string,
  resolution: number,
  contentHash?: string,
): string {
  const h = contentHash ?? 'nohash'
  return `${assetId}:${resolution}:v${SVG_GLYPH_COMPILER_VERSION}:${h}`
}

// ── Compile options ───────────────────────────────────────────────────────────

export interface SvgGlyphCompileOptions {
  /** Minimum path arc length as a fraction of total arc length sum. Paths below this are discarded. */
  minPathLength?: number
  /** Preferred minimum point count per retained path. Used to cap path count to fit budget. */
  minPointCountPerPath?: number
  /**
   * Hard cap on points per path after proportional allocation.
   * Defaults to Infinity — a dynamic cap is computed from the retained path count
   * and requested resolution so a single-path SVG at high resolution uses the
   * full resolution budget rather than being capped at a fixed 512.
   * Pass an explicit number to override the dynamic cap (useful for tests).
   */
  maxPointCountPerPath?: number
  /** When true, discard paths shorter than minPathLength * totalLength. */
  discardTinyPaths?: boolean
  /**
   * Squared-distance epsilon for removing sequential near-duplicate points
   * (applied per path group, in normalized [-1,1] space).
   * 0 = disabled. Default is 1e-6 — only removes floating-point coincident points.
   */
  duplicatePointEpsilon?: number
}

const COMPILE_DEFAULTS: Required<SvgGlyphCompileOptions> = {
  minPathLength:          0.001,  // 0.1% of total arc length sum
  minPointCountPerPath:   3,
  maxPointCountPerPath:   Infinity,  // dynamic cap computed per compile — see parseSvgToGlyphPoints
  discardTinyPaths:       true,
  duplicatePointEpsilon:  1e-6,
}

// ── Hash ──────────────────────────────────────────────────────────────────────

/** FNV-1a 32-bit hash — deterministic, collision-resistant for short strings. */
export function hashString(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/**
 * Returns a short deterministic hash of SVG text content.
 * Used to detect when the same media-backed asset has changed content.
 */
export function getSvgContentHash(rawSvg: string): string {
  return hashString(rawSvg)
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
 * Splits a compound SVG path d-string into individual subpaths.
 *
 * Improvements over the previous regex split:
 * - Proper tokenizer that handles scientific notation (1e-5) without false splits.
 * - Tracks cursor position so relative `m` subpath starts are resolved to
 *   absolute `M` coordinates before being passed to svgPathProperties.
 * - Handles multiple coordinate pairs after M/m (implicit lineto).
 * - Does not throw on malformed input — returns whatever was parsed successfully.
 */
function splitCompoundPath(d: string): string[] {
  if (!d || !d.trim()) return []

  // Tokenize: find command letter positions, extract numeric args between them.
  // Number pattern handles integers, decimals, and scientific notation (e.g. 1.5e-3).
  const numPat = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g
  const cmdPat = /[MmLlHhVvCcSsQqTtAaZz]/g

  const cmdMatches: Array<{ index: number; cmd: string }> = []
  let cm: RegExpExecArray | null
  cmdPat.lastIndex = 0
  while ((cm = cmdPat.exec(d)) !== null) {
    cmdMatches.push({ index: cm.index, cmd: cm[0] })
  }
  if (cmdMatches.length === 0) return []

  const tokens: Array<{ cmd: string; args: number[] }> = cmdMatches.map(({ index, cmd }, i) => {
    const end = i + 1 < cmdMatches.length ? cmdMatches[i + 1].index : d.length
    const segment = d.slice(index + 1, end)
    numPat.lastIndex = 0
    const args: number[] = []
    let nm: RegExpExecArray | null
    while ((nm = numPat.exec(segment)) !== null) {
      const v = parseFloat(nm[0])
      if (Number.isFinite(v)) args.push(v)
    }
    return { cmd, args }
  })

  // Walk tokens, tracking cursor, split at each M/m into separate subpaths.
  let cx = 0, cy = 0   // current point
  let sx = 0, sy = 0   // current subpath start (for Z closepath)
  const subpaths: string[] = []
  let cur = ''

  function flushCurrent() {
    const t = cur.trim()
    if (t.length > 1) subpaths.push(t)
    cur = ''
  }

  // Update cx/cy after any non-M command.
  // For absolute commands, the last (x,y) pair is the endpoint.
  // For relative commands with multiple implicit repetitions, accumulate each
  // endpoint delta so the final cursor position is correct (e.g. l20 0 0 20 -20 0
  // ends at (cx, cy+20), not at (cx-20, cy) as a naive last-pair approach would give).
  function trackCursor(cmd: string, args: number[]): void {
    const upper = cmd.toUpperCase()
    const rel   = cmd !== upper
    const n     = args.length
    switch (upper) {
      case 'H':
        if (n) { if (rel) cx += args[n - 1]; else cx = args[n - 1] }
        break
      case 'V':
        if (n) { if (rel) cy += args[n - 1]; else cy = args[n - 1] }
        break
      case 'Z':
        cx = sx; cy = sy
        break
      // Stride-2: (x y)+ — each pair is an endpoint
      case 'L':
      case 'T':
        if (rel) { for (let i = 0; i + 1 < n; i += 2) { cx += args[i]; cy += args[i + 1] } }
        else if (n >= 2) { cx = args[n - 2]; cy = args[n - 1] }
        break
      // Stride-4: (x1 y1 x y)+ for Q; (x2 y2 x y)+ for S — endpoint at index 2,3 of each group
      case 'Q':
      case 'S':
        if (rel) { for (let i = 2; i + 1 < n; i += 4) { cx += args[i]; cy += args[i + 1] } }
        else if (n >= 2) { cx = args[n - 2]; cy = args[n - 1] }
        break
      // Stride-6: (x1 y1 x2 y2 x y)+ — endpoint at index 4,5 of each group
      case 'C':
        if (rel) { for (let i = 4; i + 1 < n; i += 6) { cx += args[i]; cy += args[i + 1] } }
        else if (n >= 2) { cx = args[n - 2]; cy = args[n - 1] }
        break
      // Stride-7: (rx ry x-rot large sweep x y)+ — endpoint at index 5,6 of each group
      case 'A':
        if (rel) { for (let i = 5; i + 1 < n; i += 7) { cx += args[i]; cy += args[i + 1] } }
        else if (n >= 2) { cx = args[n - 2]; cy = args[n - 1] }
        break
      default:
        if (n >= 2) {
          if (rel) { cx += args[n - 2]; cy += args[n - 1] }
          else      { cx = args[n - 2]; cy = args[n - 1] }
        }
    }
  }

  for (const { cmd, args } of tokens) {
    const upper = cmd.toUpperCase()
    const rel   = cmd !== upper

    if (upper === 'M') {
      flushCurrent()
      // Process coordinate pairs: first pair = absolute start, rest = implicit L
      for (let i = 0; i + 1 < args.length; i += 2) {
        const ax = rel ? cx + args[i] : args[i]
        const ay = rel ? cy + args[i + 1] : args[i + 1]
        if (i === 0) {
          // Always emit absolute M for the subpath start so svgPathProperties works correctly
          cur = `M ${ax} ${ay}`
          sx = ax; sy = ay
        } else {
          // Subsequent pairs are implicit lineto (absolute)
          cur += ` L ${ax} ${ay}`
        }
        cx = ax; cy = ay
      }
    } else if (upper === 'Z') {
      cur += ' Z'
      cx = sx; cy = sy
    } else {
      // Append command and args as-is; track cursor for correct relative-m resolution
      cur += args.length ? ` ${cmd} ${args.join(' ')}` : ` ${cmd}`
      trackCursor(cmd, args)
    }
  }
  flushCurrent()
  return subpaths
}

// ── Internal raw-subpath extraction ──────────────────────────────────────────

interface RawSubpath {
  data: string  // single subpath d-string (starts with absolute M)
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

// ── Point-count allocation ────────────────────────────────────────────────────

/**
 * Distributes `total` points across paths proportionally to their arc lengths.
 *
 * Pre-condition: lengths.length <= total  (enforced by the caller).
 * This guarantees every path can receive at least 1 point.
 *
 * Uses the largest-remainder method so the sum equals `total` exactly.
 */
function allocateCounts(lengths: number[], total: number, maxPerPath: number): number[] {
  const n = lengths.length
  if (n === 0 || total <= 0) return []
  if (n === 1) return [Math.min(total, maxPerPath)]

  const sum = lengths.reduce((a, b) => a + b, 0)

  const floats = sum === 0
    ? lengths.map(() => total / n)
    : lengths.map(l => Math.min(maxPerPath, (l / sum) * total))

  // Floor and enforce per-path minimum of 1
  const counts = floats.map(v => Math.max(1, Math.floor(v)))

  // Adjust to hit total exactly via largest-remainder
  let diff = total - counts.reduce((a, b) => a + b, 0)

  const byFrac = floats
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)

  for (const { i } of byFrac) {
    if (diff === 0) break
    if (diff > 0 && counts[i] < maxPerPath) {
      counts[i]++; diff--
    } else if (diff < 0 && counts[i] > 1) {
      counts[i]--; diff++
    }
  }

  // Safety pass: if still off (edge cases with maxPerPath), brute-force balance
  if (diff !== 0) {
    for (let i = 0; i < n && diff !== 0; i++) {
      if (diff > 0 && counts[i] < maxPerPath) { counts[i]++; diff-- }
      else if (diff < 0 && counts[i] > 1)      { counts[i]--; diff++ }
    }
  }

  return counts
}

// ── Near-duplicate point removal ─────────────────────────────────────────────

/**
 * Removes sequential near-duplicate points from an array.
 * Operates in the coordinate space of the input (normalized or raw).
 * epsilon = 0 disables deduplication (returns the input array unchanged).
 */
function removeNearDuplicatePoints(
  points: OscillatorGlyphPoint[],
  epsilon: number,
): OscillatorGlyphPoint[] {
  if (epsilon <= 0 || points.length <= 1) return points
  const epSq = epsilon * epsilon
  const out: OscillatorGlyphPoint[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1]
    const dx   = points[i].x - prev.x
    const dy   = points[i].y - prev.y
    if (dx * dx + dy * dy > epSq) out.push(points[i])
  }
  return out
}

// ── Nearest-resolution cache lookup ──────────────────────────────────────────

/**
 * When the exact resolution cache key is missing (e.g. during a debounce window),
 * returns the nearest already-compiled entry for the same asset/compiler/hash.
 * The renderer uses this to keep the current glyph visible instead of flashing
 * the circle fallback while the new resolution compiles.
 *
 * Returns null if no matching compiled entry exists at all.
 */
export function findNearestSvgGlyphCacheEntry(
  cache: Record<string, OscillatorGlyphPoint[]>,
  assetId: string,
  requestedResolution: number,
  contentHash?: string,
): OscillatorGlyphPoint[] | null {
  const prefix       = `${assetId}:`
  const versionToken = `:v${SVG_GLYPH_COMPILER_VERSION}:`
  const hashSuffix   = `:${contentHash ?? 'nohash'}`

  let bestEntry: OscillatorGlyphPoint[] | null = null
  let bestDiff = Infinity

  for (const key of Object.keys(cache)) {
    if (!key.startsWith(prefix))   continue
    if (!key.includes(versionToken)) continue
    if (!key.endsWith(hashSuffix))  continue

    // Key format: "assetId:resolution:vN:hash"
    const afterPrefix = key.slice(prefix.length)
    const colonIdx    = afterPrefix.indexOf(':')
    if (colonIdx < 0) continue
    const res = parseInt(afterPrefix.slice(0, colonIdx), 10)
    if (!Number.isFinite(res) || res <= 0) continue

    const diff = Math.abs(res - requestedResolution)
    if (diff < bestDiff) {
      bestDiff  = diff
      bestEntry = cache[key]
    }
  }

  return bestEntry
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
 * Pipeline:
 * 1. Compile all subpaths (browser: DOMParser + CTM transforms; Node: regex)
 * 2. Measure arc lengths; discard degenerate/zero-length subpaths
 * 3. Filter tiny/noise paths (dust, speckles) relative to total arc length
 * 4. Cap path count so total points stay near `resolution`
 * 5. Allocate points proportionally to arc length (largest-remainder, exact total)
 * 6. Sample each subpath and apply element CTM if non-identity
 * 7. Global normalize (scale entire glyph to max radius = 1)
 * 8. Compute normals independently per pathIndex group (no cross-path bleed)
 *
 * Falls back to a unit circle when no compilable shapes are found or parsing fails.
 * Run once during import/selection — never inside the draw loop.
 */
export function parseSvgToGlyphPoints(
  rawSvg: string,
  resolution: number,
  options?: SvgGlyphCompileOptions,
): OscillatorGlyphPoint[] {
  const n    = Math.max(1, Math.round(resolution))
  const opts: Required<SvgGlyphCompileOptions> = { ...COMPILE_DEFAULTS, ...options }

  try {
    // 1. Compile all subpaths
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
      if (import.meta.env.DEV) {
        console.warn('[DRMVYZ] parseSvgToGlyphPoints: No compilable shapes found — falling back to circle.')
      }
      return fallbackCircle(n)
    }

    // 2. Measure arc lengths; discard degenerate/zero-length subpaths
    type MeasuredSubpath = RawSubpath & { props: InstanceType<typeof svgPathProperties>; length: number }
    const measured: MeasuredSubpath[] = subpaths.flatMap(sp => {
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

    // 3. Filter tiny paths (dust, speckles, zero-area shapes)
    let retained = measured
    if (opts.discardTinyPaths && measured.length > 1) {
      const totalLen = measured.reduce((s, p) => s + p.length, 0)
      const threshold = opts.minPathLength * totalLen
      const filtered = measured.filter(p => p.length >= threshold)
      if (filtered.length > 0) {
        if (import.meta.env.DEV && filtered.length < measured.length) {
          console.info(
            `[DRMVYZ] SVG compiler: discarded ${measured.length - filtered.length} tiny path(s)` +
            ` (${filtered.length} retained, threshold = ${(opts.minPathLength * 100).toFixed(2)}% of total length)`,
          )
        }
        retained = filtered
      }
    }

    // 4. Cap path count so allocation can guarantee ≥ 1 point per path.
    //    Keep the longest paths (most visually important) when trimming.
    const maxPaths = Math.max(1, Math.floor(n / opts.minPointCountPerPath))
    if (retained.length > maxPaths) {
      // Sort by length descending to identify paths to keep, then restore draw order
      const sortedDesc = retained.slice().sort((a, b) => b.length - a.length)
      const keepSet = new Set(sortedDesc.slice(0, maxPaths))
      retained = retained.filter(p => keepSet.has(p))
      if (import.meta.env.DEV) {
        console.info(
          `[DRMVYZ] SVG compiler: capped to ${retained.length} paths` +
          ` (budget: ${n} pts / ${opts.minPointCountPerPath} min-per-path = ${maxPaths} max paths)`,
        )
      }
    }

    // 5. Allocate points proportionally to arc length (total will equal n exactly).
    //    Dynamic per-path cap: single/few-path SVGs may use the full resolution budget;
    //    many-path SVGs are limited to 2× average to protect CPU.  An explicit
    //    opts.maxPointCountPerPath overrides this when set to a finite value.
    const dynamicMaxPerPath = retained.length <= 4
      ? n
      : Math.max(128, Math.ceil(n / retained.length) * 2)
    const capPerPath = Number.isFinite(opts.maxPointCountPerPath)
      ? Math.min(opts.maxPointCountPerPath, dynamicMaxPerPath)
      : dynamicMaxPerPath
    const counts = allocateCounts(
      retained.map(p => p.length),
      n,
      capPerPath,
    )

    // 6. Sample each subpath and apply element CTM if non-identity
    const raw: OscillatorGlyphPoint[] = []
    for (let j = 0; j < retained.length; j++) {
      const { props, ctm, length } = retained[j]
      const count = counts[j]
      if (count <= 0) continue
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

    // 7. Global normalize (center + scale entire glyph as one unit)
    const normalized = normalizePointCloud(raw)

    // 7.5 Remove near-duplicate sequential points per path (in normalized space).
    //     Operates per-path to avoid removing the last point of one path when it
    //     coincidentally overlaps the first point of the next path.
    //     epsilon=0 / very small default means only floating-point coincident points removed.
    const eps = opts.duplicatePointEpsilon
    const deduped: OscillatorGlyphPoint[] = eps > 0 ? (() => {
      const result: OscillatorGlyphPoint[] = []
      // Group by pathIndex, dedup each group, flatten
      const groups = new Map<number, OscillatorGlyphPoint[]>()
      for (const p of normalized) {
        const arr = groups.get(p.pathIndex)
        if (arr) arr.push(p); else groups.set(p.pathIndex, [p])
      }
      for (const group of groups.values()) {
        result.push(...removeNearDuplicatePoints(group, eps))
      }
      return result
    })() : normalized

    // 8. Compute normals per pathIndex group — prevents cross-path tangent bleed.
    //    Audio displacement, jitter, and ribbon effects use these normals, so
    //    computing them across the full flat array would corrupt boundary points.
    const grouped = new Map<number, OscillatorGlyphPoint[]>()
    for (const p of deduped) {
      const arr = grouped.get(p.pathIndex)
      if (arr) {
        arr.push(p)
      } else {
        grouped.set(p.pathIndex, [p])
      }
    }

    const result: OscillatorGlyphPoint[] = []
    const sortedKeys = Array.from(grouped.keys()).sort((a, b) => a - b)
    for (const key of sortedKeys) {
      const group = grouped.get(key)!
      // Sort by progress within the group (should already be in order, but guard anyway)
      group.sort((a, b) => a.progress - b.progress)
      result.push(...computePathNormals(group, false))
    }

    return result

  } catch {
    return fallbackCircle(n)
  }
}

// ── Asset factory ─────────────────────────────────────────────────────────────

/**
 * Creates an OscillatorGlyphAsset from a raw SVG string.
 * The id is derived from the SVG content hash and is stable across sessions.
 * contentHash is stored separately for use in versioned cache key lookups.
 */
export function makeSvgGlyphAsset(
  name: string,
  rawSvg: string,
  resolution: number,
  idOverride?: string,
): OscillatorGlyphAsset {
  const contentHash = getSvgContentHash(rawSvg)
  const points = parseSvgToGlyphPoints(rawSvg, resolution)
  return {
    id:          idOverride ?? `glyph-${contentHash}`,
    name,
    sourceType:  'svgGlyph',
    rawSvg,
    contentHash,
    pointCount:  points.length,
    createdAt:   new Date().toISOString(),
  }
}
