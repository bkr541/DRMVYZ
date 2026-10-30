# Ifrit — corrected visual and performance contract

Reference: `/Users/kodyrobinson/Desktop/Ifrit.mov`, 712 × 1006, approximately 16.85 s.
Governing standard: [Cinema 2.0 Preset Creation Contract](../../DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md).
Stable preset ID: `drmvyz.cinema2.ifrit`; catalog role remains `reference` for review.

## Correction scope

The earlier implementation was rejected for an excessively deep regular corridor,
small terminal opening, sparse static wall rails, generic motion, shallow musical
responses, unused transitions and weak acceptance criteria. Earlier static approval
and passing plumbing tests do not establish acceptance of the corrected performance.
This document supersedes the previous implementation/acceptance claims.

The reference establishes an orange extruded hexagonal passage, a substantial dark
opening, dense red mechanical surroundings, strong changes of foreground scale and
relative ring orientation, alternating sparse/stacked compositions, and luminous
edges against dark surfaces. Its original rendering technique and exact musical
causality are unknown. No local beat/drop detector is introduced to imitate it.

## Geometry and rendering

- Right-handed world coordinates; passage along negative Z, X right, Y up.
- Camera at `(0,0,0)`, target `(0,0,-10)`, zero roll, static rig. Authored FOV 70°,
  minimum aspect 1, centered fit-to-width in portrait, near/far 0.1/30.
- Position and target offsets have zero allowance. FOV safety is 69.9–70.1°;
  shared aspect fitting widens effective portrait FOV after authored-pose bounds.
- Five default portals; user count 3–12. Their depth distribution interpolates
  four reference anchors: 2.4, 4.0, 6.6, 10.8 world units. This replaces the old
  six-anchor corridor extending to 20.5 units. Count changes genuine geometry.
- Portal centerline radius 3.15; front contour radii 3.08/3.22. Structural beam
  width/depth 0.12/0.30. Contour cross-section 0.045; front/rear offsets ±0.17.
  Independent amber corner links cross the annulus and connect its extrusion.
- Near-frame cropping is intentional. The terminal opening is approximately
  17–20% of the shorter viewport dimension in horizontal radius at the frozen
  reference pose; it remains black and centered. Perspective never stretches it.
- Three surrounding mechanical layers at radii 3.9, 4.12 and 4.34: fragmented
  longitudinal conduits, transverse braces, dark panel bodies and narrow lit panel
  edges. Deterministic omissions break up the grid. Face lighting preserves dark
  material and depth rather than uniformly illuminating every beam.
- Walls and portals share one axial travel phase. Wall pieces wrap rigidly by
  their common midpoint; endpoints cannot wrap separately and stretch a beam.
  The passage period is 13.6 × authored spacing. Recycled segments fade at the far
  end; the camera stays fixed. Wall roll is 22% of the portal spin phase.
- GPU geometry is uploaded once and engine-leased. Native CPU poses provide each
  portal's distance, angle, radius and illumination; the shader consumes all four.
- Real depth testing, opaque materials, floating-point scene target and shared
  HDR bloom. Bloom is optional finishing, never a substitute for visible geometry.
  Trails, blackout/strobe effects, large camera orbits and particles are omitted.

## Authored pattern performances

All six patterns use native poses, not color aliases. Movement includes deliberate
anticipation, accelerated opening, a hold, and controlled retrace. The normalized
stroke rests through 18%, opens through 56%, holds through 72%, then recovers.

| Pattern | Performance |
|---|---|
| Infernal Passage | Depth-weighted opening/alignment strokes around a centered axial passage; near frames carry the dominant weight |
| Twisted Descent | Coherent depth helix, phase-offset radial breathing and changing illumination along the helix |
| Counterfire | Opposing ring banks, staggered axial movement and complementary bank illumination |
| Compression Chamber | Compression about an interior depth pivot, opposing wind-up, restrained aperture tension, recovery |
| Ember Relay | Travelling depth illumination with a spatially matched radial impulse; the passage stays legible between arrivals |
| Rift Lock | Offset opposing frames move into aligned architectural holds, then unfold in angle/radius/depth |

Pattern changes render a 180 ms eased interpolation of actual pose properties,
using the shortest angular path. Manual selection is immediate. `previous` and
`transition` from the performance controller are consumed by the renderer path.

## User control and authority

All parameters use generic schema/bindings and the existing shared typography.
Design inspector top-level parents: Master Controls, Design, Effects, Palette.

| Parent | Controls and defaults | Visible consumer |
|---|---|---|
| Master Controls | Master Intensity 1 (0–1) | All emitted and structural light; zero leaves Background |
| Master Controls | Music Reactivity 0.65 (0–1) | Strength of musical/Director choreography |
| Master Controls | BPM Sync ON | Shared musical position for passage/rotation/score; host Sync is not a veto |
| Master Controls | Auto Performance OFF | Permission for bounded build/drop performance substitutions |
| Design | Pattern: Infernal Passage | Six native pose programs |
| Design | Pattern Change OFF | Shared fresh-event advancement of runtime base |
| Design | Trigger: Phrase | Exact canonical 11 options; conditional on Pattern Change |
| Design | Frame Count 5 (3–12) | Visible portals |
| Design | Aperture 1 (0.8–1.2) | Common portal/environment XY scale |
| Design | Frame Spacing 1 (0.75–1.4) | Portal depth distribution and passage period |
| Design | Frame Thickness 1 (0.5–2) | Real contour/body dimensions |
| Design | Travel Speed 0.6 (0–2) | Axial motion; zero holds phase |
| Design | Rotation Speed 0.15 (-1–1) | Signed angular motion; zero holds base angular phase |
| Design | Twist Amount 0.45 (0–1) | Pattern-specific relative angular/radial/depth excursions |
| Design | Wall Detail 1 (0–1) | Real conduit/brace/panel occupancy |
| Effects | Bloom 0.28 (0–0.65) | Shared HDR halo; OFF preserves base geometry |
| Palette | Background / Portal Emission / Wall Emission / Corner Highlights | Four independently configurable color roles; body tint derives from subdued wall material |

| Domain | Ownership / composition | Manual behavior |
|---|---|---|
| Pattern | Manual authored base → optional selected Trigger progression → temporary authorized override → current base resumes | Immediate selection; preserves Pattern Change; active events watermarked |
| Pattern Change / Trigger | User-owned permission/event selector | OFF holds base and preserves hidden Trigger selection |
| Count / thickness / aperture | User-owned geometry bases | Immediate visible edits; no hidden replacement |
| Travel / rotation | Authored rates over canonical position | Live rate/sync edits preserve phase; zero holds governed motion |
| Spacing / twist | User base plus documented bounded spatial gestures | No persisted parameter mutation |
| Intensity / detail | User ceiling | Master zero removes geometry light; detail zero removes all wall layers |
| Palette | User-owned | No automatic color replacement |
| Camera | Fixed authored framing | No automatic movement or hidden control |
| Bloom | User-owned finishing amount | Zero stays zero; no automation enables it |

Canonical Trigger options are reused from `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS`:
beat, kick, snare, downbeat, beat2, beat4, bar, bar4, bar8, phrase, drop.
Duplicate events, current events on manual edits, and toggle/Trigger changes are
watermarked using the established shared controller semantics.

## Spatial musical score

Audio Intelligence supplies facts; Visual Director supplies broad significance.
Shared Choreography owns event identity, delayed actions, envelopes and reset
lifetime. It writes transient module targets, not saved user parameters. The native
score composes those resolved values with the current pattern and authored bases.
No preset-local event detector or alternate musical clock exists.

| Source | Targets and bounded spatial purpose | Attack / hold / release; delay |
|---|---|---|
| Kick | Near → middle → far ring impulse; depth-specific axial shift (up to 0.45 units), radial impulse (up to 8%) and light accent; pattern-specific gain | 12/25/200 ms, 18/25/220 ms, 25/30/260 ms; delays 0 / 0.16 / 0.32 shared beats |
| Snare, shared half-bar banks (backbeats 2/4 alternate) | Independent left/right wall banks; no whole-canvas brightness replacement | 8/25/180 ms, zero delay |
| Downbeat | Near-depth architectural accent | 20/40/250 ms |
| Phrase / section change | Far-depth and wall transition accent | 60/100/500 ms with 0.15 beat delay / 60/120/600 ms |
| Drop | Foreground expansion (up to 15%) → angular alignment (85% toward nearest hexagonal lock) → bounded recovery | 25/80/320 ms at 0 beats; 80/160/450 ms at 0.45 beats; 150/100/750 ms at 1 beat |
| Bass | Near-weighted pressure, up to 3.5% radial contraction | 120 ms smoothing |
| Highs | Spatial wall shimmer | 90 ms smoothing |
| Vocals | Up to 28% wall occupancy restraint and 25% far-ring light restraint | 250 ms smoothing |
| Overall energy | Environmental activity and depth lighting; never timeline speed integration | 180 ms smoothing |
| Build | Gather depth → opposing wind → brace; bounded depth/radius/angle around user settings | 200 ms smoothing |

Build progress is routed independently from strength so every build chapter remains
reachable at reduced Reactivity. Zero Reactivity suppresses all geometric build
modulation. Ungridded snares use a bounded left-then-right gesture from the same
shared event, rather than fabricating beat parity.

Director intensity changes lighting contrast; momentum changes bounded geometric
excursion; variation changes small depth-relative angular detail; build supplies
pressure context; impact scales the strength of authorized kick/drop gestures without changing time. These meanings
are kept distinct rather than reduced to one maximum speed factor.

Auto Performance remains separate from Pattern Change. A new build section may
own a temporary build performance for at most four seconds or until the build ends.
A new drop may substitute Rift Lock for 1.2 seconds. Underlying pattern progression
continues during the override. Manual selection cancels the current override;
only a separately qualifying later event can authorize another.

## Timing and lifecycle

The timeline reads shared beat index/phase when available; seconds plus shared
BPM fallback govern unsupplied grid cases. Sync OFF uses authored seconds-based
motion. No-track movement is 12% of the authored rate. Energy never enters an
accumulated clock rate, so a different energy history cannot change reconstructed
phase at the same canonical position. Loaded/paused playback holds musical time.

Live rate/Sync edits preserve the current phase. Seek, loop, track/analysis changes
and re-entry reconstruct the current authored pose and clear volatile score state.
Shared Choreography clears delayed events/envelopes on discontinuities. Pattern
watermarks prevent stale-event replay. Zero travel/rotation freezes procedural
score progression; rhythmic responses remain available unless Reactivity is zero.

## Validation and review

Commands:

- `npm run typecheck`
- `npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2IfritMotion.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2IfritPreset.test.ts`
- `npm run test:e2e:cinema2-ifrit`
- `node scripts/run-cinema2-ifrit-browser.mjs --real-audio`
- `node scripts/run-cinema2-ifrit-browser.mjs --preview-only`

The real-audio check decodes the reference soundtrack, invokes production
`analyzeTrackBuffer`, installs its analysis in `MusicIntelligenceEngine`, and plays
through the production analyser/frame pump and AudioFeatureBus into Cinema 2.0.
It records actual event identities and analyzed source data; it does not invent
kick/phrase/drop markers. The short source may not contain every structural event,
so deterministic fixtures also test all required musical/authority cases.

Generated evidence lives in `artifacts/cinema2-ifrit/acceptance/`; extracted audio
is `artifacts/cinema2-ifrit/reference-audio.wav`. Artifacts are git-ignored.

Acceptance must cover reference-relative opening size and foreground occupancy,
all six real pattern results, meaningful region-specific delayed gestures, visible
intermediate poses, control extrema, palette independence, five aspect ratios,
shared Inspector controls, every canonical Trigger, manual/automatic authority,
play/seek/re-entry image equivalence, pause/resume and disposal. Frame difference
alone is insufficient evidence of musical or visual correctness.

Human review of the finished motion against the reference is still mandatory.
The user rejected the prior performance; neither old approval nor automated tests
may be presented as acceptance of the corrected result. No commit was requested.

## Correction validation record

- TypeScript check passed on the corrected implementation.
- Nineteen focused tests passed: schema/registration/ownership plus authored
  strokes, six distinct pose programs, near/far gestures, staged drop/build,
  rendered interpolation, Director significance, recycled physical roles and
  canonical seek/loop/re-entry reconstruction.
- The complete production canvas suite passed. After the final physical-role
  and far-entry fade refinement, the focused score/lifecycle suite passed again,
  including regional image assertions and a no-pop check at the actual wrap boundary.
- Delays are enabled through `choreography.tempoSyncParameter`, bound to the same
  BPM Sync parameter as native motion. Without this binding, ungridded sources
  could trigger initial actions while silently omitting delayed actions; the
  authoring test now explicitly guards this integration.
- Actual soundtrack validation passed with production offline analysis, live
  analyser publication, and per-rendered-frame target evidence. The healthy run
  recorded 720 rendered frames through 16.8617 seconds. All three kick stages,
  both ungridded snare banks, and all three drop stages had nonzero resolved peaks.
  Browser errors were absent. Playback is clamped at the decoded clip's end.
- The short source did not establish a reliable analyzed BPM; most analyzed
  sections were `unknown`. This limitation is recorded in `real-audio-report.json`.
  The engine's declared timing fallback is used; no source-specific beat or
  structural labels were invented. Synthetic fixtures additionally exercise
  confident grids, vocal restraint, explicit builds/drops and canonical triggers.
- Snapshot checks confirm red mechanical coverage around 22–28% in the frozen
  reference views. Acceptance bounds are now 12–65%, rather than the old 1%
  visibility threshold. The opening-size check is reference-relative (15–23%
  horizontal radius of the shorter viewport dimension), not the old tiny void.
- A shared-cue demonstration captures build gathering/winding/bracing, drop,
  depth waves, side accents and recovery through the actual renderer:
  `node scripts/run-cinema2-ifrit-browser.mjs --preview-only --performance-preview`.
  The generated GIF is a 12 fps demonstration without a soundtrack or a seamless
  loop; it is not presented as synchronized parity with the source recording.
  Preview: `artifacts/cinema2-ifrit/acceptance/ifrit-corrected-performance.gif`.
  The six checkpoint images were inspected after capture; they show the enlarged
  opening, layered moving walls, changing foreground weight and recovery.
- All tests were focused on Ifrit. A full repository build and unrelated suites
  were not run. Changes remain uncommitted; no commit was requested.

The default passage and material proportions have changed. If prototype settings
were saved, use the preset's normal Reset action to inspect the revised authored
defaults; existing user-authored settings have not been silently overwritten.

Reproduce the local reference-audio artifact before the real-audio check:

```sh
ffmpeg -i /Users/kodyrobinson/Desktop/Ifrit.mov -vn -af 'adelay=159:all=1' -ac 1 -ar 48000 artifacts/cinema2-ifrit/reference-audio.wav
```
