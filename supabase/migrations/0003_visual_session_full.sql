-- DRMVYZ: Extend visual_sessions for full VJ session storage
-- Adds name, media_order, quality, audio_source, and a state JSONB blob so
-- the complete VzSession can round-trip through Supabase without requiring
-- UUID FKs for locally-generated preset/media IDs.

ALTER TABLE public.visual_sessions
  ADD COLUMN IF NOT EXISTS name          text,
  ADD COLUMN IF NOT EXISTS media_order   jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS quality       text  CHECK (quality IN ('High', 'Medium', 'Low')) DEFAULT 'High',
  ADD COLUMN IF NOT EXISTS audio_source  text  CHECK (audio_source IN ('file', 'microphone', 'demo')) DEFAULT 'file',
  -- Full session state blob — source of truth for restore; avoids FK constraints
  -- on locally-generated IDs (e.g. 'custom-abc123' presets, 'db-uuid' media items).
  ADD COLUMN IF NOT EXISTS state         jsonb NOT NULL DEFAULT '{}';
