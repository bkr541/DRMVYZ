import { describe, expect, it } from 'vitest'
import {
  MAX_SCOPE_PERSISTENCE_SECONDS,
  MIN_SCOPE_PERSISTENCE_SECONDS,
  SCOPE_PHOSPHOR_QUALITY_ORDER,
  resolveInitialScopePhosphorQuality,
  resolveScopeBloomLevels,
  resolveScopeHdrTargetStrategy,
  resolveScopePersistenceDecay,
  resolveScopePersistenceHalfLifeSeconds,
  resolveScopePhosphorPlan,
  resolveScopeQualityTransitionEffects,
  type ScopePhosphorQuality,
} from '../soundDrawingPhosphorPlan'

const HDR_PROBE = { colorBufferFloat: true, rgba16fRenderable: true, floatLinearFiltering: true }
const LDR_PROBE = { colorBufferFloat: false, rgba16fRenderable: false, floatLinearFiltering: false }

describe('HDR target selection', () => {
  it('prefers RGBA16F when the probe reports it renderable', () => {
    const strategy = resolveScopeHdrTargetStrategy(HDR_PROBE)
    expect(strategy.hdrEnabled).toBe(true)
    expect(strategy.targetFormat).toBe('rgba16f')
    expect(strategy.diagnosticCode).toBe('hdr-rgba16f')
    expect(strategy.maximumSceneValue).toBeGreaterThan(1)
  })

  it('falls back to RGBA8 rather than disabling the scope', () => {
    const strategy = resolveScopeHdrTargetStrategy(LDR_PROBE)
    expect(strategy.hdrEnabled).toBe(false)
    expect(strategy.targetFormat).toBe('rgba8')
    expect(strategy.diagnosticCode).toBe('ldr-rgba8-fallback')
    // Still renderable — the brief forbids making GPU quality mandatory.
    expect(strategy.maximumSceneValue).toBe(1)
  })

  it('does not claim half-float support when the extension exists but the target is not renderable', () => {
    const strategy = resolveScopeHdrTargetStrategy({
      colorBufferFloat: true, rgba16fRenderable: false, floatLinearFiltering: true,
    })
    expect(strategy.hdrEnabled).toBe(false)
  })

  it('only enables linear filtering when the float-linear capability is present', () => {
    expect(resolveScopeHdrTargetStrategy(HDR_PROBE).linearFiltering).toBe(true)
    expect(resolveScopeHdrTargetStrategy({ ...HDR_PROBE, floatLinearFiltering: false }).linearFiltering).toBe(false)
  })
})

describe('phosphor persistence', () => {
  it('is exponential in elapsed time', () => {
    const tau = 0.5
    // exp(-dt/tau): one tau retains 1/e.
    expect(resolveScopePersistenceDecay(tau, tau)).toBeCloseTo(Math.exp(-1), 6)
    expect(resolveScopePersistenceDecay(tau, tau * 2)).toBeCloseTo(Math.exp(-2), 6)
  })

  it('is frame-rate independent', () => {
    const tau = 0.4
    // A trail must age at the same real-world rate regardless of frame rate:
    // two 120 fps frames must equal one 60 fps frame.
    const at60 = resolveScopePersistenceDecay(tau, 1 / 60)
    const at120 = resolveScopePersistenceDecay(tau, 1 / 120)
    expect(at120 * at120).toBeCloseTo(at60, 10)

    // And four 240 fps frames equal the same interval.
    const at240 = resolveScopePersistenceDecay(tau, 1 / 240)
    expect(at240 ** 4).toBeCloseTo(at60, 10)
  })

  it('retains more for longer persistence at a fixed frame time', () => {
    const dt = 1 / 60
    expect(resolveScopePersistenceDecay(1.5, dt)).toBeGreaterThan(resolveScopePersistenceDecay(0.2, dt))
  })

  it('never fully retains, so a trace cannot burn in permanently', () => {
    expect(resolveScopePersistenceDecay(MAX_SCOPE_PERSISTENCE_SECONDS, 1 / 240)).toBeLessThan(1)
    expect(resolveScopePersistenceDecay(1e9, 1 / 240)).toBeLessThan(1)
  })

  it('clamps persistence to the supported range', () => {
    const tiny = resolveScopePersistenceDecay(0, 1 / 60)
    const clamped = resolveScopePersistenceDecay(MIN_SCOPE_PERSISTENCE_SECONDS, 1 / 60)
    expect(tiny).toBeCloseTo(clamped, 10)
  })

  it('handles a zero or invalid delta without discarding the trail', () => {
    // No elapsed time means no decay, held just under 1 by the burn-in guard.
    expect(resolveScopePersistenceDecay(0.5, 0)).toBeCloseTo(0.9999, 10)
    // A non-finite delta is treated as zero rather than wiping the phosphor.
    expect(resolveScopePersistenceDecay(0.5, Number.NaN)).toBeCloseTo(0.9999, 10)
    expect(resolveScopePersistenceDecay(0.5, -1)).toBeCloseTo(0.9999, 10)
  })

  it('reports half-life in observable seconds', () => {
    // Decaying for exactly the half-life must leave half the energy.
    const halfLife = resolveScopePersistenceHalfLifeSeconds(0.8)
    expect(resolveScopePersistenceDecay(0.8, halfLife)).toBeCloseTo(0.5, 6)
  })
})

describe('bloom pyramid', () => {
  it('drops levels from the widest inward as quality falls', () => {
    expect(resolveScopeBloomLevels('ultra').map(l => l.id)).toEqual(['tight', 'medium', 'wide'])
    expect(resolveScopeBloomLevels('high').map(l => l.id)).toEqual(['tight', 'medium', 'wide'])
    expect(resolveScopeBloomLevels('medium').map(l => l.id)).toEqual(['tight', 'medium'])
    // The tight level is the dense luminous line body — it is the last to go.
    expect(resolveScopeBloomLevels('low').map(l => l.id)).toEqual(['tight'])
  })

  it('widens sigma and shrinks the target as levels get broader', () => {
    const levels = resolveScopeBloomLevels('ultra')
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].sigmaPx).toBeGreaterThan(levels[i - 1].sigmaPx)
      expect(levels[i].resolutionScale).toBeLessThan(levels[i - 1].resolutionScale)
      // Wider levels contribute less, or the image floods into uniform fog.
      expect(levels[i].weight).toBeLessThan(levels[i - 1].weight)
    }
  })

  it('blurs blue widest and red tightest for chromatic bleed', () => {
    for (const level of resolveScopeBloomLevels('ultra')) {
      const [r, g, b] = level.channelRadiusScale
      expect(r).toBeLessThan(g)
      expect(g).toBeLessThan(b)
    }
  })
})

describe('phosphor plan', () => {
  const plans = SCOPE_PHOSPHOR_QUALITY_ORDER.map(q =>
    resolveScopePhosphorPlan(q, resolveScopeHdrTargetStrategy(HDR_PROBE)),
  )

  it('increases cost monotonically with quality', () => {
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].estimatedPassCount).toBeGreaterThanOrEqual(plans[i - 1].estimatedPassCount)
      expect(plans[i].maxTracePoints).toBeGreaterThanOrEqual(plans[i - 1].maxTracePoints)
    }
  })

  it('halves persistence resolution and drops CRT only on the cheapest tier', () => {
    const low = resolveScopePhosphorPlan('low', resolveScopeHdrTargetStrategy(HDR_PROBE))
    const medium = resolveScopePhosphorPlan('medium', resolveScopeHdrTargetStrategy(HDR_PROBE))
    expect(low.persistenceResolutionScale).toBe(0.5)
    expect(low.crtEnabled).toBe(false)
    expect(medium.persistenceResolutionScale).toBe(1)
    expect(medium.crtEnabled).toBe(true)
  })

  it('accounts for every pass it will actually run', () => {
    const plan = resolveScopePhosphorPlan('ultra', resolveScopeHdrTargetStrategy(HDR_PROBE))
    // beam + persistence + (extract + blur) per level + composite + CRT
    expect(plan.estimatedPassCount).toBe(1 + 1 + plan.bloomLevels.length * 2 + 1 + 1)
  })

  it('carries the LDR strategy through without disabling bloom', () => {
    const plan = resolveScopePhosphorPlan('high', resolveScopeHdrTargetStrategy(LDR_PROBE))
    expect(plan.hdr.hdrEnabled).toBe(false)
    expect(plan.bloomLevels.length).toBeGreaterThan(0)
  })
})

describe('initial quality selection', () => {
  it('is conservative on constrained devices', () => {
    expect(resolveInitialScopePhosphorQuality({
      hdrAvailable: true, maxTextureSize: 1024, devicePixelRatio: 1,
    })).toBe('low')
    expect(resolveInitialScopePhosphorQuality({
      hdrAvailable: true, maxTextureSize: 2048, devicePixelRatio: 1,
    })).toBe('medium')
    expect(resolveInitialScopePhosphorQuality({
      hdrAvailable: true, maxTextureSize: 8192, devicePixelRatio: 3.5,
    })).toBe('medium')
  })

  it('does not select ultra without HDR', () => {
    expect(resolveInitialScopePhosphorQuality({
      hdrAvailable: false, maxTextureSize: 16384, devicePixelRatio: 1,
    })).toBe('high')
  })

  it('selects ultra only on a capable, low-DPR device', () => {
    expect(resolveInitialScopePhosphorQuality({
      hdrAvailable: true, maxTextureSize: 16384, devicePixelRatio: 1,
    })).toBe('ultra')
  })
})

describe('quality transitions', () => {
  const hdr = resolveScopeHdrTargetStrategy(HDR_PROBE)

  it('never disturbs signal, trigger, persistence, colour, or saved state', () => {
    for (const from of SCOPE_PHOSPHOR_QUALITY_ORDER) {
      for (const to of SCOPE_PHOSPHOR_QUALITY_ORDER) {
        const effects = resolveScopeQualityTransitionEffects(
          resolveScopePhosphorPlan(from as ScopePhosphorQuality, hdr),
          resolveScopePhosphorPlan(to as ScopePhosphorQuality, hdr),
        )
        expect(effects.clearsPersistence).toBe(false)
        expect(effects.resetsTrigger).toBe(false)
        expect(effects.changesSignalMode).toBe(false)
        expect(effects.changesPhosphorColor).toBe(false)
        expect(effects.mutatesSavedState).toBe(false)
      }
    }
  })

  it('reallocates targets only when a target scale or level count actually changes', () => {
    const high = resolveScopePhosphorPlan('high', hdr)
    const ultra = resolveScopePhosphorPlan('ultra', hdr)
    const low = resolveScopePhosphorPlan('low', hdr)

    // High and Ultra share bloom shape and persistence scale — nothing to redo.
    expect(resolveScopeQualityTransitionEffects(high, ultra).reallocatesTargets).toBe(false)
    expect(resolveScopeQualityTransitionEffects(high, low).reallocatesTargets).toBe(true)
    expect(resolveScopeQualityTransitionEffects(high, high).reallocatesTargets).toBe(false)
  })
})
