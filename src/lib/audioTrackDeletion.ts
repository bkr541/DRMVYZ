import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { AudioCleanupJobRow } from '../types/database'

const db = supabase as unknown as SupabaseClient
const AUDIO_BUCKET = 'audio-tracks'
export const AUDIO_TRACK_DELETED_EVENT = 'drmvyz:audio-track-deleted'

export interface CanonicalAudioDeletionResult {
  ok: boolean
  trackId: string
  pendingCleanup: boolean
  message: string | null
}

interface RpcEnvelope {
  status?: string
  message?: string
  cleanup_job?: unknown
  audio_track_id?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseCleanupJob(value: unknown): AudioCleanupJobRow | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.user_id !== 'string' || typeof value.track_id_snapshot !== 'string') return null
  if (value.kind !== 'track_deletion' || !['pending', 'failed', 'complete'].includes(String(value.status))) return null
  if (!Array.isArray(value.storage_paths) || !value.storage_paths.every(path => typeof path === 'string')) return null
  if (!Array.isArray(value.completed_paths) || !value.completed_paths.every(path => typeof path === 'string')) return null
  return value as unknown as AudioCleanupJobRow
}

function failureMessage(data: unknown, fallback: string): string {
  return isRecord(data) && typeof data.message === 'string' ? data.message : fallback
}

function announceTrackRemoval(trackId: string, pendingCleanup: boolean): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
  window.dispatchEvent(new CustomEvent(AUDIO_TRACK_DELETED_EVENT, {
    detail: { trackId, pendingCleanup },
  }))
}

async function updateCleanupJob(
  job: AudioCleanupJobRow,
  completedPaths: string[],
  status: 'pending' | 'failed' | 'complete',
  errorMessage: string | null,
): Promise<AudioCleanupJobRow> {
  const { data, error } = await db.rpc('update_audio_cleanup_job', {
    p_cleanup_job_id: job.id,
    p_completed_paths: completedPaths,
    p_status: status,
    p_error: errorMessage,
  })
  if (error) throw new Error(`Cleanup progress could not be saved: ${error.message}`)
  const envelope = data as RpcEnvelope
  if (envelope?.status !== 'success') throw new Error(failureMessage(data, 'Cleanup progress was rejected.'))
  const updated = parseCleanupJob(envelope.cleanup_job)
  if (!updated) throw new Error('Cleanup progress returned malformed data.')
  return updated
}

async function finalizeCleanupJob(job: AudioCleanupJobRow): Promise<CanonicalAudioDeletionResult> {
  if (job.audio_track_id === null) {
    return { ok: true, trackId: job.track_id_snapshot, pendingCleanup: false, message: null }
  }
  const { data, error } = await db.rpc('finalize_audio_track_deletion', { p_cleanup_job_id: job.id })
  if (error) {
    return {
      ok: true,
      trackId: job.track_id_snapshot,
      pendingCleanup: true,
      message: `Storage was cleaned, but deletion finalization is pending: ${error.message}`,
    }
  }
  if (!isRecord(data) || data.status !== 'success') {
    return {
      ok: true,
      trackId: job.track_id_snapshot,
      pendingCleanup: true,
      message: failureMessage(data, 'Storage was cleaned, but deletion finalization is pending.'),
    }
  }
  return { ok: true, trackId: job.track_id_snapshot, pendingCleanup: false, message: null }
}

async function processCleanupJob(job: AudioCleanupJobRow): Promise<CanonicalAudioDeletionResult> {
  // A cleanup job can have every object removed while its final database delete
  // is still awaiting retry. Keep finalization recoverable without touching
  // storage a second time.
  if (job.status === 'complete') return finalizeCleanupJob(job)

  const completed = new Set(job.completed_paths)
  let lastError: string | null = null

  for (const path of job.storage_paths) {
    if (completed.has(path)) continue
    const { error } = await supabase.storage.from(AUDIO_BUCKET).remove([path])
    if (error) {
      lastError = error.message
      break
    }
    completed.add(path)
  }

  const completedPaths = [...completed]
  if (lastError) {
    await updateCleanupJob(job, completedPaths, 'failed', lastError)
    return {
      ok: true,
      trackId: job.track_id_snapshot,
      pendingCleanup: true,
      message: `Track removal is pending storage cleanup: ${lastError}`,
    }
  }

  const updated = await updateCleanupJob(job, completedPaths, 'complete', null)
  return finalizeCleanupJob(updated)
}

/**
 * The only client entry point for persisted audio deletion. The server derives
 * every exact path from owned canonical records before the browser touches
 * storage. A recorded tombstone is treated as canonical removal even if storage
 * cleanup must be retried later.
 */
export async function deleteAudioTrackCanonical(trackId: string): Promise<CanonicalAudioDeletionResult> {
  const { data, error } = await db.rpc('request_audio_track_deletion', { p_audio_track_id: trackId })
  if (error) return { ok: false, trackId, pendingCleanup: false, message: `Track deletion request failed: ${error.message}` }
  const envelope = data as RpcEnvelope
  if (envelope?.status !== 'success') {
    return { ok: false, trackId, pendingCleanup: false, message: failureMessage(data, 'Track deletion was rejected.') }
  }
  const job = parseCleanupJob(envelope.cleanup_job)
  if (!job) return { ok: false, trackId, pendingCleanup: false, message: 'Track deletion returned malformed cleanup state.' }

  // Reconcile every audio surface immediately after the canonical tombstone is
  // committed. Storage cleanup remains durable and retryable behind that state.
  announceTrackRemoval(trackId, job.status !== 'complete')
  try {
    const result = await processCleanupJob(job)
    return { ...result, trackId }
  } catch (cleanupError) {
    return {
      ok: true,
      trackId,
      pendingCleanup: true,
      message: cleanupError instanceof Error ? cleanupError.message : 'Track cleanup is pending.',
    }
  }
}

export async function retryPendingAudioCleanup(): Promise<CanonicalAudioDeletionResult[]> {
  const { data, error } = await db.rpc('list_pending_audio_cleanup')
  if (error) throw new Error(`Pending audio cleanup could not be loaded: ${error.message}`)
  if (!Array.isArray(data)) throw new Error('Pending audio cleanup returned malformed data.')
  const jobs = data.map(parseCleanupJob).filter((job): job is AudioCleanupJobRow => job !== null)
  const results: CanonicalAudioDeletionResult[] = []
  for (const job of jobs) results.push(await processCleanupJob(job))
  return results
}
