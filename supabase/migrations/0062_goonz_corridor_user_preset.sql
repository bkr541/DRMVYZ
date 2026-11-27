-- Owner-only Cinema 2.0 preset, following 0040 and 0041. Re-runnable.
-- Run against the existing project after applying the code patch. The oldest
-- profile is the established owner convention; no other profiles are granted it.
INSERT INTO public.presets (engine_id, preset_key, name, scope)
VALUES ('cinema2', 'drmvyz.cinema2.goonz-corridor', 'GOONZ CORRIDOR', 'user')
ON CONFLICT (engine_id, preset_key) DO UPDATE SET name = EXCLUDED.name, scope = EXCLUDED.scope;

INSERT INTO public.user_presets (user_id, preset_id)
SELECT owner.id, presets.id
FROM (SELECT id FROM public.profiles ORDER BY created_at, id LIMIT 1) AS owner
JOIN public.presets
  ON presets.engine_id = 'cinema2'
 AND presets.preset_key = 'drmvyz.cinema2.goonz-corridor'
ON CONFLICT (user_id, preset_id) DO NOTHING;
