-- Show Manager cloud persistence (Canvas + LaserDMX; PixGrid payload persistence is intentionally deferred).
-- Supabase is the canonical authored-Show store. Client IndexedDB remains a cache/recovery layer.

CREATE TABLE IF NOT EXISTS public.shows (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  linked_audio_track_id uuid NOT NULL REFERENCES public.audio_tracks(id) ON DELETE RESTRICT,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  group_id uuid NULL REFERENCES public.media_collections(id) ON DELETE SET NULL,
  engine_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  track_map jsonb NULL,
  schema_version integer NOT NULL DEFAULT 2,
  revision bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shows_id_check CHECK (length(btrim(id)) BETWEEN 1 AND 200),
  CONSTRAINT shows_name_check CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  CONSTRAINT shows_schema_version_check CHECK (schema_version > 0),
  CONSTRAINT shows_revision_check CHECK (revision > 0),
  CONSTRAINT shows_track_map_check CHECK (track_map IS NULL OR jsonb_typeof(track_map) = 'object'),
  CONSTRAINT shows_engine_ids_check CHECK (
    engine_ids <@ ARRAY['pixGrid', 'laserDmx', 'canvas']::text[]
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shows_user_name_ci
  ON public.shows(user_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_shows_user_updated
  ON public.shows(user_id, updated_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_shows_linked_audio
  ON public.shows(linked_audio_track_id);
CREATE INDEX IF NOT EXISTS idx_shows_group
  ON public.shows(group_id) WHERE group_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_shows_updated_at ON public.shows;
CREATE TRIGGER trg_shows_updated_at
  BEFORE UPDATE ON public.shows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.show_engine_configs (
  show_id text NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  engine_id text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (show_id, engine_id),
  CONSTRAINT show_engine_configs_engine_check CHECK (engine_id IN ('canvas', 'laserDmx')),
  CONSTRAINT show_engine_configs_schema_version_check CHECK (schema_version > 0),
  CONSTRAINT show_engine_configs_revision_check CHECK (revision > 0),
  CONSTRAINT show_engine_configs_payload_check CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_show_engine_configs_engine
  ON public.show_engine_configs(engine_id, show_id);

DROP TRIGGER IF EXISTS trg_show_engine_configs_updated_at ON public.show_engine_configs;
CREATE TRIGGER trg_show_engine_configs_updated_at
  BEFORE UPDATE ON public.show_engine_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Canvas media IDs live inside the versioned JSON payload. Keep a relational
-- dependency index beside that payload so database/storage deletion cannot
-- silently break a cloud-authored Show.
CREATE TABLE IF NOT EXISTS public.show_media_refs (
  show_id text NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  media_item_id uuid NOT NULL REFERENCES public.media_items(id) ON DELETE RESTRICT,
  engine_id text NOT NULL DEFAULT 'canvas',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (show_id, media_item_id, engine_id),
  CONSTRAINT show_media_refs_engine_check CHECK (engine_id = 'canvas')
);

CREATE INDEX IF NOT EXISTS idx_show_media_refs_media
  ON public.show_media_refs(media_item_id, show_id);

ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.show_engine_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.show_media_refs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shows: own select" ON public.shows;
CREATE POLICY "shows: own select"
  ON public.shows FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "shows: own insert" ON public.shows;
CREATE POLICY "shows: own insert"
  ON public.shows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "shows: own update" ON public.shows;
CREATE POLICY "shows: own update"
  ON public.shows FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "shows: own delete" ON public.shows;
CREATE POLICY "shows: own delete"
  ON public.shows FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "show_engine_configs: own select" ON public.show_engine_configs;
CREATE POLICY "show_engine_configs: own select"
  ON public.show_engine_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.shows AS owned_show
      WHERE owned_show.id = show_engine_configs.show_id
        AND owned_show.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "show_engine_configs: own insert" ON public.show_engine_configs;
CREATE POLICY "show_engine_configs: own insert"
  ON public.show_engine_configs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.shows AS owned_show
      WHERE owned_show.id = show_engine_configs.show_id
        AND owned_show.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "show_engine_configs: own update" ON public.show_engine_configs;
CREATE POLICY "show_engine_configs: own update"
  ON public.show_engine_configs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.shows AS owned_show
      WHERE owned_show.id = show_engine_configs.show_id
        AND owned_show.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.shows AS owned_show
      WHERE owned_show.id = show_engine_configs.show_id
        AND owned_show.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "show_engine_configs: own delete" ON public.show_engine_configs;
CREATE POLICY "show_engine_configs: own delete"
  ON public.show_engine_configs FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.shows AS owned_show
      WHERE owned_show.id = show_engine_configs.show_id
        AND owned_show.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "show_media_refs: own select" ON public.show_media_refs;
CREATE POLICY "show_media_refs: own select"
  ON public.show_media_refs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.shows AS owned_show
      WHERE owned_show.id = show_media_refs.show_id
        AND owned_show.user_id = auth.uid()
    )
  );

-- The RPC is the only supported authored-Show write path. Direct SELECT remains
-- available for efficient Show Browser hydration, while direct mutations are revoked.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.shows FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.show_engine_configs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.show_media_refs FROM anon, authenticated;
GRANT SELECT ON TABLE public.shows TO authenticated;
GRANT SELECT ON TABLE public.show_engine_configs TO authenticated;
GRANT SELECT ON TABLE public.show_media_refs TO authenticated;

CREATE OR REPLACE FUNCTION public.save_show_bundle(
  p_show_id text,
  p_expected_revision bigint,
  p_show jsonb,
  p_engine_configs jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing public.shows%ROWTYPE;
  v_saved public.shows%ROWTYPE;
  v_name text;
  v_audio_track_id uuid;
  v_group_id uuid;
  v_tags text[] := ARRAY[]::text[];
  v_engine_ids text[] := ARRAY[]::text[];
  v_track_map jsonb;
  v_schema_version integer;
  v_next_revision bigint;
  v_config jsonb;
  v_engine_id text;
  v_engine_schema_version integer;
  v_engine_payload jsonb;
  v_media_element jsonb;
  v_media_id uuid;
  v_configs jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'Authentication is required to save Shows.');
  END IF;

  IF p_show_id IS NULL OR length(btrim(p_show_id)) NOT BETWEEN 1 AND 200 THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'A valid Show identifier is required.');
  END IF;

  IF p_show IS NULL OR jsonb_typeof(p_show) <> 'object' THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Show data must be supplied as an object.');
  END IF;

  IF p_engine_configs IS NULL OR jsonb_typeof(p_engine_configs) <> 'array' THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Engine configurations must be supplied as an array.');
  END IF;

  v_name := btrim(COALESCE(p_show->>'name', ''));
  IF length(v_name) NOT BETWEEN 1 AND 160 THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Show name is required and must be 160 characters or fewer.');
  END IF;

  BEGIN
    v_audio_track_id := NULLIF(p_show->>'linked_audio_track_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The linked audio track identifier is invalid.');
  END;
  IF v_audio_track_id IS NULL THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The linked audio track is unavailable or is not owned by the current user.');
  END IF;
  PERFORM 1
  FROM public.audio_tracks AS track
  WHERE track.id = v_audio_track_id
    AND track.user_id = v_user_id
    AND track.lifecycle_status = 'complete'
  FOR SHARE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The linked audio track is unavailable or is not owned by the current user.');
  END IF;

  IF p_show ? 'group_id' AND p_show->'group_id' <> 'null'::jsonb AND NULLIF(p_show->>'group_id', '') IS NOT NULL THEN
    BEGIN
      v_group_id := (p_show->>'group_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The Show group identifier is invalid.');
    END;
    IF NOT EXISTS (
      SELECT 1 FROM public.media_collections AS collection
      WHERE collection.id = v_group_id
        AND collection.user_id = v_user_id
    ) THEN
      RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The selected Show group is unavailable or is not owned by the current user.');
    END IF;
  ELSE
    v_group_id := NULL;
  END IF;

  IF NOT (p_show ? 'tags') OR jsonb_typeof(p_show->'tags') <> 'array' THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Show tags must be supplied as an array.');
  END IF;
  IF jsonb_array_length(p_show->'tags') > 64 OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_show->'tags') AS tag_value
    WHERE jsonb_typeof(tag_value) <> 'string'
       OR length(btrim(tag_value #>> '{}')) NOT BETWEEN 1 AND 100
  ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Show tags must contain at most 64 non-empty values of 100 characters or fewer.');
  END IF;
  SELECT COALESCE(array_agg(tag ORDER BY first_ordinality), ARRAY[]::text[])
  INTO v_tags
  FROM (
    SELECT btrim(tag_value #>> '{}') AS tag, min(ordinality) AS first_ordinality
    FROM jsonb_array_elements(p_show->'tags') WITH ORDINALITY AS tag_entry(tag_value, ordinality)
    GROUP BY btrim(tag_value #>> '{}')
  ) AS normalized_tags;

  IF NOT (p_show ? 'engine_ids') OR jsonb_typeof(p_show->'engine_ids') <> 'array' THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Show engine IDs must be supplied as an array.');
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_show->'engine_ids') AS engine_value
    WHERE jsonb_typeof(engine_value) <> 'string'
       OR (engine_value #>> '{}') NOT IN ('pixGrid', 'laserDmx', 'canvas')
  ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The Show contains an unsupported engine identifier.');
  END IF;
  SELECT COALESCE(array_agg(engine_id ORDER BY first_ordinality), ARRAY[]::text[])
  INTO v_engine_ids
  FROM (
    SELECT engine_value #>> '{}' AS engine_id, min(ordinality) AS first_ordinality
    FROM jsonb_array_elements(p_show->'engine_ids') WITH ORDINALITY AS engine_entry(engine_value, ordinality)
    GROUP BY engine_value #>> '{}'
  ) AS normalized_engines;

  v_track_map := p_show->'track_map';
  IF v_track_map = 'null'::jsonb THEN v_track_map := NULL; END IF;
  IF v_track_map IS NOT NULL THEN
    IF jsonb_typeof(v_track_map) <> 'object' THEN
      RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The Show Track Map must be an object or null.');
    END IF;
    IF COALESCE(v_track_map->>'linkedAudioTrackId', '') <> v_audio_track_id::text THEN
      RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The Show Track Map is bound to a different audio track.');
    END IF;
    IF jsonb_typeof(v_track_map->'sections') IS DISTINCT FROM 'array' OR jsonb_array_length(v_track_map->'sections') = 0 THEN
      RETURN jsonb_build_object('status', 'validation_failure', 'message', 'A persisted Show Track Map must contain sections.');
    END IF;
  END IF;

  BEGIN
    v_schema_version := COALESCE((p_show->>'schema_version')::integer, 2);
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The Show schema version is invalid.');
  END;
  IF v_schema_version <= 0 THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The Show schema version must be positive.');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_engine_configs) AS config
    WHERE jsonb_typeof(config) <> 'object'
       OR config->>'engine_id' NOT IN ('canvas', 'laserDmx')
       OR jsonb_typeof(config->'payload') <> 'object'
       OR COALESCE(config->'payload'->>'id', '') <> p_show_id
  ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'One or more engine configurations are invalid or belong to another Show.');
  END IF;

  IF EXISTS (
    SELECT engine_id
    FROM (
      SELECT config->>'engine_id' AS engine_id, count(*) AS count
      FROM jsonb_array_elements(p_engine_configs) AS config
      GROUP BY config->>'engine_id'
    ) AS counts
    WHERE counts.count > 1
  ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Each Show engine may have only one configuration payload.');
  END IF;

  IF ('canvas' = ANY(v_engine_ids)) <> EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_engine_configs) AS config WHERE config->>'engine_id' = 'canvas'
  ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The Canvas engine selection and Canvas payload do not match.');
  END IF;
  IF ('laserDmx' = ANY(v_engine_ids)) <> EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_engine_configs) AS config WHERE config->>'engine_id' = 'laserDmx'
  ) THEN
    RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The LaserDMX engine selection and LaserDMX payload do not match.');
  END IF;

  -- Complete every validation that can return a structured failure before the
  -- first mutation. Once writes begin, any unexpected database error is allowed
  -- to raise so PostgreSQL rolls the entire RPC back atomically.
  FOR v_config IN SELECT value FROM jsonb_array_elements(p_engine_configs)
  LOOP
    v_engine_id := v_config->>'engine_id';
    v_engine_payload := v_config->'payload';
    BEGIN
      v_engine_schema_version := COALESCE((v_config->>'schema_version')::integer, 1);
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RETURN jsonb_build_object('status', 'validation_failure', 'message', 'An engine schema version is invalid.');
    END;
    IF v_engine_schema_version <= 0 THEN
      RETURN jsonb_build_object('status', 'validation_failure', 'message', 'Engine schema versions must be positive.');
    END IF;

    IF v_engine_id = 'canvas' THEN
      IF jsonb_typeof(v_engine_payload->'mediaElements') IS DISTINCT FROM 'array' THEN
        RETURN jsonb_build_object('status', 'validation_failure', 'message', 'The Canvas payload must contain a mediaElements array.');
      END IF;

      FOR v_media_element IN SELECT value FROM jsonb_array_elements(v_engine_payload->'mediaElements')
      LOOP
        IF jsonb_typeof(v_media_element) <> 'object' OR NULLIF(v_media_element->>'mediaId', '') IS NULL THEN
          RETURN jsonb_build_object('status', 'validation_failure', 'message', 'A Canvas media element has an invalid media reference.');
        END IF;
        BEGIN
          v_media_id := (v_media_element->>'mediaId')::uuid;
        EXCEPTION WHEN invalid_text_representation THEN
          RETURN jsonb_build_object('status', 'validation_failure', 'message', 'A Canvas media element references an invalid media identifier.');
        END;
        PERFORM 1
        FROM public.media_items AS media
        WHERE media.id = v_media_id
          AND media.user_id = v_user_id
          AND media.lifecycle_status = 'complete'
        FOR SHARE;
        IF NOT FOUND THEN
          RETURN jsonb_build_object('status', 'validation_failure', 'message', 'A Canvas media element references media that is unavailable or is not owned by the current user.');
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  SELECT * INTO v_existing
  FROM public.shows
  WHERE id = p_show_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.user_id IS DISTINCT FROM v_user_id THEN
      RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The Show is unavailable or is not owned by the current user.');
    END IF;
    IF p_expected_revision IS NULL THEN
      RETURN jsonb_build_object(
        'status', 'conflict',
        'message', 'This Show already exists. Reload the Show library before saving.',
        'current_revision', v_existing.revision
      );
    END IF;
    IF v_existing.revision <> p_expected_revision THEN
      RETURN jsonb_build_object(
        'status', 'conflict',
        'message', 'This Show changed in another session. Reload it before reapplying your changes.',
        'current_revision', v_existing.revision
      );
    END IF;
    v_next_revision := v_existing.revision + 1;

    BEGIN
      UPDATE public.shows
      SET name = v_name,
          linked_audio_track_id = v_audio_track_id,
          tags = v_tags,
          group_id = v_group_id,
          engine_ids = v_engine_ids,
          track_map = v_track_map,
          schema_version = v_schema_version,
          revision = v_next_revision
      WHERE id = p_show_id
        AND user_id = v_user_id
      RETURNING * INTO v_saved;
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object('status', 'validation_failure', 'message', 'A Show with that name already exists.');
    END;
  ELSE
    IF p_expected_revision IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'conflict', 'message', 'The Show no longer exists in Supabase. Reload the Show library.');
    END IF;
    v_next_revision := 1;

    BEGIN
      INSERT INTO public.shows (
        id, user_id, name, linked_audio_track_id, tags, group_id,
        engine_ids, track_map, schema_version, revision
      ) VALUES (
        p_show_id, v_user_id, v_name, v_audio_track_id, v_tags, v_group_id,
        v_engine_ids, v_track_map, v_schema_version, v_next_revision
      )
      RETURNING * INTO v_saved;
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object('status', 'validation_failure', 'message', 'A Show with that name already exists.');
    END;
  END IF;

  DELETE FROM public.show_engine_configs AS existing_config
  WHERE existing_config.show_id = p_show_id
    AND existing_config.engine_id IN ('canvas', 'laserDmx')
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_engine_configs) AS desired_config
      WHERE desired_config->>'engine_id' = existing_config.engine_id
    );

  FOR v_config IN SELECT value FROM jsonb_array_elements(p_engine_configs)
  LOOP
    v_engine_id := v_config->>'engine_id';
    v_engine_payload := v_config->'payload';
    v_engine_schema_version := COALESCE((v_config->>'schema_version')::integer, 1);

    INSERT INTO public.show_engine_configs (
      show_id, engine_id, schema_version, payload, revision
    ) VALUES (
      p_show_id, v_engine_id, v_engine_schema_version, v_engine_payload, v_next_revision
    )
    ON CONFLICT (show_id, engine_id) DO UPDATE
      SET schema_version = EXCLUDED.schema_version,
          payload = EXCLUDED.payload,
          revision = EXCLUDED.revision;
  END LOOP;

  DELETE FROM public.show_media_refs
  WHERE show_id = p_show_id;

  FOR v_config IN
    SELECT value
    FROM jsonb_array_elements(p_engine_configs)
    WHERE value->>'engine_id' = 'canvas'
  LOOP
    FOR v_media_element IN SELECT value FROM jsonb_array_elements(v_config->'payload'->'mediaElements')
    LOOP
      v_media_id := (v_media_element->>'mediaId')::uuid;
      INSERT INTO public.show_media_refs (show_id, media_item_id, engine_id)
      VALUES (p_show_id, v_media_id, 'canvas')
      ON CONFLICT (show_id, media_item_id, engine_id) DO NOTHING;
    END LOOP;
  END LOOP;

  SELECT COALESCE(jsonb_agg(to_jsonb(config_row) ORDER BY config_row.engine_id), '[]'::jsonb)
  INTO v_configs
  FROM public.show_engine_configs AS config_row
  WHERE config_row.show_id = p_show_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'show', to_jsonb(v_saved),
    'engine_configs', v_configs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_show_bundle(text, bigint, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_show_bundle(text, bigint, jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_show(p_show_id text, p_expected_revision bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing public.shows%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'Authentication is required to delete Shows.');
  END IF;

  SELECT * INTO v_existing
  FROM public.shows
  WHERE id = p_show_id
  FOR UPDATE;

  IF NOT FOUND OR v_existing.user_id IS DISTINCT FROM v_user_id THEN
    RETURN jsonb_build_object('status', 'authorization_failure', 'message', 'The Show is unavailable or is not owned by the current user.');
  END IF;
  IF p_expected_revision IS NULL OR v_existing.revision <> p_expected_revision THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'message', 'This Show changed in another session. Reload the Show library before deleting it.',
      'current_revision', v_existing.revision
    );
  END IF;

  DELETE FROM public.shows
  WHERE id = p_show_id
    AND user_id = v_user_id;

  RETURN jsonb_build_object('status', 'success', 'show_id', p_show_id);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_show(text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_show(text, bigint) TO authenticated;

-- Prevent the existing audio cleanup workflow from starting while any persisted
-- Show references the track. This avoids deleting Storage bytes first and only
-- discovering the ON DELETE RESTRICT relationship during finalization.
CREATE OR REPLACE FUNCTION public.assert_audio_track_not_used_by_show()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.lifecycle_status = 'complete'
     AND NEW.lifecycle_status = 'deletion_pending'
     AND EXISTS (SELECT 1 FROM public.shows AS show_row WHERE show_row.linked_audio_track_id = OLD.id) THEN
    RAISE EXCEPTION 'Audio track is linked to one or more Shows and cannot be deleted.'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audio_tracks_show_delete_guard ON public.audio_tracks;
CREATE TRIGGER trg_audio_tracks_show_delete_guard
  BEFORE UPDATE OF lifecycle_status ON public.audio_tracks
  FOR EACH ROW EXECUTE FUNCTION public.assert_audio_track_not_used_by_show();

-- Match the audio deletion guarantee for Canvas media. request_media_deletion()
-- starts by moving the row to deletion_pending before any Storage cleanup; this
-- trigger blocks that transition while a persisted Show still references it.
CREATE OR REPLACE FUNCTION public.assert_media_item_not_used_by_show()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.lifecycle_status = 'complete'
     AND NEW.lifecycle_status = 'deletion_pending'
     AND EXISTS (SELECT 1 FROM public.show_media_refs AS media_ref WHERE media_ref.media_item_id = OLD.id) THEN
    RAISE EXCEPTION 'Media item is linked to one or more Shows and cannot be deleted.'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_items_show_delete_guard ON public.media_items;
CREATE TRIGGER trg_media_items_show_delete_guard
  BEFORE UPDATE OF lifecycle_status ON public.media_items
  FOR EACH ROW EXECUTE FUNCTION public.assert_media_item_not_used_by_show();
