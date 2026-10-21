# 11. LIGHTFIELD effort, risks, scope and contingency decisions

## Complexity classification and why

**Low–medium relative to Cinema 2.0** is achievable only because LIGHTFIELD consists of uncomplicated primitive geometry, a bounded tile count and pure preset-specific patterns. It is **not** a two-file implementation: it still needs a manifest, registered native module, renderer, geometry packing, parameter bindings, shared trigger/clock/Director integration, full production-browser tests and visual approval.

The optional features excluded below are significant scope reducers. A floor with real reflections, physics, particle systems, complex architectural travel and hundreds of actual shadow-casting lights would be high-effort.

## Risk register

| Risk | Severity | Early signal | Mitigation / fallback | Gate |
|---|---|---|---|---|
| Geometry appears too flat or tiles too small | High | Idle screenshot indistinguishable from a 2D checkerboard | Adjust camera angle, thickness, gap, inset and silhouette; **not** bloom | P1–P2 |
| Six patterns are light-only aliases | Critical | Identical transform masks with changed color | Require six distinct per-tile Y/tilt fields and neutral-color filmstrips | P4 |
| Tile intersections / depth clipping | High | Maximum lift or 4×12 layout overlaps | Clamp tilt/lift by gap, test all aspect ratios and full parameter ranges | P2/P4 |
| Rebuild allocation overhead when grid count changes | Medium | Buffer allocation/churn on every frame | Change persistent buffer only on topology changes; cap 144 | P2/P7 |
| `BPM Sync` only scales speed but not beat phase | High | Animated motion drifts against downbeat | Use shared beat/grid for beat-locked motions, describe fallback accurately; test BPM/seek/loop | P0/P4 |
| Host Audio Dock Sync conflicts with preset BPM Sync | High | ON in Inspector has no output effect | Decide and prove `requireHostSync` composition explicitly; avoid misleading toggle | P0/P4 |
| Pattern edit immediately auto-jumps | Critical | Manual choice with Pattern Change ON gets undone by stale event | Generic controller, consume current event identity on edit/toggle/trigger changes | P4/P5 |
| Duplicate event source/action delivery | High | One kick causes multiple advances or excessive pulses | Stable event IDs, dedupe per source/trigger, once-per-frame update | P5 |
| Auto Performance fights user controls | Critical | Color/intensity/motion slider seems ineffective at drop | Authority matrix, hard OFFs, bounded return-to-base envelopes; no Auto Pattern in v1 | P6 |
| Five colors aliased or invisible | High | Two swatches drive same tiles or accent never appears | Independent shader channels/material masks and deterministic multi-color fixture | P3 |
| Bloom hides weak base geometry | High | Preset only looks good with bloom MAX | Demand bloom-OFF hero acceptance first | P2/P7 |
| Instancing / WebGL state leak | High | Failures on rapid preset switch or context restore | Host-owned buffers/programs, dispose, state preservation, GPU budget logs | P2/P7 |
| Audio reacts at wrong time or not at all | High | Visual drift, no difference in fixture comparisons | Bridge→target→module trace and production ROI timestamp checks | P5/P8 |
| Source changed since attached ZIP | Medium | Type/module function signature mismatch | Re-run P0 against checked-out branch, update file map honestly | P0 |
| Overengineering expands scope | Medium | Added reflections, physics or new React engine | Enforce v1 scope and phase stop gates, separate enhancements to future backlog | All |

## Explicitly out of scope for first ship

- TERRAFORM's dramatic high-rise blocks or full 3D terrain, separate sliding puzzle/image mosaic, Canopy ceiling rods, imported asset packs or Blender/GLBs.
- Full ray-traced/per-tile reflections, realtime shadowmaps from each tile, independent spotlight per tile, environmental city models, neon road or camera fly-through level.
- Rigid-body collisions, cloth/cables, procedural destruction, heavy postprocessing or special engine render targets beyond supported existing passes.
- New source-separation/detection, alternate BPM/drop/vocal algorithms, custom WebAudio analyzer, independent playback engine or bespoke Render/Audio scheduler.
- Modifying backend user preset ownership, general application settings or introducing Inspector/persistence special cases keyed to LIGHTFIELD.

## Future enhancements (separate plan/release)

- Subtle reflection probe or planar reflection **only after** budget validation.
- Additional >6 original pattern options with contract-compliant Trigger cycle and individual visual acceptance.
- Preset-specific multi-shot camera scenes with true shot-safe bounds and hard user control.
- Rich per-tile materials and optional texture variations, only if FPS and geometry legibility remain strong.

## Scope-change decision protocol

1. Identify the blocker at its P0–P9 phase and collect source/test/screenshot evidence.
2. Try a solution using existing shared APIs and current simplified geometry.
3. If the solution adds a new render engine, simulation, detector, heavy asset or >144 tiles, treat it as **scope expansion** and request product approval in the implementing engineering workflow.
4. Never trade away Pattern controls, 11 shared Triggers, four real Palette colors, audio reactivity, user authority or production browser proof to preserve schedule.
