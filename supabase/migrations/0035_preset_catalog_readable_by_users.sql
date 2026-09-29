-- The catalog is readable by every signed-in user.
--
-- 0034 hid a private preset's catalog row from everyone but its holders. That defeats the point for the client: a Presets tab can only keep a
-- private preset out of SYSTEM for other accounts if it can see that the preset is private. A catalog row is only an engine, a preset id, a
-- name and a scope (the preset itself ships in the app), so it is not secret. Who HOLDS a private preset stays private: user_presets is still
-- own-rows-only, and neither table is writable from the client.

DROP POLICY IF EXISTS "presets: visible select" ON public.presets;
DROP POLICY IF EXISTS "presets: authenticated select" ON public.presets;
CREATE POLICY "presets: authenticated select"
  ON public.presets FOR SELECT
  TO authenticated
  USING (true);
