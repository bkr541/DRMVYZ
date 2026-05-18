-- DRMVYZ Initial Schema
-- Apply via: supabase db push  OR  paste into Supabase SQL editor

-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── Helpers ───────────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Attach updated_at trigger to a table
create or replace function add_updated_at_trigger(tbl text)
returns void language plpgsql as $$
begin
  execute format(
    'create trigger trg_updated_at before update on %I
     for each row execute procedure set_updated_at()', tbl
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- A. SHARED / AUTH
-- ═══════════════════════════════════════════════════════════════════════════════

-- A1. profiles — mirrors auth.users
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

select add_updated_at_trigger('profiles');

-- Auto-create profile on new user signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- A2. sessions — app usage sessions
create table if not exists public.sessions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.profiles(id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  client_info jsonb default '{}'
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- B. ANALYZER VIEW
-- ═══════════════════════════════════════════════════════════════════════════════

-- B1. audio_tracks — uploaded or imported audio files
create table if not exists public.audio_tracks (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.profiles(id) on delete set null,
  title         text not null,
  file_name     text not null,
  storage_path  text,                              -- Supabase Storage path
  duration_sec  numeric(10,3),
  sample_rate   integer check (sample_rate > 0),
  bit_depth     integer check (bit_depth in (8,16,24,32)),
  channels      integer check (channels between 1 and 8),
  file_size     bigint,
  mime_type     text,
  source_type   text check (source_type in ('file','microphone','demo','ring_buffer')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

select add_updated_at_trigger('audio_tracks');

create index if not exists idx_audio_tracks_user on public.audio_tracks(user_id);

-- B2. track_analyses — cached analysis results per track
create table if not exists public.track_analyses (
  id                uuid primary key default uuid_generate_v4(),
  track_id          uuid not null references public.audio_tracks(id) on delete cascade,
  lufs_integrated   numeric(6,2),
  lufs_short        numeric(6,2),
  lufs_momentary    numeric(6,2),
  true_peak         numeric(6,2),
  dynamic_range     numeric(6,2),
  stereo_width      numeric(5,4) check (stereo_width between 0 and 1),
  phase_correlation numeric(5,4) check (phase_correlation between -1 and 1),
  bpm               numeric(7,3),
  bpm_confidence    numeric(4,3) check (bpm_confidence between 0 and 1),
  key_note          text,
  key_mode          text check (key_mode in ('major','minor')),
  waveform_peaks    jsonb,                         -- float[] compressed
  spectrum_avg      jsonb,                         -- float[64] avg spectrum
  band_bass         numeric(5,4),
  band_low_mid      numeric(5,4),
  band_mid          numeric(5,4),
  band_high_mid     numeric(5,4),
  band_presence     numeric(5,4),
  band_air          numeric(5,4),
  analyzed_at       timestamptz not null default now()
);

create unique index if not exists idx_track_analyses_track on public.track_analyses(track_id);

-- B3. analyzer_sessions — per-session playback settings
create table if not exists public.analyzer_sessions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.profiles(id) on delete cascade,
  track_id    uuid references public.audio_tracks(id) on delete set null,
  fft_size    integer check (fft_size in (512,1024,2048,4096,8192,16384)) default 2048,
  smoothing   numeric(4,3) check (smoothing between 0 and 1) default 0.8,
  source      text check (source in ('file','microphone','demo')) default 'file',
  volume      numeric(4,3) check (volume between 0 and 1) default 0.75,
  meter_mode  text check (meter_mode in ('vu','rms','peak','ebu')) default 'rms',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

select add_updated_at_trigger('analyzer_sessions');

-- B4. ring_buffer_exports — WAV exports from ring buffer
create table if not exists public.ring_buffer_exports (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.profiles(id) on delete set null,
  storage_path  text not null,
  duration_sec  integer check (duration_sec in (10,30,60)),
  file_size     bigint,
  exported_at   timestamptz not null default now()
);

-- B5. bpm_detections — history of BPM detect runs
create table if not exists public.bpm_detections (
  id          uuid primary key default uuid_generate_v4(),
  track_id    uuid references public.audio_tracks(id) on delete cascade,
  bpm         numeric(7,3) not null,
  confidence  numeric(4,3),
  method      text default 'web-audio-beat-detector',
  detected_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- C. REFERENCE VIEW
-- ═══════════════════════════════════════════════════════════════════════════════

-- C1. reference_sessions — a comparison session (1 main + up to 3 refs)
create table if not exists public.reference_sessions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade,
  name            text,
  main_track_id   uuid references public.audio_tracks(id) on delete set null,
  view_mode       text check (view_mode in ('grid','overlay','ab')) default 'grid',
  loudness_match  boolean default false,
  linked_playback boolean default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

select add_updated_at_trigger('reference_sessions');

-- C2. reference_slots — the 3 reference track slots per session
create table if not exists public.reference_slots (
  id                uuid primary key default uuid_generate_v4(),
  session_id        uuid not null references public.reference_sessions(id) on delete cascade,
  slot_index        integer not null check (slot_index between 0 and 2),
  track_id          uuid references public.audio_tracks(id) on delete set null,
  accent_color      text,
  created_at        timestamptz not null default now(),
  unique (session_id, slot_index)
);

-- C3. reference_comparisons — cached match scores between main and a ref
create table if not exists public.reference_comparisons (
  id                uuid primary key default uuid_generate_v4(),
  session_id        uuid not null references public.reference_sessions(id) on delete cascade,
  main_track_id     uuid references public.audio_tracks(id) on delete cascade,
  ref_track_id      uuid references public.audio_tracks(id) on delete cascade,
  overall_score     numeric(5,2) check (overall_score between 0 and 100),
  loudness_diff     numeric(6,2),
  dynamic_diff      numeric(6,2),
  stereo_diff       numeric(5,4),
  spectrum_diff     numeric(5,4),
  band_diffs        jsonb,
  computed_at       timestamptz not null default now(),
  unique (session_id, main_track_id, ref_track_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- D. VYZUALZ VIEW
-- ═══════════════════════════════════════════════════════════════════════════════

-- D1. media_items — uploaded images and videos for canvas
create table if not exists public.media_items (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.profiles(id) on delete cascade,
  name          text not null,
  type          text not null check (type in ('image','video')),
  storage_path  text not null,
  thumbnail_path text,
  width         integer,
  height        integer,
  duration_sec  numeric(8,3),
  file_size     bigint,
  mime_type     text,
  favorite      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

select add_updated_at_trigger('media_items');

create index if not exists idx_media_items_user on public.media_items(user_id);

-- D2. visual_presets — saved effect presets
create table if not exists public.visual_presets (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade,
  name            text not null,
  color           text not null default '#19bff2',
  gradient        text,
  is_default      boolean not null default false,
  effects         jsonb not null default '{}',   -- VzEffects snapshot
  enabled_fx      jsonb not null default '[]',   -- string[]
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

select add_updated_at_trigger('visual_presets');

create index if not exists idx_visual_presets_user on public.visual_presets(user_id);

-- D3. visual_sessions — per-session canvas/playback state
create table if not exists public.visual_sessions (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references public.profiles(id) on delete cascade,
  active_preset_id  uuid references public.visual_presets(id) on delete set null,
  active_media_id   uuid references public.media_items(id) on delete set null,
  bpm               numeric(7,3) default 120,
  bpm_sync          boolean default false,
  effects           jsonb default '{}',
  enabled_fx        jsonb default '[]',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

select add_updated_at_trigger('visual_sessions');

-- D4. canvas_exports — recorded/exported canvas frames
create table if not exists public.canvas_exports (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.profiles(id) on delete set null,
  preset_id     uuid references public.visual_presets(id) on delete set null,
  media_id      uuid references public.media_items(id) on delete set null,
  storage_path  text not null,
  format        text check (format in ('png','jpeg','webm','gif')) default 'png',
  width         integer,
  height        integer,
  file_size     bigint,
  exported_at   timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- E. CROSS-VIEW SHARED
-- ═══════════════════════════════════════════════════════════════════════════════

-- E1. user_settings — persisted app-wide user preferences
create table if not exists public.user_settings (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  theme           text check (theme in ('dark','light','system')) default 'dark',
  default_view    text check (default_view in ('analyzer','reference','vyzualz')) default 'analyzer',
  fft_size        integer check (fft_size in (512,1024,2048,4096,8192,16384)) default 2048,
  smoothing       numeric(4,3) check (smoothing between 0 and 1) default 0.8,
  default_volume  numeric(4,3) check (default_volume between 0 and 1) default 0.75,
  updated_at      timestamptz not null default now()
);

select add_updated_at_trigger('user_settings');

-- Auto-create settings row when profile is created
create or replace function handle_new_profile()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created
  after insert on public.profiles
  for each row execute procedure handle_new_profile();

-- E2. tags — user-defined labels for tracks/media
create table if not exists public.tags (
  id       uuid primary key default uuid_generate_v4(),
  user_id  uuid references public.profiles(id) on delete cascade,
  name     text not null,
  color    text,
  unique (user_id, name)
);

-- E3. audio_track_tags — M2M tracks ↔ tags
create table if not exists public.audio_track_tags (
  track_id  uuid not null references public.audio_tracks(id) on delete cascade,
  tag_id    uuid not null references public.tags(id) on delete cascade,
  primary key (track_id, tag_id)
);

-- E4. media_item_tags — M2M media ↔ tags
create table if not exists public.media_item_tags (
  media_id  uuid not null references public.media_items(id) on delete cascade,
  tag_id    uuid not null references public.tags(id) on delete cascade,
  primary key (media_id, tag_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- F. ROW-LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.profiles              enable row level security;
alter table public.sessions              enable row level security;
alter table public.audio_tracks          enable row level security;
alter table public.track_analyses        enable row level security;
alter table public.analyzer_sessions     enable row level security;
alter table public.ring_buffer_exports   enable row level security;
alter table public.bpm_detections        enable row level security;
alter table public.reference_sessions    enable row level security;
alter table public.reference_slots       enable row level security;
alter table public.reference_comparisons enable row level security;
alter table public.media_items           enable row level security;
alter table public.visual_presets        enable row level security;
alter table public.visual_sessions       enable row level security;
alter table public.canvas_exports        enable row level security;
alter table public.user_settings         enable row level security;
alter table public.tags                  enable row level security;
alter table public.audio_track_tags      enable row level security;
alter table public.media_item_tags       enable row level security;

-- profiles: users see + update only their own
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);

-- user_settings: own row
create policy "settings: own all" on public.user_settings
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- audio_tracks: own rows
create policy "tracks: own read"   on public.audio_tracks for select using (auth.uid() = user_id);
create policy "tracks: own insert" on public.audio_tracks for insert with check (auth.uid() = user_id);
create policy "tracks: own update" on public.audio_tracks for update using (auth.uid() = user_id);
create policy "tracks: own delete" on public.audio_tracks for delete using (auth.uid() = user_id);

-- track_analyses: readable if user owns the track
create policy "analyses: track owner read" on public.track_analyses for select
  using (exists (select 1 from public.audio_tracks t where t.id = track_id and t.user_id = auth.uid()));
create policy "analyses: track owner write" on public.track_analyses for insert
  with check (exists (select 1 from public.audio_tracks t where t.id = track_id and t.user_id = auth.uid()));

-- analyzer_sessions
create policy "az_sessions: own" on public.analyzer_sessions
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ring_buffer_exports
create policy "ring_exports: own" on public.ring_buffer_exports
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- bpm_detections: via track ownership
create policy "bpm: track owner" on public.bpm_detections for select
  using (exists (select 1 from public.audio_tracks t where t.id = track_id and t.user_id = auth.uid()));
create policy "bpm: track owner insert" on public.bpm_detections for insert
  with check (exists (select 1 from public.audio_tracks t where t.id = track_id and t.user_id = auth.uid()));

-- reference_sessions
create policy "ref_sessions: own" on public.reference_sessions
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- reference_slots: via session ownership
create policy "ref_slots: session owner" on public.reference_slots for select
  using (exists (select 1 from public.reference_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "ref_slots: session owner write" on public.reference_slots for all
  using (exists (select 1 from public.reference_sessions s where s.id = session_id and s.user_id = auth.uid()));

-- reference_comparisons: via session ownership
create policy "ref_comps: session owner" on public.reference_comparisons for all
  using (exists (select 1 from public.reference_sessions s where s.id = session_id and s.user_id = auth.uid()));

-- media_items
create policy "media: own" on public.media_items
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- visual_presets
create policy "presets: own" on public.visual_presets
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- visual_sessions
create policy "vis_sessions: own" on public.visual_sessions
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- canvas_exports
create policy "canvas_exports: own" on public.canvas_exports
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- sessions
create policy "sessions: own" on public.sessions
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- tags
create policy "tags: own" on public.tags
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- audio_track_tags: via track ownership
create policy "atags: own" on public.audio_track_tags for all
  using (exists (select 1 from public.audio_tracks t where t.id = track_id and t.user_id = auth.uid()));

-- media_item_tags: via media ownership
create policy "mtags: own" on public.media_item_tags for all
  using (exists (select 1 from public.media_items m where m.id = media_id and m.user_id = auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════════
-- G. STORAGE BUCKETS
-- ═══════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('audio-tracks',   'audio-tracks',   false, 524288000,  -- 500 MB
   array['audio/mpeg','audio/wav','audio/x-wav','audio/aiff','audio/x-aiff',
         'audio/flac','audio/ogg','audio/mp4','audio/x-m4a']),
  ('media-items',    'media-items',    false, 209715200,  -- 200 MB
   array['image/jpeg','image/png','image/gif','image/webp',
         'video/mp4','video/webm','video/quicktime']),
  ('ring-buffers',   'ring-buffers',   false, 104857600,  -- 100 MB
   array['audio/wav','audio/x-wav']),
  ('canvas-exports', 'canvas-exports', false, 104857600,  -- 100 MB
   array['image/png','image/jpeg','video/webm','image/gif'])
on conflict (id) do nothing;

-- Storage RLS: users can read/write only their own paths (path starts with user_id/)
create policy "audio storage: own"   on storage.objects for all
  using (bucket_id = 'audio-tracks'   and auth.uid()::text = (storage.foldername(name))[1]);
create policy "media storage: own"   on storage.objects for all
  using (bucket_id = 'media-items'    and auth.uid()::text = (storage.foldername(name))[1]);
create policy "ring storage: own"    on storage.objects for all
  using (bucket_id = 'ring-buffers'   and auth.uid()::text = (storage.foldername(name))[1]);
create policy "canvas storage: own"  on storage.objects for all
  using (bucket_id = 'canvas-exports' and auth.uid()::text = (storage.foldername(name))[1]);
