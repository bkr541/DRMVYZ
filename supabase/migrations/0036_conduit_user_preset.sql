-- CONDUIT becomes a private (user-scope) Cinema 2.0 preset held by the owner's account.
--
-- The preset itself ships in the app (drmvyz.cinema2.conduit, see presets/Cinema2ConduitPreset.ts); this only adds its catalog row with scope
-- 'user' and the holding row, so it shows under the Cinema 2.0 Presets tab's USER sub-tab for the owner and is kept out of SYSTEM for everyone
-- else (0034, 0035). The holder is matched by email so the grant cannot land on another account. Re-runnable: both writes are upserts.

INSERT INTO public.presets (engine_id, preset_key, name, scope)
VALUES ('cinema2', 'drmvyz.cinema2.conduit', 'CONDUIT', 'user')
ON CONFLICT (engine_id, preset_key) DO UPDATE SET name = EXCLUDED.name, scope = EXCLUDED.scope;

INSERT INTO public.user_presets (user_id, preset_id)
SELECT profiles.id, presets.id
FROM public.profiles
JOIN auth.users ON auth.users.id = profiles.id
JOIN public.presets ON presets.engine_id = 'cinema2' AND presets.preset_key = 'drmvyz.cinema2.conduit'
WHERE lower(auth.users.email) = 'kodyrobinson02@gmail.com'
ON CONFLICT (user_id, preset_id) DO NOTHING;
