# Cinema 2.0 “Depth” tunnel preset

## Overview

“Depth” is a Cinema 2.0 keeper preset inspired by `/Users/kodyrobinson/Downloads/DEPTH_inspiration.mov`. The preset will create an original, procedural square tunnel made from repeated dark portal frames and independently animated emissive light strips. A moving perspective camera, deep black materials, restrained haze, depth of field, HDR bloom and cinematic finishing will produce the sense of scale and continuous travel seen in the reference.

The reference is a 15.3-second, approximately square video. Its defining visual behavior is:

- nested square portals receding toward a strong central vanishing point;
- cool-white illuminated bars switching between complete frames, individual sides and depth-based chases;
- dark structural panels and corner joints that become visible primarily through reflected light and haze;
- forward/backward apparent travel, lateral camera displacement, target drift, FOV changes and axial roll;
- near frames periodically growing beyond the image boundary while distant frames remain readable;
- a dim circular object or light at the far end of the tunnel;
- soft bloom, vignette, focus falloff and low-density atmosphere that preserve the black field while giving the lights volume.

The goal is to reproduce those principles without copying the source geometry or exact animation. The preset should feel like an endless, music-reactive light structure rather than a prerecorded recreation.

## Feasibility

The preset is feasible in the current Cinema 2.0 architecture. Existing systems already provide:

- WebGL2 native modules and engine-owned color/depth targets;
- instanced procedural geometry;
- looping `fly` camera rigs with repeating world offsets;
- camera position, target, FOV, roll, drift, banking and tempo-aware motion;
- module, camera and effect choreography targets;
- beat, downbeat, phrase, build and drop signals;
- HDR render targets and HDR bloom;
- depth-aware volumetric atmosphere and depth of field;
- temporal feedback trails and cinematic finishing;
- low/medium/high quality policy, resource accounting and deterministic disposal.

The work does not require a new renderer or an imported 3D model. It does require a dedicated native module because a static scene manifest cannot efficiently control every side of every repeated portal independently.

## Visual construction

### Portal unit

One portal unit will contain:

1. Four dark structural panels forming a square aperture.
2. Four thin emissive strips positioned along the inner edges.
3. Four dark corner nodes that visually connect the sides.
4. Optional short depth rails between adjacent portals.
5. A subtle additive halo around active strips to supplement screen-space bloom.

The unit will be repeated along the negative Z axis. The repeated geometry will use shared vertex/index buffers and instancing; each occurrence will carry only transform, side identity, ring index and light-state data.

### Tunnel

The tunnel will be centered around a configurable square aperture. Portal spacing and count will be selected by the quality profile. The camera and portal repetition will share a stable repeat distance so the camera can cross a lap boundary without a visible jump.

A small central sphere or disc will sit near the vanishing point. It will be optional, dimmer than the strips and independently controllable.

### Materials and light

The structural material will be nearly black with a cool, low-level specular response. The strips will render above display white into an HDR target so bloom is driven by real luminance rather than by blurring the entire frame.

Emissive geometry does not provide automatic global illumination. Nearby light spill will therefore be created deliberately with:

- a panel-shader contribution based on neighboring strip intensity;
- soft additive halo geometry around each strip;
- a low ambient fill that reveals only the closest structure;
- restrained atmosphere and bloom.

This approach is predictable, inexpensive and visually closer to the stylized reference than a large collection of real-time shadow-casting lights.

## Proposed architecture

```text
Inspector controls + audio/director signals
                    │
                    ▼
          depth-native module
          ├─ repeating portal layout
          ├─ deterministic light programs
          ├─ per-ring/per-side intensities
          ├─ center-object state
          └─ quality-aware instance budget
                    │
                    ▼
        instanced WebGL2 tunnel renderer
                    │
        Cinema 2.0 camera + depth target
                    │
                    ▼
 scene → atmosphere → depth of field → trails → HDR bloom → finish
```

### Planned implementation files

- `src/components/vyzualz/cinema2/modules/Cinema2DepthNativeModule.ts` — lifecycle, parameters, clock, diagnostics and render provider.
- `src/components/vyzualz/cinema2/modules/depth/Cinema2DepthLayout.ts` — portal geometry layout, repeat distance and bounds.
- `src/components/vyzualz/cinema2/modules/depth/Cinema2DepthState.ts` — deterministic light programs and audio-reactive state.
- `src/components/vyzualz/cinema2/modules/depth/Cinema2DepthRenderer.ts` — instanced portal, strip, node, rail, halo and center-object rendering.
- `src/components/vyzualz/cinema2/modules/depth/Cinema2DepthQuality.ts` — low/medium/high instance and effect budgets.
- `src/components/vyzualz/cinema2/presets/Cinema2DepthPreset.ts` — keeper manifest, controls, camera, choreography and render graph.
- Focused tests under `src/components/vyzualz/cinema2/__tests__/Cinema2Depth*.test.ts`.

No external GLB or third-party texture is required for the initial implementation. Any later noise texture must use the existing Cinema 2.0 texture asset registry and include provenance.

## Control model

The first production control set should remain expressive without exposing implementation details.

### Master controls

- **Intensity** — overall light and performance authority.
- **Auto Performance** — enables music/director-driven accents.
- **BPM Sync** — locks light sequencing and camera flight rate to the track tempo.
- **Motion Safety** — Full, Reduced or Lock Off.

### Structure

- **Aperture** — width and height of the square opening.
- **Portal Spacing** — distance between repeated frames.
- **Frame Thickness** — mass of the dark structural sides.
- **Depth Rails** — amount of visible connecting structure.
- **Center Object** — visibility, size and matte-gray tone of the vanishing-point sphere.

The visible portal count will be quality-owned rather than user-authored, preventing controls from exceeding performance budgets.

### Light program

- **Program** — Depth Chase, Side Orbit, Gate Pulse, Alternating Frames or Full Pulse.
- **Direction** — Inward, Outward, Forward, Reverse or Alternate.
- **Rate** — sequence rate when BPM Sync is disabled and a multiplier when enabled.
- **Active Span** — number of neighboring portals illuminated together.
- **Light Color** — cool white by default, with full color authority.
- **Strip Intensity** — HDR brightness.
- **Spill** — structural illumination around active strips.
- **Random Seed** — deterministic pattern variation.

### Camera

- **Travel Speed** — fly-path speed authority.
- **Camera Motion** — scales lateral movement, target drift, roll and FOV breathing.
- **Roll** — axial rotation amount.
- **Perspective** — FOV authority.
- **Camera Lock** — disables travel and secondary motion for reduced-motion use.

Cinema 2.0 currently clamps the shared camera roll target to ±45 degrees. This is sufficient for the primary reference behavior. If visual acceptance requires a larger apparent barrel roll, the module will rotate the tunnel root around its Z axis instead of expanding the global camera safety range.

### Atmosphere and finish

- **Atmosphere** — depth-aware haze mix.
- **Focus** — depth-of-field mix.
- **Trails** — restrained temporal persistence, defaulting near zero.
- **Bloom** — HDR bloom intensity.
- **Finish** — cinematic tone curve, contrast, vignette and grain.
- **Background** — near-black environment color.

## Audio and director choreography

The base animation will always work without audio. Music intelligence will add bounded accents through ordinary Cinema 2.0 targets:

- **Beat:** emphasize the currently active bars without lighting dark segments.
- **Downbeat:** add one selected architectural bar and a restrained bloom pulse.
- **Phrase:** add brief related-side articulation at a safe boundary.
- **Build:** increase light travel speed and active-bar brightness with only a tightly bounded haze lift and camera approach.
- **Drop:** add one deterministic accent bar, briefly accelerate the chase and push the camera/FOV.
- **Breakdown:** reduce portal density and hold a small distant light around the vanishing point.

User-authored zero values remain authoritative. Auto Performance must not re-enable camera movement, trails or other effects that the user has explicitly locked off.

## Motion and loop design

The animation will be derived from absolute time, portal index, side index and a deterministic seed. No transforms or light values will accumulate frame to frame.

The camera will use a looping Cinema 2.0 `fly` rig with `repeatOffset` matching the tunnel lap length. The tunnel layout will repeat across the same boundary. Acceptance requires no visible portal pop, light-pattern discontinuity or camera jump at the loop point.

Reduced Motion will retain slow light changes and shallow perspective drift while limiting travel, roll and FOV modulation. Lock Off will hold the camera and tunnel exactly while allowing manually selected static illumination.

## Quality and performance strategy

Initial quality targets:

| Quality | Visible portals | Atmosphere | Depth of field | Halos | Target |
| --- | ---: | --- | --- | --- | --- |
| Low | 10–12 | reduced steps | bypass | nearest portals only | integrated/mobile GPUs |
| Medium | 14–16 | medium steps | 12 samples | all active strips | default desktop |
| High | 18–22 | full steps | 20 samples | all active strips | high-end desktop |

The exact counts will be finalized from measurement rather than assumed. Geometry will be instanced and grouped by material so portal count does not create one draw call per object. Expensive shadow maps are not part of the initial visual design.

The module will expose the same production telemetry expected of current keeper presets:

- shader/prewarm duration;
- first-visible-frame duration;
- current, average and maximum draw time;
- instance counts and active portal count;
- estimated GPU bytes;
- stable performance diagnostics after a sufficient sample window.

## Procedural implementation plan

### Step 1 — static visual proof (implemented)

Implementation status (October 4, 2026): the `Depth` keeper and `depth-native@1` module now use eight substantial gates spaced six units apart across a 48-unit repeating lap. Frames, strips and rails share one instanced box batch; rounded corner joints and the matte gray focal sphere share a low-poly sphere mesh in a second instanced batch. Three geometry laps preserve uninterrupted forward travel while the camera, layout and renderer recentering all derive from the same repeat configuration. Depth, `rgba16f` targets with `rgba8` fallback, restrained atmosphere, HDR bloom and cinematic finish remain in place. Focused layout, registration, compilation, effect-contract and resource-lifecycle coverage passes. Final visual judgment remains part of Step 5.

Goal: prove the portal geometry, depth composition and HDR light treatment before building the full animation system.

1. Register `depth-native@1` and add the `Depth` keeper manifest.
2. Build a fixed procedural tunnel with at least eight repeated portal units.
3. Render dark panels, corner nodes, rails and cool-white HDR strips into a color/depth target.
4. Add a fixed perspective camera aimed through the tunnel.
5. Add subtle atmosphere, HDR bloom and cinematic finish.
6. Verify correct depth, framing, HDR fallback and deterministic resource disposal.

Step 1 acceptance: the still image must immediately read as a deep illuminated square tunnel, with dark structure visible through spill rather than flat ambient lighting.

### Step 2 — light programs and user controls (implemented)

Implementation status (October 4, 2026): every portal-side strip is independently addressed from absolute transport time, program, direction, rate, active span and seed. Sparse Architecture is now the Depth default: four staggered light tracks remain distributed through the shaft, crossfade one at a time, and occasionally form an L or opposite-side relationship. Inactive strips remain at zero emission, and spill follows the matching frame side/corner instead of lifting an entire portal. Builds accelerate and brighten the sparse pattern without activating dark bars; drops add one deterministic bar and briefly lift active-bar brightness. Depth Chase, Side Orbit, Gate Pulse, Alternating Frames and Full Pulse remain available as alternate styles. The optional center sphere retains visibility, size and matte-tone controls. Animated emission and spill values update one reusable instance buffer, and the tunnel remains two instanced geometry draws regardless of portal count.

1. Add per-ring/per-side light state to the renderer.
2. Implement Sparse Architecture, Depth Chase, Side Orbit, Gate Pulse, Alternating Frames and Full Pulse.
3. Add direction, rate, active span, color, intensity, spill and seed controls.
4. Add the optional center object and its controls.
5. Guarantee deterministic output for identical time, seed and settings.
6. Test program boundaries, direction reversal, HDR values and control consumers.

Step 2 acceptance: every side of every visible portal can be addressed independently without increasing draw calls linearly with portal count.

### Step 3 — camera movement and music choreography (implemented)

Implementation status (October 4, 2026): the camera uses a constant-speed 14-second, 48-unit repeating spline authored as a deliberate corkscrew through all four tunnel quadrants. Camera positions approach the structure while independent look targets aim across, above and below the shaft, exposing walls, frame depth, rails and rounded joints instead of preserving concentric squares. Optional path-point roll was added to the shared camera API; Depth interpolates from roughly -29 to +38 degrees and closes with matching position, target and roll at the lap boundary. Three structural laps remain in two instanced geometry batches, while the matte focal sphere stays a fixed distance ahead. Full, Reduced and Lock Off scale path travel, secondary motion and camera choreography together. Optional beat, downbeat, phrase, build and drop rules add bounded accents without defining the base movement.

1. Replace the proof camera with a looping fly rig and matching repeat offset.
2. Add camera travel, lateral sway, target drift, FOV breathing and bounded roll.
3. Add Full, Reduced and Lock Off motion-safety modes.
4. Connect beat, downbeat, phrase, build and drop signals to module, camera and effect targets.
5. Add tunnel-root rotation only if visual testing needs more apparent roll than the shared camera permits.
6. Test seamless looping, user-authority lockoffs and behavior with missing audio capabilities.

Step 3 acceptance: the camera can repeatedly pass through the structure without a seam, and audio accents remain bounded and optional.

### Step 4 — production effects and quality tiers

Finishing status (October 4, 2026): the Depth-local HDR source gain has been reduced from 8× to 2.75×, with a higher bloom threshold, four-level narrow halo, lower bloom intensity/spread and a finite HDR clamp. Atmosphere density, beam energy, ambient haze, noise, ambient/point-light contribution and audio-driven lifts are now deliberately restrained. Local spill is lower while the neutral body material is slightly more readable, preserving very-dark structural context against a near-black background. The finish uses modestly reduced exposure, stronger contrast and vignette, and subtler grain/aberration. Remaining Step 4 work concerns quality-tier budgets, depth of field/trails, prewarming and diagnostics rather than the core look.

1. Finalize the render graph: scene → atmosphere → depth of field → trails → HDR bloom → finish.
2. Route original scene depth to every depth-aware effect.
3. Add low/medium/high portal, halo, atmosphere and focus budgets.
4. Add offscreen shader prewarming and context-restoration coverage.
5. Add performance, memory, unavailable-capability and WebGL failure diagnostics.
6. Verify feedback history resets on seek, pause, source replacement and preset switching.

Step 4 acceptance: every tier preserves the composition, low quality degrades gracefully, and switching presets or restoring WebGL leaves no resources or history behind.

### Step 5 — visual acceptance and production tuning

1. Capture deterministic checkpoints for full frame, single-side chase, near-frame passage, vanishing-point hold and maximum roll.
2. Compare wide, square and portrait Stage framing.
3. Tune portal scale, spacing, camera speed, focus distance, haze, light spill, bloom threshold and finish against the reference principles.
4. Measure representative hardware and perform repeated preset-switch and long-running loop tests.
5. Confirm the preset remains legible with user colors and does not collapse into clipped white frames or featureless black.
6. Record screenshots, performance measurements and known limitations as release evidence.

Step 5 acceptance: the result has the reference’s perceived depth, lighting rhythm and camera energy while remaining original, controllable and stable in Cinema 2.0.

## Testing requirements

Focused automated coverage will include:

- portal transforms, repeat distance and bounds;
- deterministic light programs and seed behavior;
- independent side addressing and direction changes;
- seamless loop state at the beginning/end of a lap;
- reduced-motion and complete camera lock-off behavior;
- audio capability fallbacks and user-authority rules;
- manifest authoring conventions and native compilation;
- render-graph color/depth wiring;
- quality budgets and stable visual checkpoints;
- shader compilation, GL error handling and resource disposal;
- context loss/restoration and temporal-history reset behavior.

Expected verification commands will be added as the test files are created. At minimum they will include the focused Depth tests, keeper framework tests, ESLint, targeted TypeScript diagnostics and a direct Vite production build.

## Risks and mitigations

- **Black geometry becomes unreadable:** use bounded spill, halos and near-camera fill rather than lifting the entire background.
- **Bloom erases strip shape:** use an HDR threshold and retain a sharp emissive core beneath the bloom contribution.
- **Deep tunnel causes Z precision artifacts:** keep the near plane reasonably far, cap visible depth and repeat geometry around the active camera lap.
- **Loop seam becomes visible:** derive camera, geometry and light phase from the same repeat distance and absolute clock.
- **Volumetrics dominate performance:** scale ray-march steps by quality and preserve a bloom-only low-tier fallback.
- **Camera roll causes discomfort:** provide Reduced and Lock Off modes and keep Auto Performance subordinate to user authority.
- **Temporal trails smear pauses or seeks:** use transport-aware feedback and reset history through the existing engine lifecycle.

## Definition of done

The preset is complete when:

1. It is available as a first-party Cinema 2.0 keeper named `Depth`.
2. The tunnel is procedural, depth-correct and seamless across camera laps.
3. Every portal side can participate in deterministic light programs.
4. The camera reproduces the reference’s forward motion, off-axis framing, perspective breathing and roll with safety controls.
5. Music choreography is optional, bounded and respects all user lockoffs.
6. HDR bloom, atmosphere, focus and finish preserve bright light cores and deep blacks.
7. Low, medium and high quality tiers meet their measured budgets without changing the core composition.
8. Focused tests, lint, targeted type checks and the production bundle pass for the new code.
9. Visual checkpoints and representative-hardware measurements are recorded as release evidence.

The preset name is approved as `Depth`; implementation proceeds step by step against this plan.
