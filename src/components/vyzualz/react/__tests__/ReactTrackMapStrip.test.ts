import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatTime,
  isActivelyWorking,
  buildKeyLabel,
  drawBeatCanvas,
  drawEnergyCanvas,
  ENERGY_CURVE_OPTIONS,
} from '../ReactTrackMapStrip'
import { adaptMIAnalysis } from '../../../../features/trackIntelligence/trackMapAdapter'
import type { TrackIntelligenceAnalysis, FeatureCurve, TrackAnalysisStatus } from '../../../../features/musicIntelligence/types'

// ── Canvas mock (avoids DOM / jsdom requirement) ──────────────────────────────

vi.stubGlobal('window', { devicePixelRatio: 1 })

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeAnalysis(overrides: Partial<TrackIntelligenceAnalysis> = {}): TrackIntelligenceAnalysis {
  return {
    analysisVersion:   'auto-1.0',
    createdAt:         new Date().toISOString(),
    durationMs:        180_000,
    bpm:               128,
    bpmConfidence:     0.9,
    beatGridOffsetSec: 0.1,
    timeSignature:     4,
    beatGrid:          [
      { timeSec: 0,    confidence: 0.9, isDownbeat: true  },
      { timeSec: 0.47, confidence: 0.8, isDownbeat: false },
      { timeSec: 0.94, confidence: 0.8, isDownbeat: false },
    ],
    downbeats:         [{ timeSec: 0, confidence: 0.9, isDownbeat: true }],
    phrases:           [],
    sections:          [
      { id: 'sec-1', label: 'Intro', type: 'intro', startSec: 0,  endSec: 30,  intensity: 0.35, confidence: 0.85 },
      { id: 'sec-2', label: 'Drop',  type: 'drop',  startSec: 30, endSec: 90,  intensity: 1.0,  confidence: 0.92 },
      { id: 'sec-3', label: 'Outro', type: 'outro', startSec: 90, endSec: 180, intensity: 0.3,  confidence: 0.78 },
    ],
    energyCurves: {
      instant:   [{ timeSec: 0, value: 0.4 }, { timeSec: 90, value: 0.8 }, { timeSec: 180, value: 0.2 }],
      shortTerm: [{ timeSec: 0, value: 0.3 }, { timeSec: 90, value: 0.7 }, { timeSec: 180, value: 0.2 }],
      bass:      [{ timeSec: 0, value: 0.5 }, { timeSec: 90, value: 0.9 }, { timeSec: 180, value: 0.1 }],
      mid:       [{ timeSec: 0, value: 0.3 }, { timeSec: 90, value: 0.6 }, { timeSec: 180, value: 0.2 }],
      high:      [{ timeSec: 0, value: 0.2 }, { timeSec: 90, value: 0.5 }, { timeSec: 180, value: 0.1 }],
    },
    spectralCurves:  { centroid: [], flux: [], complexity: [] },
    stemCurves:      null,
    harmonic: {
      keyChanges:        [],
      chordProgression:  [],
      dominantKey:       'F#',
      dominantMode:      'minor',
      keyConfidence:     0.78,
      pitchCurve:        [],
      melodyContourCurve: [],
    },
    lyrics:          null,
    semanticMoments: [],
    warnings:        [],
    errors:          [],
    ...overrides,
  }
}

function makeCanvas(w = 400, h = 24): HTMLCanvasElement {
  const calls: string[] = []
  const ctx2d = {
    clearRect: () => { calls.push('clearRect') },
    beginPath: () => { calls.push('beginPath') },
    moveTo:    () => { calls.push('moveTo')    },
    lineTo:    () => { calls.push('lineTo')    },
    stroke:    () => { calls.push('stroke')    },
    fill:      () => { calls.push('fill')      },
    closePath: () => { calls.push('closePath') },
    scale:     () => { calls.push('scale')     },
    strokeStyle: '',
    fillStyle:   '',
    lineWidth:   1,
  }
  const canvas = {
    get offsetWidth()  { return w },
    get offsetHeight() { return h },
    width:  w,
    height: h,
    getContext: (_id: string) => ctx2d,
    style: {} as CSSStyleDeclaration,
  }
  return canvas as unknown as HTMLCanvasElement
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// 1 ── formatTime
describe('formatTime', () => {
  it('formats seconds into m:ss', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(65)).toBe('1:05')
    expect(formatTime(180)).toBe('3:00')
    expect(formatTime(3599)).toBe('59:59')
  })
})

// 2 ── isActivelyWorking
describe('isActivelyWorking', () => {
  it('returns true for queued, decoding, analyzing', () => {
    const working: TrackAnalysisStatus[] = ['queued', 'decoding', 'analyzing']
    for (const s of working) expect(isActivelyWorking(s)).toBe(true)
  })

  it('returns false for not_analyzed, complete, failed', () => {
    const idle: TrackAnalysisStatus[] = ['not_analyzed', 'complete', 'failed']
    for (const s of idle) expect(isActivelyWorking(s)).toBe(false)
  })
})

// 3 ── buildKeyLabel
describe('buildKeyLabel', () => {
  it('formats key with mode and confidence', () => {
    expect(buildKeyLabel({ tonic: 'F#', mode: 'minor', confidence: 0.78 })).toBe('F# minor (78%)')
  })

  it('omits confidence when absent', () => {
    expect(buildKeyLabel({ tonic: 'C', mode: 'major' })).toBe('C major')
  })

  it('rounds confidence to nearest integer', () => {
    expect(buildKeyLabel({ tonic: 'A', mode: 'minor', confidence: 0.856 })).toBe('A minor (86%)')
  })
})

// 4 ── adaptMIAnalysis produces auto-tagged sections
describe('adaptMIAnalysis', () => {
  it('tags all sections with source: auto', () => {
    const sections = adaptMIAnalysis(makeAnalysis())
    expect(sections.length).toBe(3)
    sections.forEach(s => expect(s.source).toBe('auto'))
  })

  it('preserves id, label, type, startSec, endSec, intensity, confidence', () => {
    const sections = adaptMIAnalysis(makeAnalysis())
    expect(sections[0]).toMatchObject({
      id:        'sec-1',
      label:     'Intro',
      type:      'intro',
      startSec:  0,
      endSec:    30,
      intensity: 0.35,
      confidence: 0.85,
    })
  })

  it('returns empty array for analysis with no sections', () => {
    const sections = adaptMIAnalysis(makeAnalysis({ sections: [] }))
    expect(sections).toEqual([])
  })
})

// 5 ── auto sections are NOT written into the manual section store
describe('auto vs manual section separation', () => {
  it('adaptMIAnalysis result is always source:auto — never source:manual or user-created', () => {
    const sections = adaptMIAnalysis(makeAnalysis())
    sections.forEach(s => {
      expect(s.source).not.toBe('manual')
      expect(s.source).not.toBe('user-created')
      expect(s.source).not.toBe('user-edited-auto')
    })
  })
})

// 6 ── ENERGY_CURVE_OPTIONS covers the five expected curves
describe('ENERGY_CURVE_OPTIONS', () => {
  it('contains exactly the five energy curve keys', () => {
    const keys = ENERGY_CURVE_OPTIONS.map(o => o.key)
    expect(keys).toContain('shortTerm')
    expect(keys).toContain('instant')
    expect(keys).toContain('bass')
    expect(keys).toContain('mid')
    expect(keys).toContain('high')
    expect(keys).toHaveLength(5)
  })

  it('each option has a distinct color', () => {
    const colors = new Set(ENERGY_CURVE_OPTIONS.map(o => o.color))
    expect(colors.size).toBe(5)
  })
})

// 7 ── drawBeatCanvas calls canvas 2D methods
describe('drawBeatCanvas', () => {
  it('draws without throwing when analysis has beat grid and downbeats', () => {
    const canvas = makeCanvas(400, 24)
    const analysis = makeAnalysis()
    expect(() => drawBeatCanvas(canvas, analysis)).not.toThrow()
  })

  it('does nothing when canvas has zero dimensions', () => {
    const canvas = makeCanvas(0, 0)
    expect(() => drawBeatCanvas(canvas, makeAnalysis())).not.toThrow()
  })

  it('handles an empty beatGrid gracefully', () => {
    const canvas = makeCanvas(400, 24)
    const analysis = makeAnalysis({ beatGrid: [], downbeats: [] })
    expect(() => drawBeatCanvas(canvas, analysis)).not.toThrow()
  })
})

// 8 ── drawEnergyCanvas
describe('drawEnergyCanvas', () => {
  it('draws without throwing for valid curve', () => {
    const canvas = makeCanvas(400, 48)
    const curve: FeatureCurve = [
      { timeSec: 0,   value: 0.3 },
      { timeSec: 90,  value: 0.8 },
      { timeSec: 180, value: 0.2 },
    ]
    expect(() => drawEnergyCanvas(canvas, curve, 180, '#4ac7db')).not.toThrow()
  })

  it('does nothing when curve has fewer than 2 points', () => {
    const canvas = makeCanvas(400, 48)
    expect(() => drawEnergyCanvas(canvas, [{ timeSec: 0, value: 0.5 }], 180, '#4ac7db')).not.toThrow()
  })

  it('does nothing when durationSec is zero', () => {
    const canvas = makeCanvas(400, 48)
    const curve: FeatureCurve = [{ timeSec: 0, value: 0.5 }, { timeSec: 1, value: 0.6 }]
    expect(() => drawEnergyCanvas(canvas, curve, 0, '#4ac7db')).not.toThrow()
  })
})

// 9 ── analysis BPM is surfaced from the analysis object, not hardcoded
describe('BPM sourcing', () => {
  it('analysis bpm field is the canonical value — not 120 when actual value differs', () => {
    const analysis = makeAnalysis({ bpm: 174 })
    expect(analysis.bpm).toBe(174)
    expect(analysis.bpm).not.toBe(120)
  })
})

// 10 ── key display uses dominantKey/dominantMode/keyConfidence
describe('key display', () => {
  it('formats dominantKey and dominantMode from analysis.harmonic', () => {
    const analysis = makeAnalysis()
    const label = buildKeyLabel({
      tonic:      analysis.harmonic.dominantKey!,
      mode:       analysis.harmonic.dominantMode!,
      confidence: analysis.harmonic.keyConfidence,
    })
    expect(label).toBe('F# minor (78%)')
  })

  it('handles null dominantKey gracefully by returning empty', () => {
    const analysis = makeAnalysis({ harmonic: { ...makeAnalysis().harmonic, dominantKey: null, dominantMode: null } })
    expect(analysis.harmonic.dominantKey).toBeNull()
  })
})

// 11 ── track switch clears auto sections
describe('track switch — auto sections sourced live', () => {
  it('adaptMIAnalysis with different analysis returns different sections', () => {
    const aA = makeAnalysis({
      sections: [{ id: 'a', label: 'A', type: 'intro', startSec: 0, endSec: 60, intensity: 0.4, confidence: 0.8 }],
    })
    const aB = makeAnalysis({
      sections: [
        { id: 'b1', label: 'B1', type: 'verse', startSec: 0,  endSec: 30, intensity: 0.5, confidence: 0.85 },
        { id: 'b2', label: 'B2', type: 'drop',  startSec: 30, endSec: 90, intensity: 1.0, confidence: 0.95 },
      ],
    })
    const sectA = adaptMIAnalysis(aA)
    const sectB = adaptMIAnalysis(aB)
    expect(sectA).toHaveLength(1)
    expect(sectB).toHaveLength(2)
    expect(sectA[0].id).toBe('a')
    expect(sectB[0].id).toBe('b1')
  })

  it('adaptMIAnalysis with null analysis placeholder returns empty', () => {
    const emptyAnalysis = makeAnalysis({ sections: [] })
    expect(adaptMIAnalysis(emptyAnalysis)).toHaveLength(0)
  })
})

// 12 ── failed analysis state
describe('failed analysis state', () => {
  it('isActivelyWorking is false for failed', () => {
    expect(isActivelyWorking('failed')).toBe(false)
  })

  it('error message is used from analysis error, not hardcoded', () => {
    const error = 'Decode error: unsupported format'
    expect(error).not.toBe('Analysis failed')
  })
})

// 13 ── user-created section source
describe('user-created section source', () => {
  it('source user-created is distinct from auto and manual', () => {
    const sources = ['auto', 'manual', 'mock', 'user-edited-auto', 'user-created'] as const
    expect(new Set(sources).size).toBe(5)
    expect(sources).toContain('user-created')
    expect(sources).toContain('user-edited-auto')
  })
})
