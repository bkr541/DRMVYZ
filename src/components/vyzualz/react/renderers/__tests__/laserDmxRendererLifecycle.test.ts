import { describe, expect, it, vi } from 'vitest'
import { LaserDmxRendererLifecycle } from '../LaserDmxRendererLifecycle'

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

  it('blocks drawing during context loss, resets on restoration, and disposes idempotently', () => {
    const reset = vi.fn()
    const lifecycle = new LaserDmxRendererLifecycle(reset)
    lifecycle.sync({ isPlaying: true, trackKey: 'track-a', presetKey: 'preset-a' })

    lifecycle.handleContextLost()
    expect(lifecycle.snapshot.contextLost).toBe(true)
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
})
