# VACANCY phases 3–6 implementation report

The user-approved composition in `54fbd893` is preserved. `Cinema2VacancyStacking.ts`, original GLBs, runtime assets and model anchors are unchanged. Standard remains the default 10-TV 4–3–2–1 layout. No commit was requested; this implementation is uncommitted.

## Delivered

- Full four-parent inspector: shared BPM Sync, Music Response, Bass Rattle, Camera Motion, bounded Orbit Angle, Auto Performance, Pattern/Pattern Change/11 canonical Trigger choices, coverage, static, scanlines, tower sizes, media, finishing and five independent colours.
- Eight native programs: Dead Air, Channel Hop, Ascent, Collapse, Signal Sweep, Checker, Vacancy and Interference. Programs modulate screens without rearranging cabinets.
- Shared image/video/SVG media with repeated or stack-wide mapping, presentation transforms and CRT/static treatment. The native Three renderer borrows engine-owned textures and clears removed handles. Shared video loading now starts muted loop playback and honors transport pause/resume.
- Shared Audio Intelligence and Visual Director facts feed transient choreography targets. There is no new beat, phrase, build or drop detector. Preset BPM Sync uses the shared clock independently of Audio Dock Sync; OFF uses an authored 100 BPM clock.
- Canonical event deduplication, manual Pattern takeover including same-value reselection, bounded build/drop overrides, current-base restoration, hard-off controls, pause and discontinuity handling.
- Shared reflective floor, bloom and optional haze; explicit master blackout gates. Existing default room visibility and geometry remain intact.

Ownership, control/output and signal/response tables are maintained in [the behavior specification](cinema2-vacancy.md).

## Validation performed

| Check | Result |
|---|---|
| Focused Vitest run | 46 passed: layout/support 30, performance/authority 11, shared media runtime 5 |
| TypeScript | `npm run typecheck` passed |
| Focused ESLint | Changed TypeScript files and browser acceptance runner passed |
| Production manual controls | Primary continuous controls checked OFF/default/MAX, palettes, all tower sizes, BPM timing, orbit endpoints and camera motion/zero |
| Native programs | Every pair visually distinct; actual frame progression produces visible motion |
| Media | Image, SVG, dynamic recorded video, repeat/stack-wall mapping, CRT overlay, removal, video pause/resume |
| Audio and authority | Continuous energy, bass rattle, highlight event, all 11 trigger choices, held-event suppression, immediate manual takeover, Pattern Change preservation, temporary build behavior, pause, seek and master blackout |
| Lifecycle | Re-entry, portrait resize, context loss/restoration with resident media; restoration checks visible pixels after asynchronous assets become resident |
| Quality / framing | High landscape, low square and medium portrait captured; all report running with zero module/effect failures or browser errors |
| Diff review | Approved stacking source unchanged; no source assets or unrelated preset changes |

Browser checks use deterministic fixtures entering through the shared Audio Intelligence bridge and production Cinema 2.0 runtime, not mocked module output. Actual file uploads were replaced with in-browser image/SVG/recorded-video sources to keep the check repeatable. Live listening to a user-selected track was not performed. A repository-wide build/test suite was not run; validation was scoped to this implementation.

The latest video/music/authority run passed 12 checks, and the canonical-trigger/context-restoration run passed 13. Earlier manual/pattern/static-media checks were run separately; they were not repeated after unrelated audio/lifecycle fixes. Unit coverage also verifies base progression underneath overrides, return to the advanced base, drop cancellation and manual limits during pause.

## Reproduction and evidence

Run `npm run test:e2e:cinema2-vacancy -- /tmp/vacancy-review` for the complete production-canvas check. The runner requires installed Chromium (defaults to Google Chrome on macOS); set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for another location. Captures and JSON reports are generated outside tracked source.

This session's final evidence is under the ignored `artifacts/cinema2-vacancy/` folder:

- `music-media/report.json`: video playback/pause/resume and music/authority results.
- `triggers-lifecycle/report.json`: canonical triggers, resident-media context recovery and re-entry results.
- `quality/`: low square and medium portrait images and health snapshots.
- `visuals/`: default, orbit extremes, eight pattern captures, repeated image, stack-wall media and SVG.
- `checks/`: focused unit-test, typecheck and lint logs.

Failed intermediate captures are excluded from this handoff evidence. The full runner remains available to reproduce all checks together.

## Remaining limits and review

Orbit Angle is limited to −25..25 degrees, with bounded drift. A continuous full-circle camera path is not implemented: wider angles encounter the supplied room partitions. Removing that limit requires a separately validated camera path or room treatment while preserving the approved stack.

The agent visually inspected default framing, orbit endpoints, media layouts, sparse build output, lower quality/aspect captures and the restored media frame. Final human visual acceptance of motion, audio feel and finishing is still pending. Phase 6 therefore reaches automated/agent acceptance, not final human sign-off. No legacy comparison applies to this new preset.
