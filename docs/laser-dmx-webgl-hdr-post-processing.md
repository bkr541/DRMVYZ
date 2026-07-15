# LaserDMX WebGL HDR and Photographic Post-Processing

Patch 5 adds a LaserDMX-owned photographic light-response stage after the sharp beam and depth-aware atmosphere passes. It does not share mutable post-processing state with Cinematic Worlds, Shader Pads, or the Canvas2D fallback renderer.

## Render path

1. Rear sharp light, front sharp light, and the scaled atmosphere pass render into reusable offscreen targets.
2. Those passes composite into a full-resolution light target without clamping values to display white.
3. A quality-scaled bloom pyramid extracts only bright light, downsamples it, and applies a separable blur.
4. The final full-resolution pass combines the untouched sharp scene with bloom, thresholded glare, exposure washout, restrained chromatic optics, and ACES-fitted tone mapping.
5. The WebGL canvas is copied to the existing LaserDMX output canvas. Canvas2D remains the fallback path selected by the renderer boundary.

## HDR target selection

LaserDMX performs a small framebuffer renderability probe when its WebGL2 runtime is created or restored. The preferred target is `RGBA16F` with `HALF_FLOAT` storage when `EXT_color_buffer_float` is present and a test framebuffer reports complete. Linear filtering is used only when the float-linear capability is available. The runtime does not request `RGBA32F`.

If any required full scene target cannot remain floating point, the active frame uses an `RGBA8` lower-dynamic-range strategy. The frame still renders bloom and tone mapping with adjusted thresholds. The runtime exposes this through `LaserDmxWebGLDiagnostics` using `hdr-rgba16f` or `ldr-rgba8-fallback`; it does not display an intrusive warning.

## Bloom quality policy

Bloom is separated from sharp beam-core quality:

- Low: one reduced-resolution bloom level, minimal optics.
- Medium: two levels and standard tone mapping.
- High: three levels with source glare and thresholded chromatic optics.
- Ultra: four levels with a wider stable bloom hierarchy and additional glare detail.

Only the first downsample applies the soft-knee highlight threshold. Later levels downsample the already extracted bright signal. The original full-resolution scene is never blurred, so narrow beam cores remain crisp. Source apertures, white-hot cores, and additive intersections naturally cross the threshold before dim beam bodies.

## Exposure and flash response

Exposure is deterministic and driven only by the canonical scene frame, transport delta, energy, output glow, and scene transient events. It has bounded base, minimum, and maximum values. Strobe visibility uses the same deterministic transport-time phase rule as the lighting compiler. Blinders and visible strobe phases use a fast attack; their washout and exposure lift release over a controlled interval. Timing discontinuities reset the controller to base exposure, preventing seek or loop history from leaking into replay.

Blackout frames immediately target zero washout and a short recovery. Ordinary beat energy changes only make a small bounded adjustment, avoiding routine exposure pumping.

## Tone mapping and optics

The final pass uses an ACES-fitted curve followed by controlled saturation, restrained highlight desaturation, a tiny black clip, and display gamma. Colored beam bodies stay saturated while extreme centers approach pale color or white.

Glare is sampled only from highlights above a high luminance threshold. High and Ultra may add a tight horizontal streak and a small star component. Chromatic separation is radial, stable, near-subpixel, and independently thresholded above ordinary beam intensity. Spectral edging is weaker still and appears only during extreme highlights. Low and Medium disable chromatic separation. Edit mode sharply attenuates glare and chromatic optics so fixture interaction remains readable.

## Lifecycle and context restoration

All HDR, composite, bloom, blur, shader, buffer, and vertex-array resources belong to the LaserDMX WebGL runtime. Resize releases dimension-dependent targets. Reset clears post targets and exposure history. Context restoration reprobes HDR support, restores filtering policy, recreates shaders and buffers once, and lazily reallocates targets on the next frame. Disposal releases every named resource and makes later allocations terminal through the existing resource ledger.

## Patch 6 integration and Patch 7 boundary

Patch 6 inserts a bounded temporal target between the HDR scene composite and this bloom stack. Bloom receives the accumulated scanner positions, while the final post shader combines that history with the untouched full-resolution current scene so current cores stay crisp. Temporal targets use the same HDR capability strategy and lifecycle ownership as the Patch 5 post resources.

Scanner persistence, deterministic beam and haze instability, music-aware source modulation, and temporal reset rules are documented in [LaserDMX WebGL Temporal Optics](./laser-dmx-temporal-optics.md). Distinct moving-head lenses, LED cells, strobe tube geometry, blinder reflector behavior, PAR wash optics, and other fixture identities remain Patch 7 work.
