-- Model tags share the existing owned media-tag vocabulary. Metadata and model
-- collection membership update together; no versioned geometry row is modified.
begin;
create table public.model_asset_tags (
  model_asset_id uuid not null references public.model_assets(id) on delete cascade,
  tag_id uuid not null references public.media_tags(id) on delete cascade,
  primary key(model_asset_id, tag_id)
);
create index model_asset_tags_tag on public.model_asset_tags(tag_id);
create function public.model_tag_owner_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.model_assets a join public.media_tags t on t.user_id = a.user_id where a.id = new.model_asset_id and t.id = new.tag_id)
  then raise exception 'Model and tag owners must match' using errcode = '42501'; end if;
  return new;
end $$;
create trigger model_tag_owner_guard before insert or update on public.model_asset_tags for each row execute function public.model_tag_owner_guard();
revoke all on function public.model_tag_owner_guard() from public, anon, authenticated;
alter table public.model_asset_tags enable row level security;
create policy model_tags_select on public.model_asset_tags for select to authenticated using (
  exists(select 1 from public.model_assets a where a.id = model_asset_id and a.user_id = auth.uid()) and
  exists(select 1 from public.media_tags t where t.id = tag_id and t.user_id = auth.uid())
);
revoke all on public.model_asset_tags from public, anon, authenticated;
grant select on public.model_asset_tags to authenticated;

create function public.get_model_organization(p_model_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.model_assets where id = p_model_id and user_id = auth.uid())
  then raise exception 'Model unavailable or not owned' using errcode = '42501'; end if;
  return jsonb_build_object(
    'tags', coalesce((select jsonb_agg(t.name order by t.name) from public.model_asset_tags m join public.media_tags t on t.id = m.tag_id where m.model_asset_id = p_model_id and t.user_id = auth.uid()), '[]'::jsonb),
    'collection_ids', coalesce((select jsonb_agg(m.collection_id order by m.collection_id) from public.model_collection_items m where m.model_asset_id = p_model_id), '[]'::jsonb)
  );
end $$;

create function public.update_model_metadata(
  p_model_id uuid, p_expected_version integer, p_name text, p_description text,
  p_favorite boolean, p_tags text[], p_collection_ids uuid[]
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.model_assets; tag_name text; tag_uuid uuid; organization jsonb;
begin
  a := public.model_lock_owned(p_model_id);
  if a.status = 'deletion_pending' then raise exception 'Model deletion is pending' using errcode = '23514'; end if;
  if p_expected_version is null or a.current_version <> p_expected_version then raise exception 'Model version conflict' using errcode = '40001'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 200 or p_favorite is null
    or (p_description is not null and length(p_description) > 4000)
    or p_tags is null or cardinality(p_tags) > 32 or p_collection_ids is null or cardinality(p_collection_ids) > 100
    or exists(select 1 from unnest(p_tags) t where t is null or length(btrim(t)) not between 1 and 64)
    or exists(select 1 from unnest(p_collection_ids) c where c is null or not exists(select 1 from public.media_collections m where m.id = c and m.user_id = auth.uid()))
  then raise exception 'Invalid model metadata or foreign collection' using errcode = '23514'; end if;
  perform 1 from public.media_collections where id = any(p_collection_ids) order by id for update;
  update public.model_assets set name = btrim(p_name), description = nullif(p_description, ''), favorite = p_favorite where id = a.id returning * into a;
  delete from public.model_collection_items where model_asset_id = a.id;
  insert into public.model_collection_items(collection_id, model_asset_id) select distinct c, a.id from unnest(p_collection_ids) c;
  delete from public.model_asset_tags where model_asset_id = a.id;
  for tag_name in select distinct btrim(t) from unnest(p_tags) t order by btrim(t) loop
    insert into public.media_tags(user_id, name) values(auth.uid(), tag_name) on conflict(user_id, name) do nothing;
    select id into tag_uuid from public.media_tags where user_id = auth.uid() and name = tag_name;
    insert into public.model_asset_tags(model_asset_id, tag_id) values(a.id, tag_uuid);
  end loop;
  organization := public.get_model_organization(a.id);
  return jsonb_build_object('asset', to_jsonb(a), 'organization', organization);
end $$;
revoke all on function public.get_model_organization(uuid), public.update_model_metadata(uuid, integer, text, text, boolean, text[], uuid[]) from public, anon, authenticated;
grant execute on function public.get_model_organization(uuid), public.update_model_metadata(uuid, integer, text, text, boolean, text[], uuid[]) to authenticated;
commit;
