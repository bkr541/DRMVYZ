# 00. Updated Source Audit and Integration Evidence

## Inspected source

The analysis uses the **new uploaded** `DRMVYZ-main (5).zip`, not the earlier `(4)(1)` or user-memory version. Relevant files exist in this archive; CANOPY is **not present as a first-party preset** in the reviewed catalog. The source contains unrelated 'canopy' terminology in Marquee, AtlHoe, and Afterhours; do not mistake those features for the proposed CANOPY preset.

## Evidence index: inspect these concrete files

| Actual repository file | Verified role | CANOPY implication |
|---|---|---|
| `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` | Mandatory new-preset sequence, Design hierarchy, six patterns, shared timing, authority, four colors and browser acceptance | Primary normative contract; follow §8–§10, §19, §23–§25 |
| `src/components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest.ts` | Schema ID/version, `Cinema2NativePresetManifest`, Design parent IDs, conditional `visibleWhen`, shared light limit | Build a valid manifest, don't invent schema fields |
| `src/components/vyzualz/cinema2/presets/Cinema2FirstPartyPresetCatalog.ts` | Array of `defineCinema2FirstPartyPreset({ role: 'keeper', manifest })` | Add exactly one CANOPY declaration after it is valid |
| `src/components/vyzualz/cinema2/presets/Cinema2PresetRegistry.ts` | Authoring and native compiler validation during registry startup | Bad manifest blocks registration; no ad hoc React catalog |
| `src/components/vyzualz/cinema2/presets/Cinema2PresetAuthoring.ts` | First-party authoring capability/wiring checks | Pass authoring validation but still do manual visual checks |
| `src/components/vyzualz/cinema2/presets/Cinema2PresetCompiler.ts` | Native preset compile and render plan validation | Test compiler diagnostics, refs and render topology |
| `src/components/vyzualz/cinema2/modules/Cinema2ModuleRegistry.ts` | Versioned native module definitions and explicit registrations | Import/register CANOPY module before use |
| `src/components/vyzualz/cinema2/modules/Cinema2ModuleContracts.ts` | `create`, `lifecycle.update`, `dispose`, `render.providers`, `handleAction`, frame transport/audio/director, resource facet | Use host-owned GL resource acquisition and frame context |
| `src/components/vyzualz/cinema2/modules/Cinema2DepthNativeModule.ts` + `modules/depth/{Cinema2DepthLayout,Cinema2DepthLightPrograms,Cinema2DepthOrchestration,Cinema2DepthRenderer}.ts` | Procedural instanced world-space geometry, renderer, rhythm programs and orchestration | Best reference for inexpensive instanced rod architecture |
| `src/components/vyzualz/cinema2/presets/Cinema2DepthPreset.ts` | World camera, native scene graph, module bindings, layer, render graph, effects | Manifest scaffolding reference; **do not copy its legacy Design/Palette coverage blindly** |
| `src/components/vyzualz/cinema2/presets/Cinema2AfterhoursPreset.ts` | Export `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` with canonical 11 choices, module/action/scene patterns | Canonical dropdown list; follow new-contract `boolean` Pattern Change, not Afterhours' older enum |
| `src/components/vyzualz/cinema2/modules/Cinema2AfterhoursNativeModule.ts` | `resolveCinema2AfterhoursTriggerEventIdentity`, published musical event identities | Reuse verified shared trigger semantics where appropriate |
| `src/components/vyzualz/cinema2/modules/mainframe/Cinema2MainframePatternController.ts` | Generic `Cinema2MainframePatternController<Pattern>`, deterministic no-immediate-repeat cycle, stale-event behavior | Reuse or extract generic helper, avoid new divergent pattern state machine |
| `src/components/vyzualz/cinema2/modules/Cinema2SyncedMotionClock.ts` | `Cinema2SyncedMotionClockResolver`; host/track BPM composition with reset/pause behavior | Consider for procedural free-running motion, but explicitly choose beat phase vs tempo-scaled seconds |
| `src/components/vyzualz/cinema2/audio/Cinema2AudioIntelligenceBridge.ts` | Engine's shared music input | CANOPY does **not** calculate its own BPM/kick/drop/section |
| `src/components/vyzualz/cinema2/director/Cinema2VisualDirector.ts` | Broad significance, build, impact and context | Macro scaling only, not object geometry or authored selection |
| `src/components/vyzualz/cinema2/choreography/Cinema2ChoreographyRuntime.ts` | Bounded continuous/event envelopes through target operations | Create manifest rules/targets rather than hidden side-channel |
| `src/components/vyzualz/cinema2/parameters/{Cinema2ParameterState,Cinema2TargetRuntime,Cinema2InspectorModel}.ts` | Authored state, resolved target values, generic Inspector hierarchy/visibility | Required controls need real consumer and visible proof |
| `src/components/vyzualz/cinema2/spatial/{Cinema2CameraRuntime,Cinema2LightingEnvironmentRuntime}.ts` | Engine camera/lighting state | Use safe authored perspective camera; minimal physical lights |
| `src/components/vyzualz/cinema2/render/Cinema2RenderGraph.ts` and `runtime/{Cinema2RenderGraphExecutor,Cinema2ResourceManager}.ts` | Graph, execution and engine-owned resources | World pass + optional bloom/finish; dispose module GPU data |
| `src/components/vyzualz/cinema2/__tests__/Cinema2DepthPreset.test.ts` | Geometry, module, registry, runtime checks | Add matching focused CANOPY tests |
| `src/components/vyzualz/cinema2/__tests__/Cinema2Backstreet.test.ts` | Compiler, Inspector, bindings and behavior coverage | Assert visibleWhen, persistence and authority |
| `scripts/run-cinema2-afterhours-browser.mjs`, `scripts/run-cinema2-atl-hoe-browser.mjs` | Production browser harnesses (present in ZIP) | Author CANOPY production-path browser harness with same existing infrastructure |
| `package.json` | `typecheck`, `build`, `test`, `test:e2e`, existing `test:e2e:cinema2-afterhours`, etc. | Use actual scripts; add dedicated CANOPY command only when implemented |

## Verified architecture details

- Manifest type is `Cinema2NativePresetManifest` with `schemaId='drmvyz.cinema2.native-preset'` and `schemaVersion=1` in the current code.
- Four generic Design parents are `master-controls`, `design`, `effects`, `palette` (`CINEMA2_DESIGN_PARENT_GROUP_IDS`). Their **UI labels** are Master Controls, Design, Effects, Palette.
- `Cinema2ModuleParameterReadFacet` exposes `getAuthored(name)`, `resolve(name)` and `get(name)`. Runtime consumes resolved parameter values, not stale manifest literals.
- `Cinema2ModuleCreateContext` provides `parameters`, `targets`, `resources`, `randomness` and more; `resources.acquire`/`reportGpuBytes` are supported.
- `Cinema2ModuleFrameReadContext` includes transport state, audio intelligence, director context, `deltaTimeSec`, `contextGeneration` and viewport.
- `Cinema2ModuleRenderPassProvider` supports `intent: 'world'` and final camera, lighting and depth inputs; use a depth-bearing target for suspended 3D rods.
- `CINEMA2_SHARED_LIGHT_LIMIT = 12` is defined in current manifest contract. Emissive instances ≠ individual scene spotlights.
- The known old preset `Afterhours` has a historical enum Pattern Change; the **current creation contract explicitly requires CANOPY's Pattern Change to be a boolean**.
- The existing `Cinema2MainframePatternController` and shared Afterhours trigger resolver are reusable reference mechanisms, but author/test all fresh-event and authority semantics for CANOPY.
- The current first-party authoring validator does not prove perceptual output; compiler success is insufficient under the contract.

## Implementation cautions and open decisions

1. Choose module rendering as **custom native instancing**. The existing Depth renderer is a proof that this path fits; its shader/layout is not drop-in CANOPY code. Do not bind to an undocumented global `InstancedMesh` engine facade.
2. Native module manifests may contain default `parameters`, `parameterBindings`, and internal target-only parameters. Use existing `cinema2Ref` format and validation, not fabricated APIs.
3. Use `visibleWhen: [{kind:'parameter-equals', parameterId: PATTERN_CHANGE_ID, value:true}]` to hide Trigger when OFF (supported schema). Preserve Trigger authored value when hidden.
4. Decide BPM Sync/host Audio Dock interaction explicitly. `Cinema2SyncedMotionClockResolver.resolve(..., {requireHostSync:false})` is a **code-supported option**, but do not blindly use tempo-scaled seconds when proper analyzed beat-grid phase is available.
5. If you reuse `Cinema2MainframePatternController`, its runtime-only active selection should remain separate from persisted `Pattern`. Track and reset last-event identity on manual/toggle/trigger edits.
6. Design new CANOPY-specific domain, palette and native renderer. Reuse shared music facts and choreography target operations, not an unrelated preset's visual semantics.
7. For automated screenshots use **real production canvas**, not a standalone Three.js demo, disconnected Storybook control, or shader-only preview.
8. Runtime/asset code can evolve; verify the API at the start of every coding phase before making assumptions.

## Source version policy

The ZIP supplied is a snapshot, not a live git checkout. Paths and behaviors above were inspected in that snapshot. The implementation agent must compare live files if the working branch differs. This audit **does not claim** to have executed the app or verified an existing CANOPY renderer; the deliverable is a planning bundle only.
