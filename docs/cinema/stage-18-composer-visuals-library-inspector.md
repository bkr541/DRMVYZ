# Stage 18: Composer Visuals, Library, and Schema Inspector

Stage 18 adds the first authored Cinema Composer without introducing a second scene model. The Composer mutates the canonical `CinemaCompositionDefinition` graph stored by `CinemaStore`, and the existing graph compiler/runtime remains the only execution path.

## Production path

`ReactView / ReactEngineBrowser -> CinemaWorkspace -> CinemaStore -> graph validation/compilation -> CinemaRuntime -> CinemaCanvas`

The left Cinema workspace now contains the structured Visuals editor and node Library. The existing right React Inspector routes Cinema to `CinemaInspectorPanel`, which generates master, node/effect, and camera controls from Cinema parameter schemas.

## Structured composition contract

Composer-created compositions are ordinary version-3 Cinema compositions with `metadata.provenance.composerStructured = true`. No persistence schema bump is required because Stage 4 already defined provenance/editor metadata as extensible JSON.

Layer metadata stores only editor structure required to rebuild the canonical graph: stable blend helper ID, order, blend mode, optional mask ID, and effect order. The actual execution graph is always represented by `nodes` and `connections`.

Every edit rebuilds the layer chain, then runs through the existing persisted-state normalization/graph validation boundary. Disabled layers and unused masks/effects are disabled rather than left as active unreachable nodes. The output remains exactly one active Cinema output node.

## History and deletion

`editCinemaComposition` is the single store boundary for Composer graph changes. It records full-document history and reconciles instance overrides plus persisted editor selection after structural edits. Slider gestures use the existing transaction API so one drag creates one undo entry.

Layer deletion removes the layer, its blend helper, attached effects, graph connections, parameter modulation destinations, performance actions that reference removed nodes, stale instance overrides, and invalid selection. Asset bindings owned only by removed nodes are deleted, while bindings still referenced by surviving nodes are preserved.

## Library and Inspector

The Library is derived from the canonical persisted node definitions and production runtime registry. Items expose category/source metadata and a disabled reason when the structured Composer cannot wire them safely or their renderer plugin is unavailable. Legacy adapters remain selectable as library sources. Canonical composition instances are surfaced as saved presets alongside saved compositions; wholesale legacy-preset migration remains reserved for Stage 21.

The Inspector uses `createCinemaControlDescriptors` for master and selected node/effect parameters and `createCinemaCameraParameterSchemas` for camera resources. Stable asset bindings and schema-declared Brand Kit mappings are shown through the same right-side Inspector surface. No hard-coded per-visual parameter panel was added.

## Stage 19 handoff

Stage 18 intentionally does not add Modulation, Performance, Camera, or Timeline editors and does not add a freeform graph canvas. Those panels can operate on the same canonical composition, selection, schema descriptors, and transaction boundary established here.
