# CONDUIT: Cinema 2.0 preset plan

**Status:** All four steps done (2026-09-30). CONDUIT is tuned against the owner's mockups, with the remaining gaps listed under Step 4.

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

**Result (2026-09-30):**

- **New `modules/three/Cinema2ThreeSegmentLighting.ts`:** `Cinema2ThreeSegmentLighting` turns the beat clock and audio into a few values each frame:
  - smoothed bass/energy level;
  - a drop envelope, triggered on entering a drop section or crossing a drop moment, which holds at full for 0.6 s and then decays;
  - a "quiet" factor for low-energy or vocal passages;
  - an integrated chase position, whose speed rises with level and build;
  - the split side, trading every beat when the music moves and every bar when it's calm;
  - one Energy Flow pulse per beat, stronger on downbeats (0 to 1 through the tubes, then 1 to 2 across the wall);
  - pattern crossfade weights (0.35 s).
- **Brightness function:** the GPU function (`CINEMA2_THREE_SEGMENT_GLSL`) has a TypeScript twin, `evaluateCinema2SegmentBrightness`, which the tests use.
- **`three-scene` config:** new `config.segments` maps part names to roles: `feed` (tubes), `core` (logo rim), `field` (wall). The parameters are:
  - `segmentPattern`: `energyFlow` / `ringChase` / `split` / `pulse`;
  - `segmentFlicker`;
  - `segmentReactivity`;
  - `segmentStrength`;
  - `segmentColor`;
  - `segmentSync`.
- **Bridge:** segment parts get a shader hook that replaces their own emissive with the pattern brightness times the energy colour. A segment role wins over `config.glow`, so RELIQUARY's audio glow path is untouched.
- **Verified on a real GPU:**
  - the shaders compile in Chrome/Metal with no GL errors;
  - renders on the three CONDUIT assets, driven by synthetic music, show each pattern:
    - Energy Flow: light moves from the tubes out across the wall;
    - Ring Chase: comets travel round the rings;
    - Split: the halves trade sides;
    - Pulse: the wall goes dark in a quiet passage while the tubes and logo stay lit, and a drop lights everything;
  - Flicker drops out random segments.
- **Tests:**
  - `Cinema2ThreeSegmentLighting.test.ts`: 9 tests of pattern behaviour, crossfade, flicker, reactivity, pause, and GLSL/TS constants.
  - `Cinema2ThreePbr.test.ts`: tests for the bridge hook and `config.segments` validation.
  - The three-scene, audio glow, RELIQUARY and GO-TO suites pass (75 tests).
- **Left for step 4:** brightness and contrast tuning. In the preview's tone mapping the amber still reads cream and the off segments aren't dark enough.

### Step 3: The CONDUIT preset and controls

- **Manifest:** a new native preset manifest (`drmvyz.cinema2.conduit`, name CONDUIT). It places the three assets in the scene and adds the HDR studio environment, a few music-driven accent lights, `reflective-floor`, `volumetric-atmosphere` (kept light) and `cinematic-finish`/bloom.
- **Controls:** the controls in the table above, bound through the shared parameter and choreography path.
- **Camera Movement:** drives the camera's `motion` amplitude (drift, sway, dolly-zoom), with its tempo taken from BPM Sync.

**Result (2026-09-30):**

- **Preset:** `presets/Cinema2ConduitPreset.ts` (`drmvyz.cinema2.conduit`, name CONDUIT) is registered as a keeper in the first-party catalog and exported from the Cinema 2.0 index.
- **Scene:** one `three-scene` module draws the chamber, the tubes and the wordmark at the shared origin. The module:
  - lights the tubes, rim and wall by segment (`config.segments`: energy = feed, rim = core, segments = field);
  - sets per-part materials: pearl letters with clearcoat, chrome ring and pipes, brushed silver shell, smoked-grey LED diffusers;
  - uses the neutral studio environment and two soft panels.
- **Controls:**
  - Master Controls:
    - Auto Performance, which drives `segmentAuto`;
    - Master Intensity, which drives `segmentReactivity` and is the strength of every choreography rule;
    - BPM Sync, which drives `segmentSync` and the camera's `tempoSync`;
    - Camera Movement, which drives the camera's `motionAmount` (drift, weave over two bars, bob, a lens breath every bar, a zoom punch on every kick).
  - Design: Pattern (Energy Flow / Ring Chase / Split / Pulse). Editing it turns Auto Performance off (`userEditSetParameters`).
  - Effects: Flicker.
  - Palette: Energy Color, which drives the segment colour and the three warm energy lights.
- **Auto Performance:** implemented in `Cinema2ThreeSegmentLighting` (`auto: true`):
  - Pulse on a drop and in quiet or vocal passages;
  - Energy Flow through a build;
  - otherwise Ring Chase, Split and Energy Flow in rotation every four bars;
  - it only changes pattern on a bar line, except that a drop switches at once.
- **Lights:** a key spot on the wordmark, a wall wash, three warm energy point lights (two by the tubes, one over the floor) and ambient. The energy lights swell on the downbeat, lift through a build and hit on a drop.
- **Effects:** the reflective floor at y = 0 (misses fall back to a dim silver rather than black), a light haze, bloom and a filmic finish.
- **Verified in Chrome:** the preset ran through the production `Cinema2Runtime` with synthetic music (the HUM:N frame factory):
  - no failed passes and no module diagnostics;
  - about 60 fps at 1280×720;
  - high, medium and low quality all run;
  - the patterns are visibly distinct: Ring Chase shows comets, Split shows the lit half trading, and a quiet Pulse dims the wall.
- **Tuning already found necessary:** the first run was blown out.
  - The silver room mirrors the studio environment.
  - The key light and wall wash scattered through the haze.
  - The pale LED diffusers washed the pattern to pastel.
  - The floor showed black patches where reflections missed.

  Fixed by lowering the environment, panels, lights and haze, darkening the LED "off" colour and the shell, raising segment strength, and giving the floor a silver fallback for misses.
- **Tests:**
  - `Cinema2Conduit.test.ts`: 8 tests covering the catalog/gate/compiler, the exact controls per group, the pattern options and their Auto-off behaviour, the segment and camera bindings, the assets and module validity, the light budget and the effects chain.
  - Plus an Auto Performance test in the segment lighting suite.
  - The node (21) and DOM (9) Cinema 2.0 failures are the same with and without this change, so they are pre-existing.

**Open for step 4:**
- the wordmark still blows out to white;
- high quality has a warm cast from the energy lights, while low quality's neutral silver is closer to the mockups;
- a quiet Pulse should take the wall darker;
- measure against the four mockups.

### Step 4: Tuning and verification

- **Synthetic music:** tune in real Chrome against the four mockups, driving the preset with synthetic music through an AudioIntelligenceBridge (the pattern used for the HUM:N and RELIQUARY presets).
- **Measure, don't eyeball:** compare brightness percentiles, glow coverage and saturation against the mockups, and note honestly where the result falls short.
- **Performance:** measure frame time on high, medium and low quality at 1080p.
- **Tests:** add unit tests for the pattern evaluator and the preset contract.

**Result (2026-09-30):**

The preset was tuned in Chrome through the production runtime with synthetic music. Every pass was measured against the four mockups on the same framing.

**Scenes compared:**
- Partial: Ring Chase at mid energy.
- Full: Pulse on a drop.
- Split: Split at high energy.
- Breakdown: Pulse in a quiet passage.

**Metrics:** image median/p90 brightness, saturation, amber coverage, and mean brightness of the wordmark, the centre above it, each wall half, and the floor. Brightness runs from 0 (black) to 1 (white).

| Scene | Wordmark (mine / mockup) | Centre | Wall | Floor | Amber coverage |
|---|---|---|---|---|---|
| Partial | 0.72 / 0.68 | 0.71 / 0.50 | 0.49 / 0.50 | 0.56 / 0.71 | 3.8% / 4.7% |
| Full | 0.76 / 0.67 | 0.73 / 0.57 | 0.51 / 0.56 | 0.60 / 0.73 | 4.1% / 11.8% |
| Split | 0.69 / 0.58 | 0.72 / 0.42 | 0.48 (both halves) / 0.59 left, 0.27 right | 0.49 / 0.61 | 4.2% / 11.9% |
| Breakdown | 0.64 / 0.66 | 0.65 / 0.26 | 0.44 / 0.34 | 0.48 / 0.63 | 1.1% / 5.5% |

**What changed, and why (each change came from a measured gap):**
- **Warm lights:** the three energy lights flooded the silver room orange. They now rest at 0.12 and reach 4-5 units, so the warmth stays near the tubes. Downbeat, build and drop hits are scaled down to match.
- **Wall wash:** a single wash aimed at the middle of the wall made a white hot spot behind the logo, lifting the centre from 0.57 to 0.82. It is now two washes from high left and right, each on its own half. The washes rest at 0.2 and rise with `director.intensity` (+0.16), so a breakdown sits darker.
- **Key light:** the key moved high and narrow (18°) with a low intensity. With the lower lights, pearl letters at 0.7, lower clearcoat and a darker chrome ring and back plate, the wordmark falls from 0.88 to about 0.7 and gets the dark edge seen in the mockups.
- **Soft roll-off for segment light:** the Stage has no tone mapping, so a bright amber clipped its green channel and turned yellow. The segment light is now `1 - e^-x`: lit LEDs stay amber and only the brightest roll toward a warm-white core. This lives in the bridge's segment hook and does not touch RELIQUARY.
- **Energy colour:** the default is now (1, 0.45, 0.12) at strength 3.4.
- **LED "off" colour:** near-black smoked glass (0.05). A lighter cover caught the room's and the warm lights' light, so off segments looked dimly lit.
- **Master Intensity default:** now 1. At 0.85 it blended in 15% of the steady glow; a 5% brightness in linear light reads clearly orange on screen after sRGB conversion, so breakdowns and the unlit half of a Split never went dark.
- **Split pattern:** the unlit half now rests at 0.015 (was 0.05).
- **Floor:** a silver base (0.42), albedo 0.8, reflectivity 0.62, roughness 0.14, and a silver fallback for reflection misses.
- **Bloom:** threshold 0.8. A second, wide bloom was tried and removed because it smeared the wordmark (see the first open gap).

**Controls verified in the runtime:**
- Camera Movement 1 moves the frame 13-16 px between frames 0.4 s apart; at 0 it doesn't move at all.
- Flicker 1 changes about 2.5% of the frame between frames; at 0, none.
- Each pattern is visibly distinct.

**Performance at 1080p** (Chrome, Metal):

| Tier | GPU frame time |
|---|---|
| High | 10.3 ms |
| Medium | 5.3 ms |
| Low | 7.3 ms |

- CPU time is about 4 ms, every tier holds 60 fps (16.7 ms per frame), and there are no failed passes.
- Low measuring above Medium is reported as measured and not explained yet.

**Honest remaining gaps:**
- **LED halos:** the mockups' LEDs have large orange halos and throw warm light onto the metal. The Stage's intermediate images are 8-bit, so bloom can only select what is near white. It cannot tell a bright LED from the white letters or a lit wall, and a wide bloom smeared the wordmark. Real halos need HDR render targets (an engine change) or halo geometry.
- **Centre disc:** it stays brighter than the mockups (about 0.7 vs 0.3-0.57). The flat disc faces the camera and catches the room light. A darker disc material, which would mean a separate asset part, is the likely fix.
- **Amber coverage in Full and Split:** 4% vs 12%. The mockups light more, larger and thicker segments, with glow bleeding into the metal around them.
- **Split's dark half:** in the mockup the whole right half of the room goes dark. CONDUIT darkens only its LEDs, because the room lights do not follow the split.
- **Breakdown darkness:** the room is still brighter than the mockup (0.44 vs 0.34). The wall washes fall with intensity, but not as far.
- **Floor:** darker and less streaky than the mockups' polished silver with long warm reflections. Screen-space reflections are sharp and limited to what is on screen.

**Tests:** 84 passing across CONDUIT, segment lighting, three-scene, PBR, RELIQUARY, GO-TO and audio glow. Typecheck and lint are clean on the changed files.
