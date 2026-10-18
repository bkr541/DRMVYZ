# Legacy Cinema Engine Removal Inventory

## Authority and freeze

This is the Phase 1 removal-boundary inventory for the legacy Cinema engine.
Legacy Cinema is frozen: do not add presets, authoring features, runtime paths,
or new imports of `src/components/vyzualz/cinema`. New visual work belongs in
Cinema 2.0.

The machine-enforced importer baseline is maintained in
`scripts/check-cinema-legacy-boundary.mjs`. Run it with:

```sh
npm run cinema:legacy-boundary:check
```

Any change that removes a legacy import must reduce that allowlist in the same
patch. A new importer is a Phase 1 boundary violation.

As of Phase 3, that check additionally enforces a hard invariant: no production
or test file under `src/components/vyzualz/cinema2` may import anything from the
legacy Cinema directory. The remaining external-import baseline is 24 files,
all owned by later React-shell, migration, browser-harness, or deletion phases.

## Source disposition authority

`src/components/vyzualz/cinema2/migration/Cinema2LegacyMigrationManifest.ts`
is the canonical source-disposition manifest. It covers:

- the `cinema`, `shaderPads`, and `cinematicPortal` engine identities;
- all active Shader sources projected into legacy Cinema;
- all Shader compatibility/reference identities retained by the registry audit;
- all Cinematic Worlds preset identities, including compatibility-only entries;
- the target Cinema 2.0 preset and fixed look patch where one exists; and
- an explicit archive-only disposition where no native replacement was selected.

The manifest is intentionally Cinema 2.0-owned and has no import from the
legacy Cinema directory. The parity test in
`src/components/vyzualz/cinema/__tests__/Cinema2LegacyMigrationManifest.test.ts`
compares it with the current legacy catalogs while those catalogs still exist.

## Intended deletion set

The following items are candidates for deletion only after their owning phase
gate passes. This list describes the boundary; Phase 1 does not delete them.

### Legacy domain, runtime, persistence, and tests

- `src/components/vyzualz/cinema/**`

This includes the graph/domain contracts, compiler, runtime, render-target
pool, node registry, adapters, persistent store, package I/O, composer support,
legacy-retirement bridge, and the legacy unit tests.

### React shell and authoring UI

- `src/components/vyzualz/react/CinemaAdvancedGraphEditor.tsx`
- `src/components/vyzualz/react/CinemaCanvas.tsx`
- `src/components/vyzualz/react/CinemaComposerPanel.tsx`
- `src/components/vyzualz/react/CinemaComposerStage19Panel.tsx`
- `src/components/vyzualz/react/CinemaInspectorPanel.tsx`
- `src/components/vyzualz/react/CinemaLiveOverrides.ts`
- `src/components/vyzualz/react/CinemaMediaLibraryBridge.ts`
- `src/components/vyzualz/react/CinemaWorkspace.tsx`
- `src/components/vyzualz/react/CinemaWorkspaceFrameBridge.ts`
- `src/components/vyzualz/react/CinemaWorkspacePanels.tsx`
- `src/components/vyzualz/react/CinemaWorkspaceRuntimeFrameSource.ts`
- `src/components/vyzualz/react/useCinemaLegacyRetirement.ts`

### Runtime and test harnesses

- `src/test/browser/CinemaRuntimeBrowserHarness.ts`
- `src/test/browser/cinema-runtime.html`
- `src/test/e2e/cinemaRuntimeRendering.spec.ts`
- `scripts/run-cinema-runtime-browser.mjs`
- the `test:e2e:cinema-runtime` package script

### Presentation and documentation

- legacy `.rv-cinema...` selectors in `src/styles/reactView.css`, excluding
  `.rv-cinema2...` selectors;
- legacy Cinema help, gallery, and layout-lab entries;
- `docs/cinema/**` after still-current architectural information is migrated or
  archived;
- superseded legacy Cinema stage documents outside `docs/cinema/**`.

### Conditional older-renderer deletion

The following are not approved for deletion until Phase 3 proves they have no
non-Cinema consumers:

- `src/components/vyzualz/react/renderers/CinematicWorldRenderer.ts`;
- `src/components/vyzualz/react/renderers/cinematic/**`;
- Shader scene and Shader renderer modules used outside the Cinema adapters.

### Phase 3 older-renderer audit

Deletion of the older Cinematic Worlds renderer tree is **not approved as part
of the legacy Cinema directory deletion**. The audit found active consumers
outside `src/components/vyzualz/cinema`, including:

- `CinematicPortalRenderer.ts`, which owns the still-present older portal
  renderer registry/host path;
- Music Intelligence publication tests that exercise
  `cinematicInputFromReactFrame`;
- Afterhours browser and perceptual-acceptance harnesses;
- Cinematic world shader E2E coverage; and
- the world implementations and their own lifecycle/settings tests.

The reusable bounds/vector/anchor contracts those renderers shared with legacy
Cinema now live under `src/components/vyzualz/shared/vectorGeometry`, so these
consumers no longer force retention of legacy Cinema geometry. The renderer
tree itself remains independently owned and must be retired only after its
non-Cinema consumers are migrated or explicitly retired in a later phase.

## Consumers that must be migrated first

The exact direct-import list is enforced by the boundary script. Its consumers
fall into these ownership groups:

| Consumer group | Current dependency | Owning phase |
| --- | --- | --- |
| Cinema 2.0 spatial geometry | Legacy vector mesh, SVG, and OpenType helpers | Phase 3 |
| Cinema 2.0 tests | Legacy WebGL and resize-observer test utilities | Phase 3 |
| Cinema 2.0 production-path test | Legacy foundation and store comparison | Phase 3 |
| React View shell | Workspace, canvas, panels, frame/media/font bridges | Phase 5 |
| React store | Default engine, migrations, Cinema store access, selection handoff | Phase 4/5 |
| Performance pads | `cinemaCompositionId` validation and activation | Phase 4/5 |
| Automation cues | `cinemaCompositionId` validation and activation | Phase 4/5 |
| Track sections | Persisted legacy engine identities | Phase 4 |
| Preset labels and inspectors | Legacy composition selection and names | Phase 5 |
| Output and recording | Legacy canvas ownership | Phase 5 |
| Browser/E2E tests | Legacy runtime harness and scripts | Phase 6 |
| CSS/help/docs/layout lab | Legacy presentation and guidance | Phase 6/7 |

## Persisted data policy

The legacy store can contain more than built-in presets. Its data must be
handled as follows before deletion:

| Data | Phase 1 policy |
| --- | --- |
| Built-in composition | Resolve through the typed manifest. |
| Retired built-in source | Preserve in the legacy archive; do not silently choose a visually different preset. |
| User-authored composition | Preserve until translated or explicitly exported by the user. |
| Composition instance | Preserve with its source composition and overrides. |
| Collection/favorite/recent item | Migrate mapped members and retain the original archive. |
| Imported Cinema package | Retain a versioned reader and raw export path. |
| Editor metadata/history | Archive with the source document; it is not required in the live Cinema 2.0 runtime. |

Silent deletion is prohibited. Phase 2 owns the durable archive/export and any
supported translation implementation.

## Phase 1 validation gate

Phase 1 is complete when:

- the migration-manifest test proves complete and unique source coverage;
- every migration destination is registered in Cinema 2.0;
- every authored look patch is accepted by the target parameter schema;
- every retired source has a reason and archive recovery policy;
- the legacy importer boundary check passes; and
- the Phase 1 evidence is recorded in the progress tracker.
