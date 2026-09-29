// Generates the flanking trees for Cinema 2.0's RELIQUARY preset.
//   node scripts/cinema2-assets/generate-reliquary-trees.mjs [out.glb]      (default: public/cinema2/models/reliquary-trees.glb)
//
// The owner's reference frames the logo between huge, gnarled dark trees wrapped in glowing golden vines, with more trunks fading into the dark
// behind them. Three depth layers, all hand-placed and seeded (no L-system):
//   - two foreground trees at the frame edges: trunks of three thick strands twisting round each other, leaning in toward the logo in a slow S,
//     heavy buttress roots splaying over the ground, and two big branches arching up and inward over the scene;
//   - four mid trees further back and out, two strands each, thinner;
//   - four far trunks deep behind, single strands, which the haze fades.
// Every strand and root is wrapped in thin gold vines spiralling up it, with small gold buds along them. The bark is dark and glossy (it does
// not glow); the vines and buds are the parts three-scene's audio glow lights, and their `_GLOW_PHASE` runs 0 at the ground to 1 at the top of
// each tree so pulses climb the trees the way they climb the golden roots under the logo.
//
// Meshes are merged per material before writing (three draw calls for the whole forest instead of hundreds).
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { buildLeaf, buildTaperedTube, hash, jitter, phaseRamp, taper, veinControlPoints, writeGlb } from './cinema2-tube-kit.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputPath = process.argv[2] ? resolve(process.argv[2]) : join(root, 'public/cinema2/models/reliquary-trees.glb')

/** Same ground plane as the golden roots (see generate-golden-roots.mjs). */
const FLOOR_Y = -1.55

const meshes = []
let curveIndex = 0
/** The tree being built: every mesh it adds carries this seed as `_GLOW_SEED`, so each tree's glow pulses on its own. */
let treeSeed = 0
const seedsFor = positions => new Float32Array(positions.length / 3).fill(treeSeed)
function addTube(points, radiusAt, radialSegments, part, options = {}) {
  const { positions, normals, indices, phases } = buildTaperedTube(points, { radiusAt, radialSegments, samples: options.samples ?? 48, bark: options.bark ?? null, phaseAt: options.phaseAt ?? (() => 0) })
  meshes.push({ name: `${part}-${curveIndex++}`, part, positions, normals, indices, phases, seeds: seedsFor(positions) })
}

/** Gold vines spiralling up a host curve (just proud of its surface), with buds along them. */
function wrapInVines(points, hostRadiusAt, key, { count, turns, phaseAt, buds = true }) {
  for (let v = 0; v < count; v += 1) {
    const vineKey = `${key}:vine:${v}`
    const start = (v / count) * Math.PI * 2 + jitter(`${vineKey}:angle`, 0.5)
    const spiral = veinControlPoints(points, hostRadiusAt, start, (turns + jitter(`${vineKey}:turns`, 0.6)) * (v % 2 === 0 ? 1 : -1), 1.08, 28)
    const radius = t => Math.max(0.011, 0.026 * (1 - 0.45 * t))
    addTube(spiral, radius, 6, 'vines', { samples: 48, phaseAt })
    if (!buds) continue
    const curve = new THREE.CatmullRomCurve3(spiral.map(p => new THREE.Vector3(...p)), false, 'centripetal')
    const count2 = 5 + Math.floor(hash(`${vineKey}:buds`) * 4)
    for (let b = 0; b < count2; b += 1) {
      const t = (b + 0.5 + jitter(`${vineKey}:bud:${b}`, 0.3)) / count2
      const at = curve.getPointAt(Math.min(0.98, Math.max(0.02, t)))
      const tangent = curve.getTangentAt(Math.min(0.98, Math.max(0.02, t)))
      const outward = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0))
      if (outward.lengthSq() < 1e-6) outward.set(1, 0, 0)
      outward.normalize().multiplyScalar(b % 2 === 0 ? 1 : -1).addScaledVector(tangent, 0.4).add(new THREE.Vector3(0, 0.3, 0.35)).normalize()
      const leaf = buildLeaf(at, outward, 0.06 + hash(`${vineKey}:bud-size:${b}`) * 0.035, jitter(`${vineKey}:bud-twist:${b}`, 0.8))
      const phase = phaseAt(t)
      meshes.push({ name: `bud-${curveIndex++}`, part: 'buds', positions: leaf.positions, normals: leaf.normals, indices: leaf.indices, phases: new Float32Array(leaf.positions.length / 3).fill(phase), seeds: seedsFor(leaf.positions) })
    }
  }
}

/**
 * One tree. `base` is the trunk's centre at the ground, `lean` the horizontal offset of its top, `height` above the floor; `strands` twist
 * round the trunk's axis; `inward` (+1 / -1) is the direction toward the logo, for branches and the S-curve.
 */
function tree(key, { base, height, lean, strands, strandRadius, spread, inward, branches, roots, vines, detail }) {
  treeSeed = hash(`${key}:glow-seed`)
  const axisAt = t => {
    // A slow S: out, then in toward the logo, then out again at the top, plus a seeded wobble.
    const s = Math.sin(t * Math.PI * 1.4 + hash(`${key}:s`) * 2) * 0.22
    return [base[0] + lean[0] * t + inward * s * spread * 2, FLOOR_Y + height * t, base[2] + lean[1] * t + jitter(`${key}:wob`, 0.1) * Math.sin(t * 5)]
  }
  const rings = 10
  for (let k = 0; k < strands; k += 1) {
    const strandKey = `${key}:strand:${k}`
    const turns = 0.9 + hash(`${strandKey}:turns`) * 0.6
    const points = []
    for (let i = 0; i <= rings; i += 1) {
      const t = i / rings
      const angle = (k / strands) * Math.PI * 2 + turns * Math.PI * 2 * t
      const r = spread * (1.15 - 0.45 * t)
      const [x, y, z] = axisAt(t)
      points.push([x + Math.cos(angle) * r, y + (i === 0 ? -0.05 : 0), z + Math.sin(angle) * r])
    }
    const radiusAt = t => strandRadius * (1 - 0.55 * t) * (1 + (t < 0.12 ? (0.12 - t) * 3 : 0))
    addTube(points, radiusAt, detail.radial, 'bark', { samples: detail.samples, bark: { amplitude: 0.16, seed: hash(`${strandKey}:bark`) } })
    if (vines > 0) wrapInVines(points, radiusAt, strandKey, { count: vines, turns: 3.2, phaseAt: phaseRamp(0.02, 1), buds: detail.buds })
  }

  // Branches: from high on the trunk, arching up and in over the scene.
  for (let b = 0; b < branches; b += 1) {
    const branchKey = `${key}:branch:${b}`
    const t0 = 0.55 + b * 0.18
    const start = axisAt(t0)
    const reach = 1.4 + hash(`${branchKey}:reach`) * 0.9
    const rise = 0.8 + hash(`${branchKey}:rise`) * 0.8
    const back = -0.3 - hash(`${branchKey}:back`) * 0.6
    const points = [0, 0.33, 0.66, 1].map((u, i) => [
      start[0] + inward * reach * u + jitter(`${branchKey}:x${i}`, 0.12),
      start[1] + rise * Math.sin(u * Math.PI * 0.6) + jitter(`${branchKey}:y${i}`, 0.1),
      start[2] + back * u,
    ])
    const radiusAt = taper(strandRadius * 0.75, strandRadius * 0.12)
    addTube(points, radiusAt, detail.radial - 4, 'bark', { samples: 40, bark: { amplitude: 0.14, seed: hash(`${branchKey}:bark`) } })
    if (vines > 0) wrapInVines(points, radiusAt, branchKey, { count: 1, turns: 2.2, phaseAt: phaseRamp(t0, 1), buds: detail.buds })
  }

  // Buttress roots: rising from the trunk base and snaking out over the ground.
  for (let r = 0; r < roots; r += 1) {
    const rootKey = `${key}:root:${r}`
    const heading = (r / roots) * Math.PI * 2 + jitter(`${rootKey}:heading`, 0.25)
    const reach = spread * 3 + hash(`${rootKey}:reach`) * spread * 3
    const sway = jitter(`${rootKey}:sway`, 0.3)
    const points = []
    for (let i = 0; i <= 5; i += 1) {
      const u = i / 5
      const radius = spread * 0.6 + reach * u
      const a = heading + sway * Math.sin(u * Math.PI)
      points.push([base[0] + Math.cos(a) * radius, FLOOR_Y + 0.5 * spread * Math.pow(1 - u, 2), base[2] + Math.sin(a) * radius])
    }
    const radiusAt = t => strandRadius * 0.9 * Math.pow(1 - t, 0.8) + 0.02
    addTube(points, radiusAt, detail.radial - 4, 'bark', { samples: 24, bark: { amplitude: 0.14, seed: hash(`${rootKey}:bark`) } })
    if (vines > 0 && r % 2 === 0) wrapInVines(points, radiusAt, rootKey, { count: 1, turns: 1.5, phaseAt: phaseRamp(0.08, 0), buds: false })
  }
}

const NEAR = { radial: 16, samples: 56, buds: true }
const MID = { radial: 12, samples: 40, buds: true }
const FAR = { radial: 9, samples: 24, buds: false }

for (const side of [1, -1]) {
  const s = side === 1 ? 'r' : 'l'
  const inward = -side
  // Foreground: the two big trees at the frame edges, leaning in toward the logo.
  tree(`near:${s}`, { base: [2.85 * side, 0, -1.1], height: 5.6, lean: [-0.3 * side, -0.4], strands: 3, strandRadius: 0.34, spread: 0.3, inward, branches: 2, roots: 7, vines: 2, detail: NEAR })
  // Mid: one further out, one tucked in behind the logo's side.
  tree(`mid-out:${s}`, { base: [4.8 * side, 0, -3.4], height: 6, lean: [-0.4 * side, 0.2], strands: 2, strandRadius: 0.22, spread: 0.2, inward, branches: 1, roots: 5, vines: 1, detail: MID })
  tree(`mid-in:${s}`, { base: [2.6 * side, 0, -6.4], height: 6.4, lean: [0.3 * side, -0.2], strands: 2, strandRadius: 0.17, spread: 0.17, inward, branches: 1, roots: 4, vines: 1, detail: MID })
  // Far: single trunks deep behind, faded by the haze.
  tree(`far-a:${s}`, { base: [4.2 * side, 0, -8.5], height: 7, lean: [0.2 * side, 0], strands: 1, strandRadius: 0.24, spread: 0.1, inward, branches: 1, roots: 3, vines: 1, detail: FAR })
  tree(`far-b:${s}`, { base: [7.6 * side, 0, -7.2], height: 7, lean: [-0.3 * side, 0], strands: 1, strandRadius: 0.26, spread: 0.1, inward, branches: 0, roots: 3, vines: 1, detail: FAR })
}

// ── Merge per material: the forest draws in three calls. ────────────────────────────────────────────────────────────────────────────
const merged = []
for (const part of ['bark', 'vines', 'buds']) {
  const members = meshes.filter(mesh => mesh.part === part)
  const vertexCount = members.reduce((sum, mesh) => sum + mesh.positions.length / 3, 0)
  const indexCount = members.reduce((sum, mesh) => sum + mesh.indices.length, 0)
  const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3), phases = new Float32Array(vertexCount), seeds = new Float32Array(vertexCount), indices = new Uint32Array(indexCount)
  let vertexOffset = 0, indexOffset = 0
  for (const mesh of members) {
    positions.set(mesh.positions, vertexOffset * 3)
    normals.set(mesh.normals, vertexOffset * 3)
    phases.set(mesh.phases, vertexOffset)
    seeds.set(mesh.seeds, vertexOffset)
    for (let i = 0; i < mesh.indices.length; i += 1) indices[indexOffset + i] = mesh.indices[i] + vertexOffset
    vertexOffset += mesh.positions.length / 3
    indexOffset += mesh.indices.length
  }
  merged.push({ name: part, part, positions, normals, indices, phases, seeds })
}

// ── PBR materials (Linear-sRGB). Bark: near-black brown, a little glossy like the reference's wet-looking trunks. Vines and buds: polished
// gold; the audio glow adds their light on top (the buds carry a faint glow of their own so they read even between pulses). ─────────────
const MATERIALS = {
  bark: { baseColorFactor: [0.03, 0.02, 0.013, 1], metallicFactor: 0, roughnessFactor: 0.5 },
  vines: { baseColorFactor: [0.95, 0.64, 0.26, 1], metallicFactor: 1, roughnessFactor: 0.28 },
  buds: { baseColorFactor: [1, 0.72, 0.32, 1], metallicFactor: 0.8, roughnessFactor: 0.25, emissiveFactor: [0.25, 0.13, 0.03] },
}

const { triangles, byteLength, parts } = writeGlb(outputPath, merged, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-reliquary-trees.mjs', 'reliquary-trees')
console.log(`Wrote ${outputPath}`)
console.log(`  ${meshes.length} curves/leaves merged into ${merged.length} meshes (${parts.join(', ')}), ${triangles} triangles, ${(byteLength / 1024).toFixed(0)} KB`)
