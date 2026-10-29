-- Preset store: free-only marketplace core (Phase 01, simplified).
--
-- ADDITIVE ONLY. Nothing here alters or deletes a row of presets, user_presets or preset_organization (0034, 0035, 0039), and no existing
-- table, policy, function or migration file is modified. See docs/preset-store/SCHEMA.md for the relationships, the RLS matrix, the execution
-- instructions and the rollback strategy.
--
-- Deliberately small. This migration covers browsing, publishing, FREE claims and favourites. Orders, prices, payment events, refunds and
-- disputes are NOT here: they depend on decisions that are not made yet (payment provider, refund policy, tax) and arrive in a later migration.
--
--   preset_releases (+ preset_release_publications)  immutable content (manifest hash, signing key, private storage paths) vs. mutable status
--   preset_packs / preset_pack_items                  a pack is a named list of (preset, release); the list may change over time
--   store_products                                    what is listed: one standalone preset or one pack, free for now
--   preset_entitlement_grants                         who may use which release, and why (free claim), revocable
--   user_preset_preferences                           own favourite state, keyed by canonical preset; never an ownership signal
--
-- Identity: presets.id (0034) stays the canonical preset identity; (engine_id, preset_key) stays its natural key. A product points at a presets
-- row, never at a copy of one. Store presets must be scope 'user' (private): a 'system' preset is shown to everyone under SYSTEM.
--
-- Holdings: this migration never writes to user_presets. The app treats a preset as held when the user has a user_presets row OR an active
-- grant here. Legacy holdings (0036, 0040, 0041, hand-recorded) are therefore untouched and need no marker.
--
-- Packs: claiming a pack writes one grant per member at that moment, pinned to the member's release. A preset added to the pack later is not
-- granted retroactively; the buyer keeps exactly what they claimed.
--
-- Authority: the client can only READ published metadata and its own grants / preferences. Every business write (catalog, products, grants)
-- goes through the service role, and the claim / revoke functions are EXECUTE-able by the service role only. Supabase's default privileges hand
-- new tables to anon and authenticated, so every new table is REVOKEd first and the few client privileges are granted back explicitly.

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.preset_store_text_array_ok(p_values text[], p_max_items integer, p_max_length integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT p_values IS NOT NULL
    AND cardinality(p_values) <= p_max_items
    AND NOT EXISTS (
      SELECT 1 FROM unnest(p_values) AS v WHERE v IS NULL OR length(btrim(v)) NOT BETWEEN 1 AND p_max_length
    );
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Releases: immutable content, with a separate mutable publication status
-- ---------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.preset_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id uuid NOT NULL REFERENCES public.presets(id) ON DELETE RESTRICT,
  version text NOT NULL,
  -- Package format and the key that signed the manifest. Rows are immutable, so these cannot be added to old rows later.
  format_version integer NOT NULL DEFAULT 1,
  signing_key_id text NOT NULL,
  manifest_sha256 text NOT NULL,
  manifest_bytes bigint NOT NULL,
  -- Private object locations. Service only: never part of a catalog payload and not granted to any client role.
  manifest_path text NOT NULL,
  assets_prefix text,
  asset_digest_sha256 text,
  asset_count integer NOT NULL DEFAULT 0,
  asset_bytes bigint NOT NULL DEFAULT 0,
  min_app_version text,
  compatibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  license_ref text,
  attribution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preset_releases_version_check CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]{1,32})?$' AND length(version) <= 48),
  CONSTRAINT preset_releases_format_version_check CHECK (format_version BETWEEN 1 AND 1000),
  CONSTRAINT preset_releases_signing_key_check CHECK (length(btrim(signing_key_id)) BETWEEN 1 AND 100),
  CONSTRAINT preset_releases_manifest_sha256_check CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT preset_releases_asset_digest_check CHECK (asset_digest_sha256 IS NULL OR asset_digest_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT preset_releases_manifest_bytes_check CHECK (manifest_bytes > 0),
  CONSTRAINT preset_releases_asset_totals_check CHECK (asset_count >= 0 AND asset_bytes >= 0 AND (asset_count > 0 OR asset_bytes = 0)),
  CONSTRAINT preset_releases_assets_digest_check CHECK ((asset_count = 0) = (asset_digest_sha256 IS NULL) AND (asset_count = 0 OR assets_prefix IS NOT NULL)),
  CONSTRAINT preset_releases_manifest_path_check CHECK (
    length(manifest_path) BETWEEN 1 AND 500 AND manifest_path ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$' AND manifest_path !~ '\.\.'
  ),
  CONSTRAINT preset_releases_assets_prefix_check CHECK (
    assets_prefix IS NULL OR (length(assets_prefix) BETWEEN 1 AND 500 AND assets_prefix ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$' AND assets_prefix !~ '\.\.')
  ),
  CONSTRAINT preset_releases_min_app_version_check CHECK (min_app_version IS NULL OR min_app_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  CONSTRAINT preset_releases_compatibility_check CHECK (jsonb_typeof(compatibility) = 'object' AND octet_length(compatibility::text) <= 8192),
  CONSTRAINT preset_releases_license_ref_check CHECK (license_ref IS NULL OR length(btrim(license_ref)) BETWEEN 1 AND 200),
  CONSTRAINT preset_releases_attribution_check CHECK (attribution IS NULL OR length(btrim(attribution)) BETWEEN 1 AND 1000),
  CONSTRAINT preset_releases_preset_version_unique UNIQUE (preset_id, version),
  -- Target of composite foreign keys, so a pinned release can only ever be a release OF the preset it is pinned for.
  CONSTRAINT preset_releases_id_preset_unique UNIQUE (id, preset_id)
);

CREATE INDEX IF NOT EXISTS idx_preset_releases_preset ON public.preset_releases(preset_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.preset_release_publications (
  release_id uuid PRIMARY KEY REFERENCES public.preset_releases(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preset_release_publications_status_check CHECK (status IN ('draft', 'published', 'withdrawn')),
  CONSTRAINT preset_release_publications_shape_check CHECK (
    (status = 'draft' AND published_at IS NULL AND withdrawn_at IS NULL)
    OR (status = 'published' AND published_at IS NOT NULL AND withdrawn_at IS NULL)
    OR (status = 'withdrawn' AND published_at IS NOT NULL AND withdrawn_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_preset_release_publications_status ON public.preset_release_publications(status);

DROP TRIGGER IF EXISTS trg_preset_release_publications_updated_at ON public.preset_release_publications;
CREATE TRIGGER trg_preset_release_publications_updated_at
  BEFORE UPDATE ON public.preset_release_publications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Every release starts as a draft; the publication row is the only mutable part.
CREATE OR REPLACE FUNCTION public.preset_releases_create_publication()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.preset_release_publications (release_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preset_releases_create_publication ON public.preset_releases;
CREATE TRIGGER trg_preset_releases_create_publication
  AFTER INSERT ON public.preset_releases
  FOR EACH ROW EXECUTE FUNCTION public.preset_releases_create_publication();

-- A store preset is private (scope 'user'): a 'system' preset is listed for everyone under SYSTEM and must never be sold or claimed.
CREATE OR REPLACE FUNCTION public.preset_releases_scope_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.presets AS p WHERE p.id = NEW.preset_id AND p.scope = 'user') THEN
    RAISE EXCEPTION 'a store release needs a preset with scope user' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preset_releases_scope_guard ON public.preset_releases;
CREATE TRIGGER trg_preset_releases_scope_guard
  BEFORE INSERT ON public.preset_releases
  FOR EACH ROW EXECUTE FUNCTION public.preset_releases_scope_guard();

-- A release's content never changes, and a release that was ever published is never deleted (it may be listed, granted or pinned).
CREATE OR REPLACE FUNCTION public.preset_releases_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'preset_releases rows are immutable; publish a new version instead' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.preset_release_publications AS pub WHERE pub.release_id = OLD.id AND pub.status <> 'draft'
  ) THEN
    RAISE EXCEPTION 'a published release cannot be deleted; withdraw it instead' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_preset_releases_guard ON public.preset_releases;
CREATE TRIGGER trg_preset_releases_guard
  BEFORE UPDATE OR DELETE ON public.preset_releases
  FOR EACH ROW EXECUTE FUNCTION public.preset_releases_guard();

-- draft -> published -> withdrawn, and withdrawn -> published again; never back to draft.
CREATE OR REPLACE FUNCTION public.preset_release_publications_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.release_id IS DISTINCT FROM OLD.release_id THEN
    RAISE EXCEPTION 'a publication row cannot move to another release' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.status <> 'draft' AND NEW.status = 'draft' THEN
    RAISE EXCEPTION 'a published release cannot return to draft' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.status = 'published' AND OLD.status = 'draft' THEN
    NEW.published_at := COALESCE(NEW.published_at, now());
  END IF;
  IF NEW.status = 'withdrawn' AND OLD.status = 'published' THEN
    NEW.withdrawn_at := COALESCE(NEW.withdrawn_at, now());
  END IF;
  IF NEW.status = 'published' AND OLD.status = 'withdrawn' THEN
    NEW.withdrawn_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preset_release_publications_guard ON public.preset_release_publications;
CREATE TRIGGER trg_preset_release_publications_guard
  BEFORE UPDATE ON public.preset_release_publications
  FOR EACH ROW EXECUTE FUNCTION public.preset_release_publications_guard();

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Packs: a named, ordered list of (preset, release)
-- ---------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.preset_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preset_packs_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
  CONSTRAINT preset_packs_name_check CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  CONSTRAINT preset_packs_slug_unique UNIQUE (slug)
);

DROP TRIGGER IF EXISTS trg_preset_packs_updated_at ON public.preset_packs;
CREATE TRIGGER trg_preset_packs_updated_at
  BEFORE UPDATE ON public.preset_packs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.preset_pack_items (
  pack_id uuid NOT NULL REFERENCES public.preset_packs(id) ON DELETE CASCADE,
  preset_id uuid NOT NULL REFERENCES public.presets(id) ON DELETE RESTRICT,
  release_id uuid NOT NULL,
  position integer NOT NULL,
  PRIMARY KEY (pack_id, preset_id),
  CONSTRAINT preset_pack_items_position_check CHECK (position >= 1),
  CONSTRAINT preset_pack_items_position_unique UNIQUE (pack_id, position),
  -- The listed release must be a release OF this preset.
  CONSTRAINT preset_pack_items_release_fk FOREIGN KEY (release_id, preset_id) REFERENCES public.preset_releases(id, preset_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_preset_pack_items_release ON public.preset_pack_items(release_id);
CREATE INDEX IF NOT EXISTS idx_preset_pack_items_preset ON public.preset_pack_items(preset_id);

-- A pack holds at most 200 presets (a sanity bound, not policy).
CREATE OR REPLACE FUNCTION public.preset_pack_items_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM public.preset_pack_items AS item WHERE item.pack_id = NEW.pack_id) >= 200 THEN
    RAISE EXCEPTION 'a pack holds at most 200 presets' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preset_pack_items_guard ON public.preset_pack_items;
CREATE TRIGGER trg_preset_pack_items_guard
  BEFORE INSERT ON public.preset_pack_items
  FOR EACH ROW EXECUTE FUNCTION public.preset_pack_items_guard();

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.store_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  preset_id uuid REFERENCES public.presets(id) ON DELETE RESTRICT,
  pack_id uuid REFERENCES public.preset_packs(id) ON DELETE RESTRICT,
  -- What a NEW claim of a standalone product delivers. Packs deliver their current items. Earlier grants keep the release they were given.
  current_release_id uuid,
  slug text NOT NULL,
  title text NOT NULL,
  subtitle text,
  description text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  -- Promotional media only: paths inside a PUBLIC promo location, never release content (that is preset_releases.manifest_path / assets_prefix).
  promo_cover_path text,
  promo_preview_path text,
  sort_order integer NOT NULL DEFAULT 0,
  -- Free only for now. Paid products arrive with the commerce migration, which relaxes this check and adds prices.
  price_policy text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_products_kind_check CHECK (kind IN ('preset', 'pack')),
  CONSTRAINT store_products_target_check CHECK (
    (kind = 'preset' AND preset_id IS NOT NULL AND pack_id IS NULL)
    OR (kind = 'pack' AND pack_id IS NOT NULL AND preset_id IS NULL AND current_release_id IS NULL)
  ),
  CONSTRAINT store_products_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
  CONSTRAINT store_products_title_check CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  CONSTRAINT store_products_subtitle_check CHECK (subtitle IS NULL OR length(btrim(subtitle)) BETWEEN 1 AND 200),
  CONSTRAINT store_products_description_check CHECK (description IS NULL OR length(description) <= 4000),
  CONSTRAINT store_products_tags_check CHECK (public.preset_store_text_array_ok(tags, 16, 40)),
  CONSTRAINT store_products_promo_cover_check CHECK (
    promo_cover_path IS NULL OR (length(promo_cover_path) <= 500 AND promo_cover_path ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$' AND promo_cover_path !~ '\.\.')
  ),
  CONSTRAINT store_products_promo_preview_check CHECK (
    promo_preview_path IS NULL OR (length(promo_preview_path) <= 500 AND promo_preview_path ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$' AND promo_preview_path !~ '\.\.')
  ),
  CONSTRAINT store_products_sort_order_check CHECK (sort_order BETWEEN -100000 AND 100000),
  CONSTRAINT store_products_price_policy_check CHECK (price_policy IN ('free')),
  CONSTRAINT store_products_status_check CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT store_products_published_at_check CHECK (status <> 'published' OR published_at IS NOT NULL),
  CONSTRAINT store_products_slug_unique UNIQUE (slug),
  CONSTRAINT store_products_release_fk FOREIGN KEY (current_release_id, preset_id) REFERENCES public.preset_releases(id, preset_id) ON DELETE RESTRICT
);

-- One standalone product per canonical preset, one product per pack: no duplicate listing identity.
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_products_preset ON public.store_products(preset_id) WHERE kind = 'preset';
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_products_pack ON public.store_products(pack_id) WHERE kind = 'pack';
CREATE INDEX IF NOT EXISTS idx_store_products_listing ON public.store_products(status, kind, sort_order, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_products_current_release ON public.store_products(current_release_id) WHERE current_release_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_products_tags ON public.store_products USING gin(tags);

DROP TRIGGER IF EXISTS trg_store_products_updated_at ON public.store_products;
CREATE TRIGGER trg_store_products_updated_at
  BEFORE UPDATE ON public.store_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- A product keeps its kind and target; publishing needs deliverable, published content.
CREATE OR REPLACE FUNCTION public.store_products_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.kind IS DISTINCT FROM OLD.kind OR NEW.preset_id IS DISTINCT FROM OLD.preset_id OR NEW.pack_id IS DISTINCT FROM OLD.pack_id THEN
      RAISE EXCEPTION 'a product keeps its kind and target' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  IF NEW.status = 'published' THEN
    IF NEW.kind = 'preset' AND NOT EXISTS (
      SELECT 1 FROM public.preset_release_publications AS pub WHERE pub.release_id = NEW.current_release_id AND pub.status = 'published'
    ) THEN
      RAISE EXCEPTION 'a published standalone product needs a published current release' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW.kind = 'pack' THEN
      IF NOT EXISTS (SELECT 1 FROM public.preset_pack_items AS item WHERE item.pack_id = NEW.pack_id) THEN
        RAISE EXCEPTION 'a published pack product needs at least one preset' USING ERRCODE = 'integrity_constraint_violation';
      END IF;
      IF EXISTS (
        SELECT 1
        FROM public.preset_pack_items AS item
        LEFT JOIN public.preset_release_publications AS pub ON pub.release_id = item.release_id
        WHERE item.pack_id = NEW.pack_id AND COALESCE(pub.status, 'draft') <> 'published'
      ) THEN
        RAISE EXCEPTION 'every preset release in a pack must be published before its product is' USING ERRCODE = 'integrity_constraint_violation';
      END IF;
    END IF;
    NEW.published_at := COALESCE(NEW.published_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_products_guard ON public.store_products;
CREATE TRIGGER trg_store_products_guard
  BEFORE INSERT OR UPDATE ON public.store_products
  FOR EACH ROW EXECUTE FUNCTION public.store_products_guard();

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Grants: who may use which release
-- ---------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.preset_entitlement_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  preset_id uuid NOT NULL REFERENCES public.presets(id) ON DELETE RESTRICT,
  release_id uuid NOT NULL,
  source_kind text NOT NULL DEFAULT 'free_claim',
  -- The product that was claimed. A pack claim writes one grant per member, all pointing at the pack product.
  product_id uuid NOT NULL REFERENCES public.store_products(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_reason text,
  CONSTRAINT preset_entitlement_grants_source_check CHECK (source_kind IN ('free_claim')),
  CONSTRAINT preset_entitlement_grants_revocation_check CHECK (
    (revoked_at IS NULL AND revoked_reason IS NULL)
    OR (revoked_at IS NOT NULL AND revoked_reason IS NOT NULL AND length(btrim(revoked_reason)) BETWEEN 1 AND 200)
  ),
  CONSTRAINT preset_entitlement_grants_release_fk FOREIGN KEY (release_id, preset_id) REFERENCES public.preset_releases(id, preset_id) ON DELETE RESTRICT
);

-- One grant per claim and member: claiming twice, or replaying a request, can never create a second row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_preset_entitlement_grants_claim
  ON public.preset_entitlement_grants(user_id, product_id, preset_id);
-- "Does this user effectively hold this preset?" is existence of an active row here.
CREATE INDEX IF NOT EXISTS idx_preset_entitlement_grants_active
  ON public.preset_entitlement_grants(user_id, preset_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_preset_entitlement_grants_user ON public.preset_entitlement_grants(user_id, granted_at DESC);
CREATE INDEX IF NOT EXISTS idx_preset_entitlement_grants_product ON public.preset_entitlement_grants(product_id);
CREATE INDEX IF NOT EXISTS idx_preset_entitlement_grants_release ON public.preset_entitlement_grants(release_id);

-- A grant can only come from a free product, and afterwards only its revocation columns may change. A revoked grant is never revived.
CREATE OR REPLACE FUNCTION public.preset_entitlement_grants_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'revoked_at' - 'revoked_reason') IS DISTINCT FROM (to_jsonb(OLD) - 'revoked_at' - 'revoked_reason') THEN
      RAISE EXCEPTION 'a grant is immutable except for its revocation' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NULL THEN
      RAISE EXCEPTION 'a revoked grant cannot be restored; issue a new claim instead' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.store_products AS product WHERE product.id = NEW.product_id AND product.price_policy = 'free') THEN
    RAISE EXCEPTION 'a free claim needs a free product' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preset_entitlement_grants_guard ON public.preset_entitlement_grants;
CREATE TRIGGER trg_preset_entitlement_grants_guard
  BEFORE INSERT OR UPDATE ON public.preset_entitlement_grants
  FOR EACH ROW EXECUTE FUNCTION public.preset_entitlement_grants_guard();

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Favourites
-- ---------------------------------------------------------------------------------------------------------------------------------

-- Own favourite state, keyed by the canonical preset. Independent of ownership: a system preset needs no holding to be favourited, and
-- nothing reads this table as proof of ownership. Read precedence: this row if present, else user_presets.is_favorite, else false.
CREATE TABLE IF NOT EXISTS public.user_preset_preferences (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  preset_id uuid NOT NULL REFERENCES public.presets(id) ON DELETE CASCADE,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, preset_id)
);

CREATE INDEX IF NOT EXISTS idx_user_preset_preferences_preset ON public.user_preset_preferences(preset_id);

DROP TRIGGER IF EXISTS trg_user_preset_preferences_updated_at ON public.user_preset_preferences;
CREATE TRIGGER trg_user_preset_preferences_updated_at
  BEFORE UPDATE ON public.user_preset_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Server primitives. SERVICE ROLE ONLY (see the privilege block below), except set_preset_favorite.
-- ---------------------------------------------------------------------------------------------------------------------------------

-- Claims a free product for a user: one grant per deliverable preset, pinned to the release delivered now. Idempotent: a repeat inserts nothing,
-- and a grant that was revoked is NOT revived by a repeat. Returns the number of grants inserted.
CREATE OR REPLACE FUNCTION public.claim_free_store_product(p_user_id uuid, p_product_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_product public.store_products%ROWTYPE;
  v_member record;
  v_inserted integer;
  v_granted integer := 0;
BEGIN
  SELECT * INTO v_product FROM public.store_products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product % not found', p_product_id USING ERRCODE = 'no_data_found';
  END IF;
  IF v_product.status <> 'published' OR v_product.price_policy <> 'free' THEN
    RAISE EXCEPTION 'product % is not a published free product', p_product_id USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user % not found', p_user_id USING ERRCODE = 'no_data_found';
  END IF;

  -- Serialise concurrent claims of the same product by the same user.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_product_id::text, 43));

  FOR v_member IN
    SELECT v_product.preset_id AS preset_id, v_product.current_release_id AS release_id
    WHERE v_product.kind = 'preset'
    UNION ALL
    SELECT item.preset_id, item.release_id FROM public.preset_pack_items AS item WHERE v_product.kind = 'pack' AND item.pack_id = v_product.pack_id
    ORDER BY 1
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.preset_release_publications AS pub WHERE pub.release_id = v_member.release_id AND pub.status = 'published'
    ) THEN
      RAISE EXCEPTION 'release % is not published', v_member.release_id USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    INSERT INTO public.preset_entitlement_grants (user_id, preset_id, release_id, source_kind, product_id)
    VALUES (p_user_id, v_member.preset_id, v_member.release_id, 'free_claim', p_product_id)
    ON CONFLICT (user_id, product_id, preset_id) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_granted := v_granted + v_inserted;
  END LOOP;
  RETURN v_granted;
END;
$$;

-- Revokes every still-active grant a user got from one product (support, takedown). Idempotent. Returns the number revoked.
CREATE OR REPLACE FUNCTION public.revoke_free_store_claim(p_user_id uuid, p_product_id uuid, p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_revoked integer;
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'a revocation needs a reason of 1 to 200 characters' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_product_id::text, 43));
  UPDATE public.preset_entitlement_grants
  SET revoked_at = now(), revoked_reason = btrim(p_reason)
  WHERE user_id = p_user_id AND product_id = p_product_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_revoked = ROW_COUNT;
  RETURN v_revoked;
END;
$$;

-- The only client write that sets a favourite: uses auth.uid(), never takes a user id, never grants anything, never touches user_presets.
CREATE OR REPLACE FUNCTION public.set_preset_favorite(p_preset_id uuid, p_is_favorite boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'sign in to change a favourite' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_preset_id IS NULL OR p_is_favorite IS NULL THEN
    RAISE EXCEPTION 'preset and favourite flag are required' USING ERRCODE = 'null_value_not_allowed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.presets WHERE id = p_preset_id) THEN
    RAISE EXCEPTION 'unknown preset' USING ERRCODE = 'foreign_key_violation';
  END IF;
  INSERT INTO public.user_preset_preferences (user_id, preset_id, is_favorite) VALUES (v_user_id, p_preset_id, p_is_favorite)
  ON CONFLICT (user_id, preset_id) DO UPDATE SET is_favorite = EXCLUDED.is_favorite;
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Privileges. Supabase's default privileges grant new tables to anon / authenticated / service_role, so start from nothing.
-- ---------------------------------------------------------------------------------------------------------------------------------

REVOKE ALL ON TABLE
  public.preset_releases, public.preset_release_publications, public.preset_packs, public.preset_pack_items,
  public.store_products, public.preset_entitlement_grants, public.user_preset_preferences
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE
  public.preset_releases, public.preset_release_publications, public.preset_packs, public.preset_pack_items,
  public.store_products, public.preset_entitlement_grants, public.user_preset_preferences
  TO service_role;

-- Published metadata. These tables hold nothing private, so they are granted whole and RLS alone decides the rows. preset_releases is the
-- exception: its hash, signing key, sizes and private storage paths are never granted to a client role, so it gets a column list (which also
-- means a client must name columns; select * on it is denied by design).
GRANT SELECT ON public.preset_release_publications, public.preset_packs, public.preset_pack_items, public.store_products TO anon, authenticated;
GRANT SELECT (id, preset_id, version, min_app_version, created_at) ON public.preset_releases TO anon, authenticated;

-- A user's own grants. Read-only from the client, and without anything an operator may have written about a revocation.
GRANT SELECT (id, user_id, preset_id, release_id, source_kind, product_id, granted_at, revoked_at) ON public.preset_entitlement_grants TO authenticated;

-- Own preferences: read, write the favourite flag and delete, bounded by RLS to the caller's own rows.
GRANT SELECT ON public.user_preset_preferences TO authenticated;
GRANT INSERT (user_id, preset_id, is_favorite) ON public.user_preset_preferences TO authenticated;
GRANT UPDATE (is_favorite) ON public.user_preset_preferences TO authenticated;
GRANT DELETE ON public.user_preset_preferences TO authenticated;

REVOKE ALL ON FUNCTION public.claim_free_store_product(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_free_store_claim(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_preset_favorite(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_free_store_product(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_free_store_claim(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_preset_favorite(uuid, boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Row level security. RLS filters rows; the column grants above decide which columns a client can see at all.
-- ---------------------------------------------------------------------------------------------------------------------------------

ALTER TABLE public.preset_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_release_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_pack_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_entitlement_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preset_preferences ENABLE ROW LEVEL SECURITY;

-- A product is visible once published, and stays visible (archived) to anyone holding a grant from it, so "Owned" can still show it.
DROP POLICY IF EXISTS "store_products: published select" ON public.store_products;
CREATE POLICY "store_products: published select"
  ON public.store_products FOR SELECT TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "store_products: claimed select" ON public.store_products;
CREATE POLICY "store_products: claimed select"
  ON public.store_products FOR SELECT TO authenticated
  USING (
    status = 'archived'
    AND EXISTS (SELECT 1 FROM public.preset_entitlement_grants AS g WHERE g.product_id = store_products.id AND g.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "preset_release_publications: published select" ON public.preset_release_publications;
CREATE POLICY "preset_release_publications: published select"
  ON public.preset_release_publications FOR SELECT TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "preset_releases: published select" ON public.preset_releases;
CREATE POLICY "preset_releases: published select"
  ON public.preset_releases FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.preset_release_publications AS pub WHERE pub.release_id = preset_releases.id AND pub.status = 'published'));

-- Packs and their items are visible while a published product lists the pack.
DROP POLICY IF EXISTS "preset_packs: published select" ON public.preset_packs;
CREATE POLICY "preset_packs: published select"
  ON public.preset_packs FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.store_products AS product WHERE product.pack_id = preset_packs.id AND product.status = 'published'));

DROP POLICY IF EXISTS "preset_pack_items: published select" ON public.preset_pack_items;
CREATE POLICY "preset_pack_items: published select"
  ON public.preset_pack_items FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.store_products AS product WHERE product.pack_id = preset_pack_items.pack_id AND product.status = 'published'));

DROP POLICY IF EXISTS "preset_entitlement_grants: own select" ON public.preset_entitlement_grants;
CREATE POLICY "preset_entitlement_grants: own select"
  ON public.preset_entitlement_grants FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preset_preferences: own select" ON public.user_preset_preferences;
CREATE POLICY "user_preset_preferences: own select"
  ON public.user_preset_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preset_preferences: own insert" ON public.user_preset_preferences;
CREATE POLICY "user_preset_preferences: own insert"
  ON public.user_preset_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preset_preferences: own update" ON public.user_preset_preferences;
CREATE POLICY "user_preset_preferences: own update"
  ON public.user_preset_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preset_preferences: own delete" ON public.user_preset_preferences;
CREATE POLICY "user_preset_preferences: own delete"
  ON public.user_preset_preferences FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
