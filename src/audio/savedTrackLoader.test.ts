import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from '../hooks/useAudioEngine'
import type { Track } from '../types'
import type { SavedAudioTrack } from '../stores/audioStore'
import {
  resetAudioSourcePolicyForTests,
  setAudioSourcePolicyAppView,
  setShowManagerLinkedAudioTrackId,
  SHOW_MANAGER_AUDIO_SOURCE_LOCK_MESSAGE,
} from './audioSourcePolicy'

const mocks = vi.hoisted(() => ({
  listTrackAnalysisPayloads: vi.fn(),
}))

vi.mock('../lib/audioDb', () => ({
  listTrackAnalysisPayloads: mocks.listTrackAnalysisPayloads,
}))

import {
  clearSavedTrackSignedUrlCache,
  loadSavedTrackIntoEngine,
  SavedTrackLoadCancelledError,
} from './savedTrackLoader'

function savedTrack(overrides: Partial<SavedAudioTrack> = {}): SavedAudioTrack {
  return {
    id: 'audio-track-a',
    dbId: 'track-a',
    title: 'Reverie',
    fileName: 'reverie.wav',
    storagePath: 'user/track-a/reverie.wav',
    durationSec: 193.5,
    sampleRate: 48_000,
    channels: 2,
    fileSizeByte: 1234,
    mimeType: 'audio/wav',
    transcriptionAssets: null,
    artist: 'DVYDRM',
    genre: 'Melodic Bass',
    bpm: 150,
    musicalKey: 'Bb Major',
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function engine(overrides: Partial<AudioEngine> = {}): AudioEngine {
  return {
    source: 'file',
    tracks: [],
    currentAudioTrackId: null,
    currentTrack: null,
    setSource: vi.fn().mockResolvedValue(undefined),
    addTrackUrls: vi.fn(),
    replaceTrackUrls: vi.fn(),
    updateTrackRuntime: vi.fn(),
    play: vi.fn(),
    ...overrides,
  } as unknown as AudioEngine
}

beforeEach(() => {
  resetAudioSourcePolicyForTests()
  clearSavedTrackSignedUrlCache()
  vi.clearAllMocks()
  mocks.listTrackAnalysisPayloads.mockResolvedValue({ rows: [], error: null })
})

describe('savedTrackLoader', () => {
  it('preserves canonical dbId, storage metadata, musical metadata, and hydrated analysis', async () => {
    const analysis = {
      analysisVersion: 'mi-v1',
      durationMs: 193_500,
      beatGrid: [],
      sections: [],
    }
    mocks.listTrackAnalysisPayloads.mockResolvedValue({
      rows: [{ track_id: 'track-a', analysis_payload: analysis }],
      error: null,
    })
    const audio = engine()
    const getSignedUrl = vi.fn().mockResolvedValue('https://signed.test/reverie.wav')

    const result = await loadSavedTrackIntoEngine(audio, savedTrack(), { getSignedUrl })

    expect(getSignedUrl).toHaveBeenCalledWith('user/track-a/reverie.wav')
    expect(audio.addTrackUrls).toHaveBeenCalledWith([
      expect.objectContaining({
        dbId: 'track-a',
        storagePath: 'user/track-a/reverie.wav',
        title: 'Reverie',
        artist: 'DVYDRM',
        duration: 193.5,
        persistedMetadata: {
          bpm: 150,
          musicalKey: 'Bb Major',
          genre: 'Melodic Bass',
          sampleRate: 48_000,
          channels: 2,
        },
        analysisRuntime: expect.objectContaining({
          status: 'complete',
          analysis,
          analysisVersion: 'mi-v1',
        }),
      }),
    ], { notifyOnBlocked: false })
    expect(result.input.dbId).toBe('track-a')
    expect(audio.play).not.toHaveBeenCalled()
  })

  it('reuses the current canonical runtime track without signing or decoding again', async () => {
    const currentTrack = {
      id: 'audio-track-a',
      dbId: 'track-a',
      url: 'blob:already-loaded',
    } as Track
    const audio = engine({ currentAudioTrackId: 'track-a', currentTrack, tracks: [currentTrack] })
    const getSignedUrl = vi.fn()

    const result = await loadSavedTrackIntoEngine(audio, savedTrack(), { getSignedUrl }, { autoplay: true })

    expect(result.reusedRuntimeTrack).toBe(true)
    expect(getSignedUrl).not.toHaveBeenCalled()
    expect(audio.addTrackUrls).not.toHaveBeenCalled()
    expect(audio.replaceTrackUrls).not.toHaveBeenCalled()
    expect(audio.play).toHaveBeenCalledOnce()
  })

  it('hydrates a reused canonical runtime track without fetching or decoding it again', async () => {
    const analysis = {
      analysisVersion: 'mi-v1',
      durationMs: 193_500,
      beatGrid: [],
      sections: [],
    }
    mocks.listTrackAnalysisPayloads.mockResolvedValue({
      rows: [{ track_id: 'track-a', analysis_payload: analysis }],
      error: null,
    })
    const currentTrack = {
      id: 'audio-track-a',
      dbId: 'track-a',
      url: 'blob:already-loaded',
      analysisRuntime: { analysis: null },
    } as Track
    const audio = engine({ currentAudioTrackId: 'track-a', currentTrack, tracks: [currentTrack] })
    const getSignedUrl = vi.fn()

    const result = await loadSavedTrackIntoEngine(audio, savedTrack(), { getSignedUrl })

    expect(result.reusedRuntimeTrack).toBe(true)
    expect(getSignedUrl).not.toHaveBeenCalled()
    expect(audio.updateTrackRuntime).toHaveBeenCalledWith('audio-track-a', expect.objectContaining({
      status: 'complete',
      analysis,
      analysisVersion: 'mi-v1',
    }))
    expect(audio.addTrackUrls).not.toHaveBeenCalled()
    expect(audio.replaceTrackUrls).not.toHaveBeenCalled()
  })

  it('does not commit a stale load after the ownership guard changes', async () => {
    const audio = engine()
    let current = true
    const getSignedUrl = vi.fn().mockImplementation(async () => {
      current = false
      return 'https://signed.test/stale.wav'
    })

    await expect(loadSavedTrackIntoEngine(
      audio,
      savedTrack(),
      { getSignedUrl },
      { shouldCommit: () => current },
    )).rejects.toBeInstanceOf(SavedTrackLoadCancelledError)

    expect(audio.addTrackUrls).not.toHaveBeenCalled()
    expect(audio.replaceTrackUrls).not.toHaveBeenCalled()
    expect(audio.play).not.toHaveBeenCalled()
  })

  it('rejects an untrusted saved-track load in Show Manager before URL, analysis, or engine mutation', async () => {
    setAudioSourcePolicyAppView('showManager')
    setShowManagerLinkedAudioTrackId('track-b')
    const audio = engine({ currentAudioTrackId: 'track-b' })
    const getSignedUrl = vi.fn().mockResolvedValue('https://signed.test/track-c.wav')

    await expect(loadSavedTrackIntoEngine(
      audio,
      savedTrack({ dbId: 'track-c', storagePath: 'user/track-c/track-c.wav' }),
      { getSignedUrl },
    )).rejects.toThrow(SHOW_MANAGER_AUDIO_SOURCE_LOCK_MESSAGE)

    expect(getSignedUrl).not.toHaveBeenCalled()
    expect(mocks.listTrackAnalysisPayloads).not.toHaveBeenCalled()
    expect(audio.addTrackUrls).not.toHaveBeenCalled()
    expect(audio.replaceTrackUrls).not.toHaveBeenCalled()
    expect(audio.setSource).not.toHaveBeenCalled()
  })

  it('allows the trusted Show-open path to activate the linked saved track', async () => {
    setAudioSourcePolicyAppView('showManager')
    setShowManagerLinkedAudioTrackId('track-b')
    const currentTrack = { id: 'runtime-track-a', dbId: 'track-a', url: 'blob:track-a' } as Track
    const audio = engine({ currentAudioTrackId: 'track-a', currentTrack, tracks: [currentTrack] })
    const getSignedUrl = vi.fn().mockResolvedValue('https://signed.test/track-b.wav')

    await loadSavedTrackIntoEngine(
      audio,
      savedTrack({ dbId: 'track-b', storagePath: 'user/track-b/track-b.wav' }),
      { getSignedUrl },
      { sourceMutationAuthority: 'showManagerLinkedTrack' },
    )

    expect(audio.replaceTrackUrls).toHaveBeenCalledWith(
      [expect.objectContaining({ dbId: 'track-b' })],
      { authority: 'showManagerLinkedTrack', notifyOnBlocked: false },
    )
  })

})
