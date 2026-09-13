# Cinema 2.0 Stage 17A keeper preset productionization

This note records the intentional legacy-behavior disposition for the first production Cinema 2.0 keeper presets. It is not a compatibility contract. Current Cinema 2.0 ownership remains authoritative.

## Reactor 2.0

| Legacy behavior | Decision | Cinema 2.0 production treatment |
|---|---|---|
| Core/ray identity, palette, rotation and build contraction | Port | Exposed as schema-owned design/react controls and rendered by the native Reactor generator. |
| Refraction, shockwave, trails and bloom | Port | Preset-local refraction/shockwave feed engine-owned feedback history and bloom. |
| Drop energy and downbeat accents | Rebuild | Audio Intelligence and Visual Director feed authored choreography targets/envelopes; the module does not analyze audio. |
| Ray variation/reroll | Enhance | Pattern variation uses the engine-owned namespaced random service, deterministic by default and session-organic when the runtime requests that mode. |
| User media, album art and media output | Enhance | All source lifetime and replacement remain owned by the shared Media Runtime. |
| Legacy semantic-cell, shard recipe, brand/logo/lyric and custom choreography-trigger plumbing | Skip | These are not required to preserve Reactor's keeper identity and would recreate legacy ownership or unrelated composition systems. |

## Electric Storm 2.0

| Legacy behavior | Decision | Cinema 2.0 production treatment |
|---|---|---|
| Lightning color, rate, branching, thickness, glow and atmosphere | Port | Schema-owned controls feed the native procedural-lightning module and shared environment. |
| Impact shake/zoom and music responsiveness | Rebuild | Generic Visual Director significance plus canonical music events feed authored choreography and strike intents. |
| Thunder flash intensity/duration/decay | Port | User-facing effect controls shape preset-local illumination without becoming a second trigger authority. Rapid retriggers compress the flash envelope to avoid pinned brightness. |
| Strike topology and event variation | Enhance | Engine-owned deterministic/session-organic random streams drive topology, probability and anti-repeat behavior. |
| Legacy `thunderTrigger` selector | Skip | Native choreography is the single strike-event authority; adding a second trigger selector would duplicate event routing and undermine the target system. |

## Shared production invariants

- Persistent authored values remain owned by `Cinema2ParameterState`; workspace save/re-entry serializes only persistent parameter values and media source descriptors.
- Transient choreography envelopes, strike queues, thunder envelopes, random streams, GPU resources and history remain runtime-only.
- Quality mode continues to scale expensive work through the shared Cinema 2.0 performance/resource policy, including render-target scale and GPU budget.
- Neither generic runtime nor generic Inspector code branches on Reactor or Electric Storm identity.
- Cinema 1 remains untouched by this stage.
