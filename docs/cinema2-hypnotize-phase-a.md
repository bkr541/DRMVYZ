# Cinema 2.0 “Hypnotize” — Phase A analysis and creative direction

**Status:** Final technical acceptance complete — awaiting owner human visual approval
**Preset:** `Hypnotize`
**Planned id:** `drmvyz.cinema2.hypnotize`
**References:** `/Users/kodyrobinson/Desktop/Hypnotize_1.mov` and `/Users/kodyrobinson/Desktop/Hypnotize_2.mov`

This document began as the authored reference specification required by `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md`. Hypnotize is a new preset, not a legacy port. Sections 1–14 preserve the approved Phase A analysis and design; Sections 15–18 record the implementation and final technical acceptance.

## 1. Reference evidence

| Reference | Technical facts | Primary contribution |
| --- | --- | --- |
| `Hypnotize_1.mov` | 898 × 876, 7.31 seconds, H.264, near-square, stereo AAC | Black optical mechanism, concentric braided rings, turbine membrane, central iris, spectral edge splitting and restrained head-on composition. |
| `Hypnotize_2.mov` | 1056 × 1012, 6.16 seconds, H.264, near-square, stereo AAC | Deep cylindrical shaft, hard-surface radial ribs, axial travel, warm/cool light banks, luminous central portal and large exposure pulses. |

The visible “Visit site,” fullscreen and replay buttons are capture overlays and must not appear in the preset.

### 1.1 `Hypnotize_1` visual inventory

- A front-facing circular mechanism fills the square frame. The outer structure is intentionally cropped, making it feel larger than the viewport.
- Three clear radial zones are visible: a dark center iris, an inner turbine/membrane ring and an outer braided or helical ring.
- Approximately dozens of repeated dark vanes connect the inner and outer radii. Their curvature produces a woven, organic turbine rather than a flat sunburst.
- The center alternates between a nearly black polygonal aperture, a tiny white focal point and a contained luminous disc.
- The inner perimeter is articulated by small bright nodes. The outer perimeter reads as interlaced luminous links rather than one continuous line.
- Most structure is black-on-black and becomes visible through narrow specular highlights, local emission and chromatic red/cyan fringes.
- Motion is primarily rotational and radial: counter-rotation, four-lobed deformation, ring breathing, iris contraction and short focal pulses. The camera remains nearly centered and does not rely on a broad orbit.
- Brightness changes are abrupt enough to feel musical, but the dark state remains the dominant visual identity.

### 1.2 `Hypnotize_2` visual inventory

- A cylindrical radial tunnel converges on a bright central lens or portal.
- Long hard-surface ribs extend from the foreground toward the center. Repeated collars and small lights establish real depth between foreground and vanishing point.
- The tunnel alternates between bright warm orange/white banks and cool cyan/blue/violet banks. Dark metal remains visible between the emissive rails.
- Apparent camera travel is axial. Scale and FOV pulses make the center alternately approach and recede without losing the centered composition.
- The core alternates between an overexposed white disc, a cyan lens and a smaller blue-violet orb with internal radial detail.
- Large discharge frames illuminate most rails, while low states preserve a distant portal and sparse edge highlights.
- The strongest motion vocabulary is depth chase, radial recruitment, bank alternation, core compression and outward discharge.

### 1.3 Mandatory versus inspirational traits

| Trait | Decision |
| --- | --- |
| Centered circular composition and strong vanishing point | Mandatory. |
| Readable dark structure surrounding emissive elements | Mandatory. |
| Concentric turbine, braided ring and radial tunnel vocabulary | Mandatory. |
| Counter-rotation, radial breathing and axial travel | Mandatory. |
| Warm/cool bank contrast and spectral edge color | Mandatory, with user-owned palette colors. |
| Dark low state and controlled bright discharge state | Mandatory. |
| Exact ring, blade or node counts | Inspirational only. Counts will be quality-aware and performance-tested. |
| Exact source timing or short-loop sequence | Inspirational only. Motion will use Cinema 2.0 timing and Audio Intelligence. |
| Exact source geometry or textures | Not copied. Hypnotize will use original procedural construction. |
| Unbounded white clipping | Replace with HDR luminance, finite clamps and readable light cores. |
| Social-player overlays | Remove. |

## 2. Existing Cinema 2.0 assessment

There is no existing Hypnotize preset or module. The first-party registry contains no conflicting `Hypnotize` identity.

### 2.1 Systems to retain and reuse

- The native preset manifest, compiler, first-party catalog and authoring validator.
- Engine-owned WebGL2 context, color/depth targets, resource leases, diagnostics and context recovery.
- `Cinema2AudioIntelligenceBridge` as the only source of bands, events, structure and discontinuities.
- `Cinema2VisualDirector` for broad intensity, momentum, build and transition significance.
- `Cinema2ChoreographyRuntime` and final-value resolver for bounded temporary modulation.
- `Cinema2BeatClock` and the shared transport clock for synchronized motion.
- The camera runtime's tempo-aware motion, motion-safety controls and deterministic reset behavior.
- Existing depth-aware atmosphere, HDR bloom, temporal feedback and cinematic finish effects.
- The production browser-harness pattern used by Interlock, Depth, Mainframe and Sixfold.

### 2.2 Relevant precedent

| Preset/system | Reuse | Boundary |
| --- | --- | --- |
| Depth | Repeating tunnel layout principles, axial camera timing, transport-safe repetition and quality tiers. | Hypnotize requires circular sectors, rotating membranes and a living core; it must not be a round reskin of Depth's square gates. |
| Event Horizon | Central focal hierarchy and bounded lens-like energy treatment. | Hypnotize is a manufactured optical engine, not an accretion disk or particle field. |
| Ancient Machine 2.0 | Instanced concentric mechanical geometry and independent central-core draw. | Hypnotize uses flexible turbine vanes, braided light paths and an extended depth shaft rather than discrete gear rings. |
| Mainframe / Sixfold | Deterministic pattern selection, canonical Trigger behavior and manual takeover. | Hypnotize patterns operate on circular/depth domains unique to this preset. |

### 2.3 Technical limitations and design responses

- Emissive geometry does not automatically illuminate nearby structure. Local spill will be authored in the material shader and supported by restrained atmosphere rather than dozens of real lights.
- Full-frame chromatic aberration can destroy the dark structure. Spectral separation will be strongest on emissive edges and only lightly supplemented by the finish effect.
- Dense radial repetition can alias near the center. Inner radii, sector count and mip-like quality reductions will keep projected segments above a readable size.
- Unrestricted tunnel travel can break the centered composition. Camera translation, roll and target offsets will use tight safe bounds and a Lock Off mode.
- A bright core can wash out every other element. The core has an independent luminance ceiling and the bloom chain retains a sharp source underneath its halo.

## 3. Creative design proposal

### 3.1 Identity

Hypnotize is an infinite optical engine: a black radial machine whose turbine, braided conductors and luminous tunnel focus attention on a living portal. It should feel simultaneously manufactured and organic. The reference `_1` supplies the dark mesmeric face; `_2` supplies the depth, architectural rails and discharge scale.

The default still must already read as a dimensional circular machine. Audio, camera and effects enhance that image; they do not create it.

### 3.2 Default composition

- The camera looks almost directly down the negative Z axis.
- A circular core occupies roughly 12–15% of the shorter frame dimension.
- The primary inner turbine occupies roughly 38–44%.
- A braided conductor ring sits near 48–54%.
- Foreground ribs and an outer collar extend beyond the shorter frame dimension, intentionally cropping at the edges.
- Six to eight progressively smaller depth collars lead toward the core.
- The structure remains centered by default. Full camera motion may drift no more than roughly 3% of the shorter frame dimension.
- The square source framing informs the hierarchy, but the authored production target is 16:9 with responsive square and narrow-Stage behavior.

### 3.3 Coordinate, depth and safe-bounds contract

- World-space, right-handed Cinema 2.0 coordinates; the tunnel axis is negative Z and the visual origin is `(0, 0, 0)`.
- Radial geometry is generated around the Z axis from deterministic sector indices.
- The near foreground collar may overscan to 115% of the shorter viewport dimension; the core and primary turbine must remain inside the central 62% safe circle.
- Geometry repeats over a fixed Z lap distance. Camera travel and geometry recentering derive from the same absolute clock and repeat distance.
- Near/far planes must preserve depth precision across the visible tunnel. Nothing important may intersect the near plane in the default or Reduced modes.
- Aspect handling uses the shorter viewport dimension as the radial scale authority. Wide canvases reveal more side structure; narrow canvases crop outer architecture while preserving the complete core and turbine.

### 3.4 Six independent visual systems

1. **Core Lens** — a faceted circular energy lens with an inner pupil, HDR heart, spectral rim and bounded radial pressure.
2. **Iris Turbine** — curved vanes arranged around the core; each vane can pitch, lengthen and counter-rotate by deterministic group.
3. **Braided Conductors** — two interleaved node/strand paths around the turbine, capable of orbiting, chasing and splitting into opposing banks.
4. **Filament Membrane** — dark flexible radial ribbons connecting the turbine to the conductor ring, producing the four-lobed organic deformation from `_1`.
5. **Depth Ribs** — extruded black-metal rails and repeated collars extending toward the camera, providing the architectural shaft from `_2`.
6. **Spectral Halo Field** — sparse edge motes, short radial glints and localized chromatic halos that clarify motion without becoming a generic particle cloud.

All six systems are independently addressable by the pattern engine and receive separate bounded audio targets.

### 3.5 Geometry and materials

- One reusable curved-vane mesh, instanced by sector and depth family.
- One reusable rail/rib mesh, instanced across sectors and tunnel collars.
- Braided paths rendered from a compact strand mesh plus instanced luminous nodes; they are not flat line primitives.
- Filaments use a low-segment ribbon mesh with shader deformation from stable radial coordinates.
- The core uses its own sphere/lens mesh and shader so it can remain circular and detailed at all quality levels.
- Structural material: black nickel/obsidian with controlled roughness variation and narrow cool specular edges.
- Emissive materials: HDR cool, warm, core and spectral roles with a finite luminance ceiling.
- No external GLB, image texture or third-party asset is required for the initial implementation.

### 3.6 Lighting and effects

- Low ambient fill reveals only near-facing metal edges.
- Shader-authored local spill reveals structure immediately adjacent to active conductors and rails.
- One subtle cool key/rim contribution establishes depth without flattening the black field.
- Depth-aware atmosphere is confined to the shaft and core halo.
- HDR bloom creates a contained halo; the source geometry remains sharp.
- Temporal feedback is optional and restrained. It trails conductors and core discharge, not the entire frame.
- Cinematic finish supplies tone mapping, contrast, vignette, grain and very light global aberration.
- Depth of field is not part of the initial plan: both references depend on crisp radial structure and a readable center.

### 3.7 Camera role

- Default: centered inspection view with slow axial drift and very small target weave.
- Full Motion: bounded forward/back travel, 1–3° roll, subtle FOV breathing and shallow off-axis drift.
- Reduced Motion: no rapid axial push, maximum 0.5° roll and reduced FOV modulation.
- Lock Off: fixed camera and fixed target; visual systems may still animate.
- Automatic camera behavior may accent builds and drops only when Auto Performance is enabled and Motion Safety permits it.

### 3.8 Idle, build, vocal and drop behavior

- **Idle/no audio:** slow counter-rotation, shallow core breathing and a sparse conductor orbit. No flashes or aggressive camera motion.
- **Steady groove:** bass breathes the core and tunnel radius; kicks articulate the iris; snares switch opposing conductor banks.
- **Vocal passage:** outer rib emission and filament turbulence recede, leaving a clear core and slow braided orbit.
- **Build:** core compresses, the turbine tightens, rotation relationships converge, depth chases accelerate and the camera approaches within its safety bound.
- **Drop:** a short bounded blackout is followed by an outward core discharge, radial rail recruitment, a controlled FOV punch and a warm/cool polarity swap. It returns to the authored base without leaving stale state.

## 4. Authored pattern vocabulary

Hypnotize will ship with six visibly different patterns. Pattern changes crossfade rather than hard-cut geometry, except the deliberately short drop blackout.

1. **Mesmeric Orbit** — balanced default; slow counter-rotation and alternating conductor orbit.
2. **Black Iris** — darkest `_1`-inspired state; compressed core, dominant membrane and sparse spectral edges.
3. **Turbine Bloom** — long bright vanes unfurl from the core in rotating radial waves.
4. **Chromatic Relay** — warm and cool sector banks chase around the rings and down the shaft.
5. **Infinite Draw** — depth ribs and collars dominate while the camera and light front travel toward the portal.
6. **Radiant Collapse** — build/drop program: inward compression, bounded blackout, then outward white/core discharge and afterglow.

### 4.1 Pattern choreography matrix

| Pattern | Core Lens | Iris Turbine | Braided Conductors | Filament Membrane | Depth Ribs | Spectral Halo Field | Camera/effects |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mesmeric Orbit | Medium cyan pupil with gentle breath | Slow clockwise motion | Opposing counter-clockwise orbit | Low four-lobe warp | Sparse edge highlights | Low node twinkle | Centered drift, restrained bloom |
| Black Iris | Small dark pupil, narrow rim | Tight, slow, low emission | Brightest structural cue | High organic warp, low luminance | Nearly dark | Fine red/cyan edge split | Locked-feeling camera, strong vignette |
| Turbine Bloom | Pulses on beats | Sequential vane extension and pitch wave | Inner ring follows wave front | Smooth radial tension | Mid-depth collars answer downbeats | Short radial glints | Subtle FOV breath, medium bloom |
| Chromatic Relay | Cool/warm polarity marker | Alternating sector banks | Two-color chase in opposite directions | Low warp with hue edge | Warm/cool lanes travel in Z | Bank-specific glints | Static center, modest trails |
| Infinite Draw | Distant, stable attractor | Lower local motion | Depth-indexed node chase | Stretched toward vanishing point | Primary system; forward/reverse light front | Sparse depth streaks | Strongest safe axial travel and haze |
| Radiant Collapse | Compresses, blacks out, then expands | Converges then reverses outward | Recruits all banks after blackout | Tension peaks then releases | Outward discharge across collars | One bounded halo burst | Drop FOV punch, bloom envelope, finite afterglow |

## 5. Control and visible-output specification

### Master Controls

| Control | Visible result |
| --- | --- |
| Master Intensity | Scales emissive systems and their local spill without lifting the background. |
| Music Reactivity | Scales permitted continuous/event modulation while preserving manual bases. |
| BPM Sync | Locks pattern phase, ring rotation relationships, depth chase and camera travel to shared musical timing. |
| Auto Performance | Allows section/build/drop context to select patterns and camera accents. |
| Motion Safety | Full, Reduced or Lock Off camera behavior. |
| Flash Accents | Hard authorization: Off, Reduced or Full. Off forbids full-frame discharge flashes even under Auto Performance. |

### Design

| Group | Control | Visible result |
| --- | --- | --- |
| Pattern | Pattern | Selects one of the six authored visual programs; a manual edit disables Auto Performance. |
| Pattern | Pattern Change | Enables deterministic program advance; enabling it disables Auto Performance. |
| Pattern | Trigger | Canonical beat, kick, snare, downbeat, bar, phrase or drop event used while Pattern Change is enabled. |
| Architecture | Ring Density | Changes visible radial sector population within the active quality ceiling. |
| Architecture | Tunnel Depth | Changes the number/span of visible depth collars and axial perspective. |
| Architecture | Core Size | Changes the authored core-lens radius. |
| Architecture | Vane Length | Changes turbine reach without moving the core. |
| Motion | Rotation Speed | Sets free-running rate or the synchronized rate multiplier. Zero freezes authored rotation. |
| Motion | Counter-Rotation | Changes the relative motion between turbine, conductor and depth families. |
| Motion | Warp Amount | Controls filament four-lobe deformation and strand torsion. |
| Motion | Pulse Depth | Sets the permitted radial breathing range. |
| Motion | Travel | Sets axial shaft/camera travel authority, still bounded by Motion Safety. |
| Motion | Seed | Deterministically changes grouping, phase and pattern ordering. |

### Effects

| Control | Visible result |
| --- | --- |
| Drop Strength | Caps compression, discharge travel and FOV punch. |
| Atmosphere | Changes depth haze without brightening black metal globally. |
| Bloom | Changes HDR halo around active emissive geometry. Zero is a hard effect off. |
| Trails | Changes conductor/core persistence. Zero is a hard effect off and clears history. |
| Chromatic Split | Changes spectral separation at bright edges. |
| Cinematic Finish | Changes tone curve, contrast, vignette and grain mix. |

### Palette role map

| Color control | Visual consumer |
| --- | --- |
| Background | Engine-owned void/background surface. |
| Structure | Black-metal turbine, ribs, collars and membrane base. |
| Cool Energy | Cyan/blue conductor banks, rail cores and local spill. |
| Warm Energy | Orange/amber relay banks and drop polarity. |
| Core | Central lens heart, inner pupil emission and core halo. |
| Spectrum Edge | Violet/red/cyan edge separation and sparse halo glints. |

All six colors are independent authored bases. Auto Performance cannot replace them.

## 6. Authority matrix

| Property | Manual control | Audio modulation | Visual Director | Auto Performance | Manual edit behavior |
| --- | --- | --- | --- | --- | --- |
| Pattern | Pattern | None unless Pattern Change is enabled | Variation significance may qualify a change | May select by section/build/drop | Selecting Pattern disables Auto Performance immediately. |
| Pattern advance | Pattern Change + Trigger | Selected canonical trigger only | No direct ownership | Mutually exclusive with manual Pattern Change mode | Enabling Pattern Change disables Auto Performance. |
| Master emission | Master Intensity | Bounded multiply through Music Reactivity | Intensity may scale within ceiling | Cannot exceed manual ceiling | User remains base authority. |
| Ring density | Ring Density | Vocal restraint may temporarily hide a bounded fraction | Intensity may reduce, never add beyond ceiling | May choose active groups, not authored maximum | Manual value remains ceiling. |
| Core size | Core Size | Bass/kick add bounded radial pressure | Build may compress within range | May invoke pattern-specific base multiplier | Manual value remains base; modulation returns cleanly. |
| Rotation | Rotation Speed + Counter-Rotation | Energy and events scale/offset rate | Momentum scales range | Pattern selects relationship | Manual values remain base; zero stays zero. |
| Filament warp | Warp Amount | Low-mid and flux add bounded deformation | Build adds tension | Pattern selects waveform | Manual zero forbids audio-added warp. |
| Pulse range | Pulse Depth | Bass and kick drive within range | Impact scales event ceiling | Pattern defines pulse shape | Manual zero forbids radial pulse. |
| Camera | Travel + Motion Safety | Downbeat/drop may add bounded punch | Build/impact may scale motion | May select accent only | Lock Off is absolute; Reduced remains a hard ceiling. |
| Flashing | Flash Accents | Events may flash only when authorized | Impact may scale authorized level | Cannot bypass setting | Off is absolute. |
| Colors | Six Palette colors | Only brightness/mix envelopes; no color replacement | None | Pattern may choose which authored role is active | Color edits never enable/disable automation. |
| Bloom/trails/haze | Individual Effects controls | Bounded additive envelopes | Impact/build may scale within ceiling | May time accents | A value of zero is a hard off. |

## 7. Audio Intelligence mapping

| Audio input | Consumer | Target/reaction | Timing | Authority |
| --- | --- | --- | --- | --- |
| Sub + bass | Core Lens, Depth Ribs | Core pressure and tunnel breathing, capped near +14% radius | Fast attack (~65 ms), slower release (~260 ms) | User base + modulation; Pulse Depth/Reactvity cap it. |
| Low-mid | Filament Membrane | Four-lobe warp and strand torsion | ~100 ms attack, ~320 ms release | User base + modulation; Warp Amount zero is authoritative. |
| Mid | Iris Turbine | Vane pitch and local extension | ~90/240 ms | User base + modulation. |
| High + air | Braided Conductors, Halo Field | Node sparkle, short glints and spectral-edge activity | ~45/170 ms | User base + modulation. |
| Overall energy | All emissive systems | Motion range and emission multiplier within the Master ceiling | ~160 ms smoothing | User base + modulation. |
| Spectral flux / transient energy | Membrane, Halo Field | Short localized ripple and edge flare | ~35/130 ms | Bounded modulation only. |
| Vocal presence | Outer systems | Reduce rib density, turbulence and camera energy while preserving the core | ~350 ms in, ~500 ms out | Auto Performance only; cannot lower user-authorized core visibility. |
| Kick event | Core Lens, Iris Turbine | Core pulse and inner-vane radial hit | 20 ms attack, 180–240 ms release | Enabled by Music Reactivity. |
| Snare event | Conductors, Halo Field | Opposing-bank snap and spectral glint | 20 ms attack, 280 ms release | Enabled by Music Reactivity. |
| Downbeat | Turbine, Depth Ribs | Whole-ring alignment plus selected collar pulse | 35 ms attack, ~480 ms release | Auto Performance/choreography; bounded. |
| Phrase | Pattern engine | Variation or next pattern only when Pattern Change/Auto permits it | Quantized, once per event | Never overrides a manually selected fixed Pattern. |
| Build progress | Core, turbine, camera | Compression, convergence, faster chase and bounded approach | ~150 ms smoothing | Auto Performance only. |
| Drop | All six systems | Short authorized blackout, outward discharge, polarity swap and afterglow | 60–90 ms blackout, ~1.4 s discharge, finite afterglow | Auto Performance + Flash Accents + Drop Strength. |
| Section / Director transition | Pattern engine | Select an appropriate low, groove, build or peak family | Crossfade ~0.3–0.6 s | Auto Performance only. |

Different signals intentionally control geometry, motion, density, grouping and effects—not only brightness.

## 8. BPM Sync timing contract

- **Sync On:** shared Cinema 2.0 transport/beat timing drives pattern phase, ring rotation ratios, conductor chase, collar travel and camera lap rate. Pattern-change beat/bar/phrase triggers use canonical events. No local BPM detector is allowed.
- **Sync Off:** the same domains run from absolute visual time at the authored free-running rate. Kick, snare, transient and drop events remain audio-driven; disabling sync does not disable reactivity.
- Changes between modes reconstruct phase from absolute time rather than accumulating delta transforms.
- Pause freezes synchronized and free-running authored motion when transport animation is inactive. Resume, seek, loop, source change, analysis revision and preset re-entry reset or reconstruct transient state deterministically.
- The camera and geometry share one repeat/lap clock so no loop seam appears.

## 9. System ownership map

| System | Ownership |
| --- | --- |
| Audio facts | `Cinema2AudioIntelligenceBridge`; read-only to the preset. |
| Broad significance | `Cinema2VisualDirector`; no geometry-specific knowledge. |
| Temporary musical behavior | Compiled Cinema 2.0 choreography plus module-local deterministic pattern state for per-instance distribution. |
| User values and manual takeover | `Cinema2ParameterState` and final-value resolver. |
| Geometry/materials/pattern construction | New `hypnotize-native@1` module. |
| Timing | Shared transport and `Cinema2BeatClock`; no competing clock. |
| Camera | Cinema 2.0 camera runtime with preset safety controls. |
| Haze, bloom, trails and finish | Existing Cinema 2.0 effects and history ownership. |
| WebGL resources | Engine resource manager and module resource lease. |

## 10. Proposed implementation architecture

```text
Inspector + Audio Intelligence + Visual Director
                      │
                      ▼
              compiled choreography
                      │
                      ▼
             hypnotize-native@1
     ├─ absolute-time pattern controller
     ├─ quality-aware radial/depth layout
     ├─ six-system reactive state
     └─ native instanced WebGL2 renderer
                      │
             Cinema 2.0 camera/depth
                      │
                      ▼
 scene → atmosphere → optional trails → HDR bloom → cinematic finish
```

### Planned files

- `src/components/vyzualz/cinema2/presets/Cinema2HypnotizePreset.ts`
- `src/components/vyzualz/cinema2/modules/Cinema2HypnotizeNativeModule.ts`
- `src/components/vyzualz/cinema2/modules/hypnotize/Cinema2HypnotizeLayout.ts`
- `src/components/vyzualz/cinema2/modules/hypnotize/Cinema2HypnotizePatternEngine.ts`
- `src/components/vyzualz/cinema2/modules/hypnotize/Cinema2HypnotizeReactiveState.ts`
- `src/components/vyzualz/cinema2/modules/hypnotize/Cinema2HypnotizeRenderer.ts`
- `src/components/vyzualz/cinema2/modules/hypnotize/Cinema2HypnotizeQuality.ts`
- Focused unit tests, browser harness, visual metrics and capture runner under the existing Cinema 2.0 test conventions.

Expected existing-file edits in a later approved phase are limited to module registration, first-party preset registration, public exports and documentation index entries. Shared runtime changes are not currently justified.

## 11. Quality and performance plan

Initial budgets are hypotheses to be measured, not FPS claims.

| Tier | Radial sectors | Depth collars | Filament detail | Halo field |
| --- | ---: | ---: | --- | --- |
| Low | 40–48 | 4 | Reduced ribbon segments | Core and nearest ring only |
| Medium | 64–72 | 6 | Full silhouette, reduced subdivisions | Bounded active glints |
| High | 88–96 | 8 | Full ribbon subdivisions | Full bounded field |

- Geometry is generated once and reused through instancing.
- Stable instance attributes are immutable; only compact reactive data updates.
- Pattern math uses absolute time, stable indices and deterministic seeds.
- No per-frame object/array allocation in the renderer hot path.
- Expensive shadow maps are excluded from the initial design.
- Resource accounting, disposal, context restoration and quality degradation are required before production acceptance.
- Performance will be measured at 1920 × 1080 on the target machine before any frame-rate claim.

## 12. Visual acceptance plan

### 12.1 Static Phase B gate

Before motion or audio work, the default production render must show:

1. A readable circular core, turbine, braided ring, filament membrane and depth ribs.
2. Clear foreground-to-core depth from a centered 16:9 camera.
3. Deliberate outer-edge cropping without clipping the core or primary turbine.
4. Black structure visible through local reflections/spill, not global gray ambient light.
5. Sharp emissive sources under contained bloom.
6. The combined identity of both references without copying their exact geometry.

If the still does not immediately read as a deep optical engine, implementation stops before reactivity.

### 12.2 Reference checkpoints

- `_1` dark state: black iris, braided ring and filament silhouette.
- `_1` pulse state: expanded turbine and contained center flash.
- `_2` low state: distant cyan/violet portal with readable dark rails.
- `_2` discharge state: warm/cool radial banks and bright core without featureless clipping.

### 12.3 Production-path tests

- Baseline visibility with region metrics for core, turbine, braided ring and shaft.
- Every primary control at minimum/default/maximum; every pattern and Motion Safety option.
- Independent visible color-role changes for all six Palette controls.
- BPM Sync On/Off timing difference using deterministic transport.
- Multi-frame motion differences for rotation, membrane warp, depth travel and core breathing.
- Deterministic quiet, groove, vocal, build, drop and phrase fixtures.
- Manual Pattern takeover while Auto Performance is active.
- Flash Accents Off proving that no choreography can re-enable full-frame flashes.
- Pause/resume, seek, loop, track change, preset re-entry and context restoration.
- 16:9, near-square and narrow Stage resize captures.
- Low/medium/high quality composition parity and measured GPU/resource budgets.

### 12.4 Human acceptance

Actual render captures will be compared beside both reference contact sheets. Automated metrics prove visibility and change; the owner must approve composition, motion quality, visual weight, musicality, brightness and overall identity before the preset can be called complete.

## 13. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Looks like Depth with circular gates | Make the turbine, braided conductors and filament membrane primary; depth ribs are one system, not the whole preset. |
| Becomes a flat radial shader | Use real world-space vanes, rails, collars and depth occlusion with a perspective camera. |
| Bright core destroys detail | Separate HDR core ceiling, finite bloom clamp and region-based acceptance metrics. |
| Dense sectors shimmer or moiré | Quality-aware sector counts, readable inner radius and anti-aliased emissive cores. |
| Dark structure disappears | Local spill and narrow specular response; do not lift global ambient. |
| Motion causes discomfort | Full/Reduced/Lock Off controls and tight roll/travel/FOV limits. |
| Flash behavior is unsafe or uncontrollable | Explicit Flash Accents authorization with Off as a hard prohibition. |
| Automation fights Pattern or effects | Manual takeover metadata, zero-as-hard-off rules and authority tests. |
| Loop/seek leaves stale patterns | Absolute-time state plus discontinuity reset/reconstruction tests. |

## 14. Phase A completion gate

Phase A is complete when the owner approves or revises:

1. The combined **black optical engine + radial light tunnel** identity.
2. The six independent visual systems.
3. The six authored patterns and their names.
4. The default palette: black structure, cyan/blue cool energy, orange warm energy, white/cyan core and violet/red spectral edges.
5. The centered, bounded axial camera direction.
6. The Flash Accents safety/authority model.
7. The proposed manual controls, audio mapping and Auto Performance domains.

No implementation phase begins until this direction receives explicit approval.

## 15. Phase B static environment record

**Implemented:** 2026-10-13
**Gate:** approved before Phase C

Phase B adds the production Three.js visual foundation without the full Phase C pattern, Visual Director or camera choreography. A later owner-directed revision adds one deliberately narrow shared-Audio-Intelligence path for the exterior resonator bank; the central approved architecture remains static so its design can still be judged without motion masking it.

The static production scene includes:

- twelve radial sectors arranged as six paired architectural assemblies;
- eight nested depth collars connected by continuous black-metal axial ribs, with alternating arc rails, capsule banks, prism-and-lens markers, chevrons and dot ladders so adjacent rings do not repeat one LED language;
- an eighteen-vane curved iris turbine;
- two interleaved three-dimensional conductor strands with luminous nodes;
- twenty-four four-lobed membrane filaments;
- a faceted core lens, optical cage, pupil and corona;
- fifty-four sparse spectral glints plus bounded spectral arcs;
- sixteen 150%-scale circular resonators surrounding the full outer perimeter: alternating capsule-loop and faceted-node/chevron LED surfaces, with bounded shared energy/bass scaling, counter-rotation and emission response;
- independent structure, cool-energy, warm-energy, core, spectrum-edge and background palette roles;
- a fixed Cinema 2.0 world camera, engine lighting, depth-writing materials and the inherited production post-processing graph.

The preset is registered as `drmvyz.cinema2.hypnotize` and renders through the first-party Cinema 2.0 production runtime. The six pattern names and later-phase controls are present for continuity with the approved specification, but their full dynamic behavior remains explicitly deferred to Phase C. The exterior resonators are the only approved pre-Phase-C reactive exception and consume the shared `audio.features.overallEnergy` and `audio.bands.bass` lanes rather than local analysis.

### Phase B production captures

All captures are actual 1920 × 1080 frames from the production Cinema 2.0 runtime:

- `artifacts/cinema2-hypnotize-phase-b/frontal-hero.png`
- `artifacts/cinema2-hypnotize-phase-b/three-quarter-reveal.png`
- `artifacts/cinema2-hypnotize-phase-b/recursive-depth.png`
- `artifacts/cinema2-hypnotize-phase-b/default-lighting-materials.png`
- `artifacts/cinema2-hypnotize-phase-b/exterior-resonators-quiet.png`
- `artifacts/cinema2-hypnotize-phase-b/exterior-resonators-peak.png`

Phase B received owner approval before the Phase C implementation began.

## 16. Phase C choreography record

**Implemented:** 2026-10-13

Phase C preserves the approved optical-engine composition and adds authored motion through the shared Cinema 2.0 timing, Audio Intelligence, Visual Director, choreography, camera and effect systems.

- Six deterministic crossfading programs are live: Mesmeric Orbit, Black Iris, Turbine Bloom, Chromatic Relay, Infinite Draw and Radiant Collapse.
- Turbine, conductors, membrane, depth collars, core, spectral halo and the sixteen-unit exterior perimeter receive separate pattern relationships and bounded musical responses.
- Continuous energy, bass, low-mid, mid, high, spectral flux and vocal presence affect geometry, motion, density and emission rather than one global brightness value.
- Beat, kick, snare, downbeat, bar, phrase, section and drop events use compiled choreography envelopes.
- Visual Director intensity, momentum, build and impact provide bounded macro modulation and Auto Performance selection context.
- BPM Sync drives the shared pattern and camera clock; free-running mode keeps the same authored relationships without a local BPM detector.
- Pattern Change uses the canonical Trigger selection and deterministic reset-safe advancement. Manual Pattern or Pattern Change edits disable Auto Performance.
- Full, Reduced and Lock Off camera safety remain hard bounds. Travel scales camera drift, tempo motion and authored shaft movement.
- Flash Accents is a hard authorization for Radiant Collapse dim/discharge behavior; Off prevents blackout flashes.

### Phase C production captures

All captures are actual 1920 × 1080 frames from the production Cinema 2.0 runtime. The six pattern frames share the same musical timestamp and fixture values so their differences come from authored choreography:

- `artifacts/cinema2-hypnotize-phase-c/pattern-mesmeric-orbit.png`
- `artifacts/cinema2-hypnotize-phase-c/pattern-black-iris.png`
- `artifacts/cinema2-hypnotize-phase-c/pattern-turbine-bloom.png`
- `artifacts/cinema2-hypnotize-phase-c/pattern-chromatic-relay.png`
- `artifacts/cinema2-hypnotize-phase-c/pattern-infinite-draw.png`
- `artifacts/cinema2-hypnotize-phase-c/pattern-radiant-collapse.png`
- `artifacts/cinema2-hypnotize-phase-c/reactivity-quiet.png`
- `artifacts/cinema2-hypnotize-phase-c/reactivity-groove.png`

The automated capture gate requires six unique pattern hashes and distinct matched-time quiet/groove frames. Human approval remains required for motion quality and musicality.

### Phase C LED choreography correction

The first Phase C review identified insufficient LED output and choreography that emphasized mechanical motion more than the light system. The corrected implementation makes the LEDs a primary authored performance layer:

- Every collar and exterior LED piece now has its own material and address instead of sharing one global cool, warm or spectrum material.
- Continuous collar rails are divided into three visibly separated LED segments.
- Mesmeric Orbit uses dual angular chases; Black Iris uses opposing shutter banks; Turbine Bloom sends radial light fronts through the chamber; Chromatic Relay hands illumination between individual segments; Infinite Draw traces a helical depth path; Radiant Collapse converges and discharges the full LED field.
- Kick, snare, downbeat, phrase, drop, high-frequency energy and spectral flux contribute to the per-segment light response.
- Stock LED Intensity and LED Bloom values were raised, the emitters use HDR output, and the bloom threshold was lowered so individual bars remain visibly luminous at both quiet and performance levels.

## 17. Phase D cinematic polish record

**Implemented:** 2026-10-14

Phase D preserves the approved architecture and choreography while refining the rendered construction and transition quality observed in the Phase C production frames.

- Every continuous collar LED bar now sits inside a separate machined channel housing, retaining readable three-piece segmentation under strong bloom.
- Exterior resonators gained front bezels and individual LED sockets so their luminous surfaces read as integrated hardware rather than floating emitters.
- Turbine vanes gained recessed inset panels and an additional machined bearing trim, improving surface hierarchy and specular depth without changing the eighteen-vane silhouette.
- The core gained a translucent faceted optical shell around the energy lens.
- Black-metal structure and supports now use differentiated clear-coated physical materials, supported by a restrained frontal fill and stronger environment reflections.
- LED pattern topology now crossfades with the pattern profile rather than switching abruptly at the beginning of a transition.
- Black Iris, Chromatic Relay and Radiant Collapse now use explicit per-segment power gates. Their authored 16-step constellation masks produce asymmetric individual hits, sparse stutters and irregular density bursts across collar and exterior LEDs on a sixteenth-note grid; audio intensity controls the powered segments without lifting the dark segments. The masks are deterministic and repeatable, not random left/right or paired alternation.
- The Effects control **Drop / Impact LED Gating** optionally limits those ON/OFF masks to an analyzed `drop` section or Visual Director impact authority of at least `0.95` (Major Impact). Outside those moments every segment remains powered while retaining its normal audio-reactive brightness; disabling the toggle preserves continuous mask choreography.
- The production acceptance harness now supports idle, steady, vocal, build and drop fixtures plus camera, palette, design-extreme and alternate-aspect checkpoints.

### Phase D production captures

The production capture set is generated by `scripts/cinema2-assets/capture-hypnotize-phase-d.mjs` under `artifacts/cinema2-hypnotize-phase-d/`. It covers idle, low energy, steady beat, high energy, vocal, build, drop, all six patterns, the impact-only LED gate at rest and during a DROP, frontal and three-quarter composition, an alternative palette, minimum and maximum architecture settings, square framing and portrait framing.

## 18. Final technical acceptance and regression record

**Completed:** 2026-10-14
**Human gate:** owner visual approval remains required

The final production-path pass contains 45 deterministic captures rendered through the actual Cinema 2.0 runtime at High quality. It verifies:

- distinct idle, low-energy, steady-beat, high-energy, vocal, build and drop states;
- six visually distinct authored choreography patterns;
- frame-to-frame authored motion and a visible BPM Sync On/Off timing difference;
- minimum/maximum Master Intensity, Ring Density and Chamber Radius behavior;
- independent visible changes for Background, Structure, Cool Energy, Warm Energy, Core Energy and Spectrum Edge palette roles;
- Auto Performance authority, Pattern Change trigger behavior and manual Pattern takeover;
- Drop / Impact LED Gating at rest and during a DROP;
- deterministic preset re-entry, frontal/three-quarter camera composition, alternative palette, architecture extremes, and 16:9, square and portrait framing;
- clean runtime disposal after every capture: zero active runtimes, animation frames and WebGL contexts, with the resource manager reporting disposed.

The focused Hypnotize test suite contains 10 passing tests, including shared BPM versus free-running timing, pause/seek reset behavior, saved-control round trips, manual takeover, pattern profiles, LED addressability and impact-only LED gating. The High-quality renderer reports an estimated GPU allocation of 5,026,028 bytes in this harness. This is a measured resource estimate, not an FPS claim; no frame-rate target is claimed without a dedicated target-machine performance run.

Focused visual inspection of the final production frames confirms the combined radial optical-engine identity, readable depth and hardware hierarchy, complete sixteen-resonator perimeter, differentiated exterior LED structures, bright segmented emitters, and visibly distinct gated/resting DROP states. Hypnotize is a new preset, so no legacy before/after parity capture applies.

The implementation, focused regression suite, documentation and production capture deliverables are complete. Per the Cinema 2.0 creation contract, the preset must not be called production-ready until the owner approves its composition, motion quality, visual weight, brightness, musicality and overall identity in the actual app.
