-- Run on a development or staging database after migration 0066. Rolls back all changes.
begin;
create function pg_temp.report_assert(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Assertion failed: %', message; end if; end $$;
insert into auth.users(id, email) values ('a0660000-0000-4000-8000-000000000001', 'report-a@example.invalid'), ('b0660000-0000-4000-8000-000000000001', 'report-b@example.invalid');
select pg_temp.report_assert(not has_table_privilege('anon', 'public.beta_issue_reports', 'INSERT'), 'anonymous users cannot report');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0660000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{}}', true);
insert into public.beta_issue_reports(category, summary, app_version) values ('rendering', 'Cinema 2.0 froze', '1.0.0-beta.1');
do $$
begin
  begin
    insert into public.beta_issue_reports(user_id, category, summary, app_version) values ('b0660000-0000-4000-8000-000000000001', 'other', 'spoofed', 'x');
    raise exception 'Assertion failed: a report was filed for another user';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"b0660000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{}}', true);
select pg_temp.report_assert((select count(*) = 0 from public.beta_issue_reports), 'testers cannot read other testers'' reports');

select set_config('request.jwt.claims', '{"sub":"b0660000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}', true);
select pg_temp.report_assert((select count(*) = 1 from public.beta_issue_reports), 'admins read every report');
update public.beta_issue_reports set status = 'triaged';
reset role;
rollback;
