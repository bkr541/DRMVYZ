import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
}))
const audioDbMocks = vi.hoisted(() => ({
  listAudioTracks: vi.fn(),
  uploadAudioFile: vi.fn(),
  createAudioTrack: vi.fn(),
  createSignedAudioUrl: vi.fn(),
  deleteAudioFiles: vi.fn(),
  updateAudioTrack: vi.fn(),
  createTrackAnalysis: vi.fn(),
}))
const deletionMocks = vi.hoisted(() => ({
  deleteAudioTrackCanonical: vi.fn(),
  retryPendingAudioCleanup: vi.fn(),
}))
const preparationMocks = vi.hoisted(() => ({
  retryPendingAudioPreparationCleanup: vi.fn(),
}))
const recoveryMocks = vi.hoisted(() => ({
  deleteLyricRecoveryForTrack: vi.fn(),
}))


vi.mock('../lib/supabase', () => ({
  supabaseConfigured: true,
  supabase: { auth: { getUser: authMocks.getUser } },
}))
vi.mock('../lib/audioDb', () => audioDbMocks)
vi.mock('../lib/audioTrackDeletion', () => deletionMocks)
vi.mock('../lib/audioPreparationDb', () => preparationMocks)
vi.mock('../lib/lyricDraftRecovery', () => recoveryMocks)

import type { SavedAudioTrack } from './audioStore'
import { useAudioStore } from './audioStore'

function savedTrack(overrides: Partial<SavedAudioTrack> = {}): SavedAudioTrack {
  return {
    id: 'audio-track-1',
    dbId: 'track-1',
    title: 'Track One',
    fileName: 'track-one.wav',
    storagePath: 'user-1/track-1/track-one.wav',
    durationSec: 120,
    sampleRate: 48_000,
    channels: 2,
    fileSizeByte: 1_024,
    mimeType: 'audio/wav',
    transcriptionAssets: null,
    artist: 'DRMVYZ',
    genre: null,
    bpm: 150,
    musicalKey: 'Bb Major',
    createdAt: '2026-06-29T00:00:00.000Z',
    ...overrides,
  }
}

describe('audioStore persistence safety', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAudioStore.setState({ savedTracks: [], loading: false, loadError: null })
    authMocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    recoveryMocks.deleteLyricRecoveryForTrack.mockResolvedValue(undefined)
    audioDbMocks.uploadAudioFile.mockResolvedValue({ error: null })
    audioDbMocks.deleteAudioFiles.mockResolvedValue({ error: null })
    deletionMocks.deleteAudioTrackCanonical.mockResolvedValue({ ok: true, trackId: 'track-1', pendingCleanup: false, message: null })
    deletionMocks.retryPendingAudioCleanup.mockResolvedValue([])
    preparationMocks.retryPendingAudioPreparationCleanup.mockResolvedValue([])
    audioDbMocks.updateAudioTrack.mockResolvedValue({ error: null })
  })

  it('removes an uploaded storage object when the audio_tracks insert fails', async () => {
    audioDbMocks.createAudioTrack.mockResolvedValue({ id: null, error: 'database unavailable' })

    const result = await useAudioStore.getState().uploadAndSaveTrack({
      file: new File(['audio'], 'track.wav', { type: 'audio/wav' }),
      title: 'Track',
      artist: '',
      genre: '',
      bpmInput: '',
      musicalKey: '',
      userId: 'user-1',
      analysis: null,
    })

    expect(result).toBeNull()
    expect(audioDbMocks.deleteAudioFiles).toHaveBeenCalledWith([
      expect.stringMatching(/^user-1\/.+\/track\.wav$/),
    ])
    expect(useAudioStore.getState().savedTracks).toEqual([])
    expect(useAudioStore.getState().loadError).toContain('database unavailable')
  })

  it('keeps the track visible and its storage intact when database deletion fails', async () => {
    const track = savedTrack()
    useAudioStore.setState({ savedTracks: [track] })
    deletionMocks.deleteAudioTrackCanonical.mockResolvedValue({ ok: false, trackId: track.dbId, pendingCleanup: false, message: 'Track deletion request failed: permission denied' })

    await useAudioStore.getState().removeSavedTrack(track.id)

    await vi.waitFor(() => {
      expect(useAudioStore.getState().loadError).toContain('Track deletion failed')
    })
    expect(useAudioStore.getState().savedTracks).toEqual([track])
    expect(audioDbMocks.deleteAudioFiles).not.toHaveBeenCalled()
  })

  it('routes deletion through the canonical audio operation and reconciles local state', async () => {
    const track = savedTrack()
    useAudioStore.setState({ savedTracks: [track] })

    await useAudioStore.getState().removeSavedTrack(track.id)

    expect(deletionMocks.deleteAudioTrackCanonical).toHaveBeenCalledWith(track.dbId)
    expect(recoveryMocks.deleteLyricRecoveryForTrack).toHaveBeenCalledWith('user-1', track.dbId)
    expect(useAudioStore.getState().savedTracks).toEqual([])
    expect(audioDbMocks.deleteAudioFiles).not.toHaveBeenCalled()
  })

  it('keeps canonical track deletion successful when local recovery cleanup fails and surfaces the cleanup error', async () => {
    const track = savedTrack()
    useAudioStore.setState({ savedTracks: [track] })
    recoveryMocks.deleteLyricRecoveryForTrack.mockRejectedValue(new Error('IndexedDB unavailable'))

    const removed = await useAudioStore.getState().removeSavedTrackByDbId(track.dbId)

    expect(removed).toBe(true)
    expect(useAudioStore.getState().savedTracks).toEqual([])
    expect(useAudioStore.getState().loadError).toContain('local lyric recovery cleanup failed')
    expect(useAudioStore.getState().loadError).toContain('IndexedDB unavailable')
  })

  it('deletes database-only track rows even when no storage path exists', async () => {
    const track = savedTrack({ storagePath: null })
    useAudioStore.setState({ savedTracks: [track] })

    await useAudioStore.getState().removeSavedTrack(track.id)

    await vi.waitFor(() => expect(useAudioStore.getState().savedTracks).toEqual([]))
    expect(deletionMocks.deleteAudioTrackCanonical).toHaveBeenCalledWith(track.dbId)
    expect(audioDbMocks.deleteAudioFiles).not.toHaveBeenCalled()
  })

  it('removes a tombstoned track while keeping partial storage cleanup visible', async () => {
    const track = savedTrack()
    useAudioStore.setState({ savedTracks: [track] })
    deletionMocks.deleteAudioTrackCanonical.mockResolvedValue({
      ok: true,
      trackId: track.dbId,
      pendingCleanup: true,
      message: 'Track removal is pending storage cleanup: network unavailable',
    })

    const removed = await useAudioStore.getState().removeSavedTrackByDbId(track.dbId)

    expect(removed).toBe(true)
    expect(useAudioStore.getState().savedTracks).toEqual([])
    expect(useAudioStore.getState().loadError).toBe('Network error — check connection')
  })

  it('updates saved-audio metadata through the canonical database service', async () => {
    const track = savedTrack()
    useAudioStore.setState({ savedTracks: [track] })

    const updated = await useAudioStore.getState().updateSavedTrackMetadata(track.id, {
      title: '  New Title  ',
      artist: '  New Artist  ',
      genre: 'Melodic Bass',
      bpm: 149.5,
      musicalKey: 'D Minor',
    })

    expect(updated).toBe(true)
    expect(audioDbMocks.updateAudioTrack).toHaveBeenCalledWith(track.dbId, {
      title: 'New Title',
      artist: 'New Artist',
      genre: 'Melodic Bass',
      bpm: 149.5,
      musical_key: 'D Minor',
    })
    expect(useAudioStore.getState().savedTracks[0]).toEqual({
      ...track,
      title: 'New Title',
      artist: 'New Artist',
      genre: 'Melodic Bass',
      bpm: 149.5,
      musicalKey: 'D Minor',
    })
  })

  it('keeps the previous audio metadata when persistence fails', async () => {
    const track = savedTrack()
    useAudioStore.setState({ savedTracks: [track] })
    audioDbMocks.updateAudioTrack.mockResolvedValue({ error: 'network unavailable' })

    const updated = await useAudioStore.getState().updateSavedTrackMetadata(track.id, {
      title: 'Changed',
      artist: null,
      genre: null,
      bpm: null,
      musicalKey: null,
    })

    expect(updated).toBe(false)
    expect(useAudioStore.getState().savedTracks).toEqual([track])
    expect(useAudioStore.getState().loadError).toContain('Track update failed')
  })

})
