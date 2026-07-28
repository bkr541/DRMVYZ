import { describe, expect, it } from 'vitest'
import { DEFAULT_SCOPE_CRT } from '../../../../../../audio/scope/scopeTypes'
import {
  MAX_SCOPE_PERSISTENCE_SECONDS,
  MIN_SCOPE_PERSISTENCE_SECONDS,
  SCOPE_PHOSPHOR_QUALITY_ORDER,
  resolveInitialScopePhosphorQuality,
  resolveScopeBeamExposure,
  resolveScopeBloomLevels,
  resolveScopeEmissionColor,
  resolveScopeHdrTargetStrategy,
  resolveScopePersistenceDecay,
  resolveScopePersistenceHalfLifeSeconds,
  resolveScopePhosphorPlan,
  scopeEmissionUsesFixedColor,
  scopeQualityChangeNeedsTargetReallocation,
} from '../soundDrawingPhosphorPlan'

const HDR_PROBE = {
  colorBufferFloat: true, rgba16fRenderable: true, floatLinearFiltering: true, floatBlend: true,
}
const LDR_PROBE = {
  colorBufferFloat: false, rgba16fRenderable: false, floatLinearFiltering: false, floatBlend: false,
}

describe('beam exposure', () => {
  const base = {
    density: 1,
    dwellWeight: 0,
    velocityRatio: 0,
    cornerDwell: 1,
    velocityBrightness: 1,
  }

  it('keeps fast straight segments visible at maximum response strength', () => {
    expect(resolveScopeBeamExposure(base)).toBeCloseTo(0.55 * 0.4, 6)
  })

  it('brightens slow corners without changing the density ceiling', () => {
    const slowCorner = resolveScopeBeamExposure({
      ...base,
      dwellWeight: 1,
      velocityRatio: 1,
    })
    expect(slowCorner).toBe(1)
    expect(slowCorner).toBeGreaterThan(resolveScopeBeamExposure(base) * 4)
  })

  it('becomes uniform when both response controls are disabled', () => {
    expect(resolveScopeBeamExposure({
      ...base,
      density: 0.7,
      cornerDwell: 0,
      velocityBrightness: 0,
    })).toBeCloseTo(0.7, 6)
  })

  it('clamps malformed or out-of-range inputs', () => {
    expect(resolveScopeBeamExposure({
      density: 4,
      dwellWeight: 4,
      velocityRatio: 4,
      cornerDwell: 4,
      velocityBrightness: 4,
    })).toBe(1)
    expect(resolveScopeBeamExposure({
      density: Number.NaN,
      dwellWeight: 0,
      velocityRatio: 0,
      cornerDwell: 0,
      velocityBrightness: 0,
    })).toBe(0)
  })
})

describe('emission colour', () => {
  const paletteGreen = { r: 0.1, g: 0.8, b: 0.2 }

  it('preserves the authored palette when CRT presentation is disabled or RGB', () => {
    expect(resolveScopeEmissionColor(DEFAULT_SCOPE_CRT, paletteGreen)).toBe(paletteGreen)
    expect(scopeEmissionUsesFixedColor(DEFAULT_SCOPE_CRT)).toBe(false)
    expect(resolveScopeEmissionColor({
      ...DEFAULT_SCOPE_CRT,
      enabled: true,
      phosphorModel: 'rgb',
    }, paletteGreen)).toBe(paletteGreen)
    expect(scopeEmissionUsesFixedColor({
      ...DEFAULT_SCOPE_CRT,
      enabled: true,
      phosphorModel: 'rgb',
    })).toBe(false)
  })

  it('applies fixed phosphor colour before the optional quality-tier CRT pass', () => {
    expect(resolveScopeEmissionColor({
      ...DEFAULT_SCOPE_CRT,
      enabled: true,
      phosphorModel: 'white',
    }, paletteGreen)).toEqual({ r: 0.92, g: 0.96, b: 1 })
    expect(scopeEmissionUsesFixedColor({
      ...DEFAULT_SCOPE_CRT,
      enabled: true,
      phosphorModel: 'white',
    })).toBe(true)
    expect(resolveScopeEmissionColor({
      ...DEFAULT_SCOPE_CRT,
      enabled: true,
      phosphorModel: 'custom',
      customPhosphorColor: '#ff8000',
    }, paletteGreen)).toEqual({ r: 1, g: 128 / 255, b: 0 })
  })
})

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
    // Several drivers advertise EXT_color_buffer_float yet report an incomplete
    // framebuffer for a real RGBA16F attachment.
    expect(resolveScopeHdrTargetStrategy({ ...HDR_PROBE, rgba16fRenderable: false }).hdrEnabled).toBe(false)
  })

  it('requires float blending, because beam emission is an additive pass', () => {
    // A device that can render float but not blend into it would fail at draw
    // time on the very pass HDR exists for: additive accumulation is what makes
    // overlapping strokes produce hotter intersections.
    const strategy = resolveScopeHdrTargetStrategy({ ...HDR_PROBE, floatBlend: false })
    expect(strategy.hdrEnabled).toBe(false)
    expect(strategy.targetFormat).toBe('rgba8')
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

  it('cannot burn in, because persistence itself is bounded', () => {
    // Burn-in is prevented by clamping tau rather than by capping the decay:
    // even at the longest supported persistence, real elapsed time always
    // removes energy, so the trail clears in bounded time.
    expect(resolveScopePersistenceDecay(MAX_SCOPE_PERSISTENCE_SECONDS, 1 / 60)).toBeLessThan(1)
    expect(resolveScopePersistenceDecay(1e9, 1 / 60)).toBeLessThan(1)
    // A request beyond the maximum is clamped to it, not honoured.
    expect(resolveScopePersistenceDecay(1e9, 1 / 60))
      .toBeCloseTo(resolveScopePersistenceDecay(MAX_SCOPE_PERSISTENCE_SECONDS, 1 / 60), 12)
  })

  it('clamps persistence to the supported range', () => {
    const tiny = resolveScopePersistenceDecay(0, 1 / 60)
    const clamped = resolveScopePersistenceDecay(MIN_SCOPE_PERSISTENCE_SECONDS, 1 / 60)
    expect(tiny).toBeCloseTo(clamped, 10)
  })

  it('does not decay when no time has elapsed', () => {
    // No elapsed time, no change. A cap just below 1 here would fade a paused
    // display and would break exact frame-rate composition.
    expect(resolveScopePersistenceDecay(0.5, 0)).toBe(1)
    // A non-finite or negative delta is treated as zero rather than wiping it.
    expect(resolveScopePersistenceDecay(0.5, Number.NaN)).toBe(1)
    expect(resolveScopePersistenceDecay(0.5, -1)).toBe(1)
  })

  it('composes exactly, so splitting a frame changes nothing', () => {
    // The property the missing cap was quietly breaking: subdividing an
    // interval must reproduce it to full precision at any subdivision.
    const tau = 0.35
    const dt = 1 / 60
    for (const parts of [2, 3, 7, 16]) {
      let composed = 1
      for (let i = 0; i < parts; i++) composed *= resolveScopePersistenceDecay(tau, dt / parts)
      expect(composed).toBeCloseTo(resolveScopePersistenceDecay(tau, dt), 12)
    }
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

  it('reallocates targets only when a target scale or level count actually changes', () => {
    const high = resolveScopePhosphorPlan('high', hdr)
    const ultra = resolveScopePhosphorPlan('ultra', hdr)
    const low = resolveScopePhosphorPlan('low', hdr)

    // High and Ultra share bloom shape and persistence scale — nothing to redo.
    expect(scopeQualityChangeNeedsTargetReallocation(high, ultra)).toBe(false)
    expect(scopeQualityChangeNeedsTargetReallocation(high, high)).toBe(false)
    expect(scopeQualityChangeNeedsTargetReallocation(high, low)).toBe(true)
  })

  it('is symmetric — direction of travel does not change what must be rebuilt', () => {
    const low = resolveScopePhosphorPlan('low', hdr)
    const ultra = resolveScopePhosphorPlan('ultra', hdr)
    expect(scopeQualityChangeNeedsTargetReallocation(low, ultra))
      .toBe(scopeQualityChangeNeedsTargetReallocation(ultra, low))
  })
})
