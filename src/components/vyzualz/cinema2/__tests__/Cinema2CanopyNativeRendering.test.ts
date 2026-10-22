import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../../../test/support/CinemaWebGLTestUtils'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import { cinema2CanopyNativeModuleDefinition } from '../modules/Cinema2CanopyNativeModule'
import type { Cinema2ModuleCreateContext } from '../modules/Cinema2ModuleContracts'
import { CANOPY_INSTANCE_FLOATS, CANOPY_MAX_BOX_INSTANCES, CANOPY_MAX_INSTANCES } from '../modules/canopy/Cinema2CanopyLayout'
import { Cinema2CanopyRenderer, buildBox, buildCylinder } from '../modules/canopy/Cinema2CanopyRenderer'
import { CINEMA2_CANOPY_PARAMETER_IDS, CINEMA2_CANOPY_PRESET_ID, CINEMA2_CANOPY_PRESET_MANIFEST } from '../presets/Cinema2CanopyPreset'
import { Cinema2Runtime } from '../runtime/Cinema2Runtime'
import { canopyFrame } from './Cinema2CanopyTestUtils'

class FakeCanvas extends EventTarget {
  width = 640
  height = 360
  readonly getContext: ReturnType<typeof vi.fn>
  constructor(gl: WebGL2RenderingContext | null) { super(); this.getContext = vi.fn(() => gl) }
}

function runtimeSession() {
  const gl = createCinemaMockWebGL()
  let scheduledFrame: FrameRequestCallback | null = null
  const created = Cinema2Runtime.create(new FakeCanvas(gl) as unknown as HTMLCanvasElement, {
    presetId: CINEMA2_CANOPY_PRESET_ID,
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => { scheduledFrame = callback; return 1 }),
    cancelAnimationFrame: vi.fn(),
    renderQuality: 'high',
  })
  expect(created.error).toBeNull()
  if (!created.runtime) throw new Error('Expected a CANOPY runtime')
  created.runtime.resize({ width: 640, height: 360, dpr: 1 })
  created.runtime.start()
  let timestamp = 16
  const frame = () => { (scheduledFrame as FrameRequestCallback | null)?.(timestamp); timestamp += 16 }
  frame()
  return { gl, runtime: created.runtime, frame }
}

function build(overrides: Record<string, Cinema2JsonValue> = {}) {
  const gl = createCinemaMockWebGL()
  const moduleManifest = CINEMA2_CANOPY_PRESET_MANIFEST.modules![0]!
  const values = new Map<string, Cinema2JsonValue>(Object.entries(moduleManifest.parameters ?? {}))
  for (const [name, value] of Object.entries(overrides)) values.set(name, value)
  const parameters = { get: (name: string) => values.get(name), getAuthored: (name: string) => values.get(name), resolve: () => null }
  const leases: { value: { dispose(): void } }[] = []
  const reportGpuBytes = vi.fn()
  const resources = {
    acquire: <T>(_key: string, _kind: string, create: (gl: WebGL2RenderingContext) => T) => { const value = create(gl); leases.push({ value: value as unknown as { dispose(): void } }); return value },
    reportGpuBytes,
    getSnapshot: () => ({ activeLeaseCount: leases.length, disposedLeaseCount: 0, estimatedGpuBytes: 0 }),
  }
  const instance = cinema2CanopyNativeModuleDefinition.create({
    module: moduleManifest, parameters, targets: {}, media: {}, resources, randomness: { sample: () => 0.5 },
  } as unknown as Cinema2ModuleCreateContext)
  const update = (time: number) => instance.lifecycle.update({ parameters, frame: canopyFrame({ time }), targets: {} } as never)
  const execute = (extra: Record<string, unknown> = {}) => instance.render!.providers[0]!.execute({
    target: null, width: 640, height: 360, depthAvailable: true, frame: canopyFrame({ time: 0 }),
    camera: { viewProjectionMatrix: Array.from({ length: 16 }, (_, i) => (i % 5 === 0 ? 1 : 0)), position: [0, 0, 10] },
    ...extra,
  } as never)
  return { gl, instance, update, execute, leases, reportGpuBytes, values }
}

describe('CANOPY native rendering', () => {
  it('draws the whole array as exactly two instanced batches: boxes and diffusers', () => {
    const { gl, update, execute } = build()
    update(1)
    execute()
    expect(gl.__calls.drawInstancedCount).toBe(2)
    const draws = (gl.drawElementsInstanced as ReturnType<typeof vi.fn>).mock.calls
    // 16 rails + 64 stems + 64 caps, then 64 diffusers.
    expect(draws.map(call => call[4])).toEqual([16 + 64 + 64, 64])
    expect(gl.__calls.drawCount).toBe(0)
  })

  it('draws more instances when Rows and Columns grow, still in two batches', () => {
    const { gl, update, execute } = build({ rows: 12, columns: 12 })
    update(1)
    execute()
    const draws = (gl.drawElementsInstanced as ReturnType<typeof vi.fn>).mock.calls
    expect(draws.map(call => call[4])).toEqual([24 + 144 * 2, 144])
    expect(gl.__calls.drawInstancedCount).toBe(2)
  })

  it('uploads only the used part of each instance region every frame', () => {
    const { gl, update, execute } = build({ rows: 4, columns: 4 })
    update(1)
    execute()
    const uploads = (gl.bufferSubData as ReturnType<typeof vi.fn>).mock.calls
    expect(uploads).toHaveLength(2)
    expect(uploads[0]![1]).toBe(0)
    expect(uploads[0]![4]).toBe((8 + 16 * 2) * CANOPY_INSTANCE_FLOATS)
    expect(uploads[1]![1]).toBe(CANOPY_MAX_BOX_INSTANCES * CANOPY_INSTANCE_FLOATS * 4)
    expect(uploads[1]![4]).toBe(16 * CANOPY_INSTANCE_FLOATS)
  })

  it('allocates the instance buffer once, for the largest array, and creates no resources while drawing', () => {
    const { gl, update, execute } = build()
    const created = { ...gl.__calls }
    const bufferData = (gl.bufferData as ReturnType<typeof vi.fn>).mock.calls.find(call => call[1] === CANOPY_MAX_INSTANCES * CANOPY_INSTANCE_FLOATS * 4)
    expect(bufferData).toBeDefined()
    for (let frame = 1; frame <= 30; frame += 1) { update(frame / 60); execute() }
    expect(gl.__calls.createdBuffers).toBe(created.createdBuffers)
    expect(gl.__calls.createdVertexArrays).toBe(created.createdVertexArrays)
    expect(gl.__calls.createdPrograms).toBe(created.createdPrograms)
  })

  it('compiles one program, makes two vertex arrays and reports its GPU bytes to the host', () => {
    const { gl, reportGpuBytes } = build()
    expect(gl.__calls.createdPrograms).toBe(1)
    expect(gl.__calls.createdVertexArrays).toBe(2)
    const [bytes] = reportGpuBytes.mock.calls[0] as [number]
    expect(bytes).toBeGreaterThan(CANOPY_MAX_INSTANCES * CANOPY_INSTANCE_FLOATS * 4)
    expect(bytes).toBeLessThan(1_000_000)
  })

  it('refuses to draw without a depth attachment or without the final camera', () => {
    const { update, execute } = build()
    update(1)
    expect(() => execute({ depthAvailable: false })).toThrow(/depth attachment/)
    expect(() => execute({ camera: undefined })).toThrow(/Camera Runtime/)
  })

  it('draws depth-tested opaque geometry and leaves GL state tidy', () => {
    const { gl, update, execute } = build()
    update(1)
    execute()
    const enabled = (gl.enable as ReturnType<typeof vi.fn>).mock.calls.map(call => call[0])
    expect(enabled).toContain(gl.DEPTH_TEST)
    expect((gl.disable as ReturnType<typeof vi.fn>).mock.calls.map(call => call[0])).toContain(gl.BLEND)
    const last = <T,>(calls: T[]) => calls[calls.length - 1]
    expect(last((gl.depthMask as ReturnType<typeof vi.fn>).mock.calls)).toEqual([true])
    expect(last((gl.bindVertexArray as ReturnType<typeof vi.fn>).mock.calls)).toEqual([null])
  })

  it('releases every GL resource it made when disposed, and does nothing if drawn afterwards', () => {
    const { gl, leases, update, execute } = build()
    update(1)
    leases.forEach(lease => lease.value.dispose())
    expect(gl.__calls.deletedBuffers).toBe(gl.__calls.createdBuffers)
    expect(gl.__calls.deletedVertexArrays).toBe(gl.__calls.createdVertexArrays)
    expect(gl.__calls.deletedPrograms).toBe(gl.__calls.createdPrograms)
    const before = gl.__calls.drawInstancedCount
    execute()
    expect(gl.__calls.drawInstancedCount).toBe(before)
    leases.forEach(lease => lease.value.dispose())
    expect(gl.__calls.deletedBuffers).toBe(gl.__calls.createdBuffers)
  })

  it('rebuilds cleanly on a new context: a second renderer on a fresh context draws the same two batches', () => {
    const first = build()
    first.update(1); first.execute()
    first.leases.forEach(lease => lease.value.dispose())
    const second = build()
    second.update(1); second.execute()
    expect(second.gl.__calls.drawInstancedCount).toBe(2)
  })

  it('uses no scene lights: the manifest declares none and the renderer needs none', () => {
    expect(CINEMA2_CANOPY_PRESET_MANIFEST.lighting?.lights ?? []).toHaveLength(0)
  })

  it('has well-formed meshes: whole triangles, indices in range, unit normals', () => {
    for (const mesh of [buildBox(), buildCylinder()]) {
      const vertexCount = mesh.vertices.length / 6
      expect(mesh.indices.length % 3).toBe(0)
      expect(Math.max(...Array.from(mesh.indices))).toBeLessThan(vertexCount)
      for (let v = 0; v < vertexCount; v += 1) expect(Math.hypot(mesh.vertices[v * 6 + 3]!, mesh.vertices[v * 6 + 4]!, mesh.vertices[v * 6 + 5]!)).toBeCloseTo(1, 6)
    }
  })

  it('winds every triangle counter-clockwise seen from outside, so back-face culling keeps the visible side', () => {
    for (const mesh of [buildBox(), buildCylinder()]) {
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const p = [0, 1, 2].map(k => { const v = mesh.indices[i + k]! * 6; return [mesh.vertices[v]!, mesh.vertices[v + 1]!, mesh.vertices[v + 2]!, mesh.vertices[v + 3]!, mesh.vertices[v + 4]!, mesh.vertices[v + 5]!] })
        const e1 = [p[1]![0]! - p[0]![0]!, p[1]![1]! - p[0]![1]!, p[1]![2]! - p[0]![2]!]
        const e2 = [p[2]![0]! - p[0]![0]!, p[2]![1]! - p[0]![1]!, p[2]![2]! - p[0]![2]!]
        const normal = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!]
        const vertexNormal = [(p[0]![3]! + p[1]![3]! + p[2]![3]!) / 3, (p[0]![4]! + p[1]![4]! + p[2]![4]!) / 3, (p[0]![5]! + p[1]![5]! + p[2]![5]!) / 3]
        expect(normal[0]! * vertexNormal[0]! + normal[1]! * vertexNormal[1]! + normal[2]! * vertexNormal[2]!, `triangle ${i / 3}`).toBeGreaterThan(0)
      }
    }
  })

  it('constructs directly and reports a positive size', () => {
    const renderer = new Cinema2CanopyRenderer(createCinemaMockWebGL())
    expect(renderer.estimateGpuBytes()).toBeGreaterThan(0)
    renderer.dispose()
  })

  describe('through the production runtime', () => {
    it('starts as one active native module with the authored camera and a clean render graph, and draws two batches', () => {
      const { gl, runtime } = runtimeSession()
      expect(runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 1, failedModuleCount: 0 })
      expect(runtime.getModuleRuntimeSnapshot().estimatedGpuBytes).toBeGreaterThan(0)
      expect(runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: 1, failedPassCount: 0 })
      const draws = (gl.drawElementsInstanced as ReturnType<typeof vi.fn>).mock.calls
      expect(draws.slice(0, 2).map(call => call[4])).toEqual([144, 64])
      runtime.dispose()
    })

    it('reconstructs everything cleanly after disposal and re-entry, with the authored controls restored', () => {
      const first = runtimeSession()
      first.runtime.getParameterState().setPersistentValue(CINEMA2_CANOPY_PARAMETER_IDS.rows, 5)
      first.frame()
      const drawn = (gl: typeof first.gl) => (gl.drawElementsInstanced as ReturnType<typeof vi.fn>).mock.calls.slice(-2).map(call => call[4])
      expect(drawn(first.gl)).toEqual([(5 + 8) + 5 * 8 * 2, 5 * 8])
      first.runtime.dispose()
      expect(first.gl.__calls.deletedBuffers).toBe(first.gl.__calls.createdBuffers)
      expect(first.gl.__calls.deletedPrograms).toBe(first.gl.__calls.createdPrograms)
      const second = runtimeSession()
      expect(second.runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 1, failedModuleCount: 0 })
      expect(second.runtime.getParameterState().getValue(CINEMA2_CANOPY_PARAMETER_IDS.rows)).toBe(8)
      expect(drawn(second.gl)).toEqual([144, 64])
      second.runtime.dispose()
    })

    it('rebuilds the array and keeps every frame valid as Pattern, Rows and the colours change live', () => {
      const { runtime, frame } = runtimeSession()
      const state = runtime.getParameterState()
      for (const pattern of ['crosswave', 'crown', 'splitWings', 'checkerLift', 'downpour', 'waterfall']) {
        expect(state.setPersistentValue(CINEMA2_CANOPY_PARAMETER_IDS.pattern, pattern)).toMatchObject({ ok: true })
        frame()
        expect(runtime.getRenderGraphExecutorSnapshot().failedPassCount).toBe(0)
      }
      for (const rows of [4, 12, 8]) {
        expect(state.setPersistentValue(CINEMA2_CANOPY_PARAMETER_IDS.rows, rows)).toMatchObject({ ok: true })
        frame()
        expect(runtime.getModuleRuntimeSnapshot().failedModuleCount).toBe(0)
      }
      expect(state.setPersistentValue(CINEMA2_CANOPY_PARAMETER_IDS.primaryRods, [1, 0, 0, 1])).toMatchObject({ ok: true })
      frame()
      expect(runtime.getModuleRuntimeSnapshot().failedModuleCount).toBe(0)
      runtime.dispose()
    })

    it('clamps an out-of-range number to the authored limit, refuses an unknown pattern, and never draws more than 144 rods', () => {
      const { runtime, frame, gl } = runtimeSession()
      const state = runtime.getParameterState()
      expect(state.setPersistentValue(CINEMA2_CANOPY_PARAMETER_IDS.rows, 40)).toMatchObject({ ok: true })
      expect(state.getValue(CINEMA2_CANOPY_PARAMETER_IDS.rows)).toBe(12)
      expect(state.setPersistentValue(CINEMA2_CANOPY_PARAMETER_IDS.columns, 1)).toMatchObject({ ok: true })
      expect(state.getValue(CINEMA2_CANOPY_PARAMETER_IDS.columns)).toBe(4)
      expect(state.setPersistentValue(CINEMA2_CANOPY_PARAMETER_IDS.pattern, 'not-a-pattern')).toMatchObject({ ok: false, diagnostics: [{ code: 'CINEMA2_PARAMETER_VALUE_OPTION_INVALID' }] })
      expect(state.getValue(CINEMA2_CANOPY_PARAMETER_IDS.pattern)).toBe('waterfall')
      frame()
      expect(runtime.getModuleRuntimeSnapshot().failedModuleCount).toBe(0)
      const draws = (gl.drawElementsInstanced as ReturnType<typeof vi.fn>).mock.calls.slice(-2).map(call => call[4])
      expect(draws[1]).toBe(48)
      runtime.dispose()
    })
  })
})
