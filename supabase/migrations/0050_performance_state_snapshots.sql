-- Durable, small, versioned performance state (design doc sections 8 and 14). Only the session's approved host can write; every approved
-- member can read, which is how a reconnecting controller or a stage hydrates before it subscribes to live deltas.
begin;

create table public.performance_state_snapshots (
  session_id uuid not null references public.performance_sessions(id) on delete cascade,
  revision bigint not null check (revision > 0),
  schema_version integer not null check (schema_version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 65536),
  committed_by uuid references public.performance_participants(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (session_id, revision)
);

alter table public.performance_state_snapshots enable row level security;
create policy "performance_state_snapshots: member select" on public.performance_state_snapshots
  for select to authenticated using (public.performance_is_session_member(session_id) or public.performance_is_session_owner(session_id));
revoke all on table public.performance_state_snapshots from public, anon, authenticated;
grant select on table public.performance_state_snapshots to authenticated;

-- Host-only commit. The revision must advance, and the payload must describe this session at this revision, so a stale or
-- misdirected write cannot overwrite newer state. Only the most recent snapshots are kept.
create function public.commit_performance_snapshot(
  p_session_id uuid,
  p_revision bigint,
  p_schema_version integer,
  p_snapshot jsonb
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_participant uuid;
  v_latest bigint;
begin
  if not public.performance_is_session_host(p_session_id) then
    raise exception 'Only the session host can commit state' using errcode = '42501';
  end if;
  -- Serialize concurrent commits for this session.
  perform 1 from public.performance_sessions where id = p_session_id for update;
  if jsonb_typeof(p_snapshot) is distinct from 'object'
     or p_snapshot->>'sessionId' is distinct from p_session_id::text
     or p_snapshot->>'revision' is distinct from p_revision::text
     or p_snapshot->>'schemaVersion' is distinct from p_schema_version::text then
    raise exception 'Snapshot does not match its session, revision and schema version' using errcode = '22023';
  end if;
  select max(revision) into v_latest from public.performance_state_snapshots where session_id = p_session_id;
  if v_latest is not null and p_revision <= v_latest then
    raise exception 'Stale revision %; latest is %', p_revision, v_latest using errcode = '40001';
  end if;
  select s.host_participant_id into v_participant from public.performance_sessions s where s.id = p_session_id;
  insert into public.performance_state_snapshots(session_id, revision, schema_version, snapshot, committed_by)
    values (p_session_id, p_revision, p_schema_version, p_snapshot, v_participant);
  delete from public.performance_state_snapshots
    where session_id = p_session_id and revision <= p_revision - 5;
  return p_revision;
end $$;

-- Ending a session also discards its recovery state.
create or replace function public.end_performance_session(p_session_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.performance_is_session_owner(p_session_id) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  update public.performance_participants set status = 'revoked' where session_id = p_session_id and status <> 'revoked';
  update public.performance_sessions
    set status = 'ended', room_code_hash = null, room_code_expires_at = null, host_participant_id = null
    where id = p_session_id and status <> 'ended';
  delete from public.performance_state_snapshots where session_id = p_session_id;
end $$;

revoke all on function public.commit_performance_snapshot(uuid, bigint, integer, jsonb) from public, anon;
grant execute on function public.commit_performance_snapshot(uuid, bigint, integer, jsonb) to authenticated;

commit;
