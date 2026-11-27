# Cinema 2.0 — PULSE CUBED

Native reference/review preset, pending production visual acceptance. The preset reuses `cinema2-crate-nested-pulse` (`public/cinema2/models/crate/pulse_cubed.glb`), byte-identical to the supplied GLB (SHA-256 `ad8ee7e2423d1be7158356d21dd0a9e42ef332b8e8a253d313d0750b535a7840`). Original *Pulse Cubed* by Tycho Magnetic Anomaly, CC BY 4.0; see the existing asset attribution. Runtime changes include independent clip sampling, recoloring and procedural motion; the file itself is unchanged.

## Authoring

The original clip has 152 channels on 53 animated nodes. Four frames, 48 pulses and one enclosure retain their authored geometry. Per-layer mixers evaluate original rotation, position and scale before bounded transforms. A visible idle pose is sampled at 2.5 seconds. The native patterns are Circulation, Counterphase, Inward Collapse, Supernova, Axis Shift, Energy Cascade, Resonance, Optical Drift, Blackout Pulse, Phase Lock, Singularity and Overcharge. Transitions interpolate program values; they are not twelve separate copies of the model.

Four Design parent groups contain 52 parameters including shared quality, safety and flash limits. Camera Orbit Range is a normalized 0–1 shared rig gain (not degrees); Camera Zoom scales the isolated sculpture within its safe fit. Eight palette variations contain the seven color roles; colors are never changed by mood. The engine exposes three render quality levels; low disables trails and optional particles and approximates transmission. The asset cache and shared Three host own geometry, environment and WebGL resources; clone materials and local mixers belong to the preset.

## Authority and timing

The shared choreography runtime routes band energy and rhythmic/structural envelopes, with Audio Reactivity controlling their strength. Shared Mood Conductor drives are gated by Auto Performance; pattern/trigger policy is resolved without writing user values. Manual selection reanchors the controller. Temporary build and drop overrides are bounded and cleared on authority changes; pause holds the timeline. BPM Sync uses the shared beat clock, while unsynced animation is integrated against the original clip duration. Low-motion and flash safety controls are preserved. Asset manifest and budget are unchanged.

## Verification and release gate

- Compile the preset and check authoring conventions, catalog registration, twelve distinct motion programs, canonical triggers, pause, duplicate events and authored-value authority in `Cinema2PulseCubedPreset.test.ts`.
- Run `npm run assets:check`, `npm run typecheck`, and `npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2PulseCubedPreset.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2AutoCoverage.test.ts`.
- In the production visualizer verify all 48 pulses, nested transparent frames, original clip continuity, depth and optical sorting, each pattern with bloom disabled, individual controls at min/default/max, all palettes, and all shared mood/trigger modes.
- Verify idle/no-source, pause/resume, seek, loop, track replacement, context loss, repeated switching, square/portrait/landscape/ultrawide output, recording and casting. Profile GPU and transmission costs on supported hardware before keeper promotion or publishing a thumbnail.
