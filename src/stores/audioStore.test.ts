import { beforeEach, describe, expect, it, vi } from 'vitest'

const audioDbMocks = vi.hoisted(() => ({
  listAudioTracks: vi.fn(),
  uploadAudioFile: vi.fn(),
  createAudioTrack: vi.fn(),
  createSignedAudioUrl: vi.fn(),
  deleteAudioTrack: vi.fn(),
  deleteAudioFiles: vi.fn(),
  updateAudioTrack: vi.fn(),
  createTrackAnalysis: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabaseConfigured: true,
  supabase: { auth: { getUser: vi.fn() } },
}))
vi.mock('../lib/audioDb', () => audioDbMocks)

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
    audioDbMocks.uploadAudioFile.mockResolvedValue({ error: null })
    audioDbMocks.deleteAudioFiles.mockResolvedValue({ error: null })
    audioDbMocks.deleteAudioTrack.mockResolvedValue({ error: null })
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
    audioDbMocks.deleteAudioTrack.mockResolvedValue({ error: 'permission denied' })

    await useAudioStore.getState().removeSavedTrack(track.id)

    await vi.waitFor(() => {
      expect(useAudioStore.getState().loadError).toContain('Track deletion failed')
    })
    expect(useAudioStore.getState().savedTracks).toEqual([track])
    expect(audioDbMocks.deleteAudioFiles).not.toHaveBeenCalled()
  })

  it('deletes the database row before removing storage and local state', async () => {
    const track = savedTrack()
    useAudioStore.setState({ savedTracks: [track] })
    const order: string[] = []
    audioDbMocks.deleteAudioTrack.mockImplementation(async () => {
      order.push('database')
      return { error: null }
    })
    audioDbMocks.deleteAudioFiles.mockImplementation(async () => {
      order.push('storage')
      return { error: null }
    })

    await useAudioStore.getState().removeSavedTrack(track.id)

    await vi.waitFor(() => expect(useAudioStore.getState().savedTracks).toEqual([]))
    await vi.waitFor(() => expect(audioDbMocks.deleteAudioFiles).toHaveBeenCalled())
    expect(order).toEqual(['database', 'storage'])
  })

  it('deletes database-only track rows even when no storage path exists', async () => {
    const track = savedTrack({ storagePath: null })
    useAudioStore.setState({ savedTracks: [track] })

    await useAudioStore.getState().removeSavedTrack(track.id)

    await vi.waitFor(() => expect(useAudioStore.getState().savedTracks).toEqual([]))
    expect(audioDbMocks.deleteAudioTrack).toHaveBeenCalledWith(track.dbId)
    expect(audioDbMocks.deleteAudioFiles).not.toHaveBeenCalled()
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
    expect(useAudioStore.getState().savedTracks[0]).toMatchObject({
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
