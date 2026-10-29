-- Preset store: LOCAL / TEST fixtures. Never run against production or a linked remote project.
--
-- Seeds the catalog side of the marketplace only: three synthetic presets, their releases, one FREE pack, one standalone product, and a second
-- standalone product that OVERLAPS the pack (it sells a preset the pack also contains). It inserts no orders, no payment events, no grants
-- and no holdings, so no account owns anything after it runs. Prices are test-environment prices with no provider mapping.
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

INSERT INTO public.preset_releases (id, preset_id, version, manifest_sha256, manifest_bytes, manifest_path)
SELECT r.release_id, p.id, '1.0.0', encode(sha256(convert_to('fixture:' || p.preset_key || ':1.0.0', 'UTF8')), 'hex'), 2048,
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

INSERT INTO public.preset_pack_editions (id, pack_id, edition_number)
VALUES ('00000000-0000-4000-8000-00000000f211', '00000000-0000-4000-8000-00000000f201', 1)
ON CONFLICT (pack_id, edition_number) DO NOTHING;

-- Membership is frozen once an edition is published (and the freeze trigger fires even for ON CONFLICT DO NOTHING), so on a re-run the members
-- are only inserted while the edition is still a draft.
INSERT INTO public.preset_pack_items (edition_id, preset_id, release_id, position)
SELECT member.edition_id, member.preset_id, member.release_id, member.position
FROM (VALUES
  ('00000000-0000-4000-8000-00000000f211'::uuid, '00000000-0000-4000-8000-00000000f001'::uuid, '00000000-0000-4000-8000-00000000f101'::uuid, 1),
  ('00000000-0000-4000-8000-00000000f211'::uuid, '00000000-0000-4000-8000-00000000f002'::uuid, '00000000-0000-4000-8000-00000000f102'::uuid, 2)
) AS member(edition_id, preset_id, release_id, position)
WHERE EXISTS (SELECT 1 FROM public.preset_pack_editions AS edition WHERE edition.id = member.edition_id AND edition.status = 'draft')
ON CONFLICT DO NOTHING;

UPDATE public.preset_pack_editions SET status = 'published' WHERE id = '00000000-0000-4000-8000-00000000f211' AND status = 'draft';

INSERT INTO public.store_products (id, kind, preset_id, pack_id, current_release_id, current_edition_id, slug, title, description, tags)
VALUES
  ('00000000-0000-4000-8000-00000000f301', 'pack', NULL, '00000000-0000-4000-8000-00000000f201', NULL, '00000000-0000-4000-8000-00000000f211',
   'fixture-free-pack', 'Fixture Free Pack', 'Two fixture presets, free to claim (local test data).', ARRAY['fixture', 'free']),
  ('00000000-0000-4000-8000-00000000f302', 'preset', '00000000-0000-4000-8000-00000000f003', NULL, '00000000-0000-4000-8000-00000000f103', NULL,
   'fixture-solo', 'Fixture Solo', 'One standalone fixture preset (local test data).', ARRAY['fixture']),
  ('00000000-0000-4000-8000-00000000f303', 'preset', '00000000-0000-4000-8000-00000000f001', NULL, '00000000-0000-4000-8000-00000000f101', NULL,
   'fixture-pack-a-solo', 'Fixture Pack A (single)', 'Sells a preset the free pack also contains: the overlap case (local test data).', ARRAY['fixture', 'overlap'])
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.store_product_prices (id, product_id, currency, amount_minor, environment)
VALUES
  ('00000000-0000-4000-8000-00000000f401', '00000000-0000-4000-8000-00000000f301', 'USD', 0, 'test'),
  ('00000000-0000-4000-8000-00000000f402', '00000000-0000-4000-8000-00000000f302', 'USD', 799, 'test'),
  ('00000000-0000-4000-8000-00000000f403', '00000000-0000-4000-8000-00000000f303', 'USD', 499, 'test')
ON CONFLICT (id) DO NOTHING;

UPDATE public.store_products SET status = 'published'
WHERE status = 'draft' AND id IN (
  '00000000-0000-4000-8000-00000000f301', '00000000-0000-4000-8000-00000000f302', '00000000-0000-4000-8000-00000000f303'
);
