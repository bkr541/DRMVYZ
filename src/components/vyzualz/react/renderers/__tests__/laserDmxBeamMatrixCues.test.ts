import { describe, it, expect, beforeEach } from 'vitest'
import {
  musicalCueToBeatPos,
  evaluateCueSummary,
  resolveCueGateFactor,
  resetBeamMatrixCompilerState,
  type CueSummary,
} from '../LaserDmxBeamMatrixCompiler'
import type { LaserDmxBeamMatrixCue } from '../../ReactTypes'
import { BEATS_PER_BAR } from '../../ReactTypes'

// ── Helpers ───────────────────────────────────────────────────────────────────

let _uuid = 0
function uid() { return `cue-${++_uuid}` }

function makeCue(overrides: Partial<LaserDmxBeamMatrixCue> = {}): LaserDmxBeamMatrixCue {
  return {
    id:          uid(),
    name:        'Test cue',
    enabled:     true,
    targetType:  'beam',
    targetId:    'beam-1',
    timingMode:  'musical',
    action:      'gate',
    startBar:    1,
    startBeat:   1,
    ...overrides,
  }
}

/** Simulate a summary at beatPos with clean prior state (prevBeatPos = -1). */
function summarize(
  cues: LaserDmxBeamMatrixCue[],
  beatPos: number,
  isSeek = false,
): CueSummary {
  return evaluateCueSummary(cues, beatPos, beatPos * 500, isSeek)
}

beforeEach(() => {
  resetBeamMatrixCompilerState()
  _uuid = 0
})

// ── 1. musicalCueToBeatPos ────────────────────────────────────────────────────

describe('musicalCueToBeatPos', () => {
  it('bar 1 beat 1 → 0', () => {
    expect(musicalCueToBeatPos(1, 1)).toBe(0)
  })

  it('bar 1 beat 2 → 1', () => {
    expect(musicalCueToBeatPos(1, 2)).toBe(1)
  })

  it('bar 2 beat 1 → BEATS_PER_BAR', () => {
    expect(musicalCueToBeatPos(2, 1)).toBe(BEATS_PER_BAR)
  })

  it('bar 3 beat 3 → (3-1)*4 + (3-1) = 10', () => {
    expect(musicalCueToBeatPos(3, 3)).toBe(10)
  })
})

// ── 2. No cues → passthrough ──────────────────────────────────────────────────

describe('no cues → backward-compatible passthrough', () => {
  it('resolveCueGateFactor returns 1 when no cues exist', () => {
    const summary = summarize([], 0)
    expect(resolveCueGateFactor('beam-1', null, summary)).toBe(1)
  })

  it('returns 1 when all cues are disabled', () => {
    const cue = makeCue({ enabled: false, startBar: 1, startBeat: 1 })
    const summary = summarize([cue], 2)
    expect(resolveCueGateFactor('beam-1', null, summary)).toBe(1)
  })
})

// ── 3. Gate cue: activation / deactivation ────────────────────────────────────

describe('gate cue: musical timing', () => {
  function makeGate(startBar: number, startBeat: number, endBar?: number, endBeat?: number) {
    return makeCue({ action: 'gate', startBar, startBeat, endBar, endBeat })
  }

  it('beam active inside gate range', () => {
    const cue = makeGate(1, 1, 2, 1)           // bar 1 b1 → bar 2 b1
    const summary = summarize([cue], musicalCueToBeatPos(1, 2))  // beat 1 inside range
    expect(resolveCueGateFactor('beam-1', null, summary)).toBe(1)
  })

  it('beam silenced before gate range', () => {
    const cue = makeGate(2, 1, 3, 1)           // bar 2 b1 → bar 3 b1
    const summary = summarize([cue], musicalCueToBeatPos(1, 1))  // at bar 1 b1
    expect(resolveCueGateFactor('beam-1', null, summary)).toBe(0)
  })

  it('beam silenced after gate range', () => {
    const cue = makeGate(1, 1, 2, 1)           // ends at bar 2 b1
    const summary = summarize([cue], musicalCueToBeatPos(2, 1))  // exactly at end = exclusive
    expect(resolveCueGateFactor('beam-1', null, summary)).toBe(0)
  })

  it('open-ended gate (no endBar) is active past original end position', () => {
    const cue = makeGate(1, 1)                 // no end = infinity
    const summary = summarize([cue], 999)
    expect(resolveCueGateFactor('beam-1', null, summary)).toBe(1)
  })

  it('seek into active range activates gate immediately', () => {
    const cue = makeGate(3, 1, 5, 1)
    const summary = summarize([cue], musicalCueToBeatPos(4, 2), true)  // isSeek=true
    expect(resolveCueGateFactor('beam-1', null, summary)).toBe(1)
  })

  it('two overlapping gate cues on same beam: any active → factor 1', () => {
    const c1 = makeCue({ id: 'c1', action: 'gate', startBar: 1, startBeat: 1, endBar: 2, endBeat: 1 })
    const c2 = makeCue({ id: 'c2', action: 'gate', startBar: 2, startBeat: 1, endBar: 3, endBeat: 1 })
    // At bar 2 b1: c1 end is exclusive (= 0), c2 start = 4 (active)
    const summary = summarize([c1, c2], musicalCueToBeatPos(2, 1))
    expect(resolveCueGateFactor('beam-1', null, summary)).toBe(1)
  })
})

// ── 4. Gate cue: absolute timing ─────────────────────────────────────────────

describe('gate cue: absolute timing', () => {
  function makeAbsGate(startMs: number, endMs?: number, targetId = 'beam-1') {
    return makeCue({
      action: 'gate', timingMode: 'absolute',
      startMs, endMs, startBar: undefined, startBeat: undefined,
      targetId,
    })
  }

  it('active inside absolute range', () => {
    const cue = makeAbsGate(1000, 3000)
    const summary = evaluateCueSummary([cue], 0, 2000, false)
    expect(resolveCueGateFactor('beam-1', null, summary)).toBe(1)
  })

  it('silenced before absolute range', () => {
    const cue = makeAbsGate(5000, 10000)
    const summary = evaluateCueSummary([cue], 0, 3000, false)
    expect(resolveCueGateFactor('beam-1', null, summary)).toBe(0)
  })

  it('open-ended absolute gate (no endMs) active indefinitely', () => {
    const cue = makeAbsGate(0)
    const summary = evaluateCueSummary([cue], 0, 999999, false)
    expect(resolveCueGateFactor('beam-1', null, summary)).toBe(1)
  })
})

// ── 5. Group-targeted gate cues ───────────────────────────────────────────────

describe('group-targeted gate cues', () => {
  it('group gate silences beams in group outside range', () => {
    const cue = makeCue({
      action: 'gate', targetType: 'group', targetId: 'group-A',
      startBar: 2, startBeat: 1,
    })
    const summary = summarize([cue], 0)
    // beam-1 with groupId=group-A should be silenced
    expect(resolveCueGateFactor('beam-1', 'group-A', summary)).toBe(0)
  })

  it('group gate activates beams in group inside range', () => {
    const cue = makeCue({
      action: 'gate', targetType: 'group', targetId: 'group-A',
      startBar: 1, startBeat: 1, endBar: 3, endBeat: 1,
    })
    const summary = summarize([cue], musicalCueToBeatPos(2, 1))
    expect(resolveCueGateFactor('beam-1', 'group-A', summary)).toBe(1)
  })

  it('group gate does not affect beams in a different group', () => {
    const cue = makeCue({
      action: 'gate', targetType: 'group', targetId: 'group-A',
      startBar: 2, startBeat: 1,
    })
    const summary = summarize([cue], 0)
    // beam-2 has groupId=group-B, no gate → passthrough
    expect(resolveCueGateFactor('beam-2', 'group-B', summary)).toBe(1)
  })

  it('beam gate and group gate are independent; max wins', () => {
    // beam-1 has a beam gate (active) + group gate (inactive)
    const beamCue = makeCue({
      id: 'bc', action: 'gate', targetType: 'beam', targetId: 'beam-1',
      startBar: 1, startBeat: 1, endBar: 5, endBeat: 1,
    })
    const groupCue = makeCue({
      id: 'gc', action: 'gate', targetType: 'group', targetId: 'group-A',
      startBar: 10, startBeat: 1,  // not active yet
    })
    const summary = summarize([beamCue, groupCue], 2)
    expect(resolveCueGateFactor('beam-1', 'group-A', summary)).toBe(1)
  })
})

// ── 6. Trigger cue: fire-once semantics ──────────────────────────────────────

describe('trigger cue: fire-once and decay', () => {
  const TRIGGER_DECAY = 0.5  // CUE_TRIGGER_DECAY_SEC

  it('trigger is inactive before start position', () => {
    const cue = makeCue({ action: 'trigger', startBar: 2, startBeat: 1 })
    const summary = evaluateCueSummary([cue], 0, 0, false)
    expect(resolveCueGateFactor('beam-1', null, summary)).toBe(1)  // no gates → passthrough
    // but also no trigger contribution
    expect(summary.beamTriggerGate.size).toBe(0)
  })

  it('trigger fires when playhead crosses start (prevBeatPos < start, cur >= start)', () => {
    const cue = makeCue({ action: 'trigger', startBar: 2, startBeat: 1 })
    const startPos = musicalCueToBeatPos(2, 1)

    // Frame 1: before start
    evaluateCueSummary([cue], startPos - 0.5, (startPos - 0.5) * 500, false)
    // Frame 2: at/past start
    const summary = evaluateCueSummary([cue], startPos, startPos * 500, false)
    expect(summary.beamTriggerGate.has('beam-1')).toBe(true)
    expect(summary.beamTriggerGate.get('beam-1')).toBeGreaterThan(0)
    expect(summary.beamTriggerGate.get('beam-1')).toBeLessThanOrEqual(1)
  })

  it('trigger does not fire again on subsequent frames (fire-once)', () => {
    const cue = makeCue({ id: 'once', action: 'trigger', startBar: 2, startBeat: 1 })
    const startPos = musicalCueToBeatPos(2, 1)

    evaluateCueSummary([cue], startPos - 0.5, (startPos - 0.5) * 500, false)
    evaluateCueSummary([cue], startPos,       startPos * 500,           false)
    // After fire, cue.fired = true — subsequent frames past start don't re-fire
    const summary = evaluateCueSummary([cue], startPos + 1, (startPos + 1) * 500, false)
    // Envelope may still be decaying; .fired prevents re-trigger
    // If envelope < 1 s has passed the value may still be > 0 but it's decaying
    const val = summary.beamTriggerGate.get('beam-1') ?? 0
    expect(val).toBeGreaterThanOrEqual(0)
    expect(val).toBeLessThan(1)  // definitely not re-fired at full value
  })

  it('trigger does NOT fire on seek-forward past start', () => {
    const cue = makeCue({ id: 'seek-skip', action: 'trigger', startBar: 3, startBeat: 1 })
    const startPos = musicalCueToBeatPos(3, 1)

    // isSeek = true; no prior frame
    const summary = evaluateCueSummary([cue], startPos + 2, (startPos + 2) * 500, true)
    expect(summary.beamTriggerGate.size).toBe(0)
  })

  it('trigger rearms when playhead rewinds before start', () => {
    const cue = makeCue({ id: 'rearm', action: 'trigger', startBar: 2, startBeat: 1 })
    const startPos = musicalCueToBeatPos(2, 1)

    // Fire
    evaluateCueSummary([cue], startPos - 0.5, (startPos - 0.5) * 500, false)
    evaluateCueSummary([cue], startPos,       startPos * 500,           false)

    // Rewind before start — should rearm
    evaluateCueSummary([cue], startPos - 2, (startPos - 2) * 500, false)

    // Approach again — should fire again
    evaluateCueSummary([cue], startPos - 0.1, (startPos - 0.1) * 500, false)
    const summary = evaluateCueSummary([cue], startPos + 0.1, (startPos + 0.1) * 500, false)
    expect(summary.beamTriggerGate.has('beam-1')).toBe(true)
  })

  it('trigger envelope decays to 0 after TRIGGER_DECAY_SEC', () => {
    const cue = makeCue({ id: 'decay', action: 'trigger', startBar: 1, startBeat: 1 })

    // Frame before start
    evaluateCueSummary([cue], -0.1, 0, false)
    // Frame at start — fires, envStartSec = 0
    evaluateCueSummary([cue], 0, 0, false)
    // Frame well past decay window (600ms)
    const summary = evaluateCueSummary([cue], 1.2, 1200, false)
    expect(summary.beamTriggerGate.has('beam-1')).toBe(false)
  })
})

// ── 7. resolveCueGateFactor: logic summary ────────────────────────────────────

describe('resolveCueGateFactor', () => {
  it('no gates, no triggers → 1', () => {
    const summary: CueSummary = {
      beamHasGates: new Set(), groupHasGates: new Set(),
      beamGateActive: new Set(), groupGateActive: new Set(),
      beamTriggerGate: new Map(), groupTriggerGate: new Map(),
    }
    expect(resolveCueGateFactor('b1', null, summary)).toBe(1)
  })

  it('has gate but not active → 0', () => {
    const summary: CueSummary = {
      beamHasGates: new Set(['b1']), groupHasGates: new Set(),
      beamGateActive: new Set(), groupGateActive: new Set(),
      beamTriggerGate: new Map(), groupTriggerGate: new Map(),
    }
    expect(resolveCueGateFactor('b1', null, summary)).toBe(0)
  })

  it('has gate and active → 1', () => {
    const summary: CueSummary = {
      beamHasGates: new Set(['b1']), groupHasGates: new Set(),
      beamGateActive: new Set(['b1']), groupGateActive: new Set(),
      beamTriggerGate: new Map(), groupTriggerGate: new Map(),
    }
    expect(resolveCueGateFactor('b1', null, summary)).toBe(1)
  })

  it('trigger envelope only (no gate cue) → returns envelope value directly', () => {
    const summary: CueSummary = {
      beamHasGates: new Set(), groupHasGates: new Set(),
      beamGateActive: new Set(), groupGateActive: new Set(),
      beamTriggerGate: new Map([['b1', 0.7]]), groupTriggerGate: new Map(),
    }
    expect(resolveCueGateFactor('b1', null, summary)).toBe(0.7)
  })

  it('gate inactive but trigger active → trigger value wins via max', () => {
    const summary: CueSummary = {
      beamHasGates: new Set(['b1']), groupHasGates: new Set(),
      beamGateActive: new Set(), groupGateActive: new Set(),
      beamTriggerGate: new Map([['b1', 0.8]]), groupTriggerGate: new Map(),
    }
    expect(resolveCueGateFactor('b1', null, summary)).toBe(0.8)
  })

  it('group trigger gate contributes when beam has matching groupId', () => {
    const summary: CueSummary = {
      beamHasGates: new Set(), groupHasGates: new Set(),
      beamGateActive: new Set(), groupGateActive: new Set(),
      beamTriggerGate: new Map(), groupTriggerGate: new Map([['grp-A', 0.6]]),
    }
    expect(resolveCueGateFactor('b1', 'grp-A', summary)).toBe(0.6)
  })

  it('beam with null groupId is not affected by group trigger', () => {
    const summary: CueSummary = {
      beamHasGates: new Set(), groupHasGates: new Set(),
      beamGateActive: new Set(), groupGateActive: new Set(),
      beamTriggerGate: new Map(), groupTriggerGate: new Map([['grp-A', 0.9]]),
    }
    expect(resolveCueGateFactor('b1', null, summary)).toBe(1)  // no gate cues → passthrough
  })
})

// ── 8. Disabled cue is ignored ────────────────────────────────────────────────

describe('disabled cue', () => {
  it('disabled gate cue does not register a gate', () => {
    const cue = makeCue({ enabled: false, action: 'gate', startBar: 1, startBeat: 1 })
    const summary = summarize([cue], 0)
    expect(summary.beamHasGates.size).toBe(0)
  })

  it('disabled trigger cue does not fire', () => {
    const cue = makeCue({ id: 'dis', enabled: false, action: 'trigger', startBar: 1, startBeat: 1 })
    evaluateCueSummary([cue], -0.1, 0, false)
    const summary = evaluateCueSummary([cue], 0.1, 100, false)
    expect(summary.beamTriggerGate.size).toBe(0)
  })

  it('mix of enabled and disabled cues: enabled wins', () => {
    const enabled  = makeCue({ id: 'en',  enabled: true,  action: 'gate', startBar: 1, startBeat: 1, endBar: 4, endBeat: 1 })
    const disabled = makeCue({ id: 'dis', enabled: false, action: 'gate', startBar: 1, startBeat: 1 })
    const summary = summarize([enabled, disabled], 2)
    // One enabled gate active
    expect(resolveCueGateFactor('beam-1', null, summary)).toBe(1)
    // Only one gate registered
    expect(summary.beamHasGates.size).toBe(1)
  })
})

// ── 9. Unknown/deleted target: does not crash ─────────────────────────────────

describe('unknown target handling', () => {
  it('gate cue targeting nonexistent beam still registers/evaluates without throwing', () => {
    const cue = makeCue({ targetId: 'ghost-beam', action: 'gate', startBar: 1, startBeat: 1 })
    expect(() => summarize([cue], 2)).not.toThrow()
    const summary = summarize([cue], 2)
    // ghost beam has a gate active
    expect(summary.beamGateActive.has('ghost-beam')).toBe(true)
    // real beam-1 is unaffected — no gate → passthrough
    expect(resolveCueGateFactor('beam-1', null, summary)).toBe(1)
  })
})

// ── 10. resetBeamMatrixCompilerState clears trigger envelopes ─────────────────

describe('resetBeamMatrixCompilerState', () => {
  it('clears trigger fire state so trigger fires again after reset', () => {
    // Use bar 2 beat 1 (pos=4) so "before" position 3.5 is non-negative,
    // satisfying the prevBeatPos >= 0 guard in boundary-crossing detection.
    const cue = makeCue({ id: 'r1', action: 'trigger', startBar: 2, startBeat: 1 })
    const start = musicalCueToBeatPos(2, 1)  // 4

    // Fire once
    evaluateCueSummary([cue], start - 0.5, 0, false)
    evaluateCueSummary([cue], start + 0.1, 100, false)

    // Reset
    resetBeamMatrixCompilerState()

    // Re-fire: after reset prevBeatPos = -1; first frame below start sets
    // a valid non-negative prevBeatPos so boundary crossing is detectable.
    evaluateCueSummary([cue], start - 0.5, 0, false)
    const summary = evaluateCueSummary([cue], start + 0.1, 100, false)
    expect(summary.beamTriggerGate.has('beam-1')).toBe(true)
  })
})
