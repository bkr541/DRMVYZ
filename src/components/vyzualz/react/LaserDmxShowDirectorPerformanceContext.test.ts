import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame, TrackIntelligenceAnalysis } from '../../../features/musicIntelligence/types'
import {
  buildLaserDmxShowDirectorPerformanceContext,
  createLaserDmxShowDirectorAnalysisIdentity,
  didCrossLaserDmxShowDirectorEightBarBoundary,
  didCrossLaserDmxShowDirectorFourBarBoundary,
  didCrossLaserDmxShowDirectorSixteenBarBoundary,
  resolveLaserDmxShowDirectorGridPosition,
} from './LaserDmxShowDirectorPerformanceContext'
import type { ReactTrackSection } from './ReactTypes'

function frame(overrides: Partial<MusicIntelligenceFrame> = {}): MusicIntelligenceFrame {
  return {
    ...DEFAULT_MI_FRAME,
    ...overrides,
    bands: { ...DEFAULT_MI_FRAME.bands, ...overrides.bands },
    rhythm: { ...DEFAULT_MI_FRAME.rhythm, ...overrides.rhythm },
    energy: { ...DEFAULT_MI_FRAME.energy, ...overrides.energy },
    section: { ...DEFAULT_MI_FRAME.section, ...overrides.section },
    harmonic: { ...DEFAULT_MI_FRAME.harmonic, ...overrides.harmonic },
    stems: { ...DEFAULT_MI_FRAME.stems, ...overrides.stems },
    lyrics: { ...DEFAULT_MI_FRAME.lyrics, ...overrides.lyrics },
    semantics: { ...DEFAULT_MI_FRAME.semantics, ...overrides.semantics },
    capabilities: { ...DEFAULT_MI_FRAME.capabilities!, ...overrides.capabilities },
    confidence: { ...DEFAULT_MI_FRAME.confidence, ...overrides.confidence },
    raw: { ...DEFAULT_MI_FRAME.raw, ...overrides.raw },
  }
}

function analysis(options: { timeSignature?: number; offset?: number; beats?: number; revision?: string } = {}): TrackIntelligenceAnalysis {
  const bpm = 120
  const offset = options.offset ?? 0
  const beats = options.beats ?? 160
  const beatGrid = Array.from({ length: beats }, (_, index) => ({
    timeSec: offset + index * 0.5,
    confidence: 1,
    isDownbeat: index % (options.timeSignature ?? 4) === 0,
    bpm,
  }))
  return {
    analysisVersion: options.revision ?? 'analysis-v1',
    createdAt: '2026-07-12T00:00:00.000Z',
    durationMs: 120000,
    bpm,
    bpmConfidence: 1,
    beatGridOffsetSec: offset,
    timeSignature: options.timeSignature ?? 4,
    beatGrid,
    downbeats: beatGrid.filter(marker => marker.isDownbeat),
    phrases: [],
    sections: [],
    energyCurves: { instant: [], shortTerm: [], bass: [], mid: [], high: [] },
    spectralCurves: { centroid: [], flux: [], complexity: [] },
    stemCurves: null,
    harmonic: {
      keyChanges: [], chordProgression: [], dominantKey: null, dominantMode: null,
      keyConfidence: 0, pitchCurve: [], melodyContourCurve: [],
    },
    lyrics: null,
    semanticMoments: [],
    warnings: [],
    errors: [],
  }
}

const sections: ReactTrackSection[] = [
  { id: 'intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 8, intensity: 0.2, source: 'auto', confidence: 0.8 },
  { id: 'drop-1', label: 'Drop 1', type: 'drop', startSec: 8, endSec: 16, intensity: 1, source: 'auto', confidence: 0.9 },
  { id: 'break', label: 'Break', type: 'breakdown', startSec: 16, endSec: 24, intensity: 0.3, source: 'auto', confidence: 0.8 },
  { id: 'drop-2', label: 'Drop 2', type: 'drop', startSec: 24, endSec: 32, intensity: 1, source: 'auto', confidence: 0.95 },
]

describe('Show Director canonical performance timing context', () => {
  it('uses true 4/4 bar boundaries and separates eight beats from eight bars', () => {
    const a = analysis()
    expect(resolveLaserDmxShowDirectorGridPosition(4, frame(), a)).toMatchObject({ beatIndex: 8, barIndex: 2, timeSignature: 4 })
    expect(resolveLaserDmxShowDirectorGridPosition(16, frame(), a)).toMatchObject({ beatIndex: 32, barIndex: 8 })
    expect(didCrossLaserDmxShowDirectorEightBarBoundary(1, 2)).toBe(false)
    expect(didCrossLaserDmxShowDirectorEightBarBoundary(7, 8)).toBe(true)
  })

  it('supports non-4/4 time signatures and beat-grid offsets', () => {
    const threeFour = analysis({ timeSignature: 3, offset: 1 })
    expect(resolveLaserDmxShowDirectorGridPosition(4, frame(), threeFour)).toMatchObject({ beatIndex: 6, beatWithinBar: 0, barIndex: 2, timeSignature: 3 })
    expect(resolveLaserDmxShowDirectorGridPosition(1.75, frame(), threeFour)).toMatchObject({ beatIndex: 1, beatPhase: 0.5 })
  })

  it('detects four-, eight-, and sixteen-bar crossings without floating-point equality', () => {
    expect(didCrossLaserDmxShowDirectorFourBarBoundary(3, 4)).toBe(true)
    expect(didCrossLaserDmxShowDirectorEightBarBoundary(7, 8)).toBe(true)
    expect(didCrossLaserDmxShowDirectorSixteenBarBoundary(15, 16)).toBe(true)
    expect(didCrossLaserDmxShowDirectorFourBarBoundary(4, 4)).toBe(false)
  })

  it('gives manual Track Map sections precedence over overlapping analyzed sections', () => {
    const context = buildLaserDmxShowDirectorPerformanceContext({
      audioTimeSec: 10,
      frame: frame(),
      analysis: analysis(),
      analyzedSections: sections,
      manualSections: [{ id: 'manual-drop', label: 'Manual Build', type: 'build', startSec: 9, endSec: 12, intensity: 0.7, source: 'user-created' }],
    })
    expect(context.resolvedSection?.id).toBe('manual-drop')
    expect(context.resolvedSection?.type).toBe('build')

    const manualDrop = buildLaserDmxShowDirectorPerformanceContext({
      audioTimeSec: 10,
      frame: frame(),
      analysis: analysis(),
      analyzedSections: sections,
      manualSections: [{ id: 'manual-drop-replacement', label: 'Manual Drop', type: 'drop', startSec: 8, endSec: 16, intensity: 1, source: 'user-created' }],
    })
    expect(manualDrop.dropOccurrence).toBe(1)
  })

  it('identifies Drop 1 and Drop 2 deterministically, including direct seeks', () => {
    const a = analysis()
    const dropOne = buildLaserDmxShowDirectorPerformanceContext({ audioTimeSec: 10, frame: frame(), analysis: a, resolvedSections: sections })
    expect(dropOne.dropOccurrence).toBe(1)

    const dropTwo = buildLaserDmxShowDirectorPerformanceContext({
      audioTimeSec: 25,
      frame: frame(),
      analysis: a,
      resolvedSections: sections,
      previous: dropOne,
      seekIdentity: 'seek-2',
    })
    expect(dropTwo.dropOccurrence).toBe(2)
    expect(dropTwo.boundaries.timingDiscontinuity).toBe(true)
    expect(dropTwo.beatIndex).toBe(50)
  })

  it('does not turn a looped Drop 1 into Drop 2', () => {
    const firstPass = buildLaserDmxShowDirectorPerformanceContext({ audioTimeSec: 12, frame: frame(), analysis: analysis(), resolvedSections: sections, loopIdentity: 'loop-0' })
    const looped = buildLaserDmxShowDirectorPerformanceContext({ audioTimeSec: 9, frame: frame(), analysis: analysis(), resolvedSections: sections, previous: firstPass, loopIdentity: 'loop-1' })
    expect(looped.dropOccurrence).toBe(1)
    expect(looped.boundaries.timingDiscontinuity).toBe(true)
  })

  it('invalidates context identity on track, section, and analysis replacement', () => {
    const a = analysis()
    const base = buildLaserDmxShowDirectorPerformanceContext({ audioTimeSec: 2, frame: frame(), analysis: a, resolvedSections: sections, trackIdentity: 'track-a' })
    const trackChanged = buildLaserDmxShowDirectorPerformanceContext({ audioTimeSec: 2, frame: frame(), analysis: a, resolvedSections: sections, trackIdentity: 'track-b', previous: base })
    const analysisChanged = buildLaserDmxShowDirectorPerformanceContext({ audioTimeSec: 2, frame: frame(), analysis: analysis({ revision: 'analysis-v2' }), resolvedSections: sections, trackIdentity: 'track-a', previous: base })
    const sectionsChanged = buildLaserDmxShowDirectorPerformanceContext({ audioTimeSec: 2, frame: frame(), analysis: a, resolvedSections: [...sections, { id: 'outro', label: 'Outro', type: 'outro', startSec: 32, endSec: 40, intensity: 0.2, source: 'manual' }], trackIdentity: 'track-a', previous: base })
    expect(trackChanged.runtimeIdentity).not.toBe(base.runtimeIdentity)
    expect(analysisChanged.analysisIdentity).not.toBe(base.analysisIdentity)
    expect(sectionsChanged.sectionIdentity).not.toBe(base.sectionIdentity)
    expect(createLaserDmxShowDirectorAnalysisIdentity(null)).toBeNull()
  })

  it('detects manual section property edits and content changes inside replacement analysis objects', () => {
    const baseAnalysis = analysis()
    const changedAnalysis = analysis()
    changedAnalysis.energyCurves.instant = [{ timeSec: 4, value: 0.9 }]
    expect(createLaserDmxShowDirectorAnalysisIdentity(changedAnalysis)).not.toBe(createLaserDmxShowDirectorAnalysisIdentity(baseAnalysis))

    const base = buildLaserDmxShowDirectorPerformanceContext({ audioTimeSec: 10, frame: frame(), analysis: baseAnalysis, resolvedSections: sections })
    const editedSections = sections.map(section => section.id === 'drop-1'
      ? { ...section, label: 'Manual Drop Edit', intensity: 0.65, source: 'user-edited-auto' as const }
      : section)
    const edited = buildLaserDmxShowDirectorPerformanceContext({ audioTimeSec: 10, frame: frame(), analysis: baseAnalysis, resolvedSections: editedSections, previous: base })
    expect(edited.sectionIdentity).not.toBe(base.sectionIdentity)
    expect(edited.boundaries.timingDiscontinuity).toBe(true)
  })

  it('preserves musical boundary crossings across a dropped render interval without treating forward time as a seek', () => {
    const a = analysis()
    const before = buildLaserDmxShowDirectorPerformanceContext({ audioTimeSec: 7.9, frame: frame(), analysis: a, resolvedSections: sections })
    const after = buildLaserDmxShowDirectorPerformanceContext({ audioTimeSec: 16.1, frame: frame(), analysis: a, resolvedSections: sections, previous: before })
    expect(after.boundaries.timingDiscontinuity).toBe(false)
    expect(after.boundaries.fourBarBoundary).toBe(true)
    expect(after.boundaries.eightBarBoundary).toBe(true)
  })

  it('degrades safely without analysis while exposing neutral unsupported intelligence', () => {
    const context = buildLaserDmxShowDirectorPerformanceContext({
      audioTimeSec: 3,
      frame: frame({ rhythm: { ...DEFAULT_MI_FRAME.rhythm, bpm: 120, beatIndex: 6, beatPhase: 0 } }),
    })
    expect(context.analysisIdentity).toBeNull()
    expect(context.beatIndex).toBe(6)
    expect(context.intelligence.supports('stemVocals')).toBe(false)
    expect(context.intelligence.modulation('stemVocals')).toBe(0)
    expect(context.resolvedSection).toBeNull()
  })
})
