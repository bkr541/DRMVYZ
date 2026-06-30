-- Personalization Patch 1: Brand Kit persistence, ownership, and SVG storage support.

create table if not exists public.brand_kits (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  name                  text not null check (char_length(btrim(name)) between 1 and 120),
  palette               jsonb not null default '{"primary":"#19BFF2","secondary":"#7C5CFC","accent":"#00E0A4","background":"#080B12","highlight":"#FFFFFF","text":"#FFFFFF"}'::jsonb check (jsonb_typeof(palette) = 'object'),
  extracted_palette     jsonb not null default '{}'::jsonb check (jsonb_typeof(extracted_palette) = 'object'),
  extraction_metadata   jsonb not null default '{}'::jsonb check (jsonb_typeof(extraction_metadata) = 'object'),
  default_strength      numeric(4,3) not null default 0.75 check (default_strength between 0 and 1),
  engine_rules          jsonb not null default '{}'::jsonb check (jsonb_typeof(engine_rules) = 'object'),
  preset_rules          jsonb not null default '{}'::jsonb check (jsonb_typeof(preset_rules) = 'object'),
  use_for_app_accent    boolean not null default false,
  auto_apply            boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

select add_updated_at_trigger('brand_kits');

create table if not exists public.brand_kit_assets (
  id                  uuid primary key default uuid_generate_v4(),
  brand_kit_id        uuid not null references public.brand_kits(id) on delete cascade,
  media_item_id       uuid not null references public.media_items(id) on delete cascade,
  asset_role          text not null check (asset_role in (
    'primaryLogo', 'secondaryLogo', 'wordmark', 'monogram', 'keyArt',
    'watermark', 'texture', 'background', 'paletteSource'
  )),
  sort_order          integer not null default 0 check (sort_order >= 0),
  is_palette_source   boolean not null default false,
  presentation        jsonb check (presentation is null or jsonb_typeof(presentation) = 'object'),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (brand_kit_id, media_item_id, asset_role)
);

select add_updated_at_trigger('brand_kit_assets');

alter table public.user_settings
  add column if not exists active_brand_kit_id uuid;

alter table public.user_settings
  drop constraint if exists user_settings_active_brand_kit_id_fkey;

alter table public.user_settings
  add constraint user_settings_active_brand_kit_id_fkey
  foreign key (active_brand_kit_id) references public.brand_kits(id) on delete set null;

create index if not exists idx_brand_kits_user_updated
  on public.brand_kits(user_id, updated_at desc);
create index if not exists idx_brand_kit_assets_kit_sort
  on public.brand_kit_assets(brand_kit_id, sort_order, created_at);
create index if not exists idx_brand_kit_assets_media
  on public.brand_kit_assets(media_item_id);
create index if not exists idx_user_settings_active_brand_kit
  on public.user_settings(active_brand_kit_id) where active_brand_kit_id is not null;

alter table public.brand_kits enable row level security;
alter table public.brand_kit_assets enable row level security;

create policy "brand kits: own select" on public.brand_kits for select
  using (auth.uid() = user_id);
create policy "brand kits: own insert" on public.brand_kits for insert
  with check (auth.uid() = user_id);
create policy "brand kits: own update" on public.brand_kits for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "brand kits: own delete" on public.brand_kits for delete
  using (auth.uid() = user_id);

create policy "brand kit assets: own select" on public.brand_kit_assets for select
  using (
    exists (
      select 1 from public.brand_kits kit
      where kit.id = brand_kit_id and kit.user_id = auth.uid()
    )
    and exists (
      select 1 from public.media_items media
      where media.id = media_item_id and media.user_id = auth.uid()
    )
  );

create policy "brand kit assets: own insert" on public.brand_kit_assets for insert
  with check (
    exists (
      select 1 from public.brand_kits kit
      where kit.id = brand_kit_id and kit.user_id = auth.uid()
    )
    and exists (
      select 1 from public.media_items media
      where media.id = media_item_id and media.user_id = auth.uid()
    )
  );

create policy "brand kit assets: own update" on public.brand_kit_assets for update
  using (
    exists (
      select 1 from public.brand_kits kit
      where kit.id = brand_kit_id and kit.user_id = auth.uid()
    )
    and exists (
      select 1 from public.media_items media
      where media.id = media_item_id and media.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.brand_kits kit
      where kit.id = brand_kit_id and kit.user_id = auth.uid()
    )
    and exists (
      select 1 from public.media_items media
      where media.id = media_item_id and media.user_id = auth.uid()
    )
  );

create policy "brand kit assets: own delete" on public.brand_kit_assets for delete
  using (
    exists (
      select 1 from public.brand_kits kit
      where kit.id = brand_kit_id and kit.user_id = auth.uid()
    )
    and exists (
      select 1 from public.media_items media
      where media.id = media_item_id and media.user_id = auth.uid()
    )
  );

-- Prevent an owned user_settings row from pointing at another user's kit.
drop policy if exists "settings: own all" on public.user_settings;
create policy "settings: own select" on public.user_settings for select
  using (auth.uid() = user_id);
create policy "settings: own insert" on public.user_settings for insert
  with check (
    auth.uid() = user_id
    and (
      active_brand_kit_id is null
      or exists (
        select 1 from public.brand_kits kit
        where kit.id = active_brand_kit_id and kit.user_id = auth.uid()
      )
    )
  );
create policy "settings: own update" on public.user_settings for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      active_brand_kit_id is null
      or exists (
        select 1 from public.brand_kits kit
        where kit.id = active_brand_kit_id and kit.user_id = auth.uid()
      )
    )
  );
create policy "settings: own delete" on public.user_settings for delete
  using (auth.uid() = user_id);

-- Add SVG without recreating the bucket or disturbing storage policies.
update storage.buckets
set allowed_mime_types = allowed_mime_types || array['image/svg+xml']
where id = 'media-items'
  and allowed_mime_types is not null
  and not ('image/svg+xml' = any(allowed_mime_types));
