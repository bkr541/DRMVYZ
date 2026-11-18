-- Admin console (Phase 1): admin authority, read-only user directory, preset catalog metadata and packs, and in-app announcements.
--
-- ADDITIVE ONLY. No existing table, policy or function is changed.
--
-- Authority: an admin is an account whose server-managed `app_metadata` says so (role = 'admin' or is_admin = true), exactly what the app's own
-- adminAccess check reads. `app_metadata` can only be written with the service role, so a user cannot grant it to themselves. Every admin read
-- or write below is checked here, in the database, with public.is_admin(); the interface hiding the Admin button is a convenience, not the gate.
-- The check reads the JWT, so a newly granted admin must refresh their session (sign out and in, or wait for the token to refresh) once.
--
--   admin_list_users()              the read-only user directory (auth.users joined to profiles), admin only
--   announcements                   what the admin writes; users read the active, published ones
--   announcement_acknowledgments    one row per (announcement, user): written by the user on "Got It", never shown to them again
--   admin_announcement_stats()      eligible / acknowledged / pending per announcement, admin only
--   preset_catalog_metadata         per-preset overrides of the metadata the app ships (a NULL column means "use the shipped value")
--   catalog_packs / catalog_pack_members
--                                   named, ordered groups of the existing built-in presets. These are NOT the store's preset_packs (0043), which
--                                   hold releases (distributable preset files); a catalog pack only organises presets the app already ships.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
      OR coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', '') = 'true';
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- User directory (read-only)
-- ---------------------------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  display_name text,
  artist_name text,
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT u.id,
           coalesce(p.email, u.email)::text,
           p.display_name,
           p.artist_name,
           p.avatar_url,
           u.created_at,
           coalesce(p.updated_at, u.updated_at),
           u.last_sign_in_at
      FROM auth.users AS u
      LEFT JOIN public.profiles AS p ON p.id = u.id
     ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  -- A public URL (the announcements bucket below, or any https image).
  image_url text,
  link_url text,
  link_label text,
  is_active boolean NOT NULL DEFAULT false,
  publish_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcements_title_check CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  CONSTRAINT announcements_body_check CHECK (length(btrim(body)) BETWEEN 1 AND 4000),
  CONSTRAINT announcements_image_url_check CHECK (image_url IS NULL OR (length(image_url) <= 1000 AND image_url ~* '^https?://')),
  CONSTRAINT announcements_link_url_check CHECK (link_url IS NULL OR (length(link_url) <= 1000 AND link_url ~* '^https?://')),
  CONSTRAINT announcements_link_label_check CHECK (link_label IS NULL OR length(btrim(link_label)) BETWEEN 1 AND 40),
  -- A button needs both its address and its words.
  CONSTRAINT announcements_link_pair_check CHECK ((link_url IS NULL) = (link_label IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements(is_active, publish_at);

DROP TRIGGER IF EXISTS trg_announcements_updated_at ON public.announcements;
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.announcement_acknowledgments (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_acknowledgments_user ON public.announcement_acknowledgments(user_id);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_acknowledgments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.announcements, public.announcement_acknowledgments FROM anon;

-- Users see only what is live; an admin sees everything.
DROP POLICY IF EXISTS "announcements: read live or admin" ON public.announcements;
CREATE POLICY "announcements: read live or admin"
  ON public.announcements FOR SELECT TO authenticated
  USING ((is_active AND publish_at <= now()) OR public.is_admin());

DROP POLICY IF EXISTS "announcements: admin insert" ON public.announcements;
CREATE POLICY "announcements: admin insert"
  ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "announcements: admin update" ON public.announcements;
CREATE POLICY "announcements: admin update"
  ON public.announcements FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "announcements: admin delete" ON public.announcements;
CREATE POLICY "announcements: admin delete"
  ON public.announcements FOR DELETE TO authenticated
  USING (public.is_admin());

-- A user reads and writes only their own acknowledgment, and only for an announcement they could see.
DROP POLICY IF EXISTS "announcement_acknowledgments: own or admin select" ON public.announcement_acknowledgments;
CREATE POLICY "announcement_acknowledgments: own or admin select"
  ON public.announcement_acknowledgments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "announcement_acknowledgments: own insert" ON public.announcement_acknowledgments;
CREATE POLICY "announcement_acknowledgments: own insert"
  ON public.announcement_acknowledgments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.announcements AS a WHERE a.id = announcement_id AND a.is_active AND a.publish_at <= now())
  );

CREATE OR REPLACE FUNCTION public.admin_announcement_stats()
RETURNS TABLE (announcement_id uuid, eligible bigint, acknowledged bigint, pending bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  registered bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;
  -- Eligible = every registered user: each one will be shown an active announcement until they acknowledge it.
  SELECT count(*) INTO registered FROM auth.users;
  RETURN QUERY
    SELECT a.id,
           registered,
           count(k.user_id)::bigint,
           greatest(registered - count(k.user_id), 0)::bigint
      FROM public.announcements AS a
      LEFT JOIN public.announcement_acknowledgments AS k ON k.announcement_id = a.id
     GROUP BY a.id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_announcement_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_announcement_stats() TO authenticated;

-- Announcement images: a public bucket, writable by admins only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('announcements', 'announcements', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "announcements bucket: public read" ON storage.objects;
CREATE POLICY "announcements bucket: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'announcements');

DROP POLICY IF EXISTS "announcements bucket: admin insert" ON storage.objects;
CREATE POLICY "announcements bucket: admin insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'announcements' AND public.is_admin());

DROP POLICY IF EXISTS "announcements bucket: admin update" ON storage.objects;
CREATE POLICY "announcements bucket: admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'announcements' AND public.is_admin());

DROP POLICY IF EXISTS "announcements bucket: admin delete" ON storage.objects;
CREATE POLICY "announcements bucket: admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'announcements' AND public.is_admin());

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Preset catalog metadata and packs (existing built-in presets only)
-- ---------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.preset_catalog_metadata (
  -- The same natural key as public.presets (0034): the engine and the id that engine's preset library already uses.
  engine_id text NOT NULL,
  preset_key text NOT NULL,
  -- NULL = keep what the app ships. The app applies name, description, category, tags and display_order; the rest is store information kept here
  -- until the store reads it.
  name text,
  description text,
  category text,
  tags text[],
  display_order integer,
  publication_status text,
  store_title text,
  store_subtitle text,
  store_cover_ref text,
  store_preview_ref text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (engine_id, preset_key),
  CONSTRAINT preset_catalog_metadata_key_check CHECK (length(btrim(engine_id)) BETWEEN 1 AND 64 AND length(btrim(preset_key)) BETWEEN 1 AND 300),
  CONSTRAINT preset_catalog_metadata_name_check CHECK (name IS NULL OR length(btrim(name)) BETWEEN 1 AND 160),
  CONSTRAINT preset_catalog_metadata_description_check CHECK (description IS NULL OR length(description) <= 2000),
  CONSTRAINT preset_catalog_metadata_category_check CHECK (category IS NULL OR length(btrim(category)) BETWEEN 1 AND 80),
  CONSTRAINT preset_catalog_metadata_tags_check CHECK (tags IS NULL OR public.preset_store_text_array_ok(tags, 32, 40)),
  CONSTRAINT preset_catalog_metadata_order_check CHECK (display_order IS NULL OR display_order BETWEEN -100000 AND 100000),
  CONSTRAINT preset_catalog_metadata_status_check CHECK (publication_status IS NULL OR publication_status IN ('draft', 'published', 'archived')),
  CONSTRAINT preset_catalog_metadata_store_title_check CHECK (store_title IS NULL OR length(btrim(store_title)) BETWEEN 1 AND 160),
  CONSTRAINT preset_catalog_metadata_store_subtitle_check CHECK (store_subtitle IS NULL OR length(btrim(store_subtitle)) BETWEEN 1 AND 200),
  CONSTRAINT preset_catalog_metadata_cover_check CHECK (store_cover_ref IS NULL OR length(store_cover_ref) <= 500),
  CONSTRAINT preset_catalog_metadata_preview_check CHECK (store_preview_ref IS NULL OR length(store_preview_ref) <= 500)
);

DROP TRIGGER IF EXISTS trg_preset_catalog_metadata_updated_at ON public.preset_catalog_metadata;
CREATE TRIGGER trg_preset_catalog_metadata_updated_at
  BEFORE UPDATE ON public.preset_catalog_metadata
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.catalog_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_packs_name_check CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  CONSTRAINT catalog_packs_description_check CHECK (description IS NULL OR length(description) <= 2000),
  CONSTRAINT catalog_packs_order_check CHECK (display_order BETWEEN -100000 AND 100000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_packs_name ON public.catalog_packs (lower(btrim(name)));

DROP TRIGGER IF EXISTS trg_catalog_packs_updated_at ON public.catalog_packs;
CREATE TRIGGER trg_catalog_packs_updated_at
  BEFORE UPDATE ON public.catalog_packs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.catalog_pack_members (
  pack_id uuid NOT NULL REFERENCES public.catalog_packs(id) ON DELETE CASCADE,
  engine_id text NOT NULL,
  preset_key text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pack_id, engine_id, preset_key),
  CONSTRAINT catalog_pack_members_key_check CHECK (length(btrim(engine_id)) BETWEEN 1 AND 64 AND length(btrim(preset_key)) BETWEEN 1 AND 300),
  CONSTRAINT catalog_pack_members_position_check CHECK (position BETWEEN -100000 AND 100000)
);

CREATE INDEX IF NOT EXISTS idx_catalog_pack_members_preset ON public.catalog_pack_members(engine_id, preset_key);

ALTER TABLE public.preset_catalog_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_pack_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.preset_catalog_metadata, public.catalog_packs, public.catalog_pack_members FROM anon;

-- Catalog metadata is not secret (the presets ship in the app), so every signed-in user reads it, as with public.presets (0035).
-- Only admins write.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['preset_catalog_metadata', 'catalog_packs', 'catalog_pack_members'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ': authenticated select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || ': authenticated select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ': admin insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin())', t || ': admin insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ': admin update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t || ': admin update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ': admin delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_admin())', t || ': admin delete', t);
  END LOOP;
END;
$$;
