-- Migration: 0005_media_organization
-- Adds organization fields to media_items.
-- Creates media_tags, media_item_tags, media_collections, media_collection_items.

-- ── 1. Extend media_items ─────────────────────────────────────────────────────

alter table public.media_items
  add column if not exists media_role  text not null default 'other',
  add column if not exists title       text,
  add column if not exists description text,
  add column if not exists metadata    jsonb not null default '{}'::jsonb;

-- Role check constraint (safe: drop then re-add)
alter table public.media_items
  drop constraint if exists media_items_media_role_check;
alter table public.media_items
  add constraint media_items_media_role_check check (
    media_role in (
      'background_image','background_video','logo','transparent_element',
      'overlay','character_art','texture','loop','transition','reference','other'
    )
  );

-- ── 2. media_tags ─────────────────────────────────────────────────────────────

drop table if exists public.media_tags cascade;

create table public.media_tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.media_tags enable row level security;

drop policy if exists "media_tags: own" on public.media_tags;
create policy "media_tags: own"
  on public.media_tags for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 3. media_item_tags ────────────────────────────────────────────────────────
-- Drop old table that had (media_id, tag_id) referencing public.tags.
-- New table uses media_item_id and references the new media_tags table.

drop table if exists public.media_item_tags cascade;

create table public.media_item_tags (
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  tag_id        uuid not null references public.media_tags(id)  on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (media_item_id, tag_id)
);

alter table public.media_item_tags enable row level security;

drop policy if exists "media_item_tags: own" on public.media_item_tags;
create policy "media_item_tags: own"
  on public.media_item_tags for all
  using (
    exists (select 1 from public.media_items m where m.id = media_item_tags.media_item_id and m.user_id = auth.uid()) and
    exists (select 1 from public.media_tags  t where t.id = media_item_tags.tag_id        and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.media_items m where m.id = media_item_tags.media_item_id and m.user_id = auth.uid()) and
    exists (select 1 from public.media_tags  t where t.id = media_item_tags.tag_id        and t.user_id = auth.uid())
  );

-- ── 4. media_collections ─────────────────────────────────────────────────────

drop table if exists public.media_collections cascade;

create table public.media_collections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.media_collections enable row level security;

drop policy if exists "media_collections: own" on public.media_collections;
create policy "media_collections: own"
  on public.media_collections for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 5. media_collection_items ─────────────────────────────────────────────────

drop table if exists public.media_collection_items cascade;

create table public.media_collection_items (
  collection_id uuid not null references public.media_collections(id) on delete cascade,
  media_item_id uuid not null references public.media_items(id)       on delete cascade,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  primary key (collection_id, media_item_id)
);

alter table public.media_collection_items enable row level security;

drop policy if exists "media_collection_items: own" on public.media_collection_items;
create policy "media_collection_items: own"
  on public.media_collection_items for all
  using (
    exists (select 1 from public.media_collections c where c.id = media_collection_items.collection_id and c.user_id = auth.uid()) and
    exists (select 1 from public.media_items       m where m.id = media_collection_items.media_item_id and m.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.media_collections c where c.id = media_collection_items.collection_id and c.user_id = auth.uid()) and
    exists (select 1 from public.media_items       m where m.id = media_collection_items.media_item_id and m.user_id = auth.uid())
  );

-- ── 6. Indexes ────────────────────────────────────────────────────────────────

create index if not exists idx_media_items_user_role       on public.media_items(user_id, media_role);
create index if not exists idx_media_items_user_favorite   on public.media_items(user_id, favorite);
create index if not exists idx_media_tags_user_name        on public.media_tags(user_id, name);
create index if not exists idx_media_collections_user_name on public.media_collections(user_id, name);
create index if not exists idx_media_coll_items_sort       on public.media_collection_items(collection_id, sort_order);
