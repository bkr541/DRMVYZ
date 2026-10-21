# Layout Lab application icon review

Open **Layout Lab → Cinema 2.0 → Icons** in the middle visualizer. The review sheet contains 336 labeled entries using 140 original SVG drawings, arranged in five columns. Labels sit above the artwork and wrap rather than truncate. Search matches labels and screens. **Concept preview** retains the existing filmstrip preview.

## Style reference

The production sidebar mixes Deck Hardware (React, Lyric Manager) with Isometric Stack (Preset, Show, Media Managers), from `src/components/vyzualz/navIcons.tsx`. Its shared grammar is a 32 × 32 viewBox, 1.5px rounded strokes, muted structural detail, layered frames or recognizable hardware, and a cyan functional accent (brighter on hover/active). The review drawings extend that grammar, including new drawings for the navigation destinations themselves. No raster generation or third-party icon library is used by the gallery.

## Inventory and label policy

`appIconInventory.ts` records the screen, current label, drawing, and production source paths for every entry. The source scan covered icon-library components, custom SVGs, raw SVG assets, CSS fixture silhouettes, Unicode control symbols, and shared control components across production screens. This is a source audit; it does not depend on an authenticated user's data.

Repeated instances of the same labeled action within one screen share an entry. Different action labels and distinct on/off artwork remain separate. Related meanings can share a drawing (for example, Delete layer and Delete cue). Current visible text is preferred; icon-only controls use their accessible name or tooltip. Labels containing user-owned names, timestamps, counts, or section titles use bracketed placeholders, retaining the surrounding production wording. The unlabeled password-eye variants use their PASSWORD field label. User media, artwork thumbnails, generated scene previews, and data charts are content rather than control icons and are not redrawn.

The gallery is isolated to Layout Lab. It does not change production icons, controls, stores, or rendering runtimes.

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

Focused tests cover every SVG and label, valid source references, label/screen filtering, empty search results, center-panel placement, and the existing concept-preview switch. Browser review checks five columns, labels above icons, vertical scrolling without horizontal overflow, fixture search, and both visualizer tabs at desktop and narrower window sizes. Repository-wide typechecking currently reports unrelated errors in existing Cinema 2.0, Show Manager, and browser-harness files.
