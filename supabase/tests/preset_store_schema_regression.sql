-- Preset store schema regression (Phase 01). Run AFTER every migration through 0043 has been applied, on a DISPOSABLE local/test database only.
--
--   psql "$LOCAL_TEST_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/preset_store_schema_regression.sql
--
-- The whole file runs inside one transaction and ends in ROLLBACK, so it leaves nothing behind. Any failed check raises an exception and
-- (with ON_ERROR_STOP) stops the run with a non-zero exit; a clean run ends with the notice "PRESET STORE REGRESSION: N checks passed".
-- It creates its own rows (preset keys 'regression.*'), emulates anon / authenticated / service_role with SET LOCAL ROLE plus the JWT
-- subject setting auth.uid() reads, and covers: privileges and RLS, constraints, immutability, pack editions, overlapping sources,
-- refunds / disputes, the legacy-holding rule and the favourite RPC. If the optional fixtures (supabase/fixtures) are loaded it also checks
-- their shape. It must run as a role that can SET ROLE to the three API roles (postgres on Supabase).

BEGIN;

CREATE SCHEMA pst;
GRANT USAGE ON SCHEMA pst TO PUBLIC;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Test helpers (live in a throwaway schema, rolled back with everything else)
-- ---------------------------------------------------------------------------------------------------------------------------------

CREATE FUNCTION pst.u(p_n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid $$;

CREATE FUNCTION pst.passed() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('pst.checks', (COALESCE(NULLIF(current_setting('pst.checks', true), ''), '0')::integer + 1)::text, true);
END;
$$;

CREATE FUNCTION pst.check(p_condition boolean, p_label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_condition IS NOT TRUE THEN
    RAISE EXCEPTION 'CHECK FAILED: %', p_label;
  END IF;
  PERFORM pst.passed();
END;
$$;

-- Runs one statement and requires it to fail. p_state may be a full SQLSTATE or just its two-character class (e.g. '23').
CREATE FUNCTION pst.fails(p_sql text, p_label text, p_state text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF p_state IS NOT NULL AND left(SQLSTATE, length(p_state)) <> p_state THEN
      RAISE EXCEPTION 'CHECK FAILED: % (expected SQLSTATE %, got % %)', p_label, p_state, SQLSTATE, SQLERRM;
    END IF;
    PERFORM pst.passed();
    RETURN;
  END;
  RAISE EXCEPTION 'CHECK FAILED: % (statement succeeded but must fail)', p_label;
END;
$$;

CREATE FUNCTION pst.works(p_sql text, p_label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  PERFORM pst.passed();
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'CHECK FAILED: % (unexpected error % %)', p_label, SQLSTATE, SQLERRM;
END;
$$;

CREATE FUNCTION pst.count(p_sql text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v bigint;
BEGIN
  EXECUTE 'SELECT count(*) FROM (' || p_sql || ') AS counted' INTO v;
  RETURN v;
END;
$$;

CREATE FUNCTION pst.expect_count(p_sql text, p_expected bigint, p_label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v bigint := pst.count(p_sql);
BEGIN
  IF v IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'CHECK FAILED: % (expected % rows, got %)', p_label, p_expected, v;
  END IF;
  PERFORM pst.passed();
END;
$$;

CREATE FUNCTION pst.as_admin() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
END;
$$;

CREATE FUNCTION pst.as_user(p_user integer) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', pst.u(p_user)::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pst.u(p_user)::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
END;
$$;

CREATE FUNCTION pst.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  SET LOCAL ROLE anon;
END;
$$;

CREATE FUNCTION pst.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  SET LOCAL ROLE service_role;
END;
$$;

-- Fixture builders -------------------------------------------------------------------------------------------------------------

CREATE FUNCTION pst.mk_preset(p_n integer, p_scope text DEFAULT 'user') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.presets (id, engine_id, preset_key, name, scope)
  VALUES (pst.u(p_n), 'cinema2', 'regression.preset-' || p_n, 'Regression preset ' || p_n, p_scope);
END;
$$;

CREATE FUNCTION pst.mk_release(p_n integer, p_preset integer, p_version text DEFAULT '1.0.0', p_publish boolean DEFAULT true) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.preset_releases (id, preset_id, version, manifest_sha256, manifest_bytes, manifest_path)
  VALUES (pst.u(p_n), pst.u(p_preset), p_version, encode(sha256(convert_to('regression:' || p_n, 'UTF8')), 'hex'), 1024,
          'regression/preset-' || p_preset || '/' || p_version || '/manifest.json');
  IF p_publish THEN
    UPDATE public.preset_release_publications SET status = 'published' WHERE release_id = pst.u(p_n);
  END IF;
END;
$$;

CREATE FUNCTION pst.mk_user(p_n integer) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO auth.users (id, email) VALUES (pst.u(p_n), 'regression-user-' || p_n || '@example.invalid') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id, email) VALUES (pst.u(p_n), 'regression-user-' || p_n || '@example.invalid') ON CONFLICT (id) DO NOTHING;
END;
$$;

-- A published standalone product with one active price. Free when p_amount = 0.
CREATE FUNCTION pst.mk_solo_product(p_product integer, p_preset integer, p_release integer, p_price integer, p_amount bigint) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.store_products (id, kind, preset_id, current_release_id, slug, title)
  VALUES (pst.u(p_product), 'preset', pst.u(p_preset), pst.u(p_release), 'regression-product-' || p_product, 'Regression product ' || p_product);
  INSERT INTO public.store_product_prices (id, product_id, currency, amount_minor, environment) VALUES (pst.u(p_price), pst.u(p_product), 'USD', p_amount, 'test');
  UPDATE public.store_products SET status = 'published' WHERE id = pst.u(p_product);
END;
$$;

-- A draft pack edition holding the given presets/releases in order. Pass publish = true to publish it.
CREATE FUNCTION pst.mk_edition(p_pack integer, p_edition integer, p_number integer, p_members integer[][], p_publish boolean DEFAULT true) RETURNS void LANGUAGE plpgsql AS $$
DECLARE i integer;
BEGIN
  INSERT INTO public.preset_packs (id, slug, name) VALUES (pst.u(p_pack), 'regression-pack-' || p_pack, 'Regression pack ' || p_pack) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.preset_pack_editions (id, pack_id, edition_number) VALUES (pst.u(p_edition), pst.u(p_pack), p_number);
  FOR i IN 1 .. array_length(p_members, 1) LOOP
    INSERT INTO public.preset_pack_items (edition_id, preset_id, release_id, position) VALUES (pst.u(p_edition), pst.u(p_members[i][1]), pst.u(p_members[i][2]), i);
  END LOOP;
  IF p_publish THEN
    UPDATE public.preset_pack_editions SET status = 'published' WHERE id = pst.u(p_edition);
  END IF;
END;
$$;

-- An order with one pinned line. The product's current release / edition and the price's exact amount are snapshotted, as checkout will.
-- Provider orders get synthetic test-mode references; a zero-price order is an internal claim. Constraint triggers are checked immediately.
CREATE FUNCTION pst.mk_order(p_order integer, p_user integer, p_item integer, p_product integer, p_price integer, p_status text DEFAULT 'paid') RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_product public.store_products%ROWTYPE;
  v_price public.store_product_prices%ROWTYPE;
BEGIN
  SELECT * INTO v_product FROM public.store_products WHERE id = pst.u(p_product);
  SELECT * INTO v_price FROM public.store_product_prices WHERE id = pst.u(p_price);
  INSERT INTO public.store_orders (id, user_id, provider, environment, currency, total_minor, status, request_key, provider_checkout_session_id, paid_at, refunded_at)
  VALUES (pst.u(p_order), pst.u(p_user), CASE WHEN v_price.amount_minor = 0 THEN 'internal' ELSE 'stripe' END, 'test', v_price.currency, v_price.amount_minor, p_status,
          'regression-order-' || p_order, CASE WHEN v_price.amount_minor = 0 THEN NULL ELSE 'cs_test_regression_' || p_order END,
          CASE WHEN p_status IN ('paid', 'fulfilled') THEN now() END, CASE WHEN p_status = 'refunded' THEN now() END);
  INSERT INTO public.store_order_items (id, order_id, product_id, price_id, kind, currency, unit_amount_minor, preset_id, release_id, pack_id, edition_id)
  VALUES (pst.u(p_item), pst.u(p_order), pst.u(p_product), pst.u(p_price), v_product.kind, v_price.currency, v_price.amount_minor,
          v_product.preset_id, v_product.current_release_id, v_product.pack_id, v_product.current_edition_id);
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
END;
$$;

CREATE FUNCTION pst.active_grants(p_user integer, p_preset integer) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM public.preset_entitlement_grants WHERE user_id = pst.u(p_user) AND preset_id = pst.u(p_preset) AND revoked_at IS NULL
$$;

CREATE FUNCTION pst.holding(p_user integer, p_preset integer) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_presets WHERE user_id = pst.u(p_user) AND preset_id = pst.u(p_preset))
$$;

CREATE FUNCTION pst.marked(p_user integer, p_preset integer) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (SELECT 1 FROM public.marketplace_holding_projections WHERE user_id = pst.u(p_user) AND preset_id = pst.u(p_preset))
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pst TO PUBLIC;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 1. Privileges and row level security are switched on exactly as designed
-- ---------------------------------------------------------------------------------------------------------------------------------

SELECT pst.expect_count($$
  SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
    AND c.relname IN ('preset_releases', 'preset_release_publications', 'preset_packs', 'preset_pack_editions', 'preset_pack_items', 'store_products',
      'store_product_prices', 'store_product_provider_refs', 'store_orders', 'store_order_items', 'store_payment_events', 'preset_entitlement_grants',
      'marketplace_holding_projections', 'user_preset_preferences')
$$, 0, 'every new table has row level security enabled');

-- No client role can write any commerce table, and the private tables are not readable at all.
SELECT pst.check(NOT has_table_privilege(r.role_name, 'public.' || t.table_name, p.privilege), r.role_name || ' has no ' || p.privilege || ' on ' || t.table_name)
FROM (VALUES ('anon'), ('authenticated')) AS r(role_name)
CROSS JOIN (VALUES ('preset_releases'), ('preset_release_publications'), ('preset_packs'), ('preset_pack_editions'), ('preset_pack_items'), ('store_products'),
  ('store_product_prices'), ('store_product_provider_refs'), ('store_orders'), ('store_order_items'), ('store_payment_events'),
  ('preset_entitlement_grants'), ('marketplace_holding_projections')) AS t(table_name)
CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS p(privilege);

SELECT pst.check(NOT has_table_privilege(r.role_name, 'public.' || t.table_name, 'SELECT') AND NOT has_any_column_privilege(r.role_name, 'public.' || t.table_name, 'SELECT'),
  r.role_name || ' cannot read private table ' || t.table_name)
FROM (VALUES ('anon'), ('authenticated')) AS r(role_name)
CROSS JOIN (VALUES ('store_product_provider_refs'), ('store_payment_events'), ('marketplace_holding_projections')) AS t(table_name);

SELECT pst.check(NOT has_column_privilege('authenticated', 'public.preset_releases', c.column_name, 'SELECT'), 'authenticated cannot read preset_releases.' || c.column_name)
FROM (VALUES ('manifest_sha256'), ('manifest_bytes'), ('manifest_path'), ('assets_prefix'), ('asset_digest_sha256'), ('asset_count'), ('asset_bytes'),
  ('compatibility'), ('license_ref'), ('attribution')) AS c(column_name);
SELECT pst.check(NOT has_column_privilege('anon', 'public.preset_releases', 'manifest_path', 'SELECT'), 'anon cannot read preset_releases.manifest_path');
SELECT pst.check(NOT has_column_privilege('authenticated', 'public.store_orders', 'provider_checkout_session_id', 'SELECT')
  AND NOT has_column_privilege('authenticated', 'public.store_orders', 'provider_payment_intent_id', 'SELECT')
  AND NOT has_column_privilege('authenticated', 'public.store_orders', 'request_key', 'SELECT'), 'provider references and request keys are not client-readable');
SELECT pst.check(NOT has_column_privilege('authenticated', 'public.preset_entitlement_grants', 'manual_reference', 'SELECT'), 'manual grant references are not client-readable');
SELECT pst.check(NOT has_table_privilege('anon', 'public.user_preset_preferences', 'SELECT'), 'anon cannot read preferences');
SELECT pst.check(has_column_privilege('authenticated', 'public.user_preset_preferences', 'is_favorite', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.user_preset_preferences', 'user_id', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.user_preset_preferences', 'preset_id', 'UPDATE'), 'preferences: only is_favorite is client-updatable');

SELECT pst.check(NOT has_function_privilege(r.role_name, f.signature, 'EXECUTE'), r.role_name || ' cannot execute ' || f.signature)
FROM (VALUES ('anon'), ('authenticated')) AS r(role_name)
CROSS JOIN (VALUES ('public.reconcile_preset_holding(uuid,uuid)'), ('public.fulfill_store_order_item(uuid)'), ('public.revoke_store_order_item_entitlements(uuid,text)'),
  ('public.restore_store_order_item_entitlements(uuid)'), ('public.grant_manual_preset_entitlement(uuid,uuid,uuid,text,uuid)'),
  ('public.revoke_manual_preset_entitlement(uuid,uuid,text,text)')) AS f(signature);
SELECT pst.check(has_function_privilege('service_role', f.signature, 'EXECUTE'), 'service_role can execute ' || f.signature)
FROM (VALUES ('public.reconcile_preset_holding(uuid,uuid)'), ('public.fulfill_store_order_item(uuid)'), ('public.revoke_store_order_item_entitlements(uuid,text)'),
  ('public.restore_store_order_item_entitlements(uuid)'), ('public.grant_manual_preset_entitlement(uuid,uuid,uuid,text,uuid)'),
  ('public.revoke_manual_preset_entitlement(uuid,uuid,text,text)')) AS f(signature);
SELECT pst.check(has_function_privilege('authenticated', 'public.set_preset_favorite(uuid,boolean)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.set_preset_favorite(uuid,boolean)', 'EXECUTE'), 'favourite RPC: authenticated yes, anon no');

-- Every SECURITY DEFINER function this migration adds pins its search_path.
SELECT pst.expect_count($$
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef
    AND p.proname IN ('reconcile_preset_holding', 'fulfill_store_order_item', 'revoke_store_order_item_entitlements', 'restore_store_order_item_entitlements',
      'grant_manual_preset_entitlement', 'revoke_manual_preset_entitlement', 'set_preset_favorite')
    AND NOT (p.proconfig IS NOT NULL AND EXISTS (SELECT 1 FROM unnest(p.proconfig) AS cfg WHERE cfg LIKE 'search_path=%'))
$$, 0, 'definer functions pin search_path');

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 2. Seed the regression world (as the migration owner)
-- ---------------------------------------------------------------------------------------------------------------------------------

SELECT pst.as_admin();
SELECT pst.mk_user(1);
SELECT pst.mk_user(2);
SELECT pst.mk_user(3);
SELECT pst.mk_preset(11);  -- pack member, also sold alone (overlap)
SELECT pst.mk_preset(12);  -- pack member
SELECT pst.mk_preset(13);  -- standalone only
SELECT pst.mk_preset(14);  -- added in pack edition 2
SELECT pst.mk_preset(15);  -- draft only
SELECT pst.mk_release(21, 11);
SELECT pst.mk_release(22, 12);
SELECT pst.mk_release(23, 13);
SELECT pst.mk_release(24, 14);
SELECT pst.mk_release(25, 15, '1.0.0', false);

-- Snapshot of the legacy world this suite must leave alone: user 2 already holds preset 12 and has favourited it.
INSERT INTO public.user_presets (user_id, preset_id, is_favorite) VALUES (pst.u(2), pst.u(12), true);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 3. Releases: constraints and immutability
-- ---------------------------------------------------------------------------------------------------------------------------------

SELECT pst.fails($$INSERT INTO public.preset_releases (preset_id, version, manifest_sha256, manifest_bytes, manifest_path)
  VALUES (pst.u(11), '2.0.0', repeat('g', 64), 10, 'x/manifest.json')$$, 'non-hex manifest hash rejected', '23');
SELECT pst.fails($$INSERT INTO public.preset_releases (preset_id, version, manifest_sha256, manifest_bytes, manifest_path)
  VALUES (pst.u(11), '2.0.0', repeat('A', 64), 10, 'x/manifest.json')$$, 'upper-case manifest hash rejected', '23');
SELECT pst.fails($$INSERT INTO public.preset_releases (preset_id, version, manifest_sha256, manifest_bytes, manifest_path)
  VALUES (pst.u(11), 'v2', repeat('a', 64), 10, 'x/manifest.json')$$, 'non-semver version rejected', '23');
SELECT pst.fails($$INSERT INTO public.preset_releases (preset_id, version, manifest_sha256, manifest_bytes, manifest_path)
  VALUES (pst.u(11), '2.0.0', repeat('a', 64), 0, 'x/manifest.json')$$, 'zero-byte manifest rejected', '23');
SELECT pst.fails($$INSERT INTO public.preset_releases (preset_id, version, manifest_sha256, manifest_bytes, manifest_path)
  VALUES (pst.u(11), '2.0.0', repeat('a', 64), 10, '../escape/manifest.json')$$, 'path traversal rejected', '23');
SELECT pst.fails($$INSERT INTO public.preset_releases (preset_id, version, manifest_sha256, manifest_bytes, manifest_path)
  VALUES (pst.u(11), '2.0.0', repeat('a', 64), 10, '/absolute/manifest.json')$$, 'absolute path rejected', '23');
SELECT pst.fails($$INSERT INTO public.preset_releases (preset_id, version, manifest_sha256, manifest_bytes, manifest_path, asset_count, asset_bytes)
  VALUES (pst.u(11), '2.0.0', repeat('a', 64), 10, 'x/manifest.json', 3, 100)$$, 'assets without digest and prefix rejected', '23');
SELECT pst.fails($$INSERT INTO public.preset_releases (preset_id, version, manifest_sha256, manifest_bytes, manifest_path, compatibility)
  VALUES (pst.u(11), '2.0.0', repeat('a', 64), 10, 'x/manifest.json', '[]'::jsonb)$$, 'compatibility must be an object', '23');
SELECT pst.fails($$INSERT INTO public.preset_releases (preset_id, version, manifest_sha256, manifest_bytes, manifest_path)
  VALUES (pst.u(11), '1.0.0', repeat('a', 64), 10, 'x/manifest.json')$$, 'duplicate (preset, version) rejected', '23505');
SELECT pst.fails($$INSERT INTO public.preset_releases (preset_id, version, manifest_sha256, manifest_bytes, manifest_path)
  VALUES (pst.u(99999), '1.0.0', repeat('a', 64), 10, 'x/manifest.json')$$, 'release of an unknown preset rejected', '23503');
SELECT pst.works($$INSERT INTO public.preset_releases (id, preset_id, version, manifest_sha256, manifest_bytes, manifest_path, asset_count, asset_bytes, assets_prefix, asset_digest_sha256)
  VALUES (pst.u(26), pst.u(11), '1.1.0-beta.1', repeat('b', 64), 10, 'x/manifest.json', 2, 4096, 'x/assets', repeat('c', 64))$$, 'a release with assets is accepted');
SELECT pst.check((SELECT status FROM public.preset_release_publications WHERE release_id = pst.u(26)) = 'draft', 'a new release starts as a draft');
SELECT pst.fails($$UPDATE public.preset_releases SET manifest_sha256 = repeat('d', 64) WHERE id = pst.u(21)$$, 'release content is immutable', '23');
SELECT pst.fails($$UPDATE public.preset_releases SET version = '9.9.9' WHERE id = pst.u(21)$$, 'release version is immutable', '23');
SELECT pst.fails($$DELETE FROM public.preset_releases WHERE id = pst.u(21)$$, 'a published release cannot be deleted', '23');
SELECT pst.works($$DELETE FROM public.preset_releases WHERE id = pst.u(26)$$, 'a never-published draft release can be deleted');
SELECT pst.fails($$UPDATE public.preset_release_publications SET status = 'draft' WHERE release_id = pst.u(21)$$, 'a published release cannot return to draft', '23');
SELECT pst.works($$UPDATE public.preset_release_publications SET status = 'withdrawn' WHERE release_id = pst.u(24)$$, 'a published release can be withdrawn');
SELECT pst.works($$UPDATE public.preset_release_publications SET status = 'published' WHERE release_id = pst.u(24)$$, 'a withdrawn release can be published again');
SELECT pst.check((SELECT withdrawn_at IS NULL FROM public.preset_release_publications WHERE release_id = pst.u(24)), 'republishing clears withdrawn_at');

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 4. Packs, editions and frozen membership
-- ---------------------------------------------------------------------------------------------------------------------------------

SELECT pst.mk_edition(31, 311, 1, ARRAY[[11, 21], [12, 22]], false);
SELECT pst.fails($$INSERT INTO public.preset_pack_editions (pack_id, edition_number) VALUES (pst.u(31), 1)$$, 'duplicate edition number rejected', '23505');
SELECT pst.fails($$INSERT INTO public.preset_pack_items (edition_id, preset_id, release_id, position) VALUES (pst.u(311), pst.u(13), pst.u(21), 3)$$,
  'a pinned release must belong to the member preset', '23503');
SELECT pst.fails($$INSERT INTO public.preset_pack_items (edition_id, preset_id, release_id, position) VALUES (pst.u(311), pst.u(11), pst.u(21), 3)$$, 'duplicate member rejected', '23505');
SELECT pst.fails($$INSERT INTO public.preset_pack_items (edition_id, preset_id, release_id, position) VALUES (pst.u(311), pst.u(13), pst.u(23), 2)$$, 'duplicate position rejected', '23505');
SELECT pst.fails($$INSERT INTO public.preset_pack_items (edition_id, preset_id, release_id, position) VALUES (pst.u(311), pst.u(13), pst.u(23), 0)$$, 'position must be >= 1', '23');
SELECT pst.works($$INSERT INTO public.preset_pack_items (edition_id, preset_id, release_id, position) VALUES (pst.u(311), pst.u(15), pst.u(25), 3)$$, 'a draft release can sit in a draft edition');
SELECT pst.fails($$UPDATE public.preset_pack_editions SET status = 'published' WHERE id = pst.u(311)$$, 'an edition with an unpublished member cannot publish', '23');
SELECT pst.works($$DELETE FROM public.preset_pack_items WHERE edition_id = pst.u(311) AND preset_id = pst.u(15)$$, 'draft membership can be edited');
SELECT pst.works($$UPDATE public.preset_pack_editions SET status = 'published' WHERE id = pst.u(311)$$, 'a fully published edition can publish');
SELECT pst.check((SELECT published_at IS NOT NULL FROM public.preset_pack_editions WHERE id = pst.u(311)), 'publishing stamps published_at');
SELECT pst.fails($$INSERT INTO public.preset_pack_items (edition_id, preset_id, release_id, position) VALUES (pst.u(311), pst.u(13), pst.u(23), 3)$$, 'published membership: no insert', '23');
SELECT pst.fails($$DELETE FROM public.preset_pack_items WHERE edition_id = pst.u(311) AND preset_id = pst.u(11)$$, 'published membership: no delete', '23');
SELECT pst.fails($$UPDATE public.preset_pack_items SET position = 9 WHERE edition_id = pst.u(311) AND preset_id = pst.u(11)$$, 'published membership: no reorder', '23');
SELECT pst.fails($$UPDATE public.preset_pack_editions SET status = 'draft' WHERE id = pst.u(311)$$, 'a published edition cannot return to draft', '23');
SELECT pst.fails($$UPDATE public.preset_pack_editions SET edition_number = 7 WHERE id = pst.u(311)$$, 'edition number is immutable', '23');
SELECT pst.fails($$DELETE FROM public.preset_pack_editions WHERE id = pst.u(311)$$, 'a published edition cannot be deleted', '23');
-- An empty edition cannot publish; a pack's second edition is a new row, not a mutation of the first.
INSERT INTO public.preset_packs (id, slug, name) VALUES (pst.u(32), 'regression-pack-32', 'Regression pack 32');
INSERT INTO public.preset_pack_editions (id, pack_id, edition_number) VALUES (pst.u(321), pst.u(32), 1);
SELECT pst.fails($$UPDATE public.preset_pack_editions SET status = 'published' WHERE id = pst.u(321)$$, 'an empty edition cannot publish', '23');
SELECT pst.works($$DELETE FROM public.preset_pack_editions WHERE id = pst.u(321)$$, 'a draft edition can be deleted');
SELECT pst.works($$DELETE FROM public.preset_packs WHERE id = pst.u(32)$$, 'a pack with no editions can be deleted');

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 5. Products and prices
-- ---------------------------------------------------------------------------------------------------------------------------------

-- Pack product (edition 1 of pack 31) and standalone products: 11 overlaps the pack, 13 is standalone only.
INSERT INTO public.store_products (id, kind, pack_id, current_edition_id, slug, title, tags)
VALUES (pst.u(41), 'pack', pst.u(31), pst.u(311), 'regression-pack-product', 'Regression pack', ARRAY['regression', 'pack']);
INSERT INTO public.store_product_prices (id, product_id, currency, amount_minor, environment) VALUES (pst.u(51), pst.u(41), 'USD', 0, 'test');
SELECT pst.mk_solo_product(42, 11, 21, 52, 499);   -- the overlapping standalone
SELECT pst.mk_solo_product(43, 13, 23, 53, 799);
UPDATE public.store_products SET status = 'published' WHERE id = pst.u(41);

SELECT pst.fails($$INSERT INTO public.store_products (kind, preset_id, pack_id, slug, title) VALUES ('preset', pst.u(11), pst.u(31), 'bad-both', 'Both')$$, 'a product cannot target a preset and a pack', '23');
SELECT pst.fails($$INSERT INTO public.store_products (kind, slug, title) VALUES ('preset', 'bad-none', 'None')$$, 'a product needs a target', '23');
SELECT pst.fails($$INSERT INTO public.store_products (kind, preset_id, current_edition_id, slug, title) VALUES ('preset', pst.u(14), pst.u(311), 'bad-edition', 'Edition on a preset')$$, 'a standalone product cannot carry an edition', '23');
SELECT pst.fails($$INSERT INTO public.store_products (kind, preset_id, slug, title) VALUES ('preset', pst.u(11), 'dup-solo-11', 'Duplicate paid identity')$$, 'no second standalone product for the same preset', '23505');
SELECT pst.fails($$INSERT INTO public.store_products (kind, pack_id, slug, title) VALUES ('pack', pst.u(31), 'dup-pack-31', 'Duplicate pack product')$$, 'no second product for the same pack', '23505');
SELECT pst.fails($$INSERT INTO public.store_products (kind, preset_id, current_release_id, slug, title) VALUES ('preset', pst.u(14), pst.u(21), 'wrong-release', 'Release of another preset')$$,
  'a product cannot point at another preset''s release', '23503');
SELECT pst.fails($$INSERT INTO public.store_products (kind, preset_id, slug, title) VALUES ('preset', pst.u(14), 'Bad Slug', 'Bad slug')$$, 'slug must be lower-kebab', '23');
SELECT pst.fails($$INSERT INTO public.store_products (kind, preset_id, slug, title, tags) VALUES ('preset', pst.u(14), 'too-many-tags', 'Tags', (SELECT array_agg('t' || g) FROM generate_series(1, 17) AS g))$$, 'at most 16 tags', '23');
SELECT pst.fails($$INSERT INTO public.store_products (kind, preset_id, slug, title, tags) VALUES ('preset', pst.u(14), 'empty-tag', 'Tags', ARRAY['ok', ' '])$$, 'blank tags rejected', '23');
SELECT pst.fails($$INSERT INTO public.store_products (kind, preset_id, slug, title, promo_cover_path) VALUES ('preset', pst.u(14), 'bad-promo', 'Promo', '../secret.png')$$, 'promo path traversal rejected', '23');
SELECT pst.fails($$INSERT INTO public.store_products (kind, preset_id, slug, title, update_policy) VALUES ('preset', pst.u(14), 'bad-policy', 'Policy', 'free_updates')$$, 'only the pinned update policy exists', '23');
SELECT pst.works($$INSERT INTO public.store_products (id, kind, preset_id, current_release_id, slug, title) VALUES (pst.u(44), 'preset', pst.u(14), pst.u(24), 'regression-product-44', 'Draft product')$$, 'a draft product inserts');
SELECT pst.fails($$UPDATE public.store_products SET status = 'published' WHERE id = pst.u(44)$$, 'a product cannot publish without an active price', '23');
SELECT pst.works($$INSERT INTO public.store_product_prices (id, product_id, currency, amount_minor, environment) VALUES (pst.u(54), pst.u(44), 'USD', 299, 'test')$$, 'a price attaches to a draft product');
SELECT pst.works($$UPDATE public.store_products SET status = 'published' WHERE id = pst.u(44)$$, 'a priced product with a published release publishes');
SELECT pst.fails($$UPDATE public.store_products SET preset_id = pst.u(15) WHERE id = pst.u(44)$$, 'a product keeps its target', '23');
SELECT pst.fails($$UPDATE public.store_products SET kind = 'pack' WHERE id = pst.u(44)$$, 'a product keeps its kind', '23');
INSERT INTO public.store_products (id, kind, preset_id, slug, title) VALUES (pst.u(45), 'preset', pst.u(15), 'regression-product-45', 'No release yet');
INSERT INTO public.store_product_prices (id, product_id, currency, amount_minor, environment) VALUES (pst.u(55), pst.u(45), 'USD', 100, 'test');
SELECT pst.fails($$UPDATE public.store_products SET status = 'published' WHERE id = pst.u(45)$$, 'a standalone product cannot publish without a published release', '23');
UPDATE public.store_products SET current_release_id = pst.u(25) WHERE id = pst.u(45);
SELECT pst.fails($$UPDATE public.store_products SET status = 'published' WHERE id = pst.u(45)$$, 'a standalone product cannot publish a draft release', '23');
INSERT INTO public.preset_packs (id, slug, name) VALUES (pst.u(33), 'regression-pack-33', 'Regression pack 33');
INSERT INTO public.preset_pack_editions (id, pack_id, edition_number) VALUES (pst.u(331), pst.u(33), 1);
INSERT INTO public.preset_pack_items (edition_id, preset_id, release_id, position) VALUES (pst.u(331), pst.u(12), pst.u(22), 1);
INSERT INTO public.store_products (id, kind, pack_id, current_edition_id, slug, title) VALUES (pst.u(46), 'pack', pst.u(33), pst.u(331), 'regression-product-46', 'Draft-edition pack');
INSERT INTO public.store_product_prices (id, product_id, currency, amount_minor, environment) VALUES (pst.u(56), pst.u(46), 'USD', 100, 'test');
SELECT pst.fails($$UPDATE public.store_products SET status = 'published' WHERE id = pst.u(46)$$, 'a pack product cannot publish a draft edition', '23');

SELECT pst.fails($$INSERT INTO public.store_product_prices (product_id, currency, amount_minor, environment) VALUES (pst.u(43), 'usd', 100, 'test')$$, 'currency must be upper-case ISO-style', '23');
SELECT pst.fails($$INSERT INTO public.store_product_prices (product_id, currency, amount_minor, environment) VALUES (pst.u(43), 'USD', -1, 'test')$$, 'negative price rejected', '23');
SELECT pst.fails($$INSERT INTO public.store_product_prices (product_id, currency, amount_minor, environment) VALUES (pst.u(43), 'USD', 100, 'staging')$$, 'unknown price environment rejected', '23');
SELECT pst.fails($$INSERT INTO public.store_product_prices (product_id, currency, amount_minor, environment) VALUES (pst.u(43), 'USD', 100000000, 'test')$$, 'price above the sanity bound rejected', '23');
SELECT pst.fails($$INSERT INTO public.store_product_prices (product_id, currency, amount_minor, environment) VALUES (pst.u(43), 'USD', 999, 'test')$$, 'a second active price in the same currency and environment rejected', '23505');
SELECT pst.works($$INSERT INTO public.store_product_prices (id, product_id, currency, amount_minor, environment) VALUES (pst.u(57), pst.u(43), 'EUR', 749, 'test')$$, 'a second currency is a second price');
SELECT pst.fails($$UPDATE public.store_product_prices SET amount_minor = 1 WHERE id = pst.u(53)$$, 'a price amount is immutable', '23');
SELECT pst.fails($$UPDATE public.store_product_prices SET currency = 'EUR' WHERE id = pst.u(53)$$, 'a price currency is immutable', '23');
SELECT pst.works($$UPDATE public.store_product_prices SET status = 'retired' WHERE id = pst.u(57)$$, 'a price can be retired');
SELECT pst.check((SELECT retired_at IS NOT NULL FROM public.store_product_prices WHERE id = pst.u(57)), 'retiring stamps retired_at');
SELECT pst.fails($$UPDATE public.store_product_prices SET status = 'active', retired_at = NULL WHERE id = pst.u(57)$$, 'a retired price cannot be reactivated', '23');
SELECT pst.works($$INSERT INTO public.store_product_prices (product_id, currency, amount_minor, environment) VALUES (pst.u(43), 'EUR', 799, 'test')$$, 'a replacement price after retiring is allowed');
SELECT pst.works($$INSERT INTO public.store_product_provider_refs (price_id, provider, provider_product_id, provider_price_id) VALUES (pst.u(53), 'stripe', 'prod_regression', 'price_regression_1')$$, 'provider mapping stores in the private table');
SELECT pst.fails($$INSERT INTO public.store_product_provider_refs (price_id, provider, provider_price_id) VALUES (pst.u(54), 'stripe', 'price_regression_1')$$, 'a provider price maps to exactly one local price', '23505');
SELECT pst.fails($$INSERT INTO public.store_product_provider_refs (price_id, provider, provider_price_id) VALUES (pst.u(54), 'paypal', 'x')$$, 'unknown provider rejected', '23');

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 6. Orders, pinned lines, exact money, payment events
-- ---------------------------------------------------------------------------------------------------------------------------------

SELECT pst.mk_order(61, 1, 611, 43, 53, 'pending');   -- user 1: a pending purchase of preset 13
SELECT pst.check((SELECT unit_amount_minor FROM public.store_order_items WHERE id = pst.u(611)) = 799, 'the order line pins the exact price amount');
SELECT pst.fails($$INSERT INTO public.store_orders (user_id, provider, environment, currency, total_minor, request_key, provider_checkout_session_id)
  VALUES (pst.u(1), 'stripe', 'test', 'USD', 0, 'zero-on-stripe', 'cs_zero')$$, 'a provider order must charge something', '23');
SELECT pst.fails($$INSERT INTO public.store_orders (user_id, provider, environment, currency, total_minor, request_key)
  VALUES (pst.u(1), 'internal', 'test', 'USD', 100, 'paid-internal')$$, 'an internal order must be zero-total', '23');
SELECT pst.fails($$INSERT INTO public.store_orders (user_id, provider, environment, currency, total_minor, request_key, provider_checkout_session_id)
  VALUES (pst.u(1), 'stripe', 'test', 'USD', 799, 'regression-order-61', 'cs_other')$$, 'one idempotency key per user', '23505');
SELECT pst.fails($$INSERT INTO public.store_orders (user_id, provider, environment, currency, total_minor, request_key, provider_checkout_session_id)
  VALUES (pst.u(2), 'stripe', 'test', 'USD', 799, 'other-key', 'cs_test_regression_61')$$, 'one order per provider checkout session', '23505');
SELECT pst.fails($$INSERT INTO public.store_orders (user_id, provider, environment, currency, total_minor, status, request_key, provider_checkout_session_id)
  VALUES (pst.u(2), 'stripe', 'test', 'USD', 799, 'paid', 'paid-without-time', 'cs_paid_no_time')$$, 'a paid order needs paid_at', '23');
SELECT pst.fails($$INSERT INTO public.store_orders (user_id, provider, environment, currency, total_minor, request_key, provider_checkout_session_id)
  VALUES (pst.u(2), 'stripe', 'test', 'usd', 799, 'lower-currency', 'cs_lower')$$, 'order currency must be upper-case', '23');
SELECT pst.fails($$INSERT INTO public.store_orders (user_id, provider, environment, currency, total_minor, status, request_key, provider_checkout_session_id)
  VALUES (pst.u(2), 'stripe', 'test', 'USD', 799, 'shipped', 'bad-status', 'cs_bad_status')$$, 'unknown order status rejected', '23');
-- A line must match its price snapshot, its product and its order.
SELECT pst.fails($$INSERT INTO public.store_orders (id, user_id, provider, environment, currency, total_minor, request_key, provider_checkout_session_id)
  VALUES (pst.u(62), pst.u(2), 'stripe', 'test', 'USD', 1, 'amount-drift', 'cs_drift');
  INSERT INTO public.store_order_items (order_id, product_id, price_id, kind, currency, unit_amount_minor, preset_id, release_id)
  VALUES (pst.u(62), pst.u(43), pst.u(53), 'preset', 'USD', 1, pst.u(13), pst.u(23))$$, 'a line amount that differs from its price row is rejected', '23503');
SELECT pst.fails($$INSERT INTO public.store_orders (id, user_id, provider, environment, currency, total_minor, request_key, provider_checkout_session_id)
  VALUES (pst.u(63), pst.u(2), 'stripe', 'test', 'USD', 799, 'wrong-target', 'cs_wrong_target');
  INSERT INTO public.store_order_items (order_id, product_id, price_id, kind, currency, unit_amount_minor, preset_id, release_id)
  VALUES (pst.u(63), pst.u(43), pst.u(53), 'preset', 'USD', 799, pst.u(11), pst.u(21))$$, 'a line for another preset than its product is rejected', '23');
SELECT pst.fails($$INSERT INTO public.store_orders (id, user_id, provider, environment, currency, total_minor, request_key, provider_checkout_session_id)
  VALUES (pst.u(64), pst.u(2), 'stripe', 'test', 'USD', 799, 'wrong-kind', 'cs_wrong_kind');
  INSERT INTO public.store_order_items (order_id, product_id, price_id, kind, currency, unit_amount_minor, pack_id, edition_id)
  VALUES (pst.u(64), pst.u(43), pst.u(53), 'pack', 'USD', 799, pst.u(31), pst.u(311))$$, 'a pack line for a standalone product is rejected', '23');
SELECT pst.fails($$INSERT INTO public.store_order_items (order_id, product_id, price_id, kind, currency, unit_amount_minor, preset_id, release_id)
  VALUES (pst.u(61), pst.u(43), pst.u(53), 'preset', 'USD', 799, pst.u(13), pst.u(23))$$, 'one line per product per order', '23505');
SELECT pst.fails($$UPDATE public.store_order_items SET unit_amount_minor = 1 WHERE id = pst.u(611)$$, 'order lines are immutable', '23');
SELECT pst.fails($$UPDATE public.store_orders SET total_minor = 1 WHERE id = pst.u(61)$$, 'order total is immutable', '23');
SELECT pst.fails($$UPDATE public.store_orders SET user_id = pst.u(2) WHERE id = pst.u(61)$$, 'order owner is immutable', '23');
SELECT pst.fails($$UPDATE public.store_orders SET request_key = 'changed' WHERE id = pst.u(61)$$, 'order request key is immutable', '23');
SELECT pst.works($$UPDATE public.store_orders SET provider_payment_intent_id = 'pi_test_regression_61' WHERE id = pst.u(61)$$, 'a payment reference can be attached once');
SELECT pst.fails($$UPDATE public.store_orders SET provider_payment_intent_id = 'pi_other' WHERE id = pst.u(61)$$, 'an attached payment reference cannot be replaced', '23');

-- Exact money is checked at commit: a total that is not the sum of its lines, or an order without lines, cannot commit.
DO $$
DECLARE v_failed boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.store_orders (id, user_id, provider, environment, currency, total_minor, request_key, provider_checkout_session_id)
    VALUES (pst.u(65), pst.u(2), 'stripe', 'test', 'USD', 800, 'sum-mismatch', 'cs_sum_mismatch');
    INSERT INTO public.store_order_items (order_id, product_id, price_id, kind, currency, unit_amount_minor, preset_id, release_id)
    VALUES (pst.u(65), pst.u(43), pst.u(53), 'preset', 'USD', 799, pst.u(13), pst.u(23));
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN check_violation THEN
    v_failed := true;
  END;
  PERFORM pst.check(v_failed, 'an order total that is not the exact sum of its lines is rejected');
  v_failed := false;
  BEGIN
    INSERT INTO public.store_orders (id, user_id, provider, environment, currency, total_minor, request_key, provider_checkout_session_id)
    VALUES (pst.u(66), pst.u(2), 'stripe', 'test', 'USD', 799, 'no-lines', 'cs_no_lines');
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN check_violation THEN
    v_failed := true;
  END;
  PERFORM pst.check(v_failed, 'an order with no lines is rejected');
  SET CONSTRAINTS ALL DEFERRED;
END
$$;

SELECT pst.works($$INSERT INTO public.store_payment_events (provider, environment, event_id, event_type, provider_payment_ref, payload)
  VALUES ('stripe', 'test', 'evt_regression_1', 'checkout.session.completed', 'pi_test_regression_61', '{"id":"evt_regression_1"}')$$, 'a payment event is recorded');
SELECT pst.fails($$INSERT INTO public.store_payment_events (provider, environment, event_id, event_type) VALUES ('stripe', 'test', 'evt_regression_1', 'checkout.session.completed')$$,
  'a redelivered event id conflicts instead of duplicating', '23505');
SELECT pst.works($$INSERT INTO public.store_payment_events (provider, environment, event_id, event_type) VALUES ('stripe', 'live', 'evt_regression_1', 'checkout.session.completed')$$, 'the same id in another environment is a different event');
SELECT pst.fails($$INSERT INTO public.store_payment_events (provider, environment, event_id, event_type, payload) VALUES ('stripe', 'test', 'evt_array', 'x', '[]'::jsonb)$$, 'an event payload must be an object', '23');
SELECT pst.fails($$INSERT INTO public.store_payment_events (provider, environment, event_id, event_type, status) VALUES ('stripe', 'test', 'evt_unstamped', 'x', 'processed')$$, 'a processed event needs processed_at', '23');
SELECT pst.works($$UPDATE public.store_payment_events SET status = 'processed', processed_at = now(), order_id = pst.u(61), attempt_count = 1 WHERE event_id = 'evt_regression_1' AND environment = 'test'$$, 'an event records its outcome');

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 7. Grants: coherence with their order line, one grant per source and member, revocation-only updates
-- ---------------------------------------------------------------------------------------------------------------------------------

SELECT pst.mk_order(71, 3, 711, 43, 53, 'paid');       -- user 3 bought preset 13 outright
SELECT pst.mk_order(72, 3, 721, 41, 51, 'paid');       -- user 3 claimed the free pack (internal, zero total)
SELECT pst.check((SELECT provider FROM public.store_orders WHERE id = pst.u(72)) = 'internal', 'a zero-price claim is an internal order');
SELECT pst.fails($$INSERT INTO public.preset_entitlement_grants (user_id, preset_id, release_id, source_kind, order_item_id) VALUES (pst.u(2), pst.u(13), pst.u(23), 'purchase', pst.u(711))$$,
  'a grant must belong to the order''s user', '23');
SELECT pst.fails($$INSERT INTO public.preset_entitlement_grants (user_id, preset_id, release_id, source_kind, order_item_id) VALUES (pst.u(3), pst.u(13), pst.u(23), 'free_claim', pst.u(711))$$,
  'a free_claim grant cannot come from a paid order', '23');
SELECT pst.fails($$INSERT INTO public.preset_entitlement_grants (user_id, preset_id, release_id, source_kind, order_item_id) VALUES (pst.u(3), pst.u(11), pst.u(21), 'purchase', pst.u(721))$$,
  'a purchase grant cannot come from a zero-total order', '23');
SELECT pst.fails($$INSERT INTO public.preset_entitlement_grants (user_id, preset_id, release_id, source_kind, order_item_id) VALUES (pst.u(3), pst.u(12), pst.u(23), 'purchase', pst.u(711))$$,
  'a standalone grant must be for the line''s own preset and release', '23');
SELECT pst.fails($$INSERT INTO public.preset_entitlement_grants (user_id, preset_id, release_id, source_kind, order_item_id, via_edition_id) VALUES (pst.u(3), pst.u(13), pst.u(23), 'free_claim', pst.u(721), pst.u(311))$$,
  'a pack-line grant must be a member of the pinned edition', '23');
SELECT pst.fails($$INSERT INTO public.preset_entitlement_grants (user_id, preset_id, release_id, source_kind, manual_reference) VALUES (pst.u(3), pst.u(13), pst.u(23), 'manual', NULL)$$, 'a manual grant needs a reference', '23');
SELECT pst.fails($$INSERT INTO public.preset_entitlement_grants (user_id, preset_id, release_id, source_kind, manual_reference, order_item_id) VALUES (pst.u(3), pst.u(13), pst.u(23), 'manual', 'ticket-1', pst.u(711))$$,
  'a manual grant has no order line', '23');
SELECT pst.fails($$INSERT INTO public.preset_entitlement_grants (user_id, preset_id, release_id, source_kind) VALUES (pst.u(3), pst.u(13), pst.u(23), 'purchase')$$, 'a purchase grant needs its order line', '23');
SELECT pst.fails($$INSERT INTO public.preset_entitlement_grants (user_id, preset_id, release_id, source_kind, manual_reference) VALUES (pst.u(3), pst.u(13), pst.u(21), 'manual', 'ticket-1')$$,
  'a grant release must be a release of the preset', '23503');

-- Fulfilment is idempotent and creates the holding.
SELECT pst.as_service();
SELECT pst.check(public.fulfill_store_order_item(pst.u(711)) = 1, 'fulfilling a standalone line creates one grant');
SELECT pst.check(public.fulfill_store_order_item(pst.u(711)) = 0, 'replaying fulfilment creates nothing');
SELECT pst.check(public.fulfill_store_order_item(pst.u(721)) = 2, 'fulfilling a pack line creates one grant per member');
SELECT pst.check(public.fulfill_store_order_item(pst.u(721)) = 0, 'replaying a pack fulfilment creates nothing');
SELECT pst.as_admin();
SELECT pst.check((SELECT status FROM public.store_orders WHERE id = pst.u(71)) = 'fulfilled', 'a fully granted order becomes fulfilled');
SELECT pst.check((SELECT source_kind FROM public.preset_entitlement_grants WHERE order_item_id = pst.u(711)) = 'purchase', 'a paid line grants as purchase');
SELECT pst.expect_count($$SELECT 1 FROM public.preset_entitlement_grants WHERE order_item_id = pst.u(721) AND source_kind = 'free_claim' AND via_edition_id = pst.u(311)$$, 2, 'a zero-total pack line grants as free_claim via its edition');
SELECT pst.check(pst.holding(3, 13) AND pst.marked(3, 13) AND pst.holding(3, 11) AND pst.marked(3, 11) AND pst.holding(3, 12) AND pst.marked(3, 12), 'marketplace grants project holdings and mark them');
SELECT pst.fails($$UPDATE public.preset_entitlement_grants SET user_id = pst.u(1) WHERE order_item_id = pst.u(711)$$, 'a grant cannot change owner', '23');
SELECT pst.fails($$UPDATE public.preset_entitlement_grants SET release_id = pst.u(23), source_kind = 'manual' WHERE order_item_id = pst.u(711)$$, 'a grant cannot change source', '23');
SELECT pst.fails($$UPDATE public.preset_entitlement_grants SET revoked_at = now() WHERE order_item_id = pst.u(711)$$, 'a revocation needs a reason', '23');
SELECT pst.fails($$INSERT INTO public.preset_entitlement_grants (user_id, preset_id, release_id, source_kind, order_item_id) VALUES (pst.u(3), pst.u(13), pst.u(23), 'purchase', pst.u(711))$$,
  'one grant per order line and member', '23505');

-- A refund that arrives before fulfilment: the order is refunded, so fulfilment is refused.
SELECT pst.mk_order(73, 1, 731, 43, 53, 'refunded');
SELECT pst.as_service();
SELECT pst.fails($$SELECT public.fulfill_store_order_item(pst.u(731))$$, 'a refunded order cannot be fulfilled', '23');
SELECT pst.fails($$SELECT public.fulfill_store_order_item(pst.u(611))$$, 'a pending order cannot be fulfilled', '23');
SELECT pst.as_admin();
SELECT pst.check(NOT pst.holding(1, 13), 'no grant, no holding, for the refunded order');
SELECT pst.fails($$UPDATE public.store_orders SET status = 'paid' WHERE id = pst.u(73)$$, 'a refunded order cannot be reopened', '23');

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 8. Overlapping sources, the legacy holding rule, refunds and disputes
--    user 1: free pack (11, 12) + standalone 11 + a manual grant of 11
--    user 2: a LEGACY holding of 12 (favourited) + the free pack
-- ---------------------------------------------------------------------------------------------------------------------------------

SELECT pst.mk_order(81, 1, 811, 41, 51, 'paid');       -- user 1: free pack
SELECT pst.mk_order(82, 1, 821, 42, 52, 'paid');       -- user 1: standalone 11, overlapping the pack
SELECT pst.mk_order(83, 2, 831, 41, 51, 'paid');       -- user 2: free pack
SELECT pst.as_service();
SELECT public.fulfill_store_order_item(pst.u(811));
SELECT public.fulfill_store_order_item(pst.u(821));
SELECT public.fulfill_store_order_item(pst.u(831));
SELECT pst.check(public.grant_manual_preset_entitlement(pst.u(1), pst.u(11), pst.u(21), 'support-ticket-1', NULL), 'a manual grant inserts');
SELECT pst.check(NOT public.grant_manual_preset_entitlement(pst.u(1), pst.u(11), pst.u(21), 'support-ticket-1', NULL), 'a replayed manual grant is a no-op');
SELECT pst.as_admin();
SELECT pst.check(pst.active_grants(1, 11) = 3, 'user 1 holds preset 11 three ways at once (pack, standalone, manual)');
SELECT pst.check(pst.active_grants(1, 12) = 1, 'user 1 holds preset 12 one way (pack)');
SELECT pst.check(pst.holding(1, 11) AND pst.marked(1, 11), 'one marketplace-created holding row serves all three sources');
SELECT pst.expect_count($$SELECT 1 FROM public.user_presets WHERE user_id = pst.u(1) AND preset_id = pst.u(11)$$, 1, 'overlap never duplicates the holding');
-- Legacy: user 2 already held 12 before the marketplace existed. The marketplace must not claim, mark or later remove it.
SELECT pst.check(pst.holding(2, 12) AND NOT pst.marked(2, 12), 'a legacy holding stays unmarked when a marketplace grant overlaps it');
SELECT pst.check(pst.holding(2, 11) AND pst.marked(2, 11), 'the legacy user''s other pack member is marketplace-created');
SELECT pst.check((SELECT is_favorite FROM public.user_presets WHERE user_id = pst.u(2) AND preset_id = pst.u(12)), 'the legacy favourite is untouched by a marketplace grant');

SELECT pst.as_service();
-- Revoke each of user 1's sources in turn. Preset 11 stays held until its LAST source goes.
SELECT pst.check(public.revoke_store_order_item_entitlements(pst.u(821), 'refund') = 1, 'refunding the standalone line revokes its one grant');
SELECT pst.check(public.revoke_store_order_item_entitlements(pst.u(821), 'refund') = 0, 'a duplicate revoke is a no-op');
SELECT pst.as_admin();
SELECT pst.check(pst.active_grants(1, 11) = 2 AND pst.holding(1, 11), 'after the standalone refund the pack and manual grants still hold preset 11');
SELECT pst.as_service();
SELECT pst.check(public.revoke_store_order_item_entitlements(pst.u(811), 'refund') = 2, 'refunding the pack line revokes every member grant of that line only');
SELECT pst.as_admin();
SELECT pst.check(pst.active_grants(1, 11) = 1 AND pst.holding(1, 11), 'the manual grant alone keeps preset 11');
SELECT pst.check(pst.active_grants(1, 12) = 0 AND NOT pst.holding(1, 12) AND NOT pst.marked(1, 12), 'preset 12 had only the pack source, so its marketplace-created holding is removed');
SELECT pst.as_service();
SELECT pst.check(public.revoke_manual_preset_entitlement(pst.u(1), pst.u(11), 'support-ticket-1', 'support resolved'), 'the manual grant revokes');
SELECT pst.check(NOT public.revoke_manual_preset_entitlement(pst.u(1), pst.u(11), 'support-ticket-1', 'again'), 'revoking it twice is a no-op');
SELECT pst.as_admin();
SELECT pst.check(NOT pst.holding(1, 11) AND NOT pst.marked(1, 11), 'the last source gone removes the marketplace-created holding');
SELECT pst.check(pst.active_grants(1, 11) = 0 AND (SELECT count(*) FROM public.preset_entitlement_grants WHERE user_id = pst.u(1) AND preset_id = pst.u(11)) = 3, 'revoked grants stay as history');
-- A late replay of fulfilment must not resurrect a revoked source.
SELECT pst.as_service();
SELECT pst.check(public.fulfill_store_order_item(pst.u(811)) = 0 AND public.fulfill_store_order_item(pst.u(821)) = 0, 'replaying fulfilment after a refund grants nothing');
SELECT pst.as_admin();
SELECT pst.check(NOT pst.holding(1, 11) AND NOT pst.holding(1, 12), 'a replay does not restore the refunded holdings');

-- User 2: refunding the pack removes only the marketplace-created row; the legacy row and its favourite survive.
SELECT pst.as_service();
SELECT pst.check(public.revoke_store_order_item_entitlements(pst.u(831), 'refund') = 2, 'user 2 pack refund revokes both member grants');
SELECT pst.as_admin();
SELECT pst.check(NOT pst.holding(2, 11), 'user 2: the marketplace-created holding of preset 11 is removed');
SELECT pst.check(pst.holding(2, 12) AND NOT pst.marked(2, 12), 'user 2: the legacy holding of preset 12 is never removed');
SELECT pst.check((SELECT is_favorite FROM public.user_presets WHERE user_id = pst.u(2) AND preset_id = pst.u(12)), 'user 2: the legacy favourite is unchanged');

-- Disputes: a hold is reversible, a refund is not.
SELECT pst.as_service();
SELECT pst.check(public.revoke_store_order_item_entitlements(pst.u(711), 'dispute_pending') = 1, 'a dispute hold revokes the line');
SELECT pst.as_admin();
SELECT pst.check(NOT pst.holding(3, 13), 'a held line removes the marketplace-created holding');
SELECT pst.as_service();
SELECT pst.check(public.restore_store_order_item_entitlements(pst.u(711)) = 1, 'winning the dispute restores the held grant');
SELECT pst.as_admin();
SELECT pst.check(pst.holding(3, 13) AND pst.marked(3, 13) AND pst.active_grants(3, 13) = 1, 'the restored grant restores its holding');
SELECT pst.as_service();
SELECT public.revoke_store_order_item_entitlements(pst.u(711), 'refund');
SELECT pst.check(public.restore_store_order_item_entitlements(pst.u(711)) = 0, 'a refund is not restored by lifting a dispute hold');
SELECT pst.as_admin();
SELECT pst.check(NOT pst.holding(3, 13), 'a refunded line stays removed');
SELECT pst.fails($$SELECT public.revoke_store_order_item_entitlements(pst.u(711), '')$$, 'a revocation needs a reason', '23');

-- An operator-recorded legacy-style holding that pre-dates a marketplace grant is never swept up in a revoke.
INSERT INTO public.user_presets (user_id, preset_id) VALUES (pst.u(1), pst.u(13));
SELECT pst.as_service();
SELECT public.grant_manual_preset_entitlement(pst.u(1), pst.u(13), pst.u(23), 'support-ticket-2', NULL);
SELECT public.revoke_manual_preset_entitlement(pst.u(1), pst.u(13), 'support-ticket-2', 'done');
SELECT pst.as_admin();
SELECT pst.check(pst.holding(1, 13) AND NOT pst.marked(1, 13), 'an existing holding survives a grant and revoke cycle unmarked');
DELETE FROM public.user_presets WHERE user_id = pst.u(1) AND preset_id = pst.u(13);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 9. Pack editions: later additions never change what an earlier buyer owns
-- ---------------------------------------------------------------------------------------------------------------------------------

SELECT pst.check((SELECT count(*) FROM public.preset_pack_items WHERE edition_id = pst.u(311)) = 2, 'edition 1 has two members');
SELECT pst.mk_edition(31, 312, 2, ARRAY[[11, 21], [12, 22], [14, 24]], true);
SELECT pst.works($$UPDATE public.store_products SET current_edition_id = pst.u(312) WHERE id = pst.u(41)$$, 'the product moves to edition 2 for new sales');
SELECT pst.check((SELECT count(*) FROM public.preset_pack_items WHERE edition_id = pst.u(311)) = 2, 'edition 1 still has exactly two members');
SELECT pst.check((SELECT edition_id FROM public.store_order_items WHERE id = pst.u(721)) = pst.u(311), 'user 3''s old order line still pins edition 1');
SELECT pst.expect_count($$SELECT 1 FROM public.preset_entitlement_grants WHERE order_item_id = pst.u(721)$$, 2, 'user 3 owns exactly the two edition-1 members');
SELECT pst.check(NOT pst.holding(3, 14) AND pst.active_grants(3, 14) = 0, 'user 3 did not silently gain the preset added in edition 2');
-- Edition 1 is retired but its membership stays readable and frozen.
SELECT pst.works($$UPDATE public.preset_pack_editions SET status = 'retired' WHERE id = pst.u(311)$$, 'an edition can be retired');
SELECT pst.fails($$UPDATE public.preset_pack_editions SET status = 'published', retired_at = NULL WHERE id = pst.u(311)$$, 'a retired edition cannot be republished', '23');
SELECT pst.fails($$INSERT INTO public.preset_pack_items (edition_id, preset_id, release_id, position) VALUES (pst.u(311), pst.u(13), pst.u(23), 3)$$, 'a retired edition membership stays frozen', '23');
-- A new buyer of edition 2 gets three grants.
SELECT pst.mk_order(91, 2, 911, 41, 51, 'paid');
SELECT pst.check((SELECT edition_id FROM public.store_order_items WHERE id = pst.u(911)) = pst.u(312), 'a new order pins the current edition');
SELECT pst.as_service();
SELECT pst.check(public.fulfill_store_order_item(pst.u(911)) = 3, 'a new buyer receives all three edition-2 members');
SELECT pst.as_admin();
SELECT pst.check(pst.holding(2, 14) AND pst.holding(2, 11) AND pst.holding(2, 12), 'user 2 now holds the three members (the legacy row is still unmarked)');
SELECT pst.check(NOT pst.marked(2, 12), 'the legacy holding is still unmarked after a second pack grant');

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 10. Role matrix: anon, user A (1), user B (2), service
-- ---------------------------------------------------------------------------------------------------------------------------------

UPDATE public.store_products SET status = 'archived' WHERE id = pst.u(42);   -- user 1 bought it, user 2 did not

SELECT pst.as_anon();
SELECT pst.expect_count($$SELECT 1 FROM public.store_products WHERE slug LIKE 'regression-%' AND status = 'published'$$, 3, 'anon sees the published regression products (41, 43, 44)');
SELECT pst.expect_count($$SELECT 1 FROM public.store_products WHERE slug LIKE 'regression-%' AND status <> 'published'$$, 0, 'anon sees no draft or archived product');
SELECT pst.works($$SELECT * FROM public.store_products$$, 'anon can select * from the public product table');
SELECT pst.expect_count($$SELECT 1 FROM public.store_product_prices WHERE id IN (pst.u(51), pst.u(53), pst.u(54))$$, 3, 'anon sees active prices of published products');
SELECT pst.expect_count($$SELECT 1 FROM public.store_product_prices WHERE id IN (pst.u(52), pst.u(55), pst.u(56), pst.u(57))$$, 0, 'anon sees no price of an archived or draft product, nor a retired price');
SELECT pst.expect_count($$SELECT 1 FROM public.preset_releases WHERE preset_id IN (pst.u(11), pst.u(12), pst.u(13), pst.u(14), pst.u(15))$$, 4, 'anon sees only published releases (draft 25 hidden)');
SELECT pst.fails($$SELECT manifest_path FROM public.preset_releases$$, 'anon cannot read a release path', '42501');
SELECT pst.fails($$SELECT * FROM public.preset_releases$$, 'anon cannot select * from releases', '42501');
SELECT pst.fails($$SELECT manifest_sha256 FROM public.preset_releases$$, 'anon cannot read a manifest hash', '42501');
SELECT pst.expect_count($$SELECT 1 FROM public.preset_release_publications WHERE release_id = pst.u(25)$$, 0, 'anon cannot see a draft release publication');
SELECT pst.expect_count($$SELECT 1 FROM public.preset_packs WHERE id IN (pst.u(31), pst.u(33))$$, 1, 'anon sees a pack only while a published product sells it');
SELECT pst.expect_count($$SELECT 1 FROM public.preset_pack_editions WHERE id IN (pst.u(311), pst.u(312), pst.u(331))$$, 2, 'anon sees published and retired editions, never a draft one');
SELECT pst.expect_count($$SELECT 1 FROM public.preset_pack_items WHERE edition_id = pst.u(331)$$, 0, 'anon sees no member of a draft edition');
SELECT pst.expect_count($$SELECT 1 FROM public.preset_pack_items WHERE edition_id IN (pst.u(311), pst.u(312))$$, 5, 'anon sees published and retired edition membership');
SELECT pst.fails($$SELECT 1 FROM public.store_orders$$, 'anon cannot read orders', '42501');
SELECT pst.fails($$SELECT 1 FROM public.store_order_items$$, 'anon cannot read order lines', '42501');
SELECT pst.fails($$SELECT 1 FROM public.preset_entitlement_grants$$, 'anon cannot read grants', '42501');
SELECT pst.fails($$SELECT 1 FROM public.user_preset_preferences$$, 'anon cannot read preferences', '42501');
SELECT pst.fails($$SELECT 1 FROM public.store_product_provider_refs$$, 'anon cannot read provider mappings', '42501');
SELECT pst.fails($$SELECT 1 FROM public.store_payment_events$$, 'anon cannot read payment events', '42501');
SELECT pst.fails($$SELECT 1 FROM public.marketplace_holding_projections$$, 'anon cannot read holding projections', '42501');
SELECT pst.fails($$INSERT INTO public.store_products (kind, preset_id, slug, title) VALUES ('preset', pst.u(15), 'anon-forged', 'Forged')$$, 'anon cannot insert a product', '42501');
SELECT pst.fails($$SELECT public.set_preset_favorite(pst.u(11), true)$$, 'anon cannot call the favourite RPC', '42501');
SELECT pst.fails($$SELECT public.fulfill_store_order_item(pst.u(811))$$, 'anon cannot fulfil an order', '42501');

SELECT pst.as_user(1);
SELECT pst.expect_count($$SELECT 1 FROM public.store_products WHERE slug LIKE 'regression-%' AND status = 'draft'$$, 0, 'user A sees no draft product');
SELECT pst.expect_count($$SELECT 1 FROM public.store_products WHERE id = pst.u(42)$$, 1, 'an archived product stays visible to a user who ordered it');
SELECT pst.expect_count($$SELECT 1 FROM public.store_orders WHERE user_id <> pst.u(1)$$, 0, 'user A sees none of another account''s orders');
SELECT pst.expect_count($$SELECT 1 FROM public.store_orders WHERE user_id = pst.u(1)$$, 4, 'user A sees their own four orders');
SELECT pst.expect_count($$SELECT 1 FROM public.store_order_items WHERE order_id IN (pst.u(71), pst.u(72), pst.u(83), pst.u(91))$$, 0, 'user A sees none of another account''s order lines');
SELECT pst.expect_count($$SELECT 1 FROM public.store_order_items WHERE order_id IN (pst.u(61), pst.u(81), pst.u(82), pst.u(73))$$, 4, 'user A sees their own order lines');
SELECT pst.expect_count($$SELECT 1 FROM public.preset_entitlement_grants WHERE user_id <> pst.u(1)$$, 0, 'user A sees none of another account''s grants');
SELECT pst.check(pst.count($$SELECT 1 FROM public.preset_entitlement_grants WHERE user_id = pst.u(1)$$) >= 5, 'user A sees their own grants, revoked ones included as history');
SELECT pst.fails($$SELECT manual_reference FROM public.preset_entitlement_grants$$, 'user A cannot read an operator reference', '42501');
SELECT pst.fails($$SELECT request_key FROM public.store_orders$$, 'user A cannot read an idempotency key', '42501');
SELECT pst.fails($$SELECT provider_payment_intent_id FROM public.store_orders$$, 'user A cannot read a provider payment reference', '42501');
SELECT pst.fails($$SELECT manifest_path FROM public.preset_releases$$, 'user A cannot read a release path', '42501');
SELECT pst.fails($$SELECT 1 FROM public.store_payment_events$$, 'user A cannot read payment events', '42501');
SELECT pst.fails($$SELECT 1 FROM public.store_product_provider_refs$$, 'user A cannot read provider mappings', '42501');
SELECT pst.fails($$SELECT 1 FROM public.marketplace_holding_projections$$, 'user A cannot read holding projections', '42501');
SELECT pst.fails($$INSERT INTO public.store_orders (user_id, provider, environment, currency, total_minor, status, request_key, paid_at) VALUES (pst.u(1), 'internal', 'test', 'USD', 0, 'paid', 'forged', now())$$,
  'user A cannot insert an order', '42501');
SELECT pst.fails($$UPDATE public.store_orders SET status = 'paid' WHERE id = pst.u(61)$$, 'user A cannot mark an order paid', '42501');
SELECT pst.fails($$INSERT INTO public.preset_entitlement_grants (user_id, preset_id, release_id, source_kind, manual_reference) VALUES (pst.u(1), pst.u(13), pst.u(23), 'manual', 'forged')$$,
  'user A cannot insert a grant', '42501');
SELECT pst.fails($$UPDATE public.preset_entitlement_grants SET revoked_at = NULL, revoked_reason = NULL WHERE user_id = pst.u(1)$$, 'user A cannot un-revoke a grant', '42501');
SELECT pst.fails($$INSERT INTO public.marketplace_holding_projections (user_id, preset_id) VALUES (pst.u(1), pst.u(13))$$, 'user A cannot forge a projection marker', '42501');
SELECT pst.fails($$INSERT INTO public.user_presets (user_id, preset_id) VALUES (pst.u(1), pst.u(14))$$, 'user A cannot insert a holding (existing RLS, unchanged)', '42501');
SELECT pst.fails($$INSERT INTO public.store_products (kind, preset_id, slug, title) VALUES ('preset', pst.u(15), 'user-forged', 'Forged')$$, 'user A cannot insert a product', '42501');
SELECT pst.fails($$UPDATE public.store_product_prices SET amount_minor = 0 WHERE id = pst.u(53)$$, 'user A cannot reprice a product', '42501');
SELECT pst.fails($$SELECT public.fulfill_store_order_item(pst.u(61))$$, 'user A cannot fulfil an order', '42501');
SELECT pst.fails($$SELECT public.grant_manual_preset_entitlement(pst.u(1), pst.u(13), pst.u(23), 'self-serve', NULL)$$, 'user A cannot grant themselves anything', '42501');
SELECT pst.fails($$SELECT public.reconcile_preset_holding(pst.u(1), pst.u(14))$$, 'user A cannot call the holding reconciler', '42501');

-- Preferences: own rows only, favourite flag only.
SELECT pst.works($$INSERT INTO public.user_preset_preferences (user_id, preset_id, is_favorite) VALUES (pst.u(1), pst.u(11), true)$$, 'user A can store their own favourite');
SELECT pst.fails($$INSERT INTO public.user_preset_preferences (user_id, preset_id, is_favorite) VALUES (pst.u(2), pst.u(11), true)$$, 'user A cannot store a favourite for B', '42501');
SELECT pst.works($$UPDATE public.user_preset_preferences SET is_favorite = false WHERE preset_id = pst.u(11)$$, 'user A can change their favourite flag');
SELECT pst.fails($$UPDATE public.user_preset_preferences SET user_id = pst.u(2) WHERE preset_id = pst.u(11)$$, 'user A cannot reassign a preference', '42501');
SELECT pst.check(NOT pst.holding(1, 11), 'a preference never creates a holding');
SELECT pst.works($$DELETE FROM public.user_preset_preferences WHERE preset_id = pst.u(11)$$, 'user A can delete their own preference');

-- The narrow favourite RPC: own flag, no holdings created, no other account touched.
SELECT pst.works($$SELECT public.set_preset_favorite(pst.u(14), true)$$, 'user A favourites a system-visible preset they hold no row for');
SELECT pst.check((SELECT is_favorite FROM public.user_preset_preferences WHERE preset_id = pst.u(14)) IS TRUE, 'the favourite is stored as a preference');
SELECT pst.check(NOT pst.holding(1, 14), 'the favourite RPC creates no holding');
SELECT pst.fails($$SELECT public.set_preset_favorite(pst.u(99999), true)$$, 'the favourite RPC rejects an unknown preset', '23503');
SELECT pst.fails($$SELECT public.set_preset_favorite(NULL, true)$$, 'the favourite RPC rejects a null preset', '22');
SELECT pst.fails($$SELECT public.set_preset_favorite(pst.u(14), NULL)$$, 'the favourite RPC rejects a null flag', '22');

SELECT pst.as_user(2);
SELECT pst.expect_count($$SELECT 1 FROM public.user_preset_preferences$$, 0, 'user B sees none of A''s preferences');
SELECT pst.expect_count($$SELECT 1 FROM public.store_products WHERE id = pst.u(42)$$, 0, 'an archived product is hidden from a user who never ordered it');
SELECT pst.expect_count($$SELECT 1 FROM public.store_orders WHERE user_id = pst.u(1)$$, 0, 'user B cannot see A''s orders');
SELECT pst.expect_count($$SELECT 1 FROM public.preset_entitlement_grants WHERE user_id = pst.u(1)$$, 0, 'user B cannot see A''s grants');
SELECT pst.expect_count($$SELECT 1 FROM public.user_presets WHERE user_id = pst.u(1)$$, 0, 'user B cannot see A''s holdings (existing policy, unchanged)');
DO $$
DECLARE v_rows integer;
BEGIN
  -- Existing behaviour, unchanged: the client has no UPDATE policy on user_presets, so a direct favourite write changes nothing.
  UPDATE public.user_presets SET is_favorite = false WHERE preset_id = pst.u(12);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM pst.check(v_rows = 0, 'a direct client UPDATE of user_presets still changes nothing');
END
$$;
SELECT pst.works($$SELECT public.set_preset_favorite(pst.u(12), false)$$, 'user B unfavourites a preset they hold through the RPC');
SELECT pst.check((SELECT is_favorite FROM public.user_presets WHERE preset_id = pst.u(12)) IS FALSE, 'the RPC keeps the legacy holding favourite in step');
SELECT pst.check((SELECT is_favorite FROM public.user_preset_preferences WHERE preset_id = pst.u(12)) IS FALSE, 'and writes the durable preference');
SELECT pst.works($$SELECT public.set_preset_favorite(pst.u(15), true)$$, 'user B favourites a preset they do not hold');
SELECT pst.check(NOT pst.holding(2, 15), 'still no holding created');

SELECT pst.as_service();
SELECT pst.check(pst.count($$SELECT 1 FROM public.store_payment_events$$) >= 2, 'the service role reads payment events');
SELECT pst.check(pst.count($$SELECT manifest_path FROM public.preset_releases WHERE id = pst.u(25)$$) = 1, 'the service role reads a draft release and its path');
SELECT pst.check(pst.count($$SELECT 1 FROM public.store_product_provider_refs$$) >= 1, 'the service role reads provider mappings');
SELECT pst.works($$INSERT INTO public.store_payment_events (provider, environment, event_id, event_type) VALUES ('stripe', 'test', 'evt_service_write', 'charge.refunded')$$, 'the service role can write payment events');
SELECT pst.as_admin();
-- Preferences survive uninstall-style churn: user B's favourite of 12 is untouched by revoking their grants (section 8 already refunded them).
SELECT pst.check(pst.holding(2, 12), 'user B''s legacy holding of preset 12 survived the whole run');

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 11. Optional: the shape of supabase/fixtures/preset_store_local_seed.sql, when it has been loaded
-- ---------------------------------------------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.store_products WHERE slug = 'fixture-free-pack') THEN
    RAISE NOTICE 'fixtures not loaded: skipping the fixture shape checks';
    RETURN;
  END IF;
  PERFORM pst.check((SELECT count(*) FROM public.preset_pack_items WHERE edition_id = '00000000-0000-4000-8000-00000000f211') = 2, 'fixture: the free pack has two members');
  PERFORM pst.check((SELECT amount_minor FROM public.store_product_prices WHERE id = '00000000-0000-4000-8000-00000000f401') = 0, 'fixture: the pack is free');
  PERFORM pst.check((SELECT status FROM public.store_products WHERE slug = 'fixture-solo') = 'published', 'fixture: the standalone product is published');
  PERFORM pst.check(EXISTS (
    SELECT 1 FROM public.store_products AS solo
    JOIN public.preset_pack_items AS member ON member.preset_id = solo.preset_id
    JOIN public.store_products AS pack ON pack.current_edition_id = member.edition_id
    WHERE solo.slug = 'fixture-pack-a-solo' AND pack.slug = 'fixture-free-pack'
  ), 'fixture: a standalone product overlaps a pack member');
  PERFORM pst.check(NOT EXISTS (SELECT 1 FROM public.preset_entitlement_grants WHERE preset_id IN (SELECT id FROM public.presets WHERE preset_key LIKE 'fixture.store.%')), 'fixture: no grants are seeded');
  PERFORM pst.check(NOT EXISTS (SELECT 1 FROM public.user_presets WHERE preset_id IN (SELECT id FROM public.presets WHERE preset_key LIKE 'fixture.store.%')), 'fixture: no holdings are seeded');
  PERFORM pst.check(NOT EXISTS (SELECT 1 FROM public.store_orders WHERE id::text LIKE '00000000-0000-4000-8000-00000000f%'), 'fixture: no orders are seeded');
END
$$;

DO $$
BEGIN
  RAISE NOTICE 'PRESET STORE REGRESSION: % checks passed', current_setting('pst.checks', true);
END
$$;

ROLLBACK;
