import { beforeEach, describe, expect, it } from 'vitest'
import type { StemFeatureCurve, TrackIntelligenceAnalysis } from '../types'
import { AudioFeatureBus } from '../AudioFeatureBus'
import { MusicIntelligenceEngine } from '../MusicIntelligenceEngine'

const EMPTY_CURVE: Array<{ timeSec: number; value: number }> = []
const VALUE_CURVE = [{ timeSec: 0, value: 0.5 }]

function stemCurves(): StemFeatureCurve {
  const track = { energy: VALUE_CURVE, rms: VALUE_CURVE, transient: VALUE_CURVE }
  return { vocals: track, drums: track, bass: track, instruments: track, other: track }
}

function analysis(overrides: Partial<TrackIntelligenceAnalysis> = {}): TrackIntelligenceAnalysis {
  return {
    analysisVersion: 'test',
    createdAt: '2026-07-01T00:00:00.000Z',
    durationMs: 120000,
    bpm: 128,
    bpmConfidence: 0.95,
    beatGridOffsetSec: 0,
    timeSignature: 4,
    beatGrid: [{ timeSec: 0, confidence: 1, isDownbeat: true }],
    downbeats: [{ timeSec: 0, confidence: 1, isDownbeat: true }],
    phrases: [],
    sections: [{
      id: 'section-1',
      label: 'Drop',
      type: 'drop',
      startSec: 0,
      endSec: 30,
      intensity: 1,
      confidence: 0.9,
    }],
    energyCurves: {
      instant: VALUE_CURVE,
      shortTerm: VALUE_CURVE,
      bass: VALUE_CURVE,
      mid: VALUE_CURVE,
      high: VALUE_CURVE,
    },
    spectralCurves: {
      centroid: EMPTY_CURVE,
      flux: EMPTY_CURVE,
      complexity: EMPTY_CURVE,
    },
    stemCurves: stemCurves(),
    harmonic: {
      keyChanges: [],
      chordProgression: [],
      dominantKey: null,
      dominantMode: null,
      keyConfidence: 0,
      pitchCurve: EMPTY_CURVE,
      melodyContourCurve: EMPTY_CURVE,
    },
    lyrics: null,
    semanticMoments: [],
    warnings: [],
    errors: [],
    ...overrides,
  }
}

describe('Music Intelligence capability lifecycle', () => {
  let engine: MusicIntelligenceEngine

  beforeEach(() => {
    AudioFeatureBus.reset()
    engine = new MusicIntelligenceEngine()
  })

  it('publishes offline capabilities when analysis completes', () => {
    engine.setSourceId('track-a', 'track-a')
    engine.setTrackAnalysis(analysis())

    expect(AudioFeatureBus.getFrame().capabilities).toMatchObject({
      beatGrid: true,
      sections: true,
      trackEnergyCurve: true,
      stemCurves: true,
      lyrics: false,
    })
  })

  it('publishes Stage 2 analysis provenance and Rekordbox source data into runtime Music Intelligence frames', () => {
    engine.setSourceId('track-a', 'track-a')
    engine.setTrackAnalysis(analysis({
      analysisSources: { bpm: 'rekordbox', beatGrid: 'rekordbox', key: 'drmvyz', trackSections: 'drmvyz' },
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
          sourceMood: 2,
          mood: 'mid_energy',
          sourceKind: 2,
          rekordboxKind: 'verse_1',
          sourceBank: 0,
          bank: 'default',
          sourceLabel: 'Verse 1',
          normalizedLabel: 'verse',
          startBeat: 1,
          endBeat: 9,
          startTimeSec: 0,
          endTimeSec: 4,
          fillStartBeat: null,
          fillStartTimeSec: null,
          sourceFlags: { fill: false },
          sourcePayload: { kind: 2 },
        }],
      },
    }))

    expect(AudioFeatureBus.getFrame()).toMatchObject({
      analysisSources: { bpm: 'rekordbox', beatGrid: 'rekordbox', key: 'drmvyz', trackSections: 'drmvyz' },
      trackProvenance: { trackOrigin: 'rekordbox', rekordboxSource: 'rekordbox_usb' },
      rekordboxSourceData: { source: 'rekordbox_usb', phrases: [expect.objectContaining({ rekordboxKind: 'verse_1' })] },
    })

    engine.updateFromAudioFrame({
      freqBuf: new Uint8Array(32),
      timeBuf: new Uint8Array(64),
      sampleRate: 44_100,
      audioTime: 1,
      isPlaying: true,
    })

    expect(AudioFeatureBus.getFrame()).toMatchObject({
      analysisSources: { bpm: 'rekordbox', beatGrid: 'rekordbox', key: 'drmvyz', trackSections: 'drmvyz' },
      trackProvenance: { trackOrigin: 'rekordbox', rekordboxSource: 'rekordbox_usb' },
      rekordboxSourceData: { source: 'rekordbox_usb', phrases: [expect.objectContaining({ normalizedLabel: 'verse' })] },
    })
  })

  it('clears stale capabilities when a track is replaced or removed', () => {
    engine.setSourceId('track-a', 'track-a')
    engine.setTrackAnalysis(analysis())
    engine.setSourceId('track-b', 'track-b')

    expect(AudioFeatureBus.getFrame()).toMatchObject({
      sourceId: 'track-b',
      trackId: 'track-b',
      capabilities: {
        liveBands: false,
        rhythmEvents: false,
        beatGrid: false,
        sections: false,
        trackEnergyCurve: false,
        stemCurves: false,
        lyrics: false,
      },
    })

    engine.setSourceId(null, null)
    expect(AudioFeatureBus.getFrame()).toMatchObject({
      sourceId: null,
      trackId: null,
      capabilities: {
        beatGrid: false,
        sections: false,
        trackEnergyCurve: false,
        stemCurves: false,
        lyrics: false,
      },
    })
  })

  it('updates sections immediately when manual section data changes', () => {
    engine.setSourceId('track-a', 'track-a')
    engine.setTrackAnalysis(analysis({ sections: [] }))
    expect(AudioFeatureBus.getFrame().capabilities?.sections).toBe(false)

    engine.setManualSections([{
      id: 'manual-1',
      label: 'Manual Drop',
      type: 'drop',
      startSec: 5,
      endSec: 20,
      intensity: 1,
      source: 'manual',
    }])
    expect(AudioFeatureBus.getFrame().capabilities?.sections).toBe(true)

    engine.setManualSections([])
    expect(AudioFeatureBus.getFrame().capabilities?.sections).toBe(false)
  })

  it('updates timed-lyrics capability when lyrics become available or are cleared', () => {
    engine.setSourceId('track-a', 'track-a')
    engine.setActiveLyrics({
      sourceIdentity: 'track-a:lyrics-1',
      cues: [{ id: 'cue-1', startMs: 0, endMs: 1000, text: 'Hello' }],
    })
    expect(AudioFeatureBus.getFrame().capabilities?.lyrics).toBe(true)

    engine.setActiveLyrics({ sourceIdentity: 'track-a:lyrics-1', cues: [] })
    expect(AudioFeatureBus.getFrame().capabilities?.lyrics).toBe(false)
  })
})
