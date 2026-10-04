import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricCue, LyricDocument } from '../types/lyrics'
import type { LyricRecoveryRecord } from '../lib/lyricDraftRecovery'

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

import { resolveSaveActivation, resolveSaveRequest, useLyricsStore } from './lyricsStore'

const TRACK = 'track-1'

function makeDocument(id: string, isActive: boolean): LyricDocument {
  return {
    id,
    userId: 'user-1',
    audioTrackId: TRACK,
    visualSessionId: null,
    title: id,
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

const cue: LyricCue = { id: 'cue-1', startMs: 0, endMs: 1_000, text: 'Hello', source: 'manual' }

/** What the atomic save RPC reports back: the persisted document carries the requested `activate`. */
function mockAtomicSave() {
  lyricDbMocks.saveLyricDocumentAtomic.mockImplementation(async (input: { activate?: boolean }) => ({
    ok: true,
    kind: 'success',
    created: true,
    document: makeDocument('saved-doc', input.activate === true),
    cues: [cue],
  }))
}

const lastActivate = () => lyricDbMocks.saveLyricDocumentAtomic.mock.lastCall?.[0]?.activate

/** A brand-new draft for a track, as prepareTrackDraft() leaves the store. */
function openNewDraft(activateOnSave: boolean) {
  useLyricsStore.getState().setEditorDocument(null, [], TRACK)
  useLyricsStore.setState({ draftTitle: 'New draft', draftActivateOnSave: activateOnSave, editorDirty: true })
}

describe('resolveSaveActivation precedence', () => {
  const saved = (isActive: boolean) => ({ isActive })

  it('an explicit instruction beats everything, including an explicit false', () => {
    expect(resolveSaveActivation({ explicit: true, savedDocument: saved(false), draftActivateOnSave: false })).toBe(true)
    expect(resolveSaveActivation({ explicit: true, savedDocument: null, draftActivateOnSave: false })).toBe(true)
    expect(resolveSaveActivation({ explicit: false, savedDocument: saved(true), draftActivateOnSave: true })).toBe(false)
    expect(resolveSaveActivation({ explicit: false, savedDocument: null, draftActivateOnSave: true })).toBe(false)
  })

  it('a saved document keeps its persisted state; draft intent is ignored for it', () => {
    expect(resolveSaveActivation({ savedDocument: saved(true), draftActivateOnSave: false })).toBe(true)
    expect(resolveSaveActivation({ savedDocument: saved(false), draftActivateOnSave: true })).toBe(false)
  })

  it('a new document honors draft intent and otherwise saves inactive', () => {
    expect(resolveSaveActivation({ savedDocument: null, draftActivateOnSave: true })).toBe(true)
    expect(resolveSaveActivation({ savedDocument: null, draftActivateOnSave: false })).toBe(false)
  })
})

describe('resolveSaveRequest (what a plain Save asks for)', () => {
  const base = { savedDocument: null, draftActivateOnSave: true, trackHasActiveVersion: false, hasValidationErrors: false }

  it('lets first-save intent stand when the track has no active version and the draft is valid', () => {
    expect(resolveSaveRequest(base)).toBeUndefined()
  })

  it('saves the draft inactive when an active version appeared after the draft was created (e.g. AI extraction)', () => {
    expect(resolveSaveRequest({ ...base, trackHasActiveVersion: true })).toBe(false)
  })

  it('saves an invalid or empty draft inactive instead of activating it', () => {
    expect(resolveSaveRequest({ ...base, hasValidationErrors: true })).toBe(false)
  })

  it('never softens an explicit request, and never touches an already-saved document', () => {
    expect(resolveSaveRequest({ ...base, requestedMakeActive: true, trackHasActiveVersion: true, hasValidationErrors: true })).toBe(true)
    expect(resolveSaveRequest({ ...base, requestedMakeActive: false })).toBe(false)
    expect(resolveSaveRequest({ ...base, savedDocument: { isActive: true }, trackHasActiveVersion: true })).toBeUndefined()
  })
})

describe('lyric save activation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useLyricsStore.getState().clearLyrics()
    mockAtomicSave()
  })

  it('1. first manual version on a track with no active lyrics becomes ACTIVE on normal Save', async () => {
    openNewDraft(true)

    const result = await useLyricsStore.getState().saveActiveLyricDocument([cue])

    expect(lastActivate()).toBe(true)
    expect(result?.ok && result.document.isActive).toBe(true)
  })

  it('2. first imported version carrying draft activation intent becomes ACTIVE on normal Save', async () => {
    openNewDraft(true)
    useLyricsStore.getState().setDraftSourceMeta({
      sourceType: 'json_import',
      sourceFormat: 'json',
      rawSourceText: '{"cues":[]}',
      metadata: { importedFrom: 'file' },
    })

    const result = await useLyricsStore.getState().saveActiveLyricDocument([cue])

    expect(lyricDbMocks.saveLyricDocumentAtomic).toHaveBeenCalledWith(
      expect.objectContaining({ activate: true, document: expect.objectContaining({ sourceType: 'json_import' }) }),
    )
    expect(result?.ok && result.document.isActive).toBe(true)
  })

  it('3. Version B saved normally while Version A is ACTIVE stays inactive (no draft intent)', async () => {
    openNewDraft(false)

    const result = await useLyricsStore.getState().saveActiveLyricDocument([cue])

    expect(lastActivate()).toBe(false)
    expect(result?.ok && result.document.isActive).toBe(false)
  })

  it('4. Save + Make Active activates Version B even though Version A is active', async () => {
    openNewDraft(false)

    const result = await useLyricsStore.getState().saveActiveLyricDocument([cue], { makeActive: true })

    // activate: true is what makes the RPC deactivate the track's other active versions in the same transaction.
    expect(lastActivate()).toBe(true)
    expect(result?.ok && result.document.isActive).toBe(true)
  })

  it('5. saving the currently active Version A preserves ACTIVE', async () => {
    const versionA = makeDocument('doc-a', true)
    useLyricsStore.getState().setEditorDocument(versionA, [cue])
    useLyricsStore.getState().setDraftTitle('Renamed')
    lyricDbMocks.saveLyricDocumentAtomic.mockResolvedValue({
      ok: true,
      kind: 'success',
      created: false,
      document: { ...versionA, title: 'Renamed', revision: 2 },
      cues: [cue],
    })

    await useLyricsStore.getState().saveActiveLyricDocument([cue])

    expect(lastActivate()).toBe(true)
  })

  it('an inactive saved version stays inactive on normal Save even if a stale draft flag is set', async () => {
    const versionB = makeDocument('doc-b', false)
    useLyricsStore.getState().setEditorDocument(versionB, [cue])
    useLyricsStore.setState({ draftActivateOnSave: true })
    useLyricsStore.getState().setDraftTitle('Edited')

    await useLyricsStore.getState().saveActiveLyricDocument([cue])

    expect(lastActivate()).toBe(false)
  })

  it('an explicit makeActive: false is honored over draft intent and over an active document', async () => {
    openNewDraft(true)
    await useLyricsStore.getState().saveActiveLyricDocument([cue], { makeActive: false })
    expect(lastActivate()).toBe(false)

    useLyricsStore.getState().setEditorDocument(makeDocument('doc-a', true), [cue])
    await useLyricsStore.getState().saveActiveLyricDocument([cue], { makeActive: false })
    expect(lastActivate()).toBe(false)
  })

  it('6. a recovered new draft that was meant to activate on first save still activates', async () => {
    useLyricsStore.getState().setOperationAccount('user-1')
    useLyricsStore.getState().setEditorDocument(null, [], TRACK)
    const recovery: LyricRecoveryRecord = {
      key: 'recovery-key',
      schemaVersion: 1,
      userId: 'user-1',
      trackId: TRACK,
      documentId: null,
      logicalDocumentId: useLyricsStore.getState().activeLogicalDocumentId,
      baseServerRevision: null,
      cues: [cue],
      title: 'Recovered draft',
      artist: 'Artist',
      defaultStyle: {},
      defaultAnimation: {},
      defaultEffects: {},
      globalOffsetMs: 0,
      sourceType: null,
      sourceFormat: null,
      rawSourceText: null,
      metadata: null,
      activateOnSave: true,
      editVersion: 3,
      lastEditAt: Date.now(),
    }

    useLyricsStore.getState().restoreRecoveredLyricDraft(recovery)
    expect(useLyricsStore.getState().draftActivateOnSave).toBe(true)

    await useLyricsStore.getState().saveActiveLyricDocument()

    expect(lastActivate()).toBe(true)
  })

  it('a recovered draft recorded without activation intent saves inactive', async () => {
    useLyricsStore.getState().setOperationAccount('user-1')
    useLyricsStore.getState().setEditorDocument(null, [], TRACK)
    useLyricsStore.getState().restoreRecoveredLyricDraft({
      key: 'k', schemaVersion: 1, userId: 'user-1', trackId: TRACK, documentId: null,
      logicalDocumentId: useLyricsStore.getState().activeLogicalDocumentId, baseServerRevision: null,
      cues: [cue], title: 'Recovered', artist: '', defaultStyle: {}, defaultAnimation: {}, defaultEffects: {},
      globalOffsetMs: 0, sourceType: null, sourceFormat: null, rawSourceText: null, metadata: null,
      activateOnSave: false, editVersion: 1, lastEditAt: Date.now(),
    })

    await useLyricsStore.getState().saveActiveLyricDocument()

    expect(lastActivate()).toBe(false)
  })
})
