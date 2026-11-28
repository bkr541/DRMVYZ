-- Rollback for 0066_beta_issue_reports.sql. Deletes every issue report.
DROP TRIGGER IF EXISTS limit_beta_issue_reports ON public.beta_issue_reports;
DROP FUNCTION IF EXISTS public.limit_beta_issue_reports();
DROP TABLE IF EXISTS public.beta_issue_reports;
