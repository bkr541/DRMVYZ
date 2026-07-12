import type {
  LyricAnimation,
  LyricCue,
  LyricDocument,
  LyricDocumentSourceFormat,
  LyricDocumentSourceType,
  LyricEffects,
  LyricStyle,
} from '../types/lyrics'

export const LYRIC_RECOVERY_SCHEMA_VERSION = 1
const DATABASE_NAME = 'drmvyz-lyric-recovery'
const OBJECT_STORE_NAME = 'lyric-drafts'
const DATABASE_VERSION = 1
const MAX_RECOVERY_AGE_MS = 1000 * 60 * 60 * 24 * 90

export interface LyricRecoveryRecord {
  key: string
  schemaVersion: number
  userId: string
  trackId: string | null
  documentId: string | null
  logicalDocumentId: string
  baseServerRevision: number | null
  cues: LyricCue[]
  title: string
  artist: string
  defaultStyle: Partial<LyricStyle>
  defaultAnimation: Partial<LyricAnimation>
  defaultEffects: Partial<LyricEffects>
  globalOffsetMs: number
  sourceType: LyricDocumentSourceType | null
  sourceFormat: LyricDocumentSourceFormat | null
  rawSourceText: string | null
  metadata: Record<string, unknown> | null
  activateOnSave: boolean
  editVersion: number
  lastEditAt: number
}

export interface LyricRecoveryIdentity {
  userId: string
  trackId: string | null
  documentId: string | null
  logicalDocumentId: string
}

export interface LyricRecoveryRepository {
  get(key: string): Promise<LyricRecoveryRecord | null>
  put(record: LyricRecoveryRecord): Promise<void>
  delete(key: string): Promise<void>
  listByUser(userId: string): Promise<LyricRecoveryRecord[]>
}

function ensureValidRecord(value: unknown): LyricRecoveryRecord | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<LyricRecoveryRecord>
  if (
    record.schemaVersion !== LYRIC_RECOVERY_SCHEMA_VERSION
    || typeof record.key !== 'string'
    || typeof record.userId !== 'string'
    || typeof record.logicalDocumentId !== 'string'
    || !Array.isArray(record.cues)
    || typeof record.lastEditAt !== 'number'
  ) return null
  return record as LyricRecoveryRecord
}

export function lyricRecoveryKey(identity: LyricRecoveryIdentity): string {
  const trackPart = identity.trackId ?? 'no-track'
  const documentPart = identity.documentId
    ? `document:${identity.documentId}`
    : `draft:${identity.logicalDocumentId}`
  return `${identity.userId}|${trackPart}|${documentPart}`
}

export function createLyricRecoveryRecord(
  identity: LyricRecoveryIdentity,
  state: {
    baseServerRevision: number | null
    cues: LyricCue[]
    title: string
    artist: string
    defaultStyle: Partial<LyricStyle>
    defaultAnimation: Partial<LyricAnimation>
    defaultEffects: Partial<LyricEffects>
    globalOffsetMs: number
    sourceType: LyricDocumentSourceType | null
    sourceFormat: LyricDocumentSourceFormat | null
    rawSourceText: string | null
    metadata: Record<string, unknown> | null
    activateOnSave: boolean
    editVersion: number
    lastEditAt?: number
  },
): LyricRecoveryRecord {
  return {
    key: lyricRecoveryKey(identity),
    schemaVersion: LYRIC_RECOVERY_SCHEMA_VERSION,
    ...identity,
    baseServerRevision: state.baseServerRevision,
    cues: structuredClone(state.cues),
    title: state.title,
    artist: state.artist,
    defaultStyle: structuredClone(state.defaultStyle),
    defaultAnimation: structuredClone(state.defaultAnimation),
    defaultEffects: structuredClone(state.defaultEffects),
    globalOffsetMs: state.globalOffsetMs,
    sourceType: state.sourceType,
    sourceFormat: state.sourceFormat,
    rawSourceText: state.rawSourceText,
    metadata: state.metadata ? structuredClone(state.metadata) : null,
    activateOnSave: state.activateOnSave,
    editVersion: state.editVersion,
    lastEditAt: state.lastEditAt ?? Date.now(),
  }
}

export function recoveryConflictsWithServer(
  recovery: LyricRecoveryRecord,
  document: LyricDocument | null,
): boolean {
  if (!document) return recovery.baseServerRevision !== null
  return recovery.baseServerRevision !== document.revision
}

export function describeLyricRecoveryDifferences(
  recovery: LyricRecoveryRecord,
  document: LyricDocument | null,
  canonicalCues: readonly LyricCue[],
): string[] {
  const differences: string[] = []
  if (recovery.title !== (document?.title ?? '')) differences.push('Title changed')
  if (recovery.artist !== (document?.artist ?? '')) differences.push('Artist changed')
  if (recovery.globalOffsetMs !== (document?.globalOffsetMs ?? 0)) differences.push('Global timing offset changed')
  if (recovery.cues.length !== canonicalCues.length) {
    differences.push(`Cue count: server ${canonicalCues.length}, recovery ${recovery.cues.length}`)
  } else if (JSON.stringify(recovery.cues) !== JSON.stringify(canonicalCues)) {
    differences.push('Cue timing, text, or metadata changed')
  }
  if (JSON.stringify(recovery.defaultStyle) !== JSON.stringify(document?.defaultStyle ?? {})) differences.push('Default style changed')
  if (JSON.stringify(recovery.defaultAnimation) !== JSON.stringify(document?.defaultAnimation ?? {})) differences.push('Default animation changed')
  if (JSON.stringify(recovery.defaultEffects) !== JSON.stringify(document?.defaultEffects ?? {})) differences.push('Default effects changed')
  return differences.length > 0 ? differences : ['Recovery matches the currently loaded server content']
}

export function createMemoryLyricRecoveryRepository(
  records = new Map<string, LyricRecoveryRecord>(),
): LyricRecoveryRepository {
  return {
    async get(key) {
      const value = records.get(key)
      return value ? structuredClone(value) : null
    },
    async put(record) {
      records.set(record.key, structuredClone(record))
    },
    async delete(key) {
      records.delete(key)
    },
    async listByUser(userId) {
      return [...records.values()]
        .filter(record => record.userId === userId)
        .map(record => structuredClone(record))
    },
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'))
  })
}

export function createIndexedDbLyricRecoveryRepository(
  indexedDb: IDBFactory | undefined = typeof indexedDB === 'undefined' ? undefined : indexedDB,
): LyricRecoveryRepository {
  let databasePromise: Promise<IDBDatabase> | null = null

  const openDatabase = (): Promise<IDBDatabase> => {
    if (!indexedDb) return Promise.reject(new Error('IndexedDB is unavailable. Lyric recovery could not be saved.'))
    if (databasePromise) return databasePromise
    databasePromise = new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest
      try {
        request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION)
      } catch (error) {
        reject(error)
        return
      }
      request.onupgradeneeded = () => {
        const db = request.result
        const store = db.objectStoreNames.contains(OBJECT_STORE_NAME)
          ? request.transaction!.objectStore(OBJECT_STORE_NAME)
          : db.createObjectStore(OBJECT_STORE_NAME, { keyPath: 'key' })
        if (!store.indexNames.contains('userId')) store.createIndex('userId', 'userId', { unique: false })
        if (!store.indexNames.contains('trackId')) store.createIndex('trackId', ['userId', 'trackId'], { unique: false })
        if (!store.indexNames.contains('documentId')) store.createIndex('documentId', ['userId', 'documentId'], { unique: false })
      }
      request.onsuccess = () => {
        const db = request.result
        db.onversionchange = () => db.close()
        resolve(db)
      }
      request.onerror = () => reject(request.error ?? new Error('Unable to open lyric recovery storage.'))
      request.onblocked = () => reject(new Error('Lyric recovery storage is blocked by another DRMVYZ window.'))
    })
    return databasePromise
  }

  return {
    async get(key) {
      const db = await openDatabase()
      const tx = db.transaction(OBJECT_STORE_NAME, 'readonly')
      const value = await requestResult(tx.objectStore(OBJECT_STORE_NAME).get(key))
      const record = ensureValidRecord(value)
      if (!record && value !== undefined) {
        const cleanup = db.transaction(OBJECT_STORE_NAME, 'readwrite')
        cleanup.objectStore(OBJECT_STORE_NAME).delete(key)
        await transactionDone(cleanup)
      }
      return record
    },
    async put(record) {
      const db = await openDatabase()
      const tx = db.transaction(OBJECT_STORE_NAME, 'readwrite')
      tx.objectStore(OBJECT_STORE_NAME).put(record)
      await transactionDone(tx)
    },
    async delete(key) {
      const db = await openDatabase()
      const tx = db.transaction(OBJECT_STORE_NAME, 'readwrite')
      tx.objectStore(OBJECT_STORE_NAME).delete(key)
      await transactionDone(tx)
    },
    async listByUser(userId) {
      const db = await openDatabase()
      const tx = db.transaction(OBJECT_STORE_NAME, 'readonly')
      const values = await requestResult(tx.objectStore(OBJECT_STORE_NAME).index('userId').getAll(userId))
      const records: LyricRecoveryRecord[] = []
      const invalidKeys: string[] = []
      for (const value of values) {
        const record = ensureValidRecord(value)
        if (record) records.push(record)
        else if (value && typeof value === 'object' && typeof (value as { key?: unknown }).key === 'string') {
          invalidKeys.push((value as { key: string }).key)
        }
      }
      if (invalidKeys.length > 0) {
        const cleanup = db.transaction(OBJECT_STORE_NAME, 'readwrite')
        const store = cleanup.objectStore(OBJECT_STORE_NAME)
        invalidKeys.forEach(key => store.delete(key))
        await transactionDone(cleanup)
      }
      return records
    },
  }
}

let defaultRepository: LyricRecoveryRepository | null = null

export function getLyricRecoveryRepository(): LyricRecoveryRepository {
  defaultRepository ??= createIndexedDbLyricRecoveryRepository()
  return defaultRepository
}

export function setLyricRecoveryRepositoryForTests(repository: LyricRecoveryRepository | null): void {
  defaultRepository = repository
}

export async function findLyricRecovery(
  identity: LyricRecoveryIdentity,
  repository = getLyricRecoveryRepository(),
): Promise<LyricRecoveryRecord | null> {
  const exact = await repository.get(lyricRecoveryKey(identity))
  if (exact) return exact
  if (!identity.documentId || !identity.trackId) return null
  const candidates = await repository.listByUser(identity.userId)
  return candidates
    .filter(record => record.trackId === identity.trackId && record.documentId === identity.documentId)
    .sort((left, right) => right.lastEditAt - left.lastEditAt)[0] ?? null
}


export async function reconcileLyricRecoveryAfterCanonicalWrite(
  input: {
    userId: string
    trackId: string | null
    documentId: string
    logicalDocumentId: string
    newerRecovery: LyricRecoveryRecord | null
  },
  repository = getLyricRecoveryRepository(),
): Promise<void> {
  const draftKey = lyricRecoveryKey({
    userId: input.userId,
    trackId: input.trackId,
    documentId: null,
    logicalDocumentId: input.logicalDocumentId,
  })
  const canonicalKey = lyricRecoveryKey({
    userId: input.userId,
    trackId: input.trackId,
    documentId: input.documentId,
    logicalDocumentId: input.logicalDocumentId,
  })
  if (input.newerRecovery) {
    await repository.put(input.newerRecovery)
    if (draftKey !== input.newerRecovery.key) await repository.delete(draftKey)
    if (canonicalKey !== input.newerRecovery.key) await repository.delete(canonicalKey)
    return
  }
  await Promise.all([repository.delete(draftKey), repository.delete(canonicalKey)])
}

export async function deleteLyricRecoveryForDocument(
  userId: string,
  documentId: string,
  repository = getLyricRecoveryRepository(),
): Promise<void> {
  const records = await repository.listByUser(userId)
  await Promise.all(records.filter(record => record.documentId === documentId).map(record => repository.delete(record.key)))
}

export async function deleteLyricRecoveryForTrack(
  userId: string,
  trackId: string,
  repository = getLyricRecoveryRepository(),
): Promise<void> {
  const records = await repository.listByUser(userId)
  await Promise.all(records.filter(record => record.trackId === trackId).map(record => repository.delete(record.key)))
}

export async function cleanupObsoleteLyricRecoveries(
  userId: string,
  now = Date.now(),
  repository = getLyricRecoveryRepository(),
): Promise<void> {
  const records = await repository.listByUser(userId)
  await Promise.all(records
    .filter(record => record.schemaVersion !== LYRIC_RECOVERY_SCHEMA_VERSION || now - record.lastEditAt > MAX_RECOVERY_AGE_MS)
    .map(record => repository.delete(record.key)))
}
