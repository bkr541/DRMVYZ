# PixGrid universal preset contract

PixGrid preset definitions are registered through `PixGridPresetRegistry.ts`. A definition owns its stable ID, metadata, category, runtime preset, optional target-image sequence, motion-profile dependencies, performance-program dependency, and required capabilities. Registry validation runs outside the render loop and produces a revisioned runtime representation.

## Adding an image-sequence preset

1. Define a `PixGridSequenceDefinition` with stable source IDs and separate occurrence IDs. Sources may reference canonical media, existing PixGrid artwork assets, or generated SVG artwork.
2. Declare ordering, duration, looping, section/scene assignments, transition policy, arrival anchoring, default motion profile, and directed pair overrides.
3. Add one `PixGridPresetDefinition` to the registry. Reference existing motion profiles and an existing performance program; do not add renderer branches or a second compiler.
4. Run the registry conformance tests. Missing sources, assets, programs, profiles, pair occurrences, and transition modes are reported with preset IDs and configuration paths.

The registry projects a sequence into the existing Deck-shaped compiler contract. This is a compatibility adapter: prepared-frame caches, correspondence compilation, the sequence clock, compositor, worker watchdog, and readiness scheduler remain authoritative. Media Deck is another producer of the same model.

## Motion precedence and invalidation

Motion resolves in this order: directed pair override, scene override, preset default, engine default. Mapping-affecting profile fields—strategy, direction, grouping, collision policy, and seed—participate in the transition cache signature. Runtime-compatible fields and Audio Intelligence modulation do not invalidate correspondence data.

Motion Audio Intelligence routes explicitly map one supported source to one motion destination. Routes support strength, curve, threshold, gate, blend, and smoothing metadata. Duplicate route identities are ignored, disabled routes have no effect, and modulation never mutates authoritative sequence progress. Arrival anchors therefore remain exact even when intermediate pixels accelerate, disperse, pulse, or reconstruct.

## Compatibility

Existing Bass Beacon, Geometric Reactor, Pixel Parade, and Media Deck IDs remain unchanged. Existing authored presets are incrementally wrapped by registry definitions; they are not converted to fake sequences. Legacy Decks without motion fields normalize to `balanced`, and saved transition and reaction settings retain their existing behavior.

## Validation measurements

The focused registry, migration, planner, coordinator, and sequence-clock pass executes 77 tests in 1.14 seconds on the implementation workstation. The twelve-image shuffle regression reduces initial expected transition work from the former 132 directed pairs to 12 reachable pairs; adding two actual runtime lookahead destinations raises that bounded set to 14. Audio-only motion changes keep the same correspondence signature, while mapping-affecting profile changes create a targeted pair revision.

These are deterministic scheduling and test-duration measurements, not renderer FPS claims. A production browser FPS comparison could not be produced because the repository-wide prerequisite suite is currently blocked by unrelated baseline failures documented in the handoff.
