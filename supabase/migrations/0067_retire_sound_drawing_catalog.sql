-- Retire the legacy Sound Drawing engine's catalog rows.
--
-- The app no longer ships the legacy Sound Drawing (`oscilloscope`) engine or its presets; saved projects restore as Sound Drawing XY
-- (docs/sound-drawing-xy.md). The Admin Console keyed those presets by engine 'soundDrawing'. Their metadata rows no longer match any preset.
--
--   * preset_catalog_metadata rows for the engine are deleted.
--   * public.presets rows for the engine are deleted (user holdings and preferences cascade), except any row still referenced by a release,
--     pack, store product or entitlement grant: those keep their history and are reported instead of being removed.

DO $$
DECLARE
  metadata_removed integer;
  presets_removed integer;
  presets_kept integer;
BEGIN
  DELETE FROM public.preset_catalog_metadata
  WHERE engine_id IN ('soundDrawing', 'oscilloscope');
  GET DIAGNOSTICS metadata_removed = ROW_COUNT;

  DELETE FROM public.presets p
  WHERE p.engine_id IN ('soundDrawing', 'oscilloscope')
    AND NOT EXISTS (SELECT 1 FROM public.preset_releases r WHERE r.preset_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.preset_pack_items i WHERE i.preset_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.store_products s WHERE s.preset_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.preset_entitlement_grants g WHERE g.preset_id = p.id);
  GET DIAGNOSTICS presets_removed = ROW_COUNT;

  SELECT count(*) INTO presets_kept FROM public.presets WHERE engine_id IN ('soundDrawing', 'oscilloscope');

  RAISE NOTICE 'Sound Drawing retirement: % metadata rows removed, % preset rows removed, % preset rows kept (still referenced by store history).',
    metadata_removed, presets_removed, presets_kept;
END
$$;
