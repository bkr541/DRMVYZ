# Space Boi (Cinema 2.0)

*space boi* by silvercrow101 (**CC BY-NC 4.0**, credited in the asset records and `THIRD_PARTY_NOTICES.md`). The shipped file is `public/cinema2/models/space-boi.glb`, byte for byte the supplied `space_boi.glb` (21 meshes, 2 materials, 80,664 triangles, no textures, no animation). The preset is `presets/Cinema2SpaceBoiPreset.ts` (revision 1, id `drmvyz.cinema2.space-boi`, role `reference`: human visual acceptance is still pending); the native module is `modules/Cinema2SpaceBoiNativeModule.ts`, with `modules/spaceBoi/` for the palette and the patterns.

> **Licence.** CC BY-NC allows non-commercial use only. The owner accepted that restriction for this one model on 2026-11-22, which is why `CC-BY-NC-4.0` is on the asset allowlist in `scripts/cinema2-assets/assets-core.mjs` (it is the only non-commercial entry). A build that ships Space Boi must stay non-commercial, or the preset must be removed, or the author's permission obtained.

## What is in the model

A flat, unlit drawing in 3D, in two inks: black (`Material.001`) and off-white (`Material.002`, linear 0.846, 0.813, 0.813).

| Part | Nodes | What the module does |
| --- | --- | --- |
| Figure | `body` (black fill and an inverted-hull white outline with the eyes) | Each mesh is split by region into a **head** (above the neck, y 2.52), a **body** and two **arms** (outside the gap at |x| 0.66). Head and arms hang from their own pivots under a body pivot at the waterline. |
| Water | `waves` (wide), `waves1` (at the figure), `waves2` (round the hands) | Three bands scaled outward from the figure and brightened. |
| Planets | `Sphere*` in four groups (ringed right, big left, small dark left, small dark behind the right shoulder) | Each group is lifted, swelled and brightened as one. |
| Moons, stars | `Sphere009`, `Sphere010`, `Sphere011`, `particles` | Brightened; the star field turns slowly about the figure. |
| Void | `Cube` (a black slab, top at y 0) and every `Material.001` mesh | The water's invisible floor: the figure can sink into it. |

The model's own meshes are never edited. Every split piece and recoloured material is the controller's own copy, and on dispose every moved mesh goes back to its parent, transform and material.

## System ownership

Audio Intelligence supplies the musical facts, the Mood Conductor reads the passage's feel, the choreography rules route them to the preset's own controls, and the module poses the scene from the shared beat clock only. There is no preset-local beat, phrase, drop, mood or silence logic. Pattern Change and Trigger use the shared `Cinema2PatternControlResolver`; Auto Performance uses `Cinema2PatternAutoPerformance`.

## Controls (Design inspector)

- **Master Controls:** BPM Sync, Intensity, Audio Reactivity, Zoom on Kick, Auto Performance.
- **Design → Pattern:** Pattern, Pattern Change, Trigger (the 11 shared options; shown only while Pattern Change is on).
- **Design → Figure:** Arm Motion, Head Motion, Body Motion, Kick Ripple. **Sky:** Planet Motion, Star Shimmer. **Water:** Ripple Motion. **Ink:** Figure Lines, Water Ripples, Planets, Stars & Moons (brightness 0 to 2). **Camera:** Camera Mode (Home View, Sky Drift, Manual View), View Motion Speed, Camera Heading, Camera Elevation, Camera Distance, Field of View.
- **Effects:** Bloom (default 0.3), Exposure, Vignette. Tone mapping is off so the two inks come out as authored.
- **Palette (five independent roles):** **Void** (the sky behind everything, the figure's fill, the planets' hatching and the water floor), **Figure Lines**, **Water Ripples**, **Planets**, **Stars & Moons**. The defaults decode to the file's own colours.

### Patterns

| Pattern | What happens |
| --- | --- |
| **Stargazing** (default) | The authored picture with a slow breath; at beat 0 it is exactly the model as authored. Arms still. |
| **Reach** | Over eight beats his arms rise toward the planets and lower; the planets drift closer and brighten. |
| **Conductor** | The arms take the beat in turn, the head nods on it, and each planet answers on its own beat of the bar. |
| **Planet Waltz** | The planets circle one another over eight beats while he sways with his arms out. |
| **Tide Pulse** | A ripple leaves him every bar and spreads through the water while he sinks and rises. |
| **Look Around** | The head turns to each planet in turn, two beats each; the planet he looks at brightens and swells. |
| **Ascension** (build) | Over sixteen beats his arms climb and tremble, the planets rise, the stars fill the sky. |
| **Supernova** (drop) | Twice a beat the arms are thrown up and planets, stars and water flash on alternate halves of the beat. |

### BPM Sync

On: the pose runs on the shared beat clock at the track's tempo (the camera drift too). Off: the same programs run at a steady 120 BPM. It never switches off audio reactivity. Verified on the production canvas (a 60 BPM track reaches fewer beats than a 120 BPM one with Sync on, and the same number with it off).

## Authority matrix

| Property | Manual control | Audio modulation | Auto Performance | Manual edit behaviour |
| --- | --- | --- | --- | --- |
| Pattern | The authored base | none | May substitute Ascension (build) or Supernova (drop) temporarily, and choose among its own patterns by feel | A manual pick shows at once and holds until the next fresh qualifying Trigger; an active event does not undo it (Auto Performance off) |
| Pattern Change, Trigger | Saved, user-owned | none | The music's *effective* values (never written to the saved ones) | Locked while Auto Performance is on |
| Arm, Head, Body, Planet, Ripple Motion, Star Shimmer | Base value | Multiplied by energy, vocal, bass, mid and high bands and by kick, downbeat and drop accents, scaled by Audio Reactivity | Mood drives (calm, peak, activity, momentum, drive, shock, silence) | Locked while Auto Performance is on |
| Intensity, ink brightness (four) | Base value | Energy, band and snare accents; drops | Mood drives (energy, calm, build, peak, shock, silence) | Locked while Auto Performance is on |
| Bloom, Exposure, Vignette | Base value | The drop lifts Bloom | Peak lifts Bloom; silence pulls it out | Locked while Auto Performance is on |
| Camera Mode, speed, heading, elevation, distance, FOV | Base value | Zoom on Kick changes only the lens | none | Locked while Auto Performance is on |
| Palette (five colours) | Base value | none | none | Editable at all times |
| BPM Sync, Auto Performance | Base value | none | none | Editable at all times |

## Audio map

| Musical information | Visual response |
| --- | --- |
| Bass band | Ripple Motion and the water's brightness |
| Mid band | Planet Motion and the planets' brightness |
| High band | Star Shimmer and the stars' brightness |
| Overall energy | Arm Motion and Intensity |
| Vocal presence | Head Motion and the figure's lines |
| Kick | Arms tap, body dips, and a pulse runs figure, water, planets, stars an eighth of a beat apart (Kick Ripple) |
| Snare | Planets and stars flash |
| Downbeat | The head nods |
| Drop | Bloom, Intensity, Ripple and Planet Motion surge, then settle |
| Silence | Beat-grid accents wait (`not-silent`); the shared drives pull everything out by about 90% |

## Mood drives (control, source, direction)

Arm Motion down in calm and up at a peak; Planet Motion down in calm; Intensity down in calm and up with energy; Ripple Motion and Star Shimmer up with activity; Head Motion up with momentum; Body Motion up with drive; planet and star ink up with a build; figure and water ink and Bloom up at a peak; star ink and Planet Motion up on a shock; and Intensity, the four motions, Star Shimmer and Bloom pulled to 10% in silence. All are multiplications around the authored value, bound to the user-facing controls so the Inspector shows each moving.

## Tests

- `__tests__/Cinema2SpaceBoi.test.ts` (35 tests, real GLB): asset and licence record, the mandatory shared controls, the eight patterns, the figure split (every triangle kept once), arm, head, body, planet, ripple and star motion with each control, the five palette roles, restoration on dispose, the camera, the choreography routes, Auto Performance build and drop, and the shared mood migration checks.
- `scripts/run-cinema2-space-boi-browser.mjs` (`npm run test:e2e:cinema2-space-boi`, needs a Vite server at `PLAYWRIGHT_BASE_URL`, default `http://127.0.0.1:5174`): the production canvas in Chromium (software WebGL). Stages `visual`, `audio`, `performance`, `lifecycle`: baseline visibility by region, 15 controls at their extremes, five palette roles, eight distinct patterns, camera, BPM Sync, bass/high/vocal and kick/snare/downbeat/drop responses, Auto Performance build/drop/silence/seek/track change, the real Inspector lock, re-entry, WebGL context loss, all quality tiers and zero leaked surfaces.

## Known limits

- Human visual acceptance against the reference render is **not done**; the preset is registered as `reference` until it is.
- With an arm raised, the shoulder goes with it (the shoulder dome is part of the arm region), so a raised arm reads as thin outline lines.
- Checked on software WebGL in headless Chromium only, and not with real audio.
- The shared Inspector adds two one-line "Auto Performance is choosing" notes (Pattern Change and Trigger) when Auto Performance is on and the music has a choice; no row changes height.
