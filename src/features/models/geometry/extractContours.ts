import { Box2, Path, Shape, ShapeUtils, Vector2 } from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { MODEL_INPUT_LIMITS, ModelGenerationError } from './modelQualityBudget'
import { record } from '../domain/modelAssetTypes'
import { sanitizeModelSvg } from '../trace/svgSanitize'

function inside(point: Vector2, ring: Vector2[]): boolean {
  let result = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if (point.distanceToSquared(a) < 1e-16) return false
    const edge = b.clone().sub(a), relative = point.clone().sub(a)
    if (Math.abs(edge.cross(relative)) < 1e-10 && relative.dot(edge) >= 0 && relative.dot(edge) <= edge.lengthSq()) return false
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result
  }
  return result
}
function filled(point: Vector2, shape: { outer: Vector2[]; holes: Vector2[][] }): boolean {
  return inside(point, shape.outer) && !shape.holes.some(h => inside(point, h))
}
function cleanRing(points: Vector2[], tolerance: number): Vector2[] {
  const ring = points.filter((p, i) => i === 0 || p.distanceToSquared(points[i - 1]) > 1e-16)
  if (ring.length > 1 && ring[0].distanceToSquared(ring.at(-1)!) < 1e-16) ring.pop()
  // Removing only near-collinear points preserves corners, winding and thin bridges.
  const result = ring.filter((p, i) => {
    const a = ring[(i + ring.length - 1) % ring.length], b = ring[(i + 1) % ring.length]
    const edge = b.clone().sub(a), t = edge.lengthSq() ? p.clone().sub(a).dot(edge) / edge.lengthSq() : 0
    return t <= 0 || t >= 1 || p.distanceTo(a.clone().addScaledVector(edge, t)) > tolerance
  })
  return result.length >= 3 ? result : ring
}
function crossing(a: Vector2, b: Vector2, c: Vector2, d: Vector2): boolean {
  const abx = b.x - a.x, aby = b.y - a.y, cdx = d.x - c.x, cdy = d.y - c.y
  const x = abx * (c.y - a.y) - aby * (c.x - a.x), y = abx * (d.y - a.y) - aby * (d.x - a.x)
  const z = cdx * (a.y - c.y) - cdy * (a.x - c.x), w = cdx * (b.y - c.y) - cdy * (b.x - c.x)
  return x * y < -1e-14 && z * w < -1e-14
}

export interface ModelContours { shapes: Shape[]; pointCount: number; minimumDetail: number }
export function extractModelContours(svg: string, curveSegments: number, smoothing: number): ModelContours {
  const parsed = new SVGLoader().parse(sanitizeModelSvg(svg))
  const source: Shape[] = []
  for (const path of parsed.paths) {
    const style = record(path.userData.style)
    if (style.fill === 'none' || style.fillOpacity === 0 || style.opacity === 0 || style.display === 'none' || style.visibility === 'hidden') continue
    // r186's native method respects evenodd/nonzero, holes and nested islands.
    source.push(...path.toShapes())
  }
  if (!source.length || source.length > MODEL_INPUT_LIMITS.paths) throw new ModelGenerationError('empty_geometry', 'SVG has no usable filled geometry or too many shapes.')
  const sampled = source.map(shape => ({ outer: shape.getPoints(curveSegments), holes: shape.holes.map(h => h.getPoints(curveSegments)) }))
  if (sampled.reduce((sum, s) => sum + s.outer.length + s.holes.reduce((n, h) => n + h.length, 0), 0) > MODEL_INPUT_LIMITS.points) throw new ModelGenerationError('geometry_budget', 'Sampled vector contours exceed the point budget.')
  const bounds = new Box2().setFromPoints(sampled.flatMap(s => s.outer))
  const size = bounds.getSize(new Vector2()), center = bounds.getCenter(new Vector2()), scale = 2 / Math.max(size.x, size.y)
  if (!Number.isFinite(scale) || size.x < 1e-9 || size.y < 1e-9) throw new ModelGenerationError('empty_geometry', 'Model silhouette has zero width or height.')
  const normalize = (ring: Vector2[]) => cleanRing(ring.map(p => new Vector2((p.x - center.x) * scale, -(p.y - center.y) * scale)), 0.00001 + smoothing * 0.0005)
  const normalized = sampled.map(s => ({ outer: normalize(s.outer), holes: s.holes.map(normalize) }))
    .filter(s => Math.abs(ShapeUtils.area(s.outer)) > 1e-6)
  if (!normalized.length) throw new ModelGenerationError('empty_geometry', 'Model contours are below the minimum area.')
  for (const shape of normalized) for (const ring of [shape.outer, ...shape.holes]) {
    for (let i = 0; i < ring.length; i++) for (let j = i + 2; j < ring.length; j++) {
      if (i === 0 && j === ring.length - 1) continue
      if (crossing(ring[i], ring[(i + 1) % ring.length], ring[j], ring[(j + 1) % ring.length])) throw new ModelGenerationError('invalid_contour', 'Self-intersecting contours must be repaired before extrusion.')
    }
  }
  for (let i = 0; i < normalized.length; i++) {
    const a = normalized[i]
    for (let j = i + 1; j < normalized.length; j++) {
      const b = normalized[j]
      if (!new Box2().setFromPoints(a.outer).intersectsBox(new Box2().setFromPoints(b.outer))) continue
      let overlap = a.outer.some(p => filled(p, b)) || b.outer.some(p => filled(p, a))
      for (let k = 0; !overlap && k < a.outer.length; k++) for (let l = 0; !overlap && l < b.outer.length; l++) {
        overlap = crossing(a.outer[k], a.outer[(k + 1) % a.outer.length], b.outer[l], b.outer[(l + 1) % b.outer.length])
      }
      // Identical separate fill regions would otherwise create coplanar caps.
      if (!overlap && a.outer.length === b.outer.length && a.outer.every(p => b.outer.some(q => p.distanceToSquared(q) < 1e-16))) overlap = true
      if (overlap) throw new ModelGenerationError('overlapping_contours', 'Merge overlapping SVG fills into a single outline before generation.')
    }
  }
  const rings = normalized.flatMap(s => [s.outer, ...s.holes]), pointCount = rings.reduce((sum, ring) => sum + ring.length, 0)
  // Bound the work by the existing 6,000-point input budget, not an arbitrary
  // 2,000-point cutoff. Scalar math avoids millions of temporary Vector2s.
  // Test all nonincident edges, including holes and separate islands.
  let minimumDetail = Infinity
  const edges = rings.flatMap(ring => ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length], dx = b.x - a.x, dy = b.y - a.y
    return { ring, i, x: a.x, y: a.y, dx, dy, lengthSq: dx * dx + dy * dy }
  }))
  for (const ring of rings) for (let i = 0; i < ring.length; i++) {
    const p = ring[i]
    for (const edge of edges) {
      if (edge.ring === ring && (edge.i === i || (edge.i + 1) % ring.length === i)) continue
      const x = p.x - edge.x, y = p.y - edge.y
      const t = edge.lengthSq ? Math.max(0, Math.min(1, (x * edge.dx + y * edge.dy) / edge.lengthSq)) : 0
      const d = (x - t * edge.dx) ** 2 + (y - t * edge.dy) ** 2
      minimumDetail = Math.min(minimumDetail, d)
    }
  }
  minimumDetail = Math.sqrt(minimumDetail)
  const shapes = normalized.map(s => {
    const shape = new Shape(s.outer)
    shape.holes = s.holes.map(h => new Path(h))
    return shape
  })
  return { shapes, pointCount, minimumDetail }
}

/** The exact sampled front-cap contours supplied to ExtrudeGeometry, not the original raster mask. */
export function createContourPreview(contours: ModelContours): Blob {
  const rings = contours.shapes.map(shape => [shape.getPoints(1), ...shape.holes.map(hole => hole.getPoints(1))])
  const bounds = new Box2().setFromPoints(rings.flat(2))
  const size = bounds.getSize(new Vector2()), padding = 0.04
  const paths = rings.map(shape => `<path fill="white" fill-rule="evenodd" d="${shape.map(ring => ring.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${-p.y}`).join(' ') + ' Z').join(' ')}"/>`).join('')
  return new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="${(size.x + padding * 2) * 256}" height="${(size.y + padding * 2) * 256}" viewBox="${bounds.min.x - padding} ${-bounds.max.y - padding} ${size.x + padding * 2} ${size.y + padding * 2}">${paths}</svg>`], { type: 'image/svg+xml' })
}
