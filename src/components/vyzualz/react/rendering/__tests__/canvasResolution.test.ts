import { describe, expect, it } from 'vitest'
import {
  applyCanvasResolution,
  MAX_CANVAS_BACKING_PIXELS,
  resolveCanvasResolution,
} from '../canvasResolution'

describe('resolveCanvasResolution', () => {
  it.each([
    [1, 1920, 1080, 1],
    [2, 2880, 1620, 1.5],
    [3, 2880, 1620, 1.5],
    [4, 2880, 1620, 1.5],
  ])('caps ordinary 1080p viewport at DPR %s', (dpr, width, height, effectiveDpr) => {
    const result = resolveCanvasResolution({
      cssWidth: 1920,
      cssHeight: 1080,
      devicePixelRatio: dpr,
      quality: 'high',
    })

    expect(result.valid).toBe(true)
    expect(result.backingWidth).toBe(width)
    expect(result.backingHeight).toBe(height)
    expect(result.effectiveDpr).toBeCloseTo(effectiveDpr, 5)
    expect(result.backingWidth * result.backingHeight).toBeLessThanOrEqual(MAX_CANVAS_BACKING_PIXELS)
  })

  it.each([1, 2, 3, 4])('keeps a 4K CSS viewport within the pixel budget at DPR %s', dpr => {
    const result = resolveCanvasResolution({
      cssWidth: 3840,
      cssHeight: 2160,
      devicePixelRatio: dpr,
      quality: 'ultra',
    })

    expect(result.valid).toBe(true)
    expect(result.backingWidth).toBe(3840)
    expect(result.backingHeight).toBe(2160)
    expect(result.backingWidth * result.backingHeight).toBe(MAX_CANVAS_BACKING_PIXELS)
  })

  it('preserves the user-selectable ultra path for ordinary viewports', () => {
    const high = resolveCanvasResolution({
      cssWidth: 1920,
      cssHeight: 1080,
      devicePixelRatio: 4,
      quality: 'high',
    })
    const ultra = resolveCanvasResolution({
      cssWidth: 1920,
      cssHeight: 1080,
      devicePixelRatio: 4,
      quality: 'ultra',
    })

    expect(high.backingWidth).toBe(2880)
    expect(ultra.backingWidth).toBe(3840)
    expect(ultra.effectiveDpr).toBeCloseTo(2, 5)
  })

  it('applies the pixel budget after internal shader resolution scaling', () => {
    const result = resolveCanvasResolution({
      cssWidth: 3840,
      cssHeight: 2160,
      devicePixelRatio: 4,
      quality: 'ultra',
      resolutionScale: 0.75,
    })

    expect(result.backingWidth * result.backingHeight).toBeLessThanOrEqual(MAX_CANVAS_BACKING_PIXELS)
    expect(result.backingWidth).toBe(3840)
    expect(result.backingHeight).toBe(2160)
  })

  it('rejects zero, negative, and non-finite layout sizes without allocating', () => {
    for (const [cssWidth, cssHeight] of [[0, 100], [100, 0], [-1, 100], [Infinity, 100], [100, NaN]]) {
      const result = resolveCanvasResolution({ cssWidth, cssHeight, devicePixelRatio: 4 })
      expect(result.valid).toBe(false)
      expect(result.backingWidth).toBe(0)
      expect(result.backingHeight).toBe(0)
    }
  })

  it('stabilizes one-pixel backing-size chatter from fractional observer values', () => {
    const first = resolveCanvasResolution({
      cssWidth: 1000,
      cssHeight: 500,
      devicePixelRatio: 1.5,
      quality: 'high',
    })
    const jittered = resolveCanvasResolution({
      cssWidth: 1000.4,
      cssHeight: 500.2,
      devicePixelRatio: 1.5,
      quality: 'high',
      previous: first,
    })

    expect(jittered.backingWidth).toBe(first.backingWidth)
    expect(jittered.backingHeight).toBe(first.backingHeight)
  })

  it('does not carry hysteresis across a quality change', () => {
    const high = resolveCanvasResolution({
      cssWidth: 800,
      cssHeight: 600,
      devicePixelRatio: 2,
      quality: 'high',
    })
    const ultra = resolveCanvasResolution({
      cssWidth: 800,
      cssHeight: 600,
      devicePixelRatio: 2,
      quality: 'ultra',
      previous: high,
    })

    expect(ultra.backingWidth).toBe(1600)
    expect(ultra.backingHeight).toBe(1200)
  })
})

describe('applyCanvasResolution', () => {
  it('does not rewrite unchanged canvas storage', () => {
    const canvas = { width: 1500, height: 750 }
    const resolution = resolveCanvasResolution({
      cssWidth: 1000,
      cssHeight: 500,
      devicePixelRatio: 1.5,
    })

    expect(applyCanvasResolution(canvas, resolution)).toBe(false)
    expect(canvas).toEqual({ width: 1500, height: 750 })
  })
})
