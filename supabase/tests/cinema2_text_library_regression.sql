-- Run after migration 0044 on a disposable Supabase test database as postgres.
-- psql "$LOCAL_TEST_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/cinema2_text_library_regression.sql
begin;
insert into auth.users (id, email) values
 ('a4440000-0000-4000-8000-000000000001', 'cinema2-text-a@example.invalid'),
 ('a4440000-0000-4000-8000-000000000002', 'cinema2-text-b@example.invalid');
insert into public.profiles (id, email) values
 ('a4440000-0000-4000-8000-000000000001', 'cinema2-text-a@example.invalid'),
 ('a4440000-0000-4000-8000-000000000002', 'cinema2-text-b@example.invalid') on conflict (id) do nothing;
insert into public.cinema2_saved_text (user_id, preset_id, id, name, parameters) values
 ('a4440000-0000-4000-8000-000000000002', 'drmvyz.cinema2.say-it', 'a4440000-0000-4000-8000-000000000003', 'Private B', '{}');
select set_config('request.jwt.claim.sub', 'a4440000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.cinema2_saved_text) <> 0 then raise exception 'Another user text is visible'; end if;
 begin
  insert into public.cinema2_saved_text (user_id, preset_id, id, name, parameters) values
   ('a4440000-0000-4000-8000-000000000002', 'drmvyz.cinema2.say-it', 'a4440000-0000-4000-8000-000000000004', 'Forged B', '{}');
  raise exception 'Cross-user insert was allowed';
 exception when insufficient_privilege then null; end;
end $$;
insert into public.cinema2_saved_text (user_id, preset_id, id, name, parameters) values
 (auth.uid(), 'drmvyz.cinema2.say-it', 'a4440000-0000-4000-8000-000000000005', 'A text', '{}'),
 (auth.uid(), 'drmvyz.cinema2.marquee', 'a4440000-0000-4000-8000-000000000006', 'A marquee', '{}');
insert into public.cinema2_text_pools (user_id, preset_id, id, name) values
 (auth.uid(), 'drmvyz.cinema2.say-it', 'a4440000-0000-4000-8000-000000000007', 'A pool');
insert into public.cinema2_text_pool_entries values
 (auth.uid(), 'drmvyz.cinema2.say-it', 'a4440000-0000-4000-8000-000000000007', 'a4440000-0000-4000-8000-000000000005');
insert into public.cinema2_text_pool_entries values
 (auth.uid(), 'drmvyz.cinema2.say-it', 'a4440000-0000-4000-8000-000000000007', 'a4440000-0000-4000-8000-000000000005') on conflict do nothing;
do $$ begin
 if (select count(*) from public.cinema2_text_pool_entries) <> 1 then raise exception 'Membership retry is not idempotent'; end if;
 begin
  insert into public.cinema2_text_pool_entries values
   (auth.uid(), 'drmvyz.cinema2.say-it', 'a4440000-0000-4000-8000-000000000007', 'a4440000-0000-4000-8000-000000000006');
  raise exception 'Cross-preset membership was allowed';
 exception when foreign_key_violation then null; end;
 begin
  insert into public.cinema2_text_pool_entries values
   (auth.uid(), 'drmvyz.cinema2.say-it', 'a4440000-0000-4000-8000-000000000007', 'a4440000-0000-4000-8000-000000000003');
  raise exception 'Cross-user membership was allowed';
 exception when foreign_key_violation then null; end;
 if has_table_privilege('authenticated', 'public.cinema2_saved_text', 'update') then raise exception 'MVP unexpectedly allows update'; end if;
 if has_table_privilege('anon', 'public.cinema2_saved_text', 'select') then raise exception 'Anonymous reads allowed'; end if;
end $$;
reset role;
rollback;
