-- Add optional metadata columns to audio_tracks for uploaded track details.
-- These are all nullable so existing rows are unaffected.
ALTER TABLE public.audio_tracks
  ADD COLUMN IF NOT EXISTS artist       text,
  ADD COLUMN IF NOT EXISTS genre        text,
  ADD COLUMN IF NOT EXISTS bpm          numeric,
  ADD COLUMN IF NOT EXISTS musical_key  text;
