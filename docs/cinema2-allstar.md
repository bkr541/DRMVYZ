# ALLSTAR — native Cinema 2.0 review preset

## Behavior specification (reference video)
Sixfold, centered, metallic hexagonal corridor. Recycled world-space segments with recessed fixtures, layered rails, panel details and independent emissive polygon/star frames at separate depths. Magenta architecture, cyan geometry, white accents, purple atmosphere. No screen-space kaleidoscope or video texture. Subtle camera sway; no orbit. Default appearance must be recognizable with audio and post-processing disabled. The visual vocabulary is original; the reference is the acceptance baseline.

Ownership: shared bridge/director/conductor/clock/choreography/targets/Inspector/render graph own music, parameter state, automation and output; ALLSTAR owns geometry, materials, addressable fixtures, pattern transitions and visual mapping. No new music detection or shared engine changes. Manual dimensions, palette and hard permissions remain authoritative. Runtime pattern progression never writes saved state. Audio and mood contributions are bounded by authored controls. Reflection is analytic local metallic response, not ray-traced reflection.

Pattern vocabulary: Infinite Passage (architecture-led), Star Eruption (large nested stars), Fractured Prism (separated chevrons), Recursive Chamber (nested polygon chambers), Dark Aperture (selective darkness), Chromatic Relay (sector chase), Counterphase (opposing shapes), Morph Cascade (depth-staggered deformation), Depth Surge (accelerated waves), Segmented Pulse (short fixtures), Geometric Convergence (collapse/reopen), Radiant Discharge (layered peak). Pattern Change uses all canonical shared triggers; new build/drop identities may temporarily override without stealing the runtime base. Shared clock synchronizes traversal; no-track idle is subdued, pause freezes, discontinuities reset.

Manifest descriptions/defaults/ranges and module bindings are the authoritative parameter-to-output map. The manifest's named continuous lanes and event envelopes are the audio mapping; mood drive targets and amounts are the authority matrix for automatic numeric modulation. Flash Off forbids flash accents; geometry/fixture/rail/camera Off is a hard permission. Lock Off freezes spatial animation. Seven distinct palette roles remain editable during Auto Performance. All effects reuse the shared graph.

Release gate: reference/review role only until real production canvas control sweeps, audio/pattern/transport tests, Inspector layout/authority tests, aspect ratios, performance, and human comparison against the supplied clip pass. No legacy port comparison applies. Do not promote to keeper merely because unit tests pass.

## Validation and review commands

- `npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2AllstarPreset.test.ts`
- `npm run test:e2e:cinema2-allstar` (production-runtime capture harness, native parameter/palette sweeps, shared Trigger events, Inspector lock, re-entry and resize; requires installed dependencies and Chromium). Capture output goes to `artifacts/cinema2-allstar/acceptance`.
- Open ALLSTAR through the normal Cinema 2.0 registry in STAGELESS and review against the clip before promoting its reference role to keeper.

Patch preparation validation: the actual native manifest compiler and first-party authoring gate passed, including the catalog's expanded Auto Performance coverage. A local TypeScript-transpiled check exercised all twelve CPU instance layouts (finite, distinct, within budget), hard geometry/fixture/rail permissions and all eleven trigger selection cases. Full project typecheck/Vitest/browser acceptance could not run here: the dependency archive is not installed and offline npm ci failed on an uncached `zustand@5.0.13`. No human approval or GPU performance claim is made. The production browser test is supplied but has not been executed. The analytic reflections are not actual screen-space reflections or ray tracing.
