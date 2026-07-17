# LaserDMX Physical Scanner Correction, Patch 4 of 6

## Scope

Patch 4 makes ordered scanner paths a first-class Show Director authoring format. It adds pattern creation, custom point editing, scanner inspector controls, explicit legacy conversion, deterministic validation, history and persistence integration, high-level Performance Program actions, Track Map-aware reconstruction, editor overlays, and scanner diagnostics. It does not rewrite the built-in presets or Performance Shows; that work remains isolated to Patch 5.

The fixed front-center camera, scanner-sample WebGL renderer, linear-light color pipeline, explicit prism and diffraction copies, dedicated nonlaser renderers, Canvas2D fallback, Shared Performance timeline, and production DMX/output paths remain authoritative.

## Authored scanner model

Laser fixtures may persist an optional `scanner` configuration beside the legacy beam fields. The scanner configuration contains:

- Pattern type and enabled state
- Ordered path points
- Open or closed topology
- Loop, ping-pong, or once playback
- Linear, arc, or Bezier interpolation
- Forward, reverse, or alternating direction
- Scan rate, musical duration, phase, size, fan width, radius, and depth layer
- Point and corner dwell
- Blanked points and retrace blanking delay
- Normal, prism, line diffraction, grid diffraction, or burst diffraction optics
- Optical copy and supported aperture counts
- Velocity, acceleration, shutter exposure, and calibration metadata
- Explicit migration metadata and a legacy-target backup

Transient performance overrides are stored on `runtimeScanner`. Normalization deliberately omits them, so seeking and performance playback never contaminate saved authoring state.

## Pattern authoring

The pattern factory creates ordered paths for Hold Beam, Line Sweep, Fan Sweep, Circle, Arc, Triangle, Polygon, Wave, Tunnel, Mirrored Corridor, Grid Scan, Custom Path, Diffraction Line, Diffraction Grid, and Diffraction Burst.

Normal scanner patterns never create persistent source-to-target spokes. Hold Beam contains one visible scanner position. Circles and polygons trace their perimeter. Waves progress along a curve. Fan Sweep exposes recent positions only through shutter integration. Tunnel and corridor patterns remain fixture-local and use phase and depth offsets for coordinated multi-fixture choreography. Additional simultaneous rays require explicit prism, diffraction, or supported multi-aperture semantics.

## Editor and inspector

Edit mode shows ordered segments, point order, direction markers, blanked travel, dwell and depth badges, the current phase preview, migration status, and draggable points. Hybrid mode uses the existing selected-fixture visibility contract. Live and Capture continue to suppress the editor, fixture handles, grids, warnings, and diagnostics.

The default scanner inspector exposes pattern, scan rate, musical duration, direction, phase, size, fan width, radius, intensity and color through existing fixture controls, depth, shutter state, and migration entry points. Expandable advanced controls expose path playback, interpolation, closure, reverse, point insertion and removal, reordering, per-point blanking/dwell/corner/depth overrides, optics, copy and aperture counts, physical limits, exposure, and calibration profile.

Every edit uses the existing Show Director fixture transaction model. Dragging coalesces into one transaction. Migration application, path changes, optical changes, phase, depth, and point operations are undoable and redoable.

## Validation

Scanner validation is deterministic and warning-first. It reports:

- Unsupported fixture or optical combinations
- Empty paths and paths with no visible points
- Invalid closed paths
- Multiple held-beam positions
- Unsafe stage bounds or depth values
- Excessive dwell
- Implausible scan timing or acceleration
- Invalid optical copy or aperture counts
- Single-aperture multi-ray requests without explicit optics
- Optical modes without useful copies
- Unsupported multi-aperture requests
- Duplicate authored and legacy rendering risk
- Long disconnected travel that is not blanked

Old projects are never blocked from loading. Runtime compatibility conversion remains available until Patch 5 and later migration hardening remove the need for it.

## Legacy migration

Legacy target data is detected and classified without mutating the saved project. Preview produces an ordered scanner path, visible and blanked segment counts, confidence, ambiguity, and warnings. Applying conversion is explicit and stores the original target array as a versioned backup.

Known conversions cover held targets, two-point sweeps, angular fans, circles, polygons, waves, mirrored corridors, and disconnected subpaths with blanked retrace. Radial target networks without explicit optical hardware remain sequential scanner paths and are never silently labeled diffraction.

Loading, previewing, and renderer compatibility conversion do not write migrated state. Only an explicit inspector action persists the scanner configuration.

## Performance and Track Map integration

Performance Programs may issue a typed `scanner` fixture action to change pattern, scan rate, duration, direction, reverse state, phase, fan width, radius, size, depth, blanking, optical mode and count, shutter state, held-beam state, path reset token, and musical switch boundary. Existing common fixture action fields continue to control intensity and color.

Scanner actions are evaluated by the existing Shared Performance context. Manual Track Map sections remain authoritative over analyzed sections. The resolver writes only transient scanner overrides, and the scene frame reconstructs the effective scanner from audio time, section/occurrence context, program seed, seek identity, loop identity, and authored state. No scanner-specific timeline or mutable scanner cursor is introduced.

## Compatibility and persistence

- Show Director schema version advances to 15.
- Existing projects remain readable and keep legacy targets.
- Scanner defaults are applied only when scanner data exists or a user creates/migrates a pattern.
- Loading does not silently author scanner state.
- Migration backups preserve their original first target and all subsequent targets.
- Solver state, exposure samples, GPU resources, migration previews, and runtime scanner overrides are not persisted.
- Canvas2D receives synchronized compatibility targets for authored paths.
- Production DMX/output behavior is unchanged.

## Diagnostics

Outside Capture mode the scanner diagnostics surface reports selected scanner head, active pattern, point count, visible and blanked segments, scan rate, exposure samples, dwell totals, optical copies, aperture count, compatibility mode, migration status, and validation warnings.

## Deferred to Patch 5

Patch 5 owns the complete built-in preset migration and Performance Show re-authoring. It should replace remaining persistent-target authored content with intentional ordered paths, coordinate tunnel and corridor fixture banks, assign professional musical roles across all fixture kinds, and evolve full-song sections without removing compatibility paths that are still required for user migrations.
