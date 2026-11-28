-- Run on a development or staging database after migration 0065. Rolls back all changes.
begin;
create function pg_temp.invite_assert(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Assertion failed: %', message; end if; end $$;

select pg_temp.invite_assert(not has_table_privilege('anon', 'public.beta_invites', 'SELECT'), 'anonymous users cannot read the invite list');
select pg_temp.invite_assert(not has_function_privilege('authenticated', 'public.enforce_beta_invite()', 'EXECUTE'), 'the trigger function cannot be called');

insert into public.beta_invites(email, note) values ('invited@example.invalid', 'test');

-- A sign-up through Supabase Auth for an email that was not invited is refused.
set local role supabase_auth_admin;
do $$
begin
  begin
    insert into auth.users(id, email) values ('a0650000-0000-4000-8000-000000000001', 'stranger@example.invalid');
    raise exception 'Assertion failed: uninvited sign-up was accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%invitation only%' then raise; end if;
  end;
end $$;

-- An invited email can sign up, case and spacing aside, and its invite is marked accepted.
insert into auth.users(id, email) values ('a0650000-0000-4000-8000-000000000002', ' Invited@Example.invalid');
-- A user invited from the dashboard is allowed.
insert into auth.users(id, email, invited_at) values ('a0650000-0000-4000-8000-000000000003', 'dashboard@example.invalid', now());
reset role;
select pg_temp.invite_assert((select accepted_at is not null from public.beta_invites where email = 'invited@example.invalid'), 'invite marked accepted');

-- An ordinary signed-in user cannot read or add invites.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0650000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{}}', true);
select pg_temp.invite_assert((select count(*) = 0 from public.beta_invites), 'non-admins see no invites');
do $$
begin
  begin
    insert into public.beta_invites(email) values ('friend@example.invalid');
    raise exception 'Assertion failed: a non-admin added an invite';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
