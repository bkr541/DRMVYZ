import { describe, expect, it } from 'vitest'
import type { TrackIntelligenceAnalysis } from '../../../../features/musicIntelligence/types'
import type { RgbWaveformAnalysis } from '../../../../features/waveform/rgbWaveformTypes'
import { buildTrackTimelineModel } from './trackTimelineModel'

function candidate(id: string, timeSec: number, selected: boolean) {
  return {
    id,
    timeSec,
    selected,
    reason: id,
    candidateConfidence: 0.8,
    totalScore: 0.7,
  }
}

const analysis = {
  analysisVersion: 'auto-test',
  durationMs: 8_000,
  bpm: 120,
  bpmUsedForGrid: 120,
  timeSignature: 4,
  beatGrid: [
    { timeSec: 0, beatIndex: 0, barIndex: 0, beatWithinBar: 0, isDownbeat: true, bpm: 120, confidence: 1, gridConfidence: 1 },
    { timeSec: 0.5, beatIndex: 1, barIndex: 0, beatWithinBar: 1, isDownbeat: false, bpm: 120, confidence: 1, gridConfidence: 1 },
  ],
  barMarkers: [{ barIndex: 0, startSec: 0, endSec: 2, gridConfidence: 1 }],
  barFeatures: [],
  sections: [{ id: 'section-1', label: 'Intro', type: 'intro', startSec: 0, endSec: 4, intensity: 0.25, confidence: 0.9 }],
  phrases: [{ id: 'phrase-1', timeSec: 0, lengthBars: 4, confidence: 0.8 }],
  semanticMoments: [],
  structuralSegmentation: {
    boundaryCandidates: [candidate('selected', 2, true), candidate('candidate', 3, false)],
    alternativeBoundaryCandidates: [candidate('alternative', 4, false)],
  },
  boundaryAlternatives: [{ id: 'ranked', timeSec: 5, reason: 'ranked', confidence: 0.6, rank: 1 }],
  energyCurves: {
    instant: [{ timeSec: 0, value: 0.1 }, { timeSec: 4, value: 0.8 }],
    shortTerm: [],
    bass: [],
    mid: [],
    high: [],
  },
  spectralCurves: { centroid: [], flux: [], complexity: [] },
  harmonic: {
    dominantKey: 'C',
    dominantMode: 'major',
    keyConfidence: 0.75,
    pitchCurve: [],
    melodyContourCurve: [],
  },
  warnings: [],
  errors: [],
  analysisWarnings: [],
} as unknown as TrackIntelligenceAnalysis

const rgbWaveform: RgbWaveformAnalysis = {
  version: 1,
  durationSec: 8,
  sampleRate: 48_000,
  binCount: 2,
  positivePeaks: new Float32Array([0.4, 0.8]),
  negativePeaks: new Float32Array([-0.3, -0.6]),
  rms: new Float32Array([0.2, 0.5]),
  lowEnergy: new Float32Array([0.7, 0.3]),
  midEnergy: new Float32Array([0.4, 0.6]),
  highEnergy: new Float32Array([0.1, 0.9]),
}

describe('buildTrackTimelineModel', () => {
  it('uses the loaded DRMVYZ analysis and RGB waveform without an import schema', () => {
    const model = buildTrackTimelineModel({
      analysis,
      rgbWaveform,
      filename: 'test.wav',
      channels: 2,
    })

    expect(model.meta).toMatchObject({
      filename: 'test.wav',
      bpm: 120,
      dominantKey: 'C major',
      sampleRate: 48_000,
      channels: 2,
      analysisVersion: 'auto-test',
    })
    expect(model.beats).toHaveLength(2)
    expect(model.sections).toHaveLength(1)
    expect(model.waveform).toHaveLength(2)
    expect(model.waveform[0]?.negative).toBeCloseTo(0.3)
    expect(model.curves['energyCurves.instant']).toHaveLength(2)
  })

  it('does not promote unselected structural candidates to selected boundaries', () => {
    const model = buildTrackTimelineModel({ analysis, rgbWaveform, filename: 'test.wav' })
    const counts = model.structuralBoundaries.reduce<Record<string, number>>((result, item) => {
      result[item.type] = (result[item.type] ?? 0) + 1
      return result
    }, {})

    expect(counts).toEqual({
      selected_boundary: 1,
      boundary_candidate: 1,
      alternative_boundary: 1,
      ranked_boundary_alternative: 1,
    })
    expect(model.timelineEvents.filter(item => item.type === 'selected_boundary')).toHaveLength(1)
  })
})
