# MONUMENT — native Cinema 2.0 reference preset

Status: selectable reference, human and production visual acceptance pending. ID `drmvyz.cinema2.monument`, revision 1. This is not a keeper promotion.

## Scene, geometry, and source ownership

The hero is the architecture: a stepped rectangular metal podium, recessed cyan floor trenches, receding structural buttresses, tall side walls, overhead slots and a rear relief. A low camera looks along -Z, right-handed Y-up coordinates, near .12 / far 65, 38° vertical FOV and 16:9 minimum horizontal fit. The floor top is -2.53; the podium top is derived from its authored scale. The hero pivot is the transformed bounds center, and the rotated AABB is used to ground and uniformly fit the content. Width, depth and height are bounded before transform, with additional caps after rotation and placement. Negative Y lowers podium height with the hero to avoid interpenetration; positive Y raises the hero slightly. The shared minimum-aspect projection preserves horizontal framing on narrow output. Exact pixel framing and very tall/wide asset clearance still require browser captures.

The native Three bridge owns the renderer, camera, shared lighting and output passes. The module owns the procedural hall, text geometry, local raking spot and two colored point lights; the model slot owns asynchronous account-aware pinned model leases, and the bridge owns imported instance material clones. `Content Type` is a schema enum in Design; use the existing Source tab to pick an imported model. Both text and pinned model binding persist independently; text mode releases the model lease, and model mode reloads the saved binding. Missing/loading/invalid models render neutral STAGELESS typography with slot diagnostics. No new upload, store, network service, output renderer or dependency. The Source tab remains the canonical source manager and is not a Design lock bypass.

Typed Text is three fields with a total 80 Unicode-code-point cap, NFC normalization, Latin-1 and selected punctuation from repo-local Anton and STAGELESS Sans Bold. Unsupported glyphs use `?`; empty input shows no hero. Layout preserves case, explicit spaces and line breaks, not full complex-script shaping/kerning. Actual font contours are nested into shapes and holes, extruded in +Z with front/side material groups and bounded bevel. Glyph geometry rebuilds only when text, typeface or layout inputs change; old buffers are disposed. `scripts/generate-monument-fonts.py` reproduces the committed outline JSON using Python fontTools from the existing Anton OFL font (license `scripts/cinema2-assets/sources/anton/OFL.txt`) and existing STAGELESS branding OTF. No runtime font downloads. This uses a preset-local font enum, not a new global font picker. Imported original materials retain maps, base colors, alpha and normal data; brushed and emissive modes alter cloned standard-material scalar values and restore them on Original. Non-standard imported materials retain their original material; hero-local lights still respond.

## Controls and authority matrix

All listed parameters are saved user bases. Manual edits are subject to the existing Inspector lock, except Palette and BPM Sync; Source Manager ownership stays unchanged. AP = Auto Performance. `M` = transient modulation only, never persisted; `U` = user-only. The generic Inspector supplies live values, lock, reset and mood-policy notes.

| Control | Manual | Audio modulation | Director | AP | Manual edit / visible result |
|---|---|---|---|---|---|
| Quality | U | none | none | none | shared quality tier / secondary relay visibility |
| Auto Performance | U | none | none | gates | toggles shared authority |
| BPM Sync | U | shared beat grid | none | none | shared clock lock, phase continuity |
| Master Intensity | U | scales accents | scales impact | M | routed accent strength |
| Music Reactivity | U | strength | strength | strength | zero disables routed modulation |
| Motion Safety | U | none | none | none | full/reduced/lockoff camera and hero |
| Pattern | U | shared trigger advances | mood candidate | authorized temporary choice | immediate, no saved rewrite |
| Pattern Change | U | shared fresh event | shared mood policy | effective only | saved visibility authority |
| Trigger | U | canonical event identity | shared mood policy | effective only | suppress stale event |
| Camera Motion | U | none | none | none | hard motion gate |
| Camera Amount | U | shared camera tempo | shared camera significance | M | bounded drift, zero authored shot |
| Model binding | U | none | none | none | existing versioned Source picker |
| Content Type | U | none | none | none | text vs leased model |
| Model Visible | U | none | none | none | hard hero visibility |
| Model Scale | U | none | none | none | uniform safe fit |
| Model X | U | none | none | none | bounded horizontal offset |
| Model Y | U | none | none | none | grounded vertical offset |
| Model Z | U | none | none | none | bounded depth offset |
| Model Yaw | U | none | none | none | authored rotation |
| Model Pitch | U | none | none | none | authored rotation |
| Model Roll | U | none | none | none | authored rotation |
| Material Mode | U | none | none | none | original/brushed/emissive |
| Hero Motion | U | bounded bass lean | impact indirectly | M | floor-safe motion |
| Hero Emission | U | rim accents | impact indirectly | M | rim light and optional emission |
| Text | U | none | none | none | actual first-line glyphs |
| Line 2 | U | none | none | none | actual second-line glyphs |
| Line 3 | U | none | none | none | actual third-line glyphs |
| Font | U | none | none | none | actual local outlines |
| Text Depth | U | none | none | none | extrusion |
| Bevel | U | none | none | none | safe real glyph edge geometry |
| Letter Spacing | U | none | none | none | glyph positions |
| Line Spacing | U | none | none | none | baseline positions |
| Alignment | U | none | none | none | horizontal alignment |
| Pedestal Height | U | none | none | none | podium and hero grounding |
| Hall Depth | U | none | none | none | receding structure spacing |
| Trace Speed | U | phase timing | momentum | M | light sweep pace |
| Reveal Extent | U | spotlight/contrast | brightness | M | spotlight spread and intensity |
| Contour Strength | U | high/kick/drop | shock | M | actual rim illumination |
| Floor Relay | U | bass/kick/drop/downbeat | energy | M | floor channel chase |
| Bloom | U | resolved shared pass | peak | M | HDR bloom |
| Atmosphere | U | resolved shared pass | tension | M | depth-aware mix |
| Reflection Strength | U | resolved value | coverage | M | studio environment reflections / floor roughness (not a planar mirror) |
| Shadow Strength | U | resolved light | coverage | M | shadow-casting authored spot intensity |
| Light Spill | U | resolved value | coverage | M | colored point light |
| Cinematic Finish | U | resolved shared pass | coverage | M | output grade mix |
| Background | U | none | none | none | shared background |
| Structural | U | none | none | none | hall and podium metal |
| Primary Energy | U | none | none | none | spotlight and overhead slots |
| Secondary Energy | U | none | none | none | recessed floor and spill |
| Accent | U | none | none | none | podium trim and rim |
| Text Face | U | none | none | none | glyph face only |
| Text Side | U | none | none | none | glyph side only |

Typography and text colors are conditionally shown in text mode. Numeric fit/layout parameters have explicit Auto Coverage exemptions so no per-frame geometry rebuild or unexpected fit changes occur. The canonical coverage helper supplies the remaining eligible continuous AP targets.

## Pattern and timing

| Pattern | Program |
|---|---|
| Monumental Reveal | moving floor packet, sweeping reveal and rising rim |
| Surface Trace | lateral key sweep with restrained surroundings |
| Edge Relay | moving rim, sequential floor and wall relays |
| Ascension | vertical key and wall illumination progression |
| Architectural Pulse | staggered architectural waves and stable key |
| Exposure | coherent hero showcase and quiet surroundings |

`Cinema2BeatClock` uses shared host BPM Sync AND preset BPM Sync, with 90 BPM fallback (8 beats = 5.33 s; floor wave 4 beats = 2.67 s). Idle slows light cycling; paused transport holds phase. Shared pattern resolver, deterministic Mainframe controller and Auto Performance helper own policy and effective choice. The 11 standard trigger options are inherited unchanged. Manual Pattern edit resets the runtime base and suppresses stale trigger identities. Track/generation/seek resets volatile state. Optional build reveal and 3-beat drop exposure use the shared override helper; base pattern continues underneath. Silence holds the pattern unless a manual edit or fresh drop arrives. The module exposes effective pattern change, trigger and automatic authority through inspect. No independent audio clock or timeline detector.

## Shared musical routing

All ordinary continuous paths are not-silent and strength-scaled by Music Reactivity. Event envelopes use canonical once-per-event identities, and not-silent except drop. All target values are bounded in the pose resolver; authored bases are not written. Director build and impact are significance only, not source/color selection.

| Signal | Route | Contribution (normalized before Master Intensity) | Smoothing or A/H/R seconds |
|---|---|---|---|
| sub/bass | floor, lean | .20 floor, .15 lean factor | 160/120 ms |
| mids | key position | .12 | 150 ms |
| highs/air | rim | .15 | 100/125 ms |
| overall energy | wall | .08 | 180 ms |
| vocal | key/restraint | +.14 key, -30% interference | 220 ms |
| director build | key | -.20 | 200 ms |
| director impact | drop weight | .70–1.00 | 150 ms |
| kick | floor, rim | .25/.25 | .03/.025/.24 |
| snare | wall | .22 | .02/.02/.18 |
| downbeat | floor | .14 | .055/.05/.38 |
| phrase | wall | .12 | .15/.10/.80 |
| drop | key, floor, wall, rim | .45/.25/.24/.25 | .17/.10/1.23 |

| Mood target | Base | Shared source | Operation at full source | Strength |
|---|---|---|---|---|
| Reveal Extent | .65 | mood.brightness | +.15 | reactivity |
| Floor Relay | .45 | mood.energy | +.20 | reactivity |
| Trace Speed | 1 | mood.momentum | ×1.30 | reactivity |
| Contour Strength | .40 | mood.shock | +.15 | reactivity |
| Bloom | .25 | mood.peak | +.08 | reactivity |
| Atmosphere | .10 | mood.tension | +.08 | reactivity |
| Master Intensity | .75 | mood.silence | -.35 | reactivity |

Calm: Trace/Exposure; driving: Edge Relay/Architectural Pulse; tense: Reveal/Ascension; peak: Exposure/Architectural Pulse. Shared mood policy owns pattern choice. No local mood analysis.

## Lifecycle and validation ledger

Procedural box geometry is shared; small fixed relay/light count, text geometry allocated only on edits, low quality hides alternating secondary relays. Native HDR atmosphere/bloom/finish graph is the same production output graph, not an alternate preview. Shared model cache handles auth invalidation, cancellation, readiness and release. No benchmark or cast/record capture is claimed.

Validation in implementation environment: `python scripts/generate-monument-fonts.py` succeeded. `npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0` failed (registry DNS EAI_AGAIN; npm exit-handler error). An offline Node harness using globally installed TypeScript transpilation (substituting a neutral `import.meta` for Vite-only metadata) executed the actual preset authoring validator and native compiler for both base and Auto Coverage manifests: zero diagnostics. It also checked distinct/bounded pattern outputs, text cap, model source routing, manual pattern selection, paused timing and track reset. This is not a full typecheck or Vitest run. The included `Cinema2MonumentPreset.test.ts` covers these and additional fit/outline checks.

Required local follow-up: `npm ci`, `npm run typecheck`, `npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2MonumentPreset.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2AutoCoverage.test.ts`, `npm run build`, and production browser capture of all six patterns, text/model cases, effects off/max, portrait/landscape, transport and source transitions, all trigger types, Auto Performance lock/live markers, preview/cast/record and repeated switching. No browser, GPU, authenticated fixture, output or full regression evidence was available here; no release readiness or human acceptance asserted. Contact shadows, text counters and camera fit are implemented but not visually verified.

## MON-01 architectural revision

The stable preset, parameter, pattern and source IDs are unchanged. Five staggered stone bays replace the repeated thin frames: fixed load-bearing buttresses, outward-only recessed wings and upward-only crown lintels form a deep sanctuary. A long slab floor and stepped pedestal ground the original glyph/model hero. All geometry is still procedural with one shared box geometry; no dependencies or external assets are added. Low quality suppresses alternating wall/floor relays, not the crown openings or hero.

| Pattern | Architectural behavior |
|---|---|
| Monumental Reveal | Progressive bay opening, rising lintels and a restrained hero light sweep |
| Surface Trace | Mostly fixed masonry with travelling light across the recessed faces |
| Edge Relay | Narrow travelling apertures and floor/rim light packets |
| Ascension | Sequential vertical lintel lift and rising illumination |
| Architectural Pulse | Alternating outward wings and raised crowns, staggered along the hall |
| Exposure | Broad open sanctuary, quiet peripheral channels and strong hero light |

Build significance draws the wing/crown response inward while the shared drop envelope opens them and brightens the key. Travel is capped at 1.05 world units outward and 1.15 upward, multiplied by the existing Motion Safety scale (full 1, reduced .45, lockoff 0). The existing Pattern/Pattern Change/Trigger, beat clock, mood resolver and saved values still own pattern selection. Camera Motion (true), Camera Amount (.25, range 0–1) and Motion Safety retain their shared authority; build and drop rules contribute bounded camera positions to the shared runtime, with no local clock. The new authored lens is 40 degrees with a 10.15–11.8 world-unit Z bound and 16:9 fit-to-width preserved. Reflection Strength (.25, range 0–1) retains environment reflection and now also drives the shared atmosphere pass's reflected scattering; this is not a planar hero mirror. Shadow Strength still owns the shared shadow light; its narrower beam now participates in atmospheric scattering. Light Spill (existing .3, range 0–1) also controls two non-shadowed grazing spots aimed along the stone bays. No new controls or migrations are required.

The added tests exercise numerical pattern bounds, build/drop contrast, transition blending, geometric clearance, CPU scene assembly, rotated model/text fit, material preservation and quality visibility. Full application/browser validation, real WebGL captures, performance measurement and an updated thumbnail remain pending where project dependencies and GPU rendering are available. The original recording and review DOCX were not supplied for this revision.
