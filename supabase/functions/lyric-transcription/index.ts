import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  FIVE_MINUTES_MS,
  normalizeProviderTranscript,
  planTranscriptionUnits,
  reconcileTranscriptUnits,
  selectUsefulCues,
  type ProviderSegment,
  type ProviderTranscript,
  type ProviderWord,
  type TranscriptionUnitPlan,
} from '../_shared/lyricTranscriptionCore.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const AUDIO_BUCKET = 'audio-tracks'
const MAX_STORED_AUDIO_BYTES = 100 * 1024 * 1024
const DEFAULT_OPENAI_MAX_BYTES = 25 * 1024 * 1024
const DEFAULT_PROVIDER_TIMEOUT_MS = 180_000
const RAW_PROVIDER_METADATA_LIMIT = 120_000
const ACTIVE_STATUSES = ['queued', 'processing'] as const

interface AudioTrackRow {
  id: string
  user_id: string
  title: string
  artist: string | null
  file_name: string
  storage_path: string | null
  duration_sec: number | null
  file_size: number | null
  mime_type: string | null
}

interface JobRow {
  id: string
  user_id: string
  audio_track_id: string
  lyric_document_id: string | null
  provider: 'openai' | 'custom'
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  error_code: string | null
  error_message: string | null
  provider_metadata: Record<string, unknown>
  request_options: Record<string, unknown>
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
}

interface StartRequest {
  action: 'start'
  audioTrackId: string
  options?: Record<string, unknown>
}

interface JobRequest {
  action: 'status' | 'cancel' | 'retry'
  jobId: string
}

type RequestBody = StartRequest | JobRequest

interface ProviderRunResult {
  transcripts: Array<{ unit: TranscriptionUnitPlan; transcript: ProviderTranscript }>
  rawPayload: unknown
  model: string | null
}

class TranscriptionError extends Error {
  constructor(
    readonly code: string,
    readonly safeMessage: string,
    readonly httpStatus = 400,
  ) {
    super(safeMessage)
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new TranscriptionError('provider_configuration_missing', 'Automatic lyric extraction is not configured on the server.', 503)
  return value
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function positiveEnvNumber(name: string, fallback: number): number {
  const parsed = Number(Deno.env.get(name))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function safeOptions(value: unknown): Record<string, unknown> {
  const input = asRecord(value)
  const language = typeof input.language === 'string' && /^[a-z]{2,8}(-[a-z0-9]{2,8})?$/i.test(input.language)
    ? input.language
    : 'auto'
  const timingDetail = input.timingDetail === 'line' || input.timingDetail === 'word' || input.timingDetail === 'line+word'
    ? input.timingDetail
    : 'line+word'
  const threshold = finiteNumber(input.confidenceThreshold)
  const globalOffset = finiteNumber(input.globalOffsetMs)
  return {
    language,
    timingDetail,
    confidenceThreshold: threshold === null ? 0.6 : Math.max(0, Math.min(1, threshold)),
    globalOffsetMs: globalOffset === null ? 0 : Math.round(globalOffset),
  }
}

function configuredProvider(): 'openai' | 'custom' {
  return Deno.env.get('LYRIC_TRANSCRIPTION_PROVIDER')?.trim().toLowerCase() === 'custom'
    ? 'custom'
    : 'openai'
}

function publicJob(job: JobRow): JobRow {
  return {
    ...job,
    provider_metadata: asRecord(job.provider_metadata),
    request_options: safeOptions(job.request_options),
  }
}

function isSupportedAudio(track: AudioTrackRow): boolean {
  const mime = (track.mime_type ?? '').toLowerCase()
  const extension = track.file_name.split('.').pop()?.toLowerCase() ?? ''
  const allowedMimes = new Set([
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/x-flac',
    'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'application/ogg',
  ])
  const allowedExtensions = new Set(['mp3', 'wav', 'flac', 'm4a', 'mp4', 'aac', 'ogg'])
  return allowedMimes.has(mime) || allowedExtensions.has(extension)
}

async function authenticatedClients(req: Request): Promise<{
  userId: string
  userClient: SupabaseClient
  adminClient: SupabaseClient
}> {
  const supabaseUrl = requiredEnv('SUPABASE_URL')
  const anonKey = requiredEnv('SUPABASE_ANON_KEY')
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = req.headers.get('Authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) {
    throw new TranscriptionError('authorization_failure', 'Sign in before starting lyric extraction.', 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await userClient.auth.getUser()
  if (error || !data.user) {
    throw new TranscriptionError('authorization_failure', 'Your session could not be verified. Sign in again.', 401)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { userId: data.user.id, userClient, adminClient }
}

async function ownedTrack(adminClient: SupabaseClient, userId: string, audioTrackId: string): Promise<AudioTrackRow> {
  const { data, error } = await adminClient
    .from('audio_tracks')
    .select('id,user_id,title,artist,file_name,storage_path,duration_sec,file_size,mime_type')
    .eq('id', audioTrackId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new TranscriptionError('storage_failure', 'The stored track could not be checked.', 500)
  if (!data) throw new TranscriptionError('authorization_failure', 'The selected audio track is unavailable.', 403)
  return data as AudioTrackRow
}

function validateTrack(track: AudioTrackRow): void {
  if (!track.storage_path) throw new TranscriptionError('missing_stored_file', 'The selected track does not have a stored audio file.')
  if (!isSupportedAudio(track)) throw new TranscriptionError('unsupported_audio', 'This audio format is not supported for automatic lyric extraction.')
  if (track.file_size !== null && track.file_size > MAX_STORED_AUDIO_BYTES) {
    throw new TranscriptionError('unsupported_audio', 'This audio file is too large for the configured transcription workflow.')
  }
}

async function activeJob(adminClient: SupabaseClient, userId: string, audioTrackId: string): Promise<JobRow | null> {
  const { data, error } = await adminClient
    .from('lyric_transcription_jobs')
    .select('*')
    .eq('user_id', userId)
    .eq('audio_track_id', audioTrackId)
    .in('status', [...ACTIVE_STATUSES])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new TranscriptionError('database_save_failure', 'The extraction queue could not be checked.', 500)
  return data ? data as JobRow : null
}

async function createJob(
  adminClient: SupabaseClient,
  userId: string,
  track: AudioTrackRow,
  options: Record<string, unknown>,
): Promise<{ job: JobRow; duplicate: boolean }> {
  const existing = await activeJob(adminClient, userId, track.id)
  if (existing) return { job: existing, duplicate: true }

  const provider = configuredProvider()
  const { data, error } = await adminClient
    .from('lyric_transcription_jobs')
    .insert({
      user_id: userId,
      audio_track_id: track.id,
      provider,
      status: 'queued',
      progress: 0,
      request_options: options,
      provider_metadata: {},
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      const raced = await activeJob(adminClient, userId, track.id)
      if (raced) return { job: raced, duplicate: true }
    }
    throw new TranscriptionError('database_save_failure', 'The extraction job could not be created.', 500)
  }
  return { job: data as JobRow, duplicate: false }
}

async function updateJob(
  adminClient: SupabaseClient,
  jobId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await adminClient.from('lyric_transcription_jobs').update(patch).eq('id', jobId)
  if (error) console.error('[lyric-transcription] job update failed', error.code)
}

async function jobWasCancelled(adminClient: SupabaseClient, jobId: string): Promise<boolean> {
  const { data } = await adminClient
    .from('lyric_transcription_jobs')
    .select('status')
    .eq('id', jobId)
    .maybeSingle()
  return data?.status === 'cancelled'
}

function providerWords(value: unknown): ProviderWord[] {
  if (!Array.isArray(value)) return []
  return value.map(item => {
    const record = asRecord(item)
    return {
      text: String(record.word ?? record.text ?? ''),
      start: finiteNumber(record.start) ?? -1,
      end: finiteNumber(record.end) ?? -1,
      confidence: finiteNumber(record.confidence ?? record.probability),
    }
  })
}

function confidenceFromSegment(record: Record<string, unknown>): number | null {
  const direct = finiteNumber(record.confidence ?? record.probability)
  if (direct !== null) return direct
  const averageLogProbability = finiteNumber(record.avg_logprob)
  return averageLogProbability === null ? null : Math.exp(averageLogProbability)
}

function providerSegments(value: unknown): ProviderSegment[] {
  if (!Array.isArray(value)) return []
  return value.map(item => {
    const record = asRecord(item)
    return {
      text: String(record.text ?? ''),
      start: finiteNumber(record.start) ?? -1,
      end: finiteNumber(record.end) ?? -1,
      confidence: confidenceFromSegment(record),
      words: providerWords(record.words),
    }
  })
}

function providerTranscript(value: unknown): ProviderTranscript {
  const record = asRecord(value)
  return {
    text: typeof record.text === 'string' ? record.text : '',
    language: typeof record.language === 'string' ? record.language : null,
    duration: finiteNumber(record.duration),
    confidence: finiteNumber(record.confidence),
    words: providerWords(record.words),
    segments: providerSegments(record.segments),
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new TranscriptionError('provider_timeout', 'The transcription provider took too long to respond.', 504)
    }
    throw new TranscriptionError('provider_rejection', 'The transcription provider could not be reached.', 502)
  } finally {
    clearTimeout(timeout)
  }
}

function providerHttpError(response: Response): TranscriptionError {
  if (response.status === 429) return new TranscriptionError('rate_limit', 'The transcription service is busy. Try again shortly.', 429)
  if (response.status === 408 || response.status === 504) return new TranscriptionError('provider_timeout', 'The transcription provider timed out.', 504)
  if (response.status === 401 || response.status === 403) return new TranscriptionError('provider_configuration_missing', 'The server transcription credentials were rejected.', 503)
  if (response.status >= 500) return new TranscriptionError('provider_rejection', 'The transcription provider is temporarily unavailable.', 502)
  return new TranscriptionError('provider_rejection', 'The transcription provider rejected this audio file.', 422)
}

function reliableTranscriptDurationMs(transcript: ProviderTranscript, track: AudioTrackRow): number {
  const providerDurationMs = transcript.duration && transcript.duration > 0
    ? Math.round(transcript.duration * 1000)
    : 0
  const timedEndMs = Math.max(
    0,
    ...(transcript.words ?? []).map(word => Math.round(word.end * 1000)),
    ...(transcript.segments ?? []).map(segment => Math.round(segment.end * 1000)),
  )
  const storedDurationMs = track.duration_sec && track.duration_sec > 0
    ? Math.round(track.duration_sec * 1000)
    : 0
  const durationMs = Math.max(providerDurationMs, timedEndMs, storedDurationMs)
  if (durationMs <= 0) {
    throw new TranscriptionError('normalization_failure', 'The transcription provider did not return a reliable audio duration.', 422)
  }
  return durationMs
}

async function runOpenAIProvider(
  blob: Blob,
  track: AudioTrackRow,
  options: Record<string, unknown>,
): Promise<ProviderRunResult> {
  const apiKey = requiredEnv('OPENAI_API_KEY')
  const maxBytes = positiveEnvNumber('OPENAI_MAX_AUDIO_BYTES', DEFAULT_OPENAI_MAX_BYTES)
  if (blob.size > maxBytes) {
    throw new TranscriptionError(
      'unsupported_audio',
      'This stored audio file exceeds the direct provider limit. Configure the long-audio backend or upload a smaller compatible file.',
      413,
    )
  }

  const model = Deno.env.get('OPENAI_TRANSCRIPTION_MODEL')?.trim() || 'whisper-1'
  const form = new FormData()
  form.append('file', new File([blob], track.file_name, { type: track.mime_type || blob.type || 'application/octet-stream' }))
  form.append('model', model)
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'segment')
  form.append('timestamp_granularities[]', 'word')
  if (options.language !== 'auto') form.append('language', String(options.language))

  const response = await fetchWithTimeout('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!response.ok) throw providerHttpError(response)
  const payload = await response.json()
  const transcript = providerTranscript(payload)
  const durationMs = reliableTranscriptDurationMs(transcript, track)
  const unit = planTranscriptionUnits(durationMs, { forceChunking: false })[0]
    ?? { index: 0, startMs: 0, endMs: durationMs, overlapBeforeMs: 0, overlapAfterMs: 0 }
  return { transcripts: [{ unit, transcript }], rawPayload: payload, model }
}

async function runCustomProvider(
  adminClient: SupabaseClient,
  track: AudioTrackRow,
  options: Record<string, unknown>,
): Promise<ProviderRunResult> {
  const endpoint = requiredEnv('LYRIC_TRANSCRIPTION_ENDPOINT')
  const endpointToken = requiredEnv('LYRIC_TRANSCRIPTION_ENDPOINT_TOKEN')
  const durationSec = finiteNumber(track.duration_sec)
  if (durationSec === null || durationSec <= 0) {
    throw new TranscriptionError(
      'normalization_failure',
      'A verified track duration is required for the configured long-audio transcription backend.',
      422,
    )
  }
  const durationMs = Math.max(1, Math.round(durationSec * 1000))
  const maxUnitMs = positiveEnvNumber('LYRIC_TRANSCRIPTION_CHUNK_MS', 240_000)
  const overlapMs = positiveEnvNumber('LYRIC_TRANSCRIPTION_OVERLAP_MS', 4_000)
  const forceChunking = durationMs >= FIVE_MINUTES_MS && durationMs > maxUnitMs
  const units = planTranscriptionUnits(durationMs, { maxUnitMs, overlapMs, forceChunking })
  const { data: signed, error: signError } = await adminClient.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(track.storage_path!, 600)
  if (signError || !signed?.signedUrl) {
    throw new TranscriptionError('storage_failure', 'The stored audio file could not be prepared for transcription.', 500)
  }

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${endpointToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audioUrl: signed.signedUrl,
      fileName: track.file_name,
      mimeType: track.mime_type,
      durationMs,
      units,
      options,
    }),
  })
  if (!response.ok) throw providerHttpError(response)
  const payload = await response.json()
  const root = asRecord(payload)
  const responseUnits = Array.isArray(root.units) ? root.units : []

  if (responseUnits.length === 0) {
    return {
      transcripts: [{ unit: units[0], transcript: providerTranscript(root.transcript ?? root) }],
      rawPayload: payload,
      model: typeof root.model === 'string' ? root.model : null,
    }
  }

  const transcripts = responseUnits.map((item, index) => {
    const record = asRecord(item)
    const requestedUnit = units.find(unit => unit.index === finiteNumber(record.index)) ?? units[index]
    if (!requestedUnit) throw new TranscriptionError('normalization_failure', 'The long-audio provider returned an unexpected chunk.')
    const absolute = record.timestampsAreAbsolute === true || record.timestamps_are_absolute === true
    const transcript = providerTranscript(record.transcript ?? record)
    const unit = absolute ? { ...requestedUnit, timestampOffsetMs: 0 } : requestedUnit
    if (absolute) transcript.duration = undefined
    return { unit, transcript }
  })
  return {
    transcripts,
    rawPayload: payload,
    model: typeof root.model === 'string' ? root.model : null,
  }
}

function boundedProviderMetadata(value: unknown): Record<string, unknown> {
  let serialized = ''
  try {
    serialized = JSON.stringify(value, (key, item) => {
      const lower = key.toLowerCase()
      if (lower.includes('key') || lower.includes('token') || lower.includes('authorization') || lower.includes('url')) return '[redacted]'
      return item
    })
  } catch {
    return { rawResponseRetained: false }
  }
  if (serialized.length > RAW_PROVIDER_METADATA_LIMIT) serialized = serialized.slice(0, RAW_PROVIDER_METADATA_LIMIT)
  return { rawResponseRetained: true, rawResponsePreview: serialized }
}

function databaseCue(cue: ReturnType<typeof selectUsefulCues>[number], index: number, confidenceThreshold: number) {
  const warnings = new Set(cue.warnings ?? [])
  if (cue.confidence !== undefined && cue.confidence < confidenceThreshold) warnings.add('low_confidence')
  warnings.add('needs_review')
  return {
    start_ms: Math.max(0, Math.round(cue.startMs)),
    end_ms: Math.max(1, Math.round(cue.endMs)),
    text: cue.text,
    style: {},
    animation: {},
    effects: {},
    words: cue.words ?? [],
    groups: [],
    sort_order: index,
    confidence: cue.confidence ?? null,
    source: 'transcription',
    review_status: 'unreviewed',
    section_id: null,
    section_type: null,
    warnings: [...warnings],
    analysis_metadata: cue.analysisMetadata ?? {},
    original_transcription_text: cue.originalTranscriptionText,
  }
}

async function processJob(
  adminClient: SupabaseClient,
  userClient: SupabaseClient,
  job: JobRow,
  track: AudioTrackRow,
): Promise<void> {
  try {
    validateTrack(track)
    await updateJob(adminClient, job.id, {
      status: 'processing',
      progress: 0.05,
      started_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
    })

    if (await jobWasCancelled(adminClient, job.id)) return
    let providerResult: ProviderRunResult
    if (job.provider === 'custom') {
      await updateJob(adminClient, job.id, { progress: 0.2 })
      providerResult = await runCustomProvider(adminClient, track, job.request_options)
    } else {
      const { data: audioBlob, error: downloadError } = await adminClient.storage
        .from(AUDIO_BUCKET)
        .download(track.storage_path!)
      if (downloadError || !audioBlob) throw new TranscriptionError('storage_failure', 'The stored audio file could not be read.', 500)
      if (audioBlob.size > MAX_STORED_AUDIO_BYTES) throw new TranscriptionError('unsupported_audio', 'This audio file is too large for automatic lyric extraction.', 413)
      await updateJob(adminClient, job.id, { progress: 0.2 })
      providerResult = await runOpenAIProvider(audioBlob, track, job.request_options)
    }
    if (await jobWasCancelled(adminClient, job.id)) return
    await updateJob(adminClient, job.id, { progress: 0.72 })

    const confidenceThreshold = finiteNumber(job.request_options.confidenceThreshold) ?? 0.6
    const normalizedUnits = providerResult.transcripts.map(({ unit, transcript }) =>
      normalizeProviderTranscript(transcript, unit, confidenceThreshold))
    const reconciled = reconcileTranscriptUnits(normalizedUnits)
    const cues = selectUsefulCues(reconciled)
    if (!cues.length) throw new TranscriptionError('normalization_failure', 'No reliably timed lyric cues were returned for this track.', 422)

    const dbCues = cues
      .filter(cue => cue.endMs > cue.startMs && cue.text.trim())
      .map((cue, index) => databaseCue(cue, index, confidenceThreshold))
    if (!dbCues.length) throw new TranscriptionError('normalization_failure', 'The provider response did not contain usable timed lyrics.', 422)
    await updateJob(adminClient, job.id, { progress: 0.9 })

    const metadata = {
      extractionJobId: job.id,
      provider: job.provider,
      model: providerResult.model,
      language: reconciled.language,
      confidence: reconciled.confidence,
      durationMs: reconciled.durationMs,
      warnings: reconciled.warnings,
      reviewStatus: 'unreviewed',
      generatedAt: new Date().toISOString(),
      cueCount: dbCues.length,
    }
    const documentPayload = {
      audio_track_id: track.id,
      visual_session_id: null,
      title: `${track.title} AI Draft`,
      artist: track.artist ?? '',
      source_type: 'ai_transcription',
      source_format: 'json',
      raw_source_text: reconciled.rawText || null,
      default_style: {},
      default_animation: {},
      default_effects: {},
      global_offset_ms: finiteNumber(job.request_options.globalOffsetMs) ?? 0,
      metadata,
    }
    const providerMetadata = {
      provider: job.provider,
      model: providerResult.model,
      unitCount: providerResult.transcripts.length,
      usedSingleUnit: providerResult.transcripts.length === 1,
      durationMs: reconciled.durationMs,
      warnings: reconciled.warnings,
      ...boundedProviderMetadata(providerResult.rawPayload),
    }

    if (await jobWasCancelled(adminClient, job.id)) return
    const { data, error } = await userClient.rpc('complete_lyric_transcription_job', {
      p_job_id: job.id,
      p_document: documentPayload,
      p_cues: dbCues,
      p_provider_metadata: providerMetadata,
    })
    if (error) throw new TranscriptionError('database_save_failure', 'The extracted lyric draft could not be saved.', 500)
    const completion = asRecord(data)
    if (completion.status === 'cancelled') return
    if (completion.status !== 'success') {
      const code = completion.status === 'authorization_failure' ? 'authorization_failure' : 'database_save_failure'
      throw new TranscriptionError(code, 'The extracted lyric draft could not be saved.', 500)
    }
  } catch (error) {
    const failure = error instanceof TranscriptionError
      ? error
      : new TranscriptionError('provider_rejection', 'Automatic lyric extraction failed unexpectedly.', 500)
    if (await jobWasCancelled(adminClient, job.id)) return
    console.error('[lyric-transcription] job failed', job.id, failure.code)
    await updateJob(adminClient, job.id, {
      status: 'failed',
      error_code: failure.code,
      error_message: failure.safeMessage,
      completed_at: new Date().toISOString(),
    })
  }
}

async function findOwnedJob(adminClient: SupabaseClient, userId: string, jobId: string): Promise<JobRow> {
  const { data, error } = await adminClient
    .from('lyric_transcription_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new TranscriptionError('database_save_failure', 'The extraction job could not be read.', 500)
  if (!data) throw new TranscriptionError('authorization_failure', 'The extraction job is unavailable.', 403)
  return data as JobRow
}

function runInBackground(task: Promise<void>): void {
  const runtime = (globalThis as typeof globalThis & { EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void } }).EdgeRuntime
  if (runtime?.waitUntil) runtime.waitUntil(task)
  else void task
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: { code: 'method_not_allowed', message: 'Use POST for lyric transcription requests.' } }, 405)

  try {
    const { userId, userClient, adminClient } = await authenticatedClients(req)
    const body = await req.json() as RequestBody
    if (!body || typeof body !== 'object' || typeof body.action !== 'string') {
      throw new TranscriptionError('invalid_request', 'The transcription request is invalid.')
    }

    if (body.action === 'start') {
      if (typeof body.audioTrackId !== 'string' || !body.audioTrackId) throw new TranscriptionError('invalid_request', 'Select a stored audio track first.')
      const track = await ownedTrack(adminClient, userId, body.audioTrackId)
      validateTrack(track)
      const created = await createJob(adminClient, userId, track, safeOptions(body.options))
      if (!created.duplicate) runInBackground(processJob(adminClient, userClient, created.job, track))
      return json({ job: publicJob(created.job), duplicate: created.duplicate }, created.duplicate ? 200 : 202)
    }

    if (typeof body.jobId !== 'string' || !body.jobId) throw new TranscriptionError('invalid_request', 'A transcription job is required.')
    const job = await findOwnedJob(adminClient, userId, body.jobId)

    if (body.action === 'status') return json({ job: publicJob(job) })

    if (body.action === 'cancel') {
      if (job.status === 'queued' || job.status === 'processing') {
        await updateJob(adminClient, job.id, {
          status: 'cancelled',
          error_code: 'cancelled',
          error_message: 'Transcription was cancelled.',
          completed_at: new Date().toISOString(),
        })
      }
      return json({ job: publicJob(await findOwnedJob(adminClient, userId, job.id)) })
    }

    if (body.action === 'retry') {
      if (job.status !== 'failed' && job.status !== 'cancelled') {
        throw new TranscriptionError('invalid_request', 'Only a failed or cancelled transcription can be retried.', 409)
      }
      const track = await ownedTrack(adminClient, userId, job.audio_track_id)
      validateTrack(track)
      const created = await createJob(adminClient, userId, track, safeOptions(job.request_options))
      if (!created.duplicate) runInBackground(processJob(adminClient, userClient, created.job, track))
      return json({ job: publicJob(created.job), duplicate: created.duplicate }, created.duplicate ? 200 : 202)
    }

    throw new TranscriptionError('invalid_request', 'The requested transcription action is not supported.')
  } catch (error) {
    const failure = error instanceof TranscriptionError
      ? error
      : new TranscriptionError('invalid_request', 'The transcription request could not be completed.', 500)
    console.error('[lyric-transcription] request failed', failure.code)
    return json({ error: { code: failure.code, message: failure.safeMessage } }, failure.httpStatus)
  }
})
