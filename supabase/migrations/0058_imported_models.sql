-- Imported 3D models. A model is either 'generated' (traced from an image: GLB + source snapshot + SVG trace + recipe, as before) or
-- 'imported' (a GLB the user already made: the original bytes, an optional thumbnail and measured stats, nothing else). Versions stay
-- immutable and private, and every write still goes through begin/publish/cancel so Storage and the database cannot drift apart.
-- Everything here is additive: existing rows are 'generated' and keep their exact shape.
begin;

alter table public.model_assets
  add column kind text not null default 'generated' check (kind in ('generated', 'imported'));

alter table public.model_version_operations
  add column kind text not null default 'generated' check (kind in ('generated', 'imported')),
  alter column source_extension drop not null,
  alter column generator_recipe drop not null;
alter table public.model_version_operations add constraint model_operations_kind_shape check (
  (kind = 'generated' and source_extension is not null and generator_recipe is not null)
  or (kind = 'imported' and source_extension is null and generator_recipe is null)
);

alter table public.model_asset_versions
  alter column source_snapshot_path drop not null,
  alter column trace_svg_path drop not null,
  alter column generator_recipe drop not null;
alter table public.model_asset_versions add constraint model_versions_kind_shape check (
  (source_snapshot_path is not null and trace_svg_path is not null and generator_recipe is not null)
  or (source_snapshot_path is null and trace_svg_path is null and generator_recipe is null)
);

-- The client chooses the kind only when it creates the draft; it can never change it afterwards (update grants stay name/description/favorite).
grant insert (kind) on public.model_assets to authenticated;

-- The one place that says which Storage objects belong to an operation (used by the write policy, publish, cancel and delete).
create or replace function public.model_operation_paths(p public.model_version_operations, p_user uuid) returns text[]
language sql immutable set search_path = '' as $$
  select case when p.kind = 'imported'
      then array[root || '/model.glb']
      else array[root || '/model.glb', root || '/source.' || p.source_extension, root || '/trace.svg']
    end
    || case when p.has_thumbnail then array[root || '/thumbnail.png'] else array[]::text[] end
  from (select p_user::text || '/' || p.model_asset_id::text || '/' || (p.expected_version + 1)::text || '/' || p.id::text as root) s
$$;

-- New signature: the generated-only inputs are optional and the kind defaults to 'generated', so existing callers keep working by name.
drop function public.begin_model_version(uuid, uuid, integer, text, boolean, jsonb, jsonb);
create function public.begin_model_version(
  p_model_id uuid, p_operation_id uuid, p_expected_version integer, p_has_thumbnail boolean, p_stats jsonb,
  p_source_extension text default null, p_recipe jsonb default null, p_kind text default 'generated'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.model_assets; o public.model_version_operations;
begin
  a := public.model_lock_owned(p_model_id);
  if a.status = 'deletion_pending' then raise exception 'Model deletion is pending' using errcode = '23514'; end if;
  if p_expected_version is null or p_operation_id is null or p_has_thumbnail is null or p_stats is null or jsonb_typeof(p_stats) <> 'object'
     or p_kind is null or p_kind not in ('generated', 'imported')
  then raise exception 'Invalid model save input' using errcode = '23514'; end if;
  if a.kind <> p_kind then raise exception 'Model kind mismatch' using errcode = '23514'; end if;
  if p_kind = 'generated' then
    if p_source_extension is null or p_source_extension not in ('png', 'svg') or p_recipe is null
       or jsonb_typeof(p_recipe) <> 'object' or p_recipe->>'schemaVersion' is distinct from '1'
    then raise exception 'Invalid model save input' using errcode = '23514'; end if;
  elsif p_source_extension is not null or p_recipe is not null then
    raise exception 'Invalid model save input' using errcode = '23514';
  end if;
  select * into o from public.model_version_operations where id = p_operation_id;
  if found then
    if o.model_asset_id <> p_model_id or o.expected_version <> p_expected_version or o.kind <> p_kind
       or o.source_extension is distinct from p_source_extension or o.has_thumbnail <> p_has_thumbnail
       or o.generator_recipe is distinct from p_recipe or o.geometry_stats <> p_stats
    then raise exception 'Operation identity already used' using errcode = '23514'; end if;
    return to_jsonb(o);
  end if;
  if a.current_version <> p_expected_version then raise exception 'Model version conflict' using errcode = '40001'; end if;
  insert into public.model_version_operations(id, model_asset_id, expected_version, kind, source_extension, has_thumbnail, generator_recipe, geometry_stats)
    values (p_operation_id, p_model_id, p_expected_version, p_kind, p_source_extension, p_has_thumbnail, p_recipe, p_stats) returning * into o;
  return to_jsonb(o);
end $$;
revoke all on function public.begin_model_version(uuid, uuid, integer, boolean, jsonb, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.begin_model_version(uuid, uuid, integer, boolean, jsonb, text, jsonb, text) to authenticated;

create or replace function public.publish_model_version(p_operation_id uuid) returns jsonb
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
    expected_mime := case when paths[i] like '%/model.glb' then 'model/gltf-binary'
      when paths[i] like '%/source.png' or paths[i] like '%/thumbnail.png' then 'image/png' else 'image/svg+xml' end;
    if not exists (select 1 from storage.objects where bucket_id = 'model-assets' and name = paths[i]
      and metadata->>'mimetype' = expected_mime and (metadata->>'size')::bigint between 1 and 67108864)
    then raise exception 'Required model object missing or invalid' using errcode = '23514'; end if;
  end loop;
  insert into public.model_asset_versions(model_asset_id, version, operation_id, glb_path, source_snapshot_path, trace_svg_path, thumbnail_path, generator_recipe, geometry_stats)
    values (a.id, o.expected_version + 1, o.id, paths[1],
      case when o.kind = 'generated' then paths[2] end, case when o.kind = 'generated' then paths[3] end,
      case when o.has_thumbnail then paths[cardinality(paths)] end, o.generator_recipe, o.geometry_stats) returning * into v;
  update public.model_version_operations set state = 'published' where id = o.id;
  update public.model_assets set current_version = v.version, status = 'ready' where id = a.id;
  return to_jsonb(v);
end $$;

commit;
