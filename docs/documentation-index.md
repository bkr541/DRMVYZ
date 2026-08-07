# DRMVYZ documentation index

## How to use this index

Documentation in this repository has different authority levels.

- **Canonical current documentation** describes the architecture that new code must follow.
- **Current feature documentation** describes an active engine or subsystem.
- **Operations and verification** describes deployment, testing, packaging, or schema administration.
- **Historical patch records** document a particular implementation sequence and may contain deferred work that has since been completed.
- **Acceptance records** define evidence required for a specific release gate.

When a historical document conflicts with canonical current documentation or the current code, use the canonical document and update it in the same patch.

## Canonical current documentation

| Document | Authority |
| --- | --- |
| `AI_IMPLEMENTATION_CONTRACT.md` | React View UI, implementation, reuse, lifecycle, persistence, and patch contract |
| `docs/react-view-architecture.md` | Current React View shell, engine registry, workspace composition, stage, rails, lower workspace, and recording ownership |
| `docs/music-intelligence.md` | Live Music Intelligence frame, analysis sources, diagnostics, and consumer rules |
| `docs/loaded-audio-analysis.md` | Loaded-track analysis authority, cache, fallback, and publication contract |
| `docs/shared-performance-core.md` | Shared musical context, engine performance programs, routing, determinism, and diagnostics |
| `docs/verification.md` | Node baseline, verification scripts, CI, specialized suites, and source packaging |
| `docs/source-packaging.md` | Source-only archive rules |

## Current engine and subsystem documentation

### React engines

| Document | Scope |
| --- | --- |
| `docs/shader-pads.md` | Shader Pads engine, scene library, editor, renderer, persistence, and lifecycle |
| `docs/shader-native-performance-programs.md` | Authored Shader performance programs and route ownership |
| `docs/cinematic-worlds.md` | Cinematic Worlds configuration, renderer, camera direction, and lifecycle |
| `docs/cinema/07-webgl-runtime-and-render-target-pool.md` | Cinema single-owner WebGL runtime, target pool, texture handles, and context recovery |
| `docs/sound-drawing.md` | Sound Drawing sources, timeline, performance programs, Living Ribbon, professional scope signal core, and rendering |
| `docs/canvas.md` | CANVAS media, authored composition, playback, effects, transitions, and limits |
| `docs/pixgrid.md` | PixGrid state, canonical controls, media, groups, routing, choreography, rendering, diagnostics, and acceptance |
| `docs/laser-dmx-production-rig-architecture.md` | Current LaserDMX normalized rig, fixture, cue, stage, and output boundary |
| `docs/laser-dmx-choreography.md` | Current LaserDMX choreography behavior |
| `docs/laser-dmx-professional-show-authoring.md` | Show Director authoring conventions |
| `docs/show-director-performance-programs.md` | Show Director performance-program architecture and built-in programs |
| `docs/laser-dmx-fixture-optics-and-primitives.md` | Current fixture optics and rendered primitive ownership |
| `docs/laser-dmx-temporal-optics.md` | Current temporal optics behavior |
| `docs/laser-dmx-webgl-rendering.md` | Current WebGL rendering architecture |
| `docs/laser-dmx-webgl-hdr-post-processing.md` | Current HDR and post-processing behavior |
| `docs/laser-dmx-production-output.md` | LaserDMX output summary and safety boundary |

### Cross-engine systems

| Document | Scope |
| --- | --- |
| `docs/brand-kit.md` | Brand Kit storage, palettes, assets, overlays, and engine integration |
| `docs/react-recording-and-output.md` | React View recording and LaserDMX Production Output |
| `docs/contracts/CROSS_ENGINE_CONTROL_SCOPES.md` | Canonical LaserDMX, Shader Pads, CANVAS, Cinematic camera, and preset-provenance control scopes |
| `docs/contracts/APPEARANCE_CONTRACT.md` | Canonical Dark/Light/CDJ ownership, startup bootstrap, persistence, and legacy appearance compatibility |
| `docs/visual-simulation.md` | Shared bounded visual-simulation utilities |
| `docs/living-ribbon-production-validation.md` | Living Ribbon production limits and acceptance |
| `docs/lyric-manager.md` | Lyric Manager behavior |
| `docs/rekordbox-import.md` | Rekordbox XML and USB import behavior |

## Operations, deployment, and data

| Document | Scope |
| --- | --- |
| `docs/lyric-transcription-deployment.md` | Supabase Edge Function and Groq Whisper deployment |
| `docs/supabase-schema.md` | Supabase schema and migration overview |
| `docs/verification.md` | Local and CI verification |
| `docs/source-packaging.md` | Source archive generation |

## Acceptance records

These documents remain active only for the acceptance gate they define.

| Document | Scope |
| --- | --- |
| `docs/PIXGRID_SCREEN_RECORDING_ACCEPTANCE.md` | Human-visible PixGrid recording evidence |
| `docs/living-ribbon-production-validation.md` | Living Ribbon measured production acceptance |

## Historical patch records

The following files describe implementation phases or corrective patches. They are retained as history and test rationale, not as the primary source for current architecture:

- `docs/LASER_DMX_FINITE_CUE_PHYSICAL_RENDERER_PATCH_2.md`
- `docs/LASER_DMX_PHYSICAL_SCANNER_ARCHITECTURE.md`
- `docs/LASER_DMX_PHYSICAL_SCANNER_PATCH_2.md`
- `docs/LASER_DMX_PHYSICAL_SCANNER_PATCH_3.md`
- `docs/LASER_DMX_PHYSICAL_SCANNER_PATCH_4.md`
- `docs/LASER_DMX_PHYSICAL_SCANNER_PATCH_5.md`
- `docs/LASER_DMX_PHYSICAL_SCANNER_PATCH_6.md`
- `docs/LASER_DMX_PRESET_REALISM_PATCH_3.md`
- `docs/LASER_DMX_SHOW_PROGRAMMING_ARCHITECTURE.md`
- `docs/LASER_DMX_SHOW_PROGRAMMING_CORRECTIVE_PATCH_2.md`
- `docs/laser-dmx-corrective-patch-2-depth-history-optics.md`
- `docs/laser-dmx-corrective-patch-3-final-hardening.md`
- `docs/PIXGRID_UNIFIED_PERFORMANCE_RUNTIME.md`

Do not copy a “deferred” item or file path from a historical record into a new prompt without confirming it against the current repository.

## Documentation maintenance rules

Update documentation in the same patch when changing:

- React shell or engine workspace composition
- Engine registry or selectable engine IDs
- Persistence versions or migrations
- Music Intelligence or Shared Performance authority
- Renderer lifecycle, quality, fallback, or recovery
- Recording or production output
- Brand Kit ownership
- Verification scripts, Node baseline, or CI
- Source packaging rules

Prefer updating a canonical current document over adding another patch-note document.

When adding a new current document, add it to this index.

- [Cinema Stage 17: Graph-Aware Quality, Diagnostics, and Context Recovery](cinema/stage-17-quality-diagnostics-context-recovery.md)
