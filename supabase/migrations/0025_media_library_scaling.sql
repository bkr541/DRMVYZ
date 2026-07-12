-- Migration: 0025_media_library_scaling
-- Stable cursor paging for the single canonical media library. Relationship
-- arrays are hydrated in the page query so clients do not issue N+1 requests.

create index if not exists idx_media_items_library_cursor
  on public.media_items (user_id, lifecycle_status, created_at desc, id desc);
create index if not exists idx_media_items_library_filter
  on public.media_items (user_id, lifecycle_status, media_role, type, favorite);
create index if not exists idx_media_item_tags_media_item
  on public.media_item_tags (media_item_id, tag_id);
create index if not exists idx_media_collection_items_media
  on public.media_collection_items (media_item_id, collection_id);

create or replace function public.list_media_library_page(
  p_limit integer default 48,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_search text default '',
  p_filter text default 'all',
  p_scope text default 'all',
  p_collection_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 48), 100));
  v_search text := lower(btrim(coalesce(p_search, '')));
  v_result jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'authorization_failure', 'message', 'Authentication is required.');
  end if;

  if p_filter not in ('all', 'images', 'videos', 'favorites', 'backgrounds', 'logos', 'transparent', 'overlays', 'svg') then
    return jsonb_build_object('status', 'validation_failure', 'message', 'Unsupported media library filter.');
  end if;

  if p_scope not in ('all', 'react') then
    return jsonb_build_object('status', 'validation_failure', 'message', 'Unsupported media library scope.');
  end if;

  if (p_cursor_created_at is null) <> (p_cursor_id is null) then
    return jsonb_build_object('status', 'validation_failure', 'message', 'The media cursor is incomplete.');
  end if;

  if p_collection_id is not null and not exists (
    select 1 from public.media_collections c where c.id = p_collection_id and c.user_id = v_user_id
  ) then
    return jsonb_build_object('status', 'authorization_failure', 'message', 'The selected collection is unavailable.');
  end if;

  with filtered as (
    select
      m.*,
      coalesce((
        select jsonb_agg(t.name order by lower(t.name), t.name)
        from public.media_item_tags mit
        join public.media_tags t on t.id = mit.tag_id
        where mit.media_item_id = m.id and t.user_id = v_user_id
      ), '[]'::jsonb) as tags,
      coalesce((
        select jsonb_agg(mci.collection_id order by mci.sort_order, mci.collection_id)
        from public.media_collection_items mci
        join public.media_collections c on c.id = mci.collection_id
        where mci.media_item_id = m.id and c.user_id = v_user_id
      ), '[]'::jsonb) as collection_ids
    from public.media_items m
    where m.user_id = v_user_id
      and m.lifecycle_status = 'complete'
      and (p_cursor_created_at is null or (m.created_at, m.id) < (p_cursor_created_at, p_cursor_id))
      and (
        p_collection_id is null or exists (
          select 1
          from public.media_collection_items selected_mci
          join public.media_collections selected_c on selected_c.id = selected_mci.collection_id
          where selected_mci.media_item_id = m.id
            and selected_mci.collection_id = p_collection_id
            and selected_c.user_id = v_user_id
        )
      )
      and (
        p_scope = 'all'
        or m.media_role in ('svg', 'logo', 'transparent_element', 'overlay')
        or lower(coalesce(m.mime_type, '')) = 'image/svg+xml'
        or lower(m.storage_path) like '%.svg'
      )
      and (
        p_filter = 'all'
        or (p_filter = 'images' and m.type = 'image')
        or (p_filter = 'videos' and m.type = 'video')
        or (p_filter = 'favorites' and m.favorite)
        or (p_filter = 'backgrounds' and m.media_role in ('background_image', 'background_video'))
        or (p_filter = 'logos' and m.media_role = 'logo')
        or (p_filter = 'transparent' and m.media_role = 'transparent_element')
        or (p_filter = 'overlays' and m.media_role = 'overlay')
        or (p_filter = 'svg' and (
          m.media_role = 'svg'
          or lower(coalesce(m.mime_type, '')) = 'image/svg+xml'
          or lower(m.storage_path) like '%.svg'
        ))
      )
      and (
        v_search = ''
        or lower(coalesce(m.title, m.name)) like '%' || v_search || '%'
        or lower(m.name) like '%' || v_search || '%'
        or lower(coalesce(m.description, '')) like '%' || v_search || '%'
        or exists (
          select 1
          from public.media_item_tags search_mit
          join public.media_tags search_tag on search_tag.id = search_mit.tag_id
          where search_mit.media_item_id = m.id
            and search_tag.user_id = v_user_id
            and lower(search_tag.name) like '%' || v_search || '%'
        )
      )
  ), page_plus_one as (
    select * from filtered
    order by created_at desc, id desc
    limit v_limit + 1
  ), page_rows as (
    select * from page_plus_one
    order by created_at desc, id desc
    limit v_limit
  ), last_row as (
    select created_at, id
    from page_rows
    order by created_at asc, id asc
    limit 1
  )
  select jsonb_build_object(
    'status', 'success',
    'items', coalesce((select jsonb_agg(to_jsonb(page_rows) order by created_at desc, id desc) from page_rows), '[]'::jsonb),
    'has_more', (select count(*) > v_limit from page_plus_one),
    'next_cursor', case
      when (select count(*) > v_limit from page_plus_one) then (
        select jsonb_build_object('created_at', created_at, 'id', id) from last_row
      )
      else null
    end
  ) into v_result;

  return v_result;
exception
  when others then
    return jsonb_build_object(
      'status', 'unexpected_failure',
      'message', 'The media library page could not be loaded.',
      'error_code', sqlstate
    );
end;
$$;

revoke all on function public.list_media_library_page(integer, timestamptz, uuid, text, text, text, uuid) from public;
grant execute on function public.list_media_library_page(integer, timestamptz, uuid, text, text, text, uuid) to authenticated;
