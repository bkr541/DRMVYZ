import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TRACK_ANALYSIS_RUNTIME, type Track } from '../types'
import {
  createLocalRuntimeTrack,
  createRemoteRuntimeTrack,
  getTrackAudioTrackId,
  getTrackRuntimeId,
  isPersistedTrack,
  runtimeIdForAudioTrack,
} from './runtimeTrack'
import { CURRENT_ANALYSIS_VERSION } from '../features/musicIntelligence/analysisVersion'
import type { ImportedTrackIntelligence, RekordboxPhrase } from '../features/rekordboxImport/types'

describe('runtime track identity', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-track')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('preserves audio_tracks.id and saved metadata when loading a saved track', () => {
    const track = createRemoteRuntimeTrack({
      name: 'source-file.wav',
      title: 'Saved Title',
      artist: 'Saved Artist',
      url: 'https://example.test/audio.wav?token=first',
      dbId: '11111111-2222-3333-4444-555555555555',
      storagePath: 'user/tracks/source-file.wav',
      duration: 245.5,
      persistedMetadata: {
        bpm: 150,
        musicalKey: 'Bb major',
        genre: 'Melodic Bass',
        sampleRate: 48_000,
        channels: 2,
      },
    })

    expect(track.id).toBe('audio-11111111-2222-3333-4444-555555555555')
    expect(track.dbId).toBe('11111111-2222-3333-4444-555555555555')
    expect(track.storagePath).toBe('user/tracks/source-file.wav')
    expect(track.displayName).toBe('Saved Title')
    expect(track.artist).toBe('Saved Artist')
    expect(track.duration).toBe(245.5)
    expect(track.persistedMetadata?.bpm).toBe(150)
    expect(getTrackAudioTrackId(track)).toBe(track.dbId)
    expect(isPersistedTrack(track)).toBe(true)
  })

  it('keeps deterministic identity when a saved track is replaced with a refreshed signed URL', () => {
    const dbId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const first = createRemoteRuntimeTrack({
      name: 'track.mp3',
      url: 'https://example.test/track.mp3?token=one',
      dbId,
    })
    const replacement = createRemoteRuntimeTrack({
      name: 'track.mp3',
      url: 'https://example.test/track.mp3?token=two',
      dbId,
    })

    expect(first.id).toBe(runtimeIdForAudioTrack(dbId))
    expect(replacement.id).toBe(first.id)
    expect(replacement.dbId).toBe(dbId)
  })

  it('keeps unsaved local files on generated runtime IDs without a database ID', () => {
    const file = new File(['audio'], 'local-demo.wav', { type: 'audio/wav' })
    const track = createLocalRuntimeTrack(file)

    expect(track.id).not.toMatch(/^audio-/)
    expect(track.dbId).toBeUndefined()
    expect(track.storagePath).toBeUndefined()
    expect(track.sourceKind).toBe('file')
    expect(track.sourceFile).toBe(file)
    expect(getTrackAudioTrackId(track)).toBeNull()
    expect(isPersistedTrack(track)).toBe(false)
  })

  it('carries Rekordbox PSSI through the runtime seed without promoting it into native phrases or sections', () => {
    const file = new File(['audio'], 'rekordbox-phrase.wav', { type: 'audio/wav' })
    const importedPhrase: RekordboxPhrase = {
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
      fillStartBeat: null,
      fillStartTimeSec: null,
      sourceFlags: { fill: false },
      sourcePayload: { kind: 2 },
    }
    const imported: ImportedTrackIntelligence = {
      source: 'rekordbox_usb',
      metadata: {
        source: 'rekordbox_usb',
        sourceLibraryId: 'library-1',
        sourceTrackId: 'rb-track-1',
        title: 'Rekordbox Phrase Track',
        importedAt: '2026-08-16T00:00:00.000Z',
      },
      cueMarkers: [],
      cueRegions: [],
      rekordboxPhrases: [importedPhrase],
      analysisSeed: {
        source: 'rekordbox_usb',
        featureAvailability: { bpm: true, beatGrid: false, key: false, phrases: true },
        bpm: 120,
        rekordboxPhrases: [importedPhrase],
      },
      matchConfidence: 0.99,
      matchReason: 'test match',
      warnings: [],
    }

    const track = createLocalRuntimeTrack(file, imported)

    expect(track.importedRekordboxPhrases).toEqual(imported.rekordboxPhrases)
    expect(track.importedAnalysisSeed?.phrases).toBeUndefined()
    expect(track.importedAnalysisSeed?.rekordboxPhrases).toEqual([importedPhrase])
    expect(track.importedAnalysisSeed?.sections).toBeUndefined()
  })

  it('continues to accept legacy remote URL inputs without persisted identity', () => {
    const track = createRemoteRuntimeTrack({
      name: 'legacy.mp3',
      url: 'https://example.test/legacy.mp3',
    })

    expect(track.id).not.toMatch(/^audio-/)
    expect(track.displayName).toBe('legacy')
    expect(track.dbId).toBeUndefined()
  })

  it('migrates restored legacy analysis keys without retaining stale automatic results', () => {
    const track = createRemoteRuntimeTrack({
      name: 'legacy-analysis.mp3',
      url: 'https://example.test/legacy-analysis.mp3',
      analysisRuntime: {
        ...DEFAULT_TRACK_ANALYSIS_RUNTIME,
        status: 'complete',
        analysisKey: 'u:https://example.test/legacy-analysis.mp3:auto-1.0',
        analysisVersion: 'auto-1.0',
      },
    })

    expect(track.analysisRuntime.analysisVersion).toBe(CURRENT_ANALYSIS_VERSION)
    expect(track.analysisRuntime.analysisKey).toContain(CURRENT_ANALYSIS_VERSION)
    expect(track.analysisRuntime.status).toBe('queued')
    expect(track.analysisRuntime.analysis).toBeNull()
  })

  it('keeps legacy serialized Track objects backward compatible', () => {
    const legacyTrack: Track = {
      id: 'legacy-runtime-id',
      name: 'legacy.mp3',
      displayName: 'legacy',
      url: 'blob:legacy',
      duration: 180,
      sourceKind: 'remote',
      analysisRuntime: { ...DEFAULT_TRACK_ANALYSIS_RUNTIME },
    }

    const restored = JSON.parse(JSON.stringify(legacyTrack)) as Track

    expect(restored).toEqual(legacyTrack)
    expect(getTrackRuntimeId(restored)).toBe('legacy-runtime-id')
    expect(getTrackAudioTrackId(restored)).toBeNull()
    expect(isPersistedTrack(restored)).toBe(false)
  })
})
