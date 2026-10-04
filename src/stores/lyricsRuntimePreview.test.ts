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

import {
  resolveEffectiveRuntimeLyrics,
  selectEffectiveRuntimeCues,
  selectEffectiveRuntimeDocumentId,
  useLyricsStore,
} from './lyricsStore'

const TRACK = 'track-1'

function makeDocument(suffix: string, isActive: boolean, audioTrackId: string | null = TRACK): LyricDocument {
  return {
    id: `doc-${suffix}`,
    userId: 'user-1',
    audioTrackId,
    visualSessionId: null,
    title: `Version ${suffix}`,
    artist: 'Artist',
    sourceType: 'manual',
    sourceFormat: 'json',
    rawSourceText: null,
    defaultStyle: {},
    defaultAnimation: {},
    defaultEffects: {},
    globalOffsetMs: 0,
    isActive,
    metadata: {},
    revision: 1,
    createdAt: '2026-06-29T00:00:00.000Z',
    updatedAt: '2026-06-29T00:00:00.000Z',
  }
}

function makeCue(suffix: string): LyricCue {
  return { id: `cue-${suffix}`, startMs: 0, endMs: 1_000, text: `Cue ${suffix}`, source: 'manual' }
}

const docA = makeDocument('a', true)
const docB = makeDocument('b', false)
const cuesA = [makeCue('a')]
const cuesB = [makeCue('b1'), makeCue('b2')]

/** Version A is ACTIVE and loaded into the runtime; Version B is OPEN in the editor. */
async function loadActiveAAndOpenB() {
  lyricDbMocks.getActiveLyricDocumentForAudioTrack.mockResolvedValue(docA)
  lyricDbMocks.getLyricCuesForDocument.mockResolvedValue(cuesA)
  await useLyricsStore.getState().resolveRuntimeLyricsForAudioTrack(TRACK, true, true)
  useLyricsStore.getState().beginEditorSession()
  useLyricsStore.getState().setEditorDocument(docB, cuesB)
}

describe('runtime lyric preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useLyricsStore.getState().clearLyrics()
  })

  it('opening a version without previewing does not affect the runtime', async () => {
    await loadActiveAAndOpenB()

    const state = useLyricsStore.getState()
    expect(state.editorDocumentId).toBe(docB.id)
    expect(state.runtimeLyricPreview).toBeNull()
    expect(resolveEffectiveRuntimeLyrics(state)).toMatchObject({ documentId: docA.id, cues: cuesA, isPreview: false })
  })

  it('previews the open version, keeps A persisted as active, and returns to A when the preview ends', async () => {
    await loadActiveAAndOpenB()

    expect(useLyricsStore.getState().beginRuntimeLyricPreview(TRACK)).toEqual({ ok: true })

    let state = useLyricsStore.getState()
    const effective = resolveEffectiveRuntimeLyrics(state)
    expect(effective).toMatchObject({ audioTrackId: TRACK, documentId: docB.id, isPreview: true })
    expect(effective.cues).toBe(cuesB)
    expect(selectEffectiveRuntimeCues(state)).toBe(cuesB)
    // The persisted production version is untouched: same runtime document, nothing written.
    expect(state.runtimeActiveDocumentId).toBe(docA.id)
    expect(state.runtimeCues).toBe(cuesA)
    expect(state.runtimeActiveDocument?.isActive).toBe(true)
    expect(docB.isActive).toBe(false)
    expect(lyricDbMocks.activateLyricDocument).not.toHaveBeenCalled()
    expect(lyricDbMocks.saveLyricDocumentAtomic).not.toHaveBeenCalled()

    useLyricsStore.getState().endRuntimeLyricPreview()

    state = useLyricsStore.getState()
    expect(state.runtimeLyricPreview).toBeNull()
    expect(resolveEffectiveRuntimeLyrics(state)).toMatchObject({ documentId: docA.id, cues: cuesA, isPreview: false })
  })

  it('keeps the preview across the forced runtime resync that follows leaving the editor', async () => {
    await loadActiveAAndOpenB()
    useLyricsStore.getState().beginRuntimeLyricPreview(TRACK)

    useLyricsStore.getState().endEditorSession()
    await useLyricsStore.getState().resolveRuntimeLyricsForAudioTrack(TRACK, true, true)

    const state = useLyricsStore.getState()
    expect(selectEffectiveRuntimeDocumentId(state)).toBe(docB.id)
    expect(state.runtimeActiveDocumentId).toBe(docA.id)
  })

  it('refuses to preview unsaved editor changes', async () => {
    await loadActiveAAndOpenB()
    useLyricsStore.getState().updateCue(cuesB[0].id, { text: 'edited but unsaved' })

    expect(useLyricsStore.getState().beginRuntimeLyricPreview(TRACK)).toEqual({ ok: false, reason: 'unsaved-changes' })
    expect(useLyricsStore.getState().runtimeLyricPreview).toBeNull()
    expect(selectEffectiveRuntimeDocumentId(useLyricsStore.getState())).toBe(docA.id)
  })

  it('refuses a version from another track, an empty editor, and a version without timed cues', async () => {
    await loadActiveAAndOpenB()
    expect(useLyricsStore.getState().beginRuntimeLyricPreview('track-2')).toEqual({ ok: false, reason: 'track-mismatch' })

    useLyricsStore.getState().setEditorDocument(docB, [{ ...makeCue('flat'), endMs: 0 }])
    expect(useLyricsStore.getState().beginRuntimeLyricPreview(TRACK)).toEqual({ ok: false, reason: 'no-timed-cues' })

    useLyricsStore.getState().setEditorDocument(null, [])
    expect(useLyricsStore.getState().beginRuntimeLyricPreview(TRACK)).toEqual({ ok: false, reason: 'no-document' })
  })

  it('ends the preview when another track becomes the runtime track or the runtime is cleared', async () => {
    await loadActiveAAndOpenB()
    useLyricsStore.getState().beginRuntimeLyricPreview(TRACK)
    lyricDbMocks.getActiveLyricDocumentForAudioTrack.mockResolvedValue(null)
    await useLyricsStore.getState().resolveRuntimeLyricsForAudioTrack('track-2', false, true)
    expect(useLyricsStore.getState().runtimeLyricPreview).toBeNull()

    await loadActiveAAndOpenB()
    useLyricsStore.getState().beginRuntimeLyricPreview(TRACK)
    useLyricsStore.getState().clearRuntimeLyrics('idle', true)
    expect(useLyricsStore.getState().runtimeLyricPreview).toBeNull()
  })

  it('ends the preview when the Lyric Manager is opened again', async () => {
    await loadActiveAAndOpenB()
    useLyricsStore.getState().beginRuntimeLyricPreview(TRACK)

    useLyricsStore.getState().beginEditorSession()

    expect(useLyricsStore.getState().runtimeLyricPreview).toBeNull()
  })

  it('Save + Make Active still changes the persisted active version normally', async () => {
    await loadActiveAAndOpenB()
    const savedB = { ...docB, isActive: true, revision: 2 }
    lyricDbMocks.saveLyricDocumentAtomic.mockResolvedValue({
      ok: true,
      kind: 'success',
      created: false,
      document: savedB,
      cues: cuesB,
    })

    const result = await useLyricsStore.getState().saveActiveLyricDocument(cuesB, { makeActive: true })

    expect(result?.ok).toBe(true)
    expect(lyricDbMocks.saveLyricDocumentAtomic).toHaveBeenCalledWith(expect.objectContaining({ activate: true }))
    const state = useLyricsStore.getState()
    expect(state.runtimeActiveDocumentId).toBe(docB.id)
    expect(state.runtimeActiveDocument?.isActive).toBe(true)
    expect(state.runtimeCues).toEqual(cuesB)
    expect(state.runtimeLyricPreview).toBeNull()
    expect(resolveEffectiveRuntimeLyrics(state)).toMatchObject({ documentId: docB.id, isPreview: false })
  })

  it('making the previewed version active ends the redundant preview', async () => {
    await loadActiveAAndOpenB()
    useLyricsStore.getState().beginRuntimeLyricPreview(TRACK)
    lyricDbMocks.getFullLyricDocument.mockResolvedValue({ document: docB, cues: cuesB })
    lyricDbMocks.activateLyricDocument.mockResolvedValue({
      ok: true,
      kind: 'success',
      document: { ...docB, isActive: true, revision: 2 },
    })
    lyricDbMocks.getLyricCuesForDocument.mockResolvedValue(cuesB)

    await useLyricsStore.getState().activateLyricDocument(docB.id)

    const state = useLyricsStore.getState()
    expect(state.runtimeLyricPreview).toBeNull()
    expect(state.runtimeActiveDocumentId).toBe(docB.id)
  })
})
