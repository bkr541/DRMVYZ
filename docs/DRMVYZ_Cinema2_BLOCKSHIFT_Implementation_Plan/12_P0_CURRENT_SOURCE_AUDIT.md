# P0 — Current-source audit and feasibility decision

Date: 2026-10-22 (America/New_York). Branch: `main`, initially clean, at `9c2aa74831103c1589e589c8cedc5af5f94f1643` (`padding design tab`). Scope: P0/P1 documentation only; no native implementation, registration, or P2 work.

## Authority and comparison boundary

Read repository `AGENTS.md` and the root `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md`. The contract remains normative. This audit supersedes archive-based API assumptions in `00_SOURCE_AUDIT.md`; the locked P1 decisions are in `13_P1_LOCKED_SPECIFICATION.md`.

The original `DRMVYZ-main (5).zip` is not available in this checkout (repository ZIP search, excluding dependencies/generated output, returned none). An exact archive-to-branch diff therefore was not possible. Instead, the named integration contracts and source seams were inspected directly at the commit above. No archive equivalence is claimed.

A search of `src`, `scripts`, and `package.json` found no BLOCKSHIFT implementation or competing `blockshift` identifiers. Reserve `drmvyz.cinema2.blockshift`, `blockshift-native@1`, `blockshift-sculpture`, `blockshift-root`, and `blockshift-camera`; repeat the collision check immediately before P2 if the branch changes.

## Verified source and decisions

Paths below are relative to `src/components/vyzualz/cinema2/` unless otherwise indicated.

| Source inspected | Finding / implementation decision |
|---|---|
| `contracts/Cinema2NativePresetManifest.ts` | Schema ID `drmvyz.cinema2.native-preset`, version 1; import exported constants and branded ID/ref helpers. Four parent IDs and boolean conditional visibility are supported. Physical light cap is 12 non-ambient lights. |
| `presets/Cinema2FirstPartyPresetCatalog.ts`, `Cinema2PresetRegistry.ts`, `Cinema2PresetAuthoring.ts`, `Cinema2PresetCompiler.ts` | Existing keeper declaration, authoring validation, native compilation, capability validation, target compilation, and duplicate-ID handling remain the integration path. `defineCinema2FirstPartyPreset` alone only freezes a declaration; it is not proof of validation or visible behavior. |
| `modules/Cinema2ModuleRegistry.ts` | Versioned registration rejects conflicts. Add one definition using the existing fail-on-invalid convention in P2. |
| `modules/Cinema2ModuleContracts.ts`, `Cinema2ModuleRuntime.ts` | Host lifecycle, resource acquisition, randomness, resolved parameter reads, world provider, actions, and context-loss retirement/recreation exist. No private RAF or WebGL owner is needed. |
| `modules/Cinema2DepthNativeModule.ts` | Useful native-world reference: frame-ID update guard, required final camera/depth, engine-owned resources, GPU accounting, and typed action handling. Do not copy Depth's automation or control conventions. |
| `modules/depth/Cinema2DepthLayout.ts`, `Cinema2DepthRenderer.ts`, `Cinema2DepthOrchestration.ts` | Procedural geometry, packed instances, real `drawElementsInstanced`, buffer updates, shader disposal, and musical orchestration are present. BLOCKSHIFT gets its own geometry and motion vocabulary. |
| `presets/Cinema2DepthPreset.ts` | Reference for scene/layer/module/color/depth/effect wiring. Older labels, auto defaults, palette count, and manual-edit metadata are not the new preset standard. |
| `presets/Cinema2AfterhoursPreset.ts` | Exported `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` has the exact 11 required labels/values; import it unchanged. |
| `modules/Cinema2AfterhoursNativeModule.ts` | Exported `resolveCinema2AfterhoursTriggerEventIdentity(frame, trigger, previousTimeSec)` covers canonical rhythmic and structural boundaries. Paused/nonplaying input returns null. Caller must handle discontinuities, fresh-event arming, source validity, and replay suppression. |
| `modules/mainframe/Cinema2MainframePatternController.ts` | Generic controller accepts a custom pattern cycle and initial pattern. Supports manual base edits, boolean enable, trigger changes, stale-event arming, and no-immediate-repeat cycling without persistent writes. Reuse the controller, not Mainframe's fallback event resolver. |
| `modules/Cinema2SyncedMotionClock.ts` | Supports `requireHostSync: false`, but supplies BPM-scaled elapsed motion, not verified grid alignment. Not selected as the primary BLOCKSHIFT clock. |
| `modules/Cinema2BeatClock.ts` | Shared beat-domain clock supports tempo/free-run timing, pause, and gradual alignment to available beat index/phase. Selected for formation phase. Its `locked` flag means BPM is available, not necessarily a confirmed grid; report grid availability separately. |
| `audio/Cinema2AudioIntelligenceBridge.ts` | Bands, features, musical events, fixed clocks, structural markers, availability/provenance, track/source identity, and discontinuities exist. Service capability does not guarantee a datum is available in a frame. |
| `director/Cinema2VisualDirector.ts` | Continuous intensity/momentum, build/section context, transition IDs, and impact/variation authority are available. Use for bounded significance only. |
| `choreography/Cinema2ChoreographyRuntime.ts` | Supports continuous mappings, event actions, envelopes, conditions, deduplication, and target contributions. Explicit `tempoSyncParameter` changes some rhythmic rules to a fallback clock; omit it for BLOCKSHIFT's canonical music-event rules. |
| `parameters/Cinema2ParameterState.ts`, `Cinema2TargetRuntime.ts`, `Cinema2InspectorModel.ts` | Persistent and runtime-only values are distinct; module properties have inferred targets and parameter bindings; conditional visibility and generic four-parent projection exist. Read editable values through resolved `get`/`resolve`. |
| `render/Cinema2RenderGraph.ts`, `runtime/Cinema2RenderGraphExecutor.ts`, `Cinema2ResourceManager.ts` | Native graph compilation, world camera/depth delivery, engine target ownership, pooling, and cleanup exist. Native module buffers/programs use the module resource facet rather than direct render-target ownership. |
| `spatial/Cinema2CameraRuntime.ts` | Static perspective rig and `minAspect` fit-to-width are supported. Use a static shared camera in v1. |
| `effects/Cinema2EffectRuntime.ts`, `Cinema2HdrBloomEffect.ts` | Engine owns effect lifecycle and HDR bloom implementation. Bloom remains optional to the visual identity and must have zero influence at strength 0. |
| `__tests__/Cinema2DepthPreset.test.ts`, `Cinema2Backstreet.test.ts`, `Cinema2MainframePatternController.test.ts`, `Cinema2AfterhoursPatterns.test.ts` | Existing focused reference tests execute successfully; see baseline below. |

## Corrections to the archive plan

1. `inspect` is an extra helper on some concrete modules, not a member of `Cinema2ModuleInstance`. A typed BLOCKSHIFT factory/test seam may expose inspection; do not invent a host inspection API or modify the shared interface solely for this preset. Host lifecycle/resource diagnostics already exist.
2. `context.parameters.getAuthored(name)` returns the manifest's `module.parameters` value in this source. It does not read the user's current persisted override. Use resolved `get`/`resolve` for controls; keep Pattern unmodulated so its resolved value remains the user base.
3. Reuse the generic Mainframe controller, but call the canonical Afterhours resolver directly. Mainframe's wrapper can generate fallback timing identities, which would violate this plan's no-invented-musical-events rule.
4. `Cinema2BeatClock` has the useful grid-following behavior missing from the simpler synced clock. BLOCKSHIFT still needs preset-local phase offsets and discontinuity bookkeeping, not a new musical detector or independent timer.
5. The current generic Inspector flattens Master Controls, Effects, and Palette. Only Design retains secondary groups. Subgroup names in the original matrix describe organization, not an obligation to add shared UI nesting.
6. A dedicated `Cinema2SyncedMotionClock.test.ts` does not exist. It was included in the baseline selector but matched no file; the actual result is four test files, not five.

## Production-browser strategy

Inspected `scripts/run-cinema2-afterhours-browser.mjs`, `src/test/browser/Cinema2AfterhoursProductionBrowserHarness.tsx`, `src/test/e2e/cinema2AfterhoursVisualAcceptance.spec.ts`, and `playwright.config.ts`.

The existing script builds a browser entry with Vite, serves it locally, and runs Chromium acceptance. That entry mounts the real `VyzualzView` with `AudioEngineProvider`. Its tests select Cinema 2.0 and a preset through real controls and capture `[data-cinema2-output-canvas="true"]`. A separate raw runtime probe is supplemental, not the hero evidence.

For P2/P8, use that architecture with BLOCKSHIFT-specific files and its actual preset chooser. Deterministic fixtures must publish through the existing AudioFeatureBus/bridge path with transport identity, not inject private module event booleans. Add only the necessary Playwright configuration and package command when the harness exists. No browser script, package command, fixture publisher, or preview implementation is created in P0/P1.

## Baseline actually executed

| Check | Result |
|---|---|
| Initial `git status --short --branch` | Clean `main...origin/main`. |
| `npm run typecheck` | **FAIL**, exit 2, before changes. Existing diagnostics span Cinema2 tests, browser harnesses, and Show Manager tests. |
| `npm run build` | **Not run**: defined as `tsc && vite build`; its first step is already blocked by the same TypeScript errors. Repository instructions prohibit repeating known unrelated broad failures. Vite production bundling is therefore unverified. |
| Focused Vitest command below | **PASS: 54 tests, four files**, 2.72 seconds. |
| BLOCKSHIFT canvas/performance | Not run: implementation is outside P0/P1. No production visual or GPU-performance pass is claimed. |

The shell default was Node `v26.11.1` / npm `11.20.0`; the initial typecheck ran there. `package.json` requires Node `>=22.12 <23`. Focused tests used installed Node `v22.23.3` through an explicit PATH. The failing typecheck was not repeated under Node 22; its diagnostics are the observed baseline, not a Node-22-certified result. Use Node 22 for subsequent implementation checks.

Observed diagnostic examples:

- `Cinema2AfterhoursNativeRendering.test.ts:189`: missing required `rollDegrees` in a camera fixture.
- `Cinema2DepthPreset.test.ts:257`: a Map entry may contain `undefined`.
- `Cinema2AfterhoursProductionBrowserHarness.tsx:136–137`: possibly null status element.
- `MainframeProductionBrowserHarness.ts:121`: `buildup` is not the supported section type `build`.
- Show Manager test fixtures have schema-version/type errors.

These are pre-existing; no unrelated repairs are included. Full typecheck/build health remains a release limitation even though architecture feasibility is established.

Executed focused command (the missing synced-clock selector is retained here to describe the actual invocation):

```sh
PATH=/opt/homebrew/opt/node@22/bin:$PATH ./node_modules/.bin/vitest run \
  src/components/vyzualz/cinema2/__tests__/Cinema2DepthPreset.test.ts \
  src/components/vyzualz/cinema2/__tests__/Cinema2Backstreet.test.ts \
  src/components/vyzualz/cinema2/__tests__/Cinema2MainframePatternController.test.ts \
  src/components/vyzualz/cinema2/__tests__/Cinema2SyncedMotionClock.test.ts \
  src/components/vyzualz/cinema2/__tests__/Cinema2AfterhoursPatterns.test.ts --reporter=default
```

Full successful test output: [evidence/P0_FOCUSED_TEST_RESULTS.txt](evidence/P0_FOCUSED_TEST_RESULTS.txt).

## Dated phase report / P0 gate

- Files changed: this audit, P1 specification/reference evidence, and planning-package status/cross-references only.
- Requirement coverage: feasibility for BS-R01/R04/R07/R08/R13/R17/R18/R19; implementation satisfaction remains unverified.
- Real canvas changes: none.
- Deviations: archive unavailable; use live-source reconciliation. Skip duplicate failing build. Correct clock, parameter, inspection, and UI assumptions as above.
- **Gate: GO for P1 authoring. Architecture/ID feasibility PASS; baseline typecheck/build health FAIL/BLOCKED separately.** No unresolved API conflict requires a parallel engine or broad refactor.
- Next phase authorized in this request: P1 only. P2 is not authorized or started.
