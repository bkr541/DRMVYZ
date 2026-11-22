-- Add the "designing" publication status to the admin preset catalog: a preset that is still being designed, before it is a draft. Rows, RLS and every other constraint are untouched.
ALTER TABLE public.preset_catalog_metadata DROP CONSTRAINT preset_catalog_metadata_status_check;
ALTER TABLE public.preset_catalog_metadata ADD CONSTRAINT preset_catalog_metadata_status_check
  CHECK (publication_status IS NULL OR publication_status IN ('designing', 'draft', 'published', 'archived'));
