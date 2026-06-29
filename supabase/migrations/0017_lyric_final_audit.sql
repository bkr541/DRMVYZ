-- Final lyric-system safety audit.
-- Keep routine transcription job reads bounded even when an authenticated
-- caller invokes the RPC directly instead of using the Edge Function.

UPDATE public.lyric_transcription_jobs
SET provider_metadata = jsonb_strip_nulls(jsonb_build_object(
  'metadataTruncated', true,
  'provider', provider_metadata -> 'provider',
  'model', provider_metadata -> 'model',
  'durationMs', provider_metadata -> 'durationMs',
  'unitCount', provider_metadata -> 'unitCount',
  'warnings', provider_metadata -> 'warnings'
))
WHERE octet_length(provider_metadata::text) > 524288;

UPDATE public.lyric_transcription_jobs
SET request_options = '{}'::jsonb
WHERE octet_length(request_options::text) > 16384;

ALTER TABLE public.lyric_transcription_jobs
  DROP CONSTRAINT IF EXISTS lyric_transcription_jobs_provider_metadata_size_check,
  DROP CONSTRAINT IF EXISTS lyric_transcription_jobs_request_options_size_check;

ALTER TABLE public.lyric_transcription_jobs
  ADD CONSTRAINT lyric_transcription_jobs_provider_metadata_size_check
    CHECK (octet_length(provider_metadata::text) <= 524288),
  ADD CONSTRAINT lyric_transcription_jobs_request_options_size_check
    CHECK (octet_length(request_options::text) <= 16384);

COMMENT ON CONSTRAINT lyric_transcription_jobs_provider_metadata_size_check
  ON public.lyric_transcription_jobs IS
  'Bounds raw provider diagnostics so ordinary job queries cannot accumulate unbounded payloads.';
COMMENT ON CONSTRAINT lyric_transcription_jobs_request_options_size_check
  ON public.lyric_transcription_jobs IS
  'Bounds client-supplied extraction options independently of the Edge Function.';
