# P1 — BLOCKSHIFT visual and authority specification

**Authoritative visual revision — 2026-10-22:** The user wants the observer **inside** a spacious cube field, with massive nearby geometry on all sides. [Immersive field revision](19_IMMERSIVE_FIELD_REVISION.md) supersedes the older distant installation, camera, size/spread limits and all-nine-in-frame rules below. Preserve this surrounding-space concept in subsequent phases.


**2026-10-22 user-directed geometry revision:** The supplied `docs/BLOCKSHIFT/hallow_cube.glb` and `impossible_cube.glb` replace the procedural solid-box/twelve-rod meshes. Eight surrounding blocks use Hallow Cube; stable center `block-04` uses Impossible Cube. Both are centered and uniformly normalized to a unit bounding box before Block Size is applied. This supersedes the earlier no-imported-assets restriction and exact procedural mesh description. Nine identities, six formations, clearance limits and authored parameter authority remain. See [GLB integration report](16_GLB_OBJECT_INTEGRATION.md).


**P3 reconciliation (2026-10-22):** This is the complete target specification. Current implementation is a normal-catalog reference preview with six static formations and a shared-clock rotation foundation. Full positional trajectories/interpolation remain P4; audio P5; Director/Auto Performance P6; bloom/camera enhancements P7. Later-phase widgets are hidden until implemented. The root contract and corrected phase plan supersede earlier suggestions to advertise their controls prematurely.


Authored 2026-10-22 against commit `9c2aa74831103c1589e589c8cedc5af5f94f1643`. Status: **approved to proceed to P2 by the user's subsequent “Continue with the next phase” instruction after the larger-block revision**. This document resolves the proposed defaults and open decisions in files 01–05 and 11. The root creation contract remains authoritative. Full keeper or motion acceptance is not claimed; see the separate P2 static-render report.

## Visual baseline and permanent identity

Revision: user requested larger blocks. Default side length is **1.35 world units**, increased 50% from 0.90; the editable range is 1.05–1.80. Preserve the larger physical geometry in implementation, with clearance-driven spacing. The reference now uses two columns to give each formation more room.

Nine large opaque charcoal cubes with cyan/violet edge geometry and a warm-white center accent, against a solid near-black navy background. No floor, texture, imported asset, particle field, transparency, shadows, or physics. Hero state: **Stagger**, audio stopped, phase 0, bloom off, static perspective camera. Faces, edges, nine distinct objects, negative space, and depth must read before effects.

Rig-local right-handed coordinates: +X right, +Y up, +Z toward the camera. Origin is the formation center. Unit cube geometry is centered on its own pivot; rotations are yaw/pitch/roll about that pivot, never about an accidental scene origin. Uniform Block Size is the side length in world units.

| ID | Row r | Column c | Addressing |
|---|---:|---:|---|
| block-00 | 0 | 0 | left bank, top row, outer ring 0 |
| block-01 | 0 | 1 | middle column, top row, outer ring 1 |
| block-02 | 0 | 2 | right bank, top row, outer ring 2 |
| block-03 | 1 | 0 | left bank, middle row, outer ring 7 |
| block-04 | 1 | 1 | center; excluded from outer ring |
| block-05 | 1 | 2 | right bank, middle row, outer ring 3 |
| block-06 | 2 | 0 | left bank, bottom row, outer ring 6 |
| block-07 | 2 | 1 | middle column, bottom row, outer ring 5 |
| block-08 | 2 | 2 | right bank, bottom row, outer ring 4 |

Index `i=3r+c`; parity group is `i mod 2`. Outer-ring order is `[00,01,02,05,08,07,06,03]`. Near/far groups derive from the current target z coordinate and never change identity. Buffer instance index always equals i.

## Exact six-pattern target definitions

Let `s=Block Size`, `a=max(1.95*Spread, sqrt(3)*s+0.24)`, `d=Depth/0.45`, `u=Motion Amount`, and `p=2*pi*phase`. Phase is normalized modulo 1. Coordinates below are dimensionless and multiplied by a; multiply z by d afterward. At rest, phase is 0. Automatic offsets shown below scale by u. With Motion Amount 0, follow the freeze/manual-edit rules below rather than advancing p.

| Pattern ID / label | Position formula before a and d | Native movement / orientation |
|---|---|---|
| `stack` / Stack | `x=1.2(c-1)`, `y=1-r + 0.08u*sin(p+c*pi)`, `z=0.35(c-1)` | Three columns sway together internally; yaw `0.25R*u*sin(p+c*pi)`. |
| `orbit` / Orbit | Center i=4 stays at origin. Outer j: `t=pi/2-j*pi/4+p`; `(x,y,z)=(1.85cos(t),1.55sin(t),0.38sin(2t))`. | One elliptical revolution per cycle; phase speed scales with Motion Amount; yaw `0.35R*u*sin(t)`. Wrap is continuous. |
| `stagger` / Stagger | `x=1.35(c-1)+0.25(r-1)+0.10u*sin(p+0.6i)`, `y=1.2(1-r)+0.16(c-1)+0.04u*sin(p+0.6i)`, `z=0.8*((r+c)%2-0.5)+0.18(r-1)` | Stepped rows, diagonal cascade; yaw `0.35R*u*sin(p+0.6i)`. |
| `split` / Split | c=0/2: `(x,y,z)=((2c-2)*(0.85+0.06u*sin(p)),1-r,0.35(c-1))`; i=1: `(-0.55,1.4,-0.8)`; i=7: `(0.55,-1.4,0.8)`; i=4: origin. | Opposed banks breathe away from center; yaw `(c-1)*0.35R*u*sin(p)`. |
| `wave` / Wave | `q=p+c*pi/2+r*pi/3`; `(x,y,z)=(1.25(c-1),1.6(1-r)+0.22u*sin(q),0.25*((1-u)*cos(q-p)+u*cos(q))+0.2(r-1))`. | Serpentine vertical/depth sequence; yaw `0.35R*u*sin(q)`. The z interpolation preserves the phase-0 rest pose at u=0. |
| `collapse` / Collapse | Center stays at origin. Outer j: `t=pi/2-j*pi/4`, `k=1+0.06u*sin(p)`; `(x,y,z)=k*(1.45cos(t),1.45sin(t),0.3*(-1)^j)`. | Tight, alternating-depth cluster; coherent inward/outward pulse; yaw `0.25R*u*sin(p+j*pi/4)`. |

R is the authored Rotation Range in radians. Pitch/roll remain 0 for base programs; audio may use them within the same total rotation bound. Orbit's phase rotates the formation; Rotation Range bounds each cube's local orientation, not its orbital position.

Depth=0 deliberately removes z separation. Every pattern retains unique XY centers there, including Collapse; a safety spacing floor prevents overlap. Block Size and Spread independently change size and separation, except where a low Spread must clamp to the documented clearance floor. Never silently change the authored slider to reflect a safety clamp.

## Safety and transitions

Opaque cube plus edge envelope has conservative radius `rho=sqrt(3)*s/2+0.02`. Require every center distance >= `2rho+0.16` after all offsets. Orientations cannot invalidate this sphere bound. Validate numeric controls at extrema and sample complete cycles in P4; the reference sheet is not proof of swept safety.

For a pure formation, if its minimum pair distance is below the required clearance, uniformly expand its centers about the origin just enough to satisfy it. Never shrink the user's cube dimensions. This is a deterministic layout clamp, not collision simulation. The final cube/edge extents must lie inside a rig-centered radius of **10.0 world units**. If a proposed pose cannot satisfy both clearance and framing, reduce transient motion first; do not discard a cube, silently exceed camera limits, or ship the configuration as accepted.

Transition policy is **retarget from the current visible pose**, never from a stale static pose. Use smoothstep `h(t)=t*t*(3-2t)` for translation and shortest-arc rotation interpolation. Freeze outgoing phase at capture; evaluate the incoming program continuously. A deterministic z arch may separate crossing trajectories: `z += min(0.35a,0.8)*sin(pi*t)*(i-4)/4`, with signs fixed by ID. Apply final clearance/framing checks to every intermediate candidate. Reduce the arch/modulation or hold the last valid pose if unsafe; unresolved stalls or discontinuities fail P4. No arbitrary pathfinding/physics is permitted. P4 must prove all 30 directed pattern pairs at control extrema; an unsafe path requires a documented authored transition revision, not a hidden general solver.

New musical changes are limited to one transition start per 0.5 performance beat; coalesce closer events to the latest selected destination. Manual edits bypass that throttle and replace any queued destination. Do not replay a queue after pause/seek. Pattern selection changes the target immediately; physical travel uses Transition Length while playing. When stopped/paused or Motion Amount=0, a manual Pattern edit applies its phase-0 static formation immediately so the control remains usable without autonomous animation.

## Camera, renderer, materials, and effects

- Shared static perspective camera: position `[10,7,24]`, target `[0,0,0]`, vertical FOV 48 degrees, `near=0.1`, `far=100`, `minAspect=16/9`, centered fit-to-width. No private projection or camera loop.
- At 16:9, the radius-10.0 safety sphere fits the camera's vertical angular bounds. Square/portrait use the existing `minAspect` support. P2/P7 still require real clipping/visibility proof; frustum fit alone cannot prove all nine cubes are perceptually separated.
- Two instanced triangle batches: nine body cubes, and nine copies of one canonical mesh containing 12 thin edge rods. Edge width 0.04 world units at size 1, proportional to size (P2 canvas calibration: the proposed 0.018 produced subpixel gaps). No GL line-width dependency or coplanar wire overlay.
- Faces use deterministic normal-based key/fill shading in the native shader; no physical scene lights are required. Edge base remains visible without bloom; HDR emission adds glow only when enabled. Target two sculpture draws, hard budget <=4 excluding stock effects.
- Primary edges: left bank plus block-01. Secondary: right bank plus block-07. Center block-04 uses Impact Accent at rest, so the fifth color is visible without audio. Event accents brighten only their target groups and blend toward the authored accent color.
- Colors: Primary `#55E6FF`, Secondary `#7866FF`, Impact `#FFF1D6`, Body `#151A24`, Background `#050811`; opaque alpha. Background is a module-owned clear/background output matching the engine environment binding, not an alias for Body.
- Keep stock HDR bloom (default 0.30) and a fixed stock cinematic finishing pass for display output. Bloom 0 must bypass its contribution. The idle golden comparison disables bloom. No public finish knob without a separate need.
- **Defer atmosphere and camera motion entirely in v1.** Do not expose their controls. This avoids unproved multi-control camera gating; all camera-motion hard-disable cases are satisfied structurally by a static camera. No optional floor or additional effects are authorized.

## Locked public controls and exact consumers

Each `blockshift-<suffix>` parameter is persistent and generic. Module properties below must exist in both `module.parameters` and `parameterBindings`. Flags/enums/colors are not choreography replacement targets. All reads use resolved parameters. Numeric defaults/ranges are binding decisions, subject only to a documented visual-gate revision.

| Parent / order | Suffix / label | Type; range or options; default | Consumer |
|---|---|---|---|
| Master Controls 1 | `bpm-sync` / BPM Sync | boolean; true | Formation shared beat clock and transition duration source |
| Master Controls 2 | `master-intensity` / Master Intensity | float 0–2; 1 | `masterIntensity`: edge emission gain; zero removes emission but preserves matte faces/background |
| Master Controls 3 | `auto-performance` / Auto Performance | boolean; false | `autoPerformance`: transient build/drop permission |
| Master Controls 4 | `motion-amount` / Motion Amount | float 0–1; 0.55 | `motionAmount`: all autonomous physical animation |
| Master Controls 5 | `audio-reactivity` / Audio Reactivity | float 0–1; 0.80 | `audioReactivity`: every music-derived channel including Director/Auto |
| Design / Pattern 1 | `pattern` / Pattern | enum stack/orbit/stagger/split/wave/collapse; stagger | `pattern`: unmodulated authored base for generic controller |
| Design / Pattern 2 | `pattern-change` / Pattern Change | boolean; false | `patternChange`: canonical event cycling permission |
| Design / Pattern 3 | `trigger` / Trigger | imported 11 options; bar4 | `trigger`: selected canonical event; visible only when Pattern Change=true |
| Design / Blocks | `block-size` / Block Size | float 1.05–1.80; 1.35 | `blockSize`: body/edge scale and clearance |
| Design / Blocks | `spread` / Spread | float 0.50–1.80; 1 | `spread`: formation spacing, safety-limited |
| Design / Blocks | `depth` / Depth | float 0–1; 0.45 | `depth`: z separation |
| Design / Blocks | `rotation-range` / Rotation Range | float 0–45 degrees; 16 | `rotationRange`: final per-block orientation cap |
| Design / Motion | `motion-rate` / Motion Rate | float 0.25–2; 1 | `motionRate`: cycle rate, excluding transition length |
| Design / Motion | `transition-length` / Transition Length | enum values `0.5`,`1`,`2`,`4`; `1` | `transitionLength`: beats when synced, seconds=L/2 when unsynced |
| Effects | `bloom` / Bloom | float 0–1; 0.30 | Stock bloom strength binding, not a module placebo |
| Palette 1–5 | `primary-edge`, `secondary-edge`, `impact-accent`, `block-body`, `background` | five color parameters; hex defaults above | `primaryEdge`, `secondaryEdge`, `impactAccent`, `blockBody`, `background` respectively |

The BPM property is `bpmSync`; remaining camel-case properties follow the consumer table. Background also binds `environment.controls.backgroundColor` through the same parameter, so scene clear and native backdrop agree. Palette roles count once each even with multiple consumers. Canonical triggers: `beat`, `kick`, `snare`, `downbeat`, `beat2`, `beat4`, `bar`, `bar4`, `bar8`, `phrase`, `drop`; import labels and values unchanged. Trigger value survives hiding. Optional shared quality controls must use their existing engine consumer and sit under Master Controls.

## Timing, idle, transport, and event identity

Use **one shared `Cinema2BeatClock` instance** for continuous formation phase. Call `update(frame,bpmSync)`; local BPM Sync is authoritative regardless of Audio Dock Sync. Global Sync retains its host behavior but cannot veto this preset's toggle. Test all four local/global combinations.

- Synced with confirmed beat grid: use the shared clock's gradual grid alignment. Accumulate phase continuously at Motion Rate * Motion Amount / 8 cycles per performance beat; do not multiply a wrapped phase by Motion Amount. At Motion Amount 1, one cycle is eight beats / Motion Rate. Do not promise hard downbeat snapping.
- BPM available without grid: tempo-scaled movement and L*60/BPM-second transitions; identify this as rate synchronization, not confirmed beat locking.
- No valid tempo, or local BPM Sync OFF: deliberate 120-BPM-reference motion (one cycle = 4/(Motion Rate * Motion Amount) seconds for nonzero Motion Amount); transition duration L/2 seconds. No fabricated musical events.
- Clock deltas, with a phase offset when toggling, preserve pose continuity. Motion Rate changes preserve current phase. Transitions integrate normalized progress against the current duration rather than restart when BPM changes.
- Do not set `choreography.tempoSyncParameter` on canonical musical rules. Kick/beat/bar/phrase/drop truth comes from the shared bridge and canonical resolver even when formation timing is unsynced.
- No track/source: static phase-0 preview. Playing silence: bounded base animation, no invented cues. Pause: freeze phase, transitions, physical envelopes, and emitted event state exactly; manual edits remain effective.
- Activation, source/track replacement, seek, loop/rewind, audio discontinuity, and context generation change: discard stale events/overlays/queued transitions; reset the shared clock and local phase offset to phase 0, restore authored base, and arm from the current event without firing it. This deliberate reset is distinct from a Sync toggle's continuity behavior.
- Resume: retain the paused visible pose and consume an already-present event without firing; only a fresh event can cycle. No catch-up burst.
- Event identity includes source/track plus discontinuity generation and canonical event ID. Keep a bounded recent-ID set (maximum 128) for envelopes and trigger delivery. Never use raw held booleans or Mainframe fallback identities as music facts.

## Audio mapping and bounded resolved channels

All music capabilities are optional; geometry requires `render.webgl2`, `render.depth`, `scene.3d`, and `camera.world`. Declare optional `audio.transport`, `audio.bands`, `audio.features`, `music.beat`, `music.downbeat`, `music.rhythm-events`, `music.bar`, `music.phrase`, `music.section`, `music.vocal-presence`, `music.build`, `music.drop`, and `visual-director.significance`, each with its actual purpose. Bloom/finish rendering capabilities must match the effects actually authored; lack of optional music produces zero modulation.

Continuous manifest rules map shared paths into module target channels: `subExpansion`, `bassLift`, `midTwist`, `highGlint`, `energyGain`, `vocalRestraint`, `buildTension`, `directorGain`. Declare every channel as a module parameter with default 0 (Director neutral gain is derived from that 0). They are transient targets, not extra saved user controls. Event rules dispatch the existing trigger/action path into `musicalCue` with `{kind}` payload and canonical event identity; use the engine's validated actionBindings seam, never private frame mutation.

| Shared input | Visible consumer / maximum before final safety |
|---|---|
| Sub band | Outer radial displacement <=0.10a |
| Bass | Even-group y lift <=0.12a |
| Mids | Opposing bank yaw <=0.20R |
| High / spectral flux | Alternate-group edge glint <=0.35 emission gain |
| Energy | Edge gain <=+0.40 and base oscillation amplitude <=+10% |
| Vocal presence | Reduce kinetic accents by up to 40%; center emission gain <=+0.15 |
| Build progress | Bank compression <=0.10a; active only with available data, never a persistent pattern write |
| Director intensity/impact | Gain on approved audio envelopes from 1 to 1.25; never a separate duplicate displacement |
| Kick | Center/even-group y impulse <=0.12a; 0.02-second attack, 0.18-second release |
| Snare | Opposing-bank yaw <=0.30R and edge accent; 0.01-second attack, 0.22-second release |
| Beat / downbeat | Outer radial impulse <=0.04a / 0.07a; 0.02 attack, 0.25 release; take maximum with coincident kick, not sum |
| Bar / phrase | Row-sequenced tilt <=0.12R / 0.18R; 0.10 attack, 0.50 release; no Pattern write |
| Section change | Blend modulation amplitude profile over 0.5 seconds, range 0.8–1.1, no base replacement |
| Drop | Outward emphasis <=0.18a, accent <=+0.60; 0.03 attack, 0.60 release |

Multiply every music channel by Audio Reactivity; physical channels also multiply Motion Amount. Combined audio translation is capped at 0.22a per block, and total rotation magnitude never exceeds R. Smooth continuous target channels in shared choreography (80 ms); do not re-smooth the Audio Intelligence facts themselves. Apply bounds once after composition and never again per render pass.

## Authority matrix and Auto Performance policy

| Domain | Manual base / edit | Audio and Director | Auto Performance |
|---|---|---|---|
| Pattern | User enum persists; edit immediately changes destination and clears active/queued overlay | Fresh selected Trigger may advance runtime base only when Pattern Change ON | Temporary geometry bias only; never writes persisted Pattern |
| Pattern Change / Trigger | User-owned; hiding Trigger preserves its value | Generic controller arms next fresh event; OFF returns to authored base | Never changes toggle or Trigger |
| Size / Spread / Depth | User base; immediate resolved edit | Bounded additive offsets, never saved writes | Same bounds; geometry edit cancels/suppresses the current overlay |
| Rotation Range / Motion Rate | User-owned bound/rate | All final rotations remain within R; phase stays continuous | Cannot exceed bound or rewrite rate |
| Motion Amount | Zero freezes the current physical pose; manual static edits still work | Zero blocks physical modulation and transition progress | Cannot bypass zero |
| Audio Reactivity | Zero removes all music-derived influence; base authored motion remains | Multiplies all music channels | Zero cancels/disallows music overlays |
| Palette / background | Five independent persistent base colors | Group brightness/accent blending only, no automatic hue selection | No palette ownership |
| Master Intensity / Bloom | User-owned output amounts including zero | Emission subject to master gain; no bloom-strength modulation | Cannot reactivate zero |
| Camera | Fixed authored shared camera | No camera modulation in v1 | No camera ownership |

Auto Performance defaults OFF. With ON, a **fresh shared build event** may bias toward Collapse with weight <=0.25, lasting at most 4 performance beats. A **fresh shared drop** may replace it with a Split-release bias of weight <=0.35 for 2 beats. Attack/release are 0.25 beat; the whole overlay remains within translation/rotation/clearance/framing caps. No raw persistent build-progress condition can reactivate an overlay.

Manual Pattern or geometry edits cancel the overlay on that frame, consume its event identity, and start a 2-performance-beat cooldown. The same build/drop ID stays suppressed beyond cooldown; only a genuinely newer event may enter. Toggles and all hard disables apply before overlay acceptance. Underlying Pattern Change continues during an overlay and its current runtime base is revealed when the overlay ends. Process order: manual edits/discontinuities -> canonical event arming/controller -> transition -> resolved audio -> bounded Director gain -> permitted overlay -> final hard stops/safety -> instance buffers. A same-frame manual edit wins over new or old automation.

## Reference, evidence plan, and performance budget

The [static reference sheet](evidence/P1_FORMATION_REFERENCE.svg) shows phase-0 target geometry and palette in a consistent view. It is an authored vector diagram with fitted panel framing, not the production camera, a shader render, motion proof, or release evidence. Reviewer: **Kody Robinson** (requested review, not a recorded signature).

P2 golden captures: real app canvas at 1920x1080, 1080x1080, and 1080x1920, all default controls except Motion=0, Audio Reactivity=0, Bloom=0; include one Stagger hero and one diagnostic five-color proof. P4 adds four phases for each pattern and all directed transitions; P5/P6 add canonical fixtures and manual takeover; P7/P8 add aspect/resize, re-entry, and sustained performance captures. Stop on unreadable faces, merged cubes, placebo controls, or unsafe intermediate paths.

Budget: nine permanent identities, two target sculpture draws (<=4 maximum), zero physical lights, fixed-size instance buffers with no per-frame GPU allocation, <=256 KiB reported module-owned geometry/instance storage (stock effect targets excluded). P7 reference measurement is the development Mac with OS/browser/GPU recorded at measurement time. At 1920x1080/DPR1: target total p95 frame interval <=20 ms and sculpture CPU update+submit p95 <=1 ms; compare effects-off/on. GPU timing is separate when a supported timer is available; CPU submit time is not GPU time. After 20 preset switch cycles, active module leases must return to baseline without upward retained-memory growth. These are acceptance targets, not measurements. If the reference machine cannot satisfy them, revise the budget explicitly before release.

## P0/P1 decision log and phase report

| Decision | Locked choice |
|---|---|
| D01 Edge strategy | Triangle rods in one instanced edge mesh, separate body batch |
| D02 Camera | Shared fixed perspective, explicit fit-to-width and sphere bound above |
| D03 Clock / host Sync | Shared BeatClock; local toggle authoritative; canonical event timing remains musical |
| D04 Transition interruption | Retarget current pose; smoothstep/shortest arc, deterministic ID arch, safety gate, 0.5-beat musical throttle |
| D05 Event resolver | Canonical Afterhours resolver plus generic Mainframe controller; no fallback music events |
| D06 Auto entry/exit | Fresh build/drop only; bounded timed bias; edit cancellation, 2-beat cooldown, current-base restoration |
| D07 Capabilities | Required native geometry capabilities; optional music/Director with per-frame availability checks |
| D08 Browser / performance | Real VyzualzView/AudioEngineProvider path; canonical bridge fixtures; explicit Mac/device record in P7 |
| D09 Optional polish | Bloom + fixed finish; atmosphere, floor, and camera animation deferred |

Files changed: this specification, P0 audit, reference sheet, focused-test evidence, and package cross-references. Requirements specified: BS-R01–BS-R20; none marked implementation-complete. Real canvas changes: none. Validation: live API audit, existing 54 passing baseline tests, and 31,104 sampled formation poses (81 control combinations × 64 phases × 6 patterns); nine finite centers, conservative clearance, framing radius, SVG parsing, and local links passed. See [design validation](evidence/P1_DESIGN_VALIDATION.json) and the reproducible documentation-only [reference generator](evidence/P1_GENERATE_REFERENCE.py). Transition and native rendering checks remain future work; no source implementation, production screenshot, motion proof, build pass, or commit is claimed.

**P1 gate: GO for P2.** Root contract §8 requires: “This matrix must be agreed before code is written.” After the larger-block reference and specification were delivered, the user explicitly instructed continuation with the next phase. That instruction is the authorization for P2; it is not a final human sign-off on production rendering, animation, or release quality. See [P2 report](14_P2_STATIC_NATIVE_RENDER_REPORT.md) for actual native canvas evidence. Later phases remain separately scoped.
