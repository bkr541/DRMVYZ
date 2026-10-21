# 10. Contract traceability: root standard → implementation → proof

This is a lightweight requirements traceability matrix, not a claim of test execution. Add code/PR/test evidence during implementation.

| ID / root contract topic | LIGHTFIELD planned implementation | Acceptance tests / phase | Status |
|---|---|---|---|
| R-01 §8 authored new preset reference | `01` world-space tile composition, approved hero/camera/patterns | P1, P2; LF-003/004/026 | PLAN ONLY |
| R-02 §5 geometry axes, pivots, bounds | XZ center grid, Y lift, 144 cap, finite transforms, camera-safe crops | P2; LF-001/003/004 | PLAN ONLY |
| R-03 §9 four Design parent groups | All controls under `master-controls`, `design`, `effects`, `palette` | P3; LF-006 | PLAN ONLY |
| R-04 §9 BPM Sync | Boolean in Design > Master Controls, shared music or authored time, explicit host composition | P3–P4; LF-013 | PLAN ONLY |
| R-05 §9 five independently configured colors | Background, Tile Surface, Primary Panels, Secondary Panels, Accent Hits | P3; LF-014 | PLAN ONLY |
| R-06 §9 ordered Pattern trio | Pattern enum, Pattern Change boolean OFF, conditional Trigger in Design > Design | P3; LF-007/008 | PLAN ONLY |
| R-07 §9 six native patterns | Checker Pulse, Center Ripple, Row Run, Diagonal Cut, Cross Axis, Split Plane; real Y/tilt | P4; LF-009 | PLAN ONLY |
| R-08 §9 11 canonical triggers | Import Afterhours options, shared resolver/controller and deduplication | P4–P5; LF-008/011/020 | PLAN ONLY |
| R-09 §9 manual Pattern selection while ON | Immediate new base; ON remains; consume stale event, advance on next fresh event | P4–P5; LF-012 | PLAN ONLY |
| R-10 §§3–4 explicit parameter authority | Matrix `05`, caps, hard OFFs, no Auto base overwrites | P3/P6; LF-015/024 | PLAN ONLY |
| R-11 §§10–11 shared audio/music route | Bridge + distinct continuous/rhythm/structural targets | P5; LF-016–020 | PLAN ONLY |
| R-12 §§11–12 playback/idle | Deliberate idle, pause, seek, loop, track/context reset, re-entry | P4/P5/P7; LF-021/022 | PLAN ONLY |
| R-13 §§13–15 Director/choreography/Auto | Bounded transient target overlays; Auto never owns base Pattern v1 | P6; LF-024 | PLAN ONLY |
| R-14 §16 render-space intent | Native world grid with real depth/camera | P2; LF-003/004 | PLAN ONLY |
| R-15 §§17–18 camera/effects | Safe perspective camera, optional gated drift, real OFF/normal/max bloom | P7; LF-023 | PLAN ONLY |
| R-16 §19 production-canvas proof | Browser captures of primary geometry, controls, patterns, audio, lifecycle | P8; LF-003–026 | PLAN ONLY |
| R-17 §20 human visual acceptance | Signed recognition, movement and musicality review | P8/P9; LF-026 | PLAN ONLY |
| R-18 §§23–25 implementation order/DoD | P0–P9 phase gates and release checklist | P0–P9; `09` | PLAN ONLY |
| R-19 host resources and render graph | Native registered module, host world render provider, color+depth, disposal | P2/P7; LF-002/025 | PLAN ONLY |
| R-20 performance/scope | 64 default, ≤144 maximum, instancing, no per-tile lights, no physics | P2/P7; LF-001/025 | PLAN ONLY |

## Required code review notes

For each requirement, implementation reviewer must record: (1) exact source file and relevant symbol, (2) actual unit/integration/browser test with outcome, (3) visual artifact if applicable, (4) remaining exception with approved owner. **Do not convert PLAN ONLY into PASS without verification**.

## Contract discrepancy precedence

If this plan's proposed numeric tuning conflicts with the live repository standard or actual validated capabilities, **the live root contract takes precedence**; document and review the product tuning change. If a historic preset's parameter placement, Pattern Change type or handling conflicts with the root contract, copy the shared API pattern, **not** the old nonconforming behavior.
