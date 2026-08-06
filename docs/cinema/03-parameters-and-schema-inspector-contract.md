# Cinema Stage 3: Parameter Resolution and Schema-Generated Control Contracts

Cinema Stage 3 adds the runtime-neutral parameter layer behind the production `components/vyzualz/cinema` public module. It does not register the `cinema` React engine, add a Zustand store, render Inspector controls, evaluate audio modulation routes, apply Shared Performance rules, resolve Brand Kit assets, allocate a canvas/WebGL context, or change any legacy engine path.

## Production entry point

```ts
import {
  normalizeCinemaParameterValue,
  resolveCinemaParameterDestination,
  resolveCinemaParameterSnapshot,
  createCinemaControlDescriptors,
} from '../cinema'
```

Stage 5 still owns React engine registration. Through Stage 3, production reachability is the public Cinema package boundary used by the graph compiler, registry, future store, and future runtime.

## Parameter schema

The schema supports:

- float and integer values with finite ranges, steps, units, logarithmic hints, and deterministic quantization
- boolean, enum, and trigger values
- normalized RGBA colors and semantic Brand Kit roles
- gradients and curves with stable control-point IDs and deterministic ordering
- vector2 and vector3 values with per-component bounds and steps
- texture and asset-reference values with stable asset IDs and accepted role constraints
- UI-neutral hints for control kind, ordering, precision, compact presentation, placeholder text, and help text
- optional master bindings with stable source IDs, scale/add/replace operations, and bounded influence

`asset` remains accepted as the Stage 1 compatibility spelling. New definitions should use `asset-reference`.

Schema validation is part of node registry admission. Invalid schemas cannot enter the immutable Cinema node definition registry. Composition master schemas and authored values are also inspected by graph validation. Malformed values produce structured diagnostics and deterministic safe fallbacks rather than exceptions or partial canonical mutations.

## Fixed resolution order

The public constant `CINEMA_PARAMETER_RESOLUTION_ORDER` fixes the operation order:

```text
definition default
→ saved preset value
→ composition instance override
→ master influence
→ modulation snapshot
→ performance override
→ safety clamp
→ final runtime value
```

Each resolved entry includes an immutable trace with every stage and whether it applied. Transient modulation and performance snapshots are input-only. Resolution never writes them, master results, or final values back into the composition or instance.

Master parameters resolve first through their own saved, instance, modulation, performance, and clamp stages. Node and camera bindings then consume the resolved master snapshot. Scale is the default binding operation. Add and replace must be explicitly declared and type-compatible.

## Stable destinations

Destination parsing and lookup support:

- `master.<parameter-id>`
- `nodes.<node-id>.<parameter-id>`
- `effects.<effect-node-id>.<parameter-id>`
- `cameras.<camera-id>.<parameter-id>`

Master schemas come from the composition. Node and effect schemas come from the immutable node registry. Camera schemas are supplied as runtime-neutral metadata until the dedicated camera registry arrives. Missing owners, schemas, plugins, or incompatible effect namespaces return `CINEMA_PARAMETER_DESTINATION_UNAVAILABLE` diagnostics.

Labels are display metadata only. Renaming a parameter label does not change its stable ID, persisted value key, master binding, modulation destination, performance destination, or generated control path.

## UI-neutral control descriptors

`createCinemaControlDescriptors` converts schemas and current values into immutable descriptors containing:

- stable ID and destination path
- label, group, ordering, advanced state, and modulation capability
- control kind, current/default value, ranges, steps, units, precision, and logarithmic metadata
- enum options or accepted asset roles
- description/help metadata
- explicit disabled state and disabled reason

The descriptors import no React component or application store. A later Inspector can render them with the shared DRMVYZ control library without duplicating parameter business logic.

## Initial master catalog and Brand Kit slots

`CINEMA_MASTER_PARAMETER_CATALOG` defines stable initial master controls for intensity, motion, complexity, atmosphere, bloom, and seven semantic color slots. `CINEMA_BRAND_PARAMETER_SLOTS` maps the color IDs to primary, secondary, accent, background, foreground, highlight, and shadow roles.

These are contracts only. No Brand Kit value or asset bridge is implemented in this stage.

## Persistence and compatibility

Stage 3 adds optional schema metadata and runtime services but does not add a new required persisted field:

- Composition schema remains `drmvyz.cinema.composition`, version `1`.
- Package schema remains `drmvyz.cinema.package`, version `1`.
- React store persistence remains unchanged.
- Resolved snapshots, traces, diagnostics, control descriptors, modulation values, and performance overrides remain runtime-only.
- Shader Pads, Cinematic Worlds, Sound Drawing, CANVAS, LaserDMX, and PixGrid remain unchanged and selectable.

## Stage 4 handoff

Stage 4 can persist and migrate compositions, instances, parameter values, bindings, and package data using the validated schema and stable path contracts. It must continue to exclude resolved snapshots, control descriptors, diagnostics, and transient modulation/performance values from canonical saved state.
