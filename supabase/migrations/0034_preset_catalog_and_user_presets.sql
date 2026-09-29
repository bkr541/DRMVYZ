-- Preset catalog + user presets.
--
-- Before this, no table tied a preset to a user. `visual_presets` (0001) is a per-user store of saved effect-chain snapshots from the
-- original VJ view; it has no relationship to the presets the engines ship (Cinema 2.0's GO-TO, RELIQUARY, ...), which live in code.
--
--   presets       one row per engine preset, keyed by (engine_id, preset_key) where preset_key is the id the app's preset library
--                 already uses (for Cinema 2.0 the registry id, e.g. 'drmvyz.cinema2.reliquary').
--                 scope 'system' = shown to everyone under a Presets tab's SYSTEM sub-tab.
--                 scope 'user'   = private: shown only to the users who hold it in user_presets (the USER sub-tab).
--   user_presets  the join: which user holds which preset, plus that user's own per-preset state (favourite).
--   profiles      the user (profiles.id = auth.users.id), as everywhere else in the schema.
--
-- Users can read the catalog rows they may see and their own holdings. Writes go through the service role / migrations only: who holds a
-- private preset is decided by us, not self-served.

CREATE TABLE IF NOT EXISTS public.presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engine_id text NOT NULL,
  preset_key text NOT NULL,
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT presets_engine_id_check CHECK (length(btrim(engine_id)) BETWEEN 1 AND 64),
  CONSTRAINT presets_preset_key_check CHECK (length(btrim(preset_key)) BETWEEN 1 AND 200),
  CONSTRAINT presets_name_check CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  CONSTRAINT presets_scope_check CHECK (scope IN ('system', 'user')),
  CONSTRAINT presets_engine_key_unique UNIQUE (engine_id, preset_key)
);

CREATE INDEX IF NOT EXISTS idx_presets_scope ON public.presets(scope, engine_id);

DROP TRIGGER IF EXISTS trg_presets_updated_at ON public.presets;
CREATE TRIGGER trg_presets_updated_at
  BEFORE UPDATE ON public.presets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.user_presets (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  preset_id uuid NOT NULL REFERENCES public.presets(id) ON DELETE CASCADE,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, preset_id)
);

CREATE INDEX IF NOT EXISTS idx_user_presets_preset ON public.user_presets(preset_id);

DROP TRIGGER IF EXISTS trg_user_presets_updated_at ON public.user_presets;
CREATE TRIGGER trg_user_presets_updated_at
  BEFORE UPDATE ON public.user_presets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presets ENABLE ROW LEVEL SECURITY;

-- The user_presets policy is a plain own-row check. The presets policy reads user_presets, which is safe because that table's own policy
-- never reads presets back.
DROP POLICY IF EXISTS "user_presets: own select" ON public.user_presets;
CREATE POLICY "user_presets: own select"
  ON public.user_presets FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "presets: visible select" ON public.presets;
CREATE POLICY "presets: visible select"
  ON public.presets FOR SELECT
  USING (
    scope = 'system'
    OR EXISTS (
      SELECT 1
      FROM public.user_presets AS held
      WHERE held.preset_id = presets.id
        AND held.user_id = auth.uid()
    )
  );
