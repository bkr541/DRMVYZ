-- Catalog pack cover design: optional secondary title and private, admin-managed artwork.
-- Existing packs intentionally start with no image; store publishing is a separate workflow.
ALTER TABLE public.catalog_packs
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS thumbnail_path text;
ALTER TABLE public.catalog_packs
  ADD CONSTRAINT catalog_packs_subtitle_check CHECK (subtitle IS NULL OR length(subtitle) <= 160),
  ADD CONSTRAINT catalog_packs_thumbnail_path_check CHECK (thumbnail_path IS NULL OR (
    split_part(thumbnail_path, '/', 1) = id::text AND
    thumbnail_path ~ '^[0-9a-f-]+/[0-9a-f-]+\.(jpg|png|webp)$'
  ));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('catalog-pack-artwork', 'catalog-pack-artwork', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "catalog pack artwork: admin read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'catalog-pack-artwork' AND public.is_admin());
CREATE POLICY "catalog pack artwork: admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'catalog-pack-artwork' AND public.is_admin()
    AND EXISTS (SELECT 1 FROM public.catalog_packs p WHERE p.id::text = (storage.foldername(storage.objects.name))[1]));
CREATE POLICY "catalog pack artwork: admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'catalog-pack-artwork' AND public.is_admin());
