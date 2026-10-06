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
  landmarkGlass: { baseColorFactor: [0.025, 0.065, 0.085, 1], metallicFactor: 0.72, roughnessFactor: 0.22 },
  warmWindows: { baseColorFactor: [0.7, 0.32, 0.045, 1], metallicFactor: 0, roughnessFactor: 0.46, emissiveFactor: [1, 0.43, 0.055] },
  cyanWindows: { baseColorFactor: [0.02, 0.42, 0.56, 1], metallicFactor: 0, roughnessFactor: 0.4, emissiveFactor: [0.02, 0.65, 0.9] },
  crown: { baseColorFactor: [0.92, 0.46, 0.035, 1], metallicFactor: 0.18, roughnessFactor: 0.3, emissiveFactor: [1, 0.48, 0.045] },
  // The night sign: near-black painted steel (cabinet, base rail and legs = signMetal; cell frames = signBorder; the faint edge rails and
  // rivets that catch a cool rim light = signTrim), a flat, bright yellow face in each cell (signGlow) and flat black letters (signLetters).
  signMetal: { baseColorFactor: [0.012, 0.013, 0.016, 1], metallicFactor: 0.55, roughnessFactor: 0.38, emissiveFactor: [0.002, 0.003, 0.006] },
  signTrim: { baseColorFactor: [0.06, 0.07, 0.085, 1], metallicFactor: 0.7, roughnessFactor: 0.28, emissiveFactor: [0.004, 0.006, 0.012] },
  signGlow: { baseColorFactor: [1, 0.78, 0, 1], metallicFactor: 0, roughnessFactor: 0.5, emissiveFactor: [1, 0.65, 0.01] },
  signBorder: { baseColorFactor: [0.006, 0.007, 0.009, 1], metallicFactor: 0.45, roughnessFactor: 0.42, emissiveFactor: [0.001, 0.002, 0.004] },
  signLetters: { baseColorFactor: [0.004, 0.004, 0.004, 1], metallicFactor: 0, roughnessFactor: 0.82 },
  road: { baseColorFactor: [0.018, 0.024, 0.026, 1], metallicFactor: 0.35, roughnessFactor: 0.8 },
  roadGlow: { baseColorFactor: [0.14, 0.055, 0.012, 1], metallicFactor: 0, roughnessFactor: 0.65, emissiveFactor: [0.28, 0.075, 0.006] },
  foliageBack: { baseColorFactor: [0.012, 0.035, 0.04, 1], metallicFactor: 0, roughnessFactor: 1 },
  foliage: { baseColorFactor: [0.02, 0.055, 0.05, 1], metallicFactor: 0, roughnessFactor: 1 },
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
// Buildings run well below the frame so the tall Stage preview never shows a floating base.
const REF_BASE_V = 1700
/** A block between reference columns u0..u1, from reference row vTop down to the base, `depth` deep, centred on plane z. */
function refBlock(part, u0, u1, vTop, z, depth, name) {
  // Both edges are read on the same row: the camera is yawed a little, so x drifts with the row and reading the base row would skew a tall block.
  const [x0, yTop] = refPoint(u0, vTop, z)
  const [x1] = refPoint(u1, vTop, z)
  const [, yBase] = refPoint(u1, REF_BASE_V, z)
  box(part, [(x0 + x1) / 2, (yTop + yBase) / 2, z], [Math.abs(x1 - x0), yTop - yBase, depth], [0, 0, 0], name)
}
/** A block floating between two reference rows (a crown tier, a ring). */
function refBand(part, u0, u1, vTop, vBottom, z, depth, name) {
  const [x0, yTop] = refPoint(u0, vTop, z)
  const [x1] = refPoint(u1, vTop, z)
  const [, yBottom] = refPoint(u1, vBottom, z)
  box(part, [(x0 + x1) / 2, (yTop + yBottom) / 2, z], [Math.abs(x1 - x0), yTop - yBottom, depth], [0, 0, 0], name)
}
/** A round tube (tower, ring, mast) between reference columns u0..u1 and rows vTop..vBottom. */
function refRound(part, u0, u1, vTop, vBottom, z, name, segments = 40) {
  const [x0, yTop] = refPoint(u0, vTop, z)
  const [x1] = refPoint(u1, vTop, z)
  const [, yBottom] = refPoint(u1, vBottom, z)
  const radius = Math.abs(x1 - x0) / 2
  cylinder(part, [(x0 + x1) / 2, (yTop + yBottom) / 2, z], radius, yTop - yBottom, segments, [0, 0, 0], name)
  return radius
}

// Landmarks stand on one plane. Fill buildings sit in three bands: far (low contrast), mid (behind the landmarks) and near (in front of
// their bases, as in the reference).
const LANDMARK_Z = -16
const FAR_Z = -28, MID_Z = -21, NEAR_Z = -12

// Bank of America Plaza: a tall ribbed shaft capped by a pyramid roof and a thin spire.
refBlock('landmarkDark', 872, 1018, 238, LANDMARK_Z, 3.4, 'boa-shaft')
refBand('landmarkDark', 866, 1024, 232, 262, LANDMARK_Z, 3.6, 'boa-shoulder')
{
  const [xl, yBase] = refPoint(886, 236, LANDMARK_Z)
  const [xr, yApex] = refPoint(1002, 100, LANDMARK_Z)
  const baseWidth = xr - xl
  addGeometry('landmarkDark', new THREE.ConeGeometry(1, 1, 4), {
    at: [(xl + xr) / 2, (yBase + yApex) / 2, LANDMARK_Z], size: [baseWidth / Math.SQRT2, yApex - yBase, baseWidth / Math.SQRT2], rotate: [0, Math.PI / 4, 0], name: 'boa-pyramid',
  })
  refBand('landmarkDark', 941, 947, 100, 70, LANDMARK_Z, 0.12, 'boa-spire')
}

// Westin Peachtree Plaza: a round glass tower with a wider ring crown and a mast.
refRound('landmarkGlass', 1086, 1184, 335, REF_BASE_V, LANDMARK_Z, 'westin-shaft')
refRound('landmarkDark', 1082, 1190, 298, 340, LANDMARK_Z, 'westin-crown-ring', 48)
refBand('landmarkDark', 1132, 1138, 298, 218, LANDMARK_Z, 0.1, 'westin-mast')

// Truist Plaza: a straight shaft with five set-back crown tiers and a spike.
refBlock('landmarkDark', 1228, 1372, 383, LANDMARK_Z, 3.2, 'truist-shaft')
for (const [i, [u0, u1, vTop, vBottom]] of [[1236, 1364, 355, 385], [1252, 1348, 325, 356], [1266, 1334, 296, 326], [1280, 1320, 270, 297], [1292, 1308, 247, 271]].entries()) {
  refBand('landmarkDark', u0, u1, vTop, vBottom, LANDMARK_Z, 3.0 - i * 0.25, `truist-tier-${i}`)
}
refBand('landmarkDark', 1297, 1303, 247, 228, LANDMARK_Z, 0.1, 'truist-spike')

// Georgia-Pacific Tower: a broad slab stepping down toward the right edge in set-backs.
refBlock('landmarkDark', 1447, 1562, 228, LANDMARK_Z, 4.6, 'gp-slab-a')
refBlock('landmarkDark', 1558, 1610, 276, LANDMARK_Z, 4.4, 'gp-slab-b')
refBlock('landmarkDark', 1606, 1634, 332, LANDMARK_Z, 4.2, 'gp-slab-c')
refBlock('landmarkDark', 1630, 1680, 560, LANDMARK_Z, 4.0, 'gp-slab-d')

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

// Wider Stages show more city than the reference frame, so the skyline keeps going past both edges (reference columns -1300 … 0 and
// 1672 … 3000, enough for a 3:1 Stage) with the same three bands and varied widths and heights.
for (const [part, band, z, depth, topMin, topMax] of [['distantBuildings', 'far', FAR_Z, 3, 600, 680], ['midBuildings', 'mid', MID_Z, 3.4, 520, 640], ['nearBuildings', 'near', NEAR_Z, 3.2, 660, 730]]) {
  for (const [side, start, end] of [['left', -1300, 0], ['right', 1672, 3000]]) {
    let u = start
    for (let i = 0; u < end; i += 1) {
      const width = 80 + hash(`wide-${side}-${band}-w-${i}`) * 110
      const top = topMin + hash(`wide-${side}-${band}-t-${i}`) * (topMax - topMin)
      refBlock(part, u, u + width + 6, top, z, depth, `wide-${side}-${band}-${i}`)
      u += width
    }
  }
}

// The elevated road is switched off until Phase 5.
const includeRoad = false
if (includeRoad) {
// Layered downtown freeway: two decks, edge barriers, underside beams, a
// rising ramp, and staggered columns. Warm pools are localized beneath lamps.
box('road', [0, 0.76, -8.35], [34, 0.46, 3.05], [0, 0.035, -0.006], 'freeway-near-deck')
box('road', [-1.4, 1.62, -10.85], [31, 0.38, 2.35], [0, -0.025, 0.008], 'freeway-rear-deck')
box('road', [0, -1.48, -7.05], [32, 0.14, 2.55], [0, 0.018, 0], 'freeway-service-deck')
box('road', [0, 1.12, -6.83], [34.1, 0.42, 0.16], [0, 0.035, -0.006], 'freeway-near-barrier')
box('road', [-1.4, 1.94, -9.67], [31.1, 0.35, 0.14], [0, -0.025, 0.008], 'freeway-rear-barrier')
box('road', [-8.7, 1.18, -7.25], [10.2, 0.3, 1.65], [0, -0.08, 0.075], 'freeway-ramp')
for (let x = -15.5; x <= 15.5; x += 2.55) {
  box('road', [x, 0.43, -8.3], [0.18, 0.34, 3.2], [0, 0.035, 0], 'freeway-crossbeam')
}
for (let i = 0; i < 10; i += 1) {
  const x = -14.2 + i * 3.15
  const z = -8.65 + (i % 2) * 0.42
  box('road', [x, -0.55, z], [0.34, 2.1, 0.52], [0, 0.03, 0], 'freeway-column')
  if (i % 2 === 0) box('road', [x, 0.33, z], [1.05, 0.24, 0.65], [0, 0.03, 0], 'freeway-cap')
}
for (const [i, x] of [-11.8, -5.4, 1.2, 8.1, 13.2].entries()) {
  box('roadGlow', [x, 0.47, -6.78], [0.16, 0.13, 0.1], [0, 0, 0], `road-lamp-${i}`)
  addGeometry('roadGlow', new THREE.CylinderGeometry(1, 1, 0.035, 24), {
    at: [x, -1.39, -7.05], size: [0.72, 1, 0.38], name: `road-pool-${i}`,
  })
}
}

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

// Layered lower-right canopy. A muted back layer establishes breadth, visible
// branches break up the base, and larger near clusters form an irregular edge.
for (let i = 0; i < 104; i += 1) {
  const x = 4.6 + hash(`tree-back-x-${i}`) * 13.8
  const y = -0.1 + hash(`tree-back-y-${i}`) * 4.15
  const z = -0.4 + hash(`tree-back-z-${i}`) * 2.2
  const r = 0.3 + hash(`tree-back-r-${i}`) * 0.62
  addGeometry('foliageBack', new THREE.IcosahedronGeometry(1, 1), { at: [x, y, z], size: [r * 1.28, r, r * 0.7] })
}
for (let i = 0; i < 14; i += 1) {
  const x = 6.0 + hash(`branch-x-${i}`) * 9.5
  const y = -0.45 + hash(`branch-y-${i}`) * 1.5
  const angle = -0.55 + hash(`branch-angle-${i}`) * 1.1
  cylinder('foliage', [x, y, 3.2 + hash(`branch-z-${i}`) * 1.2], 0.11 + hash(`branch-r-${i}`) * 0.11, 2.0 + hash(`branch-h-${i}`) * 2.6, 8, [0, 0, angle], `tree-branch-${i}`)
}
for (let i = 0; i < 132; i += 1) {
  const x = 5.1 + hash(`tree-front-x-${i}`) * 12.9
  const y = -0.45 + hash(`tree-front-y-${i}`) * 4.3
  const z = 2.1 + hash(`tree-front-z-${i}`) * 3.8
  const r = 0.34 + hash(`tree-front-r-${i}`) * 0.68
  addGeometry('foliage', new THREE.IcosahedronGeometry(1, 1), { at: [x, y, z], size: [r * (1.08 + hash(`tree-wide-${i}`) * 0.35), r, r * 0.74] })
}

mkdirSync(dirname(outputPath), { recursive: true })
const meshes = [...byPart.entries()].map(([part, list]) => mergePart(part, list))
const result = writeGlb(outputPath, meshes, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-atl-hoe.mjs', 'atl-hoe')
console.log(`Wrote ${outputPath}`)
for (const mesh of meshes) console.log(`  ${mesh.name}: ${mesh.indices.length / 3} triangles, ${mesh.positions.length / 3} vertices`)
console.log(`  total ${result.triangles} triangles, ${(result.byteLength / 1024).toFixed(0)} KB`)
