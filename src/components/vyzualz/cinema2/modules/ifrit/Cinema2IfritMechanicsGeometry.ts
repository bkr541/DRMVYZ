/**
 * Shared static meshes for the instanced Ifrit parts. Interleaved, 7 floats per vertex: position (3), normal (3), role (1).
 * Roles: 0 dark red body, 1 orange emission, 3 corner highlight, 5 an edge's corner link (drawn only on the first section of an edge).
 */
export interface IfritMesh { readonly vertices: Float32Array; readonly indices: Uint16Array }
export const IFRIT_MESH_STRIDE_FLOATS = 7
type V3 = readonly [number, number, number]

export class IfritMeshBuilder {
  private readonly vertices: number[] = []
  private readonly indices: number[] = []
  private vertex(p: V3, n: V3, role: number): number {
    this.vertices.push(p[0], p[1], p[2], n[0], n[1], n[2], role)
    return this.vertices.length / IFRIT_MESH_STRIDE_FLOATS - 1
  }
  /** A planar polygon (counter-clockwise seen from the normal's side) with one flat normal. */
  polygon(points: readonly V3[], normal: V3, role: number): void {
    const first = points.map(point => this.vertex(point, normal, role))
    for (let i = 1; i < first.length - 1; i++) this.indices.push(first[0]!, first[i]!, first[i + 1]!)
  }
  box(center: V3, half: V3, role: number): void {
    const [cx, cy, cz] = center, [hx, hy, hz] = half
    const p = (sx: number, sy: number, sz: number): V3 => [cx + sx * hx, cy + sy * hy, cz + sz * hz]
    this.polygon([p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), p(1, -1, 1)], [1, 0, 0], role)
    this.polygon([p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1), p(-1, -1, -1)], [-1, 0, 0], role)
    this.polygon([p(-1, 1, -1), p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1)], [0, 1, 0], role)
    this.polygon([p(-1, -1, 1), p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1)], [0, -1, 0], role)
    this.polygon([p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1)], [0, 0, 1], role)
    this.polygon([p(1, -1, -1), p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1)], [0, 0, -1], role)
  }
  /** Extrudes a convex-or-star outline (counter-clockwise, in xy) between z0 and z1. Side normals are flat per edge. */
  prism(outline: readonly (readonly [number, number])[], z0: number, z1: number, role: number, capRole = role): void {
    this.polygon(outline.map(([x, y]) => [x, y, z1] as V3), [0, 0, 1], capRole)
    this.polygon([...outline].reverse().map(([x, y]) => [x, y, z0] as V3), [0, 0, -1], role)
    for (let i = 0; i < outline.length; i++) {
      const [ax, ay] = outline[i]!, [bx, by] = outline[(i + 1) % outline.length]!
      const length = Math.hypot(bx - ax, by - ay) || 1
      this.polygon([[ax, ay, z0], [bx, by, z0], [bx, by, z1], [ax, ay, z1]], [(by - ay) / length, -(bx - ax) / length, 0], role)
    }
  }
  build(): IfritMesh {
    if (this.vertices.length / IFRIT_MESH_STRIDE_FLOATS > 65535) throw new Error('Ifrit mesh exceeds 16-bit indices.')
    return Object.freeze({ vertices: new Float32Array(this.vertices), indices: new Uint16Array(this.indices) })
  }
}

/** A telescoping spoke: a bar along +x from its base (x 0..1, scaled by its length) with an orange rail and a bright tip. */
export function buildIfritSpokeMesh(): IfritMesh {
  const b = new IfritMeshBuilder()
  b.box([0.5, 0, 0], [0.5, 0.5, 0.5], 0)
  b.box([0.5, 0, 0.5], [0.5, 0.16, 0.03], 1)
  b.box([0.95, 0, 0], [0.05, 0.62, 0.62], 3)
  return b.build()
}
export const IFRIT_GEAR_TEETH = 12
/** A toothed rotor of unit radius in the xy plane, z -0.5..0.5, with an orange hub and bright tooth tips. */
export function buildIfritGearMesh(): IfritMesh {
  const b = new IfritMeshBuilder()
  const outline: [number, number][] = []
  const step = Math.PI * 2 / IFRIT_GEAR_TEETH
  for (let i = 0; i < IFRIT_GEAR_TEETH; i++) {
    const a = i * step
    for (const [offset, radius] of [[-0.34, 0.78], [-0.2, 1], [0.2, 1], [0.34, 0.78]] as const) outline.push([Math.cos(a + offset * step * 1.5) * radius, Math.sin(a + offset * step * 1.5) * radius])
  }
  b.prism(outline, -0.5, 0.5, 0)
  for (let i = 0; i < IFRIT_GEAR_TEETH; i++) {
    const a = i * step
    const p = (offset: number, radius: number): [number, number, number] => [Math.cos(a + offset * step * 1.5) * radius, Math.sin(a + offset * step * 1.5) * radius, 0.51]
    b.polygon([p(-0.2, 0.88), p(0.2, 0.88), p(0.2, 1), p(-0.2, 1)], [0, 0, 1], 3)
  }
  // An orange emissive rim on the rotor's face, between the hub and the teeth.
  const rimSegments = 24
  for (let i = 0; i < rimSegments; i++) {
    const a0 = i / rimSegments * Math.PI * 2, a1 = (i + 1) / rimSegments * Math.PI * 2
    b.polygon([[Math.cos(a0) * 0.5, Math.sin(a0) * 0.5, 0.52], [Math.cos(a1) * 0.5, Math.sin(a1) * 0.5, 0.52], [Math.cos(a1) * 0.74, Math.sin(a1) * 0.74, 0.52], [Math.cos(a0) * 0.74, Math.sin(a0) * 0.74, 0.52]] as V3[], [0, 0, 1], 1)
  }
  const hub: [number, number][] = Array.from({ length: 10 }, (_, i) => [Math.cos(i / 10 * Math.PI * 2) * 0.3, Math.sin(i / 10 * Math.PI * 2) * 0.3])
  b.polygon(hub.map(([x, y]) => [x, y, 0.53] as V3), [0, 0, 1], 1)
  return b.build()
}
/** An angular blade pivoting about its base (the origin): a kite along +x, y -0.5..0.5, z -0.5..0.5, with a bright tip. */
export function buildIfritBladeMesh(): IfritMesh {
  const b = new IfritMeshBuilder()
  b.prism([[0, 0], [0.22, -0.5], [1, 0], [0.22, 0.5]], -0.5, 0.5, 0)
  b.polygon([[0.78, 0, 0.51], [0.9, -0.08, 0.51], [1, 0, 0.51], [0.9, 0.08, 0.51]] as V3[], [0, 0, 1], 3)
  b.polygon([[0.04, 0, 0.52], [0.22, -0.3, 0.52], [0.56, 0, 0.52], [0.22, 0.3, 0.52]] as V3[], [0, 0, 1], 1)
  return b.build()
}
/** A small octahedron of unit radius. */
export function buildIfritSatelliteMesh(): IfritMesh {
  const b = new IfritMeshBuilder()
  const top: V3 = [0, 0, 1], bottom: V3 = [0, 0, -1]
  const ring: V3[] = [[1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, -1, 0]]
  for (let i = 0; i < 4; i++) {
    const a = ring[i]!, c = ring[(i + 1) % 4]!
    const n = (p: V3, q: V3, r: V3): V3 => {
      const u: V3 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], v: V3 = [r[0] - p[0], r[1] - p[1], r[2] - p[2]]
      const x: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
      const l = Math.hypot(...x) || 1
      return [x[0] / l, x[1] / l, x[2] / l]
    }
    b.polygon([a, c, top], n(a, c, top), 1)
    b.polygon([c, a, bottom], n(c, a, bottom), i % 2 ? 1 : 3)
  }
  return b.build()
}
