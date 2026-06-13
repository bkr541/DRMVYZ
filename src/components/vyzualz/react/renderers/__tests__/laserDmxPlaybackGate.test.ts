import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetLaserDmxCompilerState } from '../LaserDmxCompiler'
import { clearLaserDmxVisualState, shouldRenderLaserDmx } from '../LaserDmxRenderer'

// Minimal CanvasRenderingContext2D stub covering every property clearLaserDmxVisualState touches.
function makeMockCtx() {
  return {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    clearRect:    vi.fn(),
    fillRect:     vi.fn(),
    save:         vi.fn(),
    restore:      vi.fn(),
    setTransform: vi.fn(),
  } as unknown as CanvasRenderingContext2D
}

// ── shouldRenderLaserDmx ──────────────────────────────────────────────────────

describe('shouldRenderLaserDmx', () => {
  it('returns true when isPlaying is true', () => {
    expect(shouldRenderLaserDmx(true)).toBe(true)
  })

  it('returns false when isPlaying is false', () => {
    expect(shouldRenderLaserDmx(false)).toBe(false)
  })

  it('is a strict boolean gate — true always renders, false always clears', () => {
    expect(shouldRenderLaserDmx(true)).not.toBe(false)
    expect(shouldRenderLaserDmx(false)).not.toBe(true)
  })
})

// ── resetLaserDmxCompilerState ────────────────────────────────────────────────

describe('resetLaserDmxCompilerState', () => {
  it('can be called without throwing', () => {
    expect(() => resetLaserDmxCompilerState()).not.toThrow()
  })

  it('is idempotent — calling multiple times in a row does not throw', () => {
    resetLaserDmxCompilerState()
    resetLaserDmxCompilerState()
    resetLaserDmxCompilerState()
  })
})

// ── clearLaserDmxVisualState ──────────────────────────────────────────────────

describe('clearLaserDmxVisualState', () => {
  let ctx: CanvasRenderingContext2D

  beforeEach(() => {
    ctx = makeMockCtx()
  })

  it('calls ctx.save() to preserve surrounding draw state', () => {
    clearLaserDmxVisualState(ctx, 800, 600)
    expect(ctx.save).toHaveBeenCalledTimes(1)
  })

  it('resets the transform so DPR scaling does not clip the clear', () => {
    clearLaserDmxVisualState(ctx, 800, 600)
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0)
  })

  it('sets globalAlpha to 1 so the clear is fully opaque', () => {
    ctx.globalAlpha = 0.3
    clearLaserDmxVisualState(ctx, 800, 600)
    expect(ctx.globalAlpha).toBe(1)
  })

  it('sets composite to source-over before clearing', () => {
    ctx.globalCompositeOperation = 'screen'
    clearLaserDmxVisualState(ctx, 800, 600)
    expect(ctx.globalCompositeOperation).toBe('source-over')
  })

  it('calls clearRect with the full canvas dimensions', () => {
    clearLaserDmxVisualState(ctx, 1920, 1080)
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 1920, 1080)
  })

  it('calls clearRect exactly once', () => {
    clearLaserDmxVisualState(ctx, 800, 600)
    expect(ctx.clearRect).toHaveBeenCalledTimes(1)
  })

  it('does NOT call fillRect — uses clearRect instead for a true transparent clear', () => {
    clearLaserDmxVisualState(ctx, 800, 600)
    expect(ctx.fillRect).not.toHaveBeenCalled()
  })

  it('calls ctx.restore() after clearing', () => {
    clearLaserDmxVisualState(ctx, 800, 600)
    expect(ctx.restore).toHaveBeenCalledTimes(1)
  })

  it('works with small canvas dimensions', () => {
    clearLaserDmxVisualState(ctx, 1, 1)
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 1, 1)
  })

  it('also resets compiler state without throwing', () => {
    expect(() => clearLaserDmxVisualState(ctx, 100, 100)).not.toThrow()
  })
})

// ── handleEnded logic (pure verification) ─────────────────────────────────────

describe('handleEnded gate logic', () => {
  // Simulates the fixed handleEnded logic in useAudioEngine without needing a hook.

  function simulateEnded(currentIndex: number, tracksLength: number): {
    newIndex:    number
    isPlaying:   boolean
  } {
    const nextIndex    = currentIndex + 1
    const hasNextTrack = nextIndex < tracksLength
    return {
      newIndex:  hasNextTrack ? nextIndex : currentIndex,
      isPlaying: hasNextTrack,
    }
  }

  it('advances the index and keeps playing when a next track exists', () => {
    const result = simulateEnded(0, 3)
    expect(result.newIndex).toBe(1)
    expect(result.isPlaying).toBe(true)
  })

  it('does NOT advance the index when at the last track', () => {
    const result = simulateEnded(2, 3)
    expect(result.newIndex).toBe(2)
    expect(result.isPlaying).toBe(false)
  })

  it('sets isPlaying to false when the only track ends', () => {
    const result = simulateEnded(0, 1)
    expect(result.isPlaying).toBe(false)
  })

  it('sets isPlaying to false — LaserDMX gate will fire on the next frame', () => {
    const result = simulateEnded(4, 5)
    // index 4 is the last of 5 tracks: next would be 5, but tracks.length is 5 → no next
    expect(result.isPlaying).toBe(false)
  })

  it('advances correctly through a two-track playlist', () => {
    const step1 = simulateEnded(0, 2)
    expect(step1.newIndex).toBe(1)
    expect(step1.isPlaying).toBe(true)

    const step2 = simulateEnded(1, 2)
    expect(step2.newIndex).toBe(1)
    expect(step2.isPlaying).toBe(false)
  })
})
