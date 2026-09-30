# CONDUIT: Cinema 2.0 preset plan

**Status:** Step 1 (assets) done (2026-09-30). Steps 2-4 not started.

## Goal

CONDUIT is a new Cinema 2.0 preset built around the owner's **DVYDRM wordmark**, set inside a sci-fi chamber.

- **Wordmark:** fixed in place at the centre of the frame. It has a glossy pearl-white letter body inside a thin chrome outline ring. The amber rim that glows between the ring and the letters flares when energy arrives through the tubes, and follows the music's intensity.
- **Tubes:** four chrome S-curved tubes run from bolted wall flanges near the four corners into the left and right lobes of the outline ring. Glowing windows along each tube carry energy into the wordmark. Each tube has a segmented metal sleeve where it meets the logo.
- **Back wall:** a symmetric circular chamber of nested rings around a central disc, with curved T-shaped ribs, spoke panels, and a polished grooved floor. Short glowing LED segments are set along the rings, ribs and spokes. They react to the loaded track through Cinema 2.0's audio intelligence: they pulse, chase, split and drop out.

### Owner references

| Reference | What it shows |
|---|---|
| `wordmark_clean_master.svg` | The master wordmark. Saved as `scripts/cinema2-assets/sources/dvydrm-wordmark-master.svg`. |
| Mockups 1-4 | The production look in four lighting states. |
| Wall image | The back wall on its own, without the logo or tubes. |
| Tube image | The four tubes on their own. |

The four mockups show:
- **Partial:** some segments lit.
- **Full:** everything lit.
- **Split:** the left half lit, the right half dark.
- **Breakdown:** the wall dark, with only the tubes and logo glowing.

### Owner decisions

- **Name:** CONDUIT.
- **Back wall:** real 3D geometry written in code, not an image backdrop. Every LED segment can be lit individually.
- **Patterns:** four patterns (Energy Flow, Ring Chase, Split, Pulse), described below.
- **Wordmark:** fixed in place. The amber rim reacts; the letter faces do not light up.

### Patterns

| Pattern | What it does |
|---|---|
| Energy Flow | Light runs through the tubes into the logo on the beat, then ripples outward across the wall rings. |
| Ring Chase | Segments chase around the rings, alternating direction ring by ring, and speed up in high-energy sections. |
| Split | The left and right halves of the wall trade on the beat or bar, with a full-wall hit on drops. |
| Pulse | The whole wall breathes with the music. Quiet or vocal sections drop to the tubes and logo only; drops light everything. |

### Controls

The controls sit in the Design tab's four standard groups.

| Group | Control | Behaviour |
|---|---|---|
| Master Controls | Auto Performance | Standard Cinema 2.0 toggle. |
| Master Controls | Master Intensity | Standard slider. |
| Master Controls | BPM Sync | Standard toggle. When on, patterns and camera motion lock to the track's beat grid; when off, they run at a steady 120 BPM. This control belongs to the preset and is not gated by the dock's SYNC. |
| Master Controls | Camera Movement | 0 holds the camera still. Higher values add more zoom and sway, timed to the beat when BPM Sync is on. |
| Design | Pattern | Energy Flow, Ring Chase, Split, Pulse. |
| Effects | Flicker | 0 keeps segments steady. Higher values make segments in the tubes and wall drop out and stutter more often. |
| Palette | Energy Color | The colour of the energy in the tubes, rim and wall segments. Amber by default. |

### Known limits

- **Not photoreal:** the result will match the mockups' layout, materials and choreography closely, but they are offline renders. Soft bounce light, perfectly clean reflections and every panel detail are out of reach at 60 fps.
- **Warm light spill is partly faked:** it comes from a few music-driven lights plus bloom, not one light per segment. On high quality the engine allows 12 lights.
- **Floor reflections may speckle:** reflections of floating objects have looked speckled before (seen on GO-TO).
- **Glow contrast:** a bright chamber lowers the contrast of the glow. The fully lit mockup is the hardest balance to hit.

## Steps

### Step 1: Assets

Three generated, in-house models, written in code. There are no hand-made model files.

All three share one world coordinate system, so they line up without per-instance transforms:
- Units are roughly metres.
- The floor is at y = 0, +Y is up, and +Z points toward the camera.
- The chamber centre and the logo centre sit on x = 0.

1. **`cinema2-conduit-wordmark`**
   - **Source:** the master SVG, through the shared SVG-relief kit. It uses the same outline sampling, even-odd nesting and Delaunay "pillow" relief that built the GO-TO logo.
   - **Part `outline`:** the chrome outline ring, a bevelled extrusion.
   - **Part `letters`:** every body path (letters, lower sweeps, four-point star) as a smooth rounded relief.
   - **Part `rim`:** an emissive plate that fills the ring's interior, just behind the letters. It is what glows through the gaps between the ring and the letters.
2. **`cinema2-conduit-tubes`**
   - **Parts:**
     - `pipe`: chrome tube body;
     - `flange`: bolted wall mount;
     - `coupler`: segmented sleeve at the logo end;
     - `energy`: glowing windows along the front of each tube.
   - **Placement:** each tube's end meets the wordmark's outline ring at the connection points taken from the SVG.
3. **`cinema2-conduit-chamber`**
   - **Parts:**
     - `shell`: the brushed silver rings, ribs, spokes, panels and central disc;
     - `trim`: darker grooves and inlays;
     - `floorTrim`: the concentric floor grooves;
     - `segments`: the LED strips.
   - **Clipping:** geometry is clipped at the floor.
   - **Floor surface:** the native `reflective-floor` effect supplies the floor itself; the asset only adds the groove inlays.

**Per-vertex data for step 2.** Every emissive part carries two attributes:
- `_GLOW_PHASE` (0-1), the existing three-scene attribute:
  - tubes: 0 at the wall, 1 at the logo;
  - wall: 0 at the centre, 1 at the outer edge;
  - rim: 1.
- `_SEGMENT`, a new VEC4:
  - x: group, which ring, rib or tube, normalised to 0-1;
  - y: position along the group, 0-1 (the angle around the centre for rings, clockwise from the top);
  - z: side, -1 (left) to 1 (right);
  - w: a random 0-1 identity per segment, for flicker.

**Budget:** 150k triangles per asset (`assets:check`), and it must fit within the per-tier GPU asset budget.

**Done when:** all three assets pass `assets:check`, and a preview render confirms they line up with each other.

**Result (2026-09-30):**

| Asset | Triangles | Size | Parts |
|---|---|---|---|
| `cinema2-conduit-wordmark` | 59k | 3.3 MB | `outline`, `letters`, `plate`, `rim` |
| `cinema2-conduit-tubes` | 31k | 1.1 MB | `pipe`, `channel`, `flange`, `coupler`, `energy` (22 windows) |
| `cinema2-conduit-chamber` | 106k | 4.8 MB | `shell`, `trim`, `floorTrim`, `segments` (95 LED strips) |

- **Checks:** `assets:check` passes (13 assets, 20.9 MB shipped of the 50 MB budget). The asset tests and the Three/GO-TO/RELIQUARY suites pass.
- **Framing:** a Chrome preview from the planned camera (0, 1.92, 7), fov 42, looking level, reproduces mockup 1's framing:
  - the wordmark sits in the centre, spanning about 46% of the width;
  - the tubes land on the ring at the mockup's four points;
  - the flanges sit at the corners;
  - the wall's disc, rings, pillar, T-ribs, panels and outer arch are in place.
- **Shared SVG-relief kit:** the SVG relief code moved into `scripts/cinema2-assets/cinema2-svg-relief-kit.mjs`. The GO-TO logo generator now uses the kit, and its output is byte-identical to before (both the smooth and faceted variants).
- **Tube kit:** `writeGlb` in `cinema2-tube-kit.mjs` gained optional custom attributes. The RELIQUARY trees still come out byte-identical.

**Things learned while building the assets:**
- **Ring bevel:** the ring is only about 0.025 units wide in places, and its bevel eats in from both edges. At 0.018 the ring turned inside out and filled its whole interior, so the bevel is now 0.005.
- **Rim design:** a single emissive plate filling the ring would light as a flat amber sheet. Thin bands along every edge match the mockups' light hugging the letters.
- **Tube windows:** spacing windows from one end left a bare stretch near the coupler, so they are now spread evenly along the whole pipe.

**Still open, for steps 3-4:**
- The preview's amber washes to cream; the real colour comes from the Energy Color control plus bloom.
- The letters show some faint ripple in their reflections; this can be tuned per part in three-scene.
- The mockups' dense warm light on the floor and walls comes from lighting and the reflective floor, not from the assets.

### Step 2: Per-segment lighting in `three-scene`

- **New attribute:** teach the three-scene glow shader to read `_SEGMENT`.
- **Pattern evaluator:** add a small pattern evaluator, a pure function of beat position, audio intensity, build and drop state, and pattern id. It sets each segment's brightness on the GPU, from uniforms plus the segment attributes.
- **Flicker:** a seeded per-segment dropout driven by `_SEGMENT.w`.
- **Energy Color:** tints every emissive part.
- **Existing presets:** RELIQUARY's audio glow must keep working unchanged.

### Step 3: The CONDUIT preset and controls

- **Manifest:** a new native preset manifest (`drmvyz.cinema2.conduit`, name CONDUIT). It places the three assets in the scene and adds the HDR studio environment, a few music-driven accent lights, `reflective-floor`, `volumetric-atmosphere` (kept light) and `cinematic-finish`/bloom.
- **Controls:** the controls in the table above, bound through the shared parameter and choreography path.
- **Camera Movement:** drives the camera's `motion` amplitude (drift, sway, dolly-zoom), with its tempo taken from BPM Sync.

### Step 4: Tuning and verification

- **Synthetic music:** tune in real Chrome against the four mockups, driving the preset with synthetic music through an AudioIntelligenceBridge (the pattern used for the HUM:N and RELIQUARY presets).
- **Measure, don't eyeball:** compare brightness percentiles, glow coverage and saturation against the mockups, and note honestly where the result falls short.
- **Performance:** measure frame time on high, medium and low quality at 1080p.
- **Tests:** add unit tests for the pattern evaluator and the preset contract.
