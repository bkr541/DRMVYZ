import { describe, expect, it } from 'vitest'
import { generateMusicalHierarchy } from '../musicalHierarchyAnalysis'
import type {
  BarMarkerMI,
  BeatMarkerMI,
  MusicalGridInfo,
  StructuralSegmentationAnalysis,
  TrackSectionMI,
} from '../types'

const GRID: MusicalGridInfo = {
  source: 'automatic',
  fallbackReason: null,
  timeSignature: 4,
  downbeatPhase: 0,
  beatPeriodSec: 0.5,
  authoritative: true,
  confidence: { bpm: 0.94, beatPhase: 0.92, downbeatPhase: 0.9, barGrid: 0.91 },
}

function makeBars(count: number): BarMarkerMI[] {
  return Array.from({ length: count }, (_, barIndex) => ({
    barIndex,
    startSec: barIndex * 2,
    endSec: (barIndex + 1) * 2,
    gridSource: 'automatic',
    gridConfidence: 0.91,
  }))
}

function makeBeats(barCount: number): BeatMarkerMI[] {
  return Array.from({ length: barCount * 4 }, (_, beatIndex) => ({
    timeSec: beatIndex * 0.5,
    confidence: 0.92,
    isDownbeat: beatIndex % 4 === 0,
    beatIndex,
    beatWithinBar: beatIndex % 4,
    barIndex: Math.floor(beatIndex / 4),
    gridSource: 'automatic',
    gridConfidence: 0.91,
  }))
}

function makeSection(
  id: string,
  type: TrackSectionMI['type'],
  startBar: number,
  endBar: number,
  familyId?: string,
  occurrenceIndex = 1,
): TrackSectionMI {
  return {
    id,
    label: `${type} ${occurrenceIndex}`,
    type,
    startSec: startBar * 2,
    endSec: endBar * 2,
    intensity: type === 'drop' ? 1 : 0.5,
    confidence: 0.86,
    boundaryConfidence: 0.84,
    labelConfidence: 0.88,
    gridConfidence: 0.91,
    source: 'analysis',
    interpretation: {
      startBar,
      endBar,
      durationBars: endBar - startBar,
      familyId,
      occurrenceIndex,
      familySimilarity: familyId ? 0.87 : undefined,
      isVariation: occurrenceIndex > 1,
    },
  }
}

function makeStructural(): StructuralSegmentationAnalysis {
  return {
    source: 'bar_self_similarity',
    regions: [
      {
        id: 'region-a', startSec: 0, endSec: 16, startBar: 0, endBar: 8, durationBars: 8,
        boundaryConfidence: 0.84, internalCohesion: 0.82, gridConfidence: 0.91,
        relatedRegions: [{ regionId: 'region-c', similarity: 0.82 }],
        analysisSource: 'bar_self_similarity',
        diagnostics: { meanEnergy: 0.4, energySlope: 0, transientDensity: 0.4, harmonicChange: 0.2, repeatAffinity: 0.82, phrasePriorScore: 0.8 },
      },
      {
        id: 'region-b', startSec: 16, endSec: 32, startBar: 8, endBar: 16, durationBars: 8,
        boundaryConfidence: 0.9, internalCohesion: 0.8, gridConfidence: 0.91,
        relatedRegions: [], analysisSource: 'bar_self_similarity',
        diagnostics: { meanEnergy: 0.8, energySlope: 0.2, transientDensity: 0.8, harmonicChange: 0.35, repeatAffinity: 0.2, phrasePriorScore: 0.9 },
      },
      {
        id: 'region-c', startSec: 32, endSec: 48, startBar: 16, endBar: 24, durationBars: 8,
        boundaryConfidence: 0.88, internalCohesion: 0.8, gridConfidence: 0.91,
        relatedRegions: [{ regionId: 'region-a', similarity: 0.82 }], analysisSource: 'bar_self_similarity',
        diagnostics: { meanEnergy: 0.84, energySlope: 0.1, transientDensity: 0.82, harmonicChange: 0.25, repeatAffinity: 0.82, phrasePriorScore: 0.9 },
      },
    ],
    boundaryCandidates: [
      {
        id: 'selected-8', barIndex: 8, timeSec: 16, totalScore: 0.92,
        acousticNovelty: 0.55, rhythmicNovelty: 0.72, harmonicNovelty: 0.4,
        selfSimilarityNovelty: 0.94, energyTransitionEvidence: 0.8, silenceOrImpactEvidence: 0.2,
        gridConfidence: 0.91, candidateConfidence: 0.9, selected: true, offGrid: false,
      },
    ],
    alternativeBoundaryCandidates: [
      {
        id: 'alternative-12', barIndex: 12, timeSec: 24, totalScore: 0.67,
        acousticNovelty: 0.4, rhythmicNovelty: 0.52, harmonicNovelty: 0.2,
        selfSimilarityNovelty: 0.58, energyTransitionEvidence: 0.61, silenceOrImpactEvidence: 0.1,
        gridConfidence: 0.91, candidateConfidence: 0.64, selected: false, offGrid: false,
      },
    ],
    diagnostics: {
      analyzedBarCount: 24, originalBarCount: 24, selfSimilarityStride: 1,
      matrixDimension: 24, matrixBytes: 2304, candidateCount: 2,
      selectedBoundaryCount: 1, alternativeCandidateCount: 1,
      globalObjectiveScore: 0.9, usedFallback: false,
    },
  }
}

describe('musical phrase hierarchy', () => {
  it('creates structural phrase markers from selected boundaries and repeated material', () => {
    const bars = makeBars(24)
    const result = generateMusicalHierarchy({
      durationSec: 48,
      beatGrid: makeBeats(24),
      barMarkers: bars,
      musicalGrid: GRID,
      sections: [
        makeSection('verse-a', 'verse', 0, 8, 'verse-family', 1),
        makeSection('drop-a', 'drop', 8, 16, 'drop-family', 1),
        makeSection('drop-b', 'drop', 16, 24, 'drop-family', 2),
      ],
      structuralSegmentation: makeStructural(),
    })

    const structural = result.phrases.find(phrase => phrase.barIndex === 8)
    expect(structural).toMatchObject({ structurallyDetected: true, relatedSectionId: 'drop-a' })
    expect(structural?.source).not.toBe('grid_derived')
    expect(structural?.supportingSignals?.length).toBeGreaterThan(0)
    expect(result.phraseHierarchy.units.some(unit => unit.level === 'sixteen_bar')).toBe(true)
    expect(result.phraseHierarchy.sectionFamilies.find(family => family.familyId === 'drop-family')?.occurrenceSectionIds).toEqual(['drop-a', 'drop-b'])
    expect(result.phraseHierarchy.sectionOccurrences.map(occurrence => occurrence.occurrenceIndex)).toContain(2)
    expect(result.boundaryAlternatives).toHaveLength(1)
    expect(result.boundaryAlternatives[0]).toMatchObject({ timeSec: 24, barIndex: 12, rank: 1 })
  })

  it('marks weak-evidence fallback phrases as grid-derived instead of structural', () => {
    const result = generateMusicalHierarchy({
      durationSec: 40,
      beatGrid: makeBeats(20),
      barMarkers: makeBars(20),
      musicalGrid: GRID,
      sections: [],
    })

    expect(result.phrases.length).toBeGreaterThan(1)
    expect(result.phrases.every(phrase => phrase.source === 'grid_derived')).toBe(true)
    expect(result.phrases.every(phrase => phrase.structurallyDetected === false)).toBe(true)
    expect(result.phrases.map(phrase => phrase.barIndex)).toContain(8)
  })
})
