# Cinema 2.0 — Backstreet

A white neon outline of the DVYDRM wordmark, mounted on a black painted brick wall. It has the same audio intelligence and choreography engine as Mainframe.

- Preset: `drmvyz.cinema2.backstreet` (`presets/Cinema2BackstreetPreset.ts`).
- Module: `backstreet-native-render` (`modules/Cinema2BackstreetNativeModule.ts`).
- Asset: `cinema2-backstreet` (`public/cinema2/models/backstreet.glb`, about 5.7 MB, about 60k triangles, one `high` file).
- Generator: `scripts/cinema2-assets/generate-backstreet.mjs`. Everything is procedural (tube sweep along the SVG master's 10 contours, 16 clips, brick wall and textures). Re-run it, then `npm run assets:build`.

## Parts

`tubeCores`, `clips`, `wall`. The tube vertices carry the Mainframe circuit attributes so the unchanged circuit shader drives them:

| Attribute | Meaning here |
| --- | --- |
| `_GLOW_PHASE` | elliptical distance from the sign centre (outward and inward programs) |
| `_MAINFRAME_ROUTE` | contour index |
| `_MAINFRAME_BANK` | 8 vertical stripes, mod 4 (Marquee) |
| `_MAINFRAME_REGION` | 8 angular sectors in Mainframe's numbering (Quadrant Relay, Radar Sweep) |
| `_MAINFRAME_SYSTEM` | constant 1 |

The tube albedo is near-black so the tube shows only its emission. A glossy white albedo was lit by the nearby wash lights and hid every pattern.

## Engine reuse

Reused unchanged: the Mainframe reactivity engine, beat-clock resolver, pattern controller, drop coordinator, musical-event resolver, audio delivery helpers, the nine cue rules and the light-rig helpers. Backstreet-specific logic is only `adaptCinema2BackstreetLighting`:

- **Idle Glow** (default 0.45) floors circuit energy and bank/region weights so the sign never goes dark between hits. At 0, programs may switch it fully off (Surge at idle nearly extinguishes it).
- **Radar Sweep** becomes a beam that goes once round the sign every four beats, via the `quadrant-relay` shader path (`resolveCinema2BackstreetSweepRegions`).

Programs (labels): Center Out, Edges In, Marquee, Quadrant Relay, Radar Sweep, Surge.

## Controls

Master Intensity, BPM Sync (Master Controls); Scale (Design); Pattern, Pattern Change, Trigger (shown when Pattern Change is on), Idle Glow (Effects); Tube Color (Palette, default white). Musical Cue is hidden.

## Look and lighting

Static (no audio) emissive is 2.6. In playback the shader emission is scaled by `PLAYBACK_EMISSION_GAIN = 0.4`. Nine wash point lights along the sign (lifted by choreography) and one shadow-casting spot light the wall. The camera is locked with a 70 s, four-point drift. Bloom threshold is 0.85.

## Known limits

- Pattern legibility at the default Idle Glow with real music has only been checked with synthetic frames.
- Tube thickness and glow are slightly lighter than the production reference; the brick sheen could be glossier.
- Installer budget raised to 60 MB (see `assets/cinema2/README.md`).

## Tests

`__tests__/Cinema2Backstreet.test.ts`: registration, compile and authoring gates, GLB attribute contract, control groups and Trigger visibility, bindings and cue rules, persistence, static frame, scale, lighting adaptation, radar sweep.
