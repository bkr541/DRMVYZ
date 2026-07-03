-- Groq Whisper provider foundation for lyric transcription jobs.
-- Preserve historical OpenAI/custom rows while allowing new Groq jobs.

ALTER TABLE IF EXISTS public.lyric_transcription_jobs
  DROP CONSTRAINT IF EXISTS lyric_transcription_jobs_provider_check;

ALTER TABLE IF EXISTS public.lyric_transcription_jobs
  ADD CONSTRAINT lyric_transcription_jobs_provider_check
    CHECK (provider IN ('groq', 'openai', 'custom'));

COMMENT ON CONSTRAINT lyric_transcription_jobs_provider_check
  ON public.lyric_transcription_jobs IS
  'Allowed lyric transcription provider identifiers. Groq is the intended provider for new jobs; OpenAI/custom are retained for historical rows and staged compatibility.';
