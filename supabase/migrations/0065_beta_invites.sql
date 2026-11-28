-- Invitation-only beta enrolment (beta remediation AUTH-01).
-- ADDITIVE ONLY. A new account can be created through Supabase Auth only for an email an admin has invited (Admin Console > User Accounts >
-- Beta Invites), or for a user invited from the Supabase dashboard. Existing accounts are not affected. The list is readable and writable by
-- admins only; there is deliberately no public "is this email invited?" check, so the list cannot be probed.

CREATE TABLE IF NOT EXISTS public.beta_invites (
  email text PRIMARY KEY,
  note text,
  invited_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CONSTRAINT beta_invites_email_check CHECK (email = lower(btrim(email)) AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' AND length(email) <= 320),
  CONSTRAINT beta_invites_note_check CHECK (note IS NULL OR length(note) <= 200)
);

ALTER TABLE public.beta_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.beta_invites FROM anon;

DROP POLICY IF EXISTS "beta_invites: admin select" ON public.beta_invites;
CREATE POLICY "beta_invites: admin select" ON public.beta_invites FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "beta_invites: admin insert" ON public.beta_invites;
CREATE POLICY "beta_invites: admin insert" ON public.beta_invites FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "beta_invites: admin update" ON public.beta_invites;
CREATE POLICY "beta_invites: admin update" ON public.beta_invites FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "beta_invites: admin delete" ON public.beta_invites;
CREATE POLICY "beta_invites: admin delete" ON public.beta_invites FOR DELETE TO authenticated USING (public.is_admin());

-- Supabase Auth (role supabase_auth_admin) may read the list and mark an invite accepted, nothing more.
GRANT SELECT, UPDATE (accepted_at) ON public.beta_invites TO supabase_auth_admin;
DROP POLICY IF EXISTS "beta_invites: auth service read" ON public.beta_invites;
CREATE POLICY "beta_invites: auth service read" ON public.beta_invites FOR SELECT TO supabase_auth_admin USING (true);
DROP POLICY IF EXISTS "beta_invites: auth service accept" ON public.beta_invites;
CREATE POLICY "beta_invites: auth service accept" ON public.beta_invites FOR UPDATE TO supabase_auth_admin USING (true) WITH CHECK (true);

-- Runs for every new auth user, as the role creating it (SECURITY INVOKER, so current_user is that role). Only sign-ups made through Supabase
-- Auth (supabase_auth_admin: the sign-up form, and users added from the dashboard) are checked; inserts by the database owner (tests,
-- migrations) are not.
CREATE OR REPLACE FUNCTION public.enforce_beta_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user <> 'supabase_auth_admin' THEN
    RETURN NEW;
  END IF;
  -- A user invited from the Supabase dashboard.
  IF NEW.invited_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.email IS NULL OR NOT EXISTS (SELECT 1 FROM public.beta_invites WHERE email = lower(btrim(NEW.email))) THEN
    RAISE EXCEPTION 'STAGELESS beta enrolment is by invitation only' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.beta_invites SET accepted_at = coalesce(accepted_at, now()) WHERE email = lower(btrim(NEW.email));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_beta_invite() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_beta_invite() TO supabase_auth_admin;

DROP TRIGGER IF EXISTS enforce_beta_invite ON auth.users;
CREATE TRIGGER enforce_beta_invite
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_beta_invite();
