// Generates the shared "golden roots" asset for Cinema 2.0's RELIQUARY preset.
//   node scripts/cinema2-assets/generate-golden-roots.mjs [out.glb]      (default: public/cinema2/models/golden-roots.glb)
//
// Revision 3, built against the owner's reference render of the logo held by a tree: a thick trunk of several strands twisting around each
// other rises from a wide flare of roots spreading over the ground in every direction; just under the logo's star the trunk splits into two
// limbs that pass in front of the logo's lower rim, wrap round the outside of its two lower outer lobes and curl over their tops; thin vines
// loop round the lobes too, and gold teardrop leaves hang off short curling stems along the limbs, the vines and the base. Nothing reaches
// past the logo's sides or above its lower lobes (revision 2's canopy branches, which climbed far out to the sides like wings, are gone).
// A hand-authored curve network (the identity-defining shape), not a generative L-system.
//
// Every curve is swept into a tapered tube (a rotation-minimizing frame down a Catmull-Rom spline, radius shrinking along its length) with
// a bark perturbation on the wood (not the leaf stems or veins): each ring vertex's radius is nudged by a sum of a few sine waves in the
// tube's local (length, angle) space, seeded per curve. A thin, strongly emissive "vein" strand rides just proud of the trunk strands and the
// limbs, a cheap stand-in for a glowing crack texture (the hand-written GLB writer below has no UVs or embedded images).
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputPath = process.argv[2] ? resolve(process.argv[2]) : join(root, 'public/cinema2/models/golden-roots.glb')

// Logo landmarks (measured from dvydrm-logo.glb / the master SVG): half-width 1.0, outline bottom -0.628, top +0.628, star tip -0.58.
const FLOOR_Y = -1.55

function hash(value) {
  let h = 2166136261
  for (let index = 0; index < value.length; index += 1) { h ^= value.charCodeAt(index); h = Math.imul(h, 16777619) }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13
  return ((h >>> 0) % 1_000_003) / 1_000_003
}
const jitter = (key, spread) => (hash(key) - 0.5) * 2 * spread

// ── Shared curve-frame math ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Samples a Catmull-Rom spline through `controlPoints` and returns, at each sample, the point and a rotation-minimizing frame
 * (sequential parallel transport: each frame is the previous one rotated by the angle between consecutive tangents, about their cross
 * product - Rodrigues rotation). Three's Frenet frames flip when a space curve's curvature passes through zero, which these gently
 * twisting, near-straight branch curves do constantly; this does not.
 */
function frameSamples(controlPoints, samples) {
  const curve = new THREE.CatmullRomCurve3(controlPoints.map(p => new THREE.Vector3(...p)), false, 'centripetal')
  const centres = curve.getSpacedPoints(samples)
  const tangents = centres.map((_, i) => {
    const a = centres[Math.max(0, i - 1)], b = centres[Math.min(centres.length - 1, i + 1)]
    return new THREE.Vector3().subVectors(b, a).normalize()
  })
  const seedUp = Math.abs(tangents[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  const normals = [new THREE.Vector3().crossVectors(tangents[0], seedUp).normalize()]
  for (let i = 1; i < tangents.length; i += 1) {
    const axis = new THREE.Vector3().crossVectors(tangents[i - 1], tangents[i])
    const prev = normals[i - 1]
    if (axis.lengthSq() < 1e-10) { normals.push(prev.clone()); continue }
    const angle = Math.acos(Math.min(1, Math.max(-1, tangents[i - 1].dot(tangents[i]))))
    normals.push(prev.clone().applyAxisAngle(axis.normalize(), angle))
  }
  const binormals = centres.map((_, i) => new THREE.Vector3().crossVectors(tangents[i], normals[i]).normalize())
  return { centres, tangents, normals, binormals }
}

/** A few sine waves in (length, angle) space, seeded per curve: reads as a gnarled, ridged bark surface rather than a smooth pipe. */
function barkOffset(t, angleTurns, seed) {
  const a = Math.sin((angleTurns * 3 + seed * 7.1) * Math.PI * 2 + t * 11)
  const b = Math.sin((angleTurns * 5.3 - seed * 3.7) * Math.PI * 2 - t * 7.4)
  const c = Math.sin((angleTurns * 8.7 + seed * 2.3) * Math.PI * 2 + t * 19)
  return a * 0.5 + b * 0.32 + c * 0.18
}

/** Sweeps a circular (optionally bark-perturbed) cross-section of varying radius down the curve. */
function buildTaperedTube(controlPoints, { samples = 48, radiusAt, radialSegments = 8, capStart = true, capEnd = true, bark = null }) {
  const { centres, tangents, normals, binormals } = frameSamples(controlPoints, samples)
  const positions = [], vertexNormals = [], indices = []
  for (let i = 0; i < centres.length; i += 1) {
    const t = i / (centres.length - 1)
    const radius = radiusAt(t)
    for (let j = 0; j < radialSegments; j += 1) {
      const theta = (j / radialSegments) * Math.PI * 2
      const dir = new THREE.Vector3().addScaledVector(normals[i], Math.cos(theta)).addScaledVector(binormals[i], Math.sin(theta)).normalize()
      const local = bark ? radius * (1 + bark.amplitude * barkOffset(t, j / radialSegments, bark.seed)) : radius
      const point = new THREE.Vector3().copy(centres[i]).addScaledVector(dir, local)
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

/** Control points for a thin curve that hugs just under a branch's surface, slowly spiralling along it - the "vein" stand-in for a crack texture. */
function veinControlPoints(controlPoints, radiusAt, baseAngle, driftTurns, offsetFactor, samples = 10) {
  const { centres, normals, binormals } = frameSamples(controlPoints, samples)
  return centres.map((c, i) => {
    const t = i / (samples - 1)
    const theta = baseAngle + driftTurns * Math.PI * 2 * t
    const r = radiusAt(t) * offsetFactor
    const dir = new THREE.Vector3().addScaledVector(normals[i], Math.cos(theta)).addScaledVector(binormals[i], Math.sin(theta))
    return [c.x + dir.x * r, c.y + dir.y * r, c.z + dir.z * r]
  })
}

/**
 * A plump teardrop leaf (rounded at the stem end, pointed at the tip), extruded thin and softly bevelled, with its stem end at `at`, its
 * length along `along`, and its face turned as far toward the camera (+Z) as that allows, so it reads as a leaf, not an edge-on sliver.
 */
function buildLeaf(at, along, size, twist) {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(size * 0.05, size * 0.32, size * 0.55, size * 0.36, size, 0)
  shape.bezierCurveTo(size * 0.55, -size * 0.36, size * 0.05, -size * 0.32, 0, 0)
  let geometry = new THREE.ExtrudeGeometry(shape, { depth: size * 0.04, bevelEnabled: true, bevelThickness: size * 0.04, bevelSize: size * 0.03, bevelSegments: 2, curveSegments: 10 })
  geometry.translate(0, 0, -size * 0.02)
  geometry.rotateX(twist) // a little roll about the leaf's own length, so the leaves do not all face the camera identically
  const x = along.clone().normalize()
  const toCamera = new THREE.Vector3(0, 0, 1)
  let z = toCamera.clone().addScaledVector(x, -toCamera.dot(x))
  if (z.lengthSq() < 1e-6) z = new THREE.Vector3(0, 1, 0).addScaledVector(x, -x.y)
  z.normalize()
  const y = new THREE.Vector3().crossVectors(z, x)
  geometry.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z))
  geometry.translate(at.x, at.y, at.z)
  geometry = mergeVertices(geometry, 1e-6)
  geometry.computeVertexNormals()
  return { positions: new Float32Array(geometry.getAttribute('position').array), normals: new Float32Array(geometry.getAttribute('normal').array), indices: Uint32Array.from(geometry.getIndex().array) }
}

// ── The curve network ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Logo landmarks in world units (the logo is placed 0.05 above the origin): its bottom edge runs at y ~-0.57 from x 0.1 to 0.8, the lower
// outer lobes reach x ~1.0 between y -0.35 and -0.01 and top out at y ~0.16 around x 0.9, and the logo is ~0.07 deep about z = 0.
const TRUNK_TOP_Y = -0.8

/** Four strands twisting round the trunk's axis from the floor to just under the star; each leans out toward its limb at the top. */
function trunkStrand(index) {
  const points = []
  const turns = 0.85
  for (let k = 0; k <= 8; k += 1) {
    const t = k / 8
    const angle = (index / 4) * Math.PI * 2 + turns * Math.PI * 2 * t
    const spread = 0.11 - 0.035 * Math.sin(Math.PI * Math.min(1, t * 1.25)) // pinched a little in the middle, wide at the base
    points.push([Math.cos(angle) * spread, FLOOR_Y + 0.02 + (TRUNK_TOP_Y - FLOOR_Y - 0.02) * t, Math.sin(angle) * spread * 0.9])
  }
  return points
}

// Main limb (right side; mirrored for the left): from the trunk top, in front of the logo's lower rim, round the outside of the lower outer
// lobe (behind the logo), then over the lobe's top to curl forward.
const limb = [[0.06, TRUNK_TOP_Y - 0.06, 0.02], [0.24, -0.74, 0.1], [0.46, -0.66, 0.14], [0.7, -0.63, 0.14], [0.93, -0.53, 0.11], [1.08, -0.3, 0.0], [1.09, -0.06, -0.08], [1.0, 0.17, -0.06], [0.86, 0.23, 0.05], [0.8, 0.15, 0.1]]
// A thin vine that leaves the limb under the lobe and loops higher round its outside, a second, finer wrap.
const vine = [[0.86, -0.57, 0.12], [1.02, -0.47, 0.13], [1.16, -0.22, 0.06], [1.17, 0.04, -0.03], [1.08, 0.25, -0.06], [0.93, 0.33, 0.0], [0.86, 0.27, 0.07]]
// A short inner branch that curls up in front of the lower inner lobe, toward the swirl, holding a few leaves.
const innerBranch = [[0.3, -0.72, 0.12], [0.36, -0.6, 0.16], [0.34, -0.5, 0.17], [0.26, -0.45, 0.15]]

/** Where leaves hang, as (curve, t along it, side bias): stems leave the host there, curl outward, and end in a leaf. */
const leafSites = [
  ['limb', 0.3, 1], ['limb', 0.45, -1], ['limb', 0.58, 1], ['limb', 0.72, -1], ['limb', 0.86, 1],
  ['vine', 0.35, 1], ['vine', 0.62, -1], ['vine', 0.92, 1],
  ['innerBranch', 0.7, -1], ['innerBranch', 1, 1],
]

const mirror = points => points.map(([x, y, z]) => [-x, y, z])
const taper = (start, end) => t => start + (end - start) * t
const meshes = []
let curveIndex = 0
function addTube(points, radiusAt, radialSegments, part, bark = null) {
  const { positions, normals, indices } = buildTaperedTube(points, { radiusAt, radialSegments, bark })
  meshes.push({ name: `${part}-${curveIndex++}`, part, positions, normals, indices })
}
/** A vein's own thickness is a thin fraction of the HOST branch's local radius (sweeping it at the host's full radius buries it inside the
 * branch), with a floor so it stays visible near a tapered tip. `offsetFactor` (close to 1) places it just proud of the branch surface. */
function addVein(points, hostRadiusAt, part, baseAngle, driftTurns, offsetFactor = 1.04) {
  const veinRadiusAt = t => Math.max(0.008, hostRadiusAt(t) * 0.14)
  addTube(veinControlPoints(points, hostRadiusAt, baseAngle, driftTurns, offsetFactor), veinRadiusAt, 6, part)
}
/** A curling stem from `start` heading along `out`, bending over as it goes, with a teardrop leaf at its tip. */
function addLeaf(start, out, key) {
  const up = new THREE.Vector3(0, 1, 0)
  const length = 0.09 + hash(`stem:${key}`) * 0.05
  const droop = new THREE.Vector3().copy(out).multiplyScalar(0.55).addScaledVector(up, -0.45).normalize()
  const curl = new THREE.Vector3().crossVectors(out, up).normalize().multiplyScalar(jitter(`curl:${key}`, 0.35))
  const p0 = new THREE.Vector3(...start)
  const p1 = p0.clone().addScaledVector(out, length * 0.45).addScaledVector(up, length * 0.2)
  const p2 = p1.clone().addScaledVector(out, length * 0.35).add(curl.clone().multiplyScalar(length))
  const p3 = p2.clone().addScaledVector(droop, length * 0.35)
  const stem = [p0, p1, p2, p3].map(v => [v.x, v.y, v.z])
  addTube(stem, taper(0.012, 0.005), 6, 'leaves')
  const along = new THREE.Vector3().subVectors(p3, p2).normalize()
  const leaf = buildLeaf(p3, along, 0.12 + hash(`leaf:${key}`) * 0.04, jitter(`leaf-twist:${key}`, 0.5))
  meshes.push({ name: `leaf-${curveIndex++}`, part: 'leaves', positions: leaf.positions, normals: leaf.normals, indices: leaf.indices })
}
/** A point on a Catmull-Rom curve and a sideways direction there, for hanging leaves and forking rootlets. */
function curvePoint(points, t, sideBias, key) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal')
  const at = curve.getPointAt(t), tangent = curve.getTangentAt(Math.min(0.999, t))
  const toCamera = new THREE.Vector3(0, 0, 1)
  const side = new THREE.Vector3().crossVectors(tangent, toCamera).normalize().multiplyScalar(sideBias)
  const out = side.addScaledVector(toCamera, 0.6 + jitter(`out-z:${key}`, 0.3)).normalize()
  return { at, out, tangent }
}

// The trunk: four twisting strands (not mirrored: a mirrored helix would untwist), each with a vein.
const trunkR = taper(0.11, 0.09)
for (let index = 0; index < 4; index += 1) {
  const strand = trunkStrand(index)
  addTube(strand, trunkR, 11, 'roots', { amplitude: 0.1, seed: hash(`bark:trunk:${index}`) })
  addVein(strand, trunkR, 'veins', jitter(`vein:trunk:${index}`, Math.PI), 0.4)
}

// The root flare: fourteen roots all the way round the base (toward the camera too, a little shorter there so they do not run down the
// frame), each rising from the trunk as a thick buttress, snaking out over the floor and staying thick most of the way, with two small
// rootlets forking off it.
const ROOT_COUNT = 14
for (let index = 0; index < ROOT_COUNT; index += 1) {
  const key = `root:${index}`
  const heading = (index / ROOT_COUNT) * Math.PI * 2 + jitter(`heading:${key}`, 0.16)
  const towardCamera = Math.max(0, Math.sin(heading))
  const reach = (0.85 + hash(`reach:${key}`) * 0.35) * (1 - 0.3 * towardCamera)
  const waves = 1.5 + hash(`waves:${key}`) * 1.2, phase = hash(`phase:${key}`) * Math.PI * 2, sway = 0.07 + hash(`sway:${key}`) * 0.05
  const points = []
  for (let k = 0; k <= 7; k += 1) {
    const u = k / 7
    const r = 0.06 + (reach - 0.06) * u
    // A buttress that rises from high on the trunk and settles onto the floor, snaking side to side as it goes.
    const y = 0.34 * Math.pow(1 - u, 2.2) + 0.015 * Math.sin(u * 9 + phase)
    const lateral = sway * Math.sin(u * Math.PI * waves + phase) * Math.min(1, u * 3)
    const dx = Math.cos(heading), dz = Math.sin(heading)
    points.push([dx * r - dz * lateral, FLOOR_Y + y, (dz * r + dx * lateral) * 0.85])
  }
  const radiusAt = t => (0.11 - hash(`girth:${key}`) * 0.025) * Math.pow(1 - t, 0.75) + 0.012
  addTube(points, radiusAt, 10, 'roots', { amplitude: 0.12, seed: hash(`bark:${key}`) })
  for (const [forkT, sign] of [[0.45, index % 2 === 0 ? 1 : -1], [0.72, index % 2 === 0 ? -1 : 1]]) {
    const fork = curvePoint(points, forkT, sign, `${key}:${forkT}`)
    const side = new THREE.Vector3().crossVectors(fork.tangent, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(sign)
    const rootlet = [0, 0.1, 0.2, 0.28].map(s => {
      const v = fork.at.clone().addScaledVector(fork.tangent, s * 0.7).addScaledVector(side, s * 0.8)
      return [v.x, Math.max(FLOOR_Y + 0.01, v.y - s * 0.08), v.z]
    })
    addTube(rootlet, taper(0.026, 0.007), 7, 'roots')
  }
  if (index % 3 === 0) addLeaf([points[1][0], points[1][1] + 0.04, points[1][2]], new THREE.Vector3(Math.cos(heading), 0.5, Math.sin(heading)).normalize(), `base-leaf:${index}`)
}

// The two limbs, their intertwined strands, vines, inner branches and leaves (right side, mirrored for the left).
for (const side of [1, -1]) {
  const flip = points => (side === 1 ? points : mirror(points))
  const limbR = taper(0.13, 0.026)
  const curves = { limb: flip(limb), vine: flip(vine), innerBranch: flip(innerBranch) }
  addTube(curves.limb, limbR, 11, 'roots', { amplitude: 0.1, seed: hash(`bark:limb:${side}`) })
  addVein(curves.limb, limbR, 'veins', jitter(`vein:limb:${side}`, Math.PI), 0.9)
  // A thinner strand twisting round the limb, so it reads as several strands like the trunk.
  const strand = veinControlPoints(curves.limb, limbR, jitter(`strand:${side}`, Math.PI), 1.6 * side, 0.95, 16)
  addTube(strand.slice(0, 13), taper(0.06, 0.018), 9, 'roots', { amplitude: 0.1, seed: hash(`bark:strand:${side}`) })
  addTube(curves.vine, taper(0.03, 0.011), 8, 'roots', { amplitude: 0.08, seed: hash(`bark:vine:${side}`) })
  addTube(curves.innerBranch, taper(0.04, 0.014), 8, 'roots', { amplitude: 0.08, seed: hash(`bark:inner:${side}`) })
  for (const [name, t, bias] of leafSites) {
    const key = `${name}:${t}:${side}`
    const { at, out } = curvePoint(curves[name], t, bias * side, key)
    addLeaf([at.x, at.y, at.z], out, key)
  }
}

// ── PBR materials, one per part (Linear-sRGB). `roots` is a darker, rougher bark gold (metal, but rough enough to read as weathered);
// `leaves` a lighter, faintly self-lit gold; `veins` a bright, strongly emissive gold-orange standing in for the glowing crack pattern -
// it needs no external light to read, the way a real ember-lit crack would not. ─────────────────────────────────────────────────────────
const MATERIALS = {
  roots: { baseColorFactor: [0.6, 0.39, 0.13, 1], metallicFactor: 1, roughnessFactor: 0.34 },
  leaves: { baseColorFactor: [0.92, 0.72, 0.32, 1], metallicFactor: 0.85, roughnessFactor: 0.16, emissiveFactor: [0.16, 0.09, 0.015] },
  veins: { baseColorFactor: [1, 0.38, 0.08, 1], metallicFactor: 0.1, roughnessFactor: 0.25, emissiveFactor: [2.4, 0.85, 0.08] },
}

// ── Binary glTF ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
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
console.log(`  floor Y ${FLOOR_Y}, trunk top y ${TRUNK_TOP_Y}`)
