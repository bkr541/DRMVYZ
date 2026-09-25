/**
 * HUM:N figure mesh: a low-poly humanoid (head, neck, torso, arms, hands) generated in code, so the whole character is deterministic, needs no
 * shipped model file and no licence. Units are metres, +Y up, the figure faces +Z (toward the camera).
 *
 * The mesh is triangle-soup (three vertices per triangle) because every triangle is shaded, filled and displaced on its own. Each vertex carries
 * a two-bone skin (bone A, bone B, weight of B) for the pose rig, its triangle's bind-pose centre and normal, and per-triangle / per-edge stable
 * random numbers so fills, fragmentation and jitter pick the same triangles frame after frame.
 */

export type Cinema2HumNVec3 = readonly [number, number, number]

export const CINEMA2_HUMN_BONE = Object.freeze({
  root: 0,
  spine: 1,
  neck: 2,
  head: 3,
  leftUpperArm: 4,
  leftForearm: 5,
  leftHand: 6,
  rightUpperArm: 7,
  rightForearm: 8,
  rightHand: 9,
} as const)

export const CINEMA2_HUMN_BONE_COUNT = 10

/** Bind-pose joint positions. "Left"/"right" are the viewer's left (-X) and right (+X). */
export const CINEMA2_HUMN_BONE_PIVOTS: readonly Cinema2HumNVec3[] = Object.freeze([
  [0, 0, 0],
  [0, 0.22, 0],
  [0, 0.545, 0],
  [0, 0.585, 0],
  [-0.2, 0.495, 0],
  [-0.245, 0.209, 0],
  [-0.271, -0.05, 0],
  [0.2, 0.495, 0],
  [0.245, 0.209, 0],
  [0.271, -0.05, 0],
] as const)

export const CINEMA2_HUMN_BONE_PARENTS: readonly number[] = Object.freeze([-1, 0, 1, 2, 1, 4, 5, 1, 7, 8])

/** Per-triangle material region: 0 = skin facet, 1 = eye (drawn as concentric rings). */
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

interface Ring {
  pts: Cinema2HumNVec3[]
  skin: Skin[]
}

interface RawTriangle {
  p: [Cinema2HumNVec3, Cinema2HumNVec3, Cinema2HumNVec3]
  s: [Skin, Skin, Skin]
  region: number
  /** Interior point the outward normal must point away from (fixes winding). */
  inside: Cinema2HumNVec3
  /** Fan angle per vertex (eye discs use it for spokes). */
  angle: [number, number, number]
}

const B = CINEMA2_HUMN_BONE

const HEAD_SCALE = 1.4
/** Hands are drawn larger than life so a reaching hand reads from across the frame. */
const HAND_SCALE = 1.3
const HEAD_PIVOT_Y = 0.6

function hash01(seed: number): number {
  let x = (Math.trunc(seed) ^ 0x9e3779b9) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

const add = (a: Cinema2HumNVec3, b: Cinema2HumNVec3): Cinema2HumNVec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: Cinema2HumNVec3, b: Cinema2HumNVec3): Cinema2HumNVec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: Cinema2HumNVec3, s: number): Cinema2HumNVec3 => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a: Cinema2HumNVec3, b: Cinema2HumNVec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Cinema2HumNVec3, b: Cinema2HumNVec3): Cinema2HumNVec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const normalize = (a: Cinema2HumNVec3): Cinema2HumNVec3 => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / length, a[1] / length, a[2] / length]
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerpV = (a: Cinema2HumNVec3, b: Cinema2HumNVec3, t: number): Cinema2HumNVec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
const gauss = (distance: number, sigma: number) => Math.exp(-(distance * distance) / (sigma * sigma))
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
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

const skin = (a: number, b: number = a, w = 0): Skin => ({ a, b, w })

// ── Head ────────────────────────────────────────────────────────────────────

/** Head cross-section by height: [y, half width, half depth, centre z]. */
const HEAD_PROFILE: readonly (readonly [number, number, number, number])[] = [
  [0.86, 0.02, 0.03, -0.012],
  [0.845, 0.047, 0.058, -0.012],
  [0.815, 0.08, 0.09, -0.01],
  [0.78, 0.092, 0.102, -0.006],
  [0.762, 0.095, 0.104, -0.004],
  [0.742, 0.095, 0.102, -0.002],
  [0.712, 0.093, 0.098, -0.002],
  [0.69, 0.088, 0.094, -0.001],
  [0.665, 0.08, 0.088, 0],
  [0.645, 0.072, 0.082, 0.002],
  [0.622, 0.06, 0.07, 0.008],
  [0.6, 0.05, 0.06, 0.006],
]

const HEAD_LEVELS: readonly number[] = [0.845, 0.81, 0.775, 0.742, 0.708, 0.68, 0.652, 0.625, 0.6]
const HEAD_CROWN: Cinema2HumNVec3 = [0, 0.868, -0.012]

function profileAt(y: number): readonly [number, number, number] {
  for (let index = 0; index < HEAD_PROFILE.length - 1; index += 1) {
    const upper = HEAD_PROFILE[index]!
    const lower = HEAD_PROFILE[index + 1]!
    if (y <= upper[0] && y >= lower[0]) {
      const t = (upper[0] - y) / (upper[0] - lower[0])
      return [lerp(upper[1], lower[1], t), lerp(upper[2], lower[2], t), lerp(upper[3], lower[3], t)]
    }
  }
  const edge = y > HEAD_PROFILE[0]![0] ? HEAD_PROFILE[0]! : HEAD_PROFILE[HEAD_PROFILE.length - 1]!
  return [edge[1], edge[2], edge[3]]
}

const NOSE_RIDGE: readonly (readonly [number, number, number])[] = [
  [0.79, 0, 0.008],
  [0.775, 0.004, 0.009],
  [0.742, 0.012, 0.011],
  [0.708, 0.026, 0.015],
  [0.68, 0.04, 0.024],
  [0.652, 0.014, 0.03],
  [0.625, 0, 0.03],
]

function noseAt(y: number): readonly [number, number] {
  for (let index = 0; index < NOSE_RIDGE.length - 1; index += 1) {
    const upper = NOSE_RIDGE[index]!
    const lower = NOSE_RIDGE[index + 1]!
    if (y <= upper[0] && y >= lower[0]) {
      const t = (upper[0] - y) / (upper[0] - lower[0])
      return [lerp(upper[1], lower[1], t), lerp(upper[2], lower[2], t)]
    }
  }
  return [0, 0.03]
}

/** Forward relief of the face at (x, y): brow ridge, eye sockets, nose, cheekbones, lips, chin. */
function faceRelief(x: number, y: number): number {
  const ax = Math.abs(x)
  const [noseHeight, noseWidth] = noseAt(y)
  let z = noseHeight * 1.3 * gauss(x, noseWidth)
  z += 0.015 * gauss(y - 0.772, 0.012) * gauss(ax, 0.06)
  z -= 0.014 * gauss(y - 0.742, 0.013) * gauss(ax - 0.045, 0.02)
  z += 0.012 * gauss(y - 0.708, 0.018) * gauss(ax - 0.08, 0.024)
  z -= 0.007 * gauss(y - 0.665, 0.02) * gauss(ax - 0.055, 0.022)
  z += 0.012 * gauss(y - 0.652, 0.012) * gauss(x, 0.032)
  z += 0.028 * gauss(y - 0.622, 0.014) * gauss(x, 0.034)
  return z
}

function headPoint(y: number, theta: number): Cinema2HumNVec3 {
  const [rx, rz, cz] = profileAt(y)
  const s = Math.sin(theta)
  const c = Math.cos(theta)
  const x = rx * s
  let z = cz + rz * c
  z += faceRelief(x, y) * smoothstep(-0.15, 0.35, c)
  return [x, y, z]
}

function headSurfaceZ(x: number, y: number): number {
  const [rx, rz, cz] = profileAt(y)
  const ratio = Math.min(Math.abs(x) / rx, 0.98)
  return cz + rz * Math.sqrt(1 - ratio * ratio) + faceRelief(x, y)
}

// ── Builders ────────────────────────────────────────────────────────────────

class Builder {
  readonly triangles: RawTriangle[] = []
  /** Applied to every point of the part being built (the head is scaled up about the neck for a heroic silhouette). */
  pointMap: ((point: Cinema2HumNVec3) => Cinema2HumNVec3) | null = null

  triangle(a0: Cinema2HumNVec3, sa: Skin, b0: Cinema2HumNVec3, sb: Skin, c0: Cinema2HumNVec3, sc: Skin, inside0: Cinema2HumNVec3, region = 0, angles: [number, number, number] = [0, 0, 0]): void {
    const map = this.pointMap
    const a = map ? map(a0) : a0
    const b = map ? map(b0) : b0
    const c = map ? map(c0) : c0
    const inside = map ? map(inside0) : inside0
    const normal = cross(sub(b, a), sub(c, a))
    if (dot(normal, sub(centroid([a, b, c]), inside)) >= 0) {
      this.triangles.push({ p: [a, b, c], s: [sa, sb, sc], region, inside, angle: angles })
    } else {
      this.triangles.push({ p: [a, c, b], s: [sa, sc, sb], region, inside, angle: [angles[0], angles[2], angles[1]] })
    }
  }

  /** Triangle strip between two rings of equal size. */
  loft(a: Ring, b: Ring): void {
    const n = a.pts.length
    const inside = lerpV(centroid(a.pts), centroid(b.pts), 0.5)
    for (let k = 0; k < n; k += 1) {
      const j = (k + 1) % n
      this.triangle(a.pts[k]!, a.skin[k]!, b.pts[k]!, b.skin[k]!, b.pts[j]!, b.skin[j]!, inside)
      this.triangle(a.pts[k]!, a.skin[k]!, b.pts[j]!, b.skin[j]!, a.pts[j]!, a.skin[j]!, inside)
    }
  }

  fan(ring: Ring, apex: Cinema2HumNVec3, apexSkin: Skin, inside?: Cinema2HumNVec3): void {
    const n = ring.pts.length
    const reference = inside ?? lerpV(centroid(ring.pts), apex, -0.6)
    for (let k = 0; k < n; k += 1) {
      const j = (k + 1) % n
      this.triangle(ring.pts[k]!, ring.skin[k]!, ring.pts[j]!, ring.skin[j]!, apex, apexSkin, reference)
    }
  }
}

function circleRing(center: Cinema2HumNVec3, u: Cinema2HumNVec3, v: Cinema2HumNVec3, ru: number, rv: number, n: number, skins: Skin | Skin[], phase = 0): Ring {
  const pts: Cinema2HumNVec3[] = []
  const list: Skin[] = []
  for (let k = 0; k < n; k += 1) {
    const angle = phase + (k / n) * Math.PI * 2
    pts.push(add(center, add(scale(u, Math.cos(angle) * ru), scale(v, Math.sin(angle) * rv))))
    list.push(Array.isArray(skins) ? skins[k]! : skins)
  }
  return { pts, skin: list }
}

function rectRing(center: Cinema2HumNVec3, u: Cinema2HumNVec3, v: Cinema2HumNVec3, ru: number, rv: number, skins: Skin): Ring {
  const corners: readonly (readonly [number, number])[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  return {
    pts: corners.map(([su, sv]) => add(center, add(scale(u, su * ru), scale(v, sv * rv)))),
    skin: corners.map(() => skins),
  }
}

// ── Body parts ──────────────────────────────────────────────────────────────

function buildHead(builder: Builder, density: Cinema2HumNMeshDensity): void {
  const n = 12 * density
  const levels: number[] = []
  for (let index = 0; index < HEAD_LEVELS.length; index += 1) {
    levels.push(HEAD_LEVELS[index]!)
    if (density === 2 && index < HEAD_LEVELS.length - 1) levels.push((HEAD_LEVELS[index]! + HEAD_LEVELS[index + 1]!) / 2)
  }
  const rings: Ring[] = levels.map((y, index) => {
    const pts: Cinema2HumNVec3[] = []
    for (let k = 0; k < n; k += 1) pts.push(headPoint(y, (k / n) * Math.PI * 2))
    const bottom = index === levels.length - 1
    return { pts, skin: pts.map(() => (bottom ? skin(B.head, B.neck, 0.4) : skin(B.head))) }
  })
  const crownRing = rings[0]!
  builder.fan(crownRing, HEAD_CROWN, skin(B.head), [0, 0.76, -0.01])
  for (let index = 0; index < rings.length - 1; index += 1) builder.loft(rings[index]!, rings[index + 1]!)
  const last = rings[rings.length - 1]!
  builder.fan(last, [0, 0.598, 0.004], skin(B.head, B.neck, 0.4), [0, 0.76, -0.01])

  // Eyes: flat discs sitting in the sockets, drawn as concentric rings by the shader (region 1).
  for (const side of [-1, 1]) {
    const cx = side * 0.04
    const cy = 0.742
    const radius = 0.016
    const centerZ = headSurfaceZ(cx, cy) + 0.004
    const center: Cinema2HumNVec3 = [cx, cy, centerZ]
    const segments = 8
    const rimPoints: Cinema2HumNVec3[] = []
    for (let k = 0; k < segments; k += 1) {
      const angle = (k / segments) * Math.PI * 2
      const x = cx + Math.cos(angle) * radius * 1.1
      const y = cy + Math.sin(angle) * radius * 0.78
      rimPoints.push([x, y, headSurfaceZ(x, y) + 0.004])
    }
    for (let k = 0; k < segments; k += 1) {
      const j = (k + 1) % segments
      builder.triangle(center, skin(B.head), rimPoints[k]!, skin(B.head), rimPoints[j]!, skin(B.head), [cx, cy, -0.05], 1, [(k + 0.5) / segments, k / segments, (k + 1) / segments])
    }
  }

  // Ears: five-sided pyramids at the sides of the head.
  for (const side of [-1, 1]) {
    const y = 0.73
    const baseX = side * (profileAt(y)[0] - 0.004)
    const base: Cinema2HumNVec3[] = []
    for (let k = 0; k < 5; k += 1) {
      const angle = (k / 5) * Math.PI * 2
      base.push([baseX, y + Math.sin(angle) * 0.026, -0.004 + Math.cos(angle) * 0.016])
    }
    const ring: Ring = { pts: base, skin: base.map(() => skin(B.head)) }
    builder.fan(ring, [baseX + side * 0.016, y - 0.004, -0.01], skin(B.head), [side * 0.02, y, -0.004])
  }
}

function buildNeck(builder: Builder, density: Cinema2HumNMeshDensity): void {
  const n = 8 * density
  const up: Cinema2HumNVec3 = [1, 0, 0]
  const fwd: Cinema2HumNVec3 = [0, 0, 1]
  const spec: readonly (readonly [number, number, number, Skin])[] = [
    [0.53, 0.056, 0.054, skin(B.spine, B.neck, 0.6)],
    [0.565, 0.052, 0.05, skin(B.neck)],
    [0.605, 0.05, 0.05, skin(B.neck, B.head, 0.7)],
    [0.635, 0.048, 0.05, skin(B.head)],
  ]
  const rings = spec.map(([y, rx, rz, s]) => circleRing([0, y, 0.004], up, fwd, rx, rz, n, s, Math.PI / n))
  for (let index = 0; index < rings.length - 1; index += 1) builder.loft(rings[index]!, rings[index + 1]!)
  builder.fan(rings[rings.length - 1]!, [0, 0.64, 0.004], skin(B.head), [0, 0.58, 0])
}

function buildTorso(builder: Builder, density: Cinema2HumNMeshDensity): void {
  const n = 12 * density
  const up: Cinema2HumNVec3 = [1, 0, 0]
  const fwd: Cinema2HumNVec3 = [0, 0, 1]
  const spineSkin = skin(B.spine)
  // [y, half width, half depth, centre z, skin]
  const base: readonly (readonly [number, number, number, number, Skin])[] = [
    [0.0, 0.112, 0.08, 0, skin(B.root, B.spine, 0.5)],
    [0.16, 0.128, 0.088, 0, spineSkin],
    [0.31, 0.15, 0.097, 0.003, spineSkin],
    [0.405, 0.178, 0.103, 0.007, spineSkin],
    [0.465, 0.203, 0.099, 0.005, spineSkin],
    [0.5, 0.212, 0.092, 0.002, spineSkin],
    [0.528, 0.14, 0.078, 0, skin(B.spine, B.neck, 0.5)],
    [0.548, 0.078, 0.06, 0.002, skin(B.spine, B.neck, 0.6)],
    [0.56, 0.053, 0.05, 0.004, skin(B.spine, B.neck, 0.6)],
  ]
  const spec: (readonly [number, number, number, number, Skin])[] = []
  base.forEach((row, index) => {
    spec.push(row)
    const next = base[index + 1]
    if (density === 2 && next) spec.push([(row[0] + next[0]) / 2, (row[1] + next[1]) / 2, (row[2] + next[2]) / 2, (row[3] + next[3]) / 2, row[4]])
  })
  const rings = spec.map(([y, rx, rz, cz, s]) => circleRing([0, y, cz], up, fwd, rx, rz, n, s, Math.PI / n))
  for (let index = 0; index < rings.length - 1; index += 1) builder.loft(rings[index]!, rings[index + 1]!)
  builder.fan(rings[0]!, [0, -0.01, 0], skin(B.root), [0, 0.3, 0])
  builder.fan(rings[rings.length - 1]!, [0, 0.565, 0.004], skin(B.neck), [0, 0.3, 0])
}

function armFrame(direction: Cinema2HumNVec3): { u: Cinema2HumNVec3; v: Cinema2HumNVec3 } {
  const u = normalize(cross(direction, [0, 0, 1]))
  return { u, v: normalize(cross(direction, u)) }
}

function buildArm(builder: Builder, density: Cinema2HumNMeshDensity, side: -1 | 1): void {
  const n = 6 * density
  const upperBone = side < 0 ? B.leftUpperArm : B.rightUpperArm
  const foreBone = side < 0 ? B.leftForearm : B.rightForearm
  const handBone = side < 0 ? B.leftHand : B.rightHand
  const shoulder = CINEMA2_HUMN_BONE_PIVOTS[upperBone]!
  const elbow = CINEMA2_HUMN_BONE_PIVOTS[foreBone]!
  const wrist = CINEMA2_HUMN_BONE_PIVOTS[handBone]!
  const upperDir = normalize(sub(elbow, shoulder))
  const foreDir = normalize(sub(wrist, elbow))
  const upperFrame = armFrame(upperDir)
  const foreFrame = armFrame(foreDir)
  const rings: Ring[] = []
  const upperSpec: readonly (readonly [number, number, Skin])[] = [
    [0, 0.056, skin(B.spine, upperBone, 0.75)],
    [0.4, 0.054, skin(upperBone)],
    [0.8, 0.046, skin(upperBone)],
    [1, 0.043, skin(upperBone, foreBone, 0.5)],
  ]
  for (const [t, radius, s] of upperSpec) rings.push(circleRing(lerpV(shoulder, elbow, t), upperFrame.u, upperFrame.v, radius, radius, n, s))
  const foreSpec: readonly (readonly [number, number, Skin])[] = [
    [0.1, 0.043, skin(foreBone)],
    [0.5, 0.038, skin(foreBone)],
    [0.86, 0.031, skin(foreBone, handBone, 0.5)],
    [1, 0.028, skin(handBone)],
  ]
  for (const [t, radius, s] of foreSpec) rings.push(circleRing(lerpV(elbow, wrist, t), foreFrame.u, foreFrame.v, radius, radius, n, s))
  for (let index = 0; index < rings.length - 1; index += 1) builder.loft(rings[index]!, rings[index + 1]!)
  builder.fan(rings[0]!, add(shoulder, scale(upperDir, -0.05)), skin(upperBone), lerpV(shoulder, elbow, 0.5))
}

/**
 * A low-poly hand in its own frame (origin at the wrist, fingers along +Y, palm facing +Z), mapped into the figure's bind pose: fingers hang
 * along -Y and the palm faces the body.
 */
function buildHand(builder: Builder, side: -1 | 1): void {
  const handBone = side < 0 ? B.leftHand : B.rightHand
  const wrist = CINEMA2_HUMN_BONE_PIVOTS[handBone]!
  const ey: Cinema2HumNVec3 = [0, -1, 0]
  const ez: Cinema2HumNVec3 = [-side, 0, 0]
  const ex = cross(ey, ez)
  const map = (x: number, y: number, z: number): Cinema2HumNVec3 => add(wrist, add(add(scale(ex, x * HAND_SCALE), scale(ey, y * HAND_SCALE)), scale(ez, z * HAND_SCALE)))
  const s = skin(handBone)
  const rect = (y: number, halfWidth: number, halfThick: number, xOffset = 0, zOffset = 0): Ring => ({
    pts: ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([su, sv]) => map(xOffset + su * halfWidth, y, zOffset + sv * halfThick)),
    skin: [s, s, s, s],
  })

  const palm = [rect(0.0, 0.03, 0.014), rect(0.045, 0.038, 0.017), rect(0.088, 0.042, 0.014)]
  for (let index = 0; index < palm.length - 1; index += 1) builder.loft(palm[index]!, palm[index + 1]!)
  builder.fan(palm[2]!, map(0, 0.09, 0), s, map(0, 0.04, 0))
  builder.fan(palm[0]!, map(0, -0.005, 0), s, map(0, 0.04, 0))

  const finger = (x: number, length: number, splay: number, halfWidth: number): void => {
    const dirX = Math.sin(splay)
    const dirY = Math.cos(splay)
    const base = [x, 0.088]
    const at = (t: number, w: number, thick: number): Ring => {
      const cx = base[0]! + dirX * length * t
      const cy = base[1]! + dirY * length * t
      return {
        pts: ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([su, sv]) => map(cx + su * w * dirY, cy - su * w * dirX, sv * thick + (t > 0.5 ? 0.002 : 0))),
        skin: [s, s, s, s],
      }
    }
    const rings = [at(0, halfWidth, halfWidth), at(0.42, halfWidth * 0.92, halfWidth * 0.9), at(1, halfWidth * 0.62, halfWidth * 0.62)]
    for (let index = 0; index < rings.length - 1; index += 1) builder.loft(rings[index]!, rings[index + 1]!)
    builder.fan(rings[2]!, map(base[0]! + dirX * length * 1.06, base[1]! + dirY * length * 1.06, 0.002), s, map(base[0]! + dirX * length * 0.5, base[1]! + dirY * length * 0.5, 0))
  }
  // Fingers fan out slightly (index -> pinky), the thumb comes off the palm's side.
  finger(-0.03, 0.078, -0.12, 0.0085)
  finger(-0.01, 0.086, -0.03, 0.009)
  finger(0.011, 0.08, 0.04, 0.0088)
  finger(0.031, 0.064, 0.14, 0.0078)
  const thumbBase = [-0.038, 0.032]
  const thumbAngle = -0.85
  const thumbLength = 0.066
  const thumbAt = (t: number, w: number): Ring => {
    const cx = thumbBase[0]! + Math.sin(thumbAngle) * thumbLength * t
    const cy = thumbBase[1]! + Math.cos(thumbAngle) * thumbLength * t
    return {
      pts: ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([su, sv]) => map(cx + su * w * Math.cos(thumbAngle), cy - su * w * Math.sin(thumbAngle), sv * w + 0.006)),
      skin: [s, s, s, s],
    }
  }
  const thumb = [thumbAt(0, 0.011), thumbAt(0.45, 0.0098), thumbAt(1, 0.0075)]
  for (let index = 0; index < thumb.length - 1; index += 1) builder.loft(thumb[index]!, thumb[index + 1]!)
  builder.fan(thumb[2]!, map(thumbBase[0]! + Math.sin(thumbAngle) * thumbLength * 1.08, thumbBase[1]! + Math.cos(thumbAngle) * thumbLength * 1.08, 0.006), s, map(thumbBase[0]! + Math.sin(thumbAngle) * thumbLength * 0.5, thumbBase[1]! + Math.cos(thumbAngle) * thumbLength * 0.5, 0.004))
}

// ── Packing ─────────────────────────────────────────────────────────────────

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

/** Density 1 is the authored low-poly figure; density 2 doubles the segments around and along every part. */
export function buildCinema2HumNMesh(density: Cinema2HumNMeshDensity = 1): Cinema2HumNMesh {
  const cached = cache.get(density)
  if (cached) return cached
  const builder = new Builder()
  buildTorso(builder, density)
  buildNeck(builder, density)
  builder.pointMap = ([x, y, z]) => [x * HEAD_SCALE, HEAD_PIVOT_Y + (y - HEAD_PIVOT_Y) * HEAD_SCALE, z * HEAD_SCALE]
  buildHead(builder, density)
  builder.pointMap = null
  buildArm(builder, density, -1)
  buildArm(builder, density, 1)
  buildHand(builder, -1)
  buildHand(builder, 1)
  const mesh = pack(builder.triangles, density)
  cache.set(density, mesh)
  return mesh
}
