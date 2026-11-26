# FRACTURE: spatial rupture (FRA-01)

This replaces the rectangular chamber with a fault through irregular obsidian plates and three seeded depth strata. Front fragments sit outside the central source rectangle; deep fragments use dark reflective bevels, with isolated accent edges rather than an illuminated grid. No-media composition has an asymmetric diagonal fault and static staggered depth. Media uses the complete original-plane cap at rest; the same cap moves and contracts during separation, with unchanged UVs. Media opacity, fit, brightness, grouping, pool selection and reset retain the existing authority. No catalog image was regenerated without verified WebGL output.

## Motion vocabulary

| Existing pattern ID | Geometry behavior |
| --- | --- |
| fracture | Diagonal split with a localized crack front |
| suspension | Alternating near/far depth strata and restrained spread |
| scatter | Radial outward separation, pivot and deep retreat |
| contour-chase | Narrow adjacency-driven illuminated chain with physical lift |
| reconstruction | Staggered adjacency-driven restoration |
| shatter-wave | Traveling coherent crest across the plane |

The existing Cinema2BeatClock supplies phase. The normalized cycle has an intact opening, cracking from .12, separation from .25, suspension from .47, reconstruction from .70 and an intact target from .93. Pattern-specific envelopes vary these stages. No independent music clock or event detector. Shared kick adds local impulse, bass increases authored nonzero extent, phrase attenuates the rupture and drop takes priority. Existing choreography, pattern change/trigger resolution and Auto Performance remain unchanged. Manual selection and stored IDs/ranges/defaults are unchanged; camera uses existing Design controls and a pulled-back baseline (12.3 world units), constrained to 11.7–13.1 on Z. Motion safety and readability reduce amplitude; lockoff removes animated offsets.

## Controls and ownership

All existing authored values and stable IDs retained. Spread (0–1, default .50) now scales up to 1.65 world units X / 1.05 Y; depth travel (0–1, default .45) up to 1.45 forward / 2.65 rear; rotation (0–70°, default 25°) is clearance-scaled. Thickness (.01–.12, default .04, panel-height fraction) multiplies seeded variation .55–1.80; crack width (0–.04, default .004, panel-width fraction) controls bevel shoulder gap and opened cap contraction. The intact media cap overrides gap to preserve image pixels. Reassembly time (.25–3 seconds, default 1.1) governs exponential return. Existing shared mood drives retain their bounded ownership over spread, depth, rate, crack emission and effects. Geometry count/seed/width rebuild core geometry; seed also rebuilds field; thickness and pose use transforms. Low quality hides a subset of far field only; full media geometry is retained. Structural palette colors mineral material; primary controls fault edges and local spill; secondary controls deep edges and procedural vein; accent controls peripheral edges; background remains shared environment. Reflection now affects bevels instead of a removed rectangular floor. All four Inspector groups, saved controls and source IDs remain unchanged.

## Validation handoff

Run `npm run test:e2e:cinema2-release -- --presets fracture` or use existing production `cinema2-quality-review.html?preset=drmvyz.cinema2.fracture&quality=high&release=1` harness (Vite dev server); its API supports reference/idle/build/drop/breakdown, media fixture, parameter changes, reset and quality switching. Compare baseline/updated renders at matching viewport, quality and fixture; inspect all six patterns, pause/seek, Auto, media quadrant orientation and intact coverage, pool and source reset, extreme settings, near-plane and inter-fragment crossings. Capture verified output before updating the catalog. Targeted unit tests cover source geometry, UVs, phase envelopes, physical pattern differences, resource reuse, reconstruction and disposal. Numerical/geometry tests do not establish perceptual acceptance or GPU performance.
