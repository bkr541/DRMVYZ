# Cinema 2.0 unified 3D effects: musical choreography (Phase 04)

## Operating the controls

All six existing model preview preset identities and their saved Pattern values are retained. New controls are additive, under the existing Design parent groups. The two new performance features are opt-in so that older saved presets retain their authored appearance.

- **Design > Effects > Audio Modulation > Audio Mappings:** enables twelve simultaneous assignments. Expand Audio Mapping 1–12 to select source, numeric renderer target, strength, minimum/maximum, curve, attack, release, additional smoothing, inversion and optional beat/bar/phrase quantization. Minimum and maximum are fractions of the target's authored numeric range (the target selector shows the actual units/range). Reversed endpoints are sorted; use Invert to reverse response. Times are seconds. Competing routes to one target are averaged by their active weights, then blended from the authored value; no route edits the persistent value. Disabling a route or master removes its transient contribution. Alternate Material on Phrase is an optional discrete assignment that alternates between a selected material and the authored material on canonical phrase boundaries.
- **Design > Design > Model > Musical Representation Transitions:** with existing Auto Performance enabled, lets structural events choose a representation. The existing primary Pattern selects a family. Existing Pattern Change, Trigger and Sync BPM still control movement inside the representation; the structural director never changes those settings or their saved values. A manual representation or Pattern edit cancels the current automatic override until the next accepted structural event. Existing per-representation patterns remain editable. Use the application's normal Auto Performance override/edit workflow.
- **Design > Effects:** Fragment Impulse/Reassembly, Particle Expansion Wave/Sparkle/Brightness/Vertical Flow Bias/Reassembly, and Scan Flash/Signal Interference/Contour Echo/Scan Distortion are real shader or geometry inputs. Reassembly at 1 pulls derived geometry to its source. Optical and trail targets only affect the image when their existing effects are enabled; material channels depend on the selected material style. No new GPU resource cache or renderer is introduced.

The default assignment bank uses kick for shard/particle impulse and key-light energy, bass for spread and rim, snare for scan/accent, highs for sparkle, and buildup for cracks/turbulence/interference/bloom. Keep intensity modest for stage lighting. All outputs are bounded by authored parameter ranges; event envelopes have minimum attack/release times and a 120 ms per-route retrigger gate. These are conservative defaults, not a photosensitivity guarantee.

## Pattern families

| Family | Structural direction | Drop representation |
| --- | --- | --- |
| KINETIC | Fragment pulses and solid recovery | Shatter |
| CASCADE | Layered separation and particle recovery | Slices |
| ORBIT | Rotating geometric arrangements and spatial clouds | Voxel |
| DISINTEGRATE | Solid, surface particles, holographic reconstruction | Dust |
| SIGNAL | Scanning projection and alternating structural overlays | Hologram |
| METAMORPH | Traverses the six representations in sequence | Shatter |

These families combine the existing six distinct per-mode motion algorithms with separate structural sequences. They are not an independent song scheduler. The selected Pattern (authored value) chooses the director family, while trigger-driven Pattern Change continues the existing movement selection underneath. Section identity and canonical drop events take precedence over phrase advances. Cooldowns avoid repeated crossfade restarts; manual control remains authoritative at the next edit. Automatic transitions use at least 450 ms and the existing Phase 01/02 transition controller; fragments and particles converge as their representation fades.

## Architecture and lifecycle

`Cinema2ModelAudioChoreography` runs only inside `Cinema2ChoreographyRuntime` for presets exposing the additive schema. It consumes the existing bridge, canonical event readers, section director and shared Performance Core envelope functions. Contributions are published atomically in the existing choreography writer; every bound parameter/module/camera/light/effect handle receives the same replacement. No additional analyzer, BPM detector, beat grid, or playback clock is installed. The existing frame clock drives envelopes; the existing model beat clock drives motion and Sync BPM. Unavailable or low-confidence signals do not create events. Duplicate events are bounded and consumed by identity. Playback pause holds route values; stopping, model/source replacement, context generation changes and seeks clear stale envelopes. Section-aware seek recovery does not replay a drop pulse. No unrelated engine or cast layout is changed.

## Verification

`npx vitest run src/components/vyzualz/cinema2/model/Cinema2ModelAudioChoreography.test.ts src/components/vyzualz/cinema2/model/Cinema2UnifiedUserModelEffects.test.ts src/components/vyzualz/cinema2/model/Cinema2UserModelAutoPerformance.test.ts src/components/vyzualz/cinema2/model/Cinema2UserModelPreviews.test.ts`.

The deterministic fixture exercises the production audio bridge, visual director, compiled target plan, canonical choreography runtime and resolver with synthetic upstream music publications. The GPU test requires the installed application dependencies and WebGL visual confirmation requires a running browser/application. Inspect the six modes with an actual model and loaded track; check transitions, lighting intensity, shader output, pause/resume, seek, live input and production cast before release. Full Cinematic Look configurations can still be changed manually; the automatic material selector alternates a single material style and numeric routes can modulate the lighting configuration.
