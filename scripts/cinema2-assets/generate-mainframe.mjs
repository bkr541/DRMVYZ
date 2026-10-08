// Generates Mainframe's shallow hard-surface wall from the owner-supplied 1920 × 1080 Pass 1-3 contract.
// The model preserves the exact route coordinates and logo paths while replacing SVG depth/glow effects with real bevelled geometry.
// Every mesh carries `_GLOW_PHASE` plus `_MAINFRAME_ROUTE`, `_MAINFRAME_BANK`, `_MAINFRAME_REGION`, and `_MAINFRAME_SYSTEM`.
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { fromGeometry, roundedBox, transformed } from './cinema2-hard-surface-kit.mjs'
import { buildExtrusion, contoursOfAdaptive, nestedShapes } from './cinema2-svg-relief-kit.mjs'
import { writeGlb } from './cinema2-tube-kit.mjs'
import { assertMainframeSourceContract, loadMainframeSourceContract } from './mainframe-source-contract.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputPath = process.argv[2] ? resolve(process.argv[2]) : join(root, 'public/cinema2/models/mainframe.glb')
const contract = assertMainframeSourceContract(loadMainframeSourceContract())

const WORLD_SCALE = 1 / 150
const CANVAS_CENTER = [960, 540]
const AUTHORED_BOARD_SIZE = [13.02, 7.52]
// The generated wall extends 150% beyond the original 16:9 master in each axis.
// This preserves the owner's centre composition while providing real modeled
// continuation for the 0.45 Scale position on narrow embedded Stages.
const BOARD_EXTENSION_MULTIPLIER = 2.5
const BOARD_SIZE = AUTHORED_BOARD_SIZE.map(value => value * BOARD_EXTENSION_MULTIPLIER)
const CREASE = (38 * Math.PI) / 180
const SYSTEM = Object.freeze({ board: 0, circuits: 1, terminals: 2, vias: 3, radar: 4, chip: 5, logoOuter: 6, logoBody: 7, logoStar: 8 })
const BANK = Object.freeze({ A: 0, B: 1, C: 2, D: 3 })
const REGION_IDS = Object.freeze(Object.keys(contract.regions).sort())
const REGION = Object.freeze(Object.fromEntries(REGION_IDS.map((id, index) => [id, index])))

const MATERIALS = Object.freeze({
  board: { baseColorFactor: [0.018, 0.026, 0.021, 1], metallicFactor: 0.12, roughnessFactor: 0.78 },
  plates: { baseColorFactor: [0.055, 0.068, 0.06, 1], metallicFactor: 0.62, roughnessFactor: 0.48 },
  recesses: { baseColorFactor: [0.006, 0.009, 0.007, 1], metallicFactor: 0.18, roughnessFactor: 0.68 },
  circuitHousings: { baseColorFactor: [0.19, 0.23, 0.205, 1], metallicFactor: 0.88, roughnessFactor: 0.29 },
  hardware: { baseColorFactor: [0.34, 0.38, 0.35, 1], metallicFactor: 0.96, roughnessFactor: 0.2 },
  circuitCores: { baseColorFactor: [0.08, 0.36, 0.045, 1], metallicFactor: 0, roughnessFactor: 0.32, emissiveFactor: [0.32, 1, 0.16] },
  indicatorCores: { baseColorFactor: [0.22, 0.62, 0.12, 1], metallicFactor: 0, roughnessFactor: 0.24, emissiveFactor: [0.48, 1, 0.28] },
  radarHardware: { baseColorFactor: [0.24, 0.28, 0.25, 1], metallicFactor: 0.94, roughnessFactor: 0.22 },
  radarCores: { baseColorFactor: [0.16, 0.52, 0.09, 1], metallicFactor: 0, roughnessFactor: 0.22, emissiveFactor: [0.38, 1, 0.22] },
  chipHardware: { baseColorFactor: [0.09, 0.105, 0.095, 1], metallicFactor: 0.7, roughnessFactor: 0.32 },
  chipCores: { baseColorFactor: [0.12, 0.45, 0.07, 1], metallicFactor: 0, roughnessFactor: 0.3, emissiveFactor: [0.34, 1, 0.19] },
  logoHousing: { baseColorFactor: [0.49, 0.54, 0.5, 1], metallicFactor: 1, roughnessFactor: 0.16 },
  logoCore: { baseColorFactor: [0.18, 0.62, 0.1, 1], metallicFactor: 0.05, roughnessFactor: 0.18, emissiveFactor: [0.42, 1, 0.24] },
})

const byPart = new Map()
const worldPoint = ([x, y]) => [(x - CANVAS_CENTER[0]) * WORLD_SCALE, (CANVAS_CENTER[1] - y) * WORLD_SCALE]
const matrixAt = ([x, y, z], rotationZ = 0) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rotationZ),
  new THREE.Vector3(1, 1, 1),
)
const moved = (mesh, at, rotationZ = 0) => transformed(mesh, matrixAt(at, rotationZ))

function decorate(mesh, { phase = 0, route = -1, bank = -1, region = -1, system = SYSTEM.board } = {}) {
  const vertices = mesh.positions.length / 3
  const values = source => Float32Array.from({ length: vertices }, (_, index) => typeof source === 'function'
    ? source(mesh.positions[index * 3], mesh.positions[index * 3 + 1], mesh.positions[index * 3 + 2])
    : source)
  return {
    ...mesh,
    phases: values(phase),
    routeValues: values(route),
    bankValues: values(bank),
    regionValues: values(region),
    systemValues: values(system),
  }
}

function add(part, mesh, metadata = {}) {
  if (!byPart.has(part)) byPart.set(part, [])
  byPart.get(part).push(decorate(mesh, metadata))
}

function mergePart(part, list) {
  const positions = [], normals = [], indices = [], phases = [], routes = [], banks = [], regions = [], systems = []
  for (const mesh of list) {
    const base = positions.length / 3
    positions.push(...mesh.positions); normals.push(...mesh.normals); phases.push(...mesh.phases)
    routes.push(...mesh.routeValues); banks.push(...mesh.bankValues); regions.push(...mesh.regionValues); systems.push(...mesh.systemValues)
    for (const index of mesh.indices) indices.push(base + index)
  }
  return {
    name: part,
    part,
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: Uint32Array.from(indices),
    phases: new Float32Array(phases),
    attributes: {
      _MAINFRAME_ROUTE: { array: new Float32Array(routes), type: 'SCALAR' },
      _MAINFRAME_BANK: { array: new Float32Array(banks), type: 'SCALAR' },
      _MAINFRAME_REGION: { array: new Float32Array(regions), type: 'SCALAR' },
      _MAINFRAME_SYSTEM: { array: new Float32Array(systems), type: 'SCALAR' },
    },
  }
}

function box(part, at, size, radius, metadata = {}, rotationZ = 0) {
  add(part, moved(roundedBox(size[0], size[1], size[2], radius, 2), at, rotationZ), metadata)
}

function plainBox(part, at, size, metadata = {}, rotationZ = 0) {
  add(part, moved(fromGeometry(new THREE.BoxGeometry(...size), CREASE), at, rotationZ), metadata)
}

function disc(radius, depth, segments, at) {
  const geometry = new THREE.CylinderGeometry(radius, radius, depth, segments, 1, false)
  geometry.rotateX(Math.PI / 2)
  geometry.translate(...at)
  return fromGeometry(geometry, CREASE)
}

function ring(radius, tube, at, segments = 48) {
  const geometry = new THREE.TorusGeometry(radius, tube, 8, segments)
  geometry.translate(...at)
  return fromGeometry(geometry, CREASE)
}

function flatDisc(radius, at, segments = 8) {
  const positions = [at[0], at[1], at[2]], normals = [0, 0, 1], indices = []
  for (let index = 0; index < segments; index += 1) {
    const angle = index / segments * Math.PI * 2
    positions.push(at[0] + Math.cos(angle) * radius, at[1] + Math.sin(angle) * radius, at[2])
    normals.push(0, 0, 1)
  }
  for (let index = 0; index < segments; index += 1) indices.push(0, index + 1, (index + 1) % segments + 1)
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: Uint32Array.from(indices) }
}

function flatRing(radius, width, at, segments = 12) {
  const positions = [], normals = [], indices = [], inner = Math.max(0, radius - width)
  for (let index = 0; index < segments; index += 1) {
    const angle = index / segments * Math.PI * 2
    for (const value of [radius, inner]) {
      positions.push(at[0] + Math.cos(angle) * value, at[1] + Math.sin(angle) * value, at[2])
      normals.push(0, 0, 1)
    }
  }
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments
    indices.push(index * 2, next * 2, index * 2 + 1, next * 2, next * 2 + 1, index * 2 + 1)
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: Uint32Array.from(indices) }
}

// The 2× master contains hundreds of small outer routes and indicators. Thin
// face meshes preserve its exact authored coordinates while the central master
// retains the deeper bevelled geometry approved in Stage 2.
function flatRibbon(points, width, z) {
  const positions = [], normals = [], indices = []
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index], b = points[index + 1]
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (length < 1e-8) continue
    const nx = -(b[1] - a[1]) / length * width / 2
    const ny = (b[0] - a[0]) / length * width / 2
    const base = positions.length / 3
    positions.push(a[0] + nx, a[1] + ny, z, a[0] - nx, a[1] - ny, z, b[0] + nx, b[1] + ny, z, b[0] - nx, b[1] - ny, z)
    normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1)
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3)
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: Uint32Array.from(indices) }
}

function barBetween(part, a, b, width, depth, z, metadata = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  box(part, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z], [Math.hypot(dx, dy), width, depth], Math.min(width * 0.35, 0.035), metadata, Math.atan2(dy, dx))
}

function strokePolygon(points, width) {
  const half = width / 2
  const directions = points.slice(0, -1).map((point, index) => {
    const next = points[index + 1]
    const length = Math.hypot(next[0] - point[0], next[1] - point[1])
    return [(next[0] - point[0]) / length, (next[1] - point[1]) / length]
  })
  const side = sign => points.map((point, index) => {
    const before = directions[Math.max(0, index - 1)]
    const after = directions[Math.min(directions.length - 1, index)]
    const n0 = [-before[1] * sign, before[0] * sign]
    const n1 = [-after[1] * sign, after[0] * sign]
    if (index === 0) return [point[0] + n1[0] * half, point[1] + n1[1] * half]
    if (index === points.length - 1) return [point[0] + n0[0] * half, point[1] + n0[1] * half]
    const mx = n0[0] + n1[0], my = n0[1] + n1[1]
    const length = Math.hypot(mx, my)
    if (length < 1e-8) return [point[0] + n1[0] * half, point[1] + n1[1] * half]
    const ux = mx / length, uy = my / length
    const distance = Math.min(half * 2.5, half / Math.max(0.4, ux * n1[0] + uy * n1[1]))
    return [point[0] + ux * distance, point[1] + uy * distance]
  })
  return [...side(1), ...side(-1).reverse()]
}

function strokeMesh(points, width, centerZ, depth, bevel) {
  const polygon = strokePolygon(points, width)
  const mesh = buildExtrusion([{ outer: polygon, holes: [] }], { depth, bevel, creaseAngle: CREASE, bevelSegments: 2, offset: -bevel })
  return moved(mesh, [0, 0, centerZ])
}

function signedArea(points) {
  let area = 0
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    area += points[previous][0] * points[index][1] - points[index][0] * points[previous][1]
  }
  return area / 2
}

// Offset a closed authored contour with mitered joins. Unlike strokeMesh,
// this preserves the closing cubic and produces a true shallow 3D rail rather
// than treating a pair of logo contour lines as one filled region.
function offsetClosedLoop(points, distance) {
  return points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length]
    const next = points[(index + 1) % points.length]
    const beforeLength = Math.hypot(point[0] - previous[0], point[1] - previous[1])
    const afterLength = Math.hypot(next[0] - point[0], next[1] - point[1])
    const before = [(point[0] - previous[0]) / beforeLength, (point[1] - previous[1]) / beforeLength]
    const after = [(next[0] - point[0]) / afterLength, (next[1] - point[1]) / afterLength]
    const n0 = [-before[1], before[0]], n1 = [-after[1], after[0]]
    const mx = n0[0] + n1[0], my = n0[1] + n1[1]
    const miterLength = Math.hypot(mx, my)
    if (miterLength < 1e-8) return [point[0] + n1[0] * distance, point[1] + n1[1] * distance]
    const ux = mx / miterLength, uy = my / miterLength
    const scale = Math.min(Math.abs(distance) * 3, Math.abs(distance / Math.max(0.34, Math.abs(ux * n1[0] + uy * n1[1])))) * Math.sign(distance)
    return [point[0] + ux * scale, point[1] + uy * scale]
  })
}

function closedStrokeMesh(points, width, centerZ, depth, bevel) {
  const left = offsetClosedLoop(points, width / 2)
  const right = offsetClosedLoop(points, -width / 2)
  const [outer, hole] = Math.abs(signedArea(left)) > Math.abs(signedArea(right)) ? [left, right] : [right, left]
  return moved(buildExtrusion([{ outer, holes: [hole] }], {
    depth, bevel, creaseAngle: CREASE, bevelSegments: 2, offset: -bevel,
  }), [0, 0, centerZ])
}

function phaseAlong(points) {
  const lengths = [0]
  for (let index = 1; index < points.length; index += 1) lengths.push(lengths.at(-1) + Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]))
  const total = lengths.at(-1)
  const firstDistance = Math.hypot(points[0][0], points[0][1])
  const lastDistance = Math.hypot(points.at(-1)[0], points.at(-1)[1])
  const firstIsOuter = firstDistance > lastDistance
  return (x, y) => {
    let nearestDistance = Infinity, nearestProgress = 0
    for (let index = 0; index < points.length - 1; index += 1) {
      const a = points[index], b = points[index + 1]
      const dx = b[0] - a[0], dy = b[1] - a[1], lengthSquared = dx * dx + dy * dy
      const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / lengthSquared))
      const px = a[0] + dx * t, py = a[1] + dy * t
      const distance = Math.hypot(x - px, y - py)
      if (distance < nearestDistance) { nearestDistance = distance; nearestProgress = (lengths[index] + Math.sqrt(lengthSquared) * t) / total }
    }
    return firstIsOuter ? 1 - nearestProgress : nearestProgress
  }
}

// ── Board, plates, seams, vents, and fasteners ───────────────────────────────
box('board', [0, 0, -0.19], [BOARD_SIZE[0], BOARD_SIZE[1], 0.38], 0.18)
for (const spec of [
  [0, 0, 5.55, 3.5, 0], [-4.55, 0, 3.45, 5.85, 0], [4.55, 0, 3.45, 5.85, 0],
  [0, 2.78, 4.25, 1.3, 0], [0, -2.78, 4.25, 1.3, 0],
  [-5.45, 2.66, 1.8, 0.82, -0.18], [5.45, 2.66, 1.8, 0.82, 0.18],
  [-5.45, -2.66, 1.8, 0.82, 0.18], [5.45, -2.66, 1.8, 0.82, -0.18],
]) box('plates', [spec[0], spec[1], 0.005], [spec[2], spec[3], 0.09], 0.09, {}, spec[4])

// Exact outer panel placements from the owner-authored 3840 × 2160 master.
for (const plate of contract.extension.plates) {
  const [left, top] = worldPoint([plate.x, plate.y])
  const [right, bottom] = worldPoint([plate.x + plate.width, plate.y + plate.height])
  plainBox('plates', [(left + right) / 2, (top + bottom) / 2, -0.005], [Math.abs(right - left), Math.abs(top - bottom), 0.08])
}

for (const y of [-3.18, -2.35, 2.35, 3.18]) {
  box('recesses', [0, y, 0.058], [3.0, 0.035, 0.018], 0.01)
  for (const x of [-5.9, -4.9, 4.9, 5.9]) box('recesses', [x, y, 0.06], [0.7, 0.028, 0.02], 0.008)
}
for (const x of [-6.05, -5.15, 5.15, 6.05]) box('recesses', [x, 0, 0.06], [0.028, 1.65, 0.02], 0.008)

for (const signX of [-1, 1]) for (const signY of [-1, 1]) {
  const centre = [signX * 5.35, signY * 2.42]
  for (let row = -1; row <= 1; row += 1) for (let col = -2; col <= 2; col += 1) {
    const x = centre[0] + col * 0.12 + (Math.abs(row) % 2) * 0.06
    const y = centre[1] + row * 0.105
    add('recesses', disc(0.042, 0.024, 6, [x, y, 0.073]))
  }
}

for (const [x, y] of [[-6.15, -3.25], [-6.15, 3.25], [6.15, -3.25], [6.15, 3.25], [-3.15, -3.3], [-3.15, 3.3], [3.15, -3.3], [3.15, 3.3]]) {
  add('hardware', disc(0.065, 0.055, 6, [x, y, 0.09]))
  add('recesses', disc(0.022, 0.061, 12, [x, y, 0.105]))
}
// ── Exact circuit routes ─────────────────────────────────────────────────────
contract.routes.forEach((route, routeIndex) => {
  const points = route.points.map(worldPoint)
  const metadata = { route: routeIndex, bank: BANK[route.bank], region: REGION[route.region], system: SYSTEM.circuits }
  const phase = phaseAlong(points)
  add('recesses', strokeMesh(points, 30 * WORLD_SCALE, 0.09, 0.08, 0.025), metadata)
  add('circuitHousings', strokeMesh(points, 26 * WORLD_SCALE, 0.145, 0.13, 0.032), metadata)
  add('recesses', strokeMesh(points, 15 * WORLD_SCALE, 0.213, 0.055, 0.015), metadata)
  add('circuitCores', strokeMesh(points, 8.5 * WORLD_SCALE, 0.245, 0.035, 0.012), { ...metadata, phase })
})

const extensionRegion = route => {
  const named = {
    'west-extension': 'left-major', 'west-buses': 'left-major',
    'east-extension': 'right-major', 'east-buses': 'right-major',
    'north-extension': 'top-center', 'south-extension': 'bottom-center',
    'nw-corner': 'left-branch', 'north-shoulder-west': 'left-branch',
    'sw-corner': 'left-minor', 'south-shoulder-west': 'left-minor',
    'ne-corner': 'right-branch', 'north-shoulder-east': 'right-branch',
    'se-corner': 'right-minor', 'south-shoulder-east': 'right-minor',
  }[route.region]
  if (named) return named
  const x = route.points.reduce((sum, point) => sum + point[0], 0) / route.points.length
  const y = route.points.reduce((sum, point) => sum + point[1], 0) / route.points.length
  if (Math.abs(x - CANVAS_CENTER[0]) < 360 && y < 180) return 'top-center'
  if (Math.abs(x - CANVAS_CENTER[0]) < 360 && y > 900) return 'bottom-center'
  if (x < CANVAS_CENTER[0]) return y < CANVAS_CENTER[1] ? 'left-branch' : 'left-minor'
  return y < CANVAS_CENTER[1] ? 'right-branch' : 'right-minor'
}

// The supplied extension owns every outer route; no procedural line extension
// remains. Its 356 paths retain bank, region and centre-out phase identities.
contract.extension.routes.forEach((route, index) => {
  const points = route.points.map(worldPoint)
  const metadata = { route: contract.routes.length + index, bank: BANK[route.bank], region: REGION[extensionRegion(route)], system: SYSTEM.circuits }
  add('circuitHousings', flatRibbon(points, route.housingWidth * WORLD_SCALE, 0.165), metadata)
  add('circuitCores', flatRibbon(points, route.coreWidth * WORLD_SCALE, 0.247), { ...metadata, phase: phaseAlong(points) })
})

// ── Terminals and vias ───────────────────────────────────────────────────────
for (const terminal of contract.components.terminals) {
  const [x, y] = worldPoint([terminal.cx, terminal.cy])
  const radius = terminal.r * WORLD_SCALE
  const metadata = { system: SYSTEM.terminals }
  add('hardware', disc(radius * 1.12, 0.13, 24, [x, y, 0.255]), metadata)
  add('recesses', disc(radius * 0.72, 0.145, 24, [x, y, 0.275]), metadata)
  add('indicatorCores', disc(radius * 0.37, 0.16, 20, [x, y, 0.295]), { ...metadata, phase: 0.75 })
}
for (const via of contract.components.vias) {
  const [x, y] = worldPoint([via.cx, via.cy])
  const radius = Math.max(0.035, via.radius * WORLD_SCALE)
  const metadata = { system: SYSTEM.vias }
  add('hardware', disc(radius * 1.3, 0.075, 18, [x, y, 0.22]), metadata)
  add('indicatorCores', disc(radius * 0.55, 0.09, 16, [x, y, 0.238]), { ...metadata, phase: 0.85 })
}

// Authored outer pins, LED banks, vias and link pads. These intentionally use
// compact face geometry because they are sub-pixel to small at the 0.45 review
// scale, but each remains independently phase-addressable in the merged mesh.
for (const terminal of contract.extension.terminals) {
  const [x, y] = worldPoint([terminal.cx, terminal.cy])
  const radius = Math.max(0.026, terminal.radius * WORLD_SCALE)
  const system = terminal.type === 'module-pin' ? SYSTEM.terminals : SYSTEM.vias
  const phase = Math.min(1, Math.hypot(x, y) / 12)
  add('hardware', flatDisc(radius * 1.05, [x, y, 0.205], 5), { system })
  add('indicatorCores', flatDisc(radius * 0.42, [x, y, 0.257], 5), { system, phase })
}

// ── Four radar assemblies ────────────────────────────────────────────────────
for (const radar of contract.components.radars) {
  const [x, y] = worldPoint([radar.cx, radar.cy])
  const metadata = { system: SYSTEM.radar }
  const radius = radar.outer_radius * WORLD_SCALE
  add('radarHardware', disc(radius * 1.08, 0.2, 48, [x, y, 0.24]), metadata)
  add('recesses', disc(radius * 0.86, 0.215, 48, [x, y, 0.265]), metadata)
  add('radarHardware', ring(radius * 0.72, 0.045, [x, y, 0.39]), metadata)
  add('radarCores', ring(radius * 0.64, 0.025, [x, y, 0.415]), { ...metadata, phase: 0.35 })
  add('radarHardware', ring(radius * 0.46, 0.04, [x, y, 0.395]), metadata)
  add('radarCores', ring(radius * 0.38, 0.023, [x, y, 0.42]), { ...metadata, phase: 0.58 })
  add('radarHardware', ring(radius * 0.25, 0.035, [x, y, 0.4]), metadata)
  add('radarCores', disc(radius * 0.12, 0.12, 24, [x, y, 0.41]), { ...metadata, phase: 0.82 })
  for (let spoke = 0; spoke < 4; spoke += 1) {
    const angle = spoke * Math.PI / 2
    const a = [x + Math.cos(angle) * radius * 0.79, y + Math.sin(angle) * radius * 0.79]
    const b = [x + Math.cos(angle) * radius * 1.16, y + Math.sin(angle) * radius * 1.16]
    barBetween('radarHardware', a, b, 0.055, 0.08, 0.34, metadata)
    add('radarCores', disc(0.045, 0.095, 18, [b[0], b[1], 0.37]), { ...metadata, phase: 1 })
  }
  for (let bolt = 0; bolt < 8; bolt += 1) {
    const angle = (bolt / 8) * Math.PI * 2 + Math.PI / 8
    add('hardware', disc(0.035, 0.06, 6, [x + Math.cos(angle) * radius * 0.93, y + Math.sin(angle) * radius * 0.93, 0.37]), metadata)
  }
}

// Sixteen additional radar assemblies are positioned exactly from the 2× SVG.
for (const radar of contract.extension.radars) {
  const [x, y] = worldPoint([radar.cx, radar.cy])
  const radius = radar.radius * WORLD_SCALE
  const metadata = { system: SYSTEM.radar }
  add('radarHardware', flatDisc(radius * 1.04, [x, y, 0.23], 12), metadata)
  add('radarCores', flatRing(radius * 0.72, radius * 0.1, [x, y, 0.275], 12), { ...metadata, phase: 0.38 })
  add('radarCores', flatRing(radius * 0.43, radius * 0.08, [x, y, 0.278], 10), { ...metadata, phase: 0.68 })
  add('radarCores', flatDisc(radius * 0.15, [x, y, 0.282], 8), { ...metadata, phase: 1 })
}

// ── Two chip assemblies ──────────────────────────────────────────────────────
for (const chip of contract.components.chips) {
  const [left, top] = worldPoint([chip.x, chip.y])
  const [right, bottom] = worldPoint([chip.x + chip.width, chip.y + chip.height])
  const cx = (left + right) / 2, cy = (top + bottom) / 2
  const width = Math.abs(right - left), height = Math.abs(top - bottom)
  const metadata = { system: SYSTEM.chip }
  box('chipHardware', [cx, cy, 0.31], [width, height, 0.24], 0.08, metadata)
  box('recesses', [cx, cy, 0.445], [width * 0.78, height * 0.78, 0.07], 0.045, metadata)
  box('chipHardware', [cx, cy, 0.49], [width * 0.64, height * 0.64, 0.055], 0.035, metadata)
  box('chipCores', [cx, cy, 0.525], [width * 0.5, height * 0.5, 0.035], 0.025, { ...metadata, phase: 0.65 })
  for (let pin = 0; pin < 6; pin += 1) {
    const t = (pin + 0.5) / 6 - 0.5
    for (const side of [-1, 1]) {
      plainBox('chipCores', [cx + side * width * 0.57, cy + t * height * 0.78, 0.4], [0.14, 0.045, 0.045], { ...metadata, phase: pin / 5 })
      plainBox('chipCores', [cx + t * width * 0.78, cy + side * height * 0.57, 0.4], [0.045, 0.14, 0.045], { ...metadata, phase: pin / 5 })
    }
  }
  add('chipCores', disc(0.045, 0.045, 18, [cx - width * 0.23, cy + height * 0.23, 0.57]), { ...metadata, phase: 1 })
}

// Eight additional chips retain the supplied master positions and the same
// toggle/reactivity system as the two central chip assemblies.
for (const chip of contract.extension.chips) {
  const [left, top] = worldPoint([chip.x, chip.y])
  const [right, bottom] = worldPoint([chip.x + chip.width, chip.y + chip.height])
  const cx = (left + right) / 2, cy = (top + bottom) / 2
  const width = Math.abs(right - left), height = Math.abs(top - bottom)
  const metadata = { system: SYSTEM.chip }
  plainBox('chipHardware', [cx, cy, 0.25], [width, height, 0.12], metadata)
  plainBox('chipCores', [cx, cy, 0.32], [width * 0.58, height * 0.58, 0.025], { ...metadata, phase: 0.65 })
  for (let pin = 0; pin < 8; pin += 1) {
    const t = (pin + 0.5) / 8 - 0.5
    for (const side of [-1, 1]) {
      add('chipCores', flatRibbon([[cx + side * width * 0.5, cy + t * height * 0.8], [cx + side * width * 0.64, cy + t * height * 0.8]], 0.026, 0.305), { ...metadata, phase: pin / 7 })
      add('chipCores', flatRibbon([[cx + t * width * 0.8, cy + side * height * 0.5], [cx + t * width * 0.8, cy + side * height * 0.64]], 0.026, 0.305), { ...metadata, phase: pin / 7 })
    }
  }
}

// Four secondary daughterboards occupy the previously empty north/south bays.
// The upper pair reads as controller/heat-sink hardware; the lower pair reads
// as power distribution with capacitor banks. All illuminated details live in
// the chip system, so the existing Enable Chip control remains authoritative.
const bayCentre = (x, y) => worldPoint([x, y])
for (const side of [-1, 1]) {
  const [cx, cy] = bayCentre(side < 0 ? 80 : 1840, -380)
  const metadata = { system: SYSTEM.chip }
  plainBox('chipHardware', [cx, cy, 0.235], [1.46, 0.62, 0.11], metadata)
  plainBox('chipHardware', [cx, cy, 0.315], [0.68, 0.4, 0.07], metadata)
  plainBox('chipCores', [cx, cy, 0.36], [0.46, 0.26, 0.025], { ...metadata, phase: 0.58 })
  for (let fin = -3; fin <= 3; fin += 1) plainBox('chipHardware', [cx + fin * 0.085, cy, 0.4], [0.032, 0.43, 0.075], metadata)
  for (const edge of [-1, 1]) {
    plainBox('chipHardware', [cx + edge * 0.56, cy, 0.335], [0.17, 0.36, 0.065], metadata)
    for (let pin = -2; pin <= 2; pin += 1) {
      add('chipCores', flatRibbon([[cx + edge * 0.64, cy + pin * 0.075], [cx + edge * 0.8, cy + pin * 0.075]], 0.025, 0.345), { ...metadata, phase: (pin + 2) / 4 })
    }
  }
  for (let led = -1; led <= 1; led += 1) add('chipCores', flatDisc(0.035, [cx + led * 0.14, cy - 0.24, 0.385], 6), { ...metadata, phase: (led + 1) / 2 })
}

for (const side of [-1, 1]) {
  const [cx, cy] = bayCentre(side < 0 ? 80 : 1840, 1440)
  const metadata = { system: SYSTEM.chip }
  plainBox('chipHardware', [cx, cy, 0.235], [1.46, 0.62, 0.11], metadata)
  for (const xOffset of [-0.42, 0.42]) {
    plainBox('chipHardware', [cx + xOffset, cy, 0.33], [0.34, 0.4, 0.12], metadata)
    add('chipCores', flatRing(0.12, 0.025, [cx + xOffset, cy, 0.398], 10), { ...metadata, phase: xOffset < 0 ? 0.42 : 0.78 })
  }
  for (let capacitor = 0; capacitor < 6; capacitor += 1) {
    const column = capacitor % 3 - 1
    const row = Math.floor(capacitor / 3) - 0.5
    add('chipHardware', disc(0.075, 0.13, 8, [cx + column * 0.19, cy + row * 0.2, 0.36]), metadata)
  }
  for (const edge of [-1, 1]) for (let pin = -2; pin <= 2; pin += 1) {
    add('chipCores', flatRibbon([[cx + edge * 0.62, cy + pin * 0.075], [cx + edge * 0.8, cy + pin * 0.075]], 0.025, 0.345), { ...metadata, phase: (pin + 2) / 4 })
  }
  for (let led = -1.5; led <= 1.5; led += 1) add('chipCores', flatDisc(0.032, [cx + led * 0.12, cy - 0.24, 0.385], 6), { ...metadata, phase: (led + 1.5) / 3 })
}

// Four large symmetric power-regulation nodes fill the inner extension bays.
// Their rings use the via/high-frequency system while the corner lamps use the
// terminal/kick system, giving each assembly two independent reactive layers.
const INNER_POWER_NODE_SCALE = 1.8
for (const [svgX, svgY] of [[380, -120], [1540, -120], [380, 1200], [1540, 1200]]) {
  const [cx, cy] = worldPoint([svgX, svgY])
  plainBox('hardware', [cx, cy, 0.22], [1.35 * INNER_POWER_NODE_SCALE, 0.9 * INNER_POWER_NODE_SCALE, 0.12], { system: SYSTEM.board })
  add('hardware', flatRing(0.43 * INNER_POWER_NODE_SCALE, 0.045 * INNER_POWER_NODE_SCALE, [cx, cy, 0.292], 12), { system: SYSTEM.vias })
  add('hardware', disc(0.35 * INNER_POWER_NODE_SCALE, 0.13, 12, [cx, cy, 0.33]), { system: SYSTEM.vias })
  add('recesses', flatDisc(0.27 * INNER_POWER_NODE_SCALE, [cx, cy, 0.405], 12), { system: SYSTEM.vias })
  add('indicatorCores', flatRing(0.235 * INNER_POWER_NODE_SCALE, 0.045 * INNER_POWER_NODE_SCALE, [cx, cy, 0.414], 12), { system: SYSTEM.vias, phase: 0.64 })
  for (const [dx, dy, phase] of [[-0.5, -0.3, 0.15], [0.5, -0.3, 0.4], [-0.5, 0.3, 0.7], [0.5, 0.3, 1]]) {
    add('indicatorCores', flatDisc(0.048 * INNER_POWER_NODE_SCALE, [cx + dx * INNER_POWER_NODE_SCALE, cy + dy * INNER_POWER_NODE_SCALE, 0.3], 6), { system: SYSTEM.terminals, phase })
  }
  for (const [dx, dy] of [[-0.48, -0.13], [-0.48, 0.13], [0.48, -0.13], [0.48, 0.13]]) {
    add('hardware', disc(0.065 * INNER_POWER_NODE_SCALE, 0.11, 6, [cx + dx * INNER_POWER_NODE_SCALE, cy + dy * INNER_POWER_NODE_SCALE, 0.33]), { system: SYSTEM.board })
  }
  for (const side of [-1, 1]) for (let pad = -1.5; pad <= 1.5; pad += 1) {
    add('indicatorCores', flatRibbon([
      [cx + side * 0.675 * INNER_POWER_NODE_SCALE, cy + pad * 0.12 * INNER_POWER_NODE_SCALE],
      [cx + side * 0.82 * INNER_POWER_NODE_SCALE, cy + pad * 0.12 * INNER_POWER_NODE_SCALE],
    ], 0.032 * INNER_POWER_NODE_SCALE, 0.29), { system: SYSTEM.vias, phase: (pad + 1.5) / 3 })
  }
}

// ── Exact three-part DVYDRM logo with authored contour rails ─────────────────
const transformMatch = contract.logo.transform.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/)
if (!transformMatch) throw new Error(`Unsupported logo transform: ${contract.logo.transform}`)
const logoTx = Number(transformMatch[1]), logoTy = Number(transformMatch[2]), logoScale = Number(transformMatch[3])
const logoToWorld = contour => contour.map(([x, y]) => worldPoint([logoTx + x * logoScale, logoTy + y * logoScale]))
// 1.25 source pixels keeps the cubic silhouette sub-pixel smooth at the Stage
// while avoiding duplicate high-density tessellation across housing/rail pairs.
const logoContours = path => contoursOfAdaptive(path, 1.25).map(logoToWorld)

// The outer master is two independent stroked contours. Filling between them
// created the previous swollen cloud silhouette, so each contour now becomes
// its own housing and inset light rail at the SVG's non-scaling stroke widths.
const outerMetadata = { system: SYSTEM.logoOuter }
for (const contour of logoContours(contract.logo.master.outerHousing)) {
  add('logoHousing', closedStrokeMesh(contour, 22 * WORLD_SCALE, 0.475, 0.24, 0.026), outerMetadata)
}
for (const contour of logoContours(contract.logo.master.outerRail)) {
  add('logoCore', closedStrokeMesh(contour, 14 * WORLD_SCALE, 0.61, 0.05, 0.009), { ...outerMetadata, phase: 0.35 })
}

// The logo body is contour hardware only. The owner-approved construction has
// no cloud-shaped backing plate: the mainframe board remains visible through
// every space between the seven authored internal rails.
const bodyMetadata = { system: SYSTEM.logoBody }
for (const contour of logoContours(contract.logo.master.bodyHousing)) {
  add('logoHousing', closedStrokeMesh(contour, 18 * WORLD_SCALE, 0.535, 0.075, 0.012), bodyMetadata)
}
for (const contour of logoContours(contract.logo.master.bodyRail)) {
  add('logoCore', closedStrokeMesh(contour, 8 * WORLD_SCALE, 0.59, 0.045, 0.008), { ...bodyMetadata, phase: 0.7 })
}

// The lower diamond remains a discrete beat-reactive logo zone with a narrow
// machined bezel, matching the master's final compositing order.
const starMetadata = { system: SYSTEM.logoStar }
const starShapes = nestedShapes(contoursOfAdaptive(contract.logo.master.star, 0.75), logoToWorld)
add('logoHousing', moved(buildExtrusion(starShapes, {
  depth: 0.18, bevel: 0.025, creaseAngle: CREASE, bevelSegments: 3, offset: 0.006,
}), [0, 0, 0.46]), starMetadata)
add('logoCore', moved(buildExtrusion(starShapes, {
  depth: 0.055, bevel: 0.009, creaseAngle: CREASE, bevelSegments: 2, offset: -0.009,
}), [0, 0, 0.59]), { ...starMetadata, phase: 1 })

mkdirSync(dirname(outputPath), { recursive: true })
const meshes = [...byPart.entries()].map(([part, list]) => mergePart(part, list))
const result = writeGlb(outputPath, meshes, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-mainframe.mjs', 'mainframe')
console.log(`Wrote ${outputPath}`)
for (const mesh of meshes) console.log(`  ${mesh.name}: ${mesh.indices.length / 3} triangles, ${mesh.positions.length / 3} vertices`)
console.log(`  total ${result.triangles} triangles, ${(result.byteLength / 1024).toFixed(0)} KB`)
