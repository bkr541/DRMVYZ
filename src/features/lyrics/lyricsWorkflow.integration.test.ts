import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricCue, LyricDocument } from '../../types/lyrics'

const backend = vi.hoisted(() => ({
  activeByTrack: new Map<string, LyricDocument>(),
  cuesByDocument: new Map<string, LyricCue[]>(),
  saveLyricDocumentAtomic: vi.fn(),
  getActiveLyricDocumentForAudioTrack: vi.fn(),
  getLyricCuesForDocument: vi.fn(),
  getLyricDocumentById: vi.fn(),
  getActiveLyricDocumentForVisualSession: vi.fn(),
  activateLyricDocument: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({ supabaseConfigured: true }))
vi.mock('../../lib/lyricsDb', () => ({
  saveLyricDocumentAtomic: backend.saveLyricDocumentAtomic,
  getActiveLyricDocumentForAudioTrack: backend.getActiveLyricDocumentForAudioTrack,
  getLyricCuesForDocument: backend.getLyricCuesForDocument,
  getLyricDocumentById: backend.getLyricDocumentById,
  getActiveLyricDocumentForVisualSession: backend.getActiveLyricDocumentForVisualSession,
  activateLyricDocument: backend.activateLyricDocument,
}))

import { createRemoteRuntimeTrack, getTrackAudioTrackId } from '../../audio/runtimeTrack'
import { useLyricsStore } from '../../stores/lyricsStore'
import { ActiveLyricTracker } from './runtime/lyricPlaybackResolver'
import { resolveSoundDrawingLyricText } from './runtime/soundDrawingLyricText'

function documentFor(trackId: string, revision = 1): LyricDocument {
  return {
    id: `document-${trackId}`,
    userId: 'user-1',
    audioTrackId: trackId,
    visualSessionId: null,
    title: 'POP',
    artist: 'DVYDRM',
    sourceType: 'ai_transcription',
    sourceFormat: 'json',
    rawSourceText: null,
    defaultStyle: {},
    defaultAnimation: {},
    defaultEffects: {},
    globalOffsetMs: 0,
    isActive: true,
    metadata: {},
    revision,
    createdAt: '2026-06-29T00:00:00.000Z',
    updatedAt: '2026-06-29T00:00:00.000Z',
  }
}

const extractedCues: LyricCue[] = [
  {
    id: 'cue-1',
    startMs: 0,
    endMs: 1_000,
    text: 'Got that drink',
    source: 'transcription',
    words: [
      { id: 'word-1', startMs: 0, endMs: 400, text: 'Got', source: 'transcription' },
      { id: 'word-2', startMs: 400, endMs: 1_000, text: 'drink', source: 'transcription' },
    ],
  },
  {
    id: 'cue-2',
    startMs: 1_000,
    endMs: 2_000,
    text: 'Tear the club up',
    source: 'transcription',
    words: [
      { id: 'word-3', startMs: 1_000, endMs: 1_500, text: 'Tear', source: 'transcription' },
      { id: 'word-4', startMs: 1_500, endMs: 2_000, text: 'up', source: 'transcription' },
    ],
  },
]

describe('persisted-track lyric workflow integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    backend.activeByTrack.clear()
    backend.cuesByDocument.clear()
    useLyricsStore.getState().clearLyrics()

    backend.saveLyricDocumentAtomic.mockImplementation(async (input: {
      document: { audioTrackId?: string | null; globalOffsetMs?: number }
      cues: Array<LyricCue & { lyricDocumentId?: string }>
    }) => {
      const trackId = input.document.audioTrackId
      if (!trackId) return { ok: false, kind: 'validation', message: 'Track required' }
      const document = {
        ...documentFor(trackId),
        globalOffsetMs: input.document.globalOffsetMs ?? 0,
      }
      const cues = input.cues.map(({ lyricDocumentId: _documentId, ...cue }, index) => ({
        ...cue,
        id: `saved-cue-${index + 1}`,
      }))
      backend.activeByTrack.set(trackId, document)
      backend.cuesByDocument.set(document.id, cues)
      return { ok: true, kind: 'success', document, cues }
    })
    backend.getActiveLyricDocumentForAudioTrack.mockImplementation(async (trackId: string) => (
      backend.activeByTrack.get(trackId) ?? null
    ))
    backend.getLyricCuesForDocument.mockImplementation(async (documentId: string) => (
      backend.cuesByDocument.get(documentId) ?? []
    ))
  })

  it('preserves permanent identity through save, reload, seek, offset, MI, and Sound Drawing', async () => {
    const runtimeTrack = createRemoteRuntimeTrack({
      name: 'pop.wav',
      url: 'https://signed.example/pop.wav',
      dbId: 'track-pop',
      title: 'POP',
      artist: 'DVYDRM',
      storagePath: 'user-1/track-pop/pop.wav',
    })
    expect(runtimeTrack.id).toBe('audio-track-pop')
    expect(getTrackAudioTrackId(runtimeTrack)).toBe('track-pop')

    useLyricsStore.setState({
      activeAudioTrackId: runtimeTrack.dbId ?? null,
      draftTitle: 'POP',
      draftArtist: 'DVYDRM',
      cues: extractedCues,
      draftActivateOnSave: true,
    })
    const saved = await useLyricsStore.getState().saveActiveLyricDocument(extractedCues, { makeActive: true })
    expect(saved?.ok).toBe(true)
    expect(backend.saveLyricDocumentAtomic).toHaveBeenCalledWith(expect.objectContaining({
      document: expect.objectContaining({ audioTrackId: 'track-pop' }),
      activate: true,
    }))

    useLyricsStore.getState().clearLyrics()
    await useLyricsStore.getState().loadLyricsForAudioTrack('track-pop')
    const reloaded = useLyricsStore.getState()
    expect(reloaded.runtimeActiveDocument?.audioTrackId).toBe('track-pop')
    expect(reloaded.runtimeCues).toHaveLength(2)
    expect(reloaded.runtimeCues.map(cue => ({ startMs: cue.startMs, endMs: cue.endMs, text: cue.text }))).toEqual(
      extractedCues.map(cue => ({ startMs: cue.startMs, endMs: cue.endMs, text: cue.text })),
    )

    const tracker = new ActiveLyricTracker()
    tracker.setLyrics({
      cues: reloaded.runtimeCues,
      documentId: reloaded.runtimeActiveDocumentId,
      sourceIdentity: `track-pop:${reloaded.runtimeActiveDocumentId}`,
      globalOffsetMs: reloaded.runtimeGlobalOffsetMs,
    })

    const first = tracker.update(0.4, 'discontinuous')
    expect(first.activeLine).toBe('Got that drink')
    expect(first.activeWord).toBe('drink')
    expect(resolveSoundDrawingLyricText(
      { textSource: 'activeLyricLine', staticText: 'STATIC' },
      first.playback,
    ).text).toBe(first.activeLine)

    const exactBoundary = tracker.update(1, 'continuous')
    expect(exactBoundary.activeLine).toBe('Tear the club up')
    expect(exactBoundary.activeWord).toBe('Tear')

    const seekBackward = tracker.update(0.1, 'discontinuous')
    expect(seekBackward.activeLine).toBe('Got that drink')
    expect(seekBackward.activeWord).toBe('Got')

    tracker.setLyrics({
      cues: reloaded.runtimeCues,
      documentId: reloaded.runtimeActiveDocumentId,
      sourceIdentity: `track-pop:${reloaded.runtimeActiveDocumentId}`,
      globalOffsetMs: 500,
    })
    expect(tracker.update(0.499, 'discontinuous').activeLine).toBeNull()
    expect(tracker.update(0.5, 'continuous').activeLine).toBe('Got that drink')

    tracker.setLyrics({
      cues: reloaded.runtimeCues,
      documentId: reloaded.runtimeActiveDocumentId,
      sourceIdentity: `track-pop:${reloaded.runtimeActiveDocumentId}`,
      globalOffsetMs: -500,
    })
    expect(tracker.update(0.5, 'discontinuous').activeLine).toBe('Tear the club up')
  })

  it('does not expose old-track lyrics after switching to a persisted track with no document', async () => {
    backend.activeByTrack.set('track-a', documentFor('track-a'))
    backend.cuesByDocument.set('document-track-a', extractedCues)

    await useLyricsStore.getState().loadLyricsForAudioTrack('track-a')
    expect(useLyricsStore.getState().runtimeCues).toHaveLength(2)

    await useLyricsStore.getState().loadLyricsForAudioTrack('track-without-lyrics')
    expect(useLyricsStore.getState()).toMatchObject({
      runtimeAudioTrackId: 'track-without-lyrics',
      runtimeActiveDocument: null,
      runtimeCues: [],
    })
  })
})
