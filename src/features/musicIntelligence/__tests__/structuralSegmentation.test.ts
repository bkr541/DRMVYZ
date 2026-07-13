import { describe, expect, it } from 'vitest'
import { analyzeStructuralRegions } from '../sectionAnalysis'
import { applyReanalyze } from '../bpmReanalysis'
import { CURRENT_ANALYSIS_VERSION } from '../analysisVersion'
import { aggregateBarFeatures, buildBarMarkers, buildBeatMarkers, type MusicalFeatureCurves } from '../musicalGridAnalysis'
import { rebuildBpmDependentData } from '../../trackIntelligence/beatGridUtils'
import type {
  BarMusicalFeatures,
  FeatureCurve,
  MusicalGridInfo,
  TrackIntelligenceAnalysis,
} from '../types'

const GRID: MusicalGridInfo = {
  source: 'automatic',
  fallbackReason: null,
  timeSignature: 4,
  downbeatPhase: 0,
  beatPeriodSec: 0.5,
  authoritative: false,
  confidence: { bpm: 0.9, beatPhase: 0.9, downbeatPhase: 0.9, barGrid: 0.9 },
}

interface Profile {
  energy: number
  bass: number
  mid: number
  high: number
  centroid: number
  flux: number
  transient: number
  chroma: number
  silence?: number
}

const PROFILES: Record<string, Profile> = {
  A: { energy: 0.30, bass: 0.50, mid: 0.30, high: 0.20, centroid: 0.30, flux: 0.20, transient: 0.20, chroma: 0 },
  B: { energy: 0.78, bass: 0.68, mid: 0.20, high: 0.48, centroid: 0.76, flux: 0.78, transient: 0.80, chroma: 7 },
  C: { energy: 0.46, bass: 0.20, mid: 0.70, high: 0.30, centroid: 0.54, flux: 0.40, transient: 0.44, chroma: 4 },
  T: { energy: 0.06, bass: 0.05, mid: 0.08, high: 0.72, centroid: 0.92, flux: 1.00, transient: 1.00, chroma: 2, silence: 0.35 },
  QUIET: { energy: 0, bass: 0, mid: 0, high: 0, centroid: 0, flux: 0, transient: 0, chroma: -1, silence: 1 },
}

function makeBar(index: number, profile: Profile, overrides: Partial<BarMusicalFeatures> = {}): BarMusicalFeatures {
  const chromaSummary = new Array<number>(12).fill(0)
  if (profile.chroma >= 0) chromaSummary[profile.chroma] = 1
  return {
    barIndex: index,
    startSec: index * 2,
    endSec: (index + 1) * 2,
    source: 'bar_grid',
    gridSource: 'automatic',
    gridConfidence: 0.9,
    meanEnergy: profile.energy,
    peakEnergy: Math.min(1, profile.energy + 0.12),
    energySlope: 0,
    dynamicRange: profile.energy > 0 ? 0.2 : 0,
    bassAverage: profile.bass,
    midAverage: profile.mid,
    highAverage: profile.high,
    spectralFlux: profile.flux,
    spectralCentroid: profile.centroid,
    spectralComplexity: profile.energy > 0 ? 0.4 : 0,
    overallTransientDensity: profile.transient,
    lowFrequencyOnsetDensity: profile.transient,
    midFrequencyOnsetDensity: profile.transient * 0.7,
    highFrequencyOnsetDensity: profile.transient * 0.5,
    silenceRatio: profile.silence ?? 0,
    chromaSummary,
    harmonicChange: 0,
    ...overrides,
  }
}

function barsFromRuns(runs: Array<[keyof typeof PROFILES, number]>): BarMusicalFeatures[] {
  const bars: BarMusicalFeatures[] = []
  for (const [name, count] of runs) {
    for (let index = 0; index < count; index++) bars.push(makeBar(bars.length, PROFILES[name]!))
  }
  return bars
}

function emptyCurves() {
  return {
    energy: { instant: [], bass: [], mid: [], high: [] },
    spectral: { centroid: [], flux: [], complexity: [] },
  }
}

function analyzeBars(bars: BarMusicalFeatures[], grid: MusicalGridInfo = GRID) {
  const curves = emptyCurves()
  return analyzeStructuralRegions(curves.energy, curves.spectral, bars.length * 2, {
    barFeatures: bars,
    musicalGrid: grid,
  })
}

function selectedBars(result: ReturnType<typeof analyzeBars>): number[] {
  return result.structuralSegmentation.boundaryCandidates
    .filter(candidate => candidate.selected)
    .map(candidate => candidate.barIndex)
    .filter((barIndex): barIndex is number => barIndex != null)
}

function curve(durationSec: number, valueAt: (timeSec: number) => number, stepSec = 0.5): FeatureCurve {
  const result: FeatureCurve = []
  for (let timeSec = 0; timeSec <= durationSec + 1e-9; timeSec += stepSec) {
    result.push({ timeSec: Number(timeSec.toFixed(6)), value: valueAt(timeSec) })
  }
  return result
}

describe('bar-aligned self-similarity segmentation', () => {
  it('finds repeated A/B/A regions and links the structural return', () => {
    const result = analyzeBars(barsFromRuns([['A', 8], ['B', 8], ['A', 8]]))

    expect(result.structuralSegmentation.source).toBe('bar_self_similarity')
    expect(result.structuralSegmentation.regions.map(region => [region.startBar, region.endBar])).toEqual([
      [0, 8], [8, 16], [16, 24],
    ])
    expect(selectedBars(result)).toEqual([8, 16])
    expect(result.structuralSegmentation.regions[0]!.relatedRegions[0]).toMatchObject({
      regionId: 'structural-region-2',
    })
  })

  it('does not let a weaker early candidate suppress the stronger later boundary', () => {
    const bars = barsFromRuns([['A', 16]])
    bars[6] = makeBar(6, {
      ...PROFILES.A!,
      energy: 0.36,
      centroid: 0.37,
      flux: 0.28,
      transient: 0.27,
    })
    for (let index = 8; index < 16; index++) bars[index] = makeBar(index, PROFILES.B!)

    const result = analyzeBars(bars)
    const early = result.structuralSegmentation.boundaryCandidates.find(candidate => candidate.barIndex === 6)
    const later = result.structuralSegmentation.boundaryCandidates.find(candidate => candidate.barIndex === 8)

    expect(early).toBeDefined()
    expect(later).toBeDefined()
    expect(later!.totalScore).toBeGreaterThan(early!.totalScore)
    // The old greedy detector would accept the first peak and suppress the
    // stronger one inside its minimum-distance window. Global optimization
    // must retain the stronger musically aligned boundary regardless.
    expect(later!.selected).toBe(true)
  })

  it('uses soft four-, eight-, and sixteen-bar phrase preferences without inventing a mid-block cut', () => {
    const result = analyzeBars(barsFromRuns([['A', 4], ['B', 4], ['C', 8], ['A', 16]]))

    expect(result.structuralSegmentation.regions.map(region => region.durationBars)).toEqual([4, 4, 8, 16])
    expect(selectedBars(result)).toEqual([4, 8, 16])
  })

  it.each([1, 2])('preserves a strong %i-bar transition region', transitionBars => {
    const result = analyzeBars(barsFromRuns([['A', 8], ['T', transitionBars], ['B', 8]]))

    expect(result.structuralSegmentation.regions.map(region => region.durationBars)).toEqual([8, transitionBars, 8])
    expect(selectedBars(result)).toEqual([8, 8 + transitionBars])
  })

  it('keeps a quiet track stable and numerically finite', () => {
    const result = analyzeBars(barsFromRuns([['QUIET', 32]]))

    expect(result.structuralSegmentation.regions).toHaveLength(1)
    expect(selectedBars(result)).toEqual([])
    expect(JSON.stringify(result)).not.toContain('null')
    for (const candidate of result.structuralSegmentation.boundaryCandidates) {
      expect(Number.isFinite(candidate.totalScore)).toBe(true)
      expect(Number.isFinite(candidate.candidateConfidence)).toBe(true)
    }
  })

  it('retains boundaries around a very loud Drop without flattening the rest of the track', () => {
    const bars = barsFromRuns([['A', 8], ['B', 8], ['C', 8]])
    for (let index = 8; index < 16; index++) {
      bars[index] = makeBar(index, { ...PROFILES.B!, energy: 1, flux: 1, transient: 1 })
    }
    const result = analyzeBars(bars)

    expect(selectedBars(result)).toEqual([8, 16])
    expect(result.structuralSegmentation.regions).toHaveLength(3)
  })

  it('bounds matrix memory and persisted alternatives for unusually long tracks', () => {
    const bars: BarMusicalFeatures[] = []
    for (let index = 0; index < 2200; index++) {
      const profile = Math.floor(index / 32) % 2 === 0 ? PROFILES.A! : PROFILES.B!
      bars.push(makeBar(index, profile))
    }
    const result = analyzeBars(bars)
    const diagnostics = result.structuralSegmentation.diagnostics

    expect(diagnostics.originalBarCount).toBe(2200)
    expect(diagnostics.analyzedBarCount).toBeLessThanOrEqual(512)
    expect(diagnostics.selfSimilarityStride).toBeGreaterThan(1)
    expect(diagnostics.matrixBytes).toBeLessThanOrEqual(512 * 512 * 4)
    expect(result.structuralSegmentation.boundaryCandidates.length).toBeLessThanOrEqual(96)
    expect(result.structuralSegmentation.alternativeBoundaryCandidates.length).toBeLessThanOrEqual(32)
  })

  it('uses and clearly marks the deterministic time-domain fallback when grid confidence is inadequate', () => {
    const durationSec = 24
    const energy = curve(durationSec, time => time < 12 ? 0.2 : 0.85)
    const bass = curve(durationSec, time => time < 12 ? 0.25 : 0.8)
    const mid = curve(durationSec, time => time < 12 ? 0.3 : 0.2)
    const high = curve(durationSec, time => time < 12 ? 0.15 : 0.6)
    const flux = curve(durationSec, time => Math.abs(time - 12) < 0.6 ? 1 : 0.1)
    const lowConfidenceGrid: MusicalGridInfo = {
      ...GRID,
      confidence: { ...GRID.confidence, barGrid: 0.1 },
    }
    const result = analyzeStructuralRegions(
      { instant: energy, bass, mid, high },
      { centroid: high, flux, complexity: mid },
      durationSec,
      { barFeatures: barsFromRuns([['A', 12]]), musicalGrid: lowConfidenceGrid },
    )

    expect(result.structuralSegmentation.source).toBe('time_domain_fallback')
    expect(result.structuralSegmentation.diagnostics.usedFallback).toBe(true)
    expect(result.structuralSegmentation.boundaryCandidates.every(candidate => candidate.offGrid)).toBe(true)
    expect(result.structuralSegmentation.boundaryCandidates.every(candidate => candidate.candidateConfidence <= 0.45)).toBe(true)
  })

  it('is deterministic across repeated analysis', () => {
    const bars = barsFromRuns([['A', 8], ['T', 2], ['B', 8], ['A', 8]])
    const first = analyzeBars(bars)
    const second = analyzeBars(bars)

    expect(second).toEqual(first)
  })

  it('covers the full track without gaps, overlaps, negative regions, or off-grid primary cuts', () => {
    const bars = barsFromRuns([['A', 4], ['B', 8], ['T', 2], ['C', 16]])
    const result = analyzeBars(bars)
    const regions = result.structuralSegmentation.regions
    const barStarts = new Set(bars.map(bar => bar.startSec))

    expect(regions[0]!.startSec).toBe(0)
    expect(regions[regions.length - 1]!.endSec).toBe(bars.length * 2)
    for (let index = 0; index < regions.length; index++) {
      expect(regions[index]!.endSec).toBeGreaterThan(regions[index]!.startSec)
      if (index > 0) expect(regions[index]!.startSec).toBe(regions[index - 1]!.endSec)
    }
    for (const candidate of result.structuralSegmentation.boundaryCandidates.filter(candidate => candidate.selected)) {
      expect(candidate.offGrid).toBe(false)
      expect(barStarts.has(candidate.timeSec)).toBe(true)
    }
  })
})

describe('BPM reanalysis integration', () => {
  function makeAnalysis(): TrackIntelligenceAnalysis {
    const durationSec = 64
    const energy = curve(durationSec, time => time < 16 ? 0.28 : time < 32 ? 0.82 : time < 48 ? 0.42 : 0.28)
    const bass = curve(durationSec, time => time < 16 ? 0.42 : time < 32 ? 0.82 : time < 48 ? 0.24 : 0.42)
    const mid = curve(durationSec, time => time < 32 ? 0.30 : 0.62)
    const high = curve(durationSec, time => time < 16 ? 0.18 : time < 32 ? 0.58 : 0.28)
    const flux = curve(durationSec, time => [16, 32, 48].some(boundary => Math.abs(time - boundary) < 0.6) ? 1 : 0.18)
    const complexity = curve(durationSec, () => 0.4)
    const beatGrid = buildBeatMarkers(120, 0, durationSec)
    const barMarkers = buildBarMarkers(beatGrid, durationSec, 'automatic', 0.9)
    const features: MusicalFeatureCurves = {
      energy,
      bass,
      mid,
      high,
      spectralFlux: flux,
      spectralCentroid: high,
      spectralComplexity: complexity,
      transient: flux,
      lowFrequencyOnset: flux,
      midFrequencyOnset: flux,
      highFrequencyOnset: flux,
      silence: curve(durationSec, () => 0),
    }
    const barFeatures = aggregateBarFeatures(barMarkers, features, durationSec)
    const initial = analyzeStructuralRegions(
      { instant: energy, bass, mid, high },
      { centroid: high, flux, complexity },
      durationSec,
      { barFeatures, musicalGrid: GRID },
    )
    return {
      analysisVersion: CURRENT_ANALYSIS_VERSION,
      createdAt: '2026-07-13T00:00:00.000Z',
      durationMs: durationSec * 1000,
      bpm: 120,
      bpmConfidence: 0.9,
      beatPhaseConfidence: 0.9,
      downbeatPhaseConfidence: 0.9,
      barGridConfidence: 0.9,
      beatGridOffsetSec: 0,
      timeSignature: 4,
      beatGrid,
      downbeats: beatGrid.filter(marker => marker.isDownbeat),
      barMarkers,
      barFeatures,
      musicalGrid: GRID,
      phrases: [],
      sections: initial.sections,
      structuralSegmentation: initial.structuralSegmentation,
      energyCurves: { instant: energy, shortTerm: energy, bass, mid, high },
      spectralCurves: { centroid: high, flux, complexity },
      stemCurves: null,
      harmonic: {
        keyChanges: [], chordProgression: [], dominantKey: null, dominantMode: null, keyConfidence: 0,
        pitchCurve: [], melodyContourCurve: [],
      },
      lyrics: null,
      semanticMoments: [],
      warnings: [],
      errors: [],
      detectedBpm: 120,
      bpmUsedForGrid: 120,
      gridStale: false,
      lastGridRebuiltAt: null,
      lastReanalysisMode: 'full',
    }
  }

  it('uses the same structural implementation for initial-style analysis and BPM reanalysis', () => {
    const analysis = makeAnalysis()
    const gridData = rebuildBpmDependentData(analysis, 128)
    const direct = analyzeStructuralRegions(
      {
        instant: analysis.energyCurves.instant,
        bass: analysis.energyCurves.bass,
        mid: analysis.energyCurves.mid,
        high: analysis.energyCurves.high,
      },
      analysis.spectralCurves,
      analysis.durationMs / 1000,
      { barFeatures: gridData.barFeatures, musicalGrid: gridData.musicalGrid },
    )
    const reanalyzed = applyReanalyze(analysis, 128)

    expect(reanalyzed.structuralSegmentation).toEqual(direct.structuralSegmentation)
    expect(reanalyzed.sections.map(section => [section.startSec, section.endSec])).toEqual(
      direct.sections.map(section => [section.startSec, section.endSec]),
    )
  })

  it('preserves locked/manual sections and excludes overlapping automatic replacements', () => {
    const analysis = makeAnalysis()
    const protectedSection = {
      id: 'manual-break',
      label: 'Manual Break',
      type: 'breakdown' as const,
      startSec: 20,
      endSec: 26,
      intensity: 0.4,
      confidence: 1,
      source: 'manual' as const,
      locked: true,
    }
    const importedSection = {
      id: 'rekordbox-verse',
      label: 'Imported Verse',
      type: 'verse' as const,
      startSec: 40,
      endSec: 46,
      intensity: 0.55,
      confidence: 0.98,
      source: 'rekordbox' as const,
      locked: false,
    }
    analysis.sections = [...analysis.sections, protectedSection, importedSection]

    const result = applyReanalyze(analysis, 130)
    const preserved = result.sections.find(section => section.id === protectedSection.id)

    expect(preserved).toEqual(protectedSection)
    expect(result.sections.find(section => section.id === importedSection.id)).toEqual(importedSection)
    expect(result.sections.filter(section => section.id !== protectedSection.id).every(section => (
      section.endSec <= protectedSection.startSec || section.startSec >= protectedSection.endSec
    ))).toBe(true)
  })
})
