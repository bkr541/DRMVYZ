# After Hours 2.0: laser reference analysis

Analysis of seven professional laser-show reference videos, compared with a screen recording of the current Cinema 2.0 After Hours 2.0 preset playing a track. The goal is to guide an upgrade of After Hours 2.0's choreography.

Source videos: `~/Downloads/laser-refs/`. That folder holds `Current_Afterhours_2.0.mov` and `reference_1`…`reference_7`. The seven references total about 5 min 10 s; the current recording is 43 s.

---

## 1. Method

Every video was processed the same way. ffmpeg handled extraction, librosa the audio, and OpenCV the video.

- **Audio:**
  - tempo and beat tracking;
  - onset strength;
  - separate low (30–150 Hz, kick), mid and high (4 kHz+, hats and snare air) band energies;
  - a guess at which beat is the downbeat, from low-band energy.
- **Video (every frame, 60 fps):**
  - brightness, and the fraction of the frame that is lit;
  - dominant hue of the lit pixels (12 hue bins), and the white fraction;
  - left/right balance and a mirror-symmetry score;
  - frame-to-frame change (motion, and look cuts);
  - detected beam line segments and their angles.
  
  The current recording was cropped to its visualizer area first, removing the inspector and top bar.
- **Timing:**
  - every look change and blackout was placed on the beat grid;
  - intervals between changes were measured in beats;
  - brightness autocorrelation was measured at ¼, ½, 1, 2, 4, 8 and 16 beats.
- **Visual review:** I read contact sheets for every video:
  - 1-second overview,
  - one frame per beat for 16 bars,
  - one frame per 16th note over the two loudest bars.
  
  Most of the pattern and choreography findings below come from reading these sheets. The numbers back them up.

### Confidence and caveats

- **The references are screen recordings of online videos.** Several look like laser pre-visualiser renders (a clean black void, no crowd). Reference 2 is a real stage with a DJ booth. Video and audio can be offset by a few frames, so **beat phase** (on the beat vs. slightly before) is not reliable to better than about ±1/16 of a beat. **Beat period and intervals** are reliable.
- **Automated beat-lock is inconclusive.** Scoring how tightly the biggest cuts cluster on one beat phase gave low values for every video. The references change looks on 8ths and 16ths as well as on beats, which spreads the phase. The 16th-note contact sheets give much stronger evidence and are used for the timing grammar in §3.
- **Brightness does not track loudness in any video.** The correlation between lit area and the audio loudness envelope ranged from −0.16 to +0.33. This is expected: pro laser shows follow the beat grid and song structure, not the volume envelope.
- **Beam geometry is 2D.** Fixture positions and angles below are inferred from flat video and are approximate.

---

## 2. Per-video findings

| Video | Tempo | Length | Setting | Palette |
|---|---|---|---|---|
| reference_1 | ~167 (likely 83 half-time feel) | 40 s | Pre-vis, black void | red/pink, cyan/azure, violet, green, white |
| reference_2 | ~123 | 42 s | Real stage, DJ booth, haze | blue/azure/white only |
| reference_3 | ~144 | 34 s | Pre-vis | pink/magenta + white |
| reference_4 | ~152 | 61 s | Pre-vis | blue/white vs. red |
| reference_5 | ~148 | 65 s | Pre-vis, hazy room | cyan, blue, amber, red, green (one family per section) |
| Reference_6 | ~140 | 44 s | Pre-vis with floor-mirror reflection | green, magenta, blue, cyan, red, violet, amber |
| reference_7 | ~148 | 26 s | Pre-vis, hazy | red vs. cyan/blue, magenta, white |
| **Current After Hours 2.0** | ~144 | 43 s | Cinema 2.0 | cyan only |

### reference_1: many small rigs, fast scene swaps

- **Rig:**
  - one centre emitter low on the stage;
  - two side emitters at mid height on the left and right edges;
  - occasional upper emitters.
- **Looks:**
  - a single-point V (red, 0.2 s);
  - a centre pyramid of 6–10 beams with side "lids" (horizontal beams from the side emitters);
  - a diamond (four beams converging to the top and bottom points, 8.2 s);
  - red scatter webs (14–15 s), and a white centre burst with crossed side beams (19.2 s).
- **Timing:**
  - 31 short blackouts (0.3–0.8 beats) in 40 s;
  - the look is re-picked almost every beat;
  - intervals are spread evenly between ½ and 6 beats.
- **Colour:** a different colour family for almost every look (red → violet → green → white → cyan → red).
- **Symmetry:** L/R brightness correlation 0.97. Almost always mirrored.

### reference_2: real club show (the most "After Hours" of the set)

- **Rig:**
  - about 8 emitters on a back truss behind the booth, firing up and out in fans of about 3–5 beams each;
  - two floor-corner fixtures firing a low horizontal sheet out over the crowd.
- **Timing:** hits of about ½–1 beat, then full black for about 1–2 beats. Upper fans and floor sheets take turns.
  - In the 16th sheet, from 1.79 s: black → upper fans on (4 × 16ths) → floor sheet (2 × 16ths) → black (3 beats) → upper fans again.
- **Colour:** a single colour family (blue/azure) for the whole clip. White appears only where beams overlap. Variety comes entirely from **which group is lit** and **when**, never from colour.
- **Atmosphere:** heavy haze. Beams read as soft volumetric shafts, with the brightest glow near the sources. The stage is silhouetted by the beams.
- **Relevance:** this is the closest real-world match to the preset's name and mood. It proves a single colour can carry a show if grouping and timing are strong.

### reference_3: pink pyramids with white accents

- **Rig:**
  - one centre emitter (low);
  - two side emitters (lower left and right);
  - later, three low emitters firing up in V fans.
- **Looks:**
  - red multi-point web (4 s);
  - white fans from three points (5–8 s);
  - pink pyramid "tent" with a white outline (10–15 s);
  - the main hold look: a solid pink pyramid **sheet** with side wings (22–28 s);
  - a white V burst (19.2 s).
- **Timing (16th sheet, 21.0–24.2 s):**
  - A **fill**: the look changes every 16th, alternating white V fans → pink wings → white side sheets → red V → black → white V…
  - It then **settles** on a held pink pyramid that shimmers slightly for two or more bars.
  - Pattern: a burst of 16th-note look swaps for about 1 bar, then a long hold.
- **Colour:** one main colour (pink) plus white as the accent colour for hits and fills.
- **Symmetry:** 0.95. Strictly mirrored.

### reference_4: two contrasting layers

- **Rig:**
  - three primary emitters: bottom-left, bottom-right and bottom-centre, forming a triangle;
  - extra fan heads at the corners.
- **Base layer:** a blue/white **X-lattice**. Beams from the bottom corners cross each other to the opposite top edges, forming a big X or diamond (33–42 s). It holds for bars at a time.
- **Accent layer:** a red cone/sheet ("liquid sky" surface) cuts in as a **hit** for about 2–4 16ths, then returns to blue.
  - In the 16th sheet (33.4–36.5 s), red hits land at 33.48, 33.88–34.08, 34.78–34.98 and 35.48–35.68 s: syncopated, on the off-beats.
  - After that, a red multi-beam fan hit fires on the & (36.18–36.48 s).
- **Other looks:**
  - a white fan burst from bottom-centre (0–1.5 s);
  - a red single-sided diagonal sweep from the bottom-left only (24–28 s). This is a deliberate **asymmetric** section.
  - a red rotating cone sheet (48–56 s);
  - a red horizontal lid (56–60 s).
- **Timing:** brightness autocorrelation stays high out to 4–8 beats (0.52 at 1 beat, 0.26 at 4 beats). Looks hold, and accents punctuate.
- **Lesson:** a steady **base look** plus a short-lived **contrasting accent look** creates rhythm without chaos.

### reference_5: a row of emitters, big set pieces

- **Rig:**
  - a **row of 5 emitters** across the stage at mid height (clearly visible as bright points);
  - a floor row firing up;
  - later, a low horizontal row.
- **Looks:**
  - interlocking X fans between neighbouring emitters, making a diamond lattice (0–11 s);
  - a stacked-V "crown" from the row (4–6 s), and cyan pyramid sheets (1.5 s, 12–13 s);
  - amber criss-cross lattices over a blue sheet (16–26 s);
  - a green horizontal "ceiling" plane (29.9 s, 35–42 s), crossing green/cyan fans (31–50 s);
  - green layered fan rows with blue beams underneath (52–57 s), mirrored green corner fans (58–60 s);
  - red and blue finale lattices (61–64 s).
- **Layering, from the 16th sheet (51.5–54.6 s):**
  - The **green fan row holds** for more than 2 bars.
  - The blue floor beams underneath **re-aim about every 8th note**, alternating crossed and parallel.
  - A true two-layer show: static canopy plus moving accent group.
  - Every bar or two there is a one-16th **dim/blackout** (52.23 and 54.64 s) before the next phrase.
- **Structure:**
  - long blackouts of 6–8 beats at 24–26, 32–34, 38–41 and 44–47 s, then an explosive re-entry;
  - each section keeps a **single colour family** (cyan → amber/blue → green → red).
- **Symmetry:** 0.996, the highest in the set. The mirror score is also the highest (0.80).

### Reference_6: mirrored world, colour hits

- **Rig:**
  - an upper row of about 3–4 emitter clusters firing down in W and zigzag shapes;
  - a matching lower row mirrored below, which looks like a floor reflection.
- **Base look:** a blue/violet W zigzag, held.
- **Hits (16th sheet, 37.1–40.4 s):**
  - About 1 beat of black.
  - Then **three consecutive 16ths with different colour washes** (37.95 pink/red, 38.05 cyan, 38.16 red), then a violet full-rig hit.
  - Back to the blue W for about 1 bar. Black 39.44–39.55.
  - Then another **three-colour 16th stutter** (39.65 cyan, 39.76 cyan/red, 39.87 cyan), a red X on the &, and a white/violet wide-beam look on the next beat.
  - Motif: a *stutter-flip hit* before and around each downbeat, repeated every bar or two.
- **Timing:**
  - 16 blackouts in 44 s, mostly ½–2 beats;
  - a strong brightness autocorrelation at 16 beats (0.37): the look plan repeats every 4 bars;
  - 41 of 75 look cuts land on the same 16th position, the most consistent grid lock in the set.
- **Colour:** changes on hits, not continuously (about 2.4 look/colour changes per beat during hit passages).
- **Symmetry:** 0.995, and it is **mirrored top to bottom** as well as left to right.

### reference_7: overhead points and red/blue swaps

- **Rig:**
  - **3 overhead emitters** (bright visible hotspots) plus a floor row;
  - side emitters firing horizontal "lids".
- **Looks:**
  - red criss-cross lattice from 3 points (3.2 s);
  - cyan V fans from the floor to the 3 points (6.2 s, 22.2 s);
  - magenta side sheets (7.2 s, 20.2 s);
  - white/violet V fans (8.2 s);
  - red horizontal lattice (9.2 s, 13.2 s), and pink/red criss-cross from 3 points (17.5–18.1 s).
- **Motif (16th sheet, 15.85–18.94 s):**
  - At the bar start, the colour flips **cyan → red → cyan/blue → red** every 16th for 4–6 steps, then holds on a cyan look with the 3 hotspots lit.
  - The look morphs into a pink/red lattice for 1 bar.
  - About 1 beat of **black** (18.24–18.54 s).
  - The same 4-step flip repeats on the next downbeat.
- **Timing:**
  - the highest look-change rate in the set (0.98 per beat);
  - brightness autocorrelation spikes at 8 beats (0.56): the phrase repeats every 2 bars;
  - blackouts of 0.7–1.2 beats before re-entries.
- **Colour:** a two-colour contrast (red vs. cyan/blue), with magenta and white as accents.
- **Symmetry:** 0.992.

---

## 3. Cross-reference findings: how professional laser choreography is built

### 3.1 Groups, not beams

Every reference is built from **groups of emitters that act as one**:

| Group | Seen in | What it does |
|---|---|---|
| **Upper/truss row** (3–8 emitters) | 2, 5, 6, 7 | Fans, W/zigzag, V-to-points, canopies |
| **Floor/low row** (3–5 emitters) | 2, 3, 5, 6, 7 | Up-fans, pyramids, audience-level horizontal sheets |
| **Corners** (bottom L/R, sometimes top L/R) | 1, 3, 4, 5 | Big X crosses, diamonds, corner fans |
| **Centre single point** | 1, 3, 4 | Pyramids/tents, V from one point, radial bursts |
| **Sides** (mid-height L/R) | 1, 7 | Horizontal lids, crossing side sheets |

- **Emitters are visible sources.** Almost every look shows the emitter points as bright hotspots (5, 7). The references read as a *rig*, not free-floating lines.
- **Each emitter produces many beams.** A single emitter typically fires a **fan of 4–20 beams**, or a **solid sheet/cone** when the fan is scanned fast enough to look like a surface ("liquid" sheets in 3 and 4, cone sheets in 4).

### 3.2 Look vocabulary

These are the looks that recur across the references, from most to least common:

1. **Fan:** an emitter spreads 4–20 beams in a flat arc (up, down or sideways). The foundation of every video.
2. **V / W / zigzag:** beams from a row meet at points, forming Vs; neighbouring Vs form a W (6, 3, 7).
3. **X-cross / diamond lattice:** beams from opposite corners or neighbouring emitters cross. Four sources converging form a diamond (1, 4, 5).
4. **Pyramid / tent:** a single centre point fans down to the floor, often filled as a solid sheet (3, 5).
5. **Sheet / plane / "liquid sky":** a fan scanned so fast it looks like a surface: a cone, tent, ceiling or floor plane (3, 4, 5).
6. **Horizontal lid / audience scan:** a flat plane or parallel beams at head height across the room (2, 5, 7).
7. **Lattice / web:** many crossing beams from 3 or more points (1, 5, 7).
8. **Stacked / layered fans:** rows of fans at two heights, or a fan row over a beam row (5, 6).
9. **Single-side sweep:** a deliberately asymmetric passage, one corner only (4).
10. **Full-rig white burst:** everything on, white, for one hit (1, 3, 4).

### 3.3 Timing grammar

This is the part that differs most from the current preset.

1. **Hold, then fill.** A base look holds for 1–4 bars with only subtle internal motion. Then a **fill** swaps looks rapidly on 8ths or 16ths for about ½–1 bar before the next phrase. Seen in 3, 5, 6 and 7.
2. **Stutter-flip on the downbeat.** 3–6 consecutive 16th-note flips between two or three looks or colours right around a downbeat, then a settle. This is the strongest recurring motif (6, 7, and the 3 fill).
3. **Pre-hit blackout.** About ½–1 beat of **total** black immediately before a big entrance. This happens constantly: 16 in reference 6, 31 in reference 1, 22 in reference 4.
4. **Long structural blackouts.** 3–8 beats dark at breakdowns and builds, then a full-rig re-entry. Seen in 3 (5.5 beats), 4 (2.8), 5 (6–8.6) and 7 (3.5).
5. **Base plus accent layers.** One group holds a steady look while a second group hits or re-aims on the rhythm: every 8th in 5, syncopated off-beat hits in 4.
6. **Syncopation.** Accent hits frequently land on the "&" or the "a" rather than the beat (4, 6).
7. **Phrase repetition.** Brightness autocorrelation spikes at 8 beats (7) and 16 beats (6): the choreography **repeats per 2- or 4-bar phrase with variations**, as a programmed show would.
8. **Look-change rate:**
   - references: 0.5–1.0 look changes per beat on average;
   - most intervals are ½–1½ beats, with regular long holds of 3–6+ beats;
   - rate rises in fills and drops in holds.

### 3.4 Symmetry

- **Left/right mirror is the rule.** L/R brightness correlation was 0.87–0.996 in every reference.
- **Asymmetry is a deliberate, short-lived feature.** Examples: a single-corner sweep section in 4, and chases that travel from one side to the other.
- **Vertical mirroring** is also used (6), as an upper row mirrored by a lower row.

### 3.5 Colour

- **One colour family per section or look,** and it changes on **structure or hits**, not continuously. Examples:
  - reference 5 moves cyan → amber → green → red by section;
  - reference 2 stays blue for the whole clip.
- **White is the accent colour** for bursts, outlines and fills (3, 4, 1).
- **Two-colour contrast.** Many passages alternate a base colour with one contrasting colour: blue/red (4, 7), pink/white (3).
- **Colour stutters** (3 colours in 3 consecutive 16ths) are used as hits (6, 7).

### 3.6 Optics and atmosphere

- **Haze** makes beams read as soft volumetric shafts. They are brightest near the source and widen and fade with distance (2, 5, 7).
- **Visible source hotspots** at each emitter (5, 7).
- **Sheets glow as surfaces,** with brighter edges.
- **Overlaps add up.** Crossings brighten, and overlapping colours bloom toward white.
- **Beams are thicker and brighter** than the current preset's thin lines. Lit-frame fraction in the references averaged 10–35% during active passages; the current preset stays under 1%.

### 3.7 Audio intelligence

- **The grid drives everything.** Laser state in the references is driven by the **beat grid** (8ths/16ths) and **song structure** (phrase, build, drop, breakdown), not by audio loudness. None of the references' brightness tracked the volume envelope.
- **Kick and snare are rarely followed literally.** Shows don't flash on every kick. They use the grid to place holds, fills, stutters and blackouts.
- **Structure matters most.** Long blackouts sit at breakdowns and builds, full-rig re-entries at drops, and the colour family changes at section changes.

---

## 4. The current After Hours 2.0

### 4.1 What the recording shows

- **Rig in use:** Wide Fan pattern, Pattern Change Off, Beam Count giving 2 visible beams per side.
- **Beams:**
  - thin, dashed-looking cyan lines;
  - no visible source hotspot, no haze glow, no sheets;
  - lit-frame fraction under 1% throughout.
- **Every beat,** the mirrored pairs jump to a new angle (a shallow V, a steep V, or meeting at a point). Occasionally a pair drops out for part of a beat.
- **Symmetry:** always mirrored.
- **Colour:** a single cyan for the whole 43 s. Colour changes per beat: 0.01.
- **Timing:**
  - brightness autocorrelation collapses after half a beat (0.08 at 1 beat, about 0 at 2–16 beats). Nothing holds and nothing repeats as a phrase: every beat is a new random-looking position of the same few lines;
  - no long holds, no fills, no stutter hits, no pre-hit blackouts;
  - the only "blackouts" are 0.2–0.4-beat gaps between bursts.

### 4.2 How the code produces that

| Area | Current implementation |
|---|---|
| **Rig** (`Cinema2AfterhoursRig.ts`) | 32 fixtures: 10 bottom, 6 left, 6 right, 10 overhead. Mirrored pairs. |
| **Beams per fixture** | **One beam per fixture** (`Cinema2AfterhoursBeamDescriptor` is a single origin→target line). Maximum 16 active beams (`CINEMA2_AFTERHOURS_MAX_BEAMS`). |
| **Topologies** (`TopologyCatalog`, `Geometry`) | 8 layouts that decide **where each single beam points**: wideFan, splitWings, crossCanopy, diamondStar, chevronRoof, radialCrown, sparseArchitecture, fullRig. |
| **Show planner** (`ShowPlanner.ts`) | Picks a topology on Pattern Change cadence (bar/4 bars/8 bars/phrase/drop), or randomly in Auto Performance. Structural blackout is a random gate at drop/section/phrase. Spread and motion scaling come from build/impact/vocal. |
| **Cues** (`CueChoreography.ts`) | A 16-beat scene. Picks one of chase, alternate, stab, roll, barHits, wash or strobe, with 2–4 groups of mirrored pairs. Each group fires bursts with a 1–4-beat period, and **jumps to a random new aim every burst**. The same scene id applies to all groups. |
| **Colour** | Primary plus Accent colour, with Accent Mix chosen **per pair by hash**. Auto palette is picked **once at creation**. No colour changes over time. |
| **Renderer** (`Renderer.ts`) | Instanced quads, one per beam (maximum 16 instances). Thin line with Atmosphere-scaled glow. No sheets, no source flare, no multi-ray fans. |
| **Music input** | Beat position (bar/beat/phase) for cues. Director intensity, build and impact, vocal presence, and kick/snare/downbeat/phrase/section/drop accents through choreography rules. |

---

## 5. How the references differ from After Hours 2.0

| # | Dimension | References | After Hours 2.0 today | Gap |
|---|---|---|---|---|
| 1 | **Beams per emitter** | 4–20-beam fans or solid sheets per emitter | 1 line per fixture, 16 maximum on screen | **Largest visual gap.** Needs multi-ray fans and sheets per fixture. |
| 2 | **Look vocabulary** | Fan, V/W, X/diamond, pyramid, sheet, lid, lattice, layered fans | 8 topologies of single lines. Several have the right idea (diamondStar, chevronRoof, crossCanopy) but render as a few thin lines. | Topologies need to become **looks**: fixture groups × beam-shape primitive. |
| 3 | **Holds** | Base looks hold 1–4 bars | Every burst jumps to a random new aim, so the picture changes every beat | Add **held looks**. Motion inside a hold should be subtle (shimmer, slow sweep), not a re-aim every burst. |
| 4 | **Fills and stutters** | 16th-note look/colour stutters around downbeats; ½–1-bar fills before phrases | Nothing faster than the per-burst gate; no fill concept | Add **fill** and **stutter-flip** cue types tied to phrase ends and downbeats. |
| 5 | **Pre-hit blackouts** | ½–1 beat of total black before big entrances, constantly | Random structural blackout gate (often skipped); short gaps between bursts only | Add a deterministic **pre-hit blackout** before downbeats of new phrases and drops. |
| 6 | **Long structural blackouts** | 3–8 beats at breakdowns and builds | Blackout scaled by accent and randomly gated; User Blackout Amount defaults to 0.25 | Make build and breakdown darkness a planned state, with **full re-entry on the drop**. |
| 7 | **Layers** | Base group holds while an accent group hits or re-aims on 8ths or off-beats | All groups run the same scene type; no base/accent roles | Add **layer roles** (base, accent, fill) with separate programs. |
| 8 | **Syncopation** | Accent hits on "&" and "a" | Offsets are whole or half beats inside a scene; no deliberate off-beat accents | Add off-beat and 16th offsets to accent programs. |
| 9 | **Phrase repetition** | Plans repeat every 2–4 bars with variation | 16-beat scene by hash; aim positions random per burst, so nothing recognisably repeats | Make the look plan **phrase-periodic**: the same look sequence per 4 bars, varied at 8/16 bars. |
| 10 | **Colour over time** | One family per section; white accents; 2-colour contrast; colour stutters on hits | Static Primary/Accent for the whole track; auto palette fixed at creation | Add **section colour changes**, a white accent on hits, and colour stutters. |
| 11 | **Emitter hotspots** | Bright visible source points | None | Add a source flare per active emitter. |
| 12 | **Haze/volume** | Soft volumetric shafts, source glow, additive overlaps | Thin line plus Atmosphere glow; very low lit area | Add a stronger volumetric profile and sheet surfaces. |
| 13 | **Symmetry** | L/R mirror almost always; short asymmetric sweeps; optional vertical mirror | Mirrored pairs (good); asymmetric mode is only a toggle | Keep. Add brief **asymmetric sweep** looks and optional vertical mirroring. |
| 14 | **Audio intelligence** | Grid plus structure drive the show; loudness mostly ignored | Already grid plus structure based (good), but structure only picks topology and blackout chance | Use structure to choose **timing grammar**: hold in verses, fills at phrase ends, dark in builds, stutter plus full rig on drops. |
| 15 | **Rig layout** | Rows of 3–5 emitters (upper and floor), corners, centre point | 10/6/6/10 banks, but only up to 16 single beams active | Fine as a physical rig. What's missing is using groups of it as rows, corners and centre. |

---

## 6. Recommendations

In priority order. These are proposals only; nothing has been changed.

1. **Multi-ray fixtures and sheets (visual foundation).**
   - Let one fixture emit a fan of N rays (4–20), with fan width, orientation and optional "sheet" mode (dense fan drawn as a surface).
   - Raise the render budget from 16 single-beam instances to a ray budget of roughly 256–512 rays and 8–16 sheets.
   - The LaserDMX engine already documents fan, layered fan, sheet, tunnel, canopy, diamond-plane and lattice primitives (`docs/laser-dmx-fixture-optics-and-primitives.md`). Check whether that code can be reused before writing new geometry; I have read the doc only, not the code.
2. **Emitter hotspots and a stronger volumetric beam profile,** with additive overlap bloom.
3. **Looks as groups × primitive.** Redefine the topologies as looks that pick fixture groups and a shape. Examples:
   - "upper row W fans";
   - "corner X lattice";
   - "centre pyramid sheet";
   - "floor lid";
   - "layered fan row + floor beams".
4. **Timing grammar in the cue layer:**
   - **hold:** 1–4 bars with shimmer or slow sweep, and no per-burst re-aim;
   - **fill:** 8th/16th look swaps in the last ½–1 bar of a phrase;
   - **stutter-flip:** 3–6 × 16th look/colour flips at a phrase downbeat or drop;
   - **pre-hit blackout:** ½–1 beat before phrase downbeats and drops;
   - **base + accent layers:** accent programs with off-beat and 16th offsets.
5. **Phrase-periodic planning.** The same look sequence repeats across a 4-bar phrase, and variation comes at 8/16-bar boundaries and section changes. It stays deterministic from the song position and seed, as today.
6. **Colour choreography:**
   - one colour family per section;
   - white as the hit/accent colour;
   - base/contrast colour alternation on accents;
   - colour stutters on hits.
   
   Manual colours stay authoritative. With Color Mode = Auto, the section palette rotates.
7. **Structure-driven states:**
   - verse/groove → hold + accents;
   - build → thinning, narrowing, and darkness growing to a long blackout;
   - drop → stutter + full rig + white burst, then hold;
   - breakdown → sparse single-colour holds.
8. **Asymmetric passages.** Short single-side sweeps or chases as a planned look, not only via the Symmetry toggle.

Suggested first implementation slice, for the biggest visible improvement:

- #1 fans and sheets;
- #2 hotspots and haze;
- #4 holds, pre-hit blackouts and stutter-flips.

---

## 7. Appendix: measured data

| Video | Beats | Look cuts / beat | Flashes / beat | L/R corr | Mirror score | Brightness autocorr at 1 / 4 / 8 / 16 beats | Blackouts | Look/colour changes / beat |
|---|---|---|---|---|---|---|---|---|
| Current | 99 | 0.25 | 0.30 | 0.20* | 0.13* | 0.08 / 0.00 / 0.00 / 0.00 | 7 (0.2–1.2 beats) | 0.01 |
| reference_1 | 90 | 0.52 | 0.38 | 0.97 | 0.59 | 0.16 / −0.01 / −0.16 / 0.04 | 31 (0.3–0.8) | 2.22 |
| reference_2 | 69 | 0.33 | 0.22 | 0.97 | 0.71 | 0.04 / 0.12 / 0.14 / −0.04 | 11 (0.2–2.0) | 2.62 |
| reference_3 | 81 | 0.72 | 0.37 | 0.95 | 0.60 | 0.23 / 0.19 / 0.03 / −0.01 | 9 (0.5–5.5) | 1.26 |
| reference_4 | 150 | 0.63 | 0.32 | 0.87 | 0.59 | 0.52 / 0.26 / 0.25 / 0.11 | 22 (0.25–2.8) | 1.03 |
| reference_5 | 151 | 0.74 | 0.45 | 0.996 | 0.80 | 0.40 / 0.02 / −0.22 / 0.19 | 7 (0.3–8.6) | 2.14 |
| Reference_6 | 101 | 0.75 | 0.49 | 0.995 | 0.67 | 0.26 / 0.12 / −0.02 / 0.37 | 16 (0.24–2.0) | 2.42 |
| reference_7 | 57 | 0.98 | 0.60 | 0.992 | 0.62 | 0.43 / −0.24 / 0.56 / 0.34 | 16 (0.2–3.5) | 2.09 |

\* The current preset's thin lines light so few pixels that its symmetry scores are dominated by noise. Visually, it is always mirrored.

**Look-cut intervals** (beats between look changes; count per bucket):

| Video | < ⅜ | ⅜–¾ | ¾–1½ | 1½–3 | 3–6 | > 6 |
|---|---|---|---|---|---|---|
| Current | 14 | 2 | 1 | 0 | 6 | 1 |
| reference_1 | 7 | 11 | 7 | 12 | 8 | 1 |
| reference_2 | 5 | 3 | 2 | 5 | 1 | 6 |
| reference_3 | 8 | 29 | 11 | 6 | 2 | 1 |
| reference_4 | 19 | 31 | 17 | 16 | 7 | 4 |
| reference_5 | 16 | 34 | 31 | 22 | 4 | 4 |
| Reference_6 | 23 | 4 | 29 | 9 | 8 | 2 |
| reference_7 | 10 | 33 | 2 | 6 | 4 | 0 |

**Dominant beam angles** (line segments, 0° = horizontal): the references spread across all angles, with strong peaks at 15–45° and 135–165° (fans and Vs). The current preset concentrates at 30–60° and 120–150° (its two V pairs).

Scripts and contact sheets used for this analysis are in the session scratchpad, not the repo. They can be regenerated on request.
