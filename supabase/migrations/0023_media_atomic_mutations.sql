-- Media Manager data-integrity foundation.
-- Adds optimistic concurrency, one atomic media edit RPC, and atomic collection ordering.

ALTER TABLE public.media_items
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.media_items.revision IS
  'Monotonic optimistic-concurrency token. Incremented after each successful canonical media update.';

CREATE OR REPLACE FUNCTION public.bump_media_item_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.revision := OLD.revision + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_items_revision ON public.media_items;
CREATE TRIGGER trg_media_items_revision
  BEFORE UPDATE ON public.media_items
  FOR EACH ROW EXECUTE FUNCTION public.bump_media_item_revision();

-- Serialize every collection-membership change on its parent collection.
-- This makes the complete-set reorder validation stable even when uploads,
-- edits, or deletes change membership concurrently.
CREATE OR REPLACE FUNCTION public.lock_media_collection_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM 1 FROM public.media_collections WHERE id = OLD.collection_id FOR UPDATE;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.collection_id IS DISTINCT FROM OLD.collection_id THEN
    PERFORM 1
    FROM public.media_collections
    WHERE id = ANY(ARRAY[OLD.collection_id, NEW.collection_id])
    ORDER BY id
    FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.media_collections WHERE id = NEW.collection_id FOR UPDATE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_collection_items_lock_parent ON public.media_collection_items;
CREATE TRIGGER trg_media_collection_items_lock_parent
  BEFORE INSERT OR UPDATE OR DELETE ON public.media_collection_items
  FOR EACH ROW EXECUTE FUNCTION public.lock_media_collection_membership();

-- Internal canonical envelope used by the mutation RPC. The explicit user id
-- keeps SECURITY DEFINER callers from accidentally exposing another user's row.
CREATE OR REPLACE FUNCTION public.media_item_canonical_payload(
  p_media_item_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT to_jsonb(media_row)
    || jsonb_build_object(
      'tags', COALESCE((
        SELECT jsonb_agg(tag_row.name ORDER BY lower(tag_row.name), tag_row.name, tag_row.id)
        FROM public.media_item_tags AS link
        JOIN public.media_tags AS tag_row ON tag_row.id = link.tag_id
        WHERE link.media_item_id = media_row.id
          AND tag_row.user_id = p_user_id
      ), '[]'::jsonb),
      'collection_ids', COALESCE((
        SELECT jsonb_agg(collection_row.id ORDER BY lower(collection_row.name), collection_row.name, collection_row.id)
        FROM public.media_collection_items AS link
        JOIN public.media_collections AS collection_row ON collection_row.id = link.collection_id
        WHERE link.media_item_id = media_row.id
          AND collection_row.user_id = p_user_id
      ), '[]'::jsonb)
    )
  FROM public.media_items AS media_row
  WHERE media_row.id = p_media_item_id
    AND media_row.user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.media_item_canonical_payload(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.media_item_canonical_payload(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.media_item_canonical_payload(uuid, uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.save_media_item_atomic(
  p_media_item_id uuid,
  p_expected_revision bigint,
  p_patch jsonb,
  p_tag_names jsonb,
  p_collection_ids jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing public.media_items%ROWTYPE;
  v_updated public.media_items%ROWTYPE;
  v_tag_names text[] := ARRAY[]::text[];
  v_collection_ids uuid[] := ARRAY[]::uuid[];
  v_unknown_key text;
  v_invalid_collection_count integer;
  v_canonical jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'authorization_failure',
      'message', 'Authentication is required to update media.'
    );
  END IF;

  IF p_expected_revision IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'An expected media revision is required.'
    );
  END IF;

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Media changes must be supplied as a JSON object.'
    );
  END IF;

  SELECT key
  INTO v_unknown_key
  FROM jsonb_object_keys(p_patch) AS key
  WHERE key NOT IN ('media_role', 'title', 'description', 'favorite', 'metadata')
  LIMIT 1;

  IF v_unknown_key IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', format('Unsupported media field: %s.', v_unknown_key)
    );
  END IF;

  IF p_patch ? 'media_role'
     AND (jsonb_typeof(p_patch->'media_role') <> 'string'
          OR nullif(btrim(p_patch->>'media_role'), '') IS NULL) THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Media role must be a non-empty string.'
    );
  END IF;

  IF p_patch ? 'title'
     AND jsonb_typeof(p_patch->'title') NOT IN ('string', 'null') THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Media title must be text or null.'
    );
  END IF;

  IF p_patch ? 'description'
     AND jsonb_typeof(p_patch->'description') NOT IN ('string', 'null') THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Media description must be text or null.'
    );
  END IF;

  IF p_patch ? 'favorite'
     AND jsonb_typeof(p_patch->'favorite') <> 'boolean' THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Favorite must be a boolean.'
    );
  END IF;

  IF p_patch ? 'metadata'
     AND jsonb_typeof(p_patch->'metadata') <> 'object' THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Media metadata must be a JSON object.'
    );
  END IF;

  IF p_tag_names IS NULL OR jsonb_typeof(p_tag_names) <> 'array' THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Tags must be supplied as an array.'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_tag_names) AS tag_value
    WHERE jsonb_typeof(tag_value) <> 'string'
       OR nullif(btrim(tag_value #>> '{}'), '') IS NULL
       OR length(btrim(tag_value #>> '{}')) > 100
  ) THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Every tag must be non-empty text no longer than 100 characters.'
    );
  END IF;

  SELECT COALESCE(array_agg(tag_name ORDER BY lower(tag_name), tag_name), ARRAY[]::text[])
  INTO v_tag_names
  FROM (
    SELECT DISTINCT btrim(tag_value #>> '{}') AS tag_name
    FROM jsonb_array_elements(p_tag_names) AS tag_value
  ) AS normalized_tags;

  IF p_collection_ids IS NULL OR jsonb_typeof(p_collection_ids) <> 'array' THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Collections must be supplied as an array.'
    );
  END IF;

  BEGIN
    SELECT COALESCE(array_agg(collection_id ORDER BY collection_id), ARRAY[]::uuid[])
    INTO v_collection_ids
    FROM (
      SELECT DISTINCT (collection_value #>> '{}')::uuid AS collection_id
      FROM jsonb_array_elements(p_collection_ids) AS collection_value
      WHERE jsonb_typeof(collection_value) = 'string'
    ) AS normalized_collections;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN jsonb_build_object(
        'status', 'validation_failure',
        'message', 'One or more collection identifiers are invalid.'
      );
  END;

  IF jsonb_array_length(p_collection_ids) <> COALESCE(array_length(v_collection_ids, 1), 0) THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Collection identifiers must be unique UUID strings.'
    );
  END IF;

  SELECT *
  INTO v_existing
  FROM public.media_items
  WHERE id = p_media_item_id
  FOR UPDATE;

  IF NOT FOUND OR v_existing.user_id IS DISTINCT FROM v_user_id THEN
    RETURN jsonb_build_object(
      'status', 'authorization_failure',
      'message', 'The media item is unavailable or is not owned by the current user.'
    );
  END IF;

  IF v_existing.revision <> p_expected_revision THEN
    v_canonical := public.media_item_canonical_payload(p_media_item_id, v_user_id);
    RETURN jsonb_build_object(
      'status', 'conflict',
      'message', 'This media item changed in another session. Review the current version before reapplying your changes.',
      'current_revision', v_existing.revision,
      'media_item', v_canonical
    );
  END IF;

  SELECT count(*)
  INTO v_invalid_collection_count
  FROM unnest(v_collection_ids) AS requested_collection_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.media_collections AS owned_collection
    WHERE owned_collection.id = requested_collection_id
      AND owned_collection.user_id = v_user_id
  );

  IF v_invalid_collection_count > 0 THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'One or more selected collections are unavailable or owned by another user.'
    );
  END IF;

  -- Lock every current and desired collection in deterministic UUID order so
  -- membership replacement cannot race an atomic reorder or another edit.
  PERFORM 1
  FROM public.media_collections AS collection_row
  WHERE collection_row.id = ANY(v_collection_ids)
     OR collection_row.id IN (
       SELECT membership.collection_id
       FROM public.media_collection_items AS membership
       WHERE membership.media_item_id = p_media_item_id
     )
  ORDER BY collection_row.id
  FOR UPDATE;

  -- One canonical row update advances revision exactly once. All relationship
  -- work below shares this transaction and is rolled back if any step fails.
  UPDATE public.media_items
  SET
    media_role = CASE WHEN p_patch ? 'media_role' THEN p_patch->>'media_role' ELSE v_existing.media_role END,
    title = CASE WHEN p_patch ? 'title' THEN nullif(btrim(p_patch->>'title'), '') ELSE v_existing.title END,
    description = CASE WHEN p_patch ? 'description' THEN nullif(btrim(p_patch->>'description'), '') ELSE v_existing.description END,
    favorite = CASE WHEN p_patch ? 'favorite' THEN (p_patch->>'favorite')::boolean ELSE v_existing.favorite END,
    metadata = CASE WHEN p_patch ? 'metadata' THEN p_patch->'metadata' ELSE v_existing.metadata END
  WHERE id = p_media_item_id
    AND user_id = v_user_id
  RETURNING * INTO v_updated;

  INSERT INTO public.media_tags (user_id, name)
  SELECT v_user_id, requested_tag_name
  FROM unnest(v_tag_names) AS requested_tag_name
  ON CONFLICT (user_id, name) DO NOTHING;

  DELETE FROM public.media_item_tags AS existing_link
  WHERE existing_link.media_item_id = p_media_item_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.media_tags AS desired_tag
      WHERE desired_tag.user_id = v_user_id
        AND desired_tag.name = ANY(v_tag_names)
        AND desired_tag.id = existing_link.tag_id
    );

  INSERT INTO public.media_item_tags (media_item_id, tag_id)
  SELECT p_media_item_id, desired_tag.id
  FROM public.media_tags AS desired_tag
  WHERE desired_tag.user_id = v_user_id
    AND desired_tag.name = ANY(v_tag_names)
  ON CONFLICT (media_item_id, tag_id) DO NOTHING;

  DELETE FROM public.media_collection_items AS existing_membership
  WHERE existing_membership.media_item_id = p_media_item_id
    AND NOT (existing_membership.collection_id = ANY(v_collection_ids));

  INSERT INTO public.media_collection_items (collection_id, media_item_id, sort_order)
  SELECT
    requested_collection_id,
    p_media_item_id,
    COALESCE((
      SELECT max(existing_order.sort_order) + 1
      FROM public.media_collection_items AS existing_order
      WHERE existing_order.collection_id = requested_collection_id
    ), 0)
  FROM unnest(v_collection_ids) AS requested_collection_id
  ON CONFLICT (collection_id, media_item_id) DO NOTHING;

  v_canonical := public.media_item_canonical_payload(p_media_item_id, v_user_id);

  RETURN jsonb_build_object(
    'status', 'success',
    'media_item', v_canonical
  );
EXCEPTION
  WHEN check_violation OR not_null_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'The media edit failed validation and no changes were saved.',
      'error_code', SQLSTATE
    );
  WHEN serialization_failure OR deadlock_detected THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'message', 'The media edit conflicted with another transaction. Refresh and retry.',
      'error_code', SQLSTATE
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'status', 'unexpected_failure',
      'message', 'The media edit could not be completed. No changes were saved.',
      'error_code', SQLSTATE
    );
END;
$$;

REVOKE ALL ON FUNCTION public.save_media_item_atomic(uuid, bigint, jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_media_item_atomic(uuid, bigint, jsonb, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_media_item_atomic(uuid, bigint, jsonb, jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.reorder_media_collection_atomic(
  p_collection_id uuid,
  p_ordered_media_ids jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_ordered_ids uuid[] := ARRAY[]::uuid[];
  v_current_count integer;
  v_owned_count integer;
  v_canonical_order jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'authorization_failure',
      'message', 'Authentication is required to reorder a collection.'
    );
  END IF;

  IF p_ordered_media_ids IS NULL OR jsonb_typeof(p_ordered_media_ids) <> 'array' THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Collection order must be supplied as an array.'
    );
  END IF;

  PERFORM 1
  FROM public.media_collections
  WHERE id = p_collection_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'authorization_failure',
      'message', 'The collection is unavailable or is not owned by the current user.'
    );
  END IF;

  BEGIN
    SELECT COALESCE(array_agg(media_id ORDER BY ordinal_position), ARRAY[]::uuid[])
    INTO v_ordered_ids
    FROM (
      SELECT (entry.value #>> '{}')::uuid AS media_id, entry.ordinality AS ordinal_position
      FROM jsonb_array_elements(p_ordered_media_ids) WITH ORDINALITY AS entry(value, ordinality)
      WHERE jsonb_typeof(entry.value) = 'string'
    ) AS parsed_order;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN jsonb_build_object(
        'status', 'validation_failure',
        'message', 'One or more media identifiers are invalid.'
      );
  END;

  IF jsonb_array_length(p_ordered_media_ids) <> COALESCE(array_length(v_ordered_ids, 1), 0) THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Every collection entry must be a media UUID string.'
    );
  END IF;

  IF COALESCE(array_length(v_ordered_ids, 1), 0) <> (
    SELECT count(DISTINCT requested.media_id)
    FROM unnest(v_ordered_ids) AS requested(media_id)
  ) THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Collection order cannot contain duplicate media items.'
    );
  END IF;

  SELECT count(*)
  INTO v_current_count
  FROM public.media_collection_items
  WHERE collection_id = p_collection_id;

  IF v_current_count <> COALESCE(array_length(v_ordered_ids, 1), 0) THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Collection order must include every current item exactly once.'
    );
  END IF;

  SELECT count(*)
  INTO v_owned_count
  FROM public.media_collection_items AS membership
  JOIN public.media_items AS media_row
    ON media_row.id = membership.media_item_id
   AND media_row.user_id = v_user_id
  WHERE membership.collection_id = p_collection_id
    AND membership.media_item_id = ANY(v_ordered_ids);

  IF v_owned_count <> v_current_count THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Collection order contains a missing, foreign, or invalid media item.'
    );
  END IF;

  UPDATE public.media_collection_items AS membership
  SET sort_order = desired.ordinal_position - 1
  FROM (
    SELECT (entry.value #>> '{}')::uuid AS media_id, entry.ordinality::integer AS ordinal_position
    FROM jsonb_array_elements(p_ordered_media_ids) WITH ORDINALITY AS entry(value, ordinality)
  ) AS desired
  WHERE membership.collection_id = p_collection_id
    AND membership.media_item_id = desired.media_id;

  SELECT COALESCE(jsonb_agg(membership.media_item_id ORDER BY membership.sort_order, membership.media_item_id), '[]'::jsonb)
  INTO v_canonical_order
  FROM public.media_collection_items AS membership
  WHERE membership.collection_id = p_collection_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'ordered_media_ids', v_canonical_order
  );
EXCEPTION
  WHEN check_violation OR not_null_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'The collection order was rejected and the previous order was preserved.',
      'error_code', SQLSTATE
    );
  WHEN serialization_failure OR deadlock_detected THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'message', 'The collection changed while it was being reordered. Refresh and retry.',
      'error_code', SQLSTATE
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'status', 'unexpected_failure',
      'message', 'The collection could not be reordered. The previous order was preserved.',
      'error_code', SQLSTATE
    );
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_media_collection_atomic(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reorder_media_collection_atomic(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.reorder_media_collection_atomic(uuid, jsonb) TO authenticated;
