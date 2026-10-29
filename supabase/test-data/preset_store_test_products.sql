-- Preset store: TEST products for your real project. Run it in the Supabase SQL editor (or psql) after migration 0043.
--
-- Adds three free standalone presets and one free pack of three presets, all published so the Store can list them:
--   Prism Drift (Test), Ghost Frequency (Test), Monochrome Pulse (Test)   standalone, free
--   Midnight Signals (Test)                                               pack: Moonlit Static, Harbor Lights, Sleepless Grid
--
-- Everything is recognisable and removable: preset keys start with 'test.store.', product and pack slugs start with 'test-', titles end with
-- "(Test)". The release rows point at manifest paths that DO NOT EXIST in storage and carry made-up hashes, so these products can be listed and
-- claimed but not downloaded or installed. The preset keys match no preset shipped in the app, so nothing appears in the Preset Library.
-- Safe to run more than once: every insert skips what is already there. Remove it all with preset_store_test_products_remove.sql.

INSERT INTO public.presets (engine_id, preset_key, name, scope)
VALUES
  ('cinema2', 'test.store.prism-drift', 'Prism Drift', 'user'),
  ('cinema2', 'test.store.ghost-frequency', 'Ghost Frequency', 'user'),
  ('cinema2', 'test.store.monochrome-pulse', 'Monochrome Pulse', 'user'),
  ('cinema2', 'test.store.moonlit-static', 'Moonlit Static', 'user'),
  ('cinema2', 'test.store.harbor-lights', 'Harbor Lights', 'user'),
  ('cinema2', 'test.store.sleepless-grid', 'Sleepless Grid', 'user')
ON CONFLICT (engine_id, preset_key) DO NOTHING;

-- One release per preset: version 1.0.0, a made-up key and hash, and a path that does not exist.
INSERT INTO public.preset_releases (preset_id, version, signing_key_id, manifest_sha256, manifest_bytes, manifest_path, license_ref)
SELECT p.id, '1.0.0', 'test-key',
       encode(sha256(convert_to('test:' || p.preset_key || ':1.0.0', 'UTF8')), 'hex'), 2048,
       'test/' || p.preset_key || '/1.0.0/manifest.json', 'test-data'
FROM public.presets AS p
WHERE p.engine_id = 'cinema2' AND p.preset_key LIKE 'test.store.%'
ON CONFLICT (preset_id, version) DO NOTHING;

UPDATE public.preset_release_publications SET status = 'published'
WHERE status = 'draft' AND release_id IN (
  SELECT r.id FROM public.preset_releases AS r JOIN public.presets AS p ON p.id = r.preset_id
  WHERE p.engine_id = 'cinema2' AND p.preset_key LIKE 'test.store.%'
);

-- The pack and its three members, in order.
INSERT INTO public.preset_packs (slug, name)
VALUES ('test-midnight-signals', 'Midnight Signals (Test)')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.preset_pack_items (pack_id, preset_id, release_id, position)
SELECT pack.id, p.id, r.id, member.position
FROM (VALUES ('test.store.moonlit-static', 1), ('test.store.harbor-lights', 2), ('test.store.sleepless-grid', 3)) AS member(preset_key, position)
JOIN public.presets AS p ON p.engine_id = 'cinema2' AND p.preset_key = member.preset_key
JOIN public.preset_releases AS r ON r.preset_id = p.id AND r.version = '1.0.0'
JOIN public.preset_packs AS pack ON pack.slug = 'test-midnight-signals'
ON CONFLICT DO NOTHING;

-- Products start as drafts and are published below, once their releases are published.
INSERT INTO public.store_products (kind, preset_id, current_release_id, slug, title, subtitle, description, tags, sort_order)
SELECT 'preset', p.id, r.id, item.slug, item.title, 'Preset', item.description, ARRAY['test', 'cinema2'], item.sort_order
FROM (VALUES
  ('test.store.prism-drift', 'test-prism-drift', 'Prism Drift (Test)', 'Refracted light and fluid motion for organic visuals.', 10),
  ('test.store.ghost-frequency', 'test-ghost-frequency', 'Ghost Frequency (Test)', 'Haunting textures and spectral rhythms.', 20),
  ('test.store.monochrome-pulse', 'test-monochrome-pulse', 'Monochrome Pulse (Test)', 'Minimal forms. Maximum impact.', 30)
) AS item(preset_key, slug, title, description, sort_order)
JOIN public.presets AS p ON p.engine_id = 'cinema2' AND p.preset_key = item.preset_key
JOIN public.preset_releases AS r ON r.preset_id = p.id AND r.version = '1.0.0'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.store_products (kind, pack_id, slug, title, subtitle, description, tags, sort_order)
SELECT 'pack', pack.id, 'test-midnight-signals', 'Midnight Signals (Test)', 'Expansion Pack',
       'Atmospheric audiovisual presets for the late hours. Neon lightscapes, analog textures and ethereal motion.',
       ARRAY['test', 'cinema2'], 5
FROM public.preset_packs AS pack WHERE pack.slug = 'test-midnight-signals'
ON CONFLICT (slug) DO NOTHING;

UPDATE public.store_products SET status = 'published' WHERE slug LIKE 'test-%' AND status = 'draft';

-- What you should see: four rows, all published.
SELECT slug, title, kind, status, price_policy FROM public.store_products WHERE slug LIKE 'test-%' ORDER BY sort_order;
