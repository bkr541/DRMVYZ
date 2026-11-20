import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2PreparedUserModel } from './Cinema2UserModelPreparation'

export const CINEMA2_SLICE_LIMITS = Object.freeze({ sections: 14, triangles: 400_000, bytes: 64 * 1024 * 1024, segments: 100_000, contours: 2048, groups: 8192 })
type Vertex = number[] // position xyz, normal xyz, uv0, color rgba, uv1/uv2/uv3
interface Segment { a: Vertex; b: Vertex }
const STRIDE = 18, CHUNK = STRIDE * 3 * 1024

/** Typed chunks bound temporary output; no oversized JS number arrays or per-frame geometry. */
class SurfaceBuffer {
  chunks: Float32Array[] = []
  length = 0
  groups: { start: number; count: number; materialIndex: number }[] = []
  constructor(private readonly budget: { triangles: number; groups: number }, readonly centerY: number) {}
  triangle(a: Vertex, b: Vertex, c: Vertex, materialIndex: number): void {
    if (++this.budget.triangles > CINEMA2_SLICE_LIMITS.triangles || this.budget.triangles * 3 * STRIDE * 4 > CINEMA2_SLICE_LIMITS.bytes) throw new Error('Actual slices exceed the bounded geometry budget. The original model is kept visible.')
    const previous = this.groups[this.groups.length - 1]
    if (previous?.materialIndex === materialIndex) previous.count += 3
    else {
      if (++this.budget.groups > CINEMA2_SLICE_LIMITS.groups) throw new Error('Actual slices exceed the material draw-group limit. The original model is kept visible.')
      this.groups.push({ start: this.length / STRIDE, count: 3, materialIndex })
    }
    for (const vertex of [a, b, c]) for (let component = 0; component < STRIDE; component++) {
      const chunk = Math.floor(this.length / CHUNK)
      if (!this.chunks[chunk]) this.chunks[chunk] = new Float32Array(CHUNK)
      this.chunks[chunk][this.length++ % CHUNK] = vertex[component] - (component === 1 ? this.centerY : 0)
    }
  }
  geometry(T: Cinema2ThreeLibrary['THREE']): Three.BufferGeometry {
    const count = this.length / STRIDE, positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2), colors = new Float32Array(count * 4), extraUvs = Array.from({ length: 3 }, () => new Float32Array(count * 2))
    for (let i = 0; i < this.length; i++) {
      const value = this.chunks[Math.floor(i / CHUNK)][i % CHUNK], vertex = Math.floor(i / STRIDE), component = i % STRIDE
      if (component < 3) positions[vertex * 3 + component] = value
      else if (component < 6) normals[vertex * 3 + component - 3] = value
      else if (component < 8) uvs[vertex * 2 + component - 6] = value
      else if (component < 12) colors[vertex * 4 + component - 8] = value
      else extraUvs[Math.floor((component - 12) / 2)][vertex * 2 + (component - 12) % 2] = value
    }
    this.chunks = []
    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', new T.BufferAttribute(positions, 3)); geometry.setAttribute('normal', new T.BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new T.BufferAttribute(uvs, 2)); geometry.setAttribute('color', new T.BufferAttribute(colors, 4))
    for (let channel = 0; channel < 3; channel++) geometry.setAttribute(`uv${channel + 1}`, new T.BufferAttribute(extraUvs[channel], 2))
    for (const group of this.groups) geometry.addGroup(group.start, group.count, group.materialIndex)
    geometry.computeBoundingBox(); geometry.computeBoundingSphere()
    return geometry
  }
}

function clip(polygon: Vertex[], height: number, above: boolean): Vertex[] {
  const result: Vertex[] = []
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = a[1] - height, db = b[1] - height
    const insideA = above ? da >= 0 : da <= 0, insideB = above ? db >= 0 : db <= 0
    if (insideA) result.push(a)
    if (insideA !== insideB) {
      const t = da / (da - db), vertex = a.map((value, component) => value + (b[component] - value) * t)
      vertex[1] = height
      const length = Math.hypot(vertex[3], vertex[4], vertex[5]) || 1
      vertex[3] /= length; vertex[4] /= length; vertex[5] /= length
      result.push(vertex)
    }
  }
  return result
}
function area2(a: Vertex, b: Vertex, c: Vertex): number {
  const ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2], bx = c[0] - a[0], by = c[1] - a[1], bz = c[2] - a[2]
  return Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx)
}
function intersection(vertices: Vertex[], height: number, epsilon: number): Segment | null {
  const hits: Vertex[] = []
  const add = (point: Vertex) => { if (!hits.some(p => Math.hypot(p[0] - point[0], p[2] - point[2]) < epsilon)) hits.push(point) }
  if (vertices.every(vertex => Math.abs(vertex[1] - height) < epsilon)) return null
  for (let i = 0; i < 3; i++) {
    const a = vertices[i], b = vertices[(i + 1) % 3], da = a[1] - height, db = b[1] - height
    if (Math.abs(da) < epsilon) add(a)
    if (da * db < 0) { const t = da / (da - db); add([a[0] + (b[0] - a[0]) * t, height, a[2] + (b[2] - a[2]) * t]) }
  }
  return hits.length === 2 ? { a: hits[0], b: hits[1] } : null
}

function contours(T: Cinema2ThreeLibrary['THREE'], segments: Segment[], epsilon: number): { loops: Three.Vector2[][]; open: number } {
  const nodes = new Map<string, { point: Three.Vector2; neighbors: Set<string> }>()
  const key = (v: Vertex) => `${Math.round(v[0] / epsilon)},${Math.round(v[2] / epsilon)}`
  for (const { a, b } of segments) {
    const ka = key(a), kb = key(b); if (ka === kb) continue
    if (!nodes.has(ka)) nodes.set(ka, { point: new T.Vector2(a[0], a[2]), neighbors: new Set() })
    if (!nodes.has(kb)) nodes.set(kb, { point: new T.Vector2(b[0], b[2]), neighbors: new Set() })
    nodes.get(ka)!.neighbors.add(kb); nodes.get(kb)!.neighbors.add(ka)
  }
  const visited = new Set<string>(), loops: Three.Vector2[][] = []
  let open = 0
  for (const start of nodes.keys()) {
    if (visited.has(start)) continue
    // Validate a whole connected component before attempting a loop; branches never become fabricated caps.
    const component: string[] = [], pending = [start]; visited.add(start)
    while (pending.length) {
      const current = pending.pop()!; component.push(current)
      for (const next of nodes.get(current)!.neighbors) if (!visited.has(next)) { visited.add(next); pending.push(next) }
    }
    if (component.some(node => nodes.get(node)!.neighbors.size !== 2)) { open++; continue }
    const loop: Three.Vector2[] = []
    let current = start, previous = ''
    do { const node = nodes.get(current)!; loop.push(node.point); const next = [...node.neighbors].find(neighbor => neighbor !== previous)!; previous = current; current = next } while (current !== start && loop.length <= component.length)
    if (current !== start || loop.length < 3) { open++; continue }
    if (loops.length >= CINEMA2_SLICE_LIMITS.contours) throw new Error('Slice contour count exceeds its preparation limit. The original model is kept visible.')
    loops.push(loop)
  }
  return { loops, open }
}
function contains(polygon: Three.Vector2[], point: Three.Vector2): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j]
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export class Cinema2SlicedUserModel {
  readonly group: Three.Group
  readonly meshes: Three.Mesh[] = []
  readonly centers: number[] = []
  readonly materials: Three.Material[] = []
  readonly capMaterial: Three.MeshStandardMaterial
  openContours = 0
  capTriangles = 0
  triangleCount = 0
  byteLength = 0
  private disposed = false
  constructor(T: Cinema2ThreeLibrary['THREE']) {
    this.group = new T.Group(); this.group.name = 'ActualModelSlices'
    this.capMaterial = new T.MeshStandardMaterial({ color: '#74cbd6', roughness: .4, metalness: .3 })
    this.capMaterial.name = 'Model Cut Face'
    this.materials.push(this.capMaterial)
  }
  dispose(): void {
    if (this.disposed) return
    this.disposed = true; this.group.removeFromParent()
    for (const mesh of this.meshes) mesh.geometry.dispose()
    for (const material of this.materials) material.dispose()
    this.group.clear(); this.meshes.length = 0; this.materials.length = 0; this.centers.length = 0
  }
}

/** Clip actual source triangles, then cap closed cut contours with hole-aware triangulation. */
export function buildCinema2UserModelSlices(library: Cinema2ThreeLibrary, prepared: Cinema2PreparedUserModel, meshes: readonly Three.Mesh[], sectionCount: number = CINEMA2_SLICE_LIMITS.sections): Cinema2SlicedUserModel {
  const T = library.THREE, result = new Cinema2SlicedUserModel(T), count = sectionCount
  try {
    if (!Number.isInteger(count) || count < 2 || count > CINEMA2_SLICE_LIMITS.sections) throw new Error('Slice partition count is outside its bounded range.')
    const height = prepared.size.y, epsilon = Math.max(prepared.extent * 1e-6, 1e-10)
    if (!(height > epsilon)) throw new Error('This model has no vertical thickness to slice. The original model is kept visible.')
    const offsets = meshes.map(mesh => {
      const offset = result.materials.length
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) result.materials.push(material.clone())
      return offset
    })
    const budget = { triangles: 0, groups: 0 }, boundaries = Array.from({ length: count + 1 }, (_, i) => -height / 2 + height * i / count)
    const buffers = Array.from({ length: count }, (_, i) => new SurfaceBuffer(budget, (boundaries[i] + boundaries[i + 1]) / 2))
    const segments: Segment[][] = Array.from({ length: count + 1 }, () => [])
    let segmentCount = 0
    for (let triangle = 0; triangle < prepared.triangleCount; triangle++) {
      const meshIndex = prepared.meshIndices[triangle], mesh = meshes[meshIndex], color = mesh.geometry.attributes.color
      const sourceOffset = prepared.sourceTriangles[triangle] * 3, vertices: Vertex[] = []
      for (let i = 0; i < 3; i++) {
        const vertex = mesh.geometry.index?.getX(sourceOffset + i) ?? sourceOffset + i
        vertices.push([...prepared.positions.subarray(triangle * 9 + i * 3, triangle * 9 + i * 3 + 3), ...prepared.normals.subarray(triangle * 9 + i * 3, triangle * 9 + i * 3 + 3), ...prepared.uvs.subarray(triangle * 6 + i * 2, triangle * 6 + i * 2 + 2), color?.getX(vertex) ?? 1, color?.getY(vertex) ?? 1, color?.getZ(vertex) ?? 1, color && color.itemSize === 4 ? color.getW(vertex) : 1, ...['uv1', 'uv2', 'uv3'].flatMap(name => { const uv = mesh.geometry.attributes[name]; return uv ? [uv.getX(vertex), uv.getY(vertex)] : [0, 0] })])
      }
      const first = Math.max(0, Math.min(count - 1, Math.floor((Math.min(...vertices.map(v => v[1])) / height + .5) * count))), last = Math.max(0, Math.min(count - 1, Math.floor((Math.max(...vertices.map(v => v[1])) / height + .5) * count)))
      for (let band = first; band <= last; band++) {
        const polygon = clip(clip(vertices, boundaries[band], true), boundaries[band + 1], false)
        for (let i = 1; i + 1 < polygon.length; i++) if (area2(polygon[0], polygon[i], polygon[i + 1]) > epsilon * epsilon) buffers[band].triangle(polygon[0], polygon[i], polygon[i + 1], offsets[meshIndex] + prepared.materialIndices[triangle])
      }
      for (let boundary = Math.max(1, first); boundary <= Math.min(count - 1, last + 1); boundary++) {
        const segment = intersection(vertices, boundaries[boundary], epsilon)
        if (segment) {
          if (++segmentCount > CINEMA2_SLICE_LIMITS.segments) throw new Error('Slice intersections exceed their preparation limit. The original model is kept visible.')
          segments[boundary].push(segment)
        }
      }
    }
    for (let boundary = 1; boundary < count; boundary++) {
      const cut = contours(T, segments[boundary], epsilon); result.openContours += cut.open
      const areas = cut.loops.map(loop => Math.abs(T.ShapeUtils.area(loop)))
      const parents = cut.loops.map((loop, i) => {
        let parent = -1, area = Infinity
        for (let j = 0; j < cut.loops.length; j++) if (areas[j] > areas[i] && areas[j] < area && contains(cut.loops[j], loop[0])) { parent = j; area = areas[j] }
        return parent
      })
      const depth = (i: number) => { let d = 0; for (let p = parents[i]; p !== -1; p = parents[p]) d++; return d }
      for (let i = 0; i < cut.loops.length; i++) {
        if (depth(i) % 2 || areas[i] < epsilon * epsilon) continue
        const outer = cut.loops[i].slice(), holes = cut.loops.filter((_, j) => parents[j] === i && depth(j) % 2 === 1).map(loop => loop.slice())
        // ShapeUtils removes duplicate closing points; use the same post-triangulation vertex layout.
        const faces = T.ShapeUtils.triangulateShape(outer, holes), points = [...outer, ...holes.flat()]
        for (const face of faces) for (const side of [-1, 1]) {
          const points3 = face.map(index => { const p = points[index]; return [p.x, boundaries[boundary], p.y, 0, side, 0, p.x / prepared.extent + .5, p.y / prepared.extent + .5, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0] })
          const [a, b, c] = points3, det = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])
          buffers[side === 1 ? boundary - 1 : boundary].triangle(a, side * det > 0 ? c : b, side * det > 0 ? b : c, 0)
          result.capTriangles++
        }
      }
    }
    for (const buffer of buffers) {
      if (!buffer.length) continue
      const geometry = buffer.geometry(T), mesh = new T.Mesh(geometry, result.materials)
      mesh.position.y = buffer.centerY; mesh.name = `ModelSlice-${result.meshes.length + 1}`
      result.group.add(mesh); result.meshes.push(mesh); result.centers.push(buffer.centerY)
      for (const attribute of Object.values(geometry.attributes)) result.byteLength += attribute.array.byteLength
    }
    result.triangleCount = budget.triangles
    return result
  } catch (error) { result.dispose(); throw error }
}

export function cinema2SliceSpread(beats: number, cycleBeats = 16): number {
  const phase = ((beats / Math.max(8, cycleBeats)) % 1 + 1) % 1
  const ease = (start: number, end: number) => { const t = Math.max(0, Math.min(1, (phase - start) / (end - start))); return t * t * (3 - 2 * t) }
  return ease(.12, .4) * (1 - ease(.64, .92))
}
