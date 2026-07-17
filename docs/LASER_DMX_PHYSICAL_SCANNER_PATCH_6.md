# LaserDMX Physical Scanner Correction, Patch 6 of 6

## Status

Patch 6 is the final physical-realism, validation, recovery, performance, and documentation pass for LaserDMX Show Director. It preserves the fixed front-center camera, black or transparent void, Music Intelligence, Shared Performance Core, Track Map, deterministic transport, Canvas2D fallback, adaptive quality, and clean Live/Capture presentation established by the preceding patches.

The production contract is now explicit: a normal single-aperture scanner has one instantaneous direct output. Perceived lines, circles, polygons, waves, fans, tunnels, corridors, and canopies are produced by ordered motion integrated over a virtual camera shutter. Additional simultaneous rays require explicit prism, diffraction, splitter, multi-emitter, or additional-aperture semantics.

## Final render path

The authoritative path is:

1. Show Director authoring and Performance Program actions resolve fixture intent at authoritative track time.
2. Native scanner settings, or the versioned legacy migration adapter, produce scanner heads and validated ordered paths.
3. The deterministic scanner solver applies point rate, velocity, acceleration, direction, phase, point dwell, corner dwell, shutter timing, and retrace blanking.
4. The solver emits one instantaneous base ray per scanner output plus bounded shutter exposure samples.
5. Explicit optical copies are applied after the base solve and receive a bounded share of source energy.
6. WebGL converts visible exposure topology into analytic laser segments. Blanked samples split continuity and never contribute radiance.
7. Laser-only temporal history, continuous depth, view-sensitive atmosphere, HDR accumulation, bloom, exposure, and tone mapping produce the final camera image.
8. Dedicated moving-head, wash/PAR, strobe, blinder, LED, haze, CO2, and video-surface render plans remain separate from laser scanner geometry.
9. Canvas2D consumes the compatibility scene without receiving duplicate scanner and legacy output for the same WebGL fixture.

The scanner solver is stateless with respect to prior frames. Seek, loop wrap, repeated sections, track changes, preset changes, renderer changes, and WebGL restoration reconstruct from authoritative time and deterministic identities rather than inheriting stale motion.

## Physical scanner invariants

`auditLaserDmxPhysicalRealism` evaluates the fully resolved scene frame consumed by the renderers. It rejects:

- more visible instantaneous rays than the declared direct and optical outputs;
- duplicate instantaneous output indices;
- more than one direct ray from a normal single-aperture scanner;
- blanked samples with nonzero intensity or exposure;
- invalid ordered paths;
- open looping paths that can retrace without blanking;
- simultaneous scanner and legacy laser output for the same fixture;
- direct plus optical-copy energy above unity;
- declared multiple apertures that collapse to one origin;
- non-finite or out-of-range resolved linear-light channels;
- CO2 sources that remain active after their bounded lifetime;
- editor overlay elements in Capture.

The final built-in audit resolves ten representative musical states for each of the twenty first-party Performance Shows and the seven canonical Rig Layout presets through their shared migration boundary. Dedicated malformed-scene tests prove that each invariant fails loudly rather than being accepted by a generic non-black-frame check.

## Ordered paths and exposure integration

### Path meaning

- Held beam: one point with dwell.
- Line and fan: ordered open sweeps, normally ping-pong or blanked loop traversal.
- Circle and arc: sequential perimeter traversal.
- Triangle and polygon: edge-ordered perimeter traversal, never projector-to-vertex spokes.
- Wave: progressively traversed curve, never radial spokes.
- Tunnel and corridor: coordinated fixture-local paths with independent deterministic phase and depth.
- Canopy and front-air rake: ordered aerial paths with explicit fixture roles.
- Disconnected islands: blanked travel separates visible components.

### Motion limits

Authored point rate is bounded by scanner maximum angular velocity and symmetric acceleration/deceleration. Corners cannot reverse direction instantaneously. Point dwell and corner dwell add exposure time without inventing additional outputs. Lower velocity receives greater exposure weight, while fast spans distribute the same bounded source energy over more path distance.

### Blanking

Blanking delay and retrace blanking remain part of the solver timeline. Blanked samples are retained only as zero-energy topology markers so the renderer can break segment continuity. They are counted in diagnostics and are never emitted as visible beam cores or haze energy.

## Laser optical model

Laser color is resolved in calibrated linear light before HDR accumulation. Exposure, additive intersections, bloom, and tone mapping create white-hot highlights. The renderer does not arbitrarily desaturate source colors or replace spectral optics with a fullscreen glitch.

Prism, line diffraction, grid diffraction, burst diffraction, splitters, multiple emitters, and multiple physical apertures are explicit output semantics. Direct and copied outputs share a unity-bounded energy budget. Multiple physical apertures carry distinct origins. Texture copies and nonessential prism facets are the first optical work removed under pressure; the direct hero scanner remains authoritative.

The analytic beam pass uses screen-space capsule coverage and continuous segment topology so thin diagonal cores do not become dotted or dashed. Laser-only temporal history is restrained and reset on timing discontinuity, renderer changes, track changes, preset changes, allocation rebuilds, and context restoration.

## Atmosphere and nonlaser fixture models

### View-sensitive haze

Haze combines source direction, camera direction, depth, density, wavelength response, and bounded volumetric sampling. It reveals light through space without becoming a narrow flat ribbon or a gray fullscreen wallpaper. Laser atmosphere and moving-head volumes remain distinguishable.

### Moving heads

Moving heads use a volumetric cone with zoom, iris, focus, frost, gobo projection, gobo rotation, and optional bounded prism outputs. They do not use the laser capsule shader and do not appear as marker strokes.

### Washes and PARs

Washes and PARs create broad bounded fields and color beds. They do not project thick laser lines. Their section role is environmental support, contrast, and illumination of atmosphere or CO2.

### Strobes and blinders

Strobes are short temporal pulses. Blinders are bounded impact sources with decay. Neither is rendered as a decorative projected line or left permanently visible.

### LEDs

LED bars and tubes are emissive fixtures with pixels, chases, and framing roles. They do not create fake laser beams.

### Haze and CO2

Haze sources are bounded atmosphere emitters. CO2 expands, ages, and decays according to a finite lifetime. Expired CO2 is a physical-audit failure.

### Video surfaces

Video surfaces remain emissive fallback planes. They cannot introduce a visible venue wall, floor, ceiling, truss, audience, or stage shell. The fixed front-center camera and void background remain authoritative.

## First-party authoring rules

1. Give every normal laser fixture one ordered path per physical scanner head.
2. Use explicit hardware semantics for simultaneous copies.
3. Keep direct plus copied optical energy at or below one.
4. Use blanked travel for disconnected path islands and open-loop retrace.
5. Use hero, support, texture, canopy, rake, corridor, tunnel, tension, diffraction, and accent roles deliberately.
6. Keep support fixtures subordinate to hero scanner structure.
7. Give intro, verse, build, pre-drop, Drop 1, breakdown, Drop 2, and outro distinct fixture recruitment and motion development.
8. Make Drop 2 evolve Drop 1 through path, depth, phase, fixture recruitment, optical treatment, or support choreography rather than only increasing brightness.
9. Keep editor handles, targets, paths, labels, and diagnostics out of Live and Capture.
10. Preserve deterministic seeds, section occurrence identity, and authoritative track time.

## Track Map and Performance Programs

Track Map and Performance Program scanner actions modify authored scanner settings at deterministic musical boundaries. They may select path, direction, phase, duration, scan rate, dwell, blanking, depth, and optical treatment without bypassing the scanner solver. Occurrence identity distinguishes repeated sections while preserving deterministic replay.

Preset, show, track, and renderer transitions clear temporal history and stale scanner diagnostics. Native scanner state is reconstructed from the newly active content. Legacy projects can be previewed, validated, and migrated without silently mutating saved data during load.

## Legacy compatibility boundary

Retained compatibility code is limited to:

- loading saved projects authored before native scanner paths;
- migration preview and explicit migration;
- Canvas2D rendering;
- production DMX/output paths that still consume compatibility fixture and target data.

For WebGL, a fixture with authoritative scanner exposure suppresses overlapping legacy laser beams. `validateLaserDmxWebGLLaserInputs` and the final physical audit fail duplicate fixture output. Built-in content is authored natively and does not depend on persistent target networks.

## Adaptive quality and deterministic degradation

Available tiers are Auto, Low, Medium, High, and Ultra. Auto uses capability limits, an exponential moving frame-time average, minimum sample windows, separate downshift and upshift thresholds, and cooldown hysteresis. It cannot oscillate every frame.

Quality may reduce, in order:

1. texture diffraction and other low-priority optical copies;
2. low-priority support fixtures;
3. secondary atmospheric detail and depth slices;
4. nonessential prism copies;
5. support exposure-sample density;
6. secondary moving-head, gobo, and CO2 detail;
7. hero scanner exposure density only as a last resort.

Quality never changes authoritative track time, scanner phase, path order, blanking, source identity, fixed camera, section choreography, or deterministic selection. Budget selection is stable and role-aware rather than random frame-to-frame removal. Sharp laser cores remain full-resolution where practical while atmosphere and secondary volumetrics scale first.

## Performance and lifecycle contract

The runtime reuses scanner, instance, LED, atmosphere, CO2, HDR, bloom, and temporal-history resources where possible. It clears or releases them on unmount, renderer change, context loss, quality rebuild, resize rebuild, engine switch, track switch, and preset switch.

Rendering is stopped or reduced when the surface is unmounted, hidden, inactive, switched to another engine, or using Canvas2D fallback. The WebGL visual runner uses a final-report sentinel and forcibly closes descendant browser processes after all assertions so test completion cannot leak workers, browser instances, X servers, or output handles.

`clearLaserInputDiagnostics` resets scanner exposure, scanner segment, legacy suppression, duplicate-input, and input-mode diagnostics whenever GPU resources or the runtime are reset. Stale scanner state cannot survive a renderer rebuild.

## WebGL recovery and Canvas2D fallback

Recovery distinguishes transient, session-stable, and permanent failures.

- Auto mode prefers WebGL2 when capability and allocation checks succeed.
- Missing WebGL2 or a user-forced Canvas2D mode is a permanent fallback and has no manual retry action.
- Transient initialization or allocation failures use bounded automatic retries and cooldown.
- Shader compilation and repeated context failures can expose manual retry after a one-second cooldown.
- Manual retry clears the prior failure state and rebuilds scanner, GPU, gobo, media, CO2, atmosphere, HDR, bloom, and temporal-history resources.
- Canvas2D remains active during retry and unsupported states.
- Successful initialization records the timestamp and preserves the accumulated context-loss count.

Diagnostics outside Capture expose active renderer, capability state, selected quality, atmosphere/depth quality, fixture and scanner counts, ordered paths, scanner points, visible and blanked segments, apertures, dwell, exposure samples, optical copies, migration status, CPU/GPU timing, HDR/depth/history state, context losses, failure classification, retry count, next retry, manual retry availability, last successful initialization, and fallback reason. Capture remains clean.

## Reference-based WebGL validation

The required manifest contains 44 named physical references:

- 19 laser scenes;
- 17 nonlaser scenes;
- 8 musical-section scenes.

The browser harness currently renders 49 deterministic Capture frames so some frames cover more than one reference. Required laser coverage includes held beam, line sweep, sequential circle and arc, perimeter triangle and polygon, progressive wave, fan and mirrored fan, tunnel, corridor, canopy, rake, prism, line/grid/burst diffraction, multiple heads, and multiple apertures. Nonlaser coverage includes moving-head cone, zoom, iris, frost, focus, gobo and rotation, moving-head prism, wash, PAR, strobe, blinder, LED tube, LED chase, haze, CO2, and video fallback. Musical coverage spans intro through outro.

Every frame combines:

- perceptual PNG output for human review;
- lit-pixel and black-floor ratios;
- highlight and washed-bright ratios;
- haze occupancy and core-to-envelope ratios;
- source-aperture brightness;
- path continuity and scanner progression;
- blanking, radial-spoke, and target-network-cage checks;
- expected symmetry checks;
- saturation and linear-light energy checks;
- CO2 lifetime and fixture-role signatures;
- editor-overlay absence;
- production WebGL diagnostics;
- Canvas2D fallback detection.

A frame does not pass merely because a few pixels rendered. The deterministic metric envelope requires a substantial connected light structure while preserving a predominantly black frame and bounded highlights.

### Result classes

- **Passed:** WebGL2 ran, all required references were covered, every physical and perceptual assertion passed, and the final report was published.
- **Failed:** WebGL2 ran but any assertion, coverage requirement, physical invariant, renderer diagnostic, or process watchdog failed.
- **Supported platform skip:** WebGL2 cannot run in the test environment and the caller explicitly enabled the supported skip policy. The reason must be recorded. Skips are never rewritten as passes.

### Running the suite

```bash
npm run test:laser-dmx:physical
npm run visual:show-director:webgl
npm run verify:laser-dmx:physical
```

On Linux without a display, the runner starts a private Xvfb display when available. Headless software WebGL can be requested with `DRMVYZ_WEBGL_HEADLESS=1`, but environments that do not expose WebGL2 must fail or produce an explicitly enabled supported-platform skip.

### Approved baseline updates

1. Run the WebGL visual suite on a supported WebGL2 environment.
2. Confirm `report.json` is `pass`, has no missing reference IDs, and lists no failed frames.
3. Inspect all generated PNGs, especially thin diagonal cores, blanked retraces, diffraction energy, haze fields, fixture-role distinction, and Capture cleanliness.
4. Compare against the previously approved images using the repository's perceptual review workflow.
5. Explain every intentional visual change in the pull request or patch report.
6. Update committed baselines only when repository convention requires them. Do not commit `.runtime`, test results, browser reports, temporary screenshots, or profiling dumps.
7. Rerun the complete physical suite after any approved baseline change.

## Extending the system

### Adding a scanner pattern

- Add a native ordered-path generator rather than a new simultaneous target network.
- Define open/closed behavior, repeat mode, interpolation, blanked travel, and physical depth.
- Prove low-rate progression, high-rate integration, dwell, velocity/acceleration, seek, loop, and duplicate-output invariants.
- Add a named reference-scene ID and at least one browser frame when the pattern introduces a new visual vocabulary.

### Adding a fixture type

- Give it a dedicated render and production role.
- Do not route it through the universal laser or ribbon shader.
- Define lifecycle, energy, depth, atmosphere interaction, adaptive-quality priority, diagnostics, fallback behavior, and cleanup.
- Add unit, scene-frame, browser, Capture-cleanliness, and role-distinction coverage.

## Known limits

- Perceptual PNG baselines remain GPU- and driver-sensitive, so deterministic metric envelopes are the automated cross-platform gate and images remain approval artifacts.
- GPU frame timing is reported only when the browser and extension path expose a reliable timer.
- Context-loss restoration is tested when `WEBGL_lose_context` is available; otherwise the report records a supported extension skip rather than silently passing that subcheck.
- Canvas2D preserves continuity and compatibility but does not reproduce the complete HDR, volumetric, diffraction, or moving-head WebGL model.
- Production visual acceptance on representative real hardware remains required after automated validation.
