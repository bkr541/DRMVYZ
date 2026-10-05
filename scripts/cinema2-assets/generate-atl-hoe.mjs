// Generates ATL HOE's complete Atlanta night scene as a single, in-house GLB.
// The preset camera looks down -Z; the Waffle House sign sits in the foreground
// while the four landmark silhouettes occupy progressively deeper skyline layers.
//
//   node scripts/cinema2-assets/generate-atl-hoe.mjs [out.glb]
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { hash, writeGlb } from './cinema2-tube-kit.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputPath = process.argv[2] ? resolve(process.argv[2]) : join(root, 'public/cinema2/models/atl-hoe.glb')

const MATERIALS = {
  sky: { baseColorFactor: [0.008, 0.022, 0.042, 1], metallicFactor: 0, roughnessFactor: 1 },
  stars: { baseColorFactor: [0.5, 0.65, 0.8, 1], metallicFactor: 0, roughnessFactor: 0.7, emissiveFactor: [0.75, 0.9, 1] },
  buildings: { baseColorFactor: [0.035, 0.055, 0.07, 1], metallicFactor: 0.45, roughnessFactor: 0.72 },
  landmarkDark: { baseColorFactor: [0.055, 0.075, 0.087, 1], metallicFactor: 0.5, roughnessFactor: 0.58 },
  landmarkGlass: { baseColorFactor: [0.025, 0.065, 0.085, 1], metallicFactor: 0.72, roughnessFactor: 0.22 },
  warmWindows: { baseColorFactor: [0.7, 0.32, 0.045, 1], metallicFactor: 0, roughnessFactor: 0.46, emissiveFactor: [1, 0.43, 0.055] },
  cyanWindows: { baseColorFactor: [0.02, 0.42, 0.56, 1], metallicFactor: 0, roughnessFactor: 0.4, emissiveFactor: [0.02, 0.65, 0.9] },
  crown: { baseColorFactor: [0.92, 0.46, 0.035, 1], metallicFactor: 0.18, roughnessFactor: 0.3, emissiveFactor: [1, 0.48, 0.045] },
  signMetal: { baseColorFactor: [0.018, 0.024, 0.028, 1], metallicFactor: 0.88, roughnessFactor: 0.26 },
  signTrim: { baseColorFactor: [0.11, 0.14, 0.15, 1], metallicFactor: 0.85, roughnessFactor: 0.2 },
  signGlow: { baseColorFactor: [1, 0.82, 0.025, 1], metallicFactor: 0, roughnessFactor: 0.33, emissiveFactor: [1, 0.7, 0.02] },
  signBorder: { baseColorFactor: [1, 0.34, 0.008, 1], metallicFactor: 0.05, roughnessFactor: 0.3, emissiveFactor: [0.8, 0.2, 0.005] },
  signLetters: { baseColorFactor: [0.003, 0.003, 0.002, 1], metallicFactor: 0.05, roughnessFactor: 0.72 },
  road: { baseColorFactor: [0.018, 0.024, 0.026, 1], metallicFactor: 0.35, roughnessFactor: 0.8 },
  foliage: { baseColorFactor: [0.003, 0.012, 0.014, 1], metallicFactor: 0, roughnessFactor: 1 },
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

// A deep blue plane closes the world behind the skyline. Small emissive cubes
// float just in front of it so stars retain parallax and bloom without a texture.
box('sky', [0, 10, -34], [52, 26, 0.25])
for (let i = 0; i < 94; i += 1) {
  const x = -23 + hash(`star-x-${i}`) * 46
  const y = 7.5 + hash(`star-y-${i}`) * 13
  const z = -33.7 + hash(`star-z-${i}`) * 0.08
  const s = 0.018 + hash(`star-s-${i}`) * 0.04
  box('stars', [x, y, z], [s, s, s * 0.35])
}

function windowsOnFront({ key, x, y, z, width, height, cols, rows, cyanEvery = 0, warmChance = 0.58 }) {
  const dx = width / cols, dy = height / rows
  for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
    if (hash(`${key}:${row}:${col}`) > warmChance) continue
    const part = cyanEvery > 0 && (row + col * 3) % cyanEvery === 0 ? 'cyanWindows' : 'warmWindows'
    box(part, [x - width / 2 + dx * (col + 0.5), y - height / 2 + dy * (row + 0.5), z], [dx * 0.52, dy * 0.42, 0.035])
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

// Dense background massing establishes the Atlanta skyline and provides warm
// lower-city light around the four named towers.
const backgroundBlocks = [
  [-12.6, 2.6, 6.2, -17, 2.8], [-10.1, 2.1, 4.8, -15.8, 2.5], [-8.1, 2.8, 7.7, -18.2, 3],
  [-5.9, 2.5, 5.8, -15.3, 2.4], [-3.9, 2.1, 8.3, -19.5, 2.8], [1.4, 2.4, 7.1, -19.2, 2.8],
  [3.1, 1.9, 8.8, -16.5, 2.6], [8.7, 2.4, 6.4, -18, 2.8], [11.1, 2.2, 8.1, -16.2, 2.5],
  [13.4, 2.7, 6.8, -19.5, 3],
]
for (const [x, width, height, z, depth] of backgroundBlocks) blockBuilding(`background-${x}`, x, width, height, z, depth, { warmChance: 0.6 })

// Westin Peachtree Plaza: a segmented cylindrical glass tower with continuous
// floor rings, vertical mullions, the Sun Dial crown, and a thin rooftop mast.
const westinX = -0.8, westinZ = -15.4
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
const truistX = 3.45, truistZ = -17.8
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
const promenadeX = 7.65, promenadeZ = -18.6
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
const gpX = 12.25, gpZ = -17.2
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

// Layered downtown freeway and sodium pools beneath the skyline.
box('road', [0, 0.82, -8.5], [30, 0.42, 2.8])
box('road', [0, 0.24, -7.8], [31, 0.16, 3.3])
for (let x = -14; x <= 14; x += 2.7) {
  box('road', [x, -0.55, -8.3], [0.26, 1.45, 0.35])
  box('warmWindows', [x, 0.52, -6.9], [0.12, 0.12, 0.08])
}

// The Waffle House sign: six cells over five offset cells, dimensional frames,
// warm translucent faces, purpose-built black letters, rear cabinet, and steel supports.
const panel = 1.42, gap = 0.08
const topY = 7.4, bottomY = 5.86, signZ = 3.25
const bottomStart = -7.46
const topStart = bottomStart - (panel + gap) / 2
const signPivot = new THREE.Vector3(-5.2, 6.65, signZ)
// The camera sits to the sign's right. A shallow positive yaw nearly aligns
// the face with that sightline and reads front-on, so the hero sign turns far
// enough past it to expose the left cabinet walls and recede toward the right.
const signRotation = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, THREE.MathUtils.degToRad(50), -0.01))
const signTransform = new THREE.Matrix4()
  .makeTranslation(signPivot.x + 0.35, signPivot.y + 1.1, signPivot.z + 1.8)
  .multiply(signRotation)
  .multiply(new THREE.Matrix4().makeTranslation(-signPivot.x, -signPivot.y, -signPivot.z))
const signBox = (part, at, size, rotate = [0, 0, 0], name) => addGeometry(
  part,
  new THREE.BoxGeometry(1, 1, 1),
  { at, size, rotate, name, parentMatrix: signTransform },
)

function signCell(x, y) {
  const cabinet = panel + 0.18
  const bezel = panel + 0.04
  const face = panel - 0.14
  const faceZ = signZ + 0.43
  signBox('signMetal', [x, y, signZ], [cabinet, cabinet, 0.72])
  signBox('signTrim', [x, y, signZ + 0.37], [bezel, bezel, 0.12])
  signBox('signGlow', [x, y, faceZ], [face, face, 0.075])
  const borderOffset = face * 0.43
  signBox('signBorder', [x, y + borderOffset, faceZ + 0.055], [face * 0.9, 0.028, 0.035])
  signBox('signBorder', [x, y - borderOffset, faceZ + 0.055], [face * 0.9, 0.028, 0.035])
  signBox('signBorder', [x - borderOffset, y, faceZ + 0.055], [0.028, face * 0.9, 0.035])
  signBox('signBorder', [x + borderOffset, y, faceZ + 0.055], [0.028, face * 0.9, 0.035])
  for (const [dx, dy] of [[-0.69, -0.69], [-0.69, 0.69], [0.69, -0.69], [0.69, 0.69]]) {
    addGeometry('signTrim', new THREE.CylinderGeometry(0.032, 0.032, 0.045, 10), {
      at: [x + dx, y + dy, signZ + 0.445], rotate: [Math.PI / 2, 0, 0], parentMatrix: signTransform,
    })
  }
}
for (let i = 0; i < 6; i += 1) signCell(topStart + i * (panel + gap), topY)
for (let i = 0; i < 5; i += 1) signCell(bottomStart + i * (panel + gap), bottomY)

const glyphWidth = { W: 1.08, A: 0.94, F: 0.82, L: 0.82, E: 0.82, H: 0.88, O: 0.94, U: 0.88, S: 0.84 }

function polygon(points) {
  const shape = new THREE.Shape()
  shape.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i += 1) shape.lineTo(points[i][0], points[i][1])
  shape.closePath()
  return shape
}

function rectangle(x0, y0, x1, y1) {
  return polygon([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
}

function roundedRect(x0, y0, x1, y1, radius) {
  const shape = new THREE.Shape()
  shape.moveTo(x0 + radius, y0)
  shape.lineTo(x1 - radius, y0)
  shape.quadraticCurveTo(x1, y0, x1, y0 + radius)
  shape.lineTo(x1, y1 - radius)
  shape.quadraticCurveTo(x1, y1, x1 - radius, y1)
  shape.lineTo(x0 + radius, y1)
  shape.quadraticCurveTo(x0, y1, x0, y1 - radius)
  shape.lineTo(x0, y0 + radius)
  shape.quadraticCurveTo(x0, y0, x0 + radius, y0)
  shape.closePath()
  return shape
}

// These glyphs are modeled explicitly for the eleven sign cells. Their widths,
// strokes, counters, and curves are tuned independently so the wordmark remains
// broad and unmistakable after perspective compression and bloom.
function letterShapes(letter) {
  const w = glyphWidth[letter]
  const left = -w / 2, right = w / 2
  const bottom = -0.54, top = 0.54
  const stroke = 0.19

  switch (letter) {
    case 'W':
      return [polygon([
        [left, top], [left + 0.22, top], [left + 0.34, -0.16], [-0.11, 0.23],
        [0, -0.16], [0.11, 0.23], [right - 0.34, -0.16], [right - 0.22, top],
        [right, top], [right - 0.22, bottom], [0.13, bottom], [0, -0.18],
        [-0.13, bottom], [left + 0.22, bottom],
      ])]
    case 'A': {
      const outer = polygon([[left, bottom], [-0.13, top], [0.13, top], [right, bottom], [right - 0.23, bottom], [0.29, -0.04], [-0.29, -0.04], [left + 0.23, bottom]])
      return [outer, rectangle(-0.29, -0.08, 0.29, 0.09)]
    }
    case 'F':
      return [rectangle(left, bottom, left + stroke, top), rectangle(left, top - stroke, right, top), rectangle(left, 0.02, right - 0.09, 0.02 + stroke)]
    case 'L':
      return [rectangle(left, bottom, left + stroke, top), rectangle(left, bottom, right, bottom + stroke)]
    case 'E':
      return [rectangle(left, bottom, left + stroke, top), rectangle(left, top - stroke, right, top), rectangle(left, -stroke / 2, right - 0.07, stroke / 2), rectangle(left, bottom, right, bottom + stroke)]
    case 'H':
      return [rectangle(left, bottom, left + stroke, top), rectangle(right - stroke, bottom, right, top), rectangle(left, -stroke / 2, right, stroke / 2)]
    case 'O': {
      const outer = roundedRect(left, bottom, right, top, 0.3)
      outer.holes.push(roundedRect(left + stroke, bottom + stroke, right - stroke, top - stroke, 0.14))
      return [outer]
    }
    case 'U': {
      const outer = new THREE.Shape()
      outer.moveTo(left, top)
      outer.lineTo(left + stroke, top)
      outer.lineTo(left + stroke, -0.22)
      outer.quadraticCurveTo(left + stroke, bottom, 0, bottom)
      outer.quadraticCurveTo(right - stroke, bottom, right - stroke, -0.22)
      outer.lineTo(right - stroke, top)
      outer.lineTo(right, top)
      outer.lineTo(right, -0.22)
      outer.quadraticCurveTo(right, bottom, 0, bottom)
      outer.quadraticCurveTo(left, bottom, left, -0.22)
      outer.closePath()
      return [outer]
    }
    case 'S':
      return [
        rectangle(left, top - stroke, right, top),
        rectangle(left, -stroke / 2, left + stroke, top),
        rectangle(left, -stroke / 2, right, stroke / 2),
        rectangle(right - stroke, bottom, right, stroke / 2),
        rectangle(left, bottom, right, bottom + stroke),
      ]
    default:
      throw new Error(`Unsupported ATL HOE sign glyph: ${letter}`)
  }
}

function letterGeometry(letter) {
  let geometry = new THREE.ExtrudeGeometry(letterShapes(letter), {
    depth: 0.11,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.014,
    bevelSegments: 1,
    curveSegments: 8,
  })
  geometry.translate(0, 0, -0.055)
  geometry.scale(1, 1, 1.35)
  geometry = mergeVertices(geometry, 1e-5)
  geometry.computeVertexNormals()
  return geometry
}
for (const [word, start, y] of [['WAFFLE', topStart, topY], ['HOUSE', bottomStart, bottomY]]) {
  for (let i = 0; i < word.length; i += 1) addGeometry('signLetters', letterGeometry(word[i]), { at: [start + i * (panel + gap), y, signZ + 0.535], parentMatrix: signTransform })
}

// Backing rails and splayed roadside support legs make the sign read as a
// freestanding object even when the bottom of the frame is cropped.
signBox('signMetal', [-5.2, 8.23, signZ - 0.08], [9.58, 0.22, 0.78])
signBox('signMetal', [-3.92, 5.02, signZ - 0.08], [8.08, 0.24, 0.82])
signBox('signMetal', [-5.75, 2.35, signZ - 0.38], [0.38, 5.0, 0.5], [0, 0, -0.23])
signBox('signMetal', [-1.95, 2.25, signZ - 0.38], [0.38, 4.8, 0.5], [0, 0, 0.25])
signBox('signMetal', [-3.86, 2.25, signZ - 0.46], [0.32, 5.1, 0.46])
signBox('signMetal', [-5.34, 8.9, signZ - 0.42], [0.24, 1.55, 0.52])
signBox('signMetal', [-4.94, 8.9, signZ - 0.5], [0.28, 1.72, 0.56])

// Near-black tree canopy on the lower right, built from low-poly volumes so
// the camera and haze still produce depth around its silhouette.
for (let i = 0; i < 48; i += 1) {
  const x = 5.4 + hash(`tree-x-${i}`) * 9.8
  const y = -0.2 + hash(`tree-y-${i}`) * 3.7
  const z = 1.4 + hash(`tree-z-${i}`) * 3.2
  const r = 0.65 + hash(`tree-r-${i}`) * 1.05
  addGeometry('foliage', new THREE.IcosahedronGeometry(1, 1), { at: [x, y, z], size: [r * 1.2, r, r * 0.72] })
}

mkdirSync(dirname(outputPath), { recursive: true })
const meshes = [...byPart.entries()].map(([part, list]) => mergePart(part, list))
const result = writeGlb(outputPath, meshes, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-atl-hoe.mjs', 'atl-hoe')
console.log(`Wrote ${outputPath}`)
for (const mesh of meshes) console.log(`  ${mesh.name}: ${mesh.indices.length / 3} triangles, ${mesh.positions.length / 3} vertices`)
console.log(`  total ${result.triangles} triangles, ${(result.byteLength / 1024).toFixed(0)} KB`)
