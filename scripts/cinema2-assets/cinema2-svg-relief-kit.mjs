// Shared SVG-to-3D building blocks for Cinema 2.0's logo assets (the DVYDRM cloud logo, the DVYDRM wordmark): reading absolute M/C/Z paths
// from a master SVG, even-odd nesting into shapes with holes, bevelled extrusions, and the smooth (or cut-crystal) "pillow" relief - an
// evenly resampled rim, a jittered interior scatter, a Delaunay triangulation, and heights lifted by a quarter ellipse of the distance from
// the edge.
import * as THREE from 'three'
import { mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** The `d` attribute of `<path id="…">` in an SVG document. */
export function pathData(svg, id) {
  const match = svg.match(new RegExp(`<path[^>]*\\bid="${id}"[^>]*\\bd="([^"]+)"`)) ?? svg.match(new RegExp(`<path[^>]*\\bd="([^"]+)"[^>]*\\bid="${id}"`))
  if (!match) throw new Error(`The master SVG has no <path id="${id}">.`)
  return match[1]
}

/** Absolute M / C / Z only (what the master SVGs use). Returns closed polylines of [x, y]. */
export function contoursOf(d, samplesPerCurve) {
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
        for (let step = 1; step <= samplesPerCurve; step += 1) {
          const t = step / samplesPerCurve
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

/** Flatten absolute M/C/Z paths until each cubic's control polygon is within `maxError` SVG units of its chord. */
export function contoursOfAdaptive(d, maxError = 0.35) {
  if (!(maxError > 0)) throw new Error('Adaptive curve error must be positive.')
  const tokens = d.match(/[MCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []
  const contours = []
  let current = null
  let cursor = [0, 0]
  let index = 0
  const number = () => Number(tokens[index++])
  const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const chordDistance = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const length = Math.hypot(dx, dy)
    return length < 1e-12 ? Math.hypot(p[0] - a[0], p[1] - a[1]) : Math.abs(dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / length
  }
  const flatten = (p0, p1, p2, p3, depth) => {
    if (depth >= 16 || Math.max(chordDistance(p1, p0, p3), chordDistance(p2, p0, p3)) <= maxError) {
      current.push(p3)
      return
    }
    const a = midpoint(p0, p1), b = midpoint(p1, p2), c = midpoint(p2, p3)
    const d = midpoint(a, b), e = midpoint(b, c), m = midpoint(d, e)
    flatten(p0, a, d, m, depth + 1)
    flatten(m, e, c, p3, depth + 1)
  }
  while (index < tokens.length) {
    const command = tokens[index++]
    if (command === 'M') {
      current = [[number(), number()]]
      cursor = current[0]
    } else if (command === 'C') {
      while (index < tokens.length && !/[A-Za-z]/.test(tokens[index])) {
        const p1 = [number(), number()], p2 = [number(), number()], p3 = [number(), number()]
        flatten(cursor, p1, p2, p3, 0)
        cursor = p3
      }
    } else if (command === 'Z') {
      const first = current[0], last = current[current.length - 1]
      if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6) current.pop()
      contours.push(current)
      current = null
    } else throw new Error(`Unsupported path command "${command}" in the master SVG.`)
  }
  return contours
}

export function contains(polygon, [x, y]) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Even-odd nesting: contours at even depth are outlines, the odd ones directly inside them are their holes. */
export function nestedShapes(contours, toWorld) {
  const world = contours.map(contour => toWorld(contour))
  const depth = world.map((contour, i) => world.reduce((count, other, j) => (i !== j && contains(other, contour[0]) ? count + 1 : count), 0))
  const shapes = []
  world.forEach((contour, i) => {
    if (depth[i] % 2 !== 0) return
    shapes.push({ outer: contour, holes: world.filter((hole, j) => depth[j] === depth[i] + 1 && contains(contour, hole[0])) })
  })
  return shapes
}

export const isInside = (shape, point) => contains(shape.outer, point) && !shape.holes.some(hole => contains(hole, point))
export const toThreeShape = shape => {
  const result = new THREE.Shape(shape.outer.map(([x, y]) => new THREE.Vector2(x, y)))
  for (const hole of shape.holes) result.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))))
  return result
}
export const areaOf = polygon => {
  let sum = 0
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) sum += (polygon[j][0] * polygon[i][1]) - (polygon[i][0] * polygon[j][1])
  return sum / 2
}
export const shapeArea = shape => Math.abs(areaOf(shape.outer)) - shape.holes.reduce((sum, hole) => sum + Math.abs(areaOf(hole)), 0)

/**
 * A bevelled extrusion of `shapes`, centred in depth about z = 0. By default the bevel's widest point is exactly the SVG outline, so it never
 * grows into a gap next to a neighbouring part; `offset` moves the widest point out by `bevel + offset` instead (a lip grown round a shape).
 * Returns indexed, crease-shaded geometry.
 */
export function buildExtrusion(shapes, { depth, bevel, creaseAngle, bevelSegments = 3, offset = -bevel }) {
  let geometry = new THREE.ExtrudeGeometry(shapes.map(toThreeShape), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: offset,
    bevelSegments,
    curveSegments: 1,
    steps: 1,
  })
  geometry.deleteAttribute('uv')
  geometry.translate(0, 0, -depth / 2)
  geometry = toCreasedNormals(geometry, creaseAngle)
  geometry = mergeVertices(geometry, 1e-5)
  return {
    positions: new Float32Array(geometry.getAttribute('position').array),
    normals: new Float32Array(geometry.getAttribute('normal').array),
    indices: Uint32Array.from(geometry.getIndex().array),
  }
}

/**
 * Splits an indexed mesh ({ positions, normals, indices }) in two by a per-triangle test `keep(normal, centroid)` on the face normal and
 * centroid: [kept, rest], each re-indexed with only the vertices it uses.
 */
export function splitMesh(mesh, keep) {
  const out = [{ positions: [], normals: [], indices: [], map: new Map() }, { positions: [], normals: [], indices: [], map: new Map() }]
  const p = mesh.positions, n = mesh.normals
  const v = i => new THREE.Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2])
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [a, b, c] = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]]
    const pa = v(a), pb = v(b), pc = v(c)
    const face = new THREE.Vector3().crossVectors(pb.clone().sub(pa), pc.clone().sub(pa)).normalize()
    const centroid = pa.add(pb).add(pc).multiplyScalar(1 / 3)
    const target = out[keep(face, centroid) ? 0 : 1]
    for (const index of [a, b, c]) {
      let mapped = target.map.get(index)
      if (mapped === undefined) {
        mapped = target.positions.length / 3
        target.map.set(index, mapped)
        target.positions.push(p[index * 3], p[index * 3 + 1], p[index * 3 + 2])
        target.normals.push(n[index * 3], n[index * 3 + 1], n[index * 3 + 2])
      }
      target.indices.push(mapped)
    }
  }
  return out.map(part => ({ positions: new Float32Array(part.positions), normals: new Float32Array(part.normals), indices: Uint32Array.from(part.indices) }))
}

// ── Relief ────────────────────────────────────────────────────────────────────
export function hash2(a, b) {
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

export function distanceToBoundary(shape, point) {
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

/** Resamples a closed polyline to an even spacing, keeping every real corner (a turn sharper than `cornerAngle`) exactly. Returns [{ p, corner }]. */
export function resampleLoop(points, spacing, cornerAngle) {
  const count = points.length
  const corners = []
  for (let i = 0; i < count; i += 1) if (turningAngle(points[(i - 1 + count) % count], points[i], points[(i + 1) % count]) > cornerAngle) corners.push(i)
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
export function delaunay(points) {
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

/**
 * Appends one shape's rounded relief to `out` ({ positions, normals, films, indices, stats }).
 *
 * `relief`: { backZ, edgeZ, bevel, height, dome, domeReach, boundarySpacing, interiorSpacing, cornerAngle } - z runs from the flat back
 * (`backZ`) to the rim of the top surface (`edgeZ`); the top rises from the rim along a quarter ellipse `bevel` wide and `height` tall, then
 * by `dome` over the next `domeReach`.
 * `faceted`: null for the smooth pearl, or { boundarySpacing, interiorSpacing, jitter, bands } for the cut-crystal variant (flat bands, seeded
 * jitter, flat shading).
 * `film`: (x, y) -> 0-1 per-vertex `_FILM_THICKNESS`; `filmSide` is the value used on the back.
 * `smallShapeArea`: shapes smaller than this get a 0.6x finer mesh.
 */
export function buildReliefShape(shape, out, { relief, faceted = null, film, filmSide, smallShapeArea }) {
  const small = shapeArea(shape) < smallShapeArea
  const boundarySpacing = (faceted ? faceted.boundarySpacing : relief.boundarySpacing) * (small ? 0.6 : 1)
  const interiorSpacing = (faceted ? faceted.interiorSpacing : relief.interiorSpacing) * (small ? 0.6 : 1)

  // 1. The rim: every contour resampled to an even spacing.
  const loops = [shape.outer, ...shape.holes].map(loop => resampleLoop(loop, boundarySpacing, relief.cornerAngle))
  const points = [], boundary = []
  for (const loop of loops) for (const { p } of loop) { points.push(p); boundary.push(true) }

  // 2. Interior scatter: a jittered hex grid (the jitter keeps the Delaunay triangulation free of degenerate co-circular points), kept clear of the rim.
  const rowHeight = interiorSpacing * 0.866
  const xs = [...shape.outer.map(p => p[0])], ys = [...shape.outer.map(p => p[1])]
  const lowY = Math.min(...ys), highY = Math.max(...ys), reach = Math.max(Math.abs(Math.min(...xs)), Math.abs(Math.max(...xs)))
  for (let row = Math.floor(lowY / rowHeight); row <= Math.ceil(highY / rowHeight); row += 1) {
    const offset = row % 2 === 0 ? 0 : interiorSpacing / 2
    for (let column = -Math.ceil(reach / interiorSpacing) - 1; column <= Math.ceil(reach / interiorSpacing) + 1; column += 1) {
      const x = column * interiorSpacing + offset, y = row * rowHeight
      const side = x < 0 ? -1 : 1
      const jx = (hash2(Math.abs(x), y) - 0.5) * 0.3 * interiorSpacing
      const jy = (hash2(y, Math.abs(x) + 7.13) - 0.5) * 0.3 * interiorSpacing
      const q = [x + side * jx, y + jy]
      if (!isInside(shape, q) || distanceToBoundary(shape, q) < boundarySpacing * 0.5) continue
      points.push(q); boundary.push(false)
    }
  }

  // 3. Triangulate, then drop the triangles that fall in the cut-outs or outside the shape.
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

  // 4. Heights: a quarter ellipse up from the rim, then a gentle dome.
  const heights = points.map((p, i) => {
    if (boundary[i]) return relief.edgeZ
    const d = distanceToBoundary(shape, p)
    const t = Math.min(1, d / relief.bevel)
    const dome = relief.dome * Math.min(1, Math.max(0, d - relief.bevel) / relief.domeReach)
    if (!faceted) return relief.edgeZ + relief.height * Math.sqrt(1 - (1 - t) * (1 - t)) + dome
    // Cut profile: straight bands between the knots (distance fraction -> height fraction), plus a small mirror-symmetric jitter.
    let band = 0
    while (band < faceted.bands.length - 2 && t > faceted.bands[band + 1][0]) band += 1
    const [t0, h0] = faceted.bands[band], [t1, h1] = faceted.bands[band + 1]
    const h = h0 + ((h1 - h0) * (t - t0)) / (t1 - t0)
    return relief.edgeZ + relief.height * h + dome + (hash2(Math.abs(p[0]) + 9.1, p[1] - 4.4) - 0.5) * 2 * faceted.jitter
  })

  // 5. Smooth normals: each point averages the (area-weighted) normals of the top triangles around it.
  const triangles = kept.map(([a, b, c]) => {
    const p0 = [points[a][0], points[a][1], heights[a]], p1 = [points[b][0], points[b][1], heights[b]], p2 = [points[c][0], points[c][1], heights[c]]
    const n = [(p1[1] - p0[1]) * (p2[2] - p0[2]) - (p1[2] - p0[2]) * (p2[1] - p0[1]), (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]), (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0])]
    return n[2] < 0 ? { v: [a, c, b], n: [-n[0], -n[1], -n[2]] } : { v: [a, b, c], n }
  })
  const normals = points.map(() => [0, 0, 0])
  for (const { v, n } of triangles) for (const index of v) { normals[index][0] += n[0]; normals[index][1] += n[1]; normals[index][2] += n[2] }
  const unit = n => { const l = Math.hypot(n[0], n[1], n[2]) || 1; return [n[0] / l, n[1] / l, n[2] / l] }

  // 6. Emit: the smooth top (indexed per point), the same triangles mirrored for the flat back, and the side walls.
  if (faceted) {
    // Flat facets: every top triangle gets its own three vertices with its face normal.
    for (const { v, n } of triangles) {
      const normal = unit(n)
      for (const index of v) {
        out.indices.push(out.positions.length / 3)
        out.positions.push(points[index][0], points[index][1], heights[index]); out.normals.push(...normal); out.films.push(film(points[index][0], points[index][1]))
      }
    }
  } else {
    const base = out.positions.length / 3
    points.forEach((p, i) => { out.positions.push(p[0], p[1], heights[i]); out.normals.push(...unit(normals[i])); out.films.push(film(p[0], p[1])) })
    for (const { v } of triangles) out.indices.push(base + v[0], base + v[1], base + v[2])
  }
  const push = (position, normal, value = filmSide) => { const index = out.positions.length / 3; out.positions.push(...position); out.normals.push(...normal); out.films.push(value); out.indices.push(index) }
  const back = out.positions.length / 3
  points.forEach(p => { out.positions.push(p[0], p[1], relief.backZ); out.normals.push(0, 0, -1); out.films.push(filmSide) })
  for (const { v } of triangles) out.indices.push(back + v[0], back + v[2], back + v[1])
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
      const lowA = [a.p[0], a.p[1], relief.backZ], lowB = [b.p[0], b.p[1], relief.backZ]
      const wall = (v0, n0, v1, n1, v2, n2) => {
        // Wind so the face normal points along the outward wall normal.
        const u = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]], w = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]]
        const face = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]
        const flip = face[0] * own[0] + face[1] * own[1] < 0
        const ordered = flip ? [[v0, n0], [v2, n2], [v1, n1]] : [[v0, n0], [v1, n1], [v2, n2]]
        for (const [vertex, n] of ordered) push(vertex, [n[0], n[1], 0], film(vertex[0], vertex[1]))
      }
      wall(topA, na, lowA, na, lowB, nb)
      wall(topA, na, lowB, nb, topB, nb)
    }
    start += count
  }
  out.stats.push({ points: points.length, facets: kept.length, areaRatio: triangleArea / expected, rimMissing, small })
}

/** Throws when a relief left gaps in a shape or lost a rim edge. */
export function assertReliefStats(stats, label) {
  for (const stat of stats) {
    if (Math.abs(stat.areaRatio - 1) > 0.01) throw new Error(`The facets cover ${(stat.areaRatio * 100).toFixed(2)}% of a ${label} shape (expected 100%): the triangulation left gaps.`)
    if (stat.rimMissing > 0) throw new Error(`${stat.rimMissing} rim edge(s) of a ${label} shape are not edges of the triangulation.`)
  }
}
