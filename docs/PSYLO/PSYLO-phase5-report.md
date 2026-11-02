# PSYLO — Phase 5 Visual Director meaning

Historical checkpoint. Current implementation: [final report](PSYLO-final-report.md).

November 2, 2026. Phase 5 implementation and focused automated validation are
complete. PSYLO remains a **reference** preset, revision 2, ready for musical review.
**Phase 6 has not begun.** No commit was requested or created; Phase 4 and Phase 5
work remain uncommitted.

## Result and ownership

The shared Director now shapes PSYLO's existing choreography with intensity,
momentum, build pressure, impact and section-transition significance. Four new
continuous routes and one section-change envelope feed internal module targets;
the manifest now has 15 Choreography rules. The native adapter validates the
Director/audio relationship and applies bounded meaning before final music-target
resolution. The existing shared Director, Choreography engine and renderer were
not modified.

Quieter sections restrain range/light; higher momentum restores permitted motion
range and bends. Supported section build context gathers the current program even
when raw build-progress is zero. Strong fresh impact reinforces an already accepted
release, while a significant section change adds a small settling gesture through
the selected pattern's existing vertical/beat vocabulary. Supported vocals receive
additional motion/spore restraint. These effects use **Music Response**, with no
new Inspector controls. Zero restores native authored response immediately and
keeps Pattern Change independent.

Director never selects a Pattern, writes a parameter, changes palette/layout/scale,
alters camera limits/timing or enables a disabled domain. Geometry programs and
spatial choreography remain in PSYLO. All Phase 4 action maxima and the final
0.75 × resolved user amount displacement bound remain intact. Geometry, amount,
speed, emission, spore and master permissions remain authoritative. Physical
surfaces remain readable at Master zero, as before.

## Five route records

All targets are internal module channels; **replace** applies only to transient
facts/envelopes. Each source is clamped to 0–1. Continuous smoothing uses the shared
runtime's symmetric exponential time constant. Music Response scales each added
influence once; it does not rescale the Phase 4 result a second time.

| Source / internal target | Timing | Maximum visible influence | Conditions / ownership |
|---|---|---|---|
| `director.intensity` → `choreoDirectorIntensity` | 240 / 240 ms smoothing | Range factor 0.85–1; emission factor 0.9–1 at full response | Matching frame/generation, signal confidence ≥0.45; user amount/emission ceilings retained |
| `director.momentum` → `choreoDirectorMomentum` | 320 / 320 ms smoothing | Adds ≤0.10 to macro range factor, total capped at 1; bass-bend factor 0.88–1 | Same validity/confidence; never changes motion speed/camera or undoes vocal restraint |
| `director.build` → `choreoDirectorBuild` | 300 / 300 ms smoothing | Current program convergence `max(raw build, 0.15 × response × meaning)` | Supported shared build context, confidence ≥0.45; original 0.15 maximum retained |
| `director.impact` → `choreoDirectorImpact` | Immediate authority sampling; ≤820 ms qualification window | Existing event gain ≤1.25, then kick/snare/beat/drop maxima 0.12/0.15/0.06/0.25; light headroom ≤8% | Fresh event identity, occurred/available, confidence ≥0.45, authority ≥0.65; cannot create a drop or replace a Pattern |
| Shared `section-change` → `choreoDirectorTransition` | 120 ms attack / 600 ms release, no hold | Shared envelope ≤0.04, added to current vertical/beat gesture within 0.06 total and bounded emission headroom | Sections available; once per event; native matching section-change context, confidence ≥0.45 / authority ≥0.5; no Pattern advancement |

Supported vocals add at most 8% motion/spore restraint. The combined range factor
is capped at 1 and resolved motion gain is floored at 0.4. Director light additions
use remaining headroom, so final surface-emission gain never exceeds 1. Spore count
stays below the authored ceiling. Missing individual numeric routes are neutral,
including a missing momentum route; unavailable context is not a measured zero.

Director frame ID and discontinuity generation must match the **validated selected
audio**. Invalid/missing context clears event significance and restores the exact
Phase 4 response. Activation, seek/loop/source/context reset, analysis replacement/
return and resume latch current event identities; stale events cannot arm a new
accent. A short retained impact authority qualifies existing shared envelopes;
it does not introduce a parallel native amplitude envelope. The transition
attack/release belongs to shared Choreography. Host pause holds the composed
result once rather than compounding Director gains each frame. Music Response
zero remains effective during pause.

## Focused verification

- **44 focused tests pass:** 7 new Director tests, 26 audio/trigger/authority tests,
  8 choreography/transition tests and 3 preset/compiler/authoring tests. New cases
  exercise shared target delivery, saved-state immutability, matching frame/
  generation, missing routes/context, confidence, qualified impacts, release,
  activation/reset/resume latches, pause, vocal restraint and output ceilings.
- **52 production assertions / 20 captures pass** through two real Cinema 2.0
  runtimes. Both receive identical upstream publications, manual settings,
  transport and final camera pose. The baseline test registry omits only the five
  Phase 5 routes; both runtimes still compute real shared Director frames. There
  are no synthetic Director signals, modified product controls or renderer mocks.
- Paired images visibly differ for quiet/energetic range, vocals, section build
  meaning with raw build-progress zero, impact release, section transition and
  independent emission. Geometry comparisons disable emission and spores.
- Music Response zero, unavailable analysis and sought authored base match the
  baseline **exactly** (mean pixel difference 0). Pause holds the Director result
  exactly. Strong build/drop inputs cannot bypass motion/amount/speed, emission,
  spore or master limits. Both arms retain identical saved manual values.
- No browser/shader errors, failed/degraded modules or failed passes. Disposal
  clears both runtimes' module leases, envelopes and transient contributions.
- TypeScript, scoped ESLint, whitespace and local documentation links pass. Diff
  review preserves the existing Phase 4 work. Assets, camera routes, geometry
  shaders, shared runtime implementations and typography are unchanged by Phase 5.
  The existing Phase 4 maximum-displacement clearance proof remains applicable;
  its expensive decoded-geometry test was not repeated for this bounded adapter.

Production review pairs:

| Context | Director | Baseline |
|---|---|---|
| Geometry: supported build context | [Enabled](PSYLO-phase5-build-context-director.png) | [Routes omitted](PSYLO-phase5-build-context-baseline.png) |
| Surface emission: quiet context | [Enabled](PSYLO-phase5-light-context-director.png) | [Routes omitted](PSYLO-phase5-light-context-baseline.png) |

Reproduce:

```sh
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2PsyloDirector.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2PsyloAudio.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2PsyloChoreography.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2PsyloPreset.test.ts
node scripts/cinema2-assets/accept-psylo-phase5.mjs
npm run typecheck
```

Full production evidence: `artifacts/cinema2-psylo-phase5/report.json`. Browser
`?director=off` is a test-harness-only baseline registry, not a hidden production
mode. Earlier phase scripts/reports remain historical checkpoints.

Live-track musicality and desktop/GPU performance still need human/full-app review.
PSYLO remains unfinished overall: Phase 6 will add scoped Auto Performance/manual
takeover; Phase 7 will finish physical lighting/atmosphere/bloom and reference
brightness; Phase 8 will perform final integrated acceptance and keeper review.
