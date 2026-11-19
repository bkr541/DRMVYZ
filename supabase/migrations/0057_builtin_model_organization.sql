begin;

create table public.builtin_model_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  model_key text not null,
  tag_id uuid not null references public.media_tags(id) on delete cascade,
  primary key (user_id, model_key, tag_id)
);
create index builtin_model_tags_tag on public.builtin_model_tags(tag_id);

create table public.builtin_model_collection_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  model_key text not null,
  collection_id uuid not null references public.media_collections(id) on delete cascade,
  primary key (user_id, model_key, collection_id)
);
create index builtin_model_collection_items_collection on public.builtin_model_collection_items(collection_id, user_id);

alter table public.builtin_model_tags enable row level security;
alter table public.builtin_model_collection_items enable row level security;
create policy builtin_model_tags_owner_read on public.builtin_model_tags for select to authenticated using (user_id = auth.uid());
create policy builtin_model_collections_owner_read on public.builtin_model_collection_items for select to authenticated using (user_id = auth.uid());
revoke all on public.builtin_model_tags, public.builtin_model_collection_items from public, anon, authenticated;
grant select on public.builtin_model_tags, public.builtin_model_collection_items to authenticated;

create function public.get_builtin_model_organization(p_model_key text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'tags', coalesce((select jsonb_agg(t.name order by t.name) from public.builtin_model_tags m
      join public.media_tags t on t.id = m.tag_id and t.user_id = m.user_id
      where m.user_id = auth.uid() and m.model_key = p_model_key), '[]'::jsonb),
    'collection_ids', coalesce((select jsonb_agg(m.collection_id order by m.collection_id) from public.builtin_model_collection_items m
      join public.media_collections c on c.id = m.collection_id and c.user_id = m.user_id
      where m.user_id = auth.uid() and m.model_key = p_model_key), '[]'::jsonb)
  )
$$;

create function public.update_builtin_model_organization(p_owner_id uuid, p_model_key text, p_tags text[], p_collection_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null or owner_id is distinct from p_owner_id then
    raise exception 'Sign in to organize models' using errcode = '42501';
  end if;
  if p_model_key is null or p_model_key !~ '^builtin-[a-z0-9-]{1,110}$'
    or p_tags is null or cardinality(p_tags) > 32
    or p_collection_ids is null or cardinality(p_collection_ids) > 100
    or exists (select 1 from unnest(p_tags) t where t is null or length(btrim(t)) not between 1 and 64 or public.normalize_media_tag(t) = '')
    or exists (select 1 from unnest(p_collection_ids) c where c is null or not exists (
      select 1 from public.media_collections owned where owned.id = c and owned.user_id = owner_id))
  then raise exception 'Invalid model organization or foreign collection' using errcode = '23514'; end if;

  -- Serialize replacements for this user's model, including the first assignment.
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text || ':' || p_model_key, 0));
  perform 1 from public.media_collections where id = any(p_collection_ids) and user_id = owner_id order by id for key share;
  delete from public.builtin_model_collection_items where user_id = owner_id and model_key = p_model_key;
  insert into public.builtin_model_collection_items(user_id, model_key, collection_id)
    select distinct owner_id, p_model_key, c from unnest(p_collection_ids) c;

  insert into public.media_tags(user_id, name)
    select owner_id, t from unnest(public.normalize_media_tag_list(p_tags)) t order by t
    on conflict(user_id, name) do nothing;
  delete from public.builtin_model_tags where user_id = owner_id and model_key = p_model_key;
  insert into public.builtin_model_tags(user_id, model_key, tag_id)
    select owner_id, p_model_key, id from public.media_tags
    where user_id = owner_id and name = any(public.normalize_media_tag_list(p_tags));

  return public.get_builtin_model_organization(p_model_key);
end $$;

revoke all on function public.get_builtin_model_organization(text), public.update_builtin_model_organization(uuid, text, text[], uuid[]) from public, anon, authenticated;
grant execute on function public.get_builtin_model_organization(text), public.update_builtin_model_organization(uuid, text, text[], uuid[]) to authenticated;
commit;
