import { describe, expect, it } from 'vitest'
import { detectSemanticMoments } from '../semanticAnalysis'
import type { TrackIntelligenceAnalysis, TrackSectionMI } from '../types'

function section(id: string, type: TrackSectionMI['type'], startSec: number, endSec: number): TrackSectionMI {
  return {
    id,
    type,
    label: type,
    startSec,
    endSec,
    intensity: type === 'drop' ? 1 : 0.55,
    confidence: 0.88,
    boundaryConfidence: 0.86,
    labelConfidence: 0.9,
    dropConfidence: type === 'drop' ? 0.92 : 0,
    source: 'analysis',
    interpretation: {
      startBar: Math.round(startSec / 2),
      endBar: Math.round(endSec / 2),
      durationBars: Math.round((endSec - startSec) / 2),
    },
  }
}

function makeAnalysis(): TrackIntelligenceAnalysis {
  const instant = [
    { timeSec: 0, value: 0.2 },
    { timeSec: 8.5, value: 0.24 },
    { timeSec: 10, value: 1 },
    { timeSec: 11.5, value: 0.86 },
    { timeSec: 20, value: 0.52 },
    { timeSec: 22, value: 0.2 },
    { timeSec: 40, value: 0.18 },
  ]
  const bass = instant.map(point => ({ ...point, value: point.timeSec === 10 ? 0.98 : Math.min(0.7, point.value) }))
  return {
    analysisVersion: 'auto-4.0', createdAt: '2026-07-13T00:00:00.000Z', durationMs: 40_000,
    bpm: 120, bpmConfidence: 0.9, beatGridOffsetSec: 0, timeSignature: 4,
    beatGrid: [],
    downbeats: Array.from({ length: 21 }, (_, barIndex) => ({ timeSec: barIndex * 2, confidence: 0.9, isDownbeat: true, barIndex })),
    phrases: [],
    sections: [
      section('build', 'build', 0, 8),
      section('predrop', 'preDrop', 8, 10),
      section('drop', 'drop', 10, 20),
      section('breakdown', 'breakdown', 20, 30),
      section('outro', 'outro', 30, 40),
    ],
    energyCurves: { instant, shortTerm: instant, bass, mid: instant, high: instant },
    spectralCurves: { centroid: [], flux: [], complexity: [] },
    stemCurves: null,
    harmonic: { keyChanges: [], chordProgression: [], dominantKey: null, dominantMode: null, keyConfidence: 0, pitchCurve: [], melodyContourCurve: [] },
    lyrics: null, semanticMoments: [], warnings: [], errors: [],
  }
}

describe('semantic moment detection', () => {
  it('creates an evidence-backed Drop impact aligned to the related section', () => {
    const moments = detectSemanticMoments(makeAnalysis())
    const drop = moments.find(moment => moment.type === 'drop_impact')

    expect(drop).toMatchObject({ timeSec: 10, relatedSectionId: 'drop', source: 'section_context' })
    expect(drop?.confidence).toBeGreaterThan(0.7)
    expect(drop?.supportingSignals).toContain('drop classification')
    expect(drop?.barIndex).toBe(5)
  })

  it('suppresses duplicate impact moments at nearly the same event', () => {
    const moments = detectSemanticMoments(makeAnalysis())
    const impacts = moments.filter(moment => (
      (moment.type === 'drop_impact' || moment.type === 'major_impact')
      && Math.abs(moment.timeSec - 10) <= 0.75
    ))

    expect(impacts).toHaveLength(1)
  })
})
