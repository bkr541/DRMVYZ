# LaserDMX Show Director rendering architecture

LaserDMX Show Director renders one deterministic lighting scene through either the production WebGL2 pipeline or the Canvas2D compatibility pipeline. Both paths consume the same authored fixtures, Music Intelligence timing, Track Map sections, Performance Program state, blackout authority, and beam-budget decisions. The renderer does not create a second choreography clock and does not alter a show's deterministic identity.

## Final runtime path

1. Track Map and Music Intelligence resolve the current section, beat, bar, phrase, occurrence, energy, and transient state.
2. The active Performance Program resolves a transient Show Director rig without mutating the saved source rig.
3. Show Director evaluates cues, fixture state, target motion, global output, fog, and blackout authority.
4. `LaserDmxSceneFrame` captures continuous fixture and target coordinates, inferred or explicit depth, optical primitives, fixture material data, and presentation settings.
5. The renderer boundary selects WebGL2 or Canvas2D using the saved renderer preference and current runtime capabilities.
6. WebGL2 renders sharp light, fixture-specific optics, volumetric atmosphere, temporal history, HDR accumulation, bloom, exposure, tone mapping, and the final composite.
7. Canvas2D compiles the same evaluated state through Beam Matrix for compatibility, thumbnails, and safe fallback output.
8. The completed frame is written to the existing LaserDMX output canvas. Editor overlays are separate React authoring surfaces and are never sampled into Live or Capture output.

The parent React canvas owns the only `requestAnimationFrame` loop. WebGL resources are private to the LaserDMX runtime and are released on unmount, engine switch, renderer replacement, or terminal failure.

## Visual invariants

The final renderer preserves these non-negotiable rules:

- The presentation camera is locked front-center and slightly elevated.
- Camera pan, orbit, roll, animation, presets, and user manipulation do not exist.
- No audience, room, wall, floor, ceiling, stage, truss, venue shell, or visible depth plane is generated.
- The background remains black except where authored light or illuminated atmosphere contributes energy.
- Primary beam cores remain sharp at full render resolution.
- White-hot centers are intensity gated rather than painted onto every beam.
- Projector apertures group rays by source so coherent banks have identifiable origins.
- Intersections brighten through additive energy accumulation.
- Haze is visible mainly where lighting reaches it and cannot become a full-frame gray texture.
- Bloom, glare, and chromatic separation are bounded and intensity gated.
- Temporal persistence is brief, movement aware, and cleared on discontinuities.
- Live and Capture presentation modes mount no editor overlays.

## Locked camera and invisible depth

`frontLocked` is the sole camera definition. It uses a fixed orthographic-depth projection with restrained vertical depth parallax, fixed centered/elevated pose, fixed clipping bounds, and no runtime motion. Existing authored X/Y compositions therefore remain visually recognizable while fixtures and targets can occupy continuous Z positions.

Depth is data, not geometry. The scene frame uses invisible air zones such as Camera-Facing Air, Front Air, Mid Air, Deep Air, Upper Air, and Lower Air. Explicit fixture or target depth takes precedence. Older two-dimensional shows receive deterministic inference from fixture kind, semantic role, target mode, and stable fixture identity. Crosses, mirrors, tunnels, cages, canopies, low rakes, and rear architecture therefore retain the same depth assignment after seeking, looping, or restarting.

The 15 × 10 Beam Matrix remains a compatibility, snapping, cue-evaluation, legacy-output, and Canvas2D layer. It is not the authoritative geometry for the WebGL path.

## Sharp beams and source apertures

Active beams are rendered as instanced camera-facing ribbons generated from continuous projected origins and targets. The material separates a soft preliminary envelope, saturated body, narrow pale core, and intensity-gated hot center. Width is expressed in CSS-pixel space and converted to backing pixels so device-pixel ratio and quality scaling do not inflate the visual design.

Beam material data includes source identity, fixture kind, divergence, scatter width, opacity, core energy, visual priority, deterministic phase, ray index/count, spacing curve, fan or bank structure, and shared source energy. Named primitives such as fans, sheets, banks, tunnels, canopies, cages, and geometric planes compile to deterministic ray sets. Partial beam-budget allocation preserves outer structure and central hero rays instead of truncating one side of a fan.

All rays from one fixture share one projector aperture. Apertures combine a tight center, saturated ring, soft halo, and restrained directional glare based on the fixture's total emitted energy. Additive targets allow same-color and mixed-color intersections to intensify naturally before tone mapping.

## Fixture-specific optical models

Fixture identity is preserved through dedicated materials and geometry:

- **Lasers** use narrow coherent ribbons, projector apertures, controlled divergence, scanner persistence, and coherent fan/bank primitives.
- **Moving heads** use lens apertures and bounded volumetric cones with focus, spread, rotation, and movement semantics.
- **Wash and PAR fixtures** use broader soft cones and localized color fields rather than laser-like lines.
- **Strobes** use short tube or bank geometry with transient-gated white energy and no long persistence.
- **Blinders** use warm reflector apertures and broad audience-facing bursts.
- **LED bars and tubes** use discrete cell emitters, strip glow, and fixture-aligned banks.
- **Haze fixtures** contribute invisible local density sources that become visible only under illumination.
- **CO2 fixtures** use short-lived localized plume volumes with bounded detail and dissipation.
- **Video-wall-like fixtures** use planar luminous surfaces and restrained spill rather than beam ribbons.

Adding a future material requires a fixture-kind mapping, bounded instance data, a fallback representation, quality scaling rules, and regression coverage. Adding a future primitive requires deterministic geometry, stable identity, priority-aware ray selection, and a Canvas2D-compatible simplification.

## Atmosphere

Atmosphere renders in a separate reduced-resolution graph while sharp light remains full resolution. Rear and front sharp-light targets are kept separate. Beam-aligned scattering uses deterministic layered noise, fixture-local haze density, continuous depth, and bounded sample counts. A sparse foreground veil can partially occlude rear light while preserving front beams and current sharp cores.

Empty regions remain black because atmosphere is emitted only around active light transport or localized illuminated sources. A small bounded baseline density keeps legacy shows readable, but global fog controls, haze fixtures, blackout, master dimmer, and resolved fixture brightness remain authoritative.

## Temporal optics

A bounded ping-pong history target sits after the current HDR scene composite and before bloom. Persistence depends on scanner movement, fixture role, pattern, musical state, and quality. Stationary beams remain clean. Current full-resolution light is composited over history so persistence cannot replace the sharp present frame.

Temporal state clears on initial mount, track or preset replacement, rig or Performance Show change, seek, loop wrap, timing discontinuity, quality change, target resize, blackout, capture entry, context restoration, unmount, and disposal. Deterministic instability and haze flutter use stable hashes and canonical audio time. They never use wall-clock randomness.

## HDR and photographic post-processing

The renderer prefers `RGBA16F` accumulation when supported and safely uses an `RGBA8` LDR path otherwise. The post graph performs controlled multi-scale bloom, exposure response, tone mapping, high-intensity glare, and restrained chromatic optics. Colored beam bodies remain saturated while only suitable highlights approach white. Exposure and bloom thresholds preserve black negative space in dim scenes and allow high-energy sections to feel materially larger.

The post path is private to LaserDMX. It does not share mutable targets or exposure state with Cinematic Worlds, Shader Pads, or Canvas2D.

## Quality modes

User-facing quality modes are **Auto**, **Low**, **Medium**, **High**, and **Ultra**.

Explicit levels remain fixed until the user changes them. Auto begins from a capability ceiling derived from HDR availability, maximum texture/renderbuffer sizes, and device-pixel ratio. It measures nonblocking GPU timing when `EXT_disjoint_timer_query_webgl2` is available and otherwise uses CPU render timing.

Auto adaptation is deliberately slow and bounded:

- An exponential moving average ignores invalid and extreme timing samples.
- Multiple slow evaluation windows are required before a downshift.
- More sustained headroom and a longer cooldown are required before an upshift.
- Allocation pressure may trigger one immediate downshift before fallback.
- Capability ceilings prevent an unsupported upshift.
- Atmosphere scales before hero beam geometry. Ultra keeps the atmosphere at High by default.

Quality may change volumetric resolution, haze samples, bloom levels, glare detail, temporal-history resolution, support-fixture ray density, CO2 detail, moving-head cone detail, and LED glow quality. It never changes camera state, musical counters, occurrence identity, authored targets, hero-beam priority, or deterministic seeking.

## Renderer selection and fallback

The renderer preference is persisted as **Auto**, **WebGL2**, or **Canvas2D**. The safe decision order is:

1. Canvas2D when explicitly selected.
2. WebGL2 when requested and successfully initialized.
3. Canvas2D when WebGL2 is unavailable.
4. Canvas2D during a temporary context loss, with WebGL restoration allowed.
5. Canvas2D locked for the current renderer session after repeated context loss.
6. Auto quality downshift after a GPU allocation failure, then Canvas2D if allocation still fails.
7. Canvas2D after shader compile/link failure or repeated runtime render failure.

A WebGL failure cannot blank the React view. The current evaluated scene is rendered immediately through Canvas2D. Terminal failures dispose GPU resources and stop repeated retry loops. Selecting Canvas2D explicitly clears the session failure latch so a later deliberate WebGL or Auto selection can retry initialization.

An unavailable float target is not a total renderer failure. WebGL remains active through the LDR post-processing path and diagnostics report the degraded target strategy.

## Lifecycle and performance rules

- The React live canvas is the sole animation-loop owner.
- LaserDMX holds the completed frame during pause and performs no independent clock advancement.
- Track replacement, preset replacement, seek, loop, and context restoration reset transient renderer state without mutating saved choreography.
- Engine switch and unmount dispose buffers, textures, framebuffers, programs, queries, history, and event listeners.
- Render targets resize only after the shared resolution policy reports a meaningful backing-size change.
- Instance buffers grow by capacity and use `bufferSubData` per frame rather than being recreated continuously.
- GPU timing permits only one nonblocking query in flight.
- Renderer diagnostics are throttled before reaching React state.
- Thumbnails remain on the compatibility path and never create their own animation loop or production-output side effects.

## Diagnostics

The existing Show Director control rail includes a collapsed **Renderer Diagnostics** section. It reports active/requested renderer, presentation mode, WebGL and float-target status, requested/effective quality, render and atmosphere resolutions, haze sample count, active/requested beams, active fixtures, CPU/GPU frame timing, HDR/LDR post state, bloom levels, temporal-history state, fallback reason, and context-loss count.

Diagnostics are ephemeral. They are never serialized into projects, presets, or preferences and are cleared when rendering pauses, clears, disposes, or switches away. The diagnostics surface is outside the visualizer canvas, so it cannot contaminate Live or Capture output.

## Persistence and compatibility

Persisted high-level settings include renderer preference, WebGL quality, atmosphere quality, render scale, presentation mode, and authored visual controls. Framebuffers, textures, buffers, shader programs, GPU queries, temporal-history contents, per-frame timings, and fallback counters are runtime-only.

Older saved shows continue to load through normalization. Missing scene, depth, camera, material, primitive, atmosphere, temporal, or post fields receive safe defaults. Existing fixture identifiers and Performance Program identities remain unchanged. Static source rigs are cloned before transient performance resolution, so loading or playing a show does not destructively migrate saved fixtures.

## Debugging WebGL failures

1. Open **Renderer Diagnostics** and record the active renderer, fallback reason, context-loss count, target format, quality, and internal resolutions.
2. Switch to Canvas2D to confirm choreography and authored state remain valid.
3. Reduce quality or select Auto when allocation pressure is reported.
4. Check browser or Electron GPU capability, WebGL2 availability, and `EXT_color_buffer_float` support.
5. Treat shader compile/link failures as code defects. Do not hide them by disabling tests or swallowing the diagnostic.
6. After repeated context loss, leave Canvas2D active for the session and investigate driver, memory, resize, or device-reset conditions before retrying.
7. Reproduce track switches, engine switches, seek, loop, resize, Capture entry, and context restoration because each owns a specific reset boundary.

## Beam-budget guidelines

The authoritative maximum remains bounded. Allocate in this order: hero impacts and primary architecture, structural secondary banks, texture and support fixtures, then decorative accents. Reduce atmosphere detail and low-priority ray density before deleting hero beams. Keep negative space intentional, use source-coherent primitives instead of random endpoint networks, and validate representative Intro, Verse, Build, Pre-drop, Drop 1, Breakdown, Drop 2, and Outro states.

The renderer is a virtual performance visualization. It does not model real-world optical power, audience scanning, venue exclusion zones, physical interlocks, regulatory compliance, or certified laser/DMX hardware output.
