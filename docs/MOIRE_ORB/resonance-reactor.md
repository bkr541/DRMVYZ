# Moire Orb — Resonance Reactor

**Status: Complete — user accepted revision 2 and authorized completion.** All 20 focused tests, TypeScript, focused ESLint and production-browser checks pass; the user approved revision 2’s chamber depth, orb complexity and fixture detail ("Looks right"). No separate representative whole-song musicality review was performed; the user authorized completion with this disclosed limitation. Changes are uncommitted. The rejected first draft and its measurements remain in `evidence/acceptance.json`.

The existing preset name and ID (`drmvyz.cinema2.crate-moire-orb`) are preserved. The original five translucent meshes remain the hero, inside a complete constructed reactor environment. The source GLB is unchanged: SHA-256 `ece60ce04d0e7ede9f3e9d70d9e79a6a1b5db22134fdda7fbe44b2ef1abbc422`. Source geometry and UVs are shared; only private presentation transforms/materials are edited. This is a new environment around the supplied artifact, not an environment embedded in its GLB.

## Revision 2 visual specification

The first draft was rejected for a bland, shallow, overly bright chamber, a small/simple orb and insufficiently complex fixtures. This revision separates lighting density from global brightness:

- The original orb's nominal diameter increases from 4.5 to 6.4 world units (42%). Its five shells retain independent motion. A faceted nucleus, three twisted field coils, eight radial armatures, two toothed containment collars and six armoured vanes add internal and external detail. Shell Opacity reveals the internal mechanism without replacing the source lattice.
- Twelve recessed wall equipment bays contain backplates, projecting modules, heat-sink fins, pipes, collars, turbines, bolts and foreground service columns. Backplates at radius 14.6 and columns at radius 11.8 provide actual radial depth. Annular floor/ceiling machinery, concentric rims, 24 spokes per deck and suspension conduits complete the environment above and below.
- **240 addressable lighting cells** comprise the original **48 ring segments**, **48 containment electrodes**, **96 wall slots** and **48 deck cells**. Sparse scores differ by address and pattern. There are still **12 additional moving heads**; they are not counted as cells.
- Each larger moving head has a separate yawing yoke, motor base, fork, hinges, heat-sink fins, rear cap, bolted bezel, lens retainer, convex glass and small diode/status elements. Pitch and yaw follow the native target choreography. Every component remains geometry.
- Ambient, environment, direct-fixture output, beam width/haze and bloom defaults are reduced. Small local light banks provide contrast against dark matte machinery. Soft-sided beam volumes replace the flat cone washes. Shared depth-aware contact shading reinforces overlapping structures.

The helper batches repeated physical pieces into instanced meshes; it does not flatten the environment into a backdrop. All camera directions see real geometry. The default core/camera distance remains close enough to keep the orb dominant.

## Camera and timing

Shared camera runtime owns manual, horizontal and omnidirectional modes. Automatic flight changes heading and elevation through all three axes (approximately ±75°). Manual heading covers 360° and elevation ±89.9°. The authored orbit radius is 8.6, bounded 6.5–9 inside the chamber and outside the core assembly. Speed zero holds flight; Camera Motion OFF uses the shared base view. Geometry and fixture motion permissions are independent of camera motion.

Shared BeatClock supplies BPM Sync. With Sync ON, native phase and flight use shared tempo; OFF uses elapsed animation time. Idle motion is intentional. Pause holds clocks and poses. Seek/loop, track/revision changes and context generations clear temporary programs. No private detector or envelope scheduler is added.

## Pattern library

| Pattern | Geometry and lighting score |
| --- | --- |
| Core Ignition | Accumulating ring bands; a traveling containment/wall ignition sector; low inward fixture focus |
| Counter Rotation | Opposing gimbals, electrodes and wall-bank chases; alternating fixture banks |
| Vertical Surge | Rising wall/deck energy; rotating core layers; lower-to-upper fixture sweeps |
| Ring Chase | Traveling ring head/tail; separately phased wall/core/deck chases; orbiting beam targets |
| Pressure Lock | Ring contraction; focused electrodes and restrained wall light; converging beams |
| Radial Discharge | Ring expansion; outward bank release; spreading fixture fans |

Manual Pattern edits take immediate authority. Pattern Change uses the exact eleven canonical Trigger options, suppresses duplicate events and advances the effective base without changing the saved Pattern. Automatic transitions blend over a shared beat. Quaternions blend physical orientations along the short arc; fixture targets blend in world space, avoiding accumulated-turn whipping on long tracks.

Auto Performance may temporarily select Pressure Lock during a confident build (maximum 32 beats) or Radial Discharge after a drop (eight beats), then return to the continuing base. Manual edits, Auto OFF and zero Reactivity remove that temporary authority immediately. Saved Pattern Change, Trigger, colors and all other authored values are preserved.

## Ownership and visible controls

| Domain / controls | Owner and rendered consumer |
| --- | --- |
| Intensity | User baseline; shared Mood may multiply. Scales core, structure and lighting |
| BPM Sync / Reactivity / Auto Performance | User authorization; shared timing, target strength and Mood/Director policy |
| Pattern / Pattern Change / Trigger | User baseline; shared effective policy with bounded declared Auto substitutions |
| Geometry Motion / Motion Rate | User permission and rate; source layers, nucleus and gimbals |
| Core Scale / Shell Opacity / Core Glow / Layer Separation / Ring Travel | User baseline; source/core transforms, transparent shells, plasma emission and gimbals |
| Ring / Fixture / Chamber / Electrode Lighting | Four independent user baselines; segment materials, direct lights/lenses, 144 chamber cells and 48 electrode cells |
| Fixture Motion / Fixture Speed / Beam Width | Physical head/yoke aiming, target travel and beam spread |
| Camera mode, motion, speed, heading, elevation, distance, FOV | Shared camera runtime; actual perspective and orbit |
| Beam Haze / Contact Shading / Bloom / Tone Finish | World-space volumes; shared ambient occlusion, HDR bloom and filmic grade. Each has a true zero/OFF |
| Core / Rings / Fixtures / Chamber / Structure palette | Five independently configurable roles: lattice/nucleus, segments/cells, heads/beams, enclosing shell, mechanical surfaces |

Shared Parameter State stores baselines; Choreography and Mood resolve bounded live targets. The native module consumes these targets. Shared Inspector locks owned Design/Effects controls while Auto is enabled, retains layout and displays the effective Pattern/Trigger policy; Palette, BPM Sync and Auto remain editable. The module owns its procedural geometry/material/instance buffers. The shared Three bridge owns source assets. Render graph, depth, lighting, effects and cameras remain shared services.

## Audio and Mood mapping

All factors interpolate with Reactivity/signal strength and clamp to their advertised ranges. Multiply operations preserve hard lighting zeros. Geometry Motion gates physical displacement. No beat accent fires through silence; drop remains ungated.

| Fact or meaning | Bounded rendered response |
| --- | --- |
| Bass | Core Scale ×0.93 |
| Overall energy | Motion Rate ×1.3 |
| Highs | Ring Lighting ×1.2 |
| Vocals | Fixture Lighting ×0.6 |
| Kick | Ring Lighting ×1.45 / 0.25s; Electrode Lighting ×1.35 / 0.24s envelopes |
| Snare | Fixture Lighting ×1.5 / 0.22s; Chamber Lighting ×1.45 / 0.30s envelopes |
| Drop | Ring Travel ×1.4 / 1.5s and Core Scale ×1.12 / 1.25s; bounded Auto discharge |
| Director intensity/build | Beam Width ×1.18; authorized bounded Pressure Lock |
| Mood calm | Motion Rate / Fixture Speed ×0.6; Fixture Lighting ×0.7 |
| Mood momentum/energy/drive | Motion Rate ×1.25/1.18, Ring Travel ×1.35, Fixture Speed ×1.25 |
| Mood build/peak/shock | Layer Separation ×0.65; Core Glow, Electrode Lighting and bloom ×1.3; Ring Lighting ×1.4 |
| Mood activity | Chamber Lighting ×1.3 |
| Mood silence | Intensity, motion rates, all lighting, glow, haze and bloom ×0.1; effective Pattern Change holds |

Each factor multiplies the corresponding saved control (defaults are in `Cinema2MoireOrbPreset.ts`). The canonical Audio Intelligence supplies facts, Visual Director supplies broad meaning, Choreography delivers accents, and Mood supplies longer-span policy. None writes saved user values.

## Rendering and acceptance

All quality tiers preserve the original five meshes, 240 cells and 12 heads/beams. Direct light sampling is distributed across both fixture banks: high 12, medium 6, low 4. Moving shadows are disabled. Low quality may bypass shared contact shading; it retains all chamber geometry. Finishing order is scene color/depth → ambient occlusion → HDR bloom → cinematic finish. Grain and chromatic aberration are disabled.

Revision 2 passed 33 production-browser capture checkpoints and 15 measured pixel comparisons, including the new light-bank, shell-opacity and contact-shading controls. Source identity, cell addressability, resource ownership, audio authority and all-direction flight checks passed. No render/module/effect errors were recorded; context restoration and final zero remaining surfaces/leases passed. Validation and captures are recorded in [the revision acceptance record](evidence/revision-2/acceptance.json). Review images: [default](evidence/revision-2/default.webp), [patterns](evidence/revision-2/patterns.webp), [all directions](evidence/revision-2/views.webp), [before/after](evidence/revision-2/comparison.webp). The earlier [actual-source-soundtrack proof](evidence/source-soundtrack.json) verifies canonical Web Audio/analyzer integration; it is not a whole-song musicality review or an appearance reference.

Focused checks cover source identity, exact inventory, cell addressability, exposed LED faces, six native programs, motion permissions, hard zeros, all eleven Triggers, duplicate suppression, manual/Auto authority, long-track orientation blending, full camera travel, production pixel differences, shared audio/Mood policy, pause/reset, Inspector layout, quality tiers, context restoration and disposal. Human review remains a separate requirement under contract §20; passing these checks does not approve the visual direction.

Reproduce with `node scripts/run-cinema2-moire-orb-browser.mjs`; `--stage=visual|audio|performance|lifecycle` runs a focused segment. `MOIRE_ORB_OUTPUT` selects the artifact directory. The actual-input script is `node scripts/run-cinema2-moire-orb-real-audio-browser.mjs` and requires the supplied recording or `MOIRE_ORB_REFERENCE_VIDEO`.

No commit was requested. The pre-existing deleted Bass Sigil source-crate GLB and the DVYDRM model-viewer work are unrelated and preserved. Their known unrelated checks are not rerun for this revision.
