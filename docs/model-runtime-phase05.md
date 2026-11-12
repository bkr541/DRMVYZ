# Phase 05 — Cinema private model runtime

Scope: loading/binding infrastructure and an unregistered test scene only. The six
Phase 06 presets are not implemented or registered here.

The authored scene owns camera, lighting, floor, atmosphere and placement. One
`three-scene` dynamic slot owns the selected model subtree. Replacing that subtree
must preserve the authored scene and shared renderer. Models normalize to a
centered two-unit longest axis, then inherit the configured Scene Graph node.
The neutral base configuration is the insertion seam for a later authored stage.

Model selection is user-owned, never audio/automation-owned. A metadata-selected
string editor persists a validated `default-model` or `user-model:<uuid>:<version>`
binding through existing parameter/workspace schema 1. It is not a media slot.
Pinned versions never silently advance. Saved materials are preserved by default;
an explicit palette-tint permission may multiply the original colors, and turning
it off restores their saved values. No musical analysis or effect declarations
are introduced by this phase.

Private fetches authorize through the model repository on every acquire, including
cache hits. Cache identity is authenticated owner, asset ID and immutable version.
Leases share geometry/textures; the scene bridge clones materials. The last lease
frees the template, including CPU references. Stale loads are aborted or released.
Unsupported private content falls back to the neutral built-in model with a
readable diagnostic; unknown/forbidden bindings never become remote URL inputs.

## Integration contract for Phase 06

Use `createCinema2UserModelParameter(parameterId)` for a primary, persistent,
non-modulatable/non-automatable **Model** string parameter under Design > Design.
Bind it to the three-scene module's `userModel` property and declare that property
in `module.parameters` with `default-model`. Add `config.userModel` with
`{ node: <scene node ID or null>, neutralFloor?: boolean, spin?: boolean }`.
Existing `config.instances` keeps its shipped-asset behavior and can coexist with
this one dynamic slot. A dynamic-only module can omit `instances`.

`userModelPalette` defaults false and is an explicit permission to multiply the
model's saved colors using normal module `color`/PBR overrides. With it off, saved
material values are restored. The neutral floor always preserves its own
materials. Lighting/exposure still comes from Cinema. Supply four meaningful
Palette roles and the full Pattern/Pattern Change/Trigger and BPM Sync contracts
when authoring the Phase 06 presets; this harness does not satisfy or bypass
those preset promotion requirements.

`createCinema2UserModelBaseEnvironment(moduleId, prefix)` returns authored scene,
static camera, lighting, fog/background, focal node and module config. The model
has a two-unit maximum axis centered at its own origin; the focal node places it
at y=1.1 over the floor. Replace these authored fields and optionally omit
`neutralFloor` when the final stage arrives. Retain the binding/module properties.
The reference scene uses an engine-owned color/depth target and an output pass;
world rendering may not write directly to the default framebuffer.

`Cinema2UserModelReferenceHarness.ts` is an unregistered native declaration,
registered only into isolated test registries. It is absent from both the public
preset list and first-party keeper catalog. No six effect entries were added.

## Resolution, errors and lifecycle

- The resolver obtains the authenticated user and owned asset/version through
  the Phase 01 repository before looking up a cache entry. It checks the user
  again after download/parse. Auth account changes immediately detach private
  geometry and reauthorize the same pinned binding.
- Downloads accept `model/gltf-binary` or a validated
  `application/octet-stream` Storage fallback, enforce the 64 MiB limit while
  streaming, and refresh an expired signed URL once. No signed URL is persisted.
- GLB header/JSON, accessor and buffer budgets are checked before GLTFLoader.
  URI dependencies are rejected recursively. The current generated-model profile
  supports static triangle meshes with PBR materials, up to 250,000 triangles,
  1,000,000 vertices, 128 materials, and no textures, skins or animations. Texture
  budget is deliberately zero because Phase 02/04 export no textures. Arbitrary
  imported scenes are outside this feature. Existing meshopt/leased decoder
  infrastructure is reused; shipped asset registry rules/licenses are unchanged.
- Parsed triangles and bounds must agree with immutable saved stats before
  attachment. The resolver normalizes measured bounds without changing the
  authored focal node, camera or environment. Quality tiers use the same pinned
  generated mesh; this phase adds no private LOD variants.
- Cache entries key by owner/asset/version, not URL. Concurrent holders share one
  decode. Canceling one waiter preserves other holders. Stale completions release
  their leases. A bridge owns cloned materials; cache leases own shared geometry
  and textures. Final release evicts the private template, freeing CPU references
  and GPU resources. There is no persistent private-model cache.
- During a switch the previous valid model stays visible until the replacement
  is authorized and decoded. Failures switch to the neutral model. Module
  diagnostics expose loading, ready, error, missing and unauthorized states; the
  selector shows loading/errors inline, using a bounded 500 ms diagnostic read
  while mounted. It cleans up this timer on unmount and does not poll Zustand
  from the render loop. Choose Default model and then a saved model to retry a
  failed binding. Missing assets retain their canonical binding in the workspace.
- Context loss uses the existing Cinema module retirement/resource ownership;
  restoration recreates the same pinned selection. Seeking does not alter the
  binding. No second canvas, audio pipeline, store or transport was added.

## Source changes

New files under `src/components/vyzualz/cinema2/model/`:
`Cinema2ModelBinding.ts`, `Cinema2UserModelResolver.ts`,
`Cinema2UserModelCache.ts`, `Cinema2UserModelSlot.ts`,
`Cinema2ModelPlaceholder.ts`, `Cinema2UserModelBaseEnvironment.ts`,
`Cinema2UserModelReferenceHarness.ts`, `Cinema2ModelSelector.tsx`/`.css` and
`Cinema2UserModelRuntime.test.ts`. Browser check:
`scripts/model-assets/verify-cinema-runtime.mjs`.

Extended existing owners: `Cinema2ThreeSceneModule.ts`,
`Cinema2ThreeSceneBridge.ts`, `Cinema2ParameterSchema.ts`,
`Cinema2InspectorPanel.tsx`, and the existing Media Manager navigation callback
in `ReactView.tsx`. The inspector extension is driven only by
`metadata.editor = 'user-model-selector'`, with no preset-name branches.
Shared control typography and the output-only center stage remain intact.

No dependency, database migration, media-slot type, workspace schema increment,
shipped asset license or output-publication API changes were needed. Canonical
parameter normalization now validates the binding editor's strings, including
restore. Valid but missing IDs are preserved and diagnosed at runtime.

## Validation and remaining gates

- **78 focused tests passed** across the private runtime, existing shipped Three
  scene/asset/PBR tests, parameter schema/state and workspace persistence.
  Includes real GLTFLoader parsing, authorization/denial/deletion, invalid MIME,
  expired URLs, URI/texture/geometry limits, shared leases, stale completion,
  A/B/A release and pinned schema-1 round trip.
- **10 existing Inspector DOM cases passed.** The remaining existing production
  selector/Stage DOM case fails because jsdom lacks `HTMLElement.hidePopover` in
  the untouched preset-selector surface. It was reported once and not rerun.
  The real Chromium browser selector path passes.
- **Nine Chromium/WebGL scenarios passed** using the actual Cinema2Runtime,
  three-scene module/bridge, generated GLBs, private resolver, cache and Inspector:
  selection/render; A/B/A with stable camera and one lease; palette permission
  and saved-color reset; schema-1 workspace reload with pinned version; preset
  reentry; real `WEBGL_lose_context` recovery; unauthorized account fallback;
  deleted-model fallback; and the host Media Manager action. Shutdown returned
  zero cache entries/holders. No browser page errors. Selected-model messages,
  shared search/placeholder typography and the 11px portaled dropdown were
  checked; captures were visually inspected.
- Focused ESLint has no errors. The unchanged `ReactView.tsx` recorder dependency
  warning remains outside this change. TypeScript/build pass; the production
  build retains its existing large-chunk advisories.

```sh
# Node 22 and installed Playwright Chromium
node scripts/model-assets/verify-cinema-runtime.mjs
npx vitest run src/components/vyzualz/cinema2/model/Cinema2UserModelRuntime.test.ts
npm run build
```

Local evidence lives under ignored `artifacts/model-runtime-phase05/`:
`result.json`, default/private/unauthorized stage captures and selector typography.
The browser fixture replaces only Auth/repository service boundaries; it does
not prove deployed Auth, Storage signing, quotas or RLS. **Real authenticated
Supabase end-to-end validation remains pending; migrations 0047/0048 remain
undeployed.** No new database work is required by this phase. Full installer and
physical mobile hardware acceptance remain Phase 07 work.

Phase 06 can reuse this seam but must keep all six effects separate, comply with
the full preset-authoring contract, and preserve pinned private model identity.
No commit was requested or created; earlier phase and unrelated working-tree
changes were preserved.
