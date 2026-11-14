-- Mobile performance sessions (docs: DRMVYZ_Mobile_Performance_Architecture_Design.md, sections 6 and 14).
--
-- A session is owned by an authenticated account. Devices join as participants. Clients can only READ their own session and
-- participant rows; every write goes through the SECURITY DEFINER functions below, or through the pairing Edge Function (service role).
-- Nothing here trusts a client-supplied owner, role or host. Realtime channel authorization is a separate migration.
begin;

create table public.performance_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Performance' check (length(btrim(name)) between 1 and 80),
  status text not null default 'created'
    check (status in ('created', 'awaiting_stage', 'paired', 'live', 'degraded', 'ended')),
  host_participant_id uuid,
  -- HMAC of the room code, written only by the pairing Edge Function (service role). Never the code itself.
  room_code_hash bytea,
  room_code_expires_at timestamptz,
  -- Bumped whenever the owner wants every outstanding grant to be re-earned.
  epoch integer not null default 1 check (epoch > 0),
  protocol_version integer not null default 1 check (protocol_version > 0),
  expires_at timestamptz not null default now() + interval '12 hours',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz
);
create index performance_sessions_owner on public.performance_sessions(owner_user_id, created_at desc)
  where status <> 'ended';
create unique index performance_sessions_room_code on public.performance_sessions(room_code_hash)
  where room_code_hash is not null and status <> 'ended';

create table public.performance_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.performance_sessions(id) on delete cascade,
  -- May be an anonymous auth identity created for a venue stage.
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  -- Stable per physical device/browser so one account can be host and controller from two devices.
  device_id uuid not null,
  device_label text not null default 'Device' check (length(btrim(device_label)) between 1 and 80),
  role text not null check (role in ('host', 'controller', 'renderer', 'viewer', 'audio_source')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'revoked', 'disconnected')),
  capabilities jsonb not null default '{}'::jsonb
    check (jsonb_typeof(capabilities) = 'object' and octet_length(capabilities::text) <= 8192),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (session_id, device_id)
);
create index performance_participants_session on public.performance_participants(session_id, status);
create index performance_participants_user on public.performance_participants(auth_user_id, status);

alter table public.performance_sessions
  add constraint performance_sessions_host_fk
  foreign key (host_participant_id) references public.performance_participants(id) on delete set null;

-- Failed and successful code redemptions, for rate limiting and audit. Written only by the Edge Function.
create table public.performance_pairing_attempts (
  id bigint generated always as identity primary key,
  attempted_at timestamptz not null default now(),
  client_hash bytea not null,
  session_id uuid references public.performance_sessions(id) on delete cascade,
  succeeded boolean not null
);
create index performance_pairing_attempts_client on public.performance_pairing_attempts(client_hash, attempted_at desc);

create function public.performance_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger performance_sessions_touch before update on public.performance_sessions
  for each row execute function public.performance_touch_updated_at();

-- Ended sessions and revoked participants are terminal, even for privileged writers.
create function public.performance_session_terminal_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'ended' and new.status <> 'ended' then
    raise exception 'A performance session that has ended cannot be reopened' using errcode = '22023';
  end if;
  if new.status = 'ended' and old.status <> 'ended' then new.ended_at := coalesce(new.ended_at, now()); end if;
  return new;
end $$;
create trigger performance_sessions_terminal before update on public.performance_sessions
  for each row execute function public.performance_session_terminal_guard();

create function public.performance_participant_terminal_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'revoked' and new.status <> 'revoked' then
    raise exception 'A revoked participant cannot be restored; it must join again' using errcode = '22023';
  end if;
  if new.status = 'revoked' and old.status <> 'revoked' then new.revoked_at := coalesce(new.revoked_at, now()); end if;
  if new.session_id <> old.session_id or new.auth_user_id <> old.auth_user_id or new.device_id <> old.device_id then
    raise exception 'Participant identity is immutable' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger performance_participants_terminal before update on public.performance_participants
  for each row execute function public.performance_participant_terminal_guard();

-- ── Authorization helpers (SECURITY DEFINER so policies never recurse into each other) ──────────────────────────────

create function public.performance_session_is_live(p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.performance_sessions s
    where s.id = p_session_id and s.status <> 'ended' and s.expires_at > now()
  )
$$;

create function public.performance_is_session_owner(p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.performance_sessions s
    where s.id = p_session_id and s.owner_user_id = (select auth.uid())
  )
$$;

-- The caller holds an approved membership of this live session (any role).
create function public.performance_is_session_member(p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.performance_session_is_live(p_session_id) and exists (
    select 1 from public.performance_participants p
    where p.session_id = p_session_id and p.auth_user_id = (select auth.uid()) and p.status = 'approved'
  )
$$;

-- The caller is the session's current approved host.
create function public.performance_is_session_host(p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.performance_session_is_live(p_session_id) and exists (
    select 1
    from public.performance_sessions s
    join public.performance_participants p on p.id = s.host_participant_id
    where s.id = p_session_id and p.session_id = s.id and p.auth_user_id = (select auth.uid()) and p.status = 'approved'
  )
$$;

-- Realtime policies (a later migration) call this with the participant id taken from the topic.
create function public.performance_participant_is_caller(p_participant_id uuid, p_roles text[] default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.performance_participants p
    where p.id = p_participant_id and p.auth_user_id = (select auth.uid()) and p.status = 'approved'
      and (p_roles is null or p.role = any (p_roles))
      and public.performance_session_is_live(p.session_id)
  )
$$;

-- ── Row level security: read-only for clients ───────────────────────────────────────────────────────────────────────

alter table public.performance_sessions enable row level security;
alter table public.performance_participants enable row level security;
alter table public.performance_pairing_attempts enable row level security;

create policy "performance_sessions: owner select" on public.performance_sessions
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy "performance_sessions: member select" on public.performance_sessions
  for select to authenticated using (public.performance_is_session_member(id));

create policy "performance_participants: owner select" on public.performance_participants
  for select to authenticated using (public.performance_is_session_owner(session_id));
create policy "performance_participants: own select" on public.performance_participants
  for select to authenticated using (auth_user_id = (select auth.uid()));
create policy "performance_participants: host select" on public.performance_participants
  for select to authenticated using (public.performance_is_session_host(session_id));

-- Supabase grants new public tables to anon/authenticated by default; take that away and grant only reads.
revoke all on table public.performance_sessions, public.performance_participants, public.performance_pairing_attempts
  from public, anon, authenticated;
grant select on table public.performance_sessions, public.performance_participants to authenticated;
-- The room code hash is never readable by clients.
revoke select on table public.performance_sessions from authenticated;
grant select (id, owner_user_id, name, status, host_participant_id, room_code_expires_at, epoch, protocol_version,
  expires_at, created_at, updated_at, ended_at) on table public.performance_sessions to authenticated;
revoke all on function
  public.performance_session_is_live(uuid), public.performance_is_session_owner(uuid), public.performance_is_session_member(uuid),
  public.performance_is_session_host(uuid), public.performance_participant_is_caller(uuid, text[])
  from public, anon;
grant execute on function
  public.performance_session_is_live(uuid), public.performance_is_session_owner(uuid), public.performance_is_session_member(uuid),
  public.performance_is_session_host(uuid), public.performance_participant_is_caller(uuid, text[])
  to authenticated;

-- ── Owner operations (all writes go through these) ──────────────────────────────────────────────────────────────────

-- Creates a session and registers the creating device as its approved host. Owner-only by construction: the owner is auth.uid().
create function public.create_performance_session(
  p_device_id uuid,
  p_device_label text,
  p_name text default 'Performance',
  p_capabilities jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_session uuid;
  v_participant uuid;
begin
  if v_user is null then raise exception 'Sign in to start a performance session' using errcode = '42501'; end if;
  if coalesce((select is_anonymous from auth.users where id = v_user), false) then
    raise exception 'Venue identities cannot own sessions' using errcode = '42501';
  end if;
  if (select count(*) from public.performance_sessions
      where owner_user_id = v_user and status <> 'ended' and expires_at > now()) >= 5 then
    raise exception 'Too many active performance sessions; end one first' using errcode = '53400';
  end if;
  insert into public.performance_sessions(owner_user_id, name)
    values (v_user, coalesce(nullif(btrim(p_name), ''), 'Performance')) returning id into v_session;
  insert into public.performance_participants(session_id, auth_user_id, device_id, device_label, role, status, capabilities)
    values (v_session, v_user, p_device_id, coalesce(nullif(btrim(p_device_label), ''), 'Device'), 'host', 'approved',
            coalesce(p_capabilities, '{}'::jsonb))
    returning id into v_participant;
  update public.performance_sessions set host_participant_id = v_participant, status = 'awaiting_stage' where id = v_session;
  return v_session;
end $$;

-- The owner adds another of their own devices (their phone) as a controller. No code needed: it is the same account.
create function public.join_own_performance_session(
  p_session_id uuid,
  p_device_id uuid,
  p_device_label text,
  p_capabilities jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_participant uuid;
begin
  if not public.performance_is_session_owner(p_session_id) or not public.performance_session_is_live(p_session_id) then
    raise exception 'Not your active performance session' using errcode = '42501';
  end if;
  insert into public.performance_participants(session_id, auth_user_id, device_id, device_label, role, status, capabilities)
    values (p_session_id, v_user, p_device_id, coalesce(nullif(btrim(p_device_label), ''), 'Device'), 'controller', 'approved',
            coalesce(p_capabilities, '{}'::jsonb))
    on conflict (session_id, device_id) do update
      set last_seen_at = now(), device_label = excluded.device_label, capabilities = excluded.capabilities
      where public.performance_participants.auth_user_id = v_user and public.performance_participants.status = 'approved'
    returning id into v_participant;
  if v_participant is null then raise exception 'This device was removed from the session' using errcode = '42501'; end if;
  return v_participant;
end $$;

create function public.approve_performance_participant(p_participant_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_session uuid;
begin
  select session_id into v_session from public.performance_participants where id = p_participant_id;
  if v_session is null or not public.performance_is_session_owner(v_session) or not public.performance_session_is_live(v_session) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  update public.performance_participants set status = 'approved', last_seen_at = now()
    where id = p_participant_id and status in ('pending', 'approved', 'disconnected');
  if not found then
    raise exception 'That device was removed and must join again' using errcode = '22023';
  end if;
end $$;

create function public.revoke_performance_participant(p_participant_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_session uuid;
begin
  select session_id into v_session from public.performance_participants where id = p_participant_id;
  if v_session is null or not public.performance_is_session_owner(v_session) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  update public.performance_participants set status = 'revoked' where id = p_participant_id and status <> 'revoked';
  -- A revoked host leaves the session without a host; the owner must choose another explicitly.
  update public.performance_sessions set host_participant_id = null, status = 'degraded'
    where id = v_session and host_participant_id = p_participant_id and status <> 'ended';
end $$;

create function public.set_performance_host(p_session_id uuid, p_participant_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.performance_is_session_owner(p_session_id) or not public.performance_session_is_live(p_session_id) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  if not exists (select 1 from public.performance_participants
                 where id = p_participant_id and session_id = p_session_id and status = 'approved' and role in ('host', 'controller')) then
    raise exception 'That device cannot host this session' using errcode = '22023';
  end if;
  update public.performance_participants set role = 'host' where id = p_participant_id and role <> 'host';
  update public.performance_sessions set host_participant_id = p_participant_id where id = p_session_id;
end $$;

-- Owner or current host moves the session through its lifecycle. 'ended' is owner-only (see end_performance_session).
create function public.set_performance_session_status(p_session_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('awaiting_stage', 'paired', 'live', 'degraded') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  if not (public.performance_is_session_owner(p_session_id) or public.performance_is_session_host(p_session_id))
     or not public.performance_session_is_live(p_session_id) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  update public.performance_sessions set status = p_status where id = p_session_id;
end $$;

-- Ending revokes every participant and kills the room code in the same transaction.
create function public.end_performance_session(p_session_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.performance_is_session_owner(p_session_id) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  update public.performance_participants set status = 'revoked' where session_id = p_session_id and status <> 'revoked';
  update public.performance_sessions
    set status = 'ended', room_code_hash = null, room_code_expires_at = null, host_participant_id = null
    where id = p_session_id and status <> 'ended';
end $$;

-- A device reports it is still there. Cheap enough to call on a heartbeat; the caller can only touch its own row.
create function public.touch_performance_participant(p_participant_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.performance_participants set last_seen_at = now()
  where id = p_participant_id and auth_user_id = (select auth.uid()) and status = 'approved'
    and last_seen_at < now() - interval '5 seconds';
$$;

revoke all on function
  public.create_performance_session(uuid, text, text, jsonb), public.join_own_performance_session(uuid, uuid, text, jsonb),
  public.approve_performance_participant(uuid), public.revoke_performance_participant(uuid), public.set_performance_host(uuid, uuid),
  public.set_performance_session_status(uuid, text), public.end_performance_session(uuid), public.touch_performance_participant(uuid)
  from public, anon;
grant execute on function
  public.create_performance_session(uuid, text, text, jsonb), public.join_own_performance_session(uuid, uuid, text, jsonb),
  public.approve_performance_participant(uuid), public.revoke_performance_participant(uuid), public.set_performance_host(uuid, uuid),
  public.set_performance_session_status(uuid, text), public.end_performance_session(uuid), public.touch_performance_participant(uuid)
  to authenticated;

commit;
