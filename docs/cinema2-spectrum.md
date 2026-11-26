# SPECTRUM | Circular media arena

**Native reference, pending production and human acceptance.** Stable ID `drmvyz.cinema2.spectrum`, module `spectrum-native`, authored media slot `spectrum-arena-media`. This is independent of MOSAIC and REFRACTION; their source, manifests and behavior are unchanged. No dependencies, migrations, remote assets or new storage are introduced.

## Composition and geometry

Right-handed Three world, Y up, rear wall along negative Z. The world origin is the center of the arena. Nominal radius 7 units, screen height 3.65 units, ground at -3.05, platform at -2.78. The camera starts at (0,.65,3.6), targets (0,-1.15,-4), 52° vertical FOV, near .12, far 65. The camera is inside the minimum radius (5.6) and is constrained by the shared camera safety box. This deliberately uses small bounded camera drift rather than a free orbit; the shared minimum-aspect fit retains horizontal composition in narrower output. It does not guarantee the same visible screen area at all extreme aspect/radius/height combinations without browser verification.

8–16 actual concave curved bays, opaque closed housings, fixed pylons and seams, overhead curved emissive strips and three structural rings, five floor light tracks and a circular plinth. Each bay's local +Z faces the center, with angular horizontal UVs and bottom-to-top V. Moving transforms pivot each bay about its center and translate along its radial rail. The closed backing extends outward; a physical screen sits in front. The front arc sits behind the authored camera rather than becoming a foreground wall. Geometry is generated deterministically in `SpectrumScene.ts`, not downloaded. The vector blueprint is original and contains no user media. Design influence: DEPTH receding perspective, GLASSFALL layered opaque construction and shadows, CONDUIT circular energy routing.

## Media and source behavior

The existing Source tab accepts images and video. SPECTRUM uses the same named-pool selector as CANVAS/EVERYWHERE/MOSAIC/REFRACTION, the workspace's active pool ID and existing signing/resolution services. Source Mode Auto selects the active pool if present, otherwise the direct slot; Single uses only the direct slot; Pool uses only the active pool; Procedural uses neither. Existing slot persistence stores stable references; pool identity remains the workspace's shared active pool selection, not a new preset-private pool ID. It is not independently pinned per saved SPECTRUM preset. Empty or unresolved resources fall back to original procedural spectral bands. Standard source panel status is reused; detailed per-group errors are not added.

Front Arc covers approximately one third of bays, Wide Arc two thirds, Full Wrap the entire circumference with seam behind the camera. Angular UVs use the original bay coordinates, including physical gaps, and do not slide as the bay moves. Contain is default and preserves ordinary media aspect (unused area dark); Cover crops; Fill is explicit stretch. Full Wrap is intended for panoramic assets; ordinary images are centered/letterboxed with Contain rather than stretched by default. Grouped mode partitions the active bays into three or four contiguous groups. At most three managed pool textures are used, so the fourth quadrant reuses a feed. Continuous mode shares one feed across the arc; the existing pool runtime may retain up to three ready channels for advancement. Source changes fade from procedural to ready content, not a full dual-source crossfade. Shared media leases handle decode, mute, transport and disposal; same-context WebGL handles are borrowed by Three wrappers and detached before disposal. No per-bay video elements. Hidden media disables display meshes and releases pool feeds through the existing runtime; direct slot ownership remains with the shared manager.

## Patterns and timing

| Pattern | Scene behavior |
|---|---|
| Orbit | Low radial wave and sequential light packet, restrained tilt |
| Radial Sweep | Higher radial extension and traveling floor pulses |
| Panorama | Mostly static aligned media arc, low trim activity |
| Arena Pulse | Alternating bay groups and floor accents |
| Circumference Relay | Narrow sequential bay-to-bay light packets |
| Surround | Side-weighted extension and tilt, staged upper and floor light |

Uses `Cinema2BeatClock`, `Cinema2MainframePatternController`, `Cinema2PatternControlResolver` and `Cinema2PatternAutoPerformance`; no additional analyzer. Pattern Change uses the canonical eleven Afterhours events, resolved once per update. Manual pattern edits, trigger changes and resets suppress current event identity through the controller. Mood choices use the shared boundary policy; temporary build/drop choices are Radial Sweep/Surround, drop hold four beats. Calm Panorama/Orbit; driving Circumference Relay/Arena Pulse; tense Radial Sweep/Orbit; peak Surround/Arena Pulse. The host and preset BPM Sync must both allow sync. At sync on, phase advances pi/4 per shared beat (eight beats per revolution); doubled phase gives a four-beat floor cycle. Sync off uses pi/4 radians/sec before Orbit Rate multiplier (eight-second nominal cycle). Idle uses 18% of the free rate; paused phase is held. Identity includes track, publisher, analysis/timeline revision and context/discontinuity generation. Pool timing uses the existing pool choices independently, with fresh beat/kick/snare/section or qualifying bar events, and shared runtime channel ordering. Saved parameters are not mutated.

## Signal routes and authority

The manifest declares shared continuous reads, strength `spectrum-reactivity`, replace into normalized native signal targets; those targets are interpreted as bounded additions in `spectrumPose` and `floorPulse`. Master Intensity scales emitted light and motion. Director build and impact are significance only, never source ownership. Signals default to zero when unavailable. Continuous smoothing in milliseconds and event envelopes in seconds are listed below; continuous smoothing uses the canonical single smoothing constant, not a separate local attack/release detector.

| Signal | Smoothing or attack/hold/release | Native destination |
|---|---|---|
| Sub/bass | 160/120 ms | max of bands; floor +.20, bay extent +.15 |
| Mid | 150 ms | tilt limit up to +5° (25° cap) |
| High/air | 100/125 ms | upper and trim +.15 |
| Energy | 180 ms | trim +.08 |
| Vocal | 220 ms | motion, upper, spill, floor up to 30% restraint |
| Director build | 200 ms | extension +.15 times opening; bounded build override under Auto |
| Director impact | 150 ms | scales drop extension and floor release |
| Kick | .03/.025/.24 | extension +.25 times opening; floor +.28 |
| Snare | .02/.02/.18 | alternating tilt +.20 of angular limit |
| Beat | .03/.02/.20 | floor +.14 |
| Downbeat | .055/.05/.38 | trim +.12 times packet |
| Phrase | .15/.10/.80 | trim +.08 |
| Drop | .17/.10/1.50 | surround override when Auto; impact-scaled extension/floor |

All except drop are `not-silent`; event rules are once-per-event and use restart envelopes. Native response limits, readability and safety are applied after signals. Shared silence stops phase advancement and suppresses non-drop events. No local silence detector.

| Mood target (base) | Source | Operation / magnitude |
|---|---|---|
| Bay Opening (.35) | energy | add .15 |
| Circumference Sweep (.55) | build | add .20 |
| Orbit Rate (1) | momentum | multiply up to 1.30 |
| Floor Relay (.55) | shock | add .15 |
| Bloom (.25) | peak | add .08 |
| Light Spill (.30) | brightness | add .12 |
| Bay Opening (.35) | silence | add -.30 |
| Floor Relay (.55) | silence | add -.40 |

Shared mood authoring clamps to authored ranges, gates with Auto Performance and reactivity; catalog coverage supplies additional numeric drives where eligible. Fixed geometry and source presentation are exempt. No bespoke inspector or live-value UI. Shared generic lock, notes, reset and palette policy apply.

### Control-by-control authority and consumer matrix

Manual edits are immediate when unlocked and saved values survive automation. `User` means no audio/Director/Auto mutation of authored value; `Mod` means bounded resolved target/native interpretation only; `Policy` means temporary runtime authority, never saved mutation.

| Property | Manual | Audio | Director | Auto | Consumer / edit behavior |
|---|---|---|---|---|---|
| Quality | User | None | None | None | shared tier, curved tessellation |
| Auto Performance | User | None | None | Gate | shared mood/lock/override authorization |
| BPM Sync | User | timing | None | None | beat clock/host sync, phase continuous |
| Master Intensity | User | Mod | Mod | Mod | scales scene responses |
| Music Reactivity | User | Gate | Gate | Gate | strength of shared rules |
| Motion Safety | User | None | None | None | full/reduced/lockoff, shared camera and bay poses |
| Pattern | User | Policy | Policy | Policy | immediate base selection |
| Pattern Change | User | Policy | None | Policy | effective trigger cycling |
| Trigger | User | Policy | None | Policy | event identity; visibility from saved change |
| Camera Motion | User | None | None | None | hard shared motion enable |
| Camera Amount | User | Mod | Mod | Mod | shared bounded drift |
| Bay Count | User | None | None | None | active instances and arc segments |
| Arena Radius | User | None | None | None | ring scale and bay anchors |
| Display Height | User | None | None | None | screen/structure Y scale |
| Bay Gap | User | None | None | None | physical angular seam |
| Panorama Coverage | User | None | None | None | mapped angular extent |
| Bay Opening | User | Mod | Mod | Mod | radial extension |
| Bay Tilt | User | Mod | None | Mod | local pivot angle |
| Orbit Rate | User | timing | None | Mod | phase rate |
| Floor Relay | User | Mod | Mod | Mod | floor ring pulse intensity |
| Circumference Sweep | User | Mod | Mod | Mod | trim packet intensity |
| Overhead Emission | User | Mod | None | Mod | upper ring emission |
| Arena Media | User | None | None | None | canonical Source slot |
| Source Mode | User | None | None | None | source route |
| Media Visible | User | None | None | None | hard display enable |
| Media Fit | User | None | None | None | aspect-aware UV |
| Media Layout | User | None | None | None | continuous/grouped mapping |
| Grouping | User | None | None | None | angular group bounds |
| Media Scale | User | None | None | None | UV transform |
| Media X Offset | User | None | None | None | UV translation |
| Media Y Offset | User | None | None | None | UV translation |
| Media Rotation | User | None | None | None | aspect-correct UV rotation |
| Media Opacity | User | None | None | None | content mix |
| Media Brightness | User | None | None | None | content exposure |
| Transition Duration | User | None | None | None | fade-in time |
| Media Readability | User | None | None | None | motion restraint |
| Pool selection | User | None | None | None | existing workspace active pool |
| Pool Automation | User | Policy | None | None | separate event authorization |
| Pool Trigger | User | Policy | None | None | separate pool event cadence |
| Bloom | User | None | None | Mod | existing HDR pass intensity |
| Atmosphere | User | None | None | Mod | existing volumetric pass mix |
| Reflection Strength | User | None | None | Mod | environment/metal response |
| Shadow Strength | User | None | None | Mod | shared shadow-casting key intensity |
| Light Spill | User | Mod | None | Mod | bounded local point light |
| Cinematic Finish | User | None | None | Mod | existing finish pass mix |
| Background | User | None | None | None | environment color |
| Structural | User | None | None | None | bay/truss/pylon material |
| Primary Energy | User | None | None | None | floor/trim/light |
| Secondary Energy | User | None | None | None | upper strips |
| Accent | User | None | None | None | seam strips |

## Lifecycle / quality

Fixed instance capacity 16; repeated bays use seven instanced batches. Curved tessellation 6 on low, 12 otherwise; geometry replaced only when count, gap or tier changes. Shared HDR depth render graph and shadow quality policy. Five ring meshes and three truss meshes use shared geometries; one local point light, shared authored rig. No new per-frame React state. Scene resource owner disposes geometry, materials and borrowed texture wrappers; pool owner disposes managed slots and cancels stale loads. No private media in catalog artwork. No measured frame-time or GPU memory claim.

## Validation and outstanding gates

`npm ci --offline --ignore-scripts --no-audit --no-fund`: failed ENOTCACHED (zustand 5.0.13). `npm ping --fetch-retries=0`: failed EAI_AGAIN (registry unreachable). `npm run typecheck`: failed TS2688, missing vite/client. A standalone attempt to load the manifest/compiler without Vite also stopped on missing react/jsx-runtime. The focused Vitest suite is included but is not certified as passing. Dependency-free domain and transpile checks and clean-tree patch applicability are recorded in the delivery report. No real-browser render, production capture, media decode/pool persistence, full trigger/Auto lock/live display, casting/recording, resize, resource leak or GPU benchmark was executed. The current shared pool selection is workspace-wide; independent saved pool assignment, full four-distinct-source quadrant mapping and a true dual-source crossfade are not implemented. Human visual acceptance remains pending; do not promote to keeper.

## QA-03 | Initialization and production acceptance follow-up

**Status: source-level lifecycle defects addressed; production rendering remains unverified.** The original blank-screen report could not be reproduced in this environment because the browser runner could not start. No change to the arena geometry, palette, camera, patterns, Source ownership, audio policy or authored defaults was made.

### Trace and confirmed gaps

- The reference preset manifest registers `spectrum-native` / `spectrum-machine`; its generated arena has no external model asset to fetch. The runtime compiles the manifest, allocates WebGL and graph targets, creates a module resource scope and invokes the world provider. The provider loads the shared Three library, creates the arena bridge, prepares environment/textures/shaders and then draws into the native depth target. The render graph composites that target to the production canvas. `renderReady` is reported only after a successful draw with a ready bridge; actual visual acceptance additionally requires real canvas pixels. Runtime retirement/context loss disposes the module scope; context restoration activates a new instance for an inactive module.
- SPE-01 already prevented frame-by-frame download retries and ignored a retired module's async results. QA-03 adds a 30-second monotonic deadline for lazy library load and a separate 30-second deadline for arena warmup, observed on frame execution (or late library completion). Library rejection/timeout stays a visible recoverable diagnostic with no module GPU leases; pool creation now occurs only after successful library resolution. Reselecting creates a new module. A hung shared dynamic import cannot be cancelled; reentry uses the same outstanding promise rather than spawning duplicate downloads, and can succeed when it resolves or after a rejection clears the cache. A timeout never publishes resources into the timed-out instance.
- The shared Three bridge previously converted a rejected `compileAsync` into `ready` for Spectrum. Spectrum now opts into strict shader preparation: rejection is retained only for the live bridge generation and thrown on the next draw, so the runtime records a failed module and releases tracked resources. A stalled arena warmup likewise throws. Other presets keep their existing preparation behavior. This corrects false readiness and unbounded pending states, but does not establish the cause of the original blank report. Shader errors that Three logs rather than rejects are still caught by the browser evidence gate, not claimed to be solved by this change.
- Recovery requires a new selection after a fatal module failure; there is no automatic per-frame restart. Host diagnostics retain the thrown reason after retirement. The existing shared per-context Three renderer/environment is not a module lease and remains under its existing context lifecycle.

### Reproducible checks

The targeted Spectrum suite now exercises delayed completion, load rejection/reentry, load timeout with a pool source, warmup timeout, strict shader rejection and ignored retired errors, plus actual module-host pool lease retirement on an injected fatal construction failure. The dedicated browser runner keeps the existing distributed arena-light criteria, adds shared spatial-variation checks, captures default/build/drop/breakdown and sustained drop frames, checks the real picker through Afterhours/Honey/Allstar, retirement snapshots, pause/resume/seek, pattern/quality/portrait, direct image source selection/removal, context restoration and test-only rejected, malformed and delayed library fixtures. It writes real PNGs plus lifecycle/resource/GL/pixel metrics, renderer identity, console errors and request failures to `artifacts/cinema2-spectrum/qa-03/`. The centralized QA-01/02 release policy and inventory are unchanged and remain authoritative for additional supported media formats and full release coverage. The browser runner's unknown renderer classification is intentionally not reported as verified hardware.

### Execution record (Linux, Node 22.16.0, npm 10.9.2)

| Command | Result in patch authoring environment |
|---|---|
| `npm ci --ignore-scripts --offline` | Exit 1: ENOTCACHED, zustand 5.0.13 |
| `npm ping --fetch-retries=0 --fetch-timeout=4000` | Exit 1: EAI_AGAIN, registry DNS unavailable |
| `npm run test -- --run src/components/vyzualz/cinema2/__tests__/Cinema2SpectrumPreset.test.ts` | Exit 1: partition wrapper rejected flag; corrected invocation below |
| `npm exec --offline -- vitest run src/components/vyzualz/cinema2/__tests__/Cinema2SpectrumPreset.test.ts` | Exit 1: ENOTCACHED, Vitest unavailable; regressions not executed |
| `node scripts/run-cinema2-spectrum-browser.mjs` | Exit 1: missing `@playwright/test`; no browser or GPU initialized |
| `npm run test:e2e:cinema2-release -- --presets spectrum` | Exit 1: manifest technicalStatus `incomplete`, Spectrum `not-run`, missing `@playwright/test` |
| `npm run typecheck` / `npm run build` | Both exit 2: TS2688 missing `vite/client` |
| `npm run test:cinema2:release-policy` | Exit 0: 16 passed, 0 failed |
| Changed TypeScript files via `typescript.transpileModule` / runner via `node --check` | Exit 0: syntax/transpile only, not a project typecheck |

On a dependency-equipped checkout, run `npm ci`, the targeted suite (`npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2SpectrumPreset.test.ts`), the dedicated browser runner and centralized Spectrum release command above. Install the documented Playwright browser if necessary. Review actual default/drop captures and statuses; no pixel values, measured GPU resource counts, renderer identity or hardware/software browser classification exist from this authoring run. The new browser scenarios, media/quality transitions, resource metrics, simulated failure and context loss checks are unexecuted. Human visual review and QA-07 Electron preview/fullscreen/casting remain pending; do not promote Spectrum based on syntax checks or policy tests alone.
