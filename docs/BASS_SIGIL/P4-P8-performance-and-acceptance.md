# Bass Sigil — performance and acceptance

Implementation scope: remaining P4–P8. The original supplied environment is preserved: cellular sphere, both faceted particle fields, metallic wordmark, diamond backing, red three-bar mark and glow planes. No replacement environment or generated artwork is used. The original GLB remains byte-for-byte unchanged.

Implementation and automated acceptance are tracked separately from human signoff. The catalog role remains **reference** until the required human A/B review and representative real-track review are complete. Deterministic music publications exercise the real shared production systems; they are not evidence of real-track musicality.

## Implemented performance

P4 adds a geometry score through shared Choreography target envelopes. A kick strokes the left bar immediately, middle bar after 0.125 beats and right bar after 0.25 beats. A snare twists the source membrane; a drop releases its scale. Score Amount (0–1, default 0.5) controls the score independently of the ordinary audio routes. Geometry Motion OFF suppresses its rendered motion. Core Travel zero prevents scored bar displacement. Beat-derived accents require `not-silent`; the drop release remains available through a silent stop.

All eight existing source-geometry programs remain available. New automatic pattern transitions blend source transforms and membrane vertices over one beat; drop entry uses 0.125 beats to land promptly. Manual Pattern edits take effect immediately, consume an already-active event and retain Pattern Change. The next fresh qualifying Trigger may advance the edited base. Every canonical Trigger routes through the shared event resolver, with duplicate suppression.

P5 uses Visual Director intensity for bounded geometry extent, momentum for logo sway, and confident build pressure for a temporary Lens Collapse. These are broad shared interpretations, not preset-local music detection. Build substitution ends when pressure falls or after 32 beats. A new drop interrupts it with Shock Bloom for eight beats, then restores the progressing underlying pattern. Pause holds the beat-based motion/transition. Track identity, seek/loop, audio discontinuity and context generations reset temporary state.

P6 uses `withCinema2MoodDrives`, all three policy tags, and one `Cinema2PatternControlResolver` on the actual native controller. Auto Performance defaults OFF. With it ON, shared Mood chooses effective Pattern Change and Trigger while saved choices stay intact. Without Mood/beat-grid choice, saved policy applies. Zero Reactivity removes every reactive contribution and temporary override. Turning Auto Performance OFF restores manual policy and removes Mood/Director drives.

| Shared source | Transient target | Maximum authored factor |
| --- | --- | --- |
| Calm | Motion Rate / Core Travel / Intensity | ×0.65 / ×0.55 / ×0.8 |
| Momentum / Energy / Drive | Motion Rate / Geometry Extent / Core Travel | ×1.3 / ×1.5 / ×1.4 |
| Build / Activity / Tense | Tunnel Depth / Particle Density / Membrane Opacity | ×0.85 / ×1.12 / ×0.8 |
| Peak | Core Glow / Bloom | ×1.25 / ×1.4 |
| Shock | Flares | ×1.6 |
| Silence | Motion Rate, Core Travel, Particle Density, Intensity, Core Glow, Logo Spin Rate, Bloom, Trails, Flares | ×0.1 |

These factors interpolate with conductor weight and the user's Reactivity. Shared target limits clamp the resulting values to their own UI ranges. Multipliers preserve hard zeros. Palette values are never automated. Geometry Motion and Logo Motion independently authorize their respective motion; camera motion remains under its saved mode and speed. The camera orbits the entire original environment, including above/below it; the logo also rotates and sways independently.

The existing shared Inspector supplies the Auto Performance lock: Design, Effects and other Master controls lock, BPM Sync and Auto Performance remain editable, Palette remains editable, and Reset Parameters is disabled. Effective slider values and pattern policy use the existing shared live display; no private Inspector controls or typography overrides were introduced.

## Finishing and ownership

P7 uses a single source scene with real depth followed by five explicit shared-runtime passes:

| Control | Default / range | Behavior |
| --- | --- | --- |
| Background Focus | 0.2 / 0–1 | Depth of field follows the camera target as it orbits or zooms. Broad focus range retains the logo's sharp bevels. Low tier bypasses blur. |
| Background Trails | 0.1 / 0–0.45 | Depth-masked history stores only background pixels; opaque wordmark/bar pixels never enter history. Paused/no-source/OFF clears history. |
| Bloom | 0.3 / 0–0.8 | Restrained HDR halo, keeping the dry source geometry recognizable. |
| Flares | 0.15 / 0–0.6 | Short highlight glints. Low tier bypasses streak sampling. |
| Tone Finish | 1 / 0–1 | Filmic exposure/contrast and mild vignette, with chromatic aberration disabled. |

The shared depth-of-field effect gains an opt-in `focusCameraTarget` parameter; its default behavior remains unchanged for other presets. The new depth-trails type allocates only when authored. Shader objects and full-screen geometry are instance-owned; its textures use the engine History service and are released at disposal. History follows shared seek/context/resize lifecycle. No trails are added to the hero. Private source-geometry clones preserve the original mesh topology and UVs and are disposed by the model controller. The shared Three bridge retains GPU ownership.

A small optional read-only inspection hook exposes effective native pattern policy in runtime snapshots. Diagnostics cannot interrupt rendering if inspection throws. This makes the real controller auditable without a second animation scheduler or detector.

## Acceptance record

Focused tests cover source identity/hash, all 11 Triggers, duplicate handling, manual cancellation, canonical tempo and pause, native geometry and logo motion, full camera orbit, source-reset behavior, score delays, hard disables, Mood tags/compiler rejection, ON/OFF/no-Mood/zero-strength differentials, live values, silence, drop restoration, camera-target focus, shared module lifecycle and target bounds.

Production-browser acceptance uses `scripts/run-cinema2-bass-sigil-performance-browser.mjs` and the actual Cinema2Runtime, real Three/WebGL renderer, real shared Audio Intelligence bridge, Visual Director, Mood Conductor, Choreography and React Inspector. It captures isolated effect OFF/max, default finish, calm/vocal, drive, build, drop, silent-stop, Inspector lock and quality tiers. Automated checks include saved-state preservation, pause/seek/track reset, depth-history deactivation, context restoration, render/effect/module failures and zero active surfaces/leases after disposal.

Validation completed on 2026-11-18:

- 57 focused native/shared-runtime tests passed, plus 18 shared Inspector/live-display tests (75 distinct checks). The pause correction and all eleven Trigger cases passed in the focused native rerun.
- TypeScript and focused ESLint passed; diff whitespace and scoped working-tree review passed.
- Production effect/musical scenarios passed through the silent-stop/drop check. The remaining pause/seek/track/Inspector checks and context/quality checks passed in focused follow-up runs after correcting pause-hold behavior and the test harness’s retained context-loss handle.
- Shared Inspector: 29 locked wrappers, identical 1960px panel height ON/OFF, identical control rectangles, editable Palette/BPM/Auto, and visible live-policy text. A reserved policy slot prevents its text from shifting rows and avoids the production shell’s hidden helper-copy style. It reuses the shared field-value typography role.
- WebGL loss/restoration, high/medium/low rendering and portrait resize passed with no failed module, effect or render pass; disposal left zero active leases and surfaces.
- Actual source soundtrack passed through Web Audio → canonical analyzer frame pump → AudioFeatureBus → the persistent shared bridge → native rendered targets. The quiet reference audio used +32 dB test-only gain. Over 227 canonical samples, Motion Rate reached 1.25 and Membrane Scale reached 1.1195; cleanup left zero leases/surfaces. This proves live source integration, not representative whole-song musicality. See the [source soundtrack report](evidence/final/source-soundtrack-report.json).
- Original GLB SHA-256: `3b74af78b57b0dd24727a06f41a16064af3044ded52118700fbe6008cb1843cc`.

Evidence: [performance captures](evidence/final/performance-review.webp), [reference comparison](evidence/final/reference-comparison.webp), [Inspector](evidence/final/inspector-auto.webp), [measured effects and runtime acceptance](evidence/final/acceptance-evidence.json). The production thumbnail was refreshed from the rendered default view.

The user reviewed the final captures and answered **“Looks right”** to the environment/finishing direction. This approves their visual direction; it does not substitute for a moving, representative real-track musicality review.

## Remaining release acceptance

The user has approved the environment and finishing in the final captures. Remaining human review concerns motion, timing, musicality, camera travel and manual authority against moving reference and representative music. A representative real-track audition is also outstanding: the supplied video has very quiet audio (mean −57.4 dBFS) and is not a substitute for quiet, vocal, groove, build and drop passages from a representative track. Neither can be marked passed by an unattended automated test.

Changes are uncommitted; no commit was requested. Existing Open Decks work is preserved. No production promotion or unrelated cleanup was performed.
