-- Migration: 0007_avatars_bucket
-- Creates a public storage bucket for user profile avatars.
-- Each user can manage only their own folder: avatars/{user_id}/...

-- ── 1. Create bucket ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,   -- 5 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- ── 2. RLS policies ───────────────────────────────────────────────────────────
-- Anyone can read avatars (public bucket, needed for <img src="..."> to work)
drop policy if exists "avatars: public read"  on storage.objects;
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Authenticated users can upload to their own folder
drop policy if exists "avatars: own insert" on storage.objects;
create policy "avatars: own insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can update their own objects
drop policy if exists "avatars: own update" on storage.objects;
create policy "avatars: own update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete their own objects
drop policy if exists "avatars: own delete" on storage.objects;
create policy "avatars: own delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
