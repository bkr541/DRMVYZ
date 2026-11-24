# SERAPH | Celestial machine

## Status and forensic boundary

Selectable first-party **reference**, not a keeper. This reconstruction is based on the supplied written visual specification; original concept images were not present in the supplied archive or visible attachments. No SERAPH screenshot was supplied. Written brief describes a six-wing celestial sculpture. Exact reference parity and production visual acceptance are pending.

The supplied ZIP omitted `modules/artifacts/` entirely. Its unanchored `artifacts/` ignore rule matches source directories as well as output. The actual former sculpture code therefore could not be audited. Imports now target the non-ignored `modules/artifactSculptures/`; the original preset IDs, module IDs, pattern IDs and catalog role remain unchanged. No unrelated preset or ORGANISM source was changed.

| Target | Prior evidence / gap | Correction | Validation |
|---|---|---|---|
| Sculpture silhouette, volume and scale | No SERAPH screenshot was supplied. Written brief describes a six-wing celestial sculpture. | Six paired spines, root/middle/tip centerlines, attached tapered feather trusses, nested vertical cages and two halos. | Finite/bounded geometry; production capture pending |
| Architecture | Written brief and visible screenshots describe a generic enclosure | Long nave, massive buttresses, pointed overhead ribs, deep aisle bays, stepped terraces and oculus. | Separate primitive builders; neutral visual comparison pending |
| Physical choreography | Prior geometry files absent, prior motion not directly inspectable | Preset-specific centerlines, local roots and assemblies; shared signal bindings | Coordinate checks; visual motion pending |
| Shadows and materials | Screenshot shadows limited to one prominent projection | Two real shadow maps, three solid strut roles and separate core | Production shadow fidelity pending |
| Camera | Prior screenshot composition lacks monumentality | Individually authored wide and close paths, narrower lens and pose envelope | Collision/occupancy and visual framing pending |

## Native geometry

Six paired spines, root/middle/tip centerlines, attached tapered feather trusses, nested vertical cages and two halos.

Long nave, massive buttresses, pointed overhead ribs, deep aisle bays, stepped terraces and oculus.

The native world provider uses three dynamic instanced cylinder batches (primary, secondary and emissive). Architectural boxes and beams are static instance batches grouped by primitive/material; rings and platforms use solid geometry. CPU centerlines and strut endpoints are regenerated on update; there is no per-frame GPU geometry/material creation. A uniform emergency envelope fit prevents extreme poses from crossing the floor or radial bounds without disconnecting individual struts; this can constrain combined maximum settings.

## Pattern choreography

AWAKENING: open hero pose with phased feathers; ASCENSION: staggered rising wing sections; HALO: wing arcs and rotating halos; WINGBEAT: travelling sweep; REFRACTION: alternating depth-plane twist; SANCTUARY: wings fold forward/inward; DOMINION: maximal safe deployment; TRANSCENDENCE: layered undulation.

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
| master-controls | `seraph-auto-performance` | Auto Performance | false | boolean | Let the shared Mood Conductor control the show. |
| master-controls | `seraph-bpm-sync` | BPM Sync | true | boolean | Lock mechanical phase when the Audio Dock permits it; camera uses the shared tempo control. |
| master-controls | `seraph-motion-safety` | Motion Safety | "full" | enum | Limit or freeze spatial animation. |
| master-controls | `seraph-flash-accents` | Flash Accents | "reduced" | enum | Restrict direct transient illumination. |
| master-controls | `seraph-reactivity` | Music Reactivity | 1 | 0–1 / 0.01 | Shared audio envelopes and mood response. |
| master-controls | `seraph-motion-amount` | Motion Amount | 0.8 | 0–1 / 0.01 | Extent of breathing and camera movement. |
| master-controls | `seraph-intensity` | Master Intensity | 1 | 0–1.6 / 0.01 | Core, luminous struts and projection light gain. |
| design | `seraph-pattern` | Pattern | "awakening" | enum | Select the authored pattern; automatic changes never save over it. |
| design | `seraph-pattern-change` | Pattern Change | false | boolean | Advance on new qualifying musical events. |
| design | `seraph-trigger` | Trigger | "bar4" | enum | Canonical shared event that advances the runtime pattern. |
| design | `seraph-span` | Wingspan | 1 | 0.7–1.15 / 0.01 | Root-to-tip span of all six wings. |
| design | `seraph-fold` | Wing Fold | 0.3 | 0–1 / 0.01 | Fold roots toward the core. |
| design | `seraph-articulation` | Wing Articulation | 0.65 | 0–1 / 0.01 | Middle and outer hinge range. |
| design | `seraph-sweep` | Wing Sweep | 0.6 | 0–1 / 0.01 | Rhythmic wing sweep amplitude. |
| design | `seraph-twist` | Wing Twist | 0.45 | 0–1 / 0.01 | Depth-plane twist of wing segments. |
| design | `seraph-phase-offset` | Wing Phase Offset | 0.5 | 0–1 / 0.01 | Timing stagger between wing pairs. |
| design | `seraph-halo-rotation` | Halo Rotation | 0.45 | 0–1 / 0.01 | Rotation of the optional halo. |
| design | `seraph-wing-depth` | Wing Depth | 1 | 0.65–1.4 / 0.01 | Thickness of wing truss cross-sections. |
| design | `seraph-feather-articulation` | Feather Articulation | 0.65 | 0–1 / 0.01 | Local movement of feather blades. |
| design | `seraph-halo-enable` | Halo Enable | true | boolean | Show the celestial halo assemblies. |
| design | `seraph-density` | Structural Density | 0.85 | 0–1 / 0.05 | Amount of secondary diagonal bracing. |
| design | `seraph-motion-rate` | Mechanical Motion Speed | 0.7 | 0–1.5 / 0.01 | Rate of the shared mechanical phase. |
| design | `seraph-strand-thickness` | Strut Thickness | 0.045 | 0.018–0.075 / 0.001 | Actual radius of solid lattice rods. |
| design | `seraph-core-scale` | Core Scale | 1 | 0.7–1.3 / 0.01 | Scale of central cage and heart. |
| design | `seraph-core-intensity` | Core Intensity | 1 | 0–1.6 / 0.01 | Emission gain of central heart. |
| design | `seraph-projection-intensity` | Projection Intensity | 0.85 | 0–1.6 / 0.01 | Light illuminating the walls through the lattice. |
| design | `seraph-light-distance` | Projection Distance | 5.8 | 4.8–7.8 / 0.05 | Move the two light sources closer to enlarge the wall projections. |
| design | `seraph-projection-speed` | Projection Speed | 0.5 | 0–1.2 / 0.01 | Speed of the shadow-casting fixtures around the sculpture. |
| design | `seraph-shadow-softness` | Shadow Softness | 1 | 0–3 / 0.05 | Filter radius of the real geometry shadow maps. |
| design | `seraph-camera-mode` | Camera Mode | "director" | enum | Select cinematic reveal, horizontal orbit, macro or locked composition. |
| design | `seraph-camera-motion` | Camera Motion | true | boolean | Hard permission for camera travel. |
| design | `seraph-camera-speed` | Camera Speed | 0.72 | 0–1.4 / 0.01 | Rate of the shared cinematic path. |
| design | `seraph-camera-amount` | Camera Motion Intensity | 0.9 | 0–1 / 0.01 | Scale of the shared camera motion. |
| design | `seraph-fov` | Field of View | 46 | 42–74 / 1 | Base perspective angle. |
| effects | `seraph-bloom` | Bloom | 0.55 | 0–1 / 0.01 | Halo from luminous truss edges. |
| effects | `seraph-atmosphere-mix` | Atmosphere Mix | 1 | 0–1 / 0.01 | Blend the shared atmospheric effect. |
| effects | `seraph-finish-mix` | Finish Mix | 1 | 0–1 / 0.01 | Blend the shared cinematic finish. |
| effects | `seraph-haze` | Atmosphere | 0.018 | 0–0.06 / 0.001 | Depth-aware atmospheric scattering. |
| effects | `seraph-contrast` | Contrast | 1.13 | 0.8–1.4 / 0.01 | Shared cinematic contrast. |
| effects | `seraph-exposure` | Exposure | 1 | 0.55–1.5 / 0.01 | Shared cinematic exposure multiplier. |
| effects | `seraph-vignette` | Vignette | 0.25 | 0–0.65 / 0.01 | Peripheral darkening. |
| palette | `seraph-background` | Architecture | [0.23,0.21,0.19,1] | color | Independent Architecture color. |
| palette | `seraph-metal` | Primary Structural Metal | [0.64,0.59,0.51,1] | color | Independent Primary Structural Metal color. |
| palette | `seraph-secondary` | Secondary Structural Metal | [0.38,0.34,0.3,1] | color | Independent Secondary Structural Metal color. |
| palette | `seraph-strand` | Structural Emission | [1,0.91,0.73,1] | color | Independent Structural Emission color. |
| palette | `seraph-core` | Energy Core | [1,0.96,0.85,1] | color | Independent Energy Core color. |
| palette | `seraph-haze-tint` | Atmosphere | [0.52,0.4,0.29,1] | color | Independent Atmosphere color. |
