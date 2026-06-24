import { describe, it, expect } from 'vitest'
import { getCharReactionWeights } from '../letterReactionUtils'
import type { CharReactionWeights } from '../letterReactionUtils'

// ── helpers ───────────────────────────────────────────────────────────────────

function weights(mode: Parameters<typeof getCharReactionWeights>[0], ci: number, n: number, t = 0): CharReactionWeights {
  return getCharReactionWeights(mode, ci, n, t)
}

// ── uniform ───────────────────────────────────────────────────────────────────

describe('getCharReactionWeights — uniform', () => {
  it('returns {1,1,1} for every character', () => {
    for (const ci of [0, 1, 2, 5, 99]) {
      const w = weights('uniform', ci, 6, 0)
      expect(w.bassScale).toBe(1)
      expect(w.midScale).toBe(1)
      expect(w.bloomScale).toBe(1)
    }
  })

  it('is unaffected by time', () => {
    const a = weights('uniform', 0, 4, 0)
    const b = weights('uniform', 0, 4, 5000)
    expect(a).toEqual(b)
  })
})

// ── alternating ───────────────────────────────────────────────────────────────

describe('getCharReactionWeights — alternating', () => {
  it('even letters favor Bass + Beat (bassScale=1, bloomScale=1)', () => {
    for (const ci of [0, 2, 4, 6]) {
      const w = weights('alternating', ci, 8)
      expect(w.bassScale).toBe(1)
      expect(w.bloomScale).toBe(1)
      expect(w.midScale).toBeLessThan(1)
    }
  })

  it('odd letters favor Mid (midScale=1)', () => {
    for (const ci of [1, 3, 5, 7]) {
      const w = weights('alternating', ci, 8)
      expect(w.midScale).toBe(1)
      expect(w.bassScale).toBeLessThan(1)
      expect(w.bloomScale).toBeLessThan(1)
    }
  })

  it('adjacent letters always have different dominant bands', () => {
    const w0 = weights('alternating', 0, 4)
    const w1 = weights('alternating', 1, 4)
    expect(w0.bassScale).not.toBe(w1.bassScale)
    expect(w0.midScale).not.toBe(w1.midScale)
  })

  it('is unaffected by time', () => {
    expect(weights('alternating', 0, 4, 0)).toEqual(weights('alternating', 0, 4, 9999))
  })
})

// ── frequencySplit ────────────────────────────────────────────────────────────

describe('getCharReactionWeights — frequencySplit', () => {
  it('ci%3=0 → Bass only (bassScale=1, others=0)', () => {
    for (const ci of [0, 3, 6]) {
      const w = weights('frequencySplit', ci, 9)
      expect(w.bassScale).toBe(1)
      expect(w.midScale).toBe(0)
      expect(w.bloomScale).toBe(0)
    }
  })

  it('ci%3=1 → Mid only (midScale=1, others=0)', () => {
    for (const ci of [1, 4, 7]) {
      const w = weights('frequencySplit', ci, 9)
      expect(w.bassScale).toBe(0)
      expect(w.midScale).toBe(1)
      expect(w.bloomScale).toBe(0)
    }
  })

  it('ci%3=2 → Beat/Bloom only (bloomScale=1, others=0)', () => {
    for (const ci of [2, 5, 8]) {
      const w = weights('frequencySplit', ci, 9)
      expect(w.bassScale).toBe(0)
      expect(w.midScale).toBe(0)
      expect(w.bloomScale).toBe(1)
    }
  })

  it('pattern repeats every 3 characters', () => {
    const w0 = weights('frequencySplit', 0, 6)
    const w3 = weights('frequencySplit', 3, 6)
    expect(w0).toEqual(w3)
  })
})

// ── ripple ────────────────────────────────────────────────────────────────────

describe('getCharReactionWeights — ripple', () => {
  it('all weights are in [0, 1] at any time', () => {
    for (const t of [0, 500, 1250, 9999]) {
      for (const ci of [0, 1, 2, 3, 4, 5]) {
        const w = weights('ripple', ci, 6, t)
        expect(w.bassScale).toBeGreaterThanOrEqual(0)
        expect(w.bassScale).toBeLessThanOrEqual(1)
        expect(w.midScale).toBeGreaterThanOrEqual(0)
        expect(w.midScale).toBeLessThanOrEqual(1)
        expect(w.bloomScale).toBeGreaterThanOrEqual(0)
        expect(w.bloomScale).toBeLessThanOrEqual(1)
      }
    }
  })

  it('all three weights are equal (ripple applies uniformly across bands)', () => {
    for (const ci of [0, 1, 3]) {
      const w = weights('ripple', ci, 6, 1000)
      expect(w.bassScale).toBe(w.midScale)
      expect(w.midScale).toBe(w.bloomScale)
    }
  })

  it('different characters have different weights at a fixed time', () => {
    // ci=0 and ci=2 within 6 chars are separated by 2/5 of a full sine cycle,
    // giving clearly distinct amplitudes regardless of t.
    const t = 0
    const w0 = weights('ripple', 0, 6, t)  // norm=0   → phase=0    → amp≈0.50
    const w2 = weights('ripple', 2, 6, t)  // norm=0.4 → phase≈2.51 → amp≈0.79
    expect(w0.bassScale).not.toBeCloseTo(w2.bassScale, 2)
  })

  it('same character animates over time (weights change with t)', () => {
    const w0 = weights('ripple', 2, 6, 0)
    const w1 = weights('ripple', 2, 6, 625) // ~half cycle
    expect(w0.bassScale).not.toBeCloseTo(w1.bassScale, 2)
  })

  it('single-character text (numChars=1) returns a valid weight without NaN', () => {
    const w = weights('ripple', 0, 1, 0)
    expect(Number.isFinite(w.bassScale)).toBe(true)
    expect(Number.isFinite(w.midScale)).toBe(true)
    expect(Number.isFinite(w.bloomScale)).toBe(true)
  })
})

// ── ripple — non-consecutive indices (spaces in text) ────────────────────────
//
// "HI Y" has visible chars at ci=0,1,3 (space at ci=2 has no geometry).
// The call site now passes numChars = maxCi + 1 = 4, so the ripple denominator
// is 3 (= maxCi) and norm(ci) = ci/3 stays within [0, 1] for all visible chars.

describe('getCharReactionWeights — ripple with non-consecutive character indices', () => {
  // Caller computes numChars = Math.max(...charCenters.keys()) + 1
  // For "HI Y" with visible ci in {0, 1, 3}: numChars = 3 + 1 = 4

  it('all visible chars produce weights within [0, 1] when ci gaps exist', () => {
    const numChars = 4   // maxCi=3, numChars=4 → denominator = numChars-1 = 3
    for (const ci of [0, 1, 3]) {
      const w = weights('ripple', ci, numChars, 0)
      expect(w.bassScale).toBeGreaterThanOrEqual(0)
      expect(w.bassScale).toBeLessThanOrEqual(1)
    }
  })

  it('last visible char (ci=3, numChars=4) does not exceed 1', () => {
    const w = weights('ripple', 3, 4, 0)
    // norm = 3/(4-1) = 1.0 → amp = 0.5 + 0.5*sin(2π) ≈ 0.5
    expect(w.bassScale).toBeGreaterThanOrEqual(0)
    expect(w.bassScale).toBeLessThanOrEqual(1)
  })

  it('adjacent visible chars have different norms (wave varies across letters)', () => {
    // ci=0 → norm=0/3=0; ci=1 → norm=1/3≈0.333 → clearly different phases.
    // At t=0: phase(0)=0 → amp=0.5; phase(1)=0.333*2π≈2.09 → amp=0.5+0.5*sin(2.09)≈0.93
    // (ci=0 and ci=3 are one full cycle apart and always stay in phase — not a useful pair)
    const numChars = 4
    const w0 = weights('ripple', 0, numChars, 0)
    const w1 = weights('ripple', 1, numChars, 0)
    expect(w0.bassScale).not.toBeCloseTo(w1.bassScale, 2)
  })
})

// ── custom ────────────────────────────────────────────────────────────────────

describe('getCharReactionWeights — custom', () => {
  it('returns zero weights for all characters (assignments override, not weights)', () => {
    for (const ci of [0, 1, 4]) {
      const w = weights('custom', ci, 5)
      expect(w.bassScale).toBe(0)
      expect(w.midScale).toBe(0)
      expect(w.bloomScale).toBe(0)
    }
  })
})
