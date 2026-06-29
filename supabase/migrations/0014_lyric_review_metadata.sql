-- Enhanced lyric metadata foundation.
-- Adds non-destructive cue-level transcription/review fields while preserving
-- existing timing, visual overrides, word JSON, groups, and lyric documents.

-- JSON is an actively supported import source in the current Lyric Manager.
-- Extend the existing document source constraint without rewriting data.
ALTER TABLE public.lyric_documents
  DROP CONSTRAINT IF EXISTS lyric_documents_source_type_check;

ALTER TABLE public.lyric_documents
  ADD CONSTRAINT lyric_documents_source_type_check CHECK (
    source_type IN (
      'manual',
      'json_import',
      'lrc_import',
      'enhanced_lrc_import',
      'vtt_import',
      'ai_transcription',
      'api_lookup'
    )
  );

ALTER TABLE public.lyric_cues
  ADD COLUMN IF NOT EXISTS confidence double precision NULL,
  ADD COLUMN IF NOT EXISTS source text NULL,
  ADD COLUMN IF NOT EXISTS review_status text NULL,
  ADD COLUMN IF NOT EXISTS section_id text NULL,
  ADD COLUMN IF NOT EXISTS section_type text NULL,
  ADD COLUMN IF NOT EXISTS warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS analysis_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS original_transcription_text text NULL;

ALTER TABLE public.lyric_cues
  DROP CONSTRAINT IF EXISTS lyric_cues_confidence_check,
  DROP CONSTRAINT IF EXISTS lyric_cues_source_check,
  DROP CONSTRAINT IF EXISTS lyric_cues_review_status_check,
  DROP CONSTRAINT IF EXISTS lyric_cues_section_type_check,
  DROP CONSTRAINT IF EXISTS lyric_cues_warnings_is_array,
  DROP CONSTRAINT IF EXISTS lyric_cues_analysis_metadata_is_object;

ALTER TABLE public.lyric_cues
  ADD CONSTRAINT lyric_cues_confidence_check CHECK (
    confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
  ),
  ADD CONSTRAINT lyric_cues_source_check CHECK (
    source IS NULL OR source IN (
      'manual',
      'import',
      'transcription',
      'corrected',
      'generated',
      'unknown'
    )
  ),
  ADD CONSTRAINT lyric_cues_review_status_check CHECK (
    review_status IS NULL OR review_status IN (
      'unreviewed',
      'reviewed',
      'corrected',
      'rejected'
    )
  ),
  ADD CONSTRAINT lyric_cues_section_type_check CHECK (
    section_type IS NULL OR section_type IN (
      'intro',
      'verse',
      'pre_chorus',
      'chorus',
      'post_chorus',
      'refrain',
      'bridge',
      'breakdown',
      'build',
      'drop',
      'outro',
      'instrumental',
      'spoken',
      'unknown'
    )
  ),
  ADD CONSTRAINT lyric_cues_warnings_is_array CHECK (
    jsonb_typeof(warnings) = 'array'
  ),
  ADD CONSTRAINT lyric_cues_analysis_metadata_is_object CHECK (
    jsonb_typeof(analysis_metadata) = 'object'
  );

CREATE INDEX IF NOT EXISTS idx_lyric_cues_document_review_status
  ON public.lyric_cues(lyric_document_id, review_status);

CREATE INDEX IF NOT EXISTS idx_lyric_cues_document_confidence
  ON public.lyric_cues(lyric_document_id, confidence)
  WHERE confidence IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lyric_cues_document_source
  ON public.lyric_cues(lyric_document_id, source)
  WHERE source IS NOT NULL;

COMMENT ON COLUMN public.lyric_cues.confidence IS
  'Normalized cue confidence from 0 to 1. NULL means confidence is unknown.';
COMMENT ON COLUMN public.lyric_cues.source IS
  'Canonical origin of this cue: manual, import, transcription, corrected, generated, or unknown.';
COMMENT ON COLUMN public.lyric_cues.review_status IS
  'Human review lifecycle: unreviewed, reviewed, corrected, or rejected. NULL is treated as legacy/unreviewed at runtime.';
COMMENT ON COLUMN public.lyric_cues.section_id IS
  'Optional stable identifier linking the cue to a detected or manually assigned song section.';
COMMENT ON COLUMN public.lyric_cues.section_type IS
  'Optional normalized song-section category used by review and rendering systems.';
COMMENT ON COLUMN public.lyric_cues.warnings IS
  'Typed lyric warning codes. Flexible JSONB array permits additive warning codes without timing-table rewrites.';
COMMENT ON COLUMN public.lyric_cues.analysis_metadata IS
  'Provider- or analyzer-specific metadata that does not warrant dedicated query columns.';
COMMENT ON COLUMN public.lyric_cues.original_transcription_text IS
  'Original provider text retained when the displayed cue text is normalized or corrected.';
COMMENT ON COLUMN public.lyric_cues.words IS
  'Array of LyricWord objects including optional confidence, source, reviewStatus, normalizedText, originalTranscriptionText, and warnings.';
