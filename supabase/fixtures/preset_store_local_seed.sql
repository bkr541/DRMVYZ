-- Preset store: LOCAL / TEST fixtures. Never run against production or a linked remote project.
--
-- Seeds the catalog side of the marketplace only: three synthetic presets, their releases, one free pack, one standalone free product, and a
-- second standalone product that OVERLAPS the pack (it lists a preset the pack also contains). It inserts no grants and no holdings, so no
-- account owns anything after it runs.
--
-- It refuses to run unless the session opts in, and refuses to touch a database that already holds real store products:
--   SET app.preset_store_local_fixtures = 'local-test';
-- Re-runnable: every insert is an upsert on a fixed id.

DO $$
BEGIN
  IF COALESCE(current_setting('app.preset_store_local_fixtures', true), '') <> 'local-test' THEN
    RAISE EXCEPTION 'refusing to seed preset-store fixtures: run SET app.preset_store_local_fixtures = ''local-test''; on a disposable local/test database first';
  END IF;
  IF EXISTS (SELECT 1 FROM public.store_products WHERE slug NOT LIKE 'fixture-%') THEN
    RAISE EXCEPTION 'refusing to seed preset-store fixtures: this database already has non-fixture store products';
  END IF;
END
$$;

INSERT INTO public.presets (id, engine_id, preset_key, name, scope)
VALUES
  ('00000000-0000-4000-8000-00000000f001', 'cinema2', 'fixture.store.pack-a', 'Fixture Pack A', 'user'),
  ('00000000-0000-4000-8000-00000000f002', 'cinema2', 'fixture.store.pack-b', 'Fixture Pack B', 'user'),
  ('00000000-0000-4000-8000-00000000f003', 'cinema2', 'fixture.store.solo', 'Fixture Solo', 'user')
ON CONFLICT (engine_id, preset_key) DO NOTHING;

INSERT INTO public.preset_releases (id, preset_id, version, signing_key_id, manifest_sha256, manifest_bytes, manifest_path)
SELECT r.release_id, p.id, '1.0.0', 'fixture-key', encode(sha256(convert_to('fixture:' || p.preset_key || ':1.0.0', 'UTF8')), 'hex'), 2048,
       'fixtures/' || p.preset_key || '/1.0.0/manifest.json'
FROM (VALUES
  ('00000000-0000-4000-8000-00000000f101'::uuid, 'fixture.store.pack-a'),
  ('00000000-0000-4000-8000-00000000f102'::uuid, 'fixture.store.pack-b'),
  ('00000000-0000-4000-8000-00000000f103'::uuid, 'fixture.store.solo')
) AS r(release_id, preset_key)
JOIN public.presets AS p ON p.engine_id = 'cinema2' AND p.preset_key = r.preset_key
ON CONFLICT (preset_id, version) DO NOTHING;

UPDATE public.preset_release_publications SET status = 'published'
WHERE status = 'draft' AND release_id IN (
  '00000000-0000-4000-8000-00000000f101', '00000000-0000-4000-8000-00000000f102', '00000000-0000-4000-8000-00000000f103'
);

INSERT INTO public.preset_packs (id, slug, name)
VALUES ('00000000-0000-4000-8000-00000000f201', 'fixture-free-pack', 'Fixture Free Pack')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.preset_pack_items (pack_id, preset_id, release_id, position)
VALUES
  ('00000000-0000-4000-8000-00000000f201', '00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000f101', 1),
  ('00000000-0000-4000-8000-00000000f201', '00000000-0000-4000-8000-00000000f002', '00000000-0000-4000-8000-00000000f102', 2)
ON CONFLICT DO NOTHING;

INSERT INTO public.store_products (id, kind, preset_id, pack_id, current_release_id, slug, title, description, tags)
VALUES
  ('00000000-0000-4000-8000-00000000f301', 'pack', NULL, '00000000-0000-4000-8000-00000000f201', NULL,
   'fixture-free-pack', 'Fixture Free Pack', 'Two fixture presets, free to claim (local test data).', ARRAY['fixture', 'free']),
  ('00000000-0000-4000-8000-00000000f302', 'preset', '00000000-0000-4000-8000-00000000f003', NULL, '00000000-0000-4000-8000-00000000f103',
   'fixture-solo', 'Fixture Solo', 'One standalone fixture preset (local test data).', ARRAY['fixture']),
  ('00000000-0000-4000-8000-00000000f303', 'preset', '00000000-0000-4000-8000-00000000f001', NULL, '00000000-0000-4000-8000-00000000f101',
   'fixture-pack-a-solo', 'Fixture Pack A (single)', 'Lists a preset the free pack also contains: the overlap case (local test data).', ARRAY['fixture', 'overlap'])
ON CONFLICT (slug) DO NOTHING;

UPDATE public.store_products SET status = 'published'
WHERE status = 'draft' AND id IN (
  '00000000-0000-4000-8000-00000000f301', '00000000-0000-4000-8000-00000000f302', '00000000-0000-4000-8000-00000000f303'
);
