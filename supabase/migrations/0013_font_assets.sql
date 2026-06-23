-- Migration: 0013_font_assets
-- Creates the font-assets Storage bucket and the public.font_assets table so
-- users can persist uploaded OpenType fonts across sessions.
-- Path convention: font-assets/{user_id}/{filename}

-- ── 1. Storage bucket ─────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'font-assets',
  'font-assets',
  false,
  5242880,   -- 5 MB per file
  array[
    'font/ttf',
    'font/otf',
    'application/x-font-ttf',
    'application/x-font-opentype',
    'application/font-sfnt',
    'application/octet-stream'
  ]
)
on conflict (id) do nothing;

-- ── 2. font_assets table ──────────────────────────────────────────────────────

create table if not exists public.font_assets (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  name              text        not null,
  file_name         text        not null,
  font_family_name  text,
  storage_path      text        not null unique,
  mime_type         text        not null,
  file_size         bigint      not null,
  created_at        timestamptz not null default now()
);

create index if not exists idx_font_assets_user_id on public.font_assets(user_id);

-- ── 3. Row-level security — table ────────────────────────────────────────────

alter table public.font_assets enable row level security;

drop policy if exists "font_assets: own select" on public.font_assets;
create policy "font_assets: own select"
  on public.font_assets for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "font_assets: own insert" on public.font_assets;
create policy "font_assets: own insert"
  on public.font_assets for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "font_assets: own update" on public.font_assets;
create policy "font_assets: own update"
  on public.font_assets for update to authenticated
  using     (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "font_assets: own delete" on public.font_assets;
create policy "font_assets: own delete"
  on public.font_assets for delete to authenticated
  using (auth.uid() = user_id);

-- ── 4. Row-level security — storage ──────────────────────────────────────────

drop policy if exists "font-assets storage: select" on storage.objects;
create policy "font-assets storage: select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'font-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "font-assets storage: insert" on storage.objects;
create policy "font-assets storage: insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'font-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "font-assets storage: update" on storage.objects;
create policy "font-assets storage: update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'font-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'font-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "font-assets storage: delete" on storage.objects;
create policy "font-assets storage: delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'font-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
