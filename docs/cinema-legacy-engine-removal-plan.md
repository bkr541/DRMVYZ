# Legacy Cinema Engine Removal Plan

## Purpose

This document tracks the staged removal of the legacy Cinema engine (`cinema`)
after its required built-in presets have been ported to Cinema 2.0 (`cinema2`).
The removal is complete only when historical state is handled deterministically,
Cinema 2.0 has no dependency on the legacy implementation, and the rest of the
application continues to behave as it did before the removal.

This plan treats the older `shaderPads` and `cinematicPortal` engine identities
as migration inputs because the current compatibility path restores them into
legacy Cinema. It does not assume that user-authored Cinema compositions can be
discarded merely because the built-in presets have been ported.

## Overall status

| Field | Value |
| --- | --- |
| Overall status | **In progress** |
| Current phase | Phase 5 |
| Last updated | 2026-10-18 |
| Target live engine | `cinema2` |
| Legacy live engine | `cinema` |
| Compatibility inputs | `shaderPads`, `cinematicPortal` |
| Removal strategy | Migrate, cut over, then delete |

### Status definitions

| Status | Meaning |
| --- | --- |
| Pending | Work has not started or its prerequisites are unresolved. |
| In progress | Implementation has started but the phase gate has not passed. |
| Blocked | Work cannot safely continue until a documented decision or dependency is resolved. |
| Complete | All checklist items and the phase gate have passed, with evidence recorded here. |

## Progress summary

| Phase | Description | Status | Depends on |
| --- | --- | --- | --- |
| 1 | Freeze scope and build the migration manifest | **Complete** | None |
| 2 | Establish Cinema 2.0 persistence and content parity | **Complete** | Phase 1 |
| 3 | Decouple Cinema 2.0 from legacy Cinema | **Complete** | Phase 1 |
| 4 | Migrate persisted state and cross-engine references | **Complete** | Phases 1-3 |
| 5 | Cut over the application shell and runtime | **Pending** | Phase 4 |
| 6 | Delete the legacy implementation and artifacts | **Pending** | Phase 5 |
| 7 | Stabilize and retire temporary compatibility code | **Pending** | Phase 6 |

## Current architectural boundary

At the start of this plan, the relevant flow is:

```text
Historical saved state / imported projects
        |
        +-- shaderPads / cinematicPortal compatibility
        |
        v
React store --> legacy-retirement migration --> Cinema store
     |                                      drmvyz:cinema-store
     |                                               |
     +-- performance pads / automation cues          |
     +-- track sections                              v
     +--------------------------------------> CinemaWorkspace
                                                   `-- CinemaCanvas
                                                        `-- CinemaRuntime
                                                             `-- output/recording

Cinema 2.0 --> Cinema2Stage / Cinema2Runtime --> output/recording
     |
     `-- currently consumes some legacy geometry and test infrastructure
```

Important starting conditions:

- `cinema` is still a selectable engine and is currently the initial React
  engine in `reactStore.ts`.
- `ReactView.tsx` installs the legacy retirement bridge and owns the conditional
  legacy workspace, panels, assets, and frame bridge.
- `CinemaStore.ts` persists definitions, compositions, instances, collections,
  active IDs, editor metadata, and migration provenance under
  `drmvyz:cinema-store`.
- Performance pads, automation cues, and track sections can contain references
  to legacy Cinema identities.
- Cinema 2.0 workspace parameter and media state does not yet provide a durable
  equivalent for all legacy persisted state.
- Cinema 2.0 production geometry and many Cinema 2.0 tests still import code
  from the legacy Cinema directory.

## Removal invariants

Every phase must preserve these rules:

1. Historical state must never be silently discarded.
2. A migration must be idempotent and safe to run more than once.
3. Old project/package imports must follow the same migration rules as local
   persisted state.
4. Cinema 2.0 must not depend on files scheduled for deletion.
5. Output, recording, audio reaction, Media Manager, Show Manager, and unrelated
   engines must retain their existing behavior.
6. Migration support must ship before the legacy runtime is removed.
7. A phase is not complete until its validation gate passes and evidence is
   recorded in this document.

---

## Phase 1: Freeze scope and build the migration manifest

**Status:** Complete

### Desired result

Establish an authoritative boundary for removal and a complete, typed mapping
from every supported legacy built-in identity to its Cinema 2.0 replacement.
No new product behavior should be added to legacy Cinema after this phase begins.

### Included

- Freeze feature and preset development in legacy Cinema.
- Inventory production imports, test imports, scripts, styles, documentation,
  browser harnesses, persisted fields, and package/project formats associated
  with legacy Cinema.
- Define whether older Shader Pads and Cinematic Worlds renderer code becomes
  deletable or remains for consumers outside the Cinema compatibility bridge.
- Create a typed legacy-to-Cinema-2.0 migration manifest.
- Map each legacy built-in composition or source to:
  - Cinema 2.0 preset ID;
  - optional look or variant ID;
  - parameter defaults or overrides;
  - media-slot mapping;
  - an explicit unsupported classification when there is no equivalent.
- Validate that every destination exists in the Cinema 2.0 registry.
- Record the policy for user-authored compositions, instances, collections,
  favorites, recent items, and imported Cinema packages.

### Checklist

- [x] Mark the legacy engine as frozen in the relevant architecture documentation.
- [x] Produce an authoritative list of files intended for deletion.
- [x] Produce an authoritative list of consumers that must first be migrated.
- [x] Enumerate every built-in legacy composition and compatibility alias.
- [x] Add the typed migration manifest.
- [x] Add automated manifest coverage and destination-validation tests.
- [x] Map consolidated presets to the correct Cinema 2.0 look or parameter patch.
- [x] Classify every category of custom/user-authored data.
- [x] Record product decisions for non-translatable custom content.
- [x] Record validation evidence below.

### Completion gate

- Every built-in legacy identity is mapped exactly once.
- There are no missing or invalid Cinema 2.0 destinations.
- The removal boundary and custom-content policy are approved and documented.
- No code outside an explicit allowlist can introduce a new legacy dependency.

### Evidence / notes

Completed 2026-10-18.

- The frozen boundary, deletion inventory, consumer ownership, and persisted-data
  policy are recorded in `docs/cinema-legacy-engine-removal-inventory.md`.
- `Cinema2LegacyMigrationManifest.ts` classifies all 45 known legacy source
  identities: 27 migrate to registered Cinema 2.0 presets and 18 are explicitly
  archive-only. Consolidated Event Horizon, Ancient Machine, and Constellation
  sources include fixed look patches with Auto Performance disabled so the
  restored source identity remains stable.
- Custom compositions, instances, collections, packages, and editor metadata
  cannot be silently deleted. Phase 2 must implement the documented archive or
  translation path.
- `Cinema2LegacyMigrationManifest.test.ts`: 5 tests passed. Coverage includes
  exact source parity, uniqueness, catalog classification, destination registry
  presence, parameter-schema acceptance, and archive disposition.
- `npm run cinema:legacy-boundary:check`: passed with 67 known external
  importers and no additions.
- Focused ESLint for the new manifest, test, and boundary script passed.
- Repository-wide `npm run typecheck` remains red on pre-existing Cinema,
  Cinema 2.0, React, PixGrid, output, and Show Manager errors. It reported no
  error in a Phase 1 file; the focused tests and lint checks are green.

---

## Phase 2: Establish Cinema 2.0 persistence and content parity

**Status:** Complete

### Desired result

Make Cinema 2.0 capable of owning the durable state and externally activated
destinations that will be migrated away from legacy Cinema.

### Included

- Add versioned Cinema 2.0 persistence for the state required across reloads
  and project save/load.
- Persist the selected preset and look/variant, user parameters, media-slot
  assignments, and other required workspace state.
- Add a stable activation API for selecting a Cinema 2.0 preset with an optional
  look and parameter/media patch.
- Use that activation API as the future integration point for migrations,
  performance pads, automation cues, and track sections.
- Translate supported user-authored Cinema data where an equivalent exists.
- Preserve non-translatable user content in a durable, user-exportable archive
  unless equivalent Cinema 2.0 authoring support is implemented.
- Preserve save, save-as, duplicate, import, and export behavior wherever those
  workflows are part of the supported migration contract.

### Checklist

- [x] Define the versioned Cinema 2.0 persisted-state schema.
- [x] Implement safe parsing, migration, and fallback for that schema.
- [x] Persist required parameter and media state.
- [x] Implement the external Cinema 2.0 activation API.
- [x] Add project/package serialization support where required.
- [x] Implement the Phase 1 policy for custom compositions and instances.
- [x] Provide a recoverable archive/export path for non-translatable data.
- [x] Test application reload and project save/load round trips.
- [x] Test save and save-as behavior for migrated content.
- [x] Record validation evidence below.

### Completion gate

- Cinema 2.0 can receive every supported migration destination.
- Required state survives reload and project/package round trips.
- Custom legacy data is translated, preserved, or explicitly approved for
  retirement; none is silently lost.

### Evidence / notes

Completed 2026-10-18.

- `Cinema2WorkspacePersistence.ts` defines the versioned
  `drmvyz.cinema2.workspace` schema, strict parser/fallback behavior, persistent
  preset/look/parameter/media records, and an activation API that validates all
  destinations through the native Cinema 2.0 registry.
- The React project store now owns the Cinema 2.0 workspace document. It is part
  of `REACT_PROJECT_STATE_KEYS`, so normal local persistence, project save/load,
  duplication, and save-as structured-clone paths carry the same state.
- Runtime retirement writes canonical parameter and media descriptors back to
  the durable project document without retaining runtimes, GPU objects, or
  transient animation/audio state. Explicit activations have a separate
  revision so external same-preset activations can safely rebuild the Stage.
- The stable `activateCinema2Workspace` API accepts a registered preset plus an
  optional semantic look, parameter patch, and media patch. It is exposed both
  as a pure API and as an atomic React-store action for later migration, pad,
  automation, and track-section integration.
- While the legacy store remains present, `ReactView` mirrors its complete
  serializable document into a versioned `drmvyz.cinema2.legacy-archive` inside
  project state. `exportCinema2LegacyArchive` provides a raw JSON recovery path;
  project save/save-as also retains the archive automatically. This preserves
  definitions, custom compositions, instances, collections, active IDs, editor
  metadata, and migration provenance without attempting lossy translation.
- `Cinema2WorkspacePersistence.test.ts` and
  `cinema2WorkspacePersistence.test.ts`: 7 tests passed. Coverage includes all
  mapped Phase 1 destinations, reload, preset/look/parameter/media round trips,
  invalid-version fallback, invalid activation rejection, runtime-retirement
  saves, project save/load, save-as cloning, atomic external activation, and
  lossless archive export.
- Focused ESLint passed with no errors. It reported one existing
  `ReactView.tsx` exhaustive-deps warning unrelated to Phase 2.
- A focused TypeScript pass reported no errors in any Phase 2 file.
- `Cinema2ProductionPath.test.tsx` remains red on five pre-existing harness
  failures because `ReactEnginePanel` is rendered without its required
  `AudioEngineProvider`; its two provider-independent tests pass. The existing
  `Cinema2WorkspaceSession.test.ts` also has one stale expectation (`1.37`) for
  a Reactor value now normalized to `1.1`. Neither failure is caused by the
  Phase 2 persistence path, and neither check was rerun.

---

## Phase 3: Decouple Cinema 2.0 from legacy Cinema

**Status:** Complete

### Desired result

Remove every production and test dependency from Cinema 2.0 to the legacy
Cinema directory so that deleting the directory cannot break Cinema 2.0.

### Included

- Move reusable SVG, OpenType, vector-mesh, and related geometry contracts to a
  neutral shared module or Cinema 2.0-owned modules.
- Update Cinema 2.0 spatial rendering imports.
- Move reusable WebGL mocks and resize-observer helpers into neutral test support.
- Update all Cinema 2.0 tests that import legacy test utilities.
- Rewrite the Cinema 2.0 production-path test so it does not instantiate the
  legacy Cinema store or runtime foundation.
- Audit `CinematicWorldRenderer` and related adapters for remaining consumers
  before deciding whether they belong in the later deletion set.
- Add a dependency-boundary check that prevents new Cinema 2.0-to-legacy imports.

### Checklist

- [x] Relocate or replace reusable geometry contracts.
- [x] Update Cinema 2.0 production imports.
- [x] Relocate shared WebGL test infrastructure.
- [x] Update affected Cinema 2.0 tests.
- [x] Rewrite the legacy-dependent production-path test.
- [x] Audit older Cinematic Worlds renderers and adapters.
- [x] Add an automated dependency-boundary assertion.
- [x] Run the focused Cinema 2.0 runtime and geometry tests.
- [x] Record validation evidence below.

### Completion gate

Repository search and the dependency-boundary test show no Cinema 2.0
production or test import from `src/components/vyzualz/cinema`.

### Evidence / notes

Completed 2026-10-18.

- Vector mesh, SVG tessellation, OpenType tessellation, bounds, and world-object
  anchor contracts now live under `src/components/vyzualz/shared/vectorGeometry`.
  Legacy Cinema uses compatibility re-exports while it remains installed;
  Cinema 2.0 and the older Cinematic Worlds renderer import shared ownership
  directly.
- The shared WebGL2/ResizeObserver test support now lives at
  `src/test/support/CinemaWebGLTestUtils.ts`. All Cinema 2.0 tests import that
  neutral module; the legacy test path is a temporary compatibility re-export.
- `Cinema2ProductionPath.test.tsx` no longer imports or creates the legacy
  Cinema foundation, store, workspace, frame bridge, or engine panel. It tests
  engine selection and repeated ownership retirement against a neutral sibling
  engine. All 7 production-path tests pass.
- `scripts/check-cinema-legacy-boundary.mjs` now has an explicit zero-tolerance
  assertion for imports from any Cinema 2.0 production or test file into the
  legacy directory. The check passes with zero Cinema 2.0 importers and 24
  remaining external importers owned by later phases.
- The Cinematic Worlds audit is recorded in
  `docs/cinema-legacy-engine-removal-inventory.md`. That renderer tree still has
  non-Cinema production, browser, E2E, and test consumers, so it is retained as
  an independently owned legacy renderer until those consumers are migrated or
  explicitly retired. Its shared geometry contracts no longer depend on Cinema.
- Focused runtime/geometry validation ran 68 tests across 9 files: 66 passed.
  The passing set includes the production path, core Cinema 2.0 runtime, spatial
  object runtime, and all relocated legacy vector/SVG/OpenType compatibility
  tests. `Cinema2SpatialReferencePreset.test.ts` retains two unrelated existing
  failures: a stale Inspector section expectation and a render-pass execution
  expectation. The relocated WebGL helper is byte-identical to its previous
  implementation, and the failures do not affect the dependency gate.
- Focused ESLint passed with zero warnings or errors. A focused TypeScript pass
  reported no diagnostics in any Phase 3 file. `git diff --check` passed.

---

## Phase 4: Migrate persisted state and cross-engine references

**Status:** Complete

### Desired result

Migrate every durable or in-memory reference that can select legacy Cinema so
that existing users, projects, performances, and imports resolve to Cinema 2.0.

### Included

- Bump the React persisted-store version.
- Change the default engine from `cinema` to `cinema2`.
- Migrate active `cinema`, `shaderPads`, and `cinematicPortal` selections.
- Replace `cinemaCompositionId` in performance pads and automation cues with a
  generic engine destination or an equivalent versioned Cinema 2.0 target.
- Migrate track-section engine identities and destinations.
- Redirect older store migrations directly to Cinema 2.0 rather than legacy
  Cinema.
- Read `drmvyz:cinema-store` and migrate known state before removing its owner.
- Apply identical rules to imported projects and packages.
- Preserve a versioned raw backup or export for state that cannot be translated.
- Make the migration atomic and idempotent, with a completion marker.

### Suggested target shape

```ts
interface ReactEngineDestination {
  engineId: 'cinema2' | OtherSupportedEngineId
  presetId: string
  variantId?: string
  parameterPatch?: Record<string, unknown>
}
```

The final type should follow existing repository conventions, but it should not
introduce another legacy-specific one-off field.

### Checklist

- [x] Define and adopt the generic destination schema.
- [x] Add the React store version migration.
- [x] Change the initial/default engine to Cinema 2.0.
- [x] Migrate active engine and legacy alias selections.
- [x] Migrate performance-pad destinations.
- [x] Migrate automation-cue destinations.
- [x] Migrate track-section destinations.
- [x] Update all older migration endpoints that currently resolve to `cinema`.
- [x] Migrate supported `drmvyz:cinema-store` data.
- [x] Add local-state, project-import, and package-import fixtures.
- [x] Test missing, renamed, and consolidated preset destinations.
- [x] Prove that rerunning the migration produces the same result.
- [x] Record validation evidence below.

### Completion gate

Every supported historical fixture opens deterministically in Cinema 2.0 with
the correct preset, look, parameters, media assignments, pads, cues, and track
destinations. No live persisted reference requires the legacy runtime.

### Evidence / notes

Completed 2026-10-18.

- React persistence is version 78 and defaults to `cinema2`. The defensive
  current-version decoder applies the same migration to local hydration and
  imported project/package snapshots, so import paths cannot bypass the gate.
- `ReactEngineDestination` is the versioned cross-engine contract. Pads, cues,
  and track sections now store Cinema 2.0 preset/parameter destinations; the
  legacy-only `cinemaCompositionId` field exists only in isolated decoders and
  legacy-runtime compatibility code scheduled for Phase 6 deletion.
- Active `cinema`, `shaderPads`, and `cinematicPortal` selections resolve to
  Cinema 2.0. Consolidated source identities retain their manifest parameter
  patches; unsupported or unknown sources are not silently substituted.
- The Phase-4 data bridge snapshots `drmvyz:cinema-store`, stores its complete
  JSON document in `cinema2Workspace.legacyArchive`, translates a known active
  built-in, and commits `legacyMigrationVersion: 1` plus a source fingerprint
  in the same immutable update. Repeated migration is value-idempotent for the
  same document while a newly imported legacy package is archived and migrated.
- Focused migration, workspace, selection, cue, project/import, and historical
  compatibility validation passed 120 tests across 9 files. Focused ESLint and
  `git diff --check` passed. The repository-wide TypeScript check remains red
  on the previously documented unrelated Cinema, Cinema 2.0, output, PixGrid,
  Show Manager, and browser-harness diagnostics; it reported no remaining
  Phase-4 implementation diagnostic after the focused fixes.

---

## Phase 5: Cut over the application shell and runtime

**Status:** Pending

### Desired result

Remove legacy Cinema from all live application paths while retaining temporary,
data-only compatibility readers needed for historical state.

### Included

- Remove `cinema` from the selectable engine catalog and live engine union.
- Keep old string literals only in isolated migration decoders or fixtures.
- Remove the legacy retirement hook from the React view.
- Remove legacy Cinema store subscriptions, media/font asset bridges, normalized
  frame bridges, workspace, canvas, inspector, layers, preset panel, composer,
  and diagnostics UI.
- Route pads, cues, tracks, and other external activation through the Cinema 2.0
  activation API.
- Update workspace composition, preset-name resolution, inspector selection,
  placeholders, layouts, reset behavior, brand-kit normalization, and lifecycle
  ownership.
- Verify the generic output and recording paths continue to receive Cinema 2.0.
- Remove legacy Cinema from galleries, mockups, and navigation.

### Checklist

- [ ] Remove `cinema` from public/live engine registration.
- [ ] Remove the legacy React view bridge and store subscriptions.
- [ ] Remove the legacy workspace and all legacy panels from the shell.
- [ ] Route performance integrations through Cinema 2.0.
- [ ] Update workspace/layout/selection helpers.
- [ ] Update lifecycle, diagnostics, and brand-kit branches.
- [ ] Verify output and recording with Cinema 2.0.
- [ ] Verify engine switching and restoration for every other engine.
- [ ] Add a production-import check for the legacy runtime.
- [ ] Record validation evidence below.

### Completion gate

- The application has no live route that constructs `CinemaRuntime`, accesses
  `useCinemaStore`, or selects the `cinema` engine.
- Historical migration readers are data-only and cannot mount the legacy engine.
- Focused cross-engine, output, and recording checks pass.

### Evidence / notes

_Pending._

---

## Phase 6: Delete the legacy implementation and artifacts

**Status:** Pending

### Desired result

Physically remove the legacy engine and all code or assets that are provably
orphaned after the cutover.

### Included

- Delete `src/components/vyzualz/cinema/**` after Phase 3 and Phase 5 gates pass.
- Delete the legacy Cinema React workspace, canvas, panels, inspectors, bridges,
  and live override modules.
- Delete legacy-only browser harnesses, E2E specs, scripts, fixtures, and package
  scripts.
- Remove legacy `.rv-cinema...` styles while preserving Cinema 2.0 styles.
- Remove obsolete help entries, layout-lab examples, and navigation content.
- Archive or remove superseded Cinema documentation according to repository
  documentation policy.
- Delete older Shader/Cinematic renderers only when the Phase 3 reachability audit
  proves that no non-Cinema consumer remains.
- Remove newly orphaned dependencies only after import and bundle verification.
- Retain the compact compatibility decoder outside the deleted runtime for the
  agreed support window.

### Checklist

- [ ] Confirm the Phase 1 deletion manifest against the current tree.
- [ ] Delete the legacy Cinema domain, runtime, store, and tests.
- [ ] Delete legacy React UI and bridge files.
- [ ] Delete legacy-only browser/E2E infrastructure and package scripts.
- [ ] Remove legacy styles and UI documentation.
- [ ] Remove only those older renderers proven to be unreachable.
- [ ] Remove orphaned dependencies.
- [ ] Verify that the production bundle contains no legacy Cinema runtime code.
- [ ] Search for unexpected legacy identifiers and imports.
- [ ] Review the complete deletion diff for unintended files.
- [ ] Record validation evidence below.

### Completion gate

The legacy runtime, store, UI, tests, and assets are absent. Repository search
finds legacy identifiers only in approved migration readers, fixtures, or
historical release notes, and no legacy Cinema code is included in production.

### Evidence / notes

_Pending._

---

## Phase 7: Stabilize and retire temporary compatibility code

**Status:** Pending

### Desired result

Complete the removal with a focused regression pass, update canonical
documentation, and retire temporary migration code only after its promised
compatibility window has elapsed.

### Included

- Validate every Cinema 2.0 first-party preset, including audio-reactive behavior
  and media assignments.
- Validate performance pads, automation cues, tracks, project reload, project
  import/export, output, and recording.
- Validate unrelated engines and shared Media Manager and Show Manager workflows.
- Confirm old-state failures are explicit and recoverable rather than silent.
- Update canonical architecture, persistence, recording/output, verification,
  and source-packaging documentation where affected.
- Monitor the supported release window for migration failures.
- Remove the compatibility reader only if historical project support is no
  longer required; otherwise keep it as a small, isolated import decoder.

### Checklist

- [ ] Run the focused Cinema 2.0 preset matrix.
- [ ] Verify audio-reactive playback and media assignments.
- [ ] Verify pads, cues, track switching, and project round trips.
- [ ] Verify output and recording.
- [ ] Verify all unrelated engines.
- [ ] Verify Media Manager and Show Manager workflows.
- [ ] Update all applicable canonical documentation.
- [ ] Record the compatibility support window and removal decision.
- [ ] Remove or retain the isolated compatibility reader according to that decision.
- [ ] Run the final proportional build and test suite.
- [ ] Review the working tree and final diff.
- [ ] Record validation evidence below.

### Completion gate

All requested regression checks pass, canonical documentation describes only
the resulting architecture, and any retained historical decoder is isolated
from the live runtime. The legacy Cinema engine has no downstream consumer or
production artifact.

### Evidence / notes

_Pending._

---

## Final acceptance checklist

The overall status may be changed to **Complete** only when all of the following
are true:

- [ ] All seven phases are complete.
- [ ] `cinema` is no longer a selectable or live engine.
- [ ] `CinemaRuntime`, `CinemaStore`, and `useCinemaStore` are absent from
  production paths.
- [ ] Cinema 2.0 has no legacy production or test imports.
- [ ] Historical fixtures migrate to the correct Cinema 2.0 preset and look.
- [ ] Performance pads, automation cues, and track destinations retain behavior.
- [ ] Custom data is migrated or recoverably archived.
- [ ] Output, recording, audio reaction, and unrelated engines remain functional.
- [ ] No legacy Cinema runtime code is present in the production bundle.
- [ ] Canonical documentation and verification instructions are current.

## Decision log

Use this table for decisions that materially change migration behavior or the
removal boundary.

| Date | Phase | Decision | Rationale | Owner |
| --- | --- | --- | --- | --- |
| 2026-10-18 | Planning | Use a seven-phase migrate-before-delete plan. | Direct deletion would strand persisted state and break current Cinema 2.0 dependencies. | Codex analysis |
| 2026-10-18 | 1 | Retire unselected sources into a recoverable archive instead of substituting unrelated visuals. | The owner has completed the ports they intend to carry forward; silent data loss remains prohibited. | Phase 1 implementation |

## Change log

| Date | Change |
| --- | --- |
| 2026-10-18 | Created the initial seven-phase removal tracker; all phases are pending. |
| 2026-10-18 | Completed Phase 1: froze the boundary, added the typed source manifest and validation, and documented the deletion and data policies. |
