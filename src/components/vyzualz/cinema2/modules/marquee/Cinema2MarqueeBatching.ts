import type * as ThreeNamespace from 'three'

/**
 * Geometry batching for MARQUEE. The V2 theater ships ~1,600 separately named meshes (868 bulbs alone); drawing them one by one is
 * ~1,600 draw calls. Controller code keeps every authored node addressable through vertex ranges and draws each family as one mesh.
 *
 * The V2 GLB carries no normals (the loader would flat-shade every part, faceting the bulbs, tubes and crown). `creaseNormals` derives
 * them from the triangles: edges sharper than the crease angle stay hard (boxes, mouldings), softer ones are smoothed (spheres, arches).
 */

export interface Cinema2MarqueeSourcePart {
  readonly mesh: ThreeNamespace.Mesh
  /** Crease angle in degrees for geometry with no authored normals. */
  readonly creaseDegrees: number
}

export interface Cinema2MarqueeBatchRange {
  readonly start: number
  readonly count: number
}

export interface Cinema2MarqueeBatch {
  readonly geometry: ThreeNamespace.BufferGeometry
  /** Vertex range of each source part, in the order the parts were given. */
  readonly ranges: readonly Cinema2MarqueeBatchRange[]
  /** World-space centre of each source part. */
  readonly centers: readonly (readonly [number, number, number])[]
}

interface PartArrays {
  position: Float32Array
  normal: Float32Array
  uv: Float32Array
  index: Uint32Array
}

/** Derives vertex normals with a crease angle. Vertices are split where adjacent faces differ by more than the angle. */
export function creaseNormals(positions: ArrayLike<number>, index: ArrayLike<number> | null, creaseDegrees: number, uvs?: ArrayLike<number> | null): PartArrays {
  const vertexCount = Math.floor(positions.length / 3)
  const sourceIndex = index ?? Array.from({ length: vertexCount }, (_, i) => i)
  const faceCount = Math.floor(sourceIndex.length / 3)
  const faceNormals = new Float32Array(faceCount * 3)
  const facesOfVertex: number[][] = Array.from({ length: vertexCount }, () => [])
  for (let face = 0; face < faceCount; face += 1) {
    const a = sourceIndex[face * 3]!
    const b = sourceIndex[face * 3 + 1]!
    const c = sourceIndex[face * 3 + 2]!
    const ux = positions[b * 3]! - positions[a * 3]!, uy = positions[b * 3 + 1]! - positions[a * 3 + 1]!, uz = positions[b * 3 + 2]! - positions[a * 3 + 2]!
    const vx = positions[c * 3]! - positions[a * 3]!, vy = positions[c * 3 + 1]! - positions[a * 3 + 1]!, vz = positions[c * 3 + 2]! - positions[a * 3 + 2]!
    // Un-normalised cross product: its length is twice the face area, which weights the smoothing.
    faceNormals[face * 3] = uy * vz - uz * vy
    faceNormals[face * 3 + 1] = uz * vx - ux * vz
    faceNormals[face * 3 + 2] = ux * vy - uy * vx
    facesOfVertex[a]!.push(face); facesOfVertex[b]!.push(face); facesOfVertex[c]!.push(face)
  }
  const cosine = Math.cos((Math.min(180, Math.max(0, creaseDegrees)) * Math.PI) / 180)
  const unit = (face: number): [number, number, number] => {
    const x = faceNormals[face * 3]!, y = faceNormals[face * 3 + 1]!, z = faceNormals[face * 3 + 2]!
    const length = Math.hypot(x, y, z) || 1
    return [x / length, y / length, z / length]
  }

  const outPosition: number[] = []
  const outNormal: number[] = []
  const outUv: number[] = []
  const outIndex: number[] = []
  const lookup = new Map<string, number>()
  for (let face = 0; face < faceCount; face += 1) {
    const [fx, fy, fz] = unit(face)
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = sourceIndex[face * 3 + corner]!
      let nx = 0, ny = 0, nz = 0
      for (const other of facesOfVertex[vertex]!) {
        const [ox, oy, oz] = unit(other)
        if (fx * ox + fy * oy + fz * oz >= cosine - 1e-6) {
          nx += faceNormals[other * 3]!; ny += faceNormals[other * 3 + 1]!; nz += faceNormals[other * 3 + 2]!
        }
      }
      const length = Math.hypot(nx, ny, nz) || 1
      nx /= length; ny /= length; nz /= length
      const key = `${vertex}:${Math.round(nx * 200)}:${Math.round(ny * 200)}:${Math.round(nz * 200)}`
      let slot = lookup.get(key)
      if (slot === undefined) {
        slot = outPosition.length / 3
        lookup.set(key, slot)
        outPosition.push(positions[vertex * 3]!, positions[vertex * 3 + 1]!, positions[vertex * 3 + 2]!)
        outNormal.push(nx, ny, nz)
        outUv.push(uvs ? uvs[vertex * 2]! : 0, uvs ? uvs[vertex * 2 + 1]! : 0)
      }
      outIndex.push(slot)
    }
  }
  return { position: new Float32Array(outPosition), normal: new Float32Array(outNormal), uv: new Float32Array(outUv), index: new Uint32Array(outIndex) }
}

function readPart(THREE: typeof ThreeNamespace, part: Cinema2MarqueeSourcePart): PartArrays | null {
  const geometry = part.mesh.geometry
  const position = geometry.getAttribute('position')
  if (!position || position.itemSize < 3) return null
  const positions = new Float32Array(position.count * 3)
  for (let i = 0; i < position.count; i += 1) { positions[i * 3] = position.getX(i); positions[i * 3 + 1] = position.getY(i); positions[i * 3 + 2] = position.getZ(i) }
  const uvAttribute = geometry.getAttribute('uv')
  const uvs = uvAttribute ? new Float32Array(uvAttribute.count * 2) : null
  if (uvAttribute && uvs) for (let i = 0; i < uvAttribute.count; i += 1) { uvs[i * 2] = uvAttribute.getX(i); uvs[i * 2 + 1] = uvAttribute.getY(i) }
  const indexAttribute = geometry.getIndex()
  const index = indexAttribute ? Array.from(indexAttribute.array as ArrayLike<number>) : null

  const normalAttribute = geometry.getAttribute('normal')
  let arrays: PartArrays
  if (normalAttribute) {
    const normals = new Float32Array(normalAttribute.count * 3)
    for (let i = 0; i < normalAttribute.count; i += 1) { normals[i * 3] = normalAttribute.getX(i); normals[i * 3 + 1] = normalAttribute.getY(i); normals[i * 3 + 2] = normalAttribute.getZ(i) }
    arrays = { position: positions, normal: normals, uv: uvs ?? new Float32Array(position.count * 2), index: Uint32Array.from(index ?? Array.from({ length: position.count }, (_, i) => i)) }
  } else {
    arrays = creaseNormals(positions, index, part.creaseDegrees, uvs)
  }

  // Bake the node's world transform so parts can share one buffer. A mirrored transform flips triangle winding.
  const matrix = part.mesh.matrixWorld
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
  const point = new THREE.Vector3()
  const normal = new THREE.Vector3()
  for (let i = 0; i < arrays.position.length / 3; i += 1) {
    point.set(arrays.position[i * 3]!, arrays.position[i * 3 + 1]!, arrays.position[i * 3 + 2]!).applyMatrix4(matrix)
    arrays.position[i * 3] = point.x; arrays.position[i * 3 + 1] = point.y; arrays.position[i * 3 + 2] = point.z
    normal.set(arrays.normal[i * 3]!, arrays.normal[i * 3 + 1]!, arrays.normal[i * 3 + 2]!).applyMatrix3(normalMatrix).normalize()
    arrays.normal[i * 3] = normal.x; arrays.normal[i * 3 + 1] = normal.y; arrays.normal[i * 3 + 2] = normal.z
  }
  if (matrix.determinant() < 0) {
    for (let i = 0; i < arrays.index.length; i += 3) { const swap = arrays.index[i + 1]!; arrays.index[i + 1] = arrays.index[i + 2]!; arrays.index[i + 2] = swap }
  }
  return arrays
}

/** Merges parts into one indexed geometry in world space (call after `updateMatrixWorld`). Returns null when nothing could be read. */
export function mergeMarqueeParts(THREE: typeof ThreeNamespace, parts: readonly Cinema2MarqueeSourcePart[]): Cinema2MarqueeBatch | null {
  const arrays = parts.map(part => readPart(THREE, part))
  let vertices = 0
  let indices = 0
  for (const entry of arrays) if (entry) { vertices += entry.position.length / 3; indices += entry.index.length }
  if (vertices === 0) return null
  const position = new Float32Array(vertices * 3)
  const normal = new Float32Array(vertices * 3)
  const uv = new Float32Array(vertices * 2)
  const index = new Uint32Array(indices)
  const ranges: Cinema2MarqueeBatchRange[] = []
  const centers: [number, number, number][] = []
  let vertexOffset = 0
  let indexOffset = 0
  for (const entry of arrays) {
    if (!entry) { ranges.push({ start: vertexOffset, count: 0 }); centers.push([0, 0, 0]); continue }
    const count = entry.position.length / 3
    position.set(entry.position, vertexOffset * 3)
    normal.set(entry.normal, vertexOffset * 3)
    uv.set(entry.uv, vertexOffset * 2)
    let cx = 0, cy = 0, cz = 0
    for (let i = 0; i < count; i += 1) { cx += entry.position[i * 3]!; cy += entry.position[i * 3 + 1]!; cz += entry.position[i * 3 + 2]! }
    for (let i = 0; i < entry.index.length; i += 1) index[indexOffset + i] = entry.index[i]! + vertexOffset
    ranges.push({ start: vertexOffset, count })
    centers.push([cx / count, cy / count, cz / count])
    vertexOffset += count
    indexOffset += entry.index.length
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geometry.setIndex(new THREE.BufferAttribute(index, 1))
  geometry.computeBoundingSphere()
  geometry.computeBoundingBox()
  return { geometry, ranges, centers }
}

/**
 * Lets a batched mesh carry one emitted colour per vertex (`cinema2Emit`, linear HDR) so every bulb in a one-draw-call family can glow
 * independently. The attribute replaces the material's single emissive colour; everything else about the material is unchanged.
 */
export function enablePerVertexEmission(material: ThreeNamespace.Material): void {
  const previous = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 cinema2Emit;\nvarying vec3 vCinema2Emit;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCinema2Emit = cinema2Emit;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCinema2Emit;')
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vCinema2Emit;')
  }
  const previousKey = material.customProgramCacheKey
  material.customProgramCacheKey = () => `${previousKey ? previousKey.call(material) : ''}|cinema2-marquee-emit`
  material.needsUpdate = true
}
