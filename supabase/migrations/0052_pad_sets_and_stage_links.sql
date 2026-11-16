-- Two account-level pieces for the mobile experience.
--
-- 1. performance_pad_sets: one row per account holding that account's performance-pad assignments, so the phone shows the same pads as
--    the desktop. Writes go through save_performance_pad_set, which uses a revision check so a stale device cannot overwrite newer pads.
--
-- 2. performance_stage_links: a shareable stage link. The owner creates a link and opens /stage/<token> on any screen with a browser
--    (a TV, a laptop); the phone streams its visual to that page over WebRTC. The token is a capability: it is returned once, only a
--    SHA-256 hash is stored, it expires, and the owner can revoke it. The link grants no account access; it only lets a screen join one
--    signalling channel. Resolving a token is service-role only (the stage-link Edge Function), so it is rate-limited and cannot be
--    called directly with the public key.
begin;

-- ── Pad sets ────────────────────────────────────────────────────────────────────────────────────────────────────────

create table public.performance_pad_sets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pads jsonb not null default '[]'::jsonb
    check (jsonb_typeof(pads) = 'array' and jsonb_array_length(pads) <= 64 and octet_length(pads::text) <= 262144),
  schema_version integer not null default 1 check (schema_version > 0),
  revision bigint not null default 1 check (revision > 0),
  updated_by_device uuid,
  updated_at timestamptz not null default now()
);

alter table public.performance_pad_sets enable row level security;
create policy "performance_pad_sets: owner select" on public.performance_pad_sets
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on table public.performance_pad_sets from public, anon, authenticated;
grant select on table public.performance_pad_sets to authenticated;

-- Saves this account's pads. p_base_revision is the revision the caller last read (0 when it has never read one). A mismatch means
-- another device saved first; the caller must read, merge and retry. Returns the new revision.
create function public.save_performance_pad_set(
  p_pads jsonb,
  p_schema_version integer,
  p_base_revision bigint,
  p_device_id uuid default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_current bigint;
  v_next bigint;
begin
  if v_user is null then raise exception 'Sign in to save pads' using errcode = '42501'; end if;
  if coalesce((select is_anonymous from auth.users where id = v_user), false) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  if jsonb_typeof(p_pads) is distinct from 'array' or jsonb_array_length(p_pads) > 64 then
    raise exception 'Pads must be an array of at most 64 entries' using errcode = '22023';
  end if;
  -- Two devices saving at the same instant are serialised per account.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 52));
  select revision into v_current from public.performance_pad_sets where user_id = v_user;
  if v_current is null then
    if coalesce(p_base_revision, 0) <> 0 then
      raise exception 'Stale pad revision; reload and retry' using errcode = '40001';
    end if;
    insert into public.performance_pad_sets(user_id, pads, schema_version, revision, updated_by_device)
      values (v_user, p_pads, p_schema_version, 1, p_device_id);
    return 1;
  end if;
  if coalesce(p_base_revision, 0) <> v_current then
    raise exception 'Stale pad revision % (latest is %); reload and retry', p_base_revision, v_current using errcode = '40001';
  end if;
  v_next := v_current + 1;
  update public.performance_pad_sets
    set pads = p_pads, schema_version = p_schema_version, revision = v_next, updated_by_device = p_device_id, updated_at = now()
    where user_id = v_user;
  return v_next;
end $$;

-- ── Stage links ─────────────────────────────────────────────────────────────────────────────────────────────────────

create table public.performance_stage_links (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Stage' check (length(btrim(label)) between 1 and 80),
  -- SHA-256 of the token. The token itself is never stored.
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_resolved_at timestamptz
);
create index performance_stage_links_owner on public.performance_stage_links(owner_user_id, created_at desc)
  where revoked_at is null;

alter table public.performance_stage_links enable row level security;
create policy "performance_stage_links: owner select" on public.performance_stage_links
  for select to authenticated using (owner_user_id = (select auth.uid()));
revoke all on table public.performance_stage_links from public, anon, authenticated;
-- The hash is never readable by clients.
grant select (id, owner_user_id, label, created_at, expires_at, revoked_at, last_resolved_at)
  on table public.performance_stage_links to authenticated;

-- Creates a link and returns its plaintext token exactly once. The token is two random UUIDs (about 244 bits).
create function public.create_stage_link(p_label text default 'Stage', p_ttl_minutes integer default 720)
returns table (id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_ttl integer := least(greatest(coalesce(p_ttl_minutes, 720), 5), 1440);
  v_id uuid;
  v_expires timestamptz;
begin
  if v_user is null then raise exception 'Sign in to create a stage link' using errcode = '42501'; end if;
  if coalesce((select is_anonymous from auth.users where id = v_user), false) then
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

create function public.revoke_stage_link(p_link_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.performance_stage_links set revoked_at = now()
  where id = p_link_id and owner_user_id = (select auth.uid()) and revoked_at is null;
$$;

-- Service role only. Returns the link's channel id when the token is valid, unexpired and not revoked; null otherwise.
create function public.resolve_stage_link(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_row public.performance_stage_links;
begin
  if p_token is null or length(p_token) <> 64 then return null; end if;
  select * into v_row from public.performance_stage_links l
    where l.token_hash = sha256(convert_to(p_token, 'UTF8')) and l.revoked_at is null and l.expires_at > now();
  if not found then return null; end if;
  update public.performance_stage_links set last_resolved_at = now() where id = v_row.id;
  return jsonb_build_object('linkId', v_row.id, 'label', v_row.label, 'expiresAt', v_row.expires_at);
end $$;

revoke all on function
  public.save_performance_pad_set(jsonb, integer, bigint, uuid), public.create_stage_link(text, integer),
  public.revoke_stage_link(uuid), public.resolve_stage_link(text)
  from public, anon, authenticated;
grant execute on function
  public.save_performance_pad_set(jsonb, integer, bigint, uuid), public.create_stage_link(text, integer), public.revoke_stage_link(uuid)
  to authenticated;
grant execute on function public.resolve_stage_link(text) to service_role;

commit;
