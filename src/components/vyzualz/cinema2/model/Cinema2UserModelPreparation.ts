import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { MODEL_MAX_TRIANGLES } from '../../../../features/models/domain/modelAssetTypes'

/** CPU preparation limits, independent of the renderer's GPU-memory allowance. */
export const CINEMA2_MODEL_PREPARATION_LIMITS = Object.freeze({
  triangles: MODEL_MAX_TRIANGLES,
  meshes: 1024,
  samples: 32768,
  defaultSamples: 1536,
  sections: 14,
  bytes: 32 * 1024 * 1024,
})

export interface Cinema2PreparedModelPart {
  name: string
  firstTriangle: number
  triangleCount: number
  materials: readonly string[]
}
export interface Cinema2PreparedModelSection {
  lower: number
  upper: number
  crossingTriangleCount: number
}

/**
 * Rest-pose data for all six previews. Positions are centered in root-local coordinates;
 * scaleToUnit gives a common two-unit longest side without modifying the source tree.
 * Sections are triangle/plane broad-phase data, NOT cut geometry or closed caps.
 * Buffers belong to this preparation and must be treated as read-only by effects.
 */
export class Cinema2PreparedUserModel {
  positions = new Float32Array(0)
  normals = new Float32Array(0)
  uvs = new Float32Array(0)
  meshIndices = new Uint16Array(0)
  materialIndices = new Uint32Array(0)
  sourceTriangles = new Uint32Array(0)
  sectionRanges = new Uint8Array(0)
  cumulativeAreas = new Float64Array(0)
  samplePositions = new Float32Array(0)
  sampleNormals = new Float32Array(0)
  sampleUvs = new Float32Array(0)
  sampleTriangles = new Uint32Array(0)
  sampleBarycentrics = new Float32Array(0)
  parts: readonly Cinema2PreparedModelPart[] = []
  sections: readonly Cinema2PreparedModelSection[] = []
  disposed = false
  triangleCount = 0
  degenerateTriangleCount = 0
  surfaceArea = 0
  readonly center: Three.Vector3
  readonly size: Three.Vector3
  extent = 0
  scaleToUnit = 1

  constructor(library: Cinema2ThreeLibrary) {
    this.center = new library.THREE.Vector3()
    this.size = new library.THREE.Vector3()
  }
  get byteLength(): number {
    return [this.positions, this.normals, this.uvs, this.meshIndices, this.materialIndices, this.sourceTriangles,
      this.sectionRanges, this.cumulativeAreas, this.samplePositions, this.sampleNormals, this.sampleUvs,
      this.sampleTriangles, this.sampleBarycentrics].reduce((total, buffer) => total + buffer.byteLength, 0)
  }
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.positions = this.normals = this.uvs = this.samplePositions = this.sampleNormals = this.sampleUvs = this.sampleBarycentrics = new Float32Array(0)
    this.meshIndices = new Uint16Array(0)
    this.materialIndices = this.sourceTriangles = this.sampleTriangles = new Uint32Array(0)
    this.sectionRanges = new Uint8Array(0)
    this.cumulativeAreas = new Float64Array(0)
    this.parts = []; this.sections = []
  }
}

const sequence = (index: number, base: number): number => {
  let result = 0, factor = 1 / base
  for (let value = index; value > 0; value = Math.floor(value / base)) { result += (value % base) * factor; factor /= base }
  return result
}

/** One bounded pass on attachment, never during animation or a quality-tier change. */
export function prepareCinema2UserModel(library: Cinema2ThreeLibrary, root: Three.Object3D, sampleCount: number = CINEMA2_MODEL_PREPARATION_LIMITS.defaultSamples): Cinema2PreparedUserModel {
  const T = library.THREE, limits = CINEMA2_MODEL_PREPARATION_LIMITS
  if (!Number.isInteger(sampleCount) || sampleCount < 1 || sampleCount > limits.samples) throw new Error('Model preparation exceeds the surface sample limit.')
  root.updateWorldMatrix(true, true)
  const meshes: Three.Mesh[] = []
  root.traverse(object => { if ((object as Three.Mesh).isMesh) meshes.push(object as Three.Mesh) })
  if (meshes.length > limits.meshes) throw new Error('Model preparation exceeds the mesh limit.')
  const ranges = meshes.map(mesh => {
    const geometry = mesh.geometry, count = geometry.index?.count ?? geometry.attributes.position?.count ?? 0
    const start = geometry.drawRange.start, end = Math.min(count, start + geometry.drawRange.count)
    if (!Number.isInteger(start) || start < 0 || start % 3 || end % 3) throw new Error('Model preparation requires complete triangles.')
    return { start, end, count: Math.max(0, (end - start) / 3) }
  })
  const capacity = ranges.reduce((sum, range) => sum + range.count, 0)
  // 116 bytes per triangle; 48 bytes per sample. Check BEFORE allocating buffers.
  if (capacity > limits.triangles || capacity * 116 + sampleCount * 48 > limits.bytes) throw new Error('Model preparation exceeds its geometry/memory budget.')
  const prepared = new Cinema2PreparedUserModel(library)
  try {
    prepared.positions = new Float32Array(capacity * 9); prepared.normals = new Float32Array(capacity * 9)
    prepared.uvs = new Float32Array(capacity * 6); prepared.meshIndices = new Uint16Array(capacity)
    prepared.materialIndices = new Uint32Array(capacity); prepared.sourceTriangles = new Uint32Array(capacity)
    prepared.sectionRanges = new Uint8Array(capacity * 2); prepared.cumulativeAreas = new Float64Array(capacity)
    const inverse = root.matrixWorld.clone().invert(), relative = new T.Matrix4(), normalMatrix = new T.Matrix3()
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), edge = new T.Vector3(), face = new T.Vector3(), normal = new T.Vector3()
    const points = [a, b, c]
    const bounds = new T.Box3(), parts: Cinema2PreparedModelPart[] = []
    for (let meshIndex = 0; meshIndex < meshes.length; meshIndex++) {
      const mesh = meshes[meshIndex], geometry = mesh.geometry, position = geometry.attributes.position
      if (!position) { parts.push({ name: mesh.name, firstTriangle: prepared.triangleCount, triangleCount: 0, materials: [] }); continue }
      if ((mesh as Three.SkinnedMesh).isSkinnedMesh || (mesh as Three.InstancedMesh).isInstancedMesh) throw new Error('Model preparation requires static, non-instanced meshes.')
      const authoredNormal = geometry.attributes.normal, uv = geometry.attributes.uv, index = geometry.index
      const materialList = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const part = { name: mesh.name, firstTriangle: prepared.triangleCount, triangleCount: 0, materials: materialList.map(material => material.name) }
      relative.multiplyMatrices(inverse, mesh.matrixWorld); normalMatrix.getNormalMatrix(relative)
      for (let offset = ranges[meshIndex].start; offset < ranges[meshIndex].end; offset += 3) {
        const vertices = [0, 1, 2].map(vertex => index ? index.getX(offset + vertex) : offset + vertex)
        for (let vertex = 0; vertex < 3; vertex++) {
          const vertexIndex = vertices[vertex]
          if (!Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= position.count) throw new Error('Model preparation found an invalid triangle index.')
          mesh.getVertexPosition(vertexIndex, points[vertex]).applyMatrix4(relative)
        }
        if (![a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z].every(Number.isFinite)) throw new Error('Model preparation found invalid coordinates.')
        face.subVectors(b, a).cross(edge.subVectors(c, a))
        const area = face.length() / 2
        if (!Number.isFinite(area)) throw new Error('Model preparation found an invalid surface area.')
        if (area === 0) { prepared.degenerateTriangleCount++; continue }
        const triangle = prepared.triangleCount++, base = triangle * 9
        face.normalize()
        prepared.surfaceArea += area; prepared.cumulativeAreas[triangle] = prepared.surfaceArea
        prepared.meshIndices[triangle] = meshIndex; prepared.sourceTriangles[triangle] = offset / 3
        prepared.materialIndices[triangle] = Array.isArray(mesh.material) ? geometry.groups.find(group => offset >= group.start && offset < group.start + group.count)?.materialIndex ?? 0 : 0
        for (let vertex = 0; vertex < 3; vertex++) {
          const point = points[vertex], vertexIndex = vertices[vertex]
          point.toArray(prepared.positions, base + vertex * 3); bounds.expandByPoint(point)
          normal.copy(face)
          if (authoredNormal && vertexIndex < authoredNormal.count) normal.fromBufferAttribute(authoredNormal, vertexIndex).applyNormalMatrix(normalMatrix)
          if (![normal.x, normal.y, normal.z].every(Number.isFinite)) normal.copy(face)
          normal.toArray(prepared.normals, base + vertex * 3)
          const u = uv && vertexIndex < uv.count ? uv.getX(vertexIndex) : 0, v = uv && vertexIndex < uv.count ? uv.getY(vertexIndex) : 0
          if (!Number.isFinite(u) || !Number.isFinite(v)) throw new Error('Model preparation found invalid UV coordinates.')
          prepared.uvs[triangle * 6 + vertex * 2] = u; prepared.uvs[triangle * 6 + vertex * 2 + 1] = v
        }
        part.triangleCount++
      }
      parts.push(part)
    }
    if (!prepared.triangleCount || bounds.isEmpty()) throw new Error('Model preparation found no usable surface triangles.')
    bounds.getCenter(prepared.center); bounds.getSize(prepared.size)
    prepared.extent = Math.max(prepared.size.x, prepared.size.y, prepared.size.z)
    prepared.scaleToUnit = 2 / prepared.extent; prepared.parts = parts
    // Exact triangle bounds determine framing; random/sparse samples never determine model size.
    for (let i = 0; i < prepared.triangleCount * 9; i += 3) {
      prepared.positions[i] -= prepared.center.x; prepared.positions[i + 1] -= prepared.center.y; prepared.positions[i + 2] -= prepared.center.z
    }
    const sectionCount = limits.sections, height = prepared.size.y
    const sections = Array.from({ length: sectionCount }, (_, section) => ({ lower: height * (section / sectionCount - .5), upper: height * ((section + 1) / sectionCount - .5), crossingTriangleCount: 0 }))
    for (let triangle = 0; triangle < prepared.triangleCount; triangle++) {
      const y = [prepared.positions[triangle * 9 + 1], prepared.positions[triangle * 9 + 4], prepared.positions[triangle * 9 + 7]]
      const first = height > 0 ? Math.max(0, Math.min(sectionCount - 1, Math.floor((Math.min(...y) / height + .5) * sectionCount))) : 0
      const last = height > 0 ? Math.max(0, Math.min(sectionCount - 1, Math.floor((Math.max(...y) / height + .5) * sectionCount))) : 0
      prepared.sectionRanges.set([first, last], triangle * 2)
      for (let section = first; section <= last; section++) sections[section].crossingTriangleCount++
    }
    prepared.sections = sections
    prepared.samplePositions = new Float32Array(sampleCount * 3); prepared.sampleNormals = new Float32Array(sampleCount * 3)
    prepared.sampleUvs = new Float32Array(sampleCount * 2); prepared.sampleBarycentrics = new Float32Array(sampleCount * 3)
    prepared.sampleTriangles = new Uint32Array(sampleCount)
    // Area-stratified triangle selection avoids bias toward densely tessellated small parts.
    for (let sample = 0; sample < sampleCount; sample++) {
      const target = (sample + .5) / sampleCount * prepared.surfaceArea
      let lo = 0, hi = prepared.triangleCount - 1
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (prepared.cumulativeAreas[mid] < target) lo = mid + 1; else hi = mid }
      const triangle = lo, u = Math.sqrt(sequence(sample + 1, 2)), v = sequence(sample + 1, 3), weights = [1 - u, u * (1 - v), u * v]
      prepared.sampleTriangles[sample] = triangle; prepared.sampleBarycentrics.set(weights, sample * 3)
      for (let vertex = 0; vertex < 3; vertex++) {
        for (let axis = 0; axis < 3; axis++) {
          prepared.samplePositions[sample * 3 + axis] += prepared.positions[triangle * 9 + vertex * 3 + axis] * weights[vertex]
          prepared.sampleNormals[sample * 3 + axis] += prepared.normals[triangle * 9 + vertex * 3 + axis] * weights[vertex]
        }
        for (let axis = 0; axis < 2; axis++) prepared.sampleUvs[sample * 2 + axis] += prepared.uvs[triangle * 6 + vertex * 2 + axis] * weights[vertex]
      }
      normal.fromArray(prepared.sampleNormals, sample * 3).normalize().toArray(prepared.sampleNormals, sample * 3)
    }
    return prepared
  } catch (error) { prepared.dispose(); throw error }
}
