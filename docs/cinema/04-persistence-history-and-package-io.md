# Cinema Stage 4: Persistence, History, and Package I/O

Cinema Stage 4 adds the canonical authored-state owner behind the production `components/vyzualz/cinema` public module. It remains intentionally runtime-neutral: Stage 4 does not register the `cinema` React engine, allocate a canvas or WebGL resource, start an animation loop, or migrate Shader Pads/Cinematic Worlds state.

## Canonical persisted state

`CinemaPersistedState` uses schema ID `drmvyz.cinema.store` and schema version `1`. It owns:

- serialization-safe node definition metadata
- composition graphs, including their stable asset bindings, routes, rules, cameras, nodes, and connections
- composition instances and complete override references
- collections
- active composition and instance selection
- durable editor metadata and migration provenance

The existing React store remains the sole owner of active React engine selection. Runtime plugin availability, compiled graph plans, diagnostics buffers, modulation snapshots, DOM/media objects, object URLs, WebGL objects, and feedback/simulation state are excluded from persistence.

`useCinemaStore` is the production Zustand hook. `createCinemaStore` creates isolated vanilla stores for integration tests and future non-React services. The persisted singleton uses the `drmvyz:cinema-store` storage key and persists only `CinemaPersistedState`; history, transactions, and diagnostics are reconstructed runtime state.

## Hydration and migration

`normalizeCinemaPersistedState` is the schema-v1 hydration boundary. It:

- initializes a fresh valid state when no persisted value exists
- adds explicit defaults for missing schema-v1 fields
- rejects malformed schema IDs and unknown future versions
- rejects cyclic, non-finite, typed-array, DOM, GPU, function, and other non-JSON values
- validates definition registries and complete composition graphs through the existing Stage 2 compiler boundary
- validates instance, collection, active-selection, node, camera, binding, and parameter references
- leaves the current canonical store unchanged when hydration fails

No older Cinema store schema existed in the supplied repository, so Stage 4 introduces schema version 1 without changing React store persistence version 65.

## Complete-graph transaction history

Cinema history stores bounded snapshots of the complete persisted document. This is deliberate: deleting or editing a composition can affect instances, collections, asset bindings, routes, rules, node/camera overrides, and active selection.

The public history API is:

```ts
beginCinemaHistoryTransaction(label)
commitCinemaHistoryTransaction()
cancelCinemaHistoryTransaction()
undoCinemaEdit()
redoCinemaEdit()
```

Edits inside a transaction do not create intermediate history entries. Commit creates one entry when the document changed. Cancel restores the exact baseline. Redo is cleared only by a newly committed edit. History defaults to 50 entries and is capped at 200.

## Package preflight and serialization

`CinemaPersistencePackageDefinition` extends the Stage 1 package envelope with serialization-safe definition metadata and optional active/editor state. The public package API is:

```ts
preflightCinemaPackage(input)
decodeCinemaPackage(json)
encodeCinemaPackage(packageDefinition)
createCinemaPackageFromPersistedState(state)
persistedStateFromCinemaPackage(packageDefinition)
```

Preflight validates the entire package before mutation. Store imports support atomic replace or merge, stable-ID conflict rejection or explicit replacement, and cancellation before mutation. Failed or cancelled imports leave canonical state unchanged.

Stage 1 schema-v1 packages that omit the Stage 4 `definitions` extension remain readable. Their graph envelope and dependent references are validated immediately, while unresolved node types produce structured `CINEMA_PLUGIN_UNAVAILABLE` warnings and remain subject to full registry validation when the runtime registry is available.

Package JSON contains stable asset IDs only. It never contains temporary URLs, renderer instances, canvas/media elements, compiled plans, WebGL resources, or transient per-frame state.

## Production reachability and legacy compatibility

The Stage 4 production-intended path is:

```text
components/vyzualz/cinema/index.ts
→ useCinemaStore / createCinemaStore
→ Cinema persisted-state normalization
→ Stage 1 domain contracts + Stage 2 registry/graph validation + Stage 3 parameter schemas
→ package preflight / bounded complete-document history
```

Stage 5 still owns engine registration and workspace UI. The React engine catalog remains unchanged: Shader Pads and Cinematic Worlds stay selectable under their existing IDs, and `cinema` is not yet selectable.
