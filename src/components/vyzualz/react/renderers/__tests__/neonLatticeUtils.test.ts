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
} from '../neonLatticeUtils'
import type { NeonRail } from '../neonLatticeUtils'
import { DEFAULT_NEON_LATTICE_SETTINGS } from '../../ReactTypes'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const settings = { ...DEFAULT_NEON_LATTICE_SETTINGS }
const palette  = { primary: '74,199,219', accent: '220,60,190' }

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

// ── Object caps (integration) ─────────────────────────────────────────────────

describe('spawn caps', () => {
  it('MAX_VERT is 12', () => expect(MAX_VERT).toBe(12))
  it('MAX_HORIZ is 10', () => expect(MAX_HORIZ).toBe(10))

  it('caps: cannot have more vertical rails than MAX_VERT by repeatedly spawning', () => {
    // Simulate the spawn logic: only spawn when count < MAX_VERT
    const rails: NeonRail[] = []
    for (let i = 0; i < MAX_VERT + 5; i++) {
      if (rails.filter(r => r.vertical).length < MAX_VERT) {
        rails.push(makeVerticalRail(i + 1, settings, i * 0.2, rails, palette, 0.7))
      }
    }
    expect(rails.filter(r => r.vertical).length).toBeLessThanOrEqual(MAX_VERT)
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
