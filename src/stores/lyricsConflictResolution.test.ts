import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricCue, LyricDocument, SaveLyricDocumentAtomicInput, SaveLyricDocumentResult } from '../types/lyrics'

const lyricDbMocks = vi.hoisted(() => ({
  getLyricDocumentById: vi.fn(),
  getLyricCuesForDocument: vi.fn(),
  getActiveLyricDocumentForAudioTrack: vi.fn(),
  getActiveLyricDocumentForVisualSession: vi.fn(),
  getLyricDocumentByClientLogicalId: vi.fn(),
  getFullLyricDocument: vi.fn(),
  saveLyricDocumentAtomic: vi.fn(),
  activateLyricDocument: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabaseConfigured: true }))
vi.mock('../lib/lyricsDb', () => lyricDbMocks)

import { useLyricsStore } from './lyricsStore'

function lyricDocument(id: string, revision: number, title: string, isActive = true): LyricDocument {
  return {
    id,
    userId: 'user-1',
    audioTrackId: 'track-1',
    visualSessionId: null,
    title,
    artist: 'DVYDRM',
    sourceType: 'manual',
    sourceFormat: 'json',
    rawSourceText: null,
    defaultStyle: {},
    defaultAnimation: {},
    defaultEffects: {},
    globalOffsetMs: 0,
    isActive,
    metadata: {},
    revision,
    createdAt: '2026-07-11T12:00:00.000Z',
    updatedAt: '2026-07-11T12:00:00.000Z',
  }
}

const cue = (id: string, text: string): LyricCue => ({ id, text, startMs: 0, endMs: 1200, reviewStatus: 'unreviewed' })
const success = (document: LyricDocument, cues: LyricCue[]): SaveLyricDocumentResult => ({ ok: true, kind: 'success', document, cues })
const conflict: SaveLyricDocumentResult = { ok: false, kind: 'conflict', message: 'The server document changed.', currentRevision: 5 }

/** Opens revision 1 of a document, edits it, and has the save refused as a conflict. */
async function openConflictedDocument(): Promise<void> {
  useLyricsStore.getState().setActiveDocument(lyricDocument('document-1', 1, 'Original'), [cue('mine', 'My original line')])
  lyricDbMocks.saveLyricDocumentAtomic.mockResolvedValueOnce(conflict)
  useLyricsStore.getState().setDraftTitle('My edited title')
  useLyricsStore.getState().setCues([cue('mine', 'My edited line')])
  await useLyricsStore.getState().saveActiveLyricDocument()
  expect(useLyricsStore.getState().activeWriteStatus).toBe('conflict')
}

describe('lyricsStore conflict resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useLyricsStore.getState().setOperationAccount(null)
    useLyricsStore.getState().clearLyrics()
    useLyricsStore.getState().setOperationAccount('user-1')
    useLyricsStore.getState().beginEditorSession()
    lyricDbMocks.getLyricDocumentByClientLogicalId.mockResolvedValue(null)
    lyricDbMocks.getLyricCuesForDocument.mockResolvedValue([])
  })

  it('a conflicted version refuses every further save, which is why a way out is needed', async () => {
    await openConflictedDocument()
    const again = await useLyricsStore.getState().saveActiveLyricDocument()
    expect(again).toMatchObject({ ok: false, kind: 'conflict' })
    expect(lyricDbMocks.saveLyricDocumentAtomic).toHaveBeenCalledTimes(1)
  })

  it('Reload Latest drops the edits, loads the server version, and saves resume from the server revision', async () => {
    await openConflictedDocument()
    lyricDbMocks.getFullLyricDocument.mockResolvedValue({
      document: lyricDocument('document-1', 5, 'Server title'),
      cues: [cue('server', 'Server line')],
    })

    await expect(useLyricsStore.getState().reloadLatestLyricDocument()).resolves.toBe(true)

    expect(lyricDbMocks.getFullLyricDocument).toHaveBeenCalledWith('document-1')
    expect(useLyricsStore.getState()).toMatchObject({
      activeWriteStatus: 'saved',
      editorDirty: false,
      isSaving: false,
      draftTitle: 'Server title',
      error: null,
    })
    expect(useLyricsStore.getState().cues.map(item => item.text)).toEqual(['Server line'])
    expect(useLyricsStore.getState().editorDocument?.revision).toBe(5)
    expect(useLyricsStore.getState().writeStates['document:document-1']).toBeUndefined()

    lyricDbMocks.saveLyricDocumentAtomic.mockResolvedValueOnce(success(lyricDocument('document-1', 6, 'Next edit'), [cue('server', 'Server line')]))
    useLyricsStore.getState().setDraftTitle('Next edit')
    const saved = await useLyricsStore.getState().saveActiveLyricDocument()
    expect(saved).toMatchObject({ ok: true })
    const input = lyricDbMocks.saveLyricDocumentAtomic.mock.calls[1]?.[0] as SaveLyricDocumentAtomicInput
    expect(input).toMatchObject({ documentId: 'document-1', expectedRevision: 5 })
  })

  it('Reload Latest leaves the conflict in place when the latest version cannot be fetched', async () => {
    await openConflictedDocument()
    lyricDbMocks.getFullLyricDocument.mockRejectedValue(new Error('Network down'))

    await expect(useLyricsStore.getState().reloadLatestLyricDocument()).resolves.toBe(false)

    expect(useLyricsStore.getState()).toMatchObject({ activeWriteStatus: 'conflict', error: 'Network down' })
    expect(useLyricsStore.getState().draftTitle).toBe('My edited title')
    expect(useLyricsStore.getState().cues.map(item => item.text)).toEqual(['My edited line'])
  })

  it('Save as New Version keeps the edits as a new inactive version and never writes to the conflicted one again', async () => {
    await openConflictedDocument()
    lyricDbMocks.saveLyricDocumentAtomic.mockResolvedValueOnce(
      success(lyricDocument('document-2', 1, 'My edited title (copy)', false), [cue('mine', 'My edited line')]),
    )

    const result = await useLyricsStore.getState().saveActiveLyricAsNewVersion()

    expect(result).toMatchObject({ ok: true, document: { id: 'document-2' } })
    const input = lyricDbMocks.saveLyricDocumentAtomic.mock.calls[1]?.[0] as SaveLyricDocumentAtomicInput
    expect(input).toMatchObject({ documentId: null, expectedRevision: null, activate: false })
    expect(input.document).toMatchObject({ title: 'My edited title (copy)', audioTrackId: 'track-1' })
    expect(input.cues.map(item => item.text)).toEqual(['My edited line'])

    expect(useLyricsStore.getState()).toMatchObject({
      activeWriteStatus: 'saved',
      editorDirty: false,
      editorDocumentId: 'document-2',
    })
    expect(useLyricsStore.getState().writeStates['document:document-1']).toBeUndefined()
    // Only the refused attempt ever targeted the original; the other session's version is untouched.
    expect(lyricDbMocks.saveLyricDocumentAtomic.mock.calls.filter(call => (call[0] as SaveLyricDocumentAtomicInput).documentId === 'document-1')).toHaveLength(1)
  })

  it('Save as New Version carries the original source details and does not take over as the active version', async () => {
    useLyricsStore.getState().setActiveDocument(
      { ...lyricDocument('document-1', 1, 'From AI'), sourceType: 'ai_transcription', sourceFormat: 'json', rawSourceText: 'raw', metadata: { provider: 'groq' } },
      [cue('mine', 'Line')],
    )
    lyricDbMocks.saveLyricDocumentAtomic.mockResolvedValueOnce(conflict)
    useLyricsStore.getState().setDraftTitle('From AI edited')
    await useLyricsStore.getState().saveActiveLyricDocument()
    lyricDbMocks.saveLyricDocumentAtomic.mockResolvedValueOnce(success(lyricDocument('document-2', 1, 'x', false), [cue('mine', 'Line')]))

    await useLyricsStore.getState().saveActiveLyricAsNewVersion()

    const input = lyricDbMocks.saveLyricDocumentAtomic.mock.calls[1]?.[0] as SaveLyricDocumentAtomicInput
    expect(input.document).toMatchObject({ sourceType: 'ai_transcription', rawSourceText: 'raw' })
    expect(input.document.metadata).toMatchObject({ provider: 'groq' })
    expect(input.activate).toBe(false)
  })
})
