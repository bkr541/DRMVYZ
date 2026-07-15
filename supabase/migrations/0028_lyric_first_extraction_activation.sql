-- Atomically activate only the first successful AI lyric extraction for a track.
-- The audio_tracks row is the serialization lock shared by lyric saves and
-- activation, so concurrent extraction completions cannot both become active.

CREATE OR REPLACE FUNCTION public.complete_lyric_transcription_job(
  p_job_id uuid,
  p_document jsonb,
  p_cues jsonb,
  p_provider_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_job public.lyric_transcription_jobs%ROWTYPE;
  v_save_result jsonb;
  v_document_id uuid;
  v_should_activate boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'Authentication is required to complete lyric transcription.');
  END IF;

  IF p_document IS NULL OR jsonb_typeof(p_document) <> 'object'
     OR p_cues IS NULL OR jsonb_typeof(p_cues) <> 'array'
     OR p_provider_metadata IS NULL OR jsonb_typeof(p_provider_metadata) <> 'object' THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Transcription completion payloads have an invalid JSON shape.');
  END IF;

  SELECT * INTO v_job
  FROM public.lyric_transcription_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND OR v_job.user_id <> v_user_id THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The transcription job is unavailable or is not owned by the current user.');
  END IF;

  IF v_job.status = 'cancelled' THEN
    RETURN jsonb_build_object('status', 'cancelled', 'message', 'The transcription job was cancelled before its draft was saved.');
  END IF;

  IF v_job.status NOT IN ('queued', 'processing') THEN
    RETURN jsonb_build_object('status', 'conflict', 'message', 'Only an active transcription job can create a lyric draft.');
  END IF;

  IF NULLIF(p_document->>'audio_track_id', '')::uuid IS DISTINCT FROM v_job.audio_track_id THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The lyric draft must remain attached to the job audio track.');
  END IF;

  PERFORM 1
  FROM public.audio_tracks
  WHERE id = v_job.audio_track_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The transcription audio track is unavailable.');
  END IF;

  v_should_activate := NOT EXISTS (
    SELECT 1
    FROM public.lyric_documents
    WHERE user_id = v_user_id
      AND audio_track_id = v_job.audio_track_id
      AND is_active = true
  );

  v_save_result := public.save_lyric_document_atomic(
    NULL,
    NULL,
    p_document,
    p_cues,
    v_should_activate
  );

  IF COALESCE(v_save_result->>'status', '') <> 'success' THEN
    RETURN v_save_result;
  END IF;

  v_document_id := NULLIF(v_save_result->'document'->>'id', '')::uuid;

  UPDATE public.lyric_transcription_jobs
  SET
    lyric_document_id = v_document_id,
    status = 'completed',
    progress = 1,
    error_code = NULL,
    error_message = NULL,
    provider_metadata = p_provider_metadata || jsonb_build_object('autoActivated', v_should_activate),
    completed_at = clock_timestamp()
  WHERE id = v_job.id;

  RETURN jsonb_build_object(
    'status', 'success',
    'job_id', v_job.id,
    'document', v_save_result->'document',
    'cues', v_save_result->'cues',
    'auto_activated', v_should_activate
  );
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The transcription completion payload contains an invalid identifier.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'unexpected_failure', 'message', 'The transcription draft could not be saved.', 'error_code', SQLSTATE);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_lyric_transcription_job(uuid, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_lyric_transcription_job(uuid, jsonb, jsonb, jsonb) TO authenticated;
