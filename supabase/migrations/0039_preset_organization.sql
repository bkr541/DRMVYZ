-- User-authored preset tags and collection memberships. These deliberately
-- remain separate from built-in preset discovery metadata and from media-item
-- membership, so presets never appear as items in Media Manager collections.

create table if not exists public.preset_organization (
  user_id uuid not null references public.profiles(id) on delete cascade,
  preset_key text not null,
  tags text[] not null default array[]::text[],
  collection_ids uuid[] not null default array[]::uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, preset_key),
  constraint preset_organization_key_check check (length(btrim(preset_key)) between 1 and 300),
  constraint preset_organization_tags_count_check check (cardinality(tags) <= 64),
  constraint preset_organization_collections_count_check check (cardinality(collection_ids) <= 64)
);

create index if not exists idx_preset_organization_tags
  on public.preset_organization using gin(tags);

create index if not exists idx_preset_organization_collection_ids
  on public.preset_organization using gin(collection_ids);

drop trigger if exists trg_preset_organization_updated_at on public.preset_organization;
create trigger trg_preset_organization_updated_at
  before update on public.preset_organization
  for each row execute function public.set_updated_at();

alter table public.preset_organization enable row level security;

drop policy if exists "preset_organization: own select" on public.preset_organization;
create policy "preset_organization: own select"
  on public.preset_organization for select
  using (auth.uid() = user_id);

drop policy if exists "preset_organization: own insert" on public.preset_organization;
create policy "preset_organization: own insert"
  on public.preset_organization for insert
  with check (auth.uid() = user_id);

drop policy if exists "preset_organization: own update" on public.preset_organization;
create policy "preset_organization: own update"
  on public.preset_organization for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "preset_organization: own delete" on public.preset_organization;
create policy "preset_organization: own delete"
  on public.preset_organization for delete
  using (auth.uid() = user_id);
