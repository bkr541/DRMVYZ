import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { AudioPreparationOperationRow, Json } from '../types/database'
import type { PreparedTranscriptionAudioManifest } from '../types/audio'

const db = supabase as unknown as SupabaseClient
const AUDIO_BUCKET = 'audio-tracks'

interface RpcEnvelope {
  status?: string
  message?: string
  operation?: unknown
  reconciled?: boolean
  superseded_paths?: unknown
}

export interface AudioPreparationPlan {
  trackId: string
  candidateOperationId: string
  sourceFileSize: number
  durationMs: number
  sourceSampleRate: number
  sourceChannels: number
  chunkCount: number
}

export interface AudioPreparationOperationResult {
  operation: AudioPreparationOperationRow
  reconciled: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every(item => typeof item === 'string') ? value : null
}

function numberArray(value: unknown): number[] | null {
  return Array.isArray(value) && value.every(item => Number.isInteger(item) && item >= 0)
    ? value as number[]
    : null
}

function parseOperation(value: unknown): AudioPreparationOperationRow | null {
  if (!isRecord(value)) return null
  const paths = stringArray(value.intended_paths)
  const completed = numberArray(value.cleanup_completed_indices)
  const supersededPaths = stringArray(value.superseded_paths)
  const supersededCompletedPaths = stringArray(value.superseded_completed_paths)
  if (!paths || !completed || !supersededPaths || !supersededCompletedPaths || !Array.isArray(value.uploaded_chunks)) return null
  if (typeof value.operation_id !== 'string' || typeof value.audio_track_id !== 'string') return null
  return value as unknown as AudioPreparationOperationRow
}

function rpcFailure(data: unknown, fallback: string): Error {
  return new Error(isRecord(data) && typeof data.message === 'string' ? data.message : fallback)
}

export async function beginAudioPreparation(plan: AudioPreparationPlan): Promise<AudioPreparationOperationResult> {
  const { data, error } = await db.rpc('begin_audio_preparation', {
    p_audio_track_id: plan.trackId,
    p_operation_id: plan.candidateOperationId,
    p_source_file_size: plan.sourceFileSize,
    p_duration_ms: plan.durationMs,
    p_source_sample_rate: plan.sourceSampleRate,
    p_source_channels: plan.sourceChannels,
    p_chunk_count: plan.chunkCount,
  })
  if (error) throw new Error(`Preparation planning failed: ${error.message}`)
  const envelope = data as RpcEnvelope
  if (envelope?.status !== 'success') throw rpcFailure(data, 'The preparation plan was rejected.')
  const operation = parseOperation(envelope.operation)
  if (!operation) throw new Error('The preparation service returned malformed operation state.')
  return { operation, reconciled: envelope.reconciled === true }
}

export async function markAudioPreparationChunkUploaded(
  operationId: string,
  chunkIndex: number,
  byteSize: number,
): Promise<AudioPreparationOperationRow> {
  const { data, error } = await db.rpc('mark_audio_preparation_chunk_uploaded', {
    p_operation_id: operationId,
    p_chunk_index: chunkIndex,
    p_byte_size: byteSize,
  })
  if (error) throw new Error(`Chunk reconciliation failed: ${error.message}`)
  const envelope = data as RpcEnvelope
  if (envelope?.status === 'cancelled') throw new DOMException('Audio preparation was cancelled.', 'AbortError')
  if (envelope?.status !== 'success') throw rpcFailure(data, 'The uploaded chunk could not be recorded.')
  const operation = parseOperation(envelope.operation)
  if (!operation) throw new Error('The chunk reconciliation response was malformed.')
  return operation
}

export async function finalizeAudioPreparationManifest(
  operationId: string,
  manifest: PreparedTranscriptionAudioManifest,
): Promise<{ operation: AudioPreparationOperationRow; supersededPaths: string[] }> {
  const { data, error } = await db.rpc('finalize_audio_preparation_manifest', {
    p_operation_id: operationId,
    p_manifest: manifest as unknown as Json,
  })
  if (error) throw new Error(`Manifest save failed: ${error.message}`)
  const envelope = data as RpcEnvelope
  if (envelope?.status !== 'success') throw rpcFailure(data, 'The preparation manifest was rejected.')
  const operation = parseOperation(envelope.operation)
  if (!operation) throw new Error('The manifest response was malformed.')
  return { operation, supersededPaths: stringArray(envelope.superseded_paths) ?? [] }
}

export async function recordAudioPreparationCleanup(
  operationId: string,
  completedIndices: number[],
  status: 'failed' | 'cancelled' | 'cleanup_pending',
  errorMessage: string | null,
): Promise<AudioPreparationOperationRow> {
  const { data, error } = await db.rpc('record_audio_preparation_cleanup', {
    p_operation_id: operationId,
    p_completed_indices: completedIndices,
    p_status: status,
    p_error: errorMessage,
  })
  if (error) throw new Error(`Preparation cleanup state could not be saved: ${error.message}`)
  const envelope = data as RpcEnvelope
  if (envelope?.status !== 'success') throw rpcFailure(data, 'The preparation cleanup update was rejected.')
  const operation = parseOperation(envelope.operation)
  if (!operation) throw new Error('The preparation cleanup response was malformed.')
  return operation
}

export async function recordAudioPreparationSupersededCleanup(
  operationId: string,
  completedPaths: string[],
  errorMessage: string | null,
): Promise<AudioPreparationOperationRow> {
  const { data, error } = await db.rpc('record_audio_preparation_superseded_cleanup', {
    p_operation_id: operationId,
    p_completed_paths: completedPaths,
    p_error: errorMessage,
  })
  if (error) throw new Error(`Superseded prepared-audio cleanup state could not be saved: ${error.message}`)
  const envelope = data as RpcEnvelope
  if (envelope?.status !== 'success') throw rpcFailure(data, 'The superseded prepared-audio cleanup update was rejected.')
  const operation = parseOperation(envelope.operation)
  if (!operation) throw new Error('The superseded cleanup response was malformed.')
  return operation
}

export async function preparedAudioPathExists(
  storagePath: string,
  expectedByteSize?: number,
): Promise<boolean> {
  const slash = storagePath.lastIndexOf('/')
  if (slash <= 0 || slash >= storagePath.length - 1) return false
  const folder = storagePath.slice(0, slash)
  const name = storagePath.slice(slash + 1)
  const { data, error } = await supabase.storage.from(AUDIO_BUCKET).list(folder, { search: name, limit: 10 })
  if (error) return false
  const existing = data?.find(item => item.name === name)
  if (!existing) return false
  if (expectedByteSize === undefined) return true
  return Number.isFinite(expectedByteSize)
    && expectedByteSize >= 0
    && existing.metadata?.size === expectedByteSize
}

export async function uploadPreparedAudioChunk(
  storagePath: string,
  wavBuffer: ArrayBuffer,
): Promise<{ reused: boolean }> {
  const expectedByteSize = wavBuffer.byteLength
  if (await preparedAudioPathExists(storagePath, expectedByteSize)) return { reused: true }
  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(storagePath, new Blob([wavBuffer], { type: 'audio/wav' }), {
      contentType: 'audio/wav',
      upsert: false,
    })
  if (!error) return { reused: false }
  if (
    /already exists|duplicate|conflict/i.test(error.message)
    && await preparedAudioPathExists(storagePath, expectedByteSize)
  ) {
    return { reused: true }
  }
  throw new Error(`Chunk upload failed: ${error.message}`)
}

export async function removePreparedAudioPath(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(AUDIO_BUCKET).remove([storagePath])
  if (error) throw new Error(error.message)
}

export async function getAudioPreparationOperation(operationId: string): Promise<AudioPreparationOperationRow | null> {
  const { data, error } = await db
    .from('audio_preparation_operations')
    .select('*')
    .eq('operation_id', operationId)
    .maybeSingle()
  if (error) throw new Error(`Preparation operation could not be reconciled: ${error.message}`)
  if (!data) return null
  const operation = parseOperation(data)
  if (!operation) throw new Error('Preparation reconciliation returned malformed state.')
  return operation
}


/** Best-effort startup recovery for browser-preparation assets whose immediate
 * cleanup was interrupted. RLS limits the queried operations to the current
 * account, and every removed path was originally server-derived. */
export async function retryPendingAudioPreparationCleanup(): Promise<void> {
  const { data, error } = await db
    .from('audio_preparation_operations')
    .select('*')
    .in('status', ['cleanup_pending', 'manifest_saved', 'job_created', 'complete', 'failed', 'cancelled'])
    .order('updated_at', { ascending: true })
    .limit(25)
  if (error) throw new Error(`Pending prepared-audio cleanup could not be loaded: ${error.message}`)

  for (const raw of data ?? []) {
    const operation = parseOperation(raw)
    if (!operation) continue

    if (operation.status === 'cleanup_pending') {
      const completed = new Set(operation.cleanup_completed_indices)
      let cleanupError: string | null = null
      for (let index = 0; index < operation.intended_paths.length; index += 1) {
        if (completed.has(index)) continue
        try {
          await removePreparedAudioPath(operation.intended_paths[index])
          completed.add(index)
        } catch (removeError) {
          cleanupError = removeError instanceof Error ? removeError.message : 'Prepared chunk cleanup failed.'
          break
        }
      }
      await recordAudioPreparationCleanup(
        operation.operation_id,
        [...completed].sort((a, b) => a - b),
        'failed',
        cleanupError,
      )
    }

    const supersededCompleted = new Set(operation.superseded_completed_paths)
    const supersededPending = operation.superseded_paths.filter(path => !supersededCompleted.has(path))
    if (!supersededPending.length) continue
    let supersededError: string | null = null
    for (const path of supersededPending) {
      try {
        await removePreparedAudioPath(path)
        supersededCompleted.add(path)
      } catch (removeError) {
        supersededError = removeError instanceof Error ? removeError.message : 'Superseded prepared-audio cleanup failed.'
        break
      }
    }
    await recordAudioPreparationSupersededCleanup(
      operation.operation_id,
      [...supersededCompleted].sort(),
      supersededError,
    )
  }
}
