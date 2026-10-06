// Generates ATL HOE's complete Atlanta night scene as a single, in-house GLB.
// The preset camera looks down -Z; the Waffle House sign sits in the foreground
// while the four landmark silhouettes occupy progressively deeper skyline layers.
//
//   node scripts/cinema2-assets/generate-atl-hoe.mjs [out.glb]
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { hash, writeGlb } from './cinema2-tube-kit.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputPath = process.argv[2] ? resolve(process.argv[2]) : join(root, 'public/cinema2/models/atl-hoe.glb')

const MATERIALS = {
  // A dark backing plane closes the world behind the sky bands; the visible sky is the stack of skyBandNN strips built below.
  sky: { baseColorFactor: [0, 0, 0, 1], metallicFactor: 0, roughnessFactor: 1, emissiveFactor: [0.02, 0.07, 0.17] },
  stars: { baseColorFactor: [0.5, 0.65, 0.8, 1], metallicFactor: 0, roughnessFactor: 0.7, emissiveFactor: [0.75, 0.9, 1] },
  buildings: { baseColorFactor: [0.05, 0.075, 0.092, 1], metallicFactor: 0.45, roughnessFactor: 0.72 },
  distantBuildings: { baseColorFactor: [0.026, 0.05, 0.072, 1], metallicFactor: 0.25, roughnessFactor: 0.9 },
  midBuildings: { baseColorFactor: [0.045, 0.068, 0.085, 1], metallicFactor: 0.38, roughnessFactor: 0.76 },
  nearBuildings: { baseColorFactor: [0.06, 0.078, 0.09, 1], metallicFactor: 0.42, roughnessFactor: 0.68 },
  landmarkDark: { baseColorFactor: [0.075, 0.1, 0.118, 1], metallicFactor: 0.5, roughnessFactor: 0.58 },
  landmarkGlass: { baseColorFactor: [0.085, 0.12, 0.165, 1], metallicFactor: 0.72, roughnessFactor: 0.22 },
  // The model's tower is pale concrete with glass, so at night its stone catches the moon: a mid grey-blue body and a lighter crown and piers.
  bofaGlass: { baseColorFactor: [0.14, 0.06, 0.045, 1], metallicFactor: 0.35, roughnessFactor: 0.45 },
  bofaRib: { baseColorFactor: [0.012, 0.01, 0.012, 1], metallicFactor: 0.2, roughnessFactor: 0.4 },
  bofaCore: { baseColorFactor: [0.03, 0.015, 0.008, 1], metallicFactor: 0, roughnessFactor: 0.8, emissiveFactor: [0.55, 0.25, 0.06] },
  bofaStone: { baseColorFactor: [0.26, 0.12, 0.085, 1], metallicFactor: 0.15, roughnessFactor: 0.7 },
  bofaGlow: { baseColorFactor: [0.5, 0.2, 0.05, 1], metallicFactor: 0, roughnessFactor: 0.6, emissiveFactor: [1, 0.45, 0.12] },
  truistBody: { baseColorFactor: [0.075, 0.09, 0.115, 1], metallicFactor: 0.3, roughnessFactor: 0.6 },
  truistCrown: { baseColorFactor: [0.2, 0.215, 0.24, 1], metallicFactor: 0.2, roughnessFactor: 0.7 },
  truistWindows: { baseColorFactor: [0.02, 0.35, 0.4, 1], metallicFactor: 0, roughnessFactor: 0.4, emissiveFactor: [0.15, 0.9, 0.9] },
  glassWindows: { baseColorFactor: [0.04, 0.07, 0.1, 1], metallicFactor: 0, roughnessFactor: 0.4, emissiveFactor: [0.22, 0.33, 0.46] },
  crownCool: { baseColorFactor: [0.5, 0.7, 0.75, 1], metallicFactor: 0, roughnessFactor: 0.4, emissiveFactor: [0.6, 0.9, 1] },
  warmWindows: { baseColorFactor: [0.7, 0.32, 0.045, 1], metallicFactor: 0, roughnessFactor: 0.46, emissiveFactor: [1, 0.43, 0.055] },
  cyanWindows: { baseColorFactor: [0.02, 0.42, 0.56, 1], metallicFactor: 0, roughnessFactor: 0.4, emissiveFactor: [0.02, 0.65, 0.9] },
  gpStone: { baseColorFactor: [0.075, 0.07, 0.062, 1], metallicFactor: 0.1, roughnessFactor: 0.85 },
  gpStoneB: { baseColorFactor: [0.1, 0.093, 0.083, 1], metallicFactor: 0.1, roughnessFactor: 0.85 },
  gpStoneC: { baseColorFactor: [0.13, 0.12, 0.106, 1], metallicFactor: 0.1, roughnessFactor: 0.85 },
  gpLedge: { baseColorFactor: [0.22, 0.2, 0.17, 1], metallicFactor: 0.2, roughnessFactor: 0.6 },
  gpSlot: { baseColorFactor: [0.012, 0.013, 0.016, 1], metallicFactor: 0.2, roughnessFactor: 0.7 },
  crownWhite: { baseColorFactor: [0.9, 0.85, 0.7, 1], metallicFactor: 0, roughnessFactor: 0.4, emissiveFactor: [1, 0.92, 0.72] },
  beacon: { baseColorFactor: [0.5, 0.02, 0.02, 1], metallicFactor: 0, roughnessFactor: 0.5, emissiveFactor: [1, 0.05, 0.03] },
  crown: { baseColorFactor: [0.92, 0.46, 0.035, 1], metallicFactor: 0.18, roughnessFactor: 0.3, emissiveFactor: [1, 0.48, 0.045] },
  // The night sign: near-black painted steel (cabinet, base rail and legs = signMetal; cell frames = signBorder; the faint edge rails and
  // rivets that catch a cool rim light = signTrim), a flat, bright yellow face in each cell (signGlow) and flat black letters (signLetters).
  signMetal: { baseColorFactor: [0.012, 0.013, 0.016, 1], metallicFactor: 0.55, roughnessFactor: 0.38, emissiveFactor: [0.002, 0.003, 0.006] },
  signTrim: { baseColorFactor: [0.06, 0.07, 0.085, 1], metallicFactor: 0.7, roughnessFactor: 0.28, emissiveFactor: [0.004, 0.006, 0.012] },
  signGlow: { baseColorFactor: [1, 0.78, 0, 1], metallicFactor: 0, roughnessFactor: 0.5, emissiveFactor: [1, 0.65, 0.01] },
  signBorder: { baseColorFactor: [0.006, 0.007, 0.009, 1], metallicFactor: 0.45, roughnessFactor: 0.42, emissiveFactor: [0.001, 0.002, 0.004] },
  signLetters: { baseColorFactor: [0.004, 0.004, 0.004, 1], metallicFactor: 0, roughnessFactor: 0.82 },
  lampGlow: { baseColorFactor: [0.4, 0.18, 0.04, 1], metallicFactor: 0, roughnessFactor: 1, emissiveFactor: [1, 0.45, 0.1] },
  roadPole: { baseColorFactor: [0.09, 0.09, 0.1, 1], metallicFactor: 0.4, roughnessFactor: 0.5 },
  // Matte near-black so the warm city light does not blaze off the decks' top faces, which the camera sees from above.
  road: { baseColorFactor: [0.01, 0.012, 0.014, 1], metallicFactor: 0, roughnessFactor: 1 },
  roadGlow: { baseColorFactor: [0.14, 0.055, 0.012, 1], metallicFactor: 0, roughnessFactor: 0.65, emissiveFactor: [0.28, 0.075, 0.006] },
  // Near-black leaves with only a trace of blue-green; the warm city light picks out their city-facing edges.
  foliageBack: { baseColorFactor: [0.003, 0.006, 0.009, 1], metallicFactor: 0, roughnessFactor: 1 },
  foliage: { baseColorFactor: [0.003, 0.006, 0.009, 1], metallicFactor: 0, roughnessFactor: 1 },
  // The faint rosettes inside the mass are lit by emission alone, so they read at one steady dim blue-green whatever the lights do.
  foliageFaint: { baseColorFactor: [0.01, 0.03, 0.04, 1], metallicFactor: 0, roughnessFactor: 1, emissiveFactor: [0.05, 0.14, 0.2] },
  foliageLit: { baseColorFactor: [0.4, 0.2, 0.05, 1], metallicFactor: 0, roughnessFactor: 0.8, emissiveFactor: [1, 0.5, 0.1] },
}

const byPart = new Map()
const matrix = new THREE.Matrix4()
const euler = new THREE.Euler()
const quaternion = new THREE.Quaternion()
const scale = new THREE.Vector3()
const position = new THREE.Vector3()

function addGeometry(part, source, { at = [0, 0, 0], size = [1, 1, 1], rotate = [0, 0, 0], name = part, parentMatrix = null } = {}) {
  const geometry = source.clone()
  position.set(...at); scale.set(...size); euler.set(...rotate); quaternion.setFromEuler(euler)
  matrix.compose(position, quaternion, scale)
  if (parentMatrix) matrix.premultiply(parentMatrix)
  geometry.applyMatrix4(matrix)
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
  const indexed = geometry.index ? geometry : mergeVertices(geometry, 1e-6)
  const positions = new Float32Array(indexed.getAttribute('position').array)
  const normals = new Float32Array(indexed.getAttribute('normal').array)
  const indices = Uint32Array.from(indexed.index.array)
  const phases = new Float32Array(positions.length / 3)
  const list = byPart.get(part) ?? []
  list.push({ name, part, positions, normals, indices, phases })
  byPart.set(part, list)
  geometry.dispose()
}

const box = (part, at, size, rotate = [0, 0, 0], name) => addGeometry(part, new THREE.BoxGeometry(1, 1, 1), { at, size, rotate, name })
const cylinder = (part, at, radius, height, segments = 24, rotate = [0, 0, 0], name) => addGeometry(part, new THREE.CylinderGeometry(radius, radius, height, segments, 1, false), { at, rotate, name })

function mergePart(part, list) {
  const positions = [], normals = [], indices = [], phases = []
  for (const item of list) {
    const base = positions.length / 3
    positions.push(...item.positions); normals.push(...item.normals); phases.push(...item.phases)
    for (const index of item.indices) indices.push(base + index)
  }
  return { name: part, part, positions: new Float32Array(positions), normals: new Float32Array(normals), indices: Uint32Array.from(indices), phases: new Float32Array(phases) }
}

// ── Sky ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The GLB carries one flat material per part, so the night-sky gradient is a stack of thin horizontal strips (skyBand00 …), each its own
// part with an emissive colour taken from the gradient below. The gradient is authored in the colours the *rendered* frame should show
// (sRGB, sampled from the reference): a deep navy at the top that lightens and cools toward the horizon, then a faint warm-grey haze
// just below the horizon line that the city will stand in, fading to a dark base. The strips are lit by emission alone, so the
// emissive value is found by inverting the render pipeline's measured response (exposure, fog and finish) for each channel.
const SKY_Z = -34
const SKY_STOPS = [
  [34, [8, 34, 72]], [28, [9, 36, 76]], [19, [11, 38, 79]], [15, [14, 40, 82]], [11, [19, 47, 93]], [7, [26, 54, 103]],
  [3.2, [28, 58, 110]], [1, [31, 60, 106]], [-0.5, [40, 61, 94]], [-3, [38, 55, 80]], [-7, [30, 44, 68]], [-16, [20, 34, 56]],
]
// Approximate render response per channel: displayed = gain * emissive ^ exponent. The finish also darkens toward the frame's top and
// bottom, so SKY_CORRECTION trims each strip's emissive by the ratio measured between its captured colour and its target at the 16:9
// checkpoint. Re-measure it (capture, compare each strip with SKY_STOPS) whenever exposure, fog or the cinematic finish change.
const SKY_RESPONSE = [{ gain: 1.05, exponent: 0.5 }, { gain: 1.05, exponent: 0.5 }, { gain: 1.05, exponent: 0.5 }]
// SKY_CORRECTION_BEGIN
const SKY_CORRECTION = [[7.2026,2.1114,1.1433],[7.2026,2.1114,1.1433],[7.2026,2.1114,1.1433],[7.2026,2.1114,1.1433],[6.1769,1.953,1.0859],[5.1926,1.885,1.0551],[4.7171,1.821,1.0067],[4.5924,1.7663,1.0],[3.6058,1.7321,0.9814],[3.2495,1.7024,0.9641],[3.3359,1.6619,0.9313],[3.1335,1.5776,0.9167],[2.9821,1.5517,0.9032],[2.9479,1.5515,0.9014],[2.7919,1.531,0.8897],[2.6722,1.4851,0.8928],[2.571,1.4694,0.8821],[2.4903,1.4736,0.872],[2.5217,1.4792,0.877],[2.5398,1.4585,0.8871],[2.6067,1.4582,0.8901],[2.6397,1.5047,0.886],[2.6414,1.4946,0.8956],[2.8004,1.5149,0.9164],[2.7778,1.5516,0.9301],[2.8179,1.5851,0.9466],[2.7895,1.6191,0.9645],[2.9098,1.6745,0.9974],[2.9588,1.7001,1.0305],[2.8098,1.7806,1.0818],[2.8452,1.8697,1.1229],[2.9889,2.0396,1.2005],[3.3085,2.1728,1.2739],[3.1828,2.1259,1.2545],[2.9863,2.0645,1.2347],[3.0283,2.0696,1.237],[3.0563,2.0399,1.2365],[3.0753,2.0883,1.2603],[3.1771,2.121,1.274],[3.2497,2.164,1.3384],[3.2967,2.2191,1.3715],[3.2967,2.2191,1.3715]]
// SKY_CORRECTION_END
function skyTargetAt(y) {
  for (let i = 0; i < SKY_STOPS.length - 1; i += 1) {
    const [y0, c0] = SKY_STOPS[i], [y1, c1] = SKY_STOPS[i + 1]
    if (y <= y0 && y >= y1) { const t = (y0 - y) / (y0 - y1); return c0.map((v, k) => v + (c1[k] - v) * t) }
  }
  return (y > SKY_STOPS[0][0] ? SKY_STOPS[0][1] : SKY_STOPS.at(-1)[1])
}
const skyEmissiveFor = (display, index) => display.map((value, channel) => {
  const { gain, exponent } = SKY_RESPONSE[channel]
  return Math.min(1, (value / 255 / gain) ** (1 / exponent) * (SKY_CORRECTION[index]?.[channel] ?? 1))
})
// Strip edges, from the top of the frame down: coarse where the gradient is slow, fine around the horizon where it turns.
const skyEdges = []
for (let y = 34; y > 14; y -= 2) skyEdges.push(y)
for (let y = 14; y > 5 + 1e-9; y -= 0.9) skyEdges.push(y)
for (let y = 5; y > -3 + 1e-9; y -= 0.5) skyEdges.push(y)
for (let y = -3; y >= -16; y -= 2) skyEdges.push(y)
box('sky', [0, 10, SKY_Z - 0.6], [140, 70, 0.25])
for (let i = 0; i < skyEdges.length - 1; i += 1) {
  const top = skyEdges[i], bottom = skyEdges[i + 1]
  const part = `skyBand${String(i).padStart(2, '0')}`
  MATERIALS[part] = { baseColorFactor: [0, 0, 0, 1], metallicFactor: 0, roughnessFactor: 1, emissiveFactor: skyEmissiveFor(skyTargetAt((top + bottom) / 2), i) }
  box(part, [0, (top + bottom) / 2, SKY_Z], [140, top - bottom, 0.1])
}
// The tall embedded Stage preview opens far more sky above and below the 16:9 frame, so two caps continue the gradient's end colours
// (using their neighbouring strip's correction) well past the visible range instead of letting the backing plane show.
const skyStripCount = skyEdges.length - 1
MATERIALS.skyCapTop = { baseColorFactor: [0, 0, 0, 1], metallicFactor: 0, roughnessFactor: 1, emissiveFactor: skyEmissiveFor(skyTargetAt(skyEdges[0] + 1), 0) }
box('skyCapTop', [0, (skyEdges[0] + 140) / 2, SKY_Z], [140, 140 - skyEdges[0], 0.1])
MATERIALS.skyCapBottom = { baseColorFactor: [0, 0, 0, 1], metallicFactor: 0, roughnessFactor: 1, emissiveFactor: skyEmissiveFor(skyTargetAt(skyEdges.at(-1) - 1), skyStripCount - 1) }
box('skyCapBottom', [0, (skyEdges.at(-1) - 100) / 2, SKY_Z], [140, skyEdges.at(-1) + 100, 0.1])
// Stars: fewer and finer than before, thinning toward the horizon. They sit just in front of the bands so they keep parallax and bloom.
for (let i = 0; i < 120; i += 1) {
  const x = -36 + hash(`star-x-${i}`) * 72
  const y = 6 + (1 - hash(`star-y-${i}`) ** 1.8) * 22
  const z = SKY_Z + 0.25 + hash(`star-z-${i}`) * 0.08
  const s = 0.024 + hash(`star-s-${i}`) ** 4 * 0.075
  box('stars', [x, y, z], [s, s, s * 0.35])
}

function windowsOnFront({ key, x, y, z, width, height, cols, rows, cyanEvery = 0, warmChance = 0.58, sizeVariation = 0 }) {
  const dx = width / cols, dy = height / rows
  for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
    if (hash(`${key}:${row}:${col}`) > warmChance) continue
    const part = cyanEvery > 0 && (row + col * 3) % cyanEvery === 0 ? 'cyanWindows' : 'warmWindows'
    const jitter = 1 - sizeVariation * hash(`${key}:size:${row}:${col}`)
    box(part, [x - width / 2 + dx * (col + 0.5), y - height / 2 + dy * (row + 0.5), z], [dx * 0.52 * jitter, dy * 0.42 * jitter, 0.035])
  }
}

function windowsOnSide({ key, x, y, z, depth, height, cols, rows, warmChance = 0.34 }) {
  const dz = depth / cols, dy = height / rows
  for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
    if (hash(`${key}:side:${row}:${col}`) > warmChance) continue
    box('warmWindows', [x, y - height / 2 + dy * (row + 0.5), z - depth / 2 + dz * (col + 0.5)], [0.035, dy * 0.36, dz * 0.45])
  }
}

function blockBuilding(key, x, width, height, z, depth, options = {}) {
  box(options.part ?? 'buildings', [x, height / 2, z], [width, height, depth])
  windowsOnFront({ key, x, y: height * 0.52, z: z + depth / 2 + 0.03, width: width * 0.84, height: height * 0.83, cols: options.cols ?? Math.max(3, Math.round(width * 2.2)), rows: options.rows ?? Math.max(5, Math.round(height * 1.45)), cyanEvery: options.cyanEvery ?? 0, warmChance: options.warmChance ?? 0.52 })
}

function frontRibs({ x, y, z, width, height, count, depth = 0.09, inset = 0 }) {
  for (let i = 0; i < count; i += 1) {
    const ribX = x - width / 2 + inset + ((width - inset * 2) * i) / (count - 1)
    box('signTrim', [ribX, y, z], [0.045, height, depth])
  }
}

function floorBands({ x, y0, z, width, floors, spacing, depth = 0.08 }) {
  for (let floor = 0; floor <= floors; floor += 1) box('signTrim', [x, y0 + floor * spacing, z], [width, 0.035, depth])
}

// ── Skyline (Phase 3: silhouettes only) ─────────────────────────────────────────────────────────────────────────────────────
// Every building is placed from the reference frame (1672 × 941): `refPoint(u, v, z)` finds the world x / y that the preset camera sees at
// reference pixel (u, v) on the plane z, so each shape below is written in the pixels of the picture it copies and keeps that position
// whatever depth it stands at. The camera numbers mirror Cinema2AtlHoePreset (position, target, 42° vertical FOV, 16:9).
const REF_W = 1672, REF_H = 941
const REF_CAMERA = { position: [0, 5.9, 20], target: [-0.4, 6.55, -8.4], fov: 42, aspect: 16 / 9 }
function refPoint(u, v, z) {
  const { position, target, fov, aspect } = REF_CAMERA
  const d = target.map((value, i) => value - position[i])
  const dn = Math.hypot(...d)
  const f = d.map(value => value / dn)
  const rightRaw = [-f[2], 0, f[0]]
  const rn = Math.hypot(...rightRaw)
  const right = rightRaw.map(value => value / rn)
  const up = [right[1] * f[2] - right[2] * f[1], right[2] * f[0] - right[0] * f[2], right[0] * f[1] - right[1] * f[0]]
  const th = Math.tan(THREE.MathUtils.degToRad(fov / 2))
  const nx = (u / REF_W) * 2 - 1, ny = 1 - (v / REF_H) * 2
  const ray = f.map((value, i) => value + right[i] * nx * th * aspect + up[i] * ny * th)
  const t = (z - position[2]) / ray[2]
  return [position[0] + ray[0] * t, position[1] + ray[1] * t]
}
// A block's rows are read at its middle column (clamped to the frame): the camera is yawed a little, so a row's world height drifts with
// the column, and reading the two ends would tilt or thicken a very wide band such as the road.
const refUy = (u0, u1) => Math.min(REF_W, Math.max(0, (u0 + u1) / 2))
// Buildings run well below the frame so the tall Stage preview never shows a floating base.
const REF_BASE_V = 1700
/** A block between reference columns u0..u1, from reference row vTop down to the base, `depth` deep, centred on plane z. */
function refBlock(part, u0, u1, vTop, z, depth, name) {
  // Both edges are read on the same row: the camera is yawed a little, so x drifts with the row and reading the base row would skew a tall block.
  const [x0] = refPoint(u0, vTop, z), [x1] = refPoint(u1, vTop, z)
  const [, yTop] = refPoint(refUy(u0, u1), vTop, z), [, yBase] = refPoint(refUy(u0, u1), REF_BASE_V, z)
  box(part, [(x0 + x1) / 2, (yTop + yBase) / 2, z], [Math.abs(x1 - x0), yTop - yBase, depth], [0, 0, 0], name)
}
/** A block floating between two reference rows (a crown tier, a ring). */
function refBand(part, u0, u1, vTop, vBottom, z, depth, name) {
  const [x0] = refPoint(u0, vTop, z), [x1] = refPoint(u1, vTop, z)
  const [, yTop] = refPoint(refUy(u0, u1), vTop, z), [, yBottom] = refPoint(refUy(u0, u1), vBottom, z)
  box(part, [(x0 + x1) / 2, (yTop + yBottom) / 2, z], [Math.abs(x1 - x0), yTop - yBottom, depth], [0, 0, 0], name)
}
/** A round tube (tower, ring, mast) between reference columns u0..u1 and rows vTop..vBottom. */
function refRound(part, u0, u1, vTop, vBottom, z, name, segments = 40) {
  const [x0] = refPoint(u0, vTop, z), [x1] = refPoint(u1, vTop, z)
  const [, yTop] = refPoint(refUy(u0, u1), vTop, z), [, yBottom] = refPoint(refUy(u0, u1), vBottom, z)
  const radius = Math.abs(x1 - x0) / 2
  cylinder(part, [(x0 + x1) / 2, (yTop + yBottom) / 2, z], radius, yTop - yBottom, segments, [0, 0, 0], name)
  return radius
}

// Landmarks stand on one plane. Fill buildings sit in three bands: far (low contrast), mid (behind the landmarks) and near (in front of
// their bases, as in the reference).
const LANDMARK_Z = -16
const FAR_Z = -28, MID_Z = -21, NEAR_Z = -12

// Bank of America Plaza, from an owner-supplied model, night render and elevation drawing: a very slender rose-granite shaft whose facade is
// long vertical ribs of dark glass between wide piers, one setback partway up (a wider lower shaft, a narrower upper one), a projecting
// cornice, then a crown of three truncated pyramids stacked with horizontal shelves between them (15–25° walls, steeper in the middle),
// each an open steel lattice of horizontal bands, converging verticals and X bracing; a flat platform, a faceted mast and a thin antenna.
// It is the tallest building in the scene. The shaft keeps the earlier model's placement (model x 836.5 = reference u 945, model y 15 = v 40,
// 0.985 reference pixels per model pixel); the crown is traced from the drawing, whose upper-shaft width of 615 drawing pixels is 159
// reference pixels, so one drawing pixel is K = 0.2585 reference pixels and the drawing's y 822 (crown base) sits at v 257.
const boaU = x => 945 + (x - 836.5) * 0.985
const boaV = y => 40 + (y - 15) * 0.985
const BOA_LOWER = [735, 938], BOA_UPPER = [757, 918], BOA_SETBACK_Y = 440, BOA_PLATFORM_Y = 235
// The front faces of the shaft stand on one plane (FZ), so the reference pixels they are read from are exact; each shaft is as deep as it is
// wide. `boaBlock` / `boaBand` read columns and rows on FZ and put the box's front face at `front`.
const FZ = LANDMARK_Z
function boaBlock(part, u0, u1, vTop, front, depth, name) {
  const [x0] = refPoint(u0, vTop, FZ), [x1] = refPoint(u1, vTop, FZ)
  const [, yTop] = refPoint(refUy(u0, u1), vTop, FZ), [, yBase] = refPoint(refUy(u0, u1), REF_BASE_V, FZ)
  box(part, [(x0 + x1) / 2, (yTop + yBase) / 2, front - depth / 2], [Math.abs(x1 - x0), yTop - yBase, depth], [0, 0, 0], name)
}
function boaBand(part, u0, u1, vTop, vBottom, front, depth, name) {
  const [x0] = refPoint(u0, vTop, FZ), [x1] = refPoint(u1, vTop, FZ)
  const [, yTop] = refPoint(refUy(u0, u1), vTop, FZ), [, yBottom] = refPoint(refUy(u0, u1), vBottom, FZ)
  box(part, [(x0 + x1) / 2, (yTop + yBottom) / 2, front - depth / 2], [Math.abs(x1 - x0), yTop - yBottom, depth], [0, 0, 0], name)
}
/** A square-section steel member between two 3D points. */
function strut(part, from, to, thickness, name) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to)
  const direction = b.clone().sub(a)
  const length = direction.length()
  const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()))
  addGeometry(part, new THREE.BoxGeometry(1, 1, 1), { at: [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2], size: [thickness, length, thickness], rotate: [euler.x, euler.y, euler.z], name })
}
const boaWidth = (u0, u1) => Math.abs(refPoint(u1, 300, FZ)[0] - refPoint(u0, 300, FZ)[0])
const upperFront = FZ, lowerFront = FZ + 0.1
boaBlock('bofaGlass', boaU(BOA_LOWER[0]), boaU(BOA_LOWER[1]), boaV(BOA_SETBACK_Y), lowerFront, boaWidth(boaU(BOA_LOWER[0]), boaU(BOA_LOWER[1])), 'boa-lower-shaft')
boaBlock('bofaGlass', boaU(BOA_UPPER[0]), boaU(BOA_UPPER[1]), boaV(BOA_PLATFORM_Y), upperFront, boaWidth(boaU(BOA_UPPER[0]), boaU(BOA_UPPER[1])), 'boa-upper-shaft')
// Wide granite piers (one edge lit copper-orange for the night view) with, between them, long thin dark ribs of glass.
const BOA_PIERS = [[735, 752, BOA_SETBACK_Y, lowerFront], [818, 838, BOA_SETBACK_Y, lowerFront], [858, 876, BOA_SETBACK_Y, lowerFront], [920, 938, BOA_SETBACK_Y, lowerFront],
  [757, 773, BOA_PLATFORM_Y, upperFront], [826, 846, BOA_PLATFORM_Y, upperFront], [902, 918, BOA_PLATFORM_Y, upperFront]]
for (const [i, [x0, x1, yTop, front]] of BOA_PIERS.entries()) {
  boaBlock('bofaStone', boaU(x0), boaU(x1), boaV(yTop), front + 0.15, 0.4, `boa-pier-${i}`)
  boaBlock('bofaGlow', boaU(x1) - 3.6, boaU(x1), boaV(yTop), front + 0.18, 0.1, `boa-pier-glow-${i}`)
  boaBlock('bofaGlow', boaU(x0), boaU(x0) + 1.2, boaV(yTop), front + 0.18, 0.1, `boa-pier-glow-left-${i}`)
}
for (const [section, gaps, yTop, front] of [
  ['upper', [[773, 826], [846, 902]], BOA_PLATFORM_Y + 8, upperFront],
  ['lower', [[752, 818], [838, 858], [876, 920]], BOA_SETBACK_Y + 8, lowerFront],
]) {
  for (const [g, [g0, g1]] of gaps.entries()) {
    for (let u = boaU(g0) + 2; u < boaU(g1) - 2; u += 4) {
      boaBlock('bofaRib', u, u + 1.8, boaV(yTop), front + 0.05, 0.05, `boa-rib-${section}-${g}-${Math.round(u)}`)
    }
  }
}
// Granite ledge at the setback, and the projecting cornice under the crown with a lit gold edge.
boaBand('bofaStone', boaU(BOA_LOWER[0]) - 3, boaU(BOA_LOWER[1]) + 3, boaV(BOA_SETBACK_Y), boaV(BOA_SETBACK_Y) + 7, lowerFront + 0.4, 0.6, 'boa-setback-ledge')
boaBand('bofaStone', boaU(BOA_UPPER[0]) - 5, boaU(BOA_UPPER[1]) + 5, boaV(BOA_PLATFORM_Y) - 4, boaV(BOA_PLATFORM_Y) + 4, upperFront + 0.4, 0.6, 'boa-cornice')
boaBand('crown', boaU(BOA_UPPER[0]) - 5, boaU(BOA_UPPER[1]) + 5, boaV(BOA_PLATFORM_Y) - 4, boaV(BOA_PLATFORM_Y) - 3, upperFront + 0.43, 0.05, 'boa-cornice-edge')

// The crown, traced from the drawing (x centred on 442.5; y 822 = the cornice). `at` returns where a drawing point lands in the world: the
// reference pixel is read on the point's own depth, so near and far parts of the crown stay registered with the picture.
const CK = 0.2585, CUC = 946.5
const crownV = y => 257 + (y - 822) * CK
const crownPx = Math.abs(refPoint(948, 257, FZ)[0] - refPoint(947, 257, FZ)[0])
const dw = drawingPixels => drawingPixels * CK * crownPx
const CZ = FZ - dw(300) // the crown's axis: the base of the first tier faces the camera on FZ
const at = (y, halfWidth) => {
  const hw = dw(halfWidth), z = CZ + hw
  const [x, worldY] = refPoint(CUC, crownV(y), z)
  return { x, y: worldY, hw, z }
}
const CROWN_TIERS = [
  { y0: 822, y1: 605, hw0: 300, hw1: 225, columns: 8, cells: 2 }, // lower tier: the widest and heaviest, ~20° walls
  { y0: 598, y1: 365, hw0: 205, hw1: 100, columns: 6, cells: 2 }, // middle tier: steeper, ~24°
  { y0: 358, y1: 238, hw0: 88, hw1: 54, columns: 4, cells: 1 },   // upper tier: a much smaller taper
]
const GOLD = 'crown'
CROWN_TIERS.forEach(({ y0, y1, hw0, hw1, columns, cells }, tier) => {
  const lo = at(y0, hw0), hi = at(y1, hw1)
  const height = hi.y - lo.y
  // A dim amber core, so the lattice reads as bright steel against it instead of one solid wedge.
  addGeometry('bofaCore', new THREE.CylinderGeometry(hi.hw * Math.SQRT2, lo.hw * Math.SQRT2, height, 4, 1, false), {
    at: [(lo.x + hi.x) / 2, (lo.y + hi.y) / 2, CZ], rotate: [0, Math.PI / 4, 0], name: `boa-crown-core-${tier}`,
  })
  const face = (f, t) => [lo.x + (hi.x - lo.x) * t + f * (lo.hw + (hi.hw - lo.hw) * t), lo.y + height * t, lo.z + (hi.z - lo.z) * t + 0.03]
  const rows = Math.max(2, Math.round(((y0 - y1) * CK) / 6))
  for (let r = 0; r <= rows; r += 1) strut(GOLD, face(-1, r / rows), face(1, r / rows), 0.045, `boa-band-${tier}-${r}`)
  for (let c = 0; c < columns; c += 1) {
    const f = -1 + (2 * c) / (columns - 1)
    strut(GOLD, face(f, 0), face(f, 1), 0.05, `boa-vertical-${tier}-${c}`)
  }
  for (let c = 0; c < columns - 1; c += 1) for (let cell = 0; cell < cells; cell += 1) {
    const f0 = -1 + (2 * c) / (columns - 1), f1 = -1 + (2 * (c + 1)) / (columns - 1), t0 = cell / cells, t1 = (cell + 1) / cells
    strut(GOLD, face(f0, t0), face(f1, t1), 0.04, `boa-brace-${tier}-${c}-${cell}-a`)
    strut(GOLD, face(f1, t0), face(f0, t1), 0.04, `boa-brace-${tier}-${c}-${cell}-b`)
  }
})
// Horizontal shelves between the tiers (and the flat platform under the mast): a granite slab with a lit gold lip.
for (const [name, y, halfWidth] of [['shelf-lower', 605, 236], ['shelf-upper', 365, 110], ['platform', 232, 64]]) {
  const slab = at(y, halfWidth), above = at(y - 7, halfWidth), below = at(y + 7, halfWidth)
  box('bofaStone', [slab.x, slab.y, CZ], [slab.hw * 2, above.y - below.y, slab.hw * 2], [0, 0, 0], `boa-${name}`)
  box(GOLD, [slab.x, above.y, slab.z + 0.03], [slab.hw * 2, 0.06, 0.05], [0, 0, 0], `boa-${name}-lip`)
}
// Faceted mast (two hexagonal tapers, chamfered as in the drawing) and a thin antenna, drawn at the crown's axis depth.
{
  const point = y => refPoint(CUC, crownV(y), CZ)
  const hexRadius = drawingHalfWidth => dw(drawingHalfWidth) / 0.866
  for (const [name, yBottom, yTop, rBottom, rTop] of [['lower', 225, 140, 33, 25], ['upper', 140, 75, 25, 19]]) {
    const [xb, yb] = point(yBottom), [xt, yt] = point(yTop)
    addGeometry(GOLD, new THREE.CylinderGeometry(hexRadius(rTop), hexRadius(rBottom), yt - yb, 6, 1, false), { at: [(xb + xt) / 2, (yb + yt) / 2, CZ], name: `boa-mast-${name}` })
  }
  const [xa, ya] = point(75), [, yTip] = point(0)
  box('crownWhite', [xa, (ya + yTip) / 2, CZ], [crownPx * 5, yTip - ya, crownPx * 5], [0, 0, 0], 'boa-antenna')
}

// Westin Peachtree Plaza: a round glass tower with a wider ring crown and a mast.
refRound('landmarkGlass', 1086, 1184, 340, REF_BASE_V, LANDMARK_Z, 'westin-shaft')
// A thin pale rim over a deeper dark band, both a touch wider than the shaft, then a tall slender mast.
refRound('crownCool', 1082, 1190, 298, 306, LANDMARK_Z, 'westin-crown-rim', 48)
refRound('landmarkDark', 1082, 1190, 306, 346, LANDMARK_Z, 'westin-crown-band', 48)
refBand('crownWhite', 1133, 1137, 298, 168, LANDMARK_Z, 0.08, 'westin-mast')

// Truist Plaza: a near-black shaft in three bays split by dark piers, each floor a glowing cyan band; above it a blocky dark green-grey
// crown that steps back in tiers (a little lopsided, as in the close-up) and ends in a small pale cap.
// Everything below is read from a 3D model of the tower (1672 × 941 render): its shaft is seven vertical columns of different heights,
// the tall central pylon rising into a stair-stepped crown; above that a narrow tower carries the TRUIST sign and a round drum and spire.
// Model coordinates are scaled 0.3646 into the reference frame (model x 660 = u 1228; model y 20 = v 245).
const tModelU = x => 1228 + (x - 660) * 0.3646
const tModelV = y => 245 + (y - 20) * 0.3646
// Shapes below are traced from a 2× enlargement of the model's top (enlarged x 40 = model x 660, so model = 640 + X / 2 and Y / 2).
const fromEnlarged = ([x0, x1, y0, y1]) => [640 + x0 / 2, 640 + x1 / 2, y0 / 2, y1 / 2]
const TRUIST_COLUMNS = [[40, 165, 655], [165, 250, 710], [250, 415, 585], [415, 500, 670], [500, 605, 745], [605, 700, 705], [700, 830, 648]]
refBlock('truistBody', tModelU(660), tModelU(1055), tModelV(372), LANDMARK_Z, 3.1, 'truist-shaft')
TRUIST_COLUMNS.forEach(([X0, X1, Y], i) => {
  const [x0, x1, topY] = fromEnlarged([X0, X1, Y, Y])
  const depth = i === 2 ? 3.7 : 3.3
  refBlock('truistBody', tModelU(x0), tModelU(x1), tModelV(topY), LANDMARK_Z, depth, `truist-column-${i}`)
  // A thin dark pier along the column's left edge, then a cyan band for every floor in the column.
  refBlock('truistCrown', tModelU(x0) - 1.2, tModelU(x0) + 1.2, tModelV(topY), LANDMARK_Z, depth + 0.1, `truist-pier-${i}`)
  const u0 = tModelU(x0) + 2.2, u1 = tModelU(x1) - 1.2, pitch = 14
  for (let v = tModelV(topY) + 5, row = 0; v < 1000; v += pitch, row += 1) {
    if (hash(`truist:${i}:${row}`) > 0.8) continue
    const [xa, ya] = refPoint(u0, v, LANDMARK_Z), [xb] = refPoint(u1, v, LANDMARK_Z), [, yb] = refPoint(u0, v + pitch * 0.58, LANDMARK_Z)
    addGeometry('truistWindows', new THREE.PlaneGeometry(1, 1), { at: [(xa + xb) / 2, (ya + yb) / 2, LANDMARK_Z + depth / 2 + 0.04], size: [Math.abs(xb - xa), Math.abs(ya - yb), 1], name: `truist-band-${i}-${row}` })
  }
})
refBlock('truistCrown', 1212, 1232, 380, LANDMARK_Z, 2.8, 'truist-shoulder')
// The crown: a wide stair-stepped pyramid of stacked blocks (wings on both sides stepping down, a broad sign band) carrying a TALL narrow
// tower, then a cap, drum and spire. Listed bottom to top so higher blocks sit slightly nearer the camera.
const TRUIST_CROWN = [
  [140, 730, 555, 640], [140, 205, 565, 680], [600, 730, 555, 680], // lowest wide band and its two end wings
  [188, 275, 458, 575], [600, 692, 455, 565], // second wings
  [275, 600, 425, 600], // broad middle block
  [258, 630, 355, 440], // sign band
  [335, 555, 175, 362], // tall narrow tower
  [370, 515, 150, 192], // cap base
]
TRUIST_CROWN.forEach((box_, i) => {
  const [x0, x1, y0, y1] = fromEnlarged(box_)
  const depth = 2.6 + i * 0.12
  refBand('truistCrown', tModelU(x0), tModelU(x1), tModelV(y0), tModelV(y1), LANDMARK_Z, depth, `truist-crown-${i}`)
  refBand('crownCool', tModelU(x0), tModelU(x1), tModelV(y0), tModelV(y0) + 1.5, LANDMARK_Z, depth + 0.05, `truist-crown-${i}-edge`)
  if (i >= 3 && i <= 7) refWindows({ key: `truist-crown-${i}`, u0: tModelU(x0) + 3, u1: tModelU(x1) - 3, vTop: tModelV(y0) + 4, vBottom: tModelV(y1) - 1, z: LANDMARK_Z, depth, bayU: 8, bayV: 7, chance: 0.4, part: 'truistWindows' })
})
{
  const [sx0, sx1, sy0, sy1] = fromEnlarged([380, 630, 395, 425])
  refBand('crownWhite', tModelU(sx0), tModelU(sx1), tModelV(sy0), tModelV(sy1), LANDMARK_Z, 3.6, 'truist-sign')
  const [dx0, dx1, dy0, dy1] = fromEnlarged([388, 503, 105, 150])
  refRound('truistCrown', tModelU(dx0), tModelU(dx1), tModelV(dy0), tModelV(dy1), LANDMARK_Z, 'truist-drum', 28)
  refRound('crownCool', tModelU(dx0 - 3), tModelU(dx1 + 3), tModelV(dy0), tModelV(dy0) + 3, LANDMARK_Z, 'truist-drum-rim', 28)
  const [px0, px1, py0, py1] = fromEnlarged([445, 449, 45, 105])
  refBand('crownWhite', tModelU(px0), tModelU(px1), tModelV(py0), tModelV(py1), LANDMARK_Z, 0.06, 'truist-spire')
}

// Georgia-Pacific Tower: a windowless warm-grey stone tower. Its left face is one straight line; three stacked sections step outward to the
// right as they descend, each split by a dark recessed vertical slot, and the crown is a few notched blocks (all read from a close-up).
const GP_Z = LANDMARK_Z
const GP_DEPTH = 4.6
// Each step is wide (about 38 reference pixels), each section a slightly lighter stone than the one above, and a pale ledge line catches the
// light along every step, so the stepped right side reads clearly. The tower sits far enough left that its steps stay inside the frame.
const GP_LEFT = 1440
// Five sections, each stepping out 16 reference pixels, from a slender 120-pixel top to a base only a little wider.
const GP_SECTIONS = [
  { part: 'gpStone', vTop: 236, vBottom: 372, right: 1560 },
  { part: 'gpStoneB', vTop: 372, vBottom: 508, right: 1576 },
  { part: 'gpStoneB', vTop: 508, vBottom: 644, right: 1592 },
  { part: 'gpStoneC', vTop: 644, vBottom: 780, right: 1608 },
  { part: 'gpStoneC', vTop: 780, vBottom: 1700, right: 1624 },
]
GP_SECTIONS.forEach(({ part, vTop, vBottom, right }, i) => {
  refBand(part, GP_LEFT, right, vTop, vBottom, GP_Z, GP_DEPTH, `gp-section-${i}`)
  if (vBottom > 1000) refBlock(part, GP_LEFT, right, vTop, GP_Z, GP_DEPTH, `gp-section-${i}-base`)
  refBand('gpLedge', GP_LEFT, right, vTop, vTop + 5, GP_Z, GP_DEPTH + 0.1, `gp-ledge-${i}`)
  const width = right - GP_LEFT
  // The recessed slot sits about 55–77% across each face, with a thin seam a quarter of the way in, as on the real tower's panels.
  for (const [label, f0, f1] of [['slot', 0.55, 0.77], ['seam', 0.25, 0.27]]) {
    const u0 = GP_LEFT + width * f0, u1 = GP_LEFT + width * f1
    const top = vTop + 5, bottom = Math.min(vBottom, 1700)
    const [x0, yTop] = refPoint(u0, top, GP_Z), [x1] = refPoint(u1, top, GP_Z), [, yBottom] = refPoint(u0, bottom, GP_Z)
    box('gpSlot', [(x0 + x1) / 2, (yTop + yBottom) / 2, GP_Z + GP_DEPTH / 2 + 0.06], [Math.abs(x1 - x0), yTop - yBottom, 0.05], [0, 0, 0], `gp-${label}-${i}`)
  }
})
// From a daytime photo of the tower: the left part of every section is a grid of small punched windows (lit warm at night, bay about 8 × 11
// reference pixels), the right-hand panels are blank stone, and the recessed slot carries horizontal louvres.
GP_SECTIONS.forEach(({ vTop, vBottom, right }, i) => {
  const width = right - GP_LEFT
  refWindows({ key: `gp-win-${i}`, u0: GP_LEFT + 5, u1: GP_LEFT + width * 0.5, vTop: vTop + 9, vBottom: Math.min(vBottom, 1000), z: GP_Z, depth: GP_DEPTH, bayU: 8, bayV: 11, chance: 0.82 })
  for (let v = vTop + 9; v < Math.min(vBottom, 1000); v += 7) {
    const [x0, y] = refPoint(GP_LEFT + width * 0.55, v, GP_Z), [x1] = refPoint(GP_LEFT + width * 0.77, v, GP_Z)
    box('gpLedge', [(x0 + x1) / 2, y, GP_Z + GP_DEPTH / 2 + 0.09], [Math.abs(x1 - x0), 0.035, 0.03], [0, 0, 0], `gp-louvre-${i}-${Math.round(v)}`)
  }
})
// The notched crown: three blocks, tallest on the left.
refBand('gpStone', GP_LEFT, GP_LEFT + 56, 224, 240, GP_Z, GP_DEPTH, 'gp-crown-left')
refBand('gpStone', GP_LEFT + 56, GP_LEFT + 86, 230, 240, GP_Z, GP_DEPTH, 'gp-crown-mid')
refBand('gpStone', GP_LEFT + 86, GP_LEFT + 118, 236, 242, GP_Z, GP_DEPTH, 'gp-crown-right')

// The angular glass building low between Westin and Truist (the reference's slanted-faced block).
refBlock('landmarkGlass', 1150, 1222, 700, NEAR_Z - 3, 3.0, 'angular-glass')

// Fill buildings: [u0, u1, top row] per band, read from the reference.
const FILL = {
  far: [[500, 640, 640], [640, 760, 625], [730, 860, 610], [1040, 1100, 560], [1100, 1190, 600], [1370, 1450, 560], [1520, 1600, 650]],
  mid: [[0, 68, 530], [70, 175, 507], [175, 270, 600], [1008, 1062, 520], [1182, 1228, 510], [1378, 1442, 520], [1410, 1522, 618], [1015, 1062, 548]],
  near: [[210, 330, 655], [300, 440, 692], [430, 530, 702], [530, 705, 708], [612, 735, 716], [945, 1088, 720], [1146, 1366, 706], [1522, 1562, 690]],
}
for (const [part, band, z, depth] of [['distantBuildings', 'far', FAR_Z, 3], ['midBuildings', 'mid', MID_Z, 3.4], ['nearBuildings', 'near', NEAR_Z, 3.2]]) {
  FILL[band].forEach(([u0, u1, vTop], i) => refBlock(part, u0, u1, vTop, z, depth, `${band}-building-${i}`))
}

// ── Facades and emitters (Phase 4) ──────────────────────────────────────────────────────────────────────────────────────────
// Windows are small emissive flat panels (two triangles each) on each building's front face, laid out on a grid read from the reference (about 12 × 14 reference
// pixels a floor bay) with a deterministic share left dark, so floors look occupied rather than uniformly lit.
function refWindows({ key, u0, u1, vTop, vBottom = 1000, z, depth, bayU = 12, bayV = 14, chance = 0.5, part = 'warmWindows' }) {
  const cols = Math.max(1, Math.floor((u1 - u0) / bayU))
  const rows = Math.max(1, Math.floor((vBottom - vTop) / bayV))
  const du = (u1 - u0) / cols, dv = (vBottom - vTop) / rows
  const [xa] = refPoint(u0, vTop, z), [xb] = refPoint(u0 + du, vTop, z)
  const [, ya] = refPoint(u0, vTop, z), [, yb] = refPoint(u0, vTop + dv, z)
  const width = Math.abs(xb - xa), height = Math.abs(ya - yb)
  for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
    if (hash(`${key}:${row}:${col}`) > chance) continue
    const [x, y] = refPoint(u0 + du * (col + 0.5), vTop + dv * (row + 0.5), z)
    addGeometry(part, new THREE.PlaneGeometry(1, 1), { at: [x, y, z + depth / 2 + 0.04], size: [width * 0.56, height * 0.5, 1] })
  }
}
refWindows({ key: 'boa', u0: boaU(740), u1: boaU(933), vTop: boaV(BOA_SETBACK_Y) + 10, z: FZ + 0.1, depth: 0.08, bayU: 9, bayV: 14, chance: 0.12 })
refWindows({ key: 'boa-up', u0: boaU(762), u1: boaU(913), vTop: boaV(BOA_PLATFORM_Y) + 10, vBottom: boaV(BOA_SETBACK_Y), z: FZ, depth: 0.08, bayU: 9, bayV: 14, chance: 0.12 })
// Westin: a fine grid of cool glass panels wraps the round shaft, with a bright cyan reflection running down its left-centre.
{
  const [xl] = refPoint(1086, 400, LANDMARK_Z), [xr] = refPoint(1184, 400, LANDMARK_Z)
  const radius = Math.abs(xr - xl) / 2, centreX = (xl + xr) / 2
  const columns = 30, rowsCount = 78, spanDeg = 150, topV = 352
  for (let row = 0; row < rowsCount; row += 1) for (let col = 0; col < columns; col += 1) {
    if (hash(`westin:${row}:${col}`) > 0.93) continue
    const degrees = -spanDeg / 2 + (spanDeg * (col + 0.5)) / columns
    const angle = degrees * (Math.PI / 180)
    const v0 = topV + ((1000 - topV) * row) / rowsCount, v1 = topV + ((1000 - topV) * (row + 1)) / rowsCount
    const [, y0] = refPoint(1135, v0, LANDMARK_Z), [, y1] = refPoint(1135, v1, LANDMARK_Z)
    const reflection = degrees > -52 && degrees < -14
    addGeometry(reflection ? 'cyanWindows' : 'glassWindows', new THREE.PlaneGeometry(1, 1), {
      at: [centreX + Math.sin(angle) * (radius + 0.03), (y0 + y1) / 2, LANDMARK_Z + Math.cos(angle) * (radius + 0.03)],
      size: [(2 * Math.PI * radius * (spanDeg / 360)) / columns * 0.86, Math.abs(y0 - y1) * 0.76, 1],
      rotate: [0, angle, 0],
      name: `westin-window-${row}-${col}`,
    })
  }
}
// Fill buildings: sparser, dimmer-looking occupancy toward the back.
for (const [band, chance, z, depth] of [['far', 0.14, FAR_Z, 3], ['mid', 0.4, MID_Z, 3.4], ['near', 0.46, NEAR_Z, 3.2]]) {
  FILL[band].forEach(([u0, u1, vTop], i) => refWindows({ key: `${band}-${i}`, u0: u0 + 4, u1: u1 - 4, vTop: vTop + 10, z, depth, bayU: 13, bayV: 16, chance }))
}
// Red aviation beacons on the tallest points.
for (const [i, [u, v, z]] of [[946.5, 42, LANDMARK_Z - 2.3], [1135, 166, LANDMARK_Z], [1228 + (863.5 - 660) * 0.3646, 245 + (22.5 - 20) * 0.3646 - 1, LANDMARK_Z], [74, 506, MID_Z], [1190, 508, MID_Z]].entries()) {
  const [x, y] = refPoint(u, v, z)
  box('beacon', [x, y, z + 0.1], [0.16, 0.16, 0.16], [0, 0, 0], `beacon-${i}`)
}

// Wider Stages show more city than the reference frame, so the skyline keeps going past both edges (reference columns -1300 … 0 and
// 1672 … 3000, enough for a 3:1 Stage) with the same three bands and varied widths and heights.
for (const [part, band, z, depth, topMin, topMax] of [['distantBuildings', 'far', FAR_Z, 3, 600, 680], ['midBuildings', 'mid', MID_Z, 3.4, 520, 640], ['nearBuildings', 'near', NEAR_Z, 3.2, 660, 730]]) {
  for (const [side, start, end] of [['left', -1300, 0], ['right', 1672, 3000]]) {
    let u = start
    for (let i = 0; u < end; i += 1) {
      const width = 80 + hash(`wide-${side}-${band}-w-${i}`) * 110
      const top = topMin + hash(`wide-${side}-${band}-t-${i}`) * (topMax - topMin)
      refBlock(part, u, u + width + 6, top, z, depth, `wide-${side}-${band}-${i}`)
      refWindows({ key: `wide-${side}-${band}-${i}`, u0: u + 4, u1: u + width + 2, vTop: top + 10, z, depth, bayU: 13, bayV: 16, chance: band === 'far' ? 0.14 : band === 'mid' ? 0.4 : 0.46 })
      u += width
    }
  }
}

// ── Elevated road and street lamps (Phase 5) ────────────────────────────────────────────────────────────────────────────────
// Two decks run low across the frame (a far deck behind a nearer one, read from the reference), with a thin sodium-lit edge along each,
// a dark mass beneath, and orange street lamps on poles. Everything is placed in reference pixels, runs far past both edges for wide
// Stages, and stands in front of the near buildings and behind the sign and foliage.
const ROAD_Z = -8
const ROAD_FROM = -1300, ROAD_TO = 3000
refBand('road', ROAD_FROM, ROAD_TO, 846, 872, ROAD_Z, 3.0, 'road-deck-far')
// The lit edges are thin strips on each deck's front face; a deck-deep box would show its whole top face from the camera's height.
refBand('roadGlow', ROAD_FROM, ROAD_TO, 846, 847.4, ROAD_Z + 1.5, 0.08, 'road-deck-far-edge')
refBand('road', ROAD_FROM, ROAD_TO, 884, 912, ROAD_Z + 0.8, 3.2, 'road-deck-near')
refBand('roadGlow', ROAD_FROM, ROAD_TO, 884, 885.4, ROAD_Z + 0.8 + 1.6, 0.08, 'road-deck-near-edge')
refBlock('road', ROAD_FROM, ROAD_TO, 912, ROAD_Z + 0.8, 3.2, 'road-understructure')
// Pale underside beams catch a little of the lamp light so the deck has thickness.
for (let u = ROAD_FROM; u < ROAD_TO; u += 90) refBand('road', u, u + 5, 872, 884, ROAD_Z + 0.4, 2.8, `road-beam-${u}`)
// Lamps: the reference's five, then a steady run in both directions with a little deterministic spread.
const crownPxAt = z => Math.abs(refPoint(1, 600, z)[0] - refPoint(0, 600, z)[0])
const LAMPS = [[478, 790], [635, 818], [787, 828], [975, 800], [1075, 848], [1400, 845], [1560, 830], [1650, 845]]
for (let u = 330, i = 0; u > ROAD_FROM; u -= 150 + hash(`lamp-l-${i}`) * 50, i += 1) LAMPS.push([u, 820 + hash(`lamp-lv-${i}`) * 25])
for (let u = 1740, i = 0; u < ROAD_TO; u += 150 + hash(`lamp-r-${i}`) * 50, i += 1) LAMPS.push([u, 820 + hash(`lamp-rv-${i}`) * 25])
LAMPS.forEach(([u, v], i) => {
  refBand('roadPole', u - 1.8, u + 1.8, v, 884, ROAD_Z + 0.4, 0.3, `road-lamp-pole-${i}`)
  refBand('roadGlow', u - 4, u + 4, v - 6, v + 2, ROAD_Z + 0.4, 0.5, `road-lamp-${i}`)
  // A soft halo behind the orb, and a pool of light on the near deck's face below the lamp.
  addGeometry('lampGlow', new THREE.CircleGeometry(1, 14), { at: [refPoint(u, v - 2, ROAD_Z + 0.2)[0], refPoint(u, v - 2, ROAD_Z + 0.2)[1], ROAD_Z + 0.2], size: [crownPxAt(ROAD_Z + 0.2) * 7, crownPxAt(ROAD_Z + 0.2) * 7, 1], name: `road-lamp-halo-${i}` })
  addGeometry('lampGlow', new THREE.CircleGeometry(1, 14), { at: [refPoint(u, 898, ROAD_Z + 2.4)[0], refPoint(u, 898, ROAD_Z + 2.4)[1], ROAD_Z + 0.8 + 1.65], size: [crownPxAt(ROAD_Z + 2.4) * 46, crownPxAt(ROAD_Z + 2.4) * 7, 1], name: `road-lamp-pool-${i}` })
})

// The Waffle House sign, modeled on the real roadside sign: a near-black cabinet in two rows (six cells over five cells offset by half a
// cell, the lower cabinet standing proud of the upper), each cell a thin black frame around a flat, bright yellow face carrying one heavy,
// flat black block letter, all standing on a black base rail, a centre post and two legs that splay out under the rail and meet low down.
const panel = 1.42, gap = 0.08
const topY = 6.9, bottomY = 5.36, signZ = 3.25
const bottomStart = -7.46
const topStart = bottomStart - (panel + gap) / 2
const signCenterX = topStart + (5 * (panel + gap)) / 2
const signPivot = new THREE.Vector3(-5.2, 6.65, signZ)
// The camera sits to the sign's right. A shallow positive yaw nearly aligns
// the face with that sightline and reads front-on, so the hero sign turns far
// enough past it to expose the left cabinet walls and recede toward the right.
// The roll tips the whole assembly clockwise so the top edge drops steeply to the right, as in the reference.
const SIGN_YAW_DEG = 47
const SIGN_ROLL_DEG = -2.5
const signRotation = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, THREE.MathUtils.degToRad(SIGN_YAW_DEG), THREE.MathUtils.degToRad(SIGN_ROLL_DEG)))
const signTransform = new THREE.Matrix4()
  .makeTranslation(signPivot.x + 2.38, signPivot.y + 0.19, signPivot.z + 5.7)
  .multiply(signRotation)
  .multiply(new THREE.Matrix4().makeTranslation(-signPivot.x, -signPivot.y, -signPivot.z))
const signBox = (part, at, size, rotate = [0, 0, 0], name) => addGeometry(
  part,
  new THREE.BoxGeometry(1, 1, 1),
  { at, size, rotate, name, parentMatrix: signTransform },
)
/** A square-section steel tube between two points in the sign's own x/y plane (z is the tube's centre depth). */
function signTube(part, from, to, thickness, z, name) {
  const dx = to[0] - from[0], dy = to[1] - from[1]
  const length = Math.hypot(dx, dy)
  signBox(part, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, z], [thickness, length, thickness], [0, 0, Math.atan2(-dx, dy)], name)
}

const cabinetDepth = 0.72
const cabinetFront = signZ + cabinetDepth / 2
const bezelWidth = 0.085
const bezelDepth = 0.07
const face = panel - 0.17
// The yellow face sits just proud of the cabinet front (never coplanar with it) and just behind the bezel's front edge.
const faceZ = cabinetFront

// `dz` stands a row's whole cabinet proud of the other along the sign's own normal.
function signRow(name, count, startX, y, dz = 0) {
  const rowWidth = count * panel + (count - 1) * gap + 0.28
  const rowCenter = startX + ((count - 1) * (panel + gap)) / 2
  const cabinetHeight = panel + 0.2
  const rowZ = signZ + dz
  const rowFront = cabinetFront + dz
  const rowFaceZ = faceZ + dz
  // The painted cabinet box, with a thin edge rail along its front top and bottom that catches the rim light.
  signBox('signMetal', [rowCenter, y, rowZ], [rowWidth, cabinetHeight, cabinetDepth], [0, 0, 0], `${name}-cabinet`)
  signBox('signTrim', [rowCenter, y + cabinetHeight / 2 - 0.02, rowFront - 0.015], [rowWidth + 0.04, 0.035, 0.05], [0, 0, 0], `${name}-cabinet-top-edge`)
  signBox('signTrim', [rowCenter, y - cabinetHeight / 2 + 0.02, rowFront - 0.015], [rowWidth + 0.04, 0.035, 0.05], [0, 0, 0], `${name}-cabinet-bottom-edge`)
  for (let i = 0; i < count; i += 1) {
    const x = startX + i * (panel + gap)
    // A flat yellow face, sitting just proud of the cabinet front and just behind the frame's front edge.
    signBox('signGlow', [x, y, rowFaceZ], [face, face, 0.04], [0, 0, 0], `${name}-${i}-face`)
    const ring = (panel - face) / 2
    const bezelZ = rowFront + bezelDepth / 2 - 0.03
    signBox('signBorder', [x, y + (panel - ring) / 2, bezelZ], [panel, ring, bezelDepth], [0, 0, 0], `${name}-${i}-bezel-top`)
    signBox('signBorder', [x, y - (panel - ring) / 2, bezelZ], [panel, ring, bezelDepth], [0, 0, 0], `${name}-${i}-bezel-bottom`)
    signBox('signBorder', [x - (panel - ring) / 2, y, bezelZ], [ring, panel - 2 * ring, bezelDepth], [0, 0, 0], `${name}-${i}-bezel-left`)
    signBox('signBorder', [x + (panel - ring) / 2, y, bezelZ], [ring, panel - 2 * ring, bezelDepth], [0, 0, 0], `${name}-${i}-bezel-right`)
  }
  return { rowWidth, rowCenter, cabinetHeight }
}
const LOWER_ROW_DZ = 0.34
const topRow = signRow('top', 6, topStart, topY)
const bottomRow = signRow('bottom', 5, bottomStart, bottomY, LOWER_ROW_DZ)

// Four rivets at the corners of the exposed left end of each cabinet, as on the real sign.
for (const [row, y, dz0] of [[topRow, topY, 0], [bottomRow, bottomY, LOWER_ROW_DZ]]) {
  const x = row.rowCenter - row.rowWidth / 2 - 0.012
  for (const [dz, dy] of [[-0.24, 0.62], [0.24, 0.62], [-0.24, -0.62], [0.24, -0.62]]) {
    addGeometry('signTrim', new THREE.CylinderGeometry(0.04, 0.04, 0.035, 12), {
      at: [x, y + dy, signZ + dz0 + dz], rotate: [0, 0, Math.PI / 2], parentMatrix: signTransform,
    })
  }
}

// ── The letters: a heavy, wide grotesque authored here as outline polygons (no font file), one per cell. ──────────────────
// Every glyph is drawn in a box that is 1 unit tall and `width` units wide, then scaled to the cell.
const arc = (cx, cy, rx, ry, from, to, steps = 28) => Array.from({ length: steps + 1 }, (_, i) => {
  const a = from + ((to - from) * i) / steps
  return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]
})
const superEllipse = (cx, cy, rx, ry, power = 2.35, steps = 64) => Array.from({ length: steps }, (_, i) => {
  const a = (i / steps) * Math.PI * 2
  const c = Math.cos(a), s = Math.sin(a)
  return [cx + rx * Math.sign(c) * Math.abs(c) ** (2 / power), cy + ry * Math.sign(s) * Math.abs(s) ** (2 / power)]
})
/** A smooth stroke of constant width swept along a centre line, as one closed outline (used for the S). */
function strokeOutline(centre, thickness, samples = 90) {
  const curve = new THREE.CatmullRomCurve3(centre.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal')
  const points = curve.getSpacedPoints(samples)
  const left = [], right = []
  points.forEach((point, i) => {
    const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)]
    const tx = after.x - before.x, ty = after.y - before.y
    const length = Math.hypot(tx, ty) || 1
    const nx = -ty / length, ny = tx / length
    left.push([point.x + nx * thickness / 2, point.y + ny * thickness / 2])
    right.push([point.x - nx * thickness / 2, point.y - ny * thickness / 2])
  })
  return [...left, ...right.reverse()]
}
const GLYPHS = {
  W: { width: 1.14, outline: [[0, 1], [0.22, 0], [0.43, 0], [0.5, 0.4], [0.57, 0], [0.78, 0], [1, 1], [0.74, 1], [0.675, 0.44], [0.61, 0.92], [0.39, 0.92], [0.325, 0.44], [0.26, 1]], unit: true },
  A: { width: 1.02, outline: [[0, 0], [0.3, 0], [0.345, 0.2], [0.655, 0.2], [0.7, 0], [1, 0], [0.64, 1], [0.36, 1]], holes: [[[0.405, 0.4], [0.595, 0.4], [0.5, 0.68]]], unit: true },
  F: { width: 0.74, outline: [[0, 0], [0.34, 0], [0.34, 0.36], [0.66, 0.36], [0.66, 0.58], [0.34, 0.58], [0.34, 0.74], [1, 0.74], [1, 1], [0, 1]], xScale: 0.74 },
  L: { width: 0.72, outline: [[0, 0], [1, 0], [1, 0.26], [0.4, 0.26], [0.4, 1], [0, 1]], xScale: 0.72 },
  E: { width: 0.76, outline: [[0, 0], [1, 0], [1, 0.26], [0.4, 0.26], [0.4, 0.37], [0.92, 0.37], [0.92, 0.59], [0.4, 0.59], [0.4, 0.74], [1, 0.74], [1, 1], [0, 1]], xScale: 0.76 },
  H: { width: 0.86, outline: [[0, 0], [0.35, 0], [0.35, 0.38], [0.65, 0.38], [0.65, 0], [1, 0], [1, 1], [0.65, 1], [0.65, 0.62], [0.35, 0.62], [0.35, 1], [0, 1]], xScale: 0.86 },
  O: { width: 0.96, outline: superEllipse(0.5, 0.5, 0.5, 0.5), holes: [superEllipse(0.5, 0.5, 0.17, 0.24, 2.2)], xScale: 0.96 },
  U: { width: 0.88, outline: [[0, 1], [0, 0.42], ...arc(0.5, 0.42, 0.5, 0.42, Math.PI, Math.PI * 2), [1, 1], [0.65, 1], [0.65, 0.42], ...arc(0.5, 0.42, 0.15, 0.15, Math.PI * 2, Math.PI).slice(0), [0.35, 1]], xScale: 0.88 },
  S: { width: 0.78, strokeCentre: [[0.88, 0.78], [0.8, 0.9], [0.62, 0.955], [0.42, 0.965], [0.22, 0.925], [0.12, 0.82], [0.17, 0.69], [0.34, 0.585], [0.52, 0.5], [0.72, 0.42], [0.82, 0.31], [0.78, 0.17], [0.62, 0.065], [0.4, 0.035], [0.2, 0.08], [0.08, 0.2], [0.05, 0.3]], strokeWidth: 0.24, xScale: 0.8 },
}
// Heavy, flat letters: tall in the face, with only a token extrusion so they read as printed black blocks.
const letterHeight = 1.04
const letterDepth = 0.06
const letterBevel = 0.006
function glyphShape(letter) {
  const glyph = GLYPHS[letter]
  let outline = glyph.outline
  let holes = glyph.holes ?? []
  if (glyph.strokeCentre) {
    // Fit the swept stroke inside the glyph box: pull the centre line in by half the stroke width so the S's outer edge lands on the
    // same top, bottom and side lines as the other letters instead of overshooting the face.
    const half = glyph.strokeWidth / 2
    const xs = glyph.strokeCentre.map(point => point[0]), ys = glyph.strokeCentre.map(point => point[1])
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const fitted = glyph.strokeCentre.map(([x, y]) => [
      half + ((x - minX) / (maxX - minX)) * (1 - 2 * half),
      half + ((y - minY) / (maxY - minY)) * (1 - 2 * half),
    ])
    outline = strokeOutline(fitted, glyph.strokeWidth)
  }
  const widthScale = (glyph.unit ? glyph.width : glyph.xScale) * letterHeight
  const toWorld = ([x, y]) => new THREE.Vector2((x - 0.5) * widthScale, (y - 0.5) * letterHeight)
  const shape = new THREE.Shape(outline.map(toWorld))
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(toWorld)))
  return shape
}
function letterGeometry(letter) {
  const geometry = new THREE.ExtrudeGeometry(glyphShape(letter), {
    depth: letterDepth - letterBevel * 2,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: letterBevel,
    bevelSize: letterBevel * 0.85,
    bevelSegments: 2,
    curveSegments: 12,
  })
  geometry.translate(0, 0, letterBevel)
  // Crease-aware normals: flat faces stay flat and the curved O / U / S stay smooth.
  const creased = toCreasedNormals(geometry, THREE.MathUtils.degToRad(38))
  geometry.dispose()
  return creased
}
for (const [word, start, y, dz] of [['WAFFLE', topStart, topY, 0], ['HOUSE', bottomStart, bottomY, LOWER_ROW_DZ]]) {
  for (let i = 0; i < word.length; i += 1) {
    addGeometry('signLetters', letterGeometry(word[i]), { at: [start + i * (panel + gap), y, faceZ + dz + 0.02], name: `letter-${word}-${i}`, parentMatrix: signTransform })
  }
}

// The base rail under the lower row carries the legs: two splayed outward under the rail and meeting low down in a V, plus a straight
// centre post. Their bases run below the camera frame, in the 16:9 output and the tall Stage preview alike.
const railY = bottomY - bottomRow.cabinetHeight / 2 - 0.15
const railZ = signZ + LOWER_ROW_DZ
signBox('signMetal', [signCenterX, railY, railZ - 0.02], [bottomRow.rowWidth + 0.62, 0.3, cabinetDepth + 0.12], [0, 0, 0], 'base-rail')
signBox('signTrim', [signCenterX, railY + 0.16, railZ + 0.28], [bottomRow.rowWidth + 0.66, 0.025, 0.06], [0, 0, 0], 'base-rail-edge')
const legTop = railY - 0.1, legBottom = -4.5, legThickness = 0.5, legZ = signZ - 0.05
// The legs are authored in the sign's own (rolled) plane. The centre post leans against the roll so it stays visually upright, and the two
// outer legs splay out under the rail and meet it at one foot, so they form a V instead of crossing in the tall Stage preview.
const legSpan = legTop - legBottom
const footX = signCenterX + Math.tan(THREE.MathUtils.degToRad(-SIGN_ROLL_DEG)) * legSpan
signTube('signMetal', [signCenterX - 2.7, legTop], [footX, legBottom], legThickness, legZ, 'leg-left')
signTube('signMetal', [signCenterX + 2.7, legTop], [footX, legBottom], legThickness, legZ, 'leg-right')
signTube('signMetal', [signCenterX, legTop], [footX, legBottom], legThickness, legZ - 0.04, 'leg-center')

// ── Foliage (Phase 6) ───────────────────────────────────────────────────────────────────────────────────────────────────────
// The reference's trees are near-black clusters of rounded petals (small rosettes, about 25 reference pixels across) whose gaps let the lit
// city show through, with a fainter blue rosette pattern inside the mass and a few amber glints. Each mass here is built the same way: a
// filled body under a top contour (reference pixels), two rows of dark rosette cards along the contour so the silhouette is leafy, fainter
// blue rosettes scattered inside, and sparse amber flecks. A rosette is a centre disc ringed by petal discs, flat and facing the camera.
// Four masses: lower-left and lower-right (in front of the road, behind the sign's legs), a tree line behind the road, and low clumps along
// the bottom edge. Contours run far past both edges for wide Stages and below the frame for the tall Stage.
const pxAt = z => Math.abs(refPoint(1, 600, z)[0] - refPoint(0, 600, z)[0])
function contourV(contour, u) {
  if (u <= contour[0][0]) return contour[0][1]
  for (let i = 0; i < contour.length - 1; i += 1) {
    const [u0, v0] = contour[i], [u1, v1] = contour[i + 1]
    if (u <= u1) return v0 + ((v1 - v0) * (u - u0)) / (u1 - u0)
  }
  return contour.at(-1)[1]
}
const PETAL_DISC = new THREE.CircleGeometry(1, 7)
/** One rosette (a centre disc and six petal discs) centred on reference pixel (u, v) at depth z, `radius` reference pixels across its petals' reach. */
function rosette(part, u, v, z, radius, key) {
  const [cx, cy] = refPoint(u, v, z)
  const px = pxAt(z)
  const spin = hash(`${key}:spin`) * Math.PI * 2
  const petal = radius * 0.4 * px
  addGeometry(part, PETAL_DISC, { at: [cx, cy, z], size: [petal * 1.05, petal * 1.05, 1], name: `${key}-c` })
  for (let k = 0; k < 6; k += 1) {
    const angle = spin + (k * Math.PI) / 3 + (hash(`${key}:a${k}`) - 0.5) * 0.35
    const reach = radius * 0.6 * px * (0.9 + hash(`${key}:r${k}`) * 0.25)
    addGeometry(part, PETAL_DISC, { at: [cx + Math.cos(angle) * reach, cy + Math.sin(angle) * reach, z], size: [petal * (0.85 + hash(`${key}:s${k}`) * 0.3), petal * (0.85 + hash(`${key}:s${k}`) * 0.3), 1], name: `${key}-p${k}` })
  }
}
function treeMass({ key, contour, z, fillTo, radius: [rMin, rMax], step, faint = 0, flecks = 0, depth = 3.2 }) {
  const px = pxAt(z)
  const front = z + depth / 2
  // The body under the contour, one slab per contour segment, sunk below the edge so the rosettes carry the silhouette.
  for (let i = 0; i < contour.length - 1; i += 1) {
    const [u0, v0] = contour[i], [u1, v1] = contour[i + 1]
    const top = Math.min(v0, v1) + rMax * 1.7
    const [x0] = refPoint(u0, top, z), [x1] = refPoint(u1, top, z)
    const [, yTop] = refPoint(refUy(u0, u1), top, z), [, yBottom] = refPoint(refUy(u0, u1), fillTo, z)
    box('foliageBack', [(x0 + x1) / 2, (yTop + yBottom) / 2, z], [Math.abs(x1 - x0) + 0.02, yTop - yBottom, depth], [0, 0, 0], `${key}-body-${i}`)
  }
  const uStart = contour[0][0], uEnd = contour.at(-1)[0]
  // Dark rosettes along the contour, two staggered rows (the second sits lower and fills the gaps of the first).
  for (let row = 0; row < 2; row += 1) {
    for (let u = uStart + row * step * 0.5, i = 0; u <= uEnd; u += step * (u < -60 || u > 1730 ? 3 : 1) * (0.8 + hash(`${key}:step:${row}:${i}`) * 0.4), i += 1) {
      const r = rMin + hash(`${key}:r:${row}:${i}`) * (rMax - rMin)
      const v = contourV(contour, u) + r * (0.55 + row * 1.05) + (hash(`${key}:v:${row}:${i}`) - 0.5) * r * 0.5
      rosette('foliage', u, v, front + 0.05 + row * 0.01 + (i % 5) * 0.002, r, `${key}-edge-${row}-${i}`)
    }
  }
  // Faint blue rosettes inside the mass (only where the frame can see them), in front of the dark ones.
  for (let i = 0; i < faint; i += 1) {
    const u = uStart + hash(`${key}:faint-u:${i}`) * (Math.min(uEnd, 1760) - Math.max(uStart, -80)) + Math.max(0, -80 - uStart)
    const v = contourV(contour, u) + rMax * 2 + hash(`${key}:faint-v:${i}`) * 260
    rosette('foliageFaint', u, v, front + 0.12 + (i % 7) * 0.003, rMin + hash(`${key}:faint-r:${i}`) * (rMax - rMin), `${key}-faint-${i}`)
  }
  for (let i = 0; i < flecks; i += 1) {
    const u = uStart + hash(`${key}:fleck-u:${i}`) * (uEnd - uStart)
    const v = contourV(contour, u) + 4 + hash(`${key}:fleck-v:${i}`) * 40
    const [x, y] = refPoint(u, v, front + 0.2)
    addGeometry('foliageLit', new THREE.OctahedronGeometry(1, 0), { at: [x, y, front + 0.2], size: [px * 1.7, px * 1.4, px * 1], name: `${key}-fleck-${i}` })
  }
}
treeMass({
  key: 'tree-left', z: 4, fillTo: 1700, radius: [12, 18], step: 15, faint: 70, flecks: 70,
  contour: [[-1300, 700], [-900, 688], [-500, 706], [-200, 690], [0, 676], [60, 684], [110, 698], [170, 716], [230, 744], [290, 774], [335, 802], [370, 840], [395, 960]],
})
treeMass({
  key: 'tree-right', z: 4.4, fillTo: 1700, radius: [12, 19], step: 15, faint: 110, flecks: 110,
  contour: [[1085, 960], [1100, 905], [1130, 880], [1180, 858], [1240, 838], [1300, 822], [1350, 805], [1400, 770], [1450, 725], [1500, 690], [1550, 650], [1600, 610], [1672, 556], [2200, 548], [2800, 566], [3000, 572]],
})
treeMass({
  key: 'tree-line', z: -10, fillTo: 905, radius: [7, 12], step: 10, depth: 2.4, faint: 0, flecks: 40,
  contour: [[330, 802], [420, 786], [520, 792], [620, 773], [700, 786], [780, 801], [870, 791], [960, 776], [1050, 769], [1130, 783], [1200, 802]],
})
treeMass({
  key: 'tree-bottom', z: 6.5, fillTo: 1700, radius: [13, 22], step: 20, faint: 20, flecks: 25,
  contour: [[380, 960], [500, 938], [620, 924], [740, 908], [860, 912], [980, 924], [1090, 932]],
})

mkdirSync(dirname(outputPath), { recursive: true })
const meshes = [...byPart.entries()].map(([part, list]) => mergePart(part, list))
const result = writeGlb(outputPath, meshes, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-atl-hoe.mjs', 'atl-hoe')
console.log(`Wrote ${outputPath}`)
for (const mesh of meshes) console.log(`  ${mesh.name}: ${mesh.indices.length / 3} triangles, ${mesh.positions.length / 3} vertices`)
console.log(`  total ${result.triangles} triangles, ${(result.byteLength / 1024).toFixed(0)} KB`)
