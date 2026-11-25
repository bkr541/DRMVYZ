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
