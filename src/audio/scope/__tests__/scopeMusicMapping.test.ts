import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SCOPE_MUSIC_MAPPING,
  IDENTITY_SCOPE_MODULATION,
  NEUTRAL_SCOPE_MUSICAL_INPUT,
  isScopeMusicMappingNeutral,
  resolveScopeMusicModulation,
  type ScopeMusicMappingSettings,
  type ScopeMusicalInput,
} from '../scopeMusicMapping'

function settings(overrides: Partial<ScopeMusicMappingSettings> = {}): ScopeMusicMappingSettings {
  return { ...DEFAULT_SCOPE_MUSIC_MAPPING, ...overrides }
}
function input(overrides: Partial<ScopeMusicalInput> = {}): ScopeMusicalInput {
  return { ...NEUTRAL_SCOPE_MUSICAL_INPUT, ...overrides }
}

describe('identity behaviour', () => {
  it('changes nothing at default amounts, whatever the music does', () => {
    // The migration that introduced this must be appearance-preserving, which is
    // only true if zero amounts are exactly the identity.
    const loud = input({ beatEnvelope: 1, kickEnvelope: 1, bass: 1, buildProgress: 1, dropImpact: 1 })
    expect(resolveScopeMusicModulation(DEFAULT_SCOPE_MUSIC_MAPPING, loud))
      .toEqual(IDENTITY_SCOPE_MODULATION)
  })

  it('changes nothing on silence, whatever the amounts', () => {
    const hot = settings({ beatBloom: 1, kickWidth: 1, bassExposure: 1, buildExposure: 1, dropSnap: 1 })
    expect(resolveScopeMusicModulation(hot, NEUTRAL_SCOPE_MUSICAL_INPUT))
      .toEqual(IDENTITY_SCOPE_MODULATION)
  })

  it('reports neutrality', () => {
    expect(isScopeMusicMappingNeutral(DEFAULT_SCOPE_MUSIC_MAPPING)).toBe(true)
    expect(isScopeMusicMappingNeutral(settings({ beatBloom: 0.1 }))).toBe(false)
  })
})

describe('individual routes', () => {
  it('lifts bloom on a beat', () => {
    const m = resolveScopeMusicModulation(settings({ beatBloom: 1 }), input({ beatEnvelope: 1 }))
    expect(m.glowMultiplier).toBeGreaterThan(1)
    // and touches nothing else
    expect(m.beamWidthMultiplier).toBe(1)
    expect(m.exposureMultiplier).toBe(1)
    expect(m.persistenceMultiplier).toBe(1)
  })

  it('widens the beam on a kick', () => {
    const m = resolveScopeMusicModulation(settings({ kickWidth: 1 }), input({ kickEnvelope: 1 }))
    expect(m.beamWidthMultiplier).toBeGreaterThan(1)
    expect(m.glowMultiplier).toBe(1)
  })

  it('raises exposure with bass and with build progress', () => {
    expect(resolveScopeMusicModulation(settings({ bassExposure: 1 }), input({ bass: 1 })).exposureMultiplier)
      .toBeGreaterThan(1)
    expect(resolveScopeMusicModulation(settings({ buildExposure: 1 }), input({ buildProgress: 1 })).exposureMultiplier)
      .toBeGreaterThan(1)
  })

  it('shortens persistence on a drop rather than lengthening it', () => {
    const m = resolveScopeMusicModulation(settings({ dropSnap: 1 }), input({ dropImpact: 1 }))
    expect(m.persistenceMultiplier).toBeLessThan(1)
    expect(m.persistenceMultiplier).toBeGreaterThan(0)
  })

  it('treats an absent build as no build, not as zero progress', () => {
    // buildProgress of -1 means "no build active". Reading it as 0 would be
    // harmless here, but reading it as a value would make every ordinary passage
    // look like the beginning of a build.
    const absent = resolveScopeMusicModulation(settings({ buildExposure: 1 }), input({ buildProgress: -1 }))
    expect(absent.exposureMultiplier).toBe(1)
  })
})

describe('bounds', () => {
  it('never exceeds its ceilings under maximum drive', () => {
    const hot = settings({ beatBloom: 1, kickWidth: 1, bassExposure: 1, buildExposure: 1, dropSnap: 1 })
    const loud = input({ beatEnvelope: 1, kickEnvelope: 1, bass: 1, buildProgress: 1, dropImpact: 1 })
    const m = resolveScopeMusicModulation(hot, loud)
    // A transient mis-detection should cost a slightly wrong frame, not an
    // unreadable one.
    expect(m.glowMultiplier).toBeLessThanOrEqual(2.5)
    expect(m.beamWidthMultiplier).toBeLessThanOrEqual(2.2)
    expect(m.exposureMultiplier).toBeLessThanOrEqual(2)
    expect(m.persistenceMultiplier).toBeGreaterThanOrEqual(0.25)
  })

  it('clamps out-of-range and non-finite inputs', () => {
    const hot = settings({ beatBloom: 5, kickWidth: -2, bassExposure: Number.NaN })
    const bad = input({ beatEnvelope: 99, kickEnvelope: -5, bass: Number.NaN, dropImpact: Number.POSITIVE_INFINITY })
    const m = resolveScopeMusicModulation(hot, bad)
    for (const value of Object.values(m)) {
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThan(0)
    }
    expect(m.glowMultiplier).toBeLessThanOrEqual(2.5)
  })

  it('is monotonic in drive, so louder never means less', () => {
    const hot = settings({ beatBloom: 1 })
    let previous = 0
    for (const level of [0, 0.25, 0.5, 0.75, 1]) {
      const m = resolveScopeMusicModulation(hot, input({ beatEnvelope: level }))
      expect(m.glowMultiplier).toBeGreaterThanOrEqual(previous)
      previous = m.glowMultiplier
    }
  })
})

describe('measurement boundary', () => {
  it('modulates presentation only — never geometry, signal, or trigger', () => {
    // Structural, not a matter of taste: a measurement display that moved with
    // the music would no longer be measuring anything. The returned shape is the
    // enforcement, so this pins it.
    const hot = settings({ beatBloom: 1, kickWidth: 1, bassExposure: 1, buildExposure: 1, dropSnap: 1 })
    const loud = input({ beatEnvelope: 1, kickEnvelope: 1, bass: 1, buildProgress: 1, dropImpact: 1 })
    expect(Object.keys(resolveScopeMusicModulation(hot, loud)).sort()).toEqual([
      'beamWidthMultiplier', 'exposureMultiplier', 'glowMultiplier', 'persistenceMultiplier',
    ])
  })
})
