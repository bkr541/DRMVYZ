# 06. Phase-by-Phase Implementation Plan with Exit Gates

**Read this document while coding.** Every phase requires a file diff, tests/evidence and an explicit STOP/GO. The detailed behavior documents in this ZIP are specifications; the checked-in root `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` is the authoritative implementation standard.

## Phase 0: Verify branch and inventory (no implementation)

**Objective:** establish the actual current code and eliminate mistaken assumptions.

**Tasks**

1. Review repository-wide `AGENTS.md`, `AI_IMPLEMENTATION_CONTRACT.md`, preset-creation contract §8–§10 and §23–§25.
2. Inspect the exact named files in `00_SOURCE_AUDIT.md` and the current production Cinema 2.0 entry point.
3. Confirm new ID `drmvyz.cinema2.canopy` and native module type/version are absent; scan for any collisions.
4. Confirm schema fields, authoring gate, compile registration, render graph, active renderer and resource acquisition APIs.
5. Validate trigger list comes from `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS`; inspect shared Pattern controller and playback frame contract.
6. Confirm tests can run with repository commands, capture baseline state, flag pre-existing failures rather than attributing them to CANOPY.
7. Document which effects and quality tiers are actually available. Record whether preset BPM Sync should be independent from or gated by Audio Dock Sync.

**Artifacts:** source-audit notes, architecture choices, initial known-failures report and implementation branch/checkpoint.

**EXIT GATE P0:** verified module/manifest registration, supported schema and no fabricated APIs. **Stop if the code diverged enough to invalidate the design.**

---

## Phase 1: Lock visual and behavior contract (no music code)

**Objective:** intentional art direction and clear ownership **before** implementation.

**Tasks**

1. Confirm default 8×8 rods, geometric dimensions, render-space, tip/ceiling safety, mounting grid and camera composition from `01`.
2. Set six pattern identities with distinct geometry/movement from `04`; choose fixed seed and phase origins.
3. Approve complete Inspector parameter matrix with five independent Palette colors and controls under exactly four parent groups from `03`.
4. Sign off manual/automation authority table and Auto Performance scope from `05`.
5. Create baseline image/reference checklist for idle frame, six motion families, kick, snare, build, drop, vocals, narrow aspect.
6. Choose maximum complexity constraints: ≤144 rods, one/few instanced draw batches, ≤3 non-ambient lights recommended, no new major engine layer.

**Artifacts:** signed-off visual spec, geometry bounds, control-to-render map, authority matrix, six-pattern library and expected evidence screenshots. These planning docs can be copied/updated in the repository's `docs/` folder by coding agent.

**EXIT GATE P1:** every visible control has one user-facing effect, every source signal has a documented target, every pattern has a unique physical silhouette. **Stop if reviewers cannot tell patterns apart by geometry.**

---

## Phase 2: Native geometry, camera and static render

**Objective:** correct hero visual on production stage with **no musical intelligence**.

**Code changes**

- Create `modules/canopy/Cinema2CanopyDomain.ts` with typed fixture addresses, static configuration clamps, layout bounds and stable seed use.
- Create `modules/canopy/Cinema2CanopyLayout.ts` to produce root positions/top caps/diffuser geometry, instance packing and stable row-major order.
- Create `modules/canopy/Cinema2CanopyRenderer.ts` with required native WebGL2 shader/vertex buffers/instance buffer; device-memory report, resource disposal and one/few batches.
- Create `modules/Cinema2CanopyNativeModule.ts` with module ID/version, validation, resource facet, world render provider and static parameter reading; no new RAF.
- Create skeleton `presets/Cinema2CanopyPreset.ts`: capabilities, module, root node, depth world layer, static camera/safety, background environment, depth-bearing scene color render pass/output.
- Register module + keeper preset through existing registries, initially hidden/test-scoped if product supports it safely; avoid exposing incomplete preset publicly.

**Tests and visual proof**

- Deterministic same-seed layout; unique stable fixture index; total count ≤ cap; finite matrices/colors/bounds.
- Build/compile/authoring checks for capability/ref/scene/layer/render pass.
- Real production renderer must show recognizable suspended rods and overhead mounting with bloom OFF.
- Captures at 16:9, square, portrait and resize; verify depth occlusion, color channels, structure and cropping.
- No shader compilation failures, GL errors, leaked resources or extra lights per rod.

**EXIT GATE P2:** human confirms hero composition and zero-audio readability. **Do not proceed to effects or audio if the static visual is wrong.**

---

## Phase 3: Full Inspector, persistent manual controls and palette

**Objective:** every public control affects real render output before automation.

**Code changes**

- Fully author parameters, `module.parameters` and `parameterBindings` using existing `cinema2Ref`, `designParentGroup` and `visibleWhen` mechanisms.
- Implement mandatory BPM Sync boolean, Pattern enum, Pattern Change boolean, Trigger enum and **five real independent color roles**.
- Wire environment background color, primary/secondary/accent/shade or structure colors, structure controls, light intensity and hard-disable behavior.
- Implement Pattern Change conditional Trigger display and state persistence without coupling it to Auto Performance.
- Clamp over-budget grid sizes and rebuild instance buffers safely on row/column changes.
- Wire any optional camera/effect public controls only if supported by real consumers; delete optional placebo settings.

**Tests and visual proof**

- Inspector hierarchy and types (`Design > Master Controls / Design / Effects / Palette`) and required order.
- Each control min/default/max or every enum choice produces a distinct expected production screenshot at a stable time, including a visible material/cap test for Structure color.
- Palette independence: edit one of five colors and demonstrate no accidental alias with the others.
- Rows and Columns actual instance count changes; Motion Amount 0 stops physical movement later.
- Trigger hidden while OFF, restored chosen value when ON; BPM Sync reaches timing consumer (timing contrast fully proven in Phase 4).

**EXIT GATE P3:** **all required controls** exist, are schema-valid and have real output consumers; no control changes only Inspector state. If an optional enhancement isn't implemented, omit its UI control.

---

## Phase 4: Six real geometry patterns and timing

**Objective:** pattern-specific motion and deterministic clock on the real canvas.

**Code changes**

- Create `modules/canopy/Cinema2CanopyPatterns.ts` pure evaluators for Waterfall, Crosswave, Crown, Split Wings, Checker Lift, Downpour.
- Compute actual rod transforms/length variation/fixture-group emissions per frame; geometry changes must be visible even with effects OFF.
- Create `Cinema2CanopyOrchestration.ts` for controller state, hand-authored pattern base, deterministic cycle, phase origin and transitions.
- Wire Pattern Change with reusable shared controller and canonical trigger identity; guarantee no repeat and no stale event; actual musical auto-switch may be proofed in Phase 5.
- Implement BPM Sync ON (shared grid/clock) and OFF (deliberate free-run) with reset-safe compositing; no local beat detector.
- Freeze simulation on pause and handle track/seek/loop/context/preset changes.

**Tests and visual proof**

- Geometry snapshots/trajectory arrays prove six unique height formations, including every named pattern.
- All patterns remain interesting with identical color/emission and stationary camera.
- Manual pattern change immediately acts with Pattern Change OFF or ON; no new Trigger means no spontaneous switch.
- Motion Amount 0 physically freezes while luminosity can still be controlled.
- At non-reference BPM, Sync ON/OFF behave differently; pause, resume, seek, loop, Sync toggle do not jump unpredictably.
- Four+ frame filmstrip for each moving pattern demonstrates real pixels and geometry motion.

**EXIT GATE P4:** six physically distinct patterns + full primary manual/timing control verified. **Stop if the module changes only brightness or only internal numbers.**

---

## Phase 5: Shared Audio Intelligence + event-driven Pattern Change

**Objective:** visibly react to real audio without duplicating analysis logic.

**Code changes**

- Consume `frame.audio`, published rhythm event IDs, transport, structure and director fields; add valid required/optional manifest capabilities.
- Add manifest choreography rules for continuous sub/bass/mid/high/energy/vocal/build; module-resolved channels translate them to bounded physical movement plus lighting.
- Add kick/snare/downbeat/phrase/section/drop event envelope rules with different geometry addresses and timings.
- Use shared canonical 11 Trigger identities to advance Pattern Change; handle multi-frame duplicate events and source lifecycle.
- Never trigger an event from a homemade BPM timer; degrade cleanly when some analyzed capabilities are unavailable.

**Tests and visual proof**

- Audio fixture cases: silent, low-energy verse, steady beat, bass-heavy, snare passage, vocal passage, build, drop, phrase and section changes.
- Confirm **physical** motion on kick and bass, differentiated snare bank and structural geometry change at build/drop.
- Test all 11 trigger choices, including subdivisions, no duplicates and no immediate trigger on manual edit/toggle/trigger change.
- Real analyzed-track or deterministic Audio Intelligence fixture rendered through production path, not merely isolated module unit-test data.

**EXIT GATE P5:** production visual clearly changes with music, including continuous, rhythmic and structural categories, and canonical trigger control is reliable.

---

## Phase 6: Visual Director, bounded choreography and Auto Performance

**Objective:** smarter musical meaning without usurping authored choices.

**Code changes**

- Add Visual Director significance multipliers to bounded motion, build tension and impact; Director must not pick fixture identity or override saved palette.
- Add/finish Auto Performance toggle default OFF: recommended narrow version modulates temporary build/drop geometry and optional camera/effect intensity, **not** base pattern selection. If adding temporary Downpour overrides, implement explicit event windows and proper underlying controller restoration.
- Apply documented property authority matrix and hard disables (Motion Amount 0, Master Intensity 0, Camera Motion OFF, Bloom 0).
- Verify base + transient contributions resolve once, clamp at final output and decay to authored values.
- Keep Pattern Change fully independent; manual Pattern choice while ON still takes immediate effect and remains until next fresh selected Trigger.

**Tests and visual proof**

- Auto OFF vs ON should have a purposeful, measurable difference at builds/drops while normal chosen pattern remains recognizable.
- Edit each auto-adjacent control and confirm immediate manual authority according to matrix.
- If temporary performer override supported: event-only entry, bounded life, no saved Pattern rewrite and correct return to latest base even when valid Trigger advanced under override.
- Repeated seek/track change doesn't cause phantom peak state.

**EXIT GATE P6:** automation adds intelligible character but never fights user, false events or control hard OFF. If not implementing pattern overrides, document that intentionally.

---

## Phase 7: Cinema 2.0 finishing, optimization and resilience

**Objective:** polished but recognizably the same preset, with controlled cost.

**Code changes**

- Add restrained engine HDR bloom and optional cinematic finish using available effect/render graph bindings. Depth/haze is optional; do not add feedback/trails simply for checkbox completeness.
- If Camera Motion control remains in UI, implement bounded camera orbit/dolly authored through engine camera choreography; when OFF truly zero motion.
- Validate GPU-memory accounting, buffers regenerated on topology edits and disposed on preset re-entry/WebGL recovery.
- Test performance at 64 default and highest supported grid under low/high quality tiers.
- Avoid physical fixture light-per-rod, heavy multiple shadow maps, physics, extra scene renderer or model asset downloads.

**Tests and visual proof**

- Bloom OFF/default/max and Camera Motion OFF/ON with meaningful visible differences and no clipping.
- Preset entry/re-entry, source switch, resize, context restore, runtime diagnostics and GL leak checks.
- Performance baseline vs added CANOPY: measure frame time, GPU estimate, total light count, draw calls and absence of accumulating buffers; define and approve thresholds for supported devices before release.

**EXIT GATE P7:** effects enhance existing geometry; no regression in composition, timing, or target ownership; performance acceptable on intended hardware.

---

## Phase 8: Production acceptance and release

**Objective:** prove the exact released experience end-to-end.

**Code changes**

- Finish focused unit/registry/inspector tests and dedicated production browser harness `scripts/run-cinema2-canopy-browser.mjs` (or appropriately integrated Playwright spec).
- Add a dedicated package script if useful; update official preset documentation and final controls help text.
- Capture final reference frames, motion filmstrips and analyzed/deterministic music cases. Human review against `01`/`04` and root creation contract.
- Review diff for unrelated edits, compile and run proportional checks, package only intended files, document unresolved risks.
- Register/expose as a finished keeper only **after** Phase 8 stop-ship checks pass.

**Commands (verify against current `package.json`)**

```bash
npm run typecheck
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2CanopyPreset.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2CanopyGeometry.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2CanopyAudio.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2CanopyNativeRendering.test.ts
npm run build
# Once authored and registered:
node scripts/run-cinema2-canopy-browser.mjs
```

`npm run verify:fast` and repository-wide checks may be warranted for merge but should not be run repeatedly when known unrelated failures exist, per `AGENTS.md`. Browser harness shown does **not** exist yet and is an implementation deliverable, not an already-working command.

**EXIT GATE P8:** full `09_RELEASE_GATE.md` complete, production canvas/human review passed, diff/test results recorded, ready for release. **Unit tests alone never equal DONE.**

---

## Dependency / parallelization map

```text
P0 Audit -> P1 Visual contract -> P2 Static native rendering -> P3 Controls
                                                    -> P4 Pattern geometry / timing
                                                    -> P5 Shared Audio Intelligence
                                                    -> P6 Director / Auto authority
                                                    -> P7 Effects / performance
                                                    -> P8 Production sign-off
```

Tests can be authored in parallel with each phase. **Do not pull finishing forward** to hide a poor P2 geometry. Avoid expanding scope when a phase is blocked.

## Phase review template

```text
Phase:
Files added/edited:
Visual differences observed:
Required acceptance evidence / screenshot paths:
Focused automated test commands + pass/fail:
Known failures (new vs pre-existing):
Authoring / authority / performance implications:
Exit gate: PASS / FAIL (reason):
Next allowed phase:
```
