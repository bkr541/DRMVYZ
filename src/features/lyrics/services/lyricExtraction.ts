import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
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
}

export type LyricTranscriptionOptions = Omit<LyricExtractionOptions, 'stylePreset'>

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

export interface StartLyricTranscriptionResult {
  job: LyricTranscriptionJob
  duplicate: boolean
}

function mapJob(row: LyricTranscriptionJobRow): LyricTranscriptionJob {
  return {
    id: row.id,
    userId: row.user_id,
    audioTrackId: row.audio_track_id,
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
): Promise<StartLyricTranscriptionResult> {
  const payload = await invokeJobAction({ action: 'start', audioTrackId, options })
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

export async function retryLyricTranscription(jobId: string): Promise<StartLyricTranscriptionResult> {
  const payload = await invokeJobAction({ action: 'retry', jobId })
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

// ── Active lyric tracker (runtime interpolation) ──────────────────────────────

export interface ActiveLyricState {
  activeLine:        string | null
  activeWord:        string | null
  vocalActivity:     number   // 0–1 sustained presence indicator
  phraseConfidence:  number   // 0–1
  lyricLineProgress: number   // 0–1 position within active line
  wordHit:           boolean  // true on the frame a new word starts
}

export class ActiveLyricTracker {
  private lines:             LyricLineResult[] = []
  private prevWordIdx        = -1
  private vocalActivityEma   = 0
  private lastLineIdx        = -1

  setLines(lines: LyricLineResult[]): void {
    this.lines         = [...lines].sort((a, b) => a.startSec - b.startSec)
    this.prevWordIdx   = -1
    this.lastLineIdx   = -1
    this.vocalActivityEma = 0
  }

  update(audioTimeSec: number): ActiveLyricState {
    let activeLine:        string | null = null
    let activeWord:        string | null = null
    let lyricLineProgress  = 0
    let phraseConfidence   = 0
    let wordHit            = false

    const lineIdx = this.findLineAt(audioTimeSec)

    if (lineIdx >= 0) {
      const line         = this.lines[lineIdx]
      activeLine         = line.text
      phraseConfidence   = line.confidence
      lyricLineProgress  = Math.max(0, Math.min(1,
        (audioTimeSec - line.startSec) / (line.endSec - line.startSec + 1e-10),
      ))

      // Find active word
      if (line.words.length > 0) {
        const wordIdx = line.words.findIndex(
          w => audioTimeSec >= w.startSec && audioTimeSec < w.endSec,
        )
        if (wordIdx >= 0) {
          activeWord = line.words[wordIdx].text
          wordHit    = wordIdx !== this.prevWordIdx && wordIdx > this.prevWordIdx
          this.prevWordIdx = wordIdx
        }
      }
    } else {
      this.prevWordIdx = -1
    }

    // Vocal activity EMA: 1 when a line is active, decays otherwise
    const inLine = lineIdx >= 0 ? 1 : 0
    this.vocalActivityEma = 0.05 * inLine + 0.95 * this.vocalActivityEma

    return {
      activeLine,
      activeWord,
      vocalActivity:    Math.min(1, this.vocalActivityEma * 1.5),
      phraseConfidence,
      lyricLineProgress,
      wordHit,
    }
  }

  reset(): void {
    this.prevWordIdx      = -1
    this.lastLineIdx      = -1
    this.vocalActivityEma = 0
  }

  // ── Binary search for active line ─────────────────────────────────────────

  private findLineAt(timeSec: number): number {
    const n = this.lines.length
    if (n === 0) return -1

    let lo = 0, hi = n - 1
    while (lo <= hi) {
      const mid  = (lo + hi) >> 1
      const line = this.lines[mid]
      if (timeSec >= line.startSec && timeSec < line.endSec) return mid
      if (timeSec < line.startSec) hi = mid - 1
      else lo = mid + 1
    }
    return -1
  }
}
