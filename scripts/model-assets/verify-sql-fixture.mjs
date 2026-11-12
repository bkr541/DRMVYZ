// PostgreSQL logic fixture only. Does not create real Supabase identities or use cloud credentials.
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const modulePath = process.env.DRMVYZ_MODEL_PGLITE_MODULE
if (!modulePath) throw new Error('Set DRMVYZ_MODEL_PGLITE_MODULE to an existing disposable PGlite module; this fixture does not access Supabase.')
const { PGlite } = await import(pathToFileURL(path.resolve(modulePath)).href)
import fs from 'node:fs/promises'
const db = new PGlite()
await db.exec(`
 create role anon;
 create role authenticated;
 create role service_role bypassrls;
 create schema auth;
 create schema storage;
 create table auth.users(id uuid primary key, email text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
 create table public.profiles(id uuid primary key references auth.users(id), email text);
 create table public.media_items(id uuid primary key, user_id uuid references public.profiles(id), name text not null, type text not null check(type in ('image','video')), storage_path text not null);
 create table public.media_collections(id uuid primary key, user_id uuid references public.profiles(id), name text not null);
 create table public.media_tags(id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id), name text not null, unique(user_id,name));
 alter table public.media_tags enable row level security;
 create policy tags_owner on public.media_tags for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
 create table storage.buckets(id text primary key, name text not null, public boolean, file_size_limit bigint, allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, metadata jsonb, unique(bucket_id, name));
 alter table storage.objects enable row level security;
 create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
 grant usage on schema public, auth, storage to anon, authenticated, service_role;
 grant execute on function auth.uid(), storage.foldername(text) to anon, authenticated, service_role;
 grant all on all tables in schema public, storage to authenticated, anon, service_role;
 alter default privileges in schema public grant all on tables to authenticated, anon, service_role;
`)
const root = process.cwd()
try {
 await db.exec(await fs.readFile(`${root}/supabase/migrations/0047_model_assets.sql`, 'utf8'))
 await db.exec(await fs.readFile(`${root}/supabase/migrations/0048_model_organization.sql`, 'utf8'))
 await db.exec(await fs.readFile(`${root}/supabase/tests/model_release_preflight.sql`, 'utf8'))
 console.log('Read-only release preflight passed.')
 console.log('0047 + 0048 migrations applied to a Supabase-shaped PostgreSQL fixture (PGlite).')
 const results = await db.exec(await fs.readFile(`${root}/supabase/tests/model_assets_security.sql`, 'utf8'))
 const organization = await db.exec(await fs.readFile(`${root}/supabase/tests/model_organization_security.sql`, 'utf8')); console.log(organization.flatMap(r => r.rows).filter(r => r.result))
 console.log(results.flatMap(r => r.rows).filter(r => r.result))
} catch (error) {
 console.error(error.message, error.code, error.detail, error.where)
 process.exitCode = 1
} finally { await db.close() }
