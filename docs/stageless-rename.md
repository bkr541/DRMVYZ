# STAGELESS rename: complete plan and reference

**Status:** Phase 0 done (2026-11-21): `src/brand.ts`, `electron/brand.cjs`, and the ratcheting guard test in `src/brand/__tests__/`. Phase 1 done (2026-11-21, uncommitted): all visible text in `src/` and `native/`, recorder download names, preset/store authors, regenerated attributions (source: `assets/cinema2/*/asset.json`, then `npm run assets:build`). Left for Phase 2 by design: the four popup-window titles (`MobilePreviewLauncher`, `mobileAppPreview`, `LayoutLabModal`, `TrackTimelineModal`). Left for Phase 4: `supabase/functions/**` messages and the Android `strings.xml` (the Supabase redeploy was not done). Phase 2 done (2026-11-21, uncommitted): `index.html`, `package.json` identity (`productName` STAGELESS, `appId` com.stageless.app, permission strings), `electron/main.cjs`, popup titles, dev launcher (`STAGELESS Dev.app`, `com.stageless.app.dev*`; still closes legacy `DRMVYZ` bundles), README/NOTICES/launcher docs, and the data-folder migration in `native/system/userDataMigration.cjs` (unit-tested; also verified in real Electron against temp folders). Electron does NOT derive userData/logs from `app.setName()`, so `main.cjs` now sets both explicitly in every mode. **Still required before relying on it: the manual test in 5.5.2 against a backup of the real `DRMVYZ`/`DRMVYZ Development` folders.** Phase 3 done (2026-11-21, uncommitted): the supplied PNGs are now `public/stageless_logo.png` (S mark; used by the auth page and the header) and `public/stageless_wordmark.png` (supplied, not yet used anywhere); `drmvyz_logo2.png` and `drmvyz_logo_icon.png` were deleted and their two references updated. Phase 4 not started (Android `strings.xml` and Supabase function messages). Owner decisions are recorded in section 10, which overrides anything earlier in this file.
**Written:** 2026-11-21, from a long planning conversation. A fresh session should be able to execute everything from this file alone.
**New name:** `STAGELESS` (all caps). Replaces `DRMVYZ`.

---

## 1. Decisions (final, made by the owner)

1.1 **The new brand is `STAGELESS`, written in all caps** everywhere a user can see it.

1.2 **DVYDRM and VYZUALZ are also in scope, but only where an end user sees them.** That means visible text and visible artwork (logos, wordmark models, preset descriptions). It does **not** mean code identifiers, CSS class names or internal component names. `DreamViz` (e.g. `DreamVizTextInput`) is internal only and out of scope.

1.3 **Technical identifiers are NOT renamed** (see section 6). The owner accepted the recommendation to leave them, because renaming them breaks saved data or contracts and nobody sees them.

1.4 **Packaged-app names ARE renamed**: `productName`, `appId`, the app bundle name, installer file names, and the user-data/log/cache folder names, because users can open those folders and see the names. This needs a **data-folder migration** (section 5). The app icon `electron/assets/app-icon.png` was already replaced with the STAGELESS "S" icon (source `electron/assets/app-icon-source.png`, sized to Apple's 824px-of-1024 grid), so no icon work remains.

1.5 **Casing of related forms:** window titles and prose use `STAGELESS`. Where the old text was a proper noun with a suffix keep the suffix: `STAGELESS Receiver`, `STAGELESS Receivers`, `STAGELESS Dev` (dev shell), `STAGELESS Studio` (store author). Lowercase technical forms (file names, temp names) become `stageless-...`.

1.6 **Unconfirmed assumption to state back to the owner at the start:** nobody except the owner may have installed a build. Even so, the data migration in section 5 is still required for the owner's own installed/dev profile, so it is part of the plan either way. There is **no auto-updater** (`build.publish` is `null`), so update continuity is not a concern.

---

## 2. What counts as "user-visible"

Rename it if an end user can see it in any of these ways:
- text on screen (UI, dialogs, notifications, tooltips, error messages, help center, settings, the web page title/description);
- screen-reader labels (`aria-label`, `title`, `alt`);
- window titles, the Dock/taskbar name, menus, About, macOS permission prompts (`Info.plist` usage strings);
- names of files the app creates for the user (downloads, exports) and of installer/artifact files;
- folders the user can open (app bundle, install folder, Application Support/AppData/.config data folder, Logs, Caches) and the `appId`-named files macOS creates under `~/Library` (`Preferences`, `Caches`, `Saved Application State`, `HTTPStorages`);
- logos and artwork that contain the name or the DVYDRM wordmark;
- text shipped to users through services (Supabase edge-function messages, auth emails).

Do NOT rename (section 6): anything stored in users' data or a contract between components.

---

## 3. Central brand module (do this first)

Create one source of truth so the visible strings do not hard-code the name:
- `src/brand.ts`: `BRAND_NAME = 'STAGELESS'`, `BRAND_RECEIVER = 'STAGELESS Receiver'`, `BRAND_RECEIVERS = 'STAGELESS Receivers'`, `BRAND_AUTHOR_STUDIO = 'STAGELESS Studio'`, and a file-name prefix `BRAND_FILE_PREFIX = 'stageless'`.
- `electron/brand.cjs`: same name constants for the main process (CommonJS, because `electron/main.cjs` cannot import the TS module).
- Visible strings import these. Strings that are static data (preset metadata, `HelpCenter.ts`, `attributions.json`) may be literal `STAGELESS` instead; do not import a module into generated data.

### Guard test (add in phase 0; it is the proof of completeness)
A test (e.g. `src/brand/__tests__/noOldBrand.test.ts`, Vitest, node environment) that:
1. walks the files in scope (`src/**/*.{ts,tsx,css,html}`, `electron/**`, `index.html`, `package.json`, `public/**/*.json`, `android-tv-receiver/app/src/main/**`, `supabase/functions/**`, `README.md`, `THIRD_PARTY_NOTICES.md`);
2. fails on any case-insensitive match of `DRMVYZ`, `DVYDRM`, or `VYZUALZ` that is **not** on an explicit allow-list;
3. the allow-list is a checked-in file listing each allowed pattern with a reason: the technical identifiers in section 6 (`drmvyz.cinema2.*`, storage keys, `drmvyz:*` IPC channels, `drmvyzNative`, `drmvyz-app`, `drmvyz-receiver`, `_drmvyz-cast._tcp`, `DRMVYZ_CAST_RECEIVER`, `DRMVYZ_RECEIVER_*` constants, `X-DRMVYZ-Pairing-Token`, `urn:x-cast:com.dvydrm.drmvyz.live`, `DRMVYZ_*` environment variable names, code identifiers such as `DrmvyzReceiverProvider`, comment lines, test files, and `docs/`).
4. It will fail at first. Each phase shrinks the failing list. Done means it passes.

---

## 4. Phases (do them in this order; one commit/PR per phase; do not mix with other work)

### Phase 0: decisions applied and guard
Add the brand modules and the guard test (section 3). No behavior change.

### Phase 1: in-app text (low risk)
Replace every visible string in Appendix A, B, C, D, E and J (below) with the new name, using the brand constants where the string is code. Update the tests that assert old strings. Regenerate generated files (`src/components/vyzualz/cinema2/assets/Cinema2AssetManifest.generated.ts` comes from `scripts/cinema2-assets/`: change the **source** the generator reads, then regenerate; also edit `public/cinema2/attributions.json`, which is generated from the same source, so confirm which is the source before editing).
Categories (details in the appendices):
- sidebar logo text, auth page alt text, loading labels;
- Settings, Brand Kit, Appearance, DJ software panels;
- Output/casting text ("DRMVYZ Receivers" etc.), production output disclaimer;
- Headliner camera error messages;
- lyrics (extractor, recovery, draft-recovery error, seed data, JSON importer sample);
- media delete confirmation, music-analysis explanation strings, help center;
- preset names/descriptions/authors/default text (including the preset named "DRMVYZ Text Trace" and pad label "DRMVYZ"), store catalog authors ("DRMVYZ Studio");
- download file names in `src/hooks/useRecorder.ts` (`drmvyz-performance-…`, `drmvyz-capture-…`, `drmvyz-frame-…` become `stageless-…`);
- Supabase edge-function user messages (needs a **redeploy**: `supabase functions deploy`, see the Supabase CLI auth note in section 8).
**Careful:** the preset with id `preset-drmvyz-text-trace` keeps its **id** (stored in users' pads/favorites); only its `name`/`description`/`label` change.

### Phase 2: shell, window, installer and packaged-app identity (medium risk)
- `index.html`: `<title>` and meta description (currently `DRMVYZ // DVYDRM` and `DVYDRM music visualizer dashboard`).
- `package.json`: `build.productName` -> `STAGELESS`; `build.appId` -> a new id (suggest `com.stageless.app`; confirm with the owner what domain/identity to use); the three `extendInfo` permission strings; `description`; `author`. Leave `name` (`drmvyz`, the npm package name, not shown) unless the owner asks; if changed, check scripts and `node_modules/.cache` paths first.
- **Keep** `extendInfo.NSBonjourServices: ["_drmvyz-cast._tcp"]` (receiver contract, section 6).
- `electron/main.cjs`: `app.setName('DRMVYZ')`, the main window `title`, the mobile-preview/mobile-app-preview/layout-lab/lyric-layout/track-timeline window titles, the dev userData path name `DRMVYZ Development`, and the log line "another DRMVYZ instance…". Keep the window-name keys such as `'drmvyz-mobile-preview'` if they are internal ids (check, then keep).
- Popup titles in `src/components/vyzualz/layout/MobilePreviewLauncher.tsx`, `mobileAppPreview.ts`, `react/LayoutLabModal.tsx`, `react/trackTimeline/TrackTimelineModal.tsx`.
- `README.md`, `THIRD_PARTY_NOTICES.md`, `docs/desktop-launcher.md` where the name is user-facing.
- **Data-folder migration (section 5) lands in this phase, before the `productName`/`setName` change is merged.**
- **Dev launcher (section 5.6) must change in the same commit** as `setName`/dev shell naming.
- Artifact names come from `build.artifactName: ${productName}-${version}-${os}-${arch}.${ext}`, so they follow `productName` automatically.

### Phase 3: artwork (needs the owner's eyes)
- `public/drmvyz_logo2.png` and `public/drmvyz_logo_icon.png`: replace with STAGELESS artwork (file names are internal but the pictures show the old brand; keep or alias the file names so references do not break, see Appendix G for who references them). Need the new artwork from the owner.
- Preset artwork (`public/preset-artwork/*.webp`), `public/layout-lab`, `public/mockups`, wordmark 3D models (`public/cinema2/models/dvydrm-logo*.glb` and the shared logo asset used by the Go-To, Reliquary, Backstreet, Echowave, Mainframe, Conduit presets): **these may show the DVYDRM wordmark.** I could not inspect image text with search; each must be looked at. Replacing the 3D logo/wordmark needs new artwork or models from the owner; descriptions that say "The DVYDRM wordmark/logo…" (Backstreet, Go-To, Echowave, Mainframe, Conduit, Reliquary presets; see Appendix B) change with the artwork.
- App icon: already done (1.4).

### Phase 4: other shipped apps and services
- Android TV receiver: change only `android-tv-receiver/app/src/main/res/values/strings.xml` (`app_name`, `ready_title` currently "DRMVYZ Receiver" -> "STAGELESS Receiver"). **Do not** change `applicationId`/`namespace` `com.drmvyz.receiver`, the protocol name, or the discovery names (section 6).
- Supabase edge functions: `supabase/functions/lyric-transcription/index.ts` and `supabase/functions/_shared/vocalReference.ts` messages; also `supabase/functions/.env.example` comment. Redeploy.

### Phase 5: skipped by decision
Renaming technical identifiers is **not** being done (section 6). Do not start it.

### Phase 6: outside the repository (owner's task; list for the owner)
Supabase auth email templates / sender name / site URL (dashboard, not in repo); Google Cast app registration display name (the namespace id stays); code-signing and notarization identity names; domain, website, store listings; GitHub repository and local folder name. Also any images/screenshots/marketing material with the old name.

---

## 5. Data-folder migration design (the riskiest part; read carefully)

### 5.1 Why it is needed
Electron derives `app.getPath('userData')` (and `logs`, parts of `cache`) from the app name, which here comes from `app.setName('DRMVYZ')` and `build.productName`. Renaming makes the next launch use an empty `STAGELESS` folder, so the owner loses: the signed-in session, settings, Chromium local storage/IndexedDB (all saved favorites, appearance, drafts), the receiver identity file and trust store (`native/output/outputCastBridge.cjs` `RECEIVER_IDENTITY_FILENAME`, `native/output/drmvyzReceiverTrustStore.cjs` `TRUST_FILENAME`: casting devices would need to be re-paired), and the Rekordbox index store (`native/rekordbox/rekordboxUsbBridge.cjs`, folder `rekordbox-indexes`). Packaged paths:
- macOS: `~/Library/Application Support/DRMVYZ` -> `.../STAGELESS`; logs `~/Library/Logs/DRMVYZ` -> `.../STAGELESS`;
- Windows: `%APPDATA%\DRMVYZ` -> `%APPDATA%\STAGELESS`;
- Linux: `~/.config/DRMVYZ` -> `~/.config/STAGELESS`;
- Dev (unpackaged): `appData/DRMVYZ Development` -> `appData/STAGELESS Development` (set explicitly in `electron/main.cjs` line 35).

### 5.2 Algorithm (in `electron/main.cjs`, **before `app.whenReady()`**, right after `app.setName`)
1. Compute `oldDir` (old name) and `newDir` (new name) from `app.getPath('appData')`.
2. If `newDir` does not exist (or is empty) and `oldDir` exists and is a directory: move `oldDir` to `newDir` with `fs.renameSync` (same volume, atomic); if rename throws (cross-device, permission, locked), fall back to a recursive copy (`fs.cpSync(oldDir, newDir, {recursive:true})`), and only then mark success.
3. If the move/copy fails for any reason, **do not lose data**: call `app.setPath('userData', oldDir)` so the app keeps running on the old folder, and log a warning. Never delete `oldDir` after a copy in the same run; leave a marker file `migrated-to-STAGELESS.txt` in the old folder (or delete the old folder only on a later successful launch, after the app has run once from the new folder).
4. Write a small marker `.migration-v1` in `newDir` once finished so the logic is idempotent; if both folders exist and `newDir` has the marker, do nothing.
5. Do the same for the logs folder (`app.getPath('logs')`) and ignore failures there (logs are disposable).
6. Packaged and dev builds: the dev path is set explicitly; migrate `DRMVYZ Development` -> `STAGELESS Development` the same way.
7. Single-instance: the existing dev check ("another DRMVYZ instance owns the development profile") runs against the profile; keep the migration ahead of it and make sure two launches cannot migrate at once (take the lock first or let the first rename win; the second sees the marker).

### 5.3 Things inside the data folder to verify after the move
- Any file that stores an **absolute path** under the old folder would break after a move. Search `native/rekordbox/` (index store), `native/output/`, and the renderer for persisted absolute paths into `userData`. If found, rewrite on load or store relative paths.
- Chromium storage (Local Storage, IndexedDB, Session Storage, Cookies) moves with the folder and keeps working.
- **Cookies/keychain (macOS):** Chromium encrypts cookies using a Keychain item named after the app (`DRMVYZ Safe Storage`). After the rename the new item is `STAGELESS Safe Storage`, so previously encrypted cookies cannot be decrypted. The app does not use Electron `safeStorage` (no matches) and Supabase sessions are normally in Local Storage (not encrypted), so the impact should be small, but **verify the owner stays signed in** after migration; if not, sign-in once is acceptable.

### 5.4 appId change consequences (accepted)
`appId` (`com.dvydrm.drmvyz`) is the macOS bundle id and Windows AppUserModelID. Changing it: macOS asks again for microphone, camera and local-network permission once; an old installed app stays installed separately (no updater to replace it); Windows taskbar pins/notification settings reset; files named by the old id under `~/Library/{Preferences,Caches,Saved Application State,HTTPStorages}` become orphaned (harmless). Tell the owner about the permission re-prompt before the first run.

### 5.5 Testing the migration (required before merging Phase 2)
1. Unit-test the migration function with a temp directory tree: (a) only old exists -> moved, marker written; (b) both exist, marker present -> untouched; (c) rename throws -> copy used; (d) copy fails -> `setPath` falls back to old and no data removed; (e) idempotent second run; (f) new exists but empty -> migrate.
2. Manual: copy the owner's real `DRMVYZ`/`DRMVYZ Development` folder to a backup, run the renamed dev shell, confirm settings, sign-in, favorites and cast pairing survive, and that `rekordbox-indexes` still loads.
3. Keep the backup until the owner confirms.

### 5.6 Dev launcher: change together, or it breaks
`scripts/run-electron-dev.mjs` builds an isolated macOS dev shell named `DRMVYZ Dev.app` (cache dir `node_modules/.cache/drmvyz-electron/<electronVersion>/`) with bundle ids `com.dvydrm.drmvyz.dev` and helper ids `com.dvydrm.drmvyz.dev.helper{,.GPU,.Plugin,.Renderer}`, and sets `CFBundleName`/`CFBundleDisplayName` to `DRMVYZ Dev` (this is the name shown in the Dock). `scripts/electron-dev-processes.mjs` finds running instances with the regex `/\/DRMVYZ(?: Dev)?\.app\/Contents\/(?:MacOS|Frameworks)\//`. **Rename both in one commit** (`STAGELESS Dev.app`, new bundle ids, regex, console messages, `launch.command` text if any), or the launcher will fail to detect/close old instances. The environment variable names `DRMVYZ_VITE_DEV_SERVER_URL`, `DRMVYZ_*` stay (developer-facing, section 6). Also update `docs/desktop-launcher.md`. The old cached `DRMVYZ Dev.app` in `node_modules/.cache` becomes unused; the launcher rebuilds on demand.

---

## 6. Technical identifiers: DO NOT rename (and why)

Total uses of the preset id prefix `drmvyz.cinema2.`: about 416 in `src` and `supabase`.

| Identifier | Why it must stay | Visible to users? |
|---|---|---|
| Preset ids `drmvyz.cinema2.*` | Stored in saved shows, pads, favorites, text library; a database CHECK constraint lists them (e.g. `supabase/migrations/0046_...`, `0059_cinema2_paradox_text_scenes.sql`). Renaming makes presets "missing". | No |
| Storage keys (`drmvyz.reactPresetFavorites.v1`, `drmvyz:appearance:theme:v1`, other localStorage/IndexedDB names) | Renaming loses users' saved settings unless a shim copies old to new. | No |
| Receiver contract: Android `applicationId`/`namespace` `com.drmvyz.receiver`, protocol name `drmvyz-receiver`, `DRMVYZ_RECEIVER_PROTOCOL_*` constants, `DRMVYZ_CAST_RECEIVER` discovery magic, mDNS `_drmvyz-cast._tcp.` (also in `Info.plist` `NSBonjourServices`), header `X-DRMVYZ-Pairing-Token`, `drmvyz_receiver_v2_contract.json` | Desktop and receiver must match; renaming breaks old receivers and makes a new Android app. | Barely |
| Cast namespace `urn:x-cast:com.dvydrm.drmvyz.live` | Must match the Google Cast app registration. | No |
| Internal plumbing: IPC channels `drmvyz:*`, `window.drmvyzNative`, custom protocol `drmvyz-app://`, internal window keys, `DRMVYZ_*` env vars, `window.__DRMVYZ_*` test hooks | Preload and main must change together; no user value; regression risk. | No |
| Code names: functions, classes, constants (`DrmvyzReceiverProvider`, `registerDrmvyzWebGLContext`, ...), CSS font-family `DRMVYZ Anton`, tests, CSS/code comments, the repo folder, `docs/` | Invisible; large diff for no benefit. | No |
| npm package `name: "drmvyz"` | Not shown; paths in scripts depend on it. | No |

---

## 7. Appendices: inventory at time of writing (line numbers drift; re-run the commands)

Re-run to refresh (from the repo root):
```
grep -rInP "(?<![A-Za-z_.:-])DRMVYZ(?![A-Za-z_])" --exclude-dir=node_modules --exclude-dir=.git --include='*.ts' --include='*.tsx' --include='*.html' --include='*.cjs' --include='*.mjs' --include='*.json' src electron public index.html package.json
grep -rIn "DVYDRM" src electron index.html package.json public/cinema2/attributions.json supabase/functions
grep -rIn -i "drmvyz" android-tv-receiver/app/src/main/res android-tv-receiver/app/src/main/AndroidManifest.xml
```
(Exclude test files, comment lines and `.generated.ts` when reading; the guard test does this.)

### Appendix A: uppercase `DRMVYZ`, non-comment, non-test (candidates for visible text)
```
src/App.tsx:168: <Suspense fallback={<div className="auth-loading" role="status" aria-label="Loading DRMVYZ" />}>
src/App.tsx:182: <Suspense fallback={<div className="auth-loading" role="status" aria-label="Loading DRMVYZ" />}>
src/features/personalization/components/BrandKitSettingsPanel.tsx:392: <h2>Make DRMVYZ feel like your booth</h2>
src/features/personalization/components/BrandKitSettingsPanel.tsx:455: description="Use the Brand Kit primary color for selected DRMVYZ interface accents."
src/features/lyrics/components/AiLyricExtractor.tsx:1024: ? 'This track needs a fresh transcription-ready audio copy. Retry Extraction and DRMVYZ will prepare it locally before restarting the server job.'
src/features/lyrics/components/LyricRecoveryDialog.tsx:34: const message = `DRMVYZ found local lyric edits from ${new Date(recovery.lastEditAt).toLocaleString()}${conflict
src/features/appearance/AppearanceSettingsPanel.tsx:14: description: 'The current DRMVYZ cyan and emerald interface.',
src/features/appearance/AppearanceSettingsPanel.tsx:69: <p>Choose the standard UI surface and control palette used throughout DRMVYZ.</p>
src/features/models/materials/loadModelTexture.ts:4: const TEXTURE_NAME_PREFIX = 'DRMVYZ starter texture: '
src/features/musicIntelligence/offlineTrackAnalyzer.ts:833: ? ['Track Section boundaries sourced from validated Rekordbox PSSI; DRMVYZ semantic analysis preserved those boundaries.']
src/features/musicIntelligence/offlineTrackAnalyzer.ts:835: ? [`Rekordbox PSSI was not accepted for Track Section authority (${rekordboxSectionResult?.reason ?? 'validation failed'}); native DRMVYZ segmentation
src/features/musicIntelligence/rekordboxSectionAnalysis.ts:460: explanation: `Unrecognized Rekordbox phrase kind was interpreted from DRMVYZ contextual Audio Intelligence without changing its boundaries.`,
src/features/musicIntelligence/rekordboxSectionAnalysis.ts:581: boundaryRefinementReason: 'Rekordbox PSSI owns this region boundary; DRMVYZ semantic analysis is enrichment-only.',
src/stores/reactStore.ts:2334: throw new Error(`[DRMVYZ] Preset "${preset.id}" belongs to retired engine "${preset.engine}" and must resolve through Cinema compatibility migration.`
src/components/auth/AuthPage.tsx:107: alt="DRMVYZ"
src/components/vyzualz/VyzualzSidebarLayout.tsx:180: <span className="az-logo-mark">DRMVYZ</span>
src/components/vyzualz/settings/DjSoftwareSettingsPanel.tsx:141: <p>Select the DJ library provider DRMVYZ should use for track metadata.</p>
src/components/vyzualz/settings/DjSoftwareSettingsPanel.tsx:200: Library indexing requires the DRMVYZ desktop app.
src/components/vyzualz/settings/SettingsModal.tsx:292: `DRMVYZ diagnostics — ${new Date().toISOString()}`,
src/components/vyzualz/settings/SettingsModal.tsx:416: <p>Allow DRMVYZ to adjust quality inside the selected bounds.</p>
src/components/vyzualz/cinema2/presets/Cinema2PsyloPreset.ts:43: name: 'PSYLO', author: 'DRMVYZ; attributed mushroom sources (CC BY 4.0)',
src/components/vyzualz/cinema2/presets/Cinema2OpenDecksPreset.ts:54: author: 'DRMVYZ',
src/components/vyzualz/cinema2/presets/Cinema2NeonForestPreset.ts:43: name: 'NEON FOREST', author: 'DRMVYZ; Neon Stage by AnixMoon (CC BY 4.0)',
src/components/vyzualz/cinema2/presets/Cinema2WarOfWorldsPreset.ts:41: author: 'DRMVYZ; WAR OF THE TRIPODS by pinguinoconpulgares (CC BY 4.0)',
src/components/vyzualz/cinema2/presets/Cinema2ChamberPreset.ts:106: author: 'DRMVYZ. Original model by Rowan Design (CC BY 4.0).',
src/components/vyzualz/cinema2/presets/Cinema2GlassfallPreset.ts:24: metadata: { name: 'GLASSFALL', description: 'Raised luminous triangles above layered black panels. Six native programs, shared musical performance and
src/components/vyzualz/cinema2/presets/Cinema2SwitchItPreset.ts:24: metadata:{name:'Switch It',description:'A faceted portrait beneath a solid horned mask, with six native reveal programs and bounded musical performanc
src/components/vyzualz/layout/MobilePreviewLauncher.tsx:49: <iframe className="mobile-preview-app-frame" title="DRMVYZ sign-in on iPhone 16" src={mobileAppPreviewUrl(window.location, 'auth')} />
src/components/vyzualz/layout/MobilePreviewLauncher.tsx:78: popup.document.title = 'DRMVYZ — Mobile Preview'
src/components/vyzualz/layout/mobileAppPreview.ts:49: doc.title = 'DRMVYZ — Mobile App Preview'
src/components/vyzualz/layout/mobileAppPreview.ts:65: frame.title = 'DRMVYZ on iPhone 16'
src/components/vyzualz/presetManager/storeCatalog.ts:135: 'pack-midnight-signals': { author: 'DRMVYZ Studio', version: '1.2.0', category: 'Cinematic', tags: ['neon', 'atmospheric', 'night'], sizeMb: 184, lice
src/components/vyzualz/presetManager/storeCatalog.ts:136: 'pack-lumen-vault': { author: 'DRMVYZ Studio', version: '1.0.3', category: 'Cinematic', tags: ['glass', 'volumetric', 'architectural'], sizeMb: 266, l
src/components/vyzualz/presetManager/storeCatalog.ts:139: 'preset-prism-drift': { author: 'DRMVYZ Studio', version: '1.0.1', category: 'Cinematic', tags: ['refraction', 'fluid', 'organic'], sizeMb: 21, licens
src/components/vyzualz/presetManager/storeCatalog.ts:141: 'preset-monochrome-pulse': { author: 'DRMVYZ Studio', version: '1.3.0', category: 'Cinematic', tags: ['minimal', 'monochrome', 'pulse'], sizeMb: 9, li
src/components/vyzualz/presetManager/storeCatalog.ts:144: 'preset-echo-field': { author: 'DRMVYZ Studio', version: '1.1.0', category: 'Sound Drawing', tags: ['echo', 'concentric', 'melody'], sizeMb: 4, licens
src/components/vyzualz/react/ReactEnginePanel.tsx:878: placeholder="DRMVYZ"
src/components/vyzualz/react/ReactTypes.ts:1173: text:                'DRMVYZ',
src/components/vyzualz/react/ReactTypes.ts:4730: name: 'DRMVYZ Text Trace',
src/components/vyzualz/react/ReactTypes.ts:4731: description: 'The DRMVYZ logotype traced as a glyph path — dual trace with high glow.',
src/components/vyzualz/react/ReactTypes.ts:4739: text:              'DRMVYZ',
src/components/vyzualz/react/ReactTypes.ts:4841: { id: 'pad-14', presetId: 'preset-drmvyz-text-trace',      label: 'DRMVYZ',   color: '#b84fc9',      keyBinding: 'x', transitionTimeMs: 400 },
src/components/vyzualz/react/LayoutLabModal.tsx:25: popup.document.title = 'DRMVYZ — Layout Lab'
src/components/vyzualz/react/LaserDmxShowDirectorRigBackedImpactAtmospherePerformancePrograms.ts:637: 'All plume behavior is virtual DRMVYZ visualization and remains subordinate to final blackout authority.',
src/components/vyzualz/react/ReactCanvasEngineShell.tsx:4701: description="Original samples source color, Palette uses the DRMVYZ cyan/emerald palette, and Audio Reactive lets highs and bass recolor the particles
src/components/vyzualz/react/SoundDrawingTimelineLane.tsx:784: text:          sourceType === 'text' ? 'DRMVYZ' : '',
src/components/vyzualz/react/xyScope/XyScopeWorkspace.tsx:150: const list: SelectOption[] = [{ value: '', label: 'Anton (default)', style: { fontFamily: '"DRMVYZ Anton", sans-serif' } }]
src/components/vyzualz/react/xyScope/XyScopeSettings.ts:336: export const XY_SCOPE_DEFAULT_TEXT = 'DRMVYZ'
src/components/vyzualz/react/renderers/svgGlyphUtils.ts:940: console.warn('[DRMVYZ] parseSvgToGlyphPoints: No compilable shapes found — falling back to circle.')
src/components/vyzualz/react/renderers/svgGlyphUtils.ts:969: `[DRMVYZ] SVG compiler: discarded ${measured.length - filtered.length} tiny path(s)` +
src/components/vyzualz/react/renderers/svgGlyphUtils.ts:987: `[DRMVYZ] SVG compiler: capped to ${retained.length} paths` +
src/components/vyzualz/react/headliner/HeadlinerCameraRuntime.ts:95: return 'Camera access is restricted on this computer (for example by parental controls or a managed-device policy), so DRMVYZ cannot open it.'
src/components/vyzualz/react/headliner/HeadlinerCameraRuntime.ts:98: return 'Your system is blocking camera access for DRMVYZ. Turn DRMVYZ on in your system camera privacy settings, then quit and reopen DRMVYZ.'
src/components/vyzualz/react/headliner/HeadlinerCameraRuntime.ts:100: return 'Camera access was blocked. Allow DRMVYZ to use the camera in your system camera privacy settings, then try again.'
src/components/vyzualz/react/headliner/HeadlinerCameraRuntime.ts:110: return `DRMVYZ could not start the camera${errorName ? ` (${errorName})` : ''}.`
src/components/vyzualz/react/headliner/HeadlinerCameraRuntime.ts:519: message: 'The camera connection was lost. DRMVYZ is waiting to reconnect.',
src/components/vyzualz/react/output/ProductionOutputPanel.tsx:115: Address, overlap, profile, exclusion-zone, stale-frame, heartbeat, cooldown, and fail-dark checks are diagnostic safeguards only. DRMVYZ does not cert
src/components/vyzualz/react/output/OutputCastControl.tsx:503: throw new Error('This DRMVYZ build does not expose the Google Cast live media bridge')
src/components/vyzualz/react/output/OutputCastControl.tsx:929: <DrawerNotice tone="info" role="status" title="Desktop app required">Casting is available in the DRMVYZ desktop app. Browser builds keep the visualize
src/components/vyzualz/react/output/OutputCastControl.tsx:1002: <section className="rv-cast-device-category" aria-label="DRMVYZ receivers">
src/components/vyzualz/react/output/OutputCastControl.tsx:1003: <span className="rv-cast-device-category-hdr">DRMVYZ Receivers</span>
src/components/vyzualz/react/output/OutputCastControl.tsx:1004: {renderTargets(groups.network, 'No DRMVYZ receivers were found on this network.')}
src/components/vyzualz/react/output/OutputCastControl.tsx:1005: <p className="rv-cast-device-note">Open DRMVYZ on another computer to make it discoverable. Each Receiver V2 display is selectable independently; firs
src/components/vyzualz/react/layoutLab/AuthStudies.tsx:35: <span className="ll-auth-brand"><AppIcon kind="brand" size={26} /> DRMVYZ</span>
src/components/vyzualz/react/shaders/runtime/WebGLContextLifecycle.ts:145: `[WebGLContextLifecycle] duplicate DRMVYZ ownership for context ${record.id}: ` +
src/components/vyzualz/react/shaders/runtime/WebGLContextLifecycle.ts:286: '[WebGLContextLifecycle] DRMVYZ thumbnail context bound exceeded: ' +
src/components/vyzualz/react/shaders/runtime/WebGLContextLifecycle.ts:302: `[WebGLContextLifecycle] DRMVYZ context bound exceeded for ${ownership.role}: ` +
src/components/vyzualz/react/trackTimeline/TrackTimelineModal.tsx:53: popup.document.title = 'DRMVYZ — Track Timeline Visualizer'
src/components/vyzualz/media/MediaDeleteConfirmDialog.tsx:23: notice="Deleted media will not be available to use within DRMVYZ. Anywhere that the deleted media was present will show as missing media."
src/lib/lyricDraftRecovery.ts:215: request.onblocked = () => reject(new Error('Lyric recovery storage is blocked by another DRMVYZ window.'))
src/lib/lyricsSeed.ts:172: artist:       'DRMVYZ',
src/help/HelpCenter.ts:2774: "summary": "Chooses whether CANVAS particles use source colors, the DRMVYZ palette, or audio-reactive recoloring.",
src/help/HelpCenter.ts:6342: "whenToUse": "Use it to locate media for editing, selection, or assignment elsewhere in DRMVYZ.",
electron/main.cjs:34: app.setName('DRMVYZ')
electron/main.cjs:35: if (!app.isPackaged) app.setPath('userData', path.join(app.getPath('appData'), 'DRMVYZ Development'))
electron/main.cjs:135: title: 'DRMVYZ',
electron/main.cjs:162: 'drmvyz-mobile-preview': { width: 1200, height: 1000, minWidth: 800, minHeight: 960, title: 'DRMVYZ — Mobile Preview' },
electron/main.cjs:163: 'drmvyz-mobile-app-preview': { width: 449, height: 908, minWidth: 449, minHeight: 480, title: 'DRMVYZ — Mobile App Preview' },
electron/main.cjs:176: ? { title: 'DRMVYZ — Layout Lab', backgroundColor: '#060d10' }
electron/main.cjs:178: ? { title: 'DRMVYZ — Lyric Manager Layout', backgroundColor: '#060d10' }
electron/main.cjs:180: ? { title: 'DRMVYZ — Track Timeline Visualizer', backgroundColor: '#090d0f' }
electron/main.cjs:229: log.scope('system:app').warn('another DRMVYZ instance owns the development profile; focusing it instead')
public/cinema2/attributions.json:15: "attribution": "Crystal by Zambur (https://sketchfab.com/Zambur), https://sketchfab.com/3d-models/crystal-ba43c7bbcca143c8ad2f77f5841b39de, licensed C
public/cinema2/attributions.json:148: "attribution": "Need some space? by Loïc Norgeot (https://sketchfab.com/norgeotloic). Source: https://sketchfab.com/3d-models/need-some-space-d6521362
public/cinema2/attributions.json:176: "attribution": "Derived from Neon Stage by AnixMoon (https://sketchfab.com/ani111), https://sketchfab.com/3d-models/neon-stage-6037d87967fc4acf8e8ba1d
public/cinema2/attributions.json:190: "attribution": "Derived from Pretty simple discoball by pan.stasian (https://sketchfab.com/3d-models/pretty-simple-discoball-6b1921865be14de982f948304
public/cinema2/attributions.json:197: "attribution": "OPEN DECKS CDJ model: DRMVYZ. Full-device illustration extended with built-in image_gen from the owner-supplied illustration and CDJ l
public/cinema2/attributions.json:204: "attribution": "Abstract sphere by deecube1 (https://sketchfab.com/deecube1), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Source: https:
public/cinema2/attributions.json:211: "attribution": "Derived from Stylized mushrooms by QumoDone (https://sketchfab.com/3d-models/stylized-mushrooms-9d22e02ce2a548959b1c4c4c1d546842), Sty
public/cinema2/attributions.json:281: "attribution": "WAR OF THE TRIPODS by pinguinoconpulgares (https://sketchfab.com/pinguinoconpulgares), https://sketchfab.com/3d-models/war-of-the-trip
public/cinema2/attributions.json:288: "attribution": "WAR OF THE TRIPODS by pinguinoconpulgares (https://sketchfab.com/pinguinoconpulgares), https://sketchfab.com/3d-models/war-of-the-trip
public/cinema2/attributions.json:302: "attribution": "Demon Mask by egorova.e (https://sketchfab.com/silentegor), https://sketchfab.com/3d-models/demon-mask-e8f1ddf1cd344a50bdb4a30beaff833
index.html:6: <title>DRMVYZ // DVYDRM</title>
package.json:168: "productName": "DRMVYZ",
package.json:191: "NSMicrophoneUsageDescription": "DRMVYZ uses the default microphone only when you select Live Input for realtime analysis.",
package.json:192: "NSLocalNetworkUsageDescription": "DRMVYZ uses the local network to discover and connect to receivers and to stream output to local casting devices yo
package.json:196: "NSCameraUsageDescription": "DRMVYZ uses the camera only when you open Headliner to display the camera feed in your visual performance.",
android-tv-receiver/app/src/main/res/values/strings.xml:3: <string name="app_name">DRMVYZ Receiver</string>
android-tv-receiver/app/src/main/res/values/strings.xml:4: <string name="ready_title">DRMVYZ Receiver</string>
supabase/functions/lyric-transcription/index.ts:1208: `This WAV file could not be split safely on the server.${detail} Retry from DRMVYZ so it can prepare a private transcription-ready audio copy.`,
supabase/functions/lyric-transcription/index.ts:1649: 'This track needs local audio preparation before transcription. Retry from DRMVYZ so it can create private transcription-ready audio chunks.',
supabase/functions/lyric-transcription/index.ts:1677: 'This track needs local audio preparation before transcription. Retry from DRMVYZ so it can create private transcription-ready audio chunks.',
supabase/functions/lyric-transcription/index.ts:1693: 'This track needs local audio preparation before transcription. Retry from DRMVYZ so it can create a private transcription-ready audio copy.',
supabase/functions/_shared/vocalReference.ts:69: reason: 'DRMVYZ cannot verify arrangement length from the available metadata. Review the selected tracks and timing offset before extraction.',
native/rekordbox/rekordboxUsbBridge.cjs:243: warnings.push('export.pdb was found, but the optional rekordbox-parser module is not installed. DRMVYZ parsed ANLZ cue and beat-grid files directly in
native/output/outputCastBridge.cjs:74: console.warn('[DRMVYZ Output] Could not persist receiver identity; discovery identity will change after restart:', error)
native/output/outputCastBridge.cjs:259: <title>DRMVYZ Output</title>
native/output/outputCastBridge.cjs:318: message: 'Windows Display settings opened. Use Connect under Multiple displays to choose a wireless display; DRMVYZ will detect the display Windows ad
native/output/outputCastBridge.cjs:342: message: `${candidate.label} opened. Use Screen Mirroring or display extension there; DRMVYZ will detect any display macOS connects.`,
native/output/outputCastBridge.cjs:376: title: 'Pair DRMVYZ Receiver',
native/output/outputCastBridge.cjs:377: message: `Allow ${senderName} to cast to this DRMVYZ receiver?`,
native/output/outputCastBridge.cjs:446: reject(new Error('Could not bind the DRMVYZ output service'))
native/output/outputCastBridge.cjs:466: console.warn(`[DRMVYZ Output] Could not deliver ${channel} to a renderer:`, error)
native/output/outputCastBridge.cjs:484: title: 'DRMVYZ Output',
native/output/outputCastBridge.cjs:691: name: `${os.hostname()} · DRMVYZ`,
native/output/outputCastBridge.cjs:811: error: `DRMVYZ Receiver V${DRMVYZ_RECEIVER_PROTOCOL_VERSION} session protocol is required`,
native/output/outputCastBridge.cjs:827: if (!Number.isInteger(port) || port <= 0 || port > 65_535) throw new Error('Could not bind the DRMVYZ output service')
native/output/outputCastBridge.cjs:1030: console.error('[DRMVYZ Output] Provider initialization failed:', error)
native/output/outputCastBridge.cjs:1038: console.error('[DRMVYZ Output] Local display relay failed to start:', error)
native/output/outputCastBridge.cjs:1050: console.error('[DRMVYZ Output] Network casting service failed to start:', error)
native/output/drmvyzReceiverProtocol.cjs:67: if (!isValidDeviceId(deviceId)) throw new Error('Invalid DRMVYZ receiver device id')
native/output/drmvyzReceiverProtocol.cjs:69: if (normalizedDisplays.length === 0) throw new Error('DRMVYZ receiver has no selectable displays')
native/output/drmvyzReceiverProtocol.cjs:79: name: cleanString(name, 160) || 'DRMVYZ Receiver',
native/output/drmvyzReceiverProtocol.cjs:103: throw new Error(`Receiver protocol is incompatible; DRMVYZ Receiver V${DRMVYZ_RECEIVER_PROTOCOL_VERSION} is required`)
native/output/drmvyzReceiverProtocol.cjs:116: name: cleanString(value.device.name, 160) || 'DRMVYZ Receiver',
native/output/drmvyzReceiverProtocol.cjs:164: senderName: senderName || 'DRMVYZ Sender',
native/output/drmvyzReceiverTrustStore.cjs:76: console.warn('[DRMVYZ Output] Could not persist receiver trust:', error)
native/output/google-cast/sender/index.html:6: <title>DRMVYZ Google Cast Sender</title>
native/output/google-cast/sender/index.html:22: <p>Use the Cast button below. Keep this secure browser page open while DRMVYZ is casting; the browser owns the supported Google Cast sender session.</
native/output/google-cast/sender/index.html:79: setStatus(`DRMVYZ connection failed: ${error instanceof Error ? error.message : 'local callback unavailable'}`)
native/output/google-cast/sender/index.html:96: if (!response.ok) throw new Error(`DRMVYZ returned HTTP ${response.status}`)
native/output/google-cast/sender/index.html:100: setStatus(`Waiting for DRMVYZ: ${error instanceof Error ? error.message : 'local control unavailable'}`)
native/output/google-cast/sender/index.html:109: setStatus('Starting live DRMVYZ output…')
native/output/google-cast/sender/index.html:124: setStatus('Connected — DRMVYZ live output is playing.')
native/output/google-cast/sender/index.html:147: setStatus(`Selected ${device?.friendlyName || 'Google Cast device'} — waiting for DRMVYZ live media…`)
native/output/google-cast/sender/index.html:164: setStatus('This Google Cast sender link is invalid or incomplete. Return to DRMVYZ and try again.')
native/output/google-cast/receiver/index.html:6: <title>DRMVYZ Google Cast Receiver</title>
native/output/google-cast/receiver/index.html:15: <p id="status" role="status">Waiting for DRMVYZ…</p>
native/output/google-cast/receiver/index.html:57: setStatus('Waiting for DRMVYZ…')
native/output/google-cast/receiver/index.html:80: reject(new Error('Timed out while opening the DRMVYZ live stream'))
native/output/google-cast/receiver/index.html:90: send(senderId, { type: 'error', sessionId, message: 'DRMVYZ sent invalid live media metadata.' })
native/output/google-cast/receiver/index.html:103: send(senderId, { type: 'error', sessionId, message: 'DRMVYZ did not provide a valid private-network live media route.' })
native/output/google-cast/receiver/index.html:114: setStatus('Opening DRMVYZ live output…')
native/output/google-cast/receiver/index.html:122: setStatus('DRMVYZ live output')
native/output/google-cast/receiver/index.html:133: const messageText = lastError instanceof Error ? lastError.message : 'The Cast receiver could not reach DRMVYZ live media.'
native/output/providers/drmvyzReceiverProvider.cjs:49: return name || 'DRMVYZ Receiver'
native/output/providers/drmvyzReceiverProvider.cjs:83: if (!normalized) throw new Error('Invalid DRMVYZ discovery advertisement')
native/output/providers/drmvyzReceiverProvider.cjs:88: if (payload.length > DISCOVERY_MAX_PAYLOAD_BYTES) throw new Error('DRMVYZ discovery advertisement is too large')
native/output/providers/drmvyzReceiverProvider.cjs:293: throw new Error('Invalid DRMVYZ mDNS advertisement')
native/output/providers/drmvyzReceiverProvider.cjs:313: if (packet.length > MDNS_MAX_PACKET_BYTES) throw new Error('DRMVYZ mDNS advertisement is too large')
native/output/providers/drmvyzReceiverProvider.cjs:384: senderName = () => `${hostname()} · DRMVYZ`,
native/output/providers/drmvyzReceiverProvider.cjs:387: this.label = 'DRMVYZ Receivers'
native/output/providers/drmvyzReceiverProvider.cjs:439: this.receiverServiceError = classifyDiscoveryError(error, 'DRMVYZ receiver service')
native/output/providers/drmvyzReceiverProvider.cjs:502: if (response.status === 426) throw new Error(`Receiver protocol is incompatible; DRMVYZ Receiver V${DRMVYZ_RECEIVER_PROTOCOL_VERSION} is required`)
native/output/providers/drmvyzReceiverProvider.cjs:560: if (response.status === 426) throw new Error(`Receiver protocol is incompatible; DRMVYZ Receiver V${DRMVYZ_RECEIVER_PROTOCOL_VERSION} is required`)
native/output/providers/drmvyzReceiverProvider.cjs:674: this.mdnsError = classifyDiscoveryError(mdnsResult.reason, 'DRMVYZ local service discovery')
native/output/providers/drmvyzReceiverProvider.cjs:680: this.legacyError = classifyDiscoveryError(legacyResult.reason, 'DRMVYZ UDP compatibility discovery')
native/output/providers/drmvyzReceiverProvider.cjs:696: this.mdnsError = classifyDiscoveryError(error, 'DRMVYZ local service discovery')
native/output/providers/drmvyzReceiverProvider.cjs:744: this.legacyError = classifyDiscoveryError(error, 'DRMVYZ UDP compatibility discovery')
native/output/providers/drmvyzReceiverProvider.cjs:895: name: `${this.hostname()} · DRMVYZ`,
native/output/providers/drmvyzReceiverProvider.cjs:913: name: `${this.hostname()} · DRMVYZ`,
native/output/providers/drmvyzReceiverProvider.cjs:933: if (!receiverId || !displayId) throw new Error(`Select a DRMVYZ Receiver V${DRMVYZ_RECEIVER_PROTOCOL_VERSION} display before casting`)
native/output/providers/macosAirPlayProvider.cjs:69: message: result?.message ?? 'macOS display controls opened. Connect with Screen Mirroring or extend the display; DRMVYZ will list the resulting system
native/output/providers/googleCastProvider.cjs:165: message: 'Google Cast is waiting for the local DRMVYZ media/control service to start.',
native/output/providers/windowsMiracastProvider.cjs:69: message: result?.message ?? 'Windows Display settings opened. Connect to a wireless display there; DRMVYZ will list the resulting Windows display auto
scripts/run-electron-dev.mjs:58: console.error('[electron:dev] Checking for running DRMVYZ instances...')
scripts/run-electron-dev.mjs:68: console.error(`[electron:dev] Closing running DRMVYZ (${runningApps.length} process(es)) before relaunch.`)
scripts/run-electron-dev.mjs:74: if (remaining.length) throw new Error(`Could not close DRMVYZ process(es): ${remaining.map(app => app.pid).join(', ')}. Quit DRMVYZ and launch again.`
scripts/run-electron-dev.mjs:76: console.error('[electron:dev] No running DRMVYZ instance found.')
scripts/run-electron-dev.mjs:97: console.error(`[electron:dev] Stopping DRMVYZ Vite server left over on port ${devPort} (pid ${owned.map(item => item.pid).join(', ')}).`)
scripts/run-electron-dev.mjs:129: const appPath = path.join(cacheRoot, 'DRMVYZ Dev.app')
scripts/run-electron-dev.mjs:135: const stagingPath = path.join(cacheRoot, `DRMVYZ Dev.app.preparing-${process.pid}`)
scripts/run-electron-dev.mjs:137: console.error('[electron:dev] Preparing the isolated DRMVYZ macOS development shell...')
scripts/run-electron-dev.mjs:156: setPlistValue(mainPlist, 'CFBundleName', 'DRMVYZ Dev')
scripts/run-electron-dev.mjs:157: setPlistValue(mainPlist, 'CFBundleDisplayName', 'DRMVYZ Dev')
scripts/validate-fluidity-browser.mjs:40: ctx.fillStyle = '#fff'; ctx.font = 'bold 96px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('DRMVYZ', 320, 209)
scripts/browser-audio-intelligence-golden.mjs:54: All decoding, beat-grid, pitch, harmonic, structural, curve, and waveform analysis runs inside Chromium through DRMVYZ production analyzers.`
scripts/electron-dev-processes.mjs:12: const packaged = /\/DRMVYZ(?: Dev)?\.app\/Contents\/(?:MacOS|Frameworks)\//.test(executable)
scripts/validate-terminal-browser.mjs:34: ctx.fillStyle = '#4ae6cf'; ctx.font = 'bold 64px sans-serif'; ctx.fillText('DRMVYZ', 38, 132)
scripts/validate-vhs-browser.mjs:41: o.fillStyle = '#f0e5dc'; o.font = 'bold 56px monospace'; o.textAlign = 'center'; o.fillText('DRMVYZ / VHS', 320, 174)
scripts/browser-audio-intelligence-batch.mjs:101: The command starts Vite and Chromium once, then runs DRMVYZ's production
scripts/browser-audio-intelligence-batch.mjs:436: '[audio-batch] DRMVYZ Audio Intelligence Batch',
scripts/verify-mobile-preview.mjs:80: options=await app.evaluate(({BrowserWindow})=>{const child=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='DRMVYZ — Mobile Preview');return {siz
scripts/cinema2-assets/build-nightshift-runtime.mjs:118: Object.assign(doc.getRoot().getAsset(), { version: '2.0', generator: 'DRMVYZ NIGHTSHIFT static-core builder', extras: {
scripts/cinema2-assets/pack-event-horizon-space.mjs:54: asset: { ...json.asset, extras: { ...json.asset.extras, modifiedBy: 'DRMVYZ: positions quantized to 16 bits (KHR_mesh_quantization) and colors to 8 bi
scripts/cinema2-assets/generate-atl-hoe.mjs:1055: const result = writeGlb(outputPath, meshes, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-atl-hoe.mjs', 'atl-hoe')
scripts/cinema2-assets/prepare-orbital-sphere.mjs:22: await writeFile(path.join('assets/cinema2',id,'asset.json'),JSON.stringify({id,kind:'model',compression:'none',license:'CC-BY-4.0',attribution:'Abstra
scripts/cinema2-assets/generate-dvydrm-logo.mjs:185: asset: { version: '2.0', generator: 'DRMVYZ scripts/cinema2-assets/generate-dvydrm-logo.mjs' },
scripts/cinema2-assets/generate-conduit-wordmark.mjs:261: const result = writeGlb(outputPath, meshes, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-conduit-wordmark.mjs', 'conduit-wordmark')
scripts/cinema2-assets/generate-golden-roots.mjs:263: const { triangles, byteLength, parts } = writeGlb(outputPath, merged, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-golden-roots.mjs', 'golden-ro
scripts/cinema2-assets/generate-atmosphere-monoliths.mjs:412: const { triangles, byteLength, parts } = writeGlb(outputPath, meshes, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-atmosphere-monoliths.mjs', 'a
scripts/cinema2-assets/build-neon-forest-runtime.mjs:104: Object.assign(doc.getRoot().getAsset(),{generator:'DRMVYZ NEON FOREST',extras:{source:source.getRoot().getAsset().extras,sha256,modifications:'Affine 
scripts/cinema2-assets/generate-conduit-chamber.mjs:425: const result = writeGlb(outputPath, meshes, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-conduit-chamber.mjs', 'conduit-chamber')
scripts/cinema2-assets/generate-conduit-tubes.mjs:327: const result = writeGlb(outputPath, meshes, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-conduit-tubes.mjs', 'conduit-tubes')
scripts/cinema2-assets/generate-mainframe.mjs:566: const result = writeGlb(outputPath, meshes, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-mainframe.mjs', 'mainframe')
scripts/cinema2-assets/generate-open-decks.mjs:375: asset: { version: '2.0', generator: 'DRMVYZ scripts/cinema2-assets/generate-open-decks.mjs' },
scripts/cinema2-assets/generate-reliquary-trees.mjs:297: const { triangles, byteLength, parts } = writeGlb(outputPath, merged, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-reliquary-trees.mjs', 'reliqu
scripts/cinema2-assets/generate-say-it-glyphs.mjs:209: localFontPath ? `DRMVYZ local glyph preview (${family})` : 'DRMVYZ scripts/cinema2-assets/generate-say-it-glyphs.mjs (Anton Regular, OFL-1.1)',
scripts/cinema2-assets/build-psylo-runtime.mjs:210: const extras = { phase: 1, generator: 'DRMVYZ PSYLO static-core builder', modification: 'Selected source geometry normalized and grounded; source pres
scripts/cinema2-assets/build-psylo-runtime.mjs:211: Object.assign(doc.getRoot().getAsset(), { generator: 'DRMVYZ PSYLO Phase 1', extras })
scripts/cinema2-assets/accept-switch-it-phase2.mjs:34: const html=`<html><head><meta charset="UTF-8"><link rel="icon" href="data:,"></head><body style="margin:0;background:#080c10;color:#ccd3d5"><main styl
scripts/cinema2-assets/generate-backstreet.mjs:332: const { triangles, byteLength, parts } = writeGlb(outputPath, [tubes, clips, wall], MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-backstreet.mjs'
scripts/cinema2-assets/accept-switch-it-phase1.mjs:27: const html = `<html><head><link rel="icon" href="data:,"></head><body style="margin:0;background:#05060a;color:#ddd;font:14px system-ui"><nav style="p
```

### Appendix B: `DVYDRM` (visible strings, non-comment, non-test)
```
src/features/lyrics/components/JsonLyricImporter.tsx:21: "title": "Stolen Dreams", "artist": "DVYDRM",
src/components/vyzualz/cinema2/presets/Cinema2GoToPreset.ts:27: import { CINEMA2_DVYDRM_LOGO_ASSET_ID } from '../modules/three/Cinema2ThreeAssetManifest'
src/components/vyzualz/cinema2/presets/Cinema2GoToPreset.ts:253: description: 'The DVYDRM logo as a glossy pearl-white cloud in a thin polished gold outline, slowly turning on a turntable in a dark, hazy studio. Sof
src/components/vyzualz/cinema2/presets/Cinema2GoToPreset.ts:301: instances: Object.freeze([Object.freeze({ asset: CINEMA2_DVYDRM_LOGO_ASSET_ID, node: CINEMA2_GO_TO_LOGO_NODE_ID, spin: true })]),
src/components/vyzualz/cinema2/presets/Cinema2EchowavePreset.ts:25: [/Echoform GOONZ SVG Figure/g, 'Echowave DVYDRM Wordmark'],
src/components/vyzualz/cinema2/presets/Cinema2EchowavePreset.ts:55: description: 'The DVYDRM wordmark rebuilt from its own vector outlines as a scanned point cloud: a cyan outline ring, blue wire contours and a triangu
src/components/vyzualz/cinema2/presets/Cinema2BlockshiftPreset.ts:63: metadata: { name: 'BLOCKSHIFT', description: 'Float inside a surrounding field of massive Hallow Cubes and a deeper Impossible Cube.', author: 'DVYDRM
src/components/vyzualz/cinema2/presets/Cinema2BackstreetPreset.ts:302: description: 'The DVYDRM wordmark as a white neon sign, an outline in glass tube, hung on a black painted brick wall and driven by the same audio inte
src/components/vyzualz/cinema2/presets/Cinema2MainframePreset.ts:198: description: 'Zooms the extended modeled Mainframe wall about the centre of the DVYDRM logo without changing glow width or timing.',
src/components/vyzualz/cinema2/presets/Cinema2MainframePreset.ts:362: description: 'The DVYDRM cloud embedded in a dark, physically modeled circuit-board wall with raised luminous traces, radar modules, chips and indicat
src/components/vyzualz/cinema2/presets/Cinema2ConduitPreset.ts:494: description: 'The DVYDRM wordmark held in a silver sci-fi chamber by four chrome tubes that carry energy into it. Semantic LED routes flow, chase, spl
src/components/vyzualz/cinema2/presets/Cinema2ReliquaryPreset.ts:29: import { CINEMA2_DVYDRM_LOGO_FACETED_ASSET_ID, CINEMA2_GOLDEN_ROOTS_ASSET_ID, CINEMA2_RELIQUARY_TREES_ASSET_ID } from '../modules/three/Cinema2ThreeAs
src/components/vyzualz/cinema2/presets/Cinema2ReliquaryPreset.ts:473: description: 'The DVYDRM logo as clear cut crystal held by a golden tree, between dark trees wrapped in glowing gold vines. Six overhead spots chase a
src/components/vyzualz/cinema2/presets/Cinema2ReliquaryPreset.ts:544: Object.freeze({ asset: CINEMA2_DVYDRM_LOGO_FACETED_ASSET_ID, node: CINEMA2_RELIQUARY_LOGO_NODE_ID }),
src/components/vyzualz/cinema2/modules/three/Cinema2ThreeAssetManifest.ts:7: export const CINEMA2_DVYDRM_LOGO_ASSET_ID: Cinema2AssetId = 'cinema2-dvydrm-logo'
src/components/vyzualz/cinema2/modules/three/Cinema2ThreeAssetManifest.ts:9: export const CINEMA2_DVYDRM_LOGO_FACETED_ASSET_ID: Cinema2AssetId = 'cinema2-dvydrm-logo-faceted'
src/components/vyzualz/react/ReactTypes.ts:3779: export const DVYDRM_CYAN   = '#4ac7db'
src/components/vyzualz/react/ReactTypes.ts:3780: export const DVYDRM_EMERALD = '#61d6aa'
src/components/vyzualz/react/ReactTypes.ts:3781: export const DVYDRM_BLACK  = '#060d10'
src/components/vyzualz/react/ReactTypes.ts:3782: export const DVYDRM_WHITE  = '#e8f4f8'
src/components/vyzualz/react/ReactTypes.ts:3783: export const DVYDRM_GOLD   = '#d8b95a'
src/components/vyzualz/react/ReactTypes.ts:3784: export const DVYDRM_CRIMSON = '#c0314a'
src/components/vyzualz/react/ReactTypes.ts:3800: secondary:  DVYDRM_CYAN,
src/components/vyzualz/react/ReactTypes.ts:3801: accent:     DVYDRM_GOLD,
src/components/vyzualz/react/ReactTypes.ts:3803: highlight:  DVYDRM_CRIMSON,
src/components/vyzualz/react/ReactTypes.ts:3804: text:       DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:3808: primary:    DVYDRM_EMERALD,
src/components/vyzualz/react/ReactTypes.ts:3809: secondary:  DVYDRM_CYAN,
src/components/vyzualz/react/ReactTypes.ts:3810: accent:     DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:3811: background: DVYDRM_BLACK,
src/components/vyzualz/react/ReactTypes.ts:3812: highlight:  DVYDRM_GOLD,
src/components/vyzualz/react/ReactTypes.ts:3813: text:       DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:3820: secondary:  DVYDRM_CRIMSON,
src/components/vyzualz/react/ReactTypes.ts:3824: text:       DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:3830: accent:     DVYDRM_CYAN,
src/components/vyzualz/react/ReactTypes.ts:3833: text:       DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:3837: primary:    DVYDRM_EMERALD,
src/components/vyzualz/react/ReactTypes.ts:3838: secondary:  DVYDRM_CYAN,
src/components/vyzualz/react/ReactTypes.ts:3842: text:       DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:3846: primary:    DVYDRM_GOLD,
src/components/vyzualz/react/ReactTypes.ts:3848: accent:     DVYDRM_CYAN,
src/components/vyzualz/react/ReactTypes.ts:3849: background: DVYDRM_BLACK,
src/components/vyzualz/react/ReactTypes.ts:3851: text:       DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:3855: primary:    DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:3856: secondary:  DVYDRM_CYAN,
src/components/vyzualz/react/ReactTypes.ts:3857: accent:     DVYDRM_EMERALD,
src/components/vyzualz/react/ReactTypes.ts:3858: background: DVYDRM_BLACK,
src/components/vyzualz/react/ReactTypes.ts:3860: text:       DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:3865: secondary:  DVYDRM_CYAN,
src/components/vyzualz/react/ReactTypes.ts:3866: accent:     DVYDRM_GOLD,
src/components/vyzualz/react/ReactTypes.ts:3867: background: DVYDRM_BLACK,
src/components/vyzualz/react/ReactTypes.ts:3869: text:       DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:3873: primary:    DVYDRM_GOLD,
src/components/vyzualz/react/ReactTypes.ts:3874: secondary:  DVYDRM_CRIMSON,
src/components/vyzualz/react/ReactTypes.ts:3876: background: DVYDRM_BLACK,
src/components/vyzualz/react/ReactTypes.ts:3878: text:       DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:3882: primary:    DVYDRM_CYAN,
src/components/vyzualz/react/ReactTypes.ts:3883: secondary:  DVYDRM_EMERALD,
src/components/vyzualz/react/ReactTypes.ts:3884: accent:     DVYDRM_GOLD,
src/components/vyzualz/react/ReactTypes.ts:3887: text:       DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:3891: primary:    DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:3892: secondary:  DVYDRM_CYAN,
src/components/vyzualz/react/ReactTypes.ts:3894: background: DVYDRM_BLACK,
src/components/vyzualz/react/ReactTypes.ts:3896: text:       DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:3903: background: DVYDRM_BLACK,
src/components/vyzualz/react/ReactTypes.ts:3905: text:       DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:3942: primary: DVYDRM_CYAN,
src/components/vyzualz/react/ReactTypes.ts:3944: accent: DVYDRM_GOLD,
src/components/vyzualz/react/ReactTypes.ts:3947: text: DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:3983: text: DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:4014: primary: DVYDRM_EMERALD,
src/components/vyzualz/react/ReactTypes.ts:4019: text: DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:4052: primary: DVYDRM_CYAN,
src/components/vyzualz/react/ReactTypes.ts:4054: accent: DVYDRM_GOLD,
src/components/vyzualz/react/ReactTypes.ts:4057: text: DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:4087: secondary: DVYDRM_CYAN,
src/components/vyzualz/react/ReactTypes.ts:4091: text: DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:4122: accent: DVYDRM_EMERALD,
src/components/vyzualz/react/ReactTypes.ts:4125: text: DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:4161: text: DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:4190: primary: DVYDRM_CRIMSON,
src/components/vyzualz/react/ReactTypes.ts:4192: accent: DVYDRM_GOLD,
src/components/vyzualz/react/ReactTypes.ts:4195: text: DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:4225: secondary: DVYDRM_EMERALD,
src/components/vyzualz/react/ReactTypes.ts:4226: accent: DVYDRM_CYAN,
src/components/vyzualz/react/ReactTypes.ts:4229: text: DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:4260: palette: { primary: '#6ee8ff', secondary: '#3e4eaa', accent: '#ffffff', background: '#010208', highlight: '#dffbff', text: DVYDRM_WHITE },
src/components/vyzualz/react/ReactTypes.ts:4282: palette: { primary: '#f26bff', secondary: '#3e9cff', accent: '#72ffd8', background: '#020106', highlight: '#ffe8ff', text: DVYDRM_WHITE },
src/components/vyzualz/react/ReactTypes.ts:4304: palette: { primary: '#e5edf5', secondary: '#375b64', accent: '#8df5d2', background: '#010303', highlight: '#ffffff', text: DVYDRM_WHITE },
src/components/vyzualz/react/ReactTypes.ts:4328: palette: { primary: '#d5b66d', secondary: '#33454b', accent: '#66e2d4', background: '#020403', highlight: '#fff0b5', text: DVYDRM_WHITE },
src/components/vyzualz/react/ReactTypes.ts:4351: palette: { primary: '#ff8d3b', secondary: '#8f1f20', accent: '#ffe37c', background: '#070201', highlight: '#fff4c4', text: DVYDRM_WHITE },
src/components/vyzualz/react/ReactTypes.ts:4376: palette: { primary: '#9da9b5', secondary: '#26363b', accent: '#7a8dff', background: '#010203', highlight: '#e9f1ff', text: DVYDRM_WHITE },
src/components/vyzualz/react/ReactTypes.ts:4401: palette: { primary: '#6aaeff', secondary: '#27395c', accent: '#d8f2ff', background: '#010309', highlight: '#ffffff', text: DVYDRM_WHITE },
src/components/vyzualz/react/ReactTypes.ts:4424: palette: { primary: '#b9e8ff', secondary: '#5f33a8', accent: '#ffffff', background: '#02020a', highlight: '#ffffff', text: DVYDRM_WHITE },
src/components/vyzualz/react/ReactTypes.ts:4447: palette: { primary: '#aeb9bb', secondary: '#3a3b40', accent: '#cc784d', background: '#020202', highlight: '#e9e4df', text: DVYDRM_WHITE },
src/components/vyzualz/react/ReactTypes.ts:4472: palette: { primary: '#4aa7ff', secondary: '#735cff', accent: '#c9e7ff', background: '#000000', highlight: '#edf7ff', text: DVYDRM_WHITE },
src/components/vyzualz/react/ReactTypes.ts:4491: palette: { primary: '#74f5ff', secondary: '#74f5ff', accent: '#ffffff', background: '#000000', highlight: '#ffffff', text: DVYDRM_WHITE },
src/components/vyzualz/react/ReactTypes.ts:4510: palette: { primary: '#21d8e8', secondary: '#ef4aa8', accent: '#d8ad55', background: '#01040b', highlight: '#e8fbff', text: DVYDRM_WHITE },
src/components/vyzualz/react/ReactTypes.ts:4534: palette: { primary: '#4ac7db', secondary: '#7857ff', accent: '#d8f7ff', background: '#01050d', highlight: '#61d6aa', text: DVYDRM_WHITE },
src/components/vyzualz/react/ReactTypes.ts:4557: palette: { primary: '#61d6aa', secondary: '#1b6f79', accent: '#d8b95a', background: '#020906', highlight: '#b7ffe4', text: DVYDRM_WHITE },
src/components/vyzualz/react/ReactTypes.ts:4580: palette: { primary: '#ff5c78', secondary: '#b84fc9', accent: '#ffd36a', background: '#090108', highlight: '#fff0c2', text: DVYDRM_WHITE },
src/components/vyzualz/react/ReactTypes.ts:4616: primary:    DVYDRM_EMERALD,
src/components/vyzualz/react/ReactTypes.ts:4617: secondary:  DVYDRM_CYAN,
src/components/vyzualz/react/ReactTypes.ts:4618: accent:     DVYDRM_GOLD,
src/components/vyzualz/react/ReactTypes.ts:4619: background: DVYDRM_BLACK,
src/components/vyzualz/react/ReactTypes.ts:4621: text:       DVYDRM_WHITE,
src/components/vyzualz/react/ReactTypes.ts:4822: { id: 'pad-1',  presetId: 'preset-bass-triangle-reactor',  label: 'Reactor',   color: DVYDRM_GOLD,    keyBinding: '1', transitionTimeMs: 500 },
src/components/vyzualz/react/ReactTypes.ts:4823: { id: 'pad-2',  presetId: LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID,    label: 'Drop Cage', color: DVYDRM_CYAN,    keyBinding: '2', transitionTimeMs: 400 
src/components/vyzualz/react/ReactTypes.ts:4824: { id: 'pad-3',  presetId: 'preset-infinity-signal',        label: 'Infinity',  color: DVYDRM_EMERALD, keyBinding: '3', transitionTimeMs: 600 },
src/components/vyzualz/react/ReactTypes.ts:4828: { id: 'pad-5',  presetId: 'preset-singularity-crown',       label: 'Crown',    color: DVYDRM_CYAN,    keyBinding: 'q', transitionTimeMs: 800 },
src/components/vyzualz/react/ReactTypes.ts:4834: { id: 'pad-9',  presetId: 'preset-xy-cyan-scope',          label: 'XY Scope', color: DVYDRM_CYAN,    keyBinding: 'a', transitionTimeMs: 300 },
src/components/vyzualz/react/ReactTypes.ts:4835: { id: 'pad-10', presetId: 'preset-lissajous-flower',       label: 'Lissajous',color: DVYDRM_EMERALD, keyBinding: 's', transitionTimeMs: 400 },
src/components/vyzualz/react/ReactTypes.ts:4836: { id: 'pad-11', presetId: 'preset-spiral-signal',          label: 'Spiral',   color: DVYDRM_GOLD,    keyBinding: 'd', transitionTimeMs: 350 },
src/components/vyzualz/react/ReactTypes.ts:4837: { id: 'pad-12', presetId: 'preset-radial-voice',           label: 'Radial',   color: DVYDRM_WHITE,   keyBinding: 'f', transitionTimeMs: 450 },
src/components/vyzualz/react/ReactTypes.ts:4838: { id: 'pad-19', presetId: 'preset-bass-triangle-reactor',  label: 'Triangle', color: DVYDRM_CRIMSON, keyBinding: 'g', transitionTimeMs: 250 },
src/components/vyzualz/react/ReactTypes.ts:4842: { id: 'pad-15', presetId: 'preset-star-drop-burst',        label: 'StarBurst',color: DVYDRM_GOLD,    keyBinding: 'c', transitionTimeMs: 250 },
src/components/vyzualz/react/ReactTypes.ts:4843: { id: 'pad-16', presetId: 'preset-glyph-circle-pulse',     label: 'Circle',   color: DVYDRM_CYAN,    keyBinding: 'v', transitionTimeMs: 400 },
src/components/vyzualz/react/layoutLab/recordListingData.ts:13: id: 'lab-audio-' + index, dbId: 'lab-audio-' + index, title, artist: 'DVYDRM',
public/cinema2/attributions.json:23: "origin": "Generated by scripts/cinema2-assets/generate-backstreet.mjs from the owner's DVYDRM wordmark master (scripts/cinema2-assets/sources/dvydrm-
public/cinema2/attributions.json:72: "origin": "Generated by scripts/cinema2-assets/generate-conduit-wordmark.mjs from the owner's DVYDRM wordmark master (scripts/cinema2-assets/sources/d
public/cinema2/attributions.json:135: "origin": "Generated by scripts/cinema2-assets/generate-dvydrm-logo.mjs from the owner's master DVYDRM logo SVG (scripts/cinema2-assets/sources/dvydrm
public/cinema2/attributions.json:142: "origin": "Generated by scripts/cinema2-assets/generate-dvydrm-logo.mjs --faceted from the owner's master DVYDRM logo SVG: the cut-crystal variant of 
public/cinema2/attributions.json:156: "origin": "Generated by scripts/cinema2-assets/generate-golden-roots.mjs (revision 3): a hand-authored curve network matching the owner's reference - 
public/cinema2/attributions.json:163: "origin": "Generated by scripts/cinema2-assets/generate-mainframe.mjs from the owner-supplied Mainframe Pass 1-3 SVG/JSON source contract. Shallow har
public/cinema2/attributions.json:170: "origin": "Owner-supplied DVYDRM Marquee high-fidelity reconstruction v2 (docs/Marquee/Marquee_Reconstruction_v2), rebuilt by scripts/cinema2-assets/b
index.html:6: <title>DRMVYZ // DVYDRM</title>
index.html:7: <meta name="description" content="DVYDRM music visualizer dashboard" />
package.json:219: "description": "Desktop VJ and audio-reactive visualization system for DVYDRM.",
package.json:220: "author": "DVYDRM"
```

### Appendix C: `VYZUALZ` in string literals / JSX text (visible-looking)
```
src/components/vyzualz/VyzualzErrorBoundary.tsx:56: {this.props.section ?? 'VYZUALZ'} could not load
src/components/vyzualz/VyzualzErrorBoundary.tsx:74: {this.props.section ?? 'VYZUALZ'} crashed
src/lib/lyricsSeed.ts:42: text: 'Welcome to VYZUALZ',
src/lib/lyricsSeed.ts:171: title:        'VYZUALZ Lyric Test',
src/lib/lyricsSeed.ts:178: description: 'Sample lyric document for testing VYZUALZ timed lyrics',
src/lib/lyricsSeed.ts:250: all.find(d => d.title === 'VYZUALZ Lyric Test' && d.sourceType === 'manual') ??
src/lib/lyricsSeed.ts:288: (d.title === 'VYZUALZ Lyric Test' && d.sourceType === 'manual'),
```
The remaining ~1,000 `VYZUALZ` mentions are code and CSS (`vz-*` classes, component names such as `VyzualzSidebarLayout`) and stay.

### Appendix D: lowercase brand in file/temp names
```
src/hooks/useRecorder.ts:139: downloadBlob(blob, `drmvyz-performance-${Date.now()}.webm`)
src/hooks/useRecorder.ts:194: downloadBlob(wav, `drmvyz-capture-${seconds}s-${Date.now()}.wav`)
src/hooks/useRecorder.ts:213: a.download = `drmvyz-frame-${Date.now()}.png`
```
(Only user-facing downloads change: `src/hooks/useRecorder.ts`. Temp-directory and diagnostic prefixes such as `drmvyz-diag-`, `drmvyz-preview-`, `drmvyz-rb-user-data-` are internal; the guard allow-list may keep them.)

### Appendix E: CSS `content:` strings with a brand name
```
(none found)
```

### Appendix F: Supabase files that mention `drmvyz` (do NOT edit migrations that are already applied; they hold preset ids; only function messages change)
```
supabase/.temp/linked-project.json
supabase/functions/.env.example
supabase/functions/_shared/vocalReference.ts
supabase/functions/lyric-transcription/index.ts
supabase/migrations/0001_initial_drmvyz_schema.sql
supabase/migrations/0002_storage_policies_explicit.sql
supabase/migrations/0003_visual_session_full.sql
supabase/migrations/0026_lyric_write_ownership.sql
supabase/migrations/0030_appearance_themes.sql
supabase/migrations/0031_contextual_info_preference.sql
supabase/migrations/0034_preset_catalog_and_user_presets.sql
supabase/migrations/0036_conduit_user_preset.sql
supabase/migrations/0040_goto_reliquary_user_presets.sql
supabase/migrations/0041_backstreet_echowave_mainframe_user_presets.sql
supabase/migrations/0044_cinema2_text_library.sql
supabase/migrations/0045_cinema2_submerge_text_scenes.sql
supabase/migrations/0046_cinema2_orbital_text_scenes.sql
supabase/migrations/0049_performance_sessions.sql
supabase/migrations/0054_system_settings_sync.sql
supabase/migrations/0059_cinema2_paradox_text_scenes.sql
supabase/tests/cinema2_text_library_regression.sql
```

### Appendix G: references to the logo/wordmark assets
```
src/components/auth/AuthPage.tsx:106:        src="/drmvyz_logo2.png"
src/components/vyzualz/cinema2/__tests__/Cinema2Reliquary.test.ts:93:    expect(instances.map(instance => instance.asset).sort()).toEqual(['cinema2-dvydrm-logo-faceted', 'cinema2-g
src/components/vyzualz/cinema2/__tests__/Cinema2Reliquary.test.ts:100:    const logo = readFileSync(resolve(process.cwd(), 'public/cinema2/models/dvydrm-logo-faceted.glb'))
src/components/vyzualz/cinema2/__tests__/Cinema2Reliquary.test.ts:162:    for (const id of ['cinema2-reliquary-trees', 'cinema2-dvydrm-logo-faceted']) {
src/components/vyzualz/cinema2/__tests__/Cinema2GoTo.test.ts:86:    const glb = readFileSync(resolve(process.cwd(), 'public/cinema2/models/dvydrm-logo.glb'))
src/components/vyzualz/cinema2/presets/Cinema2GoToPreset.ts:36: * polished gold outline. The shared logo asset (`cinema2-dvydrm-logo`, built from the owner's master SVG) has two pa
src/components/vyzualz/cinema2/presets/Cinema2GoToPreset.ts:105:/** The logo's materials as authored in the model (`cinema2-dvydrm-logo`): the gold outline and the polished crystal
src/components/vyzualz/cinema2/presets/Cinema2ReliquaryPreset.ts:48: * Assets: `cinema2-dvydrm-logo-faceted` (cut-crystal logo, rendered as transmissive glass with rainbow dispersi
src/components/vyzualz/cinema2/modules/three/Cinema2ThreeAssetManifest.ts:7:export const CINEMA2_DVYDRM_LOGO_ASSET_ID: Cinema2AssetId = 'cinema2-dvydrm-logo'
src/components/vyzualz/cinema2/modules/three/Cinema2ThreeAssetManifest.ts:9:export const CINEMA2_DVYDRM_LOGO_FACETED_ASSET_ID: Cinema2AssetId = 'cinema2-dvydrm-logo-faceted'
src/components/vyzualz/cinema2/assets/Cinema2AssetManifest.generated.ts:375:    "id": "cinema2-dvydrm-logo",
src/components/vyzualz/cinema2/assets/Cinema2AssetManifest.generated.ts:382:        "url": "/cinema2/models/dvydrm-logo.glb",
src/components/vyzualz/cinema2/assets/Cinema2AssetManifest.generated.ts:394:    "id": "cinema2-dvydrm-logo-faceted",
src/components/vyzualz/cinema2/assets/Cinema2AssetManifest.generated.ts:401:        "url": "/cinema2/models/dvydrm-logo-faceted.glb",
src/components/vyzualz/layout/HeaderControlGroup.tsx:10:const LOGO_SRC = `${import.meta.env.BASE_URL ?? '/'}drmvyz_logo_icon.png`
public/cinema2/attributions.json:131:      "id": "cinema2-dvydrm-logo",
public/cinema2/attributions.json:135:      "origin": "Generated by scripts/cinema2-assets/generate-dvydrm-logo.mjs from the owner's master DVYDRM logo SVG (scripts/cinema2-assets/s
public/cinema2/attributions.json:138:      "id": "cinema2-dvydrm-logo-faceted",
public/cinema2/attributions.json:142:      "origin": "Generated by scripts/cinema2-assets/generate-dvydrm-logo.mjs --faceted from the owner's master DVYDRM logo SVG: the cut-crysta
electron/main.cjs:20:// vite.config.ts emits root-relative asset URLs (e.g. "/drmvyz_logo2.png") for
electron/main.cjs:23:// file:// has no origin — it would resolve "/drmvyz_logo2.png" to the filesystem
```
Top-level `public/` and `electron/assets/`:
```
cinema2
drmvyz_logo2.png
drmvyz_logo_icon.png
laser-dmx-icons
layout-lab
mediapipe
mockups
model-textures
models
pixgrid-decks
preset-artwork
worklets
alternating-fan.webp
aura.webp
aurora-canopy-drift.webp
app-icon-source.png
app-icon.png
```

### Appendix H: docs/README mentions
```
README.md:1:# DRMVYZ
README.md:3:DRMVYZ is a desktop-first VJ and audio-reactive visualization system for DVYDRM. It combines a six-engine live performance workspace, track-aware choreography, media and brand li
README.md:60:On macOS, `launch.command` selects the repository's required Node 22 runtime and starts the same development workflow. It also gives the development Electron shell a DRMVYZ-spec
README.md:98:DRMVYZ uses one shared analysis and timing authority:
THIRD_PARTY_NOTICES.md:44:DRMVYZ converts the specular/glossiness material to metal/rough PBR, caps maps at
docs/desktop-launcher.md:4:`scripts/run-electron-dev.mjs` to start Vite and the isolated DRMVYZ Electron shell.
docs/desktop-launcher.md:17:`DRMVYZ_VITE_DEV_SERVER_URL` supplies the preferred address instead.
docs/desktop-launcher.md:19:Every launch checks for running DRMVYZ before starting its replacement. On
docs/desktop-launcher.md:20:macOS this includes packaged `DRMVYZ.app`, isolated `DRMVYZ Dev.app` instances,
docs/desktop-launcher.md:27:Stale DRMVYZ Vite processes are stopped only when their working directory and
docs/desktop-launcher.md:29:process metadata no longer causes a fatal port-conflict error. The DRMVYZ app check runs independently of which port is occupied. If no port is available in
```

### Appendix I: help center
```
src/help/HelpCenter.ts:2: * Bundled contextual-help content for DRMVYZ.
src/help/HelpCenter.ts:2774:    "summary": "Chooses whether CANVAS particles use source colors, the DRMVYZ palette, or audio-reactive recoloring.",
src/help/HelpCenter.ts:6342:    "whenToUse": "Use it to locate media for editing, selection, or assignment elsewhere in DRMVYZ.",
```

### Other user-visible items discovered by manual reading
- `src/components/vyzualz/VyzualzErrorBoundary.tsx`: default section label `'VYZUALZ'` shows as "VYZUALZ could not load/crashed" -> `STAGELESS`.
- `src/lib/lyricsSeed.ts`: `'Welcome to VYZUALZ'`, `'VYZUALZ Lyric Test'` (also used as lookup keys at lines near 250 and 288; change the string and both lookups together, and consider that existing users may already have a stored seed titled "VYZUALZ Lyric Test": decide whether the lookup should match both old and new titles to avoid duplicating the seed document).
- `src/features/personalization/components/BrandKitSettingsPanel.tsx`: "Make DRMVYZ feel like your booth".
- `src/components/vyzualz/react/output/OutputCastControl.tsx`: the section label "DRMVYZ Receivers" also appears in `src/components/shared/icons/__fixtures__/appIconInventory.ts` (test fixture string `'DRMVYZ receivers'`) and in CSS comments; update the fixture with the UI.
- `src/components/vyzualz/react/ReactTypes.ts`: default text `'DRMVYZ'` (lines ~1173, 4739), preset name/description (~4730), pad label (~4841). Default **text content** that users already saved is not touched; only defaults for new items change.
- `src/styles/typography.css`: font-family `'DRMVYZ Anton'` is an internal family name; leave it.
- The 3D wordmark/logo models, SVG vector wordmark used by the Echowave preset and others, and any preset thumbnails: see Phase 3.

---

## 8. Downstream-impact checklist (verify before calling it done)

1. **Guard test passes** with the allow-list in section 3.
2. `npm run build` / typecheck / lint clean; Vitest suites that referenced old strings updated (search tests for `DRMVYZ` expectations, e.g. in `src/components/vyzualz/**/__tests__`, layout-lab studies, `appIconInventory`, Playwright specs under `src/test/e2e`).
3. Packaged build (`npm run desktop:dist:mac`): app is `STAGELESS.app`, DMG named `STAGELESS-<version>-...`, Dock/menu/About show STAGELESS, permission prompts say STAGELESS, `Info.plist` `CFBundleIdentifier` is the new id.
4. Data survives: sign-in, settings, favorites, cast pairing, rekordbox indexes (section 5.5).
5. Dev launcher works from a clean state and from a state with a running old `DRMVYZ Dev` instance (section 5.6).
6. Casting still discovers receivers (service type unchanged), and the Android receiver (only strings changed) still pairs.
7. Supabase functions redeployed after the message changes. **Supabase CLI note:** in this project the CLI has previously been logged into the wrong account and caused 403s on deploy; check `supabase projects list`; the project ref is `ofeiopgawwsftfunckps`. Migrations: none are needed for this rename; do not edit applied migrations.
8. Run a text search over the **built** `dist/` and over the packaged app (`strings`/`grep -a`) for `DRMVYZ`, `DVYDRM`, `VYZUALZ` to catch generated or bundled text the source search misses; each hit must be on the allow-list.
9. Visual pass by the owner: auth page, sidebar, Settings, Output panel, presets that show the wordmark, window titles, installer.
10. Do not commit unless the owner asks; the owner commits (project convention). Do not push or deploy without being asked, except as listed.

---

## 9. Open items to confirm with the owner when starting
1. The new `appId` value (suggest `com.stageless.app`) and whether a domain-based id is preferred.
2. Source artwork for Phase 3 (logos, wordmark models); until provided, Phase 3 cannot finish.
3. Whether the seed lyric document title change should match both old and new titles (see section 7).
4. Whether the npm package `name` and the repository folder should be renamed at the end (optional, invisible).
5. Whether any build has been installed by others (affects only how loudly to announce the permission re-prompt).

---

## 10. Owner decisions (2026-11-21, override earlier sections)

1. **`appId` = `com.stageless.app`.** No one else has installed a build.
2. **DVYDRM is the owner's DJ name and is OUT OF SCOPE entirely** (this overrides 1.2, Appendix B and Phase 3). Do not change: the 3D wordmark/logo models and asset ids, preset descriptions saying "The DVYDRM wordmark/logo", preset authors crediting DVYDRM, `DVYDRM_*` colour constants, sample artist names, `package.json` `author`, attribution/origin text. The guard test does not check DVYDRM.
3. **Anything tied to user data is out of scope**: seed lyric documents (`src/lib/lyricsSeed.ts`, including the "VYZUALZ Lyric Test" title, so open item 3 is moot), saved text, media and similar. The guard ignores these files.
4. **Phase 3 is only the 2D logos**: `public/STAGELESS Logo.png` (icon) replaces `drmvyz_logo_icon.png`, and `public/STAGELESS Wordmark Logo.png` replaces `drmvyz_logo2.png`. Keep the old file names (or alias) so references do not break. No 3D or preset-artwork work.
5. **`index.html`**: title is `STAGELESS Studio`.
6. **npm package `name` and the repo folder are renamed at the end** (optional last step; check scripts and `node_modules/.cache` paths first).
7. **Guard test ratchet**: `src/brand/__tests__/noOldBrandPending.ts` lists files that still have old-brand text. A listed file with no hits fails the test, so remove entries as each phase lands; done = empty list. Scan scope also covers `native/` and the two dev-launcher scripts (the original list missed visible text in `native/output`). Regenerate candidates with `BRAND_GUARD_DUMP=/tmp/x npx vitest run src/brand`.
