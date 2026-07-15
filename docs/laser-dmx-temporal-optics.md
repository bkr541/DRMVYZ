# LaserDMX WebGL temporal optics

The WebGL renderer adds bounded scanner history and deterministic optical motion after the HDR light composite and before bloom and tone mapping. The pass is private to the LaserDMX WebGL runtime. It does not sample Canvas2D output, alter the authoritative Show Director choreography, add beams, or create a second animation clock.

## Render path

1. The current rear light, front light, and depth-aware atmosphere passes composite into the full-resolution HDR scene from the HDR composite.
2. `LaserDmxTemporalOpticsController` compares the current beam directions and targets with the prior canonical scene frame.
3. A quality-scaled ping-pong target stores a bounded maximum of the current HDR contribution and the previous contribution multiplied by a motion-sensitive retention factor.
4. Bloom is extracted from the temporally accumulated light, allowing prior scanner positions to produce restrained photographic bloom.
5. The final post pass combines the untouched full-resolution current scene with the temporal target using maximum compositing. Current beam cores therefore stay sharp while prior positions remain visible only where history is enabled.
6. Tone mapping, exposure response, glare, and restrained chromatic optics continue through the photographic post pass.

The temporal shader never adds the entire previous frame to the current frame. It uses bounded decay and maximum compositing, with retention capped below one, so stationary bright pixels cannot grow brighter every frame and history cannot accumulate indefinitely.

## Motion-sensitive scanner persistence

Persistence is compiled from scene motion rather than applied as a constant full-frame trail. Each active beam compares its normalized direction and target position with the previous frame. The resulting angular and target speeds are weighted by:

- Fixture kind, with lasers receiving the primary scanner treatment and nonlaser beams receiving much less.
- Pattern structure, with wide fans, mirrored fans, cross banks, and layered fans able to retain more history than single static rays.
- Visual role, with hero and primary architecture remaining more stable than secondary and texture rays.
- Authored `beamPersistence`, current musical energy, section type, beat, kick, hat, snare, strobe state, and WebGL quality.

Stationary beams resolve to zero retention. Slow sweeps produce short soft prior positions. Faster fan and drop movement can retain several restrained positions, but retention remains capped by quality policy. Breakdown and intro sections reduce the persistence profile. Drops permit more energy without changing the beam budget.

Snare events segment history rather than increasing every optical parameter. Visible strobes sharply shorten retention, and dark strobe phases clear it. Blackouts clear both ping-pong targets immediately.

## Deterministic instability

`LaserDmxTemporalOptics` derives all micro-variation from stable hashes of:

- Track identity.
- Track, preset, rig, and Performance Show history identity.
- The authoritative occurrence seed.
- Fixture semantic group.
- Fixture and ray identity.
- Canonical audio transport time.

No `Math.random`, wall-clock time, frame counter, or free-running noise state is used.

The model provides tiny angular vibration, restrained intensity flutter, very small width variation, source-aperture breathing, per-ray phase offset, and slow haze density and drift modulation. Hero and primary beams receive the smallest angular motion. Secondary and texture beams may receive more, but all values are tightly clamped.

Left and right semantic fixture names normalize to one shared instability group with opposite mirror signs. Mirrored banks therefore remain intentionally related instead of becoming unrelated random emitters.

Returning to the same transport position and occurrence recreates the same optical state. Seeking does not roll a new random result.

## Music-aware separation

Temporal optics consume the existing Shared Performance Context instead of creating parallel beat detection. The scene frame now carries beat phase and boundary state, downbeat, kick, snare, hat, transient strength, 4-bar, 8-bar, and 16-bar indices, section state, and deterministic occurrence seed.

The assignments remain intentionally narrow:

- Beat adds a very small source pulse and persistence lift.
- Kick emphasizes hero and primary apertures and cores.
- Snare segments history and can briefly emphasize secondary light.
- Hat adds fine texture-fixture energy only.
- Section and energy select the persistence and stability profile.
- 4-bar, 8-bar, 16-bar, phrase, and occurrence information participate through the authoritative performance identity and seed, preserving authored choreography evolution without modulating every optical control.

## Reset and lifecycle rules

Temporal history is cleared or invalidated on:

- Initial WebGL runtime mount.
- Explicit renderer reset.
- WebGL context restoration.
- Track identity change.
- Top-level preset, Beam Matrix preset, rig, or Performance Show identity change.
- Performance Show runtime invalidation.
- Timing discontinuity, including seek and loop wrap.
- WebGL quality change.
- Entry into capture mode.
- Blackout.
- Dark strobe phase.
- Resize that changes the temporal target dimensions.
- Renderer disposal or engine unmount.

A simple pause keeps the last visual frame and does not advance temporal noise because all variation uses audio time. Resume at the same transport position remains stable. A seek performed while paused is retained by the existing renderer boundary and clears history on resume.

The history identity includes track, preset, authoring mode, Beam Matrix preset, active Performance Show, runtime invalidation, rig, and source template. This prevents a previous show from ghosting into a newly selected show even when both use the same top-level visualizer preset.

## Quality and performance

Temporal quality is independent from the full-resolution beam-core pass:

- Low uses a 0.46-scale history target, lower maximum retention, and one instability layer.
- Medium uses a 0.66-scale target and standard persistence.
- High uses a 0.84-scale target, improved modulation, and a higher bounded retention cap.
- Ultra uses a full-scale target, four deterministic instability layers, and the best temporal stability.
- Auto uses a balanced 0.76-scale policy.

The pass adds two reusable color targets and one full-screen shader invocation per frame. It does not increase the authored 300-beam budget. Current beam geometry remains full resolution, and only the history buffer scales. Targets are allocated lazily, reused, released on resize, recreated after context restoration, and explicitly disposed.

## Fixture-optics integration

Fixture-specific materials consume the same deterministic temporal signals without changing the history ownership rules. Moving-head lenses, LED cells, strobe tubes, blinder reflectors, PAR washes, and other nonlaser fixtures remain optically distinct; only suitable scanning light contributes persistence.
