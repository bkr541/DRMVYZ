-- Rollback for 0043_preset_store_marketplace_schema.sql. NOT a migration: it lives outside supabase/migrations and never runs automatically.
--
-- The supported way to undo 0043 in a shared or production database is a FORWARD FIX (a new, higher-numbered migration). This script exists for a
-- disposable local/test database, or for a production database where the store was never used. It drops only objects 0043 created; it never
-- touches presets, user_presets, preset_organization or any other earlier table, and it refuses to run when doing so would lose user data.
--
--   psql "$LOCAL_TEST_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
--   SET app.preset_store_rollback = 'confirmed';
--   \i supabase/rollback/0043_preset_store_marketplace_schema.rollback.sql
--   SQL
--   (the settings and the script must share one connection, hence one psql session)
--
-- Refused unless confirmed, and refused while any of these hold rows (they are customer records and cannot be recreated):
--   store_orders, store_order_items, store_payment_events, preset_entitlement_grants, user_preset_preferences, marketplace_holding_projections
-- Catalog tables (releases, packs, editions, products, prices, provider mappings) are dropped only with a second, explicit confirmation:
--   SET app.preset_store_rollback_catalog = 'drop';
-- Holdings the marketplace created in user_presets stay in place; with the marker table gone they read as ordinary holdings (never lost).

DO $$
DECLARE
  v_user_rows bigint;
  v_catalog_rows bigint;
  v_policy record;
BEGIN
  IF COALESCE(current_setting('app.preset_store_rollback', true), '') <> 'confirmed' THEN
    RAISE EXCEPTION 'refusing to roll back 0043: run SET app.preset_store_rollback = ''confirmed''; on a disposable database (see this file''s header)';
  END IF;
  IF to_regclass('public.store_orders') IS NULL THEN
    RAISE NOTICE 'nothing to roll back: 0043 is not applied';
    RETURN;
  END IF;
  SELECT (SELECT count(*) FROM public.store_orders) + (SELECT count(*) FROM public.store_order_items) + (SELECT count(*) FROM public.store_payment_events)
       + (SELECT count(*) FROM public.preset_entitlement_grants) + (SELECT count(*) FROM public.user_preset_preferences)
       + (SELECT count(*) FROM public.marketplace_holding_projections)
  INTO v_user_rows;
  IF v_user_rows > 0 THEN
    RAISE EXCEPTION 'refusing to roll back 0043: % customer rows (orders, payment events, grants, preferences, holding markers) would be lost; forward-fix instead', v_user_rows;
  END IF;
  SELECT (SELECT count(*) FROM public.store_products) + (SELECT count(*) FROM public.preset_releases) + (SELECT count(*) FROM public.preset_packs)
  INTO v_catalog_rows;
  IF v_catalog_rows > 0 AND COALESCE(current_setting('app.preset_store_rollback_catalog', true), '') <> 'drop' THEN
    RAISE EXCEPTION 'refusing to roll back 0043: % catalog rows (products, releases, packs) exist; SET app.preset_store_rollback_catalog = ''drop''; to remove them too', v_catalog_rows;
  END IF;

  -- Policies on one new table read other new tables, so they go first or the tables could not be dropped in any order.
  FOR v_policy IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN (
      'preset_releases', 'preset_release_publications', 'preset_packs', 'preset_pack_editions', 'preset_pack_items', 'store_products',
      'store_product_prices', 'store_product_provider_refs', 'store_orders', 'store_order_items', 'store_payment_events',
      'preset_entitlement_grants', 'marketplace_holding_projections', 'user_preset_preferences')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', v_policy.policyname, v_policy.tablename);
  END LOOP;

  DROP FUNCTION IF EXISTS public.set_preset_favorite(uuid, boolean);
  DROP FUNCTION IF EXISTS public.revoke_manual_preset_entitlement(uuid, uuid, text, text);
  DROP FUNCTION IF EXISTS public.grant_manual_preset_entitlement(uuid, uuid, uuid, text, uuid);
  DROP FUNCTION IF EXISTS public.restore_store_order_item_entitlements(uuid);
  DROP FUNCTION IF EXISTS public.revoke_store_order_item_entitlements(uuid, text);
  DROP FUNCTION IF EXISTS public.fulfill_store_order_item(uuid);
  DROP FUNCTION IF EXISTS public.reconcile_preset_holding(uuid, uuid);

  DROP TABLE IF EXISTS public.marketplace_holding_projections;
  DROP TABLE IF EXISTS public.user_preset_preferences;
  DROP TABLE IF EXISTS public.preset_entitlement_grants;
  DROP TABLE IF EXISTS public.store_payment_events;
  DROP TABLE IF EXISTS public.store_order_items;
  DROP TABLE IF EXISTS public.store_orders;
  DROP TABLE IF EXISTS public.store_product_provider_refs;
  DROP TABLE IF EXISTS public.store_product_prices;
  DROP TABLE IF EXISTS public.store_products;
  DROP TABLE IF EXISTS public.preset_pack_items;
  DROP TABLE IF EXISTS public.preset_pack_editions;
  DROP TABLE IF EXISTS public.preset_packs;
  DROP TABLE IF EXISTS public.preset_release_publications;
  DROP TABLE IF EXISTS public.preset_releases;

  DROP FUNCTION IF EXISTS public.store_order_total_matches_items();
  DROP FUNCTION IF EXISTS public.store_order_items_guard();
  DROP FUNCTION IF EXISTS public.store_orders_guard();
  DROP FUNCTION IF EXISTS public.store_product_prices_guard();
  DROP FUNCTION IF EXISTS public.store_products_guard();
  DROP FUNCTION IF EXISTS public.preset_entitlement_grants_guard();
  DROP FUNCTION IF EXISTS public.preset_pack_items_guard();
  DROP FUNCTION IF EXISTS public.preset_pack_editions_guard();
  DROP FUNCTION IF EXISTS public.preset_release_publications_guard();
  DROP FUNCTION IF EXISTS public.preset_releases_guard();
  DROP FUNCTION IF EXISTS public.preset_releases_create_publication();
  DROP FUNCTION IF EXISTS public.preset_store_text_array_ok(text[], integer, integer);
END
$$;
