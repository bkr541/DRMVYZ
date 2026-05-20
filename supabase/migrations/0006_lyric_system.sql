-- ============================================================
-- Migration: 0006_lyric_system.sql
-- Description: Timed lyric documents and cues for VYZUALZ
-- Safe to run more than once (IF NOT EXISTS / CREATE OR REPLACE
-- throughout). No visualizer integration — DB layer only.
-- ============================================================


-- ── Shared trigger function ─────────────────────────────────
-- Reuse if already created by an earlier migration.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ── Table: public.lyric_documents ───────────────────────────
-- Stores one synced lyric document per song / visual session.
-- Each document owns a set of lyric_cues and carries
-- document-level style/animation/effects defaults that
-- individual cues can override via their own JSONB fields.
CREATE TABLE IF NOT EXISTS public.lyric_documents (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner — cascades delete so orphan documents are impossible.
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Optional foreign keys; kept nullable because a document can
  -- exist before an audio track or visual session is associated.
  audio_track_id      uuid        NULL,
  visual_session_id   uuid        NULL,

  title               text        NOT NULL DEFAULT '',
  artist              text        NOT NULL DEFAULT '',

  -- How the lyric data arrived (manual entry, import, AI, etc.)
  source_type         text        NOT NULL DEFAULT 'manual',
  -- Wire format of the original source before parsing.
  source_format       text        NOT NULL DEFAULT 'json',
  -- Raw source text preserved for re-parsing or debugging.
  raw_source_text     text        NULL,

  -- Document-level visual defaults. Individual cues merge on top
  -- of these at runtime. JSONB because the visualizer's style /
  -- animation / effects schemas evolve independently of the DB.
  default_style       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  default_animation   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  default_effects     jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Shift all cue timestamps by this many milliseconds at render
  -- time; useful to correct bulk timing drift without re-saving.
  global_offset_ms    integer     NOT NULL DEFAULT 0,

  is_active           boolean     NOT NULL DEFAULT true,

  -- Arbitrary caller-defined metadata (e.g. language, BPM hint).
  metadata            jsonb       NOT NULL DEFAULT '{}'::jsonb,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- ── Check constraints ────────────────────────────────────
  CONSTRAINT lyric_documents_source_type_check CHECK (
    source_type IN (
      'manual',
      'lrc_import',
      'enhanced_lrc_import',
      'vtt_import',
      'ai_transcription',
      'api_lookup'
    )
  ),
  CONSTRAINT lyric_documents_source_format_check CHECK (
    source_format IN (
      'json',
      'lrc',
      'enhanced_lrc',
      'vtt',
      'text'
    )
  )
);

COMMENT ON TABLE public.lyric_documents IS
  'One timed-lyric document per song or visual session. '
  'Stores source metadata, document-level visual defaults, '
  'and a global timing offset. Cues live in lyric_cues.';

COMMENT ON COLUMN public.lyric_documents.default_style IS
  'Document-level LyricStyle defaults (font, color, position, …). '
  'Individual cues merge their own style on top at render time.';
COMMENT ON COLUMN public.lyric_documents.default_animation IS
  'Document-level LyricAnimation defaults (in/out easing, duration, …).';
COMMENT ON COLUMN public.lyric_documents.default_effects IS
  'Document-level LyricEffects defaults (blur, glow, shake, …).';
COMMENT ON COLUMN public.lyric_documents.global_offset_ms IS
  'Millisecond offset added to every cue start_ms/end_ms at runtime. '
  'Positive = shift later; negative = shift earlier.';


-- ── Table: public.lyric_cues ────────────────────────────────
-- Stores individual timed lyric lines (cues) belonging to a
-- lyric_document. Each cue carries its own style/animation/
-- effects overrides and optionally word- and group-level data
-- as nested JSONB arrays — flexible enough to hold the full
-- LyricWord / LyricGroup runtime shape without DB schema churn.
CREATE TABLE IF NOT EXISTS public.lyric_cues (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  lyric_document_id   uuid        NOT NULL
                        REFERENCES public.lyric_documents(id) ON DELETE CASCADE,

  -- Timing stored as integer milliseconds for exact arithmetic.
  start_ms            integer     NOT NULL,
  end_ms              integer     NOT NULL,

  text                text        NOT NULL,

  -- Per-cue visual overrides. Empty object = inherit from document defaults.
  -- JSONB because LyricStyle / LyricAnimation / LyricEffects are defined
  -- in TypeScript and evolve without requiring DB schema migrations.
  style               jsonb       NOT NULL DEFAULT '{}'::jsonb,
  animation           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  effects             jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Word-level timing and per-word visual data (array of LyricWord objects).
  words               jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Group-level overrides linking sets of word IDs (array of LyricGroup objects).
  groups              jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Explicit ordering column so cues can be reordered without changing start_ms.
  sort_order          integer     NOT NULL DEFAULT 0,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- ── Check constraints ────────────────────────────────────
  CONSTRAINT lyric_cues_timing_positive    CHECK (start_ms >= 0 AND end_ms >= 0),
  CONSTRAINT lyric_cues_timing_valid       CHECK (end_ms > start_ms),
  CONSTRAINT lyric_cues_words_is_array     CHECK (jsonb_typeof(words)     = 'array'),
  CONSTRAINT lyric_cues_groups_is_array    CHECK (jsonb_typeof(groups)    = 'array'),
  CONSTRAINT lyric_cues_style_is_object    CHECK (jsonb_typeof(style)     = 'object'),
  CONSTRAINT lyric_cues_animation_is_object CHECK (jsonb_typeof(animation) = 'object'),
  CONSTRAINT lyric_cues_effects_is_object  CHECK (jsonb_typeof(effects)   = 'object')
);

COMMENT ON TABLE public.lyric_cues IS
  'Individual timed lyric lines belonging to a lyric_document. '
  'Timing is stored in integer milliseconds. Nested visual data '
  '(style, animation, effects, word-level timing, group overrides) '
  'is stored as JSONB so the visualizer schema can evolve freely.';

COMMENT ON COLUMN public.lyric_cues.style IS
  'Per-cue LyricStyle partial override (merged over document default_style at runtime).';
COMMENT ON COLUMN public.lyric_cues.animation IS
  'Per-cue LyricAnimation partial override.';
COMMENT ON COLUMN public.lyric_cues.effects IS
  'Per-cue LyricEffects partial override.';
COMMENT ON COLUMN public.lyric_cues.words IS
  'Array of LyricWord objects: { id, text, startMs, endMs, style?, animation?, effects? }. '
  'Empty array when word-level timing is not available.';
COMMENT ON COLUMN public.lyric_cues.groups IS
  'Array of LyricGroup objects: { id, wordIds[], style?, animation?, effects? }. '
  'Empty array when no grouping is defined.';


-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lyric_documents_user_id
  ON public.lyric_documents(user_id);

CREATE INDEX IF NOT EXISTS idx_lyric_documents_audio_track_id
  ON public.lyric_documents(audio_track_id);

CREATE INDEX IF NOT EXISTS idx_lyric_documents_visual_session_id
  ON public.lyric_documents(visual_session_id);

CREATE INDEX IF NOT EXISTS idx_lyric_documents_active
  ON public.lyric_documents(is_active);

CREATE INDEX IF NOT EXISTS idx_lyric_cues_document_id
  ON public.lyric_cues(lyric_document_id);

-- Primary lookup: "give me all cues for this document that overlap [t0, t1]"
CREATE INDEX IF NOT EXISTS idx_lyric_cues_document_time
  ON public.lyric_cues(lyric_document_id, start_ms, end_ms);

CREATE INDEX IF NOT EXISTS idx_lyric_cues_sort_order
  ON public.lyric_cues(lyric_document_id, sort_order);


-- ── Updated_at triggers ──────────────────────────────────────
-- Drop and recreate so re-running the script is idempotent.
DROP TRIGGER IF EXISTS set_updated_at_lyric_documents ON public.lyric_documents;
CREATE TRIGGER set_updated_at_lyric_documents
  BEFORE UPDATE ON public.lyric_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_lyric_cues ON public.lyric_cues;
CREATE TRIGGER set_updated_at_lyric_cues
  BEFORE UPDATE ON public.lyric_cues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE public.lyric_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lyric_cues      ENABLE ROW LEVEL SECURITY;


-- lyric_documents policies ───────────────────────────────────
DROP POLICY IF EXISTS "Users can select their own lyric documents"
  ON public.lyric_documents;
CREATE POLICY "Users can select their own lyric documents"
  ON public.lyric_documents FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own lyric documents"
  ON public.lyric_documents;
CREATE POLICY "Users can insert their own lyric documents"
  ON public.lyric_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own lyric documents"
  ON public.lyric_documents;
CREATE POLICY "Users can update their own lyric documents"
  ON public.lyric_documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own lyric documents"
  ON public.lyric_documents;
CREATE POLICY "Users can delete their own lyric documents"
  ON public.lyric_documents FOR DELETE
  USING (auth.uid() = user_id);


-- lyric_cues policies ────────────────────────────────────────
-- All access is gated through the parent lyric_document's user_id,
-- so users can never touch another user's cues even if they know the UUID.

DROP POLICY IF EXISTS "Users can select their own lyric cues"
  ON public.lyric_cues;
CREATE POLICY "Users can select their own lyric cues"
  ON public.lyric_cues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lyric_documents d
      WHERE d.id = lyric_document_id
        AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own lyric cues"
  ON public.lyric_cues;
CREATE POLICY "Users can insert their own lyric cues"
  ON public.lyric_cues FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lyric_documents d
      WHERE d.id = lyric_document_id
        AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own lyric cues"
  ON public.lyric_cues;
CREATE POLICY "Users can update their own lyric cues"
  ON public.lyric_cues FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.lyric_documents d
      WHERE d.id = lyric_document_id
        AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lyric_documents d
      WHERE d.id = lyric_document_id
        AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own lyric cues"
  ON public.lyric_cues;
CREATE POLICY "Users can delete their own lyric cues"
  ON public.lyric_cues FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.lyric_documents d
      WHERE d.id = lyric_document_id
        AND d.user_id = auth.uid()
    )
  );
