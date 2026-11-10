# Cinema 2.0 text controls

- **SAY IT:** Design → Layout orders Line Mode, Line 1, Line 2 (two-line mode only), Alignment, Tracking, Line Spacing, and Glyph Scale. Existing text values and parameter IDs are preserved.
- **MARQUEE:** Returning users restore their saved front, left, and right messages, including intentionally empty messages. First-use copy is front `MARQUEE` and left/right `SHOWINGS`.
- **NIGHTSHIFT:** Signs are disabled and all four message fields are empty for first-time users. Existing saved messages remain available when signs are enabled; hiding signs does not clear them.

Text edits in the production Design Inspector checkpoint the existing Cinema 2.0 workspace immediately, without waiting for preset switching or runtime retirement. Existing project/workspace restore behavior remains in effect.


## Text Scenes MVP

SAY IT, MARQUEE, NIGHTSHIFT, SUBMERGE, and ORBITAL expose their account-owned Text Scenes library in Source. Other Cinema 2.0 presets retain their existing Source and Layers surfaces. The text presets show Pool in place of Layers.

- Capture Current and Add sit inside the Text Scenes group, immediately to the right of the single grid/list toggle in the search row, using the shared Lyric Manager/header icon keys. Capture Current opens a named draft populated from the current authored Design values, excluding transient musical modulation. Add opens a named draft with preset appearance defaults and blank message fields.
- Add, Capture, and Back animate the group height and fade/slide its contents over 320 ms, respecting reduced-motion preferences. Add and Capture replace the library group with a New Text Scene editor group. The editor navigation row contains only the shared header-style Back icon at its top left; Add and Capture remain on the library screen. Search, view mode, and pool selection are retained. Editing and saving a draft leave the live visualizer unchanged; Save creates an independent record and restores the library.
- Popover and confirmation headings capitalize each word through the shared typography role.
- Dirty drafts use the existing canonical Unsaved changes dialog with Cancel, Discard Changes, and Save. Back, Source/Pool navigation, preset/engine/pad changes, workspace navigation, and React reset wait for a decision. Cancel preserves the draft; failed Save keeps both the draft and destination pending. A successful durable local Save or Discard continues the original action once. Add and Capture drafts are clean when opened; the prompt appears only when their name or parameters differ from that initial configuration. Reverting every edit makes the draft clean again. Browser reload/close uses the standard beforeunload protection.
- The library body is flat and transparent, with no extra horizontal inset or search-row divider. Search shares its component with Lyric Manager Tracks: 32px field, inset magnifier, and the canonical underline. Grid records use the Cinema 2.0 preset poster shell: two columns, matching tile proportions, centered scene names, neutral borders, hover/focus treatment, and active glow. A message preview and palette swatches remain visible; list records use the same transparent preset surface, title typography, neutral border, hover/focus treatment, and active glow in compact horizontal rows, with message copy on the left and palette/sync status on the right.
- Grid/list uses one shared action icon throughout the app, including Media Manager and Layout Lab. It shows the next view; each click switches views and updates its icon and accessible label.
- Search matches the record name and all its message fields. Grid and list use the shared Media Manager search/view controls and shared UI typography. Cards show text and palette swatches; they do not run extra renderers.
- Clicking or right-clicking a record opens Make Active and Add to Pool. Make Active validates the complete saved parameter patch and applies it atomically to the existing runtime; Design updates immediately. Other performance, camera, and effect controls remain unchanged.
- Pool supports creating named pools and assigning saved-record references, restricted to the same preset. Membership is idempotent and a record may belong to multiple pools. Pool playback/automation and rename/edit/duplicate/delete are deferred.

### Saved fields

| Preset | Fields recalled |
| --- | --- |
| ORBITAL | Line mode, both lines, alignment, tracking, line spacing, glyph scale and depth, material, roughness, inlay and palette, gyroscope size, planet, debris |
| SUBMERGE | Line mode, both lines, alignment, tracking, line spacing, glyph scale and depth, material, roughness, edge glow and palette, architecture, caustics, haze, particles, bubbles |
| SAY IT | Line mode, both lines, alignment, tracking, line spacing, glyph scale, material style, LED Outline enabled, background, chrome tint, outline color |
| MARQUEE | Front/left/right text, sign illumination, Marquee Red (also affects the theater's shared red accents) |
| NIGHTSHIFT | Enable Signs, back/left/front/right text, sign size, sign color |

The editor reports renderer limits before Save: SAY IT, SUBMERGE, and ORBITAL support Basic Latin with 12 characters per line and 20 total; MARQUEE supports 48 characters per sign; NIGHTSHIFT supports its bundled alphabet with 64 characters per sign. At least one displayed message and a name of up to 100 characters are required. A NIGHTSHIFT configuration may intentionally keep its signs disabled while retaining messages.

### Account persistence and deployment

Apply `supabase/migrations/0044_cinema2_text_library.sql` before using cloud sync. It creates `cinema2_saved_text`, `cinema2_text_pools`, and `cinema2_text_pool_entries`. RLS permits authenticated owners to read/insert their data; compound foreign keys prevent cross-owner and cross-preset memberships. MVP writes are append-only and retry-safe. These tables are independent of project/workspace save data.

The library initializes from a versioned cache keyed by authenticated user ID, then synchronizes with Supabase. New records, pools, and memberships enter a durable pending queue before Save is acknowledged. Pending changes survive restarts and retry on connection recovery, app focus, auth refresh, or Retry Sync. Failures remain visible; locally available records can still be used. Account changes clear the in-memory view and ignore stale responses from previous accounts. Remote reads paginate to avoid silently truncating the library at the service row limit.

Cloud integration is covered with mocked service boundaries and account/cache tests. `supabase/tests/cinema2_text_library_regression.sql` exercises RLS, membership constraints, and retry behavior on a disposable migrated database. It must be run against a real test database before deploying the migration; no remote database migration is applied by the UI tests.

### Focused verification

- Unit/UI: Cinema2TextConfiguration, cinema2TextStore, cinema2TextDb, Cinema2TextLibraryPanel, and Cinema2ParameterSchemaState.
- Browser: start Vite on localhost port 5176, then run `node scripts/verify-cinema2-text-library.mjs`. It exercises the real Source forms beside Design, list/search, conditional lines, portaled dropdowns/context menus, activation, pools, and duplicate DOM IDs. Captures and typography measurements are written under `artifacts/cinema2-text-library/`.
