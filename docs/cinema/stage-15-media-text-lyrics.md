# Cinema Stage 15: Media, Text, Lyrics, and Mask Sources

Stage 15 adds native Cinema graph sources for canonical DRMVYZ media and lyrics while preserving Cinema's single canvas, WebGL context, animation loop, render-target pool, and diagnostics owner.

## Production path

`ReactView` selects the `cinema` engine, `CinemaWorkspace` resolves the canonical Cinema composition and canonical media snapshots, `CinemaCanvas` gives those inputs to `CinemaRuntime`, and `CinemaGraphExecutor` creates the registered Stage 15 nodes. Nodes receive one normalized `CinemaFrameContext`, Cinema-owned render targets, stable asset bindings, and the runtime-only `CinemaAssetManager`.

## Stable node types

- `drmvyz.cinema.media.image`
- `drmvyz.cinema.media.video`
- `drmvyz.cinema.media.logo`
- `drmvyz.cinema.media.generic`
- `drmvyz.cinema.text.static`
- `drmvyz.cinema.lyrics.current`
- `drmvyz.cinema.mask.generated`

All definitions use stable IDs and schema-generated parameters. Image, logo, and media nodes consume canonical asset bindings for fit, crop, position, scale, rotation, opacity, and colorization. The video node synchronizes the existing media element to transport play, pause, seek, loop, discontinuity, and playback-rate state without requesting its own animation frame.

## Text and lyrics

Static text and timed lyrics share one offscreen Canvas2D raster service per Cinema WebGL context. Each node owns only its disposable GPU texture and program. The lyric node reads the current line and word from `CinemaFrameContext.lyrics`; it never polls the lyrics store. Gap behavior is explicit: hide, hold previous, or static fallback. Missing fonts use the system-font fallback and emit a structured diagnostic.

The normalized frame and modulation catalog expose lyric cue start/end, word change, line active/absent, density, and line duration. These values are runtime-only and do not mutate canonical authored state.

## Alpha and masks

Media and text render using premultiplied alpha. Text, lyrics, and generated masks request Cinema targets with a mask attachment. The graph executor publishes mask ports from the target's distinct R8 mask texture view while color ports continue to publish the RGBA color attachment.

## Lifecycle and compatibility

Decoded image/video elements, signed URLs, object URLs, the shared raster surface, textures, and framebuffers are runtime resources and are not persisted. Asset replacement, engine switching, context loss, and disposal release or reconstruct those resources through existing Cinema owners. No Cinema schema version is incremented because Stage 15 adds built-in definitions and runtime behavior without changing the persisted representation. Shader Pads, Cinematic Worlds, Sound Drawing, CANVAS, LaserDMX, and PixGrid remain unchanged.

## Stage 16 handoff

Stage 16 can consume the native color and mask outputs, transport-aware video lifecycle, and lyric content/control bridge. Stage 15 intentionally does not add general blend modes, effect chains, the Library/Inspector UI, or new font-upload support.
