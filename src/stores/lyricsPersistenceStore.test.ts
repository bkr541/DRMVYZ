import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricCue, LyricDocument } from '../types/lyrics'

const lyricDbMocks = vi.hoisted(() => ({
  getLyricDocumentById: vi.fn(),
  getLyricCuesForDocument: vi.fn(),
  getActiveLyricDocumentForAudioTrack: vi.fn(),
  getActiveLyricDocumentForVisualSession: vi.fn(),
  getFullLyricDocument: vi.fn(),
  getLyricDocumentByClientLogicalId: vi.fn(),
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

function cue(id = 'cue-1'): LyricCue {
  return {
    id,
    text: 'Lyric line',
    startMs: 0,
    endMs: 1200,
    reviewStatus: 'unreviewed',
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
        activate: false,
        cues: [],
        document: expect.objectContaining({ audioTrackId: 'track-1' }),
      }),
    )
    expect(useLyricsStore.getState().cues).toEqual([])
    expect(useLyricsStore.getState().activeDocument?.revision).toBe(1)
  })

  it('preserves activation when ordinary Save updates the currently active version', async () => {
    const current = document(2)
    const saved = document(3)
    useLyricsStore.getState().setEditorDocument(current, [cue()])
    lyricDbMocks.saveLyricDocumentAtomic.mockResolvedValue({
      ok: true,
      kind: 'success',
      document: saved,
      cues: [cue()],
    })

    await useLyricsStore.getState().saveActiveLyricDocument([cue()])

    expect(lyricDbMocks.saveLyricDocumentAtomic).toHaveBeenCalledWith(
      expect.objectContaining({ activate: true }),
    )
  })

  it('passes the loaded revision and exposes a typed conflict for future UI handling', async () => {
    const current = document(4)
    useLyricsStore.getState().setActiveDocument(current, [cue()])
    lyricDbMocks.saveLyricDocumentAtomic.mockResolvedValue({
      ok: false,
      kind: 'conflict',
      message: 'The lyric document changed in another editor session.',
      currentRevision: 5,
    })

    const result = await useLyricsStore.getState().saveActiveLyricDocument([cue()])

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
    lyricDbMocks.getFullLyricDocument.mockResolvedValue({ document: document(6), cues: [cue()] })
    lyricDbMocks.activateLyricDocument.mockResolvedValue({
      ok: true,
      kind: 'success',
      document: activated,
    })
    lyricDbMocks.getLyricCuesForDocument.mockResolvedValue([])

    const result = await useLyricsStore.getState().activateLyricDocument(activated.id)

    expect(result?.ok).toBe(true)
    expect(lyricDbMocks.activateLyricDocument).toHaveBeenCalledWith(activated.id, 6)
    expect(useLyricsStore.getState().activeDocument?.revision).toBe(7)
  })

  it('keeps a legacy document unattached even if a persisted track ID is present elsewhere in state', async () => {
    const legacy = { ...document(2), id: 'legacy-document', audioTrackId: null, isActive: false }
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

  it('resolves runtime lyrics without replacing the protected editor document', async () => {
    const current = document(3)
    const refreshed = document(4)
    useLyricsStore.getState().setEditorDocument(current, [])
    useLyricsStore.getState().beginEditorSession()
    lyricDbMocks.getActiveLyricDocumentForAudioTrack.mockResolvedValue(refreshed)
    lyricDbMocks.getLyricCuesForDocument.mockResolvedValue([])

    await useLyricsStore.getState().resolveRuntimeLyricsForAudioTrack('track-1')

    expect(lyricDbMocks.getActiveLyricDocumentForAudioTrack).toHaveBeenCalledWith('track-1')
    expect(useLyricsStore.getState().editorDocument?.revision).toBe(3)
    expect(useLyricsStore.getState().runtimeActiveDocument?.revision).toBe(4)
    useLyricsStore.getState().endEditorSession()
  })

  it('supports an explicit Save + Make Active transaction without changing ordinary Save semantics', async () => {
    const inactive = { ...document(2), isActive: false }
    const activated = { ...document(3), isActive: true }
    useLyricsStore.getState().setEditorDocument(inactive, [cue()])
    lyricDbMocks.saveLyricDocumentAtomic.mockResolvedValue({
      ok: true,
      kind: 'success',
      document: activated,
      cues: [cue()],
    })

    await useLyricsStore.getState().saveActiveLyricDocument([cue()], { makeActive: true })

    expect(lyricDbMocks.saveLyricDocumentAtomic).toHaveBeenCalledWith(
      expect.objectContaining({ activate: true }),
    )
  })

  it('blocks hard validation errors at the persistence boundary', async () => {
    const inactive = { ...document(2), isActive: false }
    const invalidCue = { ...cue(), endMs: 0 }
    useLyricsStore.getState().setEditorDocument(inactive, [invalidCue])

    const result = await useLyricsStore.getState().saveActiveLyricDocument([invalidCue])

    expect(result).toMatchObject({ ok: false, kind: 'validation', code: 'invalid_end' })
    expect(lyricDbMocks.saveLyricDocumentAtomic).not.toHaveBeenCalled()
  })

  it('blocks ordinary empty saves for a version that is already active', async () => {
    const active = document(2)
    useLyricsStore.getState().setEditorDocument(active, [])

    const result = await useLyricsStore.getState().saveActiveLyricDocument([])

    expect(result).toMatchObject({ ok: false, kind: 'validation', code: 'empty_document' })
    expect(lyricDbMocks.saveLyricDocumentAtomic).not.toHaveBeenCalled()
  })

  it('blocks empty Save + Make Active while retaining inactive blank-draft persistence', async () => {
    const inactive = { ...document(2), isActive: false }
    useLyricsStore.getState().setEditorDocument(inactive, [])

    const result = await useLyricsStore.getState().saveActiveLyricDocument([], { makeActive: true })

    expect(result).toMatchObject({ ok: false, kind: 'validation', code: 'empty_document' })
    expect(lyricDbMocks.saveLyricDocumentAtomic).not.toHaveBeenCalled()
  })

  it('blocks activation when the canonical persisted target is empty', async () => {
    const target = { ...document(6), id: 'empty-target', isActive: false }
    lyricDbMocks.getFullLyricDocument.mockResolvedValue({ document: target, cues: [] })

    const result = await useLyricsStore.getState().activateLyricDocument(target.id)

    expect(result).toMatchObject({ ok: false, kind: 'validation', code: 'empty_document' })
    expect(lyricDbMocks.activateLyricDocument).not.toHaveBeenCalled()
  })

})
