import { describe, expect, it } from 'vitest'
import { mapRekordboxMatchToDrmvyz } from './mapToDrmvyzAnalysis'
import type { RekordboxLibrary, RekordboxPhrase, RekordboxTrackMetadata } from './types'

const phrase: RekordboxPhrase = {
  phraseIndex: 0,
  sourceIndex: 1,
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
  fillStartBeat: 8,
  fillStartTimeSec: 3.5,
  sourceFlags: { fill: true, masked: false },
  sourcePayload: { kind: 2, beat: 1 },
}

function makeTrack(): RekordboxTrackMetadata {
  return {
    trackId: 'rb-track-1',
    name: 'PSSI Test Track',
    artist: 'Test Artist',
    bpm: 120,
    durationSec: 180,
    cues: [],
    phrases: [phrase],
    beatGrid: [
      { timeSec: 0, confidence: 0.98, isDownbeat: true, bpm: 120 },
      { timeSec: 0.5, confidence: 0.98, isDownbeat: false, bpm: 120 },
    ],
  }
}

describe('mapRekordboxMatchToDrmvyz PSSI transport', () => {
  it('carries native Rekordbox phrases separately without converting them into DRMVYZ phrases or Track Sections', () => {
    const track = makeTrack()
    const library: RekordboxLibrary = {
      id: 'library-1',
      source: 'rekordbox_usb',
      importedAt: '2026-08-16T00:00:00.000Z',
      tracks: [track],
      warnings: [],
      stats: {
        totalTracks: 1,
        tracksWithCues: 0,
        cues: 0,
        loops: 0,
        detectedPdbFiles: 1,
        detectedAnlzFiles: 2,
      },
    }

    const result = mapRekordboxMatchToDrmvyz({
      track,
      confidence: 0.99,
      reason: 'test match',
    }, library)

    expect(result.rekordboxPhrases).toEqual([phrase])
    expect(result.analysisSeed.phrases).toBeUndefined()
    expect(result.analysisSeed.sections).toEqual([])
    expect(result.cueMarkers).toEqual([])
    expect(result.cueRegions).toEqual([])
  })
})
