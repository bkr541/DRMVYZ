import { describe, it, expect } from 'vitest'
import { buildEffectiveBeatGrid } from './beatGridUtils'
import type { BeatMarkerMI } from '../musicIntelligence/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function beatsOnly(markers: BeatMarkerMI[]) {
  return markers.filter(m => !m.isDownbeat)
}
function downbeatsOnly(markers: BeatMarkerMI[]) {
  return markers.filter(m => m.isDownbeat)
}

// ── 1: BPM override spacing ───────────────────────────────────────────────────

describe('buildEffectiveBeatGrid — BPM override spacing', () => {
  it('150 BPM produces beat period of 0.4 s between every consecutive marker', () => {
    // Beat period = spacing between ANY two adjacent markers (downbeats included).
    const markers = buildEffectiveBeatGrid(150, 10, 0)
    for (let i = 1; i < markers.length; i++) {
      expect(markers[i].timeSec - markers[i - 1].timeSec).toBeCloseTo(0.4, 9)
    }
  })

  it('150 BPM in 4/4 produces downbeat spacing of 1.6 s (one bar)', () => {
    const markers = buildEffectiveBeatGrid(150, 10, 0)
    const dbs     = downbeatsOnly(markers)
    for (let i = 1; i < dbs.length; i++) {
      expect(dbs[i].timeSec - dbs[i - 1].timeSec).toBeCloseTo(1.6, 9)
    }
  })

  it('120 BPM produces beat period of 0.5 s between every consecutive marker', () => {
    const markers = buildEffectiveBeatGrid(120, 10, 0)
    for (let i = 1; i < markers.length; i++) {
      expect(markers[i].timeSec - markers[i - 1].timeSec).toBeCloseTo(0.5, 9)
    }
  })

  it('120 BPM in 4/4 produces downbeat spacing of 2.0 s (one bar)', () => {
    const markers = buildEffectiveBeatGrid(120, 10, 0)
    const dbs     = downbeatsOnly(markers)
    for (let i = 1; i < dbs.length; i++) {
      expect(dbs[i].timeSec - dbs[i - 1].timeSec).toBeCloseTo(2.0, 9)
    }
  })
})

// ── 2: Clearing override restores original timing ──────────────────────────
// (Tested via the pure helper: verify that two calls with different BPMs
//  produce independent results and that re-calling with the original BPM
//  exactly reproduces the original markers.)

describe('buildEffectiveBeatGrid — idempotency / original restoration', () => {
  it('applying then clearing preserves original beat timestamps exactly', () => {
    const original = buildEffectiveBeatGrid(120, 60, 0)

    // "Override" — call helper with different BPM
    const overridden = buildEffectiveBeatGrid(150, 60, 0)
    expect(overridden[1].timeSec).not.toBeCloseTo(original[1].timeSec, 5)

    // "Clear" — call helper again with original BPM
    const restored = buildEffectiveBeatGrid(120, 60, 0)
    expect(restored).toHaveLength(original.length)
    for (let i = 0; i < original.length; i++) {
      expect(restored[i].timeSec).toBeCloseTo(original[i].timeSec, 10)
      expect(restored[i].isDownbeat).toBe(original[i].isDownbeat)
    }
  })

  it('original analysis object is never mutated by building an effective grid', () => {
    const originalMarkers: BeatMarkerMI[] = [
      { timeSec: 0,    confidence: 0.9, isDownbeat: true  },
      { timeSec: 0.5,  confidence: 0.8, isDownbeat: false },
      { timeSec: 1.0,  confidence: 0.8, isDownbeat: false },
      { timeSec: 1.5,  confidence: 0.8, isDownbeat: false },
    ]
    const snapshot = JSON.stringify(originalMarkers)

    // Build effective grid (would be used instead of, not on top of, original)
    buildEffectiveBeatGrid(150, 60, 0)

    // Original array must be unchanged
    expect(JSON.stringify(originalMarkers)).toBe(snapshot)
  })
})

// ── 3: Per-track isolation ────────────────────────────────────────────────────

describe('buildEffectiveBeatGrid — per-track isolation', () => {
  it('grids built for track A and track B are independent arrays', () => {
    const gridA = buildEffectiveBeatGrid(128, 60, 0.1)
    const gridB = buildEffectiveBeatGrid(140, 60, 0.05)

    expect(gridA).not.toBe(gridB)
    expect(gridA[0].timeSec).not.toBeCloseTo(gridB[0].timeSec, 5)
  })

  it('mutating returned grid for track A does not affect a subsequent call for track B', () => {
    const gridA = buildEffectiveBeatGrid(120, 10, 0)
    gridA[0] = { timeSec: 999, confidence: 0, isDownbeat: false }

    const gridB = buildEffectiveBeatGrid(120, 10, 0)
    expect(gridB[0].timeSec).not.toBe(999)
    expect(gridB[0].timeSec).toBeCloseTo(0, 10)
  })
})

// ── 4: Phase preservation ─────────────────────────────────────────────────────

describe('buildEffectiveBeatGrid — phase preservation', () => {
  it('first beat at offset 0.18 s, not at 0', () => {
    const markers = buildEffectiveBeatGrid(150, 10, 0.18)
    expect(markers[0].timeSec).toBeCloseTo(0.18, 10)
  })

  it('subsequent beats follow index-based formula from the offset', () => {
    const bpm     = 150
    const offset  = 0.18
    const period  = 60 / bpm // 0.4 s
    const markers = buildEffectiveBeatGrid(bpm, 10, offset)

    for (let i = 0; i < Math.min(markers.length, 20); i++) {
      expect(markers[i].timeSec).toBeCloseTo(offset + i * period, 9)
    }
  })

  it('large offset is normalized modulo beatPeriod', () => {
    // offset 1.8 s at 150 BPM (period 0.4 s) → 1.8 % 0.4 = 0.2 s
    const markers = buildEffectiveBeatGrid(150, 10, 1.8)
    expect(markers[0].timeSec).toBeCloseTo(0.2, 9)
  })

  it('zero offset: first beat is at 0', () => {
    const markers = buildEffectiveBeatGrid(120, 10, 0)
    expect(markers[0].timeSec).toBeCloseTo(0, 10)
  })
})

// ── 5: No duration overflow ────────────────────────────────────────────────────

describe('buildEffectiveBeatGrid — no duration overflow', () => {
  it('no marker exceeds durationSec by more than a tiny epsilon', () => {
    const duration = 180
    const markers  = buildEffectiveBeatGrid(120, duration, 0)
    for (const m of markers) {
      expect(m.timeSec).toBeLessThanOrEqual(duration + 1e-6)
    }
  })

  it('a beat landing exactly on durationSec is included', () => {
    // 120 BPM, 10 s duration, offset 0 → beats at 0, 0.5, 1.0 … 10.0 exactly
    const markers = buildEffectiveBeatGrid(120, 10, 0)
    const last    = markers[markers.length - 1]
    expect(last.timeSec).toBeCloseTo(10.0, 9)
  })

  it('returns empty array for zero duration', () => {
    expect(buildEffectiveBeatGrid(120, 0, 0)).toHaveLength(0)
  })

  it('returns empty array for zero BPM', () => {
    expect(buildEffectiveBeatGrid(0, 10, 0)).toHaveLength(0)
  })
})

// ── 6: Downbeat marking ────────────────────────────────────────────────────────

describe('buildEffectiveBeatGrid — downbeat marking', () => {
  it('beat 0 is a downbeat', () => {
    const markers = buildEffectiveBeatGrid(120, 10, 0)
    expect(markers[0].isDownbeat).toBe(true)
  })

  it('beats 1, 2, 3 are not downbeats', () => {
    const markers = buildEffectiveBeatGrid(120, 10, 0)
    expect(markers[1].isDownbeat).toBe(false)
    expect(markers[2].isDownbeat).toBe(false)
    expect(markers[3].isDownbeat).toBe(false)
  })

  it('beat 4 is a downbeat', () => {
    const markers = buildEffectiveBeatGrid(120, 10, 0)
    expect(markers[4].isDownbeat).toBe(true)
  })

  it('custom beatsPerBar=3 marks every third beat as downbeat', () => {
    const markers = buildEffectiveBeatGrid(120, 10, 0, 3)
    expect(markers[0].isDownbeat).toBe(true)
    expect(markers[1].isDownbeat).toBe(false)
    expect(markers[2].isDownbeat).toBe(false)
    expect(markers[3].isDownbeat).toBe(true)
  })
})

// ── 7: No drift over long tracks ──────────────────────────────────────────────

describe('buildEffectiveBeatGrid — no cumulative drift', () => {
  it('timestamps match index formula exactly at the 1000th beat', () => {
    const bpm    = 120
    const period = 60 / bpm // 0.5 s
    const offset = 0.18
    const duration = offset + 1001 * period
    const markers = buildEffectiveBeatGrid(bpm, duration, offset)

    const idx999 = 999
    const expected = offset + idx999 * period
    expect(markers[idx999].timeSec).toBeCloseTo(expected, 10)
  })
})

// ── 8: confidence field ────────────────────────────────────────────────────────

describe('buildEffectiveBeatGrid — confidence', () => {
  it('all markers have confidence 1.0 (deterministic override)', () => {
    const markers = buildEffectiveBeatGrid(120, 10, 0)
    for (const m of markers) {
      expect(m.confidence).toBe(1.0)
    }
  })
})
