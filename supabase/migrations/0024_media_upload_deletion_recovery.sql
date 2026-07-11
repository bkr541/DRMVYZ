-- Media upload idempotency, durable cleanup, and recoverable deletion.
-- Storage remains outside PostgreSQL transactions, so cross-system progress is
-- represented explicitly and reconciled through authenticated RPCs.

ALTER TABLE public.media_items
  ADD COLUMN IF NOT EXISTS upload_operation_id uuid,
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'complete',
  ADD COLUMN IF NOT EXISTS derivative_paths jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.media_items
  DROP CONSTRAINT IF EXISTS media_items_lifecycle_status_check;
ALTER TABLE public.media_items
  ADD CONSTRAINT media_items_lifecycle_status_check
  CHECK (lifecycle_status IN ('complete', 'deletion_pending', 'deletion_failed'));

ALTER TABLE public.media_items
  DROP CONSTRAINT IF EXISTS media_items_user_upload_operation_key;
ALTER TABLE public.media_items
  ADD CONSTRAINT media_items_user_upload_operation_key UNIQUE (user_id, upload_operation_id);

ALTER TABLE public.media_items
  DROP CONSTRAINT IF EXISTS media_items_derivative_paths_array_check;
ALTER TABLE public.media_items
  ADD CONSTRAINT media_items_derivative_paths_array_check
  CHECK (jsonb_typeof(derivative_paths) = 'array');

CREATE INDEX IF NOT EXISTS idx_media_items_user_lifecycle
  ON public.media_items(user_id, lifecycle_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.media_upload_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  original_path text NOT NULL,
  derivative_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'preparing',
  phase text NOT NULL DEFAULT 'preparing',
  media_item_id uuid REFERENCES public.media_items(id) ON DELETE SET NULL,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_upload_operations_user_operation_key UNIQUE (user_id, operation_id),
  CONSTRAINT media_upload_operations_derivative_paths_array_check CHECK (jsonb_typeof(derivative_paths) = 'array'),
  CONSTRAINT media_upload_operations_status_check CHECK (
    status IN ('preparing', 'uploading', 'saving', 'cleanup_pending', 'failed', 'complete')
  ),
  CONSTRAINT media_upload_operations_phase_check CHECK (
    phase IN ('preparing', 'uploading_original', 'preparing_derivative', 'saving_record', 'applying_organization', 'finalizing', 'cleanup_pending', 'complete', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_media_upload_operations_user_status
  ON public.media_upload_operations(user_id, status, updated_at DESC);

DROP TRIGGER IF EXISTS trg_media_upload_operations_updated_at ON public.media_upload_operations;
CREATE TRIGGER trg_media_upload_operations_updated_at
  BEFORE UPDATE ON public.media_upload_operations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.media_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_item_id uuid REFERENCES public.media_items(id) ON DELETE SET NULL,
  upload_operation_id uuid,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  storage_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT media_cleanup_jobs_kind_check CHECK (kind IN ('upload_rollback', 'media_deletion', 'derivative_cleanup')),
  CONSTRAINT media_cleanup_jobs_status_check CHECK (status IN ('pending', 'failed', 'complete')),
  CONSTRAINT media_cleanup_jobs_paths_array_check CHECK (
    jsonb_typeof(storage_paths) = 'array' AND jsonb_typeof(completed_paths) = 'array'
  )
);

CREATE INDEX IF NOT EXISTS idx_media_cleanup_jobs_user_status
  ON public.media_cleanup_jobs(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_cleanup_jobs_media
  ON public.media_cleanup_jobs(media_item_id, kind, status);

ALTER TABLE public.media_cleanup_jobs
  DROP CONSTRAINT IF EXISTS media_cleanup_jobs_upload_operation_kind_key;
ALTER TABLE public.media_cleanup_jobs
  ADD CONSTRAINT media_cleanup_jobs_upload_operation_kind_key
  UNIQUE (user_id, upload_operation_id, kind);

DROP TRIGGER IF EXISTS trg_media_cleanup_jobs_updated_at ON public.media_cleanup_jobs;
CREATE TRIGGER trg_media_cleanup_jobs_updated_at
  BEFORE UPDATE ON public.media_cleanup_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.media_upload_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_cleanup_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media upload operations: own select" ON public.media_upload_operations;
CREATE POLICY "media upload operations: own select"
  ON public.media_upload_operations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "media cleanup jobs: own select" ON public.media_cleanup_jobs;
CREATE POLICY "media cleanup jobs: own select"
  ON public.media_cleanup_jobs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Mutations are RPC-only. This keeps ownership/path validation centralized.
REVOKE INSERT, UPDATE, DELETE ON public.media_upload_operations FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.media_cleanup_jobs FROM authenticated;
GRANT SELECT ON public.media_upload_operations TO authenticated;
GRANT SELECT ON public.media_cleanup_jobs TO authenticated;

CREATE OR REPLACE FUNCTION public.media_storage_path_is_owned(
  p_user_id uuid,
  p_path text
)
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

REVOKE ALL ON FUNCTION public.media_storage_path_is_owned(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.media_storage_path_is_owned(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.media_storage_path_is_owned(uuid, text) FROM authenticated;

CREATE OR REPLACE FUNCTION public.media_paths_from_derivatives(
  p_user_id uuid,
  p_derivatives jsonb
)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_paths text[] := ARRAY[]::text[];
BEGIN
  IF p_derivatives IS NULL OR jsonb_typeof(p_derivatives) <> 'array' THEN
    RAISE EXCEPTION 'Derivative metadata must be an array' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_derivatives) AS derivative
    WHERE jsonb_typeof(derivative) <> 'object'
       OR jsonb_typeof(derivative->'kind') <> 'string'
       OR jsonb_typeof(derivative->'path') <> 'string'
       OR jsonb_typeof(derivative->'required') <> 'boolean'
       OR jsonb_typeof(derivative->'status') <> 'string'
       OR derivative->>'status' NOT IN ('ready', 'failed', 'pending')
       OR NOT public.media_storage_path_is_owned(p_user_id, derivative->>'path')
  ) THEN
    RAISE EXCEPTION 'Derivative metadata contains an invalid or foreign path' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT derivative->>'path' ORDER BY derivative->>'path'), ARRAY[]::text[])
  INTO v_paths
  FROM jsonb_array_elements(p_derivatives) AS derivative;

  RETURN v_paths;
END;
$$;

REVOKE ALL ON FUNCTION public.media_paths_from_derivatives(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.media_paths_from_derivatives(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.media_paths_from_derivatives(uuid, jsonb) FROM authenticated;

CREATE OR REPLACE FUNCTION public.begin_media_upload(
  p_operation_id uuid,
  p_original_path text,
  p_derivative_paths jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing public.media_upload_operations%ROWTYPE;
  v_canonical jsonb;
  v_cleanup_paths jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'Authentication is required to upload media.');
  END IF;
  IF p_operation_id IS NULL THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'A stable upload operation ID is required.');
  END IF;
  IF NOT public.media_storage_path_is_owned(v_user_id, p_original_path) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The upload path is invalid or not owned by the current user.');
  END IF;

  PERFORM public.media_paths_from_derivatives(v_user_id, COALESCE(p_derivative_paths, '[]'::jsonb));
  SELECT COALESCE(jsonb_agg(path ORDER BY path), '[]'::jsonb)
  INTO v_cleanup_paths
  FROM (
    SELECT DISTINCT unnest(
      ARRAY[p_original_path] || public.media_paths_from_derivatives(v_user_id, COALESCE(p_derivative_paths, '[]'::jsonb))
    ) AS path
  ) AS bound_paths;

  SELECT * INTO v_existing
  FROM public.media_upload_operations
  WHERE user_id = v_user_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.original_path <> p_original_path
       OR public.media_paths_from_derivatives(v_user_id, v_existing.derivative_paths)
          <> public.media_paths_from_derivatives(v_user_id, COALESCE(p_derivative_paths, '[]'::jsonb))
       OR jsonb_array_length(v_existing.derivative_paths) <> jsonb_array_length(COALESCE(p_derivative_paths, '[]'::jsonb))
       OR EXISTS (
         SELECT 1
         FROM jsonb_array_elements(v_existing.derivative_paths) AS bound
         WHERE NOT EXISTS (
           SELECT 1
           FROM jsonb_array_elements(COALESCE(p_derivative_paths, '[]'::jsonb)) AS requested
           WHERE requested->>'path' = bound->>'path'
             AND requested->>'kind' = bound->>'kind'
             AND (requested->>'required')::boolean = (bound->>'required')::boolean
         )
       ) THEN
      RETURN jsonb_build_object(
        'status', 'validation_failure',
        'message', 'This upload operation ID is already bound to different storage paths.'
      );
    END IF;

    INSERT INTO public.media_cleanup_jobs (
      user_id, upload_operation_id, kind, status, storage_paths, completed_paths, completed_at, last_error
    ) VALUES (
      v_user_id,
      p_operation_id,
      'upload_rollback',
      CASE WHEN v_existing.status = 'complete' THEN 'complete' ELSE 'pending' END,
      v_cleanup_paths,
      CASE WHEN v_existing.status = 'complete' THEN v_cleanup_paths ELSE '[]'::jsonb END,
      CASE WHEN v_existing.status = 'complete' THEN now() ELSE NULL END,
      CASE WHEN v_existing.status = 'complete' THEN NULL ELSE 'Upload has not been finalized.' END
    )
    ON CONFLICT (user_id, upload_operation_id, kind) DO UPDATE SET
      storage_paths = EXCLUDED.storage_paths;

    IF v_existing.media_item_id IS NOT NULL THEN
      v_canonical := public.media_item_canonical_payload(v_existing.media_item_id, v_user_id);
      IF v_canonical IS NOT NULL THEN
        RETURN jsonb_build_object(
          'status', 'success',
          'operation_status', v_existing.status,
          'phase', v_existing.phase,
          'media_item', v_canonical
        );
      END IF;
    END IF;

    UPDATE public.media_upload_operations
    SET status = 'uploading', phase = 'uploading_original', last_error = NULL
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.media_upload_operations (
      user_id, operation_id, original_path, derivative_paths, status, phase
    ) VALUES (
      v_user_id, p_operation_id, p_original_path, COALESCE(p_derivative_paths, '[]'::jsonb), 'uploading', 'uploading_original'
    );

    INSERT INTO public.media_cleanup_jobs (
      user_id, upload_operation_id, kind, status, storage_paths, completed_paths, last_error
    ) VALUES (
      v_user_id, p_operation_id, 'upload_rollback', 'pending', v_cleanup_paths, '[]'::jsonb,
      'Upload has not been finalized.'
    )
    ON CONFLICT (user_id, upload_operation_id, kind) DO UPDATE SET
      storage_paths = EXCLUDED.storage_paths,
      completed_paths = '[]'::jsonb,
      status = 'pending',
      completed_at = NULL,
      last_error = EXCLUDED.last_error;
  END IF;

  RETURN jsonb_build_object(
    'status', 'success',
    'operation_status', 'uploading',
    'phase', 'uploading_original',
    'media_item', NULL
  );
EXCEPTION
  WHEN invalid_parameter_value OR data_exception THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Upload derivative metadata is invalid.', 'error_code', SQLSTATE);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'unexpected_failure', 'message', 'The upload session could not be prepared.', 'error_code', SQLSTATE);
END;
$$;

REVOKE ALL ON FUNCTION public.begin_media_upload(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.begin_media_upload(uuid, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.begin_media_upload(uuid, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_media_upload_atomic(
  p_operation_id uuid,
  p_media jsonb,
  p_tag_names jsonb,
  p_collection_ids jsonb,
  p_derivative_paths jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_operation public.media_upload_operations%ROWTYPE;
  v_media public.media_items%ROWTYPE;
  v_media_id uuid;
  v_tag_names text[] := ARRAY[]::text[];
  v_collection_ids uuid[] := ARRAY[]::uuid[];
  v_invalid_collection_count integer;
  v_canonical jsonb;
  v_thumbnail_path text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'Authentication is required to finalize media.');
  END IF;
  IF p_media IS NULL OR jsonb_typeof(p_media) <> 'object' THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Media data must be supplied as an object.');
  END IF;
  IF p_tag_names IS NULL OR jsonb_typeof(p_tag_names) <> 'array' THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Tags must be supplied as an array.');
  END IF;
  IF p_collection_ids IS NULL OR jsonb_typeof(p_collection_ids) <> 'array' THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Collections must be supplied as an array.');
  END IF;

  SELECT * INTO v_operation
  FROM public.media_upload_operations
  WHERE user_id = v_user_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The upload session is missing. Retry from the original queued upload.');
  END IF;

  IF v_operation.media_item_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM jsonb_array_elements(v_operation.derivative_paths) AS derivative
       WHERE derivative->>'status' = 'failed'
     ) THEN
    v_canonical := public.media_item_canonical_payload(v_operation.media_item_id, v_user_id);
    IF v_canonical IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'success', 'media_item', v_canonical, 'reconciled', true);
    END IF;
  END IF;

  IF p_media->>'storage_path' <> v_operation.original_path
     OR NOT public.media_storage_path_is_owned(v_user_id, p_media->>'storage_path') THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The canonical original path does not match the upload session.');
  END IF;

  PERFORM public.media_paths_from_derivatives(v_user_id, COALESCE(p_derivative_paths, '[]'::jsonb));
  IF public.media_paths_from_derivatives(v_user_id, COALESCE(p_derivative_paths, '[]'::jsonb))
     <> public.media_paths_from_derivatives(v_user_id, v_operation.derivative_paths)
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(v_operation.derivative_paths) AS planned
       WHERE (planned->>'required')::boolean = true
         AND NOT EXISTS (
           SELECT 1
           FROM jsonb_array_elements(COALESCE(p_derivative_paths, '[]'::jsonb)) AS actual
           WHERE actual->>'path' = planned->>'path'
             AND actual->>'kind' = planned->>'kind'
             AND (actual->>'required')::boolean = true
         )
     ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Derivative paths do not match the upload session.');
  END IF;

  UPDATE public.media_upload_operations
  SET derivative_paths = COALESCE(p_derivative_paths, '[]'::jsonb)
  WHERE id = v_operation.id;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(p_derivative_paths, '[]'::jsonb)) AS derivative
    WHERE (derivative->>'required')::boolean = true AND derivative->>'status' <> 'ready'
  ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'A required media derivative is not ready. The upload remains retryable.');
  END IF;

  v_thumbnail_path := nullif(p_media->>'thumbnail_path', '');
  IF v_thumbnail_path IS NOT NULL AND NOT public.media_storage_path_is_owned(v_user_id, v_thumbnail_path) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The thumbnail path is invalid or foreign.');
  END IF;

  -- Once a canonical row exists, this RPC is a derivative-only retry. Preserve
  -- every user-editable field and relationship so a delayed thumbnail retry
  -- cannot overwrite newer Prompt 1 revisions, tags, or collection membership.
  IF v_operation.media_item_id IS NOT NULL THEN
    UPDATE public.media_items
    SET thumbnail_path = v_thumbnail_path,
        derivative_paths = COALESCE(p_derivative_paths, '[]'::jsonb)
    WHERE id = v_operation.media_item_id
      AND user_id = v_user_id
      AND upload_operation_id = p_operation_id
      AND lifecycle_status = 'complete'
    RETURNING * INTO v_media;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'status', 'conflict',
        'message', 'The canonical media item changed lifecycle while its derivative was retrying. Refresh before retrying.'
      );
    END IF;

    UPDATE public.media_upload_operations
    SET status = 'complete',
        phase = 'complete',
        derivative_paths = COALESCE(p_derivative_paths, '[]'::jsonb),
        last_error = NULL
    WHERE id = v_operation.id;

    UPDATE public.media_cleanup_jobs
    SET status = 'complete',
        completed_paths = storage_paths,
        last_error = NULL,
        completed_at = now()
    WHERE user_id = v_user_id
      AND upload_operation_id = p_operation_id
      AND kind = 'upload_rollback';

    v_canonical := public.media_item_canonical_payload(v_operation.media_item_id, v_user_id);
    RETURN jsonb_build_object('status', 'success', 'media_item', v_canonical, 'reconciled', true);
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_tag_names) AS tag_value
    WHERE jsonb_typeof(tag_value) <> 'string'
       OR nullif(btrim(tag_value #>> '{}'), '') IS NULL
       OR length(btrim(tag_value #>> '{}')) > 100
  ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Every tag must be non-empty text no longer than 100 characters.');
  END IF;

  SELECT COALESCE(array_agg(tag_name ORDER BY lower(tag_name), tag_name), ARRAY[]::text[])
  INTO v_tag_names
  FROM (
    SELECT DISTINCT btrim(tag_value #>> '{}') AS tag_name
    FROM jsonb_array_elements(p_tag_names) AS tag_value
  ) AS normalized_tags;

  BEGIN
    SELECT COALESCE(array_agg(collection_id ORDER BY collection_id), ARRAY[]::uuid[])
    INTO v_collection_ids
    FROM (
      SELECT DISTINCT (collection_value #>> '{}')::uuid AS collection_id
      FROM jsonb_array_elements(p_collection_ids) AS collection_value
      WHERE jsonb_typeof(collection_value) = 'string'
    ) AS normalized_collections;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'One or more collection identifiers are invalid.');
  END;

  IF jsonb_array_length(p_collection_ids) <> COALESCE(array_length(v_collection_ids, 1), 0) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Collection identifiers must be unique UUID strings.');
  END IF;

  SELECT count(*) INTO v_invalid_collection_count
  FROM unnest(v_collection_ids) AS requested_collection_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.media_collections AS owned_collection
    WHERE owned_collection.id = requested_collection_id AND owned_collection.user_id = v_user_id
  );

  IF v_invalid_collection_count > 0 THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'One or more selected collections are unavailable or owned by another user.');
  END IF;

  IF jsonb_typeof(p_media->'name') <> 'string'
     OR nullif(btrim(p_media->>'name'), '') IS NULL
     OR p_media->>'type' NOT IN ('image', 'video')
     OR jsonb_typeof(p_media->'media_role') <> 'string'
     OR jsonb_typeof(COALESCE(p_media->'metadata', '{}'::jsonb)) <> 'object' THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The media record is incomplete or invalid.');
  END IF;

  PERFORM 1 FROM public.media_collections
  WHERE id = ANY(v_collection_ids)
  ORDER BY id
  FOR UPDATE;

  UPDATE public.media_upload_operations
  SET status = 'saving', phase = 'saving_record', last_error = NULL
  WHERE id = v_operation.id;

  INSERT INTO public.media_items (
    user_id, name, type, storage_path, thumbnail_path, width, height, duration_sec,
    file_size, mime_type, favorite, media_role, title, description, metadata,
    upload_operation_id, lifecycle_status, derivative_paths
  ) VALUES (
    v_user_id,
    btrim(p_media->>'name'),
    p_media->>'type',
    p_media->>'storage_path',
    v_thumbnail_path,
    nullif(p_media->>'width', '')::integer,
    nullif(p_media->>'height', '')::integer,
    nullif(p_media->>'duration_sec', '')::double precision,
    nullif(p_media->>'file_size', '')::bigint,
    nullif(p_media->>'mime_type', ''),
    COALESCE((p_media->>'favorite')::boolean, false),
    p_media->>'media_role',
    nullif(btrim(p_media->>'title'), ''),
    nullif(btrim(p_media->>'description'), ''),
    COALESCE(p_media->'metadata', '{}'::jsonb),
    p_operation_id,
    'complete',
    COALESCE(p_derivative_paths, '[]'::jsonb)
  )
  ON CONFLICT (user_id, upload_operation_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    storage_path = EXCLUDED.storage_path,
    thumbnail_path = EXCLUDED.thumbnail_path,
    width = EXCLUDED.width,
    height = EXCLUDED.height,
    duration_sec = EXCLUDED.duration_sec,
    file_size = EXCLUDED.file_size,
    mime_type = EXCLUDED.mime_type,
    favorite = EXCLUDED.favorite,
    media_role = EXCLUDED.media_role,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    metadata = EXCLUDED.metadata,
    lifecycle_status = 'complete',
    derivative_paths = EXCLUDED.derivative_paths
  RETURNING * INTO v_media;

  v_media_id := v_media.id;

  UPDATE public.media_upload_operations
  SET phase = 'applying_organization'
  WHERE id = v_operation.id;

  INSERT INTO public.media_tags (user_id, name)
  SELECT v_user_id, requested_tag_name
  FROM unnest(v_tag_names) AS requested_tag_name
  ON CONFLICT (user_id, name) DO NOTHING;

  DELETE FROM public.media_item_tags WHERE media_item_id = v_media_id;
  INSERT INTO public.media_item_tags (media_item_id, tag_id)
  SELECT v_media_id, tag_row.id
  FROM public.media_tags AS tag_row
  WHERE tag_row.user_id = v_user_id AND tag_row.name = ANY(v_tag_names)
  ON CONFLICT (media_item_id, tag_id) DO NOTHING;

  DELETE FROM public.media_collection_items WHERE media_item_id = v_media_id;
  INSERT INTO public.media_collection_items (collection_id, media_item_id, sort_order)
  SELECT requested_collection_id, v_media_id,
    COALESCE((SELECT max(existing.sort_order) + 1 FROM public.media_collection_items AS existing WHERE existing.collection_id = requested_collection_id), 0)
  FROM unnest(v_collection_ids) AS requested_collection_id
  ON CONFLICT (collection_id, media_item_id) DO NOTHING;

  UPDATE public.media_upload_operations
  SET status = 'complete', phase = 'complete', media_item_id = v_media_id, last_error = NULL
  WHERE id = v_operation.id;

  UPDATE public.media_cleanup_jobs
  SET status = 'complete',
      completed_paths = storage_paths,
      last_error = NULL,
      completed_at = now()
  WHERE user_id = v_user_id
    AND upload_operation_id = p_operation_id
    AND kind = 'upload_rollback';

  v_canonical := public.media_item_canonical_payload(v_media_id, v_user_id);
  RETURN jsonb_build_object('status', 'success', 'media_item', v_canonical, 'reconciled', false);
EXCEPTION
  WHEN check_violation OR not_null_violation OR foreign_key_violation OR unique_violation OR invalid_text_representation THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The media upload failed validation and no database changes were saved.', 'error_code', SQLSTATE);
  WHEN serialization_failure OR deadlock_detected THEN
    RETURN jsonb_build_object('status', 'conflict', 'message', 'The upload conflicted with another request. Retry with the same operation ID.', 'error_code', SQLSTATE);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'unexpected_failure', 'message', 'The media upload could not be finalized. No partial database organization was kept.', 'error_code', SQLSTATE);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_media_upload_atomic(uuid, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_media_upload_atomic(uuid, jsonb, jsonb, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.finalize_media_upload_atomic(uuid, jsonb, jsonb, jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_media_upload_cleanup_pending(
  p_operation_id uuid,
  p_storage_paths jsonb,
  p_error text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_operation public.media_upload_operations%ROWTYPE;
  v_job public.media_cleanup_jobs%ROWTYPE;
  v_allowed_paths text[];
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'Authentication is required to record upload cleanup.');
  END IF;
  IF p_storage_paths IS NULL OR jsonb_typeof(p_storage_paths) <> 'array'
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_storage_paths) AS path_value WHERE jsonb_typeof(path_value) <> 'string') THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Cleanup paths must be an array of strings.');
  END IF;

  SELECT * INTO v_operation
  FROM public.media_upload_operations
  WHERE user_id = v_user_id AND operation_id = p_operation_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The upload session is unavailable.');
  END IF;
  IF v_operation.media_item_id IS NOT NULL
     AND public.media_item_canonical_payload(v_operation.media_item_id, v_user_id) IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'message', 'The upload already has a canonical media item. Reconcile it instead of deleting its storage.'
    );
  END IF;

  v_allowed_paths := ARRAY[v_operation.original_path] || public.media_paths_from_derivatives(v_user_id, v_operation.derivative_paths);
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(p_storage_paths) AS requested(path)
    WHERE NOT (requested.path = ANY(v_allowed_paths))
       OR NOT public.media_storage_path_is_owned(v_user_id, requested.path)
  ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Cleanup requested a path outside this upload operation.');
  END IF;

  INSERT INTO public.media_cleanup_jobs (
    user_id, upload_operation_id, kind, status, storage_paths, completed_paths, completed_at, last_error
  ) VALUES (
    v_user_id, p_operation_id, 'upload_rollback', 'pending', p_storage_paths, '[]'::jsonb, NULL, p_error
  )
  ON CONFLICT (user_id, upload_operation_id, kind) DO UPDATE SET
    storage_paths = EXCLUDED.storage_paths,
    completed_paths = '[]'::jsonb,
    status = 'pending',
    completed_at = NULL,
    last_error = EXCLUDED.last_error
  RETURNING * INTO v_job;

  UPDATE public.media_upload_operations
  SET status = 'cleanup_pending', phase = 'cleanup_pending', last_error = p_error
  WHERE id = v_operation.id;

  RETURN jsonb_build_object('status', 'success', 'cleanup_job', to_jsonb(v_job));
END;
$$;

REVOKE ALL ON FUNCTION public.mark_media_upload_cleanup_pending(uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_media_upload_cleanup_pending(uuid, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_media_upload_cleanup_pending(uuid, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_media_cleanup_job(
  p_job_id uuid,
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
  v_job public.media_cleanup_jobs%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'Authentication is required to update cleanup.');
  END IF;
  IF p_status NOT IN ('pending', 'failed', 'complete') THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Cleanup status is invalid.');
  END IF;
  IF p_completed_paths IS NULL OR jsonb_typeof(p_completed_paths) <> 'array'
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_completed_paths) AS path_value WHERE jsonb_typeof(path_value) <> 'string') THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Completed cleanup paths must be an array of strings.');
  END IF;

  SELECT * INTO v_job
  FROM public.media_cleanup_jobs
  WHERE id = p_job_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The cleanup job is unavailable or not owned by the current user.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(p_completed_paths) AS completed(path)
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_job.storage_paths) AS expected(path)
      WHERE expected.path = completed.path
    )
  ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'A completed path is not part of this cleanup job.');
  END IF;

  UPDATE public.media_cleanup_jobs
  SET completed_paths = p_completed_paths,
      status = p_status,
      last_error = p_error,
      completed_at = CASE WHEN p_status = 'complete' THEN now() ELSE NULL END
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  IF v_job.kind = 'upload_rollback' AND v_job.upload_operation_id IS NOT NULL THEN
    UPDATE public.media_upload_operations
    SET status = CASE WHEN p_status = 'complete' THEN 'failed' ELSE 'cleanup_pending' END,
        phase = CASE WHEN p_status = 'complete' THEN 'failed' ELSE 'cleanup_pending' END,
        last_error = p_error
    WHERE user_id = v_user_id AND operation_id = v_job.upload_operation_id;
  END IF;

  IF v_job.kind = 'media_deletion' AND v_job.media_item_id IS NOT NULL THEN
    UPDATE public.media_items
    SET lifecycle_status = CASE WHEN p_status = 'failed' THEN 'deletion_failed' ELSE 'deletion_pending' END
    WHERE id = v_job.media_item_id AND user_id = v_user_id;
  END IF;

  RETURN jsonb_build_object('status', 'success', 'cleanup_job', to_jsonb(v_job));
END;
$$;

REVOKE ALL ON FUNCTION public.update_media_cleanup_job(uuid, jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_media_cleanup_job(uuid, jsonb, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_media_cleanup_job(uuid, jsonb, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_media_deletion(p_media_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_media public.media_items%ROWTYPE;
  v_job public.media_cleanup_jobs%ROWTYPE;
  v_paths text[] := ARRAY[]::text[];
  v_paths_json jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'Authentication is required to delete media.');
  END IF;

  SELECT * INTO v_media
  FROM public.media_items
  WHERE id = p_media_item_id
  FOR UPDATE;
  IF NOT FOUND OR v_media.user_id IS DISTINCT FROM v_user_id THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The media item is unavailable or not owned by the current user.');
  END IF;

  SELECT * INTO v_job
  FROM public.media_cleanup_jobs
  WHERE user_id = v_user_id
    AND media_item_id = p_media_item_id
    AND kind = 'media_deletion'
    AND status IN ('pending', 'failed')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.media_items SET lifecycle_status = 'deletion_pending' WHERE id = p_media_item_id;
    RETURN jsonb_build_object('status', 'success', 'cleanup_job', to_jsonb(v_job), 'reconciled', true);
  END IF;

  IF NOT public.media_storage_path_is_owned(v_user_id, v_media.storage_path) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The canonical original path is invalid or foreign.');
  END IF;
  v_paths := array_append(v_paths, v_media.storage_path);

  IF v_media.thumbnail_path IS NOT NULL AND v_media.thumbnail_path <> v_media.storage_path THEN
    IF NOT public.media_storage_path_is_owned(v_user_id, v_media.thumbnail_path) THEN
      RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The canonical thumbnail path is invalid or foreign.');
    END IF;
    v_paths := array_append(v_paths, v_media.thumbnail_path);
  END IF;

  v_paths := v_paths || public.media_paths_from_derivatives(v_user_id, COALESCE(v_media.derivative_paths, '[]'::jsonb));
  SELECT COALESCE(jsonb_agg(path ORDER BY path), '[]'::jsonb)
  INTO v_paths_json
  FROM (SELECT DISTINCT unnest(v_paths) AS path) AS unique_paths;

  INSERT INTO public.media_cleanup_jobs (
    user_id, media_item_id, upload_operation_id, kind, status, storage_paths
  ) VALUES (
    v_user_id, p_media_item_id, v_media.upload_operation_id, 'media_deletion', 'pending', v_paths_json
  ) RETURNING * INTO v_job;

  UPDATE public.media_items
  SET lifecycle_status = 'deletion_pending'
  WHERE id = p_media_item_id;

  RETURN jsonb_build_object('status', 'success', 'cleanup_job', to_jsonb(v_job), 'reconciled', false);
EXCEPTION
  WHEN invalid_parameter_value OR data_exception THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Stored derivative cleanup metadata is invalid.', 'error_code', SQLSTATE);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'unexpected_failure', 'message', 'The deletion request could not be recorded safely.', 'error_code', SQLSTATE);
END;
$$;

REVOKE ALL ON FUNCTION public.request_media_deletion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_media_deletion(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_media_deletion(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_media_deletion(p_cleanup_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_job public.media_cleanup_jobs%ROWTYPE;
  v_media_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'Authentication is required to finalize deletion.');
  END IF;

  SELECT * INTO v_job
  FROM public.media_cleanup_jobs
  WHERE id = p_cleanup_job_id AND user_id = v_user_id AND kind = 'media_deletion'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The deletion cleanup job is unavailable or not owned by the current user.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_job.storage_paths) AS expected(path)
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_job.completed_paths) AS completed(path)
      WHERE completed.path = expected.path
    )
  ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Storage cleanup is incomplete. Retry the remaining exact paths before finalizing deletion.');
  END IF;

  v_media_id := v_job.media_item_id;
  IF v_media_id IS NOT NULL THEN
    DELETE FROM public.media_items
    WHERE id = v_media_id AND user_id = v_user_id;
  END IF;

  UPDATE public.media_cleanup_jobs
  SET status = 'complete', last_error = NULL, completed_at = now()
  WHERE id = p_cleanup_job_id;

  RETURN jsonb_build_object('status', 'success', 'media_item_id', v_media_id);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_media_deletion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_media_deletion(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.finalize_media_deletion(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_pending_media_cleanup()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(job_row) ORDER BY job_row.updated_at DESC), '[]'::jsonb)
  FROM public.media_cleanup_jobs AS job_row
  WHERE job_row.user_id = auth.uid()
    AND job_row.status IN ('pending', 'failed');
$$;

REVOKE ALL ON FUNCTION public.list_pending_media_cleanup() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_pending_media_cleanup() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_pending_media_cleanup() TO authenticated;
