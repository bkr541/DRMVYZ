-- Preset store schema regression (Phase 01, free-only core). Run AFTER every migration through 0043 has been applied, on a DISPOSABLE
-- local/test database only.
--
--   psql "$LOCAL_TEST_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/preset_store_schema_regression.sql
--
-- The whole file runs inside one transaction and ends in ROLLBACK, so it leaves nothing behind. Any failed check raises an exception and
-- (with ON_ERROR_STOP) stops the run with a non-zero exit; a clean run ends with the notice "PRESET STORE REGRESSION: N checks passed".
-- It creates its own rows (preset keys 'regression.*'), emulates anon / authenticated / service_role with SET LOCAL ROLE plus the JWT
-- subject setting auth.uid() reads, and covers: privileges and RLS, constraints, release immutability, packs, products, free claims and
-- revocation, the "user_presets is never written" rule and the favourite RPC. If the optional fixtures (supabase/fixtures) are loaded it also
-- checks their shape. It must run as a role that can SET ROLE to the three API roles (postgres on Supabase).

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
  INSERT INTO public.preset_releases (id, preset_id, version, signing_key_id, manifest_sha256, manifest_bytes, manifest_path)
  VALUES (pst.u(p_n), pst.u(p_preset), p_version, 'regression-key', encode(sha256(convert_to('regression:' || p_n, 'UTF8')), 'hex'), 1024,
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


-- A published (or draft) standalone free product.
CREATE FUNCTION pst.mk_solo_product(p_product integer, p_preset integer, p_release integer, p_publish boolean DEFAULT true) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.store_products (id, kind, preset_id, current_release_id, slug, title)
  VALUES (pst.u(p_product), 'preset', pst.u(p_preset), pst.u(p_release), 'regression-product-' || p_product, 'Regression product ' || p_product);
  IF p_publish THEN
    UPDATE public.store_products SET status = 'published' WHERE id = pst.u(p_product);
  END IF;
END;
$$;

-- A pack holding the given {preset, release} pairs in order, and (optionally) a published product for it.
CREATE FUNCTION pst.mk_pack(p_pack integer, p_members integer[][]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE i integer;
BEGIN
  INSERT INTO public.preset_packs (id, slug, name) VALUES (pst.u(p_pack), 'regression-pack-' || p_pack, 'Regression pack ' || p_pack);
  IF p_members IS NOT NULL THEN
    FOR i IN 1 .. array_length(p_members, 1) LOOP
      INSERT INTO public.preset_pack_items (pack_id, preset_id, release_id, position) VALUES (pst.u(p_pack), pst.u(p_members[i][1]), pst.u(p_members[i][2]), i);
    END LOOP;
  END IF;
END;
$$;

CREATE FUNCTION pst.mk_pack_product(p_product integer, p_pack integer, p_publish boolean DEFAULT true) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.store_products (id, kind, pack_id, slug, title)
  VALUES (pst.u(p_product), 'pack', pst.u(p_pack), 'regression-pack-product-' || p_product, 'Regression pack product ' || p_product);
  IF p_publish THEN
    UPDATE public.store_products SET status = 'published' WHERE id = pst.u(p_product);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Data
-- ---------------------------------------------------------------------------------------------------------------------------------

SELECT pst.mk_user(1), pst.mk_user(2), pst.mk_user(3);
SELECT pst.mk_preset(10), pst.mk_preset(11), pst.mk_preset(12), pst.mk_preset(13), pst.mk_preset(19, 'system');
SELECT pst.mk_release(20, 10), pst.mk_release(21, 11), pst.mk_release(22, 12, '1.0.0', false), pst.mk_release(23, 13);

-- A legacy holding that must never be touched: user 1 already holds preset 13 and has it favourited.
INSERT INTO public.user_presets (user_id, preset_id, is_favorite) VALUES (pst.u(1), pst.u(13), true);

CREATE TEMP TABLE pst_legacy AS SELECT * FROM public.user_presets WHERE preset_id IN (SELECT id FROM public.presets WHERE preset_key LIKE 'regression.%');
GRANT SELECT ON pst_legacy TO PUBLIC;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Structure and privileges
-- ---------------------------------------------------------------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  PERFORM pst.as_admin();
  FOREACH t IN ARRAY ARRAY['preset_releases', 'preset_release_publications', 'preset_packs', 'preset_pack_items', 'store_products',
                           'preset_entitlement_grants', 'user_preset_preferences']
  LOOP
    PERFORM pst.check((SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass), 'RLS is enabled on ' || t);
    PERFORM pst.check(NOT has_table_privilege('anon', 'public.' || t, 'INSERT') AND NOT has_table_privilege('anon', 'public.' || t, 'UPDATE')
      AND NOT has_table_privilege('anon', 'public.' || t, 'DELETE'), 'anon has no write privilege on ' || t);
    PERFORM pst.check(has_table_privilege('service_role', 'public.' || t, 'INSERT') AND has_table_privilege('service_role', 'public.' || t, 'SELECT'),
      'service_role can read and write ' || t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['preset_releases', 'preset_release_publications', 'preset_packs', 'preset_pack_items', 'store_products', 'preset_entitlement_grants']
  LOOP
    PERFORM pst.check(NOT has_table_privilege('authenticated', 'public.' || t, 'INSERT') AND NOT has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
      AND NOT has_table_privilege('authenticated', 'public.' || t, 'DELETE'), 'authenticated has no write privilege on ' || t);
  END LOOP;

  PERFORM pst.check(NOT has_table_privilege('anon', 'public.preset_entitlement_grants', 'SELECT'), 'anon cannot read grants');
  PERFORM pst.check(NOT has_table_privilege('anon', 'public.user_preset_preferences', 'SELECT'), 'anon cannot read preferences');
  PERFORM pst.check(NOT has_column_privilege('anon', 'public.preset_releases', 'manifest_path', 'SELECT'), 'anon cannot read a release manifest path');
  PERFORM pst.check(NOT has_column_privilege('authenticated', 'public.preset_releases', 'assets_prefix', 'SELECT'), 'authenticated cannot read a release assets prefix');
  PERFORM pst.check(NOT has_column_privilege('authenticated', 'public.preset_releases', 'manifest_sha256', 'SELECT'), 'authenticated cannot read a release hash');
  PERFORM pst.check(NOT has_column_privilege('authenticated', 'public.preset_releases', 'signing_key_id', 'SELECT'), 'authenticated cannot read a release signing key id');
  PERFORM pst.check(has_column_privilege('anon', 'public.preset_releases', 'version', 'SELECT'), 'anon can read a release version');
  PERFORM pst.check(NOT has_column_privilege('authenticated', 'public.preset_entitlement_grants', 'revoked_reason', 'SELECT'), 'a client cannot read a revocation reason');

  PERFORM pst.check(NOT has_function_privilege('anon', 'public.claim_free_store_product(uuid, uuid)', 'EXECUTE'), 'anon cannot claim');
  PERFORM pst.check(NOT has_function_privilege('authenticated', 'public.claim_free_store_product(uuid, uuid)', 'EXECUTE'), 'authenticated cannot claim (the service claims for them)');
  PERFORM pst.check(has_function_privilege('service_role', 'public.claim_free_store_product(uuid, uuid)', 'EXECUTE'), 'service_role can claim');
  PERFORM pst.check(NOT has_function_privilege('authenticated', 'public.revoke_free_store_claim(uuid, uuid, text)', 'EXECUTE'), 'authenticated cannot revoke a claim');
  PERFORM pst.check(has_function_privilege('service_role', 'public.revoke_free_store_claim(uuid, uuid, text)', 'EXECUTE'), 'service_role can revoke a claim');
  PERFORM pst.check(NOT has_function_privilege('anon', 'public.set_preset_favorite(uuid, boolean)', 'EXECUTE'), 'anon cannot set a favourite');
  PERFORM pst.check(has_function_privilege('authenticated', 'public.set_preset_favorite(uuid, boolean)', 'EXECUTE'), 'authenticated can set a favourite');
END
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Releases
-- ---------------------------------------------------------------------------------------------------------------------------------

DO $$
DECLARE
  v_ok text := $sql$INSERT INTO public.preset_releases (preset_id, version, signing_key_id, manifest_sha256, manifest_bytes, manifest_path) VALUES (pst.u(10), '%s', '%s', '%s', %s, '%s')$sql$;
  v_hash text := repeat('a', 64);
BEGIN
  PERFORM pst.as_admin();
  PERFORM pst.works(format(v_ok, '2.0.0', 'k1', v_hash, 10, 'ok/path/manifest.json'), 'a valid release inserts');
  PERFORM pst.check((SELECT status FROM public.preset_release_publications WHERE release_id = (SELECT id FROM public.preset_releases WHERE version = '2.0.0' AND preset_id = pst.u(10))) = 'draft',
    'a new release starts as a draft');
  PERFORM pst.fails(format(v_ok, '2.0.0', 'k1', v_hash, 10, 'ok/other.json'), 'a duplicate (preset, version) is rejected', '23');
  PERFORM pst.fails(format(v_ok, 'v2', 'k1', v_hash, 10, 'ok/p.json'), 'a non-semver version is rejected', '23');
  PERFORM pst.fails(format(v_ok, '3.0.0', '', v_hash, 10, 'ok/p.json'), 'an empty signing key id is rejected', '23');
  PERFORM pst.fails(format(v_ok, '3.0.0', 'k1', repeat('A', 64), 10, 'ok/p.json'), 'an upper-case hash is rejected', '23');
  PERFORM pst.fails(format(v_ok, '3.0.0', 'k1', 'abc', 10, 'ok/p.json'), 'a short hash is rejected', '23');
  PERFORM pst.fails(format(v_ok, '3.0.0', 'k1', v_hash, 0, 'ok/p.json'), 'zero manifest bytes are rejected', '23');
  PERFORM pst.fails(format(v_ok, '3.0.0', 'k1', v_hash, 10, '../escape.json'), 'a traversal path is rejected', '23');
  PERFORM pst.fails(format(v_ok, '3.0.0', 'k1', v_hash, 10, '/abs/path.json'), 'an absolute path is rejected', '23');
  PERFORM pst.fails($sql$INSERT INTO public.preset_releases (preset_id, version, signing_key_id, manifest_sha256, manifest_bytes, manifest_path)
    VALUES (pst.u(19), '1.0.0', 'k1', repeat('b', 64), 10, 'sys/manifest.json')$sql$, 'a release for a system preset is rejected', '23');
  PERFORM pst.fails($sql$INSERT INTO public.preset_releases (preset_id, version, signing_key_id, manifest_sha256, manifest_bytes, manifest_path, asset_count)
    VALUES (pst.u(10), '4.0.0', 'k1', repeat('b', 64), 10, 'ok/p4.json', 2)$sql$, 'assets need a digest and prefix', '23');
  PERFORM pst.fails($sql$UPDATE public.preset_releases SET version = '9.9.9' WHERE id = pst.u(20)$sql$, 'a release row is immutable', '23');
  PERFORM pst.fails($sql$DELETE FROM public.preset_releases WHERE id = pst.u(20)$sql$, 'a published release cannot be deleted', '23');
  PERFORM pst.works($sql$DELETE FROM public.preset_releases WHERE id = pst.u(22)$sql$, 'a draft release can be deleted');
  PERFORM pst.mk_release(22, 12, '1.0.0', false);

  PERFORM pst.fails($sql$UPDATE public.preset_release_publications SET status = 'draft' WHERE release_id = pst.u(20)$sql$, 'a published release cannot return to draft', '23');
  PERFORM pst.works($sql$UPDATE public.preset_release_publications SET status = 'withdrawn' WHERE release_id = pst.u(23)$sql$, 'a release can be withdrawn');
  PERFORM pst.check((SELECT withdrawn_at IS NOT NULL FROM public.preset_release_publications WHERE release_id = pst.u(23)), 'withdrawing stamps withdrawn_at');
  PERFORM pst.works($sql$UPDATE public.preset_release_publications SET status = 'published' WHERE release_id = pst.u(23)$sql$, 'a withdrawn release can be published again');
  PERFORM pst.check((SELECT withdrawn_at IS NULL FROM public.preset_release_publications WHERE release_id = pst.u(23)), 'republishing clears withdrawn_at');
  PERFORM pst.fails($sql$UPDATE public.preset_release_publications SET release_id = pst.u(21) WHERE release_id = pst.u(20)$sql$, 'a publication cannot move to another release', '23');
END
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Packs, items and products
-- ---------------------------------------------------------------------------------------------------------------------------------

SELECT pst.mk_solo_product(30, 10, 20);
SELECT pst.mk_pack(40, ARRAY[[10, 20], [11, 21]]);
SELECT pst.mk_pack_product(41, 40);

DO $$
BEGIN
  PERFORM pst.as_admin();
  PERFORM pst.fails($sql$INSERT INTO public.preset_pack_items (pack_id, preset_id, release_id, position) VALUES (pst.u(40), pst.u(12), pst.u(21), 3)$sql$,
    'a pack item cannot pin another preset''s release', '23');
  PERFORM pst.fails($sql$INSERT INTO public.preset_pack_items (pack_id, preset_id, release_id, position) VALUES (pst.u(40), pst.u(13), pst.u(23), 2)$sql$,
    'a pack position is unique', '23');
  PERFORM pst.fails($sql$INSERT INTO public.preset_pack_items (pack_id, preset_id, release_id, position) VALUES (pst.u(40), pst.u(10), pst.u(20), 9)$sql$,
    'a preset appears once per pack', '23');
  PERFORM pst.fails($sql$INSERT INTO public.preset_pack_items (pack_id, preset_id, release_id, position) VALUES (pst.u(40), pst.u(13), pst.u(23), 0)$sql$,
    'a pack position starts at 1', '23');

  -- The 200-preset bound.
  INSERT INTO public.presets (id, engine_id, preset_key, name, scope)
  SELECT pst.u(1000 + n), 'cinema2', 'regression.bulk-' || n, 'Bulk ' || n, 'user' FROM generate_series(1, 201) AS n;
  INSERT INTO public.preset_releases (id, preset_id, version, signing_key_id, manifest_sha256, manifest_bytes, manifest_path)
  SELECT pst.u(2000 + n), pst.u(1000 + n), '1.0.0', 'regression-key', repeat('c', 64), 10, 'bulk/' || n || '/manifest.json' FROM generate_series(1, 201) AS n;
  INSERT INTO public.preset_packs (id, slug, name) VALUES (pst.u(45), 'regression-bulk-pack', 'Bulk pack');
  INSERT INTO public.preset_pack_items (pack_id, preset_id, release_id, position)
  SELECT pst.u(45), pst.u(1000 + n), pst.u(2000 + n), n FROM generate_series(1, 200) AS n;
  PERFORM pst.check((SELECT count(*) FROM public.preset_pack_items WHERE pack_id = pst.u(45)) = 200, 'a pack can hold 200 presets');
  PERFORM pst.fails($sql$INSERT INTO public.preset_pack_items (pack_id, preset_id, release_id, position) VALUES (pst.u(45), pst.u(1201), pst.u(2201), 201)$sql$,
    'a pack cannot hold a 201st preset', '23');
END
$$;

DO $$
BEGIN
  PERFORM pst.as_admin();
  PERFORM pst.check((SELECT published_at IS NOT NULL FROM public.store_products WHERE id = pst.u(30)), 'publishing a product stamps published_at');
  PERFORM pst.check((SELECT price_policy = 'free' FROM public.store_products WHERE id = pst.u(30)), 'a product is free by default');

  PERFORM pst.fails($sql$INSERT INTO public.store_products (kind, preset_id, current_release_id, slug, title, price_policy)
    VALUES ('preset', pst.u(11), pst.u(21), 'paid-one', 'Paid', 'paid')$sql$, 'only a free price policy exists for now', '23');
  PERFORM pst.fails($sql$INSERT INTO public.store_products (kind, preset_id, current_release_id, slug, title) VALUES ('preset', pst.u(11), pst.u(20), 'wrong-release', 'X')$sql$,
    'a product cannot list another preset''s release', '23');
  PERFORM pst.fails($sql$INSERT INTO public.store_products (kind, preset_id, pack_id, slug, title) VALUES ('preset', pst.u(11), pst.u(40), 'both-targets', 'X')$sql$,
    'a product has exactly one target', '23');
  PERFORM pst.fails($sql$INSERT INTO public.store_products (kind, pack_id, current_release_id, slug, title) VALUES ('pack', pst.u(45), pst.u(20), 'pack-with-release', 'X')$sql$,
    'a pack product has no standalone release', '23');
  PERFORM pst.fails($sql$INSERT INTO public.store_products (kind, preset_id, current_release_id, slug, title) VALUES ('preset', pst.u(11), pst.u(21), 'Bad Slug', 'X')$sql$,
    'a slug must be lower-case with hyphens', '23');
  PERFORM pst.fails($sql$INSERT INTO public.store_products (kind, preset_id, current_release_id, slug, title) VALUES ('preset', pst.u(10), pst.u(20), 'second-for-ten', 'X')$sql$,
    'a preset has one standalone product', '23');
  PERFORM pst.fails($sql$INSERT INTO public.store_products (kind, pack_id, slug, title) VALUES ('pack', pst.u(40), 'second-for-pack', 'X')$sql$,
    'a pack has one product', '23');

  -- Publishing needs deliverable content.
  PERFORM pst.mk_solo_product(31, 12, 22, false);
  PERFORM pst.fails($sql$UPDATE public.store_products SET status = 'published' WHERE id = pst.u(31)$sql$, 'a product with an unpublished release cannot be published', '23');
  PERFORM pst.mk_pack(42, NULL);
  PERFORM pst.mk_pack_product(43, 42, false);
  PERFORM pst.fails($sql$UPDATE public.store_products SET status = 'published' WHERE id = pst.u(43)$sql$, 'an empty pack cannot be published', '23');
  PERFORM pst.mk_pack(44, ARRAY[[12, 22]]);
  PERFORM pst.mk_pack_product(46, 44, false);
  PERFORM pst.fails($sql$UPDATE public.store_products SET status = 'published' WHERE id = pst.u(46)$sql$, 'a pack with an unpublished member release cannot be published', '23');
  PERFORM pst.fails($sql$UPDATE public.store_products SET kind = 'pack', preset_id = NULL, pack_id = pst.u(40) WHERE id = pst.u(31)$sql$, 'a product keeps its kind and target', '23');
  PERFORM pst.fails($sql$UPDATE public.store_products SET preset_id = pst.u(13), current_release_id = pst.u(23) WHERE id = pst.u(31)$sql$, 'a product keeps its preset', '23');
END
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Free claims and revocation (service role)
-- ---------------------------------------------------------------------------------------------------------------------------------

DO $$
DECLARE
  v_n integer;
BEGIN
  PERFORM pst.as_service();
  PERFORM pst.check(public.claim_free_store_product(pst.u(1), pst.u(30)) = 1, 'claiming a standalone product inserts one grant');
  PERFORM pst.check((SELECT release_id FROM public.preset_entitlement_grants WHERE user_id = pst.u(1) AND product_id = pst.u(30)) = pst.u(20), 'the grant pins the delivered release');
  PERFORM pst.check((SELECT source_kind FROM public.preset_entitlement_grants WHERE user_id = pst.u(1) AND product_id = pst.u(30)) = 'free_claim', 'the grant records its source');
  PERFORM pst.check(public.claim_free_store_product(pst.u(1), pst.u(30)) = 0, 'a repeated claim inserts nothing');
  PERFORM pst.check(public.claim_free_store_product(pst.u(1), pst.u(41)) = 2, 'claiming a pack inserts one grant per member');
  PERFORM pst.check(public.claim_free_store_product(pst.u(1), pst.u(41)) = 0, 'a repeated pack claim inserts nothing');
  PERFORM pst.check((SELECT count(*) FROM public.preset_entitlement_grants WHERE user_id = pst.u(1) AND preset_id = pst.u(10)) = 2,
    'a preset can be held through a standalone claim and a pack claim at once');
  PERFORM pst.check(public.claim_free_store_product(pst.u(2), pst.u(41)) = 2, 'another user can claim the same pack');

  PERFORM pst.fails($sql$SELECT public.claim_free_store_product(pst.u(1), pst.u(31))$sql$, 'an unpublished product cannot be claimed', '23');
  PERFORM pst.fails($sql$SELECT public.claim_free_store_product(pst.u(1), pst.u(46))$sql$, 'an unpublished pack cannot be claimed', '23');
  PERFORM pst.fails($sql$SELECT public.claim_free_store_product(pst.u(1), pst.u(999))$sql$, 'an unknown product cannot be claimed', 'P0002');
  PERFORM pst.fails($sql$SELECT public.claim_free_store_product(pst.u(999), pst.u(30))$sql$, 'an unknown user cannot claim', 'P0002');

  -- A pack that gains a preset later grants nothing by itself; a repeat claim picks it up.
  PERFORM pst.as_admin();
  PERFORM pst.mk_release(24, 13, '2.0.0');
  PERFORM pst.as_service();
  SELECT count(*) INTO v_n FROM public.preset_entitlement_grants WHERE user_id = pst.u(2);
  PERFORM pst.as_admin();
  INSERT INTO public.preset_pack_items (pack_id, preset_id, release_id, position) VALUES (pst.u(40), pst.u(13), pst.u(24), 3);
  PERFORM pst.as_service();
  PERFORM pst.check((SELECT count(*) FROM public.preset_entitlement_grants WHERE user_id = pst.u(2)) = v_n, 'adding a preset to a pack grants nothing by itself');
  PERFORM pst.check(public.claim_free_store_product(pst.u(2), pst.u(41)) = 1, 'a repeat claim picks up only the added preset');
  PERFORM pst.check((SELECT release_id FROM public.preset_entitlement_grants WHERE user_id = pst.u(2) AND preset_id = pst.u(10) AND product_id = pst.u(41)) = pst.u(20),
    'an earlier grant keeps its release');

  -- A withdrawn member release stops the whole claim, and nothing is half-written.
  PERFORM pst.as_admin();
  UPDATE public.preset_release_publications SET status = 'withdrawn' WHERE release_id = pst.u(24);
  PERFORM pst.as_service();
  PERFORM pst.fails($sql$SELECT public.claim_free_store_product(pst.u(3), pst.u(41))$sql$, 'a pack with a withdrawn member cannot be claimed', '23');
  PERFORM pst.check((SELECT count(*) FROM public.preset_entitlement_grants WHERE user_id = pst.u(3)) = 0, 'a failed pack claim leaves no grants');
  PERFORM pst.as_admin();
  UPDATE public.preset_release_publications SET status = 'published' WHERE release_id = pst.u(24);
  PERFORM pst.as_service();
  PERFORM pst.check(public.claim_free_store_product(pst.u(3), pst.u(41)) = 3, 'republishing the member makes the pack claimable again');

  -- Revocation.
  PERFORM pst.fails($sql$SELECT public.revoke_free_store_claim(pst.u(3), pst.u(41), '')$sql$, 'a revocation needs a reason', '23');
  PERFORM pst.fails($sql$SELECT public.revoke_free_store_claim(pst.u(3), pst.u(41), NULL)$sql$, 'a revocation reason cannot be null', '23');
  PERFORM pst.check(public.revoke_free_store_claim(pst.u(3), pst.u(41), 'takedown') = 3, 'revoking a claim revokes every grant from that product');
  PERFORM pst.check(public.revoke_free_store_claim(pst.u(3), pst.u(41), 'takedown') = 0, 'a repeated revocation changes nothing');
  PERFORM pst.check(public.claim_free_store_product(pst.u(3), pst.u(41)) = 0, 'a claim does not revive a revoked grant');
  PERFORM pst.check((SELECT count(*) FROM public.preset_entitlement_grants WHERE user_id = pst.u(3) AND revoked_at IS NULL) = 0, 'a revoked user holds nothing active');
  PERFORM pst.check(public.revoke_free_store_claim(pst.u(1), pst.u(41), 'takedown') = 2, 'revoking the pack leaves the standalone claim alone');
  PERFORM pst.check((SELECT count(*) FROM public.preset_entitlement_grants WHERE user_id = pst.u(1) AND revoked_at IS NULL) = 1, 'the standalone grant stays active');
  PERFORM pst.check((SELECT product_id FROM public.preset_entitlement_grants WHERE user_id = pst.u(1) AND revoked_at IS NULL) = pst.u(30), 'the surviving grant is the standalone one');

  PERFORM pst.as_admin();
  PERFORM pst.fails($sql$UPDATE public.preset_entitlement_grants SET revoked_at = NULL, revoked_reason = NULL WHERE user_id = pst.u(3)$sql$, 'a revoked grant cannot be restored', '23');
  PERFORM pst.fails($sql$UPDATE public.preset_entitlement_grants SET release_id = pst.u(21) WHERE user_id = pst.u(1) AND product_id = pst.u(30)$sql$, 'a grant''s release is immutable', '23');
  PERFORM pst.fails($sql$UPDATE public.preset_entitlement_grants SET user_id = pst.u(2) WHERE user_id = pst.u(1) AND product_id = pst.u(30)$sql$, 'a grant''s owner is immutable', '23');
  PERFORM pst.fails($sql$INSERT INTO public.preset_entitlement_grants (user_id, preset_id, release_id, product_id) VALUES (pst.u(3), pst.u(10), pst.u(21), pst.u(30))$sql$,
    'a grant cannot pin another preset''s release', '23');
  PERFORM pst.fails($sql$INSERT INTO public.preset_entitlement_grants (user_id, preset_id, release_id, source_kind, product_id) VALUES (pst.u(3), pst.u(10), pst.u(20), 'purchase', pst.u(30))$sql$,
    'a purchase source does not exist yet', '23');

  -- The legacy table is never written by the store.
  PERFORM pst.check(NOT EXISTS (
    SELECT 1 FROM public.user_presets AS u WHERE u.preset_id IN (SELECT id FROM public.presets WHERE preset_key LIKE 'regression.%')
      AND NOT EXISTS (SELECT 1 FROM pst_legacy AS l WHERE l.user_id = u.user_id AND l.preset_id = u.preset_id AND l.is_favorite = u.is_favorite AND l.updated_at = u.updated_at)
  ) AND (SELECT count(*) FROM public.user_presets WHERE preset_id IN (SELECT id FROM public.presets WHERE preset_key LIKE 'regression.%')) = (SELECT count(*) FROM pst_legacy),
    'claims and revocations never write user_presets');
END
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- What each role can see and do
-- ---------------------------------------------------------------------------------------------------------------------------------

DO $$
BEGIN
  PERFORM pst.as_anon();
  PERFORM pst.expect_count($sql$SELECT 1 FROM public.store_products WHERE id = pst.u(30)$sql$, 1, 'anon sees a published product');
  PERFORM pst.expect_count($sql$SELECT 1 FROM public.store_products WHERE id IN (pst.u(31), pst.u(43), pst.u(46))$sql$, 0, 'anon never sees a draft product');
  PERFORM pst.expect_count($sql$SELECT id, version FROM public.preset_releases WHERE id IN (pst.u(20), pst.u(22))$sql$, 1, 'anon sees only published releases');
  PERFORM pst.fails($sql$SELECT manifest_path FROM public.preset_releases$sql$, 'anon cannot select a release path', '42501');
  PERFORM pst.fails($sql$SELECT * FROM public.preset_releases$sql$, 'select * on releases is denied by design', '42501');
  PERFORM pst.fails($sql$SELECT signing_key_id FROM public.preset_releases$sql$, 'anon cannot select a signing key id', '42501');
  PERFORM pst.expect_count($sql$SELECT 1 FROM public.preset_release_publications WHERE release_id = pst.u(22)$sql$, 0, 'anon cannot see a draft publication');
  PERFORM pst.expect_count($sql$SELECT 1 FROM public.preset_packs WHERE id = pst.u(40)$sql$, 1, 'anon sees a pack with a published product');
  PERFORM pst.expect_count($sql$SELECT 1 FROM public.preset_packs WHERE id IN (pst.u(42), pst.u(44), pst.u(45))$sql$, 0, 'anon cannot see a pack with no published product');
  PERFORM pst.expect_count($sql$SELECT 1 FROM public.preset_pack_items WHERE pack_id = pst.u(40)$sql$, 3, 'anon sees the items of a listed pack');
  PERFORM pst.expect_count($sql$SELECT 1 FROM public.preset_pack_items WHERE pack_id = pst.u(44)$sql$, 0, 'anon cannot see the items of an unlisted pack');
  PERFORM pst.fails($sql$SELECT 1 FROM public.preset_entitlement_grants$sql$, 'anon cannot read grants', '42501');
  PERFORM pst.fails($sql$SELECT 1 FROM public.user_preset_preferences$sql$, 'anon cannot read preferences', '42501');
  PERFORM pst.fails($sql$SELECT public.claim_free_store_product(pst.u(1), pst.u(30))$sql$, 'anon cannot call claim', '42501');
  PERFORM pst.fails($sql$INSERT INTO public.store_products (kind, preset_id, slug, title) VALUES ('preset', pst.u(11), 'anon-product', 'X')$sql$, 'anon cannot write products', '42501');

  PERFORM pst.as_user(1);
  PERFORM pst.expect_count($sql$SELECT 1 FROM public.preset_entitlement_grants$sql$, 3, 'a user sees only their own grants');
  PERFORM pst.expect_count($sql$SELECT id, user_id, preset_id, release_id, source_kind, product_id, granted_at, revoked_at FROM public.preset_entitlement_grants WHERE user_id = pst.u(2)$sql$, 0,
    'a user cannot see another user''s grants');
  PERFORM pst.fails($sql$SELECT revoked_reason FROM public.preset_entitlement_grants$sql$, 'a user cannot read a revocation reason', '42501');
  PERFORM pst.fails($sql$UPDATE public.preset_entitlement_grants SET revoked_at = now(), revoked_reason = 'self' WHERE user_id = pst.u(1)$sql$, 'a user cannot revoke a grant', '42501');
  PERFORM pst.fails($sql$DELETE FROM public.preset_entitlement_grants WHERE user_id = pst.u(1)$sql$, 'a user cannot delete a grant', '42501');
  PERFORM pst.fails($sql$INSERT INTO public.preset_entitlement_grants (user_id, preset_id, release_id, product_id) VALUES (pst.u(1), pst.u(11), pst.u(21), pst.u(41))$sql$, 'a user cannot give themselves a grant', '42501');
  PERFORM pst.fails($sql$SELECT public.claim_free_store_product(pst.u(1), pst.u(30))$sql$, 'a user cannot call claim', '42501');
  PERFORM pst.fails($sql$SELECT public.revoke_free_store_claim(pst.u(1), pst.u(30), 'x')$sql$, 'a user cannot call revoke', '42501');
  PERFORM pst.fails($sql$UPDATE public.store_products SET title = 'Hacked' WHERE id = pst.u(30)$sql$, 'a user cannot edit a product', '42501');
  PERFORM pst.fails($sql$INSERT INTO public.preset_pack_items (pack_id, preset_id, release_id, position) VALUES (pst.u(40), pst.u(12), pst.u(22), 9)$sql$, 'a user cannot edit a pack', '42501');
  PERFORM pst.fails($sql$UPDATE public.preset_release_publications SET status = 'withdrawn' WHERE release_id = pst.u(20)$sql$, 'a user cannot change a publication', '42501');

  PERFORM pst.as_user(3);
  PERFORM pst.expect_count($sql$SELECT 1 FROM public.preset_entitlement_grants WHERE revoked_at IS NOT NULL$sql$, 3, 'a user sees their own revoked grants too');
  PERFORM pst.expect_count($sql$SELECT 1 FROM public.preset_entitlement_grants WHERE revoked_at IS NULL$sql$, 0, 'and none of them is active');

  -- An archived product is visible only to someone who holds a grant from it.
  PERFORM pst.as_admin();
  UPDATE public.store_products SET status = 'archived' WHERE id = pst.u(30);
  PERFORM pst.as_anon();
  PERFORM pst.expect_count($sql$SELECT 1 FROM public.store_products WHERE id = pst.u(30)$sql$, 0, 'anon cannot see an archived product');
  PERFORM pst.as_user(2);
  PERFORM pst.expect_count($sql$SELECT 1 FROM public.store_products WHERE id = pst.u(30)$sql$, 0, 'a user without a grant cannot see an archived product');
  PERFORM pst.as_user(1);
  PERFORM pst.expect_count($sql$SELECT 1 FROM public.store_products WHERE id = pst.u(30)$sql$, 1, 'a user with a grant still sees the archived product');
  PERFORM pst.as_admin();
  UPDATE public.store_products SET status = 'published' WHERE id = pst.u(30);

  PERFORM pst.as_service();
  PERFORM pst.check((SELECT count(*) FROM public.preset_releases) >= 4, 'service_role reads every release, drafts included');
  PERFORM pst.check((SELECT count(*) FROM public.preset_entitlement_grants) >= 8, 'service_role reads every grant');
  PERFORM pst.as_admin();
END
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Favourites
-- ---------------------------------------------------------------------------------------------------------------------------------

DO $$
BEGIN
  PERFORM pst.as_anon();
  PERFORM pst.fails($sql$SELECT public.set_preset_favorite(pst.u(19), true)$sql$, 'anon cannot set a favourite', '42501');

  PERFORM pst.as_user(1);
  PERFORM pst.works($sql$SELECT public.set_preset_favorite(pst.u(19), true)$sql$, 'a user can favourite a system preset they hold no row for');
  PERFORM pst.expect_count($sql$SELECT 1 FROM public.user_preset_preferences WHERE preset_id = pst.u(19) AND is_favorite$sql$, 1, 'the favourite is stored');
  PERFORM pst.expect_count($sql$SELECT 1 FROM public.user_presets WHERE preset_id = pst.u(19)$sql$, 0, 'favouriting grants no holding');
  PERFORM pst.works($sql$SELECT public.set_preset_favorite(pst.u(19), false)$sql$, 'a favourite can be turned off');
  PERFORM pst.expect_count($sql$SELECT 1 FROM public.user_preset_preferences WHERE preset_id = pst.u(19) AND NOT is_favorite$sql$, 1, 'the flag flips');
  PERFORM pst.works($sql$SELECT public.set_preset_favorite(pst.u(13), false)$sql$, 'a user can favourite a preset they hold');
  PERFORM pst.fails($sql$SELECT public.set_preset_favorite(pst.u(9999), true)$sql$, 'an unknown preset is rejected', '23');
  PERFORM pst.fails($sql$SELECT public.set_preset_favorite(NULL, true)$sql$, 'a null preset is rejected', '22');
  PERFORM pst.fails($sql$SELECT public.set_preset_favorite(pst.u(19), NULL)$sql$, 'a null flag is rejected', '22');
  PERFORM pst.fails($sql$INSERT INTO public.user_preset_preferences (user_id, preset_id, is_favorite) VALUES (pst.u(2), pst.u(11), true)$sql$, 'a user cannot write another user''s preference', '42501');
  PERFORM pst.works($sql$INSERT INTO public.user_preset_preferences (user_id, preset_id, is_favorite) VALUES (pst.u(1), pst.u(11), true)$sql$, 'a user can write their own preference');
  PERFORM pst.fails($sql$UPDATE public.user_preset_preferences SET created_at = now() WHERE user_id = pst.u(1)$sql$, 'only the flag is updatable', '42501');
  PERFORM pst.works($sql$UPDATE public.user_preset_preferences SET is_favorite = false WHERE user_id = pst.u(1) AND preset_id = pst.u(11)$sql$, 'the flag is updatable');
  PERFORM pst.works($sql$DELETE FROM public.user_preset_preferences WHERE user_id = pst.u(1) AND preset_id = pst.u(11)$sql$, 'a user can delete their own preference');

  PERFORM pst.as_user(2);
  PERFORM pst.expect_count($sql$SELECT 1 FROM public.user_preset_preferences$sql$, 0, 'a user cannot see another user''s preferences');

  PERFORM pst.as_admin();
  PERFORM pst.check((SELECT is_favorite FROM public.user_presets WHERE user_id = pst.u(1) AND preset_id = pst.u(13)) = true, 'the legacy favourite flag is untouched');
END
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Optional fixtures (supabase/fixtures): checked only when they are loaded
-- ---------------------------------------------------------------------------------------------------------------------------------

DO $$
BEGIN
  PERFORM pst.as_admin();
  IF NOT EXISTS (SELECT 1 FROM public.store_products WHERE slug = 'fixture-free-pack') THEN
    RAISE NOTICE 'fixtures not loaded: skipped fixture checks';
    RETURN;
  END IF;
  PERFORM pst.check((SELECT count(*) FROM public.store_products WHERE slug LIKE 'fixture-%' AND status = 'published') = 3, 'fixture: three published products');
  PERFORM pst.check((SELECT count(*) FROM public.preset_pack_items WHERE pack_id = (SELECT id FROM public.preset_packs WHERE slug = 'fixture-free-pack')) = 2, 'fixture: the pack has two presets');
  PERFORM pst.check(EXISTS (
    SELECT 1 FROM public.store_products AS solo JOIN public.preset_pack_items AS item ON item.preset_id = solo.preset_id
    JOIN public.preset_packs AS pack ON pack.id = item.pack_id WHERE solo.slug = 'fixture-pack-a-solo' AND pack.slug = 'fixture-free-pack'
  ), 'fixture: a standalone product overlaps a pack member');
  PERFORM pst.check(NOT EXISTS (SELECT 1 FROM public.preset_entitlement_grants WHERE preset_id IN (SELECT id FROM public.presets WHERE preset_key LIKE 'fixture.store.%')), 'fixture: no grants are seeded');
  PERFORM pst.check(NOT EXISTS (SELECT 1 FROM public.user_presets WHERE preset_id IN (SELECT id FROM public.presets WHERE preset_key LIKE 'fixture.store.%')), 'fixture: no holdings are seeded');
END
$$;

DO $$
BEGIN
  RAISE NOTICE 'PRESET STORE REGRESSION: % checks passed', current_setting('pst.checks', true);
END
$$;

ROLLBACK;
