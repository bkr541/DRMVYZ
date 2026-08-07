# Cinema Stage 23: Retire legacy engine identities

Stage 23 makes Cinema the public home for the content formerly exposed as **Shader Pads** and **Cinematic Worlds**.

## Public engine contract

`REACT_ENGINE_IDS` contains only user-facing engines. `shaderPads` and `cinematicPortal` are intentionally excluded from that list and from the engine selector. They remain in `REACT_KNOWN_ENGINE_IDS` and `REACT_ENGINE_CATALOG` as compatibility identifiers so persisted projects and imported packages can still be interpreted deterministically.

The public startup engine is `cinema`. Direct Shader Pads canvas routing is retired; the live React stage reaches Shader and Cinematic content through Stage-21 Cinema compositions and the single Cinema runtime.

## Restore and migration contract

The React persisted-store middleware version is 67. Hydration/import captures legacy engine plus source identity before normal selection repair, then rewrites the public selection to `cinema` and stores a bounded `pendingCinemaLegacySelectionMigration` handoff. That handoff is project-routed so a split project restore cannot discard it before Cinema consumes it.

The production `ReactView` mounts `useCinemaLegacyRetirement`, which resolves the handoff against the immutable Stage-21 legacy catalog and writes authored compatibility state into the canonical Cinema persisted document. Library/config migration is marked once in Cinema `editorMetadata`; after that marker is committed, Cinema remains authoritative and the compatibility bridge does not overwrite later Cinema edits. The handoff preserves:

- the active Cinematic Worlds preset and its saved Cinematic configuration;
- the active Shader scene plus every persisted per-scene parameter value set from the Shader panel store;
- shared React master controls as Cinema instance overrides;
- Cinematic Worlds performance-pad and automation-cue destinations as stable Cinema composition IDs;
- Shader Library user presets whose source scene has a Stage-21 production mapping as Cinema composition instances;
- every persisted Cinematic Worlds per-preset configuration override as a Cinema composition instance;
- legacy React/Shader favorites and Shader collections as Cinema collections.

The React compatibility handoff is cleared only after a valid mapped Cinema composition is available and the Cinema persisted document hydrates successfully. Brand Kit settings and layout-lab engine pickers no longer advertise Shader Pads or Cinematic Worlds; Cinema's Brand Kit color semantics remain controlled through the Cinema Composer rather than a legacy per-engine card.

## Runtime compatibility boundary

Legacy renderer and adapter source is retained. Stage 23 does **not** delete Shader or Cinematic renderer implementations. Generic performance actions may still resolve a Stage-21 Cinematic composition back to its internal `cinematicPortal` world target so the extracted Cinema adapter receives the existing world-specific action semantics without restoring a public legacy engine or second live runtime.

## Remaining adapter/native-migration debt

- Shader scene rendering still uses the Stage-9 Shader scene adapter inside Cinema.
- Cinematic Worlds rendering still uses the Stage-10 Cinematic adapter and extracted camera/world services.
- Legacy Shader Library and Cinematic preset/config stores remain readable as migration sources. They should be removed only after a separately validated native-authoring migration proves that all supported old projects, favorites, collections, presets, and renderer-specific settings round-trip without them.
- The Stage-21 retirement gate covers the production Shader scene registry. Dynamically authored Shader scene definitions that never received a Stage-21 stable composition ID remain preserved in the legacy Shader Library data, but Stage 23 does not invent replacement stable IDs for them. A future native-authoring migration must explicitly define and test that contract before the legacy source can be deleted.
- Stable Stage-21 composition IDs are compatibility contracts and must not be renamed during future native migrations.

Removal of those sources is intentionally outside Stage 23.
