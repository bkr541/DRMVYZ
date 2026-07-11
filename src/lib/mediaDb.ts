// Narrow typed helpers for media DB and storage operations.
// Avoids the `supabase as any` pattern by isolating the controlled cast here.

import { supabase, supabaseConfigured } from './supabase'
import type {
  MediaItemRow,
  MediaItemInsert,
  MediaMetadata,
  MediaTagRow,
  MediaCollectionRow,
  MediaCollectionInsert,
  MediaCollectionItemRow,
  MediaRoleDb,
  MediaDerivativePath,
  MediaCleanupJobRow,
} from '../types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

// supabase-js v2 createClient<Database> causes `never` inference when the
// Database type lacks `Relationships` arrays. We isolate the cast here.
const db = supabase as unknown as SupabaseClient

// ── Shared result types ────────────────────────────────────────────────────────

export interface DbListResult<T> { rows: T[]; error: string | null }
export interface DbCreateResult  { id: string | null; error: string | null }
export interface DbCreateMediaResult { id: string | null; revision: number | null; error: string | null }
export interface DbMutateResult  { error: string | null }
export interface SignedUrlResult { url: string | null; error: string | null }


export interface CanonicalMediaItem extends MediaItemRow {
  tags: string[]
  collection_ids: string[]
}

export interface FinalizeMediaUploadInput {
  operationId: string
  media: {
    name: string
    type: 'image' | 'video'
    storage_path: string
    thumbnail_path: string | null
    width: number | null
    height: number | null
    duration_sec: number | null
    file_size: number | null
    mime_type: string | null
    favorite: boolean
    media_role: MediaRoleDb
    title: string | null
    description: string | null
    metadata: MediaMetadata
  }
  tagNames: string[]
  collectionIds: string[]
  derivatives: MediaDerivativePath[]
}

export type BeginMediaUploadResult =
  | { ok: true; mediaItem: CanonicalMediaItem | null; operationStatus: string; phase: string }
  | { ok: false; kind: MediaPersistenceFailureKind; message: string; code?: string }

export type FinalizeMediaUploadResult =
  | { ok: true; mediaItem: CanonicalMediaItem; reconciled: boolean }
  | { ok: false; kind: MediaPersistenceFailureKind; message: string; code?: string }

export type MediaCleanupResult =
  | { ok: true; cleanupJob: MediaCleanupJobRow }
  | { ok: false; kind: MediaPersistenceFailureKind; message: string; code?: string }

export type RequestMediaDeletionResult =
  | { ok: true; cleanupJob: MediaCleanupJobRow; reconciled: boolean }
  | { ok: false; kind: MediaPersistenceFailureKind; message: string; code?: string }

export type FinalizeMediaDeletionResult =
  | { ok: true; mediaItemId: string | null }
  | { ok: false; kind: MediaPersistenceFailureKind; message: string; code?: string }

export interface SaveMediaItemAtomicInput {
  mediaItemId: string
  expectedRevision: number
  patch: {
    media_role: MediaRoleDb
    title: string | null
    description: string | null
    favorite: boolean
    metadata: MediaMetadata
  }
  tagNames: string[]
  collectionIds: string[]
}

export type MediaPersistenceFailureKind = 'validation' | 'conflict' | 'authorization' | 'transport' | 'unexpected'

export type SaveMediaItemAtomicResult =
  | { ok: true; kind: 'success'; mediaItem: CanonicalMediaItem }
  | {
      ok: false
      kind: MediaPersistenceFailureKind
      message: string
      code?: string
      currentRevision?: number
      mediaItem?: CanonicalMediaItem
    }

export type ReorderMediaCollectionResult =
  | { ok: true; kind: 'success'; orderedMediaIds: string[] }
  | { ok: false; kind: MediaPersistenceFailureKind; message: string; code?: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseCanonicalMediaItem(value: unknown): CanonicalMediaItem | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.revision !== 'number') return null
  if (!Array.isArray(value.tags) || !value.tags.every(tag => typeof tag === 'string')) return null
  if (!Array.isArray(value.collection_ids) || !value.collection_ids.every(id => typeof id === 'string')) return null
  return value as unknown as CanonicalMediaItem
}


function parseCleanupJob(value: unknown): MediaCleanupJobRow | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.user_id !== 'string') return null
  if (!Array.isArray(value.storage_paths) || !value.storage_paths.every(path => typeof path === 'string')) return null
  if (!Array.isArray(value.completed_paths) || !value.completed_paths.every(path => typeof path === 'string')) return null
  return value as unknown as MediaCleanupJobRow
}

function persistenceFailure(data: unknown, fallback: string): { ok: false; kind: MediaPersistenceFailureKind; message: string; code?: string } {
  if (!isRecord(data)) return { ok: false, kind: 'unexpected', message: fallback }
  const parsed = parsePersistenceFailure(data, fallback)
  return { ok: false, kind: parsed.kind, message: parsed.message, ...(parsed.code ? { code: parsed.code } : {}) }
}

function parsePersistenceFailure(data: Record<string, unknown>, fallback: string): Exclude<SaveMediaItemAtomicResult, { ok: true }> {
  const message = typeof data.message === 'string' ? data.message : fallback
  const code = typeof data.error_code === 'string' ? data.error_code : undefined
  const mediaItem = parseCanonicalMediaItem(data.media_item)
  switch (data.status) {
    case 'validation_failure':
      return { ok: false, kind: 'validation', message, ...(code ? { code } : {}) }
    case 'conflict':
      return {
        ok: false,
        kind: 'conflict',
        message,
        ...(code ? { code } : {}),
        ...(typeof data.current_revision === 'number' ? { currentRevision: data.current_revision } : {}),
        ...(mediaItem ? { mediaItem } : {}),
      }
    case 'authorization_failure':
      return { ok: false, kind: 'authorization', message }
    case 'unexpected_failure':
      return { ok: false, kind: 'unexpected', message, ...(code ? { code } : {}) }
    default:
      return { ok: false, kind: 'unexpected', message: fallback }
  }
}

// ── media_items ────────────────────────────────────────────────────────────────

export async function listMediaItems(userId: string): Promise<DbListResult<MediaItemRow>> {
  const { data, error } = await db
    .from('media_items')
    .select('*')
    .eq('user_id', userId)
    .eq('lifecycle_status', 'complete')
    .order('created_at', { ascending: false })
  return { rows: (data as MediaItemRow[] | null) ?? [], error: error?.message ?? null }
}

export async function createMediaItem(insert: MediaItemInsert): Promise<DbCreateMediaResult> {
  const { data, error } = await db
    .from('media_items')
    .insert(insert)
    .select('id, revision')
    .single()
  const row = data as { id: string; revision: number } | null
  return {
    id: row?.id ?? null,
    revision: typeof row?.revision === 'number' ? row.revision : null,
    error: error?.message ?? null,
  }
}

export async function deleteMediaItem(id: string): Promise<DbMutateResult> {
  const { error } = await db.from('media_items').delete().eq('id', id)
  return { error: error?.message ?? null }
}


/**
 * Updates one canonical media item plus its complete tag and collection sets in
 * a single PostgreSQL transaction guarded by the expected revision.
 */
export async function saveMediaItemAtomic(
  input: SaveMediaItemAtomicInput,
): Promise<SaveMediaItemAtomicResult> {
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    return { ok: false, kind: 'validation', message: 'A valid expected media revision is required.' }
  }

  try {
    const { data, error } = await db.rpc('save_media_item_atomic', {
      p_media_item_id: input.mediaItemId,
      p_expected_revision: input.expectedRevision,
      p_patch: input.patch,
      p_tag_names: input.tagNames,
      p_collection_ids: input.collectionIds,
    })

    if (error) {
      return {
        ok: false,
        kind: 'transport',
        message: 'The media update request failed before a canonical result was received.',
        ...(typeof error.code === 'string' ? { code: error.code } : {}),
      }
    }
    if (!isRecord(data)) {
      return { ok: false, kind: 'unexpected', message: 'The media update returned malformed data.' }
    }
    if (data.status !== 'success') {
      return parsePersistenceFailure(data, 'The media update was rejected.')
    }
    const mediaItem = parseCanonicalMediaItem(data.media_item)
    if (!mediaItem) {
      return { ok: false, kind: 'unexpected', message: 'The media update returned an incomplete canonical item.' }
    }
    return { ok: true, kind: 'success', mediaItem }
  } catch (error) {
    return {
      ok: false,
      kind: 'transport',
      message: error instanceof Error ? error.message : 'Unexpected media update transport failure.',
    }
  }
}

export async function reorderMediaCollectionAtomic(
  collectionId: string,
  orderedMediaIds: string[],
): Promise<ReorderMediaCollectionResult> {
  try {
    const { data, error } = await db.rpc('reorder_media_collection_atomic', {
      p_collection_id: collectionId,
      p_ordered_media_ids: orderedMediaIds,
    })
    if (error) {
      return {
        ok: false,
        kind: 'transport',
        message: 'The collection reorder request failed before a canonical result was received.',
        ...(typeof error.code === 'string' ? { code: error.code } : {}),
      }
    }
    if (!isRecord(data)) {
      return { ok: false, kind: 'unexpected', message: 'The collection reorder returned malformed data.' }
    }
    if (data.status !== 'success') {
      const failure = parsePersistenceFailure(data, 'The collection reorder was rejected.')
      return { ok: false, kind: failure.kind, message: failure.message, ...(failure.code ? { code: failure.code } : {}) }
    }
    if (!Array.isArray(data.ordered_media_ids) || !data.ordered_media_ids.every(id => typeof id === 'string')) {
      return { ok: false, kind: 'unexpected', message: 'The collection reorder returned an incomplete canonical order.' }
    }
    return { ok: true, kind: 'success', orderedMediaIds: data.ordered_media_ids }
  } catch (error) {
    return {
      ok: false,
      kind: 'transport',
      message: error instanceof Error ? error.message : 'Unexpected collection reorder transport failure.',
    }
  }
}

// ── Storage ────────────────────────────────────────────────────────────────────

export async function createSignedMediaUrl(
  storagePath: string,
  expiresIn = 604800,
): Promise<SignedUrlResult> {
  const { data, error } = await supabase.storage
    .from('media-items')
    .createSignedUrl(storagePath, expiresIn)
  return { url: data?.signedUrl ?? null, error: error?.message ?? null }
}

export async function mediaFileExists(storagePath: string): Promise<{ exists: boolean; error: string | null }> {
  if (!supabaseConfigured) return { exists: false, error: 'Supabase not configured' }
  const slash = storagePath.lastIndexOf('/')
  if (slash <= 0 || slash === storagePath.length - 1) return { exists: false, error: 'Invalid storage path' }
  const folder = storagePath.slice(0, slash)
  const name = storagePath.slice(slash + 1)
  const { data, error } = await supabase.storage.from('media-items').list(folder, { search: name, limit: 100 })
  return { exists: Boolean(data?.some(entry => entry.name === name)), error: error?.message ?? null }
}

export async function uploadMediaFile(
  storagePath: string,
  file: File | Blob,
  contentType: string,
): Promise<DbMutateResult & { reused?: boolean }> {
  if (!supabaseConfigured) return { error: 'Supabase not configured' }
  const existing = await mediaFileExists(storagePath)
  if (!existing.error && existing.exists) return { error: null, reused: true }
  const { error } = await supabase.storage
    .from('media-items')
    .upload(storagePath, file, { upsert: false, contentType })
  if (error && /already exists|duplicate/i.test(error.message)) {
    const reconciled = await mediaFileExists(storagePath)
    if (!reconciled.error && reconciled.exists) return { error: null, reused: true }
  }
  return { error: error?.message ?? null, reused: false }
}

export async function deleteMediaFile(path: string): Promise<DbMutateResult> {
  const { error } = await supabase.storage.from('media-items').remove([path])
  return { error: error?.message ?? null }
}

export async function deleteMediaFiles(paths: string[]): Promise<DbMutateResult> {
  if (!paths.length) return { error: null }
  const { error } = await supabase.storage.from('media-items').remove(paths)
  return { error: error?.message ?? null }
}

// ── Recoverable upload and deletion RPCs ──────────────────────────────────────

export async function beginMediaUpload(
  operationId: string,
  originalPath: string,
  derivatives: MediaDerivativePath[],
): Promise<BeginMediaUploadResult> {
  try {
    const { data, error } = await db.rpc('begin_media_upload', {
      p_operation_id: operationId,
      p_original_path: originalPath,
      p_derivative_paths: derivatives,
    })
    if (error) return { ok: false, kind: 'transport', message: 'The upload session could not be prepared.', ...(error.code ? { code: error.code } : {}) }
    if (!isRecord(data) || data.status !== 'success') return persistenceFailure(data, 'The upload session was rejected.')
    const mediaItem = data.media_item == null ? null : parseCanonicalMediaItem(data.media_item)
    if (data.media_item != null && !mediaItem) return { ok: false, kind: 'unexpected', message: 'The upload session returned malformed canonical media.' }
    return {
      ok: true,
      mediaItem,
      operationStatus: typeof data.operation_status === 'string' ? data.operation_status : 'uploading',
      phase: typeof data.phase === 'string' ? data.phase : 'uploading_original',
    }
  } catch (error) {
    return { ok: false, kind: 'transport', message: error instanceof Error ? error.message : 'Unexpected upload session failure.' }
  }
}

export async function finalizeMediaUploadAtomic(input: FinalizeMediaUploadInput): Promise<FinalizeMediaUploadResult> {
  try {
    const { data, error } = await db.rpc('finalize_media_upload_atomic', {
      p_operation_id: input.operationId,
      p_media: input.media,
      p_tag_names: input.tagNames,
      p_collection_ids: input.collectionIds,
      p_derivative_paths: input.derivatives,
    })
    if (error) return { ok: false, kind: 'transport', message: 'The upload finalization response was not received.', ...(error.code ? { code: error.code } : {}) }
    if (!isRecord(data) || data.status !== 'success') return persistenceFailure(data, 'The upload could not be finalized.')
    const mediaItem = parseCanonicalMediaItem(data.media_item)
    if (!mediaItem) return { ok: false, kind: 'unexpected', message: 'The upload returned an incomplete canonical media item.' }
    return { ok: true, mediaItem, reconciled: data.reconciled === true }
  } catch (error) {
    return { ok: false, kind: 'transport', message: error instanceof Error ? error.message : 'Unexpected upload finalization failure.' }
  }
}

export async function markMediaUploadCleanupPending(
  operationId: string,
  storagePaths: string[],
  errorMessage: string,
): Promise<MediaCleanupResult> {
  const { data, error } = await db.rpc('mark_media_upload_cleanup_pending', {
    p_operation_id: operationId,
    p_storage_paths: storagePaths,
    p_error: errorMessage,
  })
  if (error) return { ok: false, kind: 'transport', message: 'The failed upload cleanup could not be recorded.', ...(error.code ? { code: error.code } : {}) }
  if (!isRecord(data) || data.status !== 'success') return persistenceFailure(data, 'The failed upload cleanup was rejected.')
  const cleanupJob = parseCleanupJob(data.cleanup_job)
  if (!cleanupJob) return { ok: false, kind: 'unexpected', message: 'The cleanup request returned malformed data.' }
  return { ok: true, cleanupJob }
}

export async function updateMediaCleanupJob(
  jobId: string,
  completedPaths: string[],
  status: 'pending' | 'failed' | 'complete',
  errorMessage: string | null = null,
): Promise<MediaCleanupResult> {
  const { data, error } = await db.rpc('update_media_cleanup_job', {
    p_job_id: jobId,
    p_completed_paths: completedPaths,
    p_status: status,
    p_error: errorMessage,
  })
  if (error) return { ok: false, kind: 'transport', message: 'Cleanup progress could not be saved.', ...(error.code ? { code: error.code } : {}) }
  if (!isRecord(data) || data.status !== 'success') return persistenceFailure(data, 'Cleanup progress was rejected.')
  const cleanupJob = parseCleanupJob(data.cleanup_job)
  if (!cleanupJob) return { ok: false, kind: 'unexpected', message: 'Cleanup progress returned malformed data.' }
  return { ok: true, cleanupJob }
}

export async function requestMediaDeletion(mediaItemId: string): Promise<RequestMediaDeletionResult> {
  const { data, error } = await db.rpc('request_media_deletion', { p_media_item_id: mediaItemId })
  if (error) return { ok: false, kind: 'transport', message: 'The deletion request was not recorded.', ...(error.code ? { code: error.code } : {}) }
  if (!isRecord(data) || data.status !== 'success') return persistenceFailure(data, 'The deletion request was rejected.')
  const cleanupJob = parseCleanupJob(data.cleanup_job)
  if (!cleanupJob) return { ok: false, kind: 'unexpected', message: 'The deletion request returned malformed cleanup data.' }
  return { ok: true, cleanupJob, reconciled: data.reconciled === true }
}

export async function finalizeMediaDeletion(cleanupJobId: string): Promise<FinalizeMediaDeletionResult> {
  const { data, error } = await db.rpc('finalize_media_deletion', { p_cleanup_job_id: cleanupJobId })
  if (error) return { ok: false, kind: 'transport', message: 'The deletion could not be finalized.', ...(error.code ? { code: error.code } : {}) }
  if (!isRecord(data) || data.status !== 'success') return persistenceFailure(data, 'The deletion finalization was rejected.')
  return { ok: true, mediaItemId: typeof data.media_item_id === 'string' ? data.media_item_id : null }
}

export async function listPendingMediaCleanup(): Promise<DbListResult<MediaCleanupJobRow>> {
  const { data, error } = await db.rpc('list_pending_media_cleanup')
  if (error) return { rows: [], error: error.message }
  if (!Array.isArray(data)) return { rows: [], error: 'Pending cleanup returned malformed data.' }
  const rows = data.map(parseCleanupJob).filter((row): row is MediaCleanupJobRow => row !== null)
  return { rows, error: rows.length === data.length ? null : 'Some pending cleanup records were malformed.' }
}

// ── media_tags ─────────────────────────────────────────────────────────────────

export async function listMediaTags(userId: string): Promise<DbListResult<MediaTagRow>> {
  const { data, error } = await db
    .from('media_tags')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })
  return { rows: (data as MediaTagRow[] | null) ?? [], error: error?.message ?? null }
}

export async function createMediaTag(
  userId: string,
  name: string,
  color?: string,
): Promise<DbCreateResult> {
  const { data, error } = await db
    .from('media_tags')
    .insert({ user_id: userId, name, color: color ?? null })
    .select('id')
    .single()
  return { id: (data as { id: string } | null)?.id ?? null, error: error?.message ?? null }
}

/**
 * Upserts each tag name for the user, returning the map name → id.
 * Uses ON CONFLICT DO NOTHING + re-select so it never throws on duplicates.
 */
export async function upsertMediaTags(
  userId: string,
  names: string[],
): Promise<{ nameToId: Map<string, string>; error: string | null }> {
  if (!names.length) return { nameToId: new Map(), error: null }

  // Insert rows that don't exist yet (conflict on unique(user_id, name))
  const { error: insErr } = await db
    .from('media_tags')
    .upsert(
      names.map(name => ({ user_id: userId, name })),
      { onConflict: 'user_id,name', ignoreDuplicates: true },
    )
  if (insErr) return { nameToId: new Map(), error: insErr.message }

  // Fetch IDs for all requested names
  const { data, error: selErr } = await db
    .from('media_tags')
    .select('id, name')
    .eq('user_id', userId)
    .in('name', names)
  if (selErr) return { nameToId: new Map(), error: selErr.message }

  const nameToId = new Map<string, string>(
    ((data as { id: string; name: string }[]) ?? []).map(r => [r.name, r.id])
  )
  return { nameToId, error: null }
}

// ── media_item_tags ────────────────────────────────────────────────────────────

/**
 * Returns a map of mediaItemId → string[] tag names for all the user's items.
 * Called once on load to populate UploadedMedia.tags[].
 */
export async function listMediaItemTagNames(userId: string): Promise<{ tagMap: Map<string, string[]>; error: string | null }> {
  const { data, error } = await db
    .from('media_item_tags')
    .select('media_item_id, media_tags!inner(name, user_id)')
    .eq('media_tags.user_id', userId)
  if (error) return { tagMap: new Map(), error: error.message }

  const tagMap = new Map<string, string[]>()
  for (const row of (data ?? []) as unknown as { media_item_id: string; media_tags: { name: string } }[]) {
    const prev = tagMap.get(row.media_item_id) ?? []
    tagMap.set(row.media_item_id, [...prev, row.media_tags.name])
  }
  return { tagMap, error: null }
}

/**
 * Upload bootstrap only. Existing canonical media mutations must use
 * saveMediaItemAtomic so tag replacement cannot partially commit.
 */
export async function setMediaItemTags(
  mediaId: string,
  userId: string,
  tagNames: string[],
): Promise<DbMutateResult> {
  // Step 1: ensure tags exist, get their IDs
  const { nameToId, error: upsertErr } = await upsertMediaTags(userId, tagNames)
  if (upsertErr) return { error: upsertErr }

  // Step 2: delete existing associations
  const { error: delErr } = await db
    .from('media_item_tags')
    .delete()
    .eq('media_item_id', mediaId)
  if (delErr) return { error: delErr.message }

  // Step 3: insert new associations
  if (!tagNames.length) return { error: null }
  const rows = tagNames.map(name => ({
    media_item_id: mediaId,
    tag_id: nameToId.get(name)!,
  })).filter(r => r.tag_id)

  const { error: insErr } = await db.from('media_item_tags').insert(rows)
  return { error: insErr?.message ?? null }
}

// ── media_collections ─────────────────────────────────────────────────────────

export async function listMediaCollections(userId: string): Promise<DbListResult<MediaCollectionRow>> {
  const { data, error } = await db
    .from('media_collections')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })
  return { rows: (data as MediaCollectionRow[] | null) ?? [], error: error?.message ?? null }
}

export async function createMediaCollection(insert: MediaCollectionInsert): Promise<DbCreateResult> {
  const { data, error } = await db
    .from('media_collections')
    .upsert(insert, { onConflict: 'user_id,name' })
    .select('id')
    .single()
  return { id: (data as { id: string } | null)?.id ?? null, error: error?.message ?? null }
}

export async function updateMediaCollection(
  id: string,
  update: Partial<Pick<MediaCollectionRow, 'name' | 'description'>>,
): Promise<DbMutateResult> {
  const { error } = await db.from('media_collections').update(update).eq('id', id)
  return { error: error?.message ?? null }
}

export async function deleteMediaCollection(id: string): Promise<DbMutateResult> {
  const { error } = await db.from('media_collections').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ── media_collection_items ────────────────────────────────────────────────────

/**
 * Returns a map of mediaItemId → collectionId[] for all the user's items.
 */
export async function listMediaItemCollectionIds(userId: string): Promise<{ collMap: Map<string, string[]>; error: string | null }> {
  const { data, error } = await db
    .from('media_collection_items')
    .select('media_item_id, collection_id, media_collections!inner(user_id)')
    .eq('media_collections.user_id', userId)
    .order('sort_order', { ascending: true })
  if (error) return { collMap: new Map(), error: error.message }

  const collMap = new Map<string, string[]>()
  for (const row of (data ?? []) as unknown as { media_item_id: string; collection_id: string }[]) {
    const prev = collMap.get(row.media_item_id) ?? []
    collMap.set(row.media_item_id, [...prev, row.collection_id])
  }
  return { collMap, error: null }
}

/**
 * Upload bootstrap only. Existing canonical media mutations must use
 * saveMediaItemAtomic so relationship replacement cannot partially commit.
 */
export async function setMediaItemCollections(
  mediaId: string,
  collectionIds: string[],
): Promise<DbMutateResult> {
  const { error: delErr } = await db
    .from('media_collection_items')
    .delete()
    .eq('media_item_id', mediaId)
  if (delErr) return { error: delErr.message }

  if (!collectionIds.length) return { error: null }
  const rows = collectionIds.map((collection_id, i) => ({
    collection_id,
    media_item_id: mediaId,
    sort_order: i,
  }))
  const { error: insErr } = await db.from('media_collection_items').insert(rows)
  return { error: insErr?.message ?? null }
}
