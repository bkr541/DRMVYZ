// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricCue, LyricDocument, SaveLyricDocumentAtomicInput } from '../../types/lyrics'
import type { LyricDocumentVersion, LyricManagerTrack } from './lyricManagerTypes'

const mocks = vi.hoisted(() => {
  const engine = {
    duration: 0,
    currentTime: 0,
    currentAudioTrackId: null as string | null,
    currentTrack: null as { displayName?: string } | null,
    isPlaying: false,
    source: 'file',
    tracks: [] as unknown[],
    replaceTrackUrls: vi.fn(),
    addTrackUrls: vi.fn(),
    setSource: vi.fn(),
    pause: vi.fn(),
    play: vi.fn(),
  }
  return {
    engine,
    getUser: vi.fn(),
    loadTrackPage: vi.fn(),
    getVersions: vi.fn(),
    getLegacyVersions: vi.fn(),
    getLyricDocumentById: vi.fn(),
    getLyricCuesForDocument: vi.fn(),
    getActiveLyricDocumentForAudioTrack: vi.fn(),
    getActiveLyricDocumentForVisualSession: vi.fn(),
    saveLyricDocumentAtomic: vi.fn(),
    activateLyricDocument: vi.fn(),
    deleteLyricDocument: vi.fn(),
    getFullLyricDocument: vi.fn(),
    updateLyricDocument: vi.fn(),
    getSignedUrl: vi.fn(),
  }
})

vi.mock('../../lib/supabase', () => ({
  supabaseConfigured: true,
  supabase: { auth: { getUser: mocks.getUser } },
}))

vi.mock('../../lib/lyricsDb', () => ({
  getLyricDocumentById: mocks.getLyricDocumentById,
  getLyricCuesForDocument: mocks.getLyricCuesForDocument,
  getActiveLyricDocumentForAudioTrack: mocks.getActiveLyricDocumentForAudioTrack,
  getActiveLyricDocumentForVisualSession: mocks.getActiveLyricDocumentForVisualSession,
  saveLyricDocumentAtomic: mocks.saveLyricDocumentAtomic,
  activateLyricDocument: mocks.activateLyricDocument,
  deleteLyricDocument: mocks.deleteLyricDocument,
  getFullLyricDocument: mocks.getFullLyricDocument,
  updateLyricDocument: mocks.updateLyricDocument,
}))

vi.mock('./services/lyricManagerData', () => ({
  loadLyricManagerTrackPage: mocks.loadTrackPage,
  getLyricDocumentVersionsForTracks: mocks.getVersions,
  getLegacyLyricDocumentVersions: mocks.getLegacyVersions,
}))

vi.mock('../../context/AudioEngineContext', () => ({
  useSharedAudio: () => mocks.engine,
}))

vi.mock('../../stores/audioStore', () => ({
  useAudioStore: (selector: (state: { getSignedUrl: typeof mocks.getSignedUrl }) => unknown) =>
    selector({ getSignedUrl: mocks.getSignedUrl }),
}))

vi.mock('../../components/vyzualz/shared/VyzualzHeaderActions', () => ({
  VyzualzHeaderActions: () => null,
}))

vi.mock('../../components/vyzualz/MediaUploadModal', () => ({
  MediaUploadModal: () => <div data-testid="audio-upload-modal" />,
}))

import { useLyricsStore } from '../../stores/lyricsStore'
import { LyricManagerView } from './LyricManagerView'

let container: HTMLElement
let root: ReturnType<typeof createRoot>
let documentsByTrack: Map<string, LyricDocumentVersion[]>
let documentById: Map<string, LyricDocumentVersion>
let cuesByDocument: Map<string, LyricCue[]>

function track(id: string, title: string): LyricManagerTrack {
  return {
    id: `audio-${id}`,
    dbId: id,
    title,
    fileName: `${title.toLowerCase().replace(/ /g, '-')}.mp3`,
    storagePath: `user-1/${id}.mp3`,
    durationSec: 180,
    sampleRate: 48_000,
    channels: 2,
    fileSizeByte: 1000,
    mimeType: 'audio/mpeg',
    transcriptionAssets: null,
    artist: 'DVYDRM',
    genre: 'Melodic Bass',
    bpm: 150,
    musicalKey: 'Bb Major',
    createdAt: '2026-06-29T12:00:00.000Z',
    lyricVersionCount: 0,
    activeLyricDocumentId: null,
    activeLyricDocumentName: null,
  }
}

function documentVersion(
  id: string,
  audioTrackId: string,
  title: string,
  active = false,
): LyricDocumentVersion {
  return {
    id,
    userId: 'user-1',
    audioTrackId,
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
    isActive: active,
    metadata: { language: 'en', reviewStatus: 'unreviewed' },
    revision: 1,
    createdAt: '2026-06-29T12:00:00.000Z',
    updatedAt: '2026-06-29T12:00:00.000Z',
    cueCount: 1,
    language: 'en',
    documentReviewStatus: 'unreviewed',
  }
}

function cue(id: string): LyricCue {
  return {
    id,
    text: 'Lay your doubts down',
    startMs: 0,
    endMs: 1200,
    reviewStatus: 'unreviewed',
    confidence: 0.65,
    warnings: ['low_confidence'],
  }
}

function indexDocuments() {
  documentById = new Map()
  for (const versions of documentsByTrack.values()) {
    for (const version of versions) documentById.set(version.id, version)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.engine.duration = 0
  mocks.engine.currentTime = 0
  mocks.engine.currentAudioTrackId = null
  mocks.engine.currentTrack = null
  mocks.engine.isPlaying = false
  mocks.engine.source = 'file'
  mocks.engine.tracks = []

  const trackA = track('track-a', 'Reverie')
  const trackB = track('track-b', 'From Grace')
  const docA1 = documentVersion('doc-a1', 'track-a', 'Approved Lyrics', true)
  const docA2 = documentVersion('doc-a2', 'track-a', 'Alternate Lyrics', false)
  trackA.lyricVersionCount = 2
  trackA.activeLyricDocumentId = docA1.id
  trackA.activeLyricDocumentName = docA1.title

  documentsByTrack = new Map([
    ['track-a', [docA1, docA2]],
    ['track-b', []],
  ])
  cuesByDocument = new Map([
    ['doc-a1', [cue('cue-a1')]],
    ['doc-a2', [cue('cue-a2')]],
  ])
  indexDocuments()

  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  mocks.loadTrackPage.mockResolvedValue({ tracks: [trackA, trackB], total: 2 })
  mocks.getLegacyVersions.mockResolvedValue([])
  mocks.getVersions.mockImplementation(async (ids: string[]) =>
    ids.flatMap(id => documentsByTrack.get(id) ?? []))
  mocks.getLyricDocumentById.mockImplementation(async (id: string) => documentById.get(id) ?? null)
  mocks.getLyricCuesForDocument.mockImplementation(async (id: string) => cuesByDocument.get(id) ?? [])
  mocks.getFullLyricDocument.mockImplementation(async (id: string) => ({
    document: documentById.get(id),
    cues: cuesByDocument.get(id) ?? [],
  }))
  mocks.updateLyricDocument.mockImplementation(async (id: string, patch: Partial<LyricDocument>) => {
    const current = documentById.get(id)!
    const updated = { ...current, ...patch }
    documentById.set(id, updated)
    documentsByTrack.set(current.audioTrackId!, (documentsByTrack.get(current.audioTrackId!) ?? []).map(doc => doc.id === id ? updated : doc))
    return updated
  })
  mocks.activateLyricDocument.mockImplementation(async (id: string) => {
    const current = documentById.get(id)!
    const trackId = current.audioTrackId!
    const versions = (documentsByTrack.get(trackId) ?? []).map(doc => ({ ...doc, isActive: doc.id === id }))
    documentsByTrack.set(trackId, versions)
    indexDocuments()
    return { ok: true, kind: 'success', document: documentById.get(id) }
  })
  mocks.saveLyricDocumentAtomic.mockImplementation(async (input: SaveLyricDocumentAtomicInput) => {
    const id = input.documentId ?? `doc-created-${input.document.audioTrackId}`
    const previous = documentById.get(id)
    const saved = documentVersion(
      id,
      input.document.audioTrackId ?? previous?.audioTrackId ?? 'legacy',
      input.document.title,
      input.activate ?? previous?.isActive ?? false,
    )
    saved.artist = input.document.artist ?? ''
    saved.revision = (previous?.revision ?? 0) + 1
    const trackId = saved.audioTrackId!
    const versions = (documentsByTrack.get(trackId) ?? [])
      .filter(doc => doc.id !== id)
      .map(doc => input.activate ? { ...doc, isActive: false } : doc)
    documentsByTrack.set(trackId, [saved, ...versions])
    documentById.set(id, saved)
    const savedCues = input.cues.map((inputCue, index) => ({
      id: `${id}-cue-${index}`,
      text: inputCue.text,
      startMs: inputCue.startMs,
      endMs: inputCue.endMs,
      style: inputCue.style,
      animation: inputCue.animation,
      effects: inputCue.effects,
      words: inputCue.words,
      groups: inputCue.groups,
      confidence: inputCue.confidence,
      source: inputCue.source,
      reviewStatus: inputCue.reviewStatus,
      warnings: inputCue.warnings,
    }))
    cuesByDocument.set(id, savedCues)
    return { ok: true, kind: 'success', document: saved, cues: savedCues }
  })

  useLyricsStore.setState({
    lyricsEnabled: false,
    activeDocumentId: null,
    activeDocument: null,
    activeAudioTrackId: null,
    cues: [],
    isLoading: false,
    isSaving: false,
    error: null,
    lastPersistenceFailure: null,
    draftTitle: '',
    draftArtist: '',
    draftDefaultStyle: {},
    draftDefaultAnimation: {},
    draftDefaultEffects: {},
    globalOffsetMs: 0,
    draftSourceType: null,
    draftSourceFormat: null,
    draftRawSourceText: null,
    draftMetadata: null,
    selectedCueId: null,
    lyricTimingDirty: false,
    editorSessionActive: false,
    editorDirty: false,
    draftActivateOnSave: true,
  })

  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

async function waitFor(assertion: () => void) {
  let lastError: unknown
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
      await flush()
    }
  }
  throw lastError
}

async function render(onBack = vi.fn()) {
  await act(async () => root.render(<LyricManagerView onBack={onBack} />))
  await waitFor(() => expect(container.textContent).toContain('Reverie'))
  return onBack
}

function trackCard(title: string): HTMLButtonElement {
  const card = [...container.querySelectorAll<HTMLButtonElement>('.lmv-track-card')]
    .find(candidate => candidate.textContent?.includes(title))
  if (!card) throw new Error(`Track card not found: ${title}`)
  return card
}

function documentCard(title: string): HTMLElement {
  const card = [...container.querySelectorAll<HTMLElement>('.lmv-doc-card')]
    .find(candidate => candidate.querySelector('.lmv-doc-card-title')?.textContent === title)
  if (!card) throw new Error(`Document card not found: ${title}`)
  return card
}

function buttonWithText(text: string, rootElement: ParentNode = container): HTMLButtonElement {
  const button = [...rootElement.querySelectorAll<HTMLButtonElement>('button')]
    .find(candidate => candidate.textContent?.trim() === text)
  if (!button) throw new Error(`Button not found: ${text}`)
  return button
}

describe('LyricManagerView track-first workflow', () => {
  it('loads stored tracks, selects a track, loads all versions, and opens the active version without starting playback', async () => {
    await render()

    expect(mocks.loadTrackPage).toHaveBeenCalledWith('user-1', expect.objectContaining({ offset: 0, limit: 18 }))
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().activeDocumentId).toBe('doc-a1'))

    expect(mocks.getVersions).toHaveBeenCalledWith(['track-a'])
    expect(mocks.getLyricDocumentById).toHaveBeenCalledWith('doc-a1')
    expect(container.textContent).toContain('Approved Lyrics')
    expect(container.textContent).toContain('Alternate Lyrics')
    expect(mocks.engine.addTrackUrls).not.toHaveBeenCalled()
    expect(mocks.engine.replaceTrackUrls).not.toHaveBeenCalled()
    expect(mocks.engine.play).not.toHaveBeenCalled()

    const alternate = documentCard('Alternate Lyrics').querySelector('.lmv-doc-card-main') as HTMLButtonElement
    await act(async () => alternate.click())
    await waitFor(() => expect(useLyricsStore.getState().activeDocumentId).toBe('doc-a2'))
  })

  it('handles a track with no lyrics and saves a new document with the selected audio_tracks ID', async () => {
    await render()
    await act(async () => trackCard('From Grace').click())
    await waitFor(() => expect(container.textContent).toContain('This track has no lyrics yet.'))

    await act(async () => buttonWithText('Create Blank Lyrics').click())
    expect(useLyricsStore.getState()).toMatchObject({
      activeDocument: null,
      activeAudioTrackId: 'track-b',
      editorDirty: true,
    })

    await act(async () => buttonWithText('Save').click())
    await waitFor(() => expect(mocks.saveLyricDocumentAtomic).toHaveBeenCalled())

    const saveCalls = mocks.saveLyricDocumentAtomic.mock.calls
    const input = saveCalls[saveCalls.length - 1]?.[0] as SaveLyricDocumentAtomicInput
    expect(input.documentId).toBeNull()
    expect(input.document.audioTrackId).toBe('track-b')
    expect(useLyricsStore.getState().activeDocument?.audioTrackId).toBe('track-b')
  })

  it('duplicates a version as a dirty draft and activates another version transactionally', async () => {
    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().activeDocumentId).toBe('doc-a1'))

    await act(async () => buttonWithText('Duplicate', documentCard('Approved Lyrics')).click())
    await waitFor(() => expect(mocks.getFullLyricDocument).toHaveBeenCalledWith('doc-a1'))
    expect(useLyricsStore.getState()).toMatchObject({
      activeDocument: null,
      activeAudioTrackId: 'track-a',
      draftTitle: 'Approved Lyrics Copy',
      editorDirty: true,
      draftActivateOnSave: false,
    })

    await act(async () => buttonWithText('Save').click())
    await waitFor(() => expect(mocks.saveLyricDocumentAtomic).toHaveBeenCalled())
    const duplicateSaveCalls = mocks.saveLyricDocumentAtomic.mock.calls
    const duplicateInput = duplicateSaveCalls[duplicateSaveCalls.length - 1]?.[0] as SaveLyricDocumentAtomicInput
    expect(duplicateInput.activate).toBe(false)

    await act(async () => buttonWithText('Make Active', documentCard('Alternate Lyrics')).click())
    await waitFor(() => expect(mocks.activateLyricDocument).toHaveBeenCalledWith('doc-a2', null))
    expect(useLyricsStore.getState().activeDocumentId).toBe('doc-a2')
  })

  it('guards track changes, document changes, and leaving with Save, Discard, and Cancel choices', async () => {
    const onBack = await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().activeDocumentId).toBe('doc-a1'))

    await act(async () => useLyricsStore.getState().markEditorDirty(true))
    await act(async () => trackCard('From Grace').click())
    expect(container.textContent).toContain('Unsaved lyric changes')
    await act(async () => buttonWithText('Cancel').click())
    expect(trackCard('Reverie').getAttribute('aria-pressed')).toBe('true')

    await act(async () => trackCard('From Grace').click())
    await act(async () => buttonWithText('Discard').click())
    await waitFor(() => expect(trackCard('From Grace').getAttribute('aria-pressed')).toBe('true'))

    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().activeDocumentId).toBe('doc-a1'))
    await act(async () => useLyricsStore.getState().markEditorDirty(true))
    const alternate = documentCard('Alternate Lyrics').querySelector('.lmv-doc-card-main') as HTMLButtonElement
    await act(async () => alternate.click())
    const saveDialog = container.querySelector('.lmv-dialog') as HTMLElement
    await act(async () => buttonWithText('Save', saveDialog).click())
    await waitFor(() => expect(useLyricsStore.getState().activeDocumentId).toBe('doc-a2'))
    expect(mocks.saveLyricDocumentAtomic).toHaveBeenCalled()

    await act(async () => useLyricsStore.getState().markEditorDirty(true))
    const backButton = container.querySelector('[aria-label="Leave Lyric Manager"]') as HTMLButtonElement
    await act(async () => backButton.click())
    await act(async () => buttonWithText('Cancel').click())
    expect(onBack).not.toHaveBeenCalled()

    await act(async () => backButton.click())
    await act(async () => buttonWithText('Discard').click())
    expect(onBack).toHaveBeenCalledOnce()
  })
})
