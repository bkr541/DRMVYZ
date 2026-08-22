import { describe, expect, it, vi } from 'vitest'
import {
  LaserDmxRendererLifecycle,
  disposeLaserDmxRendererLifecycle,
  getLaserDmxRendererLifecycle,
} from '../LaserDmxRendererLifecycle'

describe('LaserDMX renderer lifecycle helper', () => {
  it('pauses, resumes, and resets transient resources on track and preset replacement', () => {
    const reset = vi.fn()
    const lifecycle = new LaserDmxRendererLifecycle(reset)

    expect(lifecycle.sync({ isPlaying: true, trackKey: 'track-a', presetKey: 'preset-a' })).toBe(true)
    expect(lifecycle.snapshot.paused).toBe(false)

    lifecycle.pause()
    expect(lifecycle.snapshot.paused).toBe(true)
    lifecycle.resume()
    expect(lifecycle.snapshot.paused).toBe(false)

    lifecycle.sync({ isPlaying: true, trackKey: 'track-b', presetKey: 'preset-a' })
    lifecycle.sync({ isPlaying: true, trackKey: 'track-b', presetKey: 'preset-b' })
    expect(reset.mock.calls.map(call => call[0])).toEqual(['trackReplacement', 'presetReplacement'])
    expect(lifecycle.snapshot.generation).toBe(2)
  })

  it('allows an isolated authoring preview to draw while stopped without opening the ordinary playback gate', () => {
    const reset = vi.fn()
    const lifecycle = new LaserDmxRendererLifecycle(reset)

    expect(lifecycle.sync({
      isPlaying: false,
      allowWhileStopped: true,
      trackKey: 'track-a',
      presetKey: 'preview-a',
    })).toBe(true)
    expect(lifecycle.snapshot.paused).toBe(false)

    expect(lifecycle.sync({
      isPlaying: false,
      trackKey: 'track-a',
      presetKey: 'preview-a',
    })).toBe(false)
    expect(lifecycle.snapshot.paused).toBe(true)
  })

  it('blocks drawing during context loss, resets on restoration, and disposes idempotently', () => {
    const reset = vi.fn()
    const lifecycle = new LaserDmxRendererLifecycle(reset)
    lifecycle.sync({ isPlaying: true, trackKey: 'track-a', presetKey: 'preset-a' })

    lifecycle.handleContextLost()
    expect(lifecycle.snapshot.contextLost).toBe(true)
    expect(reset).toHaveBeenCalledWith('contextLost')
    expect(lifecycle.sync({ isPlaying: true, trackKey: 'track-a', presetKey: 'preset-a' })).toBe(false)

    lifecycle.handleContextRestored()
    expect(lifecycle.snapshot.contextLost).toBe(false)
    expect(reset).toHaveBeenCalledWith('contextRestored')

    lifecycle.dispose()
    lifecycle.dispose()
    expect(lifecycle.snapshot.disposed).toBe(true)
    expect(reset.mock.calls.filter(call => call[0] === 'dispose')).toHaveLength(1)
    expect(lifecycle.sync({ isPlaying: true, trackKey: 'track-a', presetKey: 'preset-a' })).toBe(false)
  })

  it('ignores duplicate context notifications and restores only after a real loss', () => {
    const reset = vi.fn()
    const lifecycle = new LaserDmxRendererLifecycle(reset)

    lifecycle.handleContextRestored()
    expect(reset).not.toHaveBeenCalled()

    lifecycle.handleContextLost()
    lifecycle.handleContextLost()
    lifecycle.handleContextRestored()
    lifecycle.handleContextRestored()

    expect(reset.mock.calls.map(call => call[0])).toEqual(['contextLost', 'contextRestored'])
  })

  it('subscribes to standard WebGL context events and removes every listener on dispose', () => {
    const listeners = new Map<string, EventListener>()
    const canvas = {
      addEventListener: vi.fn((name: string, listener: EventListener) => listeners.set(name, listener)),
      removeEventListener: vi.fn((name: string) => listeners.delete(name)),
    }
    const ctx = { canvas } as unknown as CanvasRenderingContext2D
    const reset = vi.fn()

    const lifecycle = getLaserDmxRendererLifecycle(ctx, reset)
    expect(canvas.addEventListener).toHaveBeenCalledWith('webglcontextlost', expect.any(Function))
    expect(canvas.addEventListener).toHaveBeenCalledWith('webglcontextrestored', expect.any(Function))

    const preventDefault = vi.fn()
    listeners.get('webglcontextlost')?.({ preventDefault } as unknown as Event)
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(lifecycle.snapshot.contextLost).toBe(true)
    listeners.get('webglcontextrestored')?.({} as Event)
    expect(lifecycle.snapshot.contextLost).toBe(false)

    disposeLaserDmxRendererLifecycle(ctx)
    expect(canvas.removeEventListener).toHaveBeenCalledWith('webglcontextlost', expect.any(Function))
    expect(canvas.removeEventListener).toHaveBeenCalledWith('webglcontextrestored', expect.any(Function))
    expect(listeners.size).toBe(0)
  })
})
