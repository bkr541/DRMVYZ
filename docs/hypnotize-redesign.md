# Hypnotize redesign

Status: **built** (revision 8 of `drmvyz.cinema2.hypnotize`). Chosen direction: the spiral ring tunnel, with the cyan and violet ("duo") palette. The six pattern names are unchanged.

## Why

Measured during the Nov 22 gig (render logs): Hypnotize ran at 53 fps at Low quality, with **18 ms of CPU per frame** (Depth 1.4 ms, Glassfall 2.3 ms) and 11 ms of GPU. Its scene was about 600 separate Three.js meshes (480 LED segments, each with its own material rewritten every frame), glossy PBR materials with clearcoat and transmission, about 8 lights with a shadow, and a 5-pass post chain inherited from Constellation (depth of field, feedback trails, haze, bloom, finish).

Visually it was a flat, face-on circular mandala in a wide frame: empty corners and sides, no perspective, and every colour glowing at the same weight, so it read as cheap. Depth and Glassfall fill the frame, have a vanishing point or tiled relief, a black base and one moment of light at a time.

## What it is now

A spiral tunnel: round black rings receding to a vanishing point, each turned a little more than the last (a fixed twist), with neighbouring rings turning against each other. Light strips on every ring, 40 long light lines running the length of the tunnel on its wall (the perspective lines that carry the eye to the corners), a hero ring every ninth ring that is brighter and whiter and lifts on a downbeat or a drop, and a glow at the far end. The tunnel scrolls toward the camera at a pace set by Travel, the tempo (with BPM Sync) and the energy of the music.

- **Patterns.** The six patterns (Mesmeric Orbit, Black Iris, Turbine Bloom, Chromatic Relay, Infinite Draw, Radiant Collapse) are the same programs as before: `resolveCinema2HypnotizeLedDrive` in `modules/hypnotize/Cinema2HypnotizePatternEngine.ts`, untouched. It addresses each strip by ring layer (the ring's identity modulo 8), sector (12) and segment (4); the tunnel uses the "collar" address family. Pattern, Pattern Change, Trigger and Auto Performance behave as before (Auto Performance lets the music choose Pattern Change and the Trigger; choosing a pattern turns it off).
- **Palette.** Black structure; Light (default cyan) and Accent Light (default violet) alternate by sector and ring; Core is the hot white a strongly driven strip, the hero ring and the far glow move toward.
- **Controls: 26** (was 37), the size of Depth's: Quality/Performance, Master Intensity, Music Reactivity, Auto Performance, BPM Sync, Motion Safety, Flash Accents; Pattern, Pattern Change, Trigger, Tunnel Width, Rotation Speed, Counter-Rotation, Travel, Pulse Depth, LED Intensity; Atmosphere, Bloom, Cinematic Finish, Drop Strength, Drop / Impact LED Gating; and five colours. Removed: Ring Density, Tunnel Depth, Core Size, Perspective Reveal, Vane Length, Warp Amount, Spectral Detail, Core Intensity, Trails, LED Bloom (now Bloom), Chromatic Split, Warm Energy.
- **Safety.** Flash Accents (Off keeps a quarter of the drop discharge, Reduced about half, Full all of it) and Drop Strength bound the bright drop moment; the Mood Conductor has no drop-time drives of its own; Motion Safety (Full, Reduced, Lock Off) scales the scroll, the rotation and the camera.

## How it is built

- `modules/hypnotize/Cinema2HypnotizeTunnel.ts`: the fixed layout (one array of about 5,400 instances, built once) and the per-frame animation: a handful of arrays the renderer uploads, computed on the CPU in about 0.1 ms. The 384 distinct strip addresses are computed once a frame (rings with the same layer share them), not once per strip.
- `modules/hypnotize/Cinema2HypnotizeRenderer.ts`: raw WebGL2 in the style of Depth: one static instance buffer, one small dynamic buffer of per-instance light, one shared box, two instanced draws (the lines and glow, then the visible rings), matte analytic shading, HDR strips above white for the bloom. Ring angle, depth, hero and vane flags are uniform arrays, so the scroll and the turning never touch the instance buffer.
- `modules/Cinema2HypnotizeNativeModule.ts`: the music logic (pattern engine, trigger, vocal restraint, Flash Accents) is unchanged in spirit; Three.js is no longer loaded. The scroll and the rotation of even and odd rings are accumulated, so a control moving never makes a ring jump.
- `presets/Cinema2HypnotizePreset.ts`: an authored manifest modelled on Depth's (it is no longer derived from Constellation): haze, bloom and finish only, an ambient and one point light, a static camera at the tunnel's mouth looking down it with a little drift and roll.
- Quality tiers draw 16 / 22 / 28 rings from the front.
- Revision 8: a saved Hypnotize state from the old design belongs to revision 7 and is dropped (the preset opens at its authored defaults). The preset ID is unchanged, so pads, cues and shows still point at it.
- The thumbnail `public/preset-artwork/drmvyz.cinema2.hypnotize.webp` is a frame of the new design.

## Measured

On an Apple M3 Pro through Metal at 1637x876 (`npm run test:e2e:hypnotize-budget`, needs a Vite server, `PLAYWRIGHT_BASE_URL=http://localhost:5174` if it listens on localhost only): the scene draw takes **0.5 to 1.4 ms** and the per-frame animation about **0.1 ms**, for all six patterns at idle, music and drop levels. The budget fails above 4 ms of draw or 0.5 ms of animation. That is the scene pass only; the three-pass finish (haze, bloom, finish) is the same one Depth uses, and Depth's whole pipeline measured about 4.6 ms of GPU in the gig logs. The old version measured 18 ms of CPU and 11 ms of GPU for the whole pipeline.

## Not verified

- A real cast and a full show with real music on the real GPU. It was checked in the real app pipeline in software-rendered Chromium (it renders, wide and near-square) and the renderer and animation on the real GPU, but not with audio playing: Cinema 2.0 holds still when nothing plays, so motion was verified by unit tests (scroll, rotation, ring continuity), not by eye.
- The full-pipeline GPU time on the real GPU (only the scene pass is in the budget check).

## Process notes

- Design prototype stills and the throwaway page that drew them: `docs/hypnotize-redesign/` and `src/test/browser/hypnotize-prototype.html` (`?dir=1|3&palette=cyan|duo&w=&h=`). A dial-lined tunnel (direction 3) was prototyped too; direction 1 was chosen.
- When a script drives the app harness while Vite serves a changed module, import the store from the exact URL the app loaded (`performance.getEntriesByType('resource')`), not a plain path: Vite adds a cache-busting query to changed modules and a plain import gets a second copy of the store.
