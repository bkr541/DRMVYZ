-- Emergency off switch for a shipped preset (beta remediation CAT-01).
-- ADDITIVE ONLY. An admin can take a preset out of every app without a new build: the app hides it, stops it being used and replaces it on stage.
-- The preset's publication status is kept, so switching it back on restores it exactly. Readable by every signed-in user and writable only by
-- admins, through the existing preset_catalog_metadata policies (0056).
ALTER TABLE public.preset_catalog_metadata
  ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_reason text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'preset_catalog_metadata_disabled_reason_check') THEN
    ALTER TABLE public.preset_catalog_metadata
      ADD CONSTRAINT preset_catalog_metadata_disabled_reason_check CHECK (disabled_reason IS NULL OR length(disabled_reason) <= 280);
  END IF;
END $$;

COMMENT ON COLUMN public.preset_catalog_metadata.disabled IS 'Emergency off switch: hides the preset from every user and stops it being used, whatever its publication status.';
COMMENT ON COLUMN public.preset_catalog_metadata.disabled_reason IS 'Optional note shown to users while the preset is switched off (up to 280 characters).';
