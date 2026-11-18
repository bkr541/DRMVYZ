# Bass Sigil P3 — shared Audio Intelligence reactions

P3 is implemented and its focused technical validation passes. All reactions use the **complete original environment**. Source geometry, textures and the GLB bytes are unchanged. No new environment, geometry asset, palette automation or camera shot system was introduced.

[Audio scenario captures](evidence/p3/audio-scenarios.webp) · [Production measurements](evidence/p3/browser-report.json)

The images are scenario checkpoints at their fixture times, not a frame-aligned reference A/B comparison. The numeric browser measurements isolate the continuous responses and equal-time energy/zero-strength cases.

## What this phase adds

**Audio Reactivity** under Master Controls (default 0.65, range 0–1) scales seven basic response routes. It is a real consumer through shared Choreography strength binding. Zero removes the audio contributions while preserving authored native motion, BPM Sync and the separately authorized Pattern Change controller.

The preset consumes shared facts through the existing `Cinema2AudioIntelligenceBridge`. The native renderer continues reading resolved module targets. The shared `Cinema2ChoreographyRuntime` owns source smoothing, temporary envelopes, event identities, duplicate suppression and reset handling. There is no local beat, drop, phrase, intensity, mood or silence detector and no local reactive-envelope state.

## Final signal map

Maximum contributions below are at Audio Reactivity=1 and full available signal. All composition is relative to saved values, range-clamped and temporary.

| Shared fact | Bound user-facing target | Composition and maximum | Timing / authority |
|---|---|---|---|
| Bass | Membrane Scale | multiply ×1.12 | 100 ms shared route smoothing; requires Geometry Motion ON. Actual source sphere expands. |
| Overall energy | Motion Rate | multiply ×1.25 | 180 ms shared smoothing; requires Geometry Motion ON. Native trajectory speed changes, not just brightness. Saved zero stays zero. |
| Highs | Membrane Opacity | multiply ×0.80 | 60 ms shared smoothing. Briefly opens the textured shell visually, revealing particle detail. Saved zero stays zero. |
| Vocal presence | Particle Density | multiply ×0.65 | 180 ms shared smoothing. Fewer original particle triangles are rendered, creating negative space. Saved zero stays zero. |
| Kick | Core Travel | add +0.16 | 15 ms attack, 25 ms hold, 220 ms release. Requires Geometry Motion ON and saved Core Travel nonzero. |
| Snare | Logo Roll | add +4° | 10 ms attack, 20 ms hold, 180 ms release. Requires Logo Motion ON; returns to the manual angle. |
| Downbeat | Hero Scale | add +0.035 | 15 ms attack, 25 ms hold, 250 ms release. Small 3D logo breath; requires Logo Motion ON. Uses the shared bar clock, not an arbitrary fixture hit. |

Rhythmic routes carry `once-per-event`, `not-silent` and an explicit shared capability condition. This prevents an unsupported/free-running clock from inventing an audio accent without musical facts. No drop rule is silence-gated; this phase does not add a drop-performance override.

The original proposed highs→glow and downbeat→glow mapping was rejected during rendering: the dry core was already clipping at those brightness values and additional target gain was not perceptible. The opacity and physical scale responses above are the authoritative P3 mapping. This changes the earlier planning rows, not the source environment.

## Structural events and playback

The existing Pattern Change/Trigger controller now receives real bridged fixtures on the production path. A new canonical drop advances the underlying pattern only with Pattern Change ON and Trigger=Drop. The authored Pattern and saved toggle/dropdown are never overwritten. Expanded build/drop performance programs and the full Trigger/lifecycle matrix remain later work.

Native discontinuity identity now includes shared source/track, analysis and timeline revisions, plus the bridge's discontinuity generation. Seek/loop/track/analysis changes clear stale native phase/selection state; the shared choreography runtime clears accents and smoothing at its own discontinuity boundary. Paused playback holds native clocks and an in-progress response; resume continues without queuing duplicate hits. No source/unavailable features contribute no audio reactions. Existing ambient logo/camera motion remains explicitly authored and separate from reactivity.

Camera modes, independent logo motion, manual colors and original environment remain available. Audio never writes authored settings. Geometry Motion OFF blocks sphere/motion/kick displacement; Logo Motion OFF blocks snare/downbeat assembly movement. Multiplicative responses preserve zero density, opacity and motion rate. Core Travel=0 blocks kick addition. No Auto Performance toggle is exposed yet.

## Shared target-bound correction

Production live values previously could exceed a bound slider's maximum because inferred module/effect targets did not inherit their bound parameter limits, while individual renderers clamped later. `Cinema2TargetRuntime` now inherits the bound control's min/max for module/effect targets. Explicit target limits still take precedence. Unbound targets remain unrestricted, and UI step quantization is not applied to continuous animation.

This small shared correction is required for the reactive render and Inspector live readout to agree at extreme control values. Focused target-registry tests verify module/effect clamping, continuous fractional values and unchanged unbound behavior. No Inspector-specific or preset-name special case was added.

## Validation and limits

- Forty focused tests pass across Bass Sigil source/native motion, camera, audio, crate regressions, shared target resolution and shared choreography. This comprises the 39-test integrated pass plus the added no-phantom-downbeat regression in the final six-test audio pass.
- TypeScript, focused ESLint and diff-whitespace checks pass.
- The production browser uses the actual runtime, registries, original GLB, shared bridge and one persistent deterministic upstream publication fixture. It does not use a mock canvas or custom audio detector.
- Bass/highs/vocals each visibly change the expected rendering with native motion and camera isolated. Mean per-channel differences against the fixed quiet pose were 10.493, 1.999 and 1.224 respectively.
- Equal-time quiet/energetic restarts produce a mean pixel difference of 3.160 from audio-driven motion. Reactivity=0 versus no audio at the same native pose produces exactly 0 difference.
- Kick, snare and downbeat transient targets reach the performing controls; captures document the corresponding original 3D scene. Paused kick holds; envelopes return to base. An authorized structural drop changes the performing pattern.
- Hard zero/disable controls remain off under full features. Seek and track changes clear a live kick accent. No browser/module/render errors; disposal leaves zero leases, surfaces and estimated GPU bytes.
- Original GLB SHA-256 remains `3b74af78b57b0dd24727a06f41a16064af3044ded52118700fbe6008cb1843cc`.

Validation commands: focused Vitest for `Cinema2BassSigilAudio`, `Cinema2BassSigil`, `Cinema2BassSigilCamera`, `Cinema2CratePresets`, `Cinema2TargetRegistryResolver`, `Cinema2ChoreographyRuntime`; `npm run typecheck`; focused ESLint; `node scripts/run-cinema2-bass-sigil-audio-browser.mjs` against Vite. The browser harness now supports deterministic feature/event publications, pause, seek, track changes and re-entry through the real bridge.

Human musicality review and representative real-track playback remain part of full acceptance; this phase was validated with deterministic musical facts. No real-track review is claimed. P4 expanded geometry choreography, P5 Visual Director meaning, P6 Mood/Auto Performance, P7 finishing and P8 full acceptance remain pending. This checkpoint is not a declaration that the entire preset is complete. Changes are uncommitted; unrelated earlier work was preserved.
