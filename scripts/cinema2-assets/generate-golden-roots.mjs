// Generates the shared "golden roots" asset for Cinema 2.0's RELIQUARY preset.
//   node scripts/cinema2-assets/generate-golden-roots.mjs [out.glb]      (default: public/cinema2/models/golden-roots.glb)
//
// A hand-authored curve network (the identity-defining shape, per the owner's reference sheets), not a generative L-system: one trunk that
// splits into two mirrored cradle arms which dip behind the logo, emerge in front, and curl up to hold its lower lobes from below; a few
// tendrils fork off each arm and climb the logo's outer edge, ending in small leaves; several floor roots fan out from the trunk's base.
// Every curve is swept into a tapered tube (a rotation-minimizing frame down a Catmull-Rom spline, radius shrinking along its length) - there
// is no `TubeGeometry` with a constant radius in three, so the sweep is written by hand, the same way the logo's facets are.
// Also builds the dais: a flat stone disc with a raised ring trim, real geometry (not the native reflective-floor effect), sized to the
// root spread. Four parts/materials, matching the mesh names `three-scene` per-part overrides read: `roots` (main gold), `leaves` (lighter,
// faintly warmer gold), `dais` (dark stone) and `daisRing` (a soft bronze inlay). Coordinates: centred under the shared DVYDRM logo asset
// (2 units wide, logo centre at the origin), Y up, facing +Z, so both assets can share one Scene Graph without any extra alignment.
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputPath = process.argv[2] ? resolve(process.argv[2]) : join(root, 'public/cinema2/models/golden-roots.glb')

// ── Landmarks from the shared logo asset (measured from dvydrm-logo.glb / the master SVG) ───────────────────────────────────────────────
// Logo half-width 1.0, outline bottom -0.628, star tip -0.58, the two lower lobes' inner curl sits around y ~ -0.3..0, the top lobe starts
// past y ~ 0.15. The roots are authored against these so "wraps the lower lobes" and "climbs toward the swirls" land where they read as such.
const FLOOR_Y = -1.55
const SEED = 'reliquary-golden-roots'

function hash(value) {
  let h = 2166136261
  for (let index = 0; index < value.length; index += 1) { h ^= value.charCodeAt(index); h = Math.imul(h, 16777619) }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13
  return ((h >>> 0) % 1_000_003) / 1_000_003
}
const jitter = (key, spread) => (hash(key) - 0.5) * 2 * spread

// ── Tapered tube sweep ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Sweeps a circular cross-section of varying radius down a Catmull-Rom spline through `controlPoints`. Uses a rotation-minimizing frame
 * (sequential parallel transport, Rodrigues rotation from one tangent to the next) rather than three's Frenet frames, which flip when a
 * space curve's curvature passes through zero - exactly the near-straight, gently-twisting curves these roots are built from.
 */
function buildTaperedTube(controlPoints, { samples = 48, radiusAt, radialSegments = 8, capStart = true, capEnd = true }) {
  const curve = new THREE.CatmullRomCurve3(controlPoints.map(p => new THREE.Vector3(...p)), false, 'centripetal')
  const centres = curve.getSpacedPoints(samples)
  const tangents = centres.map((_, i) => {
    const a = centres[Math.max(0, i - 1)], b = centres[Math.min(centres.length - 1, i + 1)]
    return new THREE.Vector3().subVectors(b, a).normalize()
  })
  // Seed the first frame's "up" with anything not parallel to the first tangent, then parallel-transport it down the curve.
  const seedUp = Math.abs(tangents[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  const normals = [new THREE.Vector3().crossVectors(tangents[0], seedUp).normalize()]
  for (let i = 1; i < tangents.length; i += 1) {
    const axis = new THREE.Vector3().crossVectors(tangents[i - 1], tangents[i])
    const prev = normals[i - 1]
    if (axis.lengthSq() < 1e-10) { normals.push(prev.clone()); continue }
    const angle = Math.acos(Math.min(1, Math.max(-1, tangents[i - 1].dot(tangents[i]))))
    normals.push(prev.clone().applyAxisAngle(axis.normalize(), angle))
  }

  const positions = [], vertexNormals = [], indices = []
  for (let i = 0; i < centres.length; i += 1) {
    const t = i / (centres.length - 1)
    const radius = radiusAt(t)
    const tangent = tangents[i], normal = normals[i], binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize()
    for (let j = 0; j < radialSegments; j += 1) {
      const theta = (j / radialSegments) * Math.PI * 2
      const dir = new THREE.Vector3().addScaledVector(normal, Math.cos(theta)).addScaledVector(binormal, Math.sin(theta)).normalize()
      const point = new THREE.Vector3().copy(centres[i]).addScaledVector(dir, radius)
      positions.push(point.x, point.y, point.z)
      vertexNormals.push(dir.x, dir.y, dir.z)
    }
  }
  for (let i = 0; i < centres.length - 1; i += 1) {
    for (let j = 0; j < radialSegments; j += 1) {
      const a = i * radialSegments + j, b = i * radialSegments + ((j + 1) % radialSegments)
      const c = (i + 1) * radialSegments + j, d = (i + 1) * radialSegments + ((j + 1) % radialSegments)
      indices.push(a, c, b, b, c, d)
    }
  }
  // Simple fan caps so open ends (the trunk's floor end, a root's buried end) do not show a hollow tube.
  const capAt = (index, flip) => {
    const base = positions.length / 3
    positions.push(centres[index].x, centres[index].y, centres[index].z)
    const n = flip ? -1 : 1
    vertexNormals.push(tangents[index].x * n, tangents[index].y * n, tangents[index].z * n)
    const ring = index === 0 ? 0 : (centres.length - 1) * radialSegments
    for (let j = 0; j < radialSegments; j += 1) {
      const j2 = (j + 1) % radialSegments
      if (flip) indices.push(base, ring + j2, ring + j); else indices.push(base, ring + j, ring + j2)
    }
  }
  if (capStart) capAt(0, true)
  if (capEnd) capAt(centres.length - 1, false)
  return { positions: new Float32Array(positions), normals: new Float32Array(vertexNormals), indices: Uint32Array.from(indices) }
}

/** A small flat almond/teardrop leaf, extruded thin, placed and oriented at `at` with its length along `along` (normalized). */
function buildLeaf(at, along, size, twist) {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.quadraticCurveTo(size * 0.35, size * 0.28, size, 0)
  shape.quadraticCurveTo(size * 0.35, -size * 0.28, 0, 0)
  let geometry = new THREE.ExtrudeGeometry(shape, { depth: size * 0.06, bevelEnabled: true, bevelThickness: size * 0.03, bevelSize: size * 0.03, bevelSegments: 1, curveSegments: 6 })
  geometry.translate(0, 0, -size * 0.03)
  geometry.rotateZ(twist)
  const up = Math.abs(along.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1)
  const basis = new THREE.Matrix4().lookAt(new THREE.Vector3(), along.clone().negate(), up)
  geometry.applyMatrix4(basis)
  geometry.translate(at.x, at.y, at.z)
  geometry = mergeVertices(geometry, 1e-6)
  geometry.computeVertexNormals()
  return { positions: new Float32Array(geometry.getAttribute('position').array), normals: new Float32Array(geometry.getAttribute('normal').array), indices: Uint32Array.from(geometry.getIndex().array) }
}

// ── The curve network (right side; mirrored for the left) ────────────────────────────────────────────────────────────────────────────
const trunk = [[0, FLOOR_Y, 0], [0.05, FLOOR_Y + 0.22, 0.015], [-0.035, FLOOR_Y + 0.46, -0.02], [0.045, FLOOR_Y + 0.7, 0.01]]
const trunkTop = trunk[trunk.length - 1]
const trunkStrand = [[0.05, FLOOR_Y, 0.03], [-0.06, FLOOR_Y + 0.2, -0.04], [0.07, FLOOR_Y + 0.42, 0.03], [-0.03, FLOOR_Y + 0.62, -0.015], trunkTop]

// Rises outward, dips behind the logo (negative Z), emerges in front to wrap under the lower-right lobe, curls to a contact tip - matching
// the reference's "front wrap" / "behind cloud" / "support from below" callouts, one continuous curve.
const cradleArm = [trunkTop, [0.34, FLOOR_Y + 0.87, -0.14], [0.63, FLOOR_Y + 1.1, -0.2], [0.8, FLOOR_Y + 1.33, 0.16], [0.6, FLOOR_Y + 1.51, 0.2], [0.38, FLOOR_Y + 1.6, 0.1]]

// Three tendrils fork off the cradle arm at increasing heights and climb the outer edge toward the swirl lobes, each ending in a leaf.
const tendrils = [
  { from: [0.62, FLOOR_Y + 1.1, -0.06], points: [[0.62, FLOOR_Y + 1.1, -0.06], [0.9, FLOOR_Y + 1.35, -0.01], [0.97, FLOOR_Y + 1.6, 0.03], [0.85, FLOOR_Y + 1.83, 0.02]] },
  { from: [0.78, FLOOR_Y + 1.33, 0.02], points: [[0.78, FLOOR_Y + 1.33, 0.02], [0.94, FLOOR_Y + 1.57, 0.0], [0.87, FLOOR_Y + 1.77, -0.02], [0.67, FLOOR_Y + 1.93, 0.0]] },
  { from: [0.62, FLOOR_Y + 1.51, 0.07], points: [[0.62, FLOOR_Y + 1.51, 0.07], [0.55, FLOOR_Y + 1.73, 0.06], [0.42, FLOOR_Y + 1.91, 0.03], [0.3, FLOOR_Y + 2.01, 0.0]] },
]

// Four floor roots per side fan out from the trunk's base: forward, outward, backward and lateral, so the footprint reads from every angle.
const floorRoots = [
  [[0.03, FLOOR_Y + 0.06, 0], [0.3, FLOOR_Y + 0.11, 0.2], [0.62, FLOOR_Y + 0.05, 0.42], [0.92, FLOOR_Y, 0.5]],
  [[0.04, FLOOR_Y + 0.07, 0], [0.38, FLOOR_Y + 0.1, 0.32], [0.8, FLOOR_Y + 0.04, 0.28], [1.25, FLOOR_Y, 0.18]],
  [[0.05, FLOOR_Y + 0.07, 0], [0.46, FLOOR_Y + 0.09, 0.06], [0.96, FLOOR_Y + 0.03, 0.02], [1.42, FLOOR_Y, -0.02]],
  [[0.05, FLOOR_Y + 0.06, 0], [0.42, FLOOR_Y + 0.08, -0.22], [0.88, FLOOR_Y + 0.03, -0.3], [1.3, FLOOR_Y, -0.24]],
  [[0.06, FLOOR_Y + 0.06, 0], [0.4, FLOOR_Y + 0.08, -0.34], [0.85, FLOOR_Y + 0.02, -0.5], [1.2, FLOOR_Y, -0.6]],
  [[0.04, FLOOR_Y + 0.05, 0], [0.52, FLOOR_Y + 0.07, -0.08], [1.12, FLOOR_Y + 0.02, -0.14], [1.62, FLOOR_Y, -0.18]],
]

const mirror = points => points.map(([x, y, z]) => [-x, y, z])
const taper = (start, end) => t => start + (end - start) * t
const meshes = []
let curveIndex = 0
function addTube(points, radiusAt, radialSegments, part) {
  const { positions, normals, indices } = buildTaperedTube(points, { radiusAt, radialSegments })
  meshes.push({ name: `${part}-${curveIndex++}`, part, positions, normals, indices })
}

for (const side of [1, -1]) {
  const flip = points => (side === 1 ? points : mirror(points))
  addTube(flip(trunk), taper(0.17, 0.1), 12, 'roots')
  addTube(flip(trunkStrand), taper(0.1, 0.06), 10, 'roots')
  addTube(flip(cradleArm), taper(0.095, 0.026), 10, 'roots')
  for (const tendril of tendrils) {
    addTube(flip(tendril.points), taper(0.028, 0.007), 7, 'leaves')
    const tip = flip(tendril.points)[tendril.points.length - 1]
    const prev = flip(tendril.points)[tendril.points.length - 2]
    const along = new THREE.Vector3(tip[0] - prev[0], tip[1] - prev[1], tip[2] - prev[2]).normalize()
    const at = new THREE.Vector3(...tip).addScaledVector(along, 0.02)
    const { positions, normals, indices } = buildLeaf(at, along, 0.12 + hash(`leaf:${side}:${tip.join(',')}`) * 0.035, jitter(`leaf-twist:${side}:${tip.join(',')}`, 1.1))
    meshes.push({ name: `leaf-${curveIndex++}`, part: 'leaves', positions, normals, indices })
  }
  floorRoots.forEach((points, index) => {
    addTube(flip(points), taper(0.095 - index * 0.006, 0.012), 9, 'roots')
    // A couple of small leaves along the outer floor roots for the "leaf sprouts along the base" detail.
    if (index >= 4) {
      const tip = flip(points)[points.length - 1], prev = flip(points)[points.length - 2]
      const along = new THREE.Vector3(tip[0] - prev[0], tip[1] - prev[1], tip[2] - prev[2]).normalize()
      const at = new THREE.Vector3(...tip)
      const { positions, normals, indices } = buildLeaf(at, along, 0.08 + hash(`floor-leaf:${side}:${index}`) * 0.025, jitter(`floor-leaf-twist:${side}:${index}`, 1.3))
      meshes.push({ name: `leaf-${curveIndex++}`, part: 'leaves', positions, normals, indices })
    }
  })
}

// ── Dais: a flat stone disc with a raised ring trim, sized to the floor roots' reach ─────────────────────────────────────────────────
// The disc's radius stops exactly at the ring's inner edge (not overlapping it) so the two never share a coplanar face - that overlap was
// z-fighting (a speckled, flickering triangulated look) in the first pass.
const RING_INNER = 1.68
const RING_OUTER = 1.85
const DAIS_RADIUS = RING_INNER
const DAIS_HEIGHT = 0.07
const RING_HEIGHT = 0.1

function circleShape(radius, segments = 96) {
  const shape = new THREE.Shape()
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2
    const x = Math.cos(a) * radius, y = Math.sin(a) * radius
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y)
  }
  return shape
}

function extrudeFlat(shape, depth) {
  let geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1, steps: 1 })
  geometry.rotateX(-Math.PI / 2) // the shape is authored in XY (a floor plan); stand it up so the disc lies flat on Y
  geometry.translate(0, -depth, 0)
  geometry = mergeVertices(geometry, 1e-6)
  geometry.computeVertexNormals()
  return geometry
}

const daisDisc = extrudeFlat(circleShape(DAIS_RADIUS), DAIS_HEIGHT)
daisDisc.translate(0, FLOOR_Y, 0)
meshes.push({ name: 'dais', part: 'dais', positions: new Float32Array(daisDisc.getAttribute('position').array), normals: new Float32Array(daisDisc.getAttribute('normal').array), indices: Uint32Array.from(daisDisc.getIndex().array) })

const ringOuterShape = circleShape(RING_OUTER)
ringOuterShape.holes.push(new THREE.Path(circleShape(RING_INNER).getPoints()))
const daisRing = extrudeFlat(ringOuterShape, RING_HEIGHT)
daisRing.translate(0, FLOOR_Y, 0)
meshes.push({ name: 'dais-ring', part: 'daisRing', positions: new Float32Array(daisRing.getAttribute('position').array), normals: new Float32Array(daisRing.getAttribute('normal').array), indices: Uint32Array.from(daisRing.getIndex().array) })

// ── PBR materials, one per part (Linear-sRGB). `roots` is the main polished gold; `leaves` a touch lighter and faintly self-lit; `dais` a
// dark, non-metal stone; `daisRing` a soft bronze inlay, deliberately quieter than the branch gold so it reads as architecture, not a plant. ──
const MATERIALS = {
  roots: { baseColorFactor: [0.72, 0.48, 0.16, 1], metallicFactor: 1, roughnessFactor: 0.22 },
  leaves: { baseColorFactor: [0.92, 0.72, 0.32, 1], metallicFactor: 0.85, roughnessFactor: 0.16, emissiveFactor: [0.14, 0.08, 0.01] },
  dais: { baseColorFactor: [0.045, 0.043, 0.05, 1], metallicFactor: 0, roughnessFactor: 0.55 },
  daisRing: { baseColorFactor: [0.32, 0.24, 0.15, 1], metallicFactor: 0.35, roughnessFactor: 0.4 },
}

// ── Binary glTF (same hand-written writer as generate-dvydrm-logo.mjs) ───────────────────────────────────────────────────────────────
const binaryChunks = []
let byteLength = 0
const bufferViews = []
const accessors = []
const gltfMeshes = []
const nodes = []
const materialList = []
const materialIndexOf = new Map()

function pushView(typedArray, target) {
  const bytes = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength)
  const padded = Buffer.concat([bytes, Buffer.alloc((4 - (bytes.length % 4)) % 4)])
  bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.length, target })
  binaryChunks.push(padded)
  byteLength += padded.length
  return bufferViews.length - 1
}

let triangles = 0
for (const mesh of meshes) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < mesh.positions.length / 3; i += 1) for (let k = 0; k < 3; k += 1) {
    const value = mesh.positions[i * 3 + k]
    min[k] = Math.min(min[k], value); max[k] = Math.max(max[k], value)
  }
  accessors.push({ bufferView: pushView(mesh.positions, 34962), componentType: 5126, count: mesh.positions.length / 3, type: 'VEC3', min, max })
  const positionAccessor = accessors.length - 1
  accessors.push({ bufferView: pushView(mesh.normals, 34962), componentType: 5126, count: mesh.normals.length / 3, type: 'VEC3' })
  const normalAccessor = accessors.length - 1
  accessors.push({ bufferView: pushView(mesh.indices, 34963), componentType: 5125, count: mesh.indices.length, type: 'SCALAR' })
  const indexAccessor = accessors.length - 1
  if (!materialIndexOf.has(mesh.part)) {
    materialIndexOf.set(mesh.part, materialList.length)
    materialList.push({ name: mesh.part, pbrMetallicRoughness: { baseColorFactor: MATERIALS[mesh.part].baseColorFactor, metallicFactor: MATERIALS[mesh.part].metallicFactor, roughnessFactor: MATERIALS[mesh.part].roughnessFactor }, ...(MATERIALS[mesh.part].emissiveFactor ? { emissiveFactor: MATERIALS[mesh.part].emissiveFactor } : {}) })
  }
  gltfMeshes.push({ name: mesh.name, primitives: [{ attributes: { POSITION: positionAccessor, NORMAL: normalAccessor }, indices: indexAccessor, material: materialIndexOf.get(mesh.part), mode: 4 }] })
  nodes.push({ name: mesh.name, mesh: gltfMeshes.length - 1 })
  triangles += mesh.indices.length / 3
}

const json = {
  asset: { version: '2.0', generator: 'DRMVYZ scripts/cinema2-assets/generate-golden-roots.mjs' },
  scene: 0,
  scenes: [{ name: 'golden-roots', nodes: nodes.map((_, i) => i) }],
  nodes, meshes: gltfMeshes, materials: materialList, accessors, bufferViews,
  buffers: [{ byteLength }],
}
const jsonBytes = Buffer.from(JSON.stringify(json))
const jsonChunk = Buffer.concat([jsonBytes, Buffer.alloc((4 - (jsonBytes.length % 4)) % 4, 0x20)])
const binaryChunk = Buffer.concat(binaryChunks)
const header = Buffer.alloc(12)
header.writeUInt32LE(0x46546c67, 0)
header.writeUInt32LE(2, 4)
header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binaryChunk.length, 8)
const chunkHeader = (length, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(length, 0); b.writeUInt32LE(type, 4); return b }
writeFileSync(outputPath, Buffer.concat([header, chunkHeader(jsonChunk.length, 0x4e4f534a), jsonChunk, chunkHeader(binaryChunk.length, 0x004e4942), binaryChunk]))

console.log(`Wrote ${outputPath}`)
console.log(`  ${meshes.length} meshes (${[...materialIndexOf.keys()].join(', ')}), ${triangles} triangles, ${(byteLength / 1024).toFixed(0)} KB`)
console.log(`  dais radius ${DAIS_RADIUS}, floor Y ${FLOOR_Y}, seed "${SEED}"`)
