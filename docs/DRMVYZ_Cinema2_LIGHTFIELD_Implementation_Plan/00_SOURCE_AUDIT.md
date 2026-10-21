# 00. Updated source audit and real integration seams

## Source basis and constraints

- Read `DRMVYZ-main (5).zip`, including `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md`. The root contract is mandatory for **all new first-party presets**. It requires visual correctness ahead of wiring, user control, six unique patterns, exact Pattern Change/Trigger semantics, BPM Sync, ≥4 independent palette colors, 11 canonical triggers, real production-canvas visual proof, and stage/authority/lifecycle tests.
- In this source snapshot, searches of `src/components/vyzualz/cinema2` found **no existing LIGHTFIELD module or keeper preset**. Recheck the live working tree for newly introduced IDs/files.
- The package is a planning artifact. It does not establish that a production renderer passed tests, that real-frame screenshots exist, or that a proposed method name/signature is valid in a future checkout.

## Verified paths and usage

| Exact path relative to repository root | Verified role | LIGHTFIELD implication |
|---|---|---|
| `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` | Preset design/authority/control/audio/testing standards | Highest-priority acceptance definition |
| `src/components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest.ts` | Manifest types/IDs, parameter definitions, render graph contract, `CINEMA2_SHARED_LIGHT_LIMIT = 12` | Use typed IDs, valid targets and depth pass; emission is not 64 separate physical lights |
| `src/components/vyzualz/cinema2/presets/Cinema2FirstPartyPresetCatalog.ts` | First-party registration using `defineCinema2FirstPartyPreset` and `role: 'keeper'` | One new keeper declaration, no special React conditionals |
| `src/components/vyzualz/cinema2/presets/Cinema2PresetAuthoring.ts` | Authoring validation | Run and preserve diagnostics; not sufficient for visual acceptance |
| `src/components/vyzualz/cinema2/presets/Cinema2PresetCompiler.ts` | Manifest compilation and render plan | Validate refs, layer/output graph and bindings |
| `src/components/vyzualz/cinema2/modules/Cinema2ModuleRegistry.ts` | Versioned module registry with explicit failed-registration throw | Register LIGHTFIELD type/version and check collisions |
| `src/components/vyzualz/cinema2/modules/Cinema2ModuleContracts.ts` | Create/update/render/dispose/inspect and action interfaces | Use host-owned lifecycle, not a separate RAF |
| `src/components/vyzualz/cinema2/modules/Cinema2DepthNativeModule.ts` | Host resource acquisition, `reportGpuBytes`, depth-bearing world provider, final camera, frame-ID guard | Best native GL and depth provider reference |
| `src/components/vyzualz/cinema2/modules/depth/Cinema2DepthRenderer.ts` and `.../Cinema2DepthLayout.ts` | Native procedural geometry and shader-based instancing approach | Reuse design patterns, do not duplicate visual design |
| `src/components/vyzualz/cinema2/presets/Cinema2DepthPreset.ts` | Camera, world layer, native module, render graph, parameter bindings | Read for manifest shape (some older controls differ from current contract) |
| `src/components/vyzualz/cinema2/presets/Cinema2AfterhoursPreset.ts` | `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS`: canonical 11 values and labels | Reuse same constant or canonical successor, do not retype in application |
| `src/components/vyzualz/cinema2/modules/Cinema2AfterhoursNativeModule.ts` | `resolveCinema2AfterhoursTriggerEventIdentity` | Shared event identity semantics for musical Trigger |
| `src/components/vyzualz/cinema2/modules/mainframe/Cinema2MainframePatternController.ts` | Generic `Cinema2MainframePatternController<Pattern>` and trigger resolver | Reuse no-repeat / manual-edit precedence; audit continuity on discontinuity |
| `src/components/vyzualz/cinema2/modules/Cinema2SyncedMotionClock.ts` | `Cinema2SyncedMotionClockResolver` and explicit `requireHostSync` composition | Useful continuous clock reference; **BPM-scaled elapsed time alone is not beat-grid locking** |
| `src/components/vyzualz/cinema2/audio/Cinema2AudioIntelligenceBridge.ts` | Shared audio bridge | No LIGHTFIELD-local musical feature detector |
| `src/components/vyzualz/cinema2/choreography/Cinema2ChoreographyRuntime.ts` | Choreography action/rule runtime | Route bounded audio to typed targets rather than hidden overrides |
| `src/components/vyzualz/cinema2/__tests__/Cinema2DepthPreset.test.ts` and `.../Cinema2MainframePreset.test.ts` | Existing native preset and pattern tests | Test style references, not a substitute for production captures |

## Confirm before coding

1. Verify module type registration uses `Cinema2ModuleTypeDefinition`; a create context supplies engine-provided resources/targets/parameters; its provider uses `execution.camera` and `execution.depthAvailable`.
2. Verify exact manifest version, `cinema2NamespacedId`, `cinema2StableId`, `cinema2Ref`, and parameter `visibleWhen` schema from current types. Avoid casting an invalid manifest just to silence TypeScript.
3. Confirm actual audio frame shape and `sourceIdentity`, `frameId`, `contextGeneration`, track ID, transport time and discontinuity fields; do not invent convenient signals.
4. Confirm Design parent group IDs: `master-controls`, `design`, `effects`, `palette`. All user-facing LIGHTFIELD parameters must be nested under one, with no Inspector fork.
5. Confirm exact 11 canonical trigger values from the import: `beat`, `kick`, `snare`, `downbeat`, `beat2`, `beat4`, `bar`, `bar4`, `bar8`, `phrase`, `drop`.
6. Confirm whether a beat-grid phase is available for LIGHTFIELD's synchronicity. If only BPM-scaled elapsed time is available, clearly distinguish free-running tempo-following from quantized events and use shared analyzed beat/grid for actual event boundaries.
7. Inspect current browser smoke/test tooling and current `package.json` scripts. Do not assume a `run-cinema2-lightfield-browser.mjs` script exists; create one only if existing harness conventions support it.
8. Check all current working-tree changes and schema ref collisions before touching shared registries. Identify existing failing checks separately.

## Found limitations / non-goals

- Code supports reusable native geometry and choreography, but no confirmed ready-made **tile-array scene prefab** was established. LIGHTFIELD's tile layout, native shaders, and six patterns must be implemented.
- The root contract is stricter than some old preset manifestations (for example historical pattern grouping). **Follow the root contract**.
- Tiles should be emissive shader geometry plus 0–2 purposeful non-ambient real lights, not 64–144 dynamic spotlights; shared limit is 12.
- No bespoke Audio Intelligence, Visual Director, physics, asset loading, backend persistence, new render engine, or separate playback timebase is needed.
