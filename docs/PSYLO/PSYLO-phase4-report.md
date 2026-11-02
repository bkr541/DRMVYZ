# PSYLO — Phase 4 bounded geometry and lighting choreography

Historical checkpoint. Current implementation: [final report](PSYLO-final-report.md).

November 2, 2026. Phase 4 implementation and focused automated validation are
complete. PSYLO remains a **reference** preset, revision 2, ready for choreography
review. **Phase 5 has not begun.** No commit was requested or created.

## Implemented behavior

The manifest now declares ten shared Choreography routes. Shared runtime smoothing,
event deduplication and envelopes replace Phase 3's native amplitude envelopes;
there is one response path. All routes replace internal module channels rather
than user controls. Native code validates delivery/freshness, gates event windows,
applies Music Response once and interprets each pattern's spatial vocabulary.
Final response values compose through the existing target resolver.

Each of the eight patterns has its own kick/snare/beat/build/drop geometry program:
radial waves, tangential spiral accents, answering zones, local canopy opening,
angular ring banks, directional relays, vertical ascent and preparation/release.
Cap/gill/mycelium emission has corresponding spatial accents independently of the
geometry hard enable. Native spores receive bounded snare lift/occupancy accents
and blend their pattern-specific rise rather than cutting between programs.

Automatic Pattern changes blend for **350 ms** using smoothstep weights. Interruption
continues from the current mixture. Manual Pattern edits and same-value reselection
remain immediate while Pattern Change stays ON; stale active events cannot undo
them. Trigger/permission edits and seek/source reconstruction also select their
base immediately. No saved Pattern, Trigger, permission, palette or layout value is
rewritten by choreography. Pause, motion OFF, amount zero and speed zero hold blend
progression. Music Response zero restores native response immediately and leaves
Pattern Change independent.

## Rule register

All source values are clamped to 0–1. Continuous routes use exponential smoothing;
the listed time is the attack **and** release time constant, not a finite envelope.
Missing facts restore authored fallback immediately. This deliberately favors
fresh evidence over extrapolation. The originally proposed asymmetric continuous
times were starting ranges; this implementation uses the shared runtime's existing
symmetric smoothing. Event times are finite seconds, independent of BPM Sync.

| Rule/source | Internal target | Operation / maximum | Attack / release | Conditions |
|---|---|---|---|---|
| `audio.features.overallEnergy` | `choreoEnergy` | Replace fact ≤1; native movement gain 0.6–1 | 180 / 180 ms | Shared features available |
| `audio.bands.bass` | `choreoBass` | Replace fact ≤1; native lateral bend ≤0.24 | 120 / 120 ms | Shared bands available |
| `audio.bands.high` | `choreoHigh` | Replace fact ≤1; spore gain 0.55–1 | 90 / 90 ms | Shared bands available |
| `audio.features.vocalPresence` | `choreoVocal` | Replace fact ≤1; multiplicative restraint 0.65–1 | 200 / 200 ms | Vocal presence available |
| `audio.features.buildProgress` | `choreoBuild` | Replace fact ≤1; convergence ≤0.15 per axis | 250 / 250 ms | Build available; native confidence gate ≥0.45 |
| `audio.structure.buildConfidence` | `choreoBuildConfidence` | Replace fact ≤1; permission only | Immediate / immediate | Build confidence available |
| Shared kick | `choreoKick` | Replace envelope ≤0.12 | 20 / 220 ms | Rhythm events available, confidence ≥0.45, once per event |
| Shared snare | `choreoSnare` | Replace envelope ≤0.15 | 10 / 180 ms | Same as kick |
| Shared beat | `choreoBeat` | Replace envelope ≤0.06 | 10 / 250 ms | Shared beat grid, confidence ≥0.45, once per event |
| Shared semantic drop | `choreoDrop` | Replace envelope ≤0.25 | 20 / 800 ms | Shared drop capability, confidence ≥0.45, fresh crossed marker, once per event |

Ownership for **every row**: the shared runtime owns only transient delivery. The
user owns Music Response, amount/speed/enables, emission/master, spore ceiling and
all design values. Music Response is applied once after delivery. Continuous
unavailable sentinels distinguish missing analysis from measured zero. Events on
activation, resume, analysis refresh/return or discontinuity cannot acquire native
output authority until a fresh accepted identity arrives. A new latched identity
also cannot reuse an older event's active window.

The native adapter supplies event travel progress, not another attack/release
curve. Spatial programs consume normalized/world-unit accents before the final
root-weighted displacement clamp. Combined deformation stays within **0.75 × the
resolved user amount**; convex pattern blends preserve that bound and the existing
camera clearance envelope. Geometry OFF, amount zero and speed zero prevent audio
displacement. Emission zero suppresses all emissive accents; Master zero suppresses
emission/spore opacity while leaving physically lit surfaces readable. Spore count
never exceeds the user ceiling of 128 points. Colors, roots, scale, camera authority
and physical lighting are unchanged.

Emission multiplies the authored level by a bounded energy/event gain ≤1 and a
spatial mask of 0.85–1. At rest it uses the 0.85 mask; accepted events reveal brighter
banks/fronts within the same ceiling. Build pressure restrains coincident accents.
This is surface emission choreography. Physical light-spill, shafts, atmosphere,
bloom and reference-brightness finishing remain Phase 7.

## Verification and review evidence

- **41 focused tests pass:** 26 audio/trigger/authority, 8 new shared choreography/
  transition, 3 preset and 4 existing decoded-geometry camera/clearance tests.
- **59 production assertions / 27 captures pass** through the actual Cinema 2.0
  renderer, shared AudioFeatureBus, compiler and final target resolver. All eight
  kick programs visibly deform geometry against response-zero references at the
  exact same camera/native phase, with emission/spores disabled.
- Snare/drop held publications do not retrigger; completed envelopes have zero
  active state and exactly match authored geometry at a matched phase. Build has
  a visible bounded consumer. A held automatic blend is visibly distinct from
  both pure endpoints, pauses exactly and settles to the expected native program.
- Manual takeover preserves Pattern Change ON. Geometry/amount/speed zero and
  emission/master/spore hard limits survive a drop. Analysis gaps and seeks clear
  response to the authored base. Unit tests also cover interrupted convex blends,
  activation/revision rearming, canonical triggers, pause/resume and target bounds.
- Spatial emission is visibly independent of geometry motion. Reviewed production
  captures: [emission accent](PSYLO-phase4-emission.png) and
  [automatic transition](PSYLO-phase4-transition.png).
- No browser/shader errors, failed/degraded modules or failed passes. Disposal
  leaves zero module resource leases, envelopes or transient contributions.
- TypeScript and scoped ESLint pass. Working tree/diff, whitespace and local
  documentation links were checked. Prepared assets, source attribution, shared
  runtime implementations and Inspector controls/typography were not changed.

Reproduce:

```sh
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2PsyloAudio.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2PsyloChoreography.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2PsyloPreset.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2PsyloCamera.test.ts
node scripts/cinema2-assets/accept-psylo-phase4.mjs
npm run typecheck
```

Full machine-readable production evidence is
`artifacts/cinema2-psylo-phase4/report.json`. Earlier scripts/reports are historical
checkpoints; Phase 3's immediate-switch/unsmoothed-response pixel expectations are
superseded by this phase's focused production gate.

The deterministic fixture validates integration and rendered behavior. Live-track
musicality and desktop/GPU performance still require later human/full-app review.
Phase 5 will add bounded Visual Director meaning to this working choreography.
Auto Performance and atmospheric/lighting finishing remain later phases.
