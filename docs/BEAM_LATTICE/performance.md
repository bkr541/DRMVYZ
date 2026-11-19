# Beam Lattice — full native performance

**Current repair:** the user rejected both the original performance and the subsequent external orbit for leaving large empty regions. The latest correction keeps the camera inside the laser field and fixes source-scale amplification and repeated-frame rotation accumulation. Earlier captures and passing checks are historical; they did not establish visual acceptance.

Scope: complete the required controls, native geometry programs, shared Audio Intelligence/Choreography/Director/Mood integration and production checks. The current original four-bank, full-frame yellow reference presentation is the default. Laser Loom is cancelled. No environment is added. This document supersedes the original-only scope; the source GLB stays unchanged.

## Visual and geometry specification

Right-handed source scene, Y up. Four original 200-triangle ray banks remain independently addressed in real 3D. Reference View keeps the camera at [−0.021289,0.286656,0.82], looking down −Z, FOV154°. The source parent clip provides baseline rotation/scale. Shafts extend fourfold beyond the viewer so their finite endpoints do not enter the camera envelope. Parent-normal scale compensation prevents the source’s 20× stretch from amplifying small pattern tilts. Native programs add bounded local bank rotations and widths around each original emitter pivot; no source position/UV/index data is rewritten. Opaque rays remain depth-tested and supersampled 2× before shared HDR bloom. Clipping at frame edges is intentional, matching the video; no new room, floor or decorative fixtures enter the image.

Seven programs retain the authored clip: Reference Fan; Counter Sweep (oscillating bank tilt); Iris Gate (staggered lane expansion); Scissor Cross (larger tilting score and expanded lanes); Bank Relay (traveling width/light emphasis); Pressure Cage (inward tilt with pulsing lane spacing); Radial Release (wide outward sweep). All banks retain their full shaft coverage and a nonzero pattern lighting floor. Explicit user lighting/intensity zeros remain authoritative.

## Authority and controls

| Property | User baseline / consumer | Audio/Director/Mood | Manual edit behavior |
| --- | --- | --- | --- |
| BPM Sync | Shared BeatClock, clip and bank timing; ON follows canonical analyzed/host BPM, OFF uses 120 reference BPM | No second clock or detector | Editable even with Auto on |
| Intensity / Reactivity | Visible emission / modulation strength | Bounded multipliers, zero remains zero | Locked while Auto on |
| Auto Performance | User authorization | Shared policy and bounded programs | Editable |
| Pattern / Pattern Change / Trigger | Seven programs; canonical eleven-event advancement | Shared effective policy, bounded build/drop substitution | Locked while Auto on; immediate manual takeover otherwise |
| Motion Rate | Clip and native bank timing | No geometry/choreography freeze toggle; saved obsolete toggle values are ignored | Locked while Auto on |
| Aperture / Bank Travel / Beam Thickness | Ray lane span, native rotation depth and true shaft width | Bass compression, energy movement, drop expansion | Locked while Auto on; continuous modulation of moving banks |
| Upper / Lower / Left / Right Lighting | Four original banks independently | Highs, vocal restraint, kick/snare and Mood | Locked while Auto on; zeros remain zero |
| Upper / Lower / Left / Right colors; Background | Five independent spatial palette roles | Never replaced by automation | Editable |
| Camera Mode / View Motion Speed / manual heading, elevation and distance / FOV | Shared bounded interior path, reference view or constrained manual view | BPM-aware shared camera timing | Locked while Auto on |
| Bloom | Shared HDR bloom intensity, true OFF | Mood peak/silence | Locked while Auto on |

Precedence: authored Pattern → effective shared Trigger advances the continuing base → a bounded authorized build/drop may substitute → continuing base returns. Saved values never change. Manual edits, zero Reactivity and Auto OFF restore the selected/base authority immediately. Pause freezes clocks, program blending and geometry; seek/loop/source/context changes reset temporary programs. Canonical event identities suppress duplicates. Initial idle is the reference clip, slowable/freezeable by the user.

Auto build: Pressure Cage, maximum32 beats. Auto drop: Radial Release, eight beats; drop is ungated, beat accents have not-silent conditions. The shared Mood chooser may choose among this preset's programs on supported musical boundaries when effective Pattern Change is off. Auto defaults OFF.

## Signal and Mood score

Bass → Aperture ×0.86; energy → Motion Rate ×1.3; highs → Upper/Right lighting ×1.2; vocals → Lower lighting ×0.65. Kick → Upper/Lower lighting envelopes ×1.4/0.25s. Snare → Left/Right lighting ×1.5/0.22s. Drop → Aperture ×1.12 and Bank Travel ×1.35 over1.2s, without gating base animation. Director intensity → Bank Travel ×1.15 only under Auto authorization.

Mood drives multiply saved baselines: calm Motion Rate×0.6 and Lower Lighting×0.75; activity Bank Travel×1.2; momentum Motion Rate×1.2; drive Bank Travel×1.2; build Aperture×0.8; peak Upper/Right Lighting and Bloom×1.3; shock Left Lighting×1.4. Silence Intensity, Motion Rate, all four lighting banks and Bloom×0.1 and holds effective Pattern Change. All values clamp to exposed ranges. No color chooser, local analyzer, private rhythm clock or independent envelope scheduler is introduced.

System ownership: shared Parameter State and target resolver own authored/live values; Audio Intelligence supplies facts; Director/Mood supply meaning/policy; Choreography owns timed modulation; native module owns source-bank pose/emission only. Shared camera and render graph remain. Shared asset/bridge own source resources; controller disposes only animation state. No allocated per-frame geometry. All quality tiers keep all source meshes; shared bloom quality adapts. No commit requested.

Human visual/musical acceptance remains separate from technical checks.

## Implementation and authority details

All functionality above is implemented. Shared BeatClock advances source-clip time at 120 BPM reference / current BPM when Sync is on; host BPM metadata is a fallback to analyzed tempo. The preset toggle governs these timing domains, independently of the Dock Sync preference, and Choreography's `tempoSyncParameter` uses the same authorization. Speed changes preserve phase. With no source loaded, explicit idle motion uses the shared frame timestamps; inactive loaded-source transport and pause hold it. No private wall clock is created.

Pattern selection is immediate on manual edit, including while Pattern Change remains enabled. Automatic program changes blend over one shared beat. Seven bounded local transform scores blend geometry dimensions and rotations without accumulated spins. Base animation is continuous. The retired Geometry Motion toggle no longer appears or controls timing, patterns or choreography; an unbound hidden legacy value only allows old saved states to restore without discarding other settings. Bank Travel also scales the source clip's excursion, so it remains visible on Reference Fan rather than only the additional programs. Colors affect the four spatially distinct source banks; Background controls the shared environment surface. Every exposed parameter has a real native/shared consumer.

Auto uses the shared `Cinema2PatternAutoPerformance`, `Cinema2PatternControlResolver` and Mood chooser. Calm options: Reference Fan / Iris Gate; driving: Counter Sweep / Bank Relay; tense: Scissor Cross / Pressure Cage; peak: Radial Release / Counter Sweep. The optional shared chooser acts only on supported musical boundaries when effective Pattern Change is off, with shared minimum hold/deterministic selection. Pattern Change still uses the shared Mood policy and canonical Trigger ladder, never a preset-local replacement.

No source mesh data, animation track or original GLB bytes are edited. Per-instance pose/material overrides and the four original beam banks produce all new programs. The shared Three bridge still owns source assets and material clones; controller disposal only releases mixer state. Bloom has true zero output contribution. Palette colors, lighting zeros and lighting permissions remain authoritative.

## Earlier implementation checks (historical)

Passed 17 focused tests, TypeScript, focused ESLint and diff whitespace checks. These cover exact source hash and reference default pose, seven distinct physical programs, independent hard lighting zeros, obsolete-toggle immunity, native BPM/pause/speed behavior, idle versus inactive transport, all eleven canonical Triggers with duplicate suppression, manual Pattern/Auto/zero-reactivity authority, bounded drop return/source resets, and the shared Mood migration suite (tags, control bindings/live values, peak/calm/shock/silence, zero strength and saved-state preservation). The scoped crate registry check passed; the unrelated all-crate source-copy and Paradox material checks were skipped.

Production-browser evidence verifies seven distinct rendered programs, all five palette roles, geometry/light/effect/lens min/max, rate zero, saved re-entry, independent bass/high/vocal pixel changes, kick/snare accents, hard lighting zeros, shared Director build/drop programs and bounded return, pause, silence hold, ungated drops, manual takeover, seek/track reset, all quality tiers and portrait framing. It verifies actual live policy readouts, disabled Design/Effects controls, editable Palette/BPM/Auto, identical control geometry with Auto on/off, context restoration and zero remaining surfaces/leases. BPM Sync ON at 180 BPM visibly advances faster than the free 120 BPM reference; switching preserves phase.

A six-second deterministic bass/high PCM signal passes through actual Web Audio and the canonical analyzer pump/feature bus/persistent bridge into the rendered aperture and speed targets. This is real analyzer-path integration proof, not a whole-song musicality review. The optional failed attempt to read soundtrack audio from the Desktop recording was replaced with deterministic PCM; the recording's cached visual reference frames remain the visual source.

Evidence: [seven programs](evidence/performance/patterns.webp), [default](evidence/performance/default.webp), [build](evidence/performance/build.webp), [drop](evidence/performance/drop.webp), [silence](evidence/performance/silence.webp), [Inspector](evidence/performance/inspector-auto.webp), [acceptance measurements](evidence/performance/acceptance.json).

Reproduce with `node scripts/run-cinema2-beam-lattice-browser.mjs`; `--stage=visual|timing|audio|performance|lifecycle` runs a focused segment. Human review of final composition, program motion and representative musicality remains pending under contract §20. Technical checks do not establish perceptual acceptance. Changes are uncommitted; no commit was requested.


## Repairs to reported failures

- Removed the visible Geometry Motion/Choreography freeze toggle. Its obsolete saved value is hidden and unbound. Motion Rate is the explicit speed control.
- Fixed emitter pivots at the bank midpoint so aperture changes do not open artificial gaps. Removed independent bank yaw/roll and shortened shafts.
- Pattern Trigger uses canonical events first and the existing shared Mainframe tempo fallback where explicit beat events are unavailable. Coarse positive transport updates no longer reset selection.
- Replaced the rejected external orbit with a bounded 14-second interior path. Reference View is static; Manual View stays within the same safe envelope. FOV is 148–158°, position bounds are [−.046289,.261656,.8] to [.003711,.311656,.84], and target offsets are disabled. Camera limits also constrain restored settings.
- Bank Travel is calibrated against the clip’s evaluated starting pose rather than the unanimated bind pose. Animated quaternion samples are restored before each mixer evaluation: Three’s cached unchanged samples otherwise let repeated renders compound the travel multiplier until the field collapsed.
- Pattern tilt compensates for the original parent’s 20× normal-axis stretch. A small intended tilt previously became a large physical fold, turning banks away from the camera.

The latest coverage script renders all seven programs at twelve clip phases in wide, square and portrait layouts, at the centre and three camera-envelope corners, with minimum aperture, maximum Bank Travel and maximum FOV. It checks actual image tiles for empty peripheral regions; the small reference centre aperture is excluded. Threshold: tile luminance ≥25/255, compared with ≥51/255 across the sampled reference recording. This checks default yellow lighting and bloom, not deliberate user blackout settings.

Latest repair evidence and check results are recorded in `evidence/coverage/`. Reproduce with `node scripts/run-cinema2-beam-lattice-coverage.mjs`. Focused interaction checks: `node scripts/run-cinema2-beam-lattice-browser.mjs --stage=fixes`. No new user acceptance is presumed. Changes remain uncommitted.

## Latest verification

21 focused tests, TypeScript, focused ESLint and diff whitespace checks passed. New regressions verify held-timestamp render stability and bounded tilt under the source parent’s twentyfold scale. The focused production-browser interaction check passed for camera movement, tempo-only Trigger progression, absent freeze toggle and clean resource disposal.

All **1,008 rendered coverage checks passed**, with no page errors: seven patterns × twelve clip phases × four allowed camera positions × three aspect ratios. Lowest peripheral tile luminance was **56.52/255**, above the 25/255 empty-region threshold and comparable to the sampled reference minimum (51.45/255). This evidence is bounded to the tested geometry/control envelope with default yellow lighting and bloom; deliberate user blackout/color/effect edits are respected.

Evidence: [current production render](evidence/coverage/current-render.webp), [worst stress frame](evidence/coverage/worst-stress-frame.webp), [coverage measurements](evidence/coverage/coverage.json), [check record](evidence/coverage/checks.json). The earlier external-orbit captures are superseded. No commit was requested or created.

## Visual repair, 2026-11-18

The user found the preset "extremely basic": four flat yellow banks whose seven programs were near-identical (tilts of at most 0.14 rad, one shared motion). Changes: (1) each program now gives the four banks different parts (opposite banks sweep against each other, the light chases or hands off bank to bank, iris gates breathe and flash, the fans lean in and pulse) with sweep angles up to the 0.22 rad fold limit; (2) the default palette is four hues (upper magenta, lower cyan, right yellow, left violet) instead of one yellow, and the bloom tint is neutral so it no longer washes the frame olive; (3) the hidden legacy Geometry Motion value is removed (revision 6). The empty-region check (`scripts/run-cinema2-beam-lattice-coverage.mjs`) passes all 1,008 frames. Not changed: the camera envelope (kept inside the field so no region empties) and there is still no floor, haze volume or environment; that would be a separate decision. Human review of the look and of the programs against real music is still pending.
