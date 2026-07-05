-- Rekordbox import metadata and per-track cue persistence foundation.
-- Nullable additions keep existing uploaded tracks and sessions untouched.

ALTER TABLE public.audio_tracks
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_track_id text,
  ADD COLUMN IF NOT EXISTS external_metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.audio_tracks
  DROP CONSTRAINT IF EXISTS audio_tracks_source_type_check;

ALTER TABLE public.audio_tracks
  ADD CONSTRAINT audio_tracks_source_type_check
  CHECK (source_type IN ('file','microphone','demo','ring_buffer','rekordbox_xml','rekordbox_usb'));

CREATE TABLE IF NOT EXISTS public.track_cues (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id       uuid NOT NULL REFERENCES public.audio_tracks(id) ON DELETE CASCADE,
  source         text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','rekordbox','analysis')),
  source_cue_id  text,
  label          text NOT NULL,
  cue_kind       text NOT NULL DEFAULT 'marker' CHECK (cue_kind IN ('hot_cue','memory_cue','loop','marker','automation')),
  time_sec       numeric(10,3) NOT NULL CHECK (time_sec >= 0),
  end_time_sec   numeric(10,3) CHECK (end_time_sec IS NULL OR end_time_sec >= time_sec),
  color          text,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(track_id, source, source_cue_id)
);

SELECT add_updated_at_trigger('track_cues');

CREATE INDEX IF NOT EXISTS idx_track_cues_track_time ON public.track_cues(track_id, time_sec);

ALTER TABLE public.track_cues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "track_cues: own read" ON public.track_cues;
DROP POLICY IF EXISTS "track_cues: own insert" ON public.track_cues;
DROP POLICY IF EXISTS "track_cues: own update" ON public.track_cues;
DROP POLICY IF EXISTS "track_cues: own delete" ON public.track_cues;

CREATE POLICY "track_cues: own read" ON public.track_cues
  FOR SELECT USING (exists (select 1 from public.audio_tracks t where t.id = track_id and t.user_id = auth.uid()));
CREATE POLICY "track_cues: own insert" ON public.track_cues
  FOR INSERT WITH CHECK (exists (select 1 from public.audio_tracks t where t.id = track_id and t.user_id = auth.uid()));
CREATE POLICY "track_cues: own update" ON public.track_cues
  FOR UPDATE USING (exists (select 1 from public.audio_tracks t where t.id = track_id and t.user_id = auth.uid()));
CREATE POLICY "track_cues: own delete" ON public.track_cues
  FOR DELETE USING (exists (select 1 from public.audio_tracks t where t.id = track_id and t.user_id = auth.uid()));
