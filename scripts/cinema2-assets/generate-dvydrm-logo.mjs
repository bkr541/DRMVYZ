// Generates the shared 3D DVYDRM logo used by Cinema 2.0 presets from the owner's master SVG.
//   node scripts/cinema2-assets/generate-dvydrm-logo.mjs [out.glb]      (default: public/cinema2/models/dvydrm-logo.glb)
//
// The model has two parts, matching the production logo (a smooth pearl-white cloud with a thin polished gold outline):
//   `outline`  the thin outer ring of the master SVG (path "outer-outline"): a bevelled extrusion with a polished gold PBR material.
//   `crystal`  the cloud body and the lower star (paths "cloud-body" and "lower-star"): a smooth, rounded "pillow" like the production
//              wordmark's letters, with a near-white PBR material. The outline is sampled finely, points are scattered inside it on a dense
//              grid and joined into a Delaunay triangulation, and each point is lifted by a quarter-ellipse of its distance from the edge, so
//              the surface rises steeply from the rim and rounds over into a gently domed top. Normals are smooth (averaged per point), so it
//              shades as one soft body, not as facets. Side walls and a flat back close the solid.
// The paths use the even-odd rule, so nesting decides which contours are holes. Gradients in the SVG are ignored: the colors are the PBR
// materials written below, and presets can tint or re-rough each part (three-scene per-part overrides `<part>.color`, `<part>.roughness`).
//
// The crystal also carries a custom per-vertex attribute `_FILM_THICKNESS` (0-1, a smooth drifting field): where a preset gives the crystal a
// thin-film iridescence, three-scene reads it to vary the film between `<part>.iridescenceThicknessMin` and `...Max`, so the pastels (ice blue,
// lavender, pink, peach) come in soft washes across the surface, as on the production wordmark. Without iridescence it is ignored.
//
// Coordinates: the logo is centred on the origin, 2 units wide, facing +Z, Y up.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertReliefStats,
  buildExtrusion,
  buildReliefShape,
  contoursOf as contoursOfPath,
  nestedShapes,
  pathData as pathDataOf,
} from './cinema2-svg-relief-kit.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const sourcePath = join(root, 'scripts/cinema2-assets/sources/dvydrm-logo-master.svg')
/**
 * `--faceted` builds the cut-crystal variant (RELIQUARY's clear crystal logo, used by no other preset) instead of the smooth pearl: a thick
 * glass ribbon like the owner's production mockup - a flat table on top, three flat cut bands round every edge (each band catches the light on
 * its own, so the edges sparkle) and straight side walls - with no separate outer ring (the mockup's crystal is the cloud itself). Written to
 * dvydrm-logo-faceted.glb unless an output path is given.
 */
const FACETED = process.argv.includes('--faceted')
const outputArgument = process.argv.slice(2).find(argument => !argument.startsWith('--'))
const outputPath = outputArgument ? resolve(outputArgument) : join(root, FACETED ? 'public/cinema2/models/dvydrm-logo-faceted.glb' : 'public/cinema2/models/dvydrm-logo.glb')
/**
 * The cut crystal (with --faceted): `depth` of the straight side wall, `bevel` how far the cut bands reach in from the edge (and down from the
 * table), in `bands` flat steps. The crease angle is below one band's turn, so every band shades flat and keeps a crisp edge.
 */
const CUT = { depth: 0.05, bevel: 0.045, bands: 4, creaseAngle: (15 * Math.PI) / 180 }

const WIDTH_UNITS = 2
const SAMPLES_PER_CURVE = 3
/**
 * The crystal is smooth-shaded along its length, so its contours are sampled much more finely than the ring's or the rounded edge would show
 * kinks (the cut crystal a little less finely: its flat bands hide small kinks, and its extruded bevel multiplies every sample).
 */
const CRYSTAL_SAMPLES_PER_CURVE = FACETED ? 10 : 16
const CREASE_ANGLE = (38 * Math.PI) / 180

/** The gold ring: extrusion depth (world units at 2 units wide) and bevel. */
const OUTLINE = { depth: 0.06, bevel: 0.008 }
/**
 * The crystal. z runs from `backZ` (the flat back) to `edgeZ` (the rim of the top surface). The top rises from the rim along a quarter
 * ellipse `bevel` wide and `height` tall (vertical at the rim, so it rounds straight into the side wall), then keeps rising by `dome` over
 * the next `domeReach` so the middle of a ribbon is softly domed rather than flat.
 */
const CRYSTAL = {
  backZ: -0.03,
  edgeZ: 0.004,
  bevel: 0.045,
  height: 0.03,
  dome: 0.008,
  domeReach: 0.08,
  boundarySpacing: 0.01,
  interiorSpacing: 0.016,
  /** A turn sharper than this at a sampled point is a real corner (kept exactly, and the wall stays creased there). */
  cornerAngle: (50 * Math.PI) / 180,
}
/** Film thickness (0-1): a broad drifting field so the pastels come in soft washes across the logo. The back takes the middle value. */
const FILM = { patchScale: 2.6, patchAmount: 0.45, side: 0.5 }
/** Small shapes (the star) need a finer mesh. */
const SMALL_SHAPE_AREA = 0.02

/** Linear-sRGB PBR colors, both baked neutral near-white; presets choose the finish per part (three-scene per-part overrides). */
const MATERIALS = {
  // Baked neutral/near-white, same as the crystal: every preset tints it via its own Design control (GO-TO defaults it to gold; RELIQUARY
  // leaves it white so the outline reads as one uniform crystal with the body, no separate gold ring).
  outline: { name: 'outline', baseColorFactor: [0.97, 0.97, 0.98, 1], metallicFactor: 1, roughnessFactor: 0.15 },
  crystal: { name: 'crystal', baseColorFactor: [0.97, 0.97, 0.98, 1], metallicFactor: 1, roughnessFactor: 0.05 },
}

const svg = readFileSync(sourcePath, 'utf8')

const pathData = id => pathDataOf(svg, id)
const contoursOf = (d, samplesPerCurve = SAMPLES_PER_CURVE) => contoursOfPath(d, samplesPerCurve)

const outlineContours = contoursOf(pathData('outer-outline'))
const bodyContours = contoursOf(pathData('cloud-body'), CRYSTAL_SAMPLES_PER_CURVE)
const starContours = contoursOf(pathData('lower-star'), CRYSTAL_SAMPLES_PER_CURVE)

// One shared transform for all parts so their relative placement is exactly the SVG's.
const all = [...outlineContours, ...bodyContours, ...starContours].flat()
const minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0]))
const minY = Math.min(...all.map(p => p[1])), maxY = Math.max(...all.map(p => p[1]))
const scale = WIDTH_UNITS / (maxX - minX)
const toWorldPoint = ([x, y]) => [(x - (minX + maxX) / 2) * scale, -(y - (minY + maxY) / 2) * scale]
const toWorld = contour => contour.map(toWorldPoint)

// ── Gold outline: a bevelled extrusion ───────────────────────────────────────
const buildOutline = () => buildExtrusion(nestedShapes(outlineContours, toWorld), { depth: OUTLINE.depth, bevel: OUTLINE.bevel, creaseAngle: CREASE_ANGLE })

// ── Crystal: a smooth rounded relief (or cut crystal with --faceted) ─────────
function surfaceFilm(x, y) {
  const u = x * FILM.patchScale, v = y * FILM.patchScale
  const patch = (Math.sin(u * 1.7 + v * 0.6 + 0.4) + Math.sin(u * -0.8 + v * 2.1 + 2.3) + Math.sin(u * 2.9 - v * 1.3 + 4.1) * 0.5) / 2.5
  return Math.min(1, Math.max(0, 0.5 + patch * FILM.patchAmount))
}

/** The cut-crystal ribbon (with --faceted): a bevelled extrusion whose bevel is cut into flat bands. */
function buildCutCrystal() {
  const shapes = [...nestedShapes(bodyContours, toWorld), ...nestedShapes(starContours, toWorld)]
  const mesh = buildExtrusion(shapes, { depth: CUT.depth, bevel: CUT.bevel, creaseAngle: CUT.creaseAngle, bevelSegments: CUT.bands })
  const films = new Float32Array(mesh.positions.length / 3)
  for (let i = 0; i < films.length; i += 1) films[i] = surfaceFilm(mesh.positions[i * 3], mesh.positions[i * 3 + 1])
  return { ...mesh, films, stats: [] }
}

function buildCrystal() {
  const out = { positions: [], normals: [], films: [], indices: [], stats: [] }
  const options = { relief: CRYSTAL, faceted: FACETED ? FACETS : null, film: surfaceFilm, filmSide: FILM.side, smallShapeArea: SMALL_SHAPE_AREA }
  for (const shape of [...nestedShapes(bodyContours, toWorld), ...nestedShapes(starContours, toWorld)]) buildReliefShape(shape, out, options)
  assertReliefStats(out.stats, 'crystal')
  return { positions: new Float32Array(out.positions), normals: new Float32Array(out.normals), films: new Float32Array(out.films), indices: Uint32Array.from(out.indices), stats: out.stats }
}

const meshes = FACETED
  ? [{ name: 'crystal', material: MATERIALS.crystal, ...buildCutCrystal() }]
  : [
      { name: 'outline', material: MATERIALS.outline, ...buildOutline() },
      { name: 'crystal', material: MATERIALS.crystal, ...buildCrystal() },
    ]

// ── Binary glTF ──────────────────────────────────────────────────────────────
const binaryChunks = []
let byteLength = 0
const bufferViews = []
const accessors = []
const gltfMeshes = []
const nodes = []
const materials = []

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
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < mesh.positions.length / 3; i += 1) for (let k = 0; k < 3; k += 1) {
    const value = mesh.positions[i * 3 + k]
    min[k] = Math.min(min[k], value); max[k] = Math.max(max[k], value)
  }
  accessors.push({ bufferView: pushView(mesh.positions, 34962), componentType: 5126, count: mesh.positions.length / 3, type: 'VEC3', min, max })
  const positionAccessor = accessors.length - 1
  accessors.push({ bufferView: pushView(mesh.normals, 34962), componentType: 5126, count: mesh.normals.length / 3, type: 'VEC3' })
  const normalAccessor = accessors.length - 1
  const extra = {}
  if (mesh.films) {
    accessors.push({ bufferView: pushView(mesh.films, 34962), componentType: 5126, count: mesh.films.length, type: 'SCALAR' })
    extra._FILM_THICKNESS = accessors.length - 1
  }
  accessors.push({ bufferView: pushView(mesh.indices, 34963), componentType: 5125, count: mesh.indices.length, type: 'SCALAR' })
  const indexAccessor = accessors.length - 1
  const { name, ...pbr } = mesh.material
  materials.push({ name, pbrMetallicRoughness: pbr })
  gltfMeshes.push({ name: mesh.name, primitives: [{ attributes: { POSITION: positionAccessor, NORMAL: normalAccessor, ...extra }, indices: indexAccessor, material: materials.length - 1, mode: 4 }] })
  nodes.push({ name: mesh.name, mesh: gltfMeshes.length - 1 })
  triangles += mesh.indices.length / 3
}

const json = {
  asset: { version: '2.0', generator: 'DRMVYZ scripts/cinema2-assets/generate-dvydrm-logo.mjs' },
  scene: 0,
  scenes: [{ name: 'dvydrm-logo', nodes: nodes.map((_, i) => i) }],
  nodes, meshes: gltfMeshes, materials, accessors, bufferViews,
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
for (const mesh of meshes) console.log(`  ${mesh.name}: ${mesh.indices.length / 3} triangles, ${mesh.positions.length / 3} vertices`)
for (const stat of meshes.at(-1).stats) console.log(`  crystal shape${stat.small ? ' (small)' : ''}: ${stat.points} points, ${stat.facets} facets, area ${(stat.areaRatio * 100).toFixed(2)}%`)
console.log(`  total ${triangles} triangles, logo ${WIDTH_UNITS} x ${(((maxY - minY) * scale)).toFixed(3)} units, ${(byteLength / 1024).toFixed(0)} KB`)
