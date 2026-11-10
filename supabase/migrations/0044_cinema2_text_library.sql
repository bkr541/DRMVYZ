-- Account-owned reusable Cinema 2.0 text scenes. Independent of projects and media.
create table public.cinema2_saved_text (
  user_id uuid not null references public.profiles(id) on delete cascade,
  preset_id text not null check (preset_id in ('drmvyz.cinema2.say-it','drmvyz.cinema2.marquee','drmvyz.cinema2.nightshift')),
  id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 100),
  schema_version integer not null default 1 check (schema_version = 1),
  parameters jsonb not null check (jsonb_typeof(parameters) = 'object' and octet_length(parameters::text) <= 32768),
  created_at timestamptz not null default now(),
  primary key (user_id, preset_id, id)
);
create table public.cinema2_text_pools (
  user_id uuid not null references public.profiles(id) on delete cascade,
  preset_id text not null check (preset_id in ('drmvyz.cinema2.say-it','drmvyz.cinema2.marquee','drmvyz.cinema2.nightshift')),
  id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  primary key (user_id, preset_id, id)
);
create table public.cinema2_text_pool_entries (
  user_id uuid not null,
  preset_id text not null,
  pool_id uuid not null,
  record_id uuid not null,
  primary key (user_id, preset_id, pool_id, record_id),
  foreign key (user_id, preset_id, pool_id) references public.cinema2_text_pools(user_id, preset_id, id) on delete cascade,
  foreign key (user_id, preset_id, record_id) references public.cinema2_saved_text(user_id, preset_id, id) on delete cascade
);
create index cinema2_text_pool_entries_record_idx on public.cinema2_text_pool_entries(user_id, preset_id, record_id);

alter table public.cinema2_saved_text enable row level security;
alter table public.cinema2_text_pools enable row level security;
alter table public.cinema2_text_pool_entries enable row level security;
create policy cinema2_saved_text_select on public.cinema2_saved_text for select to authenticated using (auth.uid() = user_id);
create policy cinema2_saved_text_insert on public.cinema2_saved_text for insert to authenticated with check (auth.uid() = user_id);
create policy cinema2_text_pools_select on public.cinema2_text_pools for select to authenticated using (auth.uid() = user_id);
create policy cinema2_text_pools_insert on public.cinema2_text_pools for insert to authenticated with check (auth.uid() = user_id);
create policy cinema2_text_pool_entries_select on public.cinema2_text_pool_entries for select to authenticated using (auth.uid() = user_id);
create policy cinema2_text_pool_entries_insert on public.cinema2_text_pool_entries for insert to authenticated with check (auth.uid() = user_id);
-- MVP operations are append-only; edits/deletes will receive explicit policies when introduced.
revoke all on public.cinema2_saved_text, public.cinema2_text_pools, public.cinema2_text_pool_entries from anon, authenticated;
grant select, insert on public.cinema2_saved_text, public.cinema2_text_pools, public.cinema2_text_pool_entries to authenticated;
