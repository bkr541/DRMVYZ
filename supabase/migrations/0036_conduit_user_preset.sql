-- CONDUIT becomes a private (user-scope) Cinema 2.0 preset held by the owner's account.
--
-- The preset itself ships in the app (drmvyz.cinema2.conduit, see presets/Cinema2ConduitPreset.ts); this only adds its catalog row with scope
-- 'user' and the holding row, so it shows under the Cinema 2.0 Presets tab's USER sub-tab for the holder and is kept out of SYSTEM for everyone
-- else (0034, 0035). DRMVYZ has a single user today, so every profile holds it; a first draft matched one email address and silently
-- granted nothing when the account's email differed. Re-runnable: both writes are upserts.

INSERT INTO public.presets (engine_id, preset_key, name, scope)
VALUES ('cinema2', 'drmvyz.cinema2.conduit', 'CONDUIT', 'user')
ON CONFLICT (engine_id, preset_key) DO UPDATE SET name = EXCLUDED.name, scope = EXCLUDED.scope;

INSERT INTO public.user_presets (user_id, preset_id)
SELECT profiles.id, presets.id
FROM public.profiles
JOIN public.presets ON presets.engine_id = 'cinema2' AND presets.preset_key = 'drmvyz.cinema2.conduit'
ON CONFLICT (user_id, preset_id) DO NOTHING;

-- Shows what was granted (1 catalog row; 1 holding per profile).
SELECT presets.preset_key, presets.scope, count(user_presets.user_id) AS holders
FROM public.presets
LEFT JOIN public.user_presets ON user_presets.preset_id = presets.id
WHERE presets.engine_id = 'cinema2'
GROUP BY presets.preset_key, presets.scope
ORDER BY presets.preset_key;
