# Afterhours — spatial beams and shared illuminated air

Scope agreed by the user on 2026-10-28: balanced realism, crisp laser cores,
visible shared haze, mostly dark surroundings. Preserve fixture coordinates,
pattern/cue programming, camera framing and existing controls.

The native renderer replaces screen-normalized, canvas-edge-extended ribbons
with perspective-projected, enclosed world-space beam volumes. Rasterizing
their exit faces covers illuminated end caps without triangular haze-sheet
boundaries. Authored targets remain scanner
aim points; light continues in that direction to a fixed world-space extent,
independent of the viewport. Beam radius includes restrained physical divergence
and antialiasing from signed-distance derivatives, avoiding dotted subpixel
shafts. Sources, nearby shafts and distant shafts therefore
have different apparent scale. The shared Camera Runtime remains authoritative.

Every active beam illuminates the same deterministic world-space density field.
Bounded view-ray integration accumulates that beam's contribution through the
medium, with directional scattering and extinction along the light/view paths.
Additive accumulation combines their contributions in the current engine-owned
scene target. A broad low-energy scattering lobe approximates local light spread;
this is a bounded single-scattering presentation with an artistic spread lobe,
not a full multiple-scattering or physically calibrated venue simulator.

| Property | Authority / consumer |
| --- | --- |
| Fixture positions, aim directions, timing, pattern choice | Existing rig, pattern engine, blanker and Choreography; unchanged |
| Camera and framing | Existing Camera Runtime and manifest; unchanged |
| Primary/accent color and Master Intensity | Existing resolved values multiply both shafts and scattering; master zero is a hard blackout |
| Atmosphere | Existing 0–1 control scales density, illuminated cloud and extinction; zero removes shared haze |
| Cloud motion | Existing pause-safe visual clock advects one world-space density field; no beam-local independent cloud phases |
| Quality | Shared lighting quality selects 8/12/16 integration samples; all tiers keep coherent air and perspective |
| Resources/depth | Existing native module lease, framebuffer, depth attachment and disposal; no new room geometry or detached camera |

Acceptance: production canvas at OFF/default/max Atmosphere, core visibility,
shared-cloud fill between shafts, camera-dependent thickness/parallax, sparse
and dense patterns, palette/master authority, pause/reset, aspect/quality and
resource disposal. Compare against the previous renderer and reference clip.

## Validation and review handoff

- 60 focused Afterhours tests passed across NativeRendering, Preset, Patterns
  and AudioDirectorChoreography. Existing screen-ribbon-specific assertions now
  check the world-camera projection and shared medium instead.
- 19 production-canvas checks passed: air outside the crisp cores, OFF/default/
  max Atmosphere, dark surroundings, master blackout, palette ownership, motion,
  pause, camera parallax, all quality tiers, square/landscape/portrait resize,
  music delivery, re-entry and disposal. No captured shader/WebGL/page errors.
- At default Atmosphere, approximately 32% of the tested frame gains visible
  low-intensity air outside the narrow core footprint. This is a spatial-fill
  metric, not a physical scattering measurement or a visual acceptance score.
- TypeScript no-emit, focused ESLint and diff whitespace checks passed. GPU
  buffer bytes are now reported through the existing module resource ledger.

Reproduce the focused visual checks with:

```sh
node scripts/cinema2-assets/accept-afterhours-spatial-light.mjs
node scripts/cinema2-assets/accept-afterhours-spatial-light.mjs --baseline
node scripts/cinema2-assets/accept-afterhours-spatial-light.mjs --preview
```

The baseline option substitutes the renderer from the current Git HEAD only;
all production rig, camera, timing and effect paths are shared with the updated
render. Captures and reports are ignored artifacts under
`artifacts/cinema2-afterhours-spatial-light/`. `afterhours-spatial-light.mp4`
shows nine seconds of Wide Fan, Split Wings and Cross Canopy at 24 fps. The
reference remains `/Users/kodyrobinson/Desktop/afterhours_laser_reference.mov`.

Local 960x540 dense-pattern samples, including a GPU finish at either end of
30 frames, averaged about .49/.60/.62 ms per frame on Low/Medium/High in this
harness. These short local measurements do not guarantee live application frame
rates on other hardware or under other workloads.

The implementation and automated checks are complete; the new appearance is
ready for user visual review. No commit was requested or created. Existing
uncommitted work elsewhere in the repository is retained.
