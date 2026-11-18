-- Rollback for 0056_admin_console.sql. Drops the admin console's objects; announcements, acknowledgments, catalog metadata and catalog packs are lost.
DROP FUNCTION IF EXISTS public.admin_announcement_stats();
DROP FUNCTION IF EXISTS public.admin_list_users();
DROP TABLE IF EXISTS public.catalog_pack_members;
DROP TABLE IF EXISTS public.catalog_packs;
DROP TABLE IF EXISTS public.preset_catalog_metadata;
DROP TABLE IF EXISTS public.announcement_acknowledgments;
DROP TABLE IF EXISTS public.announcements;
DROP POLICY IF EXISTS "announcements bucket: public read" ON storage.objects;
DROP POLICY IF EXISTS "announcements bucket: admin insert" ON storage.objects;
DROP POLICY IF EXISTS "announcements bucket: admin update" ON storage.objects;
DROP POLICY IF EXISTS "announcements bucket: admin delete" ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'announcements';
DROP FUNCTION IF EXISTS public.is_admin();
