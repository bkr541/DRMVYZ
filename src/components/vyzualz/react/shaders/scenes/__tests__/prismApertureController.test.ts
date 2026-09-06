import { describe, expect, it } from 'vitest'
import {
  PRISM_APERTURE_GLSL,
  PRISM_APERTURE_LIMITS,
  PRISM_APERTURE_PARAMETER_ID,
  PrismApertureController,
  applyPrismApertureTransform,
  resolvePrismApertureTarget,
} from '../prismApertureController'
import { PrismRadialTopologyGenerator } from '../prismRadialTopology'

function topologyElement() {
  const topology = new PrismRadialTopologyGenerator().generate({ baseRadius: 0.9, curvature: 0.6 })
  return { ...topology.elements[3] }
}

describe('PrismApertureController', () => {
  it('defines safe min/default/max aperture targets', () => {
    expect(resolvePrismApertureTarget(-100)).toBe(PRISM_APERTURE_LIMITS.min)
    expect(resolvePrismApertureTarget(PRISM_APERTURE_LIMITS.default)).toBe(PRISM_APERTURE_LIMITS.default)
    expect(resolvePrismApertureTarget(100)).toBe(PRISM_APERTURE_LIMITS.max)
    expect(resolvePrismApertureTarget(Number.NaN)).toBe(PRISM_APERTURE_LIMITS.default)
  })

  it('preserves the Stage 1 default form and stable topology identity', () => {
    const element = topologyElement()
    const transformed = applyPrismApertureTransform(element, PRISM_APERTURE_LIMITS.default)

    expect(transformed.innerRadius).toBe(element.innerRadius)
    expect(transformed.outerRadius).toBe(element.outerRadius)
    expect(transformed.baseRadius).toBe(element.baseRadius)
    expect(transformed.id).toBe(element.id)
    expect(transformed.index).toBe(element.index)
    expect(transformed.oppositeIndex).toBe(element.oppositeIndex)
    expect(transformed.groupIndex).toBe(element.groupIndex)
  })

  it('contracts and opens the center without invalid or inverted radii', () => {
    const element = topologyElement()
    const closed = applyPrismApertureTransform(element, PRISM_APERTURE_LIMITS.min)
    const opened = applyPrismApertureTransform(element, PRISM_APERTURE_LIMITS.max)

    expect(closed.innerRadius).toBeLessThan(element.innerRadius)
    expect(opened.innerRadius).toBeGreaterThan(element.innerRadius)
    expect(opened.outerRadius).toBeGreaterThan(closed.outerRadius)
    for (const transformed of [closed, opened]) {
      expect(Number.isFinite(transformed.innerRadius)).toBe(true)
      expect(Number.isFinite(transformed.outerRadius)).toBe(true)
      expect(transformed.innerRadius).toBeGreaterThanOrEqual(0)
      expect(transformed.outerRadius).toBeGreaterThan(transformed.innerRadius)
    }
  })

  it('keeps temporary offsets runtime-only and reconstructs from canonical state', () => {
    const controller = new PrismApertureController()
    const canonical = { [PRISM_APERTURE_PARAMETER_ID]: 1.2 }
    const first = controller.resolve({ values: canonical, deltaTimeSec: 1 / 60, reconstruct: false })
    expect(first.aperture).toBe(1.2)
    expect(canonical.aperture).toBe(1.2)

    controller.setTemporaryOffset(PRISM_APERTURE_PARAMETER_ID, 0.6)
    const offset = controller.resolve({ values: canonical, deltaTimeSec: 0.12, reconstruct: false })
    expect(offset.aperture as number).toBeGreaterThan(1.2)
    expect(offset.aperture as number).toBeLessThanOrEqual(1.8)
    expect(canonical.aperture).toBe(1.2)

    const reconstructed = controller.resolve({ values: canonical, deltaTimeSec: 1 / 60, reconstruct: true })
    expect(reconstructed.aperture).toBe(1.2)
    const after = controller.resolve({ values: canonical, deltaTimeSec: 1, reconstruct: false })
    expect(after.aperture).toBe(1.2)
  })

  it('stays finite while the authored control is slammed between min and max', () => {
    const controller = new PrismApertureController()
    let value = PRISM_APERTURE_LIMITS.default
    for (let index = 0; index < 120; index += 1) {
      const authored = index % 2 === 0 ? PRISM_APERTURE_LIMITS.min : PRISM_APERTURE_LIMITS.max
      const resolved = controller.resolve({
        values: { [PRISM_APERTURE_PARAMETER_ID]: authored },
        deltaTimeSec: 1 / 120,
        reconstruct: false,
      })
      value = resolved.aperture as number
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(PRISM_APERTURE_LIMITS.min)
      expect(value).toBeLessThanOrEqual(PRISM_APERTURE_LIMITS.max)
    }
  })

  it('publishes a shader transform that clamps aperture and preserves ordered radii', () => {
    expect(PRISM_APERTURE_GLSL).toContain('PrismRadialElement prismApplyAperture')
    expect(PRISM_APERTURE_GLSL).toContain('clamp(resolvedAperture')
    expect(PRISM_APERTURE_GLSL).toContain('element.outerRadius = max(')
  })
})
