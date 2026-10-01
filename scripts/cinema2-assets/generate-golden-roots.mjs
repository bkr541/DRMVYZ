// Generates the shared "golden roots" asset for Cinema 2.0's RELIQUARY preset.
//   node scripts/cinema2-assets/generate-golden-roots.mjs [out.glb]      (default: public/cinema2/models/golden-roots.glb)
//
// Revision 4, built against the owner's cinematic mockups: a thick trunk of several strands twisting around each other rises from a wide flare
// of roots; just under the logo's star it splits into slender branches that thread THROUGH the open spaces in the bottom of the logo instead of
// wrapping round it. Per side: an inner branch rises behind the logo's bottom band, comes forward through the inner lower opening and ends in a
// leafy curl in front of the lower swirl; an outer branch runs in front of the logo's bottom edge and passes back through the outer lobe's
// opening, ending behind it. Short tendrils curl out under the logo. Nothing climbs above the swirls (revision 3's limbs wrapped round the
// outside of the lower lobes and up over their tops, covering too much of the logo). A hand-authored curve network, not an L-system.
//
// Every curve is swept into a tapered tube (a rotation-minimizing frame down a Catmull-Rom spline, radius shrinking along its length) with
// a bark perturbation on the wood (not the leaf stems or veins): each ring vertex's radius is nudged by a sum of a few sine waves in the
// tube's local (length, angle) space, seeded per curve. A thin, strongly emissive "vein" strand rides just proud of the trunk strands and the
// limbs, a cheap stand-in for a glowing crack texture (the hand-written GLB writer below has no UVs or embedded images).
//
// Every vertex also carries `_GLOW_PHASE` (0-1): how far up the tree it is, 0 at the root tips, ~0.28 where the roots meet the trunk, ~0.6 at
// the trunk top and 1 at the limb tips wrapped round the logo. three-scene's audio glow sends pulses of light up the tree along it.
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { buildLeaf, buildTaperedTube, hash, jitter, phaseRamp, taper, veinControlPoints, writeGlb } from './cinema2-tube-kit.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputPath = process.argv[2] ? resolve(process.argv[2]) : join(root, 'public/cinema2/models/golden-roots.glb')

// Logo landmarks (measured from dvydrm-logo.glb / the master SVG): half-width 1.0, outline bottom -0.628, top +0.628, star tip -0.58.
// The model is built in the logo's frame (the logo 0.05 above the origin). Its floor sits 0.72 below the logo's bottom edge, so the trunk below
// the split is about half the logo's height, as in the owner's mockup (a stout trunk under a large logo); the preset lowers the logo and this
// model together by 0.25 to put this floor on the scene's floor at y = -1.55.
const FLOOR_Y = -1.3

// ── The curve network ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Logo landmarks in world units (the logo is placed 0.05 above the origin), measured from a raster of the logo model: its bottom edge runs at
// y ~-0.57 from x 0.1 to 0.8; the bottom band is solid from y ~-0.48 to -0.28; the inner lower opening spans x ~0.15-0.49 at y ~-0.22 to -0.08
// and opens up into the space inside the lower swirl (x ~0.39-0.55 up to y ~0.1); the swirl's own ribbon is solid at x ~0.2-0.35, y ~0; the outer
// lobe's opening spans x ~0.63-0.83, y ~-0.24 to 0.0. The logo is ~0.07 deep about z = 0 (negative z is behind it).
const TRUNK_TOP_Y = -0.7

/**
 * The trunk's strands twisting round its axis from the floor to just under the star, as in the owner's model (image 5): wide at the root flare,
 * a waist about a quarter of the logo's width, and at the top each strand leans out toward the limb it feeds (odd strands right, even left),
 * so the trunk flows into the two limbs instead of stopping under them.
 */
const TRUNK_STRANDS = 6
function trunkStrand(index) {
  const points = []
  const turns = 0.7
  const side = index % 2 === 0 ? -1 : 1
  for (let k = 0; k <= 10; k += 1) {
    const t = k / 10
    const angle = (index / TRUNK_STRANDS) * Math.PI * 2 + turns * Math.PI * 2 * t
    // Flared at the base, pinched at the waist, opening again toward the limbs.
    const spread = 0.13 + 0.12 * Math.pow(1 - Math.min(1, t * 2.2), 2) - 0.03 * Math.sin(Math.PI * Math.min(1, t * 1.3))
    const lean = side * 0.14 * Math.pow(t, 3)
    points.push([Math.cos(angle) * spread + lean, FLOOR_Y + 0.02 + (TRUNK_TOP_Y - FLOOR_Y - 0.02) * t, Math.sin(angle) * spread * 0.85])
  }
  return points
}

// Inner branch (right side; mirrored for the left): slender, as in the mockup - from the trunk top it goes behind the logo's bottom band,
// crosses forward through the inner lower opening, and curls its tip in front of the lower swirl's ribbon.
const innerBranch = [[0.05, TRUNK_TOP_Y - 0.04, 0], [0.16, -0.62, -0.06], [0.28, -0.44, -0.1], [0.4, -0.2, -0.06], [0.44, -0.13, 0.06], [0.46, -0.04, 0.12], [0.4, 0.04, 0.13], [0.33, 0.02, 0.12]]
// The main limb: the mockup's tree raises its two limbs diagonally from the split, across the front of the logo's bottom band and up into the
// outer lower lobes, each ending in a curl inside its lobe.
const outerBranch = [[0.05, TRUNK_TOP_Y - 0.03, 0.03], [0.2, -0.6, 0.09], [0.38, -0.47, 0.11], [0.56, -0.37, 0.1], [0.7, -0.25, 0.08], [0.79, -0.1, 0.06], [0.81, 0.04, 0.05], [0.75, 0.12, 0.06], [0.69, 0.08, 0.07]]
// A short tendril curling out and forward under the logo.
const tendril = [[0.1, TRUNK_TOP_Y + 0.02, 0.05], [0.2, -0.76, 0.14], [0.27, -0.8, 0.2], [0.23, -0.86, 0.23]]

/** Where leaves hang, as (curve, t along it, side bias): few and small, mostly below the logo and at the inner branch's curl. */
const leafSites = [
  ['outerBranch', 0.25, -1], ['outerBranch', 0.4, 1], ['outerBranch', 0.55, -1], ['outerBranch', 0.68, 1], ['outerBranch', 0.8, -1], ['outerBranch', 0.92, 1], ['outerBranch', 1, -1],
  ['innerBranch', 0.6, 1], ['innerBranch', 0.82, 1], ['innerBranch', 1, -1],
  ['tendril', 1, 1],
]
/** Where twigs grow off the limbs, as (curve, t along it, side bias). */
const twigSites = [
  ['outerBranch', 0.2, 1], ['outerBranch', 0.36, -1], ['outerBranch', 0.5, 1], ['outerBranch', 0.64, -1], ['outerBranch', 0.78, 1],
  ['innerBranch', 0.5, -1],
]

const mirror = points => points.map(([x, y, z]) => [-x, y, z])
const meshes = []
let curveIndex = 0
function addTube(points, radiusAt, radialSegments, part, bark = null, phaseAt = () => 0, samples = 48) {
  const { positions, normals, indices, phases } = buildTaperedTube(points, { radiusAt, radialSegments, bark, phaseAt, samples })
  meshes.push({ name: `${part}-${curveIndex++}`, part, positions, normals, indices, phases })
}
/**
 * A glowing crack along a branch: a thin line following the branch's grain (a small drift, so it runs along the wood instead of spiralling
 * across it), centred just under the surface so only a narrow bright seam shows, like light inside the gold. Its thickness is a fraction of
 * the HOST branch's local radius (sweeping it at the host's full radius buries it inside the branch), with a floor near a tapered tip.
 */
function addVein(points, hostRadiusAt, part, baseAngle, driftTurns, phaseAt, offsetFactor = 0.99) {
  const veinRadiusAt = t => Math.max(0.005, hostRadiusAt(t) * 0.075)
  addTube(veinControlPoints(points, hostRadiusAt, baseAngle, driftTurns, offsetFactor, 24), veinRadiusAt, 5, part, null, phaseAt, 40)
}
/** `count` cracks spread round a branch, each following the grain. */
function addVeins(points, hostRadiusAt, key, count, phaseAt) {
  for (let v = 0; v < count; v += 1) addVein(points, hostRadiusAt, 'veins', (v / count) * Math.PI * 2 + jitter(`${key}:vein:${v}`, 0.6), jitter(`${key}:drift:${v}`, 0.12), phaseAt)
}
/** A curling stem from `start` heading along `out`, bending over as it goes, with a teardrop leaf at its tip. */
function addLeaf(start, out, key, phase) {
  const up = new THREE.Vector3(0, 1, 0)
  const length = 0.08 + hash(`stem:${key}`) * 0.05
  const droop = new THREE.Vector3().copy(out).multiplyScalar(0.55).addScaledVector(up, -0.45).normalize()
  const curl = new THREE.Vector3().crossVectors(out, up).normalize().multiplyScalar(jitter(`curl:${key}`, 0.35))
  const p0 = new THREE.Vector3(...start)
  const p1 = p0.clone().addScaledVector(out, length * 0.45).addScaledVector(up, length * 0.2)
  const p2 = p1.clone().addScaledVector(out, length * 0.35).add(curl.clone().multiplyScalar(length))
  const p3 = p2.clone().addScaledVector(droop, length * 0.35)
  const stem = [p0, p1, p2, p3].map(v => [v.x, v.y, v.z])
  addTube(stem, taper(0.012, 0.005), 6, 'leaves', null, () => phase, 8)
  const along = new THREE.Vector3().subVectors(p3, p2).normalize()
  // Small and pointed, like the mockup's leaves (larger ones read as flat yellow paddles).
  const leaf = buildLeaf(p3, along, 0.05 + hash(`leaf:${key}`) * 0.03, jitter(`leaf-twist:${key}`, 0.5))
  meshes.push({ name: `leaf-${curveIndex++}`, part: 'leaves', positions: leaf.positions, normals: leaf.normals, indices: leaf.indices, phases: new Float32Array(leaf.positions.length / 3).fill(phase) })
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

// The trunk: twisting strands (not mirrored: a mirrored helix would untwist), each with a few cracks along its grain.
const trunkR = t => 0.105 - 0.03 * t
/** Glow phase: root tips 0 -> trunk base ROOT_TOP -> trunk top TRUNK_TOP -> limb tips 1. */
const ROOT_TOP = 0.28, TRUNK_TOP = 0.6
const TRUNK_PHASE = phaseRamp(ROOT_TOP, TRUNK_TOP)
const LIMB_PHASE = phaseRamp(TRUNK_TOP, 1)
for (let index = 0; index < TRUNK_STRANDS; index += 1) {
  const strand = trunkStrand(index)
  addTube(strand, trunkR, 12, 'roots', { amplitude: 0.1, seed: hash(`bark:trunk:${index}`) }, TRUNK_PHASE)
  addVeins(strand, trunkR, `trunk:${index}`, 2, TRUNK_PHASE)
}

// The root flare, as in the owner's mockup: a few short buttresses where the trunk meets the floor, and many thin roots snaking out across it,
// spreading about twice the logo's width, forking as they go, each with a glowing seam along it (the mockup's roots are tendrils of light,
// not heavy ropes). Roots toward the camera are shorter so they do not run down the frame.
const ROOT_COUNT = 32
function addRoot(key, heading, reach, girth, lift, forks) {
  const towardCamera = Math.max(0, Math.sin(heading))
  const length = reach * (1 - 0.28 * towardCamera)
  const waves = 2.5 + hash(`waves:${key}`) * 2, phase = hash(`phase:${key}`) * Math.PI * 2, sway = (0.14 + hash(`sway:${key}`) * 0.12) * Math.min(1, length)
  const points = []
  for (let k = 0; k <= 9; k += 1) {
    const u = k / 9
    const r = 0.1 + (length - 0.1) * u
    // A buttress that rises from high on the trunk and settles onto the floor, snaking side to side as it goes.
    // ...and arching over the floor in a couple of low humps on the way out, so a root reads as a rope, not a flat blade, from a low camera.
    const humps = 0.08 + hash(`hump:${key}`) * 0.09
    const y = lift * Math.pow(1 - u, 2.4) + humps * Math.pow(Math.sin(u * Math.PI * (1.5 + hash(`hump-n:${key}`))), 2) * Math.min(1, u * 2.5) * (1 - u) * 1.6 + 0.006
    const lateral = sway * Math.sin(u * Math.PI * waves + phase) * Math.min(1, u * 3)
    const dx = Math.cos(heading), dz = Math.sin(heading)
    points.push([dx * r - dz * lateral, FLOOR_Y + y, (dz * r + dx * lateral) * 0.85])
  }
  // Rope-like: thick at the buttress, staying thick most of the way out and rounding off at the tip (not a spike).
  const radiusAt = t => girth * (0.35 + 0.65 * Math.pow(1 - t, 1.4)) * Math.sqrt(Math.max(0, 1 - Math.pow(t, 6))) + 0.005
  const rootPhase = phaseRamp(ROOT_TOP, 0)
  addTube(points, radiusAt, girth > 0.06 ? 9 : 7, 'roots', { amplitude: 0.1, seed: hash(`bark:${key}`) }, rootPhase, 28)
  // Every root carries a glowing seam along most of its length.
  addVeins(points.slice(0, 9), t => radiusAt(t * 8 / 9), key, 1, t => rootPhase(t * 8 / 9))
  for (let f = 0; f < forks; f += 1) {
    const forkT = 0.35 + (f / Math.max(1, forks)) * 0.45 + jitter(`${key}:fork:${f}`, 0.05)
    const sign = (f + (hash(key) > 0.5 ? 1 : 0)) % 2 === 0 ? 1 : -1
    const fork = curvePoint(points, forkT, sign, `${key}:${forkT}`)
    const side = new THREE.Vector3().crossVectors(fork.tangent, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(sign)
    const reachOut = 0.3 + hash(`${key}:fork-reach:${f}`) * 0.35
    const rootlet = [0, 0.25, 0.5, 0.75, 1].map(s => {
      const v = fork.at.clone().addScaledVector(fork.tangent, s * reachOut * 0.8).addScaledVector(side, s * reachOut * 0.6)
      return [v.x, Math.max(FLOOR_Y + 0.008, v.y - s * 0.05), v.z]
    })
    addTube(rootlet, t => Math.max(0.01, radiusAt(forkT) * 0.6) * (1 - 0.7 * t) + 0.003, 6, 'roots', null, phaseRamp(rootPhase(forkT), 0), 14)
  }
  return { points, rootPhase }
}
for (let index = 0; index < ROOT_COUNT; index += 1) {
  const key = `root:${index}`
  // Every fourth root is a short buttress off the trunk base; the rest are long thin tendrils.
  const buttress = index % 4 === 0
  const heading = (index / ROOT_COUNT) * Math.PI * 2 + jitter(`heading:${key}`, 0.12)
  const reach = buttress ? 0.75 + hash(`reach:${key}`) * 0.3 : 1.2 + hash(`reach:${key}`) * 0.8
  addRoot(key, heading, reach, buttress ? 0.1 : 0.05 + hash(`girth:${key}`) * 0.025, buttress ? 0.32 : 0.2, 2)
}

// The branches, a twisting strand on the inner branch, the tendrils and their leaves (right side, mirrored for the left).
for (const side of [1, -1]) {
  const flip = points => (side === 1 ? points : mirror(points))
  // The main limbs carry the weight; the branches through the openings are slender.
  const innerR = t => 0.012 + 0.045 * Math.pow(1 - t, 1.3)
  const outerR = t => 0.02 + 0.095 * Math.pow(1 - t, 1.2)
  const curves = { innerBranch: flip(innerBranch), outerBranch: flip(outerBranch), tendril: flip(tendril) }
  const phaseOf = { innerBranch: LIMB_PHASE, outerBranch: LIMB_PHASE, tendril: phaseRamp(TRUNK_TOP, 0.75) }
  addTube(curves.innerBranch, innerR, 10, 'roots', { amplitude: 0.1, seed: hash(`bark:inner:${side}`) }, LIMB_PHASE)
  addVeins(curves.innerBranch, innerR, `inner:${side}`, 2, LIMB_PHASE)
  addTube(curves.outerBranch, outerR, 10, 'roots', { amplitude: 0.1, seed: hash(`bark:outer:${side}`) }, LIMB_PHASE)
  addVeins(curves.outerBranch, outerR, `outer:${side}`, 2, LIMB_PHASE)
  // A thin strand twisting round the lower part of the inner branch, so it reads as grown from the braided trunk.
  const strand = veinControlPoints(curves.innerBranch, innerR, jitter(`strand:${side}`, Math.PI), 1.4 * side, 0.95, 16)
  addTube(strand.slice(0, 10), taper(0.032, 0.012), 8, 'roots', { amplitude: 0.08, seed: hash(`bark:strand:${side}`) }, t => LIMB_PHASE(t * 9 / 15))
  addTube(curves.tendril, taper(0.025, 0.008), 7, 'roots', null, phaseOf.tendril)
  // Twigs: short curling offshoots along both limbs, each carrying one or two leaves (the owner's model has leaves all along the limbs).
  for (const [name, t, bias] of twigSites) {
    const key = `twig:${name}:${t}:${side}`
    const hostR = name === 'innerBranch' ? innerR : outerR
    const { at, out, tangent } = curvePoint(curves[name], t, bias * side, key)
    const length = 0.16 + hash(`${key}:len`) * 0.1
    const up = new THREE.Vector3(0, 1, 0)
    const twig = [0, 0.33, 0.66, 1].map(u => {
      const v = at.clone().addScaledVector(out, u * length).addScaledVector(tangent, u * length * 0.35).addScaledVector(up, Math.sin(u * Math.PI) * 0.03)
      return [v.x, v.y, v.z]
    })
    const phase = phaseOf[name](t)
    addTube(twig, taper(Math.max(0.012, hostR(t) * 0.4), 0.005), 7, 'roots', null, () => phase, 12)
    const tip = new THREE.Vector3(...twig[3])
    addLeaf([tip.x, tip.y, tip.z], out.clone().addScaledVector(tangent, 0.3).normalize(), `${key}:tip`, phase)
    if (hash(`${key}:second`) > 0.4) {
      const mid = new THREE.Vector3(...twig[1])
      addLeaf([mid.x, mid.y, mid.z], out.clone().multiplyScalar(-1).addScaledVector(up, 0.6).normalize(), `${key}:mid`, phase)
    }
  }
  for (const [name, t, bias] of leafSites) {
    const key = `${name}:${t}:${side}`
    const { at, out } = curvePoint(curves[name], t, bias * side, key)
    addLeaf([at.x, at.y, at.z], out, key, phaseOf[name](t))
  }
}

// Ripple rings on the floor round the root flare (the mockup's rings of light on the wet floor; the model's platform edge): thin grooves lying
// half sunk in the floor. They take a little of the glow, starting at the root tips' phase, so a pulse leaves the tree as a ripple.
for (const [k, radius] of [1.6, 1.9].entries()) {
  const points = Array.from({ length: 97 }, (_, i) => {
    const a = (i / 96) * Math.PI * 2
    return [Math.cos(a) * radius, FLOOR_Y + 0.002, Math.sin(a) * radius * 0.92]
  })
  addTube(points, () => 0.012 - k * 0.002, 6, 'rings', null, () => 0, 192)
}

// ── PBR materials, one per part (Linear-sRGB). `roots` is a darker, rougher bark gold (metal, but rough enough to read as weathered);
// `leaves` a lighter, faintly self-lit gold; `veins` a bright, strongly emissive gold-orange standing in for the glowing crack pattern -
// it needs no external light to read, the way a real ember-lit crack would not. ─────────────────────────────────────────────────────────
const MATERIALS = {
  roots: { baseColorFactor: [0.78, 0.53, 0.2, 1], metallicFactor: 1, roughnessFactor: 0.22 },
  leaves: { baseColorFactor: [0.92, 0.72, 0.32, 1], metallicFactor: 0.85, roughnessFactor: 0.16, emissiveFactor: [0.16, 0.09, 0.015] },
  veins: { baseColorFactor: [1, 0.38, 0.08, 1], metallicFactor: 0.1, roughnessFactor: 0.25, emissiveFactor: [2.4, 0.85, 0.08] },
  rings: { baseColorFactor: [0.5, 0.34, 0.12, 1], metallicFactor: 1, roughnessFactor: 0.25 },
}

// One mesh per material (a draw call each) instead of one per curve.
const merged = Object.keys(MATERIALS).map(part => {
  const list = meshes.filter(mesh => mesh.part === part)
  const positions = [], normals = [], indices = [], phases = []
  for (const mesh of list) {
    const base = positions.length / 3
    positions.push(...mesh.positions); normals.push(...mesh.normals); phases.push(...mesh.phases)
    for (const index of mesh.indices) indices.push(base + index)
  }
  return { name: part, part, positions: new Float32Array(positions), normals: new Float32Array(normals), indices: Uint32Array.from(indices), phases: new Float32Array(phases) }
}).filter(mesh => mesh.indices.length > 0)
const { triangles, byteLength, parts } = writeGlb(outputPath, merged, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-golden-roots.mjs', 'golden-roots')
console.log(`Wrote ${outputPath}`)
console.log(`  ${meshes.length} meshes (${parts.join(', ')}), ${triangles} triangles, ${(byteLength / 1024).toFixed(0)} KB`)
console.log(`  floor Y ${FLOOR_Y}, trunk top y ${TRUNK_TOP_Y}`)
