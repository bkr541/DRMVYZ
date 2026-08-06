# Cinema Stage 12: Performance Rules and Stateful Actions

Stage 12 turns persisted Cinema performance rules into deterministic runtime choreography. Rules are evaluated from the normalized `CinemaFrameContext`, including musical impulses, section state, lyrics, Shared Performance manual events, and toggle state.

## Ownership

- The Cinema composition owns versioned, serializable rule, condition, and action definitions.
- `CinemaPerformanceRuntime` owns consumed event identities, priority resolution, timed envelopes, and transient action state.
- `CinemaGraphExecutor` applies immutable performance overrides after modulation and dispatches state commands through the existing `CinemaRenderNode.reset` contract.
- Canonical compositions and instances are never mutated by frame evaluation.

## Conditions and actions

Conditions support beat, bar, phrase, section, drop, lyric, manual, energy, vocals, playing, build/drop state, and Shared Performance toggles. One rule can coordinate multiple actions:

- parameter and trigger overrides
- node and effect enable state
- camera selection placeholders
- temporary palette roles
- emitted events
- `resetNodeState`
- `resetFeedback`
- `reseedSimulation`
- `clearTrailHistory`

Rules resolve by descending priority. Equal-priority conflicts use stable rule, action, and event identities, so repeated runs produce the same winner.

## Musical durations and manual events

Timed actions retain authored beat or bar units. They are measured against the normalized musical clock instead of being converted to wall-clock milliseconds. A missing musical clock produces a bounded one-frame fallback and a structured diagnostic.

Shared Performance events retain their original sequence number in `CinemaFrameContext`. Repeated pad presses with the same action ID remain distinct and are consumed once by `manual:<sequence>:<actionId>` identity.

## Seek and reset behavior

Transport discontinuities clear active transient envelopes. Seek retains historical event identities so landing on an earlier musical boundary does not re-fire old commands. Loop wrap and playback restart open a fresh deterministic event pass, while reset-generation tracking prevents the boundary frame from being consumed twice. Track replacement clears the consumed-event window for the new track identity.

The graph executor applies each node definition's seek policy:

- stateless nodes continue without reset
- reset-at-position nodes receive a deterministic reconstruction command
- deterministic-replay and checkpoint-replay nodes receive their declared reconstruction mode and musical seed
- unsupported nodes follow their declared reset or safe-output fallback

Adapter-backed Shader and Cinematic nodes receive the same state command contract as native Cinema nodes. They do not regain canvas, context, target, or animation-loop ownership.

## Persistence and migration

Stage 12 increments the composition, package, and persisted-store schemas to version 2, plus the Zustand persistence middleware version to 3. Known schema-v1 compositions migrate by adding rule, condition, and action schema versions, deterministic action IDs, and the renamed `resetNodeState` action. Migration provenance is recorded. Unknown future versions remain rejected.

Runtime envelopes, consumed event identities, state-command seeds, feedback history, and reset counters are never persisted.

## Stage 13 handoff

Stage 13 can bind centralized camera and Auto Director services to the stable performance condition/action schema, deterministic evaluator, active camera placeholder, and stateful seek-reconstruction dispatch established here.
