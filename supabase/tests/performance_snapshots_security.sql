-- Run after 0050. Everything is rolled back.
--   npx supabase db query --linked -f supabase/tests/performance_snapshots_security.sql
begin;
create function pg_temp.ps_assert(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Snapshot assertion failed: %', message; end if; end $$;
create function pg_temp.ps_denied(statement text, expected_code text default '42501') returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate = expected_code then return; end if;
    raise exception 'Wrong error (% / %) for: %', sqlstate, sqlerrm, statement;
  end;
  raise exception 'Unexpectedly allowed: %', statement;
end $$;
create function pg_temp.snap(sid text, rev bigint, pad text default '') returns jsonb language sql as $$
  select jsonb_build_object('schemaVersion', 1, 'sessionId', sid, 'revision', rev, 'engineId', 'cinema2', 'pad', pad) $$;

insert into auth.users(id, email) values
 ('a0500000-0000-4000-8000-000000000001', 'snap-a@example.invalid'),
 ('b0500000-0000-4000-8000-000000000001', 'snap-b@example.invalid');
insert into auth.users(id, email, is_anonymous) values ('c0500000-0000-4000-8000-000000000001', null, true);
insert into public.profiles(id, email) values
 ('a0500000-0000-4000-8000-000000000001', 'snap-a@example.invalid'),
 ('b0500000-0000-4000-8000-000000000001', 'snap-b@example.invalid') on conflict (id) do nothing;

select set_config('request.jwt.claim.sub', 'a0500000-0000-4000-8000-000000000001', true);
set local role authenticated;
select set_config('snap.session', public.create_performance_session('a0500000-0000-4000-8000-0000000000d1', 'Desktop')::text, true);
select set_config('snap.phone', public.join_own_performance_session(current_setting('snap.session')::uuid, 'a0500000-0000-4000-8000-0000000000d2', 'Phone')::text, true);
select public.commit_performance_snapshot(current_setting('snap.session')::uuid, 1, 1, pg_temp.snap(current_setting('snap.session'), 1));
select pg_temp.ps_assert((select count(*) = 1 from public.performance_state_snapshots), 'host committed');
select pg_temp.ps_denied($q$select public.commit_performance_snapshot(current_setting('snap.session')::uuid, 1, 1, pg_temp.snap(current_setting('snap.session'), 1))$q$, '40001');
select pg_temp.ps_denied($q$select public.commit_performance_snapshot(current_setting('snap.session')::uuid, 0, 1, pg_temp.snap(current_setting('snap.session'), 0))$q$, '40001');
select pg_temp.ps_denied($q$select public.commit_performance_snapshot(current_setting('snap.session')::uuid, 2, 1, pg_temp.snap(current_setting('snap.session'), 3))$q$, '22023');
select pg_temp.ps_denied($q$select public.commit_performance_snapshot(current_setting('snap.session')::uuid, 2, 1, pg_temp.snap(gen_random_uuid()::text, 2))$q$, '22023');
select pg_temp.ps_denied($q$select public.commit_performance_snapshot(current_setting('snap.session')::uuid, 2, 1, jsonb_build_object('schemaVersion', 1, 'sessionId', current_setting('snap.session'), 'revision', 2, 'blob', repeat('x', 70000)))$q$, '23514');
select pg_temp.ps_denied($q$insert into public.performance_state_snapshots(session_id, revision, schema_version, snapshot) values (current_setting('snap.session')::uuid, 9, 1, '{}')$q$);
-- The owner's phone is not the host: it can read but not write.
select pg_temp.ps_assert((select count(*) = 1 from public.performance_state_snapshots), 'owner reads');
reset role;
-- Make the phone the host, then the desktop is no longer allowed to write.
select set_config('request.jwt.claim.sub', 'a0500000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.set_performance_host(current_setting('snap.session')::uuid, current_setting('snap.phone')::uuid);
select public.commit_performance_snapshot(current_setting('snap.session')::uuid, 2, 1, pg_temp.snap(current_setting('snap.session'), 2));
reset role;

-- A pending stage reads nothing; once approved it can read, never write.
insert into public.performance_participants(session_id, auth_user_id, device_id, device_label, role, status)
  values (current_setting('snap.session')::uuid, 'c0500000-0000-4000-8000-000000000001', 'c0500000-0000-4000-8000-0000000000d3', 'TV', 'renderer', 'pending');
select set_config('request.jwt.claim.sub', 'c0500000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.ps_assert((select count(*) = 0 from public.performance_state_snapshots), 'pending stage reads nothing');
reset role;
update public.performance_participants set status = 'approved' where role = 'renderer';
set local role authenticated;
select pg_temp.ps_assert((select count(*) = 2 from public.performance_state_snapshots), 'approved stage hydrates');
select pg_temp.ps_denied($q$select public.commit_performance_snapshot(current_setting('snap.session')::uuid, 3, 1, pg_temp.snap(current_setting('snap.session'), 3))$q$);
reset role;

-- Another account sees nothing and cannot write.
select set_config('request.jwt.claim.sub', 'b0500000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.ps_assert((select count(*) = 0 from public.performance_state_snapshots), 'stranger reads nothing');
select pg_temp.ps_denied($q$select public.commit_performance_snapshot(current_setting('snap.session')::uuid, 3, 1, pg_temp.snap(current_setting('snap.session'), 3))$q$);
reset role;

-- Retention keeps the five newest; ending the session discards them all.
select set_config('request.jwt.claim.sub', 'a0500000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.commit_performance_snapshot(current_setting('snap.session')::uuid, g, 1, pg_temp.snap(current_setting('snap.session'), g)) from generate_series(3, 10) g;
select pg_temp.ps_assert((select count(*) = 5 and min(revision) = 6 from public.performance_state_snapshots), 'keeps five newest');
select public.end_performance_session(current_setting('snap.session')::uuid);
select pg_temp.ps_assert((select count(*) = 0 from public.performance_state_snapshots), 'ended discards state');
reset role;
rollback;
