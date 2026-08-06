/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CinemaNodeId, CinemaPortId } from '../CinemaIdentifiers'
import type { CinemaTargetDescriptor } from '../CinemaRendererContracts'
import { CinemaRuntime } from '../runtime/CinemaRuntime'
import {
  getDrmvyzWebGLContextDiagnosticsForTests,
  resetDrmvyzWebGLContextDiagnosticsForTests,
} from '../../react/shaders/runtime/WebGLContextLifecycle'
import { createCinemaMockWebGL } from './CinemaWebGLTestUtils'

const TARGET: CinemaTargetDescriptor = {
  colorSpace: 'srgb',
  alphaMode: 'premultiplied',
  colorFormat: 'rgba8',
  hasDepth: true,
  hasMask: false,
  widthScale: 1,
  heightScale: 1,
  filter: 'linear',
  wrap: 'clamp',
  clearColor: [0, 0, 0, 0],
}

beforeEach(() => {
  resetDrmvyzWebGLContextDiagnosticsForTests()
})

afterEach(() => {
  resetDrmvyzWebGLContextDiagnosticsForTests()
  vi.restoreAllMocks()
})

describe('CinemaRuntime', () => {
  it('owns one context and one animation loop, then retires both deterministically', () => {
    const canvas = document.createElement('canvas')
    const gl = createCinemaMockWebGL()
    vi.spyOn(canvas, 'getContext').mockImplementation((kind: string) => (
      kind === 'webgl2' ? gl : null
    ) as RenderingContext | null)

    const callbacks = new Map<number, FrameRequestCallback>()
    let nextRaf = 1
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = nextRaf++
      callbacks.set(id, callback)
      return id
    })
    const cancelFrame = vi.fn((id: number) => { callbacks.delete(id) })

    const created = CinemaRuntime.create(canvas, {
      requestAnimationFrame: requestFrame,
      cancelAnimationFrame: cancelFrame,
    })
    expect(created.error).toBeNull()
    const runtime = created.runtime
    expect(runtime).not.toBeNull()
    if (!runtime) return

    runtime.resize({
      valid: true,
      cssWidth: 640,
      cssHeight: 360,
      backingWidth: 960,
      backingHeight: 540,
      effectiveDpr: 1.5,
      resolutionScale: 1,
      quality: 'high',
      cappedByDpr: false,
      cappedByPixelBudget: false,
      cappedByDimension: false,
    })
    runtime.start()
    runtime.start()

    expect(requestFrame).toHaveBeenCalledTimes(1)
    expect(callbacks.size).toBe(1)
    expect(getDrmvyzWebGLContextDiagnosticsForTests()).toMatchObject({
      activeCount: 1,
      activeLiveByEngine: { cinema: 1 },
    })

    const first = [...callbacks.entries()][0]
    callbacks.delete(first[0])
    first[1](16.67)
    expect(gl.__calls.clearCount).toBe(1)
    expect(callbacks.size).toBe(1)

    runtime.dispose()
    expect(cancelFrame).toHaveBeenCalledTimes(1)
    expect(callbacks.size).toBe(0)
    expect(getDrmvyzWebGLContextDiagnosticsForTests().activeCount).toBe(0)
  })

  it('reuses matching pooled targets and reallocates active targets on resize', () => {
    const canvas = document.createElement('canvas')
    const gl = createCinemaMockWebGL()
    vi.spyOn(canvas, 'getContext').mockReturnValue(gl)
    const created = CinemaRuntime.create(canvas, {
      requestAnimationFrame: vi.fn(() => 1),
      cancelAnimationFrame: vi.fn(),
    })
    const runtime = created.runtime
    expect(runtime).not.toBeNull()
    if (!runtime) return

    runtime.resize(resolution(640, 360))
    const owner = 'cinema.node.test' as CinemaNodeId
    const first = runtime.targets.acquire(owner, TARGET, 'frame')
    const firstView = runtime.targets.getReadTexture(first)
    runtime.targets.release(first)
    const second = runtime.targets.acquire(owner, TARGET, 'frame')
    const secondView = runtime.targets.getReadTexture(second)

    expect(secondView?.textureViewId).toBe(firstView?.textureViewId)
    expect(runtime.targets.getDiagnostics()).toMatchObject({
      createdAllocationCount: 1,
      reusedAllocationCount: 1,
      activeLeaseCount: 1,
    })

    runtime.resize(resolution(800, 450))
    expect(runtime.targets.getDiagnostics()).toMatchObject({
      createdAllocationCount: 2,
      destroyedAllocationCount: 1,
      activeLeaseCount: 1,
      viewport: { width: 800, height: 450 },
    })
    expect(runtime.targets.getReadTexture(second)).not.toBeNull()

    runtime.targets.release(second)
    runtime.dispose()
    expect(gl.__calls.deletedFramebuffers).toBe(gl.__calls.createdFramebuffers)
    expect(gl.__calls.deletedTextures).toBe(gl.__calls.createdTextures)
    expect(gl.__calls.deletedRenderbuffers).toBe(gl.__calls.createdRenderbuffers)
  })

  it('bounds pooled allocations, clamps oversized targets, and removes released texture routes', () => {
    const canvas = document.createElement('canvas')
    const gl = createCinemaMockWebGL()
    vi.spyOn(canvas, 'getContext').mockReturnValue(gl)
    const created = CinemaRuntime.create(canvas, {
      requestAnimationFrame: vi.fn(() => 1),
      cancelAnimationFrame: vi.fn(),
    })
    const runtime = created.runtime
    expect(runtime).not.toBeNull()
    if (!runtime) return

    runtime.resize(resolution(5_000, 3_000))
    const owner = 'cinema.node.pool-bound' as CinemaNodeId
    const port = 'cinema.port.pool-bound' as CinemaPortId
    const oversized = { ...TARGET, widthScale: 4, heightScale: 4 }
    const leases = Array.from({ length: 25 }, () => runtime.targets.acquire(owner, oversized, 'frame'))
    const firstView = runtime.targets.getReadTexture(leases[0])
    expect(firstView).not.toBeNull()
    if (firstView) {
      runtime.textures.publishOutput(owner, port, firstView)
      expect(runtime.textures.resolveInput(owner, port)?.textureViewId).toBe(firstView.textureViewId)
      expect('texture' in firstView).toBe(false)
    }

    for (const lease of leases) runtime.targets.release(lease)
    expect(runtime.textures.resolveInput(owner, port)).toBeNull()
    expect(runtime.targets.getDiagnostics()).toMatchObject({
      pooledAllocationCount: 24,
      maximumPooledAllocationCount: 24,
      maximumTextureSize: 8192,
      destroyedAllocationCount: 1,
    })
    expect(gl.texImage2D).toHaveBeenCalledWith(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      8192,
      8192,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    )

    runtime.dispose()
    expect(gl.__calls.deletedFramebuffers).toBe(gl.__calls.createdFramebuffers)
    expect(gl.__calls.deletedTextures).toBe(gl.__calls.createdTextures)
    expect(gl.__calls.deletedRenderbuffers).toBe(gl.__calls.createdRenderbuffers)
  })

  it('pauses on context loss and resumes one loop after rebuilding on restoration', () => {
    const canvas = document.createElement('canvas')
    const gl = createCinemaMockWebGL()
    vi.spyOn(canvas, 'getContext').mockReturnValue(gl)
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextRaf = 1
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = nextRaf++
      callbacks.set(id, callback)
      return id
    })
    const cancelFrame = vi.fn((id: number) => { callbacks.delete(id) })
    const snapshots: string[] = []

    const created = CinemaRuntime.create(canvas, {
      requestAnimationFrame: requestFrame,
      cancelAnimationFrame: cancelFrame,
      onSnapshot: snapshot => snapshots.push(snapshot.phase),
    })
    const runtime = created.runtime
    expect(runtime).not.toBeNull()
    if (!runtime) return
    runtime.resize(resolution(320, 180))
    runtime.start()
    expect(callbacks.size).toBe(1)

    const lost = new Event('webglcontextlost', { cancelable: true })
    canvas.dispatchEvent(lost)
    expect(lost.defaultPrevented).toBe(true)
    expect(callbacks.size).toBe(0)
    expect(runtime.getSnapshot().phase).toBe('context-lost')
    expect(runtime.getSnapshot().diagnostics.diagnostics.some(d => d.code === 'CINEMA_CONTEXT_LOST')).toBe(true)

    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(runtime.getSnapshot()).toMatchObject({ phase: 'running', contextGeneration: 2 })
    expect(runtime.getSnapshot().diagnostics.diagnostics.some(d => d.code === 'CINEMA_CONTEXT_RESTORED')).toBe(true)
    expect(callbacks.size).toBe(1)
    expect(requestFrame).toHaveBeenCalledTimes(2)
    expect(snapshots).toContain('context-lost')

    runtime.dispose()
  })

  it('returns structured safe-output diagnostics when WebGL2 is unavailable', () => {
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getContext').mockReturnValue(null)
    const result = CinemaRuntime.create(canvas)
    expect(result.runtime).toBeNull()
    expect(result.error).toContain('WebGL2')
    expect(result.diagnostics.diagnostics.map(diagnostic => diagnostic.code)).toEqual(
      expect.arrayContaining(['CINEMA_CAPABILITY_UNAVAILABLE', 'CINEMA_SAFE_OUTPUT_ACTIVE']),
    )
  })
})

function resolution(width: number, height: number) {
  return {
    valid: true,
    cssWidth: width,
    cssHeight: height,
    backingWidth: width,
    backingHeight: height,
    effectiveDpr: 1,
    resolutionScale: 1,
    quality: 'high' as const,
    cappedByDpr: false,
    cappedByPixelBudget: false,
    cappedByDimension: false,
  }
}
