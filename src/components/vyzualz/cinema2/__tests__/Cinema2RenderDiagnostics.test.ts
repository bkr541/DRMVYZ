import { describe, expect, it, vi } from 'vitest'
import { Cinema2GlResourceTracker, cinema2TexelBytes } from '../runtime/Cinema2GlResourceTracker'
import { Cinema2GpuTimerPool } from '../runtime/Cinema2GpuTimerPool'
import { Cinema2RenderDiagnostics, installCinema2RenderDiagnosticsGlobal } from '../runtime/Cinema2RenderDiagnostics'

const TEXTURE_2D = 0x0de1, ARRAY_BUFFER = 0x8892, RGBA8 = 0x8058, RGBA16F = 0x881a, RGBA = 0x1908, UNSIGNED_BYTE = 0x1401, TRIANGLES = 4, TEXTURE0 = 0x84c0, RENDERBUFFER = 0x8d41, DEPTH24_STENCIL8 = 0x88f0

/** A WebGL2 stand-in that only has the methods the tracker wraps, on the prototype, like a real context. */
class FakeGl {
  isContextLost() { return false }
  getExtension() { return null }
  createTexture(..._args: unknown[]) { return {} }
  deleteTexture(..._args: unknown[]) {}
  bindTexture(..._args: unknown[]) {}
  activeTexture(..._args: unknown[]) {}
  texImage2D(..._args: unknown[]) {}
  texImage3D(..._args: unknown[]) {}
  texStorage2D(..._args: unknown[]) {}
  texStorage3D(..._args: unknown[]) {}
  compressedTexImage2D(..._args: unknown[]) {}
  compressedTexImage3D(..._args: unknown[]) {}
  generateMipmap(..._args: unknown[]) {}
  createBuffer(..._args: unknown[]) { return {} }
  deleteBuffer(..._args: unknown[]) {}
  bindBuffer(..._args: unknown[]) {}
  bufferData(..._args: unknown[]) {}
  createRenderbuffer(..._args: unknown[]) { return {} }
  deleteRenderbuffer(..._args: unknown[]) {}
  bindRenderbuffer(..._args: unknown[]) {}
  renderbufferStorage(..._args: unknown[]) {}
  renderbufferStorageMultisample(..._args: unknown[]) {}
  createFramebuffer(..._args: unknown[]) { return {} }
  deleteFramebuffer(..._args: unknown[]) {}
  createProgram(..._args: unknown[]) { return {} }
  deleteProgram(..._args: unknown[]) {}
  linkProgram(..._args: unknown[]) {}
  compileShader(..._args: unknown[]) {}
  drawArrays(..._args: unknown[]) {}
  drawElements(..._args: unknown[]) {}
  drawArraysInstanced(..._args: unknown[]) {}
  drawElementsInstanced(..._args: unknown[]) {}
  drawRangeElements(..._args: unknown[]) {}
}

const asGl = (gl: FakeGl): WebGL2RenderingContext => gl as unknown as WebGL2RenderingContext

describe('GL resource tracker', () => {
  it('prices texel formats', () => {
    expect(cinema2TexelBytes(RGBA8)).toBe(4)
    expect(cinema2TexelBytes(RGBA16F)).toBe(8)
    expect(cinema2TexelBytes(RGBA, RGBA, UNSIGNED_BYTE)).toBe(4)
    expect(cinema2TexelBytes(DEPTH24_STENCIL8)).toBe(4)
  })

  it('counts draw calls and triangles per frame, including instanced draws, and removes its wrappers on detach', () => {
    const gl = new FakeGl()
    const originalDraw = gl.drawArrays
    const tracker = new Cinema2GlResourceTracker(asGl(gl))
    tracker.attach()
    expect(Object.prototype.hasOwnProperty.call(gl, 'drawArrays')).toBe(true)
    tracker.beginFrame()
    gl.drawArrays(TRIANGLES, 0, 3)
    gl.drawElements()
    gl.drawArraysInstanced(TRIANGLES, 0, 36, 10)
    ;(gl as unknown as { drawElementsInstanced(...args: number[]): void }).drawElementsInstanced(TRIANGLES, 12, 0, 0, 5)
    tracker.endFrame()
    expect(tracker.getSnapshot().lastFrame).toMatchObject({ drawCalls: 4, triangles: 1 + 12 * 10 + 4 * 5 })
    tracker.detach()
    expect(Object.prototype.hasOwnProperty.call(gl, 'drawArrays')).toBe(false)
    expect(gl.drawArrays).toBe(originalDraw)
  })

  it('tracks texture, buffer and renderbuffer memory and releases it on delete', () => {
    const gl = new FakeGl()
    const tracker = new Cinema2GlResourceTracker(asGl(gl))
    tracker.attach()
    const texture = gl.createTexture()
    gl.activeTexture()
    ;(gl as unknown as { activeTexture(unit: number): void }).activeTexture(TEXTURE0)
    ;(gl as unknown as { bindTexture(target: number, t: unknown): void }).bindTexture(TEXTURE_2D, texture)
    ;(gl as unknown as { texImage2D(...args: number[]): void }).texImage2D(TEXTURE_2D, 0, RGBA8, 256, 256, 0, RGBA, UNSIGNED_BYTE, 0)
    expect(tracker.getSnapshot().textures).toEqual({ count: 1, bytes: 256 * 256 * 4 })
    ;(gl as unknown as { generateMipmap(target: number): void }).generateMipmap(TEXTURE_2D)
    expect(tracker.getSnapshot().textures.bytes).toBe(Math.round(256 * 256 * 4 * 4 / 3))
    const storage = gl.createTexture()
    ;(gl as unknown as { bindTexture(target: number, t: unknown): void }).bindTexture(TEXTURE_2D, storage)
    ;(gl as unknown as { texStorage2D(...args: number[]): void }).texStorage2D(TEXTURE_2D, 3, RGBA8, 4, 4)
    expect(tracker.getSnapshot().textures.bytes).toBe(Math.round(256 * 256 * 4 * 4 / 3) + (16 + 4 + 1) * 4)

    const buffer = gl.createBuffer()
    ;(gl as unknown as { bindBuffer(target: number, b: unknown): void }).bindBuffer(ARRAY_BUFFER, buffer)
    ;(gl as unknown as { bufferData(target: number, data: ArrayBufferView, usage: number): void }).bufferData(ARRAY_BUFFER, new Float32Array(100), 0)
    expect(tracker.getSnapshot().buffers).toEqual({ count: 1, bytes: 400 })

    const renderbuffer = gl.createRenderbuffer()
    ;(gl as unknown as { bindRenderbuffer(target: number, r: unknown): void }).bindRenderbuffer(RENDERBUFFER, renderbuffer)
    ;(gl as unknown as { renderbufferStorageMultisample(...args: number[]): void }).renderbufferStorageMultisample(RENDERBUFFER, 4, DEPTH24_STENCIL8, 100, 100)
    expect(tracker.getSnapshot().renderbuffers.bytes).toBe(100 * 100 * 4 * 4)

    const snapshot = tracker.getSnapshot()
    expect(snapshot.estimatedGpuBytes).toBe(snapshot.textures.bytes + snapshot.buffers.bytes + snapshot.renderbuffers.bytes)
    gl.deleteTexture(); (gl as unknown as { deleteTexture(t: unknown): void }).deleteTexture(texture)
    expect(tracker.getSnapshot().textures.count).toBe(1)
    tracker.detach()
  })

  it('counts framebuffers, programs and shader compile activity', () => {
    const gl = new FakeGl()
    let clock = 0
    const tracker = new Cinema2GlResourceTracker(asGl(gl), () => (clock += 5))
    tracker.attach()
    gl.createFramebuffer(); gl.createFramebuffer()
    const program = gl.createProgram()
    tracker.beginFrame()
    ;(gl as unknown as { compileShader(s: unknown): void }).compileShader({})
    ;(gl as unknown as { linkProgram(p: unknown): void }).linkProgram(program)
    expect(tracker.getSnapshot().currentFrame).toMatchObject({ programLinks: 1, shaderCompiles: 1 })
    tracker.endFrame()
    const snapshot = tracker.getSnapshot()
    expect(snapshot.framebuffers).toEqual({ count: 2, createdTotal: 2 })
    expect(snapshot.programs).toMatchObject({ count: 1, linkedTotal: 1, compiledTotal: 1 })
    expect(snapshot.programs.linkMsTotal).toBeGreaterThan(0)
    expect(snapshot.lastFrame.programLinks).toBe(1)
    tracker.handleContextLost()
    expect(tracker.getSnapshot().framebuffers.count).toBe(0)
    tracker.detach()
  })
})

describe('GPU timer pool', () => {
  it('reads results only when the driver says they are ready and drops disjoint frames', () => {
    const ext = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 }
    let disjoint = false
    const ready = new Set<object>()
    const gl = {
      QUERY_RESULT_AVAILABLE: 10, QUERY_RESULT: 11,
      isContextLost: () => false,
      getExtension: () => ext,
      createQuery: () => ({}),
      beginQuery: vi.fn(),
      endQuery: vi.fn(),
      deleteQuery: vi.fn(),
      getParameter: () => disjoint,
      getQueryParameter: (query: object, name: number) => (name === 10 ? ready.has(query) : 2_000_000),
    }
    const pool = new Cinema2GpuTimerPool(gl as unknown as WebGL2RenderingContext)
    expect(pool.supported).toBe(true)
    let query: object | null = null
    gl.createQuery = () => (query = {})
    expect(pool.measure('bloom', () => 7)).toBe(7)
    pool.collect()
    expect(pool.getTimings()).toEqual([])
    ready.add(query!)
    pool.collect()
    expect(pool.getTimings()[0]).toMatchObject({ label: 'bloom', lastMs: 2, samples: 1 })

    gl.createQuery = () => (query = {})
    pool.measure('bloom', () => undefined)
    ready.add(query!)
    disjoint = true
    pool.collect()
    expect(pool.getDisjointCount()).toBe(1)
    expect(pool.getTimings()[0]!.samples).toBe(1)
  })

  it('does not nest and is a no-op without the extension', () => {
    const none = new Cinema2GpuTimerPool({ isContextLost: () => false, getExtension: () => null } as unknown as WebGL2RenderingContext)
    expect(none.supported).toBe(false)
    expect(none.measure('x', () => 3)).toBe(3)
    none.collect()
  })
})

describe('diagnostics facade', () => {
  it('summarizes frame times and draw statistics, and registers a console global', () => {
    const gl = new FakeGl()
    let now = 0
    const diagnostics = new Cinema2RenderDiagnostics(asGl(gl), { now: () => now, readThreeInfo: () => ({ geometries: 3, textures: 2, programs: 5 }) }).attach()
    for (const frameMs of [10, 12, 14, 30]) {
      diagnostics.beginFrame()
      gl.drawArrays(TRIANGLES, 0, 30)
      now += frameMs
      diagnostics.endFrame()
    }
    diagnostics.setActivePasses(['hdr-bloom', 'anti-aliasing'])
    const snapshot = diagnostics.getSnapshot()
    expect(snapshot.frame).toMatchObject({ count: 4, lastMs: 30, maxMs: 30 })
    expect(snapshot.frame.averageMs).toBeCloseTo(16.5, 6)
    expect(snapshot.frame.fps).toBeCloseTo(1000 / 16.5, 4)
    expect(snapshot.draw).toMatchObject({ drawCalls: 1, triangles: 10 })
    expect(snapshot.passes).toEqual(['hdr-bloom', 'anti-aliasing'])
    expect(snapshot.three).toEqual({ geometries: 3, textures: 2, programs: 5 })
    expect(snapshot.gpu.supported).toBe(false)
    diagnostics.detach()
    expect(Object.prototype.hasOwnProperty.call(gl, 'drawArrays')).toBe(false)

    const target: Record<string, unknown> = {}
    const api = installCinema2RenderDiagnosticsGlobal(target)
    expect(target.__CINEMA2_RENDER_DIAGNOSTICS__).toBe(api)
    expect(api.snapshot()).toBeNull()
    expect(() => api.attach({ getContext: () => null } as unknown as HTMLCanvasElement)).toThrow(/WebGL2/)
    expect(api.attach(asGl(gl))).toBeInstanceOf(Cinema2RenderDiagnostics)
    expect(api.snapshot()?.frame.count).toBe(0)
    api.detach()
    expect(api.get()).toBeNull()
  })
})
