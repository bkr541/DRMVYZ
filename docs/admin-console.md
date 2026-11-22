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

Built from the same pieces and the same three windows as Preset Manager (`PresetCatalogPane.tsx`; the window layout CSS in `presetManager.css` applies to the admin workspace as well), under a slim strip of section tabs:

- **Library (left):** every preset in `PRESET_MANAGER_PRESETS` (all engines) as a card with its artwork, name and status, in a grid (the app's poster cards) or a compact list (Preset Manager's library cards, with the status beside the engine). Search, engine, category, pack and sort dropdowns, and status chips (All, Published, Draft, Not set, Archived) that count what clicking them shows. The round button on each card adds it to a multi-select; with presets selected a bulk bar offers **Publish**, **Draft**, **Archive** (archiving, and any change to several presets at once, asks first). Arrow keys move the selection.
- **Preview (centre):** PREVIEW shows the selected preset's artwork large, with its name, status, description and facts (engine, category, type, version, packs, display order, capabilities, last changed). For a Cinema 2.0 preset, **Play live preview** runs the real preset (never on its own, so moving through 150 presets stays quiet). IN THE APP shows the library card and the grid card exactly as users see them, with the admin's unsaved name and description applied.
- **Inspector (right):** INFO (Publishing: a status switch and a Publish button, which saves any unsaved changes with the new status; Preset Info; Tags & Collections with tags as chips, display order and packs), STORE and TECHNICAL.
- **Drafts and saving:** edits are kept as a draft per preset, so the admin can move around; a card with unsaved changes carries a "Modified" badge. **Save** in the inspector saves the open preset; the page header carries **Save changes (n)** (every edited preset, in one go; Ctrl/Cmd+S), **Publish** (the selected presets, or the open one) and **Discard unsaved changes**. A preset with a change that cannot be saved (an empty name, a bad order) is left out of Save all, and the notice says how many.
- **Bulk saves** run one after another, each on top of the rows the one before left. If one fails, the ones before it stay saved, the list shows them, and the notice says how far it got ("Published: 1 of 3 saved").

- **Metadata** lives in `preset_catalog_metadata`, keyed `(engine_id, preset_key)` = a record's source and source id. Every column is an override (NULL = the shipped value), so a row only holds what an admin changed; "Reset to Shipped" deletes it.
- **Applied in the app:** name, description, category, tags and display order, in the Preset Manager (`applyPresetMetadata`, `usePresetMetadata`); an admin's save updates the app's store at once and other users get it on their next catalog load. **Stored for the store, not applied yet:** publication status (Draft, Published and Archived do not hide or show a preset to users today: only the five fields above change what users see, which is why the page says so beside the Publish button), store title and subtitle, artwork and preview references. The Performance Manager and the per-engine preset browsers still show the shipped names.
- **Packs** are `catalog_packs` + `catalog_pack_members`: named, ordered groups of presets the app already ships (create, rename, order, delete, add and remove presets, reorder inside a pack). They are not the store's `preset_packs` (0043), which hold releases (distributable files) and need one per member; packs are not shown to users yet.
- **Technical** (read-only): preset id, source id, engine, activation type, camera, user media, 3D environment; version (Cinema 2.0 revision) and compatibility (its required capabilities) where the app has them.

## Message Center

`announcements` + `announcement_acknowledgments`. Admins create, edit, activate and deactivate, and delete announcements (title, message, optional image upload or address, optional button, active, publish date) and read eligible / acknowledged / not-yet counts (`admin_announcement_stats()`, eligible = every registered user).

In the app (`AnnouncementPopover`, mounted in `App.tsx`): a signed-in user sees each active, published, unacknowledged announcement in the standard dialog, one after another, oldest first. **Got It** writes the user's acknowledgment (never shown again); **Close** hides it for the session only, so it returns at the next sign-in. Users can read only live announcements and write only their own acknowledgment.

The Admin Console uses the shared application header slot, logo/name/divider brand and standard header status controls. Its section tabs stay in the content window without a duplicate window-title header.

Admin access (`useAdminAccessStatus` in `lib/adminAccess.ts`) is `checking`, `granted` or `denied`. Supabase fires auth events often (token refreshes, the window regaining focus) and each one re-verifies the user with the server; a verified admin stays `granted` through that routine re-check instead of dropping to "no access" for a moment, and only the server's answer, or a sign-out, takes access away. The app leaves the Admin page only on a settled `denied`, never while the answer is still being checked.
