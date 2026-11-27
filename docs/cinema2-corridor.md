# Corridor

First-party Cinema 2.0 preset based on the approved reference and authority matrix.

## Reference and visual target

The 6.51-second source is a portrait screen recording. The first ~2.4 seconds and the final ~0.8 seconds show the corridor. The middle shows a separate tiled-video effect. The corridor shots establish a four-sided rectangular passage, deep black vanishing point, warm rectangular fixtures, small illuminated markings, and an accelerating sense of forward travel from the spacing and passing of the near panels. There is a brief near-black passage and a brighter shot where synchronized panels outline a complete bay. The camera stays near the center and rolls slightly.

The mandatory target is a dark, enclosed rectangular corridor with four independently addressable panel banks, sparse warm illumination in all four planes, and a legible central void. Repeating bays must recede in real 3D. A bright cue briefly joins the banks at one depth, then restores shadow between bays. Preserve the difference between a sparse panel chase and a synchronized frame. The source's feed, captions, watermark, separate tiled-video scene, audio recording, and exact symbol artwork are excluded.

The roughly square interior has four continuous graphite wall planes (left, right, ceiling and floor), 12 recycled depth bays at fixed spacing, and a far-end black falloff. Each bay has four individual extruded cassettes per wall (192 in total), with illuminated fixtures and restrained original maintenance markings in selected slots. Each rigid housing has deterministic width, length and thickness variation, a telescoping mount, a beveled metallic lip, a physically recessed secondary LED channel, and a raised diffuser. A continuous wall backing remains in place behind moving modules. The sidewalls receive a bounded shader approximation of neighboring panels’ warm spill; the shared HDR bloom graph remains the only post glow. A corner gutter prevents intersecting adjacent banks at full travel. The floor is satin graphite with recessed panels and local sheen. Amber bodies, selective ivory cores, and occasional red-orange markings reproduce the source's warm hierarchy. The set uses depth haze and controlled bloom, with an open central sightline.

The camera faces down the passage from near the center line. Keep the vanishing point inside the middle tenth of the frame at 16:9, 1:1, and 9:16. Reframe via the shared world camera. Prefer bounded forward motion and bank parallax over rapid spins. Camera roll is limited to ±7° and lateral travel to 8% of the wall half-width. At Motion Amount zero, the camera and the authored panel pose hold. Stop and resume retain the appropriate pose. Recycle bays behind the near plane so a seam never crosses the viewport.

## Corner rails and faster flight

Both Corridor variants now multiply the previous axial travel coefficient by 2.5, including existing saved Transit Rate values; the slider maximum is 3.6 (five times the former maximum speed at equal tempo and Motion Amount). Pattern phase, media cadence, pause, BPM Sync and discontinuity handling are unchanged. Four physical diagonal corner diffusers run along the wall/ceiling and wall/floor joins, one per corner in each recycled bay. Their color and brightness use the same pattern selection, palette, density, intensity, kick/build/drop envelopes and depth fade as the cassettes. Interpolated bay-center levels avoid hard seams as the passage recycles; the existing bloom and finish treat the rails as unprotected native lighting. The mesh adds only 288 vertices, no extra draw call or textures.

## Pattern library

| Pattern | Visible behavior |
| --- | --- |
| Night Transit | Sparse, irregular tile lights travel down all four walls with substantial dark gaps. This is the authored default. |
| Relay | A narrow bank moves down successive depth bays, passing from left to ceiling to right to floor. |
| Counterflow | Left and right banks chase in opposite depth directions while the ceiling and floor trade brief accents. |
| Shaft | Ceiling and floor form parallel lanes that contract toward the vanishing point while the side walls stay sparse. |
| Signal Fault | Isolated tiles break into uneven two- or three-tile bursts with darker intervals and a visible far guide. |
| Gate | A complete square band forms across the four surfaces at one depth and passes toward the viewer, separated by dark bays. |

Pattern Change defaults off. Trigger uses the exact eleven shared options and remains conditional on the saved Pattern Change setting. A manual Pattern edit establishes the base immediately and leaves Pattern Change on when already enabled. The active event cannot advance the new base a second time. The next fresh qualifying event can advance it. Auto Performance uses the shared Mood Conductor and pattern-control resolver for the effective toggle and trigger. Builds and drops add bounded accents to the current pattern and do not substitute another pattern or write saved values.

## Authority matrix

| Property | Manual control | Audio modulation | Visual Director | Auto Performance | Manual edit behavior |
| --- | --- | --- | --- | --- | --- |
| Authorization | Auto Performance, BPM Sync | Shared transport and Audio Intelligence | Shared section and moment publication | Initial per-preset state follows System Settings | Both toggles remain editable |
| Motion strength | Motion Amount | Scales translational motion, roll and musical accents | Scales the short drop advance | Scales the declared Mood drives | Locked while Auto Performance is on |
| Layout | Corridor Width | None | None | Authored orientation and composition stay in place | Locked while Auto Performance is on |
| Travel | Transit Rate, Camera Roll | Bass adds a bounded pulse to the transit distance and extends groups of panel pistons | Build tightens the stream; drop adds a short forward push | Activity accelerates transit within its range | Locked while Auto Performance is on |
| Panels | Panel Density, Panel Intensity | Energy recruits tiles, kicks accent the nearest floor and wall bays and actuate groups of panel pistons, highs add brief upper details, vocals lower competing tile activity | Builds recruit successively nearer bays and gradually extend the rigid housings. A drop briefly creates one complete warm ring while keeping the rest of the passage selective | Activity increases density, silence reduces it below the authored value | Locked while Auto Performance is on |
| Pattern | Pattern, Pattern Change, conditional Trigger | Canonical event IDs qualify automatic changes | Build and drop affect the look temporarily | Shared resolver chooses effective Pattern Change and Trigger with the beat grid; authored values stay intact | Locked while Auto Performance is on; manual edit with it off does not change Pattern Change |
| Finish | Bloom, Depth Haze | Short controlled highlight accents | A drop lifts bloom on the lit ring | Peak lifts bloom, silence lowers it | Locked while Auto Performance is on |
| Colors | Void, Wall Metal, Panel Amber, Panel Hot, Markings | Signal changes coverage and intensity while retaining the authored colors | None | No color ownership | Always editable |

## Timing and modulation

With host and preset BPM Sync enabled, the shared Cinema 2.0 beat clock drives axial travel and panel chase phase. With preset sync off, the same motion advances at its authored fixed reference rate. The clock eases between modes and maintains phase. Shared kick, transient and section events retain their identities in either mode. The panel mounts consume the existing smoothed bass route, once-per-event kick envelope, and director build route; the build adds a slower 650 ms attack and 320 ms release (time constants). Adjacent pairs of lanes and bays share deterministic motion weights. The maximum inward projection is 19% of the corridor half-width, including the fixed housing thickness; the module geometry is drawn with the existing single static buffer and draw call. Auto Performance off, Motion Amount zero, idle and discontinuity return the mechanical accents to the authored baseline, while pause holds them. When idle, hold an authored sparse amber pose with a visible distant guide. Start the chase with active playback. Pause freezes the scene. Track change, seek, loop, preset re-entry, and context restore follow the shared transport discontinuity rules and reset deterministic transient envelopes. Silent stops hold the current pattern and reduce coverage with the conductor's silence state. A drop remains eligible to release that state.

| Mood drive | Authored baseline | Contribution at full Motion Amount | Runtime bound |
| --- | --- | --- | --- |
| Transit Rate | 1.25 | Activity adds up to 0.45 | 0.2–3.6 |
| Panel Density | 0.38 | Activity adds up to 0.25. Silence subtracts up to 0.31. | 0.05–0.85 |
| Bloom | 0.36 | Peak adds up to 0.25. Silence subtracts up to 0.25. | 0–1.2 |

## System ownership and acceptance

Audio Intelligence publishes continuous and discrete signals. Visual Director publishes structural meaning. Choreography owns the timing and routing of accents. Mood Conductor supplies the effective controls and bounded drives. Parameter State owns persistent user values. The native world module owns geometry, panel materials, and bay recycling. The shared camera and post graph own projection, depth and finish. Design controls live under Master Controls, Design, Effects, and Palette.

First validate the static atmosphere and the vanishing point on the production canvas. Then validate motion and every manual control, followed by the six distinct patterns, all shared triggers, fresh and duplicate events, manual base selection, the system default, real Inspector lock and live readout behavior, BPM Sync transitions, build and drop, pause and silence, seek and re-entry, context recovery, and wider and portrait framing. Capture sparse, off, and bright gate states for human visual acceptance against the reference.

## Production review

Run `node scripts/verify-cinema2-corridor.mjs` to render the registered native preset, exercise its Inspector and audio behavior, and write the review captures to `artifacts/cinema2-corridor/`. The script covers all pattern looks, both System Settings defaults, palette and effect consumers, authored and music-selected Pattern Change authority, playback and 72 BPM timing, cue deduplication, pause, seek, silence, square and portrait, and WebGL context recovery.

Corridor is selectable in the production registry as a reference entry pending human visual and live musical review. The current shared Inspector inserts its live policy text as it appears. Its existing reserved-slot test is a shared spacing limitation. The real-browser review checks the displayed policy, Trigger visibility, and which controls are locked.

## Optional user media

The Source tab uses the same shared Media Library as EVERYWHERE, including collections, favorites, named pools and Make Active / Add to Pool actions. The optional Panel Media slot accepts images, SVGs and videos; no selection leaves the original procedural corridor intact. Selecting an individual item deactivates the shared active pool. Activating a pool takes precedence over the individual feed; unready channels use the original lighting rather than blanking the passage. Clearing the pool restores the individual feed if one remains assigned.

Media uses three roles: native lighting, dedicated displays (full diffuser aperture) and hybrids (contained artwork with a wider reactive surround). Across 12 bays, exactly 48 of 192 fixtures are eligible (25%); Gate concentrates eight into alternating bays, leaving the intervening bays entirely procedural. No geometry or quality-tier change is needed. Roles use world bay, bank and lane, not recycled slot, intensity or a phase-dependent random value. Hybrid aperture opens from .285 to .365 normalized face half-width during the shared drop in the near field; Relay also opens along its existing directional phase wave. This resizes the entire contained picture, not its source exposure. The lighting envelope continues to drive the native fixture and reactive border, but does not gate artwork opacity: a dark fixture can still show its assigned image. Content is aspect-contained, using the orientation of each physical bank; straight alpha exposes the native diffuser, while opaque black and contained letterbox bars stay black. Canonical display-encoded RGB is preserved at near distances and fades neutrally beyond four world units before the existing far aperture fade. The existing bay recycling, build extension, kick response and drop ring are unchanged.

COR-01 uses the single direct, opaque world pass's intermediate alpha as **unprotected coverage** (1 = native fixture, 0 = opaque artwork; fractional values follow the source alpha and diffuser antialiasing). The HDR bloom composite and cinematic finish opt in via an authored `protectMedia: 1` (unitless 0–1, default 0 for other presets, not an Inspector control). Bloom reduces incoming glow only at protected pixels; finish bypasses grading there and restores final alpha to 1. No global brightness, bloom threshold, timing, media slot or saved parameter changes. The existing Panel Intensity and Bloom controls continue to affect the fixtures, and Depth Haze controls distance falloff. This mask contract depends on the single direct world layer and enabled final finish pass; it must not be used as ordinary transparency or routed through a layer compositor. No new user controls or migrations are needed.

| Pattern | Picture placement | Default pool cadence |
| --- | --- | --- |
| Night Transit | Staggered dedicated/hybrid lanes across all banks | Phrase |
| Relay | Diagonal display heads and hybrid apertures opening in a directional wave | Phrase |
| Counterflow | Alternating left/right two-panel banks, with ceiling/floor hybrids | Phrase |
| Shaft | Paired ceiling/floor ribbons; side walls entirely native | Phrase |
| Signal Fault | Stable paired islands; neighboring lamps glitch, not picture identities | Phrase |
| Gate | Hero clusters of eight panels on alternate bays; intervening bays entirely native | Phrase |

Dedicated screens retain the original aperture and reactive recessed LEDs. Hybrid screens reserve a larger illuminated perimeter and retain opaque source colors inside the aperture. The existing shared drop envelope widens nearby hybrids to full aperture without selecting new pictures or changing the pattern. The existing `program` enum value now uses the canonical phrase event (shared 16-beat fallback where provided by the resolver); explicit saved triggers retain their behavior. No new parameter, saved schema, or independent scheduler is introduced. A pattern change does not re-arm the pool unless the effective pool cadence actually changes.

The Design > Panel Media > Pool Trigger control overrides the program cadence with canonical musical events, independently of Pattern Change. Pool playback uses the existing three-channel runtime, with event deduplication, asynchronous replacement, last-good-frame retention and scoped cleanup. A pool larger than three items rotates through its remaining items on successive eligible events. Pause holds pool videos and sequencing; no motion or automatic silence suppresses advancement. Existing System Settings and Inspector locking remain authoritative.

Review on the production canvas with no media, an individual transparent SVG, portrait and landscape images, a video, two- and five-item pools, and a missing/unready feed. For each pattern verify visible artwork among the existing lights, pool advancement, manual Pattern Change independence, pause, seek, context recovery, and return to the original visual after clearing media.

COR-01 regression: `node scripts/verify-cinema2-media-readability.mjs` compiles the actual Corridor fragment, HDR bloom composite and finish shaders with fixed face inputs. It checks original RGB, inactive fixtures, pink/white drop lighting, black and straight-alpha artwork, missing feeds, and opt-in protection with a synthetic neighbouring halo. The full production review remains the acceptance path for actual world geometry, source selection, pools, motion and human visual approval.
