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

Laid out like **User Accounts** (`PresetCatalogPane.tsx`, using the same `.adm-split` and `.adm-table` classes from `admin.css`), under a slim strip of section tabs: a table of presets on the left and, on the right, the open preset in a 420px detail panel. Clicking a row (or arrow keys in the list) opens that preset there.

- **Table (left):** every preset in `PRESET_MANAGER_PRESETS` (all engines) as a row: a hollow circular bulk-selection toggle (filled when selected), thumbnail and name (with a **Modified** badge while it has unsaved changes), engine, category and status. A header icon switches to the same poster grid with the same bulk toggle. Search and the five dropdowns (engine, category, pack, sort and status) share a stable filter grid that wraps in narrow catalog columns. The status dropdown counts what clicking each option shows and opens from its right edge in the shared body portal. With presets selected, the bulk bar offers **Designing**, **Draft**, **Archive**; publishing uses the page header. Changes to several presets and archiving ask for confirmation.
- **Detail panel (right), top:** no separate Inspector window title bar. The selected preset's thumbnail, name, status, description and facts (engine, category, type, version, packs, display order, capabilities, last changed) start at the top of the scroll area. For a Cinema 2.0 preset, **Play live preview** runs the real preset in place of the thumbnail (never on its own; it stops when the selection moves).
- **Detail panel (right), below:** one continuous stack of collapsible groups: **Publishing**, **Preset Info**, **Tags & Collections**, **Store Listing**, **Technical**, and **In the App** (the library and grid cards with unsaved edits applied). There is no inspector tab row; the same scroll area contains all details. Save and publish remain page-header actions, with notifications through the shared notification system.
- **Drafts and saving:** edits are kept as a draft per preset, so the admin can move around; a card with unsaved changes carries a "Modified" badge. The page header carries icon-only actions: **Save changes (n)** (every edited preset, in one go; Ctrl/Cmd+S), **Publish** (the selected presets, or the open one), **Reset to shipped** (the open preset; only when it has a saved change) and **Discard unsaved changes**. A preset with a change that cannot be saved (an empty name, a bad order) is left out of Save all, and the notice says how many.
- **Bulk saves** run one after another, each on top of the rows the one before left. If one fails, the ones before it stay saved, the list shows them, and the notice says how far it got ("Published: 1 of 3 saved").

- **Metadata** lives in `preset_catalog_metadata`, keyed `(engine_id, preset_key)` = a record's source and source id. Every column is an override (NULL = the shipped value), so a row only holds what an admin changed; **Reset to shipped** deletes it.
- **Applied in the app:** name, description, category, tags and display order, in the Preset Manager (`applyPresetMetadata`, `usePresetMetadata`); an admin's save updates the app's store at once and other users get it on their next catalog load. **Stored for the store, not applied yet:** publication status (Designing, Draft, Published and Archived do not hide or show a preset to users today: only the five fields above change what users see). **Designing** is a status for a preset still being designed, before it is a draft (migration `0060_preset_catalog_designing_status.sql`, with a rollback; it must be applied before the status can be saved), store title and subtitle, artwork and preview references. The Performance Manager and the per-engine preset browsers still show the shipped names.
- **Packs** are `catalog_packs` + `catalog_pack_members`: named, ordered groups of presets the app already ships (create, rename, order, delete, add and remove presets, reorder inside a pack). They are not the store's `preset_packs` (0043), which hold releases (distributable files) and need one per member; packs are not shown to users yet. The **Packs** tab uses the same two-column catalog layout: a responsive grid of square artwork covers on the left, and the selected pack, its presets in order and its editor in the headerless right detail area, with **Save pack** and **Delete pack** as page-header icons. Both tabs stay mounted, so switching never loses unsaved preset edits.
- **Pack artwork:** apply migration `0063_catalog_pack_artwork.sql` before using the new controls. Every new (and existing unillustrated) pack has a blank square cover; click the artwork to upload or replace a JPEG, PNG or WebP (up to 5 MB). The optional subtitle is saved with the pack; if omitted, the cover displays its preset count. The private `catalog-pack-artwork` bucket is admin-only; `catalog_packs.thumbnail_path` holds the durable object reference. A failed upload does not change the existing cover. The cover is administrative artwork, not a published Store product.
- **Add Preset:** the inspector uses the same `VisualPresetSearch` component as React, including thumbnails, name/category/tag/collection matching, highlighted matches and keyboard selection. The admin picker searches all catalog engines (engine name is also searchable) and excludes current pack members; choose a result and click **Add**. The personal System/User toggle is intentionally omitted for this cross-engine admin catalog.
- **Technical** (read-only): preset id, source id, engine, activation type, camera, user media, 3D environment; version (Cinema 2.0 revision) and compatibility (its required capabilities) where the app has them.

## Message Center

`announcements` + `announcement_acknowledgments`. Admins create, edit, activate and deactivate, and delete announcements (title, message, optional image upload or address, optional button, active, publish date) and read eligible / acknowledged / not-yet counts (`admin_announcement_stats()`, eligible = every registered user).

In the app (`AnnouncementPopover`, mounted in `App.tsx`): a signed-in user sees each active, published, unacknowledged announcement in the standard dialog, one after another, oldest first. **Got It** writes the user's acknowledgment (never shown again); **Close** hides it for the session only, so it returns at the next sign-in. Users can read only live announcements and write only their own acknowledgment.

The Admin Console uses the shared application header slot, logo/name/divider brand and standard header status controls. Its section tabs stay in the content window without a duplicate window-title header.

Admin access (`useAdminAccessStatus` in `lib/adminAccess.ts`) is `checking`, `granted` or `denied`. Supabase fires auth events often (token refreshes, the window regaining focus) and each one re-verifies the user with the server; a verified admin stays `granted` through that routine re-check instead of dropping to "no access" for a moment, and only the server's answer, or a sign-out, takes access away. The app leaves the Admin page only on a settled `denied`, never while the answer is still being checked.

Dates in the Admin Console (the Users tab's Registered from / to filters and the announcement Publish Date) use the shared date picker, not native date inputs; see `docs/date-picker.md`.
