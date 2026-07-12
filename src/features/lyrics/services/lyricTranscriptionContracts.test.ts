import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { LyricTranscriptionProviderName } from '../../../types/lyrics'
import migrationSql from '../../../../supabase/migrations/0016_lyric_transcription_jobs.sql?raw'
import finalAuditMigrationSql from '../../../../supabase/migrations/0017_lyric_final_audit.sql?raw'
import preparedAudioMigrationSql from '../../../../supabase/migrations/0019_audio_transcription_assets.sql?raw'
import groqProviderMigrationSql from '../../../../supabase/migrations/0020_groq_lyric_transcription_provider.sql?raw'
import edgeFunctionSource from '../../../../supabase/functions/lyric-transcription/index.ts?raw'
import clientSource from './lyricExtraction.ts?raw'
import extractorSource from '../components/AiLyricExtractor.tsx?raw'
import deploymentGuide from '../../../../docs/lyric-transcription-deployment.md?raw'
import musicIntelligenceDoc from '../../../../docs/music-intelligence.md?raw'

const rootEnvExample = readFileSync(new URL('../../../../.env.example', import.meta.url), 'utf8')
const edgeEnvExample = readFileSync(new URL('../../../../supabase/functions/.env.example', import.meta.url), 'utf8')

const compact = (value: string) => value.replace(/\s+/g, ' ').trim()
const sql = compact(migrationSql)
const finalAuditSql = compact(finalAuditMigrationSql)
const preparedAudioSql = compact(preparedAudioMigrationSql)
const groqProviderSql = compact(groqProviderMigrationSql)

const edgeBlock = (start: string, end: string) => {
  const startIndex = edgeFunctionSource.indexOf(start)
  const endIndex = edgeFunctionSource.indexOf(end, startIndex)
  expect(startIndex).toBeGreaterThanOrEqual(0)
  expect(endIndex).toBeGreaterThan(startIndex)
  return edgeFunctionSource.slice(startIndex, endIndex)
}

const supportedProviders = ['groq', 'openai', 'custom'] as const satisfies readonly LyricTranscriptionProviderName[]

describe('secure lyric transcription contracts', () => {
  it('creates owned resumable jobs with constrained statuses, progress, indexes, and RLS', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.lyric_transcription_jobs')
    expect(sql).toContain("status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')")
    expect(sql).toContain('progress >= 0 AND progress <= 1')
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS uq_lyric_transcription_jobs_active_track')
    expect(sql).toContain("WHERE status IN ('queued', 'processing')")
    expect(sql).toContain('USING (auth.uid() = user_id)')
    expect(sql).not.toContain('FOR UPDATE TO authenticated')
    expect(sql).not.toContain('FOR INSERT TO authenticated')
  })

  it('bounds provider metadata and request options at the database boundary', () => {
    expect(finalAuditSql).toContain('lyric_transcription_jobs_provider_metadata_size_check')
    expect(finalAuditSql).toContain('octet_length(provider_metadata::text) <= 524288')
    expect(finalAuditSql).toContain('lyric_transcription_jobs_request_options_size_check')
    expect(finalAuditSql).toContain('octet_length(request_options::text) <= 16384')
  })

  it('allows Groq for new jobs while preserving historical OpenAI/custom provider rows', () => {
    expect(supportedProviders).toEqual(['groq', 'openai', 'custom'])
    expect(groqProviderSql).toContain('DROP CONSTRAINT IF EXISTS lyric_transcription_jobs_provider_check')
    expect(groqProviderSql).toContain("provider IN ('groq', 'openai', 'custom')")
    expect(groqProviderSql).not.toContain('UPDATE public.lyric_transcription_jobs')
    expect(edgeFunctionSource).toContain("type LyricTranscriptionProviderName = 'groq' | 'openai' | 'custom'")
    expect(edgeFunctionSource).toContain("function configuredProvider(): 'groq'")
    expect(edgeFunctionSource).toContain("return 'groq'")
    expect(edgeFunctionSource).toContain('Historical OpenAI rows stay readable')
  })

  it('verifies audio-track ownership and prevents duplicate active jobs server-side', () => {
    expect(edgeFunctionSource).toContain(".eq('user_id', userId)")
    expect(edgeFunctionSource).toContain(".in('status', [...ACTIVE_STATUSES])")
    expect(edgeFunctionSource).toContain("error.code === '23505'")
    expect(edgeFunctionSource).toContain('duplicate: created.duplicate')
  })

  it('supports failure, retry, cancellation, and refresh-safe status actions', () => {
    expect(edgeFunctionSource).toContain("body.action === 'status'")
    expect(edgeFunctionSource).toContain("body.action === 'cancel'")
    expect(edgeFunctionSource).toContain("body.action === 'retry'")
    expect(edgeFunctionSource).toContain("status: 'failed'")
    expect(clientSource).toContain(".from('lyric_transcription_jobs')")
    expect(clientSource).toContain("action: 'status'")
  })

  it('keeps the browser extraction UI internet-required without exposing provider health checks', () => {
    expect(extractorSource).toContain('navigator.onLine')
    expect(extractorSource).toContain('online')
    expect(extractorSource).toContain('offline')
    expect(extractorSource).toContain('Lyric extraction requires an internet connection. Connect to the internet and try again.')
    expect(extractorSource).toContain('ensurePreparedTranscriptionAudio(selectedTrack')
    expect(extractorSource).toContain('startLyricTranscription(selectedTrack.dbId, options, preparationOperationId)')
    expect(clientSource).not.toContain('api.groq.com')
    expect(extractorSource).not.toContain('GROQ_API_KEY')
  })

  it('uses stable user-facing provider labels for current and historical jobs', () => {
    expect(clientSource).toContain("case 'groq': return 'Groq Whisper'")
    expect(clientSource).toContain("case 'openai': return 'Legacy OpenAI'")
    expect(clientSource).toContain("case 'custom': return 'Custom provider'")
    expect(extractorSource).toContain('lyricTranscriptionProviderLabel(job.provider)')
  })

  it('uses audio_tracks.id and private storage access without exposing provider credentials', () => {
    expect(clientSource).toContain("action: 'start', audioTrackId")
    expect(edgeFunctionSource).toContain(".from('audio_tracks')")
    expect(edgeFunctionSource).toContain(".from(AUDIO_BUCKET)")
    expect(edgeFunctionSource).toContain('.download(track.storage_path!)')
    expect(edgeFunctionSource).toContain('.createSignedUrl(track.storage_path!, 600)')
    expect(clientSource).not.toContain('new FormData')
    expect(edgeFunctionSource).toContain('runPreparedAudioProvider')
  })

  it('maps the required safe error taxonomy without returning provider internals', () => {
    for (const code of [
      'unsupported_audio',
      'missing_stored_file',
      'authorization_failure',
      'provider_configuration_missing',
      'provider_authentication_failed',
      'provider_unavailable',
      'provider_timeout',
      'rate_limit',
      'storage_failure',
      'normalization_failure',
      'database_save_failure',
      'cancelled',
    ]) expect(edgeFunctionSource).toContain(`'${code}'`)
    expect(edgeFunctionSource).toContain("return json({ error: { code: failure.code, message: failure.safeMessage } }")
    expect(edgeFunctionSource).not.toContain('message: error.stack')
  })

  it('keeps provider credentials server-only with no browser-exposed provider key', () => {
    expect(edgeFunctionSource).toContain("requiredEnv('GROQ_API_KEY')")
    expect(edgeFunctionSource).toContain("Deno.env.get('GROQ_TRANSCRIPTION_MODEL')")
    expect(edgeFunctionSource).toContain("Deno.env.get('GROQ_FALLBACK_TRANSCRIPTION_MODEL')")
    expect(edgeFunctionSource).toContain("requiredEnv('LYRIC_TRANSCRIPTION_ENDPOINT_TOKEN')")
    expect(clientSource).not.toMatch(/VITE_(OPENAI|GROQ|ANTHROPIC|DEEPGRAM|ASSEMBLYAI|WHISPER)/)
    expect(edgeFunctionSource).not.toMatch(/VITE_(OPENAI|GROQ|ANTHROPIC|DEEPGRAM|ASSEMBLYAI|WHISPER)/)
    expect(edgeFunctionSource).toContain('https://api.groq.com/openai/v1/audio/transcriptions')
    expect(edgeFunctionSource).not.toContain('https://api.openai.com/v1/audio/transcriptions')
    expect(edgeFunctionSource).not.toContain("requiredEnv('OPENAI_API_KEY')")
    expect(edgeFunctionSource).not.toContain('OPENAI_TRANSCRIPTION_MODEL')
    expect(edgeFunctionSource).toContain("form.append('temperature', '0')")
  })

  it('locks the active Groq Whisper runtime contract while keeping OpenAI historical only', () => {
    const createJobBlock = edgeBlock('async function createJob(', 'async function updateJob(')
    const runtimeProviderBlock = edgeBlock('function runtimeProviderForJob(', 'function safeOptions(')
    const groqProviderBlock = edgeBlock('async function runGroqProvider(', 'async function runPreparedAudioProvider(')

    expect(edgeFunctionSource).toContain("const GROQ_TRANSCRIPTION_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions'")
    expect(groqProviderBlock).toContain("requiredEnv('GROQ_API_KEY')")
    expect(edgeFunctionSource).toContain("Deno.env.get('GROQ_TRANSCRIPTION_MODEL')")
    expect(edgeFunctionSource).toContain("Deno.env.get('GROQ_FALLBACK_TRANSCRIPTION_MODEL')")
    expect(groqProviderBlock).toContain('requestGroqTranscript')
    expect(groqProviderBlock).toContain('groqTranscriptionModels()')
    expect(edgeFunctionSource).toContain('shouldTryGroqFallback')
    expect(edgeFunctionSource).not.toContain('https://api.openai.com/v1/audio/transcriptions')
    expect(edgeFunctionSource).not.toContain('requestOpenAITranscript')
    expect(createJobBlock).toContain('const provider = configuredProvider()')
    expect(createJobBlock).toContain('provider,')
    expect(runtimeProviderBlock).toContain("provider === 'custom' ? 'custom' : 'groq'")
    expect(runtimeProviderBlock).not.toContain("provider === 'openai'")
    expect(edgeFunctionSource).toContain('Historical OpenAI rows stay readable')
  })

  it('requests Groq verbose JSON with word and segment timestamps under bounded runtime settings', () => {
    const requestBlock = edgeBlock('async function requestGroqTranscript(', 'function wavChunkingFailure(')
    const concurrencyBlock = edgeBlock('function groqTranscriptionConcurrency(', 'function groqProviderTimeoutMs(')

    expect(edgeFunctionSource).toContain("const DEFAULT_GROQ_TRANSCRIPTION_MODEL = 'whisper-large-v3-turbo'")
    expect(edgeFunctionSource).toContain('DEFAULT_GROQ_PROVIDER_TIMEOUT_MS = 180_000')
    expect(edgeFunctionSource).toContain('groqProviderTimeoutMs()')
    expect(concurrencyBlock).toContain("positiveEnvInteger('GROQ_TRANSCRIPTION_CONCURRENCY'")
    expect(concurrencyBlock).toContain('DEFAULT_GROQ_CHUNK_CONCURRENCY, 4')
    expect(requestBlock).toContain("form.append('response_format', 'verbose_json')")
    expect(requestBlock).toContain("form.append('timestamp_granularities[]', 'segment')")
    expect(requestBlock).toContain("form.append('timestamp_granularities[]', 'word')")
    expect(requestBlock).toContain('fetchWithTimeout(GROQ_TRANSCRIPTION_ENDPOINT')
    expect(requestBlock).toContain('timeoutMs')
    expect(edgeFunctionSource).toContain("new TranscriptionError('provider_authentication_failed'")
    expect(edgeFunctionSource).toContain("new TranscriptionError('provider_timeout'")
    expect(edgeFunctionSource).toContain("new TranscriptionError('rate_limit'")
  })

  it('keeps active OpenAI transcription residue out of runtime code', () => {
    expect(edgeFunctionSource).not.toContain('api.openai.com/v1/audio/transcriptions')
    expect(edgeFunctionSource).not.toContain('whisper-1')
    expect(edgeFunctionSource).not.toContain('OPENAI_API_KEY')
    expect(edgeFunctionSource).not.toContain('OPENAI_TRANSCRIPTION_MODEL')
    expect(edgeFunctionSource).not.toContain('requestOpenAITranscript')
    expect(clientSource).not.toMatch(/openai.*startLyricTranscription|startLyricTranscription.*openai/i)
    expect(rootEnvExample).not.toMatch(/OPENAI|whisper-1/)
    expect(edgeEnvExample).not.toMatch(/OPENAI|whisper-1/)
  })

  it('keeps Groq environment and documentation canonical without frontend transcription secrets', () => {
    expect(edgeEnvExample).toContain('LYRIC_TRANSCRIPTION_PROVIDER=groq')
    expect(edgeEnvExample).toContain('GROQ_API_KEY=replace-with-server-secret')
    expect(edgeEnvExample).toContain('GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo')
    expect(edgeEnvExample).toContain('GROQ_FALLBACK_TRANSCRIPTION_MODEL=whisper-large-v3')
    expect(edgeEnvExample).not.toContain('OPENAI_API_KEY')
    expect(edgeEnvExample).not.toContain('whisper-1')
    expect(rootEnvExample).not.toMatch(/VITE_(OPENAI|GROQ|ANTHROPIC|DEEPGRAM|ASSEMBLYAI|WHISPER)/)
    expect(deploymentGuide).toContain('Groq Whisper is the provider for new lyric transcription jobs')
    expect(deploymentGuide).toContain('There is intentionally no `VITE_GROQ_API_KEY`')
    expect(deploymentGuide).toContain('Browser users do not send audio or credentials directly to Groq')
    expect(deploymentGuide).toContain('Retry and rate-limit troubleshooting')
    expect(deploymentGuide).toContain('npm run typecheck')
    expect(deploymentGuide).toContain('npm run test')
    expect(deploymentGuide).toContain('npm run build')
    expect(deploymentGuide).toContain('supabase db push')
    expect(deploymentGuide).toContain('supabase secrets set --env-file supabase/functions/.env.local')
    expect(deploymentGuide).toContain('supabase functions deploy lyric-transcription')
    expect(deploymentGuide).toContain('The Supabase CLI commands require a linked project, authenticated CLI session, and network access')
    expect(deploymentGuide).toContain('browser-decode error')
    expect(deploymentGuide).not.toContain('unsupported_audio_codec')
    expect(deploymentGuide).not.toContain('OPENAI_API_KEY')
    expect(deploymentGuide).not.toContain('whisper-1')
    expect(musicIntelligenceDoc).toContain('Groq Whisper is the canonical online provider for new jobs')
    expect(musicIntelligenceDoc).not.toContain('whisperx')
    expect(musicIntelligenceDoc).not.toContain('OpenAI-specific lyric transcription')
  })

  it('creates a new inactive AI draft and completes document, cues, and job in one RPC transaction', () => {
    expect(edgeFunctionSource).toContain("source_type: 'ai_transcription'")
    expect(edgeFunctionSource).toContain("p_provider_metadata: providerMetadata")
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.complete_lyric_transcription_job')
    expect(sql).toContain('v_save_result := public.save_lyric_document_atomic')
    expect(sql).toContain('false )')
    expect(sql).toContain("status = 'completed'")
    expect(sql).toContain('lyric_document_id = v_document_id')
  })

  it('keeps normal files single-request while transparently chunking oversized PCM WAV files', () => {
    expect(edgeFunctionSource).toContain('const forceChunking = durationMs >= FIVE_MINUTES_MS && durationMs > maxUnitMs')
    expect(edgeFunctionSource).toContain('planTranscriptionUnits(durationMs, { forceChunking: false })')
    expect(edgeFunctionSource).toContain('planWavTranscriptionChunks(sourceBytes')
    expect(edgeFunctionSource).toContain('buildWavTranscriptionChunk(sourceBytes, plan, descriptor)')
    expect(edgeFunctionSource).toContain('groqTranscriptionConcurrency()')
    expect(edgeFunctionSource).toContain('GROQ_TRANSCRIPTION_CONCURRENCY')
    expect(edgeFunctionSource).not.toContain('OPENAI_TRANSCRIPTION_CONCURRENCY')
    expect(edgeFunctionSource).toContain('reconcileTranscriptUnits(normalizedUnits)')
  })

  it('embeds a function version identifier in every job response to detect stale deployments', () => {
    expect(edgeFunctionSource).toContain('LYRIC_TRANSCRIPTION_FN_VERSION')
    expect(edgeFunctionSource).toContain('fnVersion: LYRIC_TRANSCRIPTION_FN_VERSION')
    expect(edgeFunctionSource).toContain("processingMode,")
  })

  it('routes oversized compressed files through browser-prepared private audio with an optional worker fallback', () => {
    expect(edgeFunctionSource).toContain("'transcription_asset_required'")
    expect(edgeFunctionSource).toContain('isCustomProviderConfigured()')
    expect(edgeFunctionSource).toContain('isLikelyWavFile(track)')
    expect(edgeFunctionSource).toContain("processingMode = 'long-audio-worker'")
    expect(edgeFunctionSource).toContain("processingMode = 'wav-chunking'")
    expect(edgeFunctionSource).toContain("processingMode = 'prepared-audio'")
    expect(edgeFunctionSource).toContain("processingMode = 'direct'")
    expect(extractorSource).toContain('isBrowserCodecFallbackError')
    expect(extractorSource).toContain('Extraction queued through the secure server fallback')
  })

  it('sets chunk totals before chunk requests and validates prepared audio invariants', () => {
    const runGroqBlock = edgeBlock('async function runGroqProvider(', 'async function runPreparedAudioProvider(')
    const preparedManifestBlock = edgeBlock('function preparedAudioManifest(', 'function publicJob(')
    const preparedRunBlock = edgeBlock('async function runPreparedAudioProvider(', 'async function runCustomProvider(')
    const wavPlanIndex = runGroqBlock.indexOf('plan = planWavTranscriptionChunks')
    const plannedChunksIndex = runGroqBlock.indexOf('if (plannedChunks) await plannedChunks(plan.chunks.length)')
    const chunkRequestIndex = runGroqBlock.indexOf('const result = await requestGroqTranscript(', plannedChunksIndex)
    const preparedUpdateIndex = edgeFunctionSource.indexOf('chunksTotal: prepared.chunks.length')
    const preparedRunIndex = edgeFunctionSource.indexOf('providerResult = await runPreparedAudioProvider(')

    expect(wavPlanIndex).toBeGreaterThanOrEqual(0)
    expect(plannedChunksIndex).toBeGreaterThan(wavPlanIndex)
    expect(chunkRequestIndex).toBeGreaterThan(plannedChunksIndex)
    expect(preparedUpdateIndex).toBeGreaterThanOrEqual(0)
    expect(preparedRunIndex).toBeGreaterThan(preparedUpdateIndex)
    expect(preparedManifestBlock).toContain("storagePath.startsWith(`${track.user_id}/`)")
    expect(preparedManifestBlock).toContain("item.mimeType !== 'audio/wav'")
    expect(preparedManifestBlock).toContain('byteSize === null || byteSize <= 44 || byteSize > maxChunkBytes')
    expect(preparedRunBlock).toContain('blob.size !== chunk.byteSize || blob.size > safeBytes')
    expect(preparedRunBlock).toContain('!isRiffWave(bytes)')
  })


  it('stores bounded user-owned prepared-audio manifests on audio tracks', () => {
    expect(preparedAudioSql).toContain('ADD COLUMN IF NOT EXISTS transcription_assets jsonb')
    expect(preparedAudioSql).toContain('audio_tracks_transcription_assets_shape_check')
    expect(preparedAudioSql).toContain('octet_length(transcription_assets::text) <= 131072')
    expect(edgeFunctionSource).toContain('preparedAudioManifest(track, maxBytes, preparationOperationId)')
    expect(edgeFunctionSource).toContain("storagePath.startsWith(`${track.user_id}/`)")
    expect(edgeFunctionSource).toContain("preprocessingRuntime: 'browser-web-audio'")
  })

  it('reports named processing stages and per-chunk progress throughout the job lifecycle', () => {
    expect(edgeFunctionSource).toContain("processingStage: 'validating'")
    expect(edgeFunctionSource).toContain("processingStage: 'downloading'")
    expect(edgeFunctionSource).toContain("processingStage: 'inspecting'")
    expect(edgeFunctionSource).toContain("processingStage: 'transcribing'")
    expect(edgeFunctionSource).toContain("processingStage: 'merging'")
    expect(edgeFunctionSource).toContain("processingStage: 'saving'")
    expect(edgeFunctionSource).toContain('chunksCompleted')
    expect(edgeFunctionSource).toContain('chunksTotal')
  })

  it('sanitizes and bounds provider metadata before persisting raw previews', () => {
    const sanitizerBlock = edgeBlock('function shouldRedactProviderMetadataKey(', 'function databaseCue(')

    expect(edgeFunctionSource).toContain('RAW_PROVIDER_METADATA_LIMIT = 120_000')
    expect(sanitizerBlock).toContain("lower.includes('key')")
    expect(sanitizerBlock).toContain("lower.includes('token')")
    expect(sanitizerBlock).toContain("lower.includes('authorization')")
    expect(sanitizerBlock).toContain("lower.includes('signedurl')")
    expect(sanitizerBlock).toContain("lower.includes('url')")
    expect(sanitizerBlock).toContain("lower.includes('path')")
    expect(sanitizerBlock).toContain('/https?:\\/\\//i.test(value)')
    expect(sanitizerBlock).toContain('/storage\\/v1\\/object/i.test(value)')
    expect(sanitizerBlock).toContain("return '[redacted]'")
    expect(sanitizerBlock).toContain('serialized.slice(0, RAW_PROVIDER_METADATA_LIMIT)')
    expect(sanitizerBlock).toContain('rawResponsePreview: serialized')
    expect(finalAuditSql).toContain('octet_length(provider_metadata::text) <= 524288')
  })

  it('stores global lyric offset separately instead of baking it into cue timestamps', () => {
    const databaseCueBlock = edgeBlock('function databaseCue(', 'async function processJob(')
    const normalizationBlock = edgeBlock('const normalizedUnits = providerResult.transcripts.map', 'const providerMetadata = {')

    expect(databaseCueBlock).toContain('start_ms: Math.max(0, Math.round(cue.startMs))')
    expect(databaseCueBlock).toContain('end_ms: Math.max(1, Math.round(cue.endMs))')
    expect(databaseCueBlock).not.toContain('globalOffset')
    expect(normalizationBlock).toContain('global_offset_ms: finiteNumber(job.request_options.globalOffsetMs) ?? 0')
    expect(normalizationBlock).not.toContain('cue.startMs +')
    expect(normalizationBlock).not.toContain('cue.endMs +')
  })

  it('passes request options through the full pipeline including WAV chunking and custom provider', () => {
    expect(edgeFunctionSource).toContain('job.request_options')
    expect(edgeFunctionSource).toContain('runGroqProvider(audioBlob, track, job.request_options')
    expect(edgeFunctionSource).toContain('runCustomProvider(adminClient, track, job.request_options)')
    expect(edgeFunctionSource).toContain('safeOptions(job.request_options)')
  })
})
