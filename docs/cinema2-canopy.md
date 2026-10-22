# Cinema 2.0 CANOPY

A black concert-installation space with a field of suspended LED rods. Each rod hangs on a thin stem, under a cap, from an overhead mounting grid, and carries its own light. Six formations move the rods themselves; the music lifts, lowers and lights them.

- Preset id `drmvyz.cinema2.canopy`, native module `canopy-native` v1, first-party keeper.
- World-space. One native module draws everything as two instanced batches (boxes: grid rails, stems and caps; one low-poly cylinder per diffuser). The engine owns camera, background, bloom and finish. No scene lights: every rod's light is shader emission.
- Implementation plan: `docs/DRMVYZ_Cinema2_CANOPY_Implementation_Plan/`. Where this document and the plan differ, this document describes what was built (see *Differences from the plan*).

## Files

| File | Role |
|---|---|
| `cinema2/presets/Cinema2CanopyPreset.ts` | Manifest: parameters, module bindings, choreography cues, camera, environment, bloom + finish, render graph |
| `cinema2/modules/Cinema2CanopyNativeModule.ts` | Module definition, update + render provider, cue delivery, test seam |
| `cinema2/modules/canopy/Cinema2CanopyDomain.ts` | Pattern ids, limits, structure clamps, fit scale, deterministic hash |
| `cinema2/modules/canopy/Cinema2CanopyLayout.ts` | Rod addresses and positions, rails, instance packing |
| `cinema2/modules/canopy/Cinema2CanopyPatterns.ts` | The six formations (pure functions of rod, phase and symmetry) |
| `cinema2/modules/canopy/Cinema2CanopyChoreography.ts` | Rod solver: formation + music + authority → cap heights, light, accent |
| `cinema2/modules/canopy/Cinema2CanopyOrchestration.ts` | Shared clock, shared drop coordinator, shared reactivity, shared pattern controller; phase and crossfade |
| `cinema2/modules/canopy/Cinema2CanopyRenderer.ts` | WebGL2: program, meshes, instance buffer, draw |
| `test/browser/Cinema2CanopyProductionBrowserHarness.ts` | Real `Cinema2Runtime` page with a real Audio Feature Bus fixture |
| `scripts/cinema2-assets/capture-canopy.mjs` | Headless Chrome captures from that page |

## The rods

Default 8 rows × 8 columns = 64 rods, row-major addresses, centred on the origin (rows run front +Z to back -Z). Rows and Columns each run 4–12; total is capped at 144. Spacing, Rod Length and Length Variation are real world distances; length variation is a fixed per-rod hash, never random.

An array wider or deeper than the camera frames at full scale (the default plus a margin) is scaled down uniformly about the array's mid-height so it stays in frame. The default array is never scaled.

Caps hang between 0.14 and 1.95 below the mounting plane (Y 4.6) and never lower than a tip height of 0.9, so no rod can leave the frame or reach the camera at any control setting.

## Controls

All under the generic Design Inspector hierarchy; there is no CANOPY-specific Inspector code.

| Parent › group | Control | Default / range | Consumer | Visible result |
|---|---|---|---|---|
| Master Controls › Output | Master Intensity | 0.78, 0–1 | rod emission multiplier | 0 = no emitted light; dark rods, caps and grid remain |
| Master Controls › Timing | BPM Sync | on | pattern clock | see *BPM Sync* |
| Master Controls › Performance | Auto Performance | off | solver + bloom rule | see *Auto Performance* |
| Design › Pattern | Pattern | Waterfall (6 options) | formation | rod heights change at once |
| Design › Pattern | Pattern Change | off | shared pattern controller | on: each qualified Trigger advances the formation |
| Design › Pattern | Trigger | Every 4 Bars (the 11 canonical options) | shared trigger resolver | visible only while Pattern Change is on; value kept when hidden |
| Design › Structure | Rows, Columns | 8, 8 (4–12) | layout | rod count and depth/width |
| Design › Structure | Row Spacing, Column Spacing | 1.0, 1.08 (0.75–1.4) | layout | real distances |
| Design › Structure | Rod Length, Length Variation | 1.45 (0.6–2.1), 0.22 (0–0.65) | layout | physical length |
| Design › Motion | Motion Amount | 0.55, 0–1 | solver | 0 = nothing moves; the formation stands in its rest shape |
| Design › Motion | Motion Speed | 1, 0.3–2 | phase rate | formation cycles faster or slower (phase stays continuous when edited) |
| Design › Motion | Height Range | 0.6, 0–0.8 | solver | furthest cap travel in world units; 0 = rods stay at the base hang |
| Design › Motion | Symmetry | on | patterns | on mirrors each formation; off leans it |
| Effects › Light | Idle Glow | 0.28, 0–0.6 | solver | the light every rod keeps between hits |
| Effects › Light | Accent Strength | 0.55, 0–1 | solver | hard ceiling on kick/snare/downbeat/drop lift and light |
| Effects › Light | Bloom Amount | 0.2, 0–0.6 | HDR bloom `intensity` | 0 = no glow |
| Effects › Camera | Camera Motion | 0, 0–1 | camera `motionAmount` | 0 = locked off; otherwise a slow drift |
| Palette › Roles | Background | near-black blue | environment background | space behind the canopy |
| Palette › Roles | Primary Rods | cyan | module | every other column of rods |
| Palette › Roles | Secondary Rods | violet | module | the columns between them |
| Palette › Roles | Accent Hits | amber | module | colour rods flash when hit |
| Palette › Roles | Mounting Structure | dark teal | module | grid, stems, caps, dark rod body |

## Patterns

Each formation is a pure function of rod, phase (beats) and Symmetry, returning a *rest* height (Motion Amount does not scale it) and a *motion* part (it does). Cap height is `base hang + height × Height Range`; positive lowers the rod.

| Pattern | Rest shape | Motion | Symmetry off |
|---|---|---|---|
| Waterfall | Front rows high, rear rows progressively lower | A downward wave crosses the rows front to back every 8 beats | The wave leans across the columns |
| Crosswave | Flat | Two diagonal waves cross | Waves use signed X, so the crossing is lopsided |
| Crown | Centre hangs low, rim lifted: a bowl | The bowl breathes with radius | The bowl sits off-centre |
| Split Wings | Left half lifted, right half low, a clear centre division | The wings swap each bar, with opposing ripples | The right wing runs one beat behind |
| Checker Lift | Alternate rods in two tiers | The tiers swap every two beats, eased | A front-to-back tilt is added |
| Downpour | Whole array held high | One curtain falls and recovers every 8 beats, staggered by radius | Staggered left to right instead |

A changed Pattern fades from the old formation to the new over 0.5 s; it is never a cut.

## Music

Everything below reads the shared Audio Intelligence frame, the shared choreography cue delivery and the shared Mainframe drop coordinator, reactivity envelopes, beat clock and pattern controller. CANOPY detects nothing and keeps no clock of its own.

| Signal | Physical result | Light result |
|---|---|---|
| Sub | Centre rods hang lower (more in Crown) | |
| Bass | A depth wave runs through the rows | ×1.18 ceiling |
| Mid | Alternate columns tension in opposition | |
| High | | ±10% shimmer |
| Overall energy | Scales movement 0.85–1.15 | Raises the light between hits |
| Vocal presence | | Secondary bank down by up to 25%, never below Idle Glow |
| Build | Height range compresses by 12% (25% with Auto Performance); the formation tightens | Slight lift |
| Kick | Every other row from the front lifts ≤ 0.14 | Pulse + Accent Hits colour on those rods |
| Snare | The rows between them lift ≤ 0.10 (checker rods first) | Pulse + Accent Hits colour |
| Downbeat | Front row and rim lift ≤ 0.16 | Pulse + Accent Hits colour |
| Phrase | The formation leans sideways briefly | |
| Section | Movement settles briefly | |
| Drop | The whole array releases downward | ×1.35 ceiling; Accent Hits tint |

Lifts shown are at the default Accent Strength; Accent Strength is the ceiling on all hits. Kick and snare never land on the same rod.

With no track the host stops visual time, so CANOPY stands in each formation's rest shape. Choosing a Pattern still changes the rods at once, so a formation can be judged without music.

## BPM Sync

The preset toggle is the single authority for this preset's motion clock; the Audio Dock's global Sync is not required and does not override it.

- On, analyzed beat grid available: the formation follows the grid, with the shared resolver easing toward it (never snapping).
- On, no grid but a tempo (analyzed, then Audio Dock): the tempo advances the clock continuously. This is an estimate and does not claim beat alignment.
- On, no tempo, or off: the clock free-runs at the 120 BPM reference rate, detached from the track's phase.
- Off does not disable music reactivity: kicks, snares, downbeats, bands and drops move and light the rods either way.
- Toggling re-bases through the shared resolver; phase never jumps.

## Auto Performance

Off by default. It never changes Pattern, Pattern Change, Trigger, any palette colour, Rows, Columns, spacing, or any control set to zero. On, it adds only:

1. a buildup compresses the height range further (25% instead of 12%);
2. a drop releases the array up to 1.3× instead of 1× and lifts the light a little more;
3. a drop swells the bloom by up to 60% (a *multiplication*, so Bloom Amount 0 stays off).

It does not substitute a temporary pattern; the UI makes no such promise.

## Authority

| Property | User base | Music | Visual Director | Auto Performance | Manual edit |
|---|---|---|---|---|---|
| Rows, Columns, spacing | Absolute | none | none | never | rebuilt at once |
| Rod Length / variation | Absolute | none | none | never | immediate |
| Height Range | Hard ceiling on pattern travel | adds within it | scales hits ±10% | compression/release magnitudes only | immediate; 0 stops pattern travel |
| Motion Amount | Hard | cannot override | none | cannot override | 0 stops all rod movement, music included |
| Master Intensity | Level and hard zero | pulses inside its ceiling | none | cannot light a zero | 0 = unlit |
| Idle Glow | Base | events add and decay | none | none | immediate |
| Colours (5) | User owned | luminance and Accent Hits mixing only | none | never | persist |
| Pattern | Authored base | advances the runtime pattern only (Pattern Change on) | none | none | immediate; leaves Pattern Change on; the live event cannot steal it |
| Pattern Change, Trigger | User | none | none | cannot toggle | no stale-event switch on edit or toggle |
| BPM Sync | User | none | none | cannot override | phase-safe switch |
| Camera Motion | User, 0 = locked off | none | none | none | immediate |
| Bloom Amount | User ceiling | none | none | multiplies up to 1.6 only | 0 stays off |
| Accent Strength | Ceiling | hits ≤ ceiling | scales ±10% inside it | none | immediate |

## Differences from the plan

- **Camera Motion is a 0–1 amount (default 0 = locked off), not a boolean.** The engine's camera takes a numeric `motionAmount`; a boolean there would be read as "always on". 0 is the same hard lock the plan wanted.
- **Continuous bands are read from the shared Audio Intelligence frame** (through the shared Mainframe reactivity engine, as BWC and Backstreet do), not routed through manifest `continuous` rules. Events are delivered by manifest choreography cues; the one Auto Performance effect rule is a manifest rule.
- **No idle drift.** The plan proposed free-running idle motion; the host freezes visual time with no track, so it could never have run.
- **Browser capture** is `scripts/cinema2-assets/capture-canopy.mjs` on the Marquee/Mainframe style harness (real runtime, Vite, headless Chrome) rather than a `run-cinema2-canopy-browser.mjs` Playwright suite.
- **Fit scale** keeps large arrays framed; the plan left over-large arrays to the camera.

## Verification

All of this was run on the final build; the run that produced it is described here so it can be repeated.

| What | How | Result |
|---|---|---|
| Manifest, Inspector, wiring, choreography | `npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2CanopyPreset.test.ts` | 19 pass |
| Layout, patterns, solver, authority | `…Cinema2CanopyGeometry.test.ts` | 31 pass |
| Triggers, transport, resets, BPM Sync, music response | `…Cinema2CanopyAudio.test.ts` | 31 pass |
| GL lifecycle, draw batches, meshes, production runtime re-entry | `…Cinema2CanopyNativeRendering.test.ts` | 17 pass |
| Real runtime, real Audio Feature Bus, headless Chrome | `npm run visual:canopy:production` (sections: `--only=hero,patterns,controls,audio,timing,lifecycle`) | 86 checks, 0 failed |
| Typecheck / lint / build | `npx tsc --noEmit`, `eslint`, `vite build` | no new errors; the repo's 79 existing type errors are unchanged |

The browser run drives `Cinema2Runtime` through `src/test/browser/cinema2-canopy-production.html` with a deterministic Audio Feature Bus fixture (`scenario=steady|bass|vocal|build|drop|none`) and asserts on both the solved rod state and the pixels. It writes captures, contact sheets (hero, patterns at rest and under music, controls, audio) and `manifest.json` under `artifacts/cinema2-canopy-acceptance/run-*` (gitignored).

Measured on Apple silicon, headless Chrome, 1080p, with the host's own frame timing: about 2.7 ms CPU per frame at the default 8 × 8 and at the 12 × 12 maximum, 1.8 ms at low quality; 23.5 kB of GPU memory reported by the module; two instanced draws per frame; no scene lights; no GL errors in any capture. The frame is vsync-locked, so wall time reads 16.65 ms.

## Release gate status

| Gate (`docs/DRMVYZ_Cinema2_CANOPY_Implementation_Plan/09_RELEASE_GATE.md`) | Status |
|---|---|
| A. Visual and geometry: catalog entry, 3D rods, 8 × 8 default, mounts, no clipping at 16:9 / 1:1 / 4:3 / 9:16 / resize / largest array, bloom-off legible, rods respond to controls | PASS (automated). Human review of the captures: **NOT DONE** |
| B. Engine wiring: registered, authoring + compiler clean, engine-resolved values every frame, GL resources released, ≤ light limit | PASS |
| C. Inspector and authority: four parents, BPM Sync, Pattern / Pattern Change / Trigger, 11 canonical triggers, manual edit wins, five independent colours, every control has an output, hard zeros hold under Auto Performance | PASS. Camera Motion is a 0–1 amount, not a boolean (see *Differences from the plan*) |
| D. Musicality: shared audio only, bounded rules, continuous / kick / snare / build / drop / vocal responses | PASS in production. **Phrase and section responses are verified in unit tests only**: the browser fixture publishes no phrase or section markers |
| D. Auto Performance restores the base pattern after a temporary override | N/A: no pattern override is implemented, and the UI makes no such promise |
| E. Tests and review: unit, production harness, motion, bloom, no GL errors, frame time, typecheck/build | PASS. Human visual and musical sign-off: **NOT DONE** |

Not verified: a real analysed track (only the deterministic fixture), hardware other than the machine above, the React app's preset switcher (re-entry is covered at the runtime level), and a Playwright suite (the harness here is Vite plus headless Chrome, like Marquee's).
