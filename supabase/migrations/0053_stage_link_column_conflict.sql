-- create_stage_link returns a table with columns id, token and expires_at, which PL/pgSQL also treats as variables inside the body. The
-- auth.users lookup then failed with "column reference id is ambiguous". Resolve such names to the column, as the body intends.
begin;

create or replace function public.create_stage_link(p_label text default 'Stage', p_ttl_minutes integer default 720)
returns table (id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_user uuid := (select auth.uid());
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_ttl integer := least(greatest(coalesce(p_ttl_minutes, 720), 5), 1440);
  v_id uuid;
  v_expires timestamptz;
begin
  if v_user is null then raise exception 'Sign in to create a stage link' using errcode = '42501'; end if;
  if coalesce((select u.is_anonymous from auth.users u where u.id = v_user), false) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  if (select count(*) from public.performance_stage_links l
      where l.owner_user_id = v_user and l.revoked_at is null and l.expires_at > now()) >= 5 then
    raise exception 'Too many active stage links; revoke one first' using errcode = '53400';
  end if;
  v_expires := now() + make_interval(mins => v_ttl);
  insert into public.performance_stage_links(owner_user_id, label, token_hash, expires_at)
    values (v_user, coalesce(nullif(btrim(p_label), ''), 'Stage'), sha256(convert_to(v_token, 'UTF8')), v_expires)
    returning performance_stage_links.id into v_id;
  return query select v_id, v_token, v_expires;
end $$;

revoke all on function public.create_stage_link(text, integer) from public, anon, authenticated;
grant execute on function public.create_stage_link(text, integer) to authenticated;

commit;
