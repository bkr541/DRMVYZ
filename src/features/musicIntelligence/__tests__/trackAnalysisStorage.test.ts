import { describe, expect, it } from 'vitest'
import { boundTrackAnalysisForStorage, migrateTrackAnalysisStorageState } from '../trackAnalysisStorage'
import type { TrackIntelligenceAnalysis } from '../types'

function analysis(version = 'auto-4.0'): TrackIntelligenceAnalysis {
  return {
    analysisVersion: version, createdAt: '2026-07-13T00:00:00.000Z', durationMs: 60_000,
    bpm: 120, bpmConfidence: 0.9, beatGridOffsetSec: 0, timeSignature: 4,
    beatGrid: [], downbeats: [],
    phrases: Array.from({ length: 250 }, (_, index) => ({ timeSec: index * 0.25, phraseLength: 8 as const, confidence: 0.5 })),
    phraseHierarchy: {
      units: Array.from({ length: 1700 }, (_, index) => ({
        id: `unit-${index}`, level: 'beat' as const, startSec: index * 0.02, endSec: index * 0.02 + 0.02,
        startBar: null, endBar: null, confidence: 0.8, source: 'grid_derived' as const,
      })),
      sectionFamilies: [], sectionOccurrences: [],
    },
    sections: [],
    boundaryAlternatives: Array.from({ length: 40 }, (_, index) => ({
      id: `alt-${index}`, timeSec: index, barIndex: index, confidence: 0.5, rank: index + 1,
      reason: 'candidate', supportingSignals: [], source: 'bar_self_similarity' as const,
    })),
    energyCurves: { instant: [], shortTerm: [], bass: [], mid: [], high: [] },
    spectralCurves: { centroid: [], flux: [], complexity: [] },
    stemCurves: null,
    harmonic: { keyChanges: [], chordProgression: [], dominantKey: null, dominantMode: null, keyConfidence: 0, pitchCurve: [], melodyContourCurve: [] },
    lyrics: null,
    semanticMoments: Array.from({ length: 160 }, (_, index) => ({ timeSec: index * 0.2, type: 'section_entry' as const, confidence: 0.5 })),
    warnings: [], errors: [],
  }
}

describe('track analysis persistence migration', () => {
  it('bounds hierarchy, phrase, semantic, and boundary metadata', () => {
    const bounded = boundTrackAnalysisForStorage(analysis())

    expect(bounded.phrases).toHaveLength(192)
    expect(bounded.semanticMoments).toHaveLength(128)
    expect(bounded.boundaryAlternatives).toHaveLength(24)
    expect(bounded.phraseHierarchy?.units).toHaveLength(1536)
  })

  it('enriches legacy records and marks obsolete analysis versions stale', () => {
    const migrated = migrateTrackAnalysisStorageState({ analyses: { track: analysis('auto-3.0') }, statuses: { track: 'complete' } })
    const record = migrated.analyses?.track

    expect(migrated.statuses?.track).toBe('stale')
    expect(record?.phrases[0]).toMatchObject({ source: 'grid_derived', structurallyDetected: false, barIndex: null })
    expect(record?.phrases[0]?.id).toBeTruthy()
    expect(record?.semanticMoments[0]?.id).toBeTruthy()
  })

  it('quarantines corrupt persisted analysis without aborting hydration', () => {
    const migrated = migrateTrackAnalysisStorageState({
      analyses: {
        valid: analysis('auto-3.0'),
        corrupt: { analysisVersion: 'auto-6.0', durationMs: 10_000, sections: null },
        primitive: 'not-an-analysis',
      },
      statuses: { valid: 'complete', corrupt: 'complete', primitive: 'complete' },
    })

    expect(migrated.analyses?.valid).toBeTruthy()
    expect(migrated.analyses?.corrupt).toBeUndefined()
    expect(migrated.analyses?.primitive).toBeUndefined()
    expect(migrated.statuses?.corrupt).toBe('stale')
    expect(migrated.statuses?.primitive).toBe('stale')
  })

  it('preserves Stage 2 provenance and Rekordbox source data through JSON persistence', () => {
    const sourceAware: TrackIntelligenceAnalysis = {
      ...analysis('auto-6.0'),
      analysisSources: {
        bpm: 'rekordbox',
        beatGrid: 'rekordbox',
        key: 'drmvyz',
        trackSections: 'drmvyz',
      },
      trackProvenance: {
        trackOrigin: 'rekordbox',
        rekordboxSource: 'rekordbox_usb',
        rekordboxFeatureAvailability: { bpm: true, beatGrid: true, key: false, phrases: true },
      },
      rekordboxSourceData: {
        source: 'rekordbox_usb',
        featureAvailability: { bpm: true, beatGrid: true, key: false, phrases: true },
        phrases: [{
          phraseIndex: 0,
          sourceIndex: 1,
          sourceMood: 3,
          mood: 'high_energy',
          sourceKind: 5,
          rekordboxKind: 'chorus',
          sourceBank: 8,
          bank: 'club_2',
          sourceLabel: 'Chorus',
          normalizedLabel: 'chorus',
          startBeat: 33,
          endBeat: 65,
          startTimeSec: 16,
          endTimeSec: 32,
          fillStartBeat: 61,
          fillStartTimeSec: 30,
          sourceFlags: { fill: true },
          sourcePayload: { kind: 5, beat: 33, beatFill: 61 },
        }],
      },
    }

    const serialized = JSON.parse(JSON.stringify(boundTrackAnalysisForStorage(sourceAware))) as TrackIntelligenceAnalysis
    const migrated = migrateTrackAnalysisStorageState({ analyses: { track: serialized }, statuses: { track: 'complete' } })
    const restored = migrated.analyses?.track

    expect(restored?.analysisSources).toEqual(sourceAware.analysisSources)
    expect(restored?.trackProvenance).toEqual(sourceAware.trackProvenance)
    expect(restored?.rekordboxSourceData).toEqual(sourceAware.rekordboxSourceData)
  })

  it('loads pre-Stage-2 persisted analyses with safe DRMVYZ/ordinary defaults', () => {
    const legacy = analysis('auto-6.0')
    const migrated = migrateTrackAnalysisStorageState({ analyses: { track: legacy }, statuses: { track: 'complete' } })
    const restored = migrated.analyses?.track

    expect(restored?.analysisSources).toEqual({
      bpm: 'drmvyz',
      beatGrid: 'drmvyz',
      key: 'drmvyz',
      trackSections: 'drmvyz',
    })
    expect(restored?.trackProvenance).toEqual({ trackOrigin: 'ordinary' })
    expect(restored?.rekordboxSourceData).toBeUndefined()
  })

})
