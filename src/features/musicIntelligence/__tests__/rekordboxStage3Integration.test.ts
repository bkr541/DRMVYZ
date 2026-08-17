import { describe, expect, it } from 'vitest'
import { analyzeTrackBuffer } from '../offlineTrackAnalyzer'
import type { BeatMarkerMI } from '../types'
import type { RekordboxPhrase } from '../../rekordboxImport/sourceTypes'

function makeBuffer(durationSec = 8, sampleRate = 4_000): AudioBuffer {
  const length = Math.max(1, Math.round(durationSec * sampleRate))
  const channel = new Float32Array(length)
  for (let index = 0; index < length; index++) {
    const time = index / sampleRate
    const envelope = time < durationSec * 0.5 ? 0.14 : 0.32
    channel[index] = Math.sin(2 * Math.PI * 110 * time) * envelope
  }
  return {
    duration: durationSec,
    sampleRate,
    length,
    numberOfChannels: 1,
    getChannelData: () => channel,
  } as unknown as AudioBuffer
}

function rekordboxGrid(durationSec = 8): BeatMarkerMI[] {
  const count = Math.floor(durationSec / 0.5)
  return Array.from({ length: count }, (_, index) => ({
    timeSec: index * 0.5,
    confidence: 0.99,
    isDownbeat: index % 4 === 0,
    bpm: 120,
  }))
}

function phrase(index: number, kind: string, startTimeSec: number, endTimeSec: number): RekordboxPhrase {
  return {
    phraseIndex: index,
    sourceIndex: index + 1,
    sourceMood: kind === 'down' ? 1 : 2,
    mood: kind === 'down' ? 'high_energy' : 'mid_energy',
    sourceKind: index + 1,
    rekordboxKind: kind,
    sourceBank: 0,
    bank: 'default',
    sourceLabel: kind === 'verse_2' ? 'Verse 2' : kind.charAt(0).toUpperCase() + kind.slice(1),
    normalizedLabel: kind.startsWith('verse_') ? 'verse' : kind,
    startBeat: index * 4 + 1,
    endBeat: (index + 1) * 4 + 1,
    startTimeSec,
    endTimeSec,
    fillStartBeat: null,
    fillStartTimeSec: null,
    sourceFlags: { fill: false },
    sourcePayload: { kind, index },
  }
}

const analysisOptions = {
  fftSize: 256,
  hopSize: 128,
  maxCurvePoints: 80,
  minSectionSec: 1,
}

function validPssi(): RekordboxPhrase[] {
  return [
    phrase(0, 'intro', 0, 2),
    phrase(1, 'verse_2', 2, 4),
    phrase(2, 'up', 4, 6),
    phrase(3, 'down', 6, 8),
  ]
}

describe('Rekordbox Stage 3 Track Section precedence', () => {
  it('ordinary uploaded track uses native DRMVYZ sections', async () => {
    const result = await analyzeTrackBuffer(makeBuffer(), {
      ...analysisOptions,
      seed: { source: 'analysis', bpm: 120, bpmConfidence: 0.9 },
    })

    expect(result.sections.length).toBeGreaterThan(0)
    expect(result.sections.every(section => section.source !== 'rekordbox')).toBe(true)
    expect(result.analysisSources?.trackSections).toBe('drmvyz')
  })

  it('Rekordbox track with valid PSSI uses PSSI boundaries authoritatively', async () => {
    const grid = rekordboxGrid()
    const phrases = validPssi()
    const result = await analyzeTrackBuffer(makeBuffer(), {
      ...analysisOptions,
      seed: {
        source: 'rekordbox_usb',
        featureAvailability: { bpm: true, beatGrid: true, key: false, phrases: true },
        bpm: 120,
        beatGrid: grid,
        downbeats: grid.filter(beat => beat.isDownbeat),
        rekordboxPhrases: phrases,
      },
    })

    expect(result.sections.map(section => [section.startSec, section.endSec])).toEqual(
      phrases.map(item => [item.startTimeSec, item.endTimeSec]),
    )
    expect(result.sections.every(section => section.source === 'rekordbox' && section.locked)).toBe(true)
    expect(result.analysisSources?.trackSections).toBe('rekordbox')
    expect(result.structuralSegmentation).toBeUndefined()
  })

  it('Rekordbox track with no PSSI falls back to native sections', async () => {
    const grid = rekordboxGrid()
    const result = await analyzeTrackBuffer(makeBuffer(), {
      ...analysisOptions,
      seed: {
        source: 'rekordbox_usb',
        featureAvailability: { bpm: true, beatGrid: true, key: false, phrases: false },
        bpm: 120,
        beatGrid: grid,
        rekordboxPhrases: [],
      },
    })

    expect(result.sections.length).toBeGreaterThan(0)
    expect(result.sections.every(section => section.source !== 'rekordbox')).toBe(true)
    expect(result.analysisSources?.trackSections).toBe('drmvyz')
  })

  it('Rekordbox track with malformed PSSI transparently falls back to native sections', async () => {
    const grid = rekordboxGrid()
    const malformed = [
      phrase(0, 'intro', 0, 5),
      phrase(1, 'down', 4, 8),
    ]
    const result = await analyzeTrackBuffer(makeBuffer(), {
      ...analysisOptions,
      seed: {
        source: 'rekordbox_usb',
        featureAvailability: { bpm: true, beatGrid: true, key: false, phrases: true },
        bpm: 120,
        beatGrid: grid,
        rekordboxPhrases: malformed,
      },
    })

    expect(result.sections.length).toBeGreaterThan(0)
    expect(result.sections.every(section => section.source !== 'rekordbox')).toBe(true)
    expect(result.analysisSources?.trackSections).toBe('drmvyz')
    expect(result.warnings.some(warning => warning.includes('PSSI was not accepted'))).toBe(true)
  })

  it('valid PQTZ with no PSSI keeps Rekordbox grid and native DRMVYZ sections', async () => {
    const grid = rekordboxGrid()
    const result = await analyzeTrackBuffer(makeBuffer(), {
      ...analysisOptions,
      seed: {
        source: 'rekordbox_usb',
        featureAvailability: { bpm: true, beatGrid: true, key: false, phrases: false },
        bpm: 120,
        beatGrid: grid,
        rekordboxPhrases: [],
      },
    })

    expect(result.beatGrid.map(beat => beat.timeSec)).toEqual(grid.map(beat => beat.timeSec))
    expect(result.analysisSources).toMatchObject({ beatGrid: 'rekordbox', trackSections: 'drmvyz' })
  })

  it('valid PSSI plus valid grid independently uses Rekordbox for both features', async () => {
    const grid = rekordboxGrid()
    const result = await analyzeTrackBuffer(makeBuffer(), {
      ...analysisOptions,
      seed: {
        source: 'rekordbox_usb',
        featureAvailability: { bpm: true, beatGrid: true, key: false, phrases: true },
        bpm: 120,
        beatGrid: grid,
        rekordboxPhrases: validPssi(),
      },
    })

    expect(result.analysisSources).toMatchObject({ beatGrid: 'rekordbox', trackSections: 'rekordbox' })
    expect(result.beatGrid.map(beat => beat.timeSec)).toEqual(grid.map(beat => beat.timeSec))
  })

  it('PSSI boundaries remain exact even when they do not match native segmentation preferences', async () => {
    const grid = rekordboxGrid()
    const awkward = [
      phrase(0, 'intro', 0, 2.35),
      phrase(1, 'verse_2', 2.35, 4.7),
      phrase(2, 'outro', 4.7, 8),
    ]
    const result = await analyzeTrackBuffer(makeBuffer(), {
      ...analysisOptions,
      seed: {
        source: 'rekordbox_usb',
        featureAvailability: { bpm: true, beatGrid: true, key: false, phrases: true },
        bpm: 120,
        beatGrid: grid,
        rekordboxPhrases: awkward,
      },
    })

    expect(result.sections.map(section => section.startSec)).toEqual([0, 2.35, 4.7])
    expect(result.sections.map(section => section.endSec)).toEqual([2.35, 4.7, 8])
    expect(result.structuralSegmentation).toBeUndefined()
  })

  it('retains raw PSSI identity per section while DRMVYZ supplies semantic enrichment', async () => {
    const grid = rekordboxGrid()
    const result = await analyzeTrackBuffer(makeBuffer(), {
      ...analysisOptions,
      seed: {
        source: 'rekordbox_usb',
        featureAvailability: { bpm: true, beatGrid: true, key: false, phrases: true },
        bpm: 120,
        beatGrid: grid,
        rekordboxPhrases: validPssi(),
      },
    })

    expect(result.sections[1]?.interpretation?.rekordboxPhrase).toMatchObject({
      phraseIndex: 1,
      sourceIndex: 2,
      originalKind: 'verse_2',
      normalizedLabel: 'verse',
      sourceStartTimeSec: 2,
      sourceEndTimeSec: 4,
    })
    expect(result.sections[1]?.interpretation?.classificationDiagnostics?.evidence.length).toBeGreaterThan(0)
    expect(result.analysisSources?.trackSections).toBe('rekordbox')
  })
})
