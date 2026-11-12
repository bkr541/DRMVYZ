-- Disposable test DB, after migrations through 0048. All fixtures roll back.
begin;
create function pg_temp.organization_assert(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Organization assertion: %', message; end if; end $$;
create function pg_temp.organization_denied(statement text, expected_code text default '42501') returns void language plpgsql as $$
begin
  begin execute statement; exception when others then if sqlstate = expected_code then return; end if; raise; end;
  raise exception 'Unexpectedly allowed: %', statement;
end $$;
insert into auth.users(id, email) values ('a0480000-0000-4000-8000-000000000001','a48@example.invalid'),('b0480000-0000-4000-8000-000000000001','b48@example.invalid');
insert into public.profiles(id,email) values ('a0480000-0000-4000-8000-000000000001','a48@example.invalid'),('b0480000-0000-4000-8000-000000000001','b48@example.invalid') on conflict(id) do nothing;
insert into public.media_collections(id,user_id,name) values ('a0480000-0000-4000-8000-000000000002','a0480000-0000-4000-8000-000000000001','A'),('b0480000-0000-4000-8000-000000000002','b0480000-0000-4000-8000-000000000001','B');
insert into public.model_assets(id,user_id,name) values ('a0480000-0000-4000-8000-000000000003','a0480000-0000-4000-8000-000000000001','Original'),('b0480000-0000-4000-8000-000000000003','b0480000-0000-4000-8000-000000000001','B');
select set_config('request.jwt.claim.sub','a0480000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.update_model_metadata('a0480000-0000-4000-8000-000000000003',0,' Renamed ','Description',true,array['Logo','Logo','Gold'],array['a0480000-0000-4000-8000-000000000002']::uuid[]);
select pg_temp.organization_assert(public.get_model_organization('a0480000-0000-4000-8000-000000000003') = '{"tags":["Gold","Logo"],"collection_ids":["a0480000-0000-4000-8000-000000000002"]}'::jsonb,'Owned tags and collection round trip');
select pg_temp.organization_assert((select name='Renamed' and favorite and current_version=0 from public.model_assets where id='a0480000-0000-4000-8000-000000000003'),'Metadata does not publish geometry');
select pg_temp.organization_denied($q$select public.update_model_metadata('a0480000-0000-4000-8000-000000000003',1,'Stale',null,false,'{}','{}')$q$,'40001');
select pg_temp.organization_denied($q$select public.update_model_metadata('a0480000-0000-4000-8000-000000000003',0,'Foreign collection',null,false,'{}',array['b0480000-0000-4000-8000-000000000002']::uuid[])$q$,'23514');
select pg_temp.organization_assert((select name='Renamed' and favorite from public.model_assets where id='a0480000-0000-4000-8000-000000000003'),'Failed transaction preserves metadata');
select pg_temp.organization_denied($q$delete from public.model_asset_tags$q$);
select pg_temp.organization_denied($q$select public.get_model_organization('b0480000-0000-4000-8000-000000000003')$q$);
select pg_temp.organization_denied($q$select public.update_model_metadata('b0480000-0000-4000-8000-000000000003',0,'Stolen',null,false,'{}','{}')$q$);
reset role;
select set_config('request.jwt.claim.sub','b0480000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.organization_assert((select count(*)=0 from public.model_asset_tags),'B cannot see A tags');
select pg_temp.organization_denied($q$select public.get_model_organization('a0480000-0000-4000-8000-000000000003')$q$);
reset role;
select set_config('request.jwt.claim.sub','a0480000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.update_model_metadata('a0480000-0000-4000-8000-000000000003',0,'Renamed',null,true,'{}','{}');
select pg_temp.organization_assert(public.get_model_organization('a0480000-0000-4000-8000-000000000003')='{"tags":[],"collection_ids":[]}'::jsonb,'Membership removal persists');
reset role;
set local role anon;
select pg_temp.organization_denied($q$select public.get_model_organization('a0480000-0000-4000-8000-000000000003')$q$);
reset role;
select 'Model organization ownership, atomicity and concurrency checks passed' as result;
rollback;
