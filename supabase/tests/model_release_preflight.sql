-- Read-only deployment preflight: run as the project database owner after 0047/0048.
-- Makes no user, model, object, schema or policy changes.
begin read only;
do $$
declare table_name text; function_name text; policy_name text;
begin
  foreach table_name in array array['model_assets','model_asset_versions','model_version_operations','model_collection_items','model_asset_tags'] loop
    if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=table_name and c.relrowsecurity) then raise exception 'Missing model table or disabled RLS: %',table_name; end if;
    if has_table_privilege('anon','public.'||table_name,'SELECT') or has_table_privilege('anon','public.'||table_name,'INSERT') or has_table_privilege('anon','public.'||table_name,'UPDATE') or has_table_privilege('anon','public.'||table_name,'DELETE') then raise exception 'Anonymous table access: %',table_name; end if;
  end loop;
  if not exists(select 1 from storage.buckets where id='model-assets' and public=false and file_size_limit=67108864 and allowed_mime_types @> array['model/gltf-binary','image/png','image/svg+xml']::text[]) then raise exception 'Private model bucket configuration is missing or incorrect'; end if;
  foreach policy_name in array array['model_storage_select','model_storage_insert','model_storage_update','model_storage_delete'] loop
    if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname=policy_name and roles @> array['authenticated']::name[]) then raise exception 'Missing authenticated Storage policy: %',policy_name; end if;
  end loop;
  foreach function_name in array array[
    'public.begin_model_version(uuid,uuid,integer,text,boolean,jsonb,jsonb)',
    'public.publish_model_version(uuid)', 'public.cancel_model_version(uuid,boolean)',
    'public.request_model_deletion(uuid)', 'public.finalize_model_deletion(uuid)',
    'public.get_model_organization(uuid)', 'public.update_model_metadata(uuid,integer,text,text,boolean,text[],uuid[])'
  ] loop
    if to_regprocedure(function_name) is null then raise exception 'Missing model RPC: %',function_name; end if;
    if not has_function_privilege('authenticated',function_name,'EXECUTE') or has_function_privilege('anon',function_name,'EXECUTE') then raise exception 'Incorrect model RPC access: %',function_name; end if;
  end loop;
  if has_table_privilege('authenticated','public.model_asset_versions','INSERT') or has_table_privilege('authenticated','public.model_asset_versions','UPDATE') or has_table_privilege('authenticated','public.model_asset_versions','DELETE') or has_table_privilege('authenticated','public.model_asset_tags','INSERT') then raise exception 'Clients can directly modify immutable versions or tag joins'; end if;
  raise notice 'Model schema, private bucket, RLS and RPC privilege preflight passed. Live account/Storage acceptance is still required.';
end $$;
rollback;
