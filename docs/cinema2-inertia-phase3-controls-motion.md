# Inertia — Phase Three controls and native motion

Date: 2026-10-29  
Status: accepted by the user's “Approved. Please proceed.” instruction. [Phase Four shared musical response](cinema2-inertia-phase4-shared-audio.md) is now implemented for review. Inertia remains a reference preset; this report records the accepted controls/native-motion checkpoint.

## Delivered scope

All six authored Patterns now have native geometry and visible motion:

| Pattern | Visible behavior |
| --- | --- |
| Reference Cycle | Coherent rotation followed by cage folding and recovery |
| Countertwist | Opposing twist across the cage's height |
| Breathing Cage | Pressure-like expansion/contraction and restrained rotation |
| Torsion Wave | Traveling twist through lattice rows |
| Slice Shear | Sliding/crossing horizontal lattice bands |
| Collapse / Release | Compression and bounded recovery with a small damped overshoot |

Points, anchors, and both endpoints of every rib share the same GPU deformation. Motion does not rebuild or sort thousands of CPU vertices per frame. Geometry buffers update only when proof pose, quality, or density changes. No track preserves the accepted Reference Cycle static composition; other selected Patterns have their authored static poses. The sphere remains centered and independently sized.

The fixed shared orthographic camera is unchanged. Portrait fitting preserves the shorter-side composition without camera motion or automatic per-frame refitting. Final cage coordinates are constrained to a shared radial budget, reserving sprite footprint inside the 0.92 safe radius. This accommodates the larger cage accepted in Phase Two, including combined size/deformation/point-size extremes.

## Manual controls

The real schema-driven Inspector now exposes:

- **Master Controls:** Intensity, BPM Sync, Motion Speed, Motion Amount.
- **Design > Pattern:** Pattern, Pattern Change, and conditional Trigger, in that order.
- **Design > Geometry:** Cage Size, Core Size, Lattice Density, Point Size, Anchor Size, Deformation, Damping.
- **Palette:** independently editable Background, Lattice, Core, Anchors, and Ribs.
- **Effects:** the standard empty parent; no future effect controls are advertised.

Ranges/defaults follow the Phase One specification. Density changes real regular cage sampling; the default retains the approved balanced topology. The slider remains effective at low and high quality. Point Size excludes anchors; Anchor Size has its own consumer. Cage/Core Size address separate geometry. Motion Amount changes motion range, not traveling-wave speed. Motion Speed governs cycle frequency.

Damping uses analytic first-order phase lag based on the authored 0.12–0.65 second settling range, plus reduced recovery overshoot in Collapse / Release. It is an authored deterministic response, not an unbounded physical spring simulation. Deformation scales nonrigid behavior while leaving rigid motion available. Motion Amount zero selects a static pose while retaining manual editability.

Audio Response, Auto Performance, bloom, and trails are intentionally not exposed before their later-phase consumers exist. The five palette controls use separate actual color targets. No shared Inspector special cases or workspace-specific typography overrides were introduced.

## Timing and authority

- Effective synchronization is preset BPM Sync AND the host preference when that preference is explicitly supplied. An omitted host preference leaves authority with the preset control.
- Use the existing shared raw timing snapshot: confirmed grid first, then shared analyzed/transport BPM estimates. The small shared-source change is exporting the existing `resolveRawCinema2MainframeBeatClock` function; its behavior and Mainframe's existing consumers are unchanged.
- The stateful Mainframe continuity resolver requires analyzed audio, so it is unsuitable as the sole source for native motion before analysis is available. Inertia accumulates visual phase from the shared snapshot and real transport delta, without creating beats or musical facts.
- With Sync OFF or unavailable usable tempo, motion uses authored seconds independently of BPM. Initial durations are 8 beats/5 seconds for Reference Cycle, Countertwist, Torsion Wave, and Collapse / Release; 4 beats/3 seconds for Breathing Cage and Slice Shear, at Speed 1.
- Sync/tempo changes preserve phase continuity and reconcile to shared phase over a cycle. Pause retains pose/phase. Resume continues it. Timeline discontinuities and source/context changes reset/rebase volatile motion. Native motion blends in over 200ms after playback starts.
- Manual Pattern edits take effect without waiting for a musical boundary. Playing transitions blend geometry; paused manual edits immediately update the frozen presentation. Camera and authored palette remain unchanged.
- Pattern Change defaults OFF. The canonical 11 Trigger choices are reused verbatim; Trigger is visible only while enabled. Generic shared pattern selection consumes canonical event identities, and edit revisions support manual reselection without disabling Pattern Change. No local beat/drop/phrase detection is introduced.

The event-consumer wiring is present for the mandatory Pattern controls. Full analyzed-track event switching, all 11 event meanings, duplicate/stale-event fences across music lifecycle transitions, and shared musical-response validation remain Phase Four acceptance work. No temporary build/drop substitutions or Auto Performance are implemented yet.

## Validation and evidence

Passed focused validation:

```sh
npx vitest run --config vitest.node.config.ts src/components/vyzualz/cinema2/__tests__/Cinema2InertiaStatic.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2InertiaMotion.test.ts
npx tsc --noEmit --pretty false
node scripts/run-cinema2-inertia-motion-browser.mjs
```

- **8 unit tests:** geometry/topology/registration invariants plus six motion vocabularies, shared timing/host permission, pause/idle/reset behavior, stopped motion, manual edits, damping/speed, Inspector hierarchy, five colors, and canonical Trigger definitions.
- **51 production-canvas perceptual comparisons:** all six moving Patterns, all 15 cross-pattern pairs, minimum/default/maximum for ten numeric controls, each palette role, Sync ON/OFF and contrasting shared BPMs, paused manual selection, and density range at low/high quality.
- Additional browser assertions cover static idle, free-run independence from BPM, host Sync OFF behavior, Motion Amount zero, fixed camera, preservation of Pattern Change during manual selection, six Pattern options, exactly 11 Trigger options, conditional Trigger visibility, and safe bounds in landscape/portrait at combined extremes.
- The actual production Inspector is mounted with production workspace styles. Parent headings use 12px/700 with icons; nested headings use the shared 11px role. Body-portaled dropdown **label text** uses the shared 11px field role (the option container itself has a different inherited size). No text-entry placeholder is authored by Inertia.
- Targeted ESLint and diff whitespace checks passed. No full build or unrelated repository-wide suite was needed.

The final full browser run writes [report.json](../artifacts/inertia-phase3/report.json) and [motion-report.json](../artifacts/inertia-phase3/motion-report.json). Earlier partial executions were superseded after timing/harness corrections and final travel-amplitude tuning. All final comparisons ran on the final motion implementation. Captures are local ignored artifacts and can be regenerated with the command above.

Review captures:

- [Approved static identity retained](../artifacts/inertia-phase3/idle-approved.png)
- [Reference Cycle A](../artifacts/inertia-phase3/reference-cycle-a.png) / [B](../artifacts/inertia-phase3/reference-cycle-b.png)
- [Countertwist A](../artifacts/inertia-phase3/countertwist-a.png) / [B](../artifacts/inertia-phase3/countertwist-b.png)
- [Breathing Cage A](../artifacts/inertia-phase3/breathing-cage-a.png) / [B](../artifacts/inertia-phase3/breathing-cage-b.png)
- [Torsion Wave A](../artifacts/inertia-phase3/torsion-wave-a.png) / [B](../artifacts/inertia-phase3/torsion-wave-b.png)
- [Slice Shear A](../artifacts/inertia-phase3/slice-shear-a.png) / [B](../artifacts/inertia-phase3/slice-shear-b.png)
- [Collapse / Release A](../artifacts/inertia-phase3/collapse-release-a.png) / [B](../artifacts/inertia-phase3/collapse-release-b.png)
- [Inspector and Pattern menu](../artifacts/inertia-phase3/inspector-pattern-menu.png)
- [Palette Inspector](../artifacts/inertia-phase3/inspector-palette.png)
- [Landscape bounds](../artifacts/inertia-phase3/bounds-1280x720.png) / [portrait bounds](../artifacts/inertia-phase3/bounds-720x1280.png)

The author inspected production motion and Inspector captures, and the user subsequently accepted this checkpoint. These Phase Three tests use deterministic host transport at DPR 1; they do not claim real-track musicality, a rendered DPR stress pass, or a measured frame-rate guarantee. Later evidence is recorded in the subsequent phase reports.

## Handoff

Phase Three is implemented. No Audio Intelligence response mappings, Choreography envelopes, Director enhancements, Auto Performance overrides, or finishing effects were added. The next approved scope would be Phase Four shared musical response and full event-driven Pattern Change acceptance.

No commit was requested or created. All Inertia work remains uncommitted. Shared source changes remain additive preset/module registration plus the narrow export of the existing raw timing helper.
