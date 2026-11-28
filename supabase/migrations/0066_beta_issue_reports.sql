-- Beta issue reports (beta remediation UX-01).
-- ADDITIVE ONLY. A signed-in tester sends a report from Settings > Beta & Support; it can carry sanitized diagnostics the app prepares
-- (version, platform, graphics, what was active, recent log lines with links, paths, tokens and emails removed). Testers read their own
-- reports; admins read and triage all of them.

CREATE TABLE IF NOT EXISTS public.beta_issue_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  summary text NOT NULL,
  steps text,
  app_version text NOT NULL,
  app_build text,
  diagnostics jsonb,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT beta_issue_reports_category_check CHECK (category IN ('rendering', 'audio', 'media', 'output', 'account', 'performance', 'other')),
  CONSTRAINT beta_issue_reports_summary_check CHECK (length(btrim(summary)) BETWEEN 1 AND 4000),
  CONSTRAINT beta_issue_reports_steps_check CHECK (steps IS NULL OR length(steps) <= 4000),
  CONSTRAINT beta_issue_reports_version_check CHECK (length(app_version) <= 64 AND (app_build IS NULL OR length(app_build) <= 128)),
  CONSTRAINT beta_issue_reports_diagnostics_check CHECK (diagnostics IS NULL OR pg_column_size(diagnostics) <= 262144),
  CONSTRAINT beta_issue_reports_status_check CHECK (status IN ('new', 'triaged', 'fixed', 'closed'))
);

CREATE INDEX IF NOT EXISTS beta_issue_reports_created_idx ON public.beta_issue_reports (created_at DESC);

ALTER TABLE public.beta_issue_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.beta_issue_reports FROM anon;

DROP POLICY IF EXISTS "beta_issue_reports: own insert" ON public.beta_issue_reports;
CREATE POLICY "beta_issue_reports: own insert" ON public.beta_issue_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'new');
DROP POLICY IF EXISTS "beta_issue_reports: own or admin select" ON public.beta_issue_reports;
CREATE POLICY "beta_issue_reports: own or admin select" ON public.beta_issue_reports FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "beta_issue_reports: admin update" ON public.beta_issue_reports;
CREATE POLICY "beta_issue_reports: admin update" ON public.beta_issue_reports FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "beta_issue_reports: admin delete" ON public.beta_issue_reports;
CREATE POLICY "beta_issue_reports: admin delete" ON public.beta_issue_reports FOR DELETE TO authenticated
  USING (public.is_admin());

-- A tester can send at most 20 reports a day, so a stuck button cannot flood the table.
CREATE OR REPLACE FUNCTION public.limit_beta_issue_reports()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT count(*) FROM public.beta_issue_reports WHERE user_id = NEW.user_id AND created_at > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'Daily issue report limit reached' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.limit_beta_issue_reports() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS limit_beta_issue_reports ON public.beta_issue_reports;
CREATE TRIGGER limit_beta_issue_reports BEFORE INSERT ON public.beta_issue_reports
  FOR EACH ROW EXECUTE FUNCTION public.limit_beta_issue_reports();
