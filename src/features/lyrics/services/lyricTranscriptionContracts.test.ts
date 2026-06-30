import { describe, expect, it } from 'vitest'
import migrationSql from '../../../../supabase/migrations/0016_lyric_transcription_jobs.sql?raw'
import finalAuditMigrationSql from '../../../../supabase/migrations/0017_lyric_final_audit.sql?raw'
import edgeFunctionSource from '../../../../supabase/functions/lyric-transcription/index.ts?raw'
import clientSource from './lyricExtraction.ts?raw'

const compact = (value: string) => value.replace(/\s+/g, ' ').trim()
const sql = compact(migrationSql)
const finalAuditSql = compact(finalAuditMigrationSql)

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

  it('uses audio_tracks.id and server-side storage access instead of browser file re-upload', () => {
    expect(clientSource).toContain("action: 'start', audioTrackId")
    expect(edgeFunctionSource).toContain(".from('audio_tracks')")
    expect(edgeFunctionSource).toContain(".from(AUDIO_BUCKET)")
    expect(edgeFunctionSource).toContain('.download(track.storage_path!)')
    expect(edgeFunctionSource).toContain('.createSignedUrl(track.storage_path!, 600)')
    expect(clientSource).not.toContain('new FormData')
  })

  it('maps the required safe error taxonomy without returning provider internals', () => {
    for (const code of [
      'unsupported_audio',
      'missing_stored_file',
      'authorization_failure',
      'provider_configuration_missing',
      'provider_rejection',
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
    expect(edgeFunctionSource).toContain("requiredEnv('OPENAI_API_KEY')")
    expect(edgeFunctionSource).toContain("requiredEnv('LYRIC_TRANSCRIPTION_ENDPOINT_TOKEN')")
    expect(clientSource).not.toMatch(/VITE_(OPENAI|ANTHROPIC|DEEPGRAM|ASSEMBLYAI|WHISPER)/)
    expect(edgeFunctionSource).not.toMatch(/VITE_(OPENAI|ANTHROPIC|DEEPGRAM|ASSEMBLYAI|WHISPER)/)
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
    expect(edgeFunctionSource).toContain("positiveEnvInteger(\n    'OPENAI_TRANSCRIPTION_CONCURRENCY'")
    expect(edgeFunctionSource).toContain('reconcileTranscriptUnits(normalizedUnits)')
  })

  it('embeds a function version identifier in every job response to detect stale deployments', () => {
    expect(edgeFunctionSource).toContain('LYRIC_TRANSCRIPTION_FN_VERSION')
    expect(edgeFunctionSource).toContain('fnVersion: LYRIC_TRANSCRIPTION_FN_VERSION')
    expect(edgeFunctionSource).toContain("processingMode,")
  })

  it('returns distinct long_audio_backend_not_configured code for oversized compressed files without a backend', () => {
    expect(edgeFunctionSource).toContain("'long_audio_backend_not_configured'")
    expect(edgeFunctionSource).toContain('isCustomProviderConfigured()')
    expect(edgeFunctionSource).toContain('isLikelyWavFile(track)')
    expect(edgeFunctionSource).toContain("processingMode = 'long-audio-worker'")
    expect(edgeFunctionSource).toContain("processingMode = 'wav-chunking'")
    expect(edgeFunctionSource).toContain("processingMode = 'direct'")
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
    expect(edgeFunctionSource).toContain('runOpenAIProvider(audioBlob, track, job.request_options')
    expect(edgeFunctionSource).toContain('runCustomProvider(adminClient, track, job.request_options)')
    expect(edgeFunctionSource).toContain('safeOptions(job.request_options)')
  })
})
