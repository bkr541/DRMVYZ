// Generates CONDUIT's four energy tubes: dark chrome S-curves from bolted wall flanges near the four corners into the wordmark's frame, like
// the owner's production mockup and tube reference.
//   node scripts/cinema2-assets/generate-conduit-tubes.mjs [out.glb]      (default: public/cinema2/models/conduit-tubes.glb)
//
// Parts (materials):
//   `pipe`     the chrome tube bodies, swept along a smooth cubic curve, open along the front where the channel
//              runs; the rolled lips of the channel; the chrome ribs that divide it into windows.
//   `channel`  the dark recessed channel along the camera-facing side of each pipe: its floor, side walls and end walls.
//   `flange`   the wall mounts, lathe-turned: a recessed housing, a thick rounded disc, a hub and a neck into the pipe, and a ring of hex bolts.
//   `coupler`  the machined sleeve on the straight last metre of each tube, lathe-turned: collars, grooves, stepped rings, a mouth into the
//              frame, and slotted blocks over the first glowing gap.
//   `energy`   everything that glows: rounded LED bars lying in the channel (a domed diffuser, so its light gathers in a hot centre line), the
//              rings glowing in the coupler's gaps, and a ring in each flange's groove.
//
// Every vertex carries `_GLOW_PHASE` (0 at the wall flange, 1 where the tube meets the wordmark) and `_SEGMENT` (group = tube 0-1 in the order
// upper-left, lower-left, upper-right, lower-right; along = the glow phase; side -1 left / 1 right; a random 0-1 per glowing piece), plus
// `_CONDUIT_SYSTEM`, `_CONDUIT_ROUTE`, `_CONDUIT_REGION`, and `_CONDUIT_PHASE` - see docs/cinema2-conduit-plan.md. Only `energy` glows;
// the other parts carry the attributes so the whole asset shares one layout.
//
// World coordinates shared by all CONDUIT assets: floor y = 0, +Z toward the camera, the wordmark centred on (0, 2.09, 0). The attachment
// points come from conduit-layout.json, written by generate-conduit-wordmark.mjs (the frame's outer edge nearest the mockup's tube ends), so
// regenerate the wordmark first whenever it changes.
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { gridMesh, lathe, merged, mirroredX, placed, roundedBox, transformed } from './cinema2-hard-surface-kit.mjs'
import { hash, writeGlb } from './cinema2-tube-kit.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputPath = process.argv[2] ? resolve(process.argv[2]) : join(root, 'public/cinema2/models/conduit-tubes.glb')
/** Where the tubes meet the wordmark frame (left side; the right mirrors it), from the wordmark generator. */
const LAYOUT = JSON.parse(readFileSync(join(root, 'scripts/cinema2-assets/conduit-layout.json'), 'utf8'))
const ATTACH = LAYOUT.attachments

/** The camera CONDUIT is framed for; the channel runs along the side of each pipe that faces it. */
const CAMERA = new THREE.Vector3(0, 1.92, 7)
/**
 * Pipe radius. The energy conduit is substantial but remains much smaller than the letters; the collar clearance below is sized from it.
 */
const R = 0.165
const COUPLER_LENGTH = 0.7
/**
 * How far the couplers bulge past the pipe, as a share of their modelled bulge: 0.48 makes the widest collars 1.3x the pipe radius (were 1.62x),
 * so they no longer stand out over the wordmark's frame. Grooves, rings, blocks and glow rings keep their proportions.
 */
const COUPLER_BULGE = 0.48
/** The broad collar stays outside the logo; only its narrow socket reaches the illuminated outer lip. */
const COLLAR_SETBACK = 0.24
const SOCKET_SINK = 0.025
const EDGE_Z = -0.16
/** The wall flanges are modelled at full size and scaled by this (their neck still matches the pipe). */
const FLANGE_SCALE = 0.6
/** Length of the flange (housing to neck) along its axis; the pipe starts where it ends. */
const FLANGE_LENGTH = 0.5 * FLANGE_SCALE
/** The channel: its half-angle either side of the camera-facing line, its floor radius, and the stretch of the pipe (fractions) it runs. */
const CHANNEL = { half: (42 * Math.PI) / 180, floor: 0.72 * R, from: 0.04, to: 0.975 }
/** LED bars in the channel: half-angle, dome height above the channel floor, nominal length, and the chrome rib between two bars. */
const LED = { half: (33 * Math.PI) / 180, height: 0.22 * R, length: 0.26, rib: 0.045, ribTop: 0.93 * R }
/** The channel's rolled lips: a bead of this radius along each edge. */
const LIP_RADIUS = 0.011

/**
 * The two left tubes (the right ones mirror them). `flange` is the wall mount's centre and `axis` the way it faces (into the room and a little
 * toward the camera); `attach` is the frame's edge point and `arrive` the direction the straight coupler comes in from. As in the mockup, each
 * leaves its high (or low) corner flange into the room and sweeps in one gentle diagonal S to meet the wordmark's end (about 30 degrees); the
 * curve's tangent handles scale with the free pipe span, keeping the shorter lower tubes rounded when the wordmark grows.
 */
const LEFT_TUBES = [
  { name: 'upper', flange: [-4.82, 4.6, -1.25], axis: [1, -0.25, 0.5], attach: ATTACH.upper, arrive: [0.86, -0.48, 0.14] },
  { name: 'lower', flange: [-4.95, 0.45, -1.25], axis: [1, 0.25, 0.5], attach: ATTACH.lower, arrive: [0.86, 0.48, 0.14] },
]

const MATERIALS = {
  pipe: { baseColorFactor: [0.62, 0.6, 0.58, 1], metallicFactor: 1, roughnessFactor: 0.12 },
  channel: { baseColorFactor: [0.05, 0.05, 0.055, 1], metallicFactor: 0.85, roughnessFactor: 0.4 },
  flange: { baseColorFactor: [0.55, 0.53, 0.5, 1], metallicFactor: 1, roughnessFactor: 0.2 },
  coupler: { baseColorFactor: [0.5, 0.48, 0.46, 1], metallicFactor: 1, roughnessFactor: 0.16 },
  energy: { baseColorFactor: [1, 0.62, 0.28, 1], metallicFactor: 0, roughnessFactor: 0.45, emissiveFactor: [1, 0.55, 0.2] },
}

const v3 = p => new THREE.Vector3(...p)
const withPhase = (mesh, phase) => ({ ...mesh, phases: Array.from({ length: mesh.positions.length / 3 }, (_, i) => (typeof phase === 'function' ? phase(i, mesh) : phase)) })

/** A rounded glowing ring (a half-round bump from radius r0 up to r1) between y0 and y1 on a lathe axis. */
const glowRing = (r0, r1, y0, y1) => lathe(Array.from({ length: 9 }, (_, k) => {
  const a = (k / 8) * Math.PI
  return [r0 + (r1 - r0) * Math.sin(a), y0 + ((y1 - y0) * (1 - Math.cos(a))) / 2]
}), 36, null)

function buildLeftTube(spec) {
  const flange = v3(spec.flange)
  const axis = v3(spec.axis).normalize()
  const outward = v3([...LAYOUT.normals[spec.name], 0]).normalize()
  const diagonal = v3(spec.arrive).normalize()
  // Keep the final run diagonal in the image plane. The contour normal also steers it squarely into the frame rather than across a letter.
  const arrive = diagonal.multiplyScalar(0.75).addScaledVector(outward, -0.25).normalize()
  if (-arrive.dot(outward) < 0.75) throw new Error(`CONDUIT ${spec.name} tube approaches the outline too obliquely.`)
  const edge = v3(spec.attach).addScaledVector(outward, LAYOUT.wordmark.lipOutset).setZ(EDGE_Z)
  const end = edge.clone().addScaledVector(arrive, -COLLAR_SETBACK)
  const couplerStart = end.clone().addScaledVector(arrive, -COUPLER_LENGTH)
  const pipeStart = flange.clone().addScaledVector(axis, FLANGE_LENGTH)
  // Tangent handles guide a single smooth bend rather than becoming knots the spine must pass through. This avoids tight elbows as the
  // larger wordmark shortens the lower runs, and joins the flange and straight coupler with matching tangents.
  const handleLength = pipeStart.distanceTo(couplerStart) * 0.35
  const curve = new THREE.CubicBezierCurve3(
    pipeStart,
    pipeStart.clone().addScaledVector(axis, handleLength),
    couplerStart.clone().addScaledVector(arrive, -handleLength),
    couplerStart,
  )
  curve.arcLengthDivisions = 1000
  const centres = curve.getSpacedPoints(260)
  const tangents = centres.map((_, i) => curve.getTangentAt(i / (centres.length - 1)))
  for (let i = 1; i < centres.length - 1; i += 1) {
    const angle = tangents[i - 1].angleTo(tangents[i + 1])
    const bendRadius = centres[i - 1].distanceTo(centres[i + 1]) / Math.max(angle, 1e-9)
    if (bendRadius < R * 2) throw new Error(`CONDUIT ${spec.name} tube bends too tightly for its radius.`)
  }
  const arc = [0]
  for (let i = 1; i < centres.length; i += 1) arc.push(arc[i - 1] + centres[i].distanceTo(centres[i - 1]))
  const pipeLength = arc[arc.length - 1]
  const totalLength = pipeLength + COUPLER_LENGTH
  const pipePhase = s => s / totalLength
  const couplerPhase = y => (pipeLength + y) / totalLength

  /** The pipe's frame at arc length s: centre, tangent, and the camera-facing `front` and `side` axes of its cross-section. */
  const frameAt = s => {
    let i = 1
    while (i < arc.length - 1 && arc[i] < s) i += 1
    const t = Math.min(1, Math.max(0, (s - arc[i - 1]) / Math.max(1e-9, arc[i] - arc[i - 1])))
    const centre = centres[i - 1].clone().lerp(centres[i], t)
    const tangent = tangents[i - 1].clone().lerp(tangents[i], t).normalize()
    const toCamera = CAMERA.clone().sub(centre)
    const front = toCamera.addScaledVector(tangent, -toCamera.dot(tangent)).normalize()
    const side = new THREE.Vector3().crossVectors(tangent, front).normalize()
    return { centre, tangent, front, side }
  }
  const dirAt = (f, theta) => f.front.clone().multiplyScalar(Math.cos(theta)).addScaledVector(f.side, Math.sin(theta))
  const tangentialAt = (f, theta) => f.front.clone().multiplyScalar(-Math.sin(theta)).addScaledVector(f.side, Math.cos(theta))
  const rowsFor = (s0, s1, pitch = 0.06) => Math.max(1, Math.ceil((s1 - s0) / pitch))
  /** A surface of revolution about the pipe's spine between s0 and s1, over angles a0..a1, at radius `radius(s, theta)`. */
  const sweep = (s0, s1, a0, a1, radius, cols, outward = (f, theta) => dirAt(f, theta), pitch = 0.06) => {
    const rows = rowsFor(s0, s1, pitch)
    const frames = Array.from({ length: rows + 1 }, (_, r) => frameAt(s0 + ((s1 - s0) * r) / rows))
    const thetaOf = c => a0 + ((a1 - a0) * c) / cols
    const mesh = gridMesh(rows, cols, (r, c) => frames[r].centre.clone().addScaledVector(dirAt(frames[r], thetaOf(c)), radius(s0 + ((s1 - s0) * r) / rows, thetaOf(c))), (r, c) => outward(frames[r], thetaOf(c)))
    return withPhase(mesh, i => pipePhase(s0 + ((s1 - s0) * Math.floor(i / (cols + 1))) / rows))
  }
  /** A flat wall across the channel at arc length s, from the channel floor up to `top`, facing `facing` (+1 along the pipe, -1 back). */
  const endWall = (s, top, facing, half = CHANNEL.half) => {
    const f = frameAt(s)
    const mesh = gridMesh(1, 8, (r, c) => f.centre.clone().addScaledVector(dirAt(f, -half + (2 * half * c) / 8), r === 0 ? CHANNEL.floor - 0.002 : top), () => f.tangent.clone().multiplyScalar(facing))
    return withPhase(mesh, pipePhase(s))
  }

  const s0 = pipeLength * CHANNEL.from, s1 = pipeLength * CHANNEL.to
  const H = CHANNEL.half

  // ── Pipe body: open along the channel, closed before and after it ──
  const pipe = [
    sweep(0, pipeLength, H, Math.PI * 2 - H, () => R, 24),
    sweep(0, s0, -H, H, () => R, 8),
    sweep(s1, pipeLength, -H, H, () => R, 8),
  ]
  // Rolled lips: a bead along each channel edge.
  for (const edge of [-H, H]) {
    const rows = rowsFor(s0, s1)
    const frames = Array.from({ length: rows + 1 }, (_, r) => frameAt(s0 + ((s1 - s0) * r) / rows))
    const bead = gridMesh(rows, 10, (r, c) => {
      const f = frames[r]
      const a = (c / 10) * Math.PI * 2
      const centre = f.centre.clone().addScaledVector(dirAt(f, edge), R - LIP_RADIUS * 0.4)
      return centre.addScaledVector(dirAt(f, edge), Math.cos(a) * LIP_RADIUS).addScaledVector(tangentialAt(f, edge), Math.sin(a) * LIP_RADIUS)
    }, (r, c) => {
      const f = frames[r]
      const a = (c / 10) * Math.PI * 2
      return dirAt(f, edge).multiplyScalar(Math.cos(a)).addScaledVector(tangentialAt(f, edge), Math.sin(a))
    }, { closed: true })
    pipe.push(withPhase(bead, i => pipePhase(s0 + ((s1 - s0) * Math.floor(i / 10)) / rows)))
  }

  // ── Channel: floor, side walls, end walls ──
  const channel = [
    sweep(s0, s1, -H, H, () => CHANNEL.floor, 10),
    endWall(s0, R, 1),
    endWall(s1, R, -1),
  ]
  // Side walls, from the floor up to the lip, facing into the channel.
  channel.push(...[H, -H].map(edge => {
    const rows = rowsFor(s0, s1)
    const frames = Array.from({ length: rows + 1 }, (_, r) => frameAt(s0 + ((s1 - s0) * r) / rows))
    const wall = gridMesh(rows, 1, (r, c) => frames[r].centre.clone().addScaledVector(dirAt(frames[r], edge), c === 0 ? CHANNEL.floor - 0.002 : R - 0.004), r => (edge > 0 ? tangentialAt(frames[r], edge).negate() : tangentialAt(frames[r], edge)))
    return withPhase(wall, i => pipePhase(s0 + ((s1 - s0) * Math.floor(i / 2)) / rows))
  }))

  // ── LED bars with chrome ribs between them, spread evenly along the channel ──
  const span = s1 - s0 - 0.04
  const count = Math.max(1, Math.round((span + LED.rib) / (LED.length + LED.rib)))
  const pitch = (span + LED.rib) / count
  const windows = []
  for (let k = 0; k < count; k += 1) {
    const a = s0 + 0.02 + k * pitch, b = a + pitch - LED.rib
    const rows = 8, cols = 8
    const frames = Array.from({ length: rows + 1 }, (_, r) => frameAt(a + ((b - a) * r) / rows))
    // A domed bar with rounded ends: the width and the dome pinch in over the last few rows at each end.
    const pinch = r => Math.sqrt(Math.max(0, 1 - Math.pow((2 * r) / rows - 1, 8)))
    const bar = gridMesh(rows, cols, (r, c) => {
      const u = (2 * c) / cols - 1
      const w = pinch(r)
      const theta = u * LED.half * Math.max(0.05, w)
      const lift = LED.height * Math.sqrt(Math.max(0, 1 - u * u)) * Math.sqrt(w)
      return frames[r].centre.clone().addScaledVector(dirAt(frames[r], theta), CHANNEL.floor + 0.003 + lift)
    }, (r, c) => dirAt(frames[r], ((2 * c) / cols - 1) * LED.half))
    windows.push({ ...withPhase(bar, i => pipePhase(a + ((b - a) * Math.floor(i / (cols + 1))) / rows)), id: k })
    if (k < count - 1) {
      pipe.push(sweep(b, b + LED.rib, -H, H, () => LED.ribTop, 8, undefined, 0.01))
      channel.push(endWall(b, LED.ribTop, -1), endWall(b + LED.rib, LED.ribTop, 1))
    }
  }

  // ── Flange: lathe-turned along its axis, bolts round the disc, a glowing ring in its groove ──
  const flangeProfile = [
    [0, -0.03], [0.86, -0.03], [0.9, -0.01], [0.9, 0.04], [0.86, 0.06], [0.72, 0.06], [0.72, 0.075],
    [0.66, 0.075], [0.69, 0.095], [0.69, 0.165], [0.66, 0.185],
    [0.57, 0.185], [0.57, 0.175], [0.49, 0.175], [0.49, 0.2],
    [0.46, 0.22], [0.45, 0.3], [0.41, 0.33],
    [0.3, 0.33], [0.28, 0.35], [0.28, 0.45], [0.25, 0.47], [(R * 1.02) / FLANGE_SCALE, 0.5],
  ]
  const flangeParts = [lathe(flangeProfile, 48)]
  const hex = lathe([[0, 0], [0.034, 0], [0.034, 0.03], [0.026, 0.042], [0, 0.042]], 6)
  for (let k = 0; k < 16; k += 1) {
    const angle = (k / 16) * Math.PI * 2
    flangeParts.push(placed(hex, new THREE.Vector3(Math.cos(angle) * 0.62, 0.185, Math.sin(angle) * 0.62), new THREE.Vector3(0, 1, 0)))
  }
  const flangeGlow = glowRing(0.49, 0.555, 0.176, 0.2)
  const inFlange = mesh => placed(transformed(mesh, new THREE.Matrix4().makeScale(FLANGE_SCALE, FLANGE_SCALE, FLANGE_SCALE)), flange, axis)

  // ── Coupler: one lathe profile along the straight approach, y in units of the coupler length ──
  const L = COUPLER_LENGTH
  /** A coupler radius: `m` times the pipe radius as modelled, with the bulge above the pipe slimmed by COUPLER_BULGE. */
  const cr = m => R * (1 + (m - 1) * COUPLER_BULGE)
  const couplerProfile = [
    [R * 0.98, -0.02], [cr(1.0), 0], [cr(1.48), 0], [cr(1.62), 0.025 * L], [cr(1.62), 0.1 * L], [cr(1.48), 0.125 * L],
    [cr(1.34), 0.125 * L], [cr(1.34), 0.2 * L], [cr(1.26), 0.205 * L], [cr(1.26), 0.225 * L], [cr(1.34), 0.23 * L], [cr(1.34), 0.36 * L],
    [cr(1.1), 0.365 * L], [cr(1.1), 0.475 * L], [cr(1.34), 0.48 * L],
    [cr(1.34), 0.6 * L], [cr(1.27), 0.605 * L], [cr(1.27), 0.62 * L], [cr(1.34), 0.625 * L], [cr(1.34), 0.72 * L],
    [cr(1.5), 0.725 * L], [cr(1.56), 0.745 * L], [cr(1.56), 0.83 * L], [cr(1.5), 0.85 * L],
    [cr(1.22), 0.855 * L], [cr(1.22), 0.9 * L],
    [cr(1.48), 0.905 * L], [cr(1.62), 0.925 * L], [cr(1.62), 0.98 * L], [cr(1.4), L], [cr(1.4), L + 0.05], [R * 0.9, L + 0.05],
  ]
  const couplerParts = [withPhase(lathe(couplerProfile, 40), (i, mesh) => couplerPhase(Math.min(L, Math.max(0, mesh.positions[i * 3 + 1]))))]
  // The slim socket spans the collar-to-outline gap, finishing just behind the raised chrome face. No wide metal crosses the letter silhouette.
  const socketLength = COLLAR_SETBACK + SOCKET_SINK
  const socketProfile = [
    [R * 0.9, L + 0.025], [R * 0.9, L + 0.055], [R * 0.64, L + 0.09],
    [R * 0.64, L + socketLength - 0.03], [R * 0.55, L + socketLength],
  ]
  couplerParts.push(withPhase(lathe(socketProfile, 32), 1))
  // Slotted blocks over the first gap; the glow shows between them.
  const block = roundedBox(0.035, 0.105 * L, 0.035, 0.009)
  for (let k = 0; k < 10; k += 1) {
    const angle = (k / 10) * Math.PI * 2 + 0.2
    const r = cr(1.23)
    couplerParts.push(withPhase(placed(block, new THREE.Vector3(Math.cos(angle) * r, 0.42 * L, Math.sin(angle) * r), new THREE.Vector3(0, 1, 0), -angle), couplerPhase(0.42 * L)))
  }
  const couplerGlows = [
    { mesh: glowRing(cr(1.08), cr(1.2), 0.37 * L, 0.47 * L), y: 0.42 * L },
    { mesh: glowRing(cr(1.2), cr(1.3), 0.857 * L, 0.898 * L), y: 0.88 * L },
    { mesh: glowRing(cr(1.24), cr(1.3), 0.203 * L, 0.227 * L), y: 0.215 * L },
  ]
  const inCoupler = mesh => placed(mesh, couplerStart, arrive)

  return {
    pipe: merged(pipe, ['phases']),
    channel: merged(channel, ['phases']),
    flange: withPhase(merged(flangeParts.map(inFlange)), 0),
    coupler: merged(couplerParts.map(part => ({ ...inCoupler(part), phases: part.phases })), ['phases']),
    energy: [
      ...windows,
      { ...withPhase(inFlange(flangeGlow), 0), id: 'flange' },
      ...couplerGlows.map(({ mesh, y }, k) => ({ ...withPhase(inCoupler(mesh), couplerPhase(y)), id: `coupler-${k}` })),
    ],
    windowCount: count,
  }
}

/** Attaches the glow layout: `_GLOW_PHASE` from the mesh's phases and `_SEGMENT` = [group, phase, side, random]. */
function withGlow(mesh, group, side, randomOf = () => 0) {
  const count = mesh.positions.length / 3
  const phases = new Float32Array(mesh.phases), segments = new Float32Array(count * 4)
  const systems = new Float32Array(count), routes = new Float32Array(count), regions = new Float32Array(count), networkPhases = new Float32Array(count)
  const route = Math.round(group * 3)
  for (let i = 0; i < count; i += 1) {
    segments.set([group, phases[i], side, randomOf(i)], i * 4)
    systems[i] = 0 // tube feed
    routes[i] = route
    regions[i] = route // upper-left, lower-left, upper-right, lower-right
    networkPhases[i] = phases[i]
  }
  return { ...mesh, phases, attributes: {
    _SEGMENT: { array: segments, type: 'VEC4' },
    _CONDUIT_SYSTEM: { array: systems, type: 'SCALAR' },
    _CONDUIT_ROUTE: { array: routes, type: 'SCALAR' },
    _CONDUIT_REGION: { array: regions, type: 'SCALAR' },
    _CONDUIT_PHASE: { array: networkPhases, type: 'SCALAR' },
  } }
}

const meshes = []
const tubes = [
  ...LEFT_TUBES.map((spec, k) => ({ spec, side: -1, group: k === 0 ? 0 : 1 / 3 })),
  ...LEFT_TUBES.map((spec, k) => ({ spec, side: 1, group: k === 0 ? 2 / 3 : 1 })),
]
let windowTotal = 0
for (const { spec, side, group } of tubes) {
  const built = buildLeftTube(spec)
  const place = mesh => (side < 0 ? mesh : { ...mirroredX(mesh), phases: mesh.phases })
  const label = `${side < 0 ? 'left' : 'right'}-${spec.name}`
  for (const part of ['pipe', 'channel', 'flange', 'coupler']) meshes.push(withGlow({ name: `${part}-${label}`, part, ...place(built[part]) }, group, side))
  // Energy: each bar and ring its own segment with its own random identity.
  const energy = merged(built.energy.map(piece => ({ ...place(piece), phases: piece.phases, random: Array.from({ length: piece.positions.length / 3 }, () => hash(`${label}:${piece.id}`)) })), ['phases', 'random'])
  meshes.push(withGlow({ name: `energy-${label}`, part: 'energy', ...energy }, group, side, i => energy.random[i]))
  windowTotal += built.windowCount
}

const result = writeGlb(outputPath, meshes, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-conduit-tubes.mjs', 'conduit-tubes')
console.log(`Wrote ${outputPath}`)
console.log(`  ${result.triangles} triangles, ${(result.byteLength / 1024).toFixed(0)} KB, parts ${result.parts.join(', ')}, ${windowTotal} LED bars`)
