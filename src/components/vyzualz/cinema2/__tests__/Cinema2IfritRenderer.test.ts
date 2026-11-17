import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../../../test/support/CinemaWebGLTestUtils'
import { Cinema2IfritRenderer } from '../modules/ifrit/Cinema2IfritRenderer'
import { createIfritMechanicalFrame } from '../modules/ifrit/Cinema2IfritMechanics'
import { createIfritVisualFrame } from '../modules/ifrit/Cinema2IfritMotion'
import { IFRIT_EMPTY_OVERRIDES } from '../modules/ifrit/Cinema2IfritOverrides'
import { createIfritShatterFrame, ifritOriginalSurvival } from '../modules/ifrit/Cinema2IfritShatter'
import { IFRIT_INSTANCE_FLOATS, packIfritComponents, packIfritShards, writeIfritInstance } from '../modules/ifrit/Cinema2IfritInstancePacking'
import { buildIfritGeometry } from '../modules/ifrit/Cinema2IfritGeometry'
import { buildIfritBladeMesh, buildIfritGearMesh, buildIfritSatelliteMesh, buildIfritSpokeMesh, IFRIT_MESH_STRIDE_FLOATS } from '../modules/ifrit/Cinema2IfritMechanicsGeometry'
import { buildIfritShardMesh } from '../modules/ifrit/Cinema2IfritShatterGeometry'

const phases = { travel: 4.2, spin: 0.7, score: 3.1, gear: 0.5 }
const visual = createIfritVisualFrame(phases, { count: 5, spacing: 1, twist: 0.45, detail: 1 }, {}, 'infernalPassage')
const mech = createIfritMechanicalFrame(phases, visual.rings, {
  enabled: true, density: 0.7, spokeExtension: 0.35, spokePulse: 0.55, bladeSweep: 0.6, bladeCount: 3, satelliteCount: 2, satelliteOrbitRadius: 0.65, satelliteOrbitSpeed: 0.45,
  sectors: Array.from({ length: 6 }, () => ({ enabled: true, armOffset: 0, bladeOffset: 0 })), aperture: 1, spacing: 1, overrides: IFRIT_EMPTY_OVERRIDES, quality: 'high',
}, {}, 'infernalPassage')
const shards = createIfritShatterFrame(phases, visual.rings, {
  enabled: true, trigger: 'manual', strength: 0.72, hold: 0.8, fragmentsPerEdge: 3, spread: 0.9, spin: 1.25, reassembly: 0.75, sectorBias: [1, 1, 1, 1, 1, 1],
  aperture: 1, spacing: 1, thickness: 1, overrides: IFRIT_EMPTY_OVERRIDES, quality: 'high',
}, {}, 'infernalPassage')
const exec = { camera: { viewProjectionMatrix: Array.from({ length: 16 }, (_, i) => i % 5 === 0 ? 1 : 0) }, depthAvailable: true } as never
const parameters = { get: () => undefined } as never

describe('Ifrit renderer: instanced parts', () => {
  it('keeps the original single tunnel draw and adds one instanced draw per kind of part (spokes, gears, blades, satellites, shards)', () => {
    const gl = createCinemaMockWebGL()
    const renderer = new Cinema2IfritRenderer(gl)
    renderer.draw(exec, parameters, visual, { mechanics: mech, shards, survival: ifritOriginalSurvival(shards) })
    expect(gl.__calls.drawCount).toBe(1)
    expect(gl.__calls.drawInstancedCount).toBe(5)
    expect(renderer.lastInstancedStats).toMatchObject({ draws: 5, instances: { spoke: 30, gear: 30, blade: 90, satellite: 60, shard: shards.length } })
    renderer.dispose()
  })

  it('draws no instanced geometry at all with both systems off (the original visualizer alone), and uploads nothing', () => {
    const gl = createCinemaMockWebGL()
    const renderer = new Cinema2IfritRenderer(gl)
    renderer.draw(exec, parameters, visual)
    expect(gl.__calls.drawCount).toBe(1)
    expect(gl.__calls.drawInstancedCount).toBe(0)
    expect(gl.bufferSubData).not.toHaveBeenCalled()
    renderer.draw(exec, parameters, visual, { mechanics: [], shards: [], survival: null })
    expect(gl.__calls.drawInstancedCount).toBe(0)
    renderer.dispose()
  })

  it('reuses its buffers: nothing is allocated per frame, only live instances are uploaded, and mechanics-only or shatter-only draw only their kinds', () => {
    const gl = createCinemaMockWebGL()
    const renderer = new Cinema2IfritRenderer(gl)
    const created = { buffers: gl.__calls.createdBuffers, vaos: gl.__calls.createdVertexArrays, programs: gl.__calls.createdPrograms }
    for (let i = 0; i < 4; i++) renderer.draw(exec, parameters, visual, { mechanics: mech, shards, survival: ifritOriginalSurvival(shards) })
    expect({ buffers: gl.__calls.createdBuffers, vaos: gl.__calls.createdVertexArrays, programs: gl.__calls.createdPrograms }).toEqual(created)
    expect(created.vaos).toBe(1 + 5)
    expect(created.buffers).toBe(1 + 5 * 3)
    expect(created.programs).toBe(2)
    const uploads = (gl.bufferSubData as ReturnType<typeof vi.fn>).mock.calls
    expect(uploads.length).toBeGreaterThan(0)
    expect(uploads.every(call => (call[4] as number) > 0 && (call[4] as number) % IFRIT_INSTANCE_FLOATS === 0)).toBe(true)
    renderer.draw(exec, parameters, visual, { mechanics: mech, shards: [], survival: null })
    expect(renderer.lastInstancedStats.instances.shard).toBe(0)
    expect(renderer.lastInstancedStats.draws).toBe(4)
    renderer.draw(exec, parameters, visual, { mechanics: [], shards, survival: ifritOriginalSurvival(shards) })
    expect(renderer.lastInstancedStats.draws).toBe(1)
    // The GPU byte report includes the instanced meshes and instance buffers and stays small.
    expect(renderer.gpuBytes).toBeGreaterThan(buildIfritGeometry().byteLength)
    expect(renderer.gpuBytes).toBeLessThan(buildIfritGeometry().byteLength + 400_000)
    renderer.dispose()
  })

  it('sends the original-edge survival mask (72 values; all ones when shatter is off, zeros for the sectors whose pieces are in flight)', () => {
    const gl = createCinemaMockWebGL()
    const renderer = new Cinema2IfritRenderer(gl)
    const uniforms = gl.uniform1fv as ReturnType<typeof vi.fn>
    renderer.draw(exec, parameters, visual)
    const off = uniforms.mock.calls.at(-1)![1] as Float32Array
    expect(off).toHaveLength(72)
    expect([...off].every(v => v === 1)).toBe(true)
    renderer.draw(exec, parameters, visual, { mechanics: [], shards, survival: ifritOriginalSurvival(shards) })
    const on = uniforms.mock.calls.at(-1)![1] as Float32Array
    expect([...on].filter(v => v === 0)).toHaveLength(new Set(shards.map(s => `${s.ringSlot}/${s.sector}`)).size)
    renderer.dispose()
  })

  it('disposes every program, buffer and VAO it created, twice safely', () => {
    const gl = createCinemaMockWebGL()
    const renderer = new Cinema2IfritRenderer(gl)
    renderer.dispose(); renderer.dispose()
    expect(gl.__calls.deletedBuffers).toBe(gl.__calls.createdBuffers)
    expect(gl.__calls.deletedVertexArrays).toBe(gl.__calls.createdVertexArrays)
    expect(gl.__calls.deletedPrograms).toBe(gl.__calls.createdPrograms)
    renderer.draw(exec, parameters, visual, { mechanics: mech, shards, survival: null })
    expect(gl.__calls.drawCount).toBe(0)
  })

  it('releases everything already created when a later allocation fails', () => {
    const gl = createCinemaMockWebGL()
    const real = gl.createVertexArray.bind(gl)
    let calls = 0
    ;(gl as unknown as { createVertexArray: () => unknown }).createVertexArray = () => (++calls === 4 ? null : real())
    expect(() => new Cinema2IfritRenderer(gl)).toThrow()
    expect(gl.__calls.deletedBuffers).toBe(gl.__calls.createdBuffers)
    expect(gl.__calls.deletedVertexArrays).toBe(gl.__calls.createdVertexArrays)
    expect(gl.__calls.deletedPrograms).toBe(gl.__calls.createdPrograms)
  })
})

describe('Ifrit instanced meshes and packing', () => {
  it('builds every mesh once, within 16-bit indices, with a whole number of triangles and finite unit-length normals', () => {
    for (const mesh of [buildIfritSpokeMesh(), buildIfritGearMesh(), buildIfritBladeMesh(), buildIfritSatelliteMesh(), buildIfritShardMesh()]) {
      expect(mesh.vertices.length % IFRIT_MESH_STRIDE_FLOATS).toBe(0)
      expect(mesh.indices.length % 3).toBe(0)
      const count = mesh.vertices.length / IFRIT_MESH_STRIDE_FLOATS
      expect(count).toBeLessThan(65536)
      for (const index of mesh.indices) expect(index).toBeLessThan(count)
      for (let i = 0; i < count; i++) {
        const o = i * IFRIT_MESH_STRIDE_FLOATS
        expect(Math.hypot(mesh.vertices[o + 3]!, mesh.vertices[o + 4]!, mesh.vertices[o + 5]!)).toBeCloseTo(1, 4)
        expect(Number.isFinite(mesh.vertices[o]!) && Number.isFinite(mesh.vertices[o + 1]!) && Number.isFinite(mesh.vertices[o + 2]!)).toBe(true)
      }
    }
  })

  it('writes a rotation·scale matrix and translation that maps a local point where the pose says', () => {
    const t = new Float32Array(16)
    writeIfritInstance(t, 0, [1, 2, 3], [0, 0, Math.PI / 2], [2, 1, 1], 0.7, 0.1, -0.1, 1)
    const apply = (x: number, y: number, z: number) => [t[0]! * x + t[1]! * y + t[2]! * z + t[3]!, t[4]! * x + t[5]! * y + t[6]! * z + t[7]!, t[8]! * x + t[9]! * y + t[10]! * z + t[11]!]
    const p = apply(1, 0, 0)
    expect(p[0]).toBeCloseTo(1, 5); expect(p[1]).toBeCloseTo(4, 5); expect(p[2]).toBeCloseTo(3, 5)
    expect([t[12], t[13], t[14], t[15]].map(v => Number(v!.toFixed(4)))).toEqual([0.1, -0.1, 1, 0.7])
  })

  it('packs only visible poses of one kind and stops at capacity', () => {
    const target = new Float32Array(IFRIT_INSTANCE_FLOATS * 4)
    expect(packIfritComponents(mech, 'blade', target)).toBe(4)
    expect(packIfritShards(shards, new Float32Array(IFRIT_INSTANCE_FLOATS * 2))).toBe(2)
    expect(packIfritComponents([], 'spoke', target)).toBe(0)
  })

  it('writes the sector into the portal detail slot and leaves the wall detail ranks unchanged', () => {
    const geometry = buildIfritGeometry()
    const stride = 13
    const portalSectors = new Set<number>()
    let wallVertices = 0
    for (let i = 0; i < geometry.length / stride; i++) {
      const ring = geometry[i * stride + 8]!, detail = geometry[i * stride + 9]!
      if (ring >= 0) portalSectors.add(detail)
      else { wallVertices++; expect(detail).toBeGreaterThanOrEqual(0); expect(detail).toBeLessThan(1) }
    }
    expect([...portalSectors].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5])
    expect(wallVertices).toBeGreaterThan(1000)
    expect(geometry.length % stride).toBe(0)
  })
})
