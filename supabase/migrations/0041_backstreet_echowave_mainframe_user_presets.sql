-- Backstreet, Echowave and Mainframe become private (user-scope) Cinema 2.0 presets held by the owner's account only.
--
-- Same shape as 0040: a catalog row with scope 'user' (so the Cinema 2.0 SYSTEM sub-tab keeps them from everyone else, 0034/0035) and one
-- holding for the oldest profile, i.e. the owner. A second account holds none of them. The presets ship in the app (see presets/Cinema2*Preset.ts).
-- Re-runnable: every write is an upsert.

INSERT INTO public.presets (engine_id, preset_key, name, scope)
VALUES
  ('cinema2', 'drmvyz.cinema2.backstreet', 'Backstreet', 'user'),
  ('cinema2', 'drmvyz.cinema2.echowave', 'Echowave', 'user'),
  ('cinema2', 'drmvyz.cinema2.mainframe', 'Mainframe', 'user')
ON CONFLICT (engine_id, preset_key) DO UPDATE SET name = EXCLUDED.name, scope = EXCLUDED.scope;

INSERT INTO public.user_presets (user_id, preset_id)
SELECT owner.id, presets.id
FROM (SELECT id FROM public.profiles ORDER BY created_at, id LIMIT 1) AS owner
JOIN public.presets
  ON presets.engine_id = 'cinema2'
 AND presets.preset_key IN ('drmvyz.cinema2.backstreet', 'drmvyz.cinema2.echowave', 'drmvyz.cinema2.mainframe')
ON CONFLICT (user_id, preset_id) DO NOTHING;
