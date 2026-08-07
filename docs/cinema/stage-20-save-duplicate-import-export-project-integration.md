# Cinema Stage 20: Save, Duplicate, Import, Export, and Project Integration

Stage 20 completes the first production composition-library lifecycle on top of the canonical Cinema graph/store introduced by the prior stages. It does not add a second scene model or renderer and it does not migrate Shader Pads or Cinematic Worlds identities.

## Composition library lifecycle

`CinemaLibrary` owns UI-neutral library semantics for Cinema compositions:

- built-in/reference compositions are immutable through authored store mutations;
- user compositions expose saved-versus-modified status by comparing the current composition revision with a persisted `savedRevision` provenance marker;
- Save checkpoints the current revision without copying runtime state;
- Save As and Duplicate create user-authored compositions with new composition-local stable IDs;
- duplication remaps nodes, connections, cameras, asset bindings, modulation routes, performance rules, performance actions, camera-local shot/region IDs, parameter destinations, and Composer metadata references while preserving external node type, port, parameter, event, and asset IDs;
- deleting an active user composition removes dependent instances and collection membership and selects a deterministic remaining composition instead of leaving a dangling active ID.

The Stage 20 provenance fields live inside the existing JSON metadata contract, so the Cinema persisted schema version does not change. Earlier valid Cinema schema versions continue through the existing migration path.

## Package workflow

The existing versioned Cinema package preflight remains the authority for schema, JSON-safety, stable IDs, asset manifests, and atomic import. Stage 20 adds a selected-composition export boundary that packages the composition plus its instances, collection membership, stable asset manifest, active selection, and relevant editor selection. It intentionally omits node definitions because those IDs are external plugin contracts resolved by the receiving Cinema registry.

Composer import uses merge mode with stable-ID conflict rejection. Preflight, cancellation, or conflict failure occurs before canonical state mutation. Browser object URLs used to download an exported JSON file are transient and revoked immediately; they are never part of the package or persisted state.

## DRMVYZ project persistence

The canonical Cinema snapshot now uses the same `createSplitPersistStorage` project persistence service as the React visual store. All Cinema persisted fields are project fields and are stored under Cinema's existing Zustand storage name in the shared DRMVYZ project IndexedDB database. Existing all-localStorage Cinema snapshots are migrated by the split-storage adapter on hydration.

The adapter's existing in-memory fallback was completed so project fields can also round-trip in Node/unit-test environments where IndexedDB and localStorage are absent. This fallback is test/runtime-environment support only and does not change the browser persistence contract.

Runtime-only Composer preview state, compiled graphs, diagnostics, DOM/media objects, WebGL resources, and temporary URLs remain excluded by `snapshotCinemaPersistedState` and the existing package serializer.

## Production UI

The structured Cinema Composer exposes a Composition management section for:

- rename, Save, Save As, Duplicate, and Delete;
- built-in/user provenance and modified status;
- selected-composition JSON export and atomic JSON import;
- creating collections and toggling the active composition's collection membership.

These controls call the canonical `CinemaStore` operations. The Stage 18/19 graph authoring panels continue to edit the same composition object and the runtime continues to execute that graph through the single Cinema canvas/runtime path.

## Stage 21 handoff

Stage 20 leaves versioned composition lifecycle, portable package IO, and project reload behavior ready for Stage 21's adapter-backed catalog migration. Legacy Shader Pads and Cinematic Worlds remain separately selectable and retain their existing runtime ownership until the explicit retirement stage.
