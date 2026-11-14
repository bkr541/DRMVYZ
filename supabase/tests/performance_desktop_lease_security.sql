-- Run after 0051. Everything is rolled back.
--   npx supabase db query --linked -f supabase/tests/performance_desktop_lease_security.sql
begin;
create function pg_temp.ps_assert(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Lease assertion failed: %', message; end if; end $$;
create function pg_temp.ps_denied(statement text, expected_code text default '42501') returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate = expected_code then return; end if;
    raise exception 'Wrong error (% / %) for: %', sqlstate, sqlerrm, statement;
  end;
  raise exception 'Unexpectedly allowed: %', statement;
end $$;

insert into auth.users(id, email) values
 ('a0510000-0000-4000-8000-000000000001', 'lease-a@example.invalid'),
 ('b0510000-0000-4000-8000-000000000001', 'lease-b@example.invalid');
insert into auth.users(id, email, is_anonymous) values ('c0510000-0000-4000-8000-000000000001', null, true);
insert into public.profiles(id, email) values
 ('a0510000-0000-4000-8000-000000000001', 'lease-a@example.invalid'),
 ('b0510000-0000-4000-8000-000000000001', 'lease-b@example.invalid') on conflict (id) do nothing;

select set_config('request.jwt.claim.sub', 'a0510000-0000-4000-8000-000000000001', true);
set local role authenticated;
-- First desktop claims; re-claiming from the same instance resumes the same session.
select set_config('lease.r1', public.claim_desktop_session('a0510000-0000-4000-8000-0000000000d1', 'Studio Mac')::text, true);
select pg_temp.ps_assert((current_setting('lease.r1')::jsonb->>'status') = 'claimed', 'first claim wins');
select pg_temp.ps_assert((public.claim_desktop_session('a0510000-0000-4000-8000-0000000000d1', 'Studio Mac')->>'sessionId') = (current_setting('lease.r1')::jsonb->>'sessionId'), 'same instance resumes');
-- Any other desktop or browser is blocked and told which device holds the account.
select pg_temp.ps_assert((public.claim_desktop_session('a0510000-0000-4000-8000-0000000000d2', 'Other Browser')->>'status') = 'blocked', 'second instance blocked');
select pg_temp.ps_assert((public.claim_desktop_session('a0510000-0000-4000-8000-0000000000d2', 'Other Browser')->>'deviceLabel') = 'Studio Mac', 'blocked response names the holder');
select pg_temp.ps_assert((select count(*) = 1 from public.performance_sessions where status <> 'ended'), 'blocking creates nothing');
-- The phone can see the desktop and join, leave and rejoin.
select pg_temp.ps_assert((select count(*) = 1 and min(device_label) = 'Studio Mac' from public.list_my_online_desktops()), 'phone lists the desktop');
select public.join_own_performance_session((current_setting('lease.r1')::jsonb->>'sessionId')::uuid, 'a0510000-0000-4000-8000-0000000000e1', 'iPhone');
select public.leave_performance_session((current_setting('lease.r1')::jsonb->>'sessionId')::uuid, 'a0510000-0000-4000-8000-0000000000e1');
select pg_temp.ps_assert((select status = 'disconnected' from public.performance_participants where device_label = 'iPhone'), 'phone left');
select public.join_own_performance_session((current_setting('lease.r1')::jsonb->>'sessionId')::uuid, 'a0510000-0000-4000-8000-0000000000e1', 'iPhone');
select pg_temp.ps_assert((select status = 'approved' from public.performance_participants where device_label = 'iPhone'), 'phone rejoined');
-- Heartbeats: the holder succeeds; a stranger's heartbeat is simply refused.
select pg_temp.ps_assert(public.heartbeat_desktop_session((current_setting('lease.r1')::jsonb->>'sessionId')::uuid), 'holder heartbeat');
select pg_temp.ps_assert((select count(*) = 1 from (select * from public.performance_sessions) t), 'select * works for the owner');
reset role;

-- B is independent of A and cannot touch A's lease.
select set_config('request.jwt.claim.sub', 'b0510000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.ps_assert((public.claim_desktop_session('b0510000-0000-4000-8000-0000000000d1', 'B Laptop')->>'status') = 'claimed', 'other accounts are unaffected');
select pg_temp.ps_assert((select count(*) = 0 from public.list_my_online_desktops() where device_label = 'Studio Mac'), 'B cannot see A desktop');
select pg_temp.ps_assert(not public.heartbeat_desktop_session((current_setting('lease.r1')::jsonb->>'sessionId')::uuid), 'stranger heartbeat refused');
reset role;

-- Venue-style anonymous identities can never claim.
select set_config('request.jwt.claim.sub', 'c0510000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.ps_denied($q$select public.claim_desktop_session('c0510000-0000-4000-8000-0000000000d1', 'TV')$q$);
reset role;

-- After 10 minutes of silence the lease lapses: the next instance takes over and the old session is cleaned up.
select set_config('request.jwt.claim.sub', 'a0510000-0000-4000-8000-000000000001', true);
update public.performance_participants set last_seen_at = now() - interval '11 minutes' where device_label = 'Studio Mac';
set local role authenticated;
select pg_temp.ps_assert((select count(*) = 0 from public.list_my_online_desktops()), 'a silent desktop is offline');
select pg_temp.ps_assert(not public.heartbeat_desktop_session((current_setting('lease.r1')::jsonb->>'sessionId')::uuid) or true, 'old heartbeat does not error');
select set_config('lease.r2', public.claim_desktop_session('a0510000-0000-4000-8000-0000000000d2', 'Other Browser')::text, true);
select pg_temp.ps_assert((current_setting('lease.r2')::jsonb->>'status') = 'claimed', 'takeover after 10 minutes');
select pg_temp.ps_assert((select count(*) = 1 from public.performance_sessions where status <> 'ended'), 'only one live session');
select pg_temp.ps_assert((public.claim_desktop_session('a0510000-0000-4000-8000-0000000000d1', 'Studio Mac')->>'status') = 'blocked', 'the former holder is now blocked');
-- A clean sign-out releases at once, with no waiting.
select public.end_performance_session((current_setting('lease.r2')::jsonb->>'sessionId')::uuid);
select pg_temp.ps_assert((public.claim_desktop_session('a0510000-0000-4000-8000-0000000000d1', 'Studio Mac')->>'status') = 'claimed', 'release is immediate');
reset role;
rollback;
