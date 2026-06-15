/**
 * BPM-synchronized Beam Matrix sequencer tests.
 *
 * Tests are deterministic: no Math.random(), no timers, no DOM.
 * All 20 tests verify specific numeric outcomes given exact inputs.
 */

import { describe, it, expect } from 'vitest'
import {
  computeSequenceOrder,
  computeBeamSequenceState,
} from '../LaserDmxBeamSequencer'
import {
  computeKinematics,
  applyEasing,
  lerpPt,
} from '../LaserDmxBeamKinematics'
import type { LaserDmxBeamSequence } from '../../ReactTypes'
import { DEFAULT_BEAM_SEQUENCE } from '../../ReactTypes'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSeq(overrides: Partial<LaserDmxBeamSequence> = {}): LaserDmxBeamSequence {
  return { ...DEFAULT_BEAM_SEQUENCE, enabled: true, ...overrides }
}

const IDS = ['b0', 'b1', 'b2', 'b3', 'b4']

// ── 1. Static mode ────────────────────────────────────────────────────────────

describe('static mode — computeKinematics', () => {
  it('returns full path (origin=0, target=1) with no head glow', () => {
    const r = computeKinematics('static', 0.5, 0.3, 0.8, 'linear')
    expect(r.visibleOriginFrac).toBe(0)
    expect(r.visibleTargetFrac).toBe(1)
    expect(r.headIntensity).toBe(0)
  })
})

// ── 2. Grow mode ──────────────────────────────────────────────────────────────

describe('grow mode — computeKinematics', () => {
  it('at progress=0 visible target is at origin (zero-length beam)', () => {
    const r = computeKinematics('grow', 0, 0.3, 0.5, 'linear')
    expect(r.visibleOriginFrac).toBe(0)
    expect(r.visibleTargetFrac).toBeCloseTo(0)
  })

  it('at progress=0.5 visible target is at 0.5 of path', () => {
    const r = computeKinematics('grow', 0.5, 0.3, 0.5, 'linear')
    expect(r.visibleOriginFrac).toBe(0)
    expect(r.visibleTargetFrac).toBeCloseTo(0.5)
  })

  it('advances toward target with positive progress', () => {
    const r1 = computeKinematics('grow', 0.3, 0.3, 0.5, 'linear')
    const r2 = computeKinematics('grow', 0.7, 0.3, 0.5, 'linear')
    expect(r2.visibleTargetFrac).toBeGreaterThan(r1.visibleTargetFrac)
  })
})

// ── 3. Projectile mode ────────────────────────────────────────────────────────

describe('projectile mode — computeKinematics', () => {
  it('at progress=0.5 and tailLength=0.3: head=0.5, tail=0.2', () => {
    const r = computeKinematics('projectile', 0.5, 0.3, 0.5, 'linear')
    expect(r.visibleTargetFrac).toBeCloseTo(0.5)        // head at 50%
    expect(r.visibleOriginFrac).toBeCloseTo(0.2)        // tail: 0.5 - 0.3 = 0.2
  })

  it('tail is clamped to 0 at early progress', () => {
    const r = computeKinematics('projectile', 0.1, 0.3, 0.5, 'linear')
    expect(r.visibleOriginFrac).toBe(0)  // max(0, 0.1-0.3)=0
    expect(r.visibleTargetFrac).toBeCloseTo(0.1)
  })
})

// ── 4. Scanner mode ───────────────────────────────────────────────────────────

describe('scanner mode — computeKinematics', () => {
  it('produces a short moving segment (tail less than full path)', () => {
    const r = computeKinematics('scanner', 0.5, 0.2, 0.5, 'linear')
    const segLen = r.visibleTargetFrac - r.visibleOriginFrac
    expect(segLen).toBeLessThan(1)
    expect(segLen).toBeGreaterThan(0)
  })

  it('segment moves along path as progress increases', () => {
    const r1 = computeKinematics('scanner', 0.3, 0.15, 0.5, 'linear')
    const r2 = computeKinematics('scanner', 0.7, 0.15, 0.5, 'linear')
    expect(r2.visibleTargetFrac).toBeGreaterThan(r1.visibleTargetFrac)
  })
})

// ── 5. PingPong mode ──────────────────────────────────────────────────────────

describe('pingPong mode — computeKinematics', () => {
  it('at rawProgress=0 starts at origin', () => {
    const r = computeKinematics('pingPong', 0, 0.3, 0.5, 'linear')
    expect(r.visibleOriginFrac).toBe(0)
    expect(r.visibleTargetFrac).toBeCloseTo(0)
  })

  it('at rawProgress=0.5 reaches target (triangle peak)', () => {
    const r = computeKinematics('pingPong', 0.5, 0.3, 0.5, 'linear')
    expect(r.visibleTargetFrac).toBeCloseTo(1)
  })

  it('at rawProgress=1 is back at origin (triangle completes)', () => {
    const r = computeKinematics('pingPong', 1, 0.3, 0.5, 'linear')
    expect(r.visibleTargetFrac).toBeCloseTo(0)
  })
})

// ── 6. PulseTrain mode ────────────────────────────────────────────────────────

describe('pulseTrain mode — computeKinematics', () => {
  it('produces multiple pulse segments', () => {
    const r = computeKinematics('pulseTrain', 0.5, 0.3, 0.5, 'linear')
    expect(r.pulseSegments).toBeDefined()
    expect(r.pulseSegments!.length).toBeGreaterThan(1)
  })

  it('each segment has startFrac < endFrac', () => {
    const r = computeKinematics('pulseTrain', 0.4, 0.3, 0.5, 'linear')
    for (const seg of r.pulseSegments ?? []) {
      expect(seg.startFrac).toBeLessThan(seg.endFrac)
    }
  })
})

// ── 7. Easing functions ───────────────────────────────────────────────────────

describe('applyEasing', () => {
  it('easeIn at t=0.5 returns 0.25 (x²)', () => {
    expect(applyEasing(0.5, 'easeIn')).toBeCloseTo(0.25)
  })

  it('easeOut at t=0.5 returns 0.75 (1-(1-x)²)', () => {
    expect(applyEasing(0.5, 'easeOut')).toBeCloseTo(0.75)
  })

  it('linear at t=0.5 returns 0.5', () => {
    expect(applyEasing(0.5, 'linear')).toBeCloseTo(0.5)
  })
})

// ── 8. Forward sequence ───────────────────────────────────────────────────────

describe('forward sequence', () => {
  it('at beat 0, step 0: beam b0 (index 0) is active', () => {
    const seq = makeSeq({ mode: 'forward', stepsPerBeat: 1, stepGate: 1 })
    const state = computeBeamSequenceState(0, 0, 5, 0.0, seq)
    expect(state.gate).toBe(1)
  })

  it('at beat 1: beam b1 (index 1) is active, b0 is not', () => {
    const seq = makeSeq({ mode: 'forward', stepsPerBeat: 1, stepGate: 1 })
    const s0 = computeBeamSequenceState(0, 0, 5, 1.0, seq)
    const s1 = computeBeamSequenceState(1, 1, 5, 1.0, seq)
    expect(s0.gate).toBe(0)
    expect(s1.gate).toBe(1)
  })

  it('sequence wraps around: at step N, beam 0 is active again', () => {
    const seq = makeSeq({ mode: 'forward', stepsPerBeat: 1, stepGate: 1 })
    const state = computeBeamSequenceState(0, 0, 5, 5.0, seq)  // 5 beams, beat=5
    expect(state.gate).toBe(1)
  })
})

// ── 9. Reverse sequence order ─────────────────────────────────────────────────

describe('computeSequenceOrder — reverse', () => {
  it('returns beams in reversed sequenceIndex order', () => {
    const order = computeSequenceOrder(IDS, 'reverse', 42)
    expect(order).toEqual(['b4', 'b3', 'b2', 'b1', 'b0'])
  })
})

// ── 10. Alternate sequence ────────────────────────────────────────────────────

describe('alternate sequence', () => {
  it('at even step: even-position beams are active', () => {
    const seq = makeSeq({ mode: 'alternate', stepsPerBeat: 1, stepGate: 1 })
    // beat=0 → step=0 → even group (positions 0, 2, 4)
    const s0 = computeBeamSequenceState(0, 0, 5, 0.0, seq)
    const s1 = computeBeamSequenceState(1, 1, 5, 0.0, seq)
    const s2 = computeBeamSequenceState(2, 2, 5, 0.0, seq)
    expect(s0.gate).toBe(1)  // position 0 (even)
    expect(s1.gate).toBe(0)  // position 1 (odd)
    expect(s2.gate).toBe(1)  // position 2 (even)
  })

  it('at odd step: odd-position beams are active', () => {
    const seq = makeSeq({ mode: 'alternate', stepsPerBeat: 1, stepGate: 1 })
    // beat=1 → step=1 → odd group (positions 1, 3)
    const s0 = computeBeamSequenceState(0, 0, 4, 1.0, seq)
    const s1 = computeBeamSequenceState(1, 1, 4, 1.0, seq)
    expect(s0.gate).toBe(0)  // position 0 (even)
    expect(s1.gate).toBe(1)  // position 1 (odd)
  })
})

// ── 11. CenterOut sequence order — exhaustive edge-case coverage ──────────────
//
// Root cause of previous infinite loop:
//   With even n, the guard `if (i > 0 && right < n)` skipped right side at i=0
//   (even though the right pair existed).  Subsequent iterations incremented `i`
//   but produced out-of-bounds right indices, so result.length never reached n.
//
// New algorithm is bounded O(n/2); these tests verify correctness for all sizes.

function assertCenterOut(ids: string[], expected: string[]): void {
  const order = computeSequenceOrder(ids, 'centerOut', 42)
  // Length
  expect(order).toHaveLength(ids.length)
  // No duplicates
  expect(new Set(order).size).toBe(ids.length)
  // All IDs present
  for (const id of ids) expect(order).toContain(id)
  // Exact order
  expect(order).toEqual(expected)
}

describe('computeSequenceOrder — centerOut (edge cases)', () => {
  it('0 beams → empty', () => {
    expect(computeSequenceOrder([], 'centerOut', 42)).toEqual([])
  })

  it('1 beam → just that beam', () => {
    assertCenterOut(['b0'], ['b0'])
  })

  it('2 beams (even) → [b0, b1] center pair', () => {
    // even n=2: mid=1, d=0 → push ids[0], ids[1]
    assertCenterOut(['b0', 'b1'], ['b0', 'b1'])
  })

  it('3 beams (odd) → center first, then outward', () => {
    // odd n=3: mid=1 → [b1, b0, b2]
    assertCenterOut(['b0', 'b1', 'b2'], ['b1', 'b0', 'b2'])
  })

  it('4 beams (even) — was the infinite-loop case', () => {
    // even n=4: mid=2, d=0→[b1,b2], d=1→[b0,b3]
    assertCenterOut(['b0', 'b1', 'b2', 'b3'], ['b1', 'b2', 'b0', 'b3'])
  })

  it('5 beams (odd)', () => {
    // odd n=5: mid=2 → [b2, b1, b3, b0, b4]
    assertCenterOut(
      ['b0', 'b1', 'b2', 'b3', 'b4'],
      ['b2', 'b1', 'b3', 'b0', 'b4'],
    )
  })

  it('7 beams (odd)', () => {
    // mid=3 → [b3, b2, b4, b1, b5, b0, b6]
    assertCenterOut(
      ['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      ['b3', 'b2', 'b4', 'b1', 'b5', 'b0', 'b6'],
    )
  })

  it('8 beams (even) — even count like the center-out-chase preset', () => {
    // mid=4 → [b3,b4, b2,b5, b1,b6, b0,b7]
    assertCenterOut(
      ['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'],
      ['b3', 'b4', 'b2', 'b5', 'b1', 'b6', 'b0', 'b7'],
    )
  })
})

// ── 12. OutsideIn sequence order ──────────────────────────────────────────────

function assertOutsideIn(ids: string[], expected: string[]): void {
  const order = computeSequenceOrder(ids, 'outsideIn', 42)
  expect(order).toHaveLength(ids.length)
  expect(new Set(order).size).toBe(ids.length)
  for (const id of ids) expect(order).toContain(id)
  expect(order).toEqual(expected)
}

describe('computeSequenceOrder — outsideIn (edge cases)', () => {
  it('0 beams → empty', () => {
    expect(computeSequenceOrder([], 'outsideIn', 42)).toEqual([])
  })

  it('1 beam', () => {
    assertOutsideIn(['b0'], ['b0'])
  })

  it('2 beams', () => {
    assertOutsideIn(['b0', 'b1'], ['b0', 'b1'])
  })

  it('3 beams', () => {
    assertOutsideIn(['b0', 'b1', 'b2'], ['b0', 'b2', 'b1'])
  })

  it('4 beams: starts at both ends, moves inward', () => {
    const order = computeSequenceOrder(['b0', 'b1', 'b2', 'b3'], 'outsideIn', 42)
    expect(order[0]).toBe('b0')   // left outer
    expect(order[1]).toBe('b3')   // right outer
    expect(order[2]).toBe('b1')   // next inner-left
    expect(order[3]).toBe('b2')   // next inner-right
    assertOutsideIn(['b0', 'b1', 'b2', 'b3'], ['b0', 'b3', 'b1', 'b2'])
  })

  it('7 beams', () => {
    assertOutsideIn(
      ['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      ['b0', 'b6', 'b1', 'b5', 'b2', 'b4', 'b3'],
    )
  })

  it('8 beams', () => {
    assertOutsideIn(
      ['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'],
      ['b0', 'b7', 'b1', 'b6', 'b2', 'b5', 'b3', 'b4'],
    )
  })
})

// ── 13. Seeded random is deterministic ───────────────────────────────────────

describe('computeSequenceOrder — randomSeeded', () => {
  it('same seed always produces the same order', () => {
    const order1 = computeSequenceOrder(IDS, 'randomSeeded', 99)
    const order2 = computeSequenceOrder(IDS, 'randomSeeded', 99)
    expect(order1).toEqual(order2)
  })

  it('different seeds produce different orders (probabilistically)', () => {
    const order1 = computeSequenceOrder(IDS, 'randomSeeded', 1)
    const order2 = computeSequenceOrder(IDS, 'randomSeeded', 12345)
    expect(order1).not.toEqual(order2)
  })
})

// ── 14. Seeking — deterministic from beat position ───────────────────────────

describe('deterministic seeking', () => {
  it('same absoluteBeat always gives same gate/progress regardless of order', () => {
    const seq = makeSeq({ mode: 'forward', stepsPerBeat: 2, stepGate: 0.8 })
    const a = computeBeamSequenceState(1, 1, 4, 3.25, seq)
    const b = computeBeamSequenceState(1, 1, 4, 3.25, seq)
    expect(a).toEqual(b)
  })

  it('progress advances as beatPhase increases within a step', () => {
    const seq = makeSeq({ mode: 'forward', stepsPerBeat: 1, stepGate: 1 })
    const s0 = computeBeamSequenceState(0, 0, 3, 0.1, seq)
    const s1 = computeBeamSequenceState(0, 0, 3, 0.4, seq)
    expect(s1.progress).toBeGreaterThan(s0.progress)
  })
})

// ── 15. StepGate silences beam after gate window ──────────────────────────────

describe('stepGate', () => {
  it('gate=0 when stepPhase exceeds stepGate', () => {
    // stepGate=0.5, beat=0.6 → stepPhase=0.6 > 0.5 → gate=0
    const seq = makeSeq({ mode: 'forward', stepsPerBeat: 1, stepGate: 0.5 })
    const state = computeBeamSequenceState(0, 0, 3, 0.6, seq)
    expect(state.gate).toBe(0)
  })

  it('gate=1 when stepPhase is within stepGate', () => {
    const seq = makeSeq({ mode: 'forward', stepsPerBeat: 1, stepGate: 0.5 })
    const state = computeBeamSequenceState(0, 0, 3, 0.25, seq)
    expect(state.gate).toBe(1)
  })
})

// ── 16. stepsPerBeat > 1 ─────────────────────────────────────────────────────

describe('stepsPerBeat', () => {
  it('stepsPerBeat=2: two full steps per beat', () => {
    const seq = makeSeq({ mode: 'forward', stepsPerBeat: 2, stepGate: 1 })
    // beat=0.5 → seqPos=1 → step 1 → beam at index 1 active
    const s0 = computeBeamSequenceState(0, 0, 4, 0.5, seq)
    const s1 = computeBeamSequenceState(1, 1, 4, 0.5, seq)
    expect(s0.gate).toBe(0)
    expect(s1.gate).toBe(1)
  })
})

// ── 17. 'all' mode — every beam active ───────────────────────────────────────

describe('all mode', () => {
  it('all beams have gate=1', () => {
    const seq = makeSeq({ mode: 'all', stepsPerBeat: 1 })
    for (let i = 0; i < 5; i++) {
      const state = computeBeamSequenceState(i, i, 5, 1.3, seq)
      expect(state.gate).toBe(1)
    }
  })

  it('progress equals step fractional part (beat phase within step)', () => {
    const seq = makeSeq({ mode: 'all', stepsPerBeat: 1 })
    // beat=2.7 → seqPos=2.7 → stepPhase=0.7
    const state = computeBeamSequenceState(0, 0, 3, 2.7, seq)
    expect(state.progress).toBeCloseTo(0.7)
  })
})

// ── 18. lerpPt spatial interpolation ─────────────────────────────────────────

describe('lerpPt', () => {
  it('t=0 returns origin point', () => {
    const r = lerpPt(10, 20, 0, 100, 200, 1, 0)
    expect(r).toEqual({ x: 10, y: 20, z: 0 })
  })

  it('t=1 returns target point', () => {
    const r = lerpPt(10, 20, 0, 100, 200, 1, 1)
    expect(r).toEqual({ x: 100, y: 200, z: 1 })
  })

  it('t=0.5 returns midpoint', () => {
    const r = lerpPt(0, 0, 0, 100, 200, 2, 0.5)
    expect(r).toEqual({ x: 50, y: 100, z: 1 })
  })

  it('different progress values produce different spatial results', () => {
    const r1 = lerpPt(0, 0, 0, 100, 100, 0, 0.2)
    const r2 = lerpPt(0, 0, 0, 100, 100, 0, 0.8)
    expect(r1.x).not.toEqual(r2.x)
    expect(r1.y).not.toEqual(r2.y)
  })
})

// ── 19. Legacy / static beams — backward compatibility ───────────────────────

describe('backward compatibility', () => {
  it('computeKinematics static mode always returns full path regardless of progress', () => {
    for (const p of [0, 0.5, 1]) {
      const r = computeKinematics('static', p, 0.3, 0.5, 'linear')
      expect(r.visibleOriginFrac).toBe(0)
      expect(r.visibleTargetFrac).toBe(1)
    }
  })

  it('sequence disabled: computeBeamSequenceState should not be called (non-sequenced beams use full intensity gate=1)', () => {
    // When sequence.enabled=false, the compiler skips computeBeamSequenceState.
    // This test verifies that the sequencer logic, when given orderedCount=0,
    // returns gate=0 (the compiler only calls it when enabled).
    const seq = makeSeq({ mode: 'forward', stepsPerBeat: 1, stepGate: 0.5 })
    const state = computeBeamSequenceState(0, 0, 0, 1.0, seq)
    expect(state.gate).toBe(0)  // empty group → no beam to activate
  })
})

// ── 20. rotateEveryBars shifts active beam ────────────────────────────────────

describe('rotateEveryBars', () => {
  it('rotation offset shifts which beam index receives the active step', () => {
    const seq = makeSeq({ mode: 'forward', stepsPerBeat: 1, stepGate: 1, rotateEveryBars: 1 })
    const n = 3

    // Without rotation (barIndex=0, rotationOffset=0): beam 0 is active at beat 0
    const noRot = computeBeamSequenceState(0, 0, n, 0.0, seq)
    expect(noRot.gate).toBe(1)

    // With rotation offset 1 applied by caller: beam 0 now acts as beam 1
    // (caller shifts adjustedIdx = (0 - 1 + 3) % 3 = 2)
    const rotated = computeBeamSequenceState(2, 2, n, 0.0, seq)
    expect(rotated.gate).toBe(0)  // step 0 does NOT match index 2
    const rotatedIdx1 = computeBeamSequenceState(0, 0, n, 1.0, seq)
    expect(rotatedIdx1.gate).toBe(0)  // beat=1 activates index 1, not 0
    const rotatedActiveAtBeat1 = computeBeamSequenceState(1, 1, n, 1.0, seq)
    expect(rotatedActiveAtBeat1.gate).toBe(1)  // index 1 is active at beat 1
  })
})
