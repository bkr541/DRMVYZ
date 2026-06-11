import type { BuiltinOscillatorShape, OscillatorGlyphPoint } from '../ReactTypes'

const TAU = Math.PI * 2

type Vec2 = [number, number]

// ── Core helpers ──────────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/**
 * Rescales all points so the maximum radius equals 1.0.
 * No-op if the cloud is empty or already at max-radius 1.
 */
export function normalizePointCloud(points: OscillatorGlyphPoint[]): OscillatorGlyphPoint[] {
  if (points.length === 0) return points
  let maxR = 0
  for (const p of points) {
    const r = Math.sqrt(p.x * p.x + p.y * p.y)
    if (r > maxR) maxR = r
  }
  if (maxR === 0 || maxR === 1) return points
  const inv = 1 / maxR
  return points.map(p => ({ ...p, x: p.x * inv, y: p.y * inv }))
}

/**
 * Computes right-perpendicular normals (outward for CCW paths) using central
 * differences.  Pass closed=true to wrap the endpoint tangents.
 */
export function computePathNormals(
  points: OscillatorGlyphPoint[],
  closed = false,
): OscillatorGlyphPoint[] {
  const n = points.length
  if (n < 2) return points
  return points.map((p, i) => {
    const prev = closed ? points[(i - 1 + n) % n] : points[Math.max(0, i - 1)]
    const next = closed ? points[(i + 1) % n]     : points[Math.min(n - 1, i + 1)]
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) return p
    return { ...p, normalX: dy / len, normalY: -dx / len }
  })
}

// ── Resample ──────────────────────────────────────────────────────────────────

/**
 * Evenly resamples a path to targetCount points using cumulative arc length.
 * Interpolates position and normals between source points.
 */
export function resamplePoints(
  points: OscillatorGlyphPoint[],
  targetCount: number,
): OscillatorGlyphPoint[] {
  if (points.length === 0 || targetCount <= 0) return []
  if (points.length === 1 || targetCount === 1) {
    return Array.from({ length: targetCount }, (_, i) => ({
      ...points[0],
      progress: targetCount > 1 ? i / (targetCount - 1) : 0,
    }))
  }

  // Build cumulative arc lengths
  const cumLen: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    cumLen.push(cumLen[cumLen.length - 1] + Math.sqrt(dx * dx + dy * dy))
  }
  const totalLen = cumLen[cumLen.length - 1]

  if (totalLen === 0) {
    return Array.from({ length: targetCount }, (_, i) => ({
      ...points[0],
      progress: i / (targetCount - 1),
    }))
  }

  const result: OscillatorGlyphPoint[] = []
  let srcIdx = 0
  for (let i = 0; i < targetCount; i++) {
    const targetDist = (i / (targetCount - 1)) * totalLen
    // Advance srcIdx so targetDist falls within [cumLen[srcIdx], cumLen[srcIdx+1]]
    while (srcIdx < points.length - 2 && cumLen[srcIdx + 1] < targetDist) srcIdx++
    const a = points[srcIdx]
    const b = points[srcIdx + 1] !== undefined ? points[srcIdx + 1] : a
    const segEnd = cumLen[srcIdx + 1] !== undefined ? cumLen[srcIdx + 1] : cumLen[srcIdx]
    const segLen = segEnd - cumLen[srcIdx]
    const t = segLen > 0 ? clamp((targetDist - cumLen[srcIdx]) / segLen, 0, 1) : 0
    result.push({
      x:         a.x + (b.x - a.x) * t,
      y:         a.y + (b.y - a.y) * t,
      pathIndex: a.pathIndex,
      progress:  i / (targetCount - 1),
      normalX:   a.normalX != null && b.normalX != null
        ? a.normalX + (b.normalX - a.normalX) * t
        : undefined,
      normalY:   a.normalY != null && b.normalY != null
        ? a.normalY + (b.normalY - a.normalY) * t
        : undefined,
    })
  }
  return result
}

// ── Transform ─────────────────────────────────────────────────────────────────

export interface TransformOptions {
  scale?:         number
  rotateRadians?: number
  mirrorX?:       boolean
  mirrorY?:       boolean
}

/**
 * Applies scale → rotation → mirror to every point and its normal.
 * Returns a new array; does not mutate the input.
 */
export function transformOscillatorPoints(
  points: OscillatorGlyphPoint[],
  options: TransformOptions,
): OscillatorGlyphPoint[] {
  const { scale = 1, rotateRadians = 0, mirrorX = false, mirrorY = false } = options
  const cos = Math.cos(rotateRadians)
  const sin = Math.sin(rotateRadians)
  return points.map(p => {
    const sx = p.x * scale
    const sy = p.y * scale
    const rx = sx * cos - sy * sin
    const ry = sx * sin + sy * cos
    const x = mirrorX ? -rx : rx
    const y = mirrorY ? -ry : ry
    let normalX = p.normalX
    let normalY = p.normalY
    if (normalX != null && normalY != null) {
      const rnx = normalX * cos - normalY * sin
      const rny = normalX * sin + normalY * cos
      normalX = mirrorX ? -rnx : rnx
      normalY = mirrorY ? -rny : rny
    }
    return { ...p, x, y, normalX, normalY }
  })
}

// ── Internal shape builders ───────────────────────────────────────────────────

function pt(x: number, y: number, progress: number): OscillatorGlyphPoint {
  return { x, y, pathIndex: 0, progress }
}

/**
 * Distributes `resolution` points evenly along the perimeter of a closed polygon.
 * Normals are computed with the right-perpendicular convention (outward for CCW).
 */
function walkPolygon(verts: readonly Vec2[], resolution: number): OscillatorGlyphPoint[] {
  const n = verts.length
  const edgeLens: number[] = []
  let perimeter = 0
  for (let i = 0; i < n; i++) {
    const a = verts[i]
    const b = verts[(i + 1) % n]
    const len = Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)
    edgeLens.push(len)
    perimeter += len
  }
  const pts: OscillatorGlyphPoint[] = []
  for (let i = 0; i < resolution; i++) {
    const d = (i / resolution) * perimeter
    let acc = 0
    for (let e = 0; e < n; e++) {
      const isLast = e === n - 1
      if (d <= acc + edgeLens[e] || isLast) {
        const edgeDist = clamp(d - acc, 0, edgeLens[e])
        const t = edgeLens[e] > 0 ? edgeDist / edgeLens[e] : 0
        const a = verts[e]
        const b = verts[(e + 1) % n]
        pts.push(pt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, i / resolution))
        break
      }
      acc += edgeLens[e]
    }
  }
  return computePathNormals(pts, true)
}

function circlePoints(n: number): OscillatorGlyphPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * TAU
    const x = Math.cos(angle)
    const y = Math.sin(angle)
    // Analytic outward normal: same as position for a unit circle
    return { x, y, pathIndex: 0, progress: i / n, normalX: x, normalY: y }
  })
}

function squarePoints(n: number): OscillatorGlyphPoint[] {
  const verts: Vec2[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  return walkPolygon(verts, n)
}

function trianglePoints(n: number): OscillatorGlyphPoint[] {
  const verts: Vec2[] = Array.from({ length: 3 }, (_, k): Vec2 => {
    const angle = Math.PI / 2 + k * (TAU / 3)
    return [Math.cos(angle), Math.sin(angle)]
  })
  return walkPolygon(verts, n)
}

function starPoints(n: number): OscillatorGlyphPoint[] {
  // 5-pointed star: alternate outer (r=1) and inner (r≈0.382) vertices
  const verts: Vec2[] = Array.from({ length: 10 }, (_, k): Vec2 => {
    const angle = -Math.PI / 2 + k * (TAU / 10)
    const r = k % 2 === 0 ? 1.0 : 0.382
    return [r * Math.cos(angle), r * Math.sin(angle)]
  })
  return walkPolygon(verts, n)
}

function hexagonPoints(n: number): OscillatorGlyphPoint[] {
  const verts: Vec2[] = Array.from({ length: 6 }, (_, k): Vec2 => {
    const angle = k * (TAU / 6)
    return [Math.cos(angle), Math.sin(angle)]
  })
  return walkPolygon(verts, n)
}

function infinityPoints(n: number): OscillatorGlyphPoint[] {
  // Bernoulli lemniscate: traces a figure-eight, normalized to max-radius 1
  const raw = Array.from({ length: n }, (_, i) => {
    const t = (i / n) * TAU
    const s2 = Math.sin(t) ** 2
    const denom = 1 + s2
    return pt(Math.cos(t) / denom, (Math.sin(t) * Math.cos(t)) / denom, i / n)
  })
  let maxR = 0
  for (const p of raw) {
    const r = Math.sqrt(p.x * p.x + p.y * p.y)
    if (r > maxR) maxR = r
  }
  const inv = maxR > 0 ? 1 / maxR : 1
  return computePathNormals(raw.map(p => ({ ...p, x: p.x * inv, y: p.y * inv })), true)
}

function spiralPoints(n: number): OscillatorGlyphPoint[] {
  // Archimedean spiral: 3 full turns, radius grows 0 → 1
  const turns = 3
  return computePathNormals(
    Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1)
      const angle = t * TAU * turns
      return pt(t * Math.cos(angle), t * Math.sin(angle), t)
    }),
    false,
  )
}

function linePoints(n: number): OscillatorGlyphPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    return { x: -1 + 2 * t, y: 0, pathIndex: 0, progress: t, normalX: 0, normalY: 1 }
  })
}

// ── Path grouping ─────────────────────────────────────────────────────────────

/**
 * Splits a flat point array into sub-arrays by `pathIndex`.
 *
 * Points with the same pathIndex form one group.  Groups are returned in
 * ascending pathIndex order, and insertion order within each group is
 * preserved.  Points whose pathIndex is undefined default to 0.
 *
 * This allows the renderer to draw each SVG sub-path (letter, hole, logo
 * piece, etc.) as a separate stroke, eliminating connector lines between
 * unrelated sub-paths.
 */
export function groupPointsByPathIndex(
  points: OscillatorGlyphPoint[],
): OscillatorGlyphPoint[][] {
  const groups = new Map<number, OscillatorGlyphPoint[]>()
  for (const p of points) {
    const idx = p.pathIndex ?? 0
    if (!groups.has(idx)) groups.set(idx, [])
    groups.get(idx)!.push(p)
  }
  return Array.from(groups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, pts]) => pts)
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generates normalized (−1 to 1) OscillatorGlyphPoints for a built-in shape.
 * All points are deterministic and stable for a given shape+resolution pair.
 */
export function generateBuiltinShapePoints(
  shape: BuiltinOscillatorShape,
  resolution: number,
): OscillatorGlyphPoint[] {
  const n = Math.max(2, Math.round(resolution))
  switch (shape) {
    case 'circle':   return circlePoints(n)
    case 'square':   return squarePoints(n)
    case 'triangle': return trianglePoints(n)
    case 'star':     return starPoints(n)
    case 'hexagon':  return hexagonPoints(n)
    case 'infinity': return infinityPoints(n)
    case 'spiral':   return spiralPoints(n)
    case 'line':     return linePoints(n)
    default:         return circlePoints(n)
  }
}
