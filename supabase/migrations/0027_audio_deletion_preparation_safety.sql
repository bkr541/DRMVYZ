-- Canonical audio deletion and recoverable browser-preparation operations.
-- Exact storage paths are derived from server-owned track/operation state. The
-- client only reports bounded chunk indices and cleanup progress.

ALTER TABLE public.audio_tracks
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'complete',
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz NULL;

ALTER TABLE public.audio_tracks
  DROP CONSTRAINT IF EXISTS audio_tracks_lifecycle_status_check;
ALTER TABLE public.audio_tracks
  ADD CONSTRAINT audio_tracks_lifecycle_status_check
  CHECK (lifecycle_status IN ('complete', 'deletion_pending'));

CREATE INDEX IF NOT EXISTS idx_audio_tracks_user_lifecycle_created
  ON public.audio_tracks(user_id, lifecycle_status, created_at DESC);

-- Persisted audio deletion and derivative-manifest mutation are now owned by
-- the SECURITY DEFINER operations below. Keep ordinary metadata editing, but
-- remove the legacy broad DELETE/UPDATE privileges that could bypass the
-- tombstone and replace canonical storage paths from an authenticated client.
DROP POLICY IF EXISTS "tracks: own delete" ON public.audio_tracks;
REVOKE DELETE ON TABLE public.audio_tracks FROM anon, authenticated;
REVOKE UPDATE ON TABLE public.audio_tracks FROM anon, authenticated;
GRANT UPDATE (title, artist, genre, bpm, musical_key) ON TABLE public.audio_tracks TO authenticated;

CREATE TABLE IF NOT EXISTS public.audio_preparation_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  audio_track_id uuid NOT NULL REFERENCES public.audio_tracks(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  version text NOT NULL DEFAULT 'browser-pcm16-v2',
  source_file_size bigint NOT NULL,
  duration_ms bigint NOT NULL,
  source_sample_rate integer NOT NULL,
  source_channels integer NOT NULL,
  target_sample_rate integer NOT NULL DEFAULT 16000,
  intended_chunk_count integer NOT NULL,
  intended_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  uploaded_chunks jsonb NOT NULL DEFAULT '[]'::jsonb,
  cleanup_completed_indices jsonb NOT NULL DEFAULT '[]'::jsonb,
  superseded_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  superseded_completed_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  manifest_saved boolean NOT NULL DEFAULT false,
  job_id uuid NULL REFERENCES public.lyric_transcription_jobs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'preparing',
  phase text NOT NULL DEFAULT 'planning',
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  CONSTRAINT audio_preparation_operations_user_operation_key UNIQUE (user_id, operation_id),
  CONSTRAINT audio_preparation_operations_chunk_count_check CHECK (intended_chunk_count BETWEEN 1 AND 64),
  CONSTRAINT audio_preparation_operations_source_check CHECK (
    source_file_size > 0 AND duration_ms > 0 AND source_sample_rate > 0 AND source_channels BETWEEN 1 AND 8
  ),
  CONSTRAINT audio_preparation_operations_json_check CHECK (
    jsonb_typeof(intended_paths) = 'array'
    AND jsonb_typeof(uploaded_chunks) = 'array'
    AND jsonb_typeof(cleanup_completed_indices) = 'array'
    AND jsonb_typeof(superseded_paths) = 'array'
    AND jsonb_typeof(superseded_completed_paths) = 'array'
  ),
  CONSTRAINT audio_preparation_operations_status_check CHECK (
    status IN ('preparing', 'uploading', 'manifest_saved', 'job_created', 'cleanup_pending', 'cancelled', 'failed', 'complete')
  ),
  CONSTRAINT audio_preparation_operations_phase_check CHECK (
    phase IN ('planning', 'encoding', 'uploading', 'saving_manifest', 'creating_job', 'cleanup', 'complete', 'failed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_audio_preparation_track_status
  ON public.audio_preparation_operations(user_id, audio_track_id, status, updated_at DESC);

DROP TRIGGER IF EXISTS trg_audio_preparation_operations_updated_at ON public.audio_preparation_operations;
CREATE TRIGGER trg_audio_preparation_operations_updated_at
  BEFORE UPDATE ON public.audio_preparation_operations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.audio_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  audio_track_id uuid NULL REFERENCES public.audio_tracks(id) ON DELETE SET NULL,
  track_id_snapshot uuid NOT NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  storage_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  CONSTRAINT audio_cleanup_jobs_kind_check CHECK (kind IN ('track_deletion')),
  CONSTRAINT audio_cleanup_jobs_status_check CHECK (status IN ('pending', 'failed', 'complete')),
  CONSTRAINT audio_cleanup_jobs_paths_check CHECK (
    jsonb_typeof(storage_paths) = 'array' AND jsonb_typeof(completed_paths) = 'array'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_audio_cleanup_track_deletion_open
  ON public.audio_cleanup_jobs(user_id, track_id_snapshot, kind)
  WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_audio_cleanup_user_status
  ON public.audio_cleanup_jobs(user_id, status, updated_at DESC);

DROP TRIGGER IF EXISTS trg_audio_cleanup_jobs_updated_at ON public.audio_cleanup_jobs;
CREATE TRIGGER trg_audio_cleanup_jobs_updated_at
  BEFORE UPDATE ON public.audio_cleanup_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.audio_preparation_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_cleanup_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audio preparation operations: own select" ON public.audio_preparation_operations;
CREATE POLICY "audio preparation operations: own select"
  ON public.audio_preparation_operations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "audio cleanup jobs: own select" ON public.audio_cleanup_jobs;
CREATE POLICY "audio cleanup jobs: own select"
  ON public.audio_cleanup_jobs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.audio_preparation_operations FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.audio_cleanup_jobs FROM authenticated;
GRANT SELECT ON public.audio_preparation_operations TO authenticated;
GRANT SELECT ON public.audio_cleanup_jobs TO authenticated;

CREATE OR REPLACE FUNCTION public.audio_storage_path_is_owned(p_user_id uuid, p_path text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT p_user_id IS NOT NULL
    AND p_path IS NOT NULL
    AND length(p_path) BETWEEN 3 AND 1024
    AND p_path LIKE p_user_id::text || '/%'
    AND p_path !~ '(^|/)\.\.(/|$)'
    AND p_path !~ '(^|/)\.(/|$)'
    AND p_path !~ '[[:cntrl:]]';
$$;

REVOKE ALL ON FUNCTION public.audio_storage_path_is_owned(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audio_preparation_paths(
  p_user_id uuid,
  p_track_id uuid,
  p_operation_id uuid,
  p_chunk_count integer
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      format('%s/transcription-chunks/%s/%s/chunk-%s.wav',
        p_user_id, p_track_id, p_operation_id, lpad(chunk_index::text, 3, '0'))
      ORDER BY chunk_index
    ),
    '[]'::jsonb
  )
  FROM generate_series(0, p_chunk_count - 1) AS generated(chunk_index);
$$;

REVOKE ALL ON FUNCTION public.audio_preparation_paths(uuid, uuid, uuid, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.begin_audio_preparation(
  p_audio_track_id uuid,
  p_operation_id uuid,
  p_source_file_size bigint,
  p_duration_ms bigint,
  p_source_sample_rate integer,
  p_source_channels integer,
  p_chunk_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_track public.audio_tracks%ROWTYPE;
  v_operation public.audio_preparation_operations%ROWTYPE;
  v_paths jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'Authentication is required to prepare audio.');
  END IF;
  IF p_operation_id IS NULL OR p_chunk_count NOT BETWEEN 1 AND 64
     OR p_source_file_size <= 0 OR p_duration_ms <= 0
     OR p_source_sample_rate <= 0 OR p_source_channels NOT BETWEEN 1 AND 8 THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The audio preparation plan is invalid.');
  END IF;

  SELECT * INTO v_track FROM public.audio_tracks
  WHERE id = p_audio_track_id FOR UPDATE;
  IF NOT FOUND OR v_track.user_id IS DISTINCT FROM v_user_id OR v_track.lifecycle_status <> 'complete' THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The audio track is unavailable or not owned by the current user.');
  END IF;
  IF v_track.file_size IS NOT NULL AND v_track.file_size <> p_source_file_size THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The preparation source no longer matches the canonical track.');
  END IF;

  SELECT * INTO v_operation
  FROM public.audio_preparation_operations
  WHERE user_id = v_user_id
    AND audio_track_id = p_audio_track_id
    AND source_file_size = p_source_file_size
    AND duration_ms = p_duration_ms
    AND source_sample_rate = p_source_sample_rate
    AND source_channels = p_source_channels
    AND intended_chunk_count = p_chunk_count
    AND status IN ('preparing', 'uploading', 'cleanup_pending', 'cancelled', 'failed')
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_operation.status IN ('cancelled', 'failed')
       AND jsonb_array_length(v_operation.cleanup_completed_indices) >= v_operation.intended_chunk_count THEN
      UPDATE public.audio_preparation_operations
      SET status = 'preparing', phase = 'planning', uploaded_chunks = '[]'::jsonb,
          cleanup_completed_indices = '[]'::jsonb, manifest_saved = false,
          job_id = NULL, last_error = NULL, completed_at = NULL
      WHERE id = v_operation.id RETURNING * INTO v_operation;
    END IF;
    RETURN jsonb_build_object('status', 'success', 'operation', to_jsonb(v_operation), 'reconciled', true);
  END IF;

  v_paths := public.audio_preparation_paths(v_user_id, p_audio_track_id, p_operation_id, p_chunk_count);
  INSERT INTO public.audio_preparation_operations (
    user_id, audio_track_id, operation_id, source_file_size, duration_ms,
    source_sample_rate, source_channels, intended_chunk_count, intended_paths
  ) VALUES (
    v_user_id, p_audio_track_id, p_operation_id, p_source_file_size, p_duration_ms,
    p_source_sample_rate, p_source_channels, p_chunk_count, v_paths
  ) RETURNING * INTO v_operation;

  RETURN jsonb_build_object('status', 'success', 'operation', to_jsonb(v_operation), 'reconciled', false);
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_operation FROM public.audio_preparation_operations
    WHERE user_id = v_user_id AND operation_id = p_operation_id;
    IF FOUND AND v_operation.audio_track_id = p_audio_track_id THEN
      RETURN jsonb_build_object('status', 'success', 'operation', to_jsonb(v_operation), 'reconciled', true);
    END IF;
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'This preparation operation is already bound to another track.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'unexpected_failure', 'message', 'The preparation operation could not be recorded safely.', 'error_code', SQLSTATE);
END;
$$;

REVOKE ALL ON FUNCTION public.begin_audio_preparation(uuid, uuid, bigint, bigint, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_audio_preparation(uuid, uuid, bigint, bigint, integer, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_audio_preparation_chunk_uploaded(
  p_operation_id uuid,
  p_chunk_index integer,
  p_byte_size bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_operation public.audio_preparation_operations%ROWTYPE;
  v_path text;
  v_uploaded jsonb;
BEGIN
  SELECT * INTO v_operation FROM public.audio_preparation_operations
  WHERE user_id = v_user_id AND operation_id = p_operation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The preparation operation is unavailable.');
  END IF;
  IF p_chunk_index < 0 OR p_chunk_index >= v_operation.intended_chunk_count OR p_byte_size <= 44 THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The uploaded chunk metadata is invalid.');
  END IF;
  IF v_operation.status IN ('cancelled', 'cleanup_pending') THEN
    RETURN jsonb_build_object('status', 'cancelled', 'message', 'The preparation operation was cancelled.');
  END IF;

  v_path := v_operation.intended_paths->>p_chunk_index;
  SELECT COALESCE(jsonb_agg(item ORDER BY (item->>'index')::integer), '[]'::jsonb)
  INTO v_uploaded
  FROM (
    SELECT item FROM jsonb_array_elements(v_operation.uploaded_chunks) AS item
    WHERE (item->>'index')::integer <> p_chunk_index
    UNION ALL
    SELECT jsonb_build_object('index', p_chunk_index, 'path', v_path, 'byteSize', p_byte_size)
  ) AS uploaded;

  UPDATE public.audio_preparation_operations
  SET uploaded_chunks = v_uploaded, status = 'uploading', phase = 'uploading', last_error = NULL
  WHERE id = v_operation.id RETURNING * INTO v_operation;
  RETURN jsonb_build_object('status', 'success', 'operation', to_jsonb(v_operation));
END;
$$;

REVOKE ALL ON FUNCTION public.mark_audio_preparation_chunk_uploaded(uuid, integer, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_audio_preparation_chunk_uploaded(uuid, integer, bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_audio_preparation_manifest(
  p_operation_id uuid,
  p_manifest jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_operation public.audio_preparation_operations%ROWTYPE;
  v_track public.audio_tracks%ROWTYPE;
  v_old_paths jsonb := '[]'::jsonb;
  v_superseded_paths jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_operation FROM public.audio_preparation_operations
  WHERE user_id = v_user_id AND operation_id = p_operation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The preparation operation is unavailable.');
  END IF;
  SELECT * INTO v_track FROM public.audio_tracks
  WHERE id = v_operation.audio_track_id AND user_id = v_user_id AND lifecycle_status = 'complete' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The audio track is unavailable.');
  END IF;
  IF p_manifest IS NULL OR jsonb_typeof(p_manifest) <> 'object'
     OR p_manifest->>'operationId' <> v_operation.operation_id::text
     OR p_manifest->>'version' <> 'browser-pcm16-v2'
     OR jsonb_array_length(COALESCE(p_manifest->'chunks', '[]'::jsonb)) <> v_operation.intended_chunk_count
     OR jsonb_array_length(v_operation.uploaded_chunks) <> v_operation.intended_chunk_count THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The prepared-audio manifest is incomplete or belongs to another operation.');
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_manifest->'chunks') WITH ORDINALITY AS chunk(value, ordinal)
    WHERE (chunk.value->>'index')::integer <> chunk.ordinal - 1
       OR chunk.value->>'storagePath' <> v_operation.intended_paths->>(chunk.ordinal - 1)
       OR chunk.value->>'mimeType' <> 'audio/wav'
       OR (chunk.value->>'byteSize')::bigint <= 44
  ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The manifest contains a foreign or invalid chunk path.');
  END IF;

  IF jsonb_typeof(v_track.transcription_assets) = 'object' AND jsonb_typeof(v_track.transcription_assets->'chunks') = 'array' THEN
    SELECT COALESCE(jsonb_agg(value->>'storagePath'), '[]'::jsonb)
    INTO v_old_paths FROM jsonb_array_elements(v_track.transcription_assets->'chunks');
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_old_paths) AS old_path(path)
    WHERE NOT public.audio_storage_path_is_owned(v_user_id, old_path.path)
  ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The previous prepared-audio manifest contains an invalid or foreign path.');
  END IF;

  SELECT COALESCE(jsonb_agg(path ORDER BY path), '[]'::jsonb)
  INTO v_superseded_paths
  FROM (
    SELECT DISTINCT old_path.path
    FROM jsonb_array_elements_text(v_old_paths) AS old_path(path)
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_operation.intended_paths) AS active_path(path)
      WHERE active_path.path = old_path.path
    )
  ) AS superseded;

  UPDATE public.audio_tracks SET transcription_assets = p_manifest WHERE id = v_track.id;
  UPDATE public.audio_preparation_operations
  SET manifest_saved = true,
      status = 'manifest_saved',
      phase = 'creating_job',
      superseded_paths = v_superseded_paths,
      superseded_completed_paths = '[]'::jsonb,
      last_error = CASE WHEN jsonb_array_length(v_superseded_paths) > 0
        THEN 'Superseded prepared-audio cleanup is pending.' ELSE NULL END
  WHERE id = v_operation.id RETURNING * INTO v_operation;

  RETURN jsonb_build_object('status', 'success', 'operation', to_jsonb(v_operation), 'superseded_paths', v_superseded_paths);
EXCEPTION
  WHEN invalid_text_representation OR data_exception THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The prepared-audio manifest contains invalid values.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'unexpected_failure', 'message', 'The prepared-audio manifest could not be saved safely.', 'error_code', SQLSTATE);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_audio_preparation_manifest(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_audio_preparation_manifest(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_audio_preparation_cleanup(
  p_operation_id uuid,
  p_completed_indices jsonb,
  p_status text,
  p_error text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_operation public.audio_preparation_operations%ROWTYPE;
  v_completed jsonb;
BEGIN
  SELECT * INTO v_operation FROM public.audio_preparation_operations
  WHERE user_id = v_user_id AND operation_id = p_operation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The preparation cleanup operation is unavailable.');
  END IF;
  IF p_status NOT IN ('failed', 'cancelled', 'cleanup_pending') OR jsonb_typeof(COALESCE(p_completed_indices, '[]'::jsonb)) <> 'array' THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The preparation cleanup update is invalid.');
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(p_completed_indices, '[]'::jsonb)) AS item
    WHERE jsonb_typeof(item) <> 'number' OR (item::text)::integer < 0 OR (item::text)::integer >= v_operation.intended_chunk_count
  ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The preparation cleanup contains an invalid chunk index.');
  END IF;

  SELECT COALESCE(jsonb_agg(DISTINCT idx ORDER BY idx), '[]'::jsonb)
  INTO v_completed
  FROM (
    SELECT (item::text)::integer AS idx FROM jsonb_array_elements(v_operation.cleanup_completed_indices) AS item
    UNION ALL
    SELECT (item::text)::integer AS idx FROM jsonb_array_elements(COALESCE(p_completed_indices, '[]'::jsonb)) AS item
  ) AS all_indices;

  IF v_operation.manifest_saved THEN
    UPDATE public.audio_tracks
    SET transcription_assets = NULL
    WHERE id = v_operation.audio_track_id
      AND user_id = v_user_id
      AND transcription_assets->>'operationId' = v_operation.operation_id::text;
  END IF;

  UPDATE public.audio_preparation_operations
  SET cleanup_completed_indices = v_completed,
      manifest_saved = false,
      job_id = NULL,
      status = CASE
        WHEN jsonb_array_length(v_completed) >= intended_chunk_count THEN p_status
        ELSE 'cleanup_pending'
      END,
      phase = CASE
        WHEN jsonb_array_length(v_completed) < intended_chunk_count THEN 'cleanup'
        WHEN p_status = 'cancelled' THEN 'cancelled'
        ELSE 'failed'
      END,
      last_error = p_error,
      completed_at = CASE WHEN jsonb_array_length(v_completed) >= intended_chunk_count THEN now() ELSE NULL END
  WHERE id = v_operation.id RETURNING * INTO v_operation;

  RETURN jsonb_build_object('status', 'success', 'operation', to_jsonb(v_operation));
END;
$$;

REVOKE ALL ON FUNCTION public.record_audio_preparation_cleanup(uuid, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_audio_preparation_cleanup(uuid, jsonb, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_audio_preparation_superseded_cleanup(
  p_operation_id uuid,
  p_completed_paths jsonb,
  p_error text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_operation public.audio_preparation_operations%ROWTYPE;
  v_completed jsonb;
BEGIN
  SELECT * INTO v_operation FROM public.audio_preparation_operations
  WHERE user_id = v_user_id AND operation_id = p_operation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The preparation operation is unavailable.');
  END IF;
  IF jsonb_typeof(COALESCE(p_completed_paths, '[]'::jsonb)) <> 'array'
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements_text(COALESCE(p_completed_paths, '[]'::jsonb)) AS completed(path)
       WHERE NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(v_operation.superseded_paths) AS expected(path)
         WHERE expected.path = completed.path
       )
     ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The superseded cleanup update contains an invalid path.');
  END IF;

  SELECT COALESCE(jsonb_agg(DISTINCT path ORDER BY path), '[]'::jsonb)
  INTO v_completed
  FROM (
    SELECT jsonb_array_elements_text(v_operation.superseded_completed_paths) AS path
    UNION ALL
    SELECT jsonb_array_elements_text(COALESCE(p_completed_paths, '[]'::jsonb)) AS path
  ) AS paths;

  UPDATE public.audio_preparation_operations
  SET superseded_completed_paths = v_completed,
      last_error = CASE
        WHEN jsonb_array_length(v_completed) = jsonb_array_length(superseded_paths) THEN NULL
        ELSE COALESCE(NULLIF(p_error, ''), 'Superseded prepared-audio cleanup is pending.')
      END
  WHERE id = v_operation.id RETURNING * INTO v_operation;

  RETURN jsonb_build_object('status', 'success', 'operation', to_jsonb(v_operation));
END;
$$;

REVOKE ALL ON FUNCTION public.record_audio_preparation_superseded_cleanup(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_audio_preparation_superseded_cleanup(uuid, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_audio_track_deletion(p_audio_track_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_track public.audio_tracks%ROWTYPE;
  v_job public.audio_cleanup_jobs%ROWTYPE;
  v_paths jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'Authentication is required to delete audio.');
  END IF;
  SELECT * INTO v_track FROM public.audio_tracks WHERE id = p_audio_track_id FOR UPDATE;
  IF NOT FOUND THEN
    SELECT * INTO v_job FROM public.audio_cleanup_jobs
    WHERE user_id = v_user_id AND track_id_snapshot = p_audio_track_id AND kind = 'track_deletion'
    ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'status', 'success',
        'cleanup_job', to_jsonb(v_job),
        'reconciled', true,
        'already_deleted', v_job.status = 'complete'
      );
    END IF;
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The audio track is unavailable or not owned by the current user.');
  END IF;
  IF v_track.user_id IS DISTINCT FROM v_user_id THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The audio track is unavailable or not owned by the current user.');
  END IF;

  SELECT * INTO v_job FROM public.audio_cleanup_jobs
  WHERE user_id = v_user_id AND track_id_snapshot = p_audio_track_id AND kind = 'track_deletion'
    AND (status IN ('pending', 'failed') OR (status = 'complete' AND audio_track_id IS NOT NULL))
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    UPDATE public.audio_tracks SET lifecycle_status = 'deletion_pending', deletion_requested_at = COALESCE(deletion_requested_at, now())
    WHERE id = p_audio_track_id;
    RETURN jsonb_build_object('status', 'success', 'cleanup_job', to_jsonb(v_job), 'reconciled', true);
  END IF;

  IF v_track.storage_path IS NOT NULL AND NOT public.audio_storage_path_is_owned(v_user_id, v_track.storage_path) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The canonical source path is invalid or foreign.');
  END IF;
  IF jsonb_typeof(v_track.transcription_assets) = 'object' AND jsonb_typeof(v_track.transcription_assets->'chunks') = 'array'
     AND EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_track.transcription_assets->'chunks') AS chunk
       WHERE NOT public.audio_storage_path_is_owned(v_user_id, chunk->>'storagePath')
     ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The canonical prepared-audio metadata contains an invalid or foreign path.');
  END IF;

  SELECT COALESCE(jsonb_agg(path ORDER BY path), '[]'::jsonb)
  INTO v_paths
  FROM (
    SELECT DISTINCT path FROM (
      SELECT v_track.storage_path AS path
      UNION ALL
      SELECT chunk->>'storagePath' FROM jsonb_array_elements(COALESCE(v_track.transcription_assets->'chunks', '[]'::jsonb)) AS chunk
      UNION ALL
      SELECT prepared_path.path_value
      FROM public.audio_preparation_operations AS operation,
           jsonb_array_elements_text(operation.intended_paths) AS prepared_path(path_value)
      WHERE operation.user_id = v_user_id AND operation.audio_track_id = p_audio_track_id
      UNION ALL
      SELECT superseded_path.path_value
      FROM public.audio_preparation_operations AS operation,
           jsonb_array_elements_text(operation.superseded_paths) AS superseded_path(path_value)
      WHERE operation.user_id = v_user_id AND operation.audio_track_id = p_audio_track_id
    ) AS all_paths
    WHERE path IS NOT NULL AND path <> ''
  ) AS unique_paths;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_paths) AS canonical(path)
    WHERE NOT public.audio_storage_path_is_owned(v_user_id, canonical.path)
  ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Canonical audio cleanup contains an invalid or foreign path.');
  END IF;

  INSERT INTO public.audio_cleanup_jobs(user_id, audio_track_id, track_id_snapshot, kind, status, storage_paths)
  VALUES(v_user_id, p_audio_track_id, p_audio_track_id, 'track_deletion', 'pending', v_paths)
  RETURNING * INTO v_job;

  UPDATE public.audio_tracks
  SET lifecycle_status = 'deletion_pending', deletion_requested_at = now()
  WHERE id = p_audio_track_id;

  RETURN jsonb_build_object('status', 'success', 'cleanup_job', to_jsonb(v_job), 'reconciled', false);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'unexpected_failure', 'message', 'The audio deletion request could not be recorded safely.', 'error_code', SQLSTATE);
END;
$$;

REVOKE ALL ON FUNCTION public.request_audio_track_deletion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_audio_track_deletion(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_audio_cleanup_job(
  p_cleanup_job_id uuid,
  p_completed_paths jsonb,
  p_status text,
  p_error text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_job public.audio_cleanup_jobs%ROWTYPE;
  v_completed jsonb;
BEGIN
  SELECT * INTO v_job FROM public.audio_cleanup_jobs
  WHERE id = p_cleanup_job_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The audio cleanup job is unavailable.');
  END IF;
  IF p_status NOT IN ('pending', 'failed', 'complete') OR jsonb_typeof(COALESCE(p_completed_paths, '[]'::jsonb)) <> 'array'
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements_text(COALESCE(p_completed_paths, '[]'::jsonb)) AS completed(path)
       WHERE NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(v_job.storage_paths) AS expected(path)
         WHERE expected.path = completed.path
       )
     ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The audio cleanup update contains an invalid path.');
  END IF;

  SELECT COALESCE(jsonb_agg(DISTINCT path ORDER BY path), '[]'::jsonb)
  INTO v_completed
  FROM (
    SELECT jsonb_array_elements_text(v_job.completed_paths) AS path
    UNION ALL
    SELECT jsonb_array_elements_text(COALESCE(p_completed_paths, '[]'::jsonb)) AS path
  ) AS paths;

  UPDATE public.audio_cleanup_jobs
  SET completed_paths = v_completed,
      status = CASE
        WHEN jsonb_array_length(v_completed) = jsonb_array_length(storage_paths) THEN 'complete'
        ELSE CASE WHEN p_status = 'complete' THEN 'failed' ELSE p_status END
      END,
      last_error = p_error,
      completed_at = CASE WHEN jsonb_array_length(v_completed) = jsonb_array_length(storage_paths) THEN now() ELSE NULL END
  WHERE id = v_job.id RETURNING * INTO v_job;

  RETURN jsonb_build_object('status', 'success', 'cleanup_job', to_jsonb(v_job));
END;
$$;

REVOKE ALL ON FUNCTION public.update_audio_cleanup_job(uuid, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_audio_cleanup_job(uuid, jsonb, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_audio_track_deletion(p_cleanup_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_job public.audio_cleanup_jobs%ROWTYPE;
  v_track_id uuid;
BEGIN
  SELECT * INTO v_job FROM public.audio_cleanup_jobs
  WHERE id = p_cleanup_job_id AND user_id = v_user_id AND kind = 'track_deletion' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The audio deletion cleanup job is unavailable.');
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_job.storage_paths) AS expected(path)
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_job.completed_paths) AS completed(path)
      WHERE completed.path = expected.path
    )
  ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Audio storage cleanup is incomplete.');
  END IF;

  v_track_id := v_job.audio_track_id;
  IF v_track_id IS NOT NULL THEN
    DELETE FROM public.audio_tracks WHERE id = v_track_id AND user_id = v_user_id;
  END IF;
  UPDATE public.audio_cleanup_jobs
  SET status = 'complete', last_error = NULL, completed_at = now()
  WHERE id = v_job.id;
  RETURN jsonb_build_object('status', 'success', 'audio_track_id', COALESCE(v_track_id, v_job.track_id_snapshot));
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_audio_track_deletion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_audio_track_deletion(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_pending_audio_cleanup()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(job) ORDER BY job.updated_at DESC), '[]'::jsonb)
  FROM (
    SELECT *
    FROM public.audio_cleanup_jobs
    WHERE user_id = auth.uid()
      AND (status IN ('pending', 'failed') OR (status = 'complete' AND audio_track_id IS NOT NULL))
    ORDER BY updated_at ASC
    LIMIT 25
  ) AS job;
$$;

REVOKE ALL ON FUNCTION public.list_pending_audio_cleanup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_audio_cleanup() TO authenticated;
