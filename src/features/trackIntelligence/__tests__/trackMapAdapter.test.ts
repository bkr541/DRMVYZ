import { describe, it, expect } from 'vitest'
import { adaptTrackSections, extractBpm } from '../trackMapAdapter'
import { generateMockTrackAnalysis } from '../mockTrackAnalysis'
import type { TrackAnalysis } from '../types'

describe('adaptTrackSections', () => {
  it('converts milliseconds to seconds', () => {
    const analysis: TrackAnalysis = {
      durationMs: 180000,
      bpm: 128,
      timeSignature: 4,
      sections: [
        { id: 'a', label: 'Intro', type: 'intro', startMs: 0, endMs: 18000, intensity: 0.35 },
        { id: 'b', label: 'Drop',  type: 'drop',  startMs: 18000, endMs: 54000, intensity: 1.0 },
      ],
      beatMarkers: [],
      analysisVersion: 'test',
    }

    const result = adaptTrackSections(analysis)
    expect(result).toHaveLength(2)
    expect(result[0].startSec).toBe(0)
    expect(result[0].endSec).toBe(18)
    expect(result[1].startSec).toBe(18)
    expect(result[1].endSec).toBe(54)
  })

  it('preserves id, label, type, and intensity', () => {
    const analysis: TrackAnalysis = {
      durationMs: 60000,
      bpm: 120,
      timeSignature: 4,
      sections: [{ id: 'sec-1', label: 'Verse 1', type: 'verse', startMs: 5000, endMs: 25000, intensity: 0.6 }],
      beatMarkers: [],
      analysisVersion: 'test',
    }
    const [sec] = adaptTrackSections(analysis)
    expect(sec.id).toBe('sec-1')
    expect(sec.label).toBe('Verse 1')
    expect(sec.type).toBe('verse')
    expect(sec.intensity).toBe(0.6)
  })

  it('returns empty array for analysis with no sections', () => {
    const analysis: TrackAnalysis = {
      durationMs: 60000, bpm: 120, timeSignature: 4,
      sections: [], beatMarkers: [], analysisVersion: 'test',
    }
    expect(adaptTrackSections(analysis)).toEqual([])
  })
})

describe('extractBpm', () => {
  it('returns the bpm from a valid analysis', () => {
    const analysis = generateMockTrackAnalysis(180000, 140)
    expect(extractBpm(analysis)).toBe(140)
  })

  it('returns 120 when bpm is 0', () => {
    const analysis: TrackAnalysis = {
      durationMs: 60000, bpm: 0, timeSignature: 4,
      sections: [], beatMarkers: [], analysisVersion: 'test',
    }
    expect(extractBpm(analysis)).toBe(120)
  })
})

describe('generateMockTrackAnalysis', () => {
  it('generates sections that span the full duration without gaps', () => {
    const durationMs = 200000
    const analysis = generateMockTrackAnalysis(durationMs)
    const { sections } = analysis

    expect(sections.length).toBeGreaterThan(0)
    expect(sections[0].startMs).toBe(0)
    expect(sections[sections.length - 1].endMs).toBe(durationMs)

    // No gaps between sections
    for (let i = 1; i < sections.length; i++) {
      expect(sections[i].startMs).toBe(sections[i - 1].endMs)
    }
  })

  it('returns beat markers at approximately the right interval', () => {
    const bpm = 120
    const durationMs = 10000
    const analysis = generateMockTrackAnalysis(durationMs, bpm)
    const expectedPeriod = 60000 / bpm  // 500ms
    expect(analysis.beatMarkers.length).toBeGreaterThan(0)
    // First marker should be at t=0
    expect(analysis.beatMarkers[0].timeMs).toBe(0)
    // Second marker should be ~500ms later
    expect(analysis.beatMarkers[1].timeMs).toBeCloseTo(expectedPeriod, -1)
  })

  it('sets the analysisVersion to mock-1.0', () => {
    const analysis = generateMockTrackAnalysis(60000)
    expect(analysis.analysisVersion).toBe('mock-1.0')
  })
})
