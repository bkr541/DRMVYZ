-- Disposable Supabase test DB only, after 0047; no production credentials.
-- psql "$LOCAL_TEST_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/model_assets_security.sql
-- All fixtures and object metadata are rolled back. Storage bytes/API signing
-- must additionally be exercised through the real Storage API (see docs).
begin;
create function pg_temp.model_assert(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Model assertion: %', message; end if; end $$;
create function pg_temp.model_denied(statement text, expected_code text default '42501') returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_code then return; end if;
    raise;
  end;
  raise exception 'Unexpectedly allowed: %', statement;
end $$;

insert into auth.users(id, email) values
 ('a0470000-0000-4000-8000-000000000001', 'model-a@example.invalid'),
 ('b0470000-0000-4000-8000-000000000001', 'model-b@example.invalid');
insert into public.profiles(id, email) values
 ('a0470000-0000-4000-8000-000000000001', 'model-a@example.invalid'),
 ('b0470000-0000-4000-8000-000000000001', 'model-b@example.invalid') on conflict (id) do nothing;
insert into public.media_items(id, user_id, name, type, storage_path) values
 ('a0470000-0000-4000-8000-000000000002', 'a0470000-0000-4000-8000-000000000001', 'A image', 'image', 'a/source.png'),
 ('b0470000-0000-4000-8000-000000000002', 'b0470000-0000-4000-8000-000000000001', 'B image', 'image', 'b/source.png');
insert into public.media_collections(id, user_id, name) values
 ('a0470000-0000-4000-8000-000000000003', 'a0470000-0000-4000-8000-000000000001', 'Model A collection'),
 ('b0470000-0000-4000-8000-000000000003', 'b0470000-0000-4000-8000-000000000001', 'Model B collection');
insert into public.model_assets(id, user_id, source_media_id, name) values
 ('a0470000-0000-4000-8000-000000000004', 'a0470000-0000-4000-8000-000000000001', 'a0470000-0000-4000-8000-000000000002', 'A model'),
 ('b0470000-0000-4000-8000-000000000004', 'b0470000-0000-4000-8000-000000000001', 'b0470000-0000-4000-8000-000000000002', 'B model');

-- B stages a private operation; A must not see or mutate it.
select set_config('request.jwt.claim.sub', 'b0470000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.begin_model_version('b0470000-0000-4000-8000-000000000004', 'b0470000-0000-4000-8000-000000000005', 0, 'png', false, '{"schemaVersion":1}', '{}');
reset role;
insert into storage.objects(bucket_id, name, metadata) values
 ('model-assets', 'b0470000-0000-4000-8000-000000000001/b0470000-0000-4000-8000-000000000004/1/b0470000-0000-4000-8000-000000000005/model.glb', '{"size":24,"mimetype":"model/gltf-binary"}'),
 ('model-assets', 'b0470000-0000-4000-8000-000000000001/b0470000-0000-4000-8000-000000000004/1/b0470000-0000-4000-8000-000000000005/source.png', '{"size":12,"mimetype":"image/png"}'),
 ('model-assets', 'b0470000-0000-4000-8000-000000000001/b0470000-0000-4000-8000-000000000004/1/b0470000-0000-4000-8000-000000000005/trace.svg', '{"size":12,"mimetype":"image/svg+xml"}');
set local role authenticated;
select public.publish_model_version('b0470000-0000-4000-8000-000000000005');
reset role;

select set_config('request.jwt.claim.sub', 'a0470000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.model_assert((select count(*) = 1 from public.model_assets), 'A sees only its model');
select pg_temp.model_assert((select count(*) = 0 from public.model_version_operations), 'B operation hidden');
select pg_temp.model_assert((select count(*) = 0 from public.model_asset_versions), 'B version hidden');
select pg_temp.model_assert((select count(*) = 0 from storage.objects where bucket_id = 'model-assets'), 'B object hidden (signing prerequisite)');
select pg_temp.model_denied($q$insert into public.model_assets(user_id, name) values ('b0470000-0000-4000-8000-000000000001', 'forged')$q$);
select pg_temp.model_denied($q$insert into public.model_assets(user_id, source_media_id, name) values (auth.uid(), 'b0470000-0000-4000-8000-000000000002', 'foreign source')$q$);
select pg_temp.model_denied($q$update public.model_assets set current_version = 999$q$);
select pg_temp.model_denied($q$update public.model_assets set user_id = 'b0470000-0000-4000-8000-000000000001'$q$);
select pg_temp.model_denied($q$delete from public.model_assets where id = 'b0470000-0000-4000-8000-000000000004'$q$);
select pg_temp.model_denied($q$select public.publish_model_version('b0470000-0000-4000-8000-000000000005')$q$);
select pg_temp.model_denied($q$select public.cancel_model_version('b0470000-0000-4000-8000-000000000005')$q$);
select pg_temp.model_denied($q$select public.request_model_deletion('b0470000-0000-4000-8000-000000000004')$q$);
select pg_temp.model_denied($q$select public.finalize_model_deletion('b0470000-0000-4000-8000-000000000004')$q$);
select pg_temp.model_denied($q$select public.begin_model_version('b0470000-0000-4000-8000-000000000004', 'a0470000-0000-4000-8000-000000000006', 0, 'png', false, '{"schemaVersion":1}', '{}')$q$);
select pg_temp.model_denied($q$insert into public.model_collection_items(collection_id, model_asset_id) values ('b0470000-0000-4000-8000-000000000003', 'a0470000-0000-4000-8000-000000000004')$q$);
select pg_temp.model_denied($q$insert into public.model_collection_items(collection_id, model_asset_id) values ('a0470000-0000-4000-8000-000000000003', 'b0470000-0000-4000-8000-000000000004')$q$);
insert into public.model_collection_items(collection_id, model_asset_id) values ('a0470000-0000-4000-8000-000000000003', 'a0470000-0000-4000-8000-000000000004');
select pg_temp.model_denied($q$insert into storage.objects(bucket_id, name) values ('model-assets', 'b0470000-0000-4000-8000-000000000001/forged.glb')$q$);
do $$ declare affected integer; begin
  update public.model_assets set name = 'stolen' where id = 'b0470000-0000-4000-8000-000000000004';
  get diagnostics affected = row_count;
  perform pg_temp.model_assert(affected = 0, 'Cannot update B model');
  update storage.objects set metadata = '{}' where bucket_id = 'model-assets';
  get diagnostics affected = row_count;
  perform pg_temp.model_assert(affected = 0, 'Cannot update B storage');
  delete from storage.objects where bucket_id = 'model-assets';
  get diagnostics affected = row_count;
  perform pg_temp.model_assert(affected = 0, 'Cannot delete B storage');
end $$;

-- Two simultaneous-edit identities have unique paths. Publishing one makes the
-- other stale. These sequential assertions test CAS, not two-connection locking.
select public.begin_model_version('a0470000-0000-4000-8000-000000000004', 'a0470000-0000-4000-8000-000000000005', 0, 'png', false, '{"schemaVersion":1}', '{}');
select public.begin_model_version('a0470000-0000-4000-8000-000000000004', 'a0470000-0000-4000-8000-000000000006', 0, 'png', false, '{"schemaVersion":1}', '{}');
select pg_temp.model_denied($q$select public.publish_model_version('a0470000-0000-4000-8000-000000000005')$q$, '23514');
select pg_temp.model_assert((select current_version = 0 from public.model_assets), 'Missing objects cannot publish');
insert into storage.objects(bucket_id, name, metadata) values
 ('model-assets', 'a0470000-0000-4000-8000-000000000001/a0470000-0000-4000-8000-000000000004/1/a0470000-0000-4000-8000-000000000005/model.glb', '{"size":24,"mimetype":"model/gltf-binary"}'),
 ('model-assets', 'a0470000-0000-4000-8000-000000000001/a0470000-0000-4000-8000-000000000004/1/a0470000-0000-4000-8000-000000000005/source.png', '{"size":12,"mimetype":"image/png"}'),
 ('model-assets', 'a0470000-0000-4000-8000-000000000001/a0470000-0000-4000-8000-000000000004/1/a0470000-0000-4000-8000-000000000005/trace.svg', '{"size":12,"mimetype":"image/svg+xml"}');
select public.publish_model_version('a0470000-0000-4000-8000-000000000005');
select public.publish_model_version('a0470000-0000-4000-8000-000000000005');
select pg_temp.model_assert((select count(*) = 1 from public.model_asset_versions), 'Publish retry is idempotent');
select pg_temp.model_denied($q$select public.publish_model_version('a0470000-0000-4000-8000-000000000006')$q$, '40001');
select pg_temp.model_denied($q$update public.model_asset_versions set version = 99$q$);
select pg_temp.model_denied($q$delete from public.model_asset_versions$q$);
select pg_temp.model_denied($q$insert into public.model_asset_versions(model_asset_id, version) values ('a0470000-0000-4000-8000-000000000004', 99)$q$);
select pg_temp.model_assert((public.cancel_model_version('a0470000-0000-4000-8000-000000000005')->>'state') = 'published', 'Cancellation never rolls back published files');
select pg_temp.model_assert(not public.model_storage_write_allowed('a0470000-0000-4000-8000-000000000001/a0470000-0000-4000-8000-000000000004/1/a0470000-0000-4000-8000-000000000005/model.glb', 'update'), 'Published files cannot change');
select pg_temp.model_assert(not public.model_storage_write_allowed('a0470000-0000-4000-8000-000000000001/a0470000-0000-4000-8000-000000000004/1/a0470000-0000-4000-8000-000000000005/model.glb', 'delete'), 'Published files cannot be removed');
select public.cancel_model_version('a0470000-0000-4000-8000-000000000006');
select public.cancel_model_version('a0470000-0000-4000-8000-000000000006', true);

-- A second version with an SVG source and thumbnail preserves version 1.
select public.begin_model_version('a0470000-0000-4000-8000-000000000004', 'a0470000-0000-4000-8000-000000000007', 1, 'svg', true, '{"schemaVersion":1}', '{}');
insert into storage.objects(bucket_id, name, metadata) values
 ('model-assets', 'a0470000-0000-4000-8000-000000000001/a0470000-0000-4000-8000-000000000004/2/a0470000-0000-4000-8000-000000000007/model.glb', '{"size":24,"mimetype":"model/gltf-binary"}'),
 ('model-assets', 'a0470000-0000-4000-8000-000000000001/a0470000-0000-4000-8000-000000000004/2/a0470000-0000-4000-8000-000000000007/source.svg', '{"size":12,"mimetype":"image/svg+xml"}'),
 ('model-assets', 'a0470000-0000-4000-8000-000000000001/a0470000-0000-4000-8000-000000000004/2/a0470000-0000-4000-8000-000000000007/trace.svg', '{"size":12,"mimetype":"image/svg+xml"}');
select pg_temp.model_denied($q$select public.publish_model_version('a0470000-0000-4000-8000-000000000007')$q$, '23514');
insert into storage.objects(bucket_id, name, metadata) values
 ('model-assets', 'a0470000-0000-4000-8000-000000000001/a0470000-0000-4000-8000-000000000004/2/a0470000-0000-4000-8000-000000000007/thumbnail.png', '{"size":12,"mimetype":"image/png"}');
select public.publish_model_version('a0470000-0000-4000-8000-000000000007');
select pg_temp.model_assert((select count(*) = 2 from public.model_asset_versions), 'Both immutable versions remain retrievable');
select pg_temp.model_assert((select current_version = 2 from public.model_assets), 'Current version advanced by CAS');
do $$ declare affected integer; begin
  update storage.objects set metadata = '{}' where bucket_id = 'model-assets';
  get diagnostics affected = row_count;
  perform pg_temp.model_assert(affected = 0, 'Published storage update is denied');
  delete from storage.objects where bucket_id = 'model-assets';
  get diagnostics affected = row_count;
  perform pg_temp.model_assert(affected = 0, 'Published storage delete is denied');
end $$;

-- Removing the original image cannot remove its saved snapshot.
reset role;
delete from public.media_items where id = 'a0470000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.model_assert((select source_media_id is null from public.model_assets), 'Source FK becomes null');
select pg_temp.model_assert((select count(*) = 7 from storage.objects where bucket_id = 'model-assets'), 'Independent snapshot is retained');
select public.request_model_deletion('a0470000-0000-4000-8000-000000000004');
select pg_temp.model_denied($q$select public.finalize_model_deletion('a0470000-0000-4000-8000-000000000004')$q$, '23514');
delete from storage.objects where bucket_id = 'model-assets';
select public.finalize_model_deletion('a0470000-0000-4000-8000-000000000004');
select pg_temp.model_assert((select count(*) = 0 from public.model_assets), 'Deletion finalizes only after cleanup');
select pg_temp.model_assert((select count(*) = 0 from public.model_collection_items), 'Deletion cascades memberships');
reset role;
select pg_temp.model_assert((select name = 'B model' from public.model_assets), 'B metadata unchanged');
select pg_temp.model_assert((select count(*) = 3 from storage.objects where bucket_id = 'model-assets'), 'B storage unchanged');
set local role anon;
select pg_temp.model_denied('select * from public.model_assets');
select pg_temp.model_denied($q$select public.publish_model_version('b0470000-0000-4000-8000-000000000005')$q$);
reset role;
select 'Model domain security and lifecycle assertions passed; fixtures rolled back.' as result;
rollback;
