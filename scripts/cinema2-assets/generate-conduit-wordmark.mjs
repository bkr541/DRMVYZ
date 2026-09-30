// Generates CONDUIT's 3D DVYDRM wordmark from the owner's master SVG.
//   node scripts/cinema2-assets/generate-conduit-wordmark.mjs [out.glb]      (default: public/cinema2/models/conduit-wordmark.glb)
//
// Parts (materials):
//   `outline`  the chrome outline ring (path "outer-outline-ring", even-odd), a bevelled extrusion.
//   `letters`  every body path - the letters, the lower sweeps and the four-point star - as the smooth rounded "pillow" relief of the shared
//              SVG-relief kit (the same relief as GO-TO's logo), glossy pearl white.
//   `plate`    a dark silver back plate filling the inside of the ring, behind the letters.
//   `rim`      thin emissive bands lying on the plate round every edge of the letters and along the ring's inner edge: the amber light that
//              hugs the letters in the owner's mockups. CONDUIT drives its brightness from the music and from energy arriving through the tubes.
//
// Every vertex carries `_GLOW_PHASE` (rim 1, others 0) and `_SEGMENT` (group, along, side, random - see docs/cinema2-conduit-plan.md), so the
// rim takes part in the per-segment lighting like the tubes and the wall.
//
// World coordinates shared by all CONDUIT assets: floor at y = 0, +Y up, +Z toward the camera. The wordmark is 4.23 units wide, centred on
// (0, 2.09, 0), facing +Z. The generator also prints the four tube attachment points on the ring (used by generate-conduit-tubes.mjs).
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertReliefStats,
  buildExtrusion,
  buildReliefShape,
  contains,
  contoursOf,
  isInside,
  nestedShapes,
  pathData,
  resampleLoop,
} from './cinema2-svg-relief-kit.mjs'
import { writeGlb } from './cinema2-tube-kit.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const svg = readFileSync(join(root, 'scripts/cinema2-assets/sources/dvydrm-wordmark-master.svg'), 'utf8')
const outputPath = process.argv[2] ? resolve(process.argv[2]) : join(root, 'public/cinema2/models/conduit-wordmark.glb')

export const CONDUIT_WORDMARK = Object.freeze({ width: 4.23, centre: Object.freeze([0, 2.09, 0]) })
const BODY_PATHS = ['left-primary-body', 'central-interlock-body', 'left-inner-body', 'right-primary-body', 'right-interlock-and-sweep', 'left-lower-sweep', 'center-lower-sweep', 'four-point-symbol']

const RING_SAMPLES_PER_CURVE = 4
const BODY_SAMPLES_PER_CURVE = 16
const CREASE_ANGLE = (38 * Math.PI) / 180
/** Chrome ring: a proud frame round the letters. The ring is only ~0.025 wide in places, so the bevel (which eats in from both edges) stays small. */
const OUTLINE = { depth: 0.12, bevel: 0.005 }
/** Letters: GO-TO's relief scaled to a 4.23-unit-wide mark. Their top rises a little above the ring's face. */
const LETTERS = {
  backZ: -0.06,
  edgeZ: 0.01,
  bevel: 0.09,
  height: 0.07,
  dome: 0.016,
  domeReach: 0.17,
  boundarySpacing: 0.02,
  interiorSpacing: 0.034,
  cornerAngle: (50 * Math.PI) / 180,
}
/** Back plate behind the letters, and the glowing bands lying on it (width = how far the glow reaches out from an edge). */
const PLATE = { back: -0.09, depth: 0.02 }
const RIM = { back: -0.072, depth: 0.018, width: 0.03, spacing: 0.022 }

const MATERIALS = {
  outline: { baseColorFactor: [0.92, 0.92, 0.94, 1], metallicFactor: 1, roughnessFactor: 0.14 },
  letters: { baseColorFactor: [0.95, 0.94, 0.92, 1], metallicFactor: 0.35, roughnessFactor: 0.22 },
  plate: { baseColorFactor: [0.34, 0.34, 0.36, 1], metallicFactor: 0.9, roughnessFactor: 0.3 },
  rim: { baseColorFactor: [1, 0.62, 0.28, 1], metallicFactor: 0, roughnessFactor: 0.5, emissiveFactor: [1, 0.55, 0.2] },
}

// One transform for every part so their placement is exactly the SVG's.
const ringContours = contoursOf(pathData(svg, 'outer-outline-ring'), RING_SAMPLES_PER_CURVE)
const bodyContours = BODY_PATHS.map(id => contoursOf(pathData(svg, id), BODY_SAMPLES_PER_CURVE))
const all = [...ringContours, ...bodyContours.flat()].flat()
const minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0]))
const minY = Math.min(...all.map(p => p[1])), maxY = Math.max(...all.map(p => p[1]))
const scale = CONDUIT_WORDMARK.width / (maxX - minX)
const toWorldPoint = ([x, y]) => [(x - (minX + maxX) / 2) * scale, -(y - (minY + maxY) / 2) * scale]
const toWorld = contour => contour.map(toWorldPoint)

function translated(mesh, dx, dy, dz) {
  for (let i = 0; i < mesh.positions.length; i += 3) { mesh.positions[i] += dx; mesh.positions[i + 1] += dy; mesh.positions[i + 2] += dz }
  return mesh
}

function withGlow(mesh, phase, segment) {
  const count = mesh.positions.length / 3
  const segments = new Float32Array(count * 4)
  for (let i = 0; i < count; i += 1) segments.set(segment(mesh.positions[i * 3], mesh.positions[i * 3 + 1]), i * 4)
  return { ...mesh, phases: new Float32Array(count).fill(phase), attributes: { _SEGMENT: { array: segments, type: 'VEC4' } } }
}

// ── Ring ─────────────────────────────────────────────────────────────────────
const ringShapes = nestedShapes(ringContours, toWorld)
const outline = buildExtrusion(ringShapes, { depth: OUTLINE.depth, bevel: OUTLINE.bevel, creaseAngle: CREASE_ANGLE })

// ── Letters ──────────────────────────────────────────────────────────────────
const letterOut = { positions: [], normals: [], films: [], indices: [], stats: [] }
// The body paths never overlap (checked below), so each is its own relief.
for (const contours of bodyContours) {
  for (const shape of nestedShapes(contours, toWorld)) buildReliefShape(shape, letterOut, { relief: LETTERS, film: () => 0.5, filmSide: 0.5, smallShapeArea: 0.08 })
}
assertReliefStats(letterOut.stats, 'letter')
const letters = { positions: new Float32Array(letterOut.positions), normals: new Float32Array(letterOut.normals), indices: Uint32Array.from(letterOut.indices) }

// ── Plate and rim ────────────────────────────────────────────────────────────
const innerShapes = ringShapes.flatMap(shape => shape.holes.map(hole => ({ outer: hole, holes: [] })))
const plate = buildExtrusion(innerShapes, { depth: PLATE.depth, bevel: 0.002, creaseAngle: CREASE_ANGLE, bevelSegments: 1 })

/**
 * A glowing band `width` wide round one boundary loop of `shape`, on the side away from the material: outside a letter's outline, inside a
 * letter's counter, inside the ring's hole. The loop is resampled evenly and pushed along smoothed normals.
 */
function bandAround(shape, loop) {
  const points = resampleLoop(loop, RIM.spacing, Math.PI).map(v => v.p)
  const count = points.length
  const offset = points.map((p, i) => {
    const a = points[(i - 1 + count) % count], b = points[(i + 1) % count]
    const t = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(t[0], t[1]) || 1
    let n = [t[1] / l, -t[0] / l]
    if (isInside(shape, [p[0] + n[0] * 0.004, p[1] + n[1] * 0.004])) n = [-n[0], -n[1]]
    return [p[0] + n[0] * RIM.width, p[1] + n[1] * RIM.width]
  })
  // The offset loop encloses the original when it runs outward (letter outlines), and sits inside it otherwise (counters, the ring's hole).
  const area = poly => poly.reduce((sum, p, i) => sum + p[0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * p[1], 0) / 2
  return Math.abs(area(offset)) > Math.abs(area(points)) ? { outer: offset, holes: [points] } : { outer: points, holes: [offset] }
}
const letterShapes = bodyContours.flatMap(contours => nestedShapes(contours, toWorld))
const bands = [
  ...letterShapes.flatMap(shape => [shape.outer, ...shape.holes].map(loop => bandAround(shape, loop))),
  ...ringShapes.flatMap(shape => shape.holes.map(loop => bandAround(shape, loop))),
]
const rim = buildExtrusion(bands, { depth: RIM.depth, bevel: 0.002, creaseAngle: CREASE_ANGLE, bevelSegments: 1 })

// ── Overlap check: the body paths must not overlap ───────────────────────────
const bodyShapes = bodyContours.map(contours => nestedShapes(contours, toWorld))
const insideAny = (shapes, point) => shapes.some(shape => contains(shape.outer, point) && !shape.holes.some(hole => contains(hole, point)))
let overlapSamples = 0, bodySamples = 0
for (let x = -2.2; x <= 2.2; x += 0.01) for (let y = -0.7; y <= 0.7; y += 0.01) {
  const hits = bodyShapes.filter(shapes => insideAny(shapes, [x, y])).length
  if (hits > 0) bodySamples += 1
  if (hits > 1) overlapSamples += 1
}
if (overlapSamples > 0) throw new Error(`${((overlapSamples / Math.max(1, bodySamples)) * 100).toFixed(2)}% of the wordmark body lies in two or more paths: overlapping reliefs would z-fight.`)

// ── Tube attachment points: the ring's outer edge nearest each target (mockup-derived, world units) ──
const [cx, cy, cz] = CONDUIT_WORDMARK.centre
const outer = ringShapes.map(shape => shape.outer).sort((a, b) => b.length - a.length)[0]
const nearest = target => outer.reduce((best, p) => (Math.hypot(p[0] - target[0], p[1] - target[1]) < Math.hypot(best[0] - target[0], best[1] - target[1]) ? p : best), outer[0])
const attachments = { upper: nearest([-1.62 - cx, 2.67 - cy]), lower: nearest([-2.09 - cx, 1.84 - cy]) }

const halfWidth = CONDUIT_WORDMARK.width / 2
const segmentOf = x => [0, (x / halfWidth + 1) / 2, Math.sign(x), 0.5]
const meshes = [
  withGlow(translated({ name: 'outline', part: 'outline', ...outline }, cx, cy, cz), 0, () => [0, 0, 0, 0]),
  withGlow(translated({ name: 'letters', part: 'letters', ...letters }, cx, cy, cz), 0, () => [0, 0, 0, 0]),
  withGlow(translated({ name: 'plate', part: 'plate', ...plate }, cx, cy, cz + PLATE.back + PLATE.depth / 2), 0, () => [0, 0, 0, 0]),
  withGlow(translated({ name: 'rim', part: 'rim', ...rim }, cx, cy, cz + RIM.back + RIM.depth / 2), 1, segmentOf),
]
const result = writeGlb(outputPath, meshes, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-conduit-wordmark.mjs', 'conduit-wordmark')

console.log(`Wrote ${outputPath}`)
for (const mesh of meshes) console.log(`  ${mesh.name}: ${mesh.indices.length / 3} triangles, ${mesh.positions.length / 3} vertices`)
console.log(`  total ${result.triangles} triangles, ${(result.byteLength / 1024).toFixed(0)} KB, wordmark ${CONDUIT_WORDMARK.width} x ${((maxY - minY) * scale).toFixed(3)} units`)
console.log(`  tube attachments (world): upper-left ${(attachments.upper[0] + cx).toFixed(3)}, ${(attachments.upper[1] + cy).toFixed(3)}; lower-left ${(attachments.lower[0] + cx).toFixed(3)}, ${(attachments.lower[1] + cy).toFixed(3)} (mirror for the right)`)
