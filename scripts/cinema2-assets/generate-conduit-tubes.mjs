// Generates CONDUIT's four energy tubes: chrome S-curves from bolted wall flanges near the four corners into the wordmark's outline ring.
//   node scripts/cinema2-assets/generate-conduit-tubes.mjs [out.glb]      (default: public/cinema2/models/conduit-tubes.glb)
//
// Parts (materials):
//   `pipe`     the chrome tube bodies, swept along a Catmull-Rom spline with a rotation-minimizing frame (shared tube kit).
//   `flange`   the wall mounts: a disc, a raised hub and a ring of bolts, facing into the room from the side walls.
//   `coupler`  the segmented metal sleeve on the straight last metre of each tube, where it plugs into the ring.
//   `channel`  a dark recessed channel along the front of each pipe that the windows sit in.
//   `energy`   the glowing windows along the front of each pipe (the half facing the camera), plus two glowing bands in the coupler gaps.
//
// Every vertex carries `_GLOW_PHASE` (0 at the wall flange, 1 where the tube meets the wordmark) and `_SEGMENT` (group = tube 0-1 in the order
// upper-left, lower-left, upper-right, lower-right; along = the glow phase; side -1 left / 1 right; a random 0-1 per window) - see
// docs/cinema2-conduit-plan.md. Only `energy` glows; the other parts carry the attributes so the whole asset shares one layout.
//
// World coordinates shared by all CONDUIT assets: floor y = 0, +Z toward the camera, the wordmark centred on (0, 2.09, 0). The attachment
// points are the ones generate-conduit-wordmark.mjs prints (the ring's outer edge nearest the mockup's tube ends).
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { buildTaperedTube, frameSamples, hash, writeGlb } from './cinema2-tube-kit.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputPath = process.argv[2] ? resolve(process.argv[2]) : join(root, 'public/cinema2/models/conduit-tubes.glb')

/** The camera CONDUIT is framed for; the glowing windows sit on the side of each pipe that faces it. */
const CAMERA = new THREE.Vector3(0, 1.92, 7)
const PIPE_RADIUS = 0.19
const COUPLER_LENGTH = 1.15
/** How far the tube's mouth sinks into the ring past its outer edge. */
const SINK = 0.08
const WINDOW = { length: 0.3, gap: 0.12, halfAngle: (27 * Math.PI) / 180, lift: 1.04, from: 0.05, to: 0.97 }
/** The dark channel the windows sit in: a little wider than the windows, running the whole pipe. */
const CHANNEL = { halfAngle: (38 * Math.PI) / 180, lift: 1.022, from: 0.03, to: 0.985 }

/**
 * The two left tubes (the right ones mirror them). `flange` is the wall mount's centre (it faces +X, into the room); `via` are the spline's
 * inner control points; `attach` is the ring edge point and `arrive` the direction the straight coupler section comes in from.
 */
const LEFT_TUBES = [
  { name: 'upper', flange: [-4.79, 4.52, -1.2], via: [[-4.35, 4.49, -1.12], [-3.7, 4.2, -0.85], [-3.15, 3.75, -0.55]], attach: [-1.624, 2.662, 0], arrive: [0.812, -0.584, 0.12] },
  { name: 'lower', flange: [-4.92, 0.42, -1.2], via: [[-4.55, 0.45, -1.12], [-3.9, 0.75, -0.8]], attach: [-2.096, 1.822, 0], arrive: [0.805, 0.593, 0.12] },
]

const MATERIALS = {
  pipe: { baseColorFactor: [0.9, 0.9, 0.92, 1], metallicFactor: 1, roughnessFactor: 0.16 },
  flange: { baseColorFactor: [0.6, 0.6, 0.62, 1], metallicFactor: 1, roughnessFactor: 0.32 },
  coupler: { baseColorFactor: [0.3, 0.3, 0.32, 1], metallicFactor: 1, roughnessFactor: 0.28 },
  channel: { baseColorFactor: [0.08, 0.08, 0.09, 1], metallicFactor: 0.9, roughnessFactor: 0.35 },
  energy: { baseColorFactor: [1, 0.62, 0.28, 1], metallicFactor: 0, roughnessFactor: 0.45, emissiveFactor: [1, 0.55, 0.2] },
}

const v3 = p => new THREE.Vector3(...p)

/** A capped cylinder along `axis` from `a` to `b`. */
function cylinder(a, b, radius, radialSegments = 24) {
  const mid = a.clone().lerp(b, 0.5)
  return buildTaperedTube([[a.x, a.y, a.z], [mid.x, mid.y, mid.z], [b.x, b.y, b.z]], { samples: 1, radiusAt: () => radius, radialSegments })
}

function merge(meshes) {
  const positions = [], normals = [], indices = []
  for (const mesh of meshes) {
    const base = positions.length / 3
    positions.push(...mesh.positions); normals.push(...mesh.normals)
    for (const index of mesh.indices) indices.push(base + index)
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: Uint32Array.from(indices) }
}

function mirrored(mesh) {
  const positions = Float32Array.from(mesh.positions), normals = Float32Array.from(mesh.normals)
  for (let i = 0; i < positions.length; i += 3) { positions[i] = -positions[i]; normals[i] = -normals[i] }
  const indices = Uint32Array.from(mesh.indices)
  for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]] // mirroring flips winding
  return { positions, normals, indices }
}

/** Attaches the glow layout: a per-vertex phase from `phaseOf(vertexIndex)` and `_SEGMENT` from `segmentOf(vertexIndex)`. */
function withGlow(mesh, phaseOf, segmentOf) {
  const count = mesh.positions.length / 3
  const phases = new Float32Array(count), segments = new Float32Array(count * 4)
  for (let i = 0; i < count; i += 1) { phases[i] = phaseOf(i); segments.set(segmentOf(i), i * 4) }
  return { ...mesh, phases, attributes: { _SEGMENT: { array: segments, type: 'VEC4' } } }
}

function buildLeftTube(spec) {
  const flange = v3(spec.flange)
  const arrive = v3(spec.arrive).normalize()
  const end = v3(spec.attach).addScaledVector(arrive, SINK)
  const couplerStart = end.clone().addScaledVector(arrive, -COUPLER_LENGTH)
  const lead = couplerStart.clone().addScaledVector(arrive, -0.32)
  const pipeStart = flange.clone().add(new THREE.Vector3(0.24, 0, 0))
  const control = [pipeStart, ...spec.via.map(v3), lead, couplerStart].map(p => [p.x, p.y, p.z])
  const pipeCurve = new THREE.CatmullRomCurve3(control.map(v3), false, 'centripetal')
  const pipeLength = pipeCurve.getLength()
  const totalLength = pipeLength + COUPLER_LENGTH
  const pipePhase = t => (t * pipeLength) / totalLength
  const couplerPhase = s => (pipeLength + s) / totalLength

  // Pipe body.
  const pipe = buildTaperedTube(control, { samples: 72, radiusAt: () => PIPE_RADIUS, radialSegments: 22, capStart: false, capEnd: false, phaseAt: pipePhase })

  // Flange: disc, hub and bolts, facing +X from the wall.
  const x = new THREE.Vector3(1, 0, 0)
  const flangeParts = [
    cylinder(flange.clone().addScaledVector(x, -0.07), flange.clone().addScaledVector(x, 0.07), 0.56, 40),
    cylinder(flange.clone().addScaledVector(x, 0.07), flange.clone().addScaledVector(x, 0.2), 0.36, 32),
    cylinder(flange.clone().addScaledVector(x, 0.18), pipeStart.clone().addScaledVector(x, 0.1), 0.24, 28),
  ]
  for (let k = 0; k < 12; k += 1) {
    const angle = (k / 12) * Math.PI * 2
    const at = flange.clone().add(new THREE.Vector3(0, Math.cos(angle) * 0.46, Math.sin(angle) * 0.46))
    flangeParts.push(cylinder(at.clone().addScaledVector(x, 0.06), at.clone().addScaledVector(x, 0.11), 0.035, 8))
  }

  // Coupler: collars and sleeves along the straight last metre, with two glowing bands in the gaps.
  const along = s => couplerStart.clone().addScaledVector(arrive, s)
  // [start, end, radius] along the straight section, as fractions of COUPLER_LENGTH and multiples of the pipe radius.
  const couplerSpans = [[0, 0.07, 1.55], [0.07, 0.38, 1.32], [0.46, 0.72, 1.32], [0.72, 0.78, 1.5], [0.8, 0.93, 1.38], [0.93, 1.0, 1.6]]
    .map(([s0, s1, r]) => [s0 * COUPLER_LENGTH, s1 * COUPLER_LENGTH, r * PIPE_RADIUS])
  const couplerParts = couplerSpans.map(([s0, s1, r]) => ({ ...cylinder(along(s0), along(s1), r, 28), s0, s1 }))
  const core = [0.38 * COUPLER_LENGTH, 0.46 * COUPLER_LENGTH]
  couplerParts.push({ ...cylinder(along(core[0]), along(core[1]), 1.12 * PIPE_RADIUS, 28), s0: core[0], s1: core[1] }) // dark core showing in the gap
  const bands = [[0.39, 0.45, 1.18], [0.785, 0.795, 1.52]]
    .map(([s0, s1, r]) => [s0 * COUPLER_LENGTH, s1 * COUPLER_LENGTH, r * PIPE_RADIUS])
    .map(([s0, s1, r]) => ({ ...cylinder(along(s0), along(s1), r, 28), s0, s1 }))

  // Energy windows: curved patches on the camera-facing half of the pipe, evenly spaced by arc length.
  const samples = 240
  const { centres, tangents, normals, binormals } = frameSamples(control, samples)
  const arc = [0]
  for (let i = 1; i < centres.length; i += 1) arc.push(arc[i - 1] + centres[i].distanceTo(centres[i - 1]))
  const at = s => {
    let i = 1
    while (i < arc.length - 1 && arc[i] < s) i += 1
    const t = (s - arc[i - 1]) / Math.max(1e-9, arc[i] - arc[i - 1])
    const lerp = (list) => list[i - 1].clone().lerp(list[i], t)
    return { centre: lerp(centres), tangent: lerp(tangents).normalize(), normal: lerp(normals).normalize(), binormal: lerp(binormals).normalize(), u: (i - 1 + t) / (arc.length - 1) }
  }
  /** A curved patch on the camera-facing side of the pipe from arc length s0 to s1. */
  const patch = (s0, s1, halfAngle, lift, rows, columns) => {
    const positions = [], vertexNormals = [], indices = [], phases = []
    for (let r = 0; r <= rows; r += 1) {
      const f = at(s0 + ((s1 - s0) * r) / rows)
      const toCamera = CAMERA.clone().sub(f.centre)
      const front = toCamera.addScaledVector(f.tangent, -toCamera.dot(f.tangent)).normalize()
      const side = new THREE.Vector3().crossVectors(f.tangent, front).normalize()
      for (let c = 0; c <= columns; c += 1) {
        const angle = -halfAngle + (2 * halfAngle * c) / columns
        const dir = front.clone().multiplyScalar(Math.cos(angle)).addScaledVector(side, Math.sin(angle))
        const p = f.centre.clone().addScaledVector(dir, PIPE_RADIUS * lift)
        positions.push(p.x, p.y, p.z); vertexNormals.push(dir.x, dir.y, dir.z); phases.push(pipePhase(f.u))
      }
    }
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < columns; c += 1) {
      const a = r * (columns + 1) + c, b = a + 1, d = a + columns + 1, e = d + 1
      indices.push(a, b, d, b, e, d)
    }
    // Wind so faces point outward.
    const p0 = v3(positions.slice(0, 3)), p1 = v3(positions.slice(3, 6)), p2 = v3(positions.slice((columns + 1) * 3, (columns + 1) * 3 + 3))
    const face = new THREE.Vector3().crossVectors(p1.clone().sub(p0), p2.clone().sub(p0))
    if (face.dot(v3(vertexNormals.slice(0, 3))) < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]
    return { positions: new Float32Array(positions), normals: new Float32Array(vertexNormals), indices: Uint32Array.from(indices), phases: new Float32Array(phases) }
  }
  const total = arc[arc.length - 1]
  const channel = patch(total * CHANNEL.from, total * CHANNEL.to, CHANNEL.halfAngle, CHANNEL.lift, 120, 10)
  const windows = []
  let windowIndex = 0
  // As many windows as fit at the nominal length and gap, then spread evenly so they run the whole pipe.
  const span = total * (WINDOW.to - WINDOW.from)
  const count = Math.max(1, Math.floor((span + WINDOW.gap) / (WINDOW.length + WINDOW.gap)))
  const pitch = (span + WINDOW.gap) / count
  for (let k = 0; k < count; k += 1) {
    const s0 = total * WINDOW.from + k * pitch
    windows.push({ ...patch(s0, s0 + pitch - WINDOW.gap, WINDOW.halfAngle, WINDOW.lift, 5, 8), id: windowIndex })
    windowIndex += 1
  }

  return { pipe, channel, flangeParts, couplerParts, bands, windows, couplerPhase, windowCount: windowIndex }
}

const meshes = []
const tubes = [
  ...LEFT_TUBES.map((spec, k) => ({ spec, side: -1, group: k === 0 ? 0 : 1 / 3 })),
  ...LEFT_TUBES.map((spec, k) => ({ spec, side: 1, group: k === 0 ? 2 / 3 : 1 })),
]
let windowTotal = 0
for (const { spec, side, group } of tubes) {
  const built = buildLeftTube(spec)
  const place = mesh => (side < 0 ? mesh : mirrored(mesh))
  const label = `${side < 0 ? 'left' : 'right'}-${spec.name}`
  const segment = (phase, random) => [group, phase, side, random]

  const pipe = place(built.pipe)
  meshes.push(withGlow({ name: `pipe-${label}`, part: 'pipe', ...pipe }, i => built.pipe.phases[i], i => segment(built.pipe.phases[i], 0)))
  meshes.push(withGlow({ name: `channel-${label}`, part: 'channel', ...place(built.channel) }, i => built.channel.phases[i], i => segment(built.channel.phases[i], 0)))
  meshes.push(withGlow({ name: `flange-${label}`, part: 'flange', ...place(merge(built.flangeParts)) }, () => 0, () => segment(0, 0)))
  const coupler = merge(built.couplerParts)
  const couplerPhases = built.couplerParts.flatMap(part => Array.from({ length: part.positions.length / 3 }, () => built.couplerPhase((part.s0 + part.s1) / 2)))
  meshes.push(withGlow({ name: `coupler-${label}`, part: 'coupler', ...place(coupler) }, i => couplerPhases[i], i => segment(couplerPhases[i], 0)))

  // Energy: windows and coupler bands, each its own segment with its own random identity.
  const energyParts = [...built.windows, ...built.bands.map((band, k) => ({ ...band, phases: new Float32Array(band.positions.length / 3).fill(built.couplerPhase((band.s0 + band.s1) / 2)), id: built.windowCount + k }))]
  const energy = merge(energyParts)
  const energyPhases = energyParts.flatMap(part => Array.from(part.phases))
  const energyRandom = energyParts.flatMap(part => Array.from({ length: part.positions.length / 3 }, () => hash(`${label}:${part.id}`)))
  meshes.push(withGlow({ name: `energy-${label}`, part: 'energy', ...place(energy) }, i => energyPhases[i], i => segment(energyPhases[i], energyRandom[i])))
  windowTotal += built.windowCount
}

const result = writeGlb(outputPath, meshes, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-conduit-tubes.mjs', 'conduit-tubes')
console.log(`Wrote ${outputPath}`)
console.log(`  ${result.triangles} triangles, ${(result.byteLength / 1024).toFixed(0)} KB, parts ${result.parts.join(', ')}, ${windowTotal} energy windows`)
