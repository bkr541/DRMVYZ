# Layout Lab application icon review

Open **Layout Lab → Cinema 2.0 → Icons** in the middle visualizer. The review sheet contains 336 labeled entries using 140 original SVG drawings, arranged in five columns. Labels sit above the artwork and wrap rather than truncate. Search matches labels and screens. **Concept preview** retains the existing filmstrip preview.

## Style reference

The approved family was based on the previous sidebar’s Deck Hardware (React, Lyric Manager) and Isometric Stack (Preset, Show, Media Managers) artwork in `src/components/vyzualz/navIcons.tsx`. Its shared grammar is a 32 × 32 viewBox, 1.5px rounded strokes, muted structural detail, layered frames or recognizable hardware, and a cyan functional accent (brighter on hover/active). The review drawings extend that grammar, including new drawings for the navigation destinations themselves. No raster generation or third-party icon library is used by the gallery.

## Inventory and label policy

`appIconInventory.ts` records the screen, current label, drawing, and production source paths for every entry. The source scan covered icon-library components, custom SVGs, raw SVG assets, CSS fixture silhouettes, Unicode control symbols, and shared control components across production screens. This is a source audit; it does not depend on an authenticated user's data.

Repeated instances of the same labeled action within one screen share an entry. Different action labels and distinct on/off artwork remain separate. Related meanings can share a drawing (for example, Delete layer and Delete cue). Current visible text is preferred; icon-only controls use their accessible name or tooltip. Labels containing user-owned names, timestamps, counts, or section titles use bracketed placeholders, retaining the surrounding production wording. The unlabeled password-eye variants use their PASSWORD field label. User media, artwork thumbnails, generated scene previews, and data charts are content rather than control icons and are not redrawn.

## Production rollout

The approved artwork now lives in `src/components/shared/icons/AppIcon.tsx`, with its shared styling in `appIcon.css`. Layout Lab’s `AppIconGlyph` delegates to this same renderer at 36px, so the gallery remains a faithful preview of the production artwork. Production consumers choose a typed `kind` and preserve their existing sizes, accessible labels, event handlers, and disabled states. The cyan signal accent follows the app accent; disabled controls and destructive or notice actions retain their semantic foreground colors.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Shared renderer; sidebar; header loading, notification, settings and save icons; shared dialog/notice icons; all production Hugeicons and Carbon icon uses across managers, libraries, lyric editing, React rails and Audio Intelligence | Complete |
| 2 | Remaining bespoke SVGs: transport, engine selectors, lighting fixture assets, output/casting, recording, timeline and account controls | Complete |
| 3 | Remaining Unicode/CSS controls, toggle/checkbox artwork and legacy Layout Lab samples; final inventory consistency review | Pending |

Phase 1 migrates 100 third-party icon instances in 24 production files in addition to shared/navigation replacements. The header activity animation retains its existing busy/reduced-motion behavior and rotates around the new artwork’s 16px center. Active favorites use the approved unfavorite variant. Layout Lab samples still using third-party icons are deferred to phase 3; the packages remain installed until their final uses are removed.

## Screen coverage

| Screen | Entries |
| --- | ---: |
| Navigation | 8 |
| Workspace | 18 |
| Audio dock | 23 |
| Media Manager | 32 |
| Media dialogs | 14 |
| Preset Manager | 6 |
| Show Manager | 31 |
| Lyric Manager | 25 |
| Lyric timeline | 14 |
| Engines | 8 |
| Sound Drawing | 11 |
| Cinematic Worlds | 14 |
| Lighting fixtures | 10 |
| Headliner | 1 |
| Beam Matrix presets | 3 |
| LaserDMX diagnostics | 1 |
| Track Map | 18 |
| Audio Intelligence | 15 |
| Canvas & PixGrid | 21 |
| Shader scenes | 6 |
| Output | 26 |
| Performance pads | 1 |
| Recording | 3 |
| Settings & account | 18 |
| Shared controls | 9 |

The inventory references 76 production source files. Add new icon meanings or label variants there when production UI changes.

## Validation

Focused tests cover every SVG and label, valid source references, label/screen filtering, empty search results, center-panel placement, and the existing concept-preview switch. Browser review checks five columns, labels above icons, vertical scrolling without horizontal overflow, fixture search, and both visualizer tabs at desktop and narrower window sizes. Full-project typechecking remains affected by existing repository errors.

### Phase 1 checkpoint

- Approved drawing definitions were compared to the committed gallery source and are unchanged.
- 120 focused tests ran: 118 passed; two Media Library tests fail because their unchanged saved-track loader assertions omit the existing `notifyOnBlocked: false` argument. The preset-card suite also reports an unrelated Supabase/localStorage teardown rejection. These failures were inspected, not retried or patched as part of the icon rollout.
- Changed TypeScript/TSX files pass ESLint with zero errors; five existing React-hook dependency warnings remain in ReactView and ShowManagerView.
- Focused production typechecking reports nine errors in unchanged Cinema 2.0 assets/presets, PixGrid preparation, migration, and Audio Dock files; no diagnostics were reported in the icon migration files. A full build was not repeated while these unrelated errors remain.
- Browser review verifies gallery/production path equality, navigation, idle/busy loading animation around the 32px grid center, reduced-motion behavior, and inherited disabled/destructive colors.
- At the Phase 1 checkpoint, changes were left uncommitted and phases 2 and 3 were pending.

### Phase 2 checkpoint

- Migrated bespoke control artwork in 31 production files to `AppIcon`, including transport and cue/Rekordbox assets; engine, Sound Drawing source and cinematic selectors; lighting palettes/stage fixtures; casting, window/aspect and output safety controls; recording; timeline lanes/markers; account inputs; search, upload and dialog affordances; and CANVAS effect icons.
- All nine current/compatibility engines have dedicated approved mappings. Palette and stage share the ten-entry `FIXTURE_ICON_KINDS` mapping; stage icons retain fixture colors and fill their existing containers. The six casting aspect ratios use their distinct approved drawings. Playback preset colors and output status colors continue to inherit from their controls.
- Scene thumbnails, the decorative authentication emblem, waveform/chart canvases, beam-editing SVGs and scanner diagrams remain content, not control icons. Toggle/checkbox artwork, Unicode/CSS controls and legacy Layout Lab examples remain for Phase 3. Old asset files remain available until final usage cleanup.
- Validation: across the focused suites, 179 tests passed, 28 CANVAS control-contract assertions failed on layout groups/sliders, and one authentication configuration-gate test was skipped. A storage teardown rejection also remains. The CANVAS changes only replace artwork helper bodies; control layout, labels, state and handlers are unchanged. The Audio Dock's old plus-path and image assertions were updated for the approved artwork, and its 15 tests pass. Unrelated Canvas failures were not rerun or changed.
- ESLint reports zero errors and six existing hook-dependency warnings. Focused typechecking found no unexpected diagnostics in changed files; the same nine repository diagnostics remain, including the two known Audio Dock `diagnostics` union errors. A full build was not repeated.
- Browser review passed for all nine engine icons, ten palette/stage fixture pairs at their expected sizes and colors, all six aspect ratios including portrait selection, recording start/stop callbacks, and transport path equality with the approved gallery. No browser page errors occurred.
- Phase 2 implementation and documentation are complete, the diff was reviewed, and changes remain uncommitted. Phase 3 has not started.
