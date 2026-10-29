-- Fingerprint of the tables the preset store must never alter. Run it on the disposable database BEFORE applying 0043 and again AFTER (and after
-- the regression file): the three rows must be identical. Read-only.
--
--   psql "$LOCAL_TEST_DB_URL" -At -f supabase/tests/preset_store_preservation_snapshot.sql
--
-- The regression file's own rows are rolled back, so they never appear here. Fixture rows (supabase/fixtures) DO add presets, so take the
-- "before" snapshot after any fixture load you intend to keep, or compare before/after fixtures separately.

SELECT 'presets' AS table_name, count(*) AS row_count, md5(COALESCE(string_agg(to_jsonb(t)::text, '|' ORDER BY t.id), '')) AS fingerprint FROM public.presets AS t
UNION ALL
SELECT 'user_presets', count(*), md5(COALESCE(string_agg(to_jsonb(t)::text, '|' ORDER BY t.user_id, t.preset_id), '')) FROM public.user_presets AS t
UNION ALL
SELECT 'preset_organization', count(*), md5(COALESCE(string_agg(to_jsonb(t)::text, '|' ORDER BY t.user_id, t.preset_key), '')) FROM public.preset_organization AS t
ORDER BY 1;
