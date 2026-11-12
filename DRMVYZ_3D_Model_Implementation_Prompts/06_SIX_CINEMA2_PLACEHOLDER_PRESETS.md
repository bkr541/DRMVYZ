# PHASE 06 — Six Individual Cinema 2.0 3D Model Effect Placeholder Presets

## EXECUTE THIS PHASE IN CODE

You are Claude Code / Codex implementing **Phase 6 of 7**. Read `00_MASTER_OVERVIEW.md`, all prior phase handoffs, `AGENTS.md`, `AI_IMPLEMENTATION_CONTRACT.md`, and **the complete** `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` before coding. Create six real first-party **reference / preview** presets that compile, register and render; not six inert JSON labels. This phase is intentionally **placeholder effects**, NOT full Photism parity or finished audio-reactive mesh choreography.

## Goal and exact six presets

Provide six **separately selectable native Cinema 2.0 presets**, each with its own stable ID and distinct, plainly labeled visual scaffold that uses the same Phase 05 user-model slot and replaceable base stage:

| User-visible preset | Stable ID (suggested) | Minimal truthful V1 scaffold |
| --- | --- | --- |
| **3D FORM (Preview)** | `drmvyz.cinema2.user-model-form` | Loaded original mesh + PBR appearance; whole-object movement |
| **3D SHATTER (Preview)** | `drmvyz.cinema2.user-model-shatter` | Readable model-informed *proxy* fragments/clusters with offset/rejoin motion. Do NOT falsely present it as accurate physical mesh fracture. |
| **3D DUST (Preview)** | `drmvyz.cinema2.user-model-dust` | Sampled model-informed point/particle proxy, with basic gather/drift response |
| **3D HOLOGRAM (Preview)** | `drmvyz.cinema2.user-model-hologram` | User model wireframe/transparency/emission and simple scan-proxy visual |
| **3D SLICES (Preview)** | `drmvyz.cinema2.user-model-slices` | Model-based section-like proxy layers with separate offsets; label approximation until real geometry sectioning ships |
| **3D VOXEL (Preview)** | `drmvyz.cinema2.user-model-voxel` | Model-informed small-cube proxy within a strict instance count cap, not full volumetric voxelization |

Use stable namespaced IDs and explicit distinct catalog thumbnails/names/descriptions. Do not rebrand existing keeper presets or change shipped reference presets. Each visible effect mode must actually change rendered pixels and use the selected user model (direct geometry, surface sampling, bounding-volume or outline-informed proxy as appropriate). The default placeholder mesh must also render when the user has no models.

## Relevant verified existing source

- `src/components/vyzualz/cinema2/presets/Cinema2FirstPartyPresetCatalog.ts`
- `src/components/vyzualz/cinema2/presets/Cinema2PresetAuthoring.ts`
- `src/components/vyzualz/cinema2/presets/Cinema2ThreeModelReferencePreset.ts`
- `src/components/vyzualz/cinema2/presets/Cinema2GoToPreset.ts`
- `src/components/vyzualz/cinema2/presets/Cinema2AfterhoursPreset.ts` (import canonical `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS`)
- `src/components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest.ts`
- `src/components/vyzualz/cinema2/choreography/Cinema2ChoreographyRuntime.ts`
- `src/components/vyzualz/cinema2/parameters/Cinema2TargetRuntime.ts`
- `src/components/vyzualz/cinema2/modules/Cinema2ThreeSceneModule.ts`
- Phase 05 shared user-model resolver/binding/base-environment modules.

## 1. Shared factory, six distinct declarations

Create a single shared native preset authoring helper / factory to avoid six copies of 3D model management code, e.g.:

```text
src/components/vyzualz/cinema2/presets/Cinema2UserModelPresetFactory.ts
src/components/vyzualz/cinema2/presets/Cinema2UserModelFormPreset.ts
src/components/vyzualz/cinema2/presets/Cinema2UserModelShatterPreset.ts
src/components/vyzualz/cinema2/presets/Cinema2UserModelDustPreset.ts
src/components/vyzualz/cinema2/presets/Cinema2UserModelHologramPreset.ts
src/components/vyzualz/cinema2/presets/Cinema2UserModelSlicesPreset.ts
src/components/vyzualz/cinema2/presets/Cinema2UserModelVoxelPreset.ts
src/components/vyzualz/cinema2/model/Cinema2UserModelPreviewEffects.ts
```

- Share base stage and model selection/runtime while keeping **each preset** its own metadata, authored parameter IDs, own effect visuals, default look and six working patterns.
- Register via `defineCinema2FirstPartyPreset({role:'reference', manifest: ...})` in `Cinema2FirstPartyPresetCatalog.ts` unless actual authoring contract requires a stricter path. Do not call them `keeper` until the user's visual/musical acceptance.
- Add tests for duplicate IDs, missing dependencies, catalog visibility, every preset compiling, output pixel differences and state restoration.
- Avoid editing global parameter schema/render graph unless strictly necessary; if required, keep change backward-compatible and test old presets.

## 2. Preserve mandatory native inspector controls

Every registered preset must satisfy current contract, even though it is a placeholder:

- Four top-level Design inspector groups only: **Master Controls**, **Design**, **Effects**, **Palette** (nested child groups allowed).
- **BPM Sync** under **Design > Master Controls**, with a real timing consumer.
- **Pattern**, **Pattern Change**, **Trigger** together and in this order under **Design > Design**.
- `Pattern` with **minimum six genuinely distinct and visibly working patterns per preset** (6 x 6 total meaningful modes). No six label-only aliases; each chosen option must produce visibly different behavior within that effect's visual identity.
- `Pattern Change` must follow the **boolean toggle** specified by the current contract, default **OFF** (do not blindly copy any older enum-based preset implementation). When ON, choose/advance only on **fresh** events; a manual Pattern edit takes effect immediately and holds until the next fresh selected event, without disabling Pattern Change.
- `Trigger` appears only when Pattern Change ON; reuse exactly **11** canonical values and meanings from `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS`, including `beat`, `kick`, `snare`, `downbeat`, `beat2`, `beat4`, `bar`, `bar4`, `bar8`, `phrase`, `drop`.
- Four **independently visible/effective** Palette color roles (e.g. stage/background, material/primary, secondary, accents/emission). Do not use four knobs pointing to one color.
- React/Effects controls must have actual render targets, not inert placeholders. Honor existing master intensity, quality, pattern trigger and Auto Performance authority; never permanently overwrite user values with an audio event.
- Keep standard Inspector and parameter IDs, no preset-name-specific UI rendering.

**Recommended light-weight design for six working patterns per preset:** Each preset has a distinctly different preview representation, and its pattern IDs apply six verifiable transform/arrangement variants (e.g. anchored, orbit, pulse, split, wave, gather) **implemented differently for that preset's representation**. Reuse common trigger/clock mechanics but make output observably different. You may author more appropriate names/styles after inspecting the existing contract. Do not implement full production-grade shatter/dust/slice/voxel algorithms just to satisfy the temporary reference requirement.

## 3. Audio intelligence: MVP only

- Consume shared beat/downbeat/kick/snare/energy or phrase events via existing Cinema 2.0 bridges/targets; no second FFT, beat-grid clock or custom drop detection.
- Implement basic genuine audio-reactive movement/tint/brightness/intensity per effect scaffold, bounded by controls and frame budget. Preserve pause/seek/loop and deterministic event handling.
- Define parameters for reactive strength, response speed, movement amplitude/opacity where meaningful; connect through proper native parameter bindings and render-state target consumers.
- This scope **does not** promise accurate geometric fracture, real particle dissolution, deformable body dynamics or production choreography. State limitations in preset descriptions, docs and completion handoff.
- Keep stage/environment asset selection behind Phase 05's replaceable environment seam so the user can install their authored base later.

## 4. Performance, errors and test coverage

- Bound particle and voxel instance counts by quality profile, cap fragment proxies and geometry copy count, use instancing where appropriate. Prepare geometry only at asset/change time, not every beat/frame.
- Pause or reduce idle rendering where supported; make asset switches safe and resource-clean; avoid allocating new Three.js geometry/material every frame.
- Switching model with one preset active must show newly selected model, not a stale copy. A missing asset must show a clearly labeled placeholder.
- Verify shared material overrides do not silently mutate the user-owned GLB version.
- Add focused tests for all six preset manifests and authoring/compilation; renderer smoke tests for individual mode + six patterns and actual model binding; trigger event duplication and Manual Pattern precedence; four distinct color roles; BPM Sync and save/reload.

## Acceptance gates (hard fail if any checked-off without evidence)

- [ ] Six **distinct** first-party reference presets appear as selectable Cinema 2.0 entries.
- [ ] Each uses selected user-created GLB or visible fallback, inside shared base environment.
- [ ] Each shows a demonstrably different visual representation/proxy of that model.
- [ ] Every registered preset has **at least six real working patterns** (not just names), correct Pattern Change and eleven shared triggers.
- [ ] Master Controls, Design, Effects, Palette and React behaviors follow current Cinema 2.0 conventions and have real runtime consumers.
- [ ] Changes in model, pattern, palette, and basic audio event visibly affect production canvas; presets survive save/reload.
- [ ] Model switching, missing assets, quality tiers and rapid preset cycling do not leak GPU resources or break existing keeper presets.
- [ ] `npm run typecheck`, focused preset compiler/authoring tests and real native WebGL tests pass.

## Required handoff

List all six preset IDs/names, exact files changed, effect representation limitations, six pattern names per preset, inspector controls and parameter routes, catalog roles, trigger tests and screenshots/test evidence. **Call them reference/preview placeholders, not finished effects.**
