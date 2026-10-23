# BLOCKSHIFT — Immersive, observer-centered field

**Later count revision:** The user subsequently requested six additional cubes. [The fifteen-cube revision](22_FIFTEEN_CUBE_FIELD.md) supersedes object counts here; the observer-centered visual direction remains authoritative. Evidence below is the original nine-object checkpoint.

2026-10-22. The user's clarified visual target is authoritative: the observer floats inside a three-dimensional space, close to large cubes that evolve around the observer on all sides. The prior distant, fully framed installation was the wrong composition. This revision supersedes its 3×3 presentation, camera placement, scale limits, tight-gap policy and all-nine-in-frame acceptance.

## Current visual and control contract

- Camera at `[0,0,0]`, looking toward `[0,0,-10]`, FOV 85°, minimum aspect 0.9, near 0.2, far 420. It remains owned by the existing Cinema 2.0 camera runtime. No new renderer or camera stack.
- Nine stable objects use the same supplied models: eight Hallow Cubes surround the observer; Impossible Cube occupies a deeper forward position. Four Hallow Cubes occupy the rear volume. The forward four have varied distances: close peripheral cubes plus readable mid-distance cubes. Large edge crops are intentional. Rear objects are physically present and are not expected to appear in a single forward view.
- Block Size range is now **1.05–3.00**, with physical scale **6×** the Inspector value, up from 3×. Default 1.35 means side 8.10; the user's saved 1.80 means 10.80; maximum 3.00 means 18.00. Existing values persist and immediately produce larger geometry.
- Spread range is now **0.50–3.00**. Safety/clearance is solved first, then Spread expands lateral positions by `1 + (Spread - 0.5) * 0.4` and depth positions by `1 + (Spread - 0.5) * 0.12`. It changes real spacing and perspective without shrinking models or being canceled by the clearance solver.
- Minimum transformed-box surface separation is **1.5 world units** before Spread; the observer has at least **2.5 units** outside each object's conservative bounding sphere. Rig radius is bounded at 300. These checks prevent camera penetration and model intersection, while allowing deliberate peripheral cropping.
- Depth now controls the thickness of the surrounding volume; zero keeps a shallow but still surrounding volume instead of collapsing every object into the camera plane.
- Stack, Orbit, Stagger, Split, Wave and Collapse are reauthored as six poses around this same observer. Phase 4 now adds six distinct authored trajectories and safe transitions around these poses. Idle/pause/zero-motion holds the pose except for explicitly requested manual edits. See [the P4 report](20_P4_MOTION_AND_FLOATING_CAMERA_REPORT.md).

## Remaining motion/audio work

No track-energy response, build/drop choreography or Auto Performance is introduced by this visual revision. Their controls remain hidden. Full pattern movement/transitions and basic shared-runtime camera float are now Phase 4. Shared Audio Intelligence reactions remain subsequent scope. The camera retains its forward view with bounded float; free-look, travel controls and panoramic output are not implemented. The surrounding geometry is real, including the rear objects.

## Acceptance appropriate to this target

The former test that every cube corner must fit in one shot is intentionally retired. Current acceptance requires the camera inside a surrounding field on every axis, rear objects present, large visible forward objects at wide/square/portrait, finite safe transforms, stable identities, visible spacing changes, no change in object size when Spread changes, and visible clock-driven evolution.

- Focused tests: **19/19 PASS**. Full size/spread extrema through 3.00 are included, with clearance, eye exclusion, six poses and projected foreground size relative to the viewport's shorter dimension.
- Focused lint: **PASS**. Scoped TypeScript: **0 changed-file diagnostics**, 4 known dependency diagnostics. Known full-repository TypeScript failures were not rerun.
- Real-workspace browser: **PASS** on the final depth-distribution revision. Wide/square/portrait captures show five visible forward objects and four rear objects, with all nine instances submitted in four batches. The first visual review prompted the final depth adjustment so the composition includes fully readable mid-distance cubes as well as close edge crops. Real Size 1.80 and maximum 3.00, Spread through 3.00, saved settings/re-entry, unchanged physical model size under Spread, GL/resource lifecycle, BPM contrast, playback motion and pause/zero-motion freezing pass.

Current evidence is in [evidence/immersive-field](evidence/immersive-field/), especially [the actual in-app view](evidence/immersive-field/production-inspector.png), [wide output](evidence/immersive-field/idle-bloom-off-16x9.png) and [acceptance JSON](evidence/immersive-field/acceptance.json). Working tree and affected source reviewed; `git diff --check` passed. Reproduce with Node 22: `node scripts/run-cinema2-blockshift-browser.mjs --immersive`. Changes are uncommitted; no commit requested. Final human visual acceptance remains outstanding.

## User approval and Phase 4 scope change

The user approved this visual direction ("Yes, I like this") and explicitly moved basic floating camera motion/controls into Phase 4. This approves the immersive target; it does not constitute review of the subsequent Phase 4 motion captures. Camera float stays inside a volume smaller than one world unit from the origin; Camera Motion OFF and Master Motion Amount zero restore the base view. FOV remains editable while stopped. Phase 7 retains camera polish, effects and performance hardening. Earlier test counts/evidence above refer to this visual revision checkpoint; use the P4 report for current validation.
