// Generates CONDUIT's chamber: the circular back wall, the curved side walls that carry the tube flanges, the floor groove rings, and every
// LED segment set into them.
//   node scripts/cinema2-assets/generate-conduit-chamber.mjs [out.glb]      (default: public/cinema2/models/conduit-chamber.glb)
//
// Layout (from the owner's wall reference, world units; floor y = 0, +Z toward the camera, the back wall at z ~ -3.5):
//   - a central disc (r 1.63) on the chamber axis (0, 2.27), a stepped ring, a recessed LED track, a thick portal ring, a thin ring, a band of
//     eight spoke sectors (a tall pillar at the top, flared T-ribs left and right, diagonal ribs, a pedestal at the bottom) with recessed
//     rounded panels between them, and an outer arch;
//   - side walls curving from the back wall toward the camera, where the tube flanges mount;
//   - four thin groove rings on the floor.
// The native reflective floor hides everything below y = 0 (it depth-tests against the scene), so shapes may run through the floor; only
// pieces entirely below it are left out.
//
// Parts (materials): `shell` brushed silver structure, `trim` dark recessed tracks and inlays, `floorTrim` the floor grooves, `segments` the
// LED strips (emissive). Every vertex carries `_GLOW_PHASE` (distance from the chamber axis, 0 at the centre to 1 at the outer arch; side
// walls 1) and `_SEGMENT` (group, along, side, random - docs/cinema2-conduit-plan.md). Segment groups, in `_SEGMENT.x` order:
//   0 inner LED ring (r 2.1), 1 second LED ring (r 2.65), 2 outer LED ring (r 3.56), 3 outer arch (r 6.55), 4 T-ribs, 5 radial bars (diagonal ribs and panel ticks),
//   6 top pillar, 7 side-wall strips.
// `along` is the angle clockwise from the top for rings (0-1), the distance out along a rib or pillar (0-1), or the height on a side wall.
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { hash, writeGlb } from './cinema2-tube-kit.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputPath = process.argv[2] ? resolve(process.argv[2]) : join(root, 'public/cinema2/models/conduit-chamber.glb')

const CENTRE = [0, 2.27]
const OUTER_RADIUS = 6.85
const GROUPS = 8
const CREASE_ANGLE = (40 * Math.PI) / 180

const MATERIALS = {
  shell: { baseColorFactor: [0.74, 0.74, 0.76, 1], metallicFactor: 0.85, roughnessFactor: 0.38 },
  trim: { baseColorFactor: [0.13, 0.13, 0.14, 1], metallicFactor: 0.8, roughnessFactor: 0.42 },
  floorTrim: { baseColorFactor: [0.2, 0.2, 0.21, 1], metallicFactor: 0.9, roughnessFactor: 0.3 },
  segments: { baseColorFactor: [1, 0.62, 0.28, 1], metallicFactor: 0, roughnessFactor: 0.45, emissiveFactor: [1, 0.55, 0.2] },
}

// ── 2D helpers (wall plane: x, y in world units) ─────────────────────────────
const TAU = Math.PI * 2
const polar = (r, angle) => [CENTRE[0] + r * Math.cos(angle), CENTRE[1] + r * Math.sin(angle)]
const deg = d => (d * Math.PI) / 180

function arc(r, from, to, step = 0.09) {
  const count = Math.max(2, Math.ceil(Math.abs(to - from) * r / step))
  return Array.from({ length: count + 1 }, (_, i) => polar(r, from + ((to - from) * i) / count))
}
const circle = (r, step) => arc(r, 0, TAU, step).slice(0, -1)
/** Chaikin corner cutting: rounds the corners of a closed polygon. */
function rounded(points, iterations = 3) {
  let current = points
  for (let k = 0; k < iterations; k += 1) {
    const next = []
    for (let i = 0; i < current.length; i += 1) {
      const a = current[i], b = current[(i + 1) % current.length]
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    current = next
  }
  return current
}
/** A band between radii r0 and r1 from angle a0 to a1 (radians, CCW). */
const sector = (r0, r1, a0, a1, step) => [...arc(r1, a0, a1, step), ...arc(r0, a1, a0, step)]
/** A strip of half-width `half` along the ray at `angle`, from r0 to r1. */
function ray(angle, r0, r1, half0, half1 = half0) {
  const d = [Math.cos(angle), Math.sin(angle)], n = [-d[1], d[0]]
  const at = (r, h) => [CENTRE[0] + d[0] * r + n[0] * h, CENTRE[1] + d[1] * r + n[1] * h]
  return [at(r0, -half0), at(r1, -half1), at(r1, half1), at(r0, half0)]
}
const maxY = points => Math.max(...points.map(p => p[1]))

/** Extrudes one 2D shape (outer + optional holes) `depth` deep, its back face at z = `back`. */
function extrude(outer, holes, back, depth, bevel, bevelSegments = 2) {
  const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)))
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))))
  let geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments,
    curveSegments: 1,
    steps: 1,
  })
  geometry.deleteAttribute('uv')
  geometry.translate(0, 0, back + bevel)
  geometry = toCreasedNormals(geometry, CREASE_ANGLE)
  geometry = mergeVertices(geometry, 1e-5)
  return { positions: Array.from(geometry.getAttribute('position').array), normals: Array.from(geometry.getAttribute('normal').array), indices: Array.from(geometry.getIndex().array) }
}

// ── Part builders ─────────────────────────────────────────────────────────────
const parts = { shell: [], trim: [], floorTrim: [], segments: [] }
const radialPhase = (x, y) => Math.min(1, Math.hypot(x - CENTRE[0], y - CENTRE[1]) / OUTER_RADIUS)

/** Adds geometry to a part; every vertex gets a phase and a `_SEGMENT` value from `segmentOf(x, y)`. */
function add(part, mesh, segmentOf = () => [0, 0, 0, 0], phaseOf = radialPhase) {
  const count = mesh.positions.length / 3
  const phases = [], segments = []
  for (let i = 0; i < count; i += 1) {
    const x = mesh.positions[i * 3], y = mesh.positions[i * 3 + 1]
    phases.push(phaseOf(x, y))
    segments.push(...segmentOf(x, y))
  }
  parts[part].push({ ...mesh, phases, segments })
}
function addShape(part, outer, holes, back, depth, bevel) {
  if (maxY(outer) < 0) return
  add(part, extrude(outer, holes, back, depth, bevel))
}

let segmentCount = 0
/** One LED segment: a short rounded strip, `lift` in front of its host surface, with its own random identity. */
function addSegment(outline, front, group, along, side) {
  if (maxY(outline) < 0.06) return
  const identity = hash(`segment:${segmentCount}`)
  segmentCount += 1
  add('segments', extrude(rounded(outline, 1), [], front - 0.012, 0.03, 0.006, 1), () => [group / (GROUPS - 1), along, side, identity])
}
const clockwiseFromTop = angle => ((deg(90) - angle) % TAU + TAU) % TAU / TAU
const sideOf = x => (Math.abs(x) < 1e-3 ? 0 : Math.sign(x))

// ── Back wall ─────────────────────────────────────────────────────────────────
const Z = {
  plate: -3.9, panelFrame: -3.72, spoke: -3.66, disc: -3.62, ringStep: -3.52, track: -3.6, portal: -3.62, thinRing: -3.62, arch: -3.66, pillar: -3.66, pedestal: -3.62,
}
// Backplate behind everything (the recessed panel surfaces).
addShape('shell', [[-9.5, -0.5], [9.5, -0.5], [9.5, 10], [-9.5, 10]], [], Z.plate, 0.1, 0)

// Central disc, its stepped ring, and the recessed LED track with two dashed rings.
addShape('shell', circle(1.63), [], Z.disc, 0.1, 0.02)
addShape('shell', circle(1.78), [circle(1.63)], Z.ringStep, 0.26, 0.03)
addShape('trim', circle(2.45), [circle(1.78)], Z.track, 0.12, 0)
addShape('shell', circle(2.85), [circle(2.45)], Z.ringStep, 0.2, 0.025)
// Portal ring: the thick raised ring, with a recessed LED track on its face.
addShape('shell', circle(3.4), [circle(2.85)], Z.portal, 0.5, 0.05)
addShape('trim', circle(3.72), [circle(3.4)], Z.track, 0.14, 0)
addShape('shell', circle(3.95), [circle(3.72)], Z.thinRing, 0.3, 0.03)

function dashedRing(r, count, gapFraction, front, group, width = 0.08) {
  const span = (TAU / count) * (1 - gapFraction)
  for (let k = 0; k < count; k += 1) {
    const middle = deg(90) - (k / count) * TAU
    addSegment(sector(r - width / 2, r + width / 2, middle - span / 2, middle + span / 2, 0.12), front, group, clockwiseFromTop(middle), sideOf(Math.cos(middle)))
  }
}
dashedRing(2.1, 12, 0.34, Z.track + 0.12, 0, 0.14)
dashedRing(2.65, 16, 0.4, Z.ringStep + 0.2, 1, 0.13)
dashedRing(3.56, 20, 0.38, Z.track + 0.14, 2, 0.15)

// Spokes: a tall pillar at the top, flared T-ribs left and right, diagonal ribs, a pedestal at the bottom.
const SPOKE_R0 = 3.95, SPOKE_R1 = 6.3
addShape('shell', ray(deg(90), SPOKE_R0 - 0.1, 7.4, 0.62, 0.46), [], Z.pillar, 0.52, 0.04)
for (let k = 0; k < 5; k += 1) {
  const along = k / 4
  const y0 = CENTRE[1] + SPOKE_R0 + 0.3 + k * 0.62
  for (const x of [-0.2, 0.2]) addSegment([[x - 0.07, y0], [x + 0.07, y0], [x + 0.07, y0 + 0.42], [x - 0.07, y0 + 0.42]], Z.pillar + 0.52, 6, along, Math.sign(x))
}
function tRib(sign) {
  const cx = CENTRE[0], cy = CENTRE[1]
  const flare = [...Array.from({ length: 9 }, (_, i) => {
    const t = i / 8
    return [5.45 + 0.9 * t, 0.34 + (0.95 - 0.34) * (1 - Math.cos((t * Math.PI) / 2))]
  })]
  const top = [[SPOKE_R0 - 0.1, 0.34], ...flare, [6.35, 0.95]]
  const outline = [...top, ...[...top].reverse().map(([x, y]) => [x, -y])]
  return outline.map(([x, y]) => [cx + sign * x, cy + y])
}
for (const sign of [-1, 1]) {
  addShape('shell', tRib(sign), [], Z.spoke, 0.44, 0.04)
  for (const [k, dy] of [-0.2, 0, 0.2].entries()) {
    const y = CENTRE[1] + dy
    const x0 = sign * 4.3, x1 = sign * 5.4
    addSegment([[Math.min(x0, x1), y - 0.055], [Math.max(x0, x1), y - 0.055], [Math.max(x0, x1), y + 0.055], [Math.min(x0, x1), y + 0.055]], Z.spoke + 0.44, 4, k / 2, sign)
  }
}
for (const angle of [45, 135, 225, 315].map(deg)) {
  addShape('shell', ray(angle, SPOKE_R0 - 0.1, SPOKE_R1 + 0.1, 0.2), [], Z.spoke, 0.36, 0.03)
  for (let k = 0; k < 2; k += 1) {
    const r0 = 4.35 + k * 0.85
    addSegment(ray(angle, r0, r0 + 0.55, 0.06), Z.spoke + 0.36, 5, k, sideOf(Math.cos(angle)))
  }
}
// Radial "clock tick" bars on the panels between the spokes (group 5 with the diagonal ribs: radial bars).
for (let k = 0; k < 16; k += 1) {
  const angle = deg(11.25 + k * 22.5)
  addSegment(ray(angle, 4.55, 5.3, 0.07), Z.plate + 0.1 + 0.03, 5, 0.5, sideOf(Math.cos(angle)))
}
addShape('shell', ray(deg(270), 1.6, 3.2, 0.34, 0.42), [], Z.pedestal, 0.5, 0.04)

// Recessed panels between the spokes: raised rounded frames around each window.
const halfWidthAt = angle => {
  const d = Math.round((((angle * 180) / Math.PI) % 360 + 360) % 360)
  if (d === 90) return 0.62
  if (d === 0 || d === 180) return 0.5
  if (d === 270) return 0.42
  return 0.22
}
for (let k = 0; k < 8; k += 1) {
  const a0 = deg(k * 45), a1 = deg(k * 45 + 45)
  const panel = (r0, r1, inset) => rounded([
    ...arc(r1 - inset, a0 + (halfWidthAt(a0) + 0.18 + inset) / (r1 - inset), a1 - (halfWidthAt(a1) + 0.18 + inset) / (r1 - inset)),
    ...arc(r0 + inset, a1 - (halfWidthAt(a1) + 0.18 + inset) / (r0 + inset), a0 + (halfWidthAt(a0) + 0.18 + inset) / (r0 + inset)),
  ], 2)
  const frameOuter = panel(4.1, 6.2, 0)
  const frameInner = panel(4.1, 6.2, 0.13)
  addShape('shell', frameOuter, [frameInner], Z.panelFrame, 0.16, 0.02)
}

// Outer arch with a dashed LED ring on its face.
addShape('shell', circle(OUTER_RADIUS), [circle(6.25)], Z.arch, 0.46, 0.05)
dashedRing(6.55, 32, 0.4, Z.arch + 0.46, 3, 0.16)

// ── Side walls ────────────────────────────────────────────────────────────────
// A thick curved wall on each side, following a plan curve (x, z) from behind the outer arch toward the camera; the tube flanges sit on it.
const PLAN = new THREE.CatmullRomCurve3([[-7.6, 0, -3.7], [-6.6, 0, -2.7], [-5.5, 0, -1.7], [-4.9, 0, -1.0], [-4.62, 0, 0.3], [-4.55, 0, 1.6]].map(p => new THREE.Vector3(...p)), false, 'centripetal')
const WALL = { height: 8.5, thickness: 0.35, planSamples: 36, heightSamples: 2 }
/**
 * One side wall (sign -1 left, 1 right). PLAN is the left wall's inner face; the right wall mirrors it (x -> -x). Built as two faces (inner,
 * and outer `thickness` further out) of a grid along the plan curve and up the wall.
 */
function sideWall(sign) {
  const plan = PLAN.getSpacedPoints(WALL.planSamples)
  const positions = [], normals = [], indices = []
  for (const inward of [true, false]) {
    const base = positions.length / 3
    for (let i = 0; i < plan.length; i += 1) {
      const a = plan[Math.max(0, i - 1)], b = plan[Math.min(plan.length - 1, i + 1)]
      const tangent = new THREE.Vector3().subVectors(b, a).normalize()
      const into = new THREE.Vector3(tangent.z, 0, -tangent.x)
      if (into.x < 0) into.negate() // into the room (+x) for the left wall
      const point = plan[i].clone().addScaledVector(into, inward ? 0 : -WALL.thickness)
      const normal = inward ? into : into.clone().negate()
      for (let j = 0; j <= WALL.heightSamples; j += 1) {
        positions.push(-sign * point.x, -0.3 + ((WALL.height + 0.3) * j) / WALL.heightSamples, point.z)
        normals.push(-sign * normal.x, 0, normal.z)
      }
    }
    // (a, b, c) faces +x on the left wall's grid; mirroring and the outer face each reverse it.
    const forward = (inward ? 1 : -1) * (sign < 0 ? 1 : -1) > 0
    for (let i = 0; i < plan.length - 1; i += 1) for (let j = 0; j < WALL.heightSamples; j += 1) {
      const a = base + i * (WALL.heightSamples + 1) + j, b = a + 1, c = a + WALL.heightSamples + 1, d = c + 1
      if (forward) indices.push(a, b, c, b, d, c); else indices.push(a, c, b, b, c, d)
    }
  }
  return { positions, normals, indices }
}

/** Left-wall x of the inner face at depth z. */
const planSamples = PLAN.getSpacedPoints(200)
function wallXAt(z) {
  let best = planSamples[0]
  for (const p of planSamples) if (Math.abs(p.z - z) < Math.abs(best.z - z)) best = p
  return best.x
}

/**
 * Stands a mesh built in a local (lx, ly, lz) frame on a side wall: lx runs along the wall (world z), ly is height, lz points into the room.
 * `xAt(lx)` is the left-wall surface x at that point. Mirrors for the right wall and fixes winding (the left mapping is a reflection).
 */
function onWall(mesh, sign, xAt, lift = 0) {
  const positions = mesh.positions.slice(), normals = mesh.normals.slice(), indices = mesh.indices.slice()
  for (let i = 0; i < positions.length; i += 3) {
    const lx = mesh.positions[i], ly = mesh.positions[i + 1], lz = mesh.positions[i + 2]
    positions[i] = -sign * (xAt(lx) + lift + lz)
    positions[i + 1] = ly
    positions[i + 2] = lx
    const nx = mesh.normals[i], ny = mesh.normals[i + 1], nz = mesh.normals[i + 2]
    normals[i] = -sign * nz
    normals[i + 1] = ny
    normals[i + 2] = nx
  }
  if (sign < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]
  return { positions, normals, indices }
}

for (const sign of [-1, 1]) {
  add('shell', sideWall(sign), () => [0, 0, 0, 0], () => 1)
  // Raised horizontal ribs along each side wall.
  const zs = PLAN.getSpacedPoints(60).map(p => p.z)
  for (const [y0, y1] of [[0.0, 0.25], [2.95, 3.2], [5.9, 6.15]]) {
    const outline = [...zs.map(z => [z, y0]), ...[...zs].reverse().map(z => [z, y1])]
    add('shell', onWall(extrude(outline, [], 0, 0.2, 0.02), sign, wallXAt), () => [0, 0, 0, 0], () => 1)
  }
  // Two vertical LED strips per side wall.
  for (const [k, [y0, y1, z]] of [[1.4, 2.5, -2.3], [3.5, 4.8, -2.3]].entries()) {
    const strip = extrude([[z - 0.05, y0], [z + 0.05, y0], [z + 0.05, y1], [z - 0.05, y1]], [], 0.05, 0.03, 0.006)
    const identity = hash(`side:${sign}:${k}`)
    add('segments', onWall(strip, sign, () => wallXAt(z)), (sx, sy) => [7 / (GROUPS - 1), sy / WALL.height, sign, identity], () => 1)
    segmentCount += 1
  }
}

// ── Floor grooves ─────────────────────────────────────────────────────────────
const FLOOR_CENTRE = [0, -0.5]
for (const r of [2.55, 2.72, 3.85, 4.02]) {
  const width = 0.035
  const ring = extrude(
    Array.from({ length: 256 }, (_, i) => [FLOOR_CENTRE[0] + (r + width / 2) * Math.cos((i / 256) * TAU), FLOOR_CENTRE[1] + (r + width / 2) * Math.sin((i / 256) * TAU)]),
    [Array.from({ length: 256 }, (_, i) => [FLOOR_CENTRE[0] + (r - width / 2) * Math.cos((i / 256) * TAU), FLOOR_CENTRE[1] + (r - width / 2) * Math.sin((i / 256) * TAU)])],
    0, 0.006, 0,
  )
  // Lay the ring flat: (x, y, depth) -> (x, depth, y), then drop what falls behind the back wall.
  for (let i = 0; i < ring.positions.length; i += 3) {
    const y = ring.positions[i + 1], depth = ring.positions[i + 2]
    ring.positions[i + 1] = depth + 0.001
    ring.positions[i + 2] = y
    const ny = ring.normals[i + 1], nz = ring.normals[i + 2]
    ring.normals[i + 1] = nz
    ring.normals[i + 2] = ny
  }
  const kept = []
  for (let i = 0; i < ring.indices.length; i += 3) {
    const tri = ring.indices.slice(i, i + 3)
    if (tri.every(index => ring.positions[index * 3 + 2] > -3.3)) kept.push(...tri)
  }
  // Flip winding so the top faces up after the axis swap.
  for (let i = 0; i < kept.length; i += 3) [kept[i + 1], kept[i + 2]] = [kept[i + 2], kept[i + 1]]
  add('floorTrim', { ...ring, indices: kept }, () => [0, 0, 0, 0], () => 0)
}

// ── Write ─────────────────────────────────────────────────────────────────────
const meshes = Object.entries(parts).map(([part, list]) => {
  const positions = [], normals = [], indices = [], phases = [], segments = []
  for (const mesh of list) {
    const base = positions.length / 3
    positions.push(...mesh.positions); normals.push(...mesh.normals); phases.push(...mesh.phases); segments.push(...mesh.segments)
    for (const index of mesh.indices) indices.push(base + index)
  }
  return {
    name: part, part,
    positions: new Float32Array(positions), normals: new Float32Array(normals), indices: Uint32Array.from(indices), phases: new Float32Array(phases),
    attributes: { _SEGMENT: { array: new Float32Array(segments), type: 'VEC4' } },
  }
})
const result = writeGlb(outputPath, meshes, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-conduit-chamber.mjs', 'conduit-chamber')
console.log(`Wrote ${outputPath}`)
for (const mesh of meshes) console.log(`  ${mesh.name}: ${mesh.indices.length / 3} triangles, ${mesh.positions.length / 3} vertices`)
console.log(`  total ${result.triangles} triangles, ${(result.byteLength / 1024).toFixed(0)} KB, ${segmentCount} LED segments`)
