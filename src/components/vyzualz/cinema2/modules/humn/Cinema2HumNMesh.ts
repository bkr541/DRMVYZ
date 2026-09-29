import {
  CINEMA2_HUMN_FIGURE_BONE_NAMES,
  CINEMA2_HUMN_FIGURE_BONE_PARENTS,
  CINEMA2_HUMN_FIGURE_BONE_PIVOTS,
  CINEMA2_HUMN_FIGURE_DENSITIES,
  CINEMA2_HUMN_FIGURE_EYES,
} from './Cinema2HumNFigure.generated'

/**
 * HUM:N figure mesh: a faceted low-poly human (head, neck, torso to the hips, arms, hands with five jointed fingers). The shape is the CC0
 * MakeHuman base mesh reduced to large facets by scripts/cinema2-assets/generate-humn-figure.mjs, which also carries MakeHuman's skin weights
 * over to HUM:N's 44 bones; this module unpacks that data into the renderer's vertex format and adds the eye discs. Units are metres, +Y up,
 * the figure faces +Z (toward the camera). The rest pose is MakeHuman's A-pose (arms about 40 degrees from the body); the rig lowers them.
 *
 * The mesh is triangle-soup (three vertices per triangle) because every triangle is shaded, filled and displaced on its own. Each vertex carries
 * a two-bone skin (bone A, bone B, weight of B) for the pose rig, its triangle's bind-pose centre and normal, and per-triangle / per-edge stable
 * random numbers so fills, fragmentation and jitter pick the same triangles frame after frame.
 */

export type Cinema2HumNVec3 = readonly [number, number, number]

export type Cinema2HumNBoneName = typeof CINEMA2_HUMN_FIGURE_BONE_NAMES[number]

/** Bone indices by name. "Left"/"right" are the viewer's left (-X) and right (+X). 0-9 keep the original figure's bones. */
export const CINEMA2_HUMN_BONE = Object.freeze(Object.fromEntries(CINEMA2_HUMN_FIGURE_BONE_NAMES.map((name, index) => [name, index])) as Record<Cinema2HumNBoneName, number>)

export const CINEMA2_HUMN_BONE_COUNT = CINEMA2_HUMN_FIGURE_BONE_NAMES.length

/** Bind-pose joint positions. */
export const CINEMA2_HUMN_BONE_PIVOTS: readonly Cinema2HumNVec3[] = CINEMA2_HUMN_FIGURE_BONE_PIVOTS

export const CINEMA2_HUMN_BONE_PARENTS: readonly number[] = CINEMA2_HUMN_FIGURE_BONE_PARENTS

export const CINEMA2_HUMN_FINGERS = Object.freeze(['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'] as const)

export const CINEMA2_HUMN_REGION = Object.freeze({ skin: 0, eye: 1 } as const)

/** Floats per vertex: position 3, normal 3, skin 3, triangle centre 3, triangle info 4 (rank, region, seed, angle), edge info 3. */
export const CINEMA2_HUMN_VERTEX_FLOATS = 19

export type Cinema2HumNMeshDensity = 1 | 2

export interface Cinema2HumNMesh {
  readonly density: Cinema2HumNMeshDensity
  readonly triangleCount: number
  readonly vertexCount: number
  readonly data: Float32Array
}

interface Skin {
  a: number
  b: number
  w: number
}

interface RawTriangle {
  p: [Cinema2HumNVec3, Cinema2HumNVec3, Cinema2HumNVec3]
  s: [Skin, Skin, Skin]
  region: number
  /** Fan angle per vertex (eye discs use it for spokes). */
  angle: [number, number, number]
}

function hash01(seed: number): number {
  let x = (Math.trunc(seed) ^ 0x9e3779b9) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

const sub = (a: Cinema2HumNVec3, b: Cinema2HumNVec3): Cinema2HumNVec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: Cinema2HumNVec3, b: Cinema2HumNVec3): Cinema2HumNVec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const normalize = (a: Cinema2HumNVec3): Cinema2HumNVec3 => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / length, a[1] / length, a[2] / length]
}

function centroid(points: readonly Cinema2HumNVec3[]): Cinema2HumNVec3 {
  let x = 0
  let y = 0
  let z = 0
  for (const point of points) {
    x += point[0]
    y += point[1]
    z += point[2]
  }
  const n = points.length || 1
  return [x / n, y / n, z / n]
}

function decodeBase64(encoded: string): ArrayBuffer {
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

/** The reduced MakeHuman surface as triangles with their two-bone skin. */
function figureTriangles(density: Cinema2HumNMeshDensity): RawTriangle[] {
  const source = CINEMA2_HUMN_FIGURE_DENSITIES[density]
  const positions = new Float32Array(decodeBase64(source.positions))
  const skins = new Uint8Array(decodeBase64(source.skin))
  const indices = new Uint16Array(decodeBase64(source.indices))
  const point = (vertex: number): Cinema2HumNVec3 => [positions[vertex * 3]!, positions[vertex * 3 + 1]!, positions[vertex * 3 + 2]!]
  const skinOf = (vertex: number): Skin => ({ a: skins[vertex * 3]!, b: skins[vertex * 3 + 1]!, w: skins[vertex * 3 + 2]! / 255 })
  const triangles: RawTriangle[] = []
  for (let offset = 0; offset < indices.length; offset += 3) {
    const [a, b, c] = [indices[offset]!, indices[offset + 1]!, indices[offset + 2]!]
    triangles.push({ p: [point(a), point(b), point(c)], s: [skinOf(a), skinOf(b), skinOf(c)], region: CINEMA2_HUMN_REGION.skin, angle: [0, 0, 0] })
  }
  return triangles
}

/** Eyes: flat discs sitting in the sockets, facing forward, drawn as concentric rings by the shader (region 1). */
function eyeTriangles(): RawTriangle[] {
  const head: Skin = { a: CINEMA2_HUMN_BONE.head, b: CINEMA2_HUMN_BONE.head, w: 0 }
  const triangles: RawTriangle[] = []
  const segments = 10
  for (const eye of CINEMA2_HUMN_FIGURE_EYES) {
    const [cx, cy, cz] = eye.center
    const rim: Cinema2HumNVec3[] = []
    for (let k = 0; k < segments; k += 1) {
      const angle = (k / segments) * Math.PI * 2
      rim.push([cx + Math.cos(angle) * eye.radius * 1.15, cy + Math.sin(angle) * eye.radius * 0.8, cz])
    }
    for (let k = 0; k < segments; k += 1) {
      const next = (k + 1) % segments
      triangles.push({ p: [eye.center, rim[k]!, rim[next]!], s: [head, head, head], region: CINEMA2_HUMN_REGION.eye, angle: [(k + 0.5) / segments, k / segments, (k + 1) / segments] })
    }
  }
  return triangles
}

function pack(triangles: readonly RawTriangle[], density: Cinema2HumNMeshDensity): Cinema2HumNMesh {
  const vertexKeys = new Map<string, number>()
  const keyOf = (p: Cinema2HumNVec3): number => {
    const key = `${Math.round(p[0] * 2000)},${Math.round(p[1] * 2000)},${Math.round(p[2] * 2000)}`
    let id = vertexKeys.get(key)
    if (id === undefined) {
      id = vertexKeys.size + 1
      vertexKeys.set(key, id)
    }
    return id
  }
  const edgeInfo = (a: Cinema2HumNVec3, b: Cinema2HumNVec3): number => {
    const ka = keyOf(a)
    const kb = keyOf(b)
    const lo = Math.min(ka, kb)
    const hi = Math.max(ka, kb)
    const rank = hash01(lo * 73856093 + hi * 19349663)
    // Both triangles that share an edge must measure along it from the same end, so the flag says whether this triangle walks it lo -> hi.
    return Math.min(rank, 0.9999) + (ka <= kb ? 0 : 2)
  }

  const data = new Float32Array(triangles.length * 3 * CINEMA2_HUMN_VERTEX_FLOATS)
  let offset = 0
  triangles.forEach((triangle, index) => {
    const [a, b, c] = triangle.p
    const normal = normalize(cross(sub(b, a), sub(c, a)))
    const center = centroid(triangle.p)
    const rank = hash01(index * 2654435761 + 17)
    const seed = hash01(index * 40503 + 91)
    // Edge k is the one opposite vertex k.
    const edges: readonly [number, number, number] = [edgeInfo(b, c), edgeInfo(c, a), edgeInfo(a, b)]
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const p = triangle.p[vertex]!
      const s = triangle.s[vertex]!
      const values = [
        p[0], p[1], p[2],
        normal[0], normal[1], normal[2],
        s.a, s.b, s.w,
        center[0], center[1], center[2],
        rank, triangle.region, seed, triangle.angle[vertex]!,
        edges[0], edges[1], edges[2],
      ]
      data.set(values, offset)
      offset += CINEMA2_HUMN_VERTEX_FLOATS
    }
  })
  return Object.freeze({ density, triangleCount: triangles.length, vertexCount: triangles.length * 3, data })
}

const cache = new Map<Cinema2HumNMeshDensity, Cinema2HumNMesh>()

/** Density 1 is the standard faceted figure (about 2,600 facets); density 2 is the same figure at about 6,200. */
export function buildCinema2HumNMesh(density: Cinema2HumNMeshDensity = 1): Cinema2HumNMesh {
  const cached = cache.get(density)
  if (cached) return cached
  const mesh = pack([...figureTriangles(density), ...eyeTriangles()], density)
  cache.set(density, mesh)
  return mesh
}
