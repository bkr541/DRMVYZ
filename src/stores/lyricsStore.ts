import { create } from 'zustand'
import { supabaseConfigured } from '../lib/supabase'
import {
  activateLyricDocument as activateLyricDocumentRpc,
  getFullLyricDocument,
  getLyricDocumentByClientLogicalId,
  getLyricDocumentById,
  getLyricCuesForDocument,
  getActiveLyricDocumentForAudioTrack,
  getActiveLyricDocumentForVisualSession,
  saveLyricDocumentAtomic,
} from '../lib/lyricsDb'
import {
  normalizeCue,
  normalizeCueBounds,
  shiftCue,
} from '../features/lyrics/editor/lyricCueEditorModel'
import type {
  LyricDocument,
  LyricCue,
  LyricWord,
  LyricStyle,
  LyricAnimation,
  LyricEffects,
  LyricDocumentSourceType,
  LyricDocumentSourceFormat,
  CreateLyricCueInput,
  CreateLyricDocumentInput,
  UpdateLyricDocumentInput,
  ActivateLyricDocumentResult,
  LyricPersistenceFailure,
  SaveLyricDocumentResult,
} from '../types/lyrics'
import { createLyricCueInputFromCue, toCanonicalLyricMs } from '../types/lyrics'
import { validateLyricCues } from '../features/lyrics/utils/lyricValidation'
import type { LyricRecoveryRecord } from '../lib/lyricDraftRecovery'

export type LyricWriteStatus = 'unsaved' | 'queued' | 'saving' | 'saved' | 'conflict' | 'failed'
export type RuntimeLyricsStatus =
  | 'idle'
  | 'unpersisted-track'
  | 'loading'
  | 'no-active-version'
  | 'active-version'
  | 'error'

export interface SaveEditorDocumentOptions {
  makeActive?: boolean
}

export interface LyricWriteState {
  logicalDocumentId: string
  canonicalDocumentId: string | null
  status: LyricWriteStatus
  pendingCount: number
  message: string | null
  failure: LyricPersistenceFailure | null
  updatedAt: number
}

export interface LyricCanonicalWrite {
  sequence: number
  created: boolean
  accountId: string | null
  logicalDocumentId: string
  document: LyricDocument
  cues: LyricCue[]
  editVersion: number
}

export interface LyricsState {
  /** Canonical global visualizer preference. `lyricsEnabled` is a temporary compatibility alias. */
  lyricsDisplayEnabled: boolean
  lyricsEnabled:       boolean
  /** Canonical editor selection. `activeDocument*` remain compatibility aliases during migration. */
  editorDocumentId:    string | null
  editorDocument:      LyricDocument | null
  activeDocumentId:    string | null
  activeDocument:      LyricDocument | null
  activeLogicalDocumentId: string
  activeEditVersion: number
  /** audio_tracks ID whose automatic lyric lookup currently owns the active lyric state. */
  activeAudioTrackId:   string | null
  cues:                LyricCue[]
  /** Runtime playback source, intentionally isolated from the document open in Lyric Manager. */
  runtimeAudioTrackId: string | null
  runtimeActiveDocumentId: string | null
  runtimeActiveDocument: LyricDocument | null
  runtimeCues: LyricCue[]
  runtimeGlobalOffsetMs: number
  runtimeLyricsStatus: RuntimeLyricsStatus
  isLoading:           boolean
  isSaving:            boolean
  activeWriteStatus:   LyricWriteStatus
  writeStates:         Record<string, LyricWriteState>
  operationAccountId:  string | null
  lastCanonicalWrite:  LyricCanonicalWrite | null
  error:               string | null
  lastPersistenceFailure: LyricPersistenceFailure | null

  draftTitle:            string
  draftArtist:           string
  draftDefaultStyle:     Partial<LyricStyle>
  draftDefaultAnimation: Partial<LyricAnimation>
  draftDefaultEffects:   Partial<LyricEffects>
  globalOffsetMs:        number

  draftSourceType:     LyricDocumentSourceType | null
  draftSourceFormat:   LyricDocumentSourceFormat | null
  draftRawSourceText:  string | null
  draftMetadata:       Record<string, unknown> | null

  selectedCueId:       string | null
  lyricTimingDirty:    boolean
  editorSessionActive: boolean
  editorDirty:         boolean
  draftActivateOnSave: boolean
  skipNextEditorResync: boolean
  cueHistoryPast: LyricCue[][]
  cueHistoryFuture: LyricCue[][]

  setLyricsDisplayEnabled(enabled: boolean): void
  setLyricsEnabled(enabled: boolean): void
  setEditorDocument(document: LyricDocument | null, cues?: LyricCue[], activeAudioTrackId?: string | null): void
  setActiveDocument(document: LyricDocument | null, cues?: LyricCue[], activeAudioTrackId?: string | null): void
  setCues(cues: LyricCue[]): void
  updateCue(cueId: string, patch: Partial<Omit<LyricCue, 'id'>>): void
  updateCueWord(cueId: string, wordId: string, patch: Partial<Omit<LyricWord, 'id'>>): void
  setGlobalOffsetMs(offsetMs: number): void
  updateDraftDefaultStyle(patch: Partial<LyricStyle>): void
  updateDraftDefaultAnimation(patch: Partial<LyricAnimation>): void
  updateDraftDefaultEffects(patch: Partial<LyricEffects>): void
  setDraftTitle(title: string): void
  setDraftArtist(artist: string): void
  setDraftSourceMeta(meta: {
    sourceType?:    LyricDocumentSourceType | null
    sourceFormat?:  LyricDocumentSourceFormat | null
    rawSourceText?: string | null
    metadata?:      Record<string, unknown> | null
  }): void
  setError(error: string | null): void
  setOperationAccount(accountId: string | null): void
  releaseOperationResources(): void
  abandonActiveLyricDraft(): void
  abandonLyricDocument(documentId: string): void
  beginEditorSession(): void
  endEditorSession(): void
  markEditorDirty(dirty?: boolean): void
  preserveDraftForNextEditorExit(): void
  clearLyrics(): void
  clearRuntimeLyrics(status?: RuntimeLyricsStatus, preserveEditor?: boolean): void

  selectCue(cueId: string | null): void
  updateCueTiming(cueId: string, patch: { startMs?: number; endMs?: number }): void
  moveCue(cueId: string, deltaMs: number): void
  setCueBounds(cueId: string, startMs: number, endMs: number): void
  deleteCue(cueId: string): void
  clearCues(): void
  addCue(cue: Omit<LyricCue, 'id'>): LyricCue
  undoCueEdit(): void
  redoCueEdit(): void
  resetCueHistory(): void

  loadLyricDocument(documentId: string): Promise<void>
  resolveRuntimeLyricsForAudioTrack(audioTrackId: string, force?: boolean, preserveEditor?: boolean): Promise<void>
  loadLyricsForAudioTrack(audioTrackId: string, force?: boolean): Promise<void>
  loadLyricsForVisualSession(visualSessionId: string): Promise<void>
  saveActiveLyricDocument(cues?: LyricCue[], options?: SaveEditorDocumentOptions): Promise<SaveLyricDocumentResult | null>
  replaceActiveCues(inputs: CreateLyricCueInput[]): Promise<SaveLyricDocumentResult | null>
  saveLyricDocumentMetadata(documentId: string, patch: UpdateLyricDocumentInput): Promise<SaveLyricDocumentResult | null>
  activateLyricDocument(documentId: string): Promise<ActivateLyricDocumentResult | null>
  saveTimingChanges(): Promise<SaveLyricDocumentResult | null>
  retryActiveLyricWrite(): Promise<SaveLyricDocumentResult | ActivateLyricDocumentResult | null>
  resolveActiveLyricConflict(document: LyricDocument, cues: LyricCue[]): void
  restoreRecoveredLyricDraft(recovery: LyricRecoveryRecord): void
}

type ReadKind = 'trackList' | 'trackDocuments' | 'selectedDocument' | 'audioTrack' | 'visualSession'
interface ReadOwner {
  generation: number
  accountId: string | null
  identity: string | null
}

const readOwners: Record<ReadKind, ReadOwner> = {
  trackList: { generation: 0, accountId: null, identity: null },
  trackDocuments: { generation: 0, accountId: null, identity: null },
  selectedDocument: { generation: 0, accountId: null, identity: null },
  audioTrack: { generation: 0, accountId: null, identity: null },
  visualSession: { generation: 0, accountId: null, identity: null },
}

function beginRead(kind: ReadKind, accountId: string | null, identity: string): ReadOwner {
  const owner = { generation: readOwners[kind].generation + 1, accountId, identity }
  readOwners[kind] = owner
  return owner
}

function invalidateRead(kind: ReadKind): void {
  readOwners[kind] = {
    generation: readOwners[kind].generation + 1,
    accountId: null,
    identity: null,
  }
}

function invalidateAllReads(): void {
  ;(Object.keys(readOwners) as ReadKind[]).forEach(invalidateRead)
}

function ownsRead(kind: ReadKind, owner: ReadOwner, accountId: string | null, identity: string): boolean {
  const current = readOwners[kind]
  return current.generation === owner.generation
    && current.accountId === accountId
    && current.identity === identity
}

const INTERNAL_LOGICAL_ID = '_drmvyzLogicalDocumentId'
const INTERNAL_MUTATION_ID = '_drmvyzMutationId'
let fallbackId = 0
let canonicalWriteSequence = 0

function uniqueId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}:${crypto.randomUUID()}`
  }
  fallbackId += 1
  return `${prefix}:${Date.now()}:${fallbackId}`
}

function logicalIdForDocument(document: LyricDocument | null, activeAudioTrackId?: string | null): string {
  if (document) return `document:${document.id}`
  if (activeAudioTrackId) return `draft:track:${activeAudioTrackId}`
  return uniqueId('draft')
}

function accountScope(state: Pick<LyricsState, 'operationAccountId' | 'editorDocument'>): string | null {
  return state.operationAccountId ?? state.editorDocument?.userId ?? null
}

function readAccountScope(state: Pick<LyricsState, 'operationAccountId'>): string | null {
  return state.operationAccountId
}

function documentInputFromCanonical(
  document: LyricDocument,
  patch: UpdateLyricDocumentInput = {},
): CreateLyricDocumentInput {
  return {
    title: patch.title ?? document.title,
    artist: patch.artist ?? document.artist,
    audioTrackId: patch.audioTrackId !== undefined ? patch.audioTrackId : document.audioTrackId,
    visualSessionId: patch.visualSessionId !== undefined ? patch.visualSessionId : document.visualSessionId,
    sourceType: patch.sourceType ?? document.sourceType,
    sourceFormat: patch.sourceFormat ?? document.sourceFormat,
    rawSourceText: patch.rawSourceText !== undefined ? patch.rawSourceText : document.rawSourceText,
    defaultStyle: patch.defaultStyle ?? document.defaultStyle,
    defaultAnimation: patch.defaultAnimation ?? document.defaultAnimation,
    defaultEffects: patch.defaultEffects ?? document.defaultEffects,
    globalOffsetMs: patch.globalOffsetMs ?? document.globalOffsetMs,
    metadata: patch.metadata ?? document.metadata,
  }
}

function editorDocumentState(
  document: LyricDocument | null,
  cues: LyricCue[] = [],
  activeAudioTrackId: string | null = document?.audioTrackId ?? null,
  selectedCueId: string | null = null,
  logicalDocumentId = logicalIdForDocument(document, activeAudioTrackId),
): Partial<LyricsState> {
  return {
    editorDocument:        document,
    editorDocumentId:      document?.id ?? null,
    activeDocument:        document,
    activeDocumentId:      document?.id ?? null,
    activeLogicalDocumentId: logicalDocumentId,
    activeEditVersion:     0,
    activeAudioTrackId,
    cues,
    draftTitle:            document?.title            ?? '',
    draftArtist:           document?.artist           ?? '',
    draftDefaultStyle:     document?.defaultStyle     ?? {},
    draftDefaultAnimation: document?.defaultAnimation ?? {},
    draftDefaultEffects:   document?.defaultEffects   ?? {},
    globalOffsetMs:        toCanonicalLyricMs(document?.globalOffsetMs ?? 0),
    draftSourceType:       null,
    draftSourceFormat:     null,
    draftRawSourceText:    null,
    draftMetadata:         null,
    error:                 null,
    lastPersistenceFailure: null,
    lyricTimingDirty:      false,
    editorDirty:           false,
    draftActivateOnSave:   document?.isActive ?? false,
    selectedCueId:         selectedCueId && cues.some(cue => cue.id === selectedCueId) ? selectedCueId : null,
    cueHistoryPast:        [],
    cueHistoryFuture:      [],
  }
}

function runtimeLyricsState(
  audioTrackId: string | null,
  document: LyricDocument | null = null,
  cues: LyricCue[] = [],
  status: RuntimeLyricsStatus = audioTrackId ? (document ? 'active-version' : 'no-active-version') : 'idle',
): Partial<LyricsState> {
  return {
    runtimeAudioTrackId: audioTrackId,
    runtimeActiveDocumentId: document?.id ?? null,
    runtimeActiveDocument: document,
    runtimeCues: cues,
    runtimeGlobalOffsetMs: toCanonicalLyricMs(document?.globalOffsetMs ?? 0),
    runtimeLyricsStatus: status,
  }
}

const MAX_CUE_HISTORY = 50

function cueCollectionsEqual(left: LyricCue[], right: LyricCue[]): boolean {
  if (left === right) return true
  if (left.length !== right.length) return false
  return JSON.stringify(left) === JSON.stringify(right)
}

function nextUnsavedState(state: LyricsState): Pick<LyricsState, 'activeEditVersion' | 'editorDirty' | 'writeStates' | 'activeWriteStatus'> {
  const logicalDocumentId = state.activeLogicalDocumentId
  const existing = state.writeStates[logicalDocumentId]
  const activeQueueBusy = existing?.status === 'queued' || existing?.status === 'saving'
  const status: LyricWriteStatus = activeQueueBusy ? existing.status : 'unsaved'
  const writeState: LyricWriteState = {
    logicalDocumentId,
    canonicalDocumentId: state.editorDocumentId,
    status,
    pendingCount: existing?.pendingCount ?? 0,
    message: existing?.status === 'conflict' ? existing.message : null,
    failure: existing?.status === 'conflict' ? existing.failure : null,
    updatedAt: Date.now(),
  }
  return {
    activeEditVersion: state.activeEditVersion + 1,
    editorDirty: state.editorSessionActive ? true : state.editorDirty,
    writeStates: { ...state.writeStates, [logicalDocumentId]: writeState },
    activeWriteStatus: status,
  }
}

function commitCueCollection(
  state: LyricsState,
  cues: LyricCue[],
  selectedCueId: string | null = state.selectedCueId,
): Partial<LyricsState> {
  if (cueCollectionsEqual(state.cues, cues)) return {}
  return {
    cues,
    selectedCueId: selectedCueId && cues.some(cue => cue.id === selectedCueId) ? selectedCueId : null,
    cueHistoryPast: [...state.cueHistoryPast, state.cues].slice(-MAX_CUE_HISTORY),
    cueHistoryFuture: [],
    lyricTimingDirty: true,
    ...nextUnsavedState(state),
  }
}

function buildDocumentInput(state: LyricsState): CreateLyricDocumentInput {
  const current = state.editorDocument
  const importedSource = state.draftSourceType !== null
  return {
    title: state.draftTitle,
    artist: state.draftArtist,
    audioTrackId: current ? (current.audioTrackId ?? null) : state.activeAudioTrackId,
    visualSessionId: current ? (current.visualSessionId ?? null) : null,
    sourceType: state.draftSourceType ?? current?.sourceType ?? 'manual',
    sourceFormat: state.draftSourceFormat ?? current?.sourceFormat ?? 'json',
    rawSourceText: importedSource ? state.draftRawSourceText : current?.rawSourceText ?? null,
    defaultStyle: state.draftDefaultStyle,
    defaultAnimation: state.draftDefaultAnimation,
    defaultEffects: state.draftDefaultEffects,
    globalOffsetMs: toCanonicalLyricMs(state.globalOffsetMs),
    metadata: importedSource ? state.draftMetadata ?? {} : current?.metadata ?? {},
  }
}

function cueInputs(cues: LyricCue[], documentId: string): CreateLyricCueInput[] {
  return cues.map((cue, index) => createLyricCueInputFromCue(cue, documentId, index))
}

type AnyWriteResult = SaveLyricDocumentResult | ActivateLyricDocumentResult

type AtomicJob = {
  kind: 'atomic'
  id: string
  logicalDocumentId: string
  accountId: string | null
  editVersion: number
  selectedCueId: string | null
  document: CreateLyricDocumentInput
  cues: LyricCue[]
  activate: boolean
  resolve: (result: AnyWriteResult | null) => void
}

type MetadataJob = {
  kind: 'metadata'
  id: string
  logicalDocumentId: string
  accountId: string | null
  editVersion: number
  selectedCueId: string | null
  documentId: string
  patch: UpdateLyricDocumentInput
  resolve: (result: AnyWriteResult | null) => void
}

type ActivateJob = {
  kind: 'activate'
  id: string
  logicalDocumentId: string
  accountId: string | null
  editVersion: number
  selectedCueId: string | null
  selectionLogicalDocumentId: string
  documentId: string
  resolve: (result: AnyWriteResult | null) => void
}

type WriteJob = AtomicJob | MetadataJob | ActivateJob

interface DocumentWriteQueue {
  logicalDocumentId: string
  accountId: string | null
  canonicalDocumentId: string | null
  revision: number | null
  canonicalDocument: LyricDocument | null
  canonicalCues: LyricCue[]
  jobs: WriteJob[]
  running: boolean
  blocked: 'conflict' | 'failed' | null
  failedJob: WriteJob | null
  disposed: boolean
}

const writeQueues = new Map<string, DocumentWriteQueue>()
const abandonedLogicalDocuments = new Set<string>()
const abandonedCanonicalDocuments = new Set<string>()

function queueKey(accountId: string | null, logicalDocumentId: string): string {
  return `${accountId ?? 'session'}::${logicalDocumentId}`
}

function ensureQueue(
  state: LyricsState,
  logicalDocumentId: string,
  canonicalDocument?: LyricDocument | null,
  cues?: LyricCue[],
): DocumentWriteQueue {
  const accountId = accountScope(state)
  const key = queueKey(accountId, logicalDocumentId)
  let queue = writeQueues.get(key)
  if (queue?.disposed) {
    if (writeQueues.get(key) === queue) writeQueues.delete(key)
    queue = undefined
  }
  if (!queue) {
    queue = {
      logicalDocumentId,
      accountId,
      canonicalDocumentId: canonicalDocument?.id ?? null,
      revision: canonicalDocument?.revision ?? null,
      canonicalDocument: canonicalDocument ?? null,
      canonicalCues: cues ? [...cues] : [],
      jobs: [],
      running: false,
      blocked: null,
      failedJob: null,
      disposed: false,
    }
    writeQueues.set(key, queue)
  } else if (canonicalDocument && (queue.revision == null || canonicalDocument.revision >= queue.revision)) {
    queue.canonicalDocumentId = canonicalDocument.id
    queue.revision = canonicalDocument.revision
    queue.canonicalDocument = canonicalDocument
    if (cues) queue.canonicalCues = [...cues]
  }
  return queue
}

function canonicalSnapshotForRead(
  queue: DocumentWriteQueue,
  document: LyricDocument | null,
  cues: LyricCue[],
): { document: LyricDocument | null; cues: LyricCue[] } {
  if (document
    && queue.canonicalDocument?.id === document.id
    && queue.revision != null
    && queue.revision > document.revision) {
    return { document: queue.canonicalDocument, cues: [...queue.canonicalCues] }
  }
  return { document, cues }
}

function writeStateForQueue(queue: DocumentWriteQueue, status: LyricWriteStatus, failure: LyricPersistenceFailure | null = null): LyricWriteState {
  return {
    logicalDocumentId: queue.logicalDocumentId,
    canonicalDocumentId: queue.canonicalDocumentId,
    status,
    pendingCount: queue.jobs.length + (queue.running ? 1 : 0),
    message: failure?.message ?? null,
    failure,
    updatedAt: Date.now(),
  }
}

function updateQueueUi(
  set: (partial: Partial<LyricsState> | ((state: LyricsState) => Partial<LyricsState>)) => void,
  get: () => LyricsState,
  queue: DocumentWriteQueue,
  status: LyricWriteStatus,
  failure: LyricPersistenceFailure | null = null,
): void {
  set(state => {
    const next = writeStateForQueue(queue, status, failure)
    if (state.activeLogicalDocumentId !== queue.logicalDocumentId || accountScope(state) !== queue.accountId) {
      return { writeStates: { ...state.writeStates, [queue.logicalDocumentId]: next } }
    }
    return {
      writeStates: { ...state.writeStates, [queue.logicalDocumentId]: next },
      activeWriteStatus: status,
      isSaving: status === 'queued' || status === 'saving',
      ...(failure ? { error: failure.message, lastPersistenceFailure: failure } : {}),
    }
  })
  void get
}

function withInternalMutationMetadata(
  document: CreateLyricDocumentInput,
  logicalDocumentId: string,
  mutationId: string,
): CreateLyricDocumentInput {
  return {
    ...document,
    metadata: {
      ...(document.metadata ?? {}),
      [INTERNAL_LOGICAL_ID]: logicalDocumentId,
      [INTERNAL_MUTATION_ID]: mutationId,
    },
  }
}

async function reconcileUnknownDraftCreate(logicalDocumentId: string): Promise<SaveLyricDocumentResult | null> {
  try {
    const document = await getLyricDocumentByClientLogicalId(logicalDocumentId)
    if (!document) return null
    const cues = await getLyricCuesForDocument(document.id)
    return { ok: true, kind: 'success', document, cues }
  } catch {
    return null
  }
}

async function executeWriteJob(queue: DocumentWriteQueue, job: WriteJob): Promise<AnyWriteResult> {
  if (job.kind === 'activate') {
    const documentId = queue.canonicalDocumentId ?? job.documentId
    const full = await getFullLyricDocument(documentId)
    queue.canonicalDocumentId = full.document.id
    queue.revision = full.document.revision
    queue.canonicalDocument = full.document
    queue.canonicalCues = full.cues

    const validation = validateLyricCues(full.cues)
    if (validation.errors.length > 0) {
      return {
        ok: false,
        kind: 'validation',
        code: validation.issues.find(issue => issue.severity === 'error')?.code,
        message: `Fix lyric validation before activation (${validation.errors.length} error${validation.errors.length === 1 ? '' : 's'}). ${validation.errors[0]}`,
      }
    }
    return activateLyricDocumentRpc(documentId, queue.revision)
  }

  if (job.kind === 'metadata') {
    if (!queue.canonicalDocument || queue.canonicalDocument.id !== job.documentId) {
      const full = await getFullLyricDocument(job.documentId)
      queue.canonicalDocumentId = full.document.id
      queue.revision = full.document.revision
      queue.canonicalDocument = full.document
      queue.canonicalCues = full.cues
    }
    const current = queue.canonicalDocument
    if (!current) {
      return { ok: false, kind: 'unexpected', message: 'The lyric document is unavailable for metadata saving.' }
    }
    return saveLyricDocumentAtomic({
      documentId: current.id,
      expectedRevision: queue.revision,
      document: withInternalMutationMetadata(
        documentInputFromCanonical(current, job.patch),
        queue.logicalDocumentId,
        job.id,
      ),
      cues: cueInputs(queue.canonicalCues, current.id),
      activate: job.patch.isActive ?? current.isActive,
    })
  }

  const validation = validateLyricCues(job.cues)
  const blockingErrors = validation.issues.filter(issue => (
    issue.severity === 'error'
    && !(issue.code === 'empty_document' && job.activate === false)
  ))
  if (blockingErrors.length > 0) {
    return {
      ok: false,
      kind: 'validation',
      code: blockingErrors[0].code,
      message: `Fix lyric validation before ${job.activate ? 'saving and activation' : 'saving'} (${blockingErrors.length} error${blockingErrors.length === 1 ? '' : 's'}). ${blockingErrors[0].message}`,
    }
  }

  const documentId = queue.canonicalDocumentId
  const result = await saveLyricDocumentAtomic({
    documentId,
    expectedRevision: documentId ? queue.revision : null,
    document: withInternalMutationMetadata(job.document, queue.logicalDocumentId, job.id),
    cues: cueInputs(job.cues, documentId ?? ''),
    activate: job.activate,
  })
  if (!result.ok && !documentId) {
    const reconciled = await reconcileUnknownDraftCreate(queue.logicalDocumentId)
    if (reconciled) return reconciled
  }
  return result
}

function commitCanonicalResult(
  set: (partial: Partial<LyricsState> | ((state: LyricsState) => Partial<LyricsState>)) => void,
  get: () => LyricsState,
  queue: DocumentWriteQueue,
  job: WriteJob,
  result: AnyWriteResult,
): void {
  if (!result.ok) return
  const created = queue.canonicalDocumentId === null
  queue.canonicalDocumentId = result.document.id
  queue.revision = result.document.revision
  queue.canonicalDocument = result.document
  if ('cues' in result) queue.canonicalCues = [...result.cues]

  const commit: LyricCanonicalWrite = {
    sequence: ++canonicalWriteSequence,
    created,
    accountId: queue.accountId,
    logicalDocumentId: queue.logicalDocumentId,
    document: result.document,
    cues: [...queue.canonicalCues],
    editVersion: job.editVersion,
  }

  set(state => {
    const sameAccount = accountScope(state) === queue.accountId
    const sameLogicalDocument = state.activeLogicalDocumentId === queue.logicalDocumentId
    const activationOwnsSelection = job.kind === 'activate'
      && state.activeLogicalDocumentId === job.selectionLogicalDocumentId
    const abandoned = abandonedLogicalDocuments.has(queue.logicalDocumentId)
      || abandonedCanonicalDocuments.has(result.document.id)
    const hasNewerLocalEdits = sameLogicalDocument && state.activeEditVersion > job.editVersion
    const remaining = queue.jobs.length
    const status: LyricWriteStatus = remaining > 0 ? 'queued' : hasNewerLocalEdits ? 'unsaved' : 'saved'
    const queueState: LyricWriteState = {
      ...writeStateForQueue(queue, status),
      canonicalDocumentId: result.document.id,
      pendingCount: remaining,
    }

    const updatesRuntime = result.document.isActive
      && result.document.audioTrackId !== null
      && state.runtimeAudioTrackId === result.document.audioTrackId
    const base: Partial<LyricsState> = {
      writeStates: { ...state.writeStates, [queue.logicalDocumentId]: queueState },
      lastCanonicalWrite: abandoned ? state.lastCanonicalWrite : commit,
      ...(updatesRuntime
        ? runtimeLyricsState(
            result.document.audioTrackId ?? null,
            result.document,
            queue.canonicalCues,
            'active-version',
          )
        : {}),
    }
    if (!sameAccount || abandoned) return base

    if (activationOwnsSelection) {
      return {
        ...base,
        ...editorDocumentState(
          result.document,
          queue.canonicalCues,
          result.document.audioTrackId ?? null,
          job.selectedCueId,
          queue.logicalDocumentId,
        ),
        activeWriteStatus: status,
        isSaving: remaining > 0,
        writeStates: { ...state.writeStates, [queue.logicalDocumentId]: queueState },
        lastCanonicalWrite: commit,
      }
    }

    if (!sameLogicalDocument) return base

    if ('cues' in result && !hasNewerLocalEdits) {
      return {
        ...base,
        ...editorDocumentState(
          result.document,
          result.cues,
          result.document.audioTrackId ?? null,
          job.selectedCueId,
          queue.logicalDocumentId,
        ),
        activeWriteStatus: status,
        isSaving: remaining > 0,
        writeStates: { ...state.writeStates, [queue.logicalDocumentId]: queueState },
        lastCanonicalWrite: commit,
      }
    }

    return {
      ...base,
      editorDocument: result.document,
      editorDocumentId: result.document.id,
      activeDocument: result.document,
      activeDocumentId: result.document.id,
      activeAudioTrackId: result.document.audioTrackId ?? state.activeAudioTrackId,
      activeWriteStatus: status,
      isSaving: remaining > 0,
      error: null,
      lastPersistenceFailure: null,
      editorDirty: hasNewerLocalEdits ? state.editorDirty : false,
      lyricTimingDirty: hasNewerLocalEdits ? state.lyricTimingDirty : false,
    }
  })
}

async function drainQueue(
  set: (partial: Partial<LyricsState> | ((state: LyricsState) => Partial<LyricsState>)) => void,
  get: () => LyricsState,
  queue: DocumentWriteQueue,
): Promise<void> {
  if (queue.running || queue.disposed || queue.blocked) return
  queue.running = true
  try {
    while (!queue.disposed && !queue.blocked && queue.jobs.length > 0) {
      const job = queue.jobs.shift()!
      updateQueueUi(set, get, queue, 'saving')
      let result: AnyWriteResult
      try {
        result = await executeWriteJob(queue, job)
      } catch (error) {
        result = {
          ok: false,
          kind: 'unexpected',
          message: error instanceof Error ? error.message : 'Unexpected lyric write failure.',
        }
      }

      if (queue.disposed || abandonedLogicalDocuments.has(queue.logicalDocumentId)) {
        job.resolve(result)
        continue
      }

      if (!result.ok) {
        queue.blocked = result.kind === 'conflict' ? 'conflict' : 'failed'
        queue.failedJob = job
        updateQueueUi(set, get, queue, queue.blocked, result)
        job.resolve(result)
        break
      }

      queue.failedJob = null
      commitCanonicalResult(set, get, queue, job, result)
      job.resolve(result)
    }
  } finally {
    queue.running = false
    if (queue.disposed) {
      const key = queueKey(queue.accountId, queue.logicalDocumentId)
      if (writeQueues.get(key) === queue) writeQueues.delete(key)
    } else if (!queue.blocked && queue.jobs.length === 0) {
      const state = get()
      const active = state.activeLogicalDocumentId === queue.logicalDocumentId && accountScope(state) === queue.accountId
      if (active) {
        const currentWriteState = state.writeStates[queue.logicalDocumentId]
        set({
          isSaving: false,
          activeWriteStatus: currentWriteState?.status ?? 'saved',
        })
      }
    } else if (!queue.blocked && queue.jobs.length > 0) {
      void drainQueue(set, get, queue)
    }
  }
}

function enqueueWrite(
  set: (partial: Partial<LyricsState> | ((state: LyricsState) => Partial<LyricsState>)) => void,
  get: () => LyricsState,
  queue: DocumentWriteQueue,
  job: WriteJob,
): Promise<AnyWriteResult | null> {
  if (queue.disposed || abandonedLogicalDocuments.has(queue.logicalDocumentId)) {
    job.resolve(null)
    return Promise.resolve(null)
  }
  if (queue.blocked === 'conflict') {
    const failure = get().writeStates[queue.logicalDocumentId]?.failure ?? null
    job.resolve(failure)
    return Promise.resolve(failure)
  }
  if (queue.blocked === 'failed') {
    // A new explicit save after a failure is recovery. Supersede held snapshots with
    // the caller's latest snapshot, while keeping the failed attempt visible until queued.
    for (const held of queue.jobs.splice(0)) held.resolve(null)
    queue.blocked = null
    queue.failedJob = null
  }
  queue.jobs.push(job)
  updateQueueUi(set, get, queue, queue.running ? 'saving' : 'queued')
  void drainQueue(set, get, queue)
  return new Promise(resolve => {
    const original = job.resolve
    job.resolve = result => {
      original(result)
      resolve(result)
    }
  })
}

function disposeQueue(queue: DocumentWriteQueue): void {
  queue.disposed = true
  for (const job of queue.jobs.splice(0)) job.resolve(null)
  if (!queue.running) {
    const key = queueKey(queue.accountId, queue.logicalDocumentId)
    if (writeQueues.get(key) === queue) writeQueues.delete(key)
  }
}

function disposeAllQueues(): void {
  for (const queue of writeQueues.values()) disposeQueue(queue)
  writeQueues.clear()
}

const initialLogicalDocumentId = uniqueId('draft')

export const useLyricsStore = create<LyricsState>((set, get) => ({
  lyricsDisplayEnabled: false,
  lyricsEnabled:       false,
  editorDocumentId:    null,
  editorDocument:      null,
  activeDocumentId:    null,
  activeDocument:      null,
  activeLogicalDocumentId: initialLogicalDocumentId,
  activeEditVersion:   0,
  activeAudioTrackId:   null,
  cues:                [],
  runtimeAudioTrackId: null,
  runtimeActiveDocumentId: null,
  runtimeActiveDocument: null,
  runtimeCues: [],
  runtimeGlobalOffsetMs: 0,
  runtimeLyricsStatus: 'idle',
  isLoading:           false,
  isSaving:            false,
  activeWriteStatus:   'saved',
  writeStates:         {},
  operationAccountId:  null,
  lastCanonicalWrite:  null,
  error:               null,
  lastPersistenceFailure: null,

  draftTitle:            '',
  draftArtist:           '',
  draftDefaultStyle:     {},
  draftDefaultAnimation: {},
  draftDefaultEffects:   {},
  globalOffsetMs:        0,

  draftSourceType:     null,
  draftSourceFormat:   null,
  draftRawSourceText:  null,
  draftMetadata:       null,

  selectedCueId:       null,
  lyricTimingDirty:    false,
  editorSessionActive: false,
  editorDirty:         false,
  draftActivateOnSave: false,
  skipNextEditorResync: false,
  cueHistoryPast:      [],
  cueHistoryFuture:    [],

  setLyricsDisplayEnabled: (enabled) => set({ lyricsDisplayEnabled: enabled, lyricsEnabled: enabled }),
  setLyricsEnabled: (enabled) => set({ lyricsDisplayEnabled: enabled, lyricsEnabled: enabled }),

  setEditorDocument: (document, cues = [], activeAudioTrackId) => {
    invalidateRead('selectedDocument')
    invalidateRead('audioTrack')
    invalidateRead('visualSession')
    const logicalDocumentId = logicalIdForDocument(document, activeAudioTrackId)
    abandonedLogicalDocuments.delete(logicalDocumentId)
    if (document) abandonedCanonicalDocuments.delete(document.id)
    const queue = ensureQueue(get(), logicalDocumentId, document, cues)
    const snapshot = canonicalSnapshotForRead(queue, document, cues)
    const queueState = get().writeStates[logicalDocumentId]
    set({
      ...editorDocumentState(
        snapshot.document,
        snapshot.cues,
        activeAudioTrackId !== undefined ? activeAudioTrackId : (snapshot.document?.audioTrackId ?? null),
        null,
        logicalDocumentId,
      ),
      isLoading: false,
      isSaving: queue.running || queue.jobs.length > 0,
      activeWriteStatus: queueState?.status ?? 'saved',
    })
  },

  setActiveDocument: (document, cues = [], activeAudioTrackId) => {
    get().setEditorDocument(document, cues, activeAudioTrackId)
  },

  setCues: (cues) => set(state => commitCueCollection(state, cues)),
  updateCue: (cueId, patch) => set(state => {
    const cue = state.cues.find(item => item.id === cueId)
    if (!cue) return {}
    const nextCue = normalizeCue({ ...cue, ...patch, id: cue.id })
    return commitCueCollection(state, state.cues.map(item => item.id === cueId ? nextCue : item), cueId)
  }),
  updateCueWord: (cueId, wordId, patch) => set(state => {
    const cue = state.cues.find(item => item.id === cueId)
    const words = cue?.words
    if (!cue || !words) return {}
    const wordIndex = words.findIndex(word => word.id === wordId)
    if (wordIndex < 0) return {}
    const currentWord = words[wordIndex]
    const nextWord: LyricWord = { ...currentWord, ...patch, id: currentWord.id }
    const nextWords = words.map((word, index) => index === wordIndex ? nextWord : word)
    const nextCue = normalizeCue({ ...cue, words: nextWords, id: cue.id })
    return commitCueCollection(state, state.cues.map(item => item.id === cueId ? nextCue : item), cueId)
  }),
  setGlobalOffsetMs: (offsetMs) => set(state => ({ globalOffsetMs: toCanonicalLyricMs(offsetMs), ...nextUnsavedState(state) })),
  setDraftTitle: (title) => set(state => ({ draftTitle: title, ...nextUnsavedState(state) })),
  setDraftArtist: (artist) => set(state => ({ draftArtist: artist, ...nextUnsavedState(state) })),

  setDraftSourceMeta: (meta) => set(state => ({
    draftSourceType:     meta.sourceType    !== undefined ? meta.sourceType    : null,
    draftSourceFormat:   meta.sourceFormat  !== undefined ? meta.sourceFormat  : null,
    draftRawSourceText:  meta.rawSourceText !== undefined ? meta.rawSourceText : null,
    draftMetadata:       meta.metadata      !== undefined ? meta.metadata      : null,
    ...nextUnsavedState(state),
  })),

  setError: (error) => set({ error }),
  setOperationAccount: (accountId) => {
    const current = get().operationAccountId
    if (current === accountId) return
    invalidateAllReads()
    disposeAllQueues()
    abandonedLogicalDocuments.clear()
    abandonedCanonicalDocuments.clear()
    const state = get()
    const clearLoadedState = current !== null
      || accountId === null
      || (state.editorDocument !== null && state.editorDocument.userId !== accountId)
    set({
      ...(clearLoadedState ? editorDocumentState(null, [], null, null, uniqueId('draft')) : {}),
      ...(clearLoadedState ? runtimeLyricsState(null) : {}),
      operationAccountId: accountId,
      writeStates: {},
      isLoading: false,
      isSaving: false,
      activeWriteStatus: clearLoadedState ? 'saved' : state.editorDirty ? 'unsaved' : 'saved',
      lastPersistenceFailure: null,
      lastCanonicalWrite: null,
    })
  },
  releaseOperationResources: () => {
    invalidateAllReads()
    disposeAllQueues()
    set(state => {
      const failure = state.lastPersistenceFailure
      const status: LyricWriteStatus = failure?.kind === 'conflict'
        ? 'conflict'
        : failure
          ? 'failed'
          : state.editorDirty
            ? 'unsaved'
            : 'saved'
      const writeState = status === 'saved'
        ? {}
        : {
            [state.activeLogicalDocumentId]: {
              logicalDocumentId: state.activeLogicalDocumentId,
              canonicalDocumentId: state.editorDocumentId,
              status,
              pendingCount: 0,
              message: failure?.message ?? null,
              failure,
              updatedAt: Date.now(),
            } satisfies LyricWriteState,
          }
      return {
        isLoading: false,
        isSaving: false,
        activeWriteStatus: status,
        writeStates: writeState,
      }
    })
  },
  abandonActiveLyricDraft: () => {
    const state = get()
    const logicalId = state.activeLogicalDocumentId
    abandonedLogicalDocuments.add(logicalId)
    if (state.editorDocumentId) abandonedCanonicalDocuments.add(state.editorDocumentId)
    const queue = writeQueues.get(queueKey(accountScope(state), logicalId))
    if (queue) disposeQueue(queue)
    set(current => {
      const nextWriteStates = { ...current.writeStates }
      delete nextWriteStates[logicalId]
      return {
        writeStates: nextWriteStates,
        isSaving: false,
        activeWriteStatus: 'saved',
        editorDirty: false,
        lyricTimingDirty: false,
      }
    })
  },
  abandonLyricDocument: (documentId) => {
    abandonedCanonicalDocuments.add(documentId)
    for (const queue of writeQueues.values()) {
      if (queue.canonicalDocumentId === documentId || queue.logicalDocumentId === `document:${documentId}`) {
        abandonedLogicalDocuments.add(queue.logicalDocumentId)
        disposeQueue(queue)
      }
    }
  },
  beginEditorSession: () => set({ editorSessionActive: true, skipNextEditorResync: false }),
  endEditorSession: () => set({ editorSessionActive: false }),
  markEditorDirty: (dirty = true) => set(state => ({
    editorDirty: dirty,
    ...(dirty ? nextUnsavedState({ ...state, editorSessionActive: true }) : {}),
  })),
  preserveDraftForNextEditorExit: () => set({ skipNextEditorResync: true }),

  updateDraftDefaultStyle: (patch) => set(state => ({
    draftDefaultStyle: { ...state.draftDefaultStyle, ...patch },
    ...nextUnsavedState(state),
  })),
  updateDraftDefaultAnimation: (patch) => set(state => ({
    draftDefaultAnimation: { ...state.draftDefaultAnimation, ...patch },
    ...nextUnsavedState(state),
  })),
  updateDraftDefaultEffects: (patch) => set(state => ({
    draftDefaultEffects: { ...state.draftDefaultEffects, ...patch },
    ...nextUnsavedState(state),
  })),

  clearLyrics: () => {
    invalidateAllReads()
    disposeAllQueues()
    abandonedLogicalDocuments.clear()
    abandonedCanonicalDocuments.clear()
    const logicalDocumentId = uniqueId('draft')
    set({
      lyricsDisplayEnabled: false,
      lyricsEnabled: false,
      editorDocumentId: null,
      editorDocument: null,
      activeDocumentId: null,
      activeDocument: null,
      activeLogicalDocumentId: logicalDocumentId,
      activeEditVersion: 0,
      activeAudioTrackId: null,
      cues: [],
      ...runtimeLyricsState(null),
      isLoading: false,
      isSaving: false,
      activeWriteStatus: 'saved',
      writeStates: {},
      lastCanonicalWrite: null,
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
      error: null,
      lastPersistenceFailure: null,
      selectedCueId: null,
      lyricTimingDirty: false,
      editorDirty: false,
      draftActivateOnSave: false,
      skipNextEditorResync: false,
      cueHistoryPast: [],
      cueHistoryFuture: [],
    })
  },

  clearRuntimeLyrics: (status = 'idle', preserveEditor = false) => {
    invalidateRead('audioTrack')
    set(state => ({
      ...runtimeLyricsState(null, null, [], status),
      ...(!preserveEditor && !state.editorSessionActive && !state.editorDirty
        ? editorDocumentState(null, [], null, null, uniqueId('draft'))
        : {}),
      isLoading: false,
    }))
  },

  selectCue: (cueId) => set({ selectedCueId: cueId }),
  updateCueTiming: (cueId, patch) => set(state => {
    const idx = state.cues.findIndex(cue => cue.id === cueId)
    if (idx === -1) return {}
    const cue = state.cues[idx]
    const bounds = normalizeCueBounds(patch.startMs ?? cue.startMs, patch.endMs ?? cue.endMs)
    const next = [...state.cues]
    next[idx] = { ...cue, ...bounds }
    return commitCueCollection(state, next, cueId)
  }),
  moveCue: (cueId, deltaMs) => set(state => {
    const idx = state.cues.findIndex(cue => cue.id === cueId)
    if (idx === -1) return {}
    const next = [...state.cues]
    next[idx] = { ...state.cues[idx], ...shiftCue(state.cues[idx], deltaMs) }
    return commitCueCollection(state, next, cueId)
  }),
  setCueBounds: (cueId, startMs, endMs) => set(state => {
    const idx = state.cues.findIndex(cue => cue.id === cueId)
    if (idx === -1) return {}
    const next = [...state.cues]
    next[idx] = { ...state.cues[idx], ...normalizeCueBounds(startMs, endMs) }
    return commitCueCollection(state, next, cueId)
  }),
  deleteCue: (cueId) => set(state => commitCueCollection(
    state,
    state.cues.filter(cue => cue.id !== cueId),
    state.selectedCueId === cueId ? null : state.selectedCueId,
  )),
  clearCues: () => set(state => commitCueCollection(state, [], null)),
  addCue: (cue) => {
    const id = uniqueId('cue')
    const newCue = normalizeCue({ ...cue, id, source: cue.source ?? 'manual' })
    set(state => commitCueCollection(state, [...state.cues, newCue], id))
    return newCue
  },
  undoCueEdit: () => set(state => {
    const previous = state.cueHistoryPast[state.cueHistoryPast.length - 1]
    if (!previous) return {}
    return {
      cues: previous,
      selectedCueId: state.selectedCueId && previous.some(cue => cue.id === state.selectedCueId) ? state.selectedCueId : null,
      cueHistoryPast: state.cueHistoryPast.slice(0, -1),
      cueHistoryFuture: [state.cues, ...state.cueHistoryFuture].slice(0, MAX_CUE_HISTORY),
      lyricTimingDirty: true,
      ...nextUnsavedState(state),
    }
  }),
  redoCueEdit: () => set(state => {
    const next = state.cueHistoryFuture[0]
    if (!next) return {}
    return {
      cues: next,
      selectedCueId: state.selectedCueId && next.some(cue => cue.id === state.selectedCueId) ? state.selectedCueId : null,
      cueHistoryPast: [...state.cueHistoryPast, state.cues].slice(-MAX_CUE_HISTORY),
      cueHistoryFuture: state.cueHistoryFuture.slice(1),
      lyricTimingDirty: true,
      ...nextUnsavedState(state),
    }
  }),
  resetCueHistory: () => set({ cueHistoryPast: [], cueHistoryFuture: [] }),

  loadLyricDocument: async (documentId) => {
    if (!supabaseConfigured) return
    const accountId = readAccountScope(get())
    const owner = beginRead('selectedDocument', accountId, documentId)
    set({ isLoading: true, error: null })
    try {
      const [document, cues] = await Promise.all([
        getLyricDocumentById(documentId),
        getLyricCuesForDocument(documentId),
      ])
      const state = get()
      if (!ownsRead('selectedDocument', owner, readAccountScope(state), documentId)) return
      if (state.editorDirty) return
      const logicalDocumentId = `document:${documentId}`
      abandonedLogicalDocuments.delete(logicalDocumentId)
      abandonedCanonicalDocuments.delete(documentId)
      const queue = ensureQueue(state, logicalDocumentId, document, cues)
      const snapshot = canonicalSnapshotForRead(queue, document, cues)
      set({
        ...editorDocumentState(snapshot.document, snapshot.cues, snapshot.document?.audioTrackId ?? null, null, logicalDocumentId),
        isLoading: false,
        activeWriteStatus: state.writeStates[logicalDocumentId]?.status ?? 'saved',
      })
    } catch (error) {
      const state = get()
      if (!ownsRead('selectedDocument', owner, readAccountScope(state), documentId)) return
      set({ error: error instanceof Error ? error.message : 'Failed to load lyric document', isLoading: false })
    } finally {
      const state = get()
      if (ownsRead('selectedDocument', owner, readAccountScope(state), documentId)) set({ isLoading: false })
    }
  },

  resolveRuntimeLyricsForAudioTrack: async (audioTrackId, force = false, preserveEditor = false) => {
    const current = get()
    if (!force
      && current.runtimeAudioTrackId === audioTrackId
      && current.runtimeLyricsStatus !== 'error'
      && current.runtimeLyricsStatus !== 'idle') return
    const accountId = readAccountScope(current)
    const owner = beginRead('audioTrack', accountId, audioTrackId)
    set(state => ({
      ...runtimeLyricsState(audioTrackId, null, [], supabaseConfigured ? 'loading' : 'no-active-version'),
      ...(!preserveEditor && !state.editorSessionActive && !state.editorDirty
        ? editorDocumentState(null, [], audioTrackId, null, uniqueId('track-read'))
        : {}),
      isLoading: supabaseConfigured,
      error: null,
    }))
    if (!supabaseConfigured) return
    try {
      const document = await getActiveLyricDocumentForAudioTrack(audioTrackId)
      const cues = document ? await getLyricCuesForDocument(document.id) : []
      const state = get()
      if (!ownsRead('audioTrack', owner, readAccountScope(state), audioTrackId)) return
      if (state.runtimeAudioTrackId !== audioTrackId) return
      set(currentState => ({
        ...runtimeLyricsState(
          audioTrackId,
          document,
          cues,
          document ? 'active-version' : 'no-active-version',
        ),
        ...(!preserveEditor && !currentState.editorSessionActive && !currentState.editorDirty
          ? editorDocumentState(
              document,
              cues,
              audioTrackId,
              null,
              document ? `document:${document.id}` : uniqueId('track-read'),
            )
          : {}),
        isLoading: false,
        error: null,
      }))
    } catch (error) {
      const state = get()
      if (!ownsRead('audioTrack', owner, readAccountScope(state), audioTrackId)) return
      set({
        ...runtimeLyricsState(audioTrackId, null, [], 'error'),
        error: error instanceof Error ? error.message : 'Failed to load lyrics for audio track',
        isLoading: false,
      })
    } finally {
      const state = get()
      if (ownsRead('audioTrack', owner, readAccountScope(state), audioTrackId)) set({ isLoading: false })
    }
  },

  loadLyricsForAudioTrack: async (audioTrackId, force = false) => {
    await get().resolveRuntimeLyricsForAudioTrack(audioTrackId, force)
  },

  loadLyricsForVisualSession: async (visualSessionId) => {
    if (!supabaseConfigured) return
    const accountId = readAccountScope(get())
    const owner = beginRead('visualSession', accountId, visualSessionId)
    invalidateRead('selectedDocument')
    set({ isLoading: true, error: null })
    try {
      const document = await getActiveLyricDocumentForVisualSession(visualSessionId)
      const cues = document ? await getLyricCuesForDocument(document.id) : []
      const state = get()
      if (!ownsRead('visualSession', owner, readAccountScope(state), visualSessionId) || state.editorDirty) return
      const logicalDocumentId = document ? `document:${document.id}` : uniqueId('visual-read')
      const queue = ensureQueue(state, logicalDocumentId, document, cues)
      const snapshot = canonicalSnapshotForRead(queue, document, cues)
      set({
        ...editorDocumentState(snapshot.document, snapshot.cues, snapshot.document?.audioTrackId ?? null, null, logicalDocumentId),
        isLoading: false,
        activeWriteStatus: state.writeStates[logicalDocumentId]?.status ?? 'saved',
      })
    } catch (error) {
      const state = get()
      if (!ownsRead('visualSession', owner, readAccountScope(state), visualSessionId)) return
      set({ error: error instanceof Error ? error.message : 'Failed to load lyrics for visual session', isLoading: false })
    } finally {
      const state = get()
      if (ownsRead('visualSession', owner, readAccountScope(state), visualSessionId)) set({ isLoading: false })
    }
  },

  saveActiveLyricDocument: async (cues, options) => {
    if (!supabaseConfigured) {
      set({ error: 'Supabase is not configured.' })
      return null
    }
    const state = get()
    const logicalDocumentId = state.activeLogicalDocumentId
    const queue = ensureQueue(state, logicalDocumentId, state.editorDocument, state.cues)
    const cueSnapshot = [...(cues ?? state.cues)]
    return new Promise<SaveLyricDocumentResult | null>(resolve => {
      const job: AtomicJob = {
        kind: 'atomic',
        id: uniqueId('lyric-write'),
        logicalDocumentId,
        accountId: accountScope(state),
        editVersion: state.activeEditVersion,
        selectedCueId: state.selectedCueId,
        document: buildDocumentInput(state),
        cues: cueSnapshot,
        activate: options?.makeActive ?? state.editorDocument?.isActive ?? false,
        resolve: result => resolve(result as SaveLyricDocumentResult | null),
      }
      void enqueueWrite(set, get, queue, job)
    })
  },

  replaceActiveCues: async (inputs) => {
    const state = get()
    if (!state.editorDocumentId) {
      set({ error: 'Save the lyric document first before replacing cues.' })
      return null
    }
    const cues = inputs.map((input, index) => normalizeCue({
      id: input.lyricDocumentId && input.lyricDocumentId !== state.editorDocumentId
        ? input.lyricDocumentId
        : uniqueId(`replacement-cue-${index}`),
      startMs: input.startMs,
      endMs: input.endMs,
      text: input.text,
      style: input.style,
      animation: input.animation,
      effects: input.effects,
      words: input.words,
      groups: input.groups,
      confidence: input.confidence,
      source: input.source,
      reviewStatus: input.reviewStatus,
      sectionId: input.sectionId,
      sectionType: input.sectionType,
      warnings: input.warnings,
      analysisMetadata: input.analysisMetadata,
      originalTranscriptionText: input.originalTranscriptionText,
    }))
    const queue = ensureQueue(state, state.activeLogicalDocumentId, state.editorDocument, state.cues)
    return new Promise<SaveLyricDocumentResult | null>(resolve => {
      const job: AtomicJob = {
        kind: 'atomic',
        id: uniqueId('lyric-write'),
        logicalDocumentId: state.activeLogicalDocumentId,
        accountId: accountScope(state),
        editVersion: state.activeEditVersion,
        selectedCueId: state.selectedCueId,
        document: buildDocumentInput(state),
        cues,
        activate: state.editorDocument?.isActive ?? false,
        resolve: result => resolve(result as SaveLyricDocumentResult | null),
      }
      void enqueueWrite(set, get, queue, job)
    })
  },

  saveLyricDocumentMetadata: async (documentId, patch) => {
    if (!supabaseConfigured) return null
    const state = get()
    const logicalDocumentId = state.editorDocumentId === documentId
      ? state.activeLogicalDocumentId
      : `document:${documentId}`
    const queue = ensureQueue(
      state,
      logicalDocumentId,
      state.editorDocumentId === documentId ? state.editorDocument : null,
      state.editorDocumentId === documentId ? state.cues : [],
    )
    return new Promise<SaveLyricDocumentResult | null>(resolve => {
      const job: MetadataJob = {
        kind: 'metadata',
        id: uniqueId('lyric-metadata'),
        logicalDocumentId,
        accountId: accountScope(state),
        editVersion: state.activeEditVersion,
        selectedCueId: state.selectedCueId,
        documentId,
        patch,
        resolve: result => resolve(result as SaveLyricDocumentResult | null),
      }
      void enqueueWrite(set, get, queue, job)
    })
  },

  activateLyricDocument: async (documentId) => {
    if (!supabaseConfigured) {
      set({ error: 'Supabase is not configured.' })
      return null
    }
    const state = get()
    const logicalDocumentId = state.editorDocumentId === documentId
      ? state.activeLogicalDocumentId
      : `document:${documentId}`
    const queue = ensureQueue(
      state,
      logicalDocumentId,
      state.editorDocumentId === documentId ? state.editorDocument : null,
      state.editorDocumentId === documentId ? state.cues : [],
    )
    return new Promise<ActivateLyricDocumentResult | null>(resolve => {
      const job: ActivateJob = {
        kind: 'activate',
        id: uniqueId('lyric-activate'),
        logicalDocumentId,
        accountId: accountScope(state),
        editVersion: state.activeEditVersion,
        selectedCueId: state.selectedCueId,
        selectionLogicalDocumentId: state.activeLogicalDocumentId,
        documentId,
        resolve: result => resolve(result as ActivateLyricDocumentResult | null),
      }
      void enqueueWrite(set, get, queue, job)
    })
  },

  saveTimingChanges: async () => {
    const state = get()
    if (!state.editorDocumentId || !supabaseConfigured || !state.lyricTimingDirty) return null
    return get().saveActiveLyricDocument(state.cues)
  },

  retryActiveLyricWrite: async () => {
    const state = get()
    const queue = writeQueues.get(queueKey(accountScope(state), state.activeLogicalDocumentId))
    if (!queue?.failedJob) return null
    const failed = queue.failedJob
    queue.blocked = null
    queue.failedJob = null
    return new Promise(resolve => {
      const retry = { ...failed, id: uniqueId('lyric-retry'), resolve } as WriteJob
      queue.jobs.unshift(retry)
      updateQueueUi(set, get, queue, 'queued')
      void drainQueue(set, get, queue)
    })
  },

  resolveActiveLyricConflict: (document, cues) => {
    const state = get()
    const queue = ensureQueue(state, state.activeLogicalDocumentId, document, cues)
    queue.blocked = null
    queue.failedJob = null
    queue.canonicalDocumentId = document.id
    queue.revision = document.revision
    queue.canonicalDocument = document
    queue.canonicalCues = [...cues]
    set(current => ({
      editorDocument: document,
      editorDocumentId: document.id,
      activeDocument: document,
      activeDocumentId: document.id,
      lastPersistenceFailure: null,
      error: null,
      activeWriteStatus: queue.jobs.length > 0 ? 'queued' : current.editorDirty ? 'unsaved' : 'saved',
    }))
    if (queue.jobs.length > 0) void drainQueue(set, get, queue)
  },


  restoreRecoveredLyricDraft: (recovery) => {
    const state = get()
    if (state.operationAccountId !== recovery.userId) return
    if ((state.activeAudioTrackId ?? null) !== recovery.trackId) return
    if (recovery.documentId && state.editorDocumentId !== recovery.documentId) return
    const logicalDocumentId = state.activeLogicalDocumentId
    const existing = state.writeStates[logicalDocumentId]
    const writeState: LyricWriteState = {
      logicalDocumentId,
      canonicalDocumentId: state.editorDocumentId,
      status: existing?.status === 'queued' || existing?.status === 'saving' ? existing.status : 'unsaved',
      pendingCount: existing?.pendingCount ?? 0,
      message: null,
      failure: null,
      updatedAt: Date.now(),
    }
    set({
      cues: structuredClone(recovery.cues),
      draftTitle: recovery.title,
      draftArtist: recovery.artist,
      draftDefaultStyle: structuredClone(recovery.defaultStyle),
      draftDefaultAnimation: structuredClone(recovery.defaultAnimation),
      draftDefaultEffects: structuredClone(recovery.defaultEffects),
      globalOffsetMs: toCanonicalLyricMs(recovery.globalOffsetMs),
      draftSourceType: recovery.sourceType,
      draftSourceFormat: recovery.sourceFormat,
      draftRawSourceText: recovery.rawSourceText,
      draftMetadata: recovery.metadata ? structuredClone(recovery.metadata) : null,
      draftActivateOnSave: recovery.activateOnSave,
      activeEditVersion: Math.max(state.activeEditVersion + 1, recovery.editVersion),
      selectedCueId: null,
      cueHistoryPast: [],
      cueHistoryFuture: [],
      lyricTimingDirty: true,
      editorDirty: true,
      activeWriteStatus: writeState.status,
      writeStates: { ...state.writeStates, [logicalDocumentId]: writeState },
      error: null,
      lastPersistenceFailure: null,
    })
  },
}))

export const selectLyricsLoading = (state: LyricsState): boolean => state.isLoading
export const selectActiveLyricsAudioTrackId = (state: LyricsState): string | null => state.runtimeAudioTrackId
export const selectHasActiveLyricDocument = (state: LyricsState): boolean => state.runtimeActiveDocument !== null
export const selectActiveTrackHasLyricDocument = (state: LyricsState): boolean =>
  state.runtimeAudioTrackId !== null
  && state.runtimeActiveDocument !== null
  && state.runtimeActiveDocument.audioTrackId === state.runtimeAudioTrackId
export const selectEditorDocument = (state: LyricsState): LyricDocument | null => state.editorDocument
export const selectRuntimeActiveDocument = (state: LyricsState): LyricDocument | null => state.runtimeActiveDocument
