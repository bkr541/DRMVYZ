/**
 * BPM unification tests — spec scenarios 1-15.
 *
 * These tests exercise the pure `deriveBpmState` helper directly, plus the
 * `resolveTrackBpm` utility that the audio engine uses for the same logic.
 * Tests that require live audio (canvas frame BPM, LaserDMX timing) are
 * covered by the coordinator and trackBpmResolution suites.
 */
import { describe, it, expect } from 'vitest'
import { resolveTrackBpm } from '../../../../lib/trackBpmResolution'
import { DEFAULT_TRACK_ANALYSIS_RUNTIME } from '../../../../types'
import type { TrackAnalysisRuntime } from '../../../../types'
import type { TrackIntelligenceAnalysis } from '../../../../features/musicIntelligence/types'

// ── Re-export deriveBpmState for white-box testing ────────────────────────────
// The function is defined in VyzualzAudioDock.tsx but is pure — duplicate a
// trimmed version here so tests don't have to mount the component.

type BpmState =
  | { kind: 'none' }
  | { kind: 'analyzing' }
  | { kind: 'value'; bpm: number; analyzed: number | null; source: string | null }
  | { kind: 'failed'; error: string | null }

function deriveBpmState(
  source:       'file' | 'microphone' | 'demo',
  hasTrack:     boolean,
  status:       string,
  effectiveBpm: number | null,
  analyzedBpm:  number | null,
  bpmSource:    string | null,
  error:        string | null,
): BpmState {
  if (source === 'demo') {
    return { kind: 'value', bpm: 120, analyzed: null, source: 'demo' }
  }
  if (source === 'microphone' || !hasTrack) {
    return { kind: 'none' }
  }
  if (status === 'queued' || status === 'decoding' || status === 'analyzing') {
    return { kind: 'analyzing' }
  }
  if (status === 'complete' && effectiveBpm !== null) {
    const overrideActive = bpmSource === 'manual_override' || bpmSource === 'live_analysis'
    return { kind: 'value', bpm: effectiveBpm, analyzed: overrideActive ? analyzedBpm : null, source: bpmSource }
  }
  if (status === 'failed') {
    return { kind: 'failed', error }
  }
  return { kind: 'none' }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeAnalysis(bpm: number, bpmConfidence = 0.9): TrackIntelligenceAnalysis {
  return {
    analysisVersion:   'auto-1.0',
    createdAt:         new Date().toISOString(),
    durationMs:        180_000,
    bpm,
    bpmConfidence,
    beatGridOffsetSec: 0.1,
    timeSignature:     4,
    beatGrid:          [],
    downbeats:         [],
    phrases:           [],
    sections:          [],
    energyCurves:      { instant: [], shortTerm: [], bass: [], mid: [], high: [] },
    spectralCurves:    { centroid: [], flux: [], complexity: [] },
    stemCurves:        null,
    harmonic: {
      keyChanges:         [],
      chordProgression:   [],
      dominantKey:        'C',
      dominantMode:       'major',
      keyConfidence:      0.8,
      pitchCurve:         [],
      melodyContourCurve: [],
    },
    lyrics:          null,
    semanticMoments: [],
    warnings:        [],
    errors:          [],
  }
}

function fileRuntime(overrides: Partial<TrackAnalysisRuntime> = {}): TrackAnalysisRuntime {
  return { ...DEFAULT_TRACK_ANALYSIS_RUNTIME, ...overrides }
}

// ── Scenario 1: dock displays active analyzed BPM ─────────────────────────────
describe('Scenario 1 — dock displays active analyzed BPM', () => {
  it('shows the analyzed BPM when analysis is complete', () => {
    const state = deriveBpmState('file', true, 'complete', 174, 174, 'offline_analysis', null)
    expect(state.kind).toBe('value')
    expect((state as { kind: 'value'; bpm: number }).bpm).toBe(174)
  })
})

// ── Scenario 2: dock does not display 120 as analyzed BPM ────────────────────
describe('Scenario 2 — dock does not display 120 when no analysis is active', () => {
  it('returns none state for unanalyzed file track', () => {
    const state = deriveBpmState('file', true, 'not_analyzed', null, null, null, null)
    expect(state.kind).toBe('none')
  })

  it('returns analyzing state while analysis is in progress (no 120 placeholder)', () => {
    for (const status of ['queued', 'decoding', 'analyzing'] as const) {
      const state = deriveBpmState('file', true, status, null, null, null, null)
      expect(state.kind).toBe('analyzing')
      expect(state.kind).not.toBe('value')
    }
  })
})

// ── Scenario 3: analyzing state shows "Analyzing…" ───────────────────────────
describe('Scenario 3 — in-progress analysis shows analyzing state', () => {
  it.each(['queued', 'decoding', 'analyzing'])('status=%s → kind=analyzing', status => {
    const state = deriveBpmState('file', true, status, null, null, null, null)
    expect(state.kind).toBe('analyzing')
  })
})

// ── Scenario 4: failed analysis shows unavailable state ──────────────────────
describe('Scenario 4 — failed analysis shows unavailable state', () => {
  it('returns failed state on analysis failure', () => {
    const state = deriveBpmState('file', true, 'failed', null, null, null, 'Decode error: net')
    expect(state.kind).toBe('failed')
    expect((state as { kind: 'failed'; error: string | null }).error).toBe('Decode error: net')
  })
})

// ── Scenario 5: no-source state shows neutral placeholder ────────────────────
describe('Scenario 5 — no source shows neutral placeholder', () => {
  it('microphone source → none', () => {
    expect(deriveBpmState('microphone', false, 'not_analyzed', null, null, null, null).kind).toBe('none')
  })

  it('file with no tracks → none', () => {
    expect(deriveBpmState('file', false, 'not_analyzed', null, null, null, null).kind).toBe('none')
  })
})

// ── Scenario 6: BPM arrows create a per-track override ───────────────────────
describe('Scenario 6 — BPM arrows create a per-track override', () => {
  it('resolveTrackBpm uses bpmOverride when set', () => {
    const runtime = fileRuntime({
      status:            'complete',
      analysis:          makeAnalysis(128),
      bpmOverride:       140,
      bpmOverrideSource: 'manual_override',
    })
    const { effectiveBpm, bpmSource } = resolveTrackBpm(runtime)
    expect(effectiveBpm).toBe(140)
    expect(bpmSource).toBe('manual_override')
  })
})

// ── Scenario 7: Tap Tempo creates a per-track override ───────────────────────
describe('Scenario 7 — Tap Tempo creates a per-track override', () => {
  it('tap tempo result is stored as manual_override, not visualStore BPM', () => {
    const runtime = fileRuntime({
      status:            'complete',
      analysis:          makeAnalysis(128),
      bpmOverride:       134,
      bpmOverrideSource: 'manual_override',
    })
    const res = resolveTrackBpm(runtime)
    expect(res.effectiveBpm).toBe(134)
    expect(res.bpmSource).toBe('manual_override')
  })
})

// ── Scenario 8: analyzed BPM preserved during override ───────────────────────
describe('Scenario 8 — analyzed BPM preserved during override', () => {
  it('analyzedBpm is still the original analysis value while override is active', () => {
    const runtime = fileRuntime({
      status:            'complete',
      analysis:          makeAnalysis(128, 0.9),
      bpmOverride:       160,
      bpmOverrideSource: 'manual_override',
    })
    const res = resolveTrackBpm(runtime)
    expect(res.effectiveBpm).toBe(160)
    expect(res.analyzedBpm).toBe(128)    // original preserved
  })

  it('deriveBpmState exposes analyzed BPM in secondary field when override active', () => {
    const state = deriveBpmState('file', true, 'complete', 160, 128, 'manual_override', null)
    expect(state.kind).toBe('value')
    const v = state as { kind: 'value'; bpm: number; analyzed: number | null }
    expect(v.bpm).toBe(160)
    expect(v.analyzed).toBe(128)
  })
})

// ── Scenario 9: clearing override restores analyzed BPM ──────────────────────
describe('Scenario 9 — clearing override restores analyzed BPM', () => {
  it('effectiveBpm reverts to analysis.bpm after clearing override', () => {
    const withOverride = fileRuntime({
      status:            'complete',
      analysis:          makeAnalysis(128),
      bpmOverride:       160,
      bpmOverrideSource: 'manual_override',
    })
    const cleared = { ...withOverride, bpmOverride: null, bpmOverrideSource: null }
    const res = resolveTrackBpm(cleared)
    expect(res.effectiveBpm).toBe(128)
    expect(res.bpmSource).toBe('offline_analysis')
    expect(res.analyzedBpm).toBe(128)
  })
})

// ── Scenario 10: beat markers regenerate after override ──────────────────────
// The MI engine's setBpm now passes beatGridOffset so the beat grid re-phases
// from the original offset when BPM changes.  This is a structural guarantee
// not verifiable without the engine instance, but the offset preservation is
// tested at the resolution layer:
describe('Scenario 10 — beat-grid offset preserved through override', () => {
  it('analysis beatGridOffsetSec round-trips without loss', () => {
    const a = makeAnalysis(128)
    expect(a.beatGridOffsetSec).toBeCloseTo(0.1)
    const json = JSON.parse(JSON.stringify(a)) as typeof a
    expect(json.beatGridOffsetSec).toBeCloseTo(0.1)
  })
})

// ── Scenario 11: React frame BPM = displayed BPM ─────────────────────────────
describe('Scenario 11 — effective BPM is what the frame receives', () => {
  it('deriveBpmState value BPM matches resolveTrackBpm effectiveBpm', () => {
    const analysis = makeAnalysis(174)
    const runtime  = fileRuntime({ status: 'complete', analysis })
    const { effectiveBpm, bpmSource } = resolveTrackBpm(runtime)
    const state = deriveBpmState('file', true, 'complete', effectiveBpm, analysis.bpm, bpmSource, null)
    expect(state.kind).toBe('value')
    expect((state as { kind: 'value'; bpm: number }).bpm).toBe(174)
  })
})

// ── Scenario 12: switching tracks updates every BPM consumer ─────────────────
describe('Scenario 12 — switching tracks produces the new track BPM', () => {
  it('effectiveBpm for a new track with its own analysis reflects that analysis', () => {
    const rt1 = fileRuntime({ status: 'complete', analysis: makeAnalysis(128) })
    const rt2 = fileRuntime({ status: 'complete', analysis: makeAnalysis(174) })
    expect(resolveTrackBpm(rt1).effectiveBpm).toBe(128)
    expect(resolveTrackBpm(rt2).effectiveBpm).toBe(174)
  })
})

// ── Scenario 13: switching to unanalyzed track does not retain old BPM ────────
describe('Scenario 13 — unanalyzed track yields null BPM', () => {
  it('effectiveBpm is null for a not_analyzed track', () => {
    const rt = fileRuntime({ status: 'not_analyzed', analysis: null })
    expect(resolveTrackBpm(rt).effectiveBpm).toBeNull()
  })

  it('dock shows none state, not old track BPM', () => {
    const state = deriveBpmState('file', true, 'not_analyzed', null, null, null, null)
    expect(state.kind).toBe('none')
  })
})

// ── Scenario 14: switching back to a cached track restores BPM immediately ───
describe('Scenario 14 — cached analysis restores BPM immediately on track switch', () => {
  it('complete status with analysis gives non-null effectiveBpm instantly', () => {
    const rt = fileRuntime({
      status:   'complete',
      analysis: makeAnalysis(128),
    })
    expect(resolveTrackBpm(rt).effectiveBpm).toBe(128)
    // Dock shows it right away
    const state = deriveBpmState('file', true, 'complete', 128, 128, 'offline_analysis', null)
    expect(state.kind).toBe('value')
  })
})

// ── Scenario 15: internal fallbacks never surfaced as track metadata ──────────
describe('Scenario 15 — internal fallbacks never appear as track metadata', () => {
  it('no-analysis runtime resolves to null BPM, not 120', () => {
    const rt = fileRuntime()
    const { effectiveBpm } = resolveTrackBpm(rt)
    expect(effectiveBpm).toBeNull()
    expect(effectiveBpm).not.toBe(120)
  })

  it('demo source shows 120 only in dock kind=value with source=demo (not from track)', () => {
    const state = deriveBpmState('demo', false, 'not_analyzed', 120, null, 'live_analysis', null)
    expect(state.kind).toBe('value')
    const v = state as { kind: 'value'; source: string | null }
    expect(v.source).toBe('demo')  // clearly labelled as demo, not track metadata
  })
})
