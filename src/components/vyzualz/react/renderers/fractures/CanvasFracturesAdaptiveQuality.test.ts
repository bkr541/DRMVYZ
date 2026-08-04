import { describe, expect, it } from 'vitest'
import {
  CanvasFracturesAdaptiveQualityController,
  resolveCanvasFracturesQualityProfile,
  selectCanvasFracturesStableSubset,
} from './CanvasFracturesAdaptiveQuality'

describe('CanvasFracturesAdaptiveQuality', () => {
  it('exposes fixed profiles for every persisted quality tier', () => {
    expect(resolveCanvasFracturesQualityProfile('low')).toEqual({ tier: 'low', fragmentCap: 24, dprCap: 1 })
    expect(resolveCanvasFracturesQualityProfile('balanced').fragmentCap).toBe(48)
    expect(resolveCanvasFracturesQualityProfile('high').fragmentCap).toBe(80)
    expect(resolveCanvasFracturesQualityProfile('ultra')).toEqual({ tier: 'ultra', fragmentCap: 112, dprCap: 2 })
  })

  it('requires sustained pressure and headroom before changing Auto quality', () => {
    const controller = new CanvasFracturesAdaptiveQualityController()
    expect(controller.reset('auto')).toBe('balanced')
    for (let index = 0; index < 20; index += 1) controller.sample('auto', 28)
    expect(controller.sample('auto', 28)).toBe('balanced')
    for (let index = 0; index < 20; index += 1) controller.sample('auto', 28)
    expect(controller.sample('auto', 28)).toBe('low')

    for (let index = 0; index < 360; index += 1) controller.sample('auto', 12)
    expect(controller.sample('auto', 12)).toBe('low')
    for (let index = 0; index < 80; index += 1) controller.sample('auto', 12)
    expect(controller.sample('auto', 12)).toBe('balanced')
  })

  it('keeps explicit modes static regardless of frame pressure', () => {
    const controller = new CanvasFracturesAdaptiveQualityController()
    expect(controller.reset('ultra')).toBe('ultra')
    for (let index = 0; index < 200; index += 1) expect(controller.sample('ultra', 80)).toBe('ultra')
  })

  it('selects nested deterministic subsets while always retaining focus', () => {
    const fragments = Array.from({ length: 20 }, (_, index) => ({
      id: `fragment-${index}`,
      anchorRole: index === 17 ? 'focus' : 'fragment',
      depth: index,
    }))
    const low = selectCanvasFracturesStableSubset(fragments, 5)
    const high = selectCanvasFracturesStableSubset(fragments, 10)
    expect(low).toHaveLength(5)
    expect(high).toHaveLength(10)
    expect(low.some(fragment => fragment.anchorRole === 'focus')).toBe(true)
    expect(low.every(fragment => high.includes(fragment))).toBe(true)
    expect(selectCanvasFracturesStableSubset(fragments, 5).map(fragment => fragment.id))
      .toEqual(low.map(fragment => fragment.id))
  })
})
