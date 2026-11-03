import { describe, expect, it, vi } from 'vitest'
import { DataBleedRenderer, dataBleedSourceSize, type DataBleedFrame } from './DataBleedRenderer'
import { DEFAULT_CANVAS_DATA_BLEED_SETTINGS as defaults } from './DataBleedSettings'
function gpu() {
  let id = 100
  const calls: Record<string, ReturnType<typeof vi.fn>> = {}, constants: Record<string, number> = { NO_ERROR: 0 }
  const gl = new Proxy({}, { get(_target, key: string) {
    if (/^[A-Z_0-9]+$/.test(key)) return constants[key] ??= ++id
    return calls[key] ??= vi.fn((...args: unknown[]) => {
      if (key.startsWith('create')) return { id: ++id }
      if (key === 'getShaderParameter' || key === 'getProgramParameter') return true
      if (key === 'getParameter') return 4096
      if (key === 'getUniformLocation') return { name: args[1] }
      if (key === 'checkFramebufferStatus') return constants.FRAMEBUFFER_COMPLETE ??= ++id
      if (key === 'isContextLost') return false
      if (key === 'getError') return 0
    })
  } }) as WebGL2RenderingContext
  const canvas = { width: 640, height: 360, getContext: vi.fn(() => gl) } as unknown as HTMLCanvasElement
  const source = { complete: true, naturalWidth: 640, naturalHeight: 360, src: 'source.png', currentSrc: 'source.png' } as HTMLImageElement
  const frame: DataBleedFrame = { source, settings: defaults, timeSec: 0, deltaSec: 1 / 60, fitMode: 'contain', sourceTransform: { scale: 1, positionX: 0, positionY: 0, rotation: 0 } }
  return { gl, calls, canvas, frame }
}
describe('Data Bleed GPU ownership', () => {
  it('avoids duplicate uploads between decoded frames and cold-resets backward source playback', () => {
    const { canvas, frame } = gpu(), { renderer } = DataBleedRenderer.create(canvas)
    let decoded = 1
    const source = { readyState: 2, videoWidth: 640, videoHeight: 360, currentTime: 1, currentSrc: 'video.webm', getVideoPlaybackQuality: () => ({ totalVideoFrames: decoded }) } as HTMLVideoElement
    renderer!.render({ ...frame, source })
    source.currentTime = 1.008; renderer!.render({ ...frame, source, timeSec: 0.008 })
    expect(renderer!.getDiagnostics().sourceUploads).toBe(1)
    decoded++; source.currentTime = 1.033; renderer!.render({ ...frame, source, timeSec: 0.033 })
    expect(renderer!.getDiagnostics().sourceUploads).toBe(2)
    expect(renderer!.getDiagnostics().motionPairReady).toBe(true)
    decoded++; source.currentTime = 0.1; renderer!.render({ ...frame, source, timeSec: 0.05 })
    expect(renderer!.getDiagnostics()).toMatchObject({ motionPairReady: false, warmupFrames: 5 })
    renderer!.dispose()
  })
  it('handles missing WebGL/source and unrecoverable allocation errors without successful black frames', () => {
    expect(DataBleedRenderer.create({ getContext: () => null } as unknown as HTMLCanvasElement).renderer).toBeNull()
    expect(dataBleedSourceSize(null)).toBeNull()
    const { canvas, frame, calls } = gpu(), { renderer } = DataBleedRenderer.create(canvas)
    expect(renderer!.render({ ...frame, source: null })).toBe(false)
    // Ensure the error path releases resources through the layer rather than claiming success.
    calls.getError = calls.getError ?? vi.fn()
    calls.getError.mockReturnValueOnce(1285)
    expect(() => renderer!.render(frame)).toThrow('GPU allocation/upload failed')
    renderer!.dispose()
  })
  it('retains a static original, one feedback update, four bounded targets and three programs', () => {
    const { calls, canvas, frame } = gpu(), { renderer } = DataBleedRenderer.create(canvas)
    for (let i = 0; i < 30; i++) expect(renderer!.render({ ...frame, timeSec: i / 60 })).toBe(true)
    expect(renderer!.getDiagnostics()).toMatchObject({ sourceUploads: 1, targets: 4, programs: 3, warmupFrames: 0, feedbackUpdates: 30, allocations: 4 })
    expect(renderer!.getDiagnostics().transientBytes).toBeLessThanOrEqual(64 * 1024 * 1024)
    expect(calls.createTexture).toHaveBeenCalledTimes(5)
    expect(calls.createFramebuffer).toHaveBeenCalledTimes(4)
    const dryUpload = calls.texSubImage2D.mock.calls.find(args => args.includes(frame.source))
    expect(dryUpload).toBeDefined()
    renderer!.dispose(); renderer!.dispose()
    expect(calls.deleteTexture).toHaveBeenCalledTimes(5)
    expect(calls.deleteFramebuffer).toHaveBeenCalledTimes(4)
    expect(calls.deleteProgram).toHaveBeenCalledTimes(3)
    expect(calls.deleteVertexArray).toHaveBeenCalledTimes(1)
    expect(renderer!.getDiagnostics()).toMatchObject({ disposed: true, sourceBytes: 0, transientBytes: 0, programs: 0 })
  })
  it('updates video once per decoded position and computes motion from original frames rather than feedback', () => {
    const { calls, canvas, frame } = gpu(), { renderer } = DataBleedRenderer.create(canvas)
    const source = { readyState: 2, videoWidth: 640, videoHeight: 360, currentTime: 0, currentSrc: 'video.webm', src: 'video.webm' } as HTMLVideoElement
    renderer!.render({ ...frame, source }); renderer!.render({ ...frame, source, timeSec: 1 / 120 })
    expect(renderer!.getDiagnostics()).toMatchObject({ sourceUploads: 1, motionPairReady: false })
    source.currentTime = 1 / 30
    renderer!.render({ ...frame, source, timeSec: 1 / 30 })
    expect(renderer!.getDiagnostics()).toMatchObject({ sourceUploads: 2, motionPairReady: true })
    expect(calls.texSubImage2D).toHaveBeenCalledTimes(2)
    expect(calls.uniform1i.mock.calls.some(args => (args[0] as { name: string }).name === 'uMotionReady' && args[1] === 1)).toBe(true)
    renderer!.dispose()
  })
  it('holds history, clears with a six-frame warmup and bypasses feedback at clean endpoints', () => {
    const { canvas, frame } = gpu(), { renderer } = DataBleedRenderer.create(canvas)
    for (let i = 0; i < 8; i++) renderer!.render({ ...frame, timeSec: i / 60 })
    const before = renderer!.getDiagnostics().feedbackUpdates
    renderer!.render({ ...frame, timeSec: 0.2, settings: { ...defaults, freezeHistory: true } })
    expect(renderer!.getDiagnostics().feedbackUpdates).toBe(before)
    renderer!.resetHistory(); renderer!.render({ ...frame, timeSec: 0.21 })
    expect(renderer!.getDiagnostics().warmupFrames).toBe(5)
    for (const patch of [{ amount: 0 }, { sourceMix: 1 }]) {
      const updates = renderer!.getDiagnostics().feedbackUpdates
      renderer!.render({ ...frame, settings: { ...defaults, ...patch }, timeSec: 0.22 })
      expect(renderer!.getDiagnostics().feedbackUpdates).toBe(updates)
      expect(renderer!.getDiagnostics().drawPasses).toBe(1)
    }
    renderer!.resize(320, 180); expect(renderer!.getDiagnostics().targets).toBe(0)
    renderer!.dispose()
  })
  it('keeps logical 4K Auto at Low, resets incompatible modes and has a bounded shader-failure cleanup', () => {
    const { canvas, frame, calls } = gpu(), { renderer } = DataBleedRenderer.create(canvas)
    renderer!.render({ ...frame, viewport: { width: 3840, height: 2160 } })
    expect(renderer!.getDiagnostics().quality).toBe('low')
    renderer!.render({ ...frame, settings: { ...defaults, flowMode: 'procedural' }, timeSec: 0.01 })
    expect(renderer!.getDiagnostics().drawPasses).toBeLessThanOrEqual(3)
    renderer!.dispose()
    calls.getShaderParameter.mockReturnValueOnce(false)
    const failed = DataBleedRenderer.create(canvas)
    expect(failed.renderer).toBeNull()
    expect(calls.deleteShader).toHaveBeenCalled()
  })
})
