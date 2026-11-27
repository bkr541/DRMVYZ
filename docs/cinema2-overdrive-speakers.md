# OVERDRIVE acoustic driver replacement

All ten foreground acoustic assemblies now use the same owner-supplied `speaker.glb`, bundled as a Vite URL asset. The previous two alternating models are removed. The binary is unchanged, including its original copper, black and grey materials.

The driver has a native +Z open face after the GLB node transforms. Its authored orientation is preserved (no 180-degree rotation), and it is uniformly scaled to the 1.34-unit mounting diameter, centered in X/Y, and front-aligned to Z = 0.43. This retains its physical proportions and the existing tilted driver mounts. The ten instances share one decoded geometry/material set and have independent transforms under the existing pulse parents. Mechanical actuators, the ten smaller inner bearings, LED core, media modes, camera, lighting choreography and pattern controls are unchanged. Speaker motion continues through the bounded axial pulse parent (the entire imported driver moves, not an independently rigged membrane). Master intensity and Blackout attenuate the original material colors/emission without replacing the finishes.

The source is loaded once when the scene activates. Load failures are reported through the existing diagnostics; cancellation disposes any late decoded source. Scene teardown disposes the shared source resources exactly once. The supplied model has 43,840 triangles (438,400 across ten visible instances before render-pass multiplication); geometry and material sharing does not eliminate per-instance rendering work.

Focused regression: `npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2OverdrivePreset.test.ts`. The regression also decodes the actual bundled GLB and checks that camera-side rays hit the black dust cap and grey diaphragm rather than the copper rear basket. In Studio, verify ten identical front-facing drivers, Acoustic Array and Overload motion, Blackout, and switching away from and back to Overdrive. Inspect actual GPU frame time before release.

## Model attribution

[Speaker](https://sketchfab.com/3d-models/speaker-af1c249e1a494667b825a0dbd724cdff) by [Ditador_Nicastro](https://sketchfab.com/Ditador_Nicastro), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), as declared in the supplied GLB metadata. The GLB is unmodified; its orientation, scale and position are adjusted at runtime.

## Radial Overload + Blackout Reactor upgrade

The original GLB, +Z orientation, core media, camera and ten-sector mechanical layout remain intact. The previous description of unchanged lighting and whole-driver-only motion above describes the original replacement, not this upgrade.

- Radial Overload: independently addressed main driver rims, inner bearing rings, paired mechanical strips, four segmented chamber tracks and a core perimeter. Fixtures are attached to their respective articulated parent groups.
- Blackout Reactor: rear driver halos, concealed cavity and under-panel strips, outer trim, and four localized shadowless spill lights. Low quality retains all emissive choreography but suppresses the four added point lights. Master intensity and the authored palette apply to both systems.
- Design > Mechanics > Speaker Displacement controls both the visible, beat-derived diaphragm excursion and bounded housing motion. The Black and Grey meshes of the existing asset receive shared relative morph buffers, with independent weights per driver. The Copper basket is not deformed. No asset binary changes. Motion Amount zero stops the movement; pause freezes the shared performance phase. The bass effect is a visual approximation, not audio-rate physical simulation.
- Effects > Lighting adds Radial Overload, Blackout Reactor and Blackout Depth. Existing defaults and parameter IDs remain stable; the new controls default to enabled. Both lighting gains can be set to zero independently. Auto Performance uses the existing mood and event rules, with additional local peak, tension and calm drives.

All twelve existing pattern IDs are preserved. Core Lock breathes; Piston Wave chases along the arms; Counterforce alternates sectors; Compression converges and Expansion radiates; Acoustic Array favors the speaker bank; Core Fracture splits sectors; Energy Relay transfers energy outward; Iris alternates opposing banks; Vortex spirals; Overload combines broad impact and traveling accents; Blackout extinguishes most emission and permits brief musical reveals. Bass/kick favor the main speaker bank, snare accents the inner rings and panels, highs/mids excite the strips, and phrase/build/drop signals modulate the ensemble. All inputs come from the existing shared choreography routes and beat clock.

Focused verification: run `npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2OverdrivePreset.test.ts` and inspect all twelve patterns in Studio with a bass-heavy track. Check the lighting sliders, pause/seek, silence, low quality, casting, and repeated preset activation. Confirm the new fixtures remain clear of moving geometry at the extreme control settings and inspect GPU frame time before publishing.
