# Cinema Stage 2: Graph Validation and Compilation

Cinema Stage 2 adds a pure, runtime-neutral graph registry, validator, and compiler behind the production `components/vyzualz/cinema` public module. It does not register the `cinema` React engine, add UI or persisted state, execute nodes, allocate render targets, create a canvas/WebGL context, or adapt legacy Shader Pads/Cinematic Worlds renderers.

## Production entry point

```ts
import {
  createCinemaNodeDefinitionRegistry,
  validateCinemaCompositionGraph,
  compileCinemaCompositionGraph,
} from '../cinema'
```

The attached repository still intentionally exposes only the existing React engine catalog. Stage 5 owns the future `cinema` engine registration, so the Stage 2 production path is the public Cinema package boundary established in Stage 1.

## Runtime-neutral registry

`CinemaNodeDefinitionRegistry` stores immutable metadata only:

- stable node type and renderer-plugin IDs
- typed input/output port declarations
- parameter schemas
- renderer family and capability declarations
- cost and quality limits
- built-in or adapter provenance
- optional explicit feedback input/output history contracts

Registry construction groups registrations by stable node type ID. Exact duplicates and incompatible duplicates are rejected deterministically, independent of registration order. Invalid port directions, duplicate ports/parameters, feedback declarations, versions, plugin references, and quality limits are diagnosed before an entry becomes available to compilation.

No entry contains a renderer instance, WebGL/Canvas object, target lease, texture, DOM object, animation loop, or UI import.

## Validation

`validateCinemaCompositionGraph` accepts unknown input so malformed imported data cannot throw through the React tree. It validates:

- schema identity, version, revision, and required arrays
- duplicate node, connection, parameter, and asset-binding IDs
- registered node types, type versions, family compatibility, and renderer-plugin availability
- exactly one enabled output and a valid `outputNodeId`
- connection node/port existence, port direction, typed compatibility, cardinality, and required inputs
- unknown authored node/master parameters and modulation/performance destination paths
- missing asset bindings and, when an availability set is supplied, missing stable assets
- reachability of every enabled node to the active output
- illegal current-frame cycles

Validation returns a bounded deterministic diagnostic snapshot. Errors never mutate the composition or registry.

## Explicit feedback semantics

A cycle is legal only when it crosses a registry-declared feedback write input. The compiler treats a connection entering that input as a temporal edge:

```text
previous-frame feedback output
→ current-frame effect work
→ feedback write for the next frame
```

Only the temporal write edge is removed from current-frame topological ordering. The compiled plan records the connection, feedback node, read/write ports, source endpoint, and history length in `feedbackEdges`. A direct cycle with no such boundary is rejected with `CINEMA_GRAPH_CYCLE`.

## Deterministic compiled plan

`compileCinemaCompositionGraph` returns either:

- a stable plan containing topological execution phases, flattened node order, input binding tables, explicit feedback edges, output ownership, registry fingerprint, and resource-lifetime hints; or
- `plan: null`, structured diagnostics, and `CINEMA_SAFE_OUTPUT_DESCRIPTOR`.

Nodes, ports, connections, phases, bindings, diagnostics, and hints are sorted by stable identifiers wherever authored array order has no semantic meaning. Equivalent graphs therefore compile identically after node/connection array reordering.

Resource hints describe only declarative costs and lifetimes. They do not allocate targets or execute renderers.

## Persistence and compatibility

Stage 2 changes no persisted Cinema or React representation:

- Composition schema remains `drmvyz.cinema.composition`, version `1`.
- Package schema remains `drmvyz.cinema.package`, version `1`.
- React store persistence remains unchanged.
- Shader Pads, Cinematic Worlds, Sound Drawing, CANVAS, LaserDMX, and PixGrid remain unchanged and selectable exactly as before.

Compiled plans, registry fingerprints, diagnostics, and resource hints are derived runtime data and must not be persisted.

## Stage 3 handoff

Stage 3 can use the immutable registry and compiled input/parameter ownership tables to add parameter normalization and schema-generated control contracts. It must continue to keep resolved per-frame values outside canonical persisted state.
