import { describe, expect, it } from 'vitest'
import { AFTERHOURS_DEFAULTS, type AfterhoursPattern } from '../../../CinematicWorldSettings'
import {
  AFTERHOURS_BOTTOM_EMITTERS,
  AFTERHOURS_LEFT_EMITTERS,
  AFTERHOURS_MAX_BEAMS,
  AFTERHOURS_RIGHT_EMITTERS,
  AFTERHOURS_TOP_EMITTERS,
  type AfterhoursBeamGenerationSettings,
  generateAfterhoursBeams,
} from './AfterhoursBeamGeometry'

const BASE: AfterhoursBeamGenerationSettings = {
  pattern: 'fan',
  symmetry: true,
  sideLasers: false,
  topLasers: false,
  beamCount: 8,
  spread: 0.65,
  accentMix: 0.25,
}

const gen = (overrides: Partial<AfterhoursBeamGenerationSettings> = {}, variation = 0) =>
  generateAfterhoursBeams({ ...BASE, ...overrides }, { variation })

const active = (overrides: Partial<AfterhoursBeamGenerationSettings> = {}, variation = 0) =>
  gen(overrides, variation).filter(beam => beam.active)

describe('Afterhours Stage 2 — canonical emitter banks', () => {
  it('owns exactly 10 fixed frozen bottom origins plus fixed side/top banks', () => {
    expect(AFTERHOURS_BOTTOM_EMITTERS).toHaveLength(10)
    expect(AFTERHOURS_BOTTOM_EMITTERS.map(e => e.x)).toEqual([0.07, 0.165, 0.26, 0.355, 0.45, 0.55, 0.645, 0.74, 0.835, 0.93])
    expect(AFTERHOURS_BOTTOM_EMITTERS.every(e => e.y === 0.025 && Object.isFrozen(e))).toBe(true)
    expect(AFTERHOURS_LEFT_EMITTERS).toHaveLength(3)
    expect(AFTERHOURS_RIGHT_EMITTERS).toHaveLength(3)
    expect(AFTERHOURS_TOP_EMITTERS).toHaveLength(6)
    for (const bank of [AFTERHOURS_LEFT_EMITTERS, AFTERHOURS_RIGHT_EMITTERS, AFTERHOURS_TOP_EMITTERS]) {
      expect(Object.isFrozen(bank)).toBe(true)
      expect(bank.every(e => Object.isFrozen(e))).toBe(true)
    }
    expect(AFTERHOURS_LEFT_EMITTERS.every(e => e.x < 0.05)).toBe(true)
    expect(AFTERHOURS_RIGHT_EMITTERS.every(e => e.x > 0.95)).toBe(true)
    expect(AFTERHOURS_TOP_EMITTERS.every(e => e.y > 0.95)).toBe(true)
  })
})

describe('Afterhours Stage 2 — global beam allocation', () => {
  it('always returns 16 slots with exactly beamCount active, clamped to 2..16', () => {
    for (const [request, expected] of [[-4, 2], [0, 2], [2, 2], [8, 8], [16, 16], [40, 16]] as const) {
      const beams = gen({ beamCount: request })
      expect(beams).toHaveLength(AFTERHOURS_MAX_BEAMS)
      expect(beams.filter(b => b.active)).toHaveLength(expected)
      expect(beams.slice(expected).every(b => !b.active)).toBe(true)
    }
  })

  it('clears every inactive slot to zeroed origin/target/meta', () => {
    const beams = gen({ beamCount: 3 })
    for (const beam of beams.slice(3)) {
      expect(beam.active).toBe(false)
      expect(beam.target).toEqual({ x: 0, y: 0 })
      expect(beam.accent).toBe(false)
      expect(beam.phase).toBe(0)
    }
  })

  it('shares a bottom origin across multiple beams past 10 without exceeding the global count', () => {
    const beams = active({ pattern: 'fan', beamCount: 16 })
    expect(beams).toHaveLength(16)
    expect(beams.every(b => b.bank === 'bottom')).toBe(true)
    // 16 beams over 10 bottom origins -> at least one origin reused.
    const perOrigin = new Map<number, number>()
    for (const b of beams) perOrigin.set(b.emitterIndex, (perOrigin.get(b.emitterIndex) ?? 0) + 1)
    expect(Math.max(...perOrigin.values())).toBeGreaterThan(1)
  })

  it('never exceeds 16 visible beams even with Side and Top enabled', () => {
    const beams = gen({ pattern: 'random', sideLasers: true, topLasers: true, beamCount: 16 })
    expect(beams.filter(b => b.active)).toHaveLength(16)
  })
})

describe('Afterhours Stage 2 — geometry validity for every pattern family', () => {
  const patterns: readonly AfterhoursPattern[] = ['random', 'xWall', 'cross', 'fan', 'split']

  for (const pattern of patterns) {
    for (const spread of [0, 0.5, 1]) {
      it(`${pattern} @ spread ${spread} stays finite, in-bounds, and non-degenerate`, () => {
        const beams = active({ pattern, spread, sideLasers: true, topLasers: true, beamCount: 16 })
        expect(beams).toHaveLength(16)
        for (const beam of beams) {
          expect(Number.isFinite(beam.target.x) && Number.isFinite(beam.target.y)).toBe(true)
          expect(beam.target.x).toBeGreaterThanOrEqual(0)
          expect(beam.target.x).toBeLessThanOrEqual(1)
          expect(beam.target.y).toBeGreaterThanOrEqual(0)
          expect(beam.target.y).toBeLessThanOrEqual(1)
          expect(Math.hypot(beam.target.x - beam.origin.x, beam.target.y - beam.origin.y)).toBeGreaterThan(0.1)
          expect(beam.phase).toBeGreaterThanOrEqual(0)
          expect(beam.phase).toBeLessThan(1)
        }
      })
    }
  }

  it('Spread widens the fan target span', () => {
    const span = (spread: number) => {
      const xs = active({ pattern: 'fan', spread, beamCount: 16 }).map(b => b.target.x)
      return Math.max(...xs) - Math.min(...xs)
    }
    expect(span(1)).toBeGreaterThan(span(0))
  })

  it('falls back to the default Fan family for an unknown pattern id', () => {
    const bogus = active({ pattern: 'spiral' as AfterhoursPattern, beamCount: 12 })
    const fan = active({ pattern: 'fan', beamCount: 12 })
    expect(bogus.map(b => ({ o: b.origin, t: b.target }))).toEqual(fan.map(b => ({ o: b.origin, t: b.target })))
  })
})

describe('Afterhours Stage 2 — bank participation rules', () => {
  it('never uses a disabled bank for any pattern', () => {
    for (const pattern of ['random', 'xWall', 'cross', 'fan', 'split'] as const) {
      const beams = active({ pattern, sideLasers: false, topLasers: false, beamCount: 16 })
      expect(beams.every(b => b.bank === 'bottom')).toBe(true)
    }
  })

  it('Fan deliberately ignores enabled Side and Top banks (pattern-owned participation)', () => {
    const beams = active({ pattern: 'fan', sideLasers: true, topLasers: true, beamCount: 16 })
    expect(beams.every(b => b.bank === 'bottom')).toBe(true)
  })

  it('Cross consumes enabled Side banks but not the Top bank', () => {
    const beams = active({ pattern: 'cross', sideLasers: true, topLasers: true, beamCount: 16 })
    const banks = new Set(beams.map(b => b.bank))
    expect(banks.has('left')).toBe(true)
    expect(banks.has('right')).toBe(true)
    expect(banks.has('top')).toBe(false)
  })

  it('X Wall consumes the enabled Top bank but not Side banks', () => {
    const beams = active({ pattern: 'xWall', sideLasers: true, topLasers: true, beamCount: 16 })
    const banks = new Set(beams.map(b => b.bank))
    expect(banks.has('top')).toBe(true)
    expect(banks.has('left')).toBe(false)
    expect(banks.has('right')).toBe(false)
  })

  it('Split is a left/right directional split from the bottom bank', () => {
    const beams = active({ pattern: 'split', spread: 0.8, beamCount: 10 })
    const left = beams.filter(b => b.origin.x < 0.5)
    const right = beams.filter(b => b.origin.x > 0.5)
    expect(left.every(b => b.target.x < 0.5)).toBe(true)
    expect(right.every(b => b.target.x > 0.5)).toBe(true)
  })
})

describe('Afterhours Stage 2 — determinism and variation', () => {
  it('produces identical geometry for identical settings + variation', () => {
    expect(gen({ pattern: 'random' }, 3)).toEqual(gen({ pattern: 'random' }, 3))
    expect(gen({ pattern: 'xWall', sideLasers: true })).toEqual(gen({ pattern: 'xWall', sideLasers: true }))
  })

  it('changes geometry when the deterministic variation ordinal changes', () => {
    const a = active({ pattern: 'random' }, 0).map(b => b.target)
    const b = active({ pattern: 'random' }, 1).map(b => b.target)
    expect(a).not.toEqual(b)
  })

  it('stays valid across many variation ordinals with no degenerate output', () => {
    for (let variation = 0; variation < 64; variation += 1) {
      const beams = active({ pattern: 'random', spread: 0.9, sideLasers: true, topLasers: true, beamCount: 16 }, variation)
      for (const beam of beams) {
        expect(Math.hypot(beam.target.x - beam.origin.x, beam.target.y - beam.origin.y)).toBeGreaterThan(0.1)
        expect(beam.target.x).toBeGreaterThanOrEqual(0)
        expect(beam.target.x).toBeLessThanOrEqual(1)
      }
      // Not every target collapsed onto a single point.
      const uniqueTargets = new Set(beams.map(b => `${b.target.x.toFixed(3)},${b.target.y.toFixed(3)}`))
      expect(uniqueTargets.size).toBeGreaterThan(3)
    }
  })
})

describe('Afterhours Stage 2 — Random symmetry', () => {
  it('mirrors beams across the vertical centre line when symmetry is ON', () => {
    for (const beamCount of [2, 6, 7, 16]) {
      const beams = active({ pattern: 'random', symmetry: true, sideLasers: true, beamCount })
      expect(beams).toHaveLength(beamCount)
      const half = Math.ceil(beamCount / 2)
      for (let index = half; index < beamCount; index += 1) {
        const source = beams[beamCount - 1 - index]
        const mirror = beams[index]
        expect(mirror.target.x).toBeCloseTo(1 - source.target.x, 6)
        expect(mirror.target.y).toBeCloseTo(source.target.y, 6)
        expect(mirror.origin.x).toBeCloseTo(1 - source.origin.x, 6)
      }
    }
  })

  it('allows bounded asymmetry when symmetry is OFF', () => {
    const on = active({ pattern: 'random', symmetry: true, beamCount: 12 }).map(b => b.target.x)
    const off = active({ pattern: 'random', symmetry: false, beamCount: 12 }).map(b => b.target.x)
    expect(off).not.toEqual(on)
  })
})

describe('Afterhours Stage 2 — Random guardrails', () => {
  it('keeps targets inside safe frame margins and above a minimum beam length', () => {
    const beams = active({ pattern: 'random', spread: 1, symmetry: false, sideLasers: true, topLasers: true, beamCount: 16 })
    for (const beam of beams) {
      expect(beam.target.x).toBeGreaterThanOrEqual(0.05)
      expect(beam.target.x).toBeLessThanOrEqual(0.95)
      expect(beam.target.y).toBeGreaterThanOrEqual(0.05)
      expect(beam.target.y).toBeLessThanOrEqual(0.95)
      expect(Math.hypot(beam.target.x - beam.origin.x, beam.target.y - beam.origin.y)).toBeGreaterThanOrEqual(0.18)
    }
  })

  it('spreads targets rather than clustering them at Spread 0', () => {
    const beams = active({ pattern: 'random', spread: 0, symmetry: false, beamCount: 12 })
    const uniqueTargets = new Set(beams.map(b => `${b.target.x.toFixed(2)},${b.target.y.toFixed(2)}`))
    expect(uniqueTargets.size).toBeGreaterThan(4)
  })
})

describe('Afterhours Stage 2 — settings shape', () => {
  it('accepts the persisted Afterhours defaults as generation input', () => {
    const beams = generateAfterhoursBeams(AFTERHOURS_DEFAULTS)
    expect(beams.filter(b => b.active)).toHaveLength(AFTERHOURS_DEFAULTS.beamCount)
  })
})
