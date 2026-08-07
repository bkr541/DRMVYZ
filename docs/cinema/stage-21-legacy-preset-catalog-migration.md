# Stage 21: Adapter-Backed Legacy Preset Catalog

Stage 21 makes every active production Shader Pads scene and Cinematic Worlds preset available as an immutable built-in Cinema composition while retaining the standalone legacy engines.

## Production discovery

The catalog is generated from the production sources that already drive the legacy engines:

- `PRODUCTION_SCENES` is the Shader Pads source of truth. The current repository exposes 8 active scenes. `SHADER_SCENE_REGISTRY_AUDIT` remains the explicit exclusion record for retired, folded, or incomplete scene exports.
- `DEFAULT_REACT_PRESETS.filter(preset => preset.engine === 'cinematicPortal')`; catalog construction fails explicitly if an active entry lacks `cinematicConfig` is the Cinematic Worlds source of truth. The current repository exposes 29 active presets, including the separately authored Reactive Constellation curated library.
- The global Shader registry's development solid-color fixture is intentionally not promoted into the built-in Cinema library.
- `legacyPortal` remains a registered Canvas2D compatibility adapter but has no active default Cinematic Worlds preset in the current production preset library, so no synthetic manifest entry is invented for it.

The implementation does not encode those counts as acceptance constants. Tests compare the manifest to the live production sources so future additions must acquire a Cinema mapping and future retirements can be intentional.

## Stable catalog contract

`CinemaLegacyPresetCatalog.ts` owns catalog version 1. Each manifest row records:

- legacy source kind and legacy engine ID;
- exact legacy source ID;
- Cinematic world ID when applicable;
- stable built-in Cinema composition ID; and
- adapter node type ID.

Every catalog composition contains exactly one adapter-backed render source connected to the canonical Cinema output node. Stable IDs are derived from legacy IDs rather than display labels. The compositions retain built-in provenance so the existing Cinema Library treats them as immutable built-ins and users can duplicate them into editable user compositions through the Stage 20 workflow.

## Fidelity boundary

Shader catalog compositions preserve scene name, description, category, tags, quality metadata, and the native performance-program snapshot as provenance on the adapter node. Runtime rendering continues through `ShaderSceneNodeAdapter`; Shader Pads canvas/context/loop ownership is not imported into Cinema.

Cinematic catalog compositions preserve the legacy preset name, description, palette, render controls, normalized `CinematicWorldConfig`, scenes, section mappings, camera resource baseline, audio-mapping configuration, and world-specific parameter values. `CinematicWorldNodeAdapter` and the Canvas2D compatibility adapter can recover this snapshot at runtime, while all GPU targets, WebGL services, and animation ownership remain Cinema-owned.

## Persistence and reconciliation

The persisted Cinema schema is unchanged because Stage 21 adds built-in data using the existing composition and editor-metadata representation. `createCinemaFoundationPersistedState()` includes the complete catalog and `reconcileCinemaBuiltInState()` restores/replaces canonical catalog definitions when an older valid Cinema document is opened. User compositions, active composition identity, unrelated engine state, and the existing Stage 9/10 reference compositions are preserved.

`editorMetadata.legacyPresetCatalogVersion` records the installed built-in catalog version without reinterpreting older schema versions.

## Validation coverage

`CinemaLegacyPresetCatalog.test.ts` verifies live-source mapping completeness, stable one-to-one identities, graph validation/compilation for every catalog composition, canonical store/library reachability, reconciliation, legacy engine selectability, Reactor provenance, and Reactive Constellation config/camera/audio fidelity.

The real browser Cinema runtime harness additionally renders:

1. a simple Shader composition;
2. Reactor;
3. a catalog-backed Event Horizon preset;
4. a catalog-backed Reactive Constellation preset; and
5. LegacyPortal through its offscreen Canvas2D upload boundary.

It retains the existing assertions for one WebGL2 context, one runtime animation frame, target-pool cleanup, context loss/restoration, and renderer disposal.
