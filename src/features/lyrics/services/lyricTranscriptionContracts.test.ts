import { describe, expect, it } from 'vitest'
import type { LyricTranscriptionProviderName } from '../../../types/lyrics'
import migrationSql from '../../../../supabase/migrations/0016_lyric_transcription_jobs.sql?raw'
import finalAuditMigrationSql from '../../../../supabase/migrations/0017_lyric_final_audit.sql?raw'
import preparedAudioMigrationSql from '../../../../supabase/migrations/0019_audio_transcription_assets.sql?raw'
import groqProviderMigrationSql from '../../../../supabase/migrations/0020_groq_lyric_transcription_provider.sql?raw'
import edgeFunctionSource from '../../../../supabase/functions/lyric-transcription/index.ts?raw'
import clientSource from './lyricExtraction.ts?raw'
import extractorSource from '../components/AiLyricExtractor.tsx?raw'

const compact = (value: string) => value.replace(/\s+/g, ' ').trim()
const sql = compact(migrationSql)
const finalAuditSql = compact(finalAuditMigrationSql)
const preparedAudioSql = compact(preparedAudioMigrationSql)
const groqProviderSql = compact(groqProviderMigrationSql)

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
    expect(extractorSource).toContain('startLyricTranscription(selectedTrack.dbId, options)')
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
    expect(edgeFunctionSource).toContain("requiredEnv('LYRIC_TRANSCRIPTION_ENDPOINT_TOKEN')")
    expect(clientSource).not.toMatch(/VITE_(OPENAI|GROQ|ANTHROPIC|DEEPGRAM|ASSEMBLYAI|WHISPER)/)
    expect(edgeFunctionSource).not.toMatch(/VITE_(OPENAI|GROQ|ANTHROPIC|DEEPGRAM|ASSEMBLYAI|WHISPER)/)
    expect(edgeFunctionSource).toContain('https://api.groq.com/openai/v1/audio/transcriptions')
    expect(edgeFunctionSource).not.toContain('https://api.openai.com/v1/audio/transcriptions')
    expect(edgeFunctionSource).toContain("form.append('temperature', '0')")
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
    expect(edgeFunctionSource).toContain('providerTranscriptionConcurrency()')
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
  })


  it('stores bounded user-owned prepared-audio manifests on audio tracks', () => {
    expect(preparedAudioSql).toContain('ADD COLUMN IF NOT EXISTS transcription_assets jsonb')
    expect(preparedAudioSql).toContain('audio_tracks_transcription_assets_shape_check')
    expect(preparedAudioSql).toContain('octet_length(transcription_assets::text) <= 131072')
    expect(edgeFunctionSource).toContain('preparedAudioManifest(track, maxBytes)')
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

  it('passes request options through the full pipeline including WAV chunking and custom provider', () => {
    expect(edgeFunctionSource).toContain('job.request_options')
    expect(edgeFunctionSource).toContain('runGroqProvider(audioBlob, track, job.request_options')
    expect(edgeFunctionSource).toContain('runCustomProvider(adminClient, track, job.request_options)')
    expect(edgeFunctionSource).toContain('safeOptions(job.request_options)')
  })
})
