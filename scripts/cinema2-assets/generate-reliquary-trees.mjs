// Generates the flanking trees for Cinema 2.0's RELIQUARY preset.
//   node scripts/cinema2-assets/generate-reliquary-trees.mjs [out.glb]      (default: public/cinema2/models/reliquary-trees.glb)
//
// The owner's production mockup and tree references (docs/cinema2-reliquary-production-plan.md, images 2, 4 and 6) frame the logo between
// massive, gnarled dark trees wrapped in broad glowing gold vines, with more trunks fading into the mist behind them. Three depth layers, all
// hand-placed and seeded (no L-system):
//   - two foreground trees at the frame edges: trunks of four thick strands twisting hard round each other, leaning in toward the logo in a
//     slow S, heavy buttress roots that splay over the ground and settle into it, big limbs that climb and arch inward over the top of the
//     frame (the canopy), and thin leafy twigs off the trunk;
//   - four mid trees further back and out, two or three strands each;
//   - eight far trunks deep behind, which the haze fades.
// The bark is dark and slightly glossy, with an in-house tileable bark texture (vertical fibre grooves and cracks; normal + roughness maps,
// embedded in the model) so the trunks read as wood, not smooth tubes, and it is shaded from its actual lumpy surface. It does not glow.
// Broad gold vines wrap every strand, limb and big root, half sunk into the bark so they read as flat bands (image 6), with gold leaves along
// them and on the twigs. The vines and leaves are the parts three-scene's audio glow lights; their `_GLOW_PHASE` runs 0 at the ground to 1 at
// the top of each tree, so pulses climb the trees the way they climb the golden roots under the logo, and each tree carries its own
// `_GLOW_SEED` so it pulses on its own.
//
// Meshes are merged per material before writing (three draw calls for the whole forest instead of hundreds).
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { buildLeaf, buildTaperedTube, encodePng, hash, jitter, phaseRamp, taper, veinControlPoints, writeGlb } from './cinema2-tube-kit.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputPath = process.argv[2] ? resolve(process.argv[2]) : join(root, 'public/cinema2/models/reliquary-trees.glb')

/** Same ground plane as the golden roots (see generate-golden-roots.mjs). */
const FLOOR_Y = -1.55
/** Bark texture: repeats round each tube, and world units per repeat along it (the grain runs along the tube). */
const BARK_UV = { around: 2, along: 1.4 }

const meshes = []
let curveIndex = 0
/** The tree being built: every mesh it adds carries this seed as `_GLOW_SEED`, so each tree's glow pulses on its own. */
let treeSeed = 0
const seedsFor = positions => new Float32Array(positions.length / 3).fill(treeSeed)
function addTube(points, radiusAt, radialSegments, part, options = {}) {
  const barkPart = part === 'bark'
  const tube = buildTaperedTube(points, {
    radiusAt, radialSegments, samples: options.samples ?? 48, bark: options.bark ?? null, phaseAt: options.phaseAt ?? (() => 0),
    ...(barkPart ? { uv: BARK_UV, surfaceNormals: true } : {}),
  })
  meshes.push({ name: `${part}-${curveIndex++}`, part, ...tube, seeds: seedsFor(tube.positions) })
}

function addLeaf(at, outward, size, twist, phase) {
  const leaf = buildLeaf(at, outward, size, twist)
  meshes.push({ name: `bud-${curveIndex++}`, part: 'buds', positions: leaf.positions, normals: leaf.normals, indices: leaf.indices, phases: new Float32Array(leaf.positions.length / 3).fill(phase), seeds: seedsFor(leaf.positions) })
}

/** A tiny glowing crystal (an octahedron, 8 triangles): the sparkle points dotted along the vines in the owner's mockup. */
function addSparkle(at, size, phase) {
  const axes = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
  const faces = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]]
  const positions = [], normals = [], indices = []
  for (const face of faces) {
    const n = face.reduce((sum, i) => [sum[0] + axes[i][0], sum[1] + axes[i][1], sum[2] + axes[i][2]], [0, 0, 0]).map(v => v / Math.sqrt(3))
    for (const i of face) { positions.push(at.x + axes[i][0] * size, at.y + axes[i][1] * size, at.z + axes[i][2] * size); normals.push(...n); indices.push(indices.length) }
  }
  meshes.push({ name: `bud-${curveIndex++}`, part: 'buds', positions: new Float32Array(positions), normals: new Float32Array(normals), indices: Uint32Array.from(indices), phases: new Float32Array(positions.length / 3).fill(phase), seeds: seedsFor(positions) })
}

/**
 * Thin glowing gold vines wrapping a host curve, as in the owner's mockup: each rides just proud of the bark, dotted with tiny sparkle points
 * and a few small leaves. (Broad half-sunk bands, after the tree reference, read as flat ribbons against the mockup's fine lines of light.)
 */
function wrapInVines(points, hostRadiusAt, key, { count, turns, phaseAt, width, leaves = true }) {
  for (let v = 0; v < count; v += 1) {
    const vineKey = `${key}:vine:${v}`
    const start = (v / count) * Math.PI * 2 + jitter(`${vineKey}:angle`, 0.5)
    // Every vine on a strand winds the same way (crossing vines read as a gold X pattern, not as a vine growing up the tree).
    const spiral = veinControlPoints(points, hostRadiusAt, start, turns + jitter(`${vineKey}:turns`, 0.5), 1.02, 40)
    const radius = t => Math.max(width * 0.45, width * (1 - 0.4 * t))
    addTube(spiral, radius, 5, 'vines', { samples: 44, phaseAt })
    const curve = new THREE.CatmullRomCurve3(spiral.map(p => new THREE.Vector3(...p)), false, 'centripetal')
    // Sparkle points along the whole vine.
    const sparkles = 8 + Math.floor(hash(`${vineKey}:sparkles`) * 6)
    for (let k = 0; k < sparkles; k += 1) {
      const t = Math.min(0.99, Math.max(0.01, (k + 0.5 + jitter(`${vineKey}:sparkle:${k}`, 0.45)) / sparkles))
      addSparkle(curve.getPointAt(t), width * (1.3 + hash(`${vineKey}:sparkle-size:${k}`) * 1.1), phaseAt(t))
    }
    if (!leaves) continue
    const leafCount = 2 + Math.floor(hash(`${vineKey}:leaves`) * 3)
    for (let b = 0; b < leafCount; b += 1) {
      const t = Math.min(0.98, Math.max(0.03, (b + 0.5 + jitter(`${vineKey}:leaf:${b}`, 0.3)) / leafCount))
      const at = curve.getPointAt(t)
      const tangent = curve.getTangentAt(t)
      const outward = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0))
      if (outward.lengthSq() < 1e-6) outward.set(1, 0, 0)
      outward.normalize().multiplyScalar(b % 2 === 0 ? 1 : -1).addScaledVector(tangent, 0.4).add(new THREE.Vector3(0, 0.3, 0.4)).normalize()
      addLeaf(at, outward, 0.045 + hash(`${vineKey}:leaf-size:${b}`) * 0.03, jitter(`${vineKey}:leaf-twist:${b}`, 0.8), phaseAt(t))
    }
  }
}

/** A thin twig growing off a host point, curling up and out, with a few leaves along it. */
function twig(key, at, outward, length, radius, phase, detail) {
  const up = new THREE.Vector3(0, 1, 0)
  const bend = new THREE.Vector3(jitter(`${key}:bx`, 0.4), 0.6, jitter(`${key}:bz`, 0.3)).normalize()
  const points = [0, 0.33, 0.66, 1].map(u => {
    const v = at.clone().addScaledVector(outward, u * length).addScaledVector(bend, u * u * length * 0.5).addScaledVector(up, Math.sin(u * Math.PI) * 0.05)
    return [v.x, v.y, v.z]
  })
  addTube(points, taper(radius, radius * 0.25), 6, 'bark', { samples: 12, phaseAt: () => phase })
  if (!detail.leaves) return
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal')
  for (let l = 0; l < 3; l += 1) {
    const t = 0.4 + l * 0.25
    const p = curve.getPointAt(Math.min(1, t))
    const dir = outward.clone().addScaledVector(up, 0.7).add(new THREE.Vector3(jitter(`${key}:l${l}x`, 0.6), 0, jitter(`${key}:l${l}z`, 0.4) + 0.3)).normalize()
    addLeaf(p, dir, 0.06 + hash(`${key}:l${l}`) * 0.04, jitter(`${key}:lt${l}`, 0.8), phase)
  }
}

/**
 * One tree. `base` is the trunk's centre at the ground, `lean` the horizontal offset of its top, `height` above the floor; `strands` twist
 * `twist` turns round the trunk's axis; `inward` (+1 / -1) is the direction toward the logo, for the S-curve, the arching limbs and twigs.
 */
function tree(key, { base, height, lean, strands, strandRadius, spread, twist, inward, limbs, roots, twigs, vines, detail }) {
  treeSeed = hash(`${key}:glow-seed`)
  const axisAt = t => {
    // A slow S: out, then in toward the logo, then out again near the top, plus a seeded wobble.
    const s = Math.sin(t * Math.PI * 1.4 + hash(`${key}:s`) * 2) * 0.26
    return [base[0] + lean[0] * t + inward * s * spread * 2, FLOOR_Y + height * t, base[2] + lean[1] * t + jitter(`${key}:wob`, 0.1) * Math.sin(t * 5)]
  }
  const rings = 14
  const strandRadiusAt = t => strandRadius * (1 - 0.5 * t) * (1 + (t < 0.14 ? (0.14 - t) * 3.2 : 0))
  for (let k = 0; k < strands; k += 1) {
    const strandKey = `${key}:strand:${k}`
    const turns = twist + hash(`${strandKey}:turns`) * 0.5
    const points = []
    for (let i = 0; i <= rings; i += 1) {
      const t = i / rings
      const angle = (k / strands) * Math.PI * 2 + turns * Math.PI * 2 * t
      const r = spread * (1.2 - 0.5 * t)
      const [x, y, z] = axisAt(t)
      points.push([x + Math.cos(angle) * r, y + (i === 0 ? -0.08 : 0), z + Math.sin(angle) * r])
    }
    addTube(points, strandRadiusAt, detail.radial, 'bark', { samples: detail.samples, bark: { amplitude: 0.22, seed: hash(`${strandKey}:bark`) } })
    if (vines > 0 && k < Math.max(1, strands - 1)) wrapInVines(points, strandRadiusAt, strandKey, { count: vines, turns: 2.4, phaseAt: phaseRamp(0.02, 1), width: detail.vineWidth, leaves: detail.leaves })
  }

  // Limbs: from high on the trunk, climbing and then arching inward over the scene (the canopy framing the top of the frame).
  for (let b = 0; b < limbs; b += 1) {
    const limbKey = `${key}:limb:${b}`
    const t0 = 0.5 + b * 0.16
    const start = axisAt(t0)
    const reach = 1.8 + hash(`${limbKey}:reach`) * 1.2
    const rise = 1.1 + hash(`${limbKey}:rise`) * 0.9
    const back = -0.2 - hash(`${limbKey}:back`) * 0.8
    const points = [0, 0.2, 0.42, 0.66, 0.85, 1].map((u, i) => [
      start[0] + inward * reach * Math.pow(u, 1.25) + jitter(`${limbKey}:x${i}`, 0.1),
      // Up steeply, then over: the tip droops a little as it arches in.
      start[1] + rise * Math.sin(u * Math.PI * 0.72) + jitter(`${limbKey}:y${i}`, 0.08),
      start[2] + back * u,
    ])
    const radiusAt = taper(strandRadius * 0.8, strandRadius * 0.1)
    addTube(points, radiusAt, detail.radial - 4, 'bark', { samples: 32, bark: { amplitude: 0.2, seed: hash(`${limbKey}:bark`) } })
    if (vines > 0) wrapInVines(points, radiusAt, limbKey, { count: 1, turns: 1.8, phaseAt: phaseRamp(t0, 1), width: detail.vineWidth * 0.8, leaves: detail.leaves })
    // Side twigs off the limb.
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal')
    for (let w = 0; w < (detail.leaves ? 3 : 0); w += 1) {
      const u = 0.35 + w * 0.22
      const at = curve.getPointAt(u)
      const tangent = curve.getTangentAt(u)
      const out = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 0, 1)).normalize().multiplyScalar(w % 2 === 0 ? 1 : -1)
      twig(`${limbKey}:twig:${w}`, at, out, 0.4 + hash(`${limbKey}:tl${w}`) * 0.3, radiusAt(u) * 0.35, t0 + (1 - t0) * u, detail)
    }
  }

  // Leafy twigs straight off the trunk, mostly on the side facing the logo (image 4).
  for (let w = 0; w < twigs; w += 1) {
    const twigKey = `${key}:trunk-twig:${w}`
    const t = 0.22 + (w / Math.max(1, twigs)) * 0.55 + jitter(`${twigKey}:t`, 0.04)
    const [x, y, z] = axisAt(t)
    const facing = new THREE.Vector3(inward * (0.6 + hash(`${twigKey}:f`) * 0.4), 0.25, 0.35 + jitter(`${twigKey}:z`, 0.4)).normalize()
    const at = new THREE.Vector3(x, y, z).addScaledVector(facing, spread + strandRadius * 0.6)
    twig(twigKey, at, facing, 0.45 + hash(`${twigKey}:len`) * 0.35, strandRadius * 0.14, t, detail)
  }

  // Buttress roots: rising high from the trunk base and snaking out over the ground, flattening as they settle into it.
  for (let r = 0; r < roots; r += 1) {
    const rootKey = `${key}:root:${r}`
    const heading = (r / roots) * Math.PI * 2 + jitter(`${rootKey}:heading`, 0.25)
    const reach = spread * 3.5 + hash(`${rootKey}:reach`) * spread * 3.5
    const sway = jitter(`${rootKey}:sway`, 0.35)
    const points = []
    for (let i = 0; i <= 6; i += 1) {
      const u = i / 6
      const radius = spread * 0.55 + reach * u
      const a = heading + sway * Math.sin(u * Math.PI)
      points.push([base[0] + Math.cos(a) * radius, FLOOR_Y + 0.9 * spread * Math.pow(1 - u, 2.2) + 0.01, base[2] + Math.sin(a) * radius])
    }
    const radiusAt = t => strandRadius * 1.05 * Math.pow(1 - t, 0.75) + 0.025
    addTube(points, radiusAt, detail.radial - 4, 'bark', { samples: 20, bark: { amplitude: 0.2, seed: hash(`${rootKey}:bark`) } })
    if (vines > 0 && r % 2 === 0) wrapInVines(points, radiusAt, rootKey, { count: 1, turns: 1.2, phaseAt: phaseRamp(0.08, 0), width: detail.vineWidth * 0.8, leaves: false })
  }
}

const NEAR = { radial: 14, samples: 44, leaves: true, vineWidth: 0.014 }
const MID = { radial: 10, samples: 32, leaves: true, vineWidth: 0.012 }
const FAR = { radial: 8, samples: 20, leaves: false, vineWidth: 0.014 }

for (const side of [1, -1]) {
  const s = side === 1 ? 'r' : 'l'
  const inward = -side
  // Foreground: the two massive trees at the frame edges, leaning in toward the logo, their limbs arching over the top of the frame.
  tree(`near:${s}`, { base: [2.45 * side, 0, -1.5], height: 5.8, lean: [-0.25 * side, -0.4], strands: 4, strandRadius: 0.32, spread: 0.3, twist: 1.3, inward, limbs: 2, roots: 8, twigs: 4, vines: 3, detail: NEAR })
  // Mid: one further out, one tucked in behind the logo's side.
  tree(`mid-out:${s}`, { base: [4.1 * side, 0, -3.4], height: 6.2, lean: [-0.5 * side, 0.2], strands: 3, strandRadius: 0.24, spread: 0.22, twist: 1.1, inward, limbs: 1, roots: 5, twigs: 2, vines: 2, detail: MID })
  tree(`mid-in:${s}`, { base: [3.7 * side, 0, -6.4], height: 6.6, lean: [0.3 * side, -0.2], strands: 2, strandRadius: 0.2, spread: 0.18, twist: 1, inward, limbs: 1, roots: 4, twigs: 1, vines: 1, detail: MID })
  // Far: single and double trunks deep behind, faded by the haze.
  tree(`far-a:${s}`, { base: [4.2 * side, 0, -8.5], height: 7.4, lean: [0.2 * side, 0], strands: 2, strandRadius: 0.18, spread: 0.14, twist: 0.8, inward, limbs: 1, roots: 3, twigs: 0, vines: 1, detail: FAR })
  tree(`far-b:${s}`, { base: [7.6 * side, 0, -7.2], height: 7.4, lean: [-0.3 * side, 0], strands: 1, strandRadius: 0.28, spread: 0.1, twist: 0.6, inward, limbs: 0, roots: 3, twigs: 0, vines: 1, detail: FAR })
  tree(`far-c:${s}`, { base: [1.4 * side, 0, -10.5], height: 8, lean: [0.1 * side, 0], strands: 1, strandRadius: 0.26, spread: 0.1, twist: 0.5, inward, limbs: 0, roots: 3, twigs: 0, vines: 0, detail: FAR })
  tree(`far-d:${s}`, { base: [6.2 * side, 0, -11], height: 8, lean: [-0.2 * side, 0], strands: 1, strandRadius: 0.3, spread: 0.1, twist: 0.5, inward, limbs: 0, roots: 3, twigs: 0, vines: 0, detail: FAR })
}

// ── Bark texture (in house): vertical fibre grooves broken by cracks, tileable. Normal map (tangent space) and metal/roughness map. ────
const TEXTURE_SIZE = 512
function barkTextures(size) {
  const noiseHash = (x, y, seed) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0
    h = (h ^ (h >>> 13)) * 1274126177 | 0
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }
  // Periodic value noise with separate periods across (u) and along (v) the grain, so the fibres stretch along v and still tile.
  const noise = (u, v, pu, pv, seed) => {
    const x = u * pu, y = v * pv, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
    const wx = i => ((i % pu) + pu) % pu, wy = i => ((i % pv) + pv) % pv
    const a = noiseHash(wx(x0), wy(y0), seed), b = noiseHash(wx(x0 + 1), wy(y0), seed), c = noiseHash(wx(x0), wy(y0 + 1), seed), d = noiseHash(wx(x0 + 1), wy(y0 + 1), seed)
    return a + (b - a) * sx + (c - a + (a - b + d - c) * sx) * sy
  }
  const height = new Float32Array(size * size)
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const u = x / size, v = y / size
    // Fibres: ridged noise, fine across the grain and long along it; plus broad lumps and a few deep cracks.
    const fibre = 1 - Math.abs(2 * (0.6 * noise(u, v, 48, 4, 1) + 0.4 * noise(u, v, 96, 8, 2)) - 1)
    const lumps = noise(u, v, 6, 2, 3) * 0.6 + noise(u, v, 12, 4, 4) * 0.4
    const crackField = Math.abs(noise(u, v, 10, 3, 5) - 0.5)
    const crack = 1 - Math.min(1, crackField / 0.035)
    height[y * size + x] = fibre * 0.55 + lumps * 0.45 - crack * 0.7
  }
  const normal = new Uint8Array(size * size * 4), metalRough = new Uint8Array(size * size * 4)
  const h = (x, y) => height[(((y % size) + size) % size) * size + (((x % size) + size) % size)]
  const strength = 3.2
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * strength, dy = (h(x, y + 1) - h(x, y - 1)) * strength
    const l = Math.hypot(dx, dy, 1)
    const i = (y * size + x) * 4
    normal[i] = Math.round((0.5 - 0.5 * dx / l) * 255); normal[i + 1] = Math.round((0.5 - 0.5 * dy / l) * 255); normal[i + 2] = Math.round((0.5 + 0.5 / l) * 255); normal[i + 3] = 255
    // glTF metal/roughness: G roughness, B metalness. Crevices are rougher, the worn fibre tops a little glossier.
    const depth = Math.min(1, Math.max(0, 0.6 - h(x, y)))
    metalRough[i] = 255; metalRough[i + 1] = Math.round((0.45 + 0.4 * depth) * 255); metalRough[i + 2] = 0; metalRough[i + 3] = 255
  }
  return { normal: encodePng(normal, size), metallicRoughness: encodePng(metalRough, size) }
}
const bark = barkTextures(TEXTURE_SIZE)

// ── Merge per material: the forest draws in three calls. ────────────────────────────────────────────────────────────────────────────
const merged = []
for (const part of ['bark', 'vines', 'buds']) {
  const members = meshes.filter(mesh => mesh.part === part)
  const withUvs = members.every(mesh => mesh.uvs)
  const vertexCount = members.reduce((sum, mesh) => sum + mesh.positions.length / 3, 0)
  const indexCount = members.reduce((sum, mesh) => sum + mesh.indices.length, 0)
  const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3), phases = new Float32Array(vertexCount), seeds = new Float32Array(vertexCount), indices = new Uint32Array(indexCount)
  const uvs = withUvs ? new Float32Array(vertexCount * 2) : null
  let vertexOffset = 0, indexOffset = 0
  for (const mesh of members) {
    positions.set(mesh.positions, vertexOffset * 3)
    normals.set(mesh.normals, vertexOffset * 3)
    phases.set(mesh.phases, vertexOffset)
    seeds.set(mesh.seeds, vertexOffset)
    if (uvs) uvs.set(mesh.uvs, vertexOffset * 2)
    for (let i = 0; i < mesh.indices.length; i += 1) indices[indexOffset + i] = mesh.indices[i] + vertexOffset
    vertexOffset += mesh.positions.length / 3
    indexOffset += mesh.indices.length
  }
  merged.push({ name: part, part, positions, normals, indices, phases, seeds, ...(uvs ? { uvs } : {}) })
}

// ── PBR materials (Linear-sRGB). Bark: near-black brown, slightly glossy like the mockup's wet-looking trunks, with the bark texture. Vines
// and leaves: polished gold; the audio glow adds their light on top (the leaves carry a faint glow of their own so they read between pulses).
const MATERIALS = {
  // A little metallic with a dark warm-brown base, so the wet bark's highlights come out warm brown, as in the mockup (a plain dielectric
  // reflects white, and the trunks read cool silver).
  bark: { baseColorFactor: [0.12, 0.068, 0.034, 1], metallicFactor: 0.5, roughnessFactor: 1, textures: { normal: bark.normal, metallicRoughness: bark.metallicRoughness, normalScale: 1 } },
  // Dark burnished gold: unlit, a vine reads as a dark line on the bark, and the glow gives it its color (a bright gold picked up the haze and
  // read pale beige).
  vines: { baseColorFactor: [0.4, 0.24, 0.08, 1], metallicFactor: 1, roughnessFactor: 0.3 },
  buds: { baseColorFactor: [1, 0.72, 0.32, 1], metallicFactor: 0.8, roughnessFactor: 0.25, emissiveFactor: [0.25, 0.13, 0.03] },
}

const { triangles, byteLength, parts } = writeGlb(outputPath, merged, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-reliquary-trees.mjs', 'reliquary-trees')
console.log(`Wrote ${outputPath}`)
console.log(`  ${meshes.length} curves/leaves merged into ${merged.length} meshes (${parts.join(', ')}), ${triangles} triangles, ${(byteLength / 1024).toFixed(0)} KB, bark texture ${TEXTURE_SIZE}px`)
