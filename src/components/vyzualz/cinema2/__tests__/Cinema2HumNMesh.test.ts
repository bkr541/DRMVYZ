import { describe, expect, it } from 'vitest'
import {
  CINEMA2_HUMN_BONE_COUNT,
  CINEMA2_HUMN_REGION,
  CINEMA2_HUMN_VERTEX_FLOATS,
  buildCinema2HumNMesh,
} from '../modules/humn/Cinema2HumNMesh'

const F = CINEMA2_HUMN_VERTEX_FLOATS

interface Vertex {
  position: [number, number, number]
  normal: [number, number, number]
  skin: [number, number, number]
  center: [number, number, number]
  info: [number, number, number, number]
  edges: [number, number, number]
}

function vertex(data: Float32Array, index: number): Vertex {
  const o = index * F
  const at = (offset: number, count: number) => Array.from(data.slice(o + offset, o + offset + count))
  return {
    position: at(0, 3) as Vertex['position'],
    normal: at(3, 3) as Vertex['normal'],
    skin: at(6, 3) as Vertex['skin'],
    center: at(9, 3) as Vertex['center'],
    info: at(12, 4) as Vertex['info'],
    edges: at(16, 3) as Vertex['edges'],
  }
}

describe('HUM:N figure mesh', () => {
  const mesh = buildCinema2HumNMesh(1)

  it('is a real 3D low-poly figure of a few hundred to a couple of thousand triangles, and the dense one has many more', () => {
    expect(mesh.triangleCount).toBeGreaterThan(600)
    expect(mesh.triangleCount).toBeLessThan(2000)
    expect(mesh.vertexCount).toBe(mesh.triangleCount * 3)
    expect(mesh.data).toHaveLength(mesh.vertexCount * F)
    const dense = buildCinema2HumNMesh(2)
    expect(dense.triangleCount).toBeGreaterThan(mesh.triangleCount * 2.5)
  })

  it('is deterministic and cached per density', () => {
    expect(buildCinema2HumNMesh(1)).toBe(mesh)
    expect(buildCinema2HumNMesh(2)).not.toBe(mesh)
  })

  it('has finite data, valid bone indices and skin weights, and real depth (not a flat drawing)', () => {
    let minZ = Infinity
    let maxZ = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (let index = 0; index < mesh.vertexCount; index += 1) {
      const v = vertex(mesh.data, index)
      for (const value of [...v.position, ...v.normal, ...v.skin, ...v.center, ...v.info, ...v.edges]) expect(Number.isFinite(value)).toBe(true)
      expect(Number.isInteger(v.skin[0])).toBe(true)
      expect(Number.isInteger(v.skin[1])).toBe(true)
      expect(v.skin[0]).toBeGreaterThanOrEqual(0)
      expect(v.skin[0]).toBeLessThan(CINEMA2_HUMN_BONE_COUNT)
      expect(v.skin[1]).toBeLessThan(CINEMA2_HUMN_BONE_COUNT)
      expect(v.skin[2]).toBeGreaterThanOrEqual(0)
      expect(v.skin[2]).toBeLessThanOrEqual(1)
      minZ = Math.min(minZ, v.position[2])
      maxZ = Math.max(maxZ, v.position[2])
      minY = Math.min(minY, v.position[1])
      maxY = Math.max(maxY, v.position[1])
    }
    // A head that is a couple of tenths of a metre deep, with a nose that stands out, on a torso: real X, Y and Z extents.
    expect(maxZ - minZ).toBeGreaterThan(0.2)
    expect(maxY).toBeGreaterThan(0.85)
    expect(maxY).toBeLessThan(1.05)
    expect(minY).toBeLessThan(0.05)
  })

  it('winds every triangle outward (so back faces can be culled) and keeps the stored normal on the front side', () => {
    let inward = 0
    for (let triangle = 0; triangle < mesh.triangleCount; triangle += 1) {
      const a = vertex(mesh.data, triangle * 3)
      const b = vertex(mesh.data, triangle * 3 + 1)
      const c = vertex(mesh.data, triangle * 3 + 2)
      const e1 = [b.position[0] - a.position[0], b.position[1] - a.position[1], b.position[2] - a.position[2]] as const
      const e2 = [c.position[0] - a.position[0], c.position[1] - a.position[1], c.position[2] - a.position[2]] as const
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
      const length = Math.hypot(...n)
      if (length < 1e-12) continue
      const dot = (n[0]! * a.normal[0] + n[1]! * a.normal[1] + n[2]! * a.normal[2]) / length
      if (dot < 0.99) inward += 1
    }
    expect(inward).toBe(0)
  })

  it('gives all three vertices of a triangle the same centre, rank, seed and edge data, and keeps ranks in [0, 1)', () => {
    const ranks = new Set<number>()
    for (let triangle = 0; triangle < mesh.triangleCount; triangle += 1) {
      const a = vertex(mesh.data, triangle * 3)
      const b = vertex(mesh.data, triangle * 3 + 1)
      const c = vertex(mesh.data, triangle * 3 + 2)
      expect(b.center).toEqual(a.center)
      expect(c.center).toEqual(a.center)
      expect(b.info.slice(0, 3)).toEqual(a.info.slice(0, 3))
      expect(c.info.slice(0, 3)).toEqual(a.info.slice(0, 3))
      expect(b.edges).toEqual(a.edges)
      expect(a.info[0]).toBeGreaterThanOrEqual(0)
      expect(a.info[0]).toBeLessThan(1)
      ranks.add(a.info[0])
    }
    // Ranks are spread out, so a fill fraction picks a fraction of the triangles.
    expect(ranks.size).toBeGreaterThan(mesh.triangleCount * 0.95)
  })

  it('picks about the requested share of triangles for a fill amount, spread over the whole body', () => {
    for (const fill of [0.25, 0.5, 0.75]) {
      let chosen = 0
      let chosenHead = 0
      let head = 0
      for (let triangle = 0; triangle < mesh.triangleCount; triangle += 1) {
        const v = vertex(mesh.data, triangle * 3)
        const on = v.info[0] < fill
        if (on) chosen += 1
        if (v.center[1] > 0.6) {
          head += 1
          if (on) chosenHead += 1
        }
      }
      expect(chosen / mesh.triangleCount).toBeGreaterThan(fill - 0.06)
      expect(chosen / mesh.triangleCount).toBeLessThan(fill + 0.06)
      expect(chosenHead / head).toBeGreaterThan(fill - 0.12)
      expect(chosenHead / head).toBeLessThan(fill + 0.12)
    }
  })

  it('shares each edge between two triangles with the same rank and opposite walking direction, so a fragmented edge is open from both sides', () => {
    const edges = new Map<string, { rank: number; flip: number }[]>()
    const key = (p: readonly number[]) => p.map(value => Math.round(value * 2000)).join(',')
    for (let triangle = 0; triangle < mesh.triangleCount; triangle += 1) {
      const v = [0, 1, 2].map(k => vertex(mesh.data, triangle * 3 + k))
      // Edge k is opposite vertex k.
      for (let k = 0; k < 3; k += 1) {
        const p = v[(k + 1) % 3]!.position
        const q = v[(k + 2) % 3]!.position
        const id = [key(p), key(q)].sort().join('|')
        const value = v[0]!.edges[k]!
        const list = edges.get(id) ?? []
        list.push({ rank: value % 2, flip: value >= 2 ? 1 : 0 })
        edges.set(id, list)
      }
    }
    let shared = 0
    for (const list of edges.values()) {
      if (list.length !== 2) continue
      shared += 1
      expect(list[0]!.rank).toBeCloseTo(list[1]!.rank, 6)
      expect(list[0]!.flip).not.toBe(list[1]!.flip)
    }
    expect(shared).toBeGreaterThan(mesh.triangleCount)
  })

  it('draws the eyes as two fans of eye-region triangles and everything else as skin', () => {
    let eye = 0
    for (let triangle = 0; triangle < mesh.triangleCount; triangle += 1) {
      if (vertex(mesh.data, triangle * 3).info[1] === CINEMA2_HUMN_REGION.eye) eye += 1
    }
    expect(eye).toBe(16)
  })
})
