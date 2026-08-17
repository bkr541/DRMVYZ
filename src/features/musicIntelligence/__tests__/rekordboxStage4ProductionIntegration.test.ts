import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createRemoteRuntimeTrack } from '../../../audio/runtimeTrack'
import { DEFAULT_TRACK_ANALYSIS_RUNTIME } from '../../../types'
import { computeAnalysisKey, computeImportedGridRevision } from '../../trackIntelligence/TrackAnalysisCoordinator'
import { adaptMIAnalysis } from '../../trackIntelligence/trackMapAdapter'
import { resolveAuthoritativeTimeline, resolveSectionAtTime, timelineRevision } from '../../trackIntelligence/authoritativeTimeline'
import { withTrackAnalysisCompatibilityDefaults } from '../analysisCompatibility'
import { CURRENT_ANALYSIS_VERSION } from '../analysisVersion'
import { AudioFeatureBus } from '../AudioFeatureBus'
import { MusicIntelligenceEngine } from '../MusicIntelligenceEngine'
import { analyzeTrackBuffer } from '../offlineTrackAnalyzer'
import { getConditionSourceValue, getMusicIntelligenceSourceValue } from '../selectors'
import { boundTrackAnalysisForStorage } from '../trackAnalysisStorage'
import type { BeatMarkerMI, TrackIntelligenceAnalysis } from '../types'
import type { RekordboxAnalysisSeed } from '../../rekordboxImport/types'
import type { RekordboxPhrase, RekordboxPssiIntegrity } from '../../rekordboxImport/sourceTypes'

function makeBuffer(durationSec = 8, sampleRate = 4_000): AudioBuffer {
  const length = Math.max(1, Math.round(durationSec * sampleRate))
  const channel = new Float32Array(length)
  for (let index = 0; index < length; index++) {
    const time = index / sampleRate
    const section = Math.floor(time / 2)
    const amplitude = [0.10, 0.24, 0.42, 0.72][section] ?? 0.18
    channel[index] = Math.sin(2 * Math.PI * 110 * time) * amplitude
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
  return Array.from({ length: Math.floor(durationSec / 0.5) }, (_, index) => ({
    timeSec: index * 0.5,
    confidence: 0.99,
    isDownbeat: index % 4 === 0,
    bpm: 120,
  }))
}

function phrase(index: number, kind: string, startTimeSec: number | null, endTimeSec: number | null): RekordboxPhrase {
  return {
    phraseIndex: index,
    sourceIndex: index + 1,
    sourceMood: kind === 'down' ? 1 : 2,
    mood: kind === 'down' ? 'high_energy' : 'mid_energy',
    sourceKind: index + 1,
    rekordboxKind: kind,
    sourceBank: 0,
    bank: 'default',
    sourceLabel: kind,
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

function validPssi(): RekordboxPhrase[] {
  return [
    phrase(0, 'intro', 0, 2),
    phrase(1, 'verse_2', 2, 4),
    phrase(2, 'up', 4, 6),
    phrase(3, 'down', 6, 8),
  ]
}

function completePssiIntegrity(count: number, overrides: Partial<RekordboxPssiIntegrity> = {}): RekordboxPssiIntegrity {
  return { detected: true, version: 0, entrySize: 24, declaredEntryCount: count, readableEntryCount: count, complete: true, masked: false, supported: true, warnings: [], ...overrides }
}

function rbSeed(overrides: Partial<RekordboxAnalysisSeed> = {}): RekordboxAnalysisSeed {
  const grid = rekordboxGrid()
  const phrases = overrides.rekordboxPhrases ?? validPssi()
  const integrity = Object.prototype.hasOwnProperty.call(overrides, 'rekordboxPssiIntegrity')
    ? overrides.rekordboxPssiIntegrity
    : phrases.length > 0 ? completePssiIntegrity(phrases.length) : null
  return {
    source: 'rekordbox_usb',
    featureAvailability: { bpm: true, beatGrid: true, key: false, phrases: true },
    bpm: 120,
    beatGrid: grid,
    downbeats: grid.filter(beat => beat.isDownbeat),
    rekordboxPhrases: phrases,
    rekordboxPssiIntegrity: integrity,
    ...overrides,
  }
}

const options = { fftSize: 256, hopSize: 128, maxCurvePoints: 80, minSectionSec: 1 }

let normal: TrackIntelligenceAnalysis
let fullRekordbox: TrackIntelligenceAnalysis
let gridOnly: TrackIntelligenceAnalysis
let badGridAndPssi: TrackIntelligenceAnalysis
let malformedPssi: TrackIntelligenceAnalysis
let truncatedPssi: TrackIntelligenceAnalysis
let unsupportedPssi: TrackIntelligenceAnalysis
let pssiWithNativeGridFallback: TrackIntelligenceAnalysis

describe('Rekordbox Stage 4 production lifecycle', () => {
  beforeAll(async () => {
    normal = await analyzeTrackBuffer(makeBuffer(), options)
    fullRekordbox = await analyzeTrackBuffer(makeBuffer(), { ...options, seed: rbSeed() })
    gridOnly = await analyzeTrackBuffer(makeBuffer(), {
      ...options,
      seed: rbSeed({
        featureAvailability: { bpm: true, beatGrid: true, key: false, phrases: false },
        rekordboxPhrases: [],
      }),
    })
    badGridAndPssi = await analyzeTrackBuffer(makeBuffer(), {
      ...options,
      seed: rbSeed({
        featureAvailability: { bpm: true, beatGrid: true, key: false, phrases: true },
        beatGrid: [{ timeSec: 0, confidence: 1, isDownbeat: true }],
        downbeats: [],
        rekordboxPhrases: [phrase(0, 'intro', null, null), phrase(1, 'down', null, null)],
      }),
    })
    malformedPssi = await analyzeTrackBuffer(makeBuffer(), {
      ...options,
      seed: rbSeed({
        rekordboxPhrases: [phrase(0, 'intro', 0, 5), phrase(1, 'down', 4, 8)],
      }),
    })
    truncatedPssi = await analyzeTrackBuffer(makeBuffer(), {
      ...options,
      seed: rbSeed({
        rekordboxPhrases: [phrase(0, 'intro', 0, 2), phrase(1, 'verse_2', 2, null)],
        rekordboxPssiIntegrity: completePssiIntegrity(3, {
          readableEntryCount: 2,
          complete: false,
          warnings: ['fixture: truncated final PSSI entry'],
        }),
      }),
    })
    unsupportedPssi = await analyzeTrackBuffer(makeBuffer(), {
      ...options,
      seed: rbSeed({
        featureAvailability: { bpm: true, beatGrid: true, key: false, phrases: false },
        rekordboxPhrases: [],
        rekordboxPssiIntegrity: completePssiIntegrity(0, {
          version: 2,
          supported: false,
          masked: null,
          complete: false,
          warnings: ['fixture: unsupported PSSI version 2'],
        }),
      }),
    })
    pssiWithNativeGridFallback = await analyzeTrackBuffer(makeBuffer(), {
      ...options,
      seed: rbSeed({
        featureAvailability: { bpm: true, beatGrid: false, key: false, phrases: true },
        beatGrid: [{ timeSec: 0, confidence: 1, isDownbeat: true }],
        downbeats: [],
        rekordboxPhrases: validPssi(),
      }),
    })
  }, 30_000)

  beforeEach(() => AudioFeatureBus.reset())

  it('A: normal upload keeps native beat-grid and Track Section behavior', () => {
    expect(normal.analysisSources).toMatchObject({ beatGrid: 'drmvyz', trackSections: 'drmvyz' })
    expect(normal.trackProvenance).toEqual({ trackOrigin: 'ordinary' })
    expect(normal.analysisDiagnostics?.rekordbox).toBeUndefined()
  })

  it('B: PQTZ + PSSI independently select Rekordbox timing while DRMVYZ enriches fixed regions', () => {
    expect(fullRekordbox.analysisSources).toMatchObject({ beatGrid: 'rekordbox', trackSections: 'rekordbox' })
    expect(fullRekordbox.sections.map(section => [section.startSec, section.endSec])).toEqual([
      [0, 2], [2, 4], [4, 6], [6, 8],
    ])
    expect(fullRekordbox.sections.every(section => section.source === 'rekordbox' && section.locked)).toBe(true)
    expect(fullRekordbox.sections.every(section => (section.interpretation?.classificationDiagnostics?.evidence.length ?? 0) > 0)).toBe(true)
    expect(fullRekordbox.analysisDiagnostics?.rekordbox).toMatchObject({
      imported: true,
      beatGridAvailable: true,
      pssiAvailable: true,
      beatGridSource: 'rekordbox',
      trackSectionsSource: 'rekordbox',
      importedPhraseCount: 4,
      pssiAccepted: true,
      nativeBeatGridFallbackUsed: false,
      nativeTrackSectionFallbackUsed: false,
      pssiFallbackReason: null,
    })
  })

  it('C: PQTZ without PSSI keeps Rekordbox beat timing and falls back only Track Sections', () => {
    expect(gridOnly.analysisSources).toMatchObject({ beatGrid: 'rekordbox', trackSections: 'drmvyz' })
    expect(gridOnly.analysisDiagnostics?.rekordbox).toMatchObject({
      beatGridAvailable: true,
      pssiAvailable: false,
      pssiAccepted: false,
      nativeBeatGridFallbackUsed: false,
      nativeTrackSectionFallbackUsed: true,
      pssiFallbackReason: 'No Rekordbox PSSI phrases are available.',
    })
  })

  it('D: PSSI with an unusable Rekordbox grid fails safely into independent native timing/structure', () => {
    expect(badGridAndPssi.beatGrid.length).toBeGreaterThan(1)
    expect(badGridAndPssi.analysisSources).toMatchObject({ beatGrid: 'drmvyz', trackSections: 'drmvyz' })
    expect(badGridAndPssi.analysisDiagnostics?.rekordbox).toMatchObject({
      beatGridAvailable: false,
      pssiAvailable: true,
      pssiAccepted: false,
      nativeBeatGridFallbackUsed: true,
      nativeTrackSectionFallbackUsed: true,
    })
    expect(badGridAndPssi.analysisDiagnostics?.rekordbox?.pssiFallbackReason).toContain('unresolved/non-finite timing')
  })

  it('keeps PSSI section authority independent when PQTZ is unusable but PSSI timestamps are still valid', () => {
    expect(pssiWithNativeGridFallback.analysisSources).toMatchObject({ beatGrid: 'drmvyz', trackSections: 'rekordbox' })
    expect(pssiWithNativeGridFallback.sections.map(section => [section.startSec, section.endSec])).toEqual([
      [0, 2], [2, 4], [4, 6], [6, 8],
    ])
    expect(pssiWithNativeGridFallback.analysisDiagnostics?.rekordbox).toMatchObject({
      beatGridAvailable: false,
      pssiAvailable: true,
      pssiAccepted: true,
      nativeBeatGridFallbackUsed: true,
      nativeTrackSectionFallbackUsed: false,
    })
  })

  it('E: malformed PSSI records a structured rejection reason and completes with native sections', () => {
    expect(malformedPssi.sections.length).toBeGreaterThan(0)
    expect(malformedPssi.analysisSources?.trackSections).toBe('drmvyz')
    expect(malformedPssi.analysisDiagnostics?.rekordbox).toMatchObject({
      pssiAvailable: true,
      pssiAccepted: false,
      nativeTrackSectionFallbackUsed: true,
    })
    expect(malformedPssi.analysisDiagnostics?.rekordbox?.pssiFallbackReason).toContain('overlap')
  })

  it('rejects truncated/incomplete PSSI without poisoning a valid Rekordbox beat grid', () => {
    expect(truncatedPssi.analysisSources).toMatchObject({ beatGrid: 'rekordbox', trackSections: 'drmvyz' })
    expect(truncatedPssi.analysisDiagnostics?.rekordbox).toMatchObject({
      beatGridSource: 'rekordbox',
      pssiDetected: true,
      pssiDeclaredPhraseCount: 3,
      pssiReadablePhraseCount: 2,
      pssiComplete: false,
      pssiAccepted: false,
      nativeBeatGridFallbackUsed: false,
      nativeTrackSectionFallbackUsed: true,
    })
    expect(truncatedPssi.analysisDiagnostics?.rekordbox?.pssiFallbackReason).toContain('incomplete')
    expect(truncatedPssi.analysisDiagnostics?.rekordbox?.pssiParserWarnings).toContain('fixture: truncated final PSSI entry')
  })

  it('rejects unsupported PSSI versions while preserving independent Rekordbox timing features', () => {
    expect(unsupportedPssi.analysisSources).toMatchObject({ beatGrid: 'rekordbox', trackSections: 'drmvyz' })
    expect(unsupportedPssi.analysisDiagnostics?.rekordbox).toMatchObject({
      pssiDetected: true,
      pssiVersion: 2,
      pssiAccepted: false,
      nativeBeatGridFallbackUsed: false,
      nativeTrackSectionFallbackUsed: true,
    })
    expect(unsupportedPssi.analysisDiagnostics?.rekordbox?.pssiFallbackReason).toContain('unsupported')
  })

  it('F: persistence/reload preserves boundaries/provenance and restores the seed required for later re-analysis', () => {
    const stored = boundTrackAnalysisForStorage(fullRekordbox)
    const hydrated = withTrackAnalysisCompatibilityDefaults(JSON.parse(JSON.stringify(stored)) as TrackIntelligenceAnalysis)
    const remote = createRemoteRuntimeTrack({
      name: 'rekordbox-saved.wav',
      url: 'https://example.test/rekordbox-saved.wav?token=first',
      dbId: 'rb-saved-track',
      duration: hydrated.durationMs / 1000,
      analysisRuntime: {
        ...DEFAULT_TRACK_ANALYSIS_RUNTIME,
        status: 'complete',
        analysisVersion: CURRENT_ANALYSIS_VERSION,
        analysisKey: '',
        analysis: hydrated,
      },
    })

    expect(remote.analysisRuntime.analysis?.sections.map(section => [section.startSec, section.endSec])).toEqual(
      fullRekordbox.sections.map(section => [section.startSec, section.endSec]),
    )
    expect(remote.analysisRuntime.analysis?.analysisSources).toEqual(fullRekordbox.analysisSources)
    expect(remote.analysisRuntime.analysis?.analysisDiagnostics?.rekordbox).toEqual(fullRekordbox.analysisDiagnostics?.rekordbox)
    expect(remote.importedAnalysisSeed?.rekordboxPhrases).toEqual(fullRekordbox.rekordboxSourceData?.phrases)
    expect(remote.importedAnalysisSeed?.rekordboxPssiIntegrity).toEqual(fullRekordbox.rekordboxSourceData?.pssiIntegrity)
    expect(remote.importedAnalysisSeed?.beatGrid?.map(beat => beat.timeSec)).toEqual(fullRekordbox.beatGrid.map(beat => beat.timeSec))
    expect(remote.analysisRuntime.analysisKey).toContain(`:${CURRENT_ANALYSIS_VERSION}`)
    expect(remote.analysisRuntime.analysisKey).toContain(':imported-grid=')
  })

  it('G: Track Map/current-section/runtime selectors are source-neutral and exact at section transitions', () => {
    const importedTimeline = resolveAuthoritativeTimeline({
      analyzedSections: adaptMIAnalysis(fullRekordbox),
      durationSec: fullRekordbox.durationMs / 1000,
    })
    expect(importedTimeline).toHaveLength(fullRekordbox.sections.length)
    expect(importedTimeline.map(section => [section.startSec, section.endSec])).toEqual([
      [0, 2], [2, 4], [4, 6], [6, 8],
    ])
    expect(resolveSectionAtTime(importedTimeline, 2)?.id).toBe(importedTimeline[1]?.id)
    expect(resolveSectionAtTime(importedTimeline, 6)?.id).toBe(importedTimeline[3]?.id)
    expect(timelineRevision(importedTimeline)).toBe(timelineRevision(resolveAuthoritativeTimeline({
      analyzedSections: adaptMIAnalysis(fullRekordbox),
      durationSec: 8,
    })))

    const engine = new MusicIntelligenceEngine()
    engine.setSourceId('runtime-source', 'runtime-track')
    engine.setTrackAnalysis(fullRekordbox)
    for (const section of fullRekordbox.sections) {
      const time = Math.min(section.endSec - 0.001, section.startSec + 0.01)
      engine.resolveLyricsAt(time, 'discontinuous')
      const frame = AudioFeatureBus.getFrame()
      expect(frame.section.type).toBe(section.type)
      expect(getMusicIntelligenceSourceValue(frame, 'sectionType')).toBe(section.type)
      for (const [key, type] of [
        ['isDrop', 'drop'], ['isBuild', 'build'], ['isVerse', 'verse'], ['isBreakdown', 'breakdown'], ['isBridge', 'bridge'], ['isIntro', 'intro'], ['isOutro', 'outro'],
      ] as const) {
        expect(getConditionSourceValue(frame, key)).toBe(section.type === type)
      }
    }
    expect(AudioFeatureBus.getFrame().analysisDiagnostics?.rekordbox?.trackSectionsSource).toBe('rekordbox')
  })

  it('keeps cache/seed revisions deterministic for identical PSSI and changes them when source timing changes', () => {
    const first = rbSeed()
    const second = rbSeed()
    expect(computeImportedGridRevision(first)).toBe(computeImportedGridRevision(second))

    const trackLike = { sourceKind: 'remote' as const, url: 'https://example.test/song.wav?token=a', importedAnalysisSeed: first }
    const sameTrackLike = { sourceKind: 'remote' as const, url: 'https://example.test/song.wav?token=b', importedAnalysisSeed: second }
    expect(computeAnalysisKey(trackLike)).toBe(computeAnalysisKey(sameTrackLike))

    const changed = rbSeed({ rekordboxPhrases: validPssi().map((item, index) => index === 1 ? { ...item, startTimeSec: 2.125 } : item) })
    expect(computeImportedGridRevision(changed)).not.toBe(computeImportedGridRevision(first))
  })

  it('invalidates pre-hardening cached analyses while retaining their recoverable Rekordbox seed for re-analysis', () => {
    const oldAnalysis = { ...fullRekordbox, analysisVersion: 'auto-6.1' }
    const remote = createRemoteRuntimeTrack({
      name: 'cached-rb.wav',
      url: 'https://example.test/cached-rb.wav',
      analysisRuntime: {
        ...DEFAULT_TRACK_ANALYSIS_RUNTIME,
        status: 'complete',
        analysisVersion: 'auto-6.1',
        analysisKey: 'old-key',
        analysis: oldAnalysis,
      },
    })

    expect(remote.analysisRuntime.analysisVersion).toBe(CURRENT_ANALYSIS_VERSION)
    expect(remote.analysisRuntime.status).toBe('queued')
    expect(remote.analysisRuntime.analysis).toBeNull()
    expect(remote.importedAnalysisSeed?.rekordboxPhrases).toHaveLength(validPssi().length)
    expect(remote.analysisRuntime.analysisKey).toContain(`:${CURRENT_ANALYSIS_VERSION}`)
    expect(remote.analysisRuntime.analysisKey).toContain(':imported-grid=')
  })

  it('loads an old Rekordbox snapshot with no PSSI integrity safely and reanalyzes with independent Rekordbox grid/native sections', async () => {
    const oldAnalysis = JSON.parse(JSON.stringify({ ...fullRekordbox, analysisVersion: 'auto-6.1' })) as TrackIntelligenceAnalysis
    if (oldAnalysis.rekordboxSourceData) delete oldAnalysis.rekordboxSourceData.pssiIntegrity
    const remote = createRemoteRuntimeTrack({
      name: 'cached-rb-no-integrity.wav',
      url: 'https://example.test/cached-rb-no-integrity.wav',
      analysisRuntime: {
        ...DEFAULT_TRACK_ANALYSIS_RUNTIME,
        status: 'complete',
        analysisVersion: 'auto-6.1',
        analysisKey: 'old-no-integrity-key',
        analysis: oldAnalysis,
      },
    })

    expect(remote.analysisRuntime.status).toBe('queued')
    expect(remote.analysisRuntime.analysis).toBeNull()
    expect(remote.importedAnalysisSeed?.rekordboxPssiIntegrity).toBeNull()
    expect(remote.importedAnalysisSeed?.rekordboxPhrases).toHaveLength(validPssi().length)

    const reanalyzed = await analyzeTrackBuffer(makeBuffer(), { ...options, seed: remote.importedAnalysisSeed })
    expect(reanalyzed.analysisSources).toMatchObject({ beatGrid: 'rekordbox', trackSections: 'drmvyz' })
    expect(reanalyzed.analysisDiagnostics?.rekordbox?.pssiFallbackReason).toContain('integrity metadata is unavailable')
  }, 30_000)

})
