-- Migration: 0004_add_artist_name_to_profiles
-- Adds artist_name column to public.profiles and updates the new-user trigger
-- so that display_name and artist_name are populated from auth signup metadata.

-- ── 1. Add column ─────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists artist_name text;

-- ── 2. Replace new-user trigger function ──────────────────────────────────────
-- Populates display_name and artist_name from auth.users.raw_user_meta_data,
-- which is set by the client via supabase.auth.signUp({ options: { data: {...} } }).
-- Uses COALESCE on upsert so an existing value is never overwritten by a null.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    display_name,
    artist_name
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'artist_name'
  )
  on conflict (id) do update
  set
    email        = excluded.email,
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    artist_name  = coalesce(excluded.artist_name,  public.profiles.artist_name),
    updated_at   = now();

  return new;
end;
$$;

-- ── 3. Optional backfill for existing users ───────────────────────────────────
-- Run manually if you have users who signed up before this migration was applied
-- and need their artist_name copied from auth metadata.
--
-- update public.profiles p
-- set
--   display_name = coalesce(p.display_name, u.raw_user_meta_data ->> 'display_name'),
--   artist_name  = coalesce(p.artist_name,  u.raw_user_meta_data ->> 'artist_name'),
--   updated_at   = now()
-- from auth.users u
-- where p.id = u.id
--   and (p.display_name is null or p.artist_name is null);
