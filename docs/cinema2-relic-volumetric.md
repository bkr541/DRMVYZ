# REL-01: Relic volumetric sculpture

Relic retains its existing manifest, parameter IDs/defaults/ranges, palette, camera, module ID, beat clock, Pattern Change resolver, and Auto Performance ownership. No user media or model slots are introduced. Seraph, Paradox and Monolith keep the existing truss render path. The renderer resource lease owns all solid geometries and materials; the new meshes are built once, with group matrices updated from the same pose as the channel geometry.

## Pattern vocabulary

| Existing ID | Physical behavior |
|---|---|
| dormant | Mostly assembled, small jaw aperture, restrained internal light |
| awaken | Progressive opening and stronger socket energy |
| roar | Large articulated jaw aperture |
| fracture | Paired crown, cheek and jaw plates move apart |
| reconstruct | Separated regions cycle back toward assembly using shared phase |
| possession | Moderate separation, oscillating jaw and strong energy |
| siege | Open jaw, expanded containment arcs |
| cataclysm | Pulsing separation and maximum bounded charge; no full-scene white emission |

Build remains `fracture`, drop remains `cataclysm`; existing transitions, manual selection, Trigger and Auto ownership are unchanged. Shared motion safety, silence, musical phase, kick, bass, snare, vocal presence and drop signals drive the authored pose. No new analysis or clock.

## Parameter-to-output changes

All ranges, defaults and persistence remain those in `ArtifactSpecs` and `Cinema2ArtifactPresets`.

- Skull Scale applies to the entire animated skull/rings, subject to a common safety fit at simultaneous extremes. Jaw Opening, Jaw Motion Speed and Jaw Reactivity rotate the complete mandibular assemblies and their teeth about the rear hinge.
- Cranial Articulation, Head Rotation, Fragment Separation, Fragment Rotation and Reconstruction Speed affect the rigid crown/face/jaw plates and matching light channels. Ring Speed and Ring Separation affect the segmented rail sweep and deployment. Ring Enable removes the optional rings, not the skull.
- Eye Socket Intensity controls the recessed lens and orbital strip; Core Scale controls lens size and Core Intensity controls internal light. Strand Thickness controls channel width; Density controls sparse secondary accents. The existing structural and core palettes remain independent, with Relic-specific material attenuation rather than saved color changes. Intensity and Projection Intensity still control existing illumination; bloom/atmosphere/finish remain shared effects. Camera authority is unchanged.

## Acceptance follow-up

Run `npm run typecheck`, `npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2ArtifactPresets.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2RelicVolumes.test.ts`, `npm run build`, and `CINEMA2_ARTIFACT_PRESET=relic node scripts/run-cinema2-artifacts-browser.mjs`. The production harness captures the eight patterns, motion, no-rings view, effects-off, color changes, music, camera and aspect-ratio checks. Compare with the unmodified source at identical viewport/quality and inspect clipping, brightness, skull readability, jaw and reconstruction; verify the performance budget and run the full family harness before release. The catalog thumbnail must be recaptured from the approved real render, not from a synthetic illustration. No visual capture or GPU benchmark was possible in the patch environment (npm registry unavailable).
