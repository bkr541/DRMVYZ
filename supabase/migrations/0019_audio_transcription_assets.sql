-- Prepared-audio pipeline: bounded JSON manifest stored on the source track.
-- The browser generates private mono 16 kHz PCM WAV chunks before the Edge
-- Function reads them, so oversized compressed tracks no longer require an
-- external long-audio worker.

ALTER TABLE public.audio_tracks
  ADD COLUMN IF NOT EXISTS transcription_assets jsonb DEFAULT NULL;

ALTER TABLE public.audio_tracks
  DROP CONSTRAINT IF EXISTS audio_tracks_transcription_assets_shape_check;

ALTER TABLE public.audio_tracks
  ADD CONSTRAINT audio_tracks_transcription_assets_shape_check
    CHECK (
      transcription_assets IS NULL
      OR (
        jsonb_typeof(transcription_assets) = 'object'
        AND octet_length(transcription_assets::text) <= 131072
      )
    );

COMMENT ON COLUMN public.audio_tracks.transcription_assets IS
  'Private prepared-audio manifest (browser-pcm16-v1). '
  'Chunks are user-owned private WAV objects in the audio-tracks bucket. '
  'Bounded to 128 KiB and a maximum of 64 chunks by the Edge Function validator.';
