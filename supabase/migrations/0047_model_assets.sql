-- Independent model domain. Files are staged under a unique operation directory;
-- only publish_model_version can advance current_version after verifying Storage.
begin;

create table public.model_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_media_id uuid references public.media_items(id) on delete set null,
  name text not null check (length(btrim(name)) between 1 and 200),
  description text check (description is null or length(description) between 1 and 4000),
  favorite boolean not null default false,
  current_version integer not null default 0 check (current_version >= 0),
  status text not null default 'draft' check (status in ('draft', 'ready', 'deletion_pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index model_assets_owner_page on public.model_assets(user_id, created_at desc, id desc);
create index model_assets_source on public.model_assets(source_media_id) where source_media_id is not null;

create table public.model_version_operations (
  id uuid primary key,
  model_asset_id uuid not null references public.model_assets(id) on delete cascade,
  expected_version integer not null check (expected_version between 0 and 2147483646),
  state text not null default 'uploading' check (state in ('uploading', 'published', 'cleanup_pending', 'cancelled')),
  source_extension text not null check (source_extension in ('png', 'svg')),
  has_thumbnail boolean not null,
  generator_recipe jsonb not null check (jsonb_typeof(generator_recipe) = 'object' and generator_recipe->>'schemaVersion' = '1'),
  geometry_stats jsonb not null check (jsonb_typeof(geometry_stats) = 'object'),
  created_at timestamptz not null default now()
);
create index model_operations_asset on public.model_version_operations(model_asset_id, state);

create table public.model_asset_versions (
  id uuid primary key default gen_random_uuid(),
  model_asset_id uuid not null references public.model_assets(id) on delete cascade,
  version integer not null check (version > 0),
  operation_id uuid not null unique references public.model_version_operations(id),
  glb_path text not null,
  source_snapshot_path text not null,
  trace_svg_path text not null,
  thumbnail_path text,
  generator_recipe jsonb not null,
  geometry_stats jsonb not null,
  created_at timestamptz not null default now(),
  unique (model_asset_id, version)
);

create table public.model_collection_items (
  collection_id uuid not null references public.media_collections(id) on delete cascade,
  model_asset_id uuid not null references public.model_assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, model_asset_id)
);
create index model_collections_asset on public.model_collection_items(model_asset_id);

-- This check runs even when RLS is bypassed by a privileged integration.
create function public.model_asset_owner_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.source_media_id is not null and not exists (
    select 1 from public.media_items where id = new.source_media_id and user_id = new.user_id and type = 'image'
  ) then raise exception 'Source image must belong to the model owner' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id or new.id <> old.id then
      raise exception 'Model identity is immutable' using errcode = '42501';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger model_asset_owner_guard before insert or update on public.model_assets
  for each row execute function public.model_asset_owner_guard();

create function public.model_collection_owner_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.model_assets a join public.media_collections c on c.user_id = a.user_id
    where a.id = new.model_asset_id and c.id = new.collection_id and a.status <> 'deletion_pending'
  ) then raise exception 'Model and collection owners must match' using errcode = '42501'; end if;
  return new;
end $$;
create trigger model_collection_owner_guard before insert or update on public.model_collection_items
  for each row execute function public.model_collection_owner_guard();

alter table public.model_assets enable row level security;
alter table public.model_asset_versions enable row level security;
alter table public.model_version_operations enable row level security;
alter table public.model_collection_items enable row level security;
create policy model_assets_select on public.model_assets for select to authenticated using (user_id = auth.uid());
create policy model_assets_insert on public.model_assets for insert to authenticated
  with check (user_id = auth.uid() and current_version = 0 and status = 'draft');
create policy model_assets_update on public.model_assets for update to authenticated
  using (user_id = auth.uid() and status <> 'deletion_pending') with check (user_id = auth.uid());
-- Deletes, lifecycle, versions and operations are RPC-only, even for the owner.
create policy model_versions_select on public.model_asset_versions for select to authenticated using (
  exists (select 1 from public.model_assets a where a.id = model_asset_id and a.user_id = auth.uid())
);
create policy model_operations_select on public.model_version_operations for select to authenticated using (
  exists (select 1 from public.model_assets a where a.id = model_asset_id and a.user_id = auth.uid())
);
create policy model_collections_select on public.model_collection_items for select to authenticated using (
  exists (select 1 from public.model_assets a where a.id = model_asset_id and a.user_id = auth.uid()) and
  exists (select 1 from public.media_collections c where c.id = collection_id and c.user_id = auth.uid())
);
create policy model_collections_insert on public.model_collection_items for insert to authenticated with check (
  exists (select 1 from public.model_assets a where a.id = model_asset_id and a.user_id = auth.uid() and a.status <> 'deletion_pending') and
  exists (select 1 from public.media_collections c where c.id = collection_id and c.user_id = auth.uid())
);
create policy model_collections_delete on public.model_collection_items for delete to authenticated using (
  exists (select 1 from public.model_assets a where a.id = model_asset_id and a.user_id = auth.uid()) and
  exists (select 1 from public.media_collections c where c.id = collection_id and c.user_id = auth.uid())
);

revoke all on public.model_assets, public.model_asset_versions, public.model_version_operations, public.model_collection_items from public, anon, authenticated;
grant select on public.model_assets, public.model_asset_versions, public.model_version_operations, public.model_collection_items to authenticated;
grant insert (id, user_id, source_media_id, name, description, favorite) on public.model_assets to authenticated;
grant update (name, description, favorite) on public.model_assets to authenticated;
grant insert, delete on public.model_collection_items to authenticated;

-- Internal helpers are not exposed to clients. All RPCs lock asset before operation.
create function public.model_lock_owned(p_id uuid) returns public.model_assets
language plpgsql security definer set search_path = '' as $$
declare a public.model_assets;
begin
  select * into a from public.model_assets where id = p_id for update;
  if auth.uid() is null or a.user_id is distinct from auth.uid() then
    raise exception 'Model unavailable or not owned' using errcode = '42501';
  end if;
  return a;
end $$;

create function public.model_operation_paths(p public.model_version_operations, p_user uuid) returns text[]
language sql immutable set search_path = '' as $$
  select array[
    root || '/model.glb', root || '/source.' || p.source_extension, root || '/trace.svg'
  ] || case when p.has_thumbnail then array[root || '/thumbnail.png'] else array[]::text[] end
  from (select p_user::text || '/' || p.model_asset_id::text || '/' || (p.expected_version + 1)::text || '/' || p.id::text as root) s
$$;

create function public.begin_model_version(
  p_model_id uuid, p_operation_id uuid, p_expected_version integer,
  p_source_extension text, p_has_thumbnail boolean, p_recipe jsonb, p_stats jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.model_assets; o public.model_version_operations;
begin
  a := public.model_lock_owned(p_model_id);
  if a.status = 'deletion_pending' then raise exception 'Model deletion is pending' using errcode = '23514'; end if;
  if p_expected_version is null or p_operation_id is null or p_source_extension is null or p_has_thumbnail is null
     or p_recipe is null or p_stats is null or p_recipe->>'schemaVersion' is distinct from '1'
     or jsonb_typeof(p_recipe) <> 'object' or jsonb_typeof(p_stats) <> 'object'
  then raise exception 'Invalid model save input' using errcode = '23514'; end if;
  select * into o from public.model_version_operations where id = p_operation_id;
  if found then
    if o.model_asset_id <> p_model_id or o.expected_version <> p_expected_version or o.source_extension <> p_source_extension
       or o.has_thumbnail <> p_has_thumbnail or o.generator_recipe <> p_recipe or o.geometry_stats <> p_stats
    then raise exception 'Operation identity already used' using errcode = '23514'; end if;
    return to_jsonb(o);
  end if;
  if a.current_version <> p_expected_version then raise exception 'Model version conflict' using errcode = '40001'; end if;
  insert into public.model_version_operations(id, model_asset_id, expected_version, source_extension, has_thumbnail, generator_recipe, geometry_stats)
    values (p_operation_id, p_model_id, p_expected_version, p_source_extension, p_has_thumbnail, p_recipe, p_stats) returning * into o;
  return to_jsonb(o);
end $$;

create function public.publish_model_version(p_operation_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.model_assets; o public.model_version_operations; v public.model_asset_versions;
  paths text[]; i integer; expected_mime text;
begin
  select * into o from public.model_version_operations where id = p_operation_id;
  a := public.model_lock_owned(o.model_asset_id);
  select * into o from public.model_version_operations where id = p_operation_id for update;
  if o.state = 'published' then
    select * into v from public.model_asset_versions where operation_id = o.id;
    return to_jsonb(v);
  end if;
  if o.state <> 'uploading' or a.status = 'deletion_pending' then raise exception 'Save is no longer publishable' using errcode = '23514'; end if;
  if a.current_version <> o.expected_version then raise exception 'Model version conflict' using errcode = '40001'; end if;
  paths := public.model_operation_paths(o, a.user_id);
  for i in 1..cardinality(paths) loop
    expected_mime := case when i = 1 then 'model/gltf-binary' when i = 2 and o.source_extension = 'png' then 'image/png' when i = 4 then 'image/png' else 'image/svg+xml' end;
    if not exists (select 1 from storage.objects where bucket_id = 'model-assets' and name = paths[i]
      and metadata->>'mimetype' = expected_mime and (metadata->>'size')::bigint between 1 and 67108864)
    then raise exception 'Required model object missing or invalid' using errcode = '23514'; end if;
  end loop;
  insert into public.model_asset_versions(model_asset_id, version, operation_id, glb_path, source_snapshot_path, trace_svg_path, thumbnail_path, generator_recipe, geometry_stats)
    values (a.id, o.expected_version + 1, o.id, paths[1], paths[2], paths[3], paths[4], o.generator_recipe, o.geometry_stats) returning * into v;
  update public.model_version_operations set state = 'published' where id = o.id;
  update public.model_assets set current_version = v.version, status = 'ready' where id = a.id;
  return to_jsonb(v);
end $$;

-- Calling cancel first reconciles an ambiguous publish response. A published
-- operation is returned unchanged and its files can never be rollback targets.
create function public.cancel_model_version(p_operation_id uuid, p_finalize boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.model_assets; o public.model_version_operations;
begin
  select * into o from public.model_version_operations where id = p_operation_id;
  a := public.model_lock_owned(o.model_asset_id);
  select * into o from public.model_version_operations where id = p_operation_id for update;
  if o.state = 'published' then return to_jsonb(o); end if;
  if p_finalize then
    if exists (select 1 from storage.objects where bucket_id = 'model-assets' and name = any(public.model_operation_paths(o, a.user_id)))
    then raise exception 'Model cleanup is incomplete' using errcode = '23514'; end if;
    update public.model_version_operations set state = 'cancelled' where id = o.id returning * into o;
  else
    update public.model_version_operations set state = case when state = 'cancelled' then state else 'cleanup_pending' end where id = o.id returning * into o;
  end if;
  return to_jsonb(o);
end $$;

create function public.request_model_deletion(p_model_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.model_lock_owned(p_model_id);
  update public.model_assets set status = 'deletion_pending' where id = p_model_id;
  update public.model_version_operations set state = 'cleanup_pending' where model_asset_id = p_model_id and state = 'uploading';
end $$;
create function public.finalize_model_deletion(p_model_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.model_assets;
begin
  a := public.model_lock_owned(p_model_id);
  if a.status <> 'deletion_pending' or exists (
    select 1 from storage.objects where bucket_id = 'model-assets' and name like a.user_id::text || '/' || a.id::text || '/%'
  ) then raise exception 'Model deletion cleanup is incomplete' using errcode = '23514'; end if;
  -- Versions reference operations, so delete them first inside the transaction.
  delete from public.model_asset_versions where model_asset_id = a.id;
  delete from public.model_assets where id = a.id;
end $$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('model-assets', 'model-assets', false, 67108864, array['model/gltf-binary', 'image/png', 'image/svg+xml']);

-- Locks serialize Storage writes with publication/cancellation/deletion. This
-- prevents a late upload or overwrite from racing a published immutable version.
create function public.model_storage_write_allowed(p_name text, p_action text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare a public.model_assets; o public.model_version_operations;
begin
  if auth.uid() is null or split_part(p_name, '/', 1) <> auth.uid()::text then return false; end if;
  select * into a from public.model_assets where id::text = split_part(p_name, '/', 2) and user_id = auth.uid() for update;
  if not found then return false; end if;
  select * into o from public.model_version_operations where model_asset_id = a.id and id::text = split_part(p_name, '/', 4) for update;
  if not found or not (p_name = any(public.model_operation_paths(o, a.user_id))) then return false; end if;
  if p_action = 'delete' then return a.status = 'deletion_pending' or o.state in ('cleanup_pending', 'cancelled'); end if;
  return p_action in ('insert', 'update') and a.status <> 'deletion_pending' and o.state = 'uploading';
end $$;
create policy model_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'model-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy model_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'model-assets' and (storage.foldername(name))[1] = auth.uid()::text and public.model_storage_write_allowed(name, 'insert'));
create policy model_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'model-assets' and (storage.foldername(name))[1] = auth.uid()::text and public.model_storage_write_allowed(name, 'update'))
  with check (bucket_id = 'model-assets' and (storage.foldername(name))[1] = auth.uid()::text and public.model_storage_write_allowed(name, 'update'));
create policy model_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'model-assets' and (storage.foldername(name))[1] = auth.uid()::text and public.model_storage_write_allowed(name, 'delete'));

revoke all on function public.model_asset_owner_guard(), public.model_collection_owner_guard(), public.model_lock_owned(uuid), public.model_operation_paths(public.model_version_operations, uuid) from public, anon, authenticated;
revoke all on function public.begin_model_version(uuid, uuid, integer, text, boolean, jsonb, jsonb), public.publish_model_version(uuid), public.cancel_model_version(uuid, boolean), public.request_model_deletion(uuid), public.finalize_model_deletion(uuid), public.model_storage_write_allowed(text, text) from public, anon, authenticated;
grant execute on function public.begin_model_version(uuid, uuid, integer, text, boolean, jsonb, jsonb), public.publish_model_version(uuid), public.cancel_model_version(uuid, boolean), public.request_model_deletion(uuid), public.finalize_model_deletion(uuid), public.model_storage_write_allowed(text, text) to authenticated;
commit;
