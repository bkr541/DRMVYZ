// Generates CONDUIT's 3D DVYDRM wordmark from the owner's master SVG: hard-surface letters in a stepped chrome frame, with amber light welling
// up from the gaps between them, like the owner's production mockup.
//   node scripts/cinema2-assets/generate-conduit-wordmark.mjs [out.glb]      (default: public/cinema2/models/conduit-wordmark.glb)
//
// Parts (materials), front to back:
//   `letters`  the flat front faces and rounded front bevels of every body path (the letters, the lower sweeps, the four-point star): a thick
//              extrusion with a crisp rounded edge, bright white.
//   `walls`    the letters' side walls, and the frame's: polished bronze chrome. Segment-lit as part of the logo's glow, strongest at their
//              foot and fading up the wall, so the light in the gaps climbs the letter sides.
//   `outline`  the frame's face: the SVG's outline ring (even-odd), a raised extrusion round the letters.
//   `base`     a darker chrome step under the frame, grown out past the SVG outline, so the frame sits on a stepped lip.
//   `plate`    near-black floor of the gaps inside the frame, behind the letters.
//   `rim`      glowing bands on the plate round every letter edge and along the frame's inner edge, plus a visible band across the outer lip: the
//              amber light in the owner's mockups. CONDUIT drives it from the music and from energy arriving through the tubes.
//
// Every vertex carries `_GLOW_PHASE` and `_SEGMENT` (group, along, side, random - see docs/cinema2-conduit-plan.md). For the glowing parts
// (rim, walls) the phase is the glow's reach: 1 where the light sits, 0 where it has faded.
//
// World coordinates shared by all CONDUIT assets: floor at y = 0, +Y up, +Z toward the camera. The wordmark is 4.8 units wide, centred on
// (0, 2.09, 0), facing +Z. The generator also writes the tube attachment points on the frame to conduit-layout.json, which
// generate-conduit-tubes.mjs reads, so the tubes always meet the frame when the wordmark changes size or shape (run this generator first).
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildExtrusion,
  contains,
  contoursOfAdaptive,
  isInside,
  nestedShapes,
  pathData,
  resampleLoop,
  splitMesh,
} from './cinema2-svg-relief-kit.mjs'
import { writeGlb } from './cinema2-tube-kit.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const svg = readFileSync(join(root, 'scripts/cinema2-assets/sources/dvydrm-wordmark-master.svg'), 'utf8')
const outputPath = process.argv[2] ? resolve(process.argv[2]) : join(root, 'public/cinema2/models/conduit-wordmark.glb')
/** Shared layout read by generate-conduit-tubes.mjs (written next to the generators; only when generating the shipped model). */
const layoutPath = join(root, 'scripts/cinema2-assets/conduit-layout.json')

/**
 * Enlarge the approved 4.8-unit mark by 20% in the image plane, about its existing centre. The four tube-to-outline junctions follow the
 * generated contour layout. Depths, bevels and glow widths stay in absolute units so the letters retain their approved finish.
 */
export const CONDUIT_WORDMARK = Object.freeze({ width: 5.76, centre: Object.freeze([0, 2.09, 0]) })
/** The tube-attachment targets below were measured on the original 4.23-wide mark; they scale with the width. */
const ATTACH_SCALE = CONDUIT_WORDMARK.width / 4.23
const BODY_PATHS = ['left-primary-body', 'central-interlock-body', 'left-inner-body', 'right-primary-body', 'right-interlock-and-sweep', 'left-lower-sweep', 'center-lower-sweep', 'four-point-symbol']

/** Native master is 2006px wide; bound tessellation deviation to less than half a master pixel. */
const CURVE_MAX_ERROR_SVG = 0.35
const CREASE_ANGLE = (38 * Math.PI) / 180
/**
 * Depths (z, local to the wordmark centre). The letters stand proud of the frame and the frame of the lip; the dark plate in the gaps sits
 * just in front of the lip (the lip is the whole silhouette, grown).
 * `bevel` is each part's rounded edge. The frame is only ~0.025 wide in places, so its bevel (which eats in from both edges) stays small.
 */
const LETTERS = { back: -0.08, front: 0.13, bevel: 0.008, bevelSegments: 4 }
const FRAME = { back: -0.08, front: 0.045, bevel: 0.0035, bevelSegments: 3 }
/** A broader exterior chrome border; it grows away from the SVG rather than eating into the letter faces or counters. */
const LIP = { back: -0.2, front: -0.086, bevel: 0.032, grow: 0.09, bevelSegments: 4 }
const PLATE = { back: -0.1, front: -0.078 }
/** The interior seams stay restrained; the outer silhouette fills the exposed lip and carries the stronger production-reference glow. */
const RIM = { depth: 0.01, width: 0.02, spacing: 0.05, lipWidth: 0.078, fade: 0.08, gapPeak: 0.38, outerPeak: 0.55 }
/** How far up a wall (from its foot) the glow climbs before it fades out. */
const WALL_GLOW_REACH = 0.09
/** The walls' glow at their very foot, relative to the rim's brightest line. */
const WALL_GLOW = 0.3

const MATERIALS = {
  letters: { baseColorFactor: [0.96, 0.95, 0.93, 1], metallicFactor: 0.05, roughnessFactor: 0.2 },
  walls: { baseColorFactor: [0.78, 0.66, 0.54, 1], metallicFactor: 1, roughnessFactor: 0.16 },
  outline: { baseColorFactor: [0.86, 0.82, 0.78, 1], metallicFactor: 1, roughnessFactor: 0.12 },
  base: { baseColorFactor: [0.42, 0.37, 0.33, 1], metallicFactor: 1, roughnessFactor: 0.2 },
  plate: { baseColorFactor: [0.07, 0.065, 0.06, 1], metallicFactor: 0.9, roughnessFactor: 0.35 },
  // A dark diffuser when unlit: the segment shader supplies all of the rim's visible hue, shared with the tubes and wall LEDs.
  rim: { baseColorFactor: [0.04, 0.018, 0.008, 1], metallicFactor: 0, roughnessFactor: 0.65, emissiveFactor: [1, 0.55, 0.2] },
}

// One transform for every part so their placement is exactly the SVG's.
const ringContours = contoursOfAdaptive(pathData(svg, 'outer-outline-ring'), CURVE_MAX_ERROR_SVG)
const bodyContours = BODY_PATHS.map(id => contoursOfAdaptive(pathData(svg, id), CURVE_MAX_ERROR_SVG))
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

function withGlow(mesh, phaseOf, segment) {
  const count = mesh.positions.length / 3
  const segments = new Float32Array(count * 4), phases = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    const x = mesh.positions[i * 3], y = mesh.positions[i * 3 + 1], z = mesh.positions[i * 3 + 2]
    segments.set(segment(x, y), i * 4)
    phases[i] = phaseOf(x, y, z)
  }
  return { ...mesh, phases, attributes: { _SEGMENT: { array: segments, type: 'VEC4' } } }
}

/** A bevelled extrusion placed from z = back to z = front. */
function slab(shapes, { back, front, bevel, bevelSegments, grow = null }) {
  const depth = front - back - 2 * bevel
  const mesh = buildExtrusion(shapes, { depth, bevel, creaseAngle: CREASE_ANGLE, bevelSegments, ...(grow !== null ? { offset: grow - bevel } : {}) })
  return translated(mesh, 0, 0, (back + front) / 2)
}
/**
 * Splits a slab into its front (the flat face and the front bevel, facing the camera) and its walls. The flat face gets its own vertices with
 * an exact +Z normal: shared with the bevel, its rim normals would lean outward and smear streaks across the long triangles of the face.
 */
function frontAndWalls(mesh) {
  const [front, walls] = splitMesh(mesh, normal => normal.z > 0.55)
  const [face, bevel] = splitMesh(front, normal => normal.z > 0.999)
  for (let i = 0; i < face.normals.length; i += 3) face.normals.set([0, 0, 1], i)
  return [merged([face, bevel]), walls]
}
function merged(list) {
  const offsets = []
  let count = 0
  for (const mesh of list) { offsets.push(count); count += mesh.positions.length / 3 }
  return {
    positions: new Float32Array(list.flatMap(mesh => Array.from(mesh.positions))),
    normals: new Float32Array(list.flatMap(mesh => Array.from(mesh.normals))),
    indices: Uint32Array.from(list.flatMap((mesh, k) => Array.from(mesh.indices, i => i + offsets[k]))),
  }
}

// ── Frame, lip and plate ─────────────────────────────────────────────────────
const ringShapes = nestedShapes(ringContours, toWorld)
const [frameFace, frameWalls] = frontAndWalls(slab(ringShapes, FRAME))
const outerShapes = ringShapes.map(shape => ({ outer: shape.outer, holes: [] }))
const lip = slab(outerShapes, { ...LIP, grow: LIP.grow })
const innerShapes = ringShapes.flatMap(shape => shape.holes.map(hole => ({ outer: hole, holes: [] })))
const plate = slab(innerShapes, { back: PLATE.back, front: PLATE.front, bevel: 0.002, bevelSegments: 1 })

// ── Letters ──────────────────────────────────────────────────────────────────
const letterShapes = bodyContours.flatMap(contours => nestedShapes(contours, toWorld))
const [letterFace, letterWalls] = frontAndWalls(slab(letterShapes, LETTERS))

// ── Glow bands ───────────────────────────────────────────────────────────────
/**
 * A glowing ribbon `width` wide round one boundary loop of `shape`, on the side away from the material: outside a letter's outline, inside a
 * letter's counter, inside the frame's hole, outside the lip. Keep the two sampled edges paired: a polygon-with-hole extrusion can bridge a
 * tight concave hook during triangulation and fill the entire negative-space notch with emissive geometry.
 */
function bandAround(shape, loop, width) {
  const points = resampleLoop(loop, RIM.spacing, Math.PI).map(v => v.p)
  const count = points.length
  const offset = points.map((p, i) => {
    const a = points[(i - 1 + count) % count], b = points[(i + 1) % count]
    const t = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(t[0], t[1]) || 1
    let n = [t[1] / l, -t[0] / l]
    if (isInside(shape, [p[0] + n[0] * 0.004, p[1] + n[1] * 0.004])) n = [-n[0], -n[1]]
    return [p[0] + n[0] * width, p[1] + n[1] * width]
  })
  return { source: points, offset, width }
}
/**
 * Builds local quads rather than triangulating two whole offset loops. This bounds every triangle to one contour sample interval, even at
 * the small pointed counter of the inner letter. Each vertex's phase falls from `peak` at the hugged edge to its faded far side.
 * The outer perimeter gets a stronger peak than the fine seams at the feet of the letters.
 */
function glowBands(bands, front, peak) {
  const list = bands.map(band => {
    const positions = [], normals = [], indices = [], phases = []
    for (let i = 0; i < band.source.length; i += 1) {
      const next = (i + 1) % band.source.length
      const [p, q, r, s] = [band.source[i], band.source[next], band.offset[next], band.offset[i]]
      const base = positions.length / 3
      for (const point of [p, q, r, s]) {
        positions.push(point[0], point[1], front)
        normals.push(0, 0, 1)
      }
      phases.push(peak, peak, peak * RIM.fade, peak * RIM.fade)
      const cross = (q[0] - p[0]) * (s[1] - p[1]) - (q[1] - p[1]) * (s[0] - p[0])
      if (cross >= 0) indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
      else indices.push(base, base + 2, base + 1, base, base + 3, base + 2)
    }
    return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint32Array(indices), phases: new Float32Array(phases) }
  })
  return { ...merged(list), phases: new Float32Array(list.flatMap(mesh => Array.from(mesh.phases))) }
}
const gapBands = [
  ...letterShapes.flatMap(shape => [shape.outer, ...shape.holes].map(loop => bandAround(shape, loop, RIM.width))),
  ...ringShapes.flatMap(shape => shape.holes.map(loop => bandAround(shape, loop, RIM.width))),
]
const gapGlow = glowBands(gapBands, PLATE.front + RIM.depth, RIM.gapPeak)
// The continuous outside band lies on the exposed lip, in front of its metal surface but behind the raised letters and frame.
const lipBands = outerShapes.map(shape => bandAround(shape, shape.outer, RIM.lipWidth))
const lipGlow = glowBands(lipBands, LIP.front + RIM.depth, RIM.outerPeak)
const rim = { ...merged([gapGlow, lipGlow]), phases: new Float32Array([...gapGlow.phases, ...lipGlow.phases]) }

// Walls glow from their foot: the letters' from the plate, the frame's from the lip.
const wallPhase = foot => (x, y, z) => WALL_GLOW * Math.max(0, 1 - (z - foot) / WALL_GLOW_REACH) ** 2
const walls = [
  { mesh: letterWalls, phase: wallPhase(PLATE.front) },
  { mesh: frameWalls, phase: wallPhase(LIP.front) },
]

// ── Overlap check: the body paths must not overlap ───────────────────────────
const bodyShapes = bodyContours.map(contours => nestedShapes(contours, toWorld))
const insideAny = (shapes, point) => shapes.some(shape => contains(shape.outer, point) && !shape.holes.some(hole => contains(hole, point)))
let overlapSamples = 0, bodySamples = 0
const bodyHalfWidth = CONDUIT_WORDMARK.width / 2
const bodyHalfHeight = (maxY - minY) * scale / 2
for (let x = -bodyHalfWidth; x <= bodyHalfWidth; x += 0.01) for (let y = -bodyHalfHeight; y <= bodyHalfHeight; y += 0.01) {
  const hits = bodyShapes.filter(shapes => insideAny(shapes, [x, y])).length
  if (hits > 0) bodySamples += 1
  if (hits > 1) overlapSamples += 1
}
if (overlapSamples > 0) throw new Error(`${((overlapSamples / Math.max(1, bodySamples)) * 100).toFixed(2)}% of the wordmark body lies in two or more paths: overlapping reliefs would z-fight.`)

// ── Tube attachment points: the frame's outer edge nearest each target (mockup-derived, world units; the right side mirrors the left) ──
const [cx, cy, cz] = CONDUIT_WORDMARK.centre
const outer = ringShapes.map(shape => shape.outer).sort((a, b) => b.length - a.length)[0]
const nearest = target => outer.reduce((best, p) => (Math.hypot(p[0] - target[0], p[1] - target[1]) < Math.hypot(best[0] - target[0], best[1] - target[1]) ? p : best), outer[0])
const attachments = { upper: nearest([-1.62 * ATTACH_SCALE, (2.67 - cy) * ATTACH_SCALE]), lower: nearest([-2.09 * ATTACH_SCALE, (1.84 - cy) * ATTACH_SCALE]) }
const outwardAt = point => {
  const i = outer.indexOf(point)
  const previous = outer[(i - 1 + outer.length) % outer.length], next = outer[(i + 1) % outer.length]
  const dx = next[0] - previous[0], dy = next[1] - previous[1]
  const length = Math.hypot(dx, dy) || 1
  const normal = [dy / length, -dx / length]
  return contains(outer, [point[0] + normal[0] * 0.01, point[1] + normal[1] * 0.01]) ? [-normal[0], -normal[1]] : normal
}

const halfWidth = CONDUIT_WORDMARK.width / 2
const segmentOf = (x) => [0, (x / halfWidth + 1) / 2, Math.sign(x), 0.5]
const none = () => [0, 0, 0, 0]
const place = mesh => translated({ ...mesh, positions: Float32Array.from(mesh.positions) }, cx, cy, cz)
const meshes = [
  withGlow({ name: 'letters', part: 'letters', ...place(letterFace) }, () => 0, none),
  ...walls.map(({ mesh, phase }, k) => withGlow({ name: `walls-${k === 0 ? 'letters' : 'frame'}`, part: 'walls', ...mesh }, phase, segmentOf)),
  withGlow({ name: 'outline', part: 'outline', ...place(frameFace) }, () => 0, none),
  withGlow({ name: 'base', part: 'base', ...place(lip) }, () => 0, none),
  withGlow({ name: 'plate', part: 'plate', ...place(plate) }, () => 0, none),
  { ...withGlow({ name: 'rim', part: 'rim', ...rim }, () => 1, segmentOf), phases: rim.phases },
]
// The walls' glow phase and segment were read in the wordmark's local frame; move them (and the rim) into place afterwards.
for (const mesh of meshes) if (mesh.part === 'walls' || mesh.part === 'rim') translated(mesh, cx, cy, cz)
const result = writeGlb(outputPath, meshes, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-conduit-wordmark.mjs', 'conduit-wordmark')

console.log(`Wrote ${outputPath}`)
for (const mesh of meshes) console.log(`  ${mesh.name}: ${mesh.indices.length / 3} triangles, ${mesh.positions.length / 3} vertices`)
console.log(`  total ${result.triangles} triangles, ${(result.byteLength / 1024).toFixed(0)} KB, wordmark ${CONDUIT_WORDMARK.width} x ${((maxY - minY) * scale).toFixed(3)} units`)
// Rounded to millimetres so the layout file is stable and readable.
const worldPoint = p => [Number((p[0] + cx).toFixed(3)), Number((p[1] + cy).toFixed(3)), 0]
const layout = {
  generatedBy: 'scripts/cinema2-assets/generate-conduit-wordmark.mjs',
  note: 'Tube attachment points and outward normals on the wordmark frame (left side, world units; the right side mirrors them). Do not edit by hand: regenerate the wordmark, then the tubes.',
  wordmark: { width: CONDUIT_WORDMARK.width, centre: [...CONDUIT_WORDMARK.centre], lipOutset: LIP.grow },
  sourceBounds: { minX, maxX, minY, maxY },
  curveMaxErrorSvg: CURVE_MAX_ERROR_SVG,
  attachments: { upper: worldPoint(attachments.upper), lower: worldPoint(attachments.lower) },
  normals: { upper: outwardAt(attachments.upper), lower: outwardAt(attachments.lower) },
}
if (!process.argv[2]) writeFileSync(layoutPath, `${JSON.stringify(layout, null, 2)}\n`)
console.log(`  tube attachments (world): upper-left ${(attachments.upper[0] + cx).toFixed(3)}, ${(attachments.upper[1] + cy).toFixed(3)}; lower-left ${(attachments.lower[0] + cx).toFixed(3)}, ${(attachments.lower[1] + cy).toFixed(3)} (mirror for the right)${process.argv[2] ? '' : `, written to ${layoutPath}`}`)
