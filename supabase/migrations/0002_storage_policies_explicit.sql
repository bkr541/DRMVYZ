-- DRMVYZ Storage Policies — Explicit per-operation policies
-- Replaces the combined FOR ALL policies from 0001 with four discrete
-- policies per bucket (SELECT / INSERT / UPDATE / DELETE), each scoped
-- to authenticated users whose user_id matches the first path segment.
--
-- Path convention: {user_id}/{item_id}/{filename}
-- The first folder component is extracted with (storage.foldername(name))[1].
--
-- Apply via: supabase db push  OR  paste into Supabase SQL editor

-- ── Drop combined policies from initial migration ──────────────────────────────
drop policy if exists "audio storage: own"   on storage.objects;
drop policy if exists "media storage: own"   on storage.objects;
drop policy if exists "ring storage: own"    on storage.objects;
drop policy if exists "canvas storage: own"  on storage.objects;

-- ═══════════════════════════════════════════════════════════════════════════════
-- media-items bucket
-- ═══════════════════════════════════════════════════════════════════════════════

-- SELECT: authenticated users can read their own files (needed for signed URL creation)
create policy "media storage: select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'media-items'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- INSERT: authenticated users can upload into their own folder
create policy "media storage: insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media-items'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: authenticated users can update their own files
create policy "media storage: update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'media-items'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'media-items'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: authenticated users can delete their own files
create policy "media storage: delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'media-items'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- audio-tracks bucket
-- ═══════════════════════════════════════════════════════════════════════════════

create policy "audio storage: select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'audio-tracks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "audio storage: insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'audio-tracks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "audio storage: update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'audio-tracks'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'audio-tracks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "audio storage: delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'audio-tracks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- ring-buffers bucket
-- ═══════════════════════════════════════════════════════════════════════════════

create policy "ring storage: select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ring-buffers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "ring storage: insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ring-buffers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "ring storage: update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'ring-buffers'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'ring-buffers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "ring storage: delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'ring-buffers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- canvas-exports bucket
-- ═══════════════════════════════════════════════════════════════════════════════

create policy "canvas storage: select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'canvas-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "canvas storage: insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'canvas-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "canvas storage: update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'canvas-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'canvas-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "canvas storage: delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'canvas-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
