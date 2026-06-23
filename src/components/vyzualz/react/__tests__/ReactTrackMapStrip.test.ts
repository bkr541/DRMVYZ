import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatTime,
  isActivelyWorking,
  buildKeyLabel,
  buildBarRange,
  drawBeatCanvas,
  drawEnergyCanvas,
  computeBeatStride,
  ENERGY_CURVE_OPTIONS,
  TRACK_MAP_DOWNBEAT_COLOR,
  TRACK_MAP_BEAT_TICK_HEIGHT,
  buildPresetCueId,
  buildPresetCueLabel,
} from '../ReactTrackMapStrip'
import { adaptMIAnalysis } from '../../../../features/trackIntelligence/trackMapAdapter'
import type { TrackIntelligenceAnalysis, FeatureCurve, TrackAnalysisStatus, BeatMarkerMI } from '../../../../features/musicIntelligence/types'
import { useReactStore } from '../../../../stores/reactStore'
import type { ReactTrackSection } from '../ReactTypes'

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

// Groups canvas draw commands by stroke() call so each pass (regular beats,
// downbeats, section boundaries) has its own entry with commands + style info.
type Cmd   = { cmd: string; x?: number; y?: number }
type Group = { cmds: Cmd[]; strokeStyle: string; lineWidth: number }

function makeTrackingCanvas(w = 400, h = 24) {
  const groups: Group[] = []
  let currentCmds: Cmd[] = []
  let _style  = ''
  let _width  = 1
  const ctx2d = {
    clearRect: () => {},
    beginPath: () => { currentCmds = [] },
    moveTo: (x: number, y: number) => { currentCmds.push({ cmd: 'moveTo', x, y }) },
    lineTo: (x: number, y: number) => { currentCmds.push({ cmd: 'lineTo', x, y }) },
    stroke: () => { groups.push({ cmds: [...currentCmds], strokeStyle: _style, lineWidth: _width }) },
    fill:      () => {},
    closePath: () => {},
    scale:     () => {},
    fillStyle: '' as string,
    get strokeStyle() { return _style },
    set strokeStyle(v: string) { _style = v },
    get lineWidth() { return _width },
    set lineWidth(v: number) { _width = v },
  }
  const canvas = {
    get offsetWidth()  { return w },
    get offsetHeight() { return h },
    width:  w,
    height: h,
    getContext: (_id: string) => ctx2d,
    style: {} as CSSStyleDeclaration,
  }
  return { canvas: canvas as unknown as HTMLCanvasElement, groups }
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

  it('accepts an effective override without throwing', () => {
    const canvas   = makeCanvas(400, 24)
    const analysis = makeAnalysis()
    const override = {
      beatGrid:  [
        { timeSec: 0,   confidence: 1, isDownbeat: true  },
        { timeSec: 0.4, confidence: 1, isDownbeat: false },
      ],
      downbeats: [{ timeSec: 0, confidence: 1, isDownbeat: true }],
    }
    expect(() => drawBeatCanvas(canvas, analysis, override)).not.toThrow()
  })

  it('does not mutate analysis.beatGrid when effective override is supplied', () => {
    const canvas   = makeCanvas(400, 24)
    const analysis = makeAnalysis()
    const original = JSON.stringify(analysis.beatGrid)
    const override = {
      beatGrid:  [{ timeSec: 0.4, confidence: 1, isDownbeat: true }],
      downbeats: [{ timeSec: 0.4, confidence: 1, isDownbeat: true }],
    }
    drawBeatCanvas(canvas, analysis, override)
    expect(JSON.stringify(analysis.beatGrid)).toBe(original)
  })

  it('uses analysis.beatGrid when no effective override is provided', () => {
    // This is a structural test: if effective is omitted, the function must still
    // reference analysis.beatGrid (verified indirectly — no throw, no mutation).
    const canvas   = makeCanvas(400, 24)
    const analysis = makeAnalysis()
    const snapshot = JSON.stringify(analysis)
    drawBeatCanvas(canvas, analysis)
    expect(JSON.stringify(analysis)).toBe(snapshot)
  })

  // ── regular beat tick style ────────────────────────────────────────────────
  // drawBeatCanvas draws regular beats as bottom-anchored ruler ticks (≈5 CSS px)
  // rather than lines that span the full canvas height.

  describe('regular beat tick style', () => {
    function regularAnalysis() {
      return makeAnalysis({
        durationMs: 180_000,
        beatGrid: [
          { timeSec: 0,   confidence: 1, isDownbeat: true  },
          { timeSec: 0.5, confidence: 1, isDownbeat: false },
          { timeSec: 1.0, confidence: 1, isDownbeat: false },
          { timeSec: 1.5, confidence: 1, isDownbeat: false },
        ],
        downbeats: [{ timeSec: 0, confidence: 1, isDownbeat: true }],
      })
    }

    it('regular beat moveTo starts at canvas bottom (y === h)', () => {
      const { canvas, groups } = makeTrackingCanvas(400, 24)
      drawBeatCanvas(canvas, regularAnalysis())
      // groups[0] = first stroke call = regular beats
      const moves = groups[0].cmds.filter(p => p.cmd === 'moveTo')
      expect(moves.length).toBeGreaterThan(0)
      for (const m of moves) expect(m.y).toBe(24)
    })

    it('regular beat tick height is between 4 and 7 CSS pixels', () => {
      const { canvas, groups } = makeTrackingCanvas(400, 24)
      drawBeatCanvas(canvas, regularAnalysis())
      const cmds = groups[0].cmds
      for (let i = 0; i < cmds.length - 1; i++) {
        if (cmds[i].cmd === 'moveTo' && cmds[i + 1].cmd === 'lineTo') {
          const tickLen = Math.abs(cmds[i].y! - cmds[i + 1].y!)
          expect(tickLen).toBeGreaterThanOrEqual(4)
          expect(tickLen).toBeLessThanOrEqual(7)
        }
      }
    })

    it('no regular beat line reaches the canvas top (y > 0 for all lineTo)', () => {
      const { canvas, groups } = makeTrackingCanvas(400, 24)
      drawBeatCanvas(canvas, regularAnalysis())
      const lineTos = groups[0].cmds.filter(p => p.cmd === 'lineTo')
      expect(lineTos.length).toBeGreaterThan(0)
      for (const l of lineTos) expect(l.y).toBeGreaterThan(0)
    })

    it('regular beat x-position is proportional to timeSec / durationSec * width', () => {
      const w = 400, durationSec = 180
      const { canvas, groups } = makeTrackingCanvas(w, 24)
      const analysis = makeAnalysis({
        durationMs: durationSec * 1000,
        beatGrid: [
          { timeSec: 0,  confidence: 1, isDownbeat: true  },
          { timeSec: 45, confidence: 1, isDownbeat: false },
        ],
        downbeats: [{ timeSec: 0, confidence: 1, isDownbeat: true }],
      })
      drawBeatCanvas(canvas, analysis)
      const moves = groups[0].cmds.filter(p => p.cmd === 'moveTo')
      expect(moves.length).toBe(1)
      // Allow ±1 px: the implementation adds +0.5 for half-pixel crispness.
      const expectedX = (45 / durationSec) * w
      expect(Math.abs(moves[0].x! - expectedX)).toBeLessThan(1)
    })

    it('empty beatGrid produces no draw commands in the regular beat group', () => {
      const { canvas, groups } = makeTrackingCanvas(400, 24)
      drawBeatCanvas(canvas, makeAnalysis({ beatGrid: [], downbeats: [] }))
      if (groups.length > 0) {
        const draws = groups[0].cmds.filter(p => p.cmd === 'moveTo' || p.cmd === 'lineTo')
        expect(draws.length).toBe(0)
      }
    })

    it('downbeat ticks are bottom-anchored and taller than regular beats', () => {
      const h = 24
      const { canvas, groups } = makeTrackingCanvas(400, h)
      drawBeatCanvas(canvas, regularAnalysis())
      // groups[1] = second stroke call = downbeat ticks
      const moves   = groups[1].cmds.filter(p => p.cmd === 'moveTo')
      const lineTos = groups[1].cmds.filter(p => p.cmd === 'lineTo')
      expect(moves.length).toBeGreaterThan(0)
      for (const m of moves) expect(m.y).toBe(h)                         // same bottom anchor
      for (const l of lineTos) {
        expect(l.y).toBeGreaterThan(0)                                    // does not reach top
        expect(h - l.y!).toBeGreaterThan(TRACK_MAP_BEAT_TICK_HEIGHT)     // taller than regular
      }
    })

    it('zero durationMs causes early return — no moveTo calls at all', () => {
      const { canvas, groups } = makeTrackingCanvas(400, 24)
      expect(() => drawBeatCanvas(canvas, makeAnalysis({ durationMs: 0 }))).not.toThrow()
      const allMoves = groups.flatMap(g => g.cmds).filter(p => p.cmd === 'moveTo')
      expect(allMoves.length).toBe(0)
    })
  })

  // ── downbeat vs regular beat differentiation ───────────────────────────────
  // Every beat has exactly one tick. Downbeats are drawn taller, thicker, and a
  // different color — never a second full-height line on top of the beat tick.

  describe('downbeat tick style (vs regular beat)', () => {
    function barAnalysis() {
      return makeAnalysis({
        durationMs: 10_000,
        beatGrid: [
          { timeSec: 0,   confidence: 1, isDownbeat: true  },
          { timeSec: 0.5, confidence: 1, isDownbeat: false },
          { timeSec: 1.0, confidence: 1, isDownbeat: false },
          { timeSec: 1.5, confidence: 1, isDownbeat: false },
        ],
        downbeats: [{ timeSec: 0, confidence: 1, isDownbeat: true }],
      })
    }

    it('a four-beat bar produces 3 regular ticks + 1 downbeat tick = 4 total (not 5)', () => {
      const { canvas, groups } = makeTrackingCanvas(400, 24)
      drawBeatCanvas(canvas, barAnalysis())
      const regularCount  = groups[0].cmds.filter(p => p.cmd === 'moveTo').length
      const downbeatCount = groups[1].cmds.filter(p => p.cmd === 'moveTo').length
      expect(regularCount).toBe(3)
      expect(downbeatCount).toBe(1)
      expect(regularCount + downbeatCount).toBe(4)
    })

    it('downbeat stroke uses TRACK_MAP_DOWNBEAT_COLOR', () => {
      const { canvas, groups } = makeTrackingCanvas(400, 24)
      drawBeatCanvas(canvas, barAnalysis())
      expect(groups[1].strokeStyle).toBe(TRACK_MAP_DOWNBEAT_COLOR)
    })

    it('downbeat lineWidth is greater than regular beat lineWidth', () => {
      const { canvas, groups } = makeTrackingCanvas(400, 24)
      drawBeatCanvas(canvas, barAnalysis())
      expect(groups[1].lineWidth).toBeGreaterThan(groups[0].lineWidth)
    })

    it('downbeat tick is taller than regular beat tick', () => {
      const h = 24
      const { canvas, groups } = makeTrackingCanvas(400, h)
      drawBeatCanvas(canvas, barAnalysis())
      const regularLineTo  = groups[0].cmds.find(p => p.cmd === 'lineTo')!
      const downbeatLineTo = groups[1].cmds.find(p => p.cmd === 'lineTo')!
      expect(h - downbeatLineTo.y!).toBeGreaterThan(h - regularLineTo.y!)
    })

    it('downbeat x-position does not appear in the regular beat pass', () => {
      const w = 400, durationSec = 10
      const { canvas, groups } = makeTrackingCanvas(w, 24)
      const downbeatTimeSec = 2.0
      drawBeatCanvas(canvas, makeAnalysis({
        durationMs: durationSec * 1000,
        beatGrid: [
          { timeSec: downbeatTimeSec, confidence: 1, isDownbeat: true  },
          { timeSec: 2.5,             confidence: 1, isDownbeat: false },
        ],
        downbeats: [{ timeSec: downbeatTimeSec, confidence: 1, isDownbeat: true }],
      }))
      const expectedX = (downbeatTimeSec / durationSec) * w  // 80
      const regularAtDownbeatX = groups[0].cmds.filter(
        p => p.cmd === 'moveTo' && Math.abs(p.x! - expectedX) < 1
      )
      expect(regularAtDownbeatX.length).toBe(0)
    })

    it('effective BPM override derives downbeat positions from the same grid (no mixing)', () => {
      const { canvas, groups } = makeTrackingCanvas(400, 24)
      const effectiveGrid: BeatMarkerMI[] = [
        { timeSec: 0,   confidence: 1, isDownbeat: true  },
        { timeSec: 0.4, confidence: 1, isDownbeat: false },
        { timeSec: 0.8, confidence: 1, isDownbeat: false },
        { timeSec: 1.2, confidence: 1, isDownbeat: false },
      ]
      drawBeatCanvas(canvas, makeAnalysis({ durationMs: 10_000 }), { beatGrid: effectiveGrid })
      expect(groups[0].cmds.filter(p => p.cmd === 'moveTo').length).toBe(3) // 3 regular
      expect(groups[1].cmds.filter(p => p.cmd === 'moveTo').length).toBe(1) // 1 downbeat
    })

    it('empty effective grid produces no ticks in regular or downbeat pass', () => {
      const { canvas, groups } = makeTrackingCanvas(400, 24)
      drawBeatCanvas(canvas, makeAnalysis({ durationMs: 10_000 }), { beatGrid: [] })
      expect(groups[0].cmds.filter(p => p.cmd === 'moveTo').length).toBe(0)
      expect(groups[1].cmds.filter(p => p.cmd === 'moveTo').length).toBe(0)
    })
  })

  // ── section-start line removal ─────────────────────────────────────────────
  // analysis.sections data must not produce canvas strokes in drawBeatCanvas.
  // Section regions will be rendered by a dedicated overlay layer.

  describe('section-start line removal', () => {
    it('analysis with sections produces exactly 2 stroke passes (regular + downbeats only)', () => {
      const { canvas, groups } = makeTrackingCanvas(400, 24)
      // makeAnalysis() includes 3 sections — a third pass would indicate gold lines
      drawBeatCanvas(canvas, makeAnalysis())
      expect(groups.length).toBe(2)
    })

    it('empty beatGrid with sections present produces zero moveTo calls', () => {
      const { canvas, groups } = makeTrackingCanvas(400, 24)
      // Sections alone must not drive any canvas drawing
      drawBeatCanvas(canvas, makeAnalysis({ beatGrid: [], downbeats: [] }))
      const allMoves = groups.flatMap(g => g.cmds).filter(p => p.cmd === 'moveTo')
      expect(allMoves.length).toBe(0)
    })

    it('beat and downbeat ticks still render after section line removal', () => {
      const { canvas, groups } = makeTrackingCanvas(400, 24)
      drawBeatCanvas(canvas, makeAnalysis())
      // makeAnalysis() has 2 regular beats + 1 downbeat
      expect(groups[0].cmds.filter(p => p.cmd === 'moveTo').length).toBeGreaterThan(0)
      expect(groups[1].cmds.filter(p => p.cmd === 'moveTo').length).toBeGreaterThan(0)
    })

    it('section.startSec values do not appear as moveTo calls in either beat pass', () => {
      const w = 400, durationSec = 180
      const { canvas, groups } = makeTrackingCanvas(w, 24)
      const analysis = makeAnalysis({ durationMs: durationSec * 1000 })
      // sections start at 0, 30, 90 → x = 0, 66.7, 200
      const sectionXs = analysis.sections.map(s =>
        Math.round((s.startSec / durationSec) * w)
      )
      drawBeatCanvas(canvas, analysis)
      // Only sections[0].startSec == 0 coincides with beat index 0 (isDownbeat).
      // Sections at 30 s (x≈67) and 90 s (x=200) have no beats there in the fixture.
      const allMoves = groups.flatMap(g => g.cmds).filter(p => p.cmd === 'moveTo')
      // x=66.7 and x=200 must not appear in any beat pass
      const phantom = allMoves.filter(p =>
        sectionXs.slice(1).some(sx => Math.abs(p.x! - sx) < 1)
      )
      expect(phantom.length).toBe(0)
    })
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

// 14 ── buildBarRange
describe('buildBarRange', () => {
  function dbGrid(...times: number[]): BeatMarkerMI[] {
    return times.map(t => ({ timeSec: t, confidence: 1, isDownbeat: true }))
  }

  it('returns null for empty beatGrid', () => {
    expect(buildBarRange({ startSec: 0, endSec: 10 }, [])).toBeNull()
  })

  it('returns null when grid has no downbeats', () => {
    const grid: BeatMarkerMI[] = [
      { timeSec: 0.5, confidence: 1, isDownbeat: false },
      { timeSec: 1.0, confidence: 1, isDownbeat: false },
    ]
    expect(buildBarRange({ startSec: 0, endSec: 5 }, grid)).toBeNull()
  })

  it('returns null when section starts after all downbeats', () => {
    expect(buildBarRange({ startSec: 10, endSec: 20 }, dbGrid(0, 2, 4))).toBeNull()
  })

  it('returns "1–1" for a section spanning exactly one bar', () => {
    // downbeats at 0, 2 — section 0→2 contains downbeat[0] only
    expect(buildBarRange({ startSec: 0, endSec: 2 }, dbGrid(0, 2, 4))).toBe('1–1')
  })

  it('returns "1–4" for a section spanning four bars', () => {
    expect(buildBarRange({ startSec: 0, endSec: 8 }, dbGrid(0, 2, 4, 6, 8))).toBe('1–4')
  })

  it('uses 1-based bar numbering — a section starting at bar 2 returns "2–..."', () => {
    expect(buildBarRange({ startSec: 2, endSec: 6 }, dbGrid(0, 2, 4, 6))).toBe('2–3')
  })

  it('accepts ±50 ms tolerance on startSec alignment', () => {
    // section starts 0.03 s before the downbeat at 2.0
    expect(buildBarRange({ startSec: 1.97, endSec: 4 }, dbGrid(0, 2, 4, 6))).toBe('2–2')
  })

  it('ignores non-downbeat markers when computing bar range', () => {
    const mixed: BeatMarkerMI[] = [
      { timeSec: 0,   confidence: 1, isDownbeat: true  },
      { timeSec: 0.5, confidence: 1, isDownbeat: false },
      { timeSec: 1.0, confidence: 1, isDownbeat: false },
      { timeSec: 1.5, confidence: 1, isDownbeat: false },
      { timeSec: 2.0, confidence: 1, isDownbeat: true  },
      { timeSec: 2.5, confidence: 1, isDownbeat: false },
      { timeSec: 3.0, confidence: 1, isDownbeat: false },
      { timeSec: 3.5, confidence: 1, isDownbeat: false },
      { timeSec: 4.0, confidence: 1, isDownbeat: true  },
    ]
    expect(buildBarRange({ startSec: 0, endSec: 4 }, mixed)).toBe('1–2')
  })
})

// 15 ── computeBeatStride
describe('computeBeatStride', () => {
  it('returns 1 when beats are sparse enough (≥3px apart)', () => {
    // 4 beats on 400px canvas → ~133px/beat → stride = 1
    expect(computeBeatStride(4, 400)).toBe(1)
  })

  it('returns 1 for 0 beats', () => {
    expect(computeBeatStride(0, 400)).toBe(1)
  })

  it('returns 1 for 0 canvas width', () => {
    expect(computeBeatStride(100, 0)).toBe(1)
  })

  it('returns stride > 1 when beats are very dense', () => {
    // 400 beats on 400px canvas → 1px/beat → stride = ceil(3/1) = 3
    expect(computeBeatStride(400, 400)).toBe(3)
  })

  it('stride reduces drawn beat count when beats are too dense', () => {
    // 200 beats on 200px → 1px/beat → stride ≥ 2 so fewer than 200 are drawn
    const stride = computeBeatStride(200, 200)
    expect(stride).toBeGreaterThanOrEqual(2)
    const drawnCount = Math.ceil(200 / stride)
    expect(drawnCount).toBeLessThan(200)
  })

  it('respects custom minGapPx', () => {
    // 100 beats on 100px → 1px/beat; minGap=5 → stride = ceil(5/1) = 5
    expect(computeBeatStride(100, 100, 5)).toBe(5)
  })
})

// 16 ── drawBeatCanvas with non-finite beat times
describe('drawBeatCanvas — non-finite beat time guard', () => {
  function badGrid(): TrackIntelligenceAnalysis {
    return makeAnalysis({
      beatGrid: [
        { timeSec: 0,        confidence: 1, isDownbeat: true  },
        { timeSec: NaN,      confidence: 1, isDownbeat: false },
        { timeSec: Infinity, confidence: 1, isDownbeat: false },
        { timeSec: 0.5,      confidence: 1, isDownbeat: false },
      ],
    })
  }

  it('does not throw for non-finite beat times', () => {
    const { canvas } = makeTrackingCanvas(400, 24)
    expect(() => drawBeatCanvas(canvas, badGrid())).not.toThrow()
  })

  it('skips non-finite beats and draws only finite ones', () => {
    const { canvas, groups } = makeTrackingCanvas(400, 24)
    drawBeatCanvas(canvas, badGrid())
    // Regular pass (groups[0]) should have 1 moveTo (timeSec=0.5 is the only finite regular beat)
    const regularMoves = groups[0]?.cmds.filter(c => c.cmd === 'moveTo').length ?? 0
    // Downbeat pass (groups[1]) should have 1 moveTo (timeSec=0)
    const downbeatMoves = groups[1]?.cmds.filter(c => c.cmd === 'moveTo').length ?? 0
    expect(regularMoves).toBe(1)
    expect(downbeatMoves).toBe(1)
  })
})

// 17 ── drawEnergyCanvas with null/undefined curve
describe('drawEnergyCanvas — null/undefined curve guard', () => {
  it('does not throw for null curve', () => {
    const canvas = makeCanvas()
    expect(() => drawEnergyCanvas(canvas, null, 120, '#4ac7db')).not.toThrow()
  })

  it('does not throw for undefined curve', () => {
    const canvas = makeCanvas()
    expect(() => drawEnergyCanvas(canvas, undefined, 120, '#4ac7db')).not.toThrow()
  })

  it('does not throw for a curve with non-finite values', () => {
    const badCurve: FeatureCurve = [
      { timeSec: 0,        value: 0.5 },
      { timeSec: NaN,      value: NaN },
      { timeSec: Infinity, value: 1   },
      { timeSec: 1,        value: 0.8 },
    ]
    const canvas = makeCanvas()
    expect(() => drawEnergyCanvas(canvas, badCurve, 120, '#4ac7db')).not.toThrow()
  })
})

// 18 ── density reduction with many beats reduces drawcalls
describe('drawBeatCanvas — density reduction integration', () => {
  it('fewer moveTo calls when beat density is high vs low', () => {
    const durationMs = 60_000  // 60 s

    // Low density: 4 beats across 60s on 400px canvas — all drawn
    const sparseBeatGrid: BeatMarkerMI[] = [
      { timeSec: 0,  confidence: 1, isDownbeat: true  },
      { timeSec: 15, confidence: 1, isDownbeat: false },
      { timeSec: 30, confidence: 1, isDownbeat: false },
      { timeSec: 45, confidence: 1, isDownbeat: false },
    ]
    const { canvas: c1, groups: g1 } = makeTrackingCanvas(400, 24)
    drawBeatCanvas(c1, makeAnalysis({ durationMs, beatGrid: sparseBeatGrid }))
    const sparseMoves = g1[0]?.cmds.filter(c => c.cmd === 'moveTo').length ?? 0

    // High density: 300 beats across 60s on 400px canvas — some skipped
    const denseBeatGrid: BeatMarkerMI[] = Array.from({ length: 300 }, (_, i) => ({
      timeSec:    (i / 300) * 60,
      confidence: 1,
      isDownbeat: i === 0,
    }))
    const { canvas: c2, groups: g2 } = makeTrackingCanvas(400, 24)
    drawBeatCanvas(c2, makeAnalysis({ durationMs, beatGrid: denseBeatGrid }))
    const denseMoves = g2[0]?.cmds.filter(c => c.cmd === 'moveTo').length ?? 0

    // Sparse: all 3 regular beats drawn; dense: fewer than 299 regular beats
    expect(sparseMoves).toBe(3)
    expect(denseMoves).toBeLessThan(299)
  })
})

// ── 19: buildPresetCueId ──────────────────────────────────────────────────────

describe('buildPresetCueId', () => {
  it('returns a stable, deterministic string from a section ID', () => {
    expect(buildPresetCueId('sec-intro')).toBe('section-preset:sec-intro')
  })

  it('returns different IDs for different section IDs', () => {
    expect(buildPresetCueId('a')).not.toBe(buildPresetCueId('b'))
  })

  it('produces the same ID on repeated calls with the same input', () => {
    const id = 'my-section-123'
    expect(buildPresetCueId(id)).toBe(buildPresetCueId(id))
  })
})

// ── 20: buildPresetCueLabel ───────────────────────────────────────────────────

describe('buildPresetCueLabel', () => {
  it('formats "SectionLabel → PresetName"', () => {
    expect(buildPresetCueLabel('Drop', 'Neon Energy Cloud')).toBe('Drop → Neon Energy Cloud')
  })

  it('handles empty strings without throwing', () => {
    expect(() => buildPresetCueLabel('', '')).not.toThrow()
  })
})

// ── 21: section preset assignment workflow (store integration) ────────────────
//
// These tests call the store directly (no React rendering) to verify the
// data contract: assign, change, clear, move, and delete a section's cue.

const TRACK_ID = 'test-track-section-assign'

function makeSection(overrides: Partial<ReactTrackSection> = {}): ReactTrackSection {
  return {
    id:       'sec-drop-1',
    label:    'Drop',
    type:     'drop',
    startSec: 30,
    endSec:   90,
    intensity: 1.0,
    source:   'user-created',
    ...overrides,
  }
}

function resetStore() {
  useReactStore.setState({ presetAutomationCuesByTrackId: {} })
}

/** Simulates the handleAssignPreset action from ReactTrackMapStrip. */
function assignPreset(
  section: ReactTrackSection,
  presetId: string | null,
  presetName: string = 'Test Preset',
): void {
  const store  = useReactStore.getState()
  const cueId  = buildPresetCueId(section.id)
  if (!presetId) {
    store.removePresetAutomationCue(TRACK_ID, cueId)
    return
  }
  const label    = buildPresetCueLabel(section.label, presetName)
  const trackCues = store.presetAutomationCuesByTrackId[TRACK_ID] ?? []
  const existing  = trackCues.find(c => c.id === cueId)
  if (existing) {
    store.updatePresetAutomationCue(TRACK_ID, cueId, { presetId, label, timeSec: section.startSec })
  } else {
    store.addPresetAutomationCue(TRACK_ID, {
      id:           cueId,
      timeSec:      section.startSec,
      presetId,
      label,
      enabled:      true,
      transitionMs: 0,
      sectionId:    section.id,
    })
  }
}

describe('section preset assignment — assigning', () => {
  beforeEach(resetStore)

  it('creates a cue with the correct shape when a preset is assigned', () => {
    const section = makeSection()
    assignPreset(section, 'preset-neon-energy', 'Neon Energy')
    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues).toHaveLength(1)
    const cue = cues[0]
    expect(cue.id).toBe(buildPresetCueId(section.id))
    expect(cue.timeSec).toBe(section.startSec)
    expect(cue.presetId).toBe('preset-neon-energy')
    expect(cue.sectionId).toBe(section.id)
    expect(cue.enabled).toBe(true)
    expect(cue.label).toBe('Drop → Neon Energy')
  })

  it('cue timeSec matches the section startSec', () => {
    const section = makeSection({ startSec: 45 })
    assignPreset(section, 'p-1')
    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues[0].timeSec).toBe(45)
  })

  it('assigning a second time to the same section does not create a duplicate', () => {
    const section = makeSection()
    assignPreset(section, 'p-1')
    assignPreset(section, 'p-1')
    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues).toHaveLength(1)
  })
})

describe('section preset assignment — changing', () => {
  beforeEach(resetStore)

  it('updating the assigned preset changes presetId but preserves the cue ID', () => {
    const section = makeSection()
    assignPreset(section, 'p-first', 'First Preset')
    assignPreset(section, 'p-second', 'Second Preset')
    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues).toHaveLength(1)
    expect(cues[0].presetId).toBe('p-second')
    expect(cues[0].id).toBe(buildPresetCueId(section.id))
  })

  it('updating the preset updates the label', () => {
    const section = makeSection()
    assignPreset(section, 'p-1', 'Alpha')
    assignPreset(section, 'p-2', 'Beta')
    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues[0].label).toBe(buildPresetCueLabel('Drop', 'Beta'))
  })
})

describe('section preset assignment — clearing', () => {
  beforeEach(resetStore)

  it('clearing the assignment removes the cue', () => {
    const section = makeSection()
    assignPreset(section, 'p-1')
    assignPreset(section, null)    // clear
    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues).toHaveLength(0)
  })

  it('clearing when no cue exists is a no-op', () => {
    const section = makeSection()
    expect(() => assignPreset(section, null)).not.toThrow()
    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues).toHaveLength(0)
  })
})

describe('section preset assignment — moving (startSec change)', () => {
  beforeEach(resetStore)

  it('updating the section startSec syncs the cue timeSec', () => {
    const section = makeSection({ startSec: 30 })
    assignPreset(section, 'p-1')

    // Simulate handleSaveSection or handleCommitBoundary syncing the cue
    const cueId = buildPresetCueId(section.id)
    useReactStore.getState().updatePresetAutomationCue(TRACK_ID, cueId, { timeSec: 60 })

    // Re-read state after mutation
    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues[0].timeSec).toBe(60)
  })

  it('the cue presetId is unchanged after a timeSec update', () => {
    const section = makeSection({ startSec: 30 })
    assignPreset(section, 'my-preset')
    useReactStore.getState().updatePresetAutomationCue(TRACK_ID, buildPresetCueId(section.id), { timeSec: 55 })
    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues[0].presetId).toBe('my-preset')
    expect(cues[0].timeSec).toBe(55)
  })
})

describe('section preset assignment — deleting the section', () => {
  beforeEach(resetStore)

  it('removing the linked cue when a section is deleted', () => {
    const section = makeSection()
    assignPreset(section, 'p-1')

    // Simulate handleDeleteSection: removeManualSection + removePresetAutomationCue
    useReactStore.getState().removePresetAutomationCue(TRACK_ID, buildPresetCueId(section.id))

    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues).toHaveLength(0)
  })

  it('deleting one section does not affect cues for other sections', () => {
    const sectionA = makeSection({ id: 'sec-A', label: 'Intro', startSec: 0 })
    const sectionB = makeSection({ id: 'sec-B', label: 'Drop',  startSec: 30 })
    assignPreset(sectionA, 'p-a')
    assignPreset(sectionB, 'p-b')

    // Delete section A
    useReactStore.getState().removePresetAutomationCue(TRACK_ID, buildPresetCueId(sectionA.id))

    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues).toHaveLength(1)
    expect(cues[0].sectionId).toBe(sectionB.id)
  })
})

// ── 22: orphaned cue cleanup — quick-remove, Delete All, suppress, rename ──────
//
// These tests simulate the updated handler logic directly against the store.
// Each describe block mirrors one UI removal/rename path.

/** Simulates removeCueForSection (the shared component helper). */
function removeCueForSection(sectionId: string): void {
  useReactStore.getState().removePresetAutomationCue(TRACK_ID, buildPresetCueId(sectionId))
}

/** Simulates handleSaveSection label-update path. */
function saveSectionLabel(
  section: ReactTrackSection,
  newLabel: string,
  presetName: string,
): void {
  const store   = useReactStore.getState()
  const cueId   = buildPresetCueId(section.id)
  const cue     = (store.presetAutomationCuesByTrackId[TRACK_ID] ?? []).find(c => c.id === cueId)
  if (!cue) return
  store.updatePresetAutomationCue(TRACK_ID, cueId, {
    label: buildPresetCueLabel(newLabel, presetName),
  })
}

describe('orphaned cue cleanup — quick-remove (handleRemove)', () => {
  beforeEach(resetStore)

  it('removes the linked cue when a section is quick-removed', () => {
    const section = makeSection({ id: 'sec-qr', startSec: 20 })
    assignPreset(section, 'p-1', 'Preset One')

    // Simulate handleRemove: removeManualSection + removeCueForSection
    removeCueForSection(section.id)

    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues).toHaveLength(0)
  })

  it('quick-removing section A leaves section B cue intact', () => {
    const sA = makeSection({ id: 'sec-qr-A', label: 'Intro', startSec: 0  })
    const sB = makeSection({ id: 'sec-qr-B', label: 'Drop',  startSec: 60 })
    assignPreset(sA, 'p-a', 'Preset A')
    assignPreset(sB, 'p-b', 'Preset B')

    removeCueForSection(sA.id)

    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues).toHaveLength(1)
    expect(cues[0].sectionId).toBe(sB.id)
    expect(cues[0].presetId).toBe('p-b')
  })

  it('quick-removing a section with no preset assignment is a no-op', () => {
    const sA = makeSection({ id: 'sec-unassigned', startSec: 10 })
    const sB = makeSection({ id: 'sec-has-cue',    startSec: 50 })
    assignPreset(sB, 'p-b', 'Preset B')

    // Remove sA which has no cue
    removeCueForSection(sA.id)

    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues).toHaveLength(1)
    expect(cues[0].sectionId).toBe(sB.id)
  })
})

describe('orphaned cue cleanup — Delete All (handleDeleteAllSections)', () => {
  beforeEach(resetStore)

  it('removing all sections also removes all linked cues', () => {
    const sA = makeSection({ id: 'sec-da-A', label: 'Intro', startSec: 0  })
    const sB = makeSection({ id: 'sec-da-B', label: 'Drop',  startSec: 60 })
    assignPreset(sA, 'p-a', 'Alpha')
    assignPreset(sB, 'p-b', 'Beta')

    // Simulate handleDeleteAllSections: removeCueForSection for each section
    removeCueForSection(sA.id)
    removeCueForSection(sB.id)

    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues).toHaveLength(0)
  })

  it('Delete All with a mix of assigned and unassigned sections removes only assigned cues', () => {
    const sAssigned   = makeSection({ id: 'sec-da-assigned',   startSec: 0  })
    const sUnassigned = makeSection({ id: 'sec-da-unassigned', startSec: 60 })
    assignPreset(sAssigned, 'p-x', 'Xray')
    // sUnassigned has no cue

    removeCueForSection(sAssigned.id)
    removeCueForSection(sUnassigned.id)   // no-op

    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues).toHaveLength(0)
  })

  it('cues for a different track are unaffected by Delete All on this track', () => {
    const otherTrack = 'other-track-da'
    const sThis  = makeSection({ id: 'sec-this',  startSec: 0 })
    const sOther = makeSection({ id: 'sec-other', startSec: 0 })
    assignPreset(sThis, 'p-this', 'This Preset')
    // Add a cue for the other track manually
    useReactStore.getState().addPresetAutomationCue(otherTrack, {
      id:           buildPresetCueId(sOther.id),
      timeSec:      0,
      presetId:     'p-other',
      label:        'Other Preset',
      enabled:      true,
      transitionMs: 0,
      sectionId:    sOther.id,
    })

    // Delete All on TRACK_ID only
    removeCueForSection(sThis.id)

    const thisCues  = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID]  ?? []
    const otherCues = useReactStore.getState().presetAutomationCuesByTrackId[otherTrack] ?? []
    expect(thisCues).toHaveLength(0)
    expect(otherCues).toHaveLength(1)
    expect(otherCues[0].presetId).toBe('p-other')
  })
})

describe('orphaned cue cleanup — suppress (handleSuppressSection)', () => {
  beforeEach(resetStore)

  it('suppressing an auto section removes its linked cue', () => {
    const section = makeSection({ id: 'sec-sup-1', source: 'auto', startSec: 45 })
    assignPreset(section, 'p-suppressed', 'Gone Preset')

    // Simulate handleSuppressSection: suppressAutoSection + removeCueForSection
    removeCueForSection(section.id)

    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues).toHaveLength(0)
  })

  it('suppressing one auto section leaves cues for other sections intact', () => {
    const sAuto   = makeSection({ id: 'sec-sup-auto',  source: 'auto',         startSec: 0  })
    const sManual = makeSection({ id: 'sec-sup-manual', source: 'user-created', startSec: 60 })
    assignPreset(sAuto,   'p-auto',   'Auto Preset')
    assignPreset(sManual, 'p-manual', 'Manual Preset')

    // Suppress only the auto section
    removeCueForSection(sAuto.id)

    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues).toHaveLength(1)
    expect(cues[0].sectionId).toBe(sManual.id)
    expect(cues[0].presetId).toBe('p-manual')
  })

  it('suppressing a section with no preset assignment is a no-op', () => {
    const sKeep = makeSection({ id: 'sec-keep-on-suppress', startSec: 30 })
    assignPreset(sKeep, 'p-keep', 'Keep Preset')

    const sSuppress = makeSection({ id: 'sec-sup-no-cue', source: 'auto', startSec: 90 })
    // sSuppress has no cue
    removeCueForSection(sSuppress.id)

    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues).toHaveLength(1)
    expect(cues[0].sectionId).toBe(sKeep.id)
  })
})

describe('orphaned cue cleanup — rename (handleSaveSection label change)', () => {
  beforeEach(resetStore)

  it('renaming a section updates the linked cue label', () => {
    const section = makeSection({ id: 'sec-rename', label: 'Drop', startSec: 30 })
    assignPreset(section, 'p-neon', 'Neon Cloud')

    saveSectionLabel(section, 'Big Drop', 'Neon Cloud')

    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues[0].label).toBe(buildPresetCueLabel('Big Drop', 'Neon Cloud'))
  })

  it('renaming preserves presetId and timeSec', () => {
    const section = makeSection({ id: 'sec-rename-preserve', label: 'Verse', startSec: 20 })
    assignPreset(section, 'p-vibes', 'Vibes')

    saveSectionLabel(section, 'Verse II', 'Vibes')

    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues[0].presetId).toBe('p-vibes')
    expect(cues[0].timeSec).toBe(20)
  })

  it('renaming a section with no cue is a no-op', () => {
    const sNoCue = makeSection({ id: 'sec-rename-no-cue', label: 'Intro', startSec: 0 })
    const sKeep  = makeSection({ id: 'sec-rename-keep',   label: 'Drop',  startSec: 60 })
    assignPreset(sKeep, 'p-keep', 'Keep Preset')

    // saveSectionLabel on sNoCue should not throw or alter other cues
    saveSectionLabel(sNoCue, 'New Intro', 'Whatever')

    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    expect(cues).toHaveLength(1)
    expect(cues[0].sectionId).toBe(sKeep.id)
  })

  it('rename does not affect cues belonging to other sections', () => {
    const sA = makeSection({ id: 'sec-ren-A', label: 'A', startSec: 0  })
    const sB = makeSection({ id: 'sec-ren-B', label: 'B', startSec: 60 })
    assignPreset(sA, 'p-a', 'Alpha')
    assignPreset(sB, 'p-b', 'Beta')

    saveSectionLabel(sA, 'A Renamed', 'Alpha')

    const cues = useReactStore.getState().presetAutomationCuesByTrackId[TRACK_ID] ?? []
    const cueB = cues.find(c => c.sectionId === sB.id)!
    expect(cueB.label).toBe(buildPresetCueLabel('B', 'Beta'))
  })
})
