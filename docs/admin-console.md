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

- **Table (left):** every preset in `PRESET_MANAGER_PRESETS` (all engines) as a row: round select button, thumbnail and name (with a **Modified** badge while it has unsaved changes), engine, category and status. A header icon switches to a grid of the app's poster cards. Search, engine, category, pack and sort dropdowns, and status chips (All, Not set, Designing, Draft, Published, Archived, in the order the status dropdown offers them) that count what clicking them shows. The round button on each row adds it to a multi-select; with presets selected a bulk bar offers **Publish**, **Designing**, **Draft**, **Archive** (archiving, and any change to several presets at once, asks first).
- **Detail panel (right), top:** the selected preset's thumbnail, name, status, description and facts (engine, category, type, version, packs, display order, capabilities, last changed). For a Cinema 2.0 preset, **Play live preview** runs the real preset in place of the thumbnail (never on its own, so moving through 150 presets stays quiet; it stops when the selection moves). Save and publish results appear at the top of the panel.
- **Detail panel (right), below:** INFO (Publishing: a **Status** dropdown, the standard component, with the five statuses each described in one sentence in its menu, and a Publish button, which saves any unsaved changes with the new status; Preset Info; Tags & Collections with tags as the app's shared tag pill (`TagPill`), display order and packs), STORE, TECHNICAL, and IN THE APP (the library card and the grid card exactly as users see them, with the admin's unsaved name and description applied). The panel has no buttons at its foot: its actions are icons in the page header.
- **Drafts and saving:** edits are kept as a draft per preset, so the admin can move around; a card with unsaved changes carries a "Modified" badge. The page header carries icon-only actions: **Save changes (n)** (every edited preset, in one go; Ctrl/Cmd+S), **Publish** (the selected presets, or the open one), **Reset to shipped** (the open preset; only when it has a saved change) and **Discard unsaved changes**. A preset with a change that cannot be saved (an empty name, a bad order) is left out of Save all, and the notice says how many.
- **Bulk saves** run one after another, each on top of the rows the one before left. If one fails, the ones before it stay saved, the list shows them, and the notice says how far it got ("Published: 1 of 3 saved").

- **Metadata** lives in `preset_catalog_metadata`, keyed `(engine_id, preset_key)` = a record's source and source id. Every column is an override (NULL = the shipped value), so a row only holds what an admin changed; **Reset to shipped** deletes it.
- **Applied in the app:** name, description, category, tags and display order, in the Preset Manager (`applyPresetMetadata`, `usePresetMetadata`); an admin's save updates the app's store at once and other users get it on their next catalog load. **Stored for the store, not applied yet:** publication status (Designing, Draft, Published and Archived do not hide or show a preset to users today: only the five fields above change what users see). **Designing** is a status for a preset still being designed, before it is a draft (migration `0060_preset_catalog_designing_status.sql`, with a rollback; it must be applied before the status can be saved), store title and subtitle, artwork and preview references. The Performance Manager and the per-engine preset browsers still show the shipped names.
- **Packs** are `catalog_packs` + `catalog_pack_members`: named, ordered groups of presets the app already ships (create, rename, order, delete, add and remove presets, reorder inside a pack). They are not the store's `preset_packs` (0043), which hold releases (distributable files) and need one per member; packs are not shown to users yet. The **Packs** tab still uses Preset Manager's three windows (library, preview, inspector): the packs in the library (with the same Presets | Packs tabs, a search and the new-pack row), the selected pack and its presets as cards in order (centre), and its editor (right) with **Save pack** and **Delete pack** as header icons. Both tabs stay mounted, so switching never loses unsaved preset edits.
- **Technical** (read-only): preset id, source id, engine, activation type, camera, user media, 3D environment; version (Cinema 2.0 revision) and compatibility (its required capabilities) where the app has them.

## Message Center

`announcements` + `announcement_acknowledgments`. Admins create, edit, activate and deactivate, and delete announcements (title, message, optional image upload or address, optional button, active, publish date) and read eligible / acknowledged / not-yet counts (`admin_announcement_stats()`, eligible = every registered user).

In the app (`AnnouncementPopover`, mounted in `App.tsx`): a signed-in user sees each active, published, unacknowledged announcement in the standard dialog, one after another, oldest first. **Got It** writes the user's acknowledgment (never shown again); **Close** hides it for the session only, so it returns at the next sign-in. Users can read only live announcements and write only their own acknowledgment.

The Admin Console uses the shared application header slot, logo/name/divider brand and standard header status controls. Its section tabs stay in the content window without a duplicate window-title header.

Admin access (`useAdminAccessStatus` in `lib/adminAccess.ts`) is `checking`, `granted` or `denied`. Supabase fires auth events often (token refreshes, the window regaining focus) and each one re-verifies the user with the server; a verified admin stays `granted` through that routine re-check instead of dropping to "no access" for a moment, and only the server's answer, or a sign-out, takes access away. The app leaves the Admin page only on a settled `denied`, never while the answer is still being checked.

Dates in the Admin Console (the Users tab's Registered from / to filters and the announcement Publish Date) use the shared date picker, not native date inputs; see `docs/date-picker.md`.
