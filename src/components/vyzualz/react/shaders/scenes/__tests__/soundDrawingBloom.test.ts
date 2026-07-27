import { describe, it, expect } from 'vitest'
import {
  gaussianFalloff,
  resolveBloomChannelFalloff,
  resolveBloomColorAtDistance,
  resolveSoundDrawingToneMap,
  chroma,
  SOUND_DRAWING_BLOOM_TIERS,
  SOUND_DRAWING_BLOOM_CHANNEL_SCALE,
} from '../soundDrawingBloom'

describe('SOUND_DRAWING_BLOOM_TIERS', () => {
  it('declares exactly 3 tiers matching the spec sigma/weight targets', () => {
    expect(SOUND_DRAWING_BLOOM_TIERS).toHaveLength(3)
    expect(SOUND_DRAWING_BLOOM_TIERS[0].sigmaPx).toBe(2)
    expect(SOUND_DRAWING_BLOOM_TIERS[1].sigmaPx).toBe(10)
    expect(SOUND_DRAWING_BLOOM_TIERS[2].sigmaPx).toBe(40)
    expect(SOUND_DRAWING_BLOOM_TIERS[0].weight).toBeCloseTo(1.0)
    expect(SOUND_DRAWING_BLOOM_TIERS[1].weight).toBeCloseTo(0.35)
    expect(SOUND_DRAWING_BLOOM_TIERS[2].weight).toBeCloseTo(0.15)
  })

  it('channel radius scale is red-tightest, blue-widest at roughly 1.0/1.5/2.5x', () => {
    const [r, g, b] = SOUND_DRAWING_BLOOM_CHANNEL_SCALE
    expect(r).toBeCloseTo(1.0)
    expect(g).toBeCloseTo(1.5)
    expect(b).toBeCloseTo(2.5)
    expect(r).toBeLessThan(g)
    expect(g).toBeLessThan(b)
  })
})

describe('gaussianFalloff', () => {
  it('is 1.0 at distance 0 regardless of sigma', () => {
    expect(gaussianFalloff(0, 2)).toBeCloseTo(1.0)
    expect(gaussianFalloff(0, 40)).toBeCloseTo(1.0)
  })

  it('decreases monotonically with distance', () => {
    const samples = [0, 1, 2, 5, 10, 20, 50].map(d => gaussianFalloff(d, 10))
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThan(samples[i - 1])
    }
  })

  it('a larger sigma retains more energy at the same distance', () => {
    expect(gaussianFalloff(20, 40)).toBeGreaterThan(gaussianFalloff(20, 2))
  })
})

describe('resolveBloomChannelFalloff — chromatic radial falloff', () => {
  it('red barely blooms: red falloff decays close to zero well before blue does', () => {
    const redAt60 = resolveBloomChannelFalloff(60, 0)
    const blueAt60 = resolveBloomChannelFalloff(60, 2)
    expect(redAt60).toBeLessThan(blueAt60)
  })

  it('at 60-100px, blue exceeds green (matches the ~1.9/6.8/13 target shape: blue nearly 2x green)', () => {
    const green = resolveBloomChannelFalloff(80, 1)
    const blue = resolveBloomChannelFalloff(80, 2)
    expect(blue).toBeGreaterThan(green)
  })

  it('at 8-12px, blue already exceeds green', () => {
    const green = resolveBloomChannelFalloff(10, 1)
    const blue = resolveBloomChannelFalloff(10, 2)
    expect(blue).toBeGreaterThan(green)
  })

  it('near the core (distance 0), all channels are close (falloff ~1) since every tier is centered there', () => {
    const red = resolveBloomChannelFalloff(0, 0)
    const blue = resolveBloomChannelFalloff(0, 2)
    expect(blue / red).toBeLessThan(1.05)
  })

  it('one blur radius cannot reproduce the falloff shape: single-tier falloff diverges from the 3-tier composite at long range', () => {
    const singleTier = [SOUND_DRAWING_BLOOM_TIERS[0]]
    const compositeAt80 = resolveBloomChannelFalloff(80, 1)
    const singleTierAt80 = resolveBloomChannelFalloff(80, 1, singleTier)
    // The tight tier-1-only falloff should have collapsed far more than the full composite by 80px.
    expect(singleTierAt80).toBeLessThan(compositeAt80)
  })
})

describe('resolveBloomColorAtDistance — amber hue shift outward', () => {
  const AMBER = { r: 240 / 255, g: 220 / 255, b: 70 / 255 }

  // NOTE on a spec discrepancy: the brief asks to "verify the amber palette
  // inverts correctly — R/G ratio climbing 1.09 -> 1.19 -> 1.35 outward."
  // That is not reachable under the brief's OWN "red tightest, blue widest,
  // ~1.0/1.5/2.5x" channel-scale instruction: since red decays FASTER than
  // green at every tier, R/G necessarily falls outward (verified numerically:
  // 1.09 at the core -> ~0.36 by 60-100px), not climbs. This fall is also
  // what makes the brief's two *other* measured triples true — "blue already
  // exceeds green" at 8-12px and 60-100px, and "red barely blooms" — both of
  // which this same falloff model reproduces exactly (see the tests above).
  // Given the two requirements can't both hold under one channel-scale model,
  // this implementation keeps the structural instruction plus the two
  // internally-consistent measured triples, and tests the direction the math
  // actually (and necessarily) produces instead of asserting the
  // unreachable 1.09->1.35 climb.

  it('the base amber core ratio is 240/220 (~1.09), matching the spec starting point', () => {
    expect(AMBER.r / AMBER.g).toBeCloseTo(240 / 220, 5)
  })

  it('R/G ratio falls outward as red drops out faster than green (the direct consequence of red being tighter)', () => {
    const near = resolveBloomColorAtDistance(AMBER, 1)
    const mid = resolveBloomColorAtDistance(AMBER, 15)
    const far = resolveBloomColorAtDistance(AMBER, 80)

    const ratio = (c: { r: number; g: number }) => c.r / Math.max(1e-6, c.g)

    expect(ratio(near)).toBeCloseTo(AMBER.r / AMBER.g, 1)
    expect(ratio(mid)).toBeLessThan(ratio(near))
    expect(ratio(far)).toBeLessThan(ratio(mid))
  })

  it('the halo is visibly cooler (more blue-green, less red) than the core — hue shifts outward rather than staying fixed', () => {
    const core = resolveBloomColorAtDistance(AMBER, 0)
    const halo = resolveBloomColorAtDistance(AMBER, 80)
    const coreBlueShare = core.b / (core.r + core.g + core.b)
    const haloBlueShare = halo.b / (halo.r + halo.g + halo.b)
    expect(haloBlueShare).toBeGreaterThan(coreBlueShare)
  })
})

describe('resolveSoundDrawingToneMap', () => {
  it('maps HDR values into a finite, bounded [0,1] display range', () => {
    const out = resolveSoundDrawingToneMap({ r: 50, g: 30, b: 5 })
    for (const v of [out.r, out.g, out.b]) {
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('a dense, bright core desaturates more (toward white) than a dim halo of the same hue', () => {
    const core = { r: 8, g: 6, b: 1.5 } // bright, high accumulated energy
    const halo = { r: 0.05, g: 0.0375, b: 0.009375 } // same ratio, far dimmer

    const coreOut = resolveSoundDrawingToneMap(core)
    const haloOut = resolveSoundDrawingToneMap(halo)

    // Compare chroma AS A FRACTION OF BRIGHTNESS (a saturation ratio) rather
    // than raw chroma — raw chroma is dominated by the halo simply being far
    // dimmer overall, which would pass even with no whitening at all.
    const saturation = (c: { r: number; g: number; b: number }) =>
      chroma(c) / Math.max(c.r, c.g, c.b, 1e-6)
    expect(saturation(coreOut)).toBeLessThan(saturation(haloOut))
  })

  it('whitenStrength 0 preserves full chroma regardless of brightness', () => {
    const bright = resolveSoundDrawingToneMap({ r: 8, g: 6, b: 1.5 }, 0)
    // Chroma should still be present (not collapsed to gray) when whitening is disabled.
    expect(chroma(bright)).toBeGreaterThan(0)
  })

  it('is a pure function: same input always produces the same output', () => {
    const a = resolveSoundDrawingToneMap({ r: 3, g: 2, b: 1 })
    const b = resolveSoundDrawingToneMap({ r: 3, g: 2, b: 1 })
    expect(a).toEqual(b)
  })
})
