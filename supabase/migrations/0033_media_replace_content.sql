-- Media Manager "Save": atomically replace the CONTENT of one canonical media
-- item while keeping its identity (id, title, description, role, favorite,
-- tags, collection membership and Deck references all stay attached).
--
-- Storage paths are immutable (uploads/<operation>/original.<ext>), so a replace
-- uploads the rendered file to a fresh operation path first, then this RPC swaps
-- the row over to it in ONE transaction guarded by the expected revision. The
-- previous objects are recorded as a durable 'derivative_cleanup' job in the same
-- transaction; the client deletes them afterwards and completes the job, and any
-- job that is interrupted stays visible in list_pending_media_cleanup().

CREATE OR REPLACE FUNCTION public.replace_media_item_content_atomic(
  p_media_item_id uuid,
  p_expected_revision bigint,
  p_operation_id uuid,
  p_media jsonb,
  p_derivative_paths jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing public.media_items%ROWTYPE;
  v_operation public.media_upload_operations%ROWTYPE;
  v_thumbnail_path text;
  v_new_paths text[];
  v_old_paths text[] := ARRAY[]::text[];
  v_cleanup_paths jsonb;
  v_job public.media_cleanup_jobs%ROWTYPE;
  v_has_job boolean := false;
  v_canonical jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'Authentication is required to replace media.');
  END IF;
  IF p_expected_revision IS NULL THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'An expected media revision is required.');
  END IF;
  IF p_media IS NULL OR jsonb_typeof(p_media) <> 'object' THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Replacement media data must be supplied as an object.');
  END IF;
  IF p_derivative_paths IS NULL OR jsonb_typeof(p_derivative_paths) <> 'array' THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Derivative metadata must be supplied as an array.');
  END IF;

  SELECT * INTO v_existing
  FROM public.media_items
  WHERE id = p_media_item_id
  FOR UPDATE;

  IF NOT FOUND OR v_existing.user_id IS DISTINCT FROM v_user_id THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The media item is unavailable or is not owned by the current user.');
  END IF;

  SELECT * INTO v_operation
  FROM public.media_upload_operations
  WHERE user_id = v_user_id AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The upload session is missing. Retry the save.');
  END IF;

  -- Idempotent retry: this exact operation already replaced this item.
  IF v_operation.media_item_id IS NOT NULL THEN
    IF v_operation.media_item_id = p_media_item_id THEN
      v_canonical := public.media_item_canonical_payload(p_media_item_id, v_user_id);
      RETURN jsonb_build_object('status', 'success', 'media_item', v_canonical, 'cleanup_job', NULL, 'reconciled', true);
    END IF;
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'This upload operation already belongs to a different media item.');
  END IF;

  IF v_existing.revision <> p_expected_revision THEN
    v_canonical := public.media_item_canonical_payload(p_media_item_id, v_user_id);
    RETURN jsonb_build_object(
      'status', 'conflict',
      'message', 'This media item changed in another session. Review the current version before saving your edits.',
      'current_revision', v_existing.revision,
      'media_item', v_canonical
    );
  END IF;

  IF v_existing.lifecycle_status <> 'complete' THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'This media item is being deleted and cannot be replaced.');
  END IF;

  IF jsonb_typeof(p_media->'name') <> 'string'
     OR nullif(btrim(p_media->>'name'), '') IS NULL
     OR p_media->>'type' IS DISTINCT FROM v_existing.type
     OR jsonb_typeof(COALESCE(p_media->'metadata', '{}'::jsonb)) <> 'object' THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The replacement media is incomplete, or changes the media type.');
  END IF;

  IF p_media->>'storage_path' IS DISTINCT FROM v_operation.original_path
     OR NOT public.media_storage_path_is_owned(v_user_id, p_media->>'storage_path') THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The replacement path does not match the upload session.');
  END IF;

  PERFORM public.media_paths_from_derivatives(v_user_id, p_derivative_paths);
  IF public.media_paths_from_derivatives(v_user_id, p_derivative_paths)
     <> public.media_paths_from_derivatives(v_user_id, v_operation.derivative_paths)
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(v_operation.derivative_paths) AS planned
       WHERE (planned->>'required')::boolean = true
         AND NOT EXISTS (
           SELECT 1
           FROM jsonb_array_elements(p_derivative_paths) AS actual
           WHERE actual->>'path' = planned->>'path'
             AND actual->>'kind' = planned->>'kind'
             AND (actual->>'required')::boolean = true
         )
     ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Derivative paths do not match the upload session.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_derivative_paths) AS derivative
    WHERE (derivative->>'required')::boolean = true AND derivative->>'status' <> 'ready'
  ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'A required media derivative is not ready. The save remains retryable.');
  END IF;

  v_thumbnail_path := nullif(p_media->>'thumbnail_path', '');
  IF v_thumbnail_path IS NOT NULL AND NOT public.media_storage_path_is_owned(v_user_id, v_thumbnail_path) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The thumbnail path is invalid or foreign.');
  END IF;

  -- Objects to delete afterwards: everything the row referenced before, except
  -- anything the replacement still uses, and never a path this user does not own.
  v_new_paths := ARRAY[p_media->>'storage_path']
    || CASE WHEN v_thumbnail_path IS NULL THEN ARRAY[]::text[] ELSE ARRAY[v_thumbnail_path] END
    || public.media_paths_from_derivatives(v_user_id, p_derivative_paths);

  SELECT COALESCE(array_agg(DISTINCT old_path), ARRAY[]::text[])
  INTO v_old_paths
  FROM unnest(
    ARRAY[v_existing.storage_path]
    || CASE WHEN v_existing.thumbnail_path IS NULL THEN ARRAY[]::text[] ELSE ARRAY[v_existing.thumbnail_path] END
    || public.media_paths_from_derivatives(v_user_id, COALESCE(v_existing.derivative_paths, '[]'::jsonb))
  ) AS old_path
  WHERE public.media_storage_path_is_owned(v_user_id, old_path)
    AND NOT (old_path = ANY(v_new_paths));

  UPDATE public.media_items
  SET name = btrim(p_media->>'name'),
      storage_path = p_media->>'storage_path',
      thumbnail_path = v_thumbnail_path,
      width = nullif(p_media->>'width', '')::integer,
      height = nullif(p_media->>'height', '')::integer,
      duration_sec = nullif(p_media->>'duration_sec', '')::double precision,
      file_size = nullif(p_media->>'file_size', '')::bigint,
      mime_type = nullif(p_media->>'mime_type', ''),
      metadata = COALESCE(p_media->'metadata', '{}'::jsonb),
      upload_operation_id = p_operation_id,
      derivative_paths = p_derivative_paths
  WHERE id = p_media_item_id AND user_id = v_user_id;

  UPDATE public.media_upload_operations
  SET status = 'complete',
      phase = 'complete',
      media_item_id = p_media_item_id,
      derivative_paths = p_derivative_paths,
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

  IF COALESCE(array_length(v_old_paths, 1), 0) > 0 THEN
    SELECT COALESCE(jsonb_agg(path ORDER BY path), '[]'::jsonb)
    INTO v_cleanup_paths
    FROM unnest(v_old_paths) AS path;

    INSERT INTO public.media_cleanup_jobs (
      user_id, media_item_id, kind, status, storage_paths, last_error
    ) VALUES (
      v_user_id, p_media_item_id, 'derivative_cleanup', 'pending', v_cleanup_paths,
      'Previous media content is queued for removal.'
    ) RETURNING * INTO v_job;
    v_has_job := true;
  END IF;

  v_canonical := public.media_item_canonical_payload(p_media_item_id, v_user_id);
  RETURN jsonb_build_object(
    'status', 'success',
    'media_item', v_canonical,
    'cleanup_job', CASE WHEN v_has_job THEN to_jsonb(v_job) ELSE NULL END,
    'reconciled', false
  );
EXCEPTION
  WHEN invalid_parameter_value OR data_exception THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The replacement media metadata is invalid.', 'error_code', SQLSTATE);
  WHEN check_violation OR not_null_violation OR foreign_key_violation OR unique_violation OR invalid_text_representation THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The media replacement failed validation and no database changes were saved.', 'error_code', SQLSTATE);
  WHEN serialization_failure OR deadlock_detected THEN
    RETURN jsonb_build_object('status', 'conflict', 'message', 'The replacement conflicted with another request. Retry the save.', 'error_code', SQLSTATE);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'unexpected_failure', 'message', 'The media could not be replaced. No partial database change was kept.', 'error_code', SQLSTATE);
END;
$$;

REVOKE ALL ON FUNCTION public.replace_media_item_content_atomic(uuid, bigint, uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_media_item_content_atomic(uuid, bigint, uuid, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.replace_media_item_content_atomic(uuid, bigint, uuid, jsonb, jsonb) TO authenticated;
