-- Harden lyric persistence with verified relationships, single-active-version
-- enforcement, optimistic concurrency, and transactional RPCs.

ALTER TABLE public.lyric_documents
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.lyric_documents.revision IS
  'Monotonic optimistic-concurrency token. Incremented by the lyric document update trigger.';

CREATE OR REPLACE FUNCTION public.update_lyric_document_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  NEW.revision := OLD.revision + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_lyric_documents ON public.lyric_documents;
CREATE TRIGGER set_updated_at_lyric_documents
  BEFORE UPDATE ON public.lyric_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_lyric_document_revision();

-- Preserve legacy documents while removing references that cannot be backed by
-- the current schema. Cues remain attached to their documents.
UPDATE public.lyric_documents AS d
SET audio_track_id = NULL
WHERE d.audio_track_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.audio_tracks AS t
    WHERE t.id = d.audio_track_id
      AND t.user_id = d.user_id
  );

UPDATE public.lyric_documents AS d
SET visual_session_id = NULL
WHERE d.visual_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.visual_sessions AS s
    WHERE s.id = d.visual_session_id
      AND s.user_id = d.user_id
  );

ALTER TABLE public.lyric_documents
  DROP CONSTRAINT IF EXISTS lyric_documents_audio_track_id_fkey;
ALTER TABLE public.lyric_documents
  ADD CONSTRAINT lyric_documents_audio_track_id_fkey
  FOREIGN KEY (audio_track_id)
  REFERENCES public.audio_tracks(id)
  ON DELETE CASCADE;

ALTER TABLE public.lyric_documents
  DROP CONSTRAINT IF EXISTS lyric_documents_visual_session_id_fkey;
ALTER TABLE public.lyric_documents
  ADD CONSTRAINT lyric_documents_visual_session_id_fkey
  FOREIGN KEY (visual_session_id)
  REFERENCES public.visual_sessions(id)
  ON DELETE SET NULL;

ALTER TABLE public.lyric_cues
  DROP CONSTRAINT IF EXISTS lyric_cues_lyric_document_id_fkey;
ALTER TABLE public.lyric_cues
  ADD CONSTRAINT lyric_cues_lyric_document_id_fkey
  FOREIGN KEY (lyric_document_id)
  REFERENCES public.lyric_documents(id)
  ON DELETE CASCADE;

-- Existing databases may already contain multiple active versions. Keep the
-- most recently updated row active before installing the uniqueness guard.
WITH ranked_active_documents AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, audio_track_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS active_rank
  FROM public.lyric_documents
  WHERE is_active = true
    AND audio_track_id IS NOT NULL
)
UPDATE public.lyric_documents AS d
SET is_active = false
FROM ranked_active_documents AS ranked
WHERE d.id = ranked.id
  AND ranked.active_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lyric_documents_one_active_per_track
  ON public.lyric_documents(user_id, audio_track_id)
  WHERE is_active = true AND audio_track_id IS NOT NULL;

-- A document can only reference tracks and visual sessions owned by the same
-- authenticated user. These checks also protect direct table writes outside RPCs.
DROP POLICY IF EXISTS "Users can insert their own lyric documents"
  ON public.lyric_documents;
CREATE POLICY "Users can insert their own lyric documents"
  ON public.lyric_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      audio_track_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.audio_tracks AS track
        WHERE track.id = audio_track_id
          AND track.user_id = auth.uid()
      )
    )
    AND (
      visual_session_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.visual_sessions AS session
        WHERE session.id = visual_session_id
          AND session.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update their own lyric documents"
  ON public.lyric_documents;
CREATE POLICY "Users can update their own lyric documents"
  ON public.lyric_documents FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      audio_track_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.audio_tracks AS track
        WHERE track.id = audio_track_id
          AND track.user_id = auth.uid()
      )
    )
    AND (
      visual_session_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.visual_sessions AS session
        WHERE session.id = visual_session_id
          AND session.user_id = auth.uid()
      )
    )
  );

CREATE OR REPLACE FUNCTION public.activate_lyric_document(
  p_document_id uuid,
  p_expected_revision bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_document public.lyric_documents%ROWTYPE;
  v_locked_audio_track_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'authorization_failure',
      'message', 'Authentication is required to activate a lyric document.'
    );
  END IF;

  -- Read the target first, then lock the shared parent before locking any
  -- lyric-document row. Every activation/save for one track uses this order,
  -- avoiding sibling-document deadlocks while serializing active-version changes.
  SELECT *
  INTO v_document
  FROM public.lyric_documents
  WHERE id = p_document_id;

  IF NOT FOUND OR v_document.user_id <> v_user_id THEN
    RETURN jsonb_build_object(
      'status', 'authorization_failure',
      'message', 'The lyric document is unavailable or is not owned by the current user.'
    );
  END IF;

  v_locked_audio_track_id := v_document.audio_track_id;

  IF v_locked_audio_track_id IS NOT NULL THEN
    PERFORM 1
    FROM public.audio_tracks AS track
    WHERE track.id = v_locked_audio_track_id
      AND track.user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'status', 'authorization_failure',
        'message', 'The lyric document is not attached to a track owned by the current user.'
      );
    END IF;
  END IF;

  SELECT *
  INTO v_document
  FROM public.lyric_documents
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND OR v_document.user_id <> v_user_id THEN
    RETURN jsonb_build_object(
      'status', 'authorization_failure',
      'message', 'The lyric document is unavailable or is not owned by the current user.'
    );
  END IF;

  IF v_document.audio_track_id IS DISTINCT FROM v_locked_audio_track_id THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'message', 'The lyric document track changed during activation.',
      'current_revision', v_document.revision
    );
  END IF;

  IF p_expected_revision IS NOT NULL
     AND v_document.revision <> p_expected_revision THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'message', 'The lyric document changed in another editor session.',
      'current_revision', v_document.revision
    );
  END IF;

  IF v_document.audio_track_id IS NOT NULL THEN
    UPDATE public.lyric_documents
    SET is_active = false
    WHERE user_id = v_user_id
      AND audio_track_id = v_document.audio_track_id
      AND id <> v_document.id
      AND is_active = true;
  END IF;

  IF NOT v_document.is_active THEN
    UPDATE public.lyric_documents
    SET is_active = true
    WHERE id = v_document.id
      AND user_id = v_user_id
    RETURNING * INTO v_document;
  ELSE
    SELECT * INTO v_document
    FROM public.lyric_documents
    WHERE id = v_document.id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'success',
    'document', to_jsonb(v_document)
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'message', 'Another lyric version became active at the same time.'
    );
  WHEN serialization_failure OR deadlock_detected THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'message', 'The lyric document activation conflicted with another transaction.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'status', 'unexpected_failure',
      'message', 'The lyric document could not be activated.',
      'error_code', SQLSTATE
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_lyric_document_atomic(
  p_document_id uuid,
  p_expected_revision bigint,
  p_document jsonb,
  p_cues jsonb,
  p_activate boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing public.lyric_documents%ROWTYPE;
  v_document public.lyric_documents%ROWTYPE;
  v_audio_track_id uuid;
  v_visual_session_id uuid;
  v_current_revision bigint;
  v_cues jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'authorization_failure',
      'message', 'Authentication is required to save lyric documents.'
    );
  END IF;

  IF p_document IS NULL OR jsonb_typeof(p_document) <> 'object' THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Document data must be a JSON object.'
    );
  END IF;

  IF p_cues IS NULL OR jsonb_typeof(p_cues) <> 'array' THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Cue data must be a JSON array.'
    );
  END IF;

  IF p_document_id IS NOT NULL AND p_expected_revision IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'An expected revision is required when updating a lyric document.'
    );
  END IF;

  IF (p_document ? 'default_style' AND jsonb_typeof(p_document->'default_style') <> 'object')
     OR (p_document ? 'default_animation' AND jsonb_typeof(p_document->'default_animation') <> 'object')
     OR (p_document ? 'default_effects' AND jsonb_typeof(p_document->'default_effects') <> 'object')
     OR (p_document ? 'metadata' AND jsonb_typeof(p_document->'metadata') <> 'object') THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'Document style, animation, effects, and metadata values must be JSON objects.'
    );
  END IF;

  -- Validate cue structure before changing either the document or existing cues.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_cues) AS cue(value)
    WHERE jsonb_typeof(cue.value) <> 'object'
       OR jsonb_typeof(cue.value->'start_ms') <> 'number'
       OR jsonb_typeof(cue.value->'end_ms') <> 'number'
       OR (cue.value->>'start_ms') !~ '^[0-9]+$'
       OR (cue.value->>'end_ms') !~ '^[0-9]+$'
       OR (cue.value->>'end_ms')::numeric <= (cue.value->>'start_ms')::numeric
       OR jsonb_typeof(cue.value->'text') <> 'string'
       OR (cue.value ? 'style' AND jsonb_typeof(cue.value->'style') <> 'object')
       OR (cue.value ? 'animation' AND jsonb_typeof(cue.value->'animation') <> 'object')
       OR (cue.value ? 'effects' AND jsonb_typeof(cue.value->'effects') <> 'object')
       OR (cue.value ? 'words' AND jsonb_typeof(cue.value->'words') <> 'array')
       OR (cue.value ? 'groups' AND jsonb_typeof(cue.value->'groups') <> 'array')
       OR (cue.value ? 'warnings' AND jsonb_typeof(cue.value->'warnings') <> 'array')
       OR (cue.value ? 'analysis_metadata' AND jsonb_typeof(cue.value->'analysis_metadata') <> 'object')
       OR (
         cue.value ? 'confidence'
         AND cue.value->'confidence' <> 'null'::jsonb
         AND (
           jsonb_typeof(cue.value->'confidence') <> 'number'
           OR (cue.value->>'confidence')::numeric < 0
           OR (cue.value->>'confidence')::numeric > 1
         )
       )
  ) THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'One or more lyric cues failed timing or JSON-shape validation.'
    );
  END IF;

  BEGIN
    v_audio_track_id := NULLIF(p_document->>'audio_track_id', '')::uuid;
    v_visual_session_id := NULLIF(p_document->>'visual_session_id', '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN jsonb_build_object(
        'status', 'validation_failure',
        'message', 'Audio-track and visual-session identifiers must be valid UUIDs.'
      );
  END;

  IF v_audio_track_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.audio_tracks AS track
       WHERE track.id = v_audio_track_id
         AND track.user_id = v_user_id
     ) THEN
    RETURN jsonb_build_object(
      'status', 'authorization_failure',
      'message', 'Lyrics cannot be attached to an audio track owned by another user.'
    );
  END IF;

  IF v_visual_session_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.visual_sessions AS session
       WHERE session.id = v_visual_session_id
         AND session.user_id = v_user_id
     ) THEN
    RETURN jsonb_build_object(
      'status', 'authorization_failure',
      'message', 'Lyrics cannot be attached to a visual session owned by another user.'
    );
  END IF;

  -- Lock the shared parent before any lyric-document row. This matches the
  -- activation RPC lock order and serializes all active-version changes for a track.
  IF v_audio_track_id IS NOT NULL THEN
    PERFORM 1
    FROM public.audio_tracks AS track
    WHERE track.id = v_audio_track_id
      AND track.user_id = v_user_id
    FOR UPDATE;
  END IF;

  IF p_document_id IS NOT NULL THEN
    SELECT *
    INTO v_existing
    FROM public.lyric_documents
    WHERE id = p_document_id
    FOR UPDATE;

    IF NOT FOUND OR v_existing.user_id <> v_user_id THEN
      RETURN jsonb_build_object(
        'status', 'authorization_failure',
        'message', 'The lyric document is unavailable or is not owned by the current user.'
      );
    END IF;

    IF p_expected_revision IS NOT NULL
       AND v_existing.revision <> p_expected_revision THEN
      RETURN jsonb_build_object(
        'status', 'conflict',
        'message', 'The lyric document changed in another editor session.',
        'current_revision', v_existing.revision
      );
    END IF;
  END IF;

  IF p_activate AND v_audio_track_id IS NOT NULL THEN
    UPDATE public.lyric_documents
    SET is_active = false
    WHERE user_id = v_user_id
      AND audio_track_id = v_audio_track_id
      AND is_active = true
      AND (p_document_id IS NULL OR id <> p_document_id);
  END IF;

  IF p_document_id IS NULL THEN
    INSERT INTO public.lyric_documents (
      user_id,
      audio_track_id,
      visual_session_id,
      title,
      artist,
      source_type,
      source_format,
      raw_source_text,
      default_style,
      default_animation,
      default_effects,
      global_offset_ms,
      is_active,
      metadata
    ) VALUES (
      v_user_id,
      v_audio_track_id,
      v_visual_session_id,
      COALESCE(p_document->>'title', ''),
      COALESCE(p_document->>'artist', ''),
      COALESCE(NULLIF(p_document->>'source_type', ''), 'manual'),
      COALESCE(NULLIF(p_document->>'source_format', ''), 'json'),
      p_document->>'raw_source_text',
      COALESCE(p_document->'default_style', '{}'::jsonb),
      COALESCE(p_document->'default_animation', '{}'::jsonb),
      COALESCE(p_document->'default_effects', '{}'::jsonb),
      COALESCE((p_document->>'global_offset_ms')::integer, 0),
      p_activate,
      COALESCE(p_document->'metadata', '{}'::jsonb)
    )
    RETURNING * INTO v_document;
  ELSE
    UPDATE public.lyric_documents
    SET
      audio_track_id = v_audio_track_id,
      visual_session_id = v_visual_session_id,
      title = COALESCE(p_document->>'title', ''),
      artist = COALESCE(p_document->>'artist', ''),
      source_type = COALESCE(NULLIF(p_document->>'source_type', ''), 'manual'),
      source_format = COALESCE(NULLIF(p_document->>'source_format', ''), 'json'),
      raw_source_text = p_document->>'raw_source_text',
      default_style = COALESCE(p_document->'default_style', '{}'::jsonb),
      default_animation = COALESCE(p_document->'default_animation', '{}'::jsonb),
      default_effects = COALESCE(p_document->'default_effects', '{}'::jsonb),
      global_offset_ms = COALESCE((p_document->>'global_offset_ms')::integer, 0),
      is_active = p_activate,
      metadata = COALESCE(p_document->'metadata', '{}'::jsonb)
    WHERE id = p_document_id
      AND user_id = v_user_id
      AND (p_expected_revision IS NULL OR revision = p_expected_revision)
    RETURNING * INTO v_document;

    IF NOT FOUND THEN
      SELECT revision
      INTO v_current_revision
      FROM public.lyric_documents
      WHERE id = p_document_id;

      RETURN jsonb_build_object(
        'status', 'conflict',
        'message', 'The lyric document changed before the save completed.',
        'current_revision', v_current_revision
      );
    END IF;
  END IF;

  -- Deleting and reinserting cues occurs inside this function transaction. Any
  -- exception below rolls the document, sibling activation, and cue replacement
  -- back to their pre-call state.
  DELETE FROM public.lyric_cues
  WHERE lyric_document_id = v_document.id;

  INSERT INTO public.lyric_cues (
    lyric_document_id,
    start_ms,
    end_ms,
    text,
    style,
    animation,
    effects,
    words,
    groups,
    sort_order,
    confidence,
    source,
    review_status,
    section_id,
    section_type,
    warnings,
    analysis_metadata,
    original_transcription_text
  )
  SELECT
    v_document.id,
    cue.start_ms,
    cue.end_ms,
    cue.text,
    COALESCE(cue.style, '{}'::jsonb),
    COALESCE(cue.animation, '{}'::jsonb),
    COALESCE(cue.effects, '{}'::jsonb),
    COALESCE(cue.words, '[]'::jsonb),
    COALESCE(cue.groups, '[]'::jsonb),
    COALESCE(cue.sort_order, 0),
    cue.confidence,
    cue.source,
    cue.review_status,
    cue.section_id,
    cue.section_type,
    COALESCE(cue.warnings, '[]'::jsonb),
    COALESCE(cue.analysis_metadata, '{}'::jsonb),
    cue.original_transcription_text
  FROM jsonb_to_recordset(p_cues) AS cue(
    start_ms integer,
    end_ms integer,
    text text,
    style jsonb,
    animation jsonb,
    effects jsonb,
    words jsonb,
    groups jsonb,
    sort_order integer,
    confidence double precision,
    source text,
    review_status text,
    section_id text,
    section_type text,
    warnings jsonb,
    analysis_metadata jsonb,
    original_transcription_text text
  );

  SELECT COALESCE(
    jsonb_agg(to_jsonb(cue_row) ORDER BY cue_row.start_ms, cue_row.sort_order, cue_row.id),
    '[]'::jsonb
  )
  INTO v_cues
  FROM public.lyric_cues AS cue_row
  WHERE cue_row.lyric_document_id = v_document.id;

  RETURN jsonb_build_object(
    'status', 'success',
    'document', to_jsonb(v_document),
    'cues', v_cues
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'message', 'Another lyric version became active or changed at the same time.'
    );
  WHEN data_exception OR check_violation OR not_null_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object(
      'status', 'validation_failure',
      'message', 'The lyric document or one of its cues failed database validation.',
      'error_code', SQLSTATE
    );
  WHEN serialization_failure OR deadlock_detected THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'message', 'The lyric document save conflicted with another transaction.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'status', 'unexpected_failure',
      'message', 'The lyric document could not be saved.',
      'error_code', SQLSTATE
    );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_lyric_document(uuid, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_lyric_document_atomic(uuid, bigint, jsonb, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_lyric_document(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_lyric_document_atomic(uuid, bigint, jsonb, jsonb, boolean) TO authenticated;
