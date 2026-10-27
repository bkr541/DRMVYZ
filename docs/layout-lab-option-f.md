# Layout Lab Option F — Studio Trace

Option F owns a dedicated presentation (`optionF/`), independent of A–E, G–K, the Layout Lab selector and production. G–K keep the original base styling; F no longer does.

## References and what they contributed

Two supplied images (a Track Details panel and a multi-lane timeline with transport) set the direction.

| Characteristic | Treatment in F |
| --- | --- |
| One continuous dark surface divided by hairlines | A single framed console (20px radius, 1px border); header, rail, panels, stage and deck are separated by hairlines rather than floated as cards |
| Section = chevron, icon, title, hairline | Flat groups with a leading chevron; nested groups inset so their text aligns with the parent's text |
| Label · slim track with glowing cyan thumb · right-aligned value | Every slider is one row with that anatomy (`OfRange`); switches are pills with a cyan thumb |
| Icon tile + two-line identity (title, muted subtitle) | `OfIdentity` for the engine, the inspector context and the stage placeholder |
| Ghost icon tiles, rounded-square chips | `OfKey` and `.of-chip` are 10px-radius tiles; tabs are ghost tiles with a raised, cyan-labelled selection |
| Tinted lanes, white playhead, indigo Play disc, time chip, volume pill | Timeline adapter (translucent clips, white playhead), a 46px indigo Play disc with halo, a time chip and a level pill in the deck |

Colour: canvas `#060709`, panel `#0e0f12`, card `#17181c`, one cyan signal `#2cd5f5`, indigo `#5847e0` for Play and primary actions. Type: system sans; Manrope for numerals only. The shared role contract is `[data-ui-typography='studio']` in `src/styles/typography.css` (parent headings 12px/700/.15em with icon, nested 11px, fields 12px). Portals carry `data-ui-theme='studio'`.

## Composition

Header (brand, output controls, status chips, utilities) · slim rail with the unchanged A–I/K selector · React Workspace panel (identity, Source/Layers/Notice, Media Library, layers, notices) · persistent stage with a toolbar of chips and working guides over a tabbed editing workspace (Sequence, Track Map, Settings, Dialogs) · Inspector panel (Presets, Design, React, Audio, Tracks) · deck (identity, transport, time chip, waveform, tempo, source/playlist/timeline/collapse keys, level pill).

## Scope

Changed: `LayoutLabDesignWorkbench.tsx` (F branch, outline icons), its test (F is dedicated; G–K keep the old-frame assertions), `typography.css` (studio block), `docs/`, and the new `optionF/` module. Editor internals (timeline, cue list, Track Map, Settings, dialogs, presets, audio diagnostics, track browser) keep their markup and handlers and receive F's materials through `optionFFeatures.css`.

## Verification

`tsc --noEmit`, ESLint on `optionF/` and the workbench files, and `OptionFWorkspace.test.tsx` plus the workbench suite pass. Reviewed in a browser at 1440×900, 1920×1080, 1280×800 and 1000×760 with no horizontal overflow; inspector tabs, editing workspaces, notices, list view, dropdown, playlist popover and dock collapse were exercised. Not run: production app, Electron, the pop-up window, full-repo tests. No external design research was done.
