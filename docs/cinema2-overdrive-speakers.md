# OVERDRIVE acoustic driver replacement

All ten foreground acoustic assemblies now use the same owner-supplied `speaker.glb`, bundled as a Vite URL asset. The previous two alternating models are removed. The binary is unchanged, including its original copper, black and grey materials.

The driver has a native +Z open face after the GLB node transforms. Its authored orientation is preserved (no 180-degree rotation), and it is uniformly scaled to the 1.34-unit mounting diameter, centered in X/Y, and front-aligned to Z = 0.43. This retains its physical proportions and the existing tilted driver mounts. The ten instances share one decoded geometry/material set and have independent transforms under the existing pulse parents. Mechanical actuators, the ten smaller inner bearings, LED core, media modes, camera, lighting choreography and pattern controls are unchanged. Speaker motion continues through the bounded axial pulse parent (the entire imported driver moves, not an independently rigged membrane). Master intensity and Blackout attenuate the original material colors/emission without replacing the finishes.

The source is loaded once when the scene activates. Load failures are reported through the existing diagnostics; cancellation disposes any late decoded source. Scene teardown disposes the shared source resources exactly once. The supplied model has 43,840 triangles (438,400 across ten visible instances before render-pass multiplication); geometry and material sharing does not eliminate per-instance rendering work.

Focused regression: `npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2OverdrivePreset.test.ts`. The regression also decodes the actual bundled GLB and checks that camera-side rays hit the black dust cap and grey diaphragm rather than the copper rear basket. In Studio, verify ten identical front-facing drivers, Acoustic Array and Overload motion, Blackout, and switching away from and back to Overdrive. Inspect actual GPU frame time before release.

## Model attribution

[Speaker](https://sketchfab.com/3d-models/speaker-af1c249e1a494667b825a0dbd724cdff) by [Ditador_Nicastro](https://sketchfab.com/Ditador_Nicastro), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), as declared in the supplied GLB metadata. The GLB is unmodified; its orientation, scale and position are adjusted at runtime.
