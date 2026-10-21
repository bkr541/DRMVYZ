# 11. Complexity Budget, Risks and Explicit Scope Boundaries

## Complexity rating

**Medium if and only if v1 remains nine cubes, six predefined formations, bounded deterministic motion and one engine-native renderer.** The ideas sound simple but become medium/high if arbitrary collision-free 3D paths, physics, user model imports, procedural material/mesh generation, or several camera environments are added. Time is spent chiefly on **correct authority, signal routing, tests and real 3D transform safety**, not polygon count.

## Hard exclusions for first production release

| Excluded feature | Why it is excluded | Later alternative |
|---|---|---|
| Rigid body dynamics and physically simulated collision | Nondeterministic motion, expensive stress testing | Authored transform trajectories + bounds |
| Arbitrary block count and runtime mesh rebuild | Increases Inspector, buffer, layout and grouping complexity | Fixed nine now; optionally extend to 6–12 after profiling |
| Image mosaic, puzzle tiles, sliding-piece solvability | Overlaps SHIFTGRID's different goal | Keep BLOCKSHIFT 3D sculptural |
| Per-block spotlights/shadows | Expensive, 12 non-ambient scene light cap | Emissive edge geometry + 0–2 shared lights |
| glTF, textures, external assets | More asset/installer budget and cache complexity | All primitives in native module |
| Dynamic geometry fracture/booleans | Requires separate mesh/physics logic | Simple transforms only |
| Complex orbit/fly-through camera | Per-pattern clipping and collision hazards | Stationary 3/4 hero + very subtle bounded drift |
| Automatic user-owned palette swapping | Adds authority/takeover domain | Five authored colors with bounded brightness only |
| Preset-specific React Inspector | Breaks shared schema and maintainability | Use manifest-driven generic controls |
| Second beat/drop/phrase detector | Duplicates shared Audio Intelligence and causes divergent cues | Consume canonical events only |

## Risk register

| Risk | Severity | Early check / mitigation | Blocking gate |
|---|---|---|---|
| Six labels, but only one geometry motion | Critical | Pure pattern target diff tests + bloom-OFF screenshots | P4 |
| Cube path collisions or disappearing behind camera | High | Transition safety envelopes + multi-aspect filmstrips | P4/P7 |
| Native WebGL2 cube edge draw complexity | Medium | Prove static opaque faces/edges in P2 before audio | P2 |
| Manifest parameter value ignored in renderer | Critical | Test each control min/default/max and resolved param binding | P3 |
| Pattern Change replays active event on manual edit | Critical | Generic controller + fresh event ID tests | P5 |
| Auto Performance steals user Pattern permanently | Critical | Separate persisted base/runtime/temporary overlay state | P6 |
| Host Sync conflicts with preset BPM Sync | High | Define combination and test ON/OFF 4-way matrix | P4 |
| Choreography double-applies per render pass | High | Frame ID gate and event dedup, single update | P5 |
| Emissive edges require bloom to be visible | High | Early static bloom-OFF production screenshot | P2 |
| GL resources leak on preset switch | High | Host resource facet and repeated activation test | P7 |
| GPU over-budget on modest hardware | Medium | Few instanced batches, no physics/post overload | P7 |
| Browser screenshot harness detached from production | Critical | Navigate actual React preset chooser in harness | P8 |
| Evolving branch differs from uploaded snapshot | High | Compare APIs/contract in P0 and update plan | P0 |

## Decision log to complete in P0/P1

```text
D01: Native edge geometry strategy (separate thin rods vs shader barycentric/edge pass):
D02: Projection/fixed camera (camera position, look target, clipping tests):
D03: Free-run vs beat-grid clock composition with global Audio Dock Sync:
D04: Transition interrupt strategy and collision envelope policy:
D05: Shared trigger event resolver choice for non-Mainframe preset:
D06: Auto Performance override entry/exit and edit cooldown:
D07: Exactly which continuous audio capabilities are required vs optional:
D08: Browser fixture source strategy and performance baseline machine:
D09: Optional atmosphere/camera effects kept or excluded after visible consumer proof:
```

## Definition of *not done*

The preset isn't complete when only nine static cubes exist, when six patterns are visually indistinguishable, or when audio sensitivity changes internal numbers without moving actual geometry. Nor is it done if Pattern Change OFF works but ON fails on stale events, if five color pickers alias the same color, or if Auto Performance pushes a user-selected Pattern aside permanently. The expected outcome is a modest implementation with **full engine fidelity**, not just a convincing screenshot.
