import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BWC_CAN_HEIGHT_M,
  BWC_CAN_FACE_PHASE_DEG,
  BWC_CAN_HERO_SCALE,
  BWC_CAN_PROFILE_APOTHEM_M,
  BWC_CAN_PROFILE_MM,
  BWC_CAN_SIDES,
  BWC_CAN_TAB_POLYGON_MM,
  BWC_CAN_TAB_Y_MM,
  bwcCanGlsl,
  bwcCanSdf,
} from '../modules/bwc/Cinema2BwcCanModel'

/** Reads positions and triangle indices out of the prepared artifact (a single-mesh GLB). */
function readArtifact() {
  const file = readFileSync(join(process.cwd(), 'docs/BWC/BWC_Can_Plain_Ready.glb'))
  expect(file.readUInt32LE(0)).toBe(0x46546c67)
  let offset = 12
  let json: { accessors: { count: number; bufferView: number; byteOffset?: number }[]; bufferViews: { byteOffset: number }[]; meshes: { name: string; primitives: { attributes: { POSITION: number }; indices: number }[] }[] } | null = null
  let bin: Buffer | null = null
  while (offset < file.length) {
    const length = file.readUInt32LE(offset)
    const type = file.readUInt32LE(offset + 4)
    const chunk = file.subarray(offset + 8, offset + 8 + length)
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'))
    else if (type === 0x004e4942) bin = chunk
    offset += 8 + length
  }
  if (!json || !bin) throw new Error('GLB chunks missing')
  const primitive = json.meshes[0]!.primitives[0]!
  const read = (accessorIndex: number, components: number, size: 4) => {
    const accessor = json!.accessors[accessorIndex]!
    const start = json!.bufferViews[accessor.bufferView]!.byteOffset + (accessor.byteOffset ?? 0)
    return Array.from({ length: accessor.count * components }, (_, i) => size === 4 ? bin!.readFloatLE(start + i * 4) : 0)
  }
  const positions = read(primitive.attributes.POSITION, 3, 4)
  const indexAccessor = json.accessors[primitive.indices]!
  const indexStart = json.bufferViews[indexAccessor.bufferView]!.byteOffset + (indexAccessor.byteOffset ?? 0)
  const indices = Array.from({ length: indexAccessor.count }, (_, i) => bin!.readUInt32LE(indexStart + i * 4))
  return { name: json.meshes[0]!.name, positions, indices }
}

const artifact = readArtifact()
const vertex = (i: number) => [artifact.positions[i * 3]!, artifact.positions[i * 3 + 1]!, artifact.positions[i * 3 + 2]!] as const
const vertexCount = artifact.positions.length / 3
const TOLERANCE_M = 5e-6 // 5 micrometres: the profile is stored to the micrometre
type Vec3 = readonly [number, number, number]

/** Distance from a point to a triangle (Ericson, Real-Time Collision Detection). */
function pointTriangleDistance(p: Vec3, tri: readonly Vec3[]): number {
  const [a, b, c] = tri as [Vec3, Vec3, Vec3]
  const sub = (u: Vec3, v: Vec3): Vec3 => [u[0] - v[0], u[1] - v[1], u[2] - v[2]]
  const dot = (u: Vec3, v: Vec3) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a)
  const d1 = dot(ab, ap), d2 = dot(ac, ap)
  let q: Vec3
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp)
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp)
  const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4
  const at = (t: number, u: Vec3, o: Vec3): Vec3 => [o[0] + u[0] * t, o[1] + u[1] * t, o[2] + u[2] * t]
  if (d1 <= 0 && d2 <= 0) q = a
  else if (d3 >= 0 && d4 <= d3) q = b
  else if (vc <= 0 && d1 >= 0 && d3 <= 0) q = at(d1 / (d1 - d3), ab, a)
  else if (d6 >= 0 && d5 <= d6) q = c
  else if (vb <= 0 && d2 >= 0 && d6 <= 0) q = at(d2 / (d2 - d6), ac, a)
  else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) q = at((d4 - d3) / ((d4 - d3) + (d5 - d6)), sub(c, b), b)
  else {
    const denom = 1 / (va + vb + vc)
    q = [a[0] + ab[0] * vb * denom + ac[0] * vc * denom, a[1] + ab[1] * vb * denom + ac[1] * vc * denom, a[2] + ab[2] * vb * denom + ac[2] * vc * denom]
  }
  const r = sub(p, q)
  return Math.sqrt(dot(r, r))
}

describe('BWC can matches docs/BWC/BWC_Can_Plain_Ready.glb', () => {
  it('reads the plain can artifact', () => {
    expect(artifact.name).toBe('BWC_CAN_PLAIN')
    expect(vertexCount).toBe(440)
    expect(artifact.indices.length / 3).toBe(456)
  })

  it('puts every visible vertex of the mesh on the model surface and none outside it', () => {
    const hidden: number[] = []
    for (let i = 0; i < vertexCount; i++) {
      const [x, y, z] = vertex(i)
      const distance = bwcCanSdf(x, y, z)
      expect(distance, `vertex ${i}`).toBeLessThan(TOLERANCE_M) // the mesh never pokes outside the model
      if (distance < -TOLERANCE_M) hidden.push(i)
    }
    // The only vertices below the surface are the tab's underside, 0.044 mm inside the lid it stands on.
    for (const i of hidden) {
      const y = vertex(i)[1] * 1000
      expect(Math.abs(y - 166.77), `vertex ${i} at ${y.toFixed(3)} mm`).toBeLessThan(0.01)
    }
    expect(hidden).toHaveLength(32)
    expect(vertexCount - hidden.length).toBeGreaterThan(vertexCount * 0.9)
  })

  it('puts every visible triangle on the model surface and none outside it', () => {
    let visible = 0
    for (let t = 0; t < artifact.indices.length; t += 3) {
      const corners = [0, 1, 2].map(k => vertex(artifact.indices[t + k]!))
      const centre = [0, 1, 2].map(k => (corners[0]![k]! + corners[1]![k]! + corners[2]![k]!) / 3) as [number, number, number]
      const distance = bwcCanSdf(...centre)
      expect(distance, `triangle ${t / 3}`).toBeLessThan(TOLERANCE_M)
      if (distance >= -TOLERANCE_M) visible++
    }
    // Eight triangles are buried: the tab's octagonal underside (6) and the two lid triangles beneath the tab.
    expect(visible).toBe(artifact.indices.length / 3 - 8)
  })

  it('has no surface the mesh lacks: points on the model\'s own surface lie on a mesh triangle', () => {
    const triangles = Array.from({ length: artifact.indices.length / 3 }, (_, t) => [0, 1, 2].map(k => vertex(artifact.indices[t * 3 + k]!)))
    const samples: [number, number, number][] = []
    const sector = (Math.PI * 2) / BWC_CAN_SIDES
    const phase = (BWC_CAN_FACE_PHASE_DEG * Math.PI) / 180
    for (let e = 0; e < BWC_CAN_PROFILE_APOTHEM_M.length - 1; e++) {
      const [ax, ay] = BWC_CAN_PROFILE_APOTHEM_M[e]!
      const [bx, by] = BWC_CAN_PROFILE_APOTHEM_M[e + 1]!
      if (ax === 0 && bx === 0) continue
      for (let step = 1; step < 5; step++) {
        const u = step / 5
        const flat = ax + (bx - ax) * u, y = ay + (by - ay) * u
        for (let face = 0; face < BWC_CAN_SIDES; face++) {
          for (const along of [0, 0.4]) {
            const angle = phase + face * sector
            // A point `along` (fraction of the half-face) to the side of the face centre, on the same flat face.
            const half = flat * Math.tan(sector / 2) * along
            samples.push([flat * Math.cos(angle) - half * Math.sin(angle), y, flat * Math.sin(angle) + half * Math.cos(angle)])
          }
        }
      }
    }
    // The model's own top face of the tab and its rim, too.
    const surfacePoints = samples.filter(point => Math.abs(bwcCanSdf(...point)) < TOLERANCE_M)
    expect(surfacePoints.length).toBeGreaterThan(samples.length * 0.8)
    let worst = 0
    for (const point of surfacePoints) {
      let nearest = Infinity
      for (const triangle of triangles) nearest = Math.min(nearest, pointTriangleDistance(point, triangle as Vec3[]))
      worst = Math.max(worst, nearest)
    }
    expect(worst).toBeLessThan(TOLERANCE_M * 2)
  })

  it('has the artifact\'s height, eighteen sides and base-centre pivot', () => {
    const ys = Array.from({ length: vertexCount }, (_, i) => vertex(i)[1])
    expect(Math.min(...ys)).toBeCloseTo(0, 6)
    expect(Math.max(...ys)).toBeCloseTo(BWC_CAN_HEIGHT_M, 6)
    expect(BWC_CAN_SIDES).toBe(18)
    const bodyRing = new Set(Array.from({ length: vertexCount }, (_, i) => vertex(i)).filter(v => Math.abs(v[1] - 0.156568) < 1e-5).map(v => `${v[0].toFixed(5)},${v[2].toFixed(5)}`))
    expect(bodyRing.size).toBe(18)
    // Inside is inside, outside is outside.
    expect(bwcCanSdf(0.001, 0.08, 0)).toBeLessThan(0)
    expect(bwcCanSdf(0.05, 0.08, 0)).toBeGreaterThan(0)
    expect(bwcCanSdf(0, 0.2, 0)).toBeGreaterThan(0)
    // The pull tab stands proud of the lid by about a millimetre.
    expect(bwcCanSdf(-0.0125, 0.16725, 0.0115)).toBeLessThan(0)
    expect(bwcCanSdf(-0.0125, 0.1685, 0.0115)).toBeGreaterThan(0)
  })

  it('is enlarged to the manifest\'s 1 m hero height', () => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), 'docs/BWC/BWC_3D_Scene_Manifest.json'), 'utf8')) as { can: { preparedAssetHeight_m: number; factoryArtDirectedHeight_m: number; scaleFactorInFactory: number } }
    expect(BWC_CAN_HEIGHT_M).toBe(manifest.can.preparedAssetHeight_m)
    expect(BWC_CAN_HERO_SCALE).toBeCloseTo(manifest.can.scaleFactorInFactory, 6)
    expect(BWC_CAN_HEIGHT_M * BWC_CAN_HERO_SCALE).toBeCloseTo(manifest.can.factoryArtDirectedHeight_m, 9)
  })

  it('hands the shader the same profile and tab the CPU model uses', () => {
    const glsl = bwcCanGlsl()
    expect(glsl).toContain(`const int CAN_PROFILE_COUNT = ${BWC_CAN_PROFILE_MM.length};`)
    expect(glsl).toContain(`const int CAN_TAB_COUNT = ${BWC_CAN_TAB_POLYGON_MM.length};`)
    expect(glsl).toContain('float sdBwcCan(vec3 q)')
    expect(BWC_CAN_TAB_Y_MM).toEqual([166.77, 167.67])
    // Every tab corner appears in the generated source, in metres.
    for (const [x, z] of BWC_CAN_TAB_POLYGON_MM) expect(glsl).toContain(`vec2(${(x / 1000).toFixed(6)}, ${(z / 1000).toFixed(6)})`)
  })
})
