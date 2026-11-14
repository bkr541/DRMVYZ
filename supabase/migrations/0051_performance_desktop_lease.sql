-- One signed-in desktop or browser holds the account at a time (the "desktop lease"); phones may always join as controllers.
-- Replaces the room-code pairing model, which the product does not use: codes, anonymous venue stages and the attempts table are removed.
-- A lease is the owner's live session whose host has been seen within the last 10 minutes. This is a product rule enforced by these
-- functions and the app, not an authentication control: Supabase still issues tokens to a second sign-in.
begin;

drop table public.performance_pairing_attempts;
drop index if exists public.performance_sessions_room_code;
alter table public.performance_sessions drop column room_code_hash, drop column room_code_expires_at;
-- The column-level grants existed only to hide the code hash.
grant select on table public.performance_sessions to authenticated;

-- Ending a session no longer clears a code.
create or replace function public.end_performance_session(p_session_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.performance_is_session_owner(p_session_id) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  update public.performance_participants set status = 'revoked' where session_id = p_session_id and status <> 'revoked';
  update public.performance_sessions set status = 'ended', host_participant_id = null
    where id = p_session_id and status <> 'ended';
  delete from public.performance_state_snapshots where session_id = p_session_id;
end $$;

-- Called by a desktop or browser app instance when it signs in and starts. `p_device_id` identifies this app instance (one per tab).
-- Returns {status:'claimed', sessionId, participantId} when this instance now holds the account (a fresh claim or a resume),
-- or {status:'blocked', deviceLabel, lastSeenAt} when another instance holds it.
create function public.claim_desktop_session(
  p_device_id uuid,
  p_device_label text,
  p_capabilities jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_label text := coalesce(nullif(btrim(p_device_label), ''), 'Desktop');
  v_held record;
  v_session uuid;
  v_participant uuid;
begin
  if v_user is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if coalesce((select is_anonymous from auth.users where id = v_user), false) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  -- Two sign-ins at the same instant must not both win.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 51));

  select s.id as session_id, p.id as participant_id, p.device_id, p.device_label, p.last_seen_at into v_held
  from public.performance_sessions s
  join public.performance_participants p on p.id = s.host_participant_id
  where s.owner_user_id = v_user and s.status <> 'ended' and s.expires_at > now()
    and p.status = 'approved' and p.last_seen_at > now() - interval '10 minutes'
  order by p.last_seen_at desc limit 1;

  if found and v_held.device_id <> p_device_id then
    return jsonb_build_object('status', 'blocked', 'deviceLabel', v_held.device_label, 'lastSeenAt', v_held.last_seen_at);
  end if;

  if found then
    update public.performance_participants set last_seen_at = now(), device_label = v_label,
      capabilities = coalesce(p_capabilities, '{}'::jsonb) where id = v_held.participant_id;
    update public.performance_sessions set expires_at = now() + interval '30 minutes' where id = v_held.session_id;
    return jsonb_build_object('status', 'claimed', 'sessionId', v_held.session_id, 'participantId', v_held.participant_id);
  end if;

  -- Nobody holds the account: whatever is left behind is stale and is cleaned up before this instance takes over.
  update public.performance_participants set status = 'revoked'
    where status <> 'revoked' and session_id in (
      select id from public.performance_sessions where owner_user_id = v_user and status <> 'ended');
  delete from public.performance_state_snapshots where session_id in (
    select id from public.performance_sessions where owner_user_id = v_user and status <> 'ended');
  update public.performance_sessions set status = 'ended', host_participant_id = null
    where owner_user_id = v_user and status <> 'ended';

  insert into public.performance_sessions(owner_user_id, name, expires_at)
    values (v_user, 'Desktop', now() + interval '30 minutes') returning id into v_session;
  insert into public.performance_participants(session_id, auth_user_id, device_id, device_label, role, status, capabilities)
    values (v_session, v_user, p_device_id, v_label, 'host', 'approved', coalesce(p_capabilities, '{}'::jsonb))
    returning id into v_participant;
  update public.performance_sessions set host_participant_id = v_participant, status = 'awaiting_stage' where id = v_session;
  return jsonb_build_object('status', 'claimed', 'sessionId', v_session, 'participantId', v_participant);
end $$;

-- The desktop's heartbeat. False means this instance no longer holds the account (it lapsed or was released) and must claim again.
create function public.heartbeat_desktop_session(p_session_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.performance_is_session_host(p_session_id) then return false; end if;
  update public.performance_participants set last_seen_at = now()
    where id = (select host_participant_id from public.performance_sessions where id = p_session_id);
  update public.performance_sessions set expires_at = now() + interval '30 minutes' where id = p_session_id;
  return true;
end $$;

-- Which of my desktops is online (the phone's "Control my desktop" choice).
create function public.list_my_online_desktops()
returns table (session_id uuid, participant_id uuid, device_label text, last_seen_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.id, p.id, p.device_label, p.last_seen_at
  from public.performance_sessions s
  join public.performance_participants p on p.id = s.host_participant_id
  where s.owner_user_id = (select auth.uid()) and s.status <> 'ended' and s.expires_at > now()
    and p.status = 'approved' and p.last_seen_at > now() - interval '10 minutes'
  order by p.last_seen_at desc
$$;

-- A phone can come back to a session it left.
create or replace function public.join_own_performance_session(
  p_session_id uuid, p_device_id uuid, p_device_label text, p_capabilities jsonb default '{}'::jsonb
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
      set last_seen_at = now(), status = 'approved', device_label = excluded.device_label, capabilities = excluded.capabilities
      where public.performance_participants.auth_user_id = v_user and public.performance_participants.status in ('approved', 'disconnected')
    returning id into v_participant;
  if v_participant is null then raise exception 'This device was removed from the session' using errcode = '42501'; end if;
  return v_participant;
end $$;

-- The phone switches back to Standard.
create function public.leave_performance_session(p_session_id uuid, p_device_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.performance_participants set status = 'disconnected'
  where session_id = p_session_id and device_id = p_device_id and auth_user_id = (select auth.uid())
    and role = 'controller' and status = 'approved';
$$;

revoke all on function
  public.claim_desktop_session(uuid, text, jsonb), public.heartbeat_desktop_session(uuid), public.list_my_online_desktops(),
  public.leave_performance_session(uuid, uuid)
  from public, anon;
grant execute on function
  public.claim_desktop_session(uuid, text, jsonb), public.heartbeat_desktop_session(uuid), public.list_my_online_desktops(),
  public.leave_performance_session(uuid, uuid)
  to authenticated;

commit;
