# LIVEWIRE

LIVEWIRE puts an editable, wide, machined wordmark over a dark wet stage. The hero is a single phrase with short cyan bars recessed into its faces, faint cool bevel highlights and broken floor streaks. The reference's selective illumination, darkness and floor are mandatory. The exact reference text, outline proportions and cyan hue are inspiration. LIVEWIRE starts on one line with `LIVEWIRE` and supports two lines through the shared Cinema 2.0 text layout. Its original angular glyphs are authored from strokes in the repository. Robot Renegades Regular informed the proportion and angled joins. The packaged font and its outline data are not used.

The camera is nearly head-on, above the floor with reflection space below the baseline. The frame keeps the complete text within view. Each glyph uses a continuous hull and two stepped face profiles. The outer silhouettes have angled chamfers, the counters stay open, and the LEDs sit inside cut recesses. The gunmetal shader varies color and roughness in glyph space and uses the live LED program to add narrow spill along each lit channel. The floor uses the shared wet-concrete surface with restrained streaking and low fill.

The metal stays in place as LED segments move. With no active audio the wordmark holds its sparse pattern, with a chosen primary edge per glyph. A kick runs along the bars, a snare accents upper segments, and high-band transients add a short sweep. Energy and bass vary the extent of the lit regions. Vocal presence pulls the sweep back to keep the lettering readable. The Visual Director's build widens the lit region and a drop lifts selected bars at the outer edges while bloom releases. These accents modulate the current pattern. The base pattern changes only through its manual control or the shared Pattern Change controller.

## Pattern library

| Pattern | Native LED arrangement |
|---|---|
| Trace | Selected top and side bars carry a traveling highlight. |
| Relay | A moving bank travels from one end of the word to the other. |
| Split | The word's two halves alternately light, with different inner and outer accents. |
| Crown | Upper bars stay prominent with weak, intermittent lower accents. |
| Groundline | Lower bars take the lead and send the brightest reflections toward camera. |
| Crossfire | Two banks travel toward one another across opposing sides of the word. |

## Control and authority specification

| Group | Authored controls | Shared audio / director / Auto Performance | Manual behavior |
|---|---|---|---|
| Master Controls | Motion Amount, BPM Sync, Auto Performance | Motion Amount scales LED movement and musical accents. Auto Performance uses the user's System Settings default. | BPM Sync and Auto Performance stay editable. Other controls lock while Auto Performance is on. |
| Design / Layout | Line Mode, Line 1, Line 2, Alignment, Tracking, Line Spacing, Letter Scale | Parameter State owns text and layout. Transient signals do not write either. | Locked while Auto Performance is on. |
| Design / Lighting | LED Coverage, LED Intensity, Sweep Period, Letter Roughness | Mood activity raises coverage and shortens the sweep. Silence withdraws performance activity. Music events change which bars carry a pulse. | Locked while Auto Performance is on. |
| Design / Pattern | Pattern, Pattern Change, Trigger | The shared resolver supplies the effective toggle and trigger while music and Auto Performance are active. The canonical controller suppresses duplicate and stale events. Builds and drops accent the current pattern. | With Auto Performance off, Pattern edits take effect immediately and leave Pattern Change alone. Trigger is visible when the saved toggle is on. |
| Effects | Floor Reflection, Floor Roughness, Bloom and Cinematic Finish | Mood peak raises bloom within its range. The depth-aware floor runs before bloom and reflects active LED geometry. | Locked while Auto Performance is on. |
| Palette | Background, Metal Tint, LED Color and Floor Tint | Each is an independent authored color. | Always editable. |

BPM Sync follows the shared Cinema 2.0 beat clock when both host and preset BPM Sync are enabled. Turning sync off uses the clock's continuous 120 BPM reference rate for the LED sweep. Shared musical events retain their identities in either mode. Paused transport holds the visual pose. Track changes, seeks, loops, context recovery and re-entry reset transient timing through the shared typography lifecycle.

| Mood drive | Target baseline | Source and direction | Bound |
|---|---|---|---|
| Coverage | 0.45 | Activity adds up to 0.22. Silence subtracts up to 0.4. | 0.08–1 |
| Sweep Period | 4 | Activity subtracts up to 1.5 reference seconds. | 2–12 |
| Bloom | 0.45 | Peak adds up to 0.26. Silence subtracts up to 0.25. | 0–1.5 |

Audio Intelligence owns signal and event publication. Visual Director owns musical structure. Choreography owns the envelope routing. Mood Conductor contributes transient effective values to declared targets. The text module owns geometry, bar shading and the bounded display of the selected pattern. The native effects graph owns the floor and finishing passes.

## Acceptance

Run `node scripts/verify-cinema2-livewire.mjs` for the production WebGL check. It writes captures and results to `artifacts/cinema2-livewire/`. The checks cover System Settings defaults, custom text, two-line layout, six pattern renders, palette and effects, trigger deduplication and manual Pattern preservation, a 72 BPM versus free-running sweep, scripted build/drop, pause and context recovery. The `dvydrm` capture uses the text in the reference. The `metal-without-leds` capture isolates the geometry and material with LEDs and bloom off. The catalog poster uses the default render.

LIVEWIRE is available as a reference entry pending human visual and musical acceptance. The shared Inspector currently adds the live policy note only when a choice exists, so its existing reserved-slot test fails. That shared layout behavior needs resolution before final contract acceptance.
