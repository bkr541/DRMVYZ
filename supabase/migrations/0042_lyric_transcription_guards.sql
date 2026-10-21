-- Two guards on AI lyric transcription jobs.
--
-- 1. Stale jobs. A job holds the track's only "active" slot (uq_lyric_transcription_jobs_active_track, 0016) while it is queued or
--    processing. If the edge function is killed mid-job (a timeout or a crash) nothing ever finishes it, so the track could never be
--    extracted again until the user found and cancelled it by hand. Every step of a healthy job rewrites the row (updated_at moves: the
--    stage changes and each chunk's progress), and a single provider call times out after 3 minutes, so a job untouched for 15 minutes
--    is dead. fail_stale_lyric_transcription_jobs() marks it failed (retryable) for the calling user; the app calls it whenever it lists a
--    track's jobs and the edge function calls it before every action.
--
-- 2. Spend. Each job is a paid provider call. A BEFORE INSERT trigger refuses an 11th job from the same account inside 24 hours, whatever
--    created it, so the cap holds even for a client that does not go through the edge function's own checks.

CREATE OR REPLACE FUNCTION public.fail_stale_lyric_transcription_jobs(p_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- A signed-in caller can only ever sweep their own jobs; p_user_id is honoured only for the service role, which has no auth.uid().
  v_user_id uuid := COALESCE(auth.uid(), p_user_id);
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.lyric_transcription_jobs
  SET status = 'failed',
      error_code = 'timed_out',
      error_message = 'Transcription stopped responding and was marked as failed. Retry it to try again.',
      completed_at = now()
  WHERE user_id = v_user_id
    AND status IN ('queued', 'processing')
    AND updated_at < now() - interval '15 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_stale_lyric_transcription_jobs(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fail_stale_lyric_transcription_jobs(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_lyric_transcription_daily_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_limit CONSTANT integer := 10;
  v_used integer;
BEGIN
  -- Serialise the count per account so two jobs started together cannot both slip under the cap.
  PERFORM pg_advisory_xact_lock(hashtextextended('lyric_transcription_daily_limit:' || NEW.user_id::text, 0));

  SELECT count(*) INTO v_used
  FROM public.lyric_transcription_jobs
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '24 hours';

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'lyric_transcription_daily_limit'
      USING ERRCODE = 'P0001',
            DETAIL = format('%s lyric transcription jobs were started in the last 24 hours (limit %s).', v_used, v_limit);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_lyric_transcription_daily_limit ON public.lyric_transcription_jobs;
CREATE TRIGGER enforce_lyric_transcription_daily_limit
  BEFORE INSERT ON public.lyric_transcription_jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lyric_transcription_daily_limit();
