// Sound Drawing XY › WIREFRAME: the immutable source shape. A shape is the drawing's identity (the guide's "ShapeDocument"): its vertices,
// edges and faces never change while the figure performs. Everything the music does (placement, deformation, projection) is computed
// from it into separate working buffers, so the original can always be drawn again exactly. The shape is hashed when it is built; the
// hash is how tests prove a performance never touched it.

export interface WireGroup {
  id: string
  label: string
  vertexStart: number
  vertexCount: number
  edgeStart: number
  edgeCount: number
  faceStart: number
  faceCount: number
}

export interface WireShape {
  readonly schemaVersion: 1
  readonly id: string
  /** A hash of every vertex, edge and face. Changing any of them changes it. */
  readonly sourceHash: string
  /** Group-local positions, three floats per vertex, each group centred on its own origin. */
  readonly vertices: Float32Array
  /** Pairs of global vertex indices. */
  readonly edges: Uint16Array
  /** Quads of global vertex indices, wound counter-clockwise seen from outside. */
  readonly faces: Uint16Array
  /** For each edge, the two faces that share it (-1 when it borders fewer). Used to find hidden edges. */
  readonly edgeFaces: Int16Array
  readonly groups: readonly WireGroup[]
  /** The nominal edge length of the base cube, which every displacement limit is measured against. */
  readonly edgeLength: number
}

/** FNV-1a over the shape's raw bytes. */
export function hashShapeData(vertices: Float32Array, edges: Uint16Array, faces: Uint16Array): string {
  let hash = 2166136261
  for (const array of [vertices, edges, faces] as const) {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
    for (let i = 0; i < bytes.length; i++) { hash ^= bytes[i]; hash = Math.imul(hash, 16777619) }
    hash ^= 0xff; hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function shapeHash(shape: WireShape): string {
  return hashShapeData(shape.vertices, shape.edges, shape.faces)
}

/** A cube's corners by bit: bit 0 is +x, bit 1 is +y, bit 2 is +z. */
const CUBE_EDGE_PAIRS: readonly (readonly [number, number])[] = (() => {
  const pairs: [number, number][] = []
  for (let a = 0; a < 8; a++) for (let bit = 0; bit < 3; bit++) { const b = a ^ (1 << bit); if (a < b) pairs.push([a, b]) }
  return pairs
})()
/** Each face as four corners around it; outward winding is fixed up below by checking the normal. */
const CUBE_FACE_LOOPS: readonly (readonly [number, number, number, number])[] = [
  [1, 3, 7, 5], [0, 4, 6, 2], // +x, -x
  [2, 6, 7, 3], [0, 1, 5, 4], // +y, -y
  [4, 5, 7, 6], [0, 2, 3, 1], // +z, -z
]

function corner(bits: number): [number, number, number] {
  return [bits & 1 ? 1 : -1, bits & 2 ? 1 : -1, bits & 4 ? 1 : -1]
}

/** Orders a face's corners so its normal points away from the cube's centre. */
function outwardLoop(loop: readonly [number, number, number, number]): [number, number, number, number] {
  const [a, b, c] = [corner(loop[0]), corner(loop[1]), corner(loop[2])]
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]]
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  const centre = loop.reduce((sum, bits) => { const p = corner(bits); return [sum[0] + p[0], sum[1] + p[1], sum[2] + p[2]] }, [0, 0, 0])
  return n[0] * centre[0] + n[1] * centre[1] + n[2] * centre[2] > 0 ? [loop[0], loop[1], loop[2], loop[3]] : [loop[3], loop[2], loop[1], loop[0]]
}

export const MAX_WIRE_CUBES = 5

/**
 * A cluster of cubes: one core and up to four satellites. Each cube is its own group so its placement can move without touching the
 * others; the shape itself is the same however the music treats it.
 */
export function buildCubeCluster(cubes = MAX_WIRE_CUBES): WireShape {
  const count = Math.max(1, Math.min(MAX_WIRE_CUBES, Math.round(cubes)))
  const vertices = new Float32Array(count * 8 * 3)
  const edges = new Uint16Array(count * CUBE_EDGE_PAIRS.length * 2)
  const faces = new Uint16Array(count * CUBE_FACE_LOOPS.length * 4)
  const edgeFaces = new Int16Array(count * CUBE_EDGE_PAIRS.length * 2).fill(-1)
  const groups: WireGroup[] = []
  const loops = CUBE_FACE_LOOPS.map(outwardLoop)
  for (let k = 0; k < count; k++) {
    const vBase = k * 8, eBase = k * CUBE_EDGE_PAIRS.length, fBase = k * loops.length
    for (let b = 0; b < 8; b++) { const [x, y, z] = corner(b); vertices.set([x, y, z], (vBase + b) * 3) }
    CUBE_EDGE_PAIRS.forEach(([a, b], e) => { edges[(eBase + e) * 2] = vBase + a; edges[(eBase + e) * 2 + 1] = vBase + b })
    loops.forEach((loop, f) => { for (let i = 0; i < 4; i++) faces[(fBase + f) * 4 + i] = vBase + loop[i] })
    // An edge borders the faces that contain both of its corners.
    CUBE_EDGE_PAIRS.forEach(([a, b], e) => {
      let slot = 0
      loops.forEach((loop, f) => { if (loop.includes(a) && loop.includes(b) && slot < 2) edgeFaces[(eBase + e) * 2 + slot++] = fBase + f })
    })
    groups.push({ id: k === 0 ? 'core' : `satellite-${k}`, label: k === 0 ? 'Core cube' : `Satellite ${k}`, vertexStart: vBase, vertexCount: 8, edgeStart: eBase, edgeCount: CUBE_EDGE_PAIRS.length, faceStart: fBase, faceCount: loops.length })
  }
  return Object.freeze({
    schemaVersion: 1 as const, id: 'cube-cluster', sourceHash: hashShapeData(vertices, edges, faces),
    vertices, edges, faces, edgeFaces, groups: Object.freeze(groups), edgeLength: 2,
  })
}

/** The edges of the first `cubes` groups, as global edge indices. */
export function edgesOfGroups(shape: WireShape, cubes: number): Uint16Array {
  const last = shape.groups[Math.min(cubes, shape.groups.length) - 1]
  return shape.edges.slice(0, (last.edgeStart + last.edgeCount) * 2)
}
