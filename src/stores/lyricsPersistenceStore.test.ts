import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricDocument } from '../types/lyrics'

const lyricDbMocks = vi.hoisted(() => ({
  getLyricDocumentById: vi.fn(),
  getLyricCuesForDocument: vi.fn(),
  getActiveLyricDocumentForAudioTrack: vi.fn(),
  getActiveLyricDocumentForVisualSession: vi.fn(),
  saveLyricDocumentAtomic: vi.fn(),
  activateLyricDocument: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabaseConfigured: true }))
vi.mock('../lib/lyricsDb', () => lyricDbMocks)

import { useLyricsStore } from './lyricsStore'

function document(revision = 1): LyricDocument {
  return {
    id: 'document-1',
    userId: 'user-1',
    audioTrackId: 'track-1',
    visualSessionId: null,
    title: 'Track One',
    artist: 'DRMVYZ',
    sourceType: 'manual',
    sourceFormat: 'json',
    rawSourceText: null,
    defaultStyle: {},
    defaultAnimation: {},
    defaultEffects: {},
    globalOffsetMs: 0,
    isActive: true,
    metadata: {},
    revision,
    createdAt: '2026-06-29T12:00:00.000Z',
    updatedAt: '2026-06-29T12:00:00.000Z',
  }
}

describe('lyricsStore transactional save behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useLyricsStore.getState().clearLyrics()
  })

  it('creates a track-linked document and persists an intentionally empty cue list in one call', async () => {
    const saved = document(1)
    lyricDbMocks.saveLyricDocumentAtomic.mockResolvedValue({
      ok: true,
      kind: 'success',
      document: saved,
      cues: [],
    })

    useLyricsStore.setState({
      activeAudioTrackId: 'track-1',
      draftTitle: 'Track One',
      draftArtist: 'DRMVYZ',
    })

    const result = await useLyricsStore.getState().saveActiveLyricDocument([])

    expect(result?.ok).toBe(true)
    expect(lyricDbMocks.saveLyricDocumentAtomic).toHaveBeenCalledTimes(1)
    expect(lyricDbMocks.saveLyricDocumentAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: null,
        expectedRevision: null,
        activate: true,
        cues: [],
        document: expect.objectContaining({ audioTrackId: 'track-1' }),
      }),
    )
    expect(useLyricsStore.getState().cues).toEqual([])
    expect(useLyricsStore.getState().activeDocument?.revision).toBe(1)
  })

  it('passes the loaded revision and exposes a typed conflict for future UI handling', async () => {
    const current = document(4)
    useLyricsStore.getState().setActiveDocument(current, [])
    lyricDbMocks.saveLyricDocumentAtomic.mockResolvedValue({
      ok: false,
      kind: 'conflict',
      message: 'The lyric document changed in another editor session.',
      currentRevision: 5,
    })

    const result = await useLyricsStore.getState().saveActiveLyricDocument([])

    expect(result).toMatchObject({ ok: false, kind: 'conflict', currentRevision: 5 })
    expect(lyricDbMocks.saveLyricDocumentAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: current.id,
        expectedRevision: 4,
      }),
    )
    expect(useLyricsStore.getState().lastPersistenceFailure).toMatchObject({
      kind: 'conflict',
      currentRevision: 5,
    })
    expect(useLyricsStore.getState().activeDocument?.revision).toBe(4)
  })

  it('uses transactional activation and refreshes cues for a newly selected version', async () => {
    const activated = document(7)
    lyricDbMocks.activateLyricDocument.mockResolvedValue({
      ok: true,
      kind: 'success',
      document: activated,
    })
    lyricDbMocks.getLyricCuesForDocument.mockResolvedValue([])

    const result = await useLyricsStore.getState().activateLyricDocument(activated.id)

    expect(result?.ok).toBe(true)
    expect(lyricDbMocks.activateLyricDocument).toHaveBeenCalledWith(activated.id, null)
    expect(useLyricsStore.getState().activeDocument?.revision).toBe(7)
  })

  it('keeps a legacy document unattached even if a persisted track ID is present elsewhere in state', async () => {
    const legacy = { ...document(2), id: 'legacy-document', audioTrackId: null }
    useLyricsStore.getState().setActiveDocument(legacy, [])
    useLyricsStore.setState({ activeAudioTrackId: 'track-1' })
    lyricDbMocks.saveLyricDocumentAtomic.mockResolvedValue({
      ok: true,
      kind: 'success',
      document: legacy,
      cues: [],
    })

    await useLyricsStore.getState().saveActiveLyricDocument([])

    expect(lyricDbMocks.saveLyricDocumentAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: legacy.id,
        document: expect.objectContaining({ audioTrackId: null }),
      }),
    )
  })

  it('can force-refresh the active track after the editor releases a protected draft', async () => {
    const current = document(3)
    const refreshed = document(4)
    useLyricsStore.getState().setActiveDocument(current, [])
    lyricDbMocks.getActiveLyricDocumentForAudioTrack.mockResolvedValue(refreshed)
    lyricDbMocks.getLyricCuesForDocument.mockResolvedValue([])

    await useLyricsStore.getState().loadLyricsForAudioTrack('track-1')
    expect(lyricDbMocks.getActiveLyricDocumentForAudioTrack).not.toHaveBeenCalled()

    await useLyricsStore.getState().loadLyricsForAudioTrack('track-1', true)
    expect(lyricDbMocks.getActiveLyricDocumentForAudioTrack).toHaveBeenCalledWith('track-1')
    expect(useLyricsStore.getState().activeDocument?.revision).toBe(4)
  })

})
