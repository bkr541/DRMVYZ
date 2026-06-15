import { describe, it, expect } from 'vitest'
import { adaptTrackSections, extractBpm, resolveTrackSections } from '../trackMapAdapter'
import { generateMockTrackAnalysis } from '../mockTrackAnalysis'
import type { TrackAnalysis } from '../types'
import type { ReactTrackSection } from '../../../components/vyzualz/react/ReactTypes'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSection(overrides: Partial<ReactTrackSection> = {}): ReactTrackSection {
  return {
    id:        'sec-1',
    label:     'Intro',
    type:      'intro',
    startSec:  0,
    endSec:    30,
    intensity: 0.4,
    source:    'auto',
    ...overrides,
  }
}

// ── adaptTrackSections ────────────────────────────────────────────────────────

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

// ── extractBpm ────────────────────────────────────────────────────────────────

describe('extractBpm', () => {
  it('returns the bpm from a valid analysis', () => {
    const analysis = generateMockTrackAnalysis(180000, 140)
    expect(extractBpm(analysis)).toBe(140)
  })

  it('returns null when bpm is 0 — no 120 fallback', () => {
    const analysis: TrackAnalysis = {
      durationMs: 60000, bpm: 0, timeSignature: 4,
      sections: [], beatMarkers: [], analysisVersion: 'test',
    }
    expect(extractBpm(analysis)).toBeNull()
  })

  it('returns null for negative bpm', () => {
    const analysis: TrackAnalysis = {
      durationMs: 60000, bpm: -1, timeSignature: 4,
      sections: [], beatMarkers: [], analysisVersion: 'test',
    }
    expect(extractBpm(analysis)).toBeNull()
  })
})

// ── generateMockTrackAnalysis ─────────────────────────────────────────────────

describe('generateMockTrackAnalysis', () => {
  it('generates sections that span the full duration without gaps', () => {
    const durationMs = 200000
    const analysis = generateMockTrackAnalysis(durationMs)
    const { sections } = analysis

    expect(sections.length).toBeGreaterThan(0)
    expect(sections[0].startMs).toBe(0)
    expect(sections[sections.length - 1].endMs).toBe(durationMs)

    for (let i = 1; i < sections.length; i++) {
      expect(sections[i].startMs).toBe(sections[i - 1].endMs)
    }
  })

  it('returns beat markers at approximately the right interval', () => {
    const bpm = 120
    const durationMs = 10000
    const analysis = generateMockTrackAnalysis(durationMs, bpm)
    const expectedPeriod = 60000 / bpm
    expect(analysis.beatMarkers.length).toBeGreaterThan(0)
    expect(analysis.beatMarkers[0].timeMs).toBe(0)
    expect(analysis.beatMarkers[1].timeMs).toBeCloseTo(expectedPeriod, -1)
  })

  it('sets the analysisVersion to mock-1.0', () => {
    const analysis = generateMockTrackAnalysis(60000)
    expect(analysis.analysisVersion).toBe('mock-1.0')
  })
})

// ── resolveTrackSections ──────────────────────────────────────────────────────

describe('resolveTrackSections', () => {
  it('returns analyzed sections unchanged when no manual sections exist', () => {
    const analyzed = [
      makeSection({ id: 'a', type: 'intro', startSec: 0,  endSec: 30,  source: 'auto' }),
      makeSection({ id: 'b', type: 'drop',  startSec: 30, endSec: 90,  source: 'auto' }),
    ]
    const result = resolveTrackSections({ analyzedSections: analyzed, manualSections: [], durationSec: 90 })
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('a')
    expect(result[1].id).toBe('b')
  })

  it('user-edited-auto overrides the analyzed section with matching ID', () => {
    const analyzed = [
      makeSection({ id: 'sec-1', type: 'intro',    startSec: 0, endSec: 30, source: 'auto' }),
      makeSection({ id: 'sec-2', type: 'verse',    startSec: 30, endSec: 60, source: 'auto' }),
    ]
    const manual = [
      makeSection({ id: 'sec-1', type: 'drop', label: 'Edited!', startSec: 0, endSec: 30, source: 'user-edited-auto' }),
    ]
    const result = resolveTrackSections({ analyzedSections: analyzed, manualSections: manual, durationSec: 60 })
    expect(result).toHaveLength(2)
    // Edited section replaces the auto one
    expect(result[0].type).toBe('drop')
    expect(result[0].label).toBe('Edited!')
    // Unchanged auto section remains
    expect(result[1].id).toBe('sec-2')
    expect(result[1].type).toBe('verse')
  })

  it('user-created sections are appended after analyzed sections', () => {
    const analyzed = [makeSection({ id: 'auto-1', type: 'intro', startSec: 0, endSec: 30, source: 'auto' })]
    const manual   = [makeSection({ id: 'usr-1',  type: 'build', startSec: 45, endSec: 60, source: 'user-created' })]
    const result = resolveTrackSections({ analyzedSections: analyzed, manualSections: manual, durationSec: 60 })
    expect(result).toHaveLength(2)
    expect(result[0].source).toBe('auto')
    expect(result[1].source).toBe('user-created')
  })

  it('sections are sorted by startSec', () => {
    const analyzed = [
      makeSection({ id: 'b', startSec: 30, endSec: 60, source: 'auto' }),
      makeSection({ id: 'a', startSec: 0,  endSec: 30, source: 'auto' }),
    ]
    const result = resolveTrackSections({ analyzedSections: analyzed, manualSections: [], durationSec: 60 })
    expect(result[0].id).toBe('a')
    expect(result[1].id).toBe('b')
  })

  it('clips sections to durationSec', () => {
    const analyzed = [makeSection({ id: 'a', startSec: 0, endSec: 200, source: 'auto' })]
    const result = resolveTrackSections({ analyzedSections: analyzed, manualSections: [], durationSec: 180 })
    expect(result[0].endSec).toBe(180)
  })

  it('excludes sections that start at or after durationSec', () => {
    const analyzed = [makeSection({ id: 'a', startSec: 200, endSec: 240, source: 'auto' })]
    const result = resolveTrackSections({ analyzedSections: analyzed, manualSections: [], durationSec: 180 })
    expect(result).toHaveLength(0)
  })

  it('returns all sections unsorted when durationSec is 0', () => {
    const analyzed = [makeSection({ id: 'a', startSec: 0, endSec: 30, source: 'auto' })]
    const result = resolveTrackSections({ analyzedSections: analyzed, manualSections: [], durationSec: 0 })
    expect(result).toHaveLength(1)
  })

  it('original analysis is never mutated', () => {
    const analyzed = [makeSection({ id: 'a', source: 'auto' })]
    const manual   = [makeSection({ id: 'a', type: 'drop', source: 'user-edited-auto' })]
    const before   = analyzed[0].type
    resolveTrackSections({ analyzedSections: analyzed, manualSections: manual, durationSec: 60 })
    expect(analyzed[0].type).toBe(before)
  })

  it('manual-only sections work when no analyzed sections exist', () => {
    const manual = [makeSection({ id: 'm', type: 'build', source: 'user-created', startSec: 0, endSec: 30 })]
    const result = resolveTrackSections({ analyzedSections: [], manualSections: manual, durationSec: 60 })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('m')
  })

  it('user-edited-auto sections are NOT appended as duplicates', () => {
    const analyzed = [makeSection({ id: 'a', source: 'auto' })]
    const manual   = [makeSection({ id: 'a', type: 'drop', source: 'user-edited-auto' })]
    const result = resolveTrackSections({ analyzedSections: analyzed, manualSections: manual, durationSec: 60 })
    // Only one section: the override replaces the original, not appended
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('drop')
  })
})
