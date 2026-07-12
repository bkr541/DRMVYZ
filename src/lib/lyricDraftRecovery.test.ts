import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import type { LyricCue, LyricDocument } from '../types/lyrics'
import { useLyricsStore } from '../stores/lyricsStore'
import {
  cleanupObsoleteLyricRecoveries,
  createIndexedDbLyricRecoveryRepository,
  createLyricRecoveryRecord,
  createMemoryLyricRecoveryRepository,
  deleteLyricRecoveryForDocument,
  deleteLyricRecoveryForTrack,
  describeLyricRecoveryDifferences,
  findLyricRecovery,
  lyricRecoveryKey,
  reconcileLyricRecoveryAfterCanonicalWrite,
  recoveryConflictsWithServer,
} from './lyricDraftRecovery'

function cue(text = 'Lay your doubts down'): LyricCue {
  return { id: `cue-${text}`, startMs: 0, endMs: 1_200, text }
}

function document(revision = 3): LyricDocument {
  return {
    id: 'doc-1',
    userId: 'user-1',
    audioTrackId: 'track-1',
    visualSessionId: null,
    title: 'Reverie',
    artist: 'DVYDRM',
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
    createdAt: '2026-07-01T12:00:00.000Z',
    updatedAt: '2026-07-01T12:00:00.000Z',
  }
}

function recovery(overrides: Partial<ReturnType<typeof createLyricRecoveryRecord>> = {}) {
  return {
    ...createLyricRecoveryRecord({
      userId: 'user-1',
      trackId: 'track-1',
      documentId: 'doc-1',
      logicalDocumentId: 'document:doc-1',
    }, {
      baseServerRevision: 3,
      cues: [cue()],
      title: 'Recovered Reverie',
      artist: 'DVYDRM',
      defaultStyle: {},
      defaultAnimation: {},
      defaultEffects: {},
      globalOffsetMs: 0,
      sourceType: null,
      sourceFormat: null,
      rawSourceText: null,
      metadata: null,
      activateOnSave: true,
      editVersion: 4,
      lastEditAt: 1_000,
    }),
    ...overrides,
  }
}

beforeEach(() => {
  useLyricsStore.getState().clearLyrics()
  useLyricsStore.getState().setOperationAccount('user-1')
  useLyricsStore.getState().beginEditorSession()
})

describe('lyric draft recovery persistence', () => {
  it('survives repository remounts and a simulated renderer reload', async () => {
    const records = new Map()
    const firstRenderer = createMemoryLyricRecoveryRepository(records)
    const saved = recovery()
    await firstRenderer.put(saved)

    const reloadedRenderer = createMemoryLyricRecoveryRepository(records)
    await expect(reloadedRenderer.get(saved.key)).resolves.toEqual(saved)
  })

  it('persists through an IndexedDB-backed renderer reload', async () => {
    const indexedDb = new IDBFactory()
    const firstRenderer = createIndexedDbLyricRecoveryRepository(indexedDb)
    const saved = recovery({ lastEditAt: 2_000 })
    await firstRenderer.put(saved)

    const reloadedRenderer = createIndexedDbLyricRecoveryRepository(indexedDb)
    await expect(reloadedRenderer.get(saved.key)).resolves.toEqual(saved)
    await expect(reloadedRenderer.listByUser('user-2')).resolves.toEqual([])
  })

  it('scopes recovery records by authenticated user', async () => {
    const repository = createMemoryLyricRecoveryRepository()
    const userOne = recovery()
    const userTwo = recovery({
      userId: 'user-2',
      key: lyricRecoveryKey({ userId: 'user-2', trackId: 'track-1', documentId: 'doc-1', logicalDocumentId: 'document:doc-1' }),
    })
    await repository.put(userOne)
    await repository.put(userTwo)

    await expect(findLyricRecovery({
      userId: 'user-1', trackId: 'track-1', documentId: 'doc-1', logicalDocumentId: 'document:doc-1',
    }, repository)).resolves.toEqual(userOne)
    await expect(repository.listByUser('user-1')).resolves.toEqual([userOne])
  })

  it('migrates a first-save draft key to the assigned document without losing newer edits', async () => {
    const repository = createMemoryLyricRecoveryRepository()
    const draft = createLyricRecoveryRecord({
      userId: 'user-1', trackId: 'track-1', documentId: null, logicalDocumentId: 'draft:track:track-1',
    }, {
      baseServerRevision: null,
      cues: [cue('older')],
      title: 'Draft', artist: 'DVYDRM', defaultStyle: {}, defaultAnimation: {}, defaultEffects: {},
      globalOffsetMs: 0, sourceType: null, sourceFormat: null, rawSourceText: null, metadata: null,
      activateOnSave: true, editVersion: 1,
    })
    const newer = createLyricRecoveryRecord({
      userId: 'user-1', trackId: 'track-1', documentId: 'doc-created', logicalDocumentId: 'draft:track:track-1',
    }, {
      baseServerRevision: 1,
      cues: [cue('newer')],
      title: 'Draft', artist: 'DVYDRM', defaultStyle: {}, defaultAnimation: {}, defaultEffects: {},
      globalOffsetMs: 0, sourceType: null, sourceFormat: null, rawSourceText: null, metadata: null,
      activateOnSave: true, editVersion: 2,
    })
    await repository.put(draft)

    await reconcileLyricRecoveryAfterCanonicalWrite({
      userId: 'user-1', trackId: 'track-1', documentId: 'doc-created',
      logicalDocumentId: 'draft:track:track-1', newerRecovery: newer,
    }, repository)

    await expect(repository.get(draft.key)).resolves.toBeNull()
    await expect(repository.get(newer.key)).resolves.toEqual(newer)
  })

  it('clears matching recovery after a successful canonical save but preserves it when no clear occurs', async () => {
    const repository = createMemoryLyricRecoveryRepository()
    const saved = recovery()
    await repository.put(saved)
    await reconcileLyricRecoveryAfterCanonicalWrite({
      userId: 'user-1', trackId: 'track-1', documentId: 'doc-1',
      logicalDocumentId: 'document:doc-1', newerRecovery: null,
    }, repository)
    await expect(repository.get(saved.key)).resolves.toBeNull()

    await repository.put(saved)
    await expect(repository.get(saved.key)).resolves.toEqual(saved)
  })

  it('detects advanced server revisions and summarizes meaningful review differences', () => {
    const saved = recovery()
    expect(recoveryConflictsWithServer(saved, document(3))).toBe(false)
    expect(recoveryConflictsWithServer(saved, document(4))).toBe(true)
    expect(describeLyricRecoveryDifferences(saved, document(3), [cue()])).toContain('Title changed')
  })

  it('deletes only the intended document or track recovery records', async () => {
    const repository = createMemoryLyricRecoveryRepository()
    const first = recovery()
    const second = recovery({
      documentId: 'doc-2',
      key: lyricRecoveryKey({ userId: 'user-1', trackId: 'track-1', documentId: 'doc-2', logicalDocumentId: 'document:doc-2' }),
    })
    const otherTrack = recovery({
      trackId: 'track-2',
      documentId: 'doc-3',
      key: lyricRecoveryKey({ userId: 'user-1', trackId: 'track-2', documentId: 'doc-3', logicalDocumentId: 'document:doc-3' }),
    })
    await Promise.all([repository.put(first), repository.put(second), repository.put(otherTrack)])

    await deleteLyricRecoveryForDocument('user-1', 'doc-1', repository)
    expect((await repository.listByUser('user-1')).map(item => item.documentId)).toEqual(['doc-2', 'doc-3'])

    await deleteLyricRecoveryForTrack('user-1', 'track-1', repository)
    expect((await repository.listByUser('user-1')).map(item => item.documentId)).toEqual(['doc-3'])
  })

  it('invalidates obsolete recovery data without touching fresh drafts', async () => {
    const repository = createMemoryLyricRecoveryRepository()
    const old = recovery({ lastEditAt: 1 })
    const fresh = recovery({
      documentId: 'doc-2',
      key: lyricRecoveryKey({ userId: 'user-1', trackId: 'track-1', documentId: 'doc-2', logicalDocumentId: 'document:doc-2' }),
      lastEditAt: 1000 * 60 * 60 * 24 * 100,
    })
    await repository.put(old)
    await repository.put(fresh)
    await cleanupObsoleteLyricRecoveries('user-1', 1000 * 60 * 60 * 24 * 100, repository)
    expect((await repository.listByUser('user-1')).map(item => item.documentId)).toEqual(['doc-2'])
  })
})

describe('lyric recovery restore semantics', () => {
  it('restores deliberately as dirty local state without changing the canonical revision', () => {
    useLyricsStore.getState().setActiveDocument(document(3), [cue('server')], 'track-1')
    useLyricsStore.getState().restoreRecoveredLyricDraft(recovery())

    const state = useLyricsStore.getState()
    expect(state.activeDocument?.revision).toBe(3)
    expect(state.draftTitle).toBe('Recovered Reverie')
    expect(state.cues[0]?.text).toBe('Lay your doubts down')
    expect(state.editorDirty).toBe(true)
    expect(state.activeWriteStatus).toBe('unsaved')
    expect(state.lastCanonicalWrite).toBeNull()
  })

  it('refuses to restore another user’s private draft', () => {
    useLyricsStore.getState().setActiveDocument(document(3), [cue('server')], 'track-1')
    useLyricsStore.getState().restoreRecoveredLyricDraft(recovery({ userId: 'user-2' }))
    expect(useLyricsStore.getState().cues[0]?.text).toBe('server')
    expect(useLyricsStore.getState().editorDirty).toBe(false)
  })


  it('preserves a matching canonical document during initial account scoping', () => {
    useLyricsStore.getState().setOperationAccount(null)
    useLyricsStore.getState().setActiveDocument(document(3), [cue('current')], 'track-1')

    useLyricsStore.getState().setOperationAccount('user-1')

    expect(useLyricsStore.getState()).toMatchObject({
      operationAccountId: 'user-1',
      activeDocumentId: 'doc-1',
      activeAudioTrackId: 'track-1',
    })
    expect(useLyricsStore.getState().cues[0]?.text).toBe('current')
  })

  it('clears loaded lyric content when the authenticated account changes', () => {
    useLyricsStore.getState().setActiveDocument(document(3), [cue('private')], 'track-1')
    useLyricsStore.getState().restoreRecoveredLyricDraft(recovery())

    useLyricsStore.getState().setOperationAccount('user-2')

    expect(useLyricsStore.getState()).toMatchObject({
      operationAccountId: 'user-2',
      activeDocument: null,
      activeDocumentId: null,
      activeAudioTrackId: null,
      cues: [],
      draftTitle: '',
      editorDirty: false,
      activeWriteStatus: 'saved',
    })
  })
})
