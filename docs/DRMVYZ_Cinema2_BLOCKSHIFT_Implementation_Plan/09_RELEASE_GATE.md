# 09. BLOCKSHIFT production release gate

**Phase 9 decision: NO SHIP.** The user explicitly approved the reviewed visuals and behavior during this phase. Automated BLOCKSHIFT acceptance passes. Whole-repository type/build/test release checks remain unresolved, and there is no final committed release candidate. BLOCKSHIFT stays **Preview**, registered as a reference preset.

PASS below means the criterion has recorded evidence. FAIL identifies a failing release check; BLOCKED identifies work requiring its resolution. Human approval is separate from automated assertions. This gate uses the approved fifteen-object immersive field, including intentional peripheral cropping and rear cubes.

## Gate record

| Field | Record |
|---|---|
| Repository / branch | DRMVYZ / `main` |
| Base commit | `9c2aa74831103c1589e589c8cedc5af5f94f1643` |
| Release commit | None; implementation remains uncommitted. Final committed-candidate validation is BLOCKED. |
| Preset | `drmvyz.cinema2.blockshift`, revision 17 |
| Module type / instance | `blockshift-native` / `blockshift-sculpture`; one registry/catalog declaration each |
| Date | 2026-10-23; timestamp and file hashes in [checkpoint](evidence/p9-signoff/checkpoint.json) |
| Contract | Current root contract, SHA-256 `d7d55dd94b25894972a020b7e3ee20048247b8b2b90e923d2af87b3da49cd96f` |
| Candidate source digest | `1712ae4c566e948d5a4b64bdb2e2839d938e6e52b269613b08d43709f6f17137` — scoped filesystem digest, not a Git commit |
| Environment | macOS arm64; Node 22.23.3; Chromium 149.0.7827.55; ANGLE Metal / Apple M3 Pro |
| Reviewers | User: explicit visual/behavior approval; Codex: automated checks/evidence audit |
| Evidence | [Phase 8](28_P8_PRODUCTION_ACCEPTANCE_REPORT.md), [Phase 9](29_P9_RELEASE_SIGNOFF_REPORT.md), [user guide](30_BLOCKSHIFT_USER_GUIDE.md), [candidate notes](31_BLOCKSHIFT_RELEASE_NOTES.md) |

## P0/P1: source and specification

| ID | Criterion | Status / evidence |
|---|---|---|
| G01 | Latest source/root standard; unique BLOCKSHIFT IDs | PASS — [source/contract digest and declarations](evidence/p9-signoff/checkpoint.json); [fresh compiler/registration tests](evidence/p9-signoff/preset-disposal-validation.log). |
| G02 | Specification, fifteen identities and ownership approved | PASS — user-directed GLB/immersive/count revisions and Phase 9 visual approval; [current field](evidence/p8-acceptance/phase8-visual-review.png). |
| G03 | Six distinct safe formations approved | PASS — [normalized filmstrips](evidence/p8-acceptance/six-pattern-filmstrips.png), geometry-envelope tests and user approval. |
| G04 | Manual authority, BPM Sync and shared consumers specified | PASS — [actual bindings/proof](10_REQUIREMENTS_TRACEABILITY.md), [guide](30_BLOCKSHIFT_USER_GUIDE.md). |

## P2: native pipeline and visuals

| ID | Criterion | Status / evidence |
|---|---|---|
| G05 | One manifest/module registration; valid compiler/authoring output | PASS — [declaration audit](evidence/p9-signoff/checkpoint.json), [11 fresh tests](evidence/p9-signoff/preset-disposal-validation.log). Registration remains reference/Preview. |
| G06 | Fifteen stable blocks, faces, LED frames and world/depth camera | PASS — [workspace/GPU records](evidence/p8-acceptance/acceptance.json), fresh identity/model/geometry tests. |
| G07 | Production canvas renders with audio and Bloom OFF | PASS — [static landscape](evidence/p8-acceptance/idle-bloom-off-16x9.png), [exact static assertions](evidence/p8-acceptance/acceptance.json). Atmosphere is also OFF for these structural captures. |
| G08 | No per-frame GPU-object allocation, shader failure or unresolved resources | PASS within the tested matrix — [profiling/lifecycle](evidence/p8-acceptance/polish-acceptance.json), [LED checks](evidence/p8-acceptance/led-acceptance.json), fresh partial-allocation/late-load cleanup tests. |

## P3: Inspector and controls

| ID | Criterion | Status / evidence |
|---|---|---|
| G09 | Exactly four parent classes | PASS — Master Controls, Design, Effects, Palette in [actual Inspector checks](evidence/p8-acceptance/acceptance.json). |
| G10 | Editable Master Controls BPM Sync with timing consumer | PASS — [local/host Sync and BPM matrix](evidence/p8-acceptance/timing-acceptance.json). |
| G11 | Pattern / Pattern Change / Trigger grouped/ordered under Design | PASS — [Inspector](evidence/p8-acceptance/production-inspector.png), [control results](evidence/p8-acceptance/acceptance.json). |
| G12 | Boolean Pattern Change OFF default; conditional Trigger/value retention | PASS — [visibility/persistence](evidence/p8-acceptance/acceptance.json), [focused controls tests](evidence/p8-acceptance/focused.log). |
| G13 | Exact canonical eleven labels/values/semantics | PASS — shared option source, [eleven OFF/ON cases](evidence/p8-acceptance/audio-acceptance.json), [duplicates](evidence/p8-acceptance/phase8-acceptance.json). |
| G14 | Five independently effective palette roles | PASS — [five-color output](evidence/p8-acceptance/palette-five-independent-colors.png), individual pixel masks in the workspace report. Body also colors LED housings. |
| G15 | Visible consumers and numeric min/default/max checks | PASS — [static ranges](evidence/p8-acceptance/acceptance.json), [equal-time temporal ranges/durations](evidence/p8-acceptance/phase8-acceptance.json), [FOV/Bloom/fixed quality modes](evidence/p8-acceptance/polish-acceptance.json). Auto quality uses the shared tested policy and was not separately profiled. |

## P4: motion, tempo and patterns

| ID | Criterion | Status / evidence |
|---|---|---|
| G16 | Six distinct geometric programs | PASS — [filmstrips](evidence/p8-acceptance/six-pattern-filmstrips.png), [motion/GPU results](evidence/p8-acceptance/motion-acceptance.json), human approval. |
| G17 | Visible physical motion and fifteen stable identities | PASS — four normalized phases per program with pixel/GPU comparisons in [phase results](evidence/p8-acceptance/phase8-acceptance.json). |
| G18 | Eased transitions; finite/separated geometry | PASS — [transitions](evidence/p8-acceptance/motion-acceptance.json), [fresh envelope tests](evidence/p9-signoff/preset-disposal-validation.log). Paused/zero-motion manual edits deliberately snap to the selected base. |
| G19 | Correct local BPM Sync ON/OFF and host independence | PASS — [60/180 BPM and local/host combinations](evidence/p8-acceptance/timing-acceptance.json). |
| G20 | Pause/resume/seek/loop/source/re-entry safety | PASS for controlled transport fixtures — [transport](evidence/p8-acceptance/phase8-acceptance.json), [chooser re-entry](evidence/p8-acceptance/acceptance.json), [orbit](evidence/p8-acceptance/orbit-acceptance.json). Loop coverage is a backward transport jump, not an audio-player integration test. |

## P5: audio and events

| ID | Criterion | Status / evidence |
|---|---|---|
| G21 | Shared Audio Intelligence/choreography; no private analysis | PASS — manifest/shared capabilities and native consumers; [production bridge fixture](evidence/p8-acceptance/audio-acceptance.json). |
| G22 | Meaningful bounded rhythm/structure/build/drop changes | PASS — [geometry contrasts](evidence/p8-acceptance/audio-acceptance.json), [LED circuits](evidence/p8-acceptance/led-acceptance.json), user approval. |
| G23 | Eleven triggers require new events; duplicates ignored | PASS — [positive matrix](evidence/p8-acceptance/audio-acceptance.json), [duplicate publications](evidence/p8-acceptance/phase8-acceptance.json). |
| G24 | Pattern Change OFF protects base while audio continues | PASS — eleven OFF/ON comparisons and authored-pattern checks in the audio report. |
| G25 | Manual Pattern while ON has priority; toggle/stale protection preserved | PASS — [manual/new-event browser checks](evidence/p8-acceptance/phase8-acceptance.json), [authority tests](evidence/p8-acceptance/focused.log). |

## P6: authority and Auto Performance

| ID | Criterion | Status / evidence |
|---|---|---|
| G26 | Auto OFF default; limited domains documented | PASS — manifest default, [guide](30_BLOCKSHIFT_USER_GUIDE.md), [Auto matrix](evidence/p8-acceptance/performance-acceptance.json). |
| G27 | Build/drop overlay preserves saved settings | PASS — authored serialization/hue comparisons in the Auto matrix. |
| G28 | Current base resumes, including valid Trigger progress | PASS — settled Auto OFF/ON comparisons, focused overlay/controller tests and [recording](evidence/p8-acceptance/phase6-performance.webm). |
| G29 | Manual edits and hard disables survive Auto | PASS — takeover/cooldown and disable checks in the Auto matrix; [atmosphere/rotation authority](evidence/p8-acceptance/refinement-acceptance.json). |

## P7/P8: camera, effects, performance and production browser

| ID | Criterion | Status / evidence |
|---|---|---|
| G30 | Camera/depth at three aspects for all six patterns | PASS — [18 combinations/FOV extremes](evidence/p8-acceptance/polish-acceptance.json), [live wet resize](evidence/p8-acceptance/phase8-acceptance.json). |
| G31 | Bloom/camera/atmosphere OFF honored | PASS — [Bloom restoration](evidence/p8-acceptance/polish-acceptance.json), [atmosphere bypass](evidence/p8-acceptance/refinement-acceptance.json), [camera disable](evidence/p8-acceptance/orbit-acceptance.json). |
| G32 | Production React renderer/chooser/Inspector exercised | PASS — [normal application](evidence/p8-acceptance/acceptance.json). Controlled audio/transport fixtures additionally use the production runtime; no real-file analysis claim. |
| G33 | Twelve-light limit and native efficiency target | PASS — no BLOCKSHIFT physical lights; four instanced batches, 722,040 module GPU bytes in production diagnostics and fresh resource tests. |
| G34 | No growing resources/stale state on re-entry | PASS — [three chooser switches](evidence/p8-acceptance/acceptance.json), [recreations/dry recovery](evidence/p8-acceptance/polish-acceptance.json), [wet recovery](evidence/p8-acceptance/wet-context-diagnostics.json), fresh disposal tests. |
| G35 | Typecheck/build/focused/adjacent tests pass or have approved release disposition | **FAIL for full release checks** — focused/affected tests and Vite bundling pass. Existing typecheck failure blocks `npm run build`; broad-suite failures are classified but have no release waiver. [Baseline comparison](evidence/p8-acceptance/baseline-comparison.json), [types](evidence/p8-acceptance/types.log), [full-command baseline](12_P0_CURRENT_SOURCE_AUDIT.md). |
| G36 | Human filmstrip/audio/authority/visual review approved | **PASS — user answered “Approve the reviewed visuals and behavior”** in Phase 9, covering composition, six patterns, rotation/camera, LED atmosphere and audio/build/drop. [Approval](evidence/p9-signoff/checkpoint.json). |

## P9: candidate and documentation

| ID | Criterion | Status / evidence |
|---|---|---|
| G37 | Controls, six patterns and release notes documented | PASS — [guide](30_BLOCKSHIFT_USER_GUIDE.md), [candidate notes](31_BLOCKSHIFT_RELEASE_NOTES.md), [exact consumer trace](10_REQUIREMENTS_TRACEABILITY.md). |
| G38 | Final IDs/capabilities/resource disposal verified | PASS for this filesystem candidate — [11-test log](evidence/p9-signoff/preset-disposal-validation.log), [declarations/capabilities/digest](evidence/p9-signoff/checkpoint.json). |
| G39 | Validation at final release commit | **BLOCKED** — no release commit exists while G35 remains unresolved. The source digest is not a commit hash. |

Fresh GPU queries were unavailable in the measured windows. GPU percentiles remain `null`; CPU p50/p95 and allocation observations are recorded in [Phase 8](28_P8_PRODUCTION_ACCEPTANCE_REPORT.md). This is a disclosed measurement limitation, not a cross-device performance guarantee.

## Absolute no-ship criteria and sign-off

Automated evidence and human approval support geometry, controls, six patterns, shared audio, event/manual authority, Auto restoration and hard disables. The context-loss race was fixed and revalidated. Production screenshots and recordings exist; no new BLOCKSHIFT failures are recorded in the final matrix. These findings do not clear the separate repository release checks.

| Sign-off field | Record |
|---|---|
| Contract coverage | Technical evidence and human approval recorded; release validation/committed candidate remain open. |
| Core visuals | User approved composition and six patterns. |
| Audio/choreography | User approved reviewed audio/build/drop behavior; automated inputs remain explicitly synthetic. |
| Inspector/authority | Production control checks and focused tests pass; reviewed behavior approved. |
| Browser/performance | Browser/lifecycle and local CPU observations recorded; fresh GPU timing unavailable. |
| Unresolved issues | G35 full type/build/test release disposition; G39 committed-candidate validation. |
| Decision | **NO SHIP — retain Preview/reference registration.** |
| Reason | Visual approval is recorded, but required release checks are not all PASS. No promotion, publication or release commit was performed. |
