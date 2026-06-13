import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetLaserDmxCompilerState } from '../LaserDmxCompiler'
import { shouldRenderLaserDmx, clearLaserDmxVisualState } from '../LaserDmxRenderer'

// Minimal CanvasRenderingContext2D stub — only the properties clearLaserDmxVisualState touches.
function makeMockCtx() {
  return {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    fillRect: vi.fn(),
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

  it('returns true when isPlaying is undefined (backward-compatible: absent = playing)', () => {
    expect(shouldRenderLaserDmx(undefined)).toBe(true)
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

  it('sets globalAlpha to 1 before filling', () => {
    ctx.globalAlpha = 0.3
    clearLaserDmxVisualState(ctx, 800, 600)
    expect(ctx.globalAlpha).toBe(1)
  })

  it('uses source-over composite so the fill fully covers the canvas', () => {
    ctx.globalCompositeOperation = 'screen'
    clearLaserDmxVisualState(ctx, 800, 600)
    expect(ctx.globalCompositeOperation).toBe('source-over')
  })

  it('fills with solid black (#000000)', () => {
    clearLaserDmxVisualState(ctx, 800, 600)
    expect(ctx.fillStyle).toBe('#000000')
  })

  it('calls fillRect with the full canvas dimensions', () => {
    clearLaserDmxVisualState(ctx, 1920, 1080)
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1920, 1080)
  })

  it('calls fillRect exactly once', () => {
    clearLaserDmxVisualState(ctx, 800, 600)
    expect(ctx.fillRect).toHaveBeenCalledTimes(1)
  })

  it('also resets compiler state without throwing', () => {
    expect(() => clearLaserDmxVisualState(ctx, 100, 100)).not.toThrow()
  })

  it('works with small canvas dimensions', () => {
    clearLaserDmxVisualState(ctx, 1, 1)
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1, 1)
  })
})
