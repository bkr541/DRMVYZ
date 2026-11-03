# Reusable preset thumbnails

`ReactPresetCard` uses a responsive poster height of `width × 2 / 3 − 30px`, reduced by 6px from the previous tile. It centers the uppercase preset name on both axes of the poster. Mode metadata stays at the bottom; modification badges and secondary actions stay in their corners. The shared title role uses white, uppercase Manrope at 12px/400 with 0.12em letter spacing, following the supplied geometric wordmark reference. Title and metadata roles live in `src/styles/typography.css`. The surface matches the Cinema 2.0 Engine card: a 245° cyan gradient, upper-right radial glow at 97% / 20%, subtle inward illumination, and a fading registration grid. There is no black gradient overlay; the centered white title retains a text shadow for separation. The poster caption explicitly retains its flex layout inside preset rails, overriding their generic direct-span rule so the name stays vertically centered.

All 37 public Cinema 2.0 presets use composed SVG drawings, built from four defining motifs per preset. The original ten are:

| Preset | Four primary motifs |
| --- | --- |
| Afterhours | Fixture banks · crossing laser fans · volumetric beams · stage plane |
| Ancient Machine | Layered mechanism · radial locking ribs · Oracle aperture · energy sphere |
| ATL HOE | Tiled marquee · raised letterforms · Atlanta skyline · roadside foreground |
| Crystalized | Floating crystal · cracked monoliths · spotlight shafts · wet reflections |
| Blockshift | Foreground hollow cubes · suspended cube field · LED edges · spatial depth |
| BWC | Twin conveyors · cans and creatures · energy reactor · industrial hall |
| Canopy | Overhead lattice · suspension cables · Waterfall rods · light field |
| Cathedral | Pointed arches · Gothic ribs · volumetric shafts · nave reflections |
| Constellation | Faceted elements · depth clusters · drift trails · spatial volume |
| Depth | Square portals · sparse light strips · depth lanes · vanishing-point sphere |

The original ten illustrations recreate their authored opening scenes as composed vector geometry. The first six depict the initial crossing laser banks; Oracle Lock's layered radial mechanism and spherical core; the Waffle House sign and Atlanta skyline; a floating crystal between four cracked monoliths; the staggered field of hollow LED cubes; and BWC's canning hall, twin conveyors, reactor, and rows of transformed cans. The older symbolic gear icon, isolated sign emblem, mineral burst, single impossible-cube emblem, and oversized cartoon creature have been replaced with scene compositions.

All cards use the same right-weighted oversized artwork window, individual angled camera framing, rounded-border cropping, cyan line weight, translucent surfaces, and Engine-matched background lighting. Titles retain their independent centered layout.

`PresetBlueprintArtwork.tsx` draws these motifs as original technical compositions with the Engine dropdown's cyan strokes, low-opacity facet fills, construction guides, and dashed axes. `blueprintDrawing.ts` shares the dropdown's 0.8-unit line weight; vector strokes normalize its standard 170px / 150-unit scale and remain the same visible thickness at different thumbnail sizes. All 37 Cinema 2.0 cards bypass both the captured image and contour filter. Preset titles remain centered above the art; the motif phrases are art-direction metadata, not additional text over the picture.

Presets from other engines retain cyan contours extracted from a representative renderer frame, on the same dark technical grid and restrained glow as the React Engine dropdown. Fallback artwork uses the same right-weighted, edge-cropped window. Names, accessibility labels, selection, keyboard navigation, and preset activation retain their original values and behavior.

Sound Drawing, PixGrid, and legacy React recipes use the existing lazy, cached thumbnail renderer at 480 × 270, with deterministic preview waveform, stereo, and spectrum signals so audio-driven geometry remains visible. Offscreen work remains deferred, abortable, serialized, and subordinate to the live visualizer. CANVAS, Headliner, Beam Matrix, and Show Director system previews (plus retained Cinema fallback frames) are stored in `public/preset-artwork` so browsing cards does not start additional engines. Cinema uses the native runtime; CANVAS uses its visible effect surface; Headliner uses its effect processors; LaserDMX uses its authored beam/fixture diagrams. Media-dependent previews use a neutral sample performer, never user files or camera access. Animated presets are represented by a still, not by the current playback frame.

To refresh artwork after changing authored system presets, start Vite and run `node scripts/generate-preset-artwork.mjs`. Supply preset IDs to refresh only those previews, use `--missing` to generate new entries without recapturing existing artwork, or set `DRMVYZ_ARTWORK_BASE_URL` to use another dev-server address. Missing artwork degrades to the technical background without a broken-image icon. New Cinema catalog entries need a four-motif vector composition; new entries in other engines need their preview generated with this command.

Layout Lab's existing G, H, I, and K options compare alternatives in their Inspector → Presets tabs:

| Option | Name treatment |
| --- | --- |
| G | Etched Proof — open artwork, engraved ivory lettering, offset print-registration lines, and a graphite keyline. |
| H | Refractive Glass — a cut-corner transmission lens, layered specular reflections, a cool translucent tint, and frosted artwork. |
| I | Signal Chassis — a recessed graphite rail with stepped chamfers, brushed texture, precision witness marks, and separate machined edges. |
| K | Optical Focus — feathered defocus behind luminous lettering, fine aperture arcs, and focal-plane marks; surrounding artwork stays sharp. |

These previews scope their material and framing treatments to those four Presets tabs only. Their styles live in `layoutLabPresetTreatments.css`; title typography, centering, artwork, search, scope switching, and local selection use the shared components. Production and the other Layout Lab options retain their existing treatments.

Canopy, Cathedral, Constellation, and Depth are drawn from their authored opening-scene structures rather than traced captures. Canopy starts with its 8 × 8 Waterfall rod array; Cathedral uses the Gothic aisle's receding pointed arches; Constellation starts from the sparse Crimson Collapse faceted population; Depth uses square portal rings, sparse light strips, and its matte sphere at the vanishing point. Each uses the shared right-weighted artwork window, border cropping, Engine-matched surface lighting, and normalized stroke weight.

The artwork leaves physical space for centered names rather than clearing the title with an opacity mask. Afterhours has exactly three drawn moving-head DJ fixtures: two at the upper right with different laser directions, and one at the lower left firing upward into the existing left-edge fade. Ancient Machine separates its upper mechanism and lower energy core, with a detached near-left locking wheel. ATL HOE uses a slanted two-tier marquee across the upper left, with six WAFFLE tiles above five HOUSE tiles, and three enlarged upright skyline towers filling the right and upper-right edges. Crystalized retains its main right-hand crystal and adds a visible lower-left crystal, a subdued crystal just above it, and subdued upper-left and upper-middle crystals. All geometry shares Blockshift's normalized line weight, technical facets, and translucent fills; the established Engine background and edge fade remain unchanged.

Preset names in the engine dropdown (both rails, selected trigger, open menu, and decorative echoes) use the same Manrope 400 face and .12em tracking as the reusable thumbnail name. Shared tokens live in `src/styles/typography.css`; the engine labels retain their 16px size, accent color, and placement, while thumbnail names remain white at 12px.

ATL HOE’s towers are individually stretched upward from their bases, with small independent offsets and opposing tilts. Its two-tier sign is translated exactly 12 CSS pixels left using an inverse camera transform that updates on SVG resize, independently of the buildings. A subdued outlined tree sits at the lower left inside the existing edge fade.

## Full Cinema 2.0 catalog coverage

`Cinema2PresetBlueprintScenes.tsx` supplies 27 additional scene compositions. Logo-bearing scenes reuse the shipped master vector paths as individual drawn subjects, with all fills and strokes restyled by the shared blueprint role. They do not trace pixels or render live scenes. Each composition separates foreground, peripheral, and background objects around the title, without a title-area mask. The six approved compositions and the four previously authored Canopy/Cathedral/Constellation/Depth drawings are preserved.

| Preset | Four scene subjects |
| --- | --- |
| backstreet | Neon wordmark · Glass tube returns · Brick courses · Wall mounts |
| conduit | Chrome feed tubes · Cloud core · Chamber ribs · Segmented energy routes |
| echoform | Headphone bulldog · Layered facial contours · Triangulated scan · Suspended scan points |
| echowave | Wordmark contours · Offset depth layers · Triangulated letters · Four-point focal star |
| electric-storm | Primary lightning · Branch discharges · Distant strike · Illuminated cloud shelves |
| elevhate | Vertical megastructure · Stacked crossings · Light-lined passages · Receding platforms |
| event-horizon | Gravitational aperture · Accretion disk · Orbiting fragments · Polar jets |
| glassfall | Raised triangle facets · Layered black panels · Edge light inlays · Detached foreground triangle |
| go-to | Pearl cloud sculpture · Polished outline · Turntable · Studio light cones |
| hum-n | Faceted portrait · Angular shoulders · Wire topology · Floating face panels |
| hypnotize | Curved turbine vanes · Recursive shaft · Braided conductors · Exterior resonators |
| ifrit | Extruded hex portals · Mechanical wall ribs · Segmented portal lights · Central rift |
| inertia | Dotted spherical core · Folding lattice · Hinged panel edges · Orbiting lattice nodes |
| mainframe | Raised cloud emblem · Circuit traces · Processor hardware · Radar modules |
| marquee | Art Deco canopy · Triple-face marquee · Vertical light towers · Wet street reflections |
| nightshift | Faceted disco ball · Dance floor tiles · Ceiling LED frame · Reflected light rays |
| psylo | Foreground mushroom caps · Curved stems and gills · Distant grove · Spores and mycelium |
| reactor | Procedural reactor core · Radial struts · Flying shrapnel · Impact shockwave |
| reliquary | Cut-crystal cloud · Supporting golden tree · Vine-wrapped forest · Overhead spot rig |
| say-it | Bevelled letter faces · Extruded letter sides · Independent rotations · Assembly registration |
| sixfold | Seven hexagonal cells · Mirror carriers · Optical iris · Structural locks |
| starters | Field case · Three capture balls · Case latches · Ground vegetation |
| switch-it | Horned mask · Faceted face · Portrait shoulders · Reveal fragments |
| threshold | Giant LED monoliths · Hanging field · Corridor perspective · Wet floor mirrors |
| trippy-bro | Optical fan · Crossing neon lattice · Woven lens · Luminous ribbons |
| vacancy | CRT pyramid · Rounded screen glass · Cabinet hardware · Empty brick room |
| war-of-worlds | Tripod invaders · Articulated legs · City blocks · Searchlight beams |

`node scripts/verify-preset-thumbnails.mjs` derives the review catalog from the public native registry and checks all 37 unique IDs at 240px and 160px widths. It verifies four motif groups per scene, the shared Engine line weight, translucent surfaces, clipping, title typography and centering, and unchanged background lighting. Review sheets are written to `/tmp/drmvyz-preset-review/cinema2-catalog-1.png` and `cinema2-catalog-2.png`.
