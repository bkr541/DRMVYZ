# LaserDMX Physical Scanner Correction, Patch 5 of 6

Patch 5 migrates all first-party Show Director content from persistent target-network assumptions to native ordered scanner paths and purpose-authored DMX fixture choreography. The Shared Performance Core, Music Intelligence timing, legacy project migration, and saved-project compatibility remain authoritative and intact.

## Migrated content

All 20 built-in Performance Shows are migrated at their canonical registration boundary:

- Prism Cathedral
- Cardinal Fan Reactor
- Cyan Mirror Cage
- Vocal Eclipse Exchange
- Emerald Tunnel Relay
- White Vector Interlock
- Aurora Canopy Drift
- Chromatic Chapter Stage
- Prismatic Pulse Matrix
- Spectral Ribbon Singularity
- Crimson Apex Protocol
- Violet Hourglass Orbit
- Scarlet Origami Lattice
- Small Club Performance
- Festival Front Beams Performance
- Dubstep Drop Lasers Performance
- LED Bar Grid Performance
- Moving Head Sweep Performance
- Strobe + Blinder Performance
- Haze + CO2 Performance

The seven static Rig Layout presets are migrated through the same physical-content boundary: Small Club, Festival Front Beams, Dubstep Drop Lasers, LED Bar Grid, Moving Head Sweep, Strobe + Blinder Hits, and Haze + CO2 Drops.

## Physical scanner authoring

Every first-party laser fixture now receives a persistent native scanner configuration with:

- one ordered path and one scanner head per aperture;
- deterministic phase, direction, duration, scan rate, and switch boundary;
- retrace blanking, blanking delay, point dwell, and corner dwell;
- explicit depth layer and path geometry;
- one normal optical output unless prism or diffraction is deliberately authored;
- a bounded maximum of nine explicit optical outputs in built-in content.

Legacy target arrays are no longer authoritative for built-ins. Multi-target networks are reduced to a single compatibility endpoint, while legacy saved projects continue to use the Patch 4 preview and migration workflow.

## Pattern vocabulary

The migration assigns physically valid patterns according to show identity and fixture role:

- line sweep and held beam for tension, source identity, and outros;
- ordered fan sweep for hero and supporting fan banks;
- circle and arc perimeter scans for breakdowns and canopy motion;
- edge-ordered polygon paths for cathedral, vector, origami, and apex structures;
- progressive wave paths for texture and ribbon banks;
- tunnel and mirrored corridor paths for depth-oriented shows;
- explicit line or grid diffraction only for named optical fixtures.

Projector-to-vertex spokes, bow-tie cages, radial wave spokes, rigid multi-ray wheels, and unexplained single-aperture starbursts are rejected by the built-in audit.

## Fixture roles and musical hierarchy

Laser fixtures are classified as hero fan, supporting fan, aerial scan, geometric outline, tunnel, corridor, accent beam, texture scanner, diffraction scanner, held tension beam, upper-air canopy, or front-air rake.

Existing semantic bank maps are reused to create separate hero, support, and texture scanner treatments. Hero banks receive the broadest and fastest authored motion. Support banks use narrower, slower, phase-offset motion on a subordinate depth plane. Texture banks use smaller wave or arc traversal in upper air and never inherit hero optical copies.

Nonlaser fixtures retain their original show identities while receiving a physical role boundary:

- moving heads provide architectural movement, convergence, expansion, and gobo/prism development;
- PARs and washes provide section color beds rather than laser geometry; the Haze + CO2 show adds three bounded plume uplights so its atmosphere has an explicit illumination source;
- LED bars and tubes provide chase, contrast, and framing;
- strobes remain short impact and snare devices;
- blinders remain phrase and drop-impact exposure surges;
- haze follows a section envelope;
- CO2 remains a short authored impact effect with light interaction supplied by purposeful wash fixtures;
- video surfaces remain emissive and do not create a visible venue wall.

## Full-song development

Every laser Performance Program receives deterministic scanner development at the existing Shared Performance cadence:

- **Intro:** sparse line or held motion, low rates, narrow geometry, deep negative space.
- **Verse:** moderate arc or wave movement with restrained fan width.
- **Build:** rising scan rate, convergence, recruitment, and haze.
- **Pre-drop:** held-beam tension or simplified motion with existing authored blackout windows preserved.
- **Drop 1:** coherent hero fan, polygon, tunnel, or corridor structures with subordinate support and texture banks.
- **Breakdown:** slower circle or arc traversal, reduced density, upper-air placement, and lower haze.
- **Drop 2:** reversed direction, expanded depth, altered phase, evolved fixture recruitment, and bounded prism variation where the show identity calls for it.
- **Outro:** slower line traversal, fixture reduction, and clean motif resolution.

Bar handoffs alter direction and phase. Four-bar development adjusts fan width and path scale without disturbing existing motif cycles. Eight-bar recruitment opens a new depth plane. Sixteen-bar evolution reverses or resets paths at deterministic phrase boundaries.

## Budget behavior

Native scanner budget demand is based on physical simultaneous outputs, not on apparent exposure width. A normal single-aperture scanner therefore budgets one instantaneous output. Explicit prism, diffraction, or multi-aperture configurations budget only their declared outputs.

Quality tiers may increase exposure sampling, hero smoothness, haze detail, and bounded optical-copy detail without changing path meaning, blanking, timing, roles, or determinism. Existing deterministic role-priority degradation remains responsible for dropping texture and support work before hero architecture.

## Validation and WebGL coverage

Patch 5 adds a complete built-in audit and deterministic song-state tests for Intro, Verse, Build, Pre-drop, Drop 1, Breakdown, Drop 2, and Outro. The audit reports native scanner count, single-aperture count, explicit optical count, target-network risk, radial-spoke risk, unblanked discontinuities, optical-copy bounds, path continuity, and fixture-role counts.

The production WebGL visual review expands from 26 to 32 captures. The Haze + CO2 capture now verifies PAR-lit atmosphere and plume interaction while retaining a predominantly black frame. Added states cover Cardinal Fan Reactor pre-drop and Drop 2, Cyan Mirror Cage pre-drop, Dubstep Drop Drop 1, Emerald Tunnel Relay Drop 2, and Prismatic Pulse Matrix Drop 2. High and Ultra assertions now validate scanner exposure and segment density rather than legacy simultaneous fan-ray counts. Capture mode continues to require zero editor overlays, duplicate scanner inputs, or nonphysical mixed laser sources.

## Patch 6 boundary

Patch 6 remains responsible for final repository-wide performance hardening, broad test-suite cleanup, any final visual threshold tuning revealed by diverse GPU environments, and the closing integration audit. Patch 5 does not remove compatibility code or rewrite unrelated engines.
