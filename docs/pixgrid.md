# PixGrid

PixGrid is DRMVYZ's programmable LED-pixel React View engine. It renders authored artwork, prepared user media, sparse cell edits, smart-group reactions, Shared Performance choreography, and Track Map actions into one deterministic logical framebuffer. A WebGL2 presentation pass then displays each logical texel as a crisp LED cell with dark physical gaps. Canvas2D remains the bounded fallback.

## Supported MVP media

PixGrid accepts PNG, JPEG/JPG, static WebP, and SVG files selected through the existing Media Library. Media references and conversion settings are persisted; decoded pixels, object URLs, `ImageBitmap` objects, and GPU textures are transient and cleaned up by their owning cache or renderer.

Animated GIF, animated WebP, video, sprite-sheet slicing, and image sequences are intentionally deferred. Invalid, deleted, unavailable, or revised media is reported without corrupting the authored PixGrid state.

## Quality and output

| Tier | Logical matrix | Intended use |
| --- | ---: | --- |
| Draft | 64 × 36 | Explicit lightweight preview |
| Low | 96 × 54 | Minimum adaptive live resolution |
| High | 160 × 90 | Default production quality |
| Ultra | 256 × 144 | High-detail output on capable GPUs |

Adaptive mode is the default. It first reduces diagnostics, glow/diffusion work, and secondary presentation effects. Only sustained pressure can reduce the logical matrix, never below 96 × 54. Recovery is gradual and hysteresis prevents rapid quality oscillation. Selecting a quality tier explicitly switches to fixed mode. Thumbnail rendering has an independent renderer and does not influence live quality.

The logical framebuffer uses nearest sampling. The presentation shader preserves black/off texels, restrained glow, chromatic highlights, and dark cell gaps at 1080p and 4K. Recording and production output consume the same visible output canvas as normal React View playback.

## Built-in presets

- **Bass Beacon** centers readable BASS typography, rings, bursts, impact chevrons, and percussion reactions.
- **Geometric Reactor** develops tunnels, rings, diamonds, chevrons, orbit nodes, and geometric build/drop structure.
- **Pixel Parade** combines an original pixel mascot, stars, wave lanes, equalizer movement, and later-drop evolution.

All built-in artwork is generated from the typed PixGrid asset manifest. Preset layers, scenes, masks, animations, groups, and performance programs remain engine-specific even though musical context comes from shared infrastructure.

## Editor workflow

1. Select **PixGrid** in React View and choose a preset.
2. Open **Edit PixGrid** to activate the visualizer overlay. Normal playback keeps the center render-only.
3. Add or select scenes and layers, then position, scale, rotate, mask, animate, hide, or reorder them.
4. Use pencil, eraser, line, rectangle, fill, marquee, move, pan, zoom, and eyedropper tools for sparse cell overrides.
5. Use Undo/Redo for bounded authoring transactions. Close the overlay to restore normal playback focus and shortcuts.
6. Select compatible media from the Media Library, adjust fit, sampling, palette, dithering, alpha, and image controls, then add it to the composition.

The future dedicated Visual Manager is not part of this MVP.

## Smart groups and audio routing

Smart groups compile compact masks from manual selections, layer alpha, foreground/background, color or luminance ranges, connected regions, borders, centers, quadrants, bands, alternating rows or columns, checkerboards, diagonals, radial rings, deterministic clusters, and safe SVG metadata.

Each group can route existing Music Intelligence or Shared Performance signals to brightness, palette, color, opacity, scale, position, reveal, hide, blink, outline, sparkle, displacement, frame advance, animation speed, reverse, dissolve, invert, or posterize behavior. Kick, snare, hat, beat, bar, phrase, section, energy, bands, semantic moments, and other supported sources remain independently assignable. PixGrid does not create a duplicate audio-analysis engine.

## Full-song choreography

Each built-in preset has an authored PixGrid Performance Program resolved through the engine-neutral Shared Performance Core. Programs react to song sections, section occurrence, entry/body/exit phases, beat and percussion events, 4/8/16-bar development, phrase boundaries, energy, and semantic moments. The resolver reconstructs state from authoritative musical time, so seeking, looping, pause, track replacement, and repeated playback remain deterministic.

Manual locks and Track Map actions take precedence over lower-priority automatic choreography without invoking LaserDMX fixture, beam, or runtime state.

## Track Map actions

PixGrid actions live in the existing Track Map cue architecture and snap to the authoritative Beat Grid. They can select scenes, show or hide layers/groups, flash or dissolve groups, reveal rows/columns, change palette/background, start/stop/reverse/jump animations, transform targets, freeze, clear/restore, toggle automatic performance, and apply bounded manual overrides.

Transitions include cut, crossfade, palette fade, row/column/checker wipes, pixel dissolve, radial reveal, and power on/off. Transition buffers are transient. Cue replay reconstructs the correct state after seeks and loops; no second timeline is created.

## Brand Kit modes

Imported artwork supports Original, Hybrid, Preset, and Brand color modes. Brand strength, palette size, dithering, black preservation, white preservation, contrast, brightness, saturation, edge enhancement, and background handling can be adjusted without embedding converted image data in persisted state.

## Performance, memory, and recovery

- Scene, layer, group, reaction, override, history, cue, cache, mask, and active-action counts are bounded.
- Prepared media uses deterministic LRU eviction and revision-aware invalidation.
- SVG parsing, fetched media size, framebuffer dimensions, group-mask atlases, and transition allocation are guarded.
- Framebuffers are reallocated only when dimensions actually change.
- Render loops reuse typed arrays and do not create store subscriptions.
- Renderer disposal releases programs, textures, framebuffers, vertex arrays, masks, observers, animation frames, and retry timers.
- Temporary WebGL creation or render failures fall back safely and retry with bounded backoff rather than becoming sticky.
- Context loss/restoration, missing media, media revision changes, invalid SVG, corrupt persisted state, unsupported quality values, empty analysis, pause/stop, and failed transition allocation have explicit repair or fallback paths.

For best results, keep High/Adaptive selected for normal production, use Ultra only when the output GPU has headroom, keep imported artwork high-contrast, and avoid stacking many full-screen additive layers when a compact smart group can express the same reaction.

## Verification

PixGrid coverage includes state migration, normalization, media conversion, SVG lifecycle, smart groups, audio routing, performance choreography, Track Map actions, renderer ownership, WebGL shader/resource behavior, adaptive quality, deterministic logical framebuffer scenarios, and browser WebGL pixel readback. The pixel suite covers all three presets, imported raster/SVG content, Brand Kit conversion, percussion reactions, four-bar evolution, Track Map transitions, pause, and seek reconstruction.

## Deferred post-MVP features

- Video-to-pixel conversion
- Animated GIF/WebP import
- User sprite sheets
- Image sequences
- Dedicated Visual Manager
- Expanded built-in asset packs
