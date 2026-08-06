# Cinema Stage 5: Engine Registration and Workspace Shell

Cinema Stage 5 registers the stable `cinema` engine ID in DRMVYZ's production React engine catalog and mounts a safe, non-rendering workspace over the canonical Stage 4 Cinema store. Shader Pads and Cinematic Worlds retain their existing IDs, presets, renderers, and ownership models.

## Production route

The user-visible route is:

```text
ReactEngineBrowser
→ useReactStore.selectReactEngine("cinema")
→ persisted activeReactEngineId
→ ReactView / ReactEnginePanel
→ CinemaWorkspace
→ useCinemaStore canonical authored state and diagnostics
```

Cinema is a standalone, preset-free engine. Selecting it clears `activeReactPresetId` instead of inventing a legacy React preset. React store persistence advances from version 65 to 66; the migration preserves a Cinema selection and removes any stale preset association.

## Workspace contract

`CinemaWorkspace` is read-only in this stage. It reports:

- active composition and instance metadata
- composition and persisted-store schema versions
- composition and instance counts
- structured Cinema diagnostics
- the explicit `runtimeAvailable: false` capability state

A missing active composition or instance reference produces a structured validation diagnostic and safe non-rendering output. The workspace does not mutate canonical Cinema state while deriving status.

## Runtime and ownership boundary

Stage 5 intentionally creates no canvas, WebGL context, requestAnimationFrame loop, renderer, target, texture, media object, or GPU resource. `ReactLiveEngineId` excludes `cinema`, making the existing live-preview ownership service unavailable to the Stage 5 shell at the type boundary.

Switching from Shader Pads or Cinematic Worlds to Cinema unmounts the legacy renderer through the existing React route. Switching back reaches the unchanged production renderer branches.

## Stage 6 handoff

Stage 6 may build on the stable `cinema` engine identity, production workspace mount point, canonical Cinema store, and preset-free selection/persistence behavior. It must continue to respect the single-runtime ownership rules when adding normalized frame context and musical clocks.
