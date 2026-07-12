import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioTrack } from '../../../types/database'
import type { LyricDocumentRow } from '../../../types/lyrics'

const mocks = vi.hoisted(() => ({
  listAudioTracksPage: vi.fn(),
  listTrackAnalysisPayloads: vi.fn(),
  from: vi.fn(),
}))

vi.mock('../../../lib/audioDb', () => ({
  listAudioTracksPage: mocks.listAudioTracksPage,
  listTrackAnalysisPayloads: mocks.listTrackAnalysisPayloads,
}))

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: mocks.from },
}))

import {
  getLyricDocumentVersionsForTracks,
  loadLyricManagerTrackPage,
} from './lyricManagerData'

function audioTrack(id: string, title = `Track ${id}`): AudioTrack {
  return {
    id,
    user_id: 'user-1',
    title,
    file_name: `${id}.mp3`,
    storage_path: `user-1/${id}.mp3`,
    duration_sec: 180,
    sample_rate: 48_000,
    bit_depth: null,
    channels: 2,
    file_size: 1234,
    mime_type: 'audio/mpeg',
    source_type: 'file',
    external_source: null,
    external_track_id: null,
    external_metadata: null,
    transcription_assets: null,
    lifecycle_status: 'complete',
    deletion_requested_at: null,
    artist: 'DVYDRM',
    genre: 'Melodic Bass',
    bpm: 150,
    musical_key: 'Bb Major',
    created_at: '2026-06-29T12:00:00.000Z',
    updated_at: '2026-06-29T12:00:00.000Z',
  }
}

function lyricDocument(
  id: string,
  audioTrackId: string,
  options: { active?: boolean; title?: string; count?: number } = {},
): LyricDocumentRow & { lyric_cues: Array<{ count: number }> } {
  return {
    id,
    user_id: 'user-1',
    audio_track_id: audioTrackId,
    visual_session_id: null,
    title: options.title ?? `Lyrics ${id}`,
    artist: 'DVYDRM',
    source_type: 'manual',
    source_format: 'json',
    raw_source_text: null,
    default_style: {},
    default_animation: {},
    default_effects: {},
    global_offset_ms: 0,
    is_active: options.active ?? false,
    metadata: { language: 'en', reviewStatus: 'unreviewed' },
    revision: 1,
    created_at: '2026-06-29T12:00:00.000Z',
    updated_at: '2026-06-29T12:00:00.000Z',
    lyric_cues: [{ count: options.count ?? 0 }],
  }
}

function mockDocumentQuery(rows: unknown[], error: { message: string } | null = null) {
  const order = vi.fn().mockResolvedValue({ data: rows, error })
  const inFilter = vi.fn().mockReturnValue({ order })
  const select = vi.fn().mockReturnValue({ in: inFilter })
  mocks.from.mockReturnValue({ select })
  return { select, inFilter, order }
}

describe('lyricManagerData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listTrackAnalysisPayloads.mockResolvedValue({ rows: [], error: null })
  })

  it('loads one paged track query and one batched lyric-version query for all visible tracks', async () => {
    const rows = [audioTrack('track-a'), audioTrack('track-b'), audioTrack('track-c')]
    mocks.listAudioTracksPage.mockResolvedValue({ rows, count: 42, error: null })
    const query = mockDocumentQuery([
      lyricDocument('doc-a1', 'track-a', { active: true, title: 'Approved', count: 12 }),
      lyricDocument('doc-a2', 'track-a', { title: 'Draft', count: 8 }),
      lyricDocument('doc-c1', 'track-c', { active: true, count: 4 }),
    ])

    const page = await loadLyricManagerTrackPage('user-1', {
      offset: 18,
      limit: 18,
      search: 'dream',
    })

    expect(mocks.listAudioTracksPage).toHaveBeenCalledOnce()
    expect(mocks.listAudioTracksPage).toHaveBeenCalledWith('user-1', {
      offset: 18,
      limit: 18,
      search: 'dream',
    })
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.from).toHaveBeenCalledWith('lyric_documents')
    expect(query.inFilter).toHaveBeenCalledOnce()
    expect(query.inFilter).toHaveBeenCalledWith('audio_track_id', ['track-a', 'track-b', 'track-c'])
    expect(page.total).toBe(42)
    expect(page.tracks[0]).toMatchObject({
      dbId: 'track-a',
      lyricVersionCount: 2,
      activeLyricDocumentId: 'doc-a1',
      activeLyricDocumentName: 'Approved',
    })
    expect(page.tracks[1]).toMatchObject({
      dbId: 'track-b',
      lyricVersionCount: 0,
      activeLyricDocumentId: null,
    })
  })

  it('maps cue count, language, and review metadata for version cards', async () => {
    mockDocumentQuery([
      lyricDocument('doc-a1', 'track-a', { active: true, count: 27 }),
    ])

    const versions = await getLyricDocumentVersionsForTracks(['track-a'])

    expect(versions).toHaveLength(1)
    expect(versions[0]).toMatchObject({
      id: 'doc-a1',
      cueCount: 27,
      language: 'en',
      documentReviewStatus: 'unreviewed',
    })
  })

  it('skips the lyric query for an empty track page', async () => {
    mocks.listAudioTracksPage.mockResolvedValue({ rows: [], count: 0, error: null })

    await expect(loadLyricManagerTrackPage('user-1')).resolves.toEqual({ tracks: [], total: 0 })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('surfaces stored-track and lyric-version query errors', async () => {
    mocks.listAudioTracksPage.mockResolvedValue({ rows: [], count: 0, error: 'audio_tracks unavailable' })
    await expect(loadLyricManagerTrackPage('user-1')).rejects.toThrow('audio_tracks unavailable')

    mockDocumentQuery([], { message: 'lyrics unavailable' })
    await expect(getLyricDocumentVersionsForTracks(['track-a'])).rejects.toThrow('lyrics unavailable')
  })
})
