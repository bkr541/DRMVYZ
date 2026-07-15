import { describe, expect, it } from 'vitest'
import migrationSql from '../../../../supabase/migrations/0029_vocal_reference_lyric_extraction.sql?raw'
import edgeFunctionSource from '../../../../supabase/functions/lyric-transcription/index.ts?raw'
import extractorSource from '../components/AiLyricExtractor.tsx?raw'
import managerSource from '../LyricManagerView.tsx?raw'
import extractionClientSource from './lyricExtraction.ts?raw'
import preparationSource from './localAudioPreparation.ts?raw'
import runtimeBridgeSource from '../ActiveTrackLyricsBridge.tsx?raw'

const compact = (value: string) => value.replace(/\s+/g, ' ').trim()
const sql = compact(migrationSql)

describe('vocal-reference lyric extraction contracts', () => {
  it('creates a normalized, user-owned analysis source relationship with cleanup-safe foreign keys and RLS', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.audio_analysis_sources')
    expect(sql).toContain('owner_audio_track_id uuid NOT NULL REFERENCES public.audio_tracks(id) ON DELETE CASCADE')
    expect(sql).toContain('source_audio_track_id uuid NOT NULL REFERENCES public.audio_tracks(id) ON DELETE CASCADE')
    expect(sql).toContain("CHECK (source_type IN ('vocal_reference'))")
    expect(sql).toContain('CHECK (owner_audio_track_id <> source_audio_track_id)')
    expect(sql).toContain('audio analysis source tracks must be complete and owned by the same user')
    expect(sql).toContain('ALTER TABLE public.audio_analysis_sources ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('USING (user_id = auth.uid())')
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON public.audio_analysis_sources FROM authenticated')
  })

  it('extends jobs without changing canonical owner uniqueness', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS analysis_source_id uuid NULL')
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS source_mode text NOT NULL DEFAULT 'full_mix'")
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS timing_offset_ms integer NOT NULL DEFAULT 0')
    expect(sql).not.toContain('DROP INDEX IF EXISTS uq_lyric_transcription_jobs_active_track')
    expect(edgeFunctionSource).toContain('activeJob(adminClient, userId, resolvedSource.ownerTrack.id)')
    expect(edgeFunctionSource).toContain('audio_track_id: resolvedSource.ownerTrack.id')
    expect(edgeFunctionSource).toContain('analysis_source_id: resolvedSource.relationship?.id ?? null')
  })

  it('validates owner and source ownership independently and rejects missing sources', () => {
    expect(edgeFunctionSource).toContain('const ownerTrack = await ownedTrack(adminClient, userId, body.audioTrackId)')
    expect(edgeFunctionSource).toContain('const sourceTrack = await ownedTrack(adminClient, userId, request.analysisSourceAudioTrackId)')
    expect(edgeFunctionSource).toContain(".eq('user_id', userId)")
    expect(edgeFunctionSource).toContain("new TranscriptionError('analysis_source_missing'")
    expect(edgeFunctionSource).toContain("new TranscriptionError('authorization_failure'")
  })

  it('keeps full-mix extraction as the default source mode', () => {
    expect(extractionClientSource).toContain("source: LyricTranscriptionSourceRequest = { sourceMode: 'full_mix' }")
    expect(edgeFunctionSource).toContain("request.sourceMode === 'vocal_reference' ? 'vocal_reference' : 'full_mix'")
    expect(edgeFunctionSource).toContain('sourceTrack: ownerTrack')
    expect(edgeFunctionSource).toContain('timingOffsetMs: 0')
  })

  it('prepares and transcribes the source track while persisting the document against the owner track', () => {
    expect(extractorSource).toContain('ensurePreparedTranscriptionAudio(transcriptionTrack')
    expect(edgeFunctionSource).toContain('const track = resolvedSource.sourceTrack')
    expect(edgeFunctionSource).toContain('preparedAudioManifest(track, maxBytes, preparationOperationId)')
    expect(edgeFunctionSource).toContain('.download(track.storage_path!)')
    expect(edgeFunctionSource).toContain('audio_track_id: ownerTrack.id')
    expect(edgeFunctionSource).toContain('lyricsOwnerAudioTrackId: ownerTrack.id')
    expect(edgeFunctionSource).toContain('transcriptionSourceAudioTrackId: track.id')
    expect(preparationSource).toContain('track.transcriptionAssets')
  })

  it('applies vocal-reference offset once before cue segmentation and records source timing provenance', () => {
    const shiftIndex = edgeFunctionSource.indexOf('shiftReconciledTranscriptToOwnerTimeline(')
    const segmentIndex = edgeFunctionSource.indexOf('selectUsefulCues(reconciled')
    expect(shiftIndex).toBeGreaterThanOrEqual(0)
    expect(segmentIndex).toBeGreaterThan(shiftIndex)
    expect(edgeFunctionSource).toContain('timestampsShiftedToOwnerTimeline: resolvedSource.mode === \'vocal_reference\'')
    expect(edgeFunctionSource).toContain('vocalReferenceOffsetMs: resolvedSource.timingOffsetMs')
    expect(edgeFunctionSource).toContain('providerSourceDurationMs: shifted.sourceDurationMs')
  })

  it('requires explicit confirmation for significant mismatches and blocks clearly different arrangements', () => {
    expect(extractorSource).toContain('sourceCompatibility.requiresConfirmation && !significantMismatchConfirmed')
    expect(extractorSource).toContain('sourceCompatibility.blocked')
    expect(edgeFunctionSource).toContain('compatibility.blocked')
    expect(edgeFunctionSource).toContain('request.confirmSignificantMismatch !== true')
    expect(edgeFunctionSource).toContain("'analysis_source_confirmation_required'")
    expect(edgeFunctionSource).toContain("'analysis_source_arrangement_mismatch'")
  })

  it('reuses the existing upload workflow and returns the saved track as a vocal reference', () => {
    expect(managerSource).toContain("uploadPurpose === 'vocal_reference'")
    expect(managerSource).toContain('setUploadedVocalReferenceTrack(managerTrack)')
    expect(managerSource).toContain('<MediaUploadModal')
    expect(managerSource).toContain("setUploadPurpose('vocal_reference')")
    expect(managerSource).not.toContain('VocalReferenceUploadModal')
    expect(managerSource).toContain('onResolveSavedTrack={resolveSavedTrackForAi}')
    expect(extractorSource).toContain('onResolveSavedTrack(vocalReferenceTrackId)')
  })

  it('cancels active jobs when a source relationship is deleted and retains retry source identity', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.cancel_jobs_for_deleted_audio_analysis_source()')
    expect(sql).toContain("WHERE analysis_source_id = OLD.id AND status IN ('queued', 'processing')")
    expect(edgeFunctionSource).toContain('resolveRetryAnalysisSource')
    expect(edgeFunctionSource).toContain(".eq('id', job.analysis_source_id)")
    expect(edgeFunctionSource).toContain('normalizeVocalReferenceOffsetMs(job.timing_offset_ms)')
    expect(edgeFunctionSource).toContain('validatePreparationOperation(adminClient, userId, resolvedSource.sourceTrack')
    expect(edgeFunctionSource).toContain('clearAnalysisSourcePreparationReference')
    expect(edgeFunctionSource).toContain(".update({ preparation_operation_id: null, preparation_metadata: {} })")
  })

  it('validates canonical ownership again inside transactional lyric completion', () => {
    expect(sql).toContain("NULLIF(p_document->>'audio_track_id', '')::uuid IS DISTINCT FROM v_job.audio_track_id")
    expect(sql).toContain('source.owner_audio_track_id = v_job.audio_track_id')
    expect(sql).toContain("source.source_type = 'vocal_reference'")
    expect(sql).toContain('v_save_result := public.save_lyric_document_atomic(NULL, NULL, p_document, p_cues, v_should_activate)')
  })

  it('continues resolving runtime lyrics by the canonical loaded audio track', () => {
    expect(runtimeBridgeSource).toContain('currentAudioTrackId')
    expect(runtimeBridgeSource).toContain('resolveRuntimeLyricsForAudioTrack(audioTrackId')
    expect(edgeFunctionSource).toContain('audio_track_id: ownerTrack.id')
  })

  it('preserves Cue Style and full-mix Track Map segmentation for vocal-reference jobs', () => {
    expect(edgeFunctionSource).toContain('normalizeLyricCueStyle(job.request_options.cueStyle)')
    expect(edgeFunctionSource).toContain('authoritativeTrackAnalysis(adminClient, ownerTrack.id)')
    expect(edgeFunctionSource).toContain('selectUsefulCues(reconciled, { cueStyle, musicalStructure: trackAnalysis.structure })')
    expect(extractorSource).toContain('LYRIC_CUE_STYLE_LABELS')
  })
})
