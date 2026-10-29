-- Preset store: marketplace schema and access policies (Phase 01).
--
-- ADDITIVE ONLY. Nothing here alters or deletes a row of presets, user_presets or preset_organization (0034, 0035, 0039), and no existing
-- table, policy, function or migration file is modified. See docs/preset-store/SCHEMA.md for the relationship diagram, the RLS matrix, the
-- execution instructions and the rollback strategy.
--
-- Identity: presets.id (0034) stays the canonical preset identity; (engine_id, preset_key) stays its natural key. A product points at a
-- presets row, never at a copy of one, so there is exactly one standalone product per preset (uq_store_products_preset).
--
-- Content vs. sale vs. ownership:
--   preset_releases (+ preset_release_publications)  immutable content (manifest hash, asset digest, private storage paths) vs. mutable status
--   preset_packs / preset_pack_editions / items      a pack is a stable identity; an EDITION is an immutable, ordered snapshot of releases
--   store_products / store_product_prices            what is for sale: one standalone preset or one pack, with explicit integer minor-unit prices
--   store_product_provider_refs                      private payment-provider mapping (service only)
--   store_orders / store_order_items                 a purchase or a zero-price claim; each line PINS the price, release or pack edition
--   store_payment_events                             idempotent payment-event inbox (service only)
--   preset_entitlement_grants                        who may use which release, and WHY (purchase | free claim | manual), revocable per source
--   marketplace_holding_projections                  marks user_presets rows that the marketplace created (legacy rows have no marker)
--   user_preset_preferences                          own favourite state, keyed by canonical preset; never an ownership signal
--
-- Pack rule: buying a pack pins its edition and that edition's member releases on the order line. Adding presets, or releasing a new version,
-- creates a NEW edition / release. Earlier buyers keep exactly what they bought; nothing is added, upgraded or charged retroactively
-- (store_products.update_policy is 'pinned' and a different policy needs its own migration and approval).
--
-- Authority: the client can only READ published metadata and its own orders / grants / preferences. Every business write (catalog, prices,
-- orders, events, grants, holdings) goes through the service role, and the grant / revoke / holding functions below are EXECUTE-able by the
-- service role only. Supabase's default privileges hand new tables to anon and authenticated, so every new table is REVOKEd first and the few
-- client privileges are granted back explicitly.

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

-- A release's content never changes, and a release that was ever published is never deleted (it may be sold, granted or pinned).
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
-- Packs, immutable editions, ordered membership
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

CREATE TABLE IF NOT EXISTS public.preset_pack_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.preset_packs(id) ON DELETE RESTRICT,
  edition_number integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preset_pack_editions_number_check CHECK (edition_number >= 1),
  CONSTRAINT preset_pack_editions_status_check CHECK (status IN ('draft', 'published', 'retired')),
  CONSTRAINT preset_pack_editions_shape_check CHECK (
    (status = 'draft' AND published_at IS NULL AND retired_at IS NULL)
    OR (status = 'published' AND published_at IS NOT NULL AND retired_at IS NULL)
    OR (status = 'retired' AND published_at IS NOT NULL AND retired_at IS NOT NULL)
  ),
  CONSTRAINT preset_pack_editions_number_unique UNIQUE (pack_id, edition_number),
  CONSTRAINT preset_pack_editions_id_pack_unique UNIQUE (id, pack_id)
);

CREATE INDEX IF NOT EXISTS idx_preset_pack_editions_pack_status ON public.preset_pack_editions(pack_id, status);

DROP TRIGGER IF EXISTS trg_preset_pack_editions_updated_at ON public.preset_pack_editions;
CREATE TRIGGER trg_preset_pack_editions_updated_at
  BEFORE UPDATE ON public.preset_pack_editions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.preset_pack_items (
  edition_id uuid NOT NULL REFERENCES public.preset_pack_editions(id) ON DELETE CASCADE,
  preset_id uuid NOT NULL REFERENCES public.presets(id) ON DELETE RESTRICT,
  release_id uuid NOT NULL,
  position integer NOT NULL,
  PRIMARY KEY (edition_id, preset_id),
  CONSTRAINT preset_pack_items_position_check CHECK (position >= 1),
  CONSTRAINT preset_pack_items_position_unique UNIQUE (edition_id, position),
  -- The pinned release must be a release OF this preset.
  CONSTRAINT preset_pack_items_release_fk FOREIGN KEY (release_id, preset_id) REFERENCES public.preset_releases(id, preset_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_preset_pack_items_release ON public.preset_pack_items(release_id);
CREATE INDEX IF NOT EXISTS idx_preset_pack_items_preset ON public.preset_pack_items(preset_id);

-- Editions: publishing validates every member; published membership is frozen (see preset_pack_items_guard below).
CREATE OR REPLACE FUNCTION public.preset_pack_editions_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'a published pack edition cannot be deleted; retire it instead' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.pack_id IS DISTINCT FROM OLD.pack_id OR NEW.edition_number IS DISTINCT FROM OLD.edition_number THEN
    RAISE EXCEPTION 'an edition keeps its pack and number' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.status <> 'draft' AND NEW.status = 'draft' THEN
    RAISE EXCEPTION 'a published edition cannot return to draft' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.status = 'retired' AND NEW.status <> 'retired' THEN
    RAISE EXCEPTION 'a retired edition cannot be republished; create the next edition' USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF OLD.status = 'draft' AND NEW.status = 'published' THEN
    IF NOT EXISTS (SELECT 1 FROM public.preset_pack_items AS item WHERE item.edition_id = NEW.id) THEN
      RAISE EXCEPTION 'an edition needs at least one member before it is published' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.preset_pack_items AS item
      LEFT JOIN public.preset_release_publications AS pub ON pub.release_id = item.release_id
      WHERE item.edition_id = NEW.id AND COALESCE(pub.status, 'draft') <> 'published'
    ) THEN
      RAISE EXCEPTION 'every member release must be published before its edition is' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    NEW.published_at := COALESCE(NEW.published_at, now());
  END IF;
  IF OLD.status = 'published' AND NEW.status = 'retired' THEN
    NEW.retired_at := COALESCE(NEW.retired_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preset_pack_editions_guard ON public.preset_pack_editions;
CREATE TRIGGER trg_preset_pack_editions_guard
  BEFORE UPDATE OR DELETE ON public.preset_pack_editions
  FOR EACH ROW EXECUTE FUNCTION public.preset_pack_editions_guard();

-- Membership of a non-draft edition is frozen; a draft holds at most 200 presets.
CREATE OR REPLACE FUNCTION public.preset_pack_items_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_edition_id uuid := CASE WHEN TG_OP = 'INSERT' THEN NEW.edition_id ELSE OLD.edition_id END;
  v_status text;
BEGIN
  SELECT edition.status INTO v_status FROM public.preset_pack_editions AS edition WHERE edition.id = v_edition_id;
  -- A cascade from a draft edition's own deletion finds the parent already gone; that is fine.
  IF v_status IS NOT NULL AND v_status <> 'draft' THEN
    RAISE EXCEPTION 'membership of a published pack edition is immutable; create a new edition' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.edition_id IS DISTINCT FROM OLD.edition_id THEN
    RAISE EXCEPTION 'a pack item cannot move between editions' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF TG_OP = 'INSERT' AND (SELECT count(*) FROM public.preset_pack_items AS item WHERE item.edition_id = NEW.edition_id) >= 200 THEN
    RAISE EXCEPTION 'a pack edition holds at most 200 presets' USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_preset_pack_items_guard ON public.preset_pack_items;
CREATE TRIGGER trg_preset_pack_items_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.preset_pack_items
  FOR EACH ROW EXECUTE FUNCTION public.preset_pack_items_guard();

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Products and prices
-- ---------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.store_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  preset_id uuid REFERENCES public.presets(id) ON DELETE RESTRICT,
  pack_id uuid REFERENCES public.preset_packs(id) ON DELETE RESTRICT,
  -- What a NEW sale delivers. Standalone: a release of the preset. Pack: an edition of the pack. Past orders pin their own.
  current_release_id uuid,
  current_edition_id uuid,
  slug text NOT NULL,
  title text NOT NULL,
  subtitle text,
  description text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  -- Promotional media only: paths inside a PUBLIC promo location, never release content (that is preset_releases.manifest_path / assets_prefix).
  promo_cover_path text,
  promo_preview_path text,
  sort_order integer NOT NULL DEFAULT 0,
  update_policy text NOT NULL DEFAULT 'pinned',
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_products_kind_check CHECK (kind IN ('preset', 'pack')),
  CONSTRAINT store_products_target_check CHECK (
    (kind = 'preset' AND preset_id IS NOT NULL AND pack_id IS NULL AND current_edition_id IS NULL)
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
  CONSTRAINT store_products_update_policy_check CHECK (update_policy IN ('pinned')),
  CONSTRAINT store_products_status_check CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT store_products_published_at_check CHECK (status <> 'published' OR published_at IS NOT NULL),
  CONSTRAINT store_products_slug_unique UNIQUE (slug),
  CONSTRAINT store_products_release_fk FOREIGN KEY (current_release_id, preset_id) REFERENCES public.preset_releases(id, preset_id) ON DELETE RESTRICT,
  CONSTRAINT store_products_edition_fk FOREIGN KEY (current_edition_id, pack_id) REFERENCES public.preset_pack_editions(id, pack_id) ON DELETE RESTRICT
);

-- One standalone product per canonical preset, one product per pack: no duplicate paid identity.
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_products_preset ON public.store_products(preset_id) WHERE kind = 'preset';
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_products_pack ON public.store_products(pack_id) WHERE kind = 'pack';
CREATE INDEX IF NOT EXISTS idx_store_products_listing ON public.store_products(status, kind, sort_order, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_products_current_release ON public.store_products(current_release_id) WHERE current_release_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_products_current_edition ON public.store_products(current_edition_id) WHERE current_edition_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_products_tags ON public.store_products USING gin(tags);

DROP TRIGGER IF EXISTS trg_store_products_updated_at ON public.store_products;
CREATE TRIGGER trg_store_products_updated_at
  BEFORE UPDATE ON public.store_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.store_product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.store_products(id) ON DELETE RESTRICT,
  currency text NOT NULL,
  amount_minor bigint NOT NULL,
  environment text NOT NULL DEFAULT 'live',
  status text NOT NULL DEFAULT 'active',
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_product_prices_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT store_product_prices_amount_check CHECK (amount_minor BETWEEN 0 AND 99999999),
  CONSTRAINT store_product_prices_environment_check CHECK (environment IN ('test', 'live')),
  CONSTRAINT store_product_prices_status_check CHECK (status IN ('active', 'retired')),
  CONSTRAINT store_product_prices_retired_check CHECK ((status = 'retired') = (retired_at IS NOT NULL)),
  -- Lets an order line pin product, currency and exact amount with one composite foreign key.
  CONSTRAINT store_product_prices_snapshot_unique UNIQUE (id, product_id, currency, amount_minor)
);

-- A product has at most one live price per currency and environment; history stays as retired rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_product_prices_active
  ON public.store_product_prices(product_id, currency, environment) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_store_product_prices_product ON public.store_product_prices(product_id, status);

DROP TRIGGER IF EXISTS trg_store_product_prices_updated_at ON public.store_product_prices;
CREATE TRIGGER trg_store_product_prices_updated_at
  BEFORE UPDATE ON public.store_product_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Private payment-provider mapping. Service only; never in a catalog payload.
CREATE TABLE IF NOT EXISTS public.store_product_provider_refs (
  price_id uuid NOT NULL REFERENCES public.store_product_prices(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_product_id text,
  provider_price_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (price_id, provider),
  CONSTRAINT store_product_provider_refs_provider_check CHECK (provider IN ('stripe')),
  CONSTRAINT store_product_provider_refs_product_check CHECK (provider_product_id IS NULL OR length(btrim(provider_product_id)) BETWEEN 1 AND 255),
  CONSTRAINT store_product_provider_refs_price_check CHECK (length(btrim(provider_price_id)) BETWEEN 1 AND 255)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_store_product_provider_refs_price
  ON public.store_product_provider_refs(provider, provider_price_id);

-- Products. kind / target never change; publishing needs something to sell and a price; a pack publishes only a published edition.
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
    IF NEW.kind = 'pack' AND NOT EXISTS (
      SELECT 1 FROM public.preset_pack_editions AS edition WHERE edition.id = NEW.current_edition_id AND edition.status = 'published'
    ) THEN
      RAISE EXCEPTION 'a published pack product needs a published current edition' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.store_product_prices AS price WHERE price.product_id = NEW.id AND price.status = 'active'
    ) THEN
      RAISE EXCEPTION 'a published product needs an active price (a free claim is an explicit zero price)' USING ERRCODE = 'integrity_constraint_violation';
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

-- Prices are immutable once written: only active -> retired changes. A new amount is a new row.
CREATE OR REPLACE FUNCTION public.store_product_prices_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (to_jsonb(NEW) - 'status' - 'retired_at' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'retired_at' - 'updated_at') THEN
    RAISE EXCEPTION 'a price is immutable; retire it and add a new one' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.status = 'retired' AND NEW.status <> 'retired' THEN
    RAISE EXCEPTION 'a retired price cannot be reactivated; add a new one' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.status = 'active' AND NEW.status = 'retired' THEN
    NEW.retired_at := COALESCE(NEW.retired_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_product_prices_guard ON public.store_product_prices;
CREATE TRIGGER trg_store_product_prices_guard
  BEFORE UPDATE ON public.store_product_prices
  FOR EACH ROW EXECUTE FUNCTION public.store_product_prices_guard();

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Orders (purchases and zero-price claims), pinned order lines, payment-event inbox
-- ---------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.store_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SET NULL, not CASCADE: deleting an account must not silently erase a payment record. Retention is an operator decision (OPEN_DECISIONS).
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  provider text NOT NULL,
  environment text NOT NULL,
  currency text NOT NULL,
  total_minor bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  -- Idempotency key supplied by the checkout service; a retried request returns the same order.
  request_key text NOT NULL,
  provider_checkout_session_id text,
  provider_payment_intent_id text,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_orders_provider_check CHECK (provider IN ('stripe', 'internal')),
  CONSTRAINT store_orders_environment_check CHECK (environment IN ('test', 'live')),
  CONSTRAINT store_orders_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT store_orders_total_check CHECK (total_minor BETWEEN 0 AND 999999999),
  CONSTRAINT store_orders_status_check CHECK (status IN ('pending', 'paid', 'fulfilled', 'failed', 'canceled', 'refunded', 'disputed')),
  CONSTRAINT store_orders_request_key_check CHECK (length(btrim(request_key)) BETWEEN 1 AND 128),
  CONSTRAINT store_orders_checkout_session_check CHECK (provider_checkout_session_id IS NULL OR length(btrim(provider_checkout_session_id)) BETWEEN 1 AND 255),
  CONSTRAINT store_orders_payment_intent_check CHECK (provider_payment_intent_id IS NULL OR length(btrim(provider_payment_intent_id)) BETWEEN 1 AND 255),
  -- An internal order is a zero-price claim and never touches a payment provider; a provider order always charges something.
  CONSTRAINT store_orders_provider_amount_check CHECK (
    (provider = 'internal' AND total_minor = 0 AND provider_checkout_session_id IS NULL AND provider_payment_intent_id IS NULL)
    OR (provider <> 'internal' AND total_minor > 0)
  ),
  CONSTRAINT store_orders_paid_check CHECK (status NOT IN ('paid', 'fulfilled') OR paid_at IS NOT NULL),
  CONSTRAINT store_orders_fulfilled_check CHECK (status <> 'fulfilled' OR fulfilled_at IS NOT NULL),
  CONSTRAINT store_orders_refunded_check CHECK (status <> 'refunded' OR refunded_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_store_orders_request ON public.store_orders(user_id, request_key) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_orders_checkout_session
  ON public.store_orders(provider, environment, provider_checkout_session_id) WHERE provider_checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_orders_payment_intent
  ON public.store_orders(provider, environment, provider_payment_intent_id) WHERE provider_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_orders_user ON public.store_orders(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_orders_open ON public.store_orders(status, created_at) WHERE status IN ('pending', 'paid');

DROP TRIGGER IF EXISTS trg_store_orders_updated_at ON public.store_orders;
CREATE TRIGGER trg_store_orders_updated_at
  BEFORE UPDATE ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.store_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  price_id uuid NOT NULL,
  kind text NOT NULL,
  currency text NOT NULL,
  unit_amount_minor bigint NOT NULL,
  -- The pinned delivery: a release for a standalone line, an edition for a pack line.
  preset_id uuid,
  release_id uuid,
  pack_id uuid,
  edition_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_order_items_kind_check CHECK (
    (kind = 'preset' AND preset_id IS NOT NULL AND release_id IS NOT NULL AND pack_id IS NULL AND edition_id IS NULL)
    OR (kind = 'pack' AND pack_id IS NOT NULL AND edition_id IS NOT NULL AND preset_id IS NULL AND release_id IS NULL)
  ),
  CONSTRAINT store_order_items_order_product_unique UNIQUE (order_id, product_id),
  -- The line's price is exactly the price row it names: product, currency and amount cannot drift from the snapshot.
  CONSTRAINT store_order_items_price_fk FOREIGN KEY (price_id, product_id, currency, unit_amount_minor)
    REFERENCES public.store_product_prices(id, product_id, currency, amount_minor) ON DELETE RESTRICT,
  CONSTRAINT store_order_items_product_fk FOREIGN KEY (product_id) REFERENCES public.store_products(id) ON DELETE RESTRICT,
  CONSTRAINT store_order_items_release_fk FOREIGN KEY (release_id, preset_id) REFERENCES public.preset_releases(id, preset_id) ON DELETE RESTRICT,
  CONSTRAINT store_order_items_edition_fk FOREIGN KEY (edition_id, pack_id) REFERENCES public.preset_pack_editions(id, pack_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_store_order_items_product ON public.store_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_store_order_items_price ON public.store_order_items(price_id);
CREATE INDEX IF NOT EXISTS idx_store_order_items_release ON public.store_order_items(release_id) WHERE release_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_order_items_edition ON public.store_order_items(edition_id) WHERE edition_id IS NOT NULL;

-- An order's identity and money never change after insert; only its lifecycle columns do. user_id may only be cleared (account deletion).
CREATE OR REPLACE FUNCTION public.store_orders_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'an order cannot change owner' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.provider IS DISTINCT FROM OLD.provider OR NEW.environment IS DISTINCT FROM OLD.environment
    OR NEW.currency IS DISTINCT FROM OLD.currency OR NEW.total_minor IS DISTINCT FROM OLD.total_minor
    OR NEW.request_key IS DISTINCT FROM OLD.request_key OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'order identity and amounts are immutable' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.provider_checkout_session_id IS NOT NULL AND NEW.provider_checkout_session_id IS DISTINCT FROM OLD.provider_checkout_session_id THEN
    RAISE EXCEPTION 'a provider checkout reference cannot be replaced' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.provider_payment_intent_id IS NOT NULL AND NEW.provider_payment_intent_id IS DISTINCT FROM OLD.provider_payment_intent_id THEN
    RAISE EXCEPTION 'a provider payment reference cannot be replaced' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.status = 'refunded' AND NEW.status NOT IN ('refunded') THEN
    RAISE EXCEPTION 'a refunded order cannot be reopened' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_orders_guard ON public.store_orders;
CREATE TRIGGER trg_store_orders_guard
  BEFORE UPDATE ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION public.store_orders_guard();

-- Order lines are immutable, and a line must be a coherent sale of its product.
CREATE OR REPLACE FUNCTION public.store_order_items_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_product public.store_products%ROWTYPE;
  v_order_currency text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'order lines are immutable' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  SELECT * INTO v_product FROM public.store_products WHERE id = NEW.product_id;
  IF NOT FOUND OR v_product.kind <> NEW.kind
    OR (NEW.kind = 'preset' AND v_product.preset_id IS DISTINCT FROM NEW.preset_id)
    OR (NEW.kind = 'pack' AND v_product.pack_id IS DISTINCT FROM NEW.pack_id) THEN
    RAISE EXCEPTION 'order line does not match its product' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  SELECT currency INTO v_order_currency FROM public.store_orders WHERE id = NEW.order_id;
  IF v_order_currency IS DISTINCT FROM NEW.currency THEN
    RAISE EXCEPTION 'order line currency must match its order' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_order_items_guard ON public.store_order_items;
CREATE TRIGGER trg_store_order_items_guard
  BEFORE INSERT OR UPDATE ON public.store_order_items
  FOR EACH ROW EXECUTE FUNCTION public.store_order_items_guard();

-- Exact money: at commit, an order has at least one line and its total is the exact sum of its lines.
CREATE OR REPLACE FUNCTION public.store_order_total_matches_items()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id uuid;
  v_total bigint;
  v_sum bigint;
  v_lines integer;
BEGIN
  -- Two tables share this function, so the order id is read from whichever row type fired it (a CASE would still resolve both).
  IF TG_TABLE_NAME = 'store_orders' THEN
    v_order_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  ELSE
    v_order_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.order_id ELSE NEW.order_id END;
  END IF;
  SELECT total_minor INTO v_total FROM public.store_orders WHERE id = v_order_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  SELECT COALESCE(sum(unit_amount_minor), 0), count(*) INTO v_sum, v_lines FROM public.store_order_items WHERE order_id = v_order_id;
  IF v_lines = 0 THEN
    RAISE EXCEPTION 'order % has no lines', v_order_id USING ERRCODE = 'check_violation';
  END IF;
  IF v_sum <> v_total THEN
    RAISE EXCEPTION 'order % total % does not equal its lines (%)', v_order_id, v_total, v_sum USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_orders_total_matches_items ON public.store_orders;
CREATE CONSTRAINT TRIGGER trg_store_orders_total_matches_items
  AFTER INSERT OR UPDATE OF total_minor ON public.store_orders
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.store_order_total_matches_items();

DROP TRIGGER IF EXISTS trg_store_order_items_total_matches_items ON public.store_order_items;
CREATE CONSTRAINT TRIGGER trg_store_order_items_total_matches_items
  AFTER INSERT OR UPDATE OR DELETE ON public.store_order_items
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.store_order_total_matches_items();

CREATE TABLE IF NOT EXISTS public.store_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  environment text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received',
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  order_id uuid REFERENCES public.store_orders(id) ON DELETE SET NULL,
  provider_payment_ref text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT store_payment_events_provider_check CHECK (provider IN ('stripe')),
  CONSTRAINT store_payment_events_environment_check CHECK (environment IN ('test', 'live')),
  CONSTRAINT store_payment_events_event_id_check CHECK (length(btrim(event_id)) BETWEEN 1 AND 255),
  CONSTRAINT store_payment_events_event_type_check CHECK (length(btrim(event_type)) BETWEEN 1 AND 120),
  CONSTRAINT store_payment_events_payload_check CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 262144),
  CONSTRAINT store_payment_events_status_check CHECK (status IN ('received', 'processing', 'processed', 'failed', 'ignored')),
  CONSTRAINT store_payment_events_attempts_check CHECK (attempt_count BETWEEN 0 AND 1000),
  CONSTRAINT store_payment_events_error_check CHECK (last_error IS NULL OR length(last_error) <= 2000),
  CONSTRAINT store_payment_events_payment_ref_check CHECK (provider_payment_ref IS NULL OR length(btrim(provider_payment_ref)) BETWEEN 1 AND 255),
  CONSTRAINT store_payment_events_processed_check CHECK ((status IN ('processed', 'ignored')) = (processed_at IS NOT NULL))
);

-- The same provider event delivered twice is one row: the second insert conflicts, the handler reads the first row's status.
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_payment_events_event ON public.store_payment_events(provider, environment, event_id);
CREATE INDEX IF NOT EXISTS idx_store_payment_events_pending ON public.store_payment_events(status, received_at) WHERE status IN ('received', 'processing', 'failed');
CREATE INDEX IF NOT EXISTS idx_store_payment_events_order ON public.store_payment_events(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_payment_events_payment_ref ON public.store_payment_events(provider, provider_payment_ref) WHERE provider_payment_ref IS NOT NULL;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Entitlement grants, holding provenance, preferences
-- ---------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.preset_entitlement_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  preset_id uuid NOT NULL REFERENCES public.presets(id) ON DELETE RESTRICT,
  release_id uuid NOT NULL,
  source_kind text NOT NULL,
  -- purchase / free_claim: the pinned order line that produced this grant. via_edition_id is set when the line is a pack.
  order_item_id uuid REFERENCES public.store_order_items(id) ON DELETE RESTRICT,
  via_edition_id uuid REFERENCES public.preset_pack_editions(id) ON DELETE RESTRICT,
  -- manual: an operator reference (support ticket, comp code, ...) and the operator who granted it.
  manual_reference text,
  granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_reason text,
  CONSTRAINT preset_entitlement_grants_source_check CHECK (source_kind IN ('purchase', 'free_claim', 'manual')),
  CONSTRAINT preset_entitlement_grants_shape_check CHECK (
    (source_kind IN ('purchase', 'free_claim') AND order_item_id IS NOT NULL AND manual_reference IS NULL AND granted_by IS NULL)
    OR (source_kind = 'manual' AND order_item_id IS NULL AND via_edition_id IS NULL AND manual_reference IS NOT NULL)
  ),
  CONSTRAINT preset_entitlement_grants_reference_check CHECK (manual_reference IS NULL OR length(btrim(manual_reference)) BETWEEN 1 AND 200),
  CONSTRAINT preset_entitlement_grants_revocation_check CHECK (
    (revoked_at IS NULL AND revoked_reason IS NULL)
    OR (revoked_at IS NOT NULL AND revoked_reason IS NOT NULL AND length(btrim(revoked_reason)) BETWEEN 1 AND 200)
  ),
  CONSTRAINT preset_entitlement_grants_release_fk FOREIGN KEY (release_id, preset_id) REFERENCES public.preset_releases(id, preset_id) ON DELETE RESTRICT
);

-- One grant per source and member: replaying a fulfilment, or a webhook, can never create a second row for the same line.
CREATE UNIQUE INDEX IF NOT EXISTS uq_preset_entitlement_grants_order_member
  ON public.preset_entitlement_grants(order_item_id, preset_id) WHERE order_item_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_preset_entitlement_grants_manual
  ON public.preset_entitlement_grants(user_id, preset_id, manual_reference) WHERE source_kind = 'manual';
-- "Does this user effectively hold this preset?" is existence of a row here.
CREATE INDEX IF NOT EXISTS idx_preset_entitlement_grants_active
  ON public.preset_entitlement_grants(user_id, preset_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_preset_entitlement_grants_user ON public.preset_entitlement_grants(user_id, granted_at DESC);
CREATE INDEX IF NOT EXISTS idx_preset_entitlement_grants_item ON public.preset_entitlement_grants(order_item_id) WHERE order_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_preset_entitlement_grants_release ON public.preset_entitlement_grants(release_id);
CREATE INDEX IF NOT EXISTS idx_preset_entitlement_grants_edition ON public.preset_entitlement_grants(via_edition_id) WHERE via_edition_id IS NOT NULL;

-- A grant is coherent with the order line that produced it, and afterwards only its revocation columns may change.
CREATE OR REPLACE FUNCTION public.preset_entitlement_grants_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
  v_total bigint;
  v_item_preset uuid;
  v_item_release uuid;
  v_item_edition uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'revoked_at' - 'revoked_reason') IS DISTINCT FROM (to_jsonb(OLD) - 'revoked_at' - 'revoked_reason') THEN
      RAISE EXCEPTION 'a grant is immutable except for its revocation' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.source_kind IN ('purchase', 'free_claim') THEN
    SELECT o.user_id, o.total_minor, i.preset_id, i.release_id, i.edition_id
      INTO v_user_id, v_total, v_item_preset, v_item_release, v_item_edition
    FROM public.store_order_items AS i
    JOIN public.store_orders AS o ON o.id = i.order_id
    WHERE i.id = NEW.order_item_id;
    IF NOT FOUND OR v_user_id IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'a grant must belong to the user who owns its order' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF (v_total = 0) <> (NEW.source_kind = 'free_claim') THEN
      RAISE EXCEPTION 'free_claim grants come from zero-total orders, purchase grants from paid ones' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF v_item_release IS NOT NULL THEN
      IF NEW.release_id IS DISTINCT FROM v_item_release OR NEW.preset_id IS DISTINCT FROM v_item_preset OR NEW.via_edition_id IS NOT NULL THEN
        RAISE EXCEPTION 'grant does not match its standalone order line' USING ERRCODE = 'integrity_constraint_violation';
      END IF;
    ELSIF NEW.via_edition_id IS DISTINCT FROM v_item_edition OR NOT EXISTS (
      SELECT 1 FROM public.preset_pack_items AS member
      WHERE member.edition_id = v_item_edition AND member.preset_id = NEW.preset_id AND member.release_id = NEW.release_id
    ) THEN
      RAISE EXCEPTION 'grant is not a member of its pinned pack edition' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preset_entitlement_grants_guard ON public.preset_entitlement_grants;
CREATE TRIGGER trg_preset_entitlement_grants_guard
  BEFORE INSERT OR UPDATE ON public.preset_entitlement_grants
  FOR EACH ROW EXECUTE FUNCTION public.preset_entitlement_grants_guard();

-- Marks a user_presets row the marketplace itself created. A holding with no marker is a legacy / hand-recorded one (0036, 0040, 0041, ...)
-- and is never removed by a revocation. Rows are deleted together with their user_presets row.
CREATE TABLE IF NOT EXISTS public.marketplace_holding_projections (
  user_id uuid NOT NULL,
  preset_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, preset_id),
  CONSTRAINT marketplace_holding_projections_holding_fk FOREIGN KEY (user_id, preset_id)
    REFERENCES public.user_presets(user_id, preset_id) ON DELETE CASCADE
);

-- Own favourite state, keyed by the canonical preset. Independent of ownership: a system preset needs no holding to be favourited, and
-- nothing reads this table as proof of ownership.
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
-- Server primitives: grant, revoke, reconcile the legacy holding. SERVICE ROLE ONLY (see the privilege block at the end).
-- ---------------------------------------------------------------------------------------------------------------------------------

-- Makes user_presets agree with the grants for one (user, preset), serialised per pair so overlapping fulfilments / revocations cannot race.
--   any active grant  -> make sure a user_presets row exists; if THIS call created it, mark it as marketplace-created
--   no active grant   -> delete the user_presets row only if it is marked marketplace-created; a legacy row is never touched
CREATE OR REPLACE FUNCTION public.reconcile_preset_holding(p_user_id uuid, p_preset_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_created integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_preset_id::text, 43));

  IF EXISTS (
    SELECT 1 FROM public.preset_entitlement_grants AS grant_row
    WHERE grant_row.user_id = p_user_id AND grant_row.preset_id = p_preset_id AND grant_row.revoked_at IS NULL
  ) THEN
    INSERT INTO public.user_presets (user_id, preset_id) VALUES (p_user_id, p_preset_id) ON CONFLICT (user_id, preset_id) DO NOTHING;
    GET DIAGNOSTICS v_created = ROW_COUNT;
    IF v_created = 1 THEN
      INSERT INTO public.marketplace_holding_projections (user_id, preset_id) VALUES (p_user_id, p_preset_id) ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    DELETE FROM public.user_presets AS holding
    USING public.marketplace_holding_projections AS marker
    WHERE holding.user_id = p_user_id AND holding.preset_id = p_preset_id
      AND marker.user_id = holding.user_id AND marker.preset_id = holding.preset_id;
  END IF;
END;
$$;

-- Fulfils one paid (or zero-total) order line: one grant per member release, then the holding. Idempotent: a replay inserts nothing, and a
-- grant that was already revoked is NOT restored by a late replay (refund-before-fulfilment stays refunded).
CREATE OR REPLACE FUNCTION public.fulfill_store_order_item(p_order_item_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item public.store_order_items%ROWTYPE;
  v_order public.store_orders%ROWTYPE;
  v_source text;
  v_member record;
  v_inserted integer;
  v_granted integer := 0;
BEGIN
  SELECT * INTO v_item FROM public.store_order_items WHERE id = p_order_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order line % not found', p_order_item_id USING ERRCODE = 'no_data_found';
  END IF;
  SELECT * INTO v_order FROM public.store_orders WHERE id = v_item.order_id FOR UPDATE;
  IF v_order.user_id IS NULL THEN
    RAISE EXCEPTION 'order % has no owner', v_order.id USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF v_order.status NOT IN ('paid', 'fulfilled') THEN
    RAISE EXCEPTION 'order % is % and cannot be fulfilled', v_order.id, v_order.status USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  v_source := CASE WHEN v_order.total_minor = 0 THEN 'free_claim' ELSE 'purchase' END;

  FOR v_member IN
    SELECT v_item.preset_id AS preset_id, v_item.release_id AS release_id, NULL::uuid AS via_edition_id
    WHERE v_item.kind = 'preset'
    UNION ALL
    SELECT member.preset_id, member.release_id, v_item.edition_id
    FROM public.preset_pack_items AS member
    WHERE v_item.kind = 'pack' AND member.edition_id = v_item.edition_id
    ORDER BY 1
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_order.user_id::text || ':' || v_member.preset_id::text, 43));
    INSERT INTO public.preset_entitlement_grants (user_id, preset_id, release_id, source_kind, order_item_id, via_edition_id)
    VALUES (v_order.user_id, v_member.preset_id, v_member.release_id, v_source, v_item.id, v_member.via_edition_id)
    ON CONFLICT (order_item_id, preset_id) WHERE order_item_id IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_granted := v_granted + v_inserted;
    PERFORM public.reconcile_preset_holding(v_order.user_id, v_member.preset_id);
  END LOOP;

  UPDATE public.store_orders AS o
  SET status = 'fulfilled', fulfilled_at = now()
  WHERE o.id = v_order.id AND o.status = 'paid'
    AND NOT EXISTS (SELECT 1 FROM public.store_order_items AS line WHERE line.order_id = o.id AND NOT EXISTS (
      SELECT 1 FROM public.preset_entitlement_grants AS g WHERE g.order_item_id = line.id
    ));
  RETURN v_granted;
END;
$$;

-- Revokes every still-active grant of ONE order line (a refund, or a dispute held pending) and reconciles the holdings. Grants from any
-- other source, and a legacy holding, are untouched. Idempotent. The caller records the order's own status in the same transaction.
CREATE OR REPLACE FUNCTION public.revoke_store_order_item_entitlements(p_order_item_id uuid, p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row record;
  v_revoked integer := 0;
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'a revocation needs a reason of 1-200 characters' USING ERRCODE = 'check_violation';
  END IF;
  FOR v_row IN
    SELECT g.id, g.user_id, g.preset_id FROM public.preset_entitlement_grants AS g
    WHERE g.order_item_id = p_order_item_id AND g.revoked_at IS NULL ORDER BY g.preset_id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_row.user_id::text || ':' || v_row.preset_id::text, 43));
    UPDATE public.preset_entitlement_grants SET revoked_at = now(), revoked_reason = p_reason WHERE id = v_row.id AND revoked_at IS NULL;
    v_revoked := v_revoked + 1;
    PERFORM public.reconcile_preset_holding(v_row.user_id, v_row.preset_id);
  END LOOP;
  RETURN v_revoked;
END;
$$;

-- Lifts a dispute hold: only grants revoked with the reason 'dispute_pending' come back; a refund revocation stays revoked.
CREATE OR REPLACE FUNCTION public.restore_store_order_item_entitlements(p_order_item_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row record;
  v_restored integer := 0;
BEGIN
  FOR v_row IN
    SELECT g.id, g.user_id, g.preset_id FROM public.preset_entitlement_grants AS g
    WHERE g.order_item_id = p_order_item_id AND g.revoked_at IS NOT NULL AND g.revoked_reason = 'dispute_pending' ORDER BY g.preset_id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_row.user_id::text || ':' || v_row.preset_id::text, 43));
    UPDATE public.preset_entitlement_grants SET revoked_at = NULL, revoked_reason = NULL WHERE id = v_row.id;
    v_restored := v_restored + 1;
    PERFORM public.reconcile_preset_holding(v_row.user_id, v_row.preset_id);
  END LOOP;
  RETURN v_restored;
END;
$$;

-- Operator grants (support, comps). Same source / projection path as a purchase, so an independent grant is never lost or double-counted.
CREATE OR REPLACE FUNCTION public.grant_manual_preset_entitlement(
  p_user_id uuid, p_preset_id uuid, p_release_id uuid, p_reference text, p_granted_by uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_preset_id::text, 43));
  INSERT INTO public.preset_entitlement_grants (user_id, preset_id, release_id, source_kind, manual_reference, granted_by)
  VALUES (p_user_id, p_preset_id, p_release_id, 'manual', p_reference, p_granted_by)
  ON CONFLICT (user_id, preset_id, manual_reference) WHERE source_kind = 'manual' DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  PERFORM public.reconcile_preset_holding(p_user_id, p_preset_id);
  RETURN v_inserted = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_manual_preset_entitlement(p_user_id uuid, p_preset_id uuid, p_reference text, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'a revocation needs a reason of 1-200 characters' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_preset_id::text, 43));
  UPDATE public.preset_entitlement_grants SET revoked_at = now(), revoked_reason = p_reason
  WHERE user_id = p_user_id AND preset_id = p_preset_id AND source_kind = 'manual' AND manual_reference = p_reference AND revoked_at IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  PERFORM public.reconcile_preset_holding(p_user_id, p_preset_id);
  RETURN v_updated = 1;
END;
$$;

-- The only client write that touches a favourite: it changes is_favorite for the caller and nothing else, and never creates a holding.
--   user_preset_preferences  upsert (the durable source, valid for system presets the user holds no row for)
--   user_presets             if the caller already has a holding, keep its legacy is_favorite in step
-- Source precedence when reading: an explicit preference row, else the holding's is_favorite, else false.
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
  UPDATE public.user_presets SET is_favorite = p_is_favorite WHERE user_id = v_user_id AND preset_id = p_preset_id;
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Privileges. Supabase's default privileges grant new tables to anon / authenticated / service_role, so start from nothing.
-- ---------------------------------------------------------------------------------------------------------------------------------

REVOKE ALL ON TABLE
  public.preset_releases, public.preset_release_publications, public.preset_packs, public.preset_pack_editions, public.preset_pack_items,
  public.store_products, public.store_product_prices, public.store_product_provider_refs, public.store_orders, public.store_order_items,
  public.store_payment_events, public.preset_entitlement_grants, public.marketplace_holding_projections, public.user_preset_preferences
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE
  public.preset_releases, public.preset_release_publications, public.preset_packs, public.preset_pack_editions, public.preset_pack_items,
  public.store_products, public.store_product_prices, public.store_product_provider_refs, public.store_orders, public.store_order_items,
  public.store_payment_events, public.preset_entitlement_grants, public.marketplace_holding_projections, public.user_preset_preferences
  TO service_role;

-- Published metadata. These tables hold nothing private (provider mapping, payment events and the release content paths live elsewhere), so they
-- are granted whole and RLS alone decides the rows. preset_releases is the exception: its hash, sizes and private storage paths are never granted
-- to a client role, so it gets a column list (which also means a client must name columns; select * on it is denied by design).
GRANT SELECT ON public.preset_release_publications, public.preset_packs, public.preset_pack_editions, public.preset_pack_items,
  public.store_products, public.store_product_prices TO anon, authenticated;
GRANT SELECT (id, preset_id, version, min_app_version, created_at) ON public.preset_releases TO anon, authenticated;

-- A user's own commerce state. Read-only from the client: no INSERT / UPDATE / DELETE on orders, lines or grants.
GRANT SELECT (id, user_id, currency, total_minor, status, paid_at, fulfilled_at, refunded_at, created_at) ON public.store_orders TO authenticated;
GRANT SELECT (id, order_id, product_id, kind, currency, unit_amount_minor, preset_id, release_id, pack_id, edition_id, created_at)
  ON public.store_order_items TO authenticated;
GRANT SELECT (id, user_id, preset_id, release_id, source_kind, order_item_id, via_edition_id, granted_at, revoked_at)
  ON public.preset_entitlement_grants TO authenticated;

-- Own preferences: read, write the favourite flag and delete, bounded by RLS to the caller's own rows.
GRANT SELECT ON public.user_preset_preferences TO authenticated;
GRANT INSERT (user_id, preset_id, is_favorite) ON public.user_preset_preferences TO authenticated;
GRANT UPDATE (is_favorite) ON public.user_preset_preferences TO authenticated;
GRANT DELETE ON public.user_preset_preferences TO authenticated;

REVOKE ALL ON FUNCTION public.reconcile_preset_holding(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fulfill_store_order_item(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_store_order_item_entitlements(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_store_order_item_entitlements(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_manual_preset_entitlement(uuid, uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_manual_preset_entitlement(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_preset_favorite(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_preset_holding(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_store_order_item(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_store_order_item_entitlements(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_store_order_item_entitlements(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_manual_preset_entitlement(uuid, uuid, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_manual_preset_entitlement(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_preset_favorite(uuid, boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Row level security. RLS filters rows; the column grants above decide which columns a client can see at all.
-- ---------------------------------------------------------------------------------------------------------------------------------

ALTER TABLE public.preset_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_release_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_pack_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_pack_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_product_provider_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_entitlement_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_holding_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preset_preferences ENABLE ROW LEVEL SECURITY;
-- store_product_provider_refs, store_payment_events and marketplace_holding_projections get NO policy: RLS with no policy denies every
-- client row, on top of the REVOKE above. The service role bypasses RLS.

-- A product is visible once published, and stays visible (archived) to anyone with an order line for it, so "Owned" can still show it.
DROP POLICY IF EXISTS "store_products: published select" ON public.store_products;
CREATE POLICY "store_products: published select"
  ON public.store_products FOR SELECT TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "store_products: ordered select" ON public.store_products;
CREATE POLICY "store_products: ordered select"
  ON public.store_products FOR SELECT TO authenticated
  USING (
    status = 'archived'
    AND EXISTS (
      SELECT 1 FROM public.store_order_items AS line JOIN public.store_orders AS o ON o.id = line.order_id
      WHERE line.product_id = store_products.id AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "store_product_prices: published select" ON public.store_product_prices;
CREATE POLICY "store_product_prices: published select"
  ON public.store_product_prices FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    AND EXISTS (SELECT 1 FROM public.store_products AS product WHERE product.id = store_product_prices.product_id AND product.status = 'published')
  );

DROP POLICY IF EXISTS "preset_release_publications: published select" ON public.preset_release_publications;
CREATE POLICY "preset_release_publications: published select"
  ON public.preset_release_publications FOR SELECT TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "preset_releases: published select" ON public.preset_releases;
CREATE POLICY "preset_releases: published select"
  ON public.preset_releases FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.preset_release_publications AS pub WHERE pub.release_id = preset_releases.id AND pub.status = 'published'));

-- Packs and their editions are visible while a published product sells the pack. Retired editions stay visible so an owner can still see
-- exactly what that edition contained; draft editions never are.
DROP POLICY IF EXISTS "preset_packs: published select" ON public.preset_packs;
CREATE POLICY "preset_packs: published select"
  ON public.preset_packs FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.store_products AS product WHERE product.pack_id = preset_packs.id AND product.status = 'published'));

DROP POLICY IF EXISTS "preset_pack_editions: published select" ON public.preset_pack_editions;
CREATE POLICY "preset_pack_editions: published select"
  ON public.preset_pack_editions FOR SELECT TO anon, authenticated
  USING (
    status IN ('published', 'retired')
    AND EXISTS (SELECT 1 FROM public.store_products AS product WHERE product.pack_id = preset_pack_editions.pack_id AND product.status = 'published')
  );

DROP POLICY IF EXISTS "preset_pack_items: published select" ON public.preset_pack_items;
CREATE POLICY "preset_pack_items: published select"
  ON public.preset_pack_items FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.preset_pack_editions AS edition WHERE edition.id = preset_pack_items.edition_id));

DROP POLICY IF EXISTS "store_orders: own select" ON public.store_orders;
CREATE POLICY "store_orders: own select"
  ON public.store_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "store_order_items: own select" ON public.store_order_items;
CREATE POLICY "store_order_items: own select"
  ON public.store_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.store_orders AS o WHERE o.id = store_order_items.order_id AND o.user_id = auth.uid()));

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
