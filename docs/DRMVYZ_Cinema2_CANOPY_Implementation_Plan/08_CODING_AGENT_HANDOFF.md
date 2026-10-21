# 08. Coding Agent Handoff Prompt

Copy the following request into a coding-agent task and include this entire implementation package plus access to the current repository. It is a **task request**, not proof of implementation.

---

## Task: implement CANOPY as a fully compliant native Cinema 2.0 first-party keeper preset

You are working in the updated DRMVYZ codebase from `DRMVYZ-main (5).zip` or a newer live branch. **Implement the CANOPY preset in React Cinema 2.0 using the existing engine infrastructure, not a separate visualization engine.**

### Source of truth and instructions

1. Follow repository root `AGENTS.md`, `AI_IMPLEMENTATION_CONTRACT.md`, and **`DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md`**. Resolve any conflict in favor of the latest repository contract.
2. Read every Markdown document in this CANOPY package. Begin with `00_SOURCE_AUDIT.md`; inspect actual code listed there before writing changes. Distinguish verified current APIs from proposed CANOPY design choices.
3. Execute `06_PHASED_IMPLEMENTATION.md` **in order, Phase 0 through Phase 8**. At the end of each phase, capture focused test output and human-readable evidence, report PASS/FAIL and blockers. Don't skip static geometry or manual-output gates to start Audio Intelligence early.

### Required visual

Build a beautiful, restrained black-space installation of 8×8 suspended luminous LED rods, genuine world-space depth, subtly visible ceiling mounts, legible thin diffuser geometry and six independently observable **geometric** choreography patterns: Waterfall, Crosswave, Crown, Split Wings, Checker Lift and Downpour. Render with WebGL2 instances and one/few draw batches, not a physical spotlight per rod. All rods are targetable procedurally by row/column and index. No physics, secondary renderer, GLB asset pipeline, shader-demo-only output or major engine refactor.

### Required engine integration

- A schema-valid `Cinema2CanopyPreset.ts` using native `Cinema2NativePresetManifest`, scenes, layers, camera, depth render target, render passes, environment controls, module bindings and choreography.
- A versioned `Cinema2CanopyNativeModule.ts` registered with `Cinema2ModuleRegistry.ts`, with renderer/resources lifecycle and a valid world provider.
- A `keeper` declaration in `Cinema2FirstPartyPresetCatalog.ts` through `defineCinema2FirstPartyPreset`.
- Native geometry/pattern helpers separated and tested; final resolved parameter values used every frame, never stale authored module literals.
- Shared Audio Intelligence only, existing Visual Director significance, engine-target Choreography, shared trigger resolver and shared transport. No local beat/BPM/phrase/drop detection or competing musical clock.

### Mandatory controls

- Design > Master Controls: user-editable **BPM Sync boolean**, functionally distinct ON and OFF timing, composed explicitly with Audio Dock Sync.
- Design > Design: **Pattern** enum (≥6 real options), **Pattern Change** boolean OFF by default, **Trigger** enum with exactly the same 11 values/labels/meaning as the exported shared `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS`, visible only when Pattern Change ON.
- Pattern edit must be immediate and leave Pattern Change ON if it was ON; no stale-event cancel; fresh qualifying selected Trigger advances to a different pattern with no double consume.
- Design > Palette: at least four distinct real editable `color` parameters; implement proposed five Background, Primary Rods, Secondary Rods, Accent Hits, Mounting Structure, each with independent consumers.
- The remaining controls follow `03_INSPECTOR_AND_PALETTE.md`, must be supported by real renderer/effect bindings, and must pass production min/default/max tests. NO placebo controls, no hard-coded CANOPY Inspector React component.

### Audio, choreography and ownership

Follow `05_AUDIO_CHOREOGRAPHY_AND_AUTHORITY.md` mapping with distinct physical and luminous responses to continuous energy, kick, snare, phrase/section, build/drop and vocal restraint. All intensity/position modulation must remain bounded and return to user-authored base. Pattern Change and Auto Performance are independent. Auto Performance can be confined to temporary build/drop modifiers for initial release (no mandatory temporary pattern override); if a temporary override is implemented, correctly restore the current underlying base without mutating saved Pattern/Trigger. Hard OFF/zero settings remain authoritative.

### Efficiency and scope control

Use default 64 rods, maximum 144 total and very few physical lights; leverage existing Depth instanced renderer architecture and standard resource manager. Avoid heavyweight environment props, new physics, individual per-rod lights, multiple camera rigs or a new reusable choreography framework unless a **verified** missing capability makes that unavoidable. If scope expands, stop and identify the concrete reason and smallest compliant alternative.

### Required tests / evidence

Create focused manifest, layout, audio/authority and native rendering tests, plus a **production-path browser test** using existing harness techniques. Test all six patterns, every required control, all 11 canonical triggers, BPM Sync ON/OFF, distinct audio response, manual ownership, duplicate-event protection, seek/loop/pause/track change/re-entry, aspect/resize, resource disposal and quality. Produce production-stage screenshots/filmstrips and obtain human visual signoff. Follow `07_TEST_AND_VISUAL_ACCEPTANCE.md` and `09_RELEASE_GATE.md` without claiming done from compilation alone.

### Deliver at the end

1. Complete code diff and final file list.
2. Updated implementation/behavior docs, control map and authority matrix.
3. Focused automated test commands/results and any known pre-existing failures.
4. Production canvas screenshots/filmstrips and human review outcome.
5. Resource/performance data at default/max density.
6. Clean handoff: completion/limitations, unrelated changes excluded, commit status if requested.
7. Every checklist item in `09_RELEASE_GATE.md` explicitly marked PASS, FAIL or NOT VERIFIED. Never quietly omit a failing required contract item.

---

### Example phased status format

```text
CANOPY / PHASE <N> — <GATE>
Implemented:
Files changed:
Control/visual behavior actually observed:
Tests run + result:
Production screenshot(s) + frame states:
Known failures and whether pre-existing:
Unverified required behaviors:
Decision: PASS to next phase / STOP, blocker
```
