-- Flags uploaded audio tracks that matched Rekordbox data at upload time.
-- Boolean only: no Rekordbox metadata, cues or phrases are stored.

ALTER TABLE public.audio_tracks
  ADD COLUMN IF NOT EXISTS is_rekordbox boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.audio_tracks.is_rekordbox IS
  'True when a matching Rekordbox library entry was found for the file at upload time. Flag only; no Rekordbox data is stored.';
