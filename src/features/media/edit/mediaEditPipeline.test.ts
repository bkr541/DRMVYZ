import { describe, expect, it } from 'vitest'
import { createDefaultMediaEdit } from './mediaEditModel'
import {
  blurSigmaPx,
  buildColorTransform,
  isColorNeutral,
  opacityAmount,
  resolveEditGeometry,
  sharpenAmount,
} from './mediaEditPipeline'

const apply = (t: ReturnType<typeof buildColorTransform>, rgb: number[]) =>
  [0, 1, 2].map(row => t.matrix[row * 3]! * rgb[0]! + t.matrix[row * 3 + 1]! * rgb[1]! + t.matrix[row * 3 + 2]! * rgb[2]! + t.offset[row]!)

describe('edit geometry', () => {
  it('is the full source for a neutral edit', () => {
    const g = resolveEditGeometry(createDefaultMediaEdit(), 1920, 1080)
    expect(g.cropPx).toEqual({ x: 0, y: 0, width: 1920, height: 1080 })
    expect([g.outputWidth, g.outputHeight]).toEqual([1920, 1080])
  })

  it('accounts for crop AND rotation when sizing the output', () => {
    const edit = { ...createDefaultMediaEdit(), rotation: 90 as const, crop: { x: 0.25, y: 0, width: 0.5, height: 1 } }
    const g = resolveEditGeometry(edit, 2000, 1000)
    expect(g.cropPx).toEqual({ x: 500, y: 0, width: 1000, height: 1000 })
    expect([g.outputWidth, g.outputHeight]).toEqual([1000, 1000])
    const wide = resolveEditGeometry({ ...createDefaultMediaEdit(), rotation: 270 }, 2000, 1000)
    expect([wide.outputWidth, wide.outputHeight]).toEqual([1000, 2000])
  })

  it('keeps flip and mirror from changing the output size', () => {
    const g = resolveEditGeometry({ ...createDefaultMediaEdit(), flip: true, mirror: true }, 640, 360)
    expect([g.outputWidth, g.outputHeight]).toEqual([640, 360])
  })

  it('downscales to maxEdge and rounds video sizes to even numbers', () => {
    const g = resolveEditGeometry(createDefaultMediaEdit(), 4001, 2001, { maxEdge: 1000, even: true })
    expect(Math.max(g.outputWidth, g.outputHeight)).toBeLessThanOrEqual(1000)
    expect(g.outputWidth % 2).toBe(0)
    expect(g.outputHeight % 2).toBe(0)
  })

  it('never returns a crop outside the source', () => {
    const g = resolveEditGeometry({ ...createDefaultMediaEdit(), crop: { x: 0.999, y: 0.999, width: 0.02, height: 0.02 } }, 100, 100)
    expect(g.cropPx.x + g.cropPx.width).toBeLessThanOrEqual(100)
    expect(g.cropPx.y + g.cropPx.height).toBeLessThanOrEqual(100)
  })
})

describe('color transform', () => {
  it('is the identity for neutral sliders', () => {
    const t = buildColorTransform(createDefaultMediaEdit())
    expect(isColorNeutral(createDefaultMediaEdit())).toBe(true)
    for (const rgb of [[0, 0, 0], [0.2, 0.5, 0.9], [1, 1, 1]]) {
      apply(t, rgb).forEach((value, i) => expect(value).toBeCloseTo(rgb[i]!, 9))
    }
  })

  it('brightness scales, contrast pivots on mid-grey', () => {
    const bright = buildColorTransform({ ...createDefaultMediaEdit(), brightness: 50 })
    expect(apply(bright, [0.4, 0.4, 0.4])[0]).toBeCloseTo(0.6, 6)
    const contrast = buildColorTransform({ ...createDefaultMediaEdit(), contrast: 100 })
    expect(apply(contrast, [0.5, 0.5, 0.5])[0]).toBeCloseTo(0.5, 6)
    expect(apply(contrast, [0.6, 0.6, 0.6])[0]).toBeCloseTo(0.7, 6)
  })

  it('full desaturation collapses to luma; -100 and hue 0 stay neutral for grey', () => {
    const grey = buildColorTransform({ ...createDefaultMediaEdit(), saturation: -100 })
    const [r, g, b] = apply(grey, [0.8, 0.2, 0.2])
    expect(r).toBeCloseTo(g, 6)
    expect(g).toBeCloseTo(b, 6)
    expect(r).toBeCloseTo(0.2126 * 0.8 + 0.7152 * 0.2 + 0.0722 * 0.2, 6)
  })

  it('hue rotation preserves luminance-neutral greys and turns red toward green at 120°', () => {
    const t = buildColorTransform({ ...createDefaultMediaEdit(), hue: 120 })
    const grey = apply(t, [0.5, 0.5, 0.5])
    grey.forEach(v => expect(v).toBeCloseTo(0.5, 2))
    const [r, g] = apply(t, [1, 0, 0])
    expect(g).toBeGreaterThan(r)
  })

  it('the combined matrix equals applying the four stages in order', () => {
    const edit = { ...createDefaultMediaEdit(), brightness: 20, contrast: -30, saturation: 40, hue: 60 }
    const combined = apply(buildColorTransform(edit), [0.3, 0.6, 0.2])
    let rgb = [0.3, 0.6, 0.2]
    const b = buildColorTransform({ ...createDefaultMediaEdit(), brightness: 20 }); rgb = apply(b, rgb)
    const c = buildColorTransform({ ...createDefaultMediaEdit(), contrast: -30 }); rgb = apply(c, rgb)
    const s = buildColorTransform({ ...createDefaultMediaEdit(), saturation: 40 }); rgb = apply(s, rgb)
    const h = buildColorTransform({ ...createDefaultMediaEdit(), hue: 60 }); rgb = apply(h, rgb)
    combined.forEach((v, i) => expect(v).toBeCloseTo(rgb[i]!, 9))
  })
})

describe('detail and opacity', () => {
  it('sharpness is a real convolution amount: 0 is off, monotonic, bounded', () => {
    expect(sharpenAmount(0)).toBe(0)
    expect(sharpenAmount(50)).toBeGreaterThan(0)
    expect(sharpenAmount(100)).toBeGreaterThan(sharpenAmount(50))
    expect(sharpenAmount(1000)).toBe(sharpenAmount(100))
  })

  it('blur starts at zero and scales with the output so preview and export match', () => {
    expect(blurSigmaPx(0, 1920, 1080)).toBe(0)
    const big = blurSigmaPx(50, 1920, 1080)
    const small = blurSigmaPx(50, 960, 540)
    expect(big).toBeCloseTo(small * 2, 6)
    expect(blurSigmaPx(500, 100, 100)).toBe(blurSigmaPx(100, 100, 100))
  })

  it('opacity reads as 0–100%', () => {
    expect(opacityAmount(100)).toBe(1)
    expect(opacityAmount(25)).toBe(0.25)
    expect(opacityAmount(-4)).toBe(0)
  })
})
