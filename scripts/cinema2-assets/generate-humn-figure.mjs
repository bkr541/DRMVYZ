// Generates the HUM:N figure for Cinema 2.0 from the CC0 MakeHuman base mesh.
//   node scripts/cinema2-assets/generate-humn-figure.mjs [out.ts]
//   (default: src/components/vyzualz/cinema2/modules/humn/Cinema2HumNFigure.generated.ts)
//
// HUM:N is drawn as a faceted low-poly human: big flat triangles, a glowing wireframe, a few filled facets. The references are a real human
// likeness (brow, nose, lips, ears, collarbones, articulated fingers), which a code-built figure cannot reach, so the shape comes from the
// MakeHuman hm08 base mesh and its default skin weights (sources/makehuman, CC0). This script:
//   1. keeps the body surface (no helper geometry) above the legs, in metres, placed so the neck sits where the old figure's did;
//   2. folds MakeHuman's 163-bone skeleton onto HUM:N's 44 bones (face muscles into the head, metacarpals into the hand, legs into the root)
//      and keeps each vertex's two strongest bones, which is the skin the HUM:N renderer takes;
//   3. reduces the mesh to large facets with meshoptimizer. Before reducing, the head and the hands are temporarily scaled up about their
//      joints (blended by skin weight, so the warp is smooth), which makes the simplifier spend proportionally more triangles on the face and
//      fingers: the nose, lips, ears and each finger survive while the torso breaks into the big panels of the references;
//   4. writes the result as a small TypeScript data module (base64 arrays), so the figure needs no runtime asset loading.
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MeshoptSimplifier } from 'meshoptimizer'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const sources = join(root, 'scripts/cinema2-assets/sources/makehuman')
const outputPath = process.argv[2]
  ? resolve(process.argv[2])
  : join(root, 'src/components/vyzualz/cinema2/modules/humn/Cinema2HumNFigure.generated.ts')

const read = name => gunzipSync(readFileSync(join(sources, `${name}.gz`))).toString('utf8')

// ── Sources ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const UNIT = 0.1 // MakeHuman works in decimetres.
const obj = read('base.obj')
const skeleton = JSON.parse(read('default.mhskel'))
const weightFile = JSON.parse(read('default_weights.mhw'))

const positions = []
const facesByGroup = new Map()
let group = ''
for (const line of obj.split('\n')) {
  if (line.startsWith('v ')) positions.push(line.trim().split(/\s+/).slice(1, 4).map(Number))
  else if (line.startsWith('g ')) group = line.slice(2).trim()
  else if (line.startsWith('f ')) {
    const face = line.trim().split(/\s+/).slice(1).map(token => parseInt(token, 10) - 1)
    if (!facesByGroup.has(group)) facesByGroup.set(group, [])
    facesByGroup.get(group).push(face)
  }
}

const jointPosition = name => {
  const ids = skeleton.joints[name]
  if (!ids) throw new Error(`MakeHuman joint ${name} is missing`)
  const p = [0, 0, 0]
  for (const id of ids) for (let k = 0; k < 3; k += 1) p[k] += positions[id][k] / ids.length
  return p
}

// ── HUM:N bones ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Indices 0-9 keep the old figure's bones (and their meaning) so the rig and tests keep their names. "Left" is the viewer's left (-X), which
// is MakeHuman's ".R" side (MakeHuman's character faces +Z with its own left at +X).
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']
const bones = [
  { name: 'root', mh: 'root', parent: null },
  { name: 'spine', mh: 'spine04', parent: 'root' },
  { name: 'neck', mh: 'neck01', parent: 'chest' },
  { name: 'head', mh: 'head', parent: 'neck' },
  { name: 'leftUpperArm', mh: 'upperarm01.R', parent: 'leftClavicle' },
  { name: 'leftForearm', mh: 'lowerarm01.R', parent: 'leftUpperArm' },
  { name: 'leftHand', mh: 'wrist.R', parent: 'leftForearm' },
  { name: 'rightUpperArm', mh: 'upperarm01.L', parent: 'rightClavicle' },
  { name: 'rightForearm', mh: 'lowerarm01.L', parent: 'rightUpperArm' },
  { name: 'rightHand', mh: 'wrist.L', parent: 'rightForearm' },
  { name: 'chest', mh: 'spine02', parent: 'spine' },
  { name: 'jaw', mh: 'jaw', parent: 'head' },
  { name: 'leftClavicle', mh: 'clavicle.R', parent: 'chest' },
  { name: 'rightClavicle', mh: 'clavicle.L', parent: 'chest' },
]
for (const [side, mhSide] of [['left', 'R'], ['right', 'L']]) {
  FINGERS.forEach((finger, fingerIndex) => {
    for (let joint = 1; joint <= 3; joint += 1) {
      bones.push({
        name: `${side}${finger}${joint}`,
        mh: `finger${fingerIndex + 1}-${joint}.${mhSide}`,
        parent: joint === 1 ? `${side}Hand` : `${side}${finger}${joint - 1}`,
      })
    }
  })
}
const boneIndex = new Map(bones.map((bone, index) => [bone.name, index]))
const humnBoneOfMh = new Map(bones.map(bone => [bone.mh, boneIndex.get(bone.name)]))
// MakeHuman bones with no HUM:N bone of their own fold into their nearest mapped ancestor, except these, which are placed explicitly.
for (const [mh, humn] of [
  ['spine05', 'root'], ['pelvis.L', 'root'], ['pelvis.R', 'root'],
  ['spine03', 'spine'], ['spine01', 'chest'], ['breast.L', 'chest'], ['breast.R', 'chest'],
  ['neck02', 'neck'], ['neck03', 'neck'],
  ['shoulder01.R', 'leftClavicle'], ['shoulder01.L', 'rightClavicle'],
  ['upperarm02.R', 'leftUpperArm'], ['upperarm02.L', 'rightUpperArm'],
  ['lowerarm02.R', 'leftForearm'], ['lowerarm02.L', 'rightForearm'],
]) humnBoneOfMh.set(mh, boneIndex.get(humn))
const resolveBone = mh => {
  let current = mh
  while (current != null) {
    if (humnBoneOfMh.has(current)) return humnBoneOfMh.get(current)
    current = skeleton.bones[current]?.parent ?? null
  }
  return boneIndex.get('root')
}
const isLegBone = mh => /upperleg|lowerleg|foot|toe/.test(mh)
// The figure is cut straight across just above the hips (MakeHuman y, decimetres), below where the references are framed.
const CUT_Y = 1.0

// Placement: metres, the neck joint at y 0.545 on the centre line (where the old figure's neck sat, so the preset's camera still frames it).
const neckMh = jointPosition('neck01____head')
const place = p => [(p[0] - 0) * UNIT, (p[1] - neckMh[1]) * UNIT + 0.545, (p[2] - neckMh[2]) * UNIT]

const pivots = bones.map(bone => place(jointPosition(`${bone.mh}____head`)))
const parents = bones.map(bone => (bone.parent == null ? -1 : boneIndex.get(bone.parent)))

// ── Skin ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const vertexCount = positions.length
const accumulated = Array.from({ length: vertexCount }, () => new Map())
const strongestMh = new Array(vertexCount).fill(null)
const strongestMhWeight = new Float32Array(vertexCount)
for (const [mh, entries] of Object.entries(weightFile.weights)) {
  const humn = resolveBone(mh)
  for (const [vertex, weight] of entries) {
    const bucket = accumulated[vertex]
    bucket.set(humn, (bucket.get(humn) ?? 0) + weight)
    if (weight > strongestMhWeight[vertex]) {
      strongestMhWeight[vertex] = weight
      strongestMh[vertex] = mh
    }
  }
}
const skinOf = vertex => {
  const ranked = [...accumulated[vertex].entries()].sort((a, b) => b[1] - a[1])
  if (ranked.length === 0) return { a: 0, b: 0, w: 0 }
  if (ranked.length === 1) return { a: ranked[0][0], b: ranked[0][0], w: 0 }
  const [first, second] = ranked
  return { a: first[0], b: second[0], w: second[1] / (first[1] + second[1]) }
}
const regionWeight = (vertex, names) => {
  let total = 0
  let share = 0
  for (const [bone, weight] of accumulated[vertex]) {
    total += weight
    if (names.has(bone)) share += weight
  }
  return total > 0 ? share / total : 0
}

// ── Body surface above the legs ──────────────────────────────────────────────────────────────────────────────────────────────────────
const triangles = []
for (const face of facesByGroup.get('body')) {
  if (face.some(vertex => strongestMh[vertex] && isLegBone(strongestMh[vertex]))) continue
  if (face.reduce((sum, vertex) => sum + positions[vertex][1], 0) / face.length < CUT_Y) continue
  if (face.length === 3) triangles.push(face)
  else {
    // Split each quad along its shorter diagonal.
    const [a, b, c, d] = face
    const dist = (i, j) => Math.hypot(...positions[i].map((value, k) => value - positions[j][k]))
    if (dist(a, c) <= dist(b, d)) triangles.push([a, b, c], [a, c, d])
    else triangles.push([a, b, d], [b, c, d])
  }
}
const used = [...new Set(triangles.flat())].sort((a, b) => a - b)
const local = new Map(used.map((vertex, index) => [vertex, index]))
const placed = new Float32Array(used.length * 3)
used.forEach((vertex, index) => placed.set(place(positions[vertex]), index * 3))
const indices = new Uint32Array(triangles.flat().map(vertex => local.get(vertex)))

// Detail warp: the head and hands are enlarged about their joints (blended by skin weight) for the simplifier only.
const headBones = new Set(['head', 'jaw'].map(name => boneIndex.get(name)))
const handBones = side => new Set(bones.map((bone, index) => [bone, index]).filter(([bone]) => bone.name.startsWith(side) && (bone.name.endsWith('Hand') || FINGERS.some(finger => bone.name.startsWith(`${side}${finger}`)))).map(([, index]) => index))
const warpRegions = [
  { bones: headBones, center: pivots[boneIndex.get('head')], scale: 1.8 },
  { bones: handBones('left'), center: pivots[boneIndex.get('leftHand')], scale: 2.6 },
  { bones: handBones('right'), center: pivots[boneIndex.get('rightHand')], scale: 2.6 },
]
const warped = new Float32Array(placed)
used.forEach((vertex, index) => {
  for (const region of warpRegions) {
    const weight = regionWeight(vertex, region.bones)
    if (weight <= 0) continue
    for (let k = 0; k < 3; k += 1) warped[index * 3 + k] += (region.scale - 1) * weight * (placed[index * 3 + k] - region.center[k])
  }
})

// ── Eyes ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Flat discs sitting in the sockets, drawn as concentric rings by the renderer. Built from MakeHuman's eyeball helpers.
const eyes = [['left', 'helper-r-eye'], ['right', 'helper-l-eye']].map(([side, helper]) => {
  const ids = [...new Set(facesByGroup.get(helper).flat())]
  const pts = ids.map(id => place(positions[id]))
  const center = [0, 1, 2].map(k => pts.reduce((sum, p) => sum + p[k], 0) / pts.length)
  const radius = Math.max(...pts.map(p => Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2])))
  return { side, center: [center[0], center[1], center[2] + radius * 0.86], radius: radius * 0.62 }
})

// ── Reduce ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
await MeshoptSimplifier.ready
const TARGETS = { 1: 2600, 2: 6200 }
const densities = {}
for (const [density, targetTriangles] of Object.entries(TARGETS)) {
  const [reduced] = MeshoptSimplifier.simplify(indices, warped, 3, targetTriangles * 3, 1, ['Regularize'])
  const keep = [...new Set(reduced)].sort((a, b) => a - b)
  const remap = new Map(keep.map((vertex, index) => [vertex, index]))
  const outPositions = new Float32Array(keep.length * 3)
  const outSkin = new Uint8Array(keep.length * 3)
  keep.forEach((vertex, index) => {
    outPositions.set(placed.subarray(vertex * 3, vertex * 3 + 3), index * 3)
    const skin = skinOf(used[vertex])
    outSkin.set([skin.a, skin.b, Math.round(skin.w * 255)], index * 3)
  })
  const outIndices = new Uint16Array(Array.from(reduced, vertex => remap.get(vertex)))
  densities[density] = { positions: outPositions, skin: outSkin, indices: outIndices }
  console.log(`density ${density}: ${outIndices.length / 3} triangles, ${keep.length} vertices`)
}

// ── Write ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const b64 = typed => Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength).toString('base64')
const round = value => Math.round(value * 10000) / 10000
const vec = p => `[${p.map(round).join(', ')}]`
const source = `// Generated by scripts/cinema2-assets/generate-humn-figure.mjs. Do not edit by hand.
// Source: the MakeHuman hm08 base mesh, default skeleton and default skin weights (CC0; Data Collection AB, Joel Palmius, Jonas Hauquier).
// See scripts/cinema2-assets/sources/makehuman/README.md.

export const CINEMA2_HUMN_FIGURE_BONE_NAMES = Object.freeze(${JSON.stringify(bones.map(bone => bone.name))} as const)

/** Parent bone per bone (-1 for the root). */
export const CINEMA2_HUMN_FIGURE_BONE_PARENTS: readonly number[] = Object.freeze(${JSON.stringify(parents)})

/** Bind-pose joint positions in metres, +Y up, the figure facing +Z. */
export const CINEMA2_HUMN_FIGURE_BONE_PIVOTS: readonly (readonly [number, number, number])[] = Object.freeze([
${pivots.map(p => `  ${vec(p)},`).join('\n')}
])

/** Eye discs: centre and radius in metres, facing +Z. */
export const CINEMA2_HUMN_FIGURE_EYES = Object.freeze([
${eyes.map(eye => `  Object.freeze({ side: '${eye.side}' as const, center: ${vec(eye.center)} as readonly [number, number, number], radius: ${round(eye.radius)} }),`).join('\n')}
])

/**
 * The reduced surface per density, base64-encoded little-endian arrays: positions (float32 xyz per vertex), skin (uint8 bone A, bone B,
 * weight of B x 255 per vertex) and indices (uint16, three per triangle).
 */
export const CINEMA2_HUMN_FIGURE_DENSITIES = Object.freeze({
${Object.entries(densities).map(([density, data]) => `  ${density}: Object.freeze({
    positions: '${b64(data.positions)}',
    skin: '${b64(data.skin)}',
    indices: '${b64(data.indices)}',
  }),`).join('\n')}
})
`
writeFileSync(outputPath, source)
console.log(`wrote ${outputPath} (${(source.length / 1024).toFixed(0)} KB), ${bones.length} bones`)
