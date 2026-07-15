import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import type { LyricCueStyle } from '../../../../supabase/functions/_shared/lyricCueSegmentation'
import type {
  LyricTranscriptionJob,
  LyricTranscriptionJobRow,
} from '../../../types/lyrics'

const db = supabase as unknown as SupabaseClient
const FUNCTION_NAME = 'lyric-transcription'
const JOB_COLUMNS = [
  'id',
  'user_id',
  'audio_track_id',
  'analysis_source_id',
  'source_mode',
  'timing_offset_ms',
  'lyric_document_id',
  'provider',
  'status',
  'progress',
  'error_code',
  'error_message',
  'provider_metadata',
  'request_options',
  'created_at',
  'updated_at',
  'started_at',
  'completed_at',
].join(',')

export interface LyricExtractionOptions {
  language?: string
  timingDetail?: 'line' | 'word' | 'line+word'
  stylePreset?: string
  confidenceThreshold?: number
  globalOffsetMs?: number
  cueStyle?: LyricCueStyle
}

export type LyricTranscriptionOptions = Omit<LyricExtractionOptions, 'stylePreset'>

export interface LyricTranscriptionSourceRequest {
  sourceMode: 'full_mix' | 'vocal_reference'
  analysisSourceAudioTrackId?: string | null
  timingOffsetMs?: number
  confirmSignificantMismatch?: boolean
}

export interface LyricWordResult {
  text: string
  startSec: number
  endSec: number
  confidence: number
}

export interface LyricLineResult {
  text: string
  startSec: number
  endSec: number
  words: LyricWordResult[]
  confidence: number
  source: string
}

export interface LyricTranscriptionResult {
  lines: LyricLineResult[]
  language: string | null
  confidence: number
  source: string
  model?: string
}

interface FunctionEnvelope {
  job?: LyricTranscriptionJobRow
  duplicate?: boolean
  error?: { code?: string; message?: string }
}


export function lyricTranscriptionProviderLabel(provider: unknown): string {
  switch (provider) {
    case 'groq': return 'Groq Whisper'
    case 'openai': return 'Legacy OpenAI'
    case 'custom': return 'Custom provider'
    default: return typeof provider === 'string' && provider.trim().length > 0
      ? `Provider: ${provider}`
      : 'Unknown provider'
  }
}

export interface StartLyricTranscriptionResult {
  job: LyricTranscriptionJob
  duplicate: boolean
}

function mapJob(row: LyricTranscriptionJobRow): LyricTranscriptionJob {
  return {
    id: row.id,
    userId: row.user_id,
    audioTrackId: row.audio_track_id,
    analysisSourceId: row.analysis_source_id ?? null,
    sourceMode: row.source_mode ?? 'full_mix',
    timingOffsetMs: Number.isFinite(row.timing_offset_ms) ? Math.round(row.timing_offset_ms) : 0,
    lyricDocumentId: row.lyric_document_id,
    provider: row.provider,
    status: row.status,
    progress: Math.max(0, Math.min(1, Number(row.progress) || 0)),
    errorCode: row.error_code,
    errorMessage: row.error_message,
    providerMetadata: row.provider_metadata ?? {},
    requestOptions: row.request_options ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }
}

async function functionErrorMessage(error: unknown, data: unknown): Promise<string> {
  const envelope = data && typeof data === 'object' ? data as FunctionEnvelope : null
  if (envelope?.error?.message) return envelope.error.message
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: Response }).context
    if (context && typeof context.clone === 'function') {
      try {
        const payload = await context.clone().json() as FunctionEnvelope
        if (payload.error?.message) return payload.error.message
      } catch {
        // Relay responses are not always JSON.
      }
    }
  }
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message)
  return 'The lyric transcription service could not be reached.'
}

async function invokeJobAction(body: Record<string, unknown>): Promise<FunctionEnvelope> {
  const { data, error } = await supabase.functions.invoke<FunctionEnvelope>(FUNCTION_NAME, { body })
  if (error || data?.error) throw new Error(await functionErrorMessage(error, data))
  return data ?? {}
}

export function isActiveLyricTranscriptionJob(job: LyricTranscriptionJob | null | undefined): boolean {
  return job?.status === 'queued' || job?.status === 'processing'
}

export async function startLyricTranscription(
  audioTrackId: string,
  options: LyricTranscriptionOptions = {},
  preparationOperationId?: string,
  source: LyricTranscriptionSourceRequest = { sourceMode: 'full_mix' },
): Promise<StartLyricTranscriptionResult> {
  const payload = await invokeJobAction({
    action: 'start',
    audioTrackId,
    options,
    preparationOperationId,
    sourceMode: source.sourceMode,
    analysisSourceAudioTrackId: source.analysisSourceAudioTrackId,
    timingOffsetMs: source.timingOffsetMs,
    confirmSignificantMismatch: source.confirmSignificantMismatch === true,
  })
  if (!payload.job) throw new Error('The transcription service did not return a job.')
  return { job: mapJob(payload.job), duplicate: payload.duplicate === true }
}

export async function refreshLyricTranscriptionJob(jobId: string): Promise<LyricTranscriptionJob> {
  const payload = await invokeJobAction({ action: 'status', jobId })
  if (!payload.job) throw new Error('The transcription job is no longer available.')
  return mapJob(payload.job)
}

export async function cancelLyricTranscription(jobId: string): Promise<LyricTranscriptionJob> {
  const payload = await invokeJobAction({ action: 'cancel', jobId })
  if (!payload.job) throw new Error('The transcription job could not be cancelled.')
  return mapJob(payload.job)
}

export async function retryLyricTranscription(
  jobId: string,
  preparationOperationId?: string,
): Promise<StartLyricTranscriptionResult> {
  const payload = await invokeJobAction({ action: 'retry', jobId, preparationOperationId })
  if (!payload.job) throw new Error('The transcription job could not be retried.')
  return { job: mapJob(payload.job), duplicate: payload.duplicate === true }
}

export async function getRecentLyricTranscriptionJobs(
  audioTrackId: string,
  limit = 8,
): Promise<LyricTranscriptionJob[]> {
  const { data, error } = await db
    .from('lyric_transcription_jobs')
    .select(JOB_COLUMNS)
    .eq('audio_track_id', audioTrackId)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(20, limit)))
  if (error) throw new Error(error.message || 'Failed to load transcription jobs.')
  return ((data as unknown as LyricTranscriptionJobRow[] | null) ?? []).map(mapJob)
}

/**
 * Browser-file transcription was intentionally removed. New files must first
 * pass through the existing persisted audio-track upload workflow, after which
 * startLyricTranscription() addresses the file by audio_tracks.id.
 */
export async function extractLyricsFromAudio(): Promise<never> {
  throw new Error('Store the audio track first, then start extraction from its Lyric Manager track record.')
}

// Backward-compatible exports. Runtime lyric interpolation now lives in the
// framework-independent canonical playback resolver.
export { ActiveLyricTracker } from '../runtime/lyricPlaybackResolver'
export type { ActiveLyricState } from '../runtime/lyricPlaybackResolver'
