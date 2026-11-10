# SUBMERGE

SUBMERGE is a native Cinema 2.0 preset. One or two lines of beveled, extruded 3D lettering float in a submerged colonnade with moving caustic light, depth haze, suspended particles and rising bubbles.

- **Master Controls** provides Motion Amount, BPM Sync, Auto Performance and Motion Safety. Lock Off holds the letter and architecture geometry in place.
- **Design** provides Line Mode, Line 1, optional Line 2, alignment, tracking, line spacing, glyph scale, letter depth and three finishes (glazed ceramic, metal and frosted glass). Environment controls set buoyancy, architecture visibility, caustics, haze, particles and bubbles. The bundled glyphs support printable Basic Latin, with up to 12 characters per line and 20 total. Clearing both displayed lines restores the SUBMERGE wordmark.
- **Effects** provides Pattern, Pattern Change and the standard Trigger dropdown, plus Trails, Depth of Field, Bloom and Cinematic Finish. Pattern Change is off by default and defaults to Every 4 Bars when enabled. The shared musical event resolver advances through a shuffled cycle and keeps the authored selection for recall.
- **Palette** provides Water Tint, Letter Tint and Edge Glow. Source and Pool use the shared Text Scenes library. Apply migration `0045_cinema2_submerge_text_scenes.sql` to enable account sync for SUBMERGE scenes and pools.

| Pattern | Letter and environment movement |
| --- | --- |
| Suspension | Small buoyant letter drifts and slow movement in the arches |
| Pressure Wave | A bass-driven depth wave across letters with successive expansion of the arches |
| Undertow | Staggered sideways and depth pulls through the glyphs and columns |
| Crosscurrent | The two lines drift in opposite directions as neighboring arches counter-rotate |
| Vortex | Letter faces follow bounded circular paths as the colonnade twists |
| Upwelling | Lift passes across the glyphs and arches as the bubbles rise faster |

Cinema's choreography routes smooth the bass, mid, high and energy signals. Bass increases geometric displacement, mids intensify caustics, and highs and transients accent bubble motion. Phrase and drop events add bounded camera accents. Authored values stay separate from transient performance values.

`node scripts/verify-cinema2-submerge.mjs` exercises the native WebGL runtime and writes review captures to `artifacts/cinema2-submerge/`. Run the shared Text Scenes browser review with `CINEMA2_TEXT_REVIEW_PRESETS=submerge` to exercise the Source editor and Pool.
