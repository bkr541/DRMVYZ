# Cinema 2.0 Mainframe preset

Mainframe (`drmvyz.cinema2.mainframe`) is a first-party Cinema 2.0 keeper preset. It renders a deterministic, shallow 3D circuit-board wall around the DVYDRM cloud logo. The shipped model contains independently addressable circuits, terminals, vias, radar assemblies, chip assemblies, and three logo zones; audio intelligence changes their emission without changing the physical geometry.

The staged design and implementation history remains in `docs/cinema2-mainframe-production-plan.md`. This document is the current operating contract.

## Operator controls

| Group | Control | Behavior |
| --- | --- | --- |
| Master Controls | Master Intensity | Scales all emission and reactive lifts. Physical hardware remains visible at zero. |
| Master Controls | BPM Sync | Uses the loaded track's beat/bar grid when available; otherwise choreography uses a stable 120 BPM clock. Pause freezes the frame. |
| Design | Enable Radar Circuit | Shows or hides complete radar assemblies, including hardware and light. |
| Design | Enable Chip | Shows or hides complete chip and daughterboard assemblies. |
| Design | Scale | Camera-relative zoom from 0.45 to 1.35. Cover framing prevents exposed Stage background at the deepest zoom-out. |
| Effects | Pattern | Immediately selects one of the six deterministic lighting programs. |
| Effects | Pattern Change | Allows qualified Trigger events to advance through a seeded, no-immediate-repeat pattern order. |
| Effects | Trigger | Appears only when Pattern Change is enabled and reuses the eleven canonical Afterhours trigger IDs. |
| Palette | Background | Tints the physical board while retaining material shading. |
| Palette | Logo | Controls the three logo zones' emissive accent. |
| Palette | Circuits | Controls trace-core emission. |
| Palette | Indicators | Controls terminals, vias, radar/chip lights, and status lamps. |

## Lighting programs

- **Outward Bus:** center-to-edge route travel; the logo leads and outer components resolve the phrase.
- **Inward Boot:** edge systems converge through the components into the logo.
- **Bank Alternator:** banks A and B trade on beats while C and D provide subdivisions and replies.
- **Quadrant Relay:** energy circulates through the four board quadrants with symmetric counter-pulses.
- **Radar Sweep:** radar rings and spokes hand energy into nearby routes; high-frequency events accent indicators.
- **System Surge:** sparse pre-charge followed by a controlled full-board downbeat/drop impact.

Pattern evaluation is deterministic for the runtime seed and musical position. Seek, source replacement, context replacement, trigger edits, and manual pattern changes reset transient state so stale events cannot fire.

Mainframe uses a deliberately high-contrast emissive response: inactive routes retain only a dark locator glow, ordinary band energy stays below the bloom threshold, and authored hits drive white-hot HDR pulses brighter than Conduit's emitters. This separation keeps circuit travel legible instead of presenting as a uniformly green wall.

## Source and regeneration contract

The immutable owner-authored sources live in `scripts/cinema2-assets/sources/mainframe/`. Their SHA-256 values are enforced by `mainframe-source-contract.mjs`; generation never depends on a Downloads directory. `logo-master.svg` is authoritative for the center logo's two stroked outline contours, seven body rails, star, and the 60 center routes. Its body path supplies contour topology only: production intentionally leaves the space between those rails open so the continuous mainframe surface remains visible beneath the logo.

Regenerate and verify from the repository root:

```sh
node scripts/cinema2-assets/audit-mainframe-sources.mjs
node scripts/cinema2-assets/generate-mainframe.mjs
npm run assets:build
node --test scripts/cinema2-assets/mainframe-source-contract.test.mjs scripts/cinema2-assets/mainframe-geometry.test.mjs
npm run assets:check
```

The generated `public/cinema2/models/mainframe.glb` is 133,450 triangles and 7.45 MiB. It remains one shared model because its 13 merged semantic parts are already below the asset limits; duplicating the geometry for tier-specific files would increase installer cost without improving the composition.

## Model and shader attributes

The GLB exposes these named material/mesh families:

`board`, `plates`, `recesses`, `circuitHousings`, `circuitCores`, `hardware`, `indicatorCores`, `radarHardware`, `radarCores`, `chipHardware`, `chipCores`, `logoHousing`, and `logoCore`.

Every vertex carries:

| Attribute | Contract |
| --- | --- |
| `_GLOW_PHASE` | Normalized progress used for route fronts and component choreography. |
| `_MAINFRAME_ROUTE` | Stable route index; `-1` for geometry without route ownership. |
| `_MAINFRAME_BANK` | A/B/C/D encoded as 0/1/2/3; `-1` when not applicable. |
| `_MAINFRAME_REGION` | Sorted region encoding: bottom-center 0, left-branch 1, left-major 2, left-minor 3, right-branch 4, right-major 5, right-minor 6, top-center 7. |
| `_MAINFRAME_SYSTEM` | board 0, circuits 1, terminals 2, vias 3, radar 4, chip 5, logo outer 6, logo body 7, logo star 8. |

The runtime must preserve these attributes when cloning/uploading the model. The Mainframe shader consumes them directly; replacing them with per-route material instances would regress draw-call cost and deterministic routing.

## Quality and lifecycle

| Tier | Render scale | Shadows | Bloom | Geometry/components |
| --- | ---: | --- | ---: | --- |
| High | 1.00 | Up to two 1024 px maps | 7 levels | Full 13-part model |
| Medium | 0.82 | Up to two 512 px maps | 6 levels | Full 13-part model |
| Low | 0.67 | Disabled | 5 levels | Full 13-part model |

Radar and chip families remain visible at every tier because they are primary reactive landmarks. Mainframe uses the shared Cinema 2.0 WebGL context, asset cache, lighting, targets, diagnostics, and context lifecycle; it does not create another renderer, canvas, animation loop, or audio analyser.

Run the deterministic production gate with:

```sh
npm run visual:mainframe:production
```

The gate captures rest plus all six patterns at 1920×1080 and 2048×1041, medium/low checkpoints, a 120-frame high-tier profile, resize, forced context recovery, and intercepted asset failure. The final open-logo run on 2026-10-08 completed without module/effect degradation: 3.40 ms average CPU frame time, 2.20 ms GPU frame time, 16.65 ms presented-frame interval, 15,150,740 estimated module GPU bytes, successful context generation 1 → 2 recovery, and the expected `CINEMA2_MAINFRAME_ASSET_LOAD_FAILED` diagnostic for a missing GLB.

## Known limits

- Mainframe is intentionally a front-facing hard-surface wall, not a freely orbitable environment.
- Cover framing crops surplus horizontal or vertical content by aspect ratio; the center logo and primary routes remain protected.
- All quality tiers retain the same semantic geometry. Performance scaling comes from render resolution, shadows, and bloom rather than removing audio-reactive landmarks.
- The shipped model does not require external textures or third-party rendering libraries. Any future normal/AO asset must enter the Cinema 2.0 asset registry with provenance and budget metadata.
- Replacing an owner master requires an intentional checksum update, contract review, model regeneration, and a fresh production acceptance run.
