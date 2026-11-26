# SYS-07 — Inspector hierarchy and source ownership

The canonical Design projection omits source descriptors already owned by the Source tab (native media slots and module-backed user-model pickers). IDs, defaults, range, persistence and bindings remain unchanged. Legacy unclassified fixture/diagnostic sections remain compatible. Model version history and geometry details remain available in Source under the collapsed Model versions and details group. Source retains its existing selection policy; Auto Performance continues to lock authored Design/Effects controls, not Source actions.

`metadata.inspectorSource` is a UI-only optional rule (`slot`, `requires: media | pool`). The Inspector reads the active slot and existing preset pool selection; it does not own media or change saved parameters. Everywhere retains its existing custom-media visibility, and Corridor's Pool Trigger appears only for a pool. All other presentation controls remain available unless an authored relevance rule says otherwise. A subgroup remains mounted while its parent is collapsed, preserving its disclosure state. Advanced-only subgroups start collapsed.

Everywhere camera distance retains the original display range 11–17, step 0.1 and default 14, projected from the authored Z offset (-3 to 3, default 0). The generic vector presentation metadata is UI-only; editing preserves the other axes. Camera authority and bindings are unchanged.

The four canonical parents use the existing disclosure and control primitives. No new dependencies or parameter schema migration.
