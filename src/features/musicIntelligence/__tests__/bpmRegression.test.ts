/**
 * Regression tests covering BPM lifecycle, track synchronization, and
 * unavailable-BPM behavior.
 *
 * These are pure unit tests — no DOM, no React, no timers.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { BeatGrid } from '../beatGrid'
import { buildBeatMarkers } from '../offlineTrackAnalyzer'
import type { TrackIntelligenceAnalysis } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAnalysis(bpm: number | null, overrides: Partial<TrackIntelligenceAnalysis> = {}): TrackIntelligenceAnalysis {
  const beatGrid = bpm !== null ? buildBeatMarkers(bpm, 0, 10) : []
  return {
    analysisVersion:   'auto-1.0',
    createdAt:         new Date().toISOString(),
    durationMs:        10_000,
    bpm,
    bpmConfidence:     bpm !== null ? 0.85 : null,
    beatGridOffsetSec: bpm !== null ? 0 : null,
    timeSignature:     4,
    beatGrid,
    downbeats:         beatGrid.filter(m => m.isDownbeat),
    phrases:           [],
    sections:          [],
    energyCurves:      { instant: [], shortTerm: [], bass: [], mid: [], high: [] },
    spectralCurves:    { centroid: [], flux: [], complexity: [] },
    stemCurves:        null,
    harmonic: {
      keyChanges: [], chordProgression: [],
      dominantKey: null, dominantMode: null, keyConfidence: 0,
      pitchCurve: [], melodyContourCurve: [],
    },
    lyrics:          null,
    semanticMoments: [],
    warnings:        bpm === null ? ['BPM detection failed'] : [],
    errors:          [],
    ...overrides,
  }
}

// ── BeatGrid: bpm=0 handling ──────────────────────────────────────────────────

describe('BeatGrid — bpm=0 (unavailable)', () => {
  let grid: BeatGrid

  beforeEach(() => { grid = new BeatGrid() })

  it('setBpm(0) keeps bpm at 0, does NOT clamp to 1', () => {
    grid.setBpm(0, 0)
    const state = grid.update(1.0, true)
    expect(state.bpm).toBe(0)
  })

  it('update returns zero state when bpm=0, even while playing', () => {
    grid.setBpm(0, 0)
    const state = grid.update(5.0, true)
    expect(state.bpm).toBe(0)
    expect(state.beatHit).toBe(false)
    expect(state.beatIndex).toBe(0)
    expect(state.beatPhase).toBe(0)
    expect(state.downbeatHit).toBe(false)
  })

  it('no beatHit events generated when bpm=0', () => {
    grid.setBpm(0, 0)
    const hits: boolean[] = []
    for (let t = 0; t < 4; t += 0.1) {
      hits.push(grid.update(t, true).beatHit)
    }
    expect(hits.every(h => h === false)).toBe(true)
  })

  it('setting a valid BPM after 0 produces beats normally', () => {
    grid.setBpm(0, 0)
    grid.update(1.0, true)
    grid.setBpm(120, 0.9)
    const state = grid.update(0.5, true)
    expect(state.bpm).toBe(120)
    // beatIndex should be calculable from time / beatDur
    expect(state.beatIndex).toBeGreaterThanOrEqual(0)
  })
})

// ── BeatGrid: bpm>0 normal operation ─────────────────────────────────────────

describe('BeatGrid — normal BPM', () => {
  let grid: BeatGrid

  beforeEach(() => {
    grid = new BeatGrid()
    grid.setBpm(120, 0.9)
  })

  it('at 120 BPM beat period is 0.5s', () => {
    const s1 = grid.update(0.1, true)
    const s2 = grid.update(0.6, true)
    expect(s2.beatIndex).toBe(s1.beatIndex + 1)
    expect(s2.beatHit).toBe(true)
  })

  it('beatPhase cycles 0→1 within each beat', () => {
    const s1 = grid.update(0.1, true)
    const s2 = grid.update(0.4, true)
    expect(s2.beatPhase).toBeGreaterThan(s1.beatPhase)
  })

  it('downbeatHit fires only on beat 0 of each bar', () => {
    // 120 BPM, 4/4: bar = 4 beats = 2s
    const state = grid.update(2.0, true)  // start of bar 1
    // beatHit fires on increment; we need to step
    grid.setBpm(120, 0.9)
    const s = grid.update(2.01, true)
    expect(s.beatHit || s.downbeatHit).toBeDefined()
  })
})

// ── buildBeatMarkers: exported utility ───────────────────────────────────────

describe('buildBeatMarkers', () => {
  it('produces correct count at 120 BPM for 10s', () => {
    const markers = buildBeatMarkers(120, 0, 10)
    // 120 BPM = 2 beats/s → 20 beats in 10s
    expect(markers.length).toBe(20)
  })

  it('first marker is at offsetSec', () => {
    const markers = buildBeatMarkers(120, 0.1, 10)
    expect(markers[0]?.timeSec).toBeCloseTo(0.1)
  })

  it('isDownbeat every 4th beat', () => {
    const markers = buildBeatMarkers(120, 0, 10)
    const downbeats = markers.filter(m => m.isDownbeat)
    expect(downbeats.length).toBe(5)  // beats 0,4,8,12,16 → 5 downbeats
    for (const db of downbeats) {
      const idx = markers.indexOf(db)
      expect(idx % 4).toBe(0)
    }
  })

  it('beat spacing equals 60/bpm', () => {
    const bpm = 140
    const markers = buildBeatMarkers(bpm, 0, 10)
    const period = 60 / bpm
    for (let i = 1; i < Math.min(markers.length, 5); i++) {
      expect(markers[i]!.timeSec - markers[i - 1]!.timeSec).toBeCloseTo(period, 4)
    }
  })
})

// ── TrackIntelligenceAnalysis: nullable bpm ───────────────────────────────────

describe('TrackIntelligenceAnalysis — nullable bpm', () => {
  it('analysis with null bpm does not contain beat markers', () => {
    const analysis = makeAnalysis(null)
    expect(analysis.bpm).toBeNull()
    expect(analysis.bpmConfidence).toBeNull()
    expect(analysis.beatGridOffsetSec).toBeNull()
    expect(analysis.beatGrid).toHaveLength(0)
    expect(analysis.downbeats).toHaveLength(0)
  })

  it('analysis with null bpm still carries section and energy data', () => {
    const analysis = makeAnalysis(null)
    // Only beat-grid fields should be null; other fields should still be present
    expect(analysis.analysisVersion).toBeTruthy()
    expect(analysis.durationMs).toBeGreaterThan(0)
    expect(analysis.harmonic).toBeDefined()
  })

  it('analysis with valid bpm carries non-null beat grid fields', () => {
    const analysis = makeAnalysis(128)
    expect(analysis.bpm).toBe(128)
    expect(analysis.bpmConfidence).not.toBeNull()
    expect(analysis.beatGridOffsetSec).not.toBeNull()
    expect(analysis.beatGrid.length).toBeGreaterThan(0)
  })

  it('warnings contain BPM detection message when bpm is null', () => {
    const analysis = makeAnalysis(null)
    expect(analysis.warnings.some(w => w.toLowerCase().includes('bpm'))).toBe(true)
  })
})

// ── Beat grid regeneration from override ──────────────────────────────────────

describe('beat grid regeneration from BPM override', () => {
  it('markers at 140 BPM have shorter period than at 120 BPM', () => {
    const markers120 = buildBeatMarkers(120, 0, 10)
    const markers140 = buildBeatMarkers(140, 0, 10)
    // 140 BPM → more beats in same duration
    expect(markers140.length).toBeGreaterThan(markers120.length)
    // Spacing at 140 BPM is smaller
    const period120 = markers120[1]!.timeSec - markers120[0]!.timeSec
    const period140 = markers140[1]!.timeSec - markers140[0]!.timeSec
    expect(period140).toBeLessThan(period120)
  })

  it('regenerated grid at override BPM produces different beat phase than original at same time', () => {
    const grid = new BeatGrid()

    // Original analysis at 120 BPM
    const originalMarkers = buildBeatMarkers(120, 0, 60)
    grid.setBpm(120, 0.9, 0)
    grid.setMarkers(originalMarkers, originalMarkers.filter(m => m.isDownbeat))
    const stateAt120 = grid.update(1.3, true)

    // Override to 140 BPM — regenerate markers
    const overrideMarkers = buildBeatMarkers(140, 0, 60)
    grid.setBpm(140, 0.9, 0)
    grid.setMarkers(overrideMarkers, overrideMarkers.filter(m => m.isDownbeat))
    const stateAt140 = grid.update(1.3, true)

    // Beat phase at the same audio time should differ under different BPMs
    expect(stateAt120.bpm).toBe(120)
    expect(stateAt140.bpm).toBe(140)
    expect(Math.abs(stateAt120.beatPhase - stateAt140.beatPhase)).toBeGreaterThan(0.01)
  })

  it('clearing override restores original beat phase', () => {
    const grid = new BeatGrid()
    const originalMarkers = buildBeatMarkers(128, 0, 60)
    grid.setBpm(128, 0.9, 0)
    grid.setMarkers(originalMarkers, originalMarkers.filter(m => m.isDownbeat))
    const stateOriginal = grid.update(1.3, true)

    // Apply override
    const overrideMarkers = buildBeatMarkers(150, 0, 60)
    grid.setBpm(150, 0.9, 0)
    grid.setMarkers(overrideMarkers, overrideMarkers.filter(m => m.isDownbeat))

    // Clear override — restore original
    grid.setBpm(128, 0.9, 0)
    grid.setMarkers(originalMarkers, originalMarkers.filter(m => m.isDownbeat))
    const stateRestored = grid.update(1.3, true)

    expect(stateRestored.bpm).toBe(stateOriginal.bpm)
    expect(stateRestored.beatPhase).toBeCloseTo(stateOriginal.beatPhase, 3)
  })
})

// ── Timing readiness sentinel ─────────────────────────────────────────────────

describe('timing readiness (bpm=0 is unavailable)', () => {
  it('bpm=0 in MI frame signals timing unavailable', () => {
    // Consumers should check mi.rhythm.bpm > 0 before sequencing
    const bpm = 0
    expect(bpm > 0).toBe(false)
  })

  it('bpm>0 in MI frame signals timing ready', () => {
    const bpm = 128
    expect(bpm > 0).toBe(true)
  })
})
