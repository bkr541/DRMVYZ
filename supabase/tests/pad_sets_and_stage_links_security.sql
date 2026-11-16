-- Run after 0052. Everything is rolled back.
--   npx supabase db query --linked -f supabase/tests/pad_sets_and_stage_links_security.sql
begin;
create function pg_temp.ps_assert(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Assertion failed: %', message; end if; end $$;
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
 ('a0520000-0000-4000-8000-000000000001', 'pads-a@example.invalid'),
 ('b0520000-0000-4000-8000-000000000001', 'pads-b@example.invalid');
insert into auth.users(id, email, is_anonymous) values ('c0520000-0000-4000-8000-000000000001', null, true);
insert into public.profiles(id, email) values
 ('a0520000-0000-4000-8000-000000000001', 'pads-a@example.invalid'),
 ('b0520000-0000-4000-8000-000000000001', 'pads-b@example.invalid') on conflict (id) do nothing;

-- Pad sets: first save at revision 0 -> 1, stale base is refused, a correct base advances.
select set_config('request.jwt.claim.sub', 'a0520000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.ps_assert(public.save_performance_pad_set('[{"id":"pad-1"}]'::jsonb, 1, 0) = 1, 'first save is revision 1');
select pg_temp.ps_denied($$select public.save_performance_pad_set('[]'::jsonb, 1, 0)$$, '40001');
select pg_temp.ps_assert(public.save_performance_pad_set('[{"id":"pad-1"},{"id":"pad-2"}]'::jsonb, 1, 1) = 2, 'correct base advances');
select pg_temp.ps_assert((select jsonb_array_length(pads) from public.performance_pad_sets) = 2, 'owner reads own pads');
select pg_temp.ps_denied($$select public.save_performance_pad_set('{"not":"an array"}'::jsonb, 1, 2)$$, '22023');
select pg_temp.ps_denied($$update public.performance_pad_sets set pads = '[]'$$, '42501');
-- Another account sees nothing of it.
select set_config('request.jwt.claim.sub', 'b0520000-0000-4000-8000-000000000001', true);
select pg_temp.ps_assert((select count(*) from public.performance_pad_sets) = 0, 'other account cannot read pads');
-- Anonymous identities cannot save.
select set_config('request.jwt.claim.sub', 'c0520000-0000-4000-8000-000000000001', true);
select pg_temp.ps_denied($$select public.save_performance_pad_set('[]'::jsonb, 1, 0)$$);

-- Stage links.
select set_config('request.jwt.claim.sub', 'a0520000-0000-4000-8000-000000000001', true);
select set_config('t.link', (select row_to_json(l)::text from public.create_stage_link('Living room', 60) l), true);
select pg_temp.ps_assert(length(current_setting('t.link')::jsonb->>'token') = 64, 'token is 64 characters');
select pg_temp.ps_assert((select count(*) from public.performance_stage_links) = 1, 'owner sees the link');
select pg_temp.ps_denied($$select token_hash from public.performance_stage_links$$, '42501');
-- The plaintext token is not stored anywhere readable.
select pg_temp.ps_assert(not exists (select 1 from public.performance_stage_links where label = current_setting('t.link')::jsonb->>'token'), 'no plaintext');
-- Clients cannot resolve tokens; only the service role can.
select pg_temp.ps_denied(format('select public.resolve_stage_link(%L)', current_setting('t.link')::jsonb->>'token'));
set local role anon;
select pg_temp.ps_denied(format('select public.resolve_stage_link(%L)', current_setting('t.link')::jsonb->>'token'));
select pg_temp.ps_denied($$select public.create_stage_link('x')$$);
reset role;
set local role service_role;
select pg_temp.ps_assert((public.resolve_stage_link(current_setting('t.link')::jsonb->>'token')->>'linkId') = current_setting('t.link')::jsonb->>'id', 'service role resolves a valid token');
select pg_temp.ps_assert(public.resolve_stage_link(repeat('0', 64)) is null, 'unknown token resolves to null');
select pg_temp.ps_assert(public.resolve_stage_link('short') is null, 'malformed token resolves to null');
reset role;
-- Another account cannot see or revoke it.
select set_config('request.jwt.claim.sub', 'b0520000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.ps_assert((select count(*) from public.performance_stage_links) = 0, 'other account cannot see links');
select public.revoke_stage_link((current_setting('t.link')::jsonb->>'id')::uuid);
reset role;
select pg_temp.ps_assert((select revoked_at is null from public.performance_stage_links), 'other account did not revoke it');
-- Owner revokes; a revoked token no longer resolves.
select set_config('request.jwt.claim.sub', 'a0520000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.revoke_stage_link((current_setting('t.link')::jsonb->>'id')::uuid);
reset role;
set local role service_role;
select pg_temp.ps_assert(public.resolve_stage_link(current_setting('t.link')::jsonb->>'token') is null, 'revoked token no longer resolves');
reset role;
-- At most five active links.
select set_config('request.jwt.claim.sub', 'a0520000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.create_stage_link('1'), public.create_stage_link('2'), public.create_stage_link('3'), public.create_stage_link('4'), public.create_stage_link('5');
select pg_temp.ps_denied($$select public.create_stage_link('6')$$, '53400');
rollback;
