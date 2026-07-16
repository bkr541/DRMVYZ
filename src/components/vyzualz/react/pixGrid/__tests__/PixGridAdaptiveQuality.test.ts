import { describe, expect, it } from 'vitest'
import {
  PixGridAdaptiveQualityController,
  resolvePixGridAdaptiveQualityProfile,
} from '../PixGridAdaptiveQuality'

describe('PixGrid adaptive quality', () => {
  it('reduces secondary effects before reducing the logical matrix', () => {
    const full = resolvePixGridAdaptiveQualityProfile('high', 'adaptive', 0)
    const reduced = resolvePixGridAdaptiveQualityProfile('high', 'adaptive', 1)
    const minimal = resolvePixGridAdaptiveQualityProfile('high', 'adaptive', 2)
    const logicalReduction = resolvePixGridAdaptiveQualityProfile('high', 'adaptive', 3)

    expect(full).toMatchObject({ logicalWidth: 160, logicalHeight: 90, glowScale: 1 })
    expect(reduced.logicalWidth).toBe(160)
    expect(reduced.glowScale).toBeLessThan(full.glowScale)
    expect(minimal.logicalWidth).toBe(160)
    expect(minimal.rgbSubpixelEnabled).toBe(false)
    expect(logicalReduction).toMatchObject({ logicalQuality: 'low', logicalWidth: 96, logicalHeight: 54 })
  })

  it('never adaptively drops below 96 × 54 and respects fixed quality', () => {
    expect(resolvePixGridAdaptiveQualityProfile('draft', 'adaptive', 0)).toMatchObject({
      logicalQuality: 'low',
      logicalWidth: 96,
      logicalHeight: 54,
    })
    expect(resolvePixGridAdaptiveQualityProfile('draft', 'adaptive', 3)).toMatchObject({
      logicalQuality: 'low',
      logicalWidth: 96,
      logicalHeight: 54,
    })
    expect(resolvePixGridAdaptiveQualityProfile('ultra', 'fixed', 3)).toMatchObject({
      stage: 0,
      logicalQuality: 'ultra',
      logicalWidth: 256,
      logicalHeight: 144,
      reason: 'fixed',
    })
  })

  it('uses sustained samples, cooldown, and one-stage recovery to avoid oscillation', () => {
    const controller = new PixGridAdaptiveQualityController({
      degradeSamples: 2,
      recoverSamples: 2,
      transitionCooldownMs: 1_000,
    })

    expect(controller.sample({ fps: 40, nowMs: 0, requestedQuality: 'high', mode: 'adaptive' }).stage).toBe(0)
    expect(controller.sample({ fps: 40, nowMs: 100, requestedQuality: 'high', mode: 'adaptive' }).stage).toBe(1)

    // More slow samples inside the cooldown do not trigger repeated reallocations.
    expect(controller.sample({ fps: 40, nowMs: 200, requestedQuality: 'high', mode: 'adaptive' }).stage).toBe(1)
    expect(controller.sample({ fps: 40, nowMs: 300, requestedQuality: 'high', mode: 'adaptive' }).stage).toBe(1)
    expect(controller.sample({ fps: 40, nowMs: 1_200, requestedQuality: 'high', mode: 'adaptive' }).stage).toBe(2)

    expect(controller.sample({ fps: 60, nowMs: 2_300, requestedQuality: 'high', mode: 'adaptive' }).stage).toBe(2)
    expect(controller.sample({ fps: 60, nowMs: 2_400, requestedQuality: 'high', mode: 'adaptive' }).stage).toBe(1)
    expect(controller.sample({ fps: 60, nowMs: 3_500, requestedQuality: 'high', mode: 'adaptive' }).stage).toBe(1)
    expect(controller.sample({ fps: 60, nowMs: 3_600, requestedQuality: 'high', mode: 'adaptive' }).stage).toBe(0)
  })

  it('keeps thumbnail work isolated from the live controller', () => {
    const controller = new PixGridAdaptiveQualityController({ degradeSamples: 1, transitionCooldownMs: 0 })
    const thumbnail = controller.sample({
      fps: 1,
      nowMs: 1,
      requestedQuality: 'ultra',
      mode: 'adaptive',
      thumbnail: true,
    })

    expect(thumbnail.stage).toBe(0)
    expect(controller.currentStage).toBe(0)
  })
})
