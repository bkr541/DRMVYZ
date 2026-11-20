# Admin Console (Phase 1)

Reached from the Admin button in the left navigation (above Profile), shown only to an account whose server-managed `app_metadata` has `role: 'admin'` (or `is_admin: true`). The same rule is enforced in the database by `public.is_admin()` (migration `0056_admin_console.sql`); hiding the button is a convenience. The check reads the JWT, so a newly granted admin must refresh the session once (the console retries once by itself).

Grant admin (Supabase SQL editor):

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'
where email = 'YOUR-EMAIL';
```

## User Accounts (read-only)

`admin_list_users()` joins `auth.users` to `profiles` (id, email, display name, artist name, avatar, created, last updated, last sign-in). Searchable (name, artist, email), sortable (every column), filterable by registration date, total shown; a row opens the profile. Nothing can be edited, deleted or suspended.

## Preset Catalog

Lists every preset in `PRESET_MANAGER_PRESETS` (all engines), by engine or by pack, with search, filters (engine, category, pack, status) and sorting.

- **Metadata** lives in `preset_catalog_metadata`, keyed `(engine_id, preset_key)` = a record's source and source id. Every column is an override (NULL = the shipped value), so a row only holds what an admin changed; "Reset to Shipped" deletes it.
- **Applied in the app:** name, description, category, tags and display order, in the Preset Manager (`applyPresetMetadata`, `usePresetMetadata`); an admin's save updates the app's store at once and other users get it on their next catalog load. **Stored for the store, not applied yet:** publication status, store title and subtitle, artwork and preview references. The Performance Manager and the per-engine preset browsers still show the shipped names.
- **Packs** are `catalog_packs` + `catalog_pack_members`: named, ordered groups of presets the app already ships (create, rename, order, delete, add and remove presets, reorder inside a pack). They are not the store's `preset_packs` (0043), which hold releases (distributable files) and need one per member; packs are not shown to users yet.
- **Technical** (read-only): preset id, source id, engine, activation type, camera, user media, 3D environment; version (Cinema 2.0 revision) and compatibility (its required capabilities) where the app has them.

## Message Center

`announcements` + `announcement_acknowledgments`. Admins create, edit, activate and deactivate, and delete announcements (title, message, optional image upload or address, optional button, active, publish date) and read eligible / acknowledged / not-yet counts (`admin_announcement_stats()`, eligible = every registered user).

In the app (`AnnouncementPopover`, mounted in `App.tsx`): a signed-in user sees each active, published, unacknowledged announcement in the standard dialog, one after another, oldest first. **Got It** writes the user's acknowledgment (never shown again); **Close** hides it for the session only, so it returns at the next sign-in. Users can read only live announcements and write only their own acknowledgment.

The Admin Console uses the shared application header slot, logo/name/divider brand and standard header status controls. Its section tabs stay in the content window without a duplicate window-title header.
