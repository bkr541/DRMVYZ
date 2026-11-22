-- Rollback for 0060_preset_catalog_designing_status.sql. Presets marked "designing" go back to no status, because the older constraint does not allow the value.
UPDATE public.preset_catalog_metadata SET publication_status = NULL WHERE publication_status = 'designing';
ALTER TABLE public.preset_catalog_metadata DROP CONSTRAINT preset_catalog_metadata_status_check;
ALTER TABLE public.preset_catalog_metadata ADD CONSTRAINT preset_catalog_metadata_status_check
  CHECK (publication_status IS NULL OR publication_status IN ('draft', 'published', 'archived'));
