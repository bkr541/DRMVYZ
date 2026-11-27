-- CHROMAVERSE system catalog pack; no individual ownership grants. Re-runnable.
BEGIN;
INSERT INTO public.presets (engine_id, preset_key, name, scope) VALUES
  ('cinema2', 'drmvyz.cinema2.chromaverse-pulse', 'PULSE', 'system'),
  ('cinema2', 'drmvyz.cinema2.chromaverse-space-jellyfish', 'SPACE JELLYFISH', 'system'),
  ('cinema2', 'drmvyz.cinema2.chromaverse-alter-ego', 'ALTER EGO', 'system'),
  ('cinema2', 'drmvyz.cinema2.chromaverse-temple-of-light', 'TEMPLE OF LIGHT', 'system'),
  ('cinema2', 'drmvyz.cinema2.chromaverse-starfield-warp', 'STARFIELD WARP', 'system'),
  ('cinema2', 'drmvyz.cinema2.chromaverse-torus', 'TORUS', 'system'),
  ('cinema2', 'drmvyz.cinema2.chromaverse-time-tunnel', 'TIME TUNNEL', 'system'),
  ('cinema2', 'drmvyz.cinema2.chromaverse-hypnotic-flower', 'HYPNOTIC FLOWER', 'system'),
  ('cinema2', 'drmvyz.cinema2.chromaverse-magic-warp', 'MAGIC WARP', 'system'),
  ('cinema2', 'drmvyz.cinema2.chromaverse-disco-waves', 'DISCO WAVES', 'system')
ON CONFLICT (engine_id, preset_key) DO UPDATE SET name = EXCLUDED.name, scope = EXCLUDED.scope;

INSERT INTO public.preset_catalog_metadata (engine_id,preset_key,category,publication_status)
SELECT engine_id,preset_key,'CHROMAVERSE','designing' FROM public.presets
WHERE engine_id='cinema2' AND preset_key LIKE 'drmvyz.cinema2.chromaverse-%'
ON CONFLICT (engine_id,preset_key) DO NOTHING;

INSERT INTO public.catalog_packs(name,description)
VALUES ('CHROMAVERSE','Ten chromatic, multidimensional Cinema 2.0 performance sculptures.')
ON CONFLICT (lower(btrim(name))) DO NOTHING;
INSERT INTO public.catalog_pack_members(pack_id,engine_id,preset_key,position)
SELECT pack.id,'cinema2','drmvyz.cinema2.chromaverse-' || member.key,member.position
FROM public.catalog_packs pack CROSS JOIN (VALUES
  ('pulse',0),
  ('space-jellyfish',1),
  ('alter-ego',2),
  ('temple-of-light',3),
  ('starfield-warp',4),
  ('torus',5),
  ('time-tunnel',6),
  ('hypnotic-flower',7),
  ('magic-warp',8),
  ('disco-waves',9)
) AS member(key,position)
WHERE lower(btrim(pack.name))='chromaverse'
ON CONFLICT (pack_id,engine_id,preset_key) DO NOTHING;
COMMIT;
