# CANVAS preset specification: Cellular

**Implementation status: Started**

The direct CANVAS preset is available. The browser smoke test covers the still-image path and processed screenshots. The broader acceptance checks below are still pending.

| Identity | Value |
| --- | --- |
| Preset name | Cellular |
| Visual effect | Reaction diffusion / organic growth |
| Stable preset ID | `canvas-cellular` |
| Renderer kind / nested settings key | `cellular` |
| Renderer subsystem | `src/components/vyzualz/react/renderers/cellular/` |
| Initial nested settings version | `1` in CANVAS settings schema 17 |

## Desired effect and media

Grow evolving cells, veins, islands, and maze-like structures from the selected image. Logos remain identifiable as organic boundaries develop across them. Use a genuine coupled reaction–diffusion field, such as Gray–Scott, rather than renaming a noise warp or blur feedback loop.

PNG, JPEG, WebP and SVG seed the simulation through alpha or luminance. The existing video decoder supplies moving source masks, with field continuity across ordinary video frames. Opaque photographs must work without overlay transparency admission.

## Parameters

Use one scoped Design group. Normalize non-finite numbers to defaults and clamp
finite out-of-range values. Validate exact enum IDs.

| Parameter | Range / choices | Default | Purpose |
| --- | --- | --- | --- |
| Growth Amount | 0–1 | 0.65 | Master visible simulation influence; zero is the untouched source. |
| Growth Speed | 0–2 | 1 | Bounded simulation evolution rate, independent of audio response. |
| Cell Scale | 2–64 px | 12 | Desired source-relative size of the emergent pattern. |
| Feed Rate | 0–0.1 | 0.0367 | Advanced reaction parameter; normalize and validate stable operating behavior. |
| Kill Rate | 0–0.1 | 0.0649 | Advanced reaction parameter controlling how quickly cells decay. |
| Diffusion Balance | 0–1 | 0.5 | Relative spread of the two simulated fields within a stable integration range. |
| Source Injection | 0–1 | 0.5 | Continually re-anchor growth to source alpha/luminance. |
| Edge Definition | 0–1 | 0.55 | Contrast and contour definition of the simulated cells. |
| Color Mode | source / duotone | source | Sample source colors, or use two explicit colors through existing ColorRow controls. |
| Duotone Colors A / B | hex colors | #13202b / #55ffcc | Conditional on Duotone; use canonical ColorRow controls. |
| Allow Growth Outside Alpha | off / on | off | Opt-in alpha expansion; otherwise retain the source silhouette. |
| Reseed | action | — | Reset the field using the authored seed and current source. |
| Source Reconstruction | 0–1 | 0 | 0 = processed image; 1 = original current source. This is separate from CANVAS Dry Source Mix. |
| Audio Reactivity | 0–1 | 0.65 | Scales audio modulation; 0 retains controllable manual time-based animation. |
| BPM Sync | off / on | off | Use a qualified shared beat position for movement rate; independent of Audio Reactivity. |
| Auto Performance | off / on | off | Allow temporary section-aware runtime direction within authored bounds; never overwrite the recipe. |
| Deterministic Seed | 0–2147483647 integer | 91817 | Seed procedural variation; the live field stays outside persistence. |
| Quality | auto / low / balanced / high | auto | Bound field resolution and presentation size. |
| Reset Preset | action | — | Restore this preset's defaults while preserving active media, library IDs, pools and other presets. |

## Audio Intelligence behavior

| Shared intelligence | Intended response |
| --- | --- |
| Bass/sub | Increase growth-front movement and bounded cell expansion. |
| Kick | Inject a brief source-derived seed pulse instead of clearing the entire field. |
| Snare/transient | Perturb growth edges with a short, clamped impulse. |
| Mids / highs | Adjust cell detail / fine contour emphasis without unstable solver coefficients. |
| Build / drop | Increase visible growth through a build; a qualified drop introduces a larger bounded injection. |
| Intro / breakdown / outro | Retain source recognition and gradually increase reconstruction. |

Consume the existing `SharedPerformanceContext` and canonical transport position. Add no analyzer, beat detector, metronome or alternate transport. Gate bands, rhythm events and section semantics by capabilities/confidence, smooth continuous modulation, clamp impulses and deduplicate event identities. Seek/loop/replacement/reset samples must not invent a drop or trigger.

Auto Performance adds temporary section-based source reconstruction. The authored
Color Mode stays selected and choosing it disables Auto Performance. BPM Sync can
use the qualified shared beat position independently of Audio Reactivity. With
insufficient musical context, the preset uses manual animation timing.

## Rendering and reset policy

The WebGL2 solver packs two 16-bit concentrations into RGBA8 and uses two
reusable ping-pong targets. Each frame uses at most one recursive update with
a bounded timestep and one presentation pass. The field caps for Low, Balanced
and High are 256, 512 and 768 pixels on the longest edge. The corresponding
output caps are 960, 1920 and 2560 pixels. Auto selects a tier from the stage
area. Source texture uploads are capped at 4096 pixels on the longest edge.
The two simulation targets together use up to 4.5 MiB, separate from source,
drawing-buffer and CANVAS capture allocations.

The field follows the existing CANVAS fit and source transforms. Default alpha
is confined to the source silhouette. Opt-in growth can extend within the fitted
source frame. Zero Growth Amount or full Source Reconstruction uses the native
source. GPU failure falls back to the drawable source. CANVAS publishes the
direct processed frame through its existing capture compositor. Active Shows
and authored compositions keep their own stage and capture ownership.

Pause holds the field. Reseed and a resolved seek while paused can show a fresh
seed, which then holds. Resume, timing discontinuities, source revision and field
resize start a new field. Repeated seeds are deterministic for the same input
and settings. Historical frame replay is outside the implementation.

## Verification

Focused tests cover preset registration, defaults, normalization, provenance,
resource sizing and qualified audio modulation. The Chromium smoke test uses a
generated transparent PNG to verify temporal evolution, different feed/kill
regimes, alpha confinement and expansion, deterministic reseed, native
reconstruction, processed CANVAS screenshots, pause and reseed while paused.
See [verification](verification.md#cellular-browser-smoke) for the command.

Moving-video injection, real recording and casting, broader source and failure
cases, and extended GPU performance profiling remain pending.

## Visual references

These demonstrate the target effect; their host-application projects are visual
references rather than drop-in CANVAS implementations.

- [Reaction Diffusion and Parameterization — Ben Heim](https://www.youtube.com/watch?v=JSp9AQ_wBZw)
- [Gray–Scott Reaction Diffusion — Lake Heckaman](https://www.youtube.com/watch?v=1k_uPHcV6BA)
