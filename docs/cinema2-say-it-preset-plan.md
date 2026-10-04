# Cinema 2.0 “SAY IT” kinetic-type preset

## Overview

“SAY IT” is a Cinema 2.0 keeper preset for short, user-authored 3D type. Each visible character is a real bevelled mesh with an independent transform. Characters can travel and rotate through all three axes, including complete 360-degree turns, and then return to an exact typeset layout. The initial visual direction is polished chrome on a near-black background, informed by `/Downloads/Forged.mov` without copying its typography or animation.

The feature is feasible in the current Cinema 2.0 architecture. The existing engine already provides a native WebGL2 render graph, world-space scene nodes, final camera and lighting frames, depth targets, PBR rendering through the lazy Three.js bridge, beat-aware clocks, schema-driven controls, bloom, cinematic finishing, quality policy, asset budgets and deterministic resource disposal. The missing part is a runtime kinetic-type layer: the existing `object3d` text path compiles text as one static object, while the general `three-scene` module instantiates static GLB scenes and only provides shared turntable motion. Neither currently exposes per-character layout and transforms.

The implementation therefore uses a dedicated `say-it-native` module. It keeps Cinema 2.0 in control of camera, lighting, render targets, parameters and lifecycle, while using Three.js only to draw the glyph meshes into the engine-owned framebuffer.

## What the reference video establishes

The 17.32-second reference is a 1180 × 926, approximately 60 fps HEVC clip. Its useful visual principles are:

- thick, bevelled metallic glyphs with strong moving reflections;
- independent X, Y and Z rotation rather than a single flat text transform;
- temporary depth and lateral separation between letters;
- deliberate moments where all glyphs resolve into a precise readable line;
- a dark, uncluttered field that makes silhouette and specular motion carry the composition;
- highlight movement and bloom that make rotation readable even when a glyph is close to edge-on.

Those are behavioral and material references. “SAY IT” uses its own generated geometry, timing and control design. Production glyph outlines come from the OFL-licensed Anton Regular source font.

## Character and layout scope

“Every letter, number and special character” is defined here as the 95 printable Basic Latin characters, Unicode `U+0020` through `U+007E`:

- 26 uppercase letters;
- 26 lowercase letters;
- 10 digits;
- 32 printable punctuation/symbol characters;
- the space character.

This is a character repertoire, not the set of words in an English dictionary. Curly quotes, accented characters, emoji, non-Latin scripts and arbitrary Unicode are outside the first production scope. Unsupported input will use an explicit fallback glyph until a later repertoire is added.

The production preset supports one or two lines with authored limits: 12 characters per line and 20 total characters in two-line mode. Longer input is truncated with a module diagnostic; unsupported Unicode is replaced with `?`. Long assembled blocks are automatically scaled to a 5.4 × 3.45 world-unit frame.

## Architecture

```text
Inspector text + design controls
              │
              ▼
      say-it-native module
       ├─ sanitize + wrap
       ├─ glyph lookup
       ├─ kerning/layout
       ├─ deterministic per-glyph motion
       └─ material state
              │
              ▼
 versioned GLB glyph package ──► Three.js draw bridge
                                     │
 Cinema 2.0 camera, lights, depth ───┤
                                     ▼
                       engine-owned scene target
                                     │
                               bloom + finish
```

The glyph package is generated at build time and registered through the existing Cinema 2.0 asset manifest. Geometry and textures remain shared, while each visible glyph owns its transform and material instance. Motion is calculated from stable glyph indices and the Cinema 2.0 beat clock, so the same time and settings always produce the same frame. Assembly poses are authored values, not the result of accumulated physics, which guarantees exact reassembly and avoids drift.

## Current capabilities and constraints

The implementation can reuse:

- `Cinema2ModuleRegistry` for a versioned native module;
- `Cinema2ThreeAssetCache` for lazy, reference-counted GLB loading;
- the shared Three renderer and procedural studio environment;
- Cinema 2.0 camera and light mapping;
- depth-aware scene passes and transient render targets;
- schema bindings for Design controls;
- `Cinema2BeatClock` for optional BPM-paced motion;
- existing bloom and cinematic-finish effects;
- asset size, triangle and licensing checks.

The main constraints are:

- runtime text cannot be handled by the current static `object3d` compilation path;
- the general `three-scene` module does not expose per-mesh animation;
- a complete font converted to independent meshes can become expensive unless glyphs share geometry and the visible count is bounded;
- kerning, line breaks and punctuation metrics need a dedicated layout model;
- mirrored chrome depends on environment lighting and must retain a usable low-quality fallback;
- text edits must reuse decoded glyph geometry instead of rebuilding or uploading meshes every frame;
- bidirectional text, shaping and complex scripts require a separate future text-shaping project.

## Procedural implementation plan

### Step 1 — visual proof: fixed “SAY IT” composition (implemented)

Goal: prove the critical visual and architectural path before producing the full glyph library.

1. Generate an original GLB containing independently addressable bevelled meshes named `glyph-S`, `glyph-A`, `glyph-Y`, `glyph-I` and `glyph-T`.
2. Register the proof asset in the Cinema 2.0 asset pipeline with provenance and budget metadata.
3. Add `say-it-native@1`, loaded only when the preset is active.
4. Instance five independently transformed glyphs for the fixed phrase `SAY IT`.
5. Drive a deterministic cycle with assembled holds, staggered release, full three-axis rotations, depth separation and an exact final assembly.
6. Apply a PBR chrome material, moving environment reflection, key/rim/ambient lighting, bloom and cinematic finish.
7. Add the `SAY IT` keeper preset and schema controls for motion, BPM sync, cycle length, spread, roughness, reflection, highlight sweep, bloom, finish and palette.
8. Verify asset generation, authoring conventions, native compilation, module registration and motion invariants.

Step 1 deliberately does not expose editable text. Its acceptance criteria are five separate real 3D meshes, independently changing rotations, at least one full rotation during the excursion, a readable chrome result and exact authored transforms at the beginning and end of every cycle.

### Step 2 — production glyph package and editable one/two-line text (implemented)

1. Selected Anton Regular and vendored both the source TTF and its SIL Open Font License 1.1 text.
2. Built all 95 printable Basic Latin characters with consistent extrusion, bevel, centered local origins, winding and normals. Space is metrics-only; the other 94 code points are named GLB meshes.
3. Exported advance widths, visual bounds, local centers, line metrics and kerning pairs in the versioned generated metrics manifest.
4. Replaced the proof asset with `cinema2-say-it-glyphs` while preserving the `say-it-native` module boundary.
5. Added separate user-facing `Line 1` and `Line 2` single-line text inputs, newline/tab normalization, unsupported-character fallback and bounded truncation. `Line 2` is shown in two-line mode.
6. Added controls for one/two-line mode, alignment, tracking, line spacing and glyph scale. Character limits remain authored invariants rather than editable performance controls.
7. Layouts are centered from actual visual bounds, preserve space advances without allocating meshes and automatically fit the camera frame.
8. Repeated characters reuse shared decoded geometry; only lightweight roots and material instances are created per visible occurrence.
9. Empty input returns to `SAY IT`; unsupported characters use `?`; both truncation and replacement produce diagnostics.
10. Tests cover the complete repertoire, independent two-line input, one-line enforcement, repeated geometry, input limits, fallback, fit bounds and generalized exact-assembly motion.

Step 2's code path is complete when every printable Basic Latin input maps deterministically to a valid one- or two-line layout and repeated characters share geometry. Measured live-edit leak checks and low-tier frame-time acceptance remain part of Step 3 production hardening.

### Step 3 — production hardening and quality tiers (implemented)

1. Added explicit low/medium/high profiles. Every tier preserves the complete 20-glyph content budget; low and medium remove glyph shadows and soften/reduce reflections, while high retains the full chrome treatment.
2. Added a 2×2 offscreen prewarm pass. Each new glyph set or quality variant compiles its material/light shader and uploads active geometry one frame before it is presented.
3. Preserved graceful load, truncation and unsupported-character diagnostics, and added bounded GPU-memory, frame-time and future glyph-budget diagnostics.
4. Added inspectable library-load, asset-decode/acquire, prewarm, first-visible-frame, current/average/maximum draw-time, sample-count and estimated-GPU-byte telemetry. Frame warnings begin only after 30 samples.
5. Verified deterministic bridge disposal and asset release through the same module resource lease path used by preset switching and WebGL context retirement; Cinema 2.0 re-creates the module after context restoration.
6. Added stable assembled, maximum-separation and edge-on-rotation capture checkpoints for visual regression tooling.
7. Promoted the authored camera fit to shared constants and verified the maximum two-line block retains at least 15% framing margin in wide, square and portrait Stage shapes.

Representative-hardware timings and captured PNG artifacts remain environment-specific release evidence; the runtime now exposes the measurements and deterministic checkpoints needed to collect them without changing production behavior.

### Step 4 — expanded motion and effects

1. Add selectable motion programs such as flip, tumble, wave, scatter and hinge.
2. Add per-glyph delay, direction, axis weighting and deterministic random seed controls.
3. Add beat, downbeat, phrase, build and drop choreography through ordinary Cinema 2.0 targets.
4. Add optional camera motion, depth-of-field, trails and alternate material presets only after the base typography remains legible.
5. Keep an always-available exact-assembly interval and a reduced-motion/lock-off setting.

## Current implementation files

- `scripts/cinema2-assets/generate-say-it-glyphs.mjs` — production glyph and metrics generator.
- `scripts/cinema2-assets/sources/anton/Anton-Regular.ttf` and `OFL.txt` — licensed font source and canonical license; the license also ships at `public/cinema2/licenses/Anton-OFL-1.1.txt`.
- `assets/cinema2/cinema2-say-it-glyphs/asset.json` — production asset provenance and registration source.
- `public/cinema2/models/say-it-glyphs-v1.glb` — generated 94-mesh production model.
- `src/components/vyzualz/cinema2/modules/sayIt/Cinema2SayItGlyphMetrics.generated.json` — versioned metrics and kerning.
- `src/components/vyzualz/cinema2/modules/sayIt/Cinema2SayItTextLayout.ts` — sanitization, bounds, wrapping, alignment and automatic fit.
- `src/components/vyzualz/cinema2/modules/sayIt/Cinema2SayItMotion.ts` — deterministic independent glyph transforms.
- `src/components/vyzualz/cinema2/modules/sayIt/Cinema2SayItQuality.ts` — quality budgets, camera-fit constants and deterministic visual checkpoints.
- `src/components/vyzualz/cinema2/modules/sayIt/Cinema2SayItBridge.ts` — PBR mesh drawing into the Cinema 2.0 target.
- `src/components/vyzualz/cinema2/modules/Cinema2SayItNativeModule.ts` — asset, lifecycle, beat clock and parameter integration.
- `src/components/vyzualz/cinema2/presets/Cinema2SayItPreset.ts` — keeper manifest and render graph.

## Verification commands

```bash
node scripts/cinema2-assets/generate-say-it-glyphs.mjs
npm run assets:build
npm run assets:check
npx vitest run \
  src/components/vyzualz/cinema2/__tests__/Cinema2SayItMotion.test.ts \
  src/components/vyzualz/cinema2/__tests__/Cinema2SayItTextLayout.test.ts \
  src/components/vyzualz/cinema2/__tests__/Cinema2SayItModule.test.ts \
  src/components/vyzualz/cinema2/__tests__/Cinema2SayItQuality.test.ts \
  src/components/vyzualz/cinema2/__tests__/Cinema2SayItPreset.test.ts \
  src/components/vyzualz/cinema2/__tests__/Cinema2KeeperPresetFramework.test.ts
```

The repository-wide TypeScript check should also be run, but pre-existing failures elsewhere in the repository must be reported separately from “SAY IT” failures.
