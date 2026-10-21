# 06. Phase-by-phase implementation | P0–P9 with STOP/GO gates

**Governing contract:** `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` §§8–10, 19–20 and 23–25. Implementation proceeds in order and requires explicit artifacts and proof before advancing. The only approved product is an instanced, shallow 3D tile floor with six physical patterns, shared Audio Intelligence and full current preset controls.

## Phase P0: Branch audit and integration preflight

**Goal:** establish which current APIs actually exist and isolate baseline regressions.

**Do**
1. Read root `AGENTS.md` / implementation contracts if present, plus root Cinema 2.0 preset contract; inspect all verified source seams listed in `00_SOURCE_AUDIT.md`.
2. Search live branch for `LIGHTFIELD`, `drmvyz.cinema2.lightfield`, `lightfield-native`, and `Cinema2Lightfield*` collisions; confirm uncommitted local changes.
3. Inspect current TypeScript types for module context and create/update/render/inspect; verify render graph scene-color+depth path and resource ownership. Identify registered capability names rather than guessing.
4. Inspect user parameter `designParentGroup` and `visibleWhen` schema; import canonical trigger options, inspect generic pattern controller and actual trigger identity helpers.
5. Inspect Audio Intelligence frame and Director/choreography target contracts. Determine best source of shared beat phase for BPM Sync ON, how host Audio Dock Sync composition works, and fallback behavior when BPM missing.
6. Inspect production test harnesses and baseline build/test scripts; run feasible existing commands, record failures and whether preexisting.
7. Confirm first-party keeper release exposure process, if any; define source files likely to be touched and accept scope non-goals.

**Deliverable:** short source-preflight report with verified API signatures, baseline results, collision status, timing policy and cost constraints.

**STOP/GO P0:** all APIs and IDs confirmed; missing critical reference or unresolved duplicate ID = **STOP**. Do not fabricate a type or patch shared infrastructure speculatively.

---

## Phase P1: Lock authored visual and authority design

**Goal:** define the look and control meanings before reactive code.

**Do**
1. Approve coordinate system XZ floor/Y up, default 8×8, tile slab/inset ratios, gap, max count 144, max lift 0.22, max tilt ±7°, matte floor/no mandatory reflections.
2. Approve static camera at a slightly elevated front angle, safe view across 16:9, square and portrait, and constraints on any optional drift.
3. Approve the six exact geometry patterns in `04`; produce small 8×8 transform/height sketches at phases 0.15, 0.45 and 0.8. Confirm no pair are just recolored aliases.
4. Sign off the primary parameter matrix in `03`: four required parent groups, ordered Pattern trio, five palette roles, BPM Sync, optional controlled Auto Performance.
5. Sign off `05` ownership table and proposed caps for music/event/Director contributions. Declare no Auto Pattern override in v1.
6. Choose source-aligned testing strategy and acceptance capture directory; create baseline evidence checklist.

**Deliverable:** approved visual brief, target component and camera bounds, controls/ownership/trigger map, six-pattern sketch matrix, expected screenshots.

**STOP/GO P1:** human reviewer can recognize a low-profile perspective LED floor and distinguish all six spatial motions by geometry. If not, revise visual concept before coding.

---

## Phase P2: Native static geometry + minimum host world render

**Goal:** establish the actual visual identity **without music**.

**Code scope**
1. Implement `Cinema2LightfieldDomain.ts` with immutable tile addresses, validated ranges, semantic banks and clamping.
2. Implement `Cinema2LightfieldLayout.ts`: stable row-major positions, centered grid, non-overlap safe bounds, per-instance static transforms and seeded grouping. Test 4×4, 8×8, 12×12, wide 4×12.
3. Implement `Cinema2LightfieldRenderer.ts`: opaque tile slab mesh, emissive inset mesh, native instancing, depth test/write, material output visible with bloom OFF, GPU-byte reporting, disposal.
4. Implement minimal `Cinema2LightfieldNativeModule.ts` definition with `create`, host-owned resource acquisition, frame-ID guard, `render.providers` world intent, `inspect` and `dispose`.
5. Add `Cinema2LightfieldPreset.ts` skeleton using typed manifest constants, module declaration, one safe perspective camera, world layer and validated color+depth render graph.
6. Register module and first-party keeper through the existing module/catalog seams. Avoid exposing as production-ready until all phases finish.

**Evidence/tests**
- Static floor screenshot on the **production** Cinema 2.0 path, bloom OFF, meaningful geometry at rest.
- Pixel/crop proof tile bodies, insets and scene background are separate surfaces, real depth ordering works, near/far clipping is controlled.
- Unit layout proofs on all grid edge cases; no NaNs, negative sizes, over-count or collision at maximal parameters.
- Manifest compiler and registry checks with no new diagnostics, WebGL errors, resource leaks or duplicated RAFs.

**STOP/GO P2:** base floor must be recognizably correct at 16:9, 1:1, 9:16 before moving to Inspector or music. A bright fullscreen pass alone is not a hero visual.

---

## Phase P3: User Inspector controls and full Palette proof

**Goal:** make every declared user control visibly functional before automation.

**Code scope**
1. Fill manifest with public parameter definitions and runtime module/camera/effect/environment bindings. Group only under top-level Master Controls, Design, Effects, Palette.
2. Add **BPM Sync** boolean in Master Controls; **Pattern / Pattern Change / Trigger** (exact order) in Design, `visibleWhen` conditional Trigger with canonical constant; six enum options.
3. Add **five independently configured color** parameters of actual `color` type: Background, Tile Surface, Primary Panels, Secondary Panels, Accent Hits, and bind each to unique visible material/environment role.
4. Add topology and motion limits: Rows, Columns, Tile Size/Gap/Thickness, Motion Amount/Rate, Lift Range/Focus, Master Intensity, Audio Sensitivity, Idle Glow, Hit Strength, optional bloom/camera only if real consumers exist.
5. Route user changes from `Cinema2ParameterState` through accepted `parameterBindings`/resolved targets into native module. Rebuild/repack when topology changes, not every frame; preserve stable indices as documented.
6. Ensure hard OFF values work with *future* audio/Auto layers: intensity 0, motion 0, camera OFF, bloom 0.

**Evidence/tests**
- Programmatic Inspector grouping assertions plus real UI screenshots: all four groups, three ordered Pattern controls, Trigger hidden when OFF, visible with 11 matching values when ON.
- Parameter min/default/max actual render comparisons; count changes alter number of tiles, size/gap/thickness alter geometry, palette tests separately recolor five regions.
- Set Trigger choice, toggle OFF and back ON; selection preserved. No Inspector-only controls.

**STOP/GO P3:** every user-facing control must have an observable runtime consumer. Remove optional placebo controls rather than shipping them. BPM timing demonstration completes P4.

---

## Phase P4: Six native geometric patterns and synchronized timing

**Goal:** geometry choreography works without audio automation.

**Code scope**
1. Implement `Cinema2LightfieldPatterns.ts` with pure transform evaluators for Checker Pulse, Center Ripple, Row Run, Diagonal Cut, Cross Axis, Split Plane.
2. Show physical Y displacement and/or limited tilt for each; preserve clear identical-color silhouettes. Combine with authored `Lift Range * Motion Amount` and hard spatial safety.
3. Add `Cinema2LightfieldOrchestration.ts` for chosen authored Pattern, phase, transitions, and `Cinema2MainframePatternController<Pattern>` integration; use shared canonical Trigger resolution, no local event detectors.
4. Implement BPM Sync with confirmed shared transport/Audio Intelligence timebase and deliberate OFF free-run; document host-sync composition and missing BPM behavior. Test proper phase continuity on toggles and discontinuities.
5. Implement stable manual Pattern editing: immediate new base, Pattern Change toggle unaffected, consume stale trigger identity. Support transitions without accumulated geometry drift.
6. Freeze phase when paused, deterministic phase/restoration or reset on seek/loop/track/preset switch. Do not run a separate animation loop.

**Evidence/tests**
- Six per-pattern 4-frame filmstrips with neutral colors, bloom OFF; recognizable height maps/silhouettes across time.
- Timing comparative capture at 100/120/150 BPM and sync ON/OFF; check event beat-grid correctness where supported.
- Motion Amount 0 holds physical geometry; Burst/Hit settings cannot bypass.
- Pattern Change OFF prevents event advances; ON no-repeat on distinct trigger; choosing Pattern ON preserves ON and waits for **next fresh** event.

**STOP/GO P4:** if any pattern changes only emission or if BPM Sync is inert, **STOP**. Audio integration cannot rescue an inadequate geometry design.

---

## Phase P5: Shared Audio Intelligence routing and event-driven Pattern Change

**Goal:** real music changes the floor without duplicating analysis logic.

**Code scope**
1. Map existing shared continuous features (sub/bass, mids, highs, vocals, overall energy) to bounded lift and tile-specific emission/geometry bias through manifest choreography targets.
2. Bind beat/kick/snare/downbeat/phrase/section/build/drop to independent envelopes/actions. Use typed action+event identity and deduplication; preserve unrelated audio response when Pattern Change OFF.
3. Resolve all 11 canonical Trigger values using existing shared event helpers and actual runtime input. Treat `beat2`/`bar8` semantics as established, not guessed.
4. Provide no-source/paused/silent fixture behaviors, distinct kick vs snare vs drop and controlled vocal restraint.
5. Sanitize signals and clamp combined reactive lift/emission, so a heavy drop cannot exceed the manually authored limits.

**Evidence/tests**
- Deterministic audio fixtures: silence, verse, kick, snare, bass energy, vocal, build midpoint, drop, phrase, section. Compare expected tile regions and pose traces on production canvas.
- 11-trigger identity coverage, duplicate/repeat suppression, OFF holding state, mid-event manual Pattern edit, seek/loop resets.
- Under Auto Performance OFF, normal audio reactivity still functions.

**STOP/GO P5:** visibly different response to continuous, rhythmic and structural inputs; precise event timing; no local detectors/clock. Failing one required category = STOP.

---

## Phase P6: Shared Choreography/Director, authority and Auto Performance

**Goal:** musical significance enhances, never replaces, LIGHTFIELD's authored identity.

**Code scope**
1. Record exact Choreography source/operation/target/smoothing/bounds/conditions matrix per rule in code/tests.
2. Connect Visual Director significance to temporary reactive emphasis; limit to existing authorized lift/emission/camera-with-permission. Use shared parameter/target composition order.
3. Implement `Auto Performance` toggle OFF by default. When ON, allowed domains are bounded macro amplitude and optional camera significance only; **no automatic Pattern replacement in v1**.
4. Enforce intensity/motion/bloom/camera hard OFFs and count/color/geometry user ownership even during drops.
5. Avoid “auto constantly fights slider” behavior: manual edits must be visible immediately and user-controlled base must be restored after envelopes decay. Document any separately auto-owned domains and manual-takeover behavior.

**Evidence/tests**
- Toggle Auto Performance ON/OFF during active music and show only approved enhancements change.
- Set Motion Amount=0, Master Intensity=0, Camera Motion=OFF at drop peak, verify hard stops.
- Test manual Pattern edit while Pattern Change ON, and ensure Auto does not hide it; no stale source restores previous pattern.

**STOP/GO P6:** every major property matches authority matrix; user edits remain visibly meaningful under heavy music. No unauthorized pattern/color/geometry changes.

---

## Phase P7: Camera, effect finish, performance and resilience

**Goal:** polish a working visual, never hide weak geometry.

**Code scope**
1. Enable restrained bloom only after base rendering accepted; test OFF/default/MAX. Optional camera drift stays inside measured safe bounds; enable only when Camera Motion ON.
2. Validate 16:9/1:1/9:16 framing, DPI and live resize; preserve tile index/pattern semantics after resize.
3. Audit draw-call count, GPU allocations, instance buffer churn, layer/depth composition and quality tiers. Avoid per-tile lights, reflection targets, giant GLBs and shader recompilation every event.
4. Resource and state robustness on rapid preset switch, repeated entry/disposal, context recreation if supported, no-track transitions and long-play loops.
5. Keep fallback graceful on weak integrated GPU, missing BPM or delayed music analysis.

**Evidence/tests**
- Visual report with bloom OFF/default/MAX and camera OFF/ON, dark foreground and readable geometric edges.
- Device/platform performance traces where feasible (FPS/frame time, GPU memory, GL errors) and repeated re-entry measurements.
- Final geometry remains legible after effects are disabled; no unsafe crops.

**STOP/GO P7:** production visual quality remains consistent, no measurable resource leak/regression, effect optionality works.

---

## Phase P8: Full production-path acceptance and targeted regression

**Goal:** prove finished behavior on the **actual** Cinema 2.0 canvas.

**Do**
1. Run `typecheck`, relevant unit suites, manifest compilation tests, production browser smoke and build using scripts verified in P0; do not invent commands.
2. Capture screenshots/video for idle and all six patterns, min/default/max controls, five Palette roles, Trigger visibility/options, timed automatic transitions and audio moments.
3. Verify all 11 Trigger choices via deterministic shared events, one-event-one-advance and manual Pattern selection while ON.
4. Compare timing at different BPMs and Sync modes; playback lifecycle: no track, play/pause/resume, seek, loop, new track, analysis update, re-entry.
5. Test every hard lock and Auto Performance; run asset/performance budget/regression checks and compare against baseline P0.
6. Human visual reviewer checks floor perspective, art direction, movement nuance, musical timing, and absence of geometric clipping across aspect ratios.

**Deliverable:** complete evidence matrix, video/stills, commands and logs, known preexisting failures separated from new ones, reviewer sign-off.

**STOP/GO P8:** any mandatory missing/ineffective control, alias pattern, silent music, wrong Trigger, user-automation collision, leak, visual mismatch or failing browser proof = **STOP / not production-ready**.

---

## Phase P9: Release packaging and maintenance handoff

**Goal:** finish first-party keeper without silent defects or undocumented scope change.

**Do**
1. Review exact source diffs and registry uniqueness; confirm no unsupported shared hacks, no duplicate pipeline, no unneeded assets.
2. Attach final visual spec, control-to-output map, signal map, timing contract, pattern library, authority matrix, traceability, test captures and command output.
3. Document any intentional design differences from this plan and secure sign-off before release; avoid silently reducing six patterns or changing parameter semantics to resolve bugs.
4. Mark all `09_RELEASE_GATE.md` checkboxes with linked evidence, record performance budgets measured on target machine/browser, and assign remaining non-blocking follow-ups.
5. Final human approval of visual identity and functional music responsiveness; then allow production exposure.

**STOP/GO P9:** **ship only on documented, reproducible green evidence**. The creation of source files, a successful build, or a pretty screenshot is not sufficient.

## Implementation status tracker (fill in during coding)

| Phase | Owner | Status | Commit/PR | Test evidence | Visual evidence | Exit decision |
|---|---|---|---|---|---|---|
| P0 Preflight | TBD | NOT STARTED |  |  |  |  |
| P1 Visual/authority | TBD | NOT STARTED |  |  |  |  |
| P2 Static geometry | TBD | NOT STARTED |  |  |  |  |
| P3 Inspector/Palette | TBD | NOT STARTED |  |  |  |  |
| P4 Patterns/timing | TBD | NOT STARTED |  |  |  |  |
| P5 Audio/triggers | TBD | NOT STARTED |  |  |  |  |
| P6 Director/Auto | TBD | NOT STARTED |  |  |  |  |
| P7 Effects/performance | TBD | NOT STARTED |  |  |  |  |
| P8 Acceptance | TBD | NOT STARTED |  |  |  |  |
| P9 Release | TBD | NOT STARTED |  |  |  |  |
