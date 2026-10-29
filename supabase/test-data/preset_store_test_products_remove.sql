-- Removes everything preset_store_test_products.sql created, and nothing else: only keys starting 'test.store.' and slugs starting 'test-'.
--
-- A published release cannot normally be deleted (a migration safety rule), so this switches that one rule off for the length of the
-- transaction and switches it back on before committing. If anything fails, the whole script rolls back and the rule stays on.

BEGIN;

ALTER TABLE public.preset_releases DISABLE TRIGGER trg_preset_releases_guard;

DELETE FROM public.preset_entitlement_grants
WHERE product_id IN (SELECT id FROM public.store_products WHERE slug LIKE 'test-%');

DELETE FROM public.store_products WHERE slug LIKE 'test-%';

DELETE FROM public.preset_pack_items
WHERE pack_id IN (SELECT id FROM public.preset_packs WHERE slug LIKE 'test-%');

DELETE FROM public.preset_packs WHERE slug LIKE 'test-%';

DELETE FROM public.preset_releases
WHERE preset_id IN (SELECT id FROM public.presets WHERE engine_id = 'cinema2' AND preset_key LIKE 'test.store.%');

ALTER TABLE public.preset_releases ENABLE TRIGGER trg_preset_releases_guard;

DELETE FROM public.presets WHERE engine_id = 'cinema2' AND preset_key LIKE 'test.store.%';

COMMIT;

-- What you should see: all zeros.
SELECT
  (SELECT count(*) FROM public.store_products WHERE slug LIKE 'test-%') AS products,
  (SELECT count(*) FROM public.preset_packs WHERE slug LIKE 'test-%') AS packs,
  (SELECT count(*) FROM public.presets WHERE preset_key LIKE 'test.store.%') AS presets;
