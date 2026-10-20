-- GO-TO and RELIQUARY are private (user-scope) Cinema 2.0 presets held by the owner's account only.
--
-- Production already holds both rows (they were added by hand when 0034 was applied), but no migration recorded them, so a database rebuilt
-- from migrations would have classified both as system presets and shown them to every account. This records them next to CONDUIT (0036).
--
-- Unlike 0036, which granted every profile that existed, the holding goes to ONE account: the oldest profile, i.e. the owner. A second
-- account therefore holds none of GO-TO, RELIQUARY or CONDUIT and sees none of them under USER (see 0034, 0035). Re-runnable: every write is
-- an upsert, and on production this changes no rows.

INSERT INTO public.presets (engine_id, preset_key, name, scope)
VALUES
  ('cinema2', 'drmvyz.cinema2.go-to', 'GO-TO', 'user'),
  ('cinema2', 'drmvyz.cinema2.reliquary', 'RELIQUARY', 'user')
ON CONFLICT (engine_id, preset_key) DO UPDATE SET name = EXCLUDED.name, scope = EXCLUDED.scope;

INSERT INTO public.user_presets (user_id, preset_id)
SELECT owner.id, presets.id
FROM (SELECT id FROM public.profiles ORDER BY created_at, id LIMIT 1) AS owner
JOIN public.presets
  ON presets.engine_id = 'cinema2'
 AND presets.preset_key IN ('drmvyz.cinema2.go-to', 'drmvyz.cinema2.reliquary')
ON CONFLICT (user_id, preset_id) DO NOTHING;
