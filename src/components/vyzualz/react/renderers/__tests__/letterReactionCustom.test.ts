import { describe, it, expect } from 'vitest'
import { evalCustomSignal, applyCustomTargetDelta } from '../letterReactionCustom'
import type { CustomTargetDelta } from '../letterReactionCustom'
import { computeCharCenters } from '../SoundDrawingRenderer'
import type { OscillatorGlyphPoint } from '../../ReactTypes'

// ── Assignment filter behaviour (mirrors SoundDrawingRenderer assignmentsByChar) ──

/**
 * Mirrors the stale-filter logic from drawPathScopeOnTrail so we can unit-test
 * it without invoking the full render pipeline.
 */
function buildAssignmentsByChar(
  charCenters: Map<number, { cx: number; cy: number }>,
  assignments: Array<{ characterIndex: number }>,
): Set<number> {
  const accepted = new Set<number>()
  for (const asgn of assignments) {
    if (charCenters.has(asgn.characterIndex)) accepted.add(asgn.characterIndex)
  }
  return accepted
}

/** Makes a minimal OscillatorGlyphPoint for a given (ci, x) pair. */
function pt(ci: number, x = 0, y = 0): OscillatorGlyphPoint {
  return { x, y, pathIndex: ci, progress: 0, characterIndex: ci, glyphIndex: ci }
}

describe('custom-assignment stale filter — text with spaces', () => {
  // "HI Y": H=ci0, I=ci1, space=ci2 (no geometry), Y=ci3
  const charPts: OscillatorGlyphPoint[] = [pt(0, -4), pt(1, 0), pt(3, 4)]
  const charCenters = computeCharCenters(charPts)

  it('charCenters contains H, I, Y but not the space', () => {
    expect(charCenters.has(0)).toBe(true)
    expect(charCenters.has(1)).toBe(true)
    expect(charCenters.has(2)).toBe(false)
    expect(charCenters.has(3)).toBe(true)
  })

  it('assignment for Y (ci=3) is accepted — not incorrectly treated as stale', () => {
    const accepted = buildAssignmentsByChar(charCenters, [
      { characterIndex: 0 },
      { characterIndex: 3 },
    ])
    expect(accepted.has(0)).toBe(true)
    expect(accepted.has(3)).toBe(true)
  })

  it('assignment for the space index (ci=2) is rejected (no geometry)', () => {
    const accepted = buildAssignmentsByChar(charCenters, [{ characterIndex: 2 }])
    expect(accepted.has(2)).toBe(false)
  })

  it('assignment beyond the text length is rejected', () => {
    // ci=10 — text has been shortened since this assignment was saved
    const accepted = buildAssignmentsByChar(charCenters, [{ characterIndex: 10 }])
    expect(accepted.has(10)).toBe(false)
  })

  it('all three visible characters are accepted', () => {
    const accepted = buildAssignmentsByChar(charCenters, [
      { characterIndex: 0 },
      { characterIndex: 1 },
      { characterIndex: 3 },
    ])
    expect(accepted.size).toBe(3)
  })
})

// ── evalCustomSignal ──────────────────────────────────────────────────────────

describe('evalCustomSignal — source routing', () => {
  const A = { bass: 0.8, mid: 0.5, high: 0.3, beat: 0.9 }

  it('routes bass correctly', () => {
    expect(evalCustomSignal('bass', A.bass, A.mid, A.high, A.beat, 0, false)).toBeCloseTo(0.8)
  })
  it('routes mid correctly', () => {
    expect(evalCustomSignal('mid', A.bass, A.mid, A.high, A.beat, 0, false)).toBeCloseTo(0.5)
  })
  it('routes high correctly', () => {
    expect(evalCustomSignal('high', A.bass, A.mid, A.high, A.beat, 0, false)).toBeCloseTo(0.3)
  })
  it('routes beat correctly', () => {
    expect(evalCustomSignal('beat', A.bass, A.mid, A.high, A.beat, 0, false)).toBeCloseTo(0.9)
  })
})

describe('evalCustomSignal — invert', () => {
  it('inverts the signal', () => {
    const sig = evalCustomSignal('bass', 0.8, 0, 0, 0, 0, true)
    expect(sig).toBeCloseTo(0.2)
  })
  it('inverts 0 to 1', () => {
    expect(evalCustomSignal('bass', 0, 0, 0, 0, 0, true)).toBeCloseTo(1)
  })
  it('inverts 1 to 0', () => {
    expect(evalCustomSignal('bass', 1, 0, 0, 0, 0, true)).toBeCloseTo(0)
  })
})

describe('evalCustomSignal — phaseOffset', () => {
  it('zero offset: signal passes through unchanged', () => {
    expect(evalCustomSignal('bass', 0.3, 0, 0, 0, 0, false)).toBeCloseTo(0.3)
  })
  it('offset 0.5 wraps correctly (0.3 → 0.8)', () => {
    expect(evalCustomSignal('bass', 0.3, 0, 0, 0, 0.5, false)).toBeCloseTo(0.8)
  })
  it('offset wraps past 1 back into [0,1)', () => {
    // raw=0.8, offset=0.5 → 1.3 → fract=0.3
    const sig = evalCustomSignal('bass', 0.8, 0, 0, 0, 0.5, false)
    expect(sig).toBeGreaterThanOrEqual(0)
    expect(sig).toBeLessThan(1)
    expect(sig).toBeCloseTo(0.3)
  })
  it('negative offset wraps correctly (0.1 + (-0.5) = -0.4 → 0.6)', () => {
    const sig = evalCustomSignal('bass', 0.1, 0, 0, 0, -0.5, false)
    expect(sig).toBeCloseTo(0.6)
  })
  it('signal is always in [0, 1]', () => {
    for (const offset of [-0.9, -0.5, 0, 0.25, 0.5, 0.99]) {
      for (const raw of [0, 0.2, 0.5, 0.8, 1]) {
        const sig = evalCustomSignal('bass', raw, 0, 0, 0, offset, false)
        expect(sig).toBeGreaterThanOrEqual(0)
        expect(sig).toBeLessThanOrEqual(1)
      }
    }
  })
})

// ── applyCustomTargetDelta ────────────────────────────────────────────────────

function makeAcc(ldx = 10, ldy = 0): CustomTargetDelta {
  return { ldx, ldy, dOffX: 0, dOffY: 0, jitter: 0 }
}

describe('applyCustomTargetDelta — scale', () => {
  it('scales ldx and ldy by (1 + signal * amount)', () => {
    const acc = makeAcc(10, 5)
    applyCustomTargetDelta('scale', 1, 1, acc)
    expect(acc.ldx).toBeCloseTo(20)
    expect(acc.ldy).toBeCloseTo(10)
  })
  it('zero signal → no scale change', () => {
    const acc = makeAcc(10, 5)
    applyCustomTargetDelta('scale', 0, 1, acc)
    expect(acc.ldx).toBeCloseTo(10)
    expect(acc.ldy).toBeCloseTo(5)
  })
  it('does not affect dOffX/dOffY/jitter', () => {
    const acc = makeAcc(10, 0)
    acc.dOffX = 3; acc.jitter = 0.1
    applyCustomTargetDelta('scale', 0.5, 2, acc)
    expect(acc.dOffX).toBeCloseTo(3)
    expect(acc.jitter).toBeCloseTo(0.1)
  })
})

describe('applyCustomTargetDelta — rotation', () => {
  it('signal=0 → no rotation (angle=0)', () => {
    const acc = makeAcc(10, 0)
    applyCustomTargetDelta('rotation', 0, 1, acc)
    expect(acc.ldx).toBeCloseTo(10)
    expect(acc.ldy).toBeCloseTo(0)
  })
  it('signal=0.5, amount=1 → 180° rotation → point at (-10, 0)', () => {
    const acc = makeAcc(10, 0)
    applyCustomTargetDelta('rotation', 0.5, 1, acc)
    expect(acc.ldx).toBeCloseTo(-10)
    expect(acc.ldy).toBeCloseTo(0, 5)
  })
  it('signal=0.25, amount=1 → 90° rotation → point at (0, 10)', () => {
    const acc = makeAcc(10, 0)
    applyCustomTargetDelta('rotation', 0.25, 1, acc)
    expect(acc.ldx).toBeCloseTo(0, 5)
    expect(acc.ldy).toBeCloseTo(10)
  })
  it('preserves vector length', () => {
    const acc = makeAcc(3, 4) // length = 5
    applyCustomTargetDelta('rotation', 0.3, 0.7, acc)
    const len = Math.sqrt(acc.ldx ** 2 + acc.ldy ** 2)
    expect(len).toBeCloseTo(5)
  })
})

describe('applyCustomTargetDelta — offsetX', () => {
  it('adds signal * amount to dOffX', () => {
    const acc = makeAcc()
    applyCustomTargetDelta('offsetX', 0.5, 2, acc)
    expect(acc.dOffX).toBeCloseTo(1)
  })
  it('does not affect ldx/ldy/dOffY/jitter', () => {
    const acc = makeAcc(10, 5)
    applyCustomTargetDelta('offsetX', 1, 1, acc)
    expect(acc.ldx).toBe(10)
    expect(acc.ldy).toBe(5)
    expect(acc.dOffY).toBe(0)
    expect(acc.jitter).toBe(0)
  })
})

describe('applyCustomTargetDelta — offsetY', () => {
  it('adds signal * amount to dOffY', () => {
    const acc = makeAcc()
    applyCustomTargetDelta('offsetY', 0.5, 2, acc)
    expect(acc.dOffY).toBeCloseTo(1)
  })
})

describe('applyCustomTargetDelta — jitter', () => {
  it('accumulates jitter amplitude', () => {
    const acc = makeAcc()
    applyCustomTargetDelta('jitter', 0.5, 0.4, acc)
    expect(acc.jitter).toBeCloseTo(0.2)
  })
  it('multiple jitter assignments stack', () => {
    const acc = makeAcc()
    applyCustomTargetDelta('jitter', 0.5, 0.4, acc)
    applyCustomTargetDelta('jitter', 1,   0.3, acc)
    expect(acc.jitter).toBeCloseTo(0.5)
  })
})

describe('applyCustomTargetDelta — multiple assignments in sequence', () => {
  it('scale then rotate compose correctly', () => {
    const acc = makeAcc(10, 0)
    applyCustomTargetDelta('scale',    1,    1,   acc) // ldx=20, ldy=0
    applyCustomTargetDelta('rotation', 0.25, 1,   acc) // 90° → ldx≈0, ldy≈20
    expect(acc.ldx).toBeCloseTo(0, 4)
    expect(acc.ldy).toBeCloseTo(20)
  })

  it('offsetX and offsetY accumulate independently', () => {
    const acc = makeAcc()
    applyCustomTargetDelta('offsetX', 1, 0.5, acc)
    applyCustomTargetDelta('offsetY', 1, 0.3, acc)
    expect(acc.dOffX).toBeCloseTo(0.5)
    expect(acc.dOffY).toBeCloseTo(0.3)
  })
})
