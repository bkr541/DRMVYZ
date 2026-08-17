import { describe, expect, it } from 'vitest'
import { analyzeTrackBuffer } from '../offlineTrackAnalyzer'
import type { BeatMarkerMI } from '../types'
import type { RekordboxPhrase } from '../../rekordboxImport/types'

function makeBuffer(durationSec = 4, sampleRate = 8_000): AudioBuffer {
  const length = Math.max(1, Math.round(durationSec * sampleRate))
  const channel = new Float32Array(length)
  for (let index = 0; index < length; index++) {
    channel[index] = Math.sin(2 * Math.PI * 110 * index / sampleRate) * 0.2
  }
  return {
    duration: durationSec,
    sampleRate,
    length,
    numberOfChannels: 1,
    getChannelData: () => channel,
  } as unknown as AudioBuffer
}

function rekordboxGrid(): BeatMarkerMI[] {
  return Array.from({ length: 8 }, (_, index) => ({
    timeSec: index * 0.5,
    confidence: 0.99,
    isDownbeat: index % 4 === 0,
    bpm: 120,
  }))
}

const phrase: RekordboxPhrase = {
  phraseIndex: 0,
  sourceIndex: 1,
  sourceMood: 2,
  mood: 'mid_energy',
  sourceKind: 2,
  rekordboxKind: 'verse_1',
  sourceBank: 7,
  bank: 'club_1',
  sourceLabel: 'Verse 1',
  normalizedLabel: 'verse',
  startBeat: 1,
  endBeat: 9,
  startTimeSec: 0,
  endTimeSec: 4,
  fillStartBeat: 4,
  fillStartTimeSec: 1.5,
  sourceFlags: { fill: true, beatFill: 4, masked: true },
  sourcePayload: { kind: 2, beat: 1, beatFill: 4 },
}

const analysisOptions = {
  fftSize: 256,
  hopSize: 128,
  maxCurvePoints: 80,
}

describe('Rekordbox Stage 2 Track Intelligence integration', () => {
  it('uses valid PQTZ, transports PSSI unchanged, and records independent feature provenance', async () => {
    const grid = rekordboxGrid()
    const result = await analyzeTrackBuffer(makeBuffer(), {
      ...analysisOptions,
      seed: {
        source: 'rekordbox_usb',
        featureAvailability: { bpm: true, beatGrid: true, key: true, phrases: true },
        bpm: 120,
        beatGridOffsetSec: 0,
        beatGrid: grid,
        downbeats: grid.filter(beat => beat.isDownbeat),
        rekordboxPhrases: [phrase],
        key: 'C major',
        keyConfidence: 0.92,
      },
    })

    expect(result.beatGrid.map(beat => beat.timeSec)).toEqual(grid.map(beat => beat.timeSec))
    expect(result.analysisSources).toEqual({
      bpm: 'rekordbox',
      beatGrid: 'rekordbox',
      key: 'rekordbox',
      trackSections: 'rekordbox',
    })
    expect(result.trackProvenance).toMatchObject({
      trackOrigin: 'rekordbox',
      rekordboxSource: 'rekordbox_usb',
      rekordboxFeatureAvailability: { bpm: true, beatGrid: true, key: true, phrases: true },
    })
    expect(result.rekordboxSourceData?.phrases).toEqual([phrase])
    expect(result.rekordboxSourceData?.phrases[0]?.rekordboxKind).toBe('verse_1')
    expect(result.rekordboxSourceData?.phrases[0]?.normalizedLabel).toBe('verse')
    expect(result.rekordboxSourceData?.phrases[0]?.fillStartBeat).toBe(4)
  })

  it('keeps valid PQTZ authoritative when PSSI is missing', async () => {
    const grid = rekordboxGrid()
    const result = await analyzeTrackBuffer(makeBuffer(), {
      ...analysisOptions,
      seed: {
        source: 'rekordbox_usb',
        featureAvailability: { bpm: true, beatGrid: true, key: false, phrases: false },
        bpm: 120,
        beatGrid: grid,
        downbeats: grid.filter(beat => beat.isDownbeat),
        rekordboxPhrases: [],
      },
    })

    expect(result.analysisSources?.beatGrid).toBe('rekordbox')
    expect(result.rekordboxSourceData?.phrases).toEqual([])
    expect(result.trackProvenance?.rekordboxFeatureAvailability?.phrases).toBe(false)
  })

  it('preserves PSSI when Rekordbox beat-grid data is unavailable and falls back only the grid feature', async () => {
    const unresolvedPhrase: RekordboxPhrase = {
      ...phrase,
      startTimeSec: null,
      endTimeSec: null,
      fillStartTimeSec: null,
    }
    const result = await analyzeTrackBuffer(makeBuffer(), {
      ...analysisOptions,
      seed: {
        source: 'rekordbox_usb',
        featureAvailability: { bpm: true, beatGrid: false, key: false, phrases: true },
        bpm: 120,
        rekordboxPhrases: [unresolvedPhrase],
      },
    })

    expect(result.beatGrid.length).toBeGreaterThan(0)
    expect(result.beatGrid.every(beat => beat.gridSource === 'automatic')).toBe(true)
    expect(result.analysisSources).toMatchObject({ bpm: 'rekordbox', beatGrid: 'drmvyz' })
    expect(result.trackProvenance).toMatchObject({ trackOrigin: 'rekordbox' })
    expect(result.rekordboxSourceData?.phrases).toEqual([unresolvedPhrase])
  })

  it('rejects an unusable Rekordbox beat grid without discarding usable PSSI', async () => {
    const result = await analyzeTrackBuffer(makeBuffer(), {
      ...analysisOptions,
      seed: {
        source: 'rekordbox_usb',
        featureAvailability: { bpm: true, beatGrid: false, key: false, phrases: true },
        bpm: 120,
        beatGrid: [
          { timeSec: 0, confidence: 0.99, isDownbeat: true },
          { timeSec: 0.001, confidence: 0.99, isDownbeat: false },
        ],
        rekordboxPhrases: [phrase],
      },
    })

    expect(result.analysisSources).toMatchObject({ bpm: 'rekordbox', beatGrid: 'drmvyz' })
    expect(result.beatGrid.every(beat => beat.gridSource === 'automatic')).toBe(true)
    expect(result.rekordboxSourceData?.featureAvailability.beatGrid).toBe(false)
    expect(result.rekordboxSourceData?.phrases).toEqual([phrase])
  })

  it('keeps ordinary tracks fully DRMVYZ-sourced', async () => {
    const result = await analyzeTrackBuffer(makeBuffer(), {
      ...analysisOptions,
      seed: { source: 'analysis', bpm: 120, bpmConfidence: 0.9 },
    })

    expect(result.analysisSources).toEqual({
      bpm: 'drmvyz',
      beatGrid: 'drmvyz',
      key: 'drmvyz',
      trackSections: 'drmvyz',
    })
    expect(result.trackProvenance).toEqual({ trackOrigin: 'ordinary' })
    expect(result.rekordboxSourceData).toBeUndefined()
  })
})
