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
const FLOOR_Y = -1.55

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
const meshes = []
let curveIndex = 0
function addTube(points, radiusAt, radialSegments, part, bark = null, phaseAt = () => 0) {
  const { positions, normals, indices, phases } = buildTaperedTube(points, { radiusAt, radialSegments, bark, phaseAt })
  meshes.push({ name: `${part}-${curveIndex++}`, part, positions, normals, indices, phases })
}
/** A vein's own thickness is a thin fraction of the HOST branch's local radius (sweeping it at the host's full radius buries it inside the
 * branch), with a floor so it stays visible near a tapered tip. `offsetFactor` (close to 1) places it just proud of the branch surface. */
function addVein(points, hostRadiusAt, part, baseAngle, driftTurns, phaseAt, offsetFactor = 1.04) {
  const veinRadiusAt = t => Math.max(0.008, hostRadiusAt(t) * 0.14)
  addTube(veinControlPoints(points, hostRadiusAt, baseAngle, driftTurns, offsetFactor), veinRadiusAt, 6, part, null, phaseAt)
}
/** A curling stem from `start` heading along `out`, bending over as it goes, with a teardrop leaf at its tip. */
function addLeaf(start, out, key, phase) {
  const up = new THREE.Vector3(0, 1, 0)
  const length = 0.09 + hash(`stem:${key}`) * 0.05
  const droop = new THREE.Vector3().copy(out).multiplyScalar(0.55).addScaledVector(up, -0.45).normalize()
  const curl = new THREE.Vector3().crossVectors(out, up).normalize().multiplyScalar(jitter(`curl:${key}`, 0.35))
  const p0 = new THREE.Vector3(...start)
  const p1 = p0.clone().addScaledVector(out, length * 0.45).addScaledVector(up, length * 0.2)
  const p2 = p1.clone().addScaledVector(out, length * 0.35).add(curl.clone().multiplyScalar(length))
  const p3 = p2.clone().addScaledVector(droop, length * 0.35)
  const stem = [p0, p1, p2, p3].map(v => [v.x, v.y, v.z])
  addTube(stem, taper(0.012, 0.005), 6, 'leaves', null, () => phase)
  const along = new THREE.Vector3().subVectors(p3, p2).normalize()
  const leaf = buildLeaf(p3, along, 0.12 + hash(`leaf:${key}`) * 0.04, jitter(`leaf-twist:${key}`, 0.5))
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

// The trunk: four twisting strands (not mirrored: a mirrored helix would untwist), each with a vein.
const trunkR = taper(0.11, 0.09)
/** Glow phase: root tips 0 -> trunk base ROOT_TOP -> trunk top TRUNK_TOP -> limb tips 1. */
const ROOT_TOP = 0.28, TRUNK_TOP = 0.6
const TRUNK_PHASE = phaseRamp(ROOT_TOP, TRUNK_TOP)
const LIMB_PHASE = phaseRamp(TRUNK_TOP, 1)
for (let index = 0; index < 4; index += 1) {
  const strand = trunkStrand(index)
  addTube(strand, trunkR, 11, 'roots', { amplitude: 0.1, seed: hash(`bark:trunk:${index}`) }, TRUNK_PHASE)
  addVein(strand, trunkR, 'veins', jitter(`vein:trunk:${index}`, Math.PI), 0.4, TRUNK_PHASE)
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
  const rootPhase = phaseRamp(ROOT_TOP, 0)
  addTube(points, radiusAt, 10, 'roots', { amplitude: 0.12, seed: hash(`bark:${key}`) }, rootPhase)
  for (const [forkT, sign] of [[0.45, index % 2 === 0 ? 1 : -1], [0.72, index % 2 === 0 ? -1 : 1]]) {
    const fork = curvePoint(points, forkT, sign, `${key}:${forkT}`)
    const side = new THREE.Vector3().crossVectors(fork.tangent, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(sign)
    const rootlet = [0, 0.1, 0.2, 0.28].map(s => {
      const v = fork.at.clone().addScaledVector(fork.tangent, s * 0.7).addScaledVector(side, s * 0.8)
      return [v.x, Math.max(FLOOR_Y + 0.01, v.y - s * 0.08), v.z]
    })
    addTube(rootlet, taper(0.026, 0.007), 7, 'roots', null, phaseRamp(rootPhase(forkT), 0))
  }
  if (index % 3 === 0) addLeaf([points[1][0], points[1][1] + 0.04, points[1][2]], new THREE.Vector3(Math.cos(heading), 0.5, Math.sin(heading)).normalize(), `base-leaf:${index}`, rootPhase(1 / 7))
}

// The two limbs, their intertwined strands, vines, inner branches and leaves (right side, mirrored for the left).
for (const side of [1, -1]) {
  const flip = points => (side === 1 ? points : mirror(points))
  const limbR = taper(0.13, 0.026)
  const curves = { limb: flip(limb), vine: flip(vine), innerBranch: flip(innerBranch) }
  addTube(curves.limb, limbR, 11, 'roots', { amplitude: 0.1, seed: hash(`bark:limb:${side}`) }, LIMB_PHASE)
  addVein(curves.limb, limbR, 'veins', jitter(`vein:limb:${side}`, Math.PI), 0.9, LIMB_PHASE)
  // A thinner strand twisting round the limb, so it reads as several strands like the trunk.
  const strand = veinControlPoints(curves.limb, limbR, jitter(`strand:${side}`, Math.PI), 1.6 * side, 0.95, 16)
  addTube(strand.slice(0, 13), taper(0.06, 0.018), 9, 'roots', { amplitude: 0.1, seed: hash(`bark:strand:${side}`) }, t => LIMB_PHASE(t * 12 / 15))
  // The vine leaves the limb about 62% along it and the inner branch about 20% along: each picks up the limb's phase there.
  const phaseOf = { limb: LIMB_PHASE, vine: phaseRamp(LIMB_PHASE(0.62), 1.05), innerBranch: phaseRamp(LIMB_PHASE(0.2), 0.8) }
  addTube(curves.vine, taper(0.03, 0.011), 8, 'roots', { amplitude: 0.08, seed: hash(`bark:vine:${side}`) }, phaseOf.vine)
  addTube(curves.innerBranch, taper(0.04, 0.014), 8, 'roots', { amplitude: 0.08, seed: hash(`bark:inner:${side}`) }, phaseOf.innerBranch)
  for (const [name, t, bias] of leafSites) {
    const key = `${name}:${t}:${side}`
    const { at, out } = curvePoint(curves[name], t, bias * side, key)
    addLeaf([at.x, at.y, at.z], out, key, phaseOf[name](t))
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

const { triangles, byteLength, parts } = writeGlb(outputPath, meshes, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-golden-roots.mjs', 'golden-roots')
console.log(`Wrote ${outputPath}`)
console.log(`  ${meshes.length} meshes (${parts.join(', ')}), ${triangles} triangles, ${(byteLength / 1024).toFixed(0)} KB`)
console.log(`  floor Y ${FLOOR_Y}, trunk top y ${TRUNK_TOP_Y}`)
