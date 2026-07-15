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
import { normalizeLyricCueStyle, segmentationProvenance, type MusicalSegmentationStructure } from '../_shared/lyricCueSegmentation.ts'
import {
  assessVocalReferenceCompatibility,
  normalizeVocalReferenceOffsetMs,
  shiftReconciledTranscriptToOwnerTimeline,
  type LyricExtractionSourceMode,
  type VocalReferenceCompatibility,
} from '../_shared/vocalReference.ts'
import {
  buildWavTranscriptionChunk,
  isRiffWave,
  planWavTranscriptionChunks,
  WavChunkingError,
  type WavChunkDescriptor,
  type WavChunkPlan,
} from '../_shared/wavAudioChunking.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const AUDIO_BUCKET = 'audio-tracks'
const MAX_STORED_AUDIO_BYTES = 500 * 1024 * 1024
const MAX_SERVER_DOWNLOAD_BYTES = 100 * 1024 * 1024
const DEFAULT_GROQ_MAX_BYTES = 25 * 1024 * 1024
const DEFAULT_GROQ_SAFE_AUDIO_BYTES = 23 * 1024 * 1024
const DEFAULT_GROQ_CHUNK_SAFETY_BYTES = 256 * 1024
const DEFAULT_GROQ_CHUNK_OVERLAP_MS = 4_000
const DEFAULT_GROQ_CHUNK_CONCURRENCY = 1
const DEFAULT_GROQ_PROVIDER_TIMEOUT_MS = 180_000
const DEFAULT_GROQ_TRANSCRIPTION_MODEL = 'whisper-large-v3-turbo'
const DEFAULT_PROVIDER_TIMEOUT_MS = 180_000
const GROQ_TRANSCRIPTION_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions'

type LyricTranscriptionProviderName = 'groq' | 'openai' | 'custom'
type RuntimeTranscriptionProviderName = 'groq' | 'custom'
const RAW_PROVIDER_METADATA_LIMIT = 120_000
const ACTIVE_STATUSES = ['queued', 'processing'] as const

// Increment this whenever a behaviorally significant change is deployed so clients
// can detect stale deployments from job.providerMetadata.fnVersion.
const LYRIC_TRANSCRIPTION_FN_VERSION = '4.0.0'
const PREPARED_AUDIO_VERSION = 'browser-pcm16-v2'
const MAX_PREPARED_AUDIO_CHUNKS = 64

type ProcessingMode = 'direct' | 'wav-chunking' | 'prepared-audio' | 'long-audio-worker'

interface AudioTrackRow {
  id: string
  user_id: string
  title: string
  artist: string | null
  file_name: string
  storage_path: string | null
  duration_sec: number | null
  sample_rate: number | null
  channels: number | null
  file_size: number | null
  mime_type: string | null
  transcription_assets: unknown
  lifecycle_status: 'complete' | 'deletion_pending'
}


interface PreparedAudioChunk {
  index: number
  storagePath: string
  fileName: string
  mimeType: 'audio/wav'
  byteSize: number
  startMs: number
  endMs: number
  overlapBeforeMs: number
  overlapAfterMs: number
}

interface PreparedAudioManifest {
  version: string
  operationId?: string
  preparedAt: string
  sourceFileSize: number
  sourceMimeType: string | null
  durationMs: number
  sampleRate: number
  channels: number
  bitsPerSample: number
  chunks: PreparedAudioChunk[]
}

interface AnalysisSourceRow {
  id: string
  user_id: string
  owner_audio_track_id: string
  source_audio_track_id: string
  source_type: 'vocal_reference'
  timing_offset_ms: number
  owner_duration_ms: number | null
  source_duration_ms: number | null
  source_metadata: Record<string, unknown>
  preparation_operation_id: string | null
  preparation_metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface ResolvedAnalysisSource {
  mode: LyricExtractionSourceMode
  ownerTrack: AudioTrackRow
  sourceTrack: AudioTrackRow
  relationship: AnalysisSourceRow | null
  timingOffsetMs: number
  compatibility: VocalReferenceCompatibility | null
}

interface JobRow {
  id: string
  user_id: string
  audio_track_id: string
  analysis_source_id: string | null
  source_mode: LyricExtractionSourceMode
  timing_offset_ms: number
  lyric_document_id: string | null
  provider: LyricTranscriptionProviderName
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
  preparationOperationId?: string
  sourceMode?: LyricExtractionSourceMode
  analysisSourceAudioTrackId?: string
  timingOffsetMs?: number
  confirmSignificantMismatch?: boolean
}

interface JobRequest {
  action: 'status' | 'cancel' | 'retry'
  jobId: string
  preparationOperationId?: string
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

function positiveEnvInteger(name: string, fallback: number, max: number): number {
  return Math.max(1, Math.min(max, Math.floor(positiveEnvNumber(name, fallback))))
}

function groqSafeAudioBytes(): number {
  const documentedMax = positiveEnvNumber('GROQ_MAX_AUDIO_BYTES', DEFAULT_GROQ_MAX_BYTES)
  const configuredSafe = positiveEnvNumber('GROQ_SAFE_AUDIO_BYTES', DEFAULT_GROQ_SAFE_AUDIO_BYTES)
  return Math.max(1024 * 1024, Math.min(configuredSafe, documentedMax - 256 * 1024))
}


function groqDocumentedMaxAudioBytes(): number {
  return positiveEnvNumber('GROQ_MAX_AUDIO_BYTES', DEFAULT_GROQ_MAX_BYTES)
}

function groqChunkSafetyBytes(maxBytes: number): number {
  const configuredSafety = positiveEnvNumber('GROQ_CHUNK_SAFETY_BYTES', DEFAULT_GROQ_CHUNK_SAFETY_BYTES)
  return Math.min(configuredSafety, Math.max(1, Math.floor(maxBytes / 8)))
}

function groqTranscriptionOverlapMs(): number {
  return positiveEnvNumber('GROQ_TRANSCRIPTION_OVERLAP_MS', DEFAULT_GROQ_CHUNK_OVERLAP_MS)
}

function groqTranscriptionConcurrency(): number {
  return positiveEnvInteger('GROQ_TRANSCRIPTION_CONCURRENCY', DEFAULT_GROQ_CHUNK_CONCURRENCY, 4)
}

function groqProviderTimeoutMs(): number {
  return positiveEnvNumber('GROQ_PROVIDER_TIMEOUT_MS', DEFAULT_GROQ_PROVIDER_TIMEOUT_MS)
}

function runtimeProviderForJob(provider: LyricTranscriptionProviderName): RuntimeTranscriptionProviderName {
  return provider === 'custom' ? 'custom' : 'groq'
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
  const sourceMode: LyricExtractionSourceMode = input.sourceMode === 'vocal_reference' ? 'vocal_reference' : 'full_mix'
  const sourceAudioTrackId = typeof input.analysisSourceAudioTrackId === 'string' && input.analysisSourceAudioTrackId.length <= 64
    ? input.analysisSourceAudioTrackId
    : null
  const analysisSourceId = typeof input.analysisSourceId === 'string' && input.analysisSourceId.length <= 64
    ? input.analysisSourceId
    : null
  const preparationOperationId = typeof input.preparationOperationId === 'string' && input.preparationOperationId.length <= 64
    ? input.preparationOperationId
    : null
  const preparationAudioTrackId = typeof input.preparationAudioTrackId === 'string' && input.preparationAudioTrackId.length <= 64
    ? input.preparationAudioTrackId
    : null
  const compatibilityStatus = typeof input.compatibilityStatus === 'string' && input.compatibilityStatus.length <= 64
    ? input.compatibilityStatus
    : null
  return {
    language,
    timingDetail,
    confidenceThreshold: threshold === null ? 0.6 : Math.max(0, Math.min(1, threshold)),
    globalOffsetMs: globalOffset === null ? 0 : Math.round(globalOffset),
    cueStyle: normalizeLyricCueStyle(input.cueStyle),
    sourceMode,
    analysisSourceAudioTrackId: sourceAudioTrackId,
    analysisSourceId,
    timingOffsetMs: sourceMode === 'vocal_reference' ? normalizeVocalReferenceOffsetMs(input.timingOffsetMs) : 0,
    confirmSignificantMismatch: input.confirmSignificantMismatch === true,
    compatibilityStatus,
    preparationOperationId,
    preparationAudioTrackId,
  }
}

function configuredProvider(): 'groq' {
  // Groq is the canonical provider for all newly created jobs.
  // Historical OpenAI rows stay readable, but retries and resumed execution run through Groq.
  return 'groq'
}

function isCustomProviderConfigured(): boolean {
  return Boolean(
    Deno.env.get('LYRIC_TRANSCRIPTION_ENDPOINT')?.trim() &&
    Deno.env.get('LYRIC_TRANSCRIPTION_ENDPOINT_TOKEN')?.trim(),
  )
}

function isLikelyWavFile(track: AudioTrackRow): boolean {
  const mime = (track.mime_type ?? '').toLowerCase()
  const ext = track.file_name.split('.').pop()?.toLowerCase() ?? ''
  return mime.includes('wav') || ext === 'wav'
}


function preparedAudioManifest(
  track: AudioTrackRow,
  maxChunkBytes: number,
  expectedOperationId?: string | null,
): PreparedAudioManifest | null {
  const root = asRecord(track.transcription_assets)
  if ((root.version !== 'browser-pcm16-v1' && root.version !== PREPARED_AUDIO_VERSION) || !Array.isArray(root.chunks)) return null
  const operationId = typeof root.operationId === 'string' ? root.operationId : undefined
  // Ledger-backed v2 assets are only consumable by the job that supplied and
  // validated their operation identity. Legacy v1 manifests remain readable
  // for backward compatibility, but cannot gain v2 cancellation semantics.
  if (root.version === PREPARED_AUDIO_VERSION && (!operationId || !expectedOperationId)) return null
  if (expectedOperationId && operationId !== expectedOperationId) return null
  if (root.chunks.length < 1 || root.chunks.length > MAX_PREPARED_AUDIO_CHUNKS) return null

  const durationMs = finiteNumber(root.durationMs)
  const sourceFileSize = finiteNumber(root.sourceFileSize)
  if (durationMs === null || durationMs <= 0 || sourceFileSize === null || sourceFileSize <= 0) return null
  if (track.file_size && sourceFileSize !== track.file_size) return null
  if (root.sampleRate !== 16_000 || root.channels !== 1 || root.bitsPerSample !== 16) return null
  if (typeof root.preparedAt !== 'string' || !root.preparedAt) return null
  if (root.sourceMimeType !== null && typeof root.sourceMimeType !== 'string') return null

  const chunks: PreparedAudioChunk[] = []
  const seenPaths = new Set<string>()
  let previousStart = -1
  for (let index = 0; index < root.chunks.length; index += 1) {
    const item = asRecord(root.chunks[index])
    const byteSize = finiteNumber(item.byteSize)
    const startMs = finiteNumber(item.startMs)
    const endMs = finiteNumber(item.endMs)
    const overlapBeforeMs = finiteNumber(item.overlapBeforeMs)
    const overlapAfterMs = finiteNumber(item.overlapAfterMs)
    const storagePath = typeof item.storagePath === 'string' ? item.storagePath : ''
    const fileName = typeof item.fileName === 'string' ? item.fileName : ''
    if (item.index !== index || item.mimeType !== 'audio/wav') return null
    if (!storagePath || storagePath.includes('..') || !storagePath.startsWith(`${track.user_id}/`) || seenPaths.has(storagePath)) return null
    if (!fileName.toLowerCase().endsWith('.wav')) return null
    if (byteSize === null || byteSize <= 44 || byteSize > maxChunkBytes) return null
    if (startMs === null || endMs === null || startMs < 0 || endMs <= startMs || startMs < previousStart) return null
    if (overlapBeforeMs === null || overlapAfterMs === null || overlapBeforeMs < 0 || overlapAfterMs < 0) return null
    if (endMs > durationMs + 1_000) return null
    seenPaths.add(storagePath)
    previousStart = startMs
    chunks.push({
      index,
      storagePath,
      fileName,
      mimeType: 'audio/wav',
      byteSize,
      startMs: Math.round(startMs),
      endMs: Math.round(endMs),
      overlapBeforeMs: Math.round(overlapBeforeMs),
      overlapAfterMs: Math.round(overlapAfterMs),
    })
  }

  return {
    version: root.version as string,
    operationId,
    preparedAt: root.preparedAt,
    sourceFileSize,
    sourceMimeType: root.sourceMimeType as string | null,
    durationMs: Math.round(durationMs),
    sampleRate: 16_000,
    channels: 1,
    bitsPerSample: 16,
    chunks,
  }
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
    .select('id,user_id,title,artist,file_name,storage_path,duration_sec,sample_rate,channels,file_size,mime_type,transcription_assets,lifecycle_status')
    .eq('id', audioTrackId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new TranscriptionError('storage_failure', 'The stored track could not be checked.', 500)
  if (!data) throw new TranscriptionError('authorization_failure', 'The selected audio track is unavailable.', 403)
  return data as AudioTrackRow
}

function validateTrack(track: AudioTrackRow): void {
  if (track.lifecycle_status !== 'complete') throw new TranscriptionError('track_deletion_pending', 'This track is being deleted and cannot start new transcription work.', 409)
  if (!track.storage_path) throw new TranscriptionError('missing_stored_file', 'The selected track does not have a stored audio file.')
  if (!isSupportedAudio(track)) throw new TranscriptionError('unsupported_audio', 'This audio format is not supported for automatic lyric extraction.')
  if (track.file_size !== null && track.file_size > MAX_STORED_AUDIO_BYTES) {
    throw new TranscriptionError('unsupported_audio', 'This audio file is too large for the configured transcription workflow.')
  }
}

function preparedAudioSummary(track: AudioTrackRow, expectedOperationId?: string | null): Record<string, unknown> {
  const manifest = preparedAudioManifest(track, groqSafeAudioBytes(), expectedOperationId)
  if (!manifest) return {}
  return {
    version: manifest.version,
    operationId: manifest.operationId ?? null,
    preparedAt: manifest.preparedAt,
    durationMs: manifest.durationMs,
    sampleRate: manifest.sampleRate,
    channels: manifest.channels,
    chunkCount: manifest.chunks.length,
  }
}

async function upsertVocalReference(
  adminClient: SupabaseClient,
  userId: string,
  ownerTrack: AudioTrackRow,
  sourceTrack: AudioTrackRow,
  timingOffsetMs: number,
  compatibility: VocalReferenceCompatibility,
  preparationOperationId?: string | null,
): Promise<AnalysisSourceRow> {
  const payload = {
    user_id: userId,
    owner_audio_track_id: ownerTrack.id,
    source_audio_track_id: sourceTrack.id,
    source_type: 'vocal_reference',
    timing_offset_ms: timingOffsetMs,
    owner_duration_ms: ownerTrack.duration_sec && ownerTrack.duration_sec > 0 ? Math.round(ownerTrack.duration_sec * 1000) : null,
    source_duration_ms: sourceTrack.duration_sec && sourceTrack.duration_sec > 0 ? Math.round(sourceTrack.duration_sec * 1000) : null,
    source_metadata: {
      title: sourceTrack.title,
      artist: sourceTrack.artist,
      fileName: sourceTrack.file_name,
      mimeType: sourceTrack.mime_type,
      sampleRate: sourceTrack.sample_rate,
      channels: sourceTrack.channels,
      compatibilityStatus: compatibility.status,
      durationDifferenceMs: compatibility.durationDifferenceMs,
      confirmationRequired: compatibility.requiresConfirmation,
    },
    preparation_operation_id: preparationOperationId ?? null,
    preparation_metadata: preparedAudioSummary(sourceTrack, preparationOperationId),
  }
  const { data, error } = await adminClient
    .from('audio_analysis_sources')
    .upsert(payload, { onConflict: 'user_id,owner_audio_track_id,source_audio_track_id,source_type' })
    .select('*')
    .single()
  if (error || !data) {
    console.error('[lyric-transcription] analysis source save failed', error?.code)
    throw new TranscriptionError('database_save_failure', 'The vocal reference relationship could not be saved.', 500)
  }
  return data as AnalysisSourceRow
}

async function resolveStartAnalysisSource(
  adminClient: SupabaseClient,
  userId: string,
  ownerTrack: AudioTrackRow,
  request: StartRequest,
): Promise<ResolvedAnalysisSource> {
  const mode: LyricExtractionSourceMode = request.sourceMode === 'vocal_reference' ? 'vocal_reference' : 'full_mix'
  if (mode === 'full_mix') {
    return {
      mode,
      ownerTrack,
      sourceTrack: ownerTrack,
      relationship: null,
      timingOffsetMs: 0,
      compatibility: null,
    }
  }

  if (typeof request.analysisSourceAudioTrackId !== 'string' || !request.analysisSourceAudioTrackId) {
    throw new TranscriptionError('invalid_request', 'Choose a saved vocal reference before starting extraction.')
  }
  if (request.analysisSourceAudioTrackId === ownerTrack.id) {
    throw new TranscriptionError('invalid_request', 'The vocal reference must be a different saved track from the canonical full mix.')
  }

  const sourceTrack = await ownedTrack(adminClient, userId, request.analysisSourceAudioTrackId)
  validateTrack(sourceTrack)
  const timingOffsetMs = normalizeVocalReferenceOffsetMs(request.timingOffsetMs)
  const compatibility = assessVocalReferenceCompatibility(ownerTrack.duration_sec, sourceTrack.duration_sec, timingOffsetMs)
  if (compatibility.blocked) {
    throw new TranscriptionError('analysis_source_arrangement_mismatch', compatibility.reason, 422)
  }
  if (compatibility.requiresConfirmation && request.confirmSignificantMismatch !== true) {
    throw new TranscriptionError('analysis_source_confirmation_required', compatibility.reason, 409)
  }

  const relationship = await upsertVocalReference(
    adminClient,
    userId,
    ownerTrack,
    sourceTrack,
    timingOffsetMs,
    compatibility,
    null,
  )
  return { mode, ownerTrack, sourceTrack, relationship, timingOffsetMs, compatibility }
}

async function resolveRetryAnalysisSource(
  adminClient: SupabaseClient,
  userId: string,
  ownerTrack: AudioTrackRow,
  job: JobRow,
): Promise<ResolvedAnalysisSource> {
  if (job.source_mode !== 'vocal_reference') {
    return {
      mode: 'full_mix',
      ownerTrack,
      sourceTrack: ownerTrack,
      relationship: null,
      timingOffsetMs: 0,
      compatibility: null,
    }
  }
  if (!job.analysis_source_id) {
    throw new TranscriptionError('analysis_source_missing', 'The vocal reference used by this job is no longer available.', 409)
  }
  const { data, error } = await adminClient
    .from('audio_analysis_sources')
    .select('*')
    .eq('id', job.analysis_source_id)
    .eq('user_id', userId)
    .eq('owner_audio_track_id', ownerTrack.id)
    .eq('source_type', 'vocal_reference')
    .maybeSingle()
  if (error) throw new TranscriptionError('database_save_failure', 'The vocal reference could not be checked.', 500)
  if (!data) throw new TranscriptionError('analysis_source_missing', 'The vocal reference used by this job is no longer available.', 409)

  const relationship = data as AnalysisSourceRow
  const sourceTrack = await ownedTrack(adminClient, userId, relationship.source_audio_track_id)
  validateTrack(sourceTrack)
  // Jobs retain the immutable offset that was selected when they were created.
  // A later extraction may update the reusable relationship without changing
  // the provenance or retry behavior of this historical job.
  const timingOffsetMs = normalizeVocalReferenceOffsetMs(job.timing_offset_ms)
  const compatibility = assessVocalReferenceCompatibility(ownerTrack.duration_sec, sourceTrack.duration_sec, timingOffsetMs)
  if (compatibility.blocked) throw new TranscriptionError('analysis_source_arrangement_mismatch', compatibility.reason, 422)

  return { mode: 'vocal_reference', ownerTrack, sourceTrack, relationship, timingOffsetMs, compatibility }
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
  resolvedSource: ResolvedAnalysisSource,
  options: Record<string, unknown>,
  preparationOperationId?: string | null,
): Promise<{ job: JobRow; duplicate: boolean }> {
  const existing = await activeJob(adminClient, userId, resolvedSource.ownerTrack.id)
  if (existing) return { job: existing, duplicate: true }

  const provider = configuredProvider()
  const requestOptions = {
    ...options,
    sourceMode: resolvedSource.mode,
    analysisSourceAudioTrackId: resolvedSource.mode === 'vocal_reference' ? resolvedSource.sourceTrack.id : null,
    analysisSourceId: resolvedSource.relationship?.id ?? null,
    timingOffsetMs: resolvedSource.timingOffsetMs,
    compatibilityStatus: resolvedSource.compatibility?.status ?? null,
    significantMismatchConfirmed: resolvedSource.compatibility?.requiresConfirmation ? true : false,
    preparationOperationId: preparationOperationId ?? null,
    preparationAudioTrackId: resolvedSource.sourceTrack.id,
  }
  const { data, error } = await adminClient
    .from('lyric_transcription_jobs')
    .insert({
      user_id: userId,
      audio_track_id: resolvedSource.ownerTrack.id,
      analysis_source_id: resolvedSource.relationship?.id ?? null,
      source_mode: resolvedSource.mode,
      timing_offset_ms: resolvedSource.timingOffsetMs,
      provider,
      status: 'queued',
      progress: 0,
      request_options: requestOptions,
      provider_metadata: {
        sourceMode: resolvedSource.mode,
        ownerAudioTrackId: resolvedSource.ownerTrack.id,
        sourceAudioTrackId: resolvedSource.sourceTrack.id,
        analysisSourceId: resolvedSource.relationship?.id ?? null,
      },
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      const raced = await activeJob(adminClient, userId, resolvedSource.ownerTrack.id)
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
  let query = adminClient.from('lyric_transcription_jobs').update(patch).eq('id', jobId)
  if (patch.status === 'processing') query = query.eq('status', 'queued')
  else if (patch.status === 'cancelled' || patch.status === 'failed') query = query.in('status', [...ACTIVE_STATUSES])
  else if (!('status' in patch)) query = query.in('status', [...ACTIVE_STATUSES])
  const { error } = await query
  if (error) console.error('[lyric-transcription] job update failed', error.code)
}

async function throwIfJobCancelled(adminClient: SupabaseClient, jobId: string): Promise<void> {
  if (await jobWasCancelled(adminClient, jobId)) {
    throw new TranscriptionError('cancelled', 'Transcription was cancelled.', 409)
  }
}

async function jobWasCancelled(adminClient: SupabaseClient, jobId: string): Promise<boolean> {
  const { data } = await adminClient
    .from('lyric_transcription_jobs')
    .select('status,audio_track_id,analysis_source_id,source_mode')
    .eq('id', jobId)
    .maybeSingle()
  if (!data || !ACTIVE_STATUSES.includes(data.status as typeof ACTIVE_STATUSES[number])) return true

  const { data: ownerTrack } = await adminClient
    .from('audio_tracks')
    .select('lifecycle_status')
    .eq('id', data.audio_track_id)
    .maybeSingle()
  if (!ownerTrack || ownerTrack.lifecycle_status !== 'complete') return true
  if (data.source_mode !== 'vocal_reference') return false
  if (!data.analysis_source_id) return true

  const { data: source } = await adminClient
    .from('audio_analysis_sources')
    .select('source_audio_track_id')
    .eq('id', data.analysis_source_id)
    .eq('owner_audio_track_id', data.audio_track_id)
    .maybeSingle()
  if (!source) return true
  const { data: sourceTrack } = await adminClient
    .from('audio_tracks')
    .select('lifecycle_status')
    .eq('id', source.source_audio_track_id)
    .maybeSingle()
  return !sourceTrack || sourceTrack.lifecycle_status !== 'complete'
}

interface PreparationOperationRow {
  operation_id: string
  user_id: string
  audio_track_id: string
  intended_chunk_count: number
  intended_paths: string[]
  cleanup_completed_indices: number[]
  manifest_saved: boolean
  job_id: string | null
  status: string
}

async function validatePreparationOperation(
  adminClient: SupabaseClient,
  userId: string,
  track: AudioTrackRow,
  operationId: string | undefined,
): Promise<PreparationOperationRow | null> {
  if (!operationId) return null
  const manifest = preparedAudioManifest(track, groqSafeAudioBytes(), operationId)
  if (!manifest || manifest.operationId !== operationId) {
    throw new TranscriptionError('prepared_audio_invalid', 'The prepared transcription manifest is stale or incomplete. Retry audio preparation.', 409)
  }
  const { data, error } = await adminClient
    .from('audio_preparation_operations')
    .select('operation_id,user_id,audio_track_id,intended_chunk_count,intended_paths,cleanup_completed_indices,manifest_saved,job_id,status')
    .eq('operation_id', operationId)
    .eq('user_id', userId)
    .eq('audio_track_id', track.id)
    .maybeSingle()
  if (error) throw new TranscriptionError('database_save_failure', 'The preparation operation could not be verified.', 500)
  const operation = data as PreparationOperationRow | null
  if (!operation || !operation.manifest_saved || !['manifest_saved', 'job_created'].includes(operation.status)) {
    throw new TranscriptionError('prepared_audio_invalid', 'The prepared transcription operation is not ready for a job.', 409)
  }
  if (
    !Array.isArray(operation.intended_paths)
    || operation.intended_paths.length !== operation.intended_chunk_count
    || manifest.chunks.length !== operation.intended_chunk_count
    || manifest.chunks.some((chunk, index) => chunk.storagePath !== operation.intended_paths[index])
  ) {
    throw new TranscriptionError('prepared_audio_invalid', 'The prepared transcription manifest does not match its canonical operation paths.', 409)
  }
  return operation
}

async function attachPreparationJob(
  adminClient: SupabaseClient,
  operation: PreparationOperationRow | null,
  job: JobRow,
): Promise<void> {
  if (!operation) return
  if (operation.job_id && operation.job_id !== job.id) {
    const { data: priorJob, error: priorJobError } = await adminClient
      .from('lyric_transcription_jobs')
      .select('status,request_options')
      .eq('id', operation.job_id)
      .eq('user_id', operation.user_id)
      .maybeSingle()
    const priorPreparationTrackId = typeof priorJob?.request_options?.preparationAudioTrackId === 'string'
      ? priorJob.request_options.preparationAudioTrackId
      : null
    if (
      priorJobError
      || !priorJob
      || priorPreparationTrackId !== operation.audio_track_id
      || !['failed', 'cancelled'].includes(String(priorJob.status))
    ) {
      throw new TranscriptionError('prepared_audio_invalid', 'This preparation operation is already bound to another transcription job.', 409)
    }
  }

  let query = adminClient
    .from('audio_preparation_operations')
    .update({
      job_id: job.id,
      status: 'job_created',
      phase: 'complete',
      completed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('operation_id', operation.operation_id)
    .eq('user_id', operation.user_id)
    .eq('audio_track_id', operation.audio_track_id)
    .in('status', ['manifest_saved', 'job_created'])
  query = operation.job_id ? query.eq('job_id', operation.job_id) : query.is('job_id', null)
  const { data, error } = await query.select('operation_id').maybeSingle()
  if (error || !data) throw new TranscriptionError('database_save_failure', 'The transcription job could not be bound to its prepared audio.', 500)
}

function exactPreparationPath(operation: PreparationOperationRow, index: number): string {
  return `${operation.user_id}/transcription-chunks/${operation.audio_track_id}/${operation.operation_id}/chunk-${String(index).padStart(3, '0')}.wav`
}

async function removePreparationPaths(
  adminClient: SupabaseClient,
  operation: PreparationOperationRow,
): Promise<{ completed: Set<number>; allCleaned: boolean; lastError: string | null }> {
  const completed = new Set(operation.cleanup_completed_indices)
  let lastError: string | null = null
  if (
    !Number.isInteger(operation.intended_chunk_count)
    || operation.intended_chunk_count < 1
    || operation.intended_chunk_count > MAX_PREPARED_AUDIO_CHUNKS
    || operation.intended_paths.length !== operation.intended_chunk_count
  ) {
    return { completed, allCleaned: false, lastError: 'Prepared-audio cleanup metadata is incomplete.' }
  }

  for (let index = 0; index < operation.intended_paths.length; index += 1) {
    if (completed.has(index)) continue
    const path = operation.intended_paths[index]
    if (path !== exactPreparationPath(operation, index)) {
      lastError = 'Prepared-audio cleanup metadata contains an invalid path.'
      break
    }
    const { error } = await adminClient.storage.from(AUDIO_BUCKET).remove([path])
    if (error) { lastError = error.message; break }
    completed.add(index)
  }
  return {
    completed,
    allCleaned: operation.intended_paths.every((_path, index) => completed.has(index)),
    lastError,
  }
}

async function clearAnalysisSourcePreparationReference(
  adminClient: SupabaseClient,
  userId: string,
  sourceAudioTrackId: string,
  operationId: string,
): Promise<void> {
  const { error } = await adminClient
    .from('audio_analysis_sources')
    .update({ preparation_operation_id: null, preparation_metadata: {} })
    .eq('user_id', userId)
    .eq('source_audio_track_id', sourceAudioTrackId)
    .eq('preparation_operation_id', operationId)
  if (error) console.error('[lyric-transcription] analysis source preparation cleanup failed', error.code)
}

async function cleanupUnattachedPreparationOperation(
  adminClient: SupabaseClient,
  operation: PreparationOperationRow,
  reason: string,
): Promise<void> {
  const { completed, allCleaned, lastError } = await removePreparationPaths(adminClient, operation)
  await adminClient
    .from('audio_preparation_operations')
    .update({
      cleanup_completed_indices: [...completed].sort((a, b) => a - b),
      status: allCleaned ? 'cancelled' : 'cleanup_pending',
      phase: allCleaned ? 'cancelled' : 'cleanup',
      manifest_saved: false,
      job_id: null,
      last_error: lastError ?? reason,
      completed_at: allCleaned ? new Date().toISOString() : null,
    })
    .eq('operation_id', operation.operation_id)
    .eq('user_id', operation.user_id)
    .eq('audio_track_id', operation.audio_track_id)
    .is('job_id', null)

  const { data: trackData } = await adminClient
    .from('audio_tracks')
    .select('transcription_assets')
    .eq('id', operation.audio_track_id)
    .eq('user_id', operation.user_id)
    .maybeSingle()
  if (asRecord(trackData?.transcription_assets).operationId === operation.operation_id) {
    await adminClient.from('audio_tracks')
      .update({ transcription_assets: null })
      .eq('id', operation.audio_track_id)
      .eq('user_id', operation.user_id)
  }
  await clearAnalysisSourcePreparationReference(
    adminClient,
    operation.user_id,
    operation.audio_track_id,
    operation.operation_id,
  )
}

async function cleanupPreparationAfterCancellation(
  adminClient: SupabaseClient,
  userId: string,
  job: JobRow,
): Promise<void> {
  const operationId = typeof job.request_options.preparationOperationId === 'string'
    ? job.request_options.preparationOperationId
    : null
  if (!operationId) return
  const preparationAudioTrackId = typeof job.request_options.preparationAudioTrackId === 'string'
    ? job.request_options.preparationAudioTrackId
    : job.audio_track_id
  const { data } = await adminClient
    .from('audio_preparation_operations')
    .select('operation_id,user_id,audio_track_id,intended_chunk_count,intended_paths,cleanup_completed_indices,manifest_saved,job_id,status')
    .eq('operation_id', operationId)
    .eq('user_id', userId)
    .eq('audio_track_id', preparationAudioTrackId)
    .eq('job_id', job.id)
    .maybeSingle()
  const operation = data as PreparationOperationRow | null
  if (!operation) return

  const { completed, allCleaned, lastError } = await removePreparationPaths(adminClient, operation)
  await adminClient
    .from('audio_preparation_operations')
    .update({
      cleanup_completed_indices: [...completed].sort((a, b) => a - b),
      status: allCleaned ? 'cancelled' : 'cleanup_pending',
      phase: allCleaned ? 'cancelled' : 'cleanup',
      manifest_saved: false,
      last_error: lastError ?? 'Transcription and prepared audio were cancelled.',
      completed_at: allCleaned ? new Date().toISOString() : null,
    })
    .eq('operation_id', operationId)
    .eq('user_id', userId)
    .eq('job_id', job.id)

  const { data: trackData } = await adminClient
    .from('audio_tracks')
    .select('transcription_assets')
    .eq('id', preparationAudioTrackId)
    .eq('user_id', userId)
    .maybeSingle()
  if (asRecord(trackData?.transcription_assets).operationId === operationId) {
    await adminClient.from('audio_tracks')
      .update({ transcription_assets: null })
      .eq('id', preparationAudioTrackId)
      .eq('user_id', userId)
  }
  await clearAnalysisSourcePreparationReference(adminClient, userId, preparationAudioTrackId, operationId)
}

async function reconcileCreatedPreparationJob(
  adminClient: SupabaseClient,
  operation: PreparationOperationRow | null,
  created: { job: JobRow; duplicate: boolean },
): Promise<void> {
  if (created.duplicate && operation && operation.job_id !== created.job.id) {
    await cleanupUnattachedPreparationOperation(adminClient, operation, 'An existing active transcription job already owns this track.')
    return
  }
  try {
    await attachPreparationJob(adminClient, operation, created.job)
  } catch (error) {
    if (!created.duplicate) {
      await updateJob(adminClient, created.job.id, {
        status: 'failed',
        error_code: 'database_save_failure',
        error_message: 'The transcription job could not be bound to its prepared audio.',
        completed_at: new Date().toISOString(),
      })
      if (operation && !operation.job_id) {
        await cleanupUnattachedPreparationOperation(
          adminClient,
          operation,
          'The transcription job could not be bound to its prepared audio.',
        )
      }
    }
    throw error
  }
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
      no_speech_prob: finiteNumber(record.no_speech_prob),
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
    throw new TranscriptionError('provider_unavailable', 'The transcription provider could not be reached.', 502)
  } finally {
    clearTimeout(timeout)
  }
}

async function safeProviderErrorPreview(response: Response): Promise<string> {
  try {
    return (await response.clone().text()).slice(0, 8_192).toLowerCase()
  } catch {
    return ''
  }
}

function looksLikeNormalizationFailure(preview: string): boolean {
  return /no\s+(speech|text|transcript|transcription|lyrics)|empty\s+(audio|transcript|response)|timed?\s+lyrics/.test(preview)
}

async function providerHttpError(response: Response): Promise<TranscriptionError> {
  const preview = await safeProviderErrorPreview(response)
  if (response.status === 401 || response.status === 403) {
    return new TranscriptionError('provider_authentication_failed', 'The server transcription credentials were rejected.', 503)
  }
  if (response.status === 408 || response.status === 504) {
    return new TranscriptionError('provider_timeout', 'The transcription provider timed out.', 504)
  }
  if (response.status === 413) {
    return new TranscriptionError('unsupported_audio', 'This audio file is too large for automatic lyric extraction.', 413)
  }
  if (response.status === 429) {
    return new TranscriptionError('rate_limit', 'The transcription provider is busy. Try again shortly.', 429)
  }
  if (response.status === 400 || response.status === 422) {
    const code = looksLikeNormalizationFailure(preview) ? 'normalization_failure' : 'unsupported_audio'
    const message = code === 'normalization_failure'
      ? 'The transcription provider did not return usable timed lyrics for this track.'
      : 'This audio file could not be transcribed by the configured provider.'
    return new TranscriptionError(code, message, response.status === 400 ? 400 : 422)
  }
  if (response.status >= 500) {
    return new TranscriptionError('provider_unavailable', 'The transcription provider is temporarily unavailable.', 502)
  }
  return new TranscriptionError('unsupported_audio', 'This audio file could not be transcribed by the configured provider.', 422)
}

function reliableTranscriptDurationMs(transcript: ProviderTranscript, fallbackDurationMs: number): number {
  const providerDurationMs = transcript.duration && transcript.duration > 0
    ? Math.round(transcript.duration * 1000)
    : 0
  const timedEndMs = Math.max(
    0,
    ...(transcript.words ?? []).map(word => Math.round(word.end * 1000)),
    ...(transcript.segments ?? []).map(segment => Math.round(segment.end * 1000)),
  )
  const durationMs = Math.max(providerDurationMs, timedEndMs, fallbackDurationMs)
  if (durationMs <= 0) {
    throw new TranscriptionError('normalization_failure', 'The transcription provider did not return a reliable audio duration.', 422)
  }
  return durationMs
}

function groqChunkFileName(fileName: string, index: number): string {
  const extensionIndex = fileName.lastIndexOf('.')
  const base = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName
  return `${base}.transcription-${String(index + 1).padStart(2, '0')}.wav`
}

async function mapWithConcurrency<TInput, TOutput>(
  items: readonly TInput[],
  concurrency: number,
  worker: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results = new Array<TOutput>(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

interface GroqTranscriptResponse {
  payload: unknown
  model: string
}

function groqTranscriptionModels(): readonly string[] {
  const primary = Deno.env.get('GROQ_TRANSCRIPTION_MODEL')?.trim() || DEFAULT_GROQ_TRANSCRIPTION_MODEL
  const fallback = Deno.env.get('GROQ_FALLBACK_TRANSCRIPTION_MODEL')?.trim()
  return fallback && fallback !== primary ? [primary, fallback] : [primary]
}

function shouldTryGroqFallback(error: unknown): boolean {
  if (!(error instanceof TranscriptionError)) return false
  if (error.httpStatus === 413) return false
  return error.code === 'provider_unavailable' ||
    error.code === 'provider_timeout' ||
    error.code === 'normalization_failure' ||
    error.code === 'unsupported_audio'
}

async function requestGroqTranscript(
  apiKey: string,
  models: readonly string[],
  blob: Blob,
  fileName: string,
  mimeType: string,
  options: Record<string, unknown>,
  timeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS,
): Promise<GroqTranscriptResponse> {
  let lastError: unknown = null
  for (const [index, model] of models.entries()) {
    const form = new FormData()
    form.append('file', new File([blob], fileName, { type: mimeType || blob.type || 'application/octet-stream' }))
    form.append('model', model)
    form.append('response_format', 'verbose_json')
    form.append('timestamp_granularities[]', 'segment')
    form.append('timestamp_granularities[]', 'word')
    form.append('temperature', '0')
    if (typeof options.language === 'string' && options.language !== 'auto') form.append('language', options.language)

    try {
      const response = await fetchWithTimeout(GROQ_TRANSCRIPTION_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      }, timeoutMs)
      if (!response.ok) throw await providerHttpError(response)
      return { payload: await response.json(), model }
    } catch (error) {
      lastError = error
      const hasFallback = index < models.length - 1
      if (!hasFallback || !shouldTryGroqFallback(error)) throw error
    }
  }
  throw lastError instanceof Error ? lastError : new TranscriptionError('provider_unavailable', 'The transcription provider could not be reached.', 502)
}

function wavChunkingFailure(error: unknown): TranscriptionError {
  const detail = error instanceof WavChunkingError ? ` ${error.message}` : ''
  return new TranscriptionError(
    'transcription_asset_required',
    `This WAV file could not be split safely on the server.${detail} Retry from DRMVYZ so it can prepare a private transcription-ready audio copy.`,
    409,
  )
}

function wavChunkMetadata(plan: WavChunkPlan, descriptor: WavChunkDescriptor, transcript: ProviderTranscript, model: string) {
  return {
    index: descriptor.index,
    startMs: descriptor.unit.startMs,
    endMs: descriptor.unit.endMs,
    overlapBeforeMs: descriptor.unit.overlapBeforeMs,
    overlapAfterMs: descriptor.unit.overlapAfterMs,
    fileBytes: descriptor.fileBytes,
    wordCount: transcript.words?.length ?? 0,
    segmentCount: transcript.segments?.length ?? 0,
    language: transcript.language ?? null,
    model,
  }
}

async function runGroqProvider(
  blob: Blob,
  track: AudioTrackRow,
  options: Record<string, unknown>,
  onChunkProgress?: (completed: number, total: number) => Promise<void>,
  preFetchedSourceBytes?: Uint8Array,
  plannedChunks?: (total: number) => Promise<void>,
  assertCurrent?: () => Promise<void>,
): Promise<ProviderRunResult> {
  const apiKey = requiredEnv('GROQ_API_KEY')
  const maxBytes = groqSafeAudioBytes()
  const timeoutMs = groqProviderTimeoutMs()
  const models = groqTranscriptionModels()

  if (blob.size <= maxBytes) {
    if (assertCurrent) await assertCurrent()
    const result = await requestGroqTranscript(
      apiKey,
      models,
      blob,
      track.file_name,
      track.mime_type || blob.type || 'application/octet-stream',
      options,
      timeoutMs,
    )
    if (assertCurrent) await assertCurrent()
    const transcript = providerTranscript(result.payload)
    const storedDurationMs = track.duration_sec && track.duration_sec > 0
      ? Math.round(track.duration_sec * 1000)
      : 0
    const durationMs = reliableTranscriptDurationMs(transcript, storedDurationMs)
    const unit = planTranscriptionUnits(durationMs, { forceChunking: false })[0]
      ?? { index: 0, startMs: 0, endMs: durationMs, overlapBeforeMs: 0, overlapAfterMs: 0 }
    return { transcripts: [{ unit, transcript }], rawPayload: result.payload, model: result.model }
  }

  const sourceBytes = preFetchedSourceBytes ?? new Uint8Array(await blob.arrayBuffer())
  if (!isRiffWave(sourceBytes)) throw wavChunkingFailure(null)

  const safetyBytes = Math.min(
    groqChunkSafetyBytes(maxBytes),
    Math.max(1, Math.floor(maxBytes / 8)),
  )
  const chunkLimitBytes = Math.floor(maxBytes - safetyBytes)
  const overlapMs = groqTranscriptionOverlapMs()
  let plan: WavChunkPlan
  try {
    plan = planWavTranscriptionChunks(sourceBytes, { maxFileBytes: chunkLimitBytes, overlapMs })
  } catch (error) {
    throw wavChunkingFailure(error)
  }

  if (plannedChunks) await plannedChunks(plan.chunks.length)

  const concurrency = groqTranscriptionConcurrency()
  let chunksCompleted = 0
  const completed = await mapWithConcurrency(plan.chunks, concurrency, async descriptor => {
    if (assertCurrent) await assertCurrent()
    const chunkBytes = buildWavTranscriptionChunk(sourceBytes, plan, descriptor)
    const chunkBlob = new Blob([Uint8Array.from(chunkBytes).buffer], { type: 'audio/wav' })
    const result = await requestGroqTranscript(
      apiKey,
      models,
      chunkBlob,
      groqChunkFileName(track.file_name, descriptor.index),
      'audio/wav',
      options,
      timeoutMs,
    )
    if (assertCurrent) await assertCurrent()
    const transcript = providerTranscript(result.payload)
    chunksCompleted++
    if (onChunkProgress) await onChunkProgress(chunksCompleted, plan.chunks.length)
    return { unit: descriptor.unit, transcript, model: result.model, metadata: wavChunkMetadata(plan, descriptor, transcript, result.model) }
  })

  return {
    transcripts: completed.map(({ unit, transcript }) => ({ unit, transcript })),
    rawPayload: {
      chunkedWav: true,
      sourceBytes: blob.size,
      groqDocumentedMaxBytes: groqDocumentedMaxAudioBytes(),
      groqSafeBytes: maxBytes,
      chunkLimitBytes,
      sampleRate: plan.sampleRate,
      channelCount: plan.channelCount,
      bitsPerSample: plan.bitsPerSample,
      units: completed.map(({ metadata }) => metadata),
    },
    model: [...new Set(completed.map(({ model }) => model))].join(', ') || models[0],
  }
}

async function runPreparedAudioProvider(
  adminClient: SupabaseClient,
  manifest: PreparedAudioManifest,
  options: Record<string, unknown>,
  onChunkProgress?: (completed: number, total: number) => Promise<void>,
  assertCurrent?: () => Promise<void>,
): Promise<ProviderRunResult> {
  const apiKey = requiredEnv('GROQ_API_KEY')
  const models = groqTranscriptionModels()
  const safeBytes = groqSafeAudioBytes()
  const timeoutMs = groqProviderTimeoutMs()
  const concurrency = groqTranscriptionConcurrency()
  let chunksCompleted = 0

  const completed = await mapWithConcurrency(manifest.chunks, concurrency, async chunk => {
    if (assertCurrent) await assertCurrent()
    const { data: blob, error } = await adminClient.storage
      .from(AUDIO_BUCKET)
      .download(chunk.storagePath)
    if (error || !blob) {
      throw new TranscriptionError('prepared_audio_missing', 'A prepared transcription audio chunk is missing. Retry extraction to rebuild it.', 409)
    }
    if (blob.size !== chunk.byteSize || blob.size > safeBytes) {
      throw new TranscriptionError('prepared_audio_invalid', 'A prepared transcription audio chunk is invalid. Retry extraction to rebuild it.', 409)
    }
    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (!isRiffWave(bytes)) {
      throw new TranscriptionError('prepared_audio_invalid', 'A prepared transcription audio chunk is not a valid WAV file. Retry extraction to rebuild it.', 409)
    }

    const result = await requestGroqTranscript(
      apiKey,
      models,
      new Blob([Uint8Array.from(bytes).buffer], { type: 'audio/wav' }),
      chunk.fileName,
      'audio/wav',
      options,
      timeoutMs,
    )
    if (assertCurrent) await assertCurrent()
    const transcript = providerTranscript(result.payload)
    chunksCompleted += 1
    if (onChunkProgress) await onChunkProgress(chunksCompleted, manifest.chunks.length)
    return {
      unit: {
        index: chunk.index,
        startMs: chunk.startMs,
        endMs: chunk.endMs,
        overlapBeforeMs: chunk.overlapBeforeMs,
        overlapAfterMs: chunk.overlapAfterMs,
      },
      transcript,
      metadata: {
        index: chunk.index,
        startMs: chunk.startMs,
        endMs: chunk.endMs,
        overlapBeforeMs: chunk.overlapBeforeMs,
        overlapAfterMs: chunk.overlapAfterMs,
        fileBytes: blob.size,
        wordCount: transcript.words?.length ?? 0,
        segmentCount: transcript.segments?.length ?? 0,
        language: transcript.language ?? null,
        model: result.model,
      },
      model: result.model,
    }
  })

  return {
    transcripts: completed.map(({ unit, transcript }) => ({ unit, transcript })),
    rawPayload: {
      preparedAudio: true,
      preparationVersion: manifest.version,
      preprocessingRuntime: 'browser-web-audio',
      preparedFormat: 'pcm16-wav',
      sampleRate: manifest.sampleRate,
      channelCount: manifest.channels,
      durationMs: manifest.durationMs,
      units: completed.map(({ metadata }) => metadata),
    },
    model: [...new Set(completed.map(({ model }) => model))].join(', ') || models[0],
  }
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
  if (!response.ok) throw await providerHttpError(response)
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

function shouldRedactProviderMetadataKey(key: string): boolean {
  const lower = key.toLowerCase()
  return lower.includes('key') ||
    lower.includes('token') ||
    lower.includes('authorization') ||
    lower.includes('secret') ||
    lower.includes('signedurl') ||
    lower.includes('url') ||
    lower.includes('path') ||
    lower === 'stack' ||
    lower.includes('stacktrace')
}

function shouldRedactProviderMetadataString(value: string): boolean {
  return /https?:\/\//i.test(value) ||
    /authorization\s*[:=]\s*bearer/i.test(value) ||
    /(?:^|\s)bearer\s+[a-z0-9._~+\/-]+=*/i.test(value) ||
    /(?:^|\s)(?:\/mnt\/|\/tmp\/|\/home\/|\/var\/|[a-z]:\\)/i.test(value) ||
    /storage\/v1\/object/i.test(value)
}

function boundedProviderMetadata(value: unknown): Record<string, unknown> {
  let serialized = ''
  try {
    serialized = JSON.stringify(value, (key, item) => {
      if (shouldRedactProviderMetadataKey(key)) return '[redacted]'
      if (typeof item === 'string' && shouldRedactProviderMetadataString(item)) return '[redacted]'
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

async function authoritativeTrackAnalysis(adminClient: SupabaseClient, trackId: string): Promise<{ structure: MusicalSegmentationStructure | null; revision: Record<string, unknown> }> {
  const { data, error } = await adminClient.from('track_analyses').select('analysis_payload,analysis_version,updated_at').eq('track_id', trackId).maybeSingle()
  if (error || !data || !isRecord(data.analysis_payload)) return { structure: null, revision: {} }
  return {
    structure: data.analysis_payload as MusicalSegmentationStructure,
    revision: { trackAnalysisVersion: data.analysis_version ?? (data.analysis_payload as Record<string, unknown>).analysisVersion ?? null, trackAnalysisUpdatedAt: data.updated_at ?? null },
  }
}

async function processJob(
  adminClient: SupabaseClient,
  userClient: SupabaseClient,
  job: JobRow,
  resolvedSource: ResolvedAnalysisSource,
): Promise<void> {
  const ownerTrack = resolvedSource.ownerTrack
  const track = resolvedSource.sourceTrack
  try {
    validateTrack(ownerTrack)
    validateTrack(track)
    await updateJob(adminClient, job.id, {
      status: 'processing',
      progress: 0.05,
      started_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
      provider_metadata: { processingStage: 'validating', fnVersion: LYRIC_TRANSCRIPTION_FN_VERSION },
    })

    if (await jobWasCancelled(adminClient, job.id)) return

    let providerResult: ProviderRunResult
    let processingMode: ProcessingMode = 'direct'
    const runtimeProvider = runtimeProviderForJob(job.provider)
    let actualProvider: RuntimeTranscriptionProviderName = runtimeProvider
    const maxBytes = groqSafeAudioBytes()
    const preparationOperationId = typeof job.request_options.preparationOperationId === 'string'
      ? job.request_options.preparationOperationId
      : null
    const prepared = runtimeProvider === 'groq'
      ? preparedAudioManifest(track, maxBytes, preparationOperationId)
      : null
    const assertCurrent = () => throwIfJobCancelled(adminClient, job.id)

    const updateChunkProgress = async (completed: number, total: number) => {
      await updateJob(adminClient, job.id, {
        progress: 0.2 + (completed / total) * 0.5,
        provider_metadata: {
          processingStage: 'transcribing',
          fnVersion: LYRIC_TRANSCRIPTION_FN_VERSION,
          processingMode,
          chunksCompleted: completed,
          chunksTotal: total,
        },
      })
    }

    if (runtimeProvider === 'custom') {
      processingMode = 'long-audio-worker'
      await updateJob(adminClient, job.id, {
        progress: 0.15,
        provider_metadata: { processingStage: 'routing', fnVersion: LYRIC_TRANSCRIPTION_FN_VERSION },
      })
      actualProvider = 'custom'
      providerResult = await runCustomProvider(adminClient, track, job.request_options)
    } else if (prepared) {
      processingMode = 'prepared-audio'
      await updateJob(adminClient, job.id, {
        progress: 0.2,
        provider_metadata: {
          processingStage: 'transcribing',
          fnVersion: LYRIC_TRANSCRIPTION_FN_VERSION,
          processingMode,
          preprocessingRuntime: 'browser-web-audio',
          chunksCompleted: 0,
          chunksTotal: prepared.chunks.length,
        },
      })
      providerResult = await runPreparedAudioProvider(
        adminClient,
        prepared,
        job.request_options,
        updateChunkProgress,
        assertCurrent,
      )
    } else {
      // A current client prepares oversized compressed sources as private PCM WAV
      // derivatives before starting the server job. The optional custom worker
      // remains a fallback for clients that cannot decode a source codec.
      const estimatedSize = track.file_size ?? 0
      const requiresLocalPreparation = estimatedSize > MAX_SERVER_DOWNLOAD_BYTES
        || (estimatedSize > maxBytes && !isLikelyWavFile(track))
      if (requiresLocalPreparation) {
        if (!isCustomProviderConfigured()) {
          throw new TranscriptionError(
            'transcription_asset_required',
            'This track needs local audio preparation before transcription. Retry from DRMVYZ so it can create private transcription-ready audio chunks.',
            409,
          )
        }
        processingMode = 'long-audio-worker'
        await updateJob(adminClient, job.id, {
          progress: 0.15,
          provider_metadata: { processingStage: 'routing', fnVersion: LYRIC_TRANSCRIPTION_FN_VERSION },
        })
        actualProvider = 'custom'
        providerResult = await runCustomProvider(adminClient, track, job.request_options)
      } else {
        await updateJob(adminClient, job.id, {
          progress: 0.1,
          provider_metadata: { processingStage: 'downloading', fnVersion: LYRIC_TRANSCRIPTION_FN_VERSION },
        })
        const { data: audioBlob, error: downloadError } = await adminClient.storage
          .from(AUDIO_BUCKET)
          .download(track.storage_path!)
        if (downloadError || !audioBlob) {
          throw new TranscriptionError('storage_failure', 'The stored audio file could not be read.', 500)
        }
        if (audioBlob.size > MAX_STORED_AUDIO_BYTES) {
          throw new TranscriptionError('unsupported_audio', 'This audio file is too large for automatic lyric extraction.', 413)
        }
        if (audioBlob.size > MAX_SERVER_DOWNLOAD_BYTES) {
          throw new TranscriptionError(
            'transcription_asset_required',
            'This track needs local audio preparation before transcription. Retry from DRMVYZ so it can create private transcription-ready audio chunks.',
            409,
          )
        }

        await updateJob(adminClient, job.id, {
          progress: 0.18,
          provider_metadata: { processingStage: 'inspecting', fnVersion: LYRIC_TRANSCRIPTION_FN_VERSION },
        })

        if (audioBlob.size > maxBytes) {
          const sourceBytes = new Uint8Array(await audioBlob.arrayBuffer())
          if (!isRiffWave(sourceBytes)) {
            if (!isCustomProviderConfigured()) {
              throw new TranscriptionError(
                'transcription_asset_required',
                'This track needs local audio preparation before transcription. Retry from DRMVYZ so it can create a private transcription-ready audio copy.',
                409,
              )
            }
            processingMode = 'long-audio-worker'
            await updateJob(adminClient, job.id, {
              progress: 0.2,
              provider_metadata: { processingStage: 'routing', fnVersion: LYRIC_TRANSCRIPTION_FN_VERSION },
            })
            actualProvider = 'custom'
            providerResult = await runCustomProvider(adminClient, track, job.request_options)
          } else {
            processingMode = 'wav-chunking'
            await updateJob(adminClient, job.id, {
              progress: 0.2,
              provider_metadata: {
                processingStage: 'transcribing',
                fnVersion: LYRIC_TRANSCRIPTION_FN_VERSION,
                processingMode,
                chunksCompleted: 0,
                chunksTotal: 0,
              },
            })
            providerResult = await runGroqProvider(
              audioBlob,
              track,
              job.request_options,
              updateChunkProgress,
              sourceBytes,
              async chunksTotal => {
                await updateJob(adminClient, job.id, {
                  progress: 0.2,
                  provider_metadata: {
                    processingStage: 'transcribing',
                    fnVersion: LYRIC_TRANSCRIPTION_FN_VERSION,
                    processingMode,
                    chunksCompleted: 0,
                    chunksTotal,
                  },
                })
              },
              assertCurrent,
            )
          }
        } else {
          processingMode = 'direct'
          await updateJob(adminClient, job.id, {
            progress: 0.2,
            provider_metadata: {
              processingStage: 'transcribing',
              fnVersion: LYRIC_TRANSCRIPTION_FN_VERSION,
              processingMode,
            },
          })
          providerResult = await runGroqProvider(audioBlob, track, job.request_options, undefined, undefined, undefined, assertCurrent)
        }
      }
    }

    if (await jobWasCancelled(adminClient, job.id)) return
    await updateJob(adminClient, job.id, {
      progress: 0.72,
      provider_metadata: { processingStage: 'merging', fnVersion: LYRIC_TRANSCRIPTION_FN_VERSION },
    })

    const confidenceThreshold = finiteNumber(job.request_options.confidenceThreshold) ?? 0.6
    const normalizedUnits = providerResult.transcripts.map(({ unit, transcript }) =>
      normalizeProviderTranscript(transcript, unit, confidenceThreshold))
    const sourceTimelineTranscript = reconcileTranscriptUnits(normalizedUnits)
    const shifted = resolvedSource.mode === 'vocal_reference'
      ? shiftReconciledTranscriptToOwnerTimeline(
          sourceTimelineTranscript,
          resolvedSource.timingOffsetMs,
          ownerTrack.duration_sec && ownerTrack.duration_sec > 0 ? ownerTrack.duration_sec * 1000 : null,
        )
      : {
          transcript: sourceTimelineTranscript,
          offsetMs: 0,
          sourceDurationMs: sourceTimelineTranscript.durationMs,
          ownerDurationMs: ownerTrack.duration_sec && ownerTrack.duration_sec > 0 ? Math.round(ownerTrack.duration_sec * 1000) : null,
          clampedWordCount: 0,
          clampedSegmentCount: 0,
          rejectedWordCount: 0,
          rejectedSegmentCount: 0,
        }
    const reconciled = shifted.transcript
    const cueStyle = normalizeLyricCueStyle(job.request_options.cueStyle)
    const trackAnalysis = await authoritativeTrackAnalysis(adminClient, ownerTrack.id)
    const cues = selectUsefulCues(reconciled, { cueStyle, musicalStructure: trackAnalysis.structure })
    if (!cues.length) throw new TranscriptionError('normalization_failure', 'No reliably timed lyric cues were returned for this track.', 422)

    const dbCues = cues
      .filter(cue => cue.endMs > cue.startMs && cue.text.trim())
      .map((cue, index) => databaseCue(cue, index, confidenceThreshold))
    if (!dbCues.length) throw new TranscriptionError('normalization_failure', 'The provider response did not contain usable timed lyrics.', 422)

    await updateJob(adminClient, job.id, {
      progress: 0.9,
      provider_metadata: { processingStage: 'saving', fnVersion: LYRIC_TRANSCRIPTION_FN_VERSION },
    })

    const metadata = {
      extractionJobId: job.id,
      lyricsOwnerAudioTrackId: ownerTrack.id,
      transcriptionSourceMode: resolvedSource.mode,
      analysisSourceId: resolvedSource.relationship?.id ?? null,
      transcriptionSourceAudioTrackId: track.id,
      transcriptionSourceTitle: track.title,
      vocalReferenceOffsetMs: resolvedSource.timingOffsetMs,
      vocalReferenceCompatibility: resolvedSource.compatibility?.status ?? null,
      vocalReferenceDurationDifferenceMs: resolvedSource.compatibility?.durationDifferenceMs ?? null,
      providerSourceDurationMs: shifted.sourceDurationMs,
      ownerDurationMs: shifted.ownerDurationMs,
      timestampClampSummary: {
        clampedWords: shifted.clampedWordCount,
        clampedSegments: shifted.clampedSegmentCount,
        rejectedWords: shifted.rejectedWordCount,
        rejectedSegments: shifted.rejectedSegmentCount,
      },
      provider: actualProvider,
      requestedProvider: runtimeProvider,
      model: providerResult.model,
      language: reconciled.language,
      confidence: reconciled.confidence,
      durationMs: reconciled.durationMs,
      warnings: reconciled.warnings,
      reviewStatus: 'unreviewed',
      generatedAt: new Date().toISOString(),
      cueCount: dbCues.length,
      ...segmentationProvenance(cueStyle, trackAnalysis.structure),
      ...trackAnalysis.revision,
    }
    const documentPayload = {
      audio_track_id: ownerTrack.id,
      visual_session_id: null,
      title: `${ownerTrack.title} AI Draft`,
      artist: ownerTrack.artist ?? '',
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
      provider: actualProvider,
      requestedProvider: runtimeProvider,
      model: providerResult.model,
      processingMode,
      fnVersion: LYRIC_TRANSCRIPTION_FN_VERSION,
      pipelineVersion: LYRIC_TRANSCRIPTION_FN_VERSION,
      preprocessingRuntime: processingMode === 'prepared-audio' ? 'browser-web-audio' : actualProvider === 'custom' ? 'custom-worker' : 'server',
      preparationVersion: prepared?.version ?? null,
      sourceMode: resolvedSource.mode,
      ownerAudioTrackId: ownerTrack.id,
      sourceAudioTrackId: track.id,
      analysisSourceId: resolvedSource.relationship?.id ?? null,
      timingOffsetMs: resolvedSource.timingOffsetMs,
      compatibilityStatus: resolvedSource.compatibility?.status ?? null,
      durationDifferenceMs: resolvedSource.compatibility?.durationDifferenceMs ?? null,
      sourceFormat: track.mime_type ?? track.file_name.split('.').pop()?.toLowerCase() ?? null,
      preparedFormat: processingMode === 'prepared-audio' ? 'pcm16-wav' : null,
      timestampsShiftedToOwnerTimeline: resolvedSource.mode === 'vocal_reference',
      sourceProviderDurationMs: shifted.sourceDurationMs,
      ownerDurationMs: shifted.ownerDurationMs,
      clampedWordCount: shifted.clampedWordCount,
      clampedSegmentCount: shifted.clampedSegmentCount,
      rejectedWordCount: shifted.rejectedWordCount,
      rejectedSegmentCount: shifted.rejectedSegmentCount,
      unitCount: providerResult.transcripts.length,
      usedSingleUnit: providerResult.transcripts.length === 1,
      durationMs: reconciled.durationMs,
      warnings: reconciled.warnings,
      cueSegmentationStyle: cueStyle,
      segmentationAlgorithmVersion: segmentationProvenance(cueStyle, trackAnalysis.structure).segmentationAlgorithmVersion,
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
      : new TranscriptionError('provider_unavailable', 'Automatic lyric extraction failed unexpectedly.', 500)
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
      const ownerTrack = await ownedTrack(adminClient, userId, body.audioTrackId)
      validateTrack(ownerTrack)
      let resolvedSource = await resolveStartAnalysisSource(adminClient, userId, ownerTrack, body)
      const operation = await validatePreparationOperation(adminClient, userId, resolvedSource.sourceTrack, body.preparationOperationId)
      if (resolvedSource.mode === 'vocal_reference') {
        const relationship = await upsertVocalReference(
          adminClient,
          userId,
          resolvedSource.ownerTrack,
          resolvedSource.sourceTrack,
          resolvedSource.timingOffsetMs,
          resolvedSource.compatibility!,
          body.preparationOperationId,
        )
        resolvedSource = { ...resolvedSource, relationship }
      }
      const created = await createJob(adminClient, userId, resolvedSource, safeOptions(body.options), body.preparationOperationId)
      await reconcileCreatedPreparationJob(adminClient, operation, created)
      if (!created.duplicate) runInBackground(processJob(adminClient, userClient, created.job, resolvedSource))
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
      await cleanupPreparationAfterCancellation(adminClient, userId, job)
      return json({ job: publicJob(await findOwnedJob(adminClient, userId, job.id)) })
    }

    if (body.action === 'retry') {
      if (job.status !== 'failed' && job.status !== 'cancelled') {
        throw new TranscriptionError('invalid_request', 'Only a failed or cancelled transcription can be retried.', 409)
      }
      const ownerTrack = await ownedTrack(adminClient, userId, job.audio_track_id)
      validateTrack(ownerTrack)
      let resolvedSource = await resolveRetryAnalysisSource(adminClient, userId, ownerTrack, job)
      const operation = await validatePreparationOperation(adminClient, userId, resolvedSource.sourceTrack, body.preparationOperationId)
      if (resolvedSource.mode === 'vocal_reference') {
        const relationship = await upsertVocalReference(
          adminClient,
          userId,
          resolvedSource.ownerTrack,
          resolvedSource.sourceTrack,
          resolvedSource.timingOffsetMs,
          resolvedSource.compatibility!,
          body.preparationOperationId,
        )
        resolvedSource = { ...resolvedSource, relationship }
      }
      const created = await createJob(adminClient, userId, resolvedSource, safeOptions(job.request_options), body.preparationOperationId)
      await reconcileCreatedPreparationJob(adminClient, operation, created)
      if (!created.duplicate) runInBackground(processJob(adminClient, userClient, created.job, resolvedSource))
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
