# RELIC | Industrial skeletal machine

## Status and forensic boundary

Selectable first-party **reference**, not a keeper. This reconstruction is based on the supplied written visual specification; original concept images were not present in the supplied archive or visible attachments. Screenshot shows a small mostly frontal skull with shallow sockets and separated thin arcs. Exact reference parity and production visual acceptance are pending.

The supplied ZIP omitted `modules/artifacts/` entirely. Its unanchored `artifacts/` ignore rule matches source directories as well as output. The actual former sculpture code therefore could not be audited. Imports now target the non-ignored `modules/artifactSculptures/`; the original preset IDs, module IDs, pattern IDs and catalog role remain unchanged. No unrelated preset or ORGANISM source was changed.

| Target | Prior evidence / gap | Correction | Validation |
|---|---|---|---|
| Sculpture silhouette, volume and scale | Screenshot shows a small mostly frontal skull with shallow sockets and separated thin arcs. | Rear cranial hoops, crown/temple arches, deep sockets, brow and cheekbone trusses, upper teeth, hinged lower jaw/teeth, separable connected assemblies and segmented containment trusses. | Finite/bounded geometry; production capture pending |
| Architecture | Written brief and visible screenshots describe a generic enclosure | Armored orthogonal vault with deep machine bays, gantries, armored columns and segmented containment platform. | Separate primitive builders; neutral visual comparison pending |
| Physical choreography | Prior geometry files absent, prior motion not directly inspectable | Preset-specific centerlines, local roots and assemblies; shared signal bindings | Coordinate checks; visual motion pending |
| Shadows and materials | Screenshot shadows limited to one prominent projection | Two real shadow maps, three solid strut roles and separate core | Production shadow fidelity pending |
| Camera | Prior screenshot composition lacks monumentality | Individually authored wide and close paths, narrower lens and pose envelope | Collision/occupancy and visual framing pending |

## Native geometry

Rear cranial hoops, crown/temple arches, deep sockets, brow and cheekbone trusses, upper teeth, hinged lower jaw/teeth, separable connected assemblies and segmented containment trusses.

Armored orthogonal vault with deep machine bays, gantries, armored columns and segmented containment platform.

The native world provider uses three dynamic instanced cylinder batches (primary, secondary and emissive). Architectural boxes and beams are static instance batches grouped by primitive/material; rings and platforms use solid geometry. CPU centerlines and strut endpoints are regenerated on update; there is no per-frame GPU geometry/material creation. A uniform emergency envelope fit prevents extreme poses from crossing the floor or radial bounds without disconnecting individual struts; this can constrain combined maximum settings.

## Pattern choreography

DORMANT: assembled pose; AWAKEN: jaw activation; ROAR: wide jaw; FRACTURE: connected parts separate; RECONSTRUCT: cyclic return; POSSESSION: asymmetrical articulation; SIEGE: containment motion; CATACLYSM: broad separation and reassembly.

Manual pattern selection rebases immediately; automatic transitions ease over 0.55 seconds using the shared pattern controller. Pattern Change defaults OFF; Trigger is conditionally hidden without resetting the authored value. Eleven canonical triggers and temporary build/drop overrides are reused from the native module. Overrides are runtime-only, never persistence writes. Pattern trajectories are authored, but production differentiation, timing, collision freedom and cinematic quality remain unverified.

## Shared systems and authority

The existing native manifest continues to use the four Inspector parent groups, canonical controls, six palette channels, shared Audio Intelligence and Visual Director target rules, the shared BPM clock, shared Mood Conductor authoring and Auto coverage. Palette remains user-authored. Structural controls are user base plus transient automation; camera and optional structure enable toggles remain hard permissions. The shared camera/effect pipeline remains unchanged. No separate clock, global animation loop or engine is introduced.

Two independently moving real spotlights illuminate the animated lattice and architectural receivers. Quality-tier map sizes are 512/1024/2048. Shadow bias, normal bias and PCF filtering are explicit; the renderer saves/restores shared GL state and releases owned resources on lease retirement. Shadow appearance and GPU cost have not been measured. Camera paths are conservative exterior close-detail paths, not collision-certified interior traversal.

## Validation and keeper gate

- Offline strict TypeScript check of pure geometry, architecture and specifications; finite-coordinate sweeps at three quality levels; authored and Auto-covered manifest compiler and authoring checks using the actual repository code in a transpile-only runner. Auto skipped-target count was zero for all four presets.
- Full application typecheck, Vitest, production browser captures, casting, actual parameter pixels, camera collisions, shadow fidelity and resource/performance profiling remain blocked or unexecuted. Dependency installation failed (offline cache missing `zustand`; online DNS lookup failed). No visual keeper claim is made.
- Run `npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2ArtifactPresets.test.ts` and `node scripts/run-cinema2-artifacts-browser.mjs` in a dependency-complete checkout. Compare the captured frames with the actual original references before accepting or promoting the preset.

## Authored parameter inventory

| Parent | Stable ID | Label | Default | Range / step | Visible intent |
|---|---|---|---|---|---|
| shared | `quality-mode` | Quality / Performance | "auto" | enum | Auto adapts render cost to frame time. Performance favors headroom; Quality favors detail. |
| master-controls | `relic-auto-performance` | Auto Performance | false | boolean | Let the shared Mood Conductor control the show. |
| master-controls | `relic-bpm-sync` | BPM Sync | true | boolean | Lock mechanical phase when the Audio Dock permits it; camera uses the shared tempo control. |
| master-controls | `relic-motion-safety` | Motion Safety | "full" | enum | Limit or freeze spatial animation. |
| master-controls | `relic-flash-accents` | Flash Accents | "reduced" | enum | Restrict direct transient illumination. |
| master-controls | `relic-reactivity` | Music Reactivity | 1 | 0–1 / 0.01 | Shared audio envelopes and mood response. |
| master-controls | `relic-motion-amount` | Motion Amount | 0.8 | 0–1 / 0.01 | Extent of breathing and camera movement. |
| master-controls | `relic-intensity` | Master Intensity | 1 | 0–1.6 / 0.01 | Core, luminous struts and projection light gain. |
| design | `relic-pattern` | Pattern | "dormant" | enum | Select the authored pattern; automatic changes never save over it. |
| design | `relic-pattern-change` | Pattern Change | false | boolean | Advance on new qualifying musical events. |
| design | `relic-trigger` | Trigger | "bar4" | enum | Canonical shared event that advances the runtime pattern. |
| design | `relic-skull-scale` | Skull Scale | 1 | 0.7–1.2 / 0.01 | Overall skull size. |
| design | `relic-jaw-opening` | Jaw Opening | 0.3 | 0–1 / 0.01 | Rotation of the mandibular assembly. |
| design | `relic-jaw-motion-speed` | Jaw Motion Speed | 0.65 | 0–1 / 0.01 | Rate of jaw articulation. |
| design | `relic-jaw-reactivity` | Jaw Reactivity | 0.7 | 0–1 / 0.01 | Kick-driven jaw movement. |
| design | `relic-cranial-articulation` | Cranial Articulation | 0.45 | 0–1 / 0.01 | Motion of paired cranial plates. |
| design | `relic-head-rotation` | Head Rotation | 0.5 | 0–1 / 0.01 | Bounded head yaw. |
| design | `relic-fragment-separation` | Fragment Separation | 0.45 | 0–1 / 0.01 | Distance between articulated bone assemblies. |
| design | `relic-fragment-rotation` | Fragment Rotation | 0.4 | 0–1 / 0.01 | Rotation of separated assemblies. |
| design | `relic-reconstruction-speed` | Reconstruction Speed | 0.65 | 0–1 / 0.01 | Rate of separation and return. |
| design | `relic-eye-intensity` | Eye Socket Intensity | 0.8 | 0–1.5 / 0.01 | Gain on socket borders. |
| design | `relic-ring-speed` | Containment Ring Speed | 0.5 | 0–1 / 0.01 | Rotation of segmented rings. |
| design | `relic-ring-separation` | Containment Ring Separation | 0.5 | 0–1 / 0.01 | Radial deployment of containment arcs. |
| design | `relic-ring-enable` | Containment Ring Enable | true | boolean | Show the containment arcs. |
| design | `relic-density` | Structural Density | 0.85 | 0–1 / 0.05 | Amount of secondary diagonal bracing. |
| design | `relic-motion-rate` | Mechanical Motion Speed | 0.7 | 0–1.5 / 0.01 | Rate of the shared mechanical phase. |
| design | `relic-strand-thickness` | Strut Thickness | 0.045 | 0.018–0.075 / 0.001 | Actual radius of solid lattice rods. |
| design | `relic-core-scale` | Core Scale | 1 | 0.7–1.3 / 0.01 | Scale of central cage and heart. |
| design | `relic-core-intensity` | Core Intensity | 1 | 0–1.6 / 0.01 | Emission gain of central heart. |
| design | `relic-projection-intensity` | Projection Intensity | 0.85 | 0–1.6 / 0.01 | Light illuminating the walls through the lattice. |
| design | `relic-light-distance` | Projection Distance | 5.8 | 4.8–7.8 / 0.05 | Move the two light sources closer to enlarge the wall projections. |
| design | `relic-projection-speed` | Projection Speed | 0.5 | 0–1.2 / 0.01 | Speed of the shadow-casting fixtures around the sculpture. |
| design | `relic-shadow-softness` | Shadow Softness | 1 | 0–3 / 0.05 | Filter radius of the real geometry shadow maps. |
| design | `relic-camera-mode` | Camera Mode | "director" | enum | Select cinematic reveal, horizontal orbit, macro or locked composition. |
| design | `relic-camera-motion` | Camera Motion | true | boolean | Hard permission for camera travel. |
| design | `relic-camera-speed` | Camera Speed | 0.72 | 0–1.4 / 0.01 | Rate of the shared cinematic path. |
| design | `relic-camera-amount` | Camera Motion Intensity | 0.9 | 0–1 / 0.01 | Scale of the shared camera motion. |
| design | `relic-fov` | Field of View | 46 | 42–74 / 1 | Base perspective angle. |
| effects | `relic-bloom` | Bloom | 0.55 | 0–1 / 0.01 | Halo from luminous truss edges. |
| effects | `relic-atmosphere-mix` | Atmosphere Mix | 1 | 0–1 / 0.01 | Blend the shared atmospheric effect. |
| effects | `relic-finish-mix` | Finish Mix | 1 | 0–1 / 0.01 | Blend the shared cinematic finish. |
| effects | `relic-haze` | Atmosphere | 0.018 | 0–0.06 / 0.001 | Depth-aware atmospheric scattering. |
| effects | `relic-contrast` | Contrast | 1.13 | 0.8–1.4 / 0.01 | Shared cinematic contrast. |
| effects | `relic-exposure` | Exposure | 1 | 0.55–1.5 / 0.01 | Shared cinematic exposure multiplier. |
| effects | `relic-vignette` | Vignette | 0.25 | 0–0.65 / 0.01 | Peripheral darkening. |
| palette | `relic-background` | Architecture | [0.18,0.19,0.2,1] | color | Independent Architecture color. |
| palette | `relic-metal` | Primary Structural Metal | [0.56,0.61,0.67,1] | color | Independent Primary Structural Metal color. |
| palette | `relic-secondary` | Secondary Structural Metal | [0.31,0.37,0.45,1] | color | Independent Secondary Structural Metal color. |
| palette | `relic-strand` | Structural Emission | [0.78,0.91,1,1] | color | Independent Structural Emission color. |
| palette | `relic-core` | Energy Core | [0.9,0.96,1,1] | color | Independent Energy Core color. |
| palette | `relic-haze-tint` | Atmosphere | [0.3,0.4,0.55,1] | color | Independent Atmosphere color. |
