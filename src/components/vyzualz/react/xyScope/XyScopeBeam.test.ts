// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { XyScopeBeamRenderer, parseXyScopeColor, xyScopeSegmentBrightness, XY_SCOPE_REFERENCE_SEGMENT_PX } from './XyScopeBeam'

describe('xyScopeSegmentBrightness', () => {
  it('is bright for a slow edge and dim for a long jump, like a real beam', () => {
    const slow = xyScopeSegmentBrightness(3, 14, 0, 0, 0)
    const fast = xyScopeSegmentBrightness(120, 14, 0, 0, 0)
    expect(slow).toBeGreaterThan(0.75)
    expect(fast).toBeLessThan(0.1)
    expect(slow).toBeGreaterThan(fast)
  })

  it('brightens just after a hit and never exceeds 1', () => {
    expect(xyScopeSegmentBrightness(10, 14, 1, 0, 0)).toBeGreaterThan(xyScopeSegmentBrightness(10, 14, 0, 0, 0))
    expect(xyScopeSegmentBrightness(3, 100, 1, 0, 0)).toBeLessThanOrEqual(1)
  })

  it('puts the same light on each length of line, so a tightly packed figure is not brighter than a letter', () => {
    const letter = xyScopeSegmentBrightness(XY_SCOPE_REFERENCE_SEGMENT_PX, 14, 0, 0, 0)
    const packed = xyScopeSegmentBrightness(XY_SCOPE_REFERENCE_SEGMENT_PX / 4, 14, 0, 0, 0)
    expect(packed).toBeLessThan(letter * 0.3)
    expect(xyScopeSegmentBrightness(0, 14, 0, 0, 0)).toBe(0)
  })

  it('dims dissolved points so the cloud stays thin and the word stays the brightest thing', () => {
    const solid = xyScopeSegmentBrightness(3, 14, 0, 0, 0)
    const cloud = xyScopeSegmentBrightness(3, 14, 0, 1, 1)
    expect(cloud).toBeLessThan(solid * 0.3)
  })

  it('never returns a negative or NaN brightness', () => {
    for (const length of [0, 0.5, 50, 5000]) {
      const value = xyScopeSegmentBrightness(length, 0, 0, 1, 1)
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('parseXyScopeColor', () => {
  it('parses six-digit hex and falls back otherwise', () => {
    expect(parseXyScopeColor('#14d9c5', [0, 0, 0])).toEqual([20, 217, 197])
    expect(parseXyScopeColor('teal', [1, 2, 3])).toEqual([1, 2, 3])
    expect(parseXyScopeColor('#fff', [1, 2, 3])).toEqual([1, 2, 3])
  })
})

describe('XyScopeBeamRenderer fade', () => {
  it('takes one level off each frame and clamps to the background, so a trail reaches the background exactly', () => {
    const ops: string[] = []
    const fills: string[] = []
    const ctx = {
      set globalCompositeOperation(value: string) { ops.push(value) },
      get globalCompositeOperation() { return ops[ops.length - 1] ?? 'source-over' },
      set fillStyle(value: string) { fills.push(value) },
      setTransform: vi.fn(), fillRect: vi.fn(), stroke: vi.fn(),
    }
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    const renderer = new XyScopeBeamRenderer(canvas)
    renderer.resize(100, 100, 1)
    renderer.draw([], [], [], 1 / 60, { beamColor: [255, 255, 255], glowColor: [0, 255, 255], backgroundColor: [3, 9, 12], intensity: 1, glow: 1, trailMs: 110 })
    expect(ops.indexOf('color-burn')).toBeGreaterThan(-1)
    expect(ops.indexOf('lighten')).toBeGreaterThan(ops.indexOf('color-burn'))
    expect(fills).toContain('rgb(3,9,12)')
  })
})
