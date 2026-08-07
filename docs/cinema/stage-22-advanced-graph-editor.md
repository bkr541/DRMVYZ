# Cinema Stage 22: Advanced Freeform Graph Editor

Stage 22 adds an optional advanced graph authoring view to the production Cinema Composer. It does not add a renderer, canvas owner, WebGL context, media owner, or animation loop. The graph surface is DOM/SVG authoring UI over the same `CinemaCompositionDefinition` already consumed by validation, compilation, the runtime executor, preview, recording, and output paths.

## Production path

`ReactEngineBrowser` / saved React engine selection → `CinemaWorkspace` panel surface → `CinemaComposerPanel` → `CinemaAdvancedGraphEditor` → `useCinemaStore` → canonical `CinemaCompositionDefinition` → existing graph validator/compiler/runtime.

The structured Composer and graph editor switch via persisted editor metadata. Switching views never rebuilds or rewrites the composition. `CinemaInspectorPanel` continues to read the shared primary node selection, so selection made in the graph is immediately visible to the existing Inspector.

## Persisted editor metadata

The Cinema persisted-store and package envelopes advance from schema version 3 to 4. Composition schema version remains 3 because runtime semantics are unchanged.

`editorMetadata.advancedGraphEditor` is independently versioned at version 1 and contains only authoring state:

- per-composition editor mode (`structured` or `graph`)
- graph viewport pan/zoom
- node positions
- selected node IDs and selected connection ID

The existing `composerSelectionByComposition` primary selection is mirrored for backward compatibility. Layout metadata is not an input to graph validation or compilation, so moving a node cannot change execution order.

## Editing and safety model

- Existing canonical nodes and connections are edited through `CinemaStore.editCinemaComposition`.
- New nodes start disabled so the store never has to commit an unreachable or partially wired active graph.
- Connections involving a disabled draft are persisted disabled. Enabling selected nodes atomically enables compatible incident edges and passes through the existing persisted-state validator before commit. This supports safe insertions such as Source → disabled Effect → Output, with the occupied single-input edge replaced in the same canonical mutation.
- Invalid port directions, incompatible data types, single-input cardinality violations, and newly introduced graph cycles are rejected before mutation.
- Deleting nodes also removes dependent edges, node parameter modulation destinations, performance actions, and unreferenced asset bindings. When a single-input edge was displaced by inserting a one-in/one-out draft node, the preserved disabled bypass edge is restored during deletion so the canonical graph does not strand the downstream node.
- The active output node cannot be deleted or disabled. The graph toolbar activates disabled drafts but does not offer a destructive blanket disable toggle for already-live nodes.
- Multi-node drag is coalesced into one existing Cinema history transaction. Undo/redo snapshots include canonical graph data and editor metadata together.
- Scoped composition package export/import retains only that composition's graph editor metadata. Merge import combines graph metadata by composition ID instead of overwriting unrelated editor layouts.

## Scale and fallback

The graph surface culls nodes outside the viewport and hard-bounds mounted graph cards to `CINEMA_GRAPH_EDITOR_MAX_VISIBLE_NODES` (120). Connections render as SVG paths and node cards never instantiate Cinema renderer plugins.

An error boundary contains graph-surface failures and presents a structured form/list fallback for selection and typed connection authoring. Canonical Cinema state is not replaced when the graph UI fails.

## Accessibility

The visual graph supports keyboard Delete/Backspace, focusable controls, multi-selection, readable diagnostics, and non-color state labels. A disclosure below the graph provides select-based typed connection controls plus node/connection lists so core graph operations do not require pointer dragging.

## Stage 23 handoff

Stage 22 intentionally leaves Shader Pads and Cinematic Worlds selectable and changes no Cinema runtime execution semantics. Stage 23 can rely on the canonical composition schema, advanced editor metadata migration, and final authoring surface without inheriting a second graph store or renderer owner.
