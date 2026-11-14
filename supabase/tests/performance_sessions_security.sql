-- Run after 0051 (it asserts the post-0051 shape; 0049 alone would fail the pairing-table check). Everything is rolled back.
--   npx supabase db query --linked -f supabase/tests/performance_sessions_security.sql
-- Covers: owner/member isolation, forged writes, anonymous venue identities, revocation, terminal states, room-code secrecy.
begin;
create function pg_temp.ps_assert(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Performance assertion failed: %', message; end if; end $$;
create function pg_temp.ps_denied(statement text, expected_code text default '42501') returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_code then return; end if;
    raise exception 'Wrong error (% / %) for: %', sqlstate, sqlerrm, statement;
  end;
  raise exception 'Unexpectedly allowed: %', statement;
end $$;

insert into auth.users(id, email) values
 ('a0490000-0000-4000-8000-000000000001', 'perf-a@example.invalid'),
 ('b0490000-0000-4000-8000-000000000001', 'perf-b@example.invalid');
insert into auth.users(id, email, is_anonymous) values ('c0490000-0000-4000-8000-000000000001', null, true);
insert into public.profiles(id, email) values
 ('a0490000-0000-4000-8000-000000000001', 'perf-a@example.invalid'),
 ('b0490000-0000-4000-8000-000000000001', 'perf-b@example.invalid') on conflict (id) do nothing;

-- A creates a session from a desktop.
select set_config('request.jwt.claim.sub', 'a0490000-0000-4000-8000-000000000001', true);
set local role authenticated;
select set_config('perf.session', public.create_performance_session('a0490000-0000-4000-8000-0000000000d1', 'Desktop')::text, true);
select pg_temp.ps_assert((select count(*) = 1 from public.performance_sessions), 'owner sees own session');
select pg_temp.ps_assert((select status = 'awaiting_stage' and host_participant_id is not null from public.performance_sessions), 'host registered');
select pg_temp.ps_assert((select count(*) = 1 from public.performance_participants where role = 'host' and status = 'approved'), 'desktop is approved host');
-- The owner's phone joins without a code; joining twice is idempotent.
select set_config('perf.phone', public.join_own_performance_session(current_setting('perf.session')::uuid, 'a0490000-0000-4000-8000-0000000000d2', 'Phone')::text, true);
select public.join_own_performance_session(current_setting('perf.session')::uuid, 'a0490000-0000-4000-8000-0000000000d2', 'Phone');
select pg_temp.ps_assert((select count(*) = 2 from public.performance_participants), 'one row per device');
-- The room code hash can never be read by a client.
-- 0051 removed room codes and the pairing-attempts table.
select pg_temp.ps_assert(to_regclass('public.performance_pairing_attempts') is null, 'no pairing table');
-- Forged direct writes.
select pg_temp.ps_denied($q$insert into public.performance_sessions(owner_user_id) values (auth.uid())$q$);
select pg_temp.ps_denied($q$update public.performance_sessions set status = 'live'$q$);
select pg_temp.ps_denied($q$update public.performance_participants set role = 'host'$q$);
select pg_temp.ps_denied($q$delete from public.performance_participants$q$);
reset role;

-- A venue stage (anonymous identity) is redeemed by the pairing function: pending until the owner approves.
insert into public.performance_participants(session_id, auth_user_id, device_id, device_label, role, status)
  values (current_setting('perf.session')::uuid, 'c0490000-0000-4000-8000-000000000001', 'c0490000-0000-4000-8000-0000000000d3', 'Venue TV', 'renderer', 'pending');
select set_config('perf.stage', (select id::text from public.performance_participants where role = 'renderer'), true);

select set_config('request.jwt.claim.sub', 'c0490000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.ps_assert((select count(*) = 0 from public.performance_sessions), 'pending stage cannot read the session');
select pg_temp.ps_assert((select count(*) = 1 from public.performance_participants), 'pending stage sees only itself');
select pg_temp.ps_assert(not public.performance_is_session_member(current_setting('perf.session')::uuid), 'pending is not a member');
select pg_temp.ps_denied($q$select public.approve_performance_participant(current_setting('perf.stage')::uuid)$q$);
select pg_temp.ps_denied($q$select public.create_performance_session('c0490000-0000-4000-8000-0000000000d4', 'Venue')$q$);
reset role;

-- Owner approves; the stage becomes a member but still cannot see other devices or change anything.
select set_config('request.jwt.claim.sub', 'a0490000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.approve_performance_participant(current_setting('perf.stage')::uuid);
reset role;
select set_config('request.jwt.claim.sub', 'c0490000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.ps_assert((select count(*) = 1 from public.performance_sessions), 'approved stage reads the session');
select pg_temp.ps_assert((select count(*) = 1 from public.performance_participants), 'stage still sees only itself');
select pg_temp.ps_assert(public.performance_participant_is_caller(current_setting('perf.stage')::uuid, array['renderer']), 'stage owns its participant id');
select pg_temp.ps_assert(not public.performance_participant_is_caller(current_setting('perf.phone')::uuid), 'stage cannot claim the phone');
select pg_temp.ps_assert(not public.performance_participant_is_caller(current_setting('perf.stage')::uuid, array['controller']), 'role must match');
select pg_temp.ps_denied($q$select public.set_performance_session_status(current_setting('perf.session')::uuid, 'live')$q$);
select pg_temp.ps_denied($q$select public.end_performance_session(current_setting('perf.session')::uuid)$q$);
select pg_temp.ps_denied($q$select public.set_performance_host(current_setting('perf.session')::uuid, current_setting('perf.stage')::uuid)$q$);
reset role;

-- The host sees every participant and may move the lifecycle, but not end the session.
select set_config('request.jwt.claim.sub', 'a0490000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.ps_assert((select count(*) = 3 from public.performance_participants), 'owner/host sees all devices');
select public.set_performance_session_status(current_setting('perf.session')::uuid, 'live');
select pg_temp.ps_denied($q$select public.set_performance_session_status(current_setting('perf.session')::uuid, 'ended')$q$, '22023');
reset role;

-- B sees nothing of A's session and cannot act on it.
select set_config('request.jwt.claim.sub', 'b0490000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.ps_assert((select count(*) = 0 from public.performance_sessions), 'B sees no sessions');
select pg_temp.ps_assert((select count(*) = 0 from public.performance_participants), 'B sees no participants');
select pg_temp.ps_denied($q$select public.join_own_performance_session(current_setting('perf.session')::uuid, 'b0490000-0000-4000-8000-0000000000d9', 'Intruder')$q$);
select pg_temp.ps_denied($q$select public.revoke_performance_participant(current_setting('perf.stage')::uuid)$q$);
select pg_temp.ps_denied($q$select public.end_performance_session(current_setting('perf.session')::uuid)$q$);
reset role;

-- Revoking the stage is immediate and permanent.
select set_config('request.jwt.claim.sub', 'a0490000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.revoke_performance_participant(current_setting('perf.stage')::uuid);
select pg_temp.ps_denied($q$select public.approve_performance_participant(current_setting('perf.stage')::uuid)$q$, '22023');
reset role;
select pg_temp.ps_denied($q$update public.performance_participants set status = 'approved' where role = 'renderer'$q$, '22023');
select set_config('request.jwt.claim.sub', 'c0490000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.ps_assert((select count(*) = 0 from public.performance_sessions), 'revoked stage loses the session');
select pg_temp.ps_assert(not public.performance_is_session_member(current_setting('perf.session')::uuid), 'revoked is not a member');
reset role;

-- Ending the session revokes everyone and cannot be undone.
select set_config('request.jwt.claim.sub', 'a0490000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.end_performance_session(current_setting('perf.session')::uuid);
select pg_temp.ps_assert((select status = 'ended' and host_participant_id is null from public.performance_sessions), 'ended');
select pg_temp.ps_assert((select count(*) = 0 from public.performance_participants where status <> 'revoked'), 'all participants revoked');
select pg_temp.ps_denied($q$select public.join_own_performance_session(current_setting('perf.session')::uuid, 'a0490000-0000-4000-8000-0000000000d8', 'Late')$q$);
reset role;
select pg_temp.ps_denied($q$update public.performance_sessions set status = 'live'$q$, '22023');

-- A cap on simultaneous sessions per owner.
select set_config('request.jwt.claim.sub', 'a0490000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.create_performance_session(gen_random_uuid(), 'D') from generate_series(1, 5);
select pg_temp.ps_denied($q$select public.create_performance_session(gen_random_uuid(), 'Sixth')$q$, '53400');
reset role;

rollback;
