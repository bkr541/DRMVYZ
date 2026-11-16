// Sound Drawing XY › WIREFRAME: the immutable source shape. A shape is the drawing's identity (the guide's "ShapeDocument"): its vertices,
// edges and faces never change while the figure performs. Everything the music does (placement, deformation, projection) is computed
// from it into separate working buffers, so the original can always be drawn again exactly. The shape is hashed when it is built; the
// hash is how tests prove a performance never touched it.
//
// A shape is a cluster of figures ("groups"). Each group is one solid: a tetrahedron, cube, octahedron, icosahedron, dodecahedron or a
// tesseract (a 4D hypercube, which carries a fourth coordinate per corner and is rotated in 4D before it is projected into 3D). All the
// platonic solids are scaled to the same circumradius as the cube, so a cluster of different solids still has a consistent weight.

export type WireKind = 'tetra' | 'cube' | 'octa' | 'icosa' | 'dodeca' | 'tesseract'
export const WIRE_KINDS: readonly WireKind[] = Object.freeze(['tetra', 'cube', 'octa', 'icosa', 'dodeca', 'tesseract'])

export interface WireGroup {
  id: string
  label: string
  kind: WireKind
  vertexStart: number
  vertexCount: number
  edgeStart: number
  edgeCount: number
  faceStart: number
  faceCount: number
  /** The nominal edge length of this solid, which every displacement limit is measured against. */
  edgeLength: number
}

export interface WireShape {
  readonly schemaVersion: 2
  readonly id: string
  /** A hash of every vertex, edge and face. Changing any of them changes it. */
  readonly sourceHash: string
  /** Group-local positions, three floats per vertex, each group centred on its own origin. */
  readonly vertices: Float32Array
  /** The fourth coordinate of each vertex (zero for the 3D solids; the tesseract's w). */
  readonly vertexW: Float32Array
  /** Pairs of global vertex indices. */
  readonly edges: Uint16Array
  /** All faces' corners (global vertex indices), wound counter-clockwise seen from outside; `faceOffsets` says where each face starts. */
  readonly faces: Uint16Array
  /** faceOffsets[f] .. faceOffsets[f + 1] is face f's range in `faces`. Length is faceCount + 1. */
  readonly faceOffsets: Uint16Array
  /** For each edge, the two faces that share it (-1 when it borders fewer). Used to find hidden edges. */
  readonly edgeFaces: Int16Array
  /** Which of the three screen axes an edge mostly lies along (0 x, 1 y, 2 z; a tesseract's w edges count as z). It decides which band drives the edge. */
  readonly edgeAxis: Uint8Array
  readonly groups: readonly WireGroup[]
  /** The nominal edge length of the first group (the core). */
  readonly edgeLength: number
}

/** FNV-1a over the shape's raw bytes. */
export function hashShapeData(vertices: Float32Array, edges: Uint16Array, faces: Uint16Array, vertexW?: Float32Array): string {
  let hash = 2166136261
  const arrays: ArrayBufferView[] = [vertices, edges, faces]
  if (vertexW) arrays.push(vertexW)
  for (const array of arrays) {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
    for (let i = 0; i < bytes.length; i++) { hash ^= bytes[i]; hash = Math.imul(hash, 16777619) }
    hash ^= 0xff; hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function shapeHash(shape: WireShape): string {
  return hashShapeData(shape.vertices, shape.edges, shape.faces, shape.vertexW)
}

// ── The solids ───────────────────────────────────────────────────────────────

/** A solid as plain data: corners (x, y, z, w), edges, and faces as corner loops (outward winding is fixed up afterwards). */
interface Solid {
  corners: number[][]
  edges: [number, number][]
  faces: number[][]
}

/** Circumradius every 3D solid is scaled to: the cube's, so a mixed cluster stays balanced. */
const RADIUS = Math.sqrt(3)

function normalise(corners: number[][], radius = RADIUS): number[][] {
  const r = Math.max(...corners.map(c => Math.hypot(c[0], c[1], c[2])))
  return corners.map(c => [c[0] / r * radius, c[1] / r * radius, c[2] / r * radius, c[3] ?? 0])
}

/** Every pair of corners at the shortest distance is an edge (true for all five platonic solids). */
function shortestEdges(corners: number[][]): [number, number][] {
  let shortest = Infinity
  const d = (a: number, b: number) => Math.hypot(corners[a][0] - corners[b][0], corners[a][1] - corners[b][1], corners[a][2] - corners[b][2], (corners[a][3] ?? 0) - (corners[b][3] ?? 0))
  for (let a = 0; a < corners.length; a++) for (let b = a + 1; b < corners.length; b++) shortest = Math.min(shortest, d(a, b))
  const out: [number, number][] = []
  for (let a = 0; a < corners.length; a++) for (let b = a + 1; b < corners.length; b++) if (Math.abs(d(a, b) - shortest) < shortest * 1e-3) out.push([a, b])
  return out
}

/**
 * Faces of a convex solid with equal faces: a face is a set of corners lying in one plane that no corner of the solid lies beyond. The
 * planes are found from every triple of corners (small solids, built once), deduplicated by their normal and offset.
 */
function convexFaces(corners: number[][], edges: [number, number][]): number[][] {
  const n = corners.length
  const adjacency = Array.from({ length: n }, () => new Set<number>())
  for (const [a, b] of edges) { adjacency[a].add(b); adjacency[b].add(a) }
  const planes = new Map<string, number[]>()
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) {
    const u = [0, 1, 2].map(i => corners[b][i] - corners[a][i]), v = [0, 1, 2].map(i => corners[c][i] - corners[a][i])
    let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0]
    const length = Math.hypot(nx, ny, nz)
    if (length < 1e-6) continue
    nx /= length; ny /= length; nz /= length
    let offset = nx * corners[a][0] + ny * corners[a][1] + nz * corners[a][2]
    if (offset < 0) { nx = -nx; ny = -ny; nz = -nz; offset = -offset }
    let beyond = false
    const on: number[] = []
    for (let i = 0; i < n; i++) {
      const side = nx * corners[i][0] + ny * corners[i][1] + nz * corners[i][2] - offset
      if (side > 1e-4) { beyond = true; break }
      if (Math.abs(side) <= 1e-4) on.push(i)
    }
    if (beyond || on.length < 3) continue
    planes.set(on.join(','), on)
  }
  // Order each face's corners around its edges (a loop through adjacent corners of the face).
  const faces: number[][] = []
  for (const on of planes.values()) {
    const inside = new Set(on)
    const loop = [on[0]]
    let previous = -1
    while (loop.length < on.length) {
      const here = loop[loop.length - 1]
      const next = [...adjacency[here]].find(x => inside.has(x) && x !== previous && !loop.includes(x))
      if (next === undefined) break
      previous = here; loop.push(next)
    }
    if (loop.length === on.length) faces.push(loop)
  }
  return faces
}

function platonic(corners: number[][]): Solid {
  const scaled = normalise(corners)
  const edges = shortestEdges(scaled)
  return { corners: scaled, edges, faces: convexFaces(scaled, edges) }
}

const PHI = (1 + Math.sqrt(5)) / 2

function buildSolid(kind: WireKind): Solid {
  switch (kind) {
    case 'tetra': return platonic([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]])
    case 'cube': {
      const corners: number[][] = []
      for (let bits = 0; bits < 8; bits++) corners.push([bits & 1 ? 1 : -1, bits & 2 ? 1 : -1, bits & 4 ? 1 : -1])
      return platonic(corners)
    }
    case 'octa': return platonic([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]])
    case 'icosa': {
      const corners: number[][] = []
      for (const a of [-1, 1]) for (const b of [-PHI, PHI]) corners.push([0, a, b], [a, b, 0], [b, 0, a])
      return platonic(corners)
    }
    case 'dodeca': {
      const corners: number[][] = []
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) corners.push([x, y, z])
      for (const a of [-1, 1]) for (const b of [-1, 1]) corners.push([0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [b * PHI, 0, a / PHI])
      return platonic(corners)
    }
    case 'tesseract': {
      // Sixteen corners (±1, ±1, ±1, ±1); every pair that differs in exactly one coordinate is an edge (32 in all). Its faces are the 24 squares
      // that differ in two coordinates, but a 4D figure projected into 3D has no meaningful "front", so it carries no faces and no edge is hidden.
      const corners: number[][] = []
      for (let bits = 0; bits < 16; bits++) corners.push([bits & 1 ? 1 : -1, bits & 2 ? 1 : -1, bits & 4 ? 1 : -1, bits & 8 ? 1 : -1].map(v => v * RADIUS / 2))
      const edges: [number, number][] = []
      for (let a = 0; a < 16; a++) for (let bit = 0; bit < 4; bit++) { const b = a ^ (1 << bit); if (a < b) edges.push([a, b]) }
      return { corners, edges, faces: [] }
    }
  }
}

/** Orders a face's corners so its normal points away from the solid's centre. */
function outward(corners: number[][], loop: number[]): number[] {
  const [a, b, c] = [corners[loop[0]], corners[loop[1]], corners[loop[2]]]
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]]
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  const centre = loop.reduce((sum, i) => [sum[0] + corners[i][0], sum[1] + corners[i][1], sum[2] + corners[i][2]], [0, 0, 0])
  return n[0] * centre[0] + n[1] * centre[1] + n[2] * centre[2] > 0 ? loop : [...loop].reverse()
}

/** Each solid's data, built once. */
const SOLIDS: Readonly<Record<WireKind, Solid>> = (() => {
  const out = {} as Record<WireKind, Solid>
  for (const kind of WIRE_KINDS) {
    const solid = buildSolid(kind)
    out[kind] = { ...solid, faces: solid.faces.map(loop => outward(solid.corners, loop)) }
  }
  return Object.freeze(out)
})()

export function wireSolidCounts(kind: WireKind): { vertices: number; edges: number; faces: number } {
  const s = SOLIDS[kind]
  return { vertices: s.corners.length, edges: s.edges.length, faces: s.faces.length }
}

export const MAX_WIRE_CUBES = 5
/** The most corners and edges one group can have (the dodecahedron's 20 and the tesseract's 32), for sizing working buffers. */
export const MAX_GROUP_VERTICES = 20
export const MAX_GROUP_EDGES = 32

const GROUP_LABELS: Record<WireKind, string> = { tetra: 'Tetrahedron', cube: 'Cube', octa: 'Octahedron', icosa: 'Icosahedron', dodeca: 'Dodecahedron', tesseract: 'Tesseract' }

/** The figure types the Figure setting offers, and what each one is made of (core first, then the satellites in order). */
export type WireFigureId = 'cubes' | 'solids' | 'tesseract'
export const WIRE_FIGURES: Readonly<Record<WireFigureId, readonly WireKind[]>> = Object.freeze({
  cubes: ['cube', 'cube', 'cube', 'cube', 'cube'],
  solids: ['dodeca', 'tetra', 'octa', 'icosa', 'cube'],
  tesseract: ['tesseract', 'octa', 'tetra', 'cube', 'icosa'],
})

/**
 * A cluster of solids: one core and up to four satellites, each its own group so its placement can move without touching the others;
 * the shape itself is the same however the music treats it.
 */
export function buildCluster(kinds: readonly WireKind[], id = 'cluster'): WireShape {
  const list = kinds.slice(0, MAX_WIRE_CUBES)
  const solids = list.map(kind => SOLIDS[kind])
  const vertexTotal = solids.reduce((sum, s) => sum + s.corners.length, 0)
  const edgeTotal = solids.reduce((sum, s) => sum + s.edges.length, 0)
  const faceTotal = solids.reduce((sum, s) => sum + s.faces.length, 0)
  const faceCorners = solids.reduce((sum, s) => sum + s.faces.reduce((n, f) => n + f.length, 0), 0)
  const vertices = new Float32Array(vertexTotal * 3), vertexW = new Float32Array(vertexTotal)
  const edges = new Uint16Array(edgeTotal * 2), faces = new Uint16Array(faceCorners)
  const faceOffsets = new Uint16Array(faceTotal + 1), edgeFaces = new Int16Array(edgeTotal * 2).fill(-1), edgeAxis = new Uint8Array(edgeTotal)
  const groups: WireGroup[] = []
  let v = 0, e = 0, f = 0, c = 0
  list.forEach((kind, k) => {
    const solid = solids[k]
    const vBase = v, eBase = e, fBase = f
    solid.corners.forEach((corner, i) => { vertices.set([corner[0], corner[1], corner[2]], (vBase + i) * 3); vertexW[vBase + i] = corner[3] ?? 0 })
    solid.faces.forEach(loop => { faceOffsets[f] = c; for (const i of loop) faces[c++] = vBase + i; f++ })
    faceOffsets[f] = c
    solid.edges.forEach(([a, b], i) => {
      edges[(eBase + i) * 2] = vBase + a; edges[(eBase + i) * 2 + 1] = vBase + b
      // An edge borders the faces that contain both of its corners.
      let slot = 0
      solid.faces.forEach((loop, fi) => { if (loop.includes(a) && loop.includes(b) && slot < 2) edgeFaces[(eBase + i) * 2 + slot++] = fBase + fi })
      // The axis it mostly lies along: the largest of |dx|, |dy|, |dz|, |dw| (w edges are drawn with the z group).
      const d = [0, 1, 2, 3].map(j => Math.abs((solid.corners[a][j] ?? 0) - (solid.corners[b][j] ?? 0)))
      const best = d.indexOf(Math.max(...d))
      edgeAxis[eBase + i] = best === 3 ? 2 : best
    })
    const length = Math.hypot(...[0, 1, 2, 3].map(j => (solid.corners[solid.edges[0][0]][j] ?? 0) - (solid.corners[solid.edges[0][1]][j] ?? 0)))
    groups.push({
      id: k === 0 ? 'core' : `satellite-${k}`, label: `${k === 0 ? 'Core' : `Satellite ${k}`} ${GROUP_LABELS[kind].toLowerCase()}`, kind,
      vertexStart: vBase, vertexCount: solid.corners.length, edgeStart: eBase, edgeCount: solid.edges.length, faceStart: fBase, faceCount: solid.faces.length, edgeLength: length,
    })
    v += solid.corners.length; e += solid.edges.length
  })
  return Object.freeze({
    schemaVersion: 2 as const, id, sourceHash: hashShapeData(vertices, edges, faces, vertexW),
    vertices, vertexW, edges, faces, faceOffsets, edgeFaces, edgeAxis, groups: Object.freeze(groups), edgeLength: groups[0]?.edgeLength ?? 2,
  })
}

/** The figure's cluster, built once per figure. */
const CLUSTERS = new Map<WireFigureId, WireShape>()
export function buildFigure(figure: WireFigureId): WireShape {
  let shape = CLUSTERS.get(figure)
  if (!shape) { shape = buildCluster(WIRE_FIGURES[figure], figure); CLUSTERS.set(figure, shape) }
  return shape
}

/** The original cube cluster (kept so the earlier behaviour and tests have a name for it). */
export function buildCubeCluster(cubes = MAX_WIRE_CUBES): WireShape {
  return buildCluster(WIRE_FIGURES.cubes.slice(0, Math.max(1, Math.min(MAX_WIRE_CUBES, Math.round(cubes)))), 'cube-cluster')
}

/** The edges of the first `groups` groups, as global edge indices. */
export function edgesOfGroups(shape: WireShape, groups: number): Uint16Array {
  const last = shape.groups[Math.min(groups, shape.groups.length) - 1]
  return shape.edges.slice(0, (last.edgeStart + last.edgeCount) * 2)
}

/** The number of corners in the first `groups` groups. */
export function verticesOfGroups(shape: WireShape, groups: number): number {
  const last = shape.groups[Math.min(groups, shape.groups.length) - 1]
  return last.vertexStart + last.vertexCount
}
