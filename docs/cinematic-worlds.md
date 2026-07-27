# Cinematic Worlds

## Purpose

Cinematic Worlds is the WebGL cinematic environment engine. It renders authored worlds with camera direction, post-processing, audio modulation, Shared Performance timing, adaptive presentation, and deterministic lifecycle behavior.

The React View engine ID is `cinematicPortal`.

## Canonical implementation

| Responsibility | Current authority |
| --- | --- |
| Engine controls | `src/components/vyzualz/react/CinematicWorldsControls.tsx` |
| Settings and defaults | `src/components/vyzualz/react/CinematicWorldSettings.ts` |
| World configuration | `src/components/vyzualz/react/CinematicWorldConfig.ts` |
| Control schema | `src/components/vyzualz/react/CinematicWorldControlSchema.ts` |
| React renderer adapter | `src/components/vyzualz/react/renderers/CinematicPortalRenderer.ts` |
| World renderer | `src/components/vyzualz/react/renderers/CinematicWorldRenderer.ts` |
| WebGL runtime | `src/components/vyzualz/react/renderers/cinematic/CinematicWebGLRuntime.ts` |
| Camera direction | `src/components/vyzualz/react/renderers/cinematic/CinematicCameraDirector.ts` |
| Audio modulation | `src/components/vyzualz/react/renderers/cinematic/CinematicAudioModulation.ts` |
| Post-processing | `src/components/vyzualz/react/renderers/cinematic/CinematicPostProcessingPipeline.ts` |
| World direction | `src/components/vyzualz/react/renderers/cinematic/CinematicWorldDirection.ts` |
| World registry | `src/components/vyzualz/react/renderers/cinematic/worlds/index.ts` |

## React View composition

Cinematic Worlds uses:

- **WORKSPACE → SOURCE** in the left rail
- **PRESETS** for world selection
- **DESIGN → ENGINE / SELECTION** for global and selected-world controls
- **REACT → ROUTING / ANALYSIS** for Music Intelligence behavior and diagnostics
- **OUTPUT → RECORDING** for browser capture
- Track Map and Performance Pads in the lower workspace

The center remains the live world output. World browsing and configuration belong in the rails.

## World contract

A Cinematic World is a registered renderer with stable identity, settings, bounded resources, and explicit lifecycle methods. Built-in worlds currently live under `renderers/cinematic/worlds/`.

World implementations must:

- Use the shared WebGL runtime rather than creating unmanaged contexts
- Respect the current canvas resolution and stage resize lifecycle
- Consume the provided audio and Shared Performance context
- Keep shader, framebuffer, texture, and listener ownership bounded
- Dispose all owned resources on replacement and unmount
- Provide a safe diagnostic or fallback output when initialization fails

## Audio and musical authority

`CinematicAudioModulation` translates the shared frame into world-facing modulation. `CinematicCameraDirector` and `CinematicWorldDirection` use the same authoritative beat, bar, phrase, and section context.

Worlds must not create an independent section classifier or transport clock. Autonomous motion may continue while audio is unavailable, but music-driven claims must reflect actual source availability.

Seeking, loop re-entry, track replacement, pause, and stop must produce deterministic state transitions. Transient events should not replay merely because React remounted a control surface.

## Camera direction

Camera motion is directed through `CinematicCameraDirector`. World shaders may expose camera-compatible parameters, but camera ownership remains centralized so authored direction, section behavior, and user controls do not fight one another.

Camera movement must remain bounded and avoid discontinuities when quality, section, or world settings change.

## Post-processing

`CinematicPostProcessingPipeline` owns engine-level post-processing. Effects must:

- Use bounded render targets
- Resize with the runtime
- Avoid per-frame resource creation
- Preserve readable output under reduced quality
- Fail safely when an optional stage is unavailable

## Persistence and presets

World selection and settings use the React engine store and preset system. New settings require defaults, normalization, and migration where persisted state is affected.

Preset cards should use the shared React preset-card architecture. A preset must resolve to a valid registered world and valid normalized settings.

## Recovery and diagnostics

The runtime must recover or fall back safely after context loss, shader failure, invalid world configuration, or allocation failure. Diagnostic state must remain bounded and must not continue reporting a prior world after engine replacement.

Current lifecycle coverage includes audio modulation, camera direction, and WebGL runtime tests under `renderers/cinematic/__tests__/`.

## Extension checklist

When adding a world:

1. Register it through the world registry.
2. Add typed defaults and control schema entries.
3. Use shared camera, audio, post-processing, and runtime services.
4. Define deterministic reset and disposal behavior.
5. Add lifecycle and musical-behavior tests.
6. Update this document if the world introduces a new shared capability.
