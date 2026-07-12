import { describe, expect, it } from 'vitest'
import migrationSource from '../../../../supabase/migrations/0027_audio_deletion_preparation_safety.sql?raw'
import edgeSource from '../../../../supabase/functions/lyric-transcription/index.ts?raw'
import localPreparationSource from './localAudioPreparation.ts?raw'
import workerSource from './localAudioPreparation.worker.ts?raw'
import lyricManagerSource from '../LyricManagerView.tsx?raw'
import audioStoreSource from '../../../stores/audioStore.ts?raw'
import audioDbSource from '../../../lib/audioDb.ts?raw'

const compact = (value: string) => value.replace(/\s+/g, ' ').trim()
const sql = compact(migrationSource)

describe('audio deletion and preparation safety contracts', () => {
  it('uses one canonical deletion operation from Lyric Manager, the audio store, and legacy audioDb callers', () => {
    expect(lyricManagerSource).toContain('removeSavedTrackByDbId(trackDeleteTarget.dbId)')
    expect(lyricManagerSource).not.toContain("from('audio_tracks').delete")
    expect(audioStoreSource).toContain('deleteAudioTrackCanonical(dbId)')
    expect(audioDbSource).toContain('deleteAudioTrackCanonical(id)')
    expect(audioDbSource).not.toContain("from('audio_tracks').delete().eq('id', id)")
  })

  it('server-derives exact user, track, operation, and chunk paths and rejects arbitrary client paths', () => {
    expect(sql).toContain("format('%s/transcription-chunks/%s/%s/chunk-%s.wav'")
    expect(sql).toContain('public.audio_storage_path_is_owned(v_user_id, v_track.storage_path)')
    expect(sql).toContain("p_path LIKE p_user_id::text || '/%'")
    expect(sql).toContain("p_path !~ '(^|/)\\.\\.(/|$)'")
    expect(sql).not.toContain('p_storage_path')
    expect(sql).toContain("status IN ('pending', 'failed')")
    expect(sql).toContain("lifecycle_status = 'deletion_pending'")
    expect(sql).toContain('REVOKE DELETE ON TABLE public.audio_tracks FROM anon, authenticated')
    expect(sql).toContain('REVOKE UPDATE ON TABLE public.audio_tracks FROM anon, authenticated')
  })

  it('retains canonical paths until storage cleanup completes and only then deletes cascading database derivatives', () => {
    expect(sql).toContain('storage_paths jsonb NOT NULL')
    expect(sql).toContain('completed_paths jsonb NOT NULL')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.finalize_audio_track_deletion')
    expect(sql).toContain('Audio storage cleanup is incomplete.')
    expect(sql).toContain('DELETE FROM public.audio_tracks')
    expect(sql).toContain('jsonb_array_elements_text(operation.superseded_paths)')
    expect(sql).toContain('audio_track_id uuid NOT NULL REFERENCES public.audio_tracks(id) ON DELETE CASCADE')
    expect(sql).toContain('track_id_snapshot uuid NOT NULL')
  })

  it('persists retry-stable operation identity, deterministic paths, upload state, manifest state, jobs, and cleanup recovery', () => {
    for (const token of [
      'operation_id uuid NOT NULL',
      'intended_paths jsonb NOT NULL',
      'uploaded_chunks jsonb NOT NULL',
      'cleanup_completed_indices jsonb NOT NULL',
      'manifest_saved boolean NOT NULL',
      'job_id uuid NULL',
      'superseded_paths jsonb NOT NULL',
      'superseded_completed_paths jsonb NOT NULL',
      'CONSTRAINT audio_preparation_operations_user_operation_key UNIQUE (user_id, operation_id)',
      'CREATE OR REPLACE FUNCTION public.record_audio_preparation_cleanup',
      'CREATE OR REPLACE FUNCTION public.record_audio_preparation_superseded_cleanup',
    ]) expect(sql).toContain(token)
    expect(sql).toContain('WHERE user_id = v_user_id AND operation_id = p_operation_id')
  })

  it('prevents incomplete manifests and foreign prepared-audio paths from creating jobs', () => {
    expect(sql).toContain('jsonb_array_length(v_operation.uploaded_chunks) <> v_operation.intended_chunk_count')
    expect(sql).toContain("chunk.value->>'storagePath' <> v_operation.intended_paths")
    expect(edgeSource).toContain('validatePreparationOperation')
    expect(edgeSource).toContain('root.version === PREPARED_AUDIO_VERSION && (!operationId || !expectedOperationId)')
    expect(edgeSource).toContain("!operation.manifest_saved || !['manifest_saved', 'job_created'].includes(operation.status)")
    expect(edgeSource).toContain('cleanupUnattachedPreparationOperation')
    expect(edgeSource).toContain('manifest.chunks.some((chunk, index) => chunk.storagePath !== operation.intended_paths[index])')
    expect(edgeSource).toContain("!['failed', 'cancelled'].includes(String(priorJob.status))")
  })

  it('keeps all renderer stages operation-owned and checks cancellation before commits', () => {
    expect(localPreparationSource).toContain('throwIfCancelled(signal, isCurrent)')
    expect(localPreparationSource).toContain('Record the deterministic asset before honoring cancellation')
    expect(localPreparationSource).toContain("failurePhase = 'Manifest save'")
    expect(localPreparationSource).toContain('rollbackPreparedTranscriptionAudio')
    expect(localPreparationSource).toContain('encoder?.terminate()')
    expect(edgeSource).toContain('const assertCurrent = () => throwIfJobCancelled')
    expect(edgeSource).toContain('if (assertCurrent) await assertCurrent()')
    expect(edgeSource).toContain('if (await jobWasCancelled(adminClient, job.id)) return')
  })

  it('uses one bounded worker, transferable PCM, operation-scoped messages, and explicit retirement', () => {
    expect(localPreparationSource).toContain("new Worker(new URL('./localAudioPreparation.worker.ts'")
    expect(localPreparationSource).toContain('if (pending) return Promise.reject')
    expect(localPreparationSource).toContain('rejectReady(abortError)')
    expect(localPreparationSource).toContain('}, [pcm.buffer])')
    expect(localPreparationSource).toContain("worker.postMessage({ type: 'cancel', operationId })")
    expect(localPreparationSource).toContain('worker.terminate()')
    expect(workerSource).toContain('message.operationId !== activeOperationId')
    expect(workerSource).toContain('pcm = null')
    expect(workerSource).toContain('plans = []')
    expect(workerSource).toContain('workerScope.close()')
    expect(workerSource).not.toContain('.slice(')
  })

  it('documents that browser decode is not abortable while preventing any later stage from committing', () => {
    expect(localPreparationSource).toContain('decodeAudioData itself is not abortable in browsers')
    expect(localPreparationSource).toContain('immediately before and after so a cancelled decode cannot advance')
    expect(localPreparationSource).toContain('sourceBuffer = null')
    expect(localPreparationSource).toContain('chunks.length = 0')
  })
})
