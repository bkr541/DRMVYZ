import { describe, expect, it, vi } from 'vitest'
import {
  Cinema2Runtime,
  getCinema2RuntimeDiagnostics,
} from '../runtime/Cinema2Runtime'

type RafHarness = ReturnType<typeof createRafHarness>

function createRafHarness() {
  const callbacks = new Map<number, FrameRequestCallback>()
  let nextId = 1
  return {
    callbacks,
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      const id = nextId++
      callbacks.set(id, callback)
      return id
    }),
    cancelAnimationFrame: vi.fn((id: number) => {
      callbacks.delete(id)
    }),
    runNext(timestamp = 16.67) {
      const entry = [...callbacks.entries()][0]
      if (!entry) throw new Error('No animation frame is scheduled')
      callbacks.delete(entry[0])
      entry[1](timestamp)
    },
  }
}

function createMockWebGL() {
  return {
    FRAMEBUFFER: 0x8d40,
    COLOR_BUFFER_BIT: 0x4000,
    SCISSOR_TEST: 0x0c11,
    BLEND: 0x0be2,
    DEPTH_TEST: 0x0b71,
    bindFramebuffer: vi.fn(),
    viewport: vi.fn(),
    disable: vi.fn(),
    colorMask: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    flush: vi.fn(),
  } as unknown as WebGL2RenderingContext
}

class FakeCanvas extends EventTarget {
  width = 300
  height = 150
  readonly getContext: ReturnType<typeof vi.fn>

  constructor(gl: WebGL2RenderingContext | null, throws: Error | null = null) {
    super()
    this.getContext = vi.fn(() => {
      if (throws) throw throws
      return gl
    })
  }
}

function createRuntime(gl = createMockWebGL(), raf: RafHarness = createRafHarness()) {
  const canvas = new FakeCanvas(gl)
  const result = Cinema2Runtime.create(canvas as unknown as HTMLCanvasElement, {
    requestAnimationFrame: raf.requestAnimationFrame,
    cancelAnimationFrame: raf.cancelAnimationFrame,
  })
  if (!result.runtime) throw new Error(result.error)
  return { canvas, gl, raf, runtime: result.runtime }
}

describe('Cinema2Runtime sibling foundation', () => {
  it('constructs independently, renders a deterministic safe frame, and disposes every owned resource', () => {
    const before = getCinema2RuntimeDiagnostics()
    const { runtime, gl } = createRuntime()

    expect(gl.clearColor).toHaveBeenCalledWith(0, 0, 0, 1)
    expect(gl.clear).toHaveBeenCalledWith(0x4000)
    expect(runtime.getSnapshot()).toMatchObject({
      phase: 'initializing',
      contextGeneration: 1,
      resources: {
        activeAnimationFrameCount: 0,
        activeEventListenerCount: 2,
        activeWebGLContextCount: 1,
      },
    })
    expect(getCinema2RuntimeDiagnostics()).toMatchObject({
      activeRuntimeCount: before.activeRuntimeCount + 1,
      activeEventListenerCount: before.activeEventListenerCount + 2,
      activeWebGLContextCount: before.activeWebGLContextCount + 1,
    })

    runtime.dispose()
    expect(runtime.getSnapshot()).toMatchObject({
      phase: 'disposed',
      resources: {
        activeAnimationFrameCount: 0,
        activeEventListenerCount: 0,
        activeWebGLContextCount: 0,
      },
    })
    expect(getCinema2RuntimeDiagnostics()).toMatchObject({
      activeRuntimeCount: before.activeRuntimeCount,
      activeAnimationFrameCount: before.activeAnimationFrameCount,
      activeEventListenerCount: before.activeEventListenerCount,
      activeWebGLContextCount: before.activeWebGLContextCount,
    })
  })

  it('keeps exactly one scheduled animation frame across repeated start calls and frame execution', () => {
    const { runtime, raf } = createRuntime()

    runtime.start()
    runtime.start()
    runtime.start()
    expect(raf.requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(raf.callbacks.size).toBe(1)
    expect(runtime.getSnapshot().resources.activeAnimationFrameCount).toBe(1)

    raf.runNext()
    expect(runtime.getSnapshot().frameCount).toBe(1)
    expect(raf.callbacks.size).toBe(1)
    expect(runtime.getSnapshot().resources.activeAnimationFrameCount).toBe(1)

    runtime.dispose()
    expect(raf.callbacks.size).toBe(0)
    expect(raf.cancelAnimationFrame).toHaveBeenCalledTimes(1)
  })

  it('applies resolved backing dimensions and DPR without recreating runtime ownership', () => {
    const { canvas, gl, runtime } = createRuntime()

    expect(runtime.resize({ width: 1920, height: 1080, dpr: 2 })).toBe(true)
    expect(canvas.width).toBe(1920)
    expect(canvas.height).toBe(1080)
    expect(runtime.getSnapshot()).toMatchObject({
      viewport: { width: 1920, height: 1080, dpr: 2 },
      resources: { activeWebGLContextCount: 1 },
    })
    expect(gl.viewport).toHaveBeenLastCalledWith(0, 0, 1920, 1080)
    expect(runtime.resize({ width: 1920, height: 1080, dpr: 2 })).toBe(false)

    runtime.dispose()
  })

  it('cancels rendering on context loss and safely resumes the single loop after restoration', () => {
    const { canvas, runtime, raf } = createRuntime()
    runtime.resize({ width: 1280, height: 720, dpr: 1.5 })
    runtime.start()
    expect(raf.callbacks.size).toBe(1)

    const lost = new Event('webglcontextlost', { cancelable: true })
    canvas.dispatchEvent(lost)
    expect(lost.defaultPrevented).toBe(true)
    expect(runtime.getSnapshot()).toMatchObject({
      phase: 'context-lost',
      contextGeneration: 1,
      resources: { activeAnimationFrameCount: 0 },
    })
    expect(raf.callbacks.size).toBe(0)

    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(runtime.getSnapshot()).toMatchObject({
      phase: 'running',
      contextGeneration: 2,
      viewport: { width: 1280, height: 720, dpr: 1.5 },
      resources: { activeAnimationFrameCount: 1 },
    })
    expect(raf.callbacks.size).toBe(1)

    runtime.dispose()
  })

  it('returns an explicit unavailable state when WebGL2 is missing or initialization throws', () => {
    const before = getCinema2RuntimeDiagnostics()
    const missingCanvas = new FakeCanvas(null)
    const missing = Cinema2Runtime.create(missingCanvas as unknown as HTMLCanvasElement)
    expect(missing.runtime).toBeNull()
    expect(missing.snapshot.phase).toBe('unavailable')
    expect(missing.error).toMatch(/requires WebGL2/i)

    const throwingCanvas = new FakeCanvas(null, new Error('context boom'))
    const throwing = Cinema2Runtime.create(throwingCanvas as unknown as HTMLCanvasElement)
    expect(throwing.runtime).toBeNull()
    expect(throwing.snapshot.phase).toBe('unavailable')
    expect(throwing.error).toContain('context boom')
    expect(getCinema2RuntimeDiagnostics()).toMatchObject({
      activeRuntimeCount: before.activeRuntimeCount,
      activeAnimationFrameCount: before.activeAnimationFrameCount,
      activeEventListenerCount: before.activeEventListenerCount,
      activeWebGLContextCount: before.activeWebGLContextCount,
    })
  })
})
