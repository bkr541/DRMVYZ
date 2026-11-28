-- Rollback for 0064_preset_catalog_off_switch.sql. Every switched-off preset becomes available again (its publication status still applies).
ALTER TABLE public.preset_catalog_metadata DROP CONSTRAINT IF EXISTS preset_catalog_metadata_disabled_reason_check;
ALTER TABLE public.preset_catalog_metadata DROP COLUMN IF EXISTS disabled_reason;
ALTER TABLE public.preset_catalog_metadata DROP COLUMN IF EXISTS disabled;
