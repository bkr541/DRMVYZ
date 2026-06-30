import { length3, normalize3, subtract3, type ConstellationVec3 } from './ConstellationMath'
import type { ConstellationMeshStyle } from './ConstellationGraphBuilder'

export interface ConstellationMeshData {
  positions: Float32Array
  normals: Float32Array
  barycentrics: Float32Array
  /** Sequential indices retained for validation and future indexed batching. */
  indices: Uint16Array
  vertexCount: number
  boundsRadius: number
}

type Face = readonly [number, number, number]

function cross(a: ConstellationVec3, b: ConstellationVec3): ConstellationVec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function finiteVertex(vertex: ConstellationVec3 | undefined): vertex is ConstellationVec3 {
  return Boolean(vertex)
    && Number.isFinite(vertex?.x)
    && Number.isFinite(vertex?.y)
    && Number.isFinite(vertex?.z)
}

function flatMesh(vertices: readonly ConstellationVec3[], faces: readonly Face[]): ConstellationMeshData {
  const positions: number[] = []
  const normals: number[] = []
  const barycentrics: number[] = []
  const bary = [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as const
  let boundsRadius = 0

  for (const face of faces) {
    const a = vertices[face[0]]
    const b = vertices[face[1]]
    const c = vertices[face[2]]
    if (!finiteVertex(a) || !finiteVertex(b) || !finiteVertex(c)) continue
    const crossValue = cross(subtract3(b, a), subtract3(c, a))
    if (length3(crossValue) <= 1e-6) continue
    const normal = normalize3(crossValue)
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = vertices[face[corner]]
      positions.push(vertex.x, vertex.y, vertex.z)
      normals.push(normal.x, normal.y, normal.z)
      barycentrics.push(...bary[corner])
      boundsRadius = Math.max(boundsRadius, length3(vertex))
    }
  }

  const vertexCount = positions.length / 3
  const indices = new Uint16Array(vertexCount)
  for (let index = 0; index < vertexCount; index += 1) indices[index] = index
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    barycentrics: new Float32Array(barycentrics),
    indices,
    vertexCount,
    boundsRadius,
  }
}

function tetrahedron(): ConstellationMeshData {
  const vertices = [
    normalize3({ x: 1, y: 1, z: 1 }),
    normalize3({ x: -1, y: -1, z: 1 }),
    normalize3({ x: -1, y: 1, z: -1 }),
    normalize3({ x: 1, y: -1, z: -1 }),
  ]
  return flatMesh(vertices, [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]])
}

function octahedron(): ConstellationMeshData {
  const vertices = [
    { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
  ]
  return flatMesh(vertices, [
    [2, 0, 4], [2, 4, 1], [2, 1, 5], [2, 5, 0],
    [3, 4, 0], [3, 1, 4], [3, 5, 1], [3, 0, 5],
  ])
}

function icosahedron(): ConstellationMeshData {
  const phi = (1 + Math.sqrt(5)) / 2
  const vertices = [
    { x: -1, y: phi, z: 0 }, { x: 1, y: phi, z: 0 }, { x: -1, y: -phi, z: 0 }, { x: 1, y: -phi, z: 0 },
    { x: 0, y: -1, z: phi }, { x: 0, y: 1, z: phi }, { x: 0, y: -1, z: -phi }, { x: 0, y: 1, z: -phi },
    { x: phi, y: 0, z: -1 }, { x: phi, y: 0, z: 1 }, { x: -phi, y: 0, z: -1 }, { x: -phi, y: 0, z: 1 },
  ].map(normalize3)
  const faces: Face[] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ]
  return flatMesh(vertices, faces)
}

function irregularCrystal(): ConstellationMeshData {
  const vertices: ConstellationVec3[] = [
    { x: 0.08, y: 1.25, z: -0.04 },
    { x: -0.12, y: -1.05, z: 0.1 },
    { x: 0.82, y: 0.18, z: 0.08 },
    { x: 0.22, y: 0.1, z: 0.74 },
    { x: -0.65, y: 0.02, z: 0.42 },
    { x: -0.54, y: -0.08, z: -0.58 },
    { x: 0.48, y: 0.12, z: -0.7 },
  ]
  const faces: Face[] = []
  for (let index = 2; index < vertices.length; index += 1) {
    const next = index === vertices.length - 1 ? 2 : index + 1
    faces.push([0, index, next], [1, next, index])
  }
  return flatMesh(vertices, faces)
}

const LIBRARY: Record<ConstellationMeshStyle, ConstellationMeshData> = {
  tetrahedron: tetrahedron(),
  octahedron: octahedron(),
  icosahedron: icosahedron(),
  irregularCrystal: irregularCrystal(),
}

export function getConstellationMesh(style: ConstellationMeshStyle): ConstellationMeshData {
  return LIBRARY[style]
}

export function listConstellationMeshStyles(): readonly ConstellationMeshStyle[] {
  return Object.keys(LIBRARY) as ConstellationMeshStyle[]
}

export function isConstellationMeshValid(mesh: ConstellationMeshData): boolean {
  if (mesh.vertexCount < 3 || mesh.vertexCount % 3 !== 0 || !Number.isFinite(mesh.boundsRadius) || mesh.boundsRadius <= 0) return false
  if (mesh.positions.length !== mesh.vertexCount * 3 || mesh.normals.length !== mesh.positions.length) return false
  if (mesh.barycentrics.length !== mesh.positions.length || mesh.indices.length !== mesh.vertexCount) return false
  if (!Array.from(mesh.positions).every(Number.isFinite) || !Array.from(mesh.normals).every(Number.isFinite)) return false
  return Array.from(mesh.indices).every((index, position) => index === position && index < mesh.vertexCount)
}
