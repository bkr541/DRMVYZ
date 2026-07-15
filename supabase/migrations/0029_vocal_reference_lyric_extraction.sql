-- Vocal-reference lyric extraction. The full mix remains the canonical playback
-- track and lyric owner while a separate saved audio track may supply cleaner
-- vocal audio for provider analysis.

CREATE TABLE IF NOT EXISTS public.audio_analysis_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_audio_track_id uuid NOT NULL REFERENCES public.audio_tracks(id) ON DELETE CASCADE,
  source_audio_track_id uuid NOT NULL REFERENCES public.audio_tracks(id) ON DELETE CASCADE,
  source_type text NOT NULL DEFAULT 'vocal_reference',
  timing_offset_ms integer NOT NULL DEFAULT 0,
  owner_duration_ms bigint NULL,
  source_duration_ms bigint NULL,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  preparation_operation_id uuid NULL,
  preparation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT audio_analysis_sources_distinct_tracks_check
    CHECK (owner_audio_track_id <> source_audio_track_id),
  CONSTRAINT audio_analysis_sources_source_type_check
    CHECK (source_type IN ('vocal_reference')),
  CONSTRAINT audio_analysis_sources_timing_offset_check
    CHECK (timing_offset_ms BETWEEN -3600000 AND 3600000),
  CONSTRAINT audio_analysis_sources_duration_check
    CHECK (
      (owner_duration_ms IS NULL OR owner_duration_ms > 0)
      AND (source_duration_ms IS NULL OR source_duration_ms > 0)
    ),
  CONSTRAINT audio_analysis_sources_metadata_check
    CHECK (
      jsonb_typeof(source_metadata) = 'object'
      AND jsonb_typeof(preparation_metadata) = 'object'
      AND octet_length(source_metadata::text) <= 32768
      AND octet_length(preparation_metadata::text) <= 16384
    ),
  CONSTRAINT audio_analysis_sources_owner_source_key
    UNIQUE (user_id, owner_audio_track_id, source_audio_track_id, source_type)
);

COMMENT ON TABLE public.audio_analysis_sources IS
  'User-owned relationship from a canonical audio track to a separate analysis-only source such as a vocal reference.';
COMMENT ON COLUMN public.audio_analysis_sources.owner_audio_track_id IS
  'Canonical playback track and lyric_documents.audio_track_id owner.';
COMMENT ON COLUMN public.audio_analysis_sources.source_audio_track_id IS
  'Saved audio track used only as the transcription analysis source.';
COMMENT ON COLUMN public.audio_analysis_sources.timing_offset_ms IS
  'Applied once to provider timestamps. Positive means the source begins later on the owner timeline.';
COMMENT ON COLUMN public.audio_analysis_sources.source_metadata IS
  'Bounded non-secret source provenance. Signed URLs, storage credentials, and provider secrets are forbidden.';
COMMENT ON COLUMN public.audio_analysis_sources.preparation_metadata IS
  'Bounded manifest summary only. Canonical prepared-audio paths remain on the source track and its preparation operation.';

CREATE INDEX IF NOT EXISTS idx_audio_analysis_sources_owner
  ON public.audio_analysis_sources(user_id, owner_audio_track_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_audio_analysis_sources_source
  ON public.audio_analysis_sources(user_id, source_audio_track_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_audio_analysis_sources_updated_at ON public.audio_analysis_sources;
CREATE TRIGGER trg_audio_analysis_sources_updated_at
  BEFORE UPDATE ON public.audio_analysis_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_audio_analysis_source_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_owner_user_id uuid;
  v_source_user_id uuid;
  v_owner_duration_sec double precision;
  v_source_duration_sec double precision;
BEGIN
  SELECT user_id, duration_sec
  INTO v_owner_user_id, v_owner_duration_sec
  FROM public.audio_tracks
  WHERE id = NEW.owner_audio_track_id AND lifecycle_status = 'complete';

  SELECT user_id, duration_sec
  INTO v_source_user_id, v_source_duration_sec
  FROM public.audio_tracks
  WHERE id = NEW.source_audio_track_id AND lifecycle_status = 'complete';

  IF v_owner_user_id IS NULL OR v_source_user_id IS NULL
     OR v_owner_user_id IS DISTINCT FROM NEW.user_id
     OR v_source_user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'audio analysis source tracks must be complete and owned by the same user'
      USING ERRCODE = '42501';
  END IF;

  NEW.owner_duration_ms := COALESCE(
    NEW.owner_duration_ms,
    CASE WHEN v_owner_duration_sec > 0 THEN round(v_owner_duration_sec * 1000)::bigint ELSE NULL END
  );
  NEW.source_duration_ms := COALESCE(
    NEW.source_duration_ms,
    CASE WHEN v_source_duration_sec > 0 THEN round(v_source_duration_sec * 1000)::bigint ELSE NULL END
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_audio_analysis_source_ownership() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audio_analysis_sources_validate ON public.audio_analysis_sources;
CREATE TRIGGER trg_audio_analysis_sources_validate
  BEFORE INSERT OR UPDATE ON public.audio_analysis_sources
  FOR EACH ROW EXECUTE FUNCTION public.validate_audio_analysis_source_ownership();

ALTER TABLE public.audio_analysis_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audio analysis sources: own select" ON public.audio_analysis_sources;
CREATE POLICY "audio analysis sources: own select"
  ON public.audio_analysis_sources FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.audio_analysis_sources FROM authenticated;
GRANT SELECT ON public.audio_analysis_sources TO authenticated;

ALTER TABLE public.lyric_transcription_jobs
  ADD COLUMN IF NOT EXISTS analysis_source_id uuid NULL
    REFERENCES public.audio_analysis_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_mode text NOT NULL DEFAULT 'full_mix',
  ADD COLUMN IF NOT EXISTS timing_offset_ms integer NOT NULL DEFAULT 0;

ALTER TABLE public.lyric_transcription_jobs
  DROP CONSTRAINT IF EXISTS lyric_transcription_jobs_source_mode_check,
  DROP CONSTRAINT IF EXISTS lyric_transcription_jobs_timing_offset_check,
  DROP CONSTRAINT IF EXISTS lyric_transcription_jobs_analysis_source_shape_check;

ALTER TABLE public.lyric_transcription_jobs
  ADD CONSTRAINT lyric_transcription_jobs_source_mode_check
    CHECK (source_mode IN ('full_mix', 'vocal_reference')),
  ADD CONSTRAINT lyric_transcription_jobs_timing_offset_check
    CHECK (timing_offset_ms BETWEEN -3600000 AND 3600000),
  ADD CONSTRAINT lyric_transcription_jobs_analysis_source_shape_check
    CHECK (
      (source_mode = 'full_mix' AND analysis_source_id IS NULL AND timing_offset_ms = 0)
      OR (source_mode = 'vocal_reference' AND analysis_source_id IS NOT NULL)
      OR (source_mode = 'vocal_reference' AND analysis_source_id IS NULL AND status IN ('failed', 'cancelled', 'completed'))
    );

CREATE INDEX IF NOT EXISTS idx_lyric_transcription_jobs_analysis_source
  ON public.lyric_transcription_jobs(analysis_source_id, created_at DESC)
  WHERE analysis_source_id IS NOT NULL;

COMMENT ON COLUMN public.lyric_transcription_jobs.analysis_source_id IS
  'Nullable analysis-only source relationship. audio_track_id always remains the canonical lyric owner.';
COMMENT ON COLUMN public.lyric_transcription_jobs.source_mode IS
  'full_mix or vocal_reference. Historical source provenance also remains in bounded request/provider metadata.';
COMMENT ON COLUMN public.lyric_transcription_jobs.timing_offset_ms IS
  'Vocal-reference timeline offset applied exactly once before canonical lyric persistence.';

CREATE OR REPLACE FUNCTION public.cancel_jobs_for_deleted_audio_analysis_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.lyric_transcription_jobs
  SET
    status = 'cancelled',
    error_code = 'analysis_source_deleted',
    error_message = 'The vocal reference was deleted before transcription completed.',
    provider_metadata = provider_metadata || jsonb_build_object(
      'analysisSourceDeleted', true,
      'analysisSourceId', OLD.id,
      'sourceAudioTrackId', OLD.source_audio_track_id
    ),
    completed_at = clock_timestamp()
  WHERE analysis_source_id = OLD.id
    AND status IN ('queued', 'processing');
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_jobs_for_deleted_audio_analysis_source() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audio_analysis_sources_cancel_jobs ON public.audio_analysis_sources;
CREATE TRIGGER trg_audio_analysis_sources_cancel_jobs
  BEFORE DELETE ON public.audio_analysis_sources
  FOR EACH ROW EXECUTE FUNCTION public.cancel_jobs_for_deleted_audio_analysis_source();

-- Preserve first-extraction activation while validating that a vocal-reference
-- job still has a user-owned source relationship at commit time.
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
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The lyric draft must remain attached to the canonical full-mix track.');
  END IF;

  PERFORM 1
  FROM public.audio_tracks
  WHERE id = v_job.audio_track_id AND user_id = v_user_id AND lifecycle_status = 'complete'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The canonical full-mix track is unavailable.');
  END IF;

  IF v_job.source_mode = 'vocal_reference' THEN
    PERFORM 1
    FROM public.audio_analysis_sources AS source
    JOIN public.audio_tracks AS source_track ON source_track.id = source.source_audio_track_id
    WHERE source.id = v_job.analysis_source_id
      AND source.user_id = v_user_id
      AND source.owner_audio_track_id = v_job.audio_track_id
      AND source.source_type = 'vocal_reference'
      AND source_track.user_id = v_user_id
      AND source_track.lifecycle_status = 'complete'
    FOR UPDATE OF source;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The vocal reference is unavailable or no longer belongs to this full mix.');
    END IF;
  END IF;

  v_should_activate := NOT EXISTS (
    SELECT 1
    FROM public.lyric_documents
    WHERE user_id = v_user_id
      AND audio_track_id = v_job.audio_track_id
      AND is_active = true
  );

  v_save_result := public.save_lyric_document_atomic(NULL, NULL, p_document, p_cues, v_should_activate);
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
