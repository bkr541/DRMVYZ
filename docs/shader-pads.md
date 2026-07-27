# Shader Pads

## Purpose

Shader Pads is the WebGL2 scene engine for authored GLSL visuals. It owns scene selection, parameter editing, texture inputs, transitions, feedback, Music Intelligence modulation, Shared Performance programs, adaptive quality, diagnostics, and shader authoring.

The React View engine ID is `shaderPads`. Shader Pads uses **SCENES** as its top-level browser label rather than **PRESETS**.

## Canonical implementation

| Responsibility | Current authority |
| --- | --- |
| React stage canvas | `src/components/vyzualz/react/ReactShaderCanvas.tsx` |
| Renderer integration spine | `src/components/vyzualz/react/shaders/ShaderEngineRenderer.ts` |
| WebGL lifecycle | `src/components/vyzualz/react/shaders/runtime/ShaderWebGLRuntime.ts` |
| Render graph | `src/components/vyzualz/react/shaders/rendergraph/` |
| Scene registry | `src/components/vyzualz/react/shaders/scenes/index.ts` |
| Definition registry and schema | `src/components/vyzualz/react/shaders/registry/` |
| Scene library | `src/components/vyzualz/react/shaders/library/` |
| Shader editor | `src/components/vyzualz/react/shaders/editor/` |
| Right-rail UI | `src/components/vyzualz/react/shaders/ui/` |
| Performance programs | `src/components/vyzualz/react/shaders/performance/` |
| Audio bridge | `src/components/vyzualz/react/shaders/audio/` |
| Modulation | `src/components/vyzualz/react/shaders/modulation/` |
| Texture inputs | `src/components/vyzualz/react/shaders/textures/` |
| Brand Kit integration | `src/components/vyzualz/react/shaders/brand/` |
| Transitions and section choreography | `src/components/vyzualz/react/shaders/transitions/` |
| Feedback lifecycle | `src/components/vyzualz/react/shaders/feedback/` |

## React View composition

Shader Pads uses:

- **WORKSPACE → SETUP** in the left rail
- **SCENES** for scene selection and library management
- **DESIGN → ENGINE / SELECTION** for master and selected-scene controls
- **REACT → ROUTING / ANALYSIS** for modulation and diagnostics
- **OUTPUT → RECORDING** for browser capture
- Track Map in the lower workspace

Performance Pads are not exposed for Shader Pads. Authored scene and section behavior is resolved through Shader performance programs and Shared Performance context instead.

## Renderer lifecycle

`ShaderEngineRenderer` owns the WebGL subsystems and follows this lifecycle:

1. Create `ShaderWebGLRuntime` for the live canvas.
2. Compile and load the active scene graph.
3. Resize from the visible stage dimensions and effective quality scale.
4. Resolve audio, Shared Performance context, modulation, uniforms, transitions, feedback, and textures once per frame.
5. Render and publish bounded diagnostics.
6. Dispose programs, framebuffers, textures, feedback resources, outgoing transition executors, and listeners on unmount or replacement.

The renderer must not compile unchanged graphs or allocate unbounded resources in the animation loop.

## Scene registry and library

Built-in scenes are registered through `src/components/vyzualz/react/shaders/scenes/index.ts` and validated through the shader registry contracts.

User-authored or imported scenes are owned by `ShaderLibraryStore`. Scene definitions must use the same parameter schemas, pass graph contracts, validation, and texture-unit limits as built-in scenes.

A scene switch preserves the outgoing graph and feedback history only for the duration of the transition. The outgoing executor is disposed when the transition completes or is cancelled.

## Parameters and modulation

Shader parameters are typed by the registry schema. The UI must use the schema and shared control primitives rather than creating a parallel parameter model.

Per-frame modulation is resolved by:

- `ShaderAudioBridge`
- `ShaderModulationEvaluator`
- `ShaderModulationMatrix`
- Shared Performance context
- Authored Shader performance programs

Music Intelligence and Shared Performance remain the timing and section authorities. Shader code must not derive a competing beat, phrase, or section timeline.

## Feedback and transitions

Feedback uses bounded ping-pong resources. Feedback resets are explicit and tracked through `ShaderFeedbackResetTracker`.

Scene and section transitions are resolved through the transition controller, transition renderer, and section choreography. A same-scene section action may run as a compositor transition without replacing the active scene. Seeking reconstructs stable state rather than replaying transient effects.

## Texture and Brand Kit inputs

Texture selection is managed by `ShaderTextureInputManager`. Reserved texture units are defined by the runtime contract and must not collide with scene inputs.

Brand Kit integration may supply:

- Effective palette uniforms
- Resolved color parameters
- Brand texture assets
- Active overlays

See `docs/brand-kit.md`.

## Persistence

`shaderPanelStore.ts` owns persisted Shader UI and authored state. High-frequency diagnostics such as compile status and performance metrics are runtime-only and must not be persisted.

Persistence changes require normalization or migration. A failed or unsupported saved scene must fall back safely without corrupting the scene library.

## Quality, recovery, and diagnostics

`ShaderPerformanceMonitor` and `ShaderQualityController` own adaptive quality. Quality changes may adjust internal resolution and renderer workload, but they must not change musical timing or authored scene identity.

The WebGL runtime must handle context loss, restore, compilation failure, invalid passes, unavailable textures, and transition allocation failure without leaving an orphaned animation loop.

Diagnostics are rate-limited before publication to React state. Compile status, graph errors, pass metrics, quality, and validation remain bounded.

## Authoring rules

The editor under `src/components/vyzualz/react/shaders/editor/` is the canonical shader-authoring surface. It must:

- Edit the active library definition rather than a detached copy
- Compile through the same compiler used by the renderer
- Report graph and pass errors textually
- Preserve the last valid live output when a new edit fails where practical
- Dispose preview resources on reset, scene change, and unmount
- Avoid persisting runtime handles or diagnostic callbacks

## Validation

Changes to Shader Pads should run the general verification suite plus the relevant Shader tests. The end-to-end compilation surface is available through:

```bash
npm run test:e2e:shaders
```

See `docs/shader-native-performance-programs.md` for the authored performance-program contract and `docs/verification.md` for repository-wide gates.
