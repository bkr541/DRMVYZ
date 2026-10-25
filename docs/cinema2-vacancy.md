# Cinema 2.0 VACANCY — behavior specification

Status: **phases 3–6 implemented; final human visual review pending.** The user approved their static composition in commit `54fbd893` and requested the remaining phases. That stacking implementation and its standard layout are unchanged. This document records the implemented behavior; validation and limitations are in [the implementation report](cinema2-vacancy-implementation-report.md).

- Preset id `drmvyz.cinema2.vacancy`, label **VACANCY**, native module `vacancy-native-render` v1.
- Reference: the user's CRT pyramid images: a centred 4-3-2-1 stack of vintage televisions in a dark empty room, every screen glowing white-grey static above a glossy floor.
- Source assets: `docs/Vacancy/*.glb` (one room, six televisions). Originals are never modified; a build script writes the shipped runtime asset.

## 1. Visual specification

**Hero visual.** A compact, three-dimensional pile of CRT televisions, staggered across a broad base and narrowing to one set at the top, standing in the middle of an otherwise empty room. The glowing screens are the only light.

**Composition (mandatory vs inspirational).**

| Characteristic | Status |
|---|---|
| Tower centred in an empty dark room, four visible rows narrowing 4-3-2-1 toward the peak | mandatory |
| Screens dominate the lighting; the supplied room remains visibly readable | mandatory |
| Bright white-grey analog static with faint horizontal banding on every screen | mandatory |
| Glossy floor reflecting the screen glow | mandatory |
| Coherently forward-facing screens, with subtle directed turns and real physical contact between stacked rows | mandatory |
| Camera slightly low, a few metres back, tower right of centre | inspirational |
| 10 sets | mandatory (4-3-2-1 silhouette) |
| Mixed set sizes with the largest at the bottom | mandatory (user brief) |

**Major elements.** The brick room (one model), 10 televisions, one emissive screen per set, floor reflection, haze, bloom. The visible rows contain 4 / 3 / 2 / 1 sets, with no extra TVs hidden behind the stack. All six source models are used. Compact, standard and tall share this composition at different overall sizes.

**Physical stacking.** Each layer is a single horizontal row. The next row straddles the seams between the sets below, rather than forming a single-TV column or rows receding into the room. The old-school and retro cabinets sit in the front foundation row. All raised TVs require at least two lower sets contributing at least 3% of their base each, at least 65% total base contact, and a centre of mass at least 6 cm inside the support polygon. The accumulated weight above every support is also checked, using cabinet volume as a mass estimate. Exact rotated footprints are used for collision and contact checks. Rows are horizontally centred using the actual cabinet widths, with consistent close spacing. Antennae occur only on the crown.

**Orientation.** The TVs retain the reference's common forward direction, with four selected TVs facing slightly outward. No layer is forcibly rotated 90 or 180 degrees to put screens on every side. An orbit will reveal the actual cabinet sides and backs, together with the depth of the actual supporting cabinets. The stack has the cabinets’ real depth but a clear, legible front-facing pyramid silhouette.

**Placement.** World space, metres, y up, floor at y = 0. The supplied room has a footprint about x -4.91..5.84, z -5.50..5.37 and a 2.76 m ceiling. The pile stands at x 0.46, z -0.1. Uniform model scaling keeps cabinet tops level: compact uses 0.42 m cabinet heights, standard 0.48 m and tall 0.54 m. The standard pile is about 2.03 m high including the crown antennae. The default camera looks nearly straight at the centred pyramid to keep the 4-3-2-1 outline legible. Orbit Angle exposes a bounded front viewing arc; see section 5.

**Coordinate / render-space policy.** World-space. Depth and perspective are the design (stacked objects, reflective floor, camera drift). Nothing is frame-anchored, so aspect ratio only changes framing: the default camera widens its field of view at narrow aspects so the whole tower stays inside the frame.

**Safe bounds.** The tower never crosses the ceiling (tier count is capped by the model heights) and never leaves the camera frame at any supported aspect. Camera drift is bounded to a few centimetres and about one degree.

## 2. Asset specification

| Model | As authored | Normalisation |
|---|---|---|
| `abandoned_brick_room` | 3 MB, unlit baked texture, 10.8 x 2.8 x 10.9 m | none; darkened by the preset (section 4) |
| `old_school_tv` | 27 MB, wood, 7.9 units wide, faces +Z | scale to a 0.62 m wide set |
| `old_tv2` | 0.7 MB, wood/chrome, 0.017 units wide | scale up about 29x to 0.50 m |
| `sony_pvm-14l2_crt_tv` | 71 MB, grey metal, 0.36 m wide, faces +Z | keep real size, 0.38 m |
| `tv__old_tv__retro_tv` | 9 MB, black plastic, **faces +X** | yaw correction of -90 degrees, 0.55 m |
| `tv_set` | 10 MB, wood, 82 units (cm) wide | scale 0.01 then to 0.70 m |
| `vintage_tv4` | 12 MB, wood/orange with antennae | 0.52 m; used on the top tier so its antennae clear the set above |

**At least one of every model is always present** (a tower of fewer than six sets is not offered).

None of the six models has a separate or emissive screen: the glass is part of one baked material. Every set therefore gets an authored **screen anchor** (centre, size, depth, corner radius, curvature) in its own model space, and the preset draws an emissive screen over it. Anchors are measured against the model, not guessed.

**Shipped payload.** The ~130 MB of source textures are 4K PNGs. The build script downsizes and recompresses them (WebP) into the standard high / medium / low tiers inside the per-asset GPU limits (80 / 48 / 32 MiB) and the installer budget (128 MiB total, 16 MiB per file; about 43 MiB were free). Attribution: the user states no attribution is required, so the asset records are `CC0` with the owner-supplied origin.

## 3. Screen specification

Each screen is one emissive surface with a rounded-rectangle, slightly curved CRT mask:

- **Static (default).** Animated analog noise, faint rolling horizontal bands, a slow vertical-hold drift and a light vignette, tinted by the Palette **Screen** colour (default cold white-grey).
- **Media (user toggle).** A Design toggle replaces the static with a chosen image, video or SVG from the shared media slot system, drawn through the same CRT treatment (scanlines, vignette, curvature). Static can be mixed back over it with **Static Over Media**.
- **Media Layout.** *Every screen* repeats the media cropped to each set. *Stack wall* spreads one image across the whole tower as a single video wall (UVs from the tower's front-projected bounds).
- Per-screen brightness is owned by the active Pattern; static grain, bands and mixes are owned by the user's Design values with bounded audio modulation.

## 4. Room and lighting specification

- The room is the supplied model. Its base-colour map includes baked shadows and is reused as self-lit fill, so the ceiling, brick walls, doorways, graffiti and skirting are visible behind the tower. **Room Visibility** (default 0.65) scales that fill, with sufficient linear intensity to preserve the dark texture through the production output. Zero removes the baked fill; screen spill remains. Master Intensity also scales the fill, so zero blacks it out. Fill is available at every quality level.
- The glow lights the world: a bounded set of point lights around the tower (one on low, additional lights on medium/high) plus emissive spill, all driven by the screens' current brightness.
- The floor is the room's own floor, made glossy through the shared reflective-floor effect (plane just above the floor, blended 62% over the real floor so the concrete still shows) with the existing wet-concrete surface texture. Camera near/far are kept tight (0.4 / 24) so the virtual plane and the floor mesh agree in depth.
- Haze (subtle dust in the screen light) and bloom (screen halation) are finishing effects. They never replace base geometry.

## 5. Camera specification

**Orbit Angle** (−25..25 degrees, default 0) rotates the shared orbit camera through the room’s clear front viewing arc. **Camera Motion** (0..1, default 0.25) adds slow bounded drift: at maximum, 4 cm position, 8 mm target, 0.2 degrees roll/FOV. Zero removes drift immediately; with Orbit Angle also 0, this restores the approved hero shot exactly. Drift follows shared transport animation and holds when stopped or paused. The manual angle works while idle. Safe bounds are in section 1.

This is a bounded front arc, not a continuous 360-degree orbit. The supplied room partitions obstruct wider camera positions. A complete orbit remains outside the validated camera path.

## 6. Parameter specification (Design inspector)

Every parameter sits under exactly one of the four parent groups.

| Parent group | Controls |
|---|---|
| **Master Controls** | Master Intensity, **BPM Sync** (toggle), Music Response, Bass Rattle, Camera Motion, Orbit Angle, Auto Performance |
| **Design** | **Pattern** (8), **Pattern Change** (toggle), **Trigger** (the 11 canonical options, visible only when Pattern Change is ON), Screens Lit, Static, Scanlines, Tower Size, **Media on Screens** (toggle), Media (picker), Media Layout (Every screen / Stack wall), Static Over Media |
| **Effects** | Bloom, Floor Reflections, Haze, Room Visibility |
| **Palette** | Background, Screen, Highlight, Glow, Haze (five independently editable colours, each with a distinct visual consumer) |

### Palette role map

| Colour | Role |
|---|---|
| Background | Room and ambient tint |
| Screen | Tint of the static and of media on the screens |
| Highlight | Drop white-out and snare/kick accent flashes |
| Glow | Floor bounce, reflection and bloom halation tint |
| Haze | Colour of the dust haze in the screen light |

### BPM Sync timing contract

BPM Sync is a boolean under **Master Controls**. **On:** pattern progression, band roll and channel-hop advance in beats from the shared Cinema 2.0 beat clock. **Off:** the same motion free-runs on a fixed authored 100 BPM rate. It never disables event reactions (kick, snare, drop), Pattern Change or Auto Performance. It is independent of the Audio Dock's BPM Sync and stays correct across play, pause, resume, seek, loop, track change and re-entry.

## 7. Pattern library

Eight patterns, each a different per-set brightness and channel program, not aliases:

| Pattern | Behaviour |
|---|---|
| **Dead Air** | Every set lit with static, small independent shimmer. The idle default. |
| **Channel Hop** | One set bright at a time, hopping between sets on the beat, the rest dropped to embers. |
| **Ascent** | A band of light climbs the tower tier by tier, bottom to top. |
| **Collapse** | The same band falls top to bottom. |
| **Signal Sweep** | A vertical-hold bar sweeps across the tower left to right. |
| **Checker** | Alternating sets swap bright and dim on each beat. |
| **Vacancy** | Almost every set dark; a single lone set drifts across the tower. The emptiest mood. |
| **Interference** | Each set rolls its own bars at its own rate, drifting in and out of phase. |

## 8. Audio mapping

| Class | Signal | Visual consequence |
|---|---|---|
| Continuous | Overall energy | Screen brightness range and static grain amount |
| Continuous | Bass | Floor glow and the strength of the bass rattle |
| Continuous | Highs | Static sparkle |
| Continuous | Vocal presence | Reduces lit-screen coverage (restraint) |
| Continuous | Build progress | **Blackout:** screens fade toward embers as the build rises |
| Rhythmic | Kick | Brightness pulse on lit screens, floor glow, a rattle impulse |
| Rhythmic | Snare | Scanline roll and a flicker accent |
| Rhythmic | Downbeat | Tier-wide accent |
| Structural | Phrase / section | Pattern change (through Trigger) and a channel-surf sweep |
| Structural | Drop | **White-out:** every screen slams to full Highlight, then decays |

**Idle behavior.** With no track the static still shimmers at a low authored rate and the pattern idles on its authored base. Nothing reads as music response. When audio begins, brightness range, grain and rattle visibly take over.

**Bass rattle and camera drift** are user-scaled and subtle by default. Both can be set to zero.

## 9. Authority matrix

| Property | Manual control | Audio modulation | Visual Director | Auto Performance | Manual edit behavior |
|---|---|---|---|---|---|
| Master brightness | Master Intensity (base) | None | None | None | User owned |
| Screen brightness | Pattern base + Screens Lit | Energy, kick, build blackout, drop white-out (bounded) | Scales range with significance | None | User base + modulation |
| Screens Lit (coverage) | Slider | Vocal presence reduces within the slider | None | None | User ceiling, never exceeded |
| Static / Scanlines | Sliders | Highs and snare add bounded sparkle/roll | None | None | User base + modulation |
| Pattern | Dropdown (base) | None | None | May **temporarily** substitute a build/drop pattern | Edit takes effect immediately, keeps Pattern Change ON |
| Pattern Change / Trigger | Toggle / dropdown | None | None | None | User owned |
| Bass rattle | Slider | Bass and kick | Scales amplitude | None | User ceiling (0 disables) |
| Camera | Camera Motion / Orbit Angle | None | None | None | Motion 0 removes drift; angle 0 restores frontal view |
| Palette (5) | Colour pickers | None | None | None | User owned |
| Bloom / Reflections / Haze / Room Visibility | Sliders | None | None | None | User owned; 0 = off and stays off |
| Media on Screens / Media / Layout / Static Over Media | Toggle / picker / dropdown / slider | None | None | None | User owned |
| BPM Sync | Toggle | None | None | None | User owned |

**Pattern precedence** (contract section 9): manual selection establishes the base pattern; the selected Trigger may advance the base while Pattern Change is ON; Auto Performance may temporarily substitute a build/drop performance pattern; the underlying base resumes afterward. A manual Pattern edit is never undone by an already-active build or drop.

**Auto Performance owns only** build/drop pattern substitution. A new confident build temporarily selects Vacancy for up to eight beats (ending sooner when the build ends); a fresh drop selects Dead Air for four beats. Base progression continues underneath. The same held build/drop cannot restart an expired override; a manual Pattern edit cancels the current override and existing drop flash. The user keeps every other property, and a hard-off control (for example Bloom = 0) is never re-enabled.

## 10. System ownership

| System | Job in VACANCY |
|---|---|
| Audio Intelligence | Shared musical facts only; no preset-local beat, phrase or drop detection |
| Visual Director | Broad significance scaling for screen range and rattle |
| Choreography | Bounded, resettable kick/snare/downbeat/build/drop envelopes on the screen programs |
| Parameter State | The user's authored values above |
| Native module | The tower layout, screen programs, rattle, room darkening and light drive |
| Camera / scene / lighting / effects | A bounded orbit camera with drift, point lights, bloom, haze and the reflective floor |

## 11. Build stages and checkpoints

1. **Asset preparation.** Optimise and normalise the models into the shipped runtime asset; measure each screen anchor.
2. **Static composition.** Room, tower, screens, lighting, floor, camera. No audio, no automation. **Pause for user visual approval against the mockup.**
3. Camera movement and manual controls (including the mandatory shared controls), each proven min / default / max on the production canvas.
4. Native motion: the eight patterns.
5. Audio, choreography, Visual Director, Auto Performance.
6. Finishing and full production-path acceptance, then human review.


## 12. Implemented control-to-output map

| Control | Output consumer / limit |
|---|---|
| Master Intensity | Screen emission, room fill and screen lights; shared choreography gates finishing mixes at zero |
| Music Response | Scales bounded continuous/event modulation; zero neutralises musical brightness, grain, coverage restraint, rattle and flashes |
| Bass Rattle | Whole-tower X/Z motion under 5 mm at maximum; no relative cabinet movement or support changes |
| Screens Lit | Strict ceiling of `floor(value × 10)` lit screens, including drop white-outs; zero stays black |
| Static / Scanlines | Grain/rolling bands and CRT scanlines respectively; zero disables their corresponding detail |
| Tower Size | Compact / Standard / Tall from the approved stacking solver; Standard is the unchanged approved default |
| Pattern / Pattern Change / Trigger | Eight native brightness/channel programs; OFF holds the authored pattern, ON advances on fresh selected shared events |
| Media on Screens / Media | Shared image/video/SVG slot, with static fallback when empty; optional media never hides the cabinet geometry |
| Media Layout | Repeat every screen or front-project one stack-wide image; shared fit, position, scale, rotation and opacity are consumed |
| Static Over Media | Mix CRT static into media, independently from the normal static program |
| Bloom / Floor Reflections / Haze | Shared finishing mixes; authored zero remains off during music and Auto Performance |
| Room Visibility | Baked room fill, independent of quality tier |
| Five Palette colours | Distinct screen, event-highlight, room, point-light glow and haze consumers (section 6) |

Videos loop muted independently of the music timeline, pause with shared transport pause and resume afterward. Removing/replacing media releases the engine-owned texture without leaving a stale Three texture binding. Missing or stale music produces neutral response. Pause holds musical envelopes and pattern motion while manual edits still resolve; seeks, loops, track/source changes, re-entry and context restoration reset transient ownership. Auto Performance defaults OFF; Pattern Change defaults OFF. BPM Sync defaults ON.

## 13. Phase checkpoint

| Phase | State |
|---|---|
| 1–2 Assets / static composition | Existing implementation; user-approved `54fbd893`, preserved |
| 3 Camera / manual controls | Implemented and production-canvas checked, including the bounded Orbit Angle |
| 4 Native patterns | Eight independently tested programs |
| 5 Audio / choreography / Director / Auto Performance | Implemented through shared services; deterministic production audio fixtures checked |
| 6 Finishing / production acceptance | Automated and agent visual checks passed; final human A/B review remains pending |

No legacy port is involved. No installer asset, model source or stacking solver was changed in phases 3–6.
