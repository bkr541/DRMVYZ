import { describe, it, expect } from 'vitest'
import {
  xorshift32,
  prngNext,
  selectVerticalLane,
  selectHorizontalLane,
  makeVerticalRail,
  makeHorizontalRail,
  railLifetimeAlpha,
  isRailExpired,
  hexToRgbStr,
  MAX_VERT,
  MAX_HORIZ,
  resolveRailTargets,
  resolveRailBurstCounts,
  resolveOverlayAlpha,
  resolveCyanStrikeDuration,
  WHITEOUT_DURATION,
  BLACKOUT_DURATION,
  FREEZE_DURATION,
  RESEED_LIFE_SCALE,
} from '../neonLatticeUtils'
import type { NeonRail } from '../neonLatticeUtils'
import { DEFAULT_NEON_LATTICE_SETTINGS } from '../../ReactTypes'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const settings = { ...DEFAULT_NEON_LATTICE_SETTINGS }
const palette  = { primary: '74,199,219', secondary: '220,60,190', accent: '220,60,190', highlight: '74,199,219' }

// ── xorshift32 ────────────────────────────────────────────────────────────────

describe('xorshift32', () => {
  it('returns a value in [0, 1)', () => {
    for (const seed of [1, 42, 999, 0]) {
      const v = xorshift32(seed)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is deterministic — same seed gives same value', () => {
    expect(xorshift32(123)).toBe(xorshift32(123))
    expect(xorshift32(0)).toBe(xorshift32(0))
  })

  it('produces different values for different seeds', () => {
    expect(xorshift32(1)).not.toBe(xorshift32(2))
  })
})

describe('prngNext', () => {
  it('returns [value, nextSeed] where nextSeed !== seed', () => {
    const [v, next] = prngNext(7)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThan(1)
    expect(next).not.toBe(7)
  })

  it('is deterministic across calls', () => {
    const [v1, s1] = prngNext(42)
    const [v2]     = prngNext(42)
    expect(v1).toBe(v2)
    const [v3]     = prngNext(s1)
    expect(v3).not.toBe(v1)  // chained advances
  })
})

// ── Lane selection ────────────────────────────────────────────────────────────

describe('selectVerticalLane', () => {
  it('returns a value in [0, MAX_VERT)', () => {
    for (let seed = 1; seed < 40; seed++) {
      const lane = selectVerticalLane(seed, [])
      expect(lane).toBeGreaterThanOrEqual(0)
      expect(lane).toBeLessThan(MAX_VERT)
    }
  })

  it('is deterministic — same seed and existing → same lane', () => {
    const existing: NeonRail[] = []
    expect(selectVerticalLane(77, existing)).toBe(selectVerticalLane(77, existing))
  })

  it('prefers unoccupied lanes when possible', () => {
    // Fill all lanes except lane 6
    const occupied = Array.from({ length: MAX_VERT }, (_, i) => i).filter(i => i !== 6)
    const existing: NeonRail[] = occupied.map(i => ({
      vertical: true,
      pos: i / (MAX_VERT - 1),
      spanStart: 0, spanEnd: 1,
      width: 1, alpha: 1, glow: 0, depth: 1,
      birthSec: 0, lifetime: 4, colorRgb: '74,199,219',
    }))
    // Over many seeds, at least one should pick lane 6
    const chosen = new Set<number>()
    for (let seed = 1; seed <= 50; seed++) {
      chosen.add(selectVerticalLane(seed, existing))
    }
    expect(chosen.has(6)).toBe(true)
  })
})

describe('selectHorizontalLane', () => {
  it('returns a value in [0, MAX_HORIZ)', () => {
    for (let seed = 1; seed < 40; seed++) {
      const lane = selectHorizontalLane(seed, [])
      expect(lane).toBeGreaterThanOrEqual(0)
      expect(lane).toBeLessThan(MAX_HORIZ)
    }
  })
})

// ── Rail factory ──────────────────────────────────────────────────────────────

describe('makeVerticalRail', () => {
  it('returns a vertical rail with valid normalized fields', () => {
    const rail = makeVerticalRail(42, settings, 10, [], palette, 0.7)
    expect(rail.vertical).toBe(true)
    expect(rail.pos).toBeGreaterThan(0)
    expect(rail.pos).toBeLessThan(1)
    expect(rail.spanStart).toBeGreaterThanOrEqual(0)
    expect(rail.spanEnd).toBeLessThanOrEqual(1)
    expect(rail.spanEnd).toBeGreaterThan(rail.spanStart)
    expect(rail.alpha).toBeGreaterThan(0)
    expect(rail.alpha).toBeLessThanOrEqual(1)
    expect(rail.lifetime).toBeGreaterThan(0)
    expect(rail.birthSec).toBe(10)
    expect(typeof rail.colorRgb).toBe('string')
  })

  it('is deterministic — same seed produces same rail', () => {
    const a = makeVerticalRail(99, settings, 5, [], palette, 0.5)
    const b = makeVerticalRail(99, settings, 5, [], palette, 0.5)
    expect(a.pos).toBe(b.pos)
    expect(a.colorRgb).toBe(b.colorRgb)
  })

  it('higher strength → higher alpha and wider width', () => {
    const weak   = makeVerticalRail(10, settings, 0, [], palette, 0.1)
    const strong = makeVerticalRail(10, settings, 0, [], palette, 0.9)
    expect(strong.alpha).toBeGreaterThan(weak.alpha)
    expect(strong.width).toBeGreaterThan(weak.width)
  })
})

describe('makeHorizontalRail', () => {
  it('returns a non-vertical rail with valid span', () => {
    const rail = makeHorizontalRail(7, settings, 2, [], palette, 0.6)
    expect(rail.vertical).toBe(false)
    expect(rail.spanStart).toBeGreaterThanOrEqual(0)
    expect(rail.spanEnd).toBeLessThanOrEqual(1)
    expect(rail.spanEnd).toBeGreaterThan(rail.spanStart)
    expect(rail.lifetime).toBeGreaterThan(0)
  })

  it('horizontal spans are shorter than full-width on average', () => {
    const spans: number[] = []
    for (let s = 1; s <= 30; s++) {
      const r = makeHorizontalRail(s, settings, 0, [], palette, 0.5)
      spans.push(r.spanEnd - r.spanStart)
    }
    const avg = spans.reduce((a, b) => a + b, 0) / spans.length
    expect(avg).toBeLessThan(0.75)  // horizontal rails are dashes, not full-width
  })
})

// ── Lifetime alpha ────────────────────────────────────────────────────────────

describe('railLifetimeAlpha', () => {
  it('returns 0 at age=0 (fade-in pending)', () => {
    // At age exactly 0, fade-in factor = 0/0.08 = 0
    expect(railLifetimeAlpha(0, 4)).toBe(0)
  })

  it('returns 0 when expired', () => {
    expect(railLifetimeAlpha(4, 4)).toBe(0)
    expect(railLifetimeAlpha(5, 4)).toBe(0)
  })

  it('peaks near 1.0 in the mid-life range', () => {
    // At 50 % of lifetime, should be essentially 1
    const a = railLifetimeAlpha(2, 4)
    expect(a).toBeGreaterThan(0.95)
  })

  it('fades out in the last 30 %', () => {
    const near_end = railLifetimeAlpha(3.8, 4)
    const mid      = railLifetimeAlpha(2.0, 4)
    expect(near_end).toBeLessThan(mid)
    expect(near_end).toBeLessThan(0.2)
  })

  it('all values are in [0, 1]', () => {
    for (let age = 0; age <= 4.2; age += 0.1) {
      const v = railLifetimeAlpha(age, 4)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('handles zero or negative lifetime gracefully', () => {
    expect(railLifetimeAlpha(1, 0)).toBe(0)
    expect(railLifetimeAlpha(1, -1)).toBe(0)
  })
})

// ── Expiry check ──────────────────────────────────────────────────────────────

describe('isRailExpired', () => {
  const base: NeonRail = {
    vertical: true, pos: 0.5, spanStart: 0, spanEnd: 1,
    width: 1, alpha: 1, glow: 0, depth: 1,
    birthSec: 10, lifetime: 4, colorRgb: '74,199,219',
  }

  it('not expired before lifetime elapses', () => {
    expect(isRailExpired(base, 13.9)).toBe(false)
  })

  it('expired exactly at lifetime', () => {
    expect(isRailExpired(base, 14)).toBe(true)
  })

  it('expired past lifetime', () => {
    expect(isRailExpired(base, 20)).toBe(true)
  })
})

// ── Object caps ───────────────────────────────────────────────────────────────

describe('spawn caps', () => {
  it('MAX_VERT is 12', () => expect(MAX_VERT).toBe(12))
  it('MAX_HORIZ is 10', () => expect(MAX_HORIZ).toBe(10))

  it('resolveRailTargets never exceeds MAX_VERT for any railDensity/verticalBias', () => {
    for (const d of [0, 0.3, 0.5, 0.7, 0.9, 1]) {
      for (const v of [0, 0.25, 0.5, 0.75, 1]) {
        const { targetVert } = resolveRailTargets(d, v)
        expect(targetVert).toBeLessThanOrEqual(MAX_VERT)
        expect(targetVert).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('resolveRailTargets never exceeds MAX_HORIZ for any railDensity/verticalBias', () => {
    for (const d of [0, 0.3, 0.5, 0.7, 0.9, 1]) {
      for (const v of [0, 0.25, 0.5, 0.75, 1]) {
        const { targetHoriz } = resolveRailTargets(d, v)
        expect(targetHoriz).toBeLessThanOrEqual(MAX_HORIZ)
        expect(targetHoriz).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('makeVerticalRail returns exactly one rail object (no arrays per call)', () => {
    const result = makeVerticalRail(1, settings, 0, [], palette, 0.7)
    expect(typeof result).toBe('object')
    expect(Array.isArray(result)).toBe(false)
  })

  it('makeHorizontalRail returns exactly one rail object (no arrays per call)', () => {
    const result = makeHorizontalRail(1, settings, 0, [], palette, 0.7)
    expect(typeof result).toBe('object')
    expect(Array.isArray(result)).toBe(false)
  })
})

// ── Trigger helpers ───────────────────────────────────────────────────────────

describe('resolveRailBurstCounts', () => {
  it('verticalBias=0.6 gives 3 vert + 2 horiz', () => {
    const { vertCount, horizCount } = resolveRailBurstCounts(0.6)
    expect(vertCount).toBe(3)
    expect(horizCount).toBe(2)
  })

  it('verticalBias=1 gives 4 vert + 1 horiz', () => {
    const { vertCount, horizCount } = resolveRailBurstCounts(1)
    expect(vertCount).toBe(4)
    expect(horizCount).toBe(1)
  })

  it('verticalBias=0 gives 2 vert + 3 horiz', () => {
    const { vertCount, horizCount } = resolveRailBurstCounts(0)
    expect(vertCount).toBe(2)
    expect(horizCount).toBe(3)
  })

  it('counts are bounded at any bias', () => {
    for (const bias of [0, 0.25, 0.5, 0.75, 1]) {
      const { vertCount, horizCount } = resolveRailBurstCounts(bias)
      expect(vertCount).toBeGreaterThanOrEqual(2)
      expect(vertCount).toBeLessThanOrEqual(4)
      expect(horizCount).toBeGreaterThanOrEqual(1)
      expect(horizCount).toBeLessThanOrEqual(3)
    }
  })
})

describe('resolveOverlayAlpha', () => {
  it('returns 1 at age=0', () => {
    expect(resolveOverlayAlpha(0, 1)).toBeCloseTo(1, 5)
  })

  it('returns 0.5 at midpoint', () => {
    expect(resolveOverlayAlpha(0.5, 1)).toBeCloseTo(0.5, 5)
  })

  it('returns 0 at or past duration', () => {
    expect(resolveOverlayAlpha(1, 1)).toBeCloseTo(0, 5)
    expect(resolveOverlayAlpha(2, 1)).toBeCloseTo(0, 5)
  })

  it('whiteout is fully faded at WHITEOUT_DURATION seconds', () => {
    expect(resolveOverlayAlpha(WHITEOUT_DURATION, WHITEOUT_DURATION)).toBeCloseTo(0, 5)
  })

  it('blackout is fully faded at BLACKOUT_DURATION seconds', () => {
    expect(resolveOverlayAlpha(BLACKOUT_DURATION, BLACKOUT_DURATION)).toBeCloseTo(0, 5)
  })

  it('WHITEOUT_DURATION is a short flash (<= 0.5 s)', () => {
    expect(WHITEOUT_DURATION).toBeLessThanOrEqual(0.5)
    expect(WHITEOUT_DURATION).toBeGreaterThan(0)
  })

  it('BLACKOUT_DURATION auto-recovers quickly (<= 1.2 s)', () => {
    expect(BLACKOUT_DURATION).toBeLessThanOrEqual(1.2)
    expect(BLACKOUT_DURATION).toBeGreaterThan(0)
  })
})

describe('resolveCyanStrikeDuration', () => {
  it('always at least 0.4 s regardless of BPM', () => {
    for (const bpm of [0, 60, 120, 180, 200]) {
      expect(resolveCyanStrikeDuration(bpm)).toBeGreaterThanOrEqual(0.40)
    }
  })

  it('120 BPM → 0.75 s (1.5 beats)', () => {
    expect(resolveCyanStrikeDuration(120)).toBeCloseTo(0.75, 5)
  })

  it('0 BPM falls back to 0.5 s beat → 0.75 s', () => {
    expect(resolveCyanStrikeDuration(0)).toBeCloseTo(0.75, 5)
  })

  it('60 BPM → 1.5 s (1.5 beats)', () => {
    expect(resolveCyanStrikeDuration(60)).toBeCloseTo(1.5, 5)
  })
})

describe('trigger constants', () => {
  it('FREEZE_DURATION is 1.2 s', () => {
    expect(FREEZE_DURATION).toBeCloseTo(1.2, 5)
  })

  it('RESEED_LIFE_SCALE is a shrink factor < 1', () => {
    expect(RESEED_LIFE_SCALE).toBeGreaterThan(0)
    expect(RESEED_LIFE_SCALE).toBeLessThan(1)
  })

  it('RESEED_LIFE_SCALE preserves positive lifetime for any positive remaining', () => {
    for (const remaining of [0.1, 1.0, 5.0, 10.0]) {
      expect(remaining * RESEED_LIFE_SCALE).toBeGreaterThan(0)
    }
  })
})

// ── hexToRgbStr ───────────────────────────────────────────────────────────────

describe('hexToRgbStr', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgbStr('#4ac7db')).toBe('74,199,219')
    expect(hexToRgbStr('#ffffff')).toBe('255,255,255')
    expect(hexToRgbStr('#000000')).toBe('0,0,0')
  })

  it('is case-insensitive', () => {
    expect(hexToRgbStr('#4AC7DB')).toBe('74,199,219')
  })

  it('falls back to cyan for unknown format', () => {
    expect(hexToRgbStr('not-a-color')).toBe('74,199,219')
    expect(hexToRgbStr('')).toBe('74,199,219')
  })
})
