# 00. Source Audit: `DRMVYZ-main (5).zip`

## Source and honesty boundary

Inspected the **updated** source archive `DRMVYZ-main (5).zip` on 2026-10-21. `BLOCKSHIFT` was not found as a preset name, native module, or first-party registry entry in this source snapshot. This package is a source-grounded implementation *plan*, not a claim of an existing preset or of executed production tests. Recheck the live branch before writing code.

## Actual source paths and implications

All paths below are relative to repository root.

| Verified source | What it supplies | BLOCKSHIFT integration implication |
|---|---|---|
| `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` | New-preset sequence, user authority, visuals, 4 parent groups, BPM Sync, 4+ colors, six patterns/11 triggers, test gates | Normative requirements; never accept an old preset's nonconforming UI as the new standard |
| `src/components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest.ts` | `Cinema2NativePresetManifest`, schema ID/version, typed refs, parameter definitions/conditions, shared light limit | Declare valid native manifest, light counts, deterministic IDs; obey schema rather than invent fields |
| `src/components/vyzualz/cinema2/presets/Cinema2FirstPartyPresetCatalog.ts` | `defineCinema2FirstPartyPreset({ role: 'keeper', manifest })` | Add exactly one validated keeper declaration for BLOCKSHIFT |
| `src/components/vyzualz/cinema2/presets/Cinema2PresetRegistry.ts` | First-party registry | Use registry and compiler, not ad hoc React routing |
| `src/components/vyzualz/cinema2/presets/Cinema2PresetAuthoring.ts` | Authoring checks | Must pass; cannot substitute for perceptual acceptance |
| `src/components/vyzualz/cinema2/presets/Cinema2PresetCompiler.ts` | Manifest/module/render-plan compilation | Validate references, parameter bindings, graph dependencies and diagnostics |
| `src/components/vyzualz/cinema2/modules/Cinema2ModuleRegistry.ts` | Central versioned native module registration | Register new `cinema2BlockshiftNativeModuleDefinition` and fail loudly on invalid registration |
| `src/components/vyzualz/cinema2/modules/Cinema2ModuleContracts.ts` | Module create/update/dispose/render/action/inspection interfaces | Use `Cinema2ModuleTypeDefinition`, `create`, lifecycle, world render provider, `inspect`; no own RAF |
| `src/components/vyzualz/cinema2/modules/Cinema2DepthNativeModule.ts` | Host-owned resources, world pass, final camera, frame gating, module inspection | Best practical reference for a custom native WebGL2 module |
| `src/components/vyzualz/cinema2/modules/depth/{Cinema2DepthLayout,Cinema2DepthRenderer,Cinema2DepthOrchestration}.ts` | Procedural native world geometry, shader/instances, musical envelopes | Adapt architectural approach, not visual behavior or renderer code verbatim |
| `src/components/vyzualz/cinema2/presets/Cinema2DepthPreset.ts` | Camera, world layer, module, bindings, scene-color/depth passes/effects | Reference for manifest graph structure; old parameter conventions require contract updates |
| `src/components/vyzualz/cinema2/presets/Cinema2AfterhoursPreset.ts` | Exported `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` | Import exact values/labels for 11 Trigger choices |
| `src/components/vyzualz/cinema2/modules/Cinema2AfterhoursNativeModule.ts` | `resolveCinema2AfterhoursTriggerEventIdentity` | Canonical trigger-event identity semantics; don't add a local music detector |
| `src/components/vyzualz/cinema2/modules/mainframe/Cinema2MainframePatternController.ts` | Generic runtime pattern selection, no-repeat cycle, duplicate suppression, manual edit protection | Reuse generic controller or minimal compatible extraction after verifying live API |
| `src/components/vyzualz/cinema2/modules/Cinema2SyncedMotionClock.ts` | `Cinema2SyncedMotionClockResolver` and host-sync composition option | Choose and document correct BPM Sync/time source; beat phase preferred for beat-quantized moves |
| `src/components/vyzualz/cinema2/audio/Cinema2AudioIntelligenceBridge.ts` | Shared audio information | No homemade kick, beat, vocal, build, drop or phrase detector |
| `src/components/vyzualz/cinema2/director/Cinema2VisualDirector.ts` | Musical significance, context, macro intensity | Bounded performance modulation only |
| `src/components/vyzualz/cinema2/choreography/Cinema2ChoreographyRuntime.ts` | Continuous/event choreography rule engine | Manifest-driven operations should feed bounded module-resolved target channels |
| `src/components/vyzualz/cinema2/parameters/{Cinema2ParameterState,Cinema2TargetRuntime,Cinema2InspectorModel}.ts` | Persisted authoring, resolved outputs, generic Inspector UI | Expose actual parameter consumers, conditional visibility, authority and saved defaults |
| `src/components/vyzualz/cinema2/runtime/{Cinema2RenderGraphExecutor,Cinema2ResourceManager}.ts` | Engine-owned passes/resources | Respect graph and lifecycle; no unmanaged persistent buffers |
| `src/components/vyzualz/cinema2/render/Cinema2RenderGraph.ts` | Render graph model | Use world-color + depth slot and optional stock post effects |
| `src/components/vyzualz/cinema2/__tests__/{Cinema2DepthPreset,Cinema2Backstreet}.test.ts` | Similar first-party manifest/native test structures | Model focused tests with BLOCKSHIFT-specific assertions |
| `scripts/run-cinema2-afterhours-browser.mjs` | Production browser acceptance harness | Adapt for BLOCKSHIFT, do not use a detached HTML/Three.js toy |
| `package.json` | `typecheck`, `build`, `test`, `test:e2e`, existing Cinema2 e2e scripts | Run available commands; only add a new command when implemented |

## Concrete API evidence and warnings

- The manifest schema in this snapshot exposes ID `drmvyz.cinema2.native-preset`, version `1` via exported constants. Use exports, not hardcoded guessed numbers.
- Top-level Design parent IDs are `master-controls`, `design`, `effects`, `palette`; Inspector labels are Master Controls, Design, Effects, Palette.
- `CINEMA2_SHARED_LIGHT_LIMIT = 12` caps **non-ambient physical lights**. Do not make nine separate volumetric spotlights to illuminate nine blocks; emissive edges are geometry/shader output.
- `Cinema2DepthNativeModule` uses `context.resources.acquire(...)`, `reportGpuBytes(...)`, a world provider (`intent: 'world'`), `execution.camera`/`execution.depthAvailable`, lifecycle update/dispose and a single frame-ID update guard. These are verified examples, not mandates to duplicate its implementation byte-for-byte.
- `Cinema2MainframePatternController<Pattern>` accepts an authored base, Pattern Change boolean, selected canonical trigger, trigger event ID and beat, and preserves a manual selection until a fresh event. It is suited to BLOCKSHIFT after checking selected event semantics.
- Canonical `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` (from Afterhours preset) is the mandated eleven-value list. **Do not copy the historical Afterhours enum-style Pattern Change**; the new contract requires a boolean with conditional Trigger visibility.
- `Cinema2SyncedMotionClockResolver.resolve(frame, presetSync, { requireHostSync: false })` exists as a code-supported option. It scales continuous elapsed motion by BPM/120; it does **not itself provide beat-accurate choreography boundaries**. Use shared analyzed beat/grid when confirmed; define fallback behavior and global Audio Dock Sync composition.
- Some older preset manifests differ from the root creation contract. The contract wins for this new preset. Authoring/compiler success by itself cannot prove visible behavior.

## Initial grep result, collisions and excluded implementations

- `BLOCKSHIFT` is absent from the inspected archive's Cinema 2.0 first-party catalog and module file names.
- The user-requested SHIFTGRID-style sliding mosaic belongs to a **different design family**; BLOCKSHIFT must not introduce image pools or tile-puzzle matching.
- Confirm no other current branch introduced `drmvyz.cinema2.blockshift`, a `blockshift-native` module ID, conflicting filename or duplicate command before phase P2.
- This planning task did **not** run the application, measure GPU memory or take production canvas screenshots. Those are explicitly gated in [07_TEST_AND_VISUAL_ACCEPTANCE.md](07_TEST_AND_VISUAL_ACCEPTANCE.md).

## Preliminary design trade-off

For nine blocks, a native instance-packed WebGL2 mesh with a dark cube body and emissive edge material is adequate and follows source precedents. An imported glTF, general rigid-body simulation, separate scene engine, full floor environment, or deformable mesh would be unnecessary scope. If live source offers a validated higher-level native instancing utility, compare it during P0 and choose the simpler supported path.
