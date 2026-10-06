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

// The city and road layer is intentionally disabled while its replacement is
// redesigned. The sign, sky, stars, and foreground foliage remain generated.
const includeCityAndRoad = false
if (includeCityAndRoad) {
// Three overlapping city bands close the horizon while retaining lower contrast
// with distance. Roofline and window rhythms vary deterministically by building.
const cityBands = [
  { part: 'distantBuildings', prefix: 'far', warmChance: 0.14, blocks: [
    [-20, 2.8, 4.5, -28, 2.4], [-17.5, 2.1, 6.1, -27.2, 2.2], [-15.2, 2.7, 5.2, -28.5, 2.5], [-12.5, 2.3, 7.0, -26.8, 2.4],
    [-9.9, 2.8, 5.8, -28.1, 2.7], [-7.1, 2.2, 7.8, -26.4, 2.3], [-4.6, 2.7, 5.4, -27.6, 2.6], [-2.0, 2.1, 6.6, -28.4, 2.2],
    [0.4, 2.8, 5.0, -27.1, 2.5], [3.0, 2.0, 7.2, -28.2, 2.2], [5.4, 2.7, 5.7, -26.7, 2.6], [8.0, 2.1, 6.8, -28.5, 2.3],
    [10.5, 2.8, 5.3, -27.4, 2.5], [13.2, 2.2, 7.4, -28.2, 2.4], [15.8, 2.9, 5.8, -26.9, 2.7], [18.5, 2.4, 6.5, -28.3, 2.5], [21.2, 2.8, 5.5, -27.1, 2.6],
  ] },
  { part: 'midBuildings', prefix: 'mid', warmChance: 0.31, blocks: [
    [-17.8, 2.6, 6.8, -22.5, 2.7], [-15.1, 2.2, 8.5, -21.2, 2.5], [-12.7, 2.5, 5.9, -23.1, 2.6], [-10.1, 2.9, 9.1, -21.7, 2.9],
    [-7.2, 2.3, 6.7, -22.8, 2.5], [-4.8, 2.1, 8.0, -20.9, 2.4], [-2.5, 2.7, 5.6, -23.0, 2.8], [0.1, 2.0, 7.2, -21.8, 2.4],
    [5.6, 2.1, 6.3, -22.6, 2.5], [9.5, 2.4, 7.6, -21.5, 2.6], [13.8, 2.7, 6.5, -22.8, 2.8], [16.6, 2.3, 8.2, -21.4, 2.5], [19.4, 2.8, 6.9, -22.4, 2.7],
  ] },
  { part: 'nearBuildings', prefix: 'near', warmChance: 0.46, blocks: [
    [-16.5, 2.8, 5.4, -14.8, 2.8], [-13.7, 2.3, 7.1, -13.5, 2.5], [-11.2, 2.7, 5.8, -15.4, 2.7], [-8.4, 2.5, 7.8, -14.1, 2.6],
    [-5.8, 2.2, 5.2, -13.2, 2.4], [-3.5, 2.4, 6.8, -15.0, 2.6], [1.0, 2.2, 5.0, -13.7, 2.5], [5.8, 2.1, 5.9, -14.7, 2.4],
    [9.2, 2.5, 5.3, -13.4, 2.6], [12.3, 2.4, 6.4, -14.8, 2.5], [15.1, 2.8, 5.6, -13.6, 2.8], [18.2, 2.7, 7.0, -14.5, 2.7], [21.0, 2.5, 5.2, -13.2, 2.5],
  ] },
]
for (const band of cityBands) for (let i = 0; i < band.blocks.length; i += 1) {
  const [x, width, height, z, depth] = band.blocks[i]
  const key = `${band.prefix}-${i}`
  box(band.part, [x, height / 2, z], [width, height, depth])
  const steppedRoof = i % 3 === 1
  if (steppedRoof) box(band.part, [x, height + 0.28, z], [width * 0.62, 0.56, depth * 0.72])
  if (i % 5 === 2) box(band.part, [x + width * 0.18, height + (steppedRoof ? 0.7 : 0.35), z], [0.08, 0.7, 0.08])
  windowsOnFront({ key, x, y: height * 0.52, z: z + depth / 2 + 0.03, width: width * 0.82, height: height * 0.8, cols: Math.max(3, Math.round(width * 2.1)), rows: Math.max(5, Math.round(height * 1.25)), warmChance: band.warmChance, cyanEvery: band.prefix === 'near' && i % 4 === 0 ? 9 : 0, sizeVariation: 0.3 })
  if (band.prefix !== 'far' && i % 2 === 0) windowsOnSide({ key, x: x + width / 2 + 0.025, y: height * 0.52, z, depth: depth * 0.8, height: height * 0.78, cols: 3, rows: Math.max(5, Math.round(height)), warmChance: band.warmChance * 0.55 })
}

// Westin Peachtree Plaza: a segmented cylindrical glass tower with continuous
// floor rings, vertical mullions, the Sun Dial crown, and a thin rooftop mast.
const westinX = 2.8, westinZ = -15.4
cylinder('landmarkGlass', [westinX, 6.35, westinZ], 1.08, 12.7, 40, [0, 0, 0], 'westin-body')
for (let floor = 1; floor < 21; floor += 1) cylinder('landmarkDark', [westinX, 0.25 + floor * 0.59, westinZ], 1.095, 0.035, 40)
for (let segment = 0; segment < 24; segment += 1) {
  const angle = (segment / 24) * Math.PI * 2
  box('signTrim', [westinX + Math.sin(angle) * 1.09, 6.38, westinZ + Math.cos(angle) * 1.09], [0.035, 12.35, 0.05], [0, angle, 0])
}
for (let row = 0; row < 19; row += 1) {
  const y = 0.65 + row * 0.61
  for (let segment = 0; segment < 24; segment += 1) {
    if (hash(`westin-${row}-${segment}`) > 0.52) continue
    const angle = (segment / 24) * Math.PI * 2
    if (Math.sin(angle) < -0.25) continue
    const x = westinX + Math.sin(angle) * 1.086
    const z = westinZ + Math.cos(angle) * 1.086
    box('warmWindows', [x, y, z], [0.15, 0.25, 0.025], [0, angle, 0])
  }
}
cylinder('signTrim', [westinX, 12.78, westinZ], 1.17, 0.18, 40)
cylinder('crown', [westinX, 13.02, westinZ], 1.16, 0.38, 40)
cylinder('signTrim', [westinX, 13.26, westinZ], 0.98, 0.11, 40)
cylinder('signTrim', [westinX, 14.35, westinZ], 0.035, 2.15, 10)

// Truist Plaza: deep recessed bays, full-height vertical ribs, a heavier base,
// and a gold stepped crown whose dark ledges remain visible through bloom.
const truistX = 9.2, truistZ = -17.8
box('landmarkDark', [truistX, 7.05, truistZ], [2.65, 14.1, 2.5], [0, 0, 0], 'truist-body')
box('landmarkDark', [truistX, 1.2, truistZ + 0.08], [2.88, 2.4, 2.68], [0, 0, 0], 'truist-base')
windowsOnFront({ key: 'truist', x: truistX, y: 7.1, z: truistZ + 1.27, width: 2.25, height: 12.8, cols: 7, rows: 22, warmChance: 0.43 })
frontRibs({ x: truistX, y: 7.2, z: truistZ + 1.34, width: 2.34, height: 13.45, count: 8 })
floorBands({ x: truistX, y0: 0.62, z: truistZ + 1.33, width: 2.36, floors: 20, spacing: 0.62, depth: 0.07 })
box('signTrim', [truistX - 1.34, 7.1, truistZ], [0.085, 14.1, 2.45])
box('signTrim', [truistX + 1.34, 7.1, truistZ], [0.085, 14.1, 2.45])
const crownLevels = [[2.75, 0.55], [2.35, 0.5], [1.88, 0.5], [1.45, 0.47], [1.04, 0.42], [0.68, 0.36], [0.36, 0.3]]
let crownY = 14.1
for (const [width, height] of crownLevels) {
  const depth = 2.2 * (width / 2.75)
  box('signTrim', [truistX, crownY + height / 2, truistZ], [width + 0.12, height + 0.06, depth + 0.12])
  box('crown', [truistX, crownY + height / 2, truistZ + depth / 2 + 0.07], [width - 0.1, height * 0.66, 0.08])
  crownY += height * 0.88
}
box('crown', [truistX, crownY + 0.35, truistZ], [0.08, 0.9, 0.08])

// Promenade II: a slender reflective shaft with pronounced ziggurat setbacks,
// stainless vertical fins, and restrained turquoise lighting between dark bays.
const promenadeX = 14.0, promenadeZ = -18.6
box('landmarkGlass', [promenadeX, 5.85, promenadeZ], [2.08, 11.7, 2.0], [0, 0, 0], 'promenade-body')
box('landmarkDark', [promenadeX - 0.94, 5.7, promenadeZ + 0.02], [0.22, 11.4, 2.08])
box('landmarkDark', [promenadeX + 0.94, 5.7, promenadeZ + 0.02], [0.22, 11.4, 2.08])
for (let row = 0; row < 18; row += 1) {
  const y = 0.7 + row * 0.58
  const cyan = row % 4 === 1 || row % 7 === 0
  for (let col = 0; col < 5; col += 1) {
    if (!cyan && hash(`promenade-${row}-${col}`) > 0.43) continue
    box(cyan ? 'cyanWindows' : 'warmWindows', [promenadeX - 0.78 + col * 0.39, y, promenadeZ + 1.02], [0.21, 0.18, 0.035])
  }
}
frontRibs({ x: promenadeX, y: 5.9, z: promenadeZ + 1.04, width: 1.72, height: 11.45, count: 6 })
floorBands({ x: promenadeX, y0: 0.55, z: promenadeZ + 1.035, width: 1.8, floors: 18, spacing: 0.59, depth: 0.065 })
const promenadeTiers = [[1.78, 0.72, 1.82], [1.4, 0.68, 1.54], [1.0, 0.62, 1.18], [0.62, 0.52, 0.78]]
let promenadeY = 11.7
for (let tier = 0; tier < promenadeTiers.length; tier += 1) {
  const [width, height, depth] = promenadeTiers[tier]
  box('landmarkGlass', [promenadeX, promenadeY + height / 2, promenadeZ], [width, height, depth])
  box('signTrim', [promenadeX, promenadeY + 0.06, promenadeZ + depth / 2 + 0.04], [width + 0.1, 0.08, 0.07])
  if (tier < 3) box('cyanWindows', [promenadeX, promenadeY + height * 0.56, promenadeZ + depth / 2 + 0.045], [width * 0.72, 0.1, 0.04])
  promenadeY += height * 0.82
}
box('signTrim', [promenadeX, promenadeY + 0.48, promenadeZ], [0.06, 1.05, 0.06])

// Georgia-Pacific Tower: broad offset granite-like slabs, a split upper mass,
// deep vertical piers, and sparse warm offices keep it darker than its neighbors.
const gpX = 20.0, gpZ = -17.2
const gpFront = gpZ + 1.38
box('landmarkDark', [gpX, 5.35, gpZ], [2.7, 10.7, 2.76], [0, 0, 0], 'georgia-pacific-body')
box('landmarkDark', [gpX - 0.55, 7.05, gpZ + 0.08], [1.5, 14.1, 2.6])
box('landmarkDark', [gpX - 0.76, 7.42, gpZ + 0.14], [1.02, 14.84, 2.48])
box('landmarkDark', [gpX + 0.78, 4.45, gpZ + 0.12], [1.18, 8.9, 2.52])
box('landmarkDark', [gpX + 1.2, 3.2, gpZ + 0.2], [0.58, 6.4, 2.36])
windowsOnFront({ key: 'gp-main', x: gpX, y: 5.2, z: gpFront + 0.035, width: 2.35, height: 9.65, cols: 6, rows: 16, warmChance: 0.28 })
for (let row = 0; row < 6; row += 1) for (let col = 0; col < 3; col += 1) {
  if (hash(`gp-upper-${row}-${col}`) > 0.25) continue
  box('warmWindows', [gpX - 0.98 + col * 0.34, 10.75 + row * 0.58, gpFront + 0.04], [0.2, 0.16, 0.035])
}
frontRibs({ x: gpX, y: 5.35, z: gpFront + 0.06, width: 2.58, height: 10.7, count: 7 })
box('signTrim', [gpX - 1.31, 7.0, gpZ + 0.1], [0.09, 14.0, 2.5])
box('signTrim', [gpX + 1.31, 5.25, gpZ + 0.1], [0.09, 10.5, 2.5])

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
const SIGN_ROLL_DEG = -8.5
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
