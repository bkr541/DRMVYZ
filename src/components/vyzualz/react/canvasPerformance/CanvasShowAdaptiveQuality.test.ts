import { describe, expect, it } from 'vitest'
import { CanvasShowAdaptiveQualityController, MAX_CANVAS_SHOW_COMPOSITION_PIXELS, resolveCanvasShowCompositionDimensions } from './CanvasShowAdaptiveQuality'

describe('Canvas Show adaptive quality', () => {
  it('starts four videos reduced, steps down only after sustained load, and recovers gradually', () => {
    const controller = new CanvasShowAdaptiveQualityController()
    expect(controller.reset(4).tier).toBe('reduced')
    for (let frame = 0; frame < 12; frame += 1) controller.sample(35, 4)
    expect(controller.snapshot().tier).toBe('reduced')
    for (let frame = 0; frame < 80; frame += 1) controller.sample(35, 4)
    expect(controller.snapshot().tier).toBe('minimum')
    for (let frame = 0; frame < 160; frame += 1) controller.sample(8, 4)
    expect(controller.snapshot().tier).toBe('minimum')
    for (let frame = 0; frame < 180; frame += 1) controller.sample(8, 4)
    expect(controller.snapshot().tier).toBe('reduced')
  })


  it('bounds composition pixels while preserving quality-tier scaling', () => {
    const full = resolveCanvasShowCompositionDimensions({ outputWidth: 7680, outputHeight: 4320, qualityScale: 1 })
    const reduced = resolveCanvasShowCompositionDimensions({ outputWidth: 7680, outputHeight: 4320, qualityScale: 0.62 })
    expect(full.width * full.height).toBeLessThanOrEqual(MAX_CANVAS_SHOW_COMPOSITION_PIXELS + 1920)
    expect(full.width).toBeGreaterThan(reduced.width)
    expect(full.height).toBeGreaterThan(reduced.height)
    expect(reduced.width / full.width).toBeCloseTo(0.62, 1)
  })

  it('does not let quality changes alter the reported video concurrency', () => {
    const controller = new CanvasShowAdaptiveQualityController()
    controller.reset(3)
    for (let frame = 0; frame < 100; frame += 1) controller.sample(40, 3)
    expect(controller.snapshot().activeVideoCount).toBe(3)
  })
})
