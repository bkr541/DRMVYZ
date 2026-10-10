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
    getLyricDocumentByClientLogicalId: vi.fn(),
    updateLyricDocument: vi.fn(),
    getSignedUrl: vi.fn(),
    removeSavedTrackByDbId: vi.fn(),
    listTrackAnalysisPayloads: vi.fn(),
    loadTrackById: vi.fn(),
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
  getLyricDocumentByClientLogicalId: mocks.getLyricDocumentByClientLogicalId,
  updateLyricDocument: mocks.updateLyricDocument,
}))

vi.mock('./services/lyricManagerData', () => ({
  loadLyricManagerTrackPage: mocks.loadTrackPage,
  loadLyricManagerTrackById: mocks.loadTrackById,
  getLyricDocumentVersionsForTracks: mocks.getVersions,
  getLegacyLyricDocumentVersions: mocks.getLegacyVersions,
}))

vi.mock('../../context/AudioEngineContext', () => ({
  useSharedAudio: () => mocks.engine,
}))

vi.mock('../../lib/audioDb', () => ({
  listTrackAnalysisPayloads: mocks.listTrackAnalysisPayloads,
}))

vi.mock('../../stores/audioStore', () => {
  const state = {
    getSignedUrl: mocks.getSignedUrl,
    removeSavedTrackByDbId: mocks.removeSavedTrackByDbId,
    loadError: null as string | null,
  }
  const useAudioStore = (selector: (value: typeof state) => unknown) => selector(state)
  useAudioStore.getState = () => state
  return { useAudioStore }
})

vi.mock('../../components/vyzualz/shared/VyzualzHeaderActions', () => ({
  // Renders only the page-status slot; the real component's ordering is covered by VyzualzHeaderActions.test.tsx.
  VyzualzHeaderActions: ({ leading }: { leading?: React.ReactNode }) => <div className="header-actions-stub">{leading}</div>,
}))

vi.mock('../../components/vyzualz/MediaUploadModal', () => ({
  MediaUploadModal: () => <div data-testid="audio-upload-modal" />,
}))

vi.mock('./components/AiLyricExtractor', () => ({
  AiLyricExtractor: ({ onActivateCompletedDraft }: { onActivateCompletedDraft: (documentId: string) => void }) => (
    <button type="button" onClick={() => onActivateCompletedDraft('doc-a2')}>Activate completed AI draft</button>
  ),
}))

import { useLyricsStore } from '../../stores/lyricsStore'
import { LyricManagerView } from './LyricManagerView'
import { clearSavedTrackSignedUrlCache } from '../../audio/savedTrackLoader'
import {
  createLyricRecoveryRecord,
  createMemoryLyricRecoveryRepository,
  setLyricRecoveryRepositoryForTests,
  type LyricRecoveryRepository,
} from '../../lib/lyricDraftRecovery'

let container: HTMLElement
let root: ReturnType<typeof createRoot>
let documentsByTrack: Map<string, LyricDocumentVersion[]>
let documentById: Map<string, LyricDocumentVersion>
let cuesByDocument: Map<string, LyricCue[]>
let recoveryRepository: LyricRecoveryRepository

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(reason: unknown): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

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
  vi.useRealTimers()
  vi.clearAllMocks()
  clearSavedTrackSignedUrlCache()
  mocks.listTrackAnalysisPayloads.mockResolvedValue({ rows: [], error: null })
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
  mocks.removeSavedTrackByDbId.mockResolvedValue(true)
  mocks.loadTrackPage.mockResolvedValue({ tracks: [trackA, trackB], total: 2 })
  mocks.loadTrackById.mockImplementation(async (_userId: string, id: string) => [trackA, trackB].find(item => item.dbId === id) ?? null)
  mocks.getLegacyVersions.mockResolvedValue([])
  mocks.getLyricDocumentByClientLogicalId.mockResolvedValue(null)
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

  recoveryRepository = createMemoryLyricRecoveryRepository()
  setLyricRecoveryRepositoryForTests(recoveryRepository)

  useLyricsStore.getState().setOperationAccount(null)
  useLyricsStore.getState().clearLyrics()
  useLyricsStore.getState().setOperationAccount('user-1')

  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  setLyricRecoveryRepositoryForTests(null)
  vi.useRealTimers()
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

function trackCard(title: string): HTMLElement {
  const card = [...container.querySelectorAll<HTMLElement>('.vz-track-row')]
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

/** Version-card actions are icon buttons, found by their accessible name. */
function cardAction(label: string, card: HTMLElement): HTMLButtonElement {
  const button = card.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!button) throw new Error(`Card action not found: ${label}`)
  return button
}

/** A button by its visible text, or — for icon-only keys such as the header's Save — by its accessible name. */
function buttonWithText(text: string, rootElement: ParentNode = container): HTMLButtonElement {
  const button = [...rootElement.querySelectorAll<HTMLButtonElement>('button')]
    .find(candidate => candidate.textContent?.trim() === text || candidate.getAttribute('aria-label') === text)
  if (!button) throw new Error(`Button not found: ${text}`)
  return button
}

describe('LyricManagerView track-first workflow', () => {
  it('loads stored tracks, selects a track, loads all versions, and opens the active version without starting playback', async () => {
    await render()

    expect(mocks.loadTrackPage).toHaveBeenCalledWith('user-1', expect.objectContaining({ offset: 0, limit: 18 }))
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))

    expect(mocks.getVersions).toHaveBeenCalledWith(['track-a'])
    expect(mocks.getLyricDocumentById).toHaveBeenCalledWith('doc-a1')
    expect(container.textContent).toContain('Approved Lyrics')
    expect(container.textContent).toContain('Alternate Lyrics')
    expect(mocks.engine.addTrackUrls).not.toHaveBeenCalled()
    expect(mocks.engine.replaceTrackUrls).not.toHaveBeenCalled()
    expect(mocks.engine.play).not.toHaveBeenCalled()

    const alternate = documentCard('Alternate Lyrics').querySelector('.lmv-doc-card-main') as HTMLButtonElement
    await act(async () => alternate.click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a2'))
    // Which version is open / active is shown in the Versions list only, never in the track strip.
    expect(documentCard('Approved Lyrics').classList.contains('lmv-doc-card--active')).toBe(true)
    expect(documentCard('Alternate Lyrics').classList.contains('lmv-doc-card--active')).toBe(false)
    expect(documentCard('Alternate Lyrics').classList.contains('lmv-doc-card--open')).toBe(true)
  })

  it('has no OPEN dropdown or ACTIVE field in the track strip', async () => {
    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))
    const strip = container.querySelector('.lmv-track-meta-header')!
    expect(strip.querySelector('[role="combobox"]')).toBeNull()
    expect(strip.querySelector('.lmv-track-meta-versions')).toBeNull()
    expect(strip.textContent).not.toMatch(/\bActive\b/)
  })

  it('disables Make Active for a version with no cues and explains why', async () => {
    documentsByTrack.get('track-a')![1]!.cueCount = 0
    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))

    const action = cardAction('Make Active', documentCard('Alternate Lyrics'))
    expect(action.disabled).toBe(true)
    expect(action.title).toContain('No cues yet')
    await act(async () => action.click())
    expect(container.querySelector('[role="alertdialog"]')).toBeNull()
    expect(mocks.activateLyricDocument).not.toHaveBeenCalled()
  })

  it('reports why instead of opening a confirmation when an empty version is made active another way', async () => {
    documentsByTrack.get('track-a')![1]!.cueCount = 0
    cuesByDocument.set('doc-a2', [])
    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))
    await act(async () => (documentCard('Alternate Lyrics').querySelector('.lmv-doc-card-main') as HTMLButtonElement).click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a2'))

    // The open version's button stays available (its saved count may be stale while editing)...
    await act(async () => cardAction('Make Active', documentCard('Alternate Lyrics')).click())
    // ...but with nothing unsaved there is nothing to save, so the empty version is refused with a clear message.
    expect(container.querySelector('[role="alertdialog"]')).toBeNull()
    expect(container.textContent).toContain('has no cues yet')
    expect(mocks.activateLyricDocument).not.toHaveBeenCalled()
  })

  it('activates a populated version from the Make Active icon and moves the active state to it', async () => {
    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))
    await act(async () => cardAction('Make Active', documentCard('Alternate Lyrics')).click())
    await act(async () => buttonWithText('Make Active', container.querySelector('[role="alertdialog"]') as HTMLElement).click())
    await waitFor(() => expect(mocks.activateLyricDocument).toHaveBeenCalledWith('doc-a2', 1))
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

    // The save state is a badge in the header tail, directly left of the CPU readout (not in the Save button group).
    const badge = container.querySelector<HTMLElement>('.lmv-save-status-badge')
    expect(badge?.textContent).toBe('Unsaved')
    expect(badge?.classList.contains('vz-header-chip--saved')).toBe(true)
    expect(badge?.parentElement?.classList.contains('header-actions-stub')).toBe(true)
    expect(container.querySelector('.lmv-header [role="group"] .lmv-save-status-badge')).toBeNull()

    await act(async () => buttonWithText('Save').click())
    await waitFor(() => expect(mocks.saveLyricDocumentAtomic).toHaveBeenCalled())

    const saveCalls = mocks.saveLyricDocumentAtomic.mock.calls
    const input = saveCalls[saveCalls.length - 1]?.[0] as SaveLyricDocumentAtomicInput
    expect(input.documentId).toBeNull()
    expect(input.document.audioTrackId).toBe('track-b')
    expect(useLyricsStore.getState().activeDocument?.audioTrackId).toBe('track-b')

    mocks.saveLyricDocumentAtomic.mockClear()
    await act(async () => buttonWithText('Save + Make Active').click())
    await flush()
    expect(mocks.saveLyricDocumentAtomic).not.toHaveBeenCalled()
    expect(container.textContent).toContain('No cues in document')
  })

  it('duplicates a version as a dirty draft and activates another version transactionally', async () => {
    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))

    await act(async () => cardAction('Duplicate', documentCard('Approved Lyrics')).click())
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

    await act(async () => cardAction('Make Active', documentCard('Alternate Lyrics')).click())
    expect(mocks.activateLyricDocument).not.toHaveBeenCalled()
    await act(async () => buttonWithText('Make Active', container.querySelector('[role="alertdialog"]') as HTMLElement).click())
    await waitFor(() => expect(mocks.activateLyricDocument).toHaveBeenCalledWith('doc-a2', 1))
    expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a2')
  })

  it('blocks hard validation errors from Save and preserves the dirty editor state', async () => {
    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))
    mocks.saveLyricDocumentAtomic.mockClear()

    await act(async () => useLyricsStore.getState().setCues([{
      ...cue('invalid-save'),
      text: '',
    }]))
    expect(useLyricsStore.getState().editorDirty).toBe(true)

    await act(async () => buttonWithText('Save').click())
    await flush()

    expect(mocks.saveLyricDocumentAtomic).not.toHaveBeenCalled()
    expect(useLyricsStore.getState().editorDirty).toBe(true)
    expect(useLyricsStore.getState().cues[0].text).toBe('')
    expect(container.textContent).toContain('before saving')
  })

  it('allows warnings to save but blocks Save + Make Active on hard errors', async () => {
    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))
    mocks.saveLyricDocumentAtomic.mockClear()

    await act(async () => useLyricsStore.getState().setCues([{
      ...cue('warning-save'),
      words: [{ id: 'word-warning', text: 'Lay', startMs: -50, endMs: 100 }],
    }]))
    await act(async () => buttonWithText('Save').click())
    await waitFor(() => expect(mocks.saveLyricDocumentAtomic).toHaveBeenCalledTimes(1))

    mocks.saveLyricDocumentAtomic.mockClear()
    await act(async () => useLyricsStore.getState().setCues([{
      ...cue('invalid-active'),
      text: '',
    }]))
    await act(async () => buttonWithText('Save + Make Active').click())
    await flush()

    expect(mocks.saveLyricDocumentAtomic).not.toHaveBeenCalled()
    expect(container.textContent).toContain('before saving and activating')
  })

  it('validates the target persisted version before activation', async () => {
    cuesByDocument.set('doc-a2', [{ ...cue('invalid-target'), text: '' }])
    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))

    await act(async () => cardAction('Make Active', documentCard('Alternate Lyrics')).click())
    await act(async () => buttonWithText('Make Active', container.querySelector('[role="alertdialog"]') as HTMLElement).click())
    await flush()

    expect(mocks.getFullLyricDocument).toHaveBeenCalledWith('doc-a2')
    expect(mocks.activateLyricDocument).not.toHaveBeenCalled()
    expect(container.textContent).toContain('before activation')
    expect(documentById.get('doc-a1')?.isActive).toBe(true)
  })

  it('routes completed AI draft activation through the same validation gate', async () => {
    cuesByDocument.set('doc-a2', [])
    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))

    const aiTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find(button => button.textContent?.includes('AI Extract'))!
    await act(async () => aiTab.click())
    await act(async () => buttonWithText('Activate completed AI draft').click())
    await act(async () => buttonWithText('Make Active', container.querySelector('[role="alertdialog"]') as HTMLElement).click())
    await flush()

    expect(mocks.getFullLyricDocument).toHaveBeenCalledWith('doc-a2')
    expect(mocks.activateLyricDocument).not.toHaveBeenCalled()
    expect(container.textContent).toContain('No cues in document')
  })

  it('guards track changes and document changes with Save, Discard, and Cancel choices', async () => {
    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))

    await act(async () => useLyricsStore.getState().markEditorDirty(true))
    await act(async () => trackCard('From Grace').click())
    expect(container.textContent).toContain('Unsaved lyric changes')
    await act(async () => buttonWithText('Cancel').click())
    expect(trackCard('Reverie').getAttribute('aria-pressed')).toBe('true')

    await act(async () => trackCard('From Grace').click())
    await act(async () => buttonWithText('Discard').click())
    await waitFor(() => expect(trackCard('From Grace').getAttribute('aria-pressed')).toBe('true'))

    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))
    await act(async () => useLyricsStore.getState().markEditorDirty(true))
    const alternate = documentCard('Alternate Lyrics').querySelector('.lmv-doc-card-main') as HTMLButtonElement
    await act(async () => alternate.click())
    const saveDialog = container.querySelector('.lmv-dialog') as HTMLElement
    await act(async () => buttonWithText('Save', saveDialog).click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a2'))
    expect(mocks.saveLyricDocumentAtomic).toHaveBeenCalled()
  })

  it('keeps document-list responses scoped to the selected track', async () => {
    const trackAResponse = deferred<LyricDocumentVersion[]>()
    const trackBResponse = deferred<LyricDocumentVersion[]>()
    mocks.getVersions.mockImplementation((ids: string[]) => {
      if (ids[0] === 'track-a') return trackAResponse.promise
      if (ids[0] === 'track-b') return trackBResponse.promise
      return Promise.resolve([])
    })

    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(mocks.getVersions).toHaveBeenCalledWith(['track-a']))
    await act(async () => trackCard('From Grace').click())
    await waitFor(() => expect(mocks.getVersions).toHaveBeenCalledWith(['track-b']))

    trackBResponse.resolve([])
    await flush()
    trackAResponse.resolve(documentsByTrack.get('track-a') ?? [])
    await flush()

    expect(trackCard('From Grace').getAttribute('aria-pressed')).toBe('true')
    const versionTitles = [...container.querySelectorAll<HTMLElement>('.lmv-doc-card-title')].map(node => node.textContent)
    expect(versionTitles).not.toContain('Approved Lyrics')
    expect(useLyricsStore.getState()).toMatchObject({ activeAudioTrackId: 'track-b', activeDocumentId: null })
  })

  it('ignores an older response when the same track is selected again later', async () => {
    const firstTrackAResponse = deferred<LyricDocumentVersion[]>()
    const secondTrackAResponse = deferred<LyricDocumentVersion[]>()
    let trackACall = 0
    mocks.getVersions.mockImplementation((ids: string[]) => {
      if (ids[0] === 'track-a') {
        trackACall += 1
        return trackACall === 1 ? firstTrackAResponse.promise : secondTrackAResponse.promise
      }
      return Promise.resolve([])
    })

    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(trackACall).toBe(1))
    await act(async () => trackCard('From Grace').click())
    await waitFor(() => expect(trackCard('From Grace').getAttribute('aria-pressed')).toBe('true'))
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(trackACall).toBe(2))

    const newest = documentById.get('doc-a2')!
    secondTrackAResponse.resolve([newest])
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a2'))
    firstTrackAResponse.resolve([documentById.get('doc-a1')!])
    await flush()

    expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a2')
    expect(container.textContent).toContain('Alternate Lyrics')
    expect(container.textContent).not.toContain('Approved Lyrics')
  })

  it('preserves a local dirty draft created after a document request starts', async () => {
    const response = deferred<LyricDocumentVersion[]>()
    mocks.getVersions.mockReturnValue(response.promise)

    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(container.textContent).toContain('This track has no lyrics yet.'))
    await act(async () => buttonWithText('Create Blank Lyrics').click())

    await act(async () => useLyricsStore.getState().setDraftTitle('Local unsaved version'))
    expect(useLyricsStore.getState()).toMatchObject({ activeDocumentId: null, editorDirty: true })

    response.resolve(documentsByTrack.get('track-a') ?? [])
    await flush()

    expect(useLyricsStore.getState()).toMatchObject({
      activeDocumentId: null,
      activeAudioTrackId: 'track-a',
      draftTitle: 'Local unsaved version',
      editorDirty: true,
    })
  })

  it('abandons a stale signed-audio response when the selected track changes', async () => {
    const trackAUrl = deferred<string | null>()
    mocks.getSignedUrl.mockImplementation((path: string) => {
      if (path.includes('track-a')) return trackAUrl.promise
      return Promise.resolve('signed-track-b')
    })

    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))
    // Opening a track in the editor puts it on the deck by itself; track A's signing is still pending.
    await waitFor(() => expect(mocks.getSignedUrl).toHaveBeenCalledTimes(1))

    // Track B has no lyric editor open, so it is loaded by hand from the Load deck button.
    await act(async () => trackCard('From Grace').click())
    await waitFor(() => expect(buttonWithText('Load deck')).toBeTruthy())
    await act(async () => buttonWithText('Load deck').click())
    await waitFor(() => expect(mocks.engine.addTrackUrls).toHaveBeenCalledTimes(1))

    trackAUrl.resolve('signed-track-a')
    await flush()

    expect(mocks.engine.addTrackUrls).toHaveBeenCalledTimes(1)
    // The stale track-A response was abandoned: only track B reached the deck.
    expect(mocks.engine.addTrackUrls).toHaveBeenCalledWith(
      [expect.objectContaining({ dbId: 'track-b', url: 'signed-track-b' })],
      expect.objectContaining({ notifyOnBlocked: false }),
    )
    expect(JSON.stringify(mocks.engine.addTrackUrls.mock.calls)).not.toContain('signed-track-a')
  })

  it('keeps obsolete audio failures off the newly selected track', async () => {
    const trackAUrl = deferred<string | null>()
    mocks.getSignedUrl.mockImplementation((path: string) => {
      if (path.includes('track-a')) return trackAUrl.promise
      return Promise.resolve('signed-track-b')
    })

    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))
    await waitFor(() => expect(mocks.getSignedUrl).toHaveBeenCalledTimes(1))
    await act(async () => trackCard('From Grace').click())
    await waitFor(() => expect(buttonWithText('Load deck')).toBeTruthy())

    trackAUrl.reject(new Error('Track A signing failed'))
    await flush()

    expect(container.textContent).not.toContain('Track A signing failed')
    expect(buttonWithText('Load deck')).toBeTruthy()
    expect(mocks.engine.addTrackUrls).not.toHaveBeenCalled()
  })

  it('prevents a signed-audio request from committing after unmount', async () => {
    const signedUrl = deferred<string | null>()
    mocks.getSignedUrl.mockReturnValue(signedUrl.promise)

    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))
    await waitFor(() => expect(mocks.getSignedUrl).toHaveBeenCalledTimes(1))
    await act(async () => root.unmount())

    signedUrl.resolve('signed-after-unmount')
    await flush()
    expect(mocks.engine.addTrackUrls).not.toHaveBeenCalled()
    expect(mocks.engine.replaceTrackUrls).not.toHaveBeenCalled()

    root = createRoot(container)
  })

  it('uses truthful timestamp and transport semantics, with no Snap controls', async () => {
    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))

    const heroStats = container.querySelector('.lmv-track-meta-line')?.textContent ?? ''
    expect(heroStats).toContain('150 BPM')
    expect(heroStats).toContain('3:00')
    expect(heroStats).not.toContain('Updated')

    expect(container.textContent).not.toContain('↻ Loop')
    expect(container.textContent).not.toContain('⇄ Compare: Off')
    expect(container.querySelector('[aria-label="Previous unavailable"]')).toBeNull()
    expect(container.querySelector('[aria-label="Next unavailable"]')).toBeNull()

    // Snap and Overlays are not offered; Add cue / Undo / Redo are icon-only in their own row.
    expect(container.textContent).not.toMatch(/Snap|Overlays/)
    expect(container.querySelector('[aria-label="Snap resolution"]')).toBeNull()
    const editActions = container.querySelector('[aria-label="Cue editing"]')
    expect(editActions?.querySelectorAll('button')).toHaveLength(3)
  })

  it('autosaves dirty lyric edits to the user-scoped recovery repository', async () => {
    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))

    vi.useFakeTimers()
    await act(async () => useLyricsStore.getState().setDraftTitle('Recovered local title'))
    await act(async () => {
      vi.advanceTimersByTime(801)
      await Promise.resolve()
      await Promise.resolve()
    })

    const records = await recoveryRepository.listByUser('user-1')
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      userId: 'user-1',
      trackId: 'track-a',
      documentId: 'doc-a1',
      baseServerRevision: 1,
      title: 'Recovered local title',
    })
  })

  it('offers conflict-aware recovery and restores it only as unsaved local state', async () => {
    const recovered = createLyricRecoveryRecord({
      userId: 'user-1',
      trackId: 'track-a',
      documentId: 'doc-a1',
      logicalDocumentId: 'document:doc-a1',
    }, {
      baseServerRevision: 0,
      cues: [{ ...cue('recovered-cue'), text: 'Recovered local cue' }],
      title: 'Recovered title',
      artist: 'DVYDRM',
      defaultStyle: {},
      defaultAnimation: {},
      defaultEffects: {},
      globalOffsetMs: 0,
      sourceType: 'manual',
      sourceFormat: 'json',
      rawSourceText: null,
      metadata: null,
      activateOnSave: true,
      editVersion: 4,
    })
    await recoveryRepository.put(recovered)

    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(container.textContent).toContain('Recovered lyric draft conflicts with the server'))
    expect(mocks.saveLyricDocumentAtomic).not.toHaveBeenCalled()

    // Scoped to the dialog: the right inspector also has a "Review" tab.
    const recoveryDialog = container.querySelector<HTMLElement>('[role="alertdialog"]')!
    await act(async () => buttonWithText('Review', recoveryDialog).click())
    expect(container.textContent).toContain('Cue timing, text, or metadata changed')
    await act(async () => buttonWithText('Restore as Unsaved', recoveryDialog).click())

    expect(useLyricsStore.getState()).toMatchObject({
      draftTitle: 'Recovered title',
      editorDirty: true,
      activeWriteStatus: 'unsaved',
    })
    expect(useLyricsStore.getState().activeDocument?.revision).toBe(1)
    expect(useLyricsStore.getState().cues[0]?.text).toBe('Recovered local cue')
    expect(mocks.saveLyricDocumentAtomic).not.toHaveBeenCalled()
  })

  it('prevents an older status timer from clearing a newer success message', async () => {
    await render()
    await act(async () => trackCard('From Grace').click())
    await waitFor(() => expect(container.textContent).toContain('This track has no lyrics yet.'))

    vi.useFakeTimers()
    await act(async () => buttonWithText('Create Blank Lyrics').click())
    expect(container.textContent).toContain('Blank lyric version ready to edit')
    await act(async () => vi.advanceTimersByTime(2_000))

    await act(async () => {
      buttonWithText('Save').click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.textContent).toContain('Saved')

    await act(async () => vi.advanceTimersByTime(1_100))
    expect(container.textContent).toContain('Saved')
    await act(async () => vi.advanceTimersByTime(2_000))
    expect(container.textContent).not.toContain('Saved')
  })


  it('clears recovery only after a successful canonical save and preserves it after failure', async () => {
    await render()
    await act(async () => trackCard('Reverie').click())
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))

    vi.useFakeTimers()
    await act(async () => useLyricsStore.getState().setDraftTitle('Recovery before failed save'))
    await act(async () => {
      vi.advanceTimersByTime(801)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(await recoveryRepository.listByUser('user-1')).toHaveLength(1)

    mocks.saveLyricDocumentAtomic.mockRejectedValueOnce(new Error('network save failed'))
    await act(async () => {
      buttonWithText('Save').click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(await recoveryRepository.listByUser('user-1')).toHaveLength(1)
    expect(container.textContent).toContain('network save failed')

    await act(async () => {
      buttonWithText('Save').click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await act(async () => { await Promise.resolve() })
    }
    expect(await recoveryRepository.listByUser('user-1')).toEqual([])
  })


  it('consumes an AI-extract navigation intent by selecting the saved track and opening its workflow', async () => {
    const onNavigationIntentConsumed = vi.fn()
    await act(async () => root.render(
      <LyricManagerView
        onBack={vi.fn()}
        navigationIntent={{
          id: 'intent-ai-track-a',
          targetAudioTrackId: 'track-a',
          workflow: 'ai-extract',
        }}
        onNavigationIntentConsumed={onNavigationIntentConsumed}
      />,
    ))

    // The AI Extract workflow replaces the track list in the left rail, so selection is read from the store.
    await waitFor(() => expect(useLyricsStore.getState().activeAudioTrackId).toBe('track-a'))
    await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))
    const aiTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find(button => button.textContent?.includes('AI Extract'))
    expect(aiTab?.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('.lmv-workspace-tab-panel')?.classList.contains('lmv-workspace-tab-panel--scrollable')).toBe(true)
    expect(onNavigationIntentConsumed).toHaveBeenCalledWith('intent-ai-track-a')
  })


  describe('responsive drawers', () => {
    let managerWidth = 1848
    const observers: Array<() => void> = []
    let originalObserver: typeof ResizeObserver | undefined
    let originalRect: typeof HTMLElement.prototype.getBoundingClientRect

    async function resizeManager(width: number) {
      managerWidth = width
      await act(async () => { observers.forEach(notify => notify()) })
    }

    beforeEach(() => {
      managerWidth = 1848
      observers.length = 0
      originalObserver = globalThis.ResizeObserver
      originalRect = HTMLElement.prototype.getBoundingClientRect
      globalThis.ResizeObserver = class {
        constructor(private readonly callback: () => void) { observers.push(() => this.callback()) }
        observe() {}
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver
      HTMLElement.prototype.getBoundingClientRect = function patched(this: HTMLElement) {
        const rect = originalRect.call(this)
        if (!this.classList.contains('lmv-root')) return rect
        return { ...rect, width: managerWidth, right: managerWidth, toJSON: () => ({}) } as DOMRect
      }
    })

    afterEach(() => {
      globalThis.ResizeObserver = originalObserver as typeof ResizeObserver
      HTMLElement.prototype.getBoundingClientRect = originalRect
    })

    const layoutRoot = () => container.querySelector<HTMLElement>('.lmv-root')!
    const leftRail = () => container.querySelector<HTMLElement>('.lmv-left-rail')!
    const rightRail = () => container.querySelector<HTMLElement>('.lmv-right-rail')!
    const drawerToggle = (label: string) =>
      [...container.querySelectorAll<HTMLButtonElement>('.lmv-drawer-toggle')].find(button => button.textContent?.includes(label))

    it('keeps both rails docked at desktop widths, with no drawer controls or dead resize chrome', async () => {
      await render()
      expect(layoutRoot().dataset.layout).toBe('wide')
      await resizeManager(1368)
      expect(layoutRoot().dataset.layout).toBe('standard')
      expect(container.querySelector('.lmv-drawer-bar')).toBeNull()
      expect(leftRail().classList.contains('lmv-rail--drawer')).toBe(false)
      expect(rightRail().classList.contains('lmv-rail--drawer')).toBe(false)
      // Docked rails keep their collapse toggles.
      expect(container.querySelector('.vz-inspector-toggle--left')).not.toBeNull()
      expect(container.querySelector('.vz-inspector-toggle--right')).not.toBeNull()
    })

    it('laptop width: Tracks & Versions becomes a drawer while the Inspector stays docked', async () => {
      await render()
      await resizeManager(1208)

      expect(layoutRoot().dataset.layout).toBe('laptop')
      expect(leftRail().classList.contains('lmv-rail--drawer')).toBe(true)
      expect(rightRail().classList.contains('lmv-rail--drawer')).toBe(false)
      expect(drawerToggle('Tracks')).toBeTruthy()
      expect(drawerToggle('Inspector')).toBeUndefined()
      // A drawer has no desktop collapse toggle or dead separator.
      expect(container.querySelector('.vz-inspector-toggle--left')).toBeNull()
      expect(container.querySelector('.lmv-body')?.getAttribute('data-left-collapsed')).toBeNull()
    })

    it('narrow width: both rails are drawers and the editor stays mounted', async () => {
      await render()
      await resizeManager(696)

      expect(layoutRoot().dataset.layout).toBe('narrow')
      expect(leftRail().classList.contains('lmv-rail--drawer')).toBe(true)
      expect(rightRail().classList.contains('lmv-rail--drawer')).toBe(true)
      expect(drawerToggle('Tracks')).toBeTruthy()
      expect(drawerToggle('Inspector')).toBeTruthy()
      expect(container.querySelector('.lmv-center')).not.toBeNull()
      expect(container.querySelector('[aria-label="Timeline controls"]')).toBeNull()
    })

    it('opens and closes a drawer from its button, the close control, the scrim and Escape — one at a time', async () => {
      await render()
      await resizeManager(696)
      const isOpen = (rail: HTMLElement) => rail.classList.contains('lmv-rail--drawer-open')

      await act(async () => drawerToggle('Tracks')!.click())
      expect(isOpen(leftRail())).toBe(true)
      expect(drawerToggle('Tracks')!.getAttribute('aria-expanded')).toBe('true')
      expect(container.querySelector('[data-testid="lyric-drawer-scrim"]')).not.toBeNull()

      // Opening the Inspector replaces the Tracks drawer rather than stacking two overlays.
      await act(async () => drawerToggle('Inspector')!.click())
      expect(isOpen(leftRail())).toBe(false)
      expect(isOpen(rightRail())).toBe(true)

      await act(async () => container.querySelector<HTMLElement>('[data-testid="lyric-drawer-scrim"]')!.click())
      expect(isOpen(rightRail())).toBe(false)
      expect(container.querySelector('[data-testid="lyric-drawer-scrim"]')).toBeNull()

      await act(async () => drawerToggle('Tracks')!.click())
      await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
      expect(isOpen(leftRail())).toBe(false)

      await act(async () => drawerToggle('Inspector')!.click())
      await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close inspector"]')!.click())
      expect(isOpen(rightRail())).toBe(false)
    })

    it('keeps the track selection and the inspector tab when drawers close and reopen', async () => {
      await render()
      await resizeManager(696)

      await act(async () => drawerToggle('Tracks')!.click())
      await act(async () => trackCard('Reverie').click())
      await waitFor(() => expect(useLyricsStore.getState().editorDocumentId).toBe('doc-a1'))
      // Opening a version from the Tracks drawer returns the user to the editor.
      await waitFor(() => expect(leftRail().classList.contains('lmv-rail--drawer-open')).toBe(false))
      expect(trackCard('Reverie').getAttribute('aria-pressed')).toBe('true')

      await act(async () => drawerToggle('Inspector')!.click())
      const reviewTab = [...rightRail().querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(tab => tab.textContent === 'Review')!
      await act(async () => reviewTab.click())
      expect(reviewTab.getAttribute('aria-selected')).toBe('true')

      await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close inspector"]')!.click())
      await act(async () => drawerToggle('Inspector')!.click())
      const tabs = [...rightRail().querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      expect(tabs.find(tab => tab.getAttribute('aria-selected') === 'true')?.textContent).toBe('Review')
      // The editor state was never touched by any of this.
      expect(useLyricsStore.getState().editorDirty).toBe(false)
    })

    it('restores the docked layout, with the desktop collapse preference intact, when widening again', async () => {
      await render()
      // Collapse the docked left rail on desktop, then shrink to a drawer and grow back.
      await act(async () => container.querySelector<HTMLButtonElement>('.vz-inspector-toggle--left')!.click())
      expect(container.querySelector('.lmv-body')?.getAttribute('data-left-collapsed')).toBe('true')

      await resizeManager(1208)
      expect(container.querySelector('.lmv-body')?.getAttribute('data-left-collapsed')).toBeNull()
      await act(async () => drawerToggle('Tracks')!.click())

      await resizeManager(1848)
      expect(layoutRoot().dataset.layout).toBe('wide')
      expect(container.querySelector('.lmv-drawer-bar')).toBeNull()
      expect(container.querySelector('.lmv-drawer-scrim')).toBeNull()
      expect(container.querySelector('.lmv-body')?.getAttribute('data-left-collapsed')).toBe('true')
    })
  })

})
