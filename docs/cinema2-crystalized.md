# Crystalized

The former Atmosphere Reference preset is now displayed as **Crystalized**.
Its stable preset, module, scene and parameter IDs are retained for saved-state
compatibility.

The central procedural crystal, gold frame and synthetic internal fracture
meshes have been replaced by the supplied `crystal.glb`, found at
`/Users/kodyrobinson/Downloads/crystal.glb`. The replacement retains the source's
1,800 triangles and its base-color, normal, metallic/roughness and emissive maps.
It is scaled to 3.9 world units tall and centered at x 0.35 / z -1.75, with its
base on the existing floor at y -1.2. The original four monoliths, camera,
lighting rig, fog and reflective-floor effects remain in place. Beat-driven
crack colors still apply to the surrounding monoliths; removed synthetic
crystal-fracture meshes no longer receive actions or expose internal targets.

The crystal starts with its textured surface (Crystal Clarity 0). Clarity and
Sparkle remain available; saved values retain user authority. The supplied
model's surface maps are preserved rather than forcing the old gold-framed
clear-glass recipe onto them.

All four 4096px source textures are reduced to 1024px for high/medium quality
and 512px for low quality. Combined with the existing monolith maps, estimated
GPU use is 42.9 MB for high/medium and about 10.9 MB for low, within their tier
budgets. During repackaging, legacy monolith base-color factors above glTF's
legal maximum were clamped to 1. Source attribution is bundled in the asset
record and generated attribution list: Crystal by Zambur, CC BY 4.0, with the
source URL and a SHA-256 provenance record.

To reapply the replacement after regenerating the procedural monolith base:

```sh
node scripts/cinema2-assets/replace-atmosphere-crystal.mjs /path/to/crystal.glb
npm run assets:build
```

Five focused tests, TypeScript, scoped ESLint and asset generation pass. Both
GLBs pass glTF validation with no errors. The four existing monoliths still
produce tangent-space warnings; their normal maps use renderer-generated
tangents. High and low browser renders pass without browser/shader/render
errors and were visually reviewed. Run
`node scripts/cinema2-assets/accept-crystalized.mjs`; its captures and report
are written to `artifacts/cinema2-crystalized/`.

Live desktop playback was not tested. Changes remain uncommitted; no commit
was requested.

## Standard Design and performance controls

Crystalized now uses the shared four-parent Design layout. The existing saved
parameter IDs are retained.

| Parent | Controls |
| --- | --- |
| Master Controls | Quality, Master Intensity, Motion Amount, Music Response, BPM Sync, Auto Performance, Camera Motion |
| Design | Crystal Scale, Monolith Height; Pattern, Pattern Change and conditional Trigger; existing surface/crack controls |
| Effects | Haze Density, Beam Intensity, Ground Mist, Floor Reflection, Bloom, Cinematic Finish |
| Palette | The four monolith accent colors |

Geometry transforms use floor-anchored pivots around the existing meshes.
Crystal Scale changes the imported model about its base; Monolith Height scales
only the surrounding stones vertically. The center crystal stays on the floor
with a fixed orientation. Motion Amount controls floor-anchored audio deformation;
zero removes that deformation. BPM Sync follows the shared
beat clock; off uses 120 BPM. Pause/stop holds the native performance, and
missing analysis does not restart the geometry clock.

The four native patterns are Prism, Color Orbit, Pulse and Cascade. Pattern
Change cycles them using the same eleven Trigger choices as the other presets.
Trigger appears only when Pattern Change is enabled. Auto Performance can
briefly choose Pulse for a canonical drop envelope or Cascade during a supported
build, then restore the current base pattern. A manual selection, including
reselecting the same value, reclaims authority until that musical episode clears.
Runtime choices never overwrite the saved Pattern.

Audio Intelligence remains the source of musical facts. Nine continuous shared
Choreography routes deliver energy, bass, highs, vocal restraint, build pressure
and Visual Director intensity, momentum, build and qualified impact. Canonical
kick, snare, beat and drop rules provide bounded envelopes. The native controller
uses those resolved targets for restrained geometry pressure, glints, supporting
light restraint, program crossfades and temporary performance. It does not detect
beats, estimate BPM, infer builds/drops or run an alternate musical clock.
Music Response zero removes musical contributions; manual patterns keep working.
Master Intensity gates all five live materials, all rig lights and every effect.

The preset uses a dedicated native module built with the existing Three scene
factory. A small optional model-controller hook retains shared loading, quality,
material and resource ownership. The controller addresses the live materials
after the bridge's Standard-to-Physical upgrade, so glow and master blackout
continue working on physical/refraction materials. The internal Three Model
Reference preset excludes Crystalized-only controls and routes.

Validation covers the canonical groups/consumers, saved controls, conditional
Trigger, BPM, pause/zero motion, analysis gaps, seeks, duplicate events, manual
takeover, automatic restore, floor pivots, physical material upgrades and master
gates. The existing monolith and shared Three scene suites also pass. Run
`node scripts/cinema2-assets/accept-crystalized-performance.mjs` for UI and pixel
checks, with captures under `artifacts/cinema2-crystalized-performance/`. The
fixture holds the dolly when comparing geometry/audio pixels and disables moving
mist for the isolated response check. Production camera timing remains authored.
Parent headers and nested headings use the shared 12px/700 and 11px roles;
portaled Trigger choices are checked through the real Inspector. No workspace
font overrides were added.

The completed performance pass has 28 focused unit tests and 14 full rendered
checks passing, plus a separate seven-check production UI/typography review.
The parent headings measure 12px/700, nested headings 11px, and the portaled
Trigger text 11px. TypeScript, scoped lint and diff whitespace checks pass.
No browser, shader, render or disposal failures remain. Changes are uncommitted;
live desktop playback has not been independently tested.


## Grounded center crystal correction

The center crystal no longer levitates or rotates. Removed Crystal Float and
Crystal Rotation from the preset schema and module state so old saved settings
cannot restore those motions. Crystal Scale and rhythmic scale pulses still use
the floor pivot at y = -1.2, keeping the base in contact with the same floor as
the surrounding stones. Lighting, patterns and camera controls retain their
existing behavior. Regression checks include world-space floor contact across
scale extremes under active music and legacy saved motion values, plus a
production-canvas stationary-crystal comparison with the camera held.

Validation for this correction: 11 focused tests passed (CrystalizedPerformance
and AtmosphereMonoliths), including the active-music floor-contact regression.
The production-canvas acceptance passed with no browser/shader/render errors;
the center-crystal comparison held steady while the floor lighting continued
independently. Focused ESLint and diff whitespace checks passed. No commit was
requested or created.
