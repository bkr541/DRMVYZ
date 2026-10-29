export type InertiaProofPose = 'coherent' | 'rotated' | 'folded'
export type InertiaPart = 'all' | 'lattice' | 'core' | 'anchors' | 'ribs'
export const INERTIA_PROOF_POSES = ['coherent', 'rotated', 'folded'] as const
export const INERTIA_PARTS = ['all', 'lattice', 'core', 'anchors', 'ribs'] as const

export interface InertiaGeometry {
  /** Interleaved world xyz + role (0 lattice, 1 core, 2 anchor), sorted back to front. */
  points: Float32Array
  /** World-space start/end pairs, six floats per rib. */
  ribs: Float32Array
  counts: { lattice: number; core: number; anchors: number; ribs: number }
  maxRadius: number
}

type Point = [number, number, number]
// Tuned from the specification's initial 0.45 after reference/canvas comparison.
const HALF_EXTENT = 0.50

/** One static deformation shared by lattice, ribs and anchors; no clock or music input. */
function cagePosition(point: Point, pose: InertiaProofPose): Point {
  let [x, y, z] = point
  if (pose === 'folded') {
    const angle = 1.1 * Math.sin(y / HALF_EXTENT * Math.PI * 0.75)
    const c = Math.cos(angle), s = Math.sin(angle)
    ;[x, z] = [c * x + s * z, -s * x + c * z]
    x += 0.055 * Math.sin(y / HALF_EXTENT * Math.PI * 2)
  }
  const degrees = pose === 'rotated' ? [-12, 32, -18] : [15, -20, 20]
  const [rx, ry, rz] = degrees.map(value => value * Math.PI / 180)
  ;[y, z] = [Math.cos(rx) * y - Math.sin(rx) * z, Math.sin(rx) * y + Math.cos(rx) * z]
  ;[x, z] = [Math.cos(ry) * x + Math.sin(ry) * z, -Math.sin(ry) * x + Math.cos(ry) * z]
  ;[x, y] = [Math.cos(rz) * x - Math.sin(rz) * y, Math.sin(rz) * x + Math.cos(rz) * y]
  return [x, y, z]
}

function facePoint(axis: number, side: number, u: number, v: number): Point {
  const p: Point = [0, 0, 0]
  p[axis] = side * HALF_EXTENT
  p[(axis + 1) % 3] = u * HALF_EXTENT
  p[(axis + 2) % 3] = v * HALF_EXTENT
  return p
}

/** Surface sampling remains regular at each tier, with unique borders and poles. */
export function buildCinema2InertiaGeometry(
  pose: InertiaProofPose = 'coherent', quality: 'low' | 'medium' | 'high' = 'medium', density = 0.8,
): InertiaGeometry {
  const baseRows = quality === 'low' ? 21 : quality === 'high' ? 41 : 33
  const rows = Math.max(9, Math.round((baseRows * Math.sqrt(Math.max(0.35, Math.min(1, density)) / 0.8) - 1) / 2) * 2 + 1)
  const longitudes = quality === 'low' ? 48 : quality === 'high' ? 80 : 64
  const latitudes = quality === 'low' ? 25 : quality === 'high' ? 41 : 33
  const points: number[][] = [], ribs: number[] = [], seen = new Set<string>()
  const counts = { lattice: 0, core: 0, anchors: 0, ribs: 0 }
  for (let axis = 0; axis < 3; axis++) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < rows; i++) for (let j = 0; j < rows; j++) {
        const key = [0, 0, 0]
        key[axis] = side < 0 ? 0 : rows - 1
        key[(axis + 1) % 3] = i
        key[(axis + 2) % 3] = j
        if (seen.has(key.join(','))) continue
        seen.add(key.join(','))
        const corner = key.every(value => value === 0 || value === rows - 1)
        const p = cagePosition(facePoint(axis, side, i / (rows - 1) * 2 - 1, j / (rows - 1) * 2 - 1), pose)
        points.push([...p, corner ? 2 : 0])
        if (corner) counts.anchors++; else counts.lattice++
      }
      // Short comb ribs along opposing face edges, not an opaque cube wireframe.
      for (const edge of [-1, 1]) for (let j = 0; j < rows - 1; j++) {
        const v = (j + 0.5) / (rows - 1) * 2 - 1
        ribs.push(...cagePosition(facePoint(axis, side, edge, v), pose))
        ribs.push(...cagePosition(facePoint(axis, side, edge * 0.82, v), pose))
        counts.ribs++
      }
    }
  }
  for (let lat = 0; lat < latitudes; lat++) {
    const theta = lat / (latitudes - 1) * Math.PI
    const pole = lat === 0 || lat === latitudes - 1
    for (let lon = 0; lon < (pole ? 1 : longitudes); lon++) {
      const phi = lon / longitudes * Math.PI * 2
      points.push([0.26 * Math.sin(theta) * Math.cos(phi), 0.26 * Math.cos(theta), 0.26 * Math.sin(theta) * Math.sin(phi), 1])
      counts.core++
    }
  }
  // A sampled silhouette meridian keeps the hollow sphere readable through the cage.
  // Half-step angles avoid duplicating the latitude lattice's poles/equator.
  for (let i = 0; i < longitudes * 2; i++) {
    const angle = (i + 0.5) / (longitudes * 2) * Math.PI * 2
    points.push([0.26 * Math.cos(angle), 0.26 * Math.sin(angle), 0, 1])
    counts.core++
  }
  points.sort((a, b) => a[2] - b[2])
  return {
    points: new Float32Array(points.flat()), ribs: new Float32Array(ribs), counts,
    maxRadius: Math.max(...points.map(p => Math.hypot(p[0], p[1], p[2]))),
  }
}
