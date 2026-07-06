# LaserDMX production rig architecture

This document describes the post-sequence LaserDMX contract. The system is a virtual production environment first. It coordinates lasers, moving heads, washes, strobes, blinders, LED bars, haze, fog, and cryogenic-style virtual effects from one normalized fixture model and one audio-transport clock.

## Sources of truth

| Concern | Canonical source |
| --- | --- |
| Persisted rig and fixture state | `LaserDmxProductionRig.ts` normalization, migration, and serialization APIs |
| Fixture family and capabilities | Registered fixture profile in `LASER_DMX_FIXTURE_PROFILES` |
| Musical clock | `ReactFrameContext.audioTime`, backed by the active audio transport |
| Live Music Intelligence | `AudioFeatureBus` and the current track analysis supplied to Show Director |
| Compound authored cues | `LaserDmxShowDirector.ts` |
| Automatic layered choreography | `LaserDmxChoreographyEngine.ts`, consumed by Show Director |
| Moving-head interpolation | `LaserDmxMovingHeadEngine.ts` |
| Haze, fog, and cryogenic-style transient runtime | `LaserDmxAtmosphereEngine.ts` |
| Virtual fixture compilation | `LaserDmxCompiler.ts` and the compatibility-only Beam Matrix compiler |
| Output lifecycle and fail-dark boundary | `output/ProductionOutput.ts` |

The renderer does not create a second BPM, beat grid, section detector, fixture schema, or free-running animation clock. Animated laser geometry, flashes, movement, cues, and atmosphere all derive from the audio playhead. The deprecated compiler `time` input is ignored so older call sites remain source-compatible without becoming a competing clock.

A registered fixture profile owns fixture family classification. During migration, a stale persisted `fixtureKind` that conflicts with a known profile is repaired to the profile kind and recorded in `compatibility.migrationNotes`. Unknown profiles remain preserved and disabled with validation errors rather than being silently reinterpreted.

## Coordinate conventions

`ProductionStageModel` uses metres and the `PRODUCTION_STAGE_COORDINATE_CONVENTION` constant:

- origin: stage-front center at floor level
- positive X: stage right
- positive Y: upward
- positive Z: upstage, away from the audience
- fixture transforms: position plus yaw, pitch, roll, pan, and tilt in degrees
- targets: named points or zones in the same metre-based space
- audience and excluded/safe zones: stage-space validation metadata

Legacy normalized fixture positions are converted through `legacyNormalizedToStageVector`; the inverse is `stageVectorToLegacyNormalized`. Compatibility tools may still project this model through a camera when needed. Canvas dimensions are physical pixels and fixed-size strokes/editor affordances use bounded device-pixel scaling, so resizing or changing device-pixel ratio does not alter authored timing or stage-space geometry.

## Fixture capabilities

Every control must be gated by `resolveLaserDmxFixtureCapabilities`. Profiles declare only supported features, including:

- dimmer, shutter, strobe, and color mode
- pan/tilt, zoom, focus, iris, frost
- gobo and prism controls
- laser beam-pattern controls
- wash rendering
- LED pixel/segment limits
- atmospheric output and trigger cooldown metadata

The compiler neutralizes unsupported properties, Show Director diagnoses unsupported cue writes, and the editor hides or disables controls the selected profile cannot perform. Capability overrides may narrow or explicitly adapt a profile, but they do not replace the profile as the fixture-family source of truth.

## Cue and live-control priority

Show Director evaluates in a deterministic order:

1. normalize the authored settings
2. detect track, preset, analysis, section, seek, loop, or large-forward discontinuities
3. evaluate automatic Music Intelligence choreography as an underlay
4. apply manual and authored cue layers according to `manualOverridePrecedence`
5. resolve conflicts by authored cue priority, action order, and stable cue identity
6. compile the resulting settings into the virtual production frame

With the default `authoredFirst` policy, manual requests are applied before authored timeline cues, so authored intent wins a shared property. With `manualFirst`, authored cues are applied first and the live request wins. Automatic choreography never overwrites a later manual or authored write in the same evaluation.

Momentary events use crossing detection and transport-pass keys. A timing discontinuity reconstructs persistent state but suppresses momentary re-fire. The renderer then resets dependent transient runtimes so envelopes, movement integration, fog/cryo requests, and Beam Matrix launch state cannot survive a seek or analysis replacement in an indeterminate state.

## Pause, seek, loop, and replacement behavior

- Pause holds the last virtual canvas frame, pauses atmosphere age, and stops/disarms the output boundary.
- Seek and large time jumps rebase all transient runtimes to the new audio playhead.
- Loop-back increments the Show Director transport pass, rearms once-per-pass cues, and clears transient state before recompilation.
- Track, preset, analysis, and section replacement clear incompatible cue/choreography state and consume stale atmospheric trigger requests.
- Renderer context loss immediately enters the fail-dark output path. Context restoration rebuilds virtual transient state but does not silently re-arm physical output.
- Quality tiers alter particle budgets, guide density, and render sampling only. They do not change cue placement, beat timing, movement phase, or authored durations.

## Persistence and compatibility versions

Current versions are:

- LaserDMX settings: `7`
- fixture: `4`
- Beam Matrix compatibility data: `1`
- production rig/output frame: `9`
- stage model: `1`

All external or persisted input must pass through the normalizers before use. Serialization sanitizes runtime-only requests and produces canonical key ordering. Legacy pre-sequence LaserDMX rig data and Beam Matrix data remain loadable. Unknown fields are retained where compatibility requires it; unavailable profiles are preserved with diagnostics and disabled in the production rig.

Do not persist output arming, network binding, heartbeat state, emergency blackout state, active burst particles, cue crossing state, or renderer lifecycle state.

## Virtual and physical output boundary

`ProductionOutputFrame` is compiled once from the same normalized rig and fixture frames used by the virtual renderer. `VirtualProductionOutputAdapter` is the executable default. Art-Net and sACN entries are protocol descriptors only in this repository.

A future physical adapter must:

- execute in a trusted host process, not the renderer
- accept only validated, bounded universe frames over a narrow IPC boundary
- remain disabled by default and require an explicit network binding
- require a fresh arm after startup, account change, sign-out, renderer failure, or adapter failure
- implement blackout, disarm, heartbeat, stale-frame detection, and error reporting
- preserve separate preview and hardware intensity domains

App close/page hide, transport stop, pause, renderer context loss, renderer crash, sign-out, account change, heartbeat timeout, stale frame, invalid patch, and adapter exceptions all route to blackout/disarm behavior. Preset thumbnails are offscreen virtual previews and are forbidden from submitting frames to, stopping, or disarming the live production-output controller. Beam Matrix remains a virtual compatibility workspace and does not emit a patched production output frame.

## Safety limitations

The stage audience region, excluded zones, strobe caps, cooldowns, and fail-dark behavior are engineering safeguards, not certification. DRMVYZ does not certify laser classification, audience scanning, venue or electrical compliance, atmospheric-effect suitability, respiratory safety, cryogenic hardware, rigging, network security, or local regulations. Fog and cryogenic-style effects in the current renderer are virtual simulations.

Any physical implementation requires qualified operators, compliant hardware, venue approval, manufacturer guidance, and independent safety systems. Software blackout must never be treated as the only emergency stop.

## Extension points

### New fixture or profile

1. Add a `ProductionFixtureKind` only when the rendering and output semantics are genuinely distinct.
2. Register a profile with a channel map and explicit capabilities.
3. Add normalization defaults for capability-specific state.
4. Add compiler and shared-stage rendering support without bypassing `ProductionRig`.
5. Gate editor controls and cue properties by capabilities.
6. Add migration, persistence, deterministic timing, and quality-tier tests.

### New cue action or movement

Add a typed action/configuration, normalize it, diagnose target/capability requirements, define deterministic priority/write keys, and make seek reconstruction explicit. Do not introduce a timer outside the audio transport.

### New output adapter

Register a descriptor in the renderer, implement transport only in a trusted host, validate universe and fixture support, and add adapter-failure, heartbeat, stale-frame, emergency-blackout, sign-out, and app-close tests. The virtual adapter must remain the canonical default and physical output must remain opt-in.
