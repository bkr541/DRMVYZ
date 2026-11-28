-- Rollback for 0065_beta_invites.sql. Sign-up opens to anyone again; the invite list is removed.
DROP TRIGGER IF EXISTS enforce_beta_invite ON auth.users;
DROP FUNCTION IF EXISTS public.enforce_beta_invite();
DROP TABLE IF EXISTS public.beta_invites;
