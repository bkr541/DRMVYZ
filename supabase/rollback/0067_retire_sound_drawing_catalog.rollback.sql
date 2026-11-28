-- Rollback for 0067_retire_sound_drawing_catalog.sql.
--
-- 0067 deletes rows for a preset family the app no longer ships; it does not change the schema, so there is nothing structural to undo.
-- The deleted rows cannot be recreated from here. To keep them, take a backup (or export the rows below) before applying 0067:
--
--   SELECT * FROM public.preset_catalog_metadata WHERE engine_id IN ('soundDrawing', 'oscilloscope');
--   SELECT * FROM public.presets WHERE engine_id IN ('soundDrawing', 'oscilloscope');
SELECT 1;
