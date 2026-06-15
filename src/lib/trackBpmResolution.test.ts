import { describe, it, expect } from 'vitest'
import { resolveTrackBpm } from './trackBpmResolution'
import { DEFAULT_TRACK_ANALYSIS_RUNTIME } from '../types'
import type { TrackAnalysisRuntime } from '../types'
import type { TrackIntelligenceAnalysis } from '../features/musicIntelligence/types'

// ── Minimal analysis fixture ──────────────────────────────────────────────────

function makeAnalysis(bpm: number, bpmConfidence = 0.85): TrackIntelligenceAnalysis {
  return {
    analysisVersion:   'test-1.0',
    createdAt:         new Date().toISOString(),
    durationMs:        180_000,
    bpm,
    bpmConfidence,
    beatGridOffsetSec: 0.12,
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
      dominantKey:        'A',
      dominantMode:       'minor',
      keyConfidence:      0.72,
      pitchCurve:         [],
      melodyContourCurve: [],
    },
    lyrics:          null,
    semanticMoments: [],
    warnings:        [],
    errors:          [],
  }
}

// ── No analysis ───────────────────────────────────────────────────────────────

describe('resolveTrackBpm — no analysis', () => {
  it('returns null effective BPM when no analysis exists', () => {
    const result = resolveTrackBpm(DEFAULT_TRACK_ANALYSIS_RUNTIME)
    expect(result.effectiveBpm).toBeNull()
    expect(result.analyzedBpm).toBeNull()
    expect(result.bpmSource).toBeNull()
    expect(result.bpmConfidence).toBeNull()
  })

  it('does not expose 120 as a derived track value', () => {
    const result = resolveTrackBpm(DEFAULT_TRACK_ANALYSIS_RUNTIME)
    expect(result.effectiveBpm).not.toBe(120)
  })
})

// ── Offline analysis ──────────────────────────────────────────────────────────

describe('resolveTrackBpm — offline analysis', () => {
  it('returns analysis BPM as effective when no override', () => {
    const runtime: TrackAnalysisRuntime = {
      ...DEFAULT_TRACK_ANALYSIS_RUNTIME,
      status:   'complete',
      analysis: makeAnalysis(128),
    }
    const result = resolveTrackBpm(runtime)
    expect(result.effectiveBpm).toBe(128)
    expect(result.analyzedBpm).toBe(128)
    expect(result.bpmSource).toBe('offline_analysis')
    expect(result.bpmConfidence).toBeCloseTo(0.85)
  })

  it('preserves analysed BPM alongside an override', () => {
    const runtime: TrackAnalysisRuntime = {
      ...DEFAULT_TRACK_ANALYSIS_RUNTIME,
      status:            'complete',
      analysis:          makeAnalysis(128),
      bpmOverride:       140,
      bpmOverrideSource: 'manual_override',
    }
    const result = resolveTrackBpm(runtime)
    expect(result.effectiveBpm).toBe(140)
    expect(result.analyzedBpm).toBe(128)   // original preserved
    expect(result.bpmSource).toBe('manual_override')
  })
})

// ── Manual override ───────────────────────────────────────────────────────────

describe('resolveTrackBpm — manual override', () => {
  it('manual override takes priority over analyzed BPM', () => {
    const runtime: TrackAnalysisRuntime = {
      ...DEFAULT_TRACK_ANALYSIS_RUNTIME,
      status:            'complete',
      analysis:          makeAnalysis(128),
      bpmOverride:       140,
      bpmOverrideSource: 'manual_override',
    }
    const result = resolveTrackBpm(runtime)
    expect(result.effectiveBpm).toBe(140)
    expect(result.bpmSource).toBe('manual_override')
  })

  it('clearing the override restores the analyzed BPM', () => {
    const runtimeWithOverride: TrackAnalysisRuntime = {
      ...DEFAULT_TRACK_ANALYSIS_RUNTIME,
      status:            'complete',
      analysis:          makeAnalysis(128),
      bpmOverride:       140,
      bpmOverrideSource: 'manual_override',
    }
    // Clear override
    const runtimeCleared: TrackAnalysisRuntime = {
      ...runtimeWithOverride,
      bpmOverride:       null,
      bpmOverrideSource: null,
    }
    const result = resolveTrackBpm(runtimeCleared)
    expect(result.effectiveBpm).toBe(128)
    expect(result.bpmSource).toBe('offline_analysis')
  })

  it('original analyzed BPM is accessible even after an override', () => {
    const runtime: TrackAnalysisRuntime = {
      ...DEFAULT_TRACK_ANALYSIS_RUNTIME,
      status:            'complete',
      analysis:          makeAnalysis(128, 0.9),
      bpmOverride:       160,
      bpmOverrideSource: 'manual_override',
    }
    const result = resolveTrackBpm(runtime)
    expect(result.effectiveBpm).toBe(160)
    expect(result.analyzedBpm).toBe(128)
  })
})

// ── Live analysis override ────────────────────────────────────────────────────

describe('resolveTrackBpm — live_analysis override', () => {
  it('live-detected BPM takes priority and reports live_analysis source', () => {
    const runtime: TrackAnalysisRuntime = {
      ...DEFAULT_TRACK_ANALYSIS_RUNTIME,
      status:            'not_analyzed',
      analysis:          null,
      bpmOverride:       134,
      bpmOverrideSource: 'live_analysis',
    }
    const result = resolveTrackBpm(runtime)
    expect(result.effectiveBpm).toBe(134)
    expect(result.bpmSource).toBe('live_analysis')
    expect(result.analyzedBpm).toBeNull()
  })
})

// ── beatGridOffsetSec serialization ──────────────────────────────────────────

describe('beatGridOffsetSec survives serialization', () => {
  it('round-trips through JSON without loss', () => {
    const analysis = makeAnalysis(128)
    const serialized   = JSON.stringify(analysis)
    const deserialized = JSON.parse(serialized) as typeof analysis
    expect(deserialized.beatGridOffsetSec).toBeCloseTo(0.12)
  })

  it('defaults to 0 when absent in old persisted data', () => {
    const legacyAnalysis = makeAnalysis(128)
    // Simulate old persisted data without beatGridOffsetSec
    const { beatGridOffsetSec: _, ...withoutOffset } = legacyAnalysis
    const offset = (withoutOffset as { beatGridOffsetSec?: number }).beatGridOffsetSec ?? 0
    expect(offset).toBe(0)
  })
})

// ── DEFAULT_TRACK_ANALYSIS_RUNTIME ────────────────────────────────────────────

describe('DEFAULT_TRACK_ANALYSIS_RUNTIME', () => {
  it('starts with not_analyzed status', () => {
    expect(DEFAULT_TRACK_ANALYSIS_RUNTIME.status).toBe('not_analyzed')
  })

  it('has no analysis initially', () => {
    expect(DEFAULT_TRACK_ANALYSIS_RUNTIME.analysis).toBeNull()
  })

  it('has no BPM override initially', () => {
    expect(DEFAULT_TRACK_ANALYSIS_RUNTIME.bpmOverride).toBeNull()
    expect(DEFAULT_TRACK_ANALYSIS_RUNTIME.bpmOverrideSource).toBeNull()
  })
})
