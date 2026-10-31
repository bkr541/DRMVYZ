# Trippy, Bro — reference rework, revision 4

The October 31 audit found a visual fidelity failure in revision 3: independent geometric drawings with generic dissolves did not reproduce the reference's changing occupancy, luminous hierarchy, internal articulation, or staged transformations. The earlier automated checks established functionality, not reference fidelity. This rework addresses all five requested fixes. The approved bold stroke weight, fixed center, and uniform oversized framing are retained.

Reference: `/Users/kodyrobinson/Desktop/TrippyBro.mov` (12.135 seconds). Rejected implementation recording: `/Users/kodyrobinson/Desktop/current_tb.mov` (10.723 seconds). Reference behavior was inspected across both complete recordings and at 12 fps through key transitions. These recordings establish the visual target; their music was not used to invent alternate beat/event analysis.

## 1. Internal motion and the reference families

The main renderer was rewritten around components and shared luminous strokes.

- **Prism Lattice:** independently traveling line banks, changing subdivision brightness, compression, rotating square/diamond collars, moving edge highlights, an orbit, and articulated cardinal jewels. The image moves between open scaffolding and a denser luminous enclosure rather than translating a uniformly lit grid.
- **Golden Fold:** four amber-dominant segmented combs open and compress. Individual contours illuminate in a traveling sequence; an inner crossing emerges through the aperture. It is a transition-capable mechanism, rather than a static nested outline.
- **Quad Bloom:** four fans have independently phased sector direction, changing sector aperture, variable spoke reach, wedge filling, and an authored dim phase. Connecting diagonals remain visible when the spokes recede. Rings and hubs retain the four-part spatial structure.
- **Neon Cross:** broad cyan/blue ribbons grow outward from a bright center, with moving illumination and outward chevron banks. The hero is a substantial X rather than a stack of uniformly lit lines.
- **Liquid Weave:** two perpendicular mirrored curve families form pinched lobes around the central anchor. Curvature and envelope change together; satellites and border accents support the same composition. The former single horizontal sine-wave bundle is removed.

The three supplemental patterns remain selectable. They now use the same emission profile, animated occupancy, local contour echoes, and geometric anchors. Automatic progression prioritizes the five reference families in their reference-like order: lattice → fold → fans → cross → weave → lattice. Selecting a supplemental pattern manually works immediately; the next qualifying selected Trigger returns to the core cycle. This behavior is stated in the Pattern Change description. The dropdown still exposes eight genuinely distinct patterns and all 11 canonical Trigger options.

No automatic cycling occurs while Pattern Change is OFF. Fresh authored defaults store Bar as the trigger; existing saved trigger selections remain authoritative. A specific clip loop is not a second musical clock: actual switching still uses shared qualified musical events.

## 2. Component transitions

The fixed 180 ms whole-image crossfade is removed. Handoffs last 480 ms normally, 640 ms when a fan family participates, and 560 ms for the woven family. Transition progress comes from shared transport time, holds while paused, and resets at discontinuities.

For the first 43% of a handoff, outgoing components retract toward the center. Radial reach and reveal gates withdraw component banks at different ranks. The central jewel remains. After that handoff point, the incoming family unfolds outward using its own geometry and staggered reveal gates. At no point are two complete opaque drawings dissolved together.

Manual selection, permission changes and manual takeover remain immediate. A new event during an unfinished handoff starts from the previous performing family, without carrying a stack of older images. Underlying Pattern Change and temporary Auto Performance authority are unchanged.

## 3. Luminous rendering

Strokes accumulate colored bodies, narrower bright cores, and soft colored halos. Tone mapping happens once after accumulation. The six editable palette roles remain actual consumers; the Highlight role owns the pale core color. This preserves color separation, bright peaks, and black gaps instead of giving every line the same flat intensity.

The default Bloom amount increases from 0.22 to 0.42. It governs both native stroke halos and the existing shared bloom pass; zero removes those halos and bypasses shared bloom. Native bright stroke cores remain readable with effects off. Master Intensity scales the final emitted artwork and gates shared finishing so zero cannot leave retained light behind.

There is no full-frame flash effect. Peaks are localized to active geometry, hubs, intersections and ribbons.

## 4. Supporting accents and persistence

Faint gray rings are replaced by luminous jewel coronas, small radial tick clusters, moving orbit tracers and family-specific connectors. Their positions and brightness follow the active structure. Secondary Detail zero removes optional coronas, tracers and connectors without disabling the hero.

Geometric Echo no longer samples two complete scenes. It places two bounded, faint distance-offset contours directly beside eligible moving outlines. The default is 0.2; zero removes both. Shared Trails remains available as a separate user effect.

A topology change must not reintroduce a previous drawing through feedback. The preset authors a hidden runtime-only reset trigger bound to the shared Trails effect. The module dispatches it on discontinuities, selection changes and each staged handoff frame through the canonical typed target resolver. Existing history is cleared before the next topology is presented.

This requires one small generic module API addition: `targets.dispatchBoundAction(name, eventId)`. It resolves only an explicitly authored action binding on the calling module. Unknown action names return null; no guessed target IDs or preset-specific behavior are added to shared runtime code. A focused runtime test verifies that bound actions reach canonical handlers and unbound actions do not dispatch.

## 5. Moving acceptance, not just contact-sheet acceptance

The new runner `scripts/run-cinema2-trippy-bro-rework.mjs` drives the real production runtime using shared Music Intelligence publications. It captures:

- Five advancing checkpoints for each of the eight families, checking frame change, occupied pixels and bright highlights.
- A nine-second, 12 fps core-family sequence driven by canonical events, including intermediate withdrawal/unfolding frames.
- A fan handoff strip and motion contact sheets for inspecting articulation and the temporal light hierarchy.
- Width, density, scale, detail, bloom, echo, separation and palette consumers; zero-speed, zero-motion and zero-emission behavior.
- A shared-Trails endpoint comparison proving the outgoing topology does not remain after the handoff.
- Square, landscape and portrait output, module/effect diagnostics and disposal.

Outputs are under `artifacts/cinema2-trippy-bro/rework/`. `reference-rework.mp4` is a silent visual review sequence, not a recording synchronized to the reference soundtrack. Its event schedule exists only in the test harness. The reference movie and rejected recording remain the comparison targets; passing image-change metrics alone is not a claim of artistic parity.

The existing production acceptance runner retains coverage for all 11 trigger events, manual edits, temporary override restoration, timing, audio envelopes, effects and lifecycle. It is updated for the longer handoff durations and five-family automatic cycle.

No UI typography or unrelated workspace code is changed by this rework. Existing working-tree changes belonging to other work are preserved. No commit was requested.

## Validation evidence

- Thirteen focused preset/controller and module-runtime tests passed. These include staged progress, the reference-family cycle, immediate manual edits, bound action dispatch and rejection of unbound actions.
- TypeScript checking and focused ESLint checks passed for the changed runtime, shader, preset, tests and harness files.
- The rework browser pass captured 40 moving family checkpoints and a 108-frame staged sequence, verified every exposed geometry/effect consumer and all six colors, and checked motion/master zero semantics, three aspect ratios and disposal. All eight families had measurable internal frame changes and localized bright highlights.
- The completed Trails endpoint exactly matched a clean manual selection of the incoming family (`historyEndpointDifference: 0`), proving that outgoing full-scene silhouettes were absent at the endpoint.
- The broader musical regression passed all 11 trigger cases, real dropdown interaction, sync behavior, audio envelopes, vocal restraint, missing-analysis/transport/reset cases, effect extrema and re-entry before reaching an outdated build-expiry wait assertion. The wait was corrected to include the new staged return duration; only the affected authority cases were rerun.
- `reference-comparison.png` compares representative reference/rejected/rebuilt frames. `fan-handoff.png` and `sequence-contact-sheet.png` show intermediate states. `reference-rework.mp4` shows the rebuilt sequence; `reference-beside-rework.mp4` places the reference on the left and the rebuild on the right with independent event timing.

The captures and transition strips were visually inspected against the reference's light hierarchy and movement vocabulary. They show brighter cores/halos, fan sector articulation and dim phases, component withdrawal/unfolding, and mirrored woven lobes. This is evidence for the requested corrections, not a claim of identical source pixels or a replacement for the user's visual judgment. The test environment did not expose GPU timing; no hardware frame-rate guarantee is made.

The final authority-only rerun passed override restoration, bounded build expiry and paused takeover (`artifacts/cinema2-trippy-bro/acceptance/report-authority.json`). No application code change was needed for that assertion correction. All requested code changes and focused checks are complete; the new visual sequence is ready for user review. Changes remain uncommitted.
