// Generates the shared "golden roots" asset for Cinema 2.0's RELIQUARY preset.
//   node scripts/cinema2-assets/generate-golden-roots.mjs [out.glb]      (default: public/cinema2/models/golden-roots.glb)
//
// Revision 2, built against the owner's "final production" mood reference (a dense, tree-scale golden root/branch structure with a
// gnarled bark surface, glowing veins running through it, and canopy branches framing the whole scene, not just a small cradle under the
// logo). A hand-authored curve network (the identity-defining shape), not a generative L-system: one trunk that splits into two mirrored
// cradle arms which dip behind the logo, emerge in front, and curl up to hold its lower lobes from below; from each cradle arm, two
// canopy branches fork off and climb far above and to the side of the logo, framing it the way the reference's flanking trees do; tendrils
// fork off both the cradle arms and the canopy branches and end in small leaves; floor roots fan out from the trunk's base. No dais this
// revision (the reference shows open ground, not a platform) - the previous revision's stone disc and ring are gone.
//
// Every curve is swept into a tapered tube (a rotation-minimizing frame down a Catmull-Rom spline, radius shrinking along its length,
// same technique as revision 1) with a bark perturbation added to the branch/root tubes (not the leaves or veins): each ring vertex's
// radius is nudged by a sum of a few sine waves in the tube's local (length, angle) space, seeded per curve, so the surface reads as
// gnarled bark instead of a smooth pipe. A second, thinner tube per major branch - offset out to just under its surface and slowly
// spiralling along it - stands in for the reference's glowing crack pattern: a bright, strongly emissive "vein" material, cheaper than a
// real crack-mask texture (which would need UV coordinates and embedded images the hand-written GLB writer below does not support) and
// built entirely from the tube-sweep machinery already here.
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

/** A small flat almond/teardrop leaf, extruded thin, placed and oriented at `at` with its length along `along`. */
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
const trunk = [[0, FLOOR_Y, 0], [0.06, FLOOR_Y + 0.25, 0.02], [-0.04, FLOOR_Y + 0.52, -0.025], [0.05, FLOOR_Y + 0.78, 0.015]]
const trunkTop = trunk[trunk.length - 1]
const trunkStrand = [[0.055, FLOOR_Y, 0.035], [-0.065, FLOOR_Y + 0.22, -0.045], [0.075, FLOOR_Y + 0.46, 0.035], [-0.035, FLOOR_Y + 0.68, -0.02], trunkTop]

// Cradle arm: dips behind the logo, emerges in front, curls to a contact tip under the lower lobes (unchanged in spirit from revision 1).
const cradleArm = [trunkTop, [0.36, FLOOR_Y + 0.95, -0.15], [0.65, FLOOR_Y + 1.18, -0.22], [0.82, FLOOR_Y + 1.4, 0.17], [0.62, FLOOR_Y + 1.58, 0.21], [0.4, FLOOR_Y + 1.67, 0.11]]

// Canopy branches (new): fork off the cradle arm and climb far above and out to the side of the logo, framing it the way the reference's
// flanking trees do, instead of the whole structure staying contained under the cradle.
const canopyBranchA = [[0.65, FLOOR_Y + 1.18, -0.22], [1.15, FLOOR_Y + 1.6, -0.4], [1.85, FLOOR_Y + 2.15, -0.3], [2.45, FLOOR_Y + 2.75, 0.05], [2.85, FLOOR_Y + 3.25, 0.35]]
const canopyBranchB = [[0.82, FLOOR_Y + 1.4, 0.17], [1.32, FLOOR_Y + 1.75, 0.48], [1.78, FLOOR_Y + 2.2, 0.82], [2.05, FLOOR_Y + 2.7, 1.05], [2.2, FLOOR_Y + 3.1, 1.15]]
// Secondary forks off the canopy branches, partway along, for the mass and re-branching density a real tree canopy has (rather than two
// bare arcs): each keeps real girth most of the way out instead of whipping down to a thin line immediately.
const canopyForkA = [[1.15, FLOOR_Y + 1.6, -0.4], [1.55, FLOOR_Y + 1.75, -0.75], [2.0, FLOOR_Y + 2.05, -0.95], [2.3, FLOOR_Y + 2.4, -1.0]]
const canopyForkB = [[1.85, FLOOR_Y + 2.15, -0.3], [2.25, FLOOR_Y + 2.55, -0.15], [2.65, FLOOR_Y + 2.95, -0.35], [2.95, FLOOR_Y + 3.3, -0.45]]
const canopyForkC = [[1.32, FLOOR_Y + 1.75, 0.48], [1.6, FLOOR_Y + 1.95, 0.85], [1.85, FLOOR_Y + 2.3, 1.25], [1.95, FLOOR_Y + 2.65, 1.55]]
const canopyForkD = [[1.78, FLOOR_Y + 2.2, 0.82], [2.15, FLOOR_Y + 2.5, 1.05], [2.5, FLOOR_Y + 2.75, 0.85], [2.85, FLOOR_Y + 2.95, 0.65]]

// Tendrils fork off the cradle arm and both canopy branches, climbing further and ending in a leaf.
const tendrils = [
  { points: [[0.65, FLOOR_Y + 1.18, -0.06], [0.92, FLOOR_Y + 1.42, 0.0], [0.98, FLOOR_Y + 1.66, 0.05], [0.86, FLOOR_Y + 1.87, 0.03]] },
  { points: [[0.82, FLOOR_Y + 1.4, 0.2], [0.97, FLOOR_Y + 1.62, 0.1], [0.9, FLOOR_Y + 1.82, -0.03], [0.7, FLOOR_Y + 1.97, 0.0]] },
  { points: [[0.62, FLOOR_Y + 1.58, 0.24], [0.55, FLOOR_Y + 1.8, 0.2], [0.42, FLOOR_Y + 1.98, 0.13], [0.3, FLOOR_Y + 2.08, 0.06]] },
  { points: [[1.85, FLOOR_Y + 2.15, -0.3], [2.15, FLOOR_Y + 2.5, -0.55], [2.35, FLOOR_Y + 2.85, -0.5], [2.35, FLOOR_Y + 3.15, -0.3]] },
  { points: [[2.45, FLOOR_Y + 2.75, 0.05], [2.85, FLOOR_Y + 3.0, 0.15], [3.15, FLOOR_Y + 3.3, 0.35], [3.25, FLOOR_Y + 3.55, 0.55]] },
  { points: [[1.78, FLOOR_Y + 2.2, 0.82], [2.05, FLOOR_Y + 2.55, 1.15], [2.15, FLOOR_Y + 2.9, 1.3], [2.05, FLOOR_Y + 3.15, 1.45]] },
  { points: [[2.05, FLOOR_Y + 2.7, 1.05], [2.35, FLOOR_Y + 2.95, 1.35], [2.55, FLOOR_Y + 3.25, 1.5], [2.6, FLOOR_Y + 3.5, 1.6]] },
]
const forkTendrils = [
  { points: [[2.0, FLOOR_Y + 2.05, -0.95], [2.28, FLOOR_Y + 2.3, -1.2], [2.4, FLOOR_Y + 2.6, -1.35], [2.35, FLOOR_Y + 2.85, -1.4]] },
  { points: [[2.65, FLOOR_Y + 2.95, -0.35], [2.95, FLOOR_Y + 3.15, -0.5], [3.15, FLOOR_Y + 3.4, -0.55], [3.2, FLOOR_Y + 3.6, -0.5]] },
  { points: [[1.85, FLOOR_Y + 2.3, 1.25], [2.05, FLOOR_Y + 2.6, 1.5], [2.05, FLOOR_Y + 2.9, 1.7], [1.9, FLOOR_Y + 3.1, 1.8]] },
  { points: [[2.5, FLOOR_Y + 2.75, 0.85], [2.85, FLOOR_Y + 2.9, 0.95], [3.15, FLOOR_Y + 3.1, 1.05], [3.3, FLOOR_Y + 3.3, 1.1]] },
]

// Eight floor roots per side: forward, outward, backward and lateral fans, plus two shorter "buttress" roots that swell near the trunk
// before diving down, for mass close to the base (the reference's roots are thick right where they meet the ground).
const floorRoots = [
  [[0.03, FLOOR_Y + 0.06, 0], [0.3, FLOOR_Y + 0.11, 0.2], [0.62, FLOOR_Y + 0.05, 0.42], [0.92, FLOOR_Y, 0.5]],
  [[0.04, FLOOR_Y + 0.07, 0], [0.38, FLOOR_Y + 0.1, 0.32], [0.8, FLOOR_Y + 0.04, 0.28], [1.25, FLOOR_Y, 0.18]],
  [[0.05, FLOOR_Y + 0.07, 0], [0.46, FLOOR_Y + 0.09, 0.06], [0.96, FLOOR_Y + 0.03, 0.02], [1.42, FLOOR_Y, -0.02]],
  [[0.05, FLOOR_Y + 0.06, 0], [0.42, FLOOR_Y + 0.08, -0.22], [0.88, FLOOR_Y + 0.03, -0.3], [1.3, FLOOR_Y, -0.24]],
  [[0.06, FLOOR_Y + 0.06, 0], [0.4, FLOOR_Y + 0.08, -0.34], [0.85, FLOOR_Y + 0.02, -0.5], [1.2, FLOOR_Y, -0.6]],
  [[0.04, FLOOR_Y + 0.05, 0], [0.52, FLOOR_Y + 0.07, -0.08], [1.12, FLOOR_Y + 0.02, -0.14], [1.62, FLOOR_Y, -0.18]],
  [[0.05, FLOOR_Y + 0.1, 0], [0.22, FLOOR_Y + 0.16, 0.12], [0.4, FLOOR_Y + 0.06, 0.16], [0.55, FLOOR_Y - 0.08, 0.1]],
  [[0.05, FLOOR_Y + 0.1, 0], [0.2, FLOOR_Y + 0.17, -0.14], [0.36, FLOOR_Y + 0.07, -0.2], [0.5, FLOOR_Y - 0.1, -0.16]],
]

const mirror = points => points.map(([x, y, z]) => [-x, y, z])
const taper = (start, end) => t => start + (end - start) * t
const meshes = []
let curveIndex = 0
function addTube(points, radiusAt, radialSegments, part, bark = null) {
  const { positions, normals, indices } = buildTaperedTube(points, { radiusAt, radialSegments, bark })
  meshes.push({ name: `${part}-${curveIndex++}`, part, positions, normals, indices })
}
/** A vein's own thickness is a thin fraction of the HOST branch's local radius (it must never sweep at the host's own full radius - that
 * buries most of its volume inside the branch instead of reading as a thin line on the surface), with a floor so it stays visible near
 * a branch's tapered tip. `offsetFactor` (close to 1) places its centreline just proud of the branch's nominal surface. */
function addVein(points, hostRadiusAt, part, baseAngle, driftTurns, offsetFactor = 1.04) {
  const veinRadiusAt = t => Math.max(0.012, hostRadiusAt(t) * 0.16)
  addTube(veinControlPoints(points, hostRadiusAt, baseAngle, driftTurns, offsetFactor), veinRadiusAt, 6, part)
}

for (const side of [1, -1]) {
  const flip = points => (side === 1 ? points : mirror(points))
  const barkSeed = key => hash(`bark:${side}:${key}`)

  const trunkR = taper(0.19, 0.11)
  const strandR = taper(0.11, 0.065)
  const armR = taper(0.1, 0.028)
  const canopyAR = taper(0.14, 0.045)
  const canopyBR = taper(0.13, 0.042)
  const forkR = taper(0.08, 0.026)

  addTube(flip(trunk), trunkR, 12, 'roots', { amplitude: 0.15, seed: barkSeed('trunk') })
  addTube(flip(trunkStrand), strandR, 10, 'roots', { amplitude: 0.15, seed: barkSeed('strand') })
  addTube(flip(cradleArm), armR, 10, 'roots', { amplitude: 0.14, seed: barkSeed('arm') })
  addTube(flip(canopyBranchA), canopyAR, 11, 'roots', { amplitude: 0.14, seed: barkSeed('canopyA') })
  addTube(flip(canopyBranchB), canopyBR, 11, 'roots', { amplitude: 0.14, seed: barkSeed('canopyB') })
  addTube(flip(canopyForkA), forkR, 9, 'roots', { amplitude: 0.15, seed: barkSeed('forkA') })
  addTube(flip(canopyForkB), forkR, 9, 'roots', { amplitude: 0.15, seed: barkSeed('forkB') })
  addTube(flip(canopyForkC), forkR, 9, 'roots', { amplitude: 0.15, seed: barkSeed('forkC') })
  addTube(flip(canopyForkD), forkR, 9, 'roots', { amplitude: 0.15, seed: barkSeed('forkD') })

  // Glowing veins: two per major branch, offset just under the surface and slowly spiralling.
  addVein(flip(trunk), trunkR, 'veins', jitter(`vein-a:${side}:trunk`, Math.PI), 0.6)
  addVein(flip(trunk), trunkR, 'veins', jitter(`vein-b:${side}:trunk`, Math.PI) + Math.PI, -0.5)
  addVein(flip(cradleArm), armR, 'veins', jitter(`vein-a:${side}:arm`, Math.PI), 0.7)
  addVein(flip(cradleArm), armR, 'veins', jitter(`vein-b:${side}:arm`, Math.PI) + Math.PI, -0.6)
  addVein(flip(canopyBranchA), canopyAR, 'veins', jitter(`vein-a:${side}:canopyA`, Math.PI), 0.8)
  addVein(flip(canopyBranchB), canopyBR, 'veins', jitter(`vein-a:${side}:canopyB`, Math.PI), -0.8)
  addVein(flip(canopyForkA), forkR, 'veins', jitter(`vein-a:${side}:forkA`, Math.PI), 0.6)
  addVein(flip(canopyForkC), forkR, 'veins', jitter(`vein-a:${side}:forkC`, Math.PI), -0.6)

  for (const tendril of [...tendrils, ...forkTendrils]) {
    const points = flip(tendril.points)
    addTube(points, taper(0.026, 0.006), 7, 'leaves')
    const tip = points[points.length - 1], prev = points[points.length - 2]
    const along = new THREE.Vector3(tip[0] - prev[0], tip[1] - prev[1], tip[2] - prev[2]).normalize()
    const at = new THREE.Vector3(...tip).addScaledVector(along, 0.02)
    const leaf = buildLeaf(at, along, 0.12 + hash(`leaf:${side}:${tip.join(',')}`) * 0.045, jitter(`leaf-twist:${side}:${tip.join(',')}`, 1.1))
    meshes.push({ name: `leaf-${curveIndex++}`, part: 'leaves', positions: leaf.positions, normals: leaf.normals, indices: leaf.indices })
  }

  floorRoots.forEach((points, index) => {
    const flipped = flip(points)
    const radiusAt = taper(0.105 - index * 0.006, 0.014)
    addTube(flipped, radiusAt, 9, 'roots', { amplitude: 0.14, seed: barkSeed(`floor-${index}`) })
    if (index >= 2 && index <= 5) {
      const tip = flipped[points.length - 1], prev = flipped[points.length - 2]
      const along = new THREE.Vector3(tip[0] - prev[0], tip[1] - prev[1], tip[2] - prev[2]).normalize()
      const leaf = buildLeaf(new THREE.Vector3(...tip), along, 0.08 + hash(`floor-leaf:${side}:${index}`) * 0.025, jitter(`floor-leaf-twist:${side}:${index}`, 1.3))
      meshes.push({ name: `leaf-${curveIndex++}`, part: 'leaves', positions: leaf.positions, normals: leaf.normals, indices: leaf.indices })
    }
  })
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
console.log(`  floor Y ${FLOOR_Y}, canopy reaches ~y ${(FLOOR_Y + 3.5).toFixed(2)}, ~x 3.3`)
