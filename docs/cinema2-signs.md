# SIGNS | Cinema 2.0 first-party preset

## Visual specification and asset provenance

Original Cropcircle Glow Motion GLB, Miguelangelo Rosario, CC BY 4.0. The supplied 746,524-byte GLB is bundled unchanged at `public/cinema2/models/signs.glb`; SHA-256 `4cfa0d05a5125e7fe3cc9a63f601245028e9630502699c663ed75ac0c7d44a3a`. The model comprises a static slotted dark foreground plate (8,036 triangles), rotating emissive textured plane (26 triangles), and one 33.333-second rotation clip. The multicolored interlaced texture is an illumination source behind the plate; the aperture geometry remains intact. No duplicate GLB, textures or reference screenshots are shipped. The native controller scales the scene to a two-world-unit plate, keeps the original material maps, and adds sixteen short orbit markers outside the aperture. The front camera uses a 42-degree perspective and fit-to-width projection on narrow stages. The plate is dark with restrained key and fill lighting, and its slots reveal the moving color. The orbit markers provide a distinct secondary rhythm without replacing the sign.

## Pattern library

Each pattern modulates the original emissive map in local UV space. The same angular score drives the outer markers; the radial programs generate a full ring response at the perimeter. A one-beat smooth transition blends automated changes; a manual selection takes effect immediately.

| Pattern | Spatial and timing score |
|---|---|
| Signal Breath | Whole sign breathes gently, preserving the multicolor artwork. |
| Radial Relay | A narrow angular sector travels clockwise. |
| Counter Sweep | Two opposing angular sweeps overlap, one at reduced gain. |
| Cross Talk | Four interleaved banks alternate with phase. |
| Inward Lock | Concentric waves move toward the center; build override. |
| Full Contact | Broad double-rate expanding waves; drop override. |
| Orbit Code | Six narrow traveling angular sectors create syncopated perimeter motion. |
| Afterimage | Main chase followed by two progressively dimmer phase-offset echoes. |

## Ownership and control-to-output map

Audio Intelligence supplies transport, musical events, tempo and bands; Visual Director supplies momentum; Mood Conductor supplies shared mood and effective trigger choice; choreography resolves bounded temporary parameter contributions; native controller owns shader, authored clip sampling and markers; shared camera and effects own camera and postprocessing. No local analyzer, parallel transport, shared component changes or database migration.

| Parent | Control | Visible result |
|---|---|---|
| Master Controls | Auto Performance | Allows shared mood drives and temporary pattern overrides; standard inspector lock. |
| Master Controls | BPM Sync | Shared beat clock vs 120 BPM free-run for lighting, original clip time for rotation, shared camera tempo. |
| Master Controls | Intensity / Audio Reactivity | Emission and perimeter gain / strength of choreography and mood drives. |
| Design / Pattern | Pattern / Pattern Change / Trigger | Authored score, runtime-only advancement on fresh selected event, eleven shared trigger options. |
| Design / Signal | Rotation Rate / Chase Rate / Chase Depth | Original clip rate / light-phase rate / mask contrast. Zero holds the corresponding motion or removes chase contrast. |
| Design / Signal | Signal Accent / Outer Markers | Accent color blend / marker brightness (zero hides markers). |
| Design / Camera | Camera Mode / Camera Motion / Camera Speed | Front lock, shallow drift or dolly; hard motion off restores frontal view; speed controls the shared path clock. |
| Effects | Bloom / Cinematic Finish | Shared HDR bloom intensity and final tone-mapping mix. |
| Palette | Original Neon Tint / Signal Accent | Multiplicative source tint (white retains original) / traveling accent tint. |
| Palette | Outer Markers / Dark Structure / Background | Independent perimeter emitter, plate material and background colors. |

### Authority and timing

Auto Performance defaults off. Pattern Change defaults off and never writes the saved Pattern. Manual pattern edit resets the runtime base immediately while retaining Pattern Change; trigger changes do not replay an old event. The shared event latch, effective pattern policy and pattern controller own event freshness. Builds use Inward Lock for at most 32 beats and drops Full Contact for 8 beats, then resume the maintained base; manual edits cancel overrides. Turning Auto Performance off restores authored authority. Pause freezes clip and lighting phases, track/seek/context discontinuities reset transient state. No source runs the authored idle loop. With sync enabled the clip completes a turn per 32 beats at rotation rate 1, lighting phase per four beats at chase rate 1; with sync disabled the clip uses its original 33.333-second cycle and the lighting runs at the shared 120 BPM reference rate. Camera timing follows the existing camera runtime.

## Choreography and mood map

| Musical source | Resolved target | Direction / factor at full strength |
|---|---|---|
| Bass | Chase Depth | ×1.25 |
| Highs | Outer Markers | ×1.55 |
| Overall energy | Chase Rate | ×1.30 |
| Vocal presence | Signal Accent | ×0.50 |
| Director momentum | Rotation Rate | ×1.20 |
| Kick | Intensity | ×1.30, .28s release |
| Snare | Signal Accent | ×1.70, .24s release |
| Drop | Markers / Intensity | ×1.80 / ×1.45, 1.25s / .9s release |
| Mood calm | Rotation Rate / Finish | ×0.45 / ×0.75 |
| Mood momentum | Chase Rate | ×1.50 |
| Mood build | Chase Depth | ×1.40 |
| Mood peak | Outer Markers | ×1.50 |
| Mood shock | Accent | ×1.45 |
| Mood brightness | Bloom | ×1.45 |
| Mood silence | Intensity / chase / rotation | ×0.08 / ×0.10 / ×0.10 |

All drives are baseline-relative, parameter-range bounded and scaled by Audio Reactivity. Continuous audio routes and beat accents carry `not-silent`; drop envelopes are never gated. Auto Performance domains are Design, Effects and Master Controls, with the standard exception for the Auto Performance and BPM Sync toggles. The existing catalog auto-coverage step fills uncovered numeric controls. The shared Inspector owns live readouts, Pattern Change/Trigger choosing notes and lock behavior; Palette remains editable. No new inspector implementation.

## Acceptance and release status

Selectable native `reference` entry, following the repository's pending-human-acceptance convention. Before promotion to keeper, check the actual production Stage at 16:9, 1:1 and 9:16, compare the original aperture composition, exercise all patterns and min/default/max sliders, test sync/unsync, pause/seek/loop, fresh kick/snare/bar/phrase/drop and re-entry. Capture evidence in ignored `artifacts/`, not runtime folders. Unit coverage in `Cinema2SignsPreset.test.ts` covers asset hash, registration, schema, patterns, runtime event handling, pause and shared choreography. Real WebGL shader compilation, production browser capture and human visual acceptance remain required. No legacy port or A/B parity requirement.
