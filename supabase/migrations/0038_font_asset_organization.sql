-- Add the same lightweight organization metadata used by the Media Manager to
-- uploaded fonts. Collection IDs reference the user's media collections; the
-- application validates ownership when presenting and editing memberships.

alter table public.font_assets
  add column if not exists tags text[] not null default array[]::text[],
  add column if not exists collection_ids uuid[] not null default array[]::uuid[];

create index if not exists idx_font_assets_tags
  on public.font_assets using gin(tags);

create index if not exists idx_font_assets_collection_ids
  on public.font_assets using gin(collection_ids);
