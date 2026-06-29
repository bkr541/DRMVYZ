import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricCue, LyricDocument } from '../types/lyrics'

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

import {
  selectActiveTrackHasLyricDocument,
  selectHasActiveLyricDocument,
  selectLyricsLoading,
  useLyricsStore,
} from './lyricsStore'

function makeDocument(audioTrackId: string, suffix: string): LyricDocument {
  return {
    id: `doc-${suffix}`,
    userId: 'user-1',
    audioTrackId,
    visualSessionId: null,
    title: `Track ${suffix}`,
    artist: 'Artist',
    sourceType: 'manual',
    sourceFormat: 'json',
    rawSourceText: null,
    defaultStyle: {},
    defaultAnimation: {},
    defaultEffects: {},
    globalOffsetMs: 0,
    isActive: true,
    metadata: {},
    revision: 1,
    createdAt: '2026-06-29T00:00:00.000Z',
    updatedAt: '2026-06-29T00:00:00.000Z',
  }
}

function makeCue(suffix: string): LyricCue {
  return {
    id: `cue-${suffix}`,
    startMs: 0,
    endMs: 1_000,
    text: `Cue ${suffix}`,
    source: 'manual',
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('lyricsStore active audio-track synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useLyricsStore.getState().clearLyrics()
  })

  it('keeps Track B active when Track A finishes after the switch', async () => {
    const trackADocument = deferred<LyricDocument | null>()
    const docA = makeDocument('track-a', 'a')
    const docB = makeDocument('track-b', 'b')
    const cueB = makeCue('b')

    lyricDbMocks.getActiveLyricDocumentForAudioTrack.mockImplementation((audioTrackId: string) => {
      if (audioTrackId === 'track-a') return trackADocument.promise
      return Promise.resolve(docB)
    })
    lyricDbMocks.getLyricCuesForDocument.mockImplementation((documentId: string) =>
      Promise.resolve(documentId === docB.id ? [cueB] : [makeCue('a')]),
    )

    const loadA = useLyricsStore.getState().loadLyricsForAudioTrack('track-a')
    const loadB = useLyricsStore.getState().loadLyricsForAudioTrack('track-b')

    await loadB
    trackADocument.resolve(docA)
    await loadA

    const state = useLyricsStore.getState()
    expect(state.activeAudioTrackId).toBe('track-b')
    expect(state.activeDocument?.id).toBe(docB.id)
    expect(state.cues).toEqual([cueB])
    expect(selectActiveTrackHasLyricDocument(state)).toBe(true)
  })

  it('clears old lyrics when the newly active saved track has no lyric document', async () => {
    const oldDocument = makeDocument('track-a', 'a')
    useLyricsStore.getState().setActiveDocument(oldDocument, [makeCue('a')])
    lyricDbMocks.getActiveLyricDocumentForAudioTrack.mockResolvedValue(null)

    await useLyricsStore.getState().loadLyricsForAudioTrack('track-without-lyrics')

    const state = useLyricsStore.getState()
    expect(state.activeAudioTrackId).toBe('track-without-lyrics')
    expect(state.activeDocument).toBeNull()
    expect(state.cues).toEqual([])
    expect(selectHasActiveLyricDocument(state)).toBe(false)
    expect(selectLyricsLoading(state)).toBe(false)
  })

  it('does not issue a duplicate request for the same saved track', async () => {
    const lookup = deferred<LyricDocument | null>()
    lyricDbMocks.getActiveLyricDocumentForAudioTrack.mockReturnValue(lookup.promise)

    const first = useLyricsStore.getState().loadLyricsForAudioTrack('track-a')
    const duplicate = useLyricsStore.getState().loadLyricsForAudioTrack('track-a')

    expect(lyricDbMocks.getActiveLyricDocumentForAudioTrack).toHaveBeenCalledTimes(1)
    lookup.resolve(null)
    await Promise.all([first, duplicate])
    expect(lyricDbMocks.getActiveLyricDocumentForAudioTrack).toHaveBeenCalledTimes(1)
  })

  it('retries the same track after a failed automatic lookup', async () => {
    lyricDbMocks.getActiveLyricDocumentForAudioTrack
      .mockRejectedValueOnce(new Error('temporary lookup failure'))
      .mockResolvedValueOnce(null)

    await useLyricsStore.getState().loadLyricsForAudioTrack('track-a')
    expect(useLyricsStore.getState().error).toContain('temporary lookup failure')

    await useLyricsStore.getState().loadLyricsForAudioTrack('track-a')
    expect(lyricDbMocks.getActiveLyricDocumentForAudioTrack).toHaveBeenCalledTimes(2)
    expect(useLyricsStore.getState().error).toBeNull()
  })

  it('clearing the active track invalidates an in-flight request and clears active lyrics', async () => {
    const pendingDocument = deferred<LyricDocument | null>()
    lyricDbMocks.getActiveLyricDocumentForAudioTrack.mockReturnValue(pendingDocument.promise)

    const load = useLyricsStore.getState().loadLyricsForAudioTrack('track-a')
    useLyricsStore.getState().clearLyrics()
    pendingDocument.resolve(makeDocument('track-a', 'a'))
    await load

    const state = useLyricsStore.getState()
    expect(state.activeAudioTrackId).toBeNull()
    expect(state.activeDocument).toBeNull()
    expect(state.cues).toEqual([])
    expect(state.isLoading).toBe(false)
  })
})
