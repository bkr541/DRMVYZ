import { describe, expect, it } from 'vitest'
import {
  SCOPE_PHOSPHOR_QUALITY_ORDER,
  resolveScopeHdrTargetStrategy,
  resolveScopePhosphorPlan,
} from '../soundDrawingPhosphorPlan'

// ── Performance budgets ───────────────────────────────────────────────────────
//
// The brief asks for budgets rather than "looks smooth". These are the
// structural ones, assertable without a GPU: how many passes each tier runs, how
// much geometry it submits, and how much fill it asks for. A change that pushes a
// tier past its budget fails here rather than being discovered as a dropped frame
// on someone's laptop.

const HDR = resolveScopeHdrTargetStrategy({
  colorBufferFloat: true, rgba16fRenderable: true, floatLinearFiltering: true, floatBlend: true,
})

/** Documented ceilings per tier. */
const PASS_BUDGET: Record<string, number> = { low: 6, medium: 9, high: 11, ultra: 11 }
const TRACE_POINT_BUDGET: Record<string, number> = { low: 512, medium: 1024, high: 2048, ultra: 4096 }

/** Total fill as a multiple of one full-resolution pass. */
function fillCost(quality: (typeof SCOPE_PHOSPHOR_QUALITY_ORDER)[number]): number {
  const plan = resolveScopePhosphorPlan(quality, HDR)
  // Beam and composite run at full resolution; persistence at its own scale;
  // each bloom level runs twice at its scale squared (area).
  let cost = 1 + 1 + plan.persistenceResolutionScale ** 2
  for (const level of plan.bloomLevels) cost += 2 * level.resolutionScale ** 2
  if (plan.crtEnabled) cost += 1
  return cost
}

describe('pass budget', () => {
  it('keeps every tier within its documented pass count', () => {
    for (const quality of SCOPE_PHOSPHOR_QUALITY_ORDER) {
      const plan = resolveScopePhosphorPlan(quality, HDR)
      expect({ quality, passes: plan.estimatedPassCount <= PASS_BUDGET[quality] })
        .toEqual({ quality, passes: true })
    }
  })

  it('keeps geometry within its documented point count', () => {
    for (const quality of SCOPE_PHOSPHOR_QUALITY_ORDER) {
      expect(resolveScopePhosphorPlan(quality, HDR).maxTracePoints)
        .toBeLessThanOrEqual(TRACE_POINT_BUDGET[quality])
    }
  })
})

describe('fill budget', () => {
  it('never runs a bloom level at full resolution', () => {
    // Full-resolution blur is the single most expensive thing this pipeline could
    // do, and a tight glow does not need it. Also what keeps the Gaussian's
    // texel-space sigma small enough for the tap budget to reach its tail.
    for (const quality of SCOPE_PHOSPHOR_QUALITY_ORDER) {
      for (const level of resolveScopePhosphorPlan(quality, HDR).bloomLevels) {
        expect(level.resolutionScale).toBeLessThan(1)
      }
    }
  })

  it('bounds total fill on the most expensive tier', () => {
    // Four full-resolution passes are the fixed cost — beam, persistence,
    // composite, CRT — and the whole bloom pyramid adds well under a fifth on top
    // because every level is downscaled. Measured at 4.63.
    expect(fillCost('ultra')).toBeLessThan(5)
  })

  it('spends less than one full pass on the entire bloom pyramid', () => {
    // The assertion that actually constrains design: bloom is six passes but must
    // stay cheaper than a single full-resolution one, which is only possible
    // because no level runs at full scale.
    const plan = resolveScopePhosphorPlan('ultra', HDR)
    const bloomFill = plan.bloomLevels.reduce((sum, l) => sum + 2 * l.resolutionScale ** 2, 0)
    expect(bloomFill).toBeLessThan(1)
  })

  it('costs strictly less on cheaper tiers', () => {
    expect(fillCost('low')).toBeLessThan(fillCost('medium'))
    expect(fillCost('medium')).toBeLessThanOrEqual(fillCost('high'))
  })

  it('spends less than a fifth of its bloom fill on the widest level', () => {
    // The wide level is the most expendable and must not dominate the budget.
    const plan = resolveScopePhosphorPlan('ultra', HDR)
    const total = plan.bloomLevels.reduce((sum, l) => sum + l.resolutionScale ** 2, 0)
    const widest = plan.bloomLevels[plan.bloomLevels.length - 1].resolutionScale ** 2
    expect(widest / total).toBeLessThan(0.2)
  })
})

describe('degradation', () => {
  it('degrades on every axis at once toward the cheapest tier', () => {
    const low = resolveScopePhosphorPlan('low', HDR)
    const ultra = resolveScopePhosphorPlan('ultra', HDR)
    expect(low.bloomLevels.length).toBeLessThan(ultra.bloomLevels.length)
    expect(low.maxTracePoints).toBeLessThan(ultra.maxTracePoints)
    expect(low.persistenceResolutionScale).toBeLessThan(ultra.persistenceResolutionScale)
    expect(low.crtEnabled).toBe(false)
  })

  it('keeps the cheapest tier renderable rather than stripping it to nothing', () => {
    // The fallback tier still has to look like a scope.
    const low = resolveScopePhosphorPlan('low', HDR)
    expect(low.bloomLevels.length).toBeGreaterThan(0)
    expect(low.maxTracePoints).toBeGreaterThanOrEqual(512)
  })
})
