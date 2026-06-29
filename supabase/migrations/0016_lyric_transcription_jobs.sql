-- Secure, resumable lyric transcription jobs and transactional draft completion.

CREATE TABLE IF NOT EXISTS public.lyric_transcription_jobs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_track_id      uuid NOT NULL REFERENCES public.audio_tracks(id) ON DELETE CASCADE,
  lyric_document_id   uuid NULL REFERENCES public.lyric_documents(id) ON DELETE SET NULL,
  provider            text NOT NULL,
  status              text NOT NULL DEFAULT 'queued',
  progress            double precision NOT NULL DEFAULT 0,
  error_code           text NULL,
  error_message        text NULL,
  provider_metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_options     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  started_at          timestamptz NULL,
  completed_at        timestamptz NULL,

  CONSTRAINT lyric_transcription_jobs_provider_check CHECK (
    provider IN ('openai', 'custom')
  ),
  CONSTRAINT lyric_transcription_jobs_status_check CHECK (
    status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')
  ),
  CONSTRAINT lyric_transcription_jobs_progress_check CHECK (
    progress >= 0 AND progress <= 1
  ),
  CONSTRAINT lyric_transcription_jobs_metadata_object_check CHECK (
    jsonb_typeof(provider_metadata) = 'object'
  ),
  CONSTRAINT lyric_transcription_jobs_options_object_check CHECK (
    jsonb_typeof(request_options) = 'object'
  )
);

COMMENT ON TABLE public.lyric_transcription_jobs IS
  'Server-owned status records for secure timed-lyric transcription of persisted audio tracks.';
COMMENT ON COLUMN public.lyric_transcription_jobs.error_message IS
  'Sanitized user-facing failure text. Provider secrets, stack traces, signed URLs, and storage paths must never be stored here.';
COMMENT ON COLUMN public.lyric_transcription_jobs.provider_metadata IS
  'Bounded diagnostic metadata. Raw provider output may be retained only after secret and URL removal.';

CREATE INDEX IF NOT EXISTS idx_lyric_transcription_jobs_user_created
  ON public.lyric_transcription_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lyric_transcription_jobs_track_created
  ON public.lyric_transcription_jobs(audio_track_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lyric_transcription_jobs_status_updated
  ON public.lyric_transcription_jobs(status, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lyric_transcription_jobs_active_track
  ON public.lyric_transcription_jobs(user_id, audio_track_id)
  WHERE status IN ('queued', 'processing');

DROP TRIGGER IF EXISTS set_updated_at_lyric_transcription_jobs
  ON public.lyric_transcription_jobs;
CREATE TRIGGER set_updated_at_lyric_transcription_jobs
  BEFORE UPDATE ON public.lyric_transcription_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.lyric_transcription_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select their own lyric transcription jobs"
  ON public.lyric_transcription_jobs;
CREATE POLICY "Users can select their own lyric transcription jobs"
  ON public.lyric_transcription_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No direct INSERT, UPDATE, or DELETE policy is installed. Job mutation belongs
-- to the authenticated Edge Function, which verifies ownership before using its
-- service-role client. Users can read only their own sanitized job rows.

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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'authorization_failure',
      'message', 'Authentication is required to complete lyric transcription.'
    );
  END IF;

  IF p_document IS NULL OR jsonb_typeof(p_document) <> 'object'
     OR p_cues IS NULL OR jsonb_typeof(p_cues) <> 'array'
     OR p_provider_metadata IS NULL OR jsonb_typeof(p_provider_metadata) <> 'object' THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Transcription completion payloads have an invalid JSON shape.'
    );
  END IF;

  SELECT *
  INTO v_job
  FROM public.lyric_transcription_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND OR v_job.user_id <> v_user_id THEN
    RETURN jsonb_build_object(
      'status', 'authorization_failure',
      'message', 'The transcription job is unavailable or is not owned by the current user.'
    );
  END IF;

  IF v_job.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'status', 'cancelled',
      'message', 'The transcription job was cancelled before its draft was saved.'
    );
  END IF;

  IF v_job.status NOT IN ('queued', 'processing') THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'message', 'Only an active transcription job can create a lyric draft.'
    );
  END IF;

  IF NULLIF(p_document->>'audio_track_id', '')::uuid IS DISTINCT FROM v_job.audio_track_id THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'The lyric draft must remain attached to the job audio track.'
    );
  END IF;

  v_save_result := public.save_lyric_document_atomic(
    NULL,
    NULL,
    p_document,
    p_cues,
    false
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
    provider_metadata = p_provider_metadata,
    completed_at = clock_timestamp()
  WHERE id = v_job.id;

  RETURN jsonb_build_object(
    'status', 'success',
    'job_id', v_job.id,
    'document', v_save_result->'document',
    'cues', v_save_result->'cues'
  );
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'The transcription completion payload contains an invalid identifier.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'status', 'unexpected_failure',
      'message', 'The transcription draft could not be saved.',
      'error_code', SQLSTATE
    );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_lyric_transcription_job(uuid, jsonb, jsonb, jsonb)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_lyric_transcription_job(uuid, jsonb, jsonb, jsonb)
  TO authenticated;
