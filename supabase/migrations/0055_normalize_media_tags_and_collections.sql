-- Tags and collection names get one canonical form, enforced in the database.
--
-- Tags: a tag is stored as a lowercase key made of letters, digits and underscores, with any other run of characters
-- (spaces included) turned into one hyphen and no leading or trailing hyphen: "Open Decks" and "OPEN  DECKS!" both
-- become "open-decks". The interface shows tags in capitals; the stored form is the key, so two tags can never differ
-- only by case or spacing. This follows the usual practice for tags (Stack Overflow, for one, uses lowercase,
-- hyphen-separated tags with no spaces).
--
-- Collections: the name is kept as typed (it is a display name), with runs of whitespace collapsed to one space, and is
-- unique per user ignoring case.
--
-- Existing rows are fixed first. Tags that become identical are merged (their media, model and font links move to
-- one survivor). Collections that would collide are NOT merged automatically: collection links also live inside
-- saved shows, so the migration stops with a clear message instead of guessing.
begin;

create function public.normalize_media_tag(p_name text) returns text
language sql immutable strict parallel safe set search_path = '' as $$
  select btrim(regexp_replace(lower(normalize(btrim(p_name), NFC)), '[^[:alnum:]_]+', '-', 'g'), '-')
$$;

-- A tag list in canonical form: each tag normalised, empty ones dropped, repeats removed, first-seen order kept.
create function public.normalize_media_tag_list(p_tags text[]) returns text[]
language sql immutable parallel safe set search_path = '' as $$
  select coalesce(array_agg(n order by first_position), array[]::text[])
  from (
    select n, min(position) as first_position
    from (select public.normalize_media_tag(t) as n, position from unnest(p_tags) with ordinality as u(t, position)) as normalized
    where n is not null and n <> ''
    group by n
  ) as distinct_tags
$$;

create function public.normalize_media_collection_name(p_name text) returns text
language sql immutable strict parallel safe set search_path = '' as $$
  select btrim(regexp_replace(btrim(p_name), '\s+', ' ', 'g'))
$$;

-- ── Fix the rows that exist now ─────────────────────────────────────────────

create temporary table media_tag_map on commit drop as
select t.id, public.normalize_media_tag(t.name) as canon,
  first_value(t.id) over (
    partition by t.user_id, public.normalize_media_tag(t.name)
    order by (t.name = public.normalize_media_tag(t.name)) desc, t.created_at, t.id
  ) as keep_id
from public.media_tags t;

-- A tag with nothing left once normalised is removed (its links go with it).
delete from public.media_tags where id in (select id from media_tag_map where canon = '');

-- Tags that become identical: move their links to the survivor, then remove the repeats.
insert into public.media_item_tags (media_item_id, tag_id)
select distinct l.media_item_id, m.keep_id
from public.media_item_tags l join media_tag_map m on m.id = l.tag_id
where m.id <> m.keep_id and m.canon <> ''
on conflict do nothing;

insert into public.model_asset_tags (model_asset_id, tag_id)
select distinct l.model_asset_id, m.keep_id
from public.model_asset_tags l join media_tag_map m on m.id = l.tag_id
where m.id <> m.keep_id and m.canon <> ''
on conflict do nothing;

delete from public.media_tags where id in (select id from media_tag_map where id <> keep_id and canon <> '');

update public.media_tags t set name = m.canon
from media_tag_map m
where m.id = t.id and m.canon <> '' and t.name <> m.canon;

update public.font_assets
set tags = public.normalize_media_tag_list(tags)
where tags is distinct from public.normalize_media_tag_list(tags);

-- Collections: tidy the whitespace, and stop if two collections would collide ignoring case.
do $$
declare clash text;
begin
  select string_agg(distinct '"' || name || '"', ', ') into clash
  from public.media_collections c
  where public.normalize_media_collection_name(c.name) = ''
     or exists (
       select 1 from public.media_collections o
       where o.user_id = c.user_id and o.id <> c.id
         and lower(public.normalize_media_collection_name(o.name)) = lower(public.normalize_media_collection_name(c.name))
     );
  if clash is not null then
    raise exception 'Collections with an empty name or a name that matches another collection ignoring case and spacing: %. Rename or merge them, then run this migration again.', clash
      using errcode = '23505';
  end if;
end $$;

update public.media_collections
set name = public.normalize_media_collection_name(name)
where name <> public.normalize_media_collection_name(name);

-- ── Enforce it from now on ──────────────────────────────────────────────────

create function public.media_tags_normalize() returns trigger language plpgsql set search_path = '' as $$
begin
  new.name := public.normalize_media_tag(new.name);
  if new.name is null or new.name = '' then
    raise exception 'A tag needs at least one letter or digit' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger media_tags_normalize before insert or update of name on public.media_tags
  for each row execute function public.media_tags_normalize();

create function public.font_assets_normalize_tags() returns trigger language plpgsql set search_path = '' as $$
begin
  new.tags := public.normalize_media_tag_list(new.tags);
  return new;
end $$;
create trigger font_assets_normalize_tags before insert or update of tags on public.font_assets
  for each row execute function public.font_assets_normalize_tags();

create function public.media_collections_normalize() returns trigger language plpgsql set search_path = '' as $$
begin
  new.name := public.normalize_media_collection_name(new.name);
  if new.name is null or new.name = '' then
    raise exception 'A collection needs a name' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger media_collections_normalize before insert or update of name on public.media_collections
  for each row execute function public.media_collections_normalize();

create unique index media_collections_user_lower_name_key
  on public.media_collections (user_id, lower(name));

revoke all on function public.media_tags_normalize() from public, anon, authenticated;
revoke all on function public.font_assets_normalize_tags() from public, anon, authenticated;
revoke all on function public.media_collections_normalize() from public, anon, authenticated;

-- ── The functions that write tags now normalise them before comparing ──────

CREATE OR REPLACE FUNCTION public.save_media_item_atomic(p_media_item_id uuid, p_expected_revision bigint, p_patch jsonb, p_tag_names jsonb, p_collection_ids jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
       OR nullif(public.normalize_media_tag(tag_value #>> '{}'), '') IS NULL
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
    SELECT DISTINCT public.normalize_media_tag(tag_value #>> '{}') AS tag_name
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
$function$;

CREATE OR REPLACE FUNCTION public.finalize_media_upload_atomic(p_operation_id uuid, p_media jsonb, p_tag_names jsonb, p_collection_ids jsonb, p_derivative_paths jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
       OR nullif(public.normalize_media_tag(tag_value #>> '{}'), '') IS NULL
       OR length(btrim(tag_value #>> '{}')) > 100
  ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Every tag must be non-empty text no longer than 100 characters.');
  END IF;

  SELECT COALESCE(array_agg(tag_name ORDER BY lower(tag_name), tag_name), ARRAY[]::text[])
  INTO v_tag_names
  FROM (
    SELECT DISTINCT public.normalize_media_tag(tag_value #>> '{}') AS tag_name
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
$function$;

CREATE OR REPLACE FUNCTION public.update_model_metadata(p_model_id uuid, p_expected_version integer, p_name text, p_description text, p_favorite boolean, p_tags text[], p_collection_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.model_assets; tag_name text; tag_uuid uuid; organization jsonb;
begin
  a := public.model_lock_owned(p_model_id);
  if a.status = 'deletion_pending' then raise exception 'Model deletion is pending' using errcode = '23514'; end if;
  if p_expected_version is null or a.current_version <> p_expected_version then raise exception 'Model version conflict' using errcode = '40001'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 200 or p_favorite is null
    or (p_description is not null and length(p_description) > 4000)
    or p_tags is null or cardinality(p_tags) > 32 or p_collection_ids is null or cardinality(p_collection_ids) > 100
    or exists(select 1 from unnest(p_tags) t where t is null or length(btrim(t)) not between 1 and 64 or public.normalize_media_tag(t) = '')
    or exists(select 1 from unnest(p_collection_ids) c where c is null or not exists(select 1 from public.media_collections m where m.id = c and m.user_id = auth.uid()))
  then raise exception 'Invalid model metadata or foreign collection' using errcode = '23514'; end if;
  perform 1 from public.media_collections where id = any(p_collection_ids) order by id for update;
  update public.model_assets set name = btrim(p_name), description = nullif(p_description, ''), favorite = p_favorite where id = a.id returning * into a;
  delete from public.model_collection_items where model_asset_id = a.id;
  insert into public.model_collection_items(collection_id, model_asset_id) select distinct c, a.id from unnest(p_collection_ids) c;
  delete from public.model_asset_tags where model_asset_id = a.id;
  for tag_name in select distinct public.normalize_media_tag(t) from unnest(p_tags) t order by 1 loop
    insert into public.media_tags(user_id, name) values(auth.uid(), tag_name) on conflict(user_id, name) do nothing;
    select id into tag_uuid from public.media_tags where user_id = auth.uid() and name = tag_name;
    insert into public.model_asset_tags(model_asset_id, tag_id) values(a.id, tag_uuid);
  end loop;
  organization := public.get_model_organization(a.id);
  return jsonb_build_object('asset', to_jsonb(a), 'organization', organization);
end $function$;

commit;
