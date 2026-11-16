// Sound Drawing XY › WIREFRAME: bounded deformation and the readability guard (the guide's §17.1 and §23).
//
//   P_render = P_base + w · D(P_base)
//
// P_base is the cube cluster as it is placed this frame. D is what the music does to it: the cubes swell, expand, lean and shimmer. Three
// guarantees come from this shape, and each has a test:
//   1. Anchor bound: no corner ever moves more than `limit` (a share of its cube's edge) from where it is placed, however loud the music.
//   2. Readability: a cube must keep looking like a cube. If the movement would push the figure past the user's floor, the weight w is eased
//      back (by bisection) until the figure holds, rather than being cut off.
//   3. Exact recovery: with w = 0, or every driver released, the result is exactly P_base.
// Rigid movement of a whole cube (the orbit, its turn, the mid-band lean) is placement, not deformation, so it is never counted against
// the limit; only a cube changing shape is.

import { quatRotate, rotateProject4, type Quat } from './XyScopeWireProject'
import type { WireShape } from './XyScopeWireShape'


export interface CubePlacement {
  cx: number; cy: number; cz: number
  q: Quat
  scale: number
  /** The tesseract's turns in the xw, yw and zw planes (radians). Ignored by the 3D solids. */
  hyper?: readonly [number, number, number]
}

/** Writes each solid's corners, rotated, scaled and moved into place, into `out` (three floats per corner). */
export function placeShape(shape: WireShape, placements: readonly CubePlacement[], out: Float32Array): void {
  const tmp = new Float32Array(3), hyper = new Float32Array(3)
  placements.forEach((p, k) => {
    const g = shape.groups[k]
    for (let i = 0; i < g.vertexCount; i++) {
      const v = (g.vertexStart + i) * 3
      let x = shape.vertices[v], y = shape.vertices[v + 1], z = shape.vertices[v + 2]
      if (g.kind === 'tesseract' && p.hyper) {
        rotateProject4(x, y, z, shape.vertexW[g.vertexStart + i], p.hyper[0], p.hyper[1], p.hyper[2], hyper)
        x = hyper[0]; y = hyper[1]; z = hyper[2]
      }
      quatRotate(p.q, x * p.scale, y * p.scale, z * p.scale, tmp)
      out[v] = tmp[0] + p.cx; out[v + 1] = tmp[1] + p.cy; out[v + 2] = tmp[2] + p.cz
    }
  })
}

/** What the music asks of the cubes' shape, as fractions of a cube's edge. */
export interface DeformDrive {
  cubeScale: number
  expand: number
  shear: number
  wobble: number
  time: number
  /** 0..1: makes the shimmer faster, larger and less regular (it is still bounded by the anchor limit). */
  chaos?: number
}

/** The displacement every corner would move at full weight, clamped to the anchor bound. */
export function displacementField(shape: WireShape, base: Float32Array, placements: readonly CubePlacement[], drive: DeformDrive, limit: number, out: Float32Array): void {
  const radial = drive.cubeScale + drive.expand
  placements.forEach((p, k) => {
    const g = shape.groups[k]
    const edge = g.edgeLength * p.scale, bound = limit * edge
    for (let i = 0; i < g.vertexCount; i++) {
      const v = (g.vertexStart + i) * 3, id = g.vertexStart + i
      const rx = base[v] - p.cx, ry = base[v + 1] - p.cy, rz = base[v + 2] - p.cz
      let dx = rx * radial + drive.shear * ry
      let dy = ry * radial
      let dz = rz * radial
      // Shimmer: three slow sines per corner, deterministic (the same time and corner always give the same offset).
      const chaos = drive.chaos ?? 0
      const w = edge * drive.wobble * (1 + chaos * 1.6), rate = 1 + chaos * 2.2
      dx += w * (Math.sin(3.1 * rate * drive.time + 1.7 * id) + chaos * .6 * Math.sin(7.7 * drive.time + 5.3 * id * id))
      dy += w * (Math.sin(4.3 * rate * drive.time + 2.3 * id) + chaos * .6 * Math.sin(6.1 * drive.time + 3.7 * id * id))
      dz += w * (Math.sin(2.9 * rate * drive.time + 3.1 * id) + chaos * .6 * Math.sin(8.3 * drive.time + 2.9 * id * id))
      const length = Math.hypot(dx, dy, dz)
      const scale = length > bound && length > 0 ? bound / length : 1
      out[v] = dx * scale; out[v + 1] = dy * scale; out[v + 2] = dz * scale
    }
  })
}

export interface Readability {
  /** 1 is the figure exactly as placed; lower is less like itself. */
  score: number
  /** The largest corner displacement as a share of the anchor bound (0..1). */
  displacement: number
  /** The largest change in any edge's length, as a share of that edge. */
  stretch: number
}

const STRETCH_CAP = .5

/** Scores the figure at weight `w`: the corners move by w · field. Reads only the first `cubes` groups. */
export function measureReadability(shape: WireShape, base: Float32Array, field: Float32Array, w: number, placements: readonly CubePlacement[], limit: number): Readability {
  let stretch = 0, displacement = 0
  placements.forEach((p, k) => {
    const g = shape.groups[k], bound = Math.max(1e-9, limit * g.edgeLength * p.scale)
    for (let i = 0; i < g.vertexCount; i++) {
      const v = (g.vertexStart + i) * 3
      displacement = Math.max(displacement, Math.hypot(field[v], field[v + 1], field[v + 2]) * w / bound)
    }
    for (let e = g.edgeStart; e < g.edgeStart + g.edgeCount; e++) {
      const a = shape.edges[e * 2] * 3, b = shape.edges[e * 2 + 1] * 3
      const l0 = Math.hypot(base[a] - base[b], base[a + 1] - base[b + 1], base[a + 2] - base[b + 2])
      const l1 = Math.hypot(base[a] + w * field[a] - base[b] - w * field[b], base[a + 1] + w * field[a + 1] - base[b + 1] - w * field[b + 1], base[a + 2] + w * field[a + 2] - base[b + 2] - w * field[b + 2])
      if (l0 > 0) stretch = Math.max(stretch, Math.abs(l1 / l0 - 1))
    }
  })
  displacement = Math.min(1, displacement)
  return { score: 1 - .6 * Math.min(1, stretch / STRETCH_CAP) - .4 * displacement, displacement, stretch }
}

/**
 * The largest weight in [0, 1] at which the figure still scores at least `floor`. Both the stretch and the displacement grow with the
 * weight, so the score only falls as w rises, and bisection finds the boundary.
 */
export function constrainWeight(shape: WireShape, base: Float32Array, field: Float32Array, placements: readonly CubePlacement[], limit: number, floor: number, steps = 7): { weight: number; readability: Readability } {
  const full = measureReadability(shape, base, field, 1, placements, limit)
  if (full.score >= floor) return { weight: 1, readability: full }
  let lo = 0, hi = 1
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2
    if (measureReadability(shape, base, field, mid, placements, limit).score >= floor) lo = mid; else hi = mid
  }
  return { weight: lo, readability: measureReadability(shape, base, field, lo, placements, limit) }
}

/** deformed = base + w · field (corners of the given cubes only). */
export function applyField(shape: WireShape, base: Float32Array, field: Float32Array, w: number, cubes: number, out: Float32Array): void {
  const last = shape.groups[Math.min(cubes, shape.groups.length) - 1]
  const end = (last.vertexStart + last.vertexCount) * 3
  for (let v = 0; v < end; v++) out[v] = base[v] + w * field[v]
}

