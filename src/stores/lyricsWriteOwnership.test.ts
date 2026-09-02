import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  LyricCue,
  LyricDocument,
  SaveLyricDocumentAtomicInput,
  SaveLyricDocumentResult,
} from '../types/lyrics'

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

function lyricDocument(
  id: string,
  revision: number,
  title = 'Reverie',
  audioTrackId: string | null = 'track-1',
): LyricDocument {
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
    isActive: true,
    metadata: {},
    revision,
    createdAt: '2026-07-11T12:00:00.000Z',
    updatedAt: '2026-07-11T12:00:00.000Z',
  }
}

function cue(id = 'cue-1', text = 'Lay your doubts down'): LyricCue {
  return {
    id,
    text,
    startMs: 0,
    endMs: 1200,
    reviewStatus: 'unreviewed',
  }
}

function success(document: LyricDocument, cues: LyricCue[] = []): SaveLyricDocumentResult {
  return { ok: true, kind: 'success', document, cues }
}

async function flushQueue(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

function prepareDraft(title = 'Reverie'): void {
  useLyricsStore.setState({
    activeAudioTrackId: 'track-1',
    draftTitle: title,
    draftArtist: 'DVYDRM',
    cues: [cue()],
    editorDirty: true,
    activeEditVersion: 1,
  })
}

describe('lyricsStore scoped ownership and serialized writes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useLyricsStore.getState().setOperationAccount(null)
    useLyricsStore.getState().clearLyrics()
    useLyricsStore.getState().setOperationAccount('user-1')
    useLyricsStore.getState().beginEditorSession()
    lyricDbMocks.getLyricDocumentByClientLogicalId.mockResolvedValue(null)
    lyricDbMocks.getLyricCuesForDocument.mockResolvedValue([])
    lyricDbMocks.getActiveLyricDocumentForAudioTrack.mockResolvedValue(null)
    lyricDbMocks.getActiveLyricDocumentForVisualSession.mockResolvedValue(null)
  })

  it('commits a new draft ID and revision even when an unrelated lyric read starts', async () => {
    prepareDraft()
    const write = deferred<SaveLyricDocumentResult>()
    const read = deferred<LyricDocument | null>()
    lyricDbMocks.saveLyricDocumentAtomic.mockReturnValue(write.promise)
    lyricDbMocks.getActiveLyricDocumentForAudioTrack.mockReturnValue(read.promise)

    const savePromise = useLyricsStore.getState().saveActiveLyricDocument()
    useLyricsStore.getState().markEditorDirty(false)
    const readPromise = useLyricsStore.getState().loadLyricsForAudioTrack('track-2', true)
    read.resolve(null)
    await readPromise

    const saved = lyricDocument('document-created', 1)
    write.resolve(success(saved, [cue('saved-cue')]))
    const result = await savePromise

    expect(result).toMatchObject({ ok: true, document: { id: 'document-created', revision: 1 } })
    expect(useLyricsStore.getState().lastCanonicalWrite?.document).toMatchObject({
      id: 'document-created',
      revision: 1,
    })
  })

  it('transitions a local draft queue to its canonical ID and updates it instead of creating a duplicate', async () => {
    prepareDraft('First title')
    lyricDbMocks.saveLyricDocumentAtomic
      .mockResolvedValueOnce(success(lyricDocument('document-created', 1, 'First title'), [cue()]))
      .mockResolvedValueOnce(success(lyricDocument('document-created', 2, 'Second title'), [cue()]))

    await useLyricsStore.getState().saveActiveLyricDocument()
    expect(useLyricsStore.getState().activeDocument).toMatchObject({ id: 'document-created', revision: 1 })

    useLyricsStore.getState().setDraftTitle('Second title')
    await useLyricsStore.getState().saveActiveLyricDocument()

    const calls = lyricDbMocks.saveLyricDocumentAtomic.mock.calls.map(call => call[0] as SaveLyricDocumentAtomicInput)
    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({ documentId: null, expectedRevision: null })
    expect(calls[1]).toMatchObject({ documentId: 'document-created', expectedRevision: 1 })
    expect(useLyricsStore.getState().activeDocument).toMatchObject({ id: 'document-created', revision: 2 })
  })

  it('commits the revision returned for an existing document', async () => {
    useLyricsStore.getState().setActiveDocument(lyricDocument('document-1', 4), [cue()])
    useLyricsStore.getState().setDraftTitle('Revised title')
    lyricDbMocks.saveLyricDocumentAtomic.mockResolvedValue(
      success(lyricDocument('document-1', 5, 'Revised title'), [cue()]),
    )

    await useLyricsStore.getState().saveActiveLyricDocument()

    expect(lyricDbMocks.saveLyricDocumentAtomic).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 'document-1', expectedRevision: 4 }),
    )
    expect(useLyricsStore.getState().activeDocument?.revision).toBe(5)
  })

  it('executes queued writes in edit order and advances each expected revision', async () => {
    useLyricsStore.getState().setActiveDocument(lyricDocument('document-1', 1, 'Original'), [cue()])
    const first = deferred<SaveLyricDocumentResult>()
    const second = deferred<SaveLyricDocumentResult>()
    lyricDbMocks.saveLyricDocumentAtomic
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    useLyricsStore.getState().setDraftTitle('First edit')
    const firstSave = useLyricsStore.getState().saveActiveLyricDocument()
    useLyricsStore.getState().setDraftTitle('Second edit')
    const secondSave = useLyricsStore.getState().saveActiveLyricDocument()

    expect(lyricDbMocks.saveLyricDocumentAtomic).toHaveBeenCalledTimes(1)
    expect(useLyricsStore.getState()).toMatchObject({ isSaving: true, activeWriteStatus: 'saving' })

    first.resolve(success(lyricDocument('document-1', 2, 'First edit'), [cue()]))
    await flushQueue()

    expect(lyricDbMocks.saveLyricDocumentAtomic).toHaveBeenCalledTimes(2)
    const secondInput = lyricDbMocks.saveLyricDocumentAtomic.mock.calls[1]?.[0] as SaveLyricDocumentAtomicInput
    expect(secondInput).toMatchObject({
      documentId: 'document-1',
      expectedRevision: 2,
      document: expect.objectContaining({ title: 'Second edit' }),
    })
    expect(useLyricsStore.getState().isSaving).toBe(true)

    second.resolve(success(lyricDocument('document-1', 3, 'Second edit'), [cue()]))
    await Promise.all([firstSave, secondSave])

    expect(useLyricsStore.getState()).toMatchObject({ isSaving: false, activeWriteStatus: 'saved' })
    expect(useLyricsStore.getState().activeDocument).toMatchObject({ revision: 3, title: 'Second edit' })
  })

  it('recovers explicitly after a failed queued write without deadlocking the document', async () => {
    useLyricsStore.getState().setActiveDocument(lyricDocument('document-1', 1), [cue()])
    lyricDbMocks.saveLyricDocumentAtomic
      .mockResolvedValueOnce({ ok: false, kind: 'unexpected', message: 'Network failed.' })
      .mockResolvedValueOnce(success(lyricDocument('document-1', 2, 'Recovered'), [cue()]))

    useLyricsStore.getState().setDraftTitle('Failed attempt')
    const failed = await useLyricsStore.getState().saveActiveLyricDocument()
    expect(failed).toMatchObject({ ok: false, kind: 'unexpected' })
    expect(useLyricsStore.getState()).toMatchObject({ activeWriteStatus: 'failed', isSaving: false })

    useLyricsStore.getState().setDraftTitle('Recovered')
    const recovered = await useLyricsStore.getState().saveActiveLyricDocument()

    expect(recovered).toMatchObject({ ok: true, document: { revision: 2 } })
    expect(lyricDbMocks.saveLyricDocumentAtomic).toHaveBeenCalledTimes(2)
    expect(useLyricsStore.getState()).toMatchObject({ activeWriteStatus: 'saved', isSaving: false })
  })

  it('holds dependent work on conflict, preserves attempted values, then resumes from the resolved revision', async () => {
    useLyricsStore.getState().setActiveDocument(lyricDocument('document-1', 1, 'Original'), [cue()])
    const conflict = deferred<SaveLyricDocumentResult>()
    const resumed = deferred<SaveLyricDocumentResult>()
    lyricDbMocks.saveLyricDocumentAtomic
      .mockReturnValueOnce(conflict.promise)
      .mockReturnValueOnce(resumed.promise)

    useLyricsStore.getState().setDraftTitle('First attempted edit')
    const firstSave = useLyricsStore.getState().saveActiveLyricDocument()
    useLyricsStore.getState().setDraftTitle('Dependent edit')
    const dependentSave = useLyricsStore.getState().saveActiveLyricDocument()

    conflict.resolve({
      ok: false,
      kind: 'conflict',
      message: 'The server document changed.',
      currentRevision: 5,
    })
    await firstSave
    await flushQueue()

    expect(lyricDbMocks.saveLyricDocumentAtomic).toHaveBeenCalledTimes(1)
    expect(useLyricsStore.getState()).toMatchObject({
      draftTitle: 'Dependent edit',
      editorDirty: true,
      activeWriteStatus: 'conflict',
      isSaving: false,
    })

    useLyricsStore.getState().resolveActiveLyricConflict(
      lyricDocument('document-1', 5, 'Server title'),
      [cue('server-cue', 'Server text')],
    )
    await flushQueue()

    const resumedInput = lyricDbMocks.saveLyricDocumentAtomic.mock.calls[1]?.[0] as SaveLyricDocumentAtomicInput
    expect(resumedInput).toMatchObject({ documentId: 'document-1', expectedRevision: 5 })
    expect(resumedInput.document.title).toBe('Dependent edit')

    resumed.resolve(success(lyricDocument('document-1', 6, 'Dependent edit'), [cue()]))
    await dependentSave
    expect(useLyricsStore.getState().activeDocument?.revision).toBe(6)
  })

  it('does not let an older document write mark a newly selected dirty document as saved', async () => {
    useLyricsStore.getState().setActiveDocument(lyricDocument('document-a', 1, 'A'), [cue('cue-a')])
    const writeA = deferred<SaveLyricDocumentResult>()
    lyricDbMocks.saveLyricDocumentAtomic.mockReturnValue(writeA.promise)
    useLyricsStore.getState().setDraftTitle('A edited')
    const saveA = useLyricsStore.getState().saveActiveLyricDocument()

    useLyricsStore.getState().setActiveDocument(lyricDocument('document-b', 2, 'B'), [cue('cue-b')])
    useLyricsStore.getState().setDraftTitle('B edited')
    writeA.resolve(success(lyricDocument('document-a', 2, 'A edited'), [cue('cue-a')]))
    await saveA

    expect(useLyricsStore.getState()).toMatchObject({
      activeDocumentId: 'document-b',
      draftTitle: 'B edited',
      editorDirty: true,
      activeWriteStatus: 'unsaved',
    })
  })

  it('prevents a released component queue from committing stale UI state', async () => {
    prepareDraft()
    const write = deferred<SaveLyricDocumentResult>()
    lyricDbMocks.saveLyricDocumentAtomic.mockReturnValue(write.promise)
    const savePromise = useLyricsStore.getState().saveActiveLyricDocument()
    const originalLogicalId = useLyricsStore.getState().activeLogicalDocumentId

    useLyricsStore.getState().releaseOperationResources()
    write.resolve(success(lyricDocument('stale-document', 1), [cue()]))
    await savePromise

    expect(useLyricsStore.getState()).toMatchObject({
      activeDocumentId: null,
      activeLogicalDocumentId: originalLogicalId,
      isSaving: false,
      lastCanonicalWrite: null,
    })
  })

  it('clears user-scoped operation state and ignores a prior account response', async () => {
    prepareDraft()
    const write = deferred<SaveLyricDocumentResult>()
    lyricDbMocks.saveLyricDocumentAtomic.mockReturnValue(write.promise)
    const savePromise = useLyricsStore.getState().saveActiveLyricDocument()

    useLyricsStore.getState().setOperationAccount('user-2')
    write.resolve(success(lyricDocument('user-1-document', 1), [cue()]))
    await savePromise

    expect(useLyricsStore.getState()).toMatchObject({
      operationAccountId: 'user-2',
      isSaving: false,
      writeStates: {},
      lastCanonicalWrite: null,
    })
  })

  it('reconciles an uncertain first create by logical identity instead of creating a second document', async () => {
    prepareDraft()
    const canonical = lyricDocument('reconciled-document', 1)
    lyricDbMocks.saveLyricDocumentAtomic.mockResolvedValue({
      ok: false,
      kind: 'unexpected',
      message: 'The response was lost after commit.',
    })
    lyricDbMocks.getLyricDocumentByClientLogicalId.mockResolvedValue(canonical)
    lyricDbMocks.getLyricCuesForDocument.mockResolvedValue([cue('canonical-cue')])

    const result = await useLyricsStore.getState().saveActiveLyricDocument()

    expect(result).toMatchObject({ ok: true, document: { id: 'reconciled-document' } })
    expect(lyricDbMocks.saveLyricDocumentAtomic).toHaveBeenCalledTimes(1)
    const input = lyricDbMocks.saveLyricDocumentAtomic.mock.calls[0]?.[0] as SaveLyricDocumentAtomicInput
    expect(input.document.metadata).toMatchObject({
      _drmvyzLogicalDocumentId: expect.any(String),
      _drmvyzMutationId: expect.any(String),
    })
    expect(useLyricsStore.getState().activeDocumentId).toBe('reconciled-document')
  })

  it('keeps a newer canonical revision when an older selected-document read resolves last', async () => {
    const staleDocument = deferred<LyricDocument | null>()
    const staleCues = deferred<LyricCue[]>()
    const current = lyricDocument('document-1', 1, 'Original')
    useLyricsStore.getState().setActiveDocument(current, [cue()])
    lyricDbMocks.getLyricDocumentById.mockReturnValue(staleDocument.promise)
    lyricDbMocks.getLyricCuesForDocument.mockReturnValue(staleCues.promise)

    const readPromise = useLyricsStore.getState().loadLyricDocument(current.id)
    useLyricsStore.getState().setDraftTitle('Saved while reading')
    lyricDbMocks.saveLyricDocumentAtomic.mockResolvedValue(
      success(lyricDocument('document-1', 2, 'Saved while reading'), [cue('saved-cue')]),
    )
    await useLyricsStore.getState().saveActiveLyricDocument()

    staleDocument.resolve(current)
    staleCues.resolve([cue('stale-cue', 'Stale text')])
    await readPromise

    expect(useLyricsStore.getState().activeDocument).toMatchObject({
      id: 'document-1',
      revision: 2,
      title: 'Saved while reading',
    })
    expect(useLyricsStore.getState().cues[0]?.id).toBe('saved-cue')
  })

  it('serializes activation behind document writes and uses the latest returned revision', async () => {
    useLyricsStore.getState().setActiveDocument(lyricDocument('document-1', 1, 'Original'), [cue()])
    const save = deferred<SaveLyricDocumentResult>()
    lyricDbMocks.saveLyricDocumentAtomic.mockReturnValue(save.promise)
    lyricDbMocks.activateLyricDocument.mockResolvedValue({
      ok: true,
      kind: 'success',
      document: lyricDocument('document-1', 3, 'Edited'),
    })
    lyricDbMocks.getFullLyricDocument.mockResolvedValue({
      document: lyricDocument('document-1', 2, 'Edited'),
      cues: [cue()],
    })

    useLyricsStore.getState().setDraftTitle('Edited')
    const savePromise = useLyricsStore.getState().saveActiveLyricDocument()
    const activationPromise = useLyricsStore.getState().activateLyricDocument('document-1')

    expect(lyricDbMocks.activateLyricDocument).not.toHaveBeenCalled()
    save.resolve(success(lyricDocument('document-1', 2, 'Edited'), [cue()]))
    await savePromise
    await activationPromise

    expect(lyricDbMocks.activateLyricDocument).toHaveBeenCalledWith('document-1', 2)
    expect(useLyricsStore.getState().activeDocument?.revision).toBe(3)
  })

})
