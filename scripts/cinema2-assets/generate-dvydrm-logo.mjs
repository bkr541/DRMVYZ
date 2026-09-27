// Generates the shared 3D DVYDRM logo used by Cinema 2.0 presets from the owner's master SVG.
//   node scripts/cinema2-assets/generate-dvydrm-logo.mjs [out.glb]      (default: public/cinema2/models/dvydrm-logo.glb)
//
// The model has two parts, matching the production logo (a faceted crystal cloud with a thin polished gold outline):
//   `outline`  the thin outer ring of the master SVG (path "outer-outline"): a bevelled extrusion with a polished gold PBR material.
//   `crystal`  the cloud body and the lower star (paths "cloud-body" and "lower-star"): a faceted gem, with a near-white polished metal
//              PBR material. The SVG only supplies outlines; the facets are cut here. The top surface is a low-poly relief: the outline is
//              sampled, points are scattered inside it and along the owner's facet guide (sources/dvydrm-logo-facet-guides.svg), the points are
//              joined into a Delaunay triangulation, and each point is lifted by its distance from the edge (a chamfer towards the rim, a
//              ridge in the middle) plus a small mirror-symmetric jitter and a raise on the guide lines. Every triangle is one flat plane,
//              so each catches the light on its own, the way a cut stone does. Side walls and a flat back close the solid.
// The paths use the even-odd rule, so nesting decides which contours are holes. Gradients in the SVG are ignored: the colors are the PBR
// materials written below, and presets can tint or re-rough each part (three-scene per-part overrides `<part>.color`, `<part>.roughness`).
//
// The crystal also carries a custom per-vertex attribute `_FILM_THICKNESS` (0-1, one value per top facet): where a preset gives the crystal a
// thin-film iridescence, three-scene reads it to vary the film between `<part>.iridescenceThicknessMin` and `...Max`, so neighbouring facets
// pick up different pastels (ice blue, lavender, pink, peach) the way the production logo's facets do. Without iridescence it is ignored.
//
// Coordinates: the logo is centred on the origin, 2 units wide, facing +Z, Y up.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const sourcePath = join(root, 'scripts/cinema2-assets/sources/dvydrm-logo-master.svg')
const guidesPath = join(root, 'scripts/cinema2-assets/sources/dvydrm-logo-facet-guides.svg')
const outputPath = process.argv[2] ? resolve(process.argv[2]) : join(root, 'public/cinema2/models/dvydrm-logo.glb')

const WIDTH_UNITS = 2
const SAMPLES_PER_CURVE = 3
const CREASE_ANGLE = (38 * Math.PI) / 180

/** The gold ring: extrusion depth (world units at 2 units wide) and bevel. */
const OUTLINE = { depth: 0.06, bevel: 0.008 }
/**
 * The crystal. z runs from `backZ` (the flat back) to `edgeZ` (the rim of the top surface); the top rises from the rim by `slope` per unit
 * of distance from the edge, up to `plateau` distance, so the rim is chamfered and the middle of a ribbon is a low ridge.
 */
const CRYSTAL = {
  backZ: -0.03,
  edgeZ: 0.004,
  slope: 1,
  plateau: 0.05,
  jitter: 0.022,
  majorRidge: 0.03,
  minorRidge: 0.015,
  boundarySpacing: 0.04,
  interiorSpacing: 0.095,
  guideSpacing: 0.04,
  /** A turn sharper than this at a sampled point is a real corner (kept exactly, and the wall stays creased there). */
  cornerAngle: (50 * Math.PI) / 180,
}
/**
 * Film thickness per top facet (0-1): a broad drifting field so the pastels come in soft patches across the logo, plus a per-facet offset
 * so neighbouring facets still differ. The walls and the back take the middle value.
 */
const FILM = { patchScale: 2.6, patchAmount: 0.34, facetAmount: 0.32, side: 0.5 }
/** Small shapes (the star) need finer facets to read as a gem. */
const SMALL_SHAPE_AREA = 0.02

/** Linear-sRGB PBR colors. Gold is the F0 of real gold, so the highlights stay warm; the crystal is a near-white polished metal. */
const MATERIALS = {
  // Baked neutral/near-white, same as the crystal: every preset tints it via its own Design control (GO-TO defaults it to gold; RELIQUARY
  // leaves it white so the outline reads as one uniform crystal with the body, no separate gold ring).
  outline: { name: 'outline', baseColorFactor: [0.97, 0.97, 0.98, 1], metallicFactor: 1, roughnessFactor: 0.15 },
  crystal: { name: 'crystal', baseColorFactor: [0.97, 0.97, 0.98, 1], metallicFactor: 1, roughnessFactor: 0.05 },
}

const svg = readFileSync(sourcePath, 'utf8')

function pathData(id) {
  const match = svg.match(new RegExp(`<path[^>]*\\bid="${id}"[^>]*\\bd="([^"]+)"`)) ?? svg.match(new RegExp(`<path[^>]*\\bd="([^"]+)"[^>]*\\bid="${id}"`))
  if (!match) throw new Error(`The master SVG has no <path id="${id}">.`)
  return match[1]
}

/** Absolute M / C / Z only (what the master SVG uses). Returns closed polylines of [x, y]. */
function contoursOf(d) {
  const tokens = d.match(/[MCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []
  const contours = []
  let current = null
  let cursor = [0, 0]
  let index = 0
  const number = () => Number(tokens[index++])
  while (index < tokens.length) {
    const command = tokens[index++]
    if (command === 'M') {
      current = [[number(), number()]]
      cursor = current[0]
    } else if (command === 'C') {
      // A C command may repeat its implicit coordinates until the next letter.
      while (index < tokens.length && !/[A-Za-z]/.test(tokens[index])) {
        const p1 = [number(), number()]
        const p2 = [number(), number()]
        const p3 = [number(), number()]
        for (let step = 1; step <= SAMPLES_PER_CURVE; step += 1) {
          const t = step / SAMPLES_PER_CURVE
          const u = 1 - t
          current.push([
            u * u * u * cursor[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * cursor[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
          ])
        }
        cursor = p3
      }
    } else if (command === 'Z') {
      // Drop the duplicated closing point.
      const first = current[0]
      const last = current[current.length - 1]
      if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6) current.pop()
      contours.push(current)
      current = null
    } else throw new Error(`Unsupported path command "${command}" in the master SVG.`)
  }
  return contours
}

function contains(polygon, [x, y]) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Even-odd nesting: contours at even depth are outlines, the odd ones directly inside them are their holes. */
function nestedShapes(contours, toWorld) {
  const world = contours.map(contour => toWorld(contour))
  const depth = world.map((contour, i) => world.reduce((count, other, j) => (i !== j && contains(other, contour[0]) ? count + 1 : count), 0))
  const shapes = []
  world.forEach((contour, i) => {
    if (depth[i] % 2 !== 0) return
    shapes.push({ outer: contour, holes: world.filter((hole, j) => depth[j] === depth[i] + 1 && contains(contour, hole[0])) })
  })
  return shapes
}

const isInside = (shape, point) => contains(shape.outer, point) && !shape.holes.some(hole => contains(hole, point))
const toThreeShape = shape => {
  const result = new THREE.Shape(shape.outer.map(([x, y]) => new THREE.Vector2(x, y)))
  for (const hole of shape.holes) result.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))))
  return result
}
const areaOf = polygon => {
  let sum = 0
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) sum += (polygon[j][0] * polygon[i][1]) - (polygon[i][0] * polygon[j][1])
  return sum / 2
}
const shapeArea = shape => Math.abs(areaOf(shape.outer)) - shape.holes.reduce((sum, hole) => sum + Math.abs(areaOf(hole)), 0)

const outlineContours = contoursOf(pathData('outer-outline'))
const bodyContours = contoursOf(pathData('cloud-body'))
const starContours = contoursOf(pathData('lower-star'))

// One shared transform for all parts so their relative placement is exactly the SVG's.
const all = [...outlineContours, ...bodyContours, ...starContours].flat()
const minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0]))
const minY = Math.min(...all.map(p => p[1])), maxY = Math.max(...all.map(p => p[1]))
const scale = WIDTH_UNITS / (maxX - minX)
const toWorldPoint = ([x, y]) => [(x - (minX + maxX) / 2) * scale, -(y - (minY + maxY) / 2) * scale]
const toWorld = contour => contour.map(toWorldPoint)

// ── Gold outline: a bevelled extrusion ───────────────────────────────────────
function buildOutline() {
  const shapes = nestedShapes(outlineContours, toWorld).map(toThreeShape)
  let geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: OUTLINE.depth,
    bevelEnabled: true,
    bevelThickness: OUTLINE.bevel,
    bevelSize: OUTLINE.bevel,
    // The bevel's widest point is exactly the SVG outline, so the ring never grows into the gap next to the crystal.
    bevelOffset: -OUTLINE.bevel,
    bevelSegments: 3,
    curveSegments: 1,
    steps: 1,
  })
  geometry.deleteAttribute('uv')
  // Centre the depth about z = 0 so a spin turns every part about the same axis.
  geometry.translate(0, 0, -OUTLINE.depth / 2)
  geometry = toCreasedNormals(geometry, CREASE_ANGLE)
  geometry = mergeVertices(geometry, 1e-5)
  return {
    positions: new Float32Array(geometry.getAttribute('position').array),
    normals: new Float32Array(geometry.getAttribute('normal').array),
    indices: Uint32Array.from(geometry.getIndex().array),
  }
}

// ── Crystal: a faceted relief ────────────────────────────────────────────────
function hash2(a, b) {
  let h = Math.imul(Math.round(a * 4096) | 0, 374761393) ^ Math.imul(Math.round(b * 4096) | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function segmentDistance([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function distanceToBoundary(shape, point) {
  let best = Infinity
  for (const loop of [shape.outer, ...shape.holes]) {
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i, i += 1) best = Math.min(best, segmentDistance(point, loop[j], loop[i]))
  }
  return best
}

function turningAngle(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1]
  const length = Math.hypot(ux, uy) * Math.hypot(vx, vy)
  return length < 1e-12 ? 0 : Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / length)))
}

/** Resamples a closed polyline to an even spacing, keeping every real corner exactly. Returns [{ p, corner }]. */
function resampleLoop(points, spacing) {
  const count = points.length
  const corners = []
  for (let i = 0; i < count; i += 1) if (turningAngle(points[(i - 1 + count) % count], points[i], points[(i + 1) % count]) > CRYSTAL.cornerAngle) corners.push(i)
  const starts = corners.length > 0 ? corners : [0]
  const result = []
  starts.forEach((start, k) => {
    const end = starts[(k + 1) % starts.length]
    const run = [points[start]]
    for (let i = (start + 1) % count; ; i = (i + 1) % count) {
      run.push(points[i])
      if (i === end) break
    }
    const lengths = [0]
    for (let i = 1; i < run.length; i += 1) lengths.push(lengths[i - 1] + Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1]))
    const total = lengths[lengths.length - 1]
    const segments = Math.max(1, Math.round(total / spacing))
    let cursor = 0
    for (let s = 0; s < segments; s += 1) {
      const target = (total * s) / segments
      while (cursor < run.length - 2 && lengths[cursor + 1] < target) cursor += 1
      const span = lengths[cursor + 1] - lengths[cursor]
      const t = span < 1e-12 ? 0 : (target - lengths[cursor]) / span
      result.push({ p: [run[cursor][0] + (run[cursor + 1][0] - run[cursor][0]) * t, run[cursor][1] + (run[cursor + 1][1] - run[cursor][1]) * t], corner: s === 0 && corners.length > 0 })
    }
  })
  return result
}

/** Bowyer-Watson Delaunay triangulation. Returns index triples into `points`. */
function delaunay(points) {
  const n = points.length
  let minPX = Infinity, minPY = Infinity, maxPX = -Infinity, maxPY = -Infinity
  for (const [x, y] of points) { minPX = Math.min(minPX, x); minPY = Math.min(minPY, y); maxPX = Math.max(maxPX, x); maxPY = Math.max(maxPY, y) }
  const size = Math.max(maxPX - minPX, maxPY - minPY) * 20 + 1
  const midX = (minPX + maxPX) / 2, midY = (minPY + maxPY) / 2
  const verts = [...points, [midX - size, midY - size], [midX + size, midY - size], [midX, midY + size]]
  const circle = (a, b, c) => {
    const [ax, ay] = verts[a], [bx, by] = verts[b], [cx, cy] = verts[c]
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d
    return { x: ux, y: uy, r2: (ax - ux) ** 2 + (ay - uy) ** 2 }
  }
  let triangles = [{ v: [n, n + 1, n + 2], c: circle(n, n + 1, n + 2) }]
  for (let i = 0; i < n; i += 1) {
    const [px, py] = verts[i]
    const bad = [], keep = []
    for (const triangle of triangles) ((px - triangle.c.x) ** 2 + (py - triangle.c.y) ** 2 < triangle.c.r2 * (1 - 1e-12) ? bad : keep).push(triangle)
    const edges = new Map()
    for (const { v } of bad) {
      for (let k = 0; k < 3; k += 1) {
        const a = v[k], b = v[(k + 1) % 3]
        const key = a < b ? `${a}:${b}` : `${b}:${a}`
        edges.set(key, edges.has(key) ? null : [a, b])
      }
    }
    for (const edge of edges.values()) if (edge) keep.push({ v: [edge[0], edge[1], i], c: circle(edge[0], edge[1], i) })
    triangles = keep
  }
  return triangles.filter(({ v }) => v.every(index => index < n)).map(({ v }) => v)
}

function buildCrystalShape(shape, guides, out) {
  const small = shapeArea(shape) < SMALL_SHAPE_AREA
  const boundarySpacing = CRYSTAL.boundarySpacing * (small ? 0.6 : 1)
  const interiorSpacing = CRYSTAL.interiorSpacing * (small ? 0.55 : 1)
  const guideSpacing = CRYSTAL.guideSpacing * (small ? 0.6 : 1)

  // 1. The rim: every contour resampled to an even spacing.
  const loops = [shape.outer, ...shape.holes].map(loop => resampleLoop(loop, boundarySpacing))
  const points = [], boundary = [], ridge = []
  for (const loop of loops) for (const { p } of loop) { points.push(p); boundary.push(true); ridge.push(0) }

  // 2. The owner's facet guide: points along each guide line inside this shape, raised so each line becomes a crease.
  const minEdge = boundarySpacing * 0.6
  const guidePoints = []
  const addGuide = (q, raise) => {
    if (!isInside(shape, q) || distanceToBoundary(shape, q) < minEdge) return
    const near = guidePoints.findIndex(g => Math.hypot(g.q[0] - q[0], g.q[1] - q[1]) < guideSpacing * 0.55)
    if (near >= 0) { guidePoints[near].raise = Math.max(guidePoints[near].raise, raise); return }
    guidePoints.push({ q, raise })
  }
  for (const guide of guides) {
    const raise = guide.major ? CRYSTAL.majorRidge : CRYSTAL.minorRidge
    for (let i = 0; i < guide.points.length - 1; i += 1) {
      const a = guide.points[i], b = guide.points[i + 1]
      const steps = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / guideSpacing))
      for (let s = 0; s <= steps; s += 1) addGuide([a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps], raise)
    }
  }
  for (const { q, raise } of guidePoints) { points.push(q); boundary.push(false); ridge.push(raise) }

  // 3. Interior scatter: a hex grid symmetric about x = 0, with a mirror-symmetric jitter, kept clear of the rim and the guide lines.
  const rowHeight = interiorSpacing * 0.866
  const xs = [...shape.outer.map(p => p[0])], ys = [...shape.outer.map(p => p[1])]
  const lowY = Math.min(...ys), highY = Math.max(...ys), reach = Math.max(Math.abs(Math.min(...xs)), Math.abs(Math.max(...xs)))
  for (let row = Math.floor(lowY / rowHeight); row <= Math.ceil(highY / rowHeight); row += 1) {
    const offset = row % 2 === 0 ? 0 : interiorSpacing / 2
    for (let column = -Math.ceil(reach / interiorSpacing) - 1; column <= Math.ceil(reach / interiorSpacing) + 1; column += 1) {
      const x = column * interiorSpacing + offset, y = row * rowHeight
      const side = x < 0 ? -1 : 1
      const jx = (hash2(Math.abs(x), y) - 0.5) * 0.36 * interiorSpacing
      const jy = (hash2(y, Math.abs(x) + 7.13) - 0.5) * 0.36 * interiorSpacing
      const q = [x + side * jx, y + jy]
      if (!isInside(shape, q) || distanceToBoundary(shape, q) < interiorSpacing * 0.42) continue
      if (guidePoints.some(g => Math.hypot(g.q[0] - q[0], g.q[1] - q[1]) < interiorSpacing * 0.6)) continue
      points.push(q); boundary.push(false); ridge.push(0)
    }
  }

  // 4. Triangulate, then drop the triangles that fall in the cut-outs or outside the shape.
  const kept = delaunay(points).filter(([a, b, c]) => isInside(shape, [(points[a][0] + points[b][0] + points[c][0]) / 3, (points[a][1] + points[b][1] + points[c][1]) / 3]))
  const triangleArea = kept.reduce((sum, [a, b, c]) => sum + Math.abs(areaOf([points[a], points[b], points[c]])), 0)
  // Judged against the resampled rim (the walls follow it), not the original curve, which a chord cuts a little short.
  const expected = Math.abs(areaOf(loops[0].map(v => v.p))) - loops.slice(1).reduce((sum, loop) => sum + Math.abs(areaOf(loop.map(v => v.p))), 0)
  const rimEdges = new Set(kept.flatMap(([a, b, c]) => [[a, b], [b, c], [c, a]].map(([u, v]) => (u < v ? `${u}:${v}` : `${v}:${u}`))))
  let rimMissing = 0, rimStart = 0
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i += 1) {
      const u = rimStart + i, v = rimStart + ((i + 1) % loop.length)
      if (!rimEdges.has(u < v ? `${u}:${v}` : `${v}:${u}`)) rimMissing += 1
    }
    rimStart += loop.length
  }

  // 5. Heights: a chamfer up from the rim, a raise on the guide lines, and a small mirror-symmetric jitter.
  const heights = points.map((p, i) => {
    if (boundary[i]) return CRYSTAL.edgeZ
    const d = distanceToBoundary(shape, p)
    return CRYSTAL.edgeZ + CRYSTAL.slope * Math.min(d, CRYSTAL.plateau) + ridge[i] + (hash2(Math.abs(p[0]) + 3.7, p[1] + 1.3) - 0.5) * 2 * CRYSTAL.jitter
  })

  // 6. Emit: flat-shaded top facets, the same triangles mirrored for the flat back, and the side walls.
  const push = (position, normal, film = FILM.side) => { out.positions.push(...position); out.normals.push(...normal); out.films.push(film); out.indices.push(out.indices.length) }
  for (const [a, b, c] of kept) {
    const p = [a, b, c].map(index => [points[index][0], points[index][1], heights[index]])
    let [p0, p1, p2] = p
    let nx = (p1[1] - p0[1]) * (p2[2] - p0[2]) - (p1[2] - p0[2]) * (p2[1] - p0[1])
    let ny = (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2])
    let nz = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0])
    if (nz < 0) { [p1, p2] = [p2, p1]; nx = -nx; ny = -ny; nz = -nz }
    const length = Math.hypot(nx, ny, nz) || 1
    const film = facetFilm((p0[0] + p1[0] + p2[0]) / 3, (p0[1] + p1[1] + p2[1]) / 3)
    for (const vertex of [p0, p1, p2]) push(vertex, [nx / length, ny / length, nz / length], film)
    for (const vertex of [p0, p2, p1]) push([vertex[0], vertex[1], CRYSTAL.backZ], [0, 0, -1])
  }
  let start = 0
  for (const loop of loops) {
    // Which side is the material on? Test just off the first edge.
    const a0 = loop[0].p, b0 = loop[1 % loop.length].p
    const e0 = [b0[0] - a0[0], b0[1] - a0[1]], l0 = Math.hypot(e0[0], e0[1])
    const right0 = [e0[1] / l0, -e0[0] / l0]
    const materialOnRight = isInside(shape, [(a0[0] + b0[0]) / 2 + right0[0] * 0.002, (a0[1] + b0[1]) / 2 + right0[1] * 0.002])
    const outward = edge => { const l = Math.hypot(edge[0], edge[1]) || 1; const r = [edge[1] / l, -edge[0] / l]; return materialOnRight ? [-r[0], -r[1]] : r }
    const count = loop.length
    for (let i = 0; i < count; i += 1) {
      const prev = loop[(i - 1 + count) % count], a = loop[i], b = loop[(i + 1) % count], next = loop[(i + 2) % count]
      const edge = [b.p[0] - a.p[0], b.p[1] - a.p[1]]
      const own = outward(edge)
      const blend = (vertex, neighbourEdge) => {
        if (vertex.corner) return own
        const other = outward(neighbourEdge)
        const sum = [own[0] + other[0], own[1] + other[1]]
        const l = Math.hypot(sum[0], sum[1]) || 1
        return [sum[0] / l, sum[1] / l]
      }
      const na = blend(a, [a.p[0] - prev.p[0], a.p[1] - prev.p[1]])
      const nb = blend(b, [next.p[0] - b.p[0], next.p[1] - b.p[1]])
      const topA = [a.p[0], a.p[1], heights[start + i]], topB = [b.p[0], b.p[1], heights[start + ((i + 1) % count)]]
      const lowA = [a.p[0], a.p[1], CRYSTAL.backZ], lowB = [b.p[0], b.p[1], CRYSTAL.backZ]
      const wall = (v0, n0, v1, n1, v2, n2) => {
        // Wind so the face normal points along the outward wall normal.
        const u = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]], w = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]]
        const face = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]
        const flip = face[0] * own[0] + face[1] * own[1] < 0
        const ordered = flip ? [[v0, n0], [v2, n2], [v1, n1]] : [[v0, n0], [v1, n1], [v2, n2]]
        for (const [vertex, n] of ordered) push(vertex, [n[0], n[1], 0])
      }
      wall(topA, na, lowA, na, lowB, nb)
      wall(topA, na, lowB, nb, topB, nb)
    }
    start += count
  }
  out.stats.push({ points: points.length, facets: kept.length, areaRatio: triangleArea / expected, rimMissing, small })
}

function facetFilm(x, y) {
  const u = x * FILM.patchScale, v = y * FILM.patchScale
  const patch = (Math.sin(u * 1.7 + v * 0.6 + 0.4) + Math.sin(u * -0.8 + v * 2.1 + 2.3) + Math.sin(u * 2.9 - v * 1.3 + 4.1) * 0.5) / 2.5
  const facet = hash2(x + 11.3, y - 5.9) - 0.5
  return Math.min(1, Math.max(0, 0.5 + patch * FILM.patchAmount + facet * 2 * FILM.facetAmount))
}

function buildCrystal() {
  const guideSvg = readFileSync(guidesPath, 'utf8')
  const guides = [...guideSvg.matchAll(/<path d="([^"]+)" stroke-width="(\d+)"\/>/g)].map(match => ({
    major: Number(match[2]) >= 4,
    points: [...match[1].matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(point => toWorldPoint([Number(point[1]), Number(point[2])])),
  }))
  if (guides.length === 0) throw new Error('The facet guide SVG has no lines.')
  const out = { positions: [], normals: [], films: [], indices: [], stats: [] }
  for (const shape of [...nestedShapes(bodyContours, toWorld), ...nestedShapes(starContours, toWorld)]) buildCrystalShape(shape, guides, out)
  for (const stat of out.stats) {
    if (Math.abs(stat.areaRatio - 1) > 0.01) throw new Error(`The facets cover ${(stat.areaRatio * 100).toFixed(2)}% of a crystal shape (expected 100%): the triangulation left gaps.`)
    if (stat.rimMissing > 0) throw new Error(`${stat.rimMissing} rim edge(s) of a crystal shape are not edges of the triangulation.`)
  }
  return { positions: new Float32Array(out.positions), normals: new Float32Array(out.normals), films: new Float32Array(out.films), indices: Uint32Array.from(out.indices), stats: out.stats }
}

const meshes = [
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
for (const stat of meshes[1].stats) console.log(`  crystal shape${stat.small ? ' (small)' : ''}: ${stat.points} points, ${stat.facets} facets, area ${(stat.areaRatio * 100).toFixed(2)}%`)
console.log(`  total ${triangles} triangles, logo ${WIDTH_UNITS} x ${(((maxY - minY) * scale)).toFixed(3)} units, ${(byteLength / 1024).toFixed(0)} KB`)
